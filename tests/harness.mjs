// The fake browser and the helpers every test area uses.
// The game is loaded from the built dist/game.js, so the tests check what actually ships (run `npm run build` first;
// `npm test` does it for you).
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const dist = path.join(root, 'dist');
if (!fs.existsSync(path.join(dist, 'game.js'))) {
  console.error('dist/game.js is missing. Run: npm run build');
  process.exit(1);
}
export const code = fs.readFileSync(path.join(dist, 'game.js'), 'utf8');

export const stats = { failures: 0, games: 0 };
export function fail(msg) {
  stats.failures++;
  if (stats.failures <= 20) console.log('  FAIL: ' + msg);
}
export function expect(cond, msg) { if (!cond) fail(msg); }
export function report(name, before) { console.log(`${stats.failures === before ? 'ok  ' : 'FAIL'} ${name}`); }

// ---------- seeded random numbers, so a failure can be repeated ----------
export function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- fake browser ----------
export function makeEnv(opts) {
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
    getAttribute: () => null,
    querySelectorAll: () => [],
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
  const speech = { queued: [], maxQueued: 0, spoken: 0, cancels: 0, texts: [], times: [], volumes: [] };
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
      speech.times.push(clock);
      speech.volumes.push(u.volume);
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
  if (opts.storage === 'blocked') {          // like private browsing: even touching localStorage throws
    Object.defineProperty(context, 'localStorage', { get() { throw new Error('SecurityError'); } });
  } else if (opts.storage) {                 // a Map that outlives the page, like real storage
    context.localStorage = {
      getItem: (k) => (opts.storage.has(k) ? opts.storage.get(k) : null),
      setItem: (k, v) => { opts.storage.set(k, String(v)); }
    };
  }
  context.window = context;
  context.__BPP_TEST = true;
  context.addEventListener = () => {};
  vm.createContext(context);
  vm.runInContext('Math.random = __rand;', Object.assign(context, { __rand: opts.rand }));
  vm.runInContext(code, context);
  return { bpp: context.__bpp, advance, speech, audio, elements };
}

// ---------- helpers for the feature checks ----------
export function freshGame(extra = {}, envOpts = {}) {
  const env = makeEnv({ rand: mulberry(envOpts.seed || 11), speech: true, ...envOpts });
  env.bpp.setSettings(extra);
  env.bpp.resize(1180, 820);
  env.bpp.start();
  return env;
}
export function runFor(env, seconds) {
  for (let i = 0; i < seconds * 60; i++) { env.bpp.step(1 / 60); env.advance(1000 / 60); }
}
export function tapBubble(bpp, b) {
  const st = bpp.state();
  const p = bpp.pos(b);
  bpp.tap(p.x, Math.min(Math.max(p.y, 1), st.H - 1));
}
export function targetBubble(bpp) {
  const st = bpp.state();
  return st.bubbles.find((b) => bpp.isLive(b) && b.key === st.target.key);
}
export function otherBubble(bpp) {
  const st = bpp.state();
  return st.bubbles.find((b) => bpp.isLive(b) && b.key !== st.target.key && bpp.pos(b).y < st.H - 50);
}

export function passGate(env) {
  env.bpp.ui.openGate();
  env.bpp.ui.startHold();
  env.advance(3100);
  const p = env.bpp.ui.problem();
  String(p.a + p.b).split('').forEach((d) => env.bpp.ui.key(d));
  env.bpp.ui.key('ok');
}
