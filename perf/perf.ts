/* The speed test page. Adds moving things in steps until the motion stops being smooth, and shows the breaking
   point for each kind of thing. It draws with the game's own code (src/draw.ts), at this screen's real size and
   pixel density. Published at .../perf/, not linked from the game and not saved for offline use. */
import { HUES, TAU } from '../src/config';
import { drawBubble, drawParticles, context, initCanvas, layout, resize } from '../src/draw';
import { state, type Bubble, type Particle } from '../src/state';

/* "Smooth": no more than 1 frame in 20 is late. A frame is late when it takes more than 1.5 times the screen's
   normal frame time (measured first, with nothing drawn). */
const LATE_FACTOR = 1.5;
const MAX_LATE_SHARE = 1 / 20;
const WARMUP_MS = 500;
const MEASURE_FRAMES = 120;
const GROW = 1.3;            // each step adds 30% more things
const REFINE_STEPS = 3;      // then narrows the gap between the last smooth and the first jerky count
const MAX_COUNT = 20000;
/* In the game, a full screen is 4 bubbles and up to 60 confetti pieces: 1 bubble to 15 pieces. */
const MIX_PIECES_PER_BUBBLE = 15;
const STILL_LAYER_COUNT = 400;

type CaseId = 'plain' | 'glow' | 'confetti' | 'mix' | 'cached';
const CASES: { id: CaseId; label: string }[] = [
  { id: 'plain', label: 'Plain bubbles' },
  { id: 'glow', label: 'Bubbles with hint glow and sparkles' },
  { id: 'confetti', label: 'Confetti pieces' },
  { id: 'mix', label: 'Mix (1 bubble : 15 confetti)' },
  { id: 'cached', label: `Moving bubbles over ${STILL_LAYER_COUNT} still ones (cached)` }
];

const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;
const canvas = $('c') as HTMLCanvasElement;
initCanvas(canvas);
let sizeScale = 1;
let still: HTMLCanvasElement | null = null;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function rand(a: number, b: number): number { return a + Math.random() * (b - a); }

function makeBubble(i: number, glow: boolean): Bubble {
  return {
    key: glow ? 'A' : LETTERS[i % 26]!, glyph: glow ? 'A' : LETTERS[i % 26]!,
    nx: Math.random(), ny: Math.random() * 1.2, hue: HUES[i % HUES.length]!,
    speed: rand(0.85, 1.15), phase: Math.random() * TAU, sway: rand(0.08, 0.18),
    state: 'live', popT: 0, wobble: 0
  };
}
function makePiece(i: number): Particle {
  const { W, H, R } = state;
  return {
    x: Math.random() * W, y: Math.random() * H, vx: rand(-0.3, 0.3) * W, vy: rand(-0.3, 0.3) * H,
    rot: Math.random() * TAU, vr: rand(-7, 7), size: Math.max(8, R * rand(0.08, 0.16)),
    hue: HUES[i % HUES.length]! + Math.floor(Math.random() * 20), shape: i % 3, life: 0, maxLife: 1e9
  };
}

/* Sets up `count` things for one case. */
function populate(id: CaseId, count: number): void {
  state.bubbles.length = 0;
  state.particles.length = 0;
  state.hintOn = id === 'glow';
  let bubbles = 0, pieces = 0;
  if (id === 'plain' || id === 'glow' || id === 'cached') bubbles = count;
  if (id === 'confetti') pieces = count;
  if (id === 'mix') { bubbles = Math.max(1, Math.round(count / (1 + MIX_PIECES_PER_BUBBLE))); pieces = count - bubbles; }
  for (let i = 0; i < bubbles; i++) state.bubbles.push(makeBubble(i, id === 'glow' || (id === 'mix' && i % 4 === 0)));
  for (let i = 0; i < pieces; i++) state.particles.push(makePiece(i));
}

/* One frame of movement: bubbles rise and wrap around, confetti bounces off the edges. */
function move(dt: number): void {
  for (const b of state.bubbles) {
    b.phase += dt;
    b.ny -= 0.075 * b.speed * dt;
    if (b.ny < -0.3) b.ny = 1.3;
  }
  const { W, H } = state;
  for (const q of state.particles) {
    q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
    if (q.x < 0 || q.x > W) q.vx = -q.vx;
    if (q.y < 0 || q.y > H) q.vy = -q.vy;
  }
}

/* The still things are drawn once onto their own canvas; every frame just copies it. */
function buildStillLayer(): void {
  const saved = state.bubbles.slice();
  state.bubbles.length = 0;
  state.hintOn = false;
  for (let i = 0; i < STILL_LAYER_COUNT; i++) { const b = makeBubble(i, false); b.ny = Math.random(); state.bubbles.push(b); }
  context().clearRect(0, 0, state.W, state.H);
  for (const b of state.bubbles) drawBubble(b);
  still = document.createElement('canvas');
  still.width = canvas.width; still.height = canvas.height;
  still.getContext('2d')?.drawImage(canvas, 0, 0);
  state.bubbles.length = 0;
  state.bubbles.push(...saved);
}

