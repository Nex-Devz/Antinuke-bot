const DANGEROUS_AUTOMOD_ACTIONS = [
  'BLOCK_MESSAGE',
  'SEND_ALERT_MESSAGE',
  'TIMEOUT'
];

const PROTECTED_RULE_TYPES = [
  'SPAM',
  'HARMFUL_LINK',
  'KEYWORD',
  'MENTION_SPAM'
];

function calculateRuleRisk(rule) {
  let risk = 0;

  if (rule.actions && rule.actions.length > 0) {
    const hasBlock = rule.actions.some(a => a.type === 0);
    const hasTimeout = rule.actions.some(a => a.type === 2);
    const hasAlert = rule.actions.some(a => a.type === 1);

    if (hasBlock) risk += 25;
    if (hasTimeout) risk += 30;
    if (hasAlert) risk += 15;
  }

  if (rule.trigger_type === 4) {
    risk += 20;
  }

  if (rule.exempt_roles && rule.exempt_roles.length > 0) {
    risk += 15;
  }

  if (rule.exempt_channels && rule.exempt_channels.length > 0) {
    risk += 10;
  }

  return Math.min(risk, 100);
}

async function getAutomodExecutor(guild, ruleId, auditCorrelator) {
  try {
    const auditLog = await auditCorrelator.getRecentAuditLogs(guild, {
      type: 'AUTO_MODERATION_BLOCK_MESSAGE',
      limit: 5
    });

    const entry = auditLog.entries.find(e => e.changes?.some(c => c.key === 'id' && c.new_value === ruleId));
    if (entry) return entry.executor;

    const createAuditLog = await auditCorrelator.getRecentAuditLogs(guild, {
      type: 'AUTO_MODERATION_BLOCK_MESSAGE',
      limit: 10
    });

    return createAuditLog.entries.first()?.executor || null;
  } catch (error) {
    console.log(`[Security] Failed to get automod executor: ${error.message}`);
    return null;
  }
}

async function deleteAutomodRule(guild, ruleId, client, reason) {
  try {
    await guild.autoModerationRules.delete(ruleId, reason);
    console.log(`[Security] Deleted automod rule: ${ruleId}`);
    return true;
  } catch (error) {
    console.log(`[Security] Failed to delete automod rule ${ruleId}: ${error.message}`);
    return false;
  }
}

export async function handleAutoModRuleCreate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;

  try {
    const config = cache.get('config');
    if (!config?.modules?.antiautomod?.enabled) {
      return;
    }

    const { rule } = event;
    if (!rule) return;

    const executor = await getAutomodExecutor(rule.guild, rule.id, auditCorrelator);
    if (!executor) {
      console.log(`[Security] Unable to determine automod rule creator for ${rule.id}`);
      return;
    }

    if (whitelistManager.isWhitelisted(executor.id)) return;
    if (await ownerManager.isExtraOwner(executor.id)) return;

    const riskScore = calculateRuleRisk(rule);

    if (riskScore >= 50 || rule.trigger_type === 4) {
      console.log(`[Security] Suspicious automod rule created by ${executor.id}: Risk ${riskScore}`);

      if (config?.antiautomod?.auto_delete) {
        await deleteAutomodRule(rule.guild, rule.id, client, 'AntiN8: Suspicious automod rule');
      }

      const punishmentType = riskScore >= 70 ? 'BAN' : riskScore >= 50 ? 'TEMPBAN' : 'KICK';

      await punishmentEngine.apply(rule.guild, {
        type: punishmentType,
        moderator: client.user,
        reason: `Suspicious automod rule creation - Risk: ${riskScore}`,
        duration: punishmentType === 'TEMPBAN' ? 86400000 : undefined,
        target: executor
      });

      await incidentEngine.log({
        type: 'SUSPICIOUS_AUTOMOD_CREATE',
        severity: riskScore >= 70 ? 'CRITICAL' : 'HIGH',
        executor: executor.id,
        guild: rule.guild.id,
        riskScore,
        details: {
          ruleId: rule.id,
          ruleName: rule.name,
          triggerType: rule.trigger_type,
          actions: rule.actions,
          exemptRoles: rule.exempt_roles,
          exemptChannels: rule.exempt_channels
        }
      });
    }
  } catch (error) {
    console.log(`[Security] Error in antiautomod rule create handler: ${error.message}`);
  }
}

