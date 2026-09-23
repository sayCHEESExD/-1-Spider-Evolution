import {
  ARENA,
  BUILDINGS,
  BUILDING_HALF,
  BUILDING_TARGET_BASE,
  COMBAT,
  ENEMIES,
  ENEMY_AI,
  STAGE_COUNT,
  TRAINING,
  TRAINING_TIERS,
  arenaEndZ,
  arenaStartZ,
  stageAt,
  buildingAimPoint,
  canTrainOn,
  damageOfWebPower,
  isBuildingTarget,
  stageByIndex,
  trainingMultiplier,
  type EnemyDef,
} from '@spider/shared';
import type { EnemyState } from '../rooms/state/EnemyState.js';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import type { ProgressionService } from './ProgressionService.js';

interface ShotBucket {
  tokens: number;
  at: number;
}

export type AttackNote = 'sealed' | 'locked-building' | null;

export type AttackOutcome =
  | { readonly ok: false; readonly reason: 'rate' }
  | {
      readonly ok: true;
      /** Enemy id, building target, or -1 for a web into the air. */
      readonly target: number;
      readonly gain: number;
      readonly damage: number;
      readonly after: number;
      readonly killed: boolean;
      /** Why a named target was not hit, for a notice. */
      readonly note: AttackNote;
      readonly tier?: number;
    };

/** An accepted web. */
type Landed = Extract<AttackOutcome, { ok: true }>;

/** A player an enemy's blow defeated. */
export interface Defeat {
  readonly sessionId: string;
  readonly by: string;
}

/** A stage clear the room announces. */
export interface StageClear {
  readonly sessionId: string;
  readonly stage: number;
  /** True the first time this player has ever cleared it. */
  readonly firstClear: boolean;
}

/** An enemy a player defeated: the room rolls its gear drop. */
export interface Takedown {
  readonly sessionId: string;
  readonly stage: number;
  readonly boss: boolean;
  readonly x: number;
  readonly z: number;
}

/** Seconds until an enemy's next blow, per player, per enemy id. */
type SwingClock = Map<number, number>;

/**
 * THE ONE PLACE DAMAGE IS DEALT, and the enemies' brains.
 *
 * EVERY PLAYER FIGHTS THEIR OWN RUN. A run begins whenever a player is placed
 * at the base (join, death, claim, respawn, rebirth) - or at a stage by the
 * Teleport menu, which counts the stages before it as cleared - and holds:
 *
 *   - `runStage`: the highest stage cleared this run (it opens the portals);
 *   - `killMasks`: which enemies of each stage they have defeated this run;
 *   - `enemies`: their own copy of every villain (a fixed pool, indexed by id,
 *     reset in place by each new run).
 *
 * Enemies attack only their owner and only their owner can web them. A
 * defeated enemy stays down for the rest of the run.
 *
 * A WEB is validated here, in this order: the rate limit, a target that exists
 * and is alive in this player's run, that they may hit it (a boss is sealed
 * until the rest of its wave is down; a building needs its rebirths), and that
 * it is within web range of the position the SERVER simulated - further while
 * airborne, which is what lets a swinging player lock on from the air. The
 * damage is the player's own server-side Web Power. The client never supplies
 * a figure.
 */
export class CombatService {
  private readonly buckets = new Map<string, ShotBucket>();
  private readonly clocks = new Map<string, SwingClock>();
  private readonly clears: StageClear[] = [];
  private readonly defeats: Defeat[] = [];
  private readonly takedowns: Takedown[] = [];
  private progression: ProgressionService | null = null;

  /** The service enemy blows hurt players through. */
  bind(progression: ProgressionService): void {
    this.progression = progression;
  }

  forget(sessionId: string): void {
    this.buckets.delete(sessionId);
    this.clocks.delete(sessionId);
  }

  /** Players defeated since the last call. */
  drainDefeats(): Defeat[] {
    return drain(this.defeats);
  }

  /** Stage clears since the last call. */
  drainClears(): StageClear[] {
    return drain(this.clears);
  }

  /** Enemies defeated since the last call. */
  drainTakedowns(): Takedown[] {
    return drain(this.takedowns);
  }

  // ------------------------------------------------------------------ runs

  /**
   * START A NEW RUN at the base: every stage's progress wiped, the portals
   * closed again, and a fresh Stage 1 wave at its posts.
   */
  resetRun(player: PlayerState): void {
    this.startRunAt(player, 1);
  }

