import { PermissionFlagsBits } from 'discord.js';

const permissionWeights = new Map([
    [PermissionFlagsBits.Administrator, 100],
    [PermissionFlagsBits.ManageGuild, 90],
    [PermissionFlagsBits.ManageRoles, 90],
    [PermissionFlagsBits.ManageChannels, 80],
    [PermissionFlagsBits.ManageWebhooks, 70],
    [PermissionFlagsBits.BanMembers, 70],
    [PermissionFlagsBits.KickMembers, 60],
    [PermissionFlagsBits.ModerateMembers, 50],
    [PermissionFlagsBits.ManageMessages, 40],
    [PermissionFlagsBits.ManageThreads, 30],
    [PermissionFlagsBits.ManageNicknames, 20],
    [PermissionFlagsBits.ManageEvents, 20],
    [PermissionFlagsBits.MentionEveryone, 30]
]);

export function getRoleRisk(roles) {
    const roleArray = Array.isArray(roles) ? roles : Array.from(roles);
    let highestRisk = 0;

    for (const role of roleArray) {
        const perms = role.permissions?.bitfield ?? BigInt(0);
        for (const [perm, weight] of permissionWeights) {
            if ((perms & perm) === perm && weight > highestRisk) {
                highestRisk = weight;
            }
        }
    }

    return Math.min(highestRisk, 100);
}

export function isDangerousRole(roles) {
    return getRoleRisk(roles) >= 70;
}

export function isAdminRole(roles) {
    const roleArray = Array.isArray(roles) ? roles : Array.from(roles);
    return roleArray.some(role => {
        const perms = role.permissions?.bitfield ?? BigInt(0);
        return (perms & PermissionFlagsBits.Administrator) === PermissionFlagsBits.Administrator;
    });
}

export function getRiskLevel(risk) {
    if (risk >= 90) return 'CRITICAL';
    if (risk >= 70) return 'HIGH';
    if (risk >= 30) return 'MEDIUM';
    return 'LOW';
}

export function getDangerousPermissions(roles) {
    const dangerous = [];
    const roleArray = Array.isArray(roles) ? roles : Array.from(roles);

    for (const role of roleArray) {
        const perms = role.permissions?.bitfield ?? BigInt(0);
        for (const [perm, weight] of permissionWeights) {
            if ((perms & perm) === perm && weight >= 50) {
                const name = Object.keys(PermissionFlagsBits).find(
                    key => PermissionFlagsBits[key] === perm
                );
                if (name && !dangerous.includes(name)) {
                    dangerous.push(name);
                }
            }
        }
    }

    return dangerous;
}

export function getPermissionChanges(oldOverwrites, newOverwrites) {
    const old = Array.isArray(oldOverwrites) ? oldOverwrites : Array.from(oldOverwrites ?? []);
    const updated = Array.isArray(newOverwrites) ? newOverwrites : Array.from(newOverwrites ?? []);

    const added = updated.filter(
        newOw => !old.some(oldOw => oldOw.id === newOw.id)
    );
    const removed = old.filter(
        oldOw => !updated.some(newOw => newOw.id === oldOw.id)
    );
    const modified = updated.filter(newOw => {
        const oldOw = old.find(o => o.id === newOw.id);
        if (!oldOw) return false;
        return oldOw.allow.bitfield !== newOw.allow.bitfield ||
               oldOw.deny.bitfield !== newOw.deny.bitfield;
    });

    return { added, removed, modified };
}
