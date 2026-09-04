export async function handleEmojiCreate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const guild = event.guild;
  if (!guild) return;
  const guildId = guild.id;

  const config = await database.getConfig(guildId);
  if (!config?.modules?.antiEmoji?.enabled) return;

  const executorId = event.executorId || await auditCorrelator.resolveExecutor(guild, 'EMOJI_CREATE', event.emoji.id);
  console.log(`[Security] Emoji created: ${event.emoji.name} in ${guild.name} by ${executorId || 'unknown'}`);

  if (!executorId) return;
  if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
  if (await ownerManager.isExtraOwner(guildId, executorId)) return;

  const actions = config.modules.antiEmoji.actions || {};
  const reason = 'Luna: Unauthorized emoji creation';

  await Promise.all([
    snapshotManager.takeEmojiSnapshot?.(guildId, event.emoji.id),
    actions.restore ? event.emoji.delete(reason).catch(() => null) : null,
    actions.punish ? punishmentEngine.punish(guildId, executorId, actions.punish, reason).catch(e => {
      console.log(`[Security] Failed to punish: ${e.message}`);
      return null;
    }) : null,
    incidentEngine.create(guildId, 'antiEmoji', 'emoji_create', executorId, event.emoji.id, 'critical', 75, { emojiName: event.emoji.name }, 'delete_and_punish')
  ]);
}

export async function handleEmojiDelete(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const guild = event.guild;
  if (!guild) return;
  const guildId = guild.id;

  const config = await database.getConfig(guildId);
  if (!config?.modules?.antiEmoji?.enabled) return;

  const executorId = event.executorId || await auditCorrelator.resolveExecutor(guild, 'EMOJI_DELETE', event.emojiId);
  console.log(`[Security] Emoji deleted: ${event.emoji?.name || event.emojiId} in ${guild.name} by ${executorId || 'unknown'}`);

  if (!executorId) return;
  if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
  if (await ownerManager.isExtraOwner(guildId, executorId)) return;

  const actions = config.modules.antiEmoji.actions || {};
  const reason = 'Luna: Unauthorized emoji deletion';

  const tasks = [
    actions.punish ? punishmentEngine.punish(guildId, executorId, actions.punish, reason).catch(e => {
      console.log(`[Security] Failed to punish: ${e.message}`);
      return null;
    }) : null,
    incidentEngine.create(guildId, 'antiEmoji', 'emoji_delete', executorId, event.emojiId, 'critical', 75, { emojiName: event.emoji?.name }, 'restore_and_punish')
  ];

  if (actions.restore) {
    tasks.push(
      snapshotManager.getSnapshot?.(guildId, `emoji:${event.emojiId}`).then(async (snapshot) => {
        if (snapshot) {
          await snapshotManager.restoreEmoji?.(guildId, snapshot);
          console.log(`[Security] Restored emoji: ${snapshot.name}`);
        }
      })
    );
  }

  await Promise.all(tasks);
}

export async function handleEmojiUpdate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, auditCorrelator, whitelistManager, ownerManager } = context;
  const guild = event.guild;
  if (!guild) return;
  const guildId = guild.id;

  const config = await database.getConfig(guildId);
  if (!config?.modules?.antiEmoji?.enabled) return;

  const executorId = event.executorId || await auditCorrelator.resolveExecutor(guild, 'EMOJI_UPDATE', event.emoji.id);
  console.log(`[Security] Emoji updated: ${event.emoji.name} in ${guild.name} by ${executorId || 'unknown'}`);

  if (!executorId) return;
  if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
  if (await ownerManager.isExtraOwner(guildId, executorId)) return;

  const actions = config.modules.antiEmoji.actions || {};

  await Promise.all([
    actions.punish ? punishmentEngine.punish(guildId, executorId, actions.punish, 'Luna: Unauthorized emoji update').catch(e => {
      console.log(`[Security] Failed to punish: ${e.message}`);
      return null;
    }) : null,
    incidentEngine.create(guildId, 'antiEmoji', 'emoji_update', executorId, event.emoji.id, 'medium', 50, { emojiName: event.emoji.name }, 'log_only')
  ]);
}
