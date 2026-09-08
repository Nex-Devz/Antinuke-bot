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
  if (!role || !role.tags) return false;
  const tags = role.tags;

  // Explicitly ignore bot managed roles, integrations, booster roles, subscriptions
  if (tags.botId || tags.bot_id || tags.integrationId || tags.integration_id) return false;
  if (tags.premiumSubscriberRole || tags.premium_subscriber !== undefined) return false;
  if (tags.subscriptionListingId || tags.available_for_purchase !== undefined) return false;

  // Linked roles in Discord are identified exclusively by the guildConnections / guild_connections tag
  return Boolean(tags.guildConnections === true || tags.guildConnections !== undefined || 'guild_connections' in tags || tags.guild_connections !== undefined);
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
  const { cache, database, incidentEngine, whitelistManager, ownerManager, auditCorrelator } = context;
  const { guild, role, oldRole } = event;
  if (!guild || !role || !oldRole) return;

  const config = await database.getConfig(guild.id);
  if (!config?.modules?.antiLinkedRole?.enabled) return;

  if (!isLinkedRole(role)) return;

  if (role.permissions.bitfield === oldRole.permissions.bitfield) return;

  const dangerous = hasDangerousPerms(role.permissions);
  if (dangerous.length === 0) return;

  let executorId = null;
  if (auditCorrelator) {
    executorId = await auditCorrelator.resolveExecutor(guild, 'ROLE_UPDATE', role.id);
  }
  if (executorId) {
    if (guild.ownerId === executorId) return;
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
