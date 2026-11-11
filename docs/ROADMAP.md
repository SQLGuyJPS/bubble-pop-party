# Bubble Pop Party roadmap

Milestones 1 to 4 (the base game, the parent area, recordings from files, offline install) are done.
This plan covers what comes next. Each milestone is one pull request: the game works and all checks pass at
the end of every one.

| # | Milestone | Size | Status |
| --- | --- | --- | --- |
| 5 | Split the code into files | Medium | Planned |
| 6 | Record clips inside the game | Large | Planned |
| 7 | Counting | Medium | Planned |
| 8 | Spell my name | Medium | Planned |
| 9 | Capital-to-small matching | Small | Planned |
| 10 | Content packs (colors, shapes, animals) | Large | Planned |
| 11 | Adaptive difficulty and saved progress | Medium | Planned |
| 12 | Picture-only prompts | Small | Planned |
| 13 | Sticker book | Medium | Planned |
| 14 | Themed scenes | Medium to Large | Planned |

Order: recording comes first, then counting and the name. After that, each milestone builds on the one before it:

- Matching (9) separates what the banner shows from what the bubbles show, which picture-only prompts (12) need.
- Packs (10) come before adaptive difficulty (11) so difficulty works for every kind of content. Counting (7) is the
  first, small step toward packs.
- Picture-only prompts (12) and the sticker book (13) use the progress that 11 saves.
- Themes (14) come last so they can restyle everything, the sticker book included. They don't depend on anything,
  so they can move earlier.

## How each milestone runs

1. **Spec first.** Before any code, write a short spec in `docs/specs/` (for example `docs/specs/m06-recordings.md`):
   what the child and the parent see, the settings, the spoken lines, the edge cases, and the new checks. It is
   agreed before work starts and kept up to date until the milestone is merged.
2. **Build it.** Every milestone adds checks to the tests for its own rules.
3. **Before the pull request:** `node tools/update-sw.mjs`, then the tests with `0 problems found`. Update the README
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
- **No build step, no frameworks, no network calls.** The game must keep working from GitHub Pages, from
  `python -m http.server`, and when `index.html` is opened by double-clicking.

---

## Milestone 5: Split the code into files

**Why now:** `index.html` is about 83 KB and 2,100 lines, roughly 25,000 to 30,000 tokens when an AI assistant reads
it. In a 200,000-token context window, that one file is about 13 to 15% of the window, before the instructions,
the tests (another 13,000 to 15,000 tokens) or any conversation. Every milestone below would make it bigger:
recording alone probably adds 800 or more lines. Splitting it first means each later change loads only the files
it touches.

