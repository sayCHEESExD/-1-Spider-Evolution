import type { PoseDefinition } from '../animation/PoseBuffer.js';

const deg = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Procedural animation tuning. Every number the animator uses lives here.
 * All rotations are in CHARACTER space (see `PlayerRig`): +X pitch swings a
 * limb BACKWARD, so a raised arm is a large negative X.
 */

/** The walk/run cycle: ONE cycle at three depths. */
export const LOCOMOTION = {
  minFrequency: 0.7,
  maxFrequency: 3.6,
  strideDistance: 5.2,
  idleSpeed: 0.6,
  walkSpeed: 4,
  runSpeed: 14,
  sprintSpeed: 30,

  hipSwing: { walk: deg(22), run: deg(42), sprint: deg(56) },
  kneeBend: { walk: deg(30), run: deg(58), sprint: deg(72) },
  armSwing: { walk: deg(18), run: deg(36), sprint: deg(52) },
  elbowBend: { walk: deg(14), run: deg(44), sprint: deg(70) },
  torsoTwist: { walk: deg(4), run: deg(7), sprint: deg(9) },
  torsoLean: { walk: deg(3), run: deg(10), sprint: deg(18) },
  headCounterTwist: { walk: deg(2), run: deg(4), sprint: deg(5) },
  torsoRoll: { walk: deg(2), run: deg(3), sprint: deg(3) },
  bob: { walk: 0.05, run: 0.11, sprint: 0.15 },
  bankAngle: deg(9),
  bankRate: 8,
} as const;

/** The idle: standing loose and breathing, fists relaxed at the hips. */
export const IDLE = {
  breathFrequency: 0.35,
  breathAmount: deg(1.8),
  breathBob: 0.012,
  basePose: {
    ArmL1: { x: deg(-8), z: deg(14) },
    ArmL2: { x: deg(38) },
    ArmR1: { x: deg(4), z: deg(-6) },
    ArmR2: { x: deg(12) },
    LegL1: { x: deg(-4) },
    LegR1: { x: deg(4) },
  } satisfies PoseDefinition,
} as const;

/** In the air: knees tucked on the way up, legs reaching on the way down. */
export const AIRBORNE = {
  rise: {
    LegL1: { x: deg(-38) },
    LegR1: { x: deg(8) },
    LegL2: { x: deg(62) },
    LegR2: { x: deg(40) },
    ArmL1: { x: deg(-40), z: deg(34) },
    ArmR1: { x: deg(-30), z: deg(-34) },
    ArmL2: { x: deg(30) },
    ArmR2: { x: deg(30) },
    Spine1: { x: deg(6) },
  } satisfies PoseDefinition,
  fall: {
    LegL1: { x: deg(-14) },
    LegR1: { x: deg(10) },
    LegL2: { x: deg(22) },
    LegR2: { x: deg(18) },
    ArmL1: { x: deg(-70), z: deg(40) },
    ArmR1: { x: deg(-60), z: deg(-40) },
    ArmL2: { x: deg(20) },
    ArmR2: { x: deg(20) },
    Spine1: { x: deg(-4) },
  } satisfies PoseDefinition,
  velocityReference: 20,
} as const;

/** The landing crouch: knees give, one hand drops toward the street. */
export const LANDING = {
  duration: 0.16,
  pose: {
    LegL1: { x: deg(-34) },
    LegR1: { x: deg(-34) },
    LegL2: { x: deg(58) },
    LegR2: { x: deg(58) },
    ArmL1: { x: deg(-30), z: deg(34) },
    ArmR1: { x: deg(-36), z: deg(-14) },
    Spine1: { x: deg(18) },
  } satisfies PoseDefinition,
  bobY: -0.42,
} as const;


/** Seconds a pose change takes to blend in. */
export const TRANSITIONS = {
  toLocomotion: 0.14,
  toAirborne: 0.12,
  toLanding: 0.06,
} as const;

/**
 * THE SPIDER CROUCH: after a few seconds without moving or shooting, the
 * idle sinks into the classic Spider-Man perch - knees deep, torso low and
 * forward, the right hand planted on the street and the left hand out to the
 * side, fingers spread, head up and watching. It breathes, and any movement
 * or web stands it straight back up.
 */
export const CROUCH = {
  /** Seconds of stillness before the crouch begins, and how long it takes to settle. */
  after: 3.5,
  settle: 0.55,
  /**
   * How far the body drops. Measured against the skinned mesh: with this pose
   * the feet and the planted right hand rest ON the street (lowest vertex ~0),
   * nothing sinks through it.
   */
  bobY: -0.56,
  pose: {
    LegL1: { x: deg(-95), z: deg(18) },
    LegL2: { x: deg(95) },
    LegR1: { x: deg(-95), z: deg(-20) },
    LegR2: { x: deg(95) },
    Spine1: { x: deg(46) },
    Spine2: { x: deg(10) },
    Neck1: { x: deg(-50) },
    ArmR1: { x: deg(-45), z: deg(-14) },
    ArmR2: { x: deg(4) },
    ArmL1: { x: deg(-40), z: deg(66) },
    ArmL2: { x: deg(6) },
  } satisfies PoseDefinition,
} as const;

