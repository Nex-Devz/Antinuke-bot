export async function handleBanAdd(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, auditCorrelator, whitelistManager, ownerManager } = context;
  const guild = event.guild;
  if (!guild) return;
  const guildId = guild.id;

  const config = await database.getConfig(guildId);
  if (!config?.modules?.antiban?.enabled) return;

  const targetId = event.ban?.user?.id || event.targetId;
  if (!targetId) return;

  const executorId = event.executorId || await auditCorrelator.resolveBanExecutor(guild, targetId);
  console.log(`[Security] Ban: ${targetId} in ${guild.name} by ${executorId || 'unknown'}`);

  if (!executorId) return;
  if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
  if (await ownerManager.isExtraOwner(guildId, executorId)) return;

  const actions = config.modules.antiban.actions || {};

  await Promise.all([
    actions.unban ? guild.members.unban(targetId, 'Luna: Unauthorized ban').catch(() => null) : null,
    actions.punish ? punishmentEngine.punish(guildId, executorId, actions.punish, `Luna: Unauthorized ban of ${targetId}`) : null,
    incidentEngine.create(guildId, 'antiban', 'ban_add', executorId, targetId, 'critical', 85, { targetId }, 'unban_and_punish')
  ]);

  console.log(`[Security] Unbanned ${targetId}`);
}
