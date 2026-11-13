/* Your own recordings. Files in audio/ with a clip name (prompt-B.m4a, cheer-B.m4a, that-B.m4a, party.m4a,
   bye.m4a) are found by the build and listed here; they play instead of the computer voice. See AUDIO-GUIDE.md.
   Clip names that say() uses:
     prompt:<item>   "Can you find the letter B?"
     cheer:<item>    "Great!" (short pause) "B is for ball."
     that:<item>     "That's the letter B."   (used first when a wrong bubble is popped)
     party           "Hooray! You popped ten bubbles!"
     bye             "All done! Great playing. Bye bye!"  (when play time is up)
   A copy, so the tests can add clips. */
export const AUDIO_OVERRIDES: Record<string, string> = { ...__RECORDINGS__ };
