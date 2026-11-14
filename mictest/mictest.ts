/* The microphone test page (Milestone 6, step 2). Checks, from the home-screen icon, that recording works and that
   the game's sound is the same afterwards, before the Recordings screen is built. Uses the game's own sound code
   (src/sound.ts) and voice (src/speech.ts). Published at .../mictest/, not linked from the game, not saved for
   offline use. Answers are kept in this page's own localStorage, so closing the app between tests loses nothing.
   Throwaway: deleted at the end of Milestone 6. */
import { audioCtx, ensureAudio, master, playFanfare, playPop } from '../src/sound';
import { initSpeech, say, stopSpeech } from '../src/speech';
import {
  VARIANTS, audioSessionType, canRecord, checkIndexedDB, checkPersist, chimeWav, isStandalone, makeZip, micPermission,
  readZip, recordTake, supportedFormats, touchMic, versionFromBrowser, type Take, type Variant
} from './checks';

type Answer = 'same' | 'quieter' | 'earpiece' | 'none';
interface Run extends Omit<Take, 'blob'> {
  when: string;
  session: string;             // which opening of the page recorded it
  standalone: boolean;
  cleanStart: boolean;         // the app was opened fresh for this test
  sizeKB: number;
  seconds: number;
  decodes: string;
  sounds?: Answer;
  voice?: Answer;
  dotGone?: 'yes' | 'no';
}
interface Saved {
  version?: string;
  lastRunSession?: string;
  runs: Partial<Record<Variant, Run>>;
  prompt?: { before: string; result: string; answer?: 'asked' | 'not' };
  extras?: { idb: string; persist: string; persisted: string; free: string; share?: string; load?: string; token?: string };
}

const KEY = 'bubblePopParty.mictest.v1';
const SESSION = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);   // this opening of the page
const RECORD_MS = 4000;
const SAY = 'Can you find the letter B?';

function load(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null') as Saved | null;
    if (s && typeof s === 'object' && s.runs && typeof s.runs === 'object') return s;
  } catch { /* fresh start */ }
  return { runs: {} };
}
let saved = load();
function save(): void { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* shown on the results screen */ } }

/* ---- what is on screen ---- */
type View = 'home' | 'version' | 'run' | 'prompt' | 'extras' | 'results';
let view: View = 'home';
let variant: Variant = 'A';
let beforePlayed = false, afterPlayed = false, recording = false, confirmReset = false;
let notFresh = false;                 // a test was already done since this opening, when this test's screen opened
let stopRecording: (() => void) | null = null;
let level = 0, recordEnds = 0;

const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;
const esc = (s: unknown): string => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
const btn = (act: string, label: string, opts: { val?: string; sel?: boolean; off?: boolean; big?: boolean } = {}): string =>
  `<button type="button" data-act="${act}"${opts.val !== undefined ? ` data-val="${esc(opts.val)}"` : ''} class="${opts.sel ? 'sel' : ''}${opts.big ? ' big' : ''}"${opts.off ? ' disabled' : ''}>${label}</button>`;
const back = (): string => `<p>${btn('home', '‹ Back to the list')}</p>`;
const tick = (done: boolean): string => (done ? '<b class="ok">✓</b> ' : '');

function homeView(): string {
  const sa = isStandalone();
  const run = (v: Variant): boolean => { const r = saved.runs[v]; return !!(r && r.sounds && r.voice && r.dotGone); };
  return `<h1>Mic test</h1>
  <p class="status ${sa ? 'ok' : 'check'}">Opened from the home-screen icon: ${sa ? 'YES' : 'NO'}</p>
  ${sa ? '' : `<ol class="steps"><li>Tap the Share button (the square with an arrow) at the top of Safari.</li>
    <li>Tap <b>Add to Home Screen</b>, then <b>Add</b>.</li><li>Close Safari, and open <b>Mic test</b> from the home screen
    (the pink bubble with an <b>M</b>).</li></ol>`}
  <p>Do the steps in order. <b>Before each of tests A to D, close Mic test fully</b> (swipe up from the bottom, then push it
    away) and open it again from its icon. Turn the volume up to about half, and take any headphones off.</p>
  <div class="list">
    ${btn('go-version', tick(!!saved.version) + '1. iPad version')}
    ${(['A', 'B', 'C', 'D'] as Variant[]).map((v, i) => btn('go-run', tick(run(v)) + `${i + 2}. Test ${v}: ${VARIANTS[v].title}`, { val: v })).join('')}
    ${btn('go-prompt', tick(!!saved.prompt?.answer) + '6. Does it ask for the microphone again?')}
    ${btn('go-extras', tick(!!saved.extras?.load) + '7. Storage and sharing')}
    ${btn('go-results', 'Results', { big: true })}
  </div>
  <p class="small">${confirmReset ? btn('reset-yes', 'Yes, forget all answers') + btn('reset-no', 'Keep them') : btn('reset', 'Start over')}</p>`;
}

