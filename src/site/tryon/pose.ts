// Face landmarks → glasses pose. All coordinates are normalised to the displayed stage (0–1), never
// biometric measurements. Ported from the original Optika try-on (tryOnPose.js).
import type { FrameDims } from './frames';

export interface Point {
  x: number;
  y: number;
  z?: number;
}

/** Glasses placement on the stage: centre (0–1), width as a fraction of the stage width (×2/2.12), angles in rad. */
export interface FacePose {
  x: number;
  y: number;
  scale: number;
  yaw: number;
  pitch: number;
  roll: number;
  visible?: boolean;
  /** iris distance as a fraction of the stage width (used for "too close / too far" hints) */
  eyeDistance: number;
}

/** Manual fine-tuning from the UI: scale factor, vertical/horizontal offsets (−0.12…0.12), rotation in degrees. */
export interface ManualFit {
  scale: number;
  vertical: number;
  horizontal: number;
  rotation: number;
}

export const NO_FIT: ManualFit = { scale: 1, vertical: 0, horizontal: 0, rotation: 0 };

/** Model width in renderer units (the procedural frame is always built this wide). */
export const NOMINAL_WIDTH = 2.12;

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const finite = (p: Point | undefined): p is Point => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
function mean(points: Point[], indexes: number[]): Point | undefined {
  const valid = indexes.map((i) => points[i]).filter(finite);
  if (!valid.length) return undefined;
  return valid.reduce((s, p) => ({ x: s.x + p.x / valid.length, y: s.y + p.y / valid.length }), { x: 0, y: 0 });
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * object-fit: cover rectangle for a source inside the stage. `focus` (0–1) keeps that point of the source as
 * close to the stage centre as the crop allows — used to keep a face in view on narrow phone stages.
 */
export function coverRect(srcW: number, srcH: number, stageW: number, stageH: number, focus = { x: 0.5, y: 0.5 }): Rect {
  if (!(srcW > 0 && srcH > 0 && stageW > 0 && stageH > 0)) return { x: 0, y: 0, w: stageW, h: stageH };
  const scale = Math.max(stageW / srcW, stageH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  const x = clamp(stageW / 2 - focus.x * w, stageW - w, 0);
  const y = clamp(stageH / 2 - focus.y * h, stageH - h, 0);
  return { x, y, w, h };
}

/** Landmarks normalised to the source image → normalised to the stage, given where the source is drawn. */
export function mapToStage(points: Point[], rect: Rect, stageW: number, stageH: number): Point[] {
  if (!(stageW > 0 && stageH > 0)) return points;
  return points.map((p) => ({ ...p, x: (rect.x + p.x * rect.w) / stageW, y: (rect.y + p.y * rect.h) / stageH }));
}

/** Yaw / pitch / roll from MediaPipe's column-major facial transformation matrix. */
export function headRotationFromMatrix(data: ArrayLike<number> | null | undefined) {
  if (!data || data.length !== 16 || !Array.from(data).every(Number.isFinite)) return null;
  // Remove uniform scale before extracting the column-major YXZ rotation.
  const sy = Math.hypot(data[4], data[5], data[6]);
  const sz = Math.hypot(data[8], data[9], data[10]);
  const sx = Math.hypot(data[0], data[1], data[2]);
  if (Math.min(sx, sy, sz) < 0.0001) return null;
  const r12 = data[9] / sz;
  if (Math.abs(r12) > 0.9999) return null;
  return {
    yaw: Math.atan2(data[8] / sz, data[10] / sz),
    pitch: Math.asin(-clamp(r12, -1, 1)),
    roll: Math.atan2(data[1] / sx, data[5] / sy),
  };
}

/** Bounded catalogue measurements (mm) — never inferred from the visitor's face. */
export function safeDims(d: Partial<FrameDims>): FrameDims {
  const safe = (v: unknown, fallback: number, min: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
  };
  return {
    frameWidth: safe(d.frameWidth, 140, 95, 190),
    lensWidth: safe(d.lensWidth, 52, 30, 80),
    lensHeight: safe(d.lensHeight, 40, 20, 65),
    bridgeWidth: safe(d.bridgeWidth, 19, 10, 30),
    templeLength: safe(d.templeLength, 140, 100, 180),
  };
}

/**
 * Pose for the glasses from 478 face landmarks (stage-normalised) and the facial transformation matrix.
 * The frame is scaled so that its lens centres sit on the irises: frame width ≈ eye distance × frameWidth /
 * (lensWidth + bridgeWidth).
 */
export function poseFromLandmarks(
  points: Point[],
  opts: { mirror?: boolean; manual?: ManualFit; matrix?: ArrayLike<number> | null; aspect: number; dims: FrameDims },
): FacePose | null {
  const { mirror = false, manual = NO_FIT, matrix = null, aspect, dims } = opts;
  if (!points?.length || !(aspect > 0)) return null;
  // Iris centres when available; eye corners are a stable fallback for non-refined landmarks.
  const left = finite(points[468]) ? points[468] : mean(points, [33, 133, 159, 145]);
  const right = finite(points[473]) ? points[473] : mean(points, [263, 362, 386, 374]);
  const nose = points[1];
  const bridge = finite(points[168]) ? points[168] : nose;
  if (!finite(left) || !finite(right) || !finite(nose) || !finite(bridge) || !finite(points[234]) || !finite(points[454])) return null;
  const dx = right.x - left.x;
  const dy = (right.y - left.y) / aspect;
  const eyeDistance = Math.hypot(dx, dy);
  const faceWidth = Math.hypot(points[454].x - points[234].x, (points[454].y - points[234].y) / aspect);
  if (eyeDistance < 0.005 || faceWidth < 0.01) return null;
  const midpoint = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
  const head = headRotationFromMatrix(matrix);
  const yaw = clamp(head?.yaw ?? ((nose.x - midpoint.x) / faceWidth) * 3.2, -0.95, 0.95);
  const pitch = clamp(head?.pitch ?? 0, -0.48, 0.48);
  // Compensate 2D eye-distance foreshortening once; the model rotation supplies the projection.
  const frontalEyeDistance = eyeDistance / Math.max(0.64, Math.cos(yaw));
  const projectedFrameWidth = (frontalEyeDistance * dims.frameWidth) / (dims.lensWidth + dims.bridgeWidth);
  const centerX = midpoint.x * 0.78 + bridge.x * 0.22;
  const roll = Math.atan2(dy, dx);
  return {
    x: (mirror ? 1 - centerX : centerX) + manual.horizontal,
    y: midpoint.y + eyeDistance * aspect * (0.055 + manual.vertical * 2.4),
    scale: projectedFrameWidth * (2 / NOMINAL_WIDTH) * (manual.scale || 1),
    yaw: mirror ? -yaw : yaw,
    pitch,
    roll: (mirror ? -roll : roll) + (manual.rotation * Math.PI) / 180,
    eyeDistance,
    visible: true,
  };
}

export function stopMediaStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}

/**
 * A permission prompt can finish after a mode change or unmount. Only its current owner may attach the
 * stream; stale sessions are stopped immediately.
 */
export function createCameraSession() {
  let revision = 0;
  return {
    begin: () => ++revision,
    cancel: () => {
      revision += 1;
    },
    current: (token: number) => token === revision,
    accept(token: number, stream: MediaStream) {
      if (token === revision) return true;
      stopMediaStream(stream);
      return false;
    },
  };
}
