export async function handleKickRemove(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, auditCorrelator, whitelistManager, ownerManager } = context;
  const guild = event.guild;
  if (!guild) return;
  const guildId = guild.id;

  const config = await database.getConfig(guildId);
  if (!config?.modules?.antikick?.enabled) return;

  const targetId = event.targetId;
  if (!targetId) return;

  const executorId = event.executorId || await auditCorrelator.resolveKickExecutor(guild, targetId);
  console.log(`[Security] Kick: ${targetId} in ${guild.name} by ${executorId || 'unknown'}`);

  if (executorId) {
    if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
    if (await ownerManager.isExtraOwner(guildId, executorId)) return;

    const risk = 80;
    const actions = config.modules.antikick.actions || {};

    if (actions.punish) {
      await punishmentEngine.punish(guildId, executorId, actions.punish, `Unauthorized kick of ${targetId}`);
    }

    await incidentEngine.create(guildId, 'antikick', 'kick_remove', executorId, targetId, 'critical', risk, { targetId }, 'punish');
  }
}