function versionView(): string {
  const fromBrowser = versionFromBrowser();
  const choices = ['17 or older', '18.0', '18.1', '18.2', '18.3', '18.4', '18.5', '18.6', '18.7', 'Other'];
  return `<h1>1. iPad version</h1>
  <p>The browser reports: <b>${esc(fromBrowser || 'nothing (normal for home-screen apps)')}</b></p>
  <p>Open the <b>Settings</b> app, then <b>General</b>, then <b>About</b>, and tap the number shown next to
    <b>iPadOS Version</b>:</p>
  <p>${choices.map((c) => btn('version', c, { val: c, sel: saved.version === c })).join('')}</p>${back()}`;
}

const ANSWERS: [Answer, string][] = [['same', 'Same as before'], ['quieter', 'Quieter'], ['earpiece', 'From the earpiece (top)'], ['none', 'No sound']];
function answerRow(field: 'sounds' | 'voice', r: Run | undefined): string {
  return ANSWERS.map(([a, label]) => btn('answer', label, { val: field + ':' + a, sel: r?.[field] === a, off: !afterPlayed })).join('');
}

function runView(): string {
  const r = saved.runs[variant];
  if (recording) {
    const left = Math.max(0, Math.ceil((recordEnds - performance.now()) / 1000));
    return `<h1>Recording… <span class="dot">●</span></h1>
    <p class="say">Say: “${SAY}”</p>
    <p>${left} s left</p>
    ${variant === 'D' ? `<div class="meter"><div style="width:${Math.min(100, Math.round(level * 400))}%"></div></div>` : ''}
    <p>${btn('stop', 'Stop', { big: true })}</p>`;
  }
  const take = r && r.session === SESSION ? r : undefined;
  return `<h1>Test ${variant}: ${VARIANTS[variant].title}</h1>
  <p>${VARIANTS[variant].detail}</p>
  ${notFresh ? '<p class="status check">You already did a test since opening Mic test. For a fair test, close it fully and open it again first.</p>' : ''}
  ${canRecord() ? '' : '<p class="status check">This browser can\'t record (no MediaRecorder or microphone access).</p>'}
  <h2>Step 1. Before</h2>
  <p>Tap and listen: a pop, a ta-da, a chime, then the computer voice. Notice how loud they are, and that they come from
    the speakers at the sides.</p>
  <p>${btn('sounds-before', 'Play test sounds', { sel: beforePlayed })}</p>
  <h2>Step 2. Record</h2>
  <p>Tap Record and say “${SAY}”. It stops by itself after ${RECORD_MS / 1000} seconds, then plays your recording back.</p>
  <p>${btn('record', 'Record', { off: !beforePlayed || !canRecord(), big: true })}</p>
  ${take ? `<p class="measured">${take.error ? `<b class="check">Problem: ${esc(take.error)}</b><br>${micHelp(take.error)}` :
    `Recorded ${esc(take.mimeType || '?')} · ${take.seconds.toFixed(1)} s · ${take.sizeKB} KB · plays back: ${esc(take.decodes)}<br>
    Microphone: ${esc(take.trackSettings)} · still on after: ${take.liveAfter}<br>
    Sound system: ${take.rateBefore} → ${take.rateDuring} → ${take.rateAfterRelease} Hz, ${esc(take.stateAfterRelease)}
    · audio session: ${esc(take.sessionBefore)} → ${esc(take.sessionDuring)} → ${esc(take.sessionAfter)}
    ${variant === 'D' ? `· meter heard: ${take.meterPeak > 0.01 ? 'yes' : 'NO'}` : ''}`}</p>` : ''}
  <h2>Step 3. After</h2>
  <p>${btn('sounds-after', 'Play test sounds again', { off: !take || !!take.error, sel: afterPlayed })}</p>
  <p>Game sounds (pop, ta-da, chime) now:<br>${answerRow('sounds', take)}</p>
  <p>Computer voice now:<br>${answerRow('voice', take)}</p>
  <p>Is the orange microphone dot at the top of the screen gone?<br>
    ${btn('answer', 'Yes, gone', { val: 'dotGone:yes', sel: take?.dotGone === 'yes', off: !take })}
    ${btn('answer', 'No, still there', { val: 'dotGone:no', sel: take?.dotGone === 'no', off: !take })}</p>
  ${take && take.sounds && take.voice && take.dotGone ? '<p class="status ok">Saved. Now close Mic test fully and open it again for the next test.</p>' : ''}
  ${back()}`;
}

