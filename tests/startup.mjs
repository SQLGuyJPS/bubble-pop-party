// Fixes from the Milestone 6 playtest: Play waits for your recordings, a short pause before a prompt that follows
// another line, and the sound coming back after the file picker (delete all, then load the backup file).
import { report, stats, expect, makeEnv, mulberry, flush, tick, tapBubble, targetBubble } from './harness.mjs';
import { record, deviceWith } from './recordings.mjs';
import { recScreen } from './recscreen.mjs';

const DEFAULT_CLIPS = ['A', 'B', 'C', 'D', 'E'].flatMap((k) => ['prompt:' + k, 'cheer:' + k, 'that:' + k]);
const recorded = (names) => Object.fromEntries(names.map((n) => [n, record(n)]));

// The game opened from the icon, not started yet. Play is tapped with bpp.play().
function opened(envOpts) {
  const env = makeEnv({ rand: mulberry(5), speech: true, webaudio: true, ...envOpts });
  env.bpp.resize(1180, 820);
  return env;
}

export default async function () {
  // ---------- Play waits until your recordings are ready ----------
  {
    const before = stats.failures;
    // tapped straight away, before the recordings are read and decoded: "Loading…", then your voice first
    let env = opened({ idb: deviceWith(recorded(DEFAULT_CLIPS)) });
    env.bpp.play();
    let st = env.bpp.state();
    expect(st.loading && !st.running, 'Play tapped while recordings load should wait ("Loading…"), not start the game');
    expect(env.speech.spoken === 0 && env.webaudio.played.length === 0, 'nothing should be said while the recordings load');
    env.bpp.play();   // a second tap while loading changes nothing
    await tick(env, 500);
    st = env.bpp.state();
    expect(st.running && !st.loading && env.bpp.loadProgress().ready, 'the game should start once the recordings are ready');
    expect(env.bpp.sayLog.length === 1 && env.bpp.sayLog[0].startsWith('prompt:'), 'the game should start with one prompt: ' + env.bpp.sayLog.join());
    await tick(env, 100);
    expect(env.webaudio.played.length === 1 && env.speech.spoken === 0, 'the very first prompt should be your recording, not the computer voice');

    // recordings already decoded by the time Play is tapped: no waiting
    env = opened({ idb: deviceWith(recorded(DEFAULT_CLIPS)) });
    await flush(20);
    expect(env.bpp.loadProgress().ready && env.bpp.loadProgress().total === DEFAULT_CLIPS.length,
      'the recordings for the chosen letters should be decoded at start-up: ' + JSON.stringify(env.bpp.loadProgress()));
    env.bpp.play();
    expect(env.bpp.state().running && !env.bpp.state().loading, 'with the recordings ready, Play should start at once');

    // no recordings at all: no waiting either
    env = opened({ idb: deviceWith({}) });
    await flush(10);
    env.bpp.play();
    expect(env.bpp.state().running, 'with no recordings, Play should start at once');
    await tick(env, 100);
    expect(env.speech.spoken === 1, 'with no recordings, the first prompt should be the computer voice');

    // storage that never answers: Play still starts, within 8 seconds
    env = opened({ idb: { ...deviceWith(recorded(DEFAULT_CLIPS)), mode: 'hang' } });
    env.bpp.play();
    await tick(env, 8200, 50);
    expect(env.bpp.state().running && !env.bpp.state().loading, 'Play should never wait more than 8 seconds for the recordings');
    report('Play waits for your recordings, then the first prompt is your voice', before);
  }

  // ---------- a short pause before a prompt that follows another line ----------
  {
    const before = stats.failures;
    const env = opened({ idb: deviceWith({}) });
    await flush(10);
    env.bpp.play();
    await tick(env, 3000);
    env.bpp.quiet();
    const n = env.speech.texts.length;
    tapBubble(env.bpp, targetBubble(env.bpp));
    await tick(env, 6000);
    const t = env.speech.texts.slice(n), at = env.speech.times.slice(n);
    const p = t.findIndex((x) => x.startsWith('Can you find'));
    expect(p === 2, 'after a right pop: two cheer pieces, then the prompt: ' + t.join(' | '));
    const gap = at[p] - (at[p - 1] + 1500);   // the fake voice takes 1.5 s per line
    expect(gap >= 300 && gap < 1000, `the prompt after a cheer should wait a moment (0.3 to 1 s), waited ${gap} ms`);
    // a wrong pop: "That's the letter …", a pause, then the prompt
    env.bpp.say('wrong:B:A');
    await tick(env, 4000);
    const w = env.speech.times.slice(-2);
    expect(env.speech.texts.at(-1).startsWith('Can you find') && w[1] - (w[0] + 1500) >= 300 && w[1] - (w[0] + 1500) < 1000,
      'the prompt after "That\'s the letter …" should wait a moment (0.3 to 1 s)');
    // the repeat button after a quiet moment: no extra wait
    await tick(env, 2000);
    const k = env.speech.spoken;
    env.bpp.say('prompt:A');
    await tick(env, 100);
    expect(env.speech.spoken === k + 1, 'a prompt that follows nothing should start straight away');
    report('a short pause before a prompt that follows another line', before);
  }

  // ---------- the sound comes back after the file picker ----------
  {
    const before = stats.failures;
    // the playtest: delete all recordings, load them again from the backup file, back to the game
    const env = await recScreen({ idb: deviceWith(recorded(DEFAULT_CLIPS)), share: 'ok' });
    env.act('save'); await flush(10);
    const bytes = new Uint8Array(await env.shared[0].arrayBuffer());
    env.act('delete-all'); env.act('delete-all-yes'); await flush(10);
    env.elements.recFile.click = () => {};
    env.act('load');                                       // the file picker opens...
    const old = env.webaudio.last;
    old.state = 'interrupted'; old.stuck = true;           // ...and, on iOS, leaves the sound stuck
    await env.bpp.rec.ui.loadBytes(bytes); await flush(10);
    env.act('load-replace'); await flush(12);
    expect(env.model().html.includes('Loaded ' + DEFAULT_CLIPS.length + ' recordings.'), 'the backup file did not load');
    const silent = env.webaudio.silent, played = env.webaudio.played.length, effects = env.webaudio.effects;
    env.bpp.ui.closeSettings();                            // Done: back to the game (a tap)
    await flush(12);
    expect(env.bpp.audioRebuilds() === 1 && old.state === 'closed' && env.webaudio.last !== old && env.webaudio.last.state === 'running',
      'after the file picker, the next tap should replace the stuck sound system with a fresh one');
    await tick(env, 2500);                                 // the gentle re-prompt
    env.bpp.quiet();
    tapBubble(env.bpp, targetBubble(env.bpp));             // a pop and a cheer
    await tick(env, 300);
    expect(env.webaudio.played.length > played, 'after loading the file, the recordings should play in the game');
    expect(env.webaudio.effects > effects, 'after loading the file, the pops should play');
    expect(env.webaudio.silent === silent, `after loading the file, ${env.webaudio.silent - silent} sounds went to a stuck sound system`);
    expect(env.bpp.loadProgress().ready, 'the loaded recordings should be decoded again');

    // stuck for another reason (a call, the lock screen): a tap that can't wake it means the next tap starts afresh
    const env2 = opened({ idb: deviceWith({}) });
    await flush(10);
    env2.bpp.play();
    const first = env2.webaudio.last;
    first.state = 'suspended'; first.stuck = true;
    env2.bpp.unlockAudio();                                // a tap: asks it to wake, it doesn't
    await tick(env2, 1000);
    expect(env2.bpp.audioRebuilds() === 0, 'one tap that could not wake the sound should not rebuild it yet');
    env2.bpp.unlockAudio();                                // the next tap
    expect(env2.bpp.audioRebuilds() === 1 && env2.webaudio.last !== first && env2.webaudio.last.state === 'running',
      'a sound system that stays stuck after a tap should be replaced at the next tap');
    // a working one is never replaced
    env2.bpp.unlockAudio();
    await tick(env2, 1000);
    env2.bpp.unlockAudio();
    expect(env2.bpp.audioRebuilds() === 1, 'a working sound system was replaced');
    // one iOS reports as "interrupted" is replaced at the first tap
    env2.webaudio.last.state = 'interrupted';
    env2.bpp.unlockAudio();
    expect(env2.bpp.audioRebuilds() === 2 && env2.webaudio.last.state === 'running', 'an "interrupted" sound system should be replaced at the next tap');
    report('the sound comes back after the file picker or when stuck', before);
  }
}
