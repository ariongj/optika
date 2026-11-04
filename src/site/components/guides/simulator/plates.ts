// The three worlds the visitor looks at through the lens: real panoramas (CC0, Poly Haven) with the near objects
// path-traced into them under the panorama's own light. Baked ahead of time, so a phone only has to show two images.
//
//   <id>.webp / <id>-sm.webp   colour, rectilinear, centred on the resting view
//   <id>-d.webp                data, lossless: R vergence (0–6 D), G highlights above white (log2 / 5), B what a polariser removes
import * as THREE from 'three';
import { asset } from '@/lib/paths';

export type SceneId = 'street' | 'drive' | 'desk';

/** How far the plates reach from their centre, as tangents. */
export const PLATE_TAN = { x: 0.9, y: 0.7 };
const WIDTH = { wide: 2048, small: 1280 };

export interface Plate {
  color: THREE.Texture;
  data: THREE.Texture;
  width: number;
  dispose(): void;
}

/** Decoded off the main thread, and as stored: no colour management may touch the data map. */
async function bitmap(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return createImageBitmap(await res.blob(), { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
}

export async function loadPlate(id: SceneId, wide: boolean, anisotropy: number): Promise<Plate> {
  const width = wide ? WIDTH.wide : WIDTH.small;
  const [colorImage, dataImage] = await Promise.all([bitmap(asset(`/images/sim/${id}${wide ? '' : '-sm'}.webp`)), bitmap(asset(`/images/sim/${id}-d.webp`))]);

  const color = new THREE.Texture(colorImage as unknown as HTMLImageElement);
  color.flipY = false;
  color.colorSpace = THREE.SRGBColorSpace;
  color.generateMipmaps = true;
  color.minFilter = THREE.LinearMipmapLinearFilter;
  color.magFilter = THREE.LinearFilter;
  color.anisotropy = anisotropy;
  color.needsUpdate = true;

  const data = new THREE.Texture(dataImage as unknown as HTMLImageElement);
  data.flipY = false;
  data.colorSpace = THREE.NoColorSpace;
  data.generateMipmaps = true;
  data.minFilter = THREE.LinearMipmapLinearFilter;
  data.magFilter = THREE.LinearFilter;
  data.needsUpdate = true;

  return {
    color,
    data,
    width,
    dispose() {
      color.dispose();
      data.dispose();
      colorImage.close();
      dataImage.close();
    },
  };
}
