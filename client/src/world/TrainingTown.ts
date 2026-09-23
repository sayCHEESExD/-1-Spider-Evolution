import { BUILDINGS, BUILDING_HALF, TRAINING, TRAINING_STREETS, TRAINING_TOWN, type TownPiece } from '@spider/shared';
import { ConeGeometry, CylinderGeometry, SphereGeometry, type Group } from 'three';
import type { PartBuilder } from '../render/PartBuilder.js';
import { CityKit, type FacadeKind } from './NycBuildings.js';

/**
 * THE MINIATURE TOWN in the training district, drawn from `TRAINING_TOWN` and
 * `TRAINING_STREETS`: each tower in its own paved block, streets with
 * sidewalks, crosswalks and lane marks between the blocks, an avenue down the
 * middle; walk-ups, corner shops, parked cars, trees, lamps, hydrants and
 * traffic lights, every one of them exactly on its solid.
 *
 * Flat layers, each a hair above the last and never overlapping another in
 * the same layer: block paving, then asphalt and sidewalks, then markings.
 */
const FLOOR = TRAINING.floorTop;
const PAVING = FLOOR + 0.012;
const ROAD = FLOOR + 0.02;
const MARK = FLOOR + 0.028;

const MINI_TILE = 2.2;
const KINDS: readonly FacadeKind[] = ['brick', 'brick', 'stone', 'office'];
const BRICK = [0xb0583a, 0xc0704a, 0x9a4a36, 0xc89a78, 0x8a5a4a] as const;
const STONE = [0xece0cc, 0xd8c8a8, 0xe4d2b4] as const;
const OFFICE = [0xc4ccd8, 0xdcdce4, 0xacb8c8] as const;
const SIGN = [0xffd23a, 0x3dd6ff, 0xff4a8a, 0x7dff6a] as const;
const CARS = [0xffc81a, 0xd8202c, 0x2a5ad8, 0xffc81a, 0xf4f4f4, 0x3a8a4a, 0x2a2e38] as const;

const of = <T,>(list: readonly T[], i: number): T => list[((i % list.length) + list.length) % list.length]!;

/** A flat rectangle at `y`, by its edges. */
const flat = (b: PartBuilder, minX: number, maxX: number, minZ: number, maxZ: number, y: number, color: number): void => {
  b.box(maxX - minX, 0.01, maxZ - minZ, color, 'smooth', { x: (minX + maxX) / 2, y: y - 0.005, z: (minZ + maxZ) / 2 });
};

const drawStreets = (b: PartBuilder): void => {
  const { crossZ, avenueX, sidewalk } = TRAINING_STREETS;
  const [a0, a1] = avenueX;
  const asphalt = 0x4a4e58;
  const walk = 0xc6ccd6;

  // Each tower's block: pale paving from its front corner round to the walk-ups behind it.
  for (const place of BUILDINGS) flat(b, place.x - BUILDING_HALF - 1, place.x + 9.8, place.z - 7, place.z + 7, PAVING, 0xb4bcc8);

  // The avenue, full length, and its sidewalks in the stretches between the streets.
  flat(b, a0, a1, TRAINING.minZ, TRAINING.maxZ, ROAD, asphalt);
  const bands = crossZ.map(([z0, z1]) => [z0 - sidewalk, z1 + sidewalk] as const);
  let from: number = TRAINING.minZ;
  for (const [z0, z1] of [...bands, [TRAINING.maxZ, TRAINING.maxZ] as const]) {
    if (z0 > from) {
      flat(b, a0 - sidewalk, a0, from, z0, ROAD, walk);
      flat(b, a1, a1 + sidewalk, from, z0, ROAD, walk);
    }
    from = Math.max(from, z1);
  }
  // The cross streets either side of the avenue, each with its two sidewalks.
  for (const [z0, z1] of crossZ) {
    for (const [x0, x1] of [[TRAINING.minX, a0], [a1, TRAINING.maxX]] as const) {
      flat(b, x0, x1, z0, z1, ROAD, asphalt);
      flat(b, x0, x1, Math.max(TRAINING.minZ, z0 - sidewalk), z0, ROAD, walk);
      flat(b, x0, x1, z1, Math.min(TRAINING.maxZ, z1 + sidewalk), ROAD, walk);
      // Dashed centre line, stopping short of the crosswalks.
      for (let x = x0 + 2.5; x < x1 - 5; x += 3) b.box(1.4, 0.01, 0.18, 0xffd23a, 'smooth', { x: x + 0.7, y: MARK - 0.005, z: (z0 + z1) / 2 });
    }
    // Zebra crossings: across the street either side of the avenue (bars spanning the street),
    // and across the avenue just outside the intersection (bars spanning the avenue).
    for (let i = 0; i < 4; i += 1) {
      for (const x of [a0 - 1.2 - i * 0.8, a1 + 1.2 + i * 0.8]) b.box(0.45, 0.01, z1 - z0 - 0.5, 0xffffff, 'smooth', { x, y: MARK - 0.005, z: (z0 + z1) / 2 });
    }
    for (const [edge, dir] of [[z0 - sidewalk, -1], [z1 + sidewalk, 1]] as const) {
      if (edge + dir * 3 < TRAINING.minZ || edge + dir * 3 > TRAINING.maxZ) continue;
      for (let i = 0; i < 4; i += 1) b.box(a1 - a0 - 0.5, 0.01, 0.4, 0xffffff, 'smooth', { x: (a0 + a1) / 2, y: MARK - 0.005, z: edge + dir * (0.5 + i * 0.7) });
    }
  }
  // The avenue's centre line.
  for (let z = TRAINING.minZ + 1; z < TRAINING.maxZ - 1; z += 3) {
    if (crossZ.some(([z0, z1]) => z + 1.4 > z0 - 4 && z < z1 + 4)) continue;
    b.box(0.18, 0.01, 1.4, 0xffd23a, 'smooth', { x: (a0 + a1) / 2, y: MARK - 0.005, z: z + 0.7 });
  }
};

