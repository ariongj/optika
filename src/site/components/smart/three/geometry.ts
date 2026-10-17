// Procedural geometry helpers for the smart-glasses model (all lengths in millimetres).
import * as THREE from 'three';

export const TAU = Math.PI * 2;
export type V2 = THREE.Vector2;
export const v2 = (x: number, y: number) => new THREE.Vector2(x, y);
export const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
export const easeInOut = (x: number) => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

/* ------------------------------------------------------------------ */
/* 2D polylines                                                         */
/* ------------------------------------------------------------------ */
export function signedArea(pts: V2[]) {
  let a = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/** Evenly spaced points along a closed polyline. */
export function resampleClosed(pts: V2[], n: number): V2[] {
  const m = pts.length;
  const cum = [0];
  for (let i = 1; i <= m; i += 1) cum.push(cum[i - 1] + pts[i % m].distanceTo(pts[i - 1]));
  const total = cum[m];
  const out: V2[] = [];
  let j = 0;
  for (let k = 0; k < n; k += 1) {
    const d = (k / n) * total;
    while (j < m - 1 && cum[j + 1] < d) j += 1;
    const span = cum[j + 1] - cum[j] || 1;
    out.push(pts[j].clone().lerp(pts[(j + 1) % m], (d - cum[j]) / span));
  }
  return out;
}

/** Evenly spaced points along an open polyline (both ends kept). */
export function resampleOpen(pts: V2[], n: number): V2[] {
  const cum = [0];
  for (let i = 1; i < pts.length; i += 1) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const total = cum[cum.length - 1];
  const out: V2[] = [];
  let j = 0;
  for (let k = 0; k < n; k += 1) {
    const d = (k / (n - 1)) * total;
    while (j < pts.length - 2 && cum[j + 1] < d) j += 1;
    const span = cum[j + 1] - cum[j] || 1;
    out.push(pts[j].clone().lerp(pts[j + 1], Math.min(1, (d - cum[j]) / span)));
  }
  return out;
}

/** Laplacian smoothing of a closed polyline. */
export function smoothClosed(pts: V2[], iterations: number, k = 0.5): V2[] {
  let cur = pts.map((p) => p.clone());
  for (let it = 0; it < iterations; it += 1) {
    const n = cur.length;
    cur = cur.map((p, i) => {
      const a = cur[(i - 1 + n) % n];
      const b = cur[(i + 1) % n];
      return v2(p.x + k * ((a.x + b.x) / 2 - p.x), p.y + k * ((a.y + b.y) / 2 - p.y));
    });
  }
  return cur;
}

/** Outward unit normals of a closed polyline (either orientation). */
export function outwardNormals(pts: V2[]): V2[] {
  const ccw = signedArea(pts) > 0;
  const n = pts.length;
  return pts.map((_, i) => {
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    const t = v2(b.x - a.x, b.y - a.y).normalize();
    return ccw ? v2(t.y, -t.x) : v2(-t.y, t.x);
  });
}

export function offsetClosed(pts: V2[], width: (p: V2, i: number) => number): V2[] {
  const normals = outwardNormals(pts);
  return pts.map((p, i) => p.clone().addScaledVector(normals[i], width(p, i)));
}

/** Point of a polyline furthest along a direction. */
export function support(pts: V2[], dir: V2, filter?: (p: V2) => boolean) {
  let best = -1;
  let bestDot = -Infinity;
  pts.forEach((p, i) => {
    if (filter && !filter(p)) return;
    const d = p.x * dir.x + p.y * dir.y;
    if (d > bestDot) {
      bestDot = d;
      best = i;
    }
  });
  return best;
}

export function cubic(p0: V2, p1: V2, p2: V2, p3: V2, n: number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const u = 1 - t;
    out.push(
      v2(
        u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
        u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
      ),
    );
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Bending (face-form wrap of a front)                                  */
/* ------------------------------------------------------------------ */
export interface Bend {
  /** z offset at x (mm) */
  z: (x: number) => number;
  /** dz/dx */
  dz: (x: number) => number;
}

export function makeBend(depthAt70: number, quartic = 0): Bend {
  // z = −(a·x² + b·x⁴); depthAt70 split between both terms
  const a = (depthAt70 * (1 - quartic)) / (70 * 70);
  const b = (depthAt70 * quartic) / Math.pow(70, 4);
  return { z: (x) => -(a * x * x + b * x * x * x * x), dz: (x) => -(2 * a * x + 4 * b * x * x * x) };
}

/** Applies z += bend(x + ox) to positions and the matching normal transform. */
export function bendGeometry(geo: THREE.BufferGeometry, bend: Bend, ox = 0) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const nor = geo.attributes.normal as THREE.BufferAttribute | undefined;
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i) + ox;
    pos.setZ(i, pos.getZ(i) + bend.z(x));
    if (nor) {
      n.set(nor.getX(i), nor.getY(i), nor.getZ(i));
      n.x -= bend.dz(x) * n.z;
      n.normalize();
      nor.setXYZ(i, n.x, n.y, n.z);
    }
  }
  pos.needsUpdate = true;
  if (nor) nor.needsUpdate = true;
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
}

