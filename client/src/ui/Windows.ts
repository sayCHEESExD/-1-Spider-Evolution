import {
  AVATAR_SLOT,
  EGGS,
  GEAR_EQUIP_MAX,
  GEAR_INVENTORY_MAX,
  GEAR_RARITY_COLORS,
  GEAR_RARITY_NAMES,
  PET_EQUIP_MAX,
  PET_INVENTORY_MAX,
  PET_RARITY_COLORS,
  SHOOTERS,
  STAGES,
  SUITS,
  SUIT_COUNT,
  TELEPORTS,
  canRebirth,
  eggById,
  formatAmount,
  formatCount,
  formatMultiplier,
  formatPlayTime,
  formatWins,
  gearById,
  gearLabel,
  gearScore,
  gearStatText,
  gearTotals,
  levelForXp,
  maxSwingsFor,
  ownsShooter,
  ownsSuit,
  petById,
  petMultiplier,
  rebirthHealth,
  rebirthMultiplier,
  rebirthRequiredLevel,
  shooterMultiplier,
  suitPerClickOf,
  type InventoryActionKind,
  type NamedTeleport,
} from '@spider/shared';
import type { NetGear, NetPet } from '../net/netTypes.js';
import { ICON } from './icons.js';
import type { ModelPortraits } from './ModelPortraits.js';
import { injectSpiderStyles } from './spiderStyles.js';

/**
 * How many windows are open. The input layer polls this to suppress movement
 * while a window owns the screen. A COUNT, so two windows closing in the wrong
 * order can never leave the game stuck.
 */
let openCount = 0;
export const anyWindowOpen = (): boolean => openCount > 0;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, html = ''): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (html) node.innerHTML = html;
  return node;
};

const button = (className: string, html: string, onClick: () => void): HTMLButtonElement => {
  const node = el('button', className, html);
  node.type = 'button';
  node.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick();
  });
  return node;
};

/**
 * An Evolution-style window: a coloured header with a big tilted icon, the
 * title, extra header buttons and a pink close square, over a dark glass
 * body; counters above it on the right; action buttons standing to its left.
 */
class Window {
  protected readonly modal: HTMLDivElement;
  protected readonly frame: HTMLDivElement;
  protected readonly side: HTMLDivElement;
  protected readonly window: HTMLDivElement;
  protected readonly head: HTMLDivElement;
  protected readonly headIcon: HTMLDivElement;
  protected readonly title: HTMLSpanElement;
  protected readonly extra: HTMLSpanElement;
  protected readonly top: HTMLDivElement;
  protected readonly body: HTMLDivElement;
  private open = false;
  onClose: (() => void) | null = null;

  constructor(parent: HTMLElement, variant: string, icon: string, title: string, options: { small?: boolean } = {}) {
    injectSpiderStyles();
    this.modal = el('div', 'sp-modal sp-hidden');
    this.frame = el('div', 'sp-frame');
    this.side = el('div', 'sp-side sp-hidden');
    this.window = el('div', `sp-win sp-win--${variant}${options.small ? ' sp-win--small' : ''}`);
    this.top = el('div', 'sp-win__top sp-font sp-outline');
    this.head = el('div', 'sp-head');
    this.headIcon = el('div', 'sp-head__icon', icon);
    this.title = el('span', 'sp-head__title sp-font sp-outline', title);
    this.extra = el('span', 'sp-head__extra sp-font sp-outline');
    this.head.append(this.headIcon, this.title, this.extra);
    this.head.append(button('sp-close', ICON.close, () => this.setOpen(false)));
    this.head.lastElementChild?.setAttribute('aria-label', 'Close');
    this.body = el('div', 'sp-body sp-font');
    this.window.append(this.top, this.head, this.body);
    this.frame.append(this.side, this.window);
    this.modal.append(this.frame);
    this.modal.addEventListener('pointerdown', (event) => {
      if (event.target === this.modal) this.setOpen(false);
    });
    parent.appendChild(this.modal);
  }

  get isOpen(): boolean {
    return this.open;
  }

  toggle(): void {
    this.setOpen(!this.open);
  }

  setOpen(open: boolean): void {
    if (open === this.open) return;
    this.open = open;
    this.modal.classList.toggle('sp-hidden', !open);
    openCount = Math.max(0, openCount + (open ? 1 : -1));
    if (open) this.render();
    else this.onClose?.();
  }

  /** A header button (Stats, Auto Delete ...), before the close square. */
  protected headButton(label: string, onClick: () => void): HTMLButtonElement {
    const node = button('sp-head__btn sp-font sp-outline', label, onClick);
    this.head.insertBefore(node, this.head.lastElementChild);
    return node;
  }

  protected render(): void {
    /* subclasses */
  }

  dispose(): void {
    this.setOpen(false);
    this.modal.remove();
  }
}

// ------------------------------------------------------------ backpack

export type BackpackTab = 'pets' | 'suits' | 'shooters' | 'gear';

