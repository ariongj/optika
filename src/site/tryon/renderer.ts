// Virtual try-on renderer: a procedural glasses model built from catalogue measurements, drawn with three.js
// on a transparent canvas above the camera video / uploaded photo (or alone, in the 3D viewer).
// Ported and extended from the original Optika try-on (virtualTryOn3D.js): face-depth occlusion, pose
// smoothing, orthographic stage camera, viewer fitting, context-loss handling and full disposal.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { FrameBuild, FrameDims, FrameLook, FrameShape, LensTint } from './frames';
import { clamp, NOMINAL_WIDTH, safeDims, type FacePose } from './pose';

export interface FrameModelSpec {
  shape: FrameShape;
  build: FrameBuild;
  dims: FrameDims;
  look: FrameLook;
}

export type RenderMode = 'live' | 'photo' | 'viewer';

export interface TryOnRenderer {
  setMode(mode: RenderMode): void;
  /** null hides the frame (no face) */
  setFacePose(pose: FacePose | null): void;
  /** viewer: rotate by a delta (rad) — used by drag / keyboard */
  rotateViewer(dYaw: number, dPitch: number): void;
  /** viewer: go to an absolute angle (presets) */
  setViewerAngle(yaw: number, pitch?: number): void;
  setViewerZoom(zoom: number): void;
  resetViewer(): void;
  /** gentle idle sway in the viewer (off for prefers-reduced-motion or after the first interaction) */
  setAutoRotate(on: boolean): void;
  setFrame(spec: FrameModelSpec): void;
  /** renders a fresh frame and returns the WebGL canvas (for captures) */
  getCanvas(): HTMLCanvasElement;
  dispose(): void;
}

export const VIEWER_ZOOM = { min: 0.6, max: 2.2 };

