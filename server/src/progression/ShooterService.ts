import { SHOOTER_SHOP, ownsShooter, shooterById, type ShooterDef } from '@spider/shared';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import type { ProgressionService } from './ProgressionService.js';
import { wallet } from './Wallet.js';

export type ShooterResult =
  | { readonly ok: true; readonly action: 'bought' | 'equipped'; readonly shooter: ShooterDef }
  | { readonly ok: false; readonly reason: 'unknown' | 'away' | 'too-few-wins' | 'already-worn'; readonly shooter?: ShooterDef };

/**
 * Server authority over web shooters.
 *
 * An OWNED shooter is equipped from anywhere. An unowned one is BOUGHT - only
 * by a player the server has standing at the Web Shooter stand, and only with
 * the Wins it costs - and then equipped. The gain per click is re-derived.
 */
export class ShooterService {
  select(player: PlayerState, idRaw: unknown, progression: ProgressionService): ShooterResult {
    const id = Math.floor(Number(idRaw));
    const shooter = shooterById(id);
    if (!shooter) return { ok: false, reason: 'unknown' };

    if (ownsShooter(player.ownedShooters, id)) {
      if (player.shooterId === id) return { ok: false, reason: 'already-worn', shooter };
      player.shooterId = id;
      progression.syncDerived(player);
      return { ok: true, action: 'equipped', shooter };
    }

    if (Math.hypot(player.x - SHOOTER_SHOP.x, player.z - SHOOTER_SHOP.frontZ) > SHOOTER_SHOP.serviceRadius || player.y > 3) {
      return { ok: false, reason: 'away', shooter };
    }
    if (!wallet.spend(player, shooter.cost)) return { ok: false, reason: 'too-few-wins', shooter };
    player.ownedShooters |= 1 << (id - 1);
    player.shooterId = id;
    progression.syncDerived(player);
    return { ok: true, action: 'bought', shooter };
  }
}
