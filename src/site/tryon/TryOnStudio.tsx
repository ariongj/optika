import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type DragEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowUpRight, Box, CalendarCheck, Camera, CameraOff, CircleAlert, ImagePlus, Loader2, LockKeyhole, RefreshCw, Ruler, ScanFace, ShoppingBag, SlidersHorizontal, SwitchCamera, Trash2, Video } from 'lucide-react';
import type { Product } from '@/lib/types';
import { Img } from '@/components/ui/misc';
import { Button, ButtonLink } from '@/components/ui/Button';
import { useDict, useL, useLang } from '@/i18n';
import { useActiveProducts, useCategories } from '@/store/hooks';
import { useUi } from '@/store/ui';
import { defaultOptions, isOnSale, regularUnitPrice, unitPrice } from '@/lib/pricing';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { TRY } from './dict';
import { colorOption, lookFor, resolveTryOnFrame } from './frames';
import { clamp, coverRect, createCameraSession, mapToStage, poseFromLandmarks, safeDims, stopMediaStream, type ManualFit, type Point, type Rect } from './pose';
import { createTryOnRenderer, VIEWER_ZOOM, type FrameModelSpec, type TryOnRenderer } from './renderer';
import { createFaceTracker, trackerAssetsLoaded, type FaceLandmarkerResult, type FaceTracker, type TrackerMode } from './tracker';
import { cameraSupport, copyText, describeError, isHandheld, isInAppBrowser, playVideo, videoConstraints, type CameraSupport } from './device';
import {
  ColorSwatches,
  CompareStrip,
  CompareTray,
  ControlCard,
  Disclosure,
  FramePicker,
  FrameStrip,
  InAppNote,
  MeasureTiles,
  RangeField,
  ResetButton,
  StageCard,
  StageIconButton,
  StepsList,
  stageBtn,
  type Capture,
} from './parts';

type Mode = 'live' | 'photo' | 'viewer';
type Status =
  | 'viewer'
  // live camera
  | 'idle'
  | 'insecure'
  | 'unsupported'
  | 'loading'
  | 'permission'
  | 'switching'
  | 'denied'
  | 'nocamera'
  | 'busy'
  | 'camError'
  | 'trackerError'
  | 'noface'
  | 'multiple'
  | 'tracking'
  | 'tooClose'
  | 'tooFar'
  | 'lowLight'
  // photo
  | 'photoEmpty'
  | 'analyzing'
  | 'photoReady'
  | 'photoNoFace'
  | 'photoMultiple'
  | 'badFile';

const MODES: { id: Mode; icon: typeof Video; key: 'modeLive' | 'modePhoto' | 'modeViewer'; short: 'modeLiveShort' | 'modePhoto' | 'modeViewer' }[] = [
  { id: 'live', icon: Video, key: 'modeLive', short: 'modeLiveShort' },
  { id: 'photo', icon: ImagePlus, key: 'modePhoto', short: 'modePhoto' },
  { id: 'viewer', icon: Box, key: 'modeViewer', short: 'modeViewer' },
];

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO = 12 * 1024 * 1024;
const VIEWER_BG = 'radial-gradient(120% 90% at 50% 38%, #4b453d 0%, #2d2925 42%, #1c1a17 78%)';
/** detectForVideo failures in a row before the tracker is re-created on the CPU. */
const MAX_DETECT_ERRORS = 3;
/** A GPU tracker that sees no face for this long while the video plays is treated as broken. */
const GPU_EMPTY_MS = 6000;
const DESKTOP_QUERY = '(min-width: 1024px)';

const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const stripAccent = (s: string) => s.replace(/\*/g, '');

function supportDetail(support: CameraSupport) {
  if (support === 'insecure') return `window.isSecureContext = false (${window.location.protocol}//${window.location.host})`;
  if (support === 'unsupported') return 'navigator.mediaDevices.getUserMedia is not available';
  return null;
}

/** Media query as state (desktop two-column layout vs. the compact phone/tablet dock). */
function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else mq.addListener(onChange);
      return () => (mq.removeEventListener ? mq.removeEventListener('change', onChange) : mq.removeListener(onChange));
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function canvasToBlob(c: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => c.toBlob(resolve, 'image/png'));
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Bottom caption on captures: brand + frame + colour. */
function drawCaption(ctx: CanvasRenderingContext2D, w: number, h: number, s: number, title: string, sub: string) {
  const band = ctx.createLinearGradient(0, h - 90 * s, 0, h);
  band.addColorStop(0, 'rgba(0,0,0,0)');
  band.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = band;
  ctx.fillRect(0, h - 90 * s, w, 90 * s);
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `600 ${15 * s}px "Manrope Variable", Manrope, system-ui, sans-serif`;
  ctx.fillText(title, 18 * s, h - 36 * s);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `500 ${12 * s}px "Manrope Variable", Manrope, system-ui, sans-serif`;
  ctx.fillText(sub, 18 * s, h - 17 * s);
  ctx.textAlign = 'right';
  ctx.font = `italic 400 ${15 * s}px "Fraunces Variable", Fraunces, Georgia, serif`;
  ctx.fillText('Optika Miftari', w - 18 * s, h - 17 * s);
  ctx.textAlign = 'left';
}

