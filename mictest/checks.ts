/* The microphone test page's measurements: recording a take in four ways, letting go of the microphone, and the
   storage and sharing checks. Throwaway: deleted at the end of Milestone 6, once its results are in
   docs/specs/m06-recordings.md. */
import { audioCtx } from '../src/sound';

export type Variant = 'A' | 'B' | 'C' | 'D';
export const VARIANTS: Record<Variant, { title: string; detail: string }> = {
  A: { title: 'Plain', detail: 'The microphone with the device\'s normal settings.' },
  B: { title: 'Voice processing off', detail: 'Echo cancelling, noise reduction and automatic volume turned off.' },
  C: { title: 'Audio session', detail: 'As B, and the page tells the device "playing and recording" while recording, then "playing only" after.' },
  D: { title: 'Level meter', detail: 'As B, with a live level meter (a second sound system listening to the microphone).' }
};

interface AudioSessionLike { type: string }
function audioSession(): AudioSessionLike | null {
  const n = navigator as unknown as { audioSession?: AudioSessionLike };
  return n.audioSession ?? null;
}
export function audioSessionType(): string {
  const s = audioSession();
  return s ? String(s.type) : 'not available';
}

export function isStandalone(): boolean {
  const n = navigator as unknown as { standalone?: boolean };
  let media = false;
  try { media = matchMedia('(display-mode: standalone)').matches; } catch { /* old browser */ }
  return n.standalone === true || media;
}

export const FORMATS = ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/aac', 'audio/webm;codecs=opus', 'audio/wav'];
export function supportedFormats(): string {
  if (typeof MediaRecorder === 'undefined') return 'MediaRecorder missing';
  const ok = FORMATS.filter((f) => { try { return MediaRecorder.isTypeSupported(f); } catch { return false; } });
  return ok.length ? ok.join(', ') : 'none of ' + FORMATS.length + ' tried';
}

export function canRecord(): boolean {
  return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';
}

const wait = (ms: number): Promise<void> => new Promise((ok) => { setTimeout(ok, ms); });

function describeError(e: unknown): string {
  if (e && typeof e === 'object' && 'name' in e) {
    const err = e as { name: string; message?: string };
    return err.name + (err.message ? ': ' + err.message : '');
  }
  return String(e);
}

function describeSettings(s: MediaTrackSettings | undefined): string {
  if (!s) return 'unknown';
  const parts: string[] = [];
  if (s.sampleRate) parts.push(s.sampleRate + ' Hz');
  if (s.channelCount) parts.push(s.channelCount + ' ch');
  const onOff = (v: boolean | string | undefined): string => (v === undefined ? '?' : typeof v === 'string' ? v : v ? 'on' : 'off');
  parts.push('echo ' + onOff(s.echoCancellation), 'noise ' + onOff(s.noiseSuppression), 'auto-volume ' + onOff(s.autoGainControl));
  return parts.join(', ');
}

export interface Take {
  blob: Blob | null;
  mimeType: string;
  trackSettings: string;
  rateBefore: number;          // the game sound system's sample rate before, during and just after recording
  rateDuring: number;
  rateAfterRelease: number;
  stateAfterRelease: string;
  sessionBefore: string;       // navigator.audioSession.type
  sessionDuring: string;
  sessionAfter: string;
  liveAfter: number;           // microphone tracks still live after letting go: must be 0
  meterPeak: number;           // D only: the loudest level the meter saw (0..1); 0 means the meter heard nothing
  error: string;
}

/* Records one take. The game's sound system (audioCtx) must already be running, as it is when a parent records
   in the game. Resolves after the microphone has been let go. `meterCtx` is created by the caller inside the tap
   (variant D), because an audio context made after an await can start silenced. */
