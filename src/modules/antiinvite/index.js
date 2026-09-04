const INVITE_CREATE_THRESHOLD = 5;
const INVITE_DELETE_THRESHOLD = 5;
const RATE_WINDOW = 10_000;

function getInviteTracker(cache, guildId) {
  const key = 'antiInvite';
  if (!cache[key]) cache[key] = {};
  if (!cache[key][guildId]) {
    cache[key][guildId] = {
      createTimestamps: [],
      deleteTimestamps: [],
      inviteCache: new Map(),
    };
  }
  return cache[key][guildId];
}

function pruneTimestamps(arr, windowMs) {
  const now = Date.now();
  while (arr.length > 0 && now - arr[0] > windowMs) {
    arr.shift();
  }
}

export async function handleInviteCreate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, whitelistManager, ownerManager } = context;
  const { guild, invite } = event;
  if (!guild || !invite) return;

  const config = await database.getConfig(guild.id);
  if (!config?.modules?.antiinvite?.enabled) return;

  const inviterId = invite.inviter?.id;
  if (!inviterId) return;
  if (await whitelistManager.isWhitelisted(guild.id, inviterId)) return;
  if (await ownerManager.isExtraOwner(guild.id, inviterId)) return;

  const tracker = getInviteTracker(cache, guild.id);
  const now = Date.now();
  tracker.createTimestamps.push(now);
  pruneTimestamps(tracker.createTimestamps, RATE_WINDOW);

  tracker.inviteCache.set(invite.code, {
    code: invite.code,
    guildId: guild.id,
    inviterId,
    channelId: invite.channel?.id,
    roleIds: invite.roles?.map(r => r.id ?? r) ?? [],
    uses: invite.uses ?? 0,
    maxUses: invite.maxUses ?? 0,
    maxAge: invite.maxAge ?? 0,
    createdAt: invite.createdTimestamp ?? Date.now(),
  });

  const count = tracker.createTimestamps.length;
  if (count >= INVITE_CREATE_THRESHOLD) {
    const risk = Math.min(100, 60 + count * 5);
    console.log(`[Security] Invite spam in ${guild.name} by ${inviterId}: ${count} in ${RATE_WINDOW / 1000}s`);

    await Promise.all([
      punishmentEngine.punish(guild.id, inviterId, 'KICK', `Luna: ${count} invites created in rapid succession`).catch(e => {
        console.log(`[Security] Failed to punish inviter: ${e.message}`);
        return null;
      }),
      incidentEngine.create(guild.id, 'antiinvite', 'invite_create_spam', inviterId, inviterId, 'high', risk, {
        inviteCount: count,
        windowMs: RATE_WINDOW,
        code: invite.code
      }, 'kick')
    ]);
  }
}

export async function handleInviteDelete(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, whitelistManager, ownerManager } = context;
  const { guild, invite } = event;
  if (!guild || !invite) return;

  const config = await database.getConfig(guild.id);
  if (!config?.modules?.antiinvite?.enabled) return;

  const deleterId = event.userId;
  if (deleterId) {
    if (await whitelistManager.isWhitelisted(guild.id, deleterId)) return;
    if (await ownerManager.isExtraOwner(guild.id, deleterId)) return;
  }

  const tracker = getInviteTracker(cache, guild.id);
  const now = Date.now();
  tracker.deleteTimestamps.push(now);
  pruneTimestamps(tracker.deleteTimestamps, RATE_WINDOW);

  const cachedState = tracker.inviteCache.get(invite.code);
  tracker.inviteCache.delete(invite.code);

  const count = tracker.deleteTimestamps.length;
  if (count >= INVITE_DELETE_THRESHOLD) {
    const targetUserId = deleterId || cachedState?.inviterId || 'unknown';
    const risk = Math.min(100, 65 + count * 5);
    console.log(`[Security] Invite delete spam in ${guild.name} by ${targetUserId}: ${count} in ${RATE_WINDOW / 1000}s`);

    await Promise.all([
      punishmentEngine.punish(guild.id, targetUserId, 'KICK', `Luna: ${count} invites deleted in rapid succession`).catch(e => {
        console.log(`[Security] Failed to punish: ${e.message}`);
        return null;
      }),
      incidentEngine.create(guild.id, 'antiinvite', 'invite_delete_spam', targetUserId, targetUserId, 'high', risk, {
        deletionCount: count,
        windowMs: RATE_WINDOW,
        code: invite.code
      }, 'kick')
    ]);
  }
}