function micHelp(err: string): string {
  return /NotAllowed|denied/i.test(err)
    ? 'The microphone was not allowed. To allow it: Settings app, Apps, Safari, Microphone, Allow. Then close Mic test fully and try again.'
    : '';
}

function promptView(): string {
  const p = saved.prompt;
  return `<h1>6. Does it ask again?</h1>
  <p>Close Mic test fully, open it again from its icon, come back to this step, and tap the button. Did the iPad
    ask to use the microphone?</p>
  <p>${btn('touch-mic', 'Use the microphone once', { big: true })}</p>
  ${p ? `<p class="measured">Permission before: ${esc(p.before)} · result: ${esc(p.result)}</p>
  <p>${btn('prompt', 'It asked again', { val: 'asked', sel: p.answer === 'asked' })}${btn('prompt', 'It didn\'t ask', { val: 'not', sel: p.answer === 'not' })}</p>` : ''}
  ${back()}`;
}

function extrasView(): string {
  const x = saved.extras;
  return `<h1>7. Storage and sharing</h1>
  <p>${btn('storage', 'Check storage')}</p>
  ${x ? `<p class="measured">Saving a recording-sized file: ${esc(x.idb)} · keep safe (persist): ${esc(x.persist)} ·
    kept safe now: ${esc(x.persisted)} · free: ${esc(x.free)}</p>` : ''}
  <p>Tap <b>Share a test file</b>, choose <b>Save to Files</b>, and save it anywhere. Then tap <b>Load a test file</b>
    and pick the file you just saved (it's called “Mic test file”).</p>
  <p>${btn('share', 'Share a test file', { off: !x })}${btn('load', 'Load a test file', { off: !x?.share })}</p>
  ${x?.share ? `<p class="measured">Share: ${esc(x.share)}${x.load ? ' · load back: ' + esc(x.load) : ''}</p>` : ''}
  <input type="file" id="fileIn" hidden>
  ${back()}`;
}

