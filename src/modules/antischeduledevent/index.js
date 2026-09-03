import { PermissionsBitField } from 'discord.js';

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
  while (arr.length > 0 && now - arr[0] > windowMs) {
    arr.shift();
  }
}

function isWhitelisted(context, userId, guildId) {
  if (context.whitelistManager?.isWhitelisted(userId, guildId)) return true;
  if (context.ownerManager?.isExtraOwner(userId, guildId)) return true;
  return false;
}

export async function handleScheduledEventCreate(event, context) {
  const { client, cache, incidentEngine, punishmentEngine } = context;
  const { guild, scheduledEvent } = event;
  if (!guild || !scheduledEvent) return;

  if (!cache.moduleState?.antiScheduledEvent?.enabled) return;

  const userId = scheduledEvent.creatorId || scheduledEvent.user?.id;
  if (!userId) return;
  if (isWhitelisted(context, userId, guild.id)) return;

  const tracker = getEventTracker(cache, guild.id);
  const now = Date.now();
  tracker.creates.push(now);
  pruneTimestamps(tracker.creates, RATE_WINDOW);

  const count = tracker.creates.length;
  if (count >= EVENT_CREATE_THRESHOLD) {
    const risk = Math.min(100, 60 + count * 5);
    console.log(`[Security] Event creation spam detected in ${guild.name} (${guild.id}) by ${userId}: ${count} events in ${RATE_WINDOW / 1000}s`);

    await punishmentEngine?.punish(guild, userId, 'scheduled_event_create_spam', {
      risk,
      reason: `${count} scheduled events created in rapid succession`,
      duration: '1h',
    });

    await incidentEngine?.log({
      type: 'scheduled_event_create_spam',
      guildId: guild.id,
      userId,
      risk,
      details: { eventCount: count, windowMs: RATE_WINDOW, eventName: scheduledEvent.name },
    });
  }
}

export async function handleScheduledEventUpdate(event, context) {
  const { client, cache, incidentEngine } = context;
  const { guild, scheduledEvent } = event;
  if (!guild || !scheduledEvent) return;

  if (!cache.moduleState?.antiScheduledEvent?.enabled) return;

  const userId = scheduledEvent.creatorId || scheduledEvent.user?.id;
  if (!userId) return;
  if (isWhitelisted(context, userId, guild.id)) return;

  const oldStatus = event.oldScheduledEvent?.status;
  const newStatus = scheduledEvent.status;
  const oldName = event.oldScheduledEvent?.name;
  const newName = scheduledEvent.name;

  if (oldName !== newName || oldStatus !== newStatus) {
    const risk = 40;
    console.log(`[Security] Scheduled event updated in ${guild.name} (${guild.id}) by ${userId}`);

    await incidentEngine?.log({
      type: 'scheduled_event_update',
      guildId: guild.id,
      userId,
      risk,
      details: {
        eventId: scheduledEvent.id,
        oldName,
        newName,
        oldStatus,
        newStatus,
      },
    });
  }
}

export async function handleScheduledEventDelete(event, context) {
  const { client, cache, incidentEngine, punishmentEngine } = context;
  const { guild, scheduledEvent } = event;
  if (!guild || !scheduledEvent) return;

  if (!cache.moduleState?.antiScheduledEvent?.enabled) return;

  const userId = event.userId || scheduledEvent.creatorId;
  if (!userId) return;
  if (isWhitelisted(context, userId, guild.id)) return;

  const tracker = getEventTracker(cache, guild.id);
  const now = Date.now();
  tracker.deletes.push(now);
  pruneTimestamps(tracker.deletes, RATE_WINDOW);

  const count = tracker.deletes.length;
  if (count >= EVENT_DELETE_THRESHOLD) {
    const risk = Math.min(100, 65 + count * 5);
    console.log(`[Security] Event deletion spam detected in ${guild.name} (${guild.id}) by ${userId}: ${count} deletions in ${RATE_WINDOW / 1000}s`);

    await punishmentEngine?.punish(guild, userId, 'scheduled_event_delete_spam', {
      risk,
      reason: `${count} scheduled events deleted in rapid succession`,
      duration: '1h',
    });

    await incidentEngine?.log({
      type: 'scheduled_event_delete_spam',
      guildId: guild.id,
      userId,
      risk,
      details: { deletionCount: count, windowMs: RATE_WINDOW, eventId: scheduledEvent.id },
    });
  }
}
