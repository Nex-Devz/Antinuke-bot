const SAFE_INTEGRATION_PERMISSIONS = [
  'SEND_MESSAGES',
  'READ_MESSAGES',
  'EMBED_LINKS',
  'ATTACH_FILES',
  'USE_EXTERNAL_EMOJIS'
];

const DANGEROUS_INTEGRATION_PERMISSIONS = [
  'ADMINISTRATOR',
  'MANAGE_GUILD',
  'MANAGE_CHANNELS',
  'MANAGE_ROLES',
  'MANAGE_WEBHOOKS',
  'MANAGE_MESSAGES',
  'BAN_MEMBERS',
  'KICK_MEMBERS',
  'MANAGE_NICKNAMES',
  'MANAGE_EMOJIS',
  'MANAGE_THREADS'
];

function getPermissionNames(permissions) {
  if (typeof permissions === 'string') {
    return permissions.split(',').map(p => p.trim());
  }

  if (Array.isArray(permissions)) {
    return permissions;
  }

  return [];
}

function hasDangerousIntegrationPermissions(permissions) {
  const permNames = getPermissionNames(permissions);
  return permNames.some(p => DANGEROUS_INTEGRATION_PERMISSIONS.includes(p));
}

function calculateIntegrationRisk(integration) {
  let risk = 0;

  const permissions = getPermissionNames(integration.permissions || integration.scopes);

  const dangerousPerms = permissions.filter(p => DANGEROUS_INTEGRATION_PERMISSIONS.includes(p));
  risk += dangerousPerms.length * 30;

  if (integration.type === 'webhook') {
    risk += 20;
  }

  if (integration.application) {
    risk += 10;
  }

  return Math.min(risk, 100);
}

export async function handleIntegrationUpdate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;

  try {
    const config = cache.get('config');
    if (!config?.modules?.antiintegration?.enabled) {
      return;
    }

    const { oldIntegration, newIntegration } = event;
    if (!oldIntegration && !newIntegration) return;

    const integration = newIntegration || oldIntegration;
    if (!integration) return;

    const auditLog = await auditCorrelator.getRecentAuditLogs(integration.guild, {
      type: 'INTEGRATION_CREATE',
      limit: 10
    });

    let executor = null;
    const entries = auditLog.entries.filter(e => e.target?.id === integration.id);
    if (entries.size > 0) {
      executor = entries.first().executor;
    }

    if (!executor) {
      const updateAuditLog = await auditCorrelator.getRecentAuditLogs(integration.guild, {
        type: 'INTEGRATION_UPDATE',
        limit: 5
      });
      executor = updateAuditLog.entries.first()?.executor;
    }

    if (!executor) {
      console.log(`[Security] Unable to determine integration executor for ${integration.id}`);
      return;
    }

    if (whitelistManager.isWhitelisted(executor.id)) return;
    if (await ownerManager.isExtraOwner(executor.id)) return;

    if (oldIntegration && newIntegration) {
      const oldPerms = getPermissionNames(oldIntegration.permissions || oldIntegration.scopes);
      const newPerms = getPermissionNames(newIntegration.permissions || newIntegration.scopes);
      const addedPerms = newPerms.filter(p => !oldPerms.includes(p));

      if (addedPerms.length > 0 && hasDangerousIntegrationPermissions(addedPerms)) {
        console.log(`[Security] Dangerous integration permission escalation by ${executor.id}: ${addedPerms.join(', ')}`);

        await punishmentEngine.apply(integration.guild, {
          type: 'BAN',
          moderator: client.user,
          reason: `Unauthorized integration permission escalation: ${addedPerms.join(', ')}`,
          target: executor
        });

        await incidentEngine.log({
          type: 'INTEGRATION_PERMISSION_ESCALATION',
          severity: 'CRITICAL',
          executor: executor.id,
          guild: integration.guild.id,
          details: {
            integrationId: integration.id,
            integrationType: integration.type,
            addedPermissions: addedPerms,
            currentPermissions: newPerms
          }
        });
      }
    }

    if (!oldIntegration && newIntegration) {
      const riskScore = calculateIntegrationRisk(newIntegration);
      const permissions = getPermissionNames(newIntegration.permissions || newIntegration.scopes);
      const dangerousPerms = permissions.filter(p => DANGEROUS_INTEGRATION_PERMISSIONS.includes(p));

      if (dangerousPerms.length > 0 || riskScore >= 50) {
        console.log(`[Security] High risk integration created by ${executor.id}: Risk ${riskScore}`);

        if (riskScore >= 70) {
          await punishmentEngine.apply(integration.guild, {
            type: 'BAN',
            moderator: client.user,
            reason: `Unauthorized high-risk integration creation: Risk ${riskScore}`,
            target: executor
          });
        } else if (riskScore >= 50) {
          await punishmentEngine.apply(integration.guild, {
            type: 'TEMPBAN',
            moderator: client.user,
            reason: `Suspicious integration creation: Risk ${riskScore}`,
            duration: 86400000,
            target: executor
          });
        }

        await incidentEngine.log({
          type: 'HIGH_RISK_INTEGRATION',
          severity: riskScore >= 70 ? 'CRITICAL' : 'HIGH',
          executor: executor.id,
          guild: integration.guild.id,
          riskScore,
          details: {
            integrationId: newIntegration.id,
            integrationType: newIntegration.type,
            applicationName: newIntegration.application?.name,
            permissions: permissions,
            dangerousPermissions: dangerousPerms,
            scopes: newIntegration.scopes
          }
        });
      }
    }
  } catch (error) {
    console.log(`[Security] Error in antiintegration handler: ${error.message}`);
  }
}
