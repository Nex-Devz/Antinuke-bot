export class AuditCorrelator {
    constructor(client, cache) {
        this.client = client;
        this.cache = cache;
    }

    async resolveExecutor(guild, actionType, targetId, windowMs = 5000) {
        const cacheKey = `${guild.id}:${actionType}:${targetId}`;
        const cached = this.cache?.get(cacheKey);
        if (cached !== undefined) return cached;

        try {
            const auditLogs = await guild.fetchAuditLogs({
                type: actionType,
                limit: 20
            });

            const now = Date.now();
            for (const [, entry] of auditLogs.entries) {
                if (entry.targetId === targetId) {
                    const timeDiff = now - entry.createdTimestamp;
                    if (timeDiff <= windowMs) {
                        this.cache?.set(cacheKey, entry.executorId, 30000);
                        return entry.executorId;
                    }
                }
            }

            this.cache?.set(cacheKey, null, 5000);
            return null;
        } catch (error) {
            this.cache?.set(cacheKey, null, 5000);
            return null;
        }
    }

    async resolveBanExecutor(guild, targetId) {
        return this.resolveExecutor(guild, 'MEMBER_BAN_ADD', targetId, 10000);
    }

    async resolveKickExecutor(guild, targetId) {
        return this.resolveExecutor(guild, 'MEMBER_KICK', targetId, 10000);
    }

    async resolveRoleChangeExecutor(guild, roleId) {
        const cacheKey = `${guild.id}:ROLE_CHANGE:${roleId}`;
        const cached = this.cache?.get(cacheKey);
        if (cached !== undefined) return cached;

        try {
            const auditLogs = await guild.fetchAuditLogs({
                type: 'ROLE_UPDATE',
                limit: 20
            });

            const now = Date.now();
            for (const [, entry] of auditLogs.entries) {
                if (entry.targetId === roleId) {
                    const timeDiff = now - entry.createdTimestamp;
                    if (timeDiff <= 5000) {
                        this.cache?.set(cacheKey, entry.executorId, 30000);
                        return entry.executorId;
                    }
                }
            }

            this.cache?.set(cacheKey, null, 5000);
            return null;
        } catch (error) {
            this.cache?.set(cacheKey, null, 5000);
            return null;
        }
    }

    async resolveChannelChangeExecutor(guild, channelId) {
        const cacheKey = `${guild.id}:CHANNEL_CHANGE:${channelId}`;
        const cached = this.cache?.get(cacheKey);
        if (cached !== undefined) return cached;

        try {
            const actionTypes = [
                'CHANNEL_CREATE',
                'CHANNEL_UPDATE',
                'CHANNEL_DELETE'
            ];

            for (const actionType of actionTypes) {
                const auditLogs = await guild.fetchAuditLogs({
                    type: actionType,
                    limit: 20
                });

                const now = Date.now();
                for (const [, entry] of auditLogs.entries) {
                    if (entry.targetId === channelId) {
                        const timeDiff = now - entry.createdTimestamp;
                        if (timeDiff <= 5000) {
                            this.cache?.set(cacheKey, entry.executorId, 30000);
                            return entry.executorId;
                        }
                    }
                }
            }

            this.cache?.set(cacheKey, null, 5000);
            return null;
        } catch (error) {
            this.cache?.set(cacheKey, null, 5000);
            return null;
        }
    }
}
