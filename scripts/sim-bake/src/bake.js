// Offline bake of one scene: a real panorama plus path-traced near objects lit by that same panorama.
// Output: tone-mapped plate (RGBA8) and a data map: R vergence, G highlight headroom, B what a polariser removes.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { WebGLPathTracer } from 'three-gpu-pathtracer';
import { clusterScreen, directionSign, gantrySign, grainNormal, loadFonts, monitorScreen, navScreen, phoneScreen, printedPage } from './paint.js';

const q = new URLSearchParams(location.search);
const id = q.get('scene') || 'street';
const W = +(q.get('w') || 2048);
const SPP = +(q.get('spp') || 200);
const RES = q.get('hdri') || '8k';
const tag = q.get('tag') || id;
const TAN = { x: 0.9, y: 0.7 }; // the plate's half-extent, as tangents
const H = Math.round((W * TAN.y) / TAN.x);
const VMAX = 6;
const log = (...a) => console.log(...a);

const deg = THREE.MathUtils.degToRad;
const std = (o) => new THREE.MeshStandardMaterial(o);

function at(o, x, y, z, rx = 0, ry = 0, rz = 0) {
  o.position.set(x, y, z);
  o.rotation.order = 'YXZ';
  o.rotation.set(rx, ry, rz);
  return o;
}

const texLoader = new THREE.TextureLoader();
async function pbr(slug, repeatX, repeatY, extra = {}) {
  const load = async (name, srgb) => {
    const t = await texLoader.loadAsync(`/assets/props/${slug}/textures/${slug}_${name}_2k.jpg`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
    t.anisotropy = 16;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const map = await load('diff', true);
  const arm = await load('arm', false).catch(() => load('rough', false));
  const nor = await load('nor_gl', false).catch(() => null);
  return std({ map, roughnessMap: arm, metalnessMap: arm, metalness: 1, roughness: 1, normalMap: nor, ...extra });
}

const gltfCache = new Map();
async function prop(slug) {
  if (!gltfCache.has(slug)) gltfCache.set(slug, await new GLTFLoader().loadAsync(`/assets/props/${slug}/${slug}_2k.gltf`));
  return gltfCache.get(slug).scene;
}
async function part(slug, name) {
  const root = await prop(slug);
  const node = root.getObjectByName(name);
  if (!node) throw new Error(`no node ${name} in ${slug}`);
  const c = node.clone();
  c.position.set(0, 0, 0);
  return c;
}

/** Emissive screen behind a glass surface: it glows and still reflects the world. */
function screenMat(map, level) {
  return new THREE.MeshPhysicalMaterial({ color: '#050505', roughness: 0.06, metalness: 0, ior: 1.5, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: level });
}

function phone(level) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new RoundedBoxGeometry(0.078, 0.16, 0.0085, 6, 0.0035), std({ color: '#191a1d', roughness: 0.35, metalness: 0.7 })));
  g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.0725, 0.1525), screenMat(phoneScreen(), level)), 0, 0, 0.0044));
  return g;
}

/** A sloped reading stand: back board, lip and a foot, so that the page is really held by something. */
function readingStand(w, h, tilt, mat) {
  const g = new THREE.Group();
  const t = 0.006;
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(w, h, t, 3, 0.002), mat), 0, 0, -t / 2 - 0.0015));
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(w, 0.014, 0.018, 3, 0.003), mat), 0, -h / 2 + 0.002, 0.006));
  const depth = Math.max(0.03, Math.sin(tilt) * h * 0.9);
  const wedge = new THREE.Mesh(new RoundedBoxGeometry(w * 0.72, h * 0.5, depth, 3, 0.004), mat);
  wedge.position.set(0, -h * 0.12, -t - 0.0015 - depth / 2);
  g.add(wedge);
  return g;
}

