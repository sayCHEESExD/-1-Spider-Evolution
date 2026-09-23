/**
 * GEAR: random drops from defeated enemies, worn three at a time.
 *
 * Every piece has a RARITY rolled when it drops, which multiplies its base
 * stats. Stats are percentages and ADD across the equipped pieces:
 *
 *   power    - more Web Power / XP per web click
 *   speed    - faster running
 *   health   - more max health
 *   defense  - less damage taken from enemies (capped)
 *
 * Every piece is DRAWN on the character where it is worn: a mask or helmet on
 * the head, a glider, wings or arms on the back, a trophy on the chest, and
 * runes as glowing stones on the belt. The head, back and chest hold one piece
 * each; runes stack up to the equip limit. The server enforces all of it.
 *
 * Gear ids are persisted: never reuse one, never reorder the rarities.
 */
export type GearStat = 'power' | 'speed' | 'health' | 'defense';
export type GearMount = 'rune' | 'head' | 'back' | 'chest';
export type GearRarity = 0 | 1 | 2 | 3;

export interface GearDef {
  readonly id: number;
  readonly name: string;
  readonly mount: GearMount;
  /** Percent bonuses at Common rarity. */
  readonly stats: Readonly<Partial<Record<GearStat, number>>>;
  /** Main colour, for icons, runes and models. */
  readonly color: string;
  /** First stage whose enemies can drop it. */
  readonly minStage: number;
}

export const GEAR: readonly GearDef[] = [
  { id: 1, name: 'Speed Rune', mount: 'rune', stats: { speed: 5 }, color: '#3fb6ff', minStage: 1 },
  { id: 2, name: 'Health Rune', mount: 'rune', stats: { health: 10 }, color: '#4aff6a', minStage: 1 },
  { id: 3, name: 'Defense Rune', mount: 'rune', stats: { defense: 4 }, color: '#3fe0ff', minStage: 1 },
  { id: 4, name: 'Power Rune', mount: 'rune', stats: { power: 10 }, color: '#ff4ad8', minStage: 1 },
  { id: 5, name: 'Goblin Mask', mount: 'head', stats: { power: 12, health: 5 }, color: '#4fc84a', minStage: 2 },
  { id: 6, name: "Green Goblin's Glider", mount: 'back', stats: { speed: 8, power: 6 }, color: '#3a5a3a', minStage: 3 },
  { id: 7, name: 'Lizard Tail', mount: 'back', stats: { health: 14, speed: 3 }, color: '#4f9a3a', minStage: 4 },
  { id: 8, name: 'Electro Mask', mount: 'head', stats: { power: 18, speed: 4 }, color: '#ffe23a', minStage: 6 },
  { id: 9, name: 'Rhino Helmet', mount: 'head', stats: { defense: 10, health: 10 }, color: '#8a94a4', minStage: 7 },
  { id: 10, name: "Kraven's Fang Necklace", mount: 'chest', stats: { power: 10, speed: 6 }, color: '#f0e6c8', minStage: 8 },
  { id: 11, name: 'Vulture Wings', mount: 'back', stats: { speed: 14 }, color: '#5a6a4a', minStage: 9 },
  { id: 12, name: 'Mysterio Dome', mount: 'head', stats: { defense: 8, health: 12 }, color: '#bff0ff', minStage: 10 },
  { id: 13, name: 'Doc Ock Arms', mount: 'back', stats: { power: 20, defense: 4 }, color: '#8a9a6a', minStage: 12 },
  { id: 14, name: 'Symbiote Tendrils', mount: 'back', stats: { power: 28, health: 12 }, color: '#14151c', minStage: 14 },
  { id: 15, name: 'Kingpin Diamond', mount: 'chest', stats: { power: 22, defense: 6 }, color: '#e8f4ff', minStage: 16 },
];

export const GEAR_RARITY_NAMES: readonly string[] = ['Common', 'Rare', 'Epic', 'Legendary'];
export const GEAR_RARITY_COLORS: readonly string[] = ['#c9d3df', '#3fe0ff', '#c34bff', '#ffb21a'];
/** Stat multiplier per rarity. */
export const GEAR_RARITY_MULT: readonly number[] = [1, 2, 3.5, 6];

export const GEAR_INVENTORY_MAX = 30;
export const GEAR_EQUIP_MAX = 3;
/** Total defense can never pass this, whatever is worn. */
export const DEFENSE_CAP = 75;

/** Chance (0..1) that a defeated wave enemy drops a piece. Bosses always drop one. */
export const GEAR_DROP_CHANCE = 0.2;

