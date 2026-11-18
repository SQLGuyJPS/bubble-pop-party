// Recording clips inside the game (Milestone 6): the clip list, where each clip comes from, storage, trimming and
// levelling, the microphone, the Recordings screen and the backup file.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { clips as list } from '../tools/clips.mjs';
import { findRecordings } from '../tools/recordings.mjs';
import { root, report, stats, expect } from './harness.mjs';

export default async function () {
  // ---------- the clip list ----------
  {
    const before = stats.failures;
    const all = list.allClips();
    const names = all.map((c) => c.name), files = all.map((c) => c.file);
    expect(new Set(names).size === names.length && new Set(files).size === files.length, 'two clips share a name or a file name');
    expect(all.length === 36 * 3 + 2, `expected 110 clips (36 letters and numbers x 3, plus party and bye), got ${all.length}`);
    for (const c of all) {
      expect(c.script && c.when && c.group && Array.isArray(c.speech) && c.speech.length && c.speech.every((p) => p),
        `clip ${c.name} is missing its words, its computer-voice words or when it plays`);
      expect(list.clipByName(c.name) === c && list.clipByFile(c.file) === c, `clip ${c.name} can't be found by its name or file`);
      expect(!/[a-z]/.test(c.script.replace(/\(short pause\)/, '').match(/letter (\S)/)?.[1] ?? ''), `clip ${c.name}: the letter in the words should be a capital`);
    }
    expect(list.clipByName('voicetest') === undefined, '"Hear it" (voicetest) must not be a clip that can be recorded');
    expect(list.clipByName('that:3').script === "That's the number 3.", 'the "that" line for numbers should be "That\'s the number 3.", got ' + list.clipByName('that:3').script);
    expect(list.clipByName('cheer:B').script === 'Great! (short pause) B is for ball.' &&
      JSON.stringify(list.clipByName('cheer:B').speech) === JSON.stringify(['Great!', 'bee is for ball.']), 'cheer:B words changed');
    expect(list.clipByName('prompt:B').speech[0] === 'Can you find the letter bee?', 'the computer voice must say the letter name ("bee")');
    // the clips the settings can play: the chosen items plus party and bye
    const forDefaults = list.clipsFor(list.DEFAULTS).map((c) => c.name);
    expect(forDefaults.length === 17 && forDefaults.includes('prompt:E') && !forDefaults.includes('prompt:1') && forDefaults.at(-1) === 'bye',
      'clips for the default settings should be A-E and the whole-game clips (17): ' + forDefaults.join(' '));
    expect(list.clipsFor({ ...list.DEFAULTS, mode: 'both' }).length === 32, 'the default letters and numbers should give 32 clips');

    // tools/update-audio.mjs --script lists every clip for the chosen items, from the clip list
    const script = execFileSync(process.execPath, [path.join(root, 'tools/update-audio.mjs'), '--script'], { encoding: 'utf8' });
    for (const c of list.clipsFor({ ...list.DEFAULTS, mode: 'both' })) {
      expect(script.includes(c.file + ' ') && script.includes('"' + c.script + '"') && script.includes(c.when), `--script does not list ${c.file} with its words and when it plays`);
    }
    const scriptAll = execFileSync(process.execPath, [path.join(root, 'tools/update-audio.mjs'), '--script', '--all'], { encoding: 'utf8' });
    expect(all.every((c) => scriptAll.includes('"' + c.script + '"')), '--script --all does not list every clip');

    // the build accepts a file in audio/ exactly when its name is in the clip list
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bpp-clips-'));
    fs.mkdirSync(path.join(tmp, 'audio'));
    for (const c of all) fs.writeFileSync(path.join(tmp, 'audio', c.file + '.m4a'), '');
    for (const f of ['prompt-AB.m4a', 'cheer-!.m4a', 'hello.m4a', 'voicetest.m4a', 'party.txt']) fs.writeFileSync(path.join(tmp, 'audio', f), '');
    const r = findRecordings(tmp);
    expect(Object.keys(r.clips).length === all.length && all.every((c) => r.clips[c.name] === 'audio/' + c.file + '.m4a'), 'the build did not accept every clip in the list');
    expect(r.problems.length === 5, 'the build accepted a file whose name is not in the clip list: ' + r.problems.join(' | '));
    fs.rmSync(tmp, { recursive: true, force: true });
    report('clip list: one list for the game, the tools and the build', before);
  }
}
