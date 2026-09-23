import type { Aabb } from '../types/math.js';
import { EGGS } from './pets.js';
import { SUIT_COUNT } from './suits.js';
import { TRAINING_TIERS } from './training.js';

/**
 * THE MAP, as pure data. Every coordinate in the game lives here; collision
 * (shared, both sides) and the client's visuals both read it, so the thing a
 * player walks on and the thing they see cannot drift apart.
 *
 * Axes: +Z runs from the plaza toward the stage street. The spawn faces +Z, so
 * the camera's RIGHT at the spawn is world -X and its LEFT is world +X:
 *
 *   - the TRAINING DISTRICT is LEFT of the spawn (+X): six miniature NYC
 *     buildings, each with a web pad in front of it;
 *   - the SUIT UPGRADES stage is RIGHT of it (-X): three storeys of suit pads;
 *   - the PET EGGS and the SCOREBOARDS are BEHIND it (-Z);
 *   - the WEB SHOOTER stand is in the back-left corner;
 *   - walkable ROOFTOPS line the front corners and the back-right corner, for
 *     web-swinging up onto;
 *   - the STAGE PORTAL is straight ahead (+Z).
 */

export interface Placement {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Facing, radians: 0 faces +Z, -PI/2 faces -X. */
  readonly yaw: number;
}

export const SPAWN: Placement = { x: 0, y: 0, z: 0, yaw: 0 };

/** The plaza: the walkable rectangle inside the city walls. */
export const HUB = { minX: -112, maxX: 112, minZ: -70, maxZ: 44 } as const;

/** Where the plaza opens onto the stage street: the Stage 1 portal. */
export const HUB_GATE = { minX: -10, maxX: 10, z: 44 } as const;
export const HUB_FRONT_WALL_DEPTH = 4;

const aabb = (minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number): Aabb => ({ minX, maxX, minY, maxY, minZ, maxZ });

// ------------------------------------------------------------ Suit stage

/**
 * THE SUIT UPGRADES STAGE: three stepped storeys against a back wall, open
 * toward the spawn (+X). Seven pads on the first storey, six on the second
 * and six on the third, one suit statue behind each. Stairs climb both ends.
 */
export const SUIT_STAGE = {
  minZ: -32,
  maxZ: 32,
  frontX: -38,
  backX: -78,
  tiers: [
    { minX: -50, maxX: -38, top: 0.8, padX: -44 },
    { minX: -62, maxX: -50, top: 4.8, padX: -56 },
    { minX: -78, maxX: -62, top: 8.8, padX: -70 },
  ],
  /** z of the pads on each storey. */
  padZ: [
    [-24, -16, -8, 0, 8, 16, 24],
    [-20, -12, -4, 4, 12, 20],
    [-20, -12, -4, 4, 12, 20],
  ],
  /** Two stair lanes, one at each end of the stage. */
  stairLanes: [
    [28.5, 32],
    [-32, -28.5],
  ],
  padHalf: 2.6,
} as const;

export interface SuitPad {
  readonly slot: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly half: number;
}

export const SUIT_PADS: readonly SuitPad[] = (() => {
  const pads: SuitPad[] = [];
  let slot = 1;
  SUIT_STAGE.tiers.forEach((tier, index) => {
    for (const z of SUIT_STAGE.padZ[index] ?? []) {
      if (slot > SUIT_COUNT) break;
      pads.push({ slot, x: tier.padX, y: tier.top, z, half: SUIT_STAGE.padHalf });
      slot += 1;
    }
  });
  return pads;
})();

/** A stair: `steps` treads climbing from `fromY` to `toY` along -X. */
export interface Stair {
  readonly x0: number;
  readonly x1: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly fromY: number;
  readonly toY: number;
  readonly steps: number;
}

export const SUIT_STAIRS: readonly Stair[] = SUIT_STAGE.stairLanes.flatMap(([minZ, maxZ]) => [
  { x0: -44, x1: -50, minZ, maxZ, fromY: 0.8, toY: 4.8, steps: 4 },
  { x0: -56, x1: -62, minZ, maxZ, fromY: 4.8, toY: 8.8, steps: 4 },
]);

