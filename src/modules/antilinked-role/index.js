function getLinkedRoleCache(cache, guildId) {
  const key = 'antiLinkedRole';
  if (!cache[key]) cache[key] = {};
  if (!cache[key][guildId]) {
    cache[key][guildId] = {
      linkedRoleIds: new Set(),
    };
  }
  return cache[key][guildId];
}

function isLinkedRole(role) {
  if (!role.tags) return false;
  if (role.tags.bot_id) return false;
  if (role.tags.integration_id) return false;
  if (role.tags.premium_subscriber !== undefined && role.tags.premium_subscriber !== null) return false;
  if (role.tags.available_for_purchase !== undefined) return false;
  if (role.tags.guild_connections !== undefined) return false;
  return Object.keys(role.tags).length > 0;
}

function isWhitelisted(context, userId, guildId) {
  if (context.whitelistManager?.isWhitelisted(userId, guildId)) return true;
  if (context.ownerManager?.isExtraOwner(userId, guildId)) return true;
  return false;
}

function detectLinkedRoleChanges(oldRole, newRole) {
  const changes = [];
  if (oldRole.name !== newRole.name) changes.push('name');
  if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) changes.push('permissions');
  if (oldRole.color !== newRole.color) changes.push('color');
  if (oldRole.hoist !== newRole.hoist) changes.push('hoist');
  if (oldRole.mentionable !== newRole.mentionable) changes.push('mentionable');
  if (oldRole.position !== newRole.position) changes.push('position');
  if (JSON.stringify(oldRole.tags) !== JSON.stringify(newRole.tags)) changes.push('tags');
  return changes;
}

export async function handleGuildCreate(event, context) {
  const { client, cache } = context;
  const { guild } = event;
  if (!guild) return;

  if (!cache.moduleState?.antiLinkedRole?.enabled) return;

  const roleCache = getLinkedRoleCache(cache, guild.id);
  roleCache.linkedRoleIds.clear();

  guild.roles.cache.forEach((role) => {
    if (isLinkedRole(role)) {
      roleCache.linkedRoleIds.add(role.id);
    }
  });

  if (roleCache.linkedRoleIds.size > 0) {
    console.log(`[Security] Initialized linked role cache for ${guild.name} (${guild.id}): ${roleCache.linkedRoleIds.size} linked role(s)`);
  }
}

export async function handleRoleCreate(event, context) {
  const { client, cache, incidentEngine, punishmentEngine } = context;
  const { guild, role } = event;
  if (!guild || !role) return;

  if (!cache.moduleState?.antiLinkedRole?.enabled) return;

  const roleCache = getLinkedRoleCache(cache, guild.id);

  if (isLinkedRole(role)) {
    roleCache.linkedRoleIds.add(role.id);
    console.log(`[Security] Linked role created in ${guild.name} (${guild.id}): ${role.name} (${role.id})`);

    const risk = 85;
    await incidentEngine?.log({
      type: 'linked_role_create',
      guildId: guild.id,
      userId: role.manager?.id || role.tags?.bot_id || 'unknown',
      risk,
      details: { roleId: role.id, roleName: role.name, tags: role.tags },
    });

    if (risk >= 90) {
      await punishmentEngine?.punish(guild, role.manager?.id || role.tags?.bot_id, 'linked_role_create', {
        risk,
        reason: 'Created a Discord Linked Role',
        duration: '1h',
      });
    }
  }
}

export async function handleRoleUpdate(event, context) {
  const { client, cache, incidentEngine, punishmentEngine } = context;
  const { guild, role, oldRole } = event;
  if (!guild || !role || !oldRole) return;

  if (!cache.moduleState?.antiLinkedRole?.enabled) return;

  const roleCache = getLinkedRoleCache(cache, guild.id);

  if (!roleCache.linkedRoleIds.has(role.id)) return;

  if (isWhitelisted(context, role.manager?.id || '', guild.id)) return;

  const changes = detectLinkedRoleChanges(oldRole, role);

  if (changes.length === 0) return;

  console.log(`[Security] Linked role modified in ${guild.name} (${guild.id}): ${role.name} (${role.id}) - changes: ${changes.join(', ')}`);

  const permissionChanged = changes.includes('permissions');
  const risk = permissionChanged ? 95 : 80;

  if (permissionChanged) {
    const newPerms = new PermissionsBitField(role.permissions.bitfield);
    const dangerousPerms = [
      'Administrator',
      'ManageGuild',
      'ManageRoles',
      'ManageChannels',
      'ManageMessages',
      'MentionEveryone',
      'BanMembers',
      'KickMembers',
    ];
    const hasDangerous = dangerousPerms.some((p) => newPerms.has(PermissionsBitField.Flags[p]));

    if (hasDangerous && risk < 95) {
      risk = 95;
    }
  }

  await incidentEngine?.log({
    type: 'linked_role_update',
    guildId: guild.id,
    userId: role.manager?.id || 'unknown',
    risk,
    details: { roleId: role.id, roleName: role.name, changes, tags: role.tags },
  });

  if (risk >= 90) {
    await punishmentEngine?.punish(guild, role.manager?.id || 'unknown', 'linked_role_update', {
      risk,
      reason: `Modified linked role with changes: ${changes.join(', ')}`,
      duration: '1h',
    });
  }
}
