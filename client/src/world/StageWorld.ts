import {
  ARENA,
  STAGES,
  STAGE_COUNT,
  arenaEndZ,
  arenaStartZ,
  formatAmount,
  formatWins,
  returnPadOf,
  rewardPadOf,
  type StageTheme,
} from '@spider/shared';
import {
  AdditiveBlending,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  RingGeometry,
  type Material,
} from 'three';
import { PartBuilder } from '../render/PartBuilder.js';
import { CanvasSign } from './CanvasSign.js';
import { buildStageCity } from './CityLayout.js';
import { orb } from './CityProps.js';
import { LabelSprite, trophyIcon } from './LabelSprite.js';
import { CityKit } from './NycBuildings.js';
import { dressStage, groundOf } from './StageDressing.js';
import { WinPlatformFx, buildWinPlatform } from './WinPlatform.js';

/**
 * The look of a stage: floor and wall colours, an accent for its gates, and
 * the scenery that stands OUTSIDE its walls (x beyond +-48, on the wall
 * solids) - so every arena reads as a different place while its walkable
 * middle stays open for the fight.
 */
interface ThemeStyle {
  readonly floor: number;
  readonly floorAlt: number;
  readonly wall: number;
  readonly wallTop: number;
  readonly accent: number;
}

/**
 * How tall the side barriers are drawn: a waist-high city barrier, so the
 * street, the lab or the docks beyond read as the place the fight is in. The
 * solid behind it runs far higher than anyone can jump.
 */
const SIDE_WALL = 3;
/** Dressing is built for arenas within this of the player, and dropped past the second figure. */
const DRESS_NEAR = 330;
const DRESS_FAR = 480;

