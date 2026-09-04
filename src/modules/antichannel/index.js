export async function handleChannelCreate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const guild = event.guild;
  if (!guild) return;
  const guildId = guild.id;

  const config = await database.getConfig(guildId);
  if (!config?.modules?.antichannel?.enabled) return;

  const executorId = await auditCorrelator.resolveExecutor(guild, 'CHANNEL_CREATE', event.channel.id);
  console.log(`[Security] Channel created: ${event.channel.name} (${event.channel.id}) in ${guild.name} by ${executorId || 'unknown'}`);

  if (executorId) {
    if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
    if (await ownerManager.isExtraOwner(guildId, executorId)) return;

    const risk = 80;
    const actions = config.modules.antichannel.actions || {};
    await snapshotManager.captureChannel(guildId, event.channel);

    if (actions.restore) {
      await event.channel.delete('Luna: Unauthorized channel creation').catch(e => console.log(`[Security] Failed to delete channel: ${e.message}`));
    }

    if (actions.punish) {
      await punishmentEngine.punish(guildId, executorId, actions.punish, `Unauthorized channel creation: ${event.channel.name}`);
    }

    await incidentEngine.create(guildId, 'antichannel', 'channel_create', executorId, event.channel.id, 'critical', risk, { channel: event.channel.toJSON() }, 'delete_and_punish');
  }
}

export async function handleChannelDelete(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const guild = event.guild;
  if (!guild) return;
  const guildId = guild.id;

  const config = await database.getConfig(guildId);
  if (!config?.modules?.antichannel?.enabled) return;

  const executorId = await auditCorrelator.resolveExecutor(guild, 'CHANNEL_DELETE', event.channel.id);
  console.log(`[Security] Channel deleted: ${event.channel.name} (${event.channel.id}) in ${guild.name} by ${executorId || 'unknown'}`);

  if (executorId) {
    if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
    if (await ownerManager.isExtraOwner(guildId, executorId)) return;

    const risk = 85;
    const actions = config.modules.antichannel.actions || {};

    if (actions.restore) {
      const snapshot = await snapshotManager.getChannelSnapshot(guildId, event.channel.id);
      if (snapshot) {
        const restored = await guild.channels.create(snapshot.name, {
          type: snapshot.channelType || snapshot.type,
          topic: snapshot.topic,
          nsfw: snapshot.nsfw,
          parent: snapshot.parentId ? await guild.channels.fetch(snapshot.parentId).catch(() => null) : null,
          permissionOverwrites: snapshot.overwrites || []
        }).catch(e => console.log(`[Security] Failed to restore channel: ${e.message}`));
        if (restored && snapshot.position) await restored.setPosition(snapshot.position).catch(() => null);
        console.log(`[Security] Restored channel: ${restored?.name || snapshot.name}`);
      }
    }

    if (actions.punish) {
      await punishmentEngine.punish(guildId, executorId, actions.punish, `Unauthorized channel deletion: ${event.channel.name}`);
    }

    await incidentEngine.create(guildId, 'antichannel', 'channel_delete', executorId, event.channel.id, 'critical', risk, { channel: event.channel.name }, 'restore_and_punish');
  }
}

export async function handleChannelUpdate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const guild = event.guild;
  if (!guild) return;
  const guildId = guild.id;

  const config = await database.getConfig(guildId);
  if (!config?.modules?.antichannel?.enabled) return;

  const dangerousPerms = ['Administrator', 'ManageChannels', 'ManageRoles', 'ManageGuild'];
  const changedOverwrites = [];

  for (const [id, overwrite] of event.channel.permissionOverwrites) {
    const oldOverwrite = event.old.channel?.permissionOverwrites?.get(id);
    if (!oldOverwrite) {
      changedOverwrites.push({ id, type: 'added', overwrite });
    } else {
      const oldAllow = oldOverwrite.allow?.serialize() || {};
      const newAllow = overwrite.allow?.serialize() || {};
      const added = dangerousPerms.filter(p => newAllow[p] && !oldAllow[p]);
      if (added.length > 0) changedOverwrites.push({ id, type: 'modified', addedPerms: added });
    }
  }

  if (changedOverwrites.length === 0) return;

  const executorId = await auditCorrelator.resolveExecutor(guild, 'CHANNEL_UPDATE', event.channel.id);
  console.log(`[Security] Dangerous permission overwrite change in ${event.channel.name} in ${guild.name} by ${executorId || 'unknown'}`);

  if (executorId) {
    if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
    if (await ownerManager.isExtraOwner(guildId, executorId)) return;

    const risk = 75;
    const actions = config.modules.antichannel.actions || {};

    if (actions.restore) {
      const snapshot = await snapshotManager.getChannelSnapshot(guildId, event.channel.id);
      if (snapshot?.overwrites) {
        await event.channel.edit({ permissionOverwrites: snapshot.overwrites }, 'Luna: Reverting dangerous permission change').catch(() => null);
        console.log(`[Security] Reverted permission overwrites on ${event.channel.name}`);
      }
    }

    if (actions.punish) {
      await punishmentEngine.punish(guildId, executorId, actions.punish, `Dangerous permission overwrite change on ${event.channel.name}`);
    }

    await incidentEngine.create(guildId, 'antichannel', 'permission_overwrite', executorId, event.channel.id, 'critical', risk, { changedOverwrites }, 'revert_and_punish');
  }
}
