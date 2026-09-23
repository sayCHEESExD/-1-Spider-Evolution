import { BoxGeometry, ConeGeometry, CylinderGeometry, OctahedronGeometry, SphereGeometry, TorusGeometry } from 'three';
import type { EnemyLook } from '@spider/shared';
import type { PartBuilder } from '../render/PartBuilder.js';
import type { PaintPoint, SuitPainter } from '../suits/SuitPainter.js';

/**
 * How each of Spider-Man's rogues looks. Henchmen are the body atlas
 * recoloured to a palette; the villains themselves are PAINTED texel by texel
 * like the suits (Venom's grin, Carnage's swirls, the Goblin's tunic).
 * Accessories go on the head, in the hand and on the back. Every enemy is the
 * same rig as a player, so it runs, strikes and falls with the same animator.
 *
 * Accessories are authored in world units around their mount: the head's
 * centre (`s` is the head's size), the grip (weapon along +Y), and the upper
 * back.
 */
export interface LookPalette {
  /** Replaces the atlas's teal cloth. */
  readonly cloth: number;
  /** Replaces its darker trim. */
  readonly trim: number;
  /** Replaces its warm (skin) tones. */
  readonly skin: number;
}

export interface EnemyLookDef {
  readonly palette: LookPalette;
  /** A full paint job, instead of the recoloured atlas. */
  readonly paint?: SuitPainter;
  readonly head?: (b: PartBuilder, size: number) => void;
  readonly hand?: (b: PartBuilder) => void;
  readonly back?: (b: PartBuilder) => void;
}

type Maker = (b: PartBuilder, s: number) => void;

// ------------------------------------------------------------------ helpers

const frac = (x: number): number => x - Math.floor(x);
const within = (value: number, min: number, max: number): boolean => value >= min && value <= max;
const ellipse = (u: number, v: number, cu: number, cv: number, ru: number, rv: number): boolean => ((u - cu) / ru) ** 2 + ((v - cv) / rv) ** 2 <= 1;
const isFront = (p: PaintPoint): boolean => p.face === 'front';
const isArm = (p: PaintPoint): boolean => p.part === 'armL' || p.part === 'armR';
const isLeg = (p: PaintPoint): boolean => p.part === 'legL' || p.part === 'legR';

const eyes = (b: PartBuilder, s: number, color: number, glow = true, spread = 0.2, y = 0.05): void => {
  for (const side of [-1, 1]) b.add(new BoxGeometry(s * 0.14, s * 0.1, s * 0.04), color, glow ? 'glow' : 'smooth', { x: side * s * spread, y: s * y, z: s * 0.5 });
};
const cap = (b: PartBuilder, s: number, color: number, brim = true): void => {
  b.add(new CylinderGeometry(s * 0.55, s * 0.58, s * 0.3, 12), color, 'smooth', { y: s * 0.45 });
  if (brim) b.add(new BoxGeometry(s * 0.6, s * 0.05, s * 0.4), color, 'smooth', { y: s * 0.32, z: s * 0.45 });
};
const beanie = (b: PartBuilder, s: number, color: number): void => {
  b.add(new SphereGeometry(s * 0.58, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), color, 'smooth', { y: s * 0.18 });
};
const helmet = (b: PartBuilder, s: number, color: number, visor = 0x222a36, visorGlow = false): void => {
  b.add(new SphereGeometry(s * 0.64, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), color, 'smooth', { y: s * 0.02 });
  b.add(new BoxGeometry(s * 0.9, s * 0.22, s * 0.1), visor, visorGlow ? 'glow' : 'smooth', { y: s * 0.06, z: s * 0.5 });
};
const mask = (b: PartBuilder, s: number, color: number): void => {
  b.add(new BoxGeometry(s * 0.95, s * 0.2, s * 0.08), color, 'smooth', { y: s * 0.08, z: s * 0.5 });
};
const bandana = (b: PartBuilder, s: number, color: number): void => {
  b.add(new BoxGeometry(s * 1.04, s * 0.34, s * 0.08), color, 'smooth', { y: -s * 0.2, z: s * 0.5 });
};
const bat = (b: PartBuilder, color = 0x6b4a2a, length = 1.6): void => {
  b.add(new CylinderGeometry(0.16, 0.07, length, 8), color, 'smooth', { y: length / 2 - 0.2 });
};
const pipe = (b: PartBuilder): void => {
  b.add(new CylinderGeometry(0.08, 0.08, 1.7, 8), 0x8a94a4, 'smooth', { y: 0.6 });
};
const knife = (b: PartBuilder): void => {
  b.add(new BoxGeometry(0.05, 0.7, 0.14), 0xdfe6ee, 'smooth', { y: 0.45 });
  b.add(new BoxGeometry(0.1, 0.3, 0.12), 0x22252e, 'smooth', { y: -0.05 });
};
const gun = (b: PartBuilder, color = 0x2b2f3d, glow = 0xff4040): void => {
  b.add(new BoxGeometry(0.16, 0.22, 0.9), color, 'smooth', { y: 0.05, z: 0.3 });
  b.add(new BoxGeometry(0.12, 0.32, 0.14), color, 'smooth', { y: -0.18 });
  b.add(new SphereGeometry(0.06, 6, 5), glow, 'glow', { y: 0.05, z: 0.78 });
};
const spear = (b: PartBuilder): void => {
  b.add(new CylinderGeometry(0.05, 0.05, 3.2, 6), 0x6b4a2a, 'smooth', { y: 0.9 });
  b.add(new ConeGeometry(0.12, 0.5, 6), 0xdfe6ee, 'smooth', { y: 2.7 });
};
const claws = (b: PartBuilder, color = 0xf4efe3): void => {
  for (const dx of [-0.12, 0, 0.12]) b.add(new ConeGeometry(0.05, 0.5, 4), color, 'smooth', { x: dx, y: 0.1, z: 0.35, rx: Math.PI / 2 });
};
const cape = (b: PartBuilder, color: number, length = 2.2): void => {
  b.add(new BoxGeometry(1.3, length, 0.07), color, 'smooth', { y: -length / 2 + 0.1, z: -0.1, rx: 0.12 });
};
const wings = (b: PartBuilder, color: number, span = 1.4, glow = false): void => {
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i += 1) b.add(new BoxGeometry(span * 0.32, 1.1 - i * 0.14, 0.06), color, glow ? 'glow' : 'smooth', { x: side * (0.4 + i * span * 0.26), y: 0.25 - i * 0.1, z: -0.2, rz: side * (0.8 - i * 0.15) });
  }
};
const jetpack = (b: PartBuilder, color: number): void => {
  for (const side of [-1, 1]) {
    b.add(new CylinderGeometry(0.18, 0.18, 0.8, 8), color, 'smooth', { x: side * 0.24 });
    b.add(new ConeGeometry(0.16, 0.3, 8), 0xff8a1c, 'glow', { x: side * 0.24, y: -0.55, rx: Math.PI });
  }
};
const tentacles = (b: PartBuilder, color: number, tip: number, count = 4, reach = 1.4): void => {
  for (let i = 0; i < count; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const up = i < 2 ? 1 : -1;
    for (let k = 0; k < 4; k += 1) b.add(new SphereGeometry(0.14 - k * 0.015, 7, 5), color, 'smooth', { x: side * (0.25 + k * reach * 0.2), y: up * (0.1 + k * 0.28) + 0.1, z: -0.3 - k * 0.14 });
    b.add(new ConeGeometry(0.12, 0.3, 3), tip, 'smooth', { x: side * (0.25 + reach * 0.85), y: up * 1.25 + 0.1, z: -0.9, rz: side * 0.5 });
  }
};
const lightning = (b: PartBuilder, s: number, color: number): void => {
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 6) * Math.PI - Math.PI / 2;
    b.add(new ConeGeometry(s * 0.1, s * 0.55, 4), color, 'glow', { x: Math.sin(a) * s * 0.6, y: Math.cos(a) * s * 0.6 + s * 0.05, z: s * 0.38, rz: -a });
  }
};
const dome = (b: PartBuilder, s: number): void => {
  b.add(new SphereGeometry(s * 0.85, 16, 10), 0xbff0ff, 'glow', { y: s * 0.06, sx: 1, sy: 1, sz: 1 });
};
const orbHand = (b: PartBuilder, color: number): void => {
  b.add(new SphereGeometry(0.28, 10, 8), color, 'glow', { y: 0.1 });
};
const tail = (b: PartBuilder, color: number, tip?: number): void => {
  for (let i = 0; i < 6; i += 1) b.add(new SphereGeometry(0.2 - i * 0.02, 8, 6), color, 'smooth', { y: -1.0 - i * 0.18 + i * i * 0.07, z: -0.35 - i * 0.24 });
  if (tip !== undefined) b.add(new ConeGeometry(0.14, 0.5, 5), tip, 'glow', { y: -0.4, z: -1.8, rx: -0.6 });
};

