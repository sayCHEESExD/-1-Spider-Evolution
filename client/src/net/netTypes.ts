import type { AvatarAppearance, AvatarProportions } from '@spider/shared';
import type { MapSchema } from '@colyseus/schema';

/**
 * Client-side TYPE mirror of the server's Colyseus schema.
 *
 * Types only - colyseus.js builds the concrete schema instances at runtime
 * from the handshake reflection.
 */
export interface NetPet {
  uid: number;
  petId: number;
  equipped: boolean;
}

export interface NetGear {
  uid: number;
  gearId: number;
  rarity: number;
  equipped: boolean;
}

export interface NetPlayerState {
  sessionId: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  speed: number;
  verticalVelocity: number;
  grounded: boolean;
  velocityX: number;
  velocityY: number;
  velocityZ: number;
  lastInputSeq: number;
  jumpLatched: boolean;
  jumpCount: number;

  swingsLeft: number;
  swinging: boolean;
  anchorX: number;
  anchorY: number;
  anchorZ: number;
  ropeLength: number;
  swingTime: number;
  swingDirX: number;
  swingDirZ: number;
  swingCount: number;

  attackCount: number;
  attackX: number;
  attackY: number;
  attackZ: number;

  avatar: AvatarAppearance & AvatarProportions;
  displayName: string;
  avatarUrl: string;

  xp: number;
  level: number;
  webPower: number;
  bestWebPower: number;
  rebirths: number;
  wins: number;
  lifetimeWins: number;
  gainPerClick: number;
  multiplier: number;
  moveSpeed: number;
  jumpVelocity: number;
  maxSwings: number;
  health: number;
  maxHealth: number;
  defense: number;
  kills: number;
  totalDamage: number;
  suitSlot: number;
  ownedSuits: number;
  shooterId: number;
  ownedShooters: number;
  pets: ArrayLike<NetPet>;
  petsHatched: number;
  gear: ArrayLike<NetGear>;
  nextGearUid: number;
  bestStage: number;
  /** Highest stage cleared in this run: the open portals. */
  runStage: number;
  /** This player's own run enemies (replicated to them alone). */
  enemies: ArrayLike<NetEnemyState>;
  killMasks: ArrayLike<number>;
  playSeconds: number;
  ready: boolean;
}

export interface NetEnemyState {
  id: number;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  alive: boolean;
  moving: boolean;
  hits: number;
  swings: number;
}

export interface NetLeaderEntry {
  handle: string;
  name: string;
  avatarUrl: string;
  value: number;
}

export interface NetLeaderboardState {
  playtime: ArrayLike<NetLeaderEntry>;
  damage: ArrayLike<NetLeaderEntry>;
}

export interface NetGameState {
  players: MapSchema<NetPlayerState>;
  elapsed: number;
  leaderboard: NetLeaderboardState;
}

/** A leaderboard flattened into plain data, ready to draw. */
export interface LeaderboardSnapshot {
  playtime: readonly NetLeaderEntry[];
  damage: readonly NetLeaderEntry[];
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';
