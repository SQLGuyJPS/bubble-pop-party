// Builds the game into dist/, ready to publish.
//
//   node tools/build.mjs          production build (npm run build)
//   node tools/build.mjs --dev    builds, serves dist/ at http://localhost:8000 and rebuilds on change (npm run dev)
//
// What it does:
//   1. src/main.ts -> dist/game.js (one script) and src/styles.css -> dist/game.css
//   2. copies index.html, manifest.webmanifest, icons/, fonts/ and your recordings from audio/
//   3. perf/ -> dist/perf/ (the speed test page) and mictest/ -> dist/mictest/ (the microphone test page,
//      Milestone 6 only); neither is saved for offline use
//   4. src/sw.ts -> dist/sw.js, the offline helper, with the list of files and a version made from their contents
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { findRecordings } from './recordings.mjs';
import { precacheFiles, versionFor } from './precache.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const dev = process.argv.includes('--dev');
const PORT = 8000;

function copy(rel, test = () => true) {
  const from = path.join(root, rel);
  if (!fs.existsSync(from)) return;
  if (fs.statSync(from).isDirectory()) {
    for (const f of fs.readdirSync(from).sort()) if (!f.startsWith('.') && test(f)) copy(`${rel}/${f}`);
    return;
  }
  fs.mkdirSync(path.dirname(path.join(dist, rel)), { recursive: true });
  fs.copyFileSync(from, path.join(dist, rel));
}

/* Everything except the scripts and styles that esbuild writes. */
function copyFiles(clips) {
  copy('index.html');
  copy('manifest.webmanifest');
  copy('icons', (f) => f.endsWith('.png'));
  copy('fonts');
  fs.rmSync(path.join(dist, 'audio'), { recursive: true, force: true });
  for (const file of Object.values(clips)) copy(file);
  copy('perf/index.html');
  copy('mictest', (f) => /\.(html|png|webmanifest)$/.test(f));
}

async function buildServiceWorker() {
  const files = precacheFiles(dist);
  const version = versionFor(dist, files);
  await esbuild.build({
    entryPoints: [path.join(root, 'src/sw.ts')],
    outfile: path.join(dist, 'sw.js'),
    bundle: true,
    format: 'iife',
    target: 'safari18',
    logLevel: 'warning',
    define: { __CACHE_VERSION__: JSON.stringify(version), __PRECACHE__: JSON.stringify(['./', ...files]) }
  });
  return { version, count: files.length };
}

function options(clips) {
  return {
    absWorkingDir: root,
    entryPoints: [
      { in: 'src/main.ts', out: 'game' },
      { in: 'src/styles.css', out: 'game' },
      ...(fs.existsSync(path.join(root, 'perf/perf.ts')) ? [{ in: 'perf/perf.ts', out: 'perf/perf' }] : []),
      ...(fs.existsSync(path.join(root, 'mictest/mictest.ts')) ? [{ in: 'mictest/mictest.ts', out: 'mictest/mictest' }] : [])
    ],
    outdir: dist,
    bundle: true,
    format: 'iife',
    target: 'safari18',
    minify: !dev,
    sourcemap: true,
    external: ['*.ttf'],          // the font is a separate file next to the page
    logLevel: 'warning',
    define: { __RECORDINGS__: JSON.stringify(clips), __DEV__: String(dev) }
  };
}

function recordings() {
  const { clips, problems } = findRecordings(root);
  for (const p of problems) console.log('Note: ' + p);
  return clips;
}

if (!dev) {
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist);
  const clips = recordings();
  await esbuild.build(options(clips));
  copyFiles(clips);
  const sw = await buildServiceWorker();
  console.log(`Built dist/: ${sw.count} files saved for offline use, ${Object.keys(clips).length} recording(s), version ${sw.version}.`);
} else {
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist);
  const clips = recordings();
  const after = {
    name: 'copy-and-offline-list',
    setup(build) {
      build.onEnd(async (result) => {
        if (result.errors.length) return;
        copyFiles(clips);
        await buildServiceWorker();
        console.log(new Date().toLocaleTimeString() + ' rebuilt');
      });
    }
  };
  const ctx = await esbuild.context({ ...options(clips), plugins: [after] });
  await ctx.watch();
  // esbuild only watches the files it bundles: rebuild when the page, icons or font change too
  // (a new recording needs a restart, because the recordings list is fixed when dev starts)
  for (const rel of ['index.html', 'manifest.webmanifest', 'icons', 'fonts', 'perf/index.html', 'mictest/index.html']) {
    const p = path.join(root, rel);
    if (fs.existsSync(p)) fs.watch(p, () => { ctx.rebuild().catch(() => {}); });
  }
  await ctx.serve({ servedir: dist, port: PORT, host: '127.0.0.1' });
  console.log(`Serving the game at http://localhost:${PORT}/  (add ?debug for the test hooks). Ctrl+C to stop.`);
}
