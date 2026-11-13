/* The main loop, starting, pausing and resuming, play time, and what happens on a pop. */
import { setHint, updateStars } from './banner';
import {
  HINT_IDLE_SECONDS, HINT_WRONG_POPS, HIT_SCALE, MAX_BUBBLES, MAX_PARTICLES, PARTY_SECONDS, POP_DURATION,
  PROMPT_REPEAT_SECONDS, RISE_SPEED, SPAWN_DEPTH, STARS_PER_PARTY, WOBBLE_DURATION
} from './config';
import { els, restartAnimation } from './dom';
import { burst, draw, stepParticles } from './draw';
import { glyphFor } from './items';
import { ensureAudio, playBoop, playFanfare, playPop } from './sound';
import { say, stopSpeech } from './speech';
import { state, type Bubble } from './state';
import {
  chooseTarget, goneY, liveTargetBubble, pickDistractor, pos, recycleToBottom, refreshUpcoming, spawnBubble
} from './targets';

let raf = 0, lastT = 0;
let resumeTimer: ReturnType<typeof setTimeout> | 0 = 0;

/* =====================================================================
   Pops
   ===================================================================== */
function onCorrect(b: Bubble): void {
  const p = pos(b);
  b.state = 'popping';
  b.popT = 0;
  playPop();
  const popped = state.target.key;
  if (state.wrongsOnTarget === 0 && state.missed[popped]) state.missed[popped]--;   // found it first try: it needs less practice
  state.lastTarget = popped;
  state.stars++;
  const party = state.stars % STARS_PER_PARTY === 0;
  burst(p.x, Math.min(p.y, state.H - 20), party ? MAX_PARTICLES : 26);
  chooseTarget();
  if (party) {
    state.partyUntil = state.simTime + PARTY_SECONDS;
    playFanfare();
    restartAnimation(els.party, 'go');
    say('cheer:' + popped, () => {
      say('party', () => { say('prompt:' + state.target.key); });
    });
  } else {
    say('cheer:' + popped, () => { say('prompt:' + state.target.key); });
  }
  updateStars();
}

function onWrong(b: Bubble): void {
  const again = state.lastWrongBubble === b && state.simTime - state.lastWrongAt < 1.5;   // mashing the same bubble shouldn't restart the voice
  b.wobble = WOBBLE_DURATION;
  playBoop();
  state.wrongsOnTarget++;
  const t = state.target.key;
  state.missed[t] = (state.missed[t] ?? 0) + 1;
  if (!again) say('wrong:' + b.key + ':' + t);
  state.lastWrongAt = state.simTime;
  state.lastWrongBubble = b;
}

export function handlePointer(x: number, y: number): void {
  if (!state.running || state.paused) return;
  state.lastActivity = state.simTime;
  state.nextPromptAt = state.simTime + PROMPT_REPEAT_SECONDS;
  let best: Bubble | null = null, bd = Infinity;
  for (const b of state.bubbles) {
    const p = pos(b);
    const d = Math.hypot(x - p.x, y - p.y);
    if (d <= p.r * HIT_SCALE && d < bd) { best = b; bd = d; }
  }
  if (!best || best.state !== 'live') return;   // taps on a bubble that is already popping are ignored
  if (best.key === state.target.key) onCorrect(best); else onWrong(best);
}

/* =====================================================================
   Simulation step (separate from drawing so it can be tested)
   ===================================================================== */
