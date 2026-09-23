/**
 * The DERIVING facts of a player's progression: everything a session is
 * rebuilt from. Level, gain per click, speed and health are recomputed from these
 * by the same shared formulas a live session uses.
 */
export interface PetRecord {
  /** Unique per player, never reused. */
  uid: number;
  petId: number;
}

export interface GearRecord {
  /** Unique per player, never reused. */
  uid: number;
  gearId: number;
  /** 0 Common .. 3 Legendary. */
  rarity: number;
}

export interface ProgressFields {
  /** Total XP this rebirth (reset by a rebirth). The level is read off it. */
  xp: number;
  /** Web Power held (reset by a rebirth). */
  webPower: number;
  /** Highest Web Power ever held. */
  bestWebPower: number;
  wins: number;
  /** Wins earned, ever. */
  lifetimeWins: number;
  rebirths: number;
  /** Bitmask of suits owned (slot 1 = bit 0, always owned). */
  ownedSuits: number;
  /** The worn suit's slot. */
  suitSlot: number;
  /** Bitmask of web shooters owned (id 1 = bit 0, always owned). */
  ownedShooters: number;
  /** The equipped web shooter. */
  shooterId: number;
  pets: PetRecord[];
  /** uids of the equipped pets. */
  equippedPets: number[];
  /** The next pet uid to hand out. */
  nextPetUid: number;
  /** Pets ever hatched. */
  petsHatched: number;
  gear: GearRecord[];
  /** uids of the equipped gear. */
  equippedGear: number[];
  /** The next gear uid to hand out. */
  nextGearUid: number;
  /** Enemies defeated, ever. */
  kills: number;
  /** Damage dealt to enemies, ever: the Highest Damage board. */
  totalDamage: number;
  /** Highest stage ever cleared: how far the Teleport menu reaches. */
  bestStage: number;
  /** Seconds played, lifetime: the Highest Playtime board. */
  playSeconds: number;
}

/** What one save writes. */
export interface ProfileFields extends ProgressFields {
  /** The portal's display name and portrait as last seen. Cleared when empty. */
  displayName: string;
  avatarUrl: string;
  /** Wall clock of the save. */
  updatedAt: number;
}

/**
 * The first-login migration's bookkeeping.
 *
 *   - An ACCOUNT profile created from a browser's guest progress carries
 *     `migratedFrom`, the guest key it came from.
 *   - That GUEST profile is then RETIRED: its progress is reset, it carries
 *     `migratedTo` (the account key), `migratedAt`, and `migratedSnapshot` -
 *     the progress it held at that moment, kept as a recovery copy.
 */
export interface MigrationFields {
  migratedFrom?: string;
  migratedTo?: string;
  migratedAt?: number;
  migratedSnapshot?: ProgressFields;
}

/**
 * A profile as READ from storage. Beyond the fields this build knows, it may
 * carry any field a newer or older build wrote: those are kept and written
 * back untouched, never dropped.
 */
export type StoredProfile = ProfileFields & MigrationFields & { [field: string]: unknown };

const NUMERIC_KEYS = [
  'xp',
  'webPower',
  'bestWebPower',
  'wins',
  'lifetimeWins',
  'rebirths',
  'ownedSuits',
  'suitSlot',
  'ownedShooters',
  'shooterId',
  'nextPetUid',
  'petsHatched',
  'nextGearUid',
  'kills',
  'totalDamage',
  'bestStage',
  'playSeconds',
] as const satisfies readonly (keyof ProgressFields)[];

/** Optional string fields a save may CLEAR. The only fields ever $unset. */
export const CLEARABLE_FIELDS = ['displayName', 'avatarUrl'] as const;

const numeric = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

const numbers = (value: unknown, limit: number): number[] =>
  Array.isArray(value) ? value.slice(0, limit).map(numeric) : [];

