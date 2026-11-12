// Pupillary distance (PD) from the face landmarks of single video frames. Plain geometry, no DOM: the studio feeds it
// landmarks and gets back a hint for the visitor and, once enough steady frames are in, an estimate in millimetres.
//
// Scale. A camera picture has no millimetres in it, so something of known size has to be in view:
//  - the iris itself. Its visible width is close to the same in every adult (about 11.7 mm, give or take half a
//    millimetre from person to person), which makes it a ruler everyone carries. That person-to-person spread is the
//    limit of this method: it is an estimate, a few millimetres either way.
//  - optionally a standard card (ID-1: bank, ID and loyalty cards are all 85.60 mm wide) held flat on the forehead.
//    Then the scale no longer depends on the visitor's iris.
// Either way the result is a guide for choosing and comparing. The PD used to make lenses is measured in the boutique.
import { clamp, headRotationFromMatrix, type Point } from '@/site/tryon/pose';

/** Visible iris width in millimetres (the "white-to-white" diameter), the population average. */
export const IRIS_MM = 11.7;
/** ISO/IEC 7810 ID-1 card: 85.60 × 53.98 mm. */
export const CARD_MM = 85.6;
export const CARD_RATIO = 85.6 / 53.98;
/** How far in front of the iris plane a card held flat on the forehead sits (brow ridge to iris), in millimetres. */
const CARD_AHEAD_MM = 12;
/** Iris centre to the eye's centre of rotation, in millimetres: how far the pupils swing inward when looking at something near. */
const EYE_ARM_MM = 10;
/** Focal length as a fraction of the frame's longer side, for a typical front camera (about 65° across that side). */
const FOCAL = 0.785;

/**
 * Frames that make up one measurement: at least SAMPLES, and more when they scatter, until the middle value of all
 * of them is settled to within SETTLED_MM. A steady face in good light is done in two seconds; a shaky hand or
 * a grainy picture takes longer instead of never finishing. Past MOST_SAMPLES the older half is let go.
 */
export const SAMPLES = 36;
const SETTLED_MM = 0.4;
const MOST_SAMPLES = 140;
/** A longer pause than this between good frames means the pose was lost: start the count again. */
const MAX_GAP_MS = 1200;

export type Hint = 'ok' | 'noFace' | 'multiple' | 'tooFar' | 'tooClose' | 'centre' | 'turn' | 'tilt' | 'level' | 'blink';

export interface Reading {
  hint: Hint;
  /** Iris centres in frame pixels: the visitor's own right and left eye. */
  right: { x: number; y: number };
  left: { x: number; y: number };
  /** Mean iris width of the two eyes, px. */
  irisPx: number;
  /** Distance between the iris centres, px, with the head's turn taken out. */
  ipdPx: number;
  /** Where the middle of the nose bridge falls between the right (0) and the left (1) pupil. */
  mid: number;
  /** Rough distance from the camera to the eyes, mm. */
  distance: number;
  /** The face's outline box in frame pixels (cheek to cheek, forehead to chin). */
  face: { x0: number; y0: number; x1: number; y1: number };
  yaw: number;
  pitch: number;
  roll: number;
}

const px = (p: Point, w: number, h: number) => ({ x: p.x * w, y: p.y * h });
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const ok = (p: Point | undefined): p is Point => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
const DEG = Math.PI / 180;

/**
 * One frame → where the eyes are and whether the frame is good enough to measure from. `faces` are MediaPipe's
 * landmarks (0–1 of the frame), `w`/`h` the frame size in pixels. Returns null when there is nothing to draw at all.
 */
