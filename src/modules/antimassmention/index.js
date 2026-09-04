export async function handleMessageCreate(message, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, whitelistManager, ownerManager } = context;

  if (!message.guild) return;

  const config = await database.getConfig(message.guild.id);
  if (!config?.modules?.antimassmention?.enabled) return;

  if (await whitelistManager.isWhitelisted(message.guild.id, message.author.id)) return;
  if (await ownerManager.isExtraOwner(message.guild.id, message.author.id)) return;

  const mentions = message.mentions;
  if (!mentions || mentions.users.size === 0) return;

  const hasEveryoneMention = message.content.includes('@everyone') || message.content.includes('@here');

  const state = cache.get(message.guild.id);
  if (!state.massMentionTracker) state.massMentionTracker = {};

  const channelId = message.channel.id;
  if (!state.massMentionTracker[channelId]) {
    state.massMentionTracker[channelId] = [];
  }

  const now = Date.now();
  const window = config.modules.antimassmention.window || 10000;
  const threshold = config.modules.antimassmention.threshold || 5;

  state.massMentionTracker[channelId].push({ timestamp: now, authorId: message.author.id, hasEveryoneMention });
  state.massMentionTracker[channelId] = state.massMentionTracker[channelId].filter(entry => now - entry.timestamp < window);

  const everyoneMentions = state.massMentionTracker[channelId].filter(entry => entry.hasEveryoneMention);

  if (everyoneMentions.length >= threshold) {
    const risk = Math.min(20 + everyoneMentions.length * 10, 100);
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