export const gearById = (id: number): GearDef | undefined => GEAR.find((gear) => gear.id === Math.floor(id));

export const clampRarity = (value: number): GearRarity => Math.max(0, Math.min(3, Math.floor(Number.isFinite(value) ? value : 0))) as GearRarity;

/** One stat of one piece at a rarity. */
export const gearStat = (id: number, rarity: number, stat: GearStat): number => {
  const def = gearById(id);
  const base = def?.stats[stat] ?? 0;
  return base * (GEAR_RARITY_MULT[clampRarity(rarity)] ?? 1);
};

/** How good a piece is overall, for Equip Best and for sorting. */
export const gearScore = (id: number, rarity: number): number => {
  const def = gearById(id);
  if (!def) return 0;
  const m = GEAR_RARITY_MULT[clampRarity(rarity)] ?? 1;
  const s = def.stats;
  // Power is worth the most; defense points are scarcer than health points.
  return m * ((s.power ?? 0) * 1.4 + (s.speed ?? 0) + (s.health ?? 0) * 0.8 + (s.defense ?? 0) * 1.6);
};

export interface GearPiece {
  readonly gearId: number;
  readonly rarity: number;
}

export interface GearTotals {
  power: number;
  speed: number;
  health: number;
  defense: number;
}

/** The summed bonuses of the EQUIPPED pieces (the first GEAR_EQUIP_MAX only). */
export const gearTotals = (equipped: readonly GearPiece[]): GearTotals => {
  const totals: GearTotals = { power: 0, speed: 0, health: 0, defense: 0 };
  for (const piece of equipped.slice(0, GEAR_EQUIP_MAX)) {
    for (const stat of ['power', 'speed', 'health', 'defense'] as const) totals[stat] += gearStat(piece.gearId, piece.rarity, stat);
  }
  totals.defense = Math.min(DEFENSE_CAP, totals.defense);
  return totals;
};

/**
 * Whether one more piece can be worn next to the ones already equipped:
 * the equip limit, and one piece per head / back / chest.
 */
export const canWearWith = (gearId: number, equipped: readonly GearPiece[]): boolean => {
  const def = gearById(gearId);
  if (!def || equipped.length >= GEAR_EQUIP_MAX) return false;
  if (def.mount === 'rune') return true;
  return !equipped.some((piece) => gearById(piece.gearId)?.mount === def.mount);
};

/** The pieces a stage's enemies can drop. */
export const gearPoolFor = (stage: number): readonly GearDef[] => GEAR.filter((gear) => gear.minStage <= stage);

/**
 * The rarity of a drop from `stage`, from a uniform random number in [0, 1).
 * Later stages and bosses roll better; the odds are fixed and readable:
 * Legendary 2% (+0.3% a stage), Epic 10% (+0.8% a stage), Rare 28%, rest Common.
 */
export const rollGearRarity = (stage: number, boss: boolean, random01: number): GearRarity => {
  const s = Math.max(0, stage - 1);
  const legendary = Math.min(12, 2 + s * 0.3 + (boss ? 3 : 0));
  const epic = Math.min(30, 10 + s * 0.8 + (boss ? 8 : 0));
  const rare = 28;
  const at = Math.min(Math.max(random01, 0), 0.999999) * 100;
  if (at < legendary) return 3;
  if (at < legendary + epic) return 2;
  if (at < legendary + epic + rare) return 1;
  return 0;
};

/** The piece a drop is, from a uniform random number in [0, 1). */
export const rollGearKind = (stage: number, random01: number): GearDef => {
  const poolList = gearPoolFor(stage);
  const list = poolList.length > 0 ? poolList : GEAR;
  return list[Math.min(list.length - 1, Math.floor(Math.min(Math.max(random01, 0), 0.999999) * list.length))]!;
};

/** "Epic Speed Rune" and the like. */
export const gearLabel = (id: number, rarity: number): string =>
  `${GEAR_RARITY_NAMES[clampRarity(rarity)]} ${gearById(id)?.name ?? 'Gear'}`;

/** The stat line a menu shows: "+20% Speed  +10% Power". */
export const gearStatText = (id: number, rarity: number): string => {
  const def = gearById(id);
  if (!def) return '';
  const names: Record<GearStat, string> = { power: 'Power', speed: 'Speed', health: 'Health', defense: 'Defense' };
  return (Object.keys(def.stats) as GearStat[])
    .map((stat) => `+${Math.round(gearStat(id, rarity, stat) * 10) / 10}% ${names[stat]}`)
    .join('  ');
};
