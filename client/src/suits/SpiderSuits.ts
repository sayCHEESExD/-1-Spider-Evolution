import { BoxGeometry, ConeGeometry, CylinderGeometry, SphereGeometry, TorusGeometry } from 'three';
import type { PartBuilder } from '../render/PartBuilder.js';
import type { PaintPoint, SuitPainter } from './SuitPainter.js';

/**
 * THE NINETEEN SPIDER SUITS, as painters and accessories.
 *
 * Painters colour the supplied player model texel by texel (`SuitPainter`);
 * an optional GLOW painter lights the texels that should shine (the Stealth
 * Suit's circuit lines, 2099's emblem, the cosmic suits' stars). Accessories
 * are a handful of primitives hung off the body's bones - hoods, goggles, a
 * fedora, spider legs, a crown - merged into one mesh per kind. No image or
 * model file ships for any suit.
 *
 * Accessories are authored in CHARACTER space (x = the wearer's left, y up,
 * z forward) around their mount, sized by the measured body.
 */
export interface AccessoryContext {
  /** Head box size (height), torso width / depth / height, arm box width. */
  readonly head: number;
  readonly torsoW: number;
  readonly torsoD: number;
  readonly torsoH: number;
  readonly limb: number;
}

export type AccessoryMaker = (b: PartBuilder, c: AccessoryContext) => void;

export interface SuitDef {
  readonly paint: SuitPainter;
  /** What glows, and in what colour (0 = nothing). */
  readonly glow?: SuitPainter;
  /** How shiny: metal suits read as armour. */
  readonly metalness?: number;
  readonly roughness?: number;
  /** Around the centre of the head. */
  readonly head?: AccessoryMaker;
  /** At the top of the back, between the shoulders. */
  readonly back?: AccessoryMaker;
  /** At the centre of the chest's front face. */
  readonly chest?: AccessoryMaker;
  /** At the bottom of the right / left arm (the fist). */
  readonly handR?: AccessoryMaker;
  readonly handL?: AccessoryMaker;
}

// ------------------------------------------------------------------ helpers

const frac = (x: number): number => x - Math.floor(x);
const within = (value: number, min: number, max: number): boolean => value >= min && value <= max;
const rect = (p: PaintPoint, u0: number, u1: number, v0: number, v1: number): boolean => within(p.u, u0, u1) && within(p.v, v0, v1);
const ellipse = (u: number, v: number, cu: number, cv: number, ru: number, rv: number): boolean => ((u - cu) / ru) ** 2 + ((v - cv) / rv) ** 2 <= 1;
const isFront = (p: PaintPoint): boolean => p.face === 'front';
const isBack = (p: PaintPoint): boolean => p.face === 'back';
const isSide = (p: PaintPoint): boolean => p.face === 'left' || p.face === 'right';
const isTop = (p: PaintPoint): boolean => p.face === 'top';
const isArm = (p: PaintPoint): boolean => p.part === 'armL' || p.part === 'armR';
const isLeg = (p: PaintPoint): boolean => p.part === 'legL' || p.part === 'legR';
const noop = 0;

/** Distance from a point to a segment. */
const seg = (px: number, py: number, ax: number, ay: number, bx: number, by: number): number => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
};

/** Web lines: a grid with diagonals, the classic body pattern. */
const webGrid = (p: PaintPoint, density = 4, width = 0.075): boolean => {
  const a = frac(p.u * density);
  const b = frac(p.v * density);
  const d = frac((p.u + p.v) * density * 0.5);
  return a < width || b < width || d < width * 0.7;
};

/** A spider web radiating from (cu, cv): spokes and rings, the classic mask pattern. */
const radialWeb = (p: PaintPoint, cu: number, cv: number, spokes = 8, ring = 0.15, width = 0.03): boolean => {
  const du = p.u - cu;
  const dv = p.v - cv;
  const r = Math.hypot(du, dv);
  if (r < 0.03) return true;
  const angle = Math.atan2(dv, du);
  const spoke = frac((angle / (Math.PI * 2)) * spokes + 0.5);
  if (Math.min(spoke, 1 - spoke) * ((Math.PI * 2) / spokes) * r < width * 0.8) return true;
  return frac(r / ring) < width / ring;
};

/**
 * THE LENSES: two teardrop eyes, tilted so the outer corners rise, with a
 * dark rim. Null off the eyes.
 */
const lenses = (
  p: PaintPoint,
  options: { lens?: number; rim?: number; cv?: number; ru?: number; rv?: number; tilt?: number; spread?: number; rimWidth?: number } = {},
): number | null => {
  if (!isFront(p) || p.part !== 'head') return null;
  const cv = options.cv ?? 0.58;
  const ru = options.ru ?? 0.19;
  const rv = options.rv ?? 0.13;
  const tilt = options.tilt ?? 0.42;
  const spread = options.spread ?? 0.21;
  const rimWidth = options.rimWidth ?? 0.3;
  for (const side of [-1, 1]) {
    const cu = 0.5 + side * spread;
    const du = p.u - cu;
    const dv = p.v - cv;
    const a = side * tilt;
    const x = du * Math.cos(a) + dv * Math.sin(a);
    const y = -du * Math.sin(a) + dv * Math.cos(a);
    // A teardrop: fuller toward the nose, pointed toward the temple.
    const taper = 1 + side * x * 2.2;
    const value = (x / ru) ** 2 + (y / (rv * Math.max(0.35, taper))) ** 2;
    if (value <= 1) return value > (1 - rimWidth) ** 2 ? (options.rim ?? 0x0c0c10) : (options.lens ?? 0xf6fbff);
  }
  return null;
};

