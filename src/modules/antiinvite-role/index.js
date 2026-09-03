import { getRoleRisk, getRiskLevel } from '../../security/PermissionAnalyzer.js';

const RISK_LOW = 29;
const RISK_MEDIUM = 69;
const RISK_HIGH = 89;
const RISK_CRITICAL = 90;

function isWhitelisted(context, userId, guildId) {
  if (context.whitelistManager?.isWhitelisted(userId, guildId)) return true;
  if (context.ownerManager?.isExtraOwner(userId, guildId)) return true;
  return false;
}

export async function handleInviteCreateRole(event, context) {
  const { client, cache, incidentEngine, punishmentEngine } = context;
  const { guild, invite } = event;
  if (!guild || !invite) return;

  if (!cache.moduleState?.antiInviteRole?.enabled) return;

  const inviterId = invite.inviter?.id;
  if (!inviterId) return;
  if (isWhitelisted(context, inviterId, guild.id)) return;

  const roleIds = invite.roles?.map((r) => r.id ?? r) ?? [];
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
  console.log(`[Security] Dangerous role(s) in invite in ${guild.name} (${guild.id}): ${dangerousRoles.map((r) => `${r.roleName}(${r.risk})`).join(', ')} invited by ${inviterId}`);

  if (highestRisk.risk >= RISK_HIGH) {
    try {
      await invite.delete(`Luna: Dangerous role risk ${highestRisk.risk}`);
      console.log(`[Security] Deleted invite with dangerous role in ${guild.name} (${guild.id})`);
    } catch (err) {
      console.log(`[Security] Failed to delete invite in ${guild.name}: ${err.message}`);
    }
  }

  if (highestRisk.risk >= RISK_CRITICAL) {
    await punishmentEngine?.punish(guild, inviterId, 'invite_dangerous_role', {
      risk: highestRisk.risk,
      reason: `Invite contained dangerously privileged role(s): ${dangerousRoles.map((r) => r.roleName).join(', ')}`,
      duration: '2h',
    });
  }

  const action = highestRisk.risk >= RISK_CRITICAL
    ? 'DELETE_INVITE_AND_PUNISH'
    : highestRisk.risk >= RISK_HIGH
      ? 'DELETE_INVITE'
      : highestRisk.risk >= RISK_MEDIUM
        ? 'LOG'
        : 'ALLOW';

  await incidentEngine?.log({
    type: 'invite_dangerous_role',
    guildId: guild.id,
    userId: inviterId,
    risk: highestRisk.risk,
    action,
    details: {
      inviteCode: invite.code,
      dangerousRoles,
      channelId: invite.channel?.id,
    },
  });
}
