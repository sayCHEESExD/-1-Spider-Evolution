import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  OctahedronGeometry,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
} from 'three';
import { studBox, type PartBuilder, type PartKind, type Transform } from '../render/PartBuilder.js';

/**
 * THE ENVIRONMENT PROP LIBRARY: streets, industry, labs, nature, ruins and
 * sci-fi, each a handful of primitives dropped into a `PartBuilder`, so a whole
 * arena's dressing merges into three meshes and costs no file.
 *
 * Every prop is authored standing on y = `Place.y` (the ground), facing +Z,
 * and is rotated and scaled as one by its `Place`. Props sit ON the ground and
 * never float; the only exceptions are lights, holograms and energy, which are
 * drawn as the glow they are.
 */
export class Place {
  private readonly c: number;
  private readonly sn: number;

  constructor(
    readonly b: PartBuilder,
    readonly x: number,
    readonly z: number,
    readonly s = 1,
    readonly ry = 0,
    readonly y = 0,
  ) {
    this.c = Math.cos(ry);
    this.sn = Math.sin(ry);
  }

  add(geometry: BufferGeometry, color: number, kind: PartKind = 'smooth', t: Transform = {}): this {
    const lx = (t.x ?? 0) * this.s;
    const lz = (t.z ?? 0) * this.s;
    this.b.add(geometry, color, kind, {
      x: this.x + lx * this.c + lz * this.sn,
      y: this.y + (t.y ?? 0) * this.s,
      z: this.z + lz * this.c - lx * this.sn,
      rx: t.rx ?? 0,
      ry: this.ry + (t.ry ?? 0),
      rz: t.rz ?? 0,
      sx: (t.sx ?? 1) * this.s,
      sy: (t.sy ?? 1) * this.s,
      sz: (t.sz ?? 1) * this.s,
    });
    return this;
  }

  /** A box standing on the ground: `y` is its BASE, not its centre. */
  box(w: number, h: number, d: number, color: number, kind: PartKind = 'smooth', t: Transform = {}): this {
    // Studded boxes get world-scaled UVs, so a stud is the same size on a crate and a skyscraper.
    const geometry = kind === 'stud' ? studBox(w * this.s, h * this.s, d * this.s) : new BoxGeometry(w, h, d);
    const scale = kind === 'stud' ? 1 / this.s : 1;
    return this.add(geometry, color, kind, { ...t, y: (t.y ?? 0) + h / 2, sx: (t.sx ?? 1) * scale, sy: (t.sy ?? 1) * scale, sz: (t.sz ?? 1) * scale });
  }

  /** An upright cylinder standing on the ground. */
  cyl(rt: number, rb: number, h: number, color: number, kind: PartKind = 'smooth', t: Transform = {}, seg = 10): this {
    return this.add(new CylinderGeometry(rt, rb, h, seg), color, kind, { ...t, y: (t.y ?? 0) + h / 2 });
  }
}

export type PropFn = (b: PartBuilder, x: number, z: number, s?: number, ry?: number) => void;

const P = (b: PartBuilder, x: number, z: number, s = 1, ry = 0): Place => new Place(b, x, z, s, ry);

// ---------------------------------------------------------------- streets

export const streetlight: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry)
    .cyl(0.18, 0.25, 8, 0x3a4252)
    .box(0.3, 0.3, 2.2, 0x3a4252, 'smooth', { y: 7.8, z: 1 })
    .box(0.8, 0.25, 1, 0xfff4c0, 'glow', { y: 7.55, z: 2 });
};

export const trafficLight: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry).cyl(0.14, 0.18, 5.5, 0x2a2e3a).box(0.7, 2, 0.6, 0x1a1d26, 'smooth', { y: 5.2 });
  [0xff3a3a, 0xffd23a, 0x3dff6e].forEach((c, i) => p.add(new SphereGeometry(0.2, 8, 6), c, 'glow', { y: 6.8 - i * 0.6, z: 0.32, sz: 0.5 }));
};

export const trafficSign: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).cyl(0.07, 0.07, 3, 0x9aa0ac).add(new CylinderGeometry(0.6, 0.6, 0.06, 8), 0xe0342b, 'smooth', { y: 3.3, rx: Math.PI / 2 })
    .box(0.8, 0.14, 0.08, 0xffffff, 'smooth', { y: 3.23, z: 0.05 });
};

export const dumpster: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).box(3, 1.8, 1.7, 0x2f8a4a, 'smooth', { y: 0.2 }).box(3.1, 0.15, 1.8, 0x236a38, 'smooth', { y: 2, rx: -0.12 })
    .cyl(0.2, 0.2, 0.2, 0x1a1a22, 'smooth', { x: -1.1, z: 0.6 }).cyl(0.2, 0.2, 0.2, 0x1a1a22, 'smooth', { x: 1.1, z: 0.6 });
};

export const bench: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).box(2.6, 0.15, 0.8, 0x9a6a3f, 'smooth', { y: 0.7 }).box(2.6, 0.7, 0.12, 0x9a6a3f, 'smooth', { y: 0.95, z: -0.4 })
    .box(0.12, 0.7, 0.7, 0x3a3a44, 'smooth', { x: -1.1 }).box(0.12, 0.7, 0.7, 0x3a3a44, 'smooth', { x: 1.1 });
};

export const hydrant: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).cyl(0.3, 0.35, 1.1, 0xe0342b).add(new SphereGeometry(0.3, 8, 6), 0xe0342b, 'smooth', { y: 1.1 })
    .add(new CylinderGeometry(0.12, 0.12, 0.8, 6), 0xe0342b, 'smooth', { y: 0.7, rz: Math.PI / 2 });
};

export const car: PropFn = (b, x, z, s = 1, ry = 0) => {
  const colors = [0xff4a4a, 0x3fa9ff, 0xffd23a, 0x5ae04a, 0xf4f4f4];
  const color = colors[Math.abs(Math.floor(x * 7 + z * 3)) % colors.length]!;
  const p = P(b, x, z, s, ry).box(2.4, 1.1, 4.6, color, 'smooth', { y: 0.4 }).box(2.1, 0.9, 2.4, 0xbfe0ff, 'smooth', { y: 1.5, z: -0.2 });
  for (const sx of [-1.2, 1.2]) for (const sz of [-1.5, 1.5]) p.add(new CylinderGeometry(0.5, 0.5, 0.4, 10), 0x1a1a22, 'smooth', { x: sx, y: 0.5, z: sz, rz: Math.PI / 2 });
  p.box(0.5, 0.2, 0.05, 0xfff4c0, 'glow', { x: -0.7, y: 0.9, z: 2.31 }).box(0.5, 0.2, 0.05, 0xfff4c0, 'glow', { x: 0.7, y: 0.9, z: 2.31 });
};

