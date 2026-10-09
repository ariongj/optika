// ============================================================================
// lens3d.js — scroll-driven optical fabrication scene.
// One lens, made live: blank → laser cut → curve → polish → 7-layer coating →
// polarization → spectrum → photochromic → hardness → bevel → wavefront scan.
// All state derives from scroll progress p ∈ [0,1] (idempotent per frame).
// ============================================================================
import * as THREE from './three.module.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const outCubic = (t) => 1 - Math.pow(1 - t, 3);
const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
function trap(p, a, b, c, d) {
  if (p <= a || p >= d) return 0;
  if (p < b) return smooth((p - a) / (b - a));
  if (p > c) return smooth(1 - (p - c) / (d - c));
  return 1;
}
const pulse = (p, at, sharp) => Math.exp(-Math.pow((p - at) * sharp, 2));

// ---------------------------------------------------------------- outline
function superPts(n, rx, ry, e) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = Math.PI / 2 + (i / n) * TAU;
    const c = Math.cos(t), s = Math.sin(t);
    pts.push(new THREE.Vector2(
      rx * Math.sign(c) * Math.pow(Math.abs(c), 2 / e),
      ry * Math.sign(s) * Math.pow(Math.abs(s), 2 / e)
    ));
  }
  return pts;
}

// ------------------------------------------------------- lens body builder
// Dense polar grid over the outline so the spherical sag displaces smoothly.
// Returns { geo, flat, curved } — flat/curved are position arrays for morphing
// the base curve during "curve generation".
function makeLensGeo(pts, thick, R1, R2, rings) {
  const N = pts.length, M = rings || 16;
  const sag = (R, r) => (R <= 0 ? 0 : R - Math.sqrt(Math.max(0, R * R - r * r)));
  const pos = [], idx = [];
  const build = (curve) => {
    const out = [];
    for (let side = 0; side < 2; side++) {           // 0 = front, 1 = back
      const R = side === 0 ? R1 : R2;
      const zBase = side === 0 ? thick / 2 : -thick / 2;
      for (let j = 0; j <= M; j++) {
        const f = j / M;
        for (let i = 0; i < N; i++) {
          const x = pts[i].x * f, y = pts[i].y * f;
          const r = Math.sqrt(x * x + y * y);
          out.push(x, y, zBase - (curve ? sag(R, r) : 0));
        }
      }
    }
    return out;
  };
  const flat = build(false), curved = build(true);
  for (let i = 0; i < curved.length; i++) pos.push(curved[i]);

  const ringCount = M + 1, per = ringCount * N;
  const vi = (side, j, i) => side * per + j * N + (i % N);
  // caps
  for (let side = 0; side < 2; side++) {
    for (let j = 0; j < M; j++) {
      for (let i = 0; i < N; i++) {
        const a = vi(side, j, i), b = vi(side, j, i + 1);
        const c = vi(side, j + 1, i), d = vi(side, j + 1, i + 1);
        if (side === 0) { idx.push(a, c, d, a, d, b); }
        else { idx.push(a, d, c, a, b, d); }
      }
    }
  }
  // rim band (front outer ring -> back outer ring)
  for (let i = 0; i < N; i++) {
    const f0 = vi(0, M, i), f1 = vi(0, M, i + 1);
    const b0 = vi(1, M, i), b1 = vi(1, M, i + 1);
    idx.push(f0, b0, b1, f0, b1, f1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return { geo, flat: new Float32Array(flat), curved: new Float32Array(curved) };
}

// ---------------------------------------------------------------- textures
function radialTex(size, stops) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function streakTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 512, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  const v = x.createLinearGradient(0, 0, 0, 128);
  x.globalCompositeOperation = 'source-over';
  x.fillRect(0, 0, 512, 128);
  v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(0.5, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,1)');
  x.globalCompositeOperation = 'destination-out'; x.fillStyle = v; x.fillRect(0, 0, 512, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function sparkTex() {
  return radialTex(64, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,236,190,0.85)'], [1, 'rgba(255,200,120,0)']]);
}
// Interferogram from real wavefront aberration terms (Zernike-ish):
// defocus r^2, astigmatism r^2cos2t, coma r^3cos t, spherical r^4.
// vertical soft-edged band: bright at the leading edge, fading behind
function sweepTex() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 128;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0.00, 'rgba(255,255,255,0)');
  g.addColorStop(0.46, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.52, 'rgba(255,255,255,1)');
  g.addColorStop(0.58, 'rgba(255,255,255,0.5)');
  g.addColorStop(1.00, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 4, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function interferogramTex(size) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  const img = x.createImageData(size, size);
  const d = img.data;
  const DEF = 5.2, AST = 2.1, COMA = 1.35, SPH = 3.4, TILT = 0.55, AXIS = 0.42;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const u = (i / size) * 2 - 1, v = (j / size) * 2 - 1;
      const r = Math.sqrt(u * u + v * v);
      const o = (j * size + i) * 4;
      if (r > 1) { d[o + 3] = 0; continue; }
      const t = Math.atan2(v, u) - AXIS;
      const r2 = r * r;
      const W = DEF * r2
        + AST * r2 * Math.cos(2 * t)
        + COMA * r2 * r * Math.cos(t)
        + SPH * r2 * r2
        + TILT * r * Math.cos(t + 1.1);
      // fringe minima where the OPD crosses half-wave steps
      const fr = 0.5 + 0.5 * Math.cos(W * Math.PI * 2);
      let b = Math.pow(fr, 7);                    // thin bright fringes
      b *= 0.35 + 0.65 * Math.pow(1 - r, 0.35);   // soften toward the aperture edge
      const edge = 1 - Math.pow(Math.max(0, r - 0.93) / 0.07, 2);
      b *= Math.max(0, Math.min(1, edge));
      const a = Math.max(0, Math.min(255, b * 255));
      d[o] = 190; d[o + 1] = 255; d[o + 2] = 240; d[o + 3] = a;
    }
  }
  x.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function engravingTex(text) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 128;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 1024, 128);
  x.fillStyle = 'rgba(255,255,255,0.92)';
  x.font = '500 62px "IBM Plex Mono", monospace';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.letterSpacing = '18px';
  x.fillText(text, 512, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ============================================================================
export function createHero(opts) {
  const host = opts.host;
  const ST = opts.stages;
  let laserCol = new THREE.Color(opts.laser || '#46E0C8');
  let tintCol = new THREE.Color(opts.tint || '#3A4A52');
  let brand = opts.brand || 'OPTIKA MIFTARI';
  const balanced = !!opts.balanced;
  // The website always embeds this scene inside a full page. Reuse the mobile
  // geometry tier for that embedded surface: the visual difference is small,
  // while first construction and every subsequent frame are substantially
  // lighter on the main thread and GPU.
  let lowQ = !!opts.lowQuality || balanced;
  let reduced = !!opts.reducedMotion;

  const S = (k) => ST[k];
  const [s1a, s1b] = S('s1'), [s2a, s2b] = S('s2'), [s3a, s3b] = S('s3');
  const [s4a, s4b] = S('s4'), [s5a, s5b] = S('s5'), [s6a, s6b] = S('s6');
  const [s7a, s7b] = S('s7'), [s8a, s8b] = S('s8'), [s9a, s9b] = S('s9');
  const [s10a, s10b] = S('s10'), [s11a, s11b] = S('s11'), [s12a, s12b] = S('s12');

  // ------------------------------------------------------------- renderer
  const renderer = new THREE.WebGLRenderer({ antialias: !lowQ, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowQ ? 1 : (balanced ? 1.35 : 1.75)));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.93;
  renderer.shadowMap.enabled = !lowQ;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;';
  const onContextLost = (event) => { event.preventDefault(); opts.onContextLost?.(); };
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const BG_BASE = new THREE.Color('#F0EEE7');
  const BG_DIM = new THREE.Color('#0A0E12');
  scene.background = BG_BASE.clone();
  scene.fog = new THREE.Fog(BG_BASE.clone(), 340, 760);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 2000);
  camera.position.set(0, 8, 128);

  // ------------------------------------------------------------- environment
  let pmrem = null;
  let environmentTarget = null;
  let disposed = false;
  // Reflection-map compilation is one of the most expensive cold-start tasks.
  // The embedded scene already has purpose-built lights, so reserve the full
  // environment pipeline for the standalone high-quality experience.
  if (!lowQ) {
    pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = radialTex(256, [[0, '#ffffff'], [0.32, '#dfe8ee'], [0.72, '#6d7a83'], [1, '#141a1f']]);
    environmentTarget = pmrem.fromEquirectangular(envTex);
    scene.environment = environmentTarget.texture;
    envTex.dispose();
    import('three/addons/environments/RoomEnvironment.js')
      .then((re) => {
        if (disposed || !pmrem) return;
        const nextTarget = pmrem.fromScene(new re.RoomEnvironment(), 0.04);
        environmentTarget?.dispose();
        environmentTarget = nextTarget;
        scene.environment = nextTarget.texture;
      })
      .catch(() => {});
  }

  // ------------------------------------------------------------- lighting
  const hemi = new THREE.HemisphereLight(0xdcecff, 0x232b31, 0.2);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xeaf4ff, 1.1);
  key.position.set(-72, 84, 112);
  key.castShadow = true;
  key.shadow.mapSize.set(lowQ ? 512 : 1024, lowQ ? 512 : 1024);
  key.shadow.camera.near = 20; key.shadow.camera.far = 320;
  key.shadow.camera.left = -90; key.shadow.camera.right = 90;
  key.shadow.camera.top = 90; key.shadow.camera.bottom = -90;
  key.shadow.bias = -0.0012;
  key.shadow.radius = 7;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfe6ff, 2.1);
  rim.position.set(72, -30, -86);
  scene.add(rim);
  const spark = new THREE.PointLight(laserCol.clone(), 0, 90, 2);
  scene.add(spark);
  const fill = new THREE.PointLight(0xa8d8ff, 0.7, 400, 2);
  fill.position.set(40, 20, 120);
  scene.add(fill);

  // contact shadow catcher
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.ShadowMaterial({ opacity: 0.16 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -46;
  floor.receiveShadow = true;
  scene.add(floor);

  // caustic pool — the bright focus inside the shadow that says "glass"
  const caustic = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 26),
    new THREE.MeshBasicMaterial({
      map: radialTex(128, [[0, 'rgba(255,255,255,0.95)'], [0.4, 'rgba(226,244,248,0.4)'], [1, 'rgba(255,255,255,0)']]),
      transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  caustic.rotation.x = -Math.PI / 2;
  caustic.position.set(4, -45.4, 2);
  scene.add(caustic);

  const grid = new THREE.GridHelper(520, 26);
  grid.position.y = -45.6;
  grid.material.vertexColors = false;
  grid.material.transparent = true;
  grid.material.opacity = 0.22;
  scene.add(grid);
  const GRID_LIGHT = new THREE.Color(0x9FB2BC);
  const GRID_DIM = new THREE.Color(0x39474F);

  // ------------------------------------------------------------- the glass
  const RX = 31, RY = 25.5, THICK = 2.9;
  const outline = superPts(96, RX, RY, 2.6);
  const lensBuilt = makeLensGeo(outline, THICK, 214, 218, lowQ ? 11 : 18);
  const lensGeo = lensBuilt.geo;

  const lensMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.02,
    transmission: 0.96, thickness: 4.2, ior: 1.53,
    clearcoat: 1, clearcoatRoughness: 0.02,
    attenuationColor: tintCol.clone(), attenuationDistance: 42,
    envMapIntensity: 1.1, transparent: true, opacity: 1,
    side: THREE.DoubleSide,
  });
  const lens = new THREE.Mesh(lensGeo, lensMat);
  lens.castShadow = true;
  scene.add(lens);

  // edge glow ring — traces the outline during cutting, reads as polished bevel later
  const ringPts = [], ringFlat = [], ringCurved = [];
  for (let i = 0; i <= outline.length; i++) {
    const q = outline[i % outline.length];
    const r = Math.sqrt(q.x * q.x + q.y * q.y);
    const sagF = 214 - Math.sqrt(Math.max(0, 214 * 214 - r * r));
    ringFlat.push(THICK / 2 + 0.05);
    ringCurved.push(THICK / 2 - sagF + 0.05);
    ringPts.push(new THREE.Vector3(q.x, q.y, THICK / 2 + 0.05));
  }
  const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
  const ringMat = new THREE.LineBasicMaterial({ color: laserCol.clone(), transparent: true, opacity: 0 });
  const cutRing = new THREE.Line(ringGeo, ringMat);
  scene.add(cutRing);

  // ------------------------------------------------------------- raw blank
  const blankOutline = superPts(72, 34, 34, 2);
  const blankBuilt = makeLensGeo(blankOutline, 15, 0, 0, 10);
  const blankMat = new THREE.MeshPhysicalMaterial({
    color: 0xF2F7F8, metalness: 0, roughness: 0.13,
    transmission: 0.88, thickness: 14, ior: 1.52,
    clearcoat: 1, clearcoatRoughness: 0.05,
    attenuationColor: new THREE.Color('#C2E0DA'), attenuationDistance: 30,
    specularIntensity: 1.1, envMapIntensity: 1.6, transparent: true, opacity: 1,
    side: THREE.DoubleSide,
  });
  const blank = new THREE.Mesh(blankBuilt.geo, blankMat);
  blank.castShadow = true;
  scene.add(blank);

  // debris shed when the lens is cut free of the blank
  const debCount = 54;
  const debPos = new Float32Array(debCount * 3), debVel = [];
  for (let i = 0; i < debCount; i++) {
    const a = Math.random() * TAU, r = 28 + Math.random() * 8;
    debPos[i * 3] = Math.cos(a) * r; debPos[i * 3 + 1] = Math.sin(a) * r; debPos[i * 3 + 2] = (Math.random() - 0.5) * 12;
    debVel.push(new THREE.Vector3(Math.cos(a) * (0.4 + Math.random() * 0.8), -0.5 - Math.random(), (Math.random() - 0.5) * 0.6));
  }
  const debGeo = new THREE.BufferGeometry();
  debGeo.setAttribute('position', new THREE.Float32BufferAttribute(debPos, 3));
  const debMat = new THREE.PointsMaterial({ size: 1.15, map: sparkTex(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xcfeef2 });
  const debris = new THREE.Points(debGeo, debMat);
  scene.add(debris);

  // sparks at the cutting point
  const spCount = 34;
  const spGeo = new THREE.BufferGeometry();
  spGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(spCount * 3), 3));
  const spMat = new THREE.PointsMaterial({ size: 1.7, map: sparkTex(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: laserCol.clone() });
  const sparks = new THREE.Points(spGeo, spMat);
  scene.add(sparks);

  // --------------------------------------------------------- laser cutting head
  const tool = new THREE.Group();
  const nozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 1.15, 10, 24),
    new THREE.MeshStandardMaterial({ color: 0x2b3238, metalness: 1, roughness: 0.3 })
  );
  nozzle.position.y = 96;
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(4.6, 4.6, 3.4, 24),
    new THREE.MeshStandardMaterial({ color: 0x5b666d, metalness: 1, roughness: 0.18 })
  );
  collar.position.y = 102.4;
  // wide soft shaft + bright inner cone + white filament, all running the full drop
  const haze = new THREE.Mesh(
    new THREE.CylinderGeometry(4.6, 1.3, 92, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: laserCol.clone(), transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  );
  haze.position.y = 46;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 0.45, 92, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: laserCol.clone(), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  );
  beam.position.y = 46;
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, 93, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  core.position.y = 46;
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sparkTex(), color: laserCol.clone(), transparent: true,
    opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  flare.scale.setScalar(6);
  tool.add(nozzle, collar, haze, beam, core, flare);
  tool.visible = false;
  scene.add(tool);
  const setBeam = (on) => { haze.visible = on; beam.visible = on; core.visible = on; flare.visible = on; nozzle.position.y = on ? 96 : 11; collar.position.y = on ? 102.4 : 17.4; };

  // polish pad
  const pad = new THREE.Mesh(
    new THREE.TorusGeometry(9, 1.5, 12, 48),
    new THREE.MeshStandardMaterial({ color: 0x6c777d, metalness: 1, roughness: 0.2, transparent: true })
  );
  const padGlow = new THREE.Mesh(
    new THREE.CircleGeometry(8.4, 44),
    new THREE.MeshBasicMaterial({ color: laserCol.clone(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  pad.add(padGlow);
  pad.visible = false;
  pad.castShadow = true;
  scene.add(pad);

  // --------------------------------------------------------- diamond indenter (09)
  // A precision hardness-tester head: brushed-steel shaft, machined chuck with a
  // fine accent ring, and a brilliant-cut diamond that actually refracts.
  const stylus = new THREE.Group();
  const styArm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.82, 22, 28),
    new THREE.MeshStandardMaterial({ color: 0xB8C2C9, metalness: 1, roughness: 0.26, envMapIntensity: 1.15, transparent: true })
  );
  styArm.position.y = 12.8;
  const styCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.35, 1.35, 1.7, 32),
    new THREE.MeshStandardMaterial({ color: 0xE6ECEF, metalness: 1, roughness: 0.12, envMapIntensity: 1.4, transparent: true })
  );
  styCollar.position.y = 2.5;
  const styChuck = new THREE.Mesh(
    new THREE.CylinderGeometry(1.28, 0.5, 3.0, 28),
    new THREE.MeshStandardMaterial({ color: 0x3A434A, metalness: 1, roughness: 0.32, envMapIntensity: 0.9, transparent: true })
  );
  styChuck.position.y = 0.9;
  const styRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.18, 0.12, 10, 32),
    new THREE.MeshStandardMaterial({ color: laserCol.clone(), metalness: 0.4, roughness: 0.3, emissive: laserCol.clone(), emissiveIntensity: 0.5, transparent: true })
  );
  styRing.rotation.x = Math.PI / 2;
  styRing.position.y = 1.9;
  const styTip = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.82, 0),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff, metalness: 0, roughness: 0,
      transmission: 0.96, ior: 2.42, thickness: 1.1,
      clearcoat: 1, clearcoatRoughness: 0,
      iridescence: 1, iridescenceIOR: 2.0,
      specularIntensity: 1, envMapIntensity: 3.0, transparent: true,
    })
  );
  styTip.scale.set(0.8, 1.5, 0.8);
  styTip.position.y = -0.9;
  const stySpark = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sparkTex(), color: 0xffffff, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
  }));
  stySpark.scale.setScalar(4);
  stySpark.position.y = -1.9;
  stylus.add(styArm, styCollar, styChuck, styRing, styTip, stySpark);
  stylus.visible = false;
  stylus.scale.setScalar(0.62);
  scene.add(stylus);
  const styMats = [styArm.material, styCollar.material, styChuck.material, styRing.material, styTip.material];

  // the track the stylus walks — it stays clean, which is the whole claim
  const trackGeo = new THREE.BufferGeometry();
  const TRACK_N = 48, trackArr = new Float32Array(TRACK_N * 3);
  for (let i = 0; i < TRACK_N; i++) {
    const t = i / (TRACK_N - 1);
    const x = lerp(-19, 21, t), y = lerp(8, -6, t);
    const r = Math.sqrt(x * x + y * y);
    trackArr[i * 3] = x; trackArr[i * 3 + 1] = y;
    trackArr[i * 3 + 2] = THICK / 2 - (214 - Math.sqrt(Math.max(0, 214 * 214 - r * r))) + 0.25;
  }
  trackGeo.setAttribute('position', new THREE.Float32BufferAttribute(trackArr, 3));
  const trackMat = new THREE.LineDashedMaterial({
    color: laserCol.clone(), transparent: true, opacity: 0,
    dashSize: 1.6, gapSize: 1.6, depthTest: false,
  });
  const track = new THREE.Line(trackGeo, trackMat);
  track.computeLineDistances();
  track.renderOrder = 4;
  scene.add(track);

  // ------------------------------------------------------------- coating stack
  const LAYERS = [
    { name: 'UV Protection', col: '#7A5CFF' },
    { name: 'Polarized Film', col: '#1F7A6B' },
    { name: 'Blue-Light Filter', col: '#E8A33B' },
    { name: 'Scratch-Resistant', col: '#6E8290' },
    { name: 'Hydrophobic', col: '#6FD6E8' },
    { name: 'Anti-Reflective', col: '#B45CD6' },
    { name: 'Base Glass', col: '#5E6E77' },
  ];
  const layerGroup = new THREE.Group();
  scene.add(layerGroup);
  const layers = LAYERS.map((L, i) => {
    const built = makeLensGeo(outline, i === 6 ? 2.2 : 0.5, 214, 218, lowQ ? 7 : 12);
    const c = new THREE.Color(L.col);
    const mat = new THREE.MeshPhysicalMaterial({
      color: c, metalness: 0, roughness: 0.07,
      transmission: 0, thickness: 2, ior: 1.5,
      emissive: c.clone(), emissiveIntensity: 0.06,
      clearcoat: 1, clearcoatRoughness: 0.04,
      envMapIntensity: 0.95, transparent: true, opacity: 0,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const m = new THREE.Mesh(built.geo, mat);
    layerGroup.add(m);
    // hairline edge on each layer for legibility when exploded
    const eg = new THREE.BufferGeometry().setFromPoints(ringPts);
    const em = new THREE.LineBasicMaterial({ color: c.clone(), transparent: true, opacity: 0 });
    const el = new THREE.Line(eg, em);
    m.add(el);
    return { mesh: m, mat, edge: em, base: c };
  });

  // ------------------------------------------------------------- glare streaks
  const glare = new THREE.Group();
  const streak = streakTex();
  const glareItems = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 12),
      new THREE.MeshBasicMaterial({ map: streak, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffffff })
    );
    m.position.set((i - 1.5) * 6, (i - 1.5) * 13, 14 + i * 1.5);
    m.rotation.z = -0.22 + i * 0.05;
    glare.add(m); glareItems.push(m);
  }
  scene.add(glare);

  // ------------------------------------------------------------- spectrum rays
  const rayGroup = new THREE.Group();
  scene.add(rayGroup);
  // Cauchy dispersion for crown glass — short wavelengths refract harder, so the
  // transmitted rays fan out instead of all leaving on one line.
  const nOf = (nm) => 1.5046 + 4200 / (nm * nm);
  const RAY_BANDS = [
    { col: '#7B4BFF', y: 20, nm: 380, blocked: true, label: 'Mbrojtje sipas lentes' },
    { col: '#5B6BFF', y: 13, nm: 315, blocked: true, label: 'Trajtim sipas lentes' },
    { col: '#4BA8FF', y: 6, nm: 450, blocked: 0.6, label: 'Filtrim ilustrues' },
    { col: '#4BE0A8', y: -1, nm: 530, blocked: false, label: 'Spektri i dritës' },
    { col: '#FFD24B', y: -8, nm: 590, blocked: false, label: 'Spektri i dritës' },
    { col: '#FF6B4B', y: -15, nm: 660, blocked: false, label: 'Spektri i dritës' },
  ];
  RAY_BANDS.forEach((b) => { b.disp = (nOf(b.nm) - nOf(530)) * 520; });
  const rays = RAY_BANDS.map((b) => {
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-150, b.y, 0), new THREE.Vector3(0, b.y, 0), new THREE.Vector3(150, b.y * 0.86 - b.disp, 0),
    ]);
    const m = new THREE.LineBasicMaterial({ color: new THREE.Color(b.col), transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
    const l = new THREE.Line(g, m);
    rayGroup.add(l);
    return { line: l, mat: m, geo: g, band: b };
  });

  // ------------------------------------------------------------- water beads
  const beadGroup = new THREE.Group();
  scene.add(beadGroup);
  const beadMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0, metalness: 0,
    transmission: 1, thickness: 1.4, ior: 1.33,
    clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 2.4,
    transparent: true, opacity: 0,
  });
  const BEAD_N = lowQ ? 20 : 34;
  const beads = [];
  for (let i = 0; i < BEAD_N; i++) {
    const r = 0.55 + Math.random() * 1.7;
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), beadMat);
    const a = Math.random() * TAU, rr = Math.sqrt(Math.random()) * 0.82;
    const x = Math.cos(a) * rr * RX * 0.94, y = Math.sin(a) * rr * RY * 0.94;
    const rad = Math.sqrt(x * x + y * y);
    const z = THICK / 2 - (214 - Math.sqrt(Math.max(0, 214 * 214 - rad * rad)));
    m.position.set(x, y, z + r * 0.5);
    m.userData = { home: new THREE.Vector3(x, y, z), r, delay: Math.random(), drift: (Math.random() - 0.5) };
    beadGroup.add(m); beads.push(m);
  }

  // ------------------------------------------------------------- photochromic sun (08)
  // The lens darkens because light strikes it — so show the light: a warm sun
  // glow, a soft shaft onto the glass, UV motes, and a warm key that all rise
  // and fall with the tint through full-sun → overcast → full-sun.
  const sunGroup = new THREE.Group();
  scene.add(sunGroup);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTex(128, [[0, 'rgba(255,244,214,1)'], [0.28, 'rgba(255,214,140,0.9)'], [1, 'rgba(255,190,110,0)']]),
    transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
  }));
  sunSprite.scale.setScalar(70);
  sunSprite.position.set(6, 62, 30);
  sunGroup.add(sunSprite);
  const sunShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 34, 78, 28, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffdca6, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  );
  sunShaft.position.set(3, 34, 16);
  sunShaft.rotation.x = 0.12;
  sunGroup.add(sunShaft);
  const sunLight = new THREE.PointLight(0xffe0b0, 0, 260, 2);
  sunLight.position.set(8, 60, 40);
  sunGroup.add(sunLight);
  const moteN = lowQ ? 40 : 80;
  const motePos = new Float32Array(moteN * 3), moteSeed = [];
  for (let i = 0; i < moteN; i++) {
    motePos[i * 3] = (Math.random() - 0.5) * 66;
    motePos[i * 3 + 1] = Math.random() * 70;
    motePos[i * 3 + 2] = (Math.random() - 0.5) * 30 + 10;
    moteSeed.push(Math.random());
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.Float32BufferAttribute(motePos, 3));
  const moteMat = new THREE.PointsMaterial({ size: 1.1, map: sparkTex(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffe6bf });
  const motes = new THREE.Points(moteGeo, moteMat);
  sunGroup.add(motes);
  sunGroup.visible = false;

  // ------------------------------------------------------------- wavefront scan
  const scanGroup = new THREE.Group();
  scene.add(scanGroup);
  // interferogram sits ON the lens: a lens-shaped sheet displaced to the front curve
  const igShape = new THREE.Shape(outline);
  const igGeo = new THREE.ShapeGeometry(igShape, 24);
  {
    const pa = igGeo.attributes.position, uv = [];
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i);
      const r = Math.sqrt(x * x + y * y);
      pa.setZ(i, THICK / 2 - (214 - Math.sqrt(Math.max(0, 214 * 214 - r * r))) + 0.12);
      uv.push(x / (RX * 2) + 0.5, y / (RY * 2) + 0.5);
    }
    igGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    pa.needsUpdate = true;
  }
  const igMat = new THREE.MeshBasicMaterial({
    map: interferogramTex(lowQ ? 256 : 512), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    side: THREE.DoubleSide,
  });
  const interferogram = new THREE.Mesh(igGeo, igMat);
  interferogram.renderOrder = 4;
  scanGroup.add(interferogram);

  // acquisition sweep: a thin bright line plus a soft leading glow, lens-width only
  // the sweep is drawn INTO the lens silhouette: same shape, scrolling gradient
  const sweepMap = sweepTex();
  sweepMap.wrapT = THREE.ClampToEdgeWrapping;
  const sweepGeo = igGeo.clone();
  {
    const pa = sweepGeo.attributes.position;
    for (let i = 0; i < pa.count; i++) pa.setZ(i, pa.getZ(i) + 1.3);
    pa.needsUpdate = true;
  }
  const sweepMat = new THREE.MeshBasicMaterial({
    map: sweepMap, color: laserCol.clone(), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    side: THREE.DoubleSide,
  });
  const scanGlow = new THREE.Mesh(sweepGeo, sweepMat);
  scanGlow.renderOrder = 5;
  scanGroup.add(scanGlow);

  // ------------------------------------------------------------- engraving
  const engMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, color: 0xffffff });
  engMat.map = engravingTex(brand);
  const engraving = new THREE.Mesh(new THREE.PlaneGeometry(19, 2.4), engMat);
  engraving.position.set(RX * 0.42, -RY * 0.66, THICK / 2 - 0.9);
  engraving.rotation.z = -0.06;
  engraving.renderOrder = 2;
  scene.add(engraving);

  // ------------------------------------------------------------- caliper
  const calGroup = new THREE.Group();
  const calMat = new THREE.LineBasicMaterial({ color: laserCol.clone(), transparent: true, opacity: 0 });
  const mkLine = (a, b) => new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), calMat);
  calGroup.renderOrder = 3;
  calGroup.add(mkLine(new THREE.Vector3(RX + 4, THICK / 2, 0), new THREE.Vector3(RX + 14, THICK / 2, 0)));
  calGroup.add(mkLine(new THREE.Vector3(RX + 4, -THICK / 2, 0), new THREE.Vector3(RX + 14, -THICK / 2, 0)));
  calGroup.add(mkLine(new THREE.Vector3(RX + 9, THICK / 2, 0), new THREE.Vector3(RX + 9, -THICK / 2, 0)));
  scene.add(calGroup);

  // ------------------------------------------------------------- camera path
  // [p, x, y, z, tx, ty, tz, fov]
  const KF = [
    [0.000, 0, 4, 210, 0, 0, 0, 32],
    [s2a, -20, 2, 182, 0, 0, 0, 30],
    [s3a, -52, 12, 168, 0, 0, 0, 28],
    [s4a, 26, -8, 152, 0, 0, 0, 30],
    [s5a, 0, 5, 206, 0, 0, 0, 30],
    [s5a + (s5b - s5a) * 0.45, 78, 20, 190, 0, 0, 0, 28],
    [s5b, 0, 0, 160, 0, 0, 0, 30],
    [s6a, 0, 0, 148, 0, 0, 0, 32],
    [s7a, -150, 16, 120, 0, 0, 0, 30],
    [s8a, 0, 0, 140, 0, 0, 0, 32],
    [s9a, 16, -9, 196, 2, -3, 0, 28],
    [s10a, 50, 2, 104, 20, -5, 0, 24],
    [s11a, 0, 0, 168, 0, 0, 0, 30],
    [s12a, 0, 3, 164, 0, 0, 0, 31],
    [1.001, 0, 3, 160, 0, 0, 0, 31],
  ];
  const _cp = new THREE.Vector3(), _ct = new THREE.Vector3();
  const DESIGN_ASPECT = 1.7;
  // On narrow/portrait viewports a fixed vertical fov crops the lens sideways.
  // Widen the vertical fov so the HORIZONTAL field matches the desktop design.
  function adjustFov(baseDeg) {
    const a = camera.aspect || DESIGN_ASPECT;
    const mult = Math.min(2.4, Math.max(1, DESIGN_ASPECT / a));
    if (mult === 1) return baseDeg;
    const t = Math.tan((baseDeg * Math.PI / 180) / 2) * mult;
    return (2 * Math.atan(t)) * 180 / Math.PI;
  }
  function camAt(p) {
    let i = 0;
    while (i < KF.length - 2 && p >= KF[i + 1][0]) i++;
    const A = KF[i], B = KF[i + 1];
    const t = smooth(clamp((p - A[0]) / Math.max(1e-6, B[0] - A[0]), 0, 1));
    _cp.set(lerp(A[1], B[1], t), lerp(A[2], B[2], t), lerp(A[3], B[3], t));
    _ct.set(lerp(A[4], B[4], t), lerp(A[5], B[5], t), lerp(A[6], B[6], t));
    return lerp(A[7], B[7], t);
  }

  // ------------------------------------------------------------- anchors
  const anchorPts = {
    layer0: new THREE.Vector3(), layer1: new THREE.Vector3(), layer2: new THREE.Vector3(),
    layer3: new THREE.Vector3(), layer4: new THREE.Vector3(), layer5: new THREE.Vector3(),
    layer6: new THREE.Vector3(),
    edgeA: new THREE.Vector3(RX, 0, 0),
    edgeB: new THREE.Vector3(RX * 0.72, -RY * 0.6, THICK / 2),
    edgeC: new THREE.Vector3(RX * 0.42, -RY * 0.66, THICK / 2),
    scanA: new THREE.Vector3(0, RY * 0.5, THICK / 2),
    scanB: new THREE.Vector3(-RX * 0.55, -RY * 0.3, 0),
    scanC: new THREE.Vector3(RX * 0.5, -RY * 0.45, -THICK / 2),
  };
  const anchors = {};
  Object.keys(anchorPts).forEach((k) => { anchors[k] = { x: 0, y: 0 }; });
  const _pv = new THREE.Vector3();
  let vw = 1, vh = 1;
  function projectAnchors() {
    Object.keys(anchorPts).forEach((k) => {
      _pv.copy(anchorPts[k]);
      if (k.startsWith('layer')) {
        const m = layers[+k.slice(5)].mesh;
        _pv.set(0, RY * 0.42, 0); m.localToWorld(_pv);
      } else {
        lens.localToWorld(_pv);
      }
      _pv.project(camera);
      anchors[k].x = (_pv.x * 0.5 + 0.5) * vw;
      anchors[k].y = (-_pv.y * 0.5 + 0.5) * vh;
    });
  }

  // ------------------------------------------------------------- morph helper
  const lensPos = lensGeo.attributes.position;
  let lastCurve = 1;
  const ringPosAttr = ringGeo.attributes.position;
  function setCurve(t) {
    if (Math.abs(t - lastCurve) < 0.002) return;
    lastCurve = t;
    const a = lensBuilt.flat, b = lensBuilt.curved, arr = lensPos.array;
    for (let i = 0; i < arr.length; i++) arr[i] = a[i] + (b[i] - a[i]) * t;
    lensPos.needsUpdate = true;
    lensGeo.computeVertexNormals();
    const rp = ringPosAttr.array;
    for (let i = 0; i < ringFlat.length; i++) {
      const z = ringFlat[i] + (ringCurved[i] - ringFlat[i]) * t;
      rp[i * 3 + 2] = z;
      ringPts[i].z = z;
    }
    ringPosAttr.needsUpdate = true;
  }

  // ------------------------------------------------------------- frame
  let time = 0;
  let highlight = -1;
  const WHITE = new THREE.Color(0xffffff);
  const FROST = new THREE.Color(0x9DA8AE);
  const _baseCol = new THREE.Color();
  const _q = new THREE.Quaternion();

  function frame(p, dt) {
    if (!reduced) time += dt;

    // ---------- background / mood ----------
    // dark studio for polarization + spectrum, and again for the wavefront scan
    // lights drop only for the three stages whose subject is light itself:
    // the cutting beam, the spectrum rays, the interferometry fringes.
    const dim = clamp(
      trap(p, s2a - 0.014, s2a + 0.012, s2b - 0.022, s2b + 0.006) +
      trap(p, s6a - 0.016, s6a + 0.018, s6b - 0.02, s6b + 0.012) +
      trap(p, s7a - 0.02, s7a + 0.02, s7b - 0.022, s7b + 0.014) +
      trap(p, s11a - 0.02, s11a + 0.016, s11b - 0.022, s11b + 0.01), 0, 1);
    scene.background.copy(BG_BASE).lerp(BG_DIM, dim);
    scene.fog.color.copy(scene.background);
    hemi.intensity = lerp(0.68, 0.2, dim);
    key.intensity = lerp(1.6, 1.05, dim);
    rim.intensity = lerp(1.1, 2.2, dim);
    floor.material.opacity = lerp(0.26, 0.05, dim);
    caustic.material.opacity = lerp(0.5, 0.03, dim) * (0.92 + Math.sin(time * 1.3) * 0.08);
    grid.material.color.copy(GRID_LIGHT).lerp(GRID_DIM, dim);
    grid.material.opacity = lerp(0.22, 0.26, dim);
    const bgLum = lerp(0.9, 0.1, dim);

    // ---------- camera ----------
    camera.fov = adjustFov(camAt(p));
    // gentle hero orbit through the last two stages
    const orbit = seg(p, s11b, 1.0);
    if (orbit > 0) {
      const a = orbit * 0.72 - 0.3;
      const rad = Math.hypot(_cp.x, _cp.z);
      _cp.x = Math.sin(a) * rad; _cp.z = Math.cos(a) * rad;
      _cp.y += Math.sin(orbit * Math.PI) * 6;
    }
    camera.position.lerp(_cp, 1 - Math.exp(-dt * 7));
    camera.lookAt(_ct);
    camera.updateProjectionMatrix();

    // ---------- 01 raw crystal ----------
    const blankVis = 1 - smooth(seg(p, s2a + (s2b - s2a) * 0.5, s2a + (s2b - s2a) * 0.88));
    blank.visible = blankVis > 0.01;
    blankMat.opacity = blankVis;
    blank.rotation.y = Math.sin(p * 9) * 0.5 + p * 3.2;
    blank.rotation.x = 0.16 + Math.sin(time * 0.3) * 0.03;
    blank.scale.setScalar(lerp(1, 0.9, smooth(seg(p, s2a, s2b))));
    blankMat.roughness = lerp(0.42, 0.3, smooth(seg(p, s1a, s2a)));

    // ---------- 02 diamond cutting ----------
    const cut = seg(p, s2a, s2a + (s2b - s2a) * 0.72);
    const cutting = trap(p, s2a - 0.004, s2a + 0.008, s2b - 0.03, s2b);
    const total = ringPts.length;
    ringGeo.setDrawRange(0, Math.max(2, Math.floor(cut * total)));
    ringMat.opacity = clamp(cutting * 0.7 + trap(p, s10a, s10a + 0.012, s10b - 0.012, s10b) * 0.32, 0, 1);

    // tool rides the cut point
    const cutIdx = Math.min(total - 1, Math.floor(cut * (total - 1)));
    const cpt = ringPts[cutIdx];
    tool.visible = cutting > 0.02;
    if (tool.visible) {
      setBeam(true);
      tool.position.set(cpt.x, cpt.y, cpt.z + 2.4);
      tool.rotation.set(0, 0, Math.atan2(cpt.x, -cpt.y) * 0.4);
      tool.scale.setScalar(lerp(0.6, 1, cutting));
      haze.material.opacity = cutting * (0.11 + 0.05 * Math.sin(time * 17));
      beam.material.opacity = cutting * (0.44 + 0.16 * Math.sin(time * 46));
      core.material.opacity = cutting * (0.7 + 0.16 * Math.sin(time * 61));
      flare.material.opacity = cutting * 0.62;
      flare.scale.setScalar(5.2 + Math.sin(time * 33) * 1.4);
      spark.position.set(cpt.x, cpt.y, cpt.z + 1.2);
      spark.intensity = cutting * (4 + Math.sin(time * 40) * 1.2);
    } else spark.intensity = 0;

    // sparks spray from the cut point
    spMat.opacity = cutting * 0.5;
    if (cutting > 0.02) {
      const sp = spGeo.attributes.position.array;
      for (let i = 0; i < spCount; i++) {
        const ph = (time * 1.6 + i * 0.137) % 1;
        const a = i * 2.399;
        sp[i * 3] = cpt.x + Math.cos(a) * ph * 9;
        sp[i * 3 + 1] = cpt.y + Math.sin(a) * ph * 9 - ph * ph * 6;
        sp[i * 3 + 2] = cpt.z + Math.sin(a * 3) * ph * 4.5 + 2;
      }
      spGeo.attributes.position.needsUpdate = true;
    }

    // debris falls away as the lens breaks free
    const shed = clamp(seg(p, s2a + (s2b - s2a) * 0.6, s2b + 0.02), 0, 1);
    debMat.opacity = trap(p, s2a + (s2b - s2a) * 0.58, s2a + (s2b - s2a) * 0.7, s2b, s2b + 0.03) * 0.55;
    if (debMat.opacity > 0.01) {
      const dp = debGeo.attributes.position.array;
      for (let i = 0; i < debCount; i++) {
        const v = debVel[i], k = shed * 30;
        dp[i * 3] = debPos[i * 3] + v.x * k;
        dp[i * 3 + 1] = debPos[i * 3 + 1] + v.y * k - 0.02 * k * k * 0.4;
        dp[i * 3 + 2] = debPos[i * 3 + 2] + v.z * k;
      }
      debGeo.attributes.position.needsUpdate = true;
    }

    // ---------- 03 curve generation ----------
    setCurve(smooth(seg(p, s3a, s3b - (s3b - s3a) * 0.12)));

    // ---------- 04 optical polish ----------
    const polishing = trap(p, s4a - 0.004, s4a + 0.01, s4b - 0.014, s4b);
    pad.visible = polishing > 0.02;
    if (pad.visible) {
      const sw = seg(p, s4a, s4b);
      const ang = sw * TAU * 1.35;
      const rr = lerp(20, 4, sw);
      pad.position.set(Math.cos(ang) * rr, Math.sin(ang) * rr * 0.8, THICK / 2 + 3.4);
      pad.rotation.z = time * 22;
      pad.scale.setScalar(lerp(0.7, 1, polishing));
      pad.material.opacity = polishing;
      padGlow.material.opacity = polishing * 0.5;
    }
    // roughness falls as polishing completes
    const clarity = smooth(seg(p, s4a, s4b));
    lensMat.roughness = lerp(0.34, 0.035, clarity);
    lensMat.transmission = lerp(0.55, 0.96, clarity);
    lensMat.clearcoatRoughness = lerp(0.4, 0.09, clarity);
    // albedo earns its clarity: frosted stone -> optically white
    _baseCol.copy(FROST).lerp(WHITE, clarity);

    // lens fades in as it separates from the blank
    const lensIn = smooth(seg(p, s2a + (s2b - s2a) * 0.4, s2b));
    lensMat.opacity = lensIn;
    lens.visible = lensIn > 0.01;

    // ---------- 05 coating stack ----------
    const stackIn = trap(p, s5a - 0.01, s5a + (s5b - s5a) * 0.16, s5b - (s5b - s5a) * 0.14, s5b + 0.004);
    const explode = smooth(seg(p, s5a, s5a + (s5b - s5a) * 0.42));
    const fuse = smooth(seg(p, s5a + (s5b - s5a) * 0.74, s5b));
    const open = clamp(explode - fuse, 0, 1);
    const spread = open * 11.5;
    layers.forEach((L, i) => {
      const off = (i - 3) * spread;
      L.mesh.position.z = off;
      L.mesh.visible = stackIn > 0.01;
      const ord = 6 - i;
      const rise = clamp(seg(p, s5a + ord * 0.008, s5a + 0.05 + ord * 0.008), 0, 1);
      const on = stackIn * rise;
      L.mat.opacity = on * (i === 6 ? 0.96 : 0.85) * (highlight === -1 || highlight === i ? 1 : 0.28);
      L.edge.opacity = on * (highlight === i ? 1 : 0.5);
      L.mat.emissiveIntensity = 0.06 + (highlight === i ? 0.5 : 0) + pulse(p, s5a + 0.05 + ord * 0.008, 90) * 0.35;
      L.mesh.position.x = highlight === i ? 3 : 0;
      L.mesh.rotation.y = open * 0.24 * (i % 2 ? 1 : -1) * 0.4;
    });
    // hero lens steps aside while the stack is on show
    const baseShown = layers[6].mat.opacity;
    if (baseShown > 0.01) {
      lensMat.opacity = lensIn * (1 - clamp(baseShown / 0.9, 0, 1) * 0.94);
      lens.visible = lensMat.opacity > 0.02;
    }

    // ---------- 06 polarization ----------
    const glareOn = trap(p, s6a - 0.006, s6a + 0.016, s6b - 0.03, s6b);
    const kill = smooth(seg(p, s6a + (s6b - s6a) * 0.38, s6b - (s6b - s6a) * 0.08));
    glare.visible = glareOn > 0.01;
    glareItems.forEach((m, i) => {
      const own = clamp(kill * 4 - i, 0, 1);          // streaks blink out one by one
      m.material.opacity = glareOn * 0.6 * (1 - own);
      m.rotation.z = lerp(-0.22 + i * 0.05, 0, kill);
      m.scale.x = lerp(1, 0.4, own);
    });
    // the glass itself darkens slightly as the polarizer axis engages
    const atten = lerp(42, 26, kill * glareOn);
    lensMat.attenuationDistance = atten;

    // ---------- 07 UV & spectrum ----------
    const rayOn = trap(p, s7a - 0.006, s7a + 0.018, s7b - 0.026, s7b);
    rayGroup.visible = rayOn > 0.01;
    rays.forEach((r, i) => {
      const app = clamp(seg(p, s7a + i * 0.008, s7a + 0.05 + i * 0.008), 0, 1);
      r.mat.opacity = rayOn * app * 0.9;
      const b = r.band;
      const stop = b.blocked === true ? 1 : (b.blocked ? 0.62 : 0);
      const block = stop * smooth(seg(p, s7a + 0.03, s7b - 0.04));
      const pos = r.geo.attributes.position.array;
      // outgoing segment shortens to zero for blocked bands
      pos[6] = lerp(150, 2, block);
      pos[7] = lerp(b.y * 0.86 - b.disp, b.y, block);
      r.geo.attributes.position.needsUpdate = true;
      r.line.position.z = Math.sin(time * 1.2 + i) * 0.4;
    });

    // ---------- 08 photochromic tint ----------
    const tintOn = trap(p, s8a - 0.006, s8a + 0.02, s8b - 0.02, s8b);
    const cyc = seg(p, s8a, s8b);
    // full sun → overcast → full sun; the glass darkens with the light, not on its own
    const sunRaw = cyc < 0.5
      ? 1 - Math.pow(clamp(cyc / 0.5, 0, 1), 2.4)
      : Math.pow(clamp((cyc - 0.5) / 0.5, 0, 1), 0.32);
    const sun = tintOn * sunRaw;
    const density = sun;
    lensMat.color.copy(_baseCol).lerp(tintCol, density * 0.6);
    lensMat.attenuationDistance = lerp(atten, lerp(52, 11, density), tintOn);
    lensMat.thickness = lerp(4.2, 8, density);
    sunGroup.visible = tintOn > 0.01;
    if (sunGroup.visible) {
      sunSprite.material.opacity = sun * 0.95;
      sunSprite.scale.setScalar(62 + sun * 20 + Math.sin(time * 1.6) * 2);
      sunShaft.material.opacity = sun * 0.26;
      sunLight.intensity = sun * 3.4;
      moteMat.opacity = sun * 0.8;
      const mp = moteGeo.attributes.position.array;
      for (let i = 0; i < moteN; i++) {
        let my = motePos[i * 3 + 1] - ((time * (7 + moteSeed[i] * 6)) % 78);
        if (my < -8) my += 78;
        mp[i * 3 + 1] = my;
        mp[i * 3] = motePos[i * 3] + Math.sin(time * 0.8 + moteSeed[i] * 9) * 2;
      }
      moteGeo.attributes.position.needsUpdate = true;
    }

    // ---------- 09 hardness & repellency ----------
    const hardOn = trap(p, s9a - 0.006, s9a + 0.02, s9b - 0.02, s9b);
    const scratch = seg(p, s9a + (s9b - s9a) * 0.08, s9a + (s9b - s9a) * 0.5);
    const scr = smooth(scratch);                          // eased travel across the glass
    const styOn = hardOn * (scratch < 1 ? 1 : 0);
    stylus.visible = styOn > 0.02;
    if (stylus.visible) {
      const sx = lerp(-19, 21, scr), sy = lerp(8, -6, scr);
      const sr = Math.sqrt(sx * sx + sy * sy);
      const sz = THICK / 2 - (214 - Math.sqrt(Math.max(0, 214 * 214 - sr * sr)));
      const contact = Math.sin(clamp(scratch, 0, 1) * Math.PI);   // seats mid-pass, lifts at the ends
      const entrance = smooth(clamp(styOn, 0, 1));                // descends in, retracts out
      stylus.position.set(sx, sy, sz + lerp(3.2, 1.4, contact) + (1 - entrance) * 7);
      stylus.rotation.set(0.24 - contact * 0.06, 0, 0.3);
      styTip.rotation.y = time * 0.9;
      styMats.forEach((m) => { m.opacity = styOn; });
      styRing.material.emissiveIntensity = 0.5 * styOn;
      stySpark.material.opacity = contact * styOn * 0.9;
      stySpark.scale.setScalar(3.2 + contact * 2.4 + Math.sin(time * 30) * 0.5);
      spark.position.set(sx, sy, sz + 0.5);
      spark.intensity = 2.6 * contact * hardOn;
    }
    // track draws in behind the stylus, then fades — no mark left
    track.visible = hardOn > 0.02;
    trackGeo.setDrawRange(0, Math.max(2, Math.floor(clamp(scr, 0, 1) * TRACK_N)));
    trackMat.opacity = hardOn * 0.5 * (1 - smooth(clamp(seg(p, s9a + (s9b - s9a) * 0.5, s9a + (s9b - s9a) * 0.72), 0, 1)));
    // water beads: wetting film → bead up (hydrophobic) → roll off, leaving it dry
    const wet = trap(p, s9a + (s9b - s9a) * 0.40, s9a + (s9b - s9a) * 0.56, s9a + (s9b - s9a) * 0.80, s9b + 0.01);
    beadGroup.visible = wet > 0.01;
    beadMat.opacity = wet;
    const beadUp = smooth(seg(p, s9a + (s9b - s9a) * 0.42, s9a + (s9b - s9a) * 0.62));
    const roll = smooth(seg(p, s9a + (s9b - s9a) * 0.70, s9b));
    beads.forEach((b) => {
      const d = b.userData;
      const local = clamp((roll - d.delay * 0.5) / (1 - d.delay * 0.5 + 1e-3), 0, 1);
      const fall = local * local * (34 + d.delay * 26);
      b.position.set(
        d.home.x + Math.sin(local * 7 + d.delay * 9) * local * 3.2 + d.drift * local * 4,
        d.home.y - fall,
        d.home.z + d.r * 0.5
      );
      const round = lerp(0.42, 1, beadUp) * lerp(1, 0.3, local);
      const flat = lerp(1.7, 1, beadUp) * lerp(1, 0.3, local);
      b.scale.set(d.r * flat, d.r * flat, d.r * round);
      b.visible = local < 0.98;
    });

    // ---------- 10 edge bevel ----------
    const bevelOn = trap(p, s10a - 0.006, s10a + 0.018, s10b - 0.018, s10b);
    calMat.opacity = bevelOn * 0.8;
    calGroup.visible = bevelOn > 0.01;
    engMat.opacity = clamp(bevelOn * 0.9 + trap(p, s12a, s12a + 0.02, 1.0, 1.01) * 0.5, 0, 1);

    // ---------- 11 wavefront scan ----------
    const scanOn = trap(p, s11a - 0.006, s11a + 0.018, s11b - 0.02, s11b);
    scanGroup.visible = scanOn > 0.01;
    // the sweep runs top to bottom once, and the fringe map builds in behind it
    const sweep = clamp(seg(p, s11a + 0.006, s11a + (s11b - s11a) * 0.62), 0, 1);
    const running = scanOn * (sweep < 1 ? 1 : 1 - smooth(seg(p, s11a + (s11b - s11a) * 0.62, s11b)));
    // uv space runs 0..1 bottom-to-top over the aperture; walk the band down it
    sweepMap.offset.y = lerp(-0.5, 0.5, 1 - sweep);
    sweepMat.opacity = running * 0.85;
    igMat.opacity = scanOn * smooth(sweep) * 0.9;
    // glass reads as inspection-clear during the scan
    lensMat.envMapIntensity = lerp(0.45, lerp(1.25, 1.8, scanOn), clarity);

    // ---------- 12 clarity / hero ----------
    const hero = smooth(seg(p, s12a, s12a + 0.05));
    lens.rotation.y = Math.sin(time * 0.22) * 0.16 * hero;
    lens.rotation.x = (Math.sin(time * 0.17) * 0.07 + 0.04) * hero;
    lens.position.y = Math.sin(time * 0.5) * 0.7 * hero;
    if (hero > 0.4) { lensMat.opacity = 1; lens.visible = true; }

    // ---------- resolve ----------
    camera.updateMatrixWorld();
    lens.updateMatrixWorld();
    layerGroup.updateMatrixWorld(true);
    projectAnchors();
    render();
    return { bgLum };
  }

  // ------------------------------------------------------------- post
  let composer = null, bloom = null;
  if (!lowQ && !balanced) Promise.all([
    import('three/addons/postprocessing/EffectComposer.js'),
    import('three/addons/postprocessing/RenderPass.js'),
    import('three/addons/postprocessing/UnrealBloomPass.js'),
  ]).then(([EC, RP, UB]) => {
    composer = new EC.EffectComposer(renderer);
    composer.addPass(new RP.RenderPass(scene, camera));
    bloom = new UB.UnrealBloomPass(new THREE.Vector2(vw, vh), 0.24, 0.72, 0.995);
    composer.addPass(bloom);
    composer.setSize(vw, vh);
    bloom.enabled = !lowQ;
  }).catch(() => {});

  function render() { if (composer) composer.render(); else renderer.render(scene, camera); }

  // ------------------------------------------------------------- api
  function resize() {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    if (w === vw && h === vh) return;
    vw = w; vh = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (composer) composer.setSize(w, h);
  }
  resize();

  return {
    frame, resize,
    prepare: async () => {
      // Compile the future stages while the lightweight opening shell is on
      // screen. Otherwise each new material can block the first swipe through
      // its stage. compileAsync uses parallel driver compilation when supported.
      const visibility = [];
      scene.traverse((object) => {
        visibility.push([object, object.visible]);
        object.visible = true;
      });
      try { await renderer.compileAsync(scene, camera); }
      finally { visibility.forEach(([object, visible]) => { object.visible = visible; }); }
    },
    setQuality: (low) => {
      lowQ = !!low;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowQ ? 1 : (balanced ? 1.35 : 1.75)));
      renderer.shadowMap.enabled = !lowQ;
      if (bloom) bloom.enabled = !lowQ;
      vw = 0; vh = 0;
      resize();
    },
    isLowQuality: () => lowQ,
    setReducedMotion: (value) => { reduced = !!value; },
    getAnchors: () => anchors,
    highlightLayer: (i) => { highlight = i; },
    setBrand: (b) => {
      if (b === brand) return;
      brand = b;
      if (engMat.map) engMat.map.dispose();
      engMat.map = engravingTex(brand);
      engMat.needsUpdate = true;
    },
    setTint: (hex) => { tintCol.set(hex); lensMat.attenuationColor.set(hex); },
    setLaser: (hex) => {
      laserCol.set(hex);
      ringMat.color.set(hex); spMat.color.set(hex); calMat.color.set(hex);
      spark.color.set(hex);
      beam.material.color.set(hex); haze.material.color.set(hex); trackMat.color.set(hex);
      flare.material.color.set(hex); padGlow.material.color.set(hex);
      sweepMat.color.set(hex);
      styRing.material.color.set(hex); styRing.material.emissive.set(hex);
    },
    dispose: () => {
      disposed = true;
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.dispose();
      environmentTarget?.dispose();
      pmrem?.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) [].concat(o.material).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
      });
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    },
  };
}
