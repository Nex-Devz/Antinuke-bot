export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function generateIncidentId() {
  return Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

export function timestamp() {
  return new Date().toISOString();
}

export function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / 60000) % 60;
  const hours = Math.floor(ms / 3600000) % 24;
  const days = Math.floor(ms / 86400000);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);
  return parts.join(' ') || '0s';
}

const PERMISSIONS = [
  'CREATE_INSTANT_INVITE', 'KICK_MEMBERS', 'BAN_MEMBERS',
  'ADMINISTRATOR', 'MANAGE_CHANNELS', 'MANAGE_GUILD',
  'ADD_REACTIONS', 'VIEW_AUDIT_LOG', 'PRIORITY_SPEAKER',
  'STREAM', 'VIEW_CHANNEL', 'SEND_MESSAGES',
  'SEND_TTS_MESSAGES', 'MANAGE_MESSAGES', 'EMBED_LINKS',
  'ATTACH_FILES', 'READ_MESSAGE_HISTORY', 'MENTION_EVERYONE',
  'USE_EXTERNAL_EMOJIS', 'VIEW_GUILD_INSIGHTS', 'CONNECT',
  'SPEAK', 'MUTE_MEMBERS', 'DEAFEN_MEMBERS',
  'MOVE_MEMBERS', 'USE_VAD', 'CHANGE_NICKNAME',
  'MANAGE_NICKNAMES', 'MANAGE_ROLES', 'MANAGE_WEBHOOKS',
  'MANAGE_EMOJIS_AND_STICKERS', 'USE_APPLICATION_COMMANDS',
  'REQUEST_TO_SPEAK', 'MANAGE_THREADS', 'CREATE_PUBLIC_THREADS',
  'CREATE_PRIVATE_THREADS', 'USE_EXTERNAL_STICKERS',
  'SEND_MESSAGES_IN_THREADS', 'START_EMBEDDED_ACTIVITIES',
  'MODERATE_MEMBERS'
];

export function permissionBitfieldToName(bitfield) {
  const flags = BigInt(bitfield);
  const result = [];
  for (let i = 0; i < PERMISSIONS.length; i++) {
    const bit = 1n << BigInt(i);
    if ((flags & bit) === bit) {
      result.push(PERMISSIONS[i]);
    }
  }
  return result;
}

export function getHighestRole(roles) {
  if (!roles || roles.length === 0) return null;
  return roles.reduce((highest, role) =>
    role.position > highest.position ? role : highest
  );
}

export function canPunish(botRoles, targetRoles) {
  const botHighest = getHighestRole(botRoles);
  const targetHighest = getHighestRole(targetRoles);
  if (!botHighest || !targetHighest) return false;
  return botHighest.position > targetHighest.position;
}

export function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function truncate(str, maxLen) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '\u2026';
}