export function readFrame(faces: Point[][], matrix: ArrayLike<number> | null | undefined, w: number, h: number): Reading | { hint: 'noFace' | 'multiple' } {
  if (!faces.length) return { hint: 'noFace' };
  if (faces.length > 1) return { hint: 'multiple' };
  const f = faces[0];
  // 468–472: the visitor's right iris (centre, then four points on its rim); 473–477: the left one.
  const need = [468, 469, 471, 473, 474, 476, 133, 362, 168, 159, 145, 386, 374, 234, 454, 10, 152];
  if (need.some((i) => !ok(f[i]))) return { hint: 'noFace' };
  const right = px(f[468], w, h);
  const left = px(f[473], w, h);
  const irisR = dist(px(f[469], w, h), px(f[471], w, h));
  const irisL = dist(px(f[474], w, h), px(f[476], w, h));
  const irisPx = (irisR + irisL) / 2;
  const raw = dist(right, left);
  if (!(irisPx > 2 && raw > 8)) return { hint: 'noFace' };

  const head = headRotationFromMatrix(matrix);
  const yaw = head?.yaw ?? 0;
  const pitch = head?.pitch ?? 0;
  const roll = Math.atan2(left.y - right.y, left.x - right.x);
  // A turned head shortens the line between the eyes but not the irises, which keep facing the camera.
  const ipdPx = raw / Math.max(0.9, Math.cos(yaw));

  // The middle of the face at eye level: between the inner eye corners, and the nose bridge.
  const inner = { x: (f[133].x + f[362].x) / 2, y: (f[133].y + f[362].y) / 2 };
  const bridge = px({ x: (inner.x + f[168].x) / 2, y: (inner.y + f[168].y) / 2 }, w, h);
  const ax = left.x - right.x;
  const ay = left.y - right.y;
  const mid = clamp(((bridge.x - right.x) * ax + (bridge.y - right.y) * ay) / (ax * ax + ay * ay), 0.35, 0.65);

  const distance = (FOCAL * Math.max(w, h) * IRIS_MM) / irisPx;
  const size = raw / Math.min(w, h);
  const edge = (i: number) => f[i].x < 0.02 || f[i].x > 0.98 || f[i].y < 0.02 || f[i].y > 0.98;
  const lids = Math.min(dist(px(f[159], w, h), px(f[145], w, h)) / irisR, dist(px(f[386], w, h), px(f[374], w, h)) / irisL);

  let hint: Hint = 'ok';
  if (size < 0.13) hint = 'tooFar';
  else if (size > 0.46) hint = 'tooClose';
  else if (edge(234) || edge(454) || edge(10) || edge(152)) hint = 'centre';
  else if (Math.abs(yaw) > 7 * DEG || Math.abs(irisR - irisL) / irisPx > 0.16) hint = 'turn';
  else if (Math.abs(pitch) > 18 * DEG) hint = 'tilt';
  else if (Math.abs(roll) > 8 * DEG && Math.abs(Math.abs(roll) - Math.PI) > 8 * DEG) hint = 'level';
  else if (lids < 0.45) hint = 'blink';
  const face = { x0: Math.min(f[234].x, f[454].x) * w, x1: Math.max(f[234].x, f[454].x) * w, y0: Math.min(f[10].y, f[152].y) * h, y1: Math.max(f[10].y, f[152].y) * h };
  return { hint, right, left, irisPx, ipdPx, mid, distance, face, yaw, pitch, roll };
}

export const isReading = (r: Reading | { hint: 'noFace' | 'multiple' }): r is Reading => 'irisPx' in r;

const median = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const quantile = (values: number[], q: number) => {
  const s = [...values].sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  return s[lo] + (s[Math.min(s.length - 1, lo + 1)] - s[lo]) * (i - lo);
};
/** To the nearest half millimetre, the step an optician's ruler reads to. */
export const half = (mm: number) => Math.round(mm * 2) / 2;

export interface PdResult {
  /**
   * Distance PD, mm, to the nearest 0.5. Only the distance between the two pupils: how it divides between the right
   * and the left eye is not reported, because a head turned by a couple of degrees moves that split by a millimetre.
   */
  pd: number;
  method: 'iris' | 'card';
  /** Camera distance the measurement was taken at, mm (rough). */
  distance: number;
}

