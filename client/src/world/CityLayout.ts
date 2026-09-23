import { ARENA, BOARDS, HUB, HUB_FRONT_WALL_DEPTH, HUB_GATE, arenaEndZ, arenaStartZ } from '@spider/shared';
import { CylinderGeometry } from 'three';
import { car, seeded, tree } from './CityProps.js';
import { lifted } from './Props.js';
import { CityKit, Lot, chrysler, empireState, nycBuilding, oneWorldTrade, type BuildingSpec } from './NycBuildings.js';

/**
 * WHERE NEW YORK STANDS. Pure placement over `NycBuildings`:
 *
 *   the plaza's walls   ring 1 - buildings standing exactly on the city-wall
 *                       solids, fronting the plaza (trim reaches at most into
 *                       the 1-unit slack between the facade and the solid);
 *   the portal wall     a row of storefront buildings flush on the front
 *                       wall's solid, a bridge building over the gate;
 *   behind them         ring 2 - taller towers, then a skyline of silhouettes
 *                       and three landmarks out in the haze;
 *   the stage street    per arena, a street-front row beyond the themed
 *                       scenery and taller towers behind it (built with the
 *                       arena's dressing, only while the player is near).
 *
 * Nothing here is walkable or solid; every building stands outside the play
 * space or on a solid it covers.
 */

const CAR_COLORS = [0xffc81a, 0xffc81a, 0xd8202c, 0x2a5ad8, 0xf4f4f4, 0x2a2e38, 0x3a8a4a] as const;

const pick = <T,>(random: () => number, list: readonly T[]): T => list[Math.floor(random() * list.length) % list.length]!;

/** Frontages along a run, with a small gap between neighbours (never touching, never overlapping). */
const frontages = (from: number, to: number, random: () => number, min: number, max: number, gap: number): { centre: number; width: number }[] => {
  const out: { centre: number; width: number }[] = [];
  let at = from;
  while (at < to - min * 0.6) {
    const width = Math.min(min + random() * (max - min), to - at);
    out.push({ centre: at + width / 2, width: width - gap });
    at += width;
  }
  return out;
};

/** A row of buildings fronting one way: `along` is the run axis, `front` where the facades stand. */
const row = (
  kit: CityKit,
  random: () => number,
  axis: 'x' | 'z',
  from: number,
  to: number,
  front: number,
  facing: 1 | -1,
  size: { readonly min: number; readonly max: number; readonly depth: [number, number]; readonly height: [number, number]; readonly gap?: number },
  extra: (centre: number) => Partial<BuildingSpec> = () => ({}),
): void => {
  for (const { centre, width } of frontages(from, to, random, size.min, size.max, size.gap ?? 0.8)) {
    const d = size.depth[0] + random() * (size.depth[1] - size.depth[0]);
    const h = size.height[0] + random() * (size.height[1] - size.height[0]);
    // The lot's centre sits half its depth behind the frontage line.
    const back = front - facing * (d / 2);
    const lot =
      axis === 'x'
        ? new Lot(kit, centre, back, facing > 0 ? 0 : Math.PI)
        : new Lot(kit, back, centre, facing > 0 ? Math.PI / 2 : -Math.PI / 2);
    nycBuilding(lot, { w: width, d, h, ...extra(centre) }, random);
  }
};

/** The plaza's city: ring 1 on the wall solids, the portal row, ring 2, the skyline and the landmarks. */
export const buildHubCity = (kit: CityKit): void => {
  const random = seeded(0x5b1d);
  const slack = 0.9;
  const ring1 = { min: 12, max: 22, depth: [24, 28] as [number, number], height: [44, 100] as [number, number] };

  // Back row, behind the eggs: nothing may stand off the facade behind the two boards.
  const boardSpan = BOARDS.width / 2 + 6;
  row(kit, random, 'x', HUB.minX - 28, HUB.maxX + 28, HUB.minZ - 1, 1, ring1, (x) => ({
    reach: BOARDS.xs.some((bx) => Math.abs(x - bx) < boardSpan + 11) ? 0 : slack,
  }));
  // Both side rows, fronting the plaza. The WEB TRAINING sign hangs on the +X side round z = 0.
  row(kit, random, 'z', HUB.minZ, HUB.maxZ + HUB_FRONT_WALL_DEPTH, HUB.maxX + 1, -1, ring1, (z) => ({ reach: Math.abs(z) < 34 ? 0 : slack }));
  row(kit, random, 'z', HUB.minZ, HUB.maxZ + HUB_FRONT_WALL_DEPTH, HUB.minX - 1, 1, ring1, () => ({ reach: slack }));

  // The portal wall: storefront buildings flush on its solid (4 deep), fronting the plaza,
  // shoulder to shoulder (a gap would show the stage street through the wall).
  const wallFront = HUB.maxZ;
  const portalRow = { min: 11, max: 18, depth: [HUB_FRONT_WALL_DEPTH, HUB_FRONT_WALL_DEPTH] as [number, number], height: [40, 58] as [number, number], gap: 0 };
  row(kit, random, 'x', HUB.minX, HUB_GATE.minX - 1.2, wallFront, -1, portalRow, () => ({ flush: true }));
  row(kit, random, 'x', HUB_GATE.maxX + 1.2, HUB.maxX, wallFront, -1, portalRow, () => ({ flush: true }));
  // Over the gate: a stone bridge building, the portal frame standing in front of it.
  const bridge = new Lot(kit, 0, wallFront + HUB_FRONT_WALL_DEPTH / 2, Math.PI);
  bridge.facade('stone', (HUB_GATE.maxX + 1.2) * 2 - 0.8, 40 - ARENA.portalHeight, HUB_FRONT_WALL_DEPTH, 0xd8c8a8, 0, ARENA.portalHeight, 0);
  bridge.box((HUB_GATE.maxX + 1.2) * 2 - 0.6, 0.8, HUB_FRONT_WALL_DEPTH + 0.2, 0xf4ecdc, 'smooth', 0, 40, 0);

  // Ring 2: taller towers over ring 1's roofs.
  const ring2 = { min: 16, max: 28, depth: [20, 30] as [number, number], height: [80, 160] as [number, number] };
  row(kit, random, 'x', HUB.minX - 90, HUB.maxX + 90, HUB.minZ - 36, 1, ring2, () => ({ detail: 'far' }));
  // (The side rows stop short of the stage street's city, which begins at the portal wall.)
  row(kit, random, 'z', HUB.minZ - 35, HUB.maxZ - 2, HUB.maxX + 36, -1, ring2, () => ({ detail: 'far' }));
  row(kit, random, 'z', HUB.minZ - 35, HUB.maxZ - 2, HUB.minX - 36, 1, ring2, () => ({ detail: 'far' }));

  // The skyline out in the haze: silhouettes all round, clear of the stage street's
  // corridor, the landmarks and each other.
  const taken: { x: number; z: number; r: number }[] = [
    { x: -290, z: -330, r: 40 },
    { x: 330, z: -300, r: 32 },
    { x: -420, z: 160, r: 40 },
  ];
  for (let i = 0; i < 240 && taken.length < 70; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 250 + random() * 300;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius - 40;
    const w = 18 + random() * 22;
    // Beside the stage street the city is built per arena, out to |x| 390.
    if (z > 20 && Math.abs(x) < 400 + w) continue;
    const r = w * 0.8;
    if (taken.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + r + 4)) continue;
    taken.push({ x, z, r });
    const lot = new Lot(kit, x, z, Math.round(random() * 4) * (Math.PI / 2));
    nycBuilding(lot, { w, d: w * (0.7 + random() * 0.5), h: 90 + random() * 150, detail: 'far', style: random() < 0.5 ? 'glass' : 'prewar' }, random);
  }
  empireState(kit, -290, -330, 1);
  chrysler(kit, 330, -300, 0.9);
  oneWorldTrade(kit, -420, 160, 1);
};

