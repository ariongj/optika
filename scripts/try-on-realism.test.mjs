import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { coverLandmarks, headRotationFromMatrix, poseFromLandmarks, frameDimensions, createCameraSession, stopMediaStream } from '../src/tryOnPose.js';
import { createGlassesModel, modelVisualBounds, fitViewerBounds, normalizeCatalogGeometry } from '../src/virtualTryOn3D.js';

const close = (actual, expected, epsilon = 1e-7) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);
const face = () => {
  const points = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  points[468] = { x: 0.36, y: 0.42 }; points[473] = { x: 0.64, y: 0.42 };
  points[1] = { x: 0.5, y: 0.52 }; points[168] = { x: 0.5, y: 0.4 };
  points[234] = { x: 0.23, y: 0.5 }; points[454] = { x: 0.77, y: 0.5 };
  return points;
};
const matrix = (yaw = 0, pitch = 0) => new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')).elements;
const product = { id: 'test', frameWidth: 140, lensWidth: 52, lensHeight: 40, bridgeWidth: 19, templeLength: 140, frameShape: 'Square', material: 'Acetate', color: 'Black', lensColor: 'Smoke' };
const dispose = (model) => model.traverse((item) => { item.geometry?.dispose(); const materials = Array.isArray(item.material) ? item.material : [item.material]; materials.filter(Boolean).forEach((material) => material.dispose()); });

