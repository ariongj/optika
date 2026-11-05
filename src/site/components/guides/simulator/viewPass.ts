// "Look through the lens": a real scene (colour plate + per-pixel distance) drawn through a traced map of the lens.
// Nothing runs unless the view or a control changes.
//
// Per pixel the eye is turned to look through that point of the lens. The traced map says where the ray really goes
// (magnification, prism, distortion, colour fringes) and what power error it meets; the eye then accommodates what it can,
// and whatever is left, including astigmatism, becomes an elliptical blur in linear light with the plate's real highlights.
import * as THREE from 'three';
import { clamp } from '@/lib/utils';
import { EYE_DISTANCE, MAP, type LensMap } from './lensOptics';
import { PLATE_TAN, type Plate } from './plates';

const VMAX = 6; // dioptres stored in the plate's data map

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tPlate;
uniform sampler2D tData;
uniform sampler2D tBend;
uniform sampler2D tPower;
uniform vec2 uRes;
uniform float uMmPerPx;
uniform vec2 uHalf;
uniform float uLens;
uniform float uReveal;
uniform float uTanPerPx;
uniform float uK;
uniform float uSph;
uniform float uAcc;
uniform float uAbbe;
uniform float uBlurPerD;
uniform float uLod0;
uniform float uPolar;
uniform float uZones;
uniform vec3 uFilter;
uniform vec2 uPlateTan;
uniform mat3 uPan;
uniform vec2 uMapN;
uniform vec2 uMapHalf;
varying vec2 vUv;

const int TAPS = 28;
const float VMAX = ${VMAX.toFixed(1)};

vec2 plateUv(vec2 t) {
  vec3 r = uPan * vec3(t, -1.0);
  return 0.5 + (r.xy / -r.z) / (2.0 * uPlateTan);
}

// what is left after the lens and after the eye has accommodated what it can
float residual(float v, float naked, float err) {
  float d = v + naked - err;
  return d < 0.0 ? d : max(0.0, d - uAcc);
}

// the map has a 1 mm step: a contour drawn on it directly turns a corner at every cell, so it reads as a crack in the glass.
// A cubic B-spline through four bilinear reads keeps the curve smooth.
float astigmatism(vec2 uv) {
  vec2 st = uv * uMapN - 0.5;
  vec2 i = floor(st);
  vec2 f = st - i;
  vec2 f2 = f * f;
  vec2 f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0;
  vec2 w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
  vec2 w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0;
  vec2 w3 = f3 / 6.0;
  vec2 g0 = w0 + w1;
  vec2 g1 = w2 + w3;
  vec2 p0 = (i - 0.5 + w1 / g0) / uMapN;
  vec2 p1 = (i + 1.5 + w3 / g1) / uMapN;
  return g0.y * (g0.x * texture2D(tPower, vec2(p0.x, p0.y)).a + g1.x * texture2D(tPower, vec2(p1.x, p0.y)).a)
    + g1.y * (g0.x * texture2D(tPower, vec2(p0.x, p1.y)).a + g1.x * texture2D(tPower, vec2(p1.x, p1.y)).a);
}

vec3 shoulder(vec3 c) {
  return mix(c, 0.8 + 0.2 * (1.0 - exp(-(c - 0.8) / 0.2)), step(0.8, c));
}