export async function handleAutoModRuleUpdate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;

  try {
    const config = cache.get('config');
    if (!config?.modules?.antiautomod?.enabled) {
      return;
    }

    const { oldRule, newRule } = event;
    if (!oldRule || !newRule) return;

    const executor = await getAutomodExecutor(newRule.guild, newRule.id, auditCorrelator);
    if (!executor) return;

    if (whitelistManager.isWhitelisted(executor.id)) return;
    if (await ownerManager.isExtraOwner(executor.id)) return;

    const oldRisk = calculateRuleRisk(oldRule);
    const newRisk = calculateRuleRisk(newRule);
    const riskIncrease = newRisk - oldRisk;

    const oldActions = oldRule.actions?.map(a => a.type) || [];
    const newActions = newRule.actions?.map(a => a.type) || [];
    const addedActions = newActions.filter(a => !oldActions.includes(a));

    const hasNewDangerousAction = addedActions.some(a => DANGEROUS_AUTOMOD_ACTIONS.includes(a));

    if (hasNewDangerousAction || riskIncrease >= 30 || newRule.trigger_type === 4) {
      console.log(`[Security] Suspicious automod rule update by ${executor.id}: Risk increase ${riskIncrease}`);

      if (config?.antiautomod?.auto_revert) {
        try {
          await newRule.edit({
            actions: oldRule.actions,
            trigger_metadata: oldRule.trigger_metadata,
            exempt_roles: oldRule.exempt_roles,
            exempt_channels: oldRule.exempt_channels,
            enabled: oldRule.enabled
          }, 'AntiN8: Reverting suspicious automod changes');
          console.log(`[Security] Reverted automod rule changes for ${newRule.id}`);
        } catch (error) {
          console.log(`[Security] Failed to revert automod rule: ${error.message}`);
        }
      }

      const punishmentType = riskIncrease >= 50 ? 'BAN' : 'TEMPBAN';

      await punishmentEngine.apply(newRule.guild, {
        type: punishmentType,
        moderator: client.user,
        reason: `Suspicious automod rule modification - Risk increase: ${riskIncrease}`,
        duration: 86400000,
        target: executor
      });

      await incidentEngine.log({
        type: 'SUSPICIOUS_AUTOMOD_UPDATE',
        severity: riskIncrease >= 50 ? 'CRITICAL' : 'HIGH',
        executor: executor.id,
        guild: newRule.guild.id,
        riskScore: newRisk,
        riskIncrease,
        details: {
          ruleId: newRule.id,
          ruleName: newRule.name,
          triggerType: newRule.trigger_type,
          previousActions: oldRule.actions,
          currentActions: newRule.actions,
          addedActions,
          exemptRoles: newRule.exempt_roles,
          exemptChannels: newRule.exempt_channels
        }
      });
    }
  } catch (error) {
    console.log(`[Security] Error in antiautomod rule update handler: ${error.message}`);
  }
}

export async function handleAutoModRuleDelete(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;

  try {
    const config = cache.get('config');
    if (!config?.modules?.antiautomod?.enabled) {
      return;
    }

    const { rule } = event;
    if (!rule) return;

    if (PROTECTED_RULE_TYPES.includes(rule.trigger_type)) {
      const executor = await getAutomodExecutor(rule.guild, rule.id, auditCorrelator);

      if (executor) {
        if (whitelistManager.isWhitelisted(executor.id)) return;
        if (await ownerManager.isExtraOwner(executor.id)) return;

        console.log(`[Security] Protected automod rule deleted by ${executor.id}: ${rule.name}`);

        await punishmentEngine.apply(rule.guild, {
          type: 'BAN',
          moderator: client.user,
          reason: `Deletion of protected automod rule: ${rule.name}`,
          target: executor
        });

        await incidentEngine.log({
          type: 'PROTECTED_AUTOMOD_DELETE',
          severity: 'CRITICAL',
          executor: executor.id,
          guild: rule.guild.id,
          details: {
            ruleId: rule.id,
            ruleName: rule.name,
            triggerType: rule.trigger_type,
            actions: rule.actions,
            exemptRoles: rule.exempt_roles,
            exemptChannels: rule.exempt_channels
          }
        });
      }
    }
  } catch (error) {
    console.log(`[Security] Error in antiautomod rule delete handler: ${error.message}`);
  }
}
