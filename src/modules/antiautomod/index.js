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

  if (rule.trigger_type === 4) risk += 20;
  if (rule.exempt_roles && rule.exempt_roles.length > 0) risk += 15;
  if (rule.exempt_channels && rule.exempt_channels.length > 0) risk += 10;

  return Math.min(risk, 100);
}

async function deleteAutomodRule(guild, ruleId, reason) {
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
  const { client, cache, database, incidentEngine, punishmentEngine, auditCorrelator, whitelistManager, ownerManager } = context;

  try {
    const config = await database.getConfig(event.rule?.guild?.id);
    if (!config?.modules?.antiautomod?.enabled) return;

    const { rule } = event;
    if (!rule) return;

    const executorId = await auditCorrelator.resolveExecutor(rule.guild, 'AUTO_MODERATION_RULE_CREATE', rule.id).catch(() => null);
    if (!executorId) return;

    if (await whitelistManager.isWhitelisted(rule.guild.id, executorId)) return;
    if (await ownerManager.isExtraOwner(rule.guild.id, executorId)) return;

    const riskScore = calculateRuleRisk(rule);

    if (riskScore >= 50 || rule.trigger_type === 4) {
      console.log(`[Security] Suspicious automod rule created by ${executorId}: Risk ${riskScore}`);

      if (config?.modules?.antiautomod?.auto_delete) {
        await deleteAutomodRule(rule.guild, rule.id, 'Luna: Suspicious automod rule');
      }

      const punishmentType = riskScore >= 70 ? 'BAN' : riskScore >= 50 ? 'TIMEOUT' : 'KICK';

      await Promise.all([
        punishmentEngine.punish(rule.guild.id, executorId, punishmentType, `Luna: Suspicious automod rule - Risk: ${riskScore}`).catch(e => {
          console.log(`[Security] Failed to punish: ${e.message}`);
          return null;
        }),
        incidentEngine.create(rule.guild.id, 'antiautomod', 'rule_create', executorId, rule.id, riskScore >= 70 ? 'critical' : 'high', riskScore, {
          ruleId: rule.id,
          ruleName: rule.name,
          triggerType: rule.trigger_type
        }, punishmentType)
      ]);
    }
  } catch (error) {
    console.log(`[Security] Error in antiautomod rule create: ${error.message}`);
  }
}

export async function handleAutoModRuleUpdate(oldRule, newRule, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, auditCorrelator, whitelistManager, ownerManager } = context;

  try {
    const config = await database.getConfig(newRule?.guild?.id);
    if (!config?.modules?.antiautomod?.enabled) return;

    if (!oldRule || !newRule) return;

    const executorId = await auditCorrelator.resolveExecutor(newRule.guild, 'AUTO_MODERATION_RULE_UPDATE', newRule.id).catch(() => null);
    if (!executorId) return;

    if (await whitelistManager.isWhitelisted(newRule.guild.id, executorId)) return;
    if (await ownerManager.isExtraOwner(newRule.guild.id, executorId)) return;

    const oldRisk = calculateRuleRisk(oldRule);
    const newRisk = calculateRuleRisk(newRule);
    const riskIncrease = newRisk - oldRisk;

    const oldActions = oldRule.actions?.map(a => a.type) || [];
    const newActions = newRule.actions?.map(a => a.type) || [];
    const addedActions = newActions.filter(a => !oldActions.includes(a));
    const hasNewDangerousAction = addedActions.some(a => DANGEROUS_AUTOMOD_ACTIONS.includes(a));

    if (hasNewDangerousAction || riskIncrease >= 30 || newRule.trigger_type === 4) {
      console.log(`[Security] Suspicious automod rule update by ${executorId}: Risk increase ${riskIncrease}`);

      if (config?.modules?.antiautomod?.auto_revert) {
        try {
          await newRule.edit({
            actions: oldRule.actions,
            trigger_metadata: oldRule.trigger_metadata,
            exempt_roles: oldRule.exempt_roles,
            exempt_channels: oldRule.exempt_channels,
            enabled: oldRule.enabled
          }, 'Luna: Reverting suspicious automod changes');
        } catch (error) {
          console.log(`[Security] Failed to revert: ${error.message}`);
        }
      }

      const punishmentType = riskIncrease >= 50 ? 'BAN' : 'TIMEOUT';

      await Promise.all([
        punishmentEngine.punish(newRule.guild.id, executorId, punishmentType, `Luna: Suspicious automod update - Risk increase: ${riskIncrease}`).catch(e => {
          console.log(`[Security] Failed to punish: ${e.message}`);
          return null;
        }),
        incidentEngine.create(newRule.guild.id, 'antiautomod', 'rule_update', executorId, newRule.id, riskIncrease >= 50 ? 'critical' : 'high', newRisk, {
          ruleId: newRule.id,
          ruleName: newRule.name,
          riskIncrease,
          addedActions
        }, punishmentType)
      ]);
    }
  } catch (error) {
    console.log(`[Security] Error in antiautomod rule update: ${error.message}`);
  }
}

export async function handleAutoModRuleDelete(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, auditCorrelator, whitelistManager, ownerManager } = context;

  try {
    const config = await database.getConfig(event.rule?.guild?.id);
    if (!config?.modules?.antiautomod?.enabled) return;

    const { rule } = event;
    if (!rule) return;

    if (!PROTECTED_RULE_TYPES.includes(rule.trigger_type)) return;

    const executorId = await auditCorrelator.resolveExecutor(rule.guild, 'AUTO_MODERATION_RULE_DELETE', rule.id).catch(() => null);
    if (!executorId) return;

    if (await whitelistManager.isWhitelisted(rule.guild.id, executorId)) return;
    if (await ownerManager.isExtraOwner(rule.guild.id, executorId)) return;

    console.log(`[Security] Protected automod rule deleted by ${executorId}: ${rule.name}`);

    await Promise.all([
      punishmentEngine.punish(rule.guild.id, executorId, 'BAN', `Luna: Deletion of protected automod rule: ${rule.name}`).catch(e => {
        console.log(`[Security] Failed to punish: ${e.message}`);
        return null;
      }),
      incidentEngine.create(rule.guild.id, 'antiautomod', 'rule_delete', executorId, rule.id, 'critical', 90, {
        ruleId: rule.id,
        ruleName: rule.name,
        triggerType: rule.trigger_type
      }, 'ban')
    ]);
  } catch (error) {
    console.log(`[Security] Error in antiautomod rule delete: ${error.message}`);
  }
}
