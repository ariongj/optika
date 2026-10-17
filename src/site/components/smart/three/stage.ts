// Render stage shared by the live component and the still renderer: WebGL renderer, studio environment
// (PMREM), key / rim lights, gradient backdrop, blurred contact shadow, framing and part projection.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { HorizontalBlurShader } from 'three/examples/jsm/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/examples/jsm/shaders/VerticalBlurShader.js';
import { createGlassesModel, type GlassesModel } from './model';
import { SHAPE_FOR_VARIANT, partsForVariant, type SmartBackground, type SmartColorway, type SmartPart, type SmartPartPoints, type SmartShape, type SmartVariant } from './types';

export interface StageLook {
  variant: SmartVariant;
  colorway: SmartColorway;
  shape?: SmartShape;
  background: SmartBackground;
}

export interface StageFraming {
  fill: number;
  fillHeight: number;
  offsetX: number;
  offsetY: number;
  /** camera elevation above the model (rad) */
  elevation: number;
  /** vertical field of view (deg) */
  fov: number;
  /** pose the framing is computed for */
  restYaw: number;
  restPitch: number;
}

export interface StagePose {
  yaw: number;
  pitch: number;
  lift: number;
  exploded: number;
  highlight: Record<SmartPart, number>;
  hud: number;
  led: number;
  time: number;
  reduced: boolean;
}

/** Studio tuning (stills use it to art-direct each shot). */
export interface StudioTuning {
  top: string;
  bottom: string;
  glow: string;
  glowAmount: number;
  glowX: number;
  glowY: number;
  glowW: number;
  glowH: number;
  vignette: number;
  shadow: number;
  exposure: number;
  key: number;
  rim: number;
  fill: number;
}

export const DEFAULT_FRAMING: StageFraming = { fill: 0.74, fillHeight: 0.66, offsetX: 0, offsetY: 0, elevation: 0.16, fov: 22, restYaw: -0.5, restPitch: 0.06 };

const STUDIO: Record<SmartBackground, StudioTuning> = {
  light: { top: '#f3ede4', bottom: '#e7dece', glow: '#fffaf1', glowAmount: 0.14, glowX: 0.5, glowY: 0.56, glowW: 0.5, glowH: 0.42, vignette: 0.22, shadow: 1, exposure: 1.0, key: 2.2, rim: 0.9, fill: 0.55 },
  dark: { top: '#0c0e0d', bottom: '#050606', glow: '#2c4a3a', glowAmount: 0.5, glowX: 0.5, glowY: 0.54, glowW: 0.46, glowH: 0.4, vignette: 0.55, shadow: 0, exposure: 1.05, key: 2.0, rim: 2.8, fill: 0.15 },
  transparent: { top: '#000000', bottom: '#000000', glow: '#000000', glowAmount: 0, glowX: 0.5, glowY: 0.5, glowW: 0.5, glowH: 0.5, vignette: 0, shadow: 0, exposure: 1.05, key: 2.0, rim: 2.8, fill: 0.2 },
};

/* ------------------------------------------------------------------ */
/* Environments                                                        */
/* ------------------------------------------------------------------ */
/** Dark product studio: near-black room, overhead softbox, two strip lights and a mint rim strip. */
function darkStudio() {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.006, 0.0075, 0.007), side: THREE.BackSide }));
  room.scale.set(40, 24, 40);
  s.add(room);
  const panel = (w: number, h: number, pos: THREE.Vector3, color: THREE.Color) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.copy(pos);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  panel(12, 5, new THREE.Vector3(0, 10, 1), new THREE.Color(1, 1, 1).multiplyScalar(4.4));
  panel(5, 12, new THREE.Vector3(-10, 2, 6), new THREE.Color(1, 0.97, 0.93).multiplyScalar(1.3));
  panel(1.3, 10, new THREE.Vector3(10, 1.5, -6), new THREE.Color(0.75, 1, 0.88).multiplyScalar(4));
  panel(1.1, 8, new THREE.Vector3(-9, 1, -8), new THREE.Color(0.85, 0.92, 1).multiplyScalar(2.2));
  panel(10, 3, new THREE.Vector3(0, 3, 12), new THREE.Color(1, 1, 1).multiplyScalar(0.9));
  panel(20, 1.6, new THREE.Vector3(0, 1.4, -11), new THREE.Color(0.75, 1, 0.88).multiplyScalar(2.4));
  panel(2, 9, new THREE.Vector3(9, 4, 4), new THREE.Color(1, 1, 1).multiplyScalar(1.6));
  panel(14, 6, new THREE.Vector3(0, -6, 4), new THREE.Color(0.17, 0.29, 0.23).multiplyScalar(0.35));
  return s;
}

