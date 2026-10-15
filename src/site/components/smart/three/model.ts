// Procedural smart-glasses model (millimetres internally, scaled to scene units by the root group).
// Fronts are rounded acetate slabs (cap + pill-profile edges, face-form bend) or thin metal wire rims (aviator);
// temples are superellipse sweeps that house the battery and the open-ear speaker. Every feature part
// (camera, LED, mics, speaker, touch pad, battery, display, hinge) registers an anchor, explode movers and
// highlight materials so the stage can animate and project them.
import * as THREE from 'three';
import type { SmartColorway, SmartPart, SmartShape, SmartVariant } from './types';
import { MINT, LED_WHITE, createLook, glowSprite, type Look } from './materials';
import {
  TAU,
  bendGeometry,
  clamp01,
  cubic,
  easeInOut,
  lensShell,
  makeBend,
  offsetClosed,
  outwardNormals,
  resampleClosed,
  roundedRect,
  sectionPoint,
  signedArea,
  smooth,
  smoothClosed,
  support,
  sweep,
  sweepFrame,
  v2,
  v3,
  disposeTree,
  type Bend,
  type V2,
} from './geometry';

export const MM = 0.01;

export interface ModelOptions {
  variant: SmartVariant;
  colorway: SmartColorway;
  shape: SmartShape;
  transparentBg: boolean;
}

export interface ModelFrameState {
  exploded: number;
  highlight: Record<SmartPart, number>;
  hud: number;
  led: number;
  time: number;
  reduced: boolean;
}

export interface PartAnchor {
  /** +z of this object is the outward surface normal */
  anchor: THREE.Object3D;
  /** only visible once pulled out (battery) */
  hidden?: boolean;
}

export interface GlassesModel {
  /** centred, scaled to scene units */
  root: THREE.Group;
  anchors: Partial<Record<SmartPart, PartAnchor>>;
  update(s: ModelFrameState): void;
  dispose(): void;
}

/* ------------------------------------------------------------------ */
/* Shape catalogue                                                     */
/* ------------------------------------------------------------------ */
interface FrontSpec {
  W: number;
  H: number;
  bridge: number;
  /** edge radius of the acetate slab */
  /** in-plane growth of the rounded edge */
  r: number;
  /** rounding of the edge through the depth (≥ r, ≤ depth / 2) */
  rt: number;
  depth: number;
  bend: Bend;
  tilt: number;
  hingeFrac: number;
  apexFrac: number;
  topLift: number;
  /** horizontal / vertical push of the upper-outer corner (endpiece wing), mm */
  wing: [number, number, number];
  /** direction of the corner housing (camera / LED) from the lens centre */
  cornerDir: [number, number];
  rim: (ux: number, uy: number) => number;
}

function frontSpec(shape: SmartShape, variant: SmartVariant): FrontSpec {
  const thick = variant === 'display' ? 1.12 : 1;
  switch (shape) {
    case 'cateye':
      return {
        W: 52,
        H: 38,
        bridge: 19,
        r: 1.3,
        rt: 2.4,
        depth: 6.8 * thick,
        bend: makeBend(6.5),
        tilt: 0.1,
        hingeFrac: 0.66,
        apexFrac: 0.45,
        topLift: -0.6,
        wing: [3.0, 2.8, -0.55],
        cornerDir: [1, 0.62],
        rim: (ux, uy) => {
          const up = smooth((uy + 0.1) / 0.9);
          const dn = smooth((-uy - 0.1) / 0.9);
          let w = 3.9 + up * (0.6 + 1.6 * smooth((ux + 0.2) / 1.2)) - 0.8 * dn;
          w += 1.6 * smooth((ux - 0.3) / 0.6) * smooth((uy + 0.05) / 0.75);
          w -= 0.6 * smooth((-ux - 0.5) / 0.5) * dn;
          return w * thick;
        },
      };
    case 'wrap':
      return {
        W: 57,
        H: 41,
        bridge: 15,
        r: 1.25,
        rt: 2.2,
        depth: 6.2,
        bend: makeBend(24, 0.55),
        tilt: 0.12,
        hingeFrac: 0.56,
        apexFrac: 0.4,
        topLift: 0.4,
        wing: [2.6, 0.4, -0.5],
        cornerDir: [1, 0.4],
        rim: (ux, uy) => {
          const up = smooth((uy + 0.1) / 0.9);
          const dn = smooth((-uy - 0.1) / 0.9);
          let w = 3.9 + 1.9 * up - 1.4 * dn;
          w += 1.2 * smooth((ux - 0.5) / 0.5) * smooth((uy + 0.25) / 0.8);
          return w;
        },
      };
    case 'aviator':
      return {
        W: 54,
        H: 46,
        bridge: 16,
        r: 1,
        rt: 1,
        depth: 2.4,
        bend: makeBend(6),
        tilt: 0.1,
        hingeFrac: 0.6,
        apexFrac: 0.3,
        topLift: 0,
        wing: [0, 0, 0],
        cornerDir: [1, 0.5],
        rim: () => 1.8,
      };
    default:
      return {
        W: 50,
        H: 39,
        bridge: 21,
        r: 1.35,
        rt: 2.7,
        depth: 7.2 * thick,
        bend: makeBend(7.5),
        tilt: 0.1,
        hingeFrac: 0.62,
        apexFrac: 0.5,
        topLift: 0.3,
        wing: [2.4, 0.5, -0.75],
        cornerDir: [1, 0.5],
        rim: (ux, uy) => {
          const up = smooth((uy + 0.1) / 0.9);
          const dn = smooth((-uy - 0.1) / 0.9);
          let w = 4.8 + 1.5 * up - 1.15 * dn;
          w += 0.6 * Math.max(0, ux) * (1 - dn);
          w += 1.4 * smooth((ux - 0.35) / 0.55) * smooth((uy - 0.05) / 0.7);
          w -= 0.7 * smooth((-ux - 0.5) / 0.5) * dn;
          return w * thick;
        },
      };
  }
}

