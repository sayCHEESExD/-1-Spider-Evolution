import type { AvatarAppearance, AvatarProportions } from './avatar.js';

/**
 * Client -> server input (MessageType.Move).
 *
 * INPUT ONLY. No position, velocity or target: the server simulates movement
 * (runs, jumps and web swings) from intent and owns the result.
 */
export interface MoveMessage {
  /** Monotonically increasing input sequence number. */
  seq: number;
  /** Seconds this input covers. Clamped and rate-limited server-side. */
  dt: number;
  /** -1..1, camera-relative. */
  moveX: number;
  /** -1..1, camera-relative. */
  moveZ: number;
  /** The jump control, held. Only a fresh press jumps (grounded) or swings (airborne). */
  jump: boolean;
  /** Yaw the camera faced: movement is camera-relative. */
  cameraYaw: number;
}

/** Client -> server: one web click. `target` is a HINT (enemy id, building target, or -1). */
export interface AttackMessage {
  target: number;
}

/** Server -> client: a web click was accepted. */
export interface HitMessage {
  /** What it landed on: an enemy id, a building target, or -1 for thin air. */
  target: number;
  /** Web Power (and XP) the web paid. */
  gain: number;
  /** Damage dealt to an enemy (0 for a building or the air). */
  damage: number;
  /** The enemy's health after the hit. */
  after: number;
  killed: boolean;
}

/** Why a player was placed. */
export type RespawnReason = 'manual' | 'join' | 'teleport' | 'rebirth' | 'defeated' | 'claimed';

/** Server -> client authoritative placement (MessageType.Respawn). */
export interface RespawnMessage {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  reason: RespawnReason;
}

export interface TeleportMessage {
  /** A `TeleportId`: spawn, suits, training, eggs, shooters, or stageN. */
  to: string;
}

/** Client -> server: "I am on this stage's Win pad." A request, never a grant. */
export interface ClaimStageMessage {
  stage: number;
}

/** Server -> client: a stage reward landed. Presentation only. */
export interface StageAwardedMessage {
  stage: number;
  wins: number;
  total: number;
}

/** Server -> client: this player just cleared a stage's wave. */
export interface StageClearedMessage {
  stage: number;
  /** True on the first clear this player has ever made of it. */
  firstClear: boolean;
}

/** Client -> server: "I am on this suit's pad" / "buy or wear this suit". */
export interface SuitMessage {
  slot: number;
}

/** Client -> server: buy (at the stand) or equip a web shooter. */
export interface ShooterMessage {
  id: number;
}

export interface HatchMessage {
  egg: number;
  count: number;
}

export interface HatchedMessage {
  egg: number;
  pets: { uid: number; petId: number }[];
}

export type InventoryActionKind = 'equip' | 'unequip' | 'delete' | 'equipBest' | 'unequipAll';
export type PetActionKind = InventoryActionKind;

export interface PetActionMessage {
  action: PetActionKind;
  /** The pet's uid; ignored by equipBest / unequipAll. */
  uid?: number;
}

export interface GearActionMessage {
  action: InventoryActionKind;
  /** The piece's uid; ignored by equipBest / unequipAll. */
  uid?: number;
}

/** Server -> client: a defeated enemy dropped gear. */
export interface GearDroppedMessage {
  gearId: number;
  rarity: number;
  /** The new piece's uid, or 0 when the bag was full and it was lost. */
  uid: number;
  /** Where the enemy fell, for the drop's sparkle. */
  x: number;
  z: number;
}

/** Server -> client: what happened to a request, so the UI can say so. */
export interface NoticeMessage {
  kind: 'bought' | 'equipped' | 'refused' | 'rebirth' | 'locked' | 'info';
  text: string;
}

export interface SetAvatarMessage {
  appearance: AvatarAppearance;
  proportions: AvatarProportions;
}

export interface SetIdentityMessage {
  displayName: string;
  avatarUrl: string;
}

/** Client -> server: the portal's game TOKEN, or null when signed out. */
export interface SetAuthMessage {
  token: string | null;
}

export type AuthStatus = 'account' | 'guest' | 'unavailable';

export interface AuthStateMessage {
  status: AuthStatus;
  note?: string;
}
