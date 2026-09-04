import { getRoleRisk, getPermissionChanges } from '../../security/PermissionAnalyzer.js';

export async function handleRoleCreate(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, snapshotManager, auditCorrelator, whitelistManager, ownerManager } = context;
  const guild = event.guild;
  if (!guild) return;
  const guildId = guild.id;

  const config = await database.getConfig(guildId);
  if (!config?.modules?.antirôle?.enabled) return;

  const executorId = await auditCorrelator.resolveExecutor(guild, 'ROLE_CREATE', event.role.id);
  console.log(`[Security] Role created: ${event.role.name} in ${guild.name} by ${executorId || 'unknown'}`);

  if (executorId) {
    if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
    if (await ownerManager.isExtraOwner(guildId, executorId)) return;

    const risk = 70;
    const actions = config.modules.antirôle.actions || {};
    await snapshotManager.captureRole(guildId, event.role);

    if (actions.restore) {
      await event.role.delete('Luna: Unauthorized role creation').catch(e => console.log(`[Security] Failed to delete role: ${e.message}`));
      console.log(`[Security] Deleted unauthorized role: ${event.role.name}`);
    }

    if (actions.punish) {
      await punishmentEngine.punish(guildId, executorId, actions.punish, `Unauthorized role creation: ${event.role.name}`);
    }

    await incidentEngine.create(guildId, 'antirôle', 'role_create', executorId, event.role.id, 'critical', risk, { role: event.role.toJSON() }, 'delete_and_punish');
  }
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

  if (executorId) {
    if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
    if (await ownerManager.isExtraOwner(guildId, executorId)) return;

    const risk = 80;
    const actions = config.modules.antirôle.actions || {};

    if (actions.restore) {
      const snapshot = await snapshotManager.getRoleSnapshot(guildId, event.role.id);
      if (snapshot) {
        const restored = await guild.roles.create({
          name: snapshot.name,
          color: snapshot.color,
          hoist: snapshot.hoist,
          mentionable: snapshot.mentionable,
          permissions: snapshot.permissions,
          reason: 'Luna: Restoring deleted role'
        }).catch(e => console.log(`[Security] Failed to restore role: ${e.message}`));
        if (restored && snapshot.position) await restored.setPosition(snapshot.position).catch(() => null);
        console.log(`[Security] Restored role: ${restored?.name || snapshot.name}`);
      }
    }

    if (actions.punish) {
      await punishmentEngine.punish(guildId, executorId, actions.punish, `Unauthorized role deletion: ${event.role.name}`);
    }

    await incidentEngine.create(guildId, 'antirôle', 'role_delete', executorId, event.role.id, 'critical', risk, { role: event.role.name }, 'restore_and_punish');
  }
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

  const escalation = getPermissionChanges(
    Object.keys(oldPerms === 0n ? {} : { serialize: () => {} }),
    Object.keys(newPerms === 0n ? {} : { serialize: () => {} })
  );

  const hasDangerous = (newPerms & (1n << 3n)) !== 0n || (escalation.added?.includes?.('Administrator'));

  const executorId = await auditCorrelator.resolveExecutor(guild, 'ROLE_UPDATE', event.role.id);
  console.log(`[Security] Role updated: ${event.role.name} in ${guild.name} by ${executorId || 'unknown'} (dangerous: ${hasDangerous})`);

  if (hasDangerous && executorId) {
    if (await whitelistManager.isWhitelisted(guildId, executorId)) return;
    if (await ownerManager.isExtraOwner(guildId, executorId)) return;

    const risk = 85;
    const actions = config.modules.antirôle.actions || {};

    if (actions.restore) {
      const snapshot = await snapshotManager.getRoleSnapshot(guildId, event.role.id);
      if (snapshot) {
        await event.role.setPermissions(snapshot.permissions, 'Luna: Reverting dangerous permission change').catch(() => null);
        console.log(`[Security] Reverted role permissions: ${event.role.name}`);
      }
    }

    if (actions.punish) {
      await punishmentEngine.punish(guildId, executorId, actions.punish, `Dangerous permission escalation on role: ${event.role.name}`);
    }

    await incidentEngine.create(guildId, 'antirôle', 'role_update', executorId, event.role.id, 'critical', risk, { oldPerms: oldPerms.toString(), newPerms: newPerms.toString() }, 'revert_and_punish');
  }
}
