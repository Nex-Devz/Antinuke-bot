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

function cmdMention(name, subcommand) {
  const id = commandMap.get(name);
  if (!id) return `/${name}${subcommand ? ` ${subcommand}` : ''}`;
  return subcommand ? `</${name} ${subcommand}:${id}>` : `</${name}:${id}>`;
}

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
        antinuke: `**${cmdMention('antinuke')}** \u2014 Opens the security panel\n\nThe main control panel for Luna. Shows all 20 protection modules with their current status (ON/OFF). You can Enable All modules at once or Disable All. The panel auto-refreshes when you make changes.\n\nModules include: Channel, Role, Permission, Webhook, Emoji, Sticker, Ban, Kick, Member Role, Admin Escalation, Bot, Integration, Auto Mod, Scheduled Event, Invite, Invite Role, Linked Role, Raid, Mass Mention, and Emergency Lockdown.`,
        whitelist: `**${cmdMention('whitelist', 'add')}** \u2014 Add a user to the whitelist\n**${cmdMention('whitelist', 'remove')}** \u2014 Remove a user from whitelist\n**${cmdMention('whitelist', 'list')}** \u2014 View all whitelisted users\n\nWhitelisted users are completely immune to all protection actions. They can perform any action without triggering alerts or punishments. Use this for trusted moderators and staff members.`,
        coowner: `**${cmdMention('coowner', 'add')}** \u2014 Add an extra owner\n**${cmdMention('coowner', 'remove')}** \u2014 Remove an extra owner\n**${cmdMention('coowner', 'list')}** \u2014 View all extra owners\n\nExtra owners have the same level of permissions as the server owner. They can manage all security settings, whitelist users, and control lockdown. Use this for your most trusted administrators.`,
        lockdown: `**${cmdMention('lockdown')}** \u2014 Activate lockdown mode\n\nImmediately disables all protection modules and puts the server on high alert. During lockdown, no protection actions are taken but all suspicious activity is logged.\n\nThis is useful when you need to perform maintenance or when the bot is giving false positives. Only administrators can activate or deactivate lockdown.`,
        unlock: `**${cmdMention('unlock')}** \u2014 Deactivate lockdown\n\nReturns all protection modules to their previous state. The server goes back to normal operation with all protections active.\n\nMake sure to review any logged incidents after deactivating lockdown to ensure nothing was missed during the lockdown period.`,
        ping: '**&ping** \u2014 Check bot latency\n\nShows the current message latency (how long it takes for the bot to respond) and the Discord API response time.\n\nGood latency values:\n- Under 100ms: Excellent\n- 100-200ms: Good\n- 200-400ms: Fair\n- Over 400ms: Poor'
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

    if (interaction.isStringSelectMenu() && interaction.customId === 'module_toggle') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
      }

      const { database, cache } = context;
      const guildId = interaction.guildId;
      const moduleId = interaction.values[0];

      let config = database.getGuildConfig(guildId);
      if (!config) await database.initGuildConfig(guildId);
      config = database.getGuildConfig(guildId);

      if (config[moduleId] && typeof config[moduleId] === 'object') {
        config[moduleId].enabled = !config[moduleId].enabled;
        database.upsertSecurityConfig(guildId, config, new Date().toISOString());
        cache.get(guildId).config = config;

        const state = cache.get(guildId);
        state.client = interaction.client;
        const enabled = config && Object.values(config).some(v => typeof v === 'object' && v !== null && v.enabled === true);
        const container = buildStatusContainer(config, state, enabled);
        return interaction.update({ components: [container], flags: 32768 });
      }
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

  const mentionRegex = new RegExp(`^<@!?${client.user.id}>\\s*$`);
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
        new TextDisplayBuilder().setContent('Luna is a powerful anti-nuke bot designed to protect your Discord server from malicious attacks, raiders, and abuse. With 20+ security modules running 24/7, your server stays safe from channel deletes, role wipes, mass bans, webhook spam, and more.\n\nSelect a command from the dropdown below to see detailed information about each feature.')
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

    const selectRow = new ActionRowBuilder().addComponents(select);
    container.addActionRowComponents(selectRow);

    return message.reply({ components: [container], flags: 32768 });
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

const commandMap = new Map();

try {
  console.log('[Luna] Registering slash commands...');
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
    body: commandDefinitions
  });
  console.log('[Luna] Slash commands registered');

  const registered = await rest.get(Routes.applicationCommands(process.env.CLIENT_ID));
  for (const cmd of registered) {
    commandMap.set(cmd.name, cmd.id);
  }
  console.log(`[Luna] Command IDs mapped: ${[...commandMap.entries()].map(([n, id]) => `${n}:${id}`).join(', ')}`);
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