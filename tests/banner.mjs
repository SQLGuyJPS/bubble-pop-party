// The banner at the top: "Letter at the top" defaults to Hide, and the word under the picture is written in the
// same case as the letter on the bubble the child has to find.
import { stats, expect, report, mulberry, makeEnv, freshGame, runFor, targetBubble, tapBubble } from './harness.mjs';

const WORDS = { A: 'apple', B: 'ball', C: 'cat', D: 'dog', E: 'elephant', I: 'ice cream', Y: 'yo-yo' };
const NUMBER_WORDS = { 1: 'one star', 2: 'two stars', 3: 'three stars', 4: 'four stars', 5: 'five stars' };

export default async function () {
  const before = stats.failures;

  // Hide is the default on a fresh install; a device that already saved Show keeps it
  {
    const fresh = freshGame({}, { storage: new Map() });
    expect(fresh.bpp.state().settings.showGlyph === false, '"Letter at the top" should default to Hide');
    expect(fresh.bpp.ui.sanitize({}).showGlyph === false, 'missing showGlyph should fall back to Hide');
    expect(fresh.bpp.ui.sanitize({ showGlyph: 'yes' }).showGlyph === false, 'a damaged showGlyph should fall back to Hide');
    const saved = new Map([['bubblePopParty.settings.v1', JSON.stringify({ showGlyph: true })]]);
    const old = freshGame({}, { storage: saved });
    expect(old.bpp.state().settings.showGlyph === true, 'a saved Show was changed to Hide');
    const blocked = freshGame({}, { storage: 'blocked' });
    expect(blocked.bpp.state().settings.showGlyph === false, 'blocked storage should give the default, Hide');
  }

  // the word's case follows the target bubble's letter, on every target of a long game
  for (const letterCase of ['upper', 'lower', 'both']) {
    const env = makeEnv({ rand: mulberry(31), speech: true });
    env.bpp.setSettings({ letters: 'ABCDEIY', letterCase });
    env.bpp.resize(1180, 820);
    env.bpp.start();
    const seen = { upper: 0, lower: 0, fromScreen: 0, fromBottom: 0 };
    let last = null, wrong = 0;
    const checkWord = () => {
      const st = env.bpp.state();
      const t = st.target;
      const want = t.glyph === t.key ? WORDS[t.key].toUpperCase() : WORDS[t.key].toLowerCase();
      if (st.bannerWord !== want) wrong++;
      if (wrong === 1 && st.bannerWord !== want) expect(false, `${letterCase}: target bubble shows "${t.glyph}" but the word is "${st.bannerWord}"`);
      if (t !== last) {
        last = t;
        seen[t.glyph === t.key ? 'upper' : 'lower']++;
        const tb = targetBubble(env.bpp);
        seen[tb && env.bpp.pos(tb).y < st.H ? 'fromScreen' : 'fromBottom']++;
      }
    };
    for (let n = 0; n < 400; n++) {
      checkWord();
      const tb = targetBubble(env.bpp);
      // sometimes wait long enough for the target to float off the top and come back up from the bottom
      if (tb && n % 5 !== 4) tapBubble(env.bpp, tb); else runFor(env, 9);
      runFor(env, 0.3);
      checkWord();
    }
    expect(wrong === 0, `${letterCase}: the word's case was wrong ${wrong} times`);
    if (letterCase === 'upper') expect(seen.lower === 0, 'ABC: a small letter was asked for');
    if (letterCase === 'lower') expect(seen.upper === 0, 'abc: a capital was asked for');
    if (letterCase === 'both') expect(seen.upper > 20 && seen.lower > 20, `Both: expected plenty of capitals and small letters, saw ${JSON.stringify(seen)}`);
    expect(seen.fromScreen > 20 && seen.fromBottom > 0, `${letterCase}: the test should cover targets on screen and from the bottom: ${JSON.stringify(seen)}`);
  }

  // number words are unchanged
  {
    const env = freshGame({ mode: 'numbers', letterCase: 'upper' });
    for (let n = 0; n < 40; n++) {
      const st = env.bpp.state();
      expect(st.bannerWord === NUMBER_WORDS[st.target.key], `number ${st.target.key} shows "${st.bannerWord}"`);
      const tb = targetBubble(env.bpp);
      if (tb) tapBubble(env.bpp, tb);
      runFor(env, 0.5);
    }
  }
  report('banner: Hide by default, word matches the bubble\'s case', before);
}