/* ---- results: one screen, large text, so a screenshot records everything ---- */
function line(ok: boolean | null, text: string): string {
  const mark = ok === null ? '<span class="mark none">–</span>' : ok ? '<span class="mark ok">OK</span>' : '<span class="mark check">Check</span>';
  return `<div class="line">${mark}<span>${text}</span></div>`;
}
const WORD: Record<Answer, string> = { same: 'same', quieter: 'QUIETER', earpiece: 'EARPIECE', none: 'NO SOUND' };
function resultsView(): string {
  const runs = (['A', 'B', 'C', 'D'] as Variant[]).map((v) => [v, saved.runs[v]] as const);
  const first = runs.map(([, r]) => r).find((r) => r && !r.error && r.mimeType);
  const out: string[] = [];
  const browser = versionFromBrowser();
  out.push(line(saved.version ? /^18/.test(saved.version) : null,
    `iPadOS ${esc(saved.version ?? '?')}${browser ? ' (browser: ' + esc(browser) + ')' : ''} · home-screen app: ${isStandalone() ? 'yes' : 'NO'}`));
  out.push(line(first ? /mp4|aac/i.test(first.mimeType) && first.decodes === 'yes' : null, (first
    ? `Format ${esc(first.mimeType)} · ${first.seconds.toFixed(1)} s · ${first.sizeKB} KB · plays back ${esc(first.decodes)}`
    : 'Format: not recorded yet') + ' · can record: ' + esc(supportedFormats().replace(/audio\//g, ''))));
  for (const [v, r] of runs) {
    const name = `<b>${v}</b> ${VARIANTS[v].title}:`;
    if (!r) { out.push(line(null, `${name} not done`)); continue; }
    if (r.error) { out.push(line(false, `${name} ${esc(r.error)}`)); continue; }
    const ok = r.sounds === 'same' && r.voice === 'same' && r.dotGone === 'yes' && r.liveAfter === 0 &&
      r.rateBefore === r.rateAfterRelease && r.cleanStart && r.standalone;
    const rate = r.rateBefore === r.rateDuring && r.rateDuring === r.rateAfterRelease ? `${r.rateBefore} Hz` : `${r.rateBefore}→${r.rateDuring}→${r.rateAfterRelease} Hz`;
    out.push(line(r.sounds && r.voice && r.dotGone ? ok : null,
      `${name} sounds ${r.sounds ? WORD[r.sounds] : '?'} · voice ${r.voice ? WORD[r.voice] : '?'} · ` +
      `dot ${r.dotGone === 'yes' ? 'gone' : r.dotGone === 'no' ? 'STAYED' : '?'} · ${rate}` +
      (r.liveAfter ? ` · MIC STILL ON (${r.liveAfter})` : '') + (r.cleanStart ? '' : ' · NOT FRESH') + (r.standalone ? '' : ' · IN SAFARI') +
      (v === 'C' ? ` · session ${esc(r.sessionBefore)}→${esc(r.sessionDuring)}→${esc(r.sessionAfter)}` : '') +
      (v === 'D' ? ` · meter ${r.meterPeak > 0.01 ? 'heard' : 'SILENT'}` : '')));
  }
  const p = saved.prompt;
  out.push(line(p?.answer ? p.answer === 'not' : null, `Asks for the mic again after reopening: ${p?.answer === 'asked' ? 'YES' : p?.answer === 'not' ? 'no' : '?'}${p ? ' (' + esc(p.before) + ')' : ''}`));
  const x = saved.extras;
  out.push(line(x ? x.idb === 'ok' : null, x ? `Storage ${esc(x.idb)} · persist ${esc(x.persist)} · ${esc(x.free)} free` : 'Storage: not checked'));
  out.push(line(x?.load ? x.share === 'yes' && x.load === 'yes' : null, `Share a .zip: ${esc(x?.share ?? '?')} · load it back: ${esc(x?.load ?? '?')}`));
  const mic = runs.map(([v, r]) => (r && !r.error ? `${v}: ${esc(r.trackSettings)}` : '')).filter(Boolean);
  return `<div id="results">${out.join('')}</div>
  <p class="ua">Mic: ${mic.join(' · ') || '?'} · audio session now: ${esc(audioSessionType())}<br>${esc(navigator.userAgent)}</p>${back()}`;
}

function render(): void {
  const main = $('main');
  main.innerHTML = view === 'version' ? versionView() : view === 'run' ? runView() : view === 'prompt' ? promptView()
    : view === 'extras' ? extrasView() : view === 'results' ? resultsView() : homeView();
  document.documentElement.classList.toggle('results', view === 'results');
  const fileIn = document.getElementById('fileIn') as HTMLInputElement | null;
  if (fileIn) fileIn.addEventListener('change', () => { void loadFile(fileIn); });
}

/* ---- sounds ---- */
let chime: AudioBuffer | null = null;
function decode(data: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((ok, no) => {
    if (!audioCtx) { no(new Error('no sound system')); return; }
    audioCtx.decodeAudioData(data, ok, (e) => { no(e ?? new Error('decode failed')); });
  });
}
function playBuffer(b: AudioBuffer): void {
  if (!audioCtx || !master) return;
  if (audioCtx.state !== 'running') void audioCtx.resume();
  const s = audioCtx.createBufferSource();
  s.buffer = b;
  s.connect(master);
  s.start(0);
}
/* The game's pop and ta-da, a decoded clip (the way recordings play), then the computer voice. */
function playTestSounds(): void {
  stopSpeech();
  ensureAudio();
  playPop();
  setTimeout(playFanfare, 600);
  setTimeout(() => {
    if (chime) { playBuffer(chime); return; }
    decode(chimeWav()).then((b) => { chime = b; playBuffer(b); }, () => { /* reported by the recording step */ });
  }, 1600);
  setTimeout(() => { say('prompt:B'); }, 2500);
}

async function record(): Promise<void> {
  if (recording) return;
  stopSpeech();
  ensureAudio();
  let meterCtx: AudioContext | null = null;
  if (variant === 'D') {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) meterCtx = new AC();      // made inside the tap, so it's allowed to run
  }
  recording = true;
  afterPlayed = false;
  recordEnds = performance.now() + RECORD_MS;
  const stopped = new Promise<void>((ok) => { stopRecording = ok; });
  const ticker = setInterval(render, 250);
  render();
  const cleanStart = saved.lastRunSession !== SESSION;
  const take = await recordTake(variant, RECORD_MS, { stopped, meterCtx, level: (v) => { level = v; } });
  clearInterval(ticker);
  recording = false;
  stopRecording = null;
  const { blob, ...measured } = take;
  const run: Run = { ...measured, when: new Date().toISOString(), session: SESSION, standalone: isStandalone(), cleanStart, sizeKB: 0, seconds: 0, decodes: 'no' };
  if (blob && !take.error) {
    run.sizeKB = Math.round(blob.size / 1024);
    try {
      const b = await decode(await blob.arrayBuffer());
      run.seconds = b.duration;
      run.decodes = 'yes';
      playBuffer(b);
    } catch (e) { run.decodes = 'no (' + String(e) + ')'; }
  }
  saved.runs[variant] = run;
  saved.lastRunSession = SESSION;
  save();
  render();
}

async function storage(): Promise<void> {
  const idb = await checkIndexedDB();
  const p = await checkPersist();
  saved.extras = { ...saved.extras, idb, ...p };
  save();
  render();
}

async function share(): Promise<void> {
  const token = Math.random().toString(36).slice(2, 10);
  const zip = makeZip('mic-test.txt', 'Bubble Pop mic test ' + token);
  const file = new File([zip], 'Mic test file.zip', { type: 'application/zip' });
  const x = saved.extras ?? { idb: '?', persist: '?', persisted: '?', free: '?' };
  try {
    if (!navigator.canShare || !navigator.canShare({ files: [file] })) x.share = 'not supported';
    else { await navigator.share({ files: [file], title: 'Mic test file' }); x.share = 'yes'; x.token = token; }
  } catch (e) {
    x.share = e instanceof Error && e.name === 'AbortError' ? 'cancelled' : String(e);
  }
  saved.extras = x;
  save();
  render();
}

async function loadFile(input: HTMLInputElement): Promise<void> {
  const f = input.files?.[0];
  if (!f || !saved.extras) return;
  try {
    const z = readZip(new Uint8Array(await f.arrayBuffer()));
    saved.extras.load = !z ? 'not readable' : z.text.endsWith(saved.extras.token ?? '-') ? 'yes' : 'a different file';
  } catch (e) { saved.extras.load = String(e); }
  save();
  render();
}

/* ---- taps ---- */
document.addEventListener('click', (e) => {
  const b = (e.target as Element | null)?.closest?.('[data-act]');
  if (!b || (b as HTMLButtonElement).disabled) return;
  const act = b.getAttribute('data-act') ?? '';
  const val = b.getAttribute('data-val') ?? '';
  switch (act) {
    case 'home': stopSpeech(); view = 'home'; break;
    case 'go-version': view = 'version'; break;
    case 'go-run': variant = val as Variant; view = 'run'; notFresh = saved.lastRunSession === SESSION; beforePlayed = false; afterPlayed = false; break;
    case 'go-prompt': view = 'prompt'; break;
    case 'go-extras': view = 'extras'; break;
    case 'go-results': view = 'results'; break;
    case 'version': saved.version = val; save(); break;
    case 'sounds-before': playTestSounds(); beforePlayed = true; break;
    case 'record': void record(); return;
    case 'stop': if (stopRecording) stopRecording(); return;
    case 'sounds-after': playTestSounds(); afterPlayed = true; break;
    case 'answer': {
      const r = saved.runs[variant];
      const [field, a] = val.split(':');
      if (r && field === 'dotGone') r.dotGone = a as 'yes' | 'no';
      else if (r && (field === 'sounds' || field === 'voice')) r[field] = a as Answer;
      save();
      break;
    }
    case 'touch-mic':
      void micPermission().then(async (before) => {
        const result = await touchMic();
        saved.prompt = { before, result };
        save();
        render();
      });
      return;
    case 'prompt': if (saved.prompt) { saved.prompt.answer = val as 'asked' | 'not'; save(); } break;
    case 'storage': void storage(); return;
    case 'share': void share(); return;
    case 'load': ($('fileIn') as HTMLInputElement).click(); return;
    case 'reset': confirmReset = true; break;
    case 'reset-no': confirmReset = false; break;
    case 'reset-yes': saved = { runs: {} }; save(); confirmReset = false; break;
  }
  render();
});
document.addEventListener('visibilitychange', () => { if (document.hidden && stopRecording) stopRecording(); });

initSpeech();
render();
