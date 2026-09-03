export async function handleStickerCreate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const config = await database.getConfig(event.guild.id);
  if (!config?.modules?.antisticker?.enabled) return;

  if (await whitelistManager.isWhitelisted(event.guild.id, event.executorId)) return;
  if (await ownerManager.isExtraOwner(event.guild.id, event.executorId)) return;

  const risk = calculateStickerCreateRisk(event);
  console.log(`[Security] Sticker created in ${event.guild.name} (risk: ${risk})`);

  if (risk >= 70) {
    const action = config.modules.antisticker.actions?.punish || 'kick';
    await punishmentEngine.punish(event.guild.id, event.executorId, 'sticker_create_spam', action);
    await incidentEngine.create(event.guild.id, 'antisticker', 'sticker_create', event.executorId, event.sticker.id, 'high', risk, { sticker: event.sticker.toJSON() }, 'punish');
  } else if (risk >= 30) {
    await incidentEngine.create(event.guild.id, 'antisticker', 'sticker_create', event.executorId, event.sticker.id, 'warning', risk, { sticker: event.sticker.toJSON() }, 'log_only');
  }

  console.log(`[Security] Sticker created: ${event.sticker.name} in ${event.guild.name}`);
}

export async function handleStickerDelete(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const config = await database.getConfig(event.guild.id);
  if (!config?.modules?.antisticker?.enabled) return;

  if (await whitelistManager.isWhitelisted(event.guild.id, event.executorId)) return;
  if (await ownerManager.isExtraOwner(event.guild.id, event.executorId)) return;

  const recentDeletes = await cache.get(event.guild.id).antisticker?.recentDeletes || [];
  const risk = calculateStickerDeleteRisk(event, recentDeletes);
  console.log(`[Security] Sticker deleted in ${event.guild.name} (risk: ${risk})`);

  if (risk >= 70) {
    const snapshot = await snapshotManager.getSnapshot(event.guild.id, `sticker:${event.stickerId}`);
    if (snapshot && config.modules.antisticker.actions?.restore) {
      await snapshotManager.restoreSticker(event.guild.id, snapshot).catch(() => null);
      console.log(`[Security] Restored sticker ${event.stickerId} in ${event.guild.name}`);
    }
    const action = config.modules.antisticker.actions?.punish || 'kick';
    await punishmentEngine.punish(event.guild.id, event.executorId, 'sticker_delete_spam', action);
    await incidentEngine.create(event.guild.id, 'antisticker', 'sticker_delete', event.executorId, event.stickerId, 'high', risk, { recentDeletes: recentDeletes.length }, 'restore_and_punish');
  } else if (risk >= 30) {
    await incidentEngine.create(event.guild.id, 'antisticker', 'sticker_delete', event.executorId, event.stickerId, 'warning', risk, { recentDeletes: recentDeletes.length }, 'log_only');
  }

  console.log(`[Security] Sticker deleted: ${event.stickerId} in ${event.guild.name}`);
}

export async function handleStickerUpdate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, auditCorrelator, whitelistManager, ownerManager } = context;
  const config = await database.getConfig(event.guild.id);
  if (!config?.modules?.antisticker?.enabled) return;

  if (await whitelistManager.isWhitelisted(event.guild.id, event.executorId)) return;
  if (await ownerManager.isExtraOwner(event.guild.id, event.executorId)) return;

  const changes = event.changes || [];
  const hasAbuse = changes.some(c => c.key === 'name' && c.newValue && (c.newValue.includes('@') || c.newValue.length > 32));

  if (hasAbuse) {
    const risk = 40;
    console.log(`[Security] Abusive sticker update in ${event.guild.name} (risk: ${risk})`);

    const action = config.modules.antisticker.actions?.punish || 'kick';
    await punishmentEngine.punish(event.guild.id, event.executorId, 'sticker_abuse', action);
    await incidentEngine.create(event.guild.id, 'antisticker', 'sticker_update', event.executorId, event.sticker.id, 'low', risk, { changes }, 'punish');
  }

  console.log(`[Security] Sticker updated: ${event.sticker.name} in ${event.guild.name}`);
}

function calculateStickerCreateRisk(event) {
  let risk = 10;
  if (event.sticker.format_type === 3) risk += 20;
  if (event.sticker.name && event.sticker.name.length > 32) risk += 15;
  return Math.min(risk, 100);
}

function calculateStickerDeleteRisk(event, recentDeletes) {
  let risk = 15;
  const now = Date.now();
  const recentCount = recentDeletes.filter(t => now - t < 60000).length;
  if (recentCount > 3) risk += 35;
  if (recentCount > 6) risk += 35;
  return Math.min(risk, 100);
}