const gearRecords = (value: unknown): GearRecord[] => {
  if (!Array.isArray(value)) return [];
  const out: GearRecord[] = [];
  const seen = new Set<number>();
  for (const entry of value.slice(0, 64)) {
    if (!entry || typeof entry !== 'object') continue;
    const uid = numeric((entry as { uid?: unknown }).uid);
    const gearId = numeric((entry as { gearId?: unknown }).gearId);
    const rarity = numeric((entry as { rarity?: unknown }).rarity);
    if (uid <= 0 || gearId <= 0 || seen.has(uid)) continue;
    seen.add(uid);
    out.push({ uid: Math.floor(uid), gearId: Math.floor(gearId), rarity: Math.min(3, Math.floor(rarity)) });
  }
  return out;
};

const petRecords = (value: unknown): PetRecord[] => {
  if (!Array.isArray(value)) return [];
  const out: PetRecord[] = [];
  const seen = new Set<number>();
  for (const entry of value.slice(0, 64)) {
    if (!entry || typeof entry !== 'object') continue;
    const uid = numeric((entry as { uid?: unknown }).uid);
    const petId = numeric((entry as { petId?: unknown }).petId);
    if (uid <= 0 || petId <= 0 || seen.has(uid)) continue;
    seen.add(uid);
    out.push({ uid: Math.floor(uid), petId: Math.floor(petId) });
  }
  return out;
};

export const emptyProgress = (): ProgressFields => ({
  xp: 0,
  webPower: 0,
  bestWebPower: 0,
  wins: 0,
  lifetimeWins: 0,
  rebirths: 0,
  ownedSuits: 1,
  suitSlot: 1,
  ownedShooters: 1,
  shooterId: 1,
  pets: [],
  equippedPets: [],
  nextPetUid: 1,
  petsHatched: 0,
  gear: [],
  equippedGear: [],
  nextGearUid: 1,
  kills: 0,
  totalDamage: 0,
  bestStage: 0,
  playSeconds: 0,
});

/** Just the progression of a profile, coerced. */
export const progressOf = (source: Partial<ProgressFields>): ProgressFields => {
  const out = emptyProgress();
  for (const key of NUMERIC_KEYS) out[key] = numeric(source[key]);
  if (out.ownedSuits === 0) out.ownedSuits = 1;
  if (out.suitSlot === 0) out.suitSlot = 1;
  if (out.ownedShooters === 0) out.ownedShooters = 1;
  if (out.shooterId === 0) out.shooterId = 1;
  if (out.nextPetUid === 0) out.nextPetUid = 1;
  if (out.nextGearUid === 0) out.nextGearUid = 1;
  out.pets = petRecords(source.pets);
  out.equippedPets = numbers(source.equippedPets, 8).map(Math.floor);
  out.gear = gearRecords(source.gear);
  out.equippedGear = numbers(source.equippedGear, 8).map(Math.floor);
  return out;
};

/**
 * Coerce whatever storage held into a profile, KEEPING every unknown field.
 */
export const coerceProfile = (raw: unknown): StoredProfile | null => {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const profile: StoredProfile = {
    ...source,
    ...progressOf(source as Partial<ProgressFields>),
    displayName: text(source['displayName']),
    avatarUrl: text(source['avatarUrl']),
    updatedAt: numeric(source['updatedAt']),
  };
  if (typeof source['migratedFrom'] !== 'string') delete profile.migratedFrom;
  if (typeof source['migratedTo'] !== 'string') delete profile.migratedTo;
  if (typeof source['migratedAt'] !== 'number') delete profile.migratedAt;
  if (source['migratedSnapshot'] && typeof source['migratedSnapshot'] === 'object') {
    profile.migratedSnapshot = progressOf(source['migratedSnapshot'] as Partial<ProgressFields>);
  } else {
    delete profile.migratedSnapshot;
  }
  return profile;
};

/**
 * Whether a profile holds anything worth carrying into an account. A player
 * who opened the game and stood still has nothing to migrate.
 */
export const hasProgress = (p: ProgressFields): boolean =>
  p.xp > 0 ||
  p.webPower > 0 ||
  p.bestWebPower > 0 ||
  p.wins > 0 ||
  p.lifetimeWins > 0 ||
  p.bestStage > 0 ||
  p.rebirths > 0 ||
  p.ownedSuits > 1 ||
  p.ownedShooters > 1 ||
  p.pets.length > 0 ||
  p.gear.length > 0;
