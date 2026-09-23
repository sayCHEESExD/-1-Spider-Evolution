import { ARENA, arenaEndZ, arenaPropSpots, arenaStartZ, returnPadOf, rewardPadOf, type StageTheme } from '@spider/shared';
import { BoxGeometry, ConeGeometry, CylinderGeometry, OctahedronGeometry, SphereGeometry, TorusGeometry } from 'three';
import type { PartBuilder } from '../render/PartBuilder.js';
import { seeded } from './CityProps.js';
import * as $ from './Props.js';
import { Place, lifted, type PropFn } from './Props.js';

/**
 * ENVIRONMENTAL STORYTELLING FOR EVERY STAGE. Each theme says what stands
 * just beyond the barrier (`near`), what fills the skyline (`far`), the one
 * landmark that names the place, what is piled in the six foreground corners
 * inside the arena (on their solid footprints), and what is painted or spilled
 * on the floor (walkable decals). The fight in the middle stays open.
 */
interface Dressing {
  readonly near: readonly PropFn[];
  readonly far: readonly PropFn[];
  readonly corner: readonly PropFn[];
  /** The corner footprint's base: pallet, rubble, snow... */
  readonly base: number;
  /** The ground outside the walls. */
  readonly ground: number;
  readonly landmark: (b: PartBuilder, side: number, z: number, scale: number) => void;
  readonly decal: (b: PartBuilder, x: number, z: number, r: () => number) => void;
  /** Painted across the whole floor once (a crosswalk, a runway, a carpet...). */
  readonly floor?: (b: PartBuilder, start: number, end: number) => void;
}

const stripes = (b: PartBuilder, x: number, z: number, color: number, count = 5, w = 0.9, len = 6): void => {
  for (let i = 0; i < count; i += 1) $.decal(b, x + (i - (count - 1) / 2) * w * 2, z, w, len, color);
};

const scatter = (color: number, w = 3, d = 2, kind: 'smooth' | 'glow' = 'smooth') => (b: PartBuilder, x: number, z: number, r: () => number): void => {
  $.decal(b, x, z, w * (0.6 + r() * 0.8), d * (0.6 + r() * 0.8), color, kind, r() * Math.PI);
};

const cracks = (color: number, kind: 'smooth' | 'glow' = 'glow') => (b: PartBuilder, x: number, z: number, r: () => number): void => {
  let a = r() * Math.PI;
  let cx = x;
  let cz = z;
  for (let i = 0; i < 4; i += 1) {
    const len = 1.6 + r() * 1.6;
    $.decal(b, cx, cz, 0.28, len, color, kind, a);
    cx += Math.sin(a) * len * 0.5;
    cz += Math.cos(a) * len * 0.5;
    a += (r() - 0.5) * 1.4;
  }
};

const big = (fn: PropFn, s: number, spread = 1) => (b: PartBuilder, side: number, z: number, scale: number): void => {
  fn(b, side * (96 + 10 * spread), z, s * scale, side > 0 ? -Math.PI / 2 : Math.PI / 2);
};

const volcano = (b: PartBuilder, side: number, z: number, scale: number): void => {
  const p = new Place(b, side * 108, z, scale);
  p.add(new ConeGeometry(26, 34, 10), 0x5a3a3a, 'stud', { y: 17 }).add(new CylinderGeometry(6, 6, 1.5, 10), 0xff6a1c, 'glow', { y: 34 })
    .add(new BoxGeometry(2, 30, 1), 0xff8a1c, 'glow', { y: 17, z: 13, rx: 0.65 });
};

const ferrisWheel = (b: PartBuilder, side: number, z: number, scale: number): void => {
  const p = new Place(b, side * 96, z, scale, Math.PI / 2);
  p.box(4, 20, 2, 0xffffff, 'smooth').add(new TorusGeometry(16, 0.5, 6, 32), 0xff4aa0, 'glow', { y: 20 });
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    p.add(new BoxGeometry(0.3, 16, 0.3), 0xffffff, 'smooth', { y: 20 + Math.sin(a) * 8, x: Math.cos(a) * 8, rz: a + Math.PI / 2 });
    p.add(new BoxGeometry(2.2, 2, 2.2), [0xff4a4a, 0x3fa9ff, 0xffd23a][i % 3]!, 'smooth', { x: Math.cos(a) * 16, y: 19 + Math.sin(a) * 16 });
  }
};

const stepTemple = (b: PartBuilder, side: number, z: number, scale: number): void => {
  const p = new Place(b, side * 100, z, scale);
  for (let i = 0; i < 5; i += 1) p.box(30 - i * 5, 4, 30 - i * 5, 0x9a9a7a, 'stud', { y: i * 4 });
  p.box(6, 5, 6, 0x7a7a5a, 'stud', { y: 20 }).box(3, 3, 0.2, 0x3dff6e, 'glow', { y: 21, z: 3.05 });
};

const bank = (b: PartBuilder, side: number, z: number, scale: number): void => {
  const p = new Place(b, side * 90, z, scale, side > 0 ? -Math.PI / 2 : Math.PI / 2);
  p.box(34, 3, 18, 0xe8e0d0, 'stud').box(30, 16, 14, 0xf4efe3, 'stud', { y: 3, z: -1 });
  for (let i = -3; i <= 3; i += 1) p.cyl(1.2, 1.2, 14, 0xffffff, 'stud', { x: i * 4.4, y: 3, z: 7.5 }, 12);
  p.add(new ConeGeometry(21, 6, 4, 1), 0xf4efe3, 'stud', { y: 22, ry: Math.PI / 4, sz: 0.5 }).box(10, 2, 0.4, 0xd4af37, 'glow', { y: 19.5, z: 8.4 });
};

