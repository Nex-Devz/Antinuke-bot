const DANGEROUS_PERMISSIONS = ['Administrator', 'ManageRoles', 'ManageChannels', 'ManageGuild', 'BanMembers', 'KickMembers'];

export async function handlePermissionOverwriteCreate(event, context) {
  const { database, incidentEngine, punishmentEngine, whitelistManager, ownerManager } = context;
  const config = await database.getConfig(event.guild.id);
  if (!config?.modules?.antipermission?.enabled) return;

  if (await whitelistManager.isWhitelisted(event.guild.id, event.executorId)) return;
  if (await ownerManager.isExtraOwner(event.guild.id, event.executorId)) return;

  const grantedPerms = event.overwrite?.allow?.serialize() || [];
  const detectedDangerous = DANGEROUS_PERMISSIONS.filter(p => grantedPerms.includes(p));

  if (detectedDangerous.length > 0) {
    const risk = 25 + (detectedDangerous.includes('Administrator') ? 40 : 0) + (detectedDangerous.includes('ManageRoles') ? 15 : 0) + (detectedDangerous.includes('ManageChannels') ? 15 : 0);
    const clampedRisk = Math.min(risk, 100);

    if (clampedRisk >= 70) {
      await event.overwrite.delete('Luna: Dangerous permission overwrite').catch(() => null);

      await Promise.all([
        punishmentEngine.punish(event.guild.id, event.executorId, 'BAN', 'Luna: Dangerous permission overwrite').catch(e => {
          console.log(`[Security] Failed to punish: ${e.message}`);
          return null;
        }),
        incidentEngine.create(event.guild.id, 'antipermission', 'permission_create', event.executorId, event.overwrite.id, 'critical', clampedRisk, {
          channel: event.channel.id,
          grantedPerms: detectedDangerous
        }, 'delete_and_ban')
      ]);
    } else if (clampedRisk >= 30) {
      await incidentEngine.create(event.guild.id, 'antipermission', 'permission_create', event.executorId, event.overwrite.id, 'warning', clampedRisk, {
        channel: event.channel.id,
        grantedPerms: detectedDangerous
      }, 'log_only');
    }
  }
}

export async function handlePermissionOverwriteDelete(event, context) {
  const { database, incidentEngine, whitelistManager, ownerManager } = context;
  const config = await database.getConfig(event.guild.id);
  if (!config?.modules?.antipermission?.enabled) return;

  if (await whitelistManager.isWhitelisted(event.guild.id, event.executorId)) return;
  if (await ownerManager.isExtraOwner(event.guild.id, event.executorId)) return;

  const removedPerms = event.overwrite?.allow?.serialize() || [];
  const detectedDangerous = DANGEROUS_PERMISSIONS.filter(p => removedPerms.includes(p));

  if (detectedDangerous.length > 0) {
    const risk = Math.min(20 + (detectedDangerous.includes('Administrator') ? 30 : 0), 100);
    if (risk >= 30) {
      await incidentEngine.create(event.guild.id, 'antipermission', 'permission_delete', event.executorId, event.overwrite.id, 'warning', risk, {
        channel: event.channel.id,
        removedPerms: detectedDangerous
      }, 'log_only');
    }
  }
}

export async function handlePermissionOverwriteUpdate(event, context) {
  const { database, incidentEngine, punishmentEngine, snapshotManager, whitelistManager, ownerManager } = context;
  const config = await database.getConfig(event.guild.id);
  if (!config?.modules?.antipermission?.enabled) return;

  if (await whitelistManager.isWhitelisted(event.guild.id, event.executorId)) return;
  if (await ownerManager.isExtraOwner(event.guild.id, event.executorId)) return;

  const oldPerms = event.old?.allow?.serialize() || [];
  const newPerms = event.overwrite?.allow?.serialize() || [];
  const addedPerms = DANGEROUS_PERMISSIONS.filter(p => newPerms.includes(p) && !oldPerms.includes(p));

  if (addedPerms.length > 0) {
    const risk = Math.min(25 + (addedPerms.includes('Administrator') ? 40 : 0) + (addedPerms.includes('ManageRoles') ? 15 : 0) + (addedPerms.includes('ManageChannels') ? 15 : 0), 100);

    if (risk >= 70) {
      const snapshot = await snapshotManager.getChannelSnapshot(event.guild.id, event.channel.id);
      if (snapshot?.overwrites) {
        const originalOverwrite = snapshot.overwrites.find(o => o.id === event.overwrite.id);
        if (originalOverwrite) {
          await event.overwrite.update({ allow: originalOverwrite.allow, deny: originalOverwrite.deny }, 'Luna: Reverting dangerous permission change').catch(() => null);
        } else {
          await event.overwrite.delete('Luna: Removing dangerous permission overwrite').catch(() => null);
        }
      }

      await Promise.all([
        punishmentEngine.punish(event.guild.id, event.executorId, 'BAN', 'Luna: Dangerous permission update').catch(e => {
          console.log(`[Security] Failed to punish: ${e.message}`);
          return null;
        }),
        incidentEngine.create(event.guild.id, 'antipermission', 'permission_update', event.executorId, event.overwrite.id, 'critical', risk, {
          channel: event.channel.id,
          addedPerms
        }, 'revert_and_ban')
      ]);
    } else if (risk >= 30) {
      await incidentEngine.create(event.guild.id, 'antipermission', 'permission_update', event.executorId, event.overwrite.id, 'warning', risk, {
        channel: event.channel.id,
        addedPerms
      }, 'log_only');
    }
  }
}

export async function handleChannelUpdatePermission(event, context) {
  const { auditCorrelator } = context;
  const oldChannel = event.old?.channel;
  const newChannel = event.channel;
  if (!oldChannel || !newChannel || !newChannel.permissionOverwrites) return;

  const oldOverwrites = oldChannel.permissionOverwrites.cache;
  const newOverwrites = newChannel.permissionOverwrites.cache;

  let executorId = event.executorId;
  if (!executorId && auditCorrelator) {
    executorId = await auditCorrelator.resolveExecutor(newChannel.guild, 'CHANNEL_OVERWRITE_UPDATE', newChannel.id)
      || await auditCorrelator.resolveExecutor(newChannel.guild, 'CHANNEL_UPDATE', newChannel.id);
  }

  // Check added overwrites
  for (const [id, overwrite] of newOverwrites) {
    if (!oldOverwrites.has(id)) {
      await handlePermissionOverwriteCreate({
        guild: newChannel.guild,
        executorId,
        channel: newChannel,
        overwrite
      }, context);
    } else {
      const oldOverwrite = oldOverwrites.get(id);
      if (oldOverwrite.allow?.bitfield !== overwrite.allow?.bitfield || oldOverwrite.deny?.bitfield !== overwrite.deny?.bitfield) {
        await handlePermissionOverwriteUpdate({
          guild: newChannel.guild,
          executorId,
          channel: newChannel,
          overwrite,
          old: oldOverwrite
        }, context);
      }
    }
  }

  // Check removed overwrites
  for (const [id, overwrite] of oldOverwrites) {
    if (!newOverwrites.has(id)) {
      await handlePermissionOverwriteDelete({
        guild: newChannel.guild,
        executorId,
        channel: newChannel,
        overwrite
      }, context);
    }
  }
}

