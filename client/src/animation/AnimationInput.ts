import type { AttackStyle } from '../config/animationConfig.js';

/**
 * The gameplay signals the animator consumes each frame. It reads these and
 * never writes back. The local player fills it from its prediction and every
 * remote from replicated state, so both run the exact same animation code.
 */
export interface AnimationInput {
  grounded: boolean;
  /** Horizontal speed in world units per second. */
  horizontalSpeed: number;
  verticalVelocity: number;
  /** -1..1 steering, for the lean. */
  turn: number;
  landed: boolean;
  /** Seconds since the current web shot began, or -1 when not shooting. */
  swingTime: number;
  /** Which hand shoots (alternates). */
  swingVariant: number;
  /** True while the shooting stance holds (just after a web). */
  drawn: boolean;
  /** Which attack plays: a web shot, or an enemy's swipe. */
  style: AttackStyle;
  /** True while hanging from a web. */
  onWeb: boolean;
  /** The web's lean from vertical in the body's own frame: forward (+) and to the side (+ = left). */
  webPitch: number;
  webRoll: number;
}

export const createAnimationInput = (): AnimationInput => ({
  grounded: true,
  horizontalSpeed: 0,
  verticalVelocity: 0,
  turn: 0,
  landed: false,
  swingTime: -1,
  swingVariant: 0,
  drawn: false,
  style: 'web',
  onWeb: false,
  webPitch: 0,
  webRoll: 0,
});