/** Looking at a phone at arm's length turns both eyes slightly inward. This is the PD for looking far away. */
const farFromNear = (near: number, distance: number) => near * (1 + EYE_ARM_MM / Math.max(200, distance));

function result(nearMm: number, distance: number, method: PdResult['method']): PdResult | null {
  const pd = half(farFromNear(nearMm, distance));
  // Outside anything an optician sees in adults or children: the frame was misread, not a face to report on.
  if (!(pd >= 45 && pd <= 80)) return null;
  return { pd, method, distance };
}

/** Collects good frames and says when they agree well enough to be a measurement. */
export function createSampler() {
  let samples: { t: number; mm: number; distance: number }[] = [];
  return {
    get count() {
      return samples.length;
    },
    reset() {
      samples = [];
    },
    /** Adds a good frame. Returns progress 0–1, a running value once there is one, and the result when done. */
    add(r: Reading, now: number): { progress: number; live: number | null; done: PdResult | null; unsteady: boolean } {
      if (samples.length && now - samples[samples.length - 1].t > MAX_GAP_MS) samples = [];
      samples.push({ t: now, mm: (r.ipdPx / r.irisPx) * IRIS_MM, distance: r.distance });
      // Too scattered for too long (moving about, changing light): keep the newer half and go on.
      if (samples.length > MOST_SAMPLES) samples = samples.slice(samples.length >> 1);
      const mm = samples.map((s) => s.mm);
      const n = mm.length;
      const live = n >= 8 ? farFromNear(median(mm), median(samples.map((s) => s.distance))) : null;
      // The middle value of n frames is off by about 0.93 × (their interquartile range) / √n: how many frames that asks for.
      const spread = n >= 8 ? quantile(mm, 0.75) - quantile(mm, 0.25) : 0;
      const needed = Math.max(SAMPLES, Math.ceil(((0.93 * spread) / SETTLED_MM) ** 2));
      if (n < needed) return { progress: Math.min(0.97, n / needed), live, done: null, unsteady: n >= SAMPLES };
      const done = result(median(mm), median(samples.map((s) => s.distance)), 'iris');
      if (!done) samples = [];
      return { progress: done ? 1 : 0, live, done, unsteady: !done };
    },
  };
}

/**
 * The card method: one still frame, the reading taken from it, and the card's two short edges as x positions in
 * frame pixels. The card sits a little nearer the camera than the eyes, so it looks slightly larger than it would
 * at their depth; that is taken out before it is used as the ruler.
 */
export function fromCard(r: Reading, cardLeftPx: number, cardRightPx: number, longSide: number): PdResult | null {
  const cardPx = Math.abs(cardRightPx - cardLeftPx);
  if (!(cardPx > 20)) return null;
  const cardDistance = (FOCAL * longSide * CARD_MM) / cardPx;
  const distance = cardDistance + CARD_AHEAD_MM;
  const near = ((r.ipdPx * CARD_MM) / cardPx) * (distance / cardDistance);
  // The same ruler applied to the iris has to give an iris: otherwise the markers are not on the card's edges.
  const iris = ((r.irisPx * CARD_MM) / cardPx) * (distance / cardDistance);
  if (!(iris > 9.8 && iris < 13.6)) return null;
  return result(near, distance, 'card');
}

/** Where a card of the right size would sit in this frame if centred over the nose bridge: the starting guess for its edges. */
export function expectedCard(r: Reading): { left: number; right: number; top: number; bottom: number } {
  const pxPerMm = r.irisPx / IRIS_MM;
  const w = CARD_MM * pxPerMm * (r.distance / Math.max(100, r.distance - CARD_AHEAD_MM));
  const cx = r.right.x + (r.left.x - r.right.x) * r.mid;
  const eyeY = (r.right.y + r.left.y) / 2;
  // Bottom edge a little above the eyebrows (about 25 mm above the pupils), the card's own height above that.
  const bottom = eyeY - 22 * pxPerMm;
  return { left: cx - w / 2, right: cx + w / 2, top: bottom - w / CARD_RATIO, bottom };
}

