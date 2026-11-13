# Milestone 5: TypeScript, split into files, automatic deploy

Status: agreed, not started.

## Goal

1. Rewrite the game in TypeScript, split into small modules, so an AI assistant only loads the parts it works on.
   Today `index.html` alone is about 25,000 to 30,000 tokens.
2. Build and publish with GitHub Actions, so the offline file list, the version and the recordings list are made by
   the build, not by hand.
3. Build a speed test page to find the iPad's real limits for the canvas.
4. Two small changes to the banner at the top of the game (section 2).

Apart from section 2, the game must behave exactly as it does now.

## 1. Out of scope

New game features, new settings (apart from the changed default in 2a), new sounds or art. Anything from Milestone 6
or later.

## 2. Changes the child and the parent will see

### 2a. "Letter at the top" defaults to Hide

- `DEFAULTS.showGlyph` becomes `false`. The settings screen shows **Hide** selected on a fresh install.
- **Saved settings are not changed.** The family iPad already has **Show** saved, so it keeps showing the letter
  until a parent picks **Hide** once in settings. There is no automatic switch, because the game can't tell a
  saved default from a parent's deliberate choice. The pull request description says this.
- The README's settings table gains its missing row: "Letter at the top: Show or Hide (default Hide)".

### 2b. The word under the picture follows the letter case

The word in the banner (for example "apple") is written in the case the letters are practised in:

| Case setting | Word shows | Why |
| --- | --- | --- |
| ABC (capitals) | APPLE | Matches the bubbles |
| abc (small) | apple | Matches the bubbles |
| Both | apple | Children learning small letters usually already know capitals, so small letters are what needs practice |
| Match (comes in Milestone 9) | apple | Same reason as Both |
| Numbers only (no case setting shown) | three stars | As today |

- When letters and numbers are both being practised, the rule applies to every banner word, numbers included
  ("THREE STARS" with ABC).
- Only the written word changes. Speech, recordings and the picture stay the same.
- The rule lives in one function (for example `bannerWordCase()`), so Milestone 9 adds its Match case in one place.

New checks: the default is Hide; a saved Show is kept; for each case setting, the banner word's case matches the
table, including mixed letters and numbers.

## 3. Layout after the milestone

```
index.html              page markup only
src/                    TypeScript modules and styles.css (layout below)
src/sw.ts               the offline helper
tools/build.mjs         the build (esbuild)
tools/make-icons.mjs    unchanged
tools/update-audio.mjs  only --script (prints the words to record) and a check of audio/ file names
tests/                  harness + one file per area
perf/                   the speed test page
icons/ fonts/ audio/    unchanged
dist/                   build output, not committed (.gitignore)
.github/workflows/      checks and deploy
```

Modules (each under about 400 lines):

| Module | Holds |
| --- | --- |
| `config.ts` | Tunable constants, defaults, speed limits |
| `items.ts` | Letters, numbers, look-alikes, `glyphFor`, `bannerWordCase` |
| `state.ts` | The shared game state (one object; see below) |
| `settings.ts` | Load, check and save settings |
| `speech.ts` | `say()`, computer voice, recorded clips, the clip list |
| `sound.ts` | Audio context, pop, fanfare, boop, mute, volume |
| `targets.ts` | Spawning bubbles, choosing the target, catchability |
| `draw.ts` | Bubbles, confetti, resize and layout |
| `game.ts` | Main loop, start, pause, resume, play time, pops |
| `banner.ts` | Banner and stars |
| `parent.ts` | Parent gate and settings screen |
| `debug.ts` | The `?debug` and test hooks (same API the tests use today) |
| `main.ts` | Looks up the page elements, wires up events, starts up |

**Shared state.** Today the script is one function with many shared variables (`target`, `bubbles`, `settings`,
`simTime`...). An ES module can't reassign another module's variable, so the changing game state moves into one
typed `state` object in `state.ts`. Constants stay as exported `const`s.

**TypeScript settings:** `strict: true`, `noUncheckedIndexedAccess: true`, target ES2022, `lib: ["ES2022", "DOM"]`.
No `any` unless a comment says why (the fake-browser hooks may need it).

**Code style:** modern TypeScript (`const`/`let`, arrow functions, classes where they help). The comments that explain
why a rule exists (iOS audio workarounds, catchability, look-alikes) move across with the code. They are part of
the design.

## 4. Build

`tools/build.mjs`, using esbuild:

1. Bundle `src/main.ts` into `dist/game.js` (one script, IIFE format, minified, with a source map) and
   `src/styles.css` into `dist/game.css`. esbuild target `safari18`.
2. Copy `index.html` (pointing at `game.js` and `game.css`), `manifest.webmanifest`, `icons/`, `fonts/` and the
   recordings.
3. **Recordings list:** look in `audio/`. Files named like the clip names (`prompt-B.m4a`, `party.mp3`, ...) are
   copied and listed for the game. Any other file (such as `mute.prompt-A.m4a`) is left out, and the build prints
   one line saying so. This replaces the hand-run `update-audio.mjs` and the `AUDIO_OVERRIDES` block.
4. **Offline helper:** bundle `src/sw.ts` into `dist/sw.js`, with the file list and a version made from a hash of
   everything in `dist/`. This replaces `tools/update-sw.mjs` (deleted).
5. Build `perf/` into `dist/perf/` (not in the offline list).

Keep **`sw.js` at the site root and `index.html` as the start page**. The iPad already has the old offline helper
installed under that name, and it only updates itself to a new `sw.js` at the same address.

`package.json` scripts:

| Command | Does |
| --- | --- |
| `npm run dev` | Builds, serves `dist/` at `http://localhost:8000`, rebuilds on change. The offline helper is not registered in dev, so you never see a stale copy |
| `npm run build` | Production build into `dist/` |
| `npm run check` | `tsc --noEmit` |
| `npm test` | Check, build, then all tests |

