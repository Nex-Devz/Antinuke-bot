export async function handleStickerCreate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const guild = event.guild;
  if (!guild) return;
  const guildId = guild.id;

  const config = await database.getConfig(guildId);
  if (!config?.modules?.antisticker?.enabled) return;

  const executorId = event.executorId || await auditCorrelator.resolveExecutor(guild, 'STICKER_CREATE', event.sticker.id);
  console.log(`[Security] Sticker created: ${event.sticker.name} in ${guild.name} by ${executorId || 'unknown'}`);

  if (executorId) {
    if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
    if (await ownerManager.isExtraOwner(guildId, executorId)) return;

    const risk = 70;
    const actions = config.modules.antisticker.actions || {};
    await snapshotManager.takeStickerSnapshot(guildId, event.sticker.id);

    if (actions.restore) {
      await event.sticker.delete('Luna: Unauthorized sticker creation').catch(e => console.log(`[Security] Failed to delete sticker: ${e.message}`));
      console.log(`[Security] Deleted unauthorized sticker: ${event.sticker.name}`);
    }

    if (actions.punish) {
      await punishmentEngine.punish(guildId, executorId, actions.punish, `Unauthorized sticker creation: ${event.sticker.name}`);
    }

    await incidentEngine.create(guildId, 'antisticker', 'sticker_create', executorId, event.sticker.id, 'critical', risk, { sticker: event.sticker.toJSON() }, 'delete_and_punish');
  }
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

  if (executorId) {
    if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
    if (await ownerManager.isExtraOwner(guildId, executorId)) return;

    const risk = 70;
    const actions = config.modules.antisticker.actions || {};

    if (actions.restore) {
      const snapshot = await snapshotManager.getSnapshot(guildId, `sticker:${event.stickerId}`);
      if (snapshot) {
        await snapshotManager.restoreSticker(guildId, snapshot).catch(e => console.log(`[Security] Failed to restore sticker: ${e.message}`));
        console.log(`[Security] Restored sticker: ${snapshot.name}`);
      }
    }

    if (actions.punish) {
      await punishmentEngine.punish(guildId, executorId, actions.punish, `Unauthorized sticker deletion: ${event.sticker?.name || event.stickerId}`);
    }

    await incidentEngine.create(guildId, 'antisticker', 'sticker_delete', executorId, event.stickerId, 'critical', risk, { stickerName: event.sticker?.name }, 'restore_and_punish');
  }
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

  if (executorId) {
    if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
    if (await ownerManager.isExtraOwner(guildId, executorId)) return;

    const risk = 50;
    const actions = config.modules.antisticker.actions || {};
    if (actions.punish) {
      await punishmentEngine.punish(guildId, executorId, actions.punish, `Unauthorized sticker update: ${event.sticker.name}`);
    }

    await incidentEngine.create(guildId, 'antisticker', 'sticker_update', executorId, event.sticker.id, 'medium', risk, { stickerName: event.sticker.name }, 'log_only');
  }
}
