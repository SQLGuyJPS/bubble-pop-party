/* Parent area: gear -> hold 3 seconds -> addition problem -> settings. Every setting is behind this gate. */
import { GATE_HOLD_MS, GATE_IDLE_MS } from './config';
import { els } from './dom';
import { pauseGame, resetBubbles, resumeGame, startNewSession } from './game';
import { sanitizeSettings, saveSettings } from './settings';
import { applyVolume, ensureAudio, setMuted } from './sound';
import { BAD_VOICES, getVoices, hasSpeech, say, stopSpeech } from './speech';
import { state } from './state';

type Timer = ReturnType<typeof setTimeout> | 0;

export const gate = { open: false, step: 'hold' as 'hold' | 'math', a: 0, b: 0, typed: '' };
let holdTimer: Timer = 0, gateIdleTimer: Timer = 0, shakeTimer: Timer = 0;
export let settingsOpen = false;
let settingsBefore = '';
let chipsBuilt = false;

function lockGame(): void {
  state.uiLock = true;
  if (state.running && !state.ended && !state.paused) pauseGame();
}
function unlockGame(): void {
  state.uiLock = false;
  if (state.running && !state.ended) resumeGame();
}
export function gateTouched(): void {
  clearTimeout(gateIdleTimer);
  gateIdleTimer = setTimeout(closeGate, GATE_IDLE_MS);
}

export function openGate(): void {
  if (gate.open || settingsOpen) return;
  gate.open = true;
  gate.step = 'hold';
  gate.typed = '';
  lockGame();
  els.gateHold.classList.remove('hidden');
  els.gateMath.classList.add('hidden');
  els.gate.classList.remove('hidden');
  gateTouched();
}

export function closeGate(): void {
  if (!gate.open) return;
  gate.open = false;
  cancelHold();
  clearTimeout(gateIdleTimer);
  els.gate.classList.add('hidden');
  if (!settingsOpen) unlockGame();
}

export function startHold(): void {           // pressing the big button: the green ring fills over 3 seconds
  if (!gate.open || gate.step !== 'hold') return;
  els.holdBtn.classList.add('holding');
  clearTimeout(holdTimer);
  holdTimer = setTimeout(holdDone, GATE_HOLD_MS);
}

export function cancelHold(): void {          // let go too early: start over
  clearTimeout(holdTimer);
  holdTimer = 0;
  els.holdBtn.classList.remove('holding');
}

function holdDone(): void {
  holdTimer = 0;
  els.holdBtn.classList.remove('holding');
  gate.step = 'math';
  newProblem();
  els.gateHold.classList.add('hidden');
  els.gateMath.classList.remove('hidden');
}

function newProblem(): void {
  gate.a = 10 + Math.floor(Math.random() * 90);   // two-digit numbers, e.g. 34 + 27
  gate.b = 10 + Math.floor(Math.random() * 90);
  gate.typed = '';
  renderProblem();
}

function renderProblem(): void {
  els.mathQ.textContent = gate.a + ' + ' + gate.b + ' = ?';
  els.mathA.textContent = gate.typed || ' ';
}

export function pressKey(k: string): void {
  if (!gate.open || gate.step !== 'math') return;
  if (k === 'back') gate.typed = gate.typed.slice(0, -1);
  else if (k === 'ok') { checkAnswer(); return; }
  else if (/^[0-9]$/.test(k) && gate.typed.length < 3) gate.typed += k;
  renderProblem();
}

function checkAnswer(): void {
  if (gate.typed !== '' && parseInt(gate.typed, 10) === gate.a + gate.b) {
    gate.open = false;
    clearTimeout(gateIdleTimer);
    els.gate.classList.add('hidden');
    openSettings();
    return;
  }
  els.mathA.classList.add('shake');   // a different problem each time, so button mashing never gets through
  clearTimeout(shakeTimer);
  shakeTimer = setTimeout(() => { els.mathA.classList.remove('shake'); }, 450);
  newProblem();
}

/* ---- Settings screen ---- */
function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}
function itemsKey(): string {
  const s = state.settings;
  return [s.mode, s.letters, s.numbers, s.letterCase].join('|');
}

function buildChips(): void {
  if (chipsBuilt) return;
  chipsBuilt = true;
  let l = '', n = '';
  for (let i = 0; i < 26; i++) {
    const c = String.fromCharCode(65 + i);
    l += '<button type="button" class="chip" data-act="toggle-letter" data-val="' + c + '">' + c + '</button>';
  }
  for (let i = 0; i < 10; i++) n += '<button type="button" class="chip" data-act="toggle-number" data-val="' + i + '">' + i + '</button>';
  els.letterChips.innerHTML = l;
  els.numberChips.innerHTML = n;
}

export function populateVoices(): void {
  if (!hasSpeech()) { els.voiceGroup.classList.add('hidden'); return; }
  els.voiceGroup.classList.remove('hidden');
  let html = '<option value="">Automatic (best available)</option>';
  for (const v of getVoices()) {
    if (!/^en/i.test(String(v.lang).replace('_', '-')) || BAD_VOICES.test(v.name)) continue;
    html += '<option value="' + esc(v.voiceURI) + '">' + esc(v.name) + ' (' + esc(v.lang) + ')</option>';
  }
  els.voiceSel.innerHTML = html;
  els.voiceSel.value = state.settings.voiceURI;
}

