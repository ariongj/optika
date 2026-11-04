// Lens simulator stage: one WebGL canvas with two views: the real thick lenses in 3D, and the world seen through them.
// Drawn on demand: a control change, a drag or a short morph asks for frames, and at rest nothing runs at all.
import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FrameLook, FrameShape } from '@/site/tryon/frames';
import { NOMINAL_WIDTH } from '@/site/tryon/pose';
import { createGlassesModel } from '@/site/tryon/renderer';
import { clamp } from '@/lib/utils';
import { createGlass, createStagePass } from './glass';
import { lensStats, materialOf, sag, solveLens, type SolvedLens } from './lensMath';
import { buildLensMap, FIT_Y, INSET, solveAddition, type Addition, type AdditionDesign, type LensMap } from './lensOptics';
import { loadPlate, type Plate, type SceneId } from './plates';
import { createViewPass, type ViewParams } from './viewPass';

export type LensKind = 'single' | 'progressive' | 'screen' | 'photo' | 'sun';
export type ProgressiveLevel = 'standard' | 'premium' | 'individual';

export interface SimState {
  mode: 'lens' | 'view';
  sph: number;
  n: number;
  shape: FrameShape;
  lensWidth: number;
  lensHeight: number;
  bridge: number;
  pd: number;
  showFrame: boolean;
  heat: boolean;
  scene: SceneId;
  kind: LensKind;
  level: ProgressiveLevel;
  /** near addition and what the eye can still accommodate (D), from the age group */
  add: number;
  acc: number;
  /** swatch of the chosen tint */
  tint: string | null;
  polar: boolean;
  withLens: boolean;
  zones: boolean;
}

export type LabelId = 'centre' | 'temporal' | 'nasal' | 'far' | 'mid' | 'near' | 'busy';
export type LabelMap = Partial<Record<LabelId, HTMLElement | null>>;

export interface Simulator {
  update(state: SimState): void;
  nudge(dx: number, dy: number): void;
  dispose(): void;
}

const SEG = 96;
const RINGS = 20;
const ROWS = 6;

/** Our illustrative design per catalogue level: corridor length and half-widths of the far zone, neck and near zone (mm). */
const LEVELS: Record<ProgressiveLevel, Omit<AdditionDesign, 'add'>> = {
  standard: { length: 13, far: 13, neck: 2.2, near: 6.5 },
  premium: { length: 15, far: 19, neck: 3.4, near: 9.5 },
  individual: { length: 16, far: 26, neck: 4.6, near: 12.5 },
};

/** How dark a photochromic gets per scene (behind a windscreen it barely reacts: the catalogue says so too). */
const PHOTO_DARK: Record<SceneId, number> = { street: 0.72, drive: 0.14, desk: 0 };

const FRAME_LOOK: FrameLook = { frame: '#17171a', finish: 'gloss', hardware: '#b9a982', lens: { color: '#ffffff', opacity: 0 } };

function halton(index: number, base: number) {
  let f = 1;
  let r = 0;
  for (let i = index; i > 0; i = Math.floor(i / base)) {
    f /= base;
    r += f * (i % base);
  }
  return r;
}

function surfaceGeometry(flip: boolean) {
  const count = 1 + SEG * RINGS;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const at = (k: number, i: number) => (k === 0 ? 0 : 1 + (k - 1) * SEG + ((i + SEG) % SEG));
  const idx: number[] = [];
  const tri = (a: number, b: number, c: number) => (flip ? idx.push(a, c, b) : idx.push(a, b, c));
  for (let i = 0; i < SEG; i += 1) {
    tri(at(0, 0), at(1, i), at(1, i + 1));
    for (let k = 1; k < RINGS; k += 1) {
      tri(at(k, i), at(k + 1, i), at(k + 1, i + 1));
      tri(at(k, i), at(k + 1, i + 1), at(k, i + 1));
    }
  }
  geo.setIndex(idx);
  return geo;
}

function edgeGeometry() {
  const count = (ROWS + 1) * SEG;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const at = (r: number, i: number) => r * SEG + ((i + SEG) % SEG);
  const idx: number[] = [];
  for (let r = 0; r < ROWS; r += 1) {
    for (let i = 0; i < SEG; i += 1) {
      idx.push(at(r, i), at(r + 1, i), at(r + 1, i + 1), at(r, i), at(r + 1, i + 1), at(r, i + 1));
    }
  }
  geo.setIndex(idx);
  return geo;
}

