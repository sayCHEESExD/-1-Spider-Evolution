import { Color, DoubleSide, Group, Matrix4, Mesh, MeshStandardMaterial, Object3D, Vector3, type BufferGeometry } from 'three';
import { attachToMount } from '../animation/rig/BoneMounts.js';
import { PlayerRig } from '../animation/rig/PlayerRig.js';
import type { BoneName } from '../animation/rig/boneNames.js';
import { playerModelLoader } from '../player/PlayerModelLoader.js';
import { PartBuilder, meshesFor, type PartKind } from '../render/PartBuilder.js';
import { gearParts, shooterParts, type GearMountPoint, type GearPart } from './GearModels.js';
import { suitFor, type AccessoryContext, type AccessoryMaker } from './SpiderSuits.js';
import { paintSuit, partBox, type BodyPart } from './SuitPainter.js';

/** What a body wears: the suit, the web shooter, and the equipped gear. */
export interface BodyLook {
  readonly suit: number;
  readonly shooter: number;
  readonly gear: readonly { readonly gearId: number; readonly rarity: number }[];
}

export const lookKey = (look: BodyLook): string =>
  `${look.suit}|${look.shooter}|${look.gear.map((piece) => `${piece.gearId}.${piece.rarity}`).join(',')}`;

const materials = new Map<number, MeshStandardMaterial>();
const geometryCache = new Map<string, Partial<Record<PartKind, BufferGeometry>>>();
let glass: MeshStandardMaterial | null = null;

const MOUNT_BONE: Readonly<Record<GearMountPoint, BoneName>> = {
  head: 'Neck1',
  back: 'Spine1',
  backLow: 'Spine1',
  chest: 'Spine1',
  belt: 'Spine1',
  handR: 'ArmR2',
  handL: 'ArmL2',
};

const centre = (part: BodyPart): Vector3 => {
  const box = partBox(part);
  return box ? box.min.clone().add(box.max).multiplyScalar(0.5) : new Vector3();
};

/** Where each mount sits on the measured body, in model space at the origin. */
const mountPoint = (mount: GearMountPoint): Vector3 => {
  const torso = partBox('torso');
  const midX = torso ? (torso.min.x + torso.max.x) / 2 : 0;
  switch (mount) {
    case 'head':
      return centre('head');
    case 'back':
      return torso ? new Vector3(midX, torso.max.y - 0.12, torso.min.z - 0.02) : new Vector3();
    case 'backLow':
      return torso ? new Vector3(midX, torso.min.y + 0.3, torso.min.z - 0.02) : new Vector3();
    case 'chest':
      return torso ? new Vector3(midX, torso.min.y + (torso.max.y - torso.min.y) * 0.66, torso.max.z + 0.01) : new Vector3();
    case 'belt':
      return torso ? new Vector3(midX, torso.min.y + 0.14, torso.max.z + 0.01) : new Vector3();
    case 'handR':
    case 'handL': {
      const arm = partBox(mount === 'handR' ? 'armR' : 'armL');
      return arm ? new Vector3((arm.min.x + arm.max.x) / 2, arm.min.y + 0.14, (arm.min.z + arm.max.z) / 2) : new Vector3();
    }
  }
};

const contextOf = (): AccessoryContext => {
  const head = partBox('head');
  const torso = partBox('torso');
  const arm = partBox('armR');
  return {
    head: head ? head.max.y - head.min.y : 0.9,
    torsoW: torso ? torso.max.x - torso.min.x : 1.1,
    torsoD: torso ? torso.max.z - torso.min.z : 0.55,
    torsoH: torso ? torso.max.y - torso.min.y : 1.1,
    limb: arm ? arm.max.x - arm.min.x : 0.55,
  };
};

const materialFor = (slot: number, model: Object3D): MeshStandardMaterial => {
  let material = materials.get(slot);
  if (!material) {
    const suit = suitFor(slot);
    material = new MeshStandardMaterial({
      map: paintSuit(`suit-${slot}`, model, suit.paint),
      roughness: suit.roughness ?? 0.6,
      metalness: suit.metalness ?? 0.05,
    });
    if (suit.glow) {
      material.emissiveMap = paintSuit(`suit-${slot}-glow`, model, suit.glow);
      material.emissive = new Color(0xffffff);
      material.emissiveIntensity = 1.4;
    }
    materials.set(slot, material);
  }
  return material;
};

const glassMaterial = (): MeshStandardMaterial => {
  glass ??= new MeshStandardMaterial({
    color: 0xbff0ff,
    transparent: true,
    opacity: 0.28,
    roughness: 0.05,
    metalness: 0.1,
    depthWrite: false,
    side: DoubleSide,
  });
  return glass;
};

