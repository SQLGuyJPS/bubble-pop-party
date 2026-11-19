// Loads the game's clip list (src/clips.ts) and default settings (src/config.ts) into Node, compiled in memory with
// esbuild, so the tools and the checks read the very same list as the game. No build step needed.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const out = await esbuild.build({
  stdin: {
    contents: "export * from './src/clips.ts'; export { DEFAULTS } from './src/config.ts'; export { poolFor } from './src/items.ts';",
    resolveDir: root,
    loader: 'ts'
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  write: false,
  logLevel: 'silent'
});

/** @type {{ allClips: () => any[], clipsFor: (s: any) => any[], clipByName: (n: string) => any, clipByFile: (f: string) => any,
 *           ALL_ITEMS: string[], WHOLE_GAME: string, DEFAULTS: any, poolFor: (s: any) => string[] }} */
export const clips = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
