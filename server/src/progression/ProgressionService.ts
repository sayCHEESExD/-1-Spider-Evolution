import {
  COMBAT,
  JUMP_VELOCITY,
  MAX_STAT,
  RUN_STRIDE,
  clickMultiplierOf,
  damageAfterDefense,
  describeGain,
  gainOnBuilding,
  gainPerClick,
  gearTotals,
  levelForXp,
  maxHealthFor,
  maxSwingsFor,
  moveSpeedFor,
  runXpPerStride,
  type GainInputs,
  type GearPiece,
  type GearTotals,
} from '@spider/shared';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import { logger } from '../util/logger.js';

const SCOPE = 'progression';

interface Tracker {
  /** Seconds since this player last took damage. */
  sinceHurt: number;
  /** Grounded distance run toward the next stride's XP. */
  stride: number;
  loggedGain: number;
}

/** The equipped pets' kinds, in inventory order. */
export const equippedPetIds = (player: PlayerState): number[] => {
  const ids: number[] = [];
  for (const pet of player.pets) if (pet.equipped) ids.push(pet.petId);
  return ids;
};

/** The equipped gear pieces, in inventory order. */
export const equippedGear = (player: PlayerState): GearPiece[] => {
  const pieces: GearPiece[] = [];
  for (const piece of player.gear) if (piece.equipped) pieces.push({ gearId: piece.gearId, rarity: piece.rarity });
  return pieces;
};

export const gearTotalsOf = (player: PlayerState): GearTotals => gearTotals(equippedGear(player));

export const gainInputsOf = (player: PlayerState): GainInputs => ({
  suitSlot: player.suitSlot,
  ownedSuits: player.ownedSuits,
  shooterId: player.shooterId,
  ownedShooters: player.ownedShooters,
  rebirths: player.rebirths,
  equippedPetIds: equippedPetIds(player),
  gearPower: gearTotalsOf(player).power,
});

/**
 * Server authority over Web Power, XP, levels, health and every DERIVED stat.
 *
 * THE ONE PLACE WEB POWER AND XP ARE GRANTED:
 *
 *   - `creditClick`: a web the combat service accepted (rate limited, and
 *     validated against its target if it named one) pays the gain formula to
 *     BOTH Web Power and XP - times the building's multiplier on a building;
 *   - `creditRun`: grounded distance the SERVER simulated pays running XP,
 *     one stride at a time. XP only, never Web Power.
 *
 * `syncDerived` is the one place the level-, suit-, pet-, gear- and
 * rebirth-derived figures are written. Every service that changes an input
 * calls it afterwards.
 */
export class ProgressionService {
  private readonly trackers = new Map<string, Tracker>();

  initialise(player: PlayerState): void {
    this.trackers.set(player.sessionId, { sinceHurt: 99, stride: 0, loggedGain: -1 });
    this.syncDerived(player);
    player.health = player.maxHealth;
  }

  forget(sessionId: string): void {
    this.trackers.delete(sessionId);
  }

  /** Credit one accepted web. `trainingMult` > 0 on a training building. Returns what it paid. */
  creditClick(player: PlayerState, trainingMult: number): number {
    const inputs = gainInputsOf(player);
    const gain = trainingMult > 0 ? gainOnBuilding(inputs, trainingMult) : gainPerClick(inputs);
    const before = player.webPower;
    player.webPower = Math.min(MAX_STAT, before + gain);
    if (player.webPower > player.bestWebPower) player.bestWebPower = player.webPower;
    const paid = player.webPower - before;
    this.addXp(player, paid);
    return paid;
  }

  /** Credit grounded running the server simulated: XP per completed stride. */
  creditRun(player: PlayerState, distance: number): void {
    const tracker = this.trackers.get(player.sessionId);
    if (!tracker || !Number.isFinite(distance) || distance <= 0) return;
    tracker.stride += Math.min(distance, 5);
    if (tracker.stride < RUN_STRIDE) return;
    const strides = Math.floor(tracker.stride / RUN_STRIDE);
    tracker.stride -= strides * RUN_STRIDE;
    this.addXp(player, strides * runXpPerStride(gainInputsOf(player)));
  }

  private addXp(player: PlayerState, amount: number): void {
    if (!(amount > 0)) return;
    player.xp = Math.min(MAX_STAT, player.xp + amount);
    const level = levelForXp(player.xp).level;
    // A new level runs faster: re-derive.
    if (level !== player.level) this.syncDerived(player);
  }

  /** Take an enemy's blow, less the gear's defense. Returns true when the player was defeated by it. */
  hurt(player: PlayerState, rawDamage: number): boolean {
    if (!Number.isFinite(rawDamage) || rawDamage <= 0 || player.health <= 0) return false;
    player.health = Math.max(0, player.health - damageAfterDefense(rawDamage, player.defense));
    const tracker = this.trackers.get(player.sessionId);
    if (tracker) tracker.sinceHurt = 0;
    return player.health <= 0;
  }

  /** Restore full health (a respawn). */
  heal(player: PlayerState): void {
    player.health = player.maxHealth;
  }

  /** Regenerate health a little while nothing is hurting the player. */
  tick(delta: number, player: PlayerState): void {
    const tracker = this.trackers.get(player.sessionId);
    if (!tracker) return;
    tracker.sinceHurt += delta;
    if (tracker.sinceHurt < COMBAT.regenDelay || player.health >= player.maxHealth || player.health <= 0) return;
    player.health = Math.min(player.maxHealth, player.health + player.maxHealth * COMBAT.regenRate * delta);
  }

  /**
   * Re-derive every figure that follows from the player's own server state.
   * THE ONLY WRITER of level, gain, multiplier, speed, swings, max health and
   * defense. Health keeps its fraction as the cap moves.
   */
  syncDerived(player: PlayerState): void {
    const inputs = gainInputsOf(player);
    const gear = gearTotalsOf(player);
    const level = levelForXp(player.xp).level;
    if (player.level !== level) player.level = level;
    player.gainPerClick = gainPerClick(inputs);
    player.multiplier = clickMultiplierOf(inputs);
    player.moveSpeed = moveSpeedFor(level, gear.speed);
    player.jumpVelocity = JUMP_VELOCITY;
    player.maxSwings = maxSwingsFor(player.rebirths);
    player.defense = gear.defense;
    const max = maxHealthFor(player.rebirths, gear.health);
    if (max !== player.maxHealth) {
      const fraction = player.maxHealth > 0 ? player.health / player.maxHealth : 1;
      player.maxHealth = max;
      player.health = player.health <= 0 ? 0 : Math.min(max, Math.max(1, Math.round(max * fraction)));
    }

    const tracker = this.trackers.get(player.sessionId);
    if (tracker && tracker.loggedGain !== player.gainPerClick) {
      tracker.loggedGain = player.gainPerClick;
      logger.info(SCOPE, `${player.sessionId} L${player.level} gain/click: ${describeGain(inputs)}`);
    }
  }
}