/**
 * The city down one arena's sides: a street-front row beyond the themed
 * scenery (x beyond +-152), taller towers behind, and now and then a very
 * tall one further out. Seeded by stage, so every client sees the same city.
 */
export const buildStageCity = (kit: CityKit, stage: number): void => {
  const random = seeded(stage * 7919 + 13);
  // Stage 1's blocks start behind the portal wall, where the plaza's city ends.
  const from = Math.max(arenaStartZ(stage) - ARENA.gateDepth / 2, HUB.maxZ + HUB_FRONT_WALL_DEPTH);
  const to = arenaEndZ(stage) + ARENA.gateDepth / 2;
  for (const side of [-1, 1] as const) {
    const front = side * 153;
    // The avenue in front of the city (clear of every themed landmark, which stays inside |x| 135):
    // asphalt, a dashed centre line, cars parked along the kerb.
    kit.trim.box(11.5, 0.1, to - from, 0x4a4e58, 'smooth', { x: side * 143.75, y: 0.05, z: (from + to) / 2 });
    for (let z = from + 3; z < to - 3; z += 9) kit.trim.box(0.35, 0.02, 4, 0xffd23a, 'smooth', { x: side * 143.75, y: 0.11, z });
    const onRoad = lifted(kit.trim, 0.1);
    for (let z = from + 6 + random() * 6; z < to - 6; z += 11 + random() * 14) {
      car(onRoad, side * 147.4, z, pick(random, CAR_COLORS), 0);
    }
    // The sidewalk the front row stands on: street lamps along its kerb, trees between them.
    kit.trim.box(4, 0.24, to - from, 0xb8bcc6, 'stud', { x: side * 151.5, y: 0.12, z: (from + to) / 2 });
    for (let z = from + 8; z < to; z += 26) {
      kit.trim.add(new CylinderGeometry(0.2, 0.28, 7, 6), 0x2a2e38, 'smooth', { x: side * 150.2, y: 3.74, z });
      kit.trim.box(1.4, 0.3, 0.5, 0x2a2e38, 'smooth', { x: side * 150.6, y: 7.2, z, ry: Math.PI / 2 });
      if (z + 13 < to - 2) tree(kit.trim, side * 150.8, z + 13, 0.7, 0x4fb83a, 0x6a4a2a, 0.24);
    }
    row(kit, random, 'z', from, to, front, side > 0 ? -1 : 1, { min: 12, max: 24, depth: [16, 26], height: [26, 110] }, () => ({ reach: 1.2 }));
    row(kit, random, 'z', from, to, side * 196, side > 0 ? -1 : 1, { min: 18, max: 30, depth: [22, 34], height: [90, 190] }, () => ({ detail: 'far' }));
    if (random() < 0.5) {
      const lot = new Lot(kit, side * (290 + random() * 80), (from + to) / 2, side > 0 ? -Math.PI / 2 : Math.PI / 2);
      nycBuilding(lot, { w: 30, d: 30, h: 200 + random() * 80, detail: 'far', style: random() < 0.5 ? 'glass' : 'prewar' }, random);
    }
  }
  // The city's ground between the rows, under the fog.
  for (const side of [-1, 1]) kit.trim.box(130, 0.2, to - from, 0x5c6270, 'smooth', { x: side * 218, y: 0.1, z: (from + to) / 2 });
};
