/* Speech: everything the game says goes through say(clip). A clip is your recording if there is one, otherwise
   the computer voice. Only one spoken line at a time: say() always stops whatever was playing first. */
import { CHEER_PAUSE_MS } from './config';
import { info, isItem, isNumber } from './items';
import { AUDIO_OVERRIDES } from './recordings';
import { audioCtx, clipBuffers, master } from './sound';
import { state, type Key } from './state';

function nameOf(key: Key): string { return info(key).say; }
function kindOf(key: Key): string { return isNumber(key) ? 'number' : 'letter'; }
function anchorText(key: Key): string {
  return isNumber(key) ? info(key).word : nameOf(key) + ' is for ' + info(key).word;
}

/* The words for one clip, as the computer voice says them. */
export function textFor(clip: string): string {
  const [kind = '', key = ''] = String(clip).split(':');
  if (kind === 'prompt' && isItem(key)) return 'Can you find the ' + kindOf(key) + ' ' + nameOf(key) + '?';
  if (kind === 'cheer' && isItem(key)) return 'Great! ' + anchorText(key) + '.';
  if (kind === 'that' && isItem(key)) return "That's the " + kindOf(key) + ' ' + nameOf(key) + '.';
  if (kind === 'party') return 'Hooray! You popped ten bubbles! Great job!';
  if (kind === 'bye') return 'All done! Great playing. Bye bye!';
  if (kind === 'voicetest') return textFor('cheer:A');   // what the parent hears from "Hear it": the tricky letter A
  return '';
}

/* The computer voice says a cheer in two pieces with a short pause between (see CHEER_PAUSE_MS). */
function speechPieces(clip: string): string[] {
  const [kind = '', key = ''] = String(clip === 'voicetest' ? 'cheer:A' : clip).split(':');   // "Hear it" plays the tricky letter A
  if (kind === 'cheer' && isItem(key)) return ['Great!', anchorText(key) + '.'];
  const t = textFor(clip);
  return t ? [t] : [];
}

/* One spoken moment can be several clips played one after another.
   A wrong pop is "That's the letter A." followed by "Can you find the letter B?" */
function partsFor(clip: string): string[] {
  const p = String(clip).split(':');
  if (p[0] === 'wrong') return ['that:' + p[1], 'prompt:' + p[2]];
  return [clip];
}

