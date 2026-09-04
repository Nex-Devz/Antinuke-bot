export async function handleBanAdd(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, auditCorrelator, whitelistManager, ownerManager } = context;
  const guild = event.guild;
  if (!guild) return;
  const guildId = guild.id;

  const config = await database.getConfig(guildId);
  if (!config?.modules?.antiban?.enabled) return;

  const targetId = event.ban?.user?.id || event.targetId;
  if (!targetId) return;

  const actions = config.modules.antiban.actions || {};

  // INSTANT: Unban immediately without waiting for anything
  if (actions.unban) {
    guild.members.unban(targetId, 'Luna: Unauthorized ban').catch(e => {
      console.log(`[Security] Failed to unban ${targetId}: ${e.message}`);
    });
  }

  // Resolve executor asynchronously - don't block the unban
  const executorId = event.executorId || await auditCorrelator.resolveBanExecutor(guild, targetId);

  if (!executorId) return;
  if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
  if (await ownerManager.isExtraOwner(guildId, executorId)) return;

  console.log(`[Security] Ban detected: ${targetId} in ${guild.name} by ${executorId}`);

  const reason = `Luna: Unauthorized ban of ${targetId}`;

  const tasks = [];

  // INSTANT: Punish immediately
  if (actions.punish) {
    tasks.push(punishmentEngine.punish(guildId, executorId, actions.punish, reason).catch(e => {
      console.log(`[Security] Failed to punish ${executorId}: ${e.message}`);
      return null;
    }));
  }

  tasks.push(incidentEngine.create(guildId, 'antiban', 'ban_add', executorId, targetId, 'critical', 85, { targetId }, 'unban_and_punish'));

  await Promise.all(tasks);
}
