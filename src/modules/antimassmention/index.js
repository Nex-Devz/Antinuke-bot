export async function handleMessageCreate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const config = await database.getConfig(event.guild.id);
  if (!config?.modules?.antimassmention?.enabled) return;

  if (await whitelistManager.isWhitelisted(event.guild.id, event.author.id)) return;
  if (await ownerManager.isExtraOwner(event.guild.id, event.author.id)) return;

  const mentions = event.mentions;
  if (!mentions || mentions.length === 0) return;

  const hasEveryoneMention = event.content.includes('@everyone') || event.content.includes('@here');

  const tracker = cache.get(event.guild.id).massMentionTracker || {};
  if (!tracker[event.channel.id]) {
    tracker[event.channel.id] = [];
  }

  const now = Date.now();
  const window = config.modules.antimassmention.window || 10000;
  const threshold = config.modules.antimassmention.threshold || 5;

  tracker[event.channel.id].push({ timestamp: now, authorId: event.author.id, hasEveryoneMention });
  tracker[event.channel.id] = tracker[event.channel.id].filter(entry => now - entry.timestamp < window);

  const everyoneMentions = tracker[event.channel.id].filter(entry => entry.hasEveryoneMention);
  const rateLimitKey = `massmention:${event.channel.id}`;
  const recent = cache.checkRateLimit(event.guild.id, rateLimitKey, threshold, window);

  if (recent && everyoneMentions.length >= threshold) {
    const risk = calculateMassMentionRisk(everyoneMentions, threshold);
    console.log(`[Security] Mass mention abuse detected in ${event.guild.name} (risk: ${risk})`);

    try {
      await event.message.delete();
      console.log(`[Security] Deleted message from ${event.author.tag} in ${event.guild.name}`);
    } catch (err) {
      console.log(`[Security] Failed to delete message in ${event.guild.name}: ${err.message}`);
    }

    const action = config.modules.antimassmention.actions?.punish || 'timeout';
    await punishmentEngine.punish(event.guild.id, event.author.id, 'mass_mention_spam', action);
    await incidentEngine.create(event.guild.id, 'antimassmention', 'mass_mention', event.author.id, event.channel.id, 'high', risk, { mentionCount: everyoneMentions.length, window, threshold }, 'delete_and_punish');
  } else if (everyoneMentions.length >= Math.floor(threshold / 2)) {
    const risk = 30;
    await incidentEngine.create(event.guild.id, 'antimassmention', 'mass_mention_warning', event.author.id, event.channel.id, 'warning', risk, { mentionCount: everyoneMentions.length, window, threshold }, 'log_only');
  }

  console.log(`[Security] Message created by ${event.author.tag} in ${event.guild.name} (mentions: ${mentions.length})`);
}

function calculateMassMentionRisk(mentions, threshold) {
  let risk = 20;
  const count = mentions.length;
  if (count >= threshold) risk += 30;
  if (count >= threshold * 2) risk += 30;
  if (count >= threshold * 3) risk += 15;
  return Math.min(risk, 100);
}
