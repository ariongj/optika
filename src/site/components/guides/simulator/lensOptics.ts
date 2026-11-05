// What a lens does to the world, per point of the lens, for an eye that turns to look through that point.
// Rays are traced through the two real surfaces. Plain numbers only: the result goes to the shader as two small textures.
//
//   bend    how far the seen direction moves (tangents): magnification, prism and distortion, all in one
//   power   the error against the prescription, as a power vector (M, J0, J45), in dioptres
//
// A progressive is a real surface too: an addition surface is solved so that the power rises along the corridor with as
// little astigmatism as possible. The side lobes are therefore not drawn, they follow from the surface (Minkwitz). It is
// still our own illustrative design, not a manufacturer's: the page says so.

/** Lens map extent and step (mm). */
export const MAP = { halfX: 32, halfY: 26, step: 1, nx: 65, ny: 53 };

/** Back vertex to the eye's centre of rotation, and that centre to the pupil (mm). */
export const EYE_DISTANCE = 27;
const PUPIL = 13.5;
const EPS = 0.6; // half pencil width at the pupil (mm)

export interface OpticLens {
  n: number;
  /** front and back surface powers (D), centre thickness (mm) */
  f1: number;
  f2: number;
  ct: number;
}

export interface LensMap {
  /** RG per node: change in the seen direction (tangents) */
  bend: Float32Array;
  /** RGBA per node: mean error (D), J0, J45, unused */
  power: Float32Array;
}

type V3 = [number, number, number];

/** Meets a sphere with vertex at z = v and radius R (signed, centre at v + R), on the sheet nearest the vertex. */
function hit(o: V3, d: V3, v: number, R: number, out: V3) {
  const cz = v + R;
  const ox = o[0];
  const oy = o[1];
  const oz = o[2] - cz;
  const b = ox * d[0] + oy * d[1] + oz * d[2];
  const c = ox * ox + oy * oy + oz * oz - R * R;
  const disc = b * b - c;
  if (disc < 0) return false;
  const s = Math.sqrt(disc);
  const z1 = o[2] + (-b - s) * d[2];
  const z2 = o[2] + (-b + s) * d[2];
  const t = Math.abs(z1 - v) < Math.abs(z2 - v) ? -b - s : -b + s;
  out[0] = o[0] + t * d[0];
  out[1] = o[1] + t * d[1];
  out[2] = o[2] + t * d[2];
  return true;
}

/** Bends `d` at a point of the sphere, from index n1 into n2 (Snell). Returns false on total internal reflection. */
function refract(d: V3, p: V3, v: number, R: number, n1: number, n2: number) {
  const cz = v + R;
  let nx = p[0] / R;
  let ny = p[1] / R;
  let nz = (p[2] - cz) / R;
  let c = nx * d[0] + ny * d[1] + nz * d[2];
  if (c > 0) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
    c = -c;
  }
  const eta = n1 / n2;
  const k = 1 - eta * eta * (1 - c * c);
  if (k < 0) return false;
  const m = eta * c + Math.sqrt(k);
  d[0] = eta * d[0] - m * nx;
  d[1] = eta * d[1] - m * ny;
  d[2] = eta * d[2] - m * nz;
  return true;
}

const pB: V3 = [0, 0, 0];
const pF: V3 = [0, 0, 0];

/** From the eye through the back surface, then the front, out to the world. `d` becomes the exit direction. */
function throughLens(o: V3, d: V3, l: OpticLens, R1: number, R2: number) {
  if (!hit(o, d, l.ct, R2, pB)) return false;
  if (!refract(d, pB, l.ct, R2, 1, l.n)) return false;
  if (!hit(pB, d, 0, R1, pF)) return false;
  return refract(d, pF, 0, R1, l.n, 1);
}

/**
 * Traces the whole map. +z points to the eye, so rays run towards -z; the front vertex is at z = 0.
 * `addition`, when given, is a thin surface on top: its slope moves the rays and its curvature adds power.
 */
