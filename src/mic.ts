/* The microphone, for recording one clip on the Recordings screen. Set by the microphone test (spec section 7):
   - voice processing off, a MediaRecorder in audio/mp4 (AAC, saved as .m4a);
   - navigator.audioSession set to 'play-and-record' just before asking for the microphone and to 'playback' when
     letting go. This was the only way the game's sounds weren't quieter after a take on the iPhone;
   - no level meter and no stopping on silence: Stop, or the 6-second limit;
   - the iPhone asks for the microphone every time the app opens. Nothing is timed while it asks: the limit counts
     from when the recorder has started. A question left unanswered for 60 seconds gives up.
   Every way out (a finished take, Stop, the limit, a refusal, an error, cancelling) goes through releaseMic(). */

export const RECORD_LIMIT_MS = 6000;
export const ASK_LIMIT_MS = 60000;
const STOP_WAIT_MS = 3000;          // the recorder hands over its data after stop(); never wait longer than this
export const RECORD_TYPE = 'audio/mp4';

export type MicPhase = 'idle' | 'asking' | 'recording' | 'stopping';
export type TakeResult =
  | { kind: 'take'; data: ArrayBuffer; type: string }
  | { kind: 'refused' }              // the parent said no, or it was refused before
  | { kind: 'error' }                // anything else went wrong
  | { kind: 'cancelled' }            // left the screen, the app went to the background, or the idle close
  | { kind: 'timeout' }              // the microphone question was left open for 60 seconds
  | { kind: 'busy' };                // a take is already running

type Timer = ReturnType<typeof setTimeout> | 0;
interface AudioSessionLike { type: string }

export const mic = { phase: 'idle' as MicPhase, startedAt: 0 };
let stream: MediaStream | null = null;
let recorder: MediaRecorder | null = null;
let askTimer: Timer = 0, limitTimer: Timer = 0, stopTimer: Timer = 0;
let finishTake: ((r: TakeResult) => void) | null = null;
let sessionTouched = false;

function audioSession(): AudioSessionLike | null {
  try { return (navigator as unknown as { audioSession?: AudioSessionLike }).audioSession ?? null; } catch { return null; }
}

/* Can this browser record at all? (getUserMedia and MediaRecorder) */
export function canRecord(): boolean {
  try {
    return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';
  } catch { return false; }
}

function pickType(): string {
  try { return MediaRecorder.isTypeSupported(RECORD_TYPE) ? RECORD_TYPE : ''; } catch { return ''; }
}

function stopTracks(s: MediaStream | null): void {
  if (!s) return;
  for (const t of s.getTracks()) { try { t.stop(); } catch { /* ignore */ } }
}

/* Lets go of everything, whatever state it was in: stops the recorder and every microphone track, drops them,
   and hands the audio session back for playing only. Safe to call at any time, any number of times. */
export function releaseMic(): void {
  clearTimeout(askTimer); clearTimeout(limitTimer); clearTimeout(stopTimer);
  askTimer = limitTimer = stopTimer = 0;
  const r = recorder;
  recorder = null;
  if (r) {
    r.ondataavailable = null; r.onstop = null; r.onerror = null;
    try { if (r.state !== 'inactive') r.stop(); } catch { /* already stopped */ }
  }
  stopTracks(stream);
  stream = null;
  mic.phase = 'idle';
  const session = audioSession();
  if (session && sessionTouched) { try { session.type = 'playback'; } catch { /* ignore */ } }
}

function end(r: TakeResult): void {
  const f = finishTake;
  finishTake = null;
  releaseMic();
  if (f) f(r);
}

/* Records one take. onRecording() is called once the recorder has actually started (after the microphone question
   is answered): that is when the panel shows the red dot and the ring, and when the length limit starts. */
export function startTake(onRecording: () => void): Promise<TakeResult> {
  if (mic.phase !== 'idle' || finishTake) return Promise.resolve({ kind: 'busy' });
  return new Promise((resolve) => {
    finishTake = resolve;
    const mine = resolve;
    const stillMine = (): boolean => finishTake === mine;
    mic.phase = 'asking';
    askTimer = setTimeout(() => { end({ kind: 'timeout' }); }, ASK_LIMIT_MS);
    const session = audioSession();
    if (session) { try { session.type = 'play-and-record'; sessionTouched = true; } catch { /* record without it */ } }
    let asked: Promise<MediaStream>;
    try {
      asked = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch { end({ kind: 'error' }); return; }
    asked.then((s) => {
      if (!stillMine() || mic.phase !== 'asking') { stopTracks(s); return; }   // answered after it was cancelled
      stream = s;
      clearTimeout(askTimer);
      askTimer = 0;
      const type = pickType();
      const chunks: Blob[] = [];
      let r: MediaRecorder;
      try {
        r = type ? new MediaRecorder(s, { mimeType: type }) : new MediaRecorder(s);
        r.ondataavailable = (e: BlobEvent) => { if (e.data && e.data.size) chunks.push(e.data); };
        r.onerror = () => { end({ kind: 'error' }); };
        r.onstop = () => { void handOver(r, chunks, type); };
        recorder = r;
        r.start();
      } catch { end({ kind: 'error' }); return; }
      mic.phase = 'recording';
      mic.startedAt = Date.now();
      limitTimer = setTimeout(stopTake, RECORD_LIMIT_MS);
      try { onRecording(); } catch { /* the panel is optional */ }
    }, (e: unknown) => {
      if (!stillMine()) return;
      const name = e && typeof e === 'object' && 'name' in e ? String((e as { name: unknown }).name) : '';
      end({ kind: name === 'NotAllowedError' || name === 'SecurityError' ? 'refused' : 'error' });
    });

    async function handOver(r: MediaRecorder, chunks: Blob[], type: string): Promise<void> {
      if (!stillMine()) return;
      const t = r.mimeType || type || chunks[0]?.type || '';
      finishTake = null;          // from here on, nothing can cancel it: the take is complete
      releaseMic();
      try {
        const data = await new Blob(chunks, { type: t }).arrayBuffer();
        mine(data.byteLength ? { kind: 'take', data, type: t } : { kind: 'error' });
      } catch { mine({ kind: 'error' }); }
    }
  });
}

/* Stop, or the length limit: the take so far is kept. */
export function stopTake(): void {
  const r = recorder;
  if (mic.phase !== 'recording' || !r) return;
  mic.phase = 'stopping';
  clearTimeout(limitTimer);
  limitTimer = 0;
  stopTimer = setTimeout(() => { end({ kind: 'error' }); }, STOP_WAIT_MS);
  try { r.stop(); } catch { end({ kind: 'error' }); }
}

/* Leaving the screen, Done, the app going to the background, the idle close: the take is thrown away. */
export function cancelTake(): void {
  if (finishTake) end({ kind: 'cancelled' });
  else releaseMic();
}