export const wreckedCar: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry).add(new BoxGeometry(2.4, 1.1, 4.6), 0x6a5a5a, 'smooth', { y: 0.75, rz: 0.12, rx: 0.05 })
    .add(new BoxGeometry(2, 0.7, 2), 0x3a3a44, 'smooth', { y: 1.5, z: -0.4, rz: 0.2 });
  p.add(new CylinderGeometry(0.5, 0.5, 0.4, 10), 0x1a1a22, 'smooth', { x: -1.2, y: 0.5, z: 1.5, rz: Math.PI / 2 });
  p.add(new CylinderGeometry(0.5, 0.5, 0.4, 10), 0x1a1a22, 'smooth', { x: 1.2, y: 0.5, z: -1.5, rz: Math.PI / 2 });
};

export const storefront: PropFn = (b, x, z, s = 1, ry = 0) => {
  const colors = [0xffc8a0, 0xc8e8ff, 0xffe08a, 0xe8c8ff, 0xc8ffd8];
  const color = colors[Math.abs(Math.floor(x + z)) % colors.length]!;
  P(b, x, z, s, ry)
    .box(10, 9, 6, color, 'stud')
    .box(8, 3.4, 0.2, 0x9fd8ff, 'glow', { y: 0.4, z: 3.05 })
    .box(10.4, 0.4, 2.2, 0xff5a5a, 'smooth', { y: 4.2, z: 3.8, rx: 0.25 })
    .box(6, 1.2, 0.2, 0x2a2e3a, 'smooth', { y: 6, z: 3.1 })
    .box(5, 0.6, 0.25, 0xffd23a, 'glow', { y: 6.3, z: 3.12 });
};

export const tallBuilding: PropFn = (b, x, z, s = 1, ry = 0) => {
  const h = 26 + (Math.abs(Math.floor(x * 13 + z * 7)) % 5) * 7;
  const colors = [0x9fd0ff, 0xb8c8e8, 0xd8c8f0, 0xa8e0d0, 0xf0d0b0];
  const color = colors[Math.abs(Math.floor(x * 3 + z)) % colors.length]!;
  const p = P(b, x, z, s, ry).box(12, h, 12, color, 'stud');
  for (let y = 4; y < h - 2; y += 4) p.box(12.2, 1.4, 12.2, 0x5a7aa8, 'smooth', { y });
  p.box(12.6, 0.8, 12.6, 0x5a6a84, 'smooth', { y: h }).cyl(0.2, 0.2, 5, 0x9aa0ac, 'smooth', { y: h + 0.8 }).add(new SphereGeometry(0.4, 8, 6), 0xff3a3a, 'glow', { y: h + 6 });
};

// ------------------------------------------------------------ destruction

export const rubble: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry);
  const tones = [0x9aa0ac, 0x8a8078, 0xb0a898];
  for (let i = 0; i < 7; i += 1) {
    const a = i * 2.1;
    const r = (i % 3) * 0.6;
    p.add(new BoxGeometry(1.2 - (i % 2) * 0.4, 0.8, 1), tones[i % 3]!, 'stud', { x: Math.cos(a) * r, y: 0.3 + (i % 2) * 0.35, z: Math.sin(a) * r, ry: a, rx: 0.3 * (i % 2), rz: 0.2 });
  }
};

export const brokenWall: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).box(6, 5, 1, 0xb0a898, 'stud').box(3, 2, 1, 0xb0a898, 'stud', { x: -1.5, y: 5 }).box(1.4, 1.2, 1, 0xb0a898, 'stud', { x: -2.3, y: 7 })
    .add(new BoxGeometry(0.2, 5, 0.2), 0x6a4a3a, 'smooth', { x: 1.5, y: 5.5, rz: 0.5 });
};

export const ruinedBuilding: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry).box(12, 14, 12, 0x9a9aa8, 'stud').box(7, 8, 12, 0x9a9aa8, 'stud', { x: -2.5, y: 14 }).box(3, 4, 6, 0x9a9aa8, 'stud', { x: -4.5, y: 22 });
  for (let y = 3; y < 20; y += 4) p.box(12.2, 1.2, 0.3, 0x2a2a34, 'smooth', { y, z: 6 });
  p.add(new BoxGeometry(0.3, 10, 0.3), 0x5a3a2a, 'smooth', { x: 3, y: 18, rz: 0.6 });
};

export const smoke: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry);
  for (let i = 0; i < 5; i += 1) p.add(new SphereGeometry(1 + i * 0.35, 8, 6), i % 2 ? 0x8a8a94 : 0x9a9aa4, 'glow', { x: Math.sin(i) * 0.8, y: 1.2 + i * 1.8, z: Math.cos(i) * 0.5 });
};

export const fireBarrel: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).cyl(0.7, 0.7, 1.8, 0x5a4a3a).add(new ConeGeometry(0.5, 1.2, 7), 0xff8a1c, 'glow', { y: 2.2 }).add(new ConeGeometry(0.3, 0.8, 7), 0xffd23a, 'glow', { y: 2.3 });
};

// -------------------------------------------------------------- industry

export const container: PropFn = (b, x, z, s = 1, ry = 0) => {
  const colors = [0xd84a3a, 0x3a7ac8, 0x3aa85a, 0xe0a030, 0x8a5ad8];
  const color = colors[Math.abs(Math.floor(x * 5 + z * 11)) % colors.length]!;
  const p = P(b, x, z, s, ry).box(4, 3.4, 9, color, 'smooth');
  for (let i = -4; i <= 4; i += 1) p.box(4.1, 3.2, 0.15, color, 'smooth', { y: 0.1, z: i });
};

export const crateStack: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).box(2, 2, 2, 0xc8904a, 'stud', { x: -1.1 }).box(2, 2, 2, 0xb07a38, 'stud', { x: 1.1 }).box(2, 2, 2, 0xc8904a, 'stud', { y: 2, ry: 0.3 });
};