function drawFrame(id: CaseId): void {
  const ctx = context();
  ctx.clearRect(0, 0, state.W, state.H);
  if (id === 'cached' && still) ctx.drawImage(still, 0, 0, state.W, state.H);
  for (const b of state.bubbles) drawBubble(b);
  drawParticles();
}

function nextFrame(): Promise<number> { return new Promise((ok) => requestAnimationFrame(ok)); }

/* The screen's normal frame time, with nothing drawn. */
async function normalFrameMs(): Promise<number> {
  const gaps: number[] = [];
  let last = await nextFrame();
  for (let i = 0; i < 90; i++) { const t = await nextFrame(); gaps.push(t - last); last = t; }
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)] ?? 16.7;
}

const status = $('status');
/* Runs one count for a while and reports whether it stayed smooth. */
async function smoothAt(id: CaseId, count: number, frameMs: number): Promise<boolean> {
  populate(id, count);
  let last = await nextFrame();
  const start = last;
  let late = 0, frames = 0;
  for (;;) {
    const t = await nextFrame();
    const gap = t - last;
    last = t;
    move(Math.min(gap, 50) / 1000);
    drawFrame(id);
    if (t - start < WARMUP_MS) continue;
    frames++;
    if (gap > frameMs * LATE_FACTOR) late++;
    if (late > MEASURE_FRAMES * MAX_LATE_SHARE) return false;
    if (frames >= MEASURE_FRAMES) return true;
  }
}

/* Grows the count until it stops being smooth, then narrows down the breaking point. */
async function breakingPoint(id: CaseId, label: string, frameMs: number): Promise<number> {
  let good = 0, bad = 0, n = 4;
  while (n <= MAX_COUNT) {
    status.textContent = `${label}: ${n}`;
    if (await smoothAt(id, n, frameMs)) { good = n; n = Math.ceil(n * GROW); } else { bad = n; break; }
  }
  if (!bad) return good;
  for (let i = 0; i < REFINE_STEPS && bad - good > 1; i++) {
    const mid = Math.round((good + bad) / 2);
    status.textContent = `${label}: ${mid}`;
    if (await smoothAt(id, mid, frameMs)) good = mid; else bad = mid;
  }
  return good;
}

function describeSetup(frameMs: number): string {
  const lowPower = 'Low Power Mode can\'t be detected by a web page: make sure it is off.';
  return `Screen ${state.W} x ${state.H} points, pixel density ${state.dpr} (canvas ${canvas.width} x ${canvas.height} pixels). ` +
    `Normal frame time ${frameMs.toFixed(1)} ms (${Math.round(1000 / frameMs)} frames a second). Bubble size: ` +
    `${Math.round(state.R * 2)} points across${sizeScale === 1 ? ' (as in the game)' : ''}. ${lowPower} ` +
    `${navigator.userAgent}`;
}

async function runAll(): Promise<void> {
  const panel = $('panel'), results = $('results');
  panel.classList.add('running');
  status.classList.add('running');
  resize();
  state.R *= sizeScale; state.FS *= sizeScale;
  state.settings.sparkles = 'on';
  state.target = { key: 'A', glyph: 'A', since: 0 };
  results.innerHTML = '';
  status.textContent = 'Measuring the screen...';
  await document.fonts.ready;
  const frameMs = await normalFrameMs();
  const found: string[] = [];
  for (const c of CASES) {
    if (c.id === 'cached') buildStillLayer(); else still = null;
    const n = await breakingPoint(c.id, c.label, frameMs);
    found.push(`<div><span>${n >= MAX_COUNT ? MAX_COUNT + '+' : n}</span>${c.label}</div>`);
    console.log(`${c.label}: ${n}`);
  }
  state.bubbles.length = 0; state.particles.length = 0;
  context().clearRect(0, 0, state.W, state.H);
  results.innerHTML = '<p>Breaking points (the most that stayed smooth):</p>' + found.join('');
  $('setup').textContent = describeSetup(frameMs);
  panel.classList.remove('running');
  status.classList.remove('running');
  $('go').textContent = 'Run it again';
}

$('rule').textContent = `"Smooth" means no more than 1 frame in ${Math.round(1 / MAX_LATE_SHARE)} is late, where a late frame takes ` +
  `more than ${LATE_FACTOR} times the screen's normal frame time. Each count is watched for ${MEASURE_FRAMES} frames ` +
  `after a ${WARMUP_MS / 1000} s warm-up. Take a screenshot of the results to keep them.`;
for (const b of Array.from(document.querySelectorAll<HTMLElement>('[data-size]'))) {
  b.addEventListener('click', () => {
    sizeScale = Number(b.dataset.size);
    for (const o of Array.from(document.querySelectorAll('[data-size]'))) o.classList.toggle('sel', o === b);
  });
}
$('go').addEventListener('click', () => { void runAll(); });
window.addEventListener('resize', () => { if (!$('panel').classList.contains('running')) { resize(); layout(); } });
resize();
