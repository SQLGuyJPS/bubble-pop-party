# Bubble Pop Party

A game for a 2-year-old learning letters and numbers. Bubbles float up, each with one large character. The game
says which one to find, and the child pops it. It is played on the family iPad (iPad 7th generation, iOS 18,
Safari, opened from the home-screen icon) and published with GitHub Pages at `/bubble-pop-party/`.

## Before you start

- Check `docs/ROADMAP.md` for the current milestone, then read its spec in `docs/specs/`. A milestone's spec is agreed
  before any code is written. If the work needs something the spec doesn't cover, ask rather than guess.
- Don't read large files whole. Search for the part you need and read just that.

## Rules that always apply

- **No network calls, tracking, analytics or ads.** After the first visit the game runs fully offline. A test checks
  this.
- **Relative paths only** (never a leading `/`), because Pages serves the game from a sub-folder. A test checks this.
- **No frameworks.** TypeScript and the browser's own features.
- **Target Safari 18 on an A10 chip.** Modern JavaScript and CSS are fine. Speed is the real limit: stay inside
  the speed limits in `docs/ROADMAP.md`.
- **No more than 4 bubbles.** This is a design limit for clarity, not a speed limit.

## Rules for the child's experience

- **Nothing negative.** No buzzers, no losing, no score going down. A wrong pop wobbles and the voice says what it
  was.
- **No visible countdowns or time pressure.** Hints (glow, sparkles, repeating the question) are gentle.
- **Look-alike characters never appear together** (b/d, p/q, m/w, n/u, 6/9, O/0, I/l/1, and any new pairs).
- **Only ask for a bubble the child has had time to see**, and that stays catchable for at least `MIN_CATCH_SECONDS`.
- **Only one spoken line at a time.** Never a queue of them.
- **Every setting is behind the parent gate** (3-second hold, then a sum). Nothing the child can reach leaves the
  game or changes a setting.
- **Spoken lines say letter names** ("bee"), not sounds. Every new spoken line goes into the clip list, so it can be
  recorded, and into `AUDIO-GUIDE.md`.

## Settings

A new setting needs a default, a check when settings are loaded (damaged or missing values fall back to the
default), and a test with blocked and damaged storage. Changing a default does not change a device that already
saved its settings. Say so in the pull request and the README.

## Tests

- Every rule and feature has a check in `tests/`. The run must end with `0 problems found`.
- Never weaken, skip or delete a check to get a pass. Fix the code, or ask if the rule itself seems wrong.
- New behaviour gets a new check in the same pull request.

## Commands

<!-- Milestone 5 replaces this section with the npm commands and the new layout. -->
- `node tests/invariants.mjs`: all checks.
- `node tools/update-sw.mjs`: refresh the offline file list and version. Run it before every push.
- `node tools/update-audio.mjs`: connect recordings in `audio/` (`--script` prints the words to record).
- `python -m http.server 8000`: run locally. Add `?debug` for the test hooks.

## Writing docs

`README.md` and `AUDIO-GUIDE.md` are for a parent who isn't a programmer: plain words, short numbered steps, and
the exact command to type. Update them in the same pull request as the behaviour they describe. Mark the milestone in
`docs/ROADMAP.md` when it's done.

## Git

One branch and one pull request per milestone (small fixes can have their own). Commit messages say what changed for
the player or the parent, not only what changed in the code.