const chimneys = (b: PartBuilder, side: number, z: number, scale: number): void => {
  const p = new Place(b, side * 96, z, scale);
  p.box(24, 14, 16, 0x8a8f9c, 'stud');
  for (const cx of [-7, 0, 7]) {
    p.cyl(1.6, 2, 26, 0xb05a3a, 'smooth', { x: cx, y: 14 });
    p.add(new SphereGeometry(3, 8, 6), 0xb0b0b8, 'glow', { x: cx, y: 43, sy: 0.6 });
  }
};

const fortressWall = (b: PartBuilder, side: number, z: number, scale: number): void => {
  const p = new Place(b, side * 92, z, scale, side > 0 ? -Math.PI / 2 : Math.PI / 2);
  p.box(60, 22, 6, 0x6a7a6a, 'stud');
  for (let i = -3; i <= 3; i += 1) p.box(4, 4, 6.4, 0x6a7a6a, 'stud', { x: i * 8.5, y: 22 });
  for (const tx of [-30, 30]) p.cyl(6, 6.5, 32, 0x5a6a5a, 'stud', { x: tx }, 12).add(new ConeGeometry(7, 8, 12), 0x3a4a3a, 'smooth', { x: tx, y: 36 });
  p.box(20, 3, 0.4, 0x3dff6e, 'glow', { y: 16, z: 3.2 });
};


/** Faces the stage street from its side. */
const facing = (side: number): number => (side > 0 ? -Math.PI / 2 : Math.PI / 2);

/** The Stock Exchange: six columns under a pediment, a great flag across the facade, a ticker. */
const exchange = (b: PartBuilder, side: number, z: number, scale: number): void => {
  const p = new Place(b, side * 94, z, scale, facing(side));
  p.box(42, 4, 18, 0xd8d0c0, 'stud').box(38, 22, 14, 0xe8e0d0, 'stud', { y: 4, z: -1.5 });
  for (let i = -2.5; i <= 2.5; i += 1) p.cyl(1.3, 1.4, 20, 0xf4efe3, 'stud', { x: i * 6.4, y: 4, z: 7 }, 12);
  p.box(42, 2.4, 16, 0xe8e0d0, 'stud', { y: 24 }).add(new ConeGeometry(24, 6, 4, 1), 0xe8e0d0, 'stud', { y: 29.4, ry: Math.PI / 4, sz: 0.36 });
  // The flag: red and white stripes, the blue canton.
  for (let i = 0; i < 7; i += 1) p.box(18, 1.2, 0.2, i % 2 ? 0xf4f4f4 : 0xc8202a, 'smooth', { x: 0, y: 8 + i * 1.2, z: 5.6 });
  p.box(7, 4.8, 0.24, 0x1a3a8a, 'smooth', { x: -5.5, y: 11.6, z: 5.6 });
  p.box(40, 1.2, 0.3, 0x14151c, 'smooth', { y: 25, z: 8.1 }).box(34, 0.5, 0.34, 0x3dff6e, 'glow', { y: 25.35, z: 8.1 });
};

/** A Staten Island ferry tied up at the pier: orange hull, white decks, a funnel. */
const ferry = (b: PartBuilder, side: number, z: number, scale: number): void => {
  const p = new Place(b, side * 98, z, scale, facing(side));
  p.box(16, 5, 46, 0xff8a1a, 'smooth').box(16.2, 1, 46.2, 0xf4f4f4, 'smooth', { y: 5 });
  p.box(13, 4, 34, 0xf4f4f4, 'smooth', { y: 6 }).box(10, 3.4, 22, 0xf4f4f4, 'smooth', { y: 10 });
  for (const wz of [-14, -9, -4, 1, 6, 11]) p.box(13.2, 1.4, 2.4, 0x9fd8ff, 'glow', { y: 7.8, z: wz });
  p.cyl(1.6, 1.8, 6, 0xff8a1a, 'smooth', { y: 13.4 }).cyl(1.7, 1.7, 1, 0x14151c, 'smooth', { y: 19.4 });
};

/** Grand Central's facade: three great arched windows, the clock, a cornice. */
const terminal = (b: PartBuilder, side: number, z: number, scale: number): void => {
  const p = new Place(b, side * 92, z, scale, facing(side));
  p.box(48, 28, 12, 0xd8c8a8, 'stud').box(50, 2, 13, 0xe8dcc0, 'stud', { y: 28 });
  for (const wx of [-14, 0, 14]) {
    p.box(9, 16, 0.3, 0x9fc8e8, 'glow', { x: wx, y: 6, z: 6.05 });
    p.add(new CylinderGeometry(4.5, 4.5, 0.3, 16, 1, false, 0, Math.PI), 0x9fc8e8, 'glow', { x: wx, y: 22, z: 6.05, rx: Math.PI / 2, rz: Math.PI / 2 });
    for (const px of [-5.5, 5.5]) p.box(1.4, 26, 1, 0xe8dcc0, 'stud', { x: wx + px, z: 6.2 });
  }
  p.cyl(3, 3, 0.6, 0xd4af37, 'smooth', { y: 31, z: 5, rx: Math.PI / 2 }).cyl(2.4, 2.4, 0.7, 0xfff4d0, 'glow', { y: 31, z: 5.1, rx: Math.PI / 2 });
  p.box(16, 5, 4, 0xd8c8a8, 'stud', { y: 30 });
};

