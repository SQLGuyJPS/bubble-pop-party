// Recording clips inside the game (Milestone 6): the clip list, where each clip comes from, storage, trimming and
// levelling, the microphone, the Recordings screen and the backup file.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { clips as list } from '../tools/clips.mjs';
import { findRecordings } from '../tools/recordings.mjs';
import { root, report, stats, expect, freshGame, runFor, targetBubble, tapBubble, newIDB, flush, passGate, UNDECODABLE, takeSignal, loadModule, tick } from './harness.mjs';

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

  // ---------- trimming and levelling (src/level.ts, made-up signals) ----------
  {
    const before = stats.failures;
    const L = await loadModule('src/level.ts');
    const rate = 48000, W = L.WINDOW_SECONDS;
    const dbOf = (x) => 20 * Math.log10(x);
    const rmsOf = (x, a = 0, b = x.length) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / (b - a)); };
    const near = (a, b, tol) => Math.abs(a - b) <= tol;
    const mono = (o) => takeSignal({ channels: 1, ...o }).channels[0];

    // silence, then a tone, then silence: trimmed to within one window of the tone, plus the margins
    let x = mono({ seconds: 2, from: 0.5, to: 1.5, amp: 0.05 });
    let a = L.analyse(x, rate);
    expect(a.heard && near(a.trimStart, 0.5 - L.KEEP_BEFORE, W) && near(a.trimEnd, 1.5 + L.KEEP_AFTER, W),
      `the tone at 0.5-1.5 s should be kept from ${0.5 - L.KEEP_BEFORE} to ${1.5 + L.KEEP_AFTER} s, got ${a.trimStart.toFixed(3)}-${a.trimEnd.toFixed(3)}`);
    // a short click at the start (the tap on Record) is not speech
    const clicked = x.slice();
    for (let i = Math.round(0.1 * rate); i < Math.round(0.11 * rate); i++) clicked[i] = 0.6 * (i % 2 ? 1 : -1);
    a = L.analyse(clicked, rate);
    expect(a.heard && near(a.trimStart, 0.5 - L.KEEP_BEFORE, W), `a click at 0.1 s moved the start of the speech to ${a.trimStart.toFixed(3)} s`);
    // a quiet take (like the real one: speech at about -35 dBFS) is raised to the target
    x = mono({ from: 0.4, to: 1.6, amp: 0.0255 });
    a = L.analyse(x, rate);
    let out = L.render(x, rate, a.trimStart, a.trimEnd, a.gain);
    const sA = Math.round((0.4 - a.trimStart) * rate), sB = Math.round((1.6 - a.trimStart) * rate);
    expect(near(a.speechDb, -34.8, 0.5) && !a.quiet && near(dbOf(rmsOf(out, sA, sB)), L.TARGET_DBFS, 0.3),
      `a quiet take (${a.speechDb.toFixed(1)} dBFS) should come out at ${L.TARGET_DBFS} dBFS, got ${dbOf(rmsOf(out, sA, sB)).toFixed(1)}`);
    // a loud take is turned down to the target, its peak under the cap
    x = mono({ from: 0.4, to: 1.6, amp: 0.95 });
    a = L.analyse(x, rate);
    out = L.render(x, rate, a.trimStart, a.trimEnd, a.gain);
    expect(a.gain < 1 && near(dbOf(rmsOf(out, sA, sB)), L.TARGET_DBFS, 0.3), 'a loud take was not turned down to the target');
    // a quiet take with one loud peak is held to the peak cap rather than distorted
    x = mono({ from: 0.4, to: 1.6, amp: 0.02 });
    x[Math.round(1.0 * rate)] = 0.5;
    a = L.analyse(x, rate);
    out = L.render(x, rate, a.trimStart, a.trimEnd, a.gain);
    const peak = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    expect(dbOf(peak) <= L.PEAK_CAP_DBFS + 0.01 && near(dbOf(peak), L.PEAK_CAP_DBFS, 0.1), `the peak should be held at ${L.PEAK_CAP_DBFS} dBFS, got ${dbOf(peak).toFixed(2)}`);
    // only noise: "I didn't hear anything"
    a = L.analyse(mono({ amp: 0, noise: 0.01 }), rate);
    expect(!a.heard, 'a take of only noise was taken for speech');
    a = L.analyse(new Float32Array(rate), rate);
    expect(!a.heard, 'a silent take was taken for speech');
    // very quiet: the gain never goes over the cap, and it says so
    x = mono({ from: 0.4, to: 1.6, amp: 0.006, noise: 0.00001 });
    a = L.analyse(x, rate);
    expect(a.heard && a.quiet && a.gain === L.GAIN_CAP, `a very quiet take should get the capped gain ${L.GAIN_CAP} and a note, got ${a.gain.toFixed(2)} quiet=${a.quiet}`);
    for (let k = 0; k < 40; k++) {
      const g = L.analyse(mono({ from: 0.3, to: 0.3 + 0.1 + k * 0.05, amp: 0.001 * (k + 1), noise: 0.00002 * (k % 5) }), rate).gain;
      expect(g <= L.GAIN_CAP && g >= L.GAIN_FLOOR, 'the gain went outside its limits: ' + g);
    }
    // stereo takes are mixed to one channel; the fades leave no click at either end
    const m = L.mixToMono([new Float32Array([1, 0.5, 0]), new Float32Array([0, 0.5, 1])]);
    expect(m.length === 3 && m.every((v) => v === 0.5), 'two channels were not mixed to one');
    out = L.render(new Float32Array(rate).fill(0.5), rate, 0.1, 0.9, 1);
    expect(out[0] === 0 && Math.abs(out[out.length - 1]) < 1e-6 && out[Math.round(rate * 0.4)] === 0.5, 'render() should fade in and out, and keep the middle');
    expect(L.render(new Float32Array(rate), rate, 0.1, 3, 1) === null, 'trim points past the end of the take should count as damaged');
    report('trimming and levelling', before);
  }

  // ---------- the microphone (src/mic.ts) ----------
  {
    const before = stats.failures;
    const micGame = (mic = {}) => freshGame({}, { mic, webaudio: true, idb: newIDB() });
    const released = (env, what) => {
      expect(env.mic.live() === 0, `${what}: ${env.mic.live()} microphone track(s) still live`);
      expect(env.mic.recording() === 0, `${what}: the recorder is still running`);
      expect(env.bpp.mic.phase() === 'idle', `${what}: the microphone is still ${env.bpp.mic.phase()}`);
      if (env.mic.session) expect(env.mic.session.type === 'playback', `${what}: the audio session was left as "${env.mic.session.type}"`);
    };
    // the parent answers the microphone question late: nothing is timed while it asks, and the take still gets 6 s
    let env = micGame({ answerAfterMs: 8000 });
    let t = env.bpp.mic.start();
    expect(env.mic.sessionAtAsk[0] === 'play-and-record', 'the audio session should be "play-and-record" when the microphone is asked for');
    const c = env.mic.constraints[0]?.audio ?? {};
    expect(c.echoCancellation === false && c.noiseSuppression === false && c.autoGainControl === false, 'voice processing should be off: ' + JSON.stringify(c));
    await tick(env, 7900);
    expect(env.bpp.mic.phase() === 'asking' && t.recordingCalls === 0, 'the panel should still be waiting for the microphone question');
    await tick(env, 200);
    expect(env.bpp.mic.phase() === 'recording' && t.recordingCalls === 1, 'recording did not start once the question was answered');
    expect(env.mic.recorders[0]?.mimeType === 'audio/mp4', 'the recording should be audio/mp4, got ' + env.mic.recorders[0]?.mimeType);
    await tick(env, 5800);              // recording started at 8.0 s, when the question was answered
    expect(env.bpp.mic.phase() === 'recording', 'the take stopped before 6 seconds of recording (the time spent asking was counted)');
    await tick(env, 300);
    expect(Math.abs((env.mic.recorders[0]?.ms ?? 0) - 6000) <= 20, 'the length limit should stop the take after 6 s of recording, got ' + env.mic.recorders[0]?.ms);
    expect(t.result?.kind === 'take' && t.result.type === 'audio/mp4' && t.result.data.byteLength > 0, 'the take was not handed over: ' + JSON.stringify(t.result?.kind));
    released(env, 'after the length limit');

    // the question left open for 60 seconds: gives up and lets go; a late "Allow" is let go straight away
    env = micGame({ answerAfterMs: 65000 });
    t = env.bpp.mic.start();
    await tick(env, 59900, 100);
    expect(env.bpp.mic.phase() === 'asking', 'gave up on the microphone question before 60 seconds');
    await tick(env, 200);
    expect(t.result?.kind === 'timeout', 'a question left open for 60 seconds should give up, got ' + t.result?.kind);
    released(env, 'after 60 seconds unanswered');
    await tick(env, 6000);
    expect(env.mic.tracks.length === 2 && env.mic.live() === 0 && env.mic.recorders.length === 0, 'a late "Allow" left the microphone on');

    // Stop early keeps the take so far
    env = micGame();
    t = env.bpp.mic.start();
    await tick(env, 300 + 2500);
    env.bpp.mic.stop();
    await tick(env, 100);
    expect(t.result?.kind === 'take' && env.mic.recorders[0].ms === 2500, 'Stop should keep a 2.5 s take, got ' + t.result?.kind + ' ' + env.mic.recorders[0]?.ms);
    released(env, 'after Stop');
    // a second take in the same opening of the app works too, with no new question needed
    t = env.bpp.mic.start();
    await tick(env, 400); env.bpp.mic.stop(); await tick(env, 100);
    expect(t.result?.kind === 'take', 'a second take did not work');
    released(env, 'after a second take');

    // refused, an error, a recorder that won't start, cancelling while asking and while recording, Record twice
    for (const [what, mic, act, want] of [
      ['refused', { answer: 'refuse' }, null, 'refused'],
      ['an error', { answer: 'error' }, null, 'error'],
      ['the recorder failing', { failStart: true }, null, 'error'],
      ['cancel while asking', { answerAfterMs: 5000 }, async (e) => { await tick(e, 1000); e.bpp.mic.cancel(); }, 'cancelled'],
      ['cancel while recording', {}, async (e) => { await tick(e, 2000); e.bpp.mic.cancel(); }, 'cancelled'],
      ['no audio session', { session: false }, async (e) => { await tick(e, 1000); e.bpp.mic.stop(); }, 'take'],
      ['no audio/mp4', { types: [] }, async (e) => { await tick(e, 1000); e.bpp.mic.stop(); }, 'take']
    ]) {
      env = micGame(mic);
      t = env.bpp.mic.start();
      const second = env.bpp.mic.start();
      if (act) await act(env);
      await tick(env, 6500);
      expect(t.result?.kind === want, `${what}: expected "${want}", got "${t.result?.kind}"`);
      expect(second.result?.kind === 'busy' && env.mic.asks === 1, `${what}: Record twice asked for the microphone twice`);
      released(env, what);
      if (what === 'no audio session') expect(!env.mic.session && env.mic.asks === 1, 'no audio session: should still record');
    }
    report('microphone: the limit counts from the start of recording, and the mic is always let go', before);
  }
}