/** A spider emblem centred at (cu, cv), `s` across; `long` stretches the legs. */
const spider = (p: PaintPoint, cu: number, cv: number, s: number, long = 1, thick = 1): boolean => {
  const x = (p.u - cu) / s;
  const y = (p.v - cv) / s;
  if (ellipse(x, y, 0, 0.14, 0.1, 0.12) || ellipse(x, y, 0, -0.16, 0.085, 0.2)) return true;
  const w = 0.035 * thick;
  const ax = Math.abs(x);
  const legs: readonly (readonly [number, number, number, number, number, number])[] = [
    [0.07, 0.17, 0.3, 0.42, 0.26, 0.5 + 0.35 * long],
    [0.08, 0.07, 0.38, 0.2, 0.46 + 0.14 * long, 0.46],
    [0.08, -0.05, 0.38, -0.14, 0.46 + 0.14 * long, -0.42],
    [0.07, -0.16, 0.3, -0.36, 0.26, -0.45 - 0.35 * long],
  ];
  for (const [bx, by, kx, ky, fx, fy] of legs) {
    if (seg(ax, y, bx, by, kx, ky) < w || seg(ax, y, kx, ky, fx, fy) < w) return true;
  }
  return false;
};

const stars = (p: PaintPoint, density = 9, size = 0.06): boolean => {
  const cx = Math.floor(p.u * density);
  const cy = Math.floor(p.v * density);
  const h = Math.sin(cx * 127.1 + cy * 311.7 + (p.part.length + p.face.length) * 17.3) * 43758.5453;
  const r = frac(h);
  if (r > 0.45) return false;
  const ox = 0.2 + frac(h * 3.1) * 0.6;
  const oy = 0.2 + frac(h * 7.7) * 0.6;
  return Math.hypot(frac(p.u * density) - ox, frac(p.v * density) - oy) < size * density * 0.5;
};

const mix = (a: number, b: number, t: number): number => {
  const k = Math.max(0, Math.min(1, t));
  const r = Math.round(((a >> 16) & 255) * (1 - k) + ((b >> 16) & 255) * k);
  const g = Math.round(((a >> 8) & 255) * (1 - k) + ((b >> 8) & 255) * k);
  const bl = Math.round((a & 255) * (1 - k) + (b & 255) * k);
  return (r << 16) | (g << 8) | bl;
};


// -------------------------------------------------------------------- suits

/** 1. THE CLASSIC SUIT: red with black webbing, blue sides, big white lenses. */
const classic: SuitPainter = (p) => {
  const red = 0xd9202c;
  const blue = 0x1f4fd6;
  const line = 0x1a0608;
  const eye = lenses(p);
  if (eye !== null) return eye;
  if (p.part === 'head') {
    if (isFront(p)) return radialWeb(p, 0.5, 0.42) ? line : red;
    return webGrid(p, 3) ? line : red;
  }
  if (p.part === 'torso') {
    if (isFront(p) && spider(p, 0.5, 0.62, 0.34)) return 0x0c0c10;
    if (isBack(p) && spider(p, 0.5, 0.56, 0.5, 1.1, 1.3)) return 0xc81a24;
    const side = (isFront(p) || isBack(p)) && (p.u < 0.18 || p.u > 0.82);
    if (isSide(p) || (side && p.v < 0.75)) return blue;
    if (p.v < 0.1) return 0x14142a;
    return webGrid(p, 4) ? line : red;
  }
  if (isArm(p)) {
    if (p.ny > 0.62 || p.ny < 0.22) return webGrid(p, 4) ? line : red;
    return isSide(p) || p.face === 'back' ? blue : webGrid(p, 4) ? line : red;
  }
  if (isLeg(p)) {
    if (p.ny < 0.32) return webGrid(p, 3) ? line : red;
    return blue;
  }
  return red;
};

/** 2. THE HOMEMADE SUIT: a red hoodie, blue sweatpants, a hand-drawn spider and black goggles. */
const homemade: SuitPainter = (p) => {
  const hoodie = 0xc8262e;
  const pants = 0x2a3f8a;
  if (p.part === 'head') {
    if (isFront(p) && within(p.v, 0.46, 0.7)) {
      if (ellipse(p.u, p.v, 0.3, 0.58, 0.13, 0.1) || ellipse(p.u, p.v, 0.7, 0.58, 0.13, 0.1)) {
        return ellipse(p.u, p.v, 0.3, 0.58, 0.09, 0.065) || ellipse(p.u, p.v, 0.7, 0.58, 0.09, 0.065) ? 0xe8f0ff : 0x111111;
      }
      if (within(p.v, 0.54, 0.62)) return 0x111111;
    }
    if (isSide(p) && within(p.v, 0.54, 0.62)) return 0x111111;
    return mix(0xb52028, 0xd8303a, frac(p.u * 5 + p.v * 3) < 0.5 ? 0.2 : 0.6);
  }
  if (p.part === 'torso') {
    if (isFront(p) && spider(p, 0.5, 0.6, 0.36, 1.1, 1.4)) return 0x151515;
    if (isFront(p) && within(p.v, 0.2, 0.34) && within(p.u, 0.28, 0.72)) return 0xa81e26;
    if (p.v < 0.12) return 0x9a1a22;
    return hoodie;
  }
  if (isArm(p)) return p.ny < 0.16 ? 0x1a1a1a : hoodie;
  if (isLeg(p)) {
    if (p.ny < 0.12) return 0xf0f0f0;
    if (isSide(p) && within(p.u, 0.44, 0.56)) return 0xe8e8e8;
    return pants;
  }
  return hoodie;
};

