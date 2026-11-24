/* Where each clip comes from. In order:
     1. your recording made in the game (or loaded from a backup file) on this device, if it's usable;
     2. otherwise a file in audio/ with the clip's name, published with the game (see AUDIO-GUIDE.md);
     3. otherwise the computer voice.
   Every clip name, its words and its file name are in the clip list, src/clips.ts. */
import { savedNames } from './store';

/* Files in audio/ found by the build: clip name -> 'audio/<file>'. A copy, so the tests can add clips. */
export const AUDIO_OVERRIDES: Record<string, string> = { ...__RECORDINGS__ };

/* Recordings made in the game, on this device. */
export const own = {
  saved: new Set<string>(),                       // clips with a saved recording (read at start-up, without the audio)
  buffers: {} as Record<string, AudioBuffer>,     // decoded, trimmed and levelled: ready to play
  problems: {} as Record<string, 'damaged' | 'words'>,  // saved, but not played (the Recordings screen says why)
  listed: false                                    // the saved list has been read (or storage gave up)
};

/* At start-up: which clips have a recording. The audio itself is read and decoded straight after (sound.ts). */
export async function loadSavedList(): Promise<void> {
  try { for (const n of await savedNames()) own.saved.add(n); } finally { own.listed = true; }
}

export type Source = 'own' | 'file' | 'voice';

/* What plays for a clip right now. A recording that hasn't finished decoding yet uses the next source. */
export function sourceFor(clip: string): Source {
  if (own.buffers[clip]) return 'own';
  if (AUDIO_OVERRIDES[clip]) return 'file';
  return 'voice';
}
