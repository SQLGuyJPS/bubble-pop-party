# Recording your own voice for the game

The computer voice is a fallback. You can replace any of it with your own recordings, and the game
plays yours instead. You don't have to record everything: **any clip you skip keeps using the
computer voice**, so you can start with just the letter A and add more over time.

## 1. What to record

For each letter or number the game needs three short clips, plus one celebration clip for the whole game.

| File name | What to say | When the game plays it |
| --- | --- | --- |
| `prompt-A` | "Can you find the letter A?" | Telling her what to find, and every ~8 seconds if she waits |
| `cheer-A` | "Yay! A! A is for apple." | She pops the right bubble |
| `that-A` | "That's the letter A." | She pops a *wrong* bubble. It plays right before the prompt for the real target, so she hears "That's the letter A. Can you find the letter B?" |
| `party` | "Hooray! You popped ten bubbles! Great job!" | Every 10th star |
| `bye` | "All done! Great playing. Bye bye!" | When the play time you set is up |

For numbers it is the same idea: `prompt-3` "Can you find the number 3?", `cheer-3` "Yay! Three! Three stars.",
`that-3` "That's the number three."

To see the exact words for your current letters and numbers, run this in the project folder:

```bash
node tools/update-audio.mjs --script
```

Add `--all` to also see every other letter and number. For the default A–E and 1–5 that's
5 × 3 + 5 × 3 + 2 = **32 clips**.

### Tips for a good recording

- Say the letter **name**, not its sound: "bee", "see", "ay" (like "say"), not "buh", "kuh", "ah".
- Go slowly and sound happy. A 2-year-old likes a bright, clear voice.
- Record in a quiet room, with the phone or microphone close to your mouth.
- Start talking right away and stop right after the last word. Long silence at the start makes the game feel laggy.
- Keep each clip short: under about 3 seconds. The "Yay!" clip is the longest.
- Record several clips in a row in one sitting so they all sound the same volume.

## 2. How to record

Pick whichever is easiest for you. Any of these produces a file the game can use.

- **Phone (easiest):** open the *Voice Memos* app (iPhone) or *Voice Recorder* (Android), record one clip per
  memo, then send the files to your computer by email, AirDrop (Mac), or a cloud folder.
- **Windows computer:** open the *Sound Recorder* app (search for "Sound Recorder" in the Start menu).
  It saves `.m4a` files.
- **Mac:** *QuickTime Player*, then File, then *New Audio Recording*.
- **Trimming (optional):** the free program Audacity lets you cut silence off the start and end.

Accepted file types: `.m4a`, `.mp3`, `.wav`, `.ogg`, `.aac`. For the iPad, `.m4a` or `.mp3` is best.
Avoid `.wav` unless a file is tiny, because it makes the game download bigger.

## 3. Name the files

Put the files in the **`audio`** folder inside the project, named exactly like this:

```
audio/prompt-A.m4a     audio/cheer-A.m4a     audio/that-A.m4a
audio/prompt-B.m4a     audio/cheer-B.m4a     audio/that-B.m4a
audio/prompt-1.m4a     audio/cheer-1.m4a     audio/that-1.m4a
audio/party.m4a        audio/bye.m4a
```

Rules:

- Use a **capital letter**: `cheer-B.m4a`, not `cheer-b.m4a`. Web servers care about this.
- The kind is lowercase: `prompt`, `cheer`, `that`, `party`, `bye`.
- No spaces, no extra words.
- **Windows hides file endings by default.** In File Explorer, turn on *View, then Show, then File name extensions*
  so you can see the real name. Otherwise you can end up with `cheer-B.m4a.m4a` without noticing.

## 4. Connect the files to the game

After adding or changing files, run this in the project folder:

```bash
node tools/update-audio.mjs
```

It looks in the `audio` folder, tells you which clips it found, which ones are still using the computer voice,
and any file name it couldn't understand (like a typo). It also updates the list inside `index.html` for you,
so you never have to edit code.

Then check it on your computer:

```bash
python -m http.server 8000
```

Open <http://localhost:8000>, press Play, and listen. If a clip doesn't play, the game quietly
uses the computer voice for that one, and the `update-audio` report will usually tell you why.

## 5. Put it on the iPad

Recordings are part of the game, so they go out with the next deploy (Milestone 4 sets this up, and the
`audio` folder is included). After that, adding recordings later is just: add files, run
`node tools/update-audio.mjs`, then push the update. The README explains the push and the refresh step.

## If something sounds wrong

Tell me which clip (for example `cheer-C`) and what you heard. The most common causes are:

- a long silence at the start of the file (trim it),
- the file was recorded very quietly (re-record closer to the microphone), or
- two files for the same clip with different endings (the report points this out).