/** A grey warship in dry dock at the Navy Yard: hull, bridge, two gun turrets. */
const warship = (b: PartBuilder, side: number, z: number, scale: number): void => {
  const p = new Place(b, side * 100, z, scale, facing(side));
  p.box(14, 7, 64, 0x6a7280, 'smooth').box(14.2, 1, 64.2, 0x3a3e48, 'smooth', { y: 1 });
  p.box(9, 6, 16, 0x7a8290, 'smooth', { y: 7, z: -4 }).box(6, 5, 8, 0x7a8290, 'smooth', { y: 13, z: -6 }).box(6.2, 1.2, 8.2, 0x9fd8ff, 'glow', { y: 15.4, z: -6 });
  p.cyl(0.4, 0.4, 10, 0x5a626e, 'smooth', { y: 18, z: -6 });
  for (const gz of [14, 24]) {
    p.cyl(3, 3.2, 2.4, 0x6a7280, 'smooth', { y: 7, z: gz });
    for (const gx of [-0.8, 0.8]) p.add(new CylinderGeometry(0.35, 0.35, 8, 8), 0x4a525e, 'smooth', { x: gx, y: 8.4, z: gz + 5, rx: Math.PI / 2 });
  }
};

/** Trinity Church: a dark Gothic nave, the bell tower and its spire, lit lancet windows. */
const church = (b: PartBuilder, side: number, z: number, scale: number): void => {
  const p = new Place(b, side * 96, z, scale, facing(side));
  p.box(20, 16, 40, 0x5a4a4a, 'stud').add(new ConeGeometry(15, 8, 4), 0x3a2a2a, 'smooth', { y: 20, ry: Math.PI / 4, sx: 0.95, sz: 1.9 });
  for (const wz of [-14, -6, 2, 10]) p.box(0.3, 7, 2.2, 0xff5a3a, 'glow', { x: 10.1, y: 5, z: wz }).box(0.3, 7, 2.2, 0xff5a3a, 'glow', { x: -10.1, y: 5, z: wz });
  p.box(11, 38, 11, 0x5a4a4a, 'stud', { z: 22 }).add(new ConeGeometry(7.6, 26, 4), 0x3a2a2a, 'smooth', { y: 51, z: 22, ry: Math.PI / 4 });
  p.box(3, 6, 0.3, 0xff5a3a, 'glow', { y: 26, z: 27.6 });
};

/** A blast furnace pouring slag, and its stacks. */
const furnace = (b: PartBuilder, side: number, z: number, scale: number): void => {
  const p = new Place(b, side * 98, z, scale);
  p.cyl(9, 11, 30, 0x4a3e38, 'stud', {}, 14).cyl(6, 9, 8, 0x3a302a, 'smooth', { y: 30 }, 14);
  p.box(4, 3, 10, 0xff6a1c, 'glow', { y: 6, z: 11 }).box(3, 0.4, 16, 0xffa03a, 'glow', { y: 0.4, z: 18 });
  for (const [cx, cz] of [[-14, -8], [14, -8], [0, -16]] as const) p.cyl(1.8, 2.4, 44, 0x6a4a3a, 'smooth', { x: cx, z: cz }).cyl(2, 2, 1.2, 0xff6a1c, 'glow', { x: cx, y: 44, z: cz });
};

