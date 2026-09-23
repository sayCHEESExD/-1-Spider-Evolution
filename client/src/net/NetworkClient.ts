import {
  MessageType,
  ROOM_NAME,
  type AttackMessage,
  type AuthStateMessage,
  type ClaimStageMessage,
  type GearActionMessage,
  type GearDroppedMessage,
  type HatchMessage,
  type HatchedMessage,
  type HitMessage,
  type InventoryActionKind,
  type MoveMessage,
  type NoticeMessage,
  type PetActionMessage,
  type RespawnMessage,
  type SetAuthMessage,
  type SetAvatarMessage,
  type SetIdentityMessage,
  type ShooterMessage,
  type StageAwardedMessage,
  type StageClearedMessage,
  type SuitMessage,
  type TeleportMessage,
} from '@spider/shared';
import { Client, getStateCallbacks, type Room } from 'colyseus.js';
import { clientConfig } from '../config/clientConfig.js';
import { logger } from '../util/logger.js';
import type {
  ConnectionStatus,
  LeaderboardSnapshot,
  NetEnemyState,
  NetGameState,
  NetGear,
  NetLeaderEntry,
  NetPet,
  NetPlayerState,
} from './netTypes.js';

const SCOPE = 'NetworkClient';

/** Key under which this browser's stable player id is kept. */
const PLAYER_ID_KEY = 'spider.playerId';

/** Backoff between join attempts, in milliseconds. A cold host takes a while. */
const JOIN_BACKOFF_MS = [1000, 2000, 4000, 8000, 15000] as const;

/**
 * The server's "storage unavailable" refusal. Not a failure of THIS join but
 * of the database behind it, so the retry does not give up: it keeps asking
 * at the longest backoff until the server can read profiles again.
 */