/** Visible lens (aperture) outline of the viewer's right lens; +x = temple side. */
export function lensOutline(shape: SmartShape, W: number, H: number, n = 260): V2[] {
  const raw: V2[] = [];
  const N = 720;
  // per-quadrant superellipse exponents: [top-temporal, top-nasal, bottom-nasal, bottom-temporal]
  const quad = (t: number, e: [number, number, number, number]) => {
    const c = Math.cos(t);
    const s = Math.sin(t);
    const k = s >= 0 ? (c >= 0 ? e[0] : e[1]) : c >= 0 ? e[3] : e[2];
    return [Math.sign(c) * Math.pow(Math.abs(c), 2 / k), Math.sign(s) * Math.pow(Math.abs(s), 2 / k)] as const;
  };
  for (let i = 0; i < N; i += 1) {
    const t = (i / N) * TAU;
    let x: number;
    let y: number;
    switch (shape) {
      case 'cateye': {
        [x, y] = quad(t, [6, 2.7, 2.3, 2.6]);
        x *= 1 + 0.12 * y;
        // upswept outer corner, lower nasal brow
        y += 0.42 * Math.pow(Math.max(0, x), 3) * Math.max(0, y + 0.2);
        y -= 0.16 * Math.max(0, -x + 0.1) * Math.max(0, y);
        break;
      }
      case 'aviator': {
        [x, y] = quad(t, [3.0, 3.0, 2.0, 2.2]);
        const low = Math.max(0, -y);
        x -= 0.2 * low * low * (0.95 + 0.3 * x); // bowl swings towards the nose
        y -= 0.16 * low * low;
        y += 0.06 * x * Math.max(0, y); // brow rises gently to the temple
        break;
      }
      case 'wrap': {
        [x, y] = quad(t, [4.6, 4.2, 3.0, 3.4]);
        y -= 0.12 * Math.max(0, -y) * (0.5 + 0.5 * x);
        if (x < -0.25 && y < 0) y *= 1 - 0.3 * smooth((-x - 0.25) / 0.75);
        y += 0.05 * x * Math.max(0, y);
        break;
      }
      default: {
        [x, y] = quad(t, [4.6, 3.4, 2.5, 2.9]);
        x *= 1 + 0.1 * y; // wider at the brow
        y += 0.08 * (x + 0.4) * Math.max(0, y); // brow rises to the temple
      }
    }
    raw.push(v2(x, y));
  }
  const minX = Math.min(...raw.map((p) => p.x));
  const maxX = Math.max(...raw.map((p) => p.x));
  const minY = Math.min(...raw.map((p) => p.y));
  const maxY = Math.max(...raw.map((p) => p.y));
  const sx = W / (maxX - minX);
  const sy = H / (maxY - minY);
  const ox = (maxX + minX) / 2;
  const oy = (maxY + minY) / 2;
  const pts = raw.map((p) => v2((p.x - ox) * sx, (p.y - oy) * sy));
  if (signedArea(pts) < 0) pts.reverse();
  return resampleClosed(pts, n);
}

/* ------------------------------------------------------------------ */
/* Slab: rounded acetate plate with holes                              */
/* ------------------------------------------------------------------ */
function subdivide(tris: [V2, V2, V2][], maxLen: number) {
  const out: [V2, V2, V2][] = [];
  const stack = tris.slice();
  while (stack.length) {
    const [a, b, c] = stack.pop()!;
    const ab = a.distanceTo(b);
    const bc = b.distanceTo(c);
    const ca = c.distanceTo(a);
    const m = Math.max(ab, bc, ca);
    if (m <= maxLen) {
      out.push([a, b, c]);
      continue;
    }
    if (m === ab) {
      const d = a.clone().lerp(b, 0.5);
      stack.push([a, d, c], [d, b, c]);
    } else if (m === bc) {
      const d = b.clone().lerp(c, 0.5);
      stack.push([a, b, d], [a, d, c]);
    } else {
      const d = c.clone().lerp(a, 0.5);
      stack.push([a, b, d], [d, b, c]);
    }
  }
  return out;
}

/**
 * Plate between z = 0 (front cap) and z = −depth with a pill-profile edge of radius r on every loop. The edge
 * grows outwards from the outline and into the holes by r. Bent by `bend` (x offset `ox`).
 */
