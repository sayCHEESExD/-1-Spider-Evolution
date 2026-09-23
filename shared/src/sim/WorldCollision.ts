import { buildStaticSolids, gateBox, worldBounds } from '../config/map.js';
import { MOVEMENT } from '../config/movement.js';
import { STAGE_COUNT } from '../config/stages.js';
import { PLAYER_HEIGHT, PLAYER_RADIUS } from '../constants/world.js';
import type { Aabb } from '../types/math.js';

/** Grid cell for the broad phase, in world units. */
const CELL = 16;
const EPS = 1e-4;

/** One solid, and when it applies. `gate` > 0 is a stage portal, solid until that stage is opened. */
interface Solid {
  readonly box: Aabb;
  readonly gate: number;
}

/**
 * THE WORLD AS THE SIMULATION SEES IT: axis-aligned boxes and a floor at
 * y = 0, shared by the server (authority) and the client (prediction), so the
 * two collide against the exact same shapes.
 *
 * The player is a box of `PLAYER_RADIUS` half-width and `PLAYER_HEIGHT`
 * height. Horizontal moves are resolved one axis at a time; a face no higher
 * than `MOVEMENT.stepHeight` above the feet is STEPPED ONTO rather than
 * blocking, which is what makes the Suit stage's stairs and the zone floors
 * walkable without ramps.
 *
 * Stage portals are solids too, keyed by stage: a portal is solid for a
 * player whose `openedStage` is below it. That is how "Kill your enemies to
 * enter" is enforced - by the same collision that stops you walking into a
 * wall, on both sides of the wire.
 */
export class WorldCollision {
  private readonly solids: Solid[] = [];
  private readonly grid = new Map<number, number[]>();
  private readonly bounds: Aabb;
  private readonly seen: number[] = [];
  private stamp = 1;
  private readonly marks: number[] = [];

  constructor(stageCount = STAGE_COUNT) {
    for (const box of buildStaticSolids(stageCount)) this.add(box, 0);
    for (let stage = 1; stage < stageCount; stage += 1) this.add(gateBox(stage), stage);
    this.bounds = worldBounds(stageCount);
  }

  /** Every static solid, for diagnostics and the verification scripts. */
  get boxes(): readonly Aabb[] {
    return this.solids.filter((solid) => solid.gate === 0).map((solid) => solid.box);
  }

  private add(box: Aabb, gate: number): void {
    const index = this.solids.length;
    this.solids.push({ box, gate });
    this.marks.push(0);
    for (let cx = Math.floor(box.minX / CELL); cx <= Math.floor(box.maxX / CELL); cx += 1) {
      for (let cz = Math.floor(box.minZ / CELL); cz <= Math.floor(box.maxZ / CELL); cz += 1) {
        const key = cellKey(cx, cz);
        let list = this.grid.get(key);
        if (!list) {
          list = [];
          this.grid.set(key, list);
        }
        list.push(index);
      }
    }
  }

