/* Spawning bubbles, choosing which one to ask for, and how long a bubble stays catchable. */
import {
  HIGH_BIAS, HUES, MIN_CATCH_SECONDS, MIN_VISIBLE_FRACTION, PROMPT_REPEAT_SECONDS, RISE_SPEED, SPAWN_DEPTH, TAU
} from './config';
import { updateBanner, setHint } from './banner';
import { glyphFor, lookalike, pool } from './items';
import { state, type Bubble, type Key } from './state';

export function isLive(b: Bubble): boolean { return b.state === 'live'; }

export function pos(b: Bubble): { x: number; y: number; r: number } {
  const { W, H, R } = state;
  let x = b.nx * W + Math.sin(b.phase * 0.9) * R * b.sway;
  x = Math.max(R * 0.5, Math.min(W - R * 0.5, x));
  return { x, y: b.ny * H, r: R };
}

export function liveTargetBubble(): Bubble | null {
  for (const b of state.bubbles) if (isLive(b) && b.key === state.target.key) return b;
  return null;
}

/* Pick an x that keeps this bubble away from the others */
function bestX(y: number): number {
  const { W, R } = state;
  const lo = R * 1.05, hi = W - R * 1.05;
  if (hi <= lo) return W / 2;
  let bestXv = lo, bestD = -1;
  for (let n = 0; n < 24; n++) {
    const x = lo + Math.random() * (hi - lo);
    let md = 1e9;
    for (const b of state.bubbles) {
      const p = pos(b);
      md = Math.min(md, Math.hypot(p.x - x, p.y - y));
    }
    if (md > bestD) { bestD = md; bestXv = x; }
  }
  return bestXv;
}

export function recycleToBottom(b: Bubble): void {
  const y = state.H + state.R * SPAWN_DEPTH;
  b.nx = bestX(y) / state.W;
  b.ny = y / state.H;
}

function pickHue(): number {
  const used = new Set(state.bubbles.map((b) => b.hue));
  const free = HUES.filter((h) => !used.has(h));
  const list = free.length ? free : HUES;
  return list[Math.floor(Math.random() * list.length)] ?? HUES[0]!;
}

export function spawnBubble(key: Key, glyph: string, y: number): void {
  const x = bestX(y);
  state.bubbles.push({
    key, glyph,
    nx: x / state.W, ny: y / state.H,
    hue: pickHue(),
    speed: 0.85 + Math.random() * 0.3,
    phase: Math.random() * TAU,
    sway: 0.08 + Math.random() * 0.1,
    state: 'live', popT: 0, wobble: 0
  });
}

/* Is k free to appear on screen: not already there, and not a look-alike of anything that is? */
export function freeToAppear(k: Key): boolean {
  return !state.bubbles.some((b) => b.key === k || lookalike(b.key, k));
}

/* Items that were missed this session come up more often, so the next bubble to rise is picked with the
   same weights as a target (fresh items are preferred over the one that was just popped). */
export function pickDistractor(): Key | null {
  const t = state.target.key;
  let cands = pool().filter((k) => k !== t && !lookalike(k, t) && freeToAppear(k));
  const fresh = cands.filter((k) => k !== state.lastTarget);   // don't bring back the one just popped
  if (fresh.length) cands = fresh;
  return cands.length ? weightedPick(cands) : null;
}

/* The bubble that will rise from the bottom next. It is decided ahead of time so that it can also be
   chosen as the target while it is still below the screen. */
export function refreshUpcoming(): void {
  const u = state.upcoming, t = state.target.key;
  if (!u || !pool().includes(u) || u === t || !freeToAppear(u) || lookalike(u, t)) {
    state.upcoming = pickDistractor();
  }
}

/* How many seconds this bubble can still be tapped before it floats off the top.
   A bubble counts as "gone" once only MIN_VISIBLE_FRACTION of its height is still on screen, which is when
   its centre reaches y = R * (2 * MIN_VISIBLE_FRACTION - 1) (a little above the top edge). The distance from
   the bubble to that line is divided by its own rise speed (screen heights per second x the speed setting x
   the bubble's personal speed), so the answer depends on:
     - bubble size (R): a bigger bubble takes longer to float away, so it can be chosen nearer the top
     - speed setting and the bubble's own speed: faster bubbles leave sooner
     - screen height (H): the distance is measured in pixels, the speed in screen heights */
