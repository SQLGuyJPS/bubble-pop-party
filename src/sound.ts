/* Sound effects (Web Audio, no files), the mute button and the volume. Recordings are decoded here too, so they
   play through the same audio context as the pops. */
import { clipByName, clipsFor } from './clips';
import { els } from './dom';
import { mixToMono, render } from './level';
import { AUDIO_OVERRIDES, own } from './recordings';
import { say, stopSpeech } from './speech';
import { state } from './state';
import { readClip, type ClipRecord } from './store';

export let audioCtx: AudioContext | null = null;
export let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
export const clipBuffers: Record<string, AudioBuffer> = {};   // decoded recordings, by clip name (filled in the background)
const loading = new Set<string>();

/* Loads and decodes every recording once, right after audio is unlocked. Until a clip is ready (or if
   it can't be decoded) playClip falls back to a normal <audio> element, then to the computer voice. */
function preloadClips(): void {
  const ctx = audioCtx;
  if (!ctx || typeof fetch !== 'function') return;
  for (const clip of Object.keys(AUDIO_OVERRIDES)) {
    const file = AUDIO_OVERRIDES[clip];
    if (!file || clipBuffers[clip] || loading.has(clip)) continue;
    loading.add(clip);
    try {
      fetch(file).then((res) => {
        if (!res.ok) throw new Error('missing');
        return res.arrayBuffer();
      }).then((data) => {
        ctx.decodeAudioData(data, (buf) => { clipBuffers[clip] = buf; }, () => { /* keep <audio> fallback */ });
      }).catch(() => { loading.delete(clip); });
    } catch { /* keep <audio> fallback */ }
  }
}

/* Decodes the take with the game's audio context. */
export function decodeAudio(data: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((ok, bad) => {
    if (!audioCtx) { bad(new Error('no audio')); return; }
    try { audioCtx.decodeAudioData(data, ok, bad); } catch (e) { bad(e); }
  });
}

/* A saved recording, decoded, trimmed and levelled, ready to play. Null if it can't be used here. */
export async function prepareRecording(r: ClipRecord): Promise<AudioBuffer | null> {
  if (!audioCtx) return null;
  try {
    const decoded = await decodeAudio(r.audio.slice(0));   // a copy: decoding can empty the one it is given
    const chans: Float32Array[] = [];
    for (let i = 0; i < decoded.numberOfChannels; i++) chans.push(decoded.getChannelData(i));
    const out = render(mixToMono(chans), decoded.sampleRate, r.trimStart, r.trimEnd, r.gain);
    if (!out) return null;
    const buf = audioCtx.createBuffer(1, out.length, decoded.sampleRate);
    buf.getChannelData(0).set(out);
    return buf;
  } catch { return null; }
}

/* Recordings made in the game: once sound is unlocked, the ones the current settings can play are read and decoded
   (the trim and the volume change are applied once, here). Others are let go, to save memory. A clip that isn't
   ready yet simply uses the next source for that one play. */
const ownLoading = new Set<string>();
const ownGeneration: Record<string, number> = {};
export function decodeOwnClips(): void {
  if (!audioUnlocked || !audioCtx) return;
  const wanted = new Set(clipsFor(state.settings).map((c) => c.name));
  for (const n of Object.keys(own.buffers)) if (!wanted.has(n)) delete own.buffers[n];
  for (const n of wanted) {
    if (!own.saved.has(n) || own.buffers[n] || own.problems[n] || ownLoading.has(n)) continue;
    ownLoading.add(n);
    const gen = ownGeneration[n] ?? 0;
    const current = (): boolean => (ownGeneration[n] ?? 0) === gen;
    void (async () => {
      const r = await readClip(n);
      if (!current()) return;
      if (r === null) { own.saved.delete(n); return; }
      if (r === 'damaged') { own.problems[n] = 'damaged'; return; }
      if (r.words !== clipByName(n)?.script) { own.problems[n] = 'words'; return; }
      const buf = await prepareRecording(r);
      if (!current()) return;
      if (buf) own.buffers[n] = buf; else own.problems[n] = 'damaged';
    })().finally(() => { ownLoading.delete(n); });
  }
}

