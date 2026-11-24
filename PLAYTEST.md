# Playtest checks

What to try on the real devices after a pull request is merged. The checks in `tests/` run in a pretend browser, so they
can't tell you how the game looks, sounds and feels on the iPad. These lists can.

Newest first. Pull requests that only changed plans or documents are listed at the end, with nothing to check.

Each check is a box to tick. A ticked box means it was already tried on the devices (the note under the heading says
when). To keep track of a new round, tick boxes in the file on GitHub, or copy a section into the pull request.

## Before you start

1. Wait for the update to publish: on GitHub, the **Actions** tab shows a green tick for the merge.
2. Get the new version on each device: see "Sending an update to the iPad" in `README.md` (open the game with Wi-Fi on,
   close it from the app switcher, open it again).
3. Pass the parent gate, open Settings, and check **Game version** at the bottom matches the one on the Actions run.

## Every time

After any merge, before the pull request's own list:

- [ ] The game opens from the home-screen icon and plays a full game: bubbles rise, the voice asks, a right pop cheers,
  a wrong pop wobbles and says what it was.
- [ ] Turn on Airplane Mode, close the game and open it again: it still plays, with sound.
- [ ] Settings still open through the gate (hold 3 seconds, then the sum), and your saved settings are still there.

## Pull request #13: A shorter pause before the question

- [ ] Pop the right bubble: after the cheer there's a short pause (now 0.4 seconds) before "Can you find …". It feels
  natural: not rushed together, and not a noticeable wait.
- [ ] Pop a wrong bubble: "That's the letter …", the short pause, then "Can you find …".

## Pull request #12: Fixes from the Milestone 6 playtest

Your voice first, from the very first question:

- [ ] On the iPhone, with recordings saved: close the game from the app switcher, open it from its icon and tap
  **Play** straight away. If the recordings aren't ready yet, the screen says **Loading…** with a pink bar that
  fills, then the game starts by itself. The **first** question is in your voice, not the computer voice.
- [ ] The same on the iPad: the first question is in your voice, not silence.
- [ ] Open the game and wait a few seconds before tapping Play: it starts at once, with no Loading bar.
- [ ] Tapping Play again while it says Loading… changes nothing; the game still starts once.
- [ ] With no recordings on a device (or after **Delete all recordings**), Play starts at once, in the computer voice.

A short pause before the question:

- [ ] Pop the right bubble: after the cheer ("Great! … A is for apple.") there's a short pause, under a second, before
  "Can you find …". The two no longer run together.
- [ ] Pop a wrong bubble: "That's the letter …", a short pause, then "Can you find …".
- [ ] Every tenth star: the cheer, the party line, then a short pause before the question.
- [ ] The speaker button at the top (say it again) still asks straight away, with no extra wait.

Sound after loading a file:

- [ ] On the iPhone or iPad: **Delete all recordings**, then straight away **Load recordings from a file** and load the
  backup. Tap **Back to settings**, then **Done**. The question is in your voice, and the pops, the cheer and the
  ta-da all play.
- [ ] Do the same but just open the file picker and tap **Cancel**, then go back to the game: all the sounds still play.
- [ ] Lock the screen during a game (or take a phone call on the iPhone), come back and tap a bubble: the sounds play.

## Pull request #11: Recording clips inside the game (Milestone 6)

Checked on 2026-11-24 on the iPhone and the iPad: everything worked, and the loudness is good. Three problems found
there are fixed in #12, above.

Recording on the iPhone, from the home-screen icon:

- [x] Settings shows a **Recordings** line (for example "0 of 17 recorded in your voice.") and **Open recordings**.
- [x] Open recordings shows a group for each letter or number you play, then "Whole game". **Show every letter and
  number** lists them all. **Back to settings** goes back.
- [x] The first **Record** after opening the app: the iPhone asks for the microphone and the panel says "Tap Allow…".
  Wait a few seconds before tapping Allow. The red dot and the ring only start after you allow, and the take is not cut
  short.
- [x] Say the line and tap **Stop**: it plays back once, and the row says "Your voice". Try one where you don't tap
  Stop: it stops by itself after 6 seconds.
- [x] The orange microphone dot at the top of the screen goes away after each take.
- [x] After several takes, the pops and the computer voice are **as loud as before and come from the speakers**, not the
  earpiece.
- [x] Record while saying nothing: "I didn't hear anything…", and any earlier recording of that line stays.
- [x] **Re-record** a line, then **Delete** it: Delete asks first, then the row falls back to the audio file or the
  computer voice.
