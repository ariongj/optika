// The lens in the 3D view, ray traced per pixel instead of faked with a transparent material.
// The meshes only say which pixels to shade: from each, a ray is followed through the two real spherical surfaces and the cut
// edge, with Snell, total internal reflection and an anti-reflection coat at every surface. That alone gives the double
// reflections, the rings of a strong minus lens and the shrunken or magnified wall seen through it.
// Each still picture adds several of these, one wavelength at a time, so the colour fringes are the material's real ones.
import * as THREE from 'three';
import { rightEye, type SolvedLens } from './lensMath';

/** The wall behind the glasses, in stage units: close enough for the lens to visibly change it. */
const WALL_Z = -3;

const WALL_GLSL = /* glsl */ `
vec3 wallAt(vec2 p) {
  float d = length((p - vec2(0.0, 0.1)) * vec2(0.42, 0.8));
  float pool = exp(-d * d * 1.25);
  vec3 base = vec3(0.0034, 0.0033, 0.0034) + vec3(0.078, 0.074, 0.069) * pool;
  // a fine printed grid: quiet on its own, and it shows at a glance what the lens does to the world behind it
  vec2 g = (fract(p / 0.11) - 0.5) * 0.11;
  float dotMark = 1.0 - smoothstep(0.0028, 0.0068, length(g));
  return base * (1.0 + dotMark * 1.25) + dotMark * 0.001;
}`;

const LENS_VERT = /* glsl */ `
varying vec3 vLocal;
varying vec3 vCam;
varying vec3 vN;
void main() {
  vLocal = position;
  vN = normal;
  vCam = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const LENS_FRAG = /* glsl */ `
precision highp float;
uniform mat4 modelMatrix;
uniform samplerCube tEnv;
uniform sampler2D tRim;
uniform float uN;
uniform float uCf;
uniform float uCb;
uniform vec3 uCbT;
uniform float uZb;
uniform float uOx;
uniform float uAbsorb;
uniform vec3 uMask;
uniform vec3 uTint;
uniform float uHeat;
uniform float uHeatMin;
uniform float uHeatRange;
uniform vec3 uHeat0;
uniform vec3 uHeat1;
uniform vec3 uHeat2;
uniform vec3 uEdgeBody;
uniform vec3 uEdgeRim;
varying vec3 vLocal;
varying vec3 vCam;
varying vec3 vN;

const float NONE = 1e6;
const float ENV_GAIN = 1.7; // softboxes are far brighter than a screen can show; this is what a 1% reflection of them needs
const float WALL_Z = ${WALL_Z.toFixed(1)};
${WALL_GLSL}

vec3 toWorld(vec3 v) { return normalize(mat3(modelMatrix) * v); }
float rimAt(vec2 q) { return texture2D(tRim, vec2(atan(q.y, q.x) / 6.2831853 + 0.5, 0.5)).r; }
bool beyondRim(vec3 q) { return length(q.xy) > rimAt(q.xy); }

// A surface through its vertex at height z0: x'Ax - 2z = 0, with A = [[cxx, cxy, 0], [cxy, cyy, 0], [0, 0, cz]]. With every
// curvature equal it is a sphere; a cylinder makes the back surface toric, which this quadric follows closely across a lens.
// The ray meets it where a quadratic in t is zero; the nearest hit on the sheet through the vertex wins. Works down to flat.
float sheet(vec3 o, vec3 d, vec3 c, float cz, float z0) {
  vec3 p = o - vec3(uOx, 0.0, z0);
  float a = c.x * d.x * d.x + c.y * d.y * d.y + 2.0 * c.z * d.x * d.y + cz * d.z * d.z;
  float b = c.x * p.x * d.x + c.y * p.y * d.y + c.z * (p.x * d.y + p.y * d.x) + cz * p.z * d.z - d.z;
  float k = c.x * p.x * p.x + c.y * p.y * p.y + 2.0 * c.z * p.x * p.y + cz * p.z * p.z - 2.0 * p.z;
  float disc = b * b - a * k;
  if (disc < 0.0) return NONE;
  float s = sqrt(disc);
  float best = NONE;
  float den = s - b;
  if (abs(den) > 1e-7) {
    float t = k / den;
    if (t > 0.001 && 1.0 - cz * (p.z + t * d.z) > 0.0) best = t;
  }
  den = -s - b;
  if (abs(den) > 1e-7) {
    float t = k / den;
    if (t > 0.001 && t < best && 1.0 - cz * (p.z + t * d.z) > 0.0) best = t;
  }
  return best;
}

