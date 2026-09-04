export async function handleWebhookUpdate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const guild = event.guild;
  if (!guild) return;
  const guildId = guild.id;

  const config = await database.getConfig(guildId);
  if (!config?.modules?.antiwebhook?.enabled) return;

  const webhooks = await guild.fetchWebhooks().catch(() => []);
  if (!webhooks || webhooks.size === 0) return;

  for (const [, webhook] of webhooks) {
    const executorId = await auditCorrelator.resolveExecutor(guild, 'WEBHOOK_CREATE', webhook.id);

    if (executorId) {
      if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
      if (await ownerManager.isExtraOwner(guildId, executorId)) return;

      console.log(`[Security] Webhook created: ${webhook.name} in ${guild.name} by ${executorId}`);

      const risk = 75;
      const actions = config.modules.antiwebhook.actions || {};

      if (actions.delete) {
        await webhook.delete('Luna: Unauthorized webhook creation').catch(e => console.log(`[Security] Failed to delete webhook: ${e.message}`));
        console.log(`[Security] Deleted unauthorized webhook: ${webhook.name}`);
      }

      if (actions.punish) {
        await punishmentEngine.punish(guildId, executorId, actions.punish, `Unauthorized webhook creation: ${webhook.name}`);
      }

      await incidentEngine.create(guildId, 'antiWebhook', 'webhook_create', executorId, webhook.id, 'critical', risk, { webhookName: webhook.name }, 'delete_and_punish');
    }
  }
}
