import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowUpRight, Box, CalendarCheck, Camera, CameraOff, CircleAlert, ImagePlus, Loader2, LockKeyhole, RefreshCw, ScanFace, ShoppingBag, SwitchCamera, Trash2, Video } from 'lucide-react';
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
import { createFaceTracker, type FaceLandmarkerResult, type FaceTracker, type TrackerMode } from './tracker';
import { ColorSwatches, CompareTray, ControlCard, FramePicker, RangeField, StageCard, StageIconButton, stageBtn, type Capture } from './parts';

type Mode = 'live' | 'photo' | 'viewer';
type Status =
  | 'viewer'
  // live camera
  | 'idle'
  | 'insecure'
  | 'loading'
  | 'permission'
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

const MODES: { id: Mode; icon: typeof Video; key: 'modeLive' | 'modePhoto' | 'modeViewer' }[] = [
  { id: 'live', icon: Video, key: 'modeLive' },
  { id: 'photo', icon: ImagePlus, key: 'modePhoto' },
  { id: 'viewer', icon: Box, key: 'modeViewer' },
];

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO = 12 * 1024 * 1024;
const VIEWER_BG = 'radial-gradient(120% 90% at 50% 38%, #4b453d 0%, #2d2925 42%, #1c1a17 78%)';

const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const cameraSupported = () => typeof window !== 'undefined' && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

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
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
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
  const streamRef = useRef<MediaStream | null>(null);
  const session = useRef(createCameraSession());
  const rafRef = useRef(0);
  const lastVideoTime = useRef(-1);
  const lastDetect = useRef(0);
  const lightCanvas = useRef<HTMLCanvasElement | null>(null);
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
          setEngineError(true);
          stopCamera();
        },
        onContextRestored: () => mounted.current && setEngineError(false),
      });
    } catch {
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
    const onHidden = () => {
      if (document.hidden && streamRef.current) {
        stopCamera();
        setStatus('idle');
      }
    };
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      mounted.current = false;
      document.removeEventListener('visibilitychange', onHidden);
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
      setProgress(0);
      trackerPromise.current = createFaceTracker(runMode, (p) => mounted.current && setProgress(p))
        .then((tracker) => {
          if (!mounted.current) {
            tracker.close();
            throw new Error('closed');
          }
          trackerRef.current = tracker;
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

  /* ---------------------------------------------------------------- camera */
  function stopCamera() {
    session.current.cancel();
    cancelAnimationFrame(rafRef.current);
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    lastVideoTime.current = -1;
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
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, 16, 16);
    const px = ctx.getImageData(0, 0, 16, 16).data;
    let total = 0;
    for (let i = 0; i < px.length; i += 4) total += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    lowLight.current = total / (px.length / 4) < 62;
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

  const trackLoop = () => {
    const video = videoRef.current;
    const tracker = trackerRef.current;
    if (!streamRef.current || modeRef.current !== 'live') return;
    const now = performance.now();
    if (video && tracker && tracker.mode === 'VIDEO' && video.readyState >= 2 && video.currentTime !== lastVideoTime.current && now - lastDetect.current >= 1000 / 30) {
      lastVideoTime.current = video.currentTime;
      lastDetect.current = now;
      try {
        handleLive(tracker.detectVideo(video, now), video, now);
      } catch {
        engineRef.current?.setFacePose(null);
        setStatus('noface');
      }
    }
    rafRef.current = requestAnimationFrame(trackLoop);
  };

  const startCamera = async (wantFacing: 'user' | 'environment' = facingRef.current) => {
    if (!cameraSupported()) return setStatus('insecure');
    if (!engineRef.current) return;
    stopCamera();
    const token = session.current.begin();
    setStatus('permission');
    // Permission first: the ~15 MB tracker is only fetched once the visitor has actually allowed the camera
    // (their video already shows while it loads).
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: wantFacing }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
        audio: false,
      });
    } catch (error) {
      if (!session.current.current(token) || !mounted.current) return;
      const name = (error as DOMException)?.name;
      setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'nocamera' : name === 'NotReadableError' ? 'busy' : 'camError');
      return;
    }
    if (!session.current.accept(token, stream) || !mounted.current || modeRef.current !== 'live') {
      stopMediaStream(stream);
      return;
    }
    streamRef.current = stream;
    facingRef.current = wantFacing;
    setFacing(wantFacing);
    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      await video.play().catch(() => undefined);
    }
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
    if (!trackerRef.current || trackerRef.current.mode !== 'VIDEO') setStatus('loading');
    try {
      await ensureTracker('VIDEO');
    } catch {
      if (!session.current.current(token) || !mounted.current) return;
      stopCamera();
      setStatus('trackerError');
      return;
    }
    if (!session.current.current(token) || !mounted.current || modeRef.current !== 'live') return;
    setStatus('noface');
    engineRef.current?.setMode('live');
    rafRef.current = requestAnimationFrame(trackLoop);
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
    engineRef.current?.setFacePose(null);
    setStatus('analyzing');
    try {
      const tracker = await ensureTracker('IMAGE');
      await img.decode?.().catch(() => undefined);
      if (rev !== photoRev.current || !mounted.current || modeRef.current !== 'photo' || photoUrlRef.current !== url) return;
      const result = tracker.detect(img);
      photoResult.current = { url, result };
      // Centre the crop on the eyes so the face stays in view on narrow (phone) stages.
      const face = result.faceLandmarks?.[0];
      if (face && result.faceLandmarks.length === 1) {
        const a = face[468] ?? face[33];
        const b = face[473] ?? face[263];
        if (a && b) photoFocus.current = { x: clamp((a.x + b.x) / 2, 0, 1), y: clamp((a.y + b.y) / 2 + 0.06, 0, 1) };
      }
      placePhoto();
    } catch {
      if (rev !== photoRev.current || !mounted.current) return;
      engineRef.current?.setFacePose(null);
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
    const engine = engineRef.current;
    engine?.setMode(next);
    engine?.setAutoRotate(next === 'viewer' && !interacted.current && !prefersReducedMotion());
    if (next === 'viewer') setStatus('viewer');
    if (next === 'live') setStatus(cameraSupported() ? 'idle' : 'insecure');
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

  /* ---------------------------------------------------------------- status chip */
  const pct = progress != null ? Math.round(progress * 100) : null;
  const chip: { text: string; tone: 'ok' | 'warn' | 'busy' | 'info'; extra?: string } | null = (() => {
    if (engineError) return null;
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
        <StageCard icon={<CircleAlert className="h-6 w-6" />} tone="alert" title={t('webglTitle')} text={t('webglText')}>
          <ButtonLink to={`/produkt/${product.slug}`} variant="light" size="lg" className="w-full" iconRight={<ArrowUpRight className="h-4 w-4" />}>
            {t('viewProduct')}
          </ButtonLink>
        </StageCard>
      );
    if (mode === 'live') {
      if (status === 'idle')
        return (
          <StageCard icon={<ScanFace className="h-6 w-6" />} title={t('liveTitle')} text={t('liveText')}>
            <button type="button" className={stageBtn(true)} onClick={() => startCamera()}>
              <Camera className="h-4 w-4" /> {t('startCamera')}
            </button>
            <button type="button" className={stageBtn()} onClick={() => switchMode('photo')}>
              <ImagePlus className="h-4 w-4" /> {t('usePhoto')}
            </button>
          </StageCard>
        );
      if (status === 'insecure')
        return (
          <StageCard icon={<LockKeyhole className="h-6 w-6" />} title={t('insecureTitle')} text={t('insecureText')}>
            {fallbackActions}
          </StageCard>
        );
      if (status === 'permission') return <StageCard icon={<Camera className="h-6 w-6" />} title={t('waitingPermission')} text={t('liveText')} />;
      if (status === 'loading' && !cameraActive) return loadingCard(t('loadingEngine'));
      if (status === 'denied' || status === 'nocamera' || status === 'busy' || status === 'camError' || status === 'trackerError') {
        const text = { denied: t('deniedText'), nocamera: t('noCamera'), busy: t('cameraBusy'), camError: t('cameraError'), trackerError: t('trackerError') }[status];
        return (
          <StageCard icon={<CameraOff className="h-6 w-6" />} tone="alert" title={status === 'denied' ? t('deniedTitle') : status === 'trackerError' ? t('trackerErrorTitle') : t('cameraErrorTitle')} text={text}>
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
          <StageCard icon={<CircleAlert className="h-6 w-6" />} tone="alert" title={t('photoTitle')} text={status === 'photoMultiple' ? t('photoMultiple') : status === 'trackerError' ? t('trackerError') : t('photoNoFace')}>
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

  return (
    <div className="grid gap-x-8 gap-y-8 lg:grid-cols-[minmax(0,1fr)_372px] xl:grid-cols-[minmax(0,1fr)_392px]">
      {/* ------------------------------------------------------------ stage + controls */}
      <div className="min-w-0 space-y-3 lg:col-start-1 lg:row-start-1">
        <div
          ref={stageRef}
          className={cn(
            'relative isolate aspect-[4/5] w-full select-none overflow-hidden rounded-[28px] bg-ink shadow-[0_40px_90px_-50px_rgba(28,26,23,0.9)] outline-none sm:aspect-[4/3] lg:aspect-[16/10]',
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
          {mode === 'live' && (
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={cn('absolute inset-0 h-full w-full object-cover transition-opacity duration-500', cameraActive ? 'opacity-100' : 'opacity-0', facing === 'user' && '-scale-x-100')}
            />
          )}
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
              <div className="aspect-[3/4] h-[62%] rounded-[50%] border-2 border-dashed border-white/45" />
            </div>
          )}

          {overlay}

          {/* mode tabs */}
          <div role="tablist" aria-label={t('modesLabel')} className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 gap-1 rounded-full bg-black/45 p-1 ring-1 ring-white/12 backdrop-blur-md sm:top-4">
            {MODES.map(({ id, icon: Icon, key }) => {
              const on = mode === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => switchMode(id)}
                  className={cn(
                    'inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-200 sm:gap-2 sm:px-4',
                    on ? 'bg-white text-ink shadow-sm' : 'text-white/75 hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4" /> {t(key)}
                </button>
              );
            })}
          </div>

          {/* bottom bar: status + actions */}
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex items-end justify-between gap-2 sm:inset-x-4 sm:bottom-4">
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
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-white pl-3.5 pr-4 text-[13.5px] font-semibold text-ink shadow-lg transition hover:bg-sand active:scale-95"
                >
                  <Camera className="h-[18px] w-[18px]" /> <span className="hidden sm:inline">{t('capture')}</span>
                </button>
              )}
            </div>
          </div>
        </div>

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

        {/* fit / view controls */}
        {engineError ? null : showFit ? (
          <ControlCard title={t('fitTitle')} onReset={fitEnabled ? resetFit : undefined} resetLabel={t('fitReset')}>
            {fitEnabled ? (
              <div className="grid gap-x-6 gap-y-1 sm:grid-cols-3">
                <RangeField label={t('fitSize')} value={fitScale} min={80} max={120} display={`${fitScale}%`} onChange={setFitScale} />
                <RangeField label={t('fitHeight')} value={fitHeight} min={-10} max={10} display={`${fitHeight > 0 ? '+' : ''}${fitHeight}`} onChange={setFitHeight} />
                <RangeField label={t('fitTilt')} value={fitTilt} min={-12} max={12} display={`${fitTilt > 0 ? '+' : ''}${fitTilt}°`} onChange={setFitTilt} />
              </div>
            ) : (
              <p className="py-1.5 text-[13.5px] leading-relaxed text-muted">{t('fitHint')}</p>
            )}
          </ControlCard>
        ) : (
          <ControlCard title={t('viewTitle')} onReset={resetView} resetLabel={t('viewReset')}>
            <div className="grid items-center gap-x-6 gap-y-3 sm:grid-cols-[auto_minmax(0,1fr)]">
              <div className="flex gap-1 rounded-full bg-paper p-1 ring-1 ring-line">
                {(
                  [
                    ['viewLeft', -0.62],
                    ['viewFront', 0],
                    ['viewRight', 0.62],
                  ] as const
                ).map(([key, yaw]) => (
                  <button key={key} type="button" onClick={() => preset(yaw)} className="h-9 flex-1 rounded-full px-4 text-[13px] font-semibold text-ink-soft transition hover:bg-white hover:text-ink hover:shadow-sm">
                    {t(key)}
                  </button>
                ))}
              </div>
              <RangeField label={t('viewZoom')} value={Math.round(zoom * 100)} min={VIEWER_ZOOM.min * 100} max={VIEWER_ZOOM.max * 100} display={`${Math.round(zoom * 100)}%`} onChange={(v) => setZoom(v / 100)} />
            </div>
          </ControlCard>
        )}

        <CompareTray captures={captures} onDownload={downloadCapture} onCompare={downloadCompare} onRemove={removeCapture} onClear={clearCaptures} />
      </div>

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
              <span className={cn('text-[20px] font-bold tabular-nums tracking-tight', isOnSale(product) ? 'text-brand-700' : 'text-ink')}>{money(price, lang, { decimals: price % 1 !== 0 })}</span>
              {regular > price && <span className="text-[13.5px] font-medium tabular-nums text-muted line-through">{money(regular, lang, { decimals: regular % 1 !== 0 })}</span>}
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
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-soft">{t('measurements')}</span>
            <span className="rounded-full bg-sand px-2.5 py-1 text-[11px] font-semibold text-ink-soft">{t('approx')}</span>
          </div>
          <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
            {(
              [
                ['mWidth', dims.frameWidth],
                ['mLens', dims.lensWidth],
                ['mBridge', dims.bridgeWidth],
                ['mTemple', dims.templeLength],
              ] as const
            ).map(([key, value]) => (
              <div key={key} className="rounded-2xl bg-paper px-1 py-2.5">
                <dt className="text-[11px] font-semibold text-muted">{t(key)}</dt>
                <dd className="mt-0.5 text-[15px] font-bold tabular-nums text-ink">
                  {value}
                  <span className="ml-0.5 text-[11px] font-semibold text-muted">mm</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-6 space-y-2.5 border-t border-line pt-5">
          <Button size="lg" className="w-full" icon={<ShoppingBag className="h-4 w-4" />} disabled={!inStock} onClick={add}>
            {inStock ? (
              <>
                {t('addToCart')} <span className="font-medium text-white/70">·</span> <span className="tabular-nums">{money(price, lang, { decimals: price % 1 !== 0 })}</span>
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
          <ButtonLink to="/kontakt" variant="soft" className="w-full" icon={<CalendarCheck className="h-4 w-4" />}>
            {t('bookExam')}
          </ButtonLink>
          <p className="pt-1 text-[12.5px] leading-relaxed text-muted">{t('cartNote')}</p>
        </div>

        <div className="mt-5 flex gap-3 rounded-2xl bg-paper p-4 text-[12.5px] leading-relaxed text-ink-soft">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <span>{t('privacy')}</span>
        </div>
      </aside>
    </div>
  );
}
