# Bubble Pop Party roadmap

Milestones 1 to 5 (the base game, the parent area, recordings from files, offline install, the TypeScript build) are
done.
This plan covers what comes next. Each milestone is one pull request: the game works and all checks pass at
the end of every one.

| # | Milestone | Size | Status |
| --- | --- | --- | --- |
| 5 | TypeScript, split into files, automatic deploy | Large | Done |
| 6 | Record clips inside the game | Large | Planned |
| 7 | Spell my name | Medium | Planned |
| 8 | Counting | Medium | Planned |
| 9 | Capital-to-small matching | Small | Planned |
| 10 | Content packs (colors, shapes, animals) | Large | Planned |
| 11 | Adaptive difficulty and saved progress | Medium | Planned |
| 12 | Picture-only prompts | Small | Planned |
| 13 | Sticker book | Medium | Planned |
| 14 | Themed scenes | Medium to Large | Planned |

Order: recording comes first, then the name, then counting. After that, each milestone builds on the one before it:

- Matching (9) separates what the banner shows from what the bubbles show, which picture-only prompts (12) need.
- Packs (10) come before adaptive difficulty (11) so difficulty works for every kind of content. Counting (8) is the
  first, small step toward packs.
- Picture-only prompts (12) and the sticker book (13) use the progress that 11 saves.
- Themes (14) come last so they can restyle everything, the sticker book included. They don't depend on anything,
  so they can move earlier.

## How each milestone runs

1. **Spec first.** Before any code, write a short spec in `docs/specs/` (for example `docs/specs/m06-recordings.md`):
   what the child and the parent see, the settings, the spoken lines, the edge cases, and the new checks. It is
   agreed before work starts and kept up to date until the milestone is merged.
2. **Build it.** Every milestone adds checks to the tests for its own rules.
3. **Before the pull request:** `npm test` ends with `0 problems found`. Update the README
   (and AUDIO-GUIDE.md when there are new spoken lines).
4. **Try it on the real iPad**, opened from the home-screen icon.
5. Mark the milestone **Done** in the table above.

## Groundwork shared by several milestones

- **One list of every spoken clip.** A single function lists each clip with its key, its words and when it plays.
  The recording screen, `tools/update-audio.mjs --script` and the tests all read it. Later milestones only add
  entries (counting lines, the name, picture prompts), and recording support comes with them.
- **Storage.** Small settings stay in `localStorage`. Recordings and progress go in IndexedDB, and the game asks the
  browser to keep it (`navigator.storage.persist()`). If storage is blocked, the game still runs on the defaults,
  as it does today.
- **TypeScript with a build, no frameworks, no network calls.** From Milestone 5 the game is built by GitHub
  Actions and served from GitHub Pages. Locally it runs with `npm run dev`. Opening `index.html` by
  double-clicking is no longer supported.

---

## Milestone 5: TypeScript, split into files, automatic deploy

**Why now:** `index.html` is about 83 KB and 2,100 lines, roughly 25,000 to 30,000 tokens when an AI assistant reads
it. In a 200,000-token context window that one file is about 13 to 15% of the window, before the instructions, the
tests (another 13,000 to 15,000 tokens) or any conversation. Every later milestone would make it bigger. Splitting
it first means each change loads only the files it touches. Moving to TypeScript at the same time means the code is
only rewritten once.

**Full spec:** [`docs/specs/m05-typescript-build.md`](specs/m05-typescript-build.md).

**What changes for the child:** two small banner changes. Everything else behaves exactly the same.

- "Letter at the top" defaults to **Hide**. A device with settings already saved keeps what it has.
- The word under the picture is written in the same case as the letter on the bubble to find: APPLE when it's
  "A", apple when it's "a". With Both, it changes from target to target.

**The code:**

- TypeScript in `src/`, split by job into ES modules, each under about 400 lines. A likely layout:

  | File | What it holds |
  | --- | --- |
  | `src/config.ts` | Tunable constants, default settings, speed limits |
  | `src/items.ts` | Letters, numbers, look-alikes |
  | `src/settings.ts` | Loading, checking and saving settings |
  | `src/speech.ts` | `say()`, the computer voice, recorded clips |
  | `src/sound.ts` | Pop, fanfare and boop sounds |
  | `src/targets.ts` | Spawning bubbles and choosing what to find |
  | `src/draw.ts` | Drawing bubbles and confetti |
  | `src/game.ts` | The main loop, start, pause, play time |
  | `src/parent.ts` | The parent gate and the settings screen |
  | `src/main.ts` | Wiring up buttons and starting up |
  | `src/styles.css` | The styles |

