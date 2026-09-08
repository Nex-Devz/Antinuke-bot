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
  if (guild.ownerId === executorId) return;
  if (client?.user?.id === executorId) return;
  if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
  if (await ownerManager.isExtraOwner(guildId, executorId)) return;

  const actions = config.modules.antirôle.actions || {};
  const reason = 'Luna: Unauthorized role creation';

  // 1. BAN FIRST
  const punishPromise = actions.punish
    ? punishmentEngine.punish(guildId, executorId, actions.punish, reason).catch(e => {
        console.log(`[Security] Failed to punish: ${e.message}`);
        return null;
      })
    : Promise.resolve();

  // 2. PARALLEL RECOVERY: Delete unauthorized role
  const recoveryPromise = actions.restore
    ? event.role.delete(reason).catch(() => null)
    : Promise.resolve();

  const incidentPromise = incidentEngine.create(guildId, 'antirôle', 'role_create', executorId, event.role.id, 'critical', 70, { roleName: event.role.name }, 'ban_and_delete');

  await Promise.all([punishPromise, recoveryPromise, incidentPromise]);
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
  if (guild.ownerId === executorId) return;
  if (client?.user?.id === executorId) return;
  if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
  if (await ownerManager.isExtraOwner(guildId, executorId)) return;

  const actions = config.modules.antirôle.actions || {};

  // 1. BAN FIRST
  const punishPromise = actions.punish
    ? punishmentEngine.punish(guildId, executorId, actions.punish, 'Luna: Unauthorized role deletion').catch(e => {
        console.log(`[Security] Failed to punish: ${e.message}`);
        return null;
      })
    : Promise.resolve();

  // 2. PARALLEL RECOVERY: Restore role from snapshot
  const restorePromise = actions.restore
    ? (async () => {
        const snap = await snapshotManager.getSnapshot(guildId, `role:${event.role.id}`).catch(() => null);
        if (snap) {
          const restored = await guild.roles.create({
            name: snap.name,
            color: snap.color,
            hoist: snap.hoist,
            mentionable: snap.mentionable,
            permissions: BigInt(snap.permissions || 0n),
            reason: 'Luna: Restoring deleted role'
          }).catch(() => null);
          if (restored && snap.position) await restored.setPosition(snap.position).catch(() => null);
          console.log(`[Security] Restored role: ${restored?.name || snap.name}`);
        }
      })()
    : Promise.resolve();

  const incidentPromise = incidentEngine.create(guildId, 'antirôle', 'role_delete', executorId, event.role.id, 'critical', 80, { roleName: event.role.name }, 'ban_and_restore');

  await Promise.all([punishPromise, restorePromise, incidentPromise]);
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

  if (!executorId) return;
  if (guild.ownerId === executorId) return;
  if (client?.user?.id === executorId) return;
  if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
  if (await ownerManager.isExtraOwner(guildId, executorId)) return;

  const actions = config.modules.antirôle.actions || {};
  const reason = 'Luna: Dangerous permission escalation';

  const tasks = [
    incidentEngine.create(guildId, 'antirôle', 'role_update', executorId, event.role.id, 'critical', 85, {
      oldPerms: oldPerms.toString(),
      newPerms: newPerms.toString()
    }, 'revert_and_punish')
  ];

  if (actions.punish) {
    tasks.push(punishmentEngine.punish(guildId, executorId, actions.punish, reason).catch(e => {
      console.log(`[Security] Failed to punish: ${e.message}`);
      return null;
    }));
  }

  if (actions.restore) {
    const snap = await snapshotManager.getSnapshot(guildId, `role:${event.role.id}`).catch(() => null);
    if (snap) {
      tasks.push(
        event.role.setPermissions(BigInt(snap.permissions), reason).catch(() => null)
      );
      console.log(`[Security] Reverted role: ${event.role.name}`);
    }
  }

  await Promise.all(tasks);
}