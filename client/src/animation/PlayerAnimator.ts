import type { Group } from 'three';
import { AIRBORNE, ATTACKS, CROUCH, IDLE, LANDING, LOCOMOTION, TRANSITIONS, WEB_SWING } from '../config/animationConfig.js';
import type { AnimationInput } from './AnimationInput.js';
import { LocomotionCycle } from './LocomotionCycle.js';
import { PoseBuffer } from './PoseBuffer.js';
import type { PlayerRig } from './rig/PlayerRig.js';
import { BONE_INDEX, type BoneName } from './rig/boneNames.js';

/** The body's state. The web shot is a LAYER over it, not a state. */
export type AnimationState = 'idle' | 'run' | 'airborne' | 'landing' | 'web';

const clamp = (value: number, min: number, max: number): number => (value < min ? min : value > max ? max : value);
const ease = (t: number): number => t * t * (3 - 2 * t);

/** The bones the web-shot layer owns while it plays. */
const UPPER: readonly BoneName[] = ['ArmL1', 'ArmL2', 'ArmR1', 'ArmR2', 'Spine1', 'Spine2', 'Neck1'];
const LEGS: readonly BoneName[] = ['LegL1', 'LegL2', 'LegR1', 'LegR2'];
/** While on a web, the web hand stays on the strand: shots use the other arm only. */
const OFF_HAND: readonly BoneName[] = ['ArmL1', 'ArmL2', 'Spine2', 'Neck1'];

/**
 * Writes ONLY to bones (via `PlayerRig`) and to the visual node's position and
 * rotation. It never touches the physics root.
 *
 * The body runs, idles, jumps, lands and hangs from webs; the WEB-SHOT layer
 * (a shot, or the ready stance held just after one) overrides the arms and
 * torso on top of that, so a player can shoot while running or swinging.
 * Standing still long enough sinks the idle into the Spider-Man crouch.
 */
export class PlayerAnimator {
  private readonly locomotion = new LocomotionCycle();
  private readonly target = new PoseBuffer();
  private readonly from = new PoseBuffer();
  private readonly output = new PoseBuffer();
  private readonly layer = new PoseBuffer();
  private readonly layerB = new PoseBuffer();

  private state: AnimationState = 'idle';
  private stateTime = 0;
  private blendTime = 0;
  private blendDuration = 0;
  private idleTime = 0;
  /** Seconds standing still without shooting: the crouch comes after CROUCH.after. */
  private stillFor = 0;
  private crouch = 0;
  private wasGrounded = true;
  private bank = 0;
  private lean = 0;
  private webPitch = 0;
  private webRoll = 0;
  /** 0..1 weight of the ready stance, eased. */
  private guard = 0;

  constructor(
    private rig: PlayerRig,
    private readonly visual: Group,
  ) {}

  get currentState(): AnimationState {
    return this.state;
  }

  /** 0..1: how far into the Spider-Man crouch the body is. */
  get crouchWeight(): number {
    return this.crouch;
  }

  setRig(rig: PlayerRig): void {
    this.rig = rig;
  }

  reset(): void {
    this.state = 'idle';
    this.stateTime = 0;
    this.blendDuration = 0;
    this.wasGrounded = true;
    this.bank = 0;
    this.lean = 0;
    this.guard = 0;
    this.stillFor = 0;
    this.crouch = 0;
    this.webPitch = 0;
    this.webRoll = 0;
    this.target.reset();
    this.from.reset();
    this.output.reset();
    this.rig.resetToBindPose();
    this.visual.position.set(0, 0, 0);
    this.visual.rotation.set(0, 0, 0);
  }

  /** Hold the crouch at once (a statue on a pedestal). */
  crouchNow(): void {
    this.stillFor = CROUCH.after + CROUCH.settle;
    this.crouch = 1;
  }

  update(delta: number, input: AnimationInput): void {
    const dt = Math.max(0, delta);
    this.stateTime += dt;
    this.resolveState(input);
    this.trackStillness(dt, input);
    this.writePose(dt, input);
    this.blend(dt);
    this.applyWebLayer(dt, input);
    this.rig.applyPose(this.output);
    this.applyVisual(dt, input);
  }

