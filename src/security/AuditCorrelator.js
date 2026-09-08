import { AuditLogEvent } from 'discord.js';

const EVENT_MAP = {
    'CHANNEL_CREATE': AuditLogEvent.ChannelCreate,
    'CHANNEL_UPDATE': AuditLogEvent.ChannelUpdate,
    'CHANNEL_DELETE': AuditLogEvent.ChannelDelete,
    'ROLE_CREATE': AuditLogEvent.RoleCreate,
    'ROLE_UPDATE': AuditLogEvent.RoleUpdate,
    'ROLE_DELETE': AuditLogEvent.RoleDelete,
    'MEMBER_KICK': AuditLogEvent.MemberKick,
    'MEMBER_BAN_ADD': AuditLogEvent.MemberBanAdd,
    'MEMBER_BAN_REMOVE': AuditLogEvent.MemberBanRemove,
    'MEMBER_ROLE_UPDATE': AuditLogEvent.MemberRoleUpdate,
    'BOT_ADD': AuditLogEvent.BotAdd,
    'INVITE_CREATE': AuditLogEvent.InviteCreate,
    'INVITE_DELETE': AuditLogEvent.InviteDelete,
    'WEBHOOK_CREATE': AuditLogEvent.WebhookCreate,
    'WEBHOOK_UPDATE': AuditLogEvent.WebhookUpdate,
    'WEBHOOK_DELETE': AuditLogEvent.WebhookDelete,
    'EMOJI_CREATE': AuditLogEvent.EmojiCreate,
    'EMOJI_UPDATE': AuditLogEvent.EmojiUpdate,
    'EMOJI_DELETE': AuditLogEvent.EmojiDelete,
    'STICKER_CREATE': AuditLogEvent.StickerCreate,
    'STICKER_UPDATE': AuditLogEvent.StickerUpdate,
    'STICKER_DELETE': AuditLogEvent.StickerDelete,
    'GUILD_SCHEDULED_EVENT_CREATE': AuditLogEvent.GuildScheduledEventCreate,
    'GUILD_SCHEDULED_EVENT_UPDATE': AuditLogEvent.GuildScheduledEventUpdate,
    'GUILD_SCHEDULED_EVENT_DELETE': AuditLogEvent.GuildScheduledEventDelete,
    'AUTO_MODERATION_RULE_CREATE': AuditLogEvent.AutoModerationRuleCreate,
    'AUTO_MODERATION_RULE_UPDATE': AuditLogEvent.AutoModerationRuleUpdate,
    'AUTO_MODERATION_RULE_DELETE': AuditLogEvent.AutoModerationRuleDelete
};

export class AuditCorrelator {
    constructor(client, cache) {
        this.client = client;
        this.cache = cache;
        this.internalCache = new Map();
    }

    #getCache(key) {
        const item = this.internalCache.get(key);
        if (!item) return undefined;
        if (Date.now() > item.expires) {
            this.internalCache.delete(key);
            return undefined;
        }
        return item.value;
    }

    #setCache(key, value, ttlMs) {
        this.internalCache.set(key, { value, expires: Date.now() + ttlMs });
    }

    #resolveActionType(type) {
        if (typeof type === 'number') return type;
        if (EVENT_MAP[type]) return EVENT_MAP[type];
        if (AuditLogEvent[type]) return AuditLogEvent[type];
        return type;
    }

    async resolveExecutor(guild, actionType, targetId, windowMs = 7000) {
        if (!guild) return null;
        const resolvedType = this.#resolveActionType(actionType);
        const cacheKey = `${guild.id}:${resolvedType}:${targetId || 'any'}`;
        const cached = this.#getCache(cacheKey);
        if (cached !== undefined) return cached;

        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const fetchOptions = { limit: 10 };
                if (resolvedType !== undefined) {
                    fetchOptions.type = resolvedType;
                }

                const auditLogs = await guild.fetchAuditLogs(fetchOptions).catch(() => null);
                if (auditLogs && auditLogs.entries) {
                    const now = Date.now();
                    for (const [, entry] of auditLogs.entries) {
                        const targetMatches = !targetId || entry.targetId === String(targetId) || entry.target?.id === String(targetId);
                        if (targetMatches) {
                            const timeDiff = now - entry.createdTimestamp;
                            if (timeDiff <= windowMs) {
                                const id = String(entry.executorId || entry.executor?.id || '');
                                if (id) {
                                    this.#setCache(cacheKey, id, 30000);
                                    return id;
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                // fall through to retry
            }

            if (attempt === 0) {
                await new Promise(r => setTimeout(r, 600));
            }
        }

        this.#setCache(cacheKey, null, 3000);
        return null;
    }

    async resolveBanExecutor(guild, targetId) {
        return this.resolveExecutor(guild, AuditLogEvent.MemberBanAdd, targetId, 12000);
    }

    async resolveKickExecutor(guild, targetId) {
        return this.resolveExecutor(guild, AuditLogEvent.MemberKick, targetId, 12000);
    }

    async resolveRoleChangeExecutor(guild, roleId) {
        return this.resolveExecutor(guild, AuditLogEvent.RoleUpdate, roleId, 7000);
    }

    async resolveChannelChangeExecutor(guild, channelId) {
        return (
            await this.resolveExecutor(guild, AuditLogEvent.ChannelDelete, channelId, 7000) ||
            await this.resolveExecutor(guild, AuditLogEvent.ChannelUpdate, channelId, 7000) ||
            await this.resolveExecutor(guild, AuditLogEvent.ChannelCreate, channelId, 7000)
        );
    }
}
