// What the voice says: the spoken-lines sample, mute, and recorded clips.
import fs from 'node:fs';
import path from 'node:path';
import { root, report, stats, fail, expect, mulberry, makeEnv, freshGame, runFor, tapBubble, targetBubble, otherBubble, passGate } from './harness.mjs';

export default async function () {
  // ---------- spoken lines: the same as the saved sample, word for word and at the same moments ----------
  {
    const before = stats.failures;
    const sample = spokenSample();
    const file = path.join(root, 'tests', 'fixtures', 'spoken-sample.txt');
    if (process.argv.includes('--update-spoken-sample')) {
      fs.writeFileSync(file, sample);
      console.log('     (saved a new tests/fixtures/spoken-sample.txt)');
    }
    const saved = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    if (sample !== saved) {
      const a = saved.split('\n'), b = sample.split('\n');
      const i = a.findIndex((line, n) => line !== b[n]);
      fail(`the voice no longer says the same as tests/fixtures/spoken-sample.txt. First difference at line ${i + 1}: ` +
        `expected "${a[i]}", got "${b[i]}". If that change is intended, run: node tests/run.mjs --update-spoken-sample`);
    }
    console.log('\nSample of what the voice says:');
    const lines = sample.split('\n').filter((l) => /^\d/.test(l)).map((l) => l.replace(/^\d+ /, ''));
    [...new Set(lines)].slice(0, 8).forEach((t) => console.log('  "' + t + '"'));
    report('spoken lines match the saved sample', before);
  }

  {
    const before = stats.failures;
    // mute: nothing is spoken, the game keeps working, and un-muting says the target again
    const env = freshGame();
    env.bpp.setMuted(true);
    const spokenBefore = env.speech.spoken;
    for (let n = 0; n < 4; n++) { const tb = targetBubble(env.bpp); if (tb) tapBubble(env.bpp, tb); runFor(env, 3); }
    expect(env.speech.spoken === spokenBefore, 'the voice spoke while muted');
    expect(env.bpp.state().stars >= 3, 'the game stopped working while muted');
    env.bpp.setMuted(false);
    expect(env.bpp.sayLog[env.bpp.sayLog.length - 1].startsWith('prompt:'), 'un-muting did not repeat the prompt');
    console.log(`${stats.failures === before ? 'ok  ' : 'FAIL'} mute button`);
  }

  {
    const before = stats.failures;
    // recorded clips play in order, one at a time
    let env = freshGame({ letters: 'AB' }, { audio: 'ok' });
    const clipMap = {};
    ['A', 'B'].forEach((k) => ['prompt', 'cheer', 'that'].forEach((kind) => { clipMap[kind + ':' + k] = 'audio/' + kind + '-' + k + '.m4a'; }));
    Object.assign(env.bpp.overrides, clipMap);
    const targetKey = env.bpp.state().target.key;
    const wrongKey = targetKey === 'A' ? 'B' : 'A';
    const wrongBubble = env.bpp.state().bubbles.find((b) => b.key === wrongKey);
    expect(!!wrongBubble, 'test setup: no wrong bubble on screen');
    if (wrongBubble) {
      tapBubble(env.bpp, wrongBubble);
      runFor(env, 5);
      const clips = env.audio.created;
      expect(clips[0] === `audio/that-${wrongKey}.m4a`, 'wrong pop should play "that\'s the letter" first, got ' + clips[0]);
      expect(clips[1] === `audio/prompt-${targetKey}.m4a`, 'wrong pop should then play the prompt, got ' + clips[1]);
      expect(env.audio.maxPlaying <= 1, 'two recordings played at once');
      expect(env.speech.spoken === 0, 'computer voice spoke even though every clip had a recording');
    }
    // a recording that can't be loaded falls back to the computer voice
    env = freshGame({ letters: 'AB' }, { audio: 'fail' });
    Object.assign(env.bpp.overrides, clipMap);
    tapBubble(env.bpp, targetBubble(env.bpp));
    await new Promise((r) => setImmediate(r));
    runFor(env, 3);
    expect(env.speech.texts.some((x) => /Great!/.test(x)), 'broken recording did not fall back to the computer voice');
    console.log(`${stats.failures === before ? 'ok  ' : 'FAIL'} recorded clips and voice fallback`);
  }
}

// Plays fixed-seed games and returns every spoken line in order with the moment it starts (ms), so two builds
// can be compared line by line.
function spokenSample() {
  const out = [];
  const scenarios = [
    ['both', { mode: 'both' }],
    ['default', {}],
    ['numbers', { mode: 'numbers' }],
    ['lower, whole alphabet', { letters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', letterCase: 'lower' }],
    ['look-alikes, both cases', { letters: 'BDPQMWNUOIL', numbers: '6901', mode: 'both', letterCase: 'both' }],
    ['two items', { letters: 'AB' }]
  ];
  scenarios.forEach(([name, s], n) => {
    const { bpp, speech, advance } = makeEnv({ rand: mulberry(7 + n), speech: true });
    bpp.setSettings(s);
    bpp.resize(1180, 820);
    bpp.start();
    for (let i = 0; i < 7200; i++) {
      bpp.step(1 / 60); advance(1000 / 60);
      if (i % 240 === 0 && i < 5400) {   // after 90 s nobody taps, so the prompt repeats and the hint shows
        const st = bpp.state();
        const live = st.bubbles.filter(bpp.isLive);
        const tb = live.find((b) => b.key === st.target.key);
        const wrong = live.find((b) => b.key !== st.target.key);
        const pick = (i / 240) % 3 === 1 ? wrong : tb;
        if (pick) { const p = bpp.pos(pick); bpp.tap(p.x, Math.min(p.y, st.H - 1)); }
      }
      if (i === 3000) bpp.resize(820, 1180);
    }
    out.push('# ' + name);
    speech.texts.forEach((t, i) => out.push(Math.round(speech.times[i]) + ' ' + t));
  });
  return out.join('\n') + '\n';
}