const damp = (current: number, target: number, speed: number, delta: number) => THREE.MathUtils.lerp(current, target, 1 - Math.exp(-speed * delta));
const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ */
/* Textures (canvas, generated once per model)                          */
/* ------------------------------------------------------------------ */
function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const css = (c: THREE.Color, a = 1) => `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;

/** Seamless tortoiseshell: dark base, warm amber flecks and a few near-black spots. */
function tortoiseTexture(hex: string) {
  const size = 256;
  const base = new THREE.Color(hex);
  const dark = base.clone().multiplyScalar(0.32);
  const warm = base.clone().lerp(new THREE.Color('#d9973f'), 0.45).multiplyScalar(1.12);
  const c = canvas(size, size);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = css(dark);
  ctx.fillRect(0, 0, size, size);
  const rnd = mulberry32(11);
  const blobs = Array.from({ length: 64 }, () => ({
    x: rnd() * size,
    y: rnd() * size,
    r: 10 + rnd() * 34,
    sx: 0.6 + rnd() * 1.1,
    t: rnd(),
    spot: rnd() < 0.16,
  }));
  for (const b of blobs) {
    const col = b.spot ? new THREE.Color('#120a05') : dark.clone().lerp(warm, 0.35 + b.t * 0.65);
    for (const ox of [-size, 0, size])
      for (const oy of [-size, 0, size]) {
        const x = b.x + ox;
        const y = b.y + oy;
        if (x + b.r * 2 < 0 || x - b.r * 2 > size || y + b.r < 0 || y - b.r > size) continue;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(b.sx, 1);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, b.r);
        g.addColorStop(0, css(col, b.spot ? 0.85 : 0.75));
        g.addColorStop(0.55, css(col, b.spot ? 0.4 : 0.35));
        g.addColorStop(1, css(col, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, b.r, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Soft diagonal window reflection for lenses (white with alpha). */
function sheenTexture() {
  const s = 128;
  const c = canvas(s, s);
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, s, s * 0.8);
  g.addColorStop(0, 'rgba(255,255,255,0.0)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.22)');
  g.addColorStop(0.27, 'rgba(255,255,255,0.0)');
  g.addColorStop(0.34, 'rgba(255,255,255,0.0)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.12)');
  g.addColorStop(0.44, 'rgba(255,255,255,0.0)');
  g.addColorStop(1, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const top = ctx.createLinearGradient(0, 0, 0, s * 0.3);
  top.addColorStop(0, 'rgba(255,255,255,0.18)');
  top.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, s, s * 0.3);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Vertical alpha map for gradient sun lenses (green channel = alpha). */
function gradientAlpha(from: number, to: number) {
  const c = canvas(4, 128);
  const ctx = c.getContext('2d')!;
  const ratio = clamp(to / Math.max(0.01, from), 0, 1);
  const v = (x: number) => Math.round(x * 255);
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, `rgb(${v(1)},${v(1)},${v(1)})`);
  g.addColorStop(0.28, `rgb(${v(1)},${v(1)},${v(1)})`);
  g.addColorStop(0.92, `rgb(${v(ratio)},${v(ratio)},${v(ratio)})`);
  g.addColorStop(1, `rgb(${v(ratio)},${v(ratio)},${v(ratio)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(c);
}

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */
/** Lens outline (superellipse family) for a frame shape; `side` −1 = wearer's right lens (viewer's left). */
function outline(shape: FrameShape, side: number) {
  const points: THREE.Vector2[] = [];
  const count = 96;
  for (let i = 0; i < count; i += 1) {
    const angle = Math.PI / 2 + (i / count) * TAU;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    let exponent = 3.6;
    let rx = 0.48;
    let ry = 0.34;
    if (shape === 'round') exponent = 2.15;
    if (shape === 'panto') exponent = sin > 0 ? 2.9 : 2.0;
    if (shape === 'square') exponent = 4.8;
    if (shape === 'aviator') {
      // Flat-ish brow, deep teardrop bowl that sweeps towards the nose.
      exponent = sin > 0 ? 3.4 : 2.1;
      rx = 0.5;
      ry = 0.38;
    }
    if (shape === 'cat-eye') {
      exponent = 2.8;
      rx = 0.5;
    }
    if (shape === 'wrap') {
      exponent = 4.2;
      rx = 0.53;
      ry = 0.29;
    }
    if (shape === 'geometric') exponent = 2.6;
    const power = 2 / exponent;
    let x = rx * Math.sign(cos) * Math.pow(Math.abs(cos), power);
    let y = ry * Math.sign(sin) * Math.pow(Math.abs(sin), power);
    const outer = Math.max(0, (side * x) / rx); // 0 at the nose, 1 at the temple side
    if (shape === 'aviator') {
      const low = Math.max(0, -sin);
      x -= side * 0.075 * low * low; // bowl shifts towards the nose
      y -= 0.08 * low * (1 - 0.55 * outer); // deepest on the nasal side
      y += 0.03 * outer * low; // outer bottom tucks up
    }
    if (shape === 'cat-eye') y += 0.1 * outer * Math.max(0, sin + 0.15);
    if (shape === 'wrap') y -= 0.05 * (1 - outer) * Math.max(0, -sin);
    if (shape === 'geometric') {
      const k = 1 + 0.05 * Math.cos(angle * 8);
      x *= k;
      y *= k;
    }
    points.push(new THREE.Vector2(x, y));
  }
  return points;
}

function ringGeometry(points: THREE.Vector2[], halfW: number, halfH: number, rim: number, depth: number) {
  const outer = points.map((p) => new THREE.Vector2(p.x * (1 + rim / halfW), p.y * (1 + rim / halfH)));
  const shape = new THREE.Shape(outer);
  shape.holes.push(new THREE.Path(points.map((p) => p.clone().multiplyScalar(0.985)).reverse()));
  const bevel = Math.min(0.009, rim * 0.22);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 4 });
  geometry.translate(0, 0, -depth / 2);
  return { geometry, outer };
}

function lensGeometry(points: THREE.Vector2[]) {
  const geometry = new THREE.ShapeGeometry(new THREE.Shape(points.map((p) => p.clone().multiplyScalar(0.99))), 4);
  // Normalise UVs to the lens box so alpha / reflection textures map the same on every shape.
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const w = box.max.x - box.min.x || 1;
  const h = box.max.y - box.min.y || 1;
  for (let i = 0; i < pos.count; i += 1) uv.setXY(i, (pos.getX(i) - box.min.x) / w, (pos.getY(i) - box.min.y) / h);
  uv.needsUpdate = true;
  return geometry;
}

function tube(points: THREE.Vector3[], radius: number, material: THREE.Material, segments = 24) {
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, radius, 10, false), material);
}