/** Which way a piece faces the street: walk-ups behind a tower face +X, corner shops face out of their block. */
const frontOf = (piece: TownPiece): { nx: number; nz: number } => {
  if (piece.variant >= 20) {
    const block = BUILDINGS[piece.variant - 20];
    return { nx: 0, nz: block && piece.z < block.z ? -1 : 1 };
  }
  return { nx: 1, nz: 0 };
};

const building = (kit: CityKit, piece: TownPiece): void => {
  const kind = of(KINDS, piece.variant);
  const color = kind === 'brick' ? of(BRICK, piece.variant * 7) : kind === 'stone' ? of(STONE, piece.variant) : of(OFFICE, piece.variant);
  kit.facade(kind, piece.w, piece.h, piece.d, color, piece.x, FLOOR + piece.h / 2, piece.z, 0, MINI_TILE);
  const t = kit.trim;
  // The roof line: a cornice slightly proud of the walls, its top a hair over the roof
  // (the roof is walkable, so nothing else stands on it).
  t.box(piece.w + 0.14, 0.2, piece.d + 0.14, kind === 'brick' ? 0xe0d6c6 : 0x8a909c, 'smooth', { x: piece.x, y: FLOOR + piece.h - 0.08, z: piece.z });
  // A shopfront on the street side: dark glass, a lit sign band over it.
  const { nx, nz } = frontOf(piece);
  const along = nx !== 0 ? piece.d : piece.w;
  const fx = piece.x + nx * (piece.w / 2 + 0.02);
  const fz = piece.z + nz * (piece.d / 2 + 0.02);
  const size = (a: number, h: number, depth: number): [number, number, number] => (nx !== 0 ? [depth, h, a] : [a, h, depth]);
  t.box(...size(along * 0.8, 0.8, 0.04), 0x2a3448, 'smooth', { x: fx, y: FLOOR + 0.5, z: fz });
  t.box(...size(along * 0.6, 0.18, 0.05), of(SIGN, piece.variant), 'glow', { x: fx + nx * 0.005, y: FLOOR + 1.05, z: fz + nz * 0.005 });
};

