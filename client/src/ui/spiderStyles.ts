import { injectHudStyles } from './hudStyles.js';

/**
 * THE SPIDER HUD'S STYLESHEET, injected once.
 *
 * Laid out after the reference screenshots: chunky white type with a thick
 * dark rim, big glossy icons down the left with their names under them, the
 * Speed / Web Power / Swings strip and the yellow level bar at the bottom,
 * and Evolution-style windows - a saturated header (orange Pets, red Gear,
 * purple Rebirth, blue Web Shooters) with a glossy red close X, over a dark
 * glass body with a black rim, action buttons standing to its left.
 *
 * RESPONSIVE BY ONE UNIT: every size and offset is a multiple of `--u`
 * (`hudStyles`), one pixel of a 1920x1080 design fitted to the viewport and
 * clamped, with small px floors on text so it stays readable on a phone.
 *
 * NO BACKTICKS IN THE CSS: it is a template literal.
 */
let injected = false;

export const injectSpiderStyles = (): void => {
  if (injected) return;
  injected = true;
  injectHudStyles();
  const style = document.createElement('style');
  style.textContent = `
:root {
  --sp-ink: #0d0f18;
  --sp-font: "Fredoka", "Baloo 2", "Nunito", "Segoe UI", system-ui, sans-serif;
  --sp-icon: calc(118 * var(--u));
}
.sp-font { font-family: var(--sp-font); font-weight: 700; letter-spacing: 0.01em; }
.sp-outline {
  color: #fff;
  text-shadow:
    2px 0 0 var(--sp-ink), -2px 0 0 var(--sp-ink), 0 2px 0 var(--sp-ink), 0 -2px 0 var(--sp-ink),
    2px 2px 0 var(--sp-ink), -2px 2px 0 var(--sp-ink), 2px -2px 0 var(--sp-ink), -2px -2px 0 var(--sp-ink),
    0 3px 5px rgba(0, 0, 0, 0.35);
}
.sp-hidden { display: none !important; }
.sp-icon-img { width: 100%; height: 100%; object-fit: contain; pointer-events: none; filter: drop-shadow(0 4px 3px rgba(0, 0, 0, 0.4)); }

/* ---- Left column: counters, then the big icon buttons ---- */
.sp-left {
  position: fixed;
  left: max(6px, calc(18 * var(--u)), env(safe-area-inset-left, 0px));
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(10 * var(--u));
  z-index: 21;
  user-select: none;
}
.sp-counters { display: flex; flex-direction: column; gap: calc(8 * var(--u)); align-self: flex-start; margin-bottom: calc(8 * var(--u)); }
.sp-counter { display: flex; align-items: center; gap: calc(8 * var(--u)); }
.sp-counter__icon { width: calc(58 * var(--u)); height: calc(58 * var(--u)); display: grid; place-items: center; }
.sp-counter__icon svg, .sp-counter__icon img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 3px 2px rgba(0, 0, 0, 0.4)); }
.sp-counter__value { font-size: max(15px, calc(40 * var(--u))); line-height: 1; min-width: calc(40 * var(--u)); }
.sp-counter--rebirth .sp-counter__value { color: #ff4ad8; }
.sp-counter--wins .sp-counter__value { color: #ffc83a; }
.sp-counter--power .sp-counter__value { color: #5ad8ff; }
.sp-counter__tag { position: absolute; font-size: max(8px, calc(14 * var(--u))); }

.sp-btn {
  position: relative;
  width: var(--sp-icon);
  height: calc(var(--sp-icon) * 0.86);
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: transform 110ms ease;
}
.sp-btn:hover { transform: scale(1.07); }
.sp-btn:active { transform: scale(0.96); }
.sp-btn__icon { width: 78%; height: 78%; display: grid; place-items: center; }
.sp-btn__icon svg { width: 100%; height: 100%; filter: drop-shadow(0 4px 3px rgba(0, 0, 0, 0.4)); }
.sp-btn__label {
  position: absolute; left: 50%; bottom: calc(-10 * var(--u)); transform: translateX(-50%);
  font-size: max(12px, calc(27 * var(--u))); line-height: 1; white-space: nowrap; pointer-events: none;
}
.sp-btn__badge {
  position: absolute; right: calc(8 * var(--u)); top: calc(10 * var(--u));
  width: max(14px, calc(30 * var(--u))); height: max(14px, calc(30 * var(--u)));
  background: #e8202c; border: max(2px, calc(3 * var(--u))) solid #fff; border-radius: calc(6 * var(--u));
  color: #fff; font-family: var(--sp-font); font-weight: 800; font-size: max(10px, calc(20 * var(--u)));
  display: none; place-items: center; line-height: 1; box-shadow: 0 2px 0 var(--sp-ink);
  animation: sp-pip 1.4s ease-in-out infinite;
}
.sp-btn--ready .sp-btn__badge { display: grid; }
.sp-btn__key {
  position: absolute; left: calc(4 * var(--u)); top: calc(6 * var(--u));
  min-width: max(13px, calc(22 * var(--u))); height: max(13px, calc(22 * var(--u)));
  border: max(1px, calc(2 * var(--u))) solid var(--sp-ink); border-radius: calc(6 * var(--u));
  background: #fff; color: var(--sp-ink); font-family: var(--sp-font); font-weight: 700;
  font-size: max(9px, calc(12 * var(--u))); display: grid; place-items: center; line-height: 1; pointer-events: none;
}
body.aoe-touch-mode .sp-btn__key { display: none; }
.sp-btn__pct { position: absolute; right: 0; bottom: calc(22 * var(--u)); font-size: max(10px, calc(18 * var(--u))); pointer-events: none; color: #ffe27a; }
@keyframes sp-pip { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }

/* ---- Top right: music ---- */
.sp-corner {
  position: fixed;
  right: max(8px, calc(18 * var(--u)), env(safe-area-inset-right, 0px));
  top: max(60px, calc(92 * var(--u)));
  z-index: 21;
  display: flex; flex-direction: column; gap: calc(18 * var(--u));
}
.sp-corner .sp-btn { --sp-icon: calc(76 * var(--u)); }
.sp-corner .sp-btn__label { font-size: max(10px, calc(18 * var(--u))); }
.sp-btn--off { filter: saturate(0.2) brightness(0.7); }

/* ---- Bottom centre: Speed, Web Power, Swings, the level bar, health ---- */
.sp-status {
  position: fixed;
  left: 50%;
  bottom: max(6px, calc(18 * var(--u)), env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  width: min(94vw, calc(900 * var(--u)));
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: calc(6 * var(--u));
  z-index: 20;
  pointer-events: none;
}
.sp-stats { display: flex; align-items: flex-end; justify-content: space-between; gap: calc(12 * var(--u)); padding: 0 calc(8 * var(--u)); }
.sp-stat { display: flex; align-items: center; gap: calc(6 * var(--u)); font-size: max(12px, calc(28 * var(--u))); white-space: nowrap; }
.sp-stat svg { width: calc(40 * var(--u)); height: calc(40 * var(--u)); filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.4)); }
.sp-stat--speed { color: #5ad8ff; }
.sp-stat--swings { color: #5ad8ff; }
.sp-stat--swings.sp-stat--empty { color: #ff8a8a; }
.sp-power { font-size: max(17px, calc(46 * var(--u))); color: #4ab8ff; line-height: 1; white-space: nowrap; transition: transform 90ms ease; }
.sp-power--pop { transform: scale(1.1); }
.sp-level {
  position: relative;
  height: max(26px, calc(62 * var(--u)));
  border: max(3px, calc(5 * var(--u))) solid var(--sp-ink);
  border-radius: calc(4 * var(--u));
  background: #3a3e4a;
  overflow: hidden;
  box-shadow: 0 calc(5 * var(--u)) 0 rgba(0, 0, 0, 0.3);
}
.sp-level__fill { position: absolute; inset: 0 auto 0 0; width: 0%; background: linear-gradient(180deg, #ffe23a, #ffb21a); transition: width 160ms ease-out; }
.sp-level__fill::after { content: ''; position: absolute; inset: 0 0 55% 0; background: rgba(255, 255, 255, 0.28); }
.sp-level__name, .sp-level__value { position: absolute; top: 50%; transform: translateY(-50%); font-size: max(14px, calc(38 * var(--u))); line-height: 1; white-space: nowrap; }
.sp-level__name { left: calc(22 * var(--u)); }
.sp-level__value { right: calc(22 * var(--u)); }
.sp-health {
  position: relative; align-self: center; width: 62%;
  height: max(16px, calc(30 * var(--u)));
  border: max(2px, calc(4 * var(--u))) solid var(--sp-ink); border-radius: calc(20 * var(--u));
  background: #3a1a1e; overflow: hidden;
}
.sp-health__fill { position: absolute; inset: 0 auto 0 0; width: 100%; background: linear-gradient(180deg, #7dff6a, #2fc83a); transition: width 140ms ease-out; }
.sp-health--low .sp-health__fill { background: linear-gradient(180deg, #ff7a6a, #e02a2a); }
.sp-health__text { position: absolute; inset: 0; display: grid; place-items: center; font-size: max(11px, calc(20 * var(--u))); }
/* Touch: upright, the stick and buttons lift above the bar; sideways, the bar narrows to the gap between them. */
@media (orientation: portrait) {
  body.aoe-touch-mode { --aoe-controls-lift: 124px; }
  body.aoe-touch-mode .sp-status { width: min(94vw, calc(900 * var(--u))); bottom: calc(env(safe-area-inset-bottom, 0px) + 8px); }
}
@media (orientation: landscape) {
  body.aoe-touch-mode .sp-status { width: min(calc(100vw - 470px), calc(760 * var(--u))); min-width: 220px; bottom: calc(env(safe-area-inset-bottom, 0px) + 6px); }
}

/* ---- Auto-click toggle, above the bottom-right corner ---- */
.sp-auto {
  position: fixed;
  right: max(8px, calc(22 * var(--u)), env(safe-area-inset-right, 0px));
  bottom: max(8px, calc(26 * var(--u)), env(safe-area-inset-bottom, 0px));
  z-index: 21;
  padding: calc(10 * var(--u)) calc(20 * var(--u));
  border: max(3px, calc(4 * var(--u))) solid var(--sp-ink);
  border-radius: calc(14 * var(--u));
  background: linear-gradient(180deg, #8a93a8, #5a6274);
  box-shadow: 0 calc(5 * var(--u)) 0 rgba(0, 0, 0, 0.3), inset 0 calc(3 * var(--u)) 0 rgba(255, 255, 255, 0.3);
  font-size: max(12px, calc(26 * var(--u)));
  cursor: pointer;
  display: flex; align-items: center; gap: calc(8 * var(--u));
}
.sp-auto svg { width: calc(34 * var(--u)); height: calc(34 * var(--u)); }
.sp-auto--on { background: linear-gradient(180deg, #7dff6a, #2fae2b); }
/* Touch: Auto Click sits just above the WEB button, under the right thumb. */
body.aoe-touch-mode .sp-auto {
  right: calc(env(safe-area-inset-right, 0px) + 12px);
  bottom: calc(env(safe-area-inset-bottom, 0px) + var(--aoe-controls-lift, 0px) + var(--aoe-jump-size, 84px) * 1.5 + 48px);
  padding: 6px 10px; font-size: 12px;
}

/* ---- Top centre: stage progress and the target ---- */
.sp-target {
  position: fixed; left: 50%; top: max(8px, calc(20 * var(--u))); transform: translateX(-50%);
  width: min(86vw, calc(640 * var(--u))); display: flex; flex-direction: column; align-items: center; gap: calc(6 * var(--u));
  z-index: 19; pointer-events: none;
}
.sp-stageinfo { font-size: max(12px, calc(26 * var(--u))); color: #ffe27a; text-align: center; }
.sp-stageinfo small { display: block; color: #bfe6ff; font-size: 0.72em; }
.sp-target__name { font-size: max(14px, calc(32 * var(--u))); }
.sp-target--boss .sp-target__name { color: #ff6a6a; }
.sp-target__bar {
  position: relative; width: 100%; height: max(16px, calc(30 * var(--u)));
  border: max(2px, calc(4 * var(--u))) solid var(--sp-ink); border-radius: calc(20 * var(--u)); background: #2a1a1e; overflow: hidden;
}
.sp-target__fill { position: absolute; inset: 0 auto 0 0; background: linear-gradient(180deg, #ff6a6a, #d8202c); transition: width 120ms ease-out; }
.sp-target__text { position: absolute; inset: 0; display: grid; place-items: center; font-size: max(11px, calc(20 * var(--u))); }
.sp-target__lock { font-size: max(11px, calc(22 * var(--u))); color: #d9a6ff; }
.sp-hint {
  position: fixed; left: 50%; top: max(90px, calc(190 * var(--u))); transform: translateX(-50%);
  max-width: 80vw; padding: calc(8 * var(--u)) calc(18 * var(--u));
  background: rgba(10, 14, 30, 0.55); border-radius: calc(14 * var(--u));
  font-size: max(12px, calc(24 * var(--u))); text-align: center; z-index: 18; pointer-events: none;
}

/* ---- Toasts, popups, level up ---- */
.sp-toasts { position: fixed; left: 50%; top: max(120px, calc(250 * var(--u))); transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: calc(6 * var(--u)); z-index: 40; pointer-events: none; }
.sp-toast { font-size: max(13px, calc(30 * var(--u))); animation: sp-toast 2.4s ease forwards; white-space: nowrap; }
.sp-toast--good { color: #7dff6a; }
.sp-toast--bad { color: #ff6a6a; }
.sp-toast--gold { color: #ffd23a; }
.sp-toast--pink { color: #ff7ad8; }
@keyframes sp-toast { 0% { opacity: 0; transform: translateY(10px) scale(0.9); } 10% { opacity: 1; transform: none; } 80% { opacity: 1; } 100% { opacity: 0; transform: translateY(-14px); } }
.sp-pops { position: fixed; inset: 0; pointer-events: none; z-index: 30; overflow: hidden; }
.sp-pop { position: absolute; display: flex; align-items: center; gap: calc(4 * var(--u)); font-size: max(15px, calc(38 * var(--u))); transform: translate(-50%, -50%); animation: sp-pop 0.9s ease-out forwards; white-space: nowrap; }
.sp-pop img { width: calc(46 * var(--u)); height: calc(46 * var(--u)); }
.sp-cobweb { flex: 0 0 auto; filter: drop-shadow(0 0 calc(4 * var(--u)) rgba(120, 200, 255, 0.7)); }
.sp-pop .sp-cobweb { width: calc(62 * var(--u)); height: calc(62 * var(--u)); min-width: 20px; min-height: 20px; animation: sp-cobweb-spin 0.9s ease-out; }
@keyframes sp-cobweb-spin { from { transform: rotate(-70deg) scale(0.5); } 40% { transform: rotate(8deg) scale(1.08); } to { transform: none; } }
.sp-pop--dmg { color: #ff5a5a; }
.sp-pop--kill { color: #ffd23a; }
@keyframes sp-pop { 0% { opacity: 0; transform: translate(-50%, -30%) scale(0.6); } 15% { opacity: 1; transform: translate(-50%, -60%) scale(1.1); } 100% { opacity: 0; transform: translate(-50%, -220%) scale(0.95); } }
.sp-levelup { position: fixed; left: 50%; top: 32%; transform: translate(-50%, -50%); text-align: center; z-index: 41; pointer-events: none; animation: sp-levelup 2.6s ease forwards; }
.sp-levelup__title { font-size: max(26px, calc(76 * var(--u))); color: #ffe23a; display: flex; align-items: center; justify-content: center; gap: calc(14 * var(--u)); }
.sp-levelup__title .sp-cobweb { width: calc(96 * var(--u)); height: calc(96 * var(--u)); min-width: 34px; min-height: 34px; animation: sp-cobweb-spin 0.7s ease-out; }
.sp-levelup__title .sp-cobweb:last-child { transform: scaleX(-1); animation-name: sp-cobweb-spin-r; }
@keyframes sp-cobweb-spin-r { from { transform: scaleX(-1) rotate(-70deg) scale(0.5); } 40% { transform: scaleX(-1) rotate(8deg) scale(1.08); } to { transform: scaleX(-1); } }
.sp-levelup__line { font-size: max(14px, calc(34 * var(--u))); }
@keyframes sp-levelup { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); } 12% { opacity: 1; transform: translate(-50%, -50%) scale(1.08); } 20% { transform: translate(-50%, -50%) scale(1); } 80% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -70%); } }

/* ---- Windows ---- */
.sp-modal { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; background: rgba(6, 8, 18, 0.28); }
.sp-frame { position: relative; display: flex; align-items: flex-start; gap: calc(14 * var(--u)); max-width: 96vw; }
.sp-side { display: flex; flex-direction: column; gap: calc(14 * var(--u)); margin-top: calc(120 * var(--u)); }
.sp-win {
  position: relative;
  width: min(94vw, calc(1120 * var(--u)));
  max-height: min(86vh, calc(900 * var(--u)));
  display: flex; flex-direction: column;
  border: max(3px, calc(5 * var(--u))) solid var(--sp-ink);
  background: rgba(20, 24, 36, 0.62);
  box-shadow: 0 calc(10 * var(--u)) calc(30 * var(--u)) rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(3px);
}
.sp-win--small { width: min(94vw, calc(840 * var(--u))); }
.sp-win__top { position: absolute; right: 0; bottom: 100%; margin-bottom: calc(10 * var(--u)); font-size: max(13px, calc(34 * var(--u))); white-space: nowrap; display: flex; gap: calc(28 * var(--u)); }
.sp-head {
  position: relative; display: flex; align-items: center; gap: calc(12 * var(--u));
  padding: calc(12 * var(--u)) calc(14 * var(--u)) calc(12 * var(--u)) calc(110 * var(--u));
  min-height: calc(92 * var(--u));
  background: linear-gradient(180deg, var(--ha, #ffb43a), var(--hb, #ff6a1a));
  border-bottom: max(3px, calc(5 * var(--u))) solid var(--sp-ink);
}
.sp-head__icon { position: absolute; left: calc(-24 * var(--u)); top: 50%; transform: translateY(-50%) rotate(-6deg); width: calc(120 * var(--u)); height: calc(120 * var(--u)); }
.sp-head__icon svg, .sp-head__icon img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 4px 3px rgba(0, 0, 0, 0.4)); }
.sp-head__title { font-size: max(20px, calc(58 * var(--u))); line-height: 1; flex: 1 1 auto; white-space: nowrap; }
.sp-head__extra { font-size: max(15px, calc(44 * var(--u))); white-space: nowrap; }
.sp-head__btn {
  padding: calc(8 * var(--u)) calc(16 * var(--u)); font-size: max(12px, calc(28 * var(--u)));
  border: max(2px, calc(4 * var(--u))) solid var(--sp-ink); cursor: pointer;
  background: linear-gradient(180deg, #7dff6a, #2fae2b); box-shadow: inset 0 calc(3 * var(--u)) 0 rgba(255, 255, 255, 0.35);
}
/*
 * The close X: a glossy Spider-red tile with a faint web etched in it, a soft
 * red glow, and a fat outlined white cross. Hover lifts it, turns the cross a
 * quarter and throws a small ring of sparks; press sinks it.
 */
.sp-close {
  position: relative; flex: 0 0 auto; display: grid; place-items: center; padding: 0;
  width: calc(70 * var(--u)); height: calc(70 * var(--u)); min-width: 32px; min-height: 32px;
  border: max(3px, calc(5 * var(--u))) solid var(--sp-ink); border-radius: calc(14 * var(--u)); cursor: pointer;
  background:
    radial-gradient(120% 70% at 50% 0%, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0) 55%),
    linear-gradient(180deg, #ff4a4f 0%, #e3151f 55%, #a80a14 100%);
  box-shadow:
    inset 0 calc(-5 * var(--u)) 0 rgba(90, 0, 8, 0.45),
    inset 0 0 0 max(1px, calc(2 * var(--u))) rgba(255, 170, 170, 0.35),
    0 0 calc(14 * var(--u)) rgba(255, 40, 50, 0.55);
  transition: transform 0.14s ease, box-shadow 0.2s ease, filter 0.2s ease;
}
.sp-close::before {
  content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; opacity: 0.22;
  background: url("data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><g fill="none" stroke="#fff" stroke-width="1.1">' +
      '<path d="M20 0v40M0 20h40M0 0l40 40M40 0 0 40"/><path d="M20 7l9 4 4 9-4 9-9 4-9-4-4-9 4-9z"/><path d="M20 13l5 2 2 5-2 5-5 2-5-2-2-5 2-5z"/></g></svg>',
  )}") center / cover no-repeat;
}
.sp-close::after {
  content: ''; position: absolute; left: 50%; top: 50%; width: 8%; height: 8%; border-radius: 50%; pointer-events: none; opacity: 0;
  box-shadow:
    0 calc(-44 * var(--u)) 0 max(1px, calc(2 * var(--u))) #ffe0e4, calc(38 * var(--u)) calc(-22 * var(--u)) 0 max(1px, calc(2 * var(--u))) #ff8a92,
    calc(38 * var(--u)) calc(22 * var(--u)) 0 max(1px, calc(2 * var(--u))) #ffe0e4, 0 calc(44 * var(--u)) 0 max(1px, calc(2 * var(--u))) #ff8a92,
    calc(-38 * var(--u)) calc(22 * var(--u)) 0 max(1px, calc(2 * var(--u))) #ffe0e4, calc(-38 * var(--u)) calc(-22 * var(--u)) 0 max(1px, calc(2 * var(--u))) #ff8a92;
  transform: translate(-50%, -50%) scale(0.4);
}
.sp-x { position: relative; width: 66%; height: 66%; filter: drop-shadow(0 calc(2 * var(--u)) 0 rgba(60, 0, 6, 0.55)); transition: transform 0.22s cubic-bezier(0.3, 1.6, 0.5, 1); }
.sp-close:hover, .sp-close:focus-visible {
  transform: translateY(calc(-2 * var(--u))) scale(1.06); filter: brightness(1.08); outline: none;
  box-shadow:
    inset 0 calc(-5 * var(--u)) 0 rgba(90, 0, 8, 0.45),
    inset 0 0 0 max(1px, calc(2 * var(--u))) rgba(255, 190, 190, 0.5),
    0 0 calc(22 * var(--u)) rgba(255, 50, 60, 0.85);
}
.sp-close:hover .sp-x, .sp-close:focus-visible .sp-x { transform: rotate(90deg) scale(1.05); }
.sp-close:hover::after, .sp-close:focus-visible::after { animation: sp-close-sparks 0.45s ease-out; }
.sp-close:active { transform: translateY(calc(1 * var(--u))) scale(0.94); filter: brightness(0.95); }
@keyframes sp-close-sparks { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.35); } 30% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -50%) scale(1.15); } }
@media (prefers-reduced-motion: reduce) { .sp-close, .sp-x { transition: none; } .sp-close:hover::after { animation: none; } }
.sp-win--pets { --ha: #ffcf3a; --hb: #ff8a1a; }
.sp-win--gear { --ha: #ff8a3a; --hb: #ff3a1a; }
.sp-win--rebirth { --ha: #c05aff; --hb: #7a1ae0; }
.sp-win--shooters { --ha: #5ad8ff; --hb: #1a7ae0; }
.sp-win--shop { --ha: #ff5a3a; --hb: #c81a1a; }
.sp-win--suits { --ha: #ff5a6a; --hb: #c81a2a; }
.sp-win--teleport { --ha: #7dff6a; --hb: #2fae2b; }
.sp-win--stats { --ha: #5ae8d8; --hb: #1aa89a; }
.sp-win--egg { --ha: #ffd23a; --hb: #e8901a; }
.sp-body { padding: calc(20 * var(--u)); overflow-y: auto; overscroll-behavior: contain; }
.sp-body::-webkit-scrollbar { width: 10px; }
.sp-body::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.25); border-radius: 6px; }
.sp-tabs { display: flex; gap: calc(8 * var(--u)); padding: calc(10 * var(--u)) calc(14 * var(--u)) 0; flex-wrap: wrap; }
.sp-tab {
  padding: calc(8 * var(--u)) calc(18 * var(--u)); font-size: max(12px, calc(28 * var(--u)));
  border: max(2px, calc(4 * var(--u))) solid var(--sp-ink); cursor: pointer;
  background: linear-gradient(180deg, #5a6274, #3a4050); display: flex; align-items: center; gap: calc(6 * var(--u));
}
.sp-tab img, .sp-tab svg { width: calc(34 * var(--u)); height: calc(34 * var(--u)); object-fit: contain; }
.sp-tab--on { background: linear-gradient(180deg, #ffe23a, #ffae1a); }
.sp-tab__badge { width: max(10px, calc(16 * var(--u))); height: max(10px, calc(16 * var(--u))); border-radius: 50%; background: #e8202c; border: 2px solid #fff; display: none; }
.sp-tab--ready .sp-tab__badge { display: inline-block; }

.sp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(max(62px, calc(132 * var(--u))), 1fr)); gap: calc(12 * var(--u)); }
@media (max-width: 700px) { .sp-grid { grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); } }
.sp-card {
  position: relative; aspect-ratio: 1 / 1; padding: 0;
  border: max(2px, calc(4 * var(--u))) solid var(--sp-ink); cursor: pointer;
  background: linear-gradient(180deg, var(--ca, #f4f4f4), var(--cb, #c8c8c8));
  display: grid; place-items: center; overflow: hidden;
  box-shadow: inset 0 calc(3 * var(--u)) 0 rgba(255, 255, 255, 0.35);
  transition: transform 90ms ease;
}
.sp-card:hover { transform: scale(1.05); }
.sp-card__img { width: 86%; height: 86%; object-fit: contain; pointer-events: none; margin-bottom: 12%; }
.sp-card__name { position: absolute; left: 2px; right: 2px; bottom: calc(4 * var(--u)); font-size: max(8px, calc(15 * var(--u))); line-height: 1.05; text-align: center; pointer-events: none; }
.sp-card__badge { position: absolute; right: calc(4 * var(--u)); top: calc(4 * var(--u)); width: max(12px, calc(24 * var(--u))); height: max(12px, calc(24 * var(--u))); background: #e8202c; border: 2px solid #fff; color: #fff; font-size: max(9px, calc(16 * var(--u))); display: grid; place-items: center; line-height: 1; pointer-events: none; }
.sp-card__check { position: absolute; left: calc(4 * var(--u)); top: calc(4 * var(--u)); width: max(14px, calc(28 * var(--u))); height: max(14px, calc(28 * var(--u))); background: #2fae2b; border: 2px solid var(--sp-ink); border-radius: 50%; display: grid; place-items: center; pointer-events: none; }
.sp-card__check svg { width: 80%; height: 80%; }
.sp-card--locked .sp-card__img { filter: brightness(0.15); }
.sp-card--selected { outline: max(3px, calc(5 * var(--u))) solid #ffe23a; outline-offset: calc(-2 * var(--u)); }
.sp-card--delete { animation: sp-shake 0.5s ease-in-out infinite; }
@keyframes sp-shake { 0%, 100% { transform: rotate(0); } 25% { transform: rotate(-2deg); } 75% { transform: rotate(2deg); } }
.sp-rarity-0 { --ca: #f0f4e0; --cb: #b8c88a; }
.sp-rarity-1 { --ca: #7af0ff; --cb: #1ab8e0; }
.sp-rarity-2 { --ca: #d88aff; --cb: #9a2ae0; }
.sp-rarity-3 { --ca: #ffe27a; --cb: #ffa01a; }
.sp-rarity-common { --ca: #f4f8e8; --cb: #c8d4a8; }
.sp-rarity-rare { --ca: #7af0ff; --cb: #1ab8e0; }
.sp-rarity-epic { --ca: #d88aff; --cb: #9a2ae0; }
.sp-rarity-legendary { --ca: #ffe27a; --cb: #ffa01a; }

.sp-action {
  min-width: calc(250 * var(--u)); padding: calc(12 * var(--u)) calc(22 * var(--u));
  font-size: max(14px, calc(40 * var(--u))); cursor: pointer;
  border: max(3px, calc(5 * var(--u))) solid var(--sp-ink);
  background: linear-gradient(180deg, #7dff6a, #2fae2b);
  box-shadow: inset 0 calc(4 * var(--u)) 0 rgba(255, 255, 255, 0.4), 0 calc(5 * var(--u)) 0 rgba(0, 0, 0, 0.3);
  white-space: nowrap;
}
.sp-action--red { background: linear-gradient(180deg, #ff4a7a, #d81a3a); }
.sp-action--gold { background: linear-gradient(180deg, #ffe23a, #ffa01a); }
.sp-action--blue { background: linear-gradient(180deg, #5ad8ff, #1a7ae0); }
.sp-action--on { outline: max(3px, calc(5 * var(--u))) solid #fff; }
.sp-action:disabled { filter: saturate(0.2) brightness(0.7); cursor: default; }
.sp-action small { display: block; font-size: 0.45em; color: #0a2a0a; text-shadow: none; }
@media (max-width: 760px) {
  .sp-frame { flex-direction: column-reverse; align-items: stretch; }
  .sp-side { flex-direction: row; margin-top: 0; justify-content: center; }
  .sp-action { min-width: 0; font-size: 14px; }
}

.sp-equipped { display: flex; gap: calc(12 * var(--u)); justify-content: center; margin-top: calc(16 * var(--u)); }
.sp-slot {
  position: relative; width: calc(140 * var(--u)); height: calc(140 * var(--u)); min-width: 58px; min-height: 58px;
  border: max(3px, calc(5 * var(--u))) solid var(--sp-ink); background: rgba(0, 0, 0, 0.35);
  display: grid; place-items: center; cursor: pointer; padding: 0;
}
.sp-slot img { width: 76%; height: 76%; object-fit: contain; margin-bottom: 18%; }
.sp-slot__name { position: absolute; left: 0; right: 0; bottom: calc(6 * var(--u)); text-align: center; font-size: max(9px, calc(19 * var(--u))); line-height: 1; }
.sp-slot__empty { font-size: max(10px, calc(20 * var(--u))); color: #9aa0b0; }
.sp-totals { text-align: center; margin-top: calc(12 * var(--u)); font-size: max(11px, calc(22 * var(--u))); color: #bfe6ff; }
.sp-empty { text-align: center; padding: calc(40 * var(--u)) calc(20 * var(--u)); font-size: max(13px, calc(28 * var(--u))); }
.sp-note { text-align: center; margin-top: calc(12 * var(--u)); font-size: max(10px, calc(20 * var(--u))); color: #c8d0e0; }

/* Detail panel (web shooters) */
.sp-split { display: flex; gap: calc(16 * var(--u)); align-items: stretch; }
.sp-split > .sp-grid { flex: 1 1 auto; align-content: start; }
.sp-detail {
  flex: 0 0 calc(270 * var(--u)); min-width: 130px;
  border: max(3px, calc(5 * var(--u))) solid var(--sp-ink); background: rgba(0, 0, 0, 0.35);
  display: flex; flex-direction: column; align-items: center; gap: calc(10 * var(--u)); padding: calc(14 * var(--u));
}
.sp-detail img { width: 80%; aspect-ratio: 1 / 1; object-fit: contain; border: max(2px, calc(4 * var(--u))) solid var(--sp-ink); background: rgba(0, 0, 0, 0.3); }
.sp-detail__name { font-size: max(13px, calc(28 * var(--u))); text-align: center; }
.sp-detail__state { font-size: max(12px, calc(26 * var(--u))); color: #ffe23a; }
.sp-detail__mult { font-size: max(16px, calc(40 * var(--u))); color: #ffe23a; }

/* Shop rows (the Web Shooter stand) */
.sp-rows { display: flex; flex-direction: column; gap: calc(12 * var(--u)); }
.sp-row {
  display: flex; align-items: center; gap: calc(16 * var(--u)); padding: calc(12 * var(--u)) calc(16 * var(--u));
  border: max(3px, calc(4 * var(--u))) solid var(--sp-ink);
  background: linear-gradient(90deg, var(--ra, #5ab8ff), var(--rb, #bfe6ff));
}
.sp-row img { width: calc(120 * var(--u)); height: calc(90 * var(--u)); object-fit: contain; }
.sp-row__text { flex: 1 1 auto; }
.sp-row__name { font-size: max(14px, calc(38 * var(--u))); }
.sp-row__mult { font-size: max(11px, calc(26 * var(--u))); color: rgba(20, 20, 40, 0.75); text-shadow: none; }
.sp-row .sp-action { min-width: calc(200 * var(--u)); font-size: max(13px, calc(34 * var(--u))); display: flex; align-items: center; gap: calc(8 * var(--u)); justify-content: center; }
.sp-row .sp-action img { width: calc(36 * var(--u)); height: calc(36 * var(--u)); }

/* Rebirth */
.sp-warn { text-align: center; font-size: max(13px, calc(34 * var(--u))); color: #ff5a4a; margin-bottom: calc(10 * var(--u)); }
.sp-rb { display: grid; grid-template-columns: 1fr auto 1fr; gap: calc(10 * var(--u)) calc(16 * var(--u)); align-items: center; }
.sp-rb__label { text-align: center; font-size: max(12px, calc(30 * var(--u))); }
.sp-rb__card {
  display: flex; align-items: center; justify-content: center; gap: calc(12 * var(--u));
  padding: calc(10 * var(--u)); border: max(3px, calc(5 * var(--u))) solid var(--sp-ink);
  background: linear-gradient(180deg, #ffe27a, #ffb21a); font-size: max(16px, calc(46 * var(--u)));
}
.sp-rb__card svg, .sp-rb__card img { width: calc(64 * var(--u)); height: calc(64 * var(--u)); object-fit: contain; }
.sp-rb__arrow { font-size: max(18px, calc(52 * var(--u))); color: #fff; }
.sp-bar {
  position: relative; height: max(30px, calc(76 * var(--u))); margin: calc(18 * var(--u)) 0;
  border: max(3px, calc(5 * var(--u))) solid var(--sp-ink); background: #3a1a5a; overflow: hidden;
}
.sp-bar__fill { position: absolute; inset: 0 auto 0 0; background: linear-gradient(180deg, #c05aff, #7a1ae0); }
.sp-bar__text { position: absolute; inset: 0; display: grid; place-items: center; font-size: max(15px, calc(46 * var(--u))); }
.sp-buttons { display: flex; justify-content: center; gap: calc(18 * var(--u)); flex-wrap: wrap; }

/* Stats and teleport lists */
.sp-list { display: flex; flex-direction: column; gap: calc(8 * var(--u)); }
.sp-line { display: flex; justify-content: space-between; gap: calc(14 * var(--u)); padding: calc(8 * var(--u)) calc(14 * var(--u)); background: rgba(0, 0, 0, 0.3); font-size: max(12px, calc(26 * var(--u))); }
.sp-line span:last-child { color: #ffe27a; text-align: right; }
.sp-line--head { background: none; color: #bfe6ff; font-size: max(11px, calc(22 * var(--u))); padding-top: calc(14 * var(--u)); }
.sp-tp { display: grid; grid-template-columns: repeat(auto-fill, minmax(calc(250 * var(--u)), 1fr)); gap: calc(10 * var(--u)); }
@media (max-width: 700px) { .sp-tp { grid-template-columns: 1fr 1fr; } }
.sp-tp__btn {
  text-align: left; padding: calc(10 * var(--u)) calc(14 * var(--u)); cursor: pointer;
  border: max(3px, calc(4 * var(--u))) solid var(--sp-ink);
  background: linear-gradient(180deg, #5ad8ff, #1a7ae0); box-shadow: inset 0 calc(3 * var(--u)) 0 rgba(255, 255, 255, 0.35);
}
.sp-tp__btn--stage { background: linear-gradient(180deg, #ff6a6a, #c81a2a); }
.sp-tp__btn--cleared { background: linear-gradient(180deg, #7dff6a, #2fae2b); }
.sp-tp__btn:disabled { filter: saturate(0.1) brightness(0.55); cursor: default; }
.sp-tp__name { font-size: max(12px, calc(28 * var(--u))); display: block; }
.sp-tp__meta { font-size: max(9px, calc(18 * var(--u))); display: block; color: #fff4c0; }

/* Hatch reveal */
.sp-hatch { position: fixed; inset: 0; display: grid; place-items: center; z-index: 60; background: rgba(0, 0, 0, 0.35); animation: sp-fade 0.2s ease; }
.sp-hatch__box { display: flex; gap: calc(30 * var(--u)); flex-wrap: wrap; justify-content: center; }
.sp-hatch__pet { display: flex; flex-direction: column; align-items: center; animation: sp-hatch 0.6s ease; }
.sp-hatch__pet img { width: calc(240 * var(--u)); height: calc(240 * var(--u)); min-width: 110px; min-height: 110px; }
.sp-hatch__name { font-size: max(15px, calc(40 * var(--u))); }
.sp-hatch__rarity { font-size: max(12px, calc(30 * var(--u))); }
@keyframes sp-hatch { 0% { transform: scale(0.2) rotate(-20deg); opacity: 0; } 70% { transform: scale(1.15) rotate(4deg); opacity: 1; } 100% { transform: none; } }
@keyframes sp-fade { from { opacity: 0; } to { opacity: 1; } }
`;
  document.head.appendChild(style);
};
