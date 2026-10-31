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
    classList: { add() {}, remove() {}, toggle() {} },
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

  const context = {
    document, console, Math, Object, Array, String, Number, Date, JSON,
    setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout,
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    devicePixelRatio: 2, innerWidth: 1024, innerHeight: 768
  };
  if (opts.speech) { context.speechSynthesis = speechSynthesis; context.SpeechSynthesisUtterance = SpeechSynthesisUtterance; }
  context.window = context;
  context.__BPP_TEST = true;
  context.addEventListener = () => {};
  vm.createContext(context);
  vm.runInContext('Math.random = __rand;', Object.assign(context, { __rand: opts.rand }));
  vm.runInContext(code, context);
  return { bpp: context.__bpp, advance, speech, elements };
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

console.log(`\n${totalRuns} simulated games, ${failures} problems found.`);
process.exit(failures ? 1 : 0);
