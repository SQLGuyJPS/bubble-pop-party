/* Storage for recordings (and, in later milestones, progress): IndexedDB, kept on this device only.
   If storage is blocked (private mode, IndexedDB missing, opening fails or never answers within 3 seconds, a newer
   database from a later version of the game), every function here answers "nothing saved" and the game runs as
   it always did, on files in audio/ and the computer voice. */
import { clipByName } from './clips';

export const DB_NAME = 'bubblePopParty';
const OPEN_TIMEOUT_MS = 3000;
const CLIPS = 'clips';

/* One upgrade step per database version. A device on an old version runs each missing step in turn.
   Later milestones add a step (for example a 'progress' store); never change an old one. */
const UPGRADES: ((db: IDBDatabase) => void)[] = [
  (db) => { db.createObjectStore(CLIPS, { keyPath: 'clip' }); }      // version 1, Milestone 6: recordings
];

/* One saved recording. The original take is kept unchanged; the trim and the volume change are applied when it
   is decoded for play. */
export interface ClipRecord {
  clip: string;            // the clip name, 'prompt:B'
  audio: ArrayBuffer;      // the original recording (an ArrayBuffer: simpler and safer than a Blob)
  type: string;            // its format, 'audio/mp4'
  words: string;           // the clip's words when it was recorded; if they change, it isn't played
  trimStart: number;       // seconds into the original where the speech starts
  trimEnd: number;         // ...and ends
  gain: number;            // the volume change
  recordedAt: string;      // date and time
  processing: number;      // version of the trim and level rules
}
export const PROCESSING = 1;
export const MIN_GAIN = 0.1, MAX_GAIN = 10;
const MAX_SECONDS = 60;

export type StoreStatus = 'unknown' | 'ok' | 'blocked';
export let storeStatus: StoreStatus = 'unknown';
let dbPromise: Promise<IDBDatabase | null> | null = null;

function isArrayBuffer(x: unknown): x is ArrayBuffer {
  return Object.prototype.toString.call(x) === '[object ArrayBuffer]';
}
function num(x: unknown): number { return typeof x === 'number' && isFinite(x) ? x : NaN; }

/* Every record is checked when it's read, like settings. Null means damaged: ignore it. */
export function checkRecord(input: unknown): ClipRecord | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  if (typeof o.clip !== 'string' || !clipByName(o.clip)) return null;
  if (!isArrayBuffer(o.audio) || o.audio.byteLength === 0) return null;
  const trimStart = num(o.trimStart), trimEnd = num(o.trimEnd), gain = num(o.gain), processing = num(o.processing);
  if (!(trimStart >= 0 && trimEnd > trimStart && trimEnd <= MAX_SECONDS)) return null;
  if (!(gain >= MIN_GAIN && gain <= MAX_GAIN)) return null;
  if (!(processing >= 1 && Math.floor(processing) === processing)) return null;
  if (typeof o.words !== 'string' || typeof o.type !== 'string' || o.type.length > 100) return null;
  return {
    clip: o.clip, audio: o.audio, type: o.type, words: o.words, trimStart, trimEnd, gain,
    recordedAt: typeof o.recordedAt === 'string' ? o.recordedAt.slice(0, 40) : '', processing
  };
}

/* Opens the database once. Resolves to null when storage is blocked. */
export function openStore(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => { finish(null); }, OPEN_TIMEOUT_MS);
    function finish(db: IDBDatabase | null): void {
      if (done) { try { db?.close(); } catch { /* ignore */ } return; }
      done = true;
      clearTimeout(timer);
      storeStatus = db ? 'ok' : 'blocked';
      resolve(db);
    }
    try {
      const idb = typeof indexedDB !== 'undefined' ? indexedDB : null;
      if (!idb) { finish(null); return; }
      const req = idb.open(DB_NAME, UPGRADES.length);
      req.onupgradeneeded = (e) => {
        const db = req.result;
        for (let v = e.oldVersion; v < UPGRADES.length; v++) UPGRADES[v]!(db);
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { try { db.close(); } catch { /* ignore */ } };
        finish(db);
      };
      req.onerror = () => { finish(null); };       // also a newer database from a later version of the game
    } catch { finish(null); }
  });
  return dbPromise;
}