/** 3. SCARLET SPIDER: a red bodysuit under a blue sleeveless hoodie with a big red spider. */
const scarlet: SuitPainter = (p) => {
  const red = 0xc8202c;
  const hoodie = 0x2a58d0;
  const eye = lenses(p, { lens: 0xf6fbff, rim: 0x3a0a10, ru: 0.15, rv: 0.1 });
  if (eye !== null) return eye;
  if (p.part === 'head') return isFront(p) && radialWeb(p, 0.5, 0.38, 6, 0.2) ? 0x7a0e16 : red;
  if (p.part === 'torso') {
    if (isFront(p) && spider(p, 0.5, 0.55, 0.62, 1.2, 1.6)) return 0xd8202c;
    if (isBack(p) && spider(p, 0.5, 0.55, 0.62, 1.2, 1.6)) return 0xd8202c;
    if (p.v < 0.13) return frac(p.u * 5) < 0.3 ? 0x5a3a1a : 0x7a5228;
    return hoodie;
  }
  if (isArm(p)) {
    if (p.ny < 0.2) return 0xb01822;
    return p.ny > 0.86 ? hoodie : red;
  }
  if (isLeg(p)) return p.ny < 0.3 ? 0x8a141c : red;
  return red;
};

/** 4. THE STEALTH SUIT: matte black with glowing green circuit lines and green eyes. */
const stealthLines = (p: PaintPoint): boolean => {
  if (p.part === 'head') return isFront(p) && (Math.abs(p.u - 0.5) < 0.02 || radialWeb(p, 0.5, 0.2, 6, 0.28, 0.02));
  const x = frac(p.u * 3);
  const y = frac(p.v * 3);
  return Math.abs(x - 0.5) < 0.04 || (y < 0.05 && x > 0.2 && x < 0.8);
};
const stealth: SuitPainter = (p) => {
  const eye = lenses(p, { lens: 0x6dffb0, rim: 0x05140c, ru: 0.19, rv: 0.1, tilt: 0.5 });
  if (eye !== null) return eye;
  if (p.part === 'torso' && isFront(p) && spider(p, 0.5, 0.62, 0.36)) return 0x3dffa0;
  if (stealthLines(p)) return 0x3dffa0;
  return (p.part === 'torso' && p.v < 0.1) || (isLeg(p) && p.ny < 0.14) ? 0x0a0c0e : 0x16191e;
};
const stealthGlow: SuitPainter = (p) => {
  if (lenses(p, { lens: 1, rim: 0, ru: 0.19, rv: 0.1, tilt: 0.5 }) === 1) return 0x3dff9a;
  if (p.part === 'torso' && isFront(p) && spider(p, 0.5, 0.62, 0.36)) return 0x2ae080;
  return stealthLines(p) ? 0x2ae080 : noop;
};

/** 5. IRON SPIDER: red and gold armour, gold eye plates, a gold spider. */
const ironSpider: SuitPainter = (p) => {
  const red = 0xb81a24;
  const gold = 0xe8b830;
  const eye = lenses(p, { lens: 0xfff4c8, rim: gold, ru: 0.18, rv: 0.1, rimWidth: 0.35 });
  if (eye !== null) return eye;
  if (p.part === 'head') return isFront(p) && (radialWeb(p, 0.5, 0.36, 8, 0.18, 0.025) || Math.abs(p.u - 0.5) < 0.015) ? gold : red;
  if (p.part === 'torso') {
    if (isFront(p) && spider(p, 0.5, 0.6, 0.62, 1.25, 1.5)) return gold;
    if (isBack(p) && ellipse(p.u, p.v, 0.5, 0.66, 0.2, 0.16)) return gold;
    if (p.v < 0.1) return gold;
    return frac(p.v * 6) < 0.06 ? 0x8a121a : red;
  }
  if (isArm(p)) return p.ny < 0.24 || within(p.ny, 0.5, 0.56) ? gold : red;
  if (isLeg(p)) return p.ny < 0.28 || within(p.ny, 0.5, 0.55) ? gold : red;
  return red;
};

/** 6. THE SYMBIOTE SUIT: glossy black, a big white spider front and back, big white eyes. */
const symbiote: SuitPainter = (p) => {
  const eye = lenses(p, { ru: 0.2, rv: 0.14, tilt: 0.55, rim: 0x050507 });
  if (eye !== null) return eye;
  if (p.part === 'torso' && (isFront(p) || isBack(p)) && spider(p, 0.5, 0.6, 0.8, 1.2, 1.8)) return 0xf4f6ff;
  if (isArm(p) && p.ny < 0.2 && (isFront(p) || isBack(p)) && within(p.u, 0.35, 0.65)) return 0xf4f6ff;
  if (isLeg(p) && p.ny < 0.25 && isFront(p) && within(p.u, 0.35, 0.65)) return 0xf4f6ff;
  return frac(p.u * 2 + p.v * 3) < 0.5 ? 0x121319 : 0x1a1b22;
};

