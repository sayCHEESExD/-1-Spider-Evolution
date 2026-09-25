import { AVATAR_SLOT } from '@spider/shared';
import { lookFromState } from '../bloxity/avatarLook.js';
import type { NetPlayerState } from '../net/netTypes.js';
import type { BodyLook } from '../suits/SuitBody.js';

/**
 * What a replicated player WEARS: their suit (0 = none, their own Bloxity
 * avatar, which then travels with the look), web shooter and equipped gear, in
 * inventory (uid) order so the same set always builds the same body. Local and
 * remote players both come through here, so every screen draws the same body.
 */
export const lookOf = (state: NetPlayerState): BodyLook => {
  const gear: { gearId: number; rarity: number; uid: number }[] = [];
  for (let i = 0; i < state.gear.length; i += 1) {
    const piece = state.gear[i];
    if (piece?.equipped) gear.push({ gearId: piece.gearId, rarity: piece.rarity, uid: piece.uid });
  }
  gear.sort((a, b) => a.uid - b.uid);
  const suit = Number.isFinite(state.suitSlot) ? state.suitSlot : AVATAR_SLOT;
  return {
    suit,
    shooter: state.shooterId || 1,
    gear: gear.map(({ gearId, rarity }) => ({ gearId, rarity })),
    avatar: suit === AVATAR_SLOT ? lookFromState(state.avatar) : undefined,
  };
};
