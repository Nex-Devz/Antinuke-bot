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

const PROTECTED_ROLE_IDS = [];

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

function isProtectedRole(roleId) {
  return PROTECTED_ROLE_IDS.includes(roleId);
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

    if (isProtectedRole(roleId)) {
      risk += 40;
    }

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
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;

  try {
    const config = cache.get('config');
    if (!config?.modules?.antimemberrole?.enabled) {
      return;
    }

    const { oldMember, newMember } = event;
    if (!oldMember || !newMember) return;

    const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

    if (addedRoles.size === 0 && removedRoles.size === 0) return;

    const auditLog = await auditCorrelator.getRecentAuditLogs(newMember.guild, {
      type: 'MEMBER_ROLE_UPDATE',
      limit: 5
    });

    const executor = auditLog.entries.first()?.executor;
    if (!executor) return;

    if (whitelistManager.isWhitelisted(executor.id)) return;
    if (await ownerManager.isExtraOwner(executor.id)) return;

    const rateLimitKey = `role_update_${executor.id}_${newMember.id}`;
    if (checkRateLimit(rateLimitKey)) {
      console.log(`[Security] Rate limit exceeded for role changes: ${executor.id} -> ${newMember.id}`);

      await punishmentEngine.apply(newMember.guild, {
        type: 'TEMPBAN',
        moderator: client.user,
        reason: 'Mass role assignment detected - rate limit exceeded',
        duration: 86400000,
        target: newMember
      });

      await incidentEngine.log({
        type: 'RATE_LIMIT_ROLE_CHANGE',
        severity: 'HIGH',
        executor: executor.id,
        target: newMember.id,
        guild: newMember.guild.id,
        details: {
          addedRoles: [...addedRoles.values()].map(r => r.id),
          removedRoles: [...removedRoles.values()].map(r => r.id)
        }
      });
      return;
    }

    if (addedRoles.size > 0) {
      const addedRoleIds = [...addedRoles.values()].map(r => r.id);
      const riskScore = calculateRiskScore(executor, newMember, addedRoleIds, 'ADD');

      const dangerousAdded = addedRoles.filter(r => {
        const perms = getPermissionNames(r.permissions);
        return perms.some(p => isDangerousPermission(p));
      });

      const protectedAdded = addedRoles.filter(r => isProtectedRole(r.id));

      if (dangerousAdded.size > 0 || protectedAdded.size > 0) {
        console.log(`[Security] Dangerous role assignment detected: ${executor.id} assigned ${dangerousAdded.size} dangerous roles to ${newMember.id}`);

        const punishmentType = riskScore >= 80 ? 'BAN' : riskScore >= 50 ? 'TEMPBAN' : 'KICK';

        await punishmentEngine.apply(newMember.guild, {
          type: punishmentType,
          moderator: client.user,
          reason: `Unauthorized role assignment - Risk: ${riskScore}`,
          duration: punishmentType === 'TEMPBAN' ? 86400000 : undefined,
          target: newMember
        });

        await incidentEngine.log({
          type: 'DANGEROUS_ROLE_ASSIGNMENT',
          severity: riskScore >= 80 ? 'CRITICAL' : 'HIGH',
          executor: executor.id,
          target: newMember.id,
          guild: newMember.guild.id,
          riskScore,
          details: {
            addedRoles: addedRoleIds,
            dangerousRoles: [...dangerousAdded.values()].map(r => ({
              id: r.id,
              name: r.name,
              permissions: getPermissionNames(r.permissions)
            })),
            protectedRoles: [...protectedAdded.values()].map(r => r.id)
          }
        });
      }
    }

    if (removedRoles.size > 0) {
      const removedRoleIds = [...removedRoles.values()].map(r => r.id);
      const riskScore = calculateRiskScore(executor, newMember, removedRoleIds, 'REMOVE');

      const protectedRemoved = removedRoles.filter(r => isProtectedRole(r.id));

      if (protectedRemoved.size > 0 || riskScore >= 50) {
        console.log(`[Security] Suspicious role removal detected: ${executor.id} removed ${removedRoles.size} roles from ${newMember.id}`);

        await incidentEngine.log({
          type: 'SUSPICIOUS_ROLE_REMOVAL',
          severity: 'MEDIUM',
          executor: executor.id,
          target: newMember.id,
          guild: newMember.guild.id,
          riskScore,
          details: {
            removedRoles: removedRoleIds,
            protectedRoles: [...protectedRemoved.values()].map(r => r.id)
          }
        });
      }
    }
  } catch (error) {
    console.log(`[Security] Error in antimemberrole handler: ${error.message}`);
  }
}

export async function handleMemberAdd(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;

  try {
    const config = cache.get('config');
    if (!config?.modules?.antimemberrole?.enabled) {
      return;
    }

    const { member } = event;
    if (!member) return;

    const autoRoles = cache.get('autoRoles') || [];
    if (autoRoles.length === 0) return;

    const dangerousAutoRoles = autoRoles.filter(roleId => {
      const role = member.guild.roles.cache.get(roleId);
      if (!role) return false;

      const permissions = getPermissionNames(role.permissions);
      return permissions.some(p => isDangerousPermission(p));
    });

    if (dangerousAutoRoles.length > 0) {
      console.log(`[Security] Dangerous auto-role assigned on join: ${member.id} received ${dangerousAutoRoles.length} dangerous roles`);

      for (const roleId of dangerousAutoRoles) {
        try {
          await member.roles.remove(roleId, 'AntiN8: Dangerous auto-role removal');
        } catch (err) {
          console.log(`[Security] Failed to remove dangerous auto-role ${roleId}: ${err.message}`);
        }
      }

      await incidentEngine.log({
        type: 'DANGEROUS_AUTO_ROLE',
        severity: 'HIGH',
        target: member.id,
        guild: member.guild.id,
        details: {
          dangerousRoles: dangerousAutoRoles,
          autoRoles
        }
      });
    }
  } catch (error) {
    console.log(`[Security] Error in antimemberrole member add handler: ${error.message}`);
  }
}
