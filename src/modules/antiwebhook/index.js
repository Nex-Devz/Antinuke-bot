import { calculateWebhookRisk } from '../../security/RiskEngine.js';

export async function handleWebhookCreate(event, context) {
    const { client, cache, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
    const guild = event.guild;
    const guildId = guild.id;
    const config = cache.get(guildId).config;

    if (!config?.antiWebhook?.enabled) return;

    const executorId = event.executorId || await auditCorrelator.resolveExecutor(guild, 'WEBHOOK_CREATE', event.webhook.id);

    if (executorId) {
        if (whitelistManager.isWhitelisted(guildId, executorId, 'WEBHOOK_CREATE')) return;
        if (ownerManager.isOwner(guildId, executorId)) return;
    }

    if (!cache.checkRateLimit(guildId, 'webhook:create', config.antiWebhook.thresholds?.maxPerMinute || 2, 60000)) {
        const risk = calculateWebhookRisk('create', guild.webhooks?.cache?.size || 0);
        console.log(`[Security] Mass webhook creation detected in ${guild.name} (risk: ${risk})`);

        if (executorId) {
            const action = config.antiWebhook.actions?.punish || 'ban';
            await punishmentEngine.punish(guildId, executorId, action, 'Elu: Mass webhook creation');
        }

        await incidentEngine.create(guildId, 'antiWebhook', 'MASS_CREATE', executorId, event.webhook.id, 'high', risk, { webhookCount: guild.webhooks?.cache?.size }, action);
    }

    if (config.antiWebhook.actions?.delete) {
        try {
            await event.webhook.delete('Elu: Webhook creation blocked');
            console.log(`[Security] Deleted webhook ${event.webhook.name} in ${guild.name}`);
        } catch (err) {
            console.log(`[Security] Failed to delete webhook: ${err.message}`);
        }
    }

    await snapshotManager.takeWebhookSnapshot(guildId, event.webhook.id);
    console.log(`[Security] Webhook created: ${event.webhook.name} in ${guild.name}`);
}

export async function handleWebhookDelete(event, context) {
    const { client, cache, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
    const guild = event.guild;
    const guildId = guild.id;
    const config = cache.get(guildId).config;

    if (!config?.antiWebhook?.enabled) return;

    const executorId = event.executorId || await auditCorrelator.resolveExecutor(guild, 'WEBHOOK_DELETE', event.webhookId);

    if (executorId) {
        if (whitelistManager.isWhitelisted(guildId, executorId, 'WEBHOOK_DELETE')) return;
        if (ownerManager.isOwner(guildId, executorId)) return;
    }

    if (!cache.checkRateLimit(guildId, 'webhook:delete', config.antiWebhook.thresholds?.maxPerMinute || 2, 60000)) {
        const risk = calculateWebhookRisk('delete', 0);
        console.log(`[Security] Mass webhook deletion detected in ${guild.name} (risk: ${risk})`);

        if (executorId) {
            const action = config.antiWebhook.actions?.punish || 'ban';
            await punishmentEngine.punish(guildId, executorId, action, 'Elu: Mass webhook deletion');
        }

        await incidentEngine.create(guildId, 'antiWebhook', 'MASS_DELETE', executorId, event.webhookId, 'high', risk, { remaining: guild.webhooks?.cache?.size || 0 }, action);
    }

    if (cache.isProtectedWebhook(guildId, event.webhookId)) {
        const snapshot = await snapshotManager.getSnapshot(guildId, `webhook:${event.webhookId}`);
        if (snapshot) {
            await snapshotManager.restoreWebhook(guildId, snapshot);
            console.log(`[Security] Restored protected webhook ${event.webhookId} in ${guild.name}`);
        }
    }

    console.log(`[Security] Webhook deleted: ${event.webhookId} in ${guild.name}`);
}

export async function handleWebhookUpdate(event, context) {
    const { client, cache, incidentEngine, punishmentEngine, auditCorrelator, whitelistManager, ownerManager } = context;
    const guild = event.guild;
    const guildId = guild.id;
    const config = cache.get(guildId).config;

    if (!config?.antiWebhook?.enabled) return;

    const executorId = event.executorId || await auditCorrelator.resolveExecutor(guild, 'WEBHOOK_UPDATE', event.webhook.id);

    if (executorId) {
        if (whitelistManager.isWhitelisted(guildId, executorId, 'WEBHOOK_UPDATE')) return;
        if (ownerManager.isOwner(guildId, executorId)) return;
    }

    const dangerousChanges = [];
    if (event.changes) {
        for (const change of event.changes) {
            if (change.key === 'channel_id') dangerousChanges.push('channel');
            if (change.key === 'name') dangerousChanges.push('name');
            if (change.key === 'avatar') dangerousChanges.push('avatar');
        }
    }

    if (dangerousChanges.length > 0) {
        const risk = calculateWebhookRisk('update', 0);
        console.log(`[Security] Dangerous webhook update in ${guild.name}: ${dangerousChanges.join(', ')} (risk: ${risk})`);

        if (executorId) {
            const action = config.antiWebhook.actions?.punish || 'ban';
            await punishmentEngine.punish(guildId, executorId, action, 'Elu: Dangerous webhook update');
        }

        await incidentEngine.create(guildId, 'antiWebhook', 'DANGEROUS_UPDATE', executorId, event.webhook.id, 'medium', risk, { changes: dangerousChanges }, action);
    }

    console.log(`[Security] Webhook updated: ${event.webhook.name} in ${guild.name}`);
}
