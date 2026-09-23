import { CanvasTexture, NearestFilter, SRGBColorSpace, type Texture } from 'three';
import { PLAYER_TEXTURE_SETTINGS } from '../config/assets.js';
import type { LookPalette } from './EnemyLooks.js';

const cache = new Map<string, Texture>();

/**
 * The player atlas, RECOLOURED for an enemy.
 *
 * The supplied 64x64 atlas is teal cloth, darker teal trim and warm orange
 * detail. Each pixel is classified by hue - cool greens and blues are cloth
 * or trim by lightness, warm tones are skin - and repainted in the enemy's
 * palette at the same relative lightness, so the shading the atlas was
 * painted with survives the recolour. Done once per look, on a canvas.
 */
export const recoloredAtlas = (source: HTMLImageElement | ImageBitmap | HTMLCanvasElement, palette: LookPalette): Texture => {
  const key = `${palette.cloth}:${palette.trim}:${palette.skin}`;
  const existing = cache.get(key);
  if (existing) return existing;

  const width = (source as { width: number }).width || 64;
  const height = (source as { height: number }).height || 64;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source as CanvasImageSource, 0, 0);
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const rgb = (hex: number): [number, number, number] => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
  const cloth = rgb(palette.cloth);
  const trim = rgb(palette.trim);
  const skin = rgb(palette.skin);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const light = (max + min) / 510;
    let hue = 0;
    if (max !== min) {
      const d = max - min;
      if (max === r) hue = ((g - b) / d) % 6;
      else if (max === g) hue = (b - r) / d + 2;
      else hue = (r - g) / d + 4;
      hue *= 60;
      if (hue < 0) hue += 360;
    }
    const saturated = max - min > 18;
    let target: [number, number, number] | null = null;
    let reference = 0.5;
    if (saturated && hue >= 90 && hue <= 260) {
      target = light > 0.3 ? cloth : trim;
      reference = light > 0.3 ? 0.45 : 0.22;
    } else if (saturated && (hue < 60 || hue > 330)) {
      target = skin;
      reference = 0.55;
    }
    if (!target) continue;
    const shade = Math.min(1.6, Math.max(0.35, light / reference));
    data[i] = Math.min(255, target[0] * shade);
    data[i + 1] = Math.min(255, target[1] * shade);
    data[i + 2] = Math.min(255, target[2] * shade);
  }
  ctx.putImageData(image, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.flipY = PLAYER_TEXTURE_SETTINGS.flipY;
  texture.generateMipmaps = false;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  cache.set(key, texture);
  return texture;
};
