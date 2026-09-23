import {
  COMBAT,
  WEB_HAND_HEIGHT,
  WorldCollision,
  copyMotion,
  createMotion,
  createSimEvents,
  createSimParams,
  horizontalSpeed,
  resetMotion,
  stepPlayer,
  type MoveMessage,
  type MovementInput,
  type PlayerMotion,
  type SimParams,
} from '@spider/shared';
import { Vector3 } from 'three';
import { createAnimationInput, type AnimationInput } from '../animation/AnimationInput.js';
import { ATTACKS } from '../config/animationConfig.js';
import type { BodyLook } from '../suits/SuitBody.js';
import type { InputState } from '../input/InputState.js';
import { NamePlate } from './NamePlate.js';
import { PlayerCharacter } from './PlayerCharacter.js';

const MAX_PENDING_INPUTS = 240;
const FIXED_DT = 1 / 60;
const MAX_STEPS_PER_FRAME = 5;
const SNAP_DISTANCE = 5;
const CORRECTION_RATE = 14;
/** How long the body turns to face what it swung at. */
const FACE_SECONDS = 0.35;

const lerp = (from: number, to: number, alpha: number): number => from + (to - from) * alpha;
const EMPTY_INPUTS: MoveMessage[] = [];

export type PlacementKind = 'none' | 'respawn' | 'correction';

interface PendingInput {
  seq: number;
  dt: number;
  input: MovementInput;
}

/** The authoritative fields the client reconciles against: EVERY field of `PlayerMotion`. */
export interface AuthoritativeMotion {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  velocityX: number;
  velocityY: number;
  velocityZ: number;
  grounded: boolean;
  jumpLatched: boolean;
  jumpCount: number;
  swingsLeft: number;
  swinging: boolean;
  anchorX: number;
  anchorY: number;
  anchorZ: number;
  ropeLength: number;
  swingTime: number;
  swingDirX: number;
  swingDirZ: number;
  swingCount: number;
  lastInputSeq: number;
}

/**
 * The locally controlled Spider-Man: a PREDICTION of a server-owned simulation.
 *
 * Runs the identical `stepPlayer`, keeps every input the server has not
 * acknowledged, and on each server update snaps to the authoritative state and
 * replays them. The run speed, jump and open portals come from the server's
 * replicated figures (`setParams`), never from anything local. Web SWINGS are
 * part of that simulation (a mid-air jump press), so they are predicted and
 * reconciled like any other movement.
 *
 * A web SHOT is presentation: it plays at once for feel, and the server
 * decides separately whether it landed and what it paid.
 */
export class LocalPlayer {
  readonly character: PlayerCharacter;
  readonly position = new Vector3();
  readonly velocity = new Vector3();

  private readonly previous = { x: 0, y: 0, z: 0 };
  private readonly motion: PlayerMotion = createMotion();
  private readonly events = createSimEvents();
  private readonly replayEvents = createSimEvents();
  private readonly collision: WorldCollision;
  private readonly params: SimParams = createSimParams();

  private readonly pending: PendingInput[] = [];
  private nextSeq = 1;
  private readonly outgoing: MoveMessage[] = [];
  private accumulator = 0;
  private readonly correction = new Vector3();
  private placement: PlacementKind = 'none';
  private turnSignal = 0;
  private jumpPending = false;
  private wasJumpHeld = false;
  private readonly animationInput: AnimationInput = createAnimationInput();
  private readonly plate = new NamePlate();

  private swingTime = -1;
  private swingVariant = 0;
  private drawnFor = 0;
  private faceYaw = 0;
  private faceFor = 0;

  jumpedEdge = false;
  landedEdge = false;
  swungEdge = false;

  constructor(collision: WorldCollision) {
    this.collision = collision;
    this.character = new PlayerCharacter();
    this.character.root.add(this.plate.sprite);
    this.previous.x = this.motion.x;
    this.previous.y = this.motion.y;
    this.previous.z = this.motion.z;
    this.syncFromMotion();
    this.syncCharacter();
  }

  get horizontalSpeed(): number {
    return horizontalSpeed(this.motion);
  }

  get isGrounded(): boolean {
    return this.motion.grounded;
  }

  get yaw(): number {
    return this.motion.yaw;
  }

  get maxRunSpeed(): number {
    return this.params.moveSpeed;
  }

  drainOutgoing(): MoveMessage[] {
    if (this.outgoing.length === 0) return EMPTY_INPUTS;
    const batch = this.outgoing.slice();
    this.outgoing.length = 0;
    return batch;
  }

