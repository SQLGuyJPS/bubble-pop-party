# Playtest checks

What to try on the real devices after a pull request is merged. The checks in `tests/` run in a pretend browser, so they
can't tell you how the game looks, sounds and feels on the iPad. These lists can.

Newest first. Pull requests that only changed plans or documents are listed at the end, with nothing to check.

## Before you start

1. Wait for the update to publish: on GitHub, the **Actions** tab shows a green tick for the merge.
2. Get the new version on each device: see "Sending an update to the iPad" in `README.md` (open the game with Wi-Fi on,
   close it from the app switcher, open it again).
3. Pass the parent gate, open Settings, and check **Game version** at the bottom matches the one on the Actions run.

## Every time

After any merge, before the pull request's own list:

- The game opens from the home-screen icon and plays a full game: bubbles rise, the voice asks, a right pop cheers, a
  wrong pop wobbles and says what it was.
- Turn on Airplane Mode, close the game and open it again: it still plays, with sound.
- Settings still open through the gate (hold 3 seconds, then the sum), and your saved settings are still there.

## Pull request #11: Recording clips inside the game (Milestone 6)

Recording on the iPhone, from the home-screen icon:

- Settings shows a **Recordings** line (for example "0 of 17 recorded in your voice.") and **Open recordings**.
- Open recordings shows a group for each letter or number you play, then "Whole game". **Show every letter and
  number** lists them all. **Back to settings** goes back.
- The first **Record** after opening the app: the iPhone asks for the microphone and the panel says "Tap Allow…". Wait
  a few seconds before tapping Allow. The red dot and the ring only start after you allow, and the take is not cut
  short.
- Say the line and tap **Stop**: it plays back once, and the row says "Your voice". Try one where you don't tap Stop:
  it stops by itself after 6 seconds.
- The orange microphone dot at the top of the screen goes away after each take.
- After several takes, the pops and the computer voice are **as loud as before and come from the speakers**, not the
  earpiece.
- Record while saying nothing: "I didn't hear anything…", and any earlier recording of that line stays.
- **Re-record** a line, then **Delete** it: Delete asks first, then the row falls back to the audio file or the
  computer voice.
- Tap Record, then tap **Don't Allow**: a message says how to allow the microphone. Nothing breaks. Record still
  works after allowing it in the Settings app.
- Start a take and press the Home button (or swipe up): the take stops, nothing is saved, the old recording stays.
- Leave the Recordings screen open without touching it: after 3 minutes it closes to the game.
- Play a game: the lines you recorded play in your voice, the others in the computer voice or from `audio/`.

Moving them to the iPad:

- On the iPhone: **Save recordings to a file**, choose AirDrop, send it to the iPad. Tapping Cancel in the share sheet
  shows no error.
- On the iPad, from its home-screen icon: **Load recordings from a file**, pick the file. It says how many it found and
  loads them.
- Load the same file again: it offers **Replace those …**, **Keep mine, add only the … new ones**, and **Cancel**.
- Play a game on the iPad: the child hears your recordings, at a comfortable loudness next to the pops, and the clips
  sound about as loud as each other. (If not, note which ones: the loudness target is tuned in step 11.)
- **Delete all recordings** (it asks first), then load the file again: they're all back and play.
- Open the file on a computer: it unzips, and the `.m4a` files inside play.

Keeping them:

- Recordings survive closing the app, restarting the device, and the next game update, on both devices.
- With Airplane Mode on: recording on the iPhone, playing on the iPad, and the game itself all work.
- On your computer, `git status` shows no recordings: nothing recorded is in the repository.

## Pull request #10: Mic test file fix and the iPad's results

Checked on 2026-11-18 (results in `docs/specs/m06-recordings.md`, section 10). The mic test page is deleted at the end
of Milestone 6, so there's nothing more to check.

- The `.zip` that Mic test shares opens in the Files app and on a computer without a "damaged" message.

## Pull request #8: Mic test voice, device name and iPhone-to-iPad step

Checked on 2026-11-18 (results in the Milestone 6 spec, section 10).

- **Play test sounds** plays the computer voice as well as the pop, ta-da and chime.
- The page shows the right device (iPhone or iPad) and system version.
- Step 8: a recording sent from the iPhone loads and plays in Mic test on the iPad.

## Pull request #7: Microphone test page

Checked on 2026-11-18 (results in the Milestone 6 spec, section 10).

- The page opens at `…/bubble-pop-party/mictest/` and can be added to the home screen as its own icon.
- It isn't linked from the game, and the game is unchanged.

## Pull request #5: Speed limits from the speed test

Checked when Milestone 5 was marked done. Nothing should look different.

- A long game stays smooth on the iPad, including the confetti after a right pop and the glow and sparkles after a
  few wrong pops.

## Pull request #4: TypeScript rewrite, banner changes, automatic publishing (Milestone 5)

Checked when Milestone 5 was marked done (the iPad updated, played offline and passed the speed test).

- Merging to `main` publishes the game by itself: the Actions tab shows the checks and then the deploy.
- The game plays exactly as before, apart from the banner below.
- **Letter at the top** defaults to **Hide**, but only on a device that never saved its settings. The family iPad
  keeps **Show** until you pick Hide once.
- The word under the picture matches the bubble to find: **APPLE** for A, **apple** for a. With **Both**, it changes
  from target to target. Numbers are unchanged.
- The speed test page opens at `…/bubble-pop-party/perf/` and isn't linked from the game.

## Pull request #3: Ask for bubbles already fully on screen

- The bubble the voice asks for is fully on screen, not just peeking in at the bottom.
- Higher bubbles are asked for more often than low ones.

## Pull request #2: Ask only for bubbles that stay catchable

- The bubble the voice asks for never floats off the top before the child has had a few seconds to tap it. Try
  every **Bubble speed**, especially the fastest.

## Pull request #1: Letter at the top setting; A and E said correctly

- Settings has **Letter at the top**: **Hide** shows only the picture, and the voice still says the name.
- The computer voice says A as "ay" (as in "day") and E as "ee", not "eye" or "E E". (A was changed again later to
  "eigh", in a commit straight to `main`.)

## Nothing to check

- **#6** marked Milestone 5 done in the roadmap.
- **#9** the Milestone 7 spec.
