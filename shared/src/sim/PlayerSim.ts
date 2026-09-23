import { HUB, SPAWN, streetCeiling } from '../config/map.js';
import { MOVEMENT, SWING } from '../config/movement.js';
import { PLAYER_HEIGHT } from '../constants/world.js';
import { rotateTowards } from '../types/math.js';
import type { WorldCollision } from './WorldCollision.js';

/**
 * THE movement simulation, shared by the server and by client prediction.
 *
 * The server runs it to own the result and the client runs the identical
 * function to predict ahead of the network, so the two can only disagree
 * through inputs, never through maths. Run, jump and WEB-SWING - there is no
 * sprint: how fast a player runs is `SimParams.moveSpeed`, and how many
 * swings they get between landings is `SimParams.maxSwings`, both derived by
 * the server.
 *
 * THE SWING: a fresh jump press in mid-air with a swing left fires a web at an
 * anchor ahead and above (`SWING`), and the player swings on it as a
 * pendulum - gravity pulls, the web holds them at its length (the outward
 * part of the velocity is removed), and a forward pull keeps the arc going.
 * Past the anchor it lets go with a little lift. Landing refills the swings.
 */

export interface PlayerMotion {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  grounded: boolean;
  /** Edge-detect for the jump control, so a hold is one jump. */
  jumpLatched: boolean;
  /** Monotonic count of jumps, so a remote can mirror them. */
  jumpCount: number;
  /** Swings left before the next landing. */
  swingsLeft: number;
  /** True while hanging from a web. */
  swinging: boolean;
  /** Where the web is stuck. */
  anchorX: number;
  anchorY: number;
  anchorZ: number;
  /** The web's length. */
  ropeLength: number;
  /** Seconds on the current web. */
  swingTime: number;
  /** The swing's heading (unit, horizontal). */
  swingDirX: number;
  swingDirZ: number;
  /** Monotonic count of swings, so a remote can play each one. */
  swingCount: number;
}

/** One frame of player intent. Carries no position - only what was pressed. */
export interface MovementInput {
  moveX: number;
  moveZ: number;
  jump: boolean;
  cameraYaw: number;
}

/** Server-owned tuning the step reads but never changes. */
export interface SimParams {
  /** Run speed in world units per second: the Speed stat. */
  moveSpeed: number;
  /** Jump take-off velocity. */
  jumpVelocity: number;
  /** Highest stage whose forward portal is open to this player. */
  openedStage: number;
  /** Swings between two landings. */
  maxSwings: number;
}

export interface SimEvents {
  jumped: boolean;
  landed: boolean;
  /** A web caught this step. */
  swung: boolean;
  /** A web let go this step. */
  released: boolean;
}

/** Largest single step the simulation will take, in seconds. */
export const MAX_SIM_DELTA = 0.1;
/** Height above the feet the web is held at: the shooting hand. */
export const WEB_HAND_HEIGHT = 2.6;

export const createMotion = (): PlayerMotion => ({
  x: SPAWN.x,
  y: SPAWN.y,
  z: SPAWN.z,
  vx: 0,
  vy: 0,
  vz: 0,
  yaw: SPAWN.yaw,
  grounded: true,
  jumpLatched: false,
  jumpCount: 0,
  swingsLeft: 0,
  swinging: false,
  anchorX: 0,
  anchorY: 0,
  anchorZ: 0,
  ropeLength: 0,
  swingTime: 0,
  swingDirX: 0,
  swingDirZ: 1,
  swingCount: 0,
});

export const createSimEvents = (): SimEvents => ({ jumped: false, landed: false, swung: false, released: false });

export const createSimParams = (): SimParams => ({ moveSpeed: 16, jumpVelocity: 24, openedStage: 0, maxSwings: 2 });

