/* The page's elements, looked up once at start-up by findElements(). */

const IDS = {
  canvas: 'game', start: 'start', play: 'playBtn', banner: 'banner', glyph: 'bGlyph', pic: 'bPic', word: 'bWord',
  replay: 'replayBtn', mute: 'muteBtn', stars: 'stars', party: 'party', gear: 'gearBtn', gate: 'gate',
  gateClose: 'gateClose', gateHold: 'gateHold', gateMath: 'gateMath', holdBtn: 'holdBtn', mathQ: 'mathQ',
  mathA: 'mathA', pad: 'pad', settings: 'settings', panel: 'panel', letterChips: 'letterChips',
  numberChips: 'numberChips', letterGroup: 'letterGroup', numberGroup: 'numberGroup', voiceGroup: 'voiceGroup',
  voiceSel: 'voiceSel', hearBtn: 'hearBtn', doneBtn: 'doneBtn', versionNote: 'versionNote', bye: 'bye'
} as const;

type Elements = { [K in keyof typeof IDS]: HTMLElement } & { canvas: HTMLCanvasElement; voiceSel: HTMLSelectElement };

export const els = {} as Elements;

export function findElements(): void {
  const found = els as Record<string, HTMLElement | null>;
  for (const [name, id] of Object.entries(IDS)) found[name] = document.getElementById(id);
}

/* Restarts a CSS animation on an element (reading offsetWidth forces the browser to notice the change). */
export function restartAnimation(el: HTMLElement, cls: string): void {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
