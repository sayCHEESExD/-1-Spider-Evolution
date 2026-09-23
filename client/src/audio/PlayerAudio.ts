import type { AudioManager } from './AudioManager.js';

const MIN_AUDIBLE_SPEED = 2.5;
const STRIDE_DISTANCE = 2.6;
const MAX_STEPS_PER_SECOND = 7;

export interface PlayerAudioInput {
  readonly horizontalSpeed: number;
  readonly isGrounded: boolean;
  readonly jumpedEdge: boolean;
  readonly landedEdge: boolean;
}

/** The local player's movement sounds: footfalls per stride, the jump and the landing. */
export class PlayerAudio {
  private stride = 0;
  private sinceBeat = 0;

  constructor(private readonly audio: AudioManager) {}

  update(delta: number, player: PlayerAudioInput): void {
    if (player.jumpedEdge) this.audio.play('jump');
    if (player.landedEdge) this.audio.play('land', 0.7);

    this.sinceBeat += delta;
    if (!player.isGrounded || player.horizontalSpeed < MIN_AUDIBLE_SPEED) {
      this.stride = 0;
      return;
    }
    this.stride += player.horizontalSpeed * delta;
    if (this.stride < STRIDE_DISTANCE) return;
    this.stride = 0;
    if (this.sinceBeat < 1 / MAX_STEPS_PER_SECOND) return;
    this.sinceBeat = 0;
    this.audio.play('step', 0.5);
  }
}
