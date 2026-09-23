import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';
import { LEADERBOARD_SIZE } from '@spider/shared';
import { PlayerState } from './PlayerState.js';

/** One row of one board. */
export class LeaderEntry extends Schema {
  /** The row's KEY, derived from the account id. NEVER DRAWN. */
  @type('string') handle = '';
  /** THE NAME THE BOARD SHOWS: the portal's display name, or empty. */
  @type('string') name = '';
  @type('string') avatarUrl = '';
  @type('float64') value = 0;
}

/** The two boards on the back wall. Fixed-length, written in place. */
export class LeaderboardState extends Schema {
  /** Highest Playtime: seconds played, ever. */
  @type([LeaderEntry]) playtime = rows();
  /** Highest Damage: damage dealt to enemies, ever. */
  @type([LeaderEntry]) damage = rows();
}

const rows = (): ArraySchema<LeaderEntry> => {
  const list = new ArraySchema<LeaderEntry>();
  for (let i = 0; i < LEADERBOARD_SIZE; i += 1) list.push(new LeaderEntry());
  return list;
};

/** Root replicated state for one room. */
export class GameState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type('float64') elapsed = 0;
  @type(LeaderboardState) leaderboard = new LeaderboardState();
}