const fedora = (b: PartBuilder, s: number, color: number): void => {
  b.add(new CylinderGeometry(s * 0.46, s * 0.5, s * 0.36, 12), color, 'smooth', { y: s * 0.58 });
  b.add(new CylinderGeometry(s * 0.82, s * 0.82, s * 0.05, 16), color, 'smooth', { y: s * 0.42 });
};
const pumpkinBomb = (b: PartBuilder): void => {
  b.add(new SphereGeometry(0.3, 10, 8), 0xff7a1a, 'glow', { y: 0.15, sy: 0.85 });
  b.add(new CylinderGeometry(0.04, 0.05, 0.14, 5), 0x2a6a2a, 'smooth', { y: 0.45 });
};
const portalDisc = (b: PartBuilder, r = 0.45): void => {
  b.add(new CylinderGeometry(r, r, 0.04, 18), 0x050508, 'smooth', { y: 0.2, rx: Math.PI / 2 });
};
const gauntlet = (b: PartBuilder, glow: number): void => {
  b.add(new BoxGeometry(0.42, 0.42, 0.5), 0x8a5a2a, 'smooth', { y: 0.05 });
  b.add(new CylinderGeometry(0.14, 0.14, 0.06, 10), glow, 'glow', { y: 0.05, z: 0.27, rx: Math.PI / 2 });
};
const waterOrb = (b: PartBuilder): void => {
  b.add(new SphereGeometry(0.36, 12, 8), 0x5ab8ff, 'glow', { y: 0.12 });
};
const legs = (b: PartBuilder, color: number, tip: number, reach = 1.6): void => {
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i += 1) {
      const a = (i - 1.5) * 0.5;
      b.add(new CylinderGeometry(0.08, 0.1, reach, 6), color, 'smooth', { x: side * (0.3 + reach * 0.35), y: 0.2 - i * 0.2, z: -0.3 + Math.sin(a) * 0.4, rz: side * 1.1, ry: a });
      b.add(new ConeGeometry(0.1, 0.4, 5), tip, 'smooth', { x: side * (0.35 + reach * 0.78), y: -0.3 - i * 0.2, z: -0.3 + Math.sin(a) * 0.6, rz: side * 2.6 });
    }
  }
};

// --------------------------------------------------------------- paint jobs

const venomPaint: SuitPainter = (p) => {
  if (p.part === 'head' && isFront(p)) {
    for (const side of [-1, 1]) {
      const du = p.u - (0.5 + side * 0.23);
      const dv = p.v - 0.64;
      const a = side * 0.7;
      const x = du * Math.cos(a) + dv * Math.sin(a);
      const y = -du * Math.sin(a) + dv * Math.cos(a);
      if ((x / 0.22) ** 2 + (y / 0.1) ** 2 <= 1) return 0xf4f6ff;
    }
    // The grin: a wide mouth of teeth.
    if (ellipse(p.u, p.v, 0.5, 0.26, 0.4, 0.13)) return frac(p.u * 10) < 0.18 || Math.abs(p.v - 0.26) < 0.02 ? 0x5a0a14 : 0xf8f4ea;
  }
  if (p.part === 'torso' && (isFront(p) || p.face === 'back')) {
    const x = (p.u - 0.5) / 0.8;
    const y = (p.v - 0.6) / 0.8;
    if (ellipse(x, y, 0, 0.12, 0.12, 0.12) || ellipse(x, y, 0, -0.14, 0.1, 0.18)) return 0xf4f6ff;
    const ax = Math.abs(x);
    if ((Math.abs(y - (0.2 + ax * 0.9)) < 0.05 || Math.abs(y + 0.15 + ax * 0.9) < 0.05) && ax < 0.55) return 0xf4f6ff;
  }
  return frac(p.u * 2 + p.v * 2) < 0.5 ? 0x0e0f16 : 0x16171f;
};

const carnagePaint: SuitPainter = (p) => {
  if (p.part === 'head' && isFront(p)) {
    for (const side of [-1, 1]) if (ellipse(p.u, p.v, 0.5 + side * 0.22, 0.64, 0.17, 0.09)) return 0xf4f6ff;
    if (ellipse(p.u, p.v, 0.5, 0.26, 0.36, 0.12)) return frac(p.u * 9) < 0.2 ? 0x2a0508 : 0xf8f4ea;
  }
  const swirl = Math.sin(p.u * 11 + Math.sin(p.v * 9) * 2) + Math.sin(p.v * 13 - p.u * 4);
  return swirl > 1.1 ? 0x14050a : swirl < -1.2 ? 0x7a0a12 : 0xc81424;
};

const goblinPaint: SuitPainter = (p) => {
  const green = 0x4fb84a;
  const purple = 0x5a2a8a;
  if (p.part === 'head') {
    if (isFront(p)) {
      if (ellipse(p.u, p.v, 0.3, 0.6, 0.12, 0.07) || ellipse(p.u, p.v, 0.7, 0.6, 0.12, 0.07)) return 0xffe23a;
      if (within(p.v, 0.22, 0.3) && within(p.u, 0.24, 0.76)) return frac(p.u * 8) < 0.2 ? 0x1a3a1a : 0xf0f0e0;
    }
    return green;
  }
  if (p.part === 'torso') {
    if (p.v < 0.12) return 0x3a1a5a;
    if (isFront(p) && within(p.u, 0.3, 0.7) && frac(p.v * 6) < 0.15) return 0x2a0a4a;
    return purple;
  }
  if (isArm(p)) return p.ny < 0.24 ? purple : green;
  if (isLeg(p)) return p.ny < 0.3 ? purple : green;
  return green;
};

const redGoblinPaint: SuitPainter = (p) => {
  if (p.part === 'head' && isFront(p)) {
    if (ellipse(p.u, p.v, 0.3, 0.6, 0.13, 0.07) || ellipse(p.u, p.v, 0.7, 0.6, 0.13, 0.07)) return 0xfff4a0;
    if (ellipse(p.u, p.v, 0.5, 0.26, 0.34, 0.1)) return frac(p.u * 9) < 0.2 ? 0x2a0508 : 0xf8f4ea;
  }
  const vein = Math.sin(p.u * 14 + p.v * 5) + Math.sin(p.v * 10);
  if (p.part === 'torso' && p.v < 0.12) return 0x2a0a0a;
  return vein > 1.2 ? 0xff5a1c : 0xb01418;
};

const electroPaint: SuitPainter = (p) => {
  const green = 0x2ab84a;
  const yellow = 0xffe23a;
  if (p.part === 'head') return isFront(p) && within(p.v, 0.3, 0.8) ? yellow : green;
  if (p.part === 'torso') {
    const zig = Math.abs(frac(p.v * 4) - 0.5) * 0.4;
    return (isFront(p) || p.face === 'back') && Math.abs(Math.abs(p.u - 0.5) - 0.1 - zig) < 0.06 ? yellow : green;
  }
  if (isArm(p) || isLeg(p)) return frac(p.ny * 4) < 0.25 ? yellow : green;
  return green;
};

const rhinoPaint: SuitPainter = (p) => {
  const grey = 0x7a8494;
  if (p.part === 'head' && isFront(p) && within(p.v, 0.2, 0.62) && within(p.u, 0.26, 0.74)) return 0xe0b890;
  return frac(p.u * 3) < 0.06 || frac(p.v * 4) < 0.06 ? 0x5a6474 : grey;
};

const lizardPaint: SuitPainter = (p) => {
  const scale = frac(p.u * 8 + (Math.floor(p.v * 8) % 2) * 0.5) < 0.5 ? 0x4f9a3a : 0x3f8a2e;
  if (p.part === 'head' && isFront(p) && (ellipse(p.u, p.v, 0.3, 0.62, 0.1, 0.07) || ellipse(p.u, p.v, 0.7, 0.62, 0.1, 0.07))) return 0xffd23a;
  if (p.part === 'torso' || (isArm(p) && p.ny > 0.35)) return isFront(p) && p.part === 'torso' && Math.abs(p.u - 0.5) < 0.2 ? 0xf4f4f0 : 0xf4f4f0;
  if (isLeg(p) && p.ny > 0.3) return 0x3a4a6a;
  return scale;
};