/**
 * ON THE WEB: the web hand straight up, gripping the strand; the other arm out
 * for balance; the knees drawn up. The body itself leans along the web (the
 * animator tilts it toward the anchor).
 */
export const WEB_SWING = {
  right: {
    ArmR1: { x: deg(-172), z: deg(-6) },
    ArmR2: { x: deg(8) },
    ArmL1: { x: deg(-50), z: deg(48) },
    ArmL2: { x: deg(40) },
    LegL1: { x: deg(-58) },
    LegL2: { x: deg(88) },
    LegR1: { x: deg(-18) },
    LegR2: { x: deg(46) },
    Spine1: { x: deg(-6) },
    Neck1: { x: deg(-10) },
  } satisfies PoseDefinition,
  /** Most the body tilts along the web, radians. */
  maxLean: deg(55),
} as const;

// -------------------------------------------------------------- web shots

/**
 * A WEB SHOT in three beats over `duration` seconds: WIND (the wrist cocked
 * back), HIT (the arm snapped straight at the target, two fingers down - thwip)
 * and RECOVER. Variants alternate hands. Layered over whatever the legs are
 * doing, so a player can shoot while running, crouching or swinging.
 */
export interface AttackAnimation {
  readonly duration: number;
  readonly windEnd: number;
  readonly hitEnd: number;
  readonly legs: boolean;
  readonly lean: number;
  readonly stance: PoseDefinition;
  readonly variants: readonly { readonly wind: PoseDefinition; readonly hit: PoseDefinition }[];
}

export type AttackStyle = 'web' | 'enemy';

/** Between shots: both hands up and forward, wrists ready. */
const READY: PoseDefinition = {
  ArmR1: { x: deg(-62), z: deg(-12) },
  ArmR2: { x: deg(72) },
  ArmL1: { x: deg(-58), z: deg(12) },
  ArmL2: { x: deg(78) },
};

const FISTS: PoseDefinition = {
  ArmR1: { x: deg(-50), z: deg(-10) },
  ArmR2: { x: deg(100) },
  ArmL1: { x: deg(-50), z: deg(10) },
  ArmL2: { x: deg(100) },
};

const merge = (base: PoseDefinition, over: PoseDefinition): PoseDefinition => ({ ...base, ...over });

const attack = (
  duration: number,
  stance: PoseDefinition,
  variants: readonly { wind: PoseDefinition; hit: PoseDefinition }[],
  options: { legs?: boolean; lean?: number; windEnd?: number; hitEnd?: number } = {},
): AttackAnimation => ({
  duration,
  windEnd: options.windEnd ?? 0.3,
  hitEnd: options.hitEnd ?? 0.58,
  legs: options.legs ?? false,
  lean: options.lean ?? deg(6),
  stance,
  variants: variants.map((v) => ({ wind: merge(stance, v.wind), hit: merge(stance, v.hit) })),
});

export const ATTACKS: Readonly<Record<AttackStyle, AttackAnimation>> = {
  /** Spider-Man: a wrist-flick web shot, one hand then the other. */
  web: attack(0.3, READY, [
    {
      wind: { ArmR1: { x: deg(-74), z: deg(-26) }, ArmR2: { x: deg(84) }, Spine1: { y: deg(16) }, Neck1: { y: deg(-10) } },
      hit: { ArmR1: { x: deg(-96), z: deg(-4) }, ArmR2: { x: deg(0) }, Spine1: { y: deg(-12) }, Neck1: { y: deg(8) } },
    },
    {
      wind: { ArmL1: { x: deg(-74), z: deg(26) }, ArmL2: { x: deg(84) }, Spine1: { y: deg(-16) }, Neck1: { y: deg(10) } },
      hit: { ArmL1: { x: deg(-96), z: deg(4) }, ArmL2: { x: deg(0) }, Spine1: { y: deg(12) }, Neck1: { y: deg(-8) } },
    },
  ], { windEnd: 0.24, hitEnd: 0.5 }),
  /** Enemies: a clubbing swipe. */
  enemy: attack(0.4, FISTS, [
    { wind: { ArmR1: { x: deg(-150), z: deg(-20) }, ArmR2: { x: deg(40) }, Spine1: { y: deg(20) } }, hit: { ArmR1: { x: deg(-40), z: deg(20) }, ArmR2: { x: deg(10) }, Spine1: { y: deg(-20) } } },
    { wind: { ArmL1: { x: deg(-150), z: deg(20) }, ArmL2: { x: deg(40) }, Spine1: { y: deg(-20) } }, hit: { ArmL1: { x: deg(-40), z: deg(-20) }, ArmL2: { x: deg(10) }, Spine1: { y: deg(20) } } },
  ]),
};

/** Seconds from the start of a web shot to its release frame, where the thwip plays. */
export const impactSeconds = (style: AttackStyle): number => {
  const anim = ATTACKS[style];
  return anim.duration * (anim.windEnd + (anim.hitEnd - anim.windEnd) * 0.5);
};