/** Height-field surface over (x, z) in metres, with UVs in metres. */
function surface(nx, nz, x0, x1, z0, z1, fn) {
  const geo = new THREE.BufferGeometry();
  const pos = [];
  const uv = [];
  const idx = [];
  for (let j = 0; j <= nz; j += 1) {
    for (let i = 0; i <= nx; i += 1) {
      const x = x0 + ((x1 - x0) * i) / nx;
      const z = z0 + ((z1 - z0) * j) / nz;
      pos.push(x, fn(x, z), z);
      uv.push(x, z);
    }
  }
  for (let j = 0; j < nz; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const a = j * (nx + 1) + i;
      const b = a + 1;
      const c = a + nx + 1;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

async function coffeeCup() {
  const g = new THREE.Group();
  const cup = await part('tea_set_01', 'tea_set_01_cup_small_01');
  const saucer = await part('tea_set_01', 'tea_set_01_saucer_circular_04');
  cup.position.y = 0.0105;
  g.add(saucer, cup);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.0385, 48), new THREE.MeshPhysicalMaterial({ color: '#2a170b', roughness: 0.08, ior: 1.33 }));
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.set(0, 0.0105 + 0.052, 0);
  g.add(coffee);
  return g;
}

// ------------------------------------------------------------------------------------------------- street: café table
async function street(rig, exposure) {
  const y = -0.3; // the table top, below the eye
  const tableTop = await pbr('oak_veneer_01', 1, 1);
  tableTop.metalnessMap = null;
  tableTop.metalness = 0;
  tableTop.roughness = 0.75;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.49, 0.49, 0.026, 128), tableTop);
  rig.add(at(top, 0, y - 0.013, -0.58));
  const uvTop = top.geometry.attributes.uv;
  const pos = top.geometry.attributes.position;
  for (let i = 0; i < pos.count; i += 1) uvTop.setXY(i, pos.getX(i) * 0.95 + 0.5, pos.getZ(i) * 0.95 + 0.5);

  const wood = std({ color: '#3a2a1e', roughness: 0.55 });
  // the page on its stand
  const tilt = deg(11);
  const page = new THREE.Group();
  page.add(new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.26), std({ map: printedPage('Sa larg shihni?'), roughness: 0.62 })));
  page.add(readingStand(0.205, 0.275, tilt, wood));
  rig.add(at(page, -0.17, y + 0.03, -0.44, -(Math.PI / 2 - tilt), 0.3, 0));
  // the phone on a small dock
  const dock = new THREE.Group();
  dock.add(at(phone(0.72 / exposure), 0, 0, 0.0045));
  dock.add(readingStand(0.07, 0.155, deg(58), std({ color: '#2a2b2e', roughness: 0.45, metalness: 0.5 })));
  rig.add(at(dock, 0.07, y + 0.066, -0.41, -deg(32), -0.12, 0));
  // coffee further away
  const cup = await coffeeCup();
  rig.add(at(cup, 0.3, y, -0.7, 0, 2.4, 0));
  const sign = new THREE.Group();
  const board = new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.85, 0.03, 3, 0.01), std({ color: '#d9dcdf', roughness: 0.4, metalness: 0.7 }));
  sign.add(board);
  sign.add(at(new THREE.Mesh(new THREE.PlaneGeometry(1.68, 0.83), std({ map: directionSign(), roughness: 0.42 })), 0, 0, 0.0165));
  sign.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.1, 20), std({ color: '#6f7377', roughness: 0.45, metalness: 0.8 })), -0.5, -1.25, -0.05));
  sign.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.1, 20), std({ color: '#6f7377', roughness: 0.45, metalness: 0.8 })), 0.5, -1.25, -0.05));
  rig.add(at(sign, -8.5, 1.2, -20, 0, 0.32, 0));
}

