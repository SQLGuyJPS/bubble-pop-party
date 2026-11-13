// Runs every check. Use `npm test`, which builds the game first; or, after `npm run build`:  node tests/run.mjs
// Add --update-spoken-sample to save a new tests/fixtures/spoken-sample.txt after an intended change to what
// the voice says.
import { stats } from './harness.mjs';
import gameplay from './gameplay.mjs';
import targets from './targets.mjs';
import speech from './speech.mjs';
import parent from './parent.mjs';
import install from './install.mjs';
import limits from './limits.mjs';
import banner from './banner.mjs';

for (const area of [gameplay, speech, parent, install, targets, banner, limits]) await area();

console.log(`\n${stats.games} simulated games, ${stats.failures} problems found.`);
process.exit(stats.failures ? 1 : 0);
