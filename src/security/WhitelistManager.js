export class WhitelistManager {
  constructor(cache, database) {
    this.cache = cache;
    this.database = database;
  }

  isWhitelisted(guildId, userId, action) {
    if (!userId) return false;
    const raw = this.cache.get(`${guildId}:whitelist`);
    const entries = Array.isArray(raw) ? raw : [];
    const userLower = String(userId).toLowerCase();

    for (const entry of entries) {
      if (entry.targetId.toLowerCase() !== userLower) continue;

      if (entry.targetType === 'user' || entry.targetType === 'role' || entry.targetType === 'bot') {
        if (entry.actions.includes('ALL')) return true;
        if (entry.actions.includes(action)) return true;
      }
    }

    return false;
  }

  async add(guildId, targetId, targetType, actions, addedBy) {
    try {
      if (!['user', 'role', 'bot'].includes(targetType)) {
        return { success: false, error: 'Invalid target type. Must be user, role, or bot' };
      }

      const actionList = typeof actions === 'string'
        ? actions.split(',').map(a => a.trim().toUpperCase())
        : actions.map(a => a.toUpperCase());

      const cacheKey = `${guildId}:whitelist`;
      let entries = this.cache.get(cacheKey) || [];

      const existingIndex = entries.findIndex(
        e => e.targetId === targetId && e.targetType === targetType
      );

      const entry = {
        guildId,
        targetId,
        targetType,
        actions: actionList,
        addedBy,
        addedAt: Date.now()
      };

      if (existingIndex >= 0) {
        entries[existingIndex] = entry;
      } else {
        entries.push(entry);
      }

      this.cache.set(cacheKey, entries);

      try {
        await this.database?.upsert?.('whitelists', {
          guildId,
          targetId,
          targetType,
          actions: actionList.join(','),
          addedBy,
          addedAt: entry.addedAt
        });
      } catch (err) {
        console.error(`[Security] Whitelist DB write error:`, err.message);
      }

      console.log(`[Security] Whitelist added: ${targetType} ${targetId} for ${actionList.join(',')}`);
      return { success: true, error: null };
    } catch (err) {
      console.error(`[Security] Whitelist add error:`, err.message);
      return { success: false, error: err.message };
    }
  }

  async remove(guildId, targetId, targetType) {
    try {
      const cacheKey = `${guildId}:whitelist`;
      let entries = this.cache.get(cacheKey) || [];

      entries = entries.filter(
        e => !(e.targetId === targetId && e.targetType === targetType)
      );

      this.cache.set(cacheKey, entries);

      try {
        await this.database?.delete?.('whitelists', { guildId, targetId, targetType });
      } catch (err) {
        console.error(`[Security] Whitelist DB delete error:`, err.message);
      }

      console.log(`[Security] Whitelist removed: ${targetType} ${targetId}`);
      return { success: true, error: null };
    } catch (err) {
      console.error(`[Security] Whitelist remove error:`, err.message);
      return { success: false, error: err.message };
    }
  }

  getList(guildId) {
    const raw = this.cache.get(`${guildId}:whitelist`);
    return Array.isArray(raw) ? raw : [];
  }

  async loadGuild(guildId) {
    try {
      const rows = await this.database?.all?.('whitelists', { guildId }) || [];

      const entries = rows.map(row => ({
        guildId: row.guildId,
        targetId: row.targetId,
        targetType: row.targetType,
        actions: typeof row.actions === 'string' ? row.actions.split(',') : row.actions,
        addedBy: row.addedBy,
        addedAt: row.addedAt
      }));

      this.cache.set(`${guildId}:whitelist`, entries);
      console.log(`[Security] Loaded ${entries.length} whitelist entries for guild ${guildId}`);
    } catch (err) {
      console.error(`[Security] Whitelist load error for guild ${guildId}:`, err.message);
    }
  }
}