/** 7. SPIDER-PUNK: a black leather jacket, ripped blue denim, a red mask with safety pins. */
const punk: SuitPainter = (p) => {
  const eye = lenses(p, { ru: 0.16, rv: 0.1, tilt: 0.2, rim: 0x101010 });
  if (eye !== null) return eye;
  if (p.part === 'head') {
    if (isFront(p) && radialWeb(p, 0.5, 0.36, 6, 0.2)) return 0x12121a;
    return 0xd8202c;
  }
  if (p.part === 'torso') {
    if (isFront(p) && within(p.u, 0.4, 0.6)) return spider(p, 0.5, 0.6, 0.3) ? 0x12121a : 0xd8202c;
    if (isBack(p) && ellipse(p.u, p.v, 0.5, 0.6, 0.22, 0.2)) return frac((p.u + p.v) * 8) < 0.5 ? 0xff3a7a : 0xffe23a;
    if (frac(p.u * 6) < 0.08 && frac(p.v * 6) < 0.08) return 0xc8c8d0;
    return 0x16161c;
  }
  if (isArm(p)) {
    if (p.ny > 0.8 && frac(p.u * 4) < 0.25) return 0xc8c8d0;
    return p.ny < 0.2 ? 0xd8202c : 0x16161c;
  }
  if (isLeg(p)) {
    if (p.ny < 0.14) return 0x3a1a1a;
    if (within(p.ny, 0.46, 0.56) && within(p.u, 0.3, 0.7)) return 0xd8c8b0;
    return frac(p.v * 12) < 0.12 ? 0x2a4a8a : 0x3a64b0;
  }
  return 0x16161c;
};

/** 8. THE MILES SUIT: black with red webbing, a long-legged red spider. */
const miles: SuitPainter = (p) => {
  const red = 0xe0202c;
  const eye = lenses(p, { ru: 0.19, rv: 0.12, tilt: 0.5 });
  if (eye !== null) return eye;
  if (p.part === 'head') return isFront(p) && radialWeb(p, 0.5, 0.36, 8, 0.16, 0.028) ? red : 0x14151c;
  if (p.part === 'torso') {
    if ((isFront(p) || isBack(p)) && spider(p, 0.5, 0.6, 0.72, 1.4, 1.5)) return red;
    return 0x14151c;
  }
  if (isArm(p)) {
    if (p.ny < 0.2) return red;
    return p.ny > 0.66 && webGrid(p, 4, 0.06) ? red : 0x14151c;
  }
  if (isLeg(p)) return p.ny < 0.26 ? red : 0x14151c;
  return 0x14151c;
};

/** 9. GHOST-SPIDER: a white hooded bodysuit with a black top, teal webbing, pink accents. */
const ghost: SuitPainter = (p) => {
  const eye = lenses(p, { rim: 0x14141c, ru: 0.16, rv: 0.1 });
  if (eye !== null) return eye;
  if (p.part === 'head') {
    if (isFront(p) && within(p.u, 0.18, 0.82) && within(p.v, 0.08, 0.84)) return radialWeb(p, 0.5, 0.36, 6, 0.2, 0.025) ? 0x3ad8e0 : 0xf4f6ff;
    return 0xf4f6ff;
  }
  if (p.part === 'torso') {
    if (p.v > 0.6) return isFront(p) && spider(p, 0.5, 0.76, 0.3) ? 0xf4f6ff : 0x14141c;
    if (p.v < 0.12) return 0x14141c;
    return (isFront(p) || isBack(p)) && webGrid(p, 3, 0.05) ? 0x3ad8e0 : 0xf4f6ff;
  }
  if (isArm(p)) {
    if (p.ny < 0.2) return 0xff5ab0;
    return p.ny > 0.75 ? 0x14141c : 0xf4f6ff;
  }
  if (isLeg(p)) {
    if (p.ny < 0.12) return 0x3ad8e0;
    return p.ny < 0.34 ? 0xff5ab0 : 0x14141c;
  }
  return 0xf4f6ff;
};

/** 10. SPIDER 2099: deep navy with a red spider-skull covering the front, red eyes. */
const skull = (p: PaintPoint): boolean => {
  if (p.part === 'head' && isFront(p)) return !within(p.v, 0.46, 0.7) || Math.abs(p.u - 0.5) < 0.08;
  if (p.part !== 'torso' || !isFront(p)) return false;
  return ellipse(p.u, p.v, 0.5, 0.7, 0.24, 0.2) || spider(p, 0.5, 0.52, 0.9, 1.3, 1.4);
};
const suit2099: SuitPainter = (p) => {
  const eye = lenses(p, { lens: 0xff3a3a, rim: 0x2a0508, ru: 0.19, rv: 0.1, tilt: 0.55 });
  if (eye !== null) return eye;
  if (skull(p)) return p.part === 'head' ? 0xd8202c : 0xe0202c;
  if (isArm(p) && p.ny < 0.24) return 0xe0202c;
  if (isLeg(p) && p.ny < 0.24) return 0xe0202c;
  return frac(p.v * 5) < 0.05 ? 0x0c1638 : 0x14225a;
};
const glow2099: SuitPainter = (p) => (lenses(p, { lens: 1, rim: 0, ru: 0.19, rv: 0.1, tilt: 0.55 }) === 1 ? 0xff3030 : noop);