export function goneY(): number { return state.R * (2 * MIN_VISIBLE_FRACTION - 1); }
export function secondsCatchable(b: Bubble): number {
  const pxPerSecond = RISE_SPEED * state.settings.speed * b.speed * state.H;
  return (b.ny * state.H - goneY()) / pxPerSecond;
}
/* Bubbles are used up quickly, so most of the ones on screen have only just arrived. To keep the next letter
   from nearly always being at the bottom, the higher a bubble is within the allowed zone, the more likely
   it is to be picked: the highest allowed bubble is (1 + HIGH_BIAS) times as likely as the lowest. */
function heightBias(b: Bubble): number {
  const { H, R } = state;
  const top = goneY() + MIN_CATCH_SECONDS * RISE_SPEED * state.settings.speed * b.speed * H;   // highest allowed centre
  const bottom = H - R;                                                                         // lowest allowed centre
  const t = bottom > top ? (bottom - b.ny * H) / (bottom - top) : 0;                            // 0 lowest .. 1 highest
  return 1 + HIGH_BIAS * Math.max(0, Math.min(1, t));
}
function fullyOnScreen(b: Bubble): boolean { return b.ny * state.H <= state.H - state.R; }
function inBounds(b: Bubble): boolean { return isLive(b) && secondsCatchable(b) >= MIN_CATCH_SECONDS; }

/* Picks the next target. */
export function chooseTarget(): void {
  const live = state.bubbles.filter(isLive);
  const p = pool();
  const last = state.lastTarget, upcoming = state.upcoming;
  let existing: Bubble | null = null;
  // Candidates: bubbles that are already fully on screen and still high enough to catch (never the item
  // that was just popped). A bubble that has only just started to rise in, or one still waiting below the
  // screen, is not used unless nothing else qualifies: the child should be sent to a bubble she has had a
  // moment to see, not to whatever just arrived.
  let cands: Key[] = [];
  const weightOf: Record<Key, number> = {};
  for (const b of live) {
    const lk = b.key;
    if (lk !== last && !cands.includes(lk) && p.includes(lk) && inBounds(b) && fullyOnScreen(b)) {
      cands.push(lk);
      weightOf[lk] = targetWeight(lk) * heightBias(b);
    }
  }
  // Last resort: the next bubble due to rise from the bottom.
  if (!cands.length && upcoming && upcoming !== last && p.includes(upcoming) && freeToAppear(upcoming)) cands.push(upcoming);
  let conflict = false;
  let k: Key;
  if (cands.length) {
    k = weightedPick(cands, weightOf);
  } else {
    // nothing suitable (only possible with a tiny item list): pick from the whole pool like a fresh game,
    // with nothing that looks like a bubble already on screen
    const keys = live.map((b) => b.key);
    cands = p.filter((q) => {
      if (q === last) return false;
      if (keys.includes(q)) return true;
      return !keys.some((onScreen) => lookalike(onScreen, q));
    });
    if (!cands.length) {
      cands = p.filter((q) => q !== last);
      conflict = true;
    }
    if (!cands.length) cands = p.slice();
    k = weightedPick(cands);
  }
  for (const b of live) if (b.key === k) existing = b;
  state.target = { key: k, glyph: existing ? existing.glyph : glyphFor(k), since: state.simTime };
  if (existing && !inBounds(existing)) recycleToBottom(existing);   // (fallback only) too high to catch: bring it up again
  if (k === state.upcoming) state.upcoming = null;   // it is the target now; step() lets it rise from the bottom
  refreshUpcoming();
  if (conflict) {   // rare with tiny item lists: pop away any look-alike bubble
    for (const b of live) {
      if (b.key !== k && lookalike(b.key, k)) { b.state = 'popping'; b.popT = 0; b.silent = true; }
    }
  }
  state.wrongsOnTarget = 0;
  setHint(false);
  state.nextPromptAt = state.simTime + PROMPT_REPEAT_SECONDS;
  updateBanner();
}

/* Sparkles help with letters she doesn't know well yet. In 'auto' they only appear for an item she has
   missed, and they stop once she finds it on the first try (missed[] counts down). */
export function sparklesWanted(): boolean {
  const s = state.settings.sparkles;
  if (s === 'on') return true;
  if (s === 'auto') return (state.missed[state.target.key] ?? 0) > 0;
  return false;
}

/* Items that were missed this session come up more often */
function targetWeight(k: Key): number { return 1 + 2 * Math.min(state.missed[k] ?? 0, 3); }

export function weightedPick(list: Key[], weights?: Record<Key, number>): Key {
  const w = (k: Key): number => (weights && weights[k] ? weights[k] : targetWeight(k));
  let total = 0;
  for (const k of list) total += w(k);
  let roll = Math.random() * total;
  for (const k of list) {
    roll -= w(k);
    if (roll < 0) return k;
  }
  return list[list.length - 1]!;
}
