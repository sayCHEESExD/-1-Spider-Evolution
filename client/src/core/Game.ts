import {
  BUILDINGS,
  BUILDING_PAD_RADIUS,
  BUILDING_TARGET_BASE,
  COMBAT,
  EGG_PLACEMENTS,
  ENEMIES,
  NO_TARGET,
  PETS_SHOP,
  SHOOTER_SHOP,
  SPAWN,
  STAGE_COUNT,
  SUITS,
  SUIT_PADS,
  TRAINING,
  TRAINING_TIERS,
  WorldCollision,
  buildingAimPoint,
  buildingTarget,
  canRebirth,
  canTrainOn,
  formatAmount,
  formatWins,
  gearLabel,
  isBuildingTarget,
  levelForXp,
  ownsSuit,
  returnPadOf,
  rewardPadOf,
  shooterById,
  stageAt,
  stageByIndex,
  suitBySlot,
  type GearDroppedMessage,
  type HitMessage,
  type NoticeMessage,
  type RespawnMessage,
  type StageAwardedMessage,
  type StageClearedMessage,
} from '@spider/shared';
import { Vector3 } from 'three';
import { AudioManager } from '../audio/AudioManager.js';
import { PlayerAudio } from '../audio/PlayerAudio.js';
import { Bloxity } from '../bloxity/Bloxity.js';
import { lookFromLegion } from '../bloxity/avatarLook.js';
import { identityFromLegion } from '../bloxity/identity.js';
import { ThirdPersonCamera } from '../camera/ThirdPersonCamera.js';
import { ClaimCelebration } from '../combat/ClaimCelebration.js';
import { DamagePopups } from '../combat/DamagePopups.js';
import { TargetSelector } from '../combat/TargetSelector.js';
import { WebEffects } from '../combat/WebEffects.js';
import { clientConfig } from '../config/clientConfig.js';
import { EnemyManager } from '../enemies/EnemyManager.js';
import { InputManager } from '../input/InputManager.js';
import { NetworkClient } from '../net/NetworkClient.js';
import type { ConnectionStatus, NetGear, NetPet, NetPlayerState } from '../net/netTypes.js';
import { LocalPlayer } from '../player/LocalPlayer.js';
import { lookOf } from '../player/look.js';
import { playerModelLoader, type PlayerModelReport } from '../player/PlayerModelLoader.js';
import { RemotePlayerManager } from '../player/RemotePlayerManager.js';
import { RendererManager } from '../rendering/RendererManager.js';
import { SceneManager } from '../rendering/SceneManager.js';
import { BloxityPanel } from '../ui/BloxityPanel.js';
import { Hud, HudButton } from '../ui/Hud.js';
import { ICON } from '../ui/icons.js';
import { ModelPortraits } from '../ui/ModelPortraits.js';
import { anyPanelOpen } from '../ui/Panel.js';
import {
  BackpackWindow,
  EggWindow,
  RebirthWindow,
  ShooterShopWindow,
  StatsWindow,
  TeleportWindow,
  anyWindowOpen,
  showHatch,
  type BackpackState,
} from '../ui/Windows.js';
import { logger } from '../util/logger.js';
import { HubWorld } from '../world/HubWorld.js';
import { Sky } from '../world/Sky.js';
import { StageWorld } from '../world/StageWorld.js';

const SCOPE = 'Game';
const AUTO_CLICK_KEY = 'spider.autoClick';

const shortcutOf = (event: KeyboardEvent): string => {
  const code = event.code;
  if (code.startsWith('Key') && code.length === 4) return code.slice(3).toLowerCase();
  if (code) return code.toLowerCase();
  return (event.key || '').toLowerCase();
};

const isTyping = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  if (!element) return false;
  if (element.isContentEditable) return true;
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

const readAutoClick = (): boolean => {
  try {
    return window.localStorage.getItem(AUTO_CLICK_KEY) === '1';
  } catch {
    return false;
  }
};

const HIT_POINT = new Vector3();
const HAND = new Vector3();
const ANCHOR = new Vector3();
const SCREEN = new Vector3();

/**
 * Composition root. Owns every subsystem and the per-frame order - input,
 * prediction, webs, pads, camera, network, render - and no gameplay rules:
 * every Web Power, XP point, Trophy, purchase and kill is the server's.
 */
