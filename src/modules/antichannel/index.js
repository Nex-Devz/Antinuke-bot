export async function handleChannelCreate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const config = await database.getConfig(event.guild.id);
  if (!config?.modules?.antichannel?.enabled) return;

  if (await whitelistManager.isWhitelisted(event.guild.id, event.executorId)) return;
  if (await ownerManager.isExtraOwner(event.guild.id, event.executorId)) return;

  await snapshotManager.captureChannel(event.guild.id, event.channel);

  const recentCreates = await cache.getChannelCreates(event.guild.id);
  const risk = calculateChannelCreateRisk(event, recentCreates);

  if (risk >= 70) {
    await event.channel.delete().catch(() => null);
    await punishmentEngine.punish(event.guild.id, event.executorId, 'channel_create_spam', risk);
    await incidentEngine.create(event.guild.id, 'antichannel', 'channel_create', event.executorId, event.channel.id, 'critical', risk, { recentCreates, channel: event.channel.toJSON() }, 'delete_and_punish');
  } else if (risk >= 30) {
    await incidentEngine.create(event.guild.id, 'antichannel', 'channel_create', event.executorId, event.channel.id, 'warning', risk, { recentCreates, channel: event.channel.toJSON() }, 'log_only');
  }
}

export async function handleChannelDelete(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const config = await database.getConfig(event.guild.id);
  if (!config?.modules?.antichannel?.enabled) return;

  if (await whitelistManager.isWhitelisted(event.guild.id, event.executorId)) return;
  if (await ownerManager.isExtraOwner(event.guild.id, event.executorId)) return;

  const recentDeletes = await cache.getChannelDeletes(event.guild.id);
  const risk = calculateChannelDeleteRisk(event, recentDeletes);

  if (risk >= 70) {
    const snapshot = await snapshotManager.getChannelSnapshot(event.guild.id, event.channel.id);
    if (snapshot) {
      const restored = await event.guild.channels.create(snapshot.name, {
        type: snapshot.type,
        topic: snapshot.topic,
        nsfw: snapshot.nsfw,
        parent: snapshot.parentId ? await event.guild.channels.fetch(snapshot.parentId).catch(() => null) : null,
        permissionOverwrites: snapshot.overwrites || []
      }).catch(() => null);
      if (restored && snapshot.position) await restored.setPosition(snapshot.position).catch(() => null);
    }
    await punishmentEngine.punish(event.guild.id, event.executorId, 'channel_delete_spam', risk);
    await incidentEngine.create(event.guild.id, 'antichannel', 'channel_delete', event.executorId, event.channel.id, 'critical', risk, { recentDeletes, channel: event.channel.toJSON() }, 'restore_and_punish');
  } else if (risk >= 30) {
    await incidentEngine.create(event.guild.id, 'antichannel', 'channel_delete', event.executorId, event.channel.id, 'warning', risk, { recentDeletes, channel: event.channel.toJSON() }, 'log_only');
  }
}

export async function handleChannelUpdate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const config = await database.getConfig(event.guild.id);
  if (!config?.modules?.antichannel?.enabled) return;

  if (await whitelistManager.isWhitelisted(event.guild.id, event.executorId)) return;
  if (await ownerManager.isExtraOwner(event.guild.id, event.executorId)) return;

  const dangerousPerms = ['Administrator', 'ManageChannels', 'ManageRoles', 'ManageGuild'];
  const changedOverwrites = [];

  for (const [id, overwrite] of event.channel.permissionOverwrites) {
    const oldOverwrite = event.old.channel?.permissionOverwrites.get(id);
    if (!oldOverwrite) {
      if (hasDangerousPerms(overwrite, dangerousPerms)) changedOverwrites.push({ id, type: 'added', overwrite });
    } else {
      const addedPerms = getAddedPermissions(oldOverwrite, overwrite, dangerousPerms);
      if (addedPerms.length > 0) changedOverwrites.push({ id, type: 'modified', addedPerms, overwrite });
    }
  }

  if (changedOverwrites.length > 0) {
    const risk = calculatePermissionChangeRisk(changedOverwrites);
    if (risk >= 70) {
      const snapshot = await snapshotManager.getChannelSnapshot(event.guild.id, event.channel.id);
      if (snapshot?.overwrites) {
        await event.channel.edit({ permissionOverwrites: snapshot.overwrites }).catch(() => null);
      }
      await punishmentEngine.punish(event.guild.id, event.executorId, 'dangerous_permission_overwrite', risk);
      await incidentEngine.create(event.guild.id, 'antichannel', 'permission_overwrite', event.executorId, event.channel.id, 'critical', risk, { changedOverwrites }, 'revert_and_punish');
    } else if (risk >= 30) {
      await incidentEngine.create(event.guild.id, 'antichannel', 'permission_overwrite', event.executorId, event.channel.id, 'warning', risk, { changedOverwrites }, 'log_only');
    }
  }
}

function calculateChannelCreateRisk(event, recentCreates) {
  let risk = 10;
  const now = Date.now();
  const recentCount = recentCreates.filter(t => now - t < 60000).length;
  if (recentCount > 5) risk += 30;
  if (recentCount > 10) risk += 30;
  if (event.channel.type === 0 && recentCount > 3) risk += 15;
  return Math.min(risk, 100);
}

function calculateChannelDeleteRisk(event, recentDeletes) {
  let risk = 15;
  const now = Date.now();
  const recentCount = recentDeletes.filter(t => now - t < 60000).length;
  if (recentCount > 3) risk += 35;
  if (recentCount > 6) risk += 35;
  return Math.min(risk, 100);
}

function calculatePermissionChangeRisk(changedOverwrites) {
  let risk = 20;
  for (const change of changedOverwrites) {
    if (change.addedPerms?.includes('Administrator')) risk += 40;
    else risk += 15;
  }
  return Math.min(risk, 100);
}

function hasDangerousPerms(overwrite, dangerousPerms) {
  const allPerms = [...(overwrite.allow?.serialize() || []), ...(overwrite.deny?.serialize() || [])];
  return dangerousPerms.some(p => allPerms.includes(p));
}

function getAddedPermissions(oldOverwrite, newOverwrite, dangerousPerms) {
  const oldAllow = oldOverwrite.allow?.serialize() || [];
  const newAllow = newOverwrite.allow?.serialize() || [];
  return dangerousPerms.filter(p => newAllow.includes(p) && !oldAllow.includes(p));
}
