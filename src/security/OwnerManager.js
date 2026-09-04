export class OwnerManager {
  constructor(cache, database) {
    this.cache = cache;
    this.database = database;
  }

  isOwner(guildId, userId) {
    const guild = this.cache.get(`${guildId}:guild`);
    if (guild && guild.ownerId === userId) return true;

    const raw = this.cache.get(`${guildId}:owners`);
    const owners = Array.isArray(raw) ? raw : [];
    return owners.some(o => o.userId === userId);
  }

  isExtraOwner(guildId, userId) {
    const raw = this.cache.get(`${guildId}:owners`);
    const owners = Array.isArray(raw) ? raw : [];
    return owners.some(o => o.userId === userId);
  }

  async add(guildId, userId, addedBy) {
    try {
      const cacheKey = `${guildId}:owners`;
      let owners = this.cache.get(cacheKey) || [];

      if (owners.some(o => o.userId === userId)) {
        return { success: false, error: 'User is already an extra owner' };
      }

      const entry = {
        guildId,
        userId,
        addedBy,
        addedAt: Date.now()
      };

      owners.push(entry);
      this.cache.set(cacheKey, owners);

      try {
        await this.database?.upsert?.('extra_owners', {
          guildId,
          userId,
          addedBy,
          addedAt: entry.addedAt
        });
      } catch (err) {
        console.error(`[Security] Owner DB write error:`, err.message);
      }

      console.log(`[Security] Extra owner added: ${userId} in guild ${guildId}`);
      return { success: true, error: null };
    } catch (err) {
      console.error(`[Security] Owner add error:`, err.message);
      return { success: false, error: err.message };
    }
  }

  async remove(guildId, userId) {
    try {
      const cacheKey = `${guildId}:owners`;
      let owners = this.cache.get(cacheKey) || [];

      owners = owners.filter(o => o.userId !== userId);
      this.cache.set(cacheKey, owners);

      try {
        await this.database?.delete?.('extra_owners', { guildId, userId });
      } catch (err) {
        console.error(`[Security] Owner DB delete error:`, err.message);
      }

      console.log(`[Security] Extra owner removed: ${userId} from guild ${guildId}`);
      return { success: true, error: null };
    } catch (err) {
      console.error(`[Security] Owner remove error:`, err.message);
      return { success: false, error: err.message };
    }
  }

  getList(guildId) {
    return this.cache.get(`${guildId}:owners`) || [];
  }

  async loadGuild(guildId) {
    try {
      const rows = await this.database?.all?.('extra_owners', { guildId }) || [];

      const owners = rows.map(row => ({
        guildId: row.guildId,
        userId: row.userId,
        addedBy: row.addedBy,
        addedAt: row.addedAt
      }));

      this.cache.set(`${guildId}:owners`, owners);
      console.log(`[Security] Loaded ${owners.length} extra owners for guild ${guildId}`);
    } catch (err) {
      console.error(`[Security] Owner load error for guild ${guildId}:`, err.message);
    }
  }
}
