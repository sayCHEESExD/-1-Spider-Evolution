import { randomInt } from 'node:crypto';
import {
  EGG_PLACEMENTS,
  HATCH_MULTI,
  PETS_SHOP,
  PET_EQUIP_MAX,
  PET_INVENTORY_MAX,
  eggById,
  petById,
  rollEgg,
  type EggKind,
  type PetActionKind,
  type PetKind,
} from '@spider/shared';
import { PetState, type PlayerState } from '../rooms/state/PlayerState.js';
import type { ProgressionService } from './ProgressionService.js';
import { wallet } from './Wallet.js';

export type HatchResult =
  | { readonly ok: true; readonly egg: EggKind; readonly pets: { uid: number; pet: PetKind }[] }
  | { readonly ok: false; readonly reason: 'unknown' | 'away' | 'full' | 'too-few-wins'; readonly egg?: EggKind };

export type PetActionResult =
  | { readonly ok: true; readonly action: PetActionKind; readonly pet?: PetKind }
  | { readonly ok: false; readonly reason: 'unknown' | 'slots-full' | 'nothing' };

/**
 * Server authority over pets: ownership, hatching and equipment.
 *
 * A hatch is validated (the egg exists, the player stands at its pedestal,
 * the inventory has room for every pet about to hatch, the Wins are there),
 * the Wins are spent, and only then are the pets ROLLED - with the server's
 * own cryptographic randomness - and added. Equipping, unequipping, deleting
 * and "equip best" all work on server state by uid; the client names a pet,
 * it never describes one. Damage is re-derived after every change.
 */
export class PetService {
  hatch(player: PlayerState, eggRaw: unknown, countRaw: unknown, progression: ProgressionService): HatchResult {
    const egg = eggById(Number(eggRaw));
    if (!egg) return { ok: false, reason: 'unknown' };
    const count = Math.floor(Number(countRaw)) === HATCH_MULTI ? HATCH_MULTI : 1;
    const placement = EGG_PLACEMENTS.find((entry) => entry.egg === egg.id)!;
    if (Math.hypot(player.x - placement.x, player.z - PETS_SHOP.padZ) > PETS_SHOP.serviceRadius) {
      return { ok: false, reason: 'away', egg };
    }
    if (player.pets.length + count > PET_INVENTORY_MAX) return { ok: false, reason: 'full', egg };
    if (!wallet.spend(player, egg.cost * count)) return { ok: false, reason: 'too-few-wins', egg };

    const hatched: { uid: number; pet: PetKind }[] = [];
    for (let i = 0; i < count; i += 1) {
      const pet = rollEgg(egg, randomInt(0, 1_000_000) / 1_000_000);
      const state = new PetState();
      state.uid = player.nextPetUid;
      state.petId = pet.id;
      player.nextPetUid += 1;
      player.pets.push(state);
      player.petsHatched += 1;
      hatched.push({ uid: state.uid, pet });
    }
    // A free slot is filled straight away: a new pet should help at once.
    for (const entry of hatched) {
      if (this.equippedCount(player) >= PET_EQUIP_MAX) break;
      const state = this.find(player, entry.uid);
      if (state) state.equipped = true;
    }
    progression.syncDerived(player);
    return { ok: true, egg, pets: hatched };
  }

  act(player: PlayerState, actionRaw: unknown, uidRaw: unknown, progression: ProgressionService): PetActionResult {
    const action = String(actionRaw) as PetActionKind;
    const uid = Math.floor(Number(uidRaw));
    let result: PetActionResult;
    switch (action) {
      case 'equip': {
        const pet = this.find(player, uid);
        if (!pet) return { ok: false, reason: 'unknown' };
        if (pet.equipped) return { ok: false, reason: 'nothing' };
        if (this.equippedCount(player) >= PET_EQUIP_MAX) return { ok: false, reason: 'slots-full' };
        pet.equipped = true;
        result = { ok: true, action, pet: petById(pet.petId) };
        break;
      }
      case 'unequip': {
        const pet = this.find(player, uid);
        if (!pet || !pet.equipped) return { ok: false, reason: 'unknown' };
        pet.equipped = false;
        result = { ok: true, action, pet: petById(pet.petId) };
        break;
      }
      case 'delete': {
        const index = player.pets.findIndex((entry) => entry.uid === uid);
        if (index < 0) return { ok: false, reason: 'unknown' };
        const petId = player.pets[index]!.petId;
        player.pets.splice(index, 1);
        result = { ok: true, action, pet: petById(petId) };
        break;
      }
      case 'equipBest': {
        if (player.pets.length === 0) return { ok: false, reason: 'nothing' };
        const ranked = [...player.pets].sort(
          (a, b) => (petById(b.petId)?.bonus ?? 0) - (petById(a.petId)?.bonus ?? 0) || a.uid - b.uid,
        );
        const best = new Set(ranked.slice(0, PET_EQUIP_MAX).map((pet) => pet.uid));
        for (const pet of player.pets) pet.equipped = best.has(pet.uid);
        result = { ok: true, action };
        break;
      }
      case 'unequipAll': {
        for (const pet of player.pets) pet.equipped = false;
        result = { ok: true, action };
        break;
      }
      default:
        return { ok: false, reason: 'unknown' };
    }
    progression.syncDerived(player);
    return result;
  }

  /** Enforce the equip limit on a restored inventory. */
  normalise(player: PlayerState): void {
    let equipped = 0;
    for (const pet of player.pets) {
      if (!petById(pet.petId)) pet.equipped = false;
      if (pet.equipped) {
        equipped += 1;
        if (equipped > PET_EQUIP_MAX) pet.equipped = false;
      }
    }
  }

  private equippedCount(player: PlayerState): number {
    let count = 0;
    for (const pet of player.pets) if (pet.equipped) count += 1;
    return count;
  }

  private find(player: PlayerState, uid: number): PetState | undefined {
    return player.pets.find((pet) => pet.uid === uid);
  }
}
