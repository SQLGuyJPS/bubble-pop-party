// Gets the offline file list and the version number in sw.js ready for a deploy.
//
//   node tools/update-sw.mjs            rewrites the two marked blocks in sw.js
//   node tools/update-sw.mjs --check    only checks; exits with an error if sw.js is out of date
//
// The version is made from the contents of every game file. So any change to the game (a new
// recording, a fixed letter, a new icon) gives a new version, and the tablet then downloads the
// new files by itself. Run this before every push.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const swPath = path.join(root, 'sw.js');
const check = process.argv.includes('--check');

const AUDIO_EXT = /\.(m4a|mp3|wav|ogg|aac)$/i;
function listDir(dir, test) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full).filter((f) => !f.startsWith('.') && test(f)).sort().map((f) => `${dir}/${f}`);
}

// Everything the game needs to run. Paths are relative on purpose: the game lives in a sub-folder
// on GitHub Pages, so a leading "/" would point to the wrong place.
const files = [
  'index.html',
  'manifest.webmanifest',
  ...listDir('icons', (f) => f.endsWith('.png')),
  ...listDir('fonts', (f) => f.endsWith('.ttf')),
  ...listDir('audio', (f) => AUDIO_EXT.test(f))
];
for (const f of files) {
  if (!fs.existsSync(path.join(root, f))) { console.error(`Missing file: ${f}`); process.exit(1); }
}

// Hash the files. Text files are compared without Windows line endings, so the version is the
// same on this computer and on GitHub.
const hash = crypto.createHash('sha256');
for (const f of files) {
  let data = fs.readFileSync(path.join(root, f));
  if (/\.(html|webmanifest)$/.test(f)) data = Buffer.from(data.toString('utf8').replace(/\r\n/g, '\n'));
  hash.update(f + '\0').update(data).update('\0');
}
const version = 'bubble-pop-party-' + hash.digest('hex').slice(0, 10);

const old = fs.readFileSync(swPath, 'utf8');
const nl = old.includes('\r\n') ? '\r\n' : '\n';
const list = 'var PRECACHE = [' + nl + ["'./'", ...files.map((f) => `'${f}'`)].map((s) => '  ' + s).join(',' + nl) + nl + '];';
let next = old
  .replace(/\/\* SW_VERSION:begin \*\/[\s\S]*?\/\* SW_VERSION:end \*\//,
    () => `/* SW_VERSION:begin */${nl}var CACHE_VERSION = '${version}';${nl}/* SW_VERSION:end */`)
  .replace(/\/\* SW_FILES:begin \*\/[\s\S]*?\/\* SW_FILES:end \*\//,
    () => `/* SW_FILES:begin */${nl}${list}${nl}/* SW_FILES:end */`);

if (next === old) {
  console.log(`sw.js is up to date (${version}, ${files.length} files).`);
} else if (check) {
  console.error(`sw.js is OUT OF DATE. Run: node tools/update-sw.mjs`);
  process.exit(1);
} else {
  fs.writeFileSync(swPath, next);
  console.log(`sw.js updated: ${version}, ${files.length} files saved for offline use.`);
}
