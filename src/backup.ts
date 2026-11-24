/* The Backup section of the Recordings screen: save every recording to one file through the share sheet (AirDrop
   to the iPad, Save to Files...), and load that file on any device. See docs/specs/m06-recordings.md, section 8. */
import { els } from './dom';
import { backupName, makeBackup, readBackup } from './bundle';
import { render as renderScreen, reload, rs, storageWorks, touched } from './recscreen';
import { audioNeedsRebuild, ownReloaded, prepareRecording } from './sound';
import { stopSpeech } from './speech';
import { writeClips, type ClipRecord } from './store';

export const BMSG = {
  notOurs: "This isn't a Bubble Pop recordings file.",
  full: "There's no room to load these recordings. Nothing was changed. Free up space on this device and try again.",
  failed: "The file couldn't be loaded. Nothing was changed.",
  noShare: 'The file was downloaded. Look for it in your Downloads.'
} as const;

interface Pending { fresh: ClipRecord[]; mine: ClipRecord[]; skipped: number }
const bk = { pending: null as Pending | null, status: '', lastFile: null as File | null };

/* ---- Save ---- */
export function saveBackup(): void {
  if (!rs.open || rs.busy) return;
  const records = [...rs.records.values()];
  if (!records.length) return;
  const name = backupName(new Date());
  const file = new File([makeBackup(records, new Date())], name, { type: 'application/zip' });
  bk.lastFile = file;
  const done = (text: string): void => { bk.status = text; renderScreen(); };
  const download = (): void => {
    try {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); }, 60000);
      done(BMSG.noShare);
    } catch { done("The file couldn't be made on this device."); }
  };
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      navigator.share({ files: [file], title: name }).then(
        () => { done('Saved ' + records.length + ' recordings in "' + name + '".'); },
        (e: unknown) => { if ((e as { name?: unknown } | null)?.name === 'AbortError') done(''); else download(); });   // Cancel: say nothing
      return;
    }
  } catch { /* fall back to downloading it */ }
  download();
}

/* ---- Load ---- */
export function pickFile(): void {
  if (!rs.open || rs.busy || !storageWorks()) return;
  const input = document.getElementById('recFile') as HTMLInputElement | null;
  if (!input) return;
  input.value = '';
  audioNeedsRebuild();   // iOS can leave the sound stuck after its file picker: the next tap starts it afresh
  input.click();
}

/* Reads the file and asks what to do with recordings already on this device (Q12). */
export async function loadBytes(bytes: Uint8Array): Promise<void> {
  if (!rs.open || rs.busy || !storageWorks()) return;
  rs.busy = true; bk.pending = null; bk.status = 'Reading the file…';
  renderScreen();
  const read = await readBackup(bytes);
  let pending: Pending | null = null;
  if (read.ok) {
    pending = { fresh: [], mine: [], skipped: read.skipped };
    for (const r of read.records) {
      if (!(await prepareRecording(r))) { pending.skipped++; continue; }   // won't decode on this device
      (rs.records.has(r.clip) || rs.damaged.has(r.clip) ? pending.mine : pending.fresh).push(r);
    }
  }
  rs.busy = false;
  if (!rs.open) return;
  if (!pending) bk.status = BMSG.notOurs;
  else if (!pending.fresh.length && !pending.mine.length) bk.status = 'There are no recordings in this file that this device can play.' + skippedText(pending.skipped);
  else { bk.pending = pending; bk.status = ''; }
  renderScreen();
}

function skippedText(n: number): string {
  return n ? ' ' + n + (n === 1 ? ' was' : ' were') + ' skipped (damaged).' : '';
}

/* Saves them all in one storage transaction: everything loads, or nothing changes. */
async function finishLoad(replace: boolean): Promise<void> {
  const p = bk.pending;
  if (!p || !rs.open || rs.busy) return;
  stopSpeech();
  bk.pending = null;
  rs.busy = true;
  rs.notice = '';
  const put = replace ? [...p.fresh, ...p.mine] : p.fresh;
  const w = await writeClips(put);
  rs.busy = false;
  if (w === 'ok') {
    ownReloaded(put.map((r) => r.clip));
    bk.status = 'Loaded ' + put.length + (put.length === 1 ? ' recording.' : ' recordings.') + skippedText(p.skipped);
    await reload();
  } else bk.status = w === 'full' ? BMSG.full : BMSG.failed;
  renderScreen();
}

/* ---- Drawing and taps ---- */
function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}
function btn(act: string, label: string, cls = ''): string {
  return '<button type="button" class="opt ' + cls + '" data-rec="' + act + '"' + (rs.busy ? ' disabled' : '') + '>' + label + '</button>';
}

export function backupHtml(): string {
  let h = '<h3>Backup</h3>';
  const p = bk.pending;
  if (p) {
    const total = p.fresh.length + p.mine.length;
    h += '<p class="ask">This file has ' + total + ' recording' + (total === 1 ? '' : 's') + '.' +
      (p.mine.length ? ' ' + p.mine.length + ' of them ' + (p.mine.length === 1 ? 'is' : 'are') + ' already recorded on this device.' : '') + '</p><div class="seg">';
    h += p.mine.length
      ? btn('load-replace', 'Replace those ' + p.mine.length) + (p.fresh.length ? btn('load-keep', 'Keep mine, add only the ' + p.fresh.length + ' new ones') : '')
      : btn('load-replace', 'Load them');
    h += btn('load-cancel', 'Cancel') + '</div>';
  } else {
    h += '<div class="seg">' + (rs.records.size ? btn('save', 'Save recordings to a file') : '') +
      (storageWorks() ? btn('load', 'Load recordings from a file') : '') + '</div>';
  }
  if (bk.status) h += '<p class="note say">' + esc(bk.status) + '</p>';
  h += '<p class="note">To move recordings to the iPad: Save recordings to a file, choose AirDrop, then Load recordings from a file on the iPad.</p>';
  return h;
}

/* Taps on the Backup section. False if the tap was for the rest of the screen. */
export function backupAction(act: string): boolean {
  switch (act) {
    case 'save': touched(); saveBackup(); return true;
    case 'load': touched(); pickFile(); return true;
    case 'load-replace': touched(); void finishLoad(true); return true;
    case 'load-keep': touched(); void finishLoad(false); return true;
    case 'load-cancel': touched(); bk.pending = null; bk.status = ''; renderScreen(); return true;
  }
  return false;
}

export function resetBackup(): void { bk.pending = null; bk.status = ''; }

export function wireBackup(): void {
  els.recFile.addEventListener('change', () => {
    const f = (els.recFile as HTMLInputElement).files?.[0];
    if (f) void f.arrayBuffer().then((b) => loadBytes(new Uint8Array(b)), () => { bk.status = BMSG.notOurs; renderScreen(); });
  });
}

/* For the tests: the last backup file made. */
export function lastBackup(): File | null { return bk.lastFile; }
