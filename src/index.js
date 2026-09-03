import dotenv from 'dotenv';
dotenv.config();

import {
  Client,
  GatewayIntentBits,
  Events,
  Collection,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  StringSelectMenuBuilder
} from 'discord.js';

import Database from './database/Database.js';
import GuildCache from './cache/GuildCache.js';
import { IncidentEngine } from './security/IncidentEngine.js';
import { PunishmentEngine } from './security/PunishmentEngine.js';
import { SnapshotManager } from './security/SnapshotManager.js';
import { AuditCorrelator } from './security/AuditCorrelator.js';
import { WhitelistManager } from './security/WhitelistManager.js';
import { OwnerManager } from './security/OwnerManager.js';

import { registerEvents } from './events/index.js';
import { commandDefinitions, handleCommand, buildStatusContainer } from './commands/index.js';
import { onReady } from './events/ready.js';

console.log('[Luna] Starting up...');

const database = new Database();
await database.init();

const guildCache = new GuildCache();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildScheduledEvents,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.AutoModerationConfiguration,
    GatewayIntentBits.AutoModerationExecution
  ],
  rest: { timeout: 15000 }
});

const incidentEngine = new IncidentEngine(database);
const punishmentEngine = new PunishmentEngine(client, guildCache);
const snapshotManager = new SnapshotManager(client, guildCache, database);
const auditCorrelator = new AuditCorrelator(client, guildCache);
const whitelistManager = new WhitelistManager(guildCache, database);
const ownerManager = new OwnerManager(guildCache, database);

const context = {
  client,
  database,
  cache: guildCache,
  incidentEngine,
  punishmentEngine,
  snapshotManager,
  auditCorrelator,
  whitelistManager,
  ownerManager
};

registerEvents(client, context);