/* ------------------------------------------------------------------ */
/* Materials                                                           */
/* ------------------------------------------------------------------ */
function frameMaterials(look: FrameLook) {
  const p: THREE.MeshPhysicalMaterialParameters = { color: look.frame, envMapIntensity: 0.85 };
  let front: THREE.MeshPhysicalMaterial;
  let temple: THREE.MeshPhysicalMaterial;
  switch (look.finish) {
    case 'metal':
      front = new THREE.MeshPhysicalMaterial({ ...p, metalness: 0.88, roughness: 0.26, clearcoat: 0.35, clearcoatRoughness: 0.2, envMapIntensity: 1.25 });
      temple = front;
      break;
    case 'matte':
      front = new THREE.MeshPhysicalMaterial({ ...p, metalness: 0.04, roughness: 0.62, clearcoat: 0.08, clearcoatRoughness: 0.6 });
      temple = front;
      break;
    case 'crystal':
      front = new THREE.MeshPhysicalMaterial({ ...p, metalness: 0, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.62 });
      temple = front;
      break;
    case 'tortoise': {
      const map = tortoiseTexture(look.frame);
      map.repeat.set(2, 2);
      const templeMap = map.clone();
      templeMap.needsUpdate = true;
      templeMap.repeat.set(5, 0.35);
      front = new THREE.MeshPhysicalMaterial({ map, metalness: 0.02, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.6 });
      temple = new THREE.MeshPhysicalMaterial({ map: templeMap, metalness: 0.02, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.6 });
      break;
    }
    default:
      front = new THREE.MeshPhysicalMaterial({ ...p, metalness: 0.04, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.5 });
      temple = front;
  }
  const hardware = new THREE.MeshStandardMaterial({ color: look.hardware, metalness: 0.92, roughness: 0.24, envMapIntensity: 1.2 });
  return { front, temple, hardware };
}

function lensMaterials(lens: LensTint) {
  const clear = lens.opacity < 0.3 && !lens.mirror;
  const alphaMap = lens.gradientTo != null ? gradientAlpha(lens.opacity, lens.gradientTo) : null;
  // A tinted lens is a filter, not a lit surface: an unlit absorption layer lets the eyes / photo show through
  // at (1 − opacity). Mirror coatings are the exception — a lit, metallic layer that picks up the environment.
  const tint: THREE.Material = lens.mirror
    ? new THREE.MeshPhysicalMaterial({
        color: lens.color,
        transparent: true,
        opacity: lens.opacity,
        roughness: 0.12,
        metalness: 0.9,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        envMapIntensity: 1.5,
        depthWrite: false,
        side: THREE.DoubleSide,
        alphaMap,
      })
    : new THREE.MeshBasicMaterial({
        color: lens.color,
        transparent: true,
        opacity: lens.opacity,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
        alphaMap,
      });
  const sheen = new THREE.MeshBasicMaterial({
    map: sheenTexture(),
    transparent: true,
    opacity: clear ? 0.75 : 0.5,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  return { tint, sheen };
}

/* ------------------------------------------------------------------ */
/* Model                                                               */
/* ------------------------------------------------------------------ */
function faceOccluder() {
  // A depth-only head volume hides far-side temples behind the head at oblique angles. A slightly "boxy"
  // ellipsoid (flatter face and sides) matches a head better than a sphere, so the far hinge disappears sooner.
  const geometry = new THREE.SphereGeometry(1, 32, 20);
  const pos = geometry.attributes.position;
  const boxy = (v: number, k: number) => Math.sign(v) * Math.pow(Math.abs(v), k);
  for (let i = 0; i < pos.count; i += 1) pos.setXYZ(i, boxy(pos.getX(i), 0.7), pos.getY(i), boxy(pos.getZ(i), 0.8));
  geometry.computeVertexNormals();
  const mask = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, depthTest: true }));
  mask.name = 'face-depth-mask';
  mask.scale.set(0.95, 1.3, 0.86);
  mask.position.set(0, -0.24, -0.98);
  mask.renderOrder = -1;
  return mask;
}