/** A soft light: brightest in the middle and falling off to its edges, as a real softbox does. */
const PANEL_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uSoft;
varying vec2 vUv;
void main() {
  vec2 q = abs(vUv - 0.5) * 2.0;
  float edge = (1.0 - smoothstep(uSoft, 1.0, q.x)) * (1.0 - smoothstep(uSoft, 1.0, q.y));
  gl_FragColor = vec4(uColor * edge * (0.72 + 0.28 * (1.0 - dot(q, q) * 0.5)), 1.0);
}`;

/** A dark photo studio: the long soft lights are what a curved lens shows off, and they are all it needs to read as glass. */
function studioEnvironment() {
  const env = new THREE.Scene();
  env.background = new THREE.Color('#0b0b0c');
  const panel = (w: number, h: number, color: string, power: number, x: number, y: number, z: number, soft = 0.82) => {
    const material = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color).multiplyScalar(power) }, uSoft: { value: soft } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: PANEL_FRAG,
      side: THREE.DoubleSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    env.add(mesh);
  };
  // the dim room itself: a lens at a steep angle mirrors it whole, by total internal reflection
  env.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(40, 24, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: 'varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'varying vec3 vP; void main() { vec3 d = normalize(vP); float up = 0.5 + 0.5 * d.y; gl_FragColor = vec4(vec3(0.05, 0.052, 0.056) + vec3(0.42, 0.42, 0.40) * up * up * (0.45 + 0.55 * max(d.z, 0.0)), 1.0); }',
      }),
    ),
  );
  panel(7, 7, '#fffaf2', 4, 9.9, 0.4, 4.8, 0.15); // off to one side of what a lens at its resting angle mirrors: a soft sweep, not a shape
  panel(13, 3, '#ffffff', 4.5, 1.5, 7.5, 6); // overhead softbox, in front of the lens
  panel(0.9, 12, '#ffffff', 9, -8.5, 1, 6); // long strip on the left
  panel(3.5, 12, '#f2ece2', 1.15, 9, 0, 1.5); // broad soft fill on the right: a sheen, not a stripe
  panel(9, 0.8, '#bcd2ff', 3, 0, -7.5, 5); // cool low strip
  panel(26, 26, '#26272a', 1, 0, 0, -13); // dim wall behind, for the sides of the frame
  panel(26, 26, '#1c1c1e', 1, 0, 13, -2);
  return env;
}

export function createSimulator(host: HTMLElement, labels: LabelMap, reduceMotion: boolean): Simulator {
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = 'absolute inset-0 h-full w-full cursor-grab touch-pan-y outline-none active:cursor-grabbing';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  let disposed = false;
  let raf = 0;
  let state: SimState | null = null;
  let frameKey = '';
  let curSph = 0;
  let curN = 1.5;
  let solved: SolvedLens | null = null;
  let lensReady = false;

  // ---------------------------------------------------------------- 3D lens stage
  const stage = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = studioEnvironment();
  const hdr = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  const cube = new THREE.WebGLCubeRenderTarget(256, { type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  const cubeCamera = new THREE.CubeCamera(0.1, 60, cube);
  let envRt: THREE.WebGLRenderTarget | null = null;
  /** Blurred for the frame's materials, sharp for the glass. Render targets don't survive a lost context, so this can run again. */
  function captureEnvironment() {
    envRt?.dispose();
    envRt = pmrem.fromScene(envScene, 0.038);
    stage.environment = envRt.texture;
    cubeCamera.update(renderer, envScene);
  }
  captureEnvironment();
  const kit = createGlass(cube.texture);
  stage.add(kit.wall);
  const pass = createStagePass(renderer);
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 4, 5);
  const rim = new THREE.DirectionalLight(0xffe6bd, 3);
  rim.position.set(-4, 1.5, -3);
  stage.add(key, rim);

  const camera = new THREE.PerspectiveCamera(24, 1.5, 0.1, 80);
  const pair = new THREE.Group();
  pair.rotation.order = 'YXZ';
  stage.add(pair);
  const frameSlot = new THREE.Group();
  pair.add(frameSlot);

  const frontGeo = surfaceGeometry(false);
  const backGeo = surfaceGeometry(true);
  const edgeGeo = edgeGeometry();

  const lensRoots = [-1, 1].map((side) => {
    const root = new THREE.Group();
    const inner = new THREE.Group();
    inner.scale.x = side; // both lenses share one geometry, computed for the +x side
    const front = new THREE.Mesh(frontGeo, kit.front);
    const back = new THREE.Mesh(backGeo, kit.back);
    const edge = new THREE.Mesh(edgeGeo, kit.edge);
    for (const m of [front, back, edge]) m.frustumCulled = false;
    inner.add(edge, front, back);
    root.add(inner);
    pair.add(root);
    return { root, inner, side };
  });

  function writeLens(l: SolvedLens) {
    const stats = lensStats(l, 1);
    kit.setLens(l, stats.min, Math.max(0.05, stats.max - stats.min));
    const fp = frontGeo.attributes.position.array as Float32Array;
    const bp = backGeo.attributes.position.array as Float32Array;
    const n = new THREE.Vector3();
    let j = 0;
    const put = (x: number, y: number) => {
      const r = Math.hypot(x - l.ox, y);
      fp[j] = x;
      fp[j + 1] = y;
      fp[j + 2] = -sag(l.f1, l.n, r);
      bp[j] = x;
      bp[j + 1] = y;
      bp[j + 2] = -l.ct + sag(l.f2, l.n, r);
      j += 3;
    };
    put(0, 0);
    for (let k = 1; k <= RINGS; k += 1) {
      const u = k / RINGS;
      for (let i = 0; i < SEG; i += 1) put(l.rim[i].x * u, l.rim[i].y * u);
    }
    const ep = edgeGeo.attributes.position.array as Float32Array;
    const en = edgeGeo.attributes.normal.array as Float32Array;
    let e = 0;
    let frontSum = 0;
    let thickSum = 0;
    for (let row = 0; row <= ROWS; row += 1) {
      const v = row / ROWS;
      const lean = (0.5 - v) * 0.9; // a polished edge is slightly rounded: the normal tips towards each face
      for (let i = 0; i < SEG; i += 1) {
        const p = l.rim[i];
        const a = l.rim[(i - 1 + SEG) % SEG];
        const b = l.rim[(i + 1) % SEG];
        const r = Math.hypot(p.x - l.ox, p.y);
        const zf = -sag(l.f1, l.n, r);
        const zb = -l.ct + sag(l.f2, l.n, r);
        ep[e] = p.x;
        ep[e + 1] = p.y;
        ep[e + 2] = zf + (zb - zf) * v;
        n.set(b.y - a.y, a.x - b.x, 0).normalize();
        n.z = lean;
        n.normalize();
        en[e] = n.x;
        en[e + 1] = n.y;
        en[e + 2] = n.z;
        if (row === 0) {
          frontSum += zf;
          thickSum += zf - zb;
        }
        e += 3;
      }
    }
    frontGeo.attributes.position.needsUpdate = true;
    backGeo.attributes.position.needsUpdate = true;
    edgeGeo.attributes.position.needsUpdate = true;
    edgeGeo.attributes.normal.needsUpdate = true;
    // the bevel sits a third of the way back from the front of the edge, in the middle of the frame's rim
    const seat = -(frontSum / SEG - thickSum / SEG / 3);
    for (const r of lensRoots) r.inner.position.z = seat * (NOMINAL_WIDTH / frameWidth(state!));
  }

  const frameWidth = (s: SimState) => 2 * s.lensWidth + s.bridge + 14;

  function rebuildFrame(s: SimState) {
    frameSlot.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const m of mats) {
        (m as THREE.MeshStandardMaterial).map?.dispose();
        m.dispose();
      }
    });
    frameSlot.clear();
    const width = frameWidth(s);
    const model = createGlassesModel({
      shape: s.shape,
      build: 'acetate',
      look: FRAME_LOOK,
      dims: { frameWidth: width, lensWidth: s.lensWidth, lensHeight: s.lensHeight, bridgeWidth: s.bridge, templeLength: 140 },
    });
    model.traverse((o) => {
      if (o.userData.flatLens) o.visible = false;
      // this close, the extruded rim's flat facets would show in the softbox reflections; only those: bevels keep their edges
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && !o.userData.flatLens) {
        const smooth = toCreasedNormals(mesh.geometry, 0.22);
        mesh.geometry.dispose();
        mesh.geometry = smooth;
      }
    });
    (model.userData.occluder as THREE.Object3D).visible = false;
    frameSlot.add(model);

    const unit = NOMINAL_WIDTH / width;
    const centre = ((s.lensWidth + s.bridge) * unit) / 2;
    for (const r of lensRoots) {
      r.root.position.set(r.side * centre, 0, 0);
      r.root.rotation.y = r.side * -0.04;
      r.inner.scale.set(r.side * unit, unit, unit);
    }
  }

  // ---------------------------------------------------------------- view through the lens
  const view = createViewPass(renderer);
  const plates = new Map<SceneId, Plate>();
  const additions = new Map<string, Addition>();
  let lensMap: LensMap | undefined;
  let lensMapKey = '';

  /** The traced map for this prescription, material and design; the same key means the same map. */
  function refreshLensMap(s: SimState) {
    const key = `${s.sph}:${s.n}:${s.kind === 'progressive' ? `${s.level}:${s.add}` : ''}`;
    if (key === lensMapKey) return;
    lensMapKey = key;
    const m = materialOf(s.n);
    const l = solveLens(s.sph, s.n, m.centre, s);
    let addition: Addition | null = null;
    if (s.kind === 'progressive') {
      const addKey = `${s.level}:${s.add}`;
      addition = additions.get(addKey) ?? null;
      if (!addition) {
        addition = solveAddition({ add: s.add, ...LEVELS[s.level] });
        additions.set(addKey, addition);
      }
    }
    lensMap = buildLensMap(l, addition, m.offAxis, lensMap);
    view.setLensMap(lensMap);
  }

  function lensFilter(s: SimState): [number, number, number] {
    const dark = s.kind === 'sun' ? 0.8 : s.kind === 'photo' ? PHOTO_DARK[s.scene] : 0;
    if (s.kind === 'screen') return [1, 0.985, 0.9]; // the coat takes part of the blue-violet: a faint warm cast
    if (!dark || !s.tint) return [1, 1, 1];
    const t = new THREE.Color(s.tint);
    const peak = Math.max(t.r, t.g, t.b, 0.001);
    const keep = 0.26;
    const mix = (v: number) => 1 - dark + dark * keep * (0.5 + (0.5 * v) / peak);
    return [mix(t.r), mix(t.g), mix(t.b)];
  }

  // ---------------------------------------------------------------- view control
  /** A still picture averages this many renders: whole sets of red, green and blue. */
  const SAMPLES = 18;
  let sample = 0;
  const REST_YAW = 0.42;
  const PAN_YAW = 0.16;
  const PAN_PITCH = 0.08;
  const REST_PITCH = 0.12;
  let yaw = REST_YAW;
  let pitch = REST_PITCH;
  let intro = reduceMotion ? 1 : 0;
  let panYaw = 0;
  let panPitch = 0;
  let cssW = 4;
  let cssH = 4;
  let last = 0;

  function fit() {
    cssW = Math.max(4, host.clientWidth);
    cssH = Math.max(4, host.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(cssW, cssH, false);
    pass.setSize(canvas.width, canvas.height);
    camera.aspect = cssW / cssH;
    camera.updateProjectionMatrix();
    view.setSize(cssW, cssH, dpr);
  }

  const tmp = new THREE.Vector3();
  function placeLabel(id: LabelId, x: number, y: number) {
    const el = labels[id];
    if (el) el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }

  function placeLensLabels() {
    if (!solved) return;
    const near = lensRoots[0];
    const xs = solved.rim.map((p) => p.x);
    const anchor = (id: LabelId, x: number, y: number, z: number) => {
      near.inner.localToWorld(tmp.set(x, y, z));
      tmp.project(camera);
      placeLabel(id, (tmp.x * 0.5 + 0.5) * cssW, (-tmp.y * 0.5 + 0.5) * cssH);
    };
    const edgeZ = (x: number) => {
      const r = Math.abs(x - solved!.ox);
      return (-sag(solved!.f1, solved!.n, r) + (-solved!.ct + sag(solved!.f2, solved!.n, r))) / 2;
    };
    const xT = Math.max(...xs);
    const xN = Math.min(...xs);
    anchor('centre', solved.ox, 0, 0);
    anchor('temporal', xT, 0, edgeZ(xT));
    anchor('nasal', xN, 0, edgeZ(xN));
  }

  function placeZoneLabels(s: SimState) {
    const k = view.cssPerMm();
    const len = LEVELS[s.level].length;
    const px = (mmx: number, mmy: number) => [cssW / 2 + mmx * k, cssH / 2 - mmy * k] as const;
    placeLabel('far', ...px(0, 15));
    placeLabel('mid', ...px(INSET * 0.5, FIT_Y - len / 2));
    placeLabel('near', ...px(-10, FIT_Y - len - 2));
  }

  /** Each scene is two images, fetched the first time it is opened. The old picture stays up until they arrive. */
  let loading: SceneId | null = null;
  let shownPlate: Plate | null = null;
  function fetchPlate(id: SceneId) {
    loading = id;
    if (labels.busy) labels.busy.style.opacity = '1';
    const wide = canvas.width > 1100;
    loadPlate(id, wide, renderer.capabilities.getMaxAnisotropy())
      .then((plate) => {
        if (disposed) {
          plate.dispose();
          return;
        }
        plates.set(id, plate);
      })
      .catch(() => {
        // a failed fetch must not leave the note up: the next visit to this scene tries again
      })
      .finally(() => {
        loading = null;
        if (labels.busy) labels.busy.style.opacity = '0';
        invalidate();
      });
  }

  function stageTint(s: SimState): [number, number, number] {
    return s.kind === 'sun' ? lensFilter(s) : [1, 1, 1];
  }

  function renderStage(s: SimState, channel: number) {
    kit.setLook(s.heat, stageTint(s));
    kit.setChannel(channel, curN, materialOf(s.n).abbe);
    camera.updateMatrixWorld();
    if (s.showFrame) {
      // the frame alone first: the glass looks up what is behind it here, and can't read the picture it is drawing into
      for (const r of lensRoots) r.root.visible = false;
      kit.wall.visible = false;
      renderer.setRenderTarget(pass.frameOnly);
      renderer.render(stage, camera);
      for (const r of lensRoots) r.root.visible = true;
      kit.wall.visible = true;
    }
    kit.setFrame(s.showFrame ? pass.frameOnly.texture : null, camera);
    renderer.setRenderTarget(pass.main);
    renderer.render(stage, camera);
  }

  function draw(now: number) {
    if (!state) return false;
    const s = state;
    const dt = Math.min(0.1, last ? (now - last) / 1000 : 0.016);
    last = now;
    let moving = false;

    if (s.mode === 'lens') {
      // morph to the new prescription / material
      const speed = reduceMotion ? 1 : 1 - Math.exp(-dt * 11);
      const ds = s.sph - curSph;
      const dn = s.n - curN;
      if (Math.abs(ds) > 0.004 || Math.abs(dn) > 0.0006 || !lensReady) {
        curSph += ds * speed;
        curN += dn * speed;
        if (Math.abs(s.sph - curSph) <= 0.004) curSph = s.sph;
        if (Math.abs(s.n - curN) <= 0.0006) curN = s.n;
        const centre = materialOf(s.n).centre;
        solved = solveLens(curSph, curN, centre, s);
        writeLens(solved);
        lensReady = true;
        moving = curSph !== s.sph || curN !== s.n;
      }
      if (intro < 1) {
        intro = Math.min(1, intro + dt / 1.1);
        moving = true;
      }
      const ease = 1 - Math.pow(1 - intro, 3);
      pair.rotation.y = yaw - (1 - ease) * 0.75;
      pair.rotation.x = pitch;
      frameSlot.visible = s.showFrame;
      const fov = THREE.MathUtils.degToRad(camera.fov);
      const halfW = s.showFrame ? 1.2 : 1.04;
      const distance = Math.max(halfW / (Math.tan(fov / 2) * camera.aspect), (s.showFrame ? 0.9 : 0.78) / Math.tan(fov / 2));
      camera.position.set(0, 0, distance);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      pair.updateMatrixWorld(true);
      if (moving) sample = 0;
      if (sample > SAMPLES) return false;
      if (sample > 0) {
        // one shift per set of colours: otherwise the outline of the lens picks up colours from the sampling itself
        const set = Math.floor((sample - 1) / 3) + 1;
        const jx = halton(set, 2) - 0.5;
        const jy = halton(set, 3) - 0.5;
        camera.setViewOffset(canvas.width, canvas.height, jx, jy, canvas.width, canvas.height);
      } else {
        camera.clearViewOffset();
      }
      renderStage(s, sample > 0 ? (sample - 1) % 3 : -1);
      if (sample === 0) {
        pass.present(false);
        placeLensLabels();
        if (!moving) sample = 1;
        return true;
      }
      pass.accumulate(sample);
      if (sample % 3 === 0) pass.present(true);
      sample += 1;
      return sample <= SAMPLES;
    } else {
      const plate = plates.get(s.scene);
      if (!plate) {
        if (loading !== s.scene) fetchPlate(s.scene);
        return false;
      }
      if (plate !== shownPlate) {
        view.setPlate(plate);
        shownPlate = plate;
      }
      refreshLensMap(s);
      const params: ViewParams = {
        withLens: s.withLens,
        sph: s.sph,
        acc: s.acc,
        abbe: materialOf(s.n).abbe,
        filter: lensFilter(s),
        polar: s.withLens && s.kind === 'sun' && s.polar ? 1 : 0,
        zones: s.zones && s.withLens && s.kind === 'progressive',
        yaw: panYaw,
        pitch: panPitch,
      };
      view.render(params);
      placeZoneLabels(s);
    }
    return moving;
  }

  const tick = (now: number) => {
    raf = 0;
    if (disposed) return;
    if (draw(now)) request();
    else last = 0;
  };
  function request() {
    if (!raf && !disposed) raf = requestAnimationFrame(tick);
  }
  function invalidate() {
    sample = 0;
    request();
  }

  // ---------------------------------------------------------------- input
  function rotate(dx: number, dy: number) {
    if (state?.mode === 'view') {
      panYaw = clamp(panYaw - dx * 0.0014, -PAN_YAW, PAN_YAW);
      panPitch = clamp(panPitch - dy * 0.0012, -PAN_PITCH, PAN_PITCH);
    } else {
      yaw = clamp(yaw + dx * 0.008, -2.6, 2.6);
      pitch = clamp(pitch + dy * 0.006, -0.7, 0.7);
      intro = 1;
    }
    invalidate();
  }

  let dragging: { id: number; x: number; y: number } | null = null;
  const onDown = (e: PointerEvent) => {
    dragging = { id: e.pointerId, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging || e.pointerId !== dragging.id) return;
    rotate(e.clientX - dragging.x, e.clientY - dragging.y);
    dragging.x = e.clientX;
    dragging.y = e.clientY;
  };
  const onUp = (e: PointerEvent) => {
    if (dragging && e.pointerId === dragging.id) dragging = null;
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  const onLost = (e: Event) => e.preventDefault();
  const onRestored = () => {
    lensMapKey = '';
    lensReady = false;
    captureEnvironment();
    invalidate();
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  const resize = new ResizeObserver(() => {
    fit();
    // draw in the same frame as the resize, or the cleared canvas flashes
    if (state && !disposed) {
      sample = 0;
      if (draw(performance.now())) request();
    }
  });
  resize.observe(host);
  fit();

  return {
    update(next) {
      const prev = state;
      state = next;
      const key2 = `${next.shape}:${next.lensWidth}:${next.lensHeight}:${next.bridge}`;
      if (key2 !== frameKey) {
        frameKey = key2;
        rebuildFrame(next);
        lensReady = false;
      }
      if (!prev) {
        curSph = next.sph;
        curN = next.n;
        lensReady = false;
      } else if (prev.pd !== next.pd || prev.heat !== next.heat) {
        lensReady = false;
      }
      invalidate();
    },
    nudge(dx, dy) {
      rotate(dx, dy);
    },
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      resize.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      for (const p of plates.values()) p.dispose();
      plates.clear();
      view.dispose();
      kit.dispose();
      pass.dispose();
      frameSlot.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        for (const m of mats) {
          (m as THREE.MeshStandardMaterial).map?.dispose();
          m.dispose();
        }
      });
      frontGeo.dispose();
      backGeo.dispose();
      edgeGeo.dispose();
      envScene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        (mesh.material as THREE.Material | undefined)?.dispose();
      });
      cube.dispose();
      envRt?.dispose();
      pmrem.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