/* ------------------------------------------------------------------ */
/* Sweeps (temples, wire rims, patches)                                 */
/* ------------------------------------------------------------------ */
export interface SweepOptions {
  curve: THREE.Curve<THREE.Vector3>;
  rings: number;
  sides: number;
  /** full cross-section width (along the side axis) at u */
  width: (u: number) => number;
  /** full cross-section height (along the up axis) at u */
  height: (u: number) => number;
  /** superellipse exponent (2 = ellipse, higher = squarer) */
  exponent?: number;
  /** partial sweep: arc-length range and angle range (0 = side axis, π/2 = up) */
  u0?: number;
  u1?: number;
  a0?: number;
  a1?: number;
  /** grow the section outwards (patches lying on a surface) */
  inflate?: number;
  /** rounded caps on full sweeps */
  capStart?: number;
  capEnd?: number;
  closed?: boolean;
  /** reference "up" for the section frame; or a function of u */
  up?: THREE.Vector3 | ((u: number) => THREE.Vector3);
  /** mm per texture unit (0 → normalised 0..1 UVs) */
  uvScale?: number;
}

export function sectionPoint(a: number, hw: number, hh: number, e: number) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const p = 2 / e;
  return [hw * Math.sign(c) * Math.pow(Math.abs(c), p), hh * Math.sign(s) * Math.pow(Math.abs(s), p)] as const;
}

/** Cross-section frame of a sweep at u. */
/**
 * Geometric detail of the next model build: 1 = full (desktop, stills); phones build with less — rings, sides and
 * triangle density scale down, invisible at phone size and much quicker to generate.
 */
let DETAIL = 1;
export function setGeometryDetail(d: number) {
  DETAIL = Math.min(1, Math.max(0.4, d));
}
export const geometryDetail = () => DETAIL;

export function sweepFrame(curve: THREE.Curve<THREE.Vector3>, u: number, up: THREE.Vector3) {
  const p = curve.getPointAt(u);
  const t = curve.getTangentAt(u).normalize();
  const s = new THREE.Vector3().crossVectors(t, up);
  if (s.lengthSq() < 1e-8) s.set(1, 0, 0);
  s.normalize();
  const b = new THREE.Vector3().crossVectors(s, t).normalize();
  return { p, t, s, b };
}

