// Virtual try-on: frame geometry + look per catalogue product.
//
// Measurements are the catalogue's boxing sizes (lens-bridge-temple, total width) — the 3D frame is a
// dimensional approximation built from them, not a scan. Every swatch value id of the product's `color`
// option maps to a frame colour/finish and a lens tint (optical frames: clear lens with a slight
// reflection; sunglasses: tinted, gradient or mirror). Lens packages (`cat-lente`) are not try-on items.
import type { Product } from '@/lib/types';

export type FrameShape = 'rectangle' | 'square' | 'round' | 'panto' | 'aviator' | 'cat-eye' | 'geometric' | 'wrap';
/** metal = thin wire rims + nose pads; acetate = thick one-piece front; mixed = acetate look + metal pads/hinges */
export type FrameBuild = 'metal' | 'acetate' | 'mixed';
export type FrameFinish = 'metal' | 'gloss' | 'matte' | 'tortoise' | 'crystal';

export interface LensTint {
  /** base tint colour */
  color: string;
  /** 0–1 coverage at the top of the lens */
  opacity: number;
  /** gradient lenses fade towards the bottom to this opacity */
  gradientTo?: number;
  /** mirror coating (strong environment reflection) */
  mirror?: boolean;
}

export interface FrameLook {
  frame: string;
  finish: FrameFinish;
  /** hinges, brow bar, endpieces */
  hardware: string;
  lens: LensTint;
}

export interface FrameDims {
  frameWidth: number;
  lensWidth: number;
  lensHeight: number;
  bridgeWidth: number;
  templeLength: number;
}

export interface TryOnFrame extends FrameDims {
  shape: FrameShape;
  build: FrameBuild;
  kind: 'optical' | 'sun';
  /** keyed by the swatch value id of the product's `color` option */
  colors: Record<string, FrameLook>;
}

/* ------------------------------------------------------------------ */
/* Lens tints                                                          */
/* ------------------------------------------------------------------ */
// Tints are unlit filter layers: what you see is colour × opacity + the face behind × (1 − opacity).
// Mirror coatings are lit (metallic) and pick up reflections.
const LENS = {
  clear: { color: '#ffffff', opacity: 0.05 },
  smoke: { color: '#15181a', opacity: 0.8 },
  deepGrey: { color: '#101213', opacity: 0.86 },
  green: { color: '#1c2a1d', opacity: 0.8 },
  mineralGreen: { color: '#25362a', opacity: 0.78 },
  brown: { color: '#2e1d11', opacity: 0.8 },
  bronze: { color: '#47301b', opacity: 0.8 },
  honeyGradient: { color: '#5e3a14', opacity: 0.84, gradientTo: 0.3 },
  brownGradient: { color: '#3a2415', opacity: 0.85, gradientTo: 0.3 },
  smokeGradient: { color: '#181b1e', opacity: 0.85, gradientTo: 0.3 },
  amber: { color: '#7d5020', opacity: 0.55 },
  amberLight: { color: '#7d5020', opacity: 0.48, gradientTo: 0.2 },
  goldMirror: { color: '#a37c32', opacity: 0.9, mirror: true },
  silverMirror: { color: '#8a949a', opacity: 0.9, mirror: true },
  blueMirror: { color: '#2b5a8a', opacity: 0.9, mirror: true },
} satisfies Record<string, LensTint>;

const GOLD = '#c2a15a';
const CHROME = '#c7cbce';
const look = (frame: string, finish: FrameFinish, lens: LensTint, hardware?: string): FrameLook => ({
  frame,
  finish,
  lens,
  hardware: hardware ?? (finish === 'metal' ? frame : CHROME),
});

