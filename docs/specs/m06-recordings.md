# Milestone 6: Record clips inside the game

Status: **draft, waiting for agreement.** No game code is written until it is agreed. The questions in section 15
need an answer first; where a section depends on one, it says "(Q n)" and describes the recommended answer.

## Goal

1. A **Recordings** screen in the parent area: record, play, re-record and delete each spoken clip on the iPad itself.
2. Recordings stay **on the iPad only** (IndexedDB), never in the repository, never public, never on the network.
3. **Backup:** save every recording to one file through the share sheet, and load that file back on any device.
4. **One list of every spoken clip**, read by the game, the Recordings screen, `tools/update-audio.mjs` and the tests.
5. **Storage groundwork** (IndexedDB) that Milestones 7 to 13 add to.
6. Before any of the screen is built, a **throwaway microphone test page** proves recording works from the
   home-screen icon without spoiling the game's sound.

For the child nothing changes, apart from hearing a parent's voice in place of the computer voice.

## 1. Out of scope

- New spoken lines or new game features. The spoken-lines sample (`tests/fixtures/spoken-sample.txt`) stays identical.
- Editing a recording (cutting by hand, effects). Only automatic trimming and levelling.
- Syncing between devices. Moving recordings is done by hand with the backup file.
- Changing how files in `audio/` work. They keep working exactly as today.
- Anything from Milestone 7 or later. Those milestones only add entries to the clip list and stores to the database.

## 2. What the parent sees

### 2a. Getting there (Q4)

Gear, then the 3-second hold, then the sum, then Settings, as today. At the bottom of Settings there is a new
**Recordings** section:

> **Recordings**: 5 of 17 recorded in your voice. **[Open recordings]**

**Open recordings** replaces the settings panel with the Recordings screen, inside the same overlay. The game stays
paused. **Back to settings** returns. **Done** on the settings screen closes everything, as today. No control on the
Recordings screen can be reached without passing the gate.

### 2b. The Recordings screen

```
 ‹ Back to settings                         Recordings
 ─────────────────────────────────────────────────────────
 5 of 17 recorded for the letters and numbers you play.    (Q6)
 23 recorded in all.  [Show every letter and number]
 Say the letter NAME ("bee"), not its sound ("buh").

 A ──────────────────────────────────────────────────────
  "Can you find the letter A?"       ● Your voice   [Play] [Re-record] [Delete]
  "Great! … A is for apple."         ○ Computer     [Record]
  "That's the letter A."             ◐ audio file   [Record]
 B ──────────────────────────────────────────────────────
  ...
 Whole game ─────────────────────────────────────────────
  "Hooray! You popped ten bubbles! Great job!"   ...
  "All done! Great playing. Bye bye!"            ...
 ─────────────────────────────────────────────────────────
 Backup
  [Save recordings to a file]   [Load recordings from a file]
  Kept safe from automatic clearing: Yes                    (section 6)
```

- One group per letter or number in the current settings, then "Whole game" (party, bye).
- Each row shows the words to say, where the game will get the clip from (your voice, a file in `audio/`, or the
  computer voice), and the buttons. **Record** shows when there's no in-app recording. **Play**, **Re-record** and
  **Delete** show when there is one.
- **Show every letter and number** lists all 36 items (110 clips). It isn't saved.
- **Play** on a row without an in-app recording plays what the game would use (audio file or computer voice), so the
  parent can compare before recording.

### 2c. Recording one clip

1. The parent taps **Record** (or **Re-record**). Anything playing stops first, so the game's voice is never recorded.
2. The first time, iPadOS asks for the microphone. If the parent says no, see section 9.
3. A recording panel covers the screen: the words in large text, a red dot, a ring that fills over the length limit,
   and a big **Stop** button. Recording stops by itself at the limit (Q7).
4. The microphone is **fully released** (section 7).
5. The take is trimmed and levelled (section 7). If nothing was heard: "I didn't hear anything. Try again closer to
   the iPad." Nothing is saved, and any earlier recording stays.
6. The take is saved and played back once (Q8). The row now shows "Your voice".

**Re-record** only replaces the old take once the new one is saved. If the new take fails for any reason, the old one
stays. **Delete** asks for confirmation on the row ("Delete your recording of 'Can you find the letter A?'"
**[Delete]** **[Keep]**), then removes it. The row falls back to the audio file or the computer voice.

