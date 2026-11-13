/* Drawing: bubbles, confetti, and fitting everything to the screen. The speed test page (perf/) uses these same
   functions, so what it measures is what the game draws. */
import {
  BUBBLE_HEIGHT_CAP, BUBBLE_WIDTH_RATIO, GLYPH_RATIO, HUES, MAX_PARTICLES, POP_DURATION, SPAWN_DEPTH, TAU,
  WOBBLE_DURATION
} from './config';
import { state, type Bubble } from './state';
import { pos, sparklesWanted } from './targets';

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D;

export function initCanvas(c: HTMLCanvasElement): void {
  canvas = c;
  ctx = c.getContext('2d') as CanvasRenderingContext2D;
}

export function layout(): void {
  const { W, H } = state;
  state.D = Math.min(W * BUBBLE_WIDTH_RATIO, H * BUBBLE_HEIGHT_CAP);
  state.R = state.D / 2;
  state.FS = state.D * GLYPH_RATIO;
  // after a rotation the bubble size changes: keep fresh bubbles from sitting too far below the bottom edge
  const lowest = (H + state.R * SPAWN_DEPTH) / H;
  for (const b of state.bubbles) if (b.ny > lowest) b.ny = lowest;
}

export function resize(): void {
  if (!canvas) return;
  const w = canvas.clientWidth || window.innerWidth || 1024;
  const h = canvas.clientHeight || window.innerHeight || 768;
  state.dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(w * state.dpr);
  canvas.height = Math.round(h * state.dpr);
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  state.W = w; state.H = h;
  layout();     // bubbles and the target live in screen-relative units, so nothing is lost
}

/* ---- Confetti: small shapes (not just colors) that fall and spin ---- */
export function burst(x: number, y: number, n: number): void {
  const { W, H, R, particles } = state;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const sp = (0.25 + Math.random() * 0.75) * Math.max(W, H) * 0.7;
    particles.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - Math.max(W, H) * 0.25,
      rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 14,
      size: Math.max(8, R * (0.08 + Math.random() * 0.08)),
      hue: (HUES[Math.floor(Math.random() * HUES.length)] ?? 0) + Math.floor(Math.random() * 20),
      shape: i % 3,                 // 0 square, 1 circle, 2 star-ish diamond
      life: 0, maxLife: 1.1 + Math.random() * 0.5
    });
  }
  if (particles.length > MAX_PARTICLES) particles.splice(0, particles.length - MAX_PARTICLES);   // drop the oldest
}

export function stepParticles(dt: number): void {
  const { particles, H } = state;
  for (let i = particles.length - 1; i >= 0; i--) {
    const q = particles[i]!;
    q.life += dt;
    if (q.life >= q.maxLife) { particles.splice(i, 1); continue; }
    q.vy += H * 1.2 * dt;           // gravity
    q.vx *= 1 - 1.5 * dt;
    q.vy *= 1 - 0.6 * dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.rot += q.vr * dt;
  }
}

