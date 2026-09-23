import { formatAmount } from '@spider/shared';
import { Vector3, type PerspectiveCamera } from 'three';

const LIFE_MS = 750;
const MAX_POPUPS = 6;
const WORLD = new Vector3();

interface Popup {
  readonly element: HTMLDivElement;
  x: number;
  y: number;
  z: number;
  born: number;
}

/**
 * ONE damage number per landed hit - the server's own figure, never a
 * random or a duplicated one - floating up from what was hit. DOM elements
 * projected from the world each frame, capped at six at once.
 */
export class DamagePopups {
  private readonly root: HTMLDivElement;
  private readonly popups: Popup[] = [];

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'ke-dmg-layer';
    parent.appendChild(this.root);
  }

  show(damage: number, x: number, y: number, z: number, killed: boolean): void {
    if (this.popups.length >= MAX_POPUPS) this.popups.shift()?.element.remove();
    const element = document.createElement('div');
    element.className = `ke-dmg ke-outline${killed ? ' ke-dmg--kill' : ''}`;
    element.textContent = `-${formatAmount(damage)}`;
    this.root.appendChild(element);
    this.popups.push({ element, x, y, z, born: performance.now() });
  }

  update(camera: PerspectiveCamera, width: number, height: number): void {
    const now = performance.now();
    for (let i = this.popups.length - 1; i >= 0; i -= 1) {
      const popup = this.popups[i]!;
      const age = (now - popup.born) / LIFE_MS;
      if (age >= 1) {
        popup.element.remove();
        this.popups.splice(i, 1);
        continue;
      }
      WORLD.set(popup.x, popup.y + age * 1.6, popup.z).project(camera);
      if (WORLD.z > 1) {
        popup.element.style.opacity = '0';
        continue;
      }
      const sx = (WORLD.x * 0.5 + 0.5) * width;
      const sy = (-WORLD.y * 0.5 + 0.5) * height;
      const scale = age < 0.15 ? 0.6 + age * 4 : 1.2 - age * 0.3;
      popup.element.style.transform = `translate(-50%, -50%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) scale(${scale.toFixed(3)})`;
      popup.element.style.opacity = age > 0.7 ? String(1 - (age - 0.7) / 0.3) : '1';
    }
  }

  dispose(): void {
    this.root.remove();
  }
}
