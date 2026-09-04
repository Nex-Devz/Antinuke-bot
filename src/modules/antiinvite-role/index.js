import { getRoleRisk, getRiskLevel } from '../../security/PermissionAnalyzer.js';

const RISK_LOW = 29;
const RISK_MEDIUM = 69;
const RISK_HIGH = 89;
const RISK_CRITICAL = 90;

export async function handleInviteCreateRole(event, context) {
  const { client, cache, database, incidentEngine, punishmentEngine, whitelistManager, ownerManager } = context;
  const { guild, invite } = event;
  if (!guild || !invite) return;

  const config = await database.getConfig(guild.id);
  if (!config?.modules?.antiinviteRole?.enabled) return;

  const inviterId = invite.inviter?.id;
  if (!inviterId) return;
  if (await whitelistManager.isWhitelisted(guild.id, inviterId)) return;
  if (await ownerManager.isExtraOwner(guild.id, inviterId)) return;

  const roleIds = invite.roles?.map(r => r.id ?? r) ?? [];
  if (roleIds.length === 0) return;

  let maxRisk = 0;
  let dangerousRoles = [];

  for (const roleId of roleIds) {
    const role = guild.roles.cache.get(roleId);
    if (!role) continue;

    const riskScore = getRoleRisk([role]);
    if (riskScore > maxRisk) maxRisk = riskScore;

    if (riskScore >= RISK_LOW) {
      dangerousRoles.push({ roleId, roleName: role.name, risk: riskScore });
    }
  }

  if (dangerousRoles.length === 0) return;

  const highestRisk = dangerousRoles.reduce((max, r) => (r.risk > max.risk ? r : max), dangerousRoles[0]);
  console.log(`[Security] Dangerous role in invite in ${guild.name}: ${dangerousRoles.map(r => `${r.roleName}(${r.risk})`).join(', ')} by ${inviterId}`);

  const tasks = [];

  if (highestRisk.risk >= RISK_HIGH) {
    tasks.push(invite.delete(`Luna: Dangerous role risk ${highestRisk.risk}`).catch(e => {
      console.log(`[Security] Failed to delete invite: ${e.message}`);
      return null;
    }));
  }

  if (highestRisk.risk >= RISK_CRITICAL) {
    tasks.push(punishmentEngine.punish(guild.id, inviterId, 'TIMEOUT', `Luna: Invite with dangerously privileged role(s): ${dangerousRoles.map(r => r.roleName).join(', ')}`).catch(e => {
      console.log(`[Security] Failed to punish inviter: ${e.message}`);
      return null;
    }));
  }

  const action = highestRisk.risk >= RISK_CRITICAL
    ? 'DELETE_INVITE_AND_PUNISH'
    : highestRisk.risk >= RISK_HIGH
      ? 'DELETE_INVITE'
      : highestRisk.risk >= RISK_MEDIUM
        ? 'LOG'
        : 'ALLOW';

  tasks.push(incidentEngine.create(guild.id, 'antiinvite-role', 'invite_dangerous_role', inviterId, inviterId, highestRisk.risk >= RISK_CRITICAL ? 'critical' : 'high', highestRisk.risk, {
    inviteCode: invite.code,
    dangerousRoles,
    channelId: invite.channel?.id,
  }, action));

  await Promise.all(tasks);
}
