# Bubble Pop Party

A toddler game for learning letters and numbers. Colorful bubbles float up, each with one huge
character. The game shows and says which one to find, and the child pops it.

Written in TypeScript with no frameworks. No network calls, no tracking, no ads.

> Status: **Milestone 5** (TypeScript, split into files, automatic publishing). See `docs/ROADMAP.md` for what comes
> next.

## Run it on your computer

You need **Node.js 22** or newer (<https://nodejs.org>, the "LTS" download). Once, in the project folder, run:

```bash
npm install
```

Then, every time you want to play or try a change:

```bash
npm run dev
```

Open <http://localhost:8000> in your browser and press the big Play button. When you save a change, the game is
rebuilt; reload the page to see it. Press `Ctrl+C` in the terminal to stop. (A new recording in `audio/` needs a
stop and start.)

Add `?debug` to the address (<http://localhost:8000/?debug>) to switch on test hooks.

## What the game does

- Up to 4 bubbles float up. The one to find is always shown at the top with a picture, and a speaker
  button says it again.
- Popping the right bubble: pop sound, confetti, a spoken cheer, a star. Every 10 stars is a bigger party.
- The next letter is always a bubble she can already see, never one that has only just arrived at the bottom.
  A bubble qualifies when it is fully on screen and will stay catchable for at least 4 more seconds
  (`MIN_CATCH_SECONDS` in `src/config.ts`). How high up the screen that reaches depends on the bubble size and the
  speed setting: bigger bubbles take longer to leave, Fast shrinks the area and Slow widens it. Bubbles higher
  up are somewhat more likely to be picked than low ones (`HIGH_BIAS`). Only when nothing qualifies, which
  happens if she taps faster than bubbles can rise into view, is the next bubble rising from the bottom used.
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
| Letter at the top | Show or Hide (default Hide). Hide gives only the picture, the word and the spoken name |
| Hint sparkles | Auto, Always, Off |
| Computer voice | Pick a voice and press "Hear it" (it says "Great!", a short pause, then "eigh is for apple.") |
| Play time | No limit, 5, 10 or 15 minutes |

When the play time is up she sees a friendly goodbye screen and the game stops. Starting again needs the
parent gate, and then pressing Done in settings begins a new session (stars start over).
Changing letters or numbers gives fresh bubbles when you press Done.

Changing a default never changes a device that already saved its settings. For example, "Letter at the top" became
Hide by default in Milestone 5, but an iPad that had saved Show keeps showing the letter until you pick Hide once.

The word under the picture is written like the letter on the bubble to find: if the bubble shows **A**, the word is
**APPLE**; if it shows **a**, the word is **apple**. With "both", it changes from letter to letter.

## Your own voice recordings

The computer voice can sound rushed or unclear. Record your own clips and the game uses them instead.
See **[AUDIO-GUIDE.md](AUDIO-GUIDE.md)** for the words to say and the file names.

## Check the game's rules automatically

```bash
npm test
```

This checks the TypeScript, builds the game, then plays about 200 simulated games with random taps, rotations and
resizes, and checks specific features. It checks that: the target bubble is always on screen, the next letter is
never a bubble that has just arrived or is about to float away, there are never more than 4 bubbles, there are no
duplicates or look-alike characters (b/d, p/q, m/w, n/u, 6/9, O/0, I/l/1) together, the same target never repeats
straight away, wrong pops never change the target, the voice never queues more than one line, hints and repeat
prompts happen on time, confetti stays under 60 pieces, missed letters come up more, mute is silent, recordings play
one at a time with a fallback to the computer voice, the parent gate needs a full 3-second hold and the right sum,
settings are remembered (and survive blocked or damaged storage), the play-time limit ends the session until a
parent restarts it, and the word at the top matches the bubble's capital or small letter. It also checks that the
voice says exactly what it said before (`tests/fixtures/spoken-sample.txt`), that the icons are the right size, that
every file (including recordings) is in the offline list, that nothing uses a path starting with `/`, that the game
makes no network calls, that it stays inside the speed limits, and that the offline helper installs, updates and
works with no connection. It prints `0 problems found` when everything is fine.

The same checks run on GitHub for every push and pull request.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page: buttons, banner, parent screens (no code) |
| `src/` | The game's code in TypeScript, one file per area (settings, letters, speech, sound, drawing...), and `styles.css` |
| `src/sw.ts` | The offline helper (see "How the offline copy works") |
| `manifest.webmanifest` | Tells the iPad the game's name, icon and colors |
| `icons/` | The app icons (180, 192 and 512 pixels) |
| `fonts/` | The Andika font and its license (SIL Open Font License) |
| `audio/` | Your own recordings (see AUDIO-GUIDE.md) |
| `perf/` | The speed test page (see "Speed test") |
| `mictest/` | The microphone test page, for Milestone 6 only (see "Microphone test") |
| `tools/build.mjs` | Builds the game into `dist/` (`npm run build`; `npm run dev` also serves it) |
| `tools/update-audio.mjs` | Lists which recordings you have, and the words to record |
| `tools/make-icons.mjs` | Draws the icon PNGs |
| `tests/` | The automatic rules check (`npm test`), one file per area |
| `.github/workflows/deploy.yml` | Runs the checks on GitHub, and publishes the game when `main` changes |
| `dist/` | The built game. Made by the build, never edited or committed |

## Changing what the voice says

Open `src/items.ts` and find the `LETTERS` list. Each letter has a `say` spelling (for example
`B` is `bee`) that the computer voice reads aloud, plus a word (`ball`) and a picture. If a
letter sounds wrong on your tablet, change its `say` text and reload (with `npm run dev` running). Recordings (above) are the better fix.

## Putting it on the iPad (GitHub Pages)

GitHub can host the game for free. Once it is online, the iPad opens it like an app and it keeps working
with no internet.

The address is **<https://sqlguyjps.github.io/bubble-pop-party/>**. GitHub publishes it by itself whenever `main`
changes (Pages is set to deploy from GitHub Actions).

### One-time setup: add it to the iPad's home screen

1. On the iPad, open **Safari** (it must be Safari, not Chrome) and go to the address above.
2. Wait until the game shows its Play button. This first visit is when the iPad saves the game for offline use,
   so use Wi-Fi.
3. Tap the **Share** button (a square with an arrow), then **Add to Home Screen**, then **Add**.
4. From now on, start the game from the new **Bubble Pop** icon. It opens full screen with no browser bars.
5. Turn on **Airplane Mode**, then open the icon again. The game should still work, and that proves the
   offline copy is saved. (You can turn Airplane Mode off again afterwards.)

### Sending an update to the iPad

Every change reaches the iPad the same way:

1. Check it on your computer:

   ```bash
   npm test
   ```

   It should end with `0 problems found`.
2. Commit and push your change, then open a pull request into `main` and merge it once its checks are green
   (or push straight to `main` if you haven't protected it):

   ```bash
   git add -A
   git commit -m "Describe what you changed"
   git push
   ```

3. GitHub runs the checks again. If they pass, it publishes the game by itself; if anything fails, nothing is
   published and the iPad keeps the old version. You can watch this on the repository's **Actions** tab.
4. A minute or two later, on the iPad, **open the game with Wi-Fi on**. It quietly downloads the new version in the
   background. **Close it (swipe it away in the app switcher) and open it again** to play the new version.

To check which version the iPad has: pass the parent gate, open Settings, and look at the bottom for
**Game version: xxxxxxxxxx**. The same version is printed at the end of `npm run build` and in the published
`sw.js`.

### If the iPad still shows the old version

1. Open the game once on Wi-Fi, close it completely, and open it again. (Two rounds is sometimes needed.)
2. Still old? Delete the Bubble Pop icon (hold the icon, **Remove App**), open Safari, go to the address
   again and **Add to Home Screen** again. This always gives a clean, newest copy.
3. Last resort: iPad **Settings, then Apps, then Safari, then Clear History and Website Data**. This logs you out
   of websites on that iPad, so try 1 and 2 first.

### Good to know

- Only what is merged into `main` reaches the iPad; changes on your computer alone do not.
- `npm run dev` never installs the offline copy, so on your computer you always see your latest change.

## Speed test

The page <https://sqlguyjps.github.io/bubble-pop-party/perf/> finds how many moving things the iPad can draw before
the motion stops being smooth, using the game's own drawing code. It is not linked from the game and not saved for
offline use. To run it: charge the iPad, turn Low Power Mode off, open the page in Safari, tap **Start the speed
test**, keep the iPad still for a few minutes, then take a screenshot of the results. The numbers set the speed
limits in `docs/ROADMAP.md`: each limit is 80% of the most the iPad drew smoothly.

Results from the family iPad (iPad 7th generation):

| What was drawn | Most that stayed smooth | Limit the game keeps under |
| --- | --- | --- |
| Plain bubbles | 11 | 8 |
| Bubbles with the hint glow and sparkles | 4 | 3 |
| Confetti pieces | 1,839 | 1,471 |
| Bubbles and confetti together | 152 | 121 |
| Moving bubbles over a still picture | 9 | 7 |

The game itself shows at most 4 bubbles, only 1 of them glowing, and 60 confetti pieces, so it stays well under every
limit. If you run the test again on a different iPad, the limits are in `src/config.ts` and the measured numbers are
in `tests/limits.mjs`.

## Microphone test

Before the game gets its own Recordings screen (Milestone 6), the page
<https://sqlguyjps.github.io/bubble-pop-party/mictest/> checks that the iPad can record from a home-screen icon
without the game's sounds getting quieter afterwards. It is not linked from the game and not saved for offline use,
and it will be deleted when Milestone 6 is finished.

1. Open the page in Safari on the iPad.
2. Tap the Share button, then **Add to Home Screen**, then **Add**. A new icon called **Mic test** appears (a pink
   bubble with an **M**). It is separate from the game.
3. Close Safari and open **Mic test** from its icon.
4. Do the steps on the page in order. Before each of tests A to D, close Mic test fully (swipe up from the bottom and
   push it away) and open it again. The page remembers your answers.
5. Tap **Results** and take a screenshot. Send the screenshot.
6. When you are done, you can delete the Mic test icon (press and hold it, then **Remove App**).

The page records only for the test. Nothing it records is saved or sent anywhere.

## How the offline copy works

The offline helper (`src/sw.ts`, published as `sw.js`) is a small program the browser runs in the background. It
saves every file of the game (the page, its script and styles, the font, the icons and your recordings) under a
version name, and from then on serves the game from those saved files. The build lists the files and makes the
version name from their contents, so a change to any file means a new version, and the old saved copy is deleted once
the new one is ready. It is always published as `sw.js` next to `index.html`, because the iPad only updates an
installed helper from the same address. Everything uses relative paths, because GitHub Pages serves the game from a
sub-folder (`/bubble-pop-party/`).

Icons are drawn by `node tools/make-icons.mjs` (nothing to install). You only need that if you want to change the
icon's look.

## Credits

The Andika font is copyright SIL International and used under the SIL Open Font License 1.1
(see `fonts/OFL.txt`).
