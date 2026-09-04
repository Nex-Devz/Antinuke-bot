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

      getAutoModConfig: this.#db.prepare(
        "SELECT * FROM guild_automod WHERE guildId = ?"
      ),
      upsertAutoModConfig: this.#db.prepare(`
        INSERT INTO guild_automod (
          guildId, enabled, logChannelId, notificationsEnabled,
          notificationDuration, dmEnabled, escalationEnabled, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(guildId) DO UPDATE SET
          enabled = excluded.enabled,
          logChannelId = excluded.logChannelId,
          notificationsEnabled = excluded.notificationsEnabled,
          notificationDuration = excluded.notificationDuration,
          dmEnabled = excluded.dmEnabled,
          escalationEnabled = excluded.escalationEnabled,
          updatedAt = excluded.updatedAt
      `),

      getAutoModRules: this.#db.prepare(
        "SELECT * FROM automod_rules WHERE guildId = ? ORDER BY id ASC"
      ),
      getAutoModRuleByDiscordId: this.#db.prepare(
        "SELECT * FROM automod_rules WHERE guildId = ? AND discordRuleId = ?"
      ),
      getAutoModRuleByType: this.#db.prepare(
        "SELECT * FROM automod_rules WHERE guildId = ? AND type = ?"
      ),
      upsertAutoModRule: this.#db.prepare(`
        INSERT INTO automod_rules (
          guildId, discordRuleId, type, name, enabled, state,
          actionConfig, exemptRoles, exemptChannels, createdAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          discordRuleId = excluded.discordRuleId,
          name = excluded.name,
          enabled = excluded.enabled,
          state = excluded.state,
          actionConfig = excluded.actionConfig,
          exemptRoles = excluded.exemptRoles,
          exemptChannels = excluded.exemptChannels,
          updatedAt = excluded.updatedAt
      `),
      deleteAutoModRule: this.#db.prepare(
        "DELETE FROM automod_rules WHERE guildId = ? AND type = ?"
      ),
      setAutoModRuleState: this.#db.prepare(
        "UPDATE automod_rules SET state = ?, updatedAt = ? WHERE guildId = ? AND type = ?"
      ),

      addAutoModViolation: this.#db.prepare(
        "INSERT INTO automod_violations (guildId, userId, ruleId, ruleName, channelId, action, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ),
      getAutoModViolations: this.#db.prepare(
        "SELECT * FROM automod_violations WHERE guildId = ? ORDER BY createdAt DESC LIMIT ?"
      ),
      countAutoModViolations: this.#db.prepare(
        "SELECT COUNT(*) as count FROM automod_violations WHERE guildId = ? AND userId = ? AND createdAt >= ?"
      ),

      upsertAutoModStat: this.#db.prepare(`
        INSERT INTO automod_stats (guildId, date, blocked, warnings, timeouts, alerts)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(guildId, date) DO UPDATE SET
          blocked = excluded.blocked,
          warnings = excluded.warnings,
          timeouts = excluded.timeouts,
          alerts = excluded.alerts
      `),
      getAutoModStat: this.#db.prepare(
        "SELECT * FROM automod_stats WHERE guildId = ? AND date = ?"
      ),
      sumAutoModStatRange: this.#db.prepare(
        "SELECT COALESCE(SUM(blocked),0) as blocked, COALESCE(SUM(warnings),0) as warnings, COALESCE(SUM(timeouts),0) as timeouts, COALESCE(SUM(alerts),0) as alerts FROM automod_stats WHERE guildId = ? AND date >= ?"
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

  getAutoModConfig(guildId) {
    return this.#statements.getAutoModConfig.get(guildId);
  }

  upsertAutoModConfig(guildId, cfg) {
    const now = new Date().toISOString();
    return this.#statements.upsertAutoModConfig.run(
      guildId,
      cfg.enabled ? 1 : 0,
      cfg.logChannelId || null,
      cfg.notificationsEnabled ? 1 : 0,
      cfg.notificationDuration || 5000,
      cfg.dmEnabled ? 1 : 0,
      cfg.escalationEnabled ? 1 : 0,
      now
    );
  }

  getAutoModRules(guildId) {
    return this.#statements.getAutoModRules.all(guildId);
  }

  getAutoModRuleByDiscordId(guildId, discordRuleId) {
    return this.#statements.getAutoModRuleByDiscordId.get(guildId, discordRuleId);
  }

  getAutoModRuleByType(guildId, type) {
    return this.#statements.getAutoModRuleByType.get(guildId, type);
  }

  upsertAutoModRule(guildId, rule) {
    const now = new Date().toISOString();
    return this.#statements.upsertAutoModRule.run(
      guildId,
      rule.discordRuleId || null,
      rule.type,
      rule.name,
      rule.enabled ? 1 : 0,
      rule.state || 'PENDING',
      rule.actionConfig ? JSON.stringify(rule.actionConfig) : null,
      rule.exemptRoles ? JSON.stringify(rule.exemptRoles) : null,
      rule.exemptChannels ? JSON.stringify(rule.exemptChannels) : null,
      now,
      now
    );
  }

  setAutoModRuleState(guildId, type, state) {
    return this.#statements.setAutoModRuleState.run(
      state,
      new Date().toISOString(),
      guildId,
      type
    );
  }

  deleteAutoModRule(guildId, type) {
    return this.#statements.deleteAutoModRule.run(guildId, type);
  }

  addAutoModViolation(guildId, userId, ruleId, ruleName, channelId, action, createdAt) {
    return this.#statements.addAutoModViolation.run(
      guildId,
      userId,
      ruleId,
      ruleName,
      channelId,
      action,
      createdAt
    );
  }

  getAutoModViolations(guildId, limit = 50) {
    return this.#statements.getAutoModViolations.all(guildId, limit);
  }

  countAutoModViolations(guildId, userId, sinceIso) {
    const row = this.#statements.countAutoModViolations.get(guildId, userId, sinceIso);
    return row ? row.count : 0;
  }

  upsertAutoModStat(guildId, date, counts) {
    return this.#statements.upsertAutoModStat.run(
      guildId,
      date,
      counts.blocked || 0,
      counts.warnings || 0,
      counts.timeouts || 0,
      counts.alerts || 0
    );
  }

  getAutoModStat(guildId, date) {
    return this.#statements.getAutoModStat.get(guildId, date);
  }

  sumAutoModStatRange(guildId, sinceIso) {
    return this.#statements.sumAutoModStatRange.get(guildId, sinceIso);
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

  getConfig(guildId) {
    const flat = this.getGuildConfig(guildId);
    if (!flat) return null;
    const modules = {};
    for (const [key, value] of Object.entries(flat)) {
      if (typeof value === 'object' && value !== null && 'enabled' in value) {
        let name = key.toLowerCase();
        if (name === 'antirole') name = 'antir\u00f4le';
        modules[name] = value;
      }
    }
    return { guildId, modules };
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