vec3 gradient(vec3 q, vec3 c, float cz, float z0) {
  vec3 v = q - vec3(uOx, 0.0, z0);
  return normalize(vec3(c.x * v.x + c.z * v.y, c.z * v.x + c.y * v.y, cz * v.z - 1.0));
}

// height above the vertex: a sphere of the curvature along this direction, as the thickness figures are worked out
float sagAt(vec3 c, vec2 q) {
  vec2 v = q - vec2(uOx, 0.0);
  float rr = dot(v, v);
  float k = rr > 1e-8 ? (c.x * v.x * v.x + c.y * v.y * v.y + 2.0 * c.z * v.x * v.y) / rr : 0.5 * (c.x + c.y);
  return k * rr / (1.0 + sqrt(max(1.0 - k * k * rr, 1e-4)));
}

vec3 front3() { return vec3(uCf, uCf, 0.0); }

// a thin-film stack as a single interference term: residual green head-on, moving towards blue and violet as the angle grows
vec3 coat(float c) {
  float cf = sqrt(1.0 - (1.0 - c * c) / 2.1);
  vec3 phase = 6.2831853 * 1100.0 * cf / vec3(640.0, 535.0, 450.0);
  vec3 r0 = 0.0072 + 0.0028 * (0.5 + 0.5 * cos(phase));
  float g = pow(1.0 - c, 5.0);
  return r0 + (1.0 - r0) * g;
}

vec3 env(vec3 d, float lod) { return textureLod(tEnv, d, lod).rgb; }

// the world in a direction, leaving from a point: the wall behind, the studio everywhere else
vec3 world(vec3 p, vec3 d) {
  if (d.z < -0.02) return wallAt(p.xy + d.xy * (WALL_Z - p.z) / d.z);
  return env(d, 0.0);
}

vec3 throughLens(vec3 p, vec3 d) {
  return world(p, d) * uTint;
}

vec3 heatOf(vec2 q) {
  float th = sagAt(front3(), q) - uZb - sagAt(uCbT, q);
  float h = clamp((th - uHeatMin) / uHeatRange, 0.0, 1.0);
  return mix(mix(uHeat0, uHeat1, h), mix(uHeat1, uHeat2, h), h);
}

vec3 inside(vec3 p, vec3 d) {
  vec3 sum = vec3(0.0);
  vec3 t = vec3(1.0);
  for (int i = 0; i < 6; i++) {
    float tf = sheet(p, d, front3(), uCf, 0.0);
    float tb = sheet(p, d, uCbT, uCb, uZb);
    float len = min(min(tf, tb), 400.0);
    vec3 q = p + d * len;
    if (beyondRim(q)) {
      // the cut edge: a ground surface scatters what reaches it
      float a = 0.0;
      float b = len;
      for (int k = 0; k < 6; k++) {
        float m = 0.5 * (a + b);
        if (beyondRim(p + d * m)) b = m;
        else a = m;
      }
      q = p + d * b;
      vec3 outward = toWorld(normalize(vec3(q.xy, 0.0)));
      sum += t * exp(-uAbsorb * b) * env(outward, 5.0) * 0.7;
      return sum;
    }
    t *= exp(-uAbsorb * len);
    bool front = tf < tb;
    vec3 n = front ? -gradient(q, front3(), uCf, 0.0) : gradient(q, uCbT, uCb, uZb);
    float ci = dot(d, n);
    float s2 = uN * uN * (1.0 - ci * ci);
    vec3 r = vec3(1.0);
    if (s2 < 1.0) {
      float ca = sqrt(1.0 - s2);
      r = coat(ca);
      vec3 out_ = normalize(d * uN + n * (ca - uN * ci));
      sum += t * (1.0 - r) * throughLens((modelMatrix * vec4(q, 1.0)).xyz, toWorld(out_));
    }
    t *= r;
    if (max(t.r, max(t.g, t.b)) < 0.003) break;
    d = d - 2.0 * ci * n;
    p = q;
  }
  return sum;
}

