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

// Loads one of the game's own modules (TypeScript in src/) into Node, compiled in memory, for checks of pure functions.
export async function loadModule(rel) {
  const { build } = await import('esbuild');
  const out = await build({ entryPoints: [path.join(root, rel)], bundle: true, format: 'esm', platform: 'neutral', write: false, logLevel: 'silent' });
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
}

// ---------- seeded random numbers, so a failure can be repeated ----------
export function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- fake IndexedDB ----------
// newIDB() is a database that outlives the page, like real storage: pass it to several makeEnv() calls to open the
// game again on the same device. Its `mode` switches: 'ok', 'missing' (no indexedDB at all), 'fail' (opening
// fails), 'hang' (opening never answers), 'full' (every write is refused as over quota).
export function newIDB(mode = 'ok') { return { mode, version: 0, stores: new Map(), keyPaths: {}, writes: 0, failNextWrite: false }; }
export const flush = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };
// Moves the fake clock in small steps, letting promises settle between them (the microphone and storage answer
// through promises).
export async function tick(env, ms, stepMs = 10) {
  for (let t = 0; t < ms; t += stepMs) { env.advance(Math.min(stepMs, ms - t)); await flush(2); }
}
function fakeIndexedDB(db) {
  const later = (fn) => { Promise.resolve().then(fn); };
  const clone = (v) => (v === undefined ? undefined : structuredClone(v));
  const fire = (r, ev, e) => { const h = r['on' + ev]; if (h) h(e || {}); };
  function connection() {
    return {
      get version() { return db.version; },
      objectStoreNames: { contains: (n) => db.stores.has(n) },
      close() {},
      createObjectStore(name, o) { db.stores.set(name, new Map()); db.keyPaths[name] = o && o.keyPath; return {}; },
      transaction(names, mode) {
        const writes = [];
        let open = 0, failed = null;
        const tx = { oncomplete: null, onerror: null, onabort: null, error: null, mode };
        const req = (fn) => {
          const r = { result: undefined, error: null, onsuccess: null, onerror: null };
          open++;
          later(() => { open--; try { r.result = fn(); fire(r, 'success'); } catch (e) { r.error = e; fire(r, 'error'); } });
          return r;
        };
        tx.objectStore = (name) => {
          const store = db.stores.get(name);
          if (!store) { const e = new Error('no store ' + name); e.name = 'NotFoundError'; throw e; }
          return {
            get: (k) => req(() => clone(store.get(k))),
            getAll: () => req(() => [...store.values()].map(clone)),
            getAllKeys: () => req(() => [...store.keys()]),
            put: (v) => { const k = v[db.keyPaths[name]]; const c = clone(v); writes.push(() => store.set(k, c)); return req(() => k); },
            delete: (k) => { writes.push(() => store.delete(k)); return req(() => undefined); },
            clear: () => { writes.push(() => store.clear()); return req(() => undefined); }
          };
        };
        const commit = () => {
          if (open > 0) { setImmediate(commit); return; }
          if (writes.length && (db.mode === 'full' || db.failNextWrite)) {
            failed = db.mode === 'full' ? 'QuotaExceededError' : 'UnknownError';
            db.failNextWrite = false;
          }
          if (failed) { tx.error = { name: failed }; fire(tx, 'error'); fire(tx, 'abort'); return; }
          writes.forEach((w) => w());
          if (writes.length) db.writes++;
          fire(tx, 'complete');
        };
        setImmediate(commit);
        return tx;
      }
    };
  }
  return {
    open(name, version) {
      const r = { result: undefined, error: null, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
      if (db.mode === 'hang') return r;
      later(() => {
        if (db.mode === 'fail') { r.error = { name: 'UnknownError' }; fire(r, 'error'); return; }
        if (db.version > version) { r.error = { name: 'VersionError' }; fire(r, 'error'); return; }
        r.result = connection();
        if (db.version < version) { const old = db.version; db.version = version; fire(r, 'upgradeneeded', { oldVersion: old, newVersion: version }); }
        fire(r, 'success');
      });
      return r;
    }
  };
}

// ---------- fake Web Audio (only with makeEnv({ webaudio: true })) ----------
// decodeAudioData turns bytes into a signal: by default a 2.4 s stereo take with quiet noise and speech (a tone) from
// 0.4 to 1.6 s. Bytes starting with 0xEE don't decode. opts.decode(bytes) can return { rate, channels } instead.
export const UNDECODABLE = 0xEE;
export function takeSignal({ seconds = 2.4, rate = 48000, from = 0.4, to = 1.6, amp = 0.025, noise = 0.0003, channels = 2 } = {}) {
  const n = Math.round(seconds * rate);
  const mono = new Float32Array(n);
  let seed = 9;
  for (let i = 0; i < n; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    mono[i] = noise * ((seed / 0x7fffffff) * 2 - 1) + (i >= from * rate && i < to * rate ? amp * Math.sin(i * 2 * Math.PI * 220 / rate) : 0);
  }
  return { rate, channels: Array.from({ length: channels }, () => mono.slice()) };
}
function fakeWebAudio(opts, webaudio, setT, clearT) {
  class AudioBuffer {
    constructor(ch, len, rate) { this.numberOfChannels = ch; this.length = len; this.sampleRate = rate; this.duration = len / rate; this._d = Array.from({ length: ch }, () => new Float32Array(len)); this.from = 'create'; }
    getChannelData(i) { return this._d[i]; }
  }
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
  return class AudioContext {
    constructor() { this.sampleRate = 48000; this.state = 'suspended'; this.currentTime = 0; this.destination = {}; webaudio.contexts++; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    createGain() { return { gain: param(), connect() {}, disconnect() {} }; }
    createBuffer(ch, len, rate) { return new AudioBuffer(ch, len, rate); }
    createOscillator() { return { type: '', frequency: param(), connect() {}, start() {}, stop() {} }; }
    createBiquadFilter() { return { type: '', frequency: param(), connect() {} }; }
    createBufferSource() {
      const src = {
        buffer: null, onended: null, connect() {}, disconnect() {},
        start() {
          const b = src.buffer;
          if (!b || b.duration < 0.2) return;          // the pop's noise and the silent unlock sound
          webaudio.played.push(b);
          webaudio.playing++;
          webaudio.maxPlaying = Math.max(webaudio.maxPlaying, webaudio.playing);
          src._t = setT(() => { src._t = 0; webaudio.playing--; if (src.onended) src.onended(); }, b.duration * 1000);
        },
        stop() { if (src._t) { clearT(src._t); src._t = 0; webaudio.playing--; if (src.onended) src.onended(); } }
      };
      return src;
    }
    decodeAudioData(data, ok, bad) {
      webaudio.decodes++;
      const bytes = new Uint8Array(data);
      const sig = bytes.length && bytes[0] !== UNDECODABLE ? (opts.decode || (() => takeSignal()))(bytes) : null;
      const buf = sig && new AudioBuffer(sig.channels.length, sig.channels[0].length, sig.rate);
      if (buf) { buf.from = 'decode'; sig.channels.forEach((c, i) => buf._d[i].set(c)); }
      const p = new Promise((res, rej) => { Promise.resolve().then(() => { if (buf) { if (ok) ok(buf); res(buf); } else { if (bad) bad(new Error('EncodingError')); rej(new Error('EncodingError')); } }); });
      if (ok || bad) p.catch(() => {});
      return p;
    }
  };
}

// ---------- fake microphone (only with makeEnv({ mic: {...} })) ----------
// mic.answer: 'allow' (default), 'refuse', 'error' or 'never'; mic.answerAfterMs: how long the parent takes to answer
// the microphone question; mic.session: false for no navigator.audioSession; mic.types: what MediaRecorder supports.
function fakeMicrophone(o, setT, now) {
  const m = { asks: 0, constraints: [], tracks: [], recorders: [], sessionAtAsk: [], answer: 'allow', answerAfterMs: 300, types: ['audio/mp4'], ...o };
  m.session = o.session === false ? null : { type: 'auto' };
  m.live = () => m.tracks.filter((t) => t.readyState === 'live').length;
  m.recording = () => m.recorders.filter((r) => r.state !== 'inactive').length;
  const mediaDevices = {
    getUserMedia(c) {
      m.asks++;
      m.constraints.push(c);
      m.sessionAtAsk.push(m.session ? m.session.type : 'none');
      return new Promise((ok, bad) => {
        if (m.answer === 'never') return;
        setT(() => {
          if (m.answer === 'refuse') { const e = new Error('denied'); e.name = 'NotAllowedError'; bad(e); return; }
          if (m.answer === 'error') { const e = new Error('busy'); e.name = 'NotReadableError'; bad(e); return; }
          const tracks = [0, 1].map(() => ({ kind: 'audio', readyState: 'live', stop() { this.readyState = 'ended'; } }));
          m.tracks.push(...tracks);
          ok({ getTracks: () => tracks, getAudioTracks: () => tracks });
        }, m.answerAfterMs);
      });
    }
  };
  class MediaRecorder {
    static isTypeSupported(t) { return m.types.includes(t); }
    constructor(stream, opts) { this.stream = stream; this.mimeType = (opts && opts.mimeType) || 'audio/webm'; this.state = 'inactive'; m.recorders.push(this); }
    start() { if (m.failStart) throw new Error('cannot start'); this.state = 'recording'; this.startedAt = now(); }
    stop() {
      if (this.state === 'inactive') { const e = new Error('inactive'); e.name = 'InvalidStateError'; throw e; }
      this.state = 'inactive';
      this.ms = now() - this.startedAt;
      const bytes = new Uint8Array(Math.max(1, Math.round(this.ms))).fill(m.silent ? 1 : 7);
      setT(() => { if (this.ondataavailable) this.ondataavailable({ data: new Blob([bytes], { type: this.mimeType }) }); if (this.onstop) this.onstop(); }, 20);
    }
  }
  return { m, mediaDevices, MediaRecorder };
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
  let mic = null;
  context.navigator = {};
  if (opts.mic) {
    const f = fakeMicrophone(opts.mic, fakeSetTimeout, () => clock);
    mic = f.m;
    context.navigator.mediaDevices = f.mediaDevices;
    if (f.m.session) context.navigator.audioSession = f.m.session;
    context.MediaRecorder = f.MediaRecorder;
    context.Blob = Blob;
  }
  const webaudio = { contexts: 0, played: [], playing: 0, maxPlaying: 0, decodes: 0 };
  if (opts.webaudio) context.AudioContext = fakeWebAudio(opts, webaudio, fakeSetTimeout, fakeClearTimeout);
  if (opts.idb && opts.idb.mode !== 'missing') context.indexedDB = fakeIndexedDB(opts.idb);
  context.window = context;
  context.__BPP_TEST = true;
  context.addEventListener = () => {};
  vm.createContext(context);
  vm.runInContext('Math.random = __rand;', Object.assign(context, { __rand: opts.rand }));
  vm.runInContext(code, context);
  return { bpp: context.__bpp, advance, speech, audio, webaudio, mic, elements, context };
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
