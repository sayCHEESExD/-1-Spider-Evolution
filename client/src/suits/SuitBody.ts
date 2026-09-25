import { AVATAR_SLOT, type AvatarAppearance, type AvatarProportions } from '@spider/shared';
import { Color, DoubleSide, Group, Matrix4, Mesh, MeshStandardMaterial, Object3D, Vector3, type BufferGeometry } from 'three';
import { attachToMount } from '../animation/rig/BoneMounts.js';
import { PlayerRig } from '../animation/rig/PlayerRig.js';
import type { BoneName } from '../animation/rig/boneNames.js';
import { playerModelLoader } from '../player/PlayerModelLoader.js';
import { PartBuilder, meshesFor, type PartKind } from '../render/PartBuilder.js';
import { gearParts, shooterParts, type GearMountPoint, type GearPart } from './GearModels.js';
import { suitFor, type AccessoryContext, type AccessoryMaker } from './SpiderSuits.js';
import { measureBody, paintSuit, partBox, type BodyPart } from './SuitPainter.js';

/** A player's Bloxity avatar: the equipped ids and the body proportions, as replicated. */
export interface AvatarLook {
  readonly appearance: AvatarAppearance;
  readonly proportions: AvatarProportions;
}

/**
 * What a body wears: the suit (0 = no suit, the player's own Bloxity avatar),
 * the web shooter, the equipped gear, and - for the avatar - its look.
 */
export interface BodyLook {
  readonly suit: number;
  readonly shooter: number;
  readonly gear: readonly { readonly gearId: number; readonly rarity: number }[];
  readonly avatar?: AvatarLook;
}

/** What makes two avatars draw the same: every equipped id and every proportion. */
export const avatarKey = (avatar: AvatarLook | undefined): string => {
  if (!avatar) return '-';
  const a = avatar.appearance;
  const p = avatar.proportions;
  return [
    a.hatId, a.backId, a.skinId, a.headId, a.torsoId, a.armLId, a.armRId, a.legLId, a.legRId,
    ...[p.height, p.shoulderWidth, p.armLength, p.legOffsetX, p.torsoScaleX, p.neckHeight, p.headScale].map((n) => n.toFixed(3)),
  ].join('|');
};

export const lookKey = (look: BodyLook): string =>
  `${look.suit}|${look.shooter}|${look.gear.map((piece) => `${piece.gearId}.${piece.rarity}`).join(',')}` +
  (look.suit === AVATAR_SLOT ? `|${avatarKey(look.avatar)}` : '');

/** A body's measured part boxes, in model space with the body at the origin in its bind pose. */
export type PartBoxes = (part: BodyPart) => { min: Vector3; max: Vector3 } | null;

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

const centreOf = (boxes: PartBoxes, part: BodyPart): Vector3 => {
  const box = boxes(part);
  return box ? box.min.clone().add(box.max).multiplyScalar(0.5) : new Vector3();
};

/** Where each mount sits on the measured body, in model space at the origin. */
const mountPoint = (boxes: PartBoxes, mount: GearMountPoint): Vector3 => {
  const torso = boxes('torso');
  const midX = torso ? (torso.min.x + torso.max.x) / 2 : 0;
  switch (mount) {
    case 'head':
      return centreOf(boxes, 'head');
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
      const arm = boxes(mount === 'handR' ? 'armR' : 'armL');
      return arm ? new Vector3((arm.min.x + arm.max.x) / 2, arm.min.y + 0.14, (arm.min.z + arm.max.z) / 2) : new Vector3();
    }
  }
};

