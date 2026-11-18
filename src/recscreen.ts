/* The Recordings screen and the recording panel, inside the parent area (after the gate, from Settings). Record,
   play, re-record and delete each spoken clip. Only one thing at a time: nothing plays while recording, and the
   buttons are disabled while a take is recording or saving. See docs/specs/m06-recordings.md, section 2. */
import { allClips, clipByName, clipsFor, type Clip } from './clips';
import { els, restartAnimation } from './dom';
import { analyse, mixToMono } from './level';
import { RECORD_LIMIT_MS, canRecord, cancelTake, mic, startTake, stopTake } from './mic';
import { AUDIO_OVERRIDES, own } from './recordings';
import { decodeAudio, ensureAudio, ownChanged, prepareRecording, setMuted } from './sound';
import { say, sayRecording, stopSpeech } from './speech';
import { state } from './state';
import {
  PROCESSING, askToKeep, deleteAllClips, isKept, openStore, readAll, storeStatus, writeClips, type ClipRecord
} from './store';

export const REC_IDLE_MS = 3 * 60 * 1000;      // the screen closes to the game after 3 minutes with no taps (Q5)

export const MSG = {
  refused: 'The game needs the microphone to record. To allow it: Settings app, Apps, Safari, Microphone, then Allow.',
  error: 'Something went wrong with the microphone. Try again.',
  stopped: 'Recording stopped. Try again.',
  timeout: 'The microphone question was not answered. Tap Record to try again.',
  nothing: "I didn't hear anything. Try again closer to the phone.",
  quiet: 'That was very quiet. Try again closer to the phone.',
  unreadable: "This recording couldn't be read. Try again.",
  full: "There's no room to save this recording. Save a backup file, then delete some recordings or free up space on this device.",
  notSaved: "The recording couldn't be saved. Any earlier recording is kept.",
  damaged: 'This recording is damaged. Re-record or delete it.',
  words: 'The words for this clip have changed. Please re-record.',
  blocked: "This device isn't letting the game save recordings.",
  noMic: "This browser can't record. You can still load a recordings file, or use the audio folder (AUDIO-GUIDE).",
  safari: "You're in Safari. Recordings made here stay in Safari. To record for the home-screen game, open it from its icon.",
  asking: 'Tap Allow to let the game use the microphone',
  recording: 'Recording… tap Stop when you have finished.',
  saving: 'Saving…'
} as const;

type Confirm = { kind: 'delete'; clip: string } | { kind: 'deleteAll' } | null;
export type TakePhase = 'asking' | 'recording' | 'saving';

export const rs = {
  open: false,
  loaded: false,
  showAll: false,
  records: new Map<string, ClipRecord>(),
  damaged: new Set<string>(),
  busy: false,                                   // a take is recording or saving, or a delete or load is running
  take: null as { clip: string; phase: TakePhase } | null,
  confirm: null as Confirm,
  rowNote: null as { clip: string; text: string } | null,
  notice: '',                                    // a message for the whole screen (backup, delete all)
  kept: null as boolean | null
};
let idleTimer: ReturnType<typeof setTimeout> | 0 = 0;
let onIdle: () => void = () => {};
let isSettingsOpen: () => boolean = () => false;
let afterRender: () => string = () => '';      // the backup section, added by backup.ts

/* ---- What each row shows ---- */
export type RowState = 'own' | 'damaged' | 'words' | 'file' | 'voice';
export function rowState(name: string): RowState {
  if (rs.damaged.has(name)) return 'damaged';
  const r = rs.records.get(name);
  if (r) return r.words === clipByName(name)?.script ? 'own' : 'words';
  return AUDIO_OVERRIDES[name] ? 'file' : 'voice';
}
const LABEL: Record<RowState, string> = {
  own: '● Your voice', damaged: '⚠ Damaged', words: '⚠ Words changed', file: '◐ Audio file', voice: '○ Computer voice'
};
export function storageWorks(): boolean { return storeStatus === 'ok'; }

export function counts(): { current: number; currentTotal: number; all: number; bytes: number } {
  const current = clipsFor(state.settings);
  let bytes = 0;
  for (const r of rs.records.values()) bytes += r.audio.byteLength;
  const good = (c: Clip): boolean => rowState(c.name) === 'own';
  return { current: current.filter(good).length, currentTotal: current.length, all: allClips().filter(good).length, bytes };
}

