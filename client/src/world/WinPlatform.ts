import { REWARD_ARCH, arenaEndZ, rewardPadOf } from '@spider/shared';
import {
  AdditiveBlending,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  RingGeometry,
  Shape,
  TorusGeometry,
  type Material,
} from 'three';
import type { PartBuilder } from '../render/PartBuilder.js';
import { CanvasSign } from './CanvasSign.js';
import { Place } from './Props.js';

/** A flat five-point star, `depth` thick, standing in the XY plane. */
const star = (outer: number, depth: number): ExtrudeGeometry => {
  const shape = new Shape();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? outer : outer * 0.45;
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.closePath();
  return new ExtrudeGeometry(shape, { depth, bevelEnabled: false });
};

/**
 * THE WIN PLATFORM: the same reward checkpoint on every stage, trimmed in the
 * stage's own accent colour.
 *
 *   - a gold octagonal plate round the reward pad, its rim lit in the accent,
 *     with four short light bollards at its corners (outside the pad);
 *   - behind it, against the far wall, a hero arch: two pillars (solid, see
 *     `rewardArchSolids`), a gold lintel reading CLAIM WINS, a trophy on top
 *     with a sunburst behind it, and a star banner on the wall between;
 *   - once the stage is cleared: a pulsing light column over the pad, gold
 *     sparks circling it, and a ring rippling out from it.
 *
 * The pad itself stays completely open. Static parts merge into the arena's
 * meshes; the few animated parts share their geometry and materials across
 * all thirty stages.
 */
export const buildWinPlatform = (b: PartBuilder, stage: number, accent: number): CanvasSign => {
  const pad = rewardPadOf(stage);
  const end = arenaEndZ(stage);
  const front = end - REWARD_ARCH.depth;
  const zc = end - REWARD_ARCH.depth / 2;

  // The plate, its rim, and the bollards.
  const plate = new Place(b, pad.x, pad.z);
  plate.add(new CylinderGeometry(6, 6.2, 0.08, 8), 0xffc21a, 'stud', { y: 0.04, ry: Math.PI / 8 });
  plate.add(new TorusGeometry(5.5, 0.12, 4, 32), accent, 'glow', { y: 0.14, rx: Math.PI / 2, sz: 0.5 });
  for (let i = 0; i < 4; i += 1) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    plate.cyl(0.26, 0.3, 0.55, 0xf4efe3, 'smooth', { x: Math.cos(a) * 6.6, z: Math.sin(a) * 6.6 }, 10);
    plate.cyl(0.28, 0.28, 0.14, accent, 'glow', { x: Math.cos(a) * 6.6, y: 0.55, z: Math.sin(a) * 6.6 }, 10);
  }

  // The arch: pillars, accent strips, the lintel.
  const arch = new Place(b, pad.x, zc);
  for (const side of [-1, 1]) {
    const x = side * REWARD_ARCH.halfSpan;
    arch.box(REWARD_ARCH.pillar * 2, REWARD_ARCH.height - 1.6, REWARD_ARCH.depth, 0xf4efe3, 'stud', { x });
    arch.box(0.3, REWARD_ARCH.height - 2.6, 0.08, accent, 'glow', { x, y: 0.5, z: -REWARD_ARCH.depth / 2 - 0.04 });
    arch.box(REWARD_ARCH.pillar * 2 + 0.3, 0.5, REWARD_ARCH.depth, 0xffc21a, 'smooth', { x, z: -0.15 });
  }
  arch.box(REWARD_ARCH.halfSpan * 2 + REWARD_ARCH.pillar * 2 + 0.4, 1.6, REWARD_ARCH.depth, 0xffc21a, 'stud', { y: REWARD_ARCH.height - 1.6 });

  // The trophy on the lintel, a sunburst behind it on the wall.
  const top = REWARD_ARCH.height;
  arch.box(2.6, 0.6, 1.4, 0x3a2a1a, 'smooth', { y: top })
    .cyl(0.25, 0.35, 1, 0xffd23a, 'smooth', { y: top + 0.6 })
    .cyl(1.05, 0.4, 1.7, 0xffd23a, 'smooth', { y: top + 1.6 }, 16)
    .add(new TorusGeometry(1.05, 0.1, 6, 20), 0xfff1a0, 'glow', { y: top + 3.3, rx: Math.PI / 2 })
    .add(new TorusGeometry(0.45, 0.1, 6, 12), 0xffd23a, 'smooth', { x: -1.15, y: top + 2.5 })
    .add(new TorusGeometry(0.45, 0.1, 6, 12), 0xffd23a, 'smooth', { x: 1.15, y: top + 2.5 })
    .add(new OctahedronGeometry(0.5, 0), 0xffffff, 'glow', { y: top + 4.2 });
  const wall = new Place(b, pad.x, end - 0.06);
  wall.add(new CylinderGeometry(3.6, 3.6, 0.06, 12), accent, 'glow', { y: top + 2.4, rx: Math.PI / 2 });
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    wall.add(new CylinderGeometry(0.18, 0.18, 2.4, 4), 0xfff1a0, 'glow', { x: Math.cos(a) * 4.6, y: top + 2.4 + Math.sin(a) * 4.6, rx: Math.PI / 2, rz: a + Math.PI / 2 });
  }
  // A star banner on the wall between the pillars.
  wall.box(REWARD_ARCH.halfSpan * 2 - 2, REWARD_ARCH.height - 3, 0.1, 0x1a2230, 'smooth', { y: 0.6 });
  wall.add(star(2.5, 0.06), accent, 'glow', { y: 7.6, z: -0.16 });
  wall.add(star(2.0, 0.08), 0xffd23a, 'glow', { y: 7.6, z: -0.26 });

  // CLAIM WINS on the lintel's face, facing the arena.
  const sign = new CanvasSign(12, 1.4, [{ text: 'CLAIM WINS', size: 1, fill: '#ffffff', stroke: '#6a3a00', strokeWidth: 0.16 }]);
  sign.mesh.position.set(pad.x, top - 0.8, front - 0.03);
  sign.mesh.rotation.y = Math.PI;
  return sign;
};

