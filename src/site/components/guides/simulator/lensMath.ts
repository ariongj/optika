// Lens geometry for the simulator: a real meniscus (spherical front and back surfaces) cut to the frame outline.
// Plain numbers only, so the thickness, weight and comparison figures show before three.js has loaded.
import type { FrameShape } from '@/site/tryon/frames';
import { outlinePoints } from '@/site/tryon/outline';
import { clamp } from '@/lib/utils';
import { INDICES, type KnownStrength } from '../lensData';

export interface LensFit {
  shape: FrameShape;
  lensWidth: number;
  lensHeight: number;
  bridge: number;
  /** pupillary distance (mm) */
  pd: number;
}

/**
 * Density (g/cm³) and Abbe number of the usual lens monomers: CR-39, MR-8, MR-7, 1.74 episulfide.
 * offAxis: what is left of a spherical lens's error off-axis. Higher indices are sold with an aspheric surface, which takes
 * out most of it, and the two spherical surfaces traced here would otherwise overstate it badly.
 */
const PHYSICAL: Record<string, { density: number; abbe: number; offAxis: number }> = {
  '1.50': { density: 1.32, abbe: 58, offAxis: 1 },
  '1.60': { density: 1.3, abbe: 42, offAxis: 0.65 },
  '1.67': { density: 1.35, abbe: 32, offAxis: 0.4 },
  '1.74': { density: 1.47, abbe: 33, offAxis: 0.35 },
};

export const MATERIALS = INDICES.map((m) => ({ ...m, ...PHYSICAL[m.label] }));
export type LensMaterial = (typeof MATERIALS)[number];

export function materialOf(n: number): LensMaterial {
  return MATERIALS.find((m) => Math.abs(m.n - n) < 1e-6) ?? MATERIALS[0];
}

/** Thinnest edge of a plus lens (mm): what the lab leaves so it can still be edged and mounted. */
const MIN_EDGE = 1.0;

/** Signed sag (mm) of a spherical surface of power `f` (D) at height `r` (mm). */
export function sag(f: number, n: number, r: number) {
  if (Math.abs(f) < 1e-4) return 0;
  const R = ((n - 1) * 1000) / Math.abs(f);
  const rr = Math.min(r, R * 0.985);
  return Math.sign(f) * (R - Math.sqrt(R * R - rr * rr));
}

/** Slope d(sag)/dr of the same surface, for exact normals. */
export function sagSlope(f: number, n: number, r: number) {
  if (Math.abs(f) < 1e-4) return 0;
  const R = ((n - 1) * 1000) / Math.abs(f);
  const rr = Math.min(r, R * 0.985);
  return (Math.sign(f) * rr) / Math.sqrt(R * R - rr * rr);
}

export interface SolvedLens {
  sph: number;
  n: number;
  /** front and back surface powers (D) */
  f1: number;
  f2: number;
  /** centre thickness (mm) */
  ct: number;
  /** optical centre on the lens x axis (mm); moved towards the nose to sit in front of the pupil */
  ox: number;
  /** frame outline in mm around the boxed centre; +x is the temple side */
  rim: { x: number; y: number }[];
}

const rimCache = new Map<string, { x: number; y: number }[]>();

function rimOf(fit: LensFit) {
  const key = `${fit.shape}:${fit.lensWidth}:${fit.lensHeight}`;
  let rim = rimCache.get(key);
  if (!rim) {
    const raw = outlinePoints(fit.shape, 1);
    const maxX = Math.max(...raw.map((p) => Math.abs(p.x)));
    const maxY = Math.max(...raw.map((p) => Math.abs(p.y)));
    rim = raw.map((p) => ({ x: (p.x * fit.lensWidth) / 2 / maxX, y: (p.y * fit.lensHeight) / 2 / maxY }));
    rimCache.set(key, rim);
  }
  return rim;
}

export function solveLens(sph: number, n: number, centre: number, fit: LensFit): SolvedLens {
  const rim = rimOf(fit);
  const ox = -(fit.lensWidth + fit.bridge - fit.pd) / 2;
  const radii = rim.map((p) => Math.hypot(p.x - ox, p.y));
  // Vogel's rule for the front curve
  const f1 = clamp(sph >= 0 ? sph + 5 : sph / 2 + 6, 1, 10);
  let ct = centre;
  let f2 = sph - f1;
  for (let i = 0; i < 5; i += 1) {
    // back-vertex power, so a thick plus lens still reads the prescribed strength
    f2 = sph - f1 / (1 - (ct / 1000 / n) * f1);
    if (sph <= 0) break;
    let edge = Infinity;
    for (const r of radii) edge = Math.min(edge, ct - sag(f1, n, r) - sag(f2, n, r));
    ct = Math.max(centre, ct + MIN_EDGE - edge);
  }
  return { sph, n, f1, f2, ct, ox, rim };
}

/** Thickness (mm) at a point of the lens. */
export function thicknessAt(l: SolvedLens, x: number, y: number) {
  const r = Math.hypot(x - l.ox, y);
  return l.ct - sag(l.f1, l.n, r) - sag(l.f2, l.n, r);
}

export interface LensStats {
  centre: number;
  /** edge thickness at the temple and at the nose */
  temporal: number;
  nasal: number;
  /** thickest and thinnest point anywhere on the lens */
  max: number;
  min: number;
  /** weight of the pair (g) */
  pairWeight: number;
}

const RINGS = 10;

export function lensStats(l: SolvedLens, density: number): LensStats {
  const { rim } = l;
  let edgeMax = -Infinity;
  let edgeMin = Infinity;
  let temporal = 0;
  let nasal = 0;
  let xMax = -Infinity;
  let xMin = Infinity;
  let volume = 0;
  for (let i = 0; i < rim.length; i += 1) {
    const a = rim[i];
    const b = rim[(i + 1) % rim.length];
    const t = thicknessAt(l, a.x, a.y);
    edgeMax = Math.max(edgeMax, t);
    edgeMin = Math.min(edgeMin, t);
    if (a.x > xMax) {
      xMax = a.x;
      temporal = t;
    }
    if (a.x < xMin) {
      xMin = a.x;
      nasal = t;
    }
    // sector of the outline, split into rings: area x mean thickness
    const area = Math.abs(a.x * b.y - b.x * a.y) / 2;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    for (let k = 0; k < RINGS; k += 1) {
      const u0 = k / RINGS;
      const u1 = (k + 1) / RINGS;
      const u = (u0 + u1) / 2;
      volume += area * (u1 * u1 - u0 * u0) * thicknessAt(l, mx * u, my * u);
    }
  }
  return {
    centre: l.ct,
    temporal,
    nasal,
    max: Math.max(l.ct, edgeMax),
    min: Math.min(l.ct, edgeMin),
    pairWeight: (volume / 1000) * density * 2,
  };
}

/** Horizontal cross-section through the optical centre: front and back surface per x (mm). */
export function crossSection(l: SolvedLens, samples = 44) {
  const xs = l.rim.map((p) => p.x);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const out: { x: number; front: number; back: number }[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const x = x0 + ((x1 - x0) * i) / samples;
    const r = Math.abs(x - l.ox);
    out.push({ x, front: -sag(l.f1, l.n, r), back: -l.ct + sag(l.f2, l.n, r) });
  }
  return out;
}

/** The chooser's strength band for a power (same bands as its answers). */
export function bandOf(power: number): KnownStrength {
  const p = Math.abs(power);
  return p <= 2 ? 'low' : p <= 4 ? 'mid' : p <= 6 ? 'high' : 'vhigh';
}