const THEMES: Readonly<Record<StageTheme, ThemeStyle>> = {
  alley: { floor: 0x5a5e68, floorAlt: 0x6a6e78, wall: 0xa85a3a, wallTop: 0x3a3a44, accent: 0xffd23a },
  chinatown: { floor: 0x6a5e5e, floorAlt: 0x7a6a6a, wall: 0xc8202a, wallTop: 0x2a8a4a, accent: 0xffd23a },
  docks: { floor: 0x8a6a4a, floorAlt: 0x7a5a3a, wall: 0x3a6aa8, wallTop: 0xf4f4f4, accent: 0xffd23a },
  subway: { floor: 0x6a6a7a, floorAlt: 0x7a7a8a, wall: 0xdcd6c8, wallTop: 0x2a8a4a, accent: 0x3fd6ff },
  oscorp: { floor: 0xdfe8ec, floorAlt: 0xc8d8e0, wall: 0x2a3a34, wallTop: 0x3dff6e, accent: 0x3dff6e },
  timessquare: { floor: 0x4a4a5a, floorAlt: 0x5a5a6a, wall: 0x2a2a44, wallTop: 0xff2ea0, accent: 0x3dd6ff },
  bridge: { floor: 0x5a5e68, floorAlt: 0x6a6e78, wall: 0xb89a7a, wallTop: 0x8a6a4a, accent: 0xffd23a },
  park: { floor: 0x6ab84a, floorAlt: 0x5aa83a, wall: 0x7a6a5a, wallTop: 0x4a8a3a, accent: 0xfff4a0 },
  rooftops: { floor: 0x6a6a74, floorAlt: 0x7a7a84, wall: 0x9a5a3a, wallTop: 0xd8d0c0, accent: 0xff4a4a },
  coney: { floor: 0xc8b890, floorAlt: 0xd8c8a0, wall: 0xff4a6a, wallTop: 0xffffff, accent: 0xffd23a },
  harbor: { floor: 0xd8b878, floorAlt: 0xc8a868, wall: 0x8a7a5a, wallTop: 0x3a8a3a, accent: 0xffc83a },
  alchemax: { floor: 0x3a3a44, floorAlt: 0x4a4a54, wall: 0x26262e, wallTop: 0xffc83a, accent: 0xffc83a },
  warehouse: { floor: 0x6a6258, floorAlt: 0x7a7268, wall: 0x5a4a3a, wallTop: 0x8a1a22, accent: 0xff3a3a },
  hive: { floor: 0x2a2a34, floorAlt: 0x1a1a22, wall: 0x14151c, wallTop: 0xf4f6ff, accent: 0xff3a8a },
  ravencroft: { floor: 0x7a7a84, floorAlt: 0x6a6a74, wall: 0x8a8a94, wallTop: 0xc81424, accent: 0xc81424 },
  kingpin: { floor: 0xe8e0d0, floorAlt: 0xd8c8a8, wall: 0xf4f2ec, wallTop: 0xd4af37, accent: 0xd4af37 },
  sinister: { floor: 0x3a2a4a, floorAlt: 0x4a3a5a, wall: 0x2a1a3a, wallTop: 0xb16bff, accent: 0xff3a8a },
  goblin: { floor: 0x3a4a3a, floorAlt: 0x4a5a4a, wall: 0x2a3a2a, wallTop: 0xff5a1c, accent: 0x7aff5a },
  wallstreet: { floor: 0x7a7a84, floorAlt: 0x8a8a94, wall: 0xd8d0c0, wallTop: 0x2a2a34, accent: 0xd4af37 },
  eastriver: { floor: 0x7a5a3a, floorAlt: 0x6a4a2a, wall: 0x3a4a5a, wallTop: 0xf4f4f4, accent: 0x5ab8ff },
  grandcentral: { floor: 0xd8ccb0, floorAlt: 0xc8b890, wall: 0xb8a888, wallTop: 0xd4af37, accent: 0xd4af37 },
  navyyard: { floor: 0x6a6e78, floorAlt: 0x5a5e68, wall: 0x6a7280, wallTop: 0xffd23a, accent: 0xffd23a },
  crypt: { floor: 0x4a4a54, floorAlt: 0x3a3a44, wall: 0x5a4a4a, wallTop: 0x2a1a1a, accent: 0xff3a3a },
  foundry: { floor: 0x4a4038, floorAlt: 0x5a4e44, wall: 0x3a302a, wallTop: 0xff6a1c, accent: 0xff8a1c },
  highline: { floor: 0x8a8a7a, floorAlt: 0x7a7a6a, wall: 0x3a4a3a, wallTop: 0x6ab84a, accent: 0xf4f4ff },
  unplaza: { floor: 0xc8ccd4, floorAlt: 0xb8bcc4, wall: 0xe8e8e0, wallTop: 0x3fa9ff, accent: 0x3fa9ff },
  rockefeller: { floor: 0xe8eef4, floorAlt: 0xd8e4ee, wall: 0x8a6a4a, wallTop: 0xc8202a, accent: 0xffd23a },
  clonelab: { floor: 0xe8f0f4, floorAlt: 0xd8e4ec, wall: 0x2a3a3a, wallTop: 0x5aff8a, accent: 0x5aff8a },
  liberty: { floor: 0xb8a888, floorAlt: 0xa89878, wall: 0x5fb89a, wallTop: 0xd4af37, accent: 0xffc83a },
  empirestate: { floor: 0x6a6a74, floorAlt: 0x7a7a84, wall: 0xd8ccb4, wallTop: 0xd4af37, accent: 0xff2a2a },
};

interface ArenaVisual {
  readonly stage: number;
  readonly root: Group;
  readonly lock: Mesh | null;
  readonly reward: LabelSprite;
  readonly rewardDisc: MeshBasicMaterial;
  /** The cleared-stage effects over the Win platform. */
  readonly winFx: Group;
  /** The environment round the arena, built only while the player is near. */
  dressing: Group | null;
}

/**
 * THE THIRTY ARENAS down the stage street. Each is a themed floor, themed walls
 * standing exactly on the wall solids, a gate into the next arena (with a red
 * force field until the player has cleared this one), a sign over that gate
 * with the next stage's recommended Power, a reward pad and a return pad.
 */