export function buildLensMap(l: OpticLens, addition: Addition | null, offAxis = 1, reuse?: LensMap): LensMap {
  const { nx, ny, halfX, halfY, step } = MAP;
  const bend = reuse?.bend ?? new Float32Array(nx * ny * 2);
  const power = reuse?.power ?? new Float32Array(nx * ny * 4);
  const R1 = ((l.n - 1) * 1000) / l.f1;
  const R2 = ((1 - l.n) * 1000) / l.f2;
  const zc = l.ct + EYE_DISTANCE;
  const o: V3 = [0, 0, 0];
  const dir: V3 = [0, 0, 0];
  const pm: [V3, V3] = [
    [0, 0, 0],
    [0, 0, 0],
  ];
  const trace = (px: number, py: number, pz: number, gx: number, gy: number, gz: number, out: V3) => {
    o[0] = px;
    o[1] = py;
    o[2] = pz;
    out[0] = gx;
    out[1] = gy;
    out[2] = gz;
    return throughLens(o, out, l, R1, R2);
  };
  const compute = (x: number, y: number, bi: number, pi: number) => {
    const il = 1 / Math.hypot(x, y, EYE_DISTANCE);
    const gx = x * il;
    const gy = y * il;
    const gz = -EYE_DISTANCE * il;
    // the turned eye's own axes: right and up, across the gaze
    const rl = 1 / Math.hypot(gz, gx);
    const e1x = -gz * rl;
    const e1z = gx * rl;
    const e2x = -e1z * gy;
    const e2y = e1z * gx - e1x * gz;
    const e2z = e1x * gy;
    const ax = gx * PUPIL;
    const ay = gy * PUPIL;
    const az = zc + gz * PUPIL;
    if (!trace(0, 0, zc, gx, gy, gz, dir)) return false;
    const ex = dir[0];
    const ey = dir[1];
    const ez = dir[2];
    // across the exit ray, in the same right and up
    let u1x = e1x - (e1x * ex + e1z * ez) * ex;
    let u1y = -(e1x * ex + e1z * ez) * ey;
    let u1z = e1z - (e1x * ex + e1z * ez) * ez;
    const iu = 1 / Math.hypot(u1x, u1y, u1z);
    u1x *= iu;
    u1y *= iu;
    u1z *= iu;
    const u2x = u1y * ez - u1z * ey;
    const u2y = u1z * ex - u1x * ez;
    const u2z = u1x * ey - u1y * ex;
    const flip = u2x * e2x + u2y * e2y + u2z * e2z < 0 ? -1 : 1;
    if (!trace(ax + EPS * e1x, ay, az + EPS * e1z, gx, gy, gz, pm[0])) return false;
    if (!trace(ax - EPS * e1x, ay, az - EPS * e1z, gx, gy, gz, pm[1])) return false;
    let dx = pm[0][0] - pm[1][0];
    let dy = pm[0][1] - pm[1][1];
    let dz = pm[0][2] - pm[1][2];
    let P00 = dx * u1x + dy * u1y + dz * u1z;
    let P01 = flip * (dx * u2x + dy * u2y + dz * u2z);
    if (!trace(ax + EPS * e2x, ay + EPS * e2y, az + EPS * e2z, gx, gy, gz, pm[0])) return false;
    if (!trace(ax - EPS * e2x, ay - EPS * e2y, az - EPS * e2z, gx, gy, gz, pm[1])) return false;
    dx = pm[0][0] - pm[1][0];
    dy = pm[0][1] - pm[1][1];
    dz = pm[0][2] - pm[1][2];
    let P10 = dx * u1x + dy * u1y + dz * u1z;
    let P11 = flip * (dx * u2x + dy * u2y + dz * u2z);
    const k = -1000 / (2 * EPS);
    P00 *= k;
    P01 *= k;
    P10 *= k;
    P11 *= k;
    bend[bi] = ex / -ez - x / EYE_DISTANCE;
    bend[bi + 1] = ey / -ez - y / EYE_DISTANCE;
    power[pi] = (P00 + P11) / 2;
    power[pi + 1] = (P00 - P11) / 2;
    power[pi + 2] = (P01 + P10) / 2;
    power[pi + 3] = 1;
    return true;
  };

  // the prescription point itself is the reference: the error there is zero by definition
  compute(0, 0, 0, 0);
  const m00 = power[0];

  for (let j = 0; j < ny; j += 1) {
    const y = -halfY + j * step;
    for (let i = 0; i < nx; i += 1) {
      const x = -halfX + i * step;
      const id = j * nx + i;
      const bi = id * 2;
      const pi = id * 4;
      if (!compute(x, y, bi, pi)) {
        bend[bi] = 0;
        bend[bi + 1] = 0;
        power[pi] = 0;
        power[pi + 1] = 0;
        power[pi + 2] = 0;
      } else {
        power[pi] = (power[pi] - m00) * offAxis;
        power[pi + 1] *= offAxis;
        power[pi + 2] *= offAxis;
      }
      if (addition) {
        bend[bi] -= addition.gx[id];
        bend[bi + 1] -= addition.gy[id];
        power[pi] += addition.m[id];
        power[pi + 1] += addition.j0[id];
        power[pi + 2] += addition.j45[id];
        // the cylinder here as one number, which the shader can smooth: it draws the line around the clear field from it
        power[pi + 3] = 2 * Math.hypot(power[pi + 1], power[pi + 2]);
      }
    }
  }
  return { bend, power };
}

