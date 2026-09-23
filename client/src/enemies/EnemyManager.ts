import { ENEMIES, PLAYER_HEIGHT, arenaStartZ, stageByIndex, type EnemyDef } from '@spider/shared';
import {
  AdditiveBlending,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  type Material,
  type Scene,
} from 'three';
import { createAnimationInput, type AnimationInput } from '../animation/AnimationInput.js';
import { PlayerAnimator } from '../animation/PlayerAnimator.js';
import { attachToMount, measureMounts } from '../animation/rig/BoneMounts.js';
import { PlayerRig } from '../animation/rig/PlayerRig.js';
import { ATTACKS } from '../config/animationConfig.js';
import type { NetEnemyState } from '../net/netTypes.js';
import { playerModelLoader } from '../player/PlayerModelLoader.js';
import { paintSuit } from '../suits/SuitPainter.js';
import { PartBuilder } from '../render/PartBuilder.js';
import { worldTextures } from '../world/WorldTextures.js';
import { ENEMY_LOOKS } from './EnemyLooks.js';
import { recoloredAtlas } from './EnemyTextures.js';

/** Stages within this distance (along the road) have their enemies built. */
const BUILD_DISTANCE = 150;
const FOLLOW_RATE = 12;
const DEATH_SECONDS = 0.6;
const FLINCH_SECONDS = 0.18;

const shortestAngle = (from: number, to: number): number => {
  let diff = to - from;
  diff -= Math.round(diff / (Math.PI * 2)) * Math.PI * 2;
  return diff;
};

/** One enemy on screen: a player rig in its look, driven by replicated state. */
class EnemyVisual {
  readonly root = new Group();
  private readonly visual = new Group();
  private readonly animator: PlayerAnimator;
  private readonly input: AnimationInput = createAnimationInput();
  private readonly materials: MeshStandardMaterial[] = [];
  private readonly accessories: Group[] = [];
  private readonly seal: Mesh | null = null;
  private readonly sealRing: Mesh | null = null;
  private lastHits = -1;
  private lastSwings = -1;
  private swingTime = -1;
  private swingVariant = 0;
  private flinch = 0;
  private deathTime = -1;
  private alive = true;
  private placed = false;
  private targetX = 0;
  private targetZ = 0;
  private targetYaw = 0;
  private moving = false;