export class StageWorld {
  readonly root = new Group();
  private readonly arenas: ArenaVisual[] = [];
  private readonly materials: Material[] = [];
  private readonly signs: CanvasSign[] = [];
  private readonly labels: LabelSprite[] = [];
  private readonly winFx = new WinPlatformFx();
  private opened = -1;
  private rewardSignature = '';
  private time = 0;

  constructor() {
    this.root.name = 'stages';
    for (const stage of STAGES) this.buildArena(stage.index);
    this.setProgress(0, null);
  }

  private buildArena(index: number): void {
    const stage = STAGES[index - 1]!;
    const theme = THEMES[stage.theme];
    const start = arenaStartZ(index);
    const end = arenaEndZ(index);
    const length = end - start;
    const mid = (start + end) / 2;
    const group = new Group();
    group.name = `arena-${index}`;

    const b = new PartBuilder();
    // The floor, with a checker of big tiles in the alternate colour.
    b.box(ARENA.halfWidth * 2, 1, length, theme.floor, 'stud', { y: -0.5, z: mid });
    for (let gx = -2; gx <= 1; gx += 1) {
      for (let gz = 0; gz < 6; gz += 1) {
        if ((gx + gz) % 2 === 0) continue;
        b.box(20, 0.06, 14, theme.floorAlt, 'stud', { x: gx * 22 + 11, y: 0.03, z: start + 8 + gz * 16 });
      }
    }
    // The side walls, standing on the wall solids, running on to meet the next arena's at the gate.
    const wallFrom = index === 1 ? start : start - ARENA.gateDepth / 2;
    const wallTo = index === STAGE_COUNT ? end + 6 : end + ARENA.gateDepth / 2;
    const wallMid = (wallFrom + wallTo) / 2;
    const wallLength = wallTo - wallFrom - 0.02;
    for (const side of [-1, 1]) {
      // The ground beyond the wall, where the scenery stands.
      b.box(42, 1, wallLength, groundOf(stage.theme), 'stud', { x: side * 69, y: -0.5, z: wallMid });
      // Low side walls (the solid runs higher than anyone can jump), so the scenery beyond shows.
      b.box(4, SIDE_WALL, wallLength, theme.wall, 'stud', { x: side * (ARENA.halfWidth + 2), y: SIDE_WALL / 2, z: wallMid });
      b.box(4.6, 1.2, wallLength, theme.wallTop, 'stud', { x: side * (ARENA.halfWidth + 2), y: SIDE_WALL + 0.6, z: wallMid });
      // A bright stripe along the inside face.
      b.box(0.3, 0.8, length - 0.2, theme.accent, 'glow', { x: side * (ARENA.halfWidth - 0.15), y: 1.8, z: mid });
      // Posts along the barrier, capped in the theme's accent.
      for (let z = wallFrom + 6; z < wallTo - 3; z += 12) {
        b.box(4.8, 1.6, 1.4, theme.wall, 'stud', { x: side * (ARENA.halfWidth + 2), y: SIDE_WALL + 1.2 + 0.8, z });
        b.box(4.9, 0.4, 1.5, theme.accent, 'glow', { x: side * (ARENA.halfWidth + 2), y: SIDE_WALL + 2.8 + 0.2, z });
      }
    }

    // The gate out of this arena (the last stage ends in a solid wall).
    const gz = end + ARENA.gateDepth / 2;
    const half = ARENA.portalHalfWidth;
    if (index < STAGE_COUNT) {
      const side = ARENA.halfWidth - half;
      for (const s of [-1, 1]) b.box(side, ARENA.wallHeight, ARENA.gateDepth, theme.wall, 'stud', { x: s * (half + side / 2), y: ARENA.wallHeight / 2, z: gz });
      b.box(half * 2, ARENA.wallHeight - ARENA.portalHeight, ARENA.gateDepth, theme.wall, 'stud', { x: 0, y: (ARENA.wallHeight + ARENA.portalHeight) / 2, z: gz });
      // The accent frame round the portal, on the arena side only.
      for (const s of [-1, 1]) b.box(1.6, ARENA.portalHeight, 0.6, theme.accent, 'glow', { x: s * (half + 0.8), y: ARENA.portalHeight / 2, z: end - 0.3 });
      b.box(half * 2 + 3.2, 1.4, 0.6, theme.accent, 'glow', { x: 0, y: ARENA.portalHeight + 0.7, z: end - 0.3 });
    } else {
      b.box(ARENA.halfWidth * 2, 30, 6, theme.wall, 'stud', { x: 0, y: 15, z: end + 3 });
      orb(b, 0, 20, end - 1, 4, theme.accent);
    }

    // Pads: the reward pad and the return pad.
    const reward = rewardPadOf(index);
    const back = returnPadOf(index);
    b.add(new CylinderGeometry(back.half, back.half, 0.12, 28), 0x3fa9ff, 'glow', { x: back.x, y: 0.07, z: back.z });

    const claimSign = buildWinPlatform(b, index, theme.accent);
    group.add(claimSign.mesh);
    this.signs.push(claimSign);
    group.add(b.build(`arena-${index}-parts`));

    const rewardMaterial = new MeshBasicMaterial({ color: 0x5a5a6a });
    this.materials.push(rewardMaterial);
    const disc = new Mesh(new CylinderGeometry(reward.half, reward.half, 0.14, 32), rewardMaterial);
    disc.position.set(reward.x, 0.15, reward.z);
    group.add(disc);
    const winFx = this.winFx.create(index);
    group.add(winFx);

    const rewardLabel = new LabelSprite(6.4, 2.6, 320);
    rewardLabel.sprite.position.set(reward.x, 6.4, reward.z);
    group.add(rewardLabel.sprite);
    this.labels.push(rewardLabel);

    const backLabel = new LabelSprite(6, 2, 256);
    backLabel.sprite.position.set(back.x, 3, back.z);
    backLabel.set([{ text: 'Return to Spawn', color: '#9fdcff' }]);
    group.add(backLabel.sprite);
    this.labels.push(backLabel);

    // The sign over the portal INTO this arena, facing the way players come.
    const entryZ = index === 1 ? null : arenaEndZ(index - 1) + 0.6;
    if (entryZ !== null) {
      const sign = new CanvasSign(16, 7, [
        { text: `Stage ${index}`, size: 1.2, fill: '#ffffff', stroke: '#101a3a', strokeWidth: 0.16 },
        { text: stage.name, size: 0.7, fill: '#ffd23a', stroke: '#101a3a', strokeWidth: 0.16 },
        { text: `Recommended Web Power: ${formatAmount(stage.recommendedPower)}`, size: 0.7, fill: '#bfe6ff', stroke: '#101a3a', strokeWidth: 0.16 },
      ]);
      sign.mesh.position.set(0, 10, entryZ);
      sign.mesh.rotation.y = Math.PI;
      this.root.add(sign.mesh);
      this.signs.push(sign);
    }
    // A name banner inside the arena, over its entrance, facing the fight.
    const banner = new CanvasSign(30, 5, [
      { text: `${stage.name.toUpperCase()}`, size: 1, fill: '#ffffff', stroke: '#101a3a', strokeWidth: 0.16 },
    ]);
    banner.mesh.position.set(0, ARENA.portalHeight + 4, start + 0.35);
    group.add(banner.mesh);
    this.signs.push(banner);

    // The force field in the forward portal, until this arena is cleared.
    let lock: Mesh | null = null;
    if (index < STAGE_COUNT) {
      const material = this.mat(
        new MeshBasicMaterial({ color: 0xff3a4a, transparent: true, opacity: 0.4, side: DoubleSide, blending: AdditiveBlending, depthWrite: false }),
      );
      lock = new Mesh(new PlaneGeometry(half * 2, ARENA.portalHeight), material);
      lock.position.set(0, ARENA.portalHeight / 2, gz);
      group.add(lock);
    }

    this.root.add(group);
    this.arenas.push({ stage: index, root: group, lock, reward: rewardLabel, rewardDisc: rewardMaterial, winFx, dressing: null });
  }

