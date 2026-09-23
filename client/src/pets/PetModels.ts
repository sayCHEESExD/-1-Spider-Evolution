import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, OctahedronGeometry, SphereGeometry, TorusGeometry, type BufferGeometry } from 'three';
import { petById, type PetKind, type PetShape } from '@spider/shared';
import { PartBuilder, meshesFor, type PartKind } from '../render/PartBuilder.js';

/**
 * THE PETS, drawn in code: ten chunky, big-eyed body shapes - spider, pup,
 * cat, bat, owl, dragon, bunny, fox, drone, slime - each coloured by its pet
 * (body, detail, glow) so the Venom Egg's symbiote pup and the Cyber Egg's
 * robo pup are the same friendly shape in two very different skins. Rarer
 * pets carry more: an epic glows, a legendary wears a floating crown ring.
 * About a unit and a half tall, merged into at most three meshes, cached per
 * pet.
 */

const sphere = (r: number, w = 12, h = 10): BufferGeometry => new SphereGeometry(r, w, h);
const cyl = (rt: number, rb: number, h: number, s = 10): BufferGeometry => new CylinderGeometry(rt, rb, h, s);
const cone = (r: number, h: number, s = 8): BufferGeometry => new ConeGeometry(r, h, s);
const box = (w: number, h: number, d: number): BufferGeometry => new BoxGeometry(w, h, d);

/** Two big cartoon eyes on a face at `z`. */
const eyes = (b: PartBuilder, y: number, z: number, spread: number, size: number, iris = 0x111111, glow = false): void => {
  for (const side of [-1, 1]) {
    b.add(sphere(size, 10, 8), 0xffffff, glow ? 'glow' : 'smooth', { x: side * spread, y, z, sz: 0.5 });
    b.add(sphere(size * 0.55, 8, 6), iris, glow ? 'glow' : 'smooth', { x: side * spread, y: y - size * 0.1, z: z + size * 0.3, sz: 0.4 });
  }
};
const ears = (b: PartBuilder, color: number, y: number, spread: number, size: number, tilt = 0.3): void => {
  for (const side of [-1, 1]) b.add(cone(size * 0.5, size, 6), color, 'smooth', { x: side * spread, y, rz: side * -tilt });
};
const batWings = (b: PartBuilder, color: number, y: number, span: number): void => {
  for (const side of [-1, 1]) {
    b.add(box(span, 0.5, 0.04), color, 'smooth', { x: side * (0.35 + span / 2), y, rz: side * 0.35 });
    b.add(cone(0.1, 0.3, 4), color, 'smooth', { x: side * (0.35 + span), y: y + 0.3, rz: side * -0.4 });
  }
};

type Maker = (b: PartBuilder, pet: PetKind) => void;