/** The boxes of one stair's treads, each resting on the storey below. */
export const stairBoxes = (stair: Stair): Aabb[] => {
  const boxes: Aabb[] = [];
  const run = (stair.x0 - stair.x1) / stair.steps;
  const rise = (stair.toY - stair.fromY) / (stair.steps + 1);
  for (let i = 1; i <= stair.steps; i += 1) {
    const maxX = stair.x0 - run * (i - 1);
    boxes.push({ minX: maxX - run, maxX, minY: stair.fromY, maxY: stair.fromY + rise * i, minZ: stair.minZ, maxZ: stair.maxZ });
  }
  return boxes;
};

// ---------------------------------------------------------------- Training

/**
 * THE TRAINING DISTRICT, left of the spawn: a raised sidewalk block with six
 * miniature buildings in two rows. Each building's web pad lies on its
 * spawn side (-X); standing on it webs the building continuously.
 */
export const TRAINING = {
  minX: 40,
  maxX: 104,
  minZ: -34,
  maxZ: 34,
  floorTop: 0.3,
} as const;

export interface BuildingPlacement {
  readonly tier: number;
  /** Centre of the building's footprint. */
  readonly x: number;
  readonly z: number;
  /** Centre of its web pad. */
  readonly padX: number;
  readonly padZ: number;
}

const BUILDING_SPOTS: readonly (readonly [number, number])[] = [
  [60, -20],
  [60, 0],
  [60, 20],
  [92, -20],
  [92, 0],
  [92, 20],
];

/** Half-width of a training building's footprint. */
export const BUILDING_HALF = 3.5;
/** How far in front (-X) of its building a pad lies. */
export const BUILDING_PAD_OFFSET = 10;
/** Standing within this of a pad's centre webs its building. */
export const BUILDING_PAD_RADIUS = 3.6;

export const BUILDINGS: readonly BuildingPlacement[] = TRAINING_TIERS.map((tier) => {
  const spot = BUILDING_SPOTS[tier.tier]!;
  return { tier: tier.tier, x: spot[0], z: spot[1], padX: spot[0] - BUILDING_PAD_OFFSET, padZ: spot[1] };
});

/** A building's solids: the tower on the district floor (Lady Liberty: a pedestal and a narrower statue). */
export const buildingSolids = (tier: number): Aabb[] => {
  const place = BUILDINGS[tier];
  const def = TRAINING_TIERS[tier];
  if (!place || !def) return [];
  const floor = TRAINING.floorTop;
  const h = BUILDING_HALF;
  if (tier === 5) {
    return [
      aabb(place.x - h, place.x + h, floor, floor + 5, place.z - h, place.z + h),
      aabb(place.x - 1.6, place.x + 1.6, floor + 5, floor + def.height, place.z - 1.6, place.z + 1.6),
      // The torch arm, raised over her right shoulder (toward -Z).
      aabb(place.x - 0.45, place.x + 0.45, floor + def.height, floor + def.height + 3.4, place.z - 1.4, place.z - 0.5),
    ];
  }
  return [aabb(place.x - h, place.x + h, floor, floor + def.height, place.z - h, place.z + h)];
};

/**
 * THE MINIATURE TOWN round the training towers: each tower stands in its own
 * little city block - three narrow walk-ups behind it, a corner shop on one
 * flank, a tree, a lamp and a hydrant on the other - and the blocks are cut
 * apart by streets with sidewalks, an avenue down the middle, parked cars,
 * street lamps and traffic lights. Streets and paving are flat decals; every
 * piece that stands up is a SOLID (listed here, drawn exactly by the client),
 * and none of them touches a pad, a tower or another piece.
 */
export type TownPieceKind = 'building' | 'car' | 'tree' | 'lamp' | 'hydrant' | 'light';

export interface TownPiece {
  readonly kind: TownPieceKind;
  /** Centre of the footprint. */
  readonly x: number;
  readonly z: number;
  /** Footprint along x and z, and height above the district floor. */
  readonly w: number;
  readonly d: number;
  readonly h: number;
  /** Varies the look (facade, colour, which way a car faces). */
  readonly variant: number;
}

/** The town's streets, as asphalt bands across the district (z ranges) and the avenue (x range). */
export const TRAINING_STREETS = {
  /** East-west streets: asphalt z ranges, each with a 1-unit sidewalk either side. */
  crossZ: [
    [-33, -28],
    [-12, -8],
    [8, 12],
    [28, 33],
  ] as readonly (readonly [number, number])[],
  /** The avenue between the two columns of towers: asphalt x range, 1-unit sidewalks either side. */
  avenueX: [71, 76] as const,
  sidewalk: 1,
} as const;