/* The line in Settings: "5 of 17 recorded in your voice." From the list read at start-up. */
export function summaryText(): string {
  const current = clipsFor(state.settings);
  const n = current.filter((c) => own.saved.has(c.name) && !own.problems[c.name]).length;
  return n + ' of ' + current.length + ' recorded in your voice.';
}

export function isStandalone(): boolean {
  try {
    if ((navigator as unknown as { standalone?: boolean }).standalone === true) return true;
    return typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches;
  } catch { return false; }
}

/* ---- Drawing the screen ---- */
function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}
function btn(act: string, label: string, clip = '', cls = ''): string {
  const off = rs.busy ? ' disabled' : '';
  return '<button type="button" class="opt ' + cls + '" data-rec="' + act + '" data-clip="' + esc(clip) + '"' + off + '>' + label + '</button>';
}

/* The buttons on one row, by action. */
export function rowButtons(name: string): string[] {
  if (rs.confirm?.kind === 'delete' && rs.confirm.clip === name) return ['delete-yes', 'delete-no'];
  const st = rowState(name);
  const rec = storageWorks() && canRecord();
  if (st === 'own' || st === 'damaged' || st === 'words') return rec ? ['play', 'record', 'delete'] : ['play', 'delete'];
  return rec ? ['play', 'record'] : ['play'];
}
const BUTTON: Record<string, [string, string]> = {
  'play': ['Play', ''], 'record': ['Record', 'go'], 'delete': ['Delete', ''], 'delete-yes': ['Delete', 'warn'], 'delete-no': ['Keep', '']
};

function rowHtml(c: Clip): string {
  const st = rowState(c.name);
  const has = st === 'own' || st === 'damaged' || st === 'words';
  let buttons = rs.confirm?.kind === 'delete' && rs.confirm.clip === c.name
    ? '<span class="ask">Delete your recording of “' + esc(c.script) + '”?</span>' : '';
  for (const act of rowButtons(c.name)) {
    const [label, cls] = BUTTON[act] ?? [act, ''];
    buttons += btn(act, act === 'record' && has ? 'Re-record' : label, c.name, act === 'record' && has ? '' : cls);
  }
  const note = st === 'damaged' ? MSG.damaged : st === 'words' ? MSG.words : '';
  const extra = rs.rowNote?.clip === c.name ? rs.rowNote.text : '';
  return '<div class="recRow" data-row="' + esc(c.name) + '"><p class="words">“' + esc(c.script) + '”</p>' +
    '<p class="src ' + st + '">' + LABEL[st] + '</p><div class="seg">' + buttons + '</div>' +
    (note ? '<p class="note bad">' + note + '</p>' : '') + (extra ? '<p class="note say">' + esc(extra) + '</p>' : '') + '</div>';
}

export function render(): void {
  if (!rs.open) return;
  if (!rs.loaded) { els.recBody.innerHTML = '<p>Loading…</p>'; return; }
  const n = counts();
  let h = '<p class="big">' + n.current + ' of ' + n.currentTotal + ' recorded for the letters and numbers you play.</p>' +
    '<div class="seg"><p>' + n.all + ' recorded in all.</p>' +
    btn('show-all', rs.showAll ? 'Show only the ones you play' : 'Show every letter and number') + '</div>' +
    '<p class="note">Say the letter NAME (“bee”), not its sound (“buh”).</p>';
  if (!storageWorks()) h += '<p class="note bad">' + MSG.blocked + '</p>';
  else if (!canRecord()) h += '<p class="note bad">' + MSG.noMic + '</p>';
  if (!isStandalone()) h += '<p class="note">' + MSG.safari + '</p>';
  if (rs.notice) h += '<p class="note say">' + esc(rs.notice) + '</p>';
  let group = '';
  for (const c of rs.showAll ? allClips() : clipsFor(state.settings)) {
    if (c.group !== group) { group = c.group; h += '<h3>' + esc(group) + '</h3>'; }
    h += rowHtml(c);
  }
  h += afterRender();
  if (n.all) {
    h += '<h3>Delete all</h3>';
    h += rs.confirm?.kind === 'deleteAll'
      ? '<p class="ask">Delete all ' + n.all + ' recordings from this device? Save a backup file first if you might want them again.</p>' +
        '<div class="seg">' + btn('delete-all-yes', 'Delete all', '', 'warn') + btn('delete-all-no', 'Keep them') + '</div>'
      : '<div class="seg">' + btn('delete-all', 'Delete all recordings', '', 'warn') + '</div>';
  }
  if (rs.kept !== null) h += '<p class="note">Kept safe from automatic clearing: ' + (rs.kept ? 'Yes' : 'No: save a backup file now and then') + '</p>';
  h += '<p class="note">Recordings use ' + (n.bytes / 1048576).toFixed(1) + ' MB on this device.</p>';
  els.recBody.innerHTML = h;
}

