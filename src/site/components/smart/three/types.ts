// Shared types for the real-time smart-glasses model (no three.js imports here — safe for the main bundle).

export type SmartVariant = 'camera' | 'audio' | 'display' | 'sport';
export type SmartColorway = 'black' | 'tortoise' | 'clear' | 'sand' | 'white';
export type SmartPart = 'camera' | 'led' | 'speaker' | 'mics' | 'touch' | 'battery' | 'display' | 'hinge';
/** Frame silhouette. Defaults: camera/audio/display → wayfarer, sport → wrap. */
export type SmartShape = 'wayfarer' | 'aviator' | 'cateye' | 'wrap';
export type SmartBackground = 'transparent' | 'dark' | 'light';

export interface SmartPartPoint {
  /** 0..1 of the canvas width (left → right) */
  x: number;
  /** 0..1 of the canvas height (top → bottom) */
  y: number;
  /** facing the camera (and, for the battery, pulled out far enough to be seen) */
  visible: boolean;
}
export type SmartPartPoints = Partial<Record<SmartPart, SmartPartPoint>>;

/** Where the model sits in the canvas. Defaults: centred, ~74 % of the width. */
export interface SmartFraming {
  /** share of the canvas width the model occupies at rest (0..1) */
  fill?: number;
  /** maximum share of the canvas height (0..1) */
  fillHeight?: number;
  /** horizontal shift of the model centre, in canvas widths (−0.5..0.5, + = right) */
  offsetX?: number;
  /** vertical shift of the model centre, in canvas heights (+ = up) */
  offsetY?: number;
}

export interface SmartGlasses3DProps {
  variant?: SmartVariant;
  colorway?: SmartColorway;
  /** optional silhouette override (camera variant: 'aviator' | 'cateye' for the Aviator / Zena styles) */
  shape?: SmartShape;
  /** 0..1, parts separate along their axes (scroll-driven) */
  exploded?: number;
  /** radians; null = autoRotate / idle sway */
  rotation?: { yaw: number; pitch: number } | null;
  /** gentle idle motion (off under prefers-reduced-motion) */
  autoRotate?: boolean;
  /** drag to rotate (pointer / horizontal touch), never blocks vertical page scroll */
  interactive?: boolean;
  /** highlight (glow) one part */
  activePart?: SmartPart | null;
  /** 'display' variant: glowing in-lens HUD */
  showDisplayHud?: boolean;
  background?: SmartBackground;
  /** per-frame screen positions (0..1 of the canvas), throttled to ~30 fps */
  onParts?: (pts: SmartPartPoints) => void;
  onReady?: () => void;
  /** image shown until the first WebGL frame (and kept if WebGL is unavailable) */
  poster?: string;
  className?: string;
  framing?: SmartFraming;
  /** accessible name; without it the canvas is treated as decorative */
  label?: string;
}

/** Storytelling order. */
export const SMART_PARTS: SmartPart[] = ['camera', 'led', 'speaker', 'mics', 'touch', 'battery', 'display', 'hinge'];

export const SHAPE_FOR_VARIANT: Record<SmartVariant, SmartShape> = { camera: 'wayfarer', audio: 'wayfarer', display: 'wayfarer', sport: 'wrap' };

/** Parts a variant actually has (audio: no camera / LED; only 'display' has the in-lens display). */
export function partsForVariant(variant: SmartVariant): SmartPart[] {
  return SMART_PARTS.filter((p) => {
    if (variant === 'audio' && (p === 'camera' || p === 'led')) return false;
    if (p === 'display' && variant !== 'display') return false;
    return true;
  });
}