/** 11. SPIDER-NOIR: a black trench coat, goggles, dark gloves - a 1930s vigilante. */
const noir: SuitPainter = (p) => {
  if (p.part === 'head') {
    if (isFront(p) && (ellipse(p.u, p.v, 0.31, 0.57, 0.12, 0.1) || ellipse(p.u, p.v, 0.69, 0.57, 0.12, 0.1))) {
      return ellipse(p.u, p.v, 0.31, 0.57, 0.08, 0.065) || ellipse(p.u, p.v, 0.69, 0.57, 0.08, 0.065) ? 0x9aa0a8 : 0x3a3a3a;
    }
    if (isFront(p) && p.v < 0.4) return frac(p.u * 6) < 0.1 ? 0x2a2a2a : 0x1c1c1e;
    return 0x1e1e20;
  }
  if (p.part === 'torso') {
    if (isFront(p) && Math.abs(p.u - 0.5) < 0.03) return 0x0a0a0a;
    if (isFront(p) && frac(p.v * 5) < 0.08 && within(p.u, 0.38, 0.46)) return 0x8a8a8a;
    if (within(p.v, 0.08, 0.16)) return 0x3a2a1a;
    return 0x26262a;
  }
  if (isArm(p)) return p.ny < 0.18 ? 0x101010 : 0x26262a;
  if (isLeg(p)) return p.ny < 0.14 ? 0x0e0e0e : 0x202024;
  return 0x26262a;
};

/** 12. FUTURE FOUNDATION: brilliant white with a black spider and black side panels. */
const future: SuitPainter = (p) => {
  const eye = lenses(p, { lens: 0x10141c, rim: 0x10141c, ru: 0.18, rv: 0.1 });
  if (eye !== null) return eye;
  if (p.part === 'head') return 0xf4f6fa;
  if (p.part === 'torso') {
    if ((isFront(p) || isBack(p)) && spider(p, 0.5, 0.6, 0.76, 1.3, 1.6)) return 0x10141c;
    if (isSide(p)) return 0x10141c;
    return frac(p.v * 8) < 0.04 ? 0xd8dce4 : 0xf4f6fa;
  }
  if (isArm(p)) return isSide(p) && within(p.u, 0.4, 0.6) ? 0x10141c : 0xf4f6fa;
  if (isLeg(p)) return isSide(p) && within(p.u, 0.4, 0.6) ? 0x10141c : p.ny < 0.14 ? 0x10141c : 0xf4f6fa;
  return 0xf4f6fa;
};

/** 13. SUPERIOR SPIDER: black and red with a long red spider and red-tipped talons. */
const superior: SuitPainter = (p) => {
  const red = 0xc81820;
  const eye = lenses(p, { lens: 0xff3a3a, rim: 0x14141a, ru: 0.19, rv: 0.08, tilt: 0.6 });
  if (eye !== null) return eye;
  if (p.part === 'head') return isFront(p) && radialWeb(p, 0.5, 0.36, 8, 0.18, 0.026) ? 0x3a0a0e : red;
  if (p.part === 'torso') {
    if (isFront(p) && spider(p, 0.5, 0.58, 0.9, 1.5, 1.3)) return red;
    if (p.v > 0.7) return red;
    return 0x121218;
  }
  if (isArm(p)) return p.ny > 0.7 ? red : p.ny < 0.22 ? red : 0x121218;
  if (isLeg(p)) return p.ny < 0.3 ? red : 0x121218;
  return 0x121218;
};
const superiorGlow: SuitPainter = (p) => (lenses(p, { lens: 1, rim: 0, ru: 0.19, rv: 0.08, tilt: 0.6 }) === 1 ? 0xff2a2a : noop);

/** 14. SPIDER-ARMOR MK IV: silver plate armour with blue lights. */
const armor: SuitPainter = (p) => {
  const plate = 0xb8c4d0;
  const dark = 0x4a5664;
  const eye = lenses(p, { lens: 0x7ae0ff, rim: dark, ru: 0.19, rv: 0.08, tilt: 0.5 });
  if (eye !== null) return eye;
  if (p.part === 'torso' && isFront(p) && spider(p, 0.5, 0.64, 0.5, 1.2, 1.6)) return 0x3fb6ff;
  if (frac(p.u * 3) < 0.05 || frac(p.v * 4) < 0.05) return dark;
  return mix(plate, 0xe8eef4, frac(p.v * 4));
};
const armorGlow: SuitPainter = (p) => {
  if (lenses(p, { lens: 1, rim: 0, ru: 0.19, rv: 0.08, tilt: 0.5 }) === 1) return 0x5ad0ff;
  if (p.part === 'torso' && isFront(p) && spider(p, 0.5, 0.64, 0.5, 1.2, 1.6)) return 0x2a90ff;
  return noop;
};

