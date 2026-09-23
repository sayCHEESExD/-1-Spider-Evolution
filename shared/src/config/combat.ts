/**
 * Web-shooting tuning, shared so the client's aim and the server's validation
 * agree on the same numbers.
 *
 * A web click is a REQUEST. The client names what it webbed (a hint) and the
 * server decides: the rate limit first, then the target - it must exist, be
 * alive, be allowed for this player, and be within web range of the position
 * the SERVER simulated. With no valid target the web still flies (into the
 * air) and pays the plain gain. Every figure paid or dealt is the server's.
 */
export const COMBAT = {
  /** Seconds between two webs the client fires (manual or auto-click). */
  attackInterval: 0.3,
  /**
   * The server's rate limit: a bucket of `burst` webs refilled one per
   * `refillSeconds`. A touch looser than the client so network jitter never
   * eats an honest click; an auto-clicker gains nothing past it.
   */
  refillSeconds: 0.27,
  burst: 3,
  /** Web range from the player's centre to the target's edge, grounded. */
  reach: 16,
  /** While airborne or swinging, the web reaches further: the swing lock-on range. */
  airReach: 26,
  /** Extra reach the server allows for latency: the client fires from a newer position. */
  reachSlack: 3,
  /** Highest vertical gap between the player's feet and a target's base a web may cross. */
  verticalReach: 24,
  /** How long the shooting stance holds after the last web, seconds. */
  stanceSeconds: 1.2,
  /** Health regained per second, as a fraction of max, after `regenDelay` seconds unhurt. */
  regenRate: 0.12,
  regenDelay: 3,
  /**
   * Seconds a defeated player lies in the death state before the server sends
   * them home. The client's death animation (shorter) always finishes first.
   */
  deathSeconds: 2,
} as const;

/** Web targets: an enemy id, or a training building offset past it. */
export const BUILDING_TARGET_BASE = 1000;
export const NO_TARGET = -1;

export const buildingTarget = (tier: number): number => BUILDING_TARGET_BASE + tier;
export const isBuildingTarget = (target: number): boolean => target >= BUILDING_TARGET_BASE;
