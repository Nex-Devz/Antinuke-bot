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

export async function handleRoleCreate(event, context) {
  const { cache, database, incidentEngine } = context;
  const { guild, role } = event;
  if (!guild || !role) return;

  const config = await database.getConfig(guild.id);
  if (!config?.modules?.antiLinkedRole?.enabled) return;

  if (!isLinkedRole(role)) return;

  const dangerous = hasDangerousPerms(role.permissions);
  if (dangerous.length === 0) return;

  const newPerms = removeDangerousPerms(role.permissions, dangerous);
  try {
    await role.setPermissions(newPerms, 'Luna: Removed dangerous permissions from Linked Role');
  } catch {}

  await incidentEngine.create(guild.id, 'antilinked-role', 'linked_role_create', 'system', role.id, 'high', 85, {
    roleId: role.id,
    roleName: role.name,
    removed: dangerous
  }, 'revert_perms');
}

export async function handleRoleUpdate(event, context) {
  const { cache, database, incidentEngine, whitelistManager, ownerManager } = context;
  const { guild, role, oldRole } = event;
  if (!guild || !role || !oldRole) return;

  const config = await database.getConfig(guild.id);
  if (!config?.modules?.antiLinkedRole?.enabled) return;

  if (!isLinkedRole(role)) return;

  if (role.permissions.bitfield === oldRole.permissions.bitfield) return;

  const dangerous = hasDangerousPerms(role.permissions);
  if (dangerous.length === 0) return;

  const executorId = role.manager?.id;
  if (executorId) {
    if (await whitelistManager.isWhitelisted(guild.id, executorId)) return;
    if (await ownerManager.isExtraOwner(guild.id, executorId)) return;
  }

  const newPerms = removeDangerousPerms(role.permissions, dangerous);
  try {
    await role.setPermissions(newPerms, 'Luna: Removed dangerous permissions from Linked Role');
  } catch {}

  await incidentEngine.create(guild.id, 'antilinked-role', 'linked_role_update', executorId || 'system', role.id, 'high', 90, {
    roleId: role.id,
    roleName: role.name,
    removed: dangerous
  }, 'revert_perms');
}
