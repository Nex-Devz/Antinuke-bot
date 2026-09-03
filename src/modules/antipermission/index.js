export async function handlePermissionOverwriteCreate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const config = await database.getConfig(event.guild.id);
  if (!config?.modules?.antipermission?.enabled) return;

  if (await whitelistManager.isWhitelisted(event.guild.id, event.executorId)) return;
  if (await ownerManager.isExtraOwner(event.guild.id, event.executorId)) return;

  const dangerousPerms = ['Administrator', 'ManageRoles', 'ManageChannels', 'ManageGuild', 'BanMembers', 'KickMembers'];
  const grantedPerms = event.overwrite?.allow?.serialize() || [];
  const detectedDangerous = dangerousPerms.filter(p => grantedPerms.includes(p));

  if (detectedDangerous.length > 0) {
    const risk = calculateOverwriteRisk(event, detectedDangerous);
    if (risk >= 70) {
      await event.overwrite.delete('Luna: Dangerous permission overwrite detected').catch(() => null);
      await punishmentEngine.punish(event.guild.id, event.executorId, 'dangerous_permission_grant', risk);
      await incidentEngine.create(event.guild.id, 'antipermission', 'permission_create', event.executorId, event.overwrite.id, 'critical', risk, { channel: event.channel.id, target: event.overwrite.type === 0 ? 'role' : 'member', targetId: event.overwrite.id, grantedPerms: detectedDangerous }, 'delete_and_punish');
    } else if (risk >= 30) {
      await incidentEngine.create(event.guild.id, 'antipermission', 'permission_create', event.executorId, event.overwrite.id, 'warning', risk, { channel: event.channel.id, target: event.overwrite.type === 0 ? 'role' : 'member', targetId: event.overwrite.id, grantedPerms: detectedDangerous }, 'log_only');
    }
  }
}

export async function handlePermissionOverwriteDelete(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const config = await database.getConfig(event.guild.id);
  if (!config?.modules?.antipermission?.enabled) return;

  if (await whitelistManager.isWhitelisted(event.guild.id, event.executorId)) return;
  if (await ownerManager.isExtraOwner(event.guild.id, event.executorId)) return;

  const dangerousPerms = ['Administrator', 'ManageRoles', 'ManageChannels', 'ManageGuild', 'BanMembers', 'KickMembers'];
  const removedPerms = event.overwrite?.allow?.serialize() || [];
  const detectedDangerous = dangerousPerms.filter(p => removedPerms.includes(p));

  if (detectedDangerous.length > 0) {
    const risk = calculateOverwriteDeleteRisk(event, detectedDangerous);
    if (risk >= 30) {
      await incidentEngine.create(event.guild.id, 'antipermission', 'permission_delete', event.executorId, event.overwrite.id, 'warning', risk, { channel: event.channel.id, target: event.overwrite.type === 0 ? 'role' : 'member', targetId: event.overwrite.id, removedPerms: detectedDangerous }, 'log_only');
    }
  }
}

export async function handlePermissionOverwriteUpdate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const config = await database.getConfig(event.guild.id);
  if (!config?.modules?.antipermission?.enabled) return;

  if (await whitelistManager.isWhitelisted(event.guild.id, event.executorId)) return;
  if (await ownerManager.isExtraOwner(event.guild.id, event.executorId)) return;

  const dangerousPerms = ['Administrator', 'ManageRoles', 'ManageChannels', 'ManageGuild', 'BanMembers', 'KickMembers'];
  const oldPerms = event.old?.allow?.serialize() || [];
  const newPerms = event.overwrite?.allow?.serialize() || [];
  const addedPerms = dangerousPerms.filter(p => newPerms.includes(p) && !oldPerms.includes(p));

  if (addedPerms.length > 0) {
    const risk = calculateOverwriteUpdateRisk(event, addedPerms);
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
      await punishmentEngine.punish(event.guild.id, event.executorId, 'dangerous_permission_update', risk);
      await incidentEngine.create(event.guild.id, 'antipermission', 'permission_update', event.executorId, event.overwrite.id, 'critical', risk, { channel: event.channel.id, addedPerms }, 'revert_and_punish');
    } else if (risk >= 30) {
      await incidentEngine.create(event.guild.id, 'antipermission', 'permission_update', event.executorId, event.overwrite.id, 'warning', risk, { channel: event.channel.id, addedPerms }, 'log_only');
    }
  }
}

function calculateOverwriteRisk(event, detectedDangerous) {
  let risk = 25;
  if (detectedDangerous.includes('Administrator')) risk += 40;
  if (detectedDangerous.includes('ManageRoles')) risk += 15;
  if (detectedDangerous.includes('ManageChannels')) risk += 15;
  if (detectedDangerous.includes('BanMembers')) risk += 10;
  if (event.overwrite.type === 1) risk += 10;
  const protectedTypes = ['GUILD_TEXT', 'GUILD_VOICE', 'GUILD_CATEGORY'];
  if (protectedTypes.includes(event.channel.type)) risk += 10;
  return Math.min(risk, 100);
}

function calculateOverwriteDeleteRisk(event, detectedDangerous) {
  let risk = 20;
  if (detectedDangerous.includes('Administrator')) risk += 30;
  if (detectedDangerous.includes('ManageRoles')) risk += 10;
  if (detectedDangerous.includes('ManageChannels')) risk += 10;
  return Math.min(risk, 100);
}

function calculateOverwriteUpdateRisk(event, addedPerms) {
  let risk = 25;
  if (addedPerms.includes('Administrator')) risk += 40;
  if (addedPerms.includes('ManageRoles')) risk += 15;
  if (addedPerms.includes('ManageChannels')) risk += 15;
  if (addedPerms.includes('BanMembers')) risk += 10;
  if (addedPerms.includes('KickMembers')) risk += 5;
  const protectedChannels = ['SYSTEM', 'ANNOUNCEMENT'];
  if (protectedChannels.includes(event.channel.type)) risk += 15;
  return Math.min(risk, 100);
}
