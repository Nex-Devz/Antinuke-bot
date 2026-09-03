const DEFAULT_RAID_THRESHOLD = 10;
const DEFAULT_RAID_WINDOW = 10_000;
const DEFAULT_LOCKDOWN_SENSITIVITY = 0.5;

function getRaidTracker(cache, guildId) {
  const key = 'antiRaid';
  if (!cache[key]) cache[key] = {};
  if (!cache[key][guildId]) {
    cache[key][guildId] = {
      joinTimestamps: [],
      isLockdown: false,
      lockdownSensitivity: DEFAULT_LOCKDOWN_SENSITIVITY,
      lastRaidDetected: 0,
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

function calculateMemberRisk(member) {
  let risk = 20;
  const now = Date.now();
  const accountAge = now - member.user.createdTimestamp;
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

  if (accountAge < SEVEN_DAYS) risk += 30;
  else if (accountAge < THIRTY_DAYS) risk += 15;

  if (!member.user.avatar) risk += 10;
  if (member.user.bot) risk += 5;

  return Math.min(100, risk);
}

export async function handleMemberAdd(event, context) {
  const { client, cache, incidentEngine, punishmentEngine } = context;
  const { guild, member } = event;
  if (!guild || !member) return;

  if (!cache.moduleState?.antiRaid?.enabled) return;

  const tracker = getRaidTracker(cache, guild.id);
  const now = Date.now();

  const threshold = cache.moduleState?.antiRaid?.threshold ?? DEFAULT_RAID_THRESHOLD;
  const windowMs = cache.moduleState?.antiRaid?.windowMs ?? DEFAULT_RAID_WINDOW;

  tracker.joinTimestamps.push(now);
  pruneTimestamps(tracker.joinTimestamps, windowMs);

  const joinCount = tracker.joinTimestamps.length;

  if (joinCount >= threshold) {
    const risk = Math.min(100, 70 + joinCount * 2);
    console.log(`[Security] Raid detected in ${guild.name} (${guild.id}): ${joinCount} joins in ${windowMs / 1000}s`);

    tracker.isLockdown = true;
    tracker.lockdownSensitivity = Math.min(1, tracker.lockdownSensitivity + 0.1);
    tracker.lastRaidDetected = now;

    const memberRisk = calculateMemberRisk(member);

    await punishmentEngine?.punish(guild, member.id, 'raid_join', {
      risk: Math.max(risk, memberRisk),
      reason: `Raid pattern detected: ${joinCount} members joined in ${windowMs / 1000}s`,
      duration: '30m',
    });

    await incidentEngine?.log({
      type: 'raid_detected',
      guildId: guild.id,
      userId: member.id,
      risk,
      action: 'LOCKDOWN',
      details: {
        joinCount,
        windowMs,
        threshold,
        lockdownSensitivity: tracker.lockdownSensitivity,
        memberAccountAge: now - member.user.createdTimestamp,
        memberHasAvatar: !!member.user.avatar,
      },
    });

    console.log(`[Security] Lockdown activated in ${guild.name} (${guild.id}), sensitivity: ${tracker.lockdownSensitivity.toFixed(2)}`);
  } else if (tracker.isLockdown && joinCount > 0) {
    const memberRisk = calculateMemberRisk(member);
    const effectiveThreshold = Math.max(1, Math.floor(threshold * (1 - tracker.lockdownSensitivity)));

    if (joinCount >= effectiveThreshold) {
      const risk = Math.min(100, 75 + joinCount * 2);
      console.log(`[Security] Post-raid suspicious join in ${guild.name} (${guild.id}) by ${member.id}`);

      await incidentEngine?.log({
        type: 'raid_suspicious_join',
        guildId: guild.id,
        userId: member.id,
        risk,
        details: {
          joinCount,
          effectiveThreshold,
          lockdownSensitivity: tracker.lockdownSensitivity,
          memberAccountAge: now - member.user.createdTimestamp,
        },
      });

      if (memberRisk >= 60) {
        await punishmentEngine?.punish(guild, member.id, 'raid_suspicious_member', {
          risk: memberRisk,
          reason: 'Suspicious account joined during active raid lockdown',
          duration: '15m',
        });
      }
    }
  }

  if (tracker.isLockdown && now - tracker.lastRaidDetected > windowMs * 3) {
    tracker.isLockdown = false;
    tracker.lockdownSensitivity = DEFAULT_LOCKDOWN_SENSITIVITY;
    console.log(`[Security] Lockdown deactivated in ${guild.name} (${guild.id})`);
  }
}
