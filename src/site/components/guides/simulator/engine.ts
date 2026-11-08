// Lens simulator stage: one WebGL canvas with two views: the real thick lenses in 3D, and the world seen through them.
// Drawn on demand: a control change, a drag or a short morph asks for frames, and at rest nothing runs at all.
import * as THREE from 'three';
import type { FrameShape } from '@/site/tryon/frames';
import { NOMINAL_WIDTH } from '@/site/tryon/pose';
import { clamp } from '@/lib/utils';
import { createGlass, createStagePass } from './glass';
import { backSag, lensStats, materialOf, rightEye, sag, solveLens, type SolvedLens } from './lensMath';
import { buildLensMap, FIT_Y, INSET, solveAddition, type Addition, type AdditionDesign, type LensMap } from './lensOptics';
import { loadPlate, type Plate, type SceneId } from './plates';
import { compileShaders, createViewPass, type ViewParams } from './viewPass';

export type LensKind = 'single' | 'progressive' | 'screen' | 'photo' | 'sun';
export type ProgressiveLevel = 'standard' | 'premium' | 'individual';

export interface SimState {
  mode: 'lens' | 'view';
  sph: number;
  /** cylinder (D, zero or minus) and its axis (degrees, as written on the prescription), the same for both eyes */
  cyl: number;
  axis: number;
  n: number;
  shape: FrameShape;
  lensWidth: number;
  lensHeight: number;
  bridge: number;
  pd: number;
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
  /** Start over after `onSceneFailed`. */
  retryScenes(): void;
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
  panel(7, 7, '#fffaf2', 2.2, 10.6, 0.4, 4.2, 0.05); // off to one side of what a lens at its resting angle mirrors: a soft sweep, not a shape
  panel(13, 3, '#ffffff', 4.5, 1.5, 7.5, 6); // overhead softbox, in front of the lens
  panel(0.9, 12, '#ffffff', 9, -8.5, 1, 6); // long strip on the left
  panel(3.5, 12, '#f2ece2', 1.15, 9, 0, 1.5); // broad soft fill on the right: a sheen, not a stripe
  panel(11, 2.4, '#d6e2ff', 3.4, 0, -7.5, 5, 0.1); // cool low light: it draws the lower edge of the lens, too soft to read as a shape in it
  panel(26, 26, '#26272a', 1, 0, 0, -13); // dim wall behind, for the sides of the lens
  panel(26, 26, '#1c1c1e', 1, 0, 13, -2);
  return env;
}