export const TRAINING_TOWN: readonly TownPiece[] = (() => {
  const pieces: TownPiece[] = [];
  const piece = (kind: TownPieceKind, x: number, z: number, w: number, d: number, h: number, variant: number): void => {
    pieces.push({ kind, x, z, w, d, h, variant });
  };
  const heights = [
    [3.2, 4.6, 2.6],
    [4.2, 2.8, 3.8],
    [2.6, 3.6, 5],
  ];
  BUILDING_SPOTS.forEach(([bx, bz], i) => {
    const h = heights[i % 3]!;
    // Behind the tower: three narrow walk-ups.
    piece('building', bx + 6.8, bz - 4.5, 5, 4.2, h[0]!, i * 3);
    piece('building', bx + 6.8, bz + 0.1, 5, 4.2, h[1]!, i * 3 + 1);
    piece('building', bx + 6.8, bz + 4.6, 5, 4, h[2]!, i * 3 + 2);
    // A corner shop on one flank; a tree, a lamp and a hydrant on the other.
    const s = i % 2 ? 1 : -1;
    piece('building', bx + 0.5, bz + s * 5.55, 6, 2.5, 2.2, 20 + i);
    piece('tree', bx - 1.5, bz - s * 5.6, 1.6, 1.6, 2.6, i);
    piece('lamp', bx + 2.2, bz - s * 6.4, 0.3, 0.3, 2.6, i);
    piece('hydrant', bx - 4.1, bz - s * 5.2, 0.4, 0.4, 0.5, i);
  });
  // Cars parked along the kerbs, clear of the crosswalks and the pad column.
  let car = 0;
  for (const [z0, z1] of TRAINING_STREETS.crossZ) {
    const kerb = z0 + 0.55;
    const far = z1 - 0.55;
    for (const x of [59, 64.5, 81, 96.5]) piece('car', x, car % 2 ? far : kerb, 1.9, 0.9, 0.85, car++);
  }
  for (const z of [-21, -2, 19]) piece('car', TRAINING_STREETS.avenueX[0] + 0.55, z, 0.9, 1.9, 0.85, car++);
  for (const z of [-17, 2.5, 22]) piece('car', TRAINING_STREETS.avenueX[1] - 0.55, z, 0.9, 1.9, 0.85, car++);
  // Street lamps on the sidewalks, traffic lights on the avenue's corners.
  for (const [z0, z1] of TRAINING_STREETS.crossZ.slice(1, 3)) {
    for (const x of [58, 66, 80, 98]) {
      piece('lamp', x, z0 - 0.5, 0.3, 0.3, 2.6, 0);
      piece('lamp', x + 4, z1 + 0.5, 0.3, 0.3, 2.6, 1);
    }
  }
  for (const [z0, z1] of TRAINING_STREETS.crossZ.slice(1, 3)) {
    piece('light', TRAINING_STREETS.avenueX[0] - 0.5, z0 - 0.5, 0.3, 0.3, 2.8, 0);
    piece('light', TRAINING_STREETS.avenueX[1] + 0.5, z1 + 0.5, 0.3, 0.3, 2.8, 1);
  }
  return pieces;
})();

/** A town piece's solid. */
export const townPieceSolid = (piece: TownPiece): Aabb =>
  aabb(piece.x - piece.w / 2, piece.x + piece.w / 2, TRAINING.floorTop, TRAINING.floorTop + piece.h, piece.z - piece.d / 2, piece.z + piece.d / 2);

/** Where a web aimed at a building lands: its face toward the pad, two thirds up. */
export const buildingAimPoint = (tier: number): { x: number; y: number; z: number } => {
  const place = BUILDINGS[tier]!;
  const def = TRAINING_TIERS[tier]!;
  return { x: place.x - BUILDING_HALF, y: TRAINING.floorTop + Math.min(def.height * 0.6, 7), z: place.z };
};

// ------------------------------------------------------------------ Eggs

export const PETS_SHOP = {
  minX: -62,
  maxX: 62,
  minZ: -64,
  maxZ: -40,
  floorTop: 0.3,
  eggZ: -54,
  padZ: -45.5,
  padHalf: 3,
  pedestalHalf: 3.4,
  pedestalTop: 1.6,
  /** A hatch is accepted within this distance of the egg's pad centre. */
  serviceRadius: 9,
} as const;