export function createGlassesModel(spec: FrameModelSpec) {
  const root = new THREE.Group();
  root.rotation.order = 'YXZ';
  const { shape, build, look } = spec;
  const d = safeDims(spec.dims);
  const metal = build === 'metal';
  const unit = NOMINAL_WIDTH / d.frameWidth;
  const halfW = (d.lensWidth * unit) / 2;
  const halfH = (d.lensHeight * unit) / 2;
  const lensCenter = ((d.lensWidth + d.bridgeWidth) * unit) / 2;
  const frameHalf = NOMINAL_WIDTH / 2;
  const arm = d.templeLength * unit;
  const rim = (metal ? 1.15 : build === 'mixed' ? 2.6 : shape === 'wrap' ? 3.0 : 3.9) * unit;
  const depth = metal ? 0.05 : 0.085;
  const wrapYaw = shape === 'wrap' ? 0.22 : 0.04;
  const hingeY = halfH * (shape === 'aviator' ? 0.62 : shape === 'cat-eye' ? 0.55 : 0.42);
  const hingeZ = shape === 'wrap' ? -0.13 : -0.025;

  const mats = frameMaterials(look);
  const lens = lensMaterials(look.lens);

  let rightOuter: THREE.Vector2[] = [];
  for (const side of [-1, 1]) {
    const raw = outline(shape, side);
    const maxX = Math.max(...raw.map((p) => Math.abs(p.x)));
    const maxY = Math.max(...raw.map((p) => Math.abs(p.y)));
    const points = raw.map((p) => new THREE.Vector2((p.x * halfW) / maxX, (p.y * halfH) / maxY));

    const lensRoot = new THREE.Group();
    lensRoot.position.x = side * lensCenter;
    lensRoot.rotation.y = side * -wrapYaw;
    const { geometry, outer } = ringGeometry(points, halfW, halfH, rim, depth);
    if (side > 0) rightOuter = outer;
    const ring = new THREE.Mesh(geometry, mats.front);
    const lensGeo = lensGeometry(points);
    const tint = new THREE.Mesh(lensGeo, lens.tint);
    tint.position.z = 0.004;
    tint.renderOrder = 2;
    const sheen = new THREE.Mesh(lensGeo.clone(), lens.sheen);
    sheen.position.z = 0.012;
    sheen.renderOrder = 3;
    lensRoot.add(ring, tint, sheen);
    root.add(lensRoot);

    // Endpiece: from the rim at hinge height out to the full frame width.
    const atHinge = outer.filter((p) => side * p.x > 0).reduce((best, p) => (Math.abs(p.y - hingeY) < Math.abs(best.y - hingeY) ? p : best), outer[0]);
    const rimEdge = lensCenter + Math.abs(atHinge.x) * Math.cos(wrapYaw) - 0.03;
    const endW = Math.max(0.05, frameHalf - rimEdge);
    const endpiece = new THREE.Mesh(new THREE.BoxGeometry(endW, metal ? 0.05 : Math.max(0.07, halfH * 0.42), metal ? 0.045 : depth * 0.9), metal ? mats.hardware : mats.front);
    endpiece.position.set(side * (rimEdge + endW / 2), hingeY, hingeZ);
    root.add(endpiece);
    const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.05, metal ? 0.04 : 0.055, 0.07), mats.hardware);
    hinge.position.set(side * (frameHalf - 0.02), hingeY, hingeZ - 0.05);
    root.add(hinge);

    const temple = tube(
      [
        new THREE.Vector3(side * (frameHalf - 0.02), hingeY, hingeZ - 0.04),
        new THREE.Vector3(side * (frameHalf + 0.012), hingeY, hingeZ - arm * 0.2),
        new THREE.Vector3(side * (frameHalf + 0.018), hingeY - 0.03, -arm * 0.72),
        new THREE.Vector3(side * (frameHalf - 0.04), hingeY - 0.24, -arm * 0.97),
      ],
      metal ? 0.016 : 0.03,
      mats.temple,
      30,
    );
    root.add(temple);

    if (build !== 'acetate') {
      // Nose pads on adjustable arms.
      const padX = side * (lensCenter - halfW - 0.005);
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), new THREE.MeshPhysicalMaterial({ color: '#efe9df', transparent: true, opacity: 0.55, roughness: 0.25, depthWrite: false }));
      pad.scale.set(0.45, 0.9, 0.3);
      pad.position.set(padX + side * 0.01, -halfH * 0.32, -0.08);
      root.add(pad);
      root.add(tube([new THREE.Vector3(padX + side * 0.02, -halfH * 0.02, -0.01), new THREE.Vector3(padX, -halfH * 0.18, -0.05), new THREE.Vector3(padX + side * 0.01, -halfH * 0.3, -0.075)], 0.008, mats.hardware, 10));
    }
  }

  if (metal) {
    // Thin wire bridge.
    const bridgeEnd = lensCenter - halfW - rim * 0.4;
    const bridgeY = halfH * (shape === 'aviator' ? 0.3 : 0.24);
    root.add(
      tube([new THREE.Vector3(-bridgeEnd, bridgeY, 0), new THREE.Vector3(0, bridgeY + halfH * 0.16, 0.018), new THREE.Vector3(bridgeEnd, bridgeY, 0)], 0.017, mats.hardware, 22),
    );
  } else {
    // Solid keyhole bridge that merges into both rims (acetate fronts).
    const nasal = (y: number) => {
      const near = rightOuter.filter((p) => p.x < 0).reduce((best, p) => (Math.abs(p.y - y) < Math.abs(best.y - y) ? p : best), rightOuter[0]);
      return lensCenter - Math.abs(near.x) * Math.cos(wrapYaw) + rim * 0.7;
    };
    const yTop = halfH * 0.62;
    const yBot = halfH * 0.1;
    const xTop = nasal(yTop);
    const xBot = nasal(yBot);
    const s = new THREE.Shape();
    s.moveTo(-xTop, yTop);
    s.lineTo(xTop, yTop);
    s.lineTo(xBot, yBot);
    s.quadraticCurveTo(0, yBot + (yTop - yBot) * 1.1, -xBot, yBot);
    s.closePath();
    const bridgeDepth = depth * 0.86;
    const bevel = Math.min(0.008, rim * 0.2);
    const geo = new THREE.ExtrudeGeometry(s, { depth: bridgeDepth, steps: 1, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 16 });
    geo.translate(0, 0, -bridgeDepth / 2 + 0.004);
    root.add(new THREE.Mesh(geo, mats.front));
  }
  if (shape === 'aviator') {
    // Double bridge / brow bar.
    const end = lensCenter - halfW * 0.3;
    root.add(tube([new THREE.Vector3(-end, halfH * 0.84, 0), new THREE.Vector3(0, halfH * 0.9, 0.015), new THREE.Vector3(end, halfH * 0.84, 0)], 0.015, mats.hardware, 26));
  }

  const occluder = faceOccluder();
  root.add(occluder);
  root.userData.occluder = occluder;
  return root;
}

