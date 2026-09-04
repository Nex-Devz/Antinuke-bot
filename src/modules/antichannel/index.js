export async function handleChannelCreate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const guild = event.guild;
  if (!guild) return;
  const guildId = guild.id;

  const config = await database.getConfig(guildId);
  if (!config?.modules?.antichannel?.enabled) return;

  const executorId = await auditCorrelator.resolveExecutor(guild, 'CHANNEL_CREATE', event.channel.id);
  console.log(`[Security] Channel created: ${event.channel.name} in ${guild.name} by ${executorId || 'unknown'}`);

  if (!executorId) return;
  if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
  if (await ownerManager.isExtraOwner(guildId, executorId)) return;

  const actions = config.modules.antichannel.actions || {};
  const reason = 'Luna: Unauthorized channel creation';

  await Promise.all([
    snapshotManager.takeChannelSnapshot(guildId, event.channel.id).catch(() => null),
    actions.restore ? event.channel.delete(reason).catch(() => null) : null,
    actions.punish ? punishmentEngine.punish(guildId, executorId, actions.punish, reason).catch(e => {
      console.log(`[Security] Failed to punish: ${e.message}`);
      return null;
    }) : null,
    incidentEngine.create(guildId, 'antichannel', 'channel_create', executorId, event.channel.id, 'critical', 80, { channelName: event.channel.name }, 'delete_and_punish')
  ]);
}

export async function handleChannelDelete(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const guild = event.guild;
  if (!guild) return;
  const guildId = guild.id;

  const config = await database.getConfig(guildId);
  if (!config?.modules?.antichannel?.enabled) return;

  const executorId = await auditCorrelator.resolveExecutor(guild, 'CHANNEL_DELETE', event.channel.id);
  console.log(`[Security] Channel deleted: ${event.channel.name} in ${guild.name} by ${executorId || 'unknown'}`);

  if (!executorId) return;
  if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
  if (await ownerManager.isExtraOwner(guildId, executorId)) return;

  const actions = config.modules.antichannel.actions || {};

  const tasks = [
    incidentEngine.create(guildId, 'antichannel', 'channel_delete', executorId, event.channel.id, 'critical', 85, { channelName: event.channel.name }, 'restore_and_punish')
  ];

  if (actions.punish) {
    tasks.push(punishmentEngine.punish(guildId, executorId, actions.punish, 'Luna: Unauthorized channel deletion').catch(e => {
      console.log(`[Security] Failed to punish: ${e.message}`);
      return null;
    }));
  }

  if (actions.restore) {
    tasks.push(
      snapshotManager.getSnapshot(guildId, `channel:${event.channel.id}`).then(async snapshot => {
        if (snapshot) {
          const restored = await guild.channels.create({
            name: snapshot.name,
            type: snapshot.channelType || snapshot.type,
            topic: snapshot.topic,
            nsfw: snapshot.nsfw,
            parent: snapshot.parentId ? await guild.channels.fetch(snapshot.parentId).catch(() => null) : null,
            permissionOverwrites: snapshot.permissionOverwrites || []
          }).catch(() => null);
          if (restored && snapshot.position) await restored.setPosition(snapshot.position).catch(() => null);
          console.log(`[Security] Restored channel: ${restored?.name || snapshot.name}`);
        }
      }).catch(() => null)
    );
  }

  await Promise.all(tasks);
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
  console.log(`[Security] Dangerous permission change in ${event.channel.name} by ${executorId || 'unknown'}`);

  if (!executorId) return;
  if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
  if (await ownerManager.isExtraOwner(guildId, executorId)) return;

  const actions = config.modules.antichannel.actions || {};
  const reason = 'Luna: Dangerous permission change';

  const tasks = [
    incidentEngine.create(guildId, 'antichannel', 'permission_overwrite', executorId, event.channel.id, 'critical', 75, { changedOverwrites }, 'revert_and_punish')
  ];

  if (actions.punish) {
    tasks.push(punishmentEngine.punish(guildId, executorId, actions.punish, reason).catch(e => {
      console.log(`[Security] Failed to punish: ${e.message}`);
      return null;
    }));
  }

  if (actions.restore) {
    tasks.push(
      snapshotManager.getSnapshot(guildId, `channel:${event.channel.id}`).then(async snapshot => {
        if (snapshot?.overwrites) {
          await event.channel.edit({ permissionOverwrites: snapshot.overwrites }, reason).catch(() => null);
        }
      }).catch(() => null)
    );
  }

  await Promise.all(tasks);
}