export function TryOnStudio() {
  const t = useDict(TRY);
  const l = useL();
  const lang = useLang();
  const addToCart = useUi((s) => s.addToCart);
  const setCartOpen = useUi((s) => s.setCartOpen);
  const all = useActiveProducts();
  const categories = useCategories();
  const frames = useMemo(() => all.filter((p) => resolveTryOnFrame(p)), [all]);
  const desktop = useMediaQuery(DESKTOP_QUERY);
  // Phones / tablets: CPU tracking, lighter capture, 20 fps detection. Fixed for the life of the page.
  const [lite] = useState(isHandheld);
  const [inApp] = useState(isInAppBrowser);

  /* ---------------------------------------------------------------- selection */
  const [params, setParams] = useSearchParams();
  const wanted = params.get('produkt');
  const findWanted = (key: string | null) => (key ? frames.find((p) => p.slug === key || p.id === key) : undefined);
  const [productId, setProductId] = useState<string | undefined>(() => (findWanted(wanted) ?? frames[0])?.id);
  const product = frames.find((p) => p.id === productId) ?? frames[0];
  const colorOpt = colorOption(product);
  const [colorId, setColorId] = useState<string>(() => colorOption(product)?.values[0]?.id ?? '');
  const activeColor = colorOpt?.values.find((v) => v.id === colorId) ?? colorOpt?.values[0];
  const [filter, setFilter] = useState('all');

  const choose = (p: Product, syncUrl = true) => {
    setProductId(p.id);
    setColorId(colorOption(p)?.values[0]?.id ?? '');
    if (syncUrl) {
      const next = new URLSearchParams(params);
      next.set('produkt', p.slug);
      setParams(next, { replace: true, preventScrollReset: true });
    }
  };
  // ?produkt= changed from outside (e.g. "Try on" from a product page while already here).
  useEffect(() => {
    const p = findWanted(wanted);
    if (p && p.id !== productId) choose(p, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, frames]);

  const frame = useMemo(() => resolveTryOnFrame(product), [product]);
  const spec = useMemo<FrameModelSpec | null>(
    () => (product && frame ? { shape: frame.shape, build: frame.build, dims: safeDims(frame), look: lookFor(product, frame, activeColor?.id) } : null),
    [product, frame, activeColor?.id],
  );
  const options = useMemo(() => (product ? { ...defaultOptions(product), ...(colorOpt && activeColor ? { [colorOpt.id]: activeColor.id } : {}) } : {}), [product, colorOpt, activeColor]);

  /* ---------------------------------------------------------------- state */
  const [mode, setModeState] = useState<Mode>('viewer');
  const [status, setStatus] = useState<Status>('viewer');
  const [progress, setProgress] = useState<number | null>(null);
  const [engineError, setEngineError] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [videoPaused, setVideoPaused] = useState(false);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [trackerFail, setTrackerFail] = useState<'load' | 'runtime'>('load');
  /** Delegate of the current tracker — exposed as data-delegate on the stage for support / QA. */
  const [delegate, setDelegate] = useState<FaceTracker['delegate'] | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoRect, setPhotoRect] = useState<Rect | null>(null);
  const [fitScale, setFitScale] = useState(100);
  const [fitHeight, setFitHeight] = useState(0);
  const [fitTilt, setFitTilt] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [dragOver, setDragOver] = useState(false);

  /* ---------------------------------------------------------------- refs */
  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const photoRef = useRef<HTMLImageElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const engineRef = useRef<TryOnRenderer | null>(null);
  const trackerRef = useRef<FaceTracker | null>(null);
  const trackerPromise = useRef<Promise<FaceTracker> | null>(null);
  /** After a GPU failure every new tracker is created on the CPU. */
  const preferCpu = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const session = useRef(createCameraSession());
  const liveToken = useRef(0);
  const starting = useRef(false);
  const recovering = useRef(false);
  const rafRef = useRef(0);
  const lastVideoTime = useRef(-1);
  const lastDetect = useRef(0);
  const lastPlayTry = useRef(0);
  const detectErrors = useRef(0);
  const emptySince = useRef<number | null>(null);
  const lightCanvas = useRef<HTMLCanvasElement | null>(null);
  const frameCanvas = useRef<HTMLCanvasElement | null>(null);
  const lastLight = useRef(0);
  const lowLight = useRef(false);
  const mounted = useRef(true);
  const modeRef = useRef<Mode>('viewer');
  const facingRef = useRef<'user' | 'environment'>('user');
  const manualRef = useRef<ManualFit>({ scale: 1, vertical: 0, horizontal: 0, rotation: 0 });
  const specRef = useRef(spec);
  const appliedSpec = useRef<FrameModelSpec | null>(null);
  const photoResult = useRef<{ url: string; result: FaceLandmarkerResult } | null>(null);
  const photoFocus = useRef({ x: 0.5, y: 0.42 });
  const photoRev = useRef(0);
  const photoUrlRef = useRef<string | null>(null);
  const capturesRef = useRef<Capture[]>([]);
  const interacted = useRef(false);
  const zoomRef = useRef(1);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  const setMode = (m: Mode) => {
    modeRef.current = m;
    setModeState(m);
  };

  /* ---------------------------------------------------------------- renderer */
  const hasSpec = !!spec;
  useEffect(() => {
    const host = hostRef.current;
    const initial = spec;
    if (!host || !initial) return;
    let engine: TryOnRenderer;
    try {
      engine = createTryOnRenderer(host, initial, {
        onContextLost: () => {
          if (!mounted.current) return;
          setErrorDetail('WebGL: context lost');
          setEngineError(true);
          stopCamera();
        },
        onContextRestored: () => mounted.current && setEngineError(false),
      });
    } catch (error) {
      console.error('[try-on] the 3D renderer could not start', error);
      setErrorDetail(describeError(error, 'WebGL'));
      setEngineError(true);
      return;
    }
    engineRef.current = engine;
    appliedSpec.current = initial;
    setEngineError(false);
    engine.setMode(modeRef.current);
    engine.setViewerZoom(zoomRef.current);
    engine.setAutoRotate(modeRef.current === 'viewer' && !interacted.current && !prefersReducedMotion());
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSpec]);

  useEffect(() => {
    specRef.current = spec;
    if (!spec) return;
    if (engineRef.current && appliedSpec.current !== spec) {
      engineRef.current.setFrame(spec);
      appliedSpec.current = spec;
    }
    if (modeRef.current === 'photo') placePhoto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec]);

  useEffect(() => {
    zoomRef.current = zoom;
    engineRef.current?.setViewerZoom(zoom);
  }, [zoom]);

  useEffect(() => {
    manualRef.current = { scale: fitScale / 100, vertical: fitHeight / 100, horizontal: 0, rotation: fitTilt };
    if (modeRef.current === 'photo') placePhoto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitScale, fitHeight, fitTilt]);

  /* ---------------------------------------------------------------- lifecycle */
  useEffect(() => {
    mounted.current = true;
    // Phones: release the camera as soon as the tab is hidden (app switch, lock screen). Coming back shows the
    // start button again — the camera never restarts without a tap.
    const onVisibility = () => {
      if (!document.hidden || modeRef.current !== 'live') return;
      if (streamRef.current || starting.current) {
        stopCamera();
        setStatus('idle');
      }
    };
    const onPageHide = () => {
      if (!streamRef.current && !starting.current) return;
      stopCamera();
      if (modeRef.current === 'live') setStatus('idle');
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      mounted.current = false;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      photoRev.current += 1;
      stopCamera();
      trackerRef.current?.close();
      trackerRef.current = null;
      trackerPromise.current = null;
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
      photoUrlRef.current = null;
      capturesRef.current.forEach((c) => URL.revokeObjectURL(c.url));
      capturesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the photo framed (and the frame on the face) when the stage changes size.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const ro = new ResizeObserver(() => {
      if (modeRef.current === 'photo') placePhoto();
    });
    ro.observe(stage);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------------------------------------------- tracker */
  const ensureTracker = async (runMode: TrackerMode) => {
    if (!trackerPromise.current) {
      setProgress(trackerAssetsLoaded() ? null : 0);
      trackerPromise.current = createFaceTracker(runMode, (p) => mounted.current && setProgress(p), { delegate: preferCpu.current ? 'CPU' : 'auto', lite })
        .then((tracker) => {
          if (!mounted.current) {
            tracker.close();
            throw new Error('closed');
          }
          trackerRef.current = tracker;
          setDelegate(tracker.delegate);
          setProgress(null);
          return tracker;
        })
        .catch((error) => {
          trackerPromise.current = null;
          if (mounted.current) setProgress(null);
          throw error;
        });
    }
    const tracker = await trackerPromise.current;
    await tracker.setMode(runMode);
    return tracker;
  };

  /** Drops the current tracker so the next `ensureTracker` builds a fresh one. */
  const disposeTracker = () => {
    const old = trackerRef.current;
    trackerRef.current = null;
    trackerPromise.current = null;
    old?.close();
  };

  /* ---------------------------------------------------------------- camera */
  function stopCamera() {
    session.current.cancel();
    starting.current = false;
    recovering.current = false;
    cancelAnimationFrame(rafRef.current);
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
    lastVideoTime.current = -1;
    frameCanvas.current = null;
    engineRef.current?.setFacePose(null);
    if (mounted.current) setCameraActive(false);
  }

  /** Average brightness of the face itself (not the whole frame — a dark background is fine). */
  const estimateLight = (video: HTMLVideoElement, face: Point[], now: number) => {
    if (now - lastLight.current < 600) return lowLight.current;
    lastLight.current = now;
    if (!lightCanvas.current) {
      lightCanvas.current = document.createElement('canvas');
      lightCanvas.current.width = 16;
      lightCanvas.current.height = 16;
    }
    const ctx = lightCanvas.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    let x0 = 1;
    let y0 = 1;
    let x1 = 0;
    let y1 = 0;
    for (const p of face) {
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    }
    // Inner part of the face box (cheeks, nose, forehead) — skip hair and background at the edges.
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const sx = clamp(x0 + (x1 - x0) * 0.2, 0, 1) * vw;
    const sy = clamp(y0 + (y1 - y0) * 0.15, 0, 1) * vh;
    const sw = Math.max(2, (x1 - x0) * 0.6 * vw);
    const sh = Math.max(2, (y1 - y0) * 0.7 * vh);
    try {
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, 16, 16);
      const px = ctx.getImageData(0, 0, 16, 16).data;
      let total = 0;
      for (let i = 0; i < px.length; i += 4) total += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      lowLight.current = total / (px.length / 4) < 62;
    } catch {
      lowLight.current = false;
    }
    return lowLight.current;
  };

  const handleLive = (result: FaceLandmarkerResult, video: HTMLVideoElement, now: number) => {
    const engine = engineRef.current;
    const stage = stageRef.current;
    const faces = result.faceLandmarks ?? [];
    if (!faces.length || !stage) {
      engine?.setFacePose(null);
      setStatus('noface');
      return;
    }
    if (faces.length > 1) {
      engine?.setFacePose(null);
      setStatus('multiple');
      return;
    }
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    const rect = coverRect(video.videoWidth, video.videoHeight, W, H);
    const pose = poseFromLandmarks(mapToStage(faces[0] as Point[], rect, W, H), {
      mirror: facingRef.current === 'user',
      manual: manualRef.current,
      matrix: result.facialTransformationMatrixes?.[0]?.data ?? null,
      aspect: W / H,
      dims: specRef.current?.dims ?? safeDims({}),
    });
    engine?.setFacePose(pose);
    if (!pose) return setStatus('noface');
    if (pose.eyeDistance > 0.42) setStatus('tooClose');
    else if (pose.eyeDistance < 0.1) setStatus('tooFar');
    else if (estimateLight(video, faces[0] as Point[], now)) setStatus('lowLight');
    else setStatus('tracking');
  };

  /** Live tracking failed: re-create the tracker on the CPU once (camera keeps running), then give up honestly. */
  const recoverTracker = async (error: unknown) => {
    cancelAnimationFrame(rafRef.current);
    engineRef.current?.setFacePose(null);
    const token = liveToken.current;
    const tracker = trackerRef.current;
    const fail = (e: unknown, prefix: string) => {
      console.error('[try-on] face tracking stopped', e);
      disposeTracker();
      stopCamera();
      setErrorDetail(describeError(e, prefix));
      setTrackerFail('runtime');
      setStatus('trackerError');
    };
    if (!tracker || tracker.delegate === 'CPU' || preferCpu.current) return fail(error, `MediaPipe ${tracker?.delegate ?? ''}`.trim());
    console.warn('[try-on] GPU face tracking failed — switching to the CPU', error);
    preferCpu.current = true;
    recovering.current = true;
    disposeTracker();
    setStatus('loading');
    try {
      await ensureTracker('VIDEO');
    } catch (e) {
      recovering.current = false;
      if (!session.current.current(token) || !mounted.current) return;
      return fail(e, 'MediaPipe CPU');
    }
    recovering.current = false;
    if (!session.current.current(token) || !mounted.current || modeRef.current !== 'live' || !streamRef.current) return;
    detectErrors.current = 0;
    emptySince.current = null;
    lastVideoTime.current = -1;
    setStatus('noface');
    rafRef.current = requestAnimationFrame(trackLoop);
  };

  /**
   * CPU tracking reads a 2D-canvas copy of the frame instead of the <video>: MediaPipe's CPU path otherwise
   * uploads the video as a WebGL texture and reads it back, which in testing returned misplaced or no
   * landmarks for camera streams scaled to a non-native size (and WebGL video uploads are a known weak spot
   * on iOS). drawImage always yields exactly videoWidth × videoHeight pixels, so landmarks stay aligned.
   */
  const frameFor = (video: HTMLVideoElement, tracker: FaceTracker): HTMLVideoElement | HTMLCanvasElement => {
    if (tracker.delegate !== 'CPU') return video;
    const canvas = (frameCanvas.current ??= document.createElement('canvas'));
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return video;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  };

  const trackLoop = () => {
    const video = videoRef.current;
    const tracker = trackerRef.current;
    if (!streamRef.current || modeRef.current !== 'live' || recovering.current) return;
    const now = performance.now();
    // iOS can pause a live <video> (interruptions, low-power); try to resume it now and then.
    if (video && video.paused && now - lastPlayTry.current > 1500) {
      lastPlayTry.current = now;
      video.play().catch(() => undefined);
    }
    const interval = lite || tracker?.delegate === 'CPU' ? 1000 / 20 : 1000 / 30;
    const fresh = !!video && (video.currentTime !== lastVideoTime.current || now - lastDetect.current > 250);
    if (video && tracker && tracker.mode === 'VIDEO' && video.readyState >= 2 && video.videoWidth > 0 && fresh && now - lastDetect.current >= interval) {
      lastVideoTime.current = video.currentTime;
      lastDetect.current = now;
      let result: FaceLandmarkerResult | null = null;
      try {
        result = tracker.detectVideo(frameFor(video, tracker), now);
        detectErrors.current = 0;
      } catch (error) {
        detectErrors.current += 1;
        if (detectErrors.current === 1) console.error('[try-on] face tracking failed on a video frame', error);
        engineRef.current?.setFacePose(null);
        if (detectErrors.current >= MAX_DETECT_ERRORS) {
          void recoverTracker(error);
          return;
        }
      }
      if (result) {
        const found = (result.faceLandmarks?.length ?? 0) > 0;
        if (found) emptySince.current = null;
        else emptySince.current ??= now;
        if (!found && tracker.delegate === 'GPU' && !preferCpu.current && !video.paused && now - emptySince.current! > GPU_EMPTY_MS) {
          void recoverTracker(new Error(`GPU delegate returned no face for ${GPU_EMPTY_MS / 1000} s`));
          return;
        }
        handleLive(result, video, now);
      }
    }
    rafRef.current = requestAnimationFrame(trackLoop);
  };

  const startCamera = async (wantFacing: 'user' | 'environment' = facingRef.current) => {
    const support = cameraSupport();
    if (support !== 'ok') {
      setErrorDetail(supportDetail(support));
      setStatus(support);
      return;
    }
    if (!engineRef.current) return;
    const switching = !!streamRef.current;
    stopCamera();
    const token = session.current.begin();
    liveToken.current = token;
    starting.current = true;
    setErrorDetail(null);
    setStatus(switching ? 'switching' : 'permission');
    // Permission first: the ~15 MB tracker is only fetched once the visitor has actually allowed the camera
    // (their video already shows while it loads).
    const request = (constraints: MediaTrackConstraints | boolean) => navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
    let stream: MediaStream;
    try {
      try {
        stream = await request(videoConstraints(wantFacing, lite));
      } catch (error) {
        // Some Android cameras refuse the size / frame-rate hints, or are still releasing the previous stream.
        const name = (error as DOMException)?.name;
        if (name !== 'OverconstrainedError' && name !== 'NotReadableError' && name !== 'AbortError') throw error;
        console.warn('[try-on] camera refused the preferred settings — retrying with defaults', error);
        await new Promise((r) => setTimeout(r, 300));
        if (!session.current.current(token)) throw error;
        stream = await request({ facingMode: { ideal: wantFacing } });
      }
    } catch (error) {
      if (!session.current.current(token) || !mounted.current) return;
      starting.current = false;
      const name = (error as DOMException)?.name;
      console.error('[try-on] the camera could not start', error);
      setErrorDetail(describeError(error));
      setStatus(
        name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'nocamera' : name === 'NotReadableError' ? 'busy' : 'camError',
      );
      return;
    }
    if (!session.current.accept(token, stream) || !mounted.current || modeRef.current !== 'live') {
      stopMediaStream(stream);
      return;
    }
    starting.current = false;
    const video = videoRef.current;
    if (!video) {
      stopMediaStream(stream);
      setErrorDetail('HTMLVideoElement missing');
      setStatus('camError');
      return;
    }
    streamRef.current = stream;
    facingRef.current = wantFacing;
    setFacing(wantFacing);
    // iOS needs these as attributes as well as properties before the stream is attached.
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.srcObject = stream;
    await playVideo(video);
    if (!session.current.current(token)) return;
    setCameraActive(true);
    stream.getVideoTracks().forEach((track) =>
      track.addEventListener(
        'ended',
        () => {
          if (session.current.current(token)) {
            stopCamera();
            setStatus('idle');
          }
        },
        { once: true },
      ),
    );
    detectErrors.current = 0;
    emptySince.current = null;
    if (!trackerRef.current || trackerRef.current.mode !== 'VIDEO') setStatus('loading');
    try {
      await ensureTracker('VIDEO');
    } catch (error) {
      if (!session.current.current(token) || !mounted.current) return;
      console.error('[try-on] face tracking could not load', error);
      stopCamera();
      setErrorDetail(describeError(error));
      setTrackerFail('load');
      setStatus('trackerError');
      return;
    }
    if (!session.current.current(token) || !mounted.current || modeRef.current !== 'live') return;
    setStatus('noface');
    engineRef.current?.setMode('live');
    rafRef.current = requestAnimationFrame(trackLoop);
  };

  const copyLink = async () => {
    const url = window.location.href;
    if (await copyText(url)) toast.success(t('linkCopied'), { description: t('linkCopiedText') });
    else toast(url);
  };

  /* ---------------------------------------------------------------- photo */
  const computePhotoRect = () => {
    const img = photoRef.current;
    const stage = stageRef.current;
    if (!img || !stage || !img.naturalWidth) return null;
    return coverRect(img.naturalWidth, img.naturalHeight, stage.clientWidth, stage.clientHeight, photoFocus.current);
  };

  function placePhoto() {
    const stage = stageRef.current;
    const rect = computePhotoRect();
    if (!stage || !rect) return;
    setPhotoRect(rect);
    const stored = photoResult.current;
    if (!stored || stored.url !== photoUrlRef.current) return;
    const faces = stored.result.faceLandmarks ?? [];
    const engine = engineRef.current;
    if (faces.length !== 1) {
      engine?.setFacePose(null);
      setStatus(faces.length ? 'photoMultiple' : 'photoNoFace');
      return;
    }
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    const pose = poseFromLandmarks(mapToStage(faces[0] as Point[], rect, W, H), {
      mirror: false,
      manual: manualRef.current,
      matrix: stored.result.facialTransformationMatrixes?.[0]?.data ?? null,
      aspect: W / H,
      dims: specRef.current?.dims ?? safeDims({}),
    });
    engine?.setMode('photo');
    engine?.setFacePose(pose);
    setStatus(pose ? 'photoReady' : 'photoNoFace');
  }

  const analyzePhoto = async () => {
    const img = photoRef.current;
    const url = photoUrlRef.current;
    if (!img || !url) return;
    if (photoResult.current?.url === url) return placePhoto();
    const rev = ++photoRev.current;
    const stale = () => rev !== photoRev.current || !mounted.current || modeRef.current !== 'photo' || photoUrlRef.current !== url;
    engineRef.current?.setFacePose(null);
    setErrorDetail(null);
    setStatus('analyzing');
    let loaded = false;
    try {
      let tracker = await ensureTracker('IMAGE');
      loaded = true;
      await img.decode?.().catch(() => undefined);
      if (stale()) return;
      let result: FaceLandmarkerResult;
      try {
        result = tracker.detect(img);
      } catch (error) {
        if (tracker.delegate !== 'GPU' || preferCpu.current) throw error;
        // Same recovery as the live loop: one retry on a fresh CPU tracker.
        console.warn('[try-on] GPU face detection failed on the photo — retrying on the CPU', error);
        preferCpu.current = true;
        disposeTracker();
        tracker = await ensureTracker('IMAGE');
        if (stale()) return;
        result = tracker.detect(img);
      }
      photoResult.current = { url, result };
      // Centre the crop on the eyes so the face stays in view on narrow (phone) stages.
      const face = result.faceLandmarks?.[0];
      if (face && result.faceLandmarks.length === 1) {
        const a = face[468] ?? face[33];
        const b = face[473] ?? face[263];
        if (a && b) photoFocus.current = { x: clamp((a.x + b.x) / 2, 0, 1), y: clamp((a.y + b.y) / 2 + 0.06, 0, 1) };
      }
      placePhoto();
    } catch (error) {
      if (rev !== photoRev.current || !mounted.current) return;
      console.error('[try-on] face tracking failed on the photo', error);
      if (loaded) disposeTracker();
      engineRef.current?.setFacePose(null);
      setErrorDetail(describeError(error));
      setTrackerFail(loaded ? 'runtime' : 'load');
      setStatus('trackerError');
    }
  };

  const takePhoto = (file: File | undefined | null) => {
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type) || file.size > MAX_PHOTO) {
      switchMode('photo');
      setStatus('badFile');
      return;
    }
    stopCamera();
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    const url = URL.createObjectURL(file);
    photoUrlRef.current = url;
    photoResult.current = null;
    photoFocus.current = { x: 0.5, y: 0.42 };
    photoRev.current += 1;
    setPhotoRect(null);
    setPhotoUrl(url);
    setMode('photo');
    engineRef.current?.setMode('photo');
    engineRef.current?.setAutoRotate(false);
    setStatus('analyzing');
  };

  const removePhoto = () => {
    photoRev.current += 1;
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    photoUrlRef.current = null;
    photoResult.current = null;
    setPhotoUrl(null);
    setPhotoRect(null);
    engineRef.current?.setFacePose(null);
    setStatus('photoEmpty');
  };

  /* ---------------------------------------------------------------- modes */
  function switchMode(next: Mode) {
    if (next === modeRef.current) return;
    stopCamera();
    photoRev.current += 1;
    setMode(next);
    setErrorDetail(null);
    const engine = engineRef.current;
    engine?.setMode(next);
    engine?.setAutoRotate(next === 'viewer' && !interacted.current && !prefersReducedMotion());
    if (next === 'viewer') setStatus('viewer');
    if (next === 'live') {
      const support = cameraSupport();
      setErrorDetail(supportDetail(support));
      setStatus(support === 'ok' ? 'idle' : support);
    }
    if (next === 'photo') setStatus(photoUrlRef.current ? 'analyzing' : 'photoEmpty');
    // A photo already analysed is placed again once its <img> has re-mounted (onLoad → analyzePhoto).
  }

  const resetFit = () => {
    setFitScale(100);
    setFitHeight(0);
    setFitTilt(0);
  };

  /* ---------------------------------------------------------------- viewer gestures */
  const stopAuto = () => {
    if (interacted.current) return;
    interacted.current = true;
    engineRef.current?.setAutoRotate(false);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // A tap on the stage is a user gesture: resume a live video that the browser refused to autoplay.
    const video = videoRef.current;
    if (modeRef.current === 'live' && streamRef.current && video?.paused) video.play().catch(() => undefined);
    if (modeRef.current !== 'viewer' || (e.target as HTMLElement).closest('button, a, input, label')) return;
    stopAuto();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: zoomRef.current };
    }
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (modeRef.current !== 'viewer' || !prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      setZoom(clamp((pinch.current.zoom * dist) / pinch.current.dist, VIEWER_ZOOM.min, VIEWER_ZOOM.max));
      return;
    }
    engineRef.current?.rotateViewer((e.clientX - prev.x) * 0.009, (e.clientY - prev.y) * 0.005);
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  // Wheel zoom (non-passive so it can stop the page from scrolling — but only while there is zoom left).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      if (modeRef.current !== 'viewer') return;
      const next = clamp(zoomRef.current * Math.exp(-e.deltaY * 0.0015), VIEWER_ZOOM.min, VIEWER_ZOOM.max);
      if (Math.abs(next - zoomRef.current) < 0.001) return;
      e.preventDefault();
      stopAuto();
      zoomRef.current = next;
      setZoom(next);
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onStageKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (modeRef.current !== 'viewer' || e.target !== e.currentTarget) return;
    const engine = engineRef.current;
    const keys: Record<string, () => void> = {
      ArrowLeft: () => engine?.rotateViewer(-0.18, 0),
      ArrowRight: () => engine?.rotateViewer(0.18, 0),
      ArrowUp: () => engine?.rotateViewer(0, -0.08),
      ArrowDown: () => engine?.rotateViewer(0, 0.08),
      '+': () => setZoom((z) => clamp(z * 1.12, VIEWER_ZOOM.min, VIEWER_ZOOM.max)),
      '=': () => setZoom((z) => clamp(z * 1.12, VIEWER_ZOOM.min, VIEWER_ZOOM.max)),
      '-': () => setZoom((z) => clamp(z / 1.12, VIEWER_ZOOM.min, VIEWER_ZOOM.max)),
      '0': () => resetView(),
    };
    const fn = keys[e.key];
    if (!fn) return;
    e.preventDefault();
    stopAuto();
    fn();
  };

  const resetView = () => {
    engineRef.current?.resetViewer();
    setZoom(1);
  };
  const preset = (yaw: number) => {
    stopAuto();
    engineRef.current?.setViewerAngle(yaw, 0);
  };

  /* ---------------------------------------------------------------- drop a photo on the stage */
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (modeRef.current !== 'photo' || !e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    setDragOver(true);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    if (modeRef.current !== 'photo') return;
    e.preventDefault();
    setDragOver(false);
    takePhoto(e.dataTransfer.files?.[0]);
  };

  /* ---------------------------------------------------------------- capture & compare */
  const canCapture = !engineError && (mode === 'viewer' || (mode === 'photo' && status === 'photoReady') || (mode === 'live' && cameraActive));
  const productName = product ? l(product.name) : '';
  const colorLabel = activeColor ? l(activeColor.label) : '';

  const composite = (): HTMLCanvasElement | null => {
    const stage = stageRef.current;
    const engine = engineRef.current;
    if (!stage || !engine) return null;
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    const s = Math.min(window.devicePixelRatio || 1, 2);
    const c = document.createElement('canvas');
    c.width = Math.round(W * s);
    c.height = Math.round(H * s);
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#1c1a17';
    ctx.fillRect(0, 0, c.width, c.height);
    const m = modeRef.current;
    if (m === 'viewer') {
      const g = ctx.createRadialGradient(c.width / 2, c.height * 0.38, 0, c.width / 2, c.height * 0.38, Math.max(c.width, c.height) * 0.7);
      g.addColorStop(0, '#4b453d');
      g.addColorStop(0.55, '#2d2925');
      g.addColorStop(1, '#1c1a17');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, c.width, c.height);
    }
    const video = videoRef.current;
    if (m === 'live' && video?.videoWidth) {
      const r = coverRect(video.videoWidth, video.videoHeight, c.width, c.height);
      ctx.save();
      if (facingRef.current === 'user') {
        ctx.translate(c.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, r.x, r.y, r.w, r.h);
      ctx.restore();
    }
    const img = photoRef.current;
    const rect = computePhotoRect();
    if (m === 'photo' && img && rect) ctx.drawImage(img, rect.x * s, rect.y * s, rect.w * s, rect.h * s);
    ctx.drawImage(engine.getCanvas(), 0, 0, c.width, c.height);
    drawCaption(ctx, c.width, c.height, s, productName, colorLabel);
    return c;
  };

  const capture = async () => {
    if (!canCapture) return;
    const c = composite();
    if (!c) return;
    const blob = await canvasToBlob(c);
    if (!blob || !mounted.current) return;
    const name = `optika-miftari-${slug(productName)}-${slug(colorLabel) || 'provo'}.png`;
    downloadBlob(blob, name);
    const item: Capture = { id: `${Date.now()}`, url: URL.createObjectURL(blob), label: productName, sub: colorLabel, width: c.width, height: c.height };
    const next = [...capturesRef.current, item];
    while (next.length > 2) URL.revokeObjectURL(next.shift()!.url);
    capturesRef.current = next;
    setCaptures(next);
    toast.success(t('captured'), { description: t('capturedText') });
  };

  const downloadCapture = async (cap: Capture) => {
    const blob = await fetch(cap.url).then((r) => r.blob());
    downloadBlob(blob, `optika-miftari-${slug(cap.label)}-${slug(cap.sub) || 'provo'}.png`);
  };

  const downloadCompare = async () => {
    const [a, b] = capturesRef.current;
    if (!a || !b) return;
    const load = (url: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
    const [ia, ib] = await Promise.all([load(a.url), load(b.url)]);
    const h = Math.min(ia.naturalHeight, ib.naturalHeight);
    const wa = (ia.naturalWidth * h) / ia.naturalHeight;
    const wb = (ib.naturalWidth * h) / ib.naturalHeight;
    const gap = Math.round(h * 0.02);
    const c = document.createElement('canvas');
    c.width = Math.round(wa + wb + gap);
    c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#f7f3ee';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(ia, 0, 0, wa, h);
    ctx.drawImage(ib, wa + gap, 0, wb, h);
    const blob = await canvasToBlob(c);
    if (blob) downloadBlob(blob, `optika-miftari-krahasim-${slug(a.label)}-${slug(b.label)}.png`);
  };

  const removeCapture = (id: string) => {
    const next = capturesRef.current.filter((c) => {
      if (c.id === id) URL.revokeObjectURL(c.url);
      return c.id !== id;
    });
    capturesRef.current = next;
    setCaptures(next);
  };
  const clearCaptures = () => {
    capturesRef.current.forEach((c) => URL.revokeObjectURL(c.url));
    capturesRef.current = [];
    setCaptures([]);
  };

  /* ---------------------------------------------------------------- cart */
  const inStock = !!product && product.stock > 0;
  const price = product ? unitPrice(product, options) : 0;
  const regular = product ? regularUnitPrice(product, options) : 0;
  const add = () => {
    if (!product || !inStock) return;
    addToCart({ productId: product.id, qty: 1, options, installation: false });
    toast.success(t('added'), {
      description: `${productName}${colorLabel ? ` · ${colorLabel}` : ''} · ${money(price, lang)}`,
      action: { label: t('viewCart'), onClick: () => setCartOpen(true) },
    });
    setCartOpen(true);
  };

  if (!product || !frame) return null;
  const category = categories.find((c) => c.id === product.categoryId);
  const dims = safeDims(frame);
  const showFit = mode !== 'viewer';
  const fitEnabled = (mode === 'photo' && status === 'photoReady') || (mode === 'live' && cameraActive);
  const priceText = money(price, lang, { decimals: price % 1 !== 0 });
  const regularText = regular > price ? money(regular, lang, { decimals: regular % 1 !== 0 }) : null;
  const inAppNote = inApp ? <InAppNote onCopy={copyLink} /> : null;
  const trackerTitle = trackerFail === 'runtime' ? t('trackerStoppedTitle') : t('trackerErrorTitle');

  /* ---------------------------------------------------------------- status chip */
  const pct = progress != null ? Math.round(progress * 100) : null;
  const chip: { text: string; tone: 'ok' | 'warn' | 'busy' | 'info'; extra?: string } | null = (() => {
    if (engineError) return null;
    if (mode === 'live' && cameraActive && videoPaused) return { text: t('tapToPlay'), tone: 'warn' };
    switch (status) {
      case 'viewer':
        return { text: t('stViewer'), tone: 'info', extra: t('stViewerZoom') };
      case 'analyzing':
        return pct == null ? { text: t('stAnalyzing'), tone: 'busy' } : null;
      case 'tracking':
        return { text: t('stTracking'), tone: 'ok' };
      case 'noface':
        return cameraActive ? { text: t('stNoFace'), tone: 'warn' } : null;
      case 'multiple':
        return { text: t('stMultiple'), tone: 'warn' };
      case 'tooClose':
        return { text: t('stTooClose'), tone: 'warn' };
      case 'tooFar':
        return { text: t('stTooFar'), tone: 'warn' };
      case 'lowLight':
        return { text: t('stLowLight'), tone: 'warn' };
      case 'photoReady':
        return { text: t('stPhotoReady'), tone: 'ok', extra: t('stPhotoReadyHint') };
      case 'switching':
        return { text: t('switchCamera'), tone: 'busy' };
      case 'loading':
        return cameraActive ? { text: pct != null ? `${t('loadingEngine')} ${pct}%` : t('loadingEngine'), tone: 'busy' } : null;
      default:
        return null;
    }
  })();
  const loadingCard = (title: string) => (
    <StageCard icon={<Loader2 className="h-6 w-6 animate-spin" />} title={title} text={pct != null ? t('loadingHint') : undefined}>
      {pct != null && (
        <div className="mx-auto w-full max-w-[240px]">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-brand-200 transition-[width] duration-300" style={{ width: `${Math.max(4, pct)}%` }} />
          </div>
          <div className="mt-2 text-[12px] font-semibold tabular-nums text-white/60">{pct}%</div>
        </div>
      )}
    </StageCard>
  );

  const fallbackActions = (
    <>
      <button type="button" className={stageBtn(true)} onClick={() => switchMode('photo')}>
        <ImagePlus className="h-4 w-4" /> {t('usePhoto')}
      </button>
      <button type="button" className={stageBtn()} onClick={() => switchMode('viewer')}>
        <Box className="h-4 w-4" /> {t('use3d')}
      </button>
    </>
  );

  /* ---------------------------------------------------------------- overlay for the current state */
  const overlay = (() => {
    if (engineError)
      return (
        <StageCard icon={<CircleAlert className="h-6 w-6" />} tone="alert" title={t('webglTitle')} text={t('webglText')} detail={errorDetail}>
          <ButtonLink to={`/produkt/${product.slug}`} variant="light" size="lg" className="w-full" iconRight={<ArrowUpRight className="h-4 w-4" />}>
            {t('viewProduct')}
          </ButtonLink>
        </StageCard>
      );
    if (mode === 'live') {
      if (status === 'idle')
        return (
          <StageCard icon={<ScanFace className="h-6 w-6" />} title={t('liveTitle')} text={t('liveText')} note={inAppNote}>
            <button type="button" className={stageBtn(true)} onClick={() => startCamera()}>
              <Camera className="h-[18px] w-[18px]" /> {t('startCamera')}
            </button>
            <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-full text-[13.5px] font-semibold text-white/75 transition hover:text-white" onClick={() => switchMode('photo')}>
              <ImagePlus className="h-4 w-4" /> {t('usePhoto')}
            </button>
          </StageCard>
        );
      if (status === 'insecure' || status === 'unsupported')
        return (
          <StageCard
            icon={<LockKeyhole className="h-6 w-6" />}
            title={status === 'insecure' ? t('insecureTitle') : t('unsupportedTitle')}
            text={status === 'insecure' ? t('insecureText') : t('unsupportedText')}
            detail={errorDetail}
            note={inAppNote}
          >
            {fallbackActions}
          </StageCard>
        );
      if (status === 'permission') return <StageCard icon={<Camera className="h-6 w-6" />} title={t('waitingPermission')} text={t('liveText')} />;
      if (status === 'loading' && !cameraActive) return loadingCard(t('loadingEngine'));
      if (status === 'denied' || status === 'nocamera' || status === 'busy' || status === 'camError' || status === 'trackerError') {
        const text = { denied: t('deniedText'), nocamera: t('noCamera'), busy: t('cameraBusy'), camError: t('cameraError'), trackerError: trackerFail === 'runtime' ? t('trackerRuntime') : t('trackerError') }[status];
        return (
          <StageCard
            icon={<CameraOff className="h-6 w-6" />}
            tone="alert"
            title={status === 'denied' ? t('deniedTitle') : status === 'trackerError' ? trackerTitle : t('cameraErrorTitle')}
            text={text}
            detail={errorDetail}
            note={inAppNote}
          >
            <button type="button" className={stageBtn(true)} onClick={() => startCamera()}>
              <RefreshCw className="h-4 w-4" /> {t('retry')}
            </button>
            <button type="button" className={stageBtn()} onClick={() => switchMode('photo')}>
              <ImagePlus className="h-4 w-4" /> {t('usePhoto')}
            </button>
          </StageCard>
        );
      }
    }
    if (mode === 'photo') {
      if (!photoUrl || status === 'badFile')
        return (
          <StageCard icon={<ImagePlus className="h-6 w-6" />} tone={status === 'badFile' ? 'alert' : 'default'} title={t('photoTitle')} text={status === 'badFile' ? t('photoBadFile') : t('photoText')}>
            <button type="button" className={stageBtn(true)} onClick={() => fileRef.current?.click()}>
              <ImagePlus className="h-4 w-4" /> {t('photoPick')}
            </button>
            <span className="hidden text-[12.5px] text-white/55 sm:block">{t('photoDrop')}</span>
          </StageCard>
        );
      if (status === 'analyzing') return progress != null ? loadingCard(t('loadingEngine')) : null;
      if (status === 'photoNoFace' || status === 'photoMultiple' || status === 'trackerError')
        return (
          <StageCard
            icon={<CircleAlert className="h-6 w-6" />}
            tone="alert"
            title={status === 'trackerError' ? trackerTitle : t('photoTitle')}
            text={status === 'photoMultiple' ? t('photoMultiple') : status === 'trackerError' ? (trackerFail === 'runtime' ? t('trackerRuntime') : t('trackerError')) : t('photoNoFace')}
            detail={status === 'trackerError' ? errorDetail : null}
          >
            <button type="button" className={stageBtn(true)} onClick={() => fileRef.current?.click()}>
              <ImagePlus className="h-4 w-4" /> {t('photoChange')}
            </button>
            {status === 'trackerError' && (
              <button type="button" className={stageBtn()} onClick={() => analyzePhoto()}>
                <RefreshCw className="h-4 w-4" /> {t('retry')}
              </button>
            )}
          </StageCard>
        );
    }
    return null;
  })();

  const showBackdrop = !engineError && ((mode === 'live' && !cameraActive) || (mode === 'photo' && !photoUrl));

  /* ---------------------------------------------------------------- fit / view controls */
  const fitControls = fitEnabled ? (
    <div className="grid gap-x-6 gap-y-1 sm:grid-cols-3">
      <RangeField label={t('fitSize')} value={fitScale} min={80} max={120} display={`${fitScale}%`} onChange={setFitScale} />
      <RangeField label={t('fitHeight')} value={fitHeight} min={-10} max={10} display={`${fitHeight > 0 ? '+' : ''}${fitHeight}`} onChange={setFitHeight} />
      <RangeField label={t('fitTilt')} value={fitTilt} min={-12} max={12} display={`${fitTilt > 0 ? '+' : ''}${fitTilt}°`} onChange={setFitTilt} />
    </div>
  ) : (
    <p className="py-1.5 text-[13.5px] leading-relaxed text-muted">{t('fitHint')}</p>
  );
  const viewControls = (
    <div className="grid items-center gap-x-6 gap-y-3 sm:grid-cols-[auto_minmax(0,1fr)]">
      <div className="flex gap-1 rounded-full bg-paper p-1 ring-1 ring-line">
        {(
          [
            ['viewLeft', -0.62],
            ['viewFront', 0],
            ['viewRight', 0.62],
          ] as const
        ).map(([key, yaw]) => (
          <button key={key} type="button" onClick={() => preset(yaw)} className="h-10 flex-1 rounded-full px-4 text-[13px] font-semibold text-ink-soft transition hover:bg-white hover:text-ink hover:shadow-sm">
            {t(key)}
          </button>
        ))}
      </div>
      <RangeField label={t('viewZoom')} value={Math.round(zoom * 100)} min={VIEWER_ZOOM.min * 100} max={VIEWER_ZOOM.max * 100} display={`${Math.round(zoom * 100)}%`} onChange={(v) => setZoom(v / 100)} />
    </div>
  );

  /* ---------------------------------------------------------------- stage */
  const stage = (
    <div
      ref={stageRef}
      data-delegate={delegate ?? undefined}
      data-status={status}
      className={cn(
        'relative isolate select-none overflow-hidden bg-ink shadow-[0_40px_90px_-50px_rgba(28,26,23,0.9)] outline-none',
        // phones: a tall, nearly full-bleed camera view; tablets 4:3; desktop 16:10
        '-mx-1 h-[min(68svh,600px)] min-h-[420px] rounded-[24px] sm:mx-0 sm:aspect-[4/3] sm:h-auto sm:min-h-0 sm:rounded-[28px] lg:aspect-[16/10]',
        mode === 'viewer' && 'cursor-grab touch-pan-y active:cursor-grabbing',
        dragOver && 'ring-4 ring-brand-300',
      )}
      tabIndex={mode === 'viewer' ? 0 : -1}
      role={mode === 'viewer' ? 'application' : undefined}
      aria-roledescription={mode === 'viewer' ? '3D' : undefined}
      aria-label={mode === 'viewer' ? `${productName} — ${t('stageLabel')}` : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onStageKey}
      onDragOver={onDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {/* backgrounds */}
      {mode === 'viewer' && (
        <>
          <div className="absolute inset-0" style={{ background: VIEWER_BG }} />
          <div className="absolute left-1/2 top-[64%] h-12 w-[44%] -translate-x-1/2 rounded-[50%] bg-black/45 blur-2xl" />
          <div className="bg-grain absolute inset-0 opacity-60" />
        </>
      )}
      {showBackdrop && <Img src="/images/hero/optical.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-[72%_35%] opacity-25 blur-[3px]" />}
      {/* Always in the DOM, so the stream is never attached to an element React is still creating. */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        disablePictureInPicture
        onPlaying={() => setVideoPaused(false)}
        onPause={() => setVideoPaused(!!streamRef.current)}
        className={cn(
          'absolute inset-0 h-full w-full object-cover transition-opacity duration-500',
          mode !== 'live' && 'hidden',
          cameraActive ? 'opacity-100' : 'opacity-0',
          facing === 'user' && '-scale-x-100',
        )}
      />
      {mode === 'photo' && photoUrl && (
        <img
          ref={photoRef}
          src={photoUrl}
          alt={t('photoAlt')}
          onLoad={() => {
            placePhoto();
            analyzePhoto();
          }}
          className={cn('absolute max-w-none transition-opacity duration-500', photoRect ? 'opacity-100' : 'opacity-0', status === 'analyzing' && 'opacity-70')}
          style={photoRect ? { left: photoRect.x, top: photoRect.y, width: photoRect.w, height: photoRect.h } : { inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      <div ref={hostRef} className="pointer-events-none absolute inset-0" aria-hidden />

      {/* face guide while the camera searches */}
      {mode === 'live' && cameraActive && (status === 'noface' || status === 'loading') && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
          <div className="aspect-[3/4] h-[58%] rounded-[50%] border-2 border-dashed border-white/45 sm:h-[62%]" />
        </div>
      )}

      {overlay}

      {/* mode tabs */}
      <div role="tablist" aria-label={t('modesLabel')} className="absolute left-1/2 top-2.5 z-20 flex -translate-x-1/2 gap-0.5 rounded-full bg-black/45 p-1 ring-1 ring-white/12 backdrop-blur-md sm:top-4 sm:gap-1">
        {MODES.map(({ id, icon: Icon, key, short }) => {
          const on = mode === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => switchMode(id)}
              className={cn(
                'inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-semibold transition-colors duration-200 sm:gap-2 sm:px-4',
                on ? 'bg-white text-ink shadow-sm' : 'text-white/75 hover:text-white',
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="sm:hidden">{t(short)}</span>
              <span className="hidden sm:inline">{t(key)}</span>
            </button>
          );
        })}
      </div>

      {/* bottom bar: status + actions */}
      <div className="pointer-events-none absolute inset-x-2.5 bottom-2.5 z-20 flex items-end justify-between gap-2 sm:inset-x-4 sm:bottom-4">
        <div className="min-w-0">
          {chip && (
            <span
              role="status"
              aria-live="polite"
              className="pointer-events-auto inline-flex max-w-full items-center gap-2 rounded-full bg-black/50 py-2 pl-2.5 pr-3.5 text-[12.5px] font-semibold text-white ring-1 ring-white/10 backdrop-blur-md"
            >
              {chip.tone === 'busy' ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : (
                <span className={cn('h-2 w-2 shrink-0 rounded-full', chip.tone === 'ok' ? 'bg-emerald-400' : chip.tone === 'warn' ? 'bg-amber-300' : 'bg-brand-200')} />
              )}
              <span className="truncate">
                {chip.text}
                {chip.extra && <span className="hidden font-medium text-white/65 sm:inline"> · {chip.extra}</span>}
              </span>
            </span>
          )}
        </div>
        <div className="pointer-events-auto flex shrink-0 items-center gap-2">
          {mode === 'live' && cameraActive && (
            <>
              <StageIconButton label={t('switchCamera')} onClick={() => startCamera(facingRef.current === 'user' ? 'environment' : 'user')}>
                <SwitchCamera className="h-[18px] w-[18px]" />
              </StageIconButton>
              <StageIconButton
                label={t('stopCamera')}
                onClick={() => {
                  stopCamera();
                  setStatus('idle');
                }}
              >
                <CameraOff className="h-[18px] w-[18px]" />
              </StageIconButton>
            </>
          )}
          {mode === 'photo' && photoUrl && (
            <>
              <StageIconButton label={t('photoChange')} onClick={() => fileRef.current?.click()}>
                <ImagePlus className="h-[18px] w-[18px]" />
              </StageIconButton>
              <StageIconButton label={t('photoRemove')} onClick={removePhoto}>
                <Trash2 className="h-[18px] w-[18px]" />
              </StageIconButton>
            </>
          )}
          {canCapture && (
            <button
              type="button"
              onClick={capture}
              aria-label={t('capture')}
              className="inline-flex h-12 w-12 items-center justify-center gap-2 rounded-full bg-white text-[13.5px] font-semibold text-ink shadow-lg ring-4 ring-white/25 transition hover:bg-sand active:scale-95 sm:h-11 sm:w-auto sm:pl-3.5 sm:pr-4 sm:ring-0"
            >
              <Camera className="h-5 w-5 sm:h-[18px] sm:w-[18px]" /> <span className="hidden sm:inline">{t('capture')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      className="sr-only"
      tabIndex={-1}
      aria-label={t('photoPick')}
      onChange={(e) => {
        takePhoto(e.target.files?.[0]);
        e.target.value = '';
      }}
    />
  );

  const round = 'grid h-12 w-12 shrink-0 place-items-center rounded-full border border-ink/15 bg-white/60 text-ink transition hover:border-ink/35 hover:bg-white active:scale-95';
  const disclosureRows: { icon: ReactNode; title: string; sub: string; body: ReactNode }[] = [
    {
      icon: <SlidersHorizontal className="h-4 w-4" />,
      title: showFit ? t('fitTitle') : t('viewTitle'),
      sub: showFit ? t('fitOpen') : t('viewOpen'),
      body: engineError ? null : (
        <>
          {showFit ? fitControls : viewControls}
          {(showFit ? fitEnabled : true) && (
            <div className="mt-1 flex justify-end">
              <ResetButton onClick={showFit ? resetFit : resetView} label={showFit ? t('fitReset') : t('viewReset')} />
            </div>
          )}
        </>
      ),
    },
    {
      icon: <Ruler className="h-4 w-4" />,
      title: t('measurements'),
      sub: `${dims.lensWidth}-${dims.bridgeWidth}-${dims.templeLength} · ${t('approx')}`,
      body: <MeasureTiles dims={dims} />,
    },
    { icon: <ScanFace className="h-4 w-4" />, title: t('stepsEyebrow'), sub: stripAccent(t('stepsTitle')), body: <StepsList /> },
    {
      icon: <Box className="h-4 w-4" />,
      title: t('approx'),
      sub: t('approxOpen'),
      body: (
        <div className="space-y-2.5 text-[13.5px] leading-relaxed text-muted">
          <p>{t('noteText')}</p>
          <p className="flex gap-2 text-ink-soft">
            <LockKeyhole className="mt-1 h-3.5 w-3.5 shrink-0 text-brand-600" />
            <span>{t('notePrivacy')}</span>
          </p>
        </div>
      ),
    },
  ];

  /* ---------------------------------------------------------------- phones & tablets: compact dock */
  const dock = (
    <div className="mt-2.5">
      <p className="px-2 text-center text-[12px] leading-snug text-muted">
        <LockKeyhole className="-mt-0.5 mr-1.5 inline h-3.5 w-3.5 text-brand-600" />
        {t('privacy')}
      </p>

      <div className="mt-4">
        <FrameStrip products={frames} categories={categories} filter={filter} onFilter={setFilter} value={product.id} onChange={(p) => choose(p)} />
      </div>

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <h2 className="display truncate text-[23px] leading-tight text-ink">{productName}</h2>
          <div className="mt-0.5 flex min-w-0 items-baseline gap-x-2 text-[13px]">
            <span className={cn('text-[16px] font-bold tabular-nums tracking-tight', isOnSale(product) ? 'text-brand-700' : 'text-ink')}>{priceText}</span>
            {regularText && <span className="font-medium tabular-nums text-muted line-through">{regularText}</span>}
            {colorLabel && <span className="min-w-0 truncate text-muted">· {colorLabel}</span>}
          </div>
        </div>
        {colorOpt && colorOpt.values.length > 0 && <ColorSwatches compact option={colorOpt} value={activeColor?.id ?? ''} onChange={setColorId} />}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={!inStock}
          onClick={add}
          className="inline-flex h-12 min-w-0 flex-1 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full bg-brand-600 px-4 text-[14.5px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_10px_24px_-14px_var(--color-brand-700)] transition hover:bg-brand-700 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
        >
          {inStock ? (
            <>
              <ShoppingBag className="h-4 w-4 shrink-0 max-[379px]:hidden" />
              <span className="truncate">
                {t('addToCart')} <span className="font-medium text-white/70">·</span> <span className="tabular-nums">{priceText}</span>
              </span>
            </>
          ) : (
            t('outOfStock')
          )}
        </button>
        <Link to={`/produkt/${product.slug}`} aria-label={t('viewProduct')} title={t('viewProduct')} className={round}>
          <ArrowUpRight className="h-[18px] w-[18px]" />
        </Link>
        <Link to="/rezervo" aria-label={t('bookExam')} title={t('bookExam')} className={round}>
          <CalendarCheck className="h-[18px] w-[18px]" />
        </Link>
      </div>
      <p className="mt-2 text-[12px] leading-snug text-muted">{t('cartNote')}</p>

      {captures.length > 0 && (
        <div className="mt-3">
          <CompareStrip captures={captures} onDownload={downloadCapture} onCompare={downloadCompare} onRemove={removeCapture} onClear={clearCaptures} />
        </div>
      )}

      <div className="mt-4 rounded-3xl bg-white px-4 ring-1 ring-line">
        {disclosureRows.map((row) => (
          <Disclosure key={row.title} icon={row.icon} title={row.title} sub={row.sub}>
            {row.body}
          </Disclosure>
        ))}
      </div>
    </div>
  );

  return (
    <div className="grid gap-x-8 gap-y-8 lg:grid-cols-[minmax(0,1fr)_372px] xl:grid-cols-[minmax(0,1fr)_392px]">
      {/* ------------------------------------------------------------ stage + controls (the stage stays mounted across breakpoints) */}
      <div className="min-w-0 lg:col-start-1 lg:row-start-1 lg:space-y-3">
        {stage}
        {fileInput}
        {desktop ? (
          <>
            {engineError ? null : showFit ? (
              <ControlCard title={t('fitTitle')} onReset={fitEnabled ? resetFit : undefined} resetLabel={t('fitReset')}>
                {fitControls}
              </ControlCard>
            ) : (
              <ControlCard title={t('viewTitle')} onReset={resetView} resetLabel={t('viewReset')}>
                {viewControls}
              </ControlCard>
            )}
            <CompareTray captures={captures} onDownload={downloadCapture} onCompare={downloadCompare} onRemove={removeCapture} onClear={clearCaptures} />
          </>
        ) : (
          dock
        )}
      </div>

      {desktop && (
        <>
          {/* ------------------------------------------------------------ frame picker */}
          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
            <FramePicker products={frames} categories={categories} filter={filter} onFilter={setFilter} value={product.id} onChange={(p) => choose(p)} />
          </div>

          {/* ------------------------------------------------------------ panel */}
          <aside className="self-start rounded-[28px] bg-white p-5 ring-1 ring-line sm:p-7 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <div className="flex items-start gap-4">
              <Link to={`/produkt/${product.slug}`} className="block h-[88px] w-[70px] shrink-0 overflow-hidden rounded-2xl bg-sand">
                <Img src={product.images[0]} small alt={productName} className="h-full w-full object-cover" />
              </Link>
              <div className="min-w-0 flex-1">
                {category && <div className="eyebrow">{l(category.name)}</div>}
                <h2 className="display mt-1.5 text-[30px] leading-[1.02] text-ink">{productName}</h2>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
                  <span className={cn('text-[20px] font-bold tabular-nums tracking-tight', isOnSale(product) ? 'text-brand-700' : 'text-ink')}>{priceText}</span>
                  {regularText && <span className="text-[13.5px] font-medium tabular-nums text-muted line-through">{regularText}</span>}
                </div>
              </div>
            </div>
            {l(product.short) && <p className="mt-4 text-[14px] leading-relaxed text-ink-soft">{l(product.short)}</p>}

            {colorOpt && colorOpt.values.length > 0 && (
              <div className="mt-6 border-t border-line pt-5">
                <ColorSwatches option={colorOpt} value={activeColor?.id ?? ''} onChange={setColorId} />
              </div>
            )}

            <div className="mt-6 border-t border-line pt-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-soft">{t('measurements')}</span>
                <span className="rounded-full bg-sand px-2.5 py-1 text-[11px] font-semibold text-ink-soft">{t('approx')}</span>
              </div>
              <MeasureTiles dims={dims} />
            </div>

            <div className="mt-6 space-y-2.5 border-t border-line pt-5">
              <Button size="lg" className="w-full" icon={<ShoppingBag className="h-4 w-4" />} disabled={!inStock} onClick={add}>
                {inStock ? (
                  <>
                    {t('addToCart')} <span className="font-medium text-white/70">·</span> <span className="tabular-nums">{priceText}</span>
                  </>
                ) : (
                  t('outOfStock')
                )}
              </Button>
              <div className="grid grid-cols-2 gap-2.5">
                <Button variant="outline" icon={<Camera className="h-4 w-4" />} disabled={!canCapture} onClick={capture} className="px-3">
                  {t('capture')}
                </Button>
                <ButtonLink to={`/produkt/${product.slug}`} variant="outline" iconRight={<ArrowUpRight className="h-4 w-4" />} className="px-3">
                  {t('viewProduct')}
                </ButtonLink>
              </div>
              <ButtonLink to="/rezervo" variant="soft" className="w-full" icon={<CalendarCheck className="h-4 w-4" />}>
                {t('bookExam')}
              </ButtonLink>
              <p className="pt-1 text-[12.5px] leading-relaxed text-muted">{t('cartNote')}</p>
            </div>

            <div className="mt-5 flex gap-3 rounded-2xl bg-paper p-4 text-[12.5px] leading-relaxed text-ink-soft">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <span>{t('privacy')}</span>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
