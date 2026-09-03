const DEFAULT_TRUSTED_BOTS = [];

async function isTrustedBot(botId, config) {
  const trustedBots = config?.antibot?.trusted_bots || DEFAULT_TRUSTED_BOTS;
  return trustedBots.includes(botId);
}

async function isAllowedBot(botId, config) {
  const allowedBots = config?.antibot?.allowed_bots || [];
  const blockedBots = config?.antibot?.blocked_bots || [];

  if (blockedBots.includes(botId)) {
    return false;
  }

  if (allowedBots.length === 0) {
    return true;
  }

  return allowedBots.includes(botId);
}

async function getInviter(member, context) {
  const { client, cache } = context;

  try {
    const auditLogs = await member.guild.fetchAuditLogs({
      type: 'BOT_ADD',
      limit: 1
    });

    const entry = auditLogs.entries.first();
    if (!entry) return null;

    if (entry.target.id !== member.id) return null;

    return entry.executor;
  } catch (error) {
    console.log(`[Security] Failed to fetch inviter: ${error.message}`);
    return null;
  }
}

async function kickBot(member, reason, context) {
  const { client, incidentEngine, punishmentEngine } = context;

  try {
    await member.kick(reason);
    console.log(`[Security] Kicked unauthorized bot: ${member.user.tag} (${member.id})`);
    return true;
  } catch (error) {
    console.log(`[Security] Failed to kick bot ${member.user.tag}: ${error.message}`);
    return false;
  }
}

export async function handleBotAdd(member, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;

  try {
    const config = cache.get('config');
    if (!config?.modules?.antibot?.enabled) {
      return;
    }

    if (!member.user.bot) {
      return;
    }

    const botId = member.id;

    const trusted = await isTrustedBot(botId, config);
    if (trusted) {
      console.log(`[Security] Trusted bot joined: ${member.user.tag} (${botId})`);
      return;
    }

    const allowed = await isAllowedBot(botId, config);
    if (!allowed) {
      console.log(`[Security] Blocked bot attempted to join: ${member.user.tag} (${botId})`);

      await kickBot(member, 'Elu: Bot is blocked', context);

      await incidentEngine.log({
        type: 'BLOCKED_BOT_JOIN',
        severity: 'HIGH',
        target: botId,
        guild: member.guild.id,
        details: {
          botTag: member.user.tag,
          botName: member.user.username,
          botDiscriminator: member.user.discriminator,
          reason: 'Bot is in blocked list'
        }
      });
      return;
    }

    const inviter = await getInviter(member, context);

    if (inviter) {
      if (whitelistManager.isWhitelisted(inviter.id)) {
        console.log(`[Security] Whitelisted user invited bot: ${inviter.tag} invited ${member.user.tag}`);
        return;
      }

      if (await ownerManager.isExtraOwner(inviter.id)) {
        console.log(`[Security] Extra owner invited bot: ${inviter.tag} invited ${member.user.tag}`);
        return;
      }
    }

    if (!config?.antibot?.require_invite_verification) {
      return;
    }

    console.log(`[Security] Unauthorized bot addition: ${member.user.tag} (${botId}) added by ${inviter?.tag || 'unknown'}`);

    await kickBot(member, 'Elu: Unauthorized bot addition', context);

    if (inviter) {
      const punishmentConfig = config?.antibot?.inviter_punishment || 'KICK';
      const duration = config?.antibot?.inviter_punishment_duration || 86400000;

      await punishmentEngine.apply(member.guild, {
        type: punishmentConfig,
        moderator: client.user,
        reason: `Unauthorized bot invitation: ${member.user.tag}`,
        duration: punishmentConfig === 'TEMPBAN' ? duration : undefined,
        target: inviter
      });
    }

    await incidentEngine.log({
      type: 'UNAUTHORIZED_BOT_ADD',
      severity: 'HIGH',
      target: botId,
      guild: member.guild.id,
      details: {
        botTag: member.user.tag,
        botName: member.user.username,
        botDiscriminator: member.user.discriminator,
        inviterId: inviter?.id,
        inviterTag: inviter?.tag,
        inviterPunished: !!inviter
      }
    });
  } catch (error) {
    console.log(`[Security] Error in antibot handler: ${error.message}`);
  }
}
