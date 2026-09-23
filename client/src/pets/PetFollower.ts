import { Group } from 'three';
import { createPetModel } from './PetModels.js';

/** Where each of the three slots floats, relative to the owner: behind, fanned out. */
const SLOTS: readonly (readonly [number, number])[] = [
  [0, -2.6],
  [-2.1, -1.9],
  [2.1, -1.9],
];
const FOLLOW_RATE = 6;
const TURN_RATE = 8;

interface Follower {
  readonly petId: number;
  readonly model: Group;
  phase: number;
}

/**
 * A player's equipped Yokai, floating after them.
 *
 * WORLD-SPACE, like a trail: each pet eases toward its slot behind the owner
 * rather than being bolted to them, so it swings wide on a turn and catches up
 * after a sprint. The models are cached per species, so an equip change swaps
 * a mesh and builds nothing.
 */
export class PetFollower {
  readonly root = new Group();
  private followers: Follower[] = [];
  private signature = '';

  /** The equipped pets, by species, in slot order. Cheap when unchanged. */
  setPets(petIds: readonly number[]): void {
    const signature = petIds.join(',');
    if (signature === this.signature) return;
    this.signature = signature;
    const previous = this.followers;
    this.followers = [];
    for (const follower of previous) follower.model.removeFromParent();
    petIds.slice(0, SLOTS.length).forEach((petId, index) => {
      const reused = previous.find((entry) => entry.petId === petId && !this.followers.includes(entry));
      const model = reused?.model ?? createPetModel(petId);
      this.followers.push({ petId, model, phase: reused?.phase ?? index * 1.7 });
      this.root.add(model);
    });
    this.placed = false;
  }

  private placed = false;

  update(delta: number, x: number, y: number, z: number, yaw: number): void {
    const dt = Math.max(0, delta);
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const alpha = 1 - Math.exp(-FOLLOW_RATE * dt);
    this.followers.forEach((follower, index) => {
      const [sx, sz] = SLOTS[index]!;
      // Slot offset rotated into the owner's facing.
      const tx = x + sx * cos + sz * sin;
      const tz = z - sx * sin + sz * cos;
      follower.phase += dt * 2.2;
      const ty = y + 1.4 + Math.sin(follower.phase) * 0.25;
      const p = follower.model.position;
      if (!this.placed) p.set(tx, ty, tz);
      else {
        p.x += (tx - p.x) * alpha;
        p.y += (ty - p.y) * alpha;
        p.z += (tz - p.z) * alpha;
      }
      let turn = yaw - follower.model.rotation.y;
      turn -= Math.round(turn / (Math.PI * 2)) * Math.PI * 2;
      follower.model.rotation.y += turn * (1 - Math.exp(-TURN_RATE * dt));
    });
    this.placed = true;
  }

  /** Snap to the owner on a teleport. */
  snap(): void {
    this.placed = false;
  }

  dispose(): void {
    for (const follower of this.followers) follower.model.removeFromParent();
    this.followers = [];
    this.root.removeFromParent();
  }
}
