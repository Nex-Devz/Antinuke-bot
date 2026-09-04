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

  if (executorId) {
    if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
    if (await ownerManager.isExtraOwner(guildId, executorId)) return;

    const risk = 85;
    const actions = config.modules.antiban.actions || {};

    if (actions.unban) {
      await guild.members.unban(targetId, 'Luna: Unauthorized ban').catch(e => console.log(`[Security] Failed to unban: ${e.message}`));
      console.log(`[Security] Unbanned: ${targetId}`);
    }

    if (actions.punish) {
      await punishmentEngine.punish(guildId, executorId, actions.punish, `Unauthorized ban of ${targetId}`);
    }

    await incidentEngine.create(guildId, 'antiban', 'ban_add', executorId, targetId, 'critical', risk, { targetId }, 'unban_and_punish');
  }
}
