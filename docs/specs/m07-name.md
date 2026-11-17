# Milestone 7: Spell my name

Status: **agreed** (2026-11-17). The answers to the questions are in section 15; where a section depends on one,
it says "(Q n)".

**Starts after Milestone 6 is merged.** It adds entries to the clip list (`src/clips.ts`) and uses the Recordings
screen, both from Milestone 6. Nothing here changes how recordings are stored, played or backed up.

## Goal

1. A **My name** choice under What to practice. The child pops the letters of their own name, in order.
2. The banner shows the name as **tiles** that fill in as the letters are found.
3. Finishing the name brings a **big party**: the voice spells the name letter by letter, each tile lighting up as
   its letter is said, then says the whole name: "S... a... m... Sam!"
4. The parent types the name and, if the computer voice says it wrong, a **pronunciation spelling**. Better still, the
   parent records the name (and the letter names) on the Recordings screen.
5. The name **stays on the device**: never sent anywhere, never in the repository, never in a published file.

In the other modes (Letters, Numbers, Both) nothing changes. The spoken lines for them stay word for word the same.

## 1. Out of scope

- More than one name, or names of other people ("Mommy", a sibling).
- Letters outside A to Z (accents, other alphabets), spaces and hyphens (Q2).
- A spoken opening line for each round ("Let's spell Sam!") (Q12).
- Phonics or letter sounds. Spoken lines say letter **names**, as everywhere else.
- Saving progress between sessions (Milestone 11).

## 2. What the parent sees

Gear, then the 3-second hold, then the sum, then Settings, as today.

### 2a. What to practice

```
 What to practice
  [Letters] [Numbers] [Both] [My name]

 Name                                     (shown with My name)
  [ Sam            ]   Letters only, up to 10.
  How to say it (only if the computer voice gets it wrong)
  [ Sammy          ]   [Hear it]
  Best of all: record the name on the Recordings screen.
```

- **My name** can't be chosen while the Name box is empty. It shows greyed out, with "Type a name first" under it.
  The Name box is always visible in What to practice, so the parent can type a name first.
- **Name box:** letters A to Z only, up to 10 (Q2). Anything else (spaces, digits, accents, punctuation) is left
  out as it is typed, with the note "Only the letters A to Z". iPad keyboard settings: capital first word, no
  autocorrect, no spellcheck.
- **Capitals (Q3):** the name keeps the capitals typed ("McKay" stays "McKay"). A name typed all in small letters or
  all in capitals is changed to a capital first and small letters after ("sam" and "SAM" become "Sam").
- **How to say it:** what the computer voice says for the whole name. Letters, spaces, hyphens and apostrophes, up
  to 40 characters. Empty means the computer voice reads the name as typed. **Hear it** says the name with the
  computer voice, as the existing Hear it does: it never plays a recording, and it isn't a clip.
- **Emptying the Name box** while My name is chosen switches What to practice back to **Letters**.
- **Changing the name or switching to My name** starts a fresh round when Settings closes (like changing the
  letters today: fresh bubbles).

### 2b. Other settings while My name is chosen

| Setting | In My name |
| --- | --- |
| Which letters | Still shown. It also gives the extra bubbles that aren't in the name (Q4). Note: "Also used for the extra bubbles in My name." |
| Which numbers | Hidden, as in Letters |
| Capital or small letters | Hidden: the name decides. Note in its place: "My name uses the capitals in the name." |
| Letter at the top | Still shown, but the name tiles always show their letters (Q9). Note: "In My name the name is always shown." |
| Speed, volume, voice, hint sparkles, play time | Work as today |

### 2c. The Recordings screen

With My name chosen, the Recordings screen (Milestone 6) lists a **My name** group first:

```
 My name ────────────────────────────────────────────────
  "Sam!"                             ○ Computer     [Record]
  "S!"                               ○ Computer     [Record]
  "A!"                               ○ Computer     [Record]
  "M!"                               ○ Computer     [Record]
 S ──────────────────────────────────────────────────────
  "Can you find the letter S?"   ...
```