function done<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((ok, bad) => { r.onsuccess = () => { ok(r.result); }; r.onerror = () => { bad(r.error); }; });
}

/* The names of the saved clips, without their audio (read at start-up). */
export async function savedNames(): Promise<string[]> {
  const db = await openStore();
  if (!db) return [];
  try {
    const keys = await done(db.transaction(CLIPS, 'readonly').objectStore(CLIPS).getAllKeys());
    return keys.filter((k): k is string => typeof k === 'string');
  } catch { return []; }
}

/* One saved recording: the record, 'damaged', or null when there is none. */
export async function readClip(name: string): Promise<ClipRecord | 'damaged' | null> {
  const db = await openStore();
  if (!db) return null;
  try {
    const raw = await done(db.transaction(CLIPS, 'readonly').objectStore(CLIPS).get(name));
    if (raw === undefined) return null;
    const r = checkRecord(raw);
    return r && r.clip === name ? r : 'damaged';
  } catch { return 'damaged'; }
}

/* Every saved recording. A damaged record of a known clip is listed by name so its row can say so; a record of an
   unknown clip is ignored. */
export async function readAll(): Promise<{ records: Map<string, ClipRecord>; damaged: Set<string> }> {
  const records = new Map<string, ClipRecord>(), damaged = new Set<string>();
  const db = await openStore();
  if (!db) return { records, damaged };
  try {
    const st = db.transaction(CLIPS, 'readonly').objectStore(CLIPS);
    const [keys, values] = await Promise.all([done(st.getAllKeys()), done(st.getAll())]);
    keys.forEach((k, i) => {
      if (typeof k !== 'string' || !clipByName(k)) return;
      const r = checkRecord(values[i]);
      if (r && r.clip === k) records.set(k, r); else damaged.add(k);
    });
  } catch { /* nothing readable */ }
  return { records, damaged };
}

export type WriteResult = 'ok' | 'full' | 'failed';

/* Saves and deletes in one transaction: either all of it happens, or nothing changes. */
export async function writeClips(put: ClipRecord[], remove: string[] = []): Promise<WriteResult> {
  const db = await openStore();
  if (!db) return 'failed';
  return new Promise((resolve) => {
    let settled = false;
    const end = (r: WriteResult): void => { if (!settled) { settled = true; resolve(r); } };
    try {
      const tx = db.transaction(CLIPS, 'readwrite');
      const full = (): boolean => (tx.error?.name ?? '') === 'QuotaExceededError';
      tx.oncomplete = () => { end('ok'); };
      tx.onabort = () => { end(full() ? 'full' : 'failed'); };
      tx.onerror = () => { end(full() ? 'full' : 'failed'); };
      const st = tx.objectStore(CLIPS);
      for (const name of remove) st.delete(name);
      for (const r of put) st.put(r);
    } catch (e) {
      end(e instanceof Error && e.name === 'QuotaExceededError' ? 'full' : 'failed');
    }
  });
}

export async function deleteAllClips(): Promise<WriteResult> {
  const db = await openStore();
  if (!db) return 'failed';
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(CLIPS, 'readwrite');
      tx.oncomplete = () => { resolve('ok'); };
      tx.onabort = tx.onerror = () => { resolve('failed'); };
      tx.objectStore(CLIPS).clear();
    } catch { resolve('failed'); }
  });
}

/* ---- Asking the browser to keep it ---- */
let askedPersist = false;
export function askToKeep(): void {
  if (askedPersist) return;
  askedPersist = true;
  try { void navigator.storage?.persist?.().catch(() => false); } catch { /* the game can only ask */ }
}
export async function isKept(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persisted) return null;
    return await navigator.storage.persisted();
  } catch { return null; }
}