/** Geometry for one maker, built once and shared by every body that wears it. */
const geometryFor = (key: string, make: AccessoryMaker): Partial<Record<PartKind, BufferGeometry>> => {
  let geometries = geometryCache.get(key);
  if (!geometries) {
    const builder = new PartBuilder();
    make(builder, contextOf());
    geometries = builder.geometries();
    geometryCache.set(key, geometries);
  }
  return geometries;
};

interface Attachment {
  readonly key: string;
  readonly mount: GearMountPoint;
  readonly make: AccessoryMaker;
  readonly glass?: boolean;
}

/** Everything bolted onto a body for a look: suit accessories, shooters, gear. */
const attachmentsFor = (look: BodyLook): Attachment[] => {
  const suit = suitFor(look.suit);
  const list: Attachment[] = [];
  // Worn gear REPLACES the suit's own piece on the same spot (a Glider hides Iron
  // Spider's legs, a Goblin Mask hides a hood), so two never occupy one place.
  const taken = new Set<string>();
  for (const piece of look.gear) {
    for (const part of gearParts(piece.gearId, piece.rarity, 0)) taken.add(part.mount === 'backLow' ? 'back' : part.mount);
  }
  for (const mount of ['head', 'back', 'chest', 'handR', 'handL'] as const) {
    const make = suit[mount];
    if (make && !taken.has(mount)) list.push({ key: `suit-${look.suit}-${mount}`, mount, make });
  }
  const addParts = (prefix: string, parts: readonly GearPart[]): void => {
    parts.forEach((part, index) => list.push({ key: `${prefix}-${index}`, mount: part.mount, make: part.build, glass: part.glass }));
  };
  addParts(`shooter-${look.shooter}`, shooterParts(look.shooter));
  let rune = 0;
  for (const piece of look.gear) {
    const parts = gearParts(piece.gearId, piece.rarity, rune);
    if (parts.some((part) => part.mount === 'belt')) rune += 1;
    addParts(`gear-${piece.gearId}-${piece.rarity}-${rune}`, parts);
  }
  return list;
};

/**
 * A playable body for a look: the supplied player model, its atlas painted
 * with the suit, and the suit's accessories, the web shooters and every
 * equipped gear piece bolted to its bones.
 */
export const createSuitBody = (look: BodyLook): Object3D => {
  const model = playerModelLoader.createInstance();
  const material = materialFor(look.suit, model);
  model.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.material = material;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
  });

  // Attachments go on in the bind pose with the body at the origin.
  const root = new Group();
  model.rotation.set(0, 0, 0);
  root.add(model);
  const rig = new PlayerRig(model, model);
  rig.resetToBindPose();
  root.updateMatrixWorld(true);
  for (const attachment of attachmentsFor(look)) {
    const bone = rig.getBone(MOUNT_BONE[attachment.mount]);
    if (!bone) continue;
    const geometries = geometryFor(attachment.key, attachment.make);
    const group = meshesFor(geometries, attachment.key, !attachment.glass);
    if (attachment.glass) {
      group.traverse((child) => {
        const mesh = child as Mesh;
        if (mesh.isMesh) {
          mesh.material = glassMaterial();
          mesh.renderOrder = 2;
          mesh.castShadow = false;
        }
      });
    }
    group.userData['suitGear'] = true;
    const at = mountPoint(attachment.mount);
    attachToMount(group, { bone, frame: new Matrix4().makeTranslation(at.x, at.y, at.z) }, root);
  }
  // Two empty markers at the wrists, where webs leave the shooters.
  const hands: Object3D[] = [];
  for (const mount of ['handR', 'handL'] as const) {
    const bone = rig.getBone(MOUNT_BONE[mount]);
    const marker = new Object3D();
    marker.name = mount === 'handR' ? 'webHandR' : 'webHandL';
    if (bone) {
      const at = mountPoint(mount);
      attachToMount(marker, { bone, frame: new Matrix4().makeTranslation(at.x, at.y - 0.05, at.z + 0.1) }, root);
    }
    hands.push(marker);
  }
  model.removeFromParent();
  model.userData['suitLook'] = lookKey(look);
  model.userData['webHands'] = hands;
  return model;
};

/** The wrist markers of a suit body: [right, left]. */
export const webHandsOf = (model: Object3D): readonly Object3D[] => (model.userData['webHands'] as Object3D[] | undefined) ?? [];
