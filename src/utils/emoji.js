import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '..', '..', 'data');
const EMOJI_CONFIG_PATH = join(DATA_DIR, 'emojis.json');

let cachedEmojis = {};

function loadCache() {
  try {
    if (existsSync(EMOJI_CONFIG_PATH)) {
      cachedEmojis = JSON.parse(readFileSync(EMOJI_CONFIG_PATH, 'utf8'));
    }
  } catch {
    cachedEmojis = {};
  }
}

function createMinimalPNG(r, g, b) {
  const size = 128;
  const raw = [];
  for (let y = 0; y < size; y++) {
    raw.push(0);
    for (let x = 0; x < size; x++) {
      const dx = x - 63.5, dy = y - 63.5;
      if (dx * dx + dy * dy < 58 * 58) {
        raw.push(r, g, b, 255);
      } else {
        raw.push(0, 0, 0, 0);
      }
    }
  }

  const width = Buffer.alloc(4);
  width.writeUInt32BE(size);
  const height = Buffer.alloc(4);
  height.writeUInt32BE(size);

  const ihdrData = Buffer.concat([
    width, height,
    Buffer.from([8, 6, 0, 0, 0]),
  ]);

  const ihdr = Buffer.concat([
    Buffer.from([13]),
    Buffer.from('IHDR'),
    ihdrData,
    crc32(Buffer.concat([Buffer.from('IHDR'), ihdrData]))
  ]);

  const deflated = deflateSync(Buffer.from(raw));

  const idat = Buffer.concat([
    Buffer.alloc(4),
    Buffer.from('IDAT'),
    deflated,
  ]);
  idat.writeUInt32BE(deflated.length);

  const iend = Buffer.concat([
    Buffer.alloc(4),
    Buffer.from('IEND'),
    crc32(Buffer.from('IEND')),
  ]);

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, ihdr, idat, iend]);
}

function deflateSync(data) {
  const chunks = [];
  let pos = 0;

  while (pos < data.length) {
    const isLast = pos + 32768 >= data.length;
    const blockData = data.slice(pos, pos + 32768);

    const header = Buffer.alloc(5);
    header.writeUInt8(isLast ? 1 : 0);
    header.writeUInt16LE(blockData.length);
    header.writeUInt16LE(blockData.length ^ 0xFFFF);

    const stored = Buffer.concat([header, blockData]);
    chunks.push(stored);
    pos += 32768;
  }

  const result = Buffer.concat(chunks);
  const zlibHeader = Buffer.from([0x78, 0x01]);
  return Buffer.concat([zlibHeader, result]);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  const result = Buffer.alloc(4);
  result.writeUInt32BE((crc ^ 0xFFFFFFFF) >>> 0);
  return result;
}

function generateTickPNG() {
  const size = 128;
  const pixels = [];

  for (let y = 0; y < size; y++) {
    pixels.push(0);
    for (let x = 0; x < size; x++) {
      const dx = x - 63.5, dy = y - 63.5;
      const inCircle = dx * dx + dy * dy < 58 * 58;

      const tx = x - 35, ty = y - 70;
      const inTick = (
        (tx >= 0 && tx <= 20 && ty >= -5 && ty <= 5) ||
        (tx >= 15 && tx <= 55 && ty >= tx - 25 - 5 && ty <= tx - 25 + 5)
      ) && tx >= 0 && tx <= 60 && ty >= -10 && ty <= 5;

      if (inCircle && inTick) {
        pixels.push(255, 255, 255, 255);
      } else if (inCircle) {
        pixels.push(87, 242, 135, 255);
      } else {
        pixels.push(0, 0, 0, 0);
      }
    }
  }

  return buildPNG(size, pixels);
}

function generateCrossPNG() {
  const size = 128;
  const pixels = [];

  for (let y = 0; y < size; y++) {
    pixels.push(0);
    for (let x = 0; x < size; x++) {
      const dx = x - 63.5, dy = y - 63.5;
      const inCircle = dx * dx + dy * dy < 58 * 58;

      const inLine1 = Math.abs(x - y) < 8;
      const inLine2 = Math.abs(x + y - 127) < 8;
      const inCross = (inLine1 || inLine2) && Math.abs(dx) < 45 && Math.abs(dy) < 45;

      if (inCircle && inCross) {
        pixels.push(255, 255, 255, 255);
      } else if (inCircle) {
        pixels.push(237, 66, 69, 255);
      } else {
        pixels.push(0, 0, 0, 0);
      }
    }
  }

  return buildPNG(size, pixels);
}

function buildPNG(size, pixels) {
  const raw = Buffer.from(pixels);

  const width = Buffer.alloc(4);
  width.writeUInt32BE(size);
  const height = Buffer.alloc(4);
  height.writeUInt32BE(size);

  const ihdrData = Buffer.concat([
    width, height,
    Buffer.from([8, 6, 0, 0, 0]),
  ]);

  const ihdr = Buffer.concat([
    Buffer.from([13]),
    Buffer.from('IHDR'),
    ihdrData,
    crc32(Buffer.concat([Buffer.from('IHDR'), ihdrData]))
  ]);

  const deflated = deflateSync(raw);

  const idatData = deflated;
  const idat = Buffer.concat([
    Buffer.alloc(4),
    Buffer.from('IDAT'),
    idatData,
  ]);
  idat.writeUInt32BE(idatData.length);

  const iend = Buffer.concat([
    Buffer.alloc(4),
    Buffer.from('IEND'),
    crc32(Buffer.from('IEND')),
  ]);

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, ihdr, idat, iend]);
}

export async function setupEmojis(client) {
  loadCache();

  const appId = client.application?.id;
  if (!appId) return cachedEmojis;

  try {
    const res = await fetch(`https://discord.com/api/v10/applications/${appId}/emojis`, {
      headers: { 'Authorization': `Bot ${client.token}` }
    });
    if (!res.ok) return cachedEmojis;

    const data = await res.json();
    const existing = data.items || [];

    const defs = [
      { name: 'luna_tick', generator: generateTickPNG },
      { name: 'luna_cross', generator: generateCrossPNG }
    ];

    for (const def of defs) {
      const found = existing.find(e => e.name === def.name);
      if (found) {
        cachedEmojis[def.name] = `<:${found.name}:${found.id}>`;
        continue;
      }

      const imageBuffer = def.generator();
      const base64 = imageBuffer.toString('base64');
      const dataUrl = `data:image/png;base64,${base64}`;

      const uploadRes = await fetch(`https://discord.com/api/v10/applications/${appId}/emojis`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${client.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: def.name, image: dataUrl })
      });

      if (uploadRes.ok) {
        const emoji = await uploadRes.json();
        cachedEmojis[def.name] = `<:${emoji.name}:${emoji.id}>`;
        console.log(`[Luna] Uploaded emoji ${def.name}: ${emoji.id}`);
      }
    }

    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(EMOJI_CONFIG_PATH, JSON.stringify(cachedEmojis, null, 2));
  } catch (error) {
    console.error('[Luna] Emoji setup error:', error.message);
  }

  return cachedEmojis;
}

export function getEmoji(name) {
  return cachedEmojis[name] || '';
}
