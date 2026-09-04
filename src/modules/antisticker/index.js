export async function handleStickerCreate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const guild = event.guild;
  if (!guild) return;
  const guildId = guild.id;

  const config = await database.getConfig(guildId);
  if (!config?.modules?.antisticker?.enabled) return;

  const executorId = event.executorId || await auditCorrelator.resolveExecutor(guild, 'STICKER_CREATE', event.sticker.id);
  console.log(`[Security] Sticker created: ${event.sticker.name} in ${guild.name} by ${executorId || 'unknown'}`);

  if (!executorId) return;
  if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
  if (await ownerManager.isExtraOwner(guildId, executorId)) return;

  const actions = config.modules.antisticker.actions || {};
  const reason = 'Luna: Unauthorized sticker creation';

  await Promise.all([
    snapshotManager.takeStickerSnapshot?.(guildId, event.sticker.id),
    actions.restore ? event.sticker.delete(reason).catch(() => null) : null,
    actions.punish ? punishmentEngine.punish(guildId, executorId, actions.punish, reason).catch(e => {
      console.log(`[Security] Failed to punish: ${e.message}`);
      return null;
    }) : null,
    incidentEngine.create(guildId, 'antisticker', 'sticker_create', executorId, event.sticker.id, 'critical', 70, { stickerName: event.sticker.name }, 'delete_and_punish')
  ]);
}

export async function handleStickerDelete(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const guild = event.guild;
  if (!guild) return;
  const guildId = guild.id;

  const config = await database.getConfig(guildId);
  if (!config?.modules?.antisticker?.enabled) return;

  const executorId = event.executorId || await auditCorrelator.resolveExecutor(guild, 'STICKER_DELETE', event.stickerId);
  console.log(`[Security] Sticker deleted: ${event.sticker?.name || event.stickerId} in ${guild.name} by ${executorId || 'unknown'}`);

  if (!executorId) return;
  if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
  if (await ownerManager.isExtraOwner(guildId, executorId)) return;

  const actions = config.modules.antisticker.actions || {};
  const reason = 'Luna: Unauthorized sticker deletion';

  const tasks = [
    actions.punish ? punishmentEngine.punish(guildId, executorId, actions.punish, reason).catch(e => {
      console.log(`[Security] Failed to punish: ${e.message}`);
      return null;
    }) : null,
    incidentEngine.create(guildId, 'antisticker', 'sticker_delete', executorId, event.stickerId, 'critical', 70, { stickerName: event.sticker?.name }, 'restore_and_punish')
  ];

  if (actions.restore) {
    const snapKey = `sticker:${event.stickerId}`;
    tasks.push(
      snapshotManager.getSnapshot(guildId, snapKey).then(async (snapshot) => {
        if (snapshot) {
          await snapshotManager.restoreSticker(guildId, snapshot);
          console.log(`[Security] Restored sticker: ${snapshot.name}`);
        }
      }).catch(() => null)
    );
  }

  await Promise.all(tasks);
}

export async function handleStickerUpdate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, auditCorrelator, whitelistManager, ownerManager } = context;
  const guild = event.guild;
  if (!guild) return;
  const guildId = guild.id;

  const config = await database.getConfig(guildId);
  if (!config?.modules?.antisticker?.enabled) return;

  const executorId = event.executorId || await auditCorrelator.resolveExecutor(guild, 'STICKER_UPDATE', event.sticker.id);
  console.log(`[Security] Sticker updated: ${event.sticker.name} in ${guild.name} by ${executorId || 'unknown'}`);

  if (!executorId) return;
  if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
  if (await ownerManager.isExtraOwner(guildId, executorId)) return;

  const actions = config.modules.antisticker.actions || {};

  await Promise.all([
    actions.punish ? punishmentEngine.punish(guildId, executorId, actions.punish, 'Luna: Unauthorized sticker update').catch(e => {
      console.log(`[Security] Failed to punish: ${e.message}`);
      return null;
    }) : null,
    incidentEngine.create(guildId, 'antisticker', 'sticker_update', executorId, event.sticker.id, 'medium', 50, { stickerName: event.sticker.name }, 'log_only')
  ]);
}