function slab(outline: V2[], holes: V2[][], depth: number, r: number, rt: number, bend: Bend | null, uvScale: number, ox = 0, seg = 8) {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let base = 0;

  // caps
  const contour = outline.slice();
  const holePts = holes.map((h) => h.slice());
  const all = contour.concat(...holePts);
  const faces = THREE.ShapeUtils.triangulateShape(contour, holePts);
  const tris = subdivide(
    faces.map((f) => [all[f[0]], all[f[1]], all[f[2]]] as [V2, V2, V2]),
    2.6,
  );
  for (const side of [1, -1]) {
    const z = side > 0 ? 0 : -depth;
    for (const t of tris) {
      const ccw = (t[1].x - t[0].x) * (t[2].y - t[0].y) - (t[2].x - t[0].x) * (t[1].y - t[0].y) > 0;
      const order = ccw === side > 0 ? [0, 1, 2] : [0, 2, 1];
      for (const k of order) {
        pos.push(t[k].x, t[k].y, z);
        nor.push(0, 0, side);
        uv.push((t[k].x + ox) / uvScale, t[k].y / uvScale);
      }
      idx.push(base, base + 1, base + 2);
      base += 3;
    }
  }

  // pill edges
  const prof: { off: number; z: number; no: number; nz: number }[] = [];
  for (let k = 0; k <= seg; k += 1) {
    const f = (k / seg) * (Math.PI / 2);
    const nl = Math.hypot(rt * Math.sin(f), r * Math.cos(f));
    prof.push({ off: r * Math.sin(f), z: -rt * (1 - Math.cos(f)), no: (rt * Math.sin(f)) / nl, nz: (r * Math.cos(f)) / nl });
  }
  for (let k = 0; k <= seg; k += 1) {
    const f = Math.PI / 2 + (k / seg) * (Math.PI / 2);
    const nl = Math.hypot(rt * Math.sin(f), r * Math.cos(f));
    prof.push({ off: r * Math.sin(f), z: -(depth - rt) + rt * Math.cos(f), no: (rt * Math.sin(f)) / nl, nz: (r * Math.cos(f)) / nl });
  }
  const loops: { pts: V2[]; normals: V2[] }[] = [{ pts: contour, normals: outwardNormals(contour) }];
  holePts.forEach((h) => loops.push({ pts: h, normals: outwardNormals(h).map((n) => n.clone().negate()) }));
  for (const loop of loops) {
    const n = loop.pts.length;
    const start = base;
    let along = 0;
    for (let i = 0; i < n; i += 1) {
      if (i > 0) along += loop.pts[i].distanceTo(loop.pts[i - 1]);
      for (const p of prof) {
        const q = loop.pts[i];
        const nn = loop.normals[i];
        pos.push(q.x + nn.x * p.off, q.y + nn.y * p.off, p.z);
        nor.push(nn.x * p.no, nn.y * p.no, p.nz);
        uv.push(along / uvScale, p.z / uvScale);
      }
    }
    const rows = prof.length;
    const quad: number[] = [];
    for (let i = 0; i < n; i += 1) {
      const i2 = (i + 1) % n;
      for (let k = 0; k < rows - 1; k += 1) {
        const a = start + i * rows + k;
        const b = start + i2 * rows + k;
        const c = start + i2 * rows + k + 1;
        const d = start + i * rows + k + 1;
        quad.push(a, b, c, a, c, d);
      }
    }
    // winding: face normal must agree with the vertex normal
    const ia = quad[0];
    const ib = quad[1];
    const ic = quad[2];
    const pa = v3(pos[ia * 3], pos[ia * 3 + 1], pos[ia * 3 + 2]);
    const pb = v3(pos[ib * 3], pos[ib * 3 + 1], pos[ib * 3 + 2]);
    const pc = v3(pos[ic * 3], pos[ic * 3 + 1], pos[ic * 3 + 2]);
    const fn = new THREE.Vector3().crossVectors(pb.sub(pa), pc.sub(pa));
    const vn = v3(nor[ia * 3], nor[ia * 3 + 1], nor[ia * 3 + 2]);
    if (fn.dot(vn) < 0) for (let q = 0; q < quad.length; q += 3) idx.push(quad[q], quad[q + 2], quad[q + 1]);
    else idx.push(...quad);
    base += n * rows;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  if (bend) bendGeometry(geo, bend, ox);
  else {
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
  }
  return geo;
}

/* ------------------------------------------------------------------ */
/* Front outline (two rims + bridge)                                    */
/* ------------------------------------------------------------------ */
function stitchFront(O: V2[], cx: number, spec: FrontSpec) {
  // O: material outline around the right lens, in front coordinates; make it clockwise
  const ring = signedArea(O) > 0 ? O.slice().reverse() : O.slice();
  const nasal = (p: V2) => p.x < cx;
  const iTop = support(ring, v2(-0.12, 1).normalize(), nasal);
  const iBot = support(ring, v2(-1, 0.32).normalize(), nasal);
  const n = ring.length;
  const tangent = (i: number) => ring[(i + 1) % n].clone().sub(ring[(i - 1 + n) % n]).normalize();
  const arc: V2[] = [];
  for (let i = iTop; ; i = (i + 1) % n) {
    arc.push(ring[i]);
    if (i === iBot) break;
  }
  const J = ring[iTop];
  const Jb = ring[iBot];
  const topY = Math.max(...ring.map((p) => p.y));
  const T = v2(0, Math.max(J.y, topY - 1.2) + spec.topLift);
  const A = v2(0, spec.apexFrac * (spec.H / 2));
  const tTop = tangent(iTop);
  const tBot = tangent(iBot);
  const k1 = J.x * 0.5;
  const top = cubic(T, v2(k1, T.y), J.clone().addScaledVector(tTop, -k1), J, 24);
  const k3 = Math.max(2, (A.y - Jb.y) * 0.55);
  const arch = cubic(Jb, Jb.clone().addScaledVector(tBot, k3), v2(Jb.x * 0.55, A.y), A, 28);
  const right = top.slice(0, -1).concat(arc, arch.slice(1));
  // no dips along the brow: from the bridge out to the highest point of the wing the top edge only rises
  let apex = 0;
  right.forEach((p, i) => {
    if (p.y > right[apex].y) apex = i;
  });
  for (let i = 1; i <= apex; i += 1) right[i] = v2(right[i].x, Math.max(right[i].y, right[i - 1].y - 0.02 * (right[i].x - right[i - 1].x)));
  const left = right
    .slice(1, -1)
    .map((p) => v2(-p.x, p.y))
    .reverse();
  return smoothClosed(resampleClosed(right.concat(left), 900), 6);
}

/* ------------------------------------------------------------------ */
/* Small parts                                                         */
/* ------------------------------------------------------------------ */
function orientTo(obj: THREE.Object3D, normal: THREE.Vector3) {
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().normalize());
}

function cameraModule(look: Look, R: number) {
  const g = new THREE.Group();
  const well = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.02, R * 1.02, 1.6, 48), look.recess);
  well.rotation.x = Math.PI / 2;
  well.position.z = -0.6;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 1.02, R * 0.14, 16, 72), look.cameraRing);
  ring.position.z = 0.16;
  const inner = new THREE.Mesh(new THREE.RingGeometry(R * 0.3, R * 0.62, 48), look.cameraInner);
  inner.position.z = 0.24;
  const inner2 = new THREE.Mesh(new THREE.TorusGeometry(R * 0.64, R * 0.05, 8, 48), look.cameraInner);
  inner2.position.z = 0.24;
  const pupil = new THREE.Mesh(new THREE.CircleGeometry(R * 0.3, 32), look.micHole);
  pupil.position.z = 0.25;
  const domeR = R * 2.2;
  const cap = Math.asin(Math.min(0.99, (R * 0.98) / domeR));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(domeR, 48, 16, 0, TAU, 0, cap), look.cameraGlass);
  dome.rotation.x = Math.PI / 2;
  dome.position.z = 0.2 - domeR * Math.cos(cap);
  dome.renderOrder = 6;
  g.add(well, ring, inner, inner2, pupil, dome);
  return g;
}

function ledModule(look: Look, R: number) {
  const g = new THREE.Group();
  const well = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.05, R * 1.05, 1.2, 32), look.recess);
  well.rotation.x = Math.PI / 2;
  well.position.z = -0.45;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 1.05, R * 0.16, 12, 48), look.hardware);
  ring.position.z = 0.1;
  const domeR = R * 1.6;
  const cap = Math.asin(Math.min(0.99, (R * 0.95) / domeR));
  const diffuser = new THREE.Mesh(new THREE.SphereGeometry(domeR, 32, 10, 0, TAU, 0, cap), look.ledDiffuser);
  diffuser.rotation.x = Math.PI / 2;
  diffuser.position.z = 0.18 - domeR * Math.cos(cap);
  g.add(well, ring, diffuser);
  return g;
}