  /** Candidate solids overlapping an XZ rectangle, each once. Reuses one array. */
  private query(minX: number, maxX: number, minZ: number, maxZ: number, openedStage: number): readonly number[] {
    const out = this.seen;
    out.length = 0;
    this.stamp += 1;
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx += 1) {
      for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz += 1) {
        const list = this.grid.get(cellKey(cx, cz));
        if (!list) continue;
        for (const index of list) {
          if (this.marks[index] === this.stamp) continue;
          this.marks[index] = this.stamp;
          const solid = this.solids[index]!;
          if (solid.gate > 0 && solid.gate <= openedStage) continue;
          const b = solid.box;
          if (b.maxX <= minX || b.minX >= maxX || b.maxZ <= minZ || b.minZ >= maxZ) continue;
          out.push(index);
        }
      }
    }
    return out;
  }

  /** True when a player box standing at (x, y, z) overlaps any solid. */
  private blocked(x: number, y: number, z: number, openedStage: number): boolean {
    const r = PLAYER_RADIUS;
    for (const index of this.query(x - r, x + r, z - r, z + r, openedStage)) {
      const b = this.solids[index]!.box;
      if (b.maxY > y + EPS && b.minY < y + PLAYER_HEIGHT - EPS) return true;
    }
    return false;
  }

  /**
   * Move horizontally along one axis, stepping up low faces.
   *
   * @returns the new coordinate on that axis, and writes a raised `y` into
   *          `out.y` when a step was taken.
   */
  moveAxis(
    axis: 'x' | 'z',
    x: number,
    y: number,
    z: number,
    delta: number,
    openedStage: number,
    out: { value: number; y: number; hit: boolean },
  ): void {
    out.y = y;
    out.hit = false;
    const r = PLAYER_RADIUS;
    let nx = axis === 'x' ? x + delta : x;
    let nz = axis === 'z' ? z + delta : z;
    let ny = y;

    for (let pass = 0; pass < 3; pass += 1) {
      let collided = false;
      for (const index of this.query(nx - r, nx + r, nz - r, nz + r, openedStage)) {
        const b = this.solids[index]!.box;
        if (b.maxY <= ny + EPS || b.minY >= ny + PLAYER_HEIGHT - EPS) continue;
        // A low face: step onto it, if there is headroom up there.
        const rise = b.maxY - ny;
        if (rise <= MOVEMENT.stepHeight && !this.blocked(nx, b.maxY, nz, openedStage)) {
          ny = b.maxY;
          collided = true;
          break;
        }
        // A wall: stop against its face.
        if (axis === 'x') nx = delta > 0 ? b.minX - r - EPS : b.maxX + r + EPS;
        else nz = delta > 0 ? b.minZ - r - EPS : b.maxZ + r + EPS;
        out.hit = true;
        collided = true;
        break;
      }
      if (!collided) break;
    }
    // Never let the step or the push leave the player further than asked.
    if (axis === 'x') {
      if ((delta > 0 && nx < x) || (delta < 0 && nx > x)) nx = x;
    } else if ((delta > 0 && nz < z) || (delta < 0 && nz > z)) nz = z;

    out.value = axis === 'x' ? nx : nz;
    out.y = ny;
  }

  /** The highest floor under the footprint at or below `y + tolerance`: a box top, or the ground. */
  floorBelow(x: number, y: number, z: number, openedStage: number, tolerance = EPS): number {
    const r = PLAYER_RADIUS * 0.92;
    let floor = 0;
    for (const index of this.query(x - r, x + r, z - r, z + r, openedStage)) {
      const b = this.solids[index]!.box;
      if (b.maxY <= y + tolerance && b.maxY > floor) floor = b.maxY;
    }
    return floor;
  }

  /** The lowest ceiling above a head at `headY`, or +Infinity. */
  ceilingAbove(x: number, headY: number, z: number, openedStage: number): number {
    const r = PLAYER_RADIUS * 0.92;
    let ceiling = Number.POSITIVE_INFINITY;
    for (const index of this.query(x - r, x + r, z - r, z + r, openedStage)) {
      const b = this.solids[index]!.box;
      if (b.minY >= headY - EPS && b.minY < ceiling) ceiling = b.minY;
    }
    return ceiling;
  }

  /** Keep a position inside the world, whatever displacement produced it. */
  clampToBounds(position: { x: number; z: number }): void {
    const r = PLAYER_RADIUS;
    const b = this.bounds;
    if (position.x < b.minX + r) position.x = b.minX + r;
    if (position.x > b.maxX - r) position.x = b.maxX - r;
    if (position.z < b.minZ + r) position.z = b.minZ + r;
    if (position.z > b.maxZ - r) position.z = b.maxZ - r;
  }
}

const cellKey = (cx: number, cz: number): number => (cx + 4096) * 8192 + (cz + 4096);