// ------------------------------------------------------------------------------------------------- drive: driver's seat
async function drive(rig, exposure) {
  const grain = grainNormal(7, 512, 0.6);
  grain.repeat.set(9, 9);
  const dashMat = std({ color: '#2e2f32', roughness: 0.66, normalMap: grain, normalScale: new THREE.Vector2(0.35, 0.35) });
  const trim = std({ color: '#37383c', roughness: 0.5, normalMap: grain, normalScale: new THREE.Vector2(0.2, 0.2) });
  const gloss = new THREE.MeshPhysicalMaterial({ color: '#0a0a0b', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04 });

  // dashboard: a broad pad that falls towards the driver and at both sides
  const dash = surface(80, 40, -1.25, 1.25, -1.2, -0.5, (x, z) => {
    const t = (z + 1.2) / 0.7;
    return -0.255 - 0.05 * (x / 1.25) * (x / 1.25) - 0.045 * t * t * t;
  });
  rig.add(new THREE.Mesh(dash, dashMat));
  // the face below the pad
  const face = surface(40, 8, -1.25, 1.25, -0.5, -0.3, (x, z) => -0.3 - 0.05 * (x / 1.25) * (x / 1.25) - ((z + 0.5) / 0.2) * 0.6);
  rig.add(new THREE.Mesh(face, dashMat));

  // the bonnet beyond the windscreen: painted, so it reflects the sky
  const paint = new THREE.MeshPhysicalMaterial({ color: '#20262c', metalness: 0.55, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.025 });
  const bonnet = surface(80, 40, -1.15, 1.15, -3.0, -1.15, (x, z) => {
    const t = (-z - 1.15) / 1.85;
    return -0.3 - 0.02 * t - 0.17 * t * t - 0.1 * Math.pow(Math.abs(x) / 1.15, 3) + 0.012 * Math.exp(-Math.pow((Math.abs(x) - 0.42) / 0.05, 2));
  });
  rig.add(new THREE.Mesh(bonnet, paint));

  // binnacle and cluster
  const cluster = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.096), screenMat(clusterScreen(), 0.95 / exposure));
  rig.add(at(cluster, 0, -0.208, -0.69, -deg(8)));
  const hood = surface(30, 10, -0.175, 0.175, -0.74, -0.575, (x, z) => {
    const t = (z + 0.74) / 0.165;
    return -0.122 - 0.006 * t - 0.03 * Math.pow(Math.abs(x) / 0.175, 4);
  });
  rig.add(new THREE.Mesh(hood, trim));
  rig.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.17, 0.04, 4, 0.016), trim), 0, -0.2, -0.725));
  for (const sx of [-1, 1]) {
    rig.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.016, 0.16, 0.16, 3, 0.006), trim), sx * 0.168, -0.2, -0.655));
  }

  // centre screen, turned towards the driver
  const nav = new THREE.Group();
  nav.add(new THREE.Mesh(new RoundedBoxGeometry(0.262, 0.162, 0.014, 4, 0.005), gloss));
  nav.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.144), screenMat(navScreen(), 0.82 / exposure)), 0, 0, 0.0075));
  rig.add(at(nav, 0.33, -0.22, -0.64, -deg(8), -0.42, 0));

  // steering wheel
  const leather = std({ color: '#26272a', roughness: 0.48, normalMap: grain, normalScale: new THREE.Vector2(0.6, 0.6) });
  const wheel = new THREE.Group();
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.017, 20, 96), leather));
  wheel.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.33, 0.04, 0.03, 3, 0.01), trim), 0, 0, 0));
  wheel.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.09, 0.04, 3, 0.014), trim), 0, -0.01, 0.002));
  rig.add(at(wheel, 0, -0.42, -0.47, -deg(24)));

  // pillars, header and doors: they shade the interior as a real car does
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.03, 2.6), std({ color: '#2b2b2c', roughness: 0.92 }));
  rig.add(at(roof, 0, 0.34, 0.85));
  const pillar = (a, b) => {
    const len = a.distanceTo(b);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, len, 16), trim);
    p.position.copy(a).add(b).multiplyScalar(0.5);
    p.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    rig.add(p);
  };
  pillar(new THREE.Vector3(-0.88, -0.28, -1.05), new THREE.Vector3(-0.7, 0.34, -0.42));
  pillar(new THREE.Vector3(1.08, -0.28, -1.05), new THREE.Vector3(0.9, 0.34, -0.42));
  for (const x of [-0.82, 1.05]) rig.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.62, 2.6), std({ color: '#191a1c', roughness: 0.8 })), x, -0.55, 0.3));
  // rear-view mirror: real reflections of the road behind
  const mirror = new THREE.Group();
  mirror.add(new THREE.Mesh(new RoundedBoxGeometry(0.25, 0.075, 0.028, 4, 0.012), std({ color: '#141416', roughness: 0.6 })));
  mirror.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.228, 0.058), std({ color: '#ffffff', roughness: 0.02, metalness: 1 })), 0, 0, 0.0145));
  rig.add(at(mirror, 0.23, 0.135, -0.54, deg(7), -0.2, 0));
  rig.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 12), trim), 0.23, 0.2, -0.55));

  // an overhead sign down the road, for reading at a distance
  const gantry = new THREE.Group();
  gantry.add(new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.34, 0.06), std({ color: '#74787c', roughness: 0.5, metalness: 0.7 })));
  gantry.add(at(new THREE.Mesh(new THREE.PlaneGeometry(4.3, 1.28), std({ map: gantrySign(), roughness: 0.38 })), 0, 0, 0.032));
  for (const x of [-1.5, 1.5]) gantry.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.6, 16), std({ color: '#6c7074', roughness: 0.5, metalness: 0.8 })), x, -2.7, -0.06));
  rig.userData.gantry = gantry;
  rig.add(at(gantry, -3.4, 3.0, -30, 0, 0.06, 0));
}

