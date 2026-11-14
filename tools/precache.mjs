// The offline file list and its version. Used by the build and by the tests, so both agree.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/** Every file the game needs offline: everything in dist/ except the test pages (perf/, mictest/), source maps and sw.js. */
export const TEST_PAGES = ['perf', 'mictest'];   // published, but never saved for offline use

export function precacheFiles(dist) {
  const out = [];
  const walk = (rel) => {
    for (const name of fs.readdirSync(path.join(dist, rel)).sort()) {
      const r = rel ? `${rel}/${name}` : name;
      if (fs.statSync(path.join(dist, r)).isDirectory()) { if (!TEST_PAGES.includes(r)) walk(r); continue; }
      if (r === 'sw.js' || r.endsWith('.map')) continue;
      out.push(r);
    }
  };
  walk('');
  return out;
}

/** A version made from the names and contents of the files, so any change gives a new version. */
export function versionFor(dist, files) {
  const hash = crypto.createHash('sha256');
  for (const f of files) hash.update(f + '\0').update(fs.readFileSync(path.join(dist, f))).update('\0');
  return 'bubble-pop-party-' + hash.digest('hex').slice(0, 10);
}
