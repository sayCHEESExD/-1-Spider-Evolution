import { COMBAT, WEB_HAND_HEIGHT } from '@spider/shared';
import { createAnimationInput, type AnimationInput } from '../animation/AnimationInput.js';
import { ATTACKS } from '../config/animationConfig.js';
import type { NetPlayerState } from '../net/netTypes.js';
import { lookOf } from './look.js';
import { NamePlate } from './NamePlate.js';
import { PlayerCharacter } from './PlayerCharacter.js';

const FOLLOW_RATE = 14;
const SNAP_DISTANCE = 14;
const FACE_SECONDS = 0.35;

const shortestAngle = (from: number, to: number): number => {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
};

/**
 * Another player's Spider-Man, rendered from replicated state ONLY.
 *
 * The transform is smoothed toward the replicated one. Web shots are derived
 * from the replicated `attackCount`: every increase is one shot to play,
 * toward the replicated `attack` point - a difference against the count first
 * seen, never a replay of somebody's whole session. Web swings are the
 * replicated anchor, drawn as a strand while `swinging`.
 */
export class RemotePlayer {
  readonly character: PlayerCharacter;

  private readonly plate = new NamePlate();
  private targetX = 0;
  private targetY = 0;
  private targetZ = 0;
  private targetYaw = 0;
  private readonly input: AnimationInput = createAnimationInput();
  private placed = false;
  private lastAttackCount = -1;
  private lastSwingCount = -1;
  private swingTime = -1;
  private swingVariant = 0;
  private drawnFor = 0;
  private faceYaw = 0;
  private faceFor = 0;
  private wasGrounded = true;
  private readonly petIds: number[] = [];
  /** Set when a new web shot arrived, until the game has drawn it. */
  attacked = false;
  /** Set when a new web swing caught, until the game has played it. */
  swung = false;
  /** Where the last web shot went. */
  readonly shotAt = { x: 0, y: 0, z: 0 };
  /** The web the player hangs from, while `onWeb`. */
  readonly anchor = { x: 0, y: 0, z: 0 };
  onWeb = false;
  shooter = 1;

  get variant(): number {
    return this.swingVariant;
  }

  get facing(): number {
    return this.faceYaw;
  }

  get position(): { readonly x: number; readonly y: number; readonly z: number } {
    return { x: this.targetX, y: this.targetY, z: this.targetZ };
  }

  constructor(state: NetPlayerState) {
    this.character = new PlayerCharacter(lookOf(state));
    this.character.root.add(this.plate.sprite);
    this.apply(state);
    this.character.setPosition(this.targetX, this.targetY, this.targetZ);
    this.character.setYaw(this.targetYaw);
    this.placed = true;
  }

  apply(state: NetPlayerState): void {
    this.targetX = state.x;
    this.targetY = state.y;
    this.targetZ = state.z;
    this.targetYaw = state.rotationY;
    this.plate.set(state.displayName, state.avatarUrl, this.character.height);

    this.input.grounded = state.grounded;
    this.input.horizontalSpeed = state.speed;
    this.input.verticalVelocity = state.verticalVelocity;
    this.character.setLook(lookOf(state));
    this.shooter = state.shooterId || 1;
    // 0 health is the server's death state: the body topples until the respawn.
    this.character.setDead(state.health <= 0);

    this.onWeb = state.swinging;
    this.anchor.x = state.anchorX;
    this.anchor.y = state.anchorY;
    this.anchor.z = state.anchorZ;
    if (this.lastSwingCount >= 0 && state.swingCount > this.lastSwingCount) this.swung = true;
    this.lastSwingCount = state.swingCount;

    this.petIds.length = 0;
    for (let i = 0; i < state.pets.length; i += 1) {
      const pet = state.pets[i];
      if (pet?.equipped) this.petIds.push(pet.petId);
    }
    this.character.pets.setPets(this.petIds);

    if (this.lastAttackCount >= 0 && state.attackCount > this.lastAttackCount) {
      this.swingTime = 0;
      this.swingVariant = (this.swingVariant + 1) % 2;
      this.drawnFor = COMBAT.stanceSeconds;
      this.shotAt.x = state.attackX;
      this.shotAt.y = state.attackY;
      this.shotAt.z = state.attackZ;
      this.faceYaw = Math.atan2(state.attackX - state.x, state.attackZ - state.z);
      this.faceFor = FACE_SECONDS;
      this.attacked = true;
    }
    this.lastAttackCount = state.attackCount;
  }

  update(delta: number): void {
    const dt = Math.max(0, delta);
    const position = this.character.root.position;
    const gap = Math.hypot(this.targetX - position.x, this.targetY - position.y, this.targetZ - position.z);
    if (!this.placed || gap > SNAP_DISTANCE) {
      position.set(this.targetX, this.targetY, this.targetZ);
      this.character.setYaw(this.targetYaw);
      this.character.pets.snap();
      this.placed = true;
    } else {
      const alpha = 1 - Math.exp(-FOLLOW_RATE * dt);
      position.x += (this.targetX - position.x) * alpha;
      position.y += (this.targetY - position.y) * alpha;
      position.z += (this.targetZ - position.z) * alpha;
      const yaw = this.character.root.rotation.y;
      const want = this.faceFor > 0 && this.input.horizontalSpeed < 6 && !this.onWeb ? this.faceYaw : this.targetYaw;
      this.character.setYaw(yaw + shortestAngle(yaw, want) * Math.min(1, alpha * 1.5));
    }

    if (this.swingTime >= 0) {
      this.swingTime += dt;
      if (this.swingTime >= ATTACKS.web.duration) this.swingTime = -1;
    }
    this.drawnFor = Math.max(0, this.drawnFor - dt);
    this.faceFor = Math.max(0, this.faceFor - dt);

    this.input.landed = this.input.grounded && !this.wasGrounded;
    this.wasGrounded = this.input.grounded;
    this.input.swingTime = this.swingTime;
    this.input.swingVariant = this.swingVariant;
    this.input.drawn = this.drawnFor > 0;
    this.input.onWeb = this.onWeb;
    if (this.onWeb) {
      const yaw = this.character.root.rotation.y;
      const dx = this.anchor.x - position.x;
      const dy = Math.max(0.5, this.anchor.y - (position.y + WEB_HAND_HEIGHT));
      const dz = this.anchor.z - position.z;
      this.input.webPitch = Math.atan2(dx * Math.sin(yaw) + dz * Math.cos(yaw), dy);
      this.input.webRoll = -Math.atan2(dx * Math.cos(yaw) - dz * Math.sin(yaw), dy);
    }
    this.character.update(dt, this.input);
    this.character.updatePets(dt);
  }

  dispose(): void {
    this.plate.dispose();
    this.character.dispose();
  }
}
