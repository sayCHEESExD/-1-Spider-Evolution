import { randomInt } from 'node:crypto';
import {
  GEAR_DROP_CHANCE,
  GEAR_EQUIP_MAX,
  GEAR_INVENTORY_MAX,
  canWearWith,
  clampRarity,
  gearById,
  gearScore,
  rollGearKind,
  rollGearRarity,
  type GearDef,
  type GearPiece,
  type InventoryActionKind,
} from '@spider/shared';
import { GearState, type PlayerState } from '../rooms/state/PlayerState.js';
import type { ProgressionService } from './ProgressionService.js';

export type GearActionResult =
  | { readonly ok: true; readonly action: InventoryActionKind; readonly gear?: GearDef }
  | { readonly ok: false; readonly reason: 'unknown' | 'slots-full' | 'mount-taken' | 'nothing' };

export interface GearDrop {
  readonly gear: GearDef;
  readonly rarity: number;
  /** The new piece's uid, or 0 when the bag was full and the piece was lost. */
  readonly uid: number;
}

const random01 = (): number => randomInt(0, 1_000_000) / 1_000_000;

/**
 * Server authority over gear: drops, ownership and equipment.
 *
 * A DROP is rolled here, with the server's own cryptographic randomness, when
 * the combat service reports an enemy defeated: a boss always drops, a
 * henchman sometimes. The piece and its rarity come from the stage's pool.
 * A full bag loses the drop (and says so). Equipping, unequipping, deleting
 * and "equip best" all work on server state by uid, and respect the equip
 * limit and one piece per head / back / chest. Derived stats are re-derived
 * after every change.
 */
export class GearService {
  /** Maybe drop a piece for a defeated enemy of `stage`. */
  rollDrop(player: PlayerState, stage: number, boss: boolean): GearDrop | null {
    if (!boss && random01() >= GEAR_DROP_CHANCE) return null;
    const gear = rollGearKind(stage, random01());
    const rarity = rollGearRarity(stage, boss, random01());
    if (player.gear.length >= GEAR_INVENTORY_MAX) return { gear, rarity, uid: 0 };
    const state = new GearState();
    state.uid = player.nextGearUid;
    state.gearId = gear.id;
    state.rarity = rarity;
    player.nextGearUid += 1;
    player.gear.push(state);
    return { gear, rarity, uid: state.uid };
  }

  act(player: PlayerState, actionRaw: unknown, uidRaw: unknown, progression: ProgressionService): GearActionResult {
    const action = String(actionRaw) as InventoryActionKind;
    const uid = Math.floor(Number(uidRaw));
    let result: GearActionResult;
    switch (action) {
      case 'equip': {
        const piece = this.find(player, uid);
        if (!piece) return { ok: false, reason: 'unknown' };
        if (piece.equipped) return { ok: false, reason: 'nothing' };
        const worn = this.worn(player);
        if (worn.length >= GEAR_EQUIP_MAX) return { ok: false, reason: 'slots-full' };
        if (!canWearWith(piece.gearId, worn)) return { ok: false, reason: 'mount-taken' };
        piece.equipped = true;
        result = { ok: true, action, gear: gearById(piece.gearId) };
        break;
      }
      case 'unequip': {
        const piece = this.find(player, uid);
        if (!piece || !piece.equipped) return { ok: false, reason: 'unknown' };
        piece.equipped = false;
        result = { ok: true, action, gear: gearById(piece.gearId) };
        break;
      }
      case 'delete': {
        const index = player.gear.findIndex((entry) => entry.uid === uid);
        if (index < 0) return { ok: false, reason: 'unknown' };
        const gearId = player.gear[index]!.gearId;
        player.gear.splice(index, 1);
        result = { ok: true, action, gear: gearById(gearId) };
        break;
      }
      case 'equipBest': {
        if (player.gear.length === 0) return { ok: false, reason: 'nothing' };
        const ranked = [...player.gear].sort((a, b) => gearScore(b.gearId, b.rarity) - gearScore(a.gearId, a.rarity) || a.uid - b.uid);
        const chosen: GearPiece[] = [];
        const keep = new Set<number>();
        for (const piece of ranked) {
          if (chosen.length >= GEAR_EQUIP_MAX) break;
          if (!canWearWith(piece.gearId, chosen)) continue;
          chosen.push({ gearId: piece.gearId, rarity: piece.rarity });
          keep.add(piece.uid);
        }
        for (const piece of player.gear) piece.equipped = keep.has(piece.uid);
        result = { ok: true, action };
        break;
      }
      case 'unequipAll': {
        for (const piece of player.gear) piece.equipped = false;
        result = { ok: true, action };
        break;
      }
      default:
        return { ok: false, reason: 'unknown' };
    }
    progression.syncDerived(player);
    return result;
  }

  /** Enforce the equip rules on a restored bag: unknown pieces off, the limit, one per mount. */
  normalise(player: PlayerState): void {
    const worn: GearPiece[] = [];
    for (const piece of player.gear) {
      piece.rarity = clampRarity(piece.rarity);
      if (!piece.equipped) continue;
      if (!gearById(piece.gearId) || !canWearWith(piece.gearId, worn)) {
        piece.equipped = false;
        continue;
      }
      worn.push({ gearId: piece.gearId, rarity: piece.rarity });
    }
  }

  private worn(player: PlayerState): GearPiece[] {
    const worn: GearPiece[] = [];
    for (const piece of player.gear) if (piece.equipped) worn.push({ gearId: piece.gearId, rarity: piece.rarity });
    return worn;
  }

  private find(player: PlayerState, uid: number): GearState | undefined {
    return player.gear.find((piece) => piece.uid === uid);
  }
}
