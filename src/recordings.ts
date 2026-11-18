/* Your own recordings. Files in audio/ with a clip name (prompt-B.m4a, cheer-B.m4a, that-B.m4a, party.m4a,
   bye.m4a) are found by the build and listed here; they play instead of the computer voice. See AUDIO-GUIDE.md.
   Every clip name, its words and its file name are in the clip list, src/clips.ts.
   A copy, so the tests can add clips. */
export const AUDIO_OVERRIDES: Record<string, string> = { ...__RECORDINGS__ };