export const barrels: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry);
  for (const [bx, bz, c] of [[-0.9, 0, 0x3a7ac8], [0.9, 0.2, 0xffd23a], [0, -1.4, 0x3a7ac8]] as const) {
    p.cyl(0.75, 0.75, 1.9, c, 'smooth', { x: bx, z: bz }).add(new TorusGeometry(0.77, 0.06, 4, 12), 0x2a2e3a, 'smooth', { x: bx, y: 1.3, z: bz, rx: Math.PI / 2 });
  }
};

export const shelf: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry);
  for (const sx of [-3, 3]) p.box(0.2, 6, 1.6, 0x3a6ab0, 'smooth', { x: sx });
  for (const y of [0.2, 2.2, 4.2]) {
    p.box(6.2, 0.15, 1.6, 0xff8a1c, 'smooth', { y });
    p.box(1.4, 1.2, 1.2, 0xc8904a, 'stud', { x: -1.8, y: y + 0.15 }).box(1.2, 1, 1.2, 0xb07a38, 'stud', { x: 0.6, y: y + 0.15 });
  }
};

export const pipes: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry);
  for (const [py, r, c] of [[1.2, 0.6, 0x8a94a8], [2.6, 0.45, 0xd84a3a], [3.7, 0.35, 0xffd23a]] as const) {
    p.add(new CylinderGeometry(r, r, 14, 10), c, 'smooth', { y: py, rx: Math.PI / 2 });
  }
  for (const pz of [-6, 0, 6]) p.box(0.4, 4.4, 0.4, 0x3a4252, 'smooth', { z: pz, x: -0.7 });
};

export const machine: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).box(4, 3, 3, 0x8a94a8, 'stud').box(2.6, 1.4, 0.2, 0x2a2e3a, 'smooth', { y: 1.4, z: 1.55 }).box(2, 0.5, 0.22, 0x3dff6e, 'glow', { y: 1.9, z: 1.56 })
    .add(new TorusGeometry(0.8, 0.2, 6, 12), 0xffd23a, 'smooth', { x: 2.1, y: 2, rz: 0, ry: Math.PI / 2 })
    .cyl(0.5, 0.5, 2.5, 0x6a7282, 'smooth', { x: -1, y: 3, z: -0.5 });
};

export const crane: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry).box(3, 1, 3, 0x3a4252, 'smooth');
  for (let y = 1; y < 24; y += 3) {
    p.box(2, 0.3, 2, 0xffc21a, 'smooth', { y });
    p.add(new BoxGeometry(0.2, 3.6, 0.2), 0xffc21a, 'smooth', { y: y + 1.5, rz: 0.6 });
  }
  for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) p.box(0.3, 24, 0.3, 0xffc21a, 'smooth', { x: cx, z: cz, y: 1 });
  p.box(2, 1.4, 20, 0xffc21a, 'smooth', { y: 25, z: 6 }).box(3, 2.4, 3, 0xd84a3a, 'smooth', { y: 24.6, z: -4 })
    .add(new CylinderGeometry(0.05, 0.05, 12, 4), 0x2a2e3a, 'smooth', { y: 19, z: 14 }).box(1.2, 1, 1.2, 0x3a4252, 'smooth', { y: 12.5, z: 14 });
};

export const scaffold: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry);
  for (const sx of [-3, 0, 3]) for (const sz of [-1, 1]) p.box(0.2, 10, 0.2, 0x9aa0ac, 'smooth', { x: sx, z: sz });
  for (const y of [3, 6.5, 10]) p.box(6.6, 0.25, 2.4, 0xc8904a, 'smooth', { y });
  p.add(new BoxGeometry(0.15, 7, 0.15), 0x9aa0ac, 'smooth', { y: 4, z: 1, rz: 0.8 });
};

export const barrier: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry).add(new CylinderGeometry(0.4, 0.8, 1.2, 4, 1), 0xd8d8d8, 'smooth', { y: 0.6, ry: Math.PI / 4, sx: 2.6 });
  for (let i = -1; i <= 1; i += 1) p.box(0.5, 0.3, 1.05, 0xe0342b, 'smooth', { x: i * 1.1, y: 0.4 });
};

export const cones: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry);
  for (const [cx, cz] of [[0, 0], [1.2, 0.6], [-1.1, 0.8]] as const) {
    p.box(0.8, 0.1, 0.8, 0xff7a1c, 'smooth', { x: cx, z: cz }).add(new ConeGeometry(0.3, 1, 8), 0xff7a1c, 'smooth', { x: cx, y: 0.6, z: cz })
      .add(new TorusGeometry(0.2, 0.05, 4, 10), 0xffffff, 'smooth', { x: cx, y: 0.6, z: cz, rx: Math.PI / 2 });
  }
};

// -------------------------------------------------------------- prisons

export const fence: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry);
  for (let i = -3; i <= 3; i += 1) p.box(0.15, 5, 0.15, 0x8a94a8, 'smooth', { x: i * 1.5 });
  for (const y of [1.5, 3, 4.5]) p.box(9.2, 0.1, 0.1, 0x9aa0ac, 'smooth', { y });
  for (let i = -6; i <= 6; i += 1) p.add(new BoxGeometry(0.05, 4.8, 0.05), 0xb0b8c4, 'smooth', { x: i * 0.7, y: 2.5, rz: 0.4 });
  for (let i = -4; i <= 4; i += 1) p.add(new TorusGeometry(0.2, 0.03, 4, 8), 0xb0b8c4, 'smooth', { x: i, y: 5.2 });
};

export const guardTower: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry);
  for (const [cx, cz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]] as const) p.box(0.4, 12, 0.4, 0x6a7282, 'smooth', { x: cx, z: cz });
  p.box(5, 0.5, 5, 0x5a6272, 'smooth', { y: 12 }).box(5, 1.5, 5, 0x8a94a8, 'smooth', { y: 12.5 }).box(4.6, 1.6, 4.6, 0x9fd8ff, 'glow', { y: 14 })
    .add(new ConeGeometry(4, 2, 4), 0x3a4252, 'smooth', { y: 16.6, ry: Math.PI / 4 }).add(new CylinderGeometry(0.4, 0.2, 0.6, 8), 0xfff4c0, 'glow', { y: 13.3, z: 2.6, rx: Math.PI / 2 });
};

