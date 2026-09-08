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
        this.inFlightFetches = new Map();
        this.recentAuditEntries = new Map();
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
        if (EVENT_MAP[type] !== undefined) return EVENT_MAP[type];
        if (AuditLogEvent[type] !== undefined) return AuditLogEvent[type];
        return type;
    }

    async #fetchAuditLogsDeduplicated(guild, resolvedType, forceRefresh = false) {
        const fetchKey = `${guild.id}:${resolvedType !== undefined ? resolvedType : 'all'}`;
        const now = Date.now();

        if (!forceRefresh) {
            const cachedBatch = this.recentAuditEntries.get(fetchKey);
            if (cachedBatch && (now - cachedBatch.timestamp < 1500)) {
                return cachedBatch.entries;
            }
        }

        if (this.inFlightFetches.has(fetchKey)) {
            return await this.inFlightFetches.get(fetchKey);
        }

        const fetchPromise = (async () => {
            try {
                const fetchOptions = { limit: 15 };
                if (resolvedType !== undefined) {
                    fetchOptions.type = resolvedType;
                }

                const auditLogs = await guild.fetchAuditLogs(fetchOptions);
                const entries = auditLogs?.entries ? Array.from(auditLogs.entries.values()) : [];

                for (const entry of entries) {
                    const executorId = String(entry.executorId || entry.executor?.id || '');
                    const targetId = String(entry.targetId || entry.target?.id || '');
                    if (executorId && targetId) {
                        const directKey = `${guild.id}:${entry.action}:${targetId}`;
                        this.#setCache(directKey, executorId, 30000);
                    }
                }

                this.recentAuditEntries.set(fetchKey, { entries, timestamp: Date.now() });
                return entries;
            } catch (err) {
                if (err.code === 50013) {
                    console.error(`[Security] Audit log fetch failed in ${guild.name}: Missing ViewAuditLog permission!`);
                } else if (err.status === 429) {
                    console.warn(`[Security] Audit log rate limited in ${guild.name}, backing off.`);
                } else {
                    console.error(`[Security] Audit log fetch error in ${guild.name}:`, err.message);
                }
                return [];
            } finally {
                this.inFlightFetches.delete(fetchKey);
            }
        })();

        this.inFlightFetches.set(fetchKey, fetchPromise);
        return await fetchPromise;
    }

    async resolveExecutor(guild, actionType, targetId, windowMs = 7000) {
        if (!guild) return null;
        const resolvedType = this.#resolveActionType(actionType);
        const cacheKey = `${guild.id}:${resolvedType}:${targetId || 'any'}`;
        const cached = this.#getCache(cacheKey);
        if (cached !== undefined) return cached;

        const delays = [0, 200, 350, 500];

        for (let attempt = 0; attempt < delays.length; attempt++) {
            if (delays[attempt] > 0) {
                await new Promise(r => setTimeout(r, delays[attempt]));
            }

            try {
                const entries = await this.#fetchAuditLogsDeduplicated(guild, resolvedType, attempt > 0);
                if (entries && entries.length > 0) {
                    const now = Date.now();

                    // 1. Exact target match
                    for (const entry of entries) {
                        const targetMatches = !targetId || entry.targetId === String(targetId) || entry.target?.id === String(targetId);
                        if (targetMatches) {
                            const timeDiff = Math.abs(now - entry.createdTimestamp);
                            if (timeDiff <= windowMs) {
                                const id = String(entry.executorId || entry.executor?.id || '');
                                if (id) {
                                    this.#setCache(cacheKey, id, 30000);
                                    return id;
                                }
                            }
                        }
                    }

                    // 2. Heuristic fallback on subsequent attempts (attempt >= 1):
                    // If mass actions are occurring and exact targetId is slightly delayed,
                    // correlate with the most recent entry of this action type if within 4000ms
                    // and not performed by the bot itself or guild owner.
                    if (attempt >= 1) {
                        for (const entry of entries) {
                            const timeDiff = Math.abs(now - entry.createdTimestamp);
                            if (timeDiff <= 4000) {
                                const id = String(entry.executorId || entry.executor?.id || '');
                                if (id && id !== this.client?.user?.id && id !== guild.ownerId) {
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
        }

        this.#setCache(cacheKey, null, 500);
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