  private resolveState(input: AnimationInput): void {
    if (input.onWeb) {
      this.wasGrounded = false;
      this.setState('web', TRANSITIONS.toAirborne);
      return;
    }
    if (input.landed || (input.grounded && !this.wasGrounded)) {
      this.wasGrounded = true;
      this.setState('landing', TRANSITIONS.toLanding);
      return;
    }
    this.wasGrounded = input.grounded;
    if (!input.grounded) {
      this.setState('airborne', TRANSITIONS.toAirborne);
      return;
    }
    if (this.state === 'landing' && this.stateTime < LANDING.duration) return;
    this.setState(input.horizontalSpeed < LOCOMOTION.idleSpeed ? 'idle' : 'run', TRANSITIONS.toLocomotion);
  }

  private setState(next: AnimationState, duration: number): void {
    if (next === this.state) return;
    this.from.copyFrom(this.output);
    this.state = next;
    this.stateTime = 0;
    this.blendTime = 0;
    this.blendDuration = duration;
  }

  /** Stillness builds the crouch; any move, jump or web stands straight back up. */
  private trackStillness(dt: number, input: AnimationInput): void {
    const shooting = input.swingTime >= 0 || input.drawn;
    if (this.state === 'idle' && !shooting) this.stillFor += dt;
    else this.stillFor = 0;
    const want = ease(clamp((this.stillFor - CROUCH.after) / CROUCH.settle, 0, 1));
    // Settling in follows the settle curve; standing up is quick.
    const rate = want > this.crouch ? 12 : 16;
    this.crouch += (want - this.crouch) * (1 - Math.exp(-rate * dt));
    if (this.crouch < 1e-3) this.crouch = 0;
  }

  private writePose(dt: number, input: AnimationInput): void {
    switch (this.state) {
      case 'idle': {
        this.locomotion.settleTowardNeutral(dt);
        this.idleTime += dt;
        const breath = Math.sin(this.idleTime * IDLE.breathFrequency * Math.PI * 2);
        this.target.applyDefinition(IDLE.basePose);
        if (this.crouch > 0) {
          this.layerB.applyDefinition(CROUCH.pose);
          this.target.lerpBetween(this.target, this.layerB, this.crouch);
        }
        this.target.add('Spine1', breath * IDLE.breathAmount);
        this.target.add('Neck1', -breath * IDLE.breathAmount * 0.6);
        // Planted feet do not bob: the breath fades out as the crouch settles. The drop
        // lags the legs (the knees fold before the hips can come down), so it eases in.
        this.target.bobY = breath * IDLE.breathBob * (1 - this.crouch) + CROUCH.bobY * this.crouch ** 1.45;
        break;
      }
      case 'run':
        this.locomotion.advance(dt, input.horizontalSpeed, 1, false);
        this.locomotion.writePose(this.target, input.horizontalSpeed, 1);
        break;
      case 'airborne': {
        const rising = clamp(input.verticalVelocity / AIRBORNE.velocityReference, -1, 1);
        this.target.applyDefinition(AIRBORNE.fall);
        this.layerB.applyDefinition(AIRBORNE.rise);
        this.target.lerpBetween(this.target, this.layerB, clamp(0.5 + rising * 0.5, 0, 1));
        this.target.bobY = 0;
        break;
      }
      case 'landing': {
        const depth = 1 - ease(clamp(this.stateTime / LANDING.duration, 0, 1));
        this.target.applyDefinition(LANDING.pose, depth);
        this.target.bobY = LANDING.bobY * depth;
        break;
      }
      case 'web':
        this.target.applyDefinition(WEB_SWING.right);
        // A little kick of the legs with the swing's rhythm.
        this.target.add('LegL1', Math.sin(this.stateTime * 5) * 0.12);
        this.target.add('LegR1', -Math.sin(this.stateTime * 5) * 0.12);
        this.target.bobY = 0;
        break;
    }
  }

  private blend(dt: number): void {
    if (this.blendDuration > 0) {
      this.blendTime += dt;
      const t = clamp(this.blendTime / this.blendDuration, 0, 1);
      this.output.lerpBetween(this.from, this.target, ease(t));
      if (t >= 1) this.blendDuration = 0;
    } else {
      this.output.copyFrom(this.target);
    }
  }