- `index.html` keeps only the page markup (about 180 lines).
- **esbuild** bundles everything into one script and one stylesheet in `dist/`, the folder that gets published.
  **`tsc --noEmit`** does the type checking. Strict mode from the start.
- The build targets Safari 18 (the family iPad runs iOS 18).

**Generated at build time instead of by hand:**

- The offline file list and version in `sw.js` (today: `node tools/update-sw.mjs` before every push).
- The recordings list (today: `node tools/update-audio.mjs` edits `index.html`). The build looks in `audio/`
  itself. `update-audio.mjs --script` stays for printing the words to record.
- This removes the "forgot to run the tool" problem that currently breaks the tests on `main`.

**Publishing:**

- A GitHub Actions workflow runs on every push to `main`: install, type check, build, run the tests, then publish
  `dist/` to GitHub Pages. If a check fails, nothing is published and the iPad keeps the last good version.
- Pushes to other branches run the checks only, so a pull request shows a green or red mark.

**On your computer:**

- `npm install` once, then `npm run dev` (a local server that rebuilds when files change) replaces
  `python -m http.server`.
- `npm test` builds and runs the checks. `npm run check` runs only the type check.

**Tests:**

- The fake-browser harness stays and loads the built bundle, so the tests check what actually ships.
- `tests/invariants.mjs` (44 KB) is split into a shared harness plus one file per area, still run with one command.
- The "no network calls" and "no leading `/` paths" checks cover all of `src/`.

**Dropped:** opening `index.html` by double-clicking (`file://`). The README's instructions for that go.

**Speed test:** this milestone builds a speed test page and runs it on the iPad, to find the canvas limits (see
"Speed limits" below).

**Done when:**

- All checks pass with the same meaning as before.
- The printed sample of spoken lines is identical before and after.
- Before-and-after screenshots of the game match.
- The workflow publishes the game, and the iPad updates to it and works with Airplane Mode on.

## Milestone 6: Record clips inside the game

**What you get:** a **Recordings** screen in the parent area, with one row per clip. Each row shows the words to
say and has Record, Play, Re-record and Delete buttons, plus a count like "12 of 32 recorded". Recording stops by
itself after about 4 seconds. Silence is trimmed from both ends and the volume is evened out.

Which clip plays: your in-app recording first, then a file in `audio/`, then the computer voice.

**Main risk, tested first:** the iPad's microphone when the game is opened from the home-screen icon. Before any of
the screen is built, a throwaway test page confirms:

- the microphone prompt works from the home-screen icon;
- after recording, the game's sound doesn't get quieter or move to the earpiece (iOS can do this, so the game must
  fully let go of the microphone after every take);
- which iPadOS version is on the iPad and what Safari records in (expected: AAC in an `.m4a` file).

**Where recordings live:** in the iPad's own storage for the game, not in the GitHub repository. Recording on the
iPad never changes any file in the repo, so it never shows up in git and never needs a push. The recordings are
also never public.

**Backup and moving to another device:** "Save recordings to a file" makes one file (all clips in one bundle) and
opens the iPad's share sheet, so you can keep it in Files, iCloud Drive or email. "Load recordings" on another
device reads that file back in. This also covers deleting and re-adding the app.

**Recordings in the repo stay possible:** files in `audio/` (AUDIO-GUIDE.md) still work, and the build publishes
them with the game. Anything in `audio/` is public, because the repository is public. A recording made on the iPad
wins over a file in `audio/` with the same clip name.

**New checks:** a fake recorder and fake storage. The playback order above; a deleted clip falls back; blocked
storage doesn't break the game; the microphone is always released; in-app recordings never appear in the offline
file list.

## Milestone 7: Spell my name

**Setup:** the parent types the name and, if the computer voice says it wrong, a pronunciation spelling. Better
still, record the name on the Recordings screen.

**Play:** a "My name" choice under What to practice.

- Targets come in name order. The banner shows the name as tiles that fill in as letters are found.
- Finishing the name brings a big party. The voice spells the name aloud letter by letter, then says the whole
  name: "J... o... s... h... Josh!" Each tile lights up as its letter is said. Spelling aloud stays, even though it
  is slower than the counting reward, because learning the letter names is the point of this mode. It is one spoken
  line, so nothing else is queued behind it, and the party waits for it to finish.

