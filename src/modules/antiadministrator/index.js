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
  const { client, cache, database, incidentEngine, punishmentEngine, auditCorrelator, whitelistManager, ownerManager } = context;

  try {
    const config = await database.getConfig(event.newRole.guild.id);
    if (!config?.modules?.antiadministrator?.enabled) return;

    const { oldRole, newRole } = event;
    if (!oldRole || !newRole) return;

    if (oldRole.permissions === newRole.permissions) return;

    const analysis = analyzePermissionChange(oldRole.permissions, newRole.permissions);

    if (!analysis.hasAdminAdded && !analysis.added.some(p => CRITICAL_PERMISSIONS.includes(p))) return;

    const executorId = await auditCorrelator.resolveExecutor(newRole.guild, 'ROLE_UPDATE', newRole.id);
    if (!executorId) return;

    if (await whitelistManager.isWhitelisted(newRole.guild.id, executorId)) return;
    if (await ownerManager.isExtraOwner(newRole.guild.id, executorId)) return;

    console.log(`[Security] CRITICAL: Administrator permission escalation on role ${newRole.name} in ${newRole.guild.name} by ${executorId}`);

    const reason = `Luna: Unauthorized Administrator permission escalation on role: ${newRole.name}`;

    await Promise.all([
      punishmentEngine.punish(newRole.guild.id, executorId, 'BAN', reason).catch(e => {
        console.log(`[Security] Failed to punish ${executorId}: ${e.message}`);
        return null;
      }),
      incidentEngine.create(newRole.guild.id, 'antiadministrator', 'role_update', executorId, newRole.id, 'critical', 95, {
        roleId: newRole.id,
        roleName: newRole.name,
        previousPermissions: getPermissionNames(oldRole.permissions),
        currentPermissions: getPermissionNames(newRole.permissions),
        addedPermissions: analysis.added
      }, 'ban_and_revert')
    ]);

    if (analysis.hasAdminAdded) {
      try {
        await newRole.setPermissions(oldRole.permissions, 'Luna: Reverting unauthorized Administrator permission');
        console.log(`[Security] Reverted Administrator permission on role ${newRole.name}`);
      } catch (error) {
        console.log(`[Security] Failed to revert: ${error.message}`);
      }
    }
  } catch (error) {
    console.log(`[Security] Error in antiadministrator role update: ${error.message}`);
  }
}

export async function handleMemberUpdate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, auditCorrelator, whitelistManager, ownerManager } = context;

  try {
    const config = await database.getConfig(event.newMember.guild.id);
    if (!config?.modules?.antiadministrator?.enabled) return;

    const { oldMember, newMember } = event;
    if (!oldMember || !newMember) return;

    const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    if (addedRoles.size === 0) return;

    const executorId = await auditCorrelator.resolveExecutor(newMember.guild, 'MEMBER_ROLE_UPDATE', newMember.id);
    if (!executorId) return;

    if (await whitelistManager.isWhitelisted(newMember.guild.id, executorId)) return;
    if (await ownerManager.isExtraOwner(newMember.guild.id, executorId)) return;

    for (const [, role] of addedRoles) {
      if (hasAdministratorPermission(role.permissions)) {
        console.log(`[Security] CRITICAL: Administrator role assigned to ${newMember.id} by ${executorId}`);

        const reason = `Luna: Unauthorized Administrator role assignment: ${role.name}`;

        await Promise.all([
          punishmentEngine.punish(newMember.guild.id, executorId, 'BAN', reason).catch(e => {
            console.log(`[Security] Failed to punish ${executorId}: ${e.message}`);
            return null;
          }),
          incidentEngine.create(newMember.guild.id, 'antiadministrator', 'member_role_update', executorId, newMember.id, 'critical', 95, {
            roleId: role.id,
            roleName: role.name,
            rolePermissions: getPermissionNames(role.permissions)
          }, 'ban_and_remove_role')
        ]);

        try {
          await newMember.roles.remove(role.id, 'Luna: Removing unauthorized Administrator role');
          console.log(`[Security] Removed Administrator role ${role.name} from ${newMember.id}`);
        } catch (error) {
          console.log(`[Security] Failed to remove role: ${error.message}`);
        }

        return;
      }
    }
  } catch (error) {
    console.log(`[Security] Error in antiadministrator member update: ${error.message}`);
  }
}
