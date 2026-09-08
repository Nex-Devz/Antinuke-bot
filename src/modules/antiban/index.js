export async function handleBanAdd(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, auditCorrelator, whitelistManager, ownerManager } = context;
  const guild = event.guild;
  if (!guild) return;
  const guildId = guild.id;

  const config = await database.getConfig(guildId);
  if (!config?.modules?.antiban?.enabled) return;

  const targetId = event.ban?.user?.id || event.targetId;
  if (!targetId) return;

  // 1. If this ban was executed by Luna herself as a punishment, IGNORE IT!
  if (punishmentEngine?.isRecentBotBan?.(guildId, targetId)) {
    console.log(`[Security] Ban for ${targetId} was executed by Luna punishment engine. Skipping.`);
    return;
  }

  // 2. Resolve executor who issued the ban
  const executorId = event.executorId || await auditCorrelator.resolveBanExecutor(guild, targetId);
  if (!executorId) return;

  // 3. If Luna herself issued the ban, DO NOT UNBAN!
  if (client?.user?.id === executorId) {
    console.log(`[Security] Ban for ${targetId} was issued by Luna bot. Authorized.`);
    return;
  }

  // 4. If Server Owner issued the ban, DO NOT UNBAN!
  if (guild.ownerId === executorId) {
    console.log(`[Security] Ban for ${targetId} was issued by Guild Owner (${executorId}). Authorized.`);
    return;
  }

  // 5. If Whitelisted admin or Extra Owner issued the ban, DO NOT UNBAN!
  if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
  if (await ownerManager.isExtraOwner(guildId, executorId)) return;

  // 6. Rogue / Unauthorized ban detected!
  console.log(`[Security] Unauthorized ban detected: ${targetId} in ${guild.name} by ${executorId}`);

  const actions = config.modules.antiban.actions || {};
  const reason = `Luna: Unauthorized ban of ${targetId}`;

  const tasks = [];

  // Revert the rogue ban (unban the victim)
  if (actions.unban) {
    tasks.push(guild.members.unban(targetId, 'Luna: Reverting unauthorized ban').catch(e => {
      console.log(`[Security] Failed to unban ${targetId}: ${e.message}`);
    }));
  }

  // Punish the rogue banner
  if (actions.punish) {
    tasks.push(punishmentEngine.punish(guildId, executorId, actions.punish, reason).catch(e => {
      console.log(`[Security] Failed to punish ${executorId}: ${e.message}`);
      return null;
    }));
  }

  tasks.push(incidentEngine.create(guildId, 'antiban', 'ban_add', executorId, targetId, 'critical', 85, { targetId }, 'unban_and_punish'));

  await Promise.all(tasks);
}