let speechOK = false;
try { speechOK = typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined'; } catch { speechOK = false; }
export function hasSpeech(): boolean { return speechOK; }

let speechToken = 0;       // bumps every time speech is stopped, so stale callbacks do nothing
let speakTimer: ReturnType<typeof setTimeout> | 0 = 0;
let safetyTimer: ReturnType<typeof setTimeout> | 0 = 0;
let currentUtter: SpeechSynthesisUtterance | null = null;   // keep a reference: iOS can drop utterances that get garbage collected
let currentAudio: { pause(): void } | null = null;
export const sayLog: string[] = [];

export const BAD_VOICES = /bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|albert|fred|junior|ralph|kathy|deranged|hysterical|pipe/i;
const GOOD_VOICES = /samantha|ava|allison|susan|karen|zoe|aria|jenny|google us english|nicky|serena/i;

export function getVoices(): SpeechSynthesisVoice[] {
  try { return speechSynthesis.getVoices() || []; } catch { return []; }
}
function pickVoice(): SpeechSynthesisVoice | null {
  const list = getVoices();
  if (!list.length) return null;
  const chosen = state.settings.voiceURI;
  if (chosen) {
    for (const v of list) if (v.voiceURI === chosen) return v;
  }
  let best: SpeechSynthesisVoice | null = null, bestScore = -1;
  for (const v of list) {
    if (BAD_VOICES.test(v.name)) continue;
    const lang = String(v.lang || '').replace('_', '-');
    let score = 0;
    if (lang === 'en-US') score += 10;
    else if (lang.indexOf('en') === 0) score += 4;
    else continue;
    if (GOOD_VOICES.test(v.name)) score += 5;
    if (/female|natural|enhanced|premium/i.test(v.name)) score += 1;
    if (score > bestScore) { best = v; bestScore = score; }
  }
  return best;
}

/* Some browsers only start loading voices once asked. */
export function initSpeech(): void {
  if (!speechOK) return;
  try {
    if (speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', () => { getVoices(); });
    getVoices();
  } catch { /* ignore */ }
}

export function stopSpeech(): void {
  speechToken++;
  clearTimeout(speakTimer);
  clearTimeout(safetyTimer);
  currentUtter = null;
  if (speechOK) { try { speechSynthesis.cancel(); } catch { /* ignore */ } }
  if (currentAudio) {
    try { currentAudio.pause(); } catch { /* ignore */ }
    currentAudio = null;
  }
}

/* Plays one clip: your recording if there is one, otherwise the computer voice.
   Calls next() when it finishes (or fails), but only if nothing newer has started. */
function playClip(clip: string, token: number, next: () => void): void {
  let called = false;
  function nextOnce(): void {
    if (called || token !== speechToken) return;
    called = true;
    clearTimeout(safetyTimer);
    next();
  }
  function speakText(): void {
    const pieces = speechPieces(clip);
    if (!speechOK || !pieces.length) {        // no voice available: visuals only
      speakTimer = setTimeout(nextOnce, 1200);
      return;
    }
    function speakPiece(i: number): void {    // one utterance at a time; the next starts after the last ends
      if (token !== speechToken) return;
      let finished = false;
      function done(): void {
        if (finished || token !== speechToken) return;
        finished = true;
        clearTimeout(safetyTimer);
        if (i + 1 < pieces.length) speakTimer = setTimeout(() => { speakPiece(i + 1); }, CHEER_PAUSE_MS);
        else nextOnce();
      }
      try {
        const u = new SpeechSynthesisUtterance(pieces[i]);
        const v = pickVoice();
        if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = 'en-US'; }
        u.rate = 0.7;
        u.pitch = 1.1;
        u.volume = state.settings.volume;
        u.onend = done;
        u.onerror = done;
        currentUtter = u;
        safetyTimer = setTimeout(done, 8000);  // if the browser never reports "finished"
        speechSynthesis.speak(u);
      } catch {
        speakTimer = setTimeout(done, 1200);
      }
    }
    speakTimer = setTimeout(() => { speakPiece(0); }, 50);   // tiny delay after cancel() so browsers don't swallow the new line
  }
  const file = AUDIO_OVERRIDES[clip];
  const buffer = clipBuffers[clip];
  if (file && buffer && audioCtx && master) {
    /* Preferred path: the recording was decoded ahead of time and plays through the same Web Audio
       context as the pops. No download or decode at play time (no freeze), and the browser's audio
       output is never handed back and forth between an <audio> element and Web Audio. */
    try {
      if (audioCtx.state !== 'running' && audioCtx.resume) void audioCtx.resume();
      const bs = audioCtx.createBufferSource();
      bs.buffer = buffer;
      bs.connect(master);
      bs.onended = nextOnce;
      currentAudio = { pause: () => { bs.onended = null; try { bs.stop(); } catch { /* ignore */ } } };
      safetyTimer = setTimeout(nextOnce, 15000);
      bs.start(0);
      return;
    } catch { currentAudio = null; }
  }
  if (file && typeof Audio !== 'undefined') {
    try {
      const a = new Audio(file);
      a.volume = state.settings.volume;
      a.onended = nextOnce;
      const fallBack = (): void => {          // file missing or blocked: use the computer voice for this clip
        if (token === speechToken && currentAudio === a) { currentAudio = null; speakText(); }
      };
      a.onerror = fallBack;
      currentAudio = a;
      safetyTimer = setTimeout(nextOnce, 15000);
      const pr = a.play();
      if (pr && pr.catch) pr.catch(fallBack);
      return;
    } catch { currentAudio = null; }
  }
  speakText();
}

/* Says one spoken moment, then calls after() if nothing else has been said in the meantime. */
export function say(clip: string, after?: () => void): void {
  stopSpeech();                    // also calls speechSynthesis.cancel(): never more than one utterance
  const token = speechToken;
  const parts = partsFor(clip);
  sayLog.push(clip);
  function playPart(i: number): void {
    if (token !== speechToken) return;
    const part = parts[i];
    if (part === undefined) { if (after) after(); return; }
    playClip(part, token, () => { playPart(i + 1); });
  }
  if (state.muted) {               // sound is off: keep the game's rhythm, make no noise
    speakTimer = setTimeout(() => { if (token === speechToken && after) after(); }, 1200);
    return;
  }
  playPart(0);
}
