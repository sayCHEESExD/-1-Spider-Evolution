import { petMultiplier } from './pets.js';
import { rebirthHealth, rebirthMultiplier } from './rebirth.js';
import { shooterMultiplier } from './shooters.js';
import { suitPerClickOf } from './suits.js';

/**
 * THE PROGRESSION RULES, deterministic and shared, so the server, the HUD and
 * the menus always agree.
 *
 * TWO STATS GROW:
 *
 *   Web Power - earned by web clicks only. It is how hard a web hits: an
 *               enemy takes the shooter's whole Web Power as damage.
 *   XP        - earned by the same web clicks, plus a little for running.
 *               The level is read off it.
 *
 * ONE GAIN FORMULA for a web click:
 *
 *     suit per-click            (+1, +2, +5 ... +3M)
 *   x web shooter               (1x, 1.25x, 1.5x)
 *   x pets                      (1 + equipped bonuses / 100)
 *   x gear power                (1 + equipped power % / 100)
 *   x rebirth                   (1 + rebirths)
 *   x training building        (only on a building: 1x .. 100x)
 *
 * floored, at least 1. Every web the SERVER accepts pays exactly this to both
 * Web Power and XP - in mid-air, on an enemy, or on a building.
 *
 * Pinned by `verify:progression`: Level 6 needs 11.3K XP to Level 7, runs at
 * Speed 22 with 2 swings.
 */

// ------------------------------------------------------------------ levels

/**
 * LEVELS ARE UNCAPPED. XP from Level 1 to 2 is XP_BASE; every next level needs
 * XP_GROWTH times the last, for ever. There is no level table and no maximum:
 * the running totals are computed on demand and cached as far as anyone has
 * climbed.
 */
export const XP_BASE = 116;
export const XP_GROWTH = 2.5;
/**
 * Web Power and XP saturate here rather than ever becoming Infinity (they are
 * float64 on the wire). It is not a level cap: it is the largest number the
 * format holds, far past any level anyone will reach.
 */
export const MAX_STAT = Number.MAX_VALUE / 8;

/** XP needed to go from `level` to `level + 1`: 116, 290, 725, 1.81K, 4.53K, 11.3K ... */
export const xpToNext = (level: number): number => {
  const l = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
  return Math.round(XP_BASE * XP_GROWTH ** (l - 1));
};

/** Total XP on first reaching each level, cached as far as anyone has asked: [unused, 0 (L1), 116 (L2), ...]. */
const cumulative: number[] = [0, 0];

const extendTo = (level: number): void => {
  while (cumulative.length <= level && Number.isFinite(cumulative[cumulative.length - 1])) {
    const next = cumulative.length;
    cumulative.push(cumulative[next - 1]! + xpToNext(next - 1));
  }
};

/** Total XP a player holds on first reaching `level` (Infinity once past what a float64 can count). */
export const xpForLevel = (level: number): number => {
  const l = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
  extendTo(l);
  return l < cumulative.length ? cumulative[l]! : Number.POSITIVE_INFINITY;
};

export interface LevelProgress {
  readonly level: number;
  /** XP earned inside this level. */
  readonly into: number;
  /** XP this level needs in all (the bar's right-hand figure). */
  readonly need: number;
  /** 0..1 fill for the level bar. */
  readonly fraction: number;
}

/** Resolve an XP total into a level: no ceiling, the cached totals grow to fit. */
export const levelForXp = (xp: number): LevelProgress => {
  const total = Number.isFinite(xp) ? Math.max(0, xp) : 0;
  let top = 2;
  while (xpForLevel(top) <= total) top *= 2;
  let low = 1;
  let high = top;
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    if (xpForLevel(mid) <= total) low = mid;
    else high = mid - 1;
  }
  const into = total - xpForLevel(low);
  const need = xpToNext(low);
  return { level: low, into, need, fraction: need > 0 && Number.isFinite(need) ? Math.min(Math.max(into / need, 0), 1) : 0 };
};

// --------------------------------------------------------------- movement

/**
 * Run speed: 16 at Level 0 and +1 a level through SPEED_LINEAR_LEVELS (Level 6
 * runs at 22); past that it keeps rising with every level on a logarithmic
 * taper - never capped, never so fast the city blurs (about 51 at Level 100,
 * 69 at Level 800).
 */
export const BASE_SPEED = 16;
export const SPEED_PER_LEVEL = 1;
export const SPEED_LINEAR_LEVELS = 24;
export const SPEED_TAPER = 8;
export const JUMP_VELOCITY = 24;

