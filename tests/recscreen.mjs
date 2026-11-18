// The Recordings screen and the recording panel: behind the gate, record / play / re-record / delete, one line at a
// time, the microphone always let go, and the old take kept whenever a new one fails.
import { clips as list } from '../tools/clips.mjs';
import { report, stats, expect, freshGame, runFor, newIDB, flush, tick, passGate, takeSignal, UNDECODABLE } from './harness.mjs';
import { record, deviceWith } from './recordings.mjs';

// What the fake microphone "hears", by the byte its take is made of (mic.fill).
const SILENT = 1, QUIET = 2;
const decode = (b) => (b[0] === SILENT ? takeSignal({ amp: 0 }) : b[0] === QUIET ? takeSignal({ amp: 0.006, noise: 0.00001 }) : takeSignal());

// A game on the iPhone with the Recordings screen open. Pass { idb, mic } to change the device.
export async function recScreen({ idb = newIDB(), mic = {}, settings = {}, gate = true, audio = 'ok' } = {}) {
  const env = freshGame(settings, { idb, mic, webaudio: true, audio, decode });
  await flush();
  env.bpp.unlockAudio();
  if (gate) passGate(env);
  env.bpp.rec.ui.open();
  await flush(10);
  env.model = () => env.bpp.rec.ui.model();
  env.act = (a, clip) => env.bpp.rec.ui.act(a, clip);
  return env;
}
// Records one take: Record, the microphone answers, speak for `ms`, Stop, and wait for it to be saved.
export async function takeOne(env, clip, ms = 1500) {
  env.act('record', clip);
  await tick(env, 400);
  await tick(env, ms);
  env.act('stop');
  await tick(env, 100);
  await flush(10);
}
export function released(env, what) {
  expect(env.mic.live() === 0 && env.mic.recording() === 0 && env.bpp.mic.phase() === 'idle', `${what}: the microphone was not let go`);
  expect(!env.mic.session || env.mic.session.type === 'playback' || env.mic.asks === 0, `${what}: the audio session was left as "${env.mic.session?.type}"`);
  expect(!env.model().take && !env.model().busy, `${what}: the recording panel is still showing`);
}

