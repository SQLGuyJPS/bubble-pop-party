/* Test hooks: only when the page is opened with ?debug, or loaded by the tests (window.__BPP_TEST).
   The tests use exactly this API, so keep it stable. */
import {
  MAX_BUBBLES, MAX_PARTICLES, MIN_CATCH_SECONDS, PROMPT_REPEAT_SECONDS, SPAWN_DEPTH, SVG_LIMIT_MOVING, SVG_LIMIT_TOTAL,
  type Settings
} from './config';
import { els } from './dom';
import { capHeight, forgetFontSize, layout } from './draw';
import { handlePointer, pauseGame, resumeGame, startGame, step } from './game';
import { lookalike, pool } from './items';
import {
  cancelHold, closeGate, closeSettings, doAction, gate, hearVoice, openGate, openSettings, pressKey, settingsOpen,
  startHold
} from './parent';
import { AUDIO_OVERRIDES } from './recordings';
import { sanitizeSettings } from './settings';
import { setMuted } from './sound';
import { sayLog } from './speech';
import { state } from './state';
import { goneY, isLive, liveTargetBubble, pos, secondsCatchable, sparklesWanted } from './targets';

export function debugWanted(): boolean {
  try {
    return !!window.__BPP_TEST || (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search));
  } catch { return false; }
}

/* Every rule the game must keep at all times. The tests call this after every simulated frame. */
function check(): string[] {
  const s = state;
  const errs: string[] = [];
  const live = s.bubbles.filter(isLive);
  const p = pool();
  if (s.bubbles.length > MAX_BUBBLES) errs.push('more than ' + MAX_BUBBLES + ' bubbles: ' + s.bubbles.length);
  if (s.particles.length > MAX_PARTICLES) errs.push('too many confetti pieces: ' + s.particles.length);
  for (let i = 0; i < live.length; i++) {
    const a = live[i]!;
    if (!p.includes(a.key)) errs.push('bubble ' + a.key + ' not in item pool');
    for (let j = i + 1; j < live.length; j++) {
      const b = live[j]!;
      if (a.key === b.key) errs.push('duplicate ' + a.key);
      if (lookalike(a.key, b.key)) errs.push('look-alikes together: ' + a.key + b.key);
    }
  }
  const t = s.target;
  if (!p.includes(t.key)) errs.push('target not in item pool');
  const tb = liveTargetBubble();
  if (!tb) {
    if (s.simTime - t.since > 2) errs.push('target bubble missing for ' + (s.simTime - t.since).toFixed(2) + 's');
  } else {
    const tp = pos(tb);
    if (tp.y < goneY() - 1 || tp.y > s.H + s.R * SPAWN_DEPTH + 1) errs.push('target bubble off screen, y=' + tp.y);
    if (tp.x < 0 || tp.x > s.W) errs.push('target bubble off screen sideways, x=' + tp.x);
    if (tb.glyph !== t.glyph) errs.push('target glyph mismatch');
  }
  if (els.glyph.textContent !== t.glyph) errs.push('banner shows ' + els.glyph.textContent + ' but target is ' + t.glyph);
  return errs;
}

export function installDebug(): void {
  window.__bpp = {
    start: () => { state.started = true; els.start.classList.add('hidden'); startGame(); },
    step,
    resize: (w: number, h: number) => { state.W = w; state.H = h; layout(); },
    tap: handlePointer,
    pos,
    pool,
    isLive,
    lookalike,
    secondsCatchable,
    goneY,
    minCatchSeconds: MIN_CATCH_SECONDS,
    limits: { maxBubbles: MAX_BUBBLES, maxParticles: MAX_PARTICLES, svgTotal: SVG_LIMIT_TOTAL, svgMoving: SVG_LIMIT_MOVING },
    sayLog,
    setSettings: (o: Partial<Settings>) => { Object.assign(state.settings, o); },
    state: () => {
      const s = state;
      return {
        bubbles: s.bubbles, target: s.target, upcoming: s.upcoming, simTime: s.simTime, W: s.W, H: s.H, R: s.R, FS: s.FS,
        particles: s.particles.length, stars: s.stars, hintOn: s.hintOn, wrongsOnTarget: s.wrongsOnTarget,
        missed: s.missed, muted: s.muted, starsShown: s.starsShown, sparkles: sparklesWanted(),
        paused: s.paused, running: s.running, ended: s.ended, uiLock: s.uiLock, sessionElapsed: s.sessionElapsed,
        gateOpen: gate.open, gateStep: gate.step, settingsOpen, settings: s.settings,
        bannerWord: els.word.textContent
      };
    },
    ui: {
      openGate, closeGate, startHold, cancelHold,
      key: pressKey, problem: () => ({ a: gate.a, b: gate.b, typed: gate.typed }),
      openSettings, closeSettings, action: doAction,
      hear: hearVoice, sanitize: sanitizeSettings
    },
    overrides: AUDIO_OVERRIDES,
    setMuted,
    quiet: () => { state.lastActivity = state.simTime; state.nextPromptAt = state.simTime + PROMPT_REPEAT_SECONDS; },
    pause: pauseGame,
    resume: resumeGame,
    capHeight: () => { forgetFontSize(); return capHeight(state.FS); },
    check
  };
}