### 2d. Only one spoken line at a time

- Play on any row stops whatever else is playing.
- Record stops all playback before the microphone opens. While recording, nothing plays.
- Leaving the screen, closing settings, or the app going to the background stops playback and cancels a take that
  is still recording.
- **Hear it** in Settings still always uses the computer voice (it's there to test the voice).

## 3. What the child hears

Which clip plays, for every clip:

1. **The in-app recording** on this iPad, if there is one that's usable (not damaged, decoded, words unchanged: Q14);
2. otherwise **the file in `audio/`** with that clip name, published with the game;
3. otherwise **the computer voice**.

- A deleted or damaged in-app recording falls back to 2, then 3.
- Recordings go through the same audio path as today's `audio/` files: decoded ahead of time, played through the
  game's Web Audio context and the volume setting, muted by the speaker button.
- **When they load:** at start-up the game reads the list of saved recordings (without the audio). After the first
  tap unlocks sound, it decodes the clips the current settings can play, plus party and bye. Other clips are decoded
  when the settings change. If the child needs a clip before it has finished decoding (a fraction of a second after
  the first tap), that one play uses the next source in the list.
- The trim and the volume change are applied once, when the clip is decoded. The decoded clip is stored ready to
  play, so playing it costs no more than today's `audio/` files.

## 4. Settings

**No new settings** (Q16). The Recordings screen doesn't save anything to `localStorage`. Recordings are data, not
settings, and they live in IndexedDB (section 6).

## 5. The clip list

New module `src/clips.ts`: no page or audio code, so the Node tools can load it too.

```ts
interface Clip {
  name: string;          // 'prompt:B', 'cheer:B', 'that:B', 'party', 'bye'
  file: string;          // the audio/ file name without extension: 'prompt-B', 'party'
  item?: Key;            // 'B' for item clips; missing for whole-game clips
  group: string;         // heading on the Recordings screen: 'B', 'Whole game'
  script: string;        // what a person says: 'Great! (short pause) B is for ball.'
  speech: string[];      // what the computer voice says, in pieces: ['Great!', 'bee is for ball.']
  when: string;          // 'She pops the right bubble'
}
export function allClips(): Clip[];                    // every clip, in screen order
export function clipsFor(settings: Settings): Clip[];  // the clips the current settings can play
export function clipByName(name: string): Clip | undefined;
export function clipByFile(file: string): Clip | undefined;
```

- `textFor()` and `speechPieces()` in `speech.ts` read `speech` from here. The printed spoken sample must not change.
- `tools/update-audio.mjs --script` prints `script` and `when` from here. `tools/recordings.mjs` (the `audio/`
  name rule) accepts a file only if `clipByFile()` knows its name. The tools load `src/clips.ts` with esbuild in
  memory (no build step needed).
- The `that` line for numbers is "That's the number 3." everywhere. The tool and AUDIO-GUIDE currently
  disagree on this.
- `voicetest` stays a special case in `speech.ts`. It isn't a clip and can't be recorded.
- Later milestones add entries here (counting, the name, picture prompts). They then appear on the Recordings screen,
  in the `--script` output and in the checks with no other change.

## 6. Storage

`src/store.ts`, the IndexedDB groundwork.

- Database `bubblePopParty`, version 1, one object store `clips` (key: the clip name). Later milestones add stores
  (for example `progress`) by raising the version. `store.ts` keeps a numbered list of upgrade steps, so an old
  database upgrades one step at a time.
- One record per clip:

  | Field | What it is |
  | --- | --- |
  | `clip` | The clip name, `'prompt:B'` |
  | `audio` | The **original** recording, an `ArrayBuffer`. An ArrayBuffer rather than a Blob: older Safari versions had bugs storing Blobs, and an ArrayBuffer is simpler for the fake storage in the tests |
  | `type` | The recorded format, for example `'audio/mp4'` |
  | `words` | The `script` text when it was recorded (Q14) |
  | `trimStart`, `trimEnd` | Seconds into the original where the speech starts and ends |
  | `gain` | The volume change, a number |
  | `recordedAt` | Date and time |
  | `processing` | Version of the trim/level rules (1), so better rules later can redo old takes from the original |

- **Every record is checked when it's read**, like settings: unknown clip name, missing or empty audio, a gain that
  isn't a number between 0.1 and 10, or trims outside the clip mean the record is ignored. The row on the
  Recordings screen then says "This recording is damaged. Re-record or delete it."
- **Blocked storage** (private mode, IndexedDB missing, open fails or never answers within 3 seconds): the game runs
  exactly as today, with `audio/` files and the computer voice. The Recordings screen says "This iPad isn't letting
  the game save recordings" and hides the Record buttons. Load from a file is also hidden; Play still works.
- **Asking to keep it:** after the first recording is saved, the game calls `navigator.storage.persist()`. The
  Recordings screen shows the answer from `navigator.storage.persisted()`: "Kept safe from automatic clearing: Yes",
  or "No: save a backup file now and then". Safari decides this itself, so the game can only ask.
- **Home-screen app vs Safari tab:** on iPadOS they have **separate storage**. Recordings made in the home-screen
  app aren't seen in a Safari tab, and the other way round. When the game isn't running from the home-screen icon,
  the Recordings screen says so: "You're in Safari. Recordings made here stay in Safari. To record for the
  home-screen game, open it from its icon."
- Recordings never touch the offline helper. `sw.js` only saves the files in the build's list when it installs, and
  never stores anything while the game runs.

## 7. Recording and processing

### Microphone (details set by the test page, section 10)

- Record: `navigator.mediaDevices.getUserMedia({ audio: … })`, then a `MediaRecorder` on that stream, in the format
  the test page finds (expected `audio/mp4`, AAC).
- The microphone stream is **not** connected to the game's audio context. iOS can switch the whole app into
  "call" audio (quieter, or out of the earpiece) when the microphone joins a playing audio context. The test page
  checks whether a separate level meter is safe (Q7).
- If the test shows it helps, `navigator.audioSession.type` is set to `'play-and-record'` while recording and back to
  `'playback'` (or `'auto'`) straight after.
- **Letting go, always:** after every take, and on every early exit (Stop, the length limit, an error, the
  permission refused, leaving the screen, Done, the app going to the background, the gate's idle close),
  `recorder.stop()` if it's still running, `track.stop()` on every track, the stream and recorder are dropped,
  and the audio session is reset. One function, `releaseMic()`, does it, and every path calls it.

### Trimming silence (Q9)

The take is decoded with the game's audio context, then:

1. It's split into 20 ms windows and each window's loudness (RMS) is measured.
2. Background noise is the quietest 10% of windows. Speech is anything at least 10 dB above that, and above −50 dBFS.
3. Speech starts at the first run of **3 windows in a row** above the line, so the tap on the screen when Record is
   pressed (a short click) doesn't count. Speech ends at the last such run.
4. 0.08 s is kept before the speech and 0.15 s after, with 10 ms fades so there's no click.
5. No speech found: "I didn't hear anything", and nothing is saved.

### Evening out the volume (Q9)

- Every clip is set to the same speech loudness: the speech part's RMS is brought to **−18 dBFS**.
- The loudest peak is never allowed above −1 dBFS, so loud takes are turned down rather than distorted.
- The gain is capped at ×10 (+20 dB) so a very quiet take doesn't turn into hiss. A take that would need more gets
  "That was very quiet. Try again closer to the iPad" (it's still saved, so the parent can choose).
- The original is kept unchanged. Only `trimStart`, `trimEnd` and `gain` are stored, and they're applied when the
  clip is decoded for play.
- The −18 target is a starting point. It is tuned by ear on the iPad against the pops and the computer voice before
  the milestone is done.

These are pure functions on sample arrays (`src/level.ts`), so the tests can feed them made-up signals.

## 8. The backup file (Q11, Q12)

**Save recordings to a file** makes one file and opens the iPad's share sheet (`navigator.share({ files })`). From
there the parent picks Save to Files, iCloud Drive, AirDrop or Mail. Where sharing a file isn't supported, the file
downloads instead.

**Format (recommended): a plain ZIP**, named `Bubble Pop recordings 2026-11-14.zip`:

```
recordings.json         what's inside (below)
prompt-B.m4a            the original recordings, named like files in audio/
cheer-B.m4a
...
README.txt              two sentences: what this file is, and that it loads in the game's Recordings screen
```

```json
{ "format": "bubble-pop-party-recordings", "version": 1, "saved": "2026-11-14T10:00:00Z",
  "clips": [ { "clip": "prompt:B", "file": "prompt-B.m4a", "type": "audio/mp4", "words": "Can you find the letter B?",
               "trimStart": 0.31, "trimEnd": 1.92, "gain": 2.4, "recordedAt": "…", "processing": 1 } ] }
```

- Entries are stored without compression (AAC doesn't compress), so writing it needs only a small ZIP writer
  (`src/bundle.ts`, about 150 lines, no library). Reading also accepts compressed entries (Safari's
  `DecompressionStream`), in case a computer re-zips the file.
- A parent can open the ZIP on a computer and get ordinary `.m4a` files named like `audio/` files.

**Load recordings from a file** opens the file picker. The game then:

1. Checks the file: it must have `recordings.json` with the right `format` and a `version` it knows, and be under
   50 MB, with each clip under 2 MB and at most 500 entries. Otherwise: "This isn't a Bubble Pop recordings file."
2. Checks each clip like a stored record (section 6). Unknown clip names, damaged entries and audio that won't decode
   are skipped and counted.
3. Shows a summary and asks (Q12): "This file has 32 recordings. 12 of them are already recorded on this iPad.
   **[Replace those 12]** **[Keep mine, add only the 20 new ones]** **[Cancel]**"
4. Saves them all in one storage transaction: either everything loads, or nothing changes.
5. Reports: "Loaded 32 recordings. 2 were skipped (damaged)."

## 9. Edge cases

| Situation | What happens |
| --- | --- |
| Parent refuses the microphone, or it was refused before | "The game needs the microphone to record. To allow it: Settings app, Safari, Microphone, then Allow." Nothing breaks. Record stays available, to try again. The mic is released |
| No microphone support (`getUserMedia` or `MediaRecorder` missing) | Record buttons hidden. "This browser can't record. You can still load a recordings file, or use the audio folder (AUDIO-GUIDE)." |
| iPadOS asks for the microphone every time the app is opened | Expected in home-screen apps on some versions. The test page records whether it happens. If it does, the README says so |
| Phone call, Siri or the app going to the background during a take | Take cancelled, mic released, old recording kept, "Recording stopped. Try again." |
| Storage full when saving (Q13) | Old take kept, nothing half-saved. "There's no room to save this recording. Save a backup file, then delete some recordings or free up space on the iPad." |
| Storage blocked or damaged | Section 6. The game itself always runs |
| A recording won't decode on this iPad (for example a file from another device) | Treated as damaged: falls back, and the row says so |
| The clip's words have changed since recording (Q14) | Not played. The row says "The words for this clip have changed. Please re-record." |
| Re-record fails partway | The old take stays |
| Tapping fast: Record twice, Play during Record, Delete during Play | Buttons are disabled while a take is recording or saving. Delete stops playback of that clip first |
| Leaving the Recordings screen open (Q5) | After 3 minutes with no taps, it closes to the game, as the gate does after 25 seconds. A take in progress is cancelled |
| Very long or very loud take | The length limit stops it. The peak cap turns loud takes down |
| Same clip in the backup file and on the iPad | Q12 |
| Opened in a Safari tab, not from the icon | Works, with the separate-storage note (section 6) |
| Old database version from a later milestone downgraded | Opening fails cleanly. Treated as blocked storage, game runs on defaults |

## 10. Step 1: the microphone test page

A throwaway page, built and run **before** any of the Recordings screen.

**Where:** `mictest/index.html` and `mictest/mictest.ts`, built into `dist/mictest/` like `perf/`. Published at
`https://sqlguyjps.github.io/bubble-pop-party/mictest/`. Not linked from the game, `noindex`, **not in the offline
file list**, and covered by the "no network calls" and "no leading `/`" checks. Getting it published needs Q1.

**From the home-screen icon:** the game's home-screen app has no address bar, so it can't open the test page. The test
page instead has its own "Add to Home Screen" setup (`apple-mobile-web-app-capable`, its own title "Mic test", and
the game's icon with an "M" so the two don't get mixed up). It runs in the same kind of home-screen app as the game.
A separate app can't be identical to the game's, so the Done-when list also tries recording in the real game.

**Steps on the page** (big buttons, one step at a time; answers are kept in the page's own `localStorage`, so closing
the app between steps loses nothing):

1. **Setup.** The page shows whether it's running from the home-screen icon, and the iPadOS/Safari version it can
   read. In home-screen mode the browser may not report it, so the page asks the parent to tap the version from
   Settings, General, About, from a short list (18.0 to 18.7, 26, Other).
2. **Before.** **Play test sounds**: the game's own pop and fanfare (Web Audio, same code), a short decoded audio clip
   through the same context, then a computer-voice line. The parent notes how loud they are.
3. **Record**, in three ways, each with the iPad restarted-app clean (the page says "Close Mic test fully, swipe it
   away, and open it again" between them):
   - **A. Plain:** `getUserMedia({ audio: true })` and MediaRecorder.
   - **B. Voice processing off:** `echoCancellation`, `noiseSuppression` and `autoGainControl` all `false`.
   - **C. Audio session:** B, plus `navigator.audioSession.type = 'play-and-record'` while recording, then
     `'playback'` afterwards (skipped and noted if the iPad doesn't have it).
   - **D. With a level meter:** B, plus the microphone connected to a separate audio context's analyser for a live
     meter (tells us whether a meter, and stopping on silence, are safe: Q7).
   Each one records about 4 seconds ("Say: Can you find the letter B?"), releases the mic, and plays the take back.
4. **After**, for each of A to D: **Play test sounds** again. The parent taps one answer for the game sounds and one
   for the computer voice: **Same as before**, **Quieter**, **From the earpiece (top)**, **No sound**.
5. **Prompt again?** "Close Mic test, open it again from the icon, and tap Record once." Answer: **It asked again** or
   **It didn't ask**.

**Measured by the page itself** (no tapping needed):

- Home-screen mode (`navigator.standalone` and `display-mode: standalone`); the full user-agent text.
- `MediaRecorder.isTypeSupported` for `audio/mp4`, `audio/mp4;codecs=mp4a.40.2`, `audio/aac`,
  `audio/webm;codecs=opus`, `audio/wav`; the `mimeType` actually used; the take's size in KB, length, and whether it
  decodes (sample rate, channels).
- The microphone track's settings (`getSettings()`: sample rate, channels, echo cancellation and so on).
- The game audio context's `sampleRate` and `state` before, during and after each take. A change from 48,000 to
  16,000 or 24,000 is the usual sign of the "call audio" switch.
- After release: how many microphone tracks are still `live` (must be 0), and whether the orange microphone dot at the top of the screen is gone
  (the parent answers Yes or No).
- `navigator.audioSession`: available or not, and its `type` before and after.
- Microphone permission state, if `navigator.permissions` reports it.
- **Extras (Q2):** an ArrayBuffer saved to IndexedDB and read back intact; `storage.persist()` and `persisted()`
  answers; `storage.estimate()`; `navigator.canShare({ files })` for a small `.zip`, with a **Share a test file**
  button and a **Load a test file** button (does the file the parent just saved come back?).

**Results** are shown on one screen in large text (at least 24 px, high contrast, fits one iPad screen in landscape,
no scrolling), with one line per finding and a green "OK" or orange "Check" against each. A screenshot or a photo of
the screen is enough. Example:

```
iPadOS 18.7 · home-screen app: yes · asked for mic again: no
Format: audio/mp4 (AAC) · 4.1 s · 34 KB · decodes: yes, 48000 Hz mono
A plain        sounds after: same / voice: same      rate 48000→48000   mic live after: 0   OK
B no-process   sounds after: same / voice: same      rate 48000→48000   mic live after: 0   OK
C audioSession sounds after: same / voice: same      play-and-record→playback          OK
D meter        sounds after: QUIETER / voice: same   rate 48000→24000                  Check
Storage: IndexedDB OK · persist: yes · share a .zip: yes · load back: yes
```

**What the results decide:** the recording format and file extension; which of A to D the game uses (the simplest one
that keeps "Same" for everything); whether the Recordings screen can have a level meter and stop on silence; whether
the README must warn about the mic prompt repeating. The answers are written into this spec (section 7) before the
screen is built.

## 11. Layout

New modules (each under about 400 lines):

| Module | Holds |
| --- | --- |
| `src/clips.ts` | The clip list (section 5) |
| `src/store.ts` | IndexedDB: open, upgrade steps, read/check/write/delete clip records, persist |
| `src/mic.ts` | getUserMedia, MediaRecorder, the length limit, `releaseMic()` |
| `src/level.ts` | Trimming and levelling on sample arrays (pure) |
| `src/bundle.ts` | ZIP write and read, `recordings.json` check |
| `src/recscreen.ts` | The Recordings screen and recording panel |

Changed: `recordings.ts` (decides the source for each clip: in-app, then `audio/`, then voice), `sound.ts` (decoding
in-app clips with trim and gain), `speech.ts` (reads the clip list), `parent.ts` (the Recordings section and button),
`debug.ts` (new hooks), `index.html` (markup for the screen), `styles.css`, `tools/recordings.mjs`,
`tools/update-audio.mjs`, `tools/build.mjs` (the `mictest/` page). `precache.mjs` leaves out `mictest/` as it does
`perf/`.

## 12. New checks

Fakes added to `tests/harness.mjs`: an **in-memory IndexedDB** (with switches for missing, failing to open, never
answering, quota full, and damaged records), a **fake microphone** (`getUserMedia`, `MediaRecorder`, tracks that know
whether they're live, and a refusal switch), and a fake `decodeAudioData` that returns a chosen signal.

New area `tests/recordings.mjs`:

- **Clip list:** names are unique; every clip has `script`, `speech` and `when`; the `--script` output lists every
  clip for the chosen items; the build accepts an `audio/` file exactly when its name is in the list; the spoken
  sample is unchanged.
- **Playback order:** for every mix of in-app / `audio/` / none, the game picks the right source; a deleted, damaged,
  undecodable or changed-words (Q14) in-app clip falls back to `audio/`, then the voice.
- **Blocked storage:** with IndexedDB missing, failing, hanging or full, the game starts, plays a long simulated game
  with no errors, and the Recordings screen shows its message.
- **Damaged records** are ignored and reported on their row; a good record next to them still plays.
- **Microphone always released:** after a finished take, Stop, the length limit, a refusal, an error, leaving the
  screen, Done, the app going to the background, and the idle close, there are 0 live tracks and no recording
  running. The audio session is back to how it was.
- **One line at a time:** nothing plays while recording; Play on one row stops another; Record stops playback; the
  game's `say()` never overlaps a preview.
- **Parent gate:** the Recordings screen and every Record, Delete and Load control exist only inside the settings
  overlay, and can't be opened unless the gate was passed.
- **Re-record and storage full:** a failed or full save leaves the old take in place.
- **Trimming and levelling:** made-up signals: silence, then a tone, then silence, is trimmed to within one window; a
  short click at the start is ignored; a quiet take is raised to the target; a loud take is turned down to the peak
  cap; a take of only noise is "didn't hear anything"; the gain never goes over the cap.
- **Backup:** save then load gives back identical records; a damaged ZIP, the wrong format, a too-new version, too
  big, unknown clip names and undecodable audio are handled as section 8 says; both merge choices; a failure halfway
  changes nothing.
- **Offline:** `mictest/` isn't in the offline list; the offline helper never stores anything while running, so in-app
  recordings can't end up in it.
- **No network:** the existing check also covers `mictest/`. Object URLs (`blob:`) for playback and download are
  allowed; nothing is sent anywhere.

Updated: `tests/screens.mjs` adds screenshots of the Recordings screen and the recording panel.

## 13. Docs

- **README:** a new "Recording in the game" section, with short numbered steps: open the gate, Settings, Open
  recordings, Record. Then the backup steps (save to Files, load on another device or after reinstalling), the
  separate-storage note for Safari vs the icon, and what to do if the mic was refused. The parent-area section gains
  the Recordings line.
- **AUDIO-GUIDE:** start with "The easiest way: record in the game (README)". Keep the `audio/` folder steps for
  anyone who wants files published with the game, with the "files in `audio/` are public" warning kept. Fix the
  number wording ("That's the number 3."). Replace "wait for Milestone 6".
- **CLAUDE.md:** the layout list gains the new modules; "every new spoken line goes into the clip list" points to
  `src/clips.ts`.
- **ROADMAP:** mark Milestone 6 Done; move the answers to Q1 to Q17 into "Decisions made".
- No new spoken lines, so no new rows in AUDIO-GUIDE's clip table.

## 14. Order of work

Each step is its own commit, and all checks pass from step 3 on.

1. This spec, agreed.
2. **Microphone test page** (section 10), published (Q1). You run it on the iPad and send the results. The results
   go into sections 7 and 10. **The Recordings screen waits for this.**
3. Clip list: `src/clips.ts`; `speech.ts`, `recordings.mjs` and `update-audio.mjs` read it. Spoken sample identical.
4. Storage: `store.ts`, fake IndexedDB in the harness, blocked and damaged storage checks.
5. Playback order: in-app, then `audio/`, then voice, with stored clips put in by the tests.
6. Trimming and levelling (`level.ts`) with their checks.
7. Microphone (`mic.ts`) with the fake microphone and the release checks.
8. The Recordings screen and recording panel, inside the parent area, with their checks.
9. Backup and load (`bundle.ts`) with their checks.
10. Screenshots, docs.
11. Try it on the iPad (Done-when list). Tune the −18 dBFS target by ear. Delete the test page (Q3).

## 15. Done when

- [ ] `npm test` ends with `0 problems found`, on your computer and in GitHub Actions.
- [ ] The spoken-lines sample is unchanged.
- [ ] No file in `src/` is over about 400 lines.
- [ ] The microphone test results are in this spec, and the game uses what they showed.
- [ ] On the iPad, **from the home-screen icon**: record a few clips; the child hears them in the game; the pops and
      the computer voice are **as loud as before and from the speakers**, also after several takes; the mic dot goes
      away after each take.
- [ ] Recordings survive closing the app, restarting the iPad, and an update of the game.
- [ ] With Airplane Mode on: recording, playing and the game all work.
- [ ] Save recordings to a file in Files, delete them all in the game, load the file: they're back and play.
- [ ] Clips at the same loudness as each other, and comfortable next to the pops (tuned by ear).
- [ ] `git status` shows no recordings: nothing recorded on the iPad is in the repository.
- [ ] README, AUDIO-GUIDE, CLAUDE.md and ROADMAP are updated.

## 16. Risks

- **iOS "call audio" after using the microphone** (quieter, earpiece). This is the main risk, tested first. If no way
  of recording keeps the sound unchanged, we stop and decide together (for example: recording only in a Safari tab and
  moving clips with the backup file).
- **Safari can clear website storage.** Home-screen apps are treated better than Safari tabs, and `persist()` asks
  for more, but neither is a promise. The backup file is the safety net, and the screen says when storage isn't
  protected.
- **Memory:** decoded clips take about 0.4 MB each. With every letter and number chosen (110 clips) that is about
  40 MB. That's fine on the iPad's 3 GB, but it's why only the clips the current settings can play are decoded.
- **The test page is a separate home-screen app**, so it can differ slightly from the game's. The Done-when list
  re-checks the sound in the real game.

## 17. Questions for you

Each one has a recommendation. Answer "as recommended" for any you're happy with.

**Q1. Getting the test page onto the iPad.** Pages only publishes from `main`, and the microphone only works over
https, so the test page has to be merged before you can run it. That conflicts with "one pull request for the
milestone".
- (a) **Recommended:** a small pull request now with only the test page (plus this spec), merged to `main`. The rest
  of the milestone is the one milestone pull request afterwards.
- (b) Merge the milestone in two halves: test page and groundwork, then the screen.
- (c) Keep one pull request, and you run the test page from your computer with an https tunnel. More setup for you,
  and not the real published path.

**Q2. Extra checks on the test page.** Besides the four you listed (mic prompt from the icon, sound after recording,
iPadOS version, format), also check storage (IndexedDB, persist) and the share sheet / file load for the backup?
They need no extra steps beyond two button taps. **Recommended: yes.**

**Q3. After the milestone, delete the test page or keep it like `perf/`?** **Recommended: delete it** in the
milestone's last step, once the results are written into this spec. It's throwaway, and keeping it means keeping it
working.

**Q4. Where the Recordings screen sits.** (a) **Recommended:** a button at the bottom of Settings that opens it in
the same overlay, with "Back to settings". (b) A second button on the gate's success screen ("Settings" or
"Recordings"). (a) adds no new path through the gate.

**Q5. Toddler safety on the Recordings screen.** Today Settings has no idle timeout. Recommended: (1) **Delete
asks for confirmation on the row**; (2) the Recordings screen **closes to the game after 3 minutes with no taps**,
cancelling any take. Also add the same timeout to Settings? **Recommended: Recordings only** (no change to
Settings in this milestone).

**Q6. What the count counts.** The roadmap says "12 of 32", which is letters A–E **and** numbers 1–5. With the
default settings (letters only) the game can play 17 clips. **Recommended:** the main count is the clips the
**current settings** can play ("5 of 17"), with a second line "23 recorded in all". The list shows the current
items, with a button to show all 36.

**Q7. How recording stops.** The roadmap says "about 4 seconds". A slow, toddler-paced cheer ("Great!" … "W is for
whale.") plus the moment after tapping Record can go past 4 s. **Recommended:** a **Stop** button, and an automatic
stop at **6 seconds** (trimming removes the extra silence anyway). If the test page shows a level meter is safe (D),
also stop by itself after 1.2 s of quiet once speech was heard, and show a simple meter. Otherwise, no meter.

**Q8. After a take.** (a) **Recommended:** save it and **play it back once** automatically. Re-record is right there.
(b) Play it back and ask **Keep / Try again** before saving. Safer, but one more tap for each of 17 to 110 clips.
Related: a **"Record next"** button that moves straight on to the next unrecorded clip? **Recommended: yes**, it makes
recording 17+ clips in one sitting much quicker.

**Q9. Trimming and levelling.**
- How it's stored: (a) **Recommended:** keep the original and store the trim points and gain, applied when played
  (non-destructive, small, better rules can redo old takes, and the backup holds the originals). (b) Store a processed
  WAV (simpler at play time, about 4 times bigger, the original is lost).
- The rules are in section 7: silence = 10 dB over the background noise, 3 windows to start, 0.08 s / 0.15 s kept,
  all clips at the **same speech loudness (−18 dBFS)** with a peak cap and a ×10 gain cap. Recommended as written,
  tuned by ear on the iPad. Or would you rather only trim, with no volume change?

**Q10. Nothing heard, or very quiet.** **Recommended:** nothing heard → not saved, "Try again" message; very quiet
(needs more than ×10) → saved, with a "That was very quiet" note. Or refuse very quiet takes too?

**Q11. The backup file format.**
- (a) **Recommended: a ZIP** (`recordings.json` plus the original `.m4a` files named like `audio/` files). Opens on
  any computer, about the same size as the recordings, needs a small ZIP writer (no library). Note: tapping a ZIP in
  the Files app unpacks a copy beside it; the ZIP itself stays and is still what you load.
- (b) One JSON file with the audio inside as text (base64). Simplest code, about a third bigger, can't be opened.
- (c) A ZIP with its own ending (`.bubblepop`), so Files doesn't offer to unpack it. Might show up greyed out in the
  file picker on some versions.
- Also: because the ZIP's files are named like `audio/` files, a parent *could* copy them into `audio/` and push
  them, which makes them **public**. **Recommended:** allow it, and README says plainly that this makes them public.
  Or name them differently to stop that happening by accident?

**Q12. Loading a backup when the iPad already has some of the same clips.** (a) **Recommended:** ask, with
**Replace those** / **Keep mine, add only the new ones** / **Cancel**. (b) Always replace. (c) Keep whichever was
recorded more recently. Also: should loading offer **"Replace everything"** (delete the clips that aren't in the
file)? **Recommended: no.** That's what Delete all is for (Q15).

**Q13. Storage full.** (a) **Recommended:** keep the old take, save nothing, show the message in section 9. (b) Also
show how much space recordings use (from `storage.estimate()`) at the bottom of the screen. Recommended: (a) plus
(b). Full storage is unlikely (17 clips are about 1 MB, all 110 about 7 MB), but the message must be clear.

**Q14. When a clip's words change in a later milestone** (for example "X is for box" becoming "xylophone" in
Milestone 12, to match a picture). (a) **Recommended:** the old recording **isn't played** (the child would hear words
that don't match the picture). The row says "The words have changed. Please re-record.", and the clip falls back.
(b) Keep playing the old recording until it's re-recorded.

**Q15. "Delete all recordings"?** Not in the roadmap. **Recommended: yes**, at the bottom of the screen, behind a
confirmation that says to save a backup first. It's useful before loading a backup cleanly, or before handing the
iPad on.

**Q16. No new settings.** **Recommended:** no "use my recordings: on/off" setting. Delete, or the backup, covers
switching them off. Or do you want an on/off switch (for example to compare with the computer voice)?

**Q17. Recording from a Safari tab.** The home-screen app and a Safari tab keep separate recordings (section 6).
**Recommended:** recording works in both, with the note on screen in a Safari tab. Or only allow recording from the
home-screen icon?
