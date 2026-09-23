import {
  AdditiveBlending,
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  TextureLoader,
  type Scene,
  type Texture,
  type Vector3,
} from 'three';

/** Seconds the whole celebration lasts; the server sends the player home just after. */
const DURATION = 1.25;
const TROPHIES = 10;

interface Trophy {
  readonly sprite: Sprite;
  readonly material: SpriteMaterial;
  readonly angle: number;
  readonly radius: number;
  readonly height: number;
  readonly delay: number;
}

let trophyTexture: Texture | null = null;
const trophy = (): Texture => {
  if (!trophyTexture) {
    trophyTexture = new TextureLoader().load('/ui/trophy.png');
    trophyTexture.colorSpace = SRGBColorSpace;
  }
  return trophyTexture;
};

/** A soft round glow for the absorb flash (a bare sprite would draw a square). */
const glowTexture = (): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,240,160,0.8)');
  gradient.addColorStop(1, 'rgba(255,200,40,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new CanvasTexture(canvas);
};

/**
 * THE WIN CLAIM CELEBRATION: trophies pop in round the hero, spiral in and
 * are absorbed into them with a golden flash. Played ONLY for a claim the
 * server granted (its StageAwarded message), once per message; while one is
 * playing a second is ignored. Presentation only - it grants nothing.
 */
export class ClaimCelebration {
  private readonly root = new Group();
  private readonly trophies: Trophy[] = [];
  private readonly ring: Mesh;
  private readonly ringMaterial: MeshBasicMaterial;
  private readonly flash: Sprite;
  private readonly flashMaterial: SpriteMaterial;
  private time = -1;
  private anchor: Vector3 | null = null;

  constructor(scene: Scene) {
    this.root.name = 'claim-celebration';
    this.root.visible = false;
    for (let i = 0; i < TROPHIES; i += 1) {
      const material = new SpriteMaterial({ map: trophy(), transparent: true, depthWrite: false, fog: false });
      const sprite = new Sprite(material);
      this.root.add(sprite);
      this.trophies.push({
        sprite,
        material,
        angle: (i / TROPHIES) * Math.PI * 2,
        radius: 3.4 + (i % 3) * 0.6,
        height: 0.8 + (i % 4) * 0.9,
        delay: (i % 5) * 0.05,
      });
    }
    this.ringMaterial = new MeshBasicMaterial({ color: 0xffd23a, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
    this.ring = new Mesh(new RingGeometry(0.8, 1.2, 36), this.ringMaterial);
    this.ring.rotation.x = -Math.PI / 2;
    this.root.add(this.ring);
    this.flashMaterial = new SpriteMaterial({ map: glowTexture(), color: 0xfff1a0, transparent: true, blending: AdditiveBlending, depthWrite: false, fog: false });
    this.flash = new Sprite(this.flashMaterial);
    this.root.add(this.flash);
    scene.add(this.root);
  }

  get playing(): boolean {
    return this.time >= 0;
  }

  /** Start round the hero at `anchor` (followed as it moves). A second call while playing is ignored. */
  play(anchor: Vector3): boolean {
    if (this.playing) return false;
    this.anchor = anchor;
    this.time = 0;
    this.root.visible = true;
    this.update(0);
    return true;
  }

  update(delta: number): void {
    if (this.time < 0 || !this.anchor) return;
    this.time += delta;
    const t = this.time / DURATION;
    if (t >= 1) {
      this.time = -1;
      this.root.visible = false;
      return;
    }
    this.root.position.copy(this.anchor);

    for (const trophy of this.trophies) {
      // Each trophy: pop in, hover while circling, then spiral into the chest and vanish.
      const k = Math.min(1, Math.max(0, (t - trophy.delay) / (1 - trophy.delay)));
      const popIn = Math.min(1, k / 0.18);
      const inward = k < 0.35 ? 0 : (k - 0.35) / 0.65;
      const eased = inward * inward * (3 - 2 * inward);
      const angle = trophy.angle + k * 3.2;
      const radius = trophy.radius * (1 - eased);
      const y = trophy.height + (2 - trophy.height) * eased + Math.sin(k * Math.PI * 2) * 0.25 * (1 - eased);
      trophy.sprite.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      const size = (0.3 + 0.9 * popIn) * (1 - eased * 0.75) * (k > 0 ? 1 : 0);
      trophy.sprite.scale.set(size, size, 1);
      trophy.material.opacity = k > 0.88 ? (1 - k) / 0.12 : popIn;
    }

    // A ground ring that blooms out, and a flash as the last trophies land.
    const ring = 1 + t * 5;
    this.ring.scale.set(ring, ring, 1);
    this.ring.position.y = 0.12;
    this.ringMaterial.opacity = 0.8 * (1 - t);
    const land = Math.max(0, (t - 0.7) / 0.3);
    const burst = Math.sin(land * Math.PI);
    this.flash.position.y = 1.9;
    this.flash.scale.set(0.1 + burst * 5, 0.1 + burst * 5, 1);
    this.flashMaterial.opacity = burst * 0.9;
  }

  dispose(): void {
    for (const trophy of this.trophies) trophy.material.dispose();
    this.ring.geometry.dispose();
    this.ringMaterial.dispose();
    this.flashMaterial.map?.dispose();
    this.flashMaterial.dispose();
    this.root.removeFromParent();
  }
}
