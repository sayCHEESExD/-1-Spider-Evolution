import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderTarget,
  type Object3D,
  Vector3,
  type WebGLRenderer,
} from 'three';
import { createAnimationInput } from '../animation/AnimationInput.js';
import { PlayerAnimator } from '../animation/PlayerAnimator.js';
import { PlayerRig } from '../animation/rig/PlayerRig.js';
import { createPetModel } from '../pets/PetModels.js';
import { PartBuilder } from '../render/PartBuilder.js';
import { gearParts, shooterParts } from '../suits/GearModels.js';
import { createSuitBody } from '../suits/SuitBody.js';

const SIZE = 192;

/**
 * PORTRAITS OF THE REAL MODELS for the menus: each suit, pet, gear piece and
 * web shooter rendered
 * once, on demand, through the game's own renderer into a small offscreen
 * target and kept as an image URL. The menus show exactly what walks around
 * the world, with no image files shipped for any of it.
 */
export class ModelPortraits {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(30, 1, 0.1, 50);
  private readonly target = new WebGLRenderTarget(SIZE, SIZE);
  private readonly cache = new Map<string, string>();
  private readonly holder = new Group();

  constructor(private readonly renderer: WebGLRenderer) {
    this.target.texture.colorSpace = SRGBColorSpace;
    this.scene.add(new HemisphereLight(0xffffff, 0xd8c8b0, 1.4));
    this.scene.add(new AmbientLight(0xffffff, 0.6));
    const key = new DirectionalLight(0xffffff, 1.8);
    key.position.set(2, 4, 5);
    this.scene.add(key);
    this.scene.add(this.holder);
  }

  suit(slot: number): string {
    return this.get(`suit:${slot}`, () => {
      const model = createSuitBody({ suit: slot, shooter: 1, gear: [] });
      const visual = new Group();
      visual.add(model);
      const animator = new PlayerAnimator(new PlayerRig(model, model), visual);
      const input = createAnimationInput();
      input.drawn = true;
      for (let i = 0; i < 12; i += 1) animator.update(0.1, input);
      visual.rotation.y = -0.35;
      this.camera.position.set(0, 1.9, 8.2);
      this.camera.lookAt(0, 1.65, 0);
      return visual;
    });
  }

  /** A gear piece on its own, as it is worn. */
  gear(gearId: number, rarity: number): string {
    return this.get(`gear:${gearId}:${rarity}`, () => {
      const group = new Group();
      const context = { head: 0.95, torsoW: 1.1, torsoD: 0.55, torsoH: 1.1, limb: 0.55 };
      for (const part of gearParts(gearId, rarity, 1)) {
        const builder = new PartBuilder();
        part.build(builder, context);
        const built = builder.build(`gear-${gearId}`, false);
        // Back pieces are seen from behind; the rest from the front.
        if (part.mount === 'back' || part.mount === 'backLow') built.rotation.y = Math.PI;
        group.add(built);
      }
      group.rotation.y = -0.4;
      this.frame(group, 1.3);
      return group;
    });
  }

  /** A web shooter cartridge, big. */
  shooter(id: number): string {
    return this.get(`shooter:${id}`, () => {
      const group = new Group();
      const builder = new PartBuilder();
      shooterParts(id)[0]!.build(builder, { head: 0.95, torsoW: 1.1, torsoD: 0.55, torsoH: 1.1, limb: 0.55 });
      const built = builder.build(`shooter-${id}`, false);
      built.rotation.set(0.5, -0.6, 0);
      group.add(built);
      this.frame(group, 1.2);
      return group;
    });
  }

  pet(petId: number): string {
    return this.get(`pet:${petId}`, () => {
      const model = createPetModel(petId);
      model.rotation.y = -0.45;
      this.frame(model, 1.5);
      return model;
    });
  }

  /** Point the camera so an object fills the portrait, whatever its size. */
  private frame(object: Object3D, fill = 1.7): void {
    object.updateMatrixWorld(true);
    const box = new Box3().setFromObject(object);
    const size = box.getSize(new Vector3());
    const centre = box.getCenter(new Vector3());
    const radius = Math.max(size.x, size.y, size.z, 0.2) * 0.5;
    const distance = (radius * fill) / Math.tan((this.camera.fov * Math.PI) / 360);
    this.camera.position.set(centre.x, centre.y + radius * 0.25, centre.z + distance);
    this.camera.lookAt(centre);
  }

  private get(key: string, build: () => Object3D): string {
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;
    let url = '';
    try {
      const object = build();
      this.holder.add(object);
      this.camera.aspect = 1;
      this.camera.updateProjectionMatrix();
      const previousTarget = this.renderer.getRenderTarget();
      const previousColor = new Color();
      this.renderer.getClearColor(previousColor);
      const previousAlpha = this.renderer.getClearAlpha();
      this.renderer.setRenderTarget(this.target);
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.clear(true, true, true);
      this.renderer.render(this.scene, this.camera);
      const pixels = new Uint8Array(SIZE * SIZE * 4);
      this.renderer.readRenderTargetPixels(this.target, 0, 0, SIZE, SIZE, pixels);
      this.renderer.setRenderTarget(previousTarget);
      this.renderer.setClearColor(previousColor, previousAlpha);
      this.holder.remove(object);

      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d')!;
      const image = ctx.createImageData(SIZE, SIZE);
      // The target is bottom-up; the canvas is top-down.
      for (let y = 0; y < SIZE; y += 1) {
        image.data.set(pixels.subarray((SIZE - 1 - y) * SIZE * 4, (SIZE - y) * SIZE * 4), y * SIZE * 4);
      }
      ctx.putImageData(image, 0, 0);
      url = canvas.toDataURL('image/png');
    } catch {
      url = '';
    }
    this.cache.set(key, url);
    return url;
  }

  dispose(): void {
    this.target.dispose();
    this.cache.clear();
  }
}