void main() {
  vec3 d = normalize(vLocal - vCam);
  vec3 col;
#if defined(WALL)
  vec3 n = normalize(vN);
  if (dot(n, d) > 0.0) n = -n;
  float zf = sagAt(front3(), vLocal.xy);
  float zb = uZb + sagAt(uCbT, vLocal.xy);
  float v = clamp((vLocal.z - zb) / max(zf - zb, 0.01), 0.0, 1.0);
  vec3 body = mix(uEdgeBody, uEdgeRim, pow(abs(v - 0.5) * 2.0, 2.2));
  vec3 nw = toWorld(n);
  float ci = clamp(-dot(d, n), 0.0, 1.0);
  vec3 p = (modelMatrix * vec4(vLocal, 1.0)).xyz;
  vec3 spec = (0.04 + 0.96 * pow(1.0 - ci, 5.0)) * world(p, toWorld(reflect(d, n))) * ENV_GAIN;
  col = uHeat > 0.5 ? heatOf(vLocal.xy) + spec * 0.2 : body * (env(nw, 5.0) * 1.25 + 0.055) + spec;
  // Seen end on, each short piece of the edge flips between a hairline and hidden, which draws a dashed line along the rim.
  // The edge fades out as it turns end on: it only needs to show where it has width.
  if (uHeat < 0.5) col *= smoothstep(0.03, 0.2, abs(dot(d, normalize(vec3(n.xy, 0.0)))));
#else
  #if defined(FRONT)
    vec3 c = front3();
    float cz = uCf;
    float z0 = 0.0;
    float side = -1.0;
  #else
    vec3 c = uCbT;
    float cz = uCb;
    float z0 = uZb;
    float side = 1.0;
  #endif
  float t = sheet(vCam, d, c, cz, z0);
  vec3 p = t < NONE ? vCam + d * t : vLocal;
  vec3 n = side * gradient(p, c, cz, z0);
  float ci = -dot(d, n);
  if (ci < 0.0) {
    n = -n;
    ci = -ci;
  }
  vec3 r = coat(clamp(ci, 0.0, 1.0));
  vec3 pw = (modelMatrix * vec4(p, 1.0)).xyz;
  vec3 mirrored = toWorld(reflect(d, n));
  vec3 refl = r * world(pw, mirrored) * (mirrored.z < -0.02 ? 1.0 : ENV_GAIN);
  if (uHeat > 0.5) {
    col = heatOf(p.xy) + refl * 0.5;
  } else {
    vec3 dt = refract(d, n, 1.0 / uN);
    col = refl + (1.0 - r) * inside(p, dt);
  }
#endif
  gl_FragColor = vec4(col * uMask, 1.0);
}`;

const WALL_VERT = /* glsl */ `
varying vec2 vP;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = w.xy;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const WALL_FRAG = /* glsl */ `
precision highp float;
varying vec2 vP;
${WALL_GLSL}
void main() {
  gl_FragColor = vec4(wallAt(vP), 1.0);
}`;

const linear = (hex: string) => new THREE.Color(hex);

