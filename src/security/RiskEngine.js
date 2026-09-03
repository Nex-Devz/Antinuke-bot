import { getRoleRisk, getRiskLevel } from './PermissionAnalyzer.js';

export function calculateChannelRisk(guild, action, data) {
    let risk = 0;

    if (action === 'create') {
        risk = 40;
        const channels = guild.channels?.cache?.size ?? 0;
        if (channels > 50) risk += 10;
        if (data?.type !== undefined) {
            if (data.type === 0 || data.type === 5) risk += 10;
            if (data.type === 2 || data.type === 13) risk += 20;
        }
    } else if (action === 'delete') {
        risk = 50;
        const channels = guild.channels?.cache?.size ?? 0;
        if (channels < 3) risk += 30;
        if (data?.channel) {
            const memberCount = guild.memberCount ?? 0;
            if (memberCount > 1000) risk += 15;
        }
    } else if (action === 'update') {
        risk = 30;
        if (data?.permissionUpdates?.length > 0) risk += 25;
        if (data?.nameChanged) risk += 5;
        if (data?.topicChanged) risk += 10;
    }

    return Math.min(risk, 100);
}

export function calculateRoleRisk(guild, action, data) {
    let risk = 0;

    if (action === 'create') {
        risk = 35;
        if (data?.permissions) {
            const roleRisk = getRoleRisk([{ permissions: { bitfield: data.permissions } }]);
            risk = Math.max(risk, roleRisk);
        }
        if (data?.mentionable) risk += 10;
        if (data?.hoist) risk += 10;
    } else if (action === 'delete') {
        risk = 45;
        const roles = guild.roles?.cache?.size ?? 0;
        if (roles < 3) risk += 25;
        if (data?.memberCount && data.memberCount > guild.memberCount * 0.5) risk += 20;
    } else if (action === 'update') {
        risk = 30;
        if (data?.permissionChanges) {
            const changes = data.permissionChanges;
            if (changes.added?.length > 0) risk += 20;
            if (changes.removed?.length > 0) risk += 10;
        }
        if (data?.hoistChanged) risk += 10;
        if (data?.mentionableChanged) risk += 10;
    }

    return Math.min(risk, 100);
}

export function calculateInviteRoleRisk(guild, roleIds) {
    if (!roleIds?.length) return 0;

    let risk = 0;
    const roles = roleIds.map(id => guild.roles?.cache?.get(id)).filter(Boolean);
    const roleRisk = getRoleRisk(roles);

    risk = roleRisk;
    if (roles.length > 5) risk += 15;
    if (roles.length > 10) risk += 25;

    return Math.min(risk, 100);
}

export function calculateMassActionRisk(count, windowMs, threshold) {
    if (count < threshold) return 0;

    const ratio = count / threshold;
    let risk = Math.min(ratio * 50, 80);

    if (windowMs < 60000) risk += 20;
    else if (windowMs < 300000) risk += 10;

    return Math.min(Math.round(risk), 100);
}

export function calculateRaidRisk(memberCount, timeWindowMs) {
    if (memberCount < 5) return 0;

    const membersPerSecond = memberCount / (timeWindowMs / 1000);
    let risk = 0;

    if (membersPerSecond > 10) risk = 90;
    else if (membersPerSecond > 5) risk = 75;
    else if (membersPerSecond > 2) risk = 60;
    else if (membersPerSecond > 1) risk = 40;
    else risk = 20;

    if (memberCount > 50) risk += 10;
    if (memberCount > 100) risk += 10;

    return Math.min(risk, 100);
}

export function calculateBanRisk(banCount, windowMs) {
    if (banCount === 0) return 0;

    const bansPerMinute = banCount / (windowMs / 60000);
    let risk = 0;

    if (bansPerMinute > 10) risk = 85;
    else if (bansPerMinute > 5) risk = 70;
    else if (bansPerMinute > 2) risk = 50;
    else risk = 30;

    if (banCount > 20) risk += 15;
    if (windowMs < 60000) risk += 15;

    return Math.min(risk, 100);
}

export function calculateKickRisk(kickCount, windowMs) {
    if (kickCount === 0) return 0;

    const kicksPerMinute = kickCount / (windowMs / 60000);
    let risk = 0;

    if (kicksPerMinute > 10) risk = 80;
    else if (kicksPerMinute > 5) risk = 65;
    else if (kicksPerMinute > 2) risk = 45;
    else risk = 25;

    if (kickCount > 15) risk += 15;
    if (windowMs < 60000) risk += 15;

    return Math.min(risk, 100);
}

export function calculateWebhookRisk(action, webhookCount) {
    let risk = 0;

    if (action === 'create') {
        risk = 40;
        if (webhookCount > 5) risk += 20;
        if (webhookCount > 10) risk += 30;
    } else if (action === 'delete') {
        risk = 30;
        if (webhookCount === 0) risk += 20;
    } else if (action === 'update') {
        risk = 25;
    } else if (action === 'execute') {
        risk = 35;
        if (webhookCount > 3) risk += 20;
    }

    return Math.min(risk, 100);
}

export function calculateBotRisk(guild, bot) {
    let risk = 0;

    if (!bot) return 0;

    const isOwner = bot.id === guild.ownerId;
    if (isOwner) return 0;

    const botPerms = bot.permissions ?? BigInt(0);
    const hasAdmin = (botPerms & BigInt(8)) === BigInt(8);
    const hasManageGuild = (botPerms & BigInt(32)) === BigInt(32);
    const hasManageRoles = (botPerms & BigInt(268435456)) === BigInt(268435456);
    const hasManageChannels = (botPerms & BigInt(16)) === BigInt(16);

    if (hasAdmin) risk += 80;
    if (hasManageGuild) risk += 40;
    if (hasManageRoles) risk += 50;
    if (hasManageChannels) risk += 30;

    const botCount = guild.members?.cache?.filter(m => m.user?.bot)?.size ?? 0;
    if (botCount > 3) risk += 15;
    if (botCount > 5) risk += 20;

    return Math.min(risk, 100);
}