/* ---- The recording panel ---- */
function showTake(): void {
  const t = rs.take;
  els.recTake.classList.toggle('hidden', !t);
  if (!t) return;
  els.takeWords.textContent = clipByName(t.clip)?.script ?? '';
  els.takeStatus.textContent = t.phase === 'asking' ? MSG.asking : t.phase === 'recording' ? MSG.recording : MSG.saving;
  els.takeRing.classList.toggle('hidden', t.phase === 'asking');
  els.takeStop.classList.toggle('hidden', t.phase !== 'recording');
  if (t.phase === 'recording') {
    els.takeRing.style.setProperty('--take-ms', RECORD_LIMIT_MS + 'ms');
    restartAnimation(els.takeRing, 'go');      // the ring fills over the length limit, from the start of recording
  } else els.takeRing.classList.remove('go');
}

/* ---- Opening and closing ---- */
export async function reload(): Promise<void> {
  const all = await readAll();
  rs.records = all.records;
  rs.damaged = all.damaged;
  rs.kept = storageWorks() ? await isKept() : null;
  rs.loaded = true;
  render();
}

export function openRecordings(): void {
  if (!isSettingsOpen() || rs.open) return;      // only from Settings, which only opens after the gate
  rs.open = true;
  rs.loaded = false;
  rs.confirm = null; rs.rowNote = null; rs.notice = '';
  els.panel.classList.add('hidden');
  els.recPanel.classList.remove('hidden');
  els.recPanel.scrollTop = 0;
  touched();
  render();
  void openStore().then(reload);
}

/* Back to settings, Done, the idle close and the app going to the background all end here. */
export function closeRecordings(): void {
  stopSpeech();
  cancelTake();
  clearTimeout(idleTimer);
  if (!rs.open) return;
  rs.open = false;
  rs.take = null;
  rs.busy = false;
  showTake();
  els.recPanel.classList.add('hidden');
  els.panel.classList.remove('hidden');
  els.recSummary.textContent = summaryText();
}

export function touched(): void {
  clearTimeout(idleTimer);
  if (rs.open) idleTimer = setTimeout(() => { onIdle(); }, REC_IDLE_MS);
}

/* The app went to the background: a take still recording is cancelled, the old recording kept. */
export function appHidden(): void {
  stopSpeech();
  if (rs.take && mic.phase !== 'idle') { rs.rowNote = { clip: rs.take.clip, text: MSG.stopped }; }
  cancelTake();
}

/* ---- Play, record, delete ---- */
export async function play(name: string): Promise<void> {
  if (!rs.open || rs.busy || !clipByName(name)) return;
  if (state.muted) setMuted(false);              // the parent wants to hear it
  ensureAudio();
  const r = rowState(name) === 'own' ? rs.records.get(name) : undefined;
  if (!r) { say(name); return; }                 // what the game would use: the audio file or the computer voice
  stopSpeech();
  const buf = own.buffers[name] ?? await prepareRecording(r);
  if (buf && rs.open && !rs.busy) sayRecording(buf);
}