  /** The server's movement figures: run speed, jump, open portals and swings. */
  setParams(moveSpeed: number, jumpVelocity: number, openedStage: number, maxSwings: number): void {
    if (Number.isFinite(moveSpeed) && moveSpeed > 0) this.params.moveSpeed = moveSpeed;
    if (Number.isFinite(jumpVelocity) && jumpVelocity > 0) this.params.jumpVelocity = jumpVelocity;
    this.params.openedStage = Math.max(0, Math.floor(openedStage));
    if (Number.isFinite(maxSwings)) this.params.maxSwings = Math.max(0, Math.floor(maxSwings));
  }

  setLook(look: BodyLook): void {
    this.character.setLook(look);
  }

  /** The web swing as predicted now: on a web, where it is stuck, and swings left. */
  get web(): { readonly swinging: boolean; readonly x: number; readonly y: number; readonly z: number; readonly left: number; readonly max: number } {
    const m = this.motion;
    return { swinging: m.swinging, x: m.anchorX, y: m.anchorY, z: m.anchorZ, left: m.swingsLeft, max: this.params.maxSwings };
  }

  setPets(petIds: readonly number[]): void {
    this.character.pets.setPets(petIds);
  }

  setDisplayName(displayName: string, avatarUrl: string): void {
    this.plate.set(displayName, avatarUrl, this.character.height);
  }

  /** Play one web shot now, facing `yaw` (or straight ahead when null). Returns the hand used. */
  shoot(yaw: number | null): number {
    this.swingTime = 0;
    this.swingVariant = (this.swingVariant + 1) % 2;
    this.drawnFor = COMBAT.stanceSeconds;
    if (yaw !== null) {
      this.faceYaw = yaw;
      this.faceFor = FACE_SECONDS;
    }
    return this.swingVariant;
  }

  /** True while a web shot is still playing, so a new one waits. */
  get shooting(): boolean {
    return this.swingTime >= 0 && this.swingTime < this.attackDuration * 0.72;
  }

  get attackDuration(): number {
    return ATTACKS.web.duration;
  }

  teleport(x: number, y: number, z: number, rotationY: number): void {
    resetMotion(this.motion, x, y, z, rotationY);
    this.previous.x = x;
    this.previous.y = y;
    this.previous.z = z;
    this.pending.length = 0;
    this.outgoing.length = 0;
    this.accumulator = 0;
    this.correction.set(0, 0, 0);
    this.placement = 'respawn';
    this.jumpPending = false;
    this.character.resetAnimation();
    this.syncFromMotion();
    this.syncCharacter();
  }

  reconcile(state: AuthoritativeMotion): void {
    const predictedX = this.motion.x;
    const predictedY = this.motion.y;
    const predictedZ = this.motion.z;

    const m = this.motion;
    m.x = state.x;
    m.y = state.y;
    m.z = state.z;
    m.vx = state.velocityX;
    m.vy = state.velocityY;
    m.vz = state.velocityZ;
    m.yaw = state.rotationY;
    m.grounded = state.grounded;
    m.jumpLatched = state.jumpLatched;
    m.jumpCount = state.jumpCount;
    m.swingsLeft = state.swingsLeft;
    m.swinging = state.swinging;
    m.anchorX = state.anchorX;
    m.anchorY = state.anchorY;
    m.anchorZ = state.anchorZ;
    m.ropeLength = state.ropeLength;
    m.swingTime = state.swingTime;
    m.swingDirX = state.swingDirX;
    m.swingDirZ = state.swingDirZ;
    m.swingCount = state.swingCount;

    let kept = 0;
    for (const entry of this.pending) {
      if (entry.seq <= state.lastInputSeq) continue;
      this.pending[kept] = entry;
      kept += 1;
    }
    this.pending.length = kept;
    for (const entry of this.pending) stepPlayer(m, entry.input, this.params, entry.dt, this.collision, this.replayEvents);

    const dx = predictedX - m.x;
    const dy = predictedY - m.y;
    const dz = predictedZ - m.z;
    const snapped = Math.hypot(dx, dy, dz) > SNAP_DISTANCE;
    this.correction.set(snapped ? 0 : dx, snapped ? 0 : dy, snapped ? 0 : dz);
    if (snapped) {
      this.previous.x = m.x;
      this.previous.y = m.y;
      this.previous.z = m.z;
      if (this.placement === 'none') this.placement = 'correction';
    }
    this.syncFromMotion();
    this.syncCharacter();
  }

