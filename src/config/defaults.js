export function createDefaultConfig(guildId) {
  return {
    guildId,
    antiChannel: {
      enabled: true,
      thresholds: { maxPerMinute: 3, maxPer5Minutes: 5 },
      actions: { notify: true, restore: true, punish: 'ban' }
    },
    antiRole: {
      enabled: true,
      thresholds: { maxPerMinute: 3, maxPer5Minutes: 5 },
      actions: { notify: true, restore: true, punish: 'ban' }
    },
    antiPermission: {
      enabled: true,
      thresholds: { maxPerMinute: 2, maxPer5Minutes: 4 },
      actions: { notify: true, restore: true, punish: 'ban' }
    },
    antiWebhook: {
      enabled: true,
      thresholds: { maxPerMinute: 2, maxPer5Minutes: 3 },
      actions: { notify: true, delete: true, punish: 'ban' }
    },
    antiEmoji: {
      enabled: true,
      thresholds: { maxPerMinute: 5, maxPer5Minutes: 10 },
      actions: { notify: true, restore: true, punish: 'kick' }
    },
    antiSticker: {
      enabled: true,
      thresholds: { maxPerMinute: 3, maxPer5Minutes: 5 },
      actions: { notify: true, restore: true, punish: 'kick' }
    },
    antiBan: {
      enabled: true,
      thresholds: { maxPerMinute: 3, maxPer5Minutes: 5 },
      actions: { notify: true, unban: true, punish: 'ban' }
    },
    antiKick: {
      enabled: true,
      thresholds: { maxPerMinute: 3, maxPer5Minutes: 5 },
      actions: { notify: true, punish: 'ban' }
    },
    antiMemberRole: {
      enabled: true,
      thresholds: { maxPerMinute: 5, maxPer5Minutes: 10 },
      actions: { notify: true, restore: true, punish: 'kick' }
    },
    antiAdminEscalation: {
      enabled: true,
      thresholds: { maxPerMinute: 1, maxPer5Minutes: 2 },
      actions: { notify: true, remove: true, punish: 'ban' }
    },
    antiBot: {
      enabled: true,
      thresholds: { maxPerMinute: 3, maxPer5Minutes: 5 },
      actions: { notify: true, kick: true, punish: 'ban' }
    },
    antiIntegration: {
      enabled: true,
      thresholds: { maxPerMinute: 2, maxPer5Minutes: 3 },
      actions: { notify: true, remove: true, punish: 'ban' }
    },
    antiAutoMod: {
      enabled: true,
      thresholds: { maxPerMinute: 2, maxPer5Minutes: 3 },
      actions: { notify: true, restore: true, punish: 'ban' }
    },
    antiScheduledEvent: {
      enabled: true,
      thresholds: { maxPerMinute: 3, maxPer5Minutes: 5 },
      actions: { notify: true, delete: true, punish: 'kick' }
    },
    antiInvite: {
      enabled: true,
      thresholds: { maxPerMinute: 3, maxPer5Minutes: 5 },
      actions: { notify: true, delete: true, punish: 'kick' }
    },
    antiInviteRole: {
      enabled: true,
      thresholds: { maxPerMinute: 2, maxPer5Minutes: 3 },
      actions: { notify: true, remove: true, punish: 'kick' }
    },
    antiLinkedRole: {
      enabled: true,
      thresholds: { maxPerMinute: 2, maxPer5Minutes: 3 },
      actions: { notify: true, remove: true, punish: 'kick' }
    },
    antiRaid: {
      enabled: true,
      thresholds: { joinsPerMinute: 10, joinsPer5Minutes: 25 },
      actions: { notify: true, lockdown: true, punish: 'ban' }
    },
    antiMassMention: {
      enabled: true,
      thresholds: { maxPerMinute: 5, maxPer5Minutes: 10 },
      actions: { notify: true, delete: true, punish: 'kick' }
    },
    emergencyLockdown: {
      enabled: false,
      thresholds: {},
      actions: { lockdown: true, notify: true, channels: 'all' }
    }
  };
}
