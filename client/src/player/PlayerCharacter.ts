import { AVATAR_SLOT, COMBAT, PLAYER_HEIGHT, neckScale } from '@spider/shared';
import { Group, Vector3, type Material, type Mesh, type Object3D } from 'three';
import type { AnimationInput } from '../animation/AnimationInput.js';
import { PlayerAnimator, type AnimationState } from '../animation/PlayerAnimator.js';
import { PlayerRig } from '../animation/rig/PlayerRig.js';
import type { AttackStyle } from '../config/animationConfig.js';
import { PLAYER_MODEL_YAW_OFFSET } from '../config/worldVisuals.js';
import { avatarBodies } from '../bloxity/AvatarBody.js';
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
 * set, or a new avatar - and every body shares its suit's material and its
 * gear's geometry.
 *
 * WITHOUT A SUIT (slot 0) a player is their own Bloxity avatar. That body comes
 * over the network, so it is two-step: the bundled body in its own texture at
 * once (with shooters and gear), then the Bloxity body swapped in when it
 * lands - unless the look moved on meanwhile. A player already in their
 * Bloxity body keeps it on screen while a changed one loads, so a new hat never
 * flashes back to the bundled body. Claiming a suit swaps straight to the
 * painted spider body; wearing the avatar again brings the Bloxity body back.
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
  private disposed = false;
  private look: BodyLook = { suit: 1, shooter: 1, gear: [] };

  constructor(look?: BodyLook) {
    this.root.add(this.fall);
    this.fall.add(this.visual);
    this.look = look ?? this.look;
    this.model = createSuitBody(this.look);
    this.key = lookKey(this.look);
    this.model.rotation.y = PLAYER_MODEL_YAW_OFFSET;
    this.visual.add(this.model);
    this.rig = new PlayerRig(this.model, this.model);
    this.animator = new PlayerAnimator(this.rig, this.visual);
    this.worldRoot.add(this.pets.root);
    this.requestAvatar();
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

  /** True while the player is their own avatar (no suit). */
  get isAvatar(): boolean {
    return this.look.suit === AVATAR_SLOT;
  }

  /** True while the body on screen is the player's Bloxity avatar (not the bundled fallback). */
  get showsBloxityBody(): boolean {
    return this.model.userData['bloxityBody'] === true;
  }

  /** Wear a look: rebuilt only when it differs from the current one. */
  setLook(look: BodyLook): void {
    const key = lookKey(look);
    if (key === this.key) return;
    this.key = key;
    this.look = look;
    // Avatar to avatar: the Bloxity body on screen stays until the changed one lands.
    const keepBloxity = look.suit === AVATAR_SLOT && this.showsBloxityBody;
    if (!keepBloxity) this.install(createSuitBody(look));
    this.requestAvatar();
  }

  /** Without a suit, fetch the player's Bloxity body and swap it in if the look is still the same. */
  private requestAvatar(): void {
    const look = this.look;
    if (look.suit !== AVATAR_SLOT || !look.avatar) return;
    const key = this.key;
    void avatarBodies.build(look.avatar, look).then((body) => {
      if (!body || this.disposed || this.key !== key) {
        if (body) disposeOwnMaterial(body);
        return;
      }
      this.install(body);
    });
  }

  /** Put a body on screen: the rig and animator follow it, and the old body's own material goes. */
  private install(model: Object3D): void {
    const old = this.model;
    old.removeFromParent();
    if (old !== model) disposeOwnMaterial(old);
    this.model = model;
    this.model.rotation.y = PLAYER_MODEL_YAW_OFFSET;
    this.visual.add(this.model);
    this.rig = new PlayerRig(this.model, this.model);
    this.rig.resetToBindPose();
    // The rig sets the neck's own head scale as it binds; an avatar's chosen head size multiplies it.
    const headScale = this.model.userData['headScale'] as number | undefined;
    if (headScale !== undefined) this.rig.getBone('Neck1')?.scale.setScalar(neckScale(headScale));
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
    this.disposed = true;
    disposeOwnMaterial(this.model);
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

/** A Bloxity body owns its material (textures and geometry are shared caches); a suit body owns nothing. */
const disposeOwnMaterial = (model: Object3D): void => {
  if (model.userData['bloxityBody'] !== true) return;
  const seen = new Set<Material>();
  model.traverse((child) => {
    const material = (child as Mesh).material as Material | undefined;
    if (material && !Array.isArray(material) && !seen.has(material) && (child as Mesh).isMesh && child.userData['suitGear'] !== true) {
      // Items on the body (hats, back items) share cached materials: only the skinned body's own goes.
      if ((child as Mesh & { isSkinnedMesh?: boolean }).isSkinnedMesh) {
        seen.add(material);
        material.dispose();
      }
    }
  });
};
