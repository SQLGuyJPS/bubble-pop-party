# Bubble Pop Party

A toddler game for learning letters and numbers. Colorful bubbles float up, each with one huge
character. The game shows and says which one to find, and the child pops it.

Plain HTML, CSS and JavaScript. No frameworks, no network calls, no tracking, no ads.

> Status: **Milestone 3** (parent gate, settings, play-time limit). The offline install and
> GitHub Pages deploy (M4) come next.

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

## What the game does

- Up to 4 bubbles float up. The one to find is always shown at the top with a picture, and a speaker
  button says it again.
- Popping the right bubble: pop sound, confetti, a spoken cheer, a star. Every 10 stars is a bigger party.
- Popping a wrong bubble: it wobbles and the voice says what it was and what to find. No buzzers, no score loss.
- If she hasn't found it after 2 wrong pops, or after about 15 quiet seconds, the target bubble glows and
  pulses. While nobody taps, the question is repeated about every 8 seconds.
- Letters she misses come up more often. The sparkle on the hinted bubble appears only for letters she has
  missed, and fades once she finds them first try (settings can make it Always or Off).
- The speaker button in the bottom-left corner turns all sound off (and back on).

## The parent area

A small gear sits in the bottom-right corner. It opens a gate that a 2-year-old can't pass: **press and hold the
big button for 3 seconds**, then **answer a two-digit addition problem** on the number pad (a different problem
after every wrong answer). While the gate or settings are open the game is paused.

Settings (saved on the device; if the browser blocks saving, the game just uses the defaults):

| Setting | Choices |
| --- | --- |
| What to practice | Letters, Numbers, or Both |
| Which letters / numbers | Tap to choose. Default A–E and 1–5. At least one always stays on |
| Capital or small letters | ABC, abc, or both |
| Bubble speed | Slow, Normal, Fast |
| Volume | 20% to 100% |
| Hint sparkles | Auto, Always, Off |
| Computer voice | Pick a voice and press "Hear it" (it says "Yay! ay! ay is for apple.") |
| Play time | No limit, 5, 10 or 15 minutes |

When the play time is up she sees a friendly goodbye screen and the game stops. Starting again needs the
parent gate, and then pressing Done in settings begins a new session (stars start over).
Changing letters or numbers gives fresh bubbles when you press Done.

## Your own voice recordings

The computer voice can sound rushed or unclear. Record your own clips and the game uses them instead.
See **[AUDIO-GUIDE.md](AUDIO-GUIDE.md)** for the words to say, the file names, and the one command to run.

## Check the game's rules automatically

```bash
node tests/invariants.mjs
```

This plays about 200 simulated games with random taps, rotations and resizes, then checks specific
features. It checks that: the target bubble is always on screen, there are never more than 4 bubbles,
there are no duplicates or look-alike characters (b/d, p/q, m/w, n/u, 6/9, O/0, I/l/1) together, the same
target never repeats straight away, wrong pops never change the target, the voice never queues more than
one line, hints and repeat prompts happen on time, confetti stays under 60 pieces, missed letters come up
more, mute is silent, recordings play one at a time with a fallback to the computer voice, the parent gate
needs a full 3-second hold and the right sum, settings are remembered (and survive blocked or damaged
storage), and the play-time limit ends the session until a parent restarts it. It prints
`0 problems found` when everything is fine.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole game (HTML, CSS and JavaScript in one file) |
| `fonts/` | The Andika font and its license (SIL Open Font License) |
| `audio/` | Your own recordings (see AUDIO-GUIDE.md) |
| `tools/update-audio.mjs` | Connects your recordings to the game (not part of the game itself) |
| `tests/invariants.mjs` | The automatic rules check (not part of the game) |

## Changing what the voice says

Open `index.html` and find the `LETTERS` list. Each letter has a `say` spelling (for example
`B` is `bee`) that the computer voice reads aloud, plus a word (`ball`) and a picture. If a
letter sounds wrong on your tablet, change its `say` text and reload. Recordings (above) are the better fix.

## Deploying and updating

Added in Milestone 4.

## Credits

The Andika font is copyright SIL International and used under the SIL Open Font License 1.1
(see `fonts/OFL.txt`).
