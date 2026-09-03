export async function onReady(client, context) {
  console.log(`[Luna] Client ready as ${client.user.tag}`);

  client.user.setActivity('your server | /antinuke', { type: 3 });

  const { cache, database, snapshotManager } = context;

  for (const [guildId, guild] of client.guilds.cache) {
    const config = database.getGuildConfig(guildId);
    if (config) {
      const state = cache.get(guildId);
      state.config = config;
    }

    const whitelistRows = database.getWhitelist(guildId);
    const state = cache.get(guildId);
    for (const row of whitelistRows) {
      state.whitelist.add(row.targetId);
    }

    const extraOwnerRows = database.getExtraOwners(guildId);
    for (const row of extraOwnerRows) {
      state.extraOwners.add(row.userId);
    }

    const protectedRoleRows = database.getProtectedRoles(guildId);
    for (const row of protectedRoleRows) {
      state.protectedRoles.add(row.roleId);
    }

    const protectedChannelRows = database.getProtectedChannels(guildId);
    for (const row of protectedChannelRows) {
      state.protectedChannels.add(row.channelId);
    }

    const protectedWebhookRows = database.getProtectedWebhooks(guildId);
    for (const row of protectedWebhookRows) {
      state.protectedWebhooks.add(row.webhookId);
    }

    const trustedBotRows = database.getTrustedBots(guildId);
    for (const row of trustedBotRows) {
      state.trustedBots.add(row.botId);
    }

    if (snapshotManager) {
      try {
        await snapshotManager.buildSnapshot(guild);
      } catch (err) {
        console.error(`[Luna] Failed to build snapshot for guild ${guildId}:`, err.message);
      }
    }
  }

  console.log(`[Luna] Protection enabled for ${client.guilds.cache.size} guilds`);
}