const MAKERS: Readonly<Record<PetShape, Maker>> = {
  spider: (b, pet) => {
    const [body, detail, glow] = pet.colors;
    b.add(sphere(0.45), body, 'smooth', { y: 0.6, z: -0.2, sz: 1.2 });
    b.add(sphere(0.34), body, 'smooth', { y: 0.62, z: 0.34 });
    // A spider emblem on its back.
    b.add(box(0.08, 0.34, 0.02), detail, 'smooth', { y: 0.98, z: -0.2, rx: -Math.PI / 2 });
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i += 1) {
        const z = 0.3 - i * 0.22;
        b.add(cyl(0.035, 0.035, 0.55, 5), body, 'smooth', { x: side * 0.45, y: 0.62, z, rz: side * 1.0 });
        b.add(cyl(0.03, 0.03, 0.5, 5), body, 'smooth', { x: side * 0.78, y: 0.35, z, rz: side * -0.35 });
      }
    }
    eyes(b, 0.72, 0.62, 0.12, 0.1, glow, true);
    b.add(sphere(0.05, 6, 5), glow, 'glow', { x: 0, y: 0.84, z: 0.6 });
  },
  pup: (b, pet) => {
    const [body, detail, glow] = pet.colors;
    b.add(sphere(0.42), body, 'smooth', { y: 0.55, z: -0.1, sz: 1.25 });
    b.add(sphere(0.38), body, 'smooth', { y: 0.95, z: 0.32 });
    b.add(sphere(0.18), detail, 'smooth', { y: 0.85, z: 0.62, sy: 0.8 });
    b.add(sphere(0.07, 6, 5), 0x111111, 'smooth', { y: 0.9, z: 0.78 });
    for (const side of [-1, 1]) {
      b.add(box(0.14, 0.42, 0.24), detail, 'smooth', { x: side * 0.33, y: 1.05, z: 0.22, rz: side * 0.5 });
      for (const z of [-0.35, 0.2]) b.add(cyl(0.09, 0.09, 0.35, 6), body, 'smooth', { x: side * 0.2, y: 0.18, z });
    }
    b.add(cone(0.07, 0.4, 6), body, 'smooth', { y: 0.72, z: -0.6, rx: -0.9 });
    eyes(b, 1.02, 0.62, 0.15, 0.09, glow, true);
  },
  cat: (b, pet) => {
    const [body, detail, glow] = pet.colors;
    b.add(sphere(0.4), body, 'smooth', { y: 0.5, sz: 1.2 });
    b.add(sphere(0.36), body, 'smooth', { y: 0.95, z: 0.25 });
    ears(b, body, 1.28, 0.2, 0.3, 0.2);
    b.add(sphere(0.12), detail, 'smooth', { y: 0.86, z: 0.55, sy: 0.7 });
    for (const side of [-1, 1]) b.add(box(0.3, 0.02, 0.02), detail, 'smooth', { x: side * 0.28, y: 0.86, z: 0.56, rz: side * 0.15 });
    b.add(cyl(0.05, 0.05, 0.8, 6), body, 'smooth', { y: 0.9, z: -0.55, rx: -0.4 });
    b.add(sphere(0.08), glow, 'glow', { y: 1.26, z: -0.72 });
    eyes(b, 1.0, 0.56, 0.14, 0.09, glow, true);
  },
  bat: (b, pet) => {
    const [body, detail, glow] = pet.colors;
    b.add(sphere(0.38), body, 'smooth', { y: 1.0 });
    ears(b, body, 1.4, 0.18, 0.3, 0.15);
    batWings(b, detail, 1.02, 0.6);
    b.add(cone(0.04, 0.12, 4), 0xffffff, 'smooth', { x: -0.08, y: 0.82, z: 0.32, rx: Math.PI });
    b.add(cone(0.04, 0.12, 4), 0xffffff, 'smooth', { x: 0.08, y: 0.82, z: 0.32, rx: Math.PI });
    eyes(b, 1.06, 0.32, 0.13, 0.08, glow, true);
  },
  owl: (b, pet) => {
    const [body, detail, glow] = pet.colors;
    b.add(sphere(0.48), body, 'smooth', { y: 0.75, sy: 1.15 });
    b.add(sphere(0.3), detail, 'smooth', { y: 0.62, z: 0.25, sz: 0.5 });
    ears(b, body, 1.32, 0.24, 0.26, 0.4);
    for (const side of [-1, 1]) b.add(box(0.12, 0.62, 0.4), detail, 'smooth', { x: side * 0.48, y: 0.72, rz: side * 0.2 });
    b.add(cone(0.07, 0.18, 4), 0xffc83a, 'smooth', { y: 0.92, z: 0.48, rx: Math.PI / 2 + 0.4 });
    for (let i = 0; i < 5; i += 1) b.add(cone(0.06, 0.4, 4), glow, 'glow', { x: (i - 2) * 0.1, y: 0.35, z: -0.42, rx: -2.4 });
    eyes(b, 1.02, 0.4, 0.16, 0.12, glow, true);
  },
  dragon: (b, pet) => {
    const [body, detail, glow] = pet.colors;
    b.add(sphere(0.45), body, 'smooth', { y: 0.65, sz: 1.3 });
    b.add(sphere(0.34), body, 'smooth', { y: 1.15, z: 0.4 });
    b.add(box(0.3, 0.18, 0.3), body, 'smooth', { y: 1.05, z: 0.68 });
    for (const side of [-1, 1]) b.add(cone(0.06, 0.34, 5), detail, 'smooth', { x: side * 0.16, y: 1.5, z: 0.3, rx: -0.4 });
    batWings(b, detail, 0.95, 0.7);
    for (let i = 0; i < 4; i += 1) b.add(cone(0.06, 0.2, 4), glow, 'glow', { y: 1.0 - i * 0.02, z: 0.3 - i * 0.28 });
    b.add(cone(0.12, 0.8, 6), body, 'smooth', { y: 0.55, z: -0.85, rx: -1.6 });
    eyes(b, 1.2, 0.68, 0.13, 0.08, glow, true);
  },
  bunny: (b, pet) => {
    const [body, detail, glow] = pet.colors;
    b.add(sphere(0.42), body, 'smooth', { y: 0.52 });
    b.add(sphere(0.34), body, 'smooth', { y: 0.98, z: 0.1 });
    for (const side of [-1, 1]) {
      b.add(sphere(0.12), body, 'smooth', { x: side * 0.12, y: 1.5, sy: 3 });
      b.add(sphere(0.06), detail, 'smooth', { x: side * 0.12, y: 1.5, z: 0.06, sy: 3 });
    }
    b.add(sphere(0.12), detail, 'smooth', { y: 0.5, z: -0.42 });
    b.add(sphere(0.05, 6, 5), 0xff8ab0, 'smooth', { y: 0.95, z: 0.44 });
    b.add(new OctahedronGeometry(0.1, 0), glow, 'glow', { y: 1.35, z: 0.25 });
    eyes(b, 1.04, 0.38, 0.13, 0.08, glow, true);
  },
  fox: (b, pet) => {
    const [body, detail, glow] = pet.colors;
    b.add(sphere(0.4), body, 'smooth', { y: 0.55, sz: 1.3 });
    b.add(sphere(0.34), body, 'smooth', { y: 0.96, z: 0.35 });
    b.add(cone(0.18, 0.36, 6), detail, 'smooth', { y: 0.9, z: 0.7, rx: Math.PI / 2 });
    ears(b, body, 1.3, 0.18, 0.34, 0.2);
    for (let i = 0; i < 3; i += 1) b.add(sphere(0.22 - i * 0.03), i === 2 ? detail : body, 'smooth', { y: 0.7 + i * 0.12, z: -0.55 - i * 0.2 });
    b.add(sphere(0.1), glow, 'glow', { y: 1.02, z: -1.02 });
    eyes(b, 1.02, 0.62, 0.14, 0.08, glow, true);
  },
  drone: (b, pet) => {
    const [body, detail, glow] = pet.colors;
    b.add(sphere(0.42), body, 'smooth', { y: 1.0, sy: 0.8 });
    b.add(cyl(0.3, 0.3, 0.12, 14), detail, 'smooth', { y: 0.72 });
    for (const [x, z] of [
      [-0.55, -0.55],
      [0.55, -0.55],
      [-0.55, 0.55],
      [0.55, 0.55],
    ] as const) {
      b.add(box(0.5, 0.05, 0.05), detail, 'smooth', { x: x / 2, y: 1.02, z: z / 2, ry: Math.atan2(x, z) });
      b.add(new TorusGeometry(0.2, 0.03, 5, 14), glow, 'glow', { x, y: 1.08, z, rx: Math.PI / 2 });
    }
    b.add(sphere(0.16), glow, 'glow', { y: 1.0, z: 0.34, sz: 0.5 });
  },
  slime: (b, pet) => {
    const [body, detail, glow] = pet.colors;
    b.add(sphere(0.55, 14, 10), body, 'smooth', { y: 0.42, sy: 0.75 });
    b.add(sphere(0.3), detail, 'smooth', { y: 0.78, sy: 0.8 });
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2;
      b.add(sphere(0.1), glow, 'glow', { x: Math.cos(a) * 0.4, y: 0.35, z: Math.sin(a) * 0.4 });
    }
    eyes(b, 0.7, 0.42, 0.15, 0.1, glow, true);
  },
};