  /**
   * THE WEB-SHOT LAYER: the shot while it plays, else the ready stance
   * (eased), else nothing - the relaxed run, idle or crouch shows through.
   * On a web only the free hand shoots.
   */
  private applyWebLayer(dt: number, input: AnimationInput): void {
    this.guard += ((input.drawn && this.state !== 'web' ? 1 : 0) - this.guard) * (1 - Math.exp(-10 * dt));
    const anim = ATTACKS[input.style] ?? ATTACKS.web;
    const swinging = input.swingTime >= 0 && input.swingTime < anim.duration;
    const bones = this.state === 'web' ? OFF_HAND : UPPER;

    if (swinging) {
      // On a web the free (left) hand always takes the shot.
      const index = this.state === 'web' ? 1 % anim.variants.length : input.swingVariant % anim.variants.length;
      const variant = anim.variants[index]!;
      const t = input.swingTime / anim.duration;
      if (t < anim.windEnd) {
        this.layerB.applyDefinition(anim.stance);
        this.layer.applyDefinition(variant.wind);
        this.layer.lerpBetween(this.layerB, this.layer, ease(t / anim.windEnd));
      } else if (t < anim.hitEnd) {
        const k = (t - anim.windEnd) / (anim.hitEnd - anim.windEnd);
        this.layerB.applyDefinition(variant.wind);
        this.layer.applyDefinition(variant.hit);
        this.layer.lerpBetween(this.layerB, this.layer, k * k * (3 - 2 * k));
      } else {
        const k = (t - anim.hitEnd) / (1 - anim.hitEnd);
        this.layerB.applyDefinition(variant.hit);
        this.layer.applyDefinition(anim.stance);
        this.layer.lerpBetween(this.layerB, this.layer, ease(k));
      }
      // Shooting from the crouch keeps the body low: only the arms rise.
      const weight = this.state === 'idle' ? 1 - this.crouch * 0.35 : 1;
      this.overrideBones(this.layer, weight, bones);
      if (anim.legs) this.overrideBones(this.layer, 0.5 + 0.5 * Math.sin(Math.PI * clamp(t, 0, 1)), LEGS);
      return;
    }
    if (this.guard > 0.01) {
      this.layer.applyDefinition(anim.stance);
      this.overrideBones(this.layer, this.guard * (1 - this.crouch), bones);
    }
  }

  private overrideBones(layer: PoseBuffer, weight: number, bones: readonly BoneName[]): void {
    const out = this.output.rotations;
    const src = layer.rotations;
    for (const bone of bones) {
      const at = boneIndex(bone);
      for (let k = 0; k < 3; k += 1) {
        const a = out[at + k] ?? 0;
        const b = src[at + k] ?? 0;
        out[at + k] = a + (b - a) * weight;
      }
    }
  }

  private applyVisual(dt: number, input: AnimationInput): void {
    const anim = ATTACKS[input.style] ?? ATTACKS.web;
    const shooting = input.swingTime >= 0 && input.swingTime < anim.duration;
    const wantLean = shooting ? anim.lean * Math.sin(Math.PI * clamp(input.swingTime / anim.duration, 0, 1)) : 0;
    this.lean += (wantLean - this.lean) * (1 - Math.exp(-18 * dt));
    const wantBank = this.state === 'run' ? -input.turn * LOCOMOTION.bankAngle * 0.6 : 0;
    this.bank += (wantBank - this.bank) * (1 - Math.exp(-LOCOMOTION.bankRate * dt));
    // Hanging from a web, the body leans along it.
    const onWeb = this.state === 'web';
    const pitch = onWeb ? clamp(input.webPitch, -WEB_SWING.maxLean, WEB_SWING.maxLean) : 0;
    const roll = onWeb ? clamp(input.webRoll, -WEB_SWING.maxLean, WEB_SWING.maxLean) : 0;
    const k = 1 - Math.exp(-10 * dt);
    this.webPitch += (pitch - this.webPitch) * k;
    this.webRoll += (roll - this.webRoll) * k;
    this.visual.rotation.set(this.lean + this.webPitch, 0, this.bank + this.webRoll);
    this.visual.position.y = this.output.bobY;
  }
}

const boneIndex = (bone: BoneName): number => BONE_INDEX[bone] * 3;