/* A recording was saved, replaced or deleted on the Recordings screen: forget what was decoded before.
   buffer is the new take, already prepared, or null after a delete. */
export function ownChanged(name: string, buffer: AudioBuffer | null): void {
  ownGeneration[name] = (ownGeneration[name] ?? 0) + 1;
  ownLoading.delete(name);
  delete own.problems[name];
  if (buffer) { own.saved.add(name); own.buffers[name] = buffer; }
  else { own.saved.delete(name); delete own.buffers[name]; }
}

export function applyVolume(): void {
  if (master) master.gain.value = state.muted ? 0 : state.settings.volume;
}

export function setMuted(m: boolean): void {
  state.muted = !!m;
  applyVolume();
  if (state.muted) stopSpeech();
  els.mute.classList.toggle('off', state.muted);
  els.mute.setAttribute('aria-pressed', state.muted ? 'true' : 'false');
  els.mute.textContent = state.muted ? '🔇' : '🔊';
  if (!state.muted && state.running && !state.paused) say('prompt:' + state.target.key);   // tell the child what to find again
}

let audioUnlocked = false;
/* Creates the audio context and unlocks it. Must be called inside a tap (iPads require it), except
   ensureAudio(true) at page load, which only gets the recordings decoding. */
export function ensureAudio(early?: boolean): void {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();
      master = audioCtx.createGain();
      master.gain.value = state.muted ? 0 : state.settings.volume;
      master.connect(audioCtx.destination);
      const len = Math.floor(audioCtx.sampleRate * 0.06);
      noiseBuf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    preloadClips();
    if (early) return;
    if (!audioUnlocked) {
      // play one silent sound inside the tap: this is what unlocks audio on iPads
      const s = audioCtx.createBufferSource();
      s.buffer = audioCtx.createBuffer(1, 1, 22050);
      s.connect(audioCtx.destination);
      s.start(0);
      audioUnlocked = true;
      decodeOwnClips();
    }
    if (audioCtx.state !== 'running' && audioCtx.resume) void audioCtx.resume();
  } catch { /* sound effects are optional */ }
}

/* iPads can leave the audio context "suspended" or "interrupted" (after an <audio> clip, a call, a
   screen lock...). Every effect asks it to wake up again first. */
function wakeAudio(): void {
  try { if (audioCtx && audioCtx.state !== 'running' && audioCtx.resume) void audioCtx.resume(); } catch { /* ignore */ }
}

export function playPop(): void {
  if (!audioCtx || !master) return;
  wakeAudio();
  try {
    const ac = audioCtx;
    const t = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800 + Math.random() * 900;
    const ng = ac.createGain();
    ng.gain.value = 0.7;
    src.connect(bp); bp.connect(ng); ng.connect(master);
    src.start(t);
    const o = ac.createOscillator();
    const g = ac.createGain();
    const f = 520 + Math.random() * 260;
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.35, t + 0.13);
    g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.16);
  } catch { /* ignore */ }
}

export function playFanfare(): void {   // a short happy "ta-da" for every tenth star
  if (!audioCtx || !master) return;
  wakeAudio();
  try {
    const ac = audioCtx, out = master;
    const t = ac.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      const s = t + i * 0.11;
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.35, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, s + (i === 3 ? 0.7 : 0.22));
      o.connect(g); g.connect(out);
      o.start(s); o.stop(s + 0.75);
    });
  } catch { /* ignore */ }
}

export function playBoop(): void {   // soft, friendly "bloop" for a wrong pick: never a buzzer
  if (!audioCtx || !master) return;
  wakeAudio();
  try {
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(330, t);
    o.frequency.exponentialRampToValueAtTime(240, t + 0.18);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.24);
  } catch { /* ignore */ }
}