Dependencies: `typescript` and `esbuild` only, as dev dependencies, with exact versions and a committed
`package-lock.json`. Node 22 (`.nvmrc` and `engines`).

## 5. Publishing: `.github/workflows/deploy.yml`

- **Every push and pull request:** `npm ci`, `npm run check`, `npm run build`, tests.
- **Push to `main`, after those pass:** upload `dist/` and deploy to Pages (`actions/configure-pages`,
  `actions/upload-pages-artifact`, `actions/deploy-pages`). Permissions: `pages: write` and `id-token: write`.
  Only one deploy runs at a time.
- If any step fails, nothing is published.
- Pages is already set to deploy from GitHub Actions.

## 6. Tests

- **The harness loads the built `dist/game.js`** into the fake browser, so the tests check what actually ships. The
  debug hooks keep their current API, so the existing checks move across with their meaning unchanged.
- **Split by area:**
  - `tests/harness.mjs`: the fake browser and helpers.
  - `tests/run.mjs`: runs every area and prints `N problems found`.
  - One file per area: `gameplay`, `targets`, `speech`, `parent`, `install`, `banner`, `limits`.
- **Install checks change to match the build:**
  - `dist/sw.js` lists every file in `dist/` except `perf/` and source maps.
  - Its version matches the contents.
  - Every listed file exists.
  - The offline helper tests run against `dist/sw.js`.
- **"No network calls" and "no leading `/`"** are checked across `src/` and `index.html`.
- **New `limits` area:** it fails if a simulated game goes over any limit set in `config.ts`. To start with, that
  is the SVG limits (4,800 in total, 650 moving), plus the canvas limit once section 7 has measured it.
- **Spoken-lines baseline:** before any code moves, save today's printed sample of spoken lines to
  `tests/fixtures/spoken-sample.txt`. Apart from the banner changes, the new build must print it identically.

## 7. Speed test page

The canvas has **no moving-object limit yet**. This page measures it on the iPad.

- Published at `.../bubble-pop-party/perf/`, not linked from the game, and not saved for offline use.
- Uses the game's own drawing code (`draw.ts`), at the iPad's real screen size and pixel density.
- Runs each case on its own, adding objects in steps until motion stops being smooth. "Smooth" means frames at the
  screen's rate with no more than 1 in 20 frames late; the exact rule is decided while building, and the page shows
  it. The cases:
  1. plain bubbles (gradient, outline, letter);
  2. bubbles with the hint glow and sparkles;
  3. confetti pieces;
  4. a mix of all three, in the game's proportions;
  5. still objects drawn once onto a cached layer, plus moving bubbles on top, to confirm that cached still objects
     cost almost nothing.
- Shows the breaking point for each case in large text (a screenshot is enough to record it), and how the iPad was
  set up (screen size, pixel density, Low Power Mode if detectable).
- **After the measurement:** the numbers go into the roadmap's speed limits, and you choose the canvas limits. The
  other game used about 60% of the breaking point. The limit goes into `config.ts` and the `limits` test.

## 8. Docs

- **README:**
  - "Run it on your computer": `npm install`, then `npm run dev`. Remove double-click and Python.
  - "Sending an update": push to `main`; the checks run and the game publishes itself; then open the game on the
    iPad with Wi-Fi.
  - Remove the "turn on Pages" steps (already done) and every mention of `update-sw.mjs`.
  - Update the files table and the settings table (2a).
- **AUDIO-GUIDE:** put files in `audio/` and push. No tool to run. Explain that files with other names are left out.
- **CLAUDE.md:** replace the Commands section with the npm commands and the new layout.
- **ROADMAP:** mark Milestone 5 Done, and add the measured canvas numbers.

## 9. Order of work

Each step is its own commit, and all checks pass at every step from 3 on:

1. Save the baselines: the spoken-lines sample, and screenshots of the start screen, the game, the parent gate and
   settings (taken with Playwright at iPad size).
2. Tooling: `package.json`, `tsconfig.json`, `tools/build.mjs`, and the workflow (checks only at first).
3. Port the code module by module, behaviour unchanged.
4. Point the tests at the bundle and split them by area.
5. Build-time recordings list and offline helper; delete `update-sw.mjs`.
6. Compare with the baselines (identical spoken lines, matching screenshots).
7. The banner changes (2a, 2b) with their checks.
8. The speed test page.
9. Docs.
10. Turn on deploying from `main`.

## 10. Done when

- [ ] `npm test` ends with `0 problems found`, on your computer and in GitHub Actions.
- [ ] The spoken-lines sample matches the baseline. The screenshots match, apart from the banner changes.
- [ ] No file in `src/` is over about 400 lines, and `index.html` is markup only.
- [ ] Merging to `main` publishes the game without any manual step.
- [ ] On the iPad: the game updates to the new version (Settings shows the new version), plays normally, and works
      in Airplane Mode.
- [ ] The speed test has been run on the iPad, the numbers are in the roadmap, and the canvas limits you chose are in
      `config.ts` and tested.
- [ ] README, AUDIO-GUIDE, CLAUDE.md and ROADMAP are updated.

## 11. Risks

- **The switch from branch deploy to Actions deploy** must keep `sw.js` and `index.html` at the same addresses, or
  the iPad stays on the old version. Test it by updating the real iPad before calling the milestone done.
- **A bundled, minified script** is harder to debug on the iPad. The source map and `?debug` help. If needed, the dev
  build can skip minifying.
- **`main` currently fails its checks**, because `audio/prompt-A.m4a` was renamed to `mute.prompt-A.m4a`. Step 5
  fixes this: renamed files are left out, with a message.