export interface BackpackState {
  wins: number;
  rebirths: number;
  suitSlot: number;
  ownedSuits: number;
  shooterId: number;
  ownedShooters: number;
  pets: readonly NetPet[];
  gear: readonly NetGear[];
  /** The player's Bloxity portrait, for the "Your Avatar" card (empty when there is none). */
  avatarUrl?: string;
}

export interface BackpackActions {
  suitSelect(slot: number): void;
  shooterSelect(id: number): void;
  petAction(action: InventoryActionKind, uid?: number): void;
  gearAction(action: InventoryActionKind, uid?: number): void;
}

const TAB_TITLES: Readonly<Record<BackpackTab, string>> = { pets: 'Pets', suits: 'Suits', shooters: 'Web Shooters', gear: 'Gear' };
const TAB_VARIANTS: Readonly<Record<BackpackTab, string>> = { pets: 'pets', suits: 'suits', shooters: 'shooters', gear: 'gear' };
const TAB_ICONS: Readonly<Record<BackpackTab, string>> = { pets: ICON.pets, suits: ICON.suit, shooters: ICON.shooter, gear: ICON.gear };

/**
 * THE BACKPACK, as the screenshots: tabs for Pets, Suits, Web Shooters and
 * Gear. Pets and Gear show "N/3 Equipped  N/30 Slots" above, with Equip Best
 * and Delete to the left; Gear lists its three equipped slots under the grid.
 * Every button is a REQUEST the server checks.
 */
export class BackpackWindow extends Window {
  private tab: BackpackTab = 'pets';
  private readonly tabs = new Map<BackpackTab, HTMLButtonElement>();
  private state: BackpackState = { wins: 0, rebirths: 0, suitSlot: 0, ownedSuits: 0, shooterId: 1, ownedShooters: 1, pets: [], gear: [] };
  private signature = '';
  private deleting = false;
  private selectedShooter = 1;
  private readonly deleteButton: HTMLButtonElement;
  /** Highest pet / gear uid the player has looked at: anything newer carries a "!". */
  private seenPet = -1;
  private seenGear = -1;

  constructor(parent: HTMLElement, private readonly portraits: ModelPortraits, private readonly actions: BackpackActions) {
    super(parent, 'pets', ICON.pets, 'Pets');
    const tabs = el('div', 'sp-tabs');
    for (const id of ['pets', 'suits', 'shooters', 'gear'] as const) {
      const node = button('sp-tab sp-font sp-outline', `${TAB_ICONS[id]}<span>${TAB_TITLES[id]}</span><span class="sp-tab__badge"></span>`, () => this.show(id));
      tabs.append(node);
      this.tabs.set(id, node);
    }
    this.window.insertBefore(tabs, this.body);
    const best = button('sp-action sp-font sp-outline', 'Equip Best', () => {
      if (this.tab === 'pets') this.actions.petAction('equipBest');
      else if (this.tab === 'gear') this.actions.gearAction('equipBest');
    });
    this.deleteButton = button('sp-action sp-action--red sp-font sp-outline', 'Delete', () => {
      this.deleting = !this.deleting;
      this.render();
    });
    this.side.append(best, this.deleteButton);
  }

  show(tab: BackpackTab): void {
    if (this.tab !== tab) this.deleting = false;
    this.tab = tab;
    this.signature = '';
    if (!this.isOpen) this.setOpen(true);
    else this.render();
  }

  get currentTab(): BackpackTab {
    return this.tab;
  }

  /** True when there is a pet or gear piece the player has not looked at yet. */
  get hasNew(): boolean {
    return this.state.pets.some((pet) => pet.uid > this.seenPet) || this.state.gear.some((piece) => piece.uid > this.seenGear);
  }

  setState(state: BackpackState): void {
    // The first state seen counts as seen: only what arrives later is "new".
    if (this.seenPet < 0) this.seenPet = Math.max(0, ...state.pets.map((pet) => pet.uid));
    if (this.seenGear < 0) this.seenGear = Math.max(0, ...state.gear.map((piece) => piece.uid));
    this.state = state;
    for (const [id, node] of this.tabs) {
      const ready = id === 'pets' ? state.pets.some((pet) => pet.uid > this.seenPet) : id === 'gear' ? state.gear.some((piece) => piece.uid > this.seenGear) : false;
      node.classList.toggle('sp-tab--ready', ready);
    }
    if (!this.isOpen) return;
    if (this.signatureOf(state) === this.signature) return;
    this.render();
  }

  private signatureOf(s: BackpackState): string {
    const pets = s.pets.map((pet) => `${pet.uid}:${pet.petId}:${pet.equipped ? 1 : 0}`).join(',');
    const gear = s.gear.map((piece) => `${piece.uid}:${piece.gearId}:${piece.rarity}:${piece.equipped ? 1 : 0}`).join(',');
    return `${this.tab}|${this.deleting ? 1 : 0}|${Math.floor(s.wins)}|${s.rebirths}|${s.suitSlot}|${s.ownedSuits}|${s.avatarUrl ?? ""}|${s.shooterId}|${s.ownedShooters}|${this.selectedShooter}|${pets}|${gear}`;
  }