function rivet(look: Look, r = 0.85) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 8, 0, TAU, 0, Math.PI / 2), look.hardware);
  m.rotation.x = Math.PI / 2;
  m.scale.set(1, 0.45, 1);
  g.add(m);
  return g;
}

function micHole(look: Look) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.1, 8, 24), look.micRing);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.36, 20), look.micHole);
  hole.position.z = 0.02;
  g.add(ring, hole);
  return g;
}

/* ------------------------------------------------------------------ */
/* Temple                                                              */
/* ------------------------------------------------------------------ */
interface TempleDims {
  w: [number, number][];
  h: [number, number][];
  path: THREE.Vector3[];
  rubberTip: boolean;
}

function keyed(keys: [number, number][]) {
  return (u: number) => {
    if (u <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i += 1) {
      if (u <= keys[i][0]) {
        const [u0, a] = keys[i - 1];
        const [u1, b] = keys[i];
        return a + (b - a) * smooth((u - u0) / (u1 - u0));
      }
    }
    return keys[keys.length - 1][1];
  };
}

function templeDims(variant: SmartVariant, shape: SmartShape, start: THREE.Vector3): TempleDims {
  const k = variant === 'display' ? 1.1 : shape === 'aviator' ? 0.9 : 1;
  const sport = shape === 'wrap';
  const rel = (x: number, y: number, z: number) => start.clone().add(v3(x, y, z));
  const path = sport
    ? [rel(0, 0, 0), rel(1.2, -0.4, -26), rel(1.8, -2.2, -66), rel(0.6, -5.5, -100), rel(-1.5, -12, -118), rel(-3.5, -24, -132), rel(-4.6, -31, -138)]
    : [rel(0, 0, 0), rel(1.6, -0.3, -26), rel(3.4, -1.4, -66), rel(3.6, -3.4, -101), rel(2.4, -9, -119), rel(0.6, -21, -133), rel(-0.6, -29, -140)];
  return {
    path,
    rubberTip: sport,
    w: sport
      ? [
          [0, 6.2],
          [0.1, 6.0],
          [0.55, 5.0],
          [0.75, 4.6],
          [1, 4.2],
        ]
      : [
          [0, 6.6 * k],
          [0.1, 6.4 * k],
          [0.58, 5.6 * k],
          [0.74, 4.8 * k],
          [1, 4.1 * k],
        ],
    h: sport
      ? [
          [0, 13.4],
          [0.1, 12.6],
          [0.5, 9.4],
          [0.72, 7.4],
          [1, 6.2],
        ]
      : [
          [0, 12.6 * k],
          [0.12, 12.0 * k],
          [0.52, 9.6 * k],
          [0.68, 8.0 * k],
          [0.8, 6.4 * k],
          [1, 5.5 * k],
        ],
  };
}

interface Built {
  look: Look;
  movers: { obj: THREE.Object3D; base: THREE.Vector3; offset: THREE.Vector3; delay: number }[];
  anchors: Partial<Record<SmartPart, PartAnchor>>;
  emissive: { part: SmartPart; mat: THREE.MeshStandardMaterial; color: THREE.Color; k: number }[];
  glows: { part: SmartPart; sprite: THREE.Sprite; max: number; pulse: boolean }[];
  ghosts: { part: SmartPart; mat: THREE.MeshBasicMaterial }[];
  rings: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; phase: number }[];
}

function addMover(b: Built, obj: THREE.Object3D, offset: THREE.Vector3, delay: number) {
  b.movers.push({ obj, base: obj.position.clone(), offset, delay });
}

function addAnchor(b: Built, part: SmartPart, parent: THREE.Object3D, pos: THREE.Vector3, normal: THREE.Vector3, hidden = false) {
  const a = new THREE.Object3D();
  a.position.copy(pos);
  orientTo(a, normal);
  parent.add(a);
  b.anchors[part] = { anchor: a, hidden };
  return a;
}

function addGlow(b: Built, part: SmartPart, parent: THREE.Object3D, pos: THREE.Vector3, color: THREE.Color, size: number, max = 0.9, pulse = true) {
  const s = glowSprite(b.look.glow, color, size);
  s.position.copy(pos);
  parent.add(s);
  b.glows.push({ part, sprite: s, max, pulse });
  return s;
}

/** Ghost (x-ray) copy that shows a hidden part through the temple while it is highlighted. */
function ghostOf(b: Built, part: SmartPart, mesh: THREE.Mesh) {
  const mat = new THREE.MeshBasicMaterial({ color: MINT, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false });
  const g = new THREE.Mesh(mesh.geometry, mat);
  g.renderOrder = 30;
  mesh.add(g);
  b.ghosts.push({ part, mat });
}

/** Surface point + outward normal on a temple sweep at (u, angle). */
function templeSurface(curve: THREE.Curve<THREE.Vector3>, wFn: (u: number) => number, hFn: (u: number) => number, e: number, u: number, a: number, lift = 0.05) {
  const f = sweepFrame(curve, u, new THREE.Vector3(0, 1, 0));
  const hw = wFn(u) / 2;
  const hh = hFn(u) / 2;
  const [x, y] = sectionPoint(a, hw, hh, e);
  const gx = (e / hw) * Math.pow(Math.abs(x / hw), e - 1) * Math.sign(x);
  const gy = (e / hh) * Math.pow(Math.abs(y / hh), e - 1) * Math.sign(y);
  const n2 = v2(gx, gy).normalize();
  const normal = f.s.clone().multiplyScalar(n2.x).addScaledVector(f.b, n2.y).normalize();
  const p = f.p.clone().addScaledVector(f.s, x).addScaledVector(f.b, y).addScaledVector(normal, lift);
  return { p, normal, tangent: f.t };
}

