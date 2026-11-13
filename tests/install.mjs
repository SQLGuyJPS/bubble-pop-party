// Install files: icons, manifest, and the offline helper.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { findRecordings } from '../tools/recordings.mjs';
import { precacheFiles, versionFor } from '../tools/precache.mjs';
import { root, dist, stats, fail, expect, mulberry, makeEnv, freshGame, runFor, tapBubble, targetBubble, otherBubble, passGate } from './harness.mjs';

export default async function () {
  // ---------- install files: icons, manifest, offline worker ----------
  {
    const before = stats.failures;
    const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
    const html = read('index.html');
    const pngSize = (f) => { const b = fs.readFileSync(path.join(root, f)); return b.readUInt32BE(16) + 'x' + b.readUInt32BE(20); };
    const relative = (p) => !/^(\/|[a-z]+:)/i.test(p);

    // dist/sw.js lists every file in dist/ (except the speed test page and source maps), and its version
    // matches their contents
    const swCode = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8');
    const listed = new vm.Script('(' + swCode.match(/define_PRECACHE_default = (\[[\s\S]*?\]);/)[1] + ')').runInNewContext({});
    const version = swCode.match(/CACHE_VERSION = "([^"]+)"/)[1];
    const files = precacheFiles(dist);
    expect(JSON.stringify(listed) === JSON.stringify(['./', ...files]), 'dist/sw.js does not list exactly the files in dist/: ' + listed.join(', '));
    expect(version === versionFor(dist, files), 'the version in dist/sw.js does not match the files');
    expect(!listed.some((f) => f.startsWith('perf/') || f.endsWith('.map') || f === 'sw.js'), 'dist/sw.js saves the speed test, a source map or itself');
    expect(listed.every(relative), 'sw.js has a path starting with "/" or a web address (breaks on GitHub Pages)');
    expect(listed.includes('./') && listed.includes('index.html') && listed.includes('game.js') && listed.includes('game.css'), 'sw.js does not save the start page and its script and styles');
    for (const f of listed) if (f !== './') expect(fs.existsSync(path.join(dist, f)), 'sw.js lists a missing file: ' + f);
    for (const dir of ['icons', 'fonts']) {
      for (const f of fs.readdirSync(path.join(root, dir))) {
        if (/\.(png|ttf)$/i.test(f)) expect(listed.includes(`${dir}/${f}`), `${dir}/${f} is not saved for offline use`);
      }
    }
    // recordings: every file with a clip name is built in and saved offline; any other file is left out
    const { clips } = findRecordings(root);
    const audioDir = path.join(root, 'audio');
    for (const f of fs.existsSync(audioDir) ? fs.readdirSync(audioDir) : []) {
      const used = Object.values(clips).includes('audio/' + f);
      expect(used === listed.includes('audio/' + f), `audio/${f} is ${used ? 'used by the game but not saved offline' : 'not a clip name but was published anyway'}`);
    }
    {
      const env = makeEnv({ rand: mulberry(1) });
      expect(JSON.stringify(env.bpp.overrides) === JSON.stringify(clips), 'the game does not know the recordings in audio/');
    }
    {
      // a renamed file (like mute.prompt-A.m4a) is left out of the game with a message, a clip name is used
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bpp-audio-'));
      fs.mkdirSync(path.join(tmp, 'audio'));
      for (const f of ['prompt-a.m4a', 'cheer-B.mp3', 'party.m4a', 'mute.prompt-C.m4a', 'that-B.txt', 'notes.txt']) fs.writeFileSync(path.join(tmp, 'audio', f), '');
      const r = findRecordings(tmp);
      expect(JSON.stringify(r.clips) === JSON.stringify({ 'cheer:B': 'audio/cheer-B.mp3', 'party': 'audio/party.m4a', 'prompt:A': 'audio/prompt-a.m4a' }), 'recordings were not matched to clips: ' + JSON.stringify(r.clips));
      expect(r.problems.length === 3 && r.problems.some((p) => p.includes('mute.prompt-C.m4a')), 'files left out were not reported: ' + r.problems.join(' | '));
      fs.rmSync(tmp, { recursive: true, force: true });
    }

    // manifest and iPad tags
    const manifest = JSON.parse(read('manifest.webmanifest'));
    expect(relative(manifest.start_url) && relative(manifest.scope), 'manifest start_url/scope must be relative');
    expect(manifest.display === 'standalone' && manifest.name === 'Bubble Pop Party', 'manifest name/display wrong');
    for (const ic of manifest.icons) {
      expect(relative(ic.src) && fs.existsSync(path.join(root, ic.src)), 'manifest icon missing or not relative: ' + ic.src);
      expect(pngSize(ic.src) === ic.sizes, `manifest says ${ic.src} is ${ic.sizes} but it is ${pngSize(ic.src)}`);
    }
    expect(pngSize('icons/apple-touch-icon.png') === '180x180', 'apple-touch-icon must be 180x180');
    expect(/<link rel="manifest" href="manifest\.webmanifest">/.test(html), 'index.html does not link the manifest');
    expect(/<link rel="apple-touch-icon" href="icons\/apple-touch-icon\.png">/.test(html), 'index.html has no apple-touch-icon');
    expect(/apple-mobile-web-app-capable" content="yes"/.test(html), 'missing the iPad full-screen tag');
    const pageLinks = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map((m) => m[1]);
    expect(pageLinks.every(relative), 'index.html has a link starting with "/" or a web address: ' + pageLinks.filter((p) => !relative(p)).join(', '));
    // no network calls, and no path starting with "/", anywhere in the game's own code
    for (const f of fs.readdirSync(path.join(root, 'src'))) {
      if (f === 'sw.ts') continue;    // the offline helper downloads the game's own files; that is its job
      const text = read('src/' + f).replace(/\/\*[\s\S]*?\*\/|(^|[\s;])\/\/[^\n]*/g, '$1');   // without comments
      expect(!/\bfetch\((?!file\))|XMLHttpRequest|WebSocket|sendBeacon|EventSource|navigator\.connection/.test(text), 'src/' + f + ' makes a network call');
      expect(!/https?:\/\//.test(text), 'src/' + f + ' has a web address in its code');
      expect(!/(?:url\(|src=|href=|['"`])\/[a-z]/i.test(text), 'src/' + f + ' has a path starting with "/"');
    }

    // run the worker against a fake browser
    const fakeNet = { up: true, missing: new Set(), hits: [] };
    function swEnv(existingCaches) {
      const stores = new Map(Object.entries(existingCaches || {}).map(([k, v]) => [k, new Map(v)]));
      const listeners = {};
      const strip = (u) => u.split('?')[0];
      const Req = class { constructor(u, o) { this.url = typeof u === 'string' ? new URL(u, 'https://x.test/game/sw.js').href : u.url; this.method = (o && o.method) || 'GET'; this.mode = (o && o.mode) || 'cors'; } };
      const Res = class { constructor(body, status) { this.body = body; this.ok = status === undefined || status < 400; this.status = status || 200; } static error() { return new Res('', 500); } };
      const cacheApi = {
        open: async (name) => {
          if (!stores.has(name)) stores.set(name, new Map());
          const s = stores.get(name);
          return {
            put: async (req, res) => { s.set(strip(typeof req === 'string' ? new Req(req).url : req.url), res); },
            match: async (req) => s.get(strip(typeof req === 'string' ? new Req(req).url : req.url))
          };
        },
        keys: async () => [...stores.keys()],
        delete: async (n) => stores.delete(n)
      };
      const self = { addEventListener: (t, fn) => { listeners[t] = fn; }, skipWaiting: async () => {}, clients: { claim: async () => {} } };
      const sandbox = { self, caches: cacheApi, Request: Req, Response: Res, URL, Promise,
        fetch: async (r) => {
          const url = typeof r === 'string' ? r : r.url;
          fakeNet.hits.push(url);
          if (!fakeNet.up) throw new Error('offline');
          if ([...fakeNet.missing].some((m) => url.endsWith(m))) return new Res('', 404);
          return new Res('net:' + url);
        } };
      vm.runInNewContext(swCode, sandbox);
      const run = async (type, extra) => { let p; listeners[type](Object.assign({ waitUntil: (x) => { p = x; }, respondWith: (x) => { p = x; } }, extra)); return p; };
      return { stores, Req, Res, run, listeners };
    }
    async function swTests() {
      fakeNet.up = true; fakeNet.missing.clear();
      const old = { 'bubble-pop-party-old': [['https://x.test/game/index.html', 'old']] };
      const sw = swEnv(old);
      await sw.run('install');
      const mine = sw.stores.get(version);
      expect(mine && mine.size === listed.length, `install saved ${mine ? mine.size : 0} of ${listed.length} files`);
      expect(sw.stores.has('bubble-pop-party-old'), 'the old copy was deleted too early (before the new one took over)');
      await sw.run('activate');
      expect(!sw.stores.has('bubble-pop-party-old') && sw.stores.has(version), 'activation did not remove the old copy / keep the new one');

      fakeNet.hits.length = 0;
      const hit = await sw.run('fetch', { request: new sw.Req('https://x.test/game/index.html?debug') });
      expect(hit && String(hit.body).startsWith('net:'), 'saved page was not served (even with ?debug)');
      expect(fakeNet.hits.length === 0, 'a saved file went to the network');
      fakeNet.up = false;
      const offline = await sw.run('fetch', { request: new sw.Req('https://x.test/game/fonts/Andika-Bold.ttf') });
      expect(offline && offline.ok, 'saved font not served offline');
      const nav = await sw.run('fetch', { request: new sw.Req('https://x.test/game/something-else', { mode: 'navigate' }) });
      expect(nav && nav.ok, 'offline navigation did not fall back to the game');
      const post = swEnv();
      let responded = false;
      post.listeners.fetch({ request: new post.Req('https://x.test/game/', { method: 'POST' }), respondWith: () => { responded = true; } });
      expect(!responded, 'the worker answered a non-GET request');

      // a failed download must not leave a half-saved game behind as the active copy
      fakeNet.up = true; fakeNet.missing.add('icons/icon-512.png');
      const bad = swEnv();
      let rejected = false;
      try { await bad.run('install'); } catch (e) { rejected = true; }
      expect(rejected, 'install did not fail when a file could not be downloaded');
    }
    await swTests();
    console.log(`${stats.failures === before ? 'ok  ' : 'FAIL'} icons, manifest and offline worker`);
  }
}
