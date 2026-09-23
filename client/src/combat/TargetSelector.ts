import {
  BUILDINGS,
  BUILDING_HALF,
  BUILDING_TARGET_BASE,
  COMBAT,
  ENEMIES,
  NO_TARGET,
  TRAINING,
  TRAINING_TIERS,
  buildingTarget,
  canTrainOn,
  isBuildingTarget,
  stageAt,
  stageByIndex,
  STAGE_COUNT,
} from '@spider/shared';
import type { NetEnemyState, NetPlayerState } from '../net/netTypes.js';

/** What the top-centre HUD shows about the thing being fought. */
export interface FocusTarget {
  readonly kind: 'enemy' | 'building';
  readonly target: number;
  readonly name: string;
  /** Enemies: current and maximum health. */
  readonly value: number;
  readonly max: number;
  readonly boss: boolean;
  /** A boss the player cannot fight yet, or a building they lack the rebirths for. */
  readonly locked: boolean;
  readonly lockText: string;
  readonly x: number;
  readonly z: number;
}

/** How long a target stays in focus after the last hit on it. */
const FOCUS_HOLD = 5;
/** Enemies this close come into focus even before they are hit. */
const FOCUS_RADIUS = 16;

/**
 * Chooses what a web is aimed at, and what the HUD shows.
 *
 * The AIM is only a hint to the server - the nearest thing in web range,
 * weighted toward what the player is facing. LOCK-ON (auto-click while
 * swinging) drops the facing weight: the nearest target in the longer
 * mid-air range, wherever the camera points. The FOCUS is presentation: the
 * thing last hit, or the nearest enemy in the arena.
 */
export class TargetSelector {
  private focusId = NO_TARGET;
  private focusFor = 0;

  /** Remember what was just hit, so it stays in focus. */
  noteHit(target: number): void {
    this.focusId = target;
    this.focusFor = FOCUS_HOLD;
  }

  /** Forget the last target (a new run). */
  clear(): void {
    this.focusId = NO_TARGET;
    this.focusFor = 0;
  }

  tick(delta: number): void {
    this.focusFor = Math.max(0, this.focusFor - delta);
  }

  /** The best thing to web from here, or NO_TARGET. */
  aim(
    x: number,
    y: number,
    z: number,
    yaw: number,
    grounded: boolean,
    enemies: ArrayLike<NetEnemyState> | null,
    me: NetPlayerState | null,
    lockOn = false,
  ): number {
    const reach = (grounded ? COMBAT.reach : COMBAT.airReach) + 0.5;
    let best = NO_TARGET;
    let bestScore = Number.POSITIVE_INFINITY;
    const consider = (id: number, tx: number, ty: number, tz: number, radius: number): void => {
      if (Math.abs(y - ty) > COMBAT.verticalReach - 0.5) return;
      const dx = tx - x;
      const dz = tz - z;
      const distance = Math.hypot(dx, dz) - radius;
      if (distance > reach) return;
      let off = Math.atan2(dx, dz) - yaw;
      off -= Math.round(off / (Math.PI * 2)) * Math.PI * 2;
      const score = distance + (lockOn ? 0 : Math.abs(off) * 2.2);
      if (score < bestScore) {
        bestScore = score;
        best = id;
      }
    };
    if (enemies) {
      for (const def of ENEMIES) {
        const enemy = enemies[def.id];
        if (!enemy || !enemy.alive || !this.canAttack(def.id, me)) continue;
        consider(def.id, enemy.x, 0, enemy.z, def.radius);
      }
    }
    // Locked buildings are aimed at too (but never locked onto), so the server can say why a web paid only the plain gain.
    for (const building of BUILDINGS) {
      if (lockOn && me && !canTrainOn(building.tier, me.rebirths)) continue;
      consider(buildingTarget(building.tier), building.x, TRAINING.floorTop, building.z, BUILDING_HALF);
    }
    return best;
  }

