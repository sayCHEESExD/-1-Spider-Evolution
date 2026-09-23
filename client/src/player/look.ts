import type { NetPlayerState } from '../net/netTypes.js';
import type { BodyLook } from '../suits/SuitBody.js';

/**
 * What a replicated player WEARS: their suit, web shooter and equipped gear,
 * in inventory (uid) order so the same set always builds the same body.
 */
export const lookOf = (state: NetPlayerState): BodyLook => {
  const gear: { gearId: number; rarity: number; uid: number }[] = [];
  for (let i = 0; i < state.gear.length; i += 1) {
    const piece = state.gear[i];
    if (piece?.equipped) gear.push({ gearId: piece.gearId, rarity: piece.rarity, uid: piece.uid });
  }
  gear.sort((a, b) => a.uid - b.uid);
  return { suit: state.suitSlot || 1, shooter: state.shooterId || 1, gear: gear.map(({ gearId, rarity }) => ({ gearId, rarity })) };
};
