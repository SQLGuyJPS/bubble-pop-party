// Helps you record your own voice for the game.
//
//   node tools/update-audio.mjs            checks the files in audio/: which clips are recorded, which are not,
//                                          and any file whose name the game won't use
//   node tools/update-audio.mjs --script   prints the exact words to record for the default items
//   (add --all to either one to cover every letter and number, not just the default items)
//
// There is nothing to connect: the build finds files in audio/ by their names (see AUDIO-GUIDE.md).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findRecordings } from './recordings.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

// ----- what the game knows about (read from the source so it never goes out of date) -----
const config = fs.readFileSync(path.join(root, 'src', 'config.ts'), 'utf8');
const itemsSrc = fs.readFileSync(path.join(root, 'src', 'items.ts'), 'utf8');
const defaultLetters = (config.match(/letters: '([A-Z]+)'/) || [])[1] || 'ABCDE';
const defaultNumbers = (config.match(/numbers: '([0-9]+)'/) || [])[1] || '12345';
const numberWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const letterWords = {};
for (const m of itemsSrc.matchAll(/^\s+([A-Z]): \{ say: '[^']+',\s+word: '([^']+)'/gm)) letterWords[m[1]] = m[2];

const wantAll = args.includes('--all');
const letters = wantAll ? Object.keys(letterWords) : defaultLetters.split('');
const numbers = wantAll ? '0123456789'.split('') : defaultNumbers.split('');
const items = [...letters, ...numbers];

function words(key) {
  if (/[0-9]/.test(key)) {
    const n = numberWords[Number(key)];
    const stars = key === '0' ? 'no stars' : key === '1' ? 'one star' : n + ' stars';
    return {
      prompt: `Can you find the number ${key}?`,
      cheer: `Great! (short pause) ${stars[0].toUpperCase() + stars.slice(1)}.`,
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
const { clips, problems } = findRecordings(root);
console.log(`Found ${Object.keys(clips).length} recording(s) in audio/ that the game will use.\n`);
const missing = [];
for (const k of items) for (const kind of ['prompt', 'cheer', 'that']) if (!clips[`${kind}:${k}`]) missing.push(`${kind}-${k}`);
if (!clips.party) missing.push('party');
if (!clips.bye) missing.push('bye');
if (missing.length) {
  console.log('Still using the computer voice for:');
  console.log('  ' + missing.join(', '));
  console.log('(That is fine. Any clip you have not recorded falls back to the computer voice.)');
} else {
  console.log(`Every clip for ${items.join(' ')} is recorded.`);
}
if (problems.length) { console.log('\nCheck these:'); problems.forEach((p) => console.log('  - ' + p)); }
