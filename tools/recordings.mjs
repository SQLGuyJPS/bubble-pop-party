// Finds your recordings in audio/ and works out which clip each one is.
// Used by the build (tools/build.mjs) and by tools/update-audio.mjs.
//
// A file is used when its name (without the ending) is a clip name from the game's clip list (src/clips.ts):
// prompt-B.m4a, cheer-B.m4a, that-B.m4a, party.m4a, bye.m4a (letters A-Z or numbers 0-9; m4a, mp3, wav, ogg or aac).
// Any other file is left out of the game, with a message saying so. That is also how to switch a recording off for
// a while: rename it, for example to "mute.prompt-A.m4a".
import fs from 'node:fs';
import path from 'node:path';
import { clips as clipList } from './clips.mjs';

export const AUDIO_EXT = ['m4a', 'mp3', 'wav', 'ogg', 'aac'];

/** @returns {{ clips: Record<string, string>, problems: string[] }}  clip name -> 'audio/<file>' */
export function findRecordings(root) {
  const dir = path.join(root, 'audio');
  const clips = {};
  const problems = [];
  if (!fs.existsSync(dir)) return { clips, problems };
  const files = fs.readdirSync(dir).filter((f) => !f.startsWith('.') && f !== 'README.txt').sort();
  for (const f of files) {
    const m = f.match(/^(.+)\.([A-Za-z0-9]+)$/);
    const clip = m && AUDIO_EXT.includes(m[2].toLowerCase()) ? clipList.clipByFile(m[1]) : undefined;
    if (!clip) {
      problems.push(`audio/${f} is left out: its name is not a clip name (examples: cheer-B.m4a, prompt-3.mp3, party.m4a, bye.m4a)`);
      continue;
    }
    if (clips[clip.name]) { problems.push(`two files for ${clip.name}: ${path.basename(clips[clip.name])} and ${f}. Using the first.`); continue; }
    clips[clip.name] = 'audio/' + f;
  }
  return { clips, problems };
}
