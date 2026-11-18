/* The backup file: a plain ZIP with recordings.json (what's inside), the original recordings named like files in
   audio/ (prompt-B.m4a...) and a short README.txt. This is how recordings move from the iPhone to the iPad, and how
   they are kept safe. No page code here apart from DecompressionStream, so the checks can run it in Node.
   The writer stores entries without compression (AAC doesn't compress). The reader goes by the list of files at
   the end of the ZIP, like other zip tools, and also accepts compressed entries, in case a computer re-zips it. */
import { clipByName } from './clips';
import { checkRecord, type ClipRecord } from './store';

export const FORMAT = 'bubble-pop-party-recordings';
export const VERSION = 1;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_CLIP_BYTES = 2 * 1024 * 1024;
export const MAX_CLIPS = 500;
const README = 'This file holds recordings for Bubble Pop Party, made in the game.\n' +
  'To use them, open the game, go to Settings, Open recordings, then Load recordings from a file.\n';

/* ---- ZIP ---- */
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
export function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (const x of b) c = (CRC[(c ^ x) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry { name: string; data: Uint8Array }

/* Stored (not compressed) entries, UTF-8 names. The closing record gives the exact size and position of the list
   of files, which other zip tools check. */
export function makeZip(entries: ZipEntry[]): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const items = entries.map((e) => ({ name: enc.encode(e.name), data: e.data, crc: crc32(e.data), at: 0 }));
  const size = items.reduce((n, it) => n + 30 + it.name.length + it.data.length + 46 + it.name.length, 22);
  const out = new Uint8Array(size);
  const v = new DataView(out.buffer);
  let o = 0;
  const u32 = (x: number): void => { v.setUint32(o, x, true); o += 4; };
  const u16 = (x: number): void => { v.setUint16(o, x, true); o += 2; };
  const bytes = (b: Uint8Array): void => { out.set(b, o); o += b.length; };
  for (const it of items) {
    it.at = o;
    u32(0x04034b50); u16(20); u16(0x0800); u16(0); u16(0); u16(0x21);
    u32(it.crc); u32(it.data.length); u32(it.data.length); u16(it.name.length); u16(0); bytes(it.name); bytes(it.data);
  }
  const centralAt = o;
  for (const it of items) {
    u32(0x02014b50); u16(20); u16(20); u16(0x0800); u16(0); u16(0); u16(0x21);
    u32(it.crc); u32(it.data.length); u32(it.data.length); u16(it.name.length); u16(0); u16(0); u16(0); u16(0); u32(0);
    u32(it.at); bytes(it.name);
  }
  const centralSize = o - centralAt;
  u32(0x06054b50); u16(0); u16(0); u16(items.length); u16(items.length); u32(centralSize); u32(centralAt); u16(0);
  return out;
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const reader = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const r = await reader.read();
    if (r.done) break;
    parts.push(r.value);
    total += r.value.length;
    if (total > MAX_CLIP_BYTES * 4) throw new Error('too big');
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/* The files in a ZIP. Null if it isn't a ZIP, or is damaged (a wrong check sum, a list that points outside the
   file, an encrypted or unknown kind of entry). Entries over maxEntry bytes come back empty. */
export async function readZip(bytes: Uint8Array, maxEntry = MAX_CLIP_BYTES): Promise<ZipEntry[] | null> {
  try {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
      if (v.getUint32(i, true) === 0x06054b50) { end = i; break; }
    }
    if (end < 0) return null;
    const count = v.getUint16(end + 10, true), listSize = v.getUint32(end + 12, true), listAt = v.getUint32(end + 16, true);
    if (listAt + listSize > end) return null;
    const dec = new TextDecoder();
    const out: ZipEntry[] = [];
    let o = listAt;
    for (let n = 0; n < count; n++) {
      if (o + 46 > end || v.getUint32(o, true) !== 0x02014b50) return null;
      const flags = v.getUint16(o + 8, true), method = v.getUint16(o + 10, true), crc = v.getUint32(o + 16, true);
      const packed = v.getUint32(o + 20, true), size = v.getUint32(o + 24, true);
      const nameLen = v.getUint16(o + 28, true), extraLen = v.getUint16(o + 30, true), commentLen = v.getUint16(o + 32, true);
      const local = v.getUint32(o + 42, true);
      const name = dec.decode(bytes.subarray(o + 46, o + 46 + nameLen));
      o += 46 + nameLen + extraLen + commentLen;
      if (flags & 1 || (method !== 0 && method !== 8)) return null;
      if (local + 30 > bytes.length || v.getUint32(local, true) !== 0x04034b50) return null;
      const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
      if (start + packed > bytes.length) return null;
      if (name.endsWith('/')) continue;                       // a folder
      if (size > maxEntry) { out.push({ name, data: new Uint8Array(0) }); continue; }
      const raw = bytes.subarray(start, start + packed);
      const data = method === 0 ? raw.slice() : await inflate(raw);
      if (data.length !== size || crc32(data) !== crc) return null;
      out.push({ name, data });
    }
    return out;
  } catch { return null; }
}

/* ---- The backup file ---- */
export function backupName(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return 'Bubble Pop recordings ' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '.zip';
}
export function extensionFor(type: string): string {
  return /mp4|aac|m4a/i.test(type) ? 'm4a' : /webm/i.test(type) ? 'webm' : /ogg/i.test(type) ? 'ogg' : /wav/i.test(type) ? 'wav' : /mpeg|mp3/i.test(type) ? 'mp3' : 'bin';
}

export function makeBackup(records: ClipRecord[], now: Date): Uint8Array<ArrayBuffer> {
  const entries: ZipEntry[] = [];
  const clips = records.map((r) => {
    const file = (clipByName(r.clip)?.file ?? r.clip.replace(/[^A-Za-z0-9]/g, '-')) + '.' + extensionFor(r.type);
    entries.push({ name: file, data: new Uint8Array(r.audio) });
    return { clip: r.clip, file, type: r.type, words: r.words, trimStart: r.trimStart, trimEnd: r.trimEnd, gain: r.gain, recordedAt: r.recordedAt, processing: r.processing };
  });
  const about = { format: FORMAT, version: VERSION, saved: now.toISOString(), clips };
  const enc = new TextEncoder();
  return makeZip([{ name: 'recordings.json', data: enc.encode(JSON.stringify(about, null, 1)) }, ...entries, { name: 'README.txt', data: enc.encode(README) }]);
}

export type BackupRead = { ok: false } | { ok: true; records: ClipRecord[]; skipped: number };

/* Checks a backup file: the right format and a version this game knows, under 50 MB, each clip under 2 MB, at most
   500 clips. Each clip is checked like a stored record; unknown clip names and damaged entries are skipped and
   counted (whether the audio decodes is checked by the screen, which has the sound system). */
export async function readBackup(bytes: Uint8Array): Promise<BackupRead> {
  if (bytes.length > MAX_FILE_BYTES) return { ok: false };
  const zip = await readZip(bytes);
  const json = zip?.find((e) => e.name === 'recordings.json');
  if (!zip || !json) return { ok: false };
  let about: unknown;
  try { about = JSON.parse(new TextDecoder().decode(json.data)); } catch { return { ok: false }; }
  const a = about as { format?: unknown; version?: unknown; clips?: unknown };
  if (!a || a.format !== FORMAT || a.version !== VERSION || !Array.isArray(a.clips) || a.clips.length > MAX_CLIPS) return { ok: false };
  const files = new Map(zip.map((e) => [e.name, e.data]));
  const records: ClipRecord[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const item of a.clips as unknown[]) {
    const it = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const data = typeof it.file === 'string' ? files.get(it.file) : undefined;
    const audio = data && data.length && data.length <= MAX_CLIP_BYTES ? data.slice().buffer : undefined;
    const r = checkRecord({ ...it, audio });
    if (!r || seen.has(r.clip)) { skipped++; continue; }
    seen.add(r.clip);
    records.push(r);
  }
  return { ok: true, records, skipped };
}
