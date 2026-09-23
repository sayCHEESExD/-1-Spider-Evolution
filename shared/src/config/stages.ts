import { arenaStartZ } from './map.js';

/**
 * THE THIRTY STAGES down the street through the portal: New York
 * neighbourhoods overrun by Spider-Man's rogues. Each is an arena holding a
 * wave of henchmen and, from Stage 3 on, the villain himself. Defeating EVERY
 * enemy of a stage (its boss included) clears it:
 *
 *   - the clear opens the portal to the next stage for this run;
 *   - it arms the stage's Win pad, and standing on it banks the stage's Wins.
 *     NO Wins are ever paid before the wave is down.
 *
 * EVERY PLAYER FIGHTS THEIR OWN RUN (server CombatService): entering a stage
 * turns its whole wave on that player. Defeated enemies stay down for the rest
 * of the run. Back at the base - by a claim, a defeat or a respawn - the run
 * resets. A boss is SEALED until the rest of its wave is down.
 *
 * Damage dealt to an enemy is the player's Web Power, so `recommendedPower` is
 * the honest figure: at that Web Power a henchman falls in about six webs and
 * a boss in about forty. Enemy blows are in HEALTH points (a new player has
 * 100, +50 per rebirth): they grow 30% a stage, a boss hits three times as
 * hard, and defense gear takes its share off.
 */
export type StageTheme =
  | 'alley'
  | 'chinatown'
  | 'docks'
  | 'subway'
  | 'oscorp'
  | 'timessquare'
  | 'bridge'
  | 'park'
  | 'rooftops'
  | 'coney'
  | 'harbor'
  | 'alchemax'
  | 'warehouse'
  | 'hive'
  | 'ravencroft'
  | 'kingpin'
  | 'sinister'
  | 'goblin'
  | 'wallstreet'
  | 'eastriver'
  | 'grandcentral'
  | 'navyyard'
  | 'crypt'
  | 'foundry'
  | 'highline'
  | 'unplaza'
  | 'rockefeller'
  | 'clonelab'
  | 'liberty'
  | 'empirestate';

/** What an enemy looks like; the client builds it from this id. */
export type EnemyLook =
  | 'thug'
  | 'knifethug'
  | 'enforcer'
  | 'hammerhead'
  | 'lizardling'
  | 'lizard'
  | 'goblintrooper'
  | 'greengoblin'
  | 'sparkgoon'
  | 'electro'
  | 'rhinoguard'
  | 'rhino'
  | 'hunter'
  | 'kraven'
  | 'vulturedrone'
  | 'vulture'
  | 'illusion'
  | 'mysterio'
  | 'sandbrute'
  | 'sandman'
  | 'octobot'
  | 'docock'
  | 'handninja'
  | 'negative'
  | 'symbiote'
  | 'venom'
  | 'carnagespawn'
  | 'carnage'
  | 'kingpinguard'
  | 'kingpin'
  | 'sinistertrooper'
  | 'scorpion'
  | 'goblinelite'
  | 'redgoblin'
  | 'robber'
  | 'shocker'
  | 'waterclone'
  | 'hydroman'
  | 'crewman'
  | 'tombstone'
  | 'beetledrone'
  | 'beetle'
  | 'thrall'
  | 'morbius'
  | 'magmaling'
  | 'moltenman'
  | 'spotling'
  | 'spot'
  | 'double'
  | 'chameleon'
  | 'hobtrooper'
  | 'hobgoblin'
  | 'spiderclone'
  | 'jackal'
  | 'hound'
  | 'morlun'
  | 'slayerdrone'
  | 'spiderslayer';

export interface EnemyDef {
  /** Global id: the index into ENEMIES and the key of the replicated enemy. */
  readonly id: number;
  readonly stage: number;
  /** Bit of this enemy in its stage's kill mask. */
  readonly bit: number;
  readonly name: string;
  readonly look: EnemyLook;
  readonly boss: boolean;
  readonly maxHp: number;
  /** Health one of its blows takes from a player, before defense. */
  readonly damage: number;
  /** Home post: where it spawns, and where it walks back to. */
  readonly x: number;
  readonly z: number;
  /** Drawn size, relative to a player. */
  readonly scale: number;
  /** Walk speed, world units per second. */
  readonly speed: number;
  /** Radius the server tests a web against. */
  readonly radius: number;
  /** Seconds between its blows. */
  readonly swingSeconds: number;
}

