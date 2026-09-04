export async function handleRoleCreate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const guild = event.guild;
  if (!guild) return;
  const guildId = guild.id;

  const config = await database.getConfig(guildId);
  if (!config?.modules?.antirôle?.enabled) return;

  const executorId = await auditCorrelator.resolveExecutor(guild, 'ROLE_CREATE', event.role.id);
  console.log(`[Security] Role created: ${event.role.name} in ${guild.name} by ${executorId || 'unknown'}`);

  if (!executorId) return;
  if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
  if (await ownerManager.isExtraOwner(guildId, executorId)) return;

  const actions = config.modules.antirôle.actions || {};
  const reason = 'Luna: Unauthorized role creation';

  await Promise.all([
    snapshotManager.captureRole(guildId, event.role),
    actions.restore ? event.role.delete(reason).catch(() => null) : null,
    actions.punish ? punishmentEngine.punish(guildId, executorId, actions.punish, reason) : null,
    incidentEngine.create(guildId, 'antirôle', 'role_create', executorId, event.role.id, 'critical', 70, { role: event.role.name }, 'delete_and_punish')
  ]);
}

export async function handleRoleDelete(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const guild = event.guild;
  if (!guild) return;
  const guildId = guild.id;

  const config = await database.getConfig(guildId);
  if (!config?.modules?.antirôle?.enabled) return;

  const executorId = await auditCorrelator.resolveExecutor(guild, 'ROLE_DELETE', event.role.id);
  console.log(`[Security] Role deleted: ${event.role.name} in ${guild.name} by ${executorId || 'unknown'}`);

  if (!executorId) return;
  if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
  if (await ownerManager.isExtraOwner(guildId, executorId)) return;

  const actions = config.modules.antirôle.actions || {};
  const reason = 'Luna: Unauthorized role deletion';

  const tasks = [
    actions.punish ? punishmentEngine.punish(guildId, executorId, actions.punish, reason) : null,
    incidentEngine.create(guildId, 'antirôle', 'role_delete', executorId, event.role.id, 'critical', 80, { role: event.role.name }, 'restore_and_punish')
  ];

  if (actions.restore) {
    tasks.push(
      snapshotManager.getRoleSnapshot(guildId, event.role.id).then(async (snapshot) => {
        if (snapshot) {
          const restored = await guild.roles.create({
            name: snapshot.name,
            color: snapshot.color,
            hoist: snapshot.hoist,
            mentionable: snapshot.mentionable,
            permissions: snapshot.permissions,
            reason: 'Luna: Restoring deleted role'
          }).catch(() => null);
          if (restored && snapshot.position) await restored.setPosition(snapshot.position).catch(() => null);
          console.log(`[Security] Restored role: ${restored?.name || snapshot.name}`);
        }
      })
    );
  }

  await Promise.all(tasks);
}

export async function handleRoleUpdate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const guild = event.guild;
  if (!guild) return;
  const guildId = guild.id;

  const config = await database.getConfig(guildId);
  if (!config?.modules?.antirôle?.enabled) return;

  const oldPerms = event.old.role?.permissions?.bitfield || 0n;
  const newPerms = event.role.permissions?.bitfield || 0n;
  if (oldPerms === newPerms) return;

  const ADMIN_BIT = 1n << 3n;
  const hasDangerous = (newPerms & ADMIN_BIT) !== 0n && (oldPerms & ADMIN_BIT) === 0n;

  const executorId = await auditCorrelator.resolveExecutor(guild, 'ROLE_UPDATE', event.role.id);
  console.log(`[Security] Role updated: ${event.role.name} in ${guild.name} by ${executorId || 'unknown'} (admin escalated: ${hasDangerous})`);

  if (!hasDangerous || !executorId) return;
  if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
  if (await ownerManager.isExtraOwner(guildId, executorId)) return;

  const actions = config.modules.antirôle.actions || {};
  const reason = 'Luna: Dangerous permission escalation';

  const tasks = [
    actions.punish ? punishmentEngine.punish(guildId, executorId, actions.punish, reason) : null,
    incidentEngine.create(guildId, 'antirôle', 'role_update', executorId, event.role.id, 'critical', 85, { oldPerms: oldPerms.toString(), newPerms: newPerms.toString() }, 'revert_and_punish')
  ];

  if (actions.restore) {
    tasks.push(
      snapshotManager.getRoleSnapshot(guildId, event.role.id).then(async (snapshot) => {
        if (snapshot) {
          await event.role.setPermissions(snapshot.permissions, reason).catch(() => null);
          console.log(`[Security] Reverted role: ${event.role.name}`);
        }
      })
    );
  }

  await Promise.all(tasks);
}