/* ------------------------------------------------------------------ */
/* Catalogue frames (product id → try-on spec)                          */
/* ------------------------------------------------------------------ */
export const TRYON_FRAMES: Record<string, TryOnFrame> = {
  // ---------------------------------------------------------------- optical
  'p-prism-m2': {
    shape: 'rectangle', build: 'metal', kind: 'optical',
    frameWidth: 134, lensWidth: 49, lensHeight: 38, bridgeWidth: 19, templeLength: 142,
    colors: {
      chrome: look('#c9ced2', 'metal', LENS.clear),
      smoke: look('#7e8285', 'metal', LENS.clear),
      black: look('#2a2b2d', 'metal', LENS.clear),
      olive: look('#6d7256', 'metal', LENS.clear),
    },
  },
  'p-nova-n04': {
    shape: 'round', build: 'mixed', kind: 'optical',
    frameWidth: 132, lensWidth: 48, lensHeight: 43, bridgeWidth: 20, templeLength: 140,
    colors: {
      pearl: look('#c4beb3', 'gloss', LENS.clear, CHROME),
      ice: look('#aab0b4', 'crystal', LENS.clear, CHROME),
      blackpearl: look('#2f3033', 'gloss', LENS.clear, CHROME),
      champagne: look('#c9b089', 'gloss', LENS.clear, GOLD),
    },
  },
  'p-origin-o06': {
    shape: 'rectangle', build: 'acetate', kind: 'optical',
    frameWidth: 138, lensWidth: 52, lensHeight: 37, bridgeWidth: 18, templeLength: 145,
    colors: {
      graphite: look('#3d3f42', 'matte', LENS.clear),
      navy: look('#2c3546', 'matte', LENS.clear),
      silver: look('#b9bcbf', 'metal', LENS.clear),
      tortoise: look('#5a3a26', 'tortoise', LENS.clear, GOLD),
    },
  },
  // ---------------------------------------------------------------- sunglasses
  'p-vortex-x1': {
    shape: 'square', build: 'acetate', kind: 'sun',
    frameWidth: 138, lensWidth: 51, lensHeight: 42, bridgeWidth: 20, templeLength: 145,
    colors: {
      blackgold: look('#1d1c1a', 'gloss', LENS.smoke, GOLD),
      chrome: look('#262928', 'gloss', LENS.green, CHROME),
      graphite: look('#55585c', 'gloss', LENS.silverMirror, CHROME),
    },
  },
  'p-eclipse-e05': {
    shape: 'aviator', build: 'metal', kind: 'sun',
    frameWidth: 142, lensWidth: 54, lensHeight: 46, bridgeWidth: 18, templeLength: 145,
    colors: {
      blackchrome: look('#2b2a28', 'metal', LENS.goldMirror),
      gunmetal: look('#4e5256', 'metal', LENS.smoke),
      champagne: look('#cbb48a', 'metal', LENS.green),
    },
  },
  'p-solstice-s7': {
    shape: 'panto', build: 'acetate', kind: 'sun',
    frameWidth: 137, lensWidth: 49, lensHeight: 45, bridgeWidth: 21, templeLength: 145,
    colors: {
      amber: look('#8a5226', 'tortoise', LENS.honeyGradient, GOLD),
      dark: look('#4a2f1e', 'tortoise', LENS.green, GOLD),
      caramel: look('#b0773f', 'tortoise', LENS.brownGradient, GOLD),
    },
  },
  'p-riviera-r8': {
    shape: 'cat-eye', build: 'metal', kind: 'sun',
    frameWidth: 139, lensWidth: 53, lensHeight: 42, bridgeWidth: 17, templeLength: 142,
    colors: {
      champagne: look('#d3b98e', 'metal', LENS.brownGradient),
      rose: look('#c99a86', 'metal', LENS.smokeGradient),
      gold: look('#c9a457', 'metal', LENS.green),
    },
  },
  'p-meridian-m9': {
    shape: 'aviator', build: 'metal', kind: 'sun',
    frameWidth: 143, lensWidth: 58, lensHeight: 50, bridgeWidth: 15, templeLength: 145,
    colors: {
      silver: look('#c2c4c4', 'metal', LENS.mineralGreen),
      gunmetal: look('#4e5256', 'metal', LENS.smoke),
      gold: look('#c9a457', 'metal', LENS.brown),
    },
  },
  'p-nera-n10': {
    shape: 'rectangle', build: 'acetate', kind: 'sun',
    frameWidth: 140, lensWidth: 52, lensHeight: 41, bridgeWidth: 19, templeLength: 145,
    colors: {
      matte: look('#1f1f1f', 'matte', LENS.smoke),
      havana: look('#4b3022', 'tortoise', LENS.green, GOLD),
      forest: look('#26302a', 'gloss', LENS.smoke),
    },
  },
  'p-lumen-l11': {
    shape: 'geometric', build: 'acetate', kind: 'sun',
    frameWidth: 138, lensWidth: 50, lensHeight: 43, bridgeWidth: 20, templeLength: 143,
    colors: {
      caramel: look('#c08a4e', 'crystal', LENS.amber, GOLD),
      crystal: look('#ddd8cc', 'crystal', LENS.brownGradient, CHROME),
      ruby: look('#8c3b38', 'crystal', LENS.amberLight, GOLD),
    },
  },
  // ---------------------------------------------------------------- sport
  'p-arc-v3': {
    shape: 'wrap', build: 'acetate', kind: 'sun',
    frameWidth: 144, lensWidth: 55, lensHeight: 39, bridgeWidth: 18, templeLength: 148,
    colors: {
      graphite: look('#3d3f42', 'matte', LENS.smokeGradient),
      cobalt: look('#b4b9be', 'matte', LENS.blueMirror),
      bronze: look('#1e1e1e', 'matte', LENS.bronze),
    },
  },
  'p-atlas-a12': {
    shape: 'wrap', build: 'acetate', kind: 'sun',
    frameWidth: 148, lensWidth: 60, lensHeight: 42, bridgeWidth: 17, templeLength: 130,
    colors: {
      graphite: look('#4a4c4e', 'matte', LENS.deepGrey),
      bronze: look('#1e1e1e', 'matte', LENS.bronze),
      ice: look('#4a4f53', 'crystal', LENS.silverMirror),
    },
  },
};