export interface StageDef {
  readonly index: number;
  readonly name: string;
  readonly theme: StageTheme;
  readonly recommendedPower: number;
  /** Wins banked on the Win pad per clear. */
  readonly reward: number;
  readonly enemies: readonly EnemyDef[];
  /** Mask with every enemy's bit set: a full clear. */
  readonly fullMask: number;
  /** Mask of every non-boss enemy: what unseals the boss. */
  readonly waveMask: number;
  /** The start of the arena along the road. */
  readonly startZ: number;
}

type Wave = readonly (readonly [string, EnemyLook, number])[];

interface StagePlan {
  readonly name: string;
  readonly theme: StageTheme;
  readonly power: number;
  readonly reward: number;
  readonly wave: Wave;
  readonly boss?: readonly [string, EnemyLook, number?];
}

/** Henchmen take about six recommended-Power webs; a boss about forty. */
const HITS_PER_ENEMY = 6;
const HITS_PER_BOSS = 40;

/** A henchman's blow at Stage 1, in health points; it grows 30% a stage. A boss hits 3x. */
const ENEMY_DAMAGE = 6;
const ENEMY_DAMAGE_GROWTH = 1.3;
const BOSS_DAMAGE_FACTOR = 3;

export const enemyDamageFor = (stage: number): number => Math.round(ENEMY_DAMAGE * ENEMY_DAMAGE_GROWTH ** (Math.max(1, stage) - 1));
export const bossDamageFor = (stage: number): number => enemyDamageFor(stage) * BOSS_DAMAGE_FACTOR;

const K = 1_000;
const M = 1_000_000;
const B = 1_000_000_000;
const T = 1_000_000_000_000;
const Qa = 1e15;
const Qi = 1e18;
const Sx = 1e21;