export const cellBlock: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry).box(12, 6, 5, 0xa0a4ac, 'stud');
  for (let i = -2; i <= 2; i += 1) {
    p.box(1.8, 3.6, 0.1, 0x2a2e3a, 'smooth', { x: i * 2.3, z: 2.51 });
    for (let k = -2; k <= 2; k += 1) p.box(0.08, 3.6, 0.12, 0x8a94a8, 'smooth', { x: i * 2.3 + k * 0.35, z: 2.56 });
  }
  p.box(12.4, 0.5, 5.4, 0x6a7282, 'smooth', { y: 6 });
};

export const concreteBlock: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).box(3, 1.2, 1.2, 0xc8c8c0, 'stud').box(3.02, 0.25, 1.22, 0xffd23a, 'smooth', { y: 0.5 });
};

// -------------------------------------------------------------- science

export const tank: PropFn = (b, x, z, s = 1, ry = 0) => {
  const hue = [0x3dff6e, 0x3fd6ff, 0xff5ad0, 0xffd23a][Math.abs(Math.floor(x + z * 3)) % 4]!;
  P(b, x, z, s, ry).cyl(1.3, 1.5, 0.8, 0x6a7282).cyl(1.05, 1.05, 4, hue, 'glow', { y: 0.8 }).cyl(1.3, 1.3, 0.6, 0x6a7282, 'smooth', { y: 4.8 })
    .add(new SphereGeometry(0.5, 8, 6), 0x2a3a2a, 'smooth', { y: 2.8 }).cyl(0.12, 0.12, 2.5, 0x3a4252, 'smooth', { y: 5.4 });
};

export const console_: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).box(3, 1.1, 1.3, 0x3a4252).add(new BoxGeometry(3, 0.2, 1.4), 0x2a2e3a, 'smooth', { y: 1.2, rx: -0.4 })
    .box(2.8, 1.6, 0.15, 0x1a2a3a, 'smooth', { y: 1.4, z: -0.6 }).box(2.5, 1.3, 0.05, 0x3fd6ff, 'glow', { y: 1.55, z: -0.5 })
    .box(0.3, 0.1, 0.3, 0xff3a3a, 'glow', { x: -1, y: 1.3, z: 0.2 }).box(0.3, 0.1, 0.3, 0x3dff6e, 'glow', { x: -0.5, y: 1.3, z: 0.2 });
};

export const cables: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry);
  [0x1a1a22, 0xd84a3a, 0x3a7ac8].forEach((c, i) => p.add(new CylinderGeometry(0.1, 0.1, 6, 5), c, 'smooth', { x: i * 0.3 - 0.3, y: 0.1, rz: Math.PI / 2, ry: 0.3 * i }));
};

export const holoGlobe: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).cyl(2.4, 2.8, 1.2, 0x3a4252).cyl(2.2, 2.2, 0.1, 0x3fd6ff, 'glow', { y: 1.2 })
    .add(new SphereGeometry(1.4, 12, 8), 0x3fd6ff, 'glow', { y: 3.4, sy: 1 })
    .add(new TorusGeometry(2, 0.05, 4, 24), 0x9ff6ff, 'glow', { y: 3.4, rx: Math.PI / 2 });
};

export const satelliteDish: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).cyl(0.5, 0.8, 3, 0x9aa0ac).add(new SphereGeometry(2.4, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), 0xf0f0f0, 'smooth', { y: 4.2, rx: -Math.PI / 2 - 0.5 })
    .add(new CylinderGeometry(0.06, 0.06, 2, 4), 0x6a7282, 'smooth', { y: 4.6, z: 1.3, rx: 1.1 });
};

export const antenna: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry).cyl(0.12, 0.3, 14, 0x8a94a8);
  for (const y of [5, 8, 11]) p.box(3 - y * 0.15, 0.1, 0.1, 0x8a94a8, 'smooth', { y });
  p.add(new SphereGeometry(0.3, 8, 6), 0xff3a3a, 'glow', { y: 14.2 });
};

// -------------------------------------------------------------- rooftops

export const acUnit: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).box(3, 2, 2.4, 0xd0d4dc).add(new CylinderGeometry(0.9, 0.9, 0.1, 12), 0x3a4252, 'smooth', { y: 2.05 })
    .add(new BoxGeometry(1.8, 0.05, 0.1), 0x9aa0ac, 'smooth', { y: 2.12, ry: 0.5 });
};

export const vent: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).cyl(0.6, 0.6, 1.6, 0x9aa0ac).add(new ConeGeometry(0.9, 0.6, 10), 0x8a94a8, 'smooth', { y: 1.9 });
};

export const waterTank: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry);
  for (const [cx, cz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]] as const) p.box(0.3, 5, 0.3, 0x6a4a3a, 'smooth', { x: cx, z: cz });
  p.cyl(2.3, 2.3, 4, 0xa87a4a, 'smooth', { y: 5 }).add(new ConeGeometry(2.5, 1.6, 12), 0x6a4a3a, 'smooth', { y: 9.8 });
};

// ---------------------------------------------------------------- nature

export const leafyTree: PropFn = (b, x, z, s = 1, ry = 0) => {
  const leaves = [0x4fc83a, 0x3fb04a, 0x6ad84a][Math.abs(Math.floor(x + z)) % 3]!;
  P(b, x, z, s, ry).cyl(0.4, 0.55, 3.4, 0x8a5a33).add(new SphereGeometry(2.2, 10, 8), leaves, 'stud', { y: 4.6 })
    .add(new SphereGeometry(1.5, 10, 8), leaves, 'stud', { x: 1, y: 5.8, z: -0.4 }).add(new SphereGeometry(1.4, 10, 8), leaves, 'stud', { x: -1.1, y: 5.4, z: 0.5 });
};

export const pineTree: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry).cyl(0.3, 0.4, 1.8, 0x7a4a2a);
  for (let i = 0; i < 3; i += 1) p.add(new ConeGeometry(2.1 - i * 0.5, 2.4, 8), 0x2f9e4f, 'smooth', { y: 2.6 + i * 1.4 });
};