const STORAGE_UNAVAILABLE = 4105;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const resolvePlayerId = (): string => {
  const fresh = `p_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  try {
    const existing = window.localStorage.getItem(PLAYER_ID_KEY);
    if (existing) return existing;
    window.localStorage.setItem(PLAYER_ID_KEY, fresh);
  } catch {
    return fresh;
  }
  return fresh;
};

export interface NetworkHandlers {
  onStatusChange?(status: ConnectionStatus, detail?: string): void;
  onSelfJoined?(sessionId: string): void;
  onPlayerAdded?(sessionId: string, player: NetPlayerState): void;
  onPlayerChanged?(sessionId: string, player: NetPlayerState): void;
  onPlayerRemoved?(sessionId: string): void;
  onRespawn?(message: RespawnMessage): void;
  onStageAwarded?(message: StageAwardedMessage): void;
  onStageCleared?(message: StageClearedMessage): void;
  onHit?(message: HitMessage): void;
  onHatched?(message: HatchedMessage): void;
  onGearDropped?(message: GearDroppedMessage): void;
  onNotice?(message: NoticeMessage): void;
  onAuthState?(message: AuthStateMessage): void;
}

/**
 * Thin wrapper over colyseus.js. The rest of the client never imports
 * colyseus.js directly.
 */
export class NetworkClient {
  private readonly handlers: NetworkHandlers;
  private client: Client | null = null;
  private room: Room<NetGameState> | null = null;
  private status: ConnectionStatus = 'idle';
  /** The portal's game token, asked for at join and on every login change. */
  private token: (() => string | null) | null = null;
  /** The last token the server was told about, so an unchanged one is not resent. */
  private sentToken: string | null | undefined = undefined;
  private look: (() => SetAvatarMessage | null) | null = null;
  private identityOf: (() => SetIdentityMessage) | null = null;

  constructor(handlers: NetworkHandlers = {}) {
    this.handlers = handlers;
  }

  setLookProvider(provider: () => SetAvatarMessage | null): void {
    this.look = provider;
  }

  sendAvatar(message: SetAvatarMessage): void {
    this.room?.send(MessageType.SetAvatar, message);
  }

  sendIdentity(message: SetIdentityMessage): void {
    this.room?.send(MessageType.SetIdentity, message);
  }

  /**
   * Where the portal's TOKEN comes from. The token is the only thing about
   * the login that is ever sent: the server asks Bloxity whose it is. An
   * account id from the browser would be a claim, and claims are not trusted.
   */
  setTokenProvider(provider: () => string | null): void {
    this.token = provider;
  }

  /**
   * Tell the server the login changed (sign-in, sign-out, account switch).
   * The live session switches profile; there is no reconnect. Deduped: an
   * unchanged token is not resent.
   */
  sendAuth(token: string | null): void {
    if (!this.room) return;
    if (token === this.sentToken) return;
    this.sentToken = token;
    const message: SetAuthMessage = { token };
    this.room.send(MessageType.SetAuth, message);
  }

  setDisplayProvider(provider: () => SetIdentityMessage): void {
    this.identityOf = provider;
  }

  get sessionId(): string | null {
    return this.room?.sessionId ?? null;
  }

  get roomId(): string {
    return this.room?.roomId ?? '';
  }

  get connectionStatus(): ConnectionStatus {
    return this.status;
  }

  /** The server's clock, in seconds. */
  get elapsed(): number {
    return this.room?.state?.elapsed ?? 0;
  }

  /** Every enemy in the room, as the server has them. */
  get enemies(): ArrayLike<NetEnemyState> | null {
    // Every player fights their own run: only the LOCAL player's enemies are shown,
    // indexed by their global id so callers can look one up by `EnemyDef.id`.
    const me = this.room ? this.room.state?.players?.get(this.room.sessionId) : undefined;
    if (!me) return null;
    const byId: NetEnemyState[] = [];
    for (let i = 0; i < me.enemies.length; i += 1) {
      const enemy = me.enemies[i];
      if (enemy) byId[enemy.id] = enemy;
    }
    return byId;
  }


  async connect(): Promise<void> {
    if (!clientConfig.serverUrl) {
      this.setStatus('error');
      throw new Error(
        'No game server is configured. Set VITE_SERVER_URL to the Colyseus ' +
          'endpoint (for example wss://your-server-host) and rebuild.',
      );
    }

    this.setStatus('connecting');
    logger.info(SCOPE, `joining "${ROOM_NAME}" at ${clientConfig.serverUrl}`);

    this.client ??= new Client(clientConfig.serverUrl);
    const playerId = resolvePlayerId();
    const attempts = JOIN_BACKOFF_MS.length + 1;
    let joinedWith: string | null = null;

    for (let attempt = 1; ; attempt += 1) {
      const token = this.token?.() ?? null;
      try {
        this.room = await this.client.joinOrCreate<NetGameState>(ROOM_NAME, {
          playerId,
          token,
          avatar: this.look?.() ?? undefined,
          identity: this.identityOf?.() ?? undefined,
        });
        joinedWith = token;
        break;
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        const code = (error as { code?: unknown }).code;
        const storageDown = code === STORAGE_UNAVAILABLE;
        logger.warn(SCOPE, `join attempt ${attempt}${storageDown ? '' : `/${attempts}`} failed: ${detail}`);
        if (!storageDown && attempt >= attempts) {
          this.setStatus('error', detail);
          throw error;
        }
        const wait = JOIN_BACKOFF_MS[Math.min(attempt, JOIN_BACKOFF_MS.length) - 1] ?? 0;
        this.setStatus('connecting', storageDown ? 'the server is waiting for its database' : `attempt ${attempt + 1}/${attempts}`);
        await sleep(wait);
      }
    }

    if (!this.room) throw new Error('join produced no room');

    this.sentToken = joinedWith;
    this.bindRoom(this.room);
    this.setStatus('connected');
    logger.info(SCOPE, `joined roomId=${this.room.roomId} sessionId=${this.room.sessionId}`);
    this.handlers.onSelfJoined?.(this.room.sessionId);
    // A login that changed while the join was in flight is sent now.
    this.sendAuth(this.token?.() ?? null);
  }

  /** Report one simulated input. Deliberately NOT rate limited. */
  sendInput(message: MoveMessage): void {
    this.room?.send(MessageType.Move, message);
  }

  /** One swing, and what the player swung at - a hint the server checks. */
  attack(target: number): void {
    const message: AttackMessage = { target };
    this.room?.send(MessageType.Attack, message);
  }

  claimStage(stage: number): void {
    const message: ClaimStageMessage = { stage };
    this.room?.send(MessageType.ClaimStage, message);
  }

  /** "I am on this suit's pad." The server checks the position and the price. */
  suitPad(slot: number): void {
    const message: SuitMessage = { slot };
    this.room?.send(MessageType.SuitPad, message);
  }

  /** Buy or wear a suit from the Backpack. The server checks the price. */
  suitSelect(slot: number): void {
    const message: SuitMessage = { slot };
    this.room?.send(MessageType.SuitSelect, message);
  }

  /** Buy (at the stand) or equip a web shooter. The server checks where, and the price. */
  shooterSelect(id: number): void {
    const message: ShooterMessage = { id };
    this.room?.send(MessageType.ShooterSelect, message);
  }

  gearAction(action: InventoryActionKind, uid?: number): void {
    const message: GearActionMessage = uid === undefined ? { action } : { action, uid };
    this.room?.send(MessageType.GearAction, message);
  }

  hatch(egg: number, count: number): void {
    const message: HatchMessage = { egg, count };
    this.room?.send(MessageType.Hatch, message);
  }

  petAction(action: InventoryActionKind, uid?: number): void {
    const message: PetActionMessage = uid === undefined ? { action } : { action, uid };
    this.room?.send(MessageType.PetAction, message);
  }

  teleport(to: string): void {
    const message: TeleportMessage = { to };
    this.room?.send(MessageType.Teleport, message);
  }

  requestRebirth(): void {
    this.room?.send(MessageType.Rebirth, {});
  }

  requestRespawn(): void {
    this.room?.send(MessageType.RequestRespawn, {});
  }

  /** The two leaderboards, COPIED out of the schema as plain arrays. */
  get leaderboard(): LeaderboardSnapshot | null {
    const board = this.room?.state?.leaderboard;
    if (!board) return null;
    const copy = (rows: ArrayLike<NetLeaderEntry>): NetLeaderEntry[] => {
      const out: NetLeaderEntry[] = [];
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        if (row) out.push({ handle: row.handle, name: row.name, avatarUrl: row.avatarUrl, value: row.value });
      }
      return out;
    };
    return { playtime: copy(board.playtime), damage: copy(board.damage) };
  }

  async disconnect(): Promise<void> {
    await this.room?.leave(true);
    this.room = null;
    this.sentToken = undefined;
    this.setStatus('disconnected');
  }

  private bindRoom(room: Room<NetGameState>): void {
    const $ = getStateCallbacks(room);

    $(room.state).players.onAdd((player, sessionId) => {
      this.handlers.onPlayerAdded?.(sessionId, player);
      $(player).onChange(() => {
        this.handlers.onPlayerChanged?.(sessionId, player);
      });
      // A NESTED schema's changes do not bubble to its parent.
      $(player.avatar).onChange(() => {
        this.handlers.onPlayerChanged?.(sessionId, player);
      });
      const changed = (): void => this.handlers.onPlayerChanged?.(sessionId, player);
      // Collections: typed loosely, as the schema reflection builds them at runtime.
      const bound = $(player) as unknown as {
        pets: { onAdd(cb: (pet: NetPet) => void): void; onRemove(cb: () => void): void };
        gear: { onAdd(cb: (piece: NetGear) => void): void; onRemove(cb: () => void): void };
        killMasks: { onChange(cb: () => void): void };
      };
      bound.pets.onAdd((pet) => {
        changed();
        ($(pet) as unknown as { onChange(cb: () => void): void }).onChange(changed);
      });
      bound.pets.onRemove(changed);
      bound.gear.onAdd((piece) => {
        changed();
        ($(piece) as unknown as { onChange(cb: () => void): void }).onChange(changed);
      });
      bound.gear.onRemove(changed);
      bound.killMasks.onChange(changed);
    });

    $(room.state).players.onRemove((_player, sessionId) => {
      this.handlers.onPlayerRemoved?.(sessionId);
    });

    room.onMessage<RespawnMessage>(MessageType.Respawn, (message) => {
      this.handlers.onRespawn?.(message);
    });

    room.onMessage<StageAwardedMessage>(MessageType.StageAwarded, (message) => {
      this.handlers.onStageAwarded?.(message);
    });

    room.onMessage<StageClearedMessage>(MessageType.StageCleared, (message) => {
      this.handlers.onStageCleared?.(message);
    });

    room.onMessage<HitMessage>(MessageType.Hit, (message) => {
      this.handlers.onHit?.(message);
    });

    room.onMessage<HatchedMessage>(MessageType.Hatched, (message) => {
      this.handlers.onHatched?.(message);
    });

    room.onMessage<GearDroppedMessage>(MessageType.GearDropped, (message) => {
      this.handlers.onGearDropped?.(message);
    });

    room.onMessage<NoticeMessage>(MessageType.Notice, (message) => {
      this.handlers.onNotice?.(message);
    });

    room.onMessage<AuthStateMessage>(MessageType.AuthState, (message) => {
      logger.info(SCOPE, `playing as ${message.status}${message.note ? ` (${message.note})` : ''}`);
      this.handlers.onAuthState?.(message);
    });

    room.onError((code, message) => {
      logger.error(SCOPE, `room error ${code}: ${message ?? ''}`);
      this.setStatus('error', message);
    });

    room.onLeave((code) => {
      logger.warn(SCOPE, `left room (code ${code})`);
      this.setStatus('disconnected', `code ${code}`);
    });
  }

  private setStatus(status: ConnectionStatus, detail?: string): void {
    this.status = status;
    this.handlers.onStatusChange?.(status, detail);
  }
}
