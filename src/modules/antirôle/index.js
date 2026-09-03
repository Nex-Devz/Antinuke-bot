import { getRoleRisk, isDangerousRole, isAdminRole, getRiskLevel, getPermissionChanges } from '../../security/PermissionAnalyzer.js';

export async function handleRoleCreate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const guild = event.guild;
  const guildId = guild?.id;
  if (!guildId) return;

  const config = await database.getConfig(guildId);
  if (!config?.modules?.antirôle?.enabled) return;

  try {
    if (await whitelistManager.isWhitelisted(guildId, event.executorId)) return;
    if (await ownerManager.isExtraOwner(guildId, event.executorId)) return;

    await snapshotManager.captureRole(guildId, event.role);

    const recentCreates = await cache.getRoleCreates(guildId);
    const risk = calculateRoleCreateRisk(event, recentCreates);

    if (risk >= 70) {
      await event.role.delete().catch(() => null);
      await punishmentEngine.punish(guildId, event.executorId, 'role_create_spam', risk);
      await incidentEngine.create(guildId, 'antirôle', 'role_create', event.executorId, event.role.id, 'critical', risk, { recentCreates, role: event.role.toJSON() }, 'delete_and_punish');
    } else if (risk >= 30) {
      await incidentEngine.create(guildId, 'antirôle', 'role_create', event.executorId, event.role.id, 'warning', risk, { recentCreates, role: event.role.toJSON() }, 'log_only');
    }
  } catch (err) {
    console.error(`[Security] Error in handleRoleCreate for guild ${guildId}:`, err);
  }
}

export async function handleRoleDelete(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const guild = event.guild;
  const guildId = guild?.id;
  if (!guildId) return;

  const config = await database.getConfig(guildId);
  if (!config?.modules?.antirôle?.enabled) return;

  try {
    if (await whitelistManager.isWhitelisted(guildId, event.executorId)) return;
    if (await ownerManager.isExtraOwner(guildId, event.executorId)) return;

    const recentDeletes = await cache.getRoleDeletes(guildId);
    const risk = calculateRoleDeleteRisk(event, recentDeletes);

    if (risk >= 70) {
      const snapshot = await snapshotManager.getRoleSnapshot(guildId, event.role.id);
      if (snapshot) {
        const restored = await guild.roles.create({
          name: snapshot.name,
          color: snapshot.color,
          hoist: snapshot.hoist,
          mentionable: snapshot.mentionable,
          permissions: snapshot.permissions,
          reason: 'Luna: Restoring deleted role'
        }).catch(() => null);
        if (restored && snapshot.position) await restored.setPosition(snapshot.position).catch(() => null);
      }
      await punishmentEngine.punish(guildId, event.executorId, 'role_delete_spam', risk);
      await incidentEngine.create(guildId, 'antirôle', 'role_delete', event.executorId, event.role.id, 'critical', risk, { recentDeletes, role: event.role.toJSON() }, 'restore_and_punish');
    } else if (risk >= 30) {
      await incidentEngine.create(guildId, 'antirôle', 'role_delete', event.executorId, event.role.id, 'warning', risk, { recentDeletes, role: event.role.toJSON() }, 'log_only');
    }
  } catch (err) {
    console.error(`[Security] Error in handleRoleDelete for guild ${guildId}:`, err);
  }
}

export async function handleRoleUpdate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const guild = event.guild;
  const guildId = guild?.id;
  if (!guildId) return;

  const config = await database.getConfig(guildId);
  if (!config?.modules?.antirôle?.enabled) return;

  try {
    if (await whitelistManager.isWhitelisted(guildId, event.executorId)) return;
    if (await ownerManager.isExtraOwner(guildId, event.executorId)) return;

    const oldPerms = event.old.role?.permissions?.serialize() || [];
    const newPerms = event.role.permissions?.serialize() || [];
    const escalation = getPermissionChanges(oldPerms, newPerms);

    if (escalation.dangerous) {
      const risk = getRoleRisk(event.role);
      if (risk >= 70) {
        const snapshot = await snapshotManager.getRoleSnapshot(guildId, event.role.id);
        if (snapshot) {
          await event.role.setPermissions(snapshot.permissions, 'Luna: Reverting dangerous permission change').catch(() => null);
        }
        await punishmentEngine.punish(guildId, event.executorId, 'role_permission_escalation', risk);
        await incidentEngine.create(guildId, 'antirôle', 'role_update', event.executorId, event.role.id, 'critical', risk, { addedPermissions: escalation.added, removedPermissions: escalation.removed }, 'revert_and_punish');
      } else if (risk >= 30) {
        await incidentEngine.create(guildId, 'antirôle', 'role_update', event.executorId, event.role.id, 'warning', risk, { addedPermissions: escalation.added, removedPermissions: escalation.removed }, 'log_only');
      }
    }
  } catch (err) {
    console.error(`[Security] Error in handleRoleUpdate for guild ${guildId}:`, err);
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
