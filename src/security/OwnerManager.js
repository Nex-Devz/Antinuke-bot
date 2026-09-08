export class OwnerManager {
  constructor(cache, database) {
    this.cache = cache;
    this.database = database;
  }

  isOwner(guildId, userId) {
    if (!userId) return false;
    const userStr = String(userId);

    const guild = this.cache?.get?.(`${guildId}:guild`);
    if (guild && String(guild.ownerId) === userStr) return true;

    return this.isExtraOwner(guildId, userStr);
  }

  isExtraOwner(guildId, userId) {
    if (!userId) return false;
    const userStr = String(userId);

    // 1. Guild Cache Check
    if (this.cache) {
      const state = typeof this.cache.get === 'function' ? this.cache.get(guildId) : null;
      if (state?.extraOwners instanceof Set && state.extraOwners.has(userStr)) {
        return true;
      }

      const raw = this.cache.get?.(`${guildId}:owners`);
      if (Array.isArray(raw) && raw.some(o => String(o.userId) === userStr)) {
        return true;
      }
    }

    // 2. Database Fallback
    if (this.database?.getExtraOwners) {
      try {
        const rows = this.database.getExtraOwners(guildId);
        if (Array.isArray(rows) && rows.some(o => String(o.userId) === userStr)) {
          return true;
        }
      } catch (err) {
        console.error(`[Security] Owner DB check error:`, err.message);
      }
    }

    return false;
  }

  async add(guildId, userId, addedBy) {
    try {
      const userStr = String(userId);
      const now = Date.now();

      if (this.isExtraOwner(guildId, userStr)) {
        return { success: false, error: 'User is already an extra owner' };
      }

      // Update Database
      if (this.database?.addExtraOwner) {
        try {
          this.database.addExtraOwner(guildId, userStr, addedBy || 'system', now);
        } catch (dbErr) {
          console.error(`[Security] Owner DB add error:`, dbErr.message);
        }
      }

      // Update GuildCache
      if (this.cache) {
        const state = typeof this.cache.get === 'function' ? this.cache.get(guildId) : null;
        if (state?.extraOwners instanceof Set) {
          state.extraOwners.add(userStr);
        }

        const cacheKey = `${guildId}:owners`;
        let owners = this.cache.get?.(cacheKey);
        if (!Array.isArray(owners)) owners = [];

        owners.push({
          guildId,
          userId: userStr,
          addedBy,
          addedAt: now
        });

        if (typeof this.cache.set === 'function') {
          this.cache.set(cacheKey, owners);
        }
      }

      console.log(`[Security] Extra owner added: ${userStr} in guild ${guildId}`);
      return { success: true, error: null };
    } catch (err) {
      console.error(`[Security] Owner add error:`, err.message);
      return { success: false, error: err.message };
    }
  }

  async remove(guildId, userId) {
    try {
      const userStr = String(userId);

      // Update Database
      if (this.database?.removeExtraOwner) {
        try {
          this.database.removeExtraOwner(guildId, userStr);
        } catch (dbErr) {
          console.error(`[Security] Owner DB remove error:`, dbErr.message);
        }
      }

      // Update GuildCache
      if (this.cache) {
        const state = typeof this.cache.get === 'function' ? this.cache.get(guildId) : null;
        if (state?.extraOwners instanceof Set) {
          state.extraOwners.delete(userStr);
        }

        const cacheKey = `${guildId}:owners`;
        let owners = this.cache.get?.(cacheKey);
        if (Array.isArray(owners)) {
          owners = owners.filter(o => String(o.userId) !== userStr);
          if (typeof this.cache.set === 'function') {
            this.cache.set(cacheKey, owners);
          }
        }
      }

      console.log(`[Security] Extra owner removed: ${userStr} from guild ${guildId}`);
      return { success: true, error: null };
    } catch (err) {
      console.error(`[Security] Owner remove error:`, err.message);
      return { success: false, error: err.message };
    }
  }

  getList(guildId) {
    const raw = this.cache?.get?.(`${guildId}:owners`);
    if (Array.isArray(raw) && raw.length > 0) return raw;

    if (this.database?.getExtraOwners) {
      try {
        const rows = this.database.getExtraOwners(guildId);
        if (Array.isArray(rows)) {
          return rows.map(row => ({
            guildId: row.guildId,
            userId: row.userId,
            addedBy: row.addedBy,
            addedAt: row.createdAt || row.addedAt
          }));
        }
      } catch (err) {
        console.error(`[Security] Owner getList DB error:`, err.message);
      }
    }

    return [];
  }

  async loadGuild(guildId) {
    try {
      const rows = (this.database?.getExtraOwners ? this.database.getExtraOwners(guildId) : []) || [];

      const owners = rows.map(row => ({
        guildId: row.guildId,
        userId: row.userId,
        addedBy: row.addedBy,
        addedAt: row.createdAt || row.addedAt
      }));

      if (typeof this.cache?.set === 'function') {
        this.cache.set(`${guildId}:owners`, owners);
      }

      const state = typeof this.cache?.get === 'function' ? this.cache.get(guildId) : null;
      if (state?.extraOwners instanceof Set) {
        for (const o of owners) {
          state.extraOwners.add(o.userId);
        }
      }

      console.log(`[Security] Loaded ${owners.length} extra owners for guild ${guildId}`);
    } catch (err) {
      console.error(`[Security] Owner load error for guild ${guildId}:`, err.message);
    }
  }
}

