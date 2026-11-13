/* Load, check and save the parent's settings.
   localStorage can be blocked (private mode, school iPads...), so every use is wrapped: if it fails, the game
   simply runs on the defaults. */
import { DEFAULTS, SESSIONS, SPEEDS, STORE_KEY, VOLUMES, type Settings } from './config';
import { state } from './state';

function keepChars(str: string, re: RegExp): string {   // unique characters that match, in order
  let out = '';
  for (const c of String(str).split('')) if (re.test(c) && !out.includes(c)) out += c;
  return out;
}
function nearest(value: unknown, list: number[], fallback: number): number {
  const v = Number(value);
  if (!isFinite(v)) return fallback;
  let best = list[0] ?? fallback;
  for (const x of list) if (Math.abs(x - v) < Math.abs(best - v)) best = x;
  return best;
}

/* Anything damaged, missing or unexpected falls back to the default. */
export function sanitizeSettings(input: unknown): Settings {
  const s: Settings = { ...DEFAULTS };
  if (!input || typeof input !== 'object') return s;
  const o = input as Record<string, unknown>;
  if (o.mode === 'letters' || o.mode === 'numbers' || o.mode === 'both') s.mode = o.mode;
  if (typeof o.letters === 'string') { const L = keepChars(o.letters.toUpperCase(), /[A-Z]/); if (L) s.letters = L; }
  if (typeof o.numbers === 'string') { const N = keepChars(o.numbers, /[0-9]/); if (N) s.numbers = N; }
  if (o.letterCase === 'upper' || o.letterCase === 'lower' || o.letterCase === 'both') s.letterCase = o.letterCase;
  s.speed = nearest(o.speed, SPEEDS, DEFAULTS.speed);
  s.volume = nearest(o.volume, VOLUMES, DEFAULTS.volume);
  if (typeof o.voiceURI === 'string') s.voiceURI = o.voiceURI.slice(0, 300);
  if (o.sparkles === 'auto' || o.sparkles === 'on' || o.sparkles === 'off') s.sparkles = o.sparkles;
  s.sessionMinutes = nearest(o.sessionMinutes, SESSIONS, DEFAULTS.sessionMinutes);
  if (o.showGlyph === true || o.showGlyph === false) s.showGlyph = o.showGlyph;
  return s;
}

export function loadSettings(): void {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) state.settings = sanitizeSettings(JSON.parse(raw));
  } catch { state.settings = { ...DEFAULTS }; }
}

export function saveSettings(): void {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state.settings)); } catch { /* not saved: fine */ }
}
