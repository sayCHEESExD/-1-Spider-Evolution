import { BoxGeometry, ConeGeometry, CylinderGeometry, OctahedronGeometry, SphereGeometry, TorusGeometry } from 'three';
import { GEAR_RARITY_COLORS, gearById, shooterById } from '@spider/shared';
import type { PartBuilder } from '../render/PartBuilder.js';
import type { AccessoryContext } from './SpiderSuits.js';

/**
 * WORN GEAR AND WEB SHOOTERS, as primitives on the body.
 *
 * Every gear piece is DRAWN where it is worn - the Goblin Mask over the face,
 * the Glider's bat wings on the back, Doc Ock's arms from the small of the
 * back, runes as glowing stones on the belt - so what a player equips is what
 * everyone sees. Web shooters are wrist cartridges on both forearms in the
 * shooter's colour.
 *
 * Authored in CHARACTER space (x = the wearer's left, y up, z forward) around
 * their mount, sized by the measured body.
 */
export type GearMountPoint = 'head' | 'back' | 'backLow' | 'chest' | 'belt' | 'handR' | 'handL';

export interface GearPart {
  readonly mount: GearMountPoint;
  readonly build: (b: PartBuilder, c: AccessoryContext) => void;
  /** Built with a see-through material (the Mysterio dome). */
  readonly glass?: boolean;
}

const hex = (color: string): number => Number.parseInt(color.slice(1), 16);

const wing = (b: PartBuilder, side: number, color: number, rib: number, span: number, height: number): void => {
  // A bat wing: three tapered panels fanning out from the shoulder, with ribs.
  for (let i = 0; i < 3; i += 1) {
    const t = i / 2;
    const x = side * (0.35 + span * (0.25 + t * 0.32));
    const y = 0.25 + (1 - t) * 0.2 - t * height * 0.25;
    b.add(new BoxGeometry(span * 0.42, height * (0.9 - t * 0.28), 0.05), color, 'smooth', { x, y, z: -0.32, rz: side * (0.35 - t * 0.5) });
    b.add(new BoxGeometry(span * 0.46, 0.06, 0.08), rib, 'smooth', { x, y: y + height * 0.38 * (1 - t * 0.3), z: -0.3, rz: side * (0.35 - t * 0.5) });
  }
};