export function drawParticles(): void {
  for (const q of state.particles) {
    const fade = 1 - Math.max(0, (q.life / q.maxLife - 0.6) / 0.4);
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.rotate(q.rot);
    ctx.globalAlpha = fade;
    ctx.fillStyle = 'hsl(' + q.hue + ',95%,62%)';
    ctx.strokeStyle = '#1d2b64';
    ctx.lineWidth = Math.max(1.5, q.size * 0.18);
    ctx.beginPath();
    if (q.shape === 0) ctx.rect(-q.size / 2, -q.size / 2, q.size, q.size);
    else if (q.shape === 1) ctx.arc(0, 0, q.size / 2, 0, TAU);
    else {
      ctx.moveTo(0, -q.size * 0.7); ctx.lineTo(q.size * 0.5, 0);
      ctx.lineTo(0, q.size * 0.7); ctx.lineTo(-q.size * 0.5, 0);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

/* ---- Bubbles ---- */
let capCache = { fs: 0, cap: 0 };
function fontStr(fs: number): string { return '700 ' + fs + 'px Andika, "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif'; }
export function capHeight(fs: number): number {
  if (capCache.fs === fs) return capCache.cap;
  ctx.font = fontStr(fs);
  const m = ctx.measureText('H');
  const cap = (m && m.actualBoundingBoxAscent) || fs * 0.7;
  capCache = { fs, cap };
  return cap;
}
/* The big font loads from a file; once it's ready, it has to be measured again. */
export function forgetFontSize(): void { capCache.fs = 0; }

export function drawBubble(b: Bubble): void {
  const { simTime, FS } = state;
  const p = pos(b);
  const r = p.r;
  let scale = 1, rot = 0, pk = 0;
  let alpha = 1;
  if (b.state === 'popping') {
    pk = Math.min(1, b.popT / POP_DURATION);
    scale = 1 + 0.35 * pk;
    alpha = 1 - pk;
  } else {
    scale = 1 + 0.015 * Math.sin(b.phase * 2.1);
    if (b.wobble > 0) {
      const k = b.wobble / WOBBLE_DURATION;
      rot = Math.sin((1 - k) * Math.PI * 6) * 0.22 * k;
      scale *= 1 + 0.05 * k;
    }
  }
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(rot);
  const glowing = state.hintOn && b.state === 'live' && b.key === state.target.key;
  if (glowing) scale *= 1 + 0.05 * Math.sin(simTime * 6);   // gentle pulse
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;

  if (glowing) {   // soft golden glow and a thick pulsing ring (optional sparkles): it doesn't rely on color alone
    const pulse = 0.5 + 0.5 * Math.sin(simTime * 6);
    ctx.save();
    ctx.shadowColor = '#ffd23f';
    ctx.shadowBlur = r * (0.35 + 0.25 * pulse);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.1, 0, TAU);
    ctx.lineWidth = r * (0.08 + 0.05 * pulse);
    ctx.strokeStyle = '#ffd23f';
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffb703';
    ctx.lineWidth = r * 0.02;
    for (let sp = 0; sparklesWanted() && sp < 4; sp++) {
      const sa = simTime * 1.5 + sp * TAU / 4;
      const sx = Math.cos(sa) * r * 1.22, sy = Math.sin(sa) * r * 1.22, ss = r * (0.07 + 0.04 * pulse);
      ctx.beginPath();
      ctx.moveTo(sx, sy - ss * 2); ctx.lineTo(sx + ss, sy); ctx.lineTo(sx, sy + ss * 2); ctx.lineTo(sx - ss, sy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.05, 0, 0, r);
  g.addColorStop(0, 'hsl(' + b.hue + ',100%,93%)');
  g.addColorStop(0.55, 'hsl(' + b.hue + ',95%,78%)');
  g.addColorStop(1, 'hsl(' + b.hue + ',85%,64%)');
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = r * 0.07;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.045, 0, TAU);
  ctx.lineWidth = r * 0.03;
  ctx.strokeStyle = '#1d2b64';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, r * 0.82, Math.PI * 1.08, Math.PI * 1.42);
  ctx.lineWidth = r * 0.07;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.stroke();

  const cap = capHeight(FS);
  ctx.font = fontStr(FS);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = FS * 0.1;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText(b.glyph, 0, cap / 2);
  ctx.fillStyle = '#1d2b64';
  ctx.fillText(b.glyph, 0, cap / 2);

  if (b.state === 'popping') {   // little droplets flying outward
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * (0.9 + 0.9 * pk), Math.sin(a) * r * (0.9 + 0.9 * pk), r * 0.09 * (1 - pk), 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function draw(): void {
  ctx.clearRect(0, 0, state.W, state.H);
  for (const b of state.bubbles) drawBubble(b);
  drawParticles();
}

/* For the speed test page: the drawing context, to draw extra things in the same way. */
export function context(): CanvasRenderingContext2D { return ctx; }
