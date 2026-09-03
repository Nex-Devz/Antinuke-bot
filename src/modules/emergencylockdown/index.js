export async function handleLockdown(guildId, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const config = await database.getConfig(guildId);
  if (!config?.modules?.emergencylockdown?.enabled) return;

  const guildConfig = cache.get(guildId);
  if (!guildConfig) return;

  guildConfig.lockdown = {
    active: true,
    activatedAt: Date.now(),
    reason: config.modules.emergencylockdown.reason || 'Emergency lockdown activated',
    restrictions: {
      blockRoleInvites: true,
      blockSuspiciousRoleChanges: true,
      blockSuspiciousChannelChanges: true,
      blockSuspiciousBotAdditions: true
    }
  };

  await incidentEngine.create(guildId, 'emergencylockdown', 'lockdown_activated', null, null, 'high', 80, { reason: guildConfig.lockdown.reason }, 'lockdown_activated');

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (guild) {
    console.log(`[Security] Emergency lockdown activated in ${guild.name} (ID: ${guildId})`);
    const logChannel = guild.channels.cache.find(ch => ch.name === 'security-logs' || ch.name === 'mod-logs');
    if (logChannel) {
      await logChannel.send({ content: `⚠️ **Emergency Lockdown Activated**\nReason: ${guildConfig.lockdown.reason}\nAll security restrictions are now in effect.` }).catch(() => null);
    }
  } else {
    console.log(`[Security] Emergency lockdown activated for guild ${guildId}`);
  }
}

export async function handleUnlock(guildId, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const config = await database.getConfig(guildId);
  if (!config?.modules?.emergencylockdown?.enabled) return;

  const guildConfig = cache.get(guildId);
  if (!guildConfig) return;

  if (!guildConfig.lockdown?.active) {
    console.log(`[Security] No active lockdown to unlock in guild ${guildId}`);
    return;
  }

  const lockdownDuration = Date.now() - guildConfig.lockdown.activatedAt;

  guildConfig.lockdown = {
    active: false,
    deactivatedAt: Date.now(),
    duration: lockdownDuration
  };

  await incidentEngine.create(guildId, 'emergencylockdown', 'lockdown_deactivated', null, null, 'medium', 40, { duration: lockdownDuration }, 'lockdown_deactivated');

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (guild) {
    console.log(`[Security] Emergency lockdown deactivated in ${guild.name} (ID: ${guildId})`);
    const logChannel = guild.channels.cache.find(ch => ch.name === 'security-logs' || ch.name === 'mod-logs');
    if (logChannel) {
      await logChannel.send({ content: `✅ **Emergency Lockdown Deactivated**\nDuration: ${Math.round(lockdownDuration / 1000)}s\nAll restrictions have been lifted.` }).catch(() => null);
    }
  } else {
    console.log(`[Security] Emergency lockdown deactivated for guild ${guildId}`);
  }
}

export async function isLockdownActive(cache, guildId) {
  const guildConfig = cache.get(guildId);
  return guildConfig?.lockdown?.active === true;
}

export async function handleLockdownEvent(event, context) {
  const { cache, incidentEngine, punishmentEngine, whitelistManager, ownerManager } = context;
  const guildId = event.guild.id;

  if (!await isLockdownActive(cache, guildId)) return;

  if (await whitelistManager.isWhitelisted(guildId, event.executorId)) return;
  if (await ownerManager.isExtraOwner(guildId, event.executorId)) return;

  const lockdown = cache.get(guildId).lockdown;
  const restrictions = lockdown.restrictions || {};

  if (event.type === 'role_invite' && restrictions.blockRoleInvites) {
    console.log(`[Security] Blocked role invite during lockdown in guild ${guildId}`);
    await incidentEngine.create(guildId, 'emergencylockdown', 'role_invite_blocked', event.executorId, event.targetId, 'high', 90, { event }, 'blocked_by_lockdown');
    return true;
  }

  if (event.type === 'suspicious_role_change' && restrictions.blockSuspiciousRoleChanges) {
    console.log(`[Security] Blocked suspicious role change during lockdown in guild ${guildId}`);
    await incidentEngine.create(guildId, 'emergencylockdown', 'role_change_blocked', event.executorId, event.targetId, 'high', 90, { event }, 'blocked_by_lockdown');
    return true;
  }

  if (event.type === 'suspicious_channel_change' && restrictions.blockSuspiciousChannelChanges) {
    console.log(`[Security] Blocked suspicious channel change during lockdown in guild ${guildId}`);
    await incidentEngine.create(guildId, 'emergencylockdown', 'channel_change_blocked', event.executorId, event.targetId, 'high', 90, { event }, 'blocked_by_lockdown');
    return true;
  }

  if (event.type === 'suspicious_bot_add' && restrictions.blockSuspiciousBotAdditions) {
    console.log(`[Security] Blocked suspicious bot addition during lockdown in guild ${guildId}`);
    await incidentEngine.create(guildId, 'emergencylockdown', 'bot_add_blocked', event.executorId, event.targetId, 'critical', 95, { event }, 'blocked_by_lockdown');
    return true;
  }

  await incidentEngine.create(guildId, 'emergencylockdown', 'lockdown_event', event.executorId, event.targetId, 'medium', 50, { event }, 'logged_during_lockdown');
  console.log(`[Security] Lockdown event logged in guild ${guildId}: ${event.type}`);
  return false;
}
