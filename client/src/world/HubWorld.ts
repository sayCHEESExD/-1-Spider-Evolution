import {
  ARENA,
  BUILDINGS,
  BUILDING_HALF,
  BUILDING_PAD_RADIUS,
  EGGS,
  EGG_PLACEMENTS,
  HUB,
  HUB_FRONT_WALL_DEPTH,
  HUB_GATE,
  HUB_LAMPS,
  HUB_TREES,
  PETS_SHOP,
  ROOFTOPS,
  SHOOTER_SHOP,
  STAGES,
  STAGE_COUNT,
  arenaEndZ,
  SUITS,
  SUIT_PADS,
  SUIT_STAGE,
  SUIT_STAIRS,
  TRAINING,
  TRAINING_TIERS,
  WATER_TOWER,
  canTrainOn,
  formatAmount,
  formatWins,
  ownsSuit,
  stairBoxes,
  type EggKind,
} from '@spider/shared';
import {
  AdditiveBlending,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  type Material,
} from 'three';
import { webSplatCanvas } from '../combat/WebEffects.js';
import { PlayerCharacter } from '../player/PlayerCharacter.js';
import { PartBuilder } from '../render/PartBuilder.js';
import { CanvasSign } from './CanvasSign.js';
import { buildHubCity } from './CityLayout.js';
import { facadeBox, facadeTexture, lamp, tree } from './CityProps.js';
import { CityKit } from './NycBuildings.js';
import { LabelSprite, trophyIcon } from './LabelSprite.js';
import { Scoreboard } from './Scoreboard.js';
import { texturedBox } from './texturedBox.js';
import { buildTrainingTown } from './TrainingTown.js';
import { worldTextures } from './WorldTextures.js';

interface PadVisual {
  readonly slot: number;
  readonly material: MeshBasicMaterial;
  readonly label: LabelSprite;
}

interface BuildingVisual {
  readonly tier: number;
  readonly label: LabelSprite;
  readonly ring: Mesh;
  readonly web: Mesh;
  flash: number;
}

const PAD_COLORS = {
  locked: 0xe8303a,
  ready: 0x4aff6a,
  owned: 0xffd23a,
  worn: 0x62e6ff,
} as const;

const hex = (color: string): number => Number.parseInt(color.slice(1), 16);

/**
 * THE PLAZA: a bright New York square boxed in by skyscrapers.
 *
 *   spawn (centre)          a spider-emblem spawn plate on the plaza tiles
 *   TRAINING (left, +X)     six miniature NYC buildings on a sidewalk block,
 *                           each with a web pad in front of it
 *   SUIT UPGRADES (right)   three storeys of suit pads, a suited statue on each
 *   EGGS + BOARDS (back)    six egg pedestals under the two scoreboards
 *   WEB SHOOTERS            a striped street kiosk, back-left
 *   ROOFTOPS                low brick blocks in the corners, to swing up onto
 *   PORTAL (ahead)          the gate onto the villains' streets
 *
 * Every walkable surface and solid matches `@spider/shared`'s map; overlays
 * sit a few hundredths above what they cover and never share a plane.
 */
export class HubWorld {
  readonly root = new Group();
  readonly scoreboard = new Scoreboard();

  private readonly materials: Material[] = [];
  private readonly signs: CanvasSign[] = [];
  private readonly labels: LabelSprite[] = [];
  private readonly pads: PadVisual[] = [];
  private readonly buildings: BuildingVisual[] = [];
  private readonly statues: PlayerCharacter[] = [];
  private readonly eggs: Group[] = [];
  private time = 0;
  private padSignature = '';
  private buildingSignature = '';

  constructor() {
    this.root.name = 'hub';
    this.buildGround();
    this.buildCity();
    this.buildRooftops();
    this.buildTraining();
    this.buildSuitStage();
    this.buildEggs();
    this.buildShooterStand();
    this.buildPortal();
    this.buildStreetProps();
    this.root.add(this.scoreboard.root);
  }

  // ---------------------------------------------------------------- build

  private mat<T extends Material>(material: T): T {
    this.materials.push(material);
    return material;
  }

