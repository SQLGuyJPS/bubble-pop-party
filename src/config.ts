/* Tunable constants, the default settings and the speed limits. */

export const MAX_BUBBLES = 4;            // live + popping bubbles, never more than this
export const HIT_SCALE = 1.15;           // tap area is 15% bigger than the drawn bubble
export const POP_DURATION = 0.22;        // seconds
export const WOBBLE_DURATION = 0.7;      // seconds
export const RISE_SPEED = 0.075;         // screen heights per second (x speed setting)
export const BUBBLE_WIDTH_RATIO = 0.32;  // bubble diameter / screen width
export const BUBBLE_HEIGHT_CAP = 0.55;   // ...but never taller than this share of screen height
export const GLYPH_RATIO = 0.28 / 0.32;  // font size / bubble diameter (cap height ~ 20% of width)
export const SPAWN_DEPTH = 0.3;          // new bubbles start with their centre this many radii below the bottom edge,
                                         // so any of them can become the target and still be mostly visible
/* Which bubble is asked for next. After a pop, the new target is picked from bubbles that are already fully
   on screen and will stay catchable for at least MIN_CATCH_SECONDS more, so the child is never sent to a bubble
   that has only just arrived at the bottom or one that is about to float away. How high up that zone reaches
   depends on bubble size and speed (see secondsCatchable). Higher bubbles in the zone are somewhat more likely
   to be picked (HIGH_BIAS). Only when nothing qualifies does the next bubble rising from the bottom get used. */
export const MIN_CATCH_SECONDS = 4;      // about 2 s for the new prompt to be spoken, plus 2 s to spot and tap it
export const MIN_VISIBLE_FRACTION = 0.25;// a bubble is "gone" once less than this share of its height is still on screen
export const HIGH_BIAS = 3;              // the highest bubble in the zone is (1 + this) times as likely as the lowest
export const MAX_PARTICLES = 60;         // confetti cap so older tablets keep up
export const HINT_WRONG_POPS = 2;        // wrong pops before the target gently glows
export const HINT_IDLE_SECONDS = 15;     // ...or this long with no taps
export const PROMPT_REPEAT_SECONDS = 8;  // repeat the spoken prompt this often while nobody taps
export const STARS_PER_PARTY = 10;       // every this many correct pops is a bigger celebration
export const PARTY_SECONDS = 2;
export const TAU = Math.PI * 2;
export const HUES = [330, 48, 190, 130, 265, 18];

/* The computer voice says a cheer in two pieces with a short pause between: "Great!" ... "eigh is for apple."
   (A recording of a cheer is one file, so the pause is whatever you leave when you record it.) */
export const CHEER_PAUSE_MS = 500;

/* Parent gate */
export const GATE_HOLD_MS = 3000;
export const GATE_IDLE_MS = 25000;       // a toddler wandering into the gate: close it and carry on playing

/* Speed limits for the iPad 7th generation (see docs/ROADMAP.md, "Speed limits"). The tests fail if the game
   goes over them. The canvas has no moving-object limit yet: the speed test page (perf/) measures it first. */
export const SVG_LIMIT_TOTAL = 4800;
export const SVG_LIMIT_MOVING = 650;

/* =====================================================================
   Settings
   ===================================================================== */
export type Mode = 'letters' | 'numbers' | 'both';
export type LetterCase = 'upper' | 'lower' | 'both';
export type Sparkles = 'auto' | 'on' | 'off';

export interface Settings {
  mode: Mode;
  letters: string;
  numbers: string;
  letterCase: LetterCase;
  speed: number;
  volume: number;
  voiceURI: string;
  sparkles: Sparkles;
  sessionMinutes: number;
  showGlyph: boolean;
}

export const DEFAULTS: Readonly<Settings> = {
  mode: 'letters',
  letters: 'ABCDE',
  numbers: '12345',
  letterCase: 'upper',
  speed: 1,
  volume: 1,
  voiceURI: '',
  sparkles: 'auto',       // extra sparkles on the hinted bubble: 'auto' (only for letters she misses), 'on', 'off'
                          // (the glow and pulse are always on)
  sessionMinutes: 0,
  showGlyph: true         // show the big letter/number in the top banner (off = she must listen and match the name)
};

/* Settings are remembered on this device under this name. */
export const STORE_KEY = 'bubblePopParty.settings.v1';
export const SPEEDS = [0.6, 1, 1.5];
export const VOLUMES = [0.2, 0.4, 0.6, 0.8, 1];
export const SESSIONS = [0, 5, 10, 15];