void main() {
  vec2 rel = vUv - 0.5;
  vec2 px = rel * uRes;
  vec2 mm = px * uMmPerPx;
  vec2 q = abs(mm) / (uHalf * uReveal);
  float k = pow(pow(q.x, 2.9) + pow(q.y, 2.9), 1.0 / 2.9);
  float aa = uMmPerPx * 1.5 / (uHalf.y * uReveal);
  float inside = uLens * (1.0 - smoothstep(1.0 - aa, 1.0 + aa, k));

  vec2 mapUv = (mm + uMapHalf + 0.5) / uMapN;
  vec2 bend = texture2D(tBend, mapUv).rg * inside;
  vec3 pv = texture2D(tPower, mapUv).rgb * inside;
  float naked = inside > 0.5 ? 0.0 : uSph;

  vec2 uv = plateUv(px * uTanPerPx + uK * bend);
  vec2 dx = dFdx(uv);
  vec2 dy = dFdy(uv);
  vec4 data = textureLod(tData, uv, 0.0);

  float J = length(pv.yz);
  float axis = 0.5 * atan(pv.z, pv.y + 1e-6);
  vec2 dirA = vec2(cos(axis), sin(axis));
  vec2 dirB = vec2(-dirA.y, dirA.x);
  float res = residual(data.r * VMAX, naked, pv.x);
  float ra = abs(res - J) * uBlurPerD;
  float rb = abs(res + J) * uBlurPerD;
  float rMax = max(ra, rb);

  vec3 sharp = textureGrad(tPlate, uv, dx, dy).rgb;
  vec3 col = sharp;
  float lod = 0.0;
  if (rMax > 0.3) {
    lod = max(uLod0, uLod0 + log2(rMax * 0.34));
    vec2 uvPerPx = uTanPerPx / (2.0 * uPlateTan);
    float head = pow(2.0, data.g * 5.0);
    col = textureLod(tPlate, uv, lod).rgb * head;
    float total = 1.0;
    for (int i = 0; i < TAPS; i++) {
      float a = float(i) * 2.39996;
      float rr = sqrt((float(i) + 0.5) / float(TAPS));
      vec2 d = vec2(cos(a), sin(a)) * rr;
      vec2 s = uv + (dirA * d.x * ra + dirB * d.y * rb) * uvPerPx;
      // blurred to match the taps' spacing, or a small bright glint comes out as a ring of separate dots
      vec4 dt = textureLod(tData, s, max(0.0, lod - 1.0));
      float tres = residual(dt.r * VMAX, naked, pv.x);
      float tr = max(abs(tres - J), abs(tres + J)) * uBlurPerD;
      // a sharp neighbour must not smear into a blurred pixel; a blurred one may spread over a sharp one
      float w = 0.08 + 0.92 * smoothstep(rr * rMax * 0.45, rr * rMax * 0.85, tr);
      col += textureLod(tPlate, s, lod).rgb * pow(2.0, dt.g * 5.0) * w;
      total += w;
    }
    // eased in from the sharp picture, or the line where blur starts would show on fine texture like tarmac
    col = mix(sharp, shoulder(col / total), smoothstep(0.3, 1.1, rMax));
  }

  // colour fringes: the same bend at a slightly different index for red and for blue (Abbe number)
  if (inside > 0.5 && uLens > 0.5) {
    vec2 off = uK * bend / (2.0 * uAbbe) / (2.0 * uPlateTan);
    vec3 c0 = textureLod(tPlate, uv, lod).rgb;
    col.r = max(0.0, col.r + textureLod(tPlate, uv - off, lod).r - c0.r);
    col.b = max(0.0, col.b + textureLod(tPlate, uv + off, lod).b - c0.b);
  }

  // what a polariser takes out: road sheen and sky
  col *= 1.0 - uPolar * inside * data.b;
  col *= mix(vec3(1.0), uFilter, inside);

  if (uZones > 0.5 && inside > 0.0) {
    float cyl = astigmatism(mapUv);
    float z = smoothstep(0.5, 1.7, cyl);
    col = mix(col, vec3(0.55, 0.32, 0.09), z * 0.3 * inside);
    // distance to the line in pixels, the same width everywhere on it; a soft dark edge keeps it readable on a bright scene
    float toLine = abs(cyl - 0.5) / max(length(vec2(dFdx(cyl), dFdy(cyl))), 1e-4);
    float w = max(1.0, uRes.x / 900.0);
    col *= 1.0 - 0.3 * inside * (1.0 - smoothstep(w, w * 4.0, toLine));
    col = mix(col, vec3(1.0, 0.86, 0.6), inside * (1.0 - smoothstep(w * 0.55, w * 1.25, toLine)));
  }

  if (uLens > 0.5) {
    // no frame: only the cut edge of the glass catches a little light, and the world beyond it is a touch dimmer
    col = mix(col * mix(1.0, 0.8, uReveal), col, inside);
    float edge = smoothstep(0.982, 0.998, k) * (1.0 - smoothstep(1.0, 1.008, k));
    col += vec3(0.15, 0.16, 0.17) * edge;
  }
  float vig = 1.0 - smoothstep(0.45, 1.25, length(rel * vec2(1.25, 1.1)) * 1.45);
  col *= mix(0.74, 1.0, vig);

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export interface ViewParams {
  /** how far the lens has opened: 0 is no lens at all, 1 its full size */
  reveal: number;
  sph: number;
  acc: number;
  abbe: number;
  /** multiplier the tint leaves on the light (linear) */
  filter: [number, number, number];
  polar: number;
  zones: boolean;
  /** rotation of the view away from its rest (rad) */
  yaw: number;
  pitch: number;
}

export const LENS_HALF = { x: 29, y: 23 };

function halfTexture(format: THREE.PixelFormat, channels: number) {
  const t = new THREE.DataTexture(new Uint16Array(MAP.nx * MAP.ny * channels), MAP.nx, MAP.ny, format, THREE.HalfFloatType);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Compiles a scene's shaders, off the main thread on browsers that can. (`compileAsync` logs a warning on the others.) */
export async function compileShaders(renderer: THREE.WebGLRenderer, scene: THREE.Object3D, camera: THREE.Camera) {
  if (renderer.extensions.has('KHR_parallel_shader_compile')) await renderer.compileAsync(scene, camera);
  else renderer.compile(scene, camera);
}

export function createViewPass(renderer: THREE.WebGLRenderer) {
  const bend = halfTexture(THREE.RGFormat, 2);
  const power = halfTexture(THREE.RGBAFormat, 4);
  const uniforms = {
    tPlate: { value: null as THREE.Texture | null },
    tData: { value: null as THREE.Texture | null },
    tBend: { value: bend },
    tPower: { value: power },
    uRes: { value: new THREE.Vector2(4, 4) },
    uMmPerPx: { value: 0.1 },
    uHalf: { value: new THREE.Vector2(LENS_HALF.x, LENS_HALF.y) },
    uLens: { value: 1 },
    uReveal: { value: 1 },
    uTanPerPx: { value: 0.001 },
    uK: { value: 0.4 },
    uSph: { value: 0 },
    uAcc: { value: 1 },
    uAbbe: { value: 58 },
    uBlurPerD: { value: 4 },
    uLod0: { value: 0 },
    uPolar: { value: 0 },
    uZones: { value: 0 },
    uFilter: { value: new THREE.Color(1, 1, 1) },
    uPlateTan: { value: new THREE.Vector2(PLATE_TAN.x, PLATE_TAN.y) },
    uPan: { value: new THREE.Matrix3() },
    uMapN: { value: new THREE.Vector2(MAP.nx, MAP.ny) },
    uMapHalf: { value: new THREE.Vector2(MAP.halfX, MAP.halfY) },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, toneMapped: false, depthTest: false, depthWrite: false });
  const quadScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  quadScene.add(quad);
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  let width = 4;
  let cssMmPerPx = 0.1;
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const rotation = new THREE.Matrix4();

  const plateLod = (plateWidth: number) => {
    const platePxPerTan = plateWidth / (2 * PLATE_TAN.x);
    uniforms.uLod0.value = Math.max(0, Math.log2(platePxPerTan * uniforms.uTanPerPx.value));
  };
  let plateWidth = 2048;

  return {
    setSize(w: number, h: number, dpr: number) {
      width = Math.max(4, Math.round(w * dpr));
      const height = Math.max(4, Math.round(h * dpr));
      uniforms.uRes.value.set(width, height);
      // the lens fills the view; what is left around it shows the world without correction
      const fit = Math.min((w * 0.92) / (LENS_HALF.x * 2), (h * 0.9) / (LENS_HALF.y * 2));
      cssMmPerPx = 1 / fit;
      uniforms.uMmPerPx.value = cssMmPerPx / dpr;
      // the same horizontal field on every wide stage, a little tighter on square ones, where the height comes into play
      const halfTan = w / h >= 1.35 ? 0.577 : 0.52;
      uniforms.uTanPerPx.value = halfTan / (width / 2);
      uniforms.uK.value = (halfTan / (width / 2)) * (1 / (cssMmPerPx / dpr)) * EYE_DISTANCE;
      // a little over the 4 mm pupil's true blur: on a small screen far from the eye, the true figure reads as too little
      uniforms.uBlurPerD.value = clamp(width * 0.0036, 1.6, 9);
      plateLod(plateWidth);
    },
    setPlate(p: Plate) {
      uniforms.tPlate.value = p.color;
      uniforms.tData.value = p.data;
      plateWidth = p.width;
      plateLod(plateWidth);
    },
    setLensMap(map: LensMap) {
      const b = bend.image.data as unknown as Uint16Array;
      const pw = power.image.data as unknown as Uint16Array;
      for (let i = 0; i < b.length; i += 1) b[i] = THREE.DataUtils.toHalfFloat(map.bend[i]);
      for (let i = 0; i < pw.length; i += 1) pw[i] = THREE.DataUtils.toHalfFloat(map.power[i]);
      bend.needsUpdate = true;
      power.needsUpdate = true;
    },
    /** Compile the shader ahead of the first draw. */
    prepare: () => compileShaders(renderer, quadScene, quadCamera),
    /** Draw the view through the lens. */
    render(p: ViewParams) {
      uniforms.uLens.value = p.reveal > 0 ? 1 : 0;
      uniforms.uReveal.value = Math.max(p.reveal, 0.001);
      uniforms.uSph.value = p.sph;
      uniforms.uAcc.value = p.acc;
      uniforms.uAbbe.value = p.abbe;
      uniforms.uPolar.value = p.polar;
      uniforms.uFilter.value.setRGB(...p.filter);
      uniforms.uZones.value = p.zones ? 1 : 0;
      euler.set(p.pitch, p.yaw, 0);
      uniforms.uPan.value.setFromMatrix4(rotation.makeRotationFromEuler(euler));
      renderer.setRenderTarget(null);
      renderer.render(quadScene, quadCamera);
    },
    /** CSS px per lens mm, for placing the zone labels. */
    cssPerMm: () => 1 / cssMmPerPx,
    dispose() {
      bend.dispose();
      power.dispose();
      material.dispose();
      quad.geometry.dispose();
    },
  };
}