const docOckPaint: SuitPainter = (p) => {
  if (p.part === 'head') {
    if (isFront(p) && (ellipse(p.u, p.v, 0.32, 0.58, 0.12, 0.08) || ellipse(p.u, p.v, 0.68, 0.58, 0.12, 0.08))) return 0x2a2a2a;
    if (p.face === 'top' || (!isFront(p) && p.v > 0.6)) return 0x2a1a0a;
    return 0xe0b890;
  }
  if (p.part === 'torso') return p.v < 0.14 ? 0x8a6a2a : 0x3a6a3a;
  if (isArm(p)) return p.ny < 0.22 ? 0xd8b830 : 0x3a6a3a;
  if (isLeg(p)) return p.ny < 0.18 ? 0x2a2a2a : 0x3a6a3a;
  return 0x3a6a3a;
};

const mysterioPaint: SuitPainter = (p) => {
  if (p.part === 'head') return 0x5ad08a;
  if (p.part === 'torso') {
    if (isFront(p) && ellipse(p.u, p.v, 0.5, 0.62, 0.14, 0.14)) return 0xffd23a;
    return frac(p.v * 5) < 0.15 ? 0x2a6a3a : 0x3a8a4a;
  }
  if (isArm(p)) return p.ny < 0.22 ? 0x8a4ac8 : 0x3a8a4a;
  if (isLeg(p)) return p.ny < 0.24 ? 0x8a4ac8 : 0x3a8a4a;
  return 0x3a8a4a;
};

const kravenPaint: SuitPainter = (p) => {
  if (p.part === 'head') return p.face === 'top' || (!isFront(p) && p.v > 0.5) || (isFront(p) && p.v > 0.82) ? 0x2a1a0a : 0xd8a07a;
  if (p.part === 'torso') {
    if (isFront(p) && Math.abs(p.u - 0.5) < 0.24 && p.v > 0.25) return 0xd8a07a;
    return frac(p.u * 5 + p.v * 3) < 0.3 ? 0x6a4a1a : 0xc89a4a;
  }
  if (isArm(p)) return p.ny > 0.8 ? 0xc89a4a : 0xd8a07a;
  if (isLeg(p)) return p.ny < 0.2 ? 0x3a2a1a : 0x2a3a1a;
  return 0xc89a4a;
};

const vulturePaint: SuitPainter = (p) => {
  if (p.part === 'head') {
    if (isFront(p) && within(p.v, 0.2, 0.62) && within(p.u, 0.28, 0.72)) return 0xe8c8a8;
    return 0x4a5a3a;
  }
  return frac(p.v * 6) < 0.1 ? 0x3a4a2a : 0x5a6a4a;
};

const sandmanPaint: SuitPainter = (p) => {
  if (p.part === 'torso') return frac(p.v * 5) < 0.5 ? 0x3a8a3a : 0x1a5a1a;
  if (p.part === 'head') return isFront(p) && within(p.v, 0.2, 0.7) ? 0xd8b890 : 0x8a6a4a;
  if (isLeg(p)) return 0x6a5a3a;
  const grain = frac(Math.sin(p.u * 91.3 + p.v * 47.1) * 4375.5);
  return grain < 0.3 ? 0xc8a868 : 0xe0c080;
};

const scorpionPaint: SuitPainter = (p) => {
  if (p.part === 'head' && isFront(p) && within(p.v, 0.46, 0.66) && within(p.u, 0.2, 0.8)) return 0x7aff5a;
  return frac(p.v * 5) < 0.12 ? 0x2a4a1a : frac(p.u * 3) < 0.08 ? 0x3a6a2a : 0x4f8a2e;
};

const kingpinPaint: SuitPainter = (p) => {
  if (p.part === 'head') return p.face === 'top' ? 0xe8b890 : isFront(p) && within(p.v, 0.18, 0.26) && within(p.u, 0.36, 0.64) ? 0x7a3a2a : 0xe0b890;
  if (p.part === 'torso') {
    if (isFront(p) && Math.abs(p.u - 0.5) < 0.1 && p.v > 0.5) return 0x8a1a2a;
    if (isFront(p) && Math.abs(p.u - 0.5) < 0.16 && p.v > 0.45) return 0x2a2a2a;
    return 0xf4f2ec;
  }
  if (isArm(p)) return p.ny < 0.14 ? 0xe0b890 : 0xf4f2ec;
  if (isLeg(p)) return p.ny < 0.12 ? 0x1a1a1a : 0xf4f2ec;
  return 0xf4f2ec;
};

const negativePaint: SuitPainter = (p) => {
  // Mister Negative: an inverted man - white hair and dark skin in a black suit.
  if (p.part === 'head') return p.face === 'top' || (!isFront(p) && p.v > 0.55) || (isFront(p) && p.v > 0.8) ? 0xf4f4f4 : 0x2a2a34;
  if (p.part === 'torso') return isFront(p) && Math.abs(p.u - 0.5) < 0.1 ? 0xf4f4f4 : 0x101014;
  return 0x101014;
};

const hammerheadPaint: SuitPainter = (p) => {
  if (p.part === 'head') return p.face === 'top' ? 0x8a8a94 : isFront(p) && within(p.v, 0.2, 0.7) ? 0xd8b890 : 0x1a1a1a;
  if (p.part === 'torso') return isFront(p) && Math.abs(p.u - 0.5) < 0.08 ? 0xf4f4f4 : frac(p.u * 8) < 0.06 ? 0x5a5a64 : 0x3a3a44;
  return isLeg(p) ? 0x2a2a34 : 0x3a3a44;
};


// ------------------------------------------------ stages 19-30: paint jobs

/** Shocker: the quilted tan-and-yellow padding, the brown hood and goggles. */
const shockerPaint: SuitPainter = (p) => {
  if (p.part === 'head') return isFront(p) && within(p.v, 0.5, 0.68) && within(p.u, 0.18, 0.82) ? 0x3a2a14 : 0x8a5a2a;
  const quilt = Math.abs(frac(p.u * 5 + p.v * 5) - 0.5) < 0.07 || Math.abs(frac(p.u * 5 - p.v * 5) - 0.5) < 0.07;
  if (isArm(p) && p.ny < 0.2) return 0x8a5a2a;
  return quilt ? 0x8a5a2a : 0xe8c050;
};

/** Hydro-Man: a green shirt on a body of rippling water. */
const hydroPaint: SuitPainter = (p) => {
  if (p.part === 'torso' && p.v > 0.16) return frac(p.v * 6) < 0.12 ? 0x2a6a2a : 0x3a8a3a;
  if (isLeg(p) && p.ny > 0.25) return 0x3a4a6a;
  const ripple = Math.sin(p.u * 18 + p.v * 9) + Math.sin(p.v * 14);
  return ripple > 1 ? 0x9fdcff : ripple < -1 ? 0x1a5aa8 : 0x3a8ae0;
};

/** Tombstone: chalk-white skin, a black suit, a white shirt and red tie. */
const tombstonePaint: SuitPainter = (p) => {
  if (p.part === 'head') return p.face === 'top' ? 0xe8e8e0 : isFront(p) && ellipse(p.u, p.v, 0.5, 0.6, 0.3, 0.1) ? 0xd8d0c8 : 0xf4f4ee;
  if (p.part === 'torso') {
    if (isFront(p) && Math.abs(p.u - 0.5) < 0.05 && p.v > 0.3) return 0xa81a1a;
    if (isFront(p) && Math.abs(p.u - 0.5) < 0.14 && p.v > 0.4) return 0xf4f4f4;
    return 0x14151c;
  }
  if (isArm(p)) return p.ny < 0.14 ? 0xf4f4ee : 0x14151c;
  return 0x14151c;
};

/** Beetle: green armour plates edged in purple. */
const beetlePaint: SuitPainter = (p) => {
  if (p.part === 'head') return isFront(p) && within(p.v, 0.46, 0.66) && within(p.u, 0.18, 0.82) ? 0xff3a3a : 0x2a8a3a;
  const seam = frac(p.u * 4) < 0.08 || frac(p.v * 5) < 0.08;
  if (p.part === 'torso' && isFront(p) && ellipse(p.u, p.v, 0.5, 0.55, 0.3, 0.28)) return seam ? 0x3a1a5a : 0x6a2a9a;
  return seam ? 0x1a4a1a : 0x2a8a3a;
};

/** Morbius: grey-white skin, a black suit slashed to the chest, red collar lining. */
const morbiusPaint: SuitPainter = (p) => {
  if (p.part === 'head') {
    if (isFront(p) && (ellipse(p.u, p.v, 0.32, 0.6, 0.1, 0.06) || ellipse(p.u, p.v, 0.68, 0.6, 0.1, 0.06))) return 0xff2a2a;
    if (isFront(p) && ellipse(p.u, p.v, 0.5, 0.26, 0.2, 0.06)) return 0x5a0a14;
    return p.face === 'top' || (!isFront(p) && p.v > 0.6) ? 0x14151c : 0xc8c8cc;
  }
  if (p.part === 'torso') {
    if (isFront(p) && Math.abs(p.u - 0.5) < 0.22 - (1 - p.v) * 0.2 && p.v > 0.3) return 0xc8c8cc;
    return p.v > 0.86 ? 0xa81a1a : 0x0e0f16;
  }
  return 0x0e0f16;
};