export function sweep(o: SweepOptions): THREE.BufferGeometry {
  const u0 = o.u0 ?? 0;
  const u1 = o.u1 ?? 1;
  const partial = o.a0 !== undefined;
  const a0 = o.a0 ?? 0;
  const a1 = o.a1 ?? TAU;
  const e = o.exponent ?? 2;
  const inflate = o.inflate ?? 0;
  const upAt = (u: number) => (typeof o.up === 'function' ? o.up(u) : o.up ?? new THREE.Vector3(0, 1, 0));
  const sides = Math.max(6, Math.round(o.sides * DETAIL));
  const ringCount = Math.max(4, Math.round(o.rings * DETAIL));
  const cols = sides + 1;
  const length = o.curve.getLength();

  type Ring = { u: number; scale: number; push: number };
  const rings: Ring[] = [];
  const capS = o.capStart ?? 0;
  const capE = o.capEnd ?? 0;
  for (let k = capS; k >= 1; k -= 1) rings.push({ u: u0, scale: Math.cos(((k / capS) * Math.PI) / 2), push: -Math.sin(((k / capS) * Math.PI) / 2) });
  for (let i = 0; i <= ringCount; i += 1) rings.push({ u: u0 + (u1 - u0) * (i / ringCount), scale: 1, push: 0 });
  for (let k = 1; k <= capE; k += 1) rings.push({ u: u1, scale: Math.cos(((k / capE) * Math.PI) / 2), push: Math.sin(((k / capE) * Math.PI) / 2) });

  const pos: number[] = [];
  const uv: number[] = [];
  const uv1: number[] = [];
  const tmp = new THREE.Vector3();
  rings.forEach((r, ri) => {
    const f = sweepFrame(o.curve, Math.min(1, Math.max(0, r.u)), upAt(r.u));
    const hw = o.width(r.u) / 2 + inflate;
    const hh = o.height(r.u) / 2 + inflate;
    const capLen = Math.min(hw, hh) * 0.85;
    const centre = f.p.clone().addScaledVector(f.t, r.push * capLen);
    for (let j = 0; j < cols; j += 1) {
      const a = a0 + (a1 - a0) * (j / sides);
      const [x, y] = sectionPoint(a, hw * r.scale, hh * r.scale, e);
      tmp.copy(centre).addScaledVector(f.s, x).addScaledVector(f.b, y);
      pos.push(tmp.x, tmp.y, tmp.z);
      // uv: texture space shared by every sweep on the same curve (mm / uvScale); uv1: normalised 0..1 over this patch
      if (o.uvScale) uv.push((r.u * length) / o.uvScale, (((a / TAU) * (hw + hh) * 3.2) / o.uvScale));
      else uv.push(rings.length > 1 ? ri / (rings.length - 1) : 0, j / sides);
      uv1.push(rings.length > 1 ? ri / (rings.length - 1) : 0, j / sides);
    }
  });

  const idx: number[] = [];
  for (let i = 0; i < rings.length - 1; i += 1) {
    for (let j = 0; j < sides; j += 1) {
      const a = i * cols + j;
      const b = (i + 1) * cols + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('uv1', new THREE.Float32BufferAttribute(uv1, 2));
  geo.setIndex(idx);

  // orientation: normals must point away from the centreline
  const mid = Math.floor(rings.length / 2);
  const f = sweepFrame(o.curve, rings[mid].u, upAt(rings[mid].u));
  const j0 = Math.floor(sides / 2);
  const pa = new THREE.Vector3().fromArray(pos, (mid * cols + j0) * 3);
  const pb = new THREE.Vector3().fromArray(pos, ((mid + 1) * cols + j0) * 3);
  const pc = new THREE.Vector3().fromArray(pos, (mid * cols + j0 + 1) * 3);
  const n = new THREE.Vector3().crossVectors(pb.sub(pa), pc.sub(pa));
  const radial = pa.clone().sub(f.p);
  if (n.dot(radial) < 0) {
    const index = geo.index!;
    for (let i = 0; i < index.count; i += 3) {
      const t = index.getX(i + 1);
      index.setX(i + 1, index.getX(i + 2));
      index.setX(i + 2, t);
    }
  }
  geo.computeVertexNormals();
  if (!partial || o.closed) {
    // weld the seam normals (first / last column share positions)
    const nor = geo.attributes.normal as THREE.BufferAttribute;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    for (let i = 0; i < rings.length; i += 1) {
      const i0 = i * cols;
      const i1 = i * cols + sides;
      a.fromBufferAttribute(nor, i0);
      b.fromBufferAttribute(nor, i1);
      a.add(b).normalize();
      nor.setXYZ(i0, a.x, a.y, a.z);
      nor.setXYZ(i1, a.x, a.y, a.z);
    }
  }
  return geo;
}

/* ------------------------------------------------------------------ */
/* Curved lens shell (fan grid → smooth reflections)                    */
/* ------------------------------------------------------------------ */
export function lensShell(contour: V2[], ringsFull: number, surface: (x: number, y: number) => number, normalAt: (x: number, y: number) => THREE.Vector3) {
  const rings = Math.max(4, Math.round(ringsFull * DETAIL));
  let cx = 0;
  let cy = 0;
  contour.forEach((p) => {
    cx += p.x;
    cy += p.y;
  });
  cx /= contour.length;
  cy /= contour.length;
  const minX = Math.min(...contour.map((p) => p.x));
  const maxX = Math.max(...contour.map((p) => p.x));
  const minY = Math.min(...contour.map((p) => p.y));
  const maxY = Math.max(...contour.map((p) => p.y));
  const n = contour.length;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const push = (x: number, y: number) => {
    pos.push(x, y, surface(x, y));
    const nn = normalAt(x, y);
    nor.push(nn.x, nn.y, nn.z);
    uv.push((x - minX) / (maxX - minX || 1), (y - minY) / (maxY - minY || 1));
  };
  push(cx, cy);
  for (let k = 1; k <= rings; k += 1) {
    const t = k / rings;
    for (let i = 0; i < n; i += 1) push(cx + (contour[i].x - cx) * t, cy + (contour[i].y - cy) * t);
  }
  const idx: number[] = [];
  const ring = (k: number, i: number) => 1 + (k - 1) * n + (i % n);
  for (let i = 0; i < n; i += 1) idx.push(0, ring(1, i), ring(1, i + 1));
  for (let k = 1; k < rings; k += 1) {
    for (let i = 0; i < n; i += 1) {
      const a = ring(k, i);
      const b = ring(k + 1, i);
      const c = ring(k + 1, i + 1);
      const d = ring(k, i + 1);
      idx.push(a, b, c, a, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  // make the winding agree with +z normals
  const a = new THREE.Vector3().fromArray(pos, 0);
  const b = new THREE.Vector3().fromArray(pos, ring(1, 0) * 3);
  const c = new THREE.Vector3().fromArray(pos, ring(1, 1) * 3);
  const fn = new THREE.Vector3().crossVectors(b.sub(a), c.sub(a));
  if (fn.z < 0) {
    const index = geo.index!;
    for (let i = 0; i < index.count; i += 3) {
      const t = index.getX(i + 1);
      index.setX(i + 1, index.getX(i + 2));
      index.setX(i + 2, t);
    }
  }
  geo.computeBoundingSphere();
  return geo;
}

/** Rounded rectangle outline (centred). */
export function roundedRect(w: number, h: number, r: number, seg = 8): V2[] {
  const pts: V2[] = [];
  const hw = w / 2 - r;
  const hh = h / 2 - r;
  const corners: [number, number, number][] = [
    [hw, hh, 0],
    [-hw, hh, Math.PI / 2],
    [-hw, -hh, Math.PI],
    [hw, -hh, (3 * Math.PI) / 2],
  ];
  for (const [x, y, a0] of corners) for (let i = 0; i <= seg; i += 1) pts.push(v2(x + r * Math.cos(a0 + (i / seg) * (Math.PI / 2)), y + r * Math.sin(a0 + (i / seg) * (Math.PI / 2))));
  return pts;
}

/** Frees every geometry / material / texture below an object. */
export function disposeTree(object: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const m = (child as THREE.Mesh | THREE.Sprite).material as THREE.Material | THREE.Material[] | undefined;
    if (m) (Array.isArray(m) ? m : [m]).forEach((mm) => materials.add(mm));
  });
  materials.forEach((m) => {
    Object.values(m as unknown as Record<string, unknown>).forEach((v) => {
      if (v instanceof THREE.Texture) textures.add(v);
    });
    m.dispose();
  });
  geometries.forEach((g) => g.dispose());
  textures.forEach((t) => t.dispose());
}
