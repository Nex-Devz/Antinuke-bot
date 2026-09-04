export async function handleWebhookUpdate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, auditCorrelator, whitelistManager, ownerManager } = context;
  const guild = event.guild;
  if (!guild) return;
  const guildId = guild.id;

  const config = await database.getConfig(guildId);
  if (!config?.modules?.antiwebhook?.enabled) return;

  const webhooks = await guild.fetchWebhooks().catch(() => []);
  if (!webhooks || webhooks.size === 0) return;

  for (const [, webhook] of webhooks) {
    const executorId = await auditCorrelator.resolveExecutor(guild, 'WEBHOOK_CREATE', webhook.id);

    if (!executorId) continue;
    if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
    if (await ownerManager.isExtraOwner(guildId, executorId)) return;

    console.log(`[Security] Webhook created: ${webhook.name} in ${guild.name} by ${executorId}`);

    const actions = config.modules.antiwebhook.actions || {};
    const reason = `Luna: Unauthorized webhook creation: ${webhook.name}`;

    const tasks = [];

    if (actions.delete) {
      tasks.push(webhook.delete(reason).catch(e => {
        console.log(`[Security] Failed to delete webhook: ${e.message}`);
        return null;
      }));
    }

    if (actions.punish) {
      tasks.push(punishmentEngine.punish(guildId, executorId, actions.punish, reason).catch(e => {
        console.log(`[Security] Failed to punish ${executorId}: ${e.message}`);
        return null;
      }));
    }

    tasks.push(incidentEngine.create(guildId, 'antiwebhook', 'webhook_create', executorId, webhook.id, 'critical', 75, {
      webhookName: webhook.name
    }, 'delete_and_punish'));

    await Promise.all(tasks);
    return;
  }
}
