import { BoxGeometry, ConeGeometry, CylinderGeometry, SphereGeometry, TorusGeometry, CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import type { PartBuilder } from '../render/PartBuilder.js';
import { worldScaledUv } from './texturedBox.js';

/**
 * Shared scenery primitives for the hub and the thirty stage arenas: city
 * blocks, trees, crystals, tombstones, lamps and the rest. Every prop is a
 * few primitives into a `PartBuilder`, so a whole skyline merges into a
 * handful of meshes. None of them is solid: props stand OUTSIDE the walkable
 * area (behind walls, on wall tops) or are flat floor decals.
 */

/** Deterministic PRNG, so every client draws exactly the same world. */
export const seeded = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

let facade: CanvasTexture | null = null;

/** Building windows: a grid of pale glass panes on a neutral wall, tinted per building by vertex colour. */
export const facadeTexture = (): CanvasTexture => {
  if (facade) return facade;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f4f4f4';
  ctx.fillRect(0, 0, size, size);
  for (let gx = 0; gx < 4; gx += 1) {
    for (let gy = 0; gy < 4; gy += 1) {
      const x = gx * 32 + 6;
      const y = gy * 32 + 7;
      ctx.fillStyle = '#9fb8d8';
      ctx.fillRect(x, y, 20, 18);
      ctx.fillStyle = '#d8ecff';
      ctx.fillRect(x + 2, y + 2, 8, 14);
      ctx.fillStyle = '#c8c8c8';
      ctx.fillRect(x - 2, y + 20, 24, 3);
    }
  }
  facade = new CanvasTexture(canvas);
  facade.colorSpace = SRGBColorSpace;
  facade.wrapS = RepeatWrapping;
  facade.wrapT = RepeatWrapping;
  return facade;
};

/** A box with world-scaled UVs (one repeat per `tile` units), for the facade material. */
export const facadeBox = (w: number, h: number, d: number, tile = 6): BoxGeometry => {
  const geometry = new BoxGeometry(w, h, d);
  const uv = geometry.getAttribute('uv');
  const spans: readonly (readonly [number, number])[] = [
    [d / tile, h / tile],
    [d / tile, h / tile],
    [0.01, 0.01],
    [0.01, 0.01],
    [w / tile, h / tile],
    [w / tile, h / tile],
  ];
  for (let face = 0; face < 6; face += 1) {
    const span = spans[face]!;
    for (let corner = 0; corner < 4; corner += 1) {
      const index = face * 4 + corner;
      uv.setXY(index, uv.getX(index) * span[0], uv.getY(index) * span[1]);
    }
  }
  uv.needsUpdate = true;
  return geometry;
};

export const tree = (b: PartBuilder, x: number, z: number, s: number, leaves = 0x4fc83a, trunk = 0x8a5a33, y = 0): void => {
  b.add(worldScaledUv(new CylinderGeometry(0.35 * s, 0.45 * s, 2.6 * s, 8), 3, 3), trunk, 'stud', { x, y: y + 1.3 * s, z });
  b.add(worldScaledUv(new SphereGeometry(1.9 * s, 10, 8), 8, 6), leaves, 'stud', { x, y: y + 3.6 * s, z });
  b.add(worldScaledUv(new SphereGeometry(1.3 * s, 10, 8), 6, 4), leaves, 'stud', { x: x + 0.8 * s, y: y + 4.6 * s, z: z - 0.4 * s });
};

export const pine = (b: PartBuilder, x: number, z: number, s: number, leaves = 0x2f9e4f, y = 0): void => {
  b.add(new CylinderGeometry(0.3 * s, 0.4 * s, 1.6 * s, 6), 0x7a4a2a, 'smooth', { x, y: y + 0.8 * s, z });
  for (let i = 0; i < 3; i += 1) b.add(new ConeGeometry((2 - i * 0.5) * s, 2.2 * s, 8), leaves, 'smooth', { x, y: y + (2 + i * 1.3) * s, z });
};

export const crystal = (b: PartBuilder, x: number, z: number, s: number, color: number, y = 0): void => {
  b.add(new ConeGeometry(0.7 * s, 3.2 * s, 5), color, 'glow', { x, y: y + 1.6 * s, z });
  b.add(new ConeGeometry(0.45 * s, 2 * s, 5), color, 'glow', { x: x + 0.8 * s, y: y + 1 * s, z: z + 0.3 * s, rz: -0.4 });
  b.add(new ConeGeometry(0.4 * s, 1.8 * s, 5), color, 'glow', { x: x - 0.7 * s, y: y + 0.9 * s, z: z - 0.2 * s, rz: 0.4 });
};

export const rock = (b: PartBuilder, x: number, z: number, s: number, color: number, y = 0): void => {
  b.add(worldScaledUv(new SphereGeometry(1.6 * s, 7, 5), 6, 4), color, 'stud', { x, y: y + 0.7 * s, z, sy: 0.7 });
};

export const lamp = (b: PartBuilder, x: number, z: number, color = 0x3a4a66, glow = 0xfff1b0, height = 9): void => {
  b.add(new CylinderGeometry(0.22, 0.3, height, 8), color, 'smooth', { x, y: height / 2, z });
  b.add(new BoxGeometry(1.4, 0.3, 0.5), color, 'smooth', { x, y: height, z });
  b.add(new SphereGeometry(0.5, 10, 8), glow, 'glow', { x, y: height - 0.2, z });
};

export const tombstone = (b: PartBuilder, x: number, z: number, s: number, ry = 0): void => {
  b.add(new BoxGeometry(1.4 * s, 1.8 * s, 0.4 * s), 0x9aa0ac, 'stud', { x, y: 0.9 * s, z, ry });
  b.add(new CylinderGeometry(0.7 * s, 0.7 * s, 0.4 * s, 12, 1, false, 0, Math.PI), 0x9aa0ac, 'smooth', { x, y: 1.8 * s, z, rx: Math.PI / 2, rz: Math.PI / 2, ry });
};

export const crate = (b: PartBuilder, x: number, z: number, s: number, color = 0xc8904a, y = 0): void => {
  b.add(new BoxGeometry(2 * s, 2 * s, 2 * s), color, 'stud', { x, y: y + s, z });
};

export const barrel = (b: PartBuilder, x: number, z: number, s: number, color = 0x3a7ac8): void => {
  b.add(new CylinderGeometry(0.8 * s, 0.8 * s, 2 * s, 10), color, 'smooth', { x, y: s, z });
  b.add(new TorusGeometry(0.82 * s, 0.07 * s, 4, 12), 0x2a2e3a, 'smooth', { x, y: 1.4 * s, z, rx: Math.PI / 2 });
};

export const car = (b: PartBuilder, x: number, z: number, color: number, ry = 0): void => {
  b.add(new BoxGeometry(2.4, 1.1, 4.6), color, 'smooth', { x, y: 0.9, z, ry });
  b.add(new BoxGeometry(2.1, 0.9, 2.4), 0xbfe0ff, 'smooth', { x, y: 1.9, z: z - 0.2, ry });
  for (const sx of [-1, 1]) for (const sz of [-1.5, 1.5]) {
    const cx = Math.cos(ry) * sx * 1.2 + Math.sin(ry) * sz;
    const cz = -Math.sin(ry) * sx * 1.2 + Math.cos(ry) * sz;
    b.add(new CylinderGeometry(0.5, 0.5, 0.4, 10), 0x1a1a22, 'smooth', { x: x + cx, y: 0.5, z: z + cz, rz: Math.PI / 2, ry });
  }
};

export const pillar = (b: PartBuilder, x: number, z: number, h: number, color: number, cap = color): void => {
  b.add(worldScaledUv(new CylinderGeometry(1, 1.1, h, 12), 6, h), color, 'stud', { x, y: h / 2, z });
  b.add(new BoxGeometry(2.6, 0.6, 2.6), cap, 'stud', { x, y: h + 0.3, z });
};

export const pyramid = (b: PartBuilder, x: number, z: number, s: number, color = 0xe8c070): void => {
  b.add(new ConeGeometry(8 * s, 9 * s, 4), color, 'stud', { x, y: 4.5 * s, z, ry: Math.PI / 4 });
};

export const mushroom = (b: PartBuilder, x: number, z: number, s: number, cap: number): void => {
  b.add(new CylinderGeometry(0.5 * s, 0.7 * s, 2.4 * s, 8), 0xf4efe3, 'smooth', { x, y: 1.2 * s, z });
  b.add(new SphereGeometry(1.8 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), cap, 'glow', { x, y: 2.3 * s, z });
};

export const neon = (b: PartBuilder, x: number, y: number, z: number, w: number, h: number, color: number, ry = 0): void => {
  b.add(new BoxGeometry(w, h, 0.3), 0x14141f, 'smooth', { x, y, z, ry });
  b.add(new BoxGeometry(w * 0.86, h * 0.2, 0.36), color, 'glow', { x, y: y + h * 0.18, z, ry });
  b.add(new BoxGeometry(w * 0.6, h * 0.14, 0.36), color, 'glow', { x, y: y - h * 0.2, z, ry });
};

export const orb = (b: PartBuilder, x: number, y: number, z: number, r: number, color: number): void => {
  b.add(new SphereGeometry(r, 14, 10), color, 'glow', { x, y, z });
};

export const ring = (b: PartBuilder, x: number, y: number, z: number, r: number, color: number, rx = Math.PI / 2): void => {
  b.add(new TorusGeometry(r, r * 0.08, 6, 28), color, 'glow', { x, y, z, rx });
};

export const tent = (b: PartBuilder, x: number, z: number, s: number, a: number, c: number): void => {
  b.add(new CylinderGeometry(3 * s, 3 * s, 3 * s, 12), a, 'smooth', { x, y: 1.5 * s, z });
  b.add(new ConeGeometry(3.3 * s, 3 * s, 12), c, 'smooth', { x, y: 4.5 * s, z });
  b.add(new SphereGeometry(0.3 * s, 6, 5), 0xffd23a, 'glow', { x, y: 6.2 * s, z });
};

export const iceberg = (b: PartBuilder, x: number, z: number, s: number): void => {
  b.add(new ConeGeometry(3 * s, 7 * s, 6), 0xdff6ff, 'smooth', { x, y: 3.5 * s, z });
  b.add(new ConeGeometry(2 * s, 5 * s, 6), 0xbfeaff, 'smooth', { x: x + 2 * s, y: 2.5 * s, z: z + 1 * s });
};

export const coral = (b: PartBuilder, x: number, z: number, s: number, color: number): void => {
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2;
    b.add(new CylinderGeometry(0.25 * s, 0.35 * s, (2 + i * 0.5) * s, 6), color, 'smooth', { x: x + Math.cos(a) * 0.6 * s, y: (1 + i * 0.25) * s, z: z + Math.sin(a) * 0.6 * s, rz: Math.cos(a) * 0.4 });
  }
};