/** 15. COSMIC SPIDER: a starfield and nebula body, a golden spider, glowing white eyes. */
const nebula = (p: PaintPoint): number => {
  const t = 0.5 + 0.5 * Math.sin(p.u * 7 + p.v * 5 + (p.part === 'torso' ? 1 : p.part.length));
  return mix(0x1a0a3a, 0x5a2a9a, t * t);
};
const cosmic: SuitPainter = (p) => {
  const eye = lenses(p, { lens: 0xffffff, rim: 0xffd23a, ru: 0.18, rv: 0.11 });
  if (eye !== null) return eye;
  if (p.part === 'torso' && isFront(p) && spider(p, 0.5, 0.6, 0.64, 1.2, 1.4)) return 0xffd23a;
  if (stars(p)) return 0xfff4d8;
  return nebula(p);
};
const cosmicGlow: SuitPainter = (p) => {
  if (lenses(p, { lens: 1, rim: 0, ru: 0.18, rv: 0.11 }) === 1) return 0xffffff;
  if (p.part === 'torso' && isFront(p) && spider(p, 0.5, 0.6, 0.64, 1.2, 1.4)) return 0xb88a1a;
  return stars(p) ? 0xfff0c8 : noop;
};

/** 16. ANTI-VENOM: white with ragged black patches and a black spider. */
const antiVenom: SuitPainter = (p) => {
  const eye = lenses(p, { lens: 0xf4f6ff, rim: 0x0a0a0e, ru: 0.21, rv: 0.13, tilt: 0.6, rimWidth: 0.45 });
  if (eye !== null) return eye;
  if (p.part === 'head') {
    if (isFront(p) && within(p.v, 0.36, 0.8) && Math.abs(p.u - 0.5) > 0.06) return 0x0a0a0e;
    return 0xf4f6ff;
  }
  if (p.part === 'torso' && (isFront(p) || isBack(p)) && spider(p, 0.5, 0.58, 0.76, 1.3, 1.5)) return 0x0a0a0e;
  const patch = Math.sin(p.u * 9 + p.v * 4) + Math.sin(p.v * 11 - p.u * 3);
  if ((isArm(p) || isLeg(p)) && patch > 1.1) return 0x0a0a0e;
  if (p.part === 'torso' && isSide(p)) return 0x0a0a0e;
  return 0xf4f6ff;
};

/** 17. CAPTAIN UNIVERSE: white and deep blue, alive with cosmic light. */
const universe: SuitPainter = (p) => {
  const eye = lenses(p, { lens: 0xd8f8ff, rim: 0x1a2a6a, ru: 0.18, rv: 0.1 });
  if (eye !== null) return eye;
  if (p.part === 'torso' && isFront(p) && spider(p, 0.5, 0.62, 0.54, 1.2, 1.5)) return 0x8af0ff;
  if (stars(p, 8, 0.05)) return 0xffffff;
  const band = (p.part === 'torso' && Math.abs(p.u - 0.5) < 0.18) || (isArm(p) && p.ny > 0.6) || (isLeg(p) && p.ny < 0.35);
  return band ? 0xeaf6ff : mix(0x14286a, 0x2a50c8, p.v);
};
const universeGlow: SuitPainter = (p) => {
  if (lenses(p, { lens: 1, rim: 0, ru: 0.18, rv: 0.1 }) === 1) return 0xaaf4ff;
  if (p.part === 'torso' && isFront(p) && spider(p, 0.5, 0.62, 0.54, 1.2, 1.5)) return 0x5ad8ff;
  return stars(p, 8, 0.05) ? 0xc8f0ff : noop;
};

/** 18. SPIDER-KING: gold armour with red webbing, a royal crest and a crown. */
const king: SuitPainter = (p) => {
  const gold = 0xe8b830;
  const deep = 0xa87818;
  const eye = lenses(p, { lens: 0xff4a3a, rim: deep, ru: 0.18, rv: 0.09, tilt: 0.55 });
  if (eye !== null) return eye;
  if (p.part === 'head') return isFront(p) && radialWeb(p, 0.5, 0.36, 8, 0.18, 0.024) ? 0xa8141c : gold;
  if (p.part === 'torso') {
    if (isFront(p) && spider(p, 0.5, 0.58, 0.7, 1.3, 1.5)) return 0xa8141c;
    if (p.v < 0.12) return 0xa8141c;
    return frac(p.u * 4) < 0.05 ? deep : gold;
  }
  if (isArm(p)) return p.ny < 0.2 || within(p.ny, 0.48, 0.54) ? 0xa8141c : gold;
  if (isLeg(p)) return p.ny < 0.22 ? 0xa8141c : frac(p.v * 3) < 0.06 ? deep : gold;
  return gold;
};
const kingGlow: SuitPainter = (p) => (lenses(p, { lens: 1, rim: 0, ru: 0.18, rv: 0.09, tilt: 0.55 }) === 1 ? 0xff5030 : noop);

/** 19. INFINITY SPIDER: a shifting rainbow body with a radiant golden spider and six stones. */
const rainbow = (p: PaintPoint): number => {
  const h = frac(p.v * 0.8 + p.u * 0.3 + (p.part === 'head' ? 0.1 : isArm(p) ? 0.3 : isLeg(p) ? 0.6 : 0));
  const hue = h * 6;
  const k = frac(hue);
  const palette = [0xff3a8a, 0xff8a2a, 0xffe23a, 0x3aff8a, 0x3ab0ff, 0xb05aff];
  return mix(palette[Math.floor(hue) % 6]!, palette[(Math.floor(hue) + 1) % 6]!, k);
};
const infinity: SuitPainter = (p) => {
  const eye = lenses(p, { lens: 0xffffff, rim: 0xffd23a, ru: 0.19, rv: 0.11, rimWidth: 0.35 });
  if (eye !== null) return eye;
  if (p.part === 'torso' && isFront(p) && spider(p, 0.5, 0.6, 0.66, 1.3, 1.6)) return 0xffe27a;
  if (p.part === 'torso' && (p.v < 0.1 || isSide(p))) return 0xd4a020;
  return mix(rainbow(p), 0x1a1030, 0.35);
};
const infinityGlow: SuitPainter = (p) => {
  if (lenses(p, { lens: 1, rim: 0, ru: 0.19, rv: 0.11, rimWidth: 0.35 }) === 1) return 0xffffff;
  if (p.part === 'torso' && isFront(p) && spider(p, 0.5, 0.6, 0.66, 1.3, 1.6)) return 0xffc83a;
  return (isArm(p) || isLeg(p)) && frac(p.ny * 4) < 0.08 ? mix(rainbow(p), 0, 0.3) : noop;
};