  protected override render(): void {
    const s = this.state;
    this.signature = this.signatureOf(s);
    for (const [id, node] of this.tabs) node.classList.toggle('sp-tab--on', id === this.tab);
    this.window.className = `sp-win sp-win--${TAB_VARIANTS[this.tab]}`;
    this.headIcon.innerHTML = TAB_ICONS[this.tab];
    this.title.textContent = TAB_TITLES[this.tab];
    this.extra.textContent = '';
    const inventory = this.tab === 'pets' || this.tab === 'gear';
    this.side.classList.toggle('sp-hidden', !inventory);
    this.deleteButton.classList.toggle('sp-action--on', this.deleting);
    this.deleteButton.textContent = this.deleting ? 'Done' : 'Delete';
    this.body.replaceChildren();
    this.top.replaceChildren();
    switch (this.tab) {
      case 'pets':
        this.renderPets();
        this.seenPet = Math.max(this.seenPet, ...s.pets.map((pet) => pet.uid));
        break;
      case 'suits':
        this.renderSuits();
        break;
      case 'shooters':
        this.renderShooters();
        break;
      case 'gear':
        this.renderGear();
        this.seenGear = Math.max(this.seenGear, ...s.gear.map((piece) => piece.uid));
        break;
    }
  }

  private card(image: string, name: string, className: string, options: { check?: boolean; badge?: boolean; locked?: boolean; title?: string } = {}): HTMLButtonElement {
    const card = el('button', `sp-card ${className}${options.locked ? ' sp-card--locked' : ''}${this.deleting ? ' sp-card--delete' : ''}`);
    card.type = 'button';
    if (options.title) card.title = options.title;
    if (image) {
      const img = el('img', 'sp-card__img');
      img.src = image;
      img.alt = name;
      img.draggable = false;
      card.append(img);
    }
    if (options.check) card.append(el('div', 'sp-card__check', ICON.check));
    if (options.badge) card.append(el('div', 'sp-card__badge sp-font', '!'));
    card.append(el('div', 'sp-card__name sp-outline', name));
    return card;
  }

  private renderPets(): void {
    const s = this.state;
    const equipped = s.pets.filter((pet) => pet.equipped).length;
    this.top.append(el('span', '', `${equipped}/${PET_EQUIP_MAX} Equipped`), el('span', '', `${s.pets.length}/${PET_INVENTORY_MAX} Slots`));
    if (s.pets.length === 0) {
      this.body.append(el('div', 'sp-empty sp-outline', 'No pets yet! Hatch an egg at the back of the plaza.'));
      return;
    }
    const ranked = [...s.pets].sort(
      (a, b) => Number(b.equipped) - Number(a.equipped) || (petById(b.petId)?.bonus ?? 0) - (petById(a.petId)?.bonus ?? 0) || a.uid - b.uid,
    );
    const grid = el('div', 'sp-grid');
    for (const pet of ranked) {
      const kind = petById(pet.petId);
      if (!kind) continue;
      const card = this.card(this.portraits.pet(pet.petId), kind.name, `sp-rarity-${kind.rarity}`, {
        check: pet.equipped,
        badge: pet.uid > this.seenPet,
        title: `${kind.name} - ${kind.rarity} - +${formatAmount(kind.bonus)}% Power`,
      });
      card.addEventListener('click', () => {
        if (this.deleting) this.actions.petAction('delete', pet.uid);
        else this.actions.petAction(pet.equipped ? 'unequip' : 'equip', pet.uid);
      });
      grid.append(card);
    }
    this.body.append(grid);
    const bonus = Math.round((petMultiplier(s.pets.filter((pet) => pet.equipped).map((pet) => pet.petId)) - 1) * 100);
    this.body.append(el('div', 'sp-totals sp-outline', `Equipped pets: +${formatAmount(bonus)}% Web Power per click`));
    this.body.append(el('div', 'sp-note', this.deleting ? 'Tap a pet to DELETE it.' : 'Tap a pet to equip or unequip it.'));
  }

