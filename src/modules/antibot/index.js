export async function handleBotAdd(member, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, auditCorrelator, whitelistManager, ownerManager } = context;

  try {
    const config = await database.getConfig(member.guild.id);
    if (!config?.modules?.antibot?.enabled) return;

    if (!member.user.bot) return;

    const botId = member.id;

    const trustedBots = config?.antibot?.trusted_bots || [];
    if (trustedBots.includes(botId)) return;

    const blockedBots = config?.antibot?.blocked_bots || [];
    const allowedBots = config?.antibot?.allowed_bots || [];

    if (blockedBots.includes(botId)) {
      console.log(`[Security] Blocked bot attempted to join: ${member.user.tag} (${botId})`);
      await member.kick('Luna: Bot is blocked').catch(e => console.log(`[Security] Failed to kick: ${e.message}`));

      await incidentEngine.create(member.guild.id, 'antibot', 'blocked_bot_join', botId, botId, 'high', 80, {
        botTag: member.user.tag,
        reason: 'Bot is in blocked list'
      }, 'kick');
      return;
    }

    if (allowedBots.length > 0 && !allowedBots.includes(botId)) {
      console.log(`[Security] Bot not in allowlist: ${member.user.tag} (${botId})`);
      await member.kick('Luna: Bot not in allowlist').catch(e => console.log(`[Security] Failed to kick: ${e.message}`));

      await incidentEngine.create(member.guild.id, 'antibot', 'unauthorized_bot_join', botId, botId, 'high', 75, {
        botTag: member.user.tag,
        reason: 'Bot not in allowlist'
      }, 'kick');
      return;
    }

    if (!config?.antibot?.require_invite_verification) return;

    let inviterId = null;
    try {
      const auditLogs = await member.guild.fetchAuditLogs({ type: 'BOT_ADD', limit: 1 });
      const entry = auditLogs.entries.first();
      if (entry && entry.target.id === member.id) {
        inviterId = entry.executor?.id;
      }
    } catch {
      // ignore
    }

    if (inviterId) {
      if (await whitelistManager.isWhitelisted(member.guild.id, inviterId)) return;
      if (await ownerManager.isExtraOwner(member.guild.id, inviterId)) return;
    }

    console.log(`[Security] Unauthorized bot addition: ${member.user.tag} (${botId}) by ${inviterId || 'unknown'}`);

    await member.kick('Luna: Unauthorized bot addition').catch(e => console.log(`[Security] Failed to kick: ${e.message}`));

    if (inviterId) {
      const punishmentType = config?.antibot?.inviter_punishment || 'KICK';
      await punishmentEngine.punish(member.guild.id, inviterId, punishmentType, `Luna: Unauthorized bot invitation: ${member.user.tag}`).catch(e => {
        console.log(`[Security] Failed to punish inviter ${inviterId}: ${e.message}`);
        return null;
      });
    }

    await incidentEngine.create(member.guild.id, 'antibot', 'unauthorized_bot_add', inviterId || botId, botId, 'high', 75, {
      botTag: member.user.tag,
      inviterId,
      inviterTag: inviterId ? null : undefined
    }, 'kick_and_punish');
  } catch (error) {
    console.log(`[Security] Error in antibot handler: ${error.message}`);
  }
}