const PREFIX = '&';

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction, context);
    }

    if (interaction.isButton()) {
      const { database, cache } = context;
      const guildId = interaction.guildId;

      if (interaction.customId === 'antinuke_enable') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
        }

        const loadingContainer = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('# Luna\n**Enabling all modules...**')
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('Please wait a moment')
          );
        await interaction.update({ components: [loadingContainer], flags: 32768 });

        await new Promise(r => setTimeout(r, 800));

        let config = database.getGuildConfig(guildId);
        if (!config) await database.initGuildConfig(guildId);
        config = database.getGuildConfig(guildId);
        Object.keys(config).forEach(k => {
          if (typeof config[k] === 'object' && config[k] !== null && 'enabled' in config[k]) {
            config[k].enabled = true;
          }
        });
        database.upsertSecurityConfig(guildId, config, new Date().toISOString());

        const guild = interaction.guild;
        const now = new Date().toISOString();
        if (guild) {
          guild.roles.cache.forEach(role => {
            if (role.id !== guild.id) {
              database.setProtectedRoles(guildId, role.id, interaction.user.id, now);
              cache.get(guildId).protectedRoles.add(role.id);
            }
          });
          guild.channels.cache.forEach(channel => {
            database.setProtectedChannels(guildId, channel.id, interaction.user.id, now);
            cache.get(guildId).protectedChannels.add(channel.id);
          });
          guild.invites.cache.forEach(invite => {
            database.setProtectedWebhooks(guildId, invite.code, invite.url || '', interaction.user.id, now);
            cache.get(guildId).protectedWebhooks.add(invite.code);
          });
        }

        cache.get(guildId).config = config;
        const state = cache.get(guildId);
        state.client = interaction.client;
        const container = buildStatusContainer(config, state, true);
        return interaction.editReply({ components: [container] });
      }

      if (interaction.customId === 'antinuke_disable') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
        }

        const loadingContainer = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('# Luna\n**Disabling all modules...**')
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('Please wait a moment')
          );
        await interaction.update({ components: [loadingContainer], flags: 32768 });

        await new Promise(r => setTimeout(r, 800));

        let config = database.getGuildConfig(guildId);
        if (!config) await database.initGuildConfig(guildId);
        config = database.getGuildConfig(guildId);
        Object.keys(config).forEach(k => {
          if (typeof config[k] === 'object' && config[k] !== null && 'enabled' in config[k]) {
            config[k].enabled = false;
          }
        });
        database.upsertSecurityConfig(guildId, config, new Date().toISOString());
        cache.get(guildId).config = config;
        const state = cache.get(guildId);
        state.client = interaction.client;
        const container = buildStatusContainer(config, state, false);
        return interaction.editReply({ components: [container] });
      }

      if (interaction.customId === 'antinuke_status') {
        const config = database.getGuildConfig(guildId);
        const state = cache.get(guildId);
        state.client = interaction.client;
        const enabled = config && Object.values(config).some(v => typeof v === 'object' && v !== null && v.enabled === true);
        const container = buildStatusContainer(config, state, enabled);
        return interaction.update({ components: [container], flags: 32768 });
      }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'help_select') {
      const value = interaction.values[0];

      const descriptions = {
        antinuke: '**/antinuke** — Opens the security panel\n\nShows all protection modules with Enable/Disable buttons. Click Enable All to activate protection for your server.',
        whitelist: '**/whitelist add @user** — Add user to whitelist\n**/whitelist remove @user** — Remove from whitelist\n**/whitelist list** — Show all whitelisted users\n\nWhitelisted users are immune to all protection actions.',
        coowner: '**/coowner add @user** — Add extra owner\n**/coowner remove @user** — Remove extra owner\n**/coowner list** — Show all extra owners\n\nExtra owners have same permissions as the server owner.',
        lockdown: '**/lockdown** — Activate lockdown mode\n\nDisables all modules and puts server on high alert. Only admins can manage.',
        unlock: '**/unlock** — Deactivate lockdown\n\nReturns protection to normal operation.',
        ping: '**&ping** — Check bot latency\n\nShows message latency and API response time.'
      };

      const container = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`# Luna\n${descriptions[value] || 'Unknown command'}`)
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('[Zynrax Development](https://discord.gg/zynrax)')
        );

      return interaction.reply({ components: [container], flags: 32768, ephemeral: true });
    }
  } catch (error) {
    console.error('[Luna] Error:', error);
    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# Luna\nAn error occurred.')
      );
    if (interaction.replied || interaction.deferred) {
      return interaction.followUp({ components: [container], flags: 32768, ephemeral: true }).catch(() => {});
    }
    return interaction.reply({ components: [container], flags: 32768, ephemeral: true }).catch(() => {});
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const mentionRegex = new RegExp(`^<@!?$\\{client.user.id}>\\s*$`);
  if (mentionRegex.test(message.content.trim())) {
    const avatarUrl = client.user.displayAvatarURL({ size: 256 });
    const container = new ContainerBuilder();

    try {
      const section = new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('# Luna\nAnti-nuke security bot')
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(avatarUrl)
        );
      container.addSectionComponents(section);
    } catch {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# Luna\nAnti-nuke security bot')
      );
    }

    container
      .addSeparatorComponents(
        new SeparatorBuilder()
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('**Prefix**\n`&help` — Show commands\n`&ping` — Check latency')
      )
      .addSeparatorComponents(
        new SeparatorBuilder()
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('[Zynrax Development](https://discord.gg/zynrax)')
      );

    return message.reply({
      components: [container],
      flags: 32768
    });
  }

  if (!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'help') {
    const avatarUrl = client.user.displayAvatarURL({ size: 256 });
    const container = new ContainerBuilder();

    const section = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# Luna Commands\nYour cute anime security guardian')
      )
      .setThumbnailAccessory(
        new ThumbnailBuilder().setURL(avatarUrl)
      );
    container.addSectionComponents(section);

    container
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('Select a command from the dropdown below to see details')
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('[Zynrax Development](https://discord.gg/zynrax)')
      );

    const select = new StringSelectMenuBuilder()
      .setCustomId('help_select')
      .setPlaceholder('Select a command...')
      .addOptions(
        { label: '/antinuke', description: 'Open security panel', value: 'antinuke' },
        { label: '/whitelist', description: 'Manage whitelisted users', value: 'whitelist' },
        { label: '/coowner', description: 'Manage extra owners', value: 'coowner' },
        { label: '/lockdown', description: 'Activate lockdown mode', value: 'lockdown' },
        { label: '/unlock', description: 'Deactivate lockdown', value: 'unlock' },
        { label: '&ping', description: 'Check bot latency', value: 'ping' }
      );

    const row = new ActionRowBuilder().addComponents(select);

    return message.reply({ components: [container, row], flags: 32768 });
  }

  if (command === 'ping') {
    const sent = await message.reply({ content: 'Pinging...' });
    const latency = sent.createdTimestamp - message.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);

    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# Pong!')
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**Latency:** ${latency}ms\n**API:** ${apiLatency}ms`)
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('[Zynrax Development](https://discord.gg/zynrax)')
      );

    return sent.edit({ content: '', components: [container], flags: 32768 });
  }

  if (command === 'antinuke') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('Administrator permission required.');
    }
    const { database, cache } = context;
    const guildId = message.guild.id;
    let config = database.getGuildConfig(guildId);
    if (!config) await database.initGuildConfig(guildId);
    config = database.getGuildConfig(guildId);
    const state = cache.get(guildId);
    state.client = client;
    const enabled = config && Object.values(config).some(v => typeof v === 'object' && v !== null && v.enabled === true);
    const container = buildStatusContainer(config, state, enabled);
    const reply = await message.reply({ components: [container], flags: 32768 });
    const collector = reply.createMessageComponentCollector({ time: 60000 });
    collector.on('end', () => {
      const disabled = buildStatusContainer(config, state, enabled);
      reply.edit({ components: [disabled] }).catch(() => {});
    });
    return reply;
  }
});

client.on(Events.ClientReady, async () => {
  await onReady(client, context);
});

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

try {
  console.log('[Luna] Registering slash commands...');
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
    body: commandDefinitions
  });
  console.log('[Luna] Slash commands registered');
} catch (error) {
  console.error('[Luna] Failed to register slash commands:', error);
}

console.log('[Luna] Logging in...');
await client.login(process.env.TOKEN);

process.on('unhandledRejection', (error) => {
  console.error('[Luna] Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('[Luna] Uncaught exception:', error);
});

const shutdown = async (signal) => {
  console.log(`[Luna] Received ${signal}, shutting down...`);
  client.destroy();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));