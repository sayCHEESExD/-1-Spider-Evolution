/**
 * ONE REAL RUN against a running server, as a client plays it: train Web
 * Power on the Queens Tower pad, walk into Stage 1, get hunted, web every
 * villain, watch the stage clear and stay cleared, walk to the Win pad,
 * claim, and land back at the base with the run reset; then die in Stage 2.
 * A second client in the same room checks that none of it touches them.
 *
 * Needs a running server (`npm run dev`), default ws://localhost:2589.
 */
import { Client } from 'colyseus.js';
import * as S from '../shared/dist/index.js';

const ENDPOINT = process.env.ENDPOINT ?? `ws://localhost:${S.DEFAULT_SERVER_PORT}`;
let failures = 0;
const check = (condition, message) => {
  if (condition) console.log(`  ok    ${message}`);
  else {
    failures += 1;
    console.log(`  FAIL  ${message}`);
  }
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const join = async (id) => {
  const client = new Client(ENDPOINT);
  const room = await client.joinOrCreate(S.ROOM_NAME, { playerId: id });
  room.respawns = [];
  room.drops = [];
  room.onMessage('respawn', (m) => room.respawns.push(m));
  room.onMessage('gearDropped', (m) => room.drops.push(m));
  for (const type of ['authState', 'stageAwarded', 'stageCleared', 'notice', 'hit', 'hatched']) room.onMessage(type, () => {});
  return room;
};

const stamp = Date.now().toString(36);
const hero = await join(`run-hero-${stamp}`);
const bystander = await join(`run-by-${stamp}`);
await sleep(700);
const me = () => hero.state.players.get(hero.sessionId);
const other = () => bystander.state.players.get(bystander.sessionId);
const aliveOf = (stage) => [...me().enemies].filter((e) => e.alive && S.ENEMIES[e.id].stage === stage);
const nearest = (stage) => aliveOf(stage).sort((a, b) => Math.hypot(a.x - me().x, a.z - me().z) - Math.hypot(b.x - me().x, b.z - me().z))[0];

let seq = 0;
let lastAttack = 0;
/** Walk (real-time input) toward a point, webbing on the way if asked. */
const walkTo = async (x, z, { attack = false, target = -1, stopAt = 2, maxSeconds = 20, until = () => false } = {}) => {
  const t0 = Date.now();
  while (Date.now() - t0 < maxSeconds * 1000) {
    if (until()) return true;
    const p = me();
    const dx = x - p.x;
    const dz = z - p.z;
    const d = Math.hypot(dx, dz);
    const go = d > stopAt;
    seq += 1;
    hero.send(S.MessageType.Move, { seq, dt: 1 / 60, moveX: go ? -dx / d : 0, moveZ: go ? dz / d : 0, jump: false, cameraYaw: 0 });
    if (attack && Date.now() - lastAttack > 320) {
      lastAttack = Date.now();
      hero.send(S.MessageType.Attack, { target });
    }
    if (!go && !attack) return true;
    await sleep(1000 / 60);
  }
  return until();
};

/** Web the stage's villains until it is cleared (or the player falls). */
const clearStage = async (stage, seconds) => {
  const start = Date.now();
  while (me().runStage < stage && Date.now() - start < seconds * 1000 && me().health > 0) {
    const target = nearest(stage);
    if (!target) break;
    await walkTo(target.x, target.z, { attack: true, target: target.id, stopAt: 6, maxSeconds: 1 });
  }
  return (Date.now() - start) / 1000;
};

console.log('\nA run');
check(me().runStage === 0 && aliveOf(1).length === 3, 'the run starts with a fresh Stage 1 wave and every portal closed');
check(me().enemies.length === S.ENEMIES.length, `the player owns a copy of every villain (${me().enemies.length}/${S.ENEMIES.length})`);
const theirs = hero.state.players.get(bystander.sessionId);
check(!!theirs && theirs.enemies.length === S.ENEMIES.length && [...me().enemies].every((e, i) => e && e.id === i), "every villain pool arrives whole, indexed by id");
const byHealth = other().health;

// Train: stand on Queens Tower's pad and web it until Stage 1 is comfortable.
const pad0 = S.BUILDINGS[0];
await walkTo(pad0.padX, pad0.padZ, { stopAt: 1, maxSeconds: 25 });
const trainStart = Date.now();
while (me().webPower < 160 && Date.now() - trainStart < 90_000) {
  await walkTo(pad0.padX, pad0.padZ, { attack: true, target: S.buildingTarget(0), stopAt: 5, maxSeconds: 0.33 });
}
check(me().webPower >= 160 && me().xp >= me().webPower, `webbing Queens Tower trained ${Math.round(me().webPower)} Web Power (Level ${me().level}) in ${Math.round((Date.now() - trainStart) / 1000)}s`);
await walkTo(0, 28, { stopAt: 2, maxSeconds: 25 });

// Into Stage 1, in its corner: the whole wave comes.
await walkTo(0, S.arenaStartZ(1) + 3, { stopAt: 1.5 });
await walkTo(-30, S.arenaStartZ(1) + 6, { stopAt: 1.5 });
const spread0 = aliveOf(1).map((e) => Math.hypot(e.x - me().x, e.z - me().z));
await sleep(1500);
const spread1 = aliveOf(1).map((e) => Math.hypot(e.x - me().x, e.z - me().z));
check(spread1.every((d, i) => d < spread0[i]), 'standing in a corner of the stage, every villain comes for the player');

const fought = await clearStage(1, 90);
check(me().runStage === 1 && me().killMasks[0] === S.stageByIndex(1).fullMask, `every thug down: Stage 1 CLEARED, next portal open (${Math.round(fought)}s)`);
check(aliveOf(2).length === S.stageByIndex(2).enemies.length, "Stage 2's villains wait at their posts");
check(me().totalDamage > 0 && me().kills >= 3, `the damage board and kills counted the fight (${Math.round(me().totalDamage)} damage)`);

await sleep(8000);
check(aliveOf(1).length === 0 && me().runStage === 1, 'eight seconds later nothing has respawned: the stage stays cleared');
check(other().health === byHealth && [...other().enemies].filter((e) => e.alive).length === S.ENEMIES.length, "the other player's health and villains were never touched");

// The claim: walk to the pad; the server pays and sends the player home.
const winsBefore = me().wins;
const pad = S.rewardPadOf(1);
const respawnsBefore = hero.respawns.length;
await walkTo(pad.x, pad.z, { stopAt: 1, maxSeconds: 25, until: () => hero.respawns.length > respawnsBefore });
hero.send(S.MessageType.ClaimStage, { stage: 1 });
hero.send(S.MessageType.ClaimStage, { stage: 1 });
await sleep(500);
check(me().wins === winsBefore + 1, 'claiming pays the stage Wins, once (a repeated claim pays nothing)');
check(!hero.respawns.slice(respawnsBefore).some((m) => m.reason === 'claimed'), 'the player is held a beat for the trophy celebration');
for (const t0 = Date.now(); !hero.respawns.slice(respawnsBefore).some((m) => m.reason === 'claimed') && Date.now() - t0 < 4000; ) await sleep(100);
await sleep(300);
check(hero.respawns.slice(respawnsBefore).filter((m) => m.reason === 'claimed').length === 1 && Math.hypot(me().x, me().z) < 1, 'then the server sends them back to base, once');
check(me().runStage === 0 && [...me().killMasks].every((m) => m === 0) && aliveOf(1).length === 3, 'back at base: a new run, stage progress reset, Stage 1 fielded again');

// Death: clear Stage 1 again, then stand in Stage 2 (recommended 300 Web Power) and let it hunt.
await walkTo(0, S.arenaStartZ(1) + 3, { stopAt: 1.5 });
await clearStage(1, 90);
check(me().runStage === 1, 'a new run: Stage 1 cleared again');
const deathsBefore = hero.respawns.length;
await walkTo(0, S.arenaStartZ(2) + 20, { stopAt: 2, maxSeconds: 20, until: () => hero.respawns.length > deathsBefore });
const powerThen = me().webPower;
for (const t0 = Date.now(); me().health > 0 && Date.now() - t0 < 60_000; ) await sleep(50);
const diedAt = Date.now();
check(me().health === 0, `idle in Stage 2 with ${Math.round(powerThen)} Web Power, the villains take the player down`);
// The death state: the player stays where they fell, can neither walk nor web, and is not sent home yet.
const fellAt = { x: me().x, z: me().z };
const powerDead = me().webPower;
await walkTo(0, S.arenaStartZ(2) + 60, { attack: true, stopAt: 1, maxSeconds: 1.2 });
check(Math.hypot(me().x - fellAt.x, me().z - fellAt.z) < 0.5 && me().webPower === powerDead, 'dead: movement and webs are refused');
check(hero.respawns.length === deathsBefore, 'and the player lies in the death state (no respawn yet)');
for (const t0 = Date.now(); hero.respawns.length === deathsBefore && Date.now() - t0 < 6000; ) await sleep(50);
const death = hero.respawns.slice(deathsBefore).find((m) => m.reason === 'defeated');
const lay = (Date.now() - diedAt) / 1000;
check(!!death && lay >= S.COMBAT.deathSeconds - 0.3 && hero.respawns.length === deathsBefore + 1, `the respawn comes once, after the death state (${lay.toFixed(2)}s)`);
await sleep(600);
check(Math.hypot(me().x, me().z) < 1 && me().health === me().maxHealth, 'defeated: straight back to base at full health');
check(
  me().runStage === 0 && aliveOf(1).length === 3 && aliveOf(2).length === S.stageByIndex(2).enemies.length,
  'and the run is reset: portals closed, every villain back at its post',
);
check(hero.drops.every((d) => S.gearById(d.gearId) && d.rarity >= 0 && d.rarity <= 3), `gear drops were real pieces (${hero.drops.length} dropped)`);

await hero.leave();
await bystander.leave();
console.log(failures === 0 ? '\nrun OK' : `\n${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
