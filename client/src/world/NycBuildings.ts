import {
  BoxGeometry,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  type BufferGeometry,
} from 'three';
import { PartBuilder, type PartKind } from '../render/PartBuilder.js';
import { facadeBox } from './CityProps.js';
import { worldScaledUv } from './texturedBox.js';

/**
 * NEW YORK, BUILT FROM BOXES.
 *
 * One generator for every building outside the playable space - the plaza's
 * walls, the skyline behind them, the blocks down the stage street and the
 * miniature town round the training towers. Four facades, each ONE canvas
 * texture tinted per building by vertex colour:
 *
 *   brick   pre-war walk-ups: brick courses, white-framed sash windows
 *   stone   Art Deco and pre-war towers: tall paired windows between piers
 *   glass   curtain-wall skyscrapers: blue panes, silver mullions
 *   office  mid-century blocks: ribbon windows over pale spandrels
 *
 * and a style for each (walk-up, pre-war tower, glass tower, office block),
 * varied by seed - setbacks, cornices, crowns, spires, water towers, fire
 * escapes, storefronts with awnings and signs, rooftop billboards, antennas.
 * Everything merges into a handful of meshes per `CityKit`.
 */
export type FacadeKind = 'brick' | 'stone' | 'glass' | 'office';

const FACADE_KINDS: readonly FacadeKind[] = ['brick', 'stone', 'glass', 'office'];

/** World units one repeat of each facade covers (two storeys, two bays). */
const TILE: Readonly<Record<FacadeKind, number>> = { brick: 7, stone: 8, glass: 9, office: 7 };

const SIZE = 128;

const paint = (draw: (ctx: CanvasRenderingContext2D) => void): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  draw(canvas.getContext('2d')!);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
};

/** A dark pane with a sky reflection across its upper corner. */
const pane = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dark: string, light: string): void => {
  ctx.fillStyle = dark;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w * 0.7, y);
  ctx.lineTo(x, y + h * 0.55);
  ctx.closePath();
  ctx.fill();
};

const PAINTERS: Readonly<Record<FacadeKind, (ctx: CanvasRenderingContext2D) => void>> = {
  brick: (ctx) => {
    ctx.fillStyle = '#efe6df';
    ctx.fillRect(0, 0, SIZE, SIZE);
    // Brick courses: every 6px a mortar line, the joints staggered.
    ctx.fillStyle = '#d6cbc2';
    for (let y = 0; y < SIZE; y += 6) {
      ctx.fillRect(0, y, SIZE, 1);
      for (let x = (y / 6) % 2 ? 0 : 7; x < SIZE; x += 14) ctx.fillRect(x, y, 1, 6);
    }
    for (const gx of [14, 78]) {
      for (const gy of [10, 74]) {
        ctx.fillStyle = '#c9bdb2';
        ctx.fillRect(gx - 3, gy - 4, 42, 4); // lintel
        ctx.fillStyle = '#fbfaf8';
        ctx.fillRect(gx - 2, gy, 40, 44); // frame
        pane(ctx, gx + 2, gy + 3, 32, 17, '#2c3548', '#5c6e8e');
        pane(ctx, gx + 2, gy + 23, 32, 17, '#2c3548', '#4c5c7a');
        ctx.fillStyle = '#d8cfc6';
        ctx.fillRect(gx - 4, gy + 44, 44, 4); // sill
      }
    }
  },
  stone: (ctx) => {
    ctx.fillStyle = '#f3ede3';
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = '#e2d9cb';
    for (let y = 0; y < SIZE; y += 16) ctx.fillRect(0, y, SIZE, 1);
    for (const gx of [8, 72]) {
      for (const gy of [6, 70]) {
        for (const off of [0, 26]) pane(ctx, gx + off, gy, 20, 46, '#303a4e', '#62728e');
        ctx.fillStyle = '#d4c8b6';
        ctx.fillRect(gx - 2, gy + 48, 50, 8); // spandrel
        ctx.fillStyle = '#c4b6a0';
        for (let i = 0; i < 5; i += 1) ctx.fillRect(gx + 2 + i * 10, gy + 50, 5, 4);
      }
    }
    ctx.fillStyle = '#e8dfd2';
    for (const px of [0, 64]) ctx.fillRect(px, 0, 5, SIZE); // piers
  },
  glass: (ctx) => {
    const g = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    g.addColorStop(0, '#6f8fb4');
    g.addColorStop(0.5, '#a9c4df');
    g.addColorStop(1, '#5d7ea6');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.beginPath();
    ctx.moveTo(0, SIZE * 0.35);
    ctx.lineTo(SIZE * 0.35, 0);
    ctx.lineTo(SIZE * 0.55, 0);
    ctx.lineTo(0, SIZE * 0.55);
    ctx.fill();
    ctx.fillStyle = '#e6edf5';
    for (let x = 0; x < SIZE; x += 32) ctx.fillRect(x, 0, 3, SIZE);
    for (let y = 0; y < SIZE; y += 32) ctx.fillRect(0, y, SIZE, 4);
  },
  office: (ctx) => {
    ctx.fillStyle = '#eef0f3';
    ctx.fillRect(0, 0, SIZE, SIZE);
    for (const gy of [10, 74]) {
      pane(ctx, 0, gy, SIZE, 30, '#34425a', '#6a7c9a');
      ctx.fillStyle = '#dde2e8';
      for (let x = 0; x < SIZE; x += 16) ctx.fillRect(x, gy, 2, 30);
      ctx.fillStyle = '#c9ced6';
      ctx.fillRect(0, gy + 30, SIZE, 3);
    }
  },
};

