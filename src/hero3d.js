// ============================================================================
// hero3d.js — "Crafted Before Your Eyes" scroll-driven atelier scene
// Procedural sunglasses, manufactured live: blanks → laser cut → polish →
// optical layers → blueprint → frame → temples → details → orbit → x-ray →
// lens demo → environments → hero → handoff.
// All state derives from scroll progress p ∈ [0,1] (idempotent per frame).
// ============================================================================
import * as THREE from "three";

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const outCubic = (t) => 1 - Math.pow(1 - t, 3);
const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
function trap(p, a, b, c, d) {
  if (p <= a || p >= d) return 0;
  if (p < b) return smooth((p - a) / (b - a));
  if (p > c) return smooth(1 - (p - c) / (d - c));
  return 1;
}
const pulse = (p, at, sharp) => Math.exp(-Math.pow((p - at) * sharp, 2));

// ---------------------------------------------------------------- outlines
function superPts(n, rx, ry, e, opts = {}) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = Math.PI / 2 + (i / n) * TAU; // start at top, CCW
    const c = Math.cos(t), s = Math.sin(t);
    let x = rx * Math.sign(c) * Math.pow(Math.abs(c), 2 / e);
    let y = ry * Math.sign(s) * Math.pow(Math.abs(s), 2 / e);
    if (opts.arch && y < 0) y += opts.arch * Math.exp(-(x * x) / (opts.archW * opts.archW));
    pts.push(new THREE.Vector2(x, y));
  }
  return pts;
}
function shapeFrom(pts, holes) {
  const sh = new THREE.Shape();
  sh.setFromPoints(pts);
  if (holes) holes.forEach((h) => { const path = new THREE.Path(); path.setFromPoints(h); sh.holes.push(path); });
  return sh;
}
function extrudePts(pts, depth, bevel, holes) {
  const g = new THREE.ExtrudeGeometry(shapeFrom(pts, holes), {
    depth, steps: 1, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}
// --------------------------------------------------- optical base curve
// Real eyewear fronts wrap around the face (base curve). Flat extrusions
// read as cardboard cutouts — bend all front geometry cylindrically about Y.
const BEND_R = 210;
function bendLocal(v, ox) {
  const th = (v.x + ox) / BEND_R;
  const r = BEND_R + v.z;
  v.x = Math.sin(th) * r - Math.sin(ox / BEND_R) * BEND_R;
  v.z = Math.cos(th) * r - BEND_R - (Math.cos(ox / BEND_R) - 1) * BEND_R;
  return v;
}
const bendZ = (x) => (Math.cos(x / BEND_R) - 1) * BEND_R;
const _bv = new THREE.Vector3();
function bendGeo(geo, ox) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    _bv.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    const th = (_bv.x + ox) / BEND_R;
    bendLocal(_bv, ox);
    pos.setXYZ(i, _bv.x, _bv.y, _bv.z);
    if (nor) {
      const nx = nor.getX(i), nz = nor.getZ(i), c = Math.cos(th), s = Math.sin(th);
      nor.setXYZ(i, nx * c + nz * s, nor.getY(i), -nx * s + nz * c);
    }
  }
  pos.needsUpdate = true; if (nor) nor.needsUpdate = true;
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  return geo;
}
function templeProfile() {
  const pts = []; const L = 120;
  const yc = (x) => (x > 88 ? -0.011 * (x - 88) * (x - 88) : 0);
  const h = (x) => 5.4 - 2.2 * Math.min(1, x / L);
  for (let x = 0; x <= L; x += 4) pts.push(new THREE.Vector2(x, yc(x) + h(x) / 2));
  const ye = yc(L), he = h(L) / 2;
  for (let a = 90; a >= -90; a -= 30) pts.push(new THREE.Vector2(L + he * 0.9 * Math.cos(a * Math.PI / 180), ye + he * Math.sin(a * Math.PI / 180)));
  for (let x = L; x >= 0; x -= 4) pts.push(new THREE.Vector2(x, yc(x) - h(x) / 2));
  const h0 = h(0) / 2;
  for (let a = -90; a >= -270; a -= 30) pts.push(new THREE.Vector2(h0 * 0.6 * Math.cos(a * Math.PI / 180), h0 * Math.sin(a * Math.PI / 180)));
  return pts;
}

// ---------------------------------------------------------------- textures
function radialTex(size, stops) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function makeTortoise() {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 900, 1024);
  g.addColorStop(0, '#a89c88'); g.addColorStop(0.5, '#7e7260'); g.addColorStop(1, '#514838');
  x.fillStyle = g; x.fillRect(0, 0, 1024, 1024);
  function blob(cx, cy, r, col, a, sq) {
    x.globalAlpha = a;
    const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    rg.addColorStop(0, col); rg.addColorStop(0.55, col); rg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = rg; x.save(); x.translate(cx, cy); x.rotate(Math.random() * Math.PI);
    x.scale(1, sq); x.beginPath(); x.arc(0, 0, r, 0, TAU); x.fill(); x.restore();
    x.globalAlpha = 1;
  }
  const darks = ['#332a1e', '#1e1710', '#3e3222', '#151009'];
  for (let i = 0; i < 62; i++) blob(Math.random() * 1024, Math.random() * 1024, 70 + Math.random() * 180, darks[i % darks.length], 0.5 + Math.random() * 0.4, 0.4 + Math.random() * 0.9);
  for (let i = 0; i < 22; i++) { x.globalAlpha = 0.42 + Math.random() * 0.4; x.save(); x.translate(Math.random() * 1024, Math.random() * 1024); x.rotate((Math.random() - 0.5) * 1.3 + 0.6); x.scale(2.6 + Math.random() * 2.2, 0.5); const r = 45 + Math.random() * 95; const col = darks[i % darks.length]; const rg = x.createRadialGradient(0, 0, 0, 0, 0, r); rg.addColorStop(0, col); rg.addColorStop(0.55, col); rg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = rg; x.beginPath(); x.arc(0, 0, r, 0, TAU); x.fill(); x.restore(); x.globalAlpha = 1; }
  const lights = ['#d2c5a8', '#dfd3b6', '#e8ddc2'];
  for (let i = 0; i < 34; i++) blob(Math.random() * 1024, Math.random() * 1024, 40 + Math.random() * 110, lights[i % lights.length], 0.16 + Math.random() * 0.24, 0.5 + Math.random() * 0.8);
  for (let i = 0; i < 60; i++) { x.globalAlpha = 0.14 + Math.random() * 0.24; x.fillStyle = darks[i % 4]; x.beginPath(); x.arc(Math.random() * 1024, Math.random() * 1024, 2 + Math.random() * 7, 0, TAU); x.fill(); }
  x.globalAlpha = 1;
  return c;
}

function makeMicroSurface(size = 512) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  const image = x.createImageData(size, size);
  let seed = 918273;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < image.data.length; i += 4) {
    const grain = 116 + Math.floor(random() * 24);
    image.data[i] = image.data[i + 1] = image.data[i + 2] = grain;
    image.data[i + 3] = 255;
  }
  x.putImageData(image, 0, 0);
  x.globalAlpha = 0.18;
  x.strokeStyle = '#f4f1e8';
  x.lineWidth = 0.55;
  for (let i = 0; i < 28; i++) {
    const y = random() * size;
    x.beginPath();
    x.moveTo(random() * size * 0.2, y);
    x.lineTo(size * (0.65 + random() * 0.35), y + (random() - 0.5) * 8);
    x.stroke();
  }
  x.globalAlpha = 1;
  return c;
}

function makeLensTone() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d');
  const vertical = x.createLinearGradient(0, 0, 0, 512);
  vertical.addColorStop(0, '#08100b');
  vertical.addColorStop(0.42, '#152118');
  vertical.addColorStop(1, '#4a5140');
  x.fillStyle = vertical; x.fillRect(0, 0, 512, 512);
  const bloom = x.createRadialGradient(372, 142, 4, 372, 142, 300);
  bloom.addColorStop(0, 'rgba(160,174,149,0.5)');
  bloom.addColorStop(0.42, 'rgba(93,108,89,0.16)');
  bloom.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = bloom; x.fillRect(0, 0, 512, 512);
  return c;
}

