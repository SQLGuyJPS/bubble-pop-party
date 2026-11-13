// The speed limits in src/config.ts (see docs/ROADMAP.md, "Speed limits"). Fails if the game goes over any of them.
import fs from 'node:fs';
import path from 'node:path';
import { root, stats, expect, report, freshGame, runFor, targetBubble, tapBubble } from './harness.mjs';

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

  // canvas: bubbles and confetti stay under their caps through a long game with many parties
  let most = { bubbles: 0, particles: 0 };
  for (let n = 0; n < 120; n++) {
    const tb = targetBubble(env.bpp);
    if (tb) tapBubble(env.bpp, tb);
    runFor(env, 0.25);
    const st = env.bpp.state();
    most = { bubbles: Math.max(most.bubbles, st.bubbles.length), particles: Math.max(most.particles, st.particles) };
  }
  expect(most.bubbles <= limits.maxBubbles, `${most.bubbles} bubbles at once, over ${limits.maxBubbles}`);
  expect(most.particles <= limits.maxParticles, `${most.particles} confetti pieces at once, over ${limits.maxParticles}`);
  report('speed limits', before);
}