// --------------------------------------------------------------- accessories

const hood = (b: PartBuilder, c: AccessoryContext, color: number, lining = color): void => {
  const h = c.head;
  b.add(new BoxGeometry(h * 1.14, h * 0.2, h * 1.1), color, 'smooth', { y: h * 0.56, z: -h * 0.04 });
  b.add(new BoxGeometry(h * 1.14, h * 1.02, h * 0.18), color, 'smooth', { y: h * 0.02, z: -h * 0.56 });
  for (const side of [-1, 1]) b.add(new BoxGeometry(h * 0.1, h * 0.98, h * 0.98), color, 'smooth', { x: side * h * 0.57, y: h * 0.04, z: -h * 0.06 });
  b.add(new BoxGeometry(h * 1.0, h * 0.06, h * 0.06), lining, 'smooth', { y: h * 0.47, z: h * 0.49 });
};

const cape = (b: PartBuilder, c: AccessoryContext, color: number, length = 1.9): void => {
  const h = c.torsoH * length;
  b.add(new BoxGeometry(c.torsoW * 1.18, h, 0.08), color, 'smooth', { y: -h / 2 + 0.1, z: -0.06, rx: 0.1 });
  b.add(new BoxGeometry(c.torsoW * 1.2, 0.18, 0.22), color, 'smooth', { y: 0.08, z: 0.02 });
};

/** Four articulated spider legs fanning from the back (Iron Spider's waldoes). */
const spiderLegs = (b: PartBuilder, color: number, tip: number, reach = 1.1): void => {
  for (const side of [-1, 1]) {
    for (const [up, spread] of [
      [0.35, 0.5],
      [-0.25, 0.75],
    ] as const) {
      b.add(new CylinderGeometry(0.045, 0.06, reach, 6), color, 'smooth', { x: side * 0.45, y: up + 0.3, z: -0.35, rz: side * (Math.PI / 2 - spread), rx: -0.3 });
      b.add(new CylinderGeometry(0.035, 0.045, reach * 0.9, 6), color, 'smooth', { x: side * (0.45 + reach * 0.48), y: up + 0.05, z: -0.55, rz: side * -0.2, rx: -0.2 });
      b.add(new ConeGeometry(0.05, 0.22, 5), tip, 'glow', { x: side * (0.45 + reach * 0.55), y: up - 0.42, z: -0.62, rx: Math.PI });
    }
  }
};

