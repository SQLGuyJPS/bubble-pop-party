# Bubble Pop Party

A toddler game for learning letters and numbers. Colorful bubbles float up, each with one huge
character. The game shows and says which one to find, and the child pops it.

Plain HTML, CSS and JavaScript. No frameworks, no network calls, no tracking, no ads.

> Status: **Milestone 1** (core loop). Hints, stars and confetti, the parent area, the offline
> install and the GitHub Pages deploy arrive in later milestones.

## Run it on your computer

You need Python (already installed on this computer). In the project folder, run:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000> in your browser and press the big Play button.
Press `Ctrl+C` in the terminal to stop the server.

You can also just double-click `index.html`. The game works that way too; only the offline
install (a later milestone) needs the server.

Add `?debug` to the address (<http://localhost:8000/?debug>) to switch on test hooks.

## Check the game's rules automatically

```bash
node tests/invariants.mjs
```

This plays about 200 simulated games with random taps, rotations and resizes. It checks that:
the target bubble is always on screen, there are never more than 4 bubbles, there are no
duplicates or look-alike characters (b/d, p/q, m/w, n/u, 6/9, O/0, I/l/1) together, the same
target never repeats straight away, wrong pops never change the target, and the voice never
queues more than one line. It prints `0 problems found` when everything is fine.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole game (HTML, CSS and JavaScript in one file) |
| `fonts/` | The Andika font and its license (SIL Open Font License) |
| `tests/invariants.mjs` | The automatic rules check (not part of the game) |

## Changing what the voice says

Open `index.html` and find the `LETTERS` list. Each letter has a `say` spelling (for example
`B` is `bee`) that the computer voice reads aloud, plus a word (`ball`) and a picture. If a
letter sounds wrong on your tablet, change its `say` text and reload.

To use your own recordings later, put audio files in the project and list them in
`AUDIO_OVERRIDES`, for example `'cheer:B': 'audio/cheer-b.mp3'`. The keys are described in the
comment above that list.

## Deploying and updating

Added in Milestone 4.

## Credits

The Andika font is copyright SIL International and used under the SIL Open Font License 1.1
(see `fonts/OFL.txt`).