export interface EggPlacement {
  readonly egg: number;
  readonly x: number;
}

export const EGG_PLACEMENTS: readonly EggPlacement[] = EGGS.map((egg, index) => ({ egg: egg.id, x: -50 + index * 20 }));

// ------------------------------------------------------------------ Boards

/** The two scoreboards: screens high on the back wall, above the eggs. */
export const BOARDS = {
  z: -69.8,
  centreY: 21,
  width: 20,
  height: 20,
  xs: [-18, 18],
} as const;

// ---------------------------------------------------------- Web Shooters

/**
 * THE WEB SHOOTER STAND, back-left: a street kiosk with a red-and-white
 * awning, its counter toward the plaza. Buying needs the player within
 * `serviceRadius` of the counter's front.
 */
export const SHOOTER_SHOP = {
  x: 86,
  z: -58,
  /** Where a customer stands. */
  frontZ: -50,
  halfWidth: 7,
  depth: 5,
  serviceRadius: 12,
} as const;

// ------------------------------------------------------------- Rooftops

/**
 * WALKABLE ROOFTOPS: low New York blocks in the plaza's corners, their roofs
 * flat and solid, for web-swinging up onto. Each is one solid; the client
 * dresses its roof with water towers and vents that stand clear of the edges.
 */
export interface Rooftop {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly top: number;
  readonly color: number;
  /** A water tower on the roof, centred here (solid, like the roof). */
  readonly tower?: { readonly x: number; readonly z: number };
}

export const ROOFTOPS: readonly Rooftop[] = [
  { minX: 44, maxX: 70, minZ: 37, maxZ: 44, top: 8, color: 0xb0583a, tower: { x: 65, z: 40.5 } },
  { minX: 72, maxX: 104, minZ: 37, maxZ: 44, top: 13, color: 0x8a6a5a },
  { minX: -70, maxX: -44, minZ: 37, maxZ: 44, top: 9, color: 0x9a4a3a },
  { minX: -104, maxX: -72, minZ: 37, maxZ: 44, top: 14, color: 0x6a7a8a, tower: { x: -99, z: 40.5 } },
  { minX: -106, maxX: -84, minZ: -68, maxZ: -44, top: 11, color: 0xa8603a, tower: { x: -95, z: -62 } },
];

/** A rooftop water tower's footprint half-width and height. */
export const WATER_TOWER = { half: 2.2, height: 7 } as const;

// --------------------------------------------------------------- Hub props

/** Street lamps along the paths: solid posts. */
export const HUB_LAMPS: readonly (readonly [number, number])[] = [
  [-14, 28],
  [14, 28],
  [-30, -30],
  [30, -30],
  [-32, 30],
  [32, 30],
];
export const LAMP_HALF = 0.35;

/** Park trees in planters: solid trunks. */
export const HUB_TREES: readonly (readonly [number, number, number])[] = [
  [-26, 12, 1.2],
  [26, 12, 1.2],
  [-26, -14, 1.2],
  [26, -14, 1.2],
];
export const TREE_HALF = 0.7;

/**
 * PLAZA DRESSING THAT STANDS WHERE A PLAYER CAN WALK: every piece is a solid,
 * listed here once so the client draws exactly what collision holds. All of
 * it is clear of the plaza, the paths, the pads and the building pads.
 */