export const copyMotion = (from: PlayerMotion, to: PlayerMotion): void => {
  to.x = from.x;
  to.y = from.y;
  to.z = from.z;
  to.vx = from.vx;
  to.vy = from.vy;
  to.vz = from.vz;
  to.yaw = from.yaw;
  to.grounded = from.grounded;
  to.jumpLatched = from.jumpLatched;
  to.jumpCount = from.jumpCount;
  to.swingsLeft = from.swingsLeft;
  to.swinging = from.swinging;
  to.anchorX = from.anchorX;
  to.anchorY = from.anchorY;
  to.anchorZ = from.anchorZ;
  to.ropeLength = from.ropeLength;
  to.swingTime = from.swingTime;
  to.swingDirX = from.swingDirX;
  to.swingDirZ = from.swingDirZ;
  to.swingCount = from.swingCount;
};

/** Reset to a placement. */
export const resetMotion = (motion: PlayerMotion, x: number, y: number, z: number, yaw: number): void => {
  motion.x = x;
  motion.y = y;
  motion.z = z;
  motion.vx = 0;
  motion.vy = 0;
  motion.vz = 0;
  motion.yaw = yaw;
  motion.grounded = true;
  motion.jumpLatched = false;
  motion.swinging = false;
  motion.swingTime = 0;
  motion.swingsLeft = 0;
};

export const horizontalSpeed = (motion: PlayerMotion): number => Math.hypot(motion.vx, motion.vz);

/** Sanitise one input before it is simulated. Applied on the SERVER. */
export const sanitiseInput = (input: Partial<MovementInput> | undefined): MovementInput => {
  const finite = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
  let moveX = finite(input?.moveX);
  let moveZ = finite(input?.moveZ);
  const magnitude = Math.hypot(moveX, moveZ);
  if (magnitude > 1) {
    moveX /= magnitude;
    moveZ /= magnitude;
  }
  return { moveX, moveZ, jump: input?.jump === true, cameraYaw: finite(input?.cameraYaw) };
};

/** The highest the head may be at `z`: under the plaza's walls, and under the street's gate walls. */
export const headCeilingAt = (z: number): number => (z > HUB.maxZ ? streetCeiling() : SWING.plazaCeiling);

const AXIS = { value: 0, y: 0, hit: false };

/** Hang the player from a web fired along (dirX, dirZ). */
const startSwing = (motion: PlayerMotion, dirX: number, dirZ: number, params: SimParams, events: SimEvents): void => {
  const handY = motion.y + WEB_HAND_HEIGHT;
  motion.anchorX = motion.x + dirX * SWING.anchorForward;
  motion.anchorZ = motion.z + dirZ * SWING.anchorForward;
  // Never anchor above the ceiling of where the web lands.
  motion.anchorY = Math.min(handY + SWING.anchorUp, headCeilingAt(motion.anchorZ) + 6);
  motion.ropeLength = Math.max(4, Math.hypot(motion.anchorX - motion.x, motion.anchorY - handY, motion.anchorZ - motion.z));
  const along = motion.vx * dirX + motion.vz * dirZ;
  const forward = Math.max(along, params.moveSpeed) + SWING.push;
  motion.vx = dirX * forward;
  motion.vz = dirZ * forward;
  motion.vy = Math.min(Math.max(motion.vy, -4), 6);
  motion.swingDirX = dirX;
  motion.swingDirZ = dirZ;
  motion.swinging = true;
  motion.swingTime = 0;
  motion.swingsLeft = Math.max(0, motion.swingsLeft - 1);
  motion.swingCount += 1;
  events.swung = true;
};

/** The web holds: take the outward part off the velocity, and pull back anything past the web's length. */
const constrainToWeb = (motion: PlayerMotion, h: number): void => {
  const rx = motion.x - motion.anchorX;
  const ry = motion.y + WEB_HAND_HEIGHT - motion.anchorY;
  const rz = motion.z - motion.anchorZ;
  const d = Math.hypot(rx, ry, rz);
  if (d < 1e-4 || d < motion.ropeLength) return;
  const nx = rx / d;
  const ny = ry / d;
  const nz = rz / d;
  const outward = motion.vx * nx + motion.vy * ny + motion.vz * nz;
  let pull = outward > 0 ? outward : 0;
  // Past the web's length: steer back onto it over a couple of substeps.
  const excess = d - motion.ropeLength;
  if (excess > 0 && h > 0) pull += (excess / h) * 0.5;
  motion.vx -= nx * pull;
  motion.vy -= ny * pull;
  motion.vz -= nz * pull;
};

