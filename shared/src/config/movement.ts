/**
 * Movement tuning: run, jump and WEB-SWING. There is NO sprint key - how fast
 * a player runs is their Speed stat (level and gear), nothing else.
 *
 * The client predicts with these numbers and the server simulates with them,
 * so there is exactly one copy. Per-player figures (run speed, jump, swings)
 * are `SimParams`, derived by the server.
 */
export interface MovementConfig {
  readonly acceleration: number;
  readonly deceleration: number;
  /** Fraction of ground acceleration retained in the air. */
  readonly airControl: number;
  /** Downward acceleration, world units per second squared. */
  readonly gravity: number;
  /** Turn rate toward the movement direction, radians per second. */
  readonly turnSpeed: number;
  /** Largest distance one substep may integrate. */
  readonly maxSubstepDistance: number;
  readonly maxSubsteps: number;
  /** Height the character steps up without jumping: stair treads and floor slabs. */
  readonly stepHeight: number;
  /** Fastest fall, so a long drop cannot tunnel a floor. */
  readonly terminalVelocity: number;
  /** Horizontal speed lost per second while airborne faster than the run speed. */
  readonly airDrag: number;
  /** How fast an airborne player steers a fast flight toward the stick, radians per second. */
  readonly airSteer: number;
}

export const MOVEMENT: MovementConfig = {
  acceleration: 120,
  deceleration: 110,
  airControl: 0.55,
  gravity: 70,
  turnSpeed: 12,
  maxSubstepDistance: 0.5,
  maxSubsteps: 40,
  stepHeight: 1.05,
  terminalVelocity: 90,
  airDrag: 7,
  airSteer: 2.6,
};

/**
 * THE WEB SWING. A jump pressed in mid-air, with a swing left, fires a web to
 * an anchor ahead of and above the player and swings them on it as a real
 * pendulum: gravity pulls, the web holds them at its length, and a forward
 * pull keeps the arc going. The swing lets go once the player has swung past
 * the anchor (or after `maxSeconds`) with a little lift, carrying the
 * momentum. Landing refills the swings.
 */
export const SWING = {
  /** The anchor: this far ahead, and this far above, where the web was fired. */
  anchorForward: 10,
  anchorUp: 16,
  /** Forward speed added as the web catches, on top of the run speed. */
  push: 12,
  /** Forward pull while on the web, units per second squared. */
  pump: 10,
  /** The swing lets go this far past the anchor, as a fraction of the web's length. */
  releaseAhead: 0.72,
  /** Upward speed added on letting go. */
  releaseLift: 9,
  /** Longest a single swing lasts, seconds. */
  maxSeconds: 1.5,
  /** Fastest a swing may carry a player, units per second. */
  maxSpeed: 58,
  /** Highest the head may rise above the plaza floor, and above the stage street. */
  plazaCeiling: 36,
} as const;
