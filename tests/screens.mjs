// Takes screenshots of the game at iPad size, so a change to the code can be checked by eye.
//
//   node tests/screens.mjs <folder to serve> <folder for the pictures>
//
// Needs Playwright with Chromium, which is not one of this project's packages (it is not part of npm test).
// Random numbers are fixed and animation frames are stepped by hand, so the same game gives the same
// pictures every time.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = (await import('playwright')).default; }

const [root, outDir] = process.argv.slice(2).map((p) => path.resolve(p));
if (!root || !outDir) { console.error('Usage: node tests/screens.mjs <folder to serve> <folder for the pictures>'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.map': 'application/json' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(root, url);
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

// Before the game's own script runs: fixed random numbers, frames on demand, no offline helper.
const setup = () => {
  let seed = 12345;
  Math.random = () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const queue = [];
  let ts = 1000;
  window.requestAnimationFrame = (cb) => { queue.push(cb); return queue.length; };
  window.cancelAnimationFrame = () => { queue.length = 0; };
  window.__frames = (n) => {
    for (let i = 0; i < n; i++) { ts += 1000 / 60; const now = queue.splice(0); now.forEach((cb) => cb(ts)); }
  };
  window.__BPP_TEST = true;   // keeps the offline helper out of the way
  try { localStorage.setItem('bubblePopParty.settings.v1', JSON.stringify({ showGlyph: true })); } catch { /* ignore */ }
};

// Chromium's stand-in microphone answers "Allow" by itself, for the recording panel.
const browser = await playwright.chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 810 }, deviceScaleFactor: 1 });
await page.addInitScript(setup);
await page.goto(base + 'index.html?debug');
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(outDir, 'start.png') });

await page.evaluate(() => { document.getElementById('playBtn').click(); window.__frames(150); });
await page.screenshot({ path: path.join(outDir, 'game.png') });

await page.evaluate(() => { window.__bpp.ui.openGate(); });
await page.screenshot({ path: path.join(outDir, 'gate.png') });

await page.evaluate(() => { window.__bpp.ui.closeGate(); window.__bpp.ui.openSettings(); });
await page.screenshot({ path: path.join(outDir, 'settings.png') });

// The Recordings screen, with one clip recorded in the parent's voice and one damaged
await page.evaluate(async () => {
  const rec = window.__bpp.rec;
  const take = (clip, extra) => ({ clip, audio: new Uint8Array([1, 2, 3]).buffer, type: 'audio/mp4', words: '', trimStart: 0.2, trimEnd: 1.4,
    gain: 2, recordedAt: '2026-11-18T10:00:00.000Z', processing: 1, ...extra });
  await rec.write([take('prompt:A', { words: 'Can you find the letter A?' }), take('that:A', { gain: 99 })]);
  window.__bpp.rec.ui.open();
});
await page.waitForFunction(() => window.__bpp.rec.ui.model().loaded, null, { polling: 100 });   // not on animation frames: those are stepped by hand here
await page.screenshot({ path: path.join(outDir, 'recordings.png') });

// The recording panel, while recording (the ring held part-way, so the picture is the same every time)
await page.addStyleTag({ content: '#takeRing .prog { transition: none !important; stroke-dashoffset: 120 !important; } #takeRing .dot { animation: none !important; }' });
await page.evaluate(() => { window.__bpp.rec.ui.act('record', 'cheer:A'); });
await page.waitForFunction(() => window.__bpp.rec.ui.model().take?.phase === 'recording', null, { polling: 100 });
await page.screenshot({ path: path.join(outDir, 'recording.png') });
await page.evaluate(() => { window.__bpp.rec.ui.close(); });

await browser.close();
server.close();
console.log('Screenshots saved in ' + outDir);