  private renderSuits(): void {
    const s = this.state;
    const owned = SUITS.filter((suit) => ownsSuit(s.ownedSuits, suit.slot)).length;
    this.top.append(el('span', '', `${owned}/${SUIT_COUNT} Owned`));
    const grid = el('div', 'sp-grid');
    // First: the player's own Bloxity avatar - always owned, worn again at any time.
    const self = this.card(s.avatarUrl || this.portraits.suit(AVATAR_SLOT), 'Your Avatar', 'sp-rarity-common', {
      check: s.suitSlot === AVATAR_SLOT,
      title: 'Be yourself: your own Bloxity avatar (+1/click)',
    });
    self.addEventListener('click', () => this.actions.suitSelect(AVATAR_SLOT));
    grid.append(self);
    for (const suit of SUITS) {
      const has = ownsSuit(s.ownedSuits, suit.slot);
      const affordable = s.wins >= suit.cost;
      const rarity = suit.slot >= 16 ? 'legendary' : suit.slot >= 10 ? 'epic' : suit.slot >= 5 ? 'rare' : 'common';
      const card = this.card(this.portraits.suit(suit.slot), has ? suit.name : `${formatWins(suit.cost)} 🏆`, `sp-rarity-${rarity}`, {
        check: s.suitSlot === suit.slot,
        locked: !has,
        badge: !has && affordable,
        title: has ? `Wear the ${suit.name} (+${formatAmount(suit.perClick)}/click)` : `Buy the ${suit.name}: +${formatAmount(suit.perClick)}/click for ${formatWins(suit.cost)} Trophies`,
      });
      card.addEventListener('click', () => this.actions.suitSelect(suit.slot));
      grid.append(card);
    }
    this.body.append(grid);
    const worn = SUITS[s.suitSlot - 1];
    if (worn) this.body.append(el('div', 'sp-totals sp-outline', `Wearing the ${worn.name}: +${formatAmount(suitPerClickOf(s.suitSlot, s.ownedSuits))} per click`));
    else this.body.append(el('div', 'sp-totals sp-outline', `Wearing your own avatar: +${formatAmount(suitPerClickOf(AVATAR_SLOT, s.ownedSuits))} per click`));
    this.body.append(el('div', 'sp-note', 'Claim the Classic Suit free to become Spider-Man! Buy suits here or on the Suit Upgrades stage to the right of spawn. Rebirth resets suits.'));
  }

  private renderShooters(): void {
    const s = this.state;
    const owned = SHOOTERS.filter((def) => ownsShooter(s.ownedShooters, def.id));
    this.top.append(el('span', '', `Owned: ${owned.length}`));
    if (!ownsShooter(s.ownedShooters, this.selectedShooter)) this.selectedShooter = s.shooterId;
    const split = el('div', 'sp-split');
    const grid = el('div', 'sp-grid');
    for (const def of owned) {
      const card = this.card(this.portraits.shooter(def.id), def.name, 'sp-rarity-rare', { check: s.shooterId === def.id });
      if (def.id === this.selectedShooter) card.classList.add('sp-card--selected');
      card.addEventListener('click', () => {
        this.selectedShooter = def.id;
        this.render();
      });
      grid.append(card);
    }
    const chosen = SHOOTERS[this.selectedShooter - 1] ?? SHOOTERS[0]!;
    const detail = el('div', 'sp-detail');
    const img = el('img', '');
    img.src = this.portraits.shooter(chosen.id);
    img.alt = chosen.name;
    detail.append(img, el('div', 'sp-detail__name sp-outline', chosen.name));
    const worn = s.shooterId === chosen.id;
    detail.append(el('div', 'sp-detail__state sp-outline', worn ? 'Equipped' : 'Owned'));
    detail.append(el('div', 'sp-detail__mult sp-outline', `${chosen.multiplier}x Power`));
    const action = button(`sp-action ${worn ? 'sp-action--red' : ''} sp-font sp-outline`, worn ? 'Equipped' : 'Equip', () => this.actions.shooterSelect(chosen.id));
    action.disabled = worn;
    action.style.minWidth = '0';
    detail.append(action);
    split.append(grid, detail);
    this.body.append(split);
    this.body.append(el('div', 'sp-note', 'Buy more web shooters at the Web Shooter stand, back-left of the plaza.'));
  }

