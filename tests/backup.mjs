// The backup file: save every recording to one ZIP and load it on another device (iPhone to iPad).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { report, stats, expect, flush, tick, newIDB, loadModule } from './harness.mjs';
import { record, deviceWith } from './recordings.mjs';
import { recScreen, takeOne } from './recscreen.mjs';

const bytesOf = async (file) => new Uint8Array(await file.arrayBuffer());
const same = (a, b) => {
  const keys = ['clip', 'type', 'words', 'trimStart', 'trimEnd', 'gain', 'recordedAt', 'processing'];
  return keys.every((k) => a[k] === b[k]) && Buffer.from(a.audio).equals(Buffer.from(b.audio));
};
function hasTool(name) { try { execFileSync(name, ['-v'], { stdio: 'ignore' }); return true; } catch { return false; } }

// A ZIP the way a computer might write it: compressed entries (deflate), a folder entry, a comment.
function deflatedZip(entries) {
  const parts = [], central = [];
  let at = 0;
  const crc = (b) => zlib.crc32(b);
  for (const e of [{ name: 'folder/', data: Buffer.alloc(0) }, ...entries]) {
    const name = Buffer.from(e.name), packed = e.name.endsWith('/') ? Buffer.alloc(0) : zlib.deflateRawSync(e.data);
    const method = e.name.endsWith('/') ? 0 : 8;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc(e.data), 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(e.data.length, 22); local.writeUInt16LE(name.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(method, 10);
    c.writeUInt32LE(crc(e.data), 16); c.writeUInt32LE(packed.length, 20); c.writeUInt32LE(e.data.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(at, 42);
    central.push(c, name);
    parts.push(local, name, packed);
    at += 30 + name.length + packed.length;
  }
  const list = Buffer.concat(central), comment = Buffer.from('zipped again on a computer');
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(list.length, 12); end.writeUInt32LE(at, 16); end.writeUInt16LE(comment.length, 20);
  return new Uint8Array(Buffer.concat([...parts, list, end, comment]));
}

export default async function () {
  // ---------- the file itself (src/bundle.ts) ----------
  {
    const before = stats.failures;
    const B = await loadModule('src/bundle.ts');
    const recs = [
      record('prompt:B', { audio: new Uint8Array(70000).map((_, i) => (i * 13 + 7) & 255).buffer }),
      record('cheer:B', { gain: 6.9, trimStart: 0.42, trimEnd: 1.96 }),
      record('party', { type: 'audio/mp4;codecs=mp4a.40.2' })
    ];
    const zip = B.makeBackup(recs, new Date('2026-11-14T10:00:00Z'));
    const back = await B.readBackup(zip);
    expect(back.ok && back.skipped === 0 && back.records.length === 3 && back.records.every((r, i) => same(r, recs[i])), 'save then load did not give back identical records');
    const entries = await B.readZip(zip);
    expect(entries && entries.map((e) => e.name).join() === 'recordings.json,prompt-B.m4a,cheer-B.m4a,party.m4a,README.txt',
      'the file should hold recordings.json, the recordings named like audio/ files, and README.txt: ' + entries?.map((e) => e.name).join());
    const about = JSON.parse(new TextDecoder().decode(entries[0].data));
    expect(about.format === 'bubble-pop-party-recordings' && about.version === 1 && about.saved === '2026-11-14T10:00:00.000Z' && about.clips[1].file === 'cheer-B.m4a' && about.clips[1].gain === 6.9,
      'recordings.json is not as the spec describes');
    expect(B.backupName(new Date(2026, 10, 14, 9)) === 'Bubble Pop recordings 2026-11-14.zip', 'the file name should be "Bubble Pop recordings 2026-11-14.zip"');
    {
      // what other zip readers (the Files app, a computer) go by: the closing record gives where the list of files
      // starts and how long it is, and the list must end exactly where that record starts
      const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength), end = zip.length - 22;
      const size = v.getUint32(end + 12, true), at = v.getUint32(end + 16, true);
      expect(v.getUint32(end, true) === 0x06054b50 && v.getUint32(at, true) === 0x02014b50 && at + size === end && v.getUint16(end + 10, true) === 5,
        "the backup file's closing record gives the wrong size or position for its list of files (other zip readers call it damaged)");
      if (hasTool('unzip')) {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bpp-zip-'));
        const f = path.join(tmp, 'backup.zip');
        fs.writeFileSync(f, zip);
        let ok = true;
        try { execFileSync('unzip', ['-tq', f], { stdio: 'pipe' }); } catch { ok = false; }
        expect(ok, 'unzip says the backup file is damaged');
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    }
    // re-zipped on a computer (compressed entries, a folder, a comment): still loads
    const rezip = deflatedZip(entries.map((e) => ({ name: e.name, data: Buffer.from(e.data) })));
    const again = await B.readBackup(rezip);
    expect(again.ok && again.records.length === 3 && again.records.every((r, i) => same(r, recs[i])), 'a re-zipped (compressed) backup file did not load');
    // not a backup file, or damaged: refused
    const flipped = zip.slice(); flipped[400] ^= 1;
    const wrong = (j) => B.makeZip([{ name: 'recordings.json', data: new TextEncoder().encode(JSON.stringify(j)) }]);
    for (const [what, bytes] of [
      ['a damaged ZIP', flipped], ['a cut-off ZIP', zip.slice(0, zip.length - 30)], ['random bytes', new Uint8Array(5000).fill(3)],
      ['an empty file', new Uint8Array(0)], ['a ZIP without recordings.json', B.makeZip([{ name: 'a.txt', data: new Uint8Array(3) }])],
      ['the wrong format', wrong({ ...about, format: 'something-else' })], ['a newer version', wrong({ ...about, version: 2 })],
      ['broken JSON', B.makeZip([{ name: 'recordings.json', data: new TextEncoder().encode('{"format":') }])],
      ['over 500 clips', wrong({ ...about, clips: Array.from({ length: 501 }, () => about.clips[0]) })],
      ['over 50 MB', new Uint8Array(B.MAX_FILE_BYTES + 1)]
    ]) {
      expect(!(await B.readBackup(bytes)).ok, `${what} should be refused as "not a Bubble Pop recordings file"`);
    }
    // unknown clip names, damaged entries, a missing or too-big file and repeats are skipped and counted
    const big = new Uint8Array(B.MAX_CLIP_BYTES + 1);
    const mixed = B.makeZip([
      { name: 'recordings.json', data: new TextEncoder().encode(JSON.stringify({ ...about, clips: [
        about.clips[0], { ...about.clips[1], clip: 'prompt:%' }, { ...about.clips[2], gain: 99 }, { ...about.clips[0], clip: 'cheer:Z', file: 'missing.m4a' },
        { ...about.clips[0], clip: 'that:Z', file: 'big.m4a' }, about.clips[0], 'nonsense'
      ] })) },
      { name: 'prompt-B.m4a', data: entries[1].data }, { name: 'cheer-B.m4a', data: entries[2].data }, { name: 'party.m4a', data: entries[3].data }, { name: 'big.m4a', data: big }
    ]);
    const m = await B.readBackup(mixed);
    expect(m.ok && m.records.length === 1 && m.records[0].clip === 'prompt:B' && m.skipped === 6, `6 entries should be skipped, 1 loaded: got ${m.records?.length} loaded, ${m.skipped} skipped`);
    report('backup file: a plain ZIP that other zip tools read, and checks on loading', before);
  }

  // ---------- iPhone to iPad ----------
  {
    const before = stats.failures;
    // on the iPhone: record three clips, save them to a file through the share sheet
    const phone = await recScreen({ idb: newIDB(), share: 'ok' });
    for (const c of ['prompt:A', 'cheer:A', 'party']) await takeOne(phone, c);
    await tick(phone, 3000);
    phone.act('save');
    await flush(10);
    const file = phone.shared[0];
    expect(file && /^Bubble Pop recordings \d{4}-\d\d-\d\d\.zip$/.test(file.name) && file.type === 'application/zip', 'Save did not open the share sheet with the .zip: ' + file?.name);
    expect(phone.model().html.includes('Saved 3 recordings'), 'the screen did not say the file was saved');
    const bytes = await bytesOf(file);
    const phoneRecs = [...phone.idb.stores.get('clips').values()];

    // on the iPad, which already has its own prompt:A: asked what to do, keep mine adds only the new ones
    const padOld = record('prompt:A', { recordedAt: '2025-01-01T00:00:00.000Z' });
    let pad = await recScreen({ idb: deviceWith({ 'prompt:A': padOld }), share: 'ok' });
    await pad.bpp.rec.ui.loadBytes(bytes); await flush(10);
    let html = pad.model().html;
    expect(html.includes('This file has 3 recordings. 1 of them is already recorded on this device.') && html.includes('Replace those 1') &&
      html.includes('Keep mine, add only the 2 new ones') && html.includes('Cancel'), 'loading should ask about the 1 already recorded: ' + html.slice(html.indexOf('Backup')));
    pad.act('load-keep'); await flush(12);
    const padStore = pad.idb.stores.get('clips');
    expect(padStore.size === 3 && padStore.get('prompt:A').recordedAt === padOld.recordedAt && same(padStore.get('party'), phoneRecs.find((r) => r.clip === 'party')),
      'Keep mine should add only the new recordings');
    expect(pad.model().html.includes('Loaded 2 recordings.'), 'the screen should say "Loaded 2 recordings."');
    await flush(10);
    expect(pad.bpp.rec.source('cheer:A') === 'own' && pad.bpp.rec.source('party') === 'own', 'the child does not hear the loaded recordings in the game');

    // replace those: every recording is the iPhone's, identical
    pad = await recScreen({ idb: deviceWith({ 'prompt:A': padOld }), share: 'ok' });
    await pad.bpp.rec.ui.loadBytes(bytes); await flush(10);
    pad.act('load-replace'); await flush(12);
    expect([...pad.idb.stores.get('clips').values()].every((r) => same(r, phoneRecs.find((p) => p.clip === r.clip))) && pad.idb.stores.get('clips').size === 3,
      'Replace should give the iPhone\'s recordings, identical');
    // delete them all on the iPad, load the file again: they're back
    pad.act('delete-all'); pad.act('delete-all-yes'); await flush(10);
    expect(pad.idb.stores.get('clips').size === 0, 'Delete all did not empty the iPad');
    await pad.bpp.rec.ui.loadBytes(bytes); await flush(10);
    expect(pad.model().html.includes('Load them'), 'with nothing on the device, loading should just offer "Load them"');
    pad.act('load-replace'); await flush(12);
    expect(pad.idb.stores.get('clips').size === 3, 'loading the file again did not bring them back');

    // Cancel, a failure halfway, storage full: nothing changes
    for (const [what, setup, act, msg] of [
      ['Cancel', null, 'load-cancel', null],
      ['a failure halfway', (idb) => { idb.failNextWrite = true; }, 'load-replace', "The file couldn't be loaded. Nothing was changed."],
      ['storage full', (idb) => { idb.mode = 'full'; }, 'load-replace', "There's no room to load these recordings."]
    ]) {
      const idb = deviceWith({ 'prompt:A': padOld });
      pad = await recScreen({ idb, share: 'ok' });
      await pad.bpp.rec.ui.loadBytes(bytes); await flush(10);
      if (setup) setup(idb);
      pad.act(act); await flush(12);
      const st = idb.stores.get('clips');
      expect(st.size === 1 && st.get('prompt:A').recordedAt === padOld.recordedAt, `${what}: the device's recordings changed`);
      if (msg) expect(pad.model().html.includes(msg), `${what}: should say "${msg}"`);
    }

    // not a recordings file; audio that won't decode on this device is skipped and counted
    pad = await recScreen({ idb: newIDB(), share: 'ok' });
    await pad.bpp.rec.ui.loadBytes(new Uint8Array(2000).fill(9)); await flush(10);
    expect(pad.model().html.includes("This isn't a Bubble Pop recordings file."), 'a wrong file should say "This isn\'t a Bubble Pop recordings file."');
    const B = await loadModule('src/bundle.ts');
    const withBad = B.makeBackup([...phoneRecs, record('bye', { audio: new Uint8Array(500).fill(0xEE).buffer })], new Date());
    await pad.bpp.rec.ui.loadBytes(withBad); await flush(10);
    expect(pad.model().html.includes('This file has 3 recordings.'), 'audio that will not decode should not be counted as loadable');
    pad.act('load-replace'); await flush(12);
    expect(pad.model().html.includes('Loaded 3 recordings. 1 was skipped (damaged).'), 'the summary should say 1 was skipped');

    // no share sheet: the file downloads; a cancelled share sheet says nothing; nothing to save: no Save button
    let env = await recScreen({ idb: deviceWith({ 'prompt:A': record('prompt:A') }), share: 'none' });
    env.act('save'); await flush(10);
    expect(env.downloads.length === 1 && /^Bubble Pop recordings .*\.zip$/.test(env.downloads[0].name) && /^blob:/.test(env.downloads[0].href), 'without a share sheet the file should download');
    env = await recScreen({ idb: deviceWith({ 'prompt:A': record('prompt:A') }), share: 'cancel' });
    env.act('save'); await flush(10);
    expect(!env.model().html.includes('downloaded') && !env.model().html.includes('Saved'), 'a cancelled share sheet should not report anything');
    env = await recScreen({ idb: newIDB(), share: 'ok' });
    expect(!env.model().html.includes('data-rec="save"') && env.model().html.includes('data-rec="load"'), 'with no recordings there should be Load but no Save');
    // blocked storage: no Load
    env = await recScreen({ idb: newIDB('fail'), share: 'ok' });
    expect(!env.model().html.includes('data-rec="load"'), 'with storage blocked Load should be hidden');
    await env.bpp.rec.ui.loadBytes(bytes); await flush(10);
    expect(!env.model().html.includes('This file has'), 'a file was loaded with storage blocked');
    report('backup: iPhone to iPad, keep mine or replace, and nothing changes when it fails', before);
  }
}
