// Recording clips inside the game (Milestone 6): the clip list, where each clip comes from, storage, trimming and
// levelling, the microphone, the Recordings screen and the backup file.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { clips as list } from '../tools/clips.mjs';
import { findRecordings } from '../tools/recordings.mjs';
import { root, report, stats, expect, freshGame, runFor, targetBubble, tapBubble, newIDB, flush, passGate, UNDECODABLE } from './harness.mjs';

// A saved recording as the game stores it. The audio is made-up bytes; the fake decoder turns it into a signal.
export function record(clip, extra = {}) {
  return {
    clip, audio: new Uint8Array(4000).fill(7).buffer, type: 'audio/mp4', words: list.clipByName(clip)?.script ?? 'x',
    trimStart: 0.2, trimEnd: 1.4, gain: 2, recordedAt: '2026-11-18T10:00:00.000Z', processing: 1, ...extra
  };
}
// A device whose storage already holds these records (key -> value, stored exactly as given, damaged or not).
export function deviceWith(entries, mode = 'ok') {
  const idb = newIDB(mode);
  idb.version = 1;
  idb.keyPaths.clips = 'clip';
  idb.stores.set('clips', new Map(Object.entries(entries)));
  return idb;
}
// Plays for a while, popping the right bubble every few seconds, and checks every rule after every frame.
export function playLong(env, seconds) {
  const problems = [];
  for (let i = 0; i < seconds * 60; i++) {
    env.bpp.step(1 / 60); env.advance(1000 / 60);
    if (i % 180 === 90) { const tb = targetBubble(env.bpp); if (tb) tapBubble(env.bpp, tb); }
    for (const e of env.bpp.check()) if (problems.length < 3) problems.push(e);
  }
  return problems;
}

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

  // ---------- storage ----------
  {
    const before = stats.failures;
    // recordings are kept on the device and are there when the game is opened again
    const idb = newIDB();
    let env = freshGame({}, { idb });
    await flush();
    expect(env.bpp.rec.status() === 'ok', 'storage did not open: ' + env.bpp.rec.status());
    expect(idb.version === 1 && idb.stores.has('clips'), 'the database was not set up (version 1, store "clips")');
    expect(await env.bpp.rec.write([record('prompt:A'), record('cheer:B')]) === 'ok', 'a recording could not be saved');
    env = freshGame({}, { idb });
    await flush();
    expect(env.bpp.rec.saved().join() === 'cheer:B,prompt:A', 'saved recordings were not found after opening the game again: ' + env.bpp.rec.saved().join());

    // blocked storage: the game starts and plays a long game exactly as before
    for (const mode of ['missing', 'fail', 'hang', 'full', 'newer']) {
      const db = newIDB(mode === 'newer' ? 'ok' : mode);
      if (mode === 'newer') { db.version = 7; db.keyPaths.clips = 'clip'; db.stores.set('clips', new Map()); }   // from a later milestone, then downgraded
      env = freshGame({}, { idb: db, audio: 'ok' });
      await flush();
      env.advance(3100);                     // "never answers" gives up after 3 seconds
      await flush();
      const want = mode === 'full' ? 'ok' : 'blocked';
      expect(env.bpp.rec.status() === want, `storage "${mode}": expected ${want}, got ${env.bpp.rec.status()}`);
      const problems = playLong(env, 240);
      expect(problems.length === 0, `storage "${mode}": rules broken: ${problems.join('; ')}`);
      expect(env.bpp.state().stars >= 40, `storage "${mode}": the game did not keep going (${env.bpp.state().stars} stars)`);
      expect(env.bpp.rec.saved().length === 0, `storage "${mode}": recordings were listed though none could be read`);
      const w = await env.bpp.rec.write([record('prompt:A')]);
      expect(w === (mode === 'full' ? 'full' : 'failed'), `storage "${mode}": saving should report ${mode === 'full' ? 'full' : 'failed'}, got ${w}`);
      await flush();
      expect((await env.bpp.rec.readAll()).good.length === 0, `storage "${mode}": a refused save left something behind`);
    }
    report('storage: kept on the device, and the game runs when it is blocked, full or never answers', before);
  }

  {
    const before = stats.failures;
    // damaged records are ignored and reported by name; a good one next to them is still read
    const idb = deviceWith({
      'prompt:A': record('prompt:A'),
      'prompt:B': record('prompt:B', { gain: 50 }),
      'prompt:C': record('prompt:C', { gain: 'loud' }),
      'cheer:A': record('cheer:A', { audio: undefined }),
      'that:A': record('that:A', { audio: new ArrayBuffer(0) }),
      'that:B': record('that:B', { trimStart: 1.5, trimEnd: 1.0 }),
      'cheer:B': record('cheer:C'),                      // stored under the wrong name
      'party': 'hello',
      'bye': record('bye', { processing: 0 }),
      'prompt:%': record('prompt:%'),                    // not a clip at all: ignored
      'zzz': null
    });
    const env = freshGame({}, { idb });
    await flush();
    const all = await env.bpp.rec.readAll();
    expect(all.good.join() === 'prompt:A', 'only prompt:A is a good record, got ' + all.good.join());
    expect(all.damaged.join() === 'bye,cheer:A,cheer:B,party,prompt:B,prompt:C,that:A,that:B', 'damaged records were not all reported: ' + all.damaged.join());
    const problems = playLong(env, 60);
    expect(problems.length === 0, 'damaged records broke the game: ' + problems.join('; '));
    report('storage: damaged records are ignored and reported', before);
  }

  // ---------- which clip plays: your recording, then a file in audio/, then the computer voice ----------
  {
    const before = stats.failures;
    const bad = new Uint8Array(4000).fill(UNDECODABLE).buffer;
    const idb = deviceWith({
      'prompt:A': record('prompt:A'),                              // recorded, and also a file
      'prompt:B': record('prompt:B'),                              // recorded only
      'that:A': record('that:A', { gain: -3 }),                    // damaged, with a file
      'that:B': record('that:B', { words: 'Find the letter B!' }),  // the words have changed since: not played
      'party': record('party', { audio: bad }),                    // won't decode on this device, with a file
      'bye': record('bye'),                                        // deleted before it was decoded
      'prompt:C': record('prompt:C')                               // not in the current letters
    });
    const files = { 'prompt:A': 'audio/prompt-A.m4a', 'cheer:A': 'audio/cheer-A.m4a', 'that:A': 'audio/that-A.m4a', 'party': 'audio/party.m4a' };
    const want = { 'prompt:A': 'own', 'prompt:B': 'own', 'cheer:A': 'file', 'cheer:B': 'voice', 'that:A': 'file', 'that:B': 'voice', 'party': 'file', 'bye': 'voice' };
    const env = freshGame({ letters: 'AB' }, { idb, audio: 'ok', webaudio: true });
    const { bpp } = env;
    Object.assign(bpp.overrides, files);
    await flush();
    expect(bpp.rec.saved().length === 7, 'the saved list was not read at start-up');
    expect(bpp.rec.ready().length === 0 && env.webaudio.decodes === 0, 'recordings were decoded before the first tap');
    // needed before it has finished decoding: that one play uses the next source
    bpp.unlockAudio();
    idb.stores.get('clips').delete('bye');
    bpp.say('prompt:A');
    expect(env.audio.created.at(-1) === 'audio/prompt-A.m4a', 'a recording still decoding should fall back to the audio/ file for that play');
    await flush(12);
    expect(bpp.rec.ready().join() === 'prompt:A,prompt:B', 'decoded recordings should be prompt:A and prompt:B, got ' + bpp.rec.ready().join());
    expect(JSON.stringify(bpp.rec.problems()) === JSON.stringify({ 'that:A': 'damaged', 'that:B': 'words', party: 'damaged' }),
      'damaged, undecodable and changed-words recordings should be reported: ' + JSON.stringify(bpp.rec.problems()));
    expect(!bpp.rec.saved().includes('bye'), 'a deleted recording is still listed');
    for (const [clip, src] of Object.entries(want)) {
      expect(bpp.rec.source(clip) === src, `${clip} should come from ${src}, but comes from ${bpp.rec.source(clip)}`);
      env.advance(6000);
      const counts = [env.webaudio.played.length, env.audio.created.length, env.speech.spoken];
      bpp.say(clip);
      env.advance(200);
      const heard = env.webaudio.played.length > counts[0] ? 'own' : env.audio.created.length > counts[1] ? 'file' : env.speech.spoken > counts[2] ? 'voice' : 'nothing';
      expect(heard === src, `${clip}: expected to hear ${src}, heard ${heard}`);
      if (heard === 'own') {
        const b = env.webaudio.played.at(-1);
        const peak = b.getChannelData(0).reduce((m, x) => Math.max(m, Math.abs(x)), 0);
        expect(b.from === 'create' && b.numberOfChannels === 1 && Math.abs(b.duration - 1.2) < 0.01 && Math.abs(peak - 0.05) < 0.005,
          `${clip}: the recording should play trimmed to 1.2 s, in one channel, at twice the volume (got ${b.duration.toFixed(2)} s, peak ${peak.toFixed(3)})`);
      }
    }
    env.advance(6000);
    expect(env.webaudio.maxPlaying <= 1 && env.audio.maxPlaying <= 1 && env.speech.maxQueued <= 1, 'two spoken lines played at once');
    // a wrong pop plays your "that" recording then the prompt, one after the other
    bpp.say('wrong:B:A');
    env.advance(200);
    expect(env.speech.texts.at(-1) === "That's the letter bee.", 'wrong pop: the changed-words "that:B" should use the computer voice');
    env.advance(2000);
    expect(env.webaudio.playing === 1 && env.speech.queued.length === 0, 'wrong pop: the prompt recording did not follow the computer voice');
    env.advance(3000);
    // changing the letters decodes their recordings and lets go of the others
    passGate(env);
    bpp.ui.action('letters-preset', 'CD');
    bpp.ui.closeSettings();
    await flush(12);
    expect(bpp.rec.ready().join() === 'prompt:C', 'after choosing C and D, only prompt:C should be decoded, got ' + bpp.rec.ready().join());
    expect(playLong(env, 30).length === 0, 'rules broken while playing with recordings');
    report('playback order: your recording, then audio/, then the computer voice', before);
  }
}
