const ADMINISTRATOR_PERMISSION = 1n << 3n;

const CRITICAL_PERMISSIONS = [
  'Administrator',
  'ManageRoles',
  'ManageChannels',
  'ManageGuild'
];

function hasAdministratorPermission(permissions) {
  return (BigInt(permissions) & ADMINISTRATOR_PERMISSION) !== 0n;
}

function getPermissionNames(permissions) {
  const permissionFlags = {
    Administrator: 1n << 3n,
    ManageRoles: 1n << 28n,
    ManageChannels: 1n << 4n,
    ManageGuild: 1n << 5n,
    BanMembers: 1n << 2n,
    KickMembers: 1n << 1n,
    ManageMessages: 1n << 13n,
    ManageWebhooks: 1n << 29n,
    ManageEmojisAndStickers: 1n << 30n,
    ManageEvents: 1n << 33n,
    ManageThreads: 1n << 34n,
    MentionEveryone: 1n << 18n,
    ManageNicknames: 1n << 27n,
    ViewAuditLog: 1n << 20n,
    ManagePermissions: 1n << 31n
  };

  const flags = BigInt(permissions);
  const result = [];

  for (const [name, flag] of Object.entries(permissionFlags)) {
    if (flags & flag) {
      result.push(name);
    }
  }

  return result;
}

function analyzePermissionChange(oldPermissions, newPermissions) {
  const oldPerms = BigInt(oldPermissions);
  const newPerms = BigInt(newPermissions);

  const added = newPerms & ~oldPerms;
  const removed = oldPerms & ~newPerms;

  return {
    added: getPermissionNames(added),
    removed: getPermissionNames(removed),
    hasAdminAdded: hasAdministratorPermission(added),
    hasAdminRemoved: hasAdministratorPermission(removed)
  };
}

export async function handleRoleUpdate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;

  try {
    const config = cache.get('config');
    if (!config?.modules?.antiadministrator?.enabled) {
      return;
    }

    const { oldRole, newRole } = event;
    if (!oldRole || !newRole) return;

    if (oldRole.permissions === newRole.permissions) return;

    const analysis = analyzePermissionChange(oldRole.permissions, newRole.permissions);

    if (!analysis.hasAdminAdded && !analysis.added.some(p => CRITICAL_PERMISSIONS.includes(p))) {
      return;
    }

    const auditLog = await auditCorrelator.getRecentAuditLogs(newRole.guild, {
      type: 'ROLE_UPDATE',
      limit: 5
    });

    const executor = auditLog.entries.first()?.executor;
    if (!executor) return;

    if (whitelistManager.isWhitelisted(executor.id)) return;
    if (await ownerManager.isExtraOwner(executor.id)) return;

    console.log(`[Security] CRITICAL: Administrator permission escalation detected on role ${newRole.name} in ${newRole.guild.name}`);

    await punishmentEngine.apply(newRole.guild, {
      type: 'BAN',
      moderator: client.user,
      reason: `Unauthorized Administrator permission escalation on role: ${newRole.name}`,
      target: executor
    });

    await incidentEngine.log({
      type: 'ADMINISTRATOR_ESCALATION',
      severity: 'CRITICAL',
      executor: executor.id,
      guild: newRole.guild.id,
      details: {
        roleId: newRole.id,
        roleName: newRole.name,
        previousPermissions: getPermissionNames(oldRole.permissions),
        currentPermissions: getPermissionNames(newRole.permissions),
        addedPermissions: analysis.added,
        removedPermissions: analysis.removed
      }
    });

    if (analysis.hasAdminAdded) {
      try {
        const revertPermissions = oldRole.permissions;
        await newRole.setPermissions(revertPermissions, 'AntiN8: Reverting unauthorized Administrator permission');
        console.log(`[Security] Reverted Administrator permission on role ${newRole.name}`);
      } catch (error) {
        console.log(`[Security] Failed to revert Administrator permission: ${error.message}`);
      }
    }
  } catch (error) {
    console.log(`[Security] Error in antiadministrator role update handler: ${error.message}`);
  }
}

export async function handleMemberUpdate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;

  try {
    const config = cache.get('config');
    if (!config?.modules?.antiadministrator?.enabled) {
      return;
    }

    const { oldMember, newMember } = event;
    if (!oldMember || !newMember) return;

    const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    if (addedRoles.size === 0) return;

    const auditLog = await auditCorrelator.getRecentAuditLogs(newMember.guild, {
      type: 'MEMBER_ROLE_UPDATE',
      limit: 5
    });

    const executor = auditLog.entries.first()?.executor;
    if (!executor) return;

    if (whitelistManager.isWhitelisted(executor.id)) return;
    if (await ownerManager.isExtraOwner(executor.id)) return;

    for (const [, role] of addedRoles) {
      if (hasAdministratorPermission(role.permissions)) {
        console.log(`[Security] CRITICAL: Administrator role assigned to ${newMember.id} by ${executor.id}`);

        await punishmentEngine.apply(newMember.guild, {
          type: 'BAN',
          moderator: client.user,
          reason: `Unauthorized Administrator role assignment: ${role.name}`,
          target: newMember
        });

        await incidentEngine.log({
          type: 'ADMINISTRATOR_ROLE_ASSIGNMENT',
          severity: 'CRITICAL',
          executor: executor.id,
          target: newMember.id,
          guild: newMember.guild.id,
          details: {
            roleId: role.id,
            roleName: role.name,
            rolePermissions: getPermissionNames(role.permissions)
          }
        });

        try {
          await newMember.roles.remove(role.id, 'AntiN8: Removing unauthorized Administrator role');
          console.log(`[Security] Removed Administrator role ${role.name} from ${newMember.id}`);
        } catch (error) {
          console.log(`[Security] Failed to remove Administrator role: ${error.message}`);
        }

        return;
      }

      const rolePermissions = getPermissionNames(role.permissions);
      const criticalPerms = rolePermissions.filter(p => CRITICAL_PERMISSIONS.includes(p));

      if (criticalPerms.length > 0) {
        console.log(`[Security] High risk role assignment: ${executor.id} assigned role with critical permissions to ${newMember.id}`);

        await incidentEngine.log({
          type: 'CRITICAL_ROLE_ASSIGNMENT',
          severity: 'HIGH',
          executor: executor.id,
          target: newMember.id,
          guild: newMember.guild.id,
          details: {
            roleId: role.id,
            roleName: role.name,
            criticalPermissions: criticalPerms,
            allPermissions: rolePermissions
          }
        });
      }
    }
  } catch (error) {
    console.log(`[Security] Error in antiadministrator member update handler: ${error.message}`);
  }
}
