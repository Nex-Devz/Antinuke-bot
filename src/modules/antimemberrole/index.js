const DANGEROUS_PERMISSIONS = [
  'Administrator',
  'ManageRoles',
  'ManageChannels',
  'ManageGuild',
  'BanMembers',
  'KickMembers',
  'ManageMessages',
  'ManageWebhooks',
  'ManageEmojisAndStickers',
  'ManageEvents',
  'ManageThreads',
  'MentionEveryone',
  'ManageNicknames',
  'ViewAuditLog',
  'ManagePermissions'
];

const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = 5;

const roleChangeCache = new Map();

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

function isDangerousPermission(permission) {
  return DANGEROUS_PERMISSIONS.includes(permission);
}

function checkRateLimit(key) {
  const now = Date.now();
  const timestamps = roleChangeCache.get(key) || [];

  const recentTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
  recentTimestamps.push(now);
  roleChangeCache.set(key, recentTimestamps);

  return recentTimestamps.length > RATE_LIMIT_MAX;
}

function calculateRiskScore(executor, target, roles, eventType) {
  let risk = 0;

  for (const roleId of roles) {
    const role = target.guild?.roles?.cache.get(roleId);
    if (!role) continue;

    const permissions = getPermissionNames(role.permissions);
    const dangerousPerms = permissions.filter(p => isDangerousPermission(p));
    risk += dangerousPerms.length * 25;

    if (dangerousPerms.includes('Administrator')) {
      risk += 100;
    }
  }

  if (executor.id === target.id) {
    risk += 10;
  }

  return Math.min(risk, 100);
}

export async function handleMemberUpdate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, auditCorrelator, whitelistManager, ownerManager } = context;

  try {
    const config = await database.getConfig(event.newMember.guild.id);
    if (!config?.modules?.antimemberrole?.enabled) return;

    const { oldMember, newMember } = event;
    if (!oldMember || !newMember) return;

    const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

    if (addedRoles.size === 0 && removedRoles.size === 0) return;

    const executorId = await auditCorrelator.resolveExecutor(newMember.guild, 'MEMBER_ROLE_UPDATE', newMember.id);
    if (!executorId) return;

    if (await whitelistManager.isWhitelisted(newMember.guild.id, executorId)) return;
    if (await ownerManager.isExtraOwner(newMember.guild.id, executorId)) return;

    const rateLimitKey = `role_update_${executorId}_${newMember.id}`;
    if (checkRateLimit(rateLimitKey)) {
      console.log(`[Security] Rate limit exceeded for role changes: ${executorId} -> ${newMember.id}`);

      await Promise.all([
        punishmentEngine.punish(newMember.guild.id, executorId, 'BAN', 'Luna: Mass role assignment detected').catch(e => {
          console.log(`[Security] Failed to punish: ${e.message}`);
          return null;
        }),
        incidentEngine.create(newMember.guild.id, 'antimemberrole', 'rate_limit_role_change', executorId, newMember.id, 'high', 80, {
          addedRoles: [...addedRoles.values()].map(r => r.id),
          removedRoles: [...removedRoles.values()].map(r => r.id)
        }, 'ban')
      ]);
      return;
    }

    if (addedRoles.size > 0) {
      const addedRoleIds = [...addedRoles.values()].map(r => r.id);
      const riskScore = calculateRiskScore(executor, newMember, addedRoleIds, 'ADD');

      const dangerousAdded = addedRoles.filter(r => {
        const perms = getPermissionNames(r.permissions);
        return perms.some(p => isDangerousPermission(p));
      });

      if (dangerousAdded.size > 0) {
        console.log(`[Security] Dangerous role assignment: ${executorId} assigned ${dangerousAdded.size} dangerous roles to ${newMember.id}`);

        const punishmentType = riskScore >= 80 ? 'BAN' : riskScore >= 50 ? 'TIMEOUT' : 'KICK';

        await Promise.all([
          punishmentEngine.punish(newMember.guild.id, executorId, punishmentType, `Luna: Unauthorized role assignment - Risk: ${riskScore}`).catch(e => {
            console.log(`[Security] Failed to punish: ${e.message}`);
            return null;
          }),
          incidentEngine.create(newMember.guild.id, 'antimemberrole', 'dangerous_role_assignment', executorId, newMember.id, riskScore >= 80 ? 'critical' : 'high', riskScore, {
            addedRoles: addedRoleIds,
            dangerousRoles: [...dangerousAdded.values()].map(r => ({
              id: r.id,
              name: r.name,
              permissions: getPermissionNames(r.permissions)
            }))
          }, punishmentType)
        ]);
      }
    }

    if (removedRoles.size > 0) {
      const removedRoleIds = [...removedRoles.values()].map(r => r.id);
      const riskScore = calculateRiskScore(executor, newMember, removedRoleIds, 'REMOVE');

      if (riskScore >= 50) {
        console.log(`[Security] Suspicious role removal: ${executorId} removed ${removedRoles.size} roles from ${newMember.id}`);

        await incidentEngine.create(newMember.guild.id, 'antimemberrole', 'suspicious_role_removal', executorId, newMember.id, 'medium', riskScore, {
          removedRoles: removedRoleIds
        }, 'log');
      }
    }
  } catch (error) {
    console.log(`[Security] Error in antimemberrole handler: ${error.message}`);
  }
}

export async function handleMemberAdd(event, context) {
  const { client, cache, database, incidentEngine } = context;

  try {
    const config = await database.getConfig(event.member.guild.id);
    if (!config?.modules?.antimemberrole?.enabled) return;

    const { member } = event;
    if (!member) return;

    const autoRoles = cache.get(member.guild.id).autoRoles || [];
    if (autoRoles.length === 0) return;

    for (const roleId of autoRoles) {
      const role = member.guild.roles.cache.get(roleId);
      if (!role) continue;

      const perms = getPermissionNames(role.permissions);
      if (perms.some(p => isDangerousPermission(p))) {
        console.log(`[Security] Dangerous auto-role on join: ${member.id} received ${role.name}`);
        await member.roles.remove(roleId, 'Luna: Dangerous auto-role removal').catch(() => {});

        await incidentEngine.create(member.guild.id, 'antimemberrole', 'dangerous_auto_role', member.id, member.id, 'high', 60, {
          roleId,
          roleName: role.name,
          autoRoles
        }, 'remove_role');
      }
    }
  } catch (error) {
    console.log(`[Security] Error in antimemberrole member add: ${error.message}`);
  }
}
