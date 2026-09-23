import { formatAmount, formatCount, formatWins, levelForXp } from '@spider/shared';
import { ICON } from './icons.js';
import { injectSpiderStyles } from './spiderStyles.js';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, html = ''): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (html) node.innerHTML = html;
  return node;
};

/** One big icon button with its name under it, as the reference's left column. */
export class HudButton {
  readonly root: HTMLButtonElement;
  private readonly pct: HTMLSpanElement;

  constructor(parent: HTMLElement, label: string, icon: string, hotkey: string | null, onClick: () => void) {
    this.root = el('button', 'sp-btn');
    this.root.type = 'button';
    this.root.setAttribute('aria-label', hotkey ? `${label} (${hotkey})` : label);
    this.root.append(el('span', 'sp-btn__icon', icon));
    this.root.append(el('span', 'sp-btn__label sp-font sp-outline', label));
    if (hotkey) this.root.append(el('span', 'sp-btn__key', hotkey));
    this.root.append(el('span', 'sp-btn__badge', '!'));
    this.pct = el('span', 'sp-btn__pct sp-font sp-outline');
    this.root.append(this.pct);
    this.root.addEventListener('click', (event) => {
      event.stopPropagation();
      onClick();
    });
    parent.appendChild(this.root);
  }

  setReady(ready: boolean): void {
    this.root.classList.toggle('sp-btn--ready', ready);
  }

  setPercent(text: string): void {
    if (this.pct.textContent !== text) this.pct.textContent = text;
  }

  setOff(off: boolean): void {
    this.root.classList.toggle('sp-btn--off', off);
  }

  press(): void {
    this.root.click();
  }
}

export interface FocusView {
  readonly name: string;
  readonly value: number;
  readonly max: number;
  readonly boss: boolean;
  readonly lock: string;
  readonly building: boolean;
}

export interface StatusView {
  readonly xp: number;
  readonly webPower: number;
  readonly speed: number;
  readonly swingsLeft: number;
  readonly maxSwings: number;
  readonly rebirths: number;
  readonly wins: number;
}

/**
 * THE HUD, laid out as the reference screenshots:
 *
 *   left, centred   rebirths and trophies, then Rebirth, Backpack, Teleport, Stats
 *   top right       music
 *   bottom centre   Speed, Web Power, Swings; the yellow level bar (XP / next level);
 *                   health while fighting
 *   bottom right    the Auto-Click toggle
 *   top centre      the stage and the enemy or building being webbed
 *
 * Presentation only: every figure is replicated server state.
 */
export class Hud {
  readonly left: HTMLDivElement;
  readonly corner: HTMLDivElement;
  private readonly root: HTMLElement;
  private readonly nodes: HTMLElement[] = [];
  private readonly rebirths: HTMLDivElement;
  private readonly wins: HTMLDivElement;
  private readonly speed: HTMLSpanElement;
  private readonly power: HTMLDivElement;
  private readonly swings: HTMLDivElement;
  private readonly swingsText: HTMLSpanElement;
  private readonly levelFill: HTMLDivElement;
  private readonly levelName: HTMLDivElement;
  private readonly levelValue: HTMLDivElement;
  private readonly health: HTMLDivElement;
  private readonly healthFill: HTMLDivElement;
  private readonly healthText: HTMLDivElement;
  private readonly auto: HTMLButtonElement;
  private readonly target: HTMLDivElement;
  private readonly targetInfo: HTMLDivElement;
  private readonly targetName: HTMLDivElement;
  private readonly targetBar: HTMLDivElement;
  private readonly targetFill: HTMLDivElement;
  private readonly targetText: HTMLDivElement;
  private readonly targetLock: HTMLDivElement;
  private readonly hint: HTMLDivElement;
  private readonly toasts: HTMLDivElement;
  private readonly pops: HTMLDivElement;
  private lastPower = -1;
  private popTimer = 0;
  private hintText = '';
  private infoHtml = '';
  private lastToast = '';
  private lastToastAt = 0;

