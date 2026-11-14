// The speed limits in src/config.ts (see docs/ROADMAP.md, "Speed limits"). Fails if the game goes over any of them.
import fs from 'node:fs';
import path from 'node:path';
import { root, stats, expect, report, freshGame, runFor, targetBubble, otherBubble, tapBubble } from './harness.mjs';

// Breaking points measured with the speed test page (perf/) on the iPad 7th generation. Each canvas limit is 80% of
// its breaking point, rounded down.
const MEASURED = { canvasBubbles: 11, canvasGlowing: 4, canvasConfetti: 1839, canvasMix: 152, canvasMovingOverCached: 9 };

export default async function () {
  const before = stats.failures;
  const env = freshGame({ mode: 'both' });
  const limits = env.bpp.limits;
  expect(limits && limits.svgTotal === 4800 && limits.svgMoving === 650, 'the SVG limits in config.ts are not 4,800 in total and 650 moving');

  // SVG pictures: every one in the page or made by the code counts, and each is counted as moving
  // (stricter than needed, but simple)
  let svgs = (fs.readFileSync(path.join(root, 'index.html'), 'utf8').match(/<svg\b/g) || []).length;
  for (const f of fs.readdirSync(path.join(root, 'src'))) {
    const text = fs.readFileSync(path.join(root, 'src', f), 'utf8');
    svgs += (text.match(/<svg\b|createElementNS\(/g) || []).length;
  }
  expect(svgs <= limits.svgTotal, `${svgs} SVG pictures, over the limit of ${limits.svgTotal}`);
  expect(svgs <= limits.svgMoving, `${svgs} SVG pictures that may move, over the limit of ${limits.svgMoving}`);

  // canvas limits: 80% of what the iPad measured
  for (const [k, measured] of Object.entries(MEASURED)) {
    expect(limits[k] === Math.floor(measured * 0.8), `canvas limit ${k} is ${limits[k]}, not 80% of the measured ${measured}`);
  }
  // the design caps fit inside the canvas limits, even all at once
  expect(limits.maxBubbles <= limits.canvasBubbles, `bubble cap ${limits.maxBubbles} is over the canvas limit ${limits.canvasBubbles}`);
  expect(limits.maxParticles <= limits.canvasConfetti, `confetti cap ${limits.maxParticles} is over the canvas limit ${limits.canvasConfetti}`);
  expect(limits.maxBubbles + limits.maxParticles <= limits.canvasMix,
    `${limits.maxBubbles} bubbles + ${limits.maxParticles} confetti could be on screen, over the mix limit ${limits.canvasMix}`);

  // canvas: bubbles, confetti and glowing bubbles stay under their limits through a long game with many parties,
  // wrong pops and quiet moments (both bring on the hint glow)
  env.bpp.setSettings({ sparkles: 'on' });
  let most = { bubbles: 0, particles: 0, mix: 0, glowing: 0 };
  const watch = () => {
    const st = env.bpp.state();
    most = {
      bubbles: Math.max(most.bubbles, st.bubbles.length), particles: Math.max(most.particles, st.particles),
      mix: Math.max(most.mix, st.bubbles.length + st.particles), glowing: Math.max(most.glowing, st.glowing)
    };
  };
  for (let n = 0; n < 120; n++) {
    if (n % 10 === 3) {   // a quiet moment: the hint comes on by itself
      for (let t = 0; t < 20; t++) { runFor(env, 1); watch(); }
    } else if (n % 10 === 6) {   // wrong pops: the hint comes on
      for (let w = 0; w < 3; w++) { const ob = otherBubble(env.bpp); if (ob) tapBubble(env.bpp, ob); runFor(env, 0.5); watch(); }
    }
    const tb = targetBubble(env.bpp);
    if (tb) tapBubble(env.bpp, tb);
    runFor(env, 0.25);
    watch();
  }
  expect(most.glowing >= 1, 'the hint glow never came on, so the glow limit was not tested');
  expect(most.bubbles <= limits.maxBubbles, `${most.bubbles} bubbles at once, over ${limits.maxBubbles}`);
  expect(most.particles <= limits.maxParticles, `${most.particles} confetti pieces at once, over ${limits.maxParticles}`);
  expect(most.bubbles <= limits.canvasBubbles, `${most.bubbles} bubbles at once, over the canvas limit ${limits.canvasBubbles}`);
  expect(most.particles <= limits.canvasConfetti, `${most.particles} confetti pieces, over the canvas limit ${limits.canvasConfetti}`);
  expect(most.glowing <= limits.canvasGlowing, `${most.glowing} glowing bubbles, over the canvas limit ${limits.canvasGlowing}`);
  expect(most.mix <= limits.canvasMix, `${most.mix} bubbles and confetti together, over the canvas mix limit ${limits.canvasMix}`);
  report('speed limits', before);
}
