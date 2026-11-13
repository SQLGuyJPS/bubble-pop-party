// Which bubble is asked for next.
import { stats, fail, expect, mulberry, makeEnv, freshGame, runFor, tapBubble, targetBubble, otherBubble, passGate } from './harness.mjs';

export default async function () {
  // ---------- which bubble is asked for next ----------
  {
    const before = stats.failures;

    // Set up a game where the three other bubbles sit at chosen heights (1 = bottom edge, 0 = top edge), pop the
    // target, and report which key became the target next.
    function nextAfterPop(seed, heights, extra = {}) {
      const env = freshGame({ letters: 'ABCDEFGH', ...extra }, { seed });
      const bpp = env.bpp;
      const st = bpp.state();
      const live = st.bubbles.filter(bpp.isLive);
      const tb = live.find((b) => b.key === st.target.key);
      const others = live.filter((b) => b !== tb);
      others.forEach((b, i) => { b.ny = heights[i % heights.length]; b.speed = 1; });
      tb.ny = 0.9; tb.speed = 1;
      const upcoming = bpp.state().upcoming;
      const keysOnScreen = others.map((b) => ({ key: b.key, left: bpp.secondsCatchable(b) }));
      tapBubble(bpp, tb);
      return { key: bpp.state().target.key, upcoming, keysOnScreen, bpp };
    }

    // bubbles close to the top are never asked for; the next one from the bottom is always available
    let sawUpcoming = 0, trials = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const r = nextAfterPop(seed, [0.12, 0.08]);
      trials++;
      expect(r.keysOnScreen.every((o) => o.left < r.bpp.minCatchSeconds), 'test setup: the high bubbles should be out of bounds');
      expect(!r.keysOnScreen.some((o) => o.key === r.key), `asked for ${r.key}, a bubble about to leave through the top`);
      expect(r.key === r.upcoming, `with every bubble too high, expected the next bubble from the bottom (${r.upcoming}) but got ${r.key}`);
      if (r.key === r.upcoming) sawUpcoming++;
    }
    expect(sawUpcoming === trials, 'the bubble rising from the bottom was not used as the target');

    // bubbles that are fully on screen and catchable are used; the one rising from the bottom is only a last resort
    {
      const picked = { onScreen: 0, upcoming: 0 };
      for (let seed = 1; seed <= 120; seed++) {
        const r = nextAfterPop(seed, [0.6, 0.45]);
        if (r.key === r.upcoming) picked.upcoming++;
        else if (r.keysOnScreen.some((o) => o.key === r.key)) picked.onScreen++;
        else fail(`asked for ${r.key}, which was neither on screen nor next from the bottom`);
      }
      expect(picked.onScreen === 120 && picked.upcoming === 0, `with catchable bubbles on screen, only they should be asked for: ${JSON.stringify(picked)}`);
    }

    // a bubble that is only partly on screen (just rising in) is not asked for while a fully visible one exists
    {
      const st0 = freshGame({ letters: 'ABCDEFGH' }, { seed: 4 }).bpp.state();
      const lowestFullyVisible = 1 - st0.R / st0.H;           // centre height (0 = top, 1 = bottom edge) where the bottom edge of a bubble reaches the screen edge
      let sawPartial = 0, sawVisible = 0;
      for (let seed = 1; seed <= 80; seed++) {
        const env2 = freshGame({ letters: 'ABCDEFGH' }, { seed });
        const st = env2.bpp.state();
        const live = st.bubbles.filter(env2.bpp.isLive);
        const tb = live.find((b) => b.key === st.target.key);
        const [partial, visible] = live.filter((b) => b !== tb);
        tb.ny = 0.9; tb.speed = 1;
        partial.ny = lowestFullyVisible + 0.08; partial.speed = 1;      // half way in
        visible.ny = lowestFullyVisible - 0.15; visible.speed = 1;
        const partialKey = partial.key, visibleKey = visible.key;
        tapBubble(env2.bpp, tb);
        const k = env2.bpp.state().target.key;
        if (k === partialKey) sawPartial++;
        if (k === visibleKey) sawVisible++;
      }
      expect(sawPartial === 0, `a bubble still rising in was asked for ${sawPartial} times`);
      expect(sawVisible === 80, `the fully visible bubble should always be asked for, got ${sawVisible}/80`);
    }

    // higher bubbles are picked more often than lower ones (as long as both are catchable)
    {
      let high = 0, low = 0;
      for (let seed = 1; seed <= 400; seed++) {
        const env2 = freshGame({ letters: 'ABCDEFGH' }, { seed });
        const st = env2.bpp.state();
        const live = st.bubbles.filter(env2.bpp.isLive);
        const tb = live.find((b) => b.key === st.target.key);
        const [a, b2] = live.filter((b) => b !== tb);
        tb.ny = 0.9; tb.speed = 1;
        a.ny = 0.7; a.speed = 1;      // low in the zone
        b2.ny = 0.28; b2.speed = 1;   // high in the zone, but still with time left
        if (env2.bpp.secondsCatchable(b2) < env2.bpp.minCatchSeconds) { fail('test setup: the high bubble should still be catchable'); break; }
        const lowKey = a.key, highKey = b2.key;
        tapBubble(env2.bpp, tb);
        const k = env2.bpp.state().target.key;
        if (k === lowKey) low++; else if (k === highKey) high++;
      }
      expect(high + low === 400, 'only the two catchable bubbles should have been asked for');
      expect(high > low * 1.5, `the higher bubble should be picked clearly more often: high ${high}, low ${low}`);
      expect(low > 40, `the lower bubble should still sometimes be picked: ${low}`);
    }

    // the cutoff moves with bubble speed: faster means fewer bubbles qualify, slower means more
    function cutoffHeight(env, speedSetting) {
      const bpp = env.bpp;
      bpp.setSettings({ speed: speedSetting });
      const b = bpp.state().bubbles[0];
      b.speed = 1;
      let lo = 0, hi = 2;                        // the highest position (ny) that still has enough time left
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        b.ny = mid;
        if (bpp.secondsCatchable(b) >= bpp.minCatchSeconds) hi = mid; else lo = mid;
      }
      return hi;
    }
    let env = freshGame();
    const slow = cutoffHeight(env, 0.6), normal = cutoffHeight(env, 1), fast = cutoffHeight(env, 1.5);
    expect(slow < normal && normal < fast, `cutoff should sit lower on the screen as bubbles speed up: ${slow.toFixed(2)} ${normal.toFixed(2)} ${fast.toFixed(2)}`);
    expect(slow > 0 && fast < 1, 'the cutoff should be somewhere on the screen at every speed');

    // ...and with bubble size: at the same screen height, a bigger bubble has more time before it is gone
    const small = freshGame(); small.bpp.resize(600, 800);
    const big = freshGame();   big.bpp.resize(1200, 800);
    const bs = small.bpp.state(), bb = big.bpp.state();
    expect(bb.R > bs.R, 'test setup: expected a bigger bubble on the wider screen');
    const probe = (e) => { const b = e.bpp.state().bubbles[0]; b.ny = 0.2; b.speed = 1; return e.bpp.secondsCatchable(b); };
    expect(probe(big) > probe(small), 'a bigger bubble should stay catchable longer at the same height');

    // when the next bubble comes from the bottom it still shows up on screen right away
    env = freshGame({ letters: 'ABCDEFGH' }, { seed: 9 });
    for (let n = 0; n < 12; n++) {
      const r = nextAfterPop(100 + n, [0.1]);
      r.bpp.step(1 / 60);
      expect(!!targetBubble(r.bpp), 'the new target did not start rising');
    }

    // a long game: nothing asked for ever has less than the minimum time left, at any speed
    for (const speed of [0.6, 1, 1.5]) {
      const g = freshGame({ speed, mode: 'both' }, { seed: 21 + speed * 10 });
      let worst = Infinity;
      for (let n = 0; n < 150; n++) {
        const t = targetBubble(g.bpp);
        if (!t) { runFor(g, 0.5); n--; continue; }
        tapBubble(g.bpp, t);
        const t2 = targetBubble(g.bpp);
        if (t2) {
          worst = Math.min(worst, g.bpp.secondsCatchable(t2));
          const gs = g.bpp.state();
          if (g.bpp.pos(t2).y > gs.H - gs.R + 1e-6) fail(`at speed ${speed}, asked for a bubble that was still rising in`);
        }
        runFor(g, 0.3 + (n % 7) * 0.4);
      }
      expect(worst >= g.bpp.minCatchSeconds - 1e-6, `at speed ${speed}, a target with only ${worst.toFixed(2)}s left was asked for`);
      expect(g.bpp.check().length === 0, 'rules broken in the long game: ' + g.bpp.check().join('; '));
    }

    console.log(`${stats.failures === before ? 'ok  ' : 'FAIL'} next letter comes from catchable bubbles or the one rising from the bottom`);
  }
}