  private renderGear(): void {
    const s = this.state;
    const worn = s.gear.filter((piece) => piece.equipped);
    this.top.append(el('span', '', `${worn.length}/${GEAR_EQUIP_MAX} Equipped`), el('span', '', `${s.gear.length}/${GEAR_INVENTORY_MAX} Slots`));
    if (s.gear.length === 0) {
      this.body.append(el('div', 'sp-empty sp-outline', 'No gear yet! Defeated villains drop runes, masks and more.'));
    } else {
      const ranked = [...s.gear].sort((a, b) => Number(b.equipped) - Number(a.equipped) || gearScore(b.gearId, b.rarity) - gearScore(a.gearId, a.rarity) || b.uid - a.uid);
      const grid = el('div', 'sp-grid');
      for (const piece of ranked) {
        const def = gearById(piece.gearId);
        if (!def) continue;
        const card = this.card(this.portraits.gear(piece.gearId, piece.rarity), def.name, `sp-rarity-${piece.rarity}`, {
          check: piece.equipped,
          badge: piece.uid > this.seenGear,
          title: `${gearLabel(piece.gearId, piece.rarity)}: ${gearStatText(piece.gearId, piece.rarity)}`,
        });
        card.addEventListener('click', () => {
          if (this.deleting) this.actions.gearAction('delete', piece.uid);
          else this.actions.gearAction(piece.equipped ? 'unequip' : 'equip', piece.uid);
        });
        grid.append(card);
      }
      this.body.append(grid);
    }
    // The three equipped slots, as the reference's bottom row.
    const slots = el('div', 'sp-equipped');
    for (let i = 0; i < GEAR_EQUIP_MAX; i += 1) {
      const piece = worn[i];
      const slot = el('button', `sp-slot${piece ? ` sp-rarity-${piece.rarity}` : ''}`);
      slot.type = 'button';
      if (piece) {
        const img = el('img', '');
        img.src = this.portraits.gear(piece.gearId, piece.rarity);
        img.alt = '';
        const name = el('div', 'sp-slot__name sp-outline');
        // As the reference: "Epic Speed", "Rare Health" - a rune by its stat, anything else by its last word.
        const words = gearById(piece.gearId)?.name.split(' ') ?? [''];
        const short = gearById(piece.gearId)?.mount === 'rune' ? words[0] : words[words.length - 1];
        name.textContent = `${GEAR_RARITY_NAMES[piece.rarity] ?? ''} ${short ?? ''}`;
        name.style.color = GEAR_RARITY_COLORS[piece.rarity] ?? '#fff';
        slot.append(img, name);
        slot.title = `Unequip ${gearLabel(piece.gearId, piece.rarity)}`;
        slot.addEventListener('click', () => this.actions.gearAction('unequip', piece.uid));
      } else {
        slot.append(el('div', 'sp-slot__empty sp-outline', 'Empty'));
      }
      slots.append(slot);
    }
    this.body.append(slots);
    const totals = gearTotals(worn.map((piece) => ({ gearId: piece.gearId, rarity: piece.rarity })));
    this.body.append(
      el(
        'div',
        'sp-totals sp-outline',
        `+${round(totals.power)}% Power &nbsp; +${round(totals.speed)}% Speed &nbsp; +${round(totals.health)}% Health &nbsp; ${round(totals.defense)}% Defense`,
      ),
    );
    this.body.append(el('div', 'sp-note', this.deleting ? 'Tap a piece to DELETE it.' : 'Tap to equip. One mask, one back piece and one necklace at a time; runes stack. Gear shows on your Spider-Man!'));
  }
}

const round = (value: number): string => (Math.round(value * 10) / 10).toString();

// -------------------------------------------------------------- rebirth

/**
 * THE REBIRTH WINDOW, as the reference: "Resets your Power, Levels, and
 * Wins!", Current -> After for the XP multiplier and the health, the level bar
 * toward the requirement, and the Rebirth button. The server decides.
 */
export class RebirthWindow extends Window {
  private readonly nowMult: HTMLSpanElement;
  private readonly nextMult: HTMLSpanElement;
  private readonly nowHealth: HTMLSpanElement;
  private readonly nextHealth: HTMLSpanElement;
  private readonly swings: HTMLDivElement;
  private readonly fill: HTMLDivElement;
  private readonly label: HTMLDivElement;
  private readonly action: HTMLButtonElement;
  private eligible = false;
  private level = 1;
  private rebirths = 0;

  constructor(parent: HTMLElement, onRebirth: () => void) {
    super(parent, 'rebirth', ICON.rebirth, 'Rebirth', { small: true });
    this.body.append(el('div', 'sp-warn sp-outline', 'Resets your Power, Levels, Suits and Wins!'));
    const grid = el('div', 'sp-rb');
    const value = (): HTMLSpanElement => el('span', 'sp-outline', '');
    this.nowMult = value();
    this.nextMult = value();
    this.nowHealth = value();
    this.nextHealth = value();
    const card = (icon: string, span: HTMLSpanElement): HTMLDivElement => {
      const node = el('div', 'sp-rb__card sp-font', icon);
      node.append(span);
      return node;
    };
    grid.append(el('div', 'sp-rb__label sp-outline', 'Current'), el('div', ''), el('div', 'sp-rb__label sp-outline', 'After'));
    grid.append(card(ICON.web, this.nowMult), el('div', 'sp-rb__arrow sp-outline', '&#9654;'), card(ICON.web, this.nextMult));
    grid.append(el('div', 'sp-rb__label sp-outline', 'Current'), el('div', ''), el('div', 'sp-rb__label sp-outline', 'After'));
    grid.append(card(ICON.health, this.nowHealth), el('div', 'sp-rb__arrow sp-outline', '&#9654;'), card(ICON.health, this.nextHealth));
    this.body.append(grid);
    const bar = el('div', 'sp-bar');
    this.fill = el('div', 'sp-bar__fill');
    this.label = el('div', 'sp-bar__text sp-outline');
    bar.append(this.fill, this.label);
    this.body.append(bar);
    this.swings = el('div', 'sp-totals sp-outline');
    this.body.append(this.swings);
    const row = el('div', 'sp-buttons');
    this.action = button('sp-action sp-font sp-outline', 'Rebirth<small>Resets suits, wins</small>', () => {
      if (!this.eligible) return;
      onRebirth();
      this.setOpen(false);
    });
    row.append(this.action);
    this.body.append(row);
    this.body.append(el('div', 'sp-note', 'Each rebirth multiplies all XP and Web Power, adds health, and opens stronger training buildings. Every third rebirth adds a web swing.'));
    this.setProgress(0, 0);
  }

