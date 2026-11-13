// Finds your recordings in audio/ and works out which clip each one is.
// Used by the build (tools/build.mjs) and by tools/update-audio.mjs.
//
// A file is used when its name is a clip name: prompt-B.m4a, cheer-B.m4a, that-B.m4a, party.m4a, bye.m4a
// (letters A-Z or numbers 0-9; m4a, mp3, wav, ogg or aac). Any other file is left out of the game, with a
// message saying so. That is also how to switch a recording off for a while: rename it, for example to
// "mute.prompt-A.m4a".
import fs from 'node:fs';
import path from 'node:path';

export const AUDIO_EXT = ['m4a', 'mp3', 'wav', 'ogg', 'aac'];

/** @returns {{ clips: Record<string, string>, problems: string[] }}  clip name -> 'audio/<file>' */
export function findRecordings(root) {
  const dir = path.join(root, 'audio');
  const clips = {};
  const problems = [];
  if (!fs.existsSync(dir)) return { clips, problems };
  const files = fs.readdirSync(dir).filter((f) => !f.startsWith('.') && f !== 'README.txt').sort();
  for (const f of files) {
    const m = f.match(/^(prompt|cheer|that)-([A-Za-z0-9])\.([A-Za-z0-9]+)$/) || f.match(/^(party|bye)()\.([A-Za-z0-9]+)$/);
    if (!m || !AUDIO_EXT.includes(m[3].toLowerCase())) {
      problems.push(`audio/${f} is left out: its name is not a clip name (examples: cheer-B.m4a, prompt-3.mp3, party.m4a, bye.m4a)`);
      continue;
    }
    const clip = m[1] === 'party' || m[1] === 'bye' ? m[1] : `${m[1]}:${m[2].toUpperCase()}`;
    if (clips[clip]) { problems.push(`two files for ${clip}: ${path.basename(clips[clip])} and ${f}. Using the first.`); continue; }
    clips[clip] = 'audio/' + f;
  }
  return { clips, problems };
}