export const HUB_PROP_SOLIDS: readonly Aabb[] = [
  // Two parked taxis by the portal.
  aabb(-26.2, -21.8, 0, 2.2, 35, 40),
  aabb(21.8, 26.2, 0, 2.2, 35, 40),
  // A newsstand and a hot-dog cart on the plaza's edge.
  aabb(-36, -32, 0, 3.4, -12, -8),
  aabb(33, 36, 0, 2.6, 8, 11),
  // The Web Shooter stand: counter, two awning posts behind it, back wall.
  aabb(SHOOTER_SHOP.x - SHOOTER_SHOP.halfWidth, SHOOTER_SHOP.x + SHOOTER_SHOP.halfWidth, 0, 2.2, SHOOTER_SHOP.z + 1, SHOOTER_SHOP.z + 3),
  aabb(SHOOTER_SHOP.x - SHOOTER_SHOP.halfWidth, SHOOTER_SHOP.x + SHOOTER_SHOP.halfWidth, 0, 7.4, SHOOTER_SHOP.z - 3, SHOOTER_SHOP.z - 2),
  aabb(SHOOTER_SHOP.x - SHOOTER_SHOP.halfWidth, SHOOTER_SHOP.x - SHOOTER_SHOP.halfWidth + 0.6, 0, 7.4, SHOOTER_SHOP.z - 2, SHOOTER_SHOP.z + 1),
  aabb(SHOOTER_SHOP.x + SHOOTER_SHOP.halfWidth - 0.6, SHOOTER_SHOP.x + SHOOTER_SHOP.halfWidth, 0, 7.4, SHOOTER_SHOP.z - 2, SHOOTER_SHOP.z + 1),
  // Its awning, and the two poles holding up its front edge.
  aabb(SHOOTER_SHOP.x - SHOOTER_SHOP.halfWidth - 0.4, SHOOTER_SHOP.x + SHOOTER_SHOP.halfWidth + 0.4, 7.4, 8.2, SHOOTER_SHOP.z - 3, SHOOTER_SHOP.z + 6),
  aabb(SHOOTER_SHOP.x - SHOOTER_SHOP.halfWidth, SHOOTER_SHOP.x - SHOOTER_SHOP.halfWidth + 0.5, 0, 7.4, SHOOTER_SHOP.z + 5, SHOOTER_SHOP.z + 5.5),
  aabb(SHOOTER_SHOP.x + SHOOTER_SHOP.halfWidth - 0.5, SHOOTER_SHOP.x + SHOOTER_SHOP.halfWidth, 0, 7.4, SHOOTER_SHOP.z + 5, SHOOTER_SHOP.z + 5.5),
  // The suit stage's flanking billboard posts.
  aabb(-48, -46, 0, 12, 34.5, 36.5),
  aabb(-48, -46, 0, 12, -36.5, -34.5),
];

// ------------------------------------------------------------------ Stages

/** The stage street: arenas one after another along +Z, each behind a portal. */
export const ARENA = {
  halfWidth: 44,
  length: 96,
  /** A gate wall between two arenas. */
  gateDepth: 8,
  firstStartZ: HUB.maxZ + HUB_FRONT_WALL_DEPTH,
  portalHalfWidth: 9,
  portalHeight: 14,
  wallHeight: 22,
} as const;

export const arenaStartZ = (stage: number): number => ARENA.firstStartZ + (stage - 1) * (ARENA.length + ARENA.gateDepth);
export const arenaEndZ = (stage: number): number => arenaStartZ(stage) + ARENA.length;
/** Centre z of the gate wall LEAVING a stage (into stage + 1). */
export const gateZ = (stage: number): number => arenaEndZ(stage) + ARENA.gateDepth / 2;

/**
 * THE ARENA FOREGROUND: six prop clusters per stage, hugging the side walls at
 * the entrance, the middle and the far end. Each is a solid footprint the
 * client fills with its theme's props (cars, crates, stalls...). They stay
 * clear of the portal lane, the Win and return pads and the enemy posts.
 */
export const ARENA_PROP_HEIGHT = 5;

export const arenaPropSpots = (stage: number): Aabb[] => {
  const start = arenaStartZ(stage);
  const end = arenaEndZ(stage);
  const mid = (start + end) / 2;
  const spots: Aabb[] = [];
  for (const side of [-1, 1]) {
    const inner = side * 36.5;
    const outer = side * ARENA.halfWidth;
    const minX = Math.min(inner, outer);
    const maxX = Math.max(inner, outer);
    spots.push(aabb(minX, maxX, 0, ARENA_PROP_HEIGHT, start + 2, start + 11));
    spots.push(aabb(minX, maxX, 0, ARENA_PROP_HEIGHT, mid - 5, mid + 5));
    spots.push(aabb(minX, maxX, 0, ARENA_PROP_HEIGHT, end - 12, end - 3));
  }
  return spots;
};

/** The Win pad of a stage: beside its forward gate. */
export const rewardPadOf = (stage: number): { x: number; z: number; half: number } => ({
  x: 24,
  z: arenaEndZ(stage) - 10,
  half: 4,
});

/** The Win platform's backdrop: an arch against the far wall, its two pillars solid. */
export const REWARD_ARCH = { halfSpan: 7, pillar: 0.7, depth: 2, height: 12 } as const;