  constructor(readonly def: EnemyDef) {
    const look = ENEMY_LOOKS[def.look];
    const model = playerModelLoader.createInstance();
    const atlas = playerModelLoader.atlasImage;
    // A villain is painted like a suit; a henchman is the atlas in its palette.
    const map = look.paint ? paintSuit(`enemy-${def.look}`, model, look.paint) : atlas ? recoloredAtlas(atlas, look.palette) : null;
    model.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const material = new MeshStandardMaterial({ map, roughness: 0.85, metalness: 0 });
      this.materials.push(material);
      mesh.material = material;
    });
    this.root.add(this.visual);
    this.visual.add(model);
    const rig = new PlayerRig(model, model);
    this.animator = new PlayerAnimator(rig, this.visual);

    // Accessories go on in the bind pose, root at the origin, before scaling.
    rig.resetToBindPose();
    this.root.updateMatrixWorld(true);
    const mounts = measureMounts(rig, this.root);
    const wear = (make: ((b: PartBuilder, size: number) => void) | undefined, mount: typeof mounts.head): void => {
      if (!make || !mount) return;
      const builder = new PartBuilder();
      make(builder, mounts.headSize);
      const group = builder.build(`${def.look}-gear`, true);
      attachToMount(group, mount, this.root);
      this.accessories.push(group);
    };
    wear(look.head, mounts.head);
    wear(look.hand ? (b) => look.hand!(b) : undefined, mounts.hand);
    wear(look.back ? (b) => look.back!(b) : undefined, mounts.back);
    this.animator.reset();

    this.visual.scale.setScalar(def.scale);
    // No name over the head: the enemy being fought is named, with its health, in the top-centre HUD.

    if (def.boss) {
      // The SEAL: a violet ward around a boss the local player cannot fight yet.
      this.seal = new Mesh(
        new SphereGeometry(def.radius * 1.9, 20, 14),
        new MeshBasicMaterial({ color: 0xb16bff, transparent: true, opacity: 0.22, blending: AdditiveBlending, depthWrite: false }),
      );
      this.seal.position.y = PLAYER_HEIGHT * def.scale * 0.5;
      this.sealRing = new Mesh(
        new PlaneGeometry(def.radius * 5, def.radius * 5),
        new MeshBasicMaterial({ map: worldTextures.runeCircle('#d9a6ff'), transparent: true, depthWrite: false, blending: AdditiveBlending }),
      );
      this.sealRing.rotation.x = -Math.PI / 2;
      this.sealRing.position.y = 0.08;
      this.root.add(this.seal, this.sealRing);
    }
  }

  /**
   * Out of this run: hidden, and primed so the next state it is given - a
   * fresh wave's enemy - snaps to its post with no flinch or fall carried over.
   */
  vanish(): void {
    this.root.visible = false;
    this.alive = false;
    this.deathTime = -1;
    this.lastHits = -1;
    this.lastSwings = -1;
    this.swingTime = -1;
  }

  /** Show a replicated state. Returns true on the one frame this enemy is seen to die. */
  apply(state: NetEnemyState, sealed: boolean): boolean {
    const died = this.alive && !state.alive;
    this.targetX = state.x;
    this.targetZ = state.z;
    this.targetYaw = state.yaw;
    this.moving = state.moving;
    if (this.lastHits >= 0 && state.hits !== this.lastHits) this.flinch = FLINCH_SECONDS;
    this.lastHits = state.hits;
    if (this.lastSwings >= 0 && state.swings !== this.lastSwings) {
      this.swingTime = 0;
      this.swingVariant = (this.swingVariant + 1) % 2;
    }
    this.lastSwings = state.swings;
    if (this.alive && !state.alive) this.deathTime = 0;
    if (!this.alive && state.alive) {
      this.deathTime = -1;
      this.placed = false;
      this.visual.rotation.set(0, 0, 0);
      this.visual.position.set(0, 0, 0);
    }
    this.alive = state.alive;
    if (this.seal && this.sealRing) {
      this.seal.visible = sealed && state.alive;
      this.sealRing.visible = sealed && state.alive;
    }
    return died;
  }

  update(dt: number): void {
    const p = this.root.position;
    if (!this.placed) {
      p.set(this.targetX, 0, this.targetZ);
      this.root.rotation.y = this.targetYaw;
      this.placed = true;
    } else {
      const alpha = 1 - Math.exp(-FOLLOW_RATE * dt);
      p.x += (this.targetX - p.x) * alpha;
      p.z += (this.targetZ - p.z) * alpha;
      this.root.rotation.y += shortestAngle(this.root.rotation.y, this.targetYaw) * alpha;
    }

    if (this.deathTime >= 0) {
      this.deathTime += dt;
      const t = Math.min(1, this.deathTime / DEATH_SECONDS);
      this.root.visible = this.deathTime < DEATH_SECONDS + 0.5;
      // Topple backward, then sink.
      this.visual.rotation.x = -t * t * 1.45;
      this.visual.position.y = -Math.max(0, this.deathTime - DEATH_SECONDS) * 3;
      return;
    }
    this.root.visible = true;

    if (this.swingTime >= 0) {
      this.swingTime += dt;
      if (this.swingTime >= ATTACKS.enemy.duration * 1.4) this.swingTime = -1;
    }
    const input = this.input;
    input.grounded = true;
    input.horizontalSpeed = this.moving ? this.def.speed : 0;
    input.swingTime = this.swingTime >= 0 ? this.swingTime / 1.4 : -1;
    input.swingVariant = this.swingVariant;
    input.drawn = true;
    input.style = 'enemy';
    this.animator.update(dt, input);

    if (this.flinch > 0) {
      this.flinch = Math.max(0, this.flinch - dt);
      const k = this.flinch / FLINCH_SECONDS;
      const punch = 1 + 0.12 * k;
      this.visual.scale.set(this.def.scale * punch, this.def.scale * (1 - 0.06 * k), this.def.scale * punch);
      for (const material of this.materials) material.emissive.setScalar(0.9 * k);
    } else {
      this.visual.scale.setScalar(this.def.scale);
    }
    if (this.sealRing?.visible) this.sealRing.rotation.z += dt * 0.6;
  }

  dispose(): void {
    for (const material of this.materials) material.dispose();
    for (const group of this.accessories) {
      group.traverse((child) => {
        const mesh = child as Mesh;
        if (mesh.isMesh) mesh.geometry.dispose();
      });
    }
    if (this.seal) {
      this.seal.geometry.dispose();
      (this.seal.material as Material).dispose();
    }
    if (this.sealRing) {
      this.sealRing.geometry.dispose();
      (this.sealRing.material as Material).dispose();
    }
    this.root.removeFromParent();
  }
}