function buildTemple(b: Built, variant: SmartVariant, shape: SmartShape, start: THREE.Vector3, opts: { right: boolean }) {
  const { look } = b;
  const g = new THREE.Group();
  const dims = templeDims(variant, shape, start);
  const curve = new THREE.CatmullRomCurve3(dims.path, false, 'centripetal');
  const wFn = keyed(dims.w);
  const hFn = keyed(dims.h);
  const E = 3.2;
  const up = new THREE.Vector3(0, 1, 0);
  const body = new THREE.Mesh(sweep({ curve, rings: 180, sides: 56, width: wFn, height: hFn, exponent: E, capStart: 5, capEnd: 8, up, uvScale: look.uvScale }), look.acetate);
  g.add(body);

  if (dims.rubberTip) {
    const tip = new THREE.Mesh(sweep({ curve, rings: 50, sides: 56, width: wFn, height: hFn, exponent: E, u0: 0.74, u1: 1, capEnd: 8, inflate: 0.35, up }), look.rubber);
    g.add(tip);
  }

  // speaker grille (lower outer face near the ear)
  const gu0 = 0.57;
  const gu1 = 0.69;
  const grille = new THREE.Mesh(sweep({ curve, rings: 24, sides: 18, width: wFn, height: hFn, exponent: E, u0: gu0, u1: gu1, a0: -1.8, a1: -0.18, inflate: 0.06, up }), look.grille);
  g.add(grille);
  const gs = templeSurface(curve, wFn, hFn, E, (gu0 + gu1) / 2, -0.9, 0.5);

  // speaker driver (comes out in the exploded view)
  const driverGroup = new THREE.Group();
  const driver = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 1.6, 40), look.driver);
  const cone = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.35, 10, 40), look.hardware);
  cone.rotation.x = Math.PI / 2;
  cone.position.y = -0.85;
  const coneMid = new THREE.Mesh(new THREE.CircleGeometry(2.1, 32), look.grille);
  coneMid.rotation.x = Math.PI / 2;
  coneMid.position.y = -0.82;
  driverGroup.add(driver, cone, coneMid);
  const ds = templeSurface(curve, wFn, hFn, E, (gu0 + gu1) / 2, -Math.PI / 2, -1.6);
  driverGroup.position.copy(ds.p);
  driverGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), ds.normal);
  g.add(driverGroup);
  ghostOf(b, 'speaker', driver);
  addMover(b, driverGroup, v3(6, -13, 0), 0.32);

  // battery pill inside the temple
  const bu = 0.38;
  const bf = sweepFrame(curve, bu, up);
  const battery = new THREE.Group();
  const cellLen = 28;
  const cell = new THREE.Mesh(new THREE.CapsuleGeometry(2.05, cellLen, 10, 32), look.battery);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(2.12, 2.12, 2.4, 32, 1, true), look.batteryBand);
  band.position.y = cellLen * 0.28;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.6, 24), look.hardware);
  cap.position.y = cellLen / 2 + 2.05;
  battery.add(cell, band, cap);
  battery.position.copy(bf.p).addScaledVector(bf.b, -0.6);
  battery.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bf.t.clone().negate());
  g.add(battery);
  ghostOf(b, 'battery', cell);
  addMover(b, battery, v3(11, -17, 0), 0.26);

  // mic pin-holes on the top face near the hinge
  for (const u of [0.05, 0.085]) {
    const s = templeSurface(curve, wFn, hFn, E, u, Math.PI / 2, 0.04);
    const m = micHole(look);
    m.position.copy(s.p);
    orientTo(m, s.normal);
    g.add(m);
    if (opts.right) addGlow(b, 'mics', g, s.p.clone().addScaledVector(s.normal, 0.6), MINT, 7, 0.8);
  }

  // polished rivets on the outer face
  for (const u of [0.035, 0.065]) {
    const s = templeSurface(curve, wFn, hFn, E, u, 0.02, -0.15);
    const rv = rivet(look, 0.8);
    rv.position.copy(s.p);
    orientTo(rv, s.normal);
    g.add(rv);
  }

  let touchMesh: THREE.Mesh | null = null;
  if (opts.right) {
    touchMesh = new THREE.Mesh(sweep({ curve, rings: 60, sides: 28, width: wFn, height: hFn, exponent: E, u0: 0.1, u1: 0.42, a0: -0.92, a1: 0.98, inflate: 0.07, up, uvScale: look.uvScale }), look.touch);
    g.add(touchMesh);
    addMover(b, touchMesh, v3(7, 0, 0), 0.24);
    const ts = templeSurface(curve, wFn, hFn, E, 0.26, 0.05, 0.4);
    addAnchor(b, 'touch', touchMesh, ts.p, ts.normal);
    addGlow(b, 'touch', touchMesh, ts.p.clone().addScaledVector(ts.normal, 1.5), MINT, 30, 0.55);

    addAnchor(b, 'speaker', g, gs.p, gs.normal);
    addAnchor(b, 'battery', battery, v3(0, 0, 0), v3(0, 0, 1).applyQuaternion(battery.quaternion.clone().invert()), true);
    const ms = templeSurface(curve, wFn, hFn, E, 0.068, Math.PI / 2, 0.3);
    if (shape === 'aviator' || shape === 'wrap') addAnchor(b, 'mics', g, ms.p, ms.normal);
    addGlow(b, 'battery', battery, v3(0, 0, 0), MINT, 34, 0.5);
  }
  addGlow(b, 'speaker', g, gs.p.clone().addScaledVector(gs.normal, 1.5), MINT, 22, 0.7);

  // sound-wave rings below the grille
  for (let i = 0; i < 3; i += 1) {
    const mat = new THREE.MeshBasicMaterial({ color: MINT, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64), mat);
    mesh.position.copy(gs.p).addScaledVector(gs.normal, 1.2);
    orientTo(mesh, gs.normal);
    mesh.renderOrder = 21;
    g.add(mesh);
    b.rings.push({ mesh, mat, phase: i / 3 });
  }
  return { group: g, curve, wFn, hFn };
}

function hingeGroup(look: Look, at: THREE.Vector3, templeW: number) {
  const g = new THREE.Group();
  const xi = at.x - templeW / 2 - 1.15;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 7.4, 32), look.hinge);
  barrel.position.set(xi, at.y, at.z + 0.6);
  const knuckleGap = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.35, 32), look.recess);
  knuckleGap.position.set(xi, at.y + 1.2, at.z + 0.6);
  const knuckleGap2 = knuckleGap.clone();
  knuckleGap2.position.y = at.y - 1.2;
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.5, 24), look.hinge);
  screw.position.set(xi, at.y + 3.95, at.z + 0.6);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.2, 0.25), look.recess);
  slot.position.set(xi, at.y + 4.2, at.z + 0.6);
  const leafT = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.4, 8), look.hinge);
  leafT.position.set(at.x - templeW / 2 - 0.3, at.y, at.z - 3.2);
  const leafF = new THREE.Mesh(new THREE.BoxGeometry(5, 5.4, 0.6), look.hinge);
  leafF.position.set(xi + 2.4, at.y, at.z + 1.4);
  g.add(barrel, knuckleGap, knuckleGap2, screw, slot, leafT, leafF);
  return { group: g, top: v3(xi, at.y + 4.3, at.z + 0.6) };
}