  private mat<T extends Material>(material: T): T {
    this.materials.push(material);
    return material;
  }

  /**
   * The local player's progress: which portals are open, and which reward pads
   * are armed (the wave is down and the Wins are waiting).
   */
  setProgress(bestStage: number, killMasks: ArrayLike<number> | null): void {
    if (bestStage !== this.opened) {
      this.opened = bestStage;
      for (const arena of this.arenas) if (arena.lock) arena.lock.visible = arena.stage > bestStage;
    }
    const trophy = trophyIcon(() => {
      this.rewardSignature = '';
    });
    let signature = trophy ? 't' : 'n';
    for (const arena of this.arenas) {
      const stage = STAGES[arena.stage - 1]!;
      signature += (killMasks?.[arena.stage - 1] ?? 0) === stage.fullMask ? '1' : '0';
    }
    if (signature === this.rewardSignature) return;
    this.rewardSignature = signature;
    for (const arena of this.arenas) {
      const stage = STAGES[arena.stage - 1]!;
      const ready = (killMasks?.[arena.stage - 1] ?? 0) === stage.fullMask;
      arena.rewardDisc.color.setHex(ready ? 0xffd23a : 0x5a5a6a);
      arena.winFx.visible = ready;
      arena.reward.set([
        { text: `+${formatWins(stage.reward)} Trophies`, color: ready ? '#ffd23a' : '#dddddd', size: 1.1, icon: trophy },
        { text: ready ? 'STEP ON TO CLAIM!' : 'Defeat all enemies!', color: ready ? '#7dff6a' : '#ff8a8a', size: 0.8 },
      ]);
    }
  }

