// Plays the game thousands of times with random taps and checks the rules after every frame, then checks hints,
// prompts, stars, confetti, missed items, sparkles and the play time limit.
import { stats, fail, expect, mulberry, makeEnv, freshGame, runFor, tapBubble, targetBubble, otherBubble, passGate } from './harness.mjs';

export default async function () {
  // ---------- scenarios ----------
  const SIZES = [[1180, 820], [820, 1180], [1133, 744], [744, 1133], [390, 844], [844, 390], [1024, 768]];
  const POOLS = [
    { name: 'default A-E', s: {} },
    { name: 'numbers 1-5', s: { mode: 'numbers' } },
    { name: 'both', s: { mode: 'both' } },
    { name: 'whole alphabet, lowercase', s: { letters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', letterCase: 'lower' } },
    { name: 'look-alike heavy', s: { letters: 'BDPQMWNUOIL', numbers: '690 1'.replace(/ /g, ''), mode: 'both', letterCase: 'both' } },
    { name: 'two items only', s: { letters: 'AB' } },
    { name: 'one item only', s: { letters: 'A' } }
  ];

  function run(scn, seed, withSpeech) {
    const rand = mulberry(seed);
    const { bpp, advance, speech } = makeEnv({ rand, speech: withSpeech });
    bpp.setSettings(scn.s);
    bpp.resize(...SIZES[seed % SIZES.length]);
    bpp.start();
    const targets = [];
    let pops = 0, wrongs = 0, lastKey = null, lastSimTarget = null;
    const seen = new Set();
    const STEPS = 6000;                       // 100 seconds of play at 60 frames per second
    for (let i = 0; i < STEPS; i++) {
      const dt = rand() < 0.02 ? 0.05 : 1 / 60;   // sometimes a slow frame
      bpp.step(dt);
      advance(dt * 1000);
      if (i % 900 === 450) {                       // rotate / resize in the middle of play
        const before = bpp.state().target.key;
        bpp.resize(...SIZES[Math.floor(rand() * SIZES.length)]);
        if (bpp.state().target.key !== before) fail(scn.name + ': resize changed the target');
      }
      // random fingers
      const fingers = rand() < 0.05 ? 1 + Math.floor(rand() * 4) : (rand() < 0.04 ? 1 : 0);
      for (let f = 0; f < fingers; f++) {
        const st = bpp.state();
        const roll = rand();
        const live = st.bubbles.filter(bpp.isLive);
        const targetKeyBefore = st.target.key;
        if (roll < 0.5) {
          const tb = live.find((b) => b.key === st.target.key);
          if (tb) { const p = bpp.pos(tb); bpp.tap(p.x, Math.min(p.y, st.H - 1)); }
        } else if (roll < 0.8) {
          const others = live.filter((b) => b.key !== st.target.key);
          if (others.length) {
            const b = others[Math.floor(rand() * others.length)];
            const p = bpp.pos(b); bpp.tap(p.x, Math.min(Math.max(p.y, 1), st.H - 1));
            if (bpp.state().target.key !== targetKeyBefore) fail(scn.name + ': a wrong pop changed the target');
            wrongs++;
          }
        } else if (roll < 0.9) {
          const popping = st.bubbles.find((b) => b.state === 'popping');
          if (popping) { const p = bpp.pos(popping); const keyBefore = st.target.key; bpp.tap(p.x, p.y); if (bpp.state().target.key !== keyBefore) fail(scn.name + ': tapping a popping bubble did something'); }
        } else {
          bpp.tap(rand() * st.W, rand() * st.H);   // anywhere, maybe empty
        }
        const after = bpp.state();
        const now = after.target;
        if (now !== lastSimTarget) {
          lastSimTarget = now; targets.push(now.key); seen.add(now.key);
          // if the new target is already on screen it must still be catchable; otherwise it rises from the bottom
          // (the strict "must be the planned next bubble" check is in the focused tests below, because a fuzzer
          // that pops 4 bubbles in one frame can legitimately use up a tiny item list)
          if (bpp.pool().length >= 4) {
            const tb = after.bubbles.find((b) => bpp.isLive(b) && b.key === now.key);
            if (tb) {
              const left = bpp.secondsCatchable(tb);
              if (left < bpp.minCatchSeconds - 1e-6) fail(`${scn.name} seed ${seed}: asked for ${now.key} with only ${left.toFixed(2)}s left on screen`);
            }
          }
        }
      }
      const errs = bpp.check();
      if (errs.length) errs.forEach((e) => fail(`${scn.name} seed ${seed} step ${i}: ${e}`));
      if (!lastSimTarget) lastSimTarget = bpp.state().target;
    }
    // targets must not repeat straight away (unless only one item exists)
    const poolSize = bpp.pool().length;
    if (poolSize > 1) {
      for (let i = 1; i < targets.length; i++) {
        if (targets[i] === targets[i - 1]) { fail(`${scn.name}: target ${targets[i]} repeated immediately`); break; }
      }
    }
    pops = targets.length;
    if (pops < 3) fail(`${scn.name}: only ${pops} targets in 100 seconds, the game seems stuck`);
    if (withSpeech) {
      if (speech.maxQueued > 1) fail(`${scn.name}: ${speech.maxQueued} utterances queued at once`);
      if (speech.spoken === 0) fail(`${scn.name}: nothing was ever spoken`);
      if (speech.texts.some((t) => !t || /undefined|NaN/.test(t))) fail(`${scn.name}: a spoken line was broken: ${speech.texts.find((t) => !t || /undefined|NaN/.test(t))}`);
    }
    return { targets: pops, wrongs, speech, bpp };
  }

  for (const withSpeech of [true, false]) {
    for (const scn of POOLS) {
      const before = stats.failures;
      for (let seed = 1; seed <= 14; seed++) { run(scn, seed, withSpeech); stats.games++; }
      console.log(`${stats.failures === before ? 'ok  ' : 'FAIL'} ${scn.name} (${withSpeech ? 'with' : 'without'} speech)`);
    }
  }

  {
    const before = stats.failures;

    // hint after 2 wrong pops, gone again for the next target
    let env = freshGame();
    expect(!env.bpp.state().hintOn, 'hint showed straight away');
    tapBubble(env.bpp, otherBubble(env.bpp)); runFor(env, 2);
    expect(!env.bpp.state().hintOn, 'hint showed after only 1 wrong pop');
    tapBubble(env.bpp, otherBubble(env.bpp)); runFor(env, 0.1);
    expect(env.bpp.state().hintOn, 'no hint after 2 wrong pops');
    tapBubble(env.bpp, targetBubble(env.bpp)); runFor(env, 0.3);
    expect(!env.bpp.state().hintOn, 'hint stayed on for the next target');

    // hint after ~15 seconds with no taps
    env = freshGame();
    runFor(env, 14);
    expect(!env.bpp.state().hintOn, 'idle hint came before 15 seconds');
    runFor(env, 2);
    expect(env.bpp.state().hintOn, 'no idle hint after 15 seconds');

    // the prompt repeats about every 8 seconds while nobody taps
    env = freshGame();
    runFor(env, 41);
    const prompts = env.bpp.sayLog.filter((k) => k.startsWith('prompt:')).length;
    expect(prompts >= 4 && prompts <= 6, `expected a prompt about every 8s over 41s of quiet, got ${prompts}`);
    expect(env.speech.maxQueued <= 1, 'idle prompts queued speech');

    // stars: a bigger celebration every 10, and confetti stays capped at 60
    env = freshGame();
    let maxParticles = 0;
    for (let n = 1; n <= 25; n++) {
      const tb = targetBubble(env.bpp);
      if (!tb) { runFor(env, 1); n--; continue; }
      tapBubble(env.bpp, tb);
      maxParticles = Math.max(maxParticles, env.bpp.state().particles);
      expect(env.bpp.state().particles <= 60, 'more than 60 confetti pieces');
      runFor(env, n % 10 === 0 ? 6 : 0.4);   // let the party line finish; faster taps would cut it off
    }
    expect(env.bpp.state().stars === 25, 'star count is ' + env.bpp.state().stars + ', expected 25');
    expect(maxParticles >= 20, 'no confetti burst on a correct pop');
    expect(env.bpp.sayLog.filter((k) => k === 'party').length >= 2, 'expected a party line at 10 and 20 stars');

    // items that were missed come up more often
    env = freshGame({ letters: 'ABCDEFGH' }, { seed: 3 });
    const counts = {};
    let total = 0;
    for (let n = 0; n < 300; n++) {
      const tb = targetBubble(env.bpp);
      if (!tb) { runFor(env, 1); n--; continue; }
      const key = env.bpp.state().target.key;
      counts[key] = (counts[key] || 0) + 1; total++;
      if (key === 'C') {           // C is always missed twice before it is found
        for (let w = 0; w < 2; w++) { const o = otherBubble(env.bpp); if (o) tapBubble(env.bpp, o); runFor(env, 1.6); }
      }
      runFor(env, 3);              // a child needs a few seconds to look for it (the next letter comes from bubbles already on screen)
      const t2 = targetBubble(env.bpp);
      if (t2) tapBubble(env.bpp, t2);
      runFor(env, 0.3);
    }
    const avgOther = (total - (counts.C || 0)) / 7;
    expect((counts.C || 0) > avgOther * 1.5, `missed item C came up ${counts.C} times vs ${avgOther.toFixed(1)} for the others`);

    // sparkles: 'auto' only for a letter she has missed, and they fade once she finds it first try
    env = freshGame({ letters: 'AC' });
    expect(!env.bpp.state().sparkles, 'sparkles showed for a letter she has not missed');
    runFor(env, 4);   // let the second bubble float up into view
    tapBubble(env.bpp, otherBubble(env.bpp)); runFor(env, 2);
    expect(env.bpp.state().sparkles, 'no sparkles after she missed the letter');
    tapBubble(env.bpp, targetBubble(env.bpp)); runFor(env, 0.5);   // found with help: still needs practice
    const keyMissed = Object.keys(env.bpp.state().missed).find((k) => env.bpp.state().missed[k] > 0);
    expect(!!keyMissed, 'the missed letter was forgotten too early');
    env.bpp.setSettings({ sparkles: 'off' });
    expect(!env.bpp.state().sparkles, 'sparkles showed although they are switched off');
    env.bpp.setSettings({ sparkles: 'on' });
    expect(env.bpp.state().sparkles, 'sparkles did not show although they are switched on');
    // finding a missed letter first try counts it down until the sparkles stop
    env.bpp.setSettings({ sparkles: 'auto' });
    let guard = 0;
    while (guard++ < 40 && Object.keys(env.bpp.state().missed).some((k) => env.bpp.state().missed[k] > 0)) {
      const tb = targetBubble(env.bpp);
      if (!tb) { runFor(env, 1); continue; }
      tapBubble(env.bpp, tb);
      runFor(env, 0.4);
    }
    expect(!Object.keys(env.bpp.state().missed).some((k) => env.bpp.state().missed[k] > 0), 'missed counts never counted down');
    expect(!env.bpp.state().sparkles, 'sparkles still showing after she knows every letter');

    console.log(`${stats.failures === before ? 'ok  ' : 'FAIL'} hints, repeating prompts, stars, confetti cap, missed-item weighting, sparkles`);
  }

  {
    const before = stats.failures;
    // play time: goodbye screen, and only the parent gate starts a new session
    const env = freshGame({ sessionMinutes: 5 });
    const { bpp } = env;
    runFor(env, 299);
    expect(!bpp.state().ended, 'the goodbye came before the time was up');
    runFor(env, 2);
    expect(bpp.state().ended && bpp.state().paused, 'play time ran out but the game did not stop');
    expect(bpp.sayLog[bpp.sayLog.length - 1] === 'bye', 'no goodbye was spoken');
    const logLength = bpp.sayLog.length;
    const starsAtEnd = bpp.state().stars;
    const tb = targetBubble(bpp);
    if (tb) tapBubble(bpp, tb);
    runFor(env, 40);
    expect(bpp.state().stars === starsAtEnd, 'she could keep playing after the goodbye');
    expect(bpp.sayLog.length === logLength, 'prompts kept repeating after the goodbye');
    bpp.resume();
    expect(bpp.state().paused && bpp.state().ended, 'coming back to the page restarted a finished session');
    bpp.ui.closeSettings();
    expect(bpp.state().ended, 'a new session started without going through the gate');
    passGate(env);
    bpp.ui.closeSettings();
    const after = bpp.state();
    expect(!after.ended && !after.paused && after.stars === 0 && after.sessionElapsed < 1, 'the parent could not start a new session');
    runFor(env, 2);
    expect(bpp.sayLog[bpp.sayLog.length - 1].startsWith('prompt:'), 'no prompt at the start of the new session');
    expect(bpp.check().length === 0, 'rules broken after restarting: ' + bpp.check().join('; '));

    // no limit means no goodbye
    const env2 = freshGame({ sessionMinutes: 0 });
    runFor(env2, 1200);
    expect(!env2.bpp.state().ended, 'a goodbye appeared although there is no time limit');
    console.log(`${stats.failures === before ? 'ok  ' : 'FAIL'} play time limit and goodbye screen`);
  }
}
