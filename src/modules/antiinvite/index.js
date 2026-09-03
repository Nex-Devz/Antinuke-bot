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

function isWhitelisted(context, userId, guildId) {
  if (context.whitelistManager?.isWhitelisted(userId, guildId)) return true;
  if (context.ownerManager?.isExtraOwner(userId, guildId)) return true;
  return false;
}

function buildInviteState(invite) {
  return {
    code: invite.code,
    guildId: invite.guild?.id,
    channelId: invite.channel?.id,
    inviterId: invite.inviter?.id,
    roleIds: invite.roles?.map((r) => r.id ?? r) ?? [],
    uses: invite.uses ?? 0,
    maxUses: invite.maxUses ?? 0,
    maxAge: invite.maxAge ?? 0,
    createdAt: invite.createdTimestamp ?? Date.now(),
  };
}

export async function handleInviteCreate(event, context) {
  const { client, cache, incidentEngine, punishmentEngine } = context;
  const { guild, invite } = event;
  if (!guild || !invite) return;

  if (!cache.moduleState?.antiInvite?.enabled) return;

  const inviterId = invite.inviter?.id;
  if (!inviterId) return;
  if (isWhitelisted(context, inviterId, guild.id)) return;

  const tracker = getInviteTracker(cache, guild.id);
  const now = Date.now();
  tracker.createTimestamps.push(now);
  pruneTimestamps(tracker.createTimestamps, RATE_WINDOW);

  const state = buildInviteState(invite);
  tracker.inviteCache.set(invite.code, state);

  const count = tracker.createTimestamps.length;
  if (count >= INVITE_CREATE_THRESHOLD) {
    const risk = Math.min(100, 60 + count * 5);
    console.log(`[Security] Invite creation spam detected in ${guild.name} (${guild.id}) by ${inviterId}: ${count} invites in ${RATE_WINDOW / 1000}s`);

    await punishmentEngine?.punish(guild, inviterId, 'invite_create_spam', {
      risk,
      reason: `${count} invites created in rapid succession`,
      duration: '1h',
    });

    await incidentEngine?.log({
      type: 'invite_create_spam',
      guildId: guild.id,
      userId: inviterId,
      risk,
      details: { inviteCount: count, windowMs: RATE_WINDOW, code: invite.code },
    });
  }
}

export async function handleInviteDelete(event, context) {
  const { client, cache, incidentEngine, punishmentEngine } = context;
  const { guild, invite } = event;
  if (!guild || !invite) return;

  if (!cache.moduleState?.antiInvite?.enabled) return;

  const deleterId = event.userId;
  if (deleterId && isWhitelisted(context, deleterId, guild.id)) return;

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
    console.log(`[Security] Invite deletion spam detected in ${guild.name} (${guild.id}) by ${targetUserId}: ${count} deletions in ${RATE_WINDOW / 1000}s`);

    await punishmentEngine?.punish(guild, targetUserId, 'invite_delete_spam', {
      risk,
      reason: `${count} invites deleted in rapid succession`,
      duration: '1h',
    });

    await incidentEngine?.log({
      type: 'invite_delete_spam',
      guildId: guild.id,
      userId: targetUserId,
      risk,
      details: { deletionCount: count, windowMs: RATE_WINDOW, code: invite.code, cachedState },
    });
  }
}