export class Game {
  private readonly renderer: RendererManager;
  private readonly sceneManager = new SceneManager();
  private readonly camera = new ThirdPersonCamera();
  private readonly input = new InputManager();
  private readonly collision = new WorldCollision();
  private readonly remotePlayers: RemotePlayerManager;
  /** Built once the player model has loaded: its statues are that model. */
  private hub!: HubWorld;
  private readonly stages = new StageWorld();
  private readonly sky = new Sky();
  private readonly enemies: EnemyManager;
  private readonly webs: WebEffects;
  private readonly celebration: ClaimCelebration;
  private readonly damage: DamagePopups;
  private readonly targets = new TargetSelector();
  private readonly hud: Hud;
  private readonly portraits: ModelPortraits;
  private readonly backpack: BackpackWindow;
  private readonly rebirthWindow: RebirthWindow;
  private readonly eggWindow: EggWindow;
  private readonly shopWindow: ShooterShopWindow;
  private readonly teleportWindow: TeleportWindow;
  private readonly statsWindow: StatsWindow;
  private readonly rebirthButton: HudButton;
  private readonly backpackButton: HudButton;
  private readonly teleportButton: HudButton;
  private readonly statsButton: HudButton;
  private readonly musicButton: HudButton;
  private readonly audio = new AudioManager();
  private readonly playerAudio: PlayerAudio;
  private readonly bloxity: Bloxity;
  private readonly bloxityPanel: BloxityPanel;
  private readonly fpsReadout: HTMLDivElement;
  private readonly network: NetworkClient;
  private readonly container: HTMLElement;

  private fpsAccum = 0;
  private fpsFrames = 0;
  private localPlayer: LocalPlayer | null = null;
  private localSessionId: string | null = null;
  private local: NetPlayerState | null = null;
  private pendingRespawn: RespawnMessage | null = null;

  private autoClick = readAutoClick();
  private sinceAttack = 99;
  private shotHand = 0;
  private lastLevel = -1;
  private lastRebirths = -1;
  private lastSuit = 1;
  /** The pad the player last stood on, so each pad fires once per visit. */
  private onPad = '';
  private claimCooldown = 0;
  private lastEggPad = 0;
  private atShop = false;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new RendererManager(container);
    this.remotePlayers = new RemotePlayerManager(this.sceneManager.scene);
    // Once per enemy of the local run, the frame it is seen to fall.
    this.enemies = new EnemyManager(this.sceneManager.scene, () => this.audio.play('enemyDeath'));
    this.webs = new WebEffects(this.sceneManager.scene);
    this.celebration = new ClaimCelebration(this.sceneManager.scene);
    this.damage = new DamagePopups(container);
    this.hud = new Hud(container, () => this.toggleAutoClick());
    this.hud.setAutoClick(this.autoClick);
    this.portraits = new ModelPortraits(this.renderer.renderer);

    this.backpack = new BackpackWindow(container, this.portraits, {
      suitSelect: (slot) => this.network.suitSelect(slot),
      shooterSelect: (id) => this.network.shooterSelect(id),
      petAction: (action, uid) => this.network.petAction(action, uid),
      gearAction: (action, uid) => this.network.gearAction(action, uid),
    });
    this.rebirthWindow = new RebirthWindow(container, () => this.network.requestRebirth());
    this.eggWindow = new EggWindow(container, this.portraits, (egg, count) => this.network.hatch(egg, count));
    this.shopWindow = new ShooterShopWindow(container, this.portraits, (id) => this.network.shooterSelect(id));
    this.teleportWindow = new TeleportWindow(container, (to) => this.network.teleport(to));
    this.statsWindow = new StatsWindow(container);

    const left = this.hud.left;
    this.rebirthButton = new HudButton(left, 'Rebirth', ICON.rebirth, 'R', () => this.openOnly('rebirth'));
    this.backpackButton = new HudButton(left, 'Backpack', ICON.backpack, 'B', () => this.openOnly('backpack'));
    this.teleportButton = new HudButton(left, 'Teleport', ICON.teleport, 'T', () => this.openOnly('teleport'));
    this.statsButton = new HudButton(left, 'Stats', ICON.stats, 'J', () => this.openOnly('stats'));
    this.musicButton = new HudButton(this.hud.corner, 'Music', ICON.sound, 'M', () => {
      this.musicButton.setOff(this.audio.toggleMuted());
    });

    this.playerAudio = new PlayerAudio(this.audio);

    this.bloxity = new Bloxity({
      setMasterVolume: (level) => this.audio.setMasterVolume(level),
      setMusicVolume: (level) => this.audio.setMusicVolume(level),
      setGraphicsQuality: (level) => this.renderer.setQuality(level),
      setShowFps: (show) => {
        this.fpsReadout.hidden = !show;
      },
      setCameraSensitivity: (scale) => this.input.look.setSensitivityScale(scale),
      respawn: () => this.network.requestRespawn(),
      pointerLockChanged: (locked) => this.input.look.setCursorFree(!locked),
      // Every player wears a Spider-Man suit; the portal avatar is still reported (for the platform).
      avatarChanged: (equipped, proportions) => this.network.sendAvatar(lookFromLegion(equipped, proportions)),
    });

    this.fpsReadout = document.createElement('div');
    this.fpsReadout.className = 'aoe-fps aoe-font';
    this.fpsReadout.hidden = true;
    container.appendChild(this.fpsReadout);

    this.bloxityPanel = new BloxityPanel(container, this.bloxity);

    window.addEventListener('keydown', this.onHotkey);
    window.addEventListener('keydown', this.onGesture);
    window.addEventListener('mousedown', this.onGesture);
    window.addEventListener('touchstart', this.onGesture, { passive: true });

    this.renderer.onResize((width, height) => this.camera.setViewport(width, height));

