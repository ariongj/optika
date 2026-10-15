// PBR materials + canvas textures for the smart-glasses model.
import * as THREE from 'three';
import type { SmartColorway, SmartVariant } from './types';

export const MINT = new THREE.Color('#57e6aa');
export const LED_WHITE = new THREE.Color('#fff4e6');

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

/* ------------------------------------------------------------------ */
/* Textures                                                            */
/* ------------------------------------------------------------------ */
/** Seamless Havana tortoiseshell (dark base, amber clouds, honey flecks, near-black spots). */
export function tortoiseTexture() {
  const size = 1024;
  const c = canvas(size, size);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#8c4f1d';
  ctx.fillRect(0, 0, size, size);
  const rnd = mulberry32(7);
  // honey base → dark brown clouds → mid browns → near-black spots → a few amber glints
  const layers: { n: number; r: [number, number]; cols: string[]; a: number; sx: [number, number] }[] = [
    { n: 60, r: [50, 140], cols: ['#b06a28', '#c27a32', '#a35f22'], a: 0.6, sx: [1.4, 2.4] },
    { n: 95, r: [45, 135], cols: ['#3b1a08', '#2e1406', '#46210b'], a: 0.85, sx: [1.6, 3.0] },
    { n: 110, r: [18, 60], cols: ['#5a2c10', '#6b3714', '#4a230c'], a: 0.7, sx: [1.3, 2.4] },
    { n: 150, r: [6, 22], cols: ['#120703', '#1c0b04'], a: 0.85, sx: [1, 1.8] },
    { n: 60, r: [8, 26], cols: ['#d89a4a', '#e2ab5c'], a: 0.42, sx: [1.2, 2] },
  ];
  for (const layer of layers) {
    for (let i = 0; i < layer.n; i += 1) {
      const x = rnd() * size;
      const y = rnd() * size;
      const r = layer.r[0] + rnd() * (layer.r[1] - layer.r[0]);
      const sx = layer.sx[0] + rnd() * (layer.sx[1] - layer.sx[0]);
      const col = layer.cols[Math.floor(rnd() * layer.cols.length)];
      const rot = (rnd() - 0.5) * 0.6;
      for (const ox of [-size, 0, size])
        for (const oy of [-size, 0, size]) {
          const px = x + ox;
          const py = y + oy;
          if (px + r * sx < 0 || px - r * sx > size || py + r < 0 || py - r > size) continue;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(rot);
          ctx.scale(sx, 1);
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
          g.addColorStop(0, col);
          g.addColorStop(0.5, col + Math.round(layer.a * 160).toString(16).padStart(2, '0'));
          g.addColorStop(1, col + '00');
          ctx.globalAlpha = layer.a;
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

/** Speaker grille: fine slots across the patch (u runs along the temple). Returns colour + mask. */
export function grilleTextures() {
  const w = 512;
  const h = 128;
  const color = canvas(w, h);
  const mask = canvas(w, h);
  const cc = color.getContext('2d')!;
  const mc = mask.getContext('2d')!;
  cc.fillStyle = '#2a2b2e';
  cc.fillRect(0, 0, w, h);
  mc.fillStyle = '#000';
  mc.fillRect(0, 0, w, h);
  const slots = 15;
  const margin = 34;
  const step = (w - margin * 2) / (slots - 1);
  for (let i = 0; i < slots; i += 1) {
    const x = margin + i * step;
    const sw = 9;
    const top = 30;
    const bot = h - 30;
    // slot
    cc.fillStyle = '#050506';
    roundRect(cc, x - sw / 2, top, sw, bot - top, sw / 2);
    cc.fill();
    // lit lower lip
    cc.strokeStyle = 'rgba(255,255,255,0.18)';
    cc.lineWidth = 1.5;
    cc.beginPath();
    cc.moveTo(x + sw / 2 + 0.8, top + 4);
    cc.lineTo(x + sw / 2 + 0.8, bot - 4);
    cc.stroke();
    mc.fillStyle = '#fff';
    roundRect(mc, x - sw / 2, top, sw, bot - top, sw / 2);
    mc.fill();
  }
  // soft frame edge
  const edge = cc.createLinearGradient(0, 0, 0, h);
  edge.addColorStop(0, 'rgba(0,0,0,0.5)');
  edge.addColorStop(0.15, 'rgba(0,0,0,0)');
  edge.addColorStop(0.85, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(0,0,0,0.5)');
  cc.fillStyle = edge;
  cc.fillRect(0, 0, w, h);
  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const emissive = new THREE.CanvasTexture(mask);
  emissive.colorSpace = THREE.SRGBColorSpace;
  return { map, emissive };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/** Radial glow for additive sprites. */
export function glowTexture() {
  const s = 128;
  const c = canvas(s, s);
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.12, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.22)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.05)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Soft band that sweeps across the touch pad (emissive map, animated via offset). */
export function swipeTexture() {
  const w = 256;
  const c = canvas(w, 4);
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgb(40,40,40)');
  g.addColorStop(0.42, 'rgb(60,60,60)');
  g.addColorStop(0.5, 'rgb(255,255,255)');
  g.addColorStop(0.58, 'rgb(60,60,60)');
  g.addColorStop(1, 'rgb(40,40,40)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.channel = 1; // normalised patch UVs (uv1)
  return tex;
}

/** Vertical lens gradient (top → bottom), as a colour map for the multiply tint layer. */
export function lensGradient(top: THREE.Color, bottom: THREE.Color) {
  const c = canvas(4, 256);
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, `#${top.getHexString()}`);
  g.addColorStop(0.3, `#${top.getHexString()}`);
  g.addColorStop(0.95, `#${bottom.getHexString()}`);
  g.addColorStop(1, `#${bottom.getHexString()}`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** In-lens HUD: time, a turn arrow with distance, a street name and a progress line. Drawn for the viewer side. */
export function hudTexture() {
  const w = 512;
  const h = 352;
  const c = canvas(w, h);
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  const ink = '#9dffd6';
  ctx.shadowColor = 'rgba(80,255,180,0.9)';
  ctx.shadowBlur = 10;
  ctx.strokeStyle = 'rgba(157,255,214,0.5)';
  ctx.lineWidth = 3;
  roundRect(ctx, 10, 10, w - 20, h - 20, 34);
  ctx.stroke();
  ctx.fillStyle = 'rgba(40,120,90,0.16)';
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.font = '700 44px "Manrope", "Segoe UI", system-ui, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('09:41', 40, 76);
  // status dots
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.arc(w - 120 + i * 26, 60, 7, 0, Math.PI * 2);
    ctx.globalAlpha = i === 2 ? 0.45 : 1;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // turn arrow
  ctx.lineWidth = 18;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ink;
  ctx.beginPath();
  ctx.moveTo(86, 270);
  ctx.lineTo(86, 182);
  ctx.quadraticCurveTo(86, 150, 118, 150);
  ctx.lineTo(160, 150);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(150, 116);
  ctx.lineTo(190, 150);
  ctx.lineTo(150, 184);
  ctx.stroke();
  ctx.font = '800 76px "Manrope", "Segoe UI", system-ui, sans-serif';
  ctx.fillText('120 m', 222, 196);
  ctx.font = '600 30px "Manrope", "Segoe UI", system-ui, sans-serif';
  ctx.globalAlpha = 0.85;
  ctx.fillText('Rr. Mbretëresha Teutë', 222, 244);
  ctx.globalAlpha = 1;
  // progress
  ctx.lineWidth = 6;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.moveTo(40, 300);
  ctx.lineTo(w - 40, 300);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.moveTo(40, 300);
  ctx.lineTo(40 + (w - 80) * 0.62, 300);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* ------------------------------------------------------------------ */
/* Looks per colourway                                                  */
/* ------------------------------------------------------------------ */
export type MetalTone = 'silver' | 'gold' | 'gunmetal' | 'blackChrome';
const METAL: Record<MetalTone, { color: string; roughness: number }> = {
  silver: { color: '#e6e6e4', roughness: 0.14 },
  gold: { color: '#e3c07a', roughness: 0.18 },
  gunmetal: { color: '#6a6e73', roughness: 0.26 },
  blackChrome: { color: '#2a2b2e', roughness: 0.2 },
};

export function metal(tone: MetalTone, extra: THREE.MeshPhysicalMaterialParameters = {}) {
  const m = METAL[tone];
  return new THREE.MeshPhysicalMaterial({ color: m.color, metalness: 1, roughness: m.roughness, envMapIntensity: 1.15, ...extra });
}

interface ColorwaySpec {
  base: string;
  roughness: number;
  clearcoat: number;
  tortoise?: boolean;
  crystal?: boolean;
  hardware: MetalTone;
  wire: MetalTone;
  /** lens transmission colour (multiply), top and bottom of the gradient */
  lensTop: string;
  lensBottom: string;
}

const COLORWAYS: Record<SmartColorway, ColorwaySpec> = {
  black: { base: '#09090a', roughness: 0.2, clearcoat: 1, hardware: 'silver', wire: 'gold', lensTop: '#2a3a31', lensBottom: '#33463b' },
  tortoise: { base: '#ffffff', roughness: 0.17, clearcoat: 1, tortoise: true, hardware: 'gold', wire: 'gold', lensTop: '#4a3322', lensBottom: '#a4876a' },
  clear: { base: '#eef3f2', roughness: 0.06, clearcoat: 1, crystal: true, hardware: 'silver', wire: 'silver', lensTop: '#c9d6d8', lensBottom: '#e2eaeb' },
  sand: { base: '#a27c55', roughness: 0.22, clearcoat: 1, hardware: 'gold', wire: 'gold', lensTop: '#4f3a29', lensBottom: '#b49a7c' },
  white: { base: '#ebe9e4', roughness: 0.32, clearcoat: 0.6, hardware: 'silver', wire: 'silver', lensTop: '#3a3f42', lensBottom: '#8d9496' },
};

export interface Look {
  acetate: THREE.MeshPhysicalMaterial;
  /** matte touch zone in the frame colour (own instance for the highlight) */
  touch: THREE.MeshPhysicalMaterial;
  hardware: THREE.MeshPhysicalMaterial;
  hinge: THREE.MeshPhysicalMaterial;
  wire: THREE.MeshPhysicalMaterial;
  lensTint: THREE.MeshBasicMaterial;
  lensGloss: THREE.MeshPhysicalMaterial;
  cameraRing: THREE.MeshPhysicalMaterial;
  cameraGlass: THREE.MeshPhysicalMaterial;
  cameraInner: THREE.MeshPhysicalMaterial;
  recess: THREE.MeshStandardMaterial;
  ledDiffuser: THREE.MeshPhysicalMaterial;
  grille: THREE.MeshStandardMaterial;
  micRing: THREE.MeshPhysicalMaterial;
  micHole: THREE.MeshBasicMaterial;
  battery: THREE.MeshPhysicalMaterial;
  batteryBand: THREE.MeshStandardMaterial;
  driver: THREE.MeshStandardMaterial;
  rubber: THREE.MeshPhysicalMaterial;
  pad: THREE.MeshPhysicalMaterial;
  displayGlass: THREE.MeshPhysicalMaterial;
  hud: THREE.MeshBasicMaterial;
  glow: THREE.Texture;
  /** colour-map scale (mm per texture repeat) for tortoise */
  uvScale: number;
}

export function createLook(colorway: SmartColorway, variant: SmartVariant, transparentBg: boolean): Look {
  const cw = COLORWAYS[colorway];
  const tortoiseMap = cw.tortoise ? tortoiseTexture() : null;
  const crystal = !!cw.crystal;
  const acetate = new THREE.MeshPhysicalMaterial({
    color: cw.base,
    map: tortoiseMap,
    roughness: cw.roughness,
    metalness: 0,
    clearcoat: cw.clearcoat,
    clearcoatRoughness: 0.035,
    ior: 1.5,
    envMapIntensity: 1,
    ...(crystal
      ? transparentBg
        ? { transparent: true, opacity: 0.42, depthWrite: true }
        : { transmission: 1, thickness: 0.05, attenuationColor: new THREE.Color('#c9d8d6'), attenuationDistance: 0.25 }
      : {}),
  });
  const touch = new THREE.MeshPhysicalMaterial({
    color: cw.base,
    map: tortoiseMap,
    roughness: Math.max(0.36, cw.roughness + 0.16),
    metalness: 0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.22,
    emissiveMap: swipeTexture(),
    emissive: new THREE.Color(0, 0, 0),
    ...(crystal ? { transparent: true, opacity: 0.55 } : {}),
  });
  const hardware = metal(cw.hardware);
  const hinge = metal(cw.hardware === 'gold' ? 'gold' : 'silver', { roughness: 0.12, emissive: new THREE.Color(0, 0, 0) });
  const wire = metal(cw.wire);

  const display = variant === 'display';
  const top = new THREE.Color(display ? '#9aa6a3' : cw.lensTop);
  const bottom = new THREE.Color(display ? '#c3cbc9' : cw.lensBottom);
  // Opaque backgrounds: a multiply layer filters what lies behind (true tint). On a transparent canvas the page
  // behind can't be multiplied, so fall back to a dark alpha layer of matching density.
  const lensTint = transparentBg
    ? new THREE.MeshBasicMaterial({
        color: top.clone().multiplyScalar(0.18),
        transparent: true,
        opacity: crystal || display ? 0.25 : 0.72,
        depthWrite: false,
        toneMapped: false,
      })
    : new THREE.MeshBasicMaterial({
        map: lensGradient(top, bottom),
        transparent: true,
        blending: THREE.MultiplyBlending,
        premultipliedAlpha: true,
        depthWrite: false,
        toneMapped: false,
      });
  const lensGloss = new THREE.MeshPhysicalMaterial({
    color: '#000000',
    roughness: 0.1,
    metalness: 0,
    ior: 1.6,
    specularIntensity: 1,
    envMapIntensity: 0.85,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
  });

  const cameraRing = metal('gunmetal', { roughness: 0.22, emissive: new THREE.Color(0, 0, 0) });
  const cameraGlass = new THREE.MeshPhysicalMaterial({
    color: '#040507',
    roughness: 0.04,
    metalness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    iridescence: 1,
    iridescenceIOR: 1.7,
    iridescenceThicknessRange: [240, 520],
    envMapIntensity: 2.6,
    emissive: new THREE.Color(0, 0, 0),
  });
  const cameraInner = new THREE.MeshPhysicalMaterial({ color: '#141a2c', roughness: 0.12, metalness: 0.85, iridescence: 1, iridescenceIOR: 2, envMapIntensity: 1.4, emissive: new THREE.Color(0, 0, 0) });
  const recess = new THREE.MeshStandardMaterial({ color: '#020202', roughness: 0.65, metalness: 0 });
  const ledDiffuser = new THREE.MeshPhysicalMaterial({ color: '#c9ccce', roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, emissive: new THREE.Color(0, 0, 0) });

  const g = grilleTextures();
  const grille = new THREE.MeshStandardMaterial({ map: g.map, emissiveMap: g.emissive, emissive: new THREE.Color(0, 0, 0), metalness: 0.55, roughness: 0.42 });
  const micRing = metal('gunmetal', { roughness: 0.3, emissive: new THREE.Color(0, 0, 0) });
  const micHole = new THREE.MeshBasicMaterial({ color: '#000000' });
  const battery = new THREE.MeshPhysicalMaterial({ color: '#bfc4c8', metalness: 1, roughness: 0.34, clearcoat: 0.4, clearcoatRoughness: 0.2, emissive: new THREE.Color(0, 0, 0) });
  const batteryBand = new THREE.MeshStandardMaterial({ color: '#2c4a3a', roughness: 0.4, metalness: 0.2, emissive: new THREE.Color(0, 0, 0) });
  const driver = new THREE.MeshStandardMaterial({ color: '#1b1c1f', roughness: 0.5, metalness: 0.3, emissive: new THREE.Color(0, 0, 0) });
  const rubber = new THREE.MeshPhysicalMaterial({ color: colorway === 'black' ? '#1d1f22' : '#3a3d40', roughness: 0.78, metalness: 0, sheen: 0.4, sheenRoughness: 0.6, sheenColor: new THREE.Color('#5a5f64') });
  const pad = new THREE.MeshPhysicalMaterial({ color: '#f2efe9', roughness: 0.2, transmission: transparentBg ? 0 : 0.8, transparent: transparentBg, opacity: transparentBg ? 0.6 : 1, thickness: 0.02 });
  const displayGlass = new THREE.MeshPhysicalMaterial({
    color: '#a8f0d8',
    roughness: 0.08,
    metalness: 0,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    emissive: new THREE.Color(0, 0, 0),
  });
  const hud = new THREE.MeshBasicMaterial({ map: hudTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });

  return {
    acetate,
    touch,
    hardware,
    hinge,
    wire,
    lensTint,
    lensGloss,
    cameraRing,
    cameraGlass,
    cameraInner,
    recess,
    ledDiffuser,
    grille,
    micRing,
    micHole,
    battery,
    batteryBand,
    driver,
    rubber,
    pad,
    displayGlass,
    hud,
    glow: glowTexture(),
    uvScale: 70,
  };
}

export function glowSprite(tex: THREE.Texture, color: THREE.Color, size: number) {
  const mat = new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(size);
  s.renderOrder = 20;
  return s;
}