  update(delta: number, input: Readonly<InputState>, cameraYaw: number): void {
    this.jumpedEdge = false;
    this.landedEdge = false;
    this.swungEdge = false;

    // A fresh press is remembered until a step takes it: a tap can be shorter than a fixed step.
    if (input.jump && !this.wasJumpHeld) this.jumpPending = true;
    this.wasJumpHeld = input.jump;

    this.accumulator += Math.max(0, delta);
    this.turnSignal = input.moveX;

    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      this.accumulator -= FIXED_DT;
      steps += 1;
      const movement: MovementInput = {
        moveX: input.moveX,
        moveZ: input.moveZ,
        jump: this.jumpPending || input.jump,
        cameraYaw,
      };
      this.jumpPending = false;
      const seq = this.nextSeq;
      this.nextSeq += 1;
      this.previous.x = this.motion.x;
      this.previous.y = this.motion.y;
      this.previous.z = this.motion.z;
      stepPlayer(this.motion, movement, this.params, FIXED_DT, this.collision, this.events);
      this.jumpedEdge = this.jumpedEdge || this.events.jumped;
      this.landedEdge = this.landedEdge || this.events.landed;
      this.swungEdge = this.swungEdge || this.events.swung;
      this.pending.push({ seq, dt: FIXED_DT, input: movement });
      if (this.pending.length > MAX_PENDING_INPUTS) this.pending.shift();
      this.outgoing.push({ seq, dt: FIXED_DT, moveX: movement.moveX, moveZ: movement.moveZ, jump: movement.jump, cameraYaw });
    }
    if (this.accumulator > FIXED_DT * MAX_STEPS_PER_FRAME) this.accumulator = 0;

    if (this.swingTime >= 0) {
      this.swingTime += delta;
      if (this.swingTime >= this.attackDuration) this.swingTime = -1;
    }
    this.drawnFor = Math.max(0, this.drawnFor - delta);
    this.faceFor = Math.max(0, this.faceFor - delta);

    this.decayCorrection(delta);
    this.syncFromMotion();
    this.syncCharacter();
    this.updateAnimation(delta);
    this.character.updatePets(delta);
  }

  consumePlacement(): PlacementKind {
    const kind = this.placement;
    this.placement = 'none';
    return kind;
  }

  readMotion(into: PlayerMotion): void {
    copyMotion(this.motion, into);
  }

  private decayCorrection(delta: number): void {
    if (this.correction.lengthSq() < 1e-8) {
      this.correction.set(0, 0, 0);
      return;
    }
    this.correction.multiplyScalar(Math.exp(-CORRECTION_RATE * delta));
  }

  private syncFromMotion(): void {
    const alpha = Math.min(Math.max(this.accumulator / FIXED_DT, 0), 1);
    this.position.set(
      lerp(this.previous.x, this.motion.x, alpha) + this.correction.x,
      lerp(this.previous.y, this.motion.y, alpha) + this.correction.y,
      lerp(this.previous.z, this.motion.z, alpha) + this.correction.z,
    );
    this.velocity.set(this.motion.vx, this.motion.vy, this.motion.vz);
  }

  private updateAnimation(delta: number): void {
    const a = this.animationInput;
    a.grounded = this.motion.grounded;
    a.horizontalSpeed = this.horizontalSpeed;
    a.verticalVelocity = this.motion.vy;
    a.turn = this.turnSignal;
    a.landed = this.landedEdge;
    a.swingTime = this.swingTime;
    a.swingVariant = this.swingVariant;
    a.drawn = this.drawnFor > 0;
    a.style = 'web';
    const m = this.motion;
    a.onWeb = m.swinging;
    if (m.swinging) {
      const dx = m.anchorX - m.x;
      const dy = Math.max(0.5, m.anchorY - (m.y + WEB_HAND_HEIGHT));
      const dz = m.anchorZ - m.z;
      const forward = dx * Math.sin(m.yaw) + dz * Math.cos(m.yaw);
      const left = dx * Math.cos(m.yaw) - dz * Math.sin(m.yaw);
      a.webPitch = Math.atan2(forward, dy);
      a.webRoll = -Math.atan2(left, dy);
    }
    this.character.update(delta, a);
  }

  private syncCharacter(): void {
    this.character.setPosition(this.position.x, this.position.y, this.position.z);
    // While a swing plays the body faces what it swung at; otherwise where it runs.
    this.character.root.rotation.y = this.faceFor > 0 && this.horizontalSpeed < 6 ? this.faceYaw : this.motion.yaw;
  }
}
