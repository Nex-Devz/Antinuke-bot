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
  PermissionFlagsBits
} from 'discord.js';

import Database from './database/Database.js';
import GuildCache from './cache/GuildCache.js';
import IncidentEngine from './security/IncidentEngine.js';
import PunishmentEngine from './security/PunishmentEngine.js';
import SnapshotManager from './security/SnapshotManager.js';
import AuditCorrelator from './security/AuditCorrelator.js';
import WhitelistManager from './security/WhitelistManager.js';
import OwnerManager from './security/OwnerManager.js';

import registerEvents from './events/index.js';
import { commandDefinitions, handleCommand } from './commands/index.js';
import { onReady } from './events/ready.js';

console.log('[AntiN8] Starting up...');

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

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    await handleCommand(interaction, context);
  } catch (error) {
    console.error('[AntiN8] Error handling command:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'An error occurred.', ephemeral: true });
    } else {
      await interaction.reply({ content: 'An error occurred.', ephemeral: true });
    }
  }
});

client.on(Events.ClientReady, async () => {
  await onReady(client, context);
});

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

try {
  console.log('[AntiN8] Registering slash commands...');
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
    body: commandDefinitions
  });
  console.log('[AntiN8] Slash commands registered');
} catch (error) {
  console.error('[AntiN8] Failed to register slash commands:', error);
}

console.log('[AntiN8] Logging in...');
await client.login(process.env.TOKEN);

process.on('unhandledRejection', (error) => {
  console.error('[AntiN8] Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('[AntiN8] Uncaught exception:', error);
});

const shutdown = async (signal) => {
  console.log(`[AntiN8] Received ${signal}, shutting down...`);
  client.destroy();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));