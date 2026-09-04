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
  if (typeof permissions === 'string') return permissions.split(',').map(p => p.trim());
  if (Array.isArray(permissions)) return permissions;
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

  if (integration.type === 'webhook') risk += 20;
  if (integration.application) risk += 10;

  return Math.min(risk, 100);
}

export async function handleIntegrationUpdate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, auditCorrelator, whitelistManager, ownerManager } = context;

  try {
    const guildId = event.newIntegration?.guild?.id || event.oldIntegration?.guild?.id;
    if (!guildId) return;

    const config = await database.getConfig(guildId);
    if (!config?.modules?.antiintegration?.enabled) return;

    const { oldIntegration, newIntegration } = event;
    if (!oldIntegration && !newIntegration) return;

    const integration = newIntegration || oldIntegration;
    if (!integration) return;

    const userId = integration.user?.id || integration.creatorId;
    if (!userId) return;
    if (await whitelistManager.isWhitelisted(guildId, userId)) return;
    if (await ownerManager.isExtraOwner(guildId, userId)) return;

    if (oldIntegration && newIntegration) {
      const oldPerms = getPermissionNames(oldIntegration.permissions || oldIntegration.scopes);
      const newPerms = getPermissionNames(newIntegration.permissions || newIntegration.scopes);
      const addedPerms = newPerms.filter(p => !oldPerms.includes(p));

      if (addedPerms.length > 0 && hasDangerousIntegrationPermissions(addedPerms)) {
        console.log(`[Security] Dangerous integration permission escalation by ${userId}: ${addedPerms.join(', ')}`);

        await Promise.all([
          punishmentEngine.punish(guildId, userId, 'BAN', `Luna: Unauthorized integration permission escalation: ${addedPerms.join(', ')}`).catch(e => {
            console.log(`[Security] Failed to punish: ${e.message}`);
            return null;
          }),
          incidentEngine.create(guildId, 'antiintegration', 'permission_escalation', userId, integration.id, 'critical', 95, {
            integrationId: integration.id,
            integrationType: integration.type,
            addedPermissions: addedPerms,
            currentPermissions: newPerms
          }, 'ban')
        ]);
      }
    }

    if (!oldIntegration && newIntegration) {
      const riskScore = calculateIntegrationRisk(newIntegration);
      const permissions = getPermissionNames(newIntegration.permissions || newIntegration.scopes);
      const dangerousPerms = permissions.filter(p => DANGEROUS_INTEGRATION_PERMISSIONS.includes(p));

      if (dangerousPerms.length > 0 || riskScore >= 50) {
        console.log(`[Security] High risk integration by ${userId}: Risk ${riskScore}`);

        const punishmentType = riskScore >= 70 ? 'BAN' : 'TIMEOUT';

        await Promise.all([
          punishmentEngine.punish(guildId, userId, punishmentType, `Luna: Unauthorized integration - Risk ${riskScore}`).catch(e => {
            console.log(`[Security] Failed to punish: ${e.message}`);
            return null;
          }),
          incidentEngine.create(guildId, 'antiintegration', 'high_risk_integration', userId, integration.id, riskScore >= 70 ? 'critical' : 'high', riskScore, {
            integrationType: integration.type,
            applicationName: integration.application?.name,
            permissions,
            dangerousPermissions: dangerousPerms,
            scopes: integration.scopes
          }, punishmentType)
        ]);
      }
    }
  } catch (error) {
    console.log(`[Security] Error in antiintegration: ${error.message}`);
  }
}