function isSelected(act: string | null, val: string | null): boolean {
  const s = state.settings;
  const v = val ?? '';
  switch (act) {
    case 'mode': return s.mode === v;
    case 'case': return s.letterCase === v;
    case 'speed': return s.speed === Number(v);
    case 'volume': return s.volume === Number(v);
    case 'sparkles': return s.sparkles === v;
    case 'glyph': return s.showGlyph === (v === 'show');
    case 'session': return s.sessionMinutes === Number(v);
    case 'toggle-letter': return s.letters.includes(v);
    case 'toggle-number': return s.numbers.includes(v);
    case 'letters-preset': return s.letters === v;
    case 'numbers-preset': return s.numbers === v;
  }
  return false;
}

function renderSettings(): void {
  const btns = els.panel.querySelectorAll('[data-act]');
  for (const btn of Array.from(btns)) {
    const on = isSelected(btn.getAttribute('data-act'), btn.getAttribute('data-val'));
    btn.classList.toggle('sel', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  els.letterGroup.classList.toggle('hidden', state.settings.mode === 'numbers');
  els.numberGroup.classList.toggle('hidden', state.settings.mode === 'letters');
}

function toggleIn(str: string, c: string): string {     // add or remove one item, but never empty the list
  if (str.includes(c)) return str.length > 1 ? str.replace(c, '') : str;
  return str.split('').concat(c).sort().join('');
}

/* One tap on the settings screen. Whatever arrives is checked by sanitizeSettings before it is used. */
export function doAction(act: string | null, val: string | null): void {
  const s = state.settings as unknown as Record<string, unknown>;
  const v = val ?? '';
  switch (act) {
    case 'mode': s.mode = v; break;
    case 'case': s.letterCase = v; break;
    case 'letters-preset': s.letters = v; break;
    case 'numbers-preset': s.numbers = v; break;
    case 'toggle-letter': s.letters = toggleIn(state.settings.letters, v); break;
    case 'toggle-number': s.numbers = toggleIn(state.settings.numbers, v); break;
    case 'speed': s.speed = Number(v); break;
    case 'volume': s.volume = Number(v); break;
    case 'sparkles': s.sparkles = v; break;
    case 'glyph': s.showGlyph = (v === 'show'); break;
    case 'session': s.sessionMinutes = Number(v); break;
    case 'voice': s.voiceURI = String(v); break;
  }
  state.settings = sanitizeSettings(state.settings);
  applyVolume();
  saveSettings();
  if (settingsOpen) renderSettings();
}

/* Shows which saved copy of the game is running, so a parent can tell whether an update arrived */
function showVersion(): void {
  try {
    if (typeof caches === 'undefined' || !caches.keys) { els.versionNote.textContent = ''; return; }
    caches.keys().then((names) => {
      const mine = names.filter((n) => n.indexOf('bubble-pop-party-') === 0);
      els.versionNote.textContent = mine[0] ? 'Game version: ' + mine[0].slice('bubble-pop-party-'.length) : '';
    }, () => {});
  } catch { /* the version line is optional */ }
}

export function openSettings(): void {
  settingsOpen = true;
  showVersion();
  settingsBefore = itemsKey();
  lockGame();
  buildChips();
  populateVoices();
  renderSettings();
  els.settings.classList.remove('hidden');
  els.panel.scrollTop = 0;
}

export function closeSettings(): void {
  if (!settingsOpen) return;
  settingsOpen = false;
  els.settings.classList.add('hidden');
  saveSettings();
  stopSpeech();
  state.uiLock = false;
  if (state.ended) { startNewSession(); return; }        // after the goodbye screen, a parent starts a new session
  if (state.running) {
    if (itemsKey() !== settingsBefore) resetBubbles();   // different letters or numbers: fresh bubbles
    resumeGame();
  }
}

export function hearVoice(): void {
  if (state.muted) setMuted(false);       // they want to hear it
  ensureAudio();
  say('voicetest');
}

/* Connects the parent area's buttons. */
export function wireParent(): void {
  els.gear.addEventListener('pointerup', (e) => { e.preventDefault(); openGate(); });
  els.gateClose.addEventListener('pointerup', (e) => { e.preventDefault(); closeGate(); });
  els.holdBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); gateTouched(); startHold(); });
  for (const n of ['pointerup', 'pointercancel', 'pointerleave']) els.holdBtn.addEventListener(n, cancelHold);
  els.pad.addEventListener('pointerup', (e) => {
    const b = (e.target as Element | null)?.closest?.('[data-key]');
    if (!b) return;
    e.preventDefault();
    gateTouched();
    pressKey(b.getAttribute('data-key') ?? '');
  });
  els.panel.addEventListener('pointerup', (e) => {
    const b = (e.target as Element | null)?.closest?.('[data-act]');
    if (!b) return;
    e.preventDefault();
    doAction(b.getAttribute('data-act'), b.getAttribute('data-val'));
  });
  els.voiceSel.addEventListener('change', () => { doAction('voice', els.voiceSel.value); });
  els.hearBtn.addEventListener('pointerup', (e) => { e.preventDefault(); hearVoice(); });
  els.doneBtn.addEventListener('pointerup', (e) => { e.preventDefault(); closeSettings(); });
  if (hasSpeech()) {
    try { speechSynthesis.addEventListener('voiceschanged', () => { if (settingsOpen) populateVoices(); }); } catch { /* ignore */ }
  }
}