function visualBounds(model: THREE.Object3D) {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || child === model.userData.occluder) return;
    child.geometry.computeBoundingBox();
    bounds.union(child.geometry.boundingBox!.clone().applyMatrix4(child.matrixWorld));
  });
  return bounds;
}

/** Scale + centre that fit the rotated model bounds into the stage (viewer mode). */
function fitViewer(bounds: THREE.Box3, yaw: number, pitch: number, aspect: number, zoom: number) {
  const rotation = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  const rotated = new THREE.Box3();
  for (const x of [bounds.min.x, bounds.max.x])
    for (const y of [bounds.min.y, bounds.max.y])
      for (const z of [bounds.min.z, bounds.max.z]) rotated.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(rotation));
  const size = rotated.getSize(new THREE.Vector3());
  const center = rotated.getCenter(new THREE.Vector3());
  const widthShare = aspect < 1 ? 0.8 : 0.64; // portrait (phone) stages have height to spare
  const scale = Math.min((2 * aspect * widthShare) / Math.max(size.x, 0.001), 1.05 / Math.max(size.y, 0.001)) * clamp(zoom, VIEWER_ZOOM.min, VIEWER_ZOOM.max);
  return { scale, center };
}

function disposeObject(object: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  const materials = new Set<THREE.Material>();
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    (Array.isArray(child.material) ? child.material : [child.material]).forEach((m: THREE.Material) => materials.add(m));
  });
  materials.forEach((m) => {
    Object.values(m as unknown as Record<string, unknown>).forEach((v) => {
      if (v instanceof THREE.Texture) textures.add(v);
    });
    m.dispose();
  });
  textures.forEach((t) => t.dispose());
}