const letGo = (motion: PlayerMotion, events: SimEvents, lift: boolean): void => {
  motion.swinging = false;
  motion.swingTime = 0;
  if (lift) motion.vy = Math.max(motion.vy, 0) + SWING.releaseLift;
  events.released = true;
};

/**
 * Advance one player by one step.
 *
 * @param motion    mutated in place
 * @param input     already sanitised intent
 * @param params    server-owned tuning
 * @param delta     seconds; clamped internally to [0, MAX_SIM_DELTA]
 * @param collision the world the player moves through
 * @param events    mutated in place with the edges this step produced
 */
export const stepPlayer = (
  motion: PlayerMotion,
  input: MovementInput,
  params: SimParams,
  delta: number,
  collision: WorldCollision,
  events: SimEvents,
): void => {
  events.jumped = false;
  events.landed = false;
  events.swung = false;
  events.released = false;
  const dt = Number.isFinite(delta) ? Math.min(Math.max(delta, 0), MAX_SIM_DELTA) : 0;
  if (dt === 0) return;

  const pressed = input.jump && !motion.jumpLatched;
  motion.jumpLatched = input.jump;

  // Camera-relative stick: forward is where the camera looks, right is -X at yaw 0.
  const yaw = input.cameraYaw;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const rx = -Math.cos(yaw);
  const rz = Math.sin(yaw);
  const wishX = rx * input.moveX + fx * input.moveZ;
  const wishZ = rz * input.moveX + fz * input.moveZ;
  const wishLength = Math.hypot(wishX, wishZ);
  const wishing = wishLength > 0.05;

  const speed = Math.max(0, params.moveSpeed);
  const flying = Math.hypot(motion.vx, motion.vz);

  if (motion.swinging) {
    // On the web the web drives: no stick acceleration, only the forward pull.
  } else if (!motion.grounded && flying > speed + 0.5) {
    // A fast flight (after a swing): keep the momentum, bleed it slowly, steer it a little.
    let dirX = motion.vx / flying;
    let dirZ = motion.vz / flying;
    if (wishing) {
      const current = Math.atan2(dirX, dirZ);
      const turned = rotateTowards(current, Math.atan2(wishX, wishZ), MOVEMENT.airSteer * dt);
      dirX = Math.sin(turned);
      dirZ = Math.cos(turned);
    }
    const next = Math.max(speed, flying - MOVEMENT.airDrag * dt);
    motion.vx = dirX * next;
    motion.vz = dirZ * next;
  } else {
    const targetX = wishX * speed;
    const targetZ = wishZ * speed;
    // Acceleration scales with the run speed, so a fast player is not sluggish off the mark.
    const scale = Math.max(1, speed / 16);
    const control = motion.grounded ? 1 : MOVEMENT.airControl;
    const rate = (wishing ? MOVEMENT.acceleration : MOVEMENT.deceleration) * scale * control;
    const dvx = targetX - motion.vx;
    const dvz = targetZ - motion.vz;
    const dv = Math.hypot(dvx, dvz);
    const maxChange = rate * dt;
    if (dv <= maxChange) {
      motion.vx = targetX;
      motion.vz = targetZ;
    } else {
      motion.vx += (dvx / dv) * maxChange;
      motion.vz += (dvz / dv) * maxChange;
    }
  }

  if (pressed) {
    if (motion.grounded) {
      motion.vy = params.jumpVelocity;
      motion.grounded = false;
      motion.jumpCount += 1;
      events.jumped = true;
    } else if (motion.swingsLeft > 0) {
      // A new web: let go of the old one (if any) and catch the next.
      if (motion.swinging) letGo(motion, events, false);
      const dirX = wishing ? wishX / wishLength : Math.sin(motion.yaw);
      const dirZ = wishing ? wishZ / wishLength : Math.cos(motion.yaw);
      startSwing(motion, dirX, dirZ, params, events);
    }
  }

  motion.vy = Math.max(motion.vy - MOVEMENT.gravity * dt, -MOVEMENT.terminalVelocity);

  if (motion.swinging) {
    motion.swingTime += dt;
    motion.vx += motion.swingDirX * SWING.pump * dt;
    motion.vz += motion.swingDirZ * SWING.pump * dt;
    const total = Math.hypot(motion.vx, motion.vy, motion.vz);
    if (total > SWING.maxSpeed) {
      const k = SWING.maxSpeed / total;
      motion.vx *= k;
      motion.vy *= k;
      motion.vz *= k;
    }
  }

  // Facing: along the flight while swinging or flying fast, else where the stick points.
  const along = Math.hypot(motion.vx, motion.vz);
  if (motion.swinging || (!motion.grounded && along > speed + 0.5)) {
    if (along > 1) motion.yaw = rotateTowards(motion.yaw, Math.atan2(motion.vx, motion.vz), MOVEMENT.turnSpeed * dt);
  } else if (wishing) {
    motion.yaw = rotateTowards(motion.yaw, Math.atan2(wishX, wishZ), MOVEMENT.turnSpeed * dt);
  }

  // Substep so a fast run or swing cannot tunnel a thin wall.
  const travel = Math.max(Math.abs(motion.vx), Math.abs(motion.vz), Math.abs(motion.vy)) * dt;
  const steps = Math.min(MOVEMENT.maxSubsteps, Math.max(1, Math.ceil(travel / MOVEMENT.maxSubstepDistance)));
  const h = dt / steps;
  const wasGrounded = motion.grounded;
  let grounded = false;

  for (let i = 0; i < steps; i += 1) {
    if (motion.swinging) constrainToWeb(motion, h);
    collision.moveAxis('x', motion.x, motion.y, motion.z, motion.vx * h, params.openedStage, AXIS);
    if (AXIS.hit) motion.vx = 0;
    motion.x = AXIS.value;
    motion.y = AXIS.y;
    collision.moveAxis('z', motion.x, motion.y, motion.z, motion.vz * h, params.openedStage, AXIS);
    if (AXIS.hit) motion.vz = 0;
    motion.z = AXIS.value;
    motion.y = AXIS.y;
    collision.clampToBounds(motion);

    const nextY = motion.y + motion.vy * h;
    if (motion.vy <= 0) {
      const floor = collision.floorBelow(motion.x, motion.y, motion.z, params.openedStage, 1e-3);
      // Walking down a stair tread stays on the ground rather than hopping off it.
      const snap = wasGrounded && !events.jumped && !motion.swinging && motion.y - floor <= MOVEMENT.stepHeight + 0.05;
      if (nextY <= floor || snap) {
        motion.y = floor;
        motion.vy = 0;
        grounded = true;
      } else {
        motion.y = nextY;
      }
    } else {
      const ceiling = Math.min(
        collision.ceilingAbove(motion.x, motion.y + PLAYER_HEIGHT, motion.z, params.openedStage),
        headCeilingAt(motion.z),
      );
      if (nextY + PLAYER_HEIGHT >= ceiling) {
        motion.y = Math.max(motion.y, ceiling - PLAYER_HEIGHT);
        motion.vy = 0;
      } else {
        motion.y = nextY;
      }
    }
  }

  // Standing still on a floor is still grounded, even with no fall this step.
  if (!grounded && motion.vy <= 0) {
    const floor = collision.floorBelow(motion.x, motion.y, motion.z, params.openedStage, 0.05);
    if (motion.y - floor <= 0.05) {
      motion.y = floor;
      motion.vy = 0;
      grounded = true;
    }
  }
  motion.grounded = grounded;
  if (grounded && !wasGrounded) events.landed = true;

  if (motion.swinging) {
    const ahead = (motion.x - motion.anchorX) * motion.swingDirX + (motion.z - motion.anchorZ) * motion.swingDirZ;
    if (grounded) letGo(motion, events, false);
    else if (ahead > motion.ropeLength * SWING.releaseAhead || motion.swingTime >= SWING.maxSeconds) letGo(motion, events, true);
  }
  if (grounded) motion.swingsLeft = Math.max(0, Math.floor(params.maxSwings));
};