  /** Only arenas near the player are drawn; the rest of the road is fogged anyway. */
  update(delta: number, z: number): void {
    this.time += delta;
    this.winFx.update(delta);
    let built = false;
    for (const arena of this.arenas) {
      const mid = (arenaStartZ(arena.stage) + arenaEndZ(arena.stage)) / 2;
      const distance = Math.abs(mid - z);
      arena.root.visible = distance < 420;
      // At most one arena dressed per frame, so walking the road never hitches twice.
      if (!arena.dressing && distance < DRESS_NEAR && !built) {
        built = true;
        const b = new PartBuilder();
        dressStage(b, arena.stage, STAGES[arena.stage - 1]!.theme);
        arena.dressing = b.build(`arena-${arena.stage}-dressing`);
        // New York beyond the themed scenery: the street-front row and the towers behind.
        const city = new CityKit();
        buildStageCity(city, arena.stage);
        arena.dressing.add(city.build(`arena-${arena.stage}-city`));
        arena.root.add(arena.dressing);
      } else if (arena.dressing && distance > DRESS_FAR) {
        releaseGroup(arena.dressing);
        arena.dressing = null;
      }
      if (arena.lock?.visible) (arena.lock.material as MeshBasicMaterial).opacity = 0.32 + Math.sin(this.time * 3) * 0.1;
    }
  }

  dispose(): void {
    for (const arena of this.arenas) if (arena.dressing) releaseGroup(arena.dressing);
    for (const sign of this.signs) sign.dispose();
    for (const label of this.labels) label.dispose();
    for (const material of this.materials) material.dispose();
    this.winFx.dispose();
    this.root.removeFromParent();
  }
}


/** Drop a built dressing: its merged geometries are its own (the materials are shared). */
const releaseGroup = (group: Group): void => {
  group.traverse((child) => {
    const mesh = child as Mesh;
    if (mesh.isMesh) mesh.geometry.dispose();
  });
  group.removeFromParent();
};
