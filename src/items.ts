/* Letters and numbers. "say" is a phonetic respelling so the computer voice reads the letter NAME ("bee")
   instead of a word or a sound. "pic" is the picture shown beside the big character. */
import { state, type Key, type Target } from './state';

export interface Item { say: string; word: string; pic: string }

export const LETTERS: Record<string, Item> = {
  A: { say: 'eigh',    word: 'apple',     pic: '🍎' },   // "ay" and "ey" were misread; "eigh" is a long A
  B: { say: 'bee',    word: 'ball',      pic: '⚽' },
  C: { say: 'see',    word: 'cat',       pic: '🐱' },
  D: { say: 'dee',    word: 'dog',       pic: '🐶' },
  E: { say: 'E',      word: 'elephant',  pic: '🐘' },   // "ee" was read as "E E"; a lone capital E is read as the letter name
  F: { say: 'eff',    word: 'fish',      pic: '🐠' },
  G: { say: 'gee',    word: 'goat',      pic: '🐐' },
  H: { say: 'aitch',  word: 'hat',       pic: '🎩' },
  I: { say: 'eye',    word: 'ice cream', pic: '🍦' },
  J: { say: 'jay',    word: 'juice',     pic: '🧃' },
  K: { say: 'kay',    word: 'kite',      pic: '🪁' },
  L: { say: 'ell',    word: 'lion',      pic: '🦁' },
  M: { say: 'em',     word: 'moon',      pic: '🌙' },
  N: { say: 'en',     word: 'nose',      pic: '👃' },
  O: { say: 'oh',     word: 'orange',    pic: '🍊' },
  P: { say: 'pee',    word: 'pig',       pic: '🐷' },
  Q: { say: 'cue',    word: 'queen',     pic: '👑' },
  R: { say: 'ar',     word: 'rabbit',    pic: '🐰' },
  S: { say: 'ess',    word: 'sun',       pic: '☀️' },
  T: { say: 'tee',    word: 'tree',      pic: '🌳' },
  U: { say: 'you',    word: 'umbrella',  pic: '☂️' },
  V: { say: 'vee',    word: 'van',       pic: '🚐' },
  W: { say: 'double you', word: 'whale', pic: '🐳' },
  X: { say: 'ex',     word: 'box',       pic: '📦' },
  Y: { say: 'why',    word: 'yo-yo',     pic: '🪀' },
  Z: { say: 'zee',    word: 'zebra',     pic: '🦓' }
};

export const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
export const NUMBERS: Record<string, Item> = {};
NUMBER_WORDS.forEach((name, n) => {
  NUMBERS[String(n)] = {
    say: name,
    word: n === 0 ? 'no stars' : name + (n === 1 ? ' star' : ' stars'),
    pic: n === 0 ? '⭕' : '⭐'.repeat(n)
  };
});

/* Characters a toddler can mix up. Never shown on screen together. */
export const LOOKALIKES: Key[][] = [['B', 'D'], ['P', 'Q'], ['M', 'W'], ['N', 'U'], ['6', '9'], ['O', '0'], ['I', 'L', '1']];

export function info(key: Key): Item {
  const it = LETTERS[key] ?? NUMBERS[key];
  if (!it) throw new Error('unknown item ' + key);
  return it;
}
export function isItem(key: Key): boolean { return Object.hasOwn(LETTERS, key) || Object.hasOwn(NUMBERS, key); }
export function isNumber(key: Key): boolean { return key >= '0' && key <= '9'; }

export function lookalike(a: Key, b: Key): boolean {
  if (a === b) return false;
  return LOOKALIKES.some((g) => g.includes(a) && g.includes(b));
}

/* The form a new bubble shows: a capital or a small letter, from the parent's setting. With Both, each bubble
   is picked at random. */
export function glyphFor(key: Key): string {
  if (isNumber(key)) return key;
  const c = state.settings.letterCase;
  const lower = c === 'lower' || (c === 'both' && Math.random() < 0.5);
  return lower ? key.toLowerCase() : key;
}

/* Everything the parent chose to practise, in a fixed order. Never empty. */
export function pool(): Key[] {
  const s = state.settings;
  let keys: Key[] = [];
  if (s.mode !== 'numbers') keys = keys.concat(String(s.letters).toUpperCase().split(''));
  if (s.mode !== 'letters') keys = keys.concat(String(s.numbers).split(''));
  const out: Key[] = [];
  for (const k of keys) if (isItem(k) && !out.includes(k)) out.push(k);
  return out.length ? out : ['A'];
}

/* The word under the picture, written in the same case as the letter on the bubble the child has to find:
   "A" gives APPLE, "a" gives apple. With Both, each target can differ. Numbers keep their words ("three stars").
   (Milestone 9, matching: the word follows the bubble, because that is the form the child has to find.) */
export function bannerWord(t: Target): string {
  const word = info(t.key).word;
  if (isNumber(t.key)) return word;
  return t.glyph === t.key ? word.toUpperCase() : word.toLowerCase();
}
