const DEFAULT_RAID_THRESHOLD = 10;
const DEFAULT_RAID_WINDOW = 10_000;

function getRaidTracker(cache, guildId) {
  const key = 'antiRaid';
  if (!cache[key]) cache[key] = {};
  if (!cache[key][guildId]) {
    cache[key][guildId] = {
      joinTimestamps: [],
      isLockdown: false,
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
  const { client, cache, database, incidentEngine, punishmentEngine } = context;
  const { guild, member } = event;
  if (!guild || !member) return;

  const config = await database.getConfig(guild.id);
  if (!config?.modules?.antiraid?.enabled) return;

  const tracker = getRaidTracker(cache, guild.id);
  const now = Date.now();

  const threshold = config?.modules?.antiraid?.threshold ?? DEFAULT_RAID_THRESHOLD;
  const windowMs = config?.modules?.antiraid?.windowMs ?? DEFAULT_RAID_WINDOW;

  tracker.joinTimestamps.push(now);
  pruneTimestamps(tracker.joinTimestamps, windowMs);

  const joinCount = tracker.joinTimestamps.length;

  if (joinCount >= threshold) {
    const risk = Math.min(100, 70 + joinCount * 2);
    console.log(`[Security] Raid detected in ${guild.name}: ${joinCount} joins in ${windowMs / 1000}s`);

    tracker.isLockdown = true;
    tracker.lastRaidDetected = now;

    const memberRisk = calculateMemberRisk(member);
    const punishment = risk >= 80 ? 'BAN' : risk >= 60 ? 'TIMEOUT' : 'KICK';

    await Promise.all([
      punishmentEngine.punish(guild.id, member.id, punishment, `Luna: Raid pattern detected: ${joinCount} joins in ${windowMs / 1000}s`).catch(e => {
        console.log(`[Security] Failed to punish raid joiner: ${e.message}`);
        return null;
      }),
      incidentEngine.create(guild.id, 'antiraid', 'raid_detected', member.id, member.id, 'critical', risk, {
        joinCount,
        windowMs,
        threshold
      }, punishment)
    ]);

    console.log(`[Security] Lockdown activated in ${guild.name}`);
  } else if (tracker.isLockdown && joinCount > 0) {
    const memberRisk = calculateMemberRisk(member);

    if (memberRisk >= 60) {
      await punishmentEngine.punish(guild.id, member.id, 'TIMEOUT', 'Luna: Suspicious account joined during raid lockdown').catch(e => {
        console.log(`[Security] Failed to timeout suspicious joiner: ${e.message}`);
        return null;
      });

      await incidentEngine.create(guild.id, 'antiraid', 'suspicious_join', member.id, member.id, 'high', memberRisk, {
        joinCount,
        accountAge: now - member.user.createdTimestamp
      }, 'timeout');
    }
  }

  if (tracker.isLockdown && now - tracker.lastRaidDetected > windowMs * 3) {
    tracker.isLockdown = false;
    console.log(`[Security] Lockdown deactivated in ${guild.name}`);
  }
}