export const snowyPine: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry).cyl(0.3, 0.4, 1.8, 0x7a4a2a);
  for (let i = 0; i < 3; i += 1) {
    p.add(new ConeGeometry(2.1 - i * 0.5, 2.4, 8), 0x2f7e6f, 'smooth', { y: 2.6 + i * 1.4 });
    p.add(new ConeGeometry(1.3 - i * 0.3, 0.9, 8), 0xffffff, 'smooth', { y: 3.3 + i * 1.4 });
  }
};

export const bush: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry);
  for (const [bx, bz, r] of [[0, 0, 1.1], [0.9, 0.3, 0.8], [-0.8, 0.2, 0.9]] as const) p.add(new SphereGeometry(r, 8, 6), 0x3fae3a, 'stud', { x: bx, y: r * 0.7, z: bz });
};

export const log: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).add(new CylinderGeometry(0.6, 0.7, 6, 10), 0x7a4a2a, 'smooth', { y: 0.6, rz: Math.PI / 2 })
    .add(new CylinderGeometry(0.5, 0.5, 0.05, 10), 0xd8b080, 'smooth', { x: 3.02, y: 0.6, rz: Math.PI / 2 });
};

export const boulder: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).add(new DodecahedronGeometry(1.6, 0), 0x9a9aa4, 'stud', { y: 1.1, sy: 0.75 }).add(new DodecahedronGeometry(0.9, 0), 0x8a8a94, 'stud', { x: 1.5, y: 0.6, z: 0.5 });
};

export const cactus: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).cyl(0.45, 0.5, 5, 0x4a9a3a).add(new SphereGeometry(0.45, 8, 6), 0x4a9a3a, 'smooth', { y: 5 })
    .cyl(0.3, 0.3, 1.8, 0x4a9a3a, 'smooth', { x: 0.9, y: 2 }).add(new CylinderGeometry(0.3, 0.3, 0.9, 8), 0x4a9a3a, 'smooth', { x: 0.55, y: 2, rz: Math.PI / 2 })
    .cyl(0.28, 0.28, 1.4, 0x4a9a3a, 'smooth', { x: -0.8, y: 2.8 }).add(new CylinderGeometry(0.28, 0.28, 0.8, 8), 0x4a9a3a, 'smooth', { x: -0.45, y: 2.8, rz: Math.PI / 2 });
};

export const palm: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry);
  for (let i = 0; i < 6; i += 1) p.cyl(0.35 - i * 0.03, 0.4 - i * 0.03, 1.3, 0xa87a4a, 'smooth', { x: i * 0.15, y: i * 1.25 });
  for (let i = 0; i < 6; i += 1) p.add(new BoxGeometry(0.8, 0.1, 3.4), 0x3fb04a, 'smooth', { x: 0.9 + Math.sin(i) * 1.4, y: 7.6, z: Math.cos(i) * 1.4, ry: i, rx: 0.4 });
};

export const iceSpikes: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry);
  for (const [cx, cz, h, r] of [[0, 0, 7, 1.4], [1.6, 0.6, 4.5, 1], [-1.4, 0.8, 3.8, 0.9], [0.4, -1.4, 3, 0.8]] as const) {
    p.add(new ConeGeometry(r, h, 6), 0xbfeaff, 'smooth', { x: cx, y: h / 2, z: cz });
  }
};

export const snowPile: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).add(new SphereGeometry(2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xf4faff, 'smooth', { sy: 0.45 })
    .add(new SphereGeometry(1.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xffffff, 'smooth', { x: 1.6, sy: 0.5 });
};

export const lavaRock: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).add(new DodecahedronGeometry(1.8, 0), 0x3a2a2a, 'stud', { y: 1.2, sy: 0.8 })
    .add(new BoxGeometry(2.4, 0.15, 0.3), 0xff6a1c, 'glow', { y: 1.6, z: 1.2, ry: 0.4 }).add(new BoxGeometry(0.3, 0.15, 2), 0xffa21a, 'glow', { x: 1.3, y: 1.2, z: 0.2 });
};

export const coralCluster: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry);
  const colors = [0xff6a9a, 0xffb04a, 0x9b6bff, 0x3fd6ff];
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    p.cyl(0.25, 0.4, 2 + (i % 3), colors[i % 4]!, 'smooth', { x: Math.cos(a) * 0.9, z: Math.sin(a) * 0.9, rz: Math.cos(a) * 0.3 });
  }
  p.add(new SphereGeometry(0.8, 8, 6), 0xff6a9a, 'smooth', { y: 0.4, sy: 0.6 });
};

export const seaweed: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry);
  for (let i = 0; i < 4; i += 1) p.add(new ConeGeometry(0.25, 4 + i, 5), 0x3aa86a, 'smooth', { x: i * 0.5 - 0.7, y: (4 + i) / 2, rz: 0.15 * (i - 1.5) });
};

export const mushroomCluster: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry);
  for (const [mx, mz, h, c] of [[0, 0, 3, 0xd0ff4a], [1.5, 0.6, 2, 0xff5ad0], [-1.3, 0.8, 1.6, 0x3fd6ff]] as const) {
    p.cyl(0.25, 0.35, h, 0xf4efe3, 'smooth', { x: mx, z: mz }).add(new SphereGeometry(h * 0.45, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), c, 'glow', { x: mx, y: h, z: mz });
  }
};

export const deadTree: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).cyl(0.35, 0.55, 6, 0x4a3a3a).add(new CylinderGeometry(0.12, 0.2, 3, 5), 0x4a3a3a, 'smooth', { x: 0.9, y: 5.4, rz: -0.8 })
    .add(new CylinderGeometry(0.1, 0.18, 2.4, 5), 0x4a3a3a, 'smooth', { x: -0.8, y: 4.6, rz: 0.9 }).add(new CylinderGeometry(0.08, 0.14, 1.8, 5), 0x4a3a3a, 'smooth', { x: 0.2, y: 6.8, rz: 0.3 });
};

// ----------------------------------------------------------- spooky / old

export const gravestones: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry);
  for (const [gx, gz, t] of [[-1.6, 0, 0], [0.4, 0.4, 1], [2, -0.3, 0]] as const) {
    if (t === 0) p.box(1.1, 1.6, 0.35, 0x9aa0ac, 'stud', { x: gx, z: gz }).add(new CylinderGeometry(0.55, 0.55, 0.35, 10, 1, false, 0, Math.PI), 0x9aa0ac, 'smooth', { x: gx, y: 1.6, z: gz, rx: Math.PI / 2, rz: Math.PI / 2 });
    else p.box(0.25, 2.2, 0.25, 0x8a8a94, 'smooth', { x: gx, z: gz }).box(1.2, 0.25, 0.25, 0x8a8a94, 'smooth', { x: gx, y: 1.5, z: gz });
  }
};