**What changes (and what doesn't):** the game behaves exactly the same. Only where the code lives changes.

- `index.html` keeps only the page markup (about 180 lines).
- `css/game.css` holds the styles.
- `js/` holds the script, split by job. Each file stays under about 400 lines. A likely layout:

  | File | What it holds |
  | --- | --- |
  | `js/config.js` | Tunable constants and default settings |
  | `js/items.js` | Letters, numbers, look-alikes |
  | `js/audio-overrides.js` | Your recordings list (written by `tools/update-audio.mjs`) |
  | `js/settings.js` | Loading, checking and saving settings |
  | `js/speech.js` | `say()`, the computer voice, recorded clips |
  | `js/sound.js` | Pop, fanfare and boop sounds |
  | `js/targets.js` | Spawning bubbles and choosing what to find |
  | `js/draw.js` | Drawing bubbles and confetti |
  | `js/game.js` | The main loop, start, pause, play time |
  | `js/parent.js` | The parent gate and the settings screen |
  | `js/main.js` | Wiring up buttons and starting up |

- **Plain `<script src>` tags in a fixed order, not ES modules.** Browsers block modules on pages opened by
  double-clicking (`file://`), and that must keep working. The files share one scope; the spec decides whether
  that is plain globals or one shared namespace object.
- `tools/update-sw.mjs` adds `css/` and `js/` to the offline list. `tools/update-audio.mjs` writes
  `js/audio-overrides.js` instead of editing `index.html`.
- The tests load the scripts in the order `index.html` lists them. `tests/invariants.mjs` (44 KB) is split the
  same way: a shared fake-browser harness plus one file per area, still run with one command.
- The rule "the game makes no network calls" is checked across every script file.

**Done when:** all checks pass unchanged in meaning; the printed sample of spoken lines is identical before and
after; a before-and-after screenshot of the game matches; the iPad updates to the new version and works with
Airplane Mode on.

## Milestone 6: Record clips inside the game

**What you get:** a **Recordings** screen in the parent area, with one row per clip. Each row shows the words to
say and has Record, Play, Re-record and Delete buttons, plus a count like "12 of 32 recorded". Recording stops by
itself after about 4 seconds. Silence is trimmed from both ends and the volume is evened out.

Which clip plays: your in-app recording first, then a file recording (`AUDIO_OVERRIDES`), then the computer voice.

**Main risk, tested first:** the iPad's microphone when the game is opened from the home-screen icon. Before any of
the screen is built, a throwaway test page confirms:

- the microphone prompt works from the home-screen icon;
- after recording, the game's sound doesn't get quieter or move to the earpiece (iOS can do this, so the game must
  fully let go of the microphone after every take);
- what happens when the game is opened by double-clicking: recording isn't possible there, so the Recordings
  screen explains that instead.

**Backup:** "Save recordings to a file" and "Load recordings" buttons, so clips survive deleting the app or moving
to a new iPad. Recording from files (AUDIO-GUIDE.md) stays as an alternative.

**New checks:** a fake recorder and fake storage. The playback order above; a deleted clip falls back; blocked
storage doesn't break the game; the microphone is always released; in-app recordings never appear in the offline
file list.

## Milestone 7: Counting

**Two ways to play (a setting):**

- **Count the bubble:** bubbles hold 1 to 5 dots in dice-style patterns, so a toddler can recognize small amounts at
  a glance. The banner shows "3" and the voice asks "Can you find three dots?"
- **Find the number:** the banner shows three stars and the bubbles show numbers.

**Ranges:** 1 to 5 by default. Choosing 6 to 10 switches to a ten-frame layout (a 2 by 5 grid).

**New look-alike rule:** counts above 5 that differ by one (7 and 8) never appear together.

**Reward:** on a correct pop the dots light up one by one as the voice counts "one, two, three... three dots!"

**Under the hood:** item *kinds* (letter, number, count), each with its own way of drawing a bubble. This is the
first step toward packs (Milestone 10).

## Milestone 8: Spell my name

**Setup:** the parent types the name and, if the computer voice says it wrong, a pronunciation spelling. Better
still, record the name on the Recordings screen.

**Play:** a "My name" choice under What to practice.

- Targets come in name order. The banner shows the name as tiles that fill in as letters are found.
- Finishing the name brings a big party: "J... o... s... h... Josh!"

**Details:**

- **Capitals:** a name is written with a capital first and small letters after ("Josh"), so the bubbles follow the
  name's own capitals whatever the ABC/abc setting says.
- **Repeated letters:** in a name like "Anna", each tile fills in turn.
- **Look-alikes:** look-alikes of the letter wanted right now stay off the screen, even if the name itself has both
  b and d.

The name stays on the device only.

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

**Reuse:** for numbers this is the same as Milestone 7's Find the number.

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

**Older iPads:** the background is drawn once and reused, and moving decorations are capped. Movement follows the
iPad's reduce-motion setting.

**Readability:** a check makes sure the letter on every bubble stays easy to read in every theme.

## Decisions taken unless changed

1. The child can open the sticker book from the start and goodbye screens.
2. Counting uses dots first; picture objects can come later.
3. Adaptive difficulty is off by default.
4. X becomes xylophone for picture-only prompts.