export function step(dt: number): void {
  const s = state;
  if (!s.running || s.ended) return;
  s.simTime += dt;
  s.sessionElapsed += dt;
  if (s.settings.sessionMinutes > 0 && s.sessionElapsed >= s.settings.sessionMinutes * 60) { endSession(); return; }
  const { H, R } = s;
  for (let i = s.bubbles.length - 1; i >= 0; i--) {
    const b = s.bubbles[i]!;
    b.phase += dt;
    if (b.state === 'popping') {
      b.popT += dt;
      if (b.popT >= POP_DURATION) s.bubbles.splice(i, 1);
      continue;
    }
    if (b.wobble > 0) b.wobble = Math.max(0, b.wobble - dt);
    b.ny -= RISE_SPEED * s.settings.speed * b.speed * dt;
    const y = b.ny * H;
    if (b.key === s.target.key) {
      if (y < goneY()) recycleToBottom(b);   // the target floated off the top: bring it back up from the bottom
    } else if (y < -R * 1.05) {
      s.bubbles.splice(i, 1);
    }
  }
  s.spawnCooldown -= dt;
  refreshUpcoming();   // keep "the next bubble from the bottom" decided even while the screen is full
  if (!liveTargetBubble()) {
    if (s.bubbles.length < MAX_BUBBLES) spawnBubble(s.target.key, s.target.glyph, H + R * SPAWN_DEPTH);
  } else if (s.spawnCooldown <= 0 && s.bubbles.length < MAX_BUBBLES) {
    const k = s.upcoming;
    if (k) {
      spawnBubble(k, glyphFor(k), H + R * SPAWN_DEPTH);
      s.upcoming = null;
      refreshUpcoming();   // line up the one after it
      s.spawnCooldown = 0.8 + Math.random() * 1.2;
    } else {
      s.spawnCooldown = 0.5;
    }
  }
  stepParticles(dt);
  // gentle hint: the target glows after a couple of wrong pops or a long quiet moment (never a countdown)
  const wantHint = s.wrongsOnTarget >= HINT_WRONG_POPS || s.simTime - s.lastActivity >= HINT_IDLE_SECONDS;
  if (wantHint !== s.hintOn) setHint(wantHint);
  if (s.simTime >= s.nextPromptAt) {   // nobody is tapping: say what to find again
    s.nextPromptAt = s.simTime + PROMPT_REPEAT_SECONDS;
    say('prompt:' + s.target.key);
  }
  if (s.partyUntil > 0 && s.simTime >= s.partyUntil) { s.partyUntil = -1; updateStars(); }   // the full bar empties after the party
}

/* =====================================================================
   Main loop, start, pause / resume
   ===================================================================== */
function frame(ts: number): void {
  raf = requestAnimationFrame(frame);
  if (!lastT) lastT = ts;
  let dt = (ts - lastT) / 1000;
  lastT = ts;
  if (dt > 0.05) dt = 0.05;
  step(dt);
  draw();
}

/* A fresh set of bubbles and a new target (stars and the timer keep going) */
export function resetBubbles(): void {
  const s = state;
  s.bubbles.length = 0;
  s.particles.length = 0;
  s.lastTarget = '';
  s.upcoming = null;
  s.lastActivity = s.simTime;
  s.spawnCooldown = 0.5;
  chooseTarget();
  spawnBubble(s.target.key, s.target.glyph, s.H * 0.62);
  for (let i = 0; i < 2; i++) {
    const k = pickDistractor();
    if (k) spawnBubble(k, glyphFor(k), i === 0 ? s.H * 0.98 : s.H * 0.3);
  }
  s.upcoming = null;
  refreshUpcoming();   // chosen after the opening bubbles, so it can't duplicate one of them
}

export function startGame(): void {
  const s = state;
  s.running = true;
  s.paused = false;
  s.ended = false;
  s.sessionElapsed = 0;
  s.missed = {};
  s.stars = 0;
  s.starsShown = -1;
  s.partyUntil = -1;
  s.simTime = 0;
  els.stars.classList.add('show');
  updateStars();
  resetBubbles();
  lastT = 0;
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(frame);
}

export function pauseGame(): void {
  if (!state.running) return;
  state.paused = true;
  clearTimeout(resumeTimer);
  stopSpeech();
  cancelAnimationFrame(raf);
}

/* Play time is up: friendly goodbye. Only the parent gate can start a new session. */
function endSession(): void {
  state.ended = true;
  pauseGame();
  els.bye.classList.remove('hidden');
  say('bye');
}

export function startNewSession(): void {
  els.bye.classList.add('hidden');
  startGame();
  say('prompt:' + state.target.key);
}

export function resumeGame(): void {
  const s = state;
  if (!s.running || !s.paused || s.uiLock || s.ended) return;
  s.paused = false;
  lastT = 0;
  ensureAudio();
  s.nextPromptAt = s.simTime + PROMPT_REPEAT_SECONDS;
  raf = requestAnimationFrame(frame);
  clearTimeout(resumeTimer);
  resumeTimer = setTimeout(() => { if (!state.paused) say('prompt:' + state.target.key); }, 700);   // gentle re-prompt
}

export function onPlay(): void {
  if (state.started) return;
  state.started = true;
  ensureAudio();          // must happen inside the tap
  els.start.classList.add('hidden');
  startGame();
  say('prompt:' + state.target.key);   // first speech also happens inside the tap, which iPads require
}
