import { ArraySchema, Schema, type } from '@colyseus/schema';
import { ENEMIES } from '@spider/shared';

/**
 * One enemy of ONE PLAYER'S RUN. Every player fights their own copy of every
 * villain: position and health are the server's; `hits` and `swings` are
 * counters so the owner's client can play each flinch and each blow exactly
 * once.
 */
export class EnemyState extends Schema {
  /** The global enemy id (index into ENEMIES, and into the pool). */
  @type('uint16') id = 0;
  @type('float32') x = 0;
  @type('float32') z = 0;
  @type('float32') yaw = 0;
  @type('float64') hp = 0;
  @type('boolean') alive = true;
  @type('boolean') moving = false;
  @type('uint16') hits = 0;
  @type('uint16') swings = 0;
}

/**
 * A FULL POOL: every enemy of every stage, at its post, at full health,
 * indexed by id. Created with the player and never re-created - a run resets
 * the pool in place - so every client, which receives the pool once at join,
 * only ever sees field changes after that (enemies are never added or removed).
 */
export const enemyStates = (): ArraySchema<EnemyState> => {
  const list = new ArraySchema<EnemyState>();
  for (const def of ENEMIES) {
    const enemy = new EnemyState();
    enemy.id = def.id;
    enemy.x = def.x;
    enemy.z = def.z;
    enemy.yaw = Math.PI;
    enemy.hp = def.maxHp;
    list.push(enemy);
  }
  return list;
};