/** The body's proportions, for sizing what the makers build. */
const contextOf = (boxes: PartBoxes): AccessoryContext => {
  const head = boxes('head');
  const torso = boxes('torso');
  const arm = boxes('armR');
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

/**
 * Geometry for one maker on one kind of body, built once and shared by every
 * body of that kind that wears it. Keyed by body kind too: a maker sizes its
 * parts to the body it is measured against.
 */
const geometryFor = (key: string, make: AccessoryMaker, context: AccessoryContext): Partial<Record<PartKind, BufferGeometry>> => {
  let geometries = geometryCache.get(key);
  if (!geometries) {
    const builder = new PartBuilder();
    make(builder, context);
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

/** Everything bolted onto a body for a look: suit accessories (a suit only), shooters, gear. */
const attachmentsFor = (look: BodyLook): Attachment[] => {
  const list: Attachment[] = [];
  // Worn gear REPLACES the suit's own piece on the same spot (a Glider hides Iron
  // Spider's legs, a Goblin Mask hides a hood), so two never occupy one place.
  const taken = new Set<string>();
  for (const piece of look.gear) {
    for (const part of gearParts(piece.gearId, piece.rarity, 0)) taken.add(part.mount === 'backLow' ? 'back' : part.mount);
  }
  if (look.suit !== AVATAR_SLOT) {
    const suit = suitFor(look.suit);
    for (const mount of ['head', 'back', 'chest', 'handR', 'handL'] as const) {
      const make = suit[mount];
      if (make && !taken.has(mount)) list.push({ key: `suit-${look.suit}-${mount}`, mount, make });
    }
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
 * Bolt a look's web shooters, gear (and, on a suit, the suit's accessories) to
 * a body's bones, and mark the wrists where webs leave. The same code dresses
 * every kind of body - a painted suit, the bundled body the avatar falls back
 * to, and a Bloxity avatar body - which is what keeps shooters and gear on the
 * character whatever it is wearing. `kind` keys the geometry cache.
 */
export const boltOn = (model: Object3D, look: BodyLook, boxes: PartBoxes, kind: string): Object3D => {
  // Attachments go on in the bind pose with the body at the origin.
  const root = new Group();
  const wasParent = model.parent;
  model.rotation.set(0, 0, 0);
  root.add(model);
  const rig = new PlayerRig(model, model);
  rig.resetToBindPose();
  root.updateMatrixWorld(true);
  const context = contextOf(boxes);
  for (const attachment of attachmentsFor(look)) {
    const bone = rig.getBone(MOUNT_BONE[attachment.mount]);
    if (!bone) continue;
    const key = `${kind}:${attachment.key}`;
    const geometries = geometryFor(key, attachment.make, context);
    const group = meshesFor(geometries, key, !attachment.glass);
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
    const at = mountPoint(boxes, attachment.mount);
    attachToMount(group, { bone, frame: new Matrix4().makeTranslation(at.x, at.y, at.z) }, root);
  }
  // Two empty markers at the wrists, where webs leave the shooters.
  const hands: Object3D[] = [];
  for (const mount of ['handR', 'handL'] as const) {
    const bone = rig.getBone(MOUNT_BONE[mount]);
    const marker = new Object3D();
    marker.name = mount === 'handR' ? 'webHandR' : 'webHandL';
    if (bone) {
      const at = mountPoint(boxes, mount);
      attachToMount(marker, { bone, frame: new Matrix4().makeTranslation(at.x, at.y - 0.05, at.z + 0.1) }, root);
    }
    hands.push(marker);
  }
  model.removeFromParent();
  if (wasParent) wasParent.add(model);
  model.userData['suitLook'] = lookKey(look);
  model.userData['webHands'] = hands;
  return model;
};

/**
 * A playable body for a look, built at once.
 *
 * A SUIT is the supplied player model with its atlas painted in the suit, plus
 * the suit's accessories. NO SUIT (the player's own avatar) is the same model
 * in its own supplied texture - the body shown until the player's Bloxity
 * avatar has loaded, and for good if it cannot be (see `AvatarBody`). Either
 * way the web shooters and gear go on (`boltOn`).
 */
export const createSuitBody = (look: BodyLook): Object3D => {
  const model = playerModelLoader.createInstance();
  const suited = look.suit !== AVATAR_SLOT;
  if (suited) {
    const material = materialFor(look.suit, model);
    model.traverse((child) => {
      const mesh = child as Mesh;
      if (mesh.isMesh) mesh.material = material;
    });
  } else {
    measureBody(model);
  }
  model.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
  });
  return boltOn(model, look, partBox, 'fbx');
};

/** The wrist markers of a body: [right, left]. */
export const webHandsOf = (model: Object3D): readonly Object3D[] => (model.userData['webHands'] as Object3D[] | undefined) ?? [];