// ============================================================================
export function createHero(opts) {
  const host = opts.host;
  const ST = opts.stages;
  let brand = opts.brand || 'AURIC';
  const laserCol = new THREE.Color(opts.laser || '#E8B84B');
  const frameCol = new THREE.Color(opts.frameColor || '#C99A5C');

  const [s1a, s1b] = ST.s1, [s2a, s2b] = ST.s2, [s3a, s3b] = ST.s3, [s4a, s4b] = ST.s4;
  const [s5a, s5b] = ST.s5, [s6a, s6b] = ST.s6, [s7a, s7b] = ST.s7, [s8a, s8b] = ST.s8;
  const [s9a, s9b] = ST.s9, [s10a, s10b] = ST.s10, [s11a, s11b] = ST.s11, [s12a, s12b] = ST.s12;
  const [s13a, s13b] = ST.s13, [s14a, s14b] = ST.s14;

  // ------------------------------------------------------------- renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 861 ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;';
  host.appendChild(renderer.domElement);
  const MAXA = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  const CREAM = new THREE.Color('#F3EFE6');
  const DARKBG = new THREE.Color('#15110B');
  scene.background = DARKBG.clone();
  scene.fog = new THREE.Fog(DARKBG.clone(), 470, 1080);

  const camera = new THREE.PerspectiveCamera(33, 1, 0.5, 1600);
  camera.position.set(10, 16, 330);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envCanvas = document.createElement('canvas'); envCanvas.width = 2048; envCanvas.height = 1024;
  (function paintEnv() {
    const W = 2048, H = 1024, ex = envCanvas.getContext('2d');
    // studio surround: warm-neutral ceiling fading to a deep floor
    const fg = ex.createLinearGradient(0, 0, 0, H);
    fg.addColorStop(0.00, '#413b32'); fg.addColorStop(0.42, '#2a261f');
    fg.addColorStop(0.62, '#1a1611'); fg.addColorStop(1.00, '#0b0a07');
    ex.fillStyle = fg; ex.fillRect(0, 0, W, H);
    // soft, feathered rectangular softboxes (the reflections that sell gloss)
    function softbox(cx, cy, w, h, col, a) {
      ex.save();
      const g = ex.createRadialGradient(0, 0, 0, 0, 0, h * 0.62);
      g.addColorStop(0, col); g.addColorStop(0.32, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      ex.globalAlpha = a; ex.translate(cx, cy); ex.scale(w / h, 1);
      ex.fillStyle = g; ex.beginPath(); ex.arc(0, 0, h * 0.62, 0, Math.PI * 2); ex.fill();
      ex.restore(); ex.globalAlpha = 1;
    }
    softbox(760, 260, 620, 360, '#FBF6EC', 0.92);  // key
    softbox(360, 360, 320, 520, '#F6ECDA', 0.7);   // warm left column
    softbox(1520, 320, 400, 580, '#FBF6EC', 0.66);  // right column
    softbox(1180, 220, 300, 260, '#F7EFE0', 0.55);  // top accent
    softbox(1900, 460, 260, 420, '#DCE7FF', 0.42);  // cool kicker
    // warm ground bounce
    const gb = ex.createLinearGradient(0, H * 0.72, 0, H);
    gb.addColorStop(0, 'rgba(0,0,0,0)'); gb.addColorStop(1, 'rgba(120,96,60,0.5)');
    ex.fillStyle = gb; ex.fillRect(0, H * 0.72, W, H * 0.28);
  })();
  const envTex = new THREE.CanvasTexture(envCanvas);
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  envTex.colorSpace = THREE.SRGBColorSpace;
  scene.environment = pmrem.fromEquirectangular(envTex).texture;
  envTex.dispose();
  // Keep the hand-painted softbox environment. A box-room IBL reflects its
  // walls as hard rectangles across dark sunglass lenses.

  // ------------------------------------------------------------- lights
  const hemi = new THREE.HemisphereLight('#EAE6DA', '#2A2620', 0.42); scene.add(hemi);
  const key = new THREE.DirectionalLight('#FFF1D6', 2.05); key.position.set(55, 120, 95);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -130; key.shadow.camera.right = 130;
  key.shadow.camera.top = 130; key.shadow.camera.bottom = -130;
  key.shadow.camera.near = 20; key.shadow.camera.far = 420;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.6;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#FFE7C4', 1.1); rim.position.set(-90, 60, -80); scene.add(rim);
  const fill = new THREE.DirectionalLight('#DCE6FF', 0.28); fill.position.set(20, 10, 150); scene.add(fill);
  const bounce = new THREE.DirectionalLight('#FFE6C6', 0.22); bounce.position.set(0, -80, 70); scene.add(bounce);
  const detailLight = new THREE.PointLight('#FFF0D2', 14, 320, 2);
  detailLight.position.set(-74, 38, 96); scene.add(detailLight);

  // ------------------------------------------------------------- materials
  const tortoiseCanvas = makeTortoise();
  function tortTex(rx, ry) {
    const t = new THREE.CanvasTexture(tortoiseCanvas);
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry); t.offset.set(0.5, 0.5); t.anisotropy = MAXA; return t;
  }
  function detailTex(canvas, rx, ry, color = false) {
    const t = new THREE.CanvasTexture(canvas);
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry); t.anisotropy = MAXA;
    return t;
  }
  const tortoiseF = tortTex(0.0075, 0.014), tortoiseT = tortTex(0.02, 0.09);
  const microCanvas = makeMicroSurface();
  const microF = detailTex(microCanvas, 0.035, 0.055);
  const microT = detailTex(microCanvas, 0.08, 0.22);
  const lensToneTex = detailTex(makeLensTone(), 1, 1, true);
  lensToneTex.wrapS = lensToneTex.wrapT = THREE.ClampToEdgeWrapping;
  const M = {
    acetateF: new THREE.MeshPhysicalMaterial({ color: frameCol.clone(), map: tortoiseF, bumpMap: microF, bumpScale: 0.045, roughness: 0.17, clearcoat: 1, clearcoatRoughness: 0.045, envMapIntensity: 1.5, sheen: 0.1, sheenColor: new THREE.Color('#B9A586'), transparent: true, opacity: 0 }),
    acetateT: new THREE.MeshPhysicalMaterial({ color: frameCol.clone(), map: tortoiseT, bumpMap: microT, bumpScale: 0.04, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.45, sheen: 0.08, sheenColor: new THREE.Color('#B9A586'), transparent: true, opacity: 0 }),
    acetateEdge: new THREE.MeshPhysicalMaterial({ color: '#090909', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.035, envMapIntensity: 1.7, transparent: true, opacity: 0 }),
    lens: new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#DDE2E0'), transmission: 0.84, thickness: 4.8, attenuationColor: new THREE.Color('#556256'), attenuationDistance: 6.8, ior: 1.53, roughness: 0.025, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.7, iridescence: 0.12, iridescenceIOR: 1.28, iridescenceThicknessRange: [140, 340], specularIntensity: 1.0, transparent: true }),
    lensTone: new THREE.MeshBasicMaterial({ map: lensToneTex, color: '#52604b', transparent: true, opacity: 0, depthWrite: false, blending: THREE.NormalBlending }),
    glassEdge: new THREE.MeshPhysicalMaterial({ color: '#D9E1DC', transmission: 0.32, thickness: 1.2, ior: 1.52, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.8, transparent: true, opacity: 0 }),
    scrap: new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#DDE2E0'), transmission: 0.86, thickness: 2.4, ior: 1.52, roughness: 0.11, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.45, transparent: true }),
    goldF: new THREE.MeshPhysicalMaterial({ color: '#D5B16A', metalness: 1, roughness: 0.18, anisotropy: 0.45, clearcoat: 0.22, clearcoatRoughness: 0.09, envMapIntensity: 1.85, transparent: true, opacity: 0 }),
    goldT: new THREE.MeshPhysicalMaterial({ color: '#D5B16A', metalness: 1, roughness: 0.18, anisotropy: 0.45, clearcoat: 0.22, clearcoatRoughness: 0.09, envMapIntensity: 1.85, transparent: true, opacity: 0 }),
    pad: new THREE.MeshPhysicalMaterial({ color: '#F4F1E8', transmission: 0.82, thickness: 1.2, ior: 1.42, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.1, transparent: true, opacity: 0 }),
    core: new THREE.MeshBasicMaterial({ color: '#E8C066', transparent: true, opacity: 0 }),
    coreSubtle: new THREE.MeshPhysicalMaterial({ color: '#A98B51', metalness: 1, roughness: 0.32, envMapIntensity: 1.2, transparent: true, opacity: 0 }),
    platform: new THREE.MeshPhysicalMaterial({ color: '#CFC7B8', roughness: 0.3, metalness: 0.6, clearcoat: 0.35, clearcoatRoughness: 0.18, envMapIntensity: 1.25, transparent: true, opacity: 0 }),
    platformTop: new THREE.MeshPhysicalMaterial({ color: '#EEE9DF', roughness: 0.2, metalness: 0.08, clearcoat: 0.8, clearcoatRoughness: 0.1, envMapIntensity: 1.15, transparent: true, opacity: 0 }),
    padTool: new THREE.MeshStandardMaterial({ color: '#E8E4DA', roughness: 0.3, metalness: 0.2, transparent: true, opacity: 0 }),
    polishedSteel: new THREE.MeshPhysicalMaterial({ color: '#9D9B94', metalness: 1, roughness: 0.17, anisotropy: 0.55, envMapIntensity: 1.7, transparent: true, opacity: 0 }),
    ceramic: new THREE.MeshPhysicalMaterial({ color: '#2C2925', roughness: 0.24, metalness: 0.7, clearcoat: 0.4, envMapIntensity: 1.2 }),
    hardwareDark: new THREE.MeshStandardMaterial({ color: '#201B14', metalness: 0.55, roughness: 0.3, transparent: true, opacity: 0 }),
  };
  M.frameEmissive = frameCol.clone().lerp(new THREE.Color('#FFFFFF'), 0.35);
  M.acetateF.emissive = new THREE.Color('#000000');
  const white = new THREE.Color('#FFFFFF');

  // ------------------------------------------------------------- platform
  const platform = new THREE.Group(); platform.position.y = -20; platform.visible = false; scene.add(platform);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(60, 64, 4.8, 96), M.platform); disc.receiveShadow = true; platform.add(disc);
  const lowerDisc = new THREE.Mesh(new THREE.CylinderGeometry(65.5, 68, 2.2, 96), M.platform);
  lowerDisc.position.y = -3.3; lowerDisc.receiveShadow = true; platform.add(lowerDisc);
  const topDisc = new THREE.Mesh(new THREE.CylinderGeometry(56.5, 58, 1.1, 96), M.platformTop);
  topDisc.position.y = 2.9; topDisc.receiveShadow = true; platform.add(topDisc);
  const ringMat = new THREE.MeshPhysicalMaterial({ color: '#D5B16A', roughness: 0.16, metalness: 1, anisotropy: 0.5, envMapIntensity: 1.8, emissive: laserCol.clone(), emissiveIntensity: 0, transparent: true, opacity: 0 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(63.5, 0.7, 10, 110), ringMat);
  ring.rotation.x = Math.PI / 2; ring.position.y = 2.1; platform.add(ring);
  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(47, 0.32, 8, 110), ringMat);
  innerRing.rotation.x = Math.PI / 2; innerRing.position.y = 3.55; platform.add(innerRing);
  const outerGrooveMat = new THREE.MeshBasicMaterial({ color: '#88775B', transparent: true, opacity: 0 });
  [52, 55].forEach((radius) => {
    const groove = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.13, 6, 110), outerGrooveMat);
    groove.rotation.x = Math.PI / 2; groove.position.y = 3.52; platform.add(groove);
  });
  const dashPts = [];
  for (let i = 0; i <= 90; i++) { const a = (i / 90) * TAU; dashPts.push(new THREE.Vector3(Math.cos(a) * 40, 2.2, Math.sin(a) * 40)); }
  const dashGeo = new THREE.BufferGeometry().setFromPoints(dashPts);
  const dash = new THREE.Line(dashGeo, new THREE.LineDashedMaterial({ color: '#8A8171', dashSize: 3, gapSize: 4, transparent: true, opacity: 0.35 }));
  dash.computeLineDistances(); platform.add(dash);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 70),
    new THREE.MeshBasicMaterial({ map: radialTex(256, [[0, 'rgba(40,32,18,0.85)'], [0.5, 'rgba(40,32,18,0.28)'], [1, 'rgba(40,32,18,0)']]), transparent: true, opacity: 0.16, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 2.3; platform.add(shadow);

  // ------------------------------------------------------------- particles
  const spotTex = radialTex(64, [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']]);
  const pGeo = new THREE.BufferGeometry();
  const pN = 240, pPos = new Float32Array(pN * 3);
  for (let i = 0; i < pN; i++) { pPos[i * 3] = (Math.random() - 0.5) * 340; pPos[i * 3 + 1] = -40 + Math.random() * 150; pPos[i * 3 + 2] = (Math.random() - 0.5) * 280; }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({ color: '#FFF6E0', size: 1.05, map: spotTex, transparent: true, opacity: 0.38, depthWrite: false, sizeAttenuation: true });
  const particles = new THREE.Points(pGeo, pMat); scene.add(particles);

  // ------------------------------------------------------------- glasses
  const G = new THREE.Group(); G.position.y = 10; scene.add(G);
  const N = 96;
  const lensPts = superPts(N, 27, 17.5, 3.8);
  const circPts = superPts(N, 30, 30, 2);
  const LOX = Math.sin(33.5 / BEND_R) * BEND_R, LOZ = bendZ(33.5);
  const scrapHole = lensPts.map((p) => p.clone().multiplyScalar(1.004)).reverse();
  const lensGeoR = bendGeo(extrudePts(lensPts, 2.4, 0.25), 33.5);
  const lensGeoL = bendGeo(extrudePts(lensPts, 2.4, 0.25), -33.5);
  const scrapGeoR = bendGeo(extrudePts(circPts, 2.4, 0.25, [scrapHole]), 33.5);
  const scrapGeoL = bendGeo(extrudePts(circPts, 2.4, 0.25, [scrapHole.map((p) => p.clone())]), -33.5);

  const lensGroupL = new THREE.Group(), lensGroupR = new THREE.Group();
  G.add(lensGroupL, lensGroupR);
  const lensL = new THREE.Mesh(lensGeoL, M.lens), lensR = new THREE.Mesh(lensGeoR, M.lens);
  lensL.castShadow = lensR.castShadow = true;
  const scrapL = new THREE.Mesh(scrapGeoL, M.scrap), scrapR = new THREE.Mesh(scrapGeoR, M.scrap);
  lensGroupL.add(lensL, scrapL); lensGroupR.add(lensR, scrapR);

  // A polished lens needs a readable cut edge and a controlled studio streak.
  // Without these two cues, clear optics disappear against the cream set.
  const bevelOuter = lensPts.map((p) => p.clone().multiplyScalar(1.018));
  const bevelInner = lensPts.map((p) => p.clone().multiplyScalar(0.982)).reverse();
  const bevelL = new THREE.Mesh(bendGeo(extrudePts(bevelOuter, 0.9, 0.1, [bevelInner]), -33.5), M.glassEdge);
  const bevelR = new THREE.Mesh(bendGeo(extrudePts(bevelOuter, 0.9, 0.1, [bevelInner]), 33.5), M.glassEdge);
  lensGroupL.add(bevelL); lensGroupR.add(bevelR);

  const reflectionTex = radialTex(256, [[0, 'rgba(255,255,255,0.88)'], [0.28, 'rgba(255,255,255,0.34)'], [1, 'rgba(255,255,255,0)']]);
  const reflectionMatL = new THREE.MeshBasicMaterial({ map: reflectionTex, color: '#F8F4E9', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const reflectionMatR = reflectionMatL.clone();
  const reflectionL = new THREE.Mesh(new THREE.PlaneGeometry(12, 33), reflectionMatL);
  const reflectionR = new THREE.Mesh(new THREE.PlaneGeometry(12, 33), reflectionMatR);
  reflectionL.position.set(-8, 3, 2.05); reflectionR.position.set(-8, 3, 2.05);
  reflectionL.rotation.z = reflectionR.rotation.z = -0.28;
  lensGroupL.add(reflectionL); lensGroupR.add(reflectionR);

  const toneGeoL = bendGeo(new THREE.ShapeGeometry(shapeFrom(lensPts)), -33.5);
  const toneGeoR = bendGeo(new THREE.ShapeGeometry(shapeFrom(lensPts)), 33.5);
  const lensToneL = new THREE.Mesh(toneGeoL, M.lensTone);
  const lensToneR = new THREE.Mesh(toneGeoR, M.lensTone);
  lensToneL.position.z = lensToneR.position.z = 1.32;
  lensToneL.renderOrder = lensToneR.renderOrder = 3;
  lensGroupL.add(lensToneL); lensGroupR.add(lensToneR);

  // molten cut edge (vertex-colored additive line loop)
  const mkEdge = (ox) => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    lensPts.forEach((p, i) => { const v = bendLocal(new THREE.Vector3(p.x, p.y, 0), ox); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; });
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    return new THREE.LineLoop(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  };
  const edgeL = mkEdge(-33.5), edgeR = mkEdge(33.5);
  lensGroupL.add(edgeL); lensGroupR.add(edgeR);

  // polish dust
  const mkDust = () => {
    const g = new THREE.BufferGeometry(); const n = 42; const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * 22; arr[i * 3] = Math.cos(a) * r; arr[i * 3 + 1] = Math.sin(a) * r * 0.76; arr[i * 3 + 2] = (Math.random() - 0.5) * 4; }
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color: '#8F887A', size: 0.7, map: spotTex, transparent: true, opacity: 0, depthWrite: false }));
  };
  const dustL = mkDust(), dustR = mkDust();
  lensGroupL.add(dustL); lensGroupR.add(dustR);

  // polishing pads (2 per lens)
  const padToolGeo = new THREE.CylinderGeometry(5.5, 5.5, 1.8, 24);
  const pads = [];
  [lensGroupL, lensGroupR].forEach((lg) => {
    for (let k = 0; k < 2; k++) {
      const assembly = new THREE.Group();
      const wheel = new THREE.Mesh(padToolGeo, M.padTool); wheel.rotation.x = Math.PI / 2;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 2.1, 24), M.polishedSteel);
      hub.rotation.x = Math.PI / 2; hub.position.z = k === 0 ? 1.8 : -1.8;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 10, 18), M.polishedSteel);
      shaft.rotation.x = Math.PI / 2; shaft.position.z = k === 0 ? 7 : -7;
      const collar = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.34, 8, 32), M.polishedSteel);
      collar.position.z = k === 0 ? 3 : -3;
      assembly.add(wheel, hub, shaft, collar);
      assembly.visible = false; lg.add(assembly); pads.push(assembly);
    }
  });

  // blue-light demo glow (per lens)
  const blueMat = new THREE.MeshBasicMaterial({ color: '#78AFFF', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const blueL = new THREE.Mesh(new THREE.CircleGeometry(22, 40), blueMat);
  const blueR = blueL.clone(); blueR.material = blueMat;
  blueL.position.z = 2.6; blueR.position.z = 2.6;
  lensGroupL.add(blueL); lensGroupR.add(blueR);

  // --------------------------------------------------- optical layer stacks
  const LAYERS = [
    ['#6FC6F5', 0.55], ['#B197F2', 0.55], ['#79DFD2', 0.55], ['#F2CE77', 0.6],
    ['#74A9DA', 0.6], ['#F49B54', 0.6], ['#8A97A2', 0.9],
  ];
  const layerPts = lensPts.map((p) => p.clone().multiplyScalar(0.985));
  const layerRootL = new THREE.Group(), layerRootR = new THREE.Group();
  G.add(layerRootL, layerRootR);
  const layerMats = [], layerMeshesR = [];
  LAYERS.forEach(([col, op], i) => {
    const geoL = bendGeo(extrudePts(layerPts, i === 6 ? 1.8 : 0.7, 0.12), -33.5);
    const geoR = bendGeo(extrudePts(layerPts, i === 6 ? 1.8 : 0.7, 0.12), 33.5);
    const mat = new THREE.MeshPhysicalMaterial({
      color: col, transparent: true, opacity: 0, roughness: 0.4, clearcoat: 0.3,
      emissive: new THREE.Color(col), emissiveIntensity: 0.35, envMapIntensity: 0.3, depthWrite: false,
    });
    mat.userData.baseOp = op; layerMats.push(mat);
    const a = new THREE.Mesh(geoL, mat), b = new THREE.Mesh(geoR, mat);
    layerRootL.add(a); layerRootR.add(b); layerMeshesR.push(b);
  });
  layerRootL.visible = layerRootR.visible = false;

  // ------------------------------------------------------------- frame
  const rimOuter = lensPts.map((p) => p.clone().multiplyScalar(1.145));
  const rimInner = lensPts.map((p) => p.clone().multiplyScalar(1.025)).reverse();
  const rimFlatL = extrudePts(rimOuter, 4.2, 0.8, [rimInner]);
  const rimFlatR = extrudePts(rimOuter, 4.2, 0.8, [rimInner.map((p) => p.clone())]);
  const rimEdgeGeoL = bendGeo(new THREE.EdgesGeometry(rimFlatL, 30), -33.5);
  const rimEdgeGeoR = bendGeo(new THREE.EdgesGeometry(rimFlatR, 30), 33.5);
  const rimGeoL = bendGeo(rimFlatL, -33.5);
  const rimGeoR = bendGeo(rimFlatR, 33.5);
  const frameMesh = new THREE.Group();
  const frameRimL = new THREE.Mesh(rimGeoL, M.acetateF), frameRimR = new THREE.Mesh(rimGeoR, M.acetateF);
  frameRimL.position.set(-LOX, 0, LOZ); frameRimR.position.set(LOX, 0, LOZ);
  frameRimL.castShadow = frameRimR.castShadow = true;
  const bridgeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-6.8, 3.2, 1.5), new THREE.Vector3(0, 7.4, 2.2), new THREE.Vector3(6.8, 3.2, 1.5),
  ]);
  const bridgeGeo = new THREE.TubeGeometry(bridgeCurve, 24, 2.15, 12, false);
  const bridgeMesh = new THREE.Mesh(bridgeGeo, M.acetateF); bridgeMesh.castShadow = true;
  frameMesh.add(frameRimL, frameRimR, bridgeMesh);

  const rearOuter = lensPts.map((p) => p.clone().multiplyScalar(1.132));
  const rearInner = lensPts.map((p) => p.clone().multiplyScalar(1.043)).reverse();
  const rearRimL = new THREE.Mesh(bendGeo(extrudePts(rearOuter, 1.45, 0.3, [rearInner]), -33.5), M.acetateEdge);
  const rearRimR = new THREE.Mesh(bendGeo(extrudePts(rearOuter, 1.45, 0.3, [rearInner.map((p) => p.clone())]), 33.5), M.acetateEdge);
  rearRimL.position.set(-LOX, 0, LOZ - 2.65); rearRimR.position.set(LOX, 0, LOZ - 2.65);
  rearRimL.castShadow = rearRimR.castShadow = true;
  frameMesh.add(rearRimL, rearRimR);
  frameMesh.visible = false; G.add(frameMesh);

  // Fine metal eyewire gives the finished frame a precise, premium edge.
  const trimOuter = lensPts.map((p) => p.clone().multiplyScalar(1.045));
  const trimInner = lensPts.map((p) => p.clone().multiplyScalar(1.014)).reverse();
  const trimL = new THREE.Mesh(bendGeo(extrudePts(trimOuter, 0.62, 0.1, [trimInner]), -33.5), M.goldF);
  const trimR = new THREE.Mesh(bendGeo(extrudePts(trimOuter, 0.62, 0.1, [trimInner]), 33.5), M.goldF);
  trimL.position.set(-LOX, 0, LOZ + 2.15); trimR.position.set(LOX, 0, LOZ + 2.15);
  G.add(trimL, trimR);

  const innerLipOuter = lensPts.map((p) => p.clone().multiplyScalar(1.077));
  const innerLipInner = lensPts.map((p) => p.clone().multiplyScalar(1.042)).reverse();
  const innerLipL = new THREE.Mesh(bendGeo(extrudePts(innerLipOuter, 0.78, 0.12, [innerLipInner]), -33.5), M.acetateEdge);
  const innerLipR = new THREE.Mesh(bendGeo(extrudePts(innerLipOuter, 0.78, 0.12, [innerLipInner.map((p) => p.clone())]), 33.5), M.acetateEdge);
  innerLipL.position.set(-LOX, 0, LOZ + 2.35); innerLipR.position.set(LOX, 0, LOZ + 2.35);
  G.add(innerLipL, innerLipR);

  // blueprint lines + CAD grid
  const bpMat = new THREE.LineBasicMaterial({ color: '#5E7078', transparent: true, opacity: 0, depthWrite: false });
  const frameEdges = new THREE.Group();
  const frameEdgeL = new THREE.LineSegments(rimEdgeGeoL, bpMat), frameEdgeR = new THREE.LineSegments(rimEdgeGeoR, bpMat);
  frameEdgeL.position.set(-LOX, 0, LOZ); frameEdgeR.position.set(LOX, 0, LOZ);
  frameEdges.add(frameEdgeL, frameEdgeR, new THREE.LineSegments(new THREE.EdgesGeometry(bridgeGeo, 30), bpMat));
  frameEdges.visible = false; G.add(frameEdges);
  const gridMat = new THREE.LineDashedMaterial({ color: '#6E7F86', dashSize: 2.4, gapSize: 3.2, transparent: true, opacity: 0 });
  const gridGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-96, 0, 0), new THREE.Vector3(96, 0, 0),
    new THREE.Vector3(0, -36, 0), new THREE.Vector3(0, 36, 0),
  ]);
  const grid = new THREE.LineSegments(gridGeo, gridMat); grid.computeLineDistances(); grid.visible = false; G.add(grid);

  // hinge knuckles + nose pads (frame side)
  const knGeo = new THREE.BoxGeometry(2.4, 8, 3);
  const knTh = 61.3 / BEND_R, knRad = BEND_R - 1.2;
  const knX = Math.sin(knTh) * knRad, knZ = Math.cos(knTh) * knRad - BEND_R;
  const knL = new THREE.Mesh(knGeo, M.goldF), knR = new THREE.Mesh(knGeo, M.goldF);
  knL.position.set(-knX, 12, knZ); knL.rotation.y = -knTh;
  knR.position.set(knX, 12, knZ); knR.rotation.y = knTh;
  G.add(knL, knR);
  const screwGeo = new THREE.CylinderGeometry(1.15, 1.15, 0.75, 24); screwGeo.rotateX(Math.PI / 2);
  const screwL = new THREE.Mesh(screwGeo, M.goldF), screwR = new THREE.Mesh(screwGeo, M.goldF);
  screwL.position.set(-knX, 12, knZ + 2.05); screwR.position.set(knX, 12, knZ + 2.05);
  G.add(screwL, screwR);
  const screwSlotGeo = new THREE.BoxGeometry(0.26, 1.42, 0.16);
  const screwSlotL = new THREE.Mesh(screwSlotGeo, M.hardwareDark), screwSlotR = new THREE.Mesh(screwSlotGeo, M.hardwareDark);
  screwSlotL.position.set(-knX, 12, knZ + 2.5); screwSlotR.position.set(knX, 12, knZ + 2.5);
  G.add(screwSlotL, screwSlotR);

  const hingeDetailGroups = [];
  [-1, 1].forEach((side) => {
    const hinge = new THREE.Group();
    hinge.position.set(side * knX, 12, knZ - 0.15);
    hinge.rotation.y = side * knTh;
    const barrelGeo = new THREE.CylinderGeometry(1.28, 1.28, 2.15, 24);
    [-2.7, 0, 2.7].forEach((offset) => {
      const barrel = new THREE.Mesh(barrelGeo, M.goldF);
      barrel.position.y = offset; barrel.castShadow = true; hinge.add(barrel);
    });
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 8.35, 16), M.hardwareDark);
    pin.castShadow = true; hinge.add(pin);
    const capTop = new THREE.Mesh(new THREE.CylinderGeometry(1.38, 1.38, 0.34, 24), M.goldF);
    const capBottom = capTop.clone();
    capTop.position.y = 4.15; capBottom.position.y = -4.15;
    hinge.add(capTop, capBottom);
    hingeDetailGroups.push(hinge); G.add(hinge);
  });

  const padGeo = new THREE.SphereGeometry(2.4, 16, 12); padGeo.scale(0.55, 1.25, 0.45);
  const npL = new THREE.Mesh(padGeo, M.pad), npR = new THREE.Mesh(padGeo, M.pad);
  npL.position.set(-8.8, -7.5, -2.6); npL.rotation.z = 0.5;
  npR.position.set(8.8, -7.5, -2.6); npR.rotation.z = -0.5; G.add(npL, npR);
  const padArmL = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(-5.8, -1.6, 0.2), new THREE.Vector3(-7.8, -4.1, -0.9), new THREE.Vector3(-8.8, -7.1, -2.1),
  ]), 18, 0.32, 8), M.goldF);
  const padArmR = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(5.8, -1.6, 0.2), new THREE.Vector3(7.8, -4.1, -0.9), new THREE.Vector3(8.8, -7.1, -2.1),
  ]), 18, 0.32, 8), M.goldF);
  G.add(padArmL, padArmR);

  const frontRivets = [];
  [-1, 1].forEach((side) => {
    const x = side * 59;
    const endpiece = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.5, 1.15), M.goldF);
    endpiece.position.set(x, 10.8, bendZ(59) + 2.85);
    endpiece.rotation.y = side * (59 / BEND_R);
    endpiece.castShadow = true;
    const rivet = new THREE.Mesh(screwGeo, M.goldF);
    rivet.scale.set(0.62, 0.62, 0.62);
    rivet.position.set(x, 10.8, bendZ(59) + 3.5);
    const inset = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.35, 0.2), M.hardwareDark);
    inset.position.set(x, 10.8, bendZ(59) + 3.48);
    inset.rotation.y = side * (59 / BEND_R);
    frontRivets.push(endpiece, rivet, inset);
    G.add(endpiece, rivet, inset);
  });
  // (no front rivets — clean acetate front reads more premium/real)

  // brow core (x-ray)
  const browCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-58, 10, bendZ(58)), new THREE.Vector3(-30, 16, bendZ(30)), new THREE.Vector3(0, 17, 0),
    new THREE.Vector3(30, 16, bendZ(30)), new THREE.Vector3(58, 10, bendZ(58)),
  ]);
  const browCore = new THREE.Mesh(new THREE.TubeGeometry(browCurve, 40, 0.9, 6), M.core);
  browCore.visible = false; G.add(browCore);

  // ------------------------------------------------------------- temples
  const templeGeo = extrudePts(templeProfile(), 2.8, 0.4);
  const HGX = Math.sin(62 / BEND_R) * BEND_R, HGZ = -2 + bendZ(62);
  const templeR = new THREE.Group(), templeL = new THREE.Group();
  templeR.position.set(HGX, 12, HGZ); templeL.position.set(-HGX, 12, HGZ);
  G.add(templeR, templeL);
  const tMeshR = new THREE.Mesh(templeGeo, M.acetateT); tMeshR.rotation.y = Math.PI / 2;
  const tMeshL = new THREE.Mesh(templeGeo, M.acetateT); tMeshL.rotation.y = Math.PI / 2;
  tMeshR.castShadow = tMeshL.castShadow = true;
  templeR.add(tMeshR); templeL.add(tMeshL);
  const pinGeo = new THREE.CylinderGeometry(0.9, 0.9, 8.5, 12);
  const pinR = new THREE.Mesh(pinGeo, M.goldT), pinL = new THREE.Mesh(pinGeo, M.goldT);
  pinR.castShadow = pinL.castShadow = true;
  templeR.add(pinR); templeL.add(pinL);
  const plateR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.4, 7), M.goldT);
  const plateL = plateR.clone();
  plateR.position.set(1.9, 0, -24); plateL.position.set(-1.9, 0, -24);
  templeR.add(plateR); templeL.add(plateL);

  const inlayCurveR = new THREE.CatmullRomCurve3([
    new THREE.Vector3(1.82, 0.6, -10), new THREE.Vector3(1.7, 0.35, -48), new THREE.Vector3(1.5, -0.35, -92),
  ]);
  const inlayCurveL = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.82, 0.6, -10), new THREE.Vector3(-1.7, 0.35, -48), new THREE.Vector3(-1.5, -0.35, -92),
  ]);
  const templeInlayR = new THREE.Mesh(new THREE.TubeGeometry(inlayCurveR, 52, 0.34, 8), M.goldT);
  const templeInlayL = new THREE.Mesh(new THREE.TubeGeometry(inlayCurveL, 52, 0.34, 8), M.goldT);
  templeR.add(templeInlayR); templeL.add(templeInlayL);

  const subtleCoreCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.2, -5), new THREE.Vector3(0, 0.1, -58), new THREE.Vector3(0, -2.2, -108),
  ]);
  const subtleCoreGeo = new THREE.TubeGeometry(subtleCoreCurve, 60, 0.46, 8);
  const subtleCoreR = new THREE.Mesh(subtleCoreGeo, M.coreSubtle);
  const subtleCoreL = new THREE.Mesh(subtleCoreGeo, M.coreSubtle);
  templeR.add(subtleCoreR); templeL.add(subtleCoreL);
  // engraving
  const engCanvas = document.createElement('canvas'); engCanvas.width = 1024; engCanvas.height = 128;
  const engTex = new THREE.CanvasTexture(engCanvas); engTex.colorSpace = THREE.SRGBColorSpace; engTex.anisotropy = MAXA;
  function drawEngraving() {
    const ctx = engCanvas.getContext('2d');
    ctx.clearRect(0, 0, 1024, 128);
    ctx.fillStyle = 'rgba(46,42,34,0.92)'; ctx.textBaseline = 'middle';
    try { ctx.letterSpacing = '20px'; } catch (e) { /* older engines */ }
    ctx.font = '500 56px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillText(brand.toUpperCase(), 30, 66);
    ctx.font = '400 26px "IBM Plex Mono", monospace';
    ctx.fillStyle = 'rgba(46,42,34,0.65)';
    ctx.fillText('N\u00BA 001 \u2014 TITANIUM', 660, 68);
    engTex.needsUpdate = true;
  }
  drawEngraving();
  const engMat = new THREE.MeshBasicMaterial({ map: engTex, transparent: true, opacity: 0, depthWrite: false });
  const engPlane = new THREE.Mesh(new THREE.PlaneGeometry(26, 3.25), engMat);
  engPlane.position.set(1.95, 0.3, -44); engPlane.rotation.y = Math.PI / 2; templeR.add(engPlane);
  // temple cores (x-ray)
  const tCoreGeo = new THREE.CylinderGeometry(0.8, 0.8, 112, 8); tCoreGeo.rotateX(Math.PI / 2);
  const tCoreR = new THREE.Mesh(tCoreGeo, M.core); tCoreR.position.set(0, 0.4, -58); tCoreR.visible = false; templeR.add(tCoreR);
  const tCoreL = new THREE.Mesh(tCoreGeo, M.core); tCoreL.position.set(0, 0.4, -58); tCoreL.visible = false; templeL.add(tCoreL);
  const templeParts = { templeVis: 0 };

  // ------------------------------------------------------------- lasers
  const emitters = new THREE.Group(); scene.add(emitters);
  const emitterDefs = [new THREE.Vector3(95, 85, 55), new THREE.Vector3(-100, 75, 35), new THREE.Vector3(10, 115, -45)];
  const tips = [], emitterStarts = [];
  const laserSteel = M.polishedSteel.clone(); laserSteel.transparent = false; laserSteel.opacity = 1;
  emitterDefs.forEach((pos) => {
    const g = new THREE.Group(); g.position.copy(pos);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.8, 8.2, 32), M.ceramic);
    body.castShadow = true;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 4.15, 2.4, 32), laserSteel);
    crown.position.y = -5.15;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(3.45, 0.48, 10, 36), laserSteel);
    collar.rotation.x = Math.PI / 2; collar.position.y = -4;
    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(2.05, 3.7, 28), laserSteel);
    nozzle.position.y = -7.9; nozzle.rotation.z = Math.PI;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.72, 16, 12), new THREE.MeshBasicMaterial({ color: laserCol.clone() }));
    tip.position.y = -9.65;
    for (let i = 0; i < 3; i++) {
      const coolingRing = new THREE.Mesh(new THREE.TorusGeometry(4.25, 0.24, 8, 36), laserSteel);
      coolingRing.rotation.x = Math.PI / 2; coolingRing.position.y = 1.9 - i * 1.9; g.add(coolingRing);
    }
    g.add(body, crown, collar, nozzle, tip);
    emitterStarts.push(pos.clone().add(new THREE.Vector3(0, -9.65, 0)));
    tips.push(tip); emitters.add(g);
  });
  const beamMatCore = new THREE.MeshBasicMaterial({ color: laserCol.clone(), transparent: true, opacity: 0, blending: THREE.NormalBlending, depthWrite: false });
  const beamMatHalo = new THREE.MeshBasicMaterial({ color: laserCol.clone(), transparent: true, opacity: 0, blending: THREE.NormalBlending, depthWrite: false });
  const beamGeo = new THREE.CylinderGeometry(0.34, 0.34, 1, 8, 1, true);
  const haloGeo = new THREE.CylinderGeometry(1.7, 1.7, 1, 8, 1, true);
  const beams = emitterDefs.map(() => {
    const core = new THREE.Mesh(beamGeo, beamMatCore), halo = new THREE.Mesh(haloGeo, beamMatHalo);
    core.visible = halo.visible = false; scene.add(core, halo); return { core, halo };
  });
  const UPV = new THREE.Vector3(0, 1, 0);
  function aimBeam(b, from, to) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    b.core.position.copy(from).addScaledVector(dir, 0.5);
    b.halo.position.copy(b.core.position);
    b.core.scale.set(1, len, 1); b.halo.scale.set(1, len, 1);
    b.core.quaternion.setFromUnitVectors(UPV, dir.normalize());
    b.halo.quaternion.copy(b.core.quaternion);
  }
  // contact glow sprites
  const glowTexBig = radialTex(128, [[0, 'rgba(255,255,255,1)'], [0.18, 'rgba(255,224,150,0.92)'], [0.5, 'rgba(255,178,88,0.4)'], [1, 'rgba(255,178,88,0)']]);
  const mkGlow = (scale) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexBig, color: laserCol.clone(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.setScalar(scale); s.visible = false; scene.add(s); return s;
  };
  const glowR = mkGlow(11), glowGL = mkGlow(11);
  // sparks
  const SPN = 240;
  const spGeo = new THREE.BufferGeometry();
  const spPos = new Float32Array(SPN * 3), spVel = new Float32Array(SPN * 3), spLife = new Float32Array(SPN);
  spPos.fill(-9999);
  spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3).setUsage(THREE.DynamicDrawUsage));
  const spMat = new THREE.PointsMaterial({ color: '#FFD9A0', size: 2.3, map: spotTex, transparent: true, opacity: 0.98, blending: THREE.AdditiveBlending, depthWrite: false });
  const sparks = new THREE.Points(spGeo, spMat); sparks.frustumCulled = false; scene.add(sparks);
  let spCursor = 0;
  function spawnSpark(w) {
    const i = spCursor = (spCursor + 1) % SPN;
    spPos[i * 3] = w.x; spPos[i * 3 + 1] = w.y; spPos[i * 3 + 2] = w.z;
    const a = Math.random() * TAU;
    spVel[i * 3] = Math.cos(a) * (14 + Math.random() * 44);
    spVel[i * 3 + 1] = 16 + Math.random() * 48;
    spVel[i * 3 + 2] = Math.sin(a) * (14 + Math.random() * 44);
    spLife[i] = 0.3 + Math.random() * 0.55;
  }
  // smoke
  const smokeTex = radialTex(128, [[0, 'rgba(150,142,128,0.5)'], [1, 'rgba(150,142,128,0)']]);
  const smokes = [];
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, opacity: 0, depthWrite: false }));
    s.visible = false; scene.add(s); smokes.push(s);
  }

  // flash + glare
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexBig, color: white.clone(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  flash.scale.setScalar(95); flash.visible = false; G.add(flash);
  const glare = new THREE.Mesh(new THREE.PlaneGeometry(62, 5), new THREE.MeshBasicMaterial({ map: radialTex(128, [[0, 'rgba(255,255,255,0.95)'], [1, 'rgba(255,255,255,0)']]), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  glare.position.set(0, 4, 8); glare.rotation.z = -0.07; glare.visible = false; G.add(glare);

  // ------------------------------------------------------------- camera rig
  const KEYS = [
    [0.000, 10, 16, 330, 0, 2, 0],
    [0.052, 26, 20, 240, 0, 8, 0],
    [0.105, 44, 32, 226, 0, 10, 0],
    [0.155, -12, 22, 212, 0, 10, 0],
    [0.190, -32, 14, 152, 0, 10, 0],
    [0.225, 74, 24, 196, 26, 10, 4],
    [0.300, 52, 18, 182, 16, 10, 2],
    [0.325, 4, 14, 222, 0, 10, 0],
    [0.380, 0, 12, 214, 0, 10, 0],
    [0.420, -48, 20, 184, 0, 10, 0],
    [0.458, 60, 58, 170, 0, 10, -12],
    [0.505, 66, 34, 150, 0, 10, -8],
    [0.525, 78, 26, 118, 58, 12, -28],
    [0.552, 88, 20, 108, 62, 10, -36],
    [0.582, 10, 8, 118, 0, -1, 0],
    [0.605, 43.5, 38, 224, 0, 10, 0],
    [0.675, 43.5, 38, 224, 0, 10, 0],
    [0.700, 42, 28, 148, 0, 10, 0],
    [0.732, 0, 18, 222, 0, 10, 0],
    [0.818, 8, 24, 224, 0, 10, 0],
    [0.878, 72, 30, 230, 0, 14, 0],
    [0.906, 32, 22, 258, 0, 18, 0],
    [0.948, 32, 28, 244, 0, 24, 0],
    [0.975, 30, 30, 238, 0, 24, 0],
    [1.001, 28, 31, 240, 0, 25, 0],
  ];
  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3();
  function evalCam(p) {
    let i = 0;
    while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++;
    const A = KEYS[i], B = KEYS[i + 1];
    const t = smooth(seg(p, A[0], B[0]));
    camPos.set(lerp(A[1], B[1], t), lerp(A[2], B[2], t), lerp(A[3], B[3], t));
    camTgt.set(lerp(A[4], B[4], t), lerp(A[5], B[5], t), lerp(A[6], B[6], t));
    // full orbit (stage 9)
    const ob9 = trap(p, s9a, s9a + 0.008, s9b - 0.008, s9b);
    if (ob9 > 0) {
      const az = (15 + 360 * seg(p, s9a, s9b)) * Math.PI / 180;
      camPos.lerp(new THREE.Vector3(Math.sin(az) * 230, 38, Math.cos(az) * 230), ob9);
    }
  }

  // ------------------------------------------------------------- bg chains
  const bgWork = new THREE.Color(), colWork = new THREE.Color();
  function chain(arr, t) {
    const n = arr.length - 1;
    const f = clamp(t, 0, 0.9999) * n;
    const i = Math.floor(f), lt = f - i;
    const mix = smooth(clamp((lt - 0.62) / 0.38, 0, 1));
    colWork.set(arr[i]).lerp(new THREE.Color(arr[Math.min(i + 1, n)]), mix);
    return colWork;
  }
  const BG11 = ['#F8EFD3', '#ECEDEA', '#E7EBF5', '#F1EFE9'];
  const BG12 = ['#F2E7D6', '#F8F0DC', '#E8EDF1', '#EAE8E5'];
  const KEYC12 = ['#FFE3B8', '#FFF4DC', '#E6F0FF', '#F5F2ED'];
  const DARK11 = [0.75, 0.12, 0.28, 0.32];
  const KEYI11 = [3.0, 1.2, 1.5, 1.8];
  const BLUE11 = [0, 0, 1, 0];
  function chainNum(arr, t) {
    const n = arr.length - 1;
    const f = clamp(t, 0, 0.9999) * n;
    const i = Math.floor(f), lt = f - i;
    const mix = smooth(clamp((lt - 0.62) / 0.38, 0, 1));
    return lerp(arr[i], arr[Math.min(i + 1, n)], mix);
  }

  // ------------------------------------------------------------- state
  let time = 0, hl = -1, vw = 1, vh = 1, composer = null, bloomPass = null, disposed = false;
  const V = new THREE.Vector3(), V2 = new THREE.Vector3();
  const lensClear = new THREE.Color('#A9B2AC'), lensDark = new THREE.Color('#141810'), lensG15 = new THREE.Color('#2A331C');
  const keyBaseCol = new THREE.Color('#FFF1D6');

  function frontLocal(f, side) {
    const i = Math.floor(f) % N;
    const pt = lensPts[i];
    V2.set(pt.x * side, pt.y, 1.2);
    return bendLocal(V2, 33.5 * side);
  }

  const BGK = [
    [0.00, '#F7F0E2'], [0.28, '#F3EAD8'], [0.312, '#F0ECE5'], [0.329, '#F1EDE6'],
    [0.375, '#E7DEC9'], [0.55, '#E3DAC5'], [0.60, '#DDD4BF'], [0.62, '#F0E7D5'],
    [0.675, '#EAE3D5'], [0.73, '#F2EADA'], [0.792, '#ECEAE4'], [0.818, '#E2D9C4'],
    [0.90, '#E9E0CE'], [1.0, '#EEE5D3'],
  ];
  const bgCols = BGK.map((k) => new THREE.Color(k[1]));
  function evalBg(pp, out) {
    let i = 0; while (i < BGK.length - 2 && pp > BGK[i + 1][0]) i++;
    out.copy(bgCols[i]).lerp(bgCols[i + 1], smooth(seg(pp, BGK[i][0], BGK[i + 1][0])));
  }

  // ============================================================== FRAME ==
  function frame(p, dt) {
    time += dt;
    const intro = smooth(clamp(time / 2.4, 0, 1));

    // ---- master stage locals
    const ct = seg(p, s2a + 0.012, s2b - 0.016);                       // laser cut trace
    const laserVis = trap(p, s2a - 0.006, s2a + 0.02, s2b - 0.012, s2b + 0.018);
    const heat = trap(p, s2a, s2a + 0.02, s2b - 0.006, s2b + 0.045);
    const dropT = seg(p, s2b - 0.012, s2b + 0.02);
    const polT = easeIO(seg(p, s3a + 0.008, s3b - 0.008));
    const padVis = trap(p, s3a, s3a + 0.015, s3b - 0.022, s3b);
    const layerVis = trap(p, s4a, s4a + 0.008, s4b - 0.0095, s4b - 0.0035);
    const rise = easeIO(seg(p, s4a + 0.0075, s4a + 0.041));
    const comp = easeIO(seg(p, s4a + 0.073, s4a + 0.0945));
    const sepU = 0.75 + 10.0 * rise * (1 - comp);
    const layerT = trap(p, s4a + 0.037, s4a + 0.047, s4a + 0.069, s4a + 0.081);
    const snapF = pulse(p, s4a + 0.0945, 450);
    const bp = trap(p, s5a + 0.002, s5a + 0.014, s6a - 0.002, s6a + 0.014);
    const grow = easeIO(seg(p, s6a + 0.004, s6a + 0.05));
    const metalIn = seg(p, s6a + 0.045, s6b - 0.007);
    const snapLens = easeIO(seg(p, s6a + 0.038, s6b - 0.005));
    const clickF = pulse(p, s6b - 0.005, 600);
    const tVis = seg(p, s7a + 0.001, s7a + 0.013);
    const tR = easeIO(seg(p, s7a + 0.007, s7a + 0.037));
    const tL = easeIO(seg(p, s7a + 0.023, s7a + 0.057));
    const cR = pulse(p, s7a + 0.037, 500), cL = pulse(p, s7a + 0.057, 500);
    const engBoost = trap(p, 0.55, 0.558, 0.576, 0.59);
    const xr = trap(p, s10a + 0.003, s10a + 0.023, s10b - 0.02, s10b - 0.002);
    const d11 = seg(p, s11a + 0.002, s11b - 0.002);
    const amt11 = trap(p, s11a, s11a + 0.013, s11b - 0.018, s11b + 0.004);
    const e12 = seg(p, s12a, s12b);
    const amt12 = trap(p, s12a, s12a + 0.012, s12b - 0.01, s12b + 0.012);
    const s13t = easeIO(seg(p, s13a, s13b - 0.008));
    const m14 = easeIO(seg(p, s14a, 1));
    const finalFlash = pulse(p, s14a + 0.004, 120);
    const finalSweepT = easeIO(seg(p, s14a + 0.002, s14a + 0.034));
    const finalSweep = trap(p, s14a, s14a + 0.008, s14a + 0.026, s14a + 0.042);

    // ---- glasses group
    const liftS13 = easeIO(seg(p, s13a + 0.003, s13a + 0.036));
    const stage12Fit = lerp(1, 0.82, easeIO(seg(p, s12a, s12a + 0.025)));
    const compactViewport = vw < 600 || vw / Math.max(1, vh) < 0.72;
    const bob = Math.sin(time * 0.5) * 1.1 * (1 - 0.85 * Math.max(liftS13, m14));
    const finalReveal = Math.max(liftS13, m14);
    G.position.x = (compactViewport ? 0 : 46) * amt11 * (1 - finalReveal)
      + (compactViewport ? 0 : 24) * amt12 * (1 - finalReveal)
      - (compactViewport ? 15 * finalReveal : 0);
    G.position.y = 10 + bob + 28 * liftS13 - 3 * m14;
    const finalScaleGain = compactViewport ? 0.005 : 0.015;
    const mobileFinalFit = 1;
    const gs = (stage12Fit - 0.03 * liftS13 + finalScaleGain * m14) * mobileFinalFit * (1 + 0.03 * snapF + 0.015 * clickF);
    G.scale.setScalar(gs);
    G.rotation.y = -0.34 * easeIO(e12) * (1 - s13t)
      - 0.2 * s13t * (1 - finalSweepT)
      - (compactViewport ? 0.32 * finalReveal : 0.01 * m14)
      + Math.sin(time * 0.3) * 0.008;
    G.rotation.x = -0.03 + 0.012 * m14;
    G.rotation.z = Math.sin(time * 0.22) * 0.0025 * m14;

    // ---- lens groups float / assemble
    const zf = lerp(26, 0.6, snapLens) + LOZ;
    lensGroupL.position.set(-LOX, 0, zf); lensGroupR.position.set(LOX, 0, zf);
    const rotY = Math.sin(polT * Math.PI) * 0.45;
    lensGroupL.rotation.y = -rotY; lensGroupR.rotation.y = rotY;
    layerRootL.position.copy(lensGroupL.position); layerRootR.position.copy(lensGroupR.position);

    // raw -> polished -> tinted (G15 sunglass)
    const tintAmt = seg(p, s6a + 0.02, s6b - 0.02);
    M.lens.roughness = lerp(0.16, 0.035, polT) + 0.015 * tintAmt;
    M.lens.clearcoatRoughness = lerp(0.24, 0.025, polT);
    M.lens.thickness = lerp(2.4, 4.8, tintAmt);
    M.lens.attenuationDistance = lerp(80, 6.8, tintAmt);
    const dark = lerp(0, chainNum(DARK11, d11), amt11);
    M.lens.color.copy(lensClear).lerp(lensG15, tintAmt).lerp(lensDark, dark);
    M.lens.transmission = (lerp(0.88, 0.91, polT) - 0.45 * dark) * (1 - 0.55 * tintAmt);
    M.lens.envMapIntensity = 1.4 + 0.55 * tintAmt;
    const realOp = 1 - layerVis;
    M.lens.opacity = realOp * (1 - 0.65 * bp) * (1 - 0.5 * xr);
    lensL.visible = lensR.visible = realOp > 0.002;
    M.glassEdge.opacity = realOp * lerp(0.58, 0.22, tintAmt) * (1 - 0.55 * xr);
    bevelL.visible = bevelR.visible = realOp > 0.002;
    const reflectionOpacity = realOp * lerp(0.13, 0.24, tintAmt) * (1 - 0.8 * bp) * (1 - 0.7 * xr);
    reflectionMatL.opacity = reflectionMatR.opacity = reflectionOpacity;
    reflectionL.visible = reflectionR.visible = reflectionOpacity > 0.003;
    const toneOpacity = realOp * tintAmt * 0.34 * (1 - 0.75 * bp) * (1 - 0.82 * xr);
    M.lensTone.opacity = toneOpacity;
    lensToneL.visible = lensToneR.visible = toneOpacity > 0.003;

    // scrap ring
    const scrapOn = p < s2b + 0.03;
    scrapL.visible = scrapR.visible = scrapOn && dropT < 0.999;
    if (scrapOn) {
      const dy = -95 * dropT * dropT;
      scrapL.position.y = dy; scrapR.position.y = dy;
      scrapL.rotation.z = 0.35 * dropT; scrapR.rotation.z = -0.35 * dropT;
      M.scrap.opacity = 1 - outCubic(dropT);
    }

    // molten edge
    edgeL.visible = edgeR.visible = heat > 0.003;
    if (edgeL.visible) {
      const f = ct * N;
      [edgeL, edgeR].forEach((edge) => {
        const col = edge.geometry.attributes.color;
        for (let i = 0; i < N; i++) {
          let h = 0;
          if (i <= f) h = Math.exp(-(f - i) * 0.06);
          const r = lerp(laserCol.r, 1, 0.72) * h * heat * 1.35;
          const g = lerp(laserCol.g, 1, 0.72) * h * heat * 1.35;
          const b = lerp(laserCol.b, 1, 0.72) * h * heat * 1.35;
          col.setXYZ(i, r, g, b);
        }
        col.needsUpdate = true;
      });
    }

    // lasers
    emitters.visible = laserVis > 0.01;
    const cutting = laserVis > 0.4 && ct > 0.001 && ct < 0.999;
    if (emitters.visible) emitters.children.forEach((g) => g.scale.setScalar(0.4 + 0.6 * laserVis));
    if (cutting) {
      const wR = lensGroupR.localToWorld(frontLocal(ct * N, 1)).clone();
      const wL = lensGroupL.localToWorld(frontLocal(ct * N, -1)).clone();
      const flick = 0.72 + 0.22 * Math.sin(time * 42) * Math.random();
      const targets = [wR, wL, Math.sin(time * 1.7) > 0 ? wR : wL];
      beams.forEach((b, i) => { b.core.visible = b.halo.visible = true; aimBeam(b, emitterStarts[i], targets[i]); });
      beamMatCore.opacity = 1.0 * flick;
      beamMatHalo.opacity = 0.34 * flick;
      glowR.visible = glowGL.visible = true;
      glowR.position.copy(wR); glowGL.position.copy(wL);
      glowR.material.opacity = glowGL.material.opacity = 1.0 * flick;
      for (let k = 0; k < 5; k++) { spawnSpark(wR); spawnSpark(wL); }
      smokes.forEach((s, i) => {
        const t = (time * 0.22 + i / 5) % 1;
        s.visible = true;
        s.position.copy(i % 2 ? wL : wR);
        s.position.y += t * 26; s.position.x += Math.sin(t * 5 + i) * 3;
        s.material.opacity = 0.06 * Math.sin(Math.PI * t) * laserVis;
        s.scale.setScalar(9 + t * 20);
      });
    } else {
      beams.forEach((b) => { b.core.visible = b.halo.visible = false; });
      glowR.visible = glowGL.visible = false;
      beamMatCore.opacity = beamMatHalo.opacity = 0;
      smokes.forEach((s) => (s.visible = false));
    }
    // sparks physics
    let anySpark = false;
    for (let i = 0; i < SPN; i++) {
      if (spLife[i] > 0) {
        spLife[i] -= dt; anySpark = true;
        spPos[i * 3] += spVel[i * 3] * dt;
        spPos[i * 3 + 1] += spVel[i * 3 + 1] * dt;
        spPos[i * 3 + 2] += spVel[i * 3 + 2] * dt;
        spVel[i * 3 + 1] -= 150 * dt;
        if (spLife[i] <= 0) { spPos[i * 3] = spPos[i * 3 + 1] = spPos[i * 3 + 2] = -9999; }
      }
    }
    sparks.visible = anySpark;
    if (anySpark) spGeo.attributes.position.needsUpdate = true;

    // polishing pads + dust
    M.padTool.opacity = padVis;
    M.polishedSteel.opacity = padVis;
    pads.forEach((m, i) => {
      m.visible = padVis > 0.01;
      if (!m.visible) return;
      const front = i % 2 === 0;
      const ang = polT * 22 + time * 0.8 + (front ? 0 : Math.PI * 0.7);
      m.position.set(Math.cos(ang) * 8.5, Math.sin(ang) * 7, front ? 3.6 : -3.6);
      m.scale.setScalar(0.3 + 0.7 * padVis);
      m.children[0].rotation.z = time * (front ? 14 : -14);
    });
    dustL.material.opacity = dustR.material.opacity = 0.5 * padVis * (1 - polT);

    // optical layers
    layerRootL.visible = layerRootR.visible = layerVis > 0.002;
    if (layerRootL.visible) {
      layerMats.forEach((mat, i) => {
        const dim = hl < 0 || hl === i ? 1 : 0.28;
        mat.opacity = mat.userData.baseOp * layerVis * dim;
        mat.emissiveIntensity = hl === i ? 0.9 : 0.35;
      });
      for (let i = 0; i < 7; i++) {
        const z = (3 - i) * sepU;
        layerRootL.children[i].position.z = z;
        layerRootR.children[i].position.z = z;
      }
    }
    const flashOpacity = Math.max(snapF * 0.7, finalFlash * 0.42);
    flash.visible = flashOpacity > 0.02;
    flash.material.opacity = flashOpacity;

    // blueprint
    const bpOp = Math.max(bp, xr * 0.35);
    frameEdges.visible = bpOp > 0.003; bpMat.opacity = bpOp;
    grid.visible = bp > 0.003; gridMat.opacity = bp * 0.55;

    // frame acetate
    frameMesh.visible = grow > 0.002;
    frameMesh.scale.set(1, 1, lerp(0.06, 1, grow));
    M.acetateF.opacity = grow * (1 - 0.93 * xr);
    M.acetateF.transparent = grow < 1 || xr > 0.001;
    M.acetateEdge.opacity = grow * (1 - 0.9 * xr);
    M.acetateF.emissive.copy(M.frameEmissive);
    M.acetateF.emissiveIntensity = 0.3 * clickF + 0.1 * snapF;
    M.goldF.opacity = metalIn * (1 - 0.45 * xr);
    M.hardwareDark.opacity = Math.max(metalIn, tVis) * (1 - 0.55 * xr);
    knL.visible = knR.visible = metalIn > 0.01;
    hingeDetailGroups.forEach((hinge) => (hinge.visible = metalIn > 0.01));
    frontRivets.forEach((part) => (part.visible = metalIn > 0.01));
    padArmL.visible = padArmR.visible = metalIn > 0.01;
    M.pad.opacity = metalIn * 0.92 * (1 - 0.6 * xr);
    npL.visible = npR.visible = metalIn > 0.01;
    screwL.position.y = screwSlotL.position.y = 12 + (1 - tL) * 9;
    screwR.position.y = screwSlotR.position.y = 12 + (1 - tR) * 9;
    screwSlotL.rotation.z = -TAU * 2.5 * tL;
    screwSlotR.rotation.z = TAU * 2.5 * tR;

    // temples
    templeParts.templeVis = tVis;
    templeR.visible = templeL.visible = tVis > 0.005;
    M.acetateT.opacity = tVis * (1 - 0.93 * xr);
    M.acetateT.transparent = tVis < 1 || xr > 0.001;
    M.goldT.opacity = tVis * (1 - 0.45 * xr);
    M.coreSubtle.opacity = tVis * (0.17 + 0.15 * engBoost) * (1 - xr);
    engMat.opacity = tVis * (0.18 + 0.82 * engBoost) * (1 - 0.6 * xr);
    templeR.position.set(HGX + (1 - tR) * 26, 12 + (1 - tR) * 9, HGZ - (1 - tR) * 18);
    templeL.position.set(-HGX - (1 - tL) * 26, 12 + (1 - tL) * 9, HGZ - (1 - tL) * 18);
    templeR.rotation.y = -1.25 * (1 - tR);
    templeL.rotation.y = 1.25 * (1 - tL);
    templeR.scale.setScalar(1 + 0.05 * cR);
    templeL.scale.setScalar(1 + 0.05 * cL);

    // x-ray cores
    browCore.visible = tCoreR.visible = tCoreL.visible = xr > 0.01;
    M.core.opacity = xr;

    // lens demo overlays
    const blueAmt = lerp(0, chainNum(BLUE11, d11), amt11);
    blueMat.opacity = blueAmt * 0.1 * (0.72 + 0.28 * Math.sin(time * 2.2));
    blueL.visible = blueR.visible = blueMat.opacity > 0.004;
    let glareOp = 0;
    if (amt11 > 0.01) {
      const f4 = d11 * 4;
      if (f4 > 3) glareOp = (1 - smooth(clamp(f4 - 3, 0, 1))) * 0.18 * amt11;
    }
    if (finalSweep > 0.001) {
      glare.position.x = lerp(-58, 58, finalSweepT);
      glare.position.y = 5;
      glareOp = Math.max(glareOp, finalSweep * 0.09);
    } else {
      glare.position.x = 0;
      glare.position.y = 4;
    }
    glare.material.opacity = glareOp;
    glare.visible = glareOp > 0.004;

    // background arc (dark atelier -> warm reveal)
    evalBg(p, bgWork);
    scene.background.copy(bgWork);
    scene.fog.color.copy(bgWork);
    const bgLum = 0.299 * bgWork.r + 0.587 * bgWork.g + 0.114 * bgWork.b;

    const darkF = clamp((0.42 - bgLum) / 0.34, 0, 1);
    let keyI = 2.4 + 0.5 * padVis + 0.4 * s13t + 0.5 * laserVis + 0.32 * m14;
    if (amt11 > 0) keyI = lerp(keyI, chainNum(KEYI11, d11) + 1.3, amt11);
    key.intensity = keyI;
    key.color.copy(keyBaseCol);
    if (amt12 > 0) key.color.lerp(chain(KEYC12, e12), amt12);
    rim.intensity = 1.0 + 0.9 * darkF + 0.6 * xr + 0.35 * m14;
    fill.intensity = 0.44 - 0.16 * darkF;
    hemi.intensity = 0.5 - 0.15 * darkF;
    detailLight.intensity = 9 + 8 * metalIn + 5 * engBoost + 7 * s13t + 4 * m14;

    // shadows + particles. The hero should sell the eyewear, not a pedestal.
    const fabricationBench = trap(p, -0.01, 0.01, s4b - 0.012, s5a + 0.01);
    const assemblyBench = trap(p, s6a - 0.012, s6a + 0.01, s7b - 0.008, s8a + 0.012);
    const finalBench = seg(p, s13a - 0.008, s13a + 0.028);
    const platformVis = Math.max(fabricationBench, assemblyBench, finalBench);
    platform.visible = platformVis > 0.002;
    platform.position.y = lerp(-20, 5, Math.max(liftS13, m14));
    M.platform.opacity = 0;
    M.platformTop.opacity = 0;
    ringMat.opacity = 0;
    outerGrooveMat.opacity = 0;
    dash.material.opacity = 0;
    ringMat.emissiveIntensity = 0;
    dash.rotation.y = time * 0.05;
    shadow.material.opacity = platformVis * (0.1 + 0.08 * seg(p, s6a, s6b) + 0.06 * m14);
    particles.rotation.y = time * 0.015;
    pMat.opacity = 0.24 + 0.16 * trap(p, s13a, s13a + 0.025, s13b, s14b);

    // camera
    evalCam(p);
    if (compactViewport) {
      camPos.x = lerp(camPos.x, 10, finalReveal);
      camPos.z = lerp(camPos.z, 248, finalReveal);
      camTgt.x = lerp(camTgt.x, 0, finalReveal);
    }
    camPos.x += Math.sin(time * 0.21) * 0.5;
    camPos.y += Math.sin(time * 0.17 + 2) * 0.4;
    camera.position.copy(camPos);
    camera.lookAt(camTgt);

    if (composer) composer.render(); else renderer.render(scene, camera);
    return { m14, layerT, bgLum };
  }

  // ------------------------------------------------------------- anchors
  function projLocal(obj, x, y, z) {
    V.set(x, y, z);
    obj.localToWorld(V);
    V.project(camera);
    return { x: (V.x * 0.5 + 0.5) * vw, y: (0.5 - V.y * 0.5) * vh, ok: V.z < 1 && V.z > -1 };
  }
  function getAnchors() {
    const out = {};
    for (let i = 0; i < 7; i++) out['layer' + i] = projLocal(layerMeshesR[i], 18, 4, 0);
    out.c1 = projLocal(G, 0, 22, 2);
    out.c2 = projLocal(templeR, 0, 2, -62);
    out.c3 = projLocal(G, -52, -13, 3);
    out.c4 = projLocal(G, 38, -6, 5);
    out.c5 = projLocal(G, -33.5, 2, 5);
    out.c6 = projLocal(G, 0, -9, 6);
    out.dw1 = projLocal(G, -65, 31, 0); out.dw2 = projLocal(G, 65, 31, 0);
    out.db1 = projLocal(G, -9, 0, 4); out.db2 = projLocal(G, 9, 0, 4);
    out.dl1 = projLocal(G, 8, -27, 0); out.dl2 = projLocal(G, 59, -27, 0);
    out.core = projLocal(G, 0, 17, 1);
    out.hinge = projLocal(G, knX, 12, knZ);
    out.eng = projLocal(templeR, 0, 1.2, -44);
    out.nose = projLocal(G, 8.8, -7.5, 3);
    out.lens = projLocal(G, 33.5, 0, 4);
    out.bevel = projLocal(G, -52, -13, 3);
    return out;
  }

  // ------------------------------------------------------------- api
  function resize() {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    vw = w; vh = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 600 ? 60 : camera.aspect < 0.72 ? 60 : camera.aspect < 1 ? 44 : 33;
    camera.updateProjectionMatrix();
    if (composer) composer.setSize(w, h);
  }
  resize();

  // cinematic bloom (post-processing) — loads async; silently falls back to direct render
  (async function initPost() {
    try {
      const [ec, rp, ub, op] = await Promise.all([
        import('three/addons/postprocessing/EffectComposer.js'),
        import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/UnrealBloomPass.js'),
        import('three/addons/postprocessing/OutputPass.js'),
      ]);
      if (disposed) return;
      const dpr = renderer.getPixelRatio();
      const rt = new THREE.WebGLRenderTarget(
        Math.max(1, Math.floor(vw * dpr)), Math.max(1, Math.floor(vh * dpr)),
        { type: THREE.UnsignedByteType, samples: 4 } // UnsignedByte: NaN-proof — HalfFloat let NaNs from spec highlights blow up bloom mips into giant black rectangles
      );
      const c = new ec.EffectComposer(renderer, rt);
      c.addPass(new rp.RenderPass(scene, camera));
      bloomPass = new ub.UnrealBloomPass(new THREE.Vector2(vw, vh), 0.3, 0.5, 0.93);
      c.addPass(bloomPass);
      c.addPass(new op.OutputPass());
      c.setSize(vw, vh);
      composer = c;
    } catch (e) { composer = null; }
  })();

  return {
    frame, getAnchors, resize,
    highlightLayer(i) { hl = i; },
    setBrand(b) { brand = b || 'AURIC'; drawEngraving(); },
    setFrameColor(hex) {
      frameCol.set(hex);
      M.acetateF.color.copy(frameCol); M.acetateT.color.copy(frameCol);
      M.frameEmissive = frameCol.clone().lerp(white, 0.35);
    },
    setLaser(hex) {
      laserCol.set(hex);
      ringMat.emissive.copy(laserCol);
      beamMatCore.color.copy(laserCol); beamMatHalo.color.copy(laserCol);
      tips.forEach((t) => t.material.color.copy(laserCol));
      glowR.material.color.copy(laserCol); glowGL.material.color.copy(laserCol);
      spMat.color.copy(laserCol.clone().lerp(white, 0.4));
    },
    dispose() {
      disposed = true;
      if (composer) composer.dispose();
      renderer.dispose();
      pmrem.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    },
  };
}
