import { PermissionsBitField } from 'discord.js';

const DANGEROUS_PERMS = [
  'Administrator',
  'ManageGuild',
  'ManageRoles',
  'ManageChannels',
  'ManageMessages',
  'MentionEveryone',
  'BanMembers',
  'KickMembers',
  'ManageWebhooks',
  'ManageEmojisAndStickers',
  'ManageEvents',
  'ModerateMembers',
  'ViewAuditLog'
];

function getLinkedRoleCache(cache, guildId) {
  if (!cache.antiLinkedRole) cache.antiLinkedRole = {};
  if (!cache.antiLinkedRole[guildId]) {
    cache.antiLinkedRole[guildId] = { roleIds: new Set() };
  }
  return cache.antiLinkedRole[guildId];
}

function isLinkedRole(role) {
  if (!role?.tags) return false;
  const tags = role.tags;
  if (tags.bot_id || tags.integration_id) return false;
  if (tags.premium_subscriber !== undefined) return false;
  if (tags.available_for_purchase !== undefined) return false;
  if (tags.guild_connections !== undefined) return false;
  return Object.keys(tags).length > 0;
}

function hasDangerousPerms(permissions) {
  const perms = new PermissionsBitField(permissions.bitfield);
  return DANGEROUS_PERMS.filter(p => perms.has(PermissionsBitField.Flags[p]));
}

function removeDangerousPerms(rolePermissions, dangerousList) {
  let perms = BigInt(rolePermissions.bitfield);
  for (const p of dangerousList) {
    perms &= ~BigInt(PermissionsBitField.Flags[p]);
  }
  return perms;
}

function isWhitelisted(context, userId, guildId) {
  if (context.whitelistManager?.isWhitelisted(userId, guildId)) return true;
  if (context.ownerManager?.isExtraOwner(userId, guildId)) return true;
  return false;
}

export async function handleGuildCreate(event, context) {
  const { cache } = context;
  const { guild } = event;
  if (!guild || !cache.moduleState?.antiLinkedRole?.enabled) return;

  const roleCache = getLinkedRoleCache(cache, guild.id);
  roleCache.roleIds.clear();

  guild.roles.cache.forEach(role => {
    if (isLinkedRole(role)) roleCache.roleIds.add(role.id);
  });
}

export async function handleRoleCreate(event, context) {
  const { cache, incidentEngine } = context;
  const { guild, role } = event;
  if (!guild || !role || !cache.moduleState?.antiLinkedRole?.enabled) return;

  if (!isLinkedRole(role)) return;

  const roleCache = getLinkedRoleCache(cache, guild.id);
  roleCache.roleIds.add(role.id);

  const dangerous = hasDangerousPerms(role.permissions);
  if (dangerous.length === 0) return;

  const newPerms = removeDangerousPerms(role.permissions, dangerous);

  try {
    await role.setPermissions(newPerms, `Luna: Removed dangerous permissions from Linked Role`);
  } catch {}

  await incidentEngine?.log({
    type: 'linked_role_create',
    guildId: guild.id,
    userId: role.manager?.id || 'unknown',
    risk: 85,
    details: { roleId: role.id, roleName: role.name, removed: dangerous }
  });
}

export async function handleRoleUpdate(event, context) {
  const { cache, incidentEngine } = context;
  const { guild, role, oldRole } = event;
  if (!guild || !role || !oldRole || !cache.moduleState?.antiLinkedRole?.enabled) return;

  const roleCache = getLinkedRoleCache(cache, guild.id);
  if (!roleCache.roleIds.has(role.id)) return;

  if (role.permissions.bitfield === oldRole.permissions.bitfield) return;

  const dangerous = hasDangerousPerms(role.permissions);
  if (dangerous.length === 0) return;

  if (isWhitelisted(context, role.manager?.id || '', guild.id)) return;

  const newPerms = removeDangerousPerms(role.permissions, dangerous);

  try {
    await role.setPermissions(newPerms, `Luna: Removed dangerous permissions from Linked Role`);
  } catch {}

  await incidentEngine?.log({
    type: 'linked_role_update',
    guildId: guild.id,
    userId: role.manager?.id || 'unknown',
    risk: 90,
    details: { roleId: role.id, roleName: role.name, removed: dangerous }
  });
}