/** Molten Man: gold metal skin, cracked with glowing seams. */
const moltenPaint: SuitPainter = (p) => {
  const crack = Math.abs(Math.sin(p.u * 13 + Math.sin(p.v * 8) * 2)) < 0.12;
  if (p.part === 'head' && isFront(p) && (ellipse(p.u, p.v, 0.32, 0.6, 0.1, 0.06) || ellipse(p.u, p.v, 0.68, 0.6, 0.1, 0.06))) return 0xfff4a0;
  if (isLeg(p) && p.ny > 0.3) return 0x2a2a34;
  return crack ? 0xff6a1c : frac(p.v * 3) < 0.5 ? 0xd4a030 : 0xe8b840;
};

/** The Spot: white from head to toe, covered in black holes. */
const spotPaint: SuitPainter = (p) => {
  const cell = (u: number, v: number): boolean => {
    const cu = Math.floor(u * 4);
    const cv = Math.floor(v * 4);
    const ox = frac(Math.sin(cu * 12.9 + cv * 78.2) * 437.5) * 0.5 + 0.25;
    const oy = frac(Math.sin(cu * 39.3 + cv * 11.1) * 912.1) * 0.5 + 0.25;
    return ellipse(frac(u * 4), frac(v * 4), ox, oy, 0.2, 0.2);
  };
  if (p.part === 'head' && isFront(p)) return ellipse(p.u, p.v, 0.5, 0.55, 0.24, 0.24) ? 0x050508 : 0xf4f4f4;
  return cell(p.u + (p.part === 'torso' ? 0 : 0.37), p.v) ? 0x050508 : 0xf4f4f4;
};

/** Chameleon: a blank white mask of a face, a grey suit with violet trim. */
const chameleonPaint: SuitPainter = (p) => {
  if (p.part === 'head') return isFront(p) && (ellipse(p.u, p.v, 0.34, 0.58, 0.06, 0.04) || ellipse(p.u, p.v, 0.66, 0.58, 0.06, 0.04)) ? 0x3a3a44 : 0xf4f4f0;
  if (p.part === 'torso') return isFront(p) && Math.abs(p.u - 0.5) < 0.06 ? 0x6a3aa8 : frac(p.v * 4) < 0.08 ? 0x6a3aa8 : 0x6a6e78;
  return p.ny < 0.16 ? 0x6a3aa8 : 0x6a6e78;
};

/** Hobgoblin: the orange cowl and cape over a blue scale suit, a golden grin. */
const hobgoblinPaint: SuitPainter = (p) => {
  if (p.part === 'head') {
    if (isFront(p)) {
      if (ellipse(p.u, p.v, 0.3, 0.6, 0.12, 0.06) || ellipse(p.u, p.v, 0.7, 0.6, 0.12, 0.06)) return 0xffe23a;
      if (within(p.v, 0.22, 0.3) && within(p.u, 0.24, 0.76)) return frac(p.u * 8) < 0.2 ? 0x2a1a0a : 0xffd23a;
      if (within(p.v, 0.2, 0.7) && within(p.u, 0.2, 0.8)) return 0x2a8a3a;
    }
    return 0xff7a1a;
  }
  if (p.part === 'torso') return p.v > 0.8 ? 0xff7a1a : frac(p.u * 6 + (Math.floor(p.v * 8) % 2) * 0.5) < 0.5 ? 0x1f4fd6 : 0x1a3aa8;
  if (isArm(p)) return p.ny < 0.2 ? 0xff7a1a : 0x1f4fd6;
  if (isLeg(p)) return p.ny < 0.2 ? 0xff7a1a : 0x1f4fd6;
  return 0x1f4fd6;
};

/** The Jackal: green fur, streaked darker, over a bare pale muzzle. */
const jackalPaint: SuitPainter = (p) => {
  if (p.part === 'head' && isFront(p)) {
    if (ellipse(p.u, p.v, 0.3, 0.6, 0.1, 0.07) || ellipse(p.u, p.v, 0.7, 0.6, 0.1, 0.07)) return 0xffe23a;
    if (ellipse(p.u, p.v, 0.5, 0.28, 0.2, 0.12)) return 0xc8e8b8;
  }
  if (isLeg(p) && p.ny > 0.3) return 0x3a2a1a;
  return frac(p.u * 9 + p.v * 3) < 0.25 ? 0x2a6a2a : 0x4aa84a;
};

/** Morlun: a black greatcoat, a pale gaunt face, lank dark hair. */
const morlunPaint: SuitPainter = (p) => {
  if (p.part === 'head') {
    if (p.face === 'top' || !isFront(p) || p.v > 0.78 || p.u < 0.14 || p.u > 0.86) return 0x14151c;
    if (ellipse(p.u, p.v, 0.32, 0.56, 0.08, 0.05) || ellipse(p.u, p.v, 0.68, 0.56, 0.08, 0.05)) return 0xb16bff;
    return 0xd8d4dc;
  }
  if (p.part === 'torso' && isFront(p) && Math.abs(p.u - 0.5) < 0.08) return 0x3a3a44;
  return 0x0e0f16;
};

/** The Spider-Slayer: brushed silver plates, red optics, black joints. */
const slayerPaint: SuitPainter = (p) => {
  if (p.part === 'head' && isFront(p) && ellipse(p.u, p.v, 0.5, 0.56, 0.2, 0.16)) return 0xff2a2a;
  const seam = frac(p.u * 3) < 0.07 || frac(p.v * 4) < 0.07;
  return seam ? 0x1a1b22 : frac(p.v * 20) < 0.5 ? 0xb8c4d0 : 0xa8b4c0;
};

/** Spider clones: a ragged red-and-blue suit, the webbing half gone. */
const clonePaint: SuitPainter = (p) => {
  if (p.part === 'head') return isFront(p) && (ellipse(p.u, p.v, 0.3, 0.6, 0.12, 0.08) || ellipse(p.u, p.v, 0.7, 0.6, 0.12, 0.08)) ? 0xf4f4f0 : 0xb81a24;
  if (p.part === 'torso') return p.u < 0.2 || p.u > 0.8 ? 0x1f3fb0 : frac(p.u * 6 + p.v * 3) < 0.1 ? 0x5a0a12 : 0xb81a24;
  return p.ny > 0.5 ? 0x1f3fb0 : 0xb81a24;
};

// ------------------------------------------- the early waves: paint jobs
//
// Even Stage 1 is the Spider-Man universe: every henchman wears who they
// work for. Street level first (cheap masks, suits, hoodies), then armour and
// powers as the stages climb.

/** Goblin Gang punk: a purple hoodie and a cheap rubber Goblin mask - green, yellow eyes, a painted grin. */
const goblinPunkPaint: SuitPainter = (p) => {
  const green = 0x5ac84a;
  const purple = 0x5a2a8a;
  if (p.part === 'head') {
    if (isFront(p) && within(p.u, 0.12, 0.88) && within(p.v, 0.08, 0.84)) {
      if (ellipse(p.u, p.v, 0.3, 0.6, 0.12, 0.06) || ellipse(p.u, p.v, 0.7, 0.6, 0.12, 0.06)) return 0xffe23a;
      if (within(p.v, 0.22, 0.32) && within(p.u, 0.22, 0.78)) return frac(p.u * 9) < 0.22 ? 0x1a3a1a : 0xf4f0d8;
      if (within(p.v, 0.7, 0.76) && (within(p.u, 0.2, 0.42) || within(p.u, 0.58, 0.8))) return 0x2a6a2a;
      return green;
    }
    return purple;
  }
  if (p.part === 'torso') {
    if (isFront(p) && Math.abs(p.u - 0.5) < 0.02 && p.v > 0.35) return 0xc8c8d0;
    if (isFront(p) && within(p.v, 0.12, 0.34) && within(p.u, 0.22, 0.78)) return 0x4a2078;
    if ((isFront(p) || p.face === 'back') && ellipse(p.u, p.v, 0.5, 0.62, 0.12, 0.1) && p.face === 'back') return green;
    return p.v < 0.1 ? 0x3a1a5a : purple;
  }
  if (isArm(p)) return p.ny < 0.1 ? green : purple;
  if (isLeg(p)) return p.ny < 0.08 ? 0x1a1a22 : 0x2a3a5a;
  return purple;
};

