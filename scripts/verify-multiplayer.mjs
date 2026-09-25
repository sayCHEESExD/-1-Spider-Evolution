/**
 * Two real clients in one room: one RUNS, WEBS and WEB-SWINGS, the other
 * watches it replicate - every web counted once with where it went, the Web
 * Power and XP the server paid, the position the server simulated, and the
 * swing's web and anchor. Then the refusals and forgeries: running pays no
 * Web Power, a suit claimed from the wrong place (and without Trophies) is not
 * granted, a web shooter bought away from the stand is refused, a stage the
 * player has not reached cannot be teleported to, and a rebirth asked for
 * too early does nothing.
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
  room.notices = [];
  room.onMessage('notice', (m) => room.notices.push(m));
  for (const type of ['respawn', 'authState', 'stageAwarded', 'stageCleared', 'hit', 'hatched', 'gearDropped']) room.onMessage(type, () => {});
  return room;
};

const stamp = Date.now().toString(36);
const actor = await join(`mp-actor-${stamp}`);
const watcher = await join(`mp-watcher-${stamp}`);
await sleep(600);
check(actor.roomId === watcher.roomId, 'both clients share a room');

const self = () => actor.state.players.get(actor.sessionId);
const seen = () => watcher.state.players.get(actor.sessionId);

let seq = 0;
const move = async (frames, input) => {
  for (let i = 0; i < frames; i += 1) {
    seq += 1;
    actor.send(S.MessageType.Move, { seq, dt: 1 / 60, moveX: 0, moveZ: 0, jump: false, cameraYaw: 0, ...input });
    await sleep(1000 / 60);
  }
};

// Running: real-time input at 60 Hz, forward for a second.
const powerBefore = self().webPower;
const xpBefore = self().xp;
await move(60, { moveZ: 1 });
await sleep(300);
check(self().z > 5, `the server moved the runner (z ${self().z.toFixed(1)})`);
check(Math.abs(seen().z - self().z) < 0.01, 'the watcher sees the same position');
check(self().webPower === powerBefore && self().xp > xpBefore, `running paid a little XP (+${self().xp - xpBefore}) and no Web Power`);

// Web-swinging (back across the plaza): jump, then jump again in mid-air.
const swingsBefore = seen().swingCount;
const back = { moveZ: 1, cameraYaw: Math.PI };
await move(8, { ...back, jump: true });
await move(14, back);
await move(4, { ...back, jump: true });
await move(4, back);
check(seen().swinging && seen().swingCount === swingsBefore + 1, 'a mid-air jump catches a web, and the watcher sees the swing');
check(seen().anchorY > seen().y + 5 && seen().swingsLeft === self().maxSwings - 1, 'the web is anchored above, and one swing is spent');
await move(150, back);
check(self().grounded && self().swingsLeft === self().maxSwings, 'landing refills the swings');
check(self().z > S.HUB.minZ && self().z < S.HUB.maxZ, 'and the swing stayed inside the plaza');

// Webbing.
const attacksBefore = seen().attackCount;
const gainBefore = seen().webPower;
for (let i = 0; i < 5; i += 1) {
  actor.send(S.MessageType.Attack, { target: -1 });
  await sleep(350);
}
await sleep(300);
check(seen().attackCount === attacksBefore + 5, `the watcher saw each of 5 webs once (${seen().attackCount - attacksBefore})`);
check(seen().webPower === gainBefore + 5, `each web paid the Classic Suit's +1 (Web Power ${seen().webPower})`);
check(Math.hypot(seen().attackX - seen().x, seen().attackZ - seen().z) > 5, 'and the watcher knows where each web flew');

// Spam: far faster than the rate limit.
const spamBefore = self().webPower;
for (let i = 0; i < 20; i += 1) actor.send(S.MessageType.Attack, { target: -1 });
await sleep(400);
check(self().webPower - spamBefore <= S.COMBAT.burst + 1, `20 instant webs paid at most the burst (${self().webPower - spamBefore})`);

// Refusals and forgeries.
const zBefore = self().z;
actor.send(S.MessageType.SuitPad, { slot: 19 });
actor.send(S.MessageType.SuitSelect, { slot: 19 });
actor.send(S.MessageType.ShooterSelect, { id: 3 });
actor.send(S.MessageType.Rebirth, {});
actor.send(S.MessageType.Teleport, { to: 'stage9' });
actor.send(S.MessageType.Hatch, { egg: 6, count: 3 });
actor.send(S.MessageType.GearAction, { action: 'equip', uid: 12345 });
actor.send(S.MessageType.Attack, { target: S.buildingTarget(5) });
await sleep(500);
check(self().suitSlot === S.AVATAR_SLOT && self().ownedSuits === 0, 'a suit claimed from the wrong place (and without Trophies) is not granted: still their own avatar');
check(self().shooterId === 1 && self().ownedShooters === 1, 'a web shooter bought away from the stand is refused');
check(self().rebirths === 0, 'a rebirth below Level 8 does nothing');
check(Math.abs(self().z - zBefore) < 1 && self().runStage === 0, 'a stage the player has never reached cannot be teleported to');
check(self().pets.length === 0 && self().gear.length === 0, 'no pets from an egg the player cannot afford; no gear from a forged uid');
check(actor.notices.some((n) => n.kind === 'locked'), `the server said why (${actor.notices.length} notices)`);

// Several players joining at once: every client's copy of every villain pool arrives whole.
const crowd = await Promise.all([1, 2, 3, 4, 5].map((i) => join(`mp-crowd${i}-${stamp}`)));
await sleep(1200);
const whole = (room) =>
  [...room.state.players.values()].every((p) => p.enemies.length === S.ENEMIES.length && [...p.enemies].every((e, i) => e && e.id === i));
check([actor, watcher, ...crowd].every(whole), 'five players joining together: every client holds every pool whole (no missing villains)');
for (const room of crowd) await room.leave();

await actor.leave();
await watcher.leave();
console.log(failures === 0 ? '\nmultiplayer OK' : `\n${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