export function createGlass(envCube: THREE.Texture) {
  const rimData = new Uint16Array(256);
  const rimTex = new THREE.DataTexture(rimData, 256, 1, THREE.RedFormat, THREE.HalfFloatType);
  rimTex.minFilter = rimTex.magFilter = THREE.LinearFilter;
  rimTex.wrapS = THREE.RepeatWrapping;
  let rimSource: SolvedLens['rim'] | null = null;

  const uniforms = {
    tEnv: { value: envCube },
    tRim: { value: rimTex },
    uN: { value: 1.5 },
    uCf: { value: 0 },
    uCb: { value: 0 },
    uCbT: { value: new THREE.Vector3() },
    uZb: { value: -2 },
    uOx: { value: 0 },
    uAbsorb: { value: 0.004 },
    uMask: { value: new THREE.Vector3(1, 1, 1) },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uHeat: { value: 0 },
    uHeatMin: { value: 0 },
    uHeatRange: { value: 1 },
    // a touch over the legend's colours, so they are still those colours after the stage's tone curve
    uHeat0: { value: linear('#3b2d16').multiplyScalar(1.5) },
    uHeat1: { value: linear('#ad9466').multiplyScalar(1.45) },
    uHeat2: { value: linear('#fff1cf').multiplyScalar(1.3) },
    uEdgeBody: { value: linear('#62706d') },
    uEdgeRim: { value: linear('#e9f2ef') },
  };
  // The right eye's lens shares every value with the left one except its back surface, which a cylinder turns differently.
  // Spreading keeps the other uniforms the same objects, so one update reaches both.
  const right = { ...uniforms, uCbT: { value: new THREE.Vector3() } };
  const lensMaterial = (define: string, u: typeof uniforms) => new THREE.ShaderMaterial({ uniforms: u, vertexShader: LENS_VERT, fragmentShader: LENS_FRAG, defines: { [define]: 1 } });
  /** Materials per eye, right then left: the order the stage lays the lenses out, from the viewer's left. */
  const eyes = [right, uniforms].map((u) => ({ front: lensMaterial('FRONT', u), back: lensMaterial('BACK', u), edge: lensMaterial('WALL', u) }));

  const wall = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShaderMaterial({ vertexShader: WALL_VERT, fragmentShader: WALL_FRAG, depthWrite: false }));
  wall.position.z = WALL_Z;
  wall.frustumCulled = false;
  wall.renderOrder = -1;

  /** The outline as radius per angle, so the shader can tell inside from outside with one lookup. */
  function writeRim(rim: SolvedLens['rim']) {
    const count = rim.length;
    for (let k = 0; k < 256; k += 1) {
      const a = ((k + 0.5) / 256 - 0.5) * Math.PI * 2;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      let best = 0;
      for (let i = 0; i < count; i += 1) {
        const p = rim[i];
        const q = rim[(i + 1) % count];
        const ex = q.x - p.x;
        const ey = q.y - p.y;
        const den = ux * ey - uy * ex;
        if (Math.abs(den) < 1e-9) continue;
        const r = (p.x * ey - p.y * ex) / den;
        const w = (p.x * uy - p.y * ux) / den;
        if (r > 0 && w >= -1e-6 && w <= 1 + 1e-6) best = Math.max(best, r);
      }
      rimData[k] = THREE.DataUtils.toHalfFloat(best);
    }
    rimTex.needsUpdate = true;
  }

  return {
    eyes,
    wall,
    setLens(l: SolvedLens, heatMin: number, heatRange: number) {
      if (l.rim !== rimSource) {
        rimSource = l.rim;
        writeRim(l.rim);
      }
      const k = (l.n - 1) * 1000;
      uniforms.uCf.value = -l.f1 / k;
      // the back surface: its curvature along the axis, and the cylinder's extra curvature across it
      const ca = l.f2 / k;
      const dc = l.cyl / k;
      const tensor = (target: THREE.Vector3, ax: number) => {
        const s = Math.sin(ax);
        const c = Math.cos(ax);
        target.set(ca + dc * s * s, ca + dc * c * c, -dc * s * c);
      };
      tensor(uniforms.uCbT.value, l.ax);
      tensor(right.uCbT.value, rightEye(l).ax);
      uniforms.uCb.value = ca + dc / 2;
      uniforms.uZb.value = -l.ct;
      uniforms.uOx.value = l.ox;
      uniforms.uHeatMin.value = heatMin;
      uniforms.uHeatRange.value = heatRange;
    },
    setLook(heat: boolean, tint: [number, number, number]) {
      uniforms.uHeat.value = heat ? 1 : 0;
      uniforms.uTint.value.setRGB(...tint);
    },
    /** channel -1: one ray for all of light, at the nominal index. 0, 1, 2: red, green or blue only, at that colour's index. */
    setChannel(channel: number, n: number, abbe: number) {
      const spread = (n - 1) / abbe;
      uniforms.uN.value = channel === 0 ? n - 0.4 * spread : channel === 2 ? n + 0.6 * spread : n;
      if (channel < 0) uniforms.uMask.value.set(1, 1, 1);
      else uniforms.uMask.value.set(channel === 0 ? 3 : 0, channel === 1 ? 3 : 0, channel === 2 ? 3 : 0);
    },
    dispose() {
      rimTex.dispose();
      for (const e of eyes) for (const m of [e.front, e.back, e.edge]) m.dispose();
      wall.geometry.dispose();
      wall.material.dispose();
    },
  };
}

