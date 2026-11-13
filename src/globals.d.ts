/* Filled in by tools/build.mjs. */

/** Recordings found in audio/ at build time: clip name -> file, e.g. { 'prompt:B': 'audio/prompt-B.m4a' }. */
declare const __RECORDINGS__: Record<string, string>;
/** true for `npm run dev`: the offline helper is not registered, so you never see a stale copy. */
declare const __DEV__: boolean;

interface Window {
  webkitAudioContext?: typeof AudioContext;
  __BPP_TEST?: boolean;
  __bpp?: unknown;
}