let materials: Record<FacadeKind, MeshLambertMaterial> | null = null;

/** The four facade materials, shared by every kit. */
const facadeMaterials = (): Record<FacadeKind, MeshLambertMaterial> => {
  if (!materials) {
    materials = {} as Record<FacadeKind, MeshLambertMaterial>;
    for (const kind of FACADE_KINDS) materials[kind] = new MeshLambertMaterial({ map: paint(PAINTERS[kind]), vertexColors: true });
  }
  return materials;
};

/**
 * A bag of city geometry: facade boxes by kind, plus trim (cornices, fire
 * escapes, awnings, water towers...) in a `PartBuilder`. `build()` merges it
 * into at most seven meshes.
 */
export class CityKit {
  readonly trim = new PartBuilder();
  private readonly facades: Record<FacadeKind, PartBuilder> = { brick: new PartBuilder(), stone: new PartBuilder(), glass: new PartBuilder(), office: new PartBuilder() };

  /** A facade box by size and centre; `tile` shrinks the windows (the miniature town). */
  facade(kind: FacadeKind, w: number, h: number, d: number, color: number, x: number, y: number, z: number, ry = 0, tile = TILE[kind]): void {
    this.facades[kind].add(facadeBox(w, h, d, tile), color, 'smooth', { x, y, z, ry });
  }

  /** Any geometry wearing a facade (its UVs already world-scaled). */
  facadeGeometry(kind: FacadeKind, geometry: BufferGeometry, color: number, x: number, y: number, z: number, ry = 0): void {
    this.facades[kind].add(geometry, color, 'smooth', { x, y, z, ry });
  }

  build(name: string, castShadow = false): Group {
    const group = new Group();
    group.name = name;
    const shared = facadeMaterials();
    for (const kind of FACADE_KINDS) {
      const geometry = this.facades[kind].geometries().smooth;
      if (!geometry) continue;
      const mesh = new Mesh(geometry, shared[kind]);
      mesh.name = `${name}-${kind}`;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    if (!this.trim.isEmpty) group.add(this.trim.build(`${name}-trim`, castShadow));
    return group;
  }
}

/**
 * A building lot: a local frame whose +Z is the street the building fronts.
 * `ry` turns it (0 fronts +Z, PI fronts -Z, PI/2 fronts +X, -PI/2 fronts -X).
 */
export class Lot {
  private readonly c: number;
  private readonly s: number;

  constructor(
    readonly kit: CityKit,
    readonly x: number,
    readonly z: number,
    readonly ry: number,
    /** The ground the lot stands on. */
    readonly y = 0,
  ) {
    this.c = Math.cos(ry);
    this.s = Math.sin(ry);
  }

  private wx(lx: number, lz: number): number {
    return this.x + lx * this.c + lz * this.s;
  }