// ------------------------------------------------------------------------------------------------- desk
async function desk(rig, exposure) {
  const y = -0.36;
  const wood = await pbr('black_walnut_veneer_01', 2.2, 1.1);
  wood.metalnessMap = null;
  wood.metalness = 0;
  wood.roughness = 0.9;
  const top = new THREE.Mesh(new RoundedBoxGeometry(2.4, 0.04, 1.15, 3, 0.006), wood);
  rig.add(at(top, 0, y - 0.02, -0.72));
  const pos = top.geometry.attributes.position;
  const uv = top.geometry.attributes.uv;
  for (let i = 0; i < pos.count; i += 1) uv.setXY(i, pos.getX(i) / 2.4 + 0.5, pos.getZ(i) / 2.4 + 0.5);

  // monitor
  const dark = std({ color: '#141518', roughness: 0.45, metalness: 0.4 });
  const monitor = new THREE.Group();
  monitor.add(new THREE.Mesh(new RoundedBoxGeometry(0.622, 0.362, 0.02, 4, 0.004), dark));
  monitor.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.597, 0.336), screenMat(monitorScreen(), 0.86 / exposure)), 0, 0.006, 0.0105));
  rig.add(at(monitor, 0.14, -0.04, -0.82, -deg(3), -0.1, 0));
  rig.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.26, 0.022, 3, 0.006), dark), 0.14, -0.235, -0.845, deg(-4)));
  rig.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.23, 0.012, 0.17, 3, 0.005), dark), 0.14, y + 0.006, -0.84));

  // printed page on a stand
  const oak = std({ color: '#2b2c2f', roughness: 0.5, metalness: 0.2 });
  const tilt = deg(40);
  const page = new THREE.Group();
  page.add(new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.26), std({ map: printedPage('Pushime të vogla'), roughness: 0.62 })));
  page.add(readingStand(0.205, 0.275, tilt, oak));
  rig.add(at(page, -0.2, y + 0.092, -0.45, -(Math.PI / 2 - tilt), 0.33, 0));

  // phone on a dock
  const dock = new THREE.Group();
  dock.add(at(phone(0.8 / exposure), 0, 0, 0.0045));
  dock.add(readingStand(0.07, 0.155, deg(58), std({ color: '#2a2b2e', roughness: 0.45, metalness: 0.5 })));
  rig.add(at(dock, 0.04, y + 0.066, -0.43, -deg(32), -0.08, 0));

  // keyboard
  const board = new THREE.Group();
  board.add(new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.012, 0.125, 3, 0.004), std({ color: '#c9cacc', roughness: 0.42, metalness: 0.55 })));
  const keyGeo = new RoundedBoxGeometry(0.0165, 0.005, 0.0165, 2, 0.0018);
  const keyMat = std({ color: '#f1f1ef', roughness: 0.48 });
  for (let r = 0; r < 5; r += 1) {
    for (let c = 0; c < 15; c += 1) {
      board.add(at(new THREE.Mesh(keyGeo, keyMat), -0.168 + c * 0.024, 0.008, -0.048 + r * 0.024));
    }
  }
  rig.add(at(board, 0.34, y + 0.008, -0.45, 0, -0.04, 0));
  const notebook = await part('binder_notebook', 'binder_notebook_closed');
  rig.add(at(notebook, -0.56, y, -0.56, 0, 0.35, 0));

  const coffee = await coffeeCup();
  rig.add(at(coffee, 0.62, y, -0.6, 0, 1.1, 0));

  const cupNode = await part('stationery_supplies', 'stationery_supplies_pencilcup');
  cupNode.scale.setScalar(1.15);
  rig.add(at(cupNode, -0.5, y + 0.04, -0.9));

  const plant = new THREE.Group();
  for (const n of ['potted_plant_02_pot', 'potted_plant_02_leaves', 'potted_plant_02_dirt']) {
    const node = await part('potted_plant_02', n);
    const src = (await prop('potted_plant_02')).getObjectByName(n);
    node.position.copy(src.position);
    plant.add(node);
  }
  plant.scale.setScalar(0.55);
  rig.add(at(plant, -0.75, y, -1.05, 0, 0.6, 0));

}