export const hauntedHouse: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry).box(12, 9, 9, 0x6a5a7a, 'stud').add(new ConeGeometry(8.5, 5, 4), 0x3a2a4a, 'smooth', { y: 11.5, ry: Math.PI / 4, sz: 0.8 })
    .box(3, 10, 3, 0x6a5a7a, 'stud', { x: 4, y: 0 }).add(new ConeGeometry(2.4, 5, 4), 0x3a2a4a, 'smooth', { x: 4, y: 12.5, ry: Math.PI / 4 });
  for (const [wx, wy] of [[-3, 2], [0, 2], [-3, 5.5], [0, 5.5], [4, 7]] as const) p.box(1.3, 1.6, 0.1, 0xffd23a, 'glow', { x: wx, y: wy, z: 4.55 });
};

export const obelisk: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).box(3, 1, 3, 0xd8b060, 'stud').add(new CylinderGeometry(0.6, 1.1, 12, 4), 0xe8c878, 'stud', { y: 7, ry: Math.PI / 4 })
    .add(new ConeGeometry(0.85, 1.4, 4), 0xffd23a, 'glow', { y: 13.7, ry: Math.PI / 4 });
};

export const brokenColumn: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).box(2.6, 0.6, 2.6, 0xd8d0c0, 'stud').cyl(0.9, 1, 5, 0xe8e0d0, 'stud', { y: 0.6 }, 12)
    .add(new CylinderGeometry(0.9, 0.9, 1.4, 12), 0xe8e0d0, 'stud', { x: 2, y: 0.9, rz: Math.PI / 2 - 0.1 });
};

export const tentProp: PropFn = (b, x, z, s = 1, ry = 0) => {
  const colors = [[0xff4a4a, 0xffffff], [0x3fa9ff, 0xffd23a], [0x9b6bff, 0xffffff]] as const;
  const [a, c] = colors[Math.abs(Math.floor(x + z)) % 3]!;
  const p = P(b, x, z, s, ry).cyl(3, 3, 3, a, 'smooth', {}, 12);
  for (let i = 0; i < 6; i += 1) p.add(new BoxGeometry(0.6, 3.02, 0.1), c, 'smooth', { x: Math.cos(i) * 2.98, y: 1.5, z: Math.sin(i) * 2.98, ry: -i + Math.PI / 2 });
  p.add(new ConeGeometry(3.3, 3, 12), c, 'smooth', { y: 4.5 }).add(new SphereGeometry(0.3, 6, 5), 0xffd23a, 'glow', { y: 6.2 });
};

export const balloons: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry).box(1.4, 1, 1.4, 0xffd23a, 'stud');
  [0xff4a4a, 0x3fa9ff, 0x5ae04a, 0xff5ad0].forEach((c, i) => {
    p.add(new CylinderGeometry(0.02, 0.02, 3 + i * 0.4, 3), 0xffffff, 'smooth', { x: (i - 1.5) * 0.3, y: 1 + (3 + i * 0.4) / 2 });
    p.add(new SphereGeometry(0.55, 8, 6), c, 'smooth', { x: (i - 1.5) * 0.3, y: 4.3 + i * 0.4, sy: 1.2 });
  });
};

// ----------------------------------------------------------------- sci-fi

export const neonSign: PropFn = (b, x, z, s = 1, ry = 0) => {
  const c = [0xff2ea0, 0x3dd6ff, 0xd0ff4a, 0xffd23a][Math.abs(Math.floor(x * 3 + z)) % 4]!;
  P(b, x, z, s, ry).box(0.3, 7, 0.3, 0x2a2a3a).box(5, 2.4, 0.3, 0x14141f, 'smooth', { y: 7 }).box(4.4, 0.4, 0.34, c, 'glow', { y: 8.6 }).box(3, 0.4, 0.34, c, 'glow', { y: 7.6 });
};

export const neonTower: PropFn = (b, x, z, s = 1, ry = 0) => {
  const h = 34 + (Math.abs(Math.floor(x + z * 3)) % 4) * 8;
  const c = [0xff2ea0, 0x3dd6ff, 0xb16bff][Math.abs(Math.floor(x)) % 3]!;
  const p = P(b, x, z, s, ry).box(10, h, 10, 0x3a3a5a, 'smooth');
  for (let y = 3; y < h; y += 5) p.box(10.1, 0.4, 10.1, c, 'glow', { y });
  p.box(0.4, h, 0.4, c, 'glow', { x: 5, z: 5 }).box(0.4, h, 0.4, c, 'glow', { x: -5, z: 5 });
};

export const ufo: PropFn = (b, x, z, s = 1, ry = 0) => {
  // Crashed: half buried, tilted into its own crater.
  P(b, x, z, s, ry).add(new CylinderGeometry(9, 9, 0.6, 24), 0x5a4a6a, 'smooth', { y: 0.1 })
    .add(new SphereGeometry(6, 20, 8), 0xb0b8c8, 'smooth', { y: 1.6, sy: 0.3, rz: 0.35 })
    .add(new SphereGeometry(2.4, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x9ff6c0, 'glow', { x: -0.7, y: 2.9, rz: 0.35 })
    .add(new TorusGeometry(6, 0.2, 6, 24), 0x3dff6e, 'glow', { y: 1.6, rx: Math.PI / 2, rz: 0.35 });
};

export const alienPod: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).add(new SphereGeometry(1.2, 10, 8), 0x5a3a7a, 'smooth', { y: 1.2, sy: 1.4 }).add(new SphereGeometry(0.6, 8, 6), 0x3dff6e, 'glow', { y: 1.9, z: 0.8, sz: 0.4 })
    .add(new ConeGeometry(0.3, 1.2, 5), 0x3a2a4a, 'smooth', { x: 0.8, y: 0.4, rz: -0.8 });
};