- [x] Tap Record, then tap **Don't Allow**: a message says how to allow the microphone. Nothing breaks. Record still
  works after allowing it in the Settings app.
- [x] Start a take and press the Home button (or swipe up): the take stops, nothing is saved, the old recording stays.
- [x] Leave the Recordings screen open without touching it: after 3 minutes it closes to the game.
- [x] Play a game: the lines you recorded play in your voice, the others in the computer voice or from `audio/`.

Moving them to the iPad:

- [x] On the iPhone: **Save recordings to a file**, choose AirDrop, send it to the iPad. Tapping Cancel in the share
  sheet shows no error.
- [x] On the iPad, from its home-screen icon: **Load recordings from a file**, pick the file. It says how many it found
  and loads them.
- [x] Load the same file again: it offers **Replace those …**, **Keep mine, add only the … new ones**, and **Cancel**.
- [x] Play a game on the iPad: the child hears your recordings, at a comfortable loudness next to the pops, and the
  clips sound about as loud as each other. (If not, note which ones: the loudness target is tuned in step 11.)
- [x] **Delete all recordings** (it asks first), then load the file again: they're all back and play.
- [x] Open the file on a computer: it unzips, and the `.m4a` files inside play.

Keeping them:

- [x] Recordings survive closing the app, restarting the device, and the next game update, on both devices.
- [x] With Airplane Mode on: recording on the iPhone, playing on the iPad, and the game itself all work.
- [x] On your computer, `git status` shows no recordings: nothing recorded is in the repository.

## Pull request #10: Mic test file fix and the iPad's results

Checked on 2026-11-18 (results in `docs/specs/m06-recordings.md`, section 10). The mic test page is deleted at the end
of Milestone 6, so there's nothing more to check.

- [x] The `.zip` that Mic test shares opens in the Files app and on a computer without a "damaged" message.

## Pull request #8: Mic test voice, device name and iPhone-to-iPad step

Checked on 2026-11-18 (results in the Milestone 6 spec, section 10).

- [x] **Play test sounds** plays the computer voice as well as the pop, ta-da and chime.
- [x] The page shows the right device (iPhone or iPad) and system version.
- [x] Step 8: a recording sent from the iPhone loads and plays in Mic test on the iPad.

## Pull request #7: Microphone test page

Checked on 2026-11-18 (results in the Milestone 6 spec, section 10).

- [x] The page opens at `…/bubble-pop-party/mictest/` and can be added to the home screen as its own icon.
- [x] It isn't linked from the game, and the game is unchanged.

## Pull request #5: Speed limits from the speed test

Checked when Milestone 5 was marked done. Nothing should look different.

- [x] A long game stays smooth on the iPad, including the confetti after a right pop and the glow and sparkles after a
  few wrong pops.

## Pull request #4: TypeScript rewrite, banner changes, automatic publishing (Milestone 5)

Checked when Milestone 5 was marked done (the iPad updated, played offline and passed the speed test).

- [x] Merging to `main` publishes the game by itself: the Actions tab shows the checks and then the deploy.
- [x] The game plays exactly as before, apart from the banner below.
- [x] **Letter at the top** defaults to **Hide**, but only on a device that never saved its settings. The family iPad
  keeps **Show** until you pick Hide once.
- [x] The word under the picture matches the bubble to find: **APPLE** for A, **apple** for a. With **Both**, it changes
  from target to target. Numbers are unchanged.
- [x] The speed test page opens at `…/bubble-pop-party/perf/` and isn't linked from the game.

## Pull request #3: Ask for bubbles already fully on screen

- [ ] The bubble the voice asks for is fully on screen, not just peeking in at the bottom.
- [ ] Higher bubbles are asked for more often than low ones.

## Pull request #2: Ask only for bubbles that stay catchable

- [ ] The bubble the voice asks for never floats off the top before the child has had a few seconds to tap it. Try every
  **Bubble speed**, especially the fastest.

## Pull request #1: Letter at the top setting; A and E said correctly

- [ ] Settings has **Letter at the top**: **Hide** shows only the picture, and the voice still says the name.
- [ ] The computer voice says A as "ay" (as in "day") and E as "ee", not "eye" or "E E". (A was changed again later to
  "eigh", in a commit straight to `main`.)

## Nothing to check

- **#6** marked Milestone 5 done in the roadmap.
- **#9** the Milestone 7 spec.