  private slab(minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number, material: Material, tile = 4): Mesh {
    const mesh = new Mesh(texturedBox(maxX - minX, maxY - minY, maxZ - minZ, tile), material);
    mesh.position.set((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
    mesh.receiveShadow = true;
    this.root.add(mesh);
    return mesh;
  }

  private sign(width: number, height: number, lines: ConstructorParameters<typeof CanvasSign>[2], x: number, y: number, z: number, ry: number): CanvasSign {
    const sign = new CanvasSign(width, height, lines);
    sign.mesh.position.set(x, y, z);
    sign.mesh.rotation.y = ry;
    this.root.add(sign.mesh);
    this.signs.push(sign);
    return sign;
  }

  private label(width: number, height: number, x: number, y: number, z: number): LabelSprite {
    const label = new LabelSprite(width, height, 320);
    label.sprite.position.set(x, y, z);
    this.root.add(label.sprite);
    this.labels.push(label);
    return label;
  }

  private buildGround(): void {
    const asphalt = this.mat(new MeshLambertMaterial({ map: worldTextures.stud('#5c6270') }));
    const plaza = this.mat(new MeshLambertMaterial({ map: worldTextures.plazaTiles('#d8dde6', '#b8c0cc', '#9fb6d8') }));
    const sidewalk = this.mat(new MeshLambertMaterial({ map: worldTextures.stud('#c9ced8') }));
    this.slab(HUB.minX, HUB.maxX, -1, 0, HUB.minZ, HUB.maxZ + HUB_FRONT_WALL_DEPTH, asphalt);
    // The plaza and the sidewalks: overlays a hair above the street, never overlapping each other.
    this.slab(-34, 34, -0.5, 0.03, -36, 30, plaza, 8);
    this.slab(-9, 9, -0.5, 0.03, 30, HUB.maxZ, sidewalk);

    const b = new PartBuilder();
    // Lane markings on the streets round the plaza, clear of the crosswalks and the sidewalk.
    for (const x of [-30, -20, 20, 30]) b.box(4, 0.02, 0.5, 0xffd23a, 'smooth', { x, y: 0.01, z: 33.5 });
    for (const z of [-30, -21, -12, 15, 24]) {
      b.box(0.5, 0.02, 4, 0xffffff, 'smooth', { x: -36.5, y: 0.01, z });
      b.box(0.5, 0.02, 4, 0xffffff, 'smooth', { x: 37, y: 0.01, z });
    }
    // Zebra crosswalks from the plaza to the training block and the suit stage.
    for (let i = 0; i < 7; i += 1) {
      b.box(5.2, 0.02, 0.9, 0xffffff, 'smooth', { x: 37, y: 0.01, z: -5 + i * 1.8 });
      b.box(3.4, 0.02, 0.9, 0xffffff, 'smooth', { x: -36, y: 0.01, z: -5 + i * 1.8 });
    }
    // The spawn plate: a red disc with a black web ring.
    b.add(new CylinderGeometry(6.4, 6.6, 0.12, 40), 0x14151c, 'smooth', { y: 0.09 });
    b.add(new CylinderGeometry(5.8, 5.8, 0.14, 40), 0xd8202c, 'smooth', { y: 0.1 });
    this.root.add(b.build('ground-marks'));

    // The spider on the spawn plate, and a web over it.
    const emblem = new Mesh(new PlaneGeometry(9.5, 9.5), this.mat(new MeshBasicMaterial({ map: this.emblemTexture(), transparent: true, depthWrite: false })));
    emblem.rotation.x = -Math.PI / 2;
    emblem.position.y = 0.18;
    this.root.add(emblem);
  }

  /** A black spider emblem inside a web, drawn once. */
  private emblemTexture(): CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.globalAlpha = 0.55;
    ctx.drawImage(webSplatCanvas(), 0, 0, size, size);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#101014';
    ctx.strokeStyle = '#101014';
    ctx.lineCap = 'round';
    const c = size / 2;
    ctx.beginPath();
    ctx.ellipse(c, c - 22, 14, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(c, c + 22, 18, 32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 7;
    const legs: readonly (readonly [number, number, number, number])[] = [
      [34, -52, 30, -104],
      [48, -18, 80, -46],
      [48, 16, 80, 50],
      [34, 44, 30, 100],
    ];
    for (const side of [-1, 1]) {
      for (const [kx, ky, fx, fy] of legs) {
        ctx.beginPath();
        ctx.moveTo(c + side * 10, c + ky * 0.35);
        ctx.lineTo(c + side * kx, c + ky);
        ctx.lineTo(c + side * fx, c + fy);
        ctx.stroke();
      }
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }

  /**
   * New York round the plaza (`CityLayout`): buildings on the city-wall solids,
   * storefronts along the portal wall, taller rows and the skyline behind, and
   * the ground under all of it, below every walkable slab.
   */
  private buildCity(): void {
    const kit = new CityKit();
    buildHubCity(kit);
    this.root.add(kit.build('hub-city'));
    // From behind the plaza to past the last arena, however many stages there are.
    const from = HUB.minZ - 700;
    const to = arenaEndZ(STAGE_COUNT) + 700;
    const ground = new Mesh(new PlaneGeometry(1600, to - from), this.mat(new MeshLambertMaterial({ color: 0x5c6270 })));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.35, (from + to) / 2);
    ground.receiveShadow = true;
    this.root.add(ground);
  }

  /** The walkable rooftops: brick blocks with flat roofs, a parapet line painted round the edge, water towers. */
  private buildRooftops(): void {
    const facades = new PartBuilder();
    const b = new PartBuilder();
    for (const roof of ROOFTOPS) {
      const w = roof.maxX - roof.minX;
      const d = roof.maxZ - roof.minZ;
      const cx = (roof.minX + roof.maxX) / 2;
      const cz = (roof.minZ + roof.maxZ) / 2;
      facades.add(facadeBox(w, roof.top, d, 4), roof.color, 'smooth', { x: cx, y: roof.top / 2, z: cz });
      // The roof: tar paper a hair above the block, a light edge stripe round it.
      b.box(w - 0.2, 0.04, d - 0.2, 0x3a3a44, 'smooth', { x: cx, y: roof.top + 0.02, z: cz });
      b.box(w - 0.2, 0.05, 0.4, 0xd8d0c0, 'smooth', { x: cx, y: roof.top + 0.045, z: roof.minZ + 0.3 });
      b.box(0.4, 0.05, d - 1.2, 0xd8d0c0, 'smooth', { x: roof.minX + 0.3, y: roof.top + 0.045, z: cz });
      b.box(0.4, 0.05, d - 1.2, 0xd8d0c0, 'smooth', { x: roof.maxX - 0.3, y: roof.top + 0.045, z: cz });
      if (roof.tower) {
        const t = roof.tower;
        const h = WATER_TOWER.half;
        // Legs, the tank and its cone roof: exactly the tower's solid box.
        for (const [lx, lz] of [[-1, -1], [1, 1], [-1, 1], [1, -1]] as const) b.box(0.35, 2.4, 0.35, 0x3a3a44, 'smooth', { x: t.x + lx * (h - 0.4), y: roof.top + 1.2, z: t.z + lz * (h - 0.4) });
        b.add(new CylinderGeometry(h, h, 3.6, 12), 0x9a6a3a, 'smooth', { x: t.x, y: roof.top + 4.2, z: t.z });
        for (let i = 0; i < 3; i += 1) b.add(new CylinderGeometry(h + 0.04, h + 0.04, 0.12, 12), 0x3a3a44, 'smooth', { x: t.x, y: roof.top + 2.8 + i * 1.3, z: t.z });
        b.add(new ConeGeometry(h + 0.1, WATER_TOWER.height - 6, 12), 0x5a3a2a, 'smooth', { x: t.x, y: roof.top + 6.5, z: t.z });
      }
    }
    const mesh = new Mesh(facades.geometries().smooth!, this.mat(new MeshLambertMaterial({ map: facadeTexture(), vertexColors: true })));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.root.add(mesh, b.build('rooftops'));
  }

  // ------------------------------------------------------------ training

  private buildTraining(): void {
    const floor = this.mat(new MeshLambertMaterial({ map: worldTextures.plazaTiles('#c9ced8', '#aab2c0', '#b8c4d8') }));
    this.slab(TRAINING.minX, TRAINING.maxX, -1, TRAINING.floorTop, TRAINING.minZ, TRAINING.maxZ, floor, 6);
    const b = new PartBuilder();
    const top = TRAINING.floorTop;
    // A kerb round the district block.
    b.box(TRAINING.maxX - TRAINING.minX, 0.12, 0.6, 0x8a929e, 'smooth', { x: (TRAINING.minX + TRAINING.maxX) / 2, y: top + 0.06, z: TRAINING.minZ + 0.3 });
    b.box(TRAINING.maxX - TRAINING.minX, 0.12, 0.6, 0x8a929e, 'smooth', { x: (TRAINING.minX + TRAINING.maxX) / 2, y: top + 0.06, z: TRAINING.maxZ - 0.3 });
    b.box(0.6, 0.12, TRAINING.maxZ - TRAINING.minZ - 1.2, 0x8a929e, 'smooth', { x: TRAINING.minX + 0.3, y: top + 0.06, z: 0 });

    for (const place of BUILDINGS) {
      const tier = TRAINING_TIERS[place.tier]!;
      this.miniature(b, place.tier, place.x, place.z, top, tier.height, hex(tier.color), hex(tier.accent));

      // The web pad: a web-patterned disc and a ring showing where the webbing starts.
      const ringMaterial = this.mat(new MeshBasicMaterial({ color: hex(tier.accent), transparent: true, opacity: 0.85, side: DoubleSide, depthWrite: false }));
      const ring = new Mesh(new RingGeometry(BUILDING_PAD_RADIUS - 0.45, BUILDING_PAD_RADIUS, 40), ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(place.padX, top + 0.05, place.padZ);
      this.root.add(ring);
      const webMaterial = this.mat(new MeshBasicMaterial({ map: new CanvasTexture(webSplatCanvas()), color: hex(tier.accent), transparent: true, opacity: 0.55, depthWrite: false }));
      const web = new Mesh(new PlaneGeometry(BUILDING_PAD_RADIUS * 1.8, BUILDING_PAD_RADIUS * 1.8), webMaterial);
      web.rotation.x = -Math.PI / 2;
      web.position.set(place.padX, top + 0.04, place.padZ);
      this.root.add(web);

      const label = this.label(7, 3, place.x - BUILDING_HALF - 0.5, top + tier.height + 3.6, place.z);
      this.buildings.push({ tier: place.tier, label, ring, web, flash: 0 });
    }
    this.root.add(b.build('training'), buildTrainingTown());
    this.setRebirths(0);

    this.sign(44, 9, [
      { text: 'WEB TRAINING', size: 1.2, fill: '#ffffff', stroke: '#6a0a0a', strokeWidth: 0.14 },
      { text: 'Stand on a pad to web the building!', size: 0.7, fill: '#ffd23a', stroke: '#1a1a3a', strokeWidth: 0.14 },
    ], HUB.maxX - 0.3, 20, 0, -Math.PI / 2);
  }

  /**
   * One miniature New York building. The main shaft fills the building's solid
   * footprint to its full height (so its roof is exactly where a player lands);
   * only thin spires and flush signs go beyond.
   */
  private miniature(b: PartBuilder, tier: number, x: number, z: number, y0: number, height: number, color: number, accent: number): void {
    const w = BUILDING_HALF * 2;
    const face = x - BUILDING_HALF - 0.02;
    const windows = (h: number, from = 0.6): void => {
      for (let wy = y0 + from + 0.6; wy < y0 + h - 0.8; wy += 1.3) {
        for (let wz = -2.2; wz <= 2.2; wz += 1.1) b.box(0.05, 0.7, 0.6, 0xbfe6ff, 'glow', { x: face, y: wy, z: z + wz });
      }
    };
    switch (tier) {
      case 0: {
        // Queens Tower: pale-blue Art Deco with a slim spire.
        b.box(w, height, w, color, 'stud', { x, y: y0 + height / 2, z });
        windows(height);
        b.box(w * 0.6, 0.6, w * 0.6, 0xffffff, 'smooth', { x, y: y0 + height + 0.3, z });
        b.add(new CylinderGeometry(0.12, 0.3, 4, 6), 0xdfe6ee, 'smooth', { x, y: y0 + height + 2.6, z });
        break;
      }
      case 1: {
        // The Daily Bugle: orange brick, the red-lettered sign flush on its face.
        b.box(w, height, w, color, 'stud', { x, y: y0 + height / 2, z });
        windows(height - 2.4);
        break;
      }
      case 2: {
        // Midtown Spire: blue glass with a gold crown of arches and a needle.
        b.box(w, height, w, color, 'smooth', { x, y: y0 + height / 2, z });
        windows(height);
        for (let i = 0; i < 3; i += 1) b.add(new ConeGeometry(2.6 - i * 0.7, 1.4, 4), 0xffd23a, 'smooth', { x, y: y0 + height + 0.7 + i * 1.1, z, ry: Math.PI / 4 });
        b.add(new CylinderGeometry(0.08, 0.2, 3.5, 6), 0xffe8a0, 'smooth', { x, y: y0 + height + 5, z });
        break;
      }
      case 3: {
        // Oscorp Tower: dark glass wrapped in a glowing green hex lattice.
        b.box(w, height, w, color, 'smooth', { x, y: y0 + height / 2, z });
        for (let wy = y0 + 1.2; wy < y0 + height - 0.4; wy += 1.6) {
          for (let wz = -2.4; wz <= 2.4; wz += 1.2) b.add(new CylinderGeometry(0.45, 0.45, 0.05, 6), accent, 'glow', { x: face, y: wy + (Math.round(wz / 1.2) % 2 ? 0.8 : 0), z: z + wz, rz: Math.PI / 2 });
        }
        b.add(new CylinderGeometry(0.1, 0.1, 3, 6), 0x9aa4b4, 'smooth', { x, y: y0 + height + 1.5, z });
        b.add(new SphereGeometry(0.25, 8, 6), accent, 'glow', { x, y: y0 + height + 3.1, z });
        break;
      }
      case 4: {
        // Alchemax HQ: black and gold, its triangular emblem on the face.
        b.box(w, height, w, color, 'smooth', { x, y: y0 + height / 2, z });
        for (let wy = y0 + 1; wy < y0 + height - 0.5; wy += 2) b.box(0.05, 0.12, w - 0.4, accent, 'glow', { x: face, y: wy, z });
        b.add(new ConeGeometry(1.6, 2.6, 3), accent, 'glow', { x: face - 0.02, y: y0 + height - 2.4, z, rz: Math.PI / 2, sx: 0.05 });
        break;
      }
      default: {
        // Lady Liberty: a stone pedestal, the copper-green statue, the torch aloft.
        b.box(w, 5, w, 0xc8b89a, 'stud', { x, y: y0 + 2.5, z });
        b.box(w + 0.02, 0.4, w + 0.02, 0xa89878, 'smooth', { x, y: y0 + 4.8, z });
        b.add(new CylinderGeometry(1.2, 1.6, height - 5 - 2, 10), color, 'smooth', { x, y: y0 + 5 + (height - 7) / 2, z });
        b.add(new SphereGeometry(1.05, 12, 10), color, 'smooth', { x, y: y0 + height - 1.1, z });
        for (let i = 0; i < 7; i += 1) {
          const a = (i / 6) * Math.PI - Math.PI / 2;
          b.add(new ConeGeometry(0.16, 0.9, 4), color, 'smooth', { x: x - Math.cos(a) * 0.8, y: y0 + height - 0.2, z: z + Math.sin(a) * 0.9, rz: Math.cos(a) * 0.6 });
        }
        // The torch arm, inside its solid.
        b.box(0.7, 3.2, 0.7, color, 'smooth', { x, y: y0 + height + 1.6, z: z - 0.95 });
        b.add(new CylinderGeometry(0.45, 0.25, 0.6, 8), 0xd4af37, 'smooth', { x, y: y0 + height + 3.2, z: z - 0.95 });
        b.add(new ConeGeometry(0.35, 0.8, 8), 0xffc83a, 'glow', { x, y: y0 + height + 3.8, z: z - 0.95 });
        // The tablet held at her side.
        b.box(0.4, 1.6, 1.0, 0x7ac8aa, 'smooth', { x: x - 0.2, y: y0 + 9, z: z + 1.2 });
        break;
      }
    }
    if (tier === 1) {
      this.sign(6.6, 2, [{ text: 'DAILY BUGLE', size: 1, fill: '#ff3a3a', stroke: '#ffffff', strokeWidth: 0.1 }], face - 0.03, y0 + height - 1.2, z, -Math.PI / 2);
    } else if (tier === 3) {
      this.sign(1.8, 6, [{ text: 'O', size: 1, fill: '#3dff6e', stroke: '#0a2a14', strokeWidth: 0.1 }], face - 0.03, y0 + height - 3.5, z + 2.2, -Math.PI / 2);
    }
  }

  /** Lock or unlock each building's label and pad for the local player's rebirths. */
  setRebirths(rebirths: number): void {
    const signature = String(rebirths);
    if (signature === this.buildingSignature) return;
    this.buildingSignature = signature;
    for (const building of this.buildings) {
      const tier = TRAINING_TIERS[building.tier]!;
      const open = canTrainOn(tier.tier, rebirths);
      building.label.set([
        { text: `${tier.multiplier}x Power`, color: open ? '#ffb02a' : '#ff6a6a', size: 1.25 },
        { text: open ? tier.name : `${tier.rebirthsRequired} Rebirth${tier.rebirthsRequired === 1 ? '' : 's'}`, color: open ? '#ffffff' : '#ff9ad8', size: 0.9 },
      ]);
      (building.ring.material as MeshBasicMaterial).opacity = open ? 0.9 : 0.3;
      (building.web.material as MeshBasicMaterial).opacity = open ? 0.55 : 0.18;
    }
  }

  /** A building was webbed: its pad flashes. */
  strikeBuilding(tier: number): void {
    const building = this.buildings.find((entry) => entry.tier === tier);
    if (building) building.flash = 1;
  }

  // ----------------------------------------------------------- suit stage

  private buildSuitStage(): void {
    const b = new PartBuilder();
    const colors = [0xd8202c, 0x1f4fd6, 0x2a2a34];
    SUIT_STAGE.tiers.forEach((tier, index) => {
      const h = tier.top + 1;
      b.box(tier.maxX - tier.minX, h, SUIT_STAGE.maxZ - SUIT_STAGE.minZ, colors[index]!, 'stud', {
        x: (tier.minX + tier.maxX) / 2,
        y: tier.top - h / 2,
        z: (SUIT_STAGE.minZ + SUIT_STAGE.maxZ) / 2,
      });
      for (const [z0, z1] of [[SUIT_STAGE.maxZ, SUIT_STAGE.maxZ + 1], [SUIT_STAGE.minZ - 1, SUIT_STAGE.minZ]] as const) {
        b.box(tier.maxX - tier.minX, 1.4, z1 - z0, 0xf4f4f4, 'stud', { x: (tier.minX + tier.maxX) / 2, y: tier.top + 0.7, z: (z0 + z1) / 2 });
      }
    });
    for (const stair of SUIT_STAIRS) {
      for (const box of stairBoxes(stair)) {
        b.box(box.maxX - box.minX, box.maxY - box.minY, box.maxZ - box.minZ, 0xe8eef5, 'stud', {
          x: (box.minX + box.maxX) / 2,
          y: (box.minY + box.maxY) / 2,
          z: (box.minZ + box.maxZ) / 2,
        });
      }
    }
    // The back wall, and the billboard posts either side of the stage.
    b.box(3, 25, SUIT_STAGE.maxZ - SUIT_STAGE.minZ + 6, 0x1a2a5a, 'stud', { x: SUIT_STAGE.backX - 1.5, y: 11.5, z: 0 });
    for (const z of [35.5, -35.5]) b.box(2, 12, 2, 0x3a3a44, 'stud', { x: -47, y: 6, z });
    this.root.add(b.build('suit-stage'));
    this.sign(40, 8, [
      { text: 'SUIT UPGRADES', size: 1.2, fill: '#ff3a3a', stroke: '#ffffff', strokeWidth: 0.12 },
      { text: 'Step on a pad to buy a suit!', size: 0.7, fill: '#ffffff', stroke: '#1a1a3a', strokeWidth: 0.14 },
    ], SUIT_STAGE.backX + 0.1, 17, 0, Math.PI / 2);
    for (const z of [35.5, -35.5]) {
      this.sign(9, 5, [
        { text: 'SUITS', size: 1, fill: '#ffffff', stroke: '#8a0a14', strokeWidth: 0.14 },
        { text: '+ Power / Click', size: 0.6, fill: '#ffd23a', stroke: '#1a1a3a', strokeWidth: 0.14 },
      ], -45.9, 14.5, z, Math.PI / 2);
    }

    for (const pad of SUIT_PADS) {
      const material = this.mat(new MeshBasicMaterial({ color: PAD_COLORS.locked }));
      const disc = new Mesh(new CylinderGeometry(pad.half, pad.half, 0.14, 28), material);
      disc.position.set(pad.x + 1, pad.y + 0.08, pad.z);
      this.root.add(disc);
      const glow = new Mesh(
        new RingGeometry(pad.half * 0.7, pad.half * 0.95, 28),
        this.mat(new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: DoubleSide, blending: AdditiveBlending, depthWrite: false })),
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(pad.x + 1, pad.y + 0.17, pad.z);
      this.root.add(glow);

      const label = this.label(6, 3.1, pad.x - 3.2, pad.y + 5.1, pad.z);
      this.pads.push({ slot: pad.slot, material, label });
      this.addStatue(pad.slot, pad.x - 3.4, pad.y, pad.z);
    }
    this.setSuits(0, 1, 1);
  }

  /** A suit statue behind its pad, facing the spawn: standing ready, or perched in the crouch. */
  private addStatue(slot: number, x: number, y: number, z: number): void {
    const statue = new PlayerCharacter({ suit: slot, shooter: 1, gear: [] });
    statue.setPosition(x, y + 0.3, z);
    statue.setYaw(Math.PI / 2);
    this.root.add(statue.root);
    const pose = { grounded: true, horizontalSpeed: 0, verticalVelocity: 0, turn: 0, landed: false, swingTime: -1, swingVariant: 0, drawn: slot % 3 !== 0, style: 'web' as const, onWeb: false, webPitch: 0, webRoll: 0 };
    if (slot % 3 === 0) statue.crouchNow();
    for (let i = 0; i < 14; i += 1) statue.update(0.1, pose);
    this.statues.push(statue);
    const plinth = new Mesh(new CylinderGeometry(1.1, 1.3, 0.3, 16), this.mat(new MeshLambertMaterial({ color: 0x14151c })));
    plinth.position.set(x, y + 0.15, z);
    this.root.add(plinth);
  }

  /** Recolour the pads and relabel them for the local player's Trophies and suits. */
  setSuits(wins: number, owned: number, worn: number): void {
    const trophy = trophyIcon(() => {
      this.padSignature = '';
      this.setSuits(wins, owned, worn);
    });
    const signature = `${Math.floor(wins)}|${owned}|${worn}|${trophy ? 1 : 0}`;
    if (signature === this.padSignature) return;
    this.padSignature = signature;
    for (const pad of this.pads) {
      const tier = SUITS[pad.slot - 1]!;
      const has = ownsSuit(owned, pad.slot);
      const state = worn === pad.slot ? 'worn' : has ? 'owned' : wins >= tier.cost ? 'ready' : 'locked';
      pad.material.color.setHex(PAD_COLORS[state]);
      pad.label.set([
        { text: `+${formatAmount(tier.perClick)}/Click`, color: '#ffffff', size: 1.15 },
        { text: tier.name, color: tier.color, size: 0.85 },
        state === 'worn'
          ? { text: 'EQUIPPED', color: '#62e6ff', size: 0.9 }
          : state === 'owned'
            ? { text: 'OWNED - step on to wear', color: '#ffd23a', size: 0.75 }
            : { text: tier.cost === 0 ? 'FREE' : `${formatWins(tier.cost)} Trophies Needed`, color: state === 'ready' ? '#7dff6a' : '#ffd23a', size: 0.8, icon: trophy },
      ]);
    }
  }

  // ------------------------------------------------------------------ eggs

  private buildEggs(): void {
    const floor = this.mat(new MeshLambertMaterial({ map: worldTextures.stud('#e0a040') }));
    this.slab(PETS_SHOP.minX, PETS_SHOP.maxX, -1, PETS_SHOP.floorTop, PETS_SHOP.minZ, PETS_SHOP.maxZ, floor);
    const b = new PartBuilder();
    const trophy = trophyIcon(() => this.relabelEggs());
    EGG_PLACEMENTS.forEach((placement, index) => {
      const egg = EGGS[index]!;
      const h = PETS_SHOP.pedestalHalf;
      const base = PETS_SHOP.floorTop;
      const [shell, , glow] = egg.colors;
      // A stepped pedestal like the reference: blue plinth, a glowing top.
      b.box(h * 2, PETS_SHOP.pedestalTop - base, h * 2, 0x3a8ae8, 'stud', { x: placement.x, y: base + (PETS_SHOP.pedestalTop - base) / 2, z: PETS_SHOP.eggZ });
      b.add(new CylinderGeometry(h * 0.8, h * 0.85, 0.2, 24), glow, 'glow', { x: placement.x, y: PETS_SHOP.pedestalTop + 0.1, z: PETS_SHOP.eggZ });
      b.add(new CylinderGeometry(PETS_SHOP.padHalf, PETS_SHOP.padHalf, 0.08, 28), 0xffd23a, 'glow', { x: placement.x, y: base + 0.04, z: PETS_SHOP.padZ });

      const eggGroup = new Group();
      eggGroup.add(this.eggModel(egg, shell));
      eggGroup.position.set(placement.x, PETS_SHOP.pedestalTop + 2.3, PETS_SHOP.eggZ);
      this.root.add(eggGroup);
      this.eggs.push(eggGroup);

      const label = this.label(9, 3.2, placement.x, PETS_SHOP.pedestalTop + 6.2, PETS_SHOP.eggZ);
      label.set([
        { text: egg.name, color: '#ffffff', size: 1.05 },
        { text: `${formatWins(egg.cost)} Wins`, color: '#ffd23a', size: 1, icon: trophy },
      ]);
    });
    this.root.add(b.build('eggs'));
  }

  private relabelEggs(): void {
    const trophy = trophyIcon();
    const labels = this.labels.slice(-EGGS.length);
    EGGS.forEach((egg, index) => {
      labels[index]?.set([
        { text: egg.name, color: '#ffffff', size: 1.05 },
        { text: `${formatWins(egg.cost)} Wins`, color: '#ffd23a', size: 1, icon: trophy },
      ]);
    });
  }

  /** An egg: its patterned shell (canvas-painted), and the demonic egg's horns and wings. */
  private eggModel(egg: EggKind, shell: number): Group {
    const group = new Group();
    const material = this.mat(new MeshStandardMaterial({ map: eggTexture(egg), roughness: 0.4, metalness: 0.1, emissive: egg.colors[2], emissiveIntensity: 0.12 }));
    const mesh = new Mesh(new SphereGeometry(1.6, 24, 18), material);
    mesh.scale.set(1, 1.28, 1);
    mesh.castShadow = true;
    group.add(mesh);
    const b = new PartBuilder();
    if (egg.pattern === 'demon') {
      for (const side of [-1, 1]) {
        b.add(new ConeGeometry(0.28, 1.4, 6), 0x1a0a0a, 'smooth', { x: side * 0.8, y: 2.0, rz: side * -0.5 });
        b.add(new ConeGeometry(0.9, 2.2, 3), 0x7a0a12, 'smooth', { x: side * 2.0, y: 0.6, z: -0.3, rz: side * -1.2, sx: 0.2 });
      }
    } else if (egg.pattern === 'circuit') {
      b.add(new TorusGeometry(1.9, 0.06, 6, 32), egg.colors[2], 'glow', { rx: Math.PI / 2 });
    } else if (egg.pattern === 'stars') {
      for (let i = 0; i < 3; i += 1) b.add(new OctahedronGeometry(0.2, 0), 0xffd23a, 'glow', { x: Math.cos(i * 2.1) * 2.1, y: 0.4 * i - 0.4, z: Math.sin(i * 2.1) * 2.1 });
    }
    void shell;
    if (!b.isEmpty) group.add(b.build(`egg-${egg.id}-extras`, false));
    return group;
  }

  // ------------------------------------------------------- shooter stand

  private buildShooterStand(): void {
    const s = SHOOTER_SHOP;
    const b = new PartBuilder();
    const w = s.halfWidth * 2;
    // Counter, back wall, side posts, the striped awning and its front poles: exactly the solids.
    b.box(w, 2.2, 2, 0x8a5a3a, 'stud', { x: s.x, y: 1.1, z: s.z + 2 });
    b.box(w, 0.2, 2.2, 0xc8a070, 'smooth', { x: s.x, y: 2.3, z: s.z + 2 });
    b.box(w, 7.4, 1, 0x6a4a2a, 'stud', { x: s.x, y: 3.7, z: s.z - 2.5 });
    for (const side of [-1, 1]) b.box(0.6, 7.4, 3, 0x6a4a2a, 'stud', { x: s.x + side * (s.halfWidth - 0.3), y: 3.7, z: s.z - 0.5 });
    for (const side of [-1, 1]) b.box(0.5, 7.4, 0.5, 0xe8e8e8, 'smooth', { x: s.x + side * (s.halfWidth - 0.25), y: 3.7, z: s.z + 5.25 });
    const stripes = 8;
    const stripeW = (w + 0.8) / stripes;
    for (let i = 0; i < stripes; i += 1) {
      b.box(stripeW, 0.8, 9, i % 2 === 0 ? 0xe8202c : 0xf8f8f8, 'smooth', { x: s.x - (w + 0.8) / 2 + stripeW * (i + 0.5), y: 7.8, z: s.z + 1.5 });
    }
    // Shooter cartridges on display along the counter.
    ['#3f9dff', '#ff8a1c', '#e0202a'].forEach((color, i) => {
      b.add(new CylinderGeometry(0.35, 0.35, 0.7, 10), 0x2a2e38, 'smooth', { x: s.x - 3 + i * 3, y: 2.75, z: s.z + 2 });
      b.box(0.5, 0.4, 0.2, hex(color), 'glow', { x: s.x - 3 + i * 3, y: 2.8, z: s.z + 2.4 });
    });
    this.root.add(b.build('shooter-stand'));
    this.sign(13, 3, [{ text: 'Web Shooters', size: 1, fill: '#ff4a4a', stroke: '#ffffff', strokeWidth: 0.12 }], s.x, 9.7, s.z + 1, 0);

    // The vendor behind the counter: a Spider-Man in the Classic Suit.
    const vendor = new PlayerCharacter({ suit: 1, shooter: 3, gear: [] });
    vendor.setPosition(s.x, 0, s.z - 0.6);
    vendor.setYaw(0);
    const pose = { grounded: true, horizontalSpeed: 0, verticalVelocity: 0, turn: 0, landed: false, swingTime: -1, swingVariant: 0, drawn: true, style: 'web' as const, onWeb: false, webPitch: 0, webRoll: 0 };
    for (let i = 0; i < 14; i += 1) vendor.update(0.1, pose);
    this.root.add(vendor.root);
    this.statues.push(vendor);
  }

  // --------------------------------------------------------------- portal

  private buildPortal(): void {
    const b = new PartBuilder();
    const z = HUB.maxZ - 0.6;
    for (const side of [-1, 1]) b.box(2.4, ARENA.portalHeight + 2, 0.8, 0xd8202c, 'stud', { x: side * (HUB_GATE.maxX + 1.2), y: (ARENA.portalHeight + 2) / 2, z });
    b.box(HUB_GATE.maxX * 2 + 4.8, 2.4, 0.8, 0xd8202c, 'stud', { x: 0, y: ARENA.portalHeight + 1.2, z });
    this.root.add(b.build('hub-portal'));
    const first = STAGES[0]!;
    this.sign(16, 7, [
      { text: `Stage ${first.index}`, size: 1.2, fill: '#ffffff', stroke: '#101a3a', strokeWidth: 0.16 },
      { text: first.name, size: 0.7, fill: '#ffd23a', stroke: '#101a3a', strokeWidth: 0.16 },
      { text: `Web Power: ${formatAmount(first.recommendedPower)}`, size: 0.8, fill: '#bfe6ff', stroke: '#101a3a', strokeWidth: 0.16 },
    ], 0, 10, HUB.maxZ + 0.5, Math.PI);
    this.sign(34, 4, [{ text: 'STOP THE VILLAINS - EARN TROPHIES!', size: 1, fill: '#ffd23a', stroke: '#3a1a00', strokeWidth: 0.16 }], 0, ARENA.portalHeight + 4.7, z - 0.6, Math.PI);
  }

  /** Lamps, planter trees, parked taxis, the newsstand and the hot-dog cart: each on its solid. */
  private buildStreetProps(): void {
    const b = new PartBuilder();
    for (const [x, z] of HUB_LAMPS) lamp(b, x, z, 0x2a2e38, 0xfff1b0, 9);
    for (const [x, z, s] of HUB_TREES) {
      b.box(3, 0.8, 3, 0x8a8f9c, 'stud', { x, y: 0.4, z });
      tree(b, x, z, s, 0x4fc83a, 0x6a4a2a, 0.8);
    }
    // Two parked New York taxis, each filling its solid.
    for (const x of [-24, 24]) {
      b.box(4.2, 1.2, 4.8, 0xffc81a, 'smooth', { x, y: 0.9, z: 37.5 });
      b.box(3.8, 0.9, 2.6, 0xffd23a, 'smooth', { x, y: 1.95, z: 37.3 });
      b.box(3.9, 0.7, 2.4, 0x2a3a5a, 'smooth', { x, y: 1.95, z: 37.3 });
      b.box(1.2, 0.3, 0.5, 0xffffff, 'glow', { x, y: 2.55, z: 37.3 });
      b.box(4.3, 0.2, 0.3, 0x14151c, 'smooth', { x, y: 1.0, z: 37.5 });
      for (const [wx, wz] of [[-1.9, 36], [1.9, 36], [-1.9, 39], [1.9, 39]] as const) b.add(new CylinderGeometry(0.45, 0.45, 0.35, 10), 0x14151c, 'smooth', { x: x + wx, y: 0.45, z: wz, rz: Math.PI / 2 });
    }
    // The newsstand.
    b.box(4, 3, 4, 0x2a6a3a, 'stud', { x: -34, y: 1.5, z: -10 });
    b.box(4.4, 0.4, 4.4, 0x1a4a2a, 'smooth', { x: -34, y: 3.2, z: -10 });
    b.box(0.05, 1.2, 3, 0xf4f4f4, 'glow', { x: -31.97, y: 1.8, z: -10 });
    // The hot-dog cart, and its umbrella within the cart's solid.
    b.box(3, 1.6, 3, 0xd8d8e0, 'smooth', { x: 34.5, y: 1.0, z: 9.5 });
    b.add(new CylinderGeometry(0.06, 0.06, 1.0, 5), 0x3a3a44, 'smooth', { x: 34.5, y: 2.3, z: 9.5 });
    b.add(new ConeGeometry(1.5, 0.5, 8), 0xffd23a, 'smooth', { x: 34.5, y: 2.9, z: 9.5 });
    this.root.add(b.build('street-props'));
  }

  // --------------------------------------------------------------- frame

  update(delta: number): void {
    this.time += delta;
    for (const building of this.buildings) {
      if (building.flash <= 0) continue;
      building.flash = Math.max(0, building.flash - delta * 4);
      const material = building.ring.material as MeshBasicMaterial;
      material.opacity = 0.9 + building.flash * 0.1;
      building.ring.scale.setScalar(1 + building.flash * 0.08);
    }
    this.eggs.forEach((egg, index) => {
      egg.rotation.y += delta * 0.6;
      egg.position.y = PETS_SHOP.pedestalTop + 2.3 + Math.sin(this.time * 2 + index) * 0.25;
    });
  }

  dispose(): void {
    for (const statue of this.statues) statue.dispose();
    this.scoreboard.dispose();
    for (const sign of this.signs) sign.dispose();
    for (const label of this.labels) label.dispose();
    for (const material of this.materials) material.dispose();
    this.root.removeFromParent();
  }
}

/** An egg's shell, painted on a canvas: its pattern in its colours. */
const eggTexture = (egg: EggKind): CanvasTexture => {
  const w = 256;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const css = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;
  const [base, detail, glow] = egg.colors;
  ctx.fillStyle = css(base);
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = css(detail);
  ctx.fillStyle = css(detail);
  switch (egg.pattern) {
    case 'venom': {
      // A white spider on the black shell, front and back.
      for (const cx of [64, 192]) {
        ctx.beginPath();
        ctx.ellipse(cx, 52, 8, 10, 0, 0, Math.PI * 2);
        ctx.ellipse(cx, 72, 10, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 4;
        for (const side of [-1, 1]) {
          for (let i = 0; i < 4; i += 1) {
            ctx.beginPath();
            ctx.moveTo(cx, 60 + i * 5);
            ctx.lineTo(cx + side * 22, 44 + i * 10);
            ctx.lineTo(cx + side * 30, 30 + i * 22);
            ctx.stroke();
          }
        }
      }
      break;
    }
    case 'flame': {
      ctx.fillStyle = css(detail);
      for (let i = 0; i < 12; i += 1) {
        const x = i * 22;
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.quadraticCurveTo(x + 6, h * 0.4, x + 11, h * 0.15 + (i % 3) * 12);
        ctx.quadraticCurveTo(x + 16, h * 0.45, x + 22, h);
        ctx.fill();
      }
      break;
    }
    case 'swirl': {
      ctx.lineWidth = 5;
      for (let i = 0; i < 6; i += 1) {
        ctx.beginPath();
        for (let t = 0; t < 1; t += 0.02) {
          const a = t * Math.PI * 4;
          const x = i * 44 + 22 + Math.cos(a) * t * 18;
          const y = h / 2 + Math.sin(a) * t * 18 + (i % 2 ? -18 : 18);
          if (t === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    }
    case 'stars': {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, css(base));
      g.addColorStop(0.5, css(detail));
      g.addColorStop(1, css(base));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = css(glow);
      for (let i = 0; i < 40; i += 1) ctx.fillRect((i * 97) % w, (i * 53) % h, 3, 3);
      break;
    }
    case 'demon': {
      ctx.fillStyle = css(detail);
      for (let i = 0; i < 8; i += 1) {
        ctx.beginPath();
        ctx.moveTo(i * 32, 0);
        ctx.lineTo(i * 32 + 16, 40 + (i % 2) * 20);
        ctx.lineTo(i * 32 + 32, 0);
        ctx.fill();
      }
      ctx.fillStyle = css(glow);
      ctx.fillRect(0, h - 10, w, 4);
      break;
    }
    case 'circuit': {
      ctx.strokeStyle = css(glow);
      ctx.lineWidth = 3;
      for (let i = 0; i < 16; i += 1) {
        const x = (i * 37) % w;
        const y = (i * 23) % h;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 24, y);
        ctx.lineTo(x + 24, y + 18);
        ctx.stroke();
        ctx.fillStyle = css(glow);
        ctx.fillRect(x + 21, y + 16, 6, 6);
      }
      break;
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
};
