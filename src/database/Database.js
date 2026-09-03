import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runMigrations } from "./migrations/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, "..", "..", "data");
const DB_PATH = join(DATA_DIR, "antin8.sqlite");

export class LunaDatabase {
  #db;
  #statements;

  constructor() {
    mkdirSync(DATA_DIR, { recursive: true });
    this.#db = new Database(DB_PATH);
    this.#db.pragma("journal_mode = WAL");
    this.#db.pragma("foreign_keys = ON");
    this.#statements = {};
  }

  async init() {
    await runMigrations(this.#db);
    this.#prepareStatements();
    return this;
  }

  run(fn) {
    return this.#db.transaction(fn)();
  }

  close() {
    this.#db.close();
  }

  #prepareStatements() {
    this.#statements = {
      getGuild: this.#db.prepare("SELECT * FROM guilds WHERE guildId = ?"),
      upsertGuild: this.#db.prepare(`
        INSERT INTO guilds (guildId, ownerId, name, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(guildId) DO UPDATE SET
          ownerId = excluded.ownerId,
          name = excluded.name,
          updatedAt = excluded.updatedAt
      `),
      deleteGuild: this.#db.prepare("DELETE FROM guilds WHERE guildId = ?"),

      getSecurityConfig: this.#db.prepare(
        "SELECT * FROM security_config WHERE guildId = ?"
      ),
      upsertSecurityConfig: this.#db.prepare(`
        INSERT INTO security_config (guildId, config, updatedAt)
        VALUES (?, ?, ?)
        ON CONFLICT(guildId) DO UPDATE SET
          config = excluded.config,
          updatedAt = excluded.updatedAt
      `),

      getWhitelist: this.#db.prepare(
        "SELECT * FROM whitelist WHERE guildId = ?"
      ),
      addWhitelist: this.#db.prepare(
        "INSERT INTO whitelist (guildId, targetId, targetType, actions, addedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
      ),
      removeWhitelist: this.#db.prepare(
        "DELETE FROM whitelist WHERE guildId = ? AND targetId = ? AND targetType = ?"
      ),

      getExtraOwners: this.#db.prepare(
        "SELECT * FROM extra_owners WHERE guildId = ?"
      ),
      addExtraOwner: this.#db.prepare(
        "INSERT OR IGNORE INTO extra_owners (guildId, userId, addedBy, createdAt) VALUES (?, ?, ?, ?)"
      ),
      removeExtraOwner: this.#db.prepare(
        "DELETE FROM extra_owners WHERE guildId = ? AND userId = ?"
      ),

      getProtectedRoles: this.#db.prepare(
        "SELECT * FROM protected_roles WHERE guildId = ?"
      ),
      setProtectedRoles: this.#db.prepare(
        "INSERT OR REPLACE INTO protected_roles (guildId, roleId, addedBy, createdAt) VALUES (?, ?, ?, ?)"
      ),

      getProtectedChannels: this.#db.prepare(
        "SELECT * FROM protected_channels WHERE guildId = ?"
      ),
      setProtectedChannels: this.#db.prepare(
        "INSERT OR REPLACE INTO protected_channels (guildId, channelId, addedBy, createdAt) VALUES (?, ?, ?, ?)"
      ),

      getProtectedWebhooks: this.#db.prepare(
        "SELECT * FROM protected_webhooks WHERE guildId = ?"
      ),
      setProtectedWebhooks: this.#db.prepare(
        "INSERT OR REPLACE INTO protected_webhooks (guildId, webhookId, webhookUrl, addedBy, createdAt) VALUES (?, ?, ?, ?, ?)"
      ),

      getTrustedBots: this.#db.prepare(
        "SELECT * FROM trusted_bots WHERE guildId = ?"
      ),
      addTrustedBot: this.#db.prepare(
        "INSERT OR IGNORE INTO trusted_bots (guildId, botId, addedBy, createdAt) VALUES (?, ?, ?, ?)"
      ),
      removeTrustedBot: this.#db.prepare(
        "DELETE FROM trusted_bots WHERE guildId = ? AND botId = ?"
      ),

      addIncident: this.#db.prepare(
        "INSERT INTO security_incidents (guildId, module, action, executorId, targetId, severity, risk, evidence, actionTaken, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ),
      getIncidents: this.#db.prepare(
        "SELECT * FROM security_incidents WHERE guildId = ? ORDER BY createdAt DESC LIMIT ?"
      ),

      addPunishmentHistory: this.#db.prepare(
        "INSERT INTO punishment_history (guildId, executorId, action, reason, moderator, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
      ),
      getPunishmentHistory: this.#db.prepare(
        "SELECT * FROM punishment_history WHERE guildId = ? ORDER BY createdAt DESC LIMIT ?"
      ),

      addSecuritySnapshot: this.#db.prepare(
        "INSERT INTO security_snapshots (guildId, resourceType, resourceId, snapshot, createdAt) VALUES (?, ?, ?, ?, ?)"
      ),
      getSecuritySnapshots: this.#db.prepare(
        "SELECT * FROM security_snapshots WHERE guildId = ? AND resourceType = ? AND resourceId = ? ORDER BY createdAt DESC LIMIT ?"
      ),

      addInviteHistory: this.#db.prepare(
        "INSERT INTO invite_history (guildId, code, inviterId, channelId, uses, maxUses, maxAge, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ),
      getInviteHistory: this.#db.prepare(
        "SELECT * FROM invite_history WHERE guildId = ? ORDER BY createdAt DESC LIMIT ?"
      ),
    };
  }

  getGuild(guildId) {
    return this.#statements.getGuild.get(guildId);
  }

  upsertGuild(guildId, ownerId, name, createdAt, updatedAt) {
    return this.#statements.upsertGuild.run(
      guildId,
      ownerId,
      name,
      createdAt,
      updatedAt
    );
  }

  deleteGuild(guildId) {
    return this.#statements.deleteGuild.run(guildId);
  }

  getSecurityConfig(guildId) {
    return this.#statements.getSecurityConfig.get(guildId);
  }

  upsertSecurityConfig(guildId, config, updatedAt) {
    return this.#statements.upsertSecurityConfig.run(
      guildId,
      JSON.stringify(config),
      updatedAt
    );
  }

  getWhitelist(guildId) {
    return this.#statements.getWhitelist.all(guildId);
  }

  addWhitelist(guildId, targetId, targetType, actions, addedBy, createdAt) {
    return this.#statements.addWhitelist.run(
      guildId,
      targetId,
      targetType,
      actions,
      addedBy,
      createdAt
    );
  }

  removeWhitelist(guildId, targetId, targetType) {
    return this.#statements.removeWhitelist.run(guildId, targetId, targetType);
  }

  getExtraOwners(guildId) {
    return this.#statements.getExtraOwners.all(guildId);
  }

  addExtraOwner(guildId, userId, addedBy, createdAt) {
    return this.#statements.addExtraOwner.run(guildId, userId, addedBy, createdAt);
  }

  removeExtraOwner(guildId, userId) {
    return this.#statements.removeExtraOwner.run(guildId, userId);
  }

  getProtectedRoles(guildId) {
    return this.#statements.getProtectedRoles.all(guildId);
  }

  setProtectedRoles(guildId, roleId, addedBy, createdAt) {
    return this.#statements.setProtectedRoles.run(
      guildId,
      roleId,
      addedBy,
      createdAt
    );
  }

  getProtectedChannels(guildId) {
    return this.#statements.getProtectedChannels.all(guildId);
  }

  setProtectedChannels(guildId, channelId, addedBy, createdAt) {
    return this.#statements.setProtectedChannels.run(
      guildId,
      channelId,
      addedBy,
      createdAt
    );
  }

  getProtectedWebhooks(guildId) {
    return this.#statements.getProtectedWebhooks.all(guildId);
  }

  setProtectedWebhooks(
    guildId,
    webhookId,
    webhookUrl,
    addedBy,
    createdAt
  ) {
    return this.#statements.setProtectedWebhooks.run(
      guildId,
      webhookId,
      webhookUrl,
      addedBy,
      createdAt
    );
  }

  getTrustedBots(guildId) {
    return this.#statements.getTrustedBots.all(guildId);
  }

  addTrustedBot(guildId, botId, addedBy, createdAt) {
    return this.#statements.addTrustedBot.run(
      guildId,
      botId,
      addedBy,
      createdAt
    );
  }

  removeTrustedBot(guildId, botId) {
    return this.#statements.removeTrustedBot.run(guildId, botId);
  }

  addIncident(
    guildId,
    module,
    action,
    executorId,
    targetId,
    severity,
    risk,
    evidence,
    actionTaken,
    createdAt
  ) {
    return this.#statements.addIncident.run(
      guildId,
      module,
      action,
      executorId,
      targetId,
      severity,
      risk,
      JSON.stringify(evidence),
      actionTaken,
      createdAt
    );
  }

  getIncidents(guildId, limit = 50) {
    return this.#statements.getIncidents.all(guildId, limit);
  }

  addPunishmentHistory(
    guildId,
    executorId,
    action,
    reason,
    moderator,
    createdAt
  ) {
    return this.#statements.addPunishmentHistory.run(
      guildId,
      executorId,
      action,
      reason,
      moderator,
      createdAt
    );
  }

  getPunishmentHistory(guildId, limit = 50) {
    return this.#statements.getPunishmentHistory.all(guildId, limit);
  }

  addSecuritySnapshot(
    guildId,
    resourceType,
    resourceId,
    snapshot,
    createdAt
  ) {
    return this.#statements.addSecuritySnapshot.run(
      guildId,
      resourceType,
      resourceId,
      JSON.stringify(snapshot),
      createdAt
    );
  }

  getSecuritySnapshots(guildId, resourceType, resourceId, limit = 10) {
    return this.#statements.getSecuritySnapshots.all(
      guildId,
      resourceType,
      resourceId,
      limit
    );
  }

  addInviteHistory(
    guildId,
    code,
    inviterId,
    channelId,
    uses,
    maxUses,
    maxAge,
    createdAt
  ) {
    return this.#statements.addInviteHistory.run(
      guildId,
      code,
      inviterId,
      channelId,
      uses,
      maxUses,
      maxAge,
      createdAt
    );
  }

  getInviteHistory(guildId, limit = 50) {
    return this.#statements.getInviteHistory.all(guildId, limit);
  }

  getGuildConfig(guildId) {
    const row = this.#statements.getSecurityConfig.get(guildId);
    if (!row) return null;
    try {
      return JSON.parse(row.config);
    } catch {
      return null;
    }
  }

  async initGuildConfig(guildId) {
    const { createDefaultConfig } = await import("../config/defaults.js");
    const config = createDefaultConfig(guildId);
    this.upsertSecurityConfig(guildId, config, new Date().toISOString());
    return config;
  }

  setModule(guildId, module, enabled) {
    const config = this.getGuildConfig(guildId) || {};
    if (!config.modules) config.modules = {};
    config.modules[module] = enabled;
    this.upsertSecurityConfig(guildId, config, new Date().toISOString());
  }

  setThreshold(guildId, type, threshold) {
    const config = this.getGuildConfig(guildId) || {};
    if (!config.thresholds) config.thresholds = {};
    config.thresholds[type] = threshold;
    this.upsertSecurityConfig(guildId, config, new Date().toISOString());
  }

  setPunishment(guildId, severity, action) {
    const config = this.getGuildConfig(guildId) || {};
    if (!config.punishments) config.punishments = {};
    config.punishments[severity] = action;
    this.upsertSecurityConfig(guildId, config, new Date().toISOString());
  }

  setLockdown(guildId, enabled) {
    const config = this.getGuildConfig(guildId) || {};
    config.lockdown = enabled;
    this.upsertSecurityConfig(guildId, config, new Date().toISOString());
  }

  addProtected(guildId, type, resourceId) {
    const now = new Date().toISOString();
    if (type === 'roles') {
      this.setProtectedRoles(guildId, resourceId, 'system', now);
    } else if (type === 'channels') {
      this.setProtectedChannels(guildId, resourceId, 'system', now);
    } else if (type === 'webhooks') {
      this.setProtectedWebhooks(guildId, resourceId, '', 'system', now);
    }
  }

  removeProtected(guildId, type, resourceId) {
    if (type === 'roles') {
      this.#db.prepare("DELETE FROM protected_roles WHERE guildId = ? AND roleId = ?").run(guildId, resourceId);
    } else if (type === 'channels') {
      this.#db.prepare("DELETE FROM protected_channels WHERE guildId = ? AND channelId = ?").run(guildId, resourceId);
    } else if (type === 'webhooks') {
      this.#db.prepare("DELETE FROM protected_webhooks WHERE guildId = ? AND webhookId = ?").run(guildId, resourceId);
    }
  }

  getProtected(guildId, type) {
    if (type === 'roles') {
      return this.getProtectedRoles(guildId).map(r => r.roleId);
    } else if (type === 'channels') {
      return this.getProtectedChannels(guildId).map(c => c.channelId);
    } else if (type === 'webhooks') {
      return this.getProtectedWebhooks(guildId).map(w => w.webhookId);
    }
    return [];
  }

  getOwners(guildId) {
    return this.getExtraOwners(guildId).map(o => o.userId);
  }

  getLogs(guildId, limit = 50) {
    return this.getIncidents(guildId, limit);
  }
}

export default LunaDatabase;