    this.network = new NetworkClient({
      onStatusChange: (status) => this.onStatusChange(status),
      onSelfJoined: (sessionId) => {
        this.localSessionId = sessionId;
        const roomId = this.network.roomId;
        this.bloxity.updateRoom(roomId);
        this.bloxityPanel.setRoom(roomId);
      },
      onPlayerAdded: (sessionId, player) => this.onPlayerAdded(sessionId, player),
      onPlayerChanged: (sessionId, player) => this.onPlayerChanged(sessionId, player),
      onPlayerRemoved: (sessionId) => {
        this.remotePlayers.remove(sessionId);
        this.webs.dropRope(sessionId);
      },
      onRespawn: (message) => {
        this.pendingRespawn = message;
        this.applyPendingRespawn();
      },
      onStageAwarded: (message) => this.onStageAwarded(message),
      onStageCleared: (message) => this.onStageCleared(message),
      onHit: (message) => this.onHit(message),
      onHatched: (message) => {
        this.audio.play('unlock');
        showHatch(this.container, this.portraits, message.pets.map((pet) => pet.petId));
      },
      onGearDropped: (message) => this.onGearDropped(message),
      onNotice: (message) => this.onNotice(message),
    });

    this.network.setTokenProvider(() => this.bloxity.getToken());
    this.network.setLookProvider(() => lookFromLegion(this.bloxity.getEquipped(), this.bloxity.getProportions()));
    this.network.setDisplayProvider(() => identityFromLegion(this.bloxity.getUser(), this.bloxity.getGuest()));
    this.bloxity.onUserChanged((user) => {
      this.network.sendAuth(this.bloxity.getToken());
      this.network.sendIdentity(identityFromLegion(user, this.bloxity.getGuest()));
    });
  }

  private readonly onHotkey = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.repeat) return;
    if (isTyping(event.target)) return;
    switch (shortcutOf(event)) {
      case 'r':
        this.rebirthButton.press();
        break;
      case 'b':
        this.backpackButton.press();
        break;
      case 't':
        this.teleportButton.press();
        break;
      case 'j':
        this.statsButton.press();
        break;
      case 'c':
        this.toggleAutoClick();
        break;
      case 'm':
        this.musicButton.press();
        break;
      case 'escape':
        this.closeAll();
        this.input.look.setCursorFree(true);
        this.bloxity.showPortalMenu(true);
        break;
      default:
        break;
    }
  };

  private readonly onGesture = (): void => {
    this.audio.resume();
  };

  private toggleAutoClick(): void {
    this.autoClick = !this.autoClick;
    this.hud.setAutoClick(this.autoClick);
    this.hud.toast(this.autoClick ? 'Auto Click ON - webs fire at villains in range, and lock on while you swing!' : 'Auto Click OFF', 'gold');
    try {
      window.localStorage.setItem(AUTO_CLICK_KEY, this.autoClick ? '1' : '0');
    } catch {
      /* private mode: the toggle still works for this session */
    }
  }

  private closeAll(): void {
    this.backpack.setOpen(false);
    this.rebirthWindow.setOpen(false);
    this.eggWindow.setOpen(false);
    this.shopWindow.setOpen(false);
    this.teleportWindow.setOpen(false);
    this.statsWindow.setOpen(false);
  }

  private openOnly(which: 'rebirth' | 'backpack' | 'teleport' | 'stats'): void {
    const target = { rebirth: this.rebirthWindow, backpack: this.backpack, teleport: this.teleportWindow, stats: this.statsWindow }[which];
    const wasOpen = target.isOpen;
    this.closeAll();
    if (wasOpen) return;
    if (which === 'backpack') this.backpack.show(this.backpack.currentTab);
    else target.setOpen(true);
    if (this.local) this.refreshWindows(this.local);
  }

  startBloxity(): void {
    this.bloxity.start();
    document.body.classList.toggle('aoe-portal-embedded', this.bloxity.embedded);
  }

  loadingStep(text: string): void {
    this.bloxity.loadingStep(text);
  }

  async initialise(): Promise<PlayerModelReport> {
    const scene = this.sceneManager.scene;
    const report = await playerModelLoader.load();
    this.hub = new HubWorld();
    scene.add(this.sky.root, this.hub.root, this.stages.root);

    this.localPlayer = new LocalPlayer(this.collision);
    scene.add(this.localPlayer.character.root);
    scene.add(this.localPlayer.character.worldRoot);
    this.camera.snapTo(this.localPlayer.position);

    logger.info(SCOPE, 'world ready');
    return report;
  }

  async connect(): Promise<void> {
    await this.network.connect();
  }

  start(): void {
    this.input.attach(this.renderer.renderer.domElement);
    this.bloxity.loadingEnd();
    this.bloxity.gameplayStart();
  }

  stop(): void {
    this.input.detach();
    this.bloxity.gameplayEnd();
    this.bloxity.updateRoom('');
    void this.network.disconnect();
  }

  // ---------------------------------------------------------------- frame

  update(delta: number, _now: number): void {
    // Windows own the screen; a claim celebration or the death state holds the player
    // still until the server sends them home.
    const dead = this.localPlayer?.character.dead ?? false;
    this.input.setSuppressed(anyWindowOpen() || anyPanelOpen() || this.celebration.playing || dead);
    const input = this.input.sample();
    const player = this.localPlayer;

    this.camera.setOrbit(this.input.look.yaw, this.input.look.pitch);
    this.camera.setZoom(this.input.look.zoom);

    if (player) {
      if (this.local) player.setParams(this.local.moveSpeed, this.local.jumpVelocity, this.local.runStage, this.local.maxSwings);
      player.update(delta, input, this.input.look.yaw);
      if (player.swungEdge) this.audio.play('swing');
      this.snapCameraIfPlaced();
      this.camera.setTarget(player.position);
      this.sceneManager.followShadow(player.position.x, player.position.y, player.position.z);
      this.flushInput();
      if (!dead) {
        this.updateWebs(delta, input.attack || input.attackHeld, player);
        this.updatePads(delta, player);
      }
      this.playerAudio.update(delta, {
        horizontalSpeed: player.horizontalSpeed,
        isGrounded: player.isGrounded,
        jumpedEdge: player.jumpedEdge,
        landedEdge: player.landedEdge,
      });
      const web = player.web;
      this.hud.setSwings(web.left, web.max);
      this.updateHud(player);
    }

    this.tickFps(delta);
    this.hub.scoreboard.update(this.network.leaderboard);
    const px = player?.position.x ?? SPAWN.x;
    const pz = player?.position.z ?? SPAWN.z;
    this.sky.follow(px, pz);
    this.hub.update(delta);
    this.stages.update(delta, pz);
    this.enemies.update(delta, this.network.enemies, pz, this.local?.killMasks ?? null);
    this.remotePlayers.advance(delta, player?.position ?? null);
    this.drawRemoteWebs();
    this.drawLocalRope();
    this.webs.update(delta);
    this.celebration.update(delta);
    this.targets.tick(delta);
    this.camera.update(delta, player?.horizontalSpeed ?? 0);
    this.damage.update(this.camera.camera, this.renderer.width, this.renderer.height);

    this.renderer.renderer.render(this.sceneManager.scene, this.camera.camera);
  }

  // ------------------------------------------------------------------ webs

  /** The training building whose pad the player stands on, if any. */
  private padUnderfoot(player: LocalPlayer): number {
    const p = player.position;
    if (p.x < TRAINING.minX - 2 || p.x > TRAINING.maxX + 2 || p.y > TRAINING.floorTop + 1.5) return -1;
    for (const building of BUILDINGS) {
      if (Math.hypot(building.padX - p.x, building.padZ - p.z) <= BUILDING_PAD_RADIUS) return building.tier;
    }
    return -1;
  }

  private webColor(shooterId: number): number {
    return shooterById(shooterId)?.web ?? 0xeaf6ff;
  }

  /**
   * WEB SHOOTING. A click (or the WEB button) fires one web; standing on a
   * building's pad webs it continuously; AUTO CLICK fires on its own ONLY
   * while a live villain of the player's arena is in reach (never at a
   * building or thin air), and while swinging it LOCKS ON to the nearest one
   * in the longer mid-air range. The web plays at once for feel; the server
   * rate-limits it, validates the target and pays.
   */
  private updateWebs(delta: number, wanted: boolean, player: LocalPlayer): void {
    this.sinceAttack += delta;
    const state = this.local;
    const tier = this.padUnderfoot(player);
    const onPad = tier >= 0 && !!state && canTrainOn(tier, state.rebirths);
    const auto = this.autoClick && !!state && state.health > 0;
    if (!wanted && !onPad && !auto) return;
    if (this.sinceAttack < COMBAT.attackInterval || anyWindowOpen()) return;

    const p = player.position;
    const airborne = !player.isGrounded;
    let target = NO_TARGET;
    if (onPad) target = buildingTarget(tier);
    else if (wanted) target = this.targets.aim(p.x, p.y, p.z, player.yaw, !airborne, this.network.enemies, state, auto && airborne);
    else {
      // Auto Click on its own fires ONLY at a live villain of this arena in reach: no enemies, no web.
      target = this.targets.autoTarget(p.x, p.y, p.z, player.yaw, !airborne, this.network.enemies, state);
      if (target === NO_TARGET) return;
    }
    this.sinceAttack = 0;

    let yaw: number | null = null;
    const point = this.targetPoint(target, HIT_POINT);
    if (point) yaw = Math.atan2(point.x - p.x, point.z - p.z);
    const hand = player.shoot(yaw);
    // On a web, only the free (left) hand shoots.
    this.shotHand = player.web.swinging ? 1 : hand;
    player.character.webHand(this.shotHand, HAND);
    const to = point ?? HIT_POINT.set(p.x + Math.sin(player.yaw) * 14, p.y + 6, p.z + Math.cos(player.yaw) * 14);
    this.webs.shoot(HAND, to, this.webColor(state?.shooterId ?? 1), point !== null);
    this.audio.play('web', 1, 0.02);
    this.network.attack(target);
    if (isBuildingTarget(target)) this.hub.strikeBuilding(target - BUILDING_TARGET_BASE);
  }

  /** Where a target is, for aiming and effects; null for thin air. */
  private targetPoint(target: number, out: Vector3): Vector3 | null {
    if (target === NO_TARGET) return null;
    if (isBuildingTarget(target)) {
      const aim = buildingAimPoint(target - BUILDING_TARGET_BASE);
      return out.set(aim.x, aim.y, aim.z);
    }
    const def = ENEMIES[target];
    const enemy = this.network.enemies?.[target];
    if (!def || !enemy) return null;
    return out.set(enemy.x, def.scale * 1.8, enemy.z);
  }

  /** The local player's swing web, from the hand to the anchor, while it holds. */
  private drawLocalRope(): void {
    const player = this.localPlayer;
    if (!player) return;
    const web = player.web;
    if (!web.swinging) return;
    player.character.webHand(0, HAND);
    ANCHOR.set(web.x, web.y, web.z);
    this.webs.rope('local', HAND, ANCHOR, this.webColor(this.local?.shooterId ?? 1));
  }

  /** Other players' webs: each shot they fire, and the web they hang from. */
  private drawRemoteWebs(): void {
    this.remotePlayers.forEachVisible((remote, sessionId) => {
      const color = this.webColor(remote.shooter);
      if (remote.onWeb) {
        remote.character.webHand(0, HAND);
        ANCHOR.set(remote.anchor.x, remote.anchor.y, remote.anchor.z);
        this.webs.rope(sessionId, HAND, ANCHOR, color);
      }
      if (remote.attacked) {
        remote.attacked = false;
        remote.character.webHand(remote.onWeb ? 1 : remote.variant, HAND);
        HIT_POINT.set(remote.shotAt.x, remote.shotAt.y, remote.shotAt.z);
        this.webs.shoot(HAND, HIT_POINT, color, true);
      }
      remote.swung = false;
    });
  }

  private screenOf(point: Vector3): { x: number; y: number } | null {
    SCREEN.copy(point).project(this.camera.camera);
    if (SCREEN.z > 1) return null;
    return { x: (SCREEN.x * 0.5 + 0.5) * this.renderer.width, y: (-SCREEN.y * 0.5 + 0.5) * this.renderer.height };
  }

  private onHit(message: HitMessage): void {
    if (message.gain > 0) {
      const point = message.target === NO_TARGET ? null : this.targetPoint(message.target, HIT_POINT);
      const at = point ? this.screenOf(point) : null;
      const jitter = (): number => (Math.random() - 0.5) * 60;
      this.hud.pop(`+${formatAmount(message.gain)}`, 'gain', at ? at.x + jitter() : undefined, at ? at.y - 40 + jitter() : undefined);
    }
    if (message.target === NO_TARGET) return;
    this.targets.noteHit(message.target);
    if (isBuildingTarget(message.target)) return;
    const def = ENEMIES[message.target];
    const enemy = this.network.enemies?.[message.target];
    if (def && enemy && message.damage > 0) this.damage.show(message.damage, enemy.x, def.scale * 3.4, enemy.z, message.killed);
  }

  private onGearDropped(message: GearDroppedMessage): void {
    const name = gearLabel(message.gearId, message.rarity);
    if (message.uid > 0) {
      this.audio.play('unlock');
      this.hud.toast(`Gear drop: ${name}! Open your Backpack to equip it.`, message.rarity >= 2 ? 'pink' : 'gold');
    } else {
      this.audio.play('refuse');
      this.hud.toast(`${name} dropped, but your gear bag is full!`, 'bad');
    }
  }

  // ----------------------------------------------------------------- pads

  /**
   * PADS: standing on one is a REQUEST, sent once per visit. Suit pads buy or
   * wear, a Win pad claims (only when the wave is down), the return pad goes
   * home, an egg pad opens its egg, the Web Shooter stand opens its shop.
   */
  private updatePads(delta: number, player: LocalPlayer): void {
    const p = player.position;
    const state = this.local;
    this.claimCooldown = Math.max(0, this.claimCooldown - delta);
    let pad = '';

    for (const suit of SUIT_PADS) {
      if (Math.abs(p.x - (suit.x + 1)) <= suit.half && Math.abs(p.z - suit.z) <= suit.half && Math.abs(p.y - suit.y) < 1.2) {
        pad = `suit:${suit.slot}`;
        if (this.onPad !== pad) this.network.suitPad(suit.slot);
      }
    }

    const stage = stageAt(p.z, STAGE_COUNT);
    if (stage > 0 && state) {
      const reward = rewardPadOf(stage);
      if (Math.abs(p.x - reward.x) <= reward.half && Math.abs(p.z - reward.z) <= reward.half && p.y < 2) {
        pad = `reward:${stage}`;
        const def = stageByIndex(stage)!;
        const cleared = (state.killMasks[stage - 1] ?? 0) === def.fullMask;
        if (cleared && this.claimCooldown <= 0) {
          this.claimCooldown = 0.6;
          this.network.claimStage(stage);
        } else if (!cleared && this.onPad !== pad) {
          this.hud.toast('Defeat every villain to claim this stage!', 'bad');
        }
      }
      const back = returnPadOf(stage);
      if (Math.abs(p.x - back.x) <= back.half && Math.abs(p.z - back.z) <= back.half && p.y < 2) {
        pad = `return:${stage}`;
        if (this.onPad !== pad) this.network.teleport('spawn');
      }
    }

    let egg = 0;
    for (const placement of EGG_PLACEMENTS) {
      if (Math.hypot(p.x - placement.x, p.z - PETS_SHOP.padZ) <= PETS_SHOP.padHalf + 0.6 && p.y < 2) egg = placement.egg;
    }
    if (egg !== this.lastEggPad) {
      this.lastEggPad = egg;
      if (egg > 0) {
        this.closeAll();
        this.eggWindow.openEgg(egg);
      } else if (this.eggWindow.isOpen) {
        this.eggWindow.setOpen(false);
      }
    }

    const atShop = Math.hypot(p.x - SHOOTER_SHOP.x, p.z - SHOOTER_SHOP.frontZ) <= SHOOTER_SHOP.serviceRadius - 4 && p.y < 3;
    if (atShop !== this.atShop) {
      this.atShop = atShop;
      if (atShop) {
        this.closeAll();
        this.shopWindow.setOpen(true);
      } else if (this.shopWindow.isOpen) {
        this.shopWindow.setOpen(false);
      }
    }
    this.onPad = pad;
  }

  // ------------------------------------------------------------------ HUD

  private updateHud(player: LocalPlayer): void {
    const state = this.local;
    if (!state) return;
    const p = player.position;
    const stage = stageAt(p.z, STAGE_COUNT);
    const def = stage > 0 ? stageByIndex(stage) : undefined;

    const focus = this.targets.focus(p.x, p.z, this.network.enemies, state);
    let info = '';
    if (def) {
      const alive = EnemyManager.aliveIn(stage, this.network.enemies);
      info = `Stage ${def.index}: ${def.name}<small>Villains ${def.enemies.length - alive}/${def.enemies.length} defeated - Recommended Web Power ${formatAmount(def.recommendedPower)} - Reward ${formatWins(def.reward)} Trophies</small>`;
    }
    this.hud.setFocus(
      focus ? { name: focus.name, value: focus.value, max: focus.max, boss: focus.boss, lock: focus.lockText, building: focus.kind === 'building' } : null,
      info,
    );
    this.hud.setHealth(state.health, state.maxHealth, stage > 0 || state.health < state.maxHealth);
    this.hud.setHint(anyWindowOpen() ? '' : this.hintFor(state, stage, player));
  }

  private hintFor(state: NetPlayerState, stage: number, player: LocalPlayer): string {
    const touch = document.body.classList.contains('aoe-touch-mode');
    const tier = this.padUnderfoot(player);
    if (tier >= 0 && !canTrainOn(tier, state.rebirths)) {
      const t = TRAINING_TIERS[tier]!;
      return `${t.name} needs ${t.rebirthsRequired} Rebirth${t.rebirthsRequired === 1 ? '' : 's'}`;
    }
    if (canRebirth(state.level, state.rebirths) && stage === 0) return 'You can Rebirth! Open the Rebirth menu' + (touch ? '' : ' (R)');
    if (stage > 0) {
      const def = stageByIndex(stage)!;
      if ((state.killMasks[stage - 1] ?? 0) === def.fullMask) {
        return stage < STAGE_COUNT
          ? `Stage cleared! Claim ${formatWins(def.reward)} Trophies on the gold pad - or push on to Stage ${stage + 1}`
          : `Final stage cleared! Claim your ${formatWins(def.reward)} Trophies on the gold pad`;
      }
      if (state.webPower < def.recommendedPower) return `This stage recommends ${formatAmount(def.recommendedPower)} Web Power - train at the buildings to get stronger!`;
      return '';
    }
    if (state.bestStage === 0 && state.webPower < 20) {
      return touch ? 'Tap WEB to shoot webs and gain Web Power! Training buildings are to your LEFT' : 'Click to shoot webs and gain Web Power! Training buildings are to your LEFT';
    }
    if (state.bestStage === 0 && state.webPower < 60) return touch ? 'Double-tap JUMP to web-swing!' : 'Jump, then press Space again in mid-air to web-swing!';
    const nextSuit = SUITS.find((suit) => !ownsSuit(state.ownedSuits, suit.slot));
    if (nextSuit?.slot === 1) return 'Become Spider-Man! Claim the Classic Suit FREE at Suit Upgrades, to your RIGHT';
    if (nextSuit && state.wins >= nextSuit.cost) return `You can afford the ${nextSuit.name}! Suit Upgrades are to your RIGHT`;
    if (state.pets.length === 0 && state.wins >= 400) return 'Hatch a pet at the eggs behind you!';
    if (state.bestStage === 0 && state.webPower >= 60) return 'Head through the portal ahead to stop the villains of Stage 1!';
    return '';
  }

  private tickFps(delta: number): void {
    if (this.fpsReadout.hidden) return;
    this.fpsAccum += delta;
    this.fpsFrames += 1;
    if (this.fpsAccum < 0.5) return;
    this.fpsReadout.textContent = `${Math.round(this.fpsFrames / this.fpsAccum)} FPS`;
    this.fpsAccum = 0;
    this.fpsFrames = 0;
  }

  private flushInput(): void {
    const player = this.localPlayer;
    if (!player) return;
    for (const message of player.drainOutgoing()) this.network.sendInput(message);
  }

  private applyPendingRespawn(): void {
    const player = this.localPlayer;
    const message = this.pendingRespawn;
    if (!player || !message) return;
    this.pendingRespawn = null;
    player.teleport(message.x, message.y, message.z, message.rotationY);
    this.input.look.setYaw(message.rotationY);
    this.targets.clear();
  }

  private snapCameraIfPlaced(): void {
    const player = this.localPlayer;
    if (!player) return;
    const placement = player.consumePlacement();
    if (placement === 'none') return;
    this.camera.snapTo(player.position, placement === 'respawn');
  }

  // ---------------------------------------------------------------- state

  private onPlayerAdded(sessionId: string, state: NetPlayerState): void {
    if (sessionId === this.localSessionId) {
      this.applyLocalState(state);
      return;
    }
    this.remotePlayers.add(sessionId, state);
    this.bloxity.playerJoined(sessionId);
    this.bloxity.playerInRoom(sessionId);
  }

  private onPlayerChanged(sessionId: string, state: NetPlayerState): void {
    if (sessionId === this.localSessionId) {
      this.applyLocalState(state);
      return;
    }
    this.remotePlayers.update(sessionId, state);
  }

  private backpackState(state: NetPlayerState): BackpackState {
    const pets: NetPet[] = [];
    for (let i = 0; i < state.pets.length; i += 1) {
      const pet = state.pets[i];
      if (pet) pets.push({ uid: pet.uid, petId: pet.petId, equipped: pet.equipped });
    }
    const gear: NetGear[] = [];
    for (let i = 0; i < state.gear.length; i += 1) {
      const piece = state.gear[i];
      if (piece) gear.push({ uid: piece.uid, gearId: piece.gearId, rarity: piece.rarity, equipped: piece.equipped });
    }
    return {
      wins: state.wins,
      rebirths: state.rebirths,
      suitSlot: state.suitSlot,
      ownedSuits: state.ownedSuits,
      shooterId: state.shooterId,
      ownedShooters: state.ownedShooters,
      pets,
      gear,
      avatarUrl: state.avatarUrl,
    };
  }

  private refreshWindows(state: NetPlayerState): void {
    const backpack = this.backpackState(state);
    this.backpack.setState(backpack);
    this.eggWindow.setState(state.wins, state.pets.length);
    this.shopWindow.setState(state.wins, state.ownedShooters, state.shooterId);
    this.teleportWindow.setState(state.bestStage, state.webPower);
    this.statsWindow.setState({
      level: state.level,
      xp: state.xp,
      webPower: state.webPower,
      bestWebPower: state.bestWebPower,
      gainPerClick: state.gainPerClick,
      suitSlot: state.suitSlot,
      ownedSuits: state.ownedSuits,
      shooterId: state.shooterId,
      ownedShooters: state.ownedShooters,
      rebirths: state.rebirths,
      petIds: backpack.pets.filter((pet) => pet.equipped).map((pet) => pet.petId),
      gear: backpack.gear,
      moveSpeed: state.moveSpeed,
      maxSwings: state.maxSwings,
      health: state.health,
      maxHealth: state.maxHealth,
      defense: state.defense,
      wins: state.wins,
      lifetimeWins: state.lifetimeWins,
      kills: state.kills,
      totalDamage: state.totalDamage,
      bestStage: state.bestStage,
      playSeconds: state.playSeconds,
    });
  }

  /** Everything the server says about the local player. It derives none of it. */
  private applyLocalState(state: NetPlayerState): void {
    const player = this.localPlayer;
    if (!player) return;
    this.local = state;

    player.setParams(state.moveSpeed, state.jumpVelocity, state.runStage, state.maxSwings);
    player.setLook(lookOf(state));
    // 0 health is the server's death state. The death sound plays once, as it begins.
    const dead = state.health <= 0;
    if (dead && !player.character.dead) this.audio.play('death');
    player.character.setDead(dead);
    player.setDisplayName(state.displayName, state.avatarUrl);
    const petIds: number[] = [];
    for (let i = 0; i < state.pets.length; i += 1) {
      const pet = state.pets[i];
      if (pet?.equipped) petIds.push(pet.petId);
    }
    player.setPets(petIds);

    if (state.ready) {
      player.reconcile({
        x: state.x,
        y: state.y,
        z: state.z,
        rotationY: state.rotationY,
        velocityX: state.velocityX,
        velocityY: state.velocityY,
        velocityZ: state.velocityZ,
        grounded: state.grounded,
        jumpLatched: state.jumpLatched,
        jumpCount: state.jumpCount,
        swingsLeft: state.swingsLeft,
        swinging: state.swinging,
        anchorX: state.anchorX,
        anchorY: state.anchorY,
        anchorZ: state.anchorZ,
        ropeLength: state.ropeLength,
        swingTime: state.swingTime,
        swingDirX: state.swingDirX,
        swingDirZ: state.swingDirZ,
        swingCount: state.swingCount,
        lastInputSeq: state.lastInputSeq,
      });
    }

    this.hud.setStatus({
      xp: state.xp,
      webPower: state.webPower,
      speed: state.moveSpeed,
      swingsLeft: player.web.left,
      maxSwings: state.maxSwings,
      rebirths: state.rebirths,
      wins: state.wins,
    });
    this.hub.setSuits(state.wins, state.ownedSuits, state.suitSlot);
    this.hub.setRebirths(state.rebirths);
    this.stages.setProgress(state.runStage, state.killMasks);

    const level = levelForXp(state.xp).level;
    if (this.lastLevel >= 0 && level > this.lastLevel && state.rebirths === this.lastRebirths) {
      this.audio.play('level');
      this.hud.levelUp(this.lastLevel, level, state.moveSpeed);
    }
    if (this.lastRebirths >= 0 && state.rebirths > this.lastRebirths) this.audio.play('rebirth');
    if (this.lastSuit !== state.suitSlot) {
      this.lastSuit = state.suitSlot;
      const suit = suitBySlot(state.suitSlot);
      if (suit && this.lastLevel >= 0) this.hud.toast(`${suit.name}!`, 'gold');
    }
    this.lastLevel = level;
    this.lastRebirths = state.rebirths;

    this.rebirthWindow.setProgress(state.xp, state.rebirths);
    this.rebirthButton.setReady(this.rebirthWindow.isEligible);
    this.rebirthButton.setPercent(this.rebirthWindow.isEligible ? '' : `${Math.floor(this.rebirthWindow.progress * 100)}%`);
    this.refreshWindows(state);
    const affordableSuit = SUITS.some((suit) => !ownsSuit(state.ownedSuits, suit.slot) && state.wins >= suit.cost);
    this.backpackButton.setReady(this.backpack.hasNew || affordableSuit);
  }

  private onNotice(message: NoticeMessage): void {
    switch (message.kind) {
      case 'bought':
        this.audio.play('unlock');
        this.hud.toast(message.text, 'good');
        break;
      case 'equipped':
        this.audio.play('buy');
        this.hud.toast(message.text, 'good');
        break;
      case 'rebirth':
        this.hud.toast(message.text, 'pink');
        break;
      case 'refused':
      case 'locked':
        this.audio.play('refuse');
        this.hud.toast(message.text, 'bad');
        break;
      case 'info':
        this.hud.toast(message.text, 'gold');
        break;
    }
  }

  private onStageCleared(message: StageClearedMessage): void {
    const def = stageByIndex(message.stage);
    this.audio.play('claim');
    this.hud.toast(`${def?.name ?? `Stage ${message.stage}`} cleared! Claim your Trophies or push on`, 'gold');
  }

  /** A claim the SERVER granted (once per claim): the trophy celebration, then the server sends us home. */
  private onStageAwarded(message: StageAwardedMessage): void {
    if (this.localPlayer) this.celebration.play(this.localPlayer.position);
    this.audio.play('win');
    this.hud.toast(`+${formatWins(message.wins)} Troph${message.wins === 1 ? 'y' : 'ies'}!`, 'gold');
    logger.info(SCOPE, `stage ${message.stage} banked: +${message.wins} wins`);
  }

  private onStatusChange(status: ConnectionStatus): void {
    if (clientConfig.debug) logger.info(SCOPE, `connection: ${status}`);
  }

  dispose(): void {
    this.stop();
    this.hud.dispose();
    this.damage.dispose();
    this.webs.dispose();
    this.celebration.dispose();
    this.enemies.dispose();
    this.backpack.dispose();
    this.rebirthWindow.dispose();
    this.eggWindow.dispose();
    this.shopWindow.dispose();
    this.teleportWindow.dispose();
    this.statsWindow.dispose();
    this.portraits.dispose();
    window.removeEventListener('keydown', this.onHotkey);
    window.removeEventListener('keydown', this.onGesture);
    window.removeEventListener('mousedown', this.onGesture);
    window.removeEventListener('touchstart', this.onGesture);
    this.bloxity.dispose();
    this.bloxityPanel.dispose();
    this.fpsReadout.remove();
    this.audio.dispose();
    this.remotePlayers.dispose();
    this.hub?.dispose();
    this.stages.dispose();
    this.sky.dispose();
    this.renderer.dispose();
  }
}
