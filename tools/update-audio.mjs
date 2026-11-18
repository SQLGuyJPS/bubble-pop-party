// Helps you record your own voice for the game, as files in audio/. (The easiest way is to record inside the game:
// see README.md, "Recording in the game". This tool is for files published with the game.)
//
//   node tools/update-audio.mjs            checks the files in audio/: which clips are recorded, which are not,
//                                          and any file whose name the game won't use
//   node tools/update-audio.mjs --script   prints the exact words to record for the default items
//   (add --all to either one to cover every letter and number, not just the default items)
//
// There is nothing to connect: the build finds files in audio/ by their names (see AUDIO-GUIDE.md).
// The words come from the game's own clip list (src/clips.ts), so they never go out of date.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clips as list } from './clips.mjs';
import { findRecordings } from './recordings.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

const wantAll = args.includes('--all');
const chosen = wantAll ? list.allClips() : list.clipsFor({ ...list.DEFAULTS, mode: 'both' });
const items = [...new Set(chosen.filter((c) => c.item).map((c) => c.item))];

if (args.includes('--script')) {
  console.log('Words to record (one file each). Say the LETTER NAME, like "bee", "see", "ay" (rhymes with "say").\n');
  let group = '';
  for (const c of chosen) {
    if (c.group !== group) { group = c.group; console.log(`${group}:`); }
    console.log(`  ${c.file.padEnd(10)}  "${c.script}"`);
    console.log(`  ${''.padEnd(10)}  plays: ${c.when}`);
  }
  process.exit(0);
}

// ----- look at the audio folder -----
const { clips, problems } = findRecordings(root);
console.log(`Found ${Object.keys(clips).length} recording(s) in audio/ that the game will use.\n`);
const missing = chosen.filter((c) => !clips[c.name]).map((c) => c.file);
if (missing.length) {
  console.log('Still using the computer voice for:');
  console.log('  ' + missing.join(', '));
  console.log('(That is fine. Any clip you have not recorded falls back to the computer voice.)');
} else {
  console.log(`Every clip for ${items.join(' ')} is recorded.`);
}
if (problems.length) { console.log('\nCheck these:'); problems.forEach((p) => console.log('  - ' + p)); }