/** The United Nations Secretariat: a tall green-glass slab, the General Assembly dome, flags. */
const secretariat = (b: PartBuilder, side: number, z: number, scale: number): void => {
  const p = new Place(b, side * 100, z, scale, facing(side));
  p.box(14, 76, 40, 0x5a9a9a, 'smooth').box(14.4, 76, 1.2, 0xe8e8e0, 'stud', { z: -20.6 }).box(14.4, 76, 1.2, 0xe8e8e0, 'stud', { z: 20.6 });
  for (let y = 4; y < 74; y += 4) p.box(14.2, 0.3, 40.2, 0x7ac0c0, 'smooth', { y });
  p.add(new SphereGeometry(8, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xd8dce4, 'smooth', { x: 0, y: 8, z: 32, sy: 0.5 }).box(24, 8, 18, 0xe8e8e0, 'stud', { z: 32 });
};

/** Rockefeller Center at Christmas: the great tree, lit, and its star. */
const christmasTree = (b: PartBuilder, side: number, z: number, scale: number): void => {
  const p = new Place(b, side * 90, z, scale);
  p.box(10, 2, 10, 0xd4af37, 'stud').cyl(1, 1.3, 6, 0x5a3a1a, 'smooth', { y: 2 });
  for (let i = 0; i < 5; i += 1) p.add(new ConeGeometry(11 - i * 2, 9, 12), i % 2 ? 0x2a7a3a : 0x1f6a30, 'smooth', { y: 10 + i * 6 });
  const lights = [0xff3a3a, 0xffd23a, 0x3dd6ff, 0xff5ad0, 0x7dff6a];
  for (let i = 0; i < 44; i += 1) {
    const t = i / 44;
    const y = 7 + t * 32;
    const r = 10.5 - t * 9;
    const a = i * 2.4;
    p.add(new SphereGeometry(0.5, 6, 5), lights[i % lights.length]!, 'glow', { x: Math.cos(a) * r, y, z: Math.sin(a) * r });
  }
  p.add(new OctahedronGeometry(2, 0), 0xfff4a0, 'glow', { y: 42, sy: 1.4 });
};

/** A row of clone vats: glass cylinders lit green, a shape in each. */
const cloneVats = (b: PartBuilder, side: number, z: number, scale: number): void => {
  const p = new Place(b, side * 92, z, scale, facing(side));
  for (let i = -3; i <= 3; i += 1) {
    p.cyl(2.4, 2.6, 1.2, 0x3a4252, 'smooth', { x: i * 6 }).cyl(2.1, 2.1, 9, 0x5aff8a, 'glow', { x: i * 6, y: 1.2 });
    p.box(1.2, 4.4, 0.8, 0x2a3a2a, 'smooth', { x: i * 6, y: 3.2, z: 0 }).cyl(2.4, 2.4, 1, 0x3a4252, 'smooth', { x: i * 6, y: 10.2 });
  }
  p.box(44, 1.2, 2, 0x3a4252, 'smooth', { y: 12, z: -2 });
};

/** Lady Liberty on her pedestal, torch aloft. */
const libertyStatue = (b: PartBuilder, side: number, z: number, scale: number): void => {
  const p = new Place(b, side * 100, z, scale, facing(side));
  const copper = 0x5fb89a;
  p.box(30, 6, 30, 0xb8a888, 'stud').box(18, 24, 18, 0xc8b89a, 'stud', { y: 6 });
  p.cyl(4.6, 6.4, 34, copper, 'smooth', { y: 30 }, 12).add(new SphereGeometry(3.4, 14, 10), copper, 'smooth', { y: 67.5 });
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 6) * Math.PI - Math.PI / 2;
    p.add(new ConeGeometry(0.5, 3, 4), copper, 'smooth', { x: Math.sin(a) * 2.6, y: 71, z: Math.cos(a) * 2.2 + 0.6, rx: Math.cos(a) * 0.5, rz: -Math.sin(a) * 0.5 });
  }
  p.box(2.2, 14, 2.2, copper, 'smooth', { x: 5, y: 60 }).cyl(1.4, 0.8, 2, 0xd4af37, 'smooth', { x: 5, y: 74 });
  p.add(new ConeGeometry(1.2, 3, 8), 0xffc83a, 'glow', { x: 5, y: 77.5 });
  p.box(2.4, 7, 5, 0x7ac8aa, 'smooth', { x: -5.4, y: 44, z: 1 });
};

/** The Empire State's crown, the stage built on its summit: setbacks, the mast, the red beacon. */
const summitMast = (b: PartBuilder, side: number, z: number, scale: number): void => {
  const p = new Place(b, side * 94, z, scale);
  p.box(26, 10, 26, 0xd8ccb4, 'stud').box(18, 10, 18, 0xd8ccb4, 'stud', { y: 10 }).box(12, 8, 12, 0xd8ccb4, 'stud', { y: 20 });
  p.box(12.4, 1, 12.4, 0xfff4c0, 'glow', { y: 26.5 });
  p.cyl(4, 5, 14, 0xe8e0cc, 'smooth', { y: 28 }, 8).cyl(1.2, 2.6, 28, 0xdfe6ee, 'smooth', { y: 42 }, 8);
  p.add(new SphereGeometry(1.2, 10, 8), 0xff2a2a, 'glow', { y: 71 });
};