const car = (t: PartBuilder, piece: TownPiece): void => {
  const long = piece.w > piece.d;
  const len = long ? piece.w : piece.d;
  const wid = long ? piece.d : piece.w;
  const size = (a: number, h: number, c: number): [number, number, number] => (long ? [a, h, c] : [c, h, a]);
  const color = of(CARS, piece.variant);
  t.box(...size(len, 0.36, wid), color, 'smooth', { x: piece.x, y: FLOOR + 0.3, z: piece.z });
  t.box(...size(len * 0.52, 0.28, wid * 0.86), 0x9fc8ec, 'smooth', { x: piece.x, y: FLOOR + 0.62, z: piece.z });
  t.box(...size(len * 0.5, 0.04, wid * 0.8), color, 'smooth', { x: piece.x, y: FLOOR + 0.78, z: piece.z });
  if (color === 0xffc81a) t.box(...size(0.2, 0.05, 0.3), 0xffffff, 'glow', { x: piece.x, y: FLOOR + 0.825, z: piece.z });
  for (const a of [-1, 1]) {
    for (const c of [-1, 1]) {
      const [ox, oz] = long ? [a * len * 0.3, c * (wid / 2 - 0.08)] : [c * (wid / 2 - 0.08), a * len * 0.3];
      t.add(new CylinderGeometry(0.16, 0.16, 0.14, 10), 0x14151c, 'smooth', { x: piece.x + ox, y: FLOOR + 0.16, z: piece.z + oz, rx: long ? Math.PI / 2 : 0, rz: long ? 0 : Math.PI / 2 });
    }
  }
};

const piece = (kit: CityKit, p: TownPiece): void => {
  const t = kit.trim;
  switch (p.kind) {
    case 'building':
      building(kit, p);
      break;
    case 'car':
      car(t, p);
      break;
    case 'tree':
      t.box(0.5, 0.2, 0.5, 0x8a8f9c, 'smooth', { x: p.x, y: FLOOR + 0.1, z: p.z });
      t.add(new CylinderGeometry(0.1, 0.13, 1, 6), 0x6a4a2a, 'smooth', { x: p.x, y: FLOOR + 0.6, z: p.z });
      t.add(new SphereGeometry(0.75, 10, 8), 0x4fb83a, 'smooth', { x: p.x, y: FLOOR + 1.6, z: p.z });
      t.add(new SphereGeometry(0.48, 10, 8), 0x62c84a, 'smooth', { x: p.x + 0.2, y: FLOOR + 2.1, z: p.z - 0.15 });
      break;
    case 'lamp':
      t.add(new CylinderGeometry(0.07, 0.1, 2.4, 6), 0x2a2e38, 'smooth', { x: p.x, y: FLOOR + 1.2, z: p.z });
      t.box(0.3, 0.1, 0.14, 0x2a2e38, 'smooth', { x: p.x, y: FLOOR + 2.42, z: p.z });
      t.add(new SphereGeometry(0.1, 8, 6), 0xfff1b0, 'glow', { x: p.x, y: FLOOR + 2.32, z: p.z });
      break;
    case 'hydrant':
      t.add(new CylinderGeometry(0.15, 0.17, 0.38, 8), 0xd8202c, 'smooth', { x: p.x, y: FLOOR + 0.19, z: p.z });
      t.add(new SphereGeometry(0.15, 8, 6), 0xd8202c, 'smooth', { x: p.x, y: FLOOR + 0.38, z: p.z });
      t.box(0.4, 0.08, 0.08, 0xb8141e, 'smooth', { x: p.x, y: FLOOR + 0.26, z: p.z });
      break;
    case 'light': {
      t.add(new CylinderGeometry(0.06, 0.08, 2.2, 6), 0x2a2e38, 'smooth', { x: p.x, y: FLOOR + 1.1, z: p.z });
      t.box(0.26, 0.62, 0.26, 0x1a1c22, 'smooth', { x: p.x, y: FLOOR + 2.46, z: p.z });
      [0xff3a3a, 0xffc83a, 0x3dff6e].forEach((color, i) => {
        for (const side of [-1, 1]) t.box(0.14, 0.14, 0.02, color, 'glow', { x: p.x, y: FLOOR + 2.64 - i * 0.18, z: p.z + side * 0.14 });
      });
      t.box(0.02, 0.1, 0.28, 0x1a7a3a, 'glow', { x: p.x + 0.14, y: FLOOR + 2.0, z: p.z });
      break;
    }
  }
};

/** The whole town, merged. */
export const buildTrainingTown = (): Group => {
  const kit = new CityKit();
  drawStreets(kit.trim);
  for (const p of TRAINING_TOWN) piece(kit, p);
  return kit.build('training-town', true);
};