export const rewardArchSolids = (stage: number): Aabb[] => {
  const pad = rewardPadOf(stage);
  const z1 = arenaEndZ(stage);
  return [-1, 1].map((side) => {
    const x = pad.x + side * REWARD_ARCH.halfSpan;
    return aabb(x - REWARD_ARCH.pillar, x + REWARD_ARCH.pillar, 0, REWARD_ARCH.height, z1 - REWARD_ARCH.depth, z1);
  });
};

/** The return pad of a stage: just inside its entrance, back to the spawn. */
export const returnPadOf = (stage: number): { x: number; z: number; half: number } => ({
  x: -24,
  z: arenaStartZ(stage) + 8,
  half: 3.5,
});

// ------------------------------------------------------------------ Solids

/**
 * Every STATIC solid in the world, as boxes. Stage gates are separate
 * (`gateBox`) because whether they are solid depends on the player.
 */
export const buildStaticSolids = (stageCount: number): Aabb[] => {
  const boxes: Aabb[] = [];
  const box = (minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number): void => {
    boxes.push({ minX, maxX, minY, maxY, minZ, maxZ });
  };

  // The plaza's city walls: back, both sides, and the front wall with the portal gap.
  box(HUB.minX - 30, HUB.maxX + 30, -2, 60, HUB.minZ - 30, HUB.minZ);
  box(HUB.minX - 30, HUB.minX, -2, 60, HUB.minZ, HUB.maxZ + HUB_FRONT_WALL_DEPTH);
  box(HUB.maxX, HUB.maxX + 30, -2, 60, HUB.minZ, HUB.maxZ + HUB_FRONT_WALL_DEPTH);
  box(HUB.minX, HUB_GATE.minX, -2, 40, HUB.maxZ, HUB.maxZ + HUB_FRONT_WALL_DEPTH);
  box(HUB_GATE.maxX, HUB.maxX, -2, 40, HUB.maxZ, HUB.maxZ + HUB_FRONT_WALL_DEPTH);
  box(HUB_GATE.minX, HUB_GATE.maxX, ARENA.portalHeight, 40, HUB.maxZ, HUB.maxZ + HUB_FRONT_WALL_DEPTH);

  // Suit stage: three storeys, the stairs, the back wall and end railings.
  for (const tier of SUIT_STAGE.tiers) box(tier.minX, tier.maxX, -1, tier.top, SUIT_STAGE.minZ, SUIT_STAGE.maxZ);
  for (const stair of SUIT_STAIRS) boxes.push(...stairBoxes(stair));
  box(SUIT_STAGE.backX - 3, SUIT_STAGE.backX, -1, 24, SUIT_STAGE.minZ - 3, SUIT_STAGE.maxZ + 3);
  for (const tier of SUIT_STAGE.tiers) {
    box(tier.minX, tier.maxX, tier.top, tier.top + 1.4, SUIT_STAGE.maxZ, SUIT_STAGE.maxZ + 1);
    box(tier.minX, tier.maxX, tier.top, tier.top + 1.4, SUIT_STAGE.minZ - 1, SUIT_STAGE.minZ);
  }

  // Training: the district floor and every miniature building.
  box(TRAINING.minX, TRAINING.maxX, -1, TRAINING.floorTop, TRAINING.minZ, TRAINING.maxZ);
  for (const building of BUILDINGS) boxes.push(...buildingSolids(building.tier));
  for (const piece of TRAINING_TOWN) boxes.push(townPieceSolid(piece));

  // Eggs: the platform and the egg pedestals.
  box(PETS_SHOP.minX, PETS_SHOP.maxX, -1, PETS_SHOP.floorTop, PETS_SHOP.minZ, PETS_SHOP.maxZ);
  for (const placement of EGG_PLACEMENTS) {
    const h = PETS_SHOP.pedestalHalf;
    box(placement.x - h, placement.x + h, PETS_SHOP.floorTop, PETS_SHOP.pedestalTop, PETS_SHOP.eggZ - h, PETS_SHOP.eggZ + h);
  }

  // Rooftops, and their water towers.
  for (const roof of ROOFTOPS) {
    box(roof.minX, roof.maxX, -1, roof.top, roof.minZ, roof.maxZ);
    if (roof.tower) {
      const h = WATER_TOWER.half;
      box(roof.tower.x - h, roof.tower.x + h, roof.top, roof.top + WATER_TOWER.height, roof.tower.z - h, roof.tower.z + h);
    }
  }

  // Planter trees and street lamps.
  for (const [x, z] of HUB_TREES) box(x - TREE_HALF, x + TREE_HALF, 0, 8, z - TREE_HALF, z + TREE_HALF);
  for (const [x, z] of HUB_LAMPS) box(x - LAMP_HALF, x + LAMP_HALF, 0, 9, z - LAMP_HALF, z + LAMP_HALF);

  boxes.push(...HUB_PROP_SOLIDS);

  // The stage street: walls down both sides, the gate walls, the end wall.
  const roadStart = HUB.maxZ;
  const roadEnd = arenaEndZ(stageCount) + 14;
  box(ARENA.halfWidth, ARENA.halfWidth + 30, -2, 60, roadStart, roadEnd);
  box(-ARENA.halfWidth - 30, -ARENA.halfWidth, -2, 60, roadStart, roadEnd);
  for (let stage = 1; stage < stageCount; stage += 1) {
    const z0 = arenaEndZ(stage);
    const z1 = z0 + ARENA.gateDepth;
    box(-ARENA.halfWidth, -ARENA.portalHalfWidth, -2, ARENA.wallHeight, z0, z1);
    box(ARENA.portalHalfWidth, ARENA.halfWidth, -2, ARENA.wallHeight, z0, z1);
    box(-ARENA.portalHalfWidth, ARENA.portalHalfWidth, ARENA.portalHeight, ARENA.wallHeight, z0, z1);
  }
  box(-ARENA.halfWidth, ARENA.halfWidth, -2, 60, arenaEndZ(stageCount), roadEnd);
  for (let stage = 1; stage <= stageCount; stage += 1) boxes.push(...arenaPropSpots(stage), ...rewardArchSolids(stage));

  return boxes;
};