const DRESSINGS: Readonly<Record<StageTheme, Dressing>> = {
  alley: {
    near: [$.storefront, $.streetlight, $.car, $.dumpster, $.bench, $.hydrant, $.trafficLight],
    far: [$.tallBuilding, $.storefront],
    corner: [$.car, $.dumpster, $.bench, $.cones],
    base: 0x8a8a94,
    ground: 0x6a6e78,
    landmark: big($.tallBuilding, 1.6),
    decal: (b, x, z, r) => (r() < 0.5 ? b.add(new CylinderGeometry(1.1, 1.1, 0.1, 14), 0x3a3a44, 'smooth', { x, y: 0.05, z }) : scatter(0x5a5e68, 2.4, 1.6)(b, x, z, r)),
    floor: (b, start) => {
      stripes(b, 0, start + 18, 0xffffff, 7, 1, 5);
      for (let z = start + 26; z < start + 88; z += 8) $.decal(b, 0, z, 0.5, 4, 0xffd23a);
    },
  },
  chinatown: {
    near: [$.storefront, $.neonSign, $.streetlight, $.balloons, $.bench],
    far: [$.tallBuilding, $.storefront],
    corner: [$.crateStack, $.barrels, $.balloons, $.bench],
    base: 0x8a2a2a,
    ground: 0x6a5a5a,
    landmark: (b, side, z, scale) => {
      // A red paifang gate with a green tiled roof.
      const p = new Place(b, side * 92, z, scale, Math.PI / 2);
      for (const x of [-9, 9]) p.cyl(1.1, 1.1, 18, 0xc8202a, 'smooth', { x, y: 0 }, 10);
      p.box(24, 2, 3, 0xc8202a, 'stud', { y: 16 }).box(28, 1.4, 5, 0x2a8a4a, 'stud', { y: 18.4 }).box(8, 3, 0.4, 0xffd23a, 'glow', { y: 13.5, z: 1.6 });
    },
    decal: scatter(0xc8202a, 2.4, 2.4),
    floor: (b, start, end) => {
      // A painted dragon down the market street: red scales with a gold spine.
      for (let z = start + 12; z < end - 8; z += 6) b.add(new CylinderGeometry(2.2, 2.2, 0.05, 16), 0xb01e26, 'smooth', { x: Math.sin(z * 0.12) * 5, y: 0.05, z });
      for (let z = start + 12; z < end - 8; z += 6) b.add(new CylinderGeometry(0.7, 0.7, 0.05, 10), 0xffd23a, 'smooth', { x: Math.sin(z * 0.12) * 5, y: 0.06, z });
    },
  },
  docks: {
    near: [$.container, $.crateStack, $.barrels, $.container],
    far: [$.container, $.crane],
    corner: [$.container, $.crateStack, $.barrels],
    base: 0x7a5a3a,
    ground: 0x3a8ac8,
    landmark: big($.crane, 1.4),
    decal: (b, x, z, r) => (r() < 0.5 ? scatter(0x3a7ac8, 2.6, 1.6)(b, x, z, r) : stripes(b, x, z, 0xffd23a, 3, 0.5, 3)),
  },
  subway: {
    near: [$.pipes, $.bench, $.trafficSign, $.streetlight],
    far: [$.tallBuilding],
    corner: [$.bench, $.barrier, $.cones],
    base: 0x6a6a7a,
    ground: 0x5a5a6a,
    landmark: (b, side, z, scale) => {
      // A subway train parked in the station beyond the platform.
      const p = new Place(b, side * 62, z, scale);
      for (let i = -1; i <= 1; i += 1) {
        p.box(5, 5.4, 18, 0xc8d8e8, 'smooth', { z: i * 19 }).box(5.1, 1.2, 18.1, 0x3a8a4a, 'smooth', { y: 1.6, z: i * 19 });
        for (const wz of [-6, 0, 6]) p.box(5.2, 1.6, 3, 0x9fd8ff, 'glow', { y: 3.2, z: i * 19 + wz });
      }
    },
    decal: (b, x, z) => $.decal(b, x, z, 0.8, 8, 0xffd23a),
  },
  oscorp: {
    near: [$.tank, $.console_, $.cables, $.satelliteDish, $.tank],
    far: [$.antenna, $.tallBuilding],
    corner: [$.tank, $.console_, $.crateStack],
    base: 0xdff6ff,
    ground: 0xd8e8f0,
    landmark: big($.satelliteDish, 3),
    decal: (b, x, z, r) => (r() < 0.5 ? scatter(0x3dff6e, 2, 1.6, 'glow')(b, x, z, r) : stripes(b, x, z, 0xffd23a, 4, 0.4, 2.4)),
  },
  timessquare: {
    near: [$.neonSign, $.car, $.streetlight],
    far: [$.neonTower],
    corner: [$.car, $.barrier, $.cones],
    base: 0x3a3a5a,
    ground: 0x3a3a5a,
    landmark: big($.neonTower, 1.8),
    decal: (b, x, z, r) => $.decal(b, x, z, 0.3, 7, r() < 0.5 ? 0xff2ea0 : 0x3dd6ff, 'glow', r() < 0.5 ? 0 : Math.PI / 2),
  },
  bridge: {
    near: [$.streetlight, $.barrier, $.car, $.trafficSign],
    far: [$.tallBuilding],
    corner: [$.car, $.wreckedCar, $.barrier, $.cones],
    base: 0x8a8a94,
    ground: 0x3a7ac8,
    landmark: (b, side, z, scale) => {
      // A stone bridge tower: twin Gothic arches, and the cables sweeping down from it.
      const p = new Place(b, side * 90, z, scale, Math.PI / 2);
      p.box(26, 44, 10, 0xb89a7a, 'stud').box(6, 18, 10.4, 0x3a7ac8, 'smooth', { x: -6, y: 18 }).box(6, 18, 10.4, 0x3a7ac8, 'smooth', { x: 6, y: 18 });
      for (let i = 0; i < 6; i += 1) p.add(new BoxGeometry(0.3, 30, 0.3), 0x5a5a64, 'smooth', { x: -14 - i * 4, y: 26 - i * 3, rz: 0.9 }).add(new BoxGeometry(0.3, 30, 0.3), 0x5a5a64, 'smooth', { x: 14 + i * 4, y: 26 - i * 3, rz: -0.9 });
    },
    decal: (b, x, z, r) => $.decal(b, x, z, 0.5, 6, 0xffffff, 'smooth', r() < 0.5 ? 0 : Math.PI / 2),
    floor: (b, start, end) => {
      for (let z = start + 6; z < end - 4; z += 10) $.decal(b, 0, z, 0.5, 5, 0xffd23a);
    },
  },
  park: {
    near: [$.leafyTree, $.bush, $.bench, $.streetlight, $.leafyTree],
    far: [$.tallBuilding, $.leafyTree],
    corner: [$.bush, $.bench, $.log, $.boulder],
    base: 0x5a8a3a,
    ground: 0x4fae3a,
    landmark: big($.tallBuilding, 1.7),
    decal: scatter(0x6ab84a, 3.4, 2.4),
    floor: (b, start, end) => {
      $.decal(b, 0, (start + end) / 2, 8, end - start - 4, 0xc8b890);
    },
  },
  rooftops: {
    near: [$.acUnit, $.vent, $.waterTank, $.antenna, $.satelliteDish],
    far: [$.tallBuilding, $.neonTower],
    corner: [$.acUnit, $.vent, $.crateStack],
    base: 0x5a6a90,
    ground: 0x6a7aa0,
    landmark: big($.neonTower, 1.3),
    decal: scatter(0x3a4a6a, 3, 2),
    floor: (b, start) => {
      b.add(new TorusGeometry(9, 0.5, 4, 32), 0xffd23a, 'smooth', { y: 0.1, z: start + 48, rx: Math.PI / 2, sz: 0.3 });
      $.decal(b, -3, start + 48, 1.2, 9, 0xffffff);
      $.decal(b, 3, start + 48, 1.2, 9, 0xffffff);
      $.decal(b, 0, start + 48, 5, 1.2, 0xffffff);
    },
  },
  coney: {
    near: [$.tentProp, $.balloons, $.crateStack],
    far: [$.tentProp],
    corner: [$.balloons, $.crateStack, $.barrels],
    base: 0xffd23a,
    ground: 0x6ad84a,
    landmark: ferrisWheel,
    decal: (b, x, z, r) => $.decal(b, x, z, 0.8, 0.8, [0xff4a4a, 0x3fa9ff, 0xffd23a][Math.floor(r() * 3)]!, 'glow', r()),
  },
  harbor: {
    near: [$.container, $.boulder, $.wreckedCar, $.crateStack],
    far: [$.container, $.crane, $.brokenWall],
    corner: [$.boulder, $.container, $.wreckedCar, $.crateStack],
    base: 0xd8b070,
    ground: 0xe0c080,
    landmark: big($.crane, 1.4),
    decal: scatter(0xe0b870, 4, 1),
  },
  alchemax: {
    near: [$.machine, $.pipes, $.barrels, $.scaffold],
    far: [$.crane, $.scaffold],
    corner: [$.machine, $.barrels, $.crateStack, $.cables],
    base: 0x6a7282,
    ground: 0x7a7e88,
    landmark: chimneys,
    decal: (b, x, z) => stripes(b, x, z, 0xffd23a, 5, 0.5, 2),
  },
  warehouse: {
    near: [$.container, $.crateStack, $.dumpster, $.fence],
    far: [$.tallBuilding, $.ruinedBuilding],
    corner: [$.crateStack, $.barrels, $.container, $.fireBarrel],
    base: 0x6a5a4a,
    ground: 0x5a5a64,
    landmark: big($.ruinedBuilding, 1.6),
    decal: scatter(0x3a3a44, 3, 2),
  },
  hive: {
    near: [$.ruinedBuilding, $.wreckedCar, $.rubble, $.smoke, $.darkSpire],
    far: [$.ruinedBuilding, $.darkSpire],
    corner: [$.rubble, $.wreckedCar, $.fireBarrel],
    base: 0x6a6a74,
    ground: 0x5a4a6a,
    landmark: big($.darkSpire, 3),
    decal: cracks(0xb16bff),
  },
  ravencroft: {
    near: [$.fence, $.guardTower, $.cellBlock, $.concreteBlock],
    far: [$.guardTower, $.cellBlock],
    corner: [$.concreteBlock, $.barrier, $.crateStack],
    base: 0x9aa0a8,
    ground: 0x8a9a8a,
    landmark: fortressWall,
    decal: (b, x, z, r) => $.decal(b, x, z, 7, 0.4, 0xffd23a, 'smooth', r() < 0.5 ? 0 : Math.PI / 2),
  },
  kingpin: {
    near: [$.storefront, $.car, $.streetlight, $.trafficSign, $.barrier],
    far: [$.tallBuilding],
    corner: [$.car, $.barrier, $.cones, $.crateStack],
    base: 0x8a8a94,
    ground: 0x7a7e88,
    landmark: bank,
    decal: (b, x, z, r) => $.decal(b, x, z, 6, 0.5, 0xffd23a, 'smooth', r() * Math.PI),
  },
  sinister: {
    near: [$.neonSign, $.car, $.streetlight],
    far: [$.neonTower],
    corner: [$.car, $.barrier, $.cones],
    base: 0x3a3a5a,
    ground: 0x3a3a5a,
    landmark: big($.neonTower, 1.8),
    decal: (b, x, z, r) => $.decal(b, x, z, 0.3, 7, r() < 0.5 ? 0xff2ea0 : 0x3dd6ff, 'glow', r() < 0.5 ? 0 : Math.PI / 2),
  },
  goblin: {
    near: [$.runePillar, $.lavaRock, $.fireBarrel],
    far: [$.runePillar, $.darkSpire],
    corner: [$.lavaRock, $.fireBarrel],
    base: 0x4a2a1a,
    ground: 0x8a4a2a,
    landmark: volcano,
    decal: cracks(0xff8a1c),
  },

  wallstreet: {
    near: [$.storefront, $.streetlight, $.car, $.trafficSign, $.flag],
    far: [$.tallBuilding, $.storefront],
    corner: [$.car, $.barrier, $.cones, $.crateStack],
    base: 0x9a9aa4,
    ground: 0x8a8a94,
    landmark: exchange,
    decal: (b, x, z, r) => $.decal(b, x, z, 0.4, 5, r() < 0.5 ? 0x3dff6e : 0xff4a4a, 'glow', r() < 0.5 ? 0 : Math.PI / 2),
    floor: (b, start, end) => {
      // Gold pavers down the middle of the Street, the bull's path.
      for (let z = start + 10; z < end - 8; z += 7) $.decal(b, 0, z, 4, 3, 0xc8a040);
    },
  },
  eastriver: {
    near: [$.container, $.crateStack, $.barrels, $.boulder],
    far: [$.crane, $.container],
    corner: [$.crateStack, $.barrels, $.container],
    base: 0x6a5a4a,
    ground: 0x2a7ac8,
    landmark: ferry,
    decal: (b, x, z, r) => $.decal(b, x, z, 2 + r() * 2, 1.4 + r(), 0x5ab8ff, 'glow', r() * Math.PI),
    floor: (b, start, end) => {
      // Pier planks across the deck.
      for (let z = start + 4; z < end - 2; z += 5) $.decal(b, 0, z, 70, 0.3, 0x5a4a3a);
    },
  },
  grandcentral: {
    near: [$.bench, $.streetlight, $.trafficSign, $.flag],
    far: [$.tallBuilding],
    corner: [$.bench, $.barrier, $.crateStack],
    base: 0xc8b890,
    ground: 0xb8a888,
    landmark: terminal,
    decal: (b, x, z, r) => $.decal(b, x, z, 3, 3, r() < 0.5 ? 0xe8dcc0 : 0xa89878, 'smooth', Math.PI / 4),
    floor: (b, start, end) => {
      // The concourse's star-field ceiling, painted on the floor as a mosaic.
      for (let i = 0; i < 18; i += 1) $.decal(b, ((i * 37) % 60) - 30, start + 8 + ((i * 53) % (end - start - 16)), 0.6, 0.6, 0xd4af37, 'glow', Math.PI / 4);
    },
  },
  navyyard: {
    near: [$.container, $.machine, $.pipes, $.barrels],
    far: [$.crane, $.container],
    corner: [$.container, $.machine, $.crateStack],
    base: 0x6a7280,
    ground: 0x3a6aa8,
    landmark: warship,
    decal: (b, x, z) => stripes(b, x, z, 0xffd23a, 4, 0.5, 3),
  },
  crypt: {
    near: [$.gravestones, $.deadTree, $.fence, $.gravestones],
    far: [$.hauntedHouse, $.deadTree],
    corner: [$.gravestones, $.deadTree, $.boulder],
    base: 0x4a4a54,
    ground: 0x3a4a3a,
    landmark: church,
    decal: (b, x, z, r) => scatter(0x8a1a2a, 1.6, 1.2)(b, x, z, r),
  },
  foundry: {
    near: [$.machine, $.fireBarrel, $.pipes, $.barrels, $.lavaRock],
    far: [$.crane, $.scaffold],
    corner: [$.machine, $.fireBarrel, $.crateStack],
    base: 0x4a3e38,
    ground: 0x4a3e38,
    landmark: furnace,
    decal: cracks(0xff8a1c),
  },
  highline: {
    near: [$.leafyTree, $.bench, $.bush, $.streetlight],
    far: [$.tallBuilding, $.portalRing],
    corner: [$.bush, $.bench, $.log],
    base: 0x7a7a6a,
    ground: 0x5a7a4a,
    landmark: big($.portalRing, 3.2),
    // Spot's portals: black holes punched in the walkway.
    decal: (b, x, z, r) => {
      const radius = 0.8 + r() * 1.2;
      b.add(new CylinderGeometry(radius, radius, 0.1, 18), 0x050508, 'smooth', { x, y: 0.05, z });
    },
    floor: (b, start, end) => {
      // The old rail tracks, planted either side.
      // Sleepers on the floor layer, the rails a hair above them (never the same plane).
      for (let z = start + 4; z < end - 3; z += 3) $.decal(b, 0, z, 10, 0.5, 0x8a7a6a);
      for (const x of [-4, 4]) $.decal(lifted(b, 0.006), x, (start + end) / 2, 0.5, end - start - 6, 0x6a5a4a);
    },
  },
  unplaza: {
    near: [$.flag, $.streetlight, $.bench, $.flag, $.barrier],
    far: [$.tallBuilding],
    corner: [$.barrier, $.bench, $.cones],
    base: 0xb8bcc4,
    ground: 0x8a9a8a,
    landmark: secretariat,
    decal: (b, x, z, r) => $.decal(b, x, z, 5, 0.4, 0xffffff, 'smooth', r() * Math.PI),
    floor: (b, start) => {
      // The emblem ring in the plaza.
      b.add(new TorusGeometry(10, 0.5, 4, 40), 0x3fa9ff, 'smooth', { y: 0.1, z: start + 48, rx: Math.PI / 2, sz: 0.3 });
    },
  },
  rockefeller: {
    near: [$.storefront, $.streetlight, $.flag, $.bench, $.snowPile],
    far: [$.tallBuilding],
    corner: [$.snowPile, $.bench, $.crateStack],
    base: 0xe8eef4,
    ground: 0xdfe8f0,
    landmark: christmasTree,
    decal: (b, x, z, r) => scatter(0xf4f8ff, 3, 2)(b, x, z, r),
    floor: (b, start) => {
      // The skating rink.
      // On the floor-decal layer (top 0.1), like every painted floor.
      b.add(new CylinderGeometry(12, 12, 0.1, 32), 0xbfe6ff, 'smooth', { y: 0.05, z: start + 48, sx: 1.2 });
    },
  },
  clonelab: {
    near: [$.tank, $.console_, $.cables, $.alienPod],
    far: [$.antenna, $.tallBuilding],
    corner: [$.tank, $.console_, $.crateStack],
    base: 0xd8e8f0,
    ground: 0xc8d8e4,
    landmark: cloneVats,
    decal: (b, x, z, r) => (r() < 0.5 ? scatter(0x5aff8a, 2, 1.4, 'glow')(b, x, z, r) : stripes(b, x, z, 0xffd23a, 3, 0.4, 2.4)),
  },
  liberty: {
    near: [$.leafyTree, $.bench, $.streetlight, $.boulder, $.flag],
    far: [$.leafyTree, $.tallBuilding],
    corner: [$.bush, $.bench, $.boulder],
    base: 0xb8a888,
    ground: 0x4fae3a,
    landmark: libertyStatue,
    decal: scatter(0x6ab84a, 3.4, 2.4),
    floor: (b, start, end) => {
      $.decal(b, 0, (start + end) / 2, 10, end - start - 4, 0xc8b890);
    },
  },
  empirestate: {
    near: [$.antenna, $.acUnit, $.vent, $.satelliteDish],
    far: [$.neonTower, $.tallBuilding],
    corner: [$.acUnit, $.vent, $.crateStack],
    base: 0x8a8a94,
    ground: 0x6a6a74,
    landmark: summitMast,
    decal: (b, x, z, r) => $.decal(b, x, z, 6, 0.5, 0xd4af37, 'smooth', r() < 0.5 ? 0 : Math.PI / 2),
    floor: (b, start) => {
      // The observation deck's gold ring.
      b.add(new TorusGeometry(14, 0.6, 4, 40), 0xd4af37, 'smooth', { y: 0.1, z: start + 48, rx: Math.PI / 2, sz: 0.3 });
    },
  },

};

