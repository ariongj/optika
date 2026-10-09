// All coordinates are normalized to the displayed media, never biometric measurements.
export const clampTryOn = (value, min, max) => Math.min(max, Math.max(min, value));
const finitePoint = (point) => point && Number.isFinite(point.x) && Number.isFinite(point.y);
const mean = (points, indexes) => {
  const valid = indexes.map((index) => points[index]).filter(finitePoint);
  if (!valid.length) return null;
  return valid.reduce((sum, point) => ({ x: sum.x + point.x / valid.length, y: sum.y + point.y / valid.length }), { x: 0, y: 0 });
};

export function coverLandmarks(points, sourceWidth, sourceHeight, stageWidth, stageHeight) {
  if (![sourceWidth, sourceHeight, stageWidth, stageHeight].every((value) => Number.isFinite(value) && value > 0)) return points;
  const scale = Math.max(stageWidth / sourceWidth, stageHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return points.map((point) => ({ ...point, x: (point.x * width + (stageWidth - width) / 2) / stageWidth, y: (point.y * height + (stageHeight - height) / 2) / stageHeight }));
}

export function headRotationFromMatrix(data) {
  if (!data || data.length !== 16 || !Array.from(data).every(Number.isFinite)) return null;
  // Remove uniform scale before extracting the column-major YXZ rotation.
  const sy = Math.hypot(data[4], data[5], data[6]);
  const sz = Math.hypot(data[8], data[9], data[10]);
  const sx = Math.hypot(data[0], data[1], data[2]);
  if (Math.min(sx, sy, sz) < 0.0001) return null;
  const r12 = data[9] / sz;
  if (Math.abs(r12) > 0.9999) return null;
  return { yaw: Math.atan2(data[8] / sz, data[10] / sz), pitch: Math.asin(-clampTryOn(r12, -1, 1)), roll: Math.atan2(data[1] / sx, data[5] / sy) };
}

export function frameDimensions(product = {}) {
  const safe = (value, fallback, min, max) => Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max ? Number(value) : fallback;
  return {
    frameWidth: safe(product.frameWidth, 140, 95, 190),
    lensWidth: safe(product.lensWidth, 52, 30, 80),
    lensHeight: safe(product.lensHeight, /aviator|round|panto/i.test(product.frameShape || '') ? 44 : 39, 20, 65),
    bridgeWidth: safe(product.bridgeWidth, 19, 10, 30),
    templeLength: safe(product.templeLength, 140, 100, 180),
  };
}

export function poseFromLandmarks(points, { mirror = false, manual = {}, matrix = null, aspect = 1, product = {} } = {}) {
  if (!points?.length || !(aspect > 0)) return null;
  // Iris centres when available; eye corners are a stable fallback for non-refined landmarks.
  const left = finitePoint(points[468]) ? points[468] : mean(points, [33, 133, 159, 145]);
  const right = finitePoint(points[473]) ? points[473] : mean(points, [263, 362, 386, 374]);
  const nose = points[1];
  const bridge = finitePoint(points[168]) ? points[168] : nose;
  if (![left, right, nose, bridge, points[234], points[454]].every(finitePoint)) return null;
  const dx = right.x - left.x;
  const dy = (right.y - left.y) / aspect;
  const eyeDistance = Math.hypot(dx, dy);
  const faceWidth = Math.hypot(points[454].x - points[234].x, (points[454].y - points[234].y) / aspect);
  if (eyeDistance < 0.005 || faceWidth < 0.01) return null;
  const midpoint = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
  const head = headRotationFromMatrix(matrix);
  const yaw = clampTryOn(head?.yaw ?? ((nose.x - midpoint.x) / faceWidth) * 3.2, -0.95, 0.95);
  const pitch = clampTryOn(head?.pitch ?? 0, -0.48, 0.48);
  const dimensions = frameDimensions(product);
  // Compensate 2D eye-distance foreshortening once; model rotation supplies the projection.
  const frontalEyeDistance = eyeDistance / Math.max(0.64, Math.cos(yaw));
  const projectedFrameWidth = frontalEyeDistance * dimensions.frameWidth / (dimensions.lensWidth + dimensions.bridgeWidth);
  const centerX = midpoint.x * 0.78 + bridge.x * 0.22;
  return {
    x: (mirror ? 1 - centerX : centerX) + Number(manual.horizontal || 0),
    y: midpoint.y + eyeDistance * aspect * (0.055 + Number(manual.vertical || 0) * 2.4),
    scale: projectedFrameWidth * (2 / 2.12) * (Number(manual.scale) || 1),
    yaw: mirror ? -yaw : yaw,
    pitch,
    roll: (mirror ? -Math.atan2(dy, dx) : Math.atan2(dy, dx)) + Number(manual.rotation || 0) * Math.PI / 180,
    eyeDistance, faceWidth, visible: true,
  };
}

export function stopMediaStream(stream) {
  stream?.getTracks?.().forEach((track) => track.stop());
}

// A permission prompt can finish after a mode change or unmount. Only its current
// owner may attach the stream; stale sessions are stopped immediately.
export function createCameraSession() {
  let revision = 0;
  return {
    begin: () => ++revision,
    cancel: () => { revision += 1; },
    current: (token) => token === revision,
    accept(token, stream) {
      if (token === revision) return true;
      stopMediaStream(stream);
      return false;
    },
  };
}