  constructor(parent: HTMLElement, onAutoClick: () => void) {
    injectSpiderStyles();
    this.root = parent;
    this.left = this.add(el('div', 'sp-left'));
    const counters = el('div', 'sp-counters sp-font');
    this.left.append(counters);
    const counter = (kind: string, icon: string): HTMLDivElement => {
      const row = el('div', `sp-counter sp-counter--${kind}`);
      row.append(el('div', 'sp-counter__icon', icon));
      const value = el('div', 'sp-counter__value sp-outline', '0');
      row.append(value);
      counters.append(row);
      return value;
    };
    this.rebirths = counter('rebirth', ICON.rebirth);
    this.wins = counter('wins', ICON.trophy);

    this.corner = this.add(el('div', 'sp-corner'));

    const status = this.add(el('div', 'sp-status sp-font'));
    this.health = el('div', 'sp-health sp-hidden');
    this.healthFill = el('div', 'sp-health__fill');
    this.healthText = el('div', 'sp-health__text sp-outline');
    this.health.append(this.healthFill, this.healthText);
    const stats = el('div', 'sp-stats');
    const speed = el('div', 'sp-stat sp-stat--speed sp-outline');
    speed.innerHTML = `<span style="width:calc(44 * var(--u));height:calc(44 * var(--u));display:inline-grid">${ICON.shoe}</span>`;
    this.speed = el('span', '', 'Speed: 16');
    speed.append(this.speed);
    this.power = el('div', 'sp-power sp-outline', 'Web Power 0');
    this.swings = el('div', 'sp-stat sp-stat--swings sp-outline', ICON.swings);
    this.swingsText = el('span', '', 'Swings 2/2');
    this.swings.append(this.swingsText);
    stats.append(speed, this.power, this.swings);
    const level = el('div', 'sp-level');
    this.levelFill = el('div', 'sp-level__fill');
    this.levelName = el('div', 'sp-level__name sp-outline', 'Level 1');
    this.levelValue = el('div', 'sp-level__value sp-outline', '0 / 116');
    level.append(this.levelFill, this.levelName, this.levelValue);
    status.append(this.health, stats, level);

    this.auto = this.add(el('button', 'sp-auto sp-font sp-outline', `${ICON.auto}<span>Auto Click: OFF</span>`));
    this.auto.type = 'button';
    this.auto.setAttribute('aria-label', 'Auto click (C)');
    this.auto.addEventListener('click', (event) => {
      event.stopPropagation();
      onAutoClick();
    });

    this.target = this.add(el('div', 'sp-target sp-font sp-hidden'));
    this.targetInfo = el('div', 'sp-stageinfo sp-outline');
    this.targetName = el('div', 'sp-target__name sp-outline');
    this.targetBar = el('div', 'sp-target__bar');
    this.targetFill = el('div', 'sp-target__fill');
    this.targetText = el('div', 'sp-target__text sp-outline');
    this.targetBar.append(this.targetFill, this.targetText);
    this.targetLock = el('div', 'sp-target__lock sp-outline');
    this.target.append(this.targetInfo, this.targetName, this.targetBar, this.targetLock);

    this.hint = this.add(el('div', 'sp-hint sp-font sp-outline sp-hidden'));
    this.toasts = this.add(el('div', 'sp-toasts sp-font'));
    this.pops = this.add(el('div', 'sp-pops sp-font'));
  }

  private add<T extends HTMLElement>(node: T): T {
    this.root.appendChild(node);
    this.nodes.push(node);
    return node;
  }

  setStatus(view: StatusView): void {
    const progress = levelForXp(view.xp);
    this.power.textContent = `Web Power ${formatAmount(view.webPower)}`;
    if (this.lastPower >= 0 && view.webPower > this.lastPower) {
      this.power.classList.remove('sp-power--pop');
      void this.power.offsetWidth;
      this.power.classList.add('sp-power--pop');
      window.clearTimeout(this.popTimer);
      this.popTimer = window.setTimeout(() => this.power.classList.remove('sp-power--pop'), 140);
    }
    this.lastPower = view.webPower;
    this.speed.textContent = `Speed: ${Math.round(view.speed)}`;
    this.swingsText.textContent = `Swings ${view.swingsLeft}/${view.maxSwings}`;
    this.swings.classList.toggle('sp-stat--empty', view.swingsLeft <= 0);
    this.levelName.textContent = `Level ${formatCount(progress.level)}`;
    this.levelValue.textContent = `${formatAmount(progress.into)} / ${formatAmount(progress.need)}`;
    this.levelFill.style.width = `${(progress.fraction * 100).toFixed(1)}%`;
    this.rebirths.textContent = formatCount(view.rebirths);
    this.wins.textContent = formatWins(view.wins);
  }

  /** Just the swings (they change between server patches, from the local prediction). */
  setSwings(left: number, max: number): void {
    const text = `Swings ${left}/${max}`;
    if (this.swingsText.textContent !== text) this.swingsText.textContent = text;
    this.swings.classList.toggle('sp-stat--empty', left <= 0);
  }

