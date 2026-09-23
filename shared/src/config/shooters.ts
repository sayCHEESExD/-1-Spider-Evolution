/**
 * WEB SHOOTERS, sold at the Web Shooter stand.
 *
 * A shooter is a flat multiplier on every web click (a factor of the gain
 * formula) and sets the colour of the player's webs. The Classic Shooter is
 * owned and equipped from the start. Buying spends Wins and needs the player
 * to stand at the stand; equipping an owned one works anywhere. Both are
 * validated on the SERVER.
 *
 * Owned shooters are a bitmask keyed by id: NEVER REORDER, never reuse an id.
 */
export interface ShooterDef {
  /** 1-based, stable. Bit `id - 1` of the owned mask. */
  readonly id: number;
  readonly name: string;
  readonly multiplier: number;
  /** Wins price (0 = owned by everyone). */
  readonly cost: number;
  /** Menu / cartridge colour. */
  readonly color: string;
  /** The web strands it fires. */
  readonly web: number;
}

export const SHOOTERS: readonly ShooterDef[] = [
  { id: 1, name: 'Classic Shooter', multiplier: 1, cost: 0, color: '#3f9dff', web: 0xeaf6ff },
  { id: 2, name: 'Fire Shooter', multiplier: 1.25, cost: 500, color: '#ff8a1c', web: 0xffb14a },
  { id: 3, name: 'Classic Red Shooter', multiplier: 1.5, cost: 4_500, color: '#e0202a', web: 0xff5a5a },
];

export const SHOOTER_COUNT = SHOOTERS.length;
export const ALL_SHOOTER_BITS = (1 << SHOOTER_COUNT) - 1;
export const STARTER_SHOOTER_BITS = 1;

export const shooterById = (id: number): ShooterDef | undefined => SHOOTERS[Math.floor(id) - 1];

export const ownsShooter = (owned: number, id: number): boolean =>
  id >= 1 && id <= SHOOTER_COUNT && (((owned | STARTER_SHOOTER_BITS) >> (id - 1)) & 1) === 1;

/** The shooter factor of the gain formula; an unowned or unknown shooter counts as the Classic. */
export const shooterMultiplier = (id: number, owned: number): number => {
  const def = shooterById(id);
  if (!def || !ownsShooter(owned, id)) return 1;
  return def.multiplier;
};