// -------------------------------------------------------------------------------------------- the progressive surface

export interface AdditionDesign {
  add: number;
  /** corridor length, and half-widths of the clear far zone, of the corridor's neck and of the near zone (mm) */
  length: number;
  far: number;
  neck: number;
  near: number;
}

export interface Addition {
  /** slope of the surface as a change of direction (tangents) */
  gx: Float32Array;
  gy: Float32Array;
  m: Float32Array;
  j0: Float32Array;
  j45: Float32Array;
}

/** Fitting cross above the boxed centre, and how far the corridor leans towards the nose (mm). */
export const FIT_Y = 4;
export const INSET = 2.4;

const H = 2;
const SX = (MAP.nx - 1) / H + 1;
const SY = (MAP.ny - 1) / H + 1;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Power along the corridor: a steady rise with short easing at each end (a gentler peak slope means a wider corridor). */
const EASE = 0.22;
const RATE = 1 / (1 - EASE);
const profile = (s: number) => {
  if (s <= 0) return 0;
  if (s >= 1) return 1;
  if (s < EASE) return (RATE * s * s) / (2 * EASE);
  if (s > 1 - EASE) return 1 - (RATE * (1 - s) * (1 - s)) / (2 * EASE);
  return RATE * (s - EASE / 2);
};