export const crystalCluster: PropFn = (b, x, z, s = 1, ry = 0) => {
  const c = [0xb16bff, 0x3fd6ff, 0xff5ad0, 0x3dff6e][Math.abs(Math.floor(x * 2 + z)) % 4]!;
  const p = P(b, x, z, s, ry);
  for (const [cx, cz, h, r, t] of [[0, 0, 6, 1.1, 0], [1.4, 0.5, 4, 0.8, -0.3], [-1.2, 0.6, 3.4, 0.7, 0.35], [0.3, -1.2, 2.6, 0.6, 0.2]] as const) {
    p.add(new OctahedronGeometry(r, 0), c, 'glow', { x: cx, y: h / 2, z: cz, sy: h / (2 * r), rz: t });
  }
};

export const lunarDome: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).add(new SphereGeometry(6, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0xe8ecf4, 'smooth')
    .add(new SphereGeometry(6.05, 18, 10, 0, Math.PI * 2, Math.PI * 0.28, Math.PI * 0.06), 0x3dd6ff, 'glow')
    .box(3, 3, 3, 0xd0d8e0, 'smooth', { z: 6 }).box(2, 2.2, 0.1, 0x3dd6ff, 'glow', { z: 7.55 });
};

export const rover: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry).box(2.6, 1, 3.6, 0xe8ecf4, 'smooth', { y: 0.8 }).box(1.4, 0.2, 1.8, 0x3a6ab0, 'smooth', { y: 1.8 });
  for (const sx of [-1.4, 1.4]) for (const sz of [-1.3, 0, 1.3]) p.add(new CylinderGeometry(0.45, 0.45, 0.4, 10), 0x3a3a44, 'smooth', { x: sx, y: 0.45, z: sz, rz: Math.PI / 2 });
  p.cyl(0.05, 0.05, 1.6, 0x9aa0ac, 'smooth', { x: 0.8, y: 1.8, z: -1 });
};

export const flag: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).cyl(0.07, 0.07, 6, 0xd0d4dc).box(2.4, 1.5, 0.05, 0x3fa9ff, 'smooth', { x: 1.2, y: 4.4 }).box(1, 0.6, 0.06, 0xffffff, 'smooth', { x: 0.6, y: 5, z: 0 });
};

export const runePillar: PropFn = (b, x, z, s = 1, ry = 0) => {
  const c = [0xff8a1c, 0xb16bff, 0x3dd6ff][Math.abs(Math.floor(x + z)) % 3]!;
  const p = P(b, x, z, s, ry).box(2.8, 0.8, 2.8, 0x4a3a3a, 'stud').box(1.8, 10, 1.8, 0x5a4a4a, 'stud', { y: 0.8 });
  for (let y = 2; y < 10; y += 2.4) p.box(1.85, 0.5, 1.85, c, 'glow', { y });
  p.add(new OctahedronGeometry(0.9, 0), c, 'glow', { y: 12 });
};

export const darkSpire: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).add(new ConeGeometry(2.6, 18, 5), 0x2a1a3a, 'smooth', { y: 9 }).add(new ConeGeometry(1.4, 9, 5), 0x3a2a4a, 'smooth', { x: 2.4, y: 4.5, rz: -0.2 })
    .add(new BoxGeometry(0.3, 12, 0.3), 0xb16bff, 'glow', { y: 8, z: 1.2, rx: 0.12 });
};

export const turret: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).cyl(1.6, 2, 2, 0x5a6272).add(new SphereGeometry(1.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x6a7282, 'smooth', { y: 2 })
    .add(new CylinderGeometry(0.25, 0.25, 3, 8), 0x3a4252, 'smooth', { y: 2.8, z: 1.6, rx: Math.PI / 2 - 0.3 }).box(0.5, 0.2, 0.3, 0xff3a3a, 'glow', { y: 3, z: 1.1 });
};

export const planet: PropFn = (b, x, z, s = 1, ry = 0) => {
  // A body in the sky: drawn far off and high up, lit by itself.
  const c = [0xff8ad0, 0x7ad0ff, 0xffd87a][Math.abs(Math.floor(x + z)) % 3]!;
  P(b, x, z, s, ry).add(new SphereGeometry(8, 18, 12), c, 'glow', { y: 40 }).add(new TorusGeometry(12, 0.8, 4, 32), 0xffffff, 'glow', { y: 40, rx: 1.2 });
};

export const cloudBank: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry);
  for (let i = 0; i < 6; i += 1) p.add(new SphereGeometry(2.2 + (i % 3), 10, 6), 0xffffff, 'smooth', { x: (i - 2.5) * 2.6, y: 0.6, z: Math.sin(i * 1.7) * 1.5, sy: 0.55 });
};

export const jet: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).add(new CylinderGeometry(0.9, 1.1, 8, 10), 0x3a4a6a, 'smooth', { y: 1.8, rx: Math.PI / 2 })
    .add(new ConeGeometry(0.9, 2.4, 10), 0x3a4a6a, 'smooth', { y: 1.8, z: 5.2, rx: Math.PI / 2 })
    .add(new BoxGeometry(9, 0.2, 3), 0x2a3a5a, 'smooth', { y: 1.5, z: -0.5 }).add(new BoxGeometry(0.2, 2.4, 1.8), 0x2a3a5a, 'smooth', { y: 3, z: -3.4 })
    .add(new SphereGeometry(0.8, 10, 6), 0x9fd8ff, 'glow', { y: 2.5, z: 2.2, sz: 1.8 })
    .add(new CylinderGeometry(0.7, 0.7, 0.2, 10), 0xff8a1c, 'glow', { y: 1.8, z: -4.05, rx: Math.PI / 2 })
    .cyl(0.12, 0.12, 1.1, 0x3a3a44, 'smooth', { z: 2.6 }).cyl(0.12, 0.12, 1.1, 0x3a3a44, 'smooth', { x: -2, z: -1 }).cyl(0.12, 0.12, 1.1, 0x3a3a44, 'smooth', { x: 2, z: -1 });
};

export const shieldWall: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).box(8, 0.8, 1.2, 0x5a6272).box(0.6, 5, 0.6, 0x5a6272, 'smooth', { x: -3.8 }).box(0.6, 5, 0.6, 0x5a6272, 'smooth', { x: 3.8 })
    .box(7, 4, 0.12, 0x3fd6ff, 'glow', { y: 0.8 });
};

