const DEFAULT_THRESHOLDS = {
    window10s: { max: 5, windowMs: 10000 },
    window30s: { max: 10, windowMs: 30000 },
    window60s: { max: 20, windowMs: 60000 }
};

export async function handleKickRemove(event, context) {
    const { client, cache, incidentEngine, punishmentEngine, auditCorrelator, whitelistManager, ownerManager } = context;
    const guild = event.guild;
    const guildId = guild?.id;
    if (!guildId) return;

    const guildData = cache.get(guildId);
    if (!guildData) return;
    const config = guildData.config;
    if (!config?.antiKick?.enabled) return;

    try {
        const executorId = event.executorId || await auditCorrelator.resolveKickExecutor(guild, event.targetId);

        if (executorId) {
            if (whitelistManager.isWhitelisted(guildId, executorId, 'MEMBER_KICK')) return;
            if (ownerManager.isOwner(guildId, executorId)) return;
        }

        const thresholds = config.antiKick.thresholds || DEFAULT_THRESHOLDS;
        const key = `kick:${executorId || 'unknown'}`;

        let exceeded = false;
        let risk = 0;

        if (!cache.checkRateLimit(guildId, `${key}:10s`, thresholds.window10s?.max || 5, thresholds.window10s?.windowMs || 10000)) {
            exceeded = true;
            risk = 85;
        } else if (!cache.checkRateLimit(guildId, `${key}:30s`, thresholds.window30s?.max || 10, thresholds.window30s?.windowMs || 30000)) {
            exceeded = true;
            risk = 70;
        } else if (!cache.checkRateLimit(guildId, `${key}:60s`, thresholds.window60s?.max || 20, thresholds.window60s?.windowMs || 60000)) {
            exceeded = true;
            risk = 55;
        }

        if (exceeded && executorId) {
            console.log(`[Security] Mass kick detected from ${executorId} in ${guild.name} (risk: ${risk})`);

            const action = config.antiKick.actions?.punish || 'ban';
            await punishmentEngine.punish(guildId, executorId, action, 'Luna: Mass kick detected');

            await incidentEngine.create(guildId, 'antikick', 'MASS_KICK', executorId, event.targetId, 'high', risk, { kickCount: (guildData.rateLimits?.get(`${key}:10s`)?.count || 1) }, action);
        }

        console.log(`[Security] Kick removed: ${event.targetId} in ${guild.name}`);
    } catch (err) {
        console.error(`[Security] Error in handleKickRemove for guild ${guildId}:`, err);
    }
}
