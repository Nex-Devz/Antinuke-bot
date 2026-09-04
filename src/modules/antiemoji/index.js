export async function handleEmojiCreate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const guild = event.guild;
  if (!guild) return;
  const guildId = guild.id;

  const config = cache.get(guildId)?.config;
  if (!config?.antiEmoji?.enabled) return;

  const executorId = event.executorId || await auditCorrelator.resolveExecutor(guild, 'EMOJI_CREATE', event.emoji.id);
  console.log(`[Security] Emoji created: ${event.emoji.name} in ${guild.name} by ${executorId || 'unknown'}`);

  if (executorId) {
    if (whitelistManager.isWhitelisted(guildId, executorId)) return;
    if (ownerManager.isOwner(guildId, executorId)) return;

    const risk = 75;
    const actions = config.antiEmoji.actions || {};
    await snapshotManager.takeEmojiSnapshot(guildId, event.emoji.id);

    if (actions.restore) {
      await event.emoji.delete('Luna: Unauthorized emoji creation').catch(e => console.log(`[Security] Failed to delete emoji: ${e.message}`));
      console.log(`[Security] Deleted unauthorized emoji: ${event.emoji.name}`);
    }

    if (actions.punish) {
      await punishmentEngine.punish(guildId, executorId, actions.punish, `Unauthorized emoji creation: ${event.emoji.name}`);
    }

    await incidentEngine.create(guildId, 'antiEmoji', 'emoji_create', executorId, event.emoji.id, 'critical', risk, { emojiName: event.emoji.name }, 'delete_and_punish');
  }
}

export async function handleEmojiDelete(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const guild = event.guild;
  if (!guild) return;
  const guildId = guild.id;

  const config = cache.get(guildId)?.config;
  if (!config?.antiEmoji?.enabled) return;

  const executorId = event.executorId || await auditCorrelator.resolveExecutor(guild, 'EMOJI_DELETE', event.emojiId);
  console.log(`[Security] Emoji deleted: ${event.emoji?.name || event.emojiId} in ${guild.name} by ${executorId || 'unknown'}`);

  if (executorId) {
    if (whitelistManager.isWhitelisted(guildId, executorId)) return;
    if (ownerManager.isOwner(guildId, executorId)) return;

    const risk = 75;
    const actions = config.antiEmoji.actions || {};

    if (actions.restore) {
      const snapshot = await snapshotManager.getSnapshot(guildId, `emoji:${event.emojiId}`);
      if (snapshot) {
        await snapshotManager.restoreEmoji(guildId, snapshot);
        console.log(`[Security] Restored emoji: ${snapshot.name}`);
      }
    }

    if (actions.punish) {
      await punishmentEngine.punish(guildId, executorId, actions.punish, `Unauthorized emoji deletion: ${event.emoji?.name || event.emojiId}`);
    }

    await incidentEngine.create(guildId, 'antiEmoji', 'emoji_delete', executorId, event.emojiId, 'critical', risk, { emojiName: event.emoji?.name }, 'restore_and_punish');
  }
}

export async function handleEmojiUpdate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, auditCorrelator, whitelistManager, ownerManager } = context;
  const guild = event.guild;
  if (!guild) return;
  const guildId = guild.id;

  const config = cache.get(guildId)?.config;
  if (!config?.antiEmoji?.enabled) return;

  const executorId = event.executorId || await auditCorrelator.resolveExecutor(guild, 'EMOJI_UPDATE', event.emoji.id);
  console.log(`[Security] Emoji updated: ${event.emoji.name} in ${guild.name} by ${executorId || 'unknown'}`);

  if (executorId) {
    if (whitelistManager.isWhitelisted(guildId, executorId)) return;
    if (ownerManager.isOwner(guildId, executorId)) return;

    const risk = 50;
    const actions = config.antiEmoji.actions || {};
    if (actions.punish) {
      await punishmentEngine.punish(guildId, executorId, actions.punish, `Unauthorized emoji update: ${event.emoji.name}`);
    }

    await incidentEngine.create(guildId, 'antiEmoji', 'emoji_update', executorId, event.emoji.id, 'medium', risk, { emojiName: event.emoji.name }, 'log_only');
  }
}