/**
 * The LOCAL player's run enemies, drawn from replicated state ONLY.
 *
 * Built lazily per stage, only while the local player is near that stage,
 * and torn down when they leave: ten stages of enemies is sixty rigs, and a
 * player can only ever see one or two stages at a time.
 */
export class EnemyManager {
  private readonly visuals = new Map<number, EnemyVisual>();
  private readonly builtStages = new Set<number>();
  /** Which replicated state each visual last showed: a new object is a new run's enemy. */
  private readonly bound = new Map<number, NetEnemyState>();
  /** Enemies whose death has been announced: each enemy of each run exactly once. */
  private readonly announced = new WeakSet<NetEnemyState>();

  /** @param onDeath called once per enemy defeated in the local run (the death sound). */
  constructor(
    private readonly scene: Scene,
    private readonly onDeath: (def: EnemyDef) => void = () => undefined,
  ) {}

  /** How many enemies are alive right now in a stage, from replicated state. */
  static aliveIn(stage: number, enemies: ArrayLike<NetEnemyState> | null): number {
    let alive = 0;
    for (const def of stageByIndex(stage)?.enemies ?? []) if (enemies?.[def.id]?.alive) alive += 1;
    return alive;
  }

  /** The on-screen position of an enemy, if it is built. */
  positionOf(id: number): { x: number; z: number } | null {
    const visual = this.visuals.get(id);
    return visual ? { x: visual.root.position.x, z: visual.root.position.z } : null;
  }

  update(
    dt: number,
    enemies: ArrayLike<NetEnemyState> | null,
    localZ: number,
    killMasks: ArrayLike<number> | null,
  ): void {
    this.cull(localZ);
    for (const [id, visual] of this.visuals) {
      const state = enemies?.[id];
      // Every player fights their own run: an enemy not in the local run is not drawn.
      if (state !== this.bound.get(id)) {
        visual.vanish();
        if (state) this.bound.set(id, state);
        else this.bound.delete(id);
      }
      if (!state) continue;
      const stage = stageByIndex(visual.def.stage);
      const mask = killMasks?.[visual.def.stage - 1] ?? 0;
      const sealed = visual.def.boss && !!stage && (mask & stage.waveMask) !== stage.waveMask;
      if (visual.apply(state, sealed) && !this.announced.has(state)) {
        this.announced.add(state);
        this.onDeath(visual.def);
      }
      visual.update(dt);
    }
  }

  private cull(localZ: number): void {
    const stages = new Set<number>();
    for (const def of ENEMIES) stages.add(def.stage);
    for (const stage of stages) {
      const centre = arenaStartZ(stage) + 48;
      const near = Math.abs(localZ - centre) < BUILD_DISTANCE;
      if (near && !this.builtStages.has(stage)) {
        this.builtStages.add(stage);
        for (const def of ENEMIES) {
          if (def.stage !== stage) continue;
          const visual = new EnemyVisual(def);
          // Hidden until the local run fields it.
          visual.vanish();
          this.visuals.set(def.id, visual);
          this.scene.add(visual.root);
        }
      } else if (!near && this.builtStages.has(stage) && Math.abs(localZ - centre) > BUILD_DISTANCE + 40) {
        this.builtStages.delete(stage);
        for (const def of ENEMIES) {
          if (def.stage !== stage) continue;
          this.visuals.get(def.id)?.dispose();
          this.visuals.delete(def.id);
          this.bound.delete(def.id);
        }
      }
    }
  }

  dispose(): void {
    for (const visual of this.visuals.values()) visual.dispose();
    this.visuals.clear();
    this.builtStages.clear();
  }
}
