// Plays the game thousands of times with random taps and checks the rules.
// Run with:  node tests/invariants.mjs
// It loads the script out of index.html into a fake browser, so nothing needs installing.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
const code = scripts[scripts.length - 1][1];

let failures = 0;
function fail(msg) {
  failures++;
  if (failures <= 20) console.log('  FAIL: ' + msg);
}

// ---------- seeded random numbers, so a failure can be repeated ----------
function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- fake browser ----------
function makeEnv(opts) {
  const timers = [];
  let clock = 0, timerId = 1;
  const fakeSetTimeout = (fn, ms) => { const id = timerId++; timers.push({ id, t: clock + (ms || 0), fn }); return id; };
  const fakeClearTimeout = (id) => { const i = timers.findIndex((x) => x.id === id); if (i >= 0) timers.splice(i, 1); };
  const advance = (ms) => {
    clock += ms;
    for (;;) {
      const due = timers.filter((x) => x.t <= clock).sort((a, b) => a.t - b.t)[0];
      if (!due) break;
      timers.splice(timers.indexOf(due), 1);
      due.fn();
    }
  };

  const ctx2d = new Proxy({}, {
    get(target, prop) {
      if (prop === 'measureText') return () => ({ width: 50, actualBoundingBoxAscent: 70 });
      if (prop === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (prop in target) return target[prop];
      return () => {};
    },
    set(target, prop, value) { target[prop] = value; return true; }
  });
  const makeEl = () => ({
    style: {}, textContent: '', clientWidth: 1024, clientHeight: 768, width: 0, height: 0, offsetWidth: 0,
    children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute() {},
    addEventListener() {},
    getContext: () => ctx2d,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1024, height: 768 })
  });
  const elements = {};
  const document = {
    hidden: false,
    getElementById: (id) => (elements[id] = elements[id] || makeEl()),
    addEventListener() {},
    fonts: undefined
  };

  // fake speech: counts how many utterances are waiting so we can prove it never exceeds one
  const speech = { queued: [], maxQueued: 0, spoken: 0, cancels: 0, texts: [] };
  const speechSynthesis = {
    getVoices: () => [
      { name: 'Bad News', lang: 'en-US', voiceURI: 'bn' },
      { name: 'Samantha', lang: 'en-US', voiceURI: 'sam' },
      { name: 'Daniel', lang: 'en-GB', voiceURI: 'dan' }
    ],
    addEventListener() {},
    speak(u) {
      speech.queued.push(u);
      speech.spoken++;
      speech.texts.push(u.text);
      speech.maxQueued = Math.max(speech.maxQueued, speech.queued.length);
      u._timer = fakeSetTimeout(() => { speech.queued = speech.queued.filter((x) => x !== u); if (u.onend) u.onend({}); }, 1500);
    },
    cancel() {
      speech.cancels++;
      const old = speech.queued; speech.queued = [];
      old.forEach((u) => { fakeClearTimeout(u._timer); fakeSetTimeout(() => u.onerror && u.onerror({ error: 'interrupted' }), 0); });
    }
  };
  class SpeechSynthesisUtterance { constructor(text) { this.text = text; } }

  // fake recorded clips: mode 'ok' plays for 1 second, 'fail' refuses to load
  const audio = { created: [], playing: [], maxPlaying: 0 };
  class Audio {
    constructor(src) { this.src = src; audio.created.push(src); }
    play() {
      if (opts.audio === 'fail') return Promise.reject(new Error('cannot play'));
      audio.playing.push(this);
      audio.maxPlaying = Math.max(audio.maxPlaying, audio.playing.length);
      this._timer = fakeSetTimeout(() => { audio.playing = audio.playing.filter((x) => x !== this); if (this.onended) this.onended(); }, 1000);
      return Promise.resolve();
    }
    pause() { fakeClearTimeout(this._timer); audio.playing = audio.playing.filter((x) => x !== this); }
  }

  const context = {
    document, console, Math, Object, Array, String, Number, Date, JSON,
    setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout,
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    devicePixelRatio: 2, innerWidth: 1024, innerHeight: 768
  };
  if (opts.speech) { context.speechSynthesis = speechSynthesis; context.SpeechSynthesisUtterance = SpeechSynthesisUtterance; }
  if (opts.audio) context.Audio = Audio;
  context.window = context;
  context.__BPP_TEST = true;
  context.addEventListener = () => {};
  vm.createContext(context);
  vm.runInContext('Math.random = __rand;', Object.assign(context, { __rand: opts.rand }));
  vm.runInContext(code, context);
  return { bpp: context.__bpp, advance, speech, audio, elements };
}