/** The Speed stat: the level's run speed, times the equipped gear's speed bonus. */
export const moveSpeedFor = (level: number, gearSpeedPct = 0): number => {
  const l = Math.max(0, Math.floor(Number.isFinite(level) ? level : 0));
  const linear = SPEED_PER_LEVEL * Math.min(l, SPEED_LINEAR_LEVELS);
  const taper = l > SPEED_LINEAR_LEVELS ? SPEED_TAPER * Math.log(l / SPEED_LINEAR_LEVELS) : 0;
  return Math.round((BASE_SPEED + linear + taper) * (1 + Math.max(0, gearSpeedPct) / 100) * 10) / 10;
};

/** Web swings between two landings: 2 to start, one more every third rebirth, at most 6. */
export const START_SWINGS = 2;
export const REBIRTHS_PER_SWING = 3;
export const MAX_SWINGS = 6;

export const maxSwingsFor = (rebirths: number): number =>
  Math.min(MAX_SWINGS, START_SWINGS + Math.floor(Math.max(0, Math.floor(rebirths)) / REBIRTHS_PER_SWING));

// ------------------------------------------------------------------- gain

export interface GainInputs {
  readonly suitSlot: number;
  readonly ownedSuits: number;
  readonly shooterId: number;
  readonly ownedShooters: number;
  readonly rebirths: number;
  readonly equippedPetIds: readonly number[];
  /** The equipped gear's summed power percent. */
  readonly gearPower: number;
}

/** Every factor except the suit's and the building's: the HUD's "Multiplier". */
export const clickMultiplierOf = (inputs: GainInputs): number =>
  shooterMultiplier(inputs.shooterId, inputs.ownedShooters) *
  petMultiplier(inputs.equippedPetIds) *
  (1 + Math.max(0, inputs.gearPower) / 100) *
  rebirthMultiplier(inputs.rebirths);

/** Web Power and XP one web click pays, off a building. */
export const gainPerClick = (inputs: GainInputs): number =>
  Math.max(1, Math.floor(suitPerClickOf(inputs.suitSlot, inputs.ownedSuits) * clickMultiplierOf(inputs)));

/** Web Power and XP one web on a training building of `trainingMult` pays. */
export const gainOnBuilding = (inputs: GainInputs, trainingMult: number): number =>
  Math.max(1, Math.floor(suitPerClickOf(inputs.suitSlot, inputs.ownedSuits) * clickMultiplierOf(inputs) * Math.max(1, trainingMult)));

export const describeGain = (inputs: GainInputs): string =>
  `suit ${suitPerClickOf(inputs.suitSlot, inputs.ownedSuits)} x shooter ${shooterMultiplier(inputs.shooterId, inputs.ownedShooters)} ` +
  `x pets ${petMultiplier(inputs.equippedPetIds).toFixed(2)} x gear ${(1 + inputs.gearPower / 100).toFixed(2)} ` +
  `x rebirth ${rebirthMultiplier(inputs.rebirths)} = ${gainPerClick(inputs)}`;

/**
 * RUNNING XP: every RUN_STRIDE world units run on the ground pays a quarter of
 * the suit's per-click, times the rebirth multiplier (at least 1). XP only -
 * never Web Power - and far below what webbing pays.
 */
export const RUN_STRIDE = 8;

export const runXpPerStride = (inputs: GainInputs): number =>
  Math.max(1, Math.ceil((suitPerClickOf(inputs.suitSlot, inputs.ownedSuits) * rebirthMultiplier(inputs.rebirths)) / 4));

// ----------------------------------------------------------------- health

/** Max health: the rebirth's base (100, 150, 200 ...) times the gear's health bonus. */
export const maxHealthFor = (rebirths: number, gearHealthPct = 0): number =>
  Math.floor(rebirthHealth(rebirths) * (1 + Math.max(0, gearHealthPct) / 100));

/** Damage one web deals to an enemy: the player's whole Web Power. */
export const damageOfWebPower = (webPower: number): number => Math.max(1, Math.floor(Number.isFinite(webPower) ? webPower : 1));

/** Damage an enemy's blow does after the player's defense. */
export const damageAfterDefense = (damage: number, defensePct: number): number =>
  Math.max(1, Math.round(damage * (1 - Math.min(Math.max(defensePct, 0), 95) / 100)));
