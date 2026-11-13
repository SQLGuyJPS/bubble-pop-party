/* Start-up: looks up the page, wires up the events and gets everything ready. The order below matters only
   in that settings load first and the canvas is sized before the first frame. */
import { installDebug, debugWanted } from './debug';
import { els, findElements } from './dom';
import { forgetFontSize, initCanvas, resize } from './draw';
import { handlePointer, onPlay, pauseGame, resumeGame } from './game';
import { wireParent } from './parent';
import { loadSettings } from './settings';
import { audioCtx, ensureAudio, setMuted } from './sound';
import { initSpeech, say } from './speech';
import { state } from './state';

loadSettings();
initSpeech();
ensureAudio(true);   // start decoding the recordings now, so the very first prompt is already ready
findElements();
initCanvas(els.canvas);

/* ---- The game ---- */
els.canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (audioCtx && audioCtx.state !== 'running') ensureAudio();
  const rect = els.canvas.getBoundingClientRect();
  handlePointer(e.clientX - rect.left, e.clientY - rect.top);   // every finger gets its own pointerdown
}, { passive: false });

els.play.addEventListener('pointerup', (e) => { e.preventDefault(); onPlay(); });
els.play.addEventListener('click', onPlay);   // keyboard fallback
els.mute.addEventListener('pointerup', (e) => {
  e.preventDefault();
  ensureAudio();
  setMuted(!state.muted);
});
els.mute.addEventListener('click', (e) => { if (e.detail === 0) setMuted(!state.muted); });   // keyboard only
els.replay.addEventListener('pointerup', (e) => {
  e.preventDefault();
  if (state.running && !state.paused) say('prompt:' + state.target.key);
});

wireParent();

/* ---- The page ---- */
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => { setTimeout(resize, 200); });
if (window.visualViewport && window.visualViewport.addEventListener) {
  window.visualViewport.addEventListener('resize', resize);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseGame(); else resumeGame();
});
window.addEventListener('pagehide', pauseGame);

/* Block zoom, selection, scrolling, pull-to-refresh and menus.
   iOS Safari ignores user-scalable=no, so also stop its gesture events. */
const block = (e: Event): void => { e.preventDefault(); };
for (const n of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(n, block, { passive: false });
document.addEventListener('touchmove', (e) => {
  const t = e.target as Element | null;
  if (t && t.closest && t.closest('#panel')) return;   // the parent settings list is the one thing that may scroll
  e.preventDefault();
}, { passive: false });
document.addEventListener('touchstart', (e) => { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {   // stops double-tap zoom
  const now = Date.now();
  if (now - lastTouchEnd <= 300) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });
document.addEventListener('contextmenu', block);
document.addEventListener('dblclick', block);
document.addEventListener('selectstart', block);

/* The big font loads from a file; once it's ready, re-measure it */
try {
  if (document.fonts && document.fonts.load) {
    document.fonts.load('700 100px Andika').then(forgetFontSize, () => {});
  }
} catch { /* the system font stack is the fallback */ }

resize();

/* ---- Offline support (not in `npm run dev`, so you never see a stale copy) ---- */
try {
  if (!__DEV__ && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !window.__BPP_TEST) {
    const hadWorker = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      /* A newer version of the game just took over. Switch to it now only if she hasn't
         started playing; otherwise it simply loads the next time the game is opened. */
      if (hadWorker && !state.started) { try { location.reload(); } catch { /* next launch */ } }
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        /* a game left open on the home screen for days still looks for updates */
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) { try { void reg.update(); } catch { /* ignore */ } }
        });
      }, () => { /* no offline support, the game still works */ });
    });
  }
} catch { /* the game works without it */ }

if (debugWanted()) installDebug();
