import { AVATAR_SLOT, SPAWN, STARTER_SUIT_BITS, canRebirth, maxSwingsFor, rebirthHealth, rebirthMultiplier, rebirthRequiredLevel } from '@spider/shared';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import type { ProgressionService } from './ProgressionService.js';

export type RebirthResult =
  | {
      readonly ok: true;
      readonly rebirths: number;
      readonly multiplier: number;
      readonly health: number;
      readonly swings: number;
      readonly nextLevel: number;
    }
  | { readonly ok: false; readonly reason: 'not-eligible' | 'away' };

/**
 * Server authority over rebirths.
 *
 * Eligibility is the server's own level (Level 8 for the first, 12 for the
 * next). A rebirth RESETS Web Power, XP, Wins and suits (the Classic Suit is
 * worn again) for a permanently higher XP multiplier and health, and keeps
 * rebirths, pets, gear, web shooters and the stage record. Taken only in the
 * plaza (not mid-stage), so no run is ever half-reset. The client sends an
 * empty message.
 */
export class RebirthService {
  rebirth(player: PlayerState, progression: ProgressionService): RebirthResult {
    if (!canRebirth(player.level, player.rebirths)) return { ok: false, reason: 'not-eligible' };
    if (player.z > 44 || Math.abs(player.x - SPAWN.x) > 130) return { ok: false, reason: 'away' };
    player.rebirths += 1;
    player.xp = 0;
    player.webPower = 0;
    player.wins = 0;
    // Back to the player's own avatar; the Classic Suit is claimed again on its pad.
    player.ownedSuits = STARTER_SUIT_BITS;
    player.suitSlot = AVATAR_SLOT;
    progression.syncDerived(player);
    progression.heal(player);
    return {
      ok: true,
      rebirths: player.rebirths,
      multiplier: rebirthMultiplier(player.rebirths),
      health: rebirthHealth(player.rebirths),
      swings: maxSwingsFor(player.rebirths),
      nextLevel: rebirthRequiredLevel(player.rebirths),
    };
  }
}