  /**
   * AUTO CLICK's target: a live, hittable villain of the arena the player
   * stands in (a sealed boss is not hittable), within web reach - or
   * NO_TARGET, and then Auto Click does not fire. Never a building, never thin
   * air. Mid-air it locks on to the nearest (the swing lock-on); on the
   * ground it prefers what the player faces, as a manual web does.
   */
  autoTarget(
    x: number,
    y: number,
    z: number,
    yaw: number,
    grounded: boolean,
    enemies: ArrayLike<NetEnemyState> | null,
    me: NetPlayerState | null,
  ): number {
    const stage = stageAt(z, STAGE_COUNT);
    if (stage === 0 || !enemies || !me || me.runStage + 1 < stage) return NO_TARGET;
    const lockOn = !grounded;
    const reach = (grounded ? COMBAT.reach : COMBAT.airReach) + 0.5;
    let best = NO_TARGET;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const def of stageByIndex(stage)?.enemies ?? []) {
      const enemy = enemies[def.id];
      if (!enemy || !enemy.alive || !this.canAttack(def.id, me)) continue;
      if (Math.abs(y) > COMBAT.verticalReach - 0.5) continue;
      const dx = enemy.x - x;
      const dz = enemy.z - z;
      const distance = Math.hypot(dx, dz) - def.radius;
      if (distance > reach) continue;
      let off = Math.atan2(dx, dz) - yaw;
      off -= Math.round(off / (Math.PI * 2)) * Math.PI * 2;
      const score = distance + (lockOn ? 0 : Math.abs(off) * 2.2);
      if (score < bestScore) {
        bestScore = score;
        best = def.id;
      }
    }
    return best;
  }

  /** What the HUD should show right now, or null. */
  focus(x: number, z: number, enemies: ArrayLike<NetEnemyState> | null, me: NetPlayerState | null): FocusTarget | null {
    if (this.focusFor > 0 && this.focusId !== NO_TARGET) {
      const held = this.describe(this.focusId, enemies, me);
      if (held && (held.kind === 'building' || held.value > 0) && Math.hypot(held.x - x, held.z - z) < 40) return held;
    }
    // Nothing recently hit: the nearest enemy of the arena the player stands in.
    const stage = stageAt(z, STAGE_COUNT);
    if (stage === 0 || !enemies) return null;
    let bestId = NO_TARGET;
    let bestDistance = FOCUS_RADIUS;
    for (const def of stageByIndex(stage)?.enemies ?? []) {
      const enemy = enemies[def.id];
      if (!enemy || !enemy.alive) continue;
      const d = Math.hypot(enemy.x - x, enemy.z - z) - def.radius;
      if (d < bestDistance) {
        bestDistance = d;
        bestId = def.id;
      }
    }
    return bestId === NO_TARGET ? null : this.describe(bestId, enemies, me);
  }

  private canAttack(id: number, me: NetPlayerState | null): boolean {
    const def = ENEMIES[id];
    if (!def) return false;
    if (!def.boss) return true;
    const stage = stageByIndex(def.stage);
    const mask = me?.killMasks[def.stage - 1] ?? 0;
    return !!stage && (mask & stage.waveMask) === stage.waveMask;
  }

  private describe(target: number, enemies: ArrayLike<NetEnemyState> | null, me: NetPlayerState | null): FocusTarget | null {
    if (isBuildingTarget(target)) {
      const tier = TRAINING_TIERS[target - BUILDING_TARGET_BASE];
      const building = BUILDINGS[target - BUILDING_TARGET_BASE];
      if (!tier || !building) return null;
      const locked = !!me && !canTrainOn(tier.tier, me.rebirths);
      return {
        kind: 'building',
        target,
        name: `${tier.name}  ${tier.multiplier}x Power`,
        value: 0,
        max: 1,
        boss: false,
        locked,
        lockText: locked ? `Needs ${tier.rebirthsRequired} Rebirth${tier.rebirthsRequired === 1 ? '' : 's'}` : '',
        x: building.x,
        z: building.z,
      };
    }
    const def = ENEMIES[target];
    const enemy = enemies?.[target];
    if (!def || !enemy) return null;
    const locked = !this.canAttack(target, me);
    return {
      kind: 'enemy',
      target,
      name: def.name,
      value: enemy.alive ? enemy.hp : 0,
      max: def.maxHp,
      boss: def.boss,
      locked,
      lockText: locked ? 'SEALED - defeat the wave first' : '',
      x: enemy.x,
      z: enemy.z,
    };
  }
}
