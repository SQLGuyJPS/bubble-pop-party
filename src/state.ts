/* The shared, changing game state. ES modules can't reassign each other's variables, so everything that
   changes while the game runs lives in this one object. Constants stay in config.ts. */
import { DEFAULTS, type Settings } from './config';

export type Key = string;   // 'A'..'Z' or '0'..'9'

export interface Bubble {
  key: Key;
  glyph: string;            // what is drawn: 'A', 'a' or '3'
  nx: number;               // position in screen-relative units (0..1), so a rotation loses nothing
  ny: number;
  hue: number;
  speed: number;            // the bubble's own speed (x the setting)
  phase: number;
  sway: number;
  state: 'live' | 'popping';
  popT: number;
  wobble: number;
  silent?: boolean;
}

export interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  rot: number; vr: number;
  size: number;
  hue: number;
  shape: number;            // 0 square, 1 circle, 2 star-ish diamond
  life: number;
  maxLife: number;
}

export interface Target {
  key: Key;
  glyph: string;            // the form the child has to find, the same as the bubble's
  since: number;
}

export const state = {
  settings: { ...DEFAULTS } as Settings,

  // screen and bubble size (px)
  W: 1024, H: 768, dpr: 1,
  D: 300, R: 150, FS: 240,  // bubble diameter, radius, font size

  bubbles: [] as Bubble[],
  particles: [] as Particle[],          // confetti
  /* Placeholder until the first game starts; nothing reads it before then. */
  target: { key: 'A', glyph: 'A', since: 0 } as Target,
  upcoming: null as Key | null,         // key of the bubble that will rise from the bottom next
  lastTarget: '',
  simTime: 0,
  spawnCooldown: 0,
  lastWrongAt: -99,
  lastWrongBubble: null as Bubble | null,
  missed: {} as Record<Key, number>,    // key -> how often it was missed this session (not saved)
  stars: 0,                             // correct pops this session (not saved)
  starsShown: -1,
  partyUntil: -1,
  wrongsOnTarget: 0,
  lastActivity: 0,                      // last time anyone tapped the game
  nextPromptAt: 0,
  hintOn: false,
  started: false,
  running: false,
  paused: false,
  uiLock: false,                        // the parent gate or settings is open: the game stays paused
  ended: false,                         // the play-time limit was reached: goodbye screen is showing
  sessionElapsed: 0,                    // seconds of actual play this session
  muted: false                          // the corner speaker button; silences effects, recordings and the voice
};