  get isEligible(): boolean {
    return this.eligible;
  }

  /** 0..1 progress toward the next rebirth, for the button. */
  get progress(): number {
    return Math.min(1, this.level / rebirthRequiredLevel(this.rebirths));
  }

  setProgress(xp: number, rebirths: number): void {
    const level = levelForXp(xp).level;
    this.level = level;
    this.rebirths = rebirths;
    const required = rebirthRequiredLevel(rebirths);
    this.eligible = canRebirth(level, rebirths);
    this.extra.textContent = `Rebirth ${formatCount(rebirths)}  -  Level ${formatCount(level)}`;
    this.nowMult.textContent = formatMultiplier(rebirthMultiplier(rebirths)).slice(1) + 'x';
    this.nextMult.textContent = formatMultiplier(rebirthMultiplier(rebirths + 1)).slice(1) + 'x';
    this.nowHealth.textContent = formatCount(rebirthHealth(rebirths));
    this.nextHealth.textContent = formatCount(rebirthHealth(rebirths + 1));
    const swingsNow = maxSwingsFor(rebirths);
    const swingsNext = maxSwingsFor(rebirths + 1);
    this.swings.textContent = swingsNext > swingsNow ? `Next rebirth: +1 web swing (${swingsNow} > ${swingsNext})!` : `Rebirth ${formatCount(rebirths)} > ${formatCount(rebirths + 1)}  -  needs Level ${formatCount(required)}`;
    const shown = Math.min(level, required);
    this.fill.style.width = `${Math.min(100, (shown / required) * 100).toFixed(1)}%`;
    this.label.textContent = `Level ${formatCount(shown)}/${formatCount(required)}`;
    this.action.disabled = !this.eligible;
    this.action.innerHTML = this.eligible ? 'Rebirth<small>Resets suits, wins</small>' : `Reach Level ${formatCount(required)}<small>to rebirth</small>`;
  }
}

// ------------------------------------------------------------------ eggs

/**
 * THE EGG WINDOW: opens on an egg's pad. Shows the four pets it holds with
 * their odds and bonuses, and asks the server to hatch one or three.
 */
export class EggWindow extends Window {
  private egg = 0;
  private wins = 0;
  private inventory = 0;

  constructor(parent: HTMLElement, private readonly portraits: ModelPortraits, private readonly onHatch: (egg: number, count: number) => void) {
    super(parent, 'egg', ICON.pets, 'Egg', { small: true });
  }

  openEgg(egg: number): void {
    this.egg = egg;
    if (!this.isOpen) this.setOpen(true);
    else this.render();
  }

  setState(wins: number, inventory: number): void {
    const changed = Math.floor(wins) !== Math.floor(this.wins) || inventory !== this.inventory;
    this.wins = wins;
    this.inventory = inventory;
    if (changed && this.isOpen) this.render();
  }

  protected override render(): void {
    const egg = eggById(this.egg);
    this.body.replaceChildren();
    this.top.replaceChildren();
    if (!egg) return;
    this.title.textContent = egg.name;
    this.top.append(el('span', '', `${this.inventory}/${PET_INVENTORY_MAX} Pets`));
    const grid = el('div', 'sp-grid');
    for (const [petId, chance] of egg.pool) {
      const pet = petById(petId);
      if (!pet) continue;
      const card = el('div', `sp-card sp-rarity-${pet.rarity}`);
      const img = el('img', 'sp-card__img');
      img.src = this.portraits.pet(petId);
      img.alt = pet.name;
      card.append(img, el('div', 'sp-card__name sp-outline', `${pet.name}<br><span style="color:${PET_RARITY_COLORS[pet.rarity]}">${chance}%</span> +${formatAmount(pet.bonus)}%`));
      grid.append(card);
    }
    this.body.append(grid);
    const row = el('div', 'sp-buttons');
    row.style.marginTop = 'calc(18 * var(--u))';
    for (const count of [1, 3]) {
      const cost = egg.cost * count;
      const hatch = button(`sp-action ${count === 1 ? '' : 'sp-action--gold'} sp-font sp-outline`, `Hatch ${count} &nbsp;${formatWins(cost)} 🏆`, () => this.onHatch(egg.id, count));
      hatch.disabled = this.wins < cost || this.inventory + count > PET_INVENTORY_MAX;
      row.append(hatch);
    }
    this.body.append(row);
    this.body.append(el('div', 'sp-note', "Pets add their bonus % to every web click's Web Power and XP."));
  }
}

