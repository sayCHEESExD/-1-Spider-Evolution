/**
 * THE TRAINING DISTRICT: six miniature New York buildings, left of the spawn.
 *
 * Each building is a web-training target with a MULTIPLIER and a REBIRTH
 * requirement. Standing on its pad webs it continuously; a web that lands on
 * it pays `gain per click x multiplier`. The requirement is enforced by the
 * SERVER on every web, against its own rebirth count: a locked building pays
 * nothing extra.
 */
export interface TrainingTier {
  /** 0-based tier, and the building's index. */
  readonly tier: number;
  readonly name: string;
  readonly multiplier: number;
  readonly rebirthsRequired: number;
  /** Facade colour, and the pad / label accent. */
  readonly color: string;
  readonly accent: string;
  /** Drawn height of the miniature, world units. */
  readonly height: number;
}

export const TRAINING_TIERS: readonly TrainingTier[] = [
  { tier: 0, name: 'Queens Tower', multiplier: 1, rebirthsRequired: 0, color: '#8ed2ff', accent: '#ffffff', height: 11 },
  { tier: 1, name: 'Daily Bugle', multiplier: 2, rebirthsRequired: 1, color: '#f0a24a', accent: '#ff4a4a', height: 12 },
  { tier: 2, name: 'Midtown Spire', multiplier: 5, rebirthsRequired: 3, color: '#4a86e8', accent: '#ffd23a', height: 15 },
  { tier: 3, name: 'Oscorp Tower', multiplier: 10, rebirthsRequired: 5, color: '#2a3a34', accent: '#3dff6e', height: 16 },
  { tier: 4, name: 'Alchemax HQ', multiplier: 50, rebirthsRequired: 15, color: '#26262e', accent: '#ffc83a', height: 15 },
  { tier: 5, name: 'Lady Liberty', multiplier: 100, rebirthsRequired: 45, color: '#5fb89a', accent: '#aaffdd', height: 16 },
];

export const trainingTier = (tier: number): TrainingTier | undefined => TRAINING_TIERS[Math.floor(tier)];

export const canTrainOn = (tier: number, rebirths: number): boolean => {
  const t = trainingTier(tier);
  return !!t && Math.floor(rebirths) >= t.rebirthsRequired;
};

/** The multiplier a building pays, or 0 when the player lacks the rebirths. */
export const trainingMultiplier = (tier: number, rebirths: number): number => {
  const t = trainingTier(tier);
  if (!t || Math.floor(rebirths) < t.rebirthsRequired) return 0;
  return t.multiplier;
};