/** Light studio: RoomEnvironment plus a long overhead strip for crisp highlights on glossy acetate. */
function lightStudio(renderer: THREE.WebGLRenderer) {
  const s = new RoomEnvironment(renderer);
  // calmer walls so glossy black stays black between the highlights
  s.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.material instanceof THREE.MeshStandardMaterial) m.material.color.setRGB(0.5, 0.47, 0.43);
  });
  const panel = (w: number, h: number, pos: THREE.Vector3, k: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.97, 0.93).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.copy(pos);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  panel(16, 2.6, new THREE.Vector3(0, 19, 4), 16);
  panel(2.6, 14, new THREE.Vector3(-14, 7, 7), 9);
  panel(2.2, 12, new THREE.Vector3(14, 7, 1), 6);
  panel(9, 2, new THREE.Vector3(0, 5, 13), 5);
  return s;
}

function disposeScene(s: THREE.Scene) {
  s.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  });
}

/* ------------------------------------------------------------------ */
/* Backdrop (full-screen gradient with glow + dither)                  */
/* ------------------------------------------------------------------ */
function createBackdrop() {
  const uniforms = {
    cTop: { value: new THREE.Color() },
    cBottom: { value: new THREE.Color() },
    cGlow: { value: new THREE.Color() },
    glowPos: { value: new THREE.Vector2(0.5, 0.5) },
    glowSize: { value: new THREE.Vector2(0.5, 0.5) },
    glowAmt: { value: 0 },
    vignette: { value: 0 },
    aspect: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 cTop; uniform vec3 cBottom; uniform vec3 cGlow;
      uniform vec2 glowPos; uniform vec2 glowSize; uniform float glowAmt; uniform float vignette; uniform float aspect;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec3 col = mix(cBottom, cTop, smoothstep(0.0, 1.0, vUv.y));
        vec2 d = (vUv - glowPos) * vec2(aspect, 1.0) / (glowSize * vec2(aspect, 1.0));
        col += cGlow * exp(-dot(d, d) * 1.6) * glowAmt;
        vec2 v = vUv - 0.5; v.x *= aspect;
        col *= 1.0 - vignette * dot(v, v);
        gl_FragColor = vec4(max(col, 0.0), 1.0);
        #include <colorspace_fragment>
        gl_FragColor.rgb += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -100;
  return { mesh, uniforms };
}

/* ------------------------------------------------------------------ */
/* Contact shadow (depth from below, blurred)                           */
/* ------------------------------------------------------------------ */
function createContactShadow(renderer: THREE.WebGLRenderer, res: number) {
  const SIZE = 3.4;
  const HEIGHT = 0.5;
  const rt = new THREE.WebGLRenderTarget(res, res);
  rt.texture.generateMipmaps = false;
  const rtBlur = new THREE.WebGLRenderTarget(res, res);
  rtBlur.texture.generateMipmaps = false;
  const group = new THREE.Group();
  const planeGeo = new THREE.PlaneGeometry(SIZE, SIZE).rotateX(Math.PI / 2);
  const planeMat = new THREE.MeshBasicMaterial({ map: rt.texture, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.renderOrder = 1;
  plane.scale.y = -1;
  group.add(plane);
  const blurPlane = new THREE.Mesh(planeGeo);
  blurPlane.visible = false;
  group.add(blurPlane);
  const cam = new THREE.OrthographicCamera(-SIZE / 2, SIZE / 2, SIZE / 2, -SIZE / 2, 0, HEIGHT);
  cam.rotation.x = Math.PI / 2;
  group.add(cam);
  const depthMat = new THREE.MeshDepthMaterial();
  depthMat.onBeforeCompile = (shader) => {
    shader.uniforms.darkness = { value: 1.35 };
    shader.fragmentShader = `uniform float darkness;\n${shader.fragmentShader.replace(
      'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );',
      'gl_FragColor = vec4( vec3( 0.0 ), pow( 1.0 - fragCoordZ, 1.6 ) * darkness );',
    )}`;
  };
  depthMat.depthTest = false;
  depthMat.depthWrite = false;
  const hBlur = new THREE.ShaderMaterial(HorizontalBlurShader);
  hBlur.depthTest = false;
  const vBlur = new THREE.ShaderMaterial(VerticalBlurShader);
  vBlur.depthTest = false;

  const blur = (amount: number) => {
    blurPlane.visible = true;
    blurPlane.material = hBlur;
    hBlur.uniforms.tDiffuse.value = rt.texture;
    hBlur.uniforms.h.value = amount / 256;
    renderer.setRenderTarget(rtBlur);
    renderer.render(blurPlane, cam);
    blurPlane.material = vBlur;
    vBlur.uniforms.tDiffuse.value = rtBlur.texture;
    vBlur.uniforms.v.value = amount / 256;
    renderer.setRenderTarget(rt);
    renderer.render(blurPlane, cam);
    blurPlane.visible = false;
  };

  return {
    group,
    plane,
    setOpacity(o: number) {
      planeMat.opacity = o;
      group.visible = o > 0;
    },
    update(scene: THREE.Scene, hide: THREE.Object3D[]) {
      if (!group.visible) return;
      const was = hide.map((o) => o.visible);
      hide.forEach((o) => (o.visible = false));
      plane.visible = false;
      const bg = scene.background;
      scene.background = null;
      scene.overrideMaterial = depthMat;
      const clearAlpha = renderer.getClearAlpha();
      const clear = renderer.getClearColor(new THREE.Color());
      renderer.setClearColor(0x000000, 0);
      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(scene, cam);
      scene.overrideMaterial = null;
      blur(1.4);
      blur(0.55);
      renderer.setRenderTarget(null);
      renderer.setClearColor(clear, clearAlpha);
      scene.background = bg;
      plane.visible = true;
      hide.forEach((o, i) => (o.visible = was[i]));
    },
    dispose() {
      rt.dispose();
      rtBlur.dispose();
      planeGeo.dispose();
      planeMat.dispose();
      depthMat.dispose();
      hBlur.dispose();
      vBlur.dispose();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Stage                                                               */
/* ------------------------------------------------------------------ */
export interface Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  setLook(look: StageLook): void;
  setTuning(t: Partial<StudioTuning>): void;
  setSize(width: number, height: number, pixelRatio: number): void;
  setFraming(f: Partial<StageFraming>): void;
  apply(pose: StagePose): void;
  render(): void;
  /** Compile the current look's shaders without stalling the page (KHR_parallel_shader_compile where available). */
  compile(): Promise<void>;
  project(pose: StagePose): SmartPartPoints;
  /** Free everything (waits for a compile in flight) and release the WebGL context. */
  dispose(): void;
}

export function createStage(canvas: HTMLCanvasElement, opts: { antialias?: boolean; preserveDrawingBuffer?: boolean; shadowRes?: number } = {}): Stage {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: opts.antialias ?? true,
    alpha: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: !!opts.preserveDrawingBuffer,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(DEFAULT_FRAMING.fov, 1, 0.05, 60);
  const pivot = new THREE.Group();
  pivot.rotation.order = 'YXZ';
  scene.add(pivot);

  const key = new THREE.DirectionalLight('#fff4e8', 2);
  key.position.set(-4, 6, 6);
  const rim = new THREE.DirectionalLight('#c4f5e0', 2.6);
  rim.position.set(6, 3, -6);
  const rim2 = new THREE.DirectionalLight('#d6e2ff', 1.2);
  rim2.position.set(-6, 2.5, -5);
  const fill = new THREE.DirectionalLight('#ffffff', 0.5);
  fill.position.set(5, 1.5, 5);
  scene.add(key, rim, rim2, fill);

  const backdrop = createBackdrop();
  scene.add(backdrop.mesh);
  const shadow = createContactShadow(renderer, opts.shadowRes ?? 512);
  scene.add(shadow.group);

  const pmrem = new THREE.PMREMGenerator(renderer);
  let envTex: THREE.Texture | null = null;
  let envMode: 'dark' | 'light' | null = null;
  const setEnv = (mode: 'dark' | 'light') => {
    if (envMode === mode) return;
    envMode = mode;
    const src = mode === 'dark' ? darkStudio() : lightStudio(renderer);
    const rt = pmrem.fromScene(src, 0.03);
    envTex?.dispose();
    envTex = rt.texture;
    scene.environment = envTex;
    disposeScene(src);
  };

  let model: GlassesModel | null = null;
  let look: StageLook | null = null;
  let tuning: StudioTuning = { ...STUDIO.dark };
  let framing: StageFraming = { ...DEFAULT_FRAMING };
  let width = 1;
  let height = 1;
  let baseDistance = 6;
  let floorY = -0.3;
  let samples: THREE.Vector3[] = [];
  // compileAsync keeps polling the programs it started: freeing their materials (or losing the context) before it
  // settles makes three throw, so disposal waits for every compile in flight.
  let pending: Promise<void> | null = null;
  const afterCompiles = (fn: () => void) => (pending ? void pending.then(fn) : fn());
  let parts: SmartPart[] = [];

  const applyTuning = () => {
    const u = backdrop.uniforms;
    u.cTop.value.set(tuning.top);
    u.cBottom.value.set(tuning.bottom);
    u.cGlow.value.set(tuning.glow);
    u.glowAmt.value = tuning.glowAmount;
    u.glowPos.value.set(tuning.glowX, tuning.glowY);
    u.glowSize.value.set(tuning.glowW, tuning.glowH);
    u.vignette.value = tuning.vignette;
    renderer.toneMappingExposure = tuning.exposure;
    key.intensity = tuning.key;
    rim.intensity = tuning.rim;
    rim2.intensity = tuning.rim * 0.45;
    fill.intensity = tuning.fill;
    shadow.setOpacity(look?.background === 'light' ? tuning.shadow : 0);
    backdrop.mesh.visible = look?.background !== 'transparent';
  };

  const collectSamples = (root: THREE.Object3D) => {
    const pts: THREE.Vector3[] = [];
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.geometry) return;
      const mat = m.material as THREE.Material;
      if (mat.depthTest === false || mat.blending === THREE.AdditiveBlending) return;
      const pos = m.geometry.attributes.position as THREE.BufferAttribute;
      const step = Math.max(1, Math.floor(pos.count / 400));
      const local = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
      for (let i = 0; i < pos.count; i += step) pts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(local));
    });
    return pts;
  };

  const fit = () => {
    if (!model) return;
    camera.fov = framing.fov;
    camera.aspect = width / height;
    camera.clearViewOffset();
    pivot.position.set(0, 0, 0);
    pivot.rotation.set(framing.restPitch, framing.restYaw, 0);
    pivot.updateMatrixWorld(true);
    const world = samples.map((p) => p.clone().applyMatrix4(model!.root.matrixWorld));
    floorY = Math.min(...world.map((p) => p.y)) - 0.004;
    let d = 6;
    const el = framing.elevation;
    const ndc = new THREE.Vector3();
    let bx = [0, 0, 0, 0];
    for (let it = 0; it < 5; it += 1) {
      camera.position.set(0, Math.sin(el) * d, Math.cos(el) * d);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const p of world) {
        ndc.copy(p).project(camera);
        minX = Math.min(minX, ndc.x);
        maxX = Math.max(maxX, ndc.x);
        minY = Math.min(minY, ndc.y);
        maxY = Math.max(maxY, ndc.y);
      }
      bx = [minX, maxX, minY, maxY];
      const k = Math.max((maxX - minX) / 2 / framing.fill, (maxY - minY) / 2 / framing.fillHeight);
      d *= k;
    }
    baseDistance = d;
    const cxN = (bx[0] + bx[1]) / 2;
    const cyN = (bx[2] + bx[3]) / 2;
    camera.setViewOffset(width, height, ((cxN - framing.offsetX * 2) / 2) * width, ((framing.offsetY * 2 - cyN) / 2) * height, width, height);
    shadow.group.position.y = floorY;
  };

  const stage: Stage = {
    renderer,
    camera,
    setLook(next) {
      const shape = next.shape ?? SHAPE_FOR_VARIANT[next.variant];
      const prev = look;
      const prevShape = prev ? prev.shape ?? SHAPE_FOR_VARIANT[prev.variant] : null;
      const transparentChanged = prev ? (prev.background === 'transparent') !== (next.background === 'transparent') : true;
      look = { ...next, shape };
      if (!prev || prev.background !== next.background) {
        tuning = { ...STUDIO[next.background] };
        setEnv(next.background === 'light' ? 'light' : 'dark');
      }
      if (!model || !prev || prev.variant !== next.variant || prev.colorway !== next.colorway || prevShape !== shape || transparentChanged) {
        if (model) {
          pivot.remove(model.root);
          const old = model;
          afterCompiles(() => old.dispose());
        }
        model = createGlassesModel({ variant: next.variant, colorway: next.colorway, shape, transparentBg: next.background === 'transparent' });
        pivot.add(model.root);
        samples = collectSamples(model.root);
        parts = partsForVariant(next.variant);
      }
      applyTuning();
      fit();
    },
    setTuning(t) {
      tuning = { ...tuning, ...t };
      applyTuning();
    },
    setSize(w, h, pr) {
      width = Math.max(1, Math.round(w));
      height = Math.max(1, Math.round(h));
      renderer.setPixelRatio(pr);
      renderer.setSize(width, height, false);
      backdrop.uniforms.aspect.value = width / height;
      fit();
    },
    setFraming(f) {
      framing = { ...framing, ...f };
      fit();
    },
    apply(pose) {
      if (!model) return;
      pivot.rotation.set(pose.pitch, pose.yaw, 0);
      pivot.position.y = pose.lift;
      model.update(pose);
      const d = baseDistance * (1 + 0.18 * pose.exploded);
      const el = framing.elevation;
      camera.position.set(0, Math.sin(el) * d, Math.cos(el) * d);
      camera.lookAt(0, 0, 0);
    },
    render() {
      if (!model) return;
      if (look?.background === 'light') shadow.update(scene, [backdrop.mesh]);
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    },
    compile() {
      const p = renderer.compileAsync(scene, camera).then(
        () => undefined,
        () => undefined,
      );
      const all: Promise<void> = (pending ? Promise.all([pending, p]) : p).then(() => {
        if (pending === all) pending = null;
      });
      pending = all;
      return p;
    },
    project(pose) {
      const out: SmartPartPoints = {};
      if (!model) return out;
      camera.updateMatrixWorld();
      scene.updateMatrixWorld();
      const p = new THREE.Vector3();
      const n = new THREE.Vector3();
      const toCam = new THREE.Vector3();
      for (const part of parts) {
        const a = model.anchors[part];
        if (!a) continue;
        a.anchor.getWorldPosition(p);
        a.anchor.getWorldDirection(n);
        toCam.copy(camera.position).sub(p).normalize();
        let visible = n.dot(toCam) > -0.08;
        if (a.hidden && pose.exploded < 0.3 && (pose.highlight[part] ?? 0) < 0.5) visible = false;
        p.project(camera);
        const x = (p.x + 1) / 2;
        const y = (1 - p.y) / 2;
        if (x < -0.05 || x > 1.05 || y < -0.05 || y > 1.05) visible = false;
        out[part] = { x: Math.round(x * 10000) / 10000, y: Math.round(y * 10000) / 10000, visible };
      }
      return out;
    },
    dispose() {
      const last = model;
      model = null;
      if (last) pivot.remove(last.root);
      afterCompiles(() => {
        last?.dispose();
        shadow.dispose();
        backdrop.mesh.geometry.dispose();
        (backdrop.mesh.material as THREE.Material).dispose();
        envTex?.dispose();
        pmrem.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
      });
    },
  };
  return stage;
}
