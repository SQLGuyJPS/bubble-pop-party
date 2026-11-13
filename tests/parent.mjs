// The parent gate, the settings screen, and saving settings.
import { stats, fail, expect, mulberry, makeEnv, freshGame, runFor, tapBubble, targetBubble, otherBubble, passGate } from './harness.mjs';

export default async function () {
  {
    const before = stats.failures;
    let env = freshGame();
    const { bpp, advance } = env;

    // the gate: pauses the game, needs a full 3 second hold, then a two-digit sum
    bpp.ui.openGate();
    let st = bpp.state();
    expect(st.gateOpen && st.paused && st.uiLock, 'opening the gate did not pause the game');
    bpp.ui.startHold(); advance(2900); bpp.ui.cancelHold(); advance(500);
    expect(bpp.state().gateStep === 'hold', 'letting go before 3 seconds still moved on');
    bpp.ui.startHold(); advance(2900);
    expect(bpp.state().gateStep === 'hold', 'moved on before 3 seconds');
    advance(200);
    expect(bpp.state().gateStep === 'math', 'holding for 3 seconds did not move on');
    bpp.ui.key('ok');
    expect(!bpp.state().settingsOpen, 'an empty answer opened settings');
    let smallest = 999, biggest = 0;
    for (let n = 0; n < 60; n++) {
      const p = bpp.ui.problem();
      smallest = Math.min(smallest, p.a, p.b); biggest = Math.max(biggest, p.a, p.b);
      String(p.a + p.b + 1).split('').forEach((d) => bpp.ui.key(d));   // always wrong
      bpp.ui.key('ok');
      expect(!bpp.state().settingsOpen && bpp.state().gateStep === 'math', 'a wrong answer got through');
      expect(bpp.ui.problem().typed === '', 'the answer box was not cleared after a wrong answer');
    }
    expect(smallest >= 10 && biggest <= 99, `the sum should use two-digit numbers, saw ${smallest} to ${biggest}`);
    { const p = bpp.ui.problem(); String(p.a + p.b).split('').forEach((d) => bpp.ui.key(d)); bpp.ui.key('ok'); }
    st = bpp.state();
    expect(st.settingsOpen && !st.gateOpen && st.paused, 'the right answer did not open settings with the game paused');

    // settings: choices are applied, at least one item always stays, bad input can't break things
    bpp.ui.action('mode', 'both');
    expect(bpp.state().settings.mode === 'both', 'mode did not change');
    for (const c of 'ABCDE') bpp.ui.action('toggle-letter', c);
    expect(bpp.state().settings.letters.length === 1, 'the list of letters can become empty: ' + bpp.state().settings.letters);
    bpp.ui.action('toggle-letter', 'Z');
    expect(bpp.state().settings.letters.includes('Z'), 'a letter could not be added');
    bpp.ui.action('letters-preset', 'ABCDE');
    bpp.ui.action('case', 'both');
    bpp.ui.action('speed', '1.5'); bpp.ui.action('volume', '0.6'); bpp.ui.action('sparkles', 'off'); bpp.ui.action('session', '10');
    const s = bpp.state().settings;
    expect(s.letterCase === 'both' && s.speed === 1.5 && s.volume === 0.6 && s.sparkles === 'off' && s.sessionMinutes === 10, 'a setting was not applied: ' + JSON.stringify(s));

    // closing settings resumes play and says what to find; changed items give fresh bubbles
    bpp.ui.action('mode', 'numbers');
    bpp.ui.closeSettings();
    expect(!bpp.state().paused && !bpp.state().settingsOpen, 'closing settings did not resume the game');
    advance(900);
    expect(bpp.sayLog[bpp.sayLog.length - 1].startsWith('prompt:'), 'no prompt after closing settings');
    const keys = bpp.state().bubbles.map((b) => b.key);
    expect(keys.length > 0 && keys.every((k) => /[0-9]/.test(k)), 'bubbles were not refreshed for the new items: ' + keys.join(''));
    runFor(env, 5);
    expect(bpp.check().length === 0, 'rules broken after changing settings: ' + bpp.check().join('; '));

    // same items: bubbles and target are left alone
    const targetBefore = bpp.state().target.key;
    const countBefore = bpp.state().bubbles.length;
    passGate(env);
    bpp.ui.action('volume', '0.4');
    bpp.ui.closeSettings();
    expect(bpp.state().target.key === targetBefore && bpp.state().bubbles.length === countBefore, 'changing only the volume reset the bubbles');

    // a toddler wandering into the gate: it closes by itself and play carries on
    bpp.ui.openGate();
    advance(24000);
    expect(bpp.state().gateOpen, 'the gate closed too soon');
    advance(1500);
    expect(!bpp.state().gateOpen && !bpp.state().paused, 'the gate did not close by itself');

    console.log(`${stats.failures === before ? 'ok  ' : 'FAIL'} parent gate and settings`);
  }

  {
    const before = stats.failures;
    // settings are remembered; blocked or damaged storage falls back to the defaults
    const store = new Map();
    let env = freshGame({}, { storage: store });
    passGate(env);
    env.bpp.ui.action('mode', 'both'); env.bpp.ui.action('toggle-letter', 'B'); env.bpp.ui.action('speed', '0.6');
    env.bpp.ui.action('volume', '0.8'); env.bpp.ui.action('sparkles', 'on'); env.bpp.ui.action('session', '15'); env.bpp.ui.action('case', 'lower');
    const saved = JSON.parse(JSON.stringify(env.bpp.state().settings));
    env = freshGame({}, { storage: store });
    expect(JSON.stringify(env.bpp.state().settings) === JSON.stringify(saved), 'settings were not remembered: ' + JSON.stringify(env.bpp.state().settings));

    env = freshGame({}, { storage: 'blocked' });
    passGate(env);
    env.bpp.ui.action('volume', '0.4');          // must not throw
    env.bpp.ui.closeSettings();
    runFor(env, 5);
    expect(env.bpp.check().length === 0 && env.bpp.state().stars >= 0, 'the game broke when storage was blocked');
    expect(env.bpp.state().settings.mode === 'letters' && env.bpp.state().settings.letters === 'ABCDE', 'defaults were not used when storage was blocked');

    const bad = new Map([['bubblePopParty.settings.v1', '{not json']]);
    env = freshGame({}, { storage: bad });
    expect(env.bpp.state().settings.letters === 'ABCDE', 'damaged storage did not fall back to the defaults');

    const odd = new Map([['bubblePopParty.settings.v1', JSON.stringify({ mode: 'evil', letters: 'zz!!7', numbers: 'abc', speed: 99, volume: -5, sessionMinutes: 7, sparkles: 'maybe', letterCase: 5, voiceURI: 42 })]]);
    env = freshGame({}, { storage: odd });
    const o = env.bpp.state().settings;
    expect(o.mode === 'letters' && o.letters === 'Z' && o.numbers === '12345' && o.speed === 1.5 && o.volume === 0.2 && o.sessionMinutes === 5 && o.sparkles === 'auto' && o.letterCase === 'upper' && o.voiceURI === '', 'odd saved values were not cleaned up: ' + JSON.stringify(o));
    runFor(env, 5);
    expect(env.bpp.check().length === 0, 'the game broke with odd saved values');

    // volume reaches the voice, and "Hear it" works even when muted
    env = freshGame();
    passGate(env);
    env.bpp.ui.action('volume', '0.6');
    env.bpp.setMuted(true);
    env.bpp.ui.hear();
    env.advance(200);
    expect(!env.bpp.state().muted, '"Hear it" stayed muted');
    for (let t = 0; t < 4000; t += 50) env.advance(50);   // small steps, so chained timers keep their real spacing
    const heard = env.speech.texts.slice(-2);
    expect(heard[0] === 'Great!' && heard[1] === 'eigh is for apple.', 'the voice test said: ' + heard.join(' | '));
    expect(!env.speech.texts.some((x) => /Yay/.test(x)), 'the cheer still says Yay');
    const gap = env.speech.times[env.speech.times.length - 1] - env.speech.times[env.speech.times.length - 2];
    expect(gap >= 1500 + 400, 'no pause between "Great!" and "eigh is for apple" (gap ' + gap + ' ms)');
    expect(env.speech.maxQueued <= 1, 'the two parts of the cheer were queued together');
    expect(env.speech.volumes[env.speech.volumes.length - 1] === 0.6, 'the volume setting did not reach the voice');
    console.log(`${stats.failures === before ? 'ok  ' : 'FAIL'} saving settings (and surviving bad storage)`);
  }
}
