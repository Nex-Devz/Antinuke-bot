import {
  AutoModerationRuleEventType,
  AutoModerationRuleTriggerType,
  AutoModerationActionType,
  AutoModerationRuleKeywordPresetType,
  PermissionFlagsBits
} from "discord.js";

export const RULE_TYPES = {
  keyword: {
    id: "keyword",
    label: "Keyword",
    desc: "Flags messages containing blocked words",
    triggerType: AutoModerationRuleTriggerType.Keyword
  },
  spam: {
    id: "spam",
    label: "Spam",
    desc: "Detects and blocks spam / message flooding",
    triggerType: AutoModerationRuleTriggerType.Spam
  },
  mention: {
    id: "mention",
    label: "Mention Spam",
    desc: "Blocks messages that mass-mention users",
    triggerType: AutoModerationRuleTriggerType.MentionSpam
  },
  preset: {
    id: "preset",
    label: "Profanity",
    desc: "Flags profanity, sexual content and slurs",
    triggerType: AutoModerationRuleTriggerType.KeywordPreset
  }
};

export const MODULE_STATES = {
  disabled: "Disabled",
  pending: "Pending",
  loading: "Loading",
  error: "Error",
  ready: "Ready"
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isoNow() {
  return new Date().toISOString();
}

export class AutoModManager {
  constructor(client, database, cache) {
    this.client = client;
    this.database = database;
    this.cache = cache;
    this.mutex = new Map();
  }

  getGuildDB(guildId) {
    let cfg = this.database.getAutoModConfig(guildId);
    if (!cfg) {
      this.database.upsertAutoModConfig(guildId, {
        enabled: true,
        logChannelId: null,
        notificationsEnabled: true,
        notificationDuration: 5000,
        dmEnabled: false,
        escalationEnabled: true
      });
      cfg = this.database.getAutoModConfig(guildId);
    }
    return {
      enabled: !!cfg.enabled,
      logChannelId: cfg.logChannelId || null,
      notificationsEnabled: !!cfg.notificationsEnabled,
      notificationDuration: cfg.notificationDuration || 5000,
      dmEnabled: !!cfg.dmEnabled,
      escalationEnabled: !!cfg.escalationEnabled
    };
  }

  saveGuildDB(guildId, cfg) {
    this.database.upsertAutoModConfig(guildId, cfg);
  }

  isEnabled(guildId) {
    return this.getGuildDB(guildId).enabled;
  }

  getRulesMap(guildId) {
    if (!this.cache.get(guildId).automod) {
      this.cache.get(guildId).automod = new Map();
    }
    return this.cache.get(guildId).automod;
  }

  loadRulesFromDB(guildId) {
    const map = this.getRulesMap(guildId);
    map.clear();
    const rows = this.database.getAutoModRules(guildId);
    for (const row of rows) {
      map.set(row.type, {
        id: row.id,
        type: row.type,
        name: row.name,
        discordRuleId: row.discordRuleId,
        enabled: !!row.enabled,
        state: row.state || "pending",
        actionConfig: row.actionConfig ? JSON.parse(row.actionConfig) : {},
        exemptRoles: row.exemptRoles ? JSON.parse(row.exemptRoles) : [],
        exemptChannels: row.exemptChannels ? JSON.parse(row.exemptChannels) : []
      });
    }
    return map;
  }

  getRules(guildId) {
    const map = this.getRulesMap(guildId);
    if (map.size === 0) this.loadRulesFromDB(guildId);
    return map;
  }

  getRuleMeta(guildId, type) {
    return this.database.getAutoModRuleByType(guildId, type);
  }

  hasRules(guildId) {
    return this.getRules(guildId).size > 0;
  }

  defaultActionConfig() {
    return {
      mode: "block",
      customMessage: "Your message was removed by Luna AutoMod.",
      timeoutSeconds: 600
    };
  }

  async ensureRules(guildId) {
    const map = this.getRules(guildId);
    let created = false;
    for (const def of Object.values(RULE_TYPES)) {
      if (!map.has(def.id)) {
        const rule = {
          type: def.id,
          name: `Luna · ${def.label}`,
          enabled: true,
          state: "pending",
          actionConfig: this.defaultActionConfig(),
          exemptRoles: [],
          exemptChannels: []
        };
        this.persistRule(guildId, rule);
        map.set(def.id, rule);
        created = true;
      }
    }
    return created;
  }

  persistRule(guildId, rule) {
    this.database.upsertAutoModRule(guildId, rule);
  }

  async provision(guildId) {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return;
    await this.ensureRules(guildId);
    const map = this.getRules(guildId);
    for (const [type, rule] of map) {
      if (rule.state === "ready") continue;
      await this.applyRule(guild, type, rule);
    }
  }

  async applyRule(guild, type, rule) {
    const map = this.getRules(guild.id);
    rule.state = "loading";
    rule.discordRuleId = rule.discordRuleId || null;
    rule.actionConfig = rule.actionConfig || this.defaultActionConfig();
    rule.actionConfig.alertChannel = this.getGuildDB(guild.id).logChannelId;
    map.set(type, rule);
    this.persistRule(guild.id, rule);

    try {
      if (rule.discordRuleId) {
        const existing = await guild.autoModerationRules.fetch(rule.discordRuleId).catch(() => null);
        if (existing) {
          await this.updateDiscordRule(guild, rule);
          rule.state = rule.enabled ? "ready" : "disabled";
          this.persistRule(guild.id, rule);
          return rule;
        }
      }

      const created = await guild.autoModerationRules.create(this.buildRulePayload(rule));
      rule.discordRuleId = created.id;
      rule.state = rule.enabled ? "ready" : "disabled";
      this.persistRule(guild.id, rule);
      return rule;
    } catch (err) {
      console.error(`[AutoMod] Failed to provision rule ${type} in ${guild.id}:`, err.message);
      rule.state = "error";
      this.persistRule(guild.id, rule);
      return rule;
    }
  }

  buildRulePayload(rule) {
    const payload = {
      name: rule.name,
      eventType: AutoModerationRuleEventType.MessageSend,
      triggerType: RULE_TYPES[rule.type].triggerType,
      enabled: rule.enabled,
      exemptRoles: rule.exemptRoles || [],
      exemptChannels: rule.exemptChannels || []
    };

    const cfg = rule.actionConfig || this.defaultActionConfig();
    payload.actions = this.buildActions(cfg, cfg.alertChannel);

    switch (rule.type) {
      case "keyword":
        payload.triggerMetadata = {
          keywordFilter: cfg.keywords || ["nigger"],
          allowList: cfg.allowlist || [],
          regexPatterns: cfg.regex ? cfg.regex.split("\n").filter(Boolean) : undefined
        };
        break;
      case "spam":
        payload.triggerMetadata = {
          mentionRaidProtectionEnabled: !!cfg.raidProtection
        };
        break;
      case "mention":
        payload.triggerMetadata = {
          mentionTotalLimit: cfg.mentionLimit || 5,
          mentionRaidProtectionEnabled: !!cfg.raidProtection
        };
        break;
      case "preset":
        payload.triggerMetadata = {
          presets: cfg.presets || [
            AutoModerationRuleKeywordPresetType.Profanity,
            AutoModerationRuleKeywordPresetType.SexualContent,
            AutoModerationRuleKeywordPresetType.Slurs
          ],
          allowList: cfg.allowlist || []
        };
        break;
    }

    return payload;
  }

  buildActions(cfg, alertChannel) {
    const actions = [];
    if (alertChannel) {
      actions.push({
        type: AutoModerationActionType.SendAlertMessage,
        metadata: {
          channel: alertChannel
        }
      });
    }

    if (cfg.mode === "timeout") {
      actions.push({
        type: AutoModerationActionType.Timeout,
        metadata: {
          durationSeconds: cfg.timeoutSeconds || 600
        }
      });
    } else if (cfg.mode === "block") {
      actions.push({
        type: AutoModerationActionType.BlockMessage,
        metadata: {
          customMessage: cfg.customMessage || "Your message was removed by Luna AutoMod."
        }
      });
    }

    return actions;
  }

  async updateDiscordRule(guild, rule) {
    const existing = await guild.autoModerationRules.fetch(rule.discordRuleId);
    await guild.autoModerationRules.edit(existing, {
      name: rule.name,
      triggerMetadata: this.buildRulePayload(rule).triggerMetadata,
      actions: this.buildActions(rule.actionConfig, this.getGuildDB(guild.id).logChannelId),
      enabled: rule.enabled,
      exemptRoles: rule.exemptRoles || [],
      exemptChannels: rule.exemptChannels || []
    });
  }

  async toggleRule(guildId, type, enabled) {
    const map = this.getRules(guildId);
    const rule = map.get(type);
    if (!rule) throw new Error("Rule not found");
    rule.enabled = enabled;
    if (!rule.discordRuleId) {
      rule.state = "pending";
      this.persistRule(guildId, rule);
      return { state: rule.state, discordRuleId: null };
    }
    const guild = this.client.guilds.cache.get(guildId);
    const updated = await this.applyRule(guild, type, rule);
    return { state: updated.state, discordRuleId: updated.discordRuleId };
  }

  async updateRuleConfig(guildId, type, cfg) {
    const map = this.getRules(guildId);
    const rule = map.get(type);
    if (!rule) throw new Error("Rule not found");
    rule.actionConfig = { ...rule.actionConfig, ...cfg };
    this.persistRule(guildId, rule);
    if (rule.discordRuleId) {
      const guild = this.client.guilds.cache.get(guildId);
      return this.applyRule(guild, type, rule);
    }
    return rule;
  }

  async deleteRule(guildId, type) {
    const map = this.getRules(guildId);
    const rule = map.get(type);
    if (!rule) return;
    if (rule.discordRuleId) {
      const guild = this.client.guilds.cache.get(guildId);
      await guild.autoModerationRules.delete(rule.discordRuleId).catch(() => {});
    }
    this.database.deleteAutoModRule(guildId, type);
    map.delete(type);
  }

  async setExemptRoles(guildId, type, roles) {
    const map = this.getRules(guildId);
    const rule = map.get(type);
    if (!rule) throw new Error("Rule not found");
    rule.exemptRoles = roles;
    this.persistRule(guildId, rule);
    if (rule.discordRuleId) {
      const guild = this.client.guilds.cache.get(guildId);
      return this.applyRule(guild, type, rule);
    }
    return rule;
  }

  async setExemptChannels(guildId, type, channels) {
    const map = this.getRules(guildId);
    const rule = map.get(type);
    if (!rule) throw new Error("Rule not found");
    rule.exemptChannels = channels;
    this.persistRule(guildId, rule);
    if (rule.discordRuleId) {
      const guild = this.client.guilds.cache.get(guildId);
      return this.applyRule(guild, type, rule);
    }
    return rule;
  }

  log(
    content,
    { channelId = null, guildId = null, ephemeral = false } = {}
  ) {
    if (channelId) {
      const channel = this.client.channels.cache.get(channelId);
      if (channel?.isTextBased()) {
        channel.send({ content, ephemeral }).catch(err => {
          console.error("[AutoMod] Log send error:", err.message);
        });
      }
    } else if (guildId) {
      const cfg = this.getGuildDB(guildId);
      const target = cfg.logChannelId;
      if (target) this.log(content, { channelId: target, guildId });
    }
  }

  notifyMods(guild, content) {
    const guildId = guild.id;
    const cfg = this.getGuildDB(guildId);
    if (!cfg.notificationsEnabled) return;
    const channel = cfg.logChannelId
      ? this.client.channels.cache.get(cfg.logChannelId)
      : null;
    if (channel?.isTextBased()) {
      channel.send({ content }).catch(() => {});
    }
  }

  async sendDM(user, content) {
    try {
      await user.send({ content }).catch(() => {});
    } catch {
      /* ignore dm failures */
    }
  }

  async handleExecution(execution, context) {
    try {
      const guildId = execution.guildId;
      if (!this.isEnabled(guildId)) return;

      const user = execution.user;
      const rule = execution.autoModerationRule;
      const matchedType = this.matchRuleTypeByTrigger(rule?.triggerType);
      const ruleType = matchedType || "keyword";
      const action = execution.action.type === AutoModerationActionType.BlockMessage
        ? "block"
        : execution.action.type === AutoModerationActionType.Timeout
          ? "timeout"
          : execution.action.type === AutoModerationActionType.SendAlertMessage
            ? "alert"
            : "block";

      this.database.addAutoModViolation(
        guildId,
        user.id,
        rule?.id || ruleType,
        rule?.name || RULE_TYPES[ruleType]?.label || ruleType,
        execution.channelId,
        action,
        isoNow()
      );

      this.recordStat(guildId, action);

      const guild = this.client.guilds.cache.get(guildId);

      if (guild) {
        const escalationLevel = await this.handleEscalation(guild, user, action);
        if (escalationLevel === "timeout" && action !== "timeout") {
          this.log(
            `**AutoMod Escalation** — <@${user.id}> was timed out for repeated violations.`,
            { channelId: this.getGuildDB(guildId).logChannelId }
          );
        }
        this.notifyMods(
          guild,
          `**AutoMod** — <@${user.id}> flagged (${ruleType}: ${action}).`
        );
      }

      const cfg = this.getGuildDB(guildId);
      if (cfg.dmEnabled) {
        this.sendDM(
          user,
          `Your message in **${guild?.name || "the server"}** was flagged by AutoMod (${ruleType}).`
        );
      }
    } catch (err) {
      console.error("[AutoMod] Execution handler error:", err.message);
    }
  }

  matchRuleTypeByTrigger(triggerType) {
    if (triggerType === undefined || triggerType === null) return null;
    for (const def of Object.values(RULE_TYPES)) {
      if (def.triggerType === triggerType) return def.id;
    }
    return null;
  }

  recordStat(guildId, action) {
    const date = todayIso();
    const current = this.database.getAutoModStat(guildId, date) || {};
    const counts = {
      blocked: current.blocked || 0,
      warnings: current.warnings || 0,
      timeouts: current.timeouts || 0,
      alerts: current.alerts || 0
    };
    if (action === "block") counts.blocked += 1;
    else if (action === "timeout") counts.timeouts += 1;
    else if (action === "warn") counts.warnings += 1;
    else counts.alerts += 1;
    this.database.upsertAutoModStat(guildId, date, counts);
  }

  async handleEscalation(guild, user, action) {
    const cfg = this.getGuildDB(guild.id);
    if (!cfg.escalationEnabled) return null;

    const windowStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const count = this.database.countAutoModViolations(guild.id, user.id, windowStart);

    if (count >= 5) {
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (member && member.moderatable && !member.permissions.has(PermissionFlagsBits.Administrator)) {
        await member.timeout(60 * 60 * 1000, "AutoMod: repeated violations").catch(() => {});
        return "timeout";
      }
    }
    return null;
  }

  getStats(guildId, days = 7) {
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    return this.database.sumAutoModStatRange(guildId, since);
  }

  getViolations(guildId, limit = 20) {
    return this.database.getAutoModViolations(guildId, limit);
  }

  async handleRuleCreated(rule, context) {
    const guildId = rule.guildId;
    this.markExternalRule(guildId, rule);
  }

  async handleRuleUpdated(oldRule, newRule, context) {
    if (!newRule) return;
    const guildId = newRule.guildId;
    const meta = this.findMetaByDiscordId(guildId, newRule.id);
    if (!meta) return;
    this.database.setAutoModRuleState(guildId, meta.type, "ready");
    const map = this.getRules(guildId);
    if (map.has(meta.type)) {
      map.get(meta.type).state = "ready";
    }
  }

  async handleRuleDeleted(rule, context) {
    const guildId = rule.guildId;
    const meta = this.findMetaByDiscordId(guildId, rule.id);
    if (!meta) return;
    const map = this.getRules(guildId);
    if (map.has(meta.type)) {
      map.get(meta.type).discordRuleId = null;
      map.get(meta.type).state = "pending";
      this.database.setAutoModRuleState(guildId, meta.type, "pending");
      this.database.upsertAutoModRule(guildId, map.get(meta.type));
    }
  }

  findMetaByDiscordId(guildId, discordRuleId) {
    const rows = this.database.getAutoModRules(guildId);
    return rows.find(r => r.discordRuleId === discordRuleId);
  }

  markExternalRule(guildId, rule) {
    const map = this.getRules(guildId);
    const meta = this.findMetaByDiscordId(guildId, rule.id);
    if (meta) {
      if (map.has(meta.type)) map.get(meta.type).state = "ready";
      return;
    }
    for (const def of Object.values(RULE_TYPES)) {
      if (def.triggerType === rule.triggerType && !map.has(def.id)) {
        const r = {
          type: def.id,
          name: rule.name,
          enabled: !!rule.enabled,
          state: "ready",
          discordRuleId: rule.id,
          actionConfig: this.defaultActionConfig(),
          exemptRoles: [],
          exemptChannels: []
        };
        this.persistRule(guildId, r);
        map.set(def.id, r);
        return;
      }
    }
  }

  hasPermission(member) {
    if (!member) return false;
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    return false;
  }
}