/**
 * Where the stage is drawn: linear light with room above white, then one tone curve for everything, with a little glow around
 * what is brightest. Still pictures are averaged over slightly shifted, one-wavelength renders, then drawing stops.
 */
export function createStagePass(renderer: THREE.WebGLRenderer) {
  const hdr = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  const type = hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const options = { type, depthBuffer: true, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter };
  const main = new THREE.WebGLRenderTarget(4, 4, { ...options, samples: 4 });
  const still = new THREE.WebGLRenderTarget(4, 4, { ...options, depthBuffer: false });

  const VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  const blend = new THREE.ShaderMaterial({
    uniforms: { tCol: { value: main.texture }, uAlpha: { value: 1 } },
    vertexShader: VERT,
    fragmentShader: `precision highp float; uniform sampler2D tCol; uniform float uAlpha; varying vec2 vUv;
void main() { gl_FragColor = vec4(textureLod(tCol, vUv, 0.0).rgb, uAlpha); }`,
    transparent: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const show = new THREE.ShaderMaterial({
    uniforms: { tCol: { value: main.texture } },
    vertexShader: VERT,
    fragmentShader: `precision highp float; uniform sampler2D tCol; varying vec2 vUv;
void main() {
  vec3 c = textureLod(tCol, vUv, 0.0).rgb;
  vec3 g = 0.6 * textureLod(tCol, vUv, 3.0).rgb + 0.4 * textureLod(tCol, vUv, 5.0).rgb;
  c += min(max(g - 0.75, 0.0), vec3(0.6)) * 0.16;
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  // dark gradients band on an 8-bit screen without this
  gl_FragColor.rgb += (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0;
}`,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blend);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  return {
    main,
    setSize(w: number, h: number) {
      main.setSize(w, h);
      still.setSize(w, h);
    },
    /** Add what `main` holds to the running average. `k` counts from 1. */
    accumulate(k: number) {
      blend.uniforms.uAlpha.value = 1 / k;
      quad.material = blend;
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      renderer.setRenderTarget(still);
      renderer.render(scene, camera);
      renderer.autoClear = autoClear;
    },
    present(averaged: boolean) {
      show.uniforms.tCol.value = averaged ? still.texture : main.texture;
      quad.material = show;
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    },
    dispose() {
      main.dispose();
      still.dispose();
      blend.dispose();
      show.dispose();
      quad.geometry.dispose();
    },
  };
}
