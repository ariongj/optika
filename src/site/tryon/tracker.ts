// On-device face tracking (MediaPipe Face Landmarker). Loaded only when the visitor starts the camera or
// picks a photo: the JS (dynamic import → its own chunk), the Wasm runtime and the face model are all
// self-hosted under /mediapipe/ and fetched with progress. Nothing leaves the device.
import type { FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { asset } from '@/lib/paths';

export type TrackerMode = 'IMAGE' | 'VIDEO';
export type { FaceLandmarkerResult };

export interface FaceTracker {
  mode: TrackerMode;
  setMode(mode: TrackerMode): Promise<void>;
  detect(image: HTMLImageElement): FaceLandmarkerResult;
  detectVideo(video: HTMLVideoElement, timestamp: number): FaceLandmarkerResult;
  close(): void;
}

/** Approximate sizes used when the server sends no Content-Length. */
const EXPECTED = { wasm: 11_150_000, model: 3_760_000 };

async function fetchWithProgress(url: string, expected: number, onBytes: (loaded: number, total: number) => void): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const total = Number(res.headers.get('content-length')) || expected;
  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer());
    onBytes(buf.byteLength, buf.byteLength);
    return buf;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onBytes(loaded, Math.max(total, loaded));
  }
  const out = new Uint8Array(loaded);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  onBytes(loaded, loaded);
  return out;
}

/**
 * Downloads the runtime + model (progress 0–1 via `onProgress`) and creates a Face Landmarker. GPU delegate
 * first, CPU as the fallback.
 */
export async function createFaceTracker(mode: TrackerMode, onProgress: (p: number) => void): Promise<FaceTracker> {
  const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
  const base = asset('/mediapipe/wasm');
  const simd = await FilesetResolver.isSimdSupported();
  const name = simd ? 'vision_wasm_internal' : 'vision_wasm_nosimd_internal';

  const progress = { wasm: [0, EXPECTED.wasm], model: [0, EXPECTED.model] };
  const report = () => {
    const loaded = progress.wasm[0] + progress.model[0];
    const total = progress.wasm[1] + progress.model[1];
    onProgress(Math.min(0.99, loaded / total));
  };
  const [wasm, model] = await Promise.all([
    fetchWithProgress(`${base}/${name}.wasm`, EXPECTED.wasm, (l, t) => {
      progress.wasm = [l, t];
      report();
    }),
    fetchWithProgress(asset('/mediapipe/models/face_landmarker.task'), EXPECTED.model, (l, t) => {
      progress.model = [l, t];
      report();
    }),
  ]);

  const wasmUrl = URL.createObjectURL(new Blob([wasm as BlobPart], { type: 'application/wasm' }));
  const fileset = { wasmLoaderPath: `${base}/${name}.js`, wasmBinaryPath: wasmUrl };
  const create = (delegate: 'GPU' | 'CPU') =>
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetBuffer: model, delegate },
      runningMode: mode,
      numFaces: 2,
      minFaceDetectionConfidence: 0.55,
      minFacePresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
      outputFacialTransformationMatrixes: true,
      outputFaceBlendshapes: false,
    });
  let landmarker: FaceLandmarker;
  try {
    try {
      landmarker = await create('GPU');
    } catch {
      landmarker = await create('CPU');
    }
  } finally {
    URL.revokeObjectURL(wasmUrl);
  }
  onProgress(1);

  const tracker: FaceTracker = {
    mode,
    async setMode(next) {
      if (tracker.mode === next) return;
      await landmarker.setOptions({ runningMode: next });
      tracker.mode = next;
    },
    detect: (image) => landmarker.detect(image),
    detectVideo: (video, timestamp) => landmarker.detectForVideo(video, timestamp),
    close: () => landmarker.close(),
  };
  return tracker;
}