const SUITS: Readonly<Record<number, SuitDef>> = {
  1: { paint: classic },
  2: {
    paint: homemade,
    head: (b, c) => {
      hood(b, c, 0xb01e26, 0x8a141c);
      b.add(new BoxGeometry(c.head * 1.12, c.head * 0.1, c.head * 1.12), 0x111111, 'smooth', { y: c.head * 0.08 });
    },
  },
  3: { paint: scarlet, head: (b, c) => hood(b, c, 0x2450c0, 0x1a3a90) },
  4: { paint: stealth, glow: stealthGlow, roughness: 0.4 },
  5: {
    paint: ironSpider,
    glow: (p) => (p.part === 'torso' && isFront(p) && spider(p, 0.5, 0.6, 0.62, 1.25, 1.5) ? 0x6a4a0a : noop),
    metalness: 0.45,
    roughness: 0.32,
    back: (b) => spiderLegs(b, 0xe8b830, 0xffe8a0),
  },
  6: { paint: symbiote, roughness: 0.25 },
  7: {
    paint: punk,
    head: (b, c) => {
      for (let i = 0; i < 6; i += 1) {
        const z = (i / 5 - 0.5) * c.head * 0.9;
        b.add(new ConeGeometry(c.head * 0.09, c.head * (0.42 + (i % 2) * 0.16), 5), i % 2 ? 0xff3a7a : 0x3a8aff, 'smooth', { y: c.head * 0.62, z, rx: -0.3 + (i / 5) * 0.6 });
      }
    },
    back: (b, c) => {
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i += 1) b.add(new ConeGeometry(0.07, 0.24, 5), 0xd8d8e0, 'smooth', { x: side * (c.torsoW * 0.36 + i * 0.12), y: 0.18, z: 0.05, rz: side * -1.0 });
      }
    },
  },
  8: { paint: miles },
  9: { paint: ghost, head: (b, c) => hood(b, c, 0xf4f6ff, 0xff5ab0) },
  10: {
    paint: suit2099,
    glow: glow2099,
    roughness: 0.4,
    handR: (b) => b.add(new ConeGeometry(0.06, 0.4, 4), 0xe0202c, 'smooth', { x: -0.22, y: 0.35, rz: 0.4 }),
    handL: (b) => b.add(new ConeGeometry(0.06, 0.4, 4), 0xe0202c, 'smooth', { x: 0.22, y: 0.35, rz: -0.4 }),
  },
  11: {
    paint: noir,
    head: (b, c) => {
      b.add(new CylinderGeometry(c.head * 0.52, c.head * 0.56, c.head * 0.42, 14), 0x1a1a1c, 'smooth', { y: c.head * 0.68 });
      b.add(new CylinderGeometry(c.head * 0.9, c.head * 0.9, c.head * 0.06, 18), 0x1a1a1c, 'smooth', { y: c.head * 0.48 });
      b.add(new CylinderGeometry(c.head * 0.57, c.head * 0.57, c.head * 0.1, 14), 0x3a3a3c, 'smooth', { y: c.head * 0.56 });
    },
    back: (b, c) => {
      // The trench coat's tails and collar.
      b.add(new BoxGeometry(c.torsoW * 1.12, c.torsoH * 1.5, 0.1), 0x26262a, 'smooth', { y: -c.torsoH * 0.95, z: -0.05, rx: 0.08 });
      for (const side of [-1, 1]) b.add(new BoxGeometry(0.1, 0.34, 0.36), 0x1c1c1e, 'smooth', { x: side * c.torsoW * 0.32, y: 0.14, z: 0.2, rz: side * 0.3 });
    },
  },
  12: { paint: future, roughness: 0.3 },
  13: {
    paint: superior,
    glow: superiorGlow,
    back: (b) => spiderLegs(b, 0x1a1a22, 0xff2a2a, 1.0),
    handR: (b) => {
      for (const dx of [-0.09, 0, 0.09]) b.add(new ConeGeometry(0.035, 0.24, 4), 0xc81820, 'smooth', { x: dx, y: -0.18, z: 0.05, rx: Math.PI });
    },
    handL: (b) => {
      for (const dx of [-0.09, 0, 0.09]) b.add(new ConeGeometry(0.035, 0.24, 4), 0xc81820, 'smooth', { x: dx, y: -0.18, z: 0.05, rx: Math.PI });
    },
  },
  14: {
    paint: armor,
    glow: armorGlow,
    metalness: 0.6,
    roughness: 0.3,
    back: (b, c) => {
      b.add(new BoxGeometry(c.torsoW * 0.7, c.torsoH * 0.6, 0.3), 0x8a96a4, 'smooth', { y: -0.2, z: -0.1 });
      for (const side of [-1, 1]) b.add(new CylinderGeometry(0.1, 0.12, 0.3, 8), 0x5ad0ff, 'glow', { x: side * 0.22, y: -0.62, z: -0.12 });
    },
    chest: (b, c) => {
      for (const side of [-1, 1]) b.add(new BoxGeometry(c.limb * 1.3, 0.16, c.torsoD * 1.25), 0x9aa6b4, 'smooth', { x: side * (c.torsoW * 0.5 + c.limb * 0.45), y: c.torsoH * 0.3, z: -c.torsoD * 0.5 });
    },
  },
  15: {
    paint: cosmic,
    glow: cosmicGlow,
    head: (b, c) => b.add(new TorusGeometry(c.head * 0.5, c.head * 0.04, 6, 24), 0xffd23a, 'glow', { y: c.head * 0.84, rx: Math.PI / 2 }),
  },
  16: { paint: antiVenom, roughness: 0.25 },
  17: {
    paint: universe,
    glow: universeGlow,
    back: (b, c) => cape(b, c, 0x2a50c8, 1.8),
  },
  18: {
    paint: king,
    glow: kingGlow,
    metalness: 0.5,
    roughness: 0.3,
    head: (b, c) => {
      b.add(new CylinderGeometry(c.head * 0.5, c.head * 0.52, c.head * 0.2, 10, 1, true), 0xffd23a, 'smooth', { y: c.head * 0.6 });
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2;
        b.add(new ConeGeometry(c.head * 0.08, c.head * 0.28, 4), 0xffd23a, 'smooth', { x: Math.cos(a) * c.head * 0.48, y: c.head * 0.82, z: Math.sin(a) * c.head * 0.48 });
      }
      b.add(new SphereGeometry(c.head * 0.08, 6, 5), 0xff2e4a, 'glow', { y: c.head * 0.62, z: c.head * 0.52 });
    },
    back: (b, c) => cape(b, c, 0xa8141c, 2.0),
  },
  19: {
    paint: infinity,
    glow: infinityGlow,
    metalness: 0.3,
    roughness: 0.35,
    head: (b, c) => b.add(new TorusGeometry(c.head * 0.55, c.head * 0.05, 6, 28), 0xffe27a, 'glow', { y: c.head * 0.86, rx: Math.PI / 2 }),
    back: (b) => {
      const gems = [0xff3a3a, 0xff8a2a, 0xffe23a, 0x3aff6a, 0x3ab0ff, 0xb05aff];
      gems.forEach((color, i) => {
        const a = (i / gems.length) * Math.PI - Math.PI / 2;
        b.add(new SphereGeometry(0.13, 8, 6), color, 'glow', { x: Math.sin(a) * 0.95, y: Math.cos(a) * 0.95 + 0.1, z: -0.4 });
      });
    },
  },
};

export const suitFor = (slot: number): SuitDef => SUITS[slot] ?? SUITS[1]!;