  setAutoClick(on: boolean): void {
    this.auto.classList.toggle('sp-auto--on', on);
    const label = this.auto.lastElementChild;
    if (label) label.textContent = `Auto Click: ${on ? 'ON' : 'OFF'}`;
  }

  setHealth(health: number, max: number, show: boolean): void {
    this.health.classList.toggle('sp-hidden', !show);
    if (!show) return;
    const fraction = max > 0 ? Math.min(1, Math.max(0, health / max)) : 1;
    this.healthFill.style.width = `${(fraction * 100).toFixed(1)}%`;
    this.health.classList.toggle('sp-health--low', fraction < 0.3);
    this.healthText.textContent = `HP ${formatAmount(Math.ceil(health))} / ${formatAmount(max)}`;
  }

  /** The stage line (HTML: a title and a small second line) and the focused target. */
  setFocus(focus: FocusView | null, stageInfo: string): void {
    const show = focus !== null || stageInfo.length > 0;
    this.target.classList.toggle('sp-hidden', !show);
    if (!show) return;
    if (stageInfo !== this.infoHtml) {
      this.infoHtml = stageInfo;
      this.targetInfo.innerHTML = stageInfo;
    }
    this.targetInfo.classList.toggle('sp-hidden', stageInfo.length === 0);
    const hasFocus = focus !== null;
    this.targetName.classList.toggle('sp-hidden', !hasFocus);
    this.targetBar.classList.toggle('sp-hidden', !hasFocus || focus.building);
    this.targetLock.classList.toggle('sp-hidden', !hasFocus || focus.lock.length === 0);
    if (!focus) return;
    this.target.classList.toggle('sp-target--boss', focus.boss);
    this.targetName.textContent = focus.name;
    this.targetLock.textContent = focus.lock;
    const fraction = focus.max > 0 ? Math.min(1, Math.max(0, focus.value / focus.max)) : 0;
    this.targetFill.style.width = `${(fraction * 100).toFixed(1)}%`;
    this.targetText.textContent = `${formatAmount(focus.value)} / ${formatAmount(focus.max)}`;
  }

  setHint(text: string): void {
    if (text === this.hintText) return;
    this.hintText = text;
    this.hint.textContent = text;
    this.hint.classList.toggle('sp-hidden', text.length === 0);
  }

  toast(text: string, tone: 'good' | 'bad' | 'gold' | 'pink' = 'good'): void {
    const now = performance.now();
    if (text === this.lastToast && now - this.lastToastAt < 1500) return;
    this.lastToast = text;
    this.lastToastAt = now;
    const toast = el('div', `sp-toast sp-toast--${tone} sp-outline`);
    toast.textContent = text;
    this.toasts.appendChild(toast);
    while (this.toasts.childElementCount > 3) this.toasts.firstElementChild?.remove();
    window.setTimeout(() => toast.remove(), 2450);
  }

  /** A floating "+N" at a screen point (or scattered round the centre); gains carry the web icon. */
  pop(text: string, kind: 'gain' | 'dmg' | 'kill', x?: number, y?: number): void {
    if (this.pops.childElementCount > 14) this.pops.firstElementChild?.remove();
    const node = el('div', `sp-pop ${kind === 'gain' ? '' : `sp-pop--${kind}`} sp-outline`);
    if (kind === 'gain') node.innerHTML = ICON.cobweb;
    node.append(text);
    const px = x ?? window.innerWidth * (0.5 + (Math.random() - 0.5) * 0.24);
    const py = y ?? window.innerHeight * (0.52 + (Math.random() - 0.5) * 0.12);
    node.style.left = `${px}px`;
    node.style.top = `${py}px`;
    this.pops.appendChild(node);
    window.setTimeout(() => node.remove(), 900);
  }

  levelUp(from: number, to: number, speed: number): void {
    const node = el('div', 'sp-levelup sp-font');
    node.innerHTML = `<div class="sp-levelup__title sp-outline">${ICON.cobweb}<span>LEVEL UP!</span>${ICON.cobweb}</div>`;
    const line = el('div', 'sp-levelup__line sp-outline');
    line.textContent = `Level ${formatCount(from)} > Level ${formatCount(to)}  -  Speed ${Math.round(speed)}`;
    node.append(line);
    this.root.appendChild(node);
    window.setTimeout(() => node.remove(), 2700);
  }

  dispose(): void {
    window.clearTimeout(this.popTimer);
    for (const node of this.nodes) node.remove();
  }
}
