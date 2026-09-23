import {
  AdditiveBlending,
  CanvasTexture,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Scene,
} from 'three';

/**
 * THE WEBS, drawn: every web shot zips a strand from the shooter's wrist to
 * where it hit and leaves a web splat there; every player hanging from a web
 * has a strand from their hand to its anchor. Pooled, and entirely
 * presentation - the server decides what a web did; this shows that it flew.
 */

let webCanvas: HTMLCanvasElement | null = null;

/** A spider-web splat, drawn once: spokes and rings in white. */
export const webSplatCanvas = (): HTMLCanvasElement => {
  if (webCanvas) return webCanvas;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = size / 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineCap = 'round';
  ctx.lineWidth = 3;
  const spokes = 10;
  for (let i = 0; i < spokes; i += 1) {
    const a = (i / spokes) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(c + Math.cos(a) * 60, c + Math.sin(a) * 60);
    ctx.stroke();
  }
  ctx.lineWidth = 2.2;
  for (let r = 12; r <= 56; r += 11) {
    ctx.beginPath();
    for (let i = 0; i <= spokes; i += 1) {
      const a = (i / spokes) * Math.PI * 2;
      // Sagging threads between the spokes.
      const mid = ((i - 0.5) / spokes) * Math.PI * 2;
      if (i === 0) ctx.moveTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
      else ctx.quadraticCurveTo(c + Math.cos(mid) * r * 0.9, c + Math.sin(mid) * r * 0.9, c + Math.cos(a) * r, c + Math.sin(a) * r);
    }
    ctx.stroke();
  }
  webCanvas = canvas;
  return canvas;
};

let splatTexture: CanvasTexture | null = null;
const splat = (): CanvasTexture => {
  if (!splatTexture) {
    splatTexture = new CanvasTexture(webSplatCanvas());
    splatTexture.colorSpace = SRGBColorSpace;
  }
  return splatTexture;
};

const UNIT_STRAND = new CylinderGeometry(1, 1, 1, 5, 1, true);
const UP = new Vector3(0, 1, 0);
const DIR = new Vector3();

/** Lay a unit strand between two points with a radius. */
const span = (mesh: Mesh, from: Vector3, to: Vector3, radius: number, reach = 1): void => {
  DIR.subVectors(to, from);
  const length = Math.max(0.001, DIR.length() * reach);
  DIR.normalize();
  mesh.quaternion.setFromUnitVectors(UP, DIR);
  mesh.scale.set(radius, length, radius);
  mesh.position.copy(from).addScaledVector(DIR, length / 2);
};

interface Shot {
  readonly strand: Mesh;
  readonly material: MeshBasicMaterial;
  readonly splat: Sprite;
  readonly splatMaterial: SpriteMaterial;
  readonly from: Vector3;
  readonly to: Vector3;
  age: number;
  active: boolean;
}

interface Rope {
  readonly strand: Mesh;
  readonly material: MeshBasicMaterial;
  seen: boolean;
}

const SHOT_ZIP = 0.08;
const SHOT_HOLD = 0.3;
const SPLAT_LIFE = 0.75;

export class WebEffects {
  readonly root = new Group();
  private readonly shots: Shot[] = [];
  private readonly ropes = new Map<string, Rope>();

  constructor(scene: Scene) {
    this.root.name = 'webs';
    scene.add(this.root);
  }

  /** A web shot from a wrist to a point (a target, or into the air). */
  shoot(from: Vector3, to: Vector3, color: number, splatAtEnd = true): void {
    let shot = this.shots.find((entry) => !entry.active);
    if (!shot) {
      if (this.shots.length >= 32) shot = this.shots.reduce((oldest, entry) => (entry.age > oldest.age ? entry : oldest));
      else {
        const material = new MeshBasicMaterial({ color, transparent: true, fog: false });
        const strand = new Mesh(UNIT_STRAND, material);
        strand.frustumCulled = false;
        const splatMaterial = new SpriteMaterial({ map: splat(), color, transparent: true, depthWrite: false });
        const sprite = new Sprite(splatMaterial);
        this.root.add(strand, sprite);
        shot = { strand, material, splat: sprite, splatMaterial, from: new Vector3(), to: new Vector3(), age: 0, active: false };
        this.shots.push(shot);
      }
    }
    shot.from.copy(from);
    shot.to.copy(to);
    shot.age = 0;
    shot.active = true;
    shot.material.color.setHex(color);
    shot.splatMaterial.color.setHex(color);
    shot.strand.visible = true;
    shot.splat.visible = splatAtEnd;
    shot.splat.position.copy(to);
    shot.splat.scale.setScalar(0.01);
    shot.splat.userData['splat'] = splatAtEnd;
  }

  /** The web a player hangs from, this frame. Ropes not drawn in a frame are hidden. */
  rope(id: string, from: Vector3, to: Vector3, color: number): void {
    let rope = this.ropes.get(id);
    if (!rope) {
      const material = new MeshBasicMaterial({ color, fog: false });
      const strand = new Mesh(UNIT_STRAND, material);
      strand.frustumCulled = false;
      this.root.add(strand);
      rope = { strand, material, seen: true };
      this.ropes.set(id, rope);
    }
    rope.seen = true;
    rope.material.color.setHex(color);
    rope.strand.visible = true;
    span(rope.strand, from, to, 0.045);
  }

  update(delta: number): void {
    for (const shot of this.shots) {
      if (!shot.active) continue;
      shot.age += delta;
      const t = shot.age;
      if (t < SHOT_ZIP + SHOT_HOLD) {
        span(shot.strand, shot.from, shot.to, 0.05, Math.min(1, t / SHOT_ZIP));
        shot.material.opacity = t < SHOT_ZIP ? 1 : 1 - (t - SHOT_ZIP) / SHOT_HOLD;
      } else {
        shot.strand.visible = false;
      }
      if (shot.splat.userData['splat'] === true && t >= SHOT_ZIP) {
        const k = (t - SHOT_ZIP) / SPLAT_LIFE;
        shot.splat.scale.setScalar(0.4 + Math.min(1, k * 5) * 1.6);
        shot.splatMaterial.opacity = Math.max(0, 1 - k * k);
        shot.splat.visible = k < 1;
      }
      if (t >= SHOT_ZIP + Math.max(SHOT_HOLD, SPLAT_LIFE)) {
        shot.active = false;
        shot.strand.visible = false;
        shot.splat.visible = false;
      }
    }
    for (const rope of this.ropes.values()) {
      if (!rope.seen) rope.strand.visible = false;
      rope.seen = false;
    }
  }

  /** A player left: let go of their rope for good. */
  dropRope(id: string): void {
    const rope = this.ropes.get(id);
    if (!rope) return;
    rope.strand.removeFromParent();
    rope.material.dispose();
    this.ropes.delete(id);
  }

  dispose(): void {
    for (const shot of this.shots) {
      shot.material.dispose();
      shot.splatMaterial.dispose();
    }
    for (const id of [...this.ropes.keys()]) this.dropRope(id);
    this.root.removeFromParent();
  }
}

/** A soft additive glow sprite, for gear drops and pickups. */
export const glowSprite = (color: number): Sprite => {
  const material = new SpriteMaterial({ map: splat(), color, blending: AdditiveBlending, transparent: true, depthWrite: false });
  return new Sprite(material);
};