const PLANS: readonly StagePlan[] = [
  { name: 'Queens Alley', theme: 'alley', power: 60, reward: 1, wave: [['Goblin Gang Punk', 'thug', 3]] },
  { name: 'Chinatown Market', theme: 'chinatown', power: 300, reward: 3, wave: [['Goblin Gang Punk', 'thug', 2], ['Inner Demon', 'knifethug', 2]] },
  { name: "Hell's Kitchen Docks", theme: 'docks', power: 1.5 * K, reward: 10, wave: [['Maggia Mobster', 'enforcer', 4]], boss: ['Hammerhead', 'hammerhead', 2.3] },
  { name: 'Subway Tunnels', theme: 'subway', power: 8 * K, reward: 25, wave: [['Lizard Spawn', 'lizardling', 5]], boss: ['The Lizard', 'lizard', 2.6] },
  { name: 'Oscorp Labs', theme: 'oscorp', power: 40 * K, reward: 100, wave: [['Goblin Trooper', 'goblintrooper', 5]], boss: ['Green Goblin', 'greengoblin', 2.4] },
  { name: 'Times Square', theme: 'timessquare', power: 200 * K, reward: 800, wave: [["Electro's Spark Goon", 'sparkgoon', 6]], boss: ['Electro', 'electro', 2.4] },
  { name: 'Brooklyn Bridge', theme: 'bridge', power: 1 * M, reward: 3 * K, wave: [['Rhino Guard', 'rhinoguard', 6]], boss: ['Rhino', 'rhino', 2.9] },
  { name: 'Central Park', theme: 'park', power: 5 * M, reward: 12 * K, wave: [["Kraven's Hunter", 'hunter', 6]], boss: ['Kraven', 'kraven', 2.4] },
  { name: 'Midtown Rooftops', theme: 'rooftops', power: 25 * M, reward: 50 * K, wave: [['Vulture Drone', 'vulturedrone', 7]], boss: ['Vulture', 'vulture', 2.4] },
  { name: 'Coney Island', theme: 'coney', power: 125 * M, reward: 200 * K, wave: [['Illusion Clone', 'illusion', 7]], boss: ['Mysterio', 'mysterio', 2.5] },
  { name: 'Sandstorm Harbor', theme: 'harbor', power: 600 * M, reward: 900 * K, wave: [['Sand Brute', 'sandbrute', 7]], boss: ['Sandman', 'sandman', 3] },
  { name: 'Alchemax Tower', theme: 'alchemax', power: 3 * B, reward: 4 * M, wave: [['Octobot', 'octobot', 8]], boss: ['Doctor Octopus', 'docock', 2.5] },
  { name: 'Chelsea Warehouse', theme: 'warehouse', power: 15 * B, reward: 18 * M, wave: [['Hand Ninja', 'handninja', 8]], boss: ['Mister Negative', 'negative', 2.4] },
  { name: 'Symbiote Hive', theme: 'hive', power: 75 * B, reward: 80 * M, wave: [['Symbiote', 'symbiote', 8]], boss: ['Venom', 'venom', 2.9] },
  { name: 'Ravencroft', theme: 'ravencroft', power: 375 * B, reward: 350 * M, wave: [['Carnage Spawn', 'carnagespawn', 9]], boss: ['Carnage', 'carnage', 2.7] },
  { name: 'Kingpin Tower', theme: 'kingpin', power: 1.8 * T, reward: 1.5 * B, wave: [['Kingpin Guard', 'kingpinguard', 9]], boss: ['Kingpin', 'kingpin', 3] },
  { name: 'Sinister Six HQ', theme: 'sinister', power: 9 * T, reward: 6.5 * B, wave: [['Sinister Trooper', 'sinistertrooper', 10]], boss: ['Scorpion', 'scorpion', 2.7] },
  { name: 'Goblin Nation', theme: 'goblin', power: 45 * T, reward: 30 * B, wave: [['Goblin Elite', 'goblinelite', 10]], boss: ['Red Goblin', 'redgoblin', 2.8] },
  // Past the Goblin: Web Power x5 a stage, Wins x4.5, as before.
  { name: 'Wall Street', theme: 'wallstreet', power: 225 * T, reward: 135 * B, wave: [['Vault Robber', 'robber', 10]], boss: ['Shocker', 'shocker', 2.6] },
  { name: 'East River Pier', theme: 'eastriver', power: 1.1 * Qa, reward: 600 * B, wave: [['Water Clone', 'waterclone', 10]], boss: ['Hydro-Man', 'hydroman', 3] },
  { name: 'Grand Central Terminal', theme: 'grandcentral', power: 5.6 * Qa, reward: 2.7 * T, wave: [['Tombstone Crew', 'crewman', 10]], boss: ['Tombstone', 'tombstone', 2.8] },
  { name: 'Brooklyn Navy Yard', theme: 'navyyard', power: 28 * Qa, reward: 12 * T, wave: [['Beetle Drone', 'beetledrone', 10]], boss: ['Beetle', 'beetle', 2.8] },
  { name: 'Trinity Churchyard', theme: 'crypt', power: 140 * Qa, reward: 55 * T, wave: [['Vampire Thrall', 'thrall', 10]], boss: ['Morbius', 'morbius', 2.6] },
  { name: 'Queens Steelworks', theme: 'foundry', power: 700 * Qa, reward: 250 * T, wave: [['Magma Golem', 'magmaling', 10]], boss: ['Molten Man', 'moltenman', 3] },
  { name: 'The High Line', theme: 'highline', power: 3.5 * Qi, reward: 1.1 * Qa, wave: [['Portal Phantom', 'spotling', 10]], boss: ['The Spot', 'spot', 2.7] },
  { name: 'United Nations Plaza', theme: 'unplaza', power: 17.5 * Qi, reward: 5 * Qa, wave: [['Chameleon Double', 'double', 10]], boss: ['Chameleon', 'chameleon', 2.6] },
  { name: 'Rockefeller Center', theme: 'rockefeller', power: 88 * Qi, reward: 22 * Qa, wave: [['Hob Trooper', 'hobtrooper', 10]], boss: ['Hobgoblin', 'hobgoblin', 2.8] },
  { name: "Jackal's Clone Lab", theme: 'clonelab', power: 440 * Qi, reward: 100 * Qa, wave: [['Spider Clone', 'spiderclone', 10]], boss: ['Jackal', 'jackal', 2.7] },
  { name: 'Liberty Island', theme: 'liberty', power: 2.2 * Sx, reward: 450 * Qa, wave: [['Inheritor Hound', 'hound', 10]], boss: ['Morlun', 'morlun', 3] },
  { name: 'Empire State Summit', theme: 'empirestate', power: 11 * Sx, reward: 2 * Qi, wave: [['Slayer Drone', 'slayerdrone', 10]], boss: ['Spider-Slayer', 'spiderslayer', 3.4] },
];