/** Storefront categories whose products are frames (lens packages live in `cat-lente`). */
export const FRAME_CATEGORIES = ['cat-optike', 'cat-dielli'];

/* ------------------------------------------------------------------ */
/* Resolution (also covers frames added later in the CMS)               */
/* ------------------------------------------------------------------ */
const SHAPE_WORDS: [RegExp, FrameShape][] = [
  [/aviat|avijat/i, 'aviator'],
  [/cat|mace/i, 'cat-eye'],
  [/panto/i, 'panto'],
  [/round|rrumb|okrug/i, 'round'],
  [/wrap|sport|štit/i, 'wrap'],
  [/geom/i, 'geometric'],
  [/square|katror|kvadrat/i, 'square'],
];

function specText(p: Product, re: RegExp) {
  const s = p.specs.find((x) => re.test(x.label.en) || re.test(x.label.sq));
  return s ? `${s.value.en} ${s.value.sq}` : '';
}

/** Try-on spec for a product, or null for products that are not frames (lens packages, accessories). */
export function resolveTryOnFrame(p: Product | undefined): TryOnFrame | null {
  if (!p) return null;
  const known = TRYON_FRAMES[p.id];
  if (known) return known;
  if (!FRAME_CATEGORIES.includes(p.categoryId)) return null;
  // A frame created in the CMS: derive what we can from its specs ("49-19-142", "134 mm", shape).
  const size = specText(p, /^size$|madh/i).match(/(\d{2})\D+(\d{2})\D+(\d{3})/);
  const width = Number(specText(p, /width|gjer/i).match(/(\d{3})/)?.[1]);
  const shapeText = specText(p, /shape|form/i);
  const shape = SHAPE_WORDS.find(([re]) => re.test(shapeText))?.[1] ?? 'rectangle';
  const lensWidth = size ? Number(size[1]) : 51;
  const bridgeWidth = size ? Number(size[2]) : 19;
  const kind = p.categoryId === 'cat-dielli' ? 'sun' : 'optical';
  const metal = /titan|metal|steel|çelik/i.test(specText(p, /material/i));
  return {
    shape,
    build: metal ? 'metal' : 'acetate',
    kind,
    frameWidth: width >= 110 && width <= 170 ? width : lensWidth * 2 + bridgeWidth + 16,
    lensWidth,
    lensHeight: /aviator|round|panto/.test(shape) ? 45 : 40,
    bridgeWidth,
    templeLength: size ? Number(size[3]) : 142,
    colors: {},
  };
}

/** The colour option (swatches) of a frame product. */
export function colorOption(p: Product | undefined) {
  return p?.options.find((o) => o.id === 'color' && o.type === 'swatch') ?? p?.options.find((o) => o.type === 'swatch');
}

/** Frame + lens look for a product colour; unknown swatches fall back to the swatch colour. */
export function lookFor(p: Product, frame: TryOnFrame, colorId: string | undefined): FrameLook {
  if (colorId && frame.colors[colorId]) return frame.colors[colorId];
  const first = Object.values(frame.colors)[0];
  const swatch = colorOption(p)?.values.find((v) => v.id === colorId)?.swatch;
  if (!swatch && first) return first;
  const lens = frame.kind === 'sun' ? LENS.smoke : LENS.clear;
  return look(swatch || '#2a2725', frame.build === 'metal' ? 'metal' : 'gloss', lens);
}