/** The hatch reveal: the new pets, big, for a moment. */
export const showHatch = (parent: HTMLElement, portraits: ModelPortraits, petIds: readonly number[]): void => {
  const overlay = el('div', 'sp-hatch sp-font');
  const box = el('div', 'sp-hatch__box');
  for (const id of petIds) {
    const pet = petById(id);
    if (!pet) continue;
    const item = el('div', 'sp-hatch__pet');
    const img = el('img', '');
    img.src = portraits.pet(id);
    img.alt = pet.name;
    item.append(img, el('div', 'sp-hatch__name sp-outline', pet.name));
    const rarity = el('div', 'sp-hatch__rarity sp-outline', pet.rarity.toUpperCase());
    rarity.style.color = PET_RARITY_COLORS[pet.rarity];
    item.append(rarity);
    box.append(item);
  }
  overlay.append(box);
  const close = (): void => overlay.remove();
  overlay.addEventListener('pointerdown', close);
  parent.appendChild(overlay);
  window.setTimeout(close, 2600);
};

// ---------------------------------------------------- web shooter stand

/**
 * THE WEB SHOOTER STAND, as the reference: a row per shooter - its web, its
 * name and multiplier, and its Trophy price (or Equipped / Equip).
 */
export class ShooterShopWindow extends Window {
  private wins = 0;
  private owned = 1;
  private worn = 1;

  constructor(parent: HTMLElement, private readonly portraits: ModelPortraits, private readonly onSelect: (id: number) => void) {
    super(parent, 'shop', ICON.shooter, 'Web Shooters', { small: true });
  }

  setState(wins: number, owned: number, worn: number): void {
    const changed = Math.floor(wins) !== Math.floor(this.wins) || owned !== this.owned || worn !== this.worn;
    this.wins = wins;
    this.owned = owned;
    this.worn = worn;
    if (changed && this.isOpen) this.render();
  }

  protected override render(): void {
    this.body.replaceChildren();
    const rows = el('div', 'sp-rows');
    const tints: readonly (readonly [string, string])[] = [
      ['#5ab8ff', '#dff3ff'],
      ['#ffa01a', '#ffd89a'],
      ['#ff4a4a', '#ffc0c0'],
    ];
    SHOOTERS.forEach((def, index) => {
      const row = el('div', 'sp-row');
      row.style.setProperty('--ra', tints[index]?.[0] ?? '#5ab8ff');
      row.style.setProperty('--rb', tints[index]?.[1] ?? '#dff3ff');
      const img = el('img', '');
      img.src = this.portraits.shooter(def.id);
      img.alt = def.name;
      const text = el('div', 'sp-row__text');
      text.append(el('div', 'sp-row__name sp-outline', def.name), el('div', 'sp-row__mult', `${def.multiplier}x Power`));
      const has = ownsShooter(this.owned, def.id);
      const worn = this.worn === def.id;
      const action = has
        ? button(`sp-action ${worn ? '' : 'sp-action--blue'} sp-font sp-outline`, worn ? 'Equipped' : 'Equip', () => this.onSelect(def.id))
        : button('sp-action sp-action--gold sp-font sp-outline', `${ICON.trophy}<span>${formatWins(def.cost)}</span>`, () => this.onSelect(def.id));
      action.disabled = worn || (!has && this.wins < def.cost);
      row.append(img, text, action);
      rows.append(row);
    });
    this.body.append(rows);
    this.body.append(el('div', 'sp-note', 'A web shooter multiplies every web click and colours your webs.'));
  }
}

// -------------------------------------------------------------- teleport

const PLACES: readonly (readonly [NamedTeleport, string])[] = [
  ['spawn', 'Spawn'],
  ['training', 'Training'],
  ['suits', 'Suit Upgrades'],
  ['eggs', 'Pet Eggs'],
  ['shooters', 'Web Shooters'],
];

/**
 * TELEPORT AND STAGE PROGRESS: the plaza's places, and every stage with its
 * villain, recommended Web Power and Trophy reward. A stage is open up to one
 * past the best stage ever cleared; the server re-checks.
 */
export class TeleportWindow extends Window {
  private bestStage = 0;
  private webPower = 0;

  constructor(parent: HTMLElement, private readonly onTeleport: (to: string) => void) {
    super(parent, 'teleport', ICON.teleport, 'Teleport');
  }

  setState(bestStage: number, webPower: number): void {
    const changed = bestStage !== this.bestStage || Math.floor(Math.log10(webPower + 1)) !== Math.floor(Math.log10(this.webPower + 1));
    this.bestStage = bestStage;
    this.webPower = webPower;
    if (changed && this.isOpen) this.render();
  }