/** `onPainted` fires once, when the first real picture is on the canvas; `onSceneFailed` when a scene has stopped retrying. */
export function createSimulator(host: HTMLElement, labels: LabelMap, reduceMotion: boolean, events: { onPainted?: () => void; onSceneFailed?: () => void } = {}): Simulator {
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
  let fitKey = '';
  let curSph = 0;
  let curCyl = 0;
  let curAxis = 180;
  let curN = 1.5;
  let solved: SolvedLens | null = null;
  let lensReady = false;

  // ---------------------------------------------------------------- 3D lens stage
  const stage = new THREE.Scene();
  const envScene = studioEnvironment();
  const hdr = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  const cube = new THREE.WebGLCubeRenderTarget(256, { type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  const cubeCamera = new THREE.CubeCamera(0.1, 60, cube);
  const kit = createGlass(cube.texture);
  stage.add(kit.wall);
  const pass = createStagePass(renderer);

  const camera = new THREE.PerspectiveCamera(24, 1.5, 0.1, 80);
  const pair = new THREE.Group();
  pair.rotation.order = 'YXZ';
  stage.add(pair);

  // the front surface is the same on both lenses; a cylinder turns the back of each eye's lens its own way
  const frontGeo = surfaceGeometry(false);
  const eyeGeos = [0, 1].map(() => ({ back: surfaceGeometry(true), edge: edgeGeometry() }));

  // right eye first (the viewer's left), then the left eye
  const lensRoots = [-1, 1].map((side, i) => {
    const root = new THREE.Group();
    const inner = new THREE.Group();
    inner.scale.x = side; // each lens is built with its temple at +x; the right one is mirrored into place
    const front = new THREE.Mesh(frontGeo, kit.eyes[i].front);
    const back = new THREE.Mesh(eyeGeos[i].back, kit.eyes[i].back);
    const edge = new THREE.Mesh(eyeGeos[i].edge, kit.eyes[i].edge);
    for (const m of [front, back, edge]) m.frustumCulled = false;
    inner.add(edge, front, back);
    root.add(inner);
    pair.add(root);
    return { root, inner, side };
  });

  function writeLens(left: SolvedLens) {
    const lenses = [rightEye(left), left];
    const both = lenses.map((l) => lensStats(l, 1));
    const lo = Math.min(both[0].min, both[1].min);
    const hi = Math.max(both[0].max, both[1].max);
    kit.setLens(left, lo, Math.max(0.05, hi - lo));
    lenses.forEach((l, i) => writeEye(l, i));
  }

  function writeEye(l: SolvedLens, eye: number) {
    const { back: backGeo, edge: edgeGeo } = eyeGeos[eye];
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
      bp[j + 2] = -l.ct + backSag(l, x, y);
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
        const zb = -l.ct + backSag(l, p.x, p.y);
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
    // the bevel sits a third of the way back from the front of the edge
    const seat = -(frontSum / SEG - thickSum / SEG / 3);
    lensRoots[eye].inner.position.z = seat * (NOMINAL_WIDTH / frameWidth(state!));
  }

  const frameWidth = (s: SimState) => 2 * s.lensWidth + s.bridge + 14;

  function placeLenses(s: SimState) {
    const unit = NOMINAL_WIDTH / frameWidth(s);
    const centre = ((s.lensWidth + s.bridge) * unit) / 2;
    for (const r of lensRoots) {
      r.root.position.set(r.side * centre, 0, 0);
      r.root.rotation.y = r.side * -0.04;
      r.inner.scale.set(r.side * unit, unit, unit);
    }
  }

  /**
   * The 3D view is prepared once the first picture is up, in a quiet moment (see warmStage), or else when it is opened. The
   * picture on the canvas stays until it is ready, so the click answers at once. Render targets don't survive a lost context,
   * so this can run again.
   */
  let stageReady = false;
  let stagePreparing = false;
  function prepareStage(quietly = false) {
    stagePreparing = true;
    if (labels.busy && !quietly) labels.busy.style.opacity = '1';
    cubeCamera.update(renderer, envScene);
    renderer.setRenderTarget(pass.main);
    const compiled = compileShaders(renderer, stage, camera);
    renderer.setRenderTarget(null);
    compiled
      .catch(() => {
        // a shader that failed here reports itself on first use
      })
      .finally(() => {
        stageReady = true;
        stagePreparing = false;
        if (labels.busy && !loading.size) labels.busy.style.opacity = '0';
        if (state?.mode === 'lens') invalidate();
      });
  }
  /**
   * Once, then never again: the first switch to 3D otherwise stops the page. It waits until the page has finished arriving, and
   * for a moment with no frames coming rather than a gap between two of them, so it can't land in a load or in the middle of a
   * drag. A click before then prepares it with the pill. On a data-saving connection it always waits for the click.
   */
  function warmStage() {
    if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;
    const hasIdle = typeof requestIdleCallback === 'function';
    const go = (idle?: IdleDeadline) => {
      if (disposed || stageReady || stagePreparing) return;
      if (idle && idle.timeRemaining() < 30) {
        requestIdleCallback(go);
        return;
      }
      if (!renderer.getContext().isContextLost()) prepareStage(true);
    };
    window.setTimeout(() => {
      if (hasIdle) requestIdleCallback(go);
      else go();
    }, 4000);
  }

  // ---------------------------------------------------------------- view through the lens
  const view = createViewPass(renderer);
  let viewReady = false;
  view
    .prepare()
    .catch(() => {
      // a shader that failed here reports itself on first use
    })
    .finally(() => {
      viewReady = true;
      invalidate();
    });
  const plates = new Map<SceneId, Plate>();
  const additions = new Map<string, Addition>();
  let lensMap: LensMap | undefined;
  let lensMapKey = '';

  /** The traced map for this prescription, material and design; the same key means the same map. */
  function refreshLensMap(s: SimState) {
    // a toric lens is traced as its spherical equivalent, which carries its distortion and off-axis error; what the
    // cylinder adds on top (its own prism and the error it corrects) is worked out in the shader
    const se = s.sph + s.cyl / 2;
    const key = `${se}:${s.n}:${s.kind === 'progressive' ? `${s.level}:${s.add}` : ''}`;
    if (key === lensMapKey) return;
    lensMapKey = key;
    const m = materialOf(s.n);
    const l = solveLens(se, s.n, m.centre, s);
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
  const REVEAL_SECONDS = 1.05;
  /** How far the lens has opened, 0 to 1: it grows out of the blurred world when it first appears and on the with / without switch. */
  let reveal = reduceMotion ? 1 : 0;
  let painted = false;
  function markPainted() {
    if (painted) return;
    painted = true;
    events.onPainted?.();
    warmStage();
  }

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
    // the readings sit on the right eye's lens, the one nearer the viewer
    const near = lensRoots[0];
    const lens = rightEye(solved);
    const xs = solved.rim.map((p) => p.x);
    const anchor = (id: LabelId, x: number, y: number, z: number) => {
      near.inner.localToWorld(tmp.set(x, y, z));
      tmp.project(camera);
      placeLabel(id, (tmp.x * 0.5 + 0.5) * cssW, (-tmp.y * 0.5 + 0.5) * cssH);
      const el = labels[id];
      if (el) el.style.visibility = 'visible';
    };
    const edgeZ = (x: number) => (-sag(lens.f1, lens.n, Math.abs(x - lens.ox)) - lens.ct + backSag(lens, x, 0)) / 2;
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
    // they point at places on the lens: not before it has opened
    for (const id of ['far', 'mid', 'near'] as const) {
      const el = labels[id];
      if (el) el.style.opacity = reveal > 0.85 ? '1' : '0';
    }
  }

  /** Each scene is two images, fetched the first time it is opened. The old picture stays up until they arrive. */
  const MAX_TRIES = 3;
  const loading = new Set<SceneId>();
  const failures = new Map<SceneId, number>();
  let retryAt = 0;
  let shownPlate: Plate | null = null;
  function fetchPlate(id: SceneId) {
    loading.add(id);
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
        // tried again shortly, a few times; opening the scene again starts over
        const count = (failures.get(id) ?? 0) + 1;
        failures.set(id, count);
        if (count >= MAX_TRIES) {
          events.onSceneFailed?.();
          return;
        }
        retryAt = performance.now() + 2500;
        window.setTimeout(invalidate, 2600);
      })
      .finally(() => {
        loading.delete(id);
        if (labels.busy && !loading.size) labels.busy.style.opacity = '0';
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
      if (!stageReady) {
        if (!stagePreparing) prepareStage();
        // it was getting ready unseen, and now someone is waiting for it
        else if (labels.busy) labels.busy.style.opacity = '1';
        return false;
      }
      // morph to the new prescription / material
      const speed = reduceMotion ? 1 : 1 - Math.exp(-dt * 11);
      const ds = s.sph - curSph;
      const dc = s.cyl - curCyl;
      // the axis turns the short way round: 175° to 5° is ten degrees, not 170
      const da = ((((s.axis - curAxis) % 180) + 270) % 180) - 90;
      const dn = s.n - curN;
      if (Math.abs(ds) > 0.004 || Math.abs(dc) > 0.004 || Math.abs(da) > 0.2 || Math.abs(dn) > 0.0006 || !lensReady) {
        curSph += ds * speed;
        curCyl += dc * speed;
        curAxis += da * speed;
        curN += dn * speed;
        if (Math.abs(s.sph - curSph) <= 0.004) curSph = s.sph;
        if (Math.abs(s.cyl - curCyl) <= 0.004) curCyl = s.cyl;
        if (Math.abs(da * (1 - speed)) <= 0.2) curAxis = s.axis;
        if (Math.abs(s.n - curN) <= 0.0006) curN = s.n;
        const centre = materialOf(s.n).centre;
        solved = solveLens(curSph, curN, centre, s, curCyl, curAxis);
        writeLens(solved);
        lensReady = true;
        moving = curSph !== s.sph || curCyl !== s.cyl || curAxis !== s.axis || curN !== s.n;
      }
      if (intro < 1) {
        intro = Math.min(1, intro + dt / 1.1);
        moving = true;
      }
      const ease = 1 - Math.pow(1 - intro, 3);
      pair.rotation.y = yaw - (1 - ease) * 0.75;
      pair.rotation.x = pitch;
      const fov = THREE.MathUtils.degToRad(camera.fov);
      const halfW = 1.04;
      const distance = Math.max(halfW / (Math.tan(fov / 2) * camera.aspect), 0.78 / Math.tan(fov / 2));
      camera.position.set(0, 0, distance);
      camera.lookAt(0, 0, 0);
      // turned, the nearer lens looks bigger and the pair drifts towards it: this keeps it in the middle of the stage
      const reach = (s.lensWidth + s.bridge / 2) * (NOMINAL_WIDTH / frameWidth(s));
      pair.position.x = (reach * reach * Math.sin(pair.rotation.y) * Math.cos(pair.rotation.y)) / distance;
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
        markPainted();
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
        if (!loading.has(s.scene) && (failures.get(s.scene) ?? 0) < MAX_TRIES && now >= retryAt) fetchPlate(s.scene);
        return false;
      }
      if (!viewReady) return false;
      if (plate !== shownPlate) {
        view.setPlate(plate);
        shownPlate = plate;
      }
      refreshLensMap(s);
      const target = s.withLens ? 1 : 0;
      if (reveal !== target) {
        reveal = reduceMotion ? target : target > reveal ? Math.min(target, reveal + dt / REVEAL_SECONDS) : Math.max(target, reveal - dt / REVEAL_SECONDS);
        moving = true;
      }
      const params: ViewParams = {
        reveal: reveal * reveal * (3 - 2 * reveal),
        sph: s.sph,
        cyl: s.cyl,
        axis: s.axis,
        acc: s.acc,
        abbe: materialOf(s.n).abbe,
        filter: lensFilter(s),
        polar: reveal > 0 && s.kind === 'sun' && s.polar ? 1 : 0,
        zones: s.zones && reveal > 0 && s.kind === 'progressive',
        yaw: panYaw,
        pitch: panPitch,
      };
      view.render(params);
      placeZoneLabels(s);
      markPainted();
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
    stageReady = false;
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
      if (key2 !== fitKey) {
        fitKey = key2;
        placeLenses(next);
        lensReady = false;
      }
      if (!prev) {
        curSph = next.sph;
        curCyl = next.cyl;
        curAxis = next.axis;
        curN = next.n;
        lensReady = false;
      } else if (prev.pd !== next.pd || prev.heat !== next.heat) {
        lensReady = false;
      }
      if (prev && prev.scene !== next.scene) failures.delete(next.scene);
      invalidate();
    },
    nudge(dx, dy) {
      rotate(dx, dy);
    },
    retryScenes() {
      failures.clear();
      retryAt = 0;
      invalidate();
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
      frontGeo.dispose();
      for (const g of eyeGeos) {
        g.back.dispose();
        g.edge.dispose();
      }
      envScene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        (mesh.material as THREE.Material | undefined)?.dispose();
      });
      cube.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