export default async function () {
  // ---------- behind the parent gate ----------
  {
    const before = stats.failures;
    let env = await recScreen({ gate: false });
    expect(!env.model().open, 'the Recordings screen opened without passing the gate');
    env.act('record', 'prompt:A'); await tick(env, 1000);
    expect(env.mic.asks === 0, 'Record worked without passing the gate');
    env.bpp.ui.openGate();
    env.bpp.rec.ui.open();
    expect(!env.model().open, 'the Recordings screen opened from the gate before the sum was answered');
    env.bpp.ui.closeGate();
    passGate(env);
    env.bpp.rec.ui.open(); await flush(10);
    expect(env.model().open && env.model().loaded, 'the Recordings screen did not open from Settings');
    expect(env.bpp.state().paused && env.bpp.state().uiLock, 'the game was not paused while the Recordings screen was open');
    env.bpp.ui.closeSettings();
    expect(!env.model().open && !env.bpp.state().paused, 'Done did not close the Recordings screen and go back to the game');
    env.act('record', 'prompt:A'); await tick(env, 1000);
    expect(env.mic.asks === 0, 'Record worked after Settings was closed');

    // the screen: rows for the letters you play, then every letter and number
    env = await recScreen();
    let m = env.model();
    expect((m.html.match(/data-row=/g) || []).length === 17 && m.html.includes('0 of 17 recorded') && m.html.includes('0 recorded in all'),
      'the screen should list the 17 clips for A-E and say 0 of 17');
    expect(m.html.includes('“Can you find the letter A?”') && m.html.includes('Say the letter NAME'), 'the rows should show the words to say');
    env.act('show-all');
    expect((env.model().html.match(/data-row=/g) || []).length === 110, 'Show every letter and number should list all 110 clips');
    env.act('show-all');
    expect(m.html.includes("You're in Safari"), 'the separate-storage note was not shown in a Safari tab');
    expect(JSON.stringify(m.row('prompt:A').buttons) === '["play","record"]', 'a row with no recording should have Play and Record');
    report('Recordings screen: only behind the parent gate', before);
  }

  // ---------- recording one clip ----------
  {
    const before = stats.failures;
    const idb = newIDB();
    let env = await recScreen({ idb, mic: { answerAfterMs: 3000 } });
    env.act('play', 'cheer:B');                       // the computer voice is talking...
    await tick(env, 100);
    env.act('record', 'prompt:A');                    // ...Record stops it before the microphone opens
    expect(env.speech.queued.length === 0 && env.mic.asks === 1, 'Record did not stop the voice before opening the microphone');
    expect(env.model().take?.phase === 'asking' && env.model().takeStatus === 'Tap Allow to let the game use the microphone',
      'while the iPhone asks, the panel should say "Tap Allow..."');
    env.act('record', 'prompt:B'); env.act('play', 'prompt:C'); env.act('delete', 'prompt:A'); env.act('show-all');
    await tick(env, 2900);
    expect(env.mic.asks === 1 && env.speech.queued.length === 0 && !env.model().confirm && !env.model().showAll, 'buttons still worked while a take was waiting');
    await tick(env, 200);
    expect(env.model().take?.phase === 'recording' && env.model().takeShown === 'Can you find the letter A?', 'the panel did not show the words while recording');
    env.bpp.say('prompt:B');                           // nothing plays while recording, not even the game's voice
    await tick(env, 1500);
    expect(env.speech.queued.length === 0 && env.webaudio.playing === 0 && env.audio.playing.length === 0, 'something played while recording');
    env.act('stop');
    await tick(env, 100); await flush(10);
    released(env, 'after a take');
    const saved = idb.stores.get('clips')?.get('prompt:A');
    expect(saved && saved.words === 'Can you find the letter A?' && saved.type === 'audio/mp4' && saved.processing === 1 &&
      saved.gain > 1 && saved.gain <= 10 && saved.trimStart > 0.25 && saved.trimEnd < 1.8, 'the take was not saved with its words, trim and gain: ' + JSON.stringify(saved && { ...saved, audio: saved.audio.byteLength }));
    let m = env.model();
    expect(m.row('prompt:A').state === 'own' && JSON.stringify(m.row('prompt:A').buttons) === '["play","record","delete"]', 'the row should now show Your voice with Play, Re-record and Delete');
    expect(env.webaudio.played.length === 1 && env.webaudio.playing === 1, 'the new take should be played back once');
    expect(m.html.includes('1 of 17 recorded') && m.html.includes('● Your voice'), 'the count and the row were not updated');
    expect(env.bpp.rec.source('prompt:A') === 'own', 'the game does not use the new recording');
    await tick(env, 1500);

    // Play on one row stops another; the game's say() never overlaps a preview
    env.act('play', 'prompt:A'); await flush(); await tick(env, 300);
    expect(env.webaudio.playing === 1, 'Play did not play your recording');
    env.act('play', 'prompt:B'); await tick(env, 100);
    expect(env.webaudio.playing === 0 && env.speech.queued.length === 1, 'Play on another row did not stop the first');
    env.act('play', 'prompt:A'); await flush(); await tick(env, 100);
    env.bpp.rec.ui.close(); env.bpp.ui.closeSettings(); await tick(env, 2000);
    expect(env.speech.overlaps === 0, `two spoken lines played at once (${env.speech.overlaps} times)`);

    // the summary in Settings, and the recording is still there when the game is opened again
    env = await recScreen({ idb, gate: true });
    expect(env.model().summary === '1 of 17 recorded in your voice.', 'the Settings line should say 1 of 17, got ' + env.model().summary);
    expect(env.model().row('prompt:A').state === 'own', 'the recording was not there after opening the game again');
    report('recording a clip: waits for the microphone question, saves, plays back once', before);
  }

  // ---------- when a take goes wrong, the old one stays ----------
  {
    const before = stats.failures;
    const old = record('prompt:A', { recordedAt: '2026-01-01T00:00:00.000Z' });
    const cases = [
      ['nothing heard', { fill: SILENT }, null, "I didn't hear anything. Try again closer to the phone."],
      ['storage full', {}, (idb) => { idb.mode = 'full'; }, "There's no room to save this recording. Save a backup file, then delete some recordings or free up space on this device."],
      ['the save failing', {}, (idb) => { idb.failNextWrite = true; }, "The recording couldn't be saved. Any earlier recording is kept."],
      ['refused', { answer: 'refuse' }, null, 'The game needs the microphone to record. To allow it: Settings app, Apps, Safari, Microphone, then Allow.'],
      ['a microphone error', { answer: 'error' }, null, 'Something went wrong with the microphone. Try again.'],
      ['an undecodable take', { fill: UNDECODABLE }, null, "This recording couldn't be read. Try again."]
    ];
    for (const [what, mic, setup, msg] of cases) {
      const idb = deviceWith({ 'prompt:A': old });
      const env = await recScreen({ idb, mic });
      if (setup) setup(idb);
      await takeOne(env, 'prompt:A');
      expect(env.model().rowNote?.clip === 'prompt:A' && env.model().rowNote.text === msg, `${what}: the row should say "${msg}", got ${JSON.stringify(env.model().rowNote)}`);
      expect(env.model().html.includes(msg), `${what}: the message was not shown on the screen`);
      expect(idb.stores.get('clips').get('prompt:A')?.recordedAt === old.recordedAt, `${what}: the old recording was not kept`);
      expect(env.model().row('prompt:A').buttons.includes('record'), `${what}: Record is no longer available to try again`);
      released(env, what);
    }
    // a very quiet take is saved, with a note
    {
      const idb = newIDB();
      const env = await recScreen({ idb, mic: { fill: QUIET } });
      await takeOne(env, 'prompt:A');
      expect(env.model().row('prompt:A').state === 'own' && idb.stores.get('clips').get('prompt:A')?.gain === 10, 'a very quiet take should still be saved, at the capped gain');
      expect(env.model().rowNote?.text === 'That was very quiet. Try again closer to the phone.', 'a very quiet take should get a note');
    }
    report('a failed, refused, silent or unsaved take keeps the old recording', before);
  }

  // ---------- the microphone is let go on every way out ----------
  {
    const before = stats.failures;
    const ways = [
      ['Back to settings', (env) => env.bpp.rec.ui.close(), null],
      ['Done', (env) => env.bpp.ui.closeSettings(), null],
      ['the app going to the background', (env) => env.bpp.rec.ui.hidden(), 'Recording stopped. Try again.']
    ];
    for (const [what, leave, msg] of ways) {
      const idb = deviceWith({ 'prompt:A': record('prompt:A') });
      const env = await recScreen({ idb });
      env.act('record', 'prompt:A');
      await tick(env, 1500);
      expect(env.bpp.mic.phase() === 'recording', `${what}: test setup, not recording`);
      leave(env);
      await tick(env, 200); await flush(10);
      released(env, what);
      expect(idb.stores.get('clips').get('prompt:A')?.trimEnd === 1.4, `${what}: the old recording was not kept`);
      if (msg) expect(env.model().rowNote?.text === msg, `${what}: should say "${msg}"`);
      // and while it was still asking
      const env2 = await recScreen({ mic: { answerAfterMs: 4000 } });
      env2.act('record', 'prompt:A');
      await tick(env2, 1000);
      leave(env2);
      await tick(env2, 5000);
      released(env2, what + ' (while asking)');
    }
    // the question left open for 60 seconds closes the panel and lets go
    let env = await recScreen({ mic: { answer: 'never' } });
    env.act('record', 'prompt:A');
    await tick(env, 59000, 500);
    expect(env.model().take?.phase === 'asking', 'the panel closed before 60 seconds');
    await tick(env, 1500, 100);
    released(env, '60 seconds unanswered');
    expect(env.model().open, 'the Recordings screen should stay open after the microphone question timed out');
    // the idle close: 3 minutes with no taps goes back to the game
    env = await recScreen();
    env.act('show-all');
    await tick(env, env.bpp.rec.ui.idleMs - 1000, 1000);
    expect(env.model().open, 'the Recordings screen closed before 3 minutes');
    env.act('show-all');                      // a tap starts the 3 minutes again
    await tick(env, env.bpp.rec.ui.idleMs - 1000, 1000);
    expect(env.model().open, 'a tap did not reset the 3-minute close');
    await tick(env, 2000, 500);
    expect(!env.model().open && !env.bpp.state().settingsOpen && !env.bpp.state().paused, 'after 3 minutes with no taps the screen should close to the game');
    released(env, 'the idle close');
    report('the microphone is let go on every way out', before);
  }

  // ---------- delete, damaged rows, blocked storage, no microphone ----------
  {
    const before = stats.failures;
    const idb = deviceWith({
      'prompt:A': record('prompt:A'), 'cheer:A': record('cheer:A', { gain: 99 }), 'that:A': record('that:A', { words: 'Old words' }),
      'prompt:B': record('prompt:B'), 'prompt:Z': record('prompt:Z')
    });
    let env = await recScreen({ idb, settings: { letters: 'AB' } });
    await flush(10);
    let m = env.model();
    expect(m.row('cheer:A').state === 'damaged' && m.html.includes('This recording is damaged. Re-record or delete it.'), 'a damaged recording should say so on its row');
    expect(m.row('that:A').state === 'words' && m.html.includes('The words for this clip have changed. Please re-record.'), 'changed words should say so on the row');
    expect(m.html.includes('2 of 8 recorded') && m.html.includes('3 recorded in all'), 'counts should be 2 of 8 and 3 in all: ' + m.html.match(/\d+ of \d+ recorded|\d+ recorded in all/g));
    // Delete asks on the row; Keep leaves it; Delete stops it playing first, then removes it
    env.act('play', 'prompt:A'); await flush(); await tick(env, 100);
    env.act('delete', 'prompt:A');
    expect(env.webaudio.playing === 0, 'Delete did not stop the clip playing');
    m = env.model();
    expect(JSON.stringify(m.row('prompt:A').buttons) === '["delete-yes","delete-no"]' && m.html.includes('Delete your recording of “Can you find the letter A?”?'), 'Delete should ask on the row');
    env.act('delete-no', 'prompt:A');
    expect(env.model().row('prompt:A').state === 'own', 'Keep deleted it');
    env.act('delete', 'prompt:A'); env.act('delete-yes', 'prompt:A'); await flush(10);
    expect(!idb.stores.get('clips').has('prompt:A') && env.model().row('prompt:A').state === 'voice' && env.bpp.rec.source('prompt:A') === 'voice',
      'a deleted recording should fall back to the computer voice');
    env.act('delete', 'cheer:A'); env.act('delete-yes', 'cheer:A'); await flush(10);
    expect(!idb.stores.get('clips').has('cheer:A') && env.model().row('cheer:A').state === 'voice', 'a damaged recording could not be deleted');
    // Delete all, with a warning to save a backup first
    env.act('delete-all');
    expect(env.model().html.includes('Save a backup file first'), 'Delete all should say to save a backup first');
    env.act('delete-all-yes'); await flush(10);
    expect(idb.stores.get('clips').size === 0 && env.model().counts.all === 0 && env.bpp.rec.saved().length === 0, 'Delete all left recordings behind');

    // blocked storage: says so, no Record and no Load, Play still works
    env = await recScreen({ idb: newIDB('fail') });
    m = env.model();
    expect(m.html.includes("This device isn't letting the game save recordings.") && JSON.stringify(m.row('prompt:A').buttons) === '["play"]',
      'with storage blocked the screen should say so and hide Record');
    env.act('play', 'prompt:A'); await tick(env, 200);
    expect(env.speech.texts.at(-1) === 'Can you find the letter eigh?', 'Play did not work with storage blocked');
    // no microphone support
    env = freshGame({}, { idb: newIDB(), webaudio: true });
    await flush(); passGate(env); env.bpp.rec.ui.open(); await flush(10);
    m = env.bpp.rec.ui.model();
    expect(m.html.includes("This browser can't record.") && !m.row('prompt:A').buttons.includes('record'), 'without a microphone the screen should say so and hide Record');
    // from the home-screen icon: no Safari note
    env = freshGame({}, { idb: newIDB(), webaudio: true, mic: {} });
    env.context.navigator.standalone = true;
    await flush(); passGate(env); env.bpp.rec.ui.open(); await flush(10);
    expect(!env.bpp.rec.ui.model().html.includes("You're in Safari"), 'the Safari note showed in the home-screen app');
    // the game keeps working after all of it
    env.bpp.ui.closeSettings();
    runFor(env, 20);
    expect(env.bpp.check().length === 0, 'the game broke after using the Recordings screen: ' + env.bpp.check().join('; '));
    report('delete, delete all, damaged rows, blocked storage and no microphone', before);
  }
}