export const heroStatue: PropFn = (b, x, z, s = 1, ry = 0) => {
  // A blocky giant in a heroic pose, on a plinth: the universe's founders.
  const colors = [[0x3a6ae0, 0xe0342b], [0x2a2e3a, 0xffd23a], [0xe0342b, 0xffd23a], [0x3aa85a, 0x6a3aa0]] as const;
  const [suit, trim] = colors[Math.abs(Math.floor(x * 3 + z)) % colors.length]!;
  P(b, x, z, s, ry)
    .box(4, 1.6, 4, 0xd8d0c0, 'stud')
    .box(0.9, 3, 0.9, suit, 'smooth', { x: -0.55, y: 1.6 })
    .box(0.9, 3, 0.9, suit, 'smooth', { x: 0.55, y: 1.6 })
    .box(2.2, 3, 1.2, suit, 'smooth', { y: 4.6 })
    .box(2.24, 0.4, 1.24, trim, 'smooth', { y: 4.7 })
    .box(1.4, 1.4, 1.4, 0xf2c7a0, 'smooth', { y: 7.6 })
    .add(new BoxGeometry(0.8, 2.8, 0.8), suit, 'smooth', { x: -1.5, y: 6.8, rz: -0.35 })
    .add(new BoxGeometry(0.8, 2.8, 0.8), suit, 'smooth', { x: 1.6, y: 8.4, rz: 0.2 })
    .add(new BoxGeometry(2.4, 4.4, 0.15), trim, 'smooth', { y: 5.2, z: -0.7, rx: 0.12 });
};

export const throne: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).box(10, 2, 8, 0x5a3a7a, 'stud').box(8, 1.5, 6, 0x6a4a9a, 'stud', { y: 2 }).box(4, 6, 3, 0xd4af37, 'smooth', { y: 3.5 })
    .box(6, 12, 1.2, 0xd4af37, 'smooth', { y: 3.5, z: -1.8 }).box(1.2, 3, 3, 0xd4af37, 'smooth', { x: -2.6, y: 5 }).box(1.2, 3, 3, 0xd4af37, 'smooth', { x: 2.6, y: 5 })
    .add(new OctahedronGeometry(0.8, 0), 0xb16bff, 'glow', { y: 16 });
};

export const gauntletMonument: PropFn = (b, x, z, s = 1, ry = 0) => {
  const p = P(b, x, z, s, ry).box(6, 2, 6, 0x5a3a7a, 'stud').box(4, 6, 3, 0xd4af37, 'smooth', { y: 2 });
  for (let i = 0; i < 4; i += 1) p.box(0.8, 3.6, 0.9, 0xd4af37, 'smooth', { x: -1.4 + i * 0.95, y: 8 });
  p.box(0.9, 2.6, 0.9, 0xd4af37, 'smooth', { x: 2.4, y: 6.4, rz: -0.5 });
  [0xff2e2e, 0xffd23a, 0x3dff6e, 0x3fb6ff, 0xb16bff, 0xff8a1c].forEach((c, i) => p.add(new SphereGeometry(0.35, 8, 6), c, 'glow', { x: -1.4 + (i % 4) * 0.95, y: i < 4 ? 9.4 : 4.4, z: 0.55 + (i < 4 ? 0 : 1) }));
};

export const airshipDeck: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).box(14, 2, 24, 0x8aa0c8, 'smooth').box(4, 6, 6, 0xd0d8e8, 'smooth', { y: 2, z: -6 }).box(4.2, 1.2, 6.2, 0x3fd6ff, 'glow', { y: 6, z: -6 })
    .add(new CylinderGeometry(2, 2, 3, 12), 0x5a6a8a, 'smooth', { x: 7.5, y: 1, z: 6, rx: Math.PI / 2 }).add(new CylinderGeometry(2, 2, 3, 12), 0x5a6a8a, 'smooth', { x: -7.5, y: 1, z: 6, rx: Math.PI / 2 })
    .add(new CylinderGeometry(1.7, 1.7, 0.2, 12), 0x9ff6ff, 'glow', { x: 7.5, y: 1, z: 7.6, rx: Math.PI / 2 }).add(new CylinderGeometry(1.7, 1.7, 0.2, 12), 0x9ff6ff, 'glow', { x: -7.5, y: 1, z: 7.6, rx: Math.PI / 2 });
};

export const mirrorShard: PropFn = (b, x, z, s = 1, ry = 0) => {
  P(b, x, z, s, ry).box(2, 0.5, 2, 0x8aa0c8, 'stud').add(new BoxGeometry(3, 8, 0.3), 0xdff6ff, 'glow', { y: 4.5, rz: 0.2 })
    .add(new BoxGeometry(1.6, 5, 0.25), 0xc8b8ff, 'glow', { x: 1.6, y: 3, z: 0.4, rz: -0.3, ry: 0.6 });
};

export const portalRing: PropFn = (b, x, z, s = 1, ry = 0) => {
  const c = [0xb16bff, 0x3dd6ff, 0xff5ad0][Math.abs(Math.floor(x + z)) % 3]!;
  P(b, x, z, s, ry).box(6, 1, 3, 0x3a2a5a, 'stud').add(new TorusGeometry(4, 0.5, 8, 28), c, 'glow', { y: 5 }).add(new TorusGeometry(3.2, 0.12, 4, 28), 0xffffff, 'glow', { y: 5 });
};

/** A LOW floor decal (walkable): paint, cracks, grates, puddles. `y` top a hair above the floor tiles. */
export const decal = (b: PartBuilder, x: number, z: number, w: number, d: number, color: number, kind: PartKind = 'smooth', ry = 0): void => {
  b.add(new BoxGeometry(w, 0.1, d), color, kind, { x, y: 0.05, z, ry });
};

/** A builder view that adds everything `dy` higher (props standing on a base plate). */
export const lifted = (b: PartBuilder, dy: number): PartBuilder =>
  ({
    add: (geometry: Parameters<PartBuilder['add']>[0], color: Parameters<PartBuilder['add']>[1], kind: Parameters<PartBuilder['add']>[2], t: Parameters<PartBuilder['add']>[3] = {}) =>
      b.add(geometry, color, kind, { ...t, y: (t?.y ?? 0) + dy }),
    box: (w: number, h: number, depth: number, color: number | string, kind: Parameters<PartBuilder['box']>[4], t: Parameters<PartBuilder['box']>[5] = {}) =>
      b.box(w, h, depth, color, kind, { ...t, y: (t?.y ?? 0) + dy }),
  }) as unknown as PartBuilder;