/**
 * Finds the card's two short edges in a still frame, starting from where they are expected. `rgba` is the frame's
 * pixels, row by row. Looks along a band through the middle of the expected card for the pair of clear vertical
 * edges about one card-width apart. Colour is compared, not only brightness: a card can be as light as the skin
 * beside it and still be a different colour, and what lies either side of it differs (skin on one, hair on the
 * other). Returns the expected positions when nothing clear is found: the visitor fine-tunes the lines by hand
 * either way.
 */
export function findCardEdges(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, guess: { left: number; right: number; top: number; bottom: number }): { left: number; right: number; found: boolean } {
  const none = { left: guess.left, right: guess.right, found: false };
  const width = guess.right - guess.left;
  const y0 = Math.round(clamp(guess.top + (guess.bottom - guess.top) * 0.3, 0, h - 2));
  const y1 = Math.round(clamp(guess.top + (guess.bottom - guess.top) * 0.8, y0 + 1, h - 1));
  const x0 = Math.round(clamp(guess.left - width * 0.45, 2, w - 3));
  const x1 = Math.round(clamp(guess.right + width * 0.45, x0 + 4, w - 3));
  const n = x1 - x0 + 1;
  if (!(width > 20) || n < 24 || y1 - y0 < 3) return none;
  // Mean colour of each column of the band.
  const col = new Float32Array(n * 3);
  const rows = y1 - y0 + 1;
  for (let x = 0; x < n; x++) {
    let r = 0;
    let g = 0;
    let b = 0;
    for (let y = y0; y <= y1; y++) {
      const i = (y * w + x0 + x) * 4;
      r += rgba[i];
      g += rgba[i + 1];
      b += rgba[i + 2];
    }
    col[x * 3] = r / rows;
    col[x * 3 + 1] = g / rows;
    col[x * 3 + 2] = b / rows;
  }
  /** How much the colour changes across the boundary just left of column x, looking `step` columns each way. */
  const change = (x: number, step: number) => {
    const a = (x - step) * 3;
    const b = (x + step - 1) * 3;
    return Math.abs(col[b] - col[a]) + Math.abs(col[b + 1] - col[a + 1]) + Math.abs(col[b + 2] - col[a + 2]);
  };
  const step = Math.max(2, Math.round(width / 80));
  const edge = new Float32Array(n);
  // One very strong edge (hair against skin) must not outweigh two ordinary ones: cap what a single edge can add.
  for (let x = step; x <= n - step; x++) edge[x] = Math.min(150, change(x, step));
  let best = { score: 0, l: -1, r: -1 };
  for (let l = step; l <= n - step; l++) {
    if (edge[l] < 22) continue;
    for (let r = Math.ceil(l + width * 0.78); r <= Math.min(n - step, l + width * 1.28); r++) {
      if (edge[r] < 22) continue;
      const size = Math.abs((r - l) / width - 1);
      const off = Math.abs((l + r) / 2 + x0 - (guess.left + guess.right) / 2) / width;
      const score = (edge[l] + edge[r]) * (1 - Math.min(0.5, size * 1.2)) * (1 - Math.min(0.5, off));
      if (score > best.score) best = { score, l, r };
    }
  }
  if (best.l < 0 || best.score < 60) return none;
  // The wide look finds the edge to within `step`; the sharpest single-column change nearby is the edge itself.
  const sharpen = (x: number) => {
    let at = x;
    let most = -1;
    for (let i = Math.max(1, x - step); i <= Math.min(n - 1, x + step); i++) {
      const c = change(i, 1);
      if (c > most) {
        most = c;
        at = i;
      }
    }
    return at;
  };
  return { left: sharpen(best.l) + x0, right: sharpen(best.r) + x0, found: true };
}