/** The surface with the least astigmatism that still gives the wanted power along the corridor and in the two zones. */
export function solveAddition(design: AdditionDesign): Addition {
  const { add, length, far, neck, near } = design;
  const n = SX * SY;
  const band = 2 * SX + 3;
  const A = new Float64Array(n * (band + 1));
  const b = new Float64Array(n);
  const put = (r: number, c: number, v: number) => {
    // lower band: A[r, c], r >= c
    A[r * (band + 1) + (r - c)] += v;
  };
  const yNear = FIT_Y - length;
  const row: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const col: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const addRow = (count: number, weight: number, target: number) => {
    for (let p = 0; p < count; p += 1) {
      const rp = row[p];
      const cp = col[p];
      b[cp] += weight * rp * target;
      for (let q = 0; q < count; q += 1) {
        const cq = col[q];
        if (cq <= cp) put(cp, cq, weight * rp * row[q]);
      }
    }
  };
  const ih2 = 1 / (H * H);
  for (let j = 1; j < SY - 1; j += 1) {
    const y = -MAP.halfY + j * H;
    const s = Math.min(1, Math.max(0, (FIT_Y - y) / length));
    const wanted = add * profile(s);
    const xc = INSET * profile(s);
    for (let i = 1; i < SX - 1; i += 1) {
      const x = -MAP.halfX + i * H;
      const e = Math.abs(x - xc);
      // the far zone's lower edge rises towards the sides, the near zone opens downwards like a funnel
      const side = Math.abs(x) / far;
      const edge = FIT_Y - 1 + 9 * side * side;
      const farZone = smooth(edge - 4, edge + 6, y);
      const opening = neck + (near - neck) * smooth(yNear + 5, yNear - 7, y);
      const nearZone = (1 - smooth(yNear - 2, yNear + 6, y)) * (1 - smooth(opening, opening + 10, e));
      const corridor = Math.exp(-((e / Math.max(1.2, neck * 0.55)) ** 2)) * smooth(yNear - 3, yNear, y) * (1 - smooth(FIT_Y, FIT_Y + 3, y));
      const wMean = 0.02 + 18 * corridor + 2.5 * farZone + 5 * nearZone;
      const wAstig = 0.5 + 1.2 * corridor * (neck / 3) + 6 * farZone + 6 * nearZone;
      const c = j * SX + i;
      const l = c - 1;
      const r = c + 1;
      const d = c - SX;
      const u = c + SX;
      // J0 = (gxx - gyy) / 2
      row[0] = 0.5 * ih2;
      col[0] = l;
      row[1] = 0.5 * ih2;
      col[1] = r;
      row[2] = -0.5 * ih2;
      col[2] = d;
      row[3] = -0.5 * ih2;
      col[3] = u;
      addRow(4, wAstig, 0);
      // J45 = gxy
      row[0] = 0.25 * ih2;
      col[0] = u + 1;
      row[1] = -0.25 * ih2;
      col[1] = u - 1;
      row[2] = -0.25 * ih2;
      col[2] = d + 1;
      row[3] = 0.25 * ih2;
      col[3] = d - 1;
      addRow(4, wAstig, 0);
      // M = (gxx + gyy) / 2
      row[0] = 0.5 * ih2;
      col[0] = l;
      row[1] = 0.5 * ih2;
      col[1] = r;
      row[2] = 0.5 * ih2;
      col[2] = d;
      row[3] = 0.5 * ih2;
      col[3] = u;
      row[4] = -2 * ih2;
      col[4] = c;
      addRow(5, wMean, wanted);
    }
  }
  // the second differences cannot see a tilt or a shift: pin those softly, then remove them exactly below
  for (let c = 0; c < n; c += 1) put(c, c, 1e-7);
  // banded Cholesky
  const w = band + 1;
  for (let k = 0; k < n; k += 1) {
    const kk = k * w;
    let dkk = A[kk];
    const from = Math.max(0, k - band);
    for (let p = from; p < k; p += 1) {
      const v = A[kk + (k - p)];
      dkk -= v * v;
    }
    const piv = Math.sqrt(Math.max(dkk, 1e-14));
    A[kk] = piv;
    const last = Math.min(n - 1, k + band);
    for (let r = k + 1; r <= last; r += 1) {
      const rr = r * w;
      let v = A[rr + (r - k)];
      const start = Math.max(0, r - band);
      for (let p = Math.max(from, start); p < k; p += 1) v -= A[rr + (r - p)] * A[kk + (k - p)];
      A[rr + (r - k)] = v / piv;
    }
  }
  for (let r = 0; r < n; r += 1) {
    let v = b[r];
    const rr = r * w;
    for (let p = Math.max(0, r - band); p < r; p += 1) v -= A[rr + (r - p)] * b[p];
    b[r] = v / A[rr];
  }
  for (let r = n - 1; r >= 0; r -= 1) {
    let v = b[r];
    for (let c = r + 1; c <= Math.min(n - 1, r + band); c += 1) v -= A[c * w + (c - r)] * b[c];
    b[r] = v / A[r * w];
  }

  // on to the lens map's finer grid: curvatures from the solved nodes themselves, then a smooth (Catmull-Rom) interpolant
  const { nx, ny } = MAP;
  const out: Addition = { gx: new Float32Array(nx * ny), gy: new Float32Array(nx * ny), m: new Float32Array(nx * ny), j0: new Float32Array(nx * ny), j45: new Float32Array(nx * ny) };
  const at = (i: number, j: number) => b[Math.min(SY - 1, Math.max(0, j)) * SX + Math.min(SX - 1, Math.max(0, i))];
  const nodes = (fn: (i: number, j: number) => number) => {
    const a = new Float64Array(n);
    for (let j = 0; j < SY; j += 1) {
      for (let i = 0; i < SX; i += 1) {
        // the outermost row has no neighbours of its own: it takes the curvature just inside it
        a[j * SX + i] = fn(Math.min(SX - 2, Math.max(1, i)), Math.min(SY - 2, Math.max(1, j)));
      }
    }
    return a;
  };
  const curvM = nodes((i, j) => (at(i - 1, j) + at(i + 1, j) + at(i, j - 1) + at(i, j + 1) - 4 * at(i, j)) * ih2 * 0.5);
  const curvJ0 = nodes((i, j) => (at(i - 1, j) + at(i + 1, j) - at(i, j - 1) - at(i, j + 1)) * ih2 * 0.5);
  const curvJ45 = nodes((i, j) => (at(i + 1, j + 1) - at(i - 1, j + 1) - at(i + 1, j - 1) + at(i - 1, j - 1)) * ih2 * 0.25);
  const cr = (p0: number, p1: number, p2: number, p3: number, t: number) => 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
  const fine = new Float64Array(nx * ny);
  const refine = (src: Float64Array, dst: Float32Array | Float64Array) => {
    const v = (i: number, j: number) => src[Math.min(SY - 1, Math.max(0, j)) * SX + Math.min(SX - 1, Math.max(0, i))];
    for (let j = 0; j < ny; j += 1) {
      const j0 = Math.floor(j / H);
      const ty = j / H - j0;
      for (let i = 0; i < nx; i += 1) {
        const i0 = Math.floor(i / H);
        const tx = i / H - i0;
        const r0 = cr(v(i0 - 1, j0 - 1), v(i0, j0 - 1), v(i0 + 1, j0 - 1), v(i0 + 2, j0 - 1), tx);
        const r1 = cr(v(i0 - 1, j0), v(i0, j0), v(i0 + 1, j0), v(i0 + 2, j0), tx);
        const r2 = cr(v(i0 - 1, j0 + 1), v(i0, j0 + 1), v(i0 + 1, j0 + 1), v(i0 + 2, j0 + 1), tx);
        const r3 = cr(v(i0 - 1, j0 + 2), v(i0, j0 + 2), v(i0 + 1, j0 + 2), v(i0 + 2, j0 + 2), tx);
        dst[j * nx + i] = cr(r0, r1, r2, r3, ty);
      }
    }
  };
  refine(curvM, out.m);
  refine(curvJ0, out.j0);
  refine(curvJ45, out.j45);
  refine(b as unknown as Float64Array, fine);
  const pick = (i: number, j: number) => fine[Math.min(ny - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))];
  // slope at the fitting cross, so that looking straight ahead the wearer sees no prism from the addition
  const fi = Math.round(MAP.halfX);
  const fj = Math.round(MAP.halfY + FIT_Y);
  const sx0 = (pick(fi + 1, fj) - pick(fi - 1, fj)) / 2;
  const sy0 = (pick(fi, fj + 1) - pick(fi, fj - 1)) / 2;
  // prism thinning: the near zone's base-up prism shared over the lens, as on a real progressive
  const syNear = (pick(fi + 2, Math.round(MAP.halfY + yNear) + 1) - pick(fi + 2, Math.round(MAP.halfY + yNear) - 1)) / 2;
  const thinning = (syNear - sy0) * 0.45;
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const id = j * nx + i;
      out.gx[id] = ((pick(i + 1, j) - pick(i - 1, j)) / 2 - sx0) / 1000;
      out.gy[id] = ((pick(i, j + 1) - pick(i, j - 1)) / 2 - sy0 - thinning) / 1000;
    }
  }
  return out;
}
