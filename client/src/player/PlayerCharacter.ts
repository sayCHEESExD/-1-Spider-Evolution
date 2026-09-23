import { COMBAT, PLAYER_HEIGHT } from '@spider/shared';
import { Group, Vector3, type Object3D } from 'three';
import type { AnimationInput } from '../animation/AnimationInput.js';
import { PlayerAnimator, type AnimationState } from '../animation/PlayerAnimator.js';
import { PlayerRig } from '../animation/rig/PlayerRig.js';
import type { AttackStyle } from '../config/animationConfig.js';
import { PLAYER_MODEL_YAW_OFFSET } from '../config/worldVisuals.js';
import { PetFollower } from '../pets/PetFollower.js';
import { createSuitBody, lookKey, webHandsOf, type BodyLook } from '../suits/SuitBody.js';

/**
 * The visual half of a player, arranged so animation can never move them.
 *
 *   root          physics transform (position + facing). Gameplay owns it.
 *     fall        the death animation's topple (identity while alive)
 *       visual    the bob, the lean along a web
 *       model     the body on screen: the suit, its shooters and its gear
 *   worldRoot     the pets, which float after the player in WORLD space
 *
 * The body is rebuilt only when the LOOK changes - a new suit, shooter or gear
 * set - and every body shares its suit's material and its gear's geometry.
 */
export class PlayerCharacter {
  readonly root = new Group();
  readonly worldRoot = new Group();
  readonly pets = new PetFollower();

  private readonly visual = new Group();
  private readonly fall = new Group();
  /** Seconds into the death animation, or -1 while alive. */
  private deathTime = -1;
  private model: Object3D;
  private animator: PlayerAnimator;
  private rig: PlayerRig;
  private key = '';
  private look: BodyLook = { suit: 1, shooter: 1, gear: [] };

  constructor(look?: BodyLook) {
    this.root.add(this.fall);
    this.fall.add(this.visual);
    this.model = createSuitBody(look ?? this.look);
    this.key = lookKey(look ?? this.look);
    this.model.rotation.y = PLAYER_MODEL_YAW_OFFSET;
    this.visual.add(this.model);
    this.rig = new PlayerRig(this.model, this.model);
    this.animator = new PlayerAnimator(this.rig, this.visual);
    this.worldRoot.add(this.pets.root);
  }

  get height(): number {
    return PLAYER_HEIGHT;
  }

  get style(): AttackStyle {
    return 'web';
  }

  get suit(): number {
    return this.look.suit;
  }

  get shooter(): number {
    return this.look.shooter;
  }

  /** Wear a look: rebuilt only when it differs from the current one. */
  setLook(look: BodyLook): void {
    const key = lookKey(look);
    if (key === this.key) return;
    this.key = key;
    this.look = look;
    this.model.removeFromParent();
    this.model = createSuitBody(look);
    this.model.rotation.y = PLAYER_MODEL_YAW_OFFSET;
    this.visual.add(this.model);
    this.rig = new PlayerRig(this.model, this.model);
    this.rig.resetToBindPose();
    this.animator.setRig(this.rig);
  }

  /** Where a web leaves the shooter, in world space: 0 the right wrist, 1 the left. */
  webHand(side: number, out: Vector3): Vector3 {
    const hand = webHandsOf(this.model)[side === 1 ? 1 : 0];
    if (!hand) return out.copy(this.root.position).setY(this.root.position.y + 2.2);
    return hand.getWorldPosition(out);
  }

  setPosition(x: number, y: number, z: number): void {
    this.root.position.set(x, y, z);
  }

  setYaw(yaw: number): void {
    this.root.rotation.y = yaw;
  }

  /**
   * The death state, straight from the server's health: true starts the death
   * animation (once), false - the respawn - stands the body back up.
   */
  setDead(dead: boolean): void {
    if (dead && this.deathTime < 0) {
      this.deathTime = 0;
    } else if (!dead && this.deathTime >= 0) {
      this.deathTime = -1;
      this.fall.rotation.set(0, 0, 0);
      this.fall.position.set(0, 0, 0);
      this.fall.scale.setScalar(1);
    }
  }

  /** True from the moment of death until the respawn. */
  get dead(): boolean {
    return this.deathTime >= 0;
  }

  /**
   * THE DEATH ANIMATION: a knock-back stagger, a topple onto the back with one
   * small bounce, a beat lying still, then the body shrinks away. Finishes
   * before the server's `COMBAT.deathSeconds`, so the respawn never cuts it.
   */
  private updateDeath(delta: number): void {
    if (this.deathTime < 0) return;
    this.deathTime += delta;
    const t = this.deathTime;
    const toppled = Math.min(1, t / TOPPLE);
    let angle = toppled * toppled * (Math.PI / 2);
    if (t > TOPPLE) {
      const k = Math.min(1, (t - TOPPLE) / BOUNCE);
      angle -= Math.sin(k * Math.PI) * 0.16;
    }
    this.fall.rotation.x = -angle;
    const back = Math.min(1, t / TOPPLE);
    this.fall.position.set(0, Math.sin(angle) * 0.35, -back * 0.6);
    const gone = Math.min(1, Math.max(0, (t - VANISH_START) / (DEATH_ANIMATION_SECONDS - VANISH_START)));
    this.fall.scale.setScalar(Math.max(0.001, 1 - gone * gone));
  }

  update(delta: number, input: AnimationInput): void {
    this.updateDeath(Math.max(0, delta));
    this.animator.update(Math.max(0, delta), input);
  }

  /** Hold the Spider-Man crouch at once (a statue on its pedestal). */
  crouchNow(): void {
    this.animator.crouchNow();
  }

  /** Advance the pets, after the body has moved. */
  updatePets(delta: number): void {
    const p = this.root.position;
    this.pets.update(delta, p.x, p.y, p.z, this.root.rotation.y);
  }

  get animationState(): AnimationState {
    return this.animator.currentState;
  }

  resetAnimation(): void {
    this.animator.reset();
    this.pets.snap();
  }

  dispose(): void {
    this.pets.dispose();
    this.root.removeFromParent();
    this.worldRoot.removeFromParent();
  }
}

/** The death animation's beats, seconds. It ends well inside the server's death state. */
const DEATH_ANIMATION_SECONDS = Math.min(1.7, COMBAT.deathSeconds - 0.25);
const TOPPLE = 0.45;
const BOUNCE = 0.25;
const VANISH_START = 1.15;