**Details:**

- **Capitals:** a name is written with a capital first and small letters after ("Josh"), so the bubbles follow the
  name's own capitals whatever the ABC/abc setting says.
- **Repeated letters:** in a name like "Anna", each tile fills in turn.
- **Look-alikes:** look-alikes of the letter wanted right now stay off the screen, even if the name itself has both
  b and d.

The name stays on the device only.

## Milestone 8: Counting

**Two ways to play (a setting):**

- **Count the bubble:** bubbles hold 1 to 5 dots in dice-style patterns, so a toddler can recognize small amounts at
  a glance. The banner shows "3" and the voice asks "Can you find three dots?"
- **Find the number:** the banner shows three stars and the bubbles show numbers.

**Ranges:** 1 to 5 by default. Choosing 6 to 10 switches to a ten-frame layout (a 2 by 5 grid).

**New look-alike rule:** counts above 5 that differ by one (7 and 8) never appear together.

**Reward: rising tones, then one spoken number.** On a correct pop, each dot lights up in turn with a short tone, each
tone a step higher than the last. Then the voice says only the total: "Three!" Counting aloud word by word is too slow
(above about 5 it drags on, even with recordings) and holds up the other sounds while it plays.

- The tones are sound effects (Web Audio), not speech, so they never wait on the voice. They climb a major scale, so
  even 10 of them sound like a tune.
- The whole run of tones takes at most about 1.5 seconds. Small counts go at a relaxed pace; larger counts go faster
  to fit.
- The spoken total is one short clip per number (`count:3`, "Three!"), so it can be recorded. The next "Can you
  find...?" follows it.
- Find the number works the same way: the stars in the banner light up with the tones.
- Mute silences the tones but the lights still run.
- New checks: one tone per dot, the run fits the time limit, and the only speech is the total at the end.

**Under the hood:** item *kinds* (letter, number, count), each with its own way of drawing a bubble. This is the
first step toward packs (Milestone 10).

## Milestone 9: Capital-to-small matching

**What you get:** a new Case choice, **Match**. The banner shows "A" and the bubbles show small letters, or the
other way round, or both directions mixed. The voice asks "Find the small a."

**What it needs:** the banner's letter and the bubble's letter become separate. Small-letter look-alikes are
checked again: b/d, p/q, n/u, and the new pair l/I.

**Order:** letters whose small form looks different from the capital (a, b, d, e, g, h, q, r) come up more often than
ones that look the same (c, o, s, v, w, x, z).

## Milestone 10: Content packs

**Packs:** Letters, Numbers and Counting become packs, joined by:

- **Colors:** the whole bubble is the color.
- **Shapes:** drawn on the bubble. Look-alikes: circle/oval, square/rectangle/diamond.
- **Animals:** a picture, and "Find the cow!" The animal's sound ("moo") works best as your own recording.

**Under the hood:** one list of packs. Each pack has its items, how its bubbles are drawn, its look-alikes, its
spoken lines and its settings chips. "What to practice" becomes chips where you pick several packs. The tests run
every rule against every pack.

**Also:** the settings screen is split into sections (Play, Recordings, Look, Progress), and bubble colors stop being
random when a pack decides them.

**Caveat:** a color-blind child can't play the Colors pack, and no setting can fix that.

## Milestone 11: Adaptive difficulty and saved progress

**Saved progress:** first-try results for each item are kept across sessions. Today misses are forgotten when a
session ends.

**When it adds new items:** an item counts as mastered after about 80% first-try finds over its last 5 appearances,
across at least 2 days. When everything in play is mastered, the next item is added (F after A to E).

**How it adjusts:**

- Bubble count (2 to 4) and speed change only between rounds (after a party), never in the middle of a run of misses.
- When things get hard it lowers bubble count and speed first. It never takes items away by itself.

**Parent controls:** Auto on or off (off by default), upper limits for bubble count and speed, and a log such as
"Added F on Tuesday".

## Milestone 12: Picture-only prompts

**What you get:** the banner shows the picture and the word ("apple") with no letter, and the voice says "Apple! Can
you find the letter for apple?" The setting is Off, Auto or Always. Auto uses Milestone 11's mastery, so it only
applies to items the child already knows.

