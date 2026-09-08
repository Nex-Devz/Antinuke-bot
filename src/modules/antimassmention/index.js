export async function handleMessageCreate(message, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, whitelistManager, ownerManager } = context;

  if (!message.guild) return;

  const config = await database.getConfig(message.guild.id);
  if (!config?.modules?.antimassmention?.enabled) return;

  if (await whitelistManager.isWhitelisted(message.guild.id, message.author.id)) return;
  if (await ownerManager.isExtraOwner(message.guild.id, message.author.id)) return;

  const mentions = message.mentions;
  const userMentionCount = mentions?.users?.size || 0;
  const roleMentionCount = mentions?.roles?.size || 0;
  const hasEveryoneMention = Boolean(mentions?.everyone || message.content?.includes('@everyone') || message.content?.includes('@here'));

  if (!hasEveryoneMention && userMentionCount === 0 && roleMentionCount === 0) return;

  const state = cache.get(message.guild.id) || {};
  if (!state.massMentionTracker) state.massMentionTracker = {};

  const channelId = message.channel.id;
  if (!state.massMentionTracker[channelId]) {
    state.massMentionTracker[channelId] = [];
  }

  const now = Date.now();
  const window = config.modules.antimassmention.window || 10000;
  const threshold = config.modules.antimassmention.threshold || 5;

  const totalMentionsInMsg = (hasEveryoneMention ? 5 : 0) + userMentionCount + roleMentionCount;

  state.massMentionTracker[channelId].push({
    timestamp: now,
    authorId: message.author.id,
    hasEveryoneMention,
    mentionCount: totalMentionsInMsg
  });
  state.massMentionTracker[channelId] = state.massMentionTracker[channelId].filter(entry => now - entry.timestamp < window);

  const authorEntries = state.massMentionTracker[channelId].filter(entry => entry.authorId === message.author.id);
  const totalRecentMentions = authorEntries.reduce((sum, e) => sum + (e.mentionCount || 1), 0);
  const everyoneMentions = authorEntries.filter(entry => entry.hasEveryoneMention);

  if (everyoneMentions.length >= threshold || totalRecentMentions >= threshold) {
    const risk = Math.min(30 + Math.max(everyoneMentions.length * 10, totalRecentMentions * 5), 100);
    console.log(`[Security] Mass mention abuse in ${message.guild.name} (risk: ${risk})`);

    try {
      await message.delete();
    } catch {}

    const punishAction = config.modules.antimassmention.actions?.punish || 'TIMEOUT';

    await Promise.all([
      punishmentEngine.punish(message.guild.id, message.author.id, punishAction, 'Luna: Mass mention abuse').catch(e => {
        console.log(`[Security] Failed to punish: ${e.message}`);
        return null;
      }),
      incidentEngine.create(message.guild.id, 'antimassmention', 'mass_mention', message.author.id, message.channel.id, 'high', risk, {
        mentionCount: everyoneMentions.length,
        window,
        threshold
      }, 'delete_and_punish')
    ]);
  } else if (everyoneMentions.length >= Math.floor(threshold / 2)) {
    await incidentEngine.create(message.guild.id, 'antimassmention', 'mass_mention_warning', message.author.id, message.channel.id, 'warning', 30, {
      mentionCount: everyoneMentions.length,
      window,
      threshold
    }, 'log_only');
  }
}