const cache = new Map<number, Partial<Record<PartKind, BufferGeometry>>>();

/** A pet model. Geometry is cached per pet and shared; never dispose it, only remove it. */
export const createPetModel = (petId: number): Group => {
  const pet = petById(petId) ?? petById(1)!;
  let geometries = cache.get(pet.id);
  if (!geometries) {
    const builder = new PartBuilder();
    MAKERS[pet.shape](builder, pet);
    // Rarer pets carry more: an epic's aura ring, a legendary's crown.
    if (pet.rarity === 'epic' || pet.rarity === 'legendary') {
      builder.add(new TorusGeometry(0.62, 0.035, 6, 24), pet.colors[2], 'glow', { y: 0.08, rx: Math.PI / 2 });
    }
    if (pet.rarity === 'legendary') {
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2;
        builder.add(cone(0.06, 0.2, 4), 0xffd23a, 'glow', { x: Math.cos(a) * 0.22, y: 1.7, z: Math.sin(a) * 0.22 });
      }
      builder.add(new TorusGeometry(0.22, 0.03, 5, 16), 0xffd23a, 'glow', { y: 1.62, rx: Math.PI / 2 });
    }
    geometries = builder.geometries();
    cache.set(pet.id, geometries);
  }
  return meshesFor(geometries, `pet-${pet.id}`, false);
};