  /**
   * START A NEW RUN AT A STAGE (the Teleport menu): the stages before it count
   * as cleared for this run - their portals open, their arenas empty, nothing
   * to claim - and every villain from this stage on is back at its post at
   * full health.
   */
  startRunAt(player: PlayerState, stage: number): void {
    const first = Math.max(1, Math.min(STAGE_COUNT, Math.floor(stage)));
    player.runStage = first - 1;
    for (let i = 0; i < player.killMasks.length; i += 1) if (player.killMasks[i] !== 0) player.killMasks[i] = 0;
    const clock = this.clockOf(player.sessionId);
    clock.clear();
    for (const def of ENEMIES) {
      const enemy = player.enemies[def.id];
      if (!enemy) continue;
      enemy.x = def.x;
      enemy.z = def.z;
      enemy.yaw = Math.PI;
      enemy.hp = def.maxHp;
      enemy.moving = false;
      enemy.alive = def.stage >= first;
      clock.set(def.id, def.swingSeconds);
    }
  }

  private clockOf(sessionId: string): SwingClock {
    let clock = this.clocks.get(sessionId);
    if (!clock) {
      clock = new Map();
      this.clocks.set(sessionId, clock);
    }
    return clock;
  }

  private enemyOf(player: PlayerState, id: number): EnemyState | undefined {
    return player.enemies[id];
  }

  /** May this player hit this enemy at all? A boss waits for its wave. */
  canAttack(player: PlayerState, def: EnemyDef): boolean {
    if (!def.boss) return true;
    const stage = stageByIndex(def.stage);
    if (!stage) return false;
    const mask = player.killMasks[def.stage - 1] ?? 0;
    return (mask & stage.waveMask) === stage.waveMask;
  }

  // ------------------------------------------------------------------ webs

  /**
   * One web click. `hint` is what the client says it webbed; only a hint.
   * Every web that passes the rate limit PAYS: the building's multiplier on a
   * building the player has the rebirths for, the plain gain on anything
   * else - one of their own enemies, or thin air.
   */
  attack(sessionId: string, player: PlayerState, hint: number, progression: ProgressionService): AttackOutcome {
    if (!this.takeToken(sessionId)) return { ok: false, reason: 'rate' };

    const reach = (player.grounded ? COMBAT.reach : COMBAT.airReach) + COMBAT.reachSlack;
    // Why the NAMED target cannot be hit, whatever the web then hits instead: the player is told.
    let note: AttackNote = null;
    let tier: number | undefined;
    if (Number.isFinite(hint) && hint >= 0) {
      const id = Math.floor(hint);
      if (isBuildingTarget(id)) {
        tier = id - BUILDING_TARGET_BASE;
        if (TRAINING_TIERS[tier] && !canTrainOn(tier, player.rebirths)) note = 'locked-building';
      } else if (ENEMIES[id] && !this.canAttack(player, ENEMIES[id]!)) {
        note = 'sealed';
      }
    }
    let target = this.validTarget(player, hint, reach);
    if (target === null) target = this.nearestTarget(player, reach);
    player.attackCount += 1;

    if (target !== null && isBuildingTarget(target)) return { ...this.hitBuilding(player, target - BUILDING_TARGET_BASE, progression), note, tier };
    if (target !== null) return { ...this.hitEnemy(sessionId, player, target, progression), note, tier };

    // A web into the air: it flies ahead for everyone and pays the plain gain.
    player.attackX = player.x + Math.sin(player.rotationY) * 14;
    player.attackY = player.y + 6;
    player.attackZ = player.z + Math.cos(player.rotationY) * 14;
    const gain = progression.creditClick(player, 0);
    return { ok: true, target: -1, gain, damage: 0, after: 0, killed: false, note, tier };
  }

  private hitEnemy(sessionId: string, player: PlayerState, id: number, progression: ProgressionService): Landed {
    const def = ENEMIES[id]!;
    const enemy = this.enemyOf(player, id)!;
    player.attackX = enemy.x;
    player.attackY = 1.6 * def.scale;
    player.attackZ = enemy.z;
    // Web Power is how hard a web hits: the damage is what was held BEFORE this web pays.
    const before = enemy.hp;
    const damage = damageOfWebPower(player.webPower);
    enemy.hp = Math.max(0, before - damage);
    enemy.hits = (enemy.hits + 1) % 65536;
    // The board counts the health actually taken, never overkill.
    player.totalDamage += before - enemy.hp;
    const gain = progression.creditClick(player, 0);

    let killed = false;
    if (enemy.hp <= 0) {
      killed = true;
      this.kill(sessionId, player, def, enemy);
    }
    return { ok: true, target: id, gain, damage, after: enemy.hp, killed, note: null };
  }

