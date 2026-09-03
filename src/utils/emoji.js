import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EMOJI_FILE_PATH = path.join(__dirname, '..', 'config', 'emoji.js');

const headers = {};

function parseEmojis(content) {
  const emojiRegex = /<(a)?:([\w]+):(\d+)>/g;
  return [...content.matchAll(emojiRegex)].map(m => ({
    full: m[0],
    animated: Boolean(m[1]),
    name: m[2],
    id: m[3]
  }));
}

async function setupEmojis(client) {
  const token = client.token;
  if (!token) return;

  headers.Authorization = `Bot ${token}`;
  headers['Content-Type'] = 'application/json';

  console.log('[Luna] Setting up application emojis...');

  const appRes = await fetch('https://discord.com/api/v10/oauth2/applications/@me', { headers });
  if (!appRes.ok) {
    console.error('[Luna] Failed to fetch application info');
    return;
  }
  const appData = await appRes.json();
  const appId = appData.id;

  const existingRes = await fetch(`https://discord.com/api/v10/applications/${appId}/emojis`, { headers });
  let existingEmojis = [];
  if (existingRes.ok) {
    const resData = await existingRes.json();
    existingEmojis = resData.items || [];
  }

  const existingMap = new Map();
  for (const e of existingEmojis) {
    existingMap.set(e.name, e);
  }

  let emojiFileContent;
  try {
    emojiFileContent = fs.readFileSync(EMOJI_FILE_PATH, 'utf8');
  } catch {
    console.error('[Luna] Could not read emoji config file');
    return;
  }

  const emojis = parseEmojis(emojiFileContent);
  const replacements = new Map();

  for (const emoji of emojis) {
    if (replacements.has(emoji.full)) continue;

    let newEmojiObj = existingMap.get(emoji.name);

    if (!newEmojiObj) {
      try {
        const ext = emoji.animated ? 'gif' : 'png';
        const cdnUrl = `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}`;
        const imgRes = await fetch(cdnUrl);
        if (!imgRes.ok) {
          console.error(`[Luna] Failed to download ${emoji.name}`);
          continue;
        }
        const buffer = Buffer.from(await imgRes.arrayBuffer());
        const mimeType = emoji.animated ? 'image/gif' : 'image/png';
        const dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;

        const uploadRes = await fetch(`https://discord.com/api/v10/applications/${appId}/emojis`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: emoji.name, image: dataUri })
        });

        if (!uploadRes.ok) {
          console.error(`[Luna] Failed to upload ${emoji.name}: ${await uploadRes.text()}`);
          continue;
        }

        newEmojiObj = await uploadRes.json();
        console.log(`[Luna] Uploaded ${emoji.name}: ${newEmojiObj.id}`);
        existingMap.set(emoji.name, newEmojiObj);
      } catch (err) {
        console.error(`[Luna] Error uploading ${emoji.name}:`, err.message);
        continue;
      }
    }

    if (newEmojiObj && newEmojiObj.id) {
      const prefix = emoji.animated ? 'a' : '';
      const newTag = `<${prefix}:${emoji.name}:${newEmojiObj.id}>`;
      replacements.set(emoji.full, newTag);
    }
  }

  if (replacements.size > 0) {
    let updatedContent = emojiFileContent;
    for (const [oldTag, newTag] of replacements.entries()) {
      updatedContent = updatedContent.replaceAll(oldTag, newTag);
    }
    fs.writeFileSync(EMOJI_FILE_PATH, updatedContent, 'utf8');
    console.log(`[Luna] Updated ${replacements.size} emojis in config`);
  }

  console.log('[Luna] Emoji setup complete');
}

let emojiCache = {};

function loadEmojiCache() {
  try {
    const content = fs.readFileSync(EMOJI_FILE_PATH, 'utf8');
    const emojis = parseEmojis(content);
    for (const emoji of emojis) {
      emojiCache[emoji.name] = emoji.full;
    }
  } catch {
    emojiCache = {};
  }
}

function getEmoji(name) {
  if (Object.keys(emojiCache).length === 0) {
    loadEmojiCache();
  }
  return emojiCache[name] || '';
}

export { setupEmojis, getEmoji };
