/**
 * THE NINETEEN SPIDER SUITS on the Suit Upgrades stage (right of the spawn).
 *
 * `perClick` is the suit's BASE progression per web click - the first factor
 * of the one gain formula (`progression.ts`). `cost` is a Trophy (Wins) PRICE:
 * standing on the suit's pad, or pressing Buy in the Backpack, with enough
 * Wins spends them and the suit is owned and worn. Slot 1, the Classic Suit,
 * is owned by everyone from the start.
 *
 * Order is the stage order and the pad order. NEVER REORDER: owned suits are
 * a bitmask keyed by slot, persisted.
 */
export interface SuitTier {
  /** 1-based slot, and the pad number on the stage. */
  readonly slot: number;
  readonly name: string;
  /** Base Web Power / XP per web click. */
  readonly perClick: number;
  /** Trophy (Wins) price. */
  readonly cost: number;
  /** The label colour on the stage and in the menus. */
  readonly color: string;
}

const K = 1_000;
const M = 1_000_000;
const B = 1_000_000_000;

export const SUITS: readonly SuitTier[] = [
  { slot: 1, name: 'Classic Suit', perClick: 1, cost: 0, color: '#ff4a4a' },
  { slot: 2, name: 'Homemade Suit', perClick: 2, cost: 1, color: '#ff7a5a' },
  { slot: 3, name: 'Scarlet Spider', perClick: 5, cost: 3, color: '#ff3b5c' },
  { slot: 4, name: 'Stealth Suit', perClick: 12, cost: 10, color: '#6dffb0' },
  { slot: 5, name: 'Iron Spider', perClick: 25, cost: 25, color: '#ffc83a' },
  { slot: 6, name: 'Symbiote Suit', perClick: 50, cost: 100, color: '#c9d3ff' },
  { slot: 7, name: 'Spider-Punk', perClick: 125, cost: 500, color: '#ff5ad2' },
  { slot: 8, name: 'Miles Suit', perClick: 250, cost: 2 * K, color: '#ff4a4a' },
  { slot: 9, name: 'Ghost-Spider', perClick: 500, cost: 7.5 * K, color: '#ff8ad8' },
  { slot: 10, name: 'Spider 2099', perClick: 1 * K, cost: 200 * K, color: '#4ac8ff' },
  { slot: 11, name: 'Spider-Noir', perClick: 5 * K, cost: 850 * K, color: '#d8d8d8' },
  { slot: 12, name: 'Future Foundation', perClick: 12.5 * K, cost: 1.8 * M, color: '#ffffff' },
  { slot: 13, name: 'Superior Spider', perClick: 25 * K, cost: 5 * M, color: '#ff2e2e' },
  { slot: 14, name: 'Spider-Armor MK IV', perClick: 45 * K, cost: 25 * M, color: '#9ad8ff' },
  { slot: 15, name: 'Cosmic Spider', perClick: 90 * K, cost: 150 * M, color: '#b88aff' },
  { slot: 16, name: 'Anti-Venom', perClick: 150 * K, cost: 500 * M, color: '#f0f4ff' },
  { slot: 17, name: 'Captain Universe', perClick: 400 * K, cost: 1 * B, color: '#8af0ff' },
  { slot: 18, name: 'Spider-King', perClick: 1.25 * M, cost: 5 * B, color: '#ffd23a' },
  { slot: 19, name: 'Infinity Spider', perClick: 3 * M, cost: 40 * B, color: '#ff9af0' },
];

export const SUIT_COUNT = SUITS.length;

/** Every suit bit, for sanitising a stored mask. Slot 1 is bit 0. */
export const ALL_SUIT_BITS = (2 ** SUIT_COUNT - 1) >>> 0;

/** The Classic Suit is always owned. */
export const STARTER_SUIT_BITS = 1;

export const suitBySlot = (slot: number): SuitTier | undefined => SUITS[Math.floor(slot) - 1];

export const ownsSuit = (owned: number, slot: number): boolean =>
  slot >= 1 && slot <= SUIT_COUNT && (((owned | STARTER_SUIT_BITS) >>> (slot - 1)) & 1) === 1;

/** Base per-click of the worn suit; an unowned or unknown slot falls back to the Classic Suit. */
export const suitPerClickOf = (slot: number, owned: number): number => {
  const tier = suitBySlot(slot);
  if (!tier || !ownsSuit(owned, slot)) return SUITS[0]!.perClick;
  return tier.perClick;
};