**Word fixes:** "X is for box" doesn't work here because box ends with X, so X becomes xylophone. Every other word gets
checked too.

**Reuse:** for numbers this is the same as Milestone 8's Find the number.

## Milestone 13: Sticker book

**Earning stickers:** finding an item on the first try unlocks its picture as a sticker. Mastering it turns the
sticker gold.

**The book:** pages by pack, with outlines for stickers not yet earned. Tapping a sticker says "A is for apple."

**Where the child opens it:** from the Play screen and the goodbye screen only, never during play. A new sticker is
revealed at the end of a party.

**Parent control:** a reset in the parent area.

## Milestone 14: Themed scenes

**Themes:** Sky (today's look), Underwater, Space and Garden, plus "Change each time" and an optional seasonal pick.

**What each theme sets:** background layers that drift at different speeds, bubble style, confetti shapes, a few
background animals, and the pop sound.

**Speed:** scenery that doesn't move is drawn once (as SVG, or cached on its own canvas layer) and reused. Moving
decorations stay inside the speed limits below. Movement follows the iPad's reduce-motion setting.

**Readability:** a check makes sure the letter on every bubble stays easy to read in every theme.

## Speed limits

Measured on the family iPad (iPad 7th generation) with another game: still SVGs cost almost nothing, and motion
stayed smooth up to about 1,100 moving SVGs. That game's limits, used here too:

| Limit | Value |
| --- | --- |
| SVG elements on screen, in total | 4,800 |
| SVG elements moving at once | 650 |

**How they apply here.** The SVG limits apply to anything drawn as SVG elements (the sticker book, theme scenery,
pictures in the parent area). The bubbles and confetti are drawn on a `<canvas>`, which redraws everything every
frame, so those numbers don't carry over. Milestone 5 built a speed test page
(<https://sqlguyjps.github.io/bubble-pop-party/perf/>, see the README) that found the iPad's breaking point for canvas
drawing. Each canvas limit is **80% of the breaking point**, rounded down.

Measured on the family iPad 7th generation, Safari 18.7, screen 1080 x 707 points at pixel density 2, 59 frames a
second, bubbles 346 points across. "Smooth" means no more than 1 frame in 20 takes over 1.5 times the normal frame
time, over 120 frames after a 0.5 s warm-up.

| Canvas case (iPad 7th generation, measured with the speed test) | Breaking point | Limit chosen | The game today |
| --- | --- | --- | --- |
| Plain bubbles, game size | 11 | 8 | 4 at most (design limit) |
| Bubbles with hint glow and sparkles | 4 | 3 | 1 (only the bubble being asked for glows) |
| Confetti pieces | 1,839 | 1,471 | 60 at most |
| Mix (1 bubble : 15 confetti) | 152 | 121 | 64 at most (4 bubbles + 60 confetti) |
| Moving bubbles over 400 cached still ones | 9 | 7 | not used yet (for themed scenes) |

The speed test's glow case makes every bubble glow at once, which the game never does, so the glow limit is far from
being a problem.

**Design limits stay separate.** No more than 4 bubbles, for a toddler's clarity, no matter what the iPad could
handle. The 60-piece confetti cap was set for speed. The speed test shows it can go much higher (the limit is
1,471 pieces, and 117 with 4 bubbles on screen), so bigger parties are a design choice for a later milestone.

**Checking:** `config.ts` holds the limits. With `?debug`, a corner counter shows the moving and total counts and
the frame rate. The tests fail if a simulated game ever goes over a limit.

## Decisions taken unless changed

1. The child can open the sticker book from the start and goodbye screens.
2. Counting uses dots first; picture objects can come later.
3. Adaptive difficulty is off by default.
4. X becomes xylophone for picture-only prompts.

## Decisions made

- TypeScript with an esbuild build, published by GitHub Actions (chosen over plain JavaScript with no build).
- Opening `index.html` by double-clicking (`file://`) is no longer supported.
- Modern JavaScript and CSS are fine: the target is Safari 18 on the family iPad 7th generation (iOS 18).
- SVG speed limits copied from the other game's iPad measurements.
- Canvas speed limits set at 80% of the breaking points the Milestone 5 speed test measured on the iPad.
- Pages publishes from GitHub Actions (set up).
- "Letter at the top" defaults to Hide, and the banner word matches the case of the target bubble's letter (Milestone 5).