/** The locked portal between stage `stage` and `stage + 1`: solid until the stage is cleared. */
export const gateBox = (stage: number): Aabb => {
  const z = gateZ(stage);
  return {
    minX: -ARENA.portalHalfWidth,
    maxX: ARENA.portalHalfWidth,
    minY: -2,
    // The whole gate, up to the wall top: a swinging player cannot vault a locked portal.
    maxY: ARENA.wallHeight,
    minZ: z - 1,
    maxZ: z + 1,
  };
};

/** The whole walkable world, for a hard clamp that no displacement can tunnel. */
export const worldBounds = (stageCount: number): Aabb => ({
  minX: HUB.minX,
  maxX: HUB.maxX,
  minY: -5,
  maxY: 200,
  minZ: HUB.minZ,
  maxZ: arenaEndZ(stageCount),
});

/**
 * THE CEILING over the stage street: a swinging player may not rise over the
 * arena walls into the next stage. Enforced by the shared sim as a height cap
 * that applies only on the street (z beyond the plaza's front wall).
 */
export const streetCeiling = (): number => ARENA.wallHeight - 0.5;

// --------------------------------------------------------------- Teleports

export type NamedTeleport = 'spawn' | 'suits' | 'training' | 'eggs' | 'shooters';
export type TeleportId = NamedTeleport | `stage${number}`;

export const TELEPORTS: Readonly<Record<NamedTeleport, Placement>> = {
  spawn: SPAWN,
  suits: { x: -30, y: 0, z: 0, yaw: -Math.PI / 2 },
  training: { x: 34, y: 0, z: 0, yaw: Math.PI / 2 },
  eggs: { x: 0, y: 0, z: -34, yaw: Math.PI },
  shooters: { x: SHOOTER_SHOP.x, y: 0, z: SHOOTER_SHOP.frontZ + 4, yaw: Math.PI },
};

export const stageEntry = (stage: number): Placement => ({ x: 0, y: 0, z: arenaStartZ(stage) + 5, yaw: 0 });

/** Which stage arena a point is in, or 0 for the plaza / a gate. */
export const stageAt = (z: number, stageCount: number): number => {
  for (let stage = 1; stage <= stageCount; stage += 1) {
    if (z >= arenaStartZ(stage) && z < arenaEndZ(stage)) return stage;
  }
  return 0;
};

export const inRect = (
  x: number,
  z: number,
  rect: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number },
): boolean => x >= rect.minX && x <= rect.maxX && z >= rect.minZ && z <= rect.maxZ;