  private wz(lx: number, lz: number): number {
    return this.z - lx * this.s + lz * this.c;
  }

  /** A facade box; `y` is its base. */
  facade(kind: FacadeKind, w: number, h: number, d: number, color: number, lx: number, y: number, lz: number, tile?: number): void {
    this.kit.facade(kind, w, h, d, color, this.wx(lx, lz), this.y + y + h / 2, this.wz(lx, lz), this.ry, tile);
  }

  /** A trim box; `y` is its base. */
  box(w: number, h: number, d: number, color: number, kind: PartKind, lx: number, y: number, lz: number, rx = 0, rz = 0): void {
    this.kit.trim.box(w, h, d, color, kind, { x: this.wx(lx, lz), y: this.y + y + h / 2, z: this.wz(lx, lz), ry: this.ry, rx, rz });
  }

  /** Any trim geometry, centred at (lx, y, lz). */
  add(geometry: BufferGeometry, color: number, kind: PartKind, lx: number, y: number, lz: number, ry = 0): void {
    this.kit.trim.add(geometry, color, kind, { x: this.wx(lx, lz), y: this.y + y, z: this.wz(lx, lz), ry: this.ry + ry });
  }

  /** Any facade-wearing geometry, centred at (lx, y, lz). */
  facadeGeometry(kind: FacadeKind, geometry: BufferGeometry, color: number, lx: number, y: number, lz: number, ry = 0): void {
    this.kit.facadeGeometry(kind, geometry, color, this.wx(lx, lz), this.y + y, this.wz(lx, lz), this.ry + ry);
  }
}

// ------------------------------------------------------------ palettes

const BRICK = [0xb0583a, 0x9a4a36, 0xc0704a, 0x8a4a3e, 0xa8684e, 0xc89a78, 0x7a4636, 0xb87a5a] as const;
const STONE = [0xece0cc, 0xd8c8a8, 0xcfc6b6, 0xe4d2b4, 0xbfb4a0, 0xd8b890] as const;
const GLASS = [0xa8ccf0, 0x86b0dc, 0xb0d0dc, 0x92c0cc, 0xc0d4ec, 0x9ab4d8] as const;
const OFFICE = [0xdcdce4, 0xc4ccd8, 0xe4dccc, 0xacb8c8, 0xd4c8b8] as const;
const AWNING = [0x1a6a3a, 0xc81a2a, 0x1a3a8a, 0x2a2a34, 0x8a1a4a, 0xd87a1a] as const;
const SIGN = [0xffd23a, 0x3dd6ff, 0xff4a8a, 0x7dff6a, 0xff8a1a, 0xffffff] as const;
const BILLBOARD = [0xff2e6a, 0x2ea8ff, 0xffd23a, 0x7a3aff, 0x2ee88a] as const;
const IRON = 0x2a2c34;

const pick = <T,>(random: () => number, list: readonly T[]): T => list[Math.floor(random() * list.length) % list.length]!;

/** How much a building carries: `full` up close, `far` for silhouettes past the fog line. */
export type Detail = 'full' | 'far';

export interface BuildingSpec {
  /** Frontage (local x) and depth (local z). */
  readonly w: number;
  readonly d: number;
  readonly h: number;
  readonly style?: 'walkup' | 'prewar' | 'glass' | 'office';
  readonly detail?: Detail;
  /** No fire escapes, awnings or anything else standing off the front face. */
  readonly flush?: boolean;
  /** How far trim may stand off the front face (a wall solid's slack). */
  readonly reach?: number;
}

/** A New York building on a lot, fronting the lot's +Z. */
export const nycBuilding = (lot: Lot, spec: BuildingSpec, random: () => number): void => {
  const style =
    spec.style ??
    (spec.h < 30
      ? 'walkup'
      : spec.h < 60
        ? pick(random, ['walkup', 'walkup', 'office', 'prewar', 'prewar'] as const)
        : pick(random, ['prewar', 'prewar', 'glass', 'glass', 'glass', 'office', 'walkup'] as const));
  const detail = spec.detail ?? 'full';
  const reach = spec.flush ? 0 : Math.min(spec.reach ?? 1.2, 1.2);
  switch (style) {
    case 'walkup':
      walkup(lot, spec, random, detail, reach);
      break;
    case 'prewar':
      prewar(lot, spec, random, detail, reach);
      break;
    case 'glass':
      glassTower(lot, spec, random, detail, reach);
      break;
    default:
      officeBlock(lot, spec, random, detail, reach);
  }
};

/** A shopfront across the ground floor: glass, a sign band, and an awning when there is room. */
const storefront = (lot: Lot, w: number, d: number, random: () => number, reach: number): void => {
  const front = d / 2;
  const face = w * 0.86;
  lot.box(face, 3, 0.1, 0x1e2634, 'smooth', 0, 0.2, front + 0.05);
  lot.box(face * 0.94, 2.4, 0.12, 0x4a6488, 'smooth', 0, 0.45, front + 0.07);
  for (let i = 1; i < 4; i += 1) lot.box(0.18, 2.6, 0.16, 0xd8dce4, 'smooth', -face / 2 + (face / 4) * i, 0.3, front + 0.09);
  lot.box(face, 0.9, 0.14, 0x14151c, 'smooth', 0, 3.3, front + 0.07);
  lot.box(face * 0.7, 0.5, 0.16, pick(random, SIGN), 'glow', 0, 3.5, front + 0.09);
  if (reach >= 0.8) {
    const color = pick(random, AWNING);
    const depth = Math.min(reach, 1.2) - 0.05;
    lot.box(face * 0.96, 0.18, depth, color, 'smooth', 0, 4.35, front + depth / 2, 0.22);
    lot.box(face * 0.96, 0.35, 0.08, color, 'smooth', 0, 4.05, front + depth - 0.04);
  }
};

/** A zig-zag fire escape up the front, one landing a storey. */
const fireEscape = (lot: Lot, x: number, from: number, to: number, d: number, reach: number): void => {
  const out = Math.min(reach, 1.1);
  const front = d / 2;
  let flip = 1;
  for (let y = from; y < to; y += 3.5) {
    lot.box(3.6, 0.12, out - 0.05, IRON, 'smooth', x, y, front + out / 2);
    lot.box(3.6, 0.8, 0.07, IRON, 'smooth', x, y + 0.12, front + out - 0.08);
    for (const side of [-1, 1]) lot.box(0.07, 0.8, out - 0.1, IRON, 'smooth', x + side * 1.77, y + 0.12, front + out / 2);
    if (y + 3.5 < to) lot.box(0.1, 3.9, 0.12, IRON, 'smooth', x + flip * 0.7, y + 0.1, front + out * 0.55, 0, flip * 0.62);
    flip = -flip;
  }
};

/** A rooftop water tower: timber tank, iron bands, a pointed cap, four legs. */
const waterTower = (lot: Lot, x: number, z: number, top: number, s = 1): void => {
  for (const [lx, lz] of [[-1, -1], [1, 1], [-1, 1], [1, -1]] as const) lot.box(0.28 * s, 2 * s, 0.28 * s, IRON, 'smooth', x + lx * 1.1 * s, top, z + lz * 1.1 * s);
  lot.add(new CylinderGeometry(1.6 * s, 1.6 * s, 3 * s, 12), 0x8a5a36, 'smooth', x, top + 3.5 * s, z);
  for (let i = 0; i < 3; i += 1) lot.add(new CylinderGeometry(1.64 * s, 1.64 * s, 0.1 * s, 12), 0x3a3a44, 'smooth', x, top + (2.4 + i * 1.1) * s, z);
  lot.add(new ConeGeometry(1.75 * s, 1.3 * s, 12), 0x4a3426, 'smooth', x, top + 5.65 * s, z);
};

/** Rooftop clutter: a stair bulkhead and a couple of vents. */
/** Rooftop clutter: a stair bulkhead on one half of the roof, two vents on the other (never touching). */
const roofClutter = (lot: Lot, w: number, d: number, top: number, random: () => number, lz = 0): void => {
  const side = random() < 0.5 ? -1 : 1;
  lot.box(Math.min(3, w * 0.3), 2.2, Math.min(3, d * 0.3), 0x8a8a94, 'smooth', side * w * 0.22, top, lz - d * 0.15);
  for (const vz of [-0.22, 0.22]) lot.box(1, 0.9, 1, 0x9aa0aa, 'smooth', -side * w * 0.25, top, lz + vz * d);
};

/** A cornice ON the roof line (its base at `top`), overhanging the street by up to half a unit, and a band below it. */
const cornice = (lot: Lot, w: number, d: number, top: number, color: number, reach: number, lz = 0): void => {
  const lip = Math.min(0.5, reach * 0.5);
  lot.box(w + 0.2, 0.8, d + 0.2 + lip, color, 'smooth', 0, top, lz + lip / 2);
  lot.box(w + 0.16, 0.3, d + 0.16, color, 'smooth', 0, top - 1.3, lz);
};

const walkup = (lot: Lot, spec: BuildingSpec, random: () => number, detail: Detail, reach: number): void => {
  const { w, d, h } = spec;
  const color = pick(random, BRICK);
  // Tall ones are pre-war brick apartment towers: the street wall, then a setback penthouse block.
  const street = h > 45 ? Math.round(h * 0.72) : h;
  const roof = h > 45 ? { w: w * 0.7, d: d * 0.7, z: -d * 0.15 } : { w, d, z: 0 };
  lot.facade('brick', w, street, d, color, 0, 0, 0);
  if (street < h) lot.facade('brick', roof.w, h - street, roof.d, color, 0, street, roof.z);
  if (detail === 'far') return;
  cornice(lot, w, d, street, 0xd8cfc0, reach);
  if (street < h) cornice(lot, roof.w, roof.d, h, 0xd8cfc0, 0, roof.z);
  storefront(lot, w, d, random, reach);
  if (reach >= 0.6 && street > 10 && random() < 0.75) fireEscape(lot, (random() < 0.5 ? -1 : 1) * Math.max(0, w / 2 - 3), 5.4, street - 1.5, d, reach);
  if (random() < 0.55) waterTower(lot, (random() - 0.5) * roof.w * 0.4, roof.z + (random() - 0.5) * roof.d * 0.3, h + 0.8, Math.min(1, roof.w / 9));
  else roofClutter(lot, roof.w, roof.d, h + 0.8, random, roof.z);
};

const prewar = (lot: Lot, spec: BuildingSpec, random: () => number, detail: Detail, reach: number): void => {
  const { w, d, h } = spec;
  const color = pick(random, STONE);
  const trim = 0xf4ecdc;
  // Two or three setbacks, the classic wedding-cake massing.
  const tiers = h > 70 ? 3 : 2;
  const split = tiers === 3 ? [0.55, 0.25, 0.2] : [0.7, 0.3];
  let y = 0;
  let tw = w;
  let td = d;
  for (let i = 0; i < tiers; i += 1) {
    const th = h * split[i]!;
    // The street wall stays on the lot line; upper tiers step back from it.
    const lz = (d - td) / 2 > 0 ? -(d - td) / 2 : 0;
    lot.facade('stone', tw, th, td, color, 0, y, lz);
    if (detail === 'full') lot.box(tw + 0.3, 0.5, td + 0.3, trim, 'smooth', 0, y + th - 0.5, lz);
    y += th;
    tw *= 0.72;
    td *= 0.72;
  }
  if (detail === 'full') storefront(lot, w, d, random, reach);
  // The crown.
  const lz = -(d - td / 0.72) / 2;
  const crown = random();
  if (crown < 0.4) {
    // A stepped pyramid with a flagpole.
    lot.add(new ConeGeometry(tw * 0.8, tw * 0.9, 4), 0x5f8a7a, 'smooth', 0, y + tw * 0.45, lz, Math.PI / 4);
    lot.add(new CylinderGeometry(0.1, 0.12, 5, 5), 0xdfe6ee, 'smooth', 0, y + tw * 0.9 + 2.5, lz);
  } else if (crown < 0.75) {
    // A Chrysler-style sunburst: stacked narrowing drums, then a needle.
    for (let i = 0; i < 4; i += 1) lot.add(new CylinderGeometry(tw * (0.5 - i * 0.1), tw * (0.58 - i * 0.1), 2.4, 8), i % 2 ? 0xd8dce4 : 0xb8c0cc, 'smooth', 0, y + 1.2 + i * 2.4, lz);
    lot.add(new ConeGeometry(tw * 0.14, 9, 8), 0xe8eef5, 'smooth', 0, y + 14.1, lz);
  } else {
    // A mansard cap with a lantern.
    lot.facade('stone', tw * 0.7, 4, td * 0.7, color, 0, y, lz);
    lot.add(new ConeGeometry(tw * 0.55, 3, 4), 0x4a6a6a, 'smooth', 0, y + 5.5, lz, Math.PI / 4);
  }
};

const glassTower = (lot: Lot, spec: BuildingSpec, random: () => number, detail: Detail, reach: number): void => {
  const { w, d, h } = spec;
  const color = pick(random, GLASS);
  const notch = random() < 0.5;
  const low = notch ? h * 0.62 : h;
  lot.facade('glass', w, low, d, color, 0, 0, 0);
  let top = low;
  let tw = w;
  let td = d;
  let ox = 0;
  let oz = 0;
  if (notch) {
    tw = w * 0.74;
    td = d * 0.74;
    ox = ((w - tw) / 2) * (random() < 0.5 ? -1 : 1);
    oz = -(d - td) / 2;
    lot.facade('glass', tw, h - low, td, color, ox, low, oz);
    top = h;
    if (detail === 'full') lot.box(w + 0.2, 0.4, d + 0.2, 0xe6edf5, 'smooth', 0, low, 0);
  }
  if (detail === 'full') {
    lot.box(w + 0.1, 3.4, d + 0.1, 0x2a3040, 'smooth', 0, 0, 0);
    lot.box(w * 0.8, 2.6, 0.1, 0x7ab0e0, 'glow', 0, 0.3, d / 2 + 0.06);
    if (reach > 0) lot.box(w * 0.5, 0.25, Math.min(reach, 1) - 0.05, 0xe6edf5, 'smooth', 0, 3.6, d / 2 + Math.min(reach, 1) / 2);
  }
  // A crown of light, the plant room and a mast.
  // Glow is unfogged: past the fog line the crown is only a pale band.
  const light = detail === 'far' ? 'smooth' : 'glow';
  lot.box(tw + 0.12, 0.6, td + 0.12, 0xbfe6ff, light, ox, top - 1.4, oz);
  lot.box(tw * 0.5, 3, td * 0.5, 0x6a7384, 'smooth', ox, top, oz);
  if (random() < 0.7) {
    const mast = 8 + random() * 14;
    lot.add(new CylinderGeometry(0.15, 0.35, mast, 6), 0xdfe6ee, 'smooth', ox, top + 3 + mast / 2, oz);
    lot.add(new BoxGeometry(0.5, 0.5, 0.5), 0xff3a3a, light, ox, top + 3 + mast, oz);
  }
};

const officeBlock = (lot: Lot, spec: BuildingSpec, random: () => number, detail: Detail, reach: number): void => {
  const { w, d, h } = spec;
  const color = pick(random, OFFICE);
  lot.facade('office', w, h, d, color, 0, 0, 0);
  if (detail === 'far') return;
  const ledge = 10 + Math.floor(random() * 3) * 4;
  for (let y = ledge; y < h - 3; y += ledge) lot.box(w + 0.3, 0.35, d + 0.3, 0xb8bec8, 'smooth', 0, y, 0);
  if (random() < 0.5) {
    // Vertical fins up the street face, the other half of the city's office blocks.
    const fin = random() < 0.5 ? 0xe8ecf2 : 0x5a6272;
    for (let x = -w / 2 + 1.6; x < w / 2 - 1; x += 3.2) lot.box(0.35, h - 4.4, 0.3, fin, 'smooth', x, 4.2, d / 2 + 0.15);
  }
  lot.box(w + 0.5, 0.9, d + 0.5, 0x8a909c, 'smooth', 0, h, 0);
  storefront(lot, w, d, random, reach);
  roofClutter(lot, w, d, h + 0.9, random);
  if (random() < 0.45 && w > 10) {
    // A rooftop billboard on two legs.
    const bw = Math.min(w * 0.8, 16);
    for (const side of [-1, 1]) lot.box(0.4, 3, 0.4, IRON, 'smooth', side * bw * 0.35, h + 0.9, 0);
    lot.box(bw, bw * 0.4, 0.4, 0x14151c, 'smooth', 0, h + 3.9, 0);
    lot.box(bw * 0.92, bw * 0.34, 0.1, pick(random, BILLBOARD), 'glow', 0, h + 3.9 + bw * 0.03, 0.22);
    lot.box(bw * 0.5, bw * 0.08, 0.12, 0xffffff, 'glow', -bw * 0.1, h + 3.9 + bw * 0.22, 0.24);
  }
};

// ------------------------------------------------------------ landmarks

/** The Empire State: five setbacks, the mooring mast and the needle. */
export const empireState = (kit: CityKit, x: number, z: number, s = 1): void => {
  const lot = new Lot(kit, x, z, 0);
  const color = 0xd8ccb4;
  const tiers: readonly (readonly [number, number, number])[] = [
    [44, 18, 44],
    [34, 70, 30],
    [26, 90, 22],
    [18, 22, 16],
    [12, 14, 11],
  ];
  let y = 0;
  for (const [w, h, d] of tiers) {
    lot.facade('stone', w * s, h * s, d * s, color, 0, y, 0);
    y += h * s;
  }
  lot.add(new CylinderGeometry(3.4 * s, 4.6 * s, 14 * s, 8), 0xe8e0cc, 'smooth', 0, y + 7 * s, 0);
  lot.add(new CylinderGeometry(0.5 * s, 1.4 * s, 30 * s, 6), 0xdfe6ee, 'smooth', 0, y + 29 * s, 0);
  lot.box(12.4 * s, 1.4 * s, 11.4 * s, 0xf4e8c4, 'smooth', 0, y - 4 * s, 0);
};

/** The Chrysler: a slim stone shaft, the stainless sunburst crown and spire. */
export const chrysler = (kit: CityKit, x: number, z: number, s = 1): void => {
  const lot = new Lot(kit, x, z, 0);
  lot.facade('stone', 30 * s, 60 * s, 30 * s, 0xd8d0c4, 0, 0, 0);
  lot.facade('stone', 22 * s, 110 * s, 22 * s, 0xd0c8bc, 0, 60 * s, 0);
  const top = 170 * s;
  for (let i = 0; i < 6; i += 1) {
    lot.add(new CylinderGeometry((9 - i * 1.4) * s, (10.6 - i * 1.4) * s, 7 * s, 8), i % 2 ? 0xe8eef5 : 0xb8c4d0, 'smooth', 0, top + (3.5 + i * 7) * s, 0);
    lot.box((12 - i * 1.8) * s, 0.8 * s, 0.4 * s, 0xfff4d8, 'smooth', 0, top + (3 + i * 7) * s, (9.2 - i * 1.4) * s);
  }
  lot.add(new ConeGeometry(1.6 * s, 34 * s, 8), 0xf4f8fc, 'smooth', 0, top + 59 * s, 0);
};

/** One World Trade: a square tower tapering to a point on its corners, and the antenna. */
export const oneWorldTrade = (kit: CityKit, x: number, z: number, s = 1): void => {
  const lot = new Lot(kit, x, z, 0);
  lot.facade('glass', 42 * s, 26 * s, 42 * s, 0x9ab8d8, 0, 0, 0);
  const h = 230 * s;
  const shaft = worldScaledUv(new CylinderGeometry(15 * s, 29 * s, h, 4, 1), 4 * 42 * s, h, 9);
  lot.facadeGeometry('glass', shaft, 0xa8c8e8, 0, 26 * s + h / 2, 0, Math.PI / 4);
  lot.box(18 * s, 5 * s, 18 * s, 0xdfe6ee, 'smooth', 0, 26 * s + h, 0);
  lot.add(new CylinderGeometry(0.6 * s, 1.6 * s, 70 * s, 6), 0xf4f8fc, 'smooth', 0, 26 * s + h + 5 * s + 35 * s, 0);
  lot.box(1.4 * s, 1.4 * s, 1.4 * s, 0xff3a3a, 'smooth', 0, 26 * s + h + 75 * s, 0);
};