const SCENES = {
  street: { slug: 'urban_street_04', heading: 222, pitch: -13, exposure: 1.15, build: street, ground: 1.2, far: 0.03 },
  drive: { slug: 'leibstadt', heading: 228, pitch: -6, exposure: 0.62, build: drive, ground: 1.25, far: 0.0 },
  desk: { slug: 'poly_haven_studio', heading: 58, pitch: -12, exposure: 0.8, build: desk, ground: 1.15, far: 0.24 },
};

function neutral(c) {
  const startCompression = 0.8 - 0.04;
  const desaturation = 0.15;
  const x = Math.min(c[0], c[1], c[2]);
  const offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  c[0] -= offset;
  c[1] -= offset;
  c[2] -= offset;
  const peak = Math.max(c[0], c[1], c[2]);
  if (peak < startCompression) return c;
  const d = 1 - startCompression;
  const newPeak = 1 - (d * d) / (peak + d - startCompression);
  const k = newPeak / peak;
  c[0] *= k;
  c[1] *= k;
  c[2] *= k;
  const g = 1 - 1 / (desaturation * (peak - newPeak) + 1);
  c[0] += (newPeak - c[0]) * g;
  c[1] += (newPeak - c[1]) * g;
  c[2] += (newPeak - c[2]) * g;
  return c;
}
const toSrgb = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

async function save(name, bytes) {
  const r = await fetch(`/save/${name}`, { method: 'POST', body: bytes });
  if (!r.ok) throw new Error('save failed');
}

