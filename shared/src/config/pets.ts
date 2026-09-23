/**
 * PETS and the six eggs they hatch from, on the back of the plaza.
 *
 * Each egg holds four themed pets, one per rarity, at 60 / 28 / 10 / 2 %.
 * Hatching spends Wins and rolls on the SERVER; the client only asks. A pet's
 * bonus is a percentage; the equipped pets' bonuses ADD, and the pet factor of
 * the gain formula is 1 + sum / 100.
 *
 * Inventory: at most PET_INVENTORY_MAX owned and PET_EQUIP_MAX equipped.
 * Pet ids are persisted: never reuse one.
 */
export type PetRarity = 'common' | 'rare' | 'epic' | 'legendary';

/** The body a pet is built from; the client draws each with the pet's colours. */
export type PetShape = 'spider' | 'pup' | 'cat' | 'bat' | 'owl' | 'dragon' | 'bunny' | 'fox' | 'drone' | 'slime';

export interface PetKind {
  /** Stable id. Never reuse one. */
  readonly id: number;
  readonly name: string;
  readonly rarity: PetRarity;
  /** Gain bonus in percent while equipped. */
  readonly bonus: number;
  readonly shape: PetShape;
  /** Body, detail and glow colours. */
  readonly colors: readonly [number, number, number];
}

export interface EggKind {
  /** 1..6, and the pedestal order on the plaza's back row. */
  readonly id: number;
  readonly name: string;
  readonly cost: number;
  /** Shell colours: base, pattern, glow. */
  readonly colors: readonly [number, number, number];
  readonly pattern: 'venom' | 'flame' | 'swirl' | 'stars' | 'demon' | 'circuit';
  /** [petId, chance %] - the chances sum to 100. */
  readonly pool: readonly (readonly [number, number])[];
}

const K = 1_000;
const M = 1_000_000;
const B = 1_000_000_000;

export const PETS: readonly PetKind[] = [
  // Venom Egg
  { id: 1, name: 'Symbiote Pup', rarity: 'common', bonus: 10, shape: 'pup', colors: [0x1c1d26, 0xf2f2f2, 0xff3a6a] },
  { id: 2, name: 'Venom Kitty', rarity: 'rare', bonus: 25, shape: 'cat', colors: [0x16171f, 0xffffff, 0xff4a8a] },
  { id: 3, name: 'Toxin Bat', rarity: 'epic', bonus: 60, shape: 'bat', colors: [0x2a1a4a, 0xff6a2a, 0x7affc8] },
  { id: 4, name: 'Venom King', rarity: 'legendary', bonus: 150, shape: 'spider', colors: [0x0e0f16, 0xffffff, 0xff2e5a] },
  // Fire Egg
  { id: 5, name: 'Ember Spider', rarity: 'common', bonus: 40, shape: 'spider', colors: [0xff6a1c, 0xffd23a, 0xffb02a] },
  { id: 6, name: 'Flame Pup', rarity: 'rare', bonus: 100, shape: 'pup', colors: [0xe83a1c, 0xffc83a, 0xff8a1c] },
  { id: 7, name: 'Magma Slime', rarity: 'epic', bonus: 220, shape: 'slime', colors: [0x3a1a14, 0xff5a1c, 0xffb02a] },
  { id: 8, name: 'Blaze Phoenix', rarity: 'legendary', bonus: 500, shape: 'owl', colors: [0xff4a1c, 0xffe23a, 0xffa01c] },
  // Arcane Egg
  { id: 9, name: 'Rune Bunny', rarity: 'common', bonus: 120, shape: 'bunny', colors: [0x7a8aff, 0xffffff, 0x3fe0ff] },
  { id: 10, name: 'Mystic Owl', rarity: 'rare', bonus: 300, shape: 'owl', colors: [0x3a4ac8, 0xa8c8ff, 0x7affff] },
  { id: 11, name: 'Arcane Fox', rarity: 'epic', bonus: 650, shape: 'fox', colors: [0x5a3ae0, 0xe8d8ff, 0x3fe0ff] },
  { id: 12, name: 'Sorcerer Spider', rarity: 'legendary', bonus: 1_500, shape: 'spider', colors: [0x2a2a8a, 0xffd23a, 0x3fffe0] },
  // Astral Egg
  { id: 13, name: 'Comet Kitty', rarity: 'common', bonus: 350, shape: 'cat', colors: [0x2a1a5a, 0xffe8a0, 0xb88aff] },
  { id: 14, name: 'Nebula Pup', rarity: 'rare', bonus: 850, shape: 'pup', colors: [0x4a2a8a, 0xff8ad8, 0x8ad8ff] },
  { id: 15, name: 'Star Drone', rarity: 'epic', bonus: 1_800, shape: 'drone', colors: [0x1a1a3a, 0xfff4c0, 0xffd23a] },
  { id: 16, name: 'Galaxy Dragon', rarity: 'legendary', bonus: 4_000, shape: 'dragon', colors: [0x3a1a8a, 0xff8af0, 0x8af0ff] },
  // Demonic Egg
  { id: 17, name: 'Imp Bat', rarity: 'common', bonus: 900, shape: 'bat', colors: [0x6a0a14, 0x2a0a0a, 0xff3a1c] },
  { id: 18, name: 'Hellhound', rarity: 'rare', bonus: 2_200, shape: 'pup', colors: [0x2a0a0a, 0xc81e1e, 0xff5a1c] },
  { id: 19, name: 'Demon Fox', rarity: 'epic', bonus: 5_000, shape: 'fox', colors: [0x8a0a1a, 0x1a0a0a, 0xff2e2e] },
  { id: 20, name: 'Dread Dragon', rarity: 'legendary', bonus: 11_000, shape: 'dragon', colors: [0x1a0a0a, 0xc81e1e, 0xff3a1c] },
  // Cyber Egg
  { id: 21, name: 'Robo Spider', rarity: 'common', bonus: 2_500, shape: 'spider', colors: [0x2a3a4a, 0x9ad8ff, 0x3fe0ff] },
  { id: 22, name: 'Cyber Pup', rarity: 'rare', bonus: 6_000, shape: 'pup', colors: [0x3a4a5a, 0xdff6ff, 0x3fb6ff] },
  { id: 23, name: 'Byte Drone', rarity: 'epic', bonus: 13_000, shape: 'drone', colors: [0x14202e, 0x4affc8, 0x3fe0ff] },
  { id: 24, name: 'Mecha Dragon', rarity: 'legendary', bonus: 30_000, shape: 'dragon', colors: [0x2a3440, 0x8af0ff, 0x3fb6ff] },
];