/* ------------------------------------------------------------------ */
/* Renderer                                                            */
/* ------------------------------------------------------------------ */
export function createTryOnRenderer(
  host: HTMLElement,
  initial: FrameModelSpec,
  hooks: { onContextLost?: () => void; onContextRestored?: () => void } = {},
): TryOnRenderer {
  // Throws when WebGL is unavailable — the caller shows a fallback.
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 720 ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.setClearColor(0x000000, 0);
  const el = renderer.domElement;
  el.style.position = 'absolute';
  el.style.inset = '0';
  el.style.width = '100%';
  el.style.height = '100%';
  el.style.pointerEvents = 'none';
  host.appendChild(el);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
  camera.position.set(0, 0, 6);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight('#fff7ea', '#625e56', 0.85));
  const key = new THREE.DirectionalLight('#fff2dc', 1.7);
  key.position.set(-3, 5, 6);
  scene.add(key);
  const rimLight = new THREE.DirectionalLight('#e3e9ed', 0.95);
  rimLight.position.set(4, 1, 3);
  scene.add(rimLight);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment(renderer);
  const envTarget = pmrem.fromScene(room, 0.04);
  scene.environment = envTarget.texture;
  room.dispose();
  pmrem.dispose();

  let model = createGlassesModel(initial);
  let bounds = visualBounds(model);
  scene.add(model);

  let aspect = 1;
  let mode: RenderMode = 'viewer';
  let frame = 0;
  let last = performance.now();
  let disposed = false;
  let contextLost = false;
  let inViewport = true;
  let viewerYaw = 0;
  let viewerPitch = 0;
  let viewerZoom = 1;
  let autoRotate = false;
  let autoBase = 0;
  let autoT = 0;
  const current = { x: 0.5, y: 0.47, scale: 0.34, yaw: 0, pitch: 0, roll: 0, visible: 1, fit: 1 };
  const target = { ...current };

  const resize = () => {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    aspect = width / height;
    camera.left = -aspect;
    camera.right = aspect;
    camera.top = 1;
    camera.bottom = -1;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    resume();
  };

  const loop = (time: number) => {
    if (disposed || contextLost) return;
    const delta = Math.min(0.05, Math.max(0.001, (time - last) / 1000));
    last = time;
    const viewer = mode === 'viewer';
    if (viewer) {
      if (autoRotate) {
        autoT += delta;
        viewerYaw = autoBase + 0.55 * Math.sin(autoT * 0.55);
      }
      Object.assign(target, { x: 0.5, y: 0.47, yaw: viewerYaw, pitch: viewerPitch, roll: 0, visible: 1 });
    }
    current.x = damp(current.x, target.x, 13, delta);
    current.y = damp(current.y, target.y, 13, delta);
    current.scale = damp(current.scale, target.scale, 12, delta);
    current.yaw = damp(current.yaw, target.yaw, viewer ? 7 : 11, delta);
    current.pitch = damp(current.pitch, target.pitch, viewer ? 7 : 11, delta);
    current.roll = damp(current.roll, target.roll, 12, delta);
    current.visible = damp(current.visible, target.visible, 14, delta);
    model.visible = current.visible > 0.04;
    let scale = current.scale * aspect;
    let cx = 0;
    let cy = 0;
    if (viewer) {
      // Fit the current (interpolated) angle so fast preset changes never crop a temple; ease the fit itself.
      const fit = fitViewer(bounds, current.yaw, current.pitch, aspect, viewerZoom);
      current.fit = damp(current.fit, fit.scale, 6, delta);
      scale = current.fit;
      cx = fit.center.x * scale;
      cy = fit.center.y * scale;
    }
    // Live/photo stay anchored at the bridge; only the viewer centres the rotated volume.
    model.position.set((current.x - 0.5) * 2 * aspect - cx, (0.5 - current.y) * 2 - cy, 0);
    model.scale.setScalar(scale);
    model.rotation.set(current.pitch, current.yaw, -current.roll, 'YXZ');
    (model.userData.occluder as THREE.Object3D).visible = !viewer;
    renderer.render(scene, camera);
    if (!document.hidden && inViewport) frame = requestAnimationFrame(loop);
  };

  function resume() {
    if (disposed || contextLost || !compiled || document.hidden || !inViewport) return;
    cancelAnimationFrame(frame);
    last = performance.now();
    frame = requestAnimationFrame(loop);
  }

  // Shaders compile in the background (KHR_parallel_shader_compile where available) before the first frame, so
  // opening the studio doesn't freeze the page on a phone; the loop starts once they're ready.
  // compileAsync keeps polling the programs it started: releasing their materials before it settles makes three
  // throw, so frame swaps and teardown during that first moment wait for it.
  let compiled = false;
  const afterCompile: (() => void)[] = [];
  const whenCompiled = (fn: () => void) => (compiled ? fn() : void afterCompile.push(fn));
  void renderer
    .compileAsync(scene, camera)
    .catch(() => undefined)
    .then(() => {
      compiled = true;
      afterCompile.splice(0).forEach((fn) => fn());
      resume();
    });

  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  const viewportObserver = new IntersectionObserver(([entry]) => {
    inViewport = entry.isIntersecting;
    if (inViewport) resume();
  });
  viewportObserver.observe(host);
  const onLost = (e: Event) => {
    e.preventDefault();
    contextLost = true;
    cancelAnimationFrame(frame);
    hooks.onContextLost?.();
  };
  const onRestored = () => {
    contextLost = false;
    resize();
    hooks.onContextRestored?.();
  };
  el.addEventListener('webglcontextlost', onLost);
  el.addEventListener('webglcontextrestored', onRestored);
  document.addEventListener('visibilitychange', resume);
  resume();

  return {
    setMode(next) {
      mode = next;
      if (next !== 'viewer') target.visible = 0;
      else current.fit = fitViewer(bounds, current.yaw, current.pitch, aspect, viewerZoom).scale;
      resume();
    },
    setFacePose(pose) {
      if (!pose || ![pose.x, pose.y, pose.scale, pose.yaw, pose.pitch, pose.roll].every(Number.isFinite) || pose.x < -0.05 || pose.x > 1.05 || pose.y < -0.05 || pose.y > 1.05) {
        target.visible = 0;
        return;
      }
      Object.assign(target, {
        x: clamp(pose.x, 0.04, 0.96),
        y: clamp(pose.y, 0.06, 0.94),
        scale: clamp(pose.scale, 0.1, 0.9),
        yaw: clamp(pose.yaw, -1.05, 1.05),
        pitch: clamp(pose.pitch, -0.55, 0.55),
        roll: clamp(pose.roll, -0.7, 0.7),
        visible: pose.visible === false ? 0 : 1,
      });
      // Appearing from hidden: start in place instead of gliding in from the last position.
      if (current.visible < 0.05) Object.assign(current, { x: target.x, y: target.y, scale: target.scale, yaw: target.yaw, pitch: target.pitch, roll: target.roll });
      resume();
    },
    rotateViewer(dYaw, dPitch) {
      viewerYaw += dYaw;
      viewerPitch = clamp(viewerPitch + dPitch, -0.5, 0.5);
      autoBase = viewerYaw;
      autoT = 0;
    },
    setViewerAngle(yaw, pitch = 0) {
      // Take the short way round from wherever the frame has been spun to.
      viewerYaw = yaw + Math.round((viewerYaw - yaw) / TAU) * TAU;
      viewerPitch = clamp(pitch, -0.5, 0.5);
      autoBase = viewerYaw;
      autoT = 0;
    },
    setViewerZoom(zoom) {
      viewerZoom = clamp(zoom, VIEWER_ZOOM.min, VIEWER_ZOOM.max);
    },
    resetViewer() {
      viewerYaw = Math.round(viewerYaw / TAU) * TAU;
      viewerPitch = 0;
      viewerZoom = 1;
      autoBase = viewerYaw;
      autoT = 0;
    },
    setAutoRotate(on) {
      if (on && !autoRotate) {
        autoBase = viewerYaw;
        autoT = 0;
      }
      autoRotate = on;
    },
    setFrame(spec) {
      const next = createGlassesModel(spec);
      (next.userData.occluder as THREE.Object3D).visible = mode !== 'viewer';
      scene.add(next);
      scene.remove(model);
      const old = model;
      whenCompiled(() => disposeObject(old));
      model = next;
      bounds = visualBounds(model);
      resume();
    },
    getCanvas() {
      renderer.render(scene, camera);
      return el;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      viewportObserver.disconnect();
      document.removeEventListener('visibilitychange', resume);
      el.removeEventListener('webglcontextlost', onLost);
      el.removeEventListener('webglcontextrestored', onRestored);
      const last = model;
      whenCompiled(() => {
        disposeObject(last);
        envTarget.dispose();
        renderer.dispose();
      });
      el.remove();
    },
  };
}
