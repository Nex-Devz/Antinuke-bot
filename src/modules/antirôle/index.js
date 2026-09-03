import { PermissionAnalyzer } from '../security/PermissionAnalyzer.js';

export async function handleRoleCreate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const config = await database.getConfig(event.guild.id);
  if (!config?.modules?.antirôle?.enabled) return;

  if (await whitelistManager.isWhitelisted(event.guild.id, event.executorId)) return;
  if (await ownerManager.isExtraOwner(event.guild.id, event.executorId)) return;

  await snapshotManager.captureRole(event.guild.id, event.role);

  const recentCreates = await cache.getRoleCreates(event.guild.id);
  const risk = calculateRoleCreateRisk(event, recentCreates);

  if (risk >= 70) {
    await event.role.delete().catch(() => null);
    await punishmentEngine.punish(event.guild.id, event.executorId, 'role_create_spam', risk);
    await incidentEngine.create(event.guild.id, 'antirôle', 'role_create', event.executorId, event.role.id, 'critical', risk, { recentCreates, role: event.role.toJSON() }, 'delete_and_punish');
  } else if (risk >= 30) {
    await incidentEngine.create(event.guild.id, 'antirôle', 'role_create', event.executorId, event.role.id, 'warning', risk, { recentCreates, role: event.role.toJSON() }, 'log_only');
  }
}

export async function handleRoleDelete(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const config = await database.getConfig(event.guild.id);
  if (!config?.modules?.antirôle?.enabled) return;

  if (await whitelistManager.isWhitelisted(event.guild.id, event.executorId)) return;
  if (await ownerManager.isExtraOwner(event.guild.id, event.executorId)) return;

  const recentDeletes = await cache.getRoleDeletes(event.guild.id);
  const risk = calculateRoleDeleteRisk(event, recentDeletes);

  if (risk >= 70) {
    const snapshot = await snapshotManager.getRoleSnapshot(event.guild.id, event.role.id);
    if (snapshot) {
      const restored = await event.guild.roles.create({
        name: snapshot.name,
        color: snapshot.color,
        hoist: snapshot.hoist,
        mentionable: snapshot.mentionable,
        permissions: snapshot.permissions,
        reason: 'AntiN8: Restoring deleted role'
      }).catch(() => null);
      if (restored && snapshot.position) await restored.setPosition(snapshot.position).catch(() => null);
    }
    await punishmentEngine.punish(event.guild.id, event.executorId, 'role_delete_spam', risk);
    await incidentEngine.create(event.guild.id, 'antirôle', 'role_delete', event.executorId, event.role.id, 'critical', risk, { recentDeletes, role: event.role.toJSON() }, 'restore_and_punish');
  } else if (risk >= 30) {
    await incidentEngine.create(event.guild.id, 'antirôle', 'role_delete', event.executorId, event.role.id, 'warning', risk, { recentDeletes, role: event.role.toJSON() }, 'log_only');
  }
}

export async function handleRoleUpdate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const config = await database.getConfig(event.guild.id);
  if (!config?.modules?.antirôle?.enabled) return;

  if (await whitelistManager.isWhitelisted(event.guild.id, event.executorId)) return;
  if (await ownerManager.isExtraOwner(event.guild.id, event.executorId)) return;

  const oldPerms = event.old.role?.permissions?.serialize() || [];
  const newPerms = event.role.permissions?.serialize() || [];
  const escalation = PermissionAnalyzer.detectEscalation(oldPerms, newPerms);

  if (escalation.dangerous) {
    const risk = calculateRoleEscalationRisk(escalation);
    if (risk >= 70) {
      const snapshot = await snapshotManager.getRoleSnapshot(event.guild.id, event.role.id);
      if (snapshot) {
        await event.role.setPermissions(snapshot.permissions, 'AntiN8: Reverting dangerous permission change').catch(() => null);
      }
      await punishmentEngine.punish(event.guild.id, event.executorId, 'role_permission_escalation', risk);
      await incidentEngine.create(event.guild.id, 'antirôle', 'role_update', event.executorId, event.role.id, 'critical', risk, { addedPermissions: escalation.added, removedPermissions: escalation.removed }, 'revert_and_punish');
    } else if (risk >= 30) {
      await incidentEngine.create(event.guild.id, 'antirôle', 'role_update', event.executorId, event.role.id, 'warning', risk, { addedPermissions: escalation.added, removedPermissions: escalation.removed }, 'log_only');
    }
  }
}

function calculateRoleCreateRisk(event, recentCreates) {
  let risk = 10;
  const now = Date.now();
  const recentCount = recentCreates.filter(t => now - t < 60000).length;
  if (recentCount > 3) risk += 30;
  if (recentCount > 6) risk += 35;
  const dangerousPerms = ['Administrator', 'ManageGuild', 'ManageRoles', 'ManageChannels'];
  const rolePerms = event.role.permissions?.serialize() || [];
  if (dangerousPerms.some(p => rolePerms.includes(p))) risk += 20;
  return Math.min(risk, 100);
}

function calculateRoleDeleteRisk(event, recentDeletes) {
  let risk = 15;
  const now = Date.now();
  const recentCount = recentDeletes.filter(t => now - t < 60000).length;
  if (recentCount > 2) risk += 35;
  if (recentCount > 5) risk += 35;
  return Math.min(risk, 100);
}

function calculateRoleEscalationRisk(escalation) {
  let risk = 20;
  if (escalation.added.includes('Administrator')) risk += 40;
  if (escalation.added.includes('ManageGuild')) risk += 20;
  if (escalation.added.includes('ManageRoles')) risk += 20;
  if (escalation.added.includes('ManageChannels')) risk += 20;
  return Math.min(risk, 100);
}
