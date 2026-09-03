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
  ComponentType
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
        new TextDisplayBuilder().setContent(
          '**Slash Commands**\n`/antinuke` — Security panel\n`/whitelist add/remove/list` — Whitelist users\n`/coowner add/remove/list` — Extra owners\n`/lockdown` — Activate lockdown\n`/unlock` — Deactivate lockdown\n\n**Prefix Commands**\n`&help` — Show this\n`&ping` — Check latency'
        )
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('[Zynrax Development](https://discord.gg/zynrax)')
      );

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