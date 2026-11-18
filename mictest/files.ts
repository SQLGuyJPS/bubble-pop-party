/* The microphone test page's pure helpers: which device and version this is, and a tiny ZIP (stored, not
   compressed) for checking that files survive the share sheet and the file picker, including a recording moved
   from the iPhone to the iPad. No browser access here, so the checks in tests/install.mjs can run it.
   Throwaway: deleted at the end of Milestone 6. */

export type DeviceKind = 'iPhone' | 'iPad' | 'Mac' | 'other';
export interface Device {
  kind: DeviceKind;
  osName: string;              // 'iOS', 'iPadOS', 'macOS' or ''
  os: string;                  // the system version, e.g. '27.0.1' or '18.7'
  safari: string;              // the Safari version, e.g. '27.0.1'
}

/* Reads the browser's description of itself. From Safari 26 on, the system version in it is frozen at "18_x"
   (so an iPhone on iOS 27 still says "OS 18_7"), but the Safari version after "Version/" matches the system.
   An iPad asking for desktop sites says "Macintosh", but has a touch screen. */
export function deviceInfo(ua: string, touchPoints: number): Device {
  const kind: DeviceKind = /iPhone|iPod/.test(ua) ? 'iPhone'
    : /iPad/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1) ? 'iPad'
      : /Macintosh/.test(ua) ? 'Mac' : 'other';
  const safari = /Version\/(\d+(?:\.\d+)*)/.exec(ua)?.[1] ?? '';
  const tok = /OS (\d+)[_.](\d+)(?:[_.](\d+))? like Mac/.exec(ua);
  const fromToken = tok ? tok.slice(1).filter(Boolean).join('.') : '';
  const os = parseInt(safari, 10) >= 26 ? safari : fromToken || safari;
  const osName = kind === 'iPhone' ? 'iOS' : kind === 'iPad' ? 'iPadOS' : kind === 'Mac' ? 'macOS' : '';
  return { kind, osName, os, safari };
}

export function describeDevice(d: Device): string {
  return `${d.kind}${d.osName ? ' · ' + d.osName : ''} ${d.os || '?'}${d.safari && d.safari !== d.os ? ' (Safari ' + d.safari + ')' : ''}`;
}

/* The file extension for a recorded format: AAC in an MP4 box is a .m4a file. */
export function extensionFor(mime: string): string {
  return /mp4|aac/i.test(mime) ? 'm4a' : /webm/i.test(mime) ? 'webm' : /wav/i.test(mime) ? 'wav' : 'bin';
}

/* ---- base64, to keep the last recording in localStorage between openings of the page ---- */
export function toBase64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
export function fromBase64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

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
function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (const x of b) c = (CRC[(c ^ x) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry { name: string; data: Uint8Array }

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

/* Reads the files of a ZIP that makeZip wrote (stored, not compressed). Null if it isn't one, or is damaged. */
export function readZip(bytes: Uint8Array): ZipEntry[] | null {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dec = new TextDecoder();
  const out: ZipEntry[] = [];
  let o = 0;
  while (o + 4 <= bytes.length && v.getUint32(o, true) === 0x04034b50) {
    if (o + 30 > bytes.length || v.getUint16(o + 8, true) !== 0) return null;
    const crc = v.getUint32(o + 14, true), size = v.getUint32(o + 18, true);
    const nameLen = v.getUint16(o + 26, true), extra = v.getUint16(o + 28, true);
    const start = o + 30 + nameLen + extra;
    if (start + size > bytes.length) return null;
    const data = bytes.slice(start, start + size);
    if (crc32(data) !== crc) return null;
    out.push({ name: dec.decode(bytes.subarray(o + 30, o + 30 + nameLen)), data });
    o = start + size;
  }
  return out.length ? out : null;
}
