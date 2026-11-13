/* The banner at the top (what to find) and the star bar at the bottom. */
import { STARS_PER_PARTY } from './config';
import { els, restartAnimation } from './dom';
import { bannerWord, info } from './items';
import { state } from './state';

export function updateBanner(): void {
  const t = state.target;
  const it = info(t.key);
  els.glyph.textContent = t.glyph;
  els.glyph.classList.toggle('hidden', !state.settings.showGlyph);
  els.pic.textContent = it.pic;
  els.word.textContent = bannerWord(t);
  els.banner.classList.add('show');
  restartAnimation(els.banner, 'pop');   // the little bounce
}

/* The gentle hint: the banner bounces along with the glowing bubble. */
export function setHint(on: boolean): void {
  state.hintOn = on;
  els.banner.classList.toggle('hint', on);
}

export function updateStars(): void {
  const { stars, simTime, partyUntil, starsShown } = state;
  const shown = (stars > 0 && stars % STARS_PER_PARTY === 0 && simTime < partyUntil) ? STARS_PER_PARTY : stars % STARS_PER_PARTY;
  if (shown === starsShown) return;
  const kids = els.stars.children || [];
  for (let i = 0; i < kids.length; i++) {
    const kid = kids[i] as HTMLElement;
    const on = i < shown;
    const wasOn = kid.classList.contains && kid.classList.contains('on');
    kid.classList.toggle('on', on);
    if (on && !wasOn && shown > starsShown && starsShown >= 0) restartAnimation(kid, 'new');   // the newest star pops in
  }
  state.starsShown = shown;
}
