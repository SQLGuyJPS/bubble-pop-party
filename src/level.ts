/* Trimming and levelling recordings: pure functions on sample arrays (no page or audio code), so the tests can feed
   them made-up signals. The original take is never changed: only the trim points and the volume change are
   stored, and render() applies them when the clip is decoded for play. */

export const FADE_SECONDS = 0.01;      // short fades at both ends, so there's no click

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