test('cover projection matches the displayed crop and keeps its centre', () => {
  const result = coverLandmarks([{ x: 0.5, y: 0.5 }, { x: 0, y: 0 }], 1600, 900, 400, 600);
  close(result[0].x, 0.5); close(result[0].y, 0.5);
  assert.ok(result[1].x < 0); close(result[1].y, 0);
});
test('invalid media dimensions return unchanged landmarks', () => {
  const points = face(); assert.equal(coverLandmarks(points, 0, 0, 400, 300), points);
});
test('matrix extraction handles known yaw/pitch and uniform authoring scale', () => {
  for (const yaw of [-0.7, 0, 0.7]) {
    const data = matrix(yaw, 0.2).map((value, index) => index < 12 ? value * 2 : value);
    const rotation = headRotationFromMatrix(data); close(rotation.yaw, yaw); close(rotation.pitch, 0.2);
  }
});
test('invalid matrices and incomplete landmarks are safe null results', () => {
  assert.equal(headRotationFromMatrix(Array(16).fill(NaN)), null);
  assert.equal(headRotationFromMatrix(Array(16).fill(0)), null);
  assert.equal(poseFromLandmarks([]), null);
  assert.equal(poseFromLandmarks([{ x: 0.5, y: 0.5 }]), null);
});
test('front-facing pose starts straight and bridge-centred', () => {
  const pose = poseFromLandmarks(face(), { matrix: matrix(), product });
  close(pose.x, 0.5); close(pose.yaw, 0); close(pose.roll, 0);
  close(pose.scale, 0.28 * 140 / 71 * 2 / 2.12);
});
test('mirroring flips horizontal position and yaw once, not twice', () => {
  const points = face().map((point) => ({ ...point, x: point.x - 0.1 }));
  const normal = poseFromLandmarks(points, { matrix: matrix(0.3), product });
  const mirror = poseFromLandmarks(points, { mirror: true, matrix: matrix(0.3), product });
  close(normal.x + mirror.x, 1); close(normal.yaw, -mirror.yaw); close(normal.scale, mirror.scale);
});
test('screen aspect is included in roll, preventing tilted frames on wide stages', () => {
  const points = face(); points[473].y += 0.14;
  close(poseFromLandmarks(points, { aspect: 2 }).roll, Math.atan2(0.07, 0.28));
});
test('eye foreshortening is compensated before applying 3D head rotation', () => {
  const points = face(); const yaw = 0.6;
  points[468].x = 0.5 - 0.14 * Math.cos(yaw); points[473].x = 0.5 + 0.14 * Math.cos(yaw);
  const front = poseFromLandmarks(face(), { matrix: matrix(), product });
  const turned = poseFromLandmarks(points, { matrix: matrix(yaw), product });
  close(front.scale, turned.scale); close(front.x, turned.x);
});
test('all manual adjustments affect the pose without rerunning face detection', () => {
  const base = poseFromLandmarks(face(), { product });
  const moved = poseFromLandmarks(face(), { product, manual: { scale: 1.15, horizontal: 0.05, vertical: 0.04, rotation: 10 } });
  close(moved.x - base.x, 0.05); close(moved.scale / base.scale, 1.15);
  assert.ok(moved.y > base.y); close(moved.roll, Math.PI / 18);
});
test('catalogue dimensions are bounded, missing dimensions remain defaults not face measurements', () => {
  assert.deepEqual(frameDimensions({ frameWidth: -1, lensWidth: Infinity, lensHeight: NaN, bridgeWidth: 200, templeLength: 2 }), frameDimensions());
  assert.equal(frameDimensions(product).frameWidth, 140);
});
test('a stale permission response stops every camera track', () => {
  const session = createCameraSession(); const token = session.begin(); let stops = 0;
  session.cancel(); assert.equal(session.accept(token, { getTracks: () => [{ stop: () => stops++ }, { stop: () => stops++ }] }), false);
  assert.equal(stops, 2);
});
test('only the newest camera session can attach a stream', () => {
  const session = createCameraSession(); const old = session.begin(); const current = session.begin(); let stops = 0;
  const stream = { getTracks: () => [{ stop: () => stops++ }] };
  assert.equal(session.accept(current, stream), true); assert.equal(stops, 0);
  assert.equal(session.accept(old, stream), false); assert.equal(stops, 1);
  stopMediaStream(null);
});
test('procedural eyewear is symmetric with exactly two coherent temples', () => {
  const model = createGlassesModel(product); const bounds = modelVisualBounds(model);
  close(bounds.min.x, -bounds.max.x, 0.005);
  assert.equal(model.children.filter((child) => /-temple$/.test(child.name)).length, 2);
  assert.ok(bounds.max.x - bounds.min.x < 2.2); assert.ok(bounds.max.z - bounds.min.z < 2.4);
  assert.equal(model.userData.source, 'approximation'); dispose(model);
});
test('temple and lens geometry respond to product dimensions', () => {
  const short = createGlassesModel({ ...product, templeLength: 120, lensHeight: 30 });
  const long = createGlassesModel({ ...product, templeLength: 160, lensHeight: 50 });
  const a = modelVisualBounds(short).getSize(new THREE.Vector3()); const b = modelVisualBounds(long).getSize(new THREE.Vector3());
  assert.ok(b.z > a.z); assert.ok(b.y > a.y); dispose(short); dispose(long);
});
test('viewer bounds fit every corner on mobile and desktop, at all supported angles and zooms', () => {
  const model = createGlassesModel(product); const bounds = modelVisualBounds(model);
  for (const aspect of [0.7, 1, 1.9, 2.6]) for (const yaw of [-0.78, 0, 0.78]) for (const pitch of [-0.2, 0, 0.2]) for (const zoom of [0.8, 1, 1.25]) {
    const { scale, center } = fitViewerBounds(bounds, yaw, pitch, aspect, zoom);
    const rotation = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const corner = new THREE.Vector3(x, y, z).applyMatrix4(rotation).sub(center).multiplyScalar(scale);
      assert.ok(Math.abs(corner.x) < aspect); assert.ok(Math.abs(corner.y) < 0.95);
    }
  }
  dispose(model);
});
test('face mask is three-dimensional and is excluded from product-view bounds', () => {
  const model = createGlassesModel(product); assert.equal(model.userData.faceOccluder.geometry.type, 'SphereGeometry');
  const withMask = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  const withoutMask = modelVisualBounds(model).getSize(new THREE.Vector3());
  assert.ok(withMask.y > withoutMask.y); dispose(model);
});
test('large-unit off-centre GLBs normalize after rotation and keep the front at the bridge', () => {
  const source = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(140, 42, 145), new THREE.MeshStandardMaterial());
  mesh.position.set(500, 100, -230); source.add(mesh);
  const normalized = normalizeCatalogGeometry(source, { tryOnRotationY: 25 });
  const bounds = new THREE.Box3().setFromObject(normalized);
  close(bounds.getSize(new THREE.Vector3()).x, 2.12);
  close(bounds.getCenter(new THREE.Vector3()).x, 0);
  close(bounds.getCenter(new THREE.Vector3()).y, 0);
  close(bounds.max.z, 0); dispose(normalized);
});
test('explicit GLB scale and vertical calibration survive normalization', () => {
  const source = new THREE.Group(); source.add(new THREE.Mesh(new THREE.BoxGeometry(100, 30, 80), new THREE.MeshStandardMaterial()));
  const normalized = normalizeCatalogGeometry(source, { tryOnScale: 1.15, tryOnOffsetY: 0.08 });
  const bounds = new THREE.Box3().setFromObject(normalized);
  close(bounds.getSize(new THREE.Vector3()).x, 2.12 * 1.15); close(bounds.getCenter(new THREE.Vector3()).y, 0.08); dispose(normalized);
});
test('UI has no synthetic size verdict or purchasable simulated colour configuration', async () => {
  const source = await readFile(new URL('../src/VirtualTryOn3D.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /detectedFaceMm|frameVariant:|lensTint:|lensIntensity:/);
  assert.match(source, /preferPhotoReconstruction: false/);
  assert.match(source, /photoResultRef\.current.*processResultsRef/s);
  assert.match(source, /cameraSessionRef\.current\.accept\(session, stream\)/);
  assert.match(source, /role=\{fullScreen \? "dialog"/);
});
