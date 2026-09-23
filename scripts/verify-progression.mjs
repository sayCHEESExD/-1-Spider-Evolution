/**
 * The progression rules, exercised in-process against the server's own
 * services.
 *
 * Every figure the specification pins down is asserted exactly: the suits'
 * per-click and Trophy prices, the web shooters, the training buildings'
 * multipliers and rebirth gates, the rebirth ladder (1x/100 HP at Level 8,
 * 2x/150 HP, 3x/200 HP at Level 12), the stages' Wins, the six eggs, the
 * inventories, and the example target (Level 6: 11.3K XP to the next level,
 * Speed 22, 2 swings, ~26+ per click). Then the services are driven through
 * everything a client can reach - including every refusal and the obvious
 * exploits - so "the server decides" is proven, not claimed.
 *
 * Run after `npm run build:server`.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A throwaway data directory: the persistence round-trip below must never touch real profiles.
process.env.SPIDER_DATA_DIR = mkdtempSync(join(tmpdir(), 'spider-progression-'));

const S = await import('../shared/dist/index.js');
const { PlayerState, PetState } = await import('../server/dist/rooms/state/PlayerState.js');
const { CombatService } = await import('../server/dist/progression/CombatService.js');
const { GearService } = await import('../server/dist/progression/GearService.js');
const { PetService } = await import('../server/dist/progression/PetService.js');
const { ProgressionService } = await import('../server/dist/progression/ProgressionService.js');
const { RebirthService } = await import('../server/dist/progression/RebirthService.js');
const { ShooterService } = await import('../server/dist/progression/ShooterService.js');
const { StageService } = await import('../server/dist/progression/StageService.js');
const { SuitService } = await import('../server/dist/progression/SuitService.js');
const { MovementService } = await import('../server/dist/movement/MovementService.js');
const { profileStore } = await import('../server/dist/progression/ProfileStore.js');

let failures = 0;
const check = (condition, message) => {
  if (condition) console.log(`  ok    ${message}`);
  else {
    failures += 1;
    console.log(`  FAIL  ${message}`);
  }
};

let clockOffset = 0;
const realNow = Date.now;
Date.now = () => realNow() + clockOffset;
const later = (ms = 1000) => {
  clockOffset += ms;
};

const progression = new ProgressionService();
const fresh = (id = 'p1') => {
  const player = new PlayerState();
  player.sessionId = id;
  progression.initialise(player);
  return player;
};
const place = (player, x, z, y = 0, grounded = true) => {
  player.x = x;
  player.y = y;
  player.z = z;
  player.grounded = grounded;
};
const K = 1_000;
const M = 1_000_000;
const B = 1_000_000_000;

console.log('\nStarting values');
{
  const p = fresh();
  check(p.webPower === 0 && p.xp === 0 && p.level === 1, 'a new player holds 0 Web Power and 0 XP at Level 1');
  check(p.gainPerClick === 1, 'the Classic Suit pays +1 per click');
  check(p.suitSlot === 1 && p.ownedSuits === 1 && p.shooterId === 1 && p.ownedShooters === 1, 'the Classic Suit and Classic Shooter are owned and worn');
  check(p.maxHealth === 100 && p.health === 100, 'Rebirth 0: 100 HP');
  check(p.maxSwings === 2, 'two web swings to start');
  check(p.moveSpeed === 17, 'Level 1 runs at Speed 17');
}

console.log('\nThe specification tables');
{
  const suits = [
    [1, 0], [2, 1], [5, 3], [12, 10], [25, 25], [50, 100], [125, 500], [250, 2 * K], [500, 7.5 * K], [1 * K, 200 * K],
    [5 * K, 850 * K], [12.5 * K, 1.8 * M], [25 * K, 5 * M], [45 * K, 25 * M], [90 * K, 150 * M], [150 * K, 500 * M],
    [400 * K, 1 * B], [1.25 * M, 5 * B], [3 * M, 40 * B],
  ];
  check(S.SUIT_COUNT === 19 && suits.every(([click, cost], i) => S.SUITS[i]?.perClick === click && S.SUITS[i].cost === cost), 'all 19 suits: +1/0 ... +3M/40B, in order');
  check(new Set(S.SUITS.map((suit) => suit.name)).size === 19, 'every suit is its own distinct suit');
  const shooters = [['Classic Shooter', 1, 0], ['Fire Shooter', 1.25, 500], ['Classic Red Shooter', 1.5, 4_500]];
  check(shooters.every(([name, mult, cost], i) => S.SHOOTERS[i]?.name === name && S.SHOOTERS[i].multiplier === mult && S.SHOOTERS[i].cost === cost), 'web shooters: Classic 1x, Fire 1.25x / 500, Classic Red 1.5x / 4.5K');
  const training = [[1, 0], [2, 1], [5, 3], [10, 5], [50, 15], [100, 45]];
  check(training.every(([mult, rebirths], i) => S.TRAINING_TIERS[i]?.multiplier === mult && S.TRAINING_TIERS[i].rebirthsRequired === rebirths), 'training: 1x/0, 2x/1, 5x/3, 10x/5, 50x/15, 100x/45 rebirths');
  check(S.rebirthRequiredLevel(0) === 8 && S.rebirthRequiredLevel(1) === 12 && S.rebirthRequiredLevel(2) === 12, 'rebirth needs Level 8, then 12, then 12');
  check(S.rebirthMultiplier(0) === 1 && S.rebirthMultiplier(1) === 2 && S.rebirthMultiplier(2) === 3, 'rebirth XP: 1x, 2x, 3x');
  check(S.rebirthHealth(0) === 100 && S.rebirthHealth(1) === 150 && S.rebirthHealth(2) === 200, 'rebirth health: 100, 150, 200');
  let climbs = true;
  for (let r = 1; r < 60; r += 1) if (S.rebirthRequiredLevel(r + 1) < S.rebirthRequiredLevel(r) || S.rebirthHealth(r + 1) !== S.rebirthHealth(r) + 50) climbs = false;
  check(climbs, 'the ladder continues cleanly: never easier, +50 HP and +1x a rebirth');
  const wins = [1, 3, 10, 25, 100, 800];
  check(wins.every((w, i) => S.STAGES[i]?.reward === w), 'stage Wins: 1, 3, 10, 25, 100, 800');
  check(S.STAGES.every((stage, i) => i === 0 || (stage.reward > S.STAGES[i - 1].reward && stage.recommendedPower > S.STAGES[i - 1].recommendedPower)), 'later stages always ask for more and pay more');
  const eggs = [['Venom Egg', 400], ['Fire Egg', 12 * K], ['Arcane Egg', 225 * K], ['Astral Egg', 6.5 * M], ['Demonic Egg', 200 * M], ['Cyber Egg', 2.5 * B]];
  check(eggs.every(([name, cost], i) => S.EGGS[i]?.name === name && S.EGGS[i].cost === cost), 'eggs: Venom 400, Fire 12K, Arcane 225K, Astral 6.5M, Demonic 200M, Cyber 2.5B');
  check(S.EGGS.every((egg) => egg.pool.length === 4 && egg.pool.reduce((sum, [, chance]) => sum + chance, 0) === 100 && new Set(egg.pool.map(([id]) => S.petById(id)?.rarity)).size === 4), 'each egg holds 4 pets of 4 rarities, odds summing to 100%');
  check(S.PET_INVENTORY_MAX === 30 && S.PET_EQUIP_MAX === 3, 'pets: 30 slots, 3 equipped');
  check(S.GEAR_INVENTORY_MAX === 30 && S.GEAR_EQUIP_MAX === 3, 'gear: 30 slots, 3 equipped');
  const required = ['Speed Rune', 'Health Rune', 'Defense Rune', 'Goblin Mask', "Green Goblin's Glider"];
  check(required.every((name) => S.GEAR.some((gear) => gear.name === name)) && S.GEAR.length > required.length, 'gear includes the five named pieces and more Spider-Man gear');
  check(S.GEAR.filter((gear) => gear.mount !== 'rune').every((gear) => ['head', 'back', 'chest'].includes(gear.mount)), 'every non-rune piece is worn on the head, back or chest');
}

console.log('\nThe example target: Level 6');
{
  check(S.xpToNext(6) === 11_328 && S.formatAmount(S.xpToNext(6)) === '11.3K', 'Level 6 needs 11.3K XP to Level 7');
  check(S.moveSpeedFor(6) === 22, 'Level 6 runs at Speed 22');
  check(S.maxSwingsFor(0) === 2, '2 swings');
  const inputs = { suitSlot: 5, ownedSuits: 31, shooterId: 1, ownedShooters: 1, rebirths: 0, equippedPetIds: [1], gearPower: 0 };
  const gain = S.gainPerClick(inputs);
  check(gain >= 26 && gain <= 30, `~26+ per click with the Iron Spider and a common pet (${gain})`);
  check(S.levelForXp(S.xpForLevel(6) + 5_550).level === 6, 'the level is read straight off the XP');
  check(S.maxSwingsFor(3) === 3 && S.maxSwingsFor(6) === 4 && S.maxSwingsFor(99) === S.MAX_SWINGS, 'swings unlock every third rebirth, capped');
}

console.log('\nWeb clicks pay Web Power and XP; running pays a little XP');
{
  const combat = new CombatService();
  combat.bind(progression);
  const p = fresh('webber');
  const out = combat.attack('webber', p, -1, progression);
  check(out.ok && out.gain === 1 && p.webPower === 1 && p.xp === 1, 'a web into the air pays +1 Web Power and +1 XP');
  const results = [];
  for (let i = 0; i < 6; i += 1) results.push(combat.attack('webber', p, -1, progression).ok);
  check(results.filter(Boolean).length === 2, 'the rate limit holds: a burst of 3, then refusals (an auto-clicker gains nothing past it)');
  later(1000);
  check(combat.attack('webber', p, -1, progression).ok, 'the bucket refills with time');
  const before = { power: p.webPower, xp: p.xp };
  progression.creditRun(p, 5);
  progression.creditRun(p, 5);
  check(p.webPower === before.power && p.xp === before.xp + 1, 'running 10 units pays 1 XP and no Web Power');
  progression.creditRun(p, 1e9);
  check(p.xp <= before.xp + 2, 'a teleport-sized "stride" is capped: distance is never trusted beyond a step');
}

console.log('\nTraining buildings');
{
  const combat = new CombatService();
  combat.bind(progression);
  const p = fresh('trainer');
  const b0 = S.BUILDINGS[0];
  const b1 = S.BUILDINGS[1];
  place(p, b0.padX, b0.padZ, S.TRAINING.floorTop);
  const hit = combat.attack('trainer', p, S.buildingTarget(0), progression);
  check(hit.ok && hit.target === S.buildingTarget(0) && hit.gain === 1, 'Queens Tower (1x) is webbed from its pad');
  later(1000);
  place(p, b1.padX, b1.padZ, S.TRAINING.floorTop);
  const locked = combat.attack('trainer', p, S.buildingTarget(1), progression);
  check(locked.ok && locked.target !== S.buildingTarget(1) && locked.gain === 1 && locked.note === 'locked-building', 'the Daily Bugle (2x) refuses a player without a rebirth (and says so)');
  later(1000);
  place(p, 0, 0);
  const far = combat.attack('trainer', p, S.buildingTarget(0), progression);
  check(far.ok && far.target === -1, 'a building out of web range is not hit, whatever the client names');
  p.rebirths = 1;
  progression.syncDerived(p);
  later(1000);
  place(p, b1.padX, b1.padZ, S.TRAINING.floorTop);
  const unlocked = combat.attack('trainer', p, S.buildingTarget(1), progression);
  check(unlocked.ok && unlocked.target === S.buildingTarget(1) && unlocked.gain === 4, 'with 1 rebirth the Bugle pays 2x (x2 rebirth XP): +4');
}

console.log('\nSuits');
{
  const suits = new SuitService();
  const p = fresh('suiter');
  check(!suits.select(p, 2, progression).ok, 'no Trophies: the Homemade Suit is refused');
  p.wins = 3;
  const pad = S.SUIT_PADS[1];
  place(p, 0, 0);
  check(suits.pad(p, 2, progression).reason === 'not-on-pad', 'a pad request from across the map is refused');
  place(p, pad.x, pad.z, pad.y);
  const bought = suits.pad(p, 2, progression);
  check(bought.ok && bought.action === 'bought' && p.wins === 2 && p.suitSlot === 2 && p.gainPerClick === 2, 'standing on the pad buys and wears it: 1 Trophy spent, +2 per click');
  check(!suits.select(p, 2, progression).ok, 'buying it twice is impossible');
  check(suits.select(p, 1, progression).ok && p.suitSlot === 1 && p.wins === 2, 'an owned suit is worn free');
  check(!suits.select(p, 99, progression).ok && !suits.select(p, 'x', progression).ok, 'unknown suits are refused');
}

console.log('\nWeb shooters');
{
  const shooters = new ShooterService();
  const p = fresh('shooter');
  p.wins = 600;
  place(p, 0, 0);
  check(shooters.select(p, 2, progression).reason === 'away', 'a shooter cannot be bought away from the stand');
  place(p, S.SHOOTER_SHOP.x, S.SHOOTER_SHOP.frontZ);
  check(shooters.select(p, 3, progression).reason === 'too-few-wins', 'the Classic Red Shooter needs 4.5K Trophies');
  const bought = shooters.select(p, 2, progression);
  check(bought.ok && p.wins === 100 && p.shooterId === 2 && p.multiplier === 1.25, 'the Fire Shooter is bought at the stand: 500 spent, 1.25x');
  place(p, 0, 0);
  check(shooters.select(p, 1, progression).ok && p.shooterId === 1, 'an owned shooter is equipped anywhere');
  check(shooters.select(p, 2, progression).ok && p.wins === 100, 're-equipping never charges again');
}

console.log('\nRebirth');
{
  const rebirths = new RebirthService();
  const pets = new PetService();
  const p = fresh('reborn');
  p.xp = S.xpForLevel(7);
  progression.syncDerived(p);
  check(!rebirths.rebirth(p, progression).ok, 'Level 7 cannot rebirth');
  p.xp = S.xpForLevel(8);
  p.webPower = 50_000;
  p.wins = 900;
  p.ownedSuits = 0b11111;
  p.suitSlot = 5;
  p.ownedShooters = 0b11;
  p.shooterId = 2;
  p.bestStage = 4;
  const pet = new PetState();
  pet.uid = 1;
  pet.petId = 1;
  pet.equipped = true;
  p.pets.push(pet);
  progression.syncDerived(p);
  check(p.level === 8, 'Level 8 reached');
  const result = rebirths.rebirth(p, progression);
  check(result.ok && p.rebirths === 1, 'Level 8 rebirths into Rebirth 1');
  check(p.webPower === 0 && p.xp === 0 && p.level === 1 && p.wins === 0, 'Web Power, XP (the level) and Wins are reset');
  check(p.ownedSuits === 1 && p.suitSlot === 1, 'suits are reset to the Classic Suit');
  check(p.pets.length === 1 && p.ownedShooters === 0b11 && p.shooterId === 2 && p.bestStage === 4, 'pets, shooters and the stage record are kept');
  check(p.maxHealth === 150 && p.health === 150, 'Rebirth 1: 150 HP');
  check(p.gainPerClick === Math.floor(1 * 1.25 * 1.1 * 2), 'Rebirth 1 doubles every click');
  check(!rebirths.rebirth(p, progression).ok, 'rebirthing again at once is refused (needs Level 12)');
  pets.normalise(p);
}

console.log('\nStages: the run, the boss, the clear and the claim');
{
  const combat = new CombatService();
  combat.bind(progression);
  const stages = new StageService();
  const p = fresh('runner');
  check(p.enemies.length === S.ENEMIES.length, 'every player owns the whole enemy pool (fixed, indexed by id)');
  combat.resetRun(p);
  const s1 = S.stageByIndex(1);
  check(s1.enemies.every((e) => p.enemies[e.id].alive && p.enemies[e.id].hp === e.maxHp), 'a new run: Stage 1 at its posts, at full health');
  const reward = S.rewardPadOf(1);
  place(p, reward.x, reward.z);
  check(!stages.claim('runner', p, 1).granted, 'no claim before the wave is down');
  p.webPower = 1e9;
  let kills = 0;
  for (const def of s1.enemies) {
    const enemy = p.enemies[def.id];
    place(p, enemy.x, enemy.z - 4);
    later(1000);
    const hit = combat.attack('runner', p, def.id, progression);
    if (hit.killed) kills += 1;
  }
  check(kills === s1.enemies.length && p.killMasks[0] === s1.fullMask && p.runStage === 1, 'every villain down: Stage 1 cleared, its portal open');
  check(p.totalDamage === s1.enemies.reduce((sum, e) => sum + e.maxHp, 0), 'the damage board counts health taken, never overkill');
  place(p, 0, 0);
  later(1000);
  check(!stages.claim('runner', p, 1).granted, 'a claim away from the Win pad is refused');
  place(p, reward.x, reward.z);
  const claim = stages.claim('runner', p, 1);
  check(claim.granted && claim.wins === 1 && p.wins === 1, 'standing on the Win pad banks Stage 1: +1 Win');
  later(1000);
  check(!stages.claim('runner', p, 1).granted && p.wins === 1, 'a second claim pays nothing (the clear is spent)');

  const s3 = S.stageByIndex(3);
  combat.startRunAt(p, 3);
  check(p.runStage === 2 && S.stageByIndex(1).enemies.every((e) => !p.enemies[e.id].alive), 'a stage teleport opens the stages before it and empties them');
  const boss = s3.enemies.find((e) => e.boss);
  place(p, boss.x, boss.z - 3);
  later(1000);
  const sealed = combat.attack('runner', p, boss.id, progression);
  check(sealed.ok && sealed.target !== boss.id, `${boss.name} is sealed until the wave is down`);
  const s5 = S.stageByIndex(5).enemies[0];
  place(p, s5.x, s5.z - 3);
  later(1000);
  check(combat.attack('runner', p, s5.id, progression).target !== s5.id, 'a villain beyond the open portals cannot be webbed');
}

console.log('\nSwing lock-on: webs reach further from the air');
{
  const combat = new CombatService();
  combat.bind(progression);
  const p = fresh('swinger');
  combat.resetRun(p);
  const def = S.stageByIndex(1).enemies[0];
  const enemy = p.enemies[def.id];
  const gap = S.COMBAT.reach + S.COMBAT.reachSlack + def.radius + 4;
  place(p, enemy.x, enemy.z - gap, 0, true);
  later(1000);
  check(combat.attack('swinger', p, def.id, progression).target !== def.id, `on the street, a villain ${gap.toFixed(0)} units off is out of web range`);
  place(p, enemy.x, enemy.z - gap, 9, false);
  later(1000);
  const locked = combat.attack('swinger', p, -1, progression);
  check(locked.target === def.id && locked.damage > 0, 'swinging overhead, the same web locks onto it with no target named (auto-click lock-on)');
  place(p, enemy.x, enemy.z - gap, 40, false);
  later(1000);
  check(combat.attack('swinger', p, def.id, progression).target !== def.id, 'but never from impossibly high');
}

console.log('\nEnemies fight back, through defense');
{
  const combat = new CombatService();
  combat.bind(progression);
  const p = fresh('victim');
  combat.resetRun(p);
  const def = S.stageByIndex(1).enemies[0];
  place(p, def.x, def.z + 1.5);
  for (let i = 0; i < 60; i += 1) combat.tick(0.05, [p]);
  check(p.health < 100, `a Goblin Gang Punk's blows land (health ${Math.round(p.health)})`);
  const q = fresh('floating');
  combat.resetRun(q);
  place(q, def.x, def.z + 1.5, 12, false);
  for (let i = 0; i < 60; i += 1) combat.tick(0.05, [q]);
  check(q.health === 100, 'a player swinging high over the street is out of reach');
  check(S.damageAfterDefense(100, 30) === 70 && S.damageAfterDefense(100, 999) === 5, 'defense takes its share off, capped');
}

console.log('\nGear: drops, equip rules, stats');
{
  const gear = new GearService();
  const p = fresh('looter');
  let drops = 0;
  for (let i = 0; i < 40; i += 1) if (gear.rollDrop(p, 3, true)) drops += 1;
  check(drops === 40 && p.gear.length === 30, 'a boss always drops; the bag holds 30');
  const lost = gear.rollDrop(p, 3, true);
  check(lost && lost.uid === 0 && p.gear.length === 30, 'a drop into a full bag is lost, not squeezed in');
  p.gear.clear();
  // A known bag: two head pieces, a glider, two runes.
  const { GearState } = await import('../server/dist/rooms/state/PlayerState.js');
  const put = (gearId, rarity) => {
    const state = new GearState();
    state.uid = p.nextGearUid++;
    state.gearId = gearId;
    state.rarity = rarity;
    p.gear.push(state);
    return state.uid;
  };
  const mask = put(5, 0);
  const helmet = put(9, 3);
  const glider = put(6, 1);
  const speed = put(1, 2);
  const power = put(4, 3);
  check(gear.act(p, 'equip', mask, progression).ok, 'the Goblin Mask is equipped');
  check(gear.act(p, 'equip', helmet, progression).reason === 'mount-taken', 'a second head piece is refused (one mask at a time)');
  check(gear.act(p, 'equip', glider, progression).ok && gear.act(p, 'equip', speed, progression).ok, 'the Glider and a rune go on');
  check(gear.act(p, 'equip', power, progression).reason === 'slots-full', 'a fourth piece is refused (3 equipped)');
  const totals = S.gearTotals([{ gearId: 5, rarity: 0 }, { gearId: 6, rarity: 1 }, { gearId: 1, rarity: 2 }]);
  check(p.moveSpeed === S.moveSpeedFor(p.level, totals.speed) && p.moveSpeed > 17, `gear speed raises the run speed (${p.moveSpeed})`);
  check(p.maxHealth === Math.floor(100 * (1 + totals.health / 100)), 'gear health raises max health');
  check(p.gainPerClick === Math.max(1, Math.floor(1 * (1 + totals.power / 100))), 'gear power multiplies the click');
  check(gear.act(p, 'equipBest', 0, progression).ok, 'Equip Best runs');
  const worn = p.gear.filter((piece) => piece.equipped);
  const mounts = worn.map((piece) => S.gearById(piece.gearId).mount).filter((mount) => mount !== 'rune');
  check(worn.length === 3 && new Set(mounts).size === mounts.length, 'Equip Best picks 3 and never two on one mount');
  check(worn.some((piece) => piece.uid === helmet) && worn.some((piece) => piece.uid === power), 'Equip Best prefers the legendary pieces');
  check(gear.act(p, 'delete', mask, progression).ok && !p.gear.some((piece) => piece.uid === mask), 'Delete removes a piece');
  check(!gear.act(p, 'equip', 999, progression).ok, 'an unknown uid is refused');
}

console.log('\nPets and eggs');
{
  const pets = new PetService();
  const p = fresh('hatcher');
  const venom = S.EGG_PLACEMENTS[0];
  place(p, venom.x, S.PETS_SHOP.padZ);
  check(pets.hatch(p, 1, 1, progression).reason === 'too-few-wins', 'the Venom Egg needs 400 Trophies');
  p.wins = 1_200;
  place(p, 0, 0);
  check(pets.hatch(p, 1, 1, progression).reason === 'away', 'hatching needs the player at the egg');
  place(p, venom.x, S.PETS_SHOP.padZ);
  const hatch = pets.hatch(p, 1, 3, progression);
  check(hatch.ok && hatch.pets.length === 3 && p.wins === 0 && p.pets.length === 3, 'three Venom Eggs hatch for 1,200');
  check(p.pets.every((pet) => pet.equipped) && p.multiplier > 1, 'new pets fill the free slots and raise the click multiplier');
  p.wins = 1e12;
  for (let i = 0; i < 12; i += 1) pets.hatch(p, 1, 3, progression);
  check(p.pets.length === 30, 'the pet inventory stops at 30');
  check(pets.hatch(p, 1, 1, progression).reason === 'full', 'a full inventory refuses the hatch before charging');
  check(pets.act(p, 'equipBest', 0, progression).ok && p.pets.filter((pet) => pet.equipped).length === 3, 'Equip Best keeps 3 equipped');
  const extra = p.pets.find((pet) => !pet.equipped);
  check(pets.act(p, 'equip', extra.uid, progression).reason === 'slots-full', 'a fourth pet is refused');
}

console.log('\nThe web swing (shared simulation)');
{
  const collision = new S.WorldCollision();
  const m = S.createMotion();
  const params = S.createSimParams();
  params.moveSpeed = 22;
  params.maxSwings = 2;
  const e = S.createSimEvents();
  const step = (jump, n = 1) => {
    for (let i = 0; i < n; i += 1) S.stepPlayer(m, { moveX: 0, moveZ: 1, jump, cameraYaw: Math.PI }, params, 1 / 60, collision, e);
  };
  step(false, 5);
  check(m.swingsLeft === 2, 'standing: 2 swings ready');
  step(true);
  step(false, 12);
  check(!m.grounded && !m.swinging, 'the first press jumps');
  step(true);
  check(m.swinging && m.swingsLeft === 1, 'a press in mid-air catches a web (1 swing left)');
  step(false, 60);
  step(true);
  step(false);
  const second = m.swingCount === 2;
  step(false, 30);
  step(true);
  step(false);
  check(second && m.swingCount === 2 && m.swingsLeft === 0, 'the second swing uses the last; a third press does nothing');
  let landed = false;
  for (let i = 0; i < 600 && !landed; i += 1) {
    step(false);
    landed = m.grounded;
  }
  check(landed && m.swingsLeft === 2, 'landing refills the swings');

  // No vaulting a locked stage gate from the street.
  const street = S.createMotion();
  S.resetMotion(street, 0, 0, S.arenaEndZ(1) - 6, 0);
  params.maxSwings = 6;
  const push = (jump) => S.stepPlayer(street, { moveX: 0, moveZ: 1, jump, cameraYaw: 0 }, params, 1 / 60, collision, e);
  for (let round = 0; round < 12; round += 1) {
    push(true);
    for (let i = 0; i < 20; i += 1) push(false);
  }
  for (let i = 0; i < 400; i += 1) push(false);
  check(street.z < S.gateZ(1) && street.y + S.PLAYER_HEIGHT <= S.streetCeiling() + 1e-6, 'swinging never clears a locked portal (the street has a ceiling)');
}

console.log('\nServer movement: running XP comes from simulated ground only');
{
  const movement = new MovementService();
  const p = fresh('mover');
  movement.initialise(p);
  let seq = 0;
  const xp0 = p.xp;
  for (let i = 0; i < 90; i += 1) {
    seq += 1;
    later(17);
    movement.applyInput('mover', p, { seq, dt: 1 / 60, moveX: 0, moveZ: 1, jump: false, cameraYaw: Math.PI });
    if (movement.lastStepOnGround(p)) progression.creditRun(p, movement.lastDistance(p));
  }
  check(p.xp > xp0 && p.webPower === 0, `running ${p.z.toFixed(0)} units paid ${p.xp - xp0} XP and no Web Power`);
  const accepted = movement.applyInput('mover', p, { seq: seq + 1, dt: 5, moveX: 0, moveZ: 1, jump: false, cameraYaw: 0 });
  check(!accepted || movement.lastStep <= S.MAX_SIM_DELTA, 'a forged long input step is clamped or refused');
}

console.log('\nPersistence: a save round-trips every deriving fact');
{
  const p = fresh('saver');
  p.xp = 12_345;
  p.webPower = 6_789;
  p.bestWebPower = 9_999;
  p.wins = 321;
  p.lifetimeWins = 999;
  p.rebirths = 3;
  p.ownedSuits = 0b1011;
  p.suitSlot = 4;
  p.ownedShooters = 0b11;
  p.shooterId = 2;
  p.totalDamage = 4_242;
  p.playSeconds = 77;
  p.bestStage = 5;
  const { GearState } = await import('../server/dist/rooms/state/PlayerState.js');
  const piece = new GearState();
  piece.uid = 7;
  piece.gearId = 6;
  piece.rarity = 2;
  piece.equipped = true;
  p.gear.push(piece);
  const pet = new PetState();
  pet.uid = 3;
  pet.petId = 14;
  pet.equipped = true;
  p.pets.push(pet);
  const snapshot = profileStore.snapshot(p);
  const q = new PlayerState();
  q.sessionId = 'restored';
  profileStore.applyTo(q, { ...snapshot });
  const same = ['xp', 'webPower', 'bestWebPower', 'wins', 'lifetimeWins', 'rebirths', 'ownedSuits', 'suitSlot', 'ownedShooters', 'shooterId', 'totalDamage', 'playSeconds', 'bestStage'].every((key) => q[key] === p[key]);
  check(same, 'progress, suits, shooters, damage, playtime and stage record restore exactly');
  check(q.gear.length === 1 && q.gear[0].gearId === 6 && q.gear[0].rarity === 2 && q.gear[0].equipped && q.nextGearUid === 8, 'gear restores with rarity and equip state');
  check(q.pets.length === 1 && q.pets[0].petId === 14 && q.pets[0].equipped, 'pets restore with equip state');
  const forged = { ...snapshot, ownedSuits: 0xffffffff, suitSlot: 40, shooterId: 9, gear: [{ uid: 1, gearId: 6, rarity: 99 }] };
  const r = new PlayerState();
  profileStore.applyTo(r, forged);
  check(r.ownedSuits === S.ALL_SUIT_BITS && r.suitSlot === 1 && r.shooterId === 1 && r.gear[0].rarity === 3, 'a tampered save is sanitised: known suits only, a valid slot, rarity clamped');
  // Far past any old 16-bit ceiling: the rebirth count, and the level and health it yields, survive a save.
  const veteran = { ...snapshot, rebirths: 3_000_000_000, xp: S.xpForLevel(140), bestStage: 99 };
  const v = new PlayerState();
  v.sessionId = 'veteran';
  profileStore.applyTo(v, veteran);
  progression.syncDerived(v);
  check(v.rebirths === 3_000_000_000 && v.level === 140, `a save at Rebirth 3B, Level 140 loads as exactly that (R${S.formatCount(v.rebirths)}, L${v.level})`);
  check(v.maxHealth === S.rebirthHealth(3e9) && v.multiplier >= 3e9, 'with its health and multiplier from the formula');
  check(v.bestStage === S.STAGE_COUNT, 'a stage record past the last stage is clamped to Stage 30');
}

console.log('\nLevels have no cap');
{
  check(S.MAX_LEVEL === undefined, 'there is no MAX_LEVEL constant');
  const deep = [50, 120, 121, 300, 600];
  check(deep.every((l) => S.levelForXp(S.xpForLevel(l)).level === l && S.levelForXp((S.xpForLevel(l - 1) + S.xpForLevel(l)) / 2).level === l - 1), 'every level resolves exactly, far past the old 120 (50, 121, 300, 600)');
  check(S.xpToNext(200) === Math.round(116 * 2.5 ** 199), 'XP per level keeps the same formula at Level 200 (116 x 2.5^(L-1))');
  const top = S.levelForXp(S.MAX_STAT);
  check(Number.isFinite(top.level) && top.level > 700 && Number.isFinite(top.into), `even the largest XP total resolves to a real level (Level ${top.level})`);
  const speeds = [6, 24, 25, 100, 800].map((l) => S.moveSpeedFor(l));
  check(speeds[0] === 22 && speeds.every((v, i) => i === 0 || v > speeds[i - 1]) && speeds[4] < 80, `Speed keeps rising with level, uncapped but sane (${speeds.join(', ')})`);
  check(S.formatAmount(S.xpForLevel(300)).length <= 8 && !/e|Infinity|NaN/.test(S.formatAmount(1e300)), `huge figures stay compact (${S.formatAmount(S.xpForLevel(300))}, ${S.formatAmount(1e300)})`);
  check(S.formatAmount(1.5e15) === '1.5Qa' && S.formatAmount(2.2e21) === '2.2Sx' && S.formatAmount(999) === '999' && S.formatAmount(1000) === '1K', 'K, M, B, T, Qa ... Sx suffixes');
}

console.log('\nRebirths have no cap');
{
  const row = (r) => [S.rebirthMultiplier(r), S.rebirthHealth(r), S.rebirthRequiredLevel(r)];
  check(JSON.stringify([row(0), row(1), row(2)]) === JSON.stringify([[1, 100, 8], [2, 150, 12], [3, 200, 12]]), 'R0 1x/100 HP/Level 8, R1 2x/150/12, R2 3x/200/12');
  const samples = [2, 3, 5, 10, 50, 100, 1e3, 1e4, 1e6, 1e9, 1e12, 1e15, Number.MAX_SAFE_INTEGER];
  const needs = samples.map(S.rebirthRequiredLevel);
  check(needs.every((n, i) => i === 0 || n >= needs[i - 1]), `the requirement never falls (${needs.join(', ')})`);
  check(needs.every((n) => Number.isFinite(S.xpForLevel(n))), 'and never outruns what XP can count: every next rebirth stays reachable');
  check(S.rebirthMultiplier(1e12) === 1e12 + 1 && S.rebirthHealth(1e12) === 100 + 50e12, 'multiplier and health are formulas of the rebirth number (R1T: 1T+1x, 50T HP)');
  check(S.formatCount(1234) === '1,234' && S.formatCount(2.5e9) === '2.5B', 'rebirth counts print exact, then compact');
}

console.log('\nThirty stages');
{
  check(S.STAGE_COUNT === 30 && S.STAGES.length === 30, 'exactly 30 stages');
  check(S.STAGES.slice(0, 6).map((s) => s.reward).join(',') === '1,3,10,25,100,800', 'the early Wins stay 1, 3, 10, 25, 100, 800');
  check(S.STAGES.every((s, i) => i === 0 || (s.reward > S.STAGES[i - 1].reward && s.recommendedPower > S.STAGES[i - 1].recommendedPower)), 'Wins and recommended Web Power rise every stage through 30');
  check(S.STAGES.every((s, i) => i === 0 || S.enemyDamageFor(s.index) > S.enemyDamageFor(i)), 'every stage hits harder than the last');
  check(new Set(S.STAGES.map((s) => s.theme)).size === 30, 'thirty different places');
  const bosses = S.STAGES.slice(2).map((s) => s.enemies.find((e) => e.boss)?.look);
  check(bosses.every(Boolean) && new Set(bosses).size === bosses.length, 'a different villain at the end of every stage from 3 to 30');
  check(new Set(S.STAGES.map((s) => s.enemies.find((e) => !e.boss).look)).size >= 28, 'and its own henchmen');
  check(S.STAGES.every((s) => s.enemies.length <= 32 && s.fullMask === 2 ** s.enemies.length - 1), 'every stage clears on its full kill mask');
  check(S.ENEMIES.every((e, i) => e.id === i) && S.ENEMIES.every((e) => Number.isFinite(e.maxHp) && e.maxHp < S.MAX_STAT), `${S.ENEMIES.length} enemies, ids in order, every health finite`);
}

console.log('\nThe training district\'s miniature town');
{
  const overlap = (a, b) => a.minX < b.maxX - 1e-6 && a.maxX > b.minX + 1e-6 && a.minZ < b.maxZ - 1e-6 && a.maxZ > b.minZ + 1e-6 && a.minY < b.maxY - 1e-6 && a.maxY > b.minY + 1e-6;
  const town = S.TRAINING_TOWN.map(S.townPieceSolid);
  const towers = S.BUILDINGS.flatMap((b) => S.buildingSolids(b.tier));
  let pairs = 0;
  for (let i = 0; i < town.length; i += 1) for (let j = i + 1; j < town.length; j += 1) if (overlap(town[i], town[j])) pairs += 1;
  check(town.length > 50 && pairs === 0, `${town.length} town pieces, none overlapping another`);
  check(town.every((box) => towers.every((t) => !overlap(box, t))), 'no town piece overlaps a training tower');
  check(
    town.every((box) => box.minX >= S.TRAINING.minX && box.maxX <= S.TRAINING.maxX && box.minZ >= S.TRAINING.minZ && box.maxZ <= S.TRAINING.maxZ),
    'every piece stands on the district floor',
  );
  const clearOfPads = town.every((box) =>
    S.BUILDINGS.every((b) => {
      const dx = Math.max(box.minX - b.padX, 0, b.padX - box.maxX);
      const dz = Math.max(box.minZ - b.padZ, 0, b.padZ - box.maxZ);
      return Math.hypot(dx, dz) > S.BUILDING_PAD_RADIUS + 0.5;
    }),
  );
  check(clearOfPads, 'no piece stands on or beside a web pad');
  // Nothing between a pad and its tower's face: the web and the view stay clear.
  const sightClear = S.BUILDINGS.every((b) =>
    town.every((box) => {
      for (let t = 0; t <= 1; t += 0.02) {
        const x = b.padX + (b.x - S.BUILDING_HALF - b.padX) * t;
        for (const dz of [-2, 0, 2]) if (x > box.minX && x < box.maxX && b.padZ + dz > box.minZ && b.padZ + dz < box.maxZ) return false;
      }
      return true;
    }),
  );
  check(sightClear, 'every pad looks straight at its tower');
  // Every pad can be walked to from the plaza: a flood fill over a 0.5-unit grid,
  // blocked wherever a player's footprint would touch a town piece or a tower.
  const r = S.PLAYER_RADIUS + 0.05;
  const solids = [...town, ...towers];
  const step = 0.5;
  const nx = Math.round((S.TRAINING.maxX - S.TRAINING.minX) / step) + 1;
  const nz = Math.round((S.TRAINING.maxZ - S.TRAINING.minZ) / step) + 1;
  const free = (x, z) => solids.every((s) => x + r <= s.minX || x - r >= s.maxX || z + r <= s.minZ || z - r >= s.maxZ);
  const seen = new Uint8Array(nx * nz);
  const queue = [];
  for (let k = 0; k < nz; k += 1) {
    const z = S.TRAINING.minZ + k * step;
    if (free(S.TRAINING.minX, z)) {
      seen[k * nx] = 1;
      queue.push([0, k]);
    }
  }
  while (queue.length) {
    const [i, k] = queue.pop();
    for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di;
      const c = k + dk;
      if (a < 0 || c < 0 || a >= nx || c >= nz || seen[c * nx + a]) continue;
      if (!free(S.TRAINING.minX + a * step, S.TRAINING.minZ + c * step)) continue;
      seen[c * nx + a] = 1;
      queue.push([a, c]);
    }
  }
  const reached = S.BUILDINGS.every((b) => seen[Math.round((b.padZ - S.TRAINING.minZ) / step) * nx + Math.round((b.padX - S.TRAINING.minX) / step)] === 1);
  check(reached, 'every pad can be walked to from the plaza');
}

console.log(failures === 0 ? '\nAll progression checks passed.' : `\n${failures} progression check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