- One row for the name and one for each **different** letter in it ("Anna" has rows for A and N only).
- When the name changes, the old name recording no longer matches its words, so it isn't played and the row asks
  for a re-record (Milestone 6, Q14). Letter recordings stay, because their words don't change.
- The count at the top ("5 of 17 recorded") includes these rows.

## 3. What the child sees

### 3a. The banner

In My name the banner shows the name as a row of tiles, one per letter, in the name's own capitals. The picture and
word are not shown.

```
  ┌───┐┌───┐┌───┐
  │ S ││ a ││ m │      S: found (bright, full colour)
  └───┘└───┘└───┘      a: wanted now (outlined, gentle pulse)
                       m: still to come (faint letter)
```

- **Found:** filled with a bright colour, letter solid. It pops in as the bubble pops.
- **Wanted now:** outlined, with a gentle pulse. When the hint comes on (after 2 wrong pops or 15 seconds, as today),
  this tile bounces along with the glowing bubble.
- **Still to come:** the letter shown faint (Q9).
- The tiles shrink to fit: a 10-letter name fits across the banner in both orientations. Checked in screenshots.

### 3b. Bubbles

- **What to find comes in name order.** For "Sam": S, then a, then m, then the party, then S again.
- **Capitals follow the name, whatever the ABC/abc setting says.** In "Sam" the S bubble is a capital and the a and m
  bubbles are small. The bubble to find always shows the exact form the tile shows.
- **No other form of the letter being asked for is on screen.** While the small a of "Anna" is wanted, a capital A
  bubble never shows.
- **Extra bubbles (Q4):** the other letters of the name, topped up from the parent's Which letters list so that
  short names still have something to choose between. Name letters show the form the name uses next. Extra letters
  from the list are small, except for a capital about as often as the name has them (1 in 3 for "Sam").
- **The next letter is ready (Q5).** The letter after the one wanted now is kept on screen when it can be (it is
  chosen as the next bubble to rise), so when its turn comes it's usually already floating where the child can see
  it.
- **Repeated letters (Q6):** in "Anna", each n tile fills in turn. When two of the same letter are next to each
  other in the name, two bubbles of that letter can be up at once, and popping either one counts. The other is then
  already waiting for the next tile.
- **Look-alikes:** look-alikes of the letter wanted right now are never on screen, even when the name has both (b
  and d in "Debby"). The look-alike groups are the same as today and apply to capitals and small letters alike. If
  the next letter is a look-alike of the one wanted now, it isn't brought up early. It rises after the pop instead.
- **At most 4 bubbles**, as always.

### 3c. Only ask for a bubble the child has had time to see (Q5)