// ---------- scenarios ----------
const SIZES = [[1180, 820], [820, 1180], [1133, 744], [744, 1133], [390, 844], [844, 390], [1024, 768]];
const POOLS = [
  { name: 'default A-E', s: {} },
  { name: 'numbers 1-5', s: { mode: 'numbers' } },
  { name: 'both', s: { mode: 'both' } },
  { name: 'whole alphabet, lowercase', s: { letters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', letterCase: 'lower' } },
  { name: 'look-alike heavy', s: { letters: 'BDPQMWNUOIL', numbers: '690 1'.replace(/ /g, ''), mode: 'both', letterCase: 'both' } },
  { name: 'two items only', s: { letters: 'AB' } },
  { name: 'one item only', s: { letters: 'A' } }
];

function run(scn, seed, withSpeech) {
  const rand = mulberry(seed);
  const { bpp, advance, speech } = makeEnv({ rand, speech: withSpeech });
  bpp.setSettings(scn.s);
  bpp.resize(...SIZES[seed % SIZES.length]);
  bpp.start();
  const targets = [];
  let pops = 0, wrongs = 0, lastKey = null, lastSimTarget = null;
  const seen = new Set();
  const STEPS = 6000;                       // 100 seconds of play at 60 frames per second
  for (let i = 0; i < STEPS; i++) {
    const dt = rand() < 0.02 ? 0.05 : 1 / 60;   // sometimes a slow frame
    bpp.step(dt);
    advance(dt * 1000);
    if (i % 900 === 450) {                       // rotate / resize in the middle of play
      const before = bpp.state().target.key;
      bpp.resize(...SIZES[Math.floor(rand() * SIZES.length)]);
      if (bpp.state().target.key !== before) fail(scn.name + ': resize changed the target');
    }
    // random fingers
    const fingers = rand() < 0.05 ? 1 + Math.floor(rand() * 4) : (rand() < 0.04 ? 1 : 0);
    for (let f = 0; f < fingers; f++) {
      const st = bpp.state();
      const roll = rand();
      const live = st.bubbles.filter(bpp.isLive);
      const targetKeyBefore = st.target.key;
      if (roll < 0.5) {
        const tb = live.find((b) => b.key === st.target.key);
        if (tb) { const p = bpp.pos(tb); bpp.tap(p.x, Math.min(p.y, st.H - 1)); }
      } else if (roll < 0.8) {
        const others = live.filter((b) => b.key !== st.target.key);
        if (others.length) {
          const b = others[Math.floor(rand() * others.length)];
          const p = bpp.pos(b); bpp.tap(p.x, Math.min(Math.max(p.y, 1), st.H - 1));
          if (bpp.state().target.key !== targetKeyBefore) fail(scn.name + ': a wrong pop changed the target');
          wrongs++;
        }
      } else if (roll < 0.9) {
        const popping = st.bubbles.find((b) => b.state === 'popping');
        if (popping) { const p = bpp.pos(popping); const keyBefore = st.target.key; bpp.tap(p.x, p.y); if (bpp.state().target.key !== keyBefore) fail(scn.name + ': tapping a popping bubble did something'); }
      } else {
        bpp.tap(rand() * st.W, rand() * st.H);   // anywhere, maybe empty
      }
      const now = bpp.state().target;
      if (now !== lastSimTarget) { lastSimTarget = now; targets.push(now.key); seen.add(now.key); }
    }
    const errs = bpp.check();
    if (errs.length) errs.forEach((e) => fail(`${scn.name} seed ${seed} step ${i}: ${e}`));
    if (!lastSimTarget) lastSimTarget = bpp.state().target;
  }
  // targets must not repeat straight away (unless only one item exists)
  const poolSize = bpp.pool().length;
  if (poolSize > 1) {
    for (let i = 1; i < targets.length; i++) {
      if (targets[i] === targets[i - 1]) { fail(`${scn.name}: target ${targets[i]} repeated immediately`); break; }
    }
  }
  pops = targets.length;
  if (pops < 3) fail(`${scn.name}: only ${pops} targets in 100 seconds, the game seems stuck`);
  if (withSpeech) {
    if (speech.maxQueued > 1) fail(`${scn.name}: ${speech.maxQueued} utterances queued at once`);
    if (speech.spoken === 0) fail(`${scn.name}: nothing was ever spoken`);
    if (speech.texts.some((t) => !t || /undefined|NaN/.test(t))) fail(`${scn.name}: a spoken line was broken: ${speech.texts.find((t) => !t || /undefined|NaN/.test(t))}`);
  }
  return { targets: pops, wrongs, speech, bpp };
}

let totalRuns = 0;
for (const withSpeech of [true, false]) {
  for (const scn of POOLS) {
    const before = failures;
    for (let seed = 1; seed <= 14; seed++) { run(scn, seed, withSpeech); totalRuns++; }
    console.log(`${failures === before ? 'ok  ' : 'FAIL'} ${scn.name} (${withSpeech ? 'with' : 'without'} speech)`);
  }
}

// ---------- spoken lines: print a sample so a human can read them ----------
{
  const { bpp, speech, advance } = makeEnv({ rand: mulberry(7), speech: true });
  bpp.setSettings({ mode: 'both' });
  bpp.resize(1180, 820);
  bpp.start();
  const lines = new Set();
  for (let i = 0; i < 4000; i++) {
    bpp.step(1 / 60); advance(1000 / 60);
    if (i % 40 === 0) {
      const st = bpp.state();
      const live = st.bubbles.filter(bpp.isLive);
      const tb = live.find((b) => b.key === st.target.key);
      const wrong = live.find((b) => b.key !== st.target.key);
      const pick = i % 80 === 0 ? tb : wrong;
      if (pick) { const p = bpp.pos(pick); bpp.tap(p.x, Math.min(p.y, st.H - 1)); }
    }
  }
  speech.texts.forEach((t) => lines.add(t));
  console.log('\nSample of what the voice says:');
  [...lines].slice(0, 8).forEach((t) => console.log('  "' + t + '"'));
}

// ---------- feature checks ----------
function expect(cond, msg) { if (!cond) fail(msg); }
function freshGame(extra = {}, envOpts = {}) {
  const env = makeEnv({ rand: mulberry(envOpts.seed || 11), speech: true, ...envOpts });
  env.bpp.setSettings(extra);
  env.bpp.resize(1180, 820);
  env.bpp.start();
  return env;
}
function runFor(env, seconds) {
  for (let i = 0; i < seconds * 60; i++) { env.bpp.step(1 / 60); env.advance(1000 / 60); }
}
function tapBubble(bpp, b) {
  const st = bpp.state();
  const p = bpp.pos(b);
  bpp.tap(p.x, Math.min(Math.max(p.y, 1), st.H - 1));
}
function targetBubble(bpp) {
  const st = bpp.state();
  return st.bubbles.find((b) => bpp.isLive(b) && b.key === st.target.key);
}
function otherBubble(bpp) {
  const st = bpp.state();
  return st.bubbles.find((b) => bpp.isLive(b) && b.key !== st.target.key && bpp.pos(b).y < st.H - 50);
}

{
  const before = failures;

  // hint after 2 wrong pops, gone again for the next target
  let env = freshGame();
  expect(!env.bpp.state().hintOn, 'hint showed straight away');
  tapBubble(env.bpp, otherBubble(env.bpp)); runFor(env, 2);
  expect(!env.bpp.state().hintOn, 'hint showed after only 1 wrong pop');
  tapBubble(env.bpp, otherBubble(env.bpp)); runFor(env, 0.1);
  expect(env.bpp.state().hintOn, 'no hint after 2 wrong pops');
  tapBubble(env.bpp, targetBubble(env.bpp)); runFor(env, 0.3);
  expect(!env.bpp.state().hintOn, 'hint stayed on for the next target');

  // hint after ~15 seconds with no taps
  env = freshGame();
  runFor(env, 14);
  expect(!env.bpp.state().hintOn, 'idle hint came before 15 seconds');
  runFor(env, 2);
  expect(env.bpp.state().hintOn, 'no idle hint after 15 seconds');

  // the prompt repeats about every 8 seconds while nobody taps
  env = freshGame();
  runFor(env, 41);
  const prompts = env.bpp.sayLog.filter((k) => k.startsWith('prompt:')).length;
  expect(prompts >= 4 && prompts <= 6, `expected a prompt about every 8s over 41s of quiet, got ${prompts}`);
  expect(env.speech.maxQueued <= 1, 'idle prompts queued speech');

  // stars: a bigger celebration every 10, and confetti stays capped at 60
  env = freshGame();
  let maxParticles = 0;
  for (let n = 1; n <= 25; n++) {
    const tb = targetBubble(env.bpp);
    if (!tb) { runFor(env, 1); n--; continue; }
    tapBubble(env.bpp, tb);
    maxParticles = Math.max(maxParticles, env.bpp.state().particles);
    expect(env.bpp.state().particles <= 60, 'more than 60 confetti pieces');
    runFor(env, n % 10 === 0 ? 6 : 0.4);   // let the party line finish; faster taps would cut it off
  }
  expect(env.bpp.state().stars === 25, 'star count is ' + env.bpp.state().stars + ', expected 25');
  expect(maxParticles >= 20, 'no confetti burst on a correct pop');
  expect(env.bpp.sayLog.filter((k) => k === 'party').length >= 2, 'expected a party line at 10 and 20 stars');

  // items that were missed come up more often
  env = freshGame({ letters: 'ABCDEFGH' }, { seed: 3 });
  const counts = {};
  let total = 0;
  for (let n = 0; n < 300; n++) {
    const tb = targetBubble(env.bpp);
    if (!tb) { runFor(env, 1); n--; continue; }
    const key = env.bpp.state().target.key;
    counts[key] = (counts[key] || 0) + 1; total++;
    if (key === 'C') {           // C is always missed twice before it is found
      for (let w = 0; w < 2; w++) { const o = otherBubble(env.bpp); if (o) tapBubble(env.bpp, o); runFor(env, 1.6); }
    }
    const t2 = targetBubble(env.bpp);
    if (t2) tapBubble(env.bpp, t2);
    runFor(env, 0.3);
  }
  const avgOther = (total - (counts.C || 0)) / 7;
  expect((counts.C || 0) > avgOther * 1.5, `missed item C came up ${counts.C} times vs ${avgOther.toFixed(1)} for the others`);

  // sparkles: 'auto' only for a letter she has missed, and they fade once she finds it first try
  env = freshGame({ letters: 'AC' });
  expect(!env.bpp.state().sparkles, 'sparkles showed for a letter she has not missed');
  runFor(env, 4);   // let the second bubble float up into view
  tapBubble(env.bpp, otherBubble(env.bpp)); runFor(env, 2);
  expect(env.bpp.state().sparkles, 'no sparkles after she missed the letter');
  tapBubble(env.bpp, targetBubble(env.bpp)); runFor(env, 0.5);   // found with help: still needs practice
  const keyMissed = Object.keys(env.bpp.state().missed).find((k) => env.bpp.state().missed[k] > 0);
  expect(!!keyMissed, 'the missed letter was forgotten too early');
  env.bpp.setSettings({ sparkles: 'off' });
  expect(!env.bpp.state().sparkles, 'sparkles showed although they are switched off');
  env.bpp.setSettings({ sparkles: 'on' });
  expect(env.bpp.state().sparkles, 'sparkles did not show although they are switched on');
  // finding a missed letter first try counts it down until the sparkles stop
  env.bpp.setSettings({ sparkles: 'auto' });
  let guard = 0;
  while (guard++ < 40 && Object.keys(env.bpp.state().missed).some((k) => env.bpp.state().missed[k] > 0)) {
    const tb = targetBubble(env.bpp);
    if (!tb) { runFor(env, 1); continue; }
    tapBubble(env.bpp, tb);
    runFor(env, 0.4);
  }
  expect(!Object.keys(env.bpp.state().missed).some((k) => env.bpp.state().missed[k] > 0), 'missed counts never counted down');
  expect(!env.bpp.state().sparkles, 'sparkles still showing after she knows every letter');

  console.log(`${failures === before ? 'ok  ' : 'FAIL'} hints, repeating prompts, stars, confetti cap, missed-item weighting, sparkles`);
}

{
  const before = failures;
  // mute: nothing is spoken, the game keeps working, and un-muting says the target again
  const env = freshGame();
  env.bpp.setMuted(true);
  const spokenBefore = env.speech.spoken;
  for (let n = 0; n < 4; n++) { const tb = targetBubble(env.bpp); if (tb) tapBubble(env.bpp, tb); runFor(env, 3); }
  expect(env.speech.spoken === spokenBefore, 'the voice spoke while muted');
  expect(env.bpp.state().stars >= 3, 'the game stopped working while muted');
  env.bpp.setMuted(false);
  expect(env.bpp.sayLog[env.bpp.sayLog.length - 1].startsWith('prompt:'), 'un-muting did not repeat the prompt');
  console.log(`${failures === before ? 'ok  ' : 'FAIL'} mute button`);
}

{
  const before = failures;
  // recorded clips play in order, one at a time
  let env = freshGame({ letters: 'AB' }, { audio: 'ok' });
  const clipMap = {};
  ['A', 'B'].forEach((k) => ['prompt', 'cheer', 'that'].forEach((kind) => { clipMap[kind + ':' + k] = 'audio/' + kind + '-' + k + '.m4a'; }));
  Object.assign(env.bpp.overrides, clipMap);
  const targetKey = env.bpp.state().target.key;
  const wrongKey = targetKey === 'A' ? 'B' : 'A';
  const wrongBubble = env.bpp.state().bubbles.find((b) => b.key === wrongKey);
  expect(!!wrongBubble, 'test setup: no wrong bubble on screen');
  if (wrongBubble) {
    tapBubble(env.bpp, wrongBubble);
    runFor(env, 5);
    const clips = env.audio.created;
    expect(clips[0] === `audio/that-${wrongKey}.m4a`, 'wrong pop should play "that\'s the letter" first, got ' + clips[0]);
    expect(clips[1] === `audio/prompt-${targetKey}.m4a`, 'wrong pop should then play the prompt, got ' + clips[1]);
    expect(env.audio.maxPlaying <= 1, 'two recordings played at once');
    expect(env.speech.spoken === 0, 'computer voice spoke even though every clip had a recording');
  }
  // a recording that can't be loaded falls back to the computer voice
  env = freshGame({ letters: 'AB' }, { audio: 'fail' });
  Object.assign(env.bpp.overrides, clipMap);
  tapBubble(env.bpp, targetBubble(env.bpp));
  await new Promise((r) => setImmediate(r));
  runFor(env, 3);
  expect(env.speech.texts.some((x) => /Yay!/.test(x)), 'broken recording did not fall back to the computer voice');
  console.log(`${failures === before ? 'ok  ' : 'FAIL'} recorded clips and voice fallback`);
}

console.log(`\n${totalRuns} simulated games, ${failures} problems found.`);
process.exit(failures ? 1 : 0);
