// Connects your own recordings to the game.
//
//   node tools/update-audio.mjs            checks the audio/ folder and updates index.html
//   node tools/update-audio.mjs --script   prints the exact words to record for the default items
//   (add --all to either one to cover every letter and number, not just the default items)
//
// Name your files like  audio/cheer-B.m4a,  audio/prompt-B.m4a,  audio/that-B.m4a,  audio/party.m4a
// (see AUDIO-GUIDE.md). Only index.html is changed, and only the AUDIO_OVERRIDES block.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(root, 'index.html');
const audioDir = path.join(root, 'audio');
const EXT = ['m4a', 'mp3', 'wav', 'ogg', 'aac'];
const args = process.argv.slice(2);

let html = fs.readFileSync(indexPath, 'utf8');
const nl = html.includes('\r\n') ? '\r\n' : '\n';

// ----- what the game knows about (read from index.html so it never goes out of date) -----
const defaultLetters = (html.match(/letters: '([A-Z]+)'/) || [])[1] || 'ABCDE';
const defaultNumbers = (html.match(/numbers: '([0-9]+)'/) || [])[1] || '12345';
const numberWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const letterWords = {};
for (const m of html.matchAll(/^\s+([A-Z]): \{ say: '[^']+',\s+word: '([^']+)'/gm)) letterWords[m[1]] = m[2];

const wantAll = args.includes('--all');
const letters = wantAll ? Object.keys(letterWords) : defaultLetters.split('');
const numbers = wantAll ? '0123456789'.split('') : defaultNumbers.split('');
const items = [...letters, ...numbers];

function words(key) {
  if (/[0-9]/.test(key)) {
    const n = numberWords[Number(key)];
    const cap = n[0].toUpperCase() + n.slice(1);
    const stars = key === '0' ? 'no stars' : key === '1' ? 'one star' : n + ' stars';
    return {
      prompt: `Can you find the number ${key}?`,
      cheer: `Great! (short pause) ${cap === 'Zero' ? 'Zero stars' : stars[0].toUpperCase() + stars.slice(1)}.`,
      that: `That's the number ${key}.`
    };
  }
  return {
    prompt: `Can you find the letter ${key}?`,
    cheer: `Great! (short pause) ${key} is for ${letterWords[key] || '...'}.`,
    that: `That's the letter ${key}.`
  };
}

if (args.includes('--script')) {
  console.log('Words to record (one file each). Say the LETTER NAME, like "bee", "see", "ay" (rhymes with "say").\n');
  for (const k of items) {
    const w = words(k);
    console.log(`${k}:`);
    console.log(`  prompt-${k}   "${w.prompt}"`);
    console.log(`  cheer-${k}    "${w.cheer}"`);
    console.log(`  that-${k}     "${w.that}"`);
  }
  console.log('\nparty        "Hooray! You popped ten bubbles! Great job!"');
  console.log('bye          "All done! Great playing. Bye bye!"');
  process.exit(0);
}

// ----- look at the audio folder -----
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir);
const map = {};
const problems = [];
const files = fs.readdirSync(audioDir).filter((f) => !f.startsWith('.') && f !== 'README.txt').sort();
for (const f of files) {
  const m = f.match(/^(prompt|cheer|that)-([A-Za-z0-9])\.([A-Za-z0-9]+)$/) || f.match(/^(party|bye)()\.([A-Za-z0-9]+)$/);
  if (!m || !EXT.includes(m[3].toLowerCase())) {
    problems.push(`"${f}" doesn't match the naming pattern, so it is ignored. Examples: cheer-B.m4a, prompt-3.mp3, party.m4a, bye.m4a`);
    continue;
  }
  const key = m[1] === 'party' || m[1] === 'bye' ? m[1] : `${m[1]}:${m[2].toUpperCase()}`;
  if (map[key]) { problems.push(`two files for ${key}: "${path.basename(map[key])}" and "${f}". Using the first.`); continue; }
  map[key] = 'audio/' + f;
}

// ----- rewrite the block in index.html -----
const lines = Object.keys(map).sort().map((k) => `  '${k}': '${map[k]}'`);
const block = lines.length ? `var AUDIO_OVERRIDES = {${nl}${lines.join(',' + nl)}${nl}};` : 'var AUDIO_OVERRIDES = {};';
const re = /\/\* AUDIO_OVERRIDES:begin \*\/[\s\S]*?\/\* AUDIO_OVERRIDES:end \*\//;
if (!re.test(html)) {
  console.error('Could not find the AUDIO_OVERRIDES block in index.html. Nothing was changed.');
  process.exit(1);
}
const updated = html.replace(re, () => `/* AUDIO_OVERRIDES:begin */${nl}${block}${nl}/* AUDIO_OVERRIDES:end */`);
if (updated !== html) fs.writeFileSync(indexPath, updated);

// ----- report -----
console.log(`Found ${Object.keys(map).length} recording(s) in audio/.${updated !== html ? ' index.html updated.' : ' index.html was already up to date.'}\n`);
const missing = [];
for (const k of items) for (const kind of ['prompt', 'cheer', 'that']) if (!map[`${kind}:${k}`]) missing.push(`${kind}-${k}`);
if (!map.party) missing.push('party');
if (!map.bye) missing.push('bye');
if (missing.length) {
  console.log('Still using the computer voice for:');
  console.log('  ' + missing.join(', '));
  console.log('(That is fine. Any clip you have not recorded falls back to the computer voice.)');
} else {
  console.log(`Every clip for ${items.join(' ')} is recorded.`);
}
if (problems.length) { console.log('\nCheck these:'); problems.forEach((p) => console.log('  - ' + p)); }

// the offline list (sw.js) has to include the new recordings, so refresh it too
const sw = spawnSync(process.execPath, [path.join(root, 'tools', 'update-sw.mjs')], { encoding: 'utf8' });
console.log('\n' + (sw.stdout || sw.stderr).trim());