/** Where floor decals may NOT go: the pads, the corner footprints and a margin round them. */
const blocked = (stage: number, x: number, z: number): boolean => {
  const reward = rewardPadOf(stage);
  const back = returnPadOf(stage);
  if (Math.abs(x - reward.x) < reward.half + 3 && Math.abs(z - reward.z) < reward.half + 3) return true;
  if (Math.abs(x - back.x) < back.half + 3 && Math.abs(z - back.z) < back.half + 3) return true;
  return Math.abs(x) > 33;
};

/**
 * Dress one stage: `b` gets everything. `epic` grows toward the final stages,
 * scaling the landmarks up so the last arenas feel like the end of the road.
 */
export const dressStage = (b: PartBuilder, stage: number, theme: StageTheme): void => {
  const d = DRESSINGS[theme];
  const random = seeded(stage * 104729 + 7);
  const start = arenaStartZ(stage);
  const end = arenaEndZ(stage);
  const mid = (start + end) / 2;
  const epic = 1 + Math.max(0, stage - 20) * 0.06;
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(random() * list.length) % list.length]!;

  // The far ground, out to the skyline (the arena shell lays it to x = 90).
  for (const side of [-1, 1]) {
    b.box(60, 1, end - start + 8, d.ground, 'stud', { x: side * 120, y: -0.5, z: mid });
  }

  // The landmark, on one side, alternating stage to stage.
  const landmarkSide = stage % 2 === 0 ? -1 : 1;
  d.landmark(b, landmarkSide, mid, epic);

  for (const side of [-1, 1]) {
    const face = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    // Just beyond the barrier: the street, the lab, the docks...
    for (let z = start + 6; z < end - 2; z += 15) pick(d.near)(b, side * (55.5 + random() * 3), z + random() * 2, 0.95 + random() * 0.2, face);
    // The skyline, clear of the landmark.
    for (let z = start - 2; z < end + 2; z += 26) {
      const at = z + random() * 4;
      if (side === landmarkSide && Math.abs(at - mid) < 40) continue;
      pick(d.far)(b, side * (80 + random() * 16), at, (1 + random() * 0.3) * epic, face);
    }
  }

  // Foreground: the six corner clusters, each on its footprint's base.
  for (const spot of arenaPropSpots(stage)) {
    const cx = (spot.minX + spot.maxX) / 2;
    const cz = (spot.minZ + spot.maxZ) / 2;
    const w = spot.maxX - spot.minX;
    const depth = spot.maxZ - spot.minZ;
    const face = cx > 0 ? -Math.PI / 2 : Math.PI / 2;
    b.box(w, 0.25, depth, d.base, 'stud', { x: cx, y: 0.125, z: cz });
    b.box(0.3, 0.3, depth, 0xffd23a, 'smooth', { x: cx > 0 ? spot.minX + 0.15 : spot.maxX - 0.15, y: 0.4, z: cz });
    const fn = pick(d.corner);
    // Props stand on the base plate (0.25 high).
    fn(lifted(b, 0.25), cx, cz, 0.85, face);
  }

  // Floor storytelling: walkable decals, never on a pad.
  let placed = 0;
  for (let i = 0; i < 40 && placed < 12; i += 1) {
    const x = (random() - 0.5) * 60;
    const z = start + 6 + random() * (end - start - 12);
    if (blocked(stage, x, z)) continue;
    // Each decal a hair above the last, so two that overlap never share a plane (no flicker).
    d.decal(lifted(b, 0.012 + placed * 0.004), x, z, random);
    placed += 1;
  }
  d.floor?.(b, start, end);

  // The entrance: light pillars either side of the portal and an emblem over it.
  const face = start + 0.06;
  for (const s of [-1, 1]) {
    b.box(1.2, ARENA.portalHeight + 2, 0.12, 0xffffff, 'glow', { x: s * (ARENA.portalHalfWidth + 2.2), y: (ARENA.portalHeight + 2) / 2, z: face });
    b.box(3, 3, 0.12, 0xffd23a, 'glow', { x: s * (ARENA.portalHalfWidth + 2.2), y: ARENA.portalHeight + 3.5, z: face });
  }
  // The Win platform itself is part of the arena shell (StageWorld), on every stage.
};

/** The ground colour outside a theme's walls, for the arena shell. */
export const groundOf = (theme: StageTheme): number => DRESSINGS[theme].ground;