  private hitBuilding(player: PlayerState, tier: number, progression: ProgressionService): Landed {
    const aim = buildingAimPoint(tier);
    player.attackX = aim.x;
    player.attackY = aim.y;
    player.attackZ = aim.z;
    // The requirement is re-checked here, against the server's own rebirth count.
    const multiplier = trainingMultiplier(tier, player.rebirths);
    const gain = progression.creditClick(player, multiplier);
    return { ok: true, target: BUILDING_TARGET_BASE + tier, gain, damage: 0, after: 0, killed: false, note: null };
  }

  /**
   * An enemy falls - for good, this run. When it completes its stage the
   * stage is CLEARED: the next portal opens (`runStage`), the Win pad arms,
   * and the next stage's wave takes its posts.
   */
  private kill(sessionId: string, player: PlayerState, def: EnemyDef, enemy: EnemyState): void {
    enemy.alive = false;
    enemy.moving = false;
    player.kills += 1;
    this.takedowns.push({ sessionId, stage: def.stage, boss: def.boss, x: enemy.x, z: enemy.z });
    const stage = stageByIndex(def.stage)!;
    const index = stage.index - 1;
    const after = ((player.killMasks[index] ?? 0) | (1 << def.bit)) >>> 0;
    player.killMasks[index] = after;
    if (after !== stage.fullMask) return;

    const firstClear = stage.index > player.bestStage;
    if (firstClear) player.bestStage = stage.index;
    if (stage.index > player.runStage) player.runStage = stage.index;
    this.clears.push({ sessionId, stage: stage.index, firstClear });
  }

  /** The hinted target, if it is a real one this player may hit from here. */
  private validTarget(player: PlayerState, hint: number, reach: number): number | null {
    if (!Number.isFinite(hint) || hint < 0) return null;
    const id = Math.floor(hint);
    if (isBuildingTarget(id)) {
      const tier = id - BUILDING_TARGET_BASE;
      const building = BUILDINGS[tier];
      if (!building || !canTrainOn(tier, player.rebirths)) return null;
      return this.withinReach(player, building.x, TRAINING.floorTop, building.z, BUILDING_HALF, reach) ? id : null;
    }
    const def = ENEMIES[id];
    const enemy = this.enemyOf(player, id);
    if (!def || !enemy || !enemy.alive || def.stage > player.runStage + 1 || !this.canAttack(player, def)) return null;
    return this.withinReach(player, enemy.x, 0, enemy.z, def.radius, reach) ? id : null;
  }

  /** The nearest thing this player may hit from where the server has them. */
  private nearestTarget(player: PlayerState, reach: number): number | null {
    let best: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    // Only the villains of stages this run has reached can be webbed.
    for (const enemy of player.enemies) {
      const def = ENEMIES[enemy.id];
      if (!def || !enemy.alive || def.stage > player.runStage + 1 || !this.canAttack(player, def)) continue;
      if (!this.withinReach(player, enemy.x, 0, enemy.z, def.radius, reach)) continue;
      const d = Math.hypot(enemy.x - player.x, enemy.z - player.z) - def.radius;
      if (d < bestDistance) {
        best = def.id;
        bestDistance = d;
      }
    }
    for (const building of BUILDINGS) {
      if (!canTrainOn(building.tier, player.rebirths)) continue;
      if (!this.withinReach(player, building.x, TRAINING.floorTop, building.z, BUILDING_HALF, reach)) continue;
      const d = Math.hypot(building.x - player.x, building.z - player.z) - BUILDING_HALF;
      if (d < bestDistance) {
        best = BUILDING_TARGET_BASE + building.tier;
        bestDistance = d;
      }
    }
    return best;
  }

  private withinReach(player: PlayerState, x: number, baseY: number, z: number, radius: number, reach: number): boolean {
    if (Math.abs(player.y - baseY) > COMBAT.verticalReach) return false;
    return Math.hypot(x - player.x, z - player.z) - radius <= reach;
  }

  private takeToken(sessionId: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(sessionId);
    if (!bucket) {
      bucket = { tokens: COMBAT.burst, at: now };
      this.buckets.set(sessionId, bucket);
    }
    bucket.tokens = Math.min(COMBAT.burst, bucket.tokens + (now - bucket.at) / 1000 / COMBAT.refillSeconds);
    bucket.at = now;
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }

  // ------------------------------------------------------------------ AI

