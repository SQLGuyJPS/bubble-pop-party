// Draws the app icons (a pink bubble with an "A" on a blue sky) and saves them as PNG files.
//
//   node tools/make-icons.mjs
//
// This needs nothing installed: it only uses what comes with Node. The icons are written to
// icons/ and are small enough to commit. Run it again after changing the drawing below.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'icons');

const SIZES = { 'apple-touch-icon.png': 180, 'icon-192.png': 192, 'icon-512.png': 512 };
const SAMPLES = 3; // 3x3 samples per pixel gives smooth edges

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

const SKY_TOP = hex('#7fd6ff');
const SKY_BOTTOM = hex('#e6f8ff');
const PINK_LIGHT = hex('#ff9ec2');
const PINK_DARK = hex('#ff5c9a');
const BLUE_LIGHT = hex('#bfeaff');
const BLUE_DARK = hex('#5bbcf0');
const WHITE = [1, 1, 1];

// Distance from point p to the line segment a-b.
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Colour of one point of the picture, in 0..1 coordinates. Everything stays inside the centre 80%
// so the icon still looks right when a phone crops it to a circle.
function colourAt(x, y) {
  let c = mix(SKY_TOP, SKY_BOTTOM, y);

  // two small bubbles
  for (const [bx, by, br] of [[0.27, 0.74, 0.07], [0.76, 0.27, 0.055]]) {
    const d = Math.hypot(x - bx, y - by);
    if (d < br) {
      const lit = Math.max(0, 1 - Math.hypot(x - (bx - br * 0.3), y - (by - br * 0.3)) / br);
      c = mix(mix(BLUE_DARK, BLUE_LIGHT, 0.5), BLUE_LIGHT, lit);
      if (d > br * 0.86) c = mix(c, WHITE, 0.55);
    }
  }

  // the big bubble
  const cx = 0.5, cy = 0.5, r = 0.31;
  const d = Math.hypot(x - cx, y - cy);
  if (d < r) {
    const lit = Math.max(0, 1 - Math.hypot(x - (cx - r * 0.3), y - (cy - r * 0.35)) / (r * 1.3));
    c = mix(PINK_DARK, PINK_LIGHT, lit);
    if (d > r * 0.9) c = mix(c, WHITE, 0.35 * ((d / r - 0.9) / 0.1));

    // shine
    const sx = (x - (cx - r * 0.42)) / (r * 0.2), sy = (y - (cy - r * 0.5)) / (r * 0.11);
    if (sx * sx + sy * sy < 1) c = mix(c, WHITE, 0.65);

    // the letter A: two legs and a crossbar, drawn as thick rounded lines
    const w = 0.04;
    const apex = [0.5, 0.31], left = [0.375, 0.69], right = [0.625, 0.69];
    const dA = Math.min(
      segDist(x, y, apex[0], apex[1], left[0], left[1]),
      segDist(x, y, apex[0], apex[1], right[0], right[1]),
      segDist(x, y, 0.42, 0.58, 0.58, 0.58)
    );
    if (dA < w) c = WHITE;
  }
  return c;
}

function crcTable() {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
}
const CRC = crcTable();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let o = 0;
  for (let py = 0; py < size; py++) {
    raw[o++] = 0; // no row filter
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const c = colourAt((px + (sx + 0.5) / SAMPLES) / size, (py + (sy + 0.5) / SAMPLES) / size);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const n = SAMPLES * SAMPLES;
      raw[o++] = Math.round((r / n) * 255);
      raw[o++] = Math.round((g / n) * 255);
      raw[o++] = Math.round((b / n) * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8 bits per channel, RGB (no transparency: iPad fills transparent icons with black)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

fs.mkdirSync(outDir, { recursive: true });
for (const [name, size] of Object.entries(SIZES)) {
  const data = png(size);
  fs.writeFileSync(path.join(outDir, name), data);
  console.log(`icons/${name}  ${size}x${size}  ${data.length} bytes`);
}
