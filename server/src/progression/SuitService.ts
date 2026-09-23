import { SUIT_PADS, ownsSuit, suitBySlot, type SuitTier } from '@spider/shared';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import type { ProgressionService } from './ProgressionService.js';
import { wallet } from './Wallet.js';

export type SuitResult =
  | { readonly ok: true; readonly action: 'bought' | 'equipped'; readonly tier: SuitTier }
  | { readonly ok: false; readonly reason: 'unknown' | 'not-on-pad' | 'too-few-wins' | 'already-worn'; readonly tier?: SuitTier };

/** Slack on the pad footprint, for the latency between the client's step and the server's. */
const PAD_SLACK = 1.2;

/**
 * Server authority over the Suit Upgrades stage and the Backpack's Suits tab.
 *
 * Walking onto a pad is a REQUEST: the server checks the player stands on
 * that pad by its own simulated position. The Backpack asks the same without
 * the position. Either way the server BUYS the suit (the Wins are spent
 * through the wallet, then it is owned and worn) or, if already owned, wears
 * it. The gain per click is re-derived afterwards.
 */
export class SuitService {
  pad(player: PlayerState, slotRaw: unknown, progression: ProgressionService): SuitResult {
    const slot = Math.floor(Number(slotRaw));
    const pad = SUIT_PADS.find((entry) => entry.slot === slot);
    if (!suitBySlot(slot) || !pad) return { ok: false, reason: 'unknown' };
    const half = pad.half + PAD_SLACK;
    if (Math.abs(player.x - pad.x) > half || Math.abs(player.z - pad.z) > half || Math.abs(player.y - pad.y) > 1.5) {
      return { ok: false, reason: 'not-on-pad', tier: suitBySlot(slot) };
    }
    return this.select(player, slot, progression);
  }

  select(player: PlayerState, slotRaw: unknown, progression: ProgressionService): SuitResult {
    const slot = Math.floor(Number(slotRaw));
    const tier = suitBySlot(slot);
    if (!tier) return { ok: false, reason: 'unknown' };

    if (ownsSuit(player.ownedSuits, slot)) {
      if (player.suitSlot === slot) return { ok: false, reason: 'already-worn', tier };
      player.suitSlot = slot;
      progression.syncDerived(player);
      return { ok: true, action: 'equipped', tier };
    }

    if (!wallet.spend(player, tier.cost)) return { ok: false, reason: 'too-few-wins', tier };
    player.ownedSuits = (player.ownedSuits | (1 << (slot - 1))) >>> 0;
    player.suitSlot = slot;
    progression.syncDerived(player);
    return { ok: true, action: 'bought', tier };
  }
}