export async function record(name: string): Promise<void> {
  const clip = clipByName(name);
  if (!rs.open || rs.busy || !clip || !storageWorks() || !canRecord()) return;
  stopSpeech();                                   // the game's voice must never be recorded
  ensureAudio();                                  // inside the tap: the sound system is ready for the playback after
  rs.busy = true; rs.confirm = null; rs.rowNote = null;
  rs.take = { clip: name, phase: 'asking' };
  render(); showTake();
  const result = await startTake(() => { if (rs.take) { rs.take.phase = 'recording'; showTake(); } });
  const note = (text: string): void => { rs.rowNote = { clip: name, text }; };
  if (result.kind === 'take') {
    if (rs.take) { rs.take.phase = 'saving'; showTake(); }
    let saved: AudioBuffer | null = null;
    try {
      const decoded = await decodeAudio(result.data.slice(0));
      const chans: Float32Array[] = [];
      for (let i = 0; i < decoded.numberOfChannels; i++) chans.push(decoded.getChannelData(i));
      const a = analyse(mixToMono(chans), decoded.sampleRate);
      if (!a.heard) note(MSG.nothing);
      else {
        const rec: ClipRecord = {
          clip: name, audio: result.data, type: result.type, words: clip.script, trimStart: a.trimStart, trimEnd: a.trimEnd,
          gain: a.gain, recordedAt: new Date().toISOString(), processing: PROCESSING
        };
        const w = await writeClips([rec]);       // the old take is only replaced once the new one is saved
        if (w === 'ok') {
          askToKeep();
          rs.records.set(name, rec);
          rs.damaged.delete(name);
          saved = await prepareRecording(rec);
          ownChanged(name, saved);
          if (a.quiet) note(MSG.quiet);
        } else note(w === 'full' ? MSG.full : MSG.notSaved);
      }
    } catch { note(MSG.unreadable); }
    rs.take = null; rs.busy = false;
    showTake();
    if (rs.open) {
      if (saved) sayRecording(saved);             // played back once (Q8)
      if (rs.kept === false || rs.kept === null) rs.kept = await isKept();
      render();
    }
    return;
  }
  if (result.kind === 'refused') note(MSG.refused);
  else if (result.kind === 'error') note(MSG.error);
  else if (result.kind === 'timeout') note(MSG.timeout);
  else if (result.kind === 'cancelled' && !rs.rowNote) note(MSG.stopped);
  rs.take = null; rs.busy = false;
  showTake();
  render();
}

async function deleteOne(name: string): Promise<void> {
  if (!rs.open || rs.busy) return;
  stopSpeech();
  rs.busy = true; rs.confirm = null;
  const w = await writeClips([], [name]);
  rs.busy = false;
  if (w === 'ok') { rs.records.delete(name); rs.damaged.delete(name); ownChanged(name, null); rs.rowNote = null; }
  else rs.rowNote = { clip: name, text: "The recording couldn't be deleted. Try again." };
  render();
}

async function deleteEverything(): Promise<void> {
  if (!rs.open || rs.busy) return;
  stopSpeech();
  rs.busy = true; rs.confirm = null;
  const w = await deleteAllClips();
  rs.busy = false;
  if (w === 'ok') {
    for (const n of [...rs.records.keys(), ...rs.damaged, ...own.saved]) ownChanged(n, null);
    rs.records.clear(); rs.damaged.clear();
    rs.notice = 'All recordings were deleted from this device.';
  } else rs.notice = "The recordings couldn't be deleted. Try again.";
  render();
}

/* One tap on the screen. The tests call this too. */
export function recAction(act: string, clip = ''): void {
  touched();
  if (!rs.open) return;
  switch (act) {
    case 'play': void play(clip); return;
    case 'record': void record(clip); return;
    case 'stop': stopTake(); return;
    case 'delete': if (!rs.busy) { stopSpeech(); rs.confirm = { kind: 'delete', clip }; } break;
    case 'delete-yes': void deleteOne(clip); return;
    case 'delete-all': if (!rs.busy) rs.confirm = { kind: 'deleteAll' }; break;
    case 'delete-all-yes': void deleteEverything(); return;
    case 'delete-no': case 'delete-all-no': rs.confirm = null; break;
    case 'show-all': if (!rs.busy) rs.showAll = !rs.showAll; break;
  }
  render();
}

/* Connects the screen's buttons. extra() draws the backup section (backup.ts). */
export function wireRecordings(opts: { settingsOpen: () => boolean; idle: () => void; back: () => void; extra: () => string; act: (a: string) => boolean }): void {
  isSettingsOpen = opts.settingsOpen;
  onIdle = opts.idle;
  afterRender = opts.extra;
  els.recOpen.addEventListener('pointerup', (e) => { e.preventDefault(); openRecordings(); });
  els.recBack.addEventListener('pointerup', (e) => { e.preventDefault(); opts.back(); });
  els.takeStop.addEventListener('pointerup', (e) => { e.preventDefault(); touched(); stopTake(); });
  els.recPanel.addEventListener('pointerdown', touched);
  els.recBody.addEventListener('pointerup', (e) => {
    const b = (e.target as Element | null)?.closest?.('[data-rec]');
    if (!b || b.hasAttribute('disabled')) return;
    e.preventDefault();
    const act = b.getAttribute('data-rec') ?? '';
    if (!opts.act(act)) recAction(act, b.getAttribute('data-clip') ?? '');
  });
}