  protected override render(): void {
    this.body.replaceChildren();
    this.top.replaceChildren();
    this.top.append(el('span', '', `Best Stage: ${this.bestStage}/${STAGES.length}`));
    const places = el('div', 'sp-tp');
    for (const [id, name] of PLACES) {
      if (!(id in TELEPORTS)) continue;
      const node = button('sp-tp__btn sp-font sp-outline', `<span class="sp-tp__name">${name}</span>`, () => {
        this.onTeleport(id);
        this.setOpen(false);
      });
      places.append(node);
    }
    this.body.append(places);
    this.body.append(el('div', 'sp-line sp-line--head sp-outline', '<span>Villain Stages</span><span>Trophies</span>'));
    const stages = el('div', 'sp-tp');
    for (const stage of STAGES) {
      const open = stage.index <= this.bestStage + 1;
      const cleared = stage.index <= this.bestStage;
      const ready = this.webPower >= stage.recommendedPower;
      const boss = stage.enemies.find((enemy) => enemy.boss);
      const node = button(
        `sp-tp__btn sp-tp__btn--stage${cleared ? ' sp-tp__btn--cleared' : ''} sp-font sp-outline`,
        `<span class="sp-tp__name">${stage.index}. ${stage.name}</span>` +
          `<span class="sp-tp__meta">${boss ? `Boss: ${boss.name} - ` : ''}${formatAmount(stage.recommendedPower)} Power${ready ? '' : ' (too strong!)'} - +${formatWins(stage.reward)} 🏆</span>`,
        () => {
          this.onTeleport(`stage${stage.index}`);
          this.setOpen(false);
        },
      );
      node.disabled = !open;
      if (!open) node.title = `Clear Stage ${stage.index - 1} to unlock`;
      stages.append(node);
    }
    this.body.append(stages);
  }
}

// ----------------------------------------------------------------- stats

export interface StatsView {
  level: number;
  xp: number;
  webPower: number;
  bestWebPower: number;
  gainPerClick: number;
  suitSlot: number;
  ownedSuits: number;
  shooterId: number;
  ownedShooters: number;
  rebirths: number;
  petIds: readonly number[];
  gear: readonly NetGear[];
  moveSpeed: number;
  maxSwings: number;
  health: number;
  maxHealth: number;
  defense: number;
  wins: number;
  lifetimeWins: number;
  kills: number;
  totalDamage: number;
  bestStage: number;
  playSeconds: number;
}

/** EVERY STAT, and where the gain per click comes from. All replicated server figures. */
export class StatsWindow extends Window {
  private view: StatsView | null = null;
  private signature = '';

  constructor(parent: HTMLElement) {
    super(parent, 'stats', ICON.stats, 'Stats', { small: true });
  }

  setState(view: StatsView): void {
    this.view = view;
    if (!this.isOpen) return;
    const signature = JSON.stringify([view.level, view.webPower, view.gainPerClick, view.wins, view.kills, view.health, Math.floor(view.playSeconds / 10)]);
    if (signature === this.signature) return;
    this.render();
  }

  protected override render(): void {
    const v = this.view;
    this.body.replaceChildren();
    if (!v) return;
    this.signature = JSON.stringify([v.level, v.webPower, v.gainPerClick, v.wins, v.kills, v.health, Math.floor(v.playSeconds / 10)]);
    const progress = levelForXp(v.xp);
    const worn = v.gear.filter((piece) => piece.equipped).map((piece) => ({ gearId: piece.gearId, rarity: piece.rarity }));
    const gear = gearTotals(worn);
    const list = el('div', 'sp-list');
    const line = (name: string, value: string, head = false): void => {
      const row = el('div', `sp-line${head ? ' sp-line--head' : ''} sp-outline`);
      row.append(el('span', '', name), el('span', '', value));
      list.append(row);
    };
    line('Progress', '', true);
    line('Level', `${formatCount(v.level)}  (${formatAmount(progress.into)} / ${formatAmount(progress.need)} XP)`);
    line('Web Power', formatAmount(v.webPower));
    line('Best Web Power', formatAmount(v.bestWebPower));
    line('Rebirths', `${formatCount(v.rebirths)}  (next at Level ${formatCount(rebirthRequiredLevel(v.rebirths))})`);
    line('Per web click', '', true);
    line('Suit', `+${formatAmount(suitPerClickOf(v.suitSlot, v.ownedSuits))}`);
    line('Web shooter', `${shooterMultiplier(v.shooterId, v.ownedShooters)}x`);
    line('Pets', `${Math.round(petMultiplier(v.petIds) * 100) / 100}x`);
    line('Gear power', `${Math.round((1 + gear.power / 100) * 100) / 100}x`);
    line('Rebirth', formatMultiplier(rebirthMultiplier(v.rebirths)).slice(1) + 'x');
    line('Total per click', `+${formatAmount(v.gainPerClick)}  (x training building)`);
    line('Body', '', true);
    line('Speed', `${Math.round(v.moveSpeed)}`);
    line('Web swings', `${v.maxSwings}`);
    line('Health', `${formatAmount(Math.ceil(v.health))} / ${formatAmount(v.maxHealth)}`);
    line('Defense', `${Math.round(v.defense * 10) / 10}%`);
    line('Record', '', true);
    line('Trophies', `${formatWins(v.wins)}  (${formatWins(v.lifetimeWins)} ever)`);
    line('Villains defeated', formatWins(v.kills));
    line('Damage dealt', formatAmount(v.totalDamage));
    line('Best stage', `${v.bestStage} / ${STAGES.length}`);
    line('Time played', formatPlayTime(v.playSeconds));
    line('Eggs', `${EGGS.length} kinds`);
    this.body.append(list);
  }
}