  /**
   * Advance every player's own enemies. Only the villains of the arena the
   * player stands in think (and any still walking home); the rest of the pool
   * stands at its posts.
   */
  tick(delta: number, players: Iterable<PlayerState>): void {
    for (const player of players) {
      const clock = this.clockOf(player.sessionId);
      const here = stageAt(player.z, STAGE_COUNT);
      for (const enemy of player.enemies) {
        if (!enemy.alive) continue;
        const def = ENEMIES[enemy.id];
        if (!def || (def.stage !== here && !enemy.moving)) continue;
        this.think(player, def, enemy, clock, delta);
      }
      if (here > 0) this.separate(player, here);
    }
  }

  /** True while the player is in this stage's arena (at any height: a swinging player is still hunted). */
  private inArena(player: PlayerState, stage: number): boolean {
    return player.health > 0 && player.z >= arenaStartZ(stage) && player.z <= arenaEndZ(stage) && Math.abs(player.x) <= ARENA.halfWidth;
  }

  /**
   * THE BRAIN: while the owner is in the enemy's arena, it hunts them -
   * wherever they are in it - and strikes when in reach. Otherwise it walks
   * back to its post and waits.
   */
  private think(player: PlayerState, def: EnemyDef, enemy: EnemyState, clock: SwingClock, delta: number): void {
    const hunting = this.inArena(player, def.stage);
    const goalX = hunting ? player.x : def.x;
    const goalZ = hunting ? player.z : def.z;
    const stopAt = hunting ? ENEMY_AI.reach + def.radius * 0.5 : 0.4;
    const dx = goalX - enemy.x;
    const dz = goalZ - enemy.z;
    const distance = Math.hypot(dx, dz);

    if (distance > stopAt) {
      const step = Math.min(def.speed * delta, distance - stopAt);
      const limit = ARENA.halfWidth - 3;
      enemy.x = Math.max(-limit, Math.min(limit, enemy.x + (dx / distance) * step));
      enemy.z = Math.max(arenaStartZ(def.stage) + 3, Math.min(arenaEndZ(def.stage) - 3, enemy.z + (dz / distance) * step));
      enemy.yaw = Math.atan2(dx, dz);
      if (!enemy.moving) enemy.moving = true;
      // Arriving in reach, it strikes soon after: never a free first beat.
      clock.set(def.id, Math.min(clock.get(def.id) ?? def.swingSeconds, def.swingSeconds * 0.5));
      return;
    }
    if (enemy.moving) enemy.moving = false;
    if (!hunting) return;
    enemy.yaw = Math.atan2(dx, dz);
    const next = (clock.get(def.id) ?? def.swingSeconds) - delta;
    if (next > 0) {
      clock.set(def.id, next);
      return;
    }
    clock.set(def.id, def.swingSeconds);
    enemy.swings = (enemy.swings + 1) % 65536;
    this.strike(player, def, enemy);
  }

  /** A blow LANDS on the owner if they are still in reach and on (or near) the street. */
  private strike(player: PlayerState, def: EnemyDef, enemy: EnemyState): void {
    const progression = this.progression;
    if (!progression || player.health <= 0) return;
    if (player.y > ENEMY_AI.maxStrikeHeight + (def.boss ? def.scale : 0)) return;
    const reach = def.boss ? ENEMY_AI.bossSlamRadius * (def.scale / 2.5) + def.radius : ENEMY_AI.reach + def.radius + 1.2;
    if (Math.hypot(player.x - enemy.x, player.z - enemy.z) > reach) return;
    if (progression.hurt(player, def.damage)) this.defeats.push({ sessionId: player.sessionId, by: def.name });
  }

  /** Keep a stage's wave from stacking into one body: a gentle push apart. */
  private separate(player: PlayerState, stageIndex: number): void {
    const wave = stageByIndex(stageIndex)?.enemies ?? [];
    for (const defA of wave) {
      const a = player.enemies[defA.id];
      if (!a || !a.alive || !a.moving) continue;
      const da = defA;
      for (const defB of wave) {
        if (defB.id === defA.id) continue;
        const b = player.enemies[defB.id];
        if (!b || !b.alive) continue;
        const min = da.radius + ENEMIES[b.id]!.radius + 0.4;
        const dx = a.x - b.x;
        const dz = a.z - b.z;
        const d = Math.hypot(dx, dz);
        if (d > 1e-3 && d < min) {
          const push = (min - d) * 0.5;
          a.x += (dx / d) * push;
          a.z += (dz / d) * push;
        }
      }
    }
  }
}

const drain = <T>(list: T[]): T[] => {
  if (list.length === 0) return [];
  const out = list.slice();
  list.length = 0;
  return out;
};