/** The four chances, by rarity order. */
export const EGG_CHANCES: readonly number[] = [60, 28, 10, 2];

const pool = (first: number): readonly (readonly [number, number])[] =>
  EGG_CHANCES.map((chance, index) => [first + index, chance] as const);

export const EGGS: readonly EggKind[] = [
  { id: 1, name: 'Venom Egg', cost: 400, colors: [0x14151c, 0xf4f4f4, 0xff3a6a], pattern: 'venom', pool: pool(1) },
  { id: 2, name: 'Fire Egg', cost: 12 * K, colors: [0xe8401c, 0xffc83a, 0xff8a1c], pattern: 'flame', pool: pool(5) },
  { id: 3, name: 'Arcane Egg', cost: 225 * K, colors: [0x5a6ae8, 0x2a2a9a, 0x3fe0ff], pattern: 'swirl', pool: pool(9) },
  { id: 4, name: 'Astral Egg', cost: 6.5 * M, colors: [0x1c1440, 0x8a5aff, 0xffd23a], pattern: 'stars', pool: pool(13) },
  { id: 5, name: 'Demonic Egg', cost: 200 * M, colors: [0xa8141c, 0x2a0a0a, 0xff3a1c], pattern: 'demon', pool: pool(17) },
  { id: 6, name: 'Cyber Egg', cost: 2.5 * B, colors: [0x4a7ac8, 0x14203a, 0x3fe0ff], pattern: 'circuit', pool: pool(21) },
];

export const PET_RARITY_COLORS: Readonly<Record<PetRarity, string>> = {
  common: '#c9d3df',
  rare: '#3fa9ff',
  epic: '#b16bff',
  legendary: '#ffb21a',
};

export const PET_RARITY_ORDER: readonly PetRarity[] = ['common', 'rare', 'epic', 'legendary'];

export const PET_INVENTORY_MAX = 30;
export const PET_EQUIP_MAX = 3;
/** Most eggs one Hatch press opens. */
export const HATCH_MULTI = 3;

export const petById = (id: number): PetKind | undefined => PETS.find((pet) => pet.id === id);
export const eggById = (id: number): EggKind | undefined => EGGS.find((egg) => egg.id === Math.floor(id));

/**
 * Roll one pet from an egg, given a uniform random number in [0, 1). The
 * randomness is supplied, so the server owns it and the roll is testable.
 */
export const rollEgg = (egg: EggKind, random01: number): PetKind => {
  let at = Math.min(Math.max(random01, 0), 0.999999) * 100;
  for (const [petId, chance] of egg.pool) {
    if (at < chance) return petById(petId) as PetKind;
    at -= chance;
  }
  return petById(egg.pool[0]![0]) as PetKind;
};

/** The pet factor of the gain formula, from the EQUIPPED pets' ids. */
export const petMultiplier = (equippedPetIds: readonly number[]): number => {
  let sum = 0;
  for (const id of equippedPetIds.slice(0, PET_EQUIP_MAX)) sum += petById(id)?.bonus ?? 0;
  return 1 + sum / 100;
};