After a correct pop, the next tile starts pulsing right away. The question "Can you find the letter a?" is only said
once a bubble with that letter in the right form is **fully on screen** and catchable for at least
`MIN_CATCH_SECONDS`. Usually it already is, because the next letter was kept ready. When it has to rise from the
bottom (the first letter of a round, a look-alike pair, a double letter that wasn't up yet), the cheer plays, the
bubble rises, and the question follows when the bubble is fully in view. There's no countdown, and the prompt
repeat and hint timers start from the question.

## 4. What the child hears

| Moment | Says | Clips |
| --- | --- | --- |
| A letter is wanted | "Can you find the letter ay?" | `prompt:A` (existing, the same for capital and small) |
| Correct pop, not the last letter (Q1) | "Ay!" then the next question | `letter:A`, then `prompt:…` |
| Wrong pop | "That's the letter bee. Can you find the letter ay?" | `wrong:…` (existing) |
| Last letter of the name | The name party (section 5) | `spell` |
| Nobody taps for 8 seconds | The question again | `prompt:…` (existing) |
| Play time is up | "All done! Great playing. Bye bye!" | `bye` (existing) |

- A wrong pop wobbles and says what it was, as today. Nothing negative.
- **Stars (Q8):** each correct pop adds a star, as today. The ten-star party still happens, except when the tenth
  star lands on the name's last letter. Then only the name party plays. It's the bigger party, and only one spoken
  line can play at a time.

## 5. The name party

When the last letter of the name is popped:

1. **Confetti** at full amount (`MAX_PARTICLES`) and the fanfare, as in the ten-star party.
2. **Every bubble on screen pops** with a little confetti, silently (Q7). New bubbles don't rise during the party.
   Taps during the party make a small sparkle and nothing else. They never start a voice line, so the spelling is
   never cut short.
3. **The spelling:** one spoken line made of parts played one after another, like today's wrong-pop line:
   `letter:S`, `letter:A`, `letter:M`, `name`. The game waits `SPELL_GAP_MS` (400 ms, tuned by ear) between parts.
4. **Each tile lights up as its letter is said**: a bigger bounce and a glow, as its part starts. The whole name
   bounces with the last part (`name`).
5. **The party waits for the line to finish.** Then the tiles empty, a fresh set of bubbles rises, and the round
   starts again from the first letter (Q11) with its question.

Details:

- **Timing:** about 0.7 s per letter with the computer voice, plus the name. "Sam" takes about 3.5 s, a 10-letter
  name about 9 s. A **safety limit** of 2 s per letter plus 4 s ends the party even if the voice never reports it has
  finished.
- **Muted, or no voice available:** the tiles still light up one by one, 0.6 s apart, then the round starts again.
- **Mixed voices:** each part comes from its own best source (Milestone 6 order: in-app recording, then `audio/`,
  then the computer voice). If the parent recorded the name but not the letters, the letters use the computer
  voice and the name uses the recording.
- **Interrupted:** if the parent gate opens, the app goes to the background or play time ends during the party, the
  spelling stops. On resume the next round starts from the first letter with its question.

## 6. Settings

Two new settings and one new value, stored with the others in `localStorage`. Every one has a default and a check
when settings are loaded. Damaged or missing values fall back to the default.

| Setting | Default | Check when loaded |
| --- | --- | --- |
| `mode` gains `'name'` | (unchanged: `'letters'`) | `'name'` is kept only if `childName` is usable; otherwise `'letters'` |
| `childName` | `''` | Must be a string. Only A to Z and a to z kept, cut to 10, capitals fixed as in section 2a. Anything else: `''` |
| `nameSay` | `''` | Must be a string. Only letters, spaces, hyphens and apostrophes kept, spaces squeezed, trimmed, cut to 40. Anything else: `''` |

- **No default changes**, so nothing changes on a device that already saved its settings. It simply has no name and
  stays in its current mode.
- **Blocked storage:** the game runs on the defaults. My name can be chosen and played for that visit, but the name
  is forgotten when the app is closed. The Name section then says: "This iPad isn't saving settings, so the name
  will be forgotten."
- `itemsKey()` (what decides whether Settings closing means fresh bubbles) gains `childName`.

## 7. The clip list

New entries in `src/clips.ts` (Milestone 6). They appear on the Recordings screen, in
`tools/update-audio.mjs --script` and in the checks.

| Clip | Words (computer voice) | Script (what a person says) | When |
| --- | --- | --- | --- |
| `letter:A` … `letter:Z` | the letter name: `['eigh!']` | "A!" (just the letter name, happily) | A correct pop in My name; the name party |
| `name` | `nameSay`, or else `childName`: `['Sam!']` | "Sam!" (the name, happily) | The end of the name party |

- **`letter:X`**: group = that letter, file `letter-A`. One clip per letter, the same for capital and small, because
  the name of the letter is the same. Uses `say` from `items.ts`, so the computer voice says "eigh", not "a".
- **`name`**: group "My name", file `name`, no `item`. Its `script` and `speech` contain the child's name, so they're
  built from the current settings, not fixed. `allClips()` and `clipsFor()` include it only when `childName` isn't
  empty.
- **`spell`** isn't a clip. Like `wrong:…`, it's a spoken moment made of clips: `partsFor('spell')` gives
  `letter:…` for each letter of the name in order, then `name`.
- **`clipsFor(settings)` in My name:** `name`, `letter:` for each different letter of the name, `prompt:` and
  `that:` for the name's letters and the Which letters list, and party and bye. `cheer:` clips aren't used in My
  name (Q1).

### 7a. The name never goes in `audio/` (Q10)

Anything in `audio/` is published, and the repository is public. So the **build refuses** a file named `name.*` in
`audio/`, with: "audio/name.m4a would publish your child's name. Record the name on the Recordings screen
instead." AUDIO-GUIDE says the same. `letter-A.m4a` and the other letter files are fine in `audio/`.

## 8. Privacy: the name stays on the device

- The name is saved only in this device's settings (`localStorage`). It's never in a network request (the existing
  check covers all of `src/`), the repository, `dist/`, the offline file list or any published file.
- A recording of the name is stored like every other in-app recording (Milestone 6). The **backup file** includes
  it and the name's words in `recordings.json`. The README says so: the backup holds the child's name and voice
  recordings, so keep it private.
- Tests use made-up names ("Sam", "Anna", "Debby"), never a real child's name.

## 9. Edge cases

| Case | What happens |
| --- | --- |
| Stored `mode: 'name'` with no name, or a damaged one | Loads as Letters |
| A one-letter name ("A") | Each round is one pop, then the party. Spelling: "A! … A!" (letter, then name) |
| One letter repeated ("Aaa") | Works: each tile in turn, two bubbles of it can be up at once |
| A name whose letters are all look-alikes of each other ("Il") | Each letter rises after the one before is popped. Works, just slower |
| Name with a capital in the middle ("McKay") | The bubble for that tile is a capital |
| Next letter is a look-alike of the one wanted now ("Ebd": b then d) | The d isn't brought up early. It rises after the b is popped, and its question waits until it's fully on screen |
| The bubble wanted now floats off the top | It comes back up from the bottom, as today |
| A bubble of the right letter but the wrong form is on screen when its turn comes (rare: brought up as an extra letter) | It quietly pops away with the other look-alike fallbacks, and the right form rises |
| The name changes in Settings | The round starts again with the new name when Settings closes |
| Switching away from My name and back | A fresh round from the first letter |
| Parent gate opened mid-round | The round keeps its place (filled tiles stay). The question is repeated on resume, as today |
| Play time ends mid-round or mid-party | Goodbye screen, as today. A new session starts a fresh round |
| Screen rotated | Tiles resize. The round keeps its place |
| Name typed with an accent ("Zoë") | The ë is left out as it's typed, with the note. The parent can type "Zoe" and put "Zoey" in How to say it |
| Settings can't be saved | Section 6 |
| The computer voice can't say a letter name well | That letter's existing respelling in `items.ts` is used, the same as in the prompts. Recording it fixes it for good |

## 10. Layout

New module:

| Module | Holds |
| --- | --- |
| `src/name.ts` | The name rules: cleaning the name, the form of each tile, the round's position, the next letter to keep ready, the tiles' state, the name party sequence |

Changed:

- `config.ts`: `Mode` gains `'name'`. `Settings` gains `childName` and `nameSay`. New constants: `NAME_MAX_LETTERS`
  (10), `SPELL_GAP_MS` (400), `SPELL_MUTED_STEP_MS` (600).
- `settings.ts`: the checks in section 6.
- `state.ts`: the round's position (`nameIndex`) and whether the name party is on.
- `items.ts`: `pool()` and `glyphFor()` know My name.
- `targets.ts`: in My name, `chooseTarget()` and `refreshUpcoming()` ask `name.ts` (the next letter is fixed, not
  picked at random).
- `game.ts`: the correct-pop path for My name, the name party, holding the question until the bubble is in view.
- `banner.ts` and `index.html` and `styles.css`: the tiles.
- `speech.ts`: `partsFor('spell')`, the tile callback as each part starts, the name's "Hear it".
- `clips.ts`: section 7. `parent.ts`: the Name section, the My name button, the notes. `recscreen.ts`: the My name
  group first.
- `tools/recordings.mjs`: refuses `audio/name.*`.
- `debug.ts`: hooks for the checks: the round (`name`, `index`, tile states), the name party flag.

Every file stays under about 400 lines.

## 11. New checks

**Settings** (`tests/parent.mjs` or a new `tests/name.mjs`):

- Defaults: `childName` and `nameSay` are `''`. Mode is unchanged.
- Damaged values: a number, an object, a too-long name, digits and accents in the name, `<script>` in How to say it.
  Each is cleaned or falls back as in section 6.
- `mode: 'name'` with no name loads as Letters.
- Blocked storage and damaged JSON: the game runs, and My name can be played for that visit.
- My name can't be chosen with an empty Name box. Emptying the box switches back to Letters.
- The Name box leaves out anything but A to Z. Capitals are fixed as in section 2a.
- The Name box and How to say it are only reachable behind the parent gate.

**Bubbles and targets:**

- Over many rounds with random seeds: what's asked for follows the name's order exactly, round after round.
- The bubble asked for always shows the name's form for that tile, with ABC/abc set to capitals, small and both.
- No other form of the wanted letter and no look-alike of it is ever on screen (checked every step of a long run,
  with "Debby" and "Ebd").
- The question is only said when the wanted bubble is fully on screen and catchable for at least
  `MIN_CATCH_SECONDS`.
- Double letters ("Anna"): two bubbles of n can be up at once, either counts, and the tiles fill in turn.
- Never more than 4 bubbles. Speed limits unchanged.

**Banner:** the number of tiles matches the name. The found, wanted and still-to-come tiles match the round's
position. The tiles empty after the party. The tiles fit at 1180 × 820 and 820 × 1180 with a 10-letter name.

**Speech and the party:**

- A correct pop says `letter:X` then the next `prompt:`. The last letter starts `spell`.
- `spell` plays `letter:` for each letter in order, then `name`, and a tile lights as each part starts.
- Only one spoken line at a time: taps during the party start no speech. The next question waits for the spelling
  to finish.
- The safety limit ends a party whose voice never finishes. Muted: tiles light 0.6 s apart and the round restarts.
- The ten-star party doesn't play on the same pop as the name party.
- Gate opened during the party: speech stops, and resume starts a fresh round with its question.

**Clip list and build:**

- `letter:A` to `letter:Z` exist, with the letter name from `items.ts`. `name` exists only when a name is set, and
  its words follow `nameSay`, or else `childName`.
- `clipsFor()` in My name lists exactly the clips section 7 says.
- Changing the name makes an old `name` recording unusable (Milestone 6 Q14 check, with the name clip).
- The build refuses `audio/name.m4a`, and accepts `audio/letter-A.m4a`.

**Spoken sample:** new scenarios are **added** to `tests/fixtures/spoken-sample.txt`: "my name: Sam", "my name:
Anna" and "my name: Debby". The existing scenarios stay word for word the same. The diff of the sample file shows
only additions, and is reviewed.

## 12. Docs

- **README:** a "Spell my name" section in numbered steps: open Settings, type the name, fix how it's said if needed,
  choose My name, record the name and its letters. It also covers that the name stays on the iPad, and that the
  backup file holds the name and voice recordings, so keep it private.
- **AUDIO-GUIDE:** the new `letter-A` … `letter-Z` lines, and that the name must be recorded in the game, never put in
  `audio/` (the build refuses it).
- **CLAUDE.md:** `name` in the layout list. Under the rules: the name never goes in a published file.
- **ROADMAP:** Milestone 7 marked Done.

## 13. Order of work

Each step is its own commit, and all checks pass from step 2 on.

1. This spec, agreed (2026-11-17).
2. Settings: `childName`, `nameSay`, `mode: 'name'`, their checks.
3. Clip list entries and the build's `audio/name.*` refusal, with their checks.
4. `name.ts` and targets: order, forms, the next letter kept ready, look-alikes, double letters, the wait for the
   question. With their checks.
5. Banner tiles, with their checks and screenshots.
6. The correct-pop line and the name party, with their checks. Spoken sample additions reviewed.
7. Settings screen (Name section) and the Recordings screen's My name group.
8. Docs and screenshots.
9. Try it on the iPad (Done-when list). Tune `SPELL_GAP_MS` by ear.

## 14. Done when

- [ ] `npm test` ends with `0 problems found`, on your computer and in GitHub Actions.
- [ ] The spoken sample's existing scenarios are unchanged. Only the new My name scenarios are added.
- [ ] No file in `src/` is over about 400 lines.
- [ ] On the iPad, **from the home-screen icon**: type the name, choose My name, play several rounds. The letters come
      in order, in the name's capitals, and the party spells the name with the tiles lighting in step.
- [ ] The name and its letters recorded on the Recordings screen play in the game and in the party.
- [ ] The name is still there after closing the app and restarting the iPad.
- [ ] With Airplane Mode on, My name works.
- [ ] `git status` and the published site have no trace of the name.
- [ ] README, AUDIO-GUIDE, CLAUDE.md and ROADMAP are updated.

## 15. Decisions (answers to the questions)

Agreed 2026-11-17. All as recommended.

| # | Question | Decision | Not chosen |
| --- | --- | --- | --- |
| Q1 | What a correct pop says in My name | Just the letter name ("Ay!"), then the next question. Keeps the round quick and on the name's letters. Needs the `letter:` clips anyway, for the spelling | The usual cheer ("Great! eigh is for apple."): longer, and the picture word pulls away from the name |
| Q2 | What a name can contain | A to Z only, 1 to 10 letters | Allow a space or hyphen, shown as a gap tile ("Mary-Kate"); allow up to 12 |
| Q3 | Capitals | Keep what's typed. All-small or all-capitals is fixed to a capital first | Always a capital first and small after, whatever is typed |
| Q4 | Where the extra bubbles come from | The name's other letters, topped up from Which letters | The name's letters only (very easy for short names); any letter A to Z |
| Q5 | Getting the next letter on screen | Keep the next letter ready on screen, and hold the question until the wanted bubble is fully in view | Ask straight away, as the other modes do when nothing suitable is on screen |
| Q6 | Repeated letters next to each other | Two bubbles of that letter can be up at once; either counts | Only one at a time; the second rises after the first is popped |
| Q7 | Bubbles during the name party | All pop with confetti; taps only sparkle; new bubbles after the spelling | Bubbles keep floating, but taps are ignored until the spelling ends |
| Q8 | Stars in My name | One star per letter, ten-star party as usual, but not on the same pop as the name party | One star per finished name; or no star bar in My name |
| Q9 | Tiles before they're found | Show the letter faint, so the child sees the whole name, whatever Letter at the top says | Blank tiles that fill in, following Letter at the top |
| Q10 | A name recording in `audio/` | The build refuses `audio/name.*` (the repository is public) | Allow it, with a warning in AUDIO-GUIDE only |
| Q11 | After the name party | Start the name again from the first letter | Go back to Letters after a set number of names |
| Q12 | An opening line each round ("Let's spell Sam!") | Not in this milestone. It adds a clip with the name and makes every round longer | Add it as a `name:start` clip |