/* ------------------------------------------------------------------ */
/* Model                                                               */
/* ------------------------------------------------------------------ */
export function createGlassesModel(o: ModelOptions): GlassesModel {
  const look = createLook(o.colorway, o.variant, o.transparentBg);
  const b: Built = { look, movers: [], anchors: {}, emissive: [], glows: [], ghosts: [], rings: [] };
  const spec = frontSpec(o.shape, o.variant);
  const metalFront = o.shape === 'aviator';
  const hasCamera = o.variant !== 'audio';
  const hasDisplay = o.variant === 'display';
  const centreCamera = o.variant === 'sport' || o.shape === 'wrap';

  const model = new THREE.Group(); // millimetres
  const frontPivot = new THREE.Group();
  const front = new THREE.Group();
  frontPivot.add(front);
  model.add(frontPivot);

  const A = lensOutline(o.shape, spec.W, spec.H); // aperture, right lens local
  const cx = (spec.W + spec.bridge) / 2;
  const bend = spec.bend;
  const lensSag = (dx: number, dy: number) => -(dx * dx + dy * dy) / (2 * 88);
  const glassC = offsetClosed(A, () => (metalFront ? 0.5 : 1.0));

  let hingeY = spec.hingeFrac * (spec.H / 2);
  let hingeX = 0;
  let hingeZ = 0;
  let cornerR = v3(0, 0, 0);
  let cornerN = v3(0, 0, 1);
  let cornerRadius = 2.6;
  let bridgeMic = v3(0, 0, 0);
  let lensZ0 = -spec.depth / 2;

  if (!metalFront) {
    // ---------------------------------------------------------------- acetate front
    const hole = offsetClosed(A, () => spec.r);
    const wingW = (p: V2) => smooth(((p.x / spec.W) * 2 - 0.2) / 0.7) * smooth(((p.y / spec.H) * 2 - spec.wing[2]) / (0.9 - spec.wing[2]));
    const O = smoothClosed(
      offsetClosed(A, (p) => Math.max(spec.r + 0.6, spec.rim((p.x / spec.W) * 2, (p.y / spec.H) * 2) - spec.r)).map((q, i) =>
        q.clone().add(v2(spec.wing[0] * wingW(A[i]), spec.wing[1] * wingW(A[i]))),
      ),
      8,
    ).map((p) => v2(p.x + cx, p.y));
    const outline = stitchFront(O, cx, spec);
    const holeR = hole.map((p) => v2(p.x + cx, p.y));
    const holeL = holeR.map((p) => v2(-p.x, p.y)).reverse();
    const frontMesh = new THREE.Mesh(slab(outline, [holeR, holeL], spec.depth, spec.r, spec.rt, bend, look.uvScale), look.acetate);
    front.add(frontMesh);

    // hinge on the outer edge
    const near = outline.filter((p) => p.x > 0 && Math.abs(p.y - hingeY) < 3);
    const outerX = Math.max(...near.map((p) => p.x)) + spec.r;
    const tw = templeDims(o.variant, o.shape, v3(0, 0, 0)).w[0][1];
    hingeX = outerX - tw / 2 - 0.5;
    hingeZ = bend.z(hingeX) - spec.depth - 0.2;

    // corner housing (camera / LED): middle of the rim towards the outer-top corner
    const dir = v2(spec.cornerDir[0], spec.cornerDir[1]).normalize();
    const ia = support(A, dir);
    const io = support(O, dir, (p) => p.x > cx);
    const pa = v2(A[ia].x + cx, A[ia].y);
    const po = O[io].clone().addScaledVector(dir, spec.r);
    const mid = pa.clone().lerp(po, 0.52);
    cornerRadius = Math.min(3.1, pa.distanceTo(po) * 0.3);
    cornerR = v3(mid.x, mid.y, bend.z(mid.x) + 0.02);
    cornerN = v3(-bend.dz(mid.x), 0, 1).normalize();

    // bridge mic: front face, just under the top edge
    const topAt0 = outline.filter((p) => Math.abs(p.x) < 1.2).reduce((m, p) => Math.max(m, p.y), -Infinity);
    bridgeMic = v3(0, topAt0 - 3.2, 0.03);
    lensZ0 = -spec.depth * 0.5;

    if (!hasCamera) {
      // classic front rivets on both corners
      for (const side of [-1, 1]) {
        for (const k of [-1, 1]) {
          const p = v3(side * (cornerR.x + k * 1.6), cornerR.y + k * 0.4, bend.z(cornerR.x));
          const rv = rivet(look, 0.95);
          rv.position.copy(p);
          orientTo(rv, v3(side * Math.abs(cornerN.x), 0, cornerN.z));
          front.add(rv);
        }
      }
    }
  } else {
    // ---------------------------------------------------------------- metal aviator front
    const rimLine = offsetClosed(A, () => 1.0);
    const zRim = -1.2;
    for (const side of [-1, 1]) {
      const pts = rimLine.filter((_, i) => i % 3 === 0).map((p) => {
        const x = side * (p.x + cx);
        return v3(x, p.y, zRim + bend.z(x));
      });
      const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
      const wire = new THREE.Mesh(
        sweep({ curve, rings: 320, sides: 20, width: () => 2.1, height: () => 2.5, exponent: 2.2, closed: true, up: new THREE.Vector3(0, 0, 1) }),
        look.wire,
      );
      front.add(wire);
    }
    const P = rimLine[support(rimLine, v2(-0.4, 1).normalize(), (p) => p.x < 0)];
    const Q = rimLine[support(rimLine, v2(-1, 0.3).normalize(), (p) => p.x < 0)];
    const topBar = (y0: number, lift: number, x0: number) =>
      new THREE.CatmullRomCurve3([v3(-x0, y0, zRim + bend.z(x0)), v3(0, y0 + lift, zRim + 0.6), v3(x0, y0, zRim + bend.z(x0))], false, 'centripetal');
    const browCurve = topBar(P.y + 0.6, 1.0, P.x + cx + 0.4);
    front.add(new THREE.Mesh(sweep({ curve: browCurve, rings: 80, sides: 16, width: () => 2.2, height: () => 2.2, exponent: 2, capStart: 3, capEnd: 3, up: new THREE.Vector3(0, 0, 1) }), look.wire));
    const lowCurve = new THREE.CatmullRomCurve3(
      [v3(-(Q.x + cx) - 0.3, Q.y, zRim + bend.z(Q.x + cx)), v3(-4, Q.y + 4.2, zRim - 1.2), v3(4, Q.y + 4.2, zRim - 1.2), v3(Q.x + cx + 0.3, Q.y, zRim + bend.z(Q.x + cx))],
      false,
      'centripetal',
    );
    front.add(new THREE.Mesh(sweep({ curve: lowCurve, rings: 80, sides: 16, width: () => 2.0, height: () => 2.0, exponent: 2, capStart: 3, capEnd: 3, up: new THREE.Vector3(0, 0, 1) }), look.wire));

    // nose pads on short arms
    for (const side of [-1, 1]) {
      const ax = side * (Q.x + cx + 1.5);
      const arm = new THREE.CatmullRomCurve3([v3(ax, Q.y + 1, zRim - 0.8), v3(ax + side * 0.6, Q.y - 5, zRim - 4.5), v3(ax + side * 1.2, Q.y - 8.5, zRim - 6.5)], false, 'centripetal');
      front.add(new THREE.Mesh(sweep({ curve: arm, rings: 30, sides: 10, width: () => 0.9, height: () => 0.9, capEnd: 2, up: new THREE.Vector3(1, 0, 0) }), look.wire));
      const pad = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), look.pad);
      pad.scale.set(2.2, 5, 1.2);
      pad.position.set(ax + side * 2.2, Q.y - 10, zRim - 7.2);
      pad.rotation.set(0.2, side * 0.5, side * -0.15);
      front.add(pad);
    }

    // smart endpiece housings at the outer-top corners (camera / LED live here)
    const E = rimLine[support(rimLine, v2(1, 0.5).normalize())];
    const bw = 10;
    const bh = 8.8;
    const housingDepth = 7.4;
    const block = roundedRect(bw, bh, 3.6, 10);
    const ex = E.x + cx + 3.2;
    const ey = E.y - 1.2;
    for (const side of [-1, 1]) {
      const geo = slab(block, [], housingDepth, 1.4, 2.2, null, look.uvScale);
      const m = new THREE.Mesh(geo, look.acetate);
      m.position.set(side * ex, ey, zRim + bend.z(ex) + 2.2);
      m.rotation.y = side * Math.atan(bend.dz(ex));
      front.add(m);
    }
    hingeY = ey;
    const tw = templeDims(o.variant, o.shape, v3(0, 0, 0)).w[0][1];
    hingeX = ex + bw / 2 - tw / 2 - 0.4;
    hingeZ = zRim + bend.z(ex) + 2.2 - housingDepth - 0.2;
    cornerR = v3(ex - 0.6, ey + 0.2, zRim + bend.z(ex) + 2.22);
    cornerN = v3(-Math.sin(Math.atan(bend.dz(ex))), 0, Math.cos(Math.atan(bend.dz(ex))));
    cornerRadius = 2.6;
    const browMid = browCurve.getPointAt(0.5);
    bridgeMic = v3(0, browMid.y, browMid.z + 1.15);
    lensZ0 = zRim;
  }

  // ------------------------------------------------------------------ lenses
  const sagEdge = glassC.reduce((acc, p) => acc + lensSag(p.x, p.y), 0) / glassC.length;
  const lensSurface = (sideX: number) => (x: number, y: number) => lensZ0 + bend.z(x) + lensSag(x - sideX, y) - sagEdge * 0.85;
  const lensNormal = (sideX: number) => (x: number, y: number) => v3(-(bend.dz(x) - (x - sideX) / 88), y / 88, 1).normalize();
  for (const side of [-1, 1]) {
    const lx = side * cx;
    const contour = glassC.map((p) => v2(side * p.x + lx, p.y));
    if (side < 0) contour.reverse();
    const lens = new THREE.Group();
    const tint = new THREE.Mesh(lensShell(contour, 16, lensSurface(lx), lensNormal(lx)), look.lensTint);
    tint.renderOrder = 4;
    const gloss = new THREE.Mesh(tint.geometry.clone(), look.lensGloss);
    gloss.renderOrder = 5;
    gloss.position.z = 0.06;
    lens.add(tint, gloss);
    front.add(lens);
    addMover(b, lens, v3(0, 0, 9), 0.08);
  }

  // ------------------------------------------------------------------ display (right lens)
  if (hasDisplay) {
    const dg = new THREE.Group();
    const dc = v2(cx + 3, -4.5);
    const rect = roundedRect(17, 11.5, 2.4, 6).map((p) => v2(p.x + dc.x, p.y + dc.y));
    const surf = lensSurface(cx);
    const nrm = lensNormal(cx);
    const glass = new THREE.Mesh(lensShell(rect, 6, (x, y) => surf(x, y) - 0.5, nrm), look.displayGlass);
    glass.renderOrder = 7;
    const hudFront = new THREE.Mesh(lensShell(rect, 6, (x, y) => surf(x, y) - 0.35, nrm), look.hud);
    hudFront.renderOrder = 8;
    // back face: reversed winding + mirrored u so it also reads correctly from the wearer's side
    const backGeo = lensShell(rect, 6, (x, y) => surf(x, y) - 0.45, (x, y) => nrm(x, y).negate());
    const idx = backGeo.index!;
    for (let i = 0; i < idx.count; i += 3) {
      const t = idx.getX(i + 1);
      idx.setX(i + 1, idx.getX(i + 2));
      idx.setX(i + 2, t);
    }
    const uv = backGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i += 1) uv.setX(i, 1 - uv.getX(i));
    const hudBack = new THREE.Mesh(backGeo, look.hud);
    hudBack.renderOrder = 8;
    dg.add(glass, hudFront, hudBack);
    front.add(dg);
    addMover(b, dg, v3(0, 0, 21), 0.12);
    const dp = v3(dc.x, dc.y, surf(dc.x, dc.y));
    addAnchor(b, 'display', dg, dp, nrm(dc.x, dc.y));
    addGlow(b, 'display', dg, dp.clone().add(v3(0, 0, 1)), MINT, 40, 0.45);
    b.emissive.push({ part: 'display', mat: look.displayGlass, color: MINT, k: 0.35 });
  }

  // ------------------------------------------------------------------ camera + LED
  if (hasCamera) {
    const camPos = centreCamera ? v3(0, bridgeMic.y - 4.2, (metalFront ? bridgeMic.z : 0) + 0.02) : v3(-cornerR.x, cornerR.y, cornerR.z);
    const camN = centreCamera ? v3(0, 0, 1) : v3(-cornerN.x, cornerN.y, cornerN.z);
    const cam = cameraModule(look, centreCamera ? 2.5 : cornerRadius);
    cam.position.copy(camPos);
    orientTo(cam, camN);
    front.add(cam);
    addMover(b, cam, camN.clone().multiplyScalar(19).add(v3(centreCamera ? 0 : -2, 2.5, 0)), 0);
    addAnchor(b, 'camera', cam, v3(0, 0, 0.6), v3(0, 0, 1));
    addGlow(b, 'camera', cam, v3(0, 0, 1.2), MINT, 26, 0.75);
    b.emissive.push({ part: 'camera', mat: look.cameraRing, color: MINT, k: 1.6 }, { part: 'camera', mat: look.cameraInner, color: MINT, k: 0.7 });

    const led = ledModule(look, centreCamera ? 1.05 : Math.min(1.25, cornerRadius * 0.48));
    led.position.copy(centreCamera ? v3(cornerR.x, cornerR.y, cornerR.z) : cornerR);
    orientTo(led, cornerN);
    front.add(led);
    addMover(b, led, cornerN.clone().multiplyScalar(14).add(v3(2, 2, 0)), 0.05);
    addAnchor(b, 'led', led, v3(0, 0, 0.4), v3(0, 0, 1));
    addGlow(b, 'led', led, v3(0, 0, 1.0), LED_WHITE, 15, 1);
  }

  // ------------------------------------------------------------------ bridge mic
  {
    const m = micHole(look);
    const mp = centreCamera && hasCamera ? bridgeMic.clone().add(v3(0, 1.4, 0)) : bridgeMic;
    m.position.copy(mp);
    front.add(m);
    if (!b.anchors.mics) addAnchor(b, 'mics', front, mp, v3(0, 0, 1));
    addGlow(b, 'mics', front, mp.clone().add(v3(0, 0, 0.6)), MINT, 9, 0.9);
  }
  b.emissive.push({ part: 'mics', mat: look.micRing, color: MINT, k: 2.4 });

  // ------------------------------------------------------------------ temples + hinges
  const start = v3(hingeX, hingeY, hingeZ);
  const tw = templeDims(o.variant, o.shape, start).w[0][1];
  for (const side of [1, -1]) {
    const t = buildTemple(b, o.variant, o.shape, start, { right: side > 0 });
    t.group.scale.x = side;
    model.add(t.group);
    addMover(b, t.group, v3(side * 24, 0, -12), 0.16);
    const h = hingeGroup(look, start, tw);
    h.group.scale.x = side;
    model.add(h.group);
    addMover(b, h.group, v3(side * 12, 0, -5), 0.2);
    if (side > 0) {
      addAnchor(b, 'hinge', h.group, h.top, v3(0.35, 1, -0.2));
      addGlow(b, 'hinge', h.group, h.top.clone().add(v3(1.2, 0.6, 1.5)), MINT, 26, 1);
    }
  }
  b.emissive.push(
    { part: 'speaker', mat: look.grille, color: MINT, k: 1.6 },
    { part: 'speaker', mat: look.driver, color: MINT, k: 0.4 },
    { part: 'touch', mat: look.touch, color: MINT, k: 1.4 },
    { part: 'battery', mat: look.batteryBand, color: MINT, k: 2.2 },
    { part: 'battery', mat: look.battery, color: MINT, k: 0.12 },
    { part: 'hinge', mat: look.hinge, color: MINT, k: 0.9 },
  );

  // pantoscopic tilt of the front around the hinge axis
  frontPivot.position.set(0, hingeY, hingeZ);
  front.position.set(0, -hingeY, -hingeZ);
  frontPivot.rotation.x = spec.tilt;

  // ------------------------------------------------------------------ centre + scale
  const root = new THREE.Group();
  model.scale.setScalar(MM);
  root.add(model);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3();
  model.traverse((c) => {
    const mesh = c as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry || (mesh.material as THREE.Material).depthTest === false) return;
    mesh.geometry.computeBoundingBox();
    box.union(mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld));
  });
  const centre = box.getCenter(new THREE.Vector3());
  model.position.sub(centre);

  const hl = (s: ModelFrameState, p: SmartPart) => s.highlight[p] ?? 0;
  const tmp = new THREE.Color();
  const swipe = look.touch.emissiveMap;

  return {
    root,
    anchors: b.anchors,
    update(s) {
      const e = clamp01(s.exploded);
      for (const m of b.movers) {
        const t = easeInOut((e - m.delay) / (1 - 0.32));
        m.obj.position.copy(m.base).addScaledVector(m.offset, t);
      }
      const wave = s.reduced ? 1 : 0.82 + 0.18 * Math.sin(s.time * 3.2);
      for (const em of b.emissive) {
        let k = hl(s, em.part) * em.k;
        if (em.part === 'display') k = em.k * (0.25 * s.hud + hl(s, 'display'));
        em.mat.emissive.copy(tmp.copy(em.color).multiplyScalar(k * wave));
      }
      // LED: capture light (white) — explicit level or highlight
      const ledLevel = Math.max(s.led, hl(s, 'led'));
      look.ledDiffuser.emissive.copy(LED_WHITE).multiplyScalar(ledLevel * 3.2);
      look.hud.opacity = clamp01(s.hud) * (0.92 + 0.08 * wave);
      for (const g of b.glows) {
        const level = g.part === 'led' ? ledLevel : g.part === 'display' ? Math.max(hl(s, 'display'), s.hud * 0.5) : hl(s, g.part);
        (g.sprite.material as THREE.SpriteMaterial).opacity = level * g.max * (g.pulse ? wave : 1);
        g.sprite.visible = level > 0.002;
      }
      for (const gh of b.ghosts) gh.mat.opacity = hl(s, gh.part) * 0.4 * (1 - smooth(e * 2.2));
      const sp = hl(s, 'speaker');
      for (const r of b.rings) {
        const ph = s.reduced ? 0.35 + r.phase * 0.5 : (s.time * 0.55 + r.phase) % 1;
        r.mesh.scale.setScalar(3 + ph * 11);
        r.mat.opacity = sp * (1 - ph) * 0.55;
        r.mesh.visible = sp > 0.002;
      }
      if (swipe) swipe.offset.x = s.reduced ? 0 : -((s.time * 0.45) % 1);
    },
    dispose() {
      disposeTree(root);
    },
  };
}
