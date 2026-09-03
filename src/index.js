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
import { commandDefinitions, handleCommand, buildStatusContainer, buildButtons } from './commands/index.js';
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
        let config = database.getGuildConfig(guildId);
        if (!config) await database.initGuildConfig(guildId);
        config = database.getGuildConfig(guildId);
        if (!config.modules) config.modules = {};
        Object.keys(config.modules).forEach(k => config.modules[k] = true);
        database.upsertSecurityConfig(guildId, config, new Date().toISOString());
        cache.get(guildId).config = config;
        const state = cache.get(guildId);
        state.client = interaction.client;
        const container = buildStatusContainer(config, state, true);
        const buttons = buildButtons(true);
        return interaction.update({ components: [container, buttons], flags: 32768 });
      }

      if (interaction.customId === 'antinuke_disable') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
        }
        const config = database.getGuildConfig(guildId);
        if (config?.modules) Object.keys(config.modules).forEach(k => config.modules[k] = false);
        if (config) database.upsertSecurityConfig(guildId, config, new Date().toISOString());
        cache.get(guildId).config = config;
        const state = cache.get(guildId);
        state.client = interaction.client;
        const container = buildStatusContainer(config, state, false);
        const buttons = buildButtons(false);
        return interaction.update({ components: [container, buttons], flags: 32768 });
      }

      if (interaction.customId === 'antinuke_status') {
        const config = database.getGuildConfig(guildId);
        const state = cache.get(guildId);
        state.client = interaction.client;
        const enabled = config?.modules && Object.values(config.modules).some(v => v);
        const container = buildStatusContainer(config, state, enabled);
        const buttons = buildButtons(enabled);
        return interaction.update({ components: [container, buttons], flags: 32768 });
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

  if (message.mentions.has(client.user)) {
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