/** One piece of gear's parts. `rarity` tints the glow of runes. */
export const gearParts = (gearId: number, rarity: number, runeIndex: number): GearPart[] => {
  const def = gearById(gearId);
  if (!def) return [];
  const color = hex(def.color);
  const rarityGlow = hex(GEAR_RARITY_COLORS[Math.max(0, Math.min(3, rarity))] ?? '#ffffff');
  switch (gearId) {
    case 1:
    case 2:
    case 3:
    case 4:
      return [
        {
          mount: 'belt',
          build: (b, c) => {
            const x = (runeIndex - 1) * c.torsoW * 0.32;
            b.add(new OctahedronGeometry(0.16, 0), color, 'glow', { x, y: 0.02, z: 0.08, sy: 1.35 });
            b.add(new TorusGeometry(0.17, 0.035, 5, 12), rarityGlow, 'glow', { x, y: 0.02, z: 0.04 });
          },
        },
      ];
    case 5:
      // The Goblin Mask: a green face with yellow eyes, pointed ears and a grin.
      return [
        {
          mount: 'head',
          build: (b, c) => {
            const h = c.head;
            b.add(new BoxGeometry(h * 1.08, h * 1.02, h * 0.16), 0x4fb84a, 'smooth', { y: -h * 0.02, z: h * 0.52 });
            b.add(new BoxGeometry(h * 1.1, h * 0.28, h * 1.08), 0x3a8a36, 'smooth', { y: h * 0.46 });
            for (const side of [-1, 1]) {
              b.add(new BoxGeometry(h * 0.26, h * 0.12, h * 0.06), 0xffe23a, 'glow', { x: side * h * 0.22, y: h * 0.12, z: h * 0.61, rz: side * -0.3 });
              b.add(new ConeGeometry(h * 0.12, h * 0.5, 4), 0x4fb84a, 'smooth', { x: side * h * 0.62, y: h * 0.28, rz: side * -1.1 });
            }
            b.add(new BoxGeometry(h * 0.52, h * 0.08, h * 0.05), 0x1a3a1a, 'smooth', { y: -h * 0.26, z: h * 0.61 });
            b.add(new ConeGeometry(h * 0.08, h * 0.26, 4), 0x3a8a36, 'smooth', { y: -h * 0.02, z: h * 0.68, rx: Math.PI / 2 });
          },
        },
      ];
    case 6:
      // Green Goblin's Glider: bat wings on the back, a jet between them.
      return [
        {
          mount: 'back',
          build: (b) => {
            for (const side of [-1, 1]) wing(b, side, 0x3a5a3a, 0x1f2f1f, 1.35, 1.2);
            b.add(new CylinderGeometry(0.18, 0.22, 0.6, 8), 0x2a3a2a, 'smooth', { y: -0.1, z: -0.34 });
            b.add(new ConeGeometry(0.16, 0.3, 8), 0xffa01c, 'glow', { y: -0.52, z: -0.34, rx: Math.PI });
          },
        },
      ];
    case 7:
      // The Lizard's tail, from the small of the back to the street.
      return [
        {
          mount: 'backLow',
          build: (b) => {
            for (let i = 0; i < 5; i += 1) {
              const r = 0.22 - i * 0.035;
              b.add(new SphereGeometry(r, 8, 6), i % 2 ? 0x3f8a2e : 0x4f9a3a, 'smooth', { y: -0.1 - i * 0.2, z: -0.25 - i * 0.26, sz: 1.5 });
            }
          },
        },
      ];
    case 8:
      // Electro's mask: a yellow lightning star around the face.
      return [
        {
          mount: 'head',
          build: (b, c) => {
            const h = c.head;
            for (let i = 0; i < 7; i += 1) {
              const a = (i / 6) * Math.PI - Math.PI / 2;
              b.add(new ConeGeometry(h * 0.1, h * 0.55, 4), color, 'glow', { x: Math.sin(a) * h * 0.6, y: Math.cos(a) * h * 0.6 + h * 0.05, z: h * 0.38, rz: -a });
            }
            b.add(new BoxGeometry(h * 1.02, h * 0.34, h * 0.08), 0x2ac84a, 'smooth', { y: h * 0.12, z: h * 0.52 });
          },
        },
      ];
    case 9:
      // Rhino's helmet: grey plating and the horn.
      return [
        {
          mount: 'head',
          build: (b, c) => {
            const h = c.head;
            b.add(new SphereGeometry(h * 0.66, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), color, 'smooth', { y: h * 0.02 });
            b.add(new ConeGeometry(h * 0.18, h * 0.72, 8), 0xe8e2d0, 'smooth', { y: h * 0.42, z: h * 0.46, rx: 0.9 });
            b.add(new ConeGeometry(h * 0.1, h * 0.32, 8), 0xe8e2d0, 'smooth', { y: h * 0.62, z: h * 0.16, rx: 0.4 });
          },
        },
      ];
    case 10:
      // Kraven's fang necklace, with the lion's-mane collar.
      return [
        {
          mount: 'chest',
          build: (b, c) => {
            b.add(new TorusGeometry(c.torsoW * 0.36, 0.04, 5, 18, Math.PI), 0x6a4a2a, 'smooth', { y: 0.32, z: -0.02, rz: Math.PI });
            for (let i = 0; i < 7; i += 1) {
              const a = Math.PI * (0.15 + (i / 6) * 0.7);
              b.add(new ConeGeometry(0.05, 0.24, 5), color, 'smooth', { x: Math.cos(a) * c.torsoW * 0.36, y: 0.32 - Math.sin(a) * c.torsoW * 0.36 - 0.1, z: 0.04, rx: Math.PI });
            }
          },
        },
      ];
    case 11:
      // Vulture's wings: long feathered green wings.
      return [
        {
          mount: 'back',
          build: (b) => {
            for (const side of [-1, 1]) {
              for (let i = 0; i < 5; i += 1) {
                b.add(new BoxGeometry(0.34, 1.4 - i * 0.12, 0.05), i % 2 ? 0x5a6a4a : 0x6a7a52, 'smooth', { x: side * (0.45 + i * 0.3), y: 0.25 - i * 0.12, z: -0.3, rz: side * (0.9 - i * 0.12) });
              }
            }
          },
        },
      ];
    case 12:
      // Mysterio's dome: a glass bowl over the head on a green collar.
      return [
        {
          mount: 'head',
          build: (b, c) => b.add(new TorusGeometry(c.head * 0.62, c.head * 0.07, 6, 20), 0x3a8a4a, 'smooth', { y: -c.head * 0.48, rx: Math.PI / 2 }),
        },
        {
          mount: 'head',
          glass: true,
          build: (b, c) => b.add(new SphereGeometry(c.head * 0.82, 18, 12), 0xbff0ff, 'smooth', { y: c.head * 0.06 }),
        },
      ];
    case 13:
      // Doctor Octopus's four arms, pincers up.
      return [
        {
          mount: 'backLow',
          build: (b) => {
            for (const [sx, sy] of [
              [-1, 1],
              [1, 1],
              [-1, -1],
              [1, -1],
            ] as const) {
              for (let i = 0; i < 4; i += 1) {
                b.add(new SphereGeometry(0.11 - i * 0.012, 7, 5), 0x8a9a6a, 'smooth', { x: sx * (0.2 + i * 0.24), y: 0.1 + sy * (0.15 + i * 0.18) + (sy > 0 ? i * 0.12 : -i * 0.05), z: -0.3 - i * 0.18 });
              }
              b.add(new ConeGeometry(0.1, 0.26, 3), 0x5a6a4a, 'smooth', { x: sx * 1.1, y: sy > 0 ? 1.2 : -0.5, z: -1.0, rz: sx * 0.6 });
              b.add(new SphereGeometry(0.06, 6, 5), 0xff3a3a, 'glow', { x: sx * 1.05, y: sy > 0 ? 1.05 : -0.4, z: -0.96 });
            }
          },
        },
      ];
    case 14:
      // Symbiote tendrils: black strands lashing out from the back.
      return [
        {
          mount: 'back',
          build: (b) => {
            for (let i = 0; i < 6; i += 1) {
              const a = (i / 5 - 0.5) * 2.2;
              b.add(new ConeGeometry(0.1, 1.3, 5), 0x14151c, 'smooth', { x: Math.sin(a) * 0.55, y: 0.1 + Math.cos(a) * 0.3, z: -0.5, rz: -a * 0.9, rx: -0.5 });
            }
          },
        },
      ];
    case 15:
      // Kingpin's diamond, on a gold chain.
      return [
        {
          mount: 'chest',
          build: (b, c) => {
            b.add(new TorusGeometry(c.torsoW * 0.32, 0.03, 5, 18, Math.PI), 0xffd23a, 'smooth', { y: 0.3, z: -0.02, rz: Math.PI });
            b.add(new OctahedronGeometry(0.2, 0), color, 'glow', { y: -0.1, z: 0.08, sy: 1.3 });
          },
        },
      ];
    default:
      return [];
  }
};

/** The web shooter cartridges on both wrists. */
export const shooterParts = (shooterId: number): GearPart[] => {
  const def = shooterById(shooterId) ?? shooterById(1)!;
  const color = hex(def.color);
  const make = (side: number) => (b: PartBuilder, c: AccessoryContext): void => {
    const r = c.limb * 0.62;
    b.add(new CylinderGeometry(r, r, 0.22, 10), 0x2a2e38, 'smooth', { y: 0.26 });
    b.add(new BoxGeometry(r * 0.9, 0.14, r * 0.7), color, 'glow', { y: 0.26, z: r * 0.75 });
    b.add(new CylinderGeometry(r * 0.25, r * 0.25, 0.1, 6), 0xdfe6ee, 'smooth', { x: side * r * 0.2, y: 0.12, z: r * 0.7 });
  };
  return [
    { mount: 'handR', build: make(-1) },
    { mount: 'handL', build: make(1) },
  ];
};
