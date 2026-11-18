/* The one list of every spoken clip. The game's voice, the Recordings screen, tools/update-audio.mjs, the build's
   audio/ name rule and the tests all read it. No page or audio code here, so the Node tools can load it too.
   Later milestones add entries (counting, the name, picture prompts) and nothing else needs to change. */
import type { Settings } from './config';
import { LETTERS, NUMBERS, info, isNumber, poolFor } from './items';
import type { Key } from './state';

export interface Clip {
  name: string;          // 'prompt:B', 'cheer:B', 'that:B', 'party', 'bye'
  file: string;          // the audio/ file name without its ending: 'prompt-B', 'party'
  item?: Key;            // 'B' for a letter's or number's clips; missing for whole-game clips
  group: string;         // heading on the Recordings screen: 'B', 'Whole game'
  script: string;        // what a person says: 'Great! (short pause) B is for ball.'
  speech: string[];      // what the computer voice says, in pieces: ['Great!', 'bee is for ball.']
  when: string;          // when the game plays it
}

export const WHOLE_GAME = 'Whole game';

function itemClips(key: Key): Clip[] {
  const it = info(key);
  const num = isNumber(key);
  const kind = num ? 'number' : 'letter';
  const anchorSpoken = num ? it.word : it.say + ' is for ' + it.word;               // 'three stars', 'bee is for ball'
  const anchorScript = num ? it.word[0]!.toUpperCase() + it.word.slice(1) : key + ' is for ' + it.word;
  return [
    {
      name: 'prompt:' + key, file: 'prompt-' + key, item: key, group: key,
      script: 'Can you find the ' + kind + ' ' + key + '?',
      speech: ['Can you find the ' + kind + ' ' + it.say + '?'],
      when: 'Asking her to find it, and again every 8 seconds if she waits'
    },
    {
      name: 'cheer:' + key, file: 'cheer-' + key, item: key, group: key,
      script: 'Great! (short pause) ' + anchorScript + '.',
      speech: ['Great!', anchorSpoken + '.'],
      when: 'She pops the right bubble'
    },
    {
      name: 'that:' + key, file: 'that-' + key, item: key, group: key,
      script: "That's the " + kind + ' ' + key + '.',
      speech: ["That's the " + kind + ' ' + it.say + '.'],
      when: 'She pops a different bubble (the question for the real one follows)'
    }
  ];
}

const GAME_CLIPS: Clip[] = [
  {
    name: 'party', file: 'party', group: WHOLE_GAME,
    script: 'Hooray! You popped ten bubbles! Great job!',
    speech: ['Hooray! You popped ten bubbles! Great job!'],
    when: 'Every tenth star'
  },
  {
    name: 'bye', file: 'bye', group: WHOLE_GAME,
    script: 'All done! Great playing. Bye bye!',
    speech: ['All done! Great playing. Bye bye!'],
    when: 'When the play time you set is up'
  }
];

/* Letters A to Z, then numbers 0 to 9, then the whole-game clips. */
export const ALL_ITEMS: Key[] = [...Object.keys(LETTERS), ...Object.keys(NUMBERS)];
const ALL: Clip[] = [...ALL_ITEMS.flatMap(itemClips), ...GAME_CLIPS];
const BY_NAME = new Map(ALL.map((c) => [c.name, c]));
const BY_FILE = new Map(ALL.map((c) => [c.file, c]));

/* Every clip, in screen order. */
export function allClips(): Clip[] { return ALL.slice(); }

/* The clips the current settings can play: the chosen letters and numbers, then the whole-game clips. */
export function clipsFor(settings: Settings): Clip[] {
  const keys = new Set(poolFor(settings));
  return ALL.filter((c) => c.item === undefined || keys.has(c.item));
}

export function clipByName(name: string): Clip | undefined { return BY_NAME.get(name); }

/* By audio/ file name without its ending. A small letter after the dash is accepted ('prompt-a'), as before. */
export function clipByFile(file: string): Clip | undefined {
  return BY_FILE.get(file) ?? BY_FILE.get(file.replace(/-([a-z])$/, (_, c: string) => '-' + c.toUpperCase()));
}
