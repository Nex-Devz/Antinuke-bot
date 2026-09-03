export async function handleEmojiCreate(event, context) {
    const { client, cache, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
    const guild = event.guild;
    const guildId = guild.id;
    const config = cache.get(guildId).config;

    if (!config?.antiEmoji?.enabled) return;

    const executorId = event.executorId || await auditCorrelator.resolveExecutor(guild, 'EMOJI_CREATE', event.emoji.id);

    if (executorId) {
        if (whitelistManager.isWhitelisted(guildId, executorId, 'EMOJI_CREATE')) return;
        if (ownerManager.isOwner(guildId, executorId)) return;
    }

    if (!cache.checkRateLimit(guildId, 'emoji:create', config.antiEmoji.thresholds?.maxPerMinute || 5, 60000)) {
        const risk = 60;
        console.log(`[Security] Emoji spam detected in ${guild.name} (risk: ${risk})`);

        if (executorId) {
            const action = config.antiEmoji.actions?.punish || 'kick';
            await punishmentEngine.punish(guildId, executorId, action, 'Luna: Emoji spam');
        }

        await incidentEngine.create(guildId, 'antiEmoji', 'SPAM', executorId, event.emoji.id, 'medium', risk, { emojiName: event.emoji.name }, action);
    }

    await snapshotManager.takeEmojiSnapshot(guildId, event.emoji.id);
    console.log(`[Security] Emoji created: ${event.emoji.name} in ${guild.name}`);
}

export async function handleEmojiDelete(event, context) {
    const { client, cache, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
    const guild = event.guild;
    const guildId = guild.id;
    const config = cache.get(guildId).config;

    if (!config?.antiEmoji?.enabled) return;

    const executorId = event.executorId || await auditCorrelator.resolveExecutor(guild, 'EMOJI_DELETE', event.emojiId);

    if (executorId) {
        if (whitelistManager.isWhitelisted(guildId, executorId, 'EMOJI_DELETE')) return;
        if (ownerManager.isOwner(guildId, executorId)) return;
    }

    if (!cache.checkRateLimit(guildId, 'emoji:delete', config.antiEmoji.thresholds?.maxPerMinute || 5, 60000)) {
        const risk = 55;
        console.log(`[Security] Mass emoji deletion in ${guild.name} (risk: ${risk})`);

        if (executorId) {
            const action = config.antiEmoji.actions?.punish || 'kick';
            await punishmentEngine.punish(guildId, executorId, action, 'Luna: Mass emoji deletion');
        }

        await incidentEngine.create(guildId, 'antiEmoji', 'MASS_DELETE', executorId, event.emojiId, 'medium', risk, { remaining: guild.emojis?.cache?.size || 0 }, action);
    }

    const snapshot = await snapshotManager.getSnapshot(guildId, `emoji:${event.emojiId}`);
    if (snapshot && config.antiEmoji.actions?.restore) {
        await snapshotManager.restoreEmoji(guildId, snapshot);
        console.log(`[Security] Restored emoji ${event.emojiId} in ${guild.name}`);
    }

    console.log(`[Security] Emoji deleted: ${event.emojiId} in ${guild.name}`);
}

export async function handleEmojiUpdate(event, context) {
    const { client, cache, incidentEngine, punishmentEngine, auditCorrelator, whitelistManager, ownerManager } = context;
    const guild = event.guild;
    const guildId = guild.id;
    const config = cache.get(guildId).config;

    if (!config?.antiEmoji?.enabled) return;

    const executorId = event.executorId || await auditCorrelator.resolveExecutor(guild, 'EMOJI_UPDATE', event.emoji.id);

    if (executorId) {
        if (whitelistManager.isWhitelisted(guildId, executorId, 'EMOJI_UPDATE')) return;
        if (ownerManager.isOwner(guildId, executorId)) return;
    }

    const changes = event.changes || [];
    const hasAbuse = changes.some(c => c.key === 'name' && c.newValue && (c.newValue.includes('@') || c.newValue.length > 32));

    if (hasAbuse) {
        const risk = 40;
        console.log(`[Security] Abusive emoji update in ${guild.name} (risk: ${risk})`);

        if (executorId) {
            const action = config.antiEmoji.actions?.punish || 'kick';
            await punishmentEngine.punish(guildId, executorId, action, 'Luna: Abusive emoji update');
        }

        await incidentEngine.create(guildId, 'antiEmoji', 'ABUSE', executorId, event.emoji.id, 'low', risk, { changes }, action);
    }

    console.log(`[Security] Emoji updated: ${event.emoji.name} in ${guild.name}`);
}
