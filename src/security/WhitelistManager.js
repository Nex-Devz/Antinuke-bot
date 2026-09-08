export class WhitelistManager {
  constructor(cache, database, client) {
    this.cache = cache;
    this.database = database;
    this.client = client;
  }

  isWhitelisted(guildId, userId, action) {
    if (!userId) return false;
    const userStr = String(userId);

    // 0. Server owner is ALWAYS exempt and whitelisted
    const guild = this.client?.guilds?.cache?.get(guildId) || this.database?.getGuild?.(guildId);
    if (guild && String(guild.ownerId) === userStr) {
      return true;
    }

    // 1. Guild Cache Check
    if (this.cache) {
      const state = typeof this.cache.get === 'function' ? this.cache.get(guildId) : null;
      if (state?.whitelist instanceof Set && state.whitelist.has(userStr)) {
        return true;
      }

      // Keyed cache check
      const raw = this.cache.get?.(`${guildId}:whitelist`);
      if (Array.isArray(raw)) {
        const userLower = userStr.toLowerCase();
        for (const entry of raw) {
          if (entry.targetId?.toLowerCase() !== userLower) continue;
          if (!action || !entry.actions || entry.actions.includes('ALL') || entry.actions.includes(action.toUpperCase())) {
            return true;
          }
        }
      }
    }

    // 2. Database Fallback Check
    if (this.database?.getWhitelist) {
      try {
        const rows = this.database.getWhitelist(guildId);
        if (Array.isArray(rows)) {
          for (const row of rows) {
            if (row.targetId === userStr) {
              if (!action) return true;
              const actions = typeof row.actions === 'string' ? row.actions.split(',').map(a => a.trim().toUpperCase()) : (row.actions || []);
              if (actions.includes('ALL') || actions.includes(action.toUpperCase())) {
                return true;
              }
            }
          }
        }
      } catch (err) {
        console.error(`[Security] Whitelist DB check error:`, err.message);
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
        : (Array.isArray(actions) ? actions.map(a => a.toUpperCase()) : ['ALL']);

      const now = Date.now();

      // Update Database
      if (this.database?.addWhitelist) {
        try {
          this.database.addWhitelist(guildId, String(targetId), targetType, actionList.join(','), addedBy || 'system', now);
        } catch (dbErr) {
          console.error(`[Security] Whitelist DB add error:`, dbErr.message);
        }
      }

      // Update GuildCache
      if (this.cache) {
        const state = typeof this.cache.get === 'function' ? this.cache.get(guildId) : null;
        if (state?.whitelist instanceof Set) {
          state.whitelist.add(String(targetId));
        }

        const cacheKey = `${guildId}:whitelist`;
        let entries = this.cache.get?.(cacheKey);
        if (!Array.isArray(entries)) entries = [];

        const existingIndex = entries.findIndex(
          e => e.targetId === targetId && e.targetType === targetType
        );

        const entry = {
          guildId,
          targetId: String(targetId),
          targetType,
          actions: actionList,
          addedBy,
          addedAt: now
        };

        if (existingIndex >= 0) {
          entries[existingIndex] = entry;
        } else {
          entries.push(entry);
        }

        if (typeof this.cache.set === 'function') {
          this.cache.set(cacheKey, entries);
        }
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
      const targetStr = String(targetId);

      // Update Database
      if (this.database?.removeWhitelist) {
        try {
          this.database.removeWhitelist(guildId, targetStr, targetType || 'user');
        } catch (dbErr) {
          console.error(`[Security] Whitelist DB delete error:`, dbErr.message);
        }
      }

      // Update GuildCache
      if (this.cache) {
        const state = typeof this.cache.get === 'function' ? this.cache.get(guildId) : null;
        if (state?.whitelist instanceof Set) {
          state.whitelist.delete(targetStr);
        }

        const cacheKey = `${guildId}:whitelist`;
        let entries = this.cache.get?.(cacheKey);
        if (Array.isArray(entries)) {
          entries = entries.filter(
            e => !(e.targetId === targetStr && (!targetType || e.targetType === targetType))
          );
          if (typeof this.cache.set === 'function') {
            this.cache.set(cacheKey, entries);
          }
        }
      }

      console.log(`[Security] Whitelist removed: ${targetType || 'target'} ${targetStr}`);
      return { success: true, error: null };
    } catch (err) {
      console.error(`[Security] Whitelist remove error:`, err.message);
      return { success: false, error: err.message };
    }
  }

  getList(guildId) {
    const raw = this.cache?.get?.(`${guildId}:whitelist`);
    if (Array.isArray(raw) && raw.length > 0) return raw;

    if (this.database?.getWhitelist) {
      try {
        const rows = this.database.getWhitelist(guildId);
        if (Array.isArray(rows)) {
          return rows.map(row => ({
            guildId: row.guildId,
            targetId: row.targetId,
            targetType: row.targetType,
            actions: typeof row.actions === 'string' ? row.actions.split(',') : (row.actions || []),
            addedBy: row.addedBy,
            addedAt: row.createdAt || row.addedAt
          }));
        }
      } catch (err) {
        console.error(`[Security] Whitelist getList DB error:`, err.message);
      }
    }

    return [];
  }

  async loadGuild(guildId) {
    try {
      const rows = (this.database?.getWhitelist ? this.database.getWhitelist(guildId) : []) || [];

      const entries = rows.map(row => ({
        guildId: row.guildId,
        targetId: row.targetId,
        targetType: row.targetType,
        actions: typeof row.actions === 'string' ? row.actions.split(',') : row.actions,
        addedBy: row.addedBy,
        addedAt: row.createdAt || row.addedAt
      }));

      if (typeof this.cache?.set === 'function') {
        this.cache.set(`${guildId}:whitelist`, entries);
      }

      const state = typeof this.cache?.get === 'function' ? this.cache.get(guildId) : null;
      if (state?.whitelist instanceof Set) {
        for (const entry of entries) {
          state.whitelist.add(entry.targetId);
        }
      }

      console.log(`[Security] Loaded ${entries.length} whitelist entries for guild ${guildId}`);
    } catch (err) {
      console.error(`[Security] Whitelist load error for guild ${guildId}:`, err.message);
    }
  }
}