/** Inner Demon (Mister Negative's gang): a black suit and the white demon mask. */
const innerDemonPaint: SuitPainter = (p) => {
  if (p.part === 'head') {
    if (isFront(p) && within(p.u, 0.1, 0.9) && within(p.v, 0.08, 0.86)) {
      // Angled black eye slits, a scowl of black fangs, red cheek marks.
      for (const side of [-1, 1]) {
        const du = p.u - (0.5 + side * 0.2);
        const dv = p.v - 0.6 + side * du * 0.6;
        if (Math.abs(dv) < 0.05 && Math.abs(du) < 0.12) return 0x050508;
        if (ellipse(p.u, p.v, 0.5 + side * 0.3, 0.42, 0.05, 0.08)) return 0xc81424;
      }
      if (within(p.v, 0.18, 0.3) && within(p.u, 0.28, 0.72)) return frac(p.u * 8) < 0.5 ? 0x050508 : 0xf4f4f4;
      return 0xf4f4f4;
    }
    return 0x0e0e12;
  }
  if (p.part === 'torso') {
    if (isFront(p) && Math.abs(p.u - 0.5) < 0.06 && p.v > 0.45) return 0xf4f4f4;
    if (isFront(p) && Math.abs(Math.abs(p.u - 0.5) - 0.14) < 0.03 && p.v > 0.4) return 0x2a2a34;
    return 0x101014;
  }
  if (isArm(p)) return p.ny < 0.1 ? 0xf4f4f4 : 0x101014;
  return 0x101014;
};

/** Maggia mobster (Hammerhead's crew): a pinstripe suit, a red tie. */
const mobsterPaint: SuitPainter = (p) => {
  if (p.part === 'head') return p.face === 'top' || (!isFront(p) && p.v > 0.6) ? 0x2a1a0a : 0xe8c0a0;
  if (p.part === 'torso') {
    if (isFront(p) && Math.abs(p.u - 0.5) < 0.04 && p.v > 0.3) return 0xb01418;
    if (isFront(p) && Math.abs(p.u - 0.5) < 0.12 && p.v > 0.45) return 0xf4f4f0;
  }
  if (p.part === 'torso' || isArm(p) || isLeg(p)) {
    if (isArm(p) && p.ny < 0.08) return 0xe8c0a0;
    if (isLeg(p) && p.ny < 0.08) return 0x0e0e12;
    return frac((p.part === 'torso' ? p.u : p.u + p.ny) * 14) < 0.1 ? 0x8a8a94 : 0x26262e;
  }
  return 0x26262e;
};

/** Lizard spawn: green scales, a pale belly, yellow slit eyes. */
const lizardSpawnPaint: SuitPainter = (p) => {
  const scale = frac(p.u * 10 + (Math.floor(p.v * 10) % 2) * 0.5) < 0.5 ? 0x5aa83a : 0x46902e;
  if (p.part === 'head' && isFront(p)) {
    for (const side of [-1, 1]) {
      if (ellipse(p.u, p.v, 0.5 + side * 0.22, 0.62, 0.1, 0.07)) return Math.abs(p.u - (0.5 + side * 0.22)) < 0.02 ? 0x0a0a0a : 0xffd23a;
    }
    if (within(p.v, 0.2, 0.26) && within(p.u, 0.2, 0.8)) return 0x2a4a1a;
  }
  if (p.part === 'torso' && isFront(p) && Math.abs(p.u - 0.5) < 0.22) return frac(p.v * 8) < 0.15 ? 0xc8c8a0 : 0xe0e0b8;
  return scale;
};

/** Electro's spark goons: a green bodysuit struck with yellow bolts, a lightning-star mask. */
const sparkPaint: SuitPainter = (p) => {
  const green = 0x2a9a3a;
  const yellow = 0xffe23a;
  if (p.part === 'head') {
    if (isFront(p)) {
      const du = Math.abs(p.u - 0.5);
      const star = within(p.v, 0.35, 0.8) && du < 0.4 - Math.abs(p.v - 0.58) * 1.1;
      if (star) return ellipse(p.u, p.v, 0.36, 0.6, 0.06, 0.04) || ellipse(p.u, p.v, 0.64, 0.6, 0.06, 0.04) ? 0x0a2a0a : yellow;
    }
    return green;
  }
  const zig = Math.abs(frac(p.v * 5) - 0.5) * 0.3;
  if ((p.part === 'torso' && (isFront(p) || p.face === 'back') && Math.abs(p.u - 0.3 - zig) < 0.05) || ((isArm(p) || isLeg(p)) && frac(p.ny * 5) < 0.12)) return yellow;
  return green;
};

/** Rhino's guards: grey armour plates with rivets, a horned helmet. */
const rhinoGuardPaint: SuitPainter = (p) => {
  if (p.part === 'head') return isFront(p) && within(p.v, 0.2, 0.55) && within(p.u, 0.28, 0.72) ? 0xd8b890 : 0x6a7484;
  const seam = frac(p.u * 3) < 0.06 || frac(p.v * 4) < 0.06;
  const rivet = ellipse(frac(p.u * 3), frac(p.v * 4), 0.2, 0.2, 0.06, 0.06);
  return rivet ? 0xc8ccd4 : seam ? 0x3a4454 : 0x6a7484;
};

/** Kraven's hunters: leopard-print vests over bare arms, khaki trousers. */
const hunterPaint: SuitPainter = (p) => {
  if (p.part === 'head') return p.face === 'top' || (!isFront(p) && p.v > 0.55) ? 0x3a2a14 : 0xd8a07a;
  if (p.part === 'torso') {
    if (isFront(p) && Math.abs(p.u - 0.5) < 0.12 && p.v > 0.5) return 0xd8a07a;
    const cu = frac(p.u * 6 + (Math.floor(p.v * 6) % 2) * 0.5);
    const cv = frac(p.v * 6);
    if (ellipse(cu, cv, 0.5, 0.5, 0.2, 0.18)) return ellipse(cu, cv, 0.5, 0.5, 0.1, 0.09) ? 0xa87a2a : 0x2a1a0a;
    return 0xd8a848;
  }
  if (isArm(p)) return 0xd8a07a;
  if (isLeg(p)) return p.ny < 0.1 ? 0x2a1a0a : 0x8a7a4a;
  return 0xd8a848;
};

const tommyGun = (b: PartBuilder): void => {
  gun(b, 0x1a1a1a, 0xffd23a);
  b.add(new CylinderGeometry(0.2, 0.2, 0.14, 12), 0x3a2a1a, 'smooth', { y: -0.12, z: 0.25, rz: Math.PI / 2 });
  b.add(new BoxGeometry(0.12, 0.14, 0.4), 0x5a3a1a, 'smooth', { y: 0.02, z: -0.25 });
};
const daoBlade = (b: PartBuilder): void => {
  b.add(new BoxGeometry(0.06, 1.1, 0.2), 0xdfe6ee, 'smooth', { y: 0.65, rx: -0.12 });
  b.add(new BoxGeometry(0.2, 0.06, 0.26), 0xd4af37, 'smooth', { y: 0.08 });
  b.add(new BoxGeometry(0.1, 0.34, 0.12), 0x2a0a0a, 'smooth', { y: -0.1 });
};
const goblinEars = (b: PartBuilder, s: number, color: number): void => {
  for (const side of [-1, 1]) b.add(new ConeGeometry(s * 0.09, s * 0.36, 4), color, 'smooth', { x: side * s * 0.56, y: s * 0.22, rz: side * -1.2 });
};

const look = (palette: LookPalette, head?: Maker, hand?: (b: PartBuilder) => void, back?: (b: PartBuilder) => void, paint?: SuitPainter): EnemyLookDef => ({
  palette,
  paint,
  head,
  hand,
  back,
});

// --------------------------------------------------------------------- looks