export async function recordTake(variant: Variant, maxMs: number, hooks: {
  stopped: Promise<void>;
  meterCtx?: AudioContext | null;
  level?: (rms: number) => void;
}): Promise<Take> {
  const session = audioSession();
  const take: Take = {
    blob: null, mimeType: '', trackSettings: '', rateBefore: audioCtx ? audioCtx.sampleRate : 0, rateDuring: 0,
    rateAfterRelease: 0, stateAfterRelease: '', sessionBefore: audioSessionType(), sessionDuring: '', sessionAfter: '',
    liveAfter: 0, meterPeak: 0, error: ''
  };
  let stream: MediaStream | null = null;
  let rec: MediaRecorder | null = null;
  let meterSrc: MediaStreamAudioSourceNode | null = null;
  let raf = 0;
  let duringTimer: ReturnType<typeof setTimeout> | 0 = 0;
  const meterCtx = variant === 'D' ? hooks.meterCtx ?? null : null;
  try {
    if (variant === 'C' && session) session.type = 'play-and-record';
    const constraints: MediaStreamConstraints = variant === 'A'
      ? { audio: true }
      : { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } };
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    take.trackSettings = describeSettings(stream.getAudioTracks()[0]?.getSettings());
    if (meterCtx) {
      if (meterCtx.state !== 'running') void meterCtx.resume();
      meterSrc = meterCtx.createMediaStreamSource(stream);
      const an = meterCtx.createAnalyser();
      an.fftSize = 1024;
      meterSrc.connect(an);
      const buf = new Float32Array(an.fftSize);
      const loop = (): void => {
        an.getFloatTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += v * v;
        const rms = Math.sqrt(sum / buf.length);
        take.meterPeak = Math.max(take.meterPeak, rms);
        if (hooks.level) hooks.level(rms);
        raf = requestAnimationFrame(loop);
      };
      loop();
    }
    const chunks: Blob[] = [];
    const r = new MediaRecorder(stream);
    rec = r;
    r.ondataavailable = (e: BlobEvent) => { if (e.data && e.data.size) chunks.push(e.data); };
    const finished = new Promise<void>((ok) => { r.onstop = () => { ok(); }; });
    r.start();
    take.mimeType = r.mimeType;
    duringTimer = setTimeout(() => {
      take.rateDuring = audioCtx ? audioCtx.sampleRate : 0;
      take.sessionDuring = audioSessionType();
    }, 1500);
    await Promise.race([hooks.stopped, wait(maxMs)]);
    if (!take.rateDuring) { take.rateDuring = audioCtx ? audioCtx.sampleRate : 0; take.sessionDuring = audioSessionType(); }
    if (r.state !== 'inactive') r.stop();
    await Promise.race([finished, wait(3000)]);
    take.mimeType = r.mimeType || take.mimeType;
    take.blob = new Blob(chunks, { type: take.mimeType || 'audio/mp4' });
  } catch (e) {
    take.error = describeError(e);
  } finally {
    // Let go of everything, whatever happened above: this is what the game must also do after every take.
    clearTimeout(duringTimer);
    if (raf) cancelAnimationFrame(raf);
    try { if (rec && rec.state !== 'inactive') rec.stop(); } catch { /* already stopped */ }
    const tracks = stream ? stream.getTracks() : [];
    for (const t of tracks) { try { t.stop(); } catch { /* ignore */ } }
    try { if (meterSrc) meterSrc.disconnect(); } catch { /* ignore */ }
    try { if (meterCtx) await meterCtx.close(); } catch { /* ignore */ }
    if (variant === 'C' && session) { try { session.type = 'playback'; } catch { /* ignore */ } }
    take.liveAfter = tracks.filter((t) => t.readyState === 'live').length;
  }
  await wait(500);
  take.rateAfterRelease = audioCtx ? audioCtx.sampleRate : 0;
  take.stateAfterRelease = audioCtx ? audioCtx.state : 'none';
  take.sessionAfter = audioSessionType();
  return take;
}

/* Opens the microphone and lets go straight away: for the "does it ask again" step. */
export async function touchMic(): Promise<string> {
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const t of s.getTracks()) t.stop();
    return 'allowed';
  } catch (e) { return describeError(e); }
}

export async function micPermission(): Promise<string> {
  try {
    const p = navigator.permissions;
    if (!p || !p.query) return 'not reported';
    const r = await p.query({ name: 'microphone' as PermissionName });
    return r.state;
  } catch { return 'not reported'; }
}

/* A short two-note chime as a WAV file made in memory, so the page can check that a decoded clip plays through the
   game's sound system (the way recordings will) without downloading anything. */
export function chimeWav(): ArrayBuffer {
  const rate = 22050, seconds = 0.6, n = Math.floor(rate * seconds);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const text = (o: number, s: string): void => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  text(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); text(8, 'WAVE');
  text(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  text(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const f = t < seconds / 2 ? 784 : 1047;
    const local = t < seconds / 2 ? t : t - seconds / 2;
    const env = Math.min(1, local * 60) * Math.exp(-local * 7);
    v.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * f * t) * env * 0.5 * 32767), true);
  }
  return buf;
}

/* ---- Storage ---- */

const withTimeout = <T>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([p, wait(ms).then(() => fallback)]);

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((ok, no) => { r.onsuccess = () => { ok(r.result); }; r.onerror = () => { no(r.error); }; });
}

/* Saves a 50 KB ArrayBuffer (about the size of one recording) in IndexedDB, reads it back and compares. */
export async function checkIndexedDB(): Promise<string> {
  if (typeof indexedDB === 'undefined') return 'missing';
  const run = async (): Promise<string> => {
    const open = indexedDB.open('bpp-mictest', 1);
    open.onupgradeneeded = () => { open.result.createObjectStore('x'); };
    const db = await req(open);
    const data = new Uint8Array(50000);
    for (let i = 0; i < data.length; i++) data[i] = (i * 7 + 3) & 255;
    await req(db.transaction('x', 'readwrite').objectStore('x').put(data.buffer, 'k'));
    const back: unknown = await req(db.transaction('x', 'readonly').objectStore('x').get('k'));
    db.close();
    try { indexedDB.deleteDatabase('bpp-mictest'); } catch { /* ignore */ }
    if (!(back instanceof ArrayBuffer)) return 'came back as ' + Object.prototype.toString.call(back);
    const b = new Uint8Array(back);
    return b.length === data.length && b.every((x, i) => x === data[i]) ? 'ok' : 'came back different';
  };
  try { return await withTimeout(run(), 5000, 'no answer in 5 s'); } catch (e) { return describeError(e); }
}

export async function checkPersist(): Promise<{ persist: string; persisted: string; free: string }> {
  const s = navigator.storage;
  const out = { persist: 'not available', persisted: 'not available', free: 'not available' };
  if (!s) return out;
  try {
    if (s.persist) {
      const r = await withTimeout<boolean | null>(s.persist(), 5000, null);
      out.persist = r === null ? 'no answer' : String(r);
    }
  } catch (e) { out.persist = describeError(e); }
  try { if (s.persisted) out.persisted = String(await s.persisted()); } catch (e) { out.persisted = describeError(e); }
  try {
    if (s.estimate) {
      const e = await s.estimate();
      if (e.quota !== undefined) out.free = ((e.quota - (e.usage ?? 0)) / 1e9).toFixed(1) + ' GB';
    }
  } catch (e) { out.free = describeError(e); }
  return out;
}
