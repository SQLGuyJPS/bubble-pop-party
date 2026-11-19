/* Trimming and levelling recordings: pure functions on sample arrays (no page or audio code), so the tests can feed
   them made-up signals. The original take is never changed: only the trim points and the volume change are
   stored, and render() applies them when the clip is decoded for play. */

export const FADE_SECONDS = 0.01;      // short fades at both ends, so there's no click
export const WINDOW_SECONDS = 0.02;    // loudness is measured in 20 ms windows
export const NOISE_SHARE = 0.1;        // background noise: the quietest 10% of windows
export const ABOVE_NOISE_DB = 10;      // speech is at least this much louder than the noise...
export const SPEECH_FLOOR_DBFS = -50;  // ...and louder than this
export const RUN_WINDOWS = 3;          // windows in a row, so a short click (the tap on Record) isn't speech
export const KEEP_BEFORE = 0.08;       // seconds kept before the speech
export const KEEP_AFTER = 0.15;        // ...and after it
/* Every clip's speech is set to the same loudness. A starting point: tuned by ear on the iPad against the pops and
   the computer voice. */
export const TARGET_DBFS = -18;
export const PEAK_CAP_DBFS = -1;       // loud takes are turned down rather than distorted
export const GAIN_CAP = 10;            // +20 dB at most, so a very quiet take doesn't turn into hiss
export const GAIN_FLOOR = 0.1;

export interface Analysis {
  heard: boolean;          // false: "I didn't hear anything", nothing is saved
  trimStart: number;       // seconds: the part kept, with KEEP_BEFORE and KEEP_AFTER around the speech
  trimEnd: number;
  gain: number;
  quiet: boolean;          // needed more than GAIN_CAP: saved, with "That was very quiet"
  speechDb: number;        // for the notes and the checks
  noiseDb: number;
  peakDb: number;
}

const db = (x: number): number => (x > 0 ? 20 * Math.log10(x) : -Infinity);
const fromDb = (d: number): number => Math.pow(10, d / 20);

function rms(x: Float32Array, a: number, b: number): number {
  let sum = 0;
  for (let i = a; i < b; i++) sum += x[i]! * x[i]!;
  return b > a ? Math.sqrt(sum / (b - a)) : 0;
}

/* Finds the speech in a take (one channel) and works out the trim points and the volume change. */
export function analyse(mono: Float32Array, rate: number): Analysis {
  const w = Math.max(1, Math.round(WINDOW_SECONDS * rate));
  const n = Math.floor(mono.length / w);
  const none: Analysis = { heard: false, trimStart: 0, trimEnd: 0, gain: 1, quiet: false, speechDb: -Infinity, noiseDb: -Infinity, peakDb: -Infinity };
  if (n < RUN_WINDOWS) return none;
  const level: number[] = [];
  for (let i = 0; i < n; i++) level.push(rms(mono, i * w, (i + 1) * w));
  const sorted = level.slice().sort((a, b) => a - b);
  const noise = sorted[Math.floor(n * NOISE_SHARE)] ?? 0;
  const line = Math.max(noise * fromDb(ABOVE_NOISE_DB), fromDb(SPEECH_FLOOR_DBFS));
  const loud = level.map((v) => v > line);
  const runAt = (i: number): boolean => { for (let k = 0; k < RUN_WINDOWS; k++) if (!loud[i + k]) return false; return true; };
  let first = -1, last = -1;
  for (let i = 0; i + RUN_WINDOWS <= n; i++) if (runAt(i)) { if (first < 0) first = i; last = i + RUN_WINDOWS - 1; }
  if (first < 0) return { ...none, noiseDb: db(noise) };
  const speechA = first * w, speechB = (last + 1) * w;
  const duration = mono.length / rate;
  const trimStart = Math.max(0, speechA / rate - KEEP_BEFORE);
  const trimEnd = Math.min(duration, speechB / rate + KEEP_AFTER);
  const speech = rms(mono, speechA, speechB);
  let peak = 0;
  for (let i = Math.floor(trimStart * rate); i < Math.min(mono.length, Math.ceil(trimEnd * rate)); i++) peak = Math.max(peak, Math.abs(mono[i]!));
  const wanted = fromDb(TARGET_DBFS) / speech;
  const peakRoom = peak > 0 ? fromDb(PEAK_CAP_DBFS) / peak : GAIN_CAP;
  const gain = Math.max(GAIN_FLOOR, Math.min(wanted, peakRoom, GAIN_CAP));
  return { heard: true, trimStart, trimEnd, gain, quiet: wanted > GAIN_CAP, speechDb: db(speech), noiseDb: db(noise), peakDb: db(peak) };
}

/* Takes are recorded in stereo on the iPhone: one channel is the average of all of them. */
export function mixToMono(channels: Float32Array[]): Float32Array {
  const first = channels[0];
  if (!first) return new Float32Array(0);
  if (channels.length === 1) return first;
  const out = new Float32Array(first.length);
  for (const ch of channels) for (let i = 0; i < out.length; i++) out[i]! += (ch[i] ?? 0) / channels.length;
  return out;
}

/* The part between trimStart and trimEnd (seconds), times gain, with fades. Null if the trim points don't fit the
   take (a damaged record, or a file from another device that decodes differently). */
export function render(mono: Float32Array, rate: number, trimStart: number, trimEnd: number, gain: number): Float32Array | null {
  if (!(rate > 0) || trimEnd * rate > mono.length + rate * 0.05) return null;
  const a = Math.max(0, Math.round(trimStart * rate));
  const b = Math.min(mono.length, Math.round(trimEnd * rate));
  if (b - a < rate * 0.05) return null;
  const out = mono.slice(a, b);
  const fade = Math.min(Math.round(FADE_SECONDS * rate), Math.floor(out.length / 2));
  for (let i = 0; i < out.length; i++) {
    let g = gain;
    if (i < fade) g *= i / fade;
    else if (i >= out.length - fade) g *= (out.length - 1 - i) / fade;
    const v = out[i]! * g;
    out[i] = v > 1 ? 1 : v < -1 ? -1 : v;
  }
  return out;
}
