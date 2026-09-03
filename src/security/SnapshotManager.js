export class SnapshotManager {
  constructor(client, cache, database) {
    this.client = client;
    this.cache = cache;
    this.database = database;
  }

  async buildSnapshot(guild) {
    const guildId = guild.id;
    const state = this.cache.get(guildId);

    for (const [channelId, channel] of guild.channels.cache) {
      try {
        const snapshot = {
          type: 'channel',
          id: channelId,
          name: channel.name,
          channelType: channel.type,
          position: channel.position,
          parentId: channel.parentId,
          topic: channel.topic,
          nsfw: channel.nsfw,
          slowmode: channel.rateLimitPerUser,
          overwrites: channel.permissionOverwrites?.cache.map(o => ({
            id: o.id,
            type: o.type,
            allow: o.allow.toString(),
            deny: o.deny.toString()
          })) || []
        };
        state.channelSnapshots.set(channelId, snapshot);
      } catch {}
    }

    for (const [roleId, role] of guild.roles.cache) {
      try {
        const snapshot = {
          type: 'role',
          id: roleId,
          name: role.name,
          color: role.color,
          hoist: role.hoist,
          mentionable: role.mentionable,
          permissions: role.permissions.toString(),
          position: role.position,
          icon: role.icon,
          unicodeEmoji: role.unicodeEmoji
        };
        state.roleSnapshots.set(roleId, snapshot);
      } catch {}
    }
  }

  async takeChannelSnapshot(guildId, channelId) {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) throw new Error('Guild not found');

      const channel = guild.channels.cache.get(channelId);
      if (!channel) throw new Error('Channel not found');

      const snapshot = {
        type: 'channel',
        id: channelId,
        name: channel.name,
        channelType: channel.type,
        position: channel.position,
        parent: channel.parentId,
        permissionOverwrites: channel.permissionOverwrites.cache.map(o => ({
          id: o.id,
          type: o.type,
          allow: o.allow.toString(),
          deny: o.deny.toString()
        })),
        topic: channel.topic || null,
        nsfw: channel.nsfw || false,
        slowmode: channel.rateLimitPerUser || 0,
        createdAt: Date.now()
      };

      await this.#storeSnapshot(guildId, `channel:${channelId}`, snapshot);
      console.log(`[Security] Channel snapshot taken: ${channel.name}`);
      return { success: true, snapshot, error: null };
    } catch (err) {
      console.error(`[Security] Channel snapshot error:`, err.message);
      return { success: false, snapshot: null, error: err.message };
    }
  }

  async takeRoleSnapshot(guildId, roleId) {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) throw new Error('Guild not found');

      const role = guild.roles.cache.get(roleId);
      if (!role) throw new Error('Role not found');

      const snapshot = {
        type: 'role',
        id: roleId,
        name: role.name,
        color: role.color,
        hoist: role.hoist,
        mentionable: role.mentionable,
        permissions: role.permissions.toString(),
        position: role.position,
        icon: role.icon || null,
        unicodeEmoji: role.unicodeEmoji || null,
        createdAt: Date.now()
      };

      await this.#storeSnapshot(guildId, `role:${roleId}`, snapshot);
      console.log(`[Security] Role snapshot taken: ${role.name}`);
      return { success: true, snapshot, error: null };
    } catch (err) {
      console.error(`[Security] Role snapshot error:`, err.message);
      return { success: false, snapshot: null, error: err.message };
    }
  }

  async takeWebhookSnapshot(guildId, webhookId) {
    try {
      const webhook = await this.client.fetchWebhook(webhookId).catch(() => null);
      if (!webhook) throw new Error('Webhook not found');

      const snapshot = {
        type: 'webhook',
        id: webhookId,
        name: webhook.name,
        avatar: webhook.avatarURL(),
        channelId: webhook.channelId,
        createdAt: Date.now()
      };

      await this.#storeSnapshot(guildId, `webhook:${webhookId}`, snapshot);
      console.log(`[Security] Webhook snapshot taken: ${webhook.name}`);
      return { success: true, snapshot, error: null };
    } catch (err) {
      console.error(`[Security] Webhook snapshot error:`, err.message);
      return { success: false, snapshot: null, error: err.message };
    }
  }

  async takeEmojiSnapshot(guildId, emojiId) {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) throw new Error('Guild not found');

      const emoji = guild.emojis.cache.get(emojiId);
      if (!emoji) throw new Error('Emoji not found');

      const snapshot = {
        type: 'emoji',
        id: emojiId,
        name: emoji.name,
        requireColons: emoji.requireColons,
        managed: emoji.managed,
        available: emoji.available,
        createdAt: Date.now()
      };

      await this.#storeSnapshot(guildId, `emoji:${emojiId}`, snapshot);
      console.log(`[Security] Emoji snapshot taken: ${emoji.name}`);
      return { success: true, snapshot, error: null };
    } catch (err) {
      console.error(`[Security] Emoji snapshot error:`, err.message);
      return { success: false, snapshot: null, error: err.message };
    }
  }

  async takeStickerSnapshot(guildId, stickerId) {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) throw new Error('Guild not found');

      const sticker = await guild.stickers.fetch(stickerId).catch(() => null);
      if (!sticker) throw new Error('Sticker not found');

      const snapshot = {
        type: 'sticker',
        id: stickerId,
        name: sticker.name,
        description: sticker.description || null,
        tags: sticker.tags || null,
        formatType: sticker.formatType,
        createdAt: Date.now()
      };

      await this.#storeSnapshot(guildId, `sticker:${stickerId}`, snapshot);
      console.log(`[Security] Sticker snapshot taken: ${sticker.name}`);
      return { success: true, snapshot, error: null };
    } catch (err) {
      console.error(`[Security] Sticker snapshot error:`, err.message);
      return { success: false, snapshot: null, error: err.message };
    }
  }

  async restoreChannel(guildId, snapshot) {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) throw new Error('Guild not found');

      const channel = guild.channels.cache.get(snapshot.id);
      if (!channel) throw new Error('Channel not found');

      await channel.edit({
        name: snapshot.name,
        position: snapshot.position,
        parent: snapshot.parent,
        topic: snapshot.topic,
        nsfw: snapshot.nsfw,
        rateLimitPerUser: snapshot.slowmode
      }).catch(() => {});

      if (snapshot.permissionOverwrites) {
        const overwrites = snapshot.permissionOverwrites.map(o => ({
          id: o.id,
          type: o.type,
          allow: BigInt(o.allow),
          deny: BigInt(o.deny)
        }));
        await channel.permissionOverwrites.set(overwrites).catch(() => {});
      }

      console.log(`[Security] Channel restored: ${snapshot.name}`);
      return { success: true, error: null };
    } catch (err) {
      console.error(`[Security] Channel restore error:`, err.message);
      return { success: false, error: err.message };
    }
  }

  async restoreRole(guildId, snapshot) {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) throw new Error('Guild not found');

      const role = guild.roles.cache.get(snapshot.id);
      if (!role) throw new Error('Role not found');

      await role.edit({
        name: snapshot.name,
        color: snapshot.color,
        hoist: snapshot.hoist,
        mentionable: snapshot.mentionable,
        permissions: BigInt(snapshot.permissions),
        icon: snapshot.icon,
        unicodeEmoji: snapshot.unicodeEmoji
      });

      if (snapshot.position != null) {
        await guild.roles.setPosition(snapshot.id, snapshot.position).catch(() => {});
      }

      console.log(`[Security] Role restored: ${snapshot.name}`);
      return { success: true, error: null };
    } catch (err) {
      console.error(`[Security] Role restore error:`, err.message);
      return { success: false, error: err.message };
    }
  }

  async restoreWebhook(guildId, snapshot) {
    try {
      const webhook = await this.client.fetchWebhook(snapshot.id).catch(() => null);
      if (!webhook) throw new Error('Webhook not found');

      await webhook.edit({
        name: snapshot.name,
        avatar: snapshot.avatar,
        channel: snapshot.channelId
      });

      console.log(`[Security] Webhook restored: ${snapshot.name}`);
      return { success: true, error: null };
    } catch (err) {
      console.error(`[Security] Webhook restore error:`, err.message);
      return { success: false, error: err.message };
    }
  }

  async restoreEmoji(guildId, snapshot) {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) throw new Error('Guild not found');

      const emoji = guild.emojis.cache.get(snapshot.id);
      if (!emoji) throw new Error('Emoji not found');

      await emoji.edit({ name: snapshot.name });

      console.log(`[Security] Emoji restored: ${snapshot.name}`);
      return { success: true, error: null };
    } catch (err) {
      console.error(`[Security] Emoji restore error:`, err.message);
      return { success: false, error: err.message };
    }
  }

  async restoreSticker(guildId, snapshot) {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) throw new Error('Guild not found');

      const sticker = await guild.stickers.fetch(snapshot.id).catch(() => null);
      if (!sticker) throw new Error('Sticker not found');

      await sticker.edit({
        name: snapshot.name,
        description: snapshot.description,
        tags: snapshot.tags
      });

      console.log(`[Security] Sticker restored: ${snapshot.name}`);
      return { success: true, error: null };
    } catch (err) {
      console.error(`[Security] Sticker restore error:`, err.message);
      return { success: false, error: err.message };
    }
  }

  async #storeSnapshot(guildId, key, snapshot) {
    const cacheKey = `${guildId}:snapshots:${key}`;
    this.cache.set(cacheKey, snapshot);

    try {
      await this.database?.upsert?.('snapshots', {
        guildId,
        snapshotKey: key,
        data: JSON.stringify(snapshot)
      });
    } catch (err) {
      console.error(`[Security] Snapshot DB store error:`, err.message);
    }
  }

  async getSnapshot(guildId, key) {
    const cacheKey = `${guildId}:snapshots:${key}`;
    let snapshot = this.cache.get(cacheKey);

    if (snapshot) return snapshot;

    try {
      const row = await this.database?.get?.('snapshots', { guildId, snapshotKey: key });
      if (row?.data) {
        snapshot = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        this.cache.set(cacheKey, snapshot);
        return snapshot;
      }
    } catch (err) {
      console.error(`[Security] Snapshot DB fetch error:`, err.message);
    }

    return null;
  }
}
