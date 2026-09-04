const EVENT_CREATE_THRESHOLD = 5;
const EVENT_DELETE_THRESHOLD = 5;
const RATE_WINDOW = 10_000;

function getEventTracker(cache, guildId) {
  const key = 'antiScheduledEvent';
  if (!cache[key]) cache[key] = {};
  if (!cache[key][guildId]) {
    cache[key][guildId] = {
      creates: [],
      deletes: [],
    };
  }
  return cache[key][guildId];
}

function pruneTimestamps(arr, windowMs) {
  const now = Date.now();
  while (arr.length > 0 && now - arr[0] > windowMs) arr.shift();
}

export async function handleScheduledEventCreate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, whitelistManager, ownerManager } = context;
  const { guild, scheduledEvent } = event;
  if (!guild || !scheduledEvent) return;

  const config = await database.getConfig(guild.id);
  if (!config?.modules?.antischeduledevent?.enabled) return;

  const userId = scheduledEvent.creatorId || scheduledEvent.user?.id;
  if (!userId) return;
  if (await whitelistManager.isWhitelisted(guild.id, userId)) return;
  if (await ownerManager.isExtraOwner(guild.id, userId)) return;

  const tracker = getEventTracker(cache, guild.id);
  const now = Date.now();
  tracker.creates.push(now);
  pruneTimestamps(tracker.creates, RATE_WINDOW);

  const count = tracker.creates.length;
  if (count >= EVENT_CREATE_THRESHOLD) {
    const risk = Math.min(100, 60 + count * 5);
    console.log(`[Security] Event creation spam detected in ${guild.name} by ${userId}: ${count} events`);

    await Promise.all([
      punishmentEngine.punish(guild.id, userId, 'TIMEOUT', `Luna: ${count} scheduled events created rapidly`).catch(e => {
        console.log(`[Security] Failed to punish: ${e.message}`);
        return null;
      }),
      incidentEngine.create(guild.id, 'antischeduledevent', 'create_spam', userId, scheduledEvent.id, 'high', risk, {
        eventCount: count,
        windowMs: RATE_WINDOW,
        eventName: scheduledEvent.name
      }, 'timeout')
    ]);
  }
}

export async function handleScheduledEventUpdate(event, context) {
  const { database, incidentEngine, whitelistManager, ownerManager } = context;
  const { guild, scheduledEvent } = event;
  if (!guild || !scheduledEvent) return;

  const config = await database.getConfig(guild.id);
  if (!config?.modules?.antischeduledevent?.enabled) return;

  const userId = scheduledEvent.creatorId || scheduledEvent.user?.id;
  if (!userId) return;
  if (await whitelistManager.isWhitelisted(guild.id, userId)) return;
  if (await ownerManager.isExtraOwner(guild.id, userId)) return;

  const oldStatus = event.oldScheduledEvent?.status;
  const newStatus = scheduledEvent.status;
  const oldName = event.oldScheduledEvent?.name;
  const newName = scheduledEvent.name;

  if (oldName !== newName || oldStatus !== newStatus) {
    console.log(`[Security] Scheduled event updated in ${guild.name} by ${userId}`);

    await incidentEngine.create(guild.id, 'antischeduledevent', 'update', userId, scheduledEvent.id, 'medium', 40, {
      eventId: scheduledEvent.id,
      oldName,
      newName,
      oldStatus,
      newStatus
    }, 'log');
  }
}

export async function handleScheduledEventDelete(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, whitelistManager, ownerManager } = context;
  const { guild, scheduledEvent } = event;
  if (!guild || !scheduledEvent) return;

  const config = await database.getConfig(guild.id);
  if (!config?.modules?.antischeduledevent?.enabled) return;

  const userId = event.userId || scheduledEvent.creatorId;
  if (!userId) return;
  if (await whitelistManager.isWhitelisted(guild.id, userId)) return;
  if (await ownerManager.isExtraOwner(guild.id, userId)) return;

  const tracker = getEventTracker(cache, guild.id);
  const now = Date.now();
  tracker.deletes.push(now);
  pruneTimestamps(tracker.deletes, RATE_WINDOW);

  const count = tracker.deletes.length;
  if (count >= EVENT_DELETE_THRESHOLD) {
    const risk = Math.min(100, 65 + count * 5);
    console.log(`[Security] Event deletion spam in ${guild.name} by ${userId}: ${count} in ${RATE_WINDOW / 1000}s`);

    await Promise.all([
      punishmentEngine.punish(guild.id, userId, 'TIMEOUT', `Luna: ${count} events deleted rapidly`).catch(e => {
        console.log(`[Security] Failed to punish: ${e.message}`);
        return null;
      }),
      incidentEngine.create(guild.id, 'antischeduledevent', 'delete_spam', userId, scheduledEvent.id, 'high', risk, {
        deletionCount: count,
        windowMs: RATE_WINDOW,
        eventId: scheduledEvent.id
      }, 'timeout')
    ]);
  }
}