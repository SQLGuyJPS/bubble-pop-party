# Bubble Pop Party

A toddler game for learning letters and numbers. Colorful bubbles float up, each with one huge
character. The game shows and says which one to find, and the child pops it.

Plain HTML, CSS and JavaScript. No frameworks, no network calls, no tracking, no ads.

> Status: **Milestone 4** (icons, offline install, GitHub Pages deploy). All four milestones are done.

## Run it on your computer

You need Python (already installed on this computer). In the project folder, run:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000> in your browser and press the big Play button.
Press `Ctrl+C` in the terminal to stop the server.

You can also just double-click `index.html`. The game works that way too; only the offline
install needs a web address (the server, or GitHub Pages).

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
| Computer voice | Pick a voice and press "Hear it" (it says "Great!", a short pause, then "ay is for apple.") |
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
storage), and the play-time limit ends the session until a parent restarts it. It also checks that the icons are
the right size, that every file (including recordings) is in the offline list, that nothing uses a path starting with
`/`, that the game makes no network calls, and that the offline helper installs, updates and works with no
connection. It prints
`0 problems found` when everything is fine.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole game (HTML, CSS and JavaScript in one file) |
| `manifest.webmanifest` | Tells the iPad the game's name, icon and colors |
| `sw.js` | The offline helper (see "How the offline copy works") |
| `icons/` | The app icons (180, 192 and 512 pixels) |
| `fonts/` | The Andika font and its license (SIL Open Font License) |
| `audio/` | Your own recordings (see AUDIO-GUIDE.md) |
| `tools/update-sw.mjs` | Run before every push: refreshes the offline file list and version (not part of the game itself) |
| `tools/make-icons.mjs` | Draws the icon PNGs |
| `tools/update-audio.mjs` | Connects your recordings to the game |
| `tests/invariants.mjs` | The automatic rules check (not part of the game) |

## Changing what the voice says

Open `index.html` and find the `LETTERS` list. Each letter has a `say` spelling (for example
`B` is `bee`) that the computer voice reads aloud, plus a word (`ball`) and a picture. If a
letter sounds wrong on your tablet, change its `say` text and reload. Recordings (above) are the better fix.

## Putting it on the iPad (GitHub Pages)

GitHub can host the game for free. Once it is online, the iPad opens it like an app and it keeps working
with no internet.

### One-time setup: turn on GitHub Pages

1. Open <https://github.com/SQLGuyJPS/bubble-pop-party/settings/pages> (sign in if asked).
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Under **Branch**, choose **main** and the folder **/ (root)**, then press **Save**.
4. Wait 1 to 2 minutes and reload that page. A box says **Your site is live at** and shows the address:

   **<https://sqlguyjps.github.io/bubble-pop-party/>**

### One-time setup: add it to the iPad's home screen

1. On the iPad, open **Safari** (it must be Safari, not Chrome) and go to the address above.
2. Wait until the game shows its Play button. This first visit is when the iPad saves the game for offline use,
   so use Wi-Fi.
3. Tap the **Share** button (a square with an arrow), then **Add to Home Screen**, then **Add**.
4. From now on, start the game from the new **Bubble Pop** icon. It opens full screen with no browser bars.
5. Turn on **Airplane Mode**, then open the icon again. The game should still work, and that proves the
   offline copy is saved. (You can turn Airplane Mode off again afterwards.)

### Sending an update to the iPad

Every time you change the game (new recordings, a changed letter, a fix), do these steps in the project folder:

```bash
node tools/update-sw.mjs
```

This gives the game a new version number. That number is what makes the iPad download the new files.
If you added recordings, `node tools/update-audio.mjs` does this step for you.

```bash
node tests/invariants.mjs
```

Check that it ends with `0 problems found`.

```bash
git add -A
git commit -m "Describe what you changed"
git push
```

Wait about a minute for GitHub to publish. Then on the iPad, **open the game with Wi-Fi on**. It quietly downloads the
new version in the background. **Close it (swipe it away in the app switcher) and open it again** to play the
new version.

To check which version the iPad has: pass the parent gate, open Settings, and look at the bottom for
**Game version: xxxxxxxxxx**. It should match the one in `sw.js` (the `CACHE_VERSION` line) on your computer.

### If the iPad still shows the old version

1. Open the game once on Wi-Fi, close it completely, and open it again. (Two rounds is sometimes needed.)
2. Still old? Delete the Bubble Pop icon (hold the icon, **Remove App**), open Safari, go to the address
   again and **Add to Home Screen** again. This always gives a clean, newest copy.
3. Last resort: iPad **Settings, then Apps, then Safari, then Clear History and Website Data**. This logs you out
   of websites on that iPad, so try 1 and 2 first.

### Good to know

- Pages can only show files that are pushed, so run the push steps above; changes on your computer alone do not
  reach the iPad.
- While you work on your computer, `python -m http.server` also installs the offline copy in your browser.
  If a change doesn't show up on `localhost:8000`, run `node tools/update-sw.mjs` and reload twice (or open the
  page in a private window).
- Opening `index.html` by double-clicking works too. It just skips the offline copy.

## How the offline copy works

`sw.js` is a small helper the browser runs in the background. It saves every file of the game (`index.html`, the
font, the icons and your recordings) under a version name, and from then on serves the game from those saved
files. `node tools/update-sw.mjs` lists the files and makes the version name from their contents, so a change to any
file means a new version, and the old saved copy is deleted once the new one is ready. Everything uses relative paths,
because GitHub Pages serves the game from a sub-folder (`/bubble-pop-party/`).

Icons are drawn by `node tools/make-icons.mjs` (nothing to install). You only need that if you want to change the
icon's look.

## Credits

The Andika font is copyright SIL International and used under the SIL Open Font License 1.1
(see `fonts/OFL.txt`).