async function main() {
  await loadFonts();
  const cfg = SCENES[id];
  const canvas = document.getElementById('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.NoToneMapping;

  const hdr = await new HDRLoader().setDataType(THREE.FloatType).loadAsync(`/assets/hdri/${cfg.slug}_${RES}.hdr`);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  hdr.minFilter = hdr.magFilter = THREE.LinearFilter;
  log('hdri', hdr.image.width, hdr.image.height);

  const scene = new THREE.Scene();
  scene.environment = hdr;
  scene.background = hdr;
  const rig = new THREE.Group();
  rig.rotation.y = deg(cfg.heading);
  scene.add(rig);
  await cfg.build(rig, cfg.exposure);
  const camera = new THREE.PerspectiveCamera(2 * THREE.MathUtils.radToDeg(Math.atan(TAN.y)), TAN.x / TAN.y, 0.05, 2000);
  camera.rotation.x = deg(cfg.pitch);
  rig.add(camera);
  scene.updateMatrixWorld(true);

  // vergence of the near objects (dioptres, along the ray)
  const vergMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    vertexShader: 'varying vec3 vP; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vP = mv.xyz; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec3 vP; void main(){ gl_FragColor = vec4(1.0/length(vP), 1.0, 0.0, 1.0); }',
  });
  const vergRt = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, samples: 0 });
  const vergScene = new THREE.Scene();
  vergScene.overrideMaterial = vergMat;
  const holder = new THREE.Group();
  vergScene.add(holder);
  // keep the path tracer's scene intact: render a shallow copy of the rig
  const clone = rig.clone(true);
  holder.add(clone);
  vergScene.updateMatrixWorld(true);
  renderer.setRenderTarget(vergRt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  const cam2 = camera.clone();
  cam2.matrixWorld.copy(camera.matrixWorld);
  cam2.matrixWorldInverse.copy(camera.matrixWorldInverse);
  cam2.matrixAutoUpdate = false;
  cam2.matrixWorldAutoUpdate = false;
  renderer.render(vergScene, cam2);
  const verg = new Float32Array(W * H * 4);
  renderer.readRenderTargetPixels(vergRt, 0, 0, W, H, verg);
  renderer.setRenderTarget(null);
  log('vergence ok');

  const pt = new WebGLPathTracer(renderer);
  pt.renderToCanvas = false;
  pt.renderDelay = 0;
  pt.minSamples = 0;
  pt.fadeDuration = 0;
  pt.bounces = 7;
  pt.filterGlossyFactor = 0.25;
  pt.multipleImportanceSampling = true;
  pt.tiles.set(+(q.get('tiles') || 3), +(q.get('tiles') || 3));
  pt.textureSize.set(2048, 2048);
  pt.setScene(scene, camera);
  log('scene ready');
  const t0 = performance.now();
  let lastLog = 0;
  const probe = new Float32Array(4);
  while (pt.samples < SPP) {
    pt.renderSample();
    // wait for the GPU: left to pile up, the queue ends in a lost context at the final readback
    renderer.readRenderTargetPixels(pt.target, 0, 0, 1, 1, probe);
    await new Promise((r) => setTimeout(r, 0));
    if (performance.now() - lastLog > 15000) {
      lastLog = performance.now();
      log(`samples ${pt.samples.toFixed(1)} / ${SPP} after ${((performance.now() - t0) / 1000).toFixed(0)} s`);
    }
  }
  log(`traced ${SPP} spp in ${((performance.now() - t0) / 1000).toFixed(0)} s`);

  const px = new Float32Array(W * H * 4);
  renderer.readRenderTargetPixels(pt.target, 0, 0, W, H, px);

  const plate = new Uint8Array(W * H * 4);
  const data = new Uint8Array(W * H * 4);
  const c = [0, 0, 0];
  const dir = new THREE.Vector3();
  const pitch = deg(cfg.pitch);
  const sp = Math.sin(pitch);
  const cp = Math.cos(pitch);
  for (let yy = 0; yy < H; yy += 1) {
    const fy = H - 1 - yy; // float buffers are bottom-up
    const ty = ((fy + 0.5) / H - 0.5) * 2 * TAN.y;
    for (let xx = 0; xx < W; xx += 1) {
      const i = (fy * W + xx) * 4;
      const o = (yy * W + xx) * 4;
      const e = cfg.exposure;
      const r = px[i] * e;
      const g = px[i + 1] * e;
      const b = px[i + 2] * e;
      c[0] = r;
      c[1] = g;
      c[2] = b;
      neutral(c);
      plate[o] = Math.round(255 * toSrgb(Math.min(1, Math.max(0, c[0]))));
      plate[o + 1] = Math.round(255 * toSrgb(Math.min(1, Math.max(0, c[1]))));
      plate[o + 2] = Math.round(255 * toSrgb(Math.min(1, Math.max(0, c[2]))));
      plate[o + 3] = 255;

      const lumIn = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const lumOut = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      const headroom = Math.log2(Math.max(1, lumIn / Math.max(lumOut, 0.02))) / 5; // up to 32 times the white of the plate

      // world elevation of this pixel (the pixel's ray, in rig space)
      const tx = ((xx + 0.5) / W - 0.5) * 2 * TAN.x;
      const ry = ty * cp + -1 * sp * -1; // y of (tx, ty, -1) after the pitch rotation
      const rz = ty * sp - cp;
      const len = Math.hypot(tx, ry, rz);
      const fg = verg[i + 1] > 0.5;
      let v;
      let polar = 0;
      if (fg) {
        v = verg[i];
      } else if (ry / len < -0.002) {
        v = Math.min(cfg.far + (-ry / len) / cfg.ground, VMAX); // the ground below the eye
        polar = Math.min(1, Math.max(0, (lumOut - 0.16) / 0.5)) * 0.9; // road sheen
      } else {
        v = cfg.far;
        polar = Math.min(1, Math.max(0, (lumOut - 0.5) / 0.35)) * 0.55; // bright sky
      }
      data[o] = Math.round((255 * Math.min(v, VMAX)) / VMAX);
      data[o + 1] = Math.round(255 * Math.min(1, headroom));
      data[o + 2] = Math.round(255 * polar);
      data[o + 3] = 255;
    }
  }
  void dir;
  await save(`${tag}-plate.raw`, plate);
  await save(`${tag}-data.raw`, data);
  await save(`${tag}-size.json`, JSON.stringify({ W, H, exposure: cfg.exposure, heading: cfg.heading, pitch: cfg.pitch, spp: SPP }));
  log('saved');
  window.__done = true;
}

main().catch((e) => {
  console.error('BAKE FAILED', e && e.stack ? e.stack : e);
  window.__failed = String(e);
});