export const ENEMY_LOOKS: Readonly<Record<EnemyLook, EnemyLookDef>> = {
  // Stage 1-2: the Goblin Gang - purple hoodies, cheap rubber Goblin masks, taped bats.
  thug: look({ cloth: 0x5a2a8a, trim: 0x3a1a5a, skin: 0x5ac84a }, (b, s) => {
    b.add(new SphereGeometry(s * 0.6, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), 0x5a2a8a, 'smooth', { y: s * 0.12, z: -s * 0.06 });
    goblinEars(b, s, 0x5ac84a);
  }, (b) => {
    bat(b, 0x6b4a2a, 1.4);
    b.add(new CylinderGeometry(0.17, 0.17, 0.3, 8), 0x3a8a2a, 'smooth', { y: 0.05 });
  }, undefined, goblinPunkPaint),
  // Stage 2: Mister Negative's Inner Demons - black suits, white demon masks, dao blades.
  knifethug: look({ cloth: 0x101014, trim: 0x0a0a0e, skin: 0xf4f4f4 }, (b, s) => {
    for (const side of [-1, 1]) b.add(new ConeGeometry(s * 0.08, s * 0.3, 5), 0xf4f4f4, 'smooth', { x: side * s * 0.3, y: s * 0.56, rz: side * -0.35 });
  }, (b) => daoBlade(b), undefined, innerDemonPaint),
  // Stage 3: Hammerhead's Maggia - pinstripes, fedoras, drum-fed guns.
  enforcer: look({ cloth: 0x26262e, trim: 0x0e0e14, skin: 0xe8c0a0 }, (b, s) => fedora(b, s, 0x1a1a22), (b) => tommyGun(b), undefined, mobsterPaint),
  hammerhead: look({ cloth: 0x3a3a44, trim: 0x1a1a22, skin: 0xd8b890 }, (b, s) => b.add(new BoxGeometry(s * 1.2, s * 0.3, s * 1.1), 0x8a8a94, 'smooth', { y: s * 0.52 }), (b) => gun(b, 0x1a1a1a), undefined, hammerheadPaint),
  lizardling: look({ cloth: 0x4f8a3a, trim: 0x2f5a1c, skin: 0x7fc85a }, (b, s) => b.add(new BoxGeometry(s * 0.46, s * 0.26, s * 0.5), 0x5aa83a, 'smooth', { y: -s * 0.14, z: s * 0.46 }), (b) => claws(b), (b) => tail(b, 0x4f8a3a), lizardSpawnPaint),
  lizard: look({ cloth: 0xf4f4f0, trim: 0x3a4a6a, skin: 0x4f9a3a }, (b, s) => {
    b.add(new BoxGeometry(s * 0.5, s * 0.3, s * 0.6), 0x4f9a3a, 'smooth', { y: -s * 0.1, z: s * 0.5 });
    eyes(b, s, 0xffd23a, true, 0.22, 0.18);
  }, (b) => claws(b, 0xe8e0c8), (b) => tail(b, 0x3f8a2e), lizardPaint),
  goblintrooper: look({ cloth: 0x5a2a8a, trim: 0x2a0a4a, skin: 0x4fb84a }, (b, s) => helmet(b, s, 0x3a8a36, 0xffe23a, true), (b) => gun(b, 0x2a3a2a, 0x7aff5a), (b) => jetpack(b, 0x3a5a3a)),
  greengoblin: look({ cloth: 0x5a2a8a, trim: 0x2a0a4a, skin: 0x4fb84a }, (b, s) => {
    b.add(new BoxGeometry(s * 1.12, s * 0.24, s * 1.1), 0x5a2a8a, 'smooth', { y: s * 0.52 });
    for (const side of [-1, 1]) b.add(new ConeGeometry(s * 0.12, s * 0.5, 4), 0x4fb84a, 'smooth', { x: side * s * 0.62, y: s * 0.28, rz: side * -1.1 });
  }, (b) => b.add(new SphereGeometry(0.3, 10, 8), 0xff8a1c, 'glow', { y: 0.15 }), (b) => wings(b, 0x3a5a3a, 1.2), goblinPaint),
  sparkgoon: look({ cloth: 0x2a9a3a, trim: 0x14501c, skin: 0xffe23a }, (b, s) => lightning(b, s * 0.7, 0xffe23a), (b) => b.add(new CylinderGeometry(0.1, 0.1, 1.4, 6), 0xffe23a, 'glow', { y: 0.5 }), undefined, sparkPaint),
  electro: look({ cloth: 0x2ab84a, trim: 0x146a2a, skin: 0xffe23a }, (b, s) => lightning(b, s, 0xffe23a), (b) => orbHand(b, 0x9affff), undefined, electroPaint),
  rhinoguard: look({ cloth: 0x6a7484, trim: 0x3a4454, skin: 0xd8b890 }, (b, s) => {
    helmet(b, s, 0x6a7484);
    b.add(new ConeGeometry(s * 0.1, s * 0.4, 6), 0xe8e2d0, 'smooth', { y: s * 0.3, z: s * 0.55, rx: 1.0 });
  }, (b) => pipe(b), undefined, rhinoGuardPaint),
  rhino: look({ cloth: 0x7a8494, trim: 0x5a6474, skin: 0xe0b890 }, (b, s) => {
    b.add(new SphereGeometry(s * 0.66, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), 0x7a8494, 'smooth', { y: s * 0.02 });
    b.add(new ConeGeometry(s * 0.2, s * 0.8, 8), 0xe8e2d0, 'smooth', { y: s * 0.42, z: s * 0.5, rx: 0.9 });
  }, undefined, undefined, rhinoPaint),
  hunter: look({ cloth: 0xd8a848, trim: 0x2a1a0a, skin: 0xd8a07a }, (b, s) => {
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      b.add(new ConeGeometry(s * 0.1, s * 0.3, 4), 0xc8862a, 'smooth', { x: Math.cos(a) * s * 0.5, y: -s * 0.38, z: Math.sin(a) * s * 0.5 - s * 0.05, rx: Math.PI });
    }
  }, (b) => spear(b), undefined, hunterPaint),
  kraven: look({ cloth: 0xc89a4a, trim: 0x6a4a1a, skin: 0xd8a07a }, (b, s) => {
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      b.add(new ConeGeometry(s * 0.14, s * 0.4, 5), 0xc8862a, 'smooth', { x: Math.cos(a) * s * 0.52, y: -s * 0.35, z: Math.sin(a) * s * 0.52 - s * 0.05, rx: Math.PI });
    }
  }, (b) => spear(b), undefined, kravenPaint),
  vulturedrone: look({ cloth: 0x4a5a3a, trim: 0x2a3a1a, skin: 0x9aa4b4 }, (b, s) => eyes(b, s, 0xff3a3a, true, 0.18), undefined, (b) => wings(b, 0x5a6a4a, 1.0)),
  vulture: look({ cloth: 0x5a6a4a, trim: 0x3a4a2a, skin: 0xe8c8a8 }, (b, s) => {
    b.add(new BoxGeometry(s * 0.5, s * 0.3, s * 0.5), 0x3a4a2a, 'smooth', { y: -s * 0.55, z: -s * 0.1 });
    b.add(new ConeGeometry(s * 0.1, s * 0.3, 4), 0xd8b830, 'smooth', { y: -s * 0.05, z: s * 0.6, rx: Math.PI / 2 });
  }, (b) => claws(b, 0x9aa4b4), (b) => wings(b, 0x5a6a4a, 1.8), vulturePaint),
  illusion: look({ cloth: 0x6a3ab0, trim: 0x2a0a5a, skin: 0xbff0ff }, (b, s) => dome(b, s), undefined, (b) => cape(b, 0x8a4ac8, 1.6)),
  mysterio: look({ cloth: 0x3a8a4a, trim: 0x2a6a3a, skin: 0x5ad08a }, (b, s) => {
    dome(b, s);
    b.add(new TorusGeometry(s * 0.66, s * 0.08, 6, 20), 0x3a8a4a, 'smooth', { y: -s * 0.5, rx: Math.PI / 2 });
  }, (b) => b.add(new SphereGeometry(0.26, 10, 8), 0x5affaa, 'glow', { y: 0.1 }), (b) => cape(b, 0x6a2a9a, 2.2), mysterioPaint),
  sandbrute: look({ cloth: 0xc8a868, trim: 0x8a6a3a, skin: 0xe0c080 }, (b, s) => eyes(b, s, 0x3a2a1a, false), (b) => b.add(new SphereGeometry(0.4, 8, 6), 0xd8b870, 'smooth', { y: 0.2 })),
  sandman: look({ cloth: 0x3a8a3a, trim: 0x1a5a1a, skin: 0xe0c080 }, (b, s) => b.add(new SphereGeometry(s * 0.3, 8, 6), 0xd8b870, 'smooth', { y: s * 0.6, sx: 1.6 }), (b) => b.add(new BoxGeometry(0.7, 0.7, 0.7), 0xd8b870, 'smooth', { y: 0.2 }), undefined, sandmanPaint),
  octobot: look({ cloth: 0x8a9aa4, trim: 0x4a5a64, skin: 0xb8c4d0 }, (b, s) => eyes(b, s, 0xff3a3a, true, 0.12), undefined, (b) => tentacles(b, 0x6a7a84, 0x3a4a54, 2, 1.0)),
  docock: look({ cloth: 0x3a6a3a, trim: 0x1a3a1a, skin: 0xe0b890 }, (b, s) => {
    for (const side of [-1, 1]) b.add(new CylinderGeometry(s * 0.14, s * 0.14, s * 0.06, 12), 0x2a2a2a, 'smooth', { x: side * s * 0.2, y: s * 0.08, z: s * 0.52, rx: Math.PI / 2 });
  }, undefined, (b) => tentacles(b, 0x8a9a6a, 0x5a6a4a, 4, 1.4), docOckPaint),
  handninja: look({ cloth: 0x8a141c, trim: 0x2a0508, skin: 0xe0b890 }, (b, s) => mask(b, s, 0x2a0508), (b) => {
    b.add(new BoxGeometry(0.06, 1.4, 0.16), 0xdfe6ee, 'smooth', { y: 0.7 });
    b.add(new BoxGeometry(0.1, 0.4, 0.12), 0x22252e, 'smooth', { y: -0.1 });
  }),
  negative: look({ cloth: 0x101014, trim: 0x050508, skin: 0x2a2a34 }, (b, s) => eyes(b, s, 0xffffff, true), (b) => orbHand(b, 0xf4f4ff), (b) => {
    for (let i = 0; i < 5; i += 1) b.add(new ConeGeometry(0.1, 0.9, 4), 0xf4f4ff, 'glow', { x: (i - 2) * 0.25, y: 0.4 + Math.abs(i - 2) * -0.1, z: -0.3 });
  }, negativePaint),
  symbiote: look({ cloth: 0x14151c, trim: 0x0a0a0e, skin: 0x1a1b22 }, (b, s) => {
    for (const side of [-1, 1]) b.add(new BoxGeometry(s * 0.32, s * 0.16, s * 0.04), 0xf4f6ff, 'smooth', { x: side * s * 0.24, y: s * 0.14, z: s * 0.52, rz: side * -0.5 });
  }, (b) => claws(b, 0x14151c), (b) => tentacles(b, 0x14151c, 0x0a0a0e, 2, 0.8)),
  venom: look({ cloth: 0x0e0f16, trim: 0x050508, skin: 0x16171f }, (b, s) => {
    b.add(new ConeGeometry(s * 0.1, s * 0.5, 5), 0xff4a8a, 'smooth', { y: -s * 0.55, z: s * 0.6, rx: 2.4 });
  }, (b) => claws(b, 0xf4f6ff), (b) => tentacles(b, 0x0e0f16, 0x16171f, 4, 1.2), venomPaint),
  carnagespawn: look({ cloth: 0xc81424, trim: 0x7a0a12, skin: 0xa81020 }, (b, s) => eyes(b, s, 0xf4f6ff, false, 0.22, 0.18), (b) => claws(b, 0xc81424), (b) => tentacles(b, 0xc81424, 0x14050a, 2, 0.9)),
  carnage: look({ cloth: 0xc81424, trim: 0x14050a, skin: 0xb01020 }, undefined, (b) => {
    b.add(new BoxGeometry(0.08, 1.6, 0.4), 0xc81424, 'smooth', { y: 0.6 });
    b.add(new ConeGeometry(0.2, 0.4, 4), 0xc81424, 'smooth', { y: 1.5 });
  }, (b) => tentacles(b, 0xc81424, 0x14050a, 4, 1.5), carnagePaint),
  kingpinguard: look({ cloth: 0x1a1a22, trim: 0x0a0a0e, skin: 0xe0b890 }, (b, s) => {
    b.add(new BoxGeometry(s * 0.9, s * 0.14, s * 0.1), 0x0a0a0e, 'smooth', { y: s * 0.12, z: s * 0.5 });
  }, (b) => gun(b, 0x1a1a1a, 0xffe23a)),
  kingpin: look({ cloth: 0xf4f2ec, trim: 0xc8c4bc, skin: 0xe0b890 }, undefined, (b) => {
    b.add(new CylinderGeometry(0.06, 0.06, 2.0, 8), 0x2a1a0a, 'smooth', { y: 0.6 });
    b.add(new OctahedronGeometry(0.2, 0), 0xe8f4ff, 'glow', { y: 1.7 });
  }, undefined, kingpinPaint),
  sinistertrooper: look({ cloth: 0x2a1a4a, trim: 0x140a2a, skin: 0x9aa4b4 }, (b, s) => helmet(b, s, 0x3a2a5a, 0xff3a8a, true), (b) => gun(b, 0x2a1a3a, 0xff3a8a), (b) => jetpack(b, 0x3a2a5a)),
  scorpion: look({ cloth: 0x4f8a2e, trim: 0x2a4a1a, skin: 0x7aff5a }, (b, s) => {
    b.add(new BoxGeometry(s * 1.1, s * 0.3, s * 1.1), 0x3a6a2a, 'smooth', { y: s * 0.5 });
    b.add(new ConeGeometry(s * 0.12, s * 0.4, 4), 0x3a6a2a, 'smooth', { y: s * 0.8, z: -s * 0.2, rx: -0.5 });
  }, (b) => claws(b, 0x3a6a2a), (b) => tail(b, 0x4f8a2e, 0x7aff5a), scorpionPaint),
  goblinelite: look({ cloth: 0x8a1a2a, trim: 0x3a0a14, skin: 0x4fb84a }, (b, s) => helmet(b, s, 0x5a1a2a, 0xffe23a, true), (b) => b.add(new SphereGeometry(0.28, 10, 8), 0xff5a1c, 'glow', { y: 0.12 }), (b) => wings(b, 0x5a1a2a, 1.1)),
  redgoblin: look({ cloth: 0xb01418, trim: 0x2a0a0a, skin: 0xc81424 }, (b, s) => {
    for (const side of [-1, 1]) b.add(new ConeGeometry(s * 0.12, s * 0.55, 4), 0xb01418, 'smooth', { x: side * s * 0.6, y: s * 0.32, rz: side * -1.1 });
    for (let i = 0; i < 5; i += 1) b.add(new ConeGeometry(s * 0.08, s * 0.4, 4), 0xff5a1c, 'glow', { x: (i - 2) * s * 0.18, y: s * 0.62 });
  }, (b) => b.add(new SphereGeometry(0.32, 10, 8), 0xff5a1c, 'glow', { y: 0.14 }), (b) => {
    wings(b, 0x7a0a12, 1.4);
    tail(b, 0xb01418, 0xff5a1c);
  }, redGoblinPaint),

  // Stage 19, Wall Street
  robber: look({ cloth: 0x4a4e58, trim: 0x2a2c34, skin: 0xd8a47a }, (b, s) => {
    beanie(b, s, 0x14151c);
    bandana(b, s, 0x14151c);
  }, (b) => bat(b, 0xc8202a, 1.3), (b) => b.add(new SphereGeometry(0.5, 8, 6), 0x8a6a3a, 'smooth', { y: -0.3, z: -0.2, sy: 1.2 })),
  shocker: look({ cloth: 0xe8c050, trim: 0x8a5a2a, skin: 0xe0b890 }, (b, s) => {
    for (const side of [-1, 1]) b.add(new CylinderGeometry(s * 0.13, s * 0.13, s * 0.08, 10), 0xffe8a0, 'glow', { x: side * s * 0.22, y: s * 0.1, z: s * 0.52, rx: Math.PI / 2 });
  }, (b) => gauntlet(b, 0xfff4c0), undefined, shockerPaint),
  // Stage 20, East River Pier
  waterclone: look({ cloth: 0x3a8ae0, trim: 0x1a5aa8, skin: 0x9fdcff }, (b, s) => eyes(b, s, 0xf4fbff, true, 0.2), (b) => waterOrb(b)),
  hydroman: look({ cloth: 0x3a8a3a, trim: 0x1a5aa8, skin: 0x3a8ae0 }, (b, s) => {
    for (let i = 0; i < 5; i += 1) b.add(new ConeGeometry(s * 0.12, s * 0.5, 5), 0x9fdcff, 'glow', { x: (i - 2) * s * 0.2, y: s * 0.62, z: -s * 0.1 });
  }, (b) => waterOrb(b), (b) => {
    for (let i = 0; i < 4; i += 1) b.add(new SphereGeometry(0.3 - i * 0.05, 8, 6), 0x5ab8ff, 'glow', { y: -0.6 - i * 0.3, z: -0.4 - i * 0.2 });
  }, hydroPaint),
  // Stage 21, Grand Central Terminal
  crewman: look({ cloth: 0x2a2a34, trim: 0x14151c, skin: 0xe0b890 }, (b, s) => fedora(b, s, 0x1a1a22), (b) => gun(b, 0x1a1a1a, 0xffd23a)),
  tombstone: look({ cloth: 0x14151c, trim: 0x0a0a0e, skin: 0xf4f4ee }, undefined, (b) => {
    for (let i = 0; i < 4; i += 1) b.add(new SphereGeometry(0.08, 6, 5), 0xd4af37, 'smooth', { x: (i - 1.5) * 0.12, y: 0.12, z: 0.26 });
  }, undefined, tombstonePaint),
  // Stage 22, Brooklyn Navy Yard
  beetledrone: look({ cloth: 0x2a8a3a, trim: 0x1a4a1a, skin: 0x6a2a9a }, (b, s) => helmet(b, s, 0x2a8a3a, 0xff3a3a, true), (b) => gun(b, 0x1a4a1a, 0xff3a3a), (b) => wings(b, 0x6a2a9a, 1.0)),
  beetle: look({ cloth: 0x2a8a3a, trim: 0x6a2a9a, skin: 0x2a8a3a }, (b, s) => {
    helmet(b, s, 0x2a8a3a, 0xff3a3a, true);
    b.add(new ConeGeometry(s * 0.14, s * 0.6, 5), 0x6a2a9a, 'smooth', { y: s * 0.6, z: s * 0.2, rx: 0.5 });
  }, (b) => {
    b.add(new CylinderGeometry(0.2, 0.26, 1.1, 10), 0x1a4a1a, 'smooth', { y: 0.3, z: 0.2, rx: Math.PI / 2 });
    b.add(new SphereGeometry(0.14, 8, 6), 0xff3a3a, 'glow', { y: 0.3, z: 0.78 });
  }, (b) => wings(b, 0x6a2a9a, 1.9, true), beetlePaint),
  // Stage 23, Trinity Churchyard
  thrall: look({ cloth: 0x2a1a2a, trim: 0x0e0a0e, skin: 0xc8c4cc }, (b, s) => eyes(b, s, 0xff2a2a, true, 0.2), (b) => claws(b, 0xe8e4ec), (b) => cape(b, 0x1a0a14, 1.8)),
  morbius: look({ cloth: 0x0e0f16, trim: 0xa81a1a, skin: 0xc8c8cc }, (b, s) => {
    for (const side of [-1, 1]) b.add(new BoxGeometry(s * 0.5, s * 0.5, s * 0.06), 0xa81a1a, 'smooth', { x: side * s * 0.4, y: -s * 0.4, z: -s * 0.3, rz: side * 0.5 });
  }, (b) => claws(b, 0xe8e4ec), (b) => {
    cape(b, 0x0e0f16, 2.4);
    wings(b, 0x2a0a14, 1.5);
  }, morbiusPaint),
  // Stage 24, Queens Steelworks
  magmaling: look({ cloth: 0x3a2e28, trim: 0x1a1410, skin: 0xff6a1c }, (b, s) => eyes(b, s, 0xffa03a, true, 0.2), (b) => b.add(new SphereGeometry(0.34, 8, 6), 0xff6a1c, 'glow', { y: 0.12 }), (b) => {
    for (let i = 0; i < 4; i += 1) b.add(new ConeGeometry(0.16, 0.6, 4), 0xff8a1c, 'glow', { x: (i - 1.5) * 0.3, y: 0.3, z: -0.3, rx: -0.5 });
  }),
  moltenman: look({ cloth: 0xd4a030, trim: 0x8a5a1a, skin: 0xe8b840 }, (b, s) => {
    for (let i = 0; i < 6; i += 1) b.add(new ConeGeometry(s * 0.1, s * 0.4, 4), 0xff6a1c, 'glow', { x: (i - 2.5) * s * 0.18, y: s * 0.6 });
  }, (b) => b.add(new SphereGeometry(0.4, 10, 8), 0xff6a1c, 'glow', { y: 0.14 }), undefined, moltenPaint),
  // Stage 25, The High Line
  spotling: look({ cloth: 0xf4f4f4, trim: 0x050508, skin: 0xf4f4f4 }, undefined, (b) => portalDisc(b, 0.35), undefined, spotPaint),
  spot: look({ cloth: 0xf4f4f4, trim: 0x050508, skin: 0xf4f4f4 }, undefined, (b) => portalDisc(b, 0.6), (b) => {
    b.add(new TorusGeometry(1.1, 0.12, 6, 24), 0x050508, 'smooth', { y: 0.2, z: -0.5 });
    b.add(new TorusGeometry(0.95, 0.05, 4, 24), 0xb16bff, 'glow', { y: 0.2, z: -0.5 });
  }, spotPaint),
  // Stage 26, United Nations Plaza
  double: look({ cloth: 0x6a6e78, trim: 0x3a3e48, skin: 0xe0dcd4 }, (b, s) => b.add(new BoxGeometry(s * 0.9, s * 0.8, s * 0.06), 0xf4f4f0, 'smooth', { y: s * 0.02, z: s * 0.5 }), (b) => gun(b, 0x3a3e48, 0xb16bff)),
  chameleon: look({ cloth: 0x6a6e78, trim: 0x6a3aa8, skin: 0xf4f4f0 }, undefined, (b) => {
    b.add(new BoxGeometry(0.12, 0.2, 0.7), 0x3a3e48, 'smooth', { y: 0.05, z: 0.25 });
    b.add(new ConeGeometry(0.06, 0.2, 5), 0xb16bff, 'glow', { y: 0.05, z: 0.7, rx: Math.PI / 2 });
  }, (b) => cape(b, 0x3a3e48, 1.6), chameleonPaint),
  // Stage 27, Rockefeller Center
  hobtrooper: look({ cloth: 0x1f4fd6, trim: 0x1a3aa8, skin: 0xe0b890 }, (b, s) => helmet(b, s, 0xff7a1a, 0xffe23a, true), (b) => pumpkinBomb(b), (b) => jetpack(b, 0x1a3aa8)),
  hobgoblin: look({ cloth: 0x1f4fd6, trim: 0xff7a1a, skin: 0x2a8a3a }, (b, s) => {
    for (const side of [-1, 1]) b.add(new ConeGeometry(s * 0.12, s * 0.5, 4), 0xff7a1a, 'smooth', { x: side * s * 0.55, y: s * 0.45, rz: side * -0.6 });
  }, (b) => pumpkinBomb(b), (b) => {
    cape(b, 0xff7a1a, 2.2);
    wings(b, 0x1a3aa8, 1.3);
  }, hobgoblinPaint),
  // Stage 28, Jackal's Clone Lab
  spiderclone: look({ cloth: 0xb81a24, trim: 0x1f3fb0, skin: 0xb81a24 }, undefined, (b) => claws(b, 0xe8e4ec), undefined, clonePaint),
  jackal: look({ cloth: 0x4aa84a, trim: 0x2a6a2a, skin: 0xc8e8b8 }, (b, s) => {
    for (const side of [-1, 1]) b.add(new ConeGeometry(s * 0.14, s * 0.5, 4), 0x4aa84a, 'smooth', { x: side * s * 0.36, y: s * 0.62 });
  }, (b) => claws(b, 0xf4efe3), (b) => tail(b, 0x4aa84a), jackalPaint),
  // Stage 29, Liberty Island
  hound: look({ cloth: 0x14151c, trim: 0x0a0a0e, skin: 0x2a2a34 }, (b, s) => {
    b.add(new BoxGeometry(s * 0.9, s * 0.4, s * 0.08), 0xe8e4dc, 'smooth', { y: s * 0.1, z: s * 0.5 });
    eyes(b, s, 0xb16bff, true, 0.2, 0.12);
  }, (b) => claws(b, 0x2a2a34), (b) => tail(b, 0x14151c)),
  morlun: look({ cloth: 0x0e0f16, trim: 0x3a3a44, skin: 0xd8d4dc }, (b, s) => b.add(new BoxGeometry(s * 1.06, s * 0.9, s * 0.4), 0x14151c, 'smooth', { y: -s * 0.1, z: -s * 0.36 }), (b) => orbHand(b, 0xb16bff), (b) => cape(b, 0x0e0f16, 2.8), morlunPaint),
  // Stage 30, Empire State Summit
  slayerdrone: look({ cloth: 0xa8b4c0, trim: 0x1a1b22, skin: 0xb8c4d0 }, (b, s) => b.add(new SphereGeometry(s * 0.2, 10, 8), 0xff2a2a, 'glow', { y: s * 0.05, z: s * 0.45 }), (b) => gun(b, 0x1a1b22, 0xff2a2a), (b) => legs(b, 0xa8b4c0, 0x1a1b22, 1.0)),
  spiderslayer: look({ cloth: 0xb8c4d0, trim: 0x1a1b22, skin: 0xa8b4c0 }, (b, s) => {
    b.add(new SphereGeometry(s * 0.7, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), 0xb8c4d0, 'smooth', { y: s * 0.05 });
    b.add(new SphereGeometry(s * 0.2, 10, 8), 0xff2a2a, 'glow', { y: s * 0.02, z: s * 0.6 });
  }, (b) => claws(b, 0xdfe6ee), (b) => legs(b, 0xb8c4d0, 0x1a1b22, 1.8), slayerPaint),
};
