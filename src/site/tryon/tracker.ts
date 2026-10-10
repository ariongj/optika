// On-device face tracking (MediaPipe Face Landmarker). Loaded only when the visitor starts the camera or
// picks a photo: the JS (dynamic import → its own chunk), the Wasm runtime and the face model are all
// self-hosted under /mediapipe/ and fetched with progress. Nothing leaves the device.
import type { FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { asset } from '@/lib/paths';
import { isHandheld } from './device';

export type TrackerMode = 'IMAGE' | 'VIDEO';
export type Delegate = 'GPU' | 'CPU';
export type { FaceLandmarkerResult };

export interface FaceTracker {
  mode: TrackerMode;
  /** The delegate MediaPipe actually runs on (after any fallback during creation). */
  readonly delegate: Delegate;
  setMode(mode: TrackerMode): Promise<void>;
  detect(image: HTMLImageElement): FaceLandmarkerResult;
  /** A live frame: the <video> itself (GPU) or a 2D-canvas copy of it (CPU — see TryOnStudio `frameFor`). */
  detectVideo(frame: HTMLVideoElement | HTMLCanvasElement, timestamp: number): FaceLandmarkerResult;
  close(): void;
}

export interface TrackerOptions {
  /**
   * 'auto': CPU first on phones and tablets (MediaPipe's GPU delegate is unreliable there — on iOS Safari it
   * can initialise and then throw or return nothing on every frame), GPU first on desktops. 'CPU' / 'GPU'
   * force one delegate (with the other as the creation fallback, except a forced CPU, which is final).
   */
  delegate?: 'auto' | Delegate;
  /** Lighter live tracking: one face in VIDEO mode (phones). Photos always look for two faces. */
  lite?: boolean;
}

/** Approximate sizes used when the server sends no Content-Length. */
const EXPECTED = { wasm: 11_150_000, model: 3_760_000 };

async function fetchWithProgress(url: string, expected: number, onBytes: (loaded: number, total: number) => void): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const total = Number(res.headers.get('content-length')) || expected;
  if (!res.body) {
    const blob = await res.blob();
    onBytes(blob.size, blob.size);
    return blob;
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
  onBytes(loaded, loaded);
  return new Blob(chunks as BlobPart[]);
}

interface Assets {
  name: string;
  wasm: Blob;
  model: Blob;
}

/**
 * The runtime and model are kept (as Blobs) for the life of the page, so a tracker re-created on the CPU
 * after a GPU failure doesn't download ~15 MB again. Progress listeners of every caller are notified.
 */
let assets: Promise<Assets> | null = null;
let assetsLoaded = false;
/** True once the runtime and model are in memory (a new tracker then starts without a download). */
export const trackerAssetsLoaded = () => assetsLoaded;
const listeners = new Set<(p: number) => void>();

function loadAssets(onProgress: (p: number) => void): Promise<Assets> {
  listeners.add(onProgress);
  if (!assets) {
    const progress = { wasm: [0, EXPECTED.wasm], model: [0, EXPECTED.model] };
    const report = () => {
      const loaded = progress.wasm[0] + progress.model[0];
      const total = progress.wasm[1] + progress.model[1];
      listeners.forEach((fn) => fn(Math.min(0.99, loaded / total)));
    };
    assets = (async () => {
      const { FilesetResolver } = await import('@mediapipe/tasks-vision');
      const simd = await FilesetResolver.isSimdSupported();
      const name = simd ? 'vision_wasm_internal' : 'vision_wasm_nosimd_internal';
      const [wasm, model] = await Promise.all([
        fetchWithProgress(asset(`/mediapipe/wasm/${name}.wasm`), EXPECTED.wasm, (l, t) => {
          progress.wasm = [l, t];
          report();
        }),
        fetchWithProgress(asset('/mediapipe/models/face_landmarker.task'), EXPECTED.model, (l, t) => {
          progress.model = [l, t];
          report();
        }),
      ]);
      assetsLoaded = true;
      return { name, wasm: new Blob([wasm], { type: 'application/wasm' }), model };
    })().catch((error) => {
      assets = null;
      throw error;
    });
  }
  return assets.finally(() => listeners.delete(onProgress));
}

const errorText = (e: unknown) => (e instanceof Error ? e.message || e.name : String(e));

/**
 * Downloads the runtime + model (progress 0–1 via `onProgress`) and creates a Face Landmarker on the
 * preferred delegate, falling back to the other one if creation fails.
 */
export async function createFaceTracker(mode: TrackerMode, onProgress: (p: number) => void, opts: TrackerOptions = {}): Promise<FaceTracker> {
  const { delegate: prefer = 'auto', lite = false } = opts;
  const order: Delegate[] = prefer === 'CPU' ? ['CPU'] : prefer === 'GPU' ? ['GPU', 'CPU'] : isHandheld() ? ['CPU', 'GPU'] : ['GPU', 'CPU'];
  const numFaces = (m: TrackerMode) => (m === 'VIDEO' && lite ? 1 : 2);

  const [{ FaceLandmarker }, files] = await Promise.all([import('@mediapipe/tasks-vision'), loadAssets(onProgress)]);
  const model = new Uint8Array(await files.model.arrayBuffer());

  let landmarker: FaceLandmarker | null = null;
  let used: Delegate = order[0];
  const failures: string[] = [];
  for (const delegate of order) {
    const wasmUrl = URL.createObjectURL(files.wasm);
    try {
      landmarker = await FaceLandmarker.createFromOptions(
        { wasmLoaderPath: asset(`/mediapipe/wasm/${files.name}.js`), wasmBinaryPath: wasmUrl },
        {
          baseOptions: { modelAssetBuffer: model, delegate },
          runningMode: mode,
          numFaces: numFaces(mode),
          minFaceDetectionConfidence: 0.55,
          minFacePresenceConfidence: 0.55,
          minTrackingConfidence: 0.55,
          outputFacialTransformationMatrixes: true,
          outputFaceBlendshapes: false,
        },
      );
      used = delegate;
      break;
    } catch (error) {
      failures.push(`${delegate}: ${errorText(error)}`);
      console.warn(`[try-on] Face Landmarker could not start on the ${delegate} delegate`, error);
    } finally {
      URL.revokeObjectURL(wasmUrl);
    }
  }
  if (!landmarker) throw new Error(`MediaPipe ${failures.join(' / ')}`);
  onProgress(1);

  const lm = landmarker;
  const tracker: FaceTracker = {
    mode,
    delegate: used,
    async setMode(next) {
      if (tracker.mode === next) return;
      await lm.setOptions({ runningMode: next, numFaces: numFaces(next) });
      tracker.mode = next;
    },
    detect: (image) => lm.detect(image),
    detectVideo: (frame, timestamp) => lm.detectForVideo(frame, timestamp),
    close: () => {
      try {
        lm.close();
      } catch {
        /* already closed */
      }
    },
  };
  return tracker;
}