/** Where the wave stands, relative to the arena's centre: spread out, never in a file. */
const POSTS: readonly (readonly [number, number])[] = [
  [-14, -12],
  [14, -12],
  [0, -4],
  [-22, 2],
  [22, 2],
  [-9, 10],
  [9, 10],
  [0, 20],
  [-26, 18],
  [26, 18],
  [-17, 26],
  [17, 26],
];
const BOSS_POST: readonly [number, number] = [0, 34];

const build = (): { stages: StageDef[]; enemies: EnemyDef[] } => {
  const stages: StageDef[] = [];
  const enemies: EnemyDef[] = [];
  PLANS.forEach((plan, index) => {
    const stage = index + 1;
    const centreZ = arenaStartZ(stage) + 40;
    const list: EnemyDef[] = [];
    // Later stages are quicker and hit more often, not just harder: the first eighteen
    // ramp to full pace, and past them every stage adds a little more.
    const pace = stage <= 18 ? stage / 18 : 1 + (stage - 18) * 0.025;
    let bit = 0;
    for (const [name, look, count] of plan.wave) {
      for (let i = 0; i < count; i += 1) {
        const post = POSTS[bit % POSTS.length]!;
        list.push({
          id: enemies.length + list.length,
          stage,
          bit,
          name,
          look,
          boss: false,
          maxHp: Math.round(plan.power * HITS_PER_ENEMY),
          damage: enemyDamageFor(stage),
          x: post[0],
          z: centreZ + post[1],
          scale: look === 'octobot' || look === 'vulturedrone' || look === 'beetledrone' ? 0.9 : look === 'hound' ? 0.85 : 1,
          speed: 6.5 + pace * 5,
          radius: 1.2,
          swingSeconds: 1.35 - pace * 0.45,
        });
        bit += 1;
      }
    }
    const waveMask = (1 << bit) - 1;
    if (plan.boss) {
      const scale = plan.boss[2] ?? 2.5;
      list.push({
        id: enemies.length + list.length,
        stage,
        bit,
        name: plan.boss[0],
        look: plan.boss[1],
        boss: true,
        maxHp: Math.round(plan.power * HITS_PER_BOSS),
        damage: bossDamageFor(stage),
        x: BOSS_POST[0],
        z: centreZ + BOSS_POST[1],
        scale,
        speed: 5.5 + pace * 3,
        radius: 1.1 * scale,
        swingSeconds: 1.8 - pace * 0.5,
      });
      bit += 1;
    }
    enemies.push(...list);
    stages.push({
      index: stage,
      name: plan.name,
      theme: plan.theme,
      recommendedPower: plan.power,
      reward: plan.reward,
      enemies: list,
      fullMask: (1 << bit) - 1,
      waveMask,
      startZ: arenaStartZ(stage),
    });
  });
  return { stages, enemies };
};

const BUILT = build();

export const STAGES: readonly StageDef[] = BUILT.stages;
export const ENEMIES: readonly EnemyDef[] = BUILT.enemies;
export const STAGE_COUNT = STAGES.length;

export const stageByIndex = (index: number): StageDef | undefined => STAGES[Math.floor(index) - 1];

/** Enemy behaviour, in world units. */
export const ENEMY_AI = {
  /** How close an enemy walks to its target before it swings. */
  reach: 2.6,
  /** A boss's blow lands on its target within this of it (a ground slam). */
  bossSlamRadius: 5,
  /** A player this far above the street is out of every enemy's reach. */
  maxStrikeHeight: 5,
} as const;
