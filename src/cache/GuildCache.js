export default class GuildCache {
  constructor() {
    this.guilds = new Map();
  }

  get(guildId) {
    if (!this.guilds.has(guildId)) {
      this.guilds.set(guildId, {
        config: null,
        whitelist: new Set(),
        extraOwners: new Set(),
        protectedRoles: new Set(),
        protectedChannels: new Set(),
        protectedWebhooks: new Set(),
        trustedBots: new Set(),
        roleSnapshots: new Map(),
        channelSnapshots: new Map(),
        inviteCache: new Map(),
        rateLimits: new Map(),
        auditCache: new Map(),
        dedupeCache: new Map(),
        linkedRoles: new Set(),
        emojiSnapshots: new Map(),
        stickerSnapshots: new Map(),
        webhookSnapshots: new Map(),
        memberJoinTracker: new Map(),
        massMentionTracker: new Map(),
        raidTracker: new Map()
      });
    }
    return this.guilds.get(guildId);
  }

  setGuild(guildId, state) {
    this.guilds.set(guildId, state);
  }

  has(guildId) {
    return this.guilds.has(guildId);
  }

  delete(guildId) {
    return this.guilds.delete(guildId);
  }

  isWhitelisted(guildId, userId, action) {
    const state = this.get(guildId);
    if (state.whitelist.has(userId)) return true;
    if (state.config?.whitelistMode === 'role') {
      return state.whitelist.has(`role:${userId}`);
    }
    return false;
  }

  isExtraOwner(guildId, userId) {
    const state = this.get(guildId);
    return state.extraOwners.has(userId);
  }

  isTrustedBot(guildId, botId) {
    const state = this.get(guildId);
    return state.trustedBots.has(botId);
  }

  isProtectedRole(guildId, roleId) {
    const state = this.get(guildId);
    return state.protectedRoles.has(roleId);
  }

  isProtectedChannel(guildId, channelId) {
    const state = this.get(guildId);
    return state.protectedChannels.has(channelId);
  }

  isProtectedWebhook(guildId, webhookId) {
    const state = this.get(guildId);
    return state.protectedWebhooks.has(webhookId);
  }

  isLinkedRole(guildId, roleId) {
    const state = this.get(guildId);
    return state.linkedRoles.has(roleId);
  }

  checkRateLimit(guildId, key, maxCount, windowMs) {
    const state = this.get(guildId);
    const now = Date.now();
    const entry = state.rateLimits.get(key);

    if (!entry || now > entry.resetTime) {
      state.rateLimits.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }

    entry.count++;
    if (entry.count > maxCount) return false;
    return true;
  }

  isDuplicate(guildId, key, ttlMs) {
    const state = this.get(guildId);
    const now = Date.now();
    const lastSeen = state.dedupeCache.get(key);

    if (lastSeen && now - lastSeen < ttlMs) return true;

    state.dedupeCache.set(key, now);
    if (state.dedupeCache.size > 10000) {
      const oldest = now - ttlMs;
      for (const [k, v] of state.dedupeCache) {
        if (v < oldest) state.dedupeCache.delete(k);
      }
    }
    return false;
  }

  getAuditExecutor(guildId, key) {
    const state = this.get(guildId);
    return state.auditCache.get(key) || null;
  }

  setAuditExecutor(guildId, key, executorId) {
    const state = this.get(guildId);
    state.auditCache.set(key, executorId);
  }
}