/** The animated half, shared by every stage: light column, circling sparks, ripple ring. */
export class WinPlatformFx {
  private readonly column = new CylinderGeometry(3.7, 3.7, 9, 24, 1, true);
  private readonly spark = new OctahedronGeometry(0.22, 0);
  private readonly ripple = new RingGeometry(3.7, 4.3, 36);
  private readonly columnMaterial = new MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.18, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false });
  private readonly sparkMaterial = new MeshBasicMaterial({ color: 0xfff1a0, fog: false });
  private readonly rippleMaterial = new MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.6, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false });
  private readonly rigs: { group: Group; sparks: Group; ripple: Mesh }[] = [];
  private time = 0;

  /** The animated parts over one stage's pad, hidden until the stage is cleared. */
  create(stage: number): Group {
    const pad = rewardPadOf(stage);
    const group = new Group();
    group.position.set(pad.x, 0, pad.z);
    group.visible = false;
    const column = new Mesh(this.column, this.columnMaterial);
    column.position.y = 4.6;
    const sparks = new Group();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      const spark = new Mesh(this.spark, this.sparkMaterial);
      spark.position.set(Math.cos(a) * 3.2, 1.6 + (i % 3) * 0.8, Math.sin(a) * 3.2);
      sparks.add(spark);
    }
    const ripple = new Mesh(this.ripple, this.rippleMaterial);
    ripple.rotation.x = -Math.PI / 2;
    ripple.position.y = 0.25;
    group.add(column, sparks, ripple);
    this.rigs.push({ group, sparks, ripple });
    return group;
  }

  /** Animate every visible rig: one shared pulse, so it costs nothing per stage. */
  update(delta: number): void {
    this.time += delta;
    this.columnMaterial.opacity = 0.14 + Math.sin(this.time * 3) * 0.06;
    const phase = (this.time * 0.7) % 1;
    this.rippleMaterial.opacity = 0.6 * (1 - phase);
    for (const rig of this.rigs) {
      if (!rig.group.visible) continue;
      rig.sparks.rotation.y = this.time * 1.4;
      rig.sparks.position.y = Math.sin(this.time * 2) * 0.2;
      const s = 1 + phase * 0.8;
      rig.ripple.scale.set(s, s, 1);
    }
  }

  get materials(): Material[] {
    return [this.columnMaterial, this.sparkMaterial, this.rippleMaterial];
  }

  dispose(): void {
    this.column.dispose();
    this.spark.dispose();
    this.ripple.dispose();
    for (const material of this.materials) material.dispose();
  }
}
