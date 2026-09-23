import { rewardPadOf, stageByIndex, type StageDef } from '@spider/shared';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import { wallet } from './Wallet.js';

export interface StageAward {
  readonly granted: boolean;
  readonly stage: StageDef | null;
  readonly wins: number;
  readonly reason?: 'unknown-stage' | 'not-on-pad' | 'not-cleared' | 'cooldown';
}

/** Spam protection only: a claim empties the mask, so a second one fails anyway. */
const CLAIM_COOLDOWN_MS = 400;
const PAD_SLACK = 1.5;

/**
 * Server authority over stage rewards: the ONE place a stage pays Wins.
 *
 * A claim is validated against the stage, the position the SERVER simulated
 * (standing on that stage's reward pad), and the player's own kill mask - the
 * wave must be fully cleared since the last claim. Only then does `wallet.add`
 * run, and the mask is emptied so the next reward needs the next clear.
 */
export class StageService {
  private readonly lastClaimAt = new Map<string, number>();

  forget(sessionId: string): void {
    this.lastClaimAt.delete(sessionId);
  }

  claim(sessionId: string, player: PlayerState, stageRaw: unknown): StageAward {
    const stage = stageByIndex(Number(stageRaw));
    if (!stage) return { granted: false, stage: null, wins: 0, reason: 'unknown-stage' };

    const pad = rewardPadOf(stage.index);
    const half = pad.half + PAD_SLACK;
    if (Math.abs(player.x - pad.x) > half || Math.abs(player.z - pad.z) > half || player.y > 2) {
      return { granted: false, stage, wins: 0, reason: 'not-on-pad' };
    }
    const index = stage.index - 1;
    if ((player.killMasks[index] ?? 0) !== stage.fullMask) {
      return { granted: false, stage, wins: 0, reason: 'not-cleared' };
    }
    const now = Date.now();
    if (now - (this.lastClaimAt.get(sessionId) ?? 0) < CLAIM_COOLDOWN_MS) {
      return { granted: false, stage, wins: 0, reason: 'cooldown' };
    }

    player.killMasks[index] = 0;
    const granted = wallet.add(player, stage.reward);
    this.lastClaimAt.set(sessionId, now);
    if (stage.index > player.bestStage) player.bestStage = stage.index;
    return { granted: true, stage, wins: granted };
  }
}
