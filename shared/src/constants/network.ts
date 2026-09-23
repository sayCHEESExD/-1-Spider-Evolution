/**
 * Network-level constants. Must stay identical on client and server.
 */

/** Colyseus room registered by the server and joined by the client. */
export const ROOM_NAME = 'spiderevolution';

/**
 * Default server port. Override with the PORT env var on the server.
 *
 * Deliberately NOT 2567: the earlier games in this series occupy 2567-2588 on
 * the same machine, and sharing a port means whichever server starts first
 * silently serves both clients.
 */
export const DEFAULT_SERVER_PORT = 2589;

/**
 * Most players in ONE room.
 *
 * The matchmaker locks a room at this figure and opens another, so a
 * sixteenth player gets a new room rather than a refusal.
 */
export const MAX_PLAYERS_PER_ROOM = 15;

/**
 * How many OTHER players are drawn at once. A RENDERING limit only: every
 * player in the room is tracked and synchronised on every patch.
 */
export const VISIBLE_REMOTE_PLAYERS = 10;

/** Server simulation / state broadcast rate, in Hz. */
export const SERVER_TICK_RATE = 20;

/** Milliseconds between server ticks. */
export const SERVER_TICK_MS = 1000 / SERVER_TICK_RATE;

/**
 * Client->server and server->client message identifiers.
 *
 * A const object rather than an enum so it survives `verbatimModuleSyntax`.
 */
export const MessageType = {
  /** Client -> server: one frame of INPUT. Never a transform. */
  Move: 'move',
  /** Client -> server: one web click, with an optional target HINT. Never a figure. */
  Attack: 'attack',
  /** Server -> client: a web was accepted: what it paid and any damage it dealt. */
  Hit: 'hit',
  /** Server -> client: authoritative placement. */
  Respawn: 'respawn',
  /** Client -> server: "put me back at the spawn". */
  RequestRespawn: 'requestRespawn',
  /** Client -> server: teleport to a named, UNLOCKED place. */
  Teleport: 'teleport',
  /** Client -> server: "I am on this stage's Win pad." A request, never a grant. */
  ClaimStage: 'claimStage',
  /** Server -> client: a stage reward was granted. */
  StageAwarded: 'stageAwarded',
  /** Server -> client: a stage's wave was cleared by this player. */
  StageCleared: 'stageCleared',
  /** Client -> server: "I am standing on this suit's pad: buy it, or wear it if owned." */
  SuitPad: 'suitPad',
  /** Client -> server: buy or wear a suit from the Backpack. */
  SuitSelect: 'suitSelect',
  /** Client -> server: buy (at the stand) or equip a web shooter. */
  ShooterSelect: 'shooterSelect',
  /** Client -> server: hatch an egg (count 1 or 3). */
  Hatch: 'hatch',
  /** Server -> client: what hatched. */
  Hatched: 'hatched',
  /** Client -> server: equip / unequip / delete a pet, or equip the best three. */
  PetAction: 'petAction',
  /** Client -> server: equip / unequip / delete a gear piece, or equip the best three. */
  GearAction: 'gearAction',
  /** Server -> client: a defeated enemy dropped gear (or it was lost to a full bag). */
  GearDropped: 'gearDropped',
  /** Client -> server: "rebirth me". Carries nothing. */
  Rebirth: 'rebirth',
  /** Server -> client: the outcome of a purchase or an equip, for feedback. */
  Notice: 'notice',
  /** Client -> server: "this is what my Bloxity avatar looks like". */
  SetAvatar: 'setAvatar',
  /** Client -> server: the player's Bloxity DISPLAY NAME and portrait. */
  SetIdentity: 'setIdentity',
  /**
   * Client -> server: the portal's game TOKEN, or null when signed out. Never
   * an account id: the server asks Bloxity who the token belongs to.
   */
  SetAuth: 'setAuth',
  /** Server -> client: whose progress this session is now playing on. */
  AuthState: 'authState',
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];
