/**
 * REBIRTH: an UNCAPPED prestige ladder. Every figure is computed from the
 * rebirth number alone - there is no table and no last rebirth:
 *
 *   Rebirth 0: 1x XP, 100 HP - the first rebirth needs Level 8
 *   Rebirth 1: 2x XP, 150 HP - the next needs Level 12
 *   Rebirth 2: 3x XP, 200 HP - the next needs Level 12
 *   Rebirth R: (1 + R)x XP, 100 + 50R HP; the next needs
 *              12 + floor(3 * log2(1 + (R - 2) / 6))  (13 at R4, 15 at R8,
 *              24 at R100, 34 at R1K, 64 at R1M ...)
 *
 * The requirement climbs LOGARITHMICALLY because XP per level grows
 * exponentially while the multiplier grows linearly: a requirement climbing
 * linearly would outrun the multiplier and wall the ladder off. This way the
 * next rebirth stays reachable at any rebirth number.
 *
 * The XP multiplier multiplies every web click's Web Power and XP, and running
 * XP. A rebirth RESETS Web Power, XP (the level), Wins and suits - "Resets
 * your Power, Levels, and Wins!" - and keeps rebirths, pets, gear, web
 * shooters and the stage record. Rebirths also open training buildings
 * (training.ts) and, every third, one more web swing (progression.ts).
 * Eligibility is the SERVER's own level.
 */
export const FIRST_REBIRTH_LEVEL = 8;
export const SECOND_REBIRTH_LEVEL = 12;
/** From Rebirth 2 the requirement gains LEVELS_PER_DOUBLING levels each time 1 + (R - 2) / REBIRTH_SPAN doubles. */
export const LEVELS_PER_DOUBLING = 3;
export const REBIRTH_SPAN = 6;
export const BASE_HEALTH = 100;
export const HEALTH_PER_REBIRTH = 50;

const count = (rebirths: number): number => Math.max(0, Math.floor(Number.isFinite(rebirths) ? rebirths : 0));

/** Level the NEXT rebirth needs, for a player who has `rebirths`. */
export const rebirthRequiredLevel = (rebirths: number): number => {
  const r = count(rebirths);
  if (r === 0) return FIRST_REBIRTH_LEVEL;
  if (r === 1) return SECOND_REBIRTH_LEVEL;
  return SECOND_REBIRTH_LEVEL + Math.floor(LEVELS_PER_DOUBLING * Math.log2(1 + (r - 2) / REBIRTH_SPAN));
};

/** The XP multiplier: 1x, 2x, 3x ... (1 + R)x. */
export const rebirthMultiplier = (rebirths: number): number => 1 + count(rebirths);

/** Base max health before gear: 100, 150, 200 ... 100 + 50R. */
export const rebirthHealth = (rebirths: number): number => BASE_HEALTH + HEALTH_PER_REBIRTH * count(rebirths);

export const canRebirth = (level: number, rebirths: number): boolean => Math.floor(level) >= rebirthRequiredLevel(rebirths);
