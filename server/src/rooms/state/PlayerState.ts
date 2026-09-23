import { ArraySchema, Schema, type } from '@colyseus/schema';
import { JUMP_VELOCITY, SPAWN, STAGE_COUNT, moveSpeedFor } from '@spider/shared';
import { AvatarState } from './AvatarState.js';
import { EnemyState, enemyStates } from './EnemyState.js';

/** One owned pet. */
export class PetState extends Schema {
  @type('uint32') uid = 0;
  @type('uint8') petId = 0;
  @type('boolean') equipped = false;
}

/** One owned piece of gear. */
export class GearState extends Schema {
  @type('uint32') uid = 0;
  @type('uint8') gearId = 0;
  /** 0 Common, 1 Rare, 2 Epic, 3 Legendary. */
  @type('uint8') rarity = 0;
  @type('boolean') equipped = false;
}

const zeros = (length: number): ArraySchema<number> => {
  const list = new ArraySchema<number>();
  for (let i = 0; i < length; i += 1) list.push(0);
  return list;
};

/**
 * Replicated per-player state.
 *
 * Every field is written by the SERVER: transform and motion (including the
 * web swing) by the authoritative simulation, progression and inventories by
 * their own service. Nothing is ever copied from a client message.
 */
export class PlayerState extends Schema {
  @type('string') sessionId = '';

  @type('float32') x: number = SPAWN.x;
  @type('float32') y: number = SPAWN.y;
  @type('float32') z: number = SPAWN.z;
  @type('float32') rotationY: number = SPAWN.yaw;

  @type('float32') speed = 0;
  @type('float32') verticalVelocity = 0;
  @type('boolean') grounded = true;

  /** Authoritative velocity, for client reconciliation. */
  @type('float32') velocityX = 0;
  @type('float32') velocityY = 0;
  @type('float32') velocityZ = 0;
  @type('uint32') lastInputSeq = 0;
  @type('boolean') jumpLatched = false;
  @type('uint32') jumpCount = 0;

  // ---- the web swing, every field of it, for reconciliation and remote webs
  @type('uint8') swingsLeft = 0;
  @type('boolean') swinging = false;
  @type('float32') anchorX = 0;
  @type('float32') anchorY = 0;
  @type('float32') anchorZ = 0;
  @type('float32') ropeLength = 0;
  @type('float32') swingTime = 0;
  @type('float32') swingDirX = 0;
  @type('float32') swingDirZ = 1;
  @type('uint32') swingCount = 0;

  /** Accepted web clicks, counted, so every client can draw each one. */
  @type('uint32') attackCount = 0;
  /** Where the last web went (its target point, or a point ahead for thin air). */
  @type('float32') attackX = 0;
  @type('float32') attackY = 0;
  @type('float32') attackZ = 0;

  @type(AvatarState) avatar = new AvatarState();
  @type('string') displayName = '';
  @type('string') avatarUrl = '';

  // ---- progression: every figure is the server's own
  /** Total XP this rebirth: the level is read off it. */
  @type('float64') xp = 0;
  @type('uint32') level = 1;
  /** Web Power: earned by web clicks only; the damage a web deals. */
  @type('float64') webPower = 0;
  /** Highest Web Power ever held (a rebirth resets `webPower`, never this). */
  @type('float64') bestWebPower = 0;
  @type('float64') rebirths = 0;
  /** Written through `Wallet` only. */
  @type('float64') wins = 0;
  @type('float64') lifetimeWins = 0;
  /** Web Power / XP one web pays right now, off a building. */
  @type('float64') gainPerClick = 1;
  /** Every factor but the suit's and the building's: the HUD's "Multiplier". */
  @type('float64') multiplier = 1;
  @type('float32') moveSpeed = moveSpeedFor(1);
  @type('float32') jumpVelocity = JUMP_VELOCITY;
  @type('uint8') maxSwings = 2;

  @type('float64') health = 100;
  @type('float64') maxHealth = 100;
  /** Percent of every enemy blow the equipped gear stops. */
  @type('float32') defense = 0;
  @type('uint32') kills = 0;
  /** Damage dealt to enemies, ever: the Highest Damage board. */
  @type('float64') totalDamage = 0;

  @type('uint8') suitSlot = 1;
  @type('uint32') ownedSuits = 1;
  @type('uint8') shooterId = 1;
  @type('uint8') ownedShooters = 1;

  @type([PetState]) pets = new ArraySchema<PetState>();
  @type('uint32') petsHatched = 0;
  @type('uint32') nextPetUid = 1;

  @type([GearState]) gear = new ArraySchema<GearState>();
  @type('uint32') nextGearUid = 1;

  /** Highest stage ever cleared, in any run: how far the Teleport menu reaches. */
  @type('uint8') bestStage = 0;

  // ---- the current RUN: from leaving the base until back at it
  /** Highest stage cleared in this run: every portal up to it is open. */
  @type('uint8') runStage = 0;
  /** Per stage, this run: the enemies this player has defeated. */
  @type(['uint32']) killMasks = zeros(STAGE_COUNT);
  /**
   * This run's enemies: the whole pool, indexed by id, reset in place by every
   * new run. Replicated like any other field (only changes travel); each client
   * draws its own player's pool alone. NOT a @view field: a StateView-filtered
   * array was seen to lose entries when two players joined together.
   */
  @type([EnemyState]) enemies = enemyStates();

  @type('float64') playSeconds = 0;

  /** True once the server has simulated at least one input for this player. */
  @type('boolean') ready = false;
}
