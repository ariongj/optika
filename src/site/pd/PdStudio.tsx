import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { ArrowRight, CalendarCheck, Camera, CameraOff, Check, CircleAlert, Copy, CreditCard, Eye, Glasses, Layers, Loader2, LockKeyhole, RefreshCw, Ruler, ScanFace, Smartphone } from 'lucide-react';
import { Img } from '@/components/ui/misc';
import { ButtonLink } from '@/components/ui/Button';
import { useDict, useLang } from '@/i18n';
import { cn } from '@/lib/utils';
import { clamp, coverRect, createCameraSession, stopMediaStream, type Point } from '@/site/tryon/pose';
import { createFaceTracker, trackerAssetsLoaded, type FaceLandmarkerResult, type FaceTracker } from '@/site/tryon/tracker';
import { cameraSupport, copyText, describeError, isHandheld, isInAppBrowser, playVideo, videoConstraints, type CameraSupport } from '@/site/tryon/device';
import { Disclosure, InAppNote, StageCard, StageIconButton, stageBtn } from '@/site/tryon/parts';
import { CardAdjust, type CardGuess } from './CardAdjust';
import { PD } from './dict';
import { createSampler, expectedCard, findCardEdges, fromCard, isReading, readFrame, type Hint, type PdResult, type Reading } from './measure';

type Phase =
  | 'idle'
  | 'insecure'
  | 'unsupported'
  | 'permission'
  | 'loading'
  | 'denied'
  | 'nocamera'
  | 'busy'
  | 'camError'
  | 'trackerError'
  | 'measuring'
  | 'result'
  | 'cardGuide'
  | 'cardLive'
  | 'cardAdjust';
type LiveHint = Hint | 'unsteady' | 'lowLight';
type Goal = 'measure' | 'card';

const HINT_KEY = {
  ok: 'hOk',
  noFace: 'hNoFace',
  multiple: 'hMultiple',
  tooFar: 'hTooFar',
  tooClose: 'hTooClose',
  centre: 'hCentre',
  turn: 'hTurn',
  tilt: 'hTilt',
  level: 'hLevel',
  blink: 'hBlink',
  unsteady: 'hUnsteady',
  lowLight: 'hLowLight',
} as const satisfies Record<LiveHint, string>;

/** detectForVideo failures in a row before the tracker is re-created on the CPU. */
const MAX_DETECT_ERRORS = 3;
/** A GPU tracker that sees no face for this long while the video plays is treated as broken. */
const GPU_EMPTY_MS = 6000;
/** After the countdown, how long to wait for a frame the measurement can be taken from. */
const CARD_WAIT_MS = 3000;
const STAGE_BG = 'radial-gradient(120% 90% at 50% 38%, #4b453d 0%, #2d2925 42%, #1c1a17 78%)';
const GOLD = '#e3cf9f';

/** Rounded rectangle path; a plain one where the browser has no roundRect (Safari before 16). */
const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
};

const supportDetail = (support: CameraSupport) =>
  support === 'insecure' ? `isSecureContext = false (${window.location.protocol}//${window.location.host})` : support === 'unsupported' ? 'navigator.mediaDevices.getUserMedia is not available' : null;

export function PdStudio() {
  const t = useDict(PD);
  const lang = useLang();
  const num = (v: number) => (Number.isInteger(v) ? String(v) : lang === 'en' ? v.toFixed(1) : v.toFixed(1).replace('.', ','));
  const [lite] = useState(isHandheld);
  const [inApp] = useState(isInAppBrowser);

  const [phase, setPhaseState] = useState<Phase>('idle');
  const phaseRef = useRef<Phase>('idle');
  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };
  const [hint, setHintState] = useState<LiveHint>('noFace');
  const hintRef = useRef<LiveHint>('noFace');
  const [pct, setPct] = useState(0);
  const [count, setCount] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [videoPaused, setVideoPaused] = useState(false);
  const [loadPct, setLoadPct] = useState<number | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [trackerFail, setTrackerFail] = useState<'load' | 'runtime'>('load');
  const [result, setResult] = useState<PdResult | null>(null);
  const [cardFailed, setCardFailed] = useState(false);
  const [cardBad, setCardBad] = useState(false);
  const [adjust, setAdjust] = useState<{ reading: Reading; guess: CardGuess; edges: { left: number; right: number; found: boolean } } | null>(null);
  const [copied, setCopied] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hudRef = useRef<HTMLCanvasElement>(null);
  /** The frame a result was taken from. Lives only in this canvas: never encoded, stored or sent. */
  const stillRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackerRef = useRef<FaceTracker | null>(null);
  const trackerPromise = useRef<Promise<FaceTracker> | null>(null);
  const session = useRef(createCameraSession());
  const mounted = useRef(true);
  const rafRef = useRef(0);
  const goalRef = useRef<Goal>('measure');
  const sampler = useRef(createSampler());
  const lastVideoTime = useRef(-1);
  const lastDetect = useRef(0);
  const lastPlayTry = useRef(0);
  const detectErrors = useRef(0);
  const emptySince = useRef<number | null>(null);
  const preferCpu = useRef(false);
  const recovering = useRef(false);
  const frameCanvas = useRef<HTMLCanvasElement | null>(null);
  const lightCanvas = useRef<HTMLCanvasElement | null>(null);
  const lastLight = useRef(0);
  const lowLight = useRef(false);
  /** What the overlay draws from: the newest reading while live, the one a result came from afterwards. */
  const liveReading = useRef<Reading | null>(null);
  const shownReading = useRef<Reading | null>(null);
  const frameSize = useRef<{ w: number; h: number } | null>(null);
  const progress = useRef(0);
  const liveValue = useRef<number | null>(null);
  const unsteadyUntil = useRef(0);
  const countdownEnd = useRef(0);
  const pctRef = useRef(0);
  const countRef = useRef(0);
  const resultRef = useRef<PdResult | null>(null);
  const liveToken = useRef(0);

  const setHint = (h: LiveHint) => {
    if (hintRef.current === h) return;
    hintRef.current = h;
    setHintState(h);
  };

  /* ---------------------------------------------------------------- overlay drawing */
  const drawHud = () => {
    const canvas = hudRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const now = phaseRef.current;
    const live = now === 'measuring' || now === 'cardLive';
    if (!live && now !== 'result') return;
    const r = live ? liveReading.current : shownReading.current;
    const size = frameSize.current;
    if (!r || !size) {
      if (!live) return;
      // nothing found yet: where the face should go
      ctx.setLineDash([7, 9]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.ellipse(W / 2, H * 0.47, Math.min(W * 0.3, H * 0.22), Math.min(H * 0.3, W * 0.42), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }
    // Frame pixels → stage pixels. The view is mirrored like a mirror, so x is flipped.
    const rect = coverRect(size.w, size.h, W, H);
    const k = rect.w / size.w;
    const map = (p: { x: number; y: number }) => ({ x: W - (rect.x + p.x * k), y: rect.y + p.y * k });
    const A = map(r.right);
    const B = map(r.left);
    const good = now === 'result' || hintRef.current === 'ok' || hintRef.current === 'unsteady';
    const tone = good ? GOLD : 'rgba(255,255,255,0.7)';
    const ring = Math.max(7, (r.irisPx * k) / 2) * 1.35;

    // progress around the face
    if (now === 'measuring') {
      const cx = W - (rect.x + ((r.face.x0 + r.face.x1) / 2) * k);
      const cy = rect.y + ((r.face.y0 + r.face.y1) / 2) * k;
      const rx = ((r.face.x1 - r.face.x0) * k) / 2 + 26;
      const ry = ((r.face.y1 - r.face.y0) * k) / 2 + 30;
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (progress.current > 0) {
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.strokeStyle = GOLD;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress.current);
        ctx.stroke();
        ctx.lineCap = 'butt';
      }
    }

    // where the card goes
    if (now === 'cardLive') {
      const g = expectedCard(r);
      const x = W - (rect.x + g.right * k);
      const y = rect.y + g.top * k;
      const w = (g.right - g.left) * k;
      const h = (g.bottom - g.top) * k;
      ctx.setLineDash([8, 7]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      roundRect(ctx, x, y, w, h, Math.max(4, w * 0.04));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // the caliper: a ring on each iris and a line between the pupils
    const ux = (B.x - A.x) / Math.hypot(B.x - A.x, B.y - A.y);
    const uy = (B.y - A.y) / Math.hypot(B.x - A.x, B.y - A.y);
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 6;
    ctx.strokeStyle = tone;
    ctx.fillStyle = tone;
    ctx.lineWidth = 1.75;
    for (const p of [A, B]) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, ring, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.25, 0, Math.PI * 2);
      ctx.fill();
      for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(a) * (ring + 3), p.y + Math.sin(a) * (ring + 3));
        ctx.lineTo(p.x + Math.cos(a) * (ring + 9), p.y + Math.sin(a) * (ring + 9));
        ctx.stroke();
      }
    }
    ctx.beginPath();
    ctx.moveTo(A.x + ux * ring, A.y + uy * ring);
    ctx.lineTo(B.x - ux * ring, B.y - uy * ring);
    ctx.stroke();
    ctx.shadowBlur = 0;

    const value = now === 'result' ? (resultRef.current ? `${num(resultRef.current.pd)} mm` : null) : now === 'measuring' && liveValue.current != null ? `≈ ${Math.round(liveValue.current)} mm` : null;
    if (value) {
      ctx.font = `700 ${now === 'result' ? 15 : 13}px ${getComputedStyle(stage).fontFamily}`;
      const tw = ctx.measureText(value).width;
      const bw = tw + 22;
      const bh = now === 'result' ? 30 : 26;
      const bx = clamp((A.x + B.x) / 2 - bw / 2, 6, W - bw - 6);
      const by = Math.max(6, Math.min(A.y, B.y) - ring - bh - 12);
      ctx.fillStyle = 'rgba(20,18,16,0.72)';
      ctx.beginPath();
      roundRect(ctx, bx, by, bw, bh, bh / 2);
      ctx.fill();
      ctx.fillStyle = now === 'result' ? GOLD : '#fff';
      ctx.textBaseline = 'middle';
      ctx.fillText(value, bx + 11, by + bh / 2 + 0.5);
    }
  };

  // Keep the overlay in step with the stage when it changes size (rotation, window resize).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const ro = new ResizeObserver(() => drawHud());
    ro.observe(stage);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // The result (and the language its number is written in) is drawn on the still picture.
  useEffect(() => {
    resultRef.current = result;
    drawHud();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, phase, lang]);

  /* ---------------------------------------------------------------- tracker */
  const ensureTracker = async () => {
    if (!trackerPromise.current) {
      setLoadPct(trackerAssetsLoaded() ? null : 0);
      trackerPromise.current = createFaceTracker('VIDEO', (p) => mounted.current && setLoadPct(Math.round(p * 100)), { delegate: preferCpu.current ? 'CPU' : 'auto', lite: true })
        .then((tracker) => {
          if (!mounted.current) {
            tracker.close();
            throw new Error('closed');
          }
          trackerRef.current = tracker;
          setLoadPct(null);
          return tracker;
        })
        .catch((error) => {
          trackerPromise.current = null;
          if (mounted.current) setLoadPct(null);
          throw error;
        });
    }
    return trackerPromise.current;
  };
  const disposeTracker = () => {
    const old = trackerRef.current;
    trackerRef.current = null;
    trackerPromise.current = null;
    old?.close();
  };

  /* ---------------------------------------------------------------- camera */
  function stopCamera() {
    session.current.cancel();
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
    liveReading.current = null;
    if (mounted.current) {
      setCameraActive(false);
      setVideoPaused(false);
    }
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopCamera();
      disposeTracker();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Average brightness of the face itself (a dark background is fine). */
  const tooDark = (video: HTMLVideoElement, r: Reading, now: number) => {
    if (now - lastLight.current < 600) return lowLight.current;
    lastLight.current = now;
    if (!lightCanvas.current) {
      lightCanvas.current = document.createElement('canvas');
      lightCanvas.current.width = 16;
      lightCanvas.current.height = 16;
    }
    const ctx = lightCanvas.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    const fw = r.face.x1 - r.face.x0;
    const fh = r.face.y1 - r.face.y0;
    try {
      ctx.drawImage(video, r.face.x0 + fw * 0.2, r.face.y0 + fh * 0.15, Math.max(2, fw * 0.6), Math.max(2, fh * 0.7), 0, 0, 16, 16);
      const px = ctx.getImageData(0, 0, 16, 16).data;
      let total = 0;
      for (let i = 0; i < px.length; i += 4) total += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      lowLight.current = total / (px.length / 4) < 62;
    } catch {
      lowLight.current = false;
    }
    return lowLight.current;
  };

  /** Copies the current video frame into the still canvas and returns its 2D context. */
  const snapshot = (video: HTMLVideoElement) => {
    const still = stillRef.current;
    if (!still) return null;
    still.width = video.videoWidth;
    still.height = video.videoHeight;
    const ctx = still.getContext('2d', { willReadFrequently: true });
    ctx?.drawImage(video, 0, 0, still.width, still.height);
    return ctx;
  };

  const finish = (done: PdResult, r: Reading, video: HTMLVideoElement) => {
    snapshot(video);
    shownReading.current = r;
    stopCamera();
    setCardFailed(false);
    setCopied(false);
    setResult(done);
    setPhase('result');
  };

  const captureCard = (r: Reading, video: HTMLVideoElement) => {
    const ctx = snapshot(video);
    const still = stillRef.current;
    if (!ctx || !still) return;
    const guess = expectedCard(r);
    let edges = { left: guess.left, right: guess.right, found: false };
    try {
      edges = findCardEdges(ctx.getImageData(0, 0, still.width, still.height).data, still.width, still.height, guess);
    } catch {
      /* the markers start where a card is expected */
    }
    // The still picture is now this frame: anything drawn over it has to come from this frame too.
    shownReading.current = r;
    stopCamera();
    setCardBad(false);
    setAdjust({ reading: r, guess, edges });
    setPhase('cardAdjust');
  };

  const onFrame = (res: FaceLandmarkerResult, video: HTMLVideoElement, now: number) => {
    const w = video.videoWidth;
    const h = video.videoHeight;
    const read = readFrame((res.faceLandmarks ?? []) as Point[][], res.facialTransformationMatrixes?.[0]?.data ?? null, w, h);
    const r = isReading(read) ? read : null;
    let live: LiveHint = read.hint;
    if (r && live === 'ok' && tooDark(video, r, now)) live = 'lowLight';
    liveReading.current = r;
    frameSize.current = { w, h };

    if (phaseRef.current === 'measuring') {
      if (r && live === 'ok') {
        const s = sampler.current.add(r, now);
        progress.current = s.progress;
        liveValue.current = s.live;
        if (s.unsteady) unsteadyUntil.current = now + 1600;
        if (s.done) {
          finish(s.done, r, video);
          return false;
        }
      }
      if (live === 'ok' && now < unsteadyUntil.current) live = 'unsteady';
      const p = Math.round(progress.current * 100);
      if (p !== pctRef.current) {
        pctRef.current = p;
        setPct(p);
      }
    } else if (phaseRef.current === 'cardLive') {
      const left = countdownEnd.current - now;
      const n = Math.max(0, Math.ceil(left / 1000));
      if (n !== countRef.current) {
        countRef.current = n;
        setCount(n);
      }
      if (left <= 0) {
        if (r && (live === 'ok' || live === 'blink')) {
          captureCard(r, video);
          return false;
        }
        if (left < -CARD_WAIT_MS) {
          stopCamera();
          setCardFailed(true);
          setPhase('cardGuide');
          return false;
        }
      }
    }
    setHint(live);
    drawHud();
    return true;
  };

  /** Live tracking failed: re-create the tracker on the CPU once (the camera keeps running), then give up honestly. */
  const recoverTracker = async (error: unknown) => {
    cancelAnimationFrame(rafRef.current);
    const token = liveToken.current;
    const tracker = trackerRef.current;
    const back = phaseRef.current;
    const fail = (e: unknown, prefix: string) => {
      console.error('[pd] face tracking stopped', e);
      disposeTracker();
      stopCamera();
      setErrorDetail(describeError(e, prefix));
      setTrackerFail('runtime');
      setPhase('trackerError');
    };
    if (!tracker || tracker.delegate === 'CPU' || preferCpu.current) return fail(error, `MediaPipe ${tracker?.delegate ?? ''}`.trim());
    console.warn('[pd] GPU face tracking failed — switching to the CPU', error);
    preferCpu.current = true;
    recovering.current = true;
    disposeTracker();
    setPhase('loading');
    try {
      await ensureTracker();
    } catch (e) {
      recovering.current = false;
      if (!session.current.current(token) || !mounted.current) return;
      return fail(e, 'MediaPipe CPU');
    }
    recovering.current = false;
    if (!session.current.current(token) || !mounted.current || !streamRef.current) return;
    detectErrors.current = 0;
    emptySince.current = null;
    lastVideoTime.current = -1;
    begin(back === 'cardLive' ? 'card' : 'measure');
  };

  /** CPU tracking reads a 2D-canvas copy of the frame (see the try-on studio: WebGL video uploads are unreliable there). */
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
    const live = phaseRef.current === 'measuring' || phaseRef.current === 'cardLive';
    if (!streamRef.current || !live || recovering.current) return;
    const now = performance.now();
    // iOS can pause a live <video> (interruptions, low-power); try to resume it now and then.
    if (video && video.paused && now - lastPlayTry.current > 1500) {
      lastPlayTry.current = now;
      video.play().catch(() => undefined);
    }
    const interval = lite || tracker?.delegate === 'CPU' ? 1000 / 20 : 1000 / 30;
    const fresh = !!video && (video.currentTime !== lastVideoTime.current || now - lastDetect.current > 250);
    if (video && tracker && video.readyState >= 2 && video.videoWidth > 0 && fresh && now - lastDetect.current >= interval) {
      lastVideoTime.current = video.currentTime;
      lastDetect.current = now;
      let res: FaceLandmarkerResult | null = null;
      try {
        res = tracker.detectVideo(frameFor(video, tracker), now);
        detectErrors.current = 0;
      } catch (error) {
        detectErrors.current += 1;
        if (detectErrors.current === 1) console.error('[pd] face tracking failed on a video frame', error);
        if (detectErrors.current >= MAX_DETECT_ERRORS) {
          void recoverTracker(error);
          return;
        }
      }
      if (res) {
        const found = (res.faceLandmarks?.length ?? 0) > 0;
        if (found) emptySince.current = null;
        else emptySince.current ??= now;
        if (!found && tracker.delegate === 'GPU' && !preferCpu.current && !video.paused && now - emptySince.current! > GPU_EMPTY_MS) {
          void recoverTracker(new Error(`GPU delegate returned no face for ${GPU_EMPTY_MS / 1000} s`));
          return;
        }
        if (!onFrame(res, video, now)) return;
      }
    }
    rafRef.current = requestAnimationFrame(trackLoop);
  };

  /** The camera is running and the tracker is ready: start measuring, or start the card countdown. */
  const begin = (goal: Goal) => {
    sampler.current.reset();
    progress.current = 0;
    liveValue.current = null;
    pctRef.current = 0;
    setPct(0);
    hintRef.current = 'noFace';
    setHintState('noFace');
    if (goal === 'card') {
      countdownEnd.current = performance.now() + 3000;
      countRef.current = 3;
      setCount(3);
      setPhase('cardLive');
    } else setPhase('measuring');
    rafRef.current = requestAnimationFrame(trackLoop);
  };

  const startCamera = async (goal: Goal) => {
    const support = cameraSupport();
    if (support !== 'ok') {
      setErrorDetail(supportDetail(support));
      setPhase(support);
      return;
    }
    stopCamera();
    goalRef.current = goal;
    const token = session.current.begin();
    liveToken.current = token;
    setErrorDetail(null);
    setPhase('permission');
    // Permission first: the ~15 MB tracker is only fetched once the visitor has actually allowed the camera.
    const request = (constraints: MediaTrackConstraints | boolean) => navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
    let stream: MediaStream;
    try {
      try {
        stream = await request(videoConstraints('user', lite));
      } catch (error) {
        // Some Android cameras refuse the size / frame-rate hints, or are still releasing the previous stream.
        const name = (error as DOMException)?.name;
        if (name !== 'OverconstrainedError' && name !== 'NotReadableError' && name !== 'AbortError') throw error;
        console.warn('[pd] camera refused the preferred settings — retrying with defaults', error);
        await new Promise((r) => setTimeout(r, 300));
        if (!session.current.current(token)) throw error;
        stream = await request({ facingMode: { ideal: 'user' } });
      }
    } catch (error) {
      if (!session.current.current(token) || !mounted.current) return;
      const name = (error as DOMException)?.name;
      console.error('[pd] the camera could not start', error);
      setErrorDetail(describeError(error));
      setPhase(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'nocamera' : name === 'NotReadableError' ? 'busy' : 'camError');
      return;
    }
    if (!session.current.accept(token, stream) || !mounted.current) {
      stopMediaStream(stream);
      return;
    }
    const video = videoRef.current;
    if (!video) {
      stopMediaStream(stream);
      setErrorDetail('HTMLVideoElement missing');
      setPhase('camError');
      return;
    }
    streamRef.current = stream;
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
            setPhase(resultRef.current ? 'result' : 'idle');
          }
        },
        { once: true },
      ),
    );
    detectErrors.current = 0;
    emptySince.current = null;
    if (!trackerRef.current) setPhase('loading');
    try {
      await ensureTracker();
    } catch (error) {
      if (!session.current.current(token) || !mounted.current) return;
      console.error('[pd] face tracking could not load', error);
      stopCamera();
      setErrorDetail(describeError(error));
      setTrackerFail('load');
      setPhase('trackerError');
      return;
    }
    if (!session.current.current(token) || !mounted.current) return;
    begin(goal);
  };

  const applyCard = (left: number, right: number) => {
    const still = stillRef.current;
    if (!adjust || !still) return;
    const done = fromCard(adjust.reading, left, right, Math.max(still.width, still.height));
    if (!done) {
      setCardBad(true);
      return;
    }
    shownReading.current = adjust.reading;
    frameSize.current = { w: still.width, h: still.height };
    setAdjust(null);
    setCopied(false);
    setResult(done);
    setPhase('result');
  };

  const copyResult = async () => {
    if (!result) return;
    const text = t('copyText', { pd: num(result.pd) });
    if (await copyText(text)) {
      setCopied(true);
      toast.success(t('copied'), { description: text });
    } else toast(text);
  };
  const copyLink = async () => {
    if (await copyText(window.location.href)) toast.success(t('copied'));
    else toast(window.location.href);
  };

  /* ---------------------------------------------------------------- what the stage shows */
  const live = phase === 'measuring' || phase === 'cardLive';
  const inAppNote = inApp ? <InAppNote onCopy={copyLink} /> : null;
  const prep = [
    { icon: Glasses, text: t('prep1') },
    { icon: Smartphone, text: t('prep2') },
    { icon: Eye, text: t('prep3') },
  ];

  const overlay = (() => {
    if (phase === 'idle')
      return (
        <StageCard icon={<Ruler className="h-6 w-6" />} title={t('introTitle')} text={t('introText')} note={inAppNote}>
          <ul className="mb-1 space-y-1.5 text-left lg:hidden">
            {prep.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2.5 text-[13px] font-medium leading-snug text-white/85">
                <Icon className="h-4 w-4 shrink-0 text-brand-200" /> {text}
              </li>
            ))}
          </ul>
          <button type="button" className={stageBtn(true)} onClick={() => startCamera('measure')}>
            <Camera className="h-[18px] w-[18px]" /> {t('start')}
          </button>
        </StageCard>
      );
    if (phase === 'insecure' || phase === 'unsupported')
      return (
        <StageCard
          icon={<LockKeyhole className="h-6 w-6" />}
          title={phase === 'insecure' ? t('insecureTitle') : t('unsupportedTitle')}
          text={phase === 'insecure' ? t('insecureText') : t('unsupportedText')}
          detail={errorDetail}
          note={inAppNote}
        >
          <Link to="/rezervo" className={stageBtn(true)}>
            <CalendarCheck className="h-4 w-4" /> {t('book')}
          </Link>
        </StageCard>
      );
    if (phase === 'permission') return <StageCard icon={<Camera className="h-6 w-6" />} title={t('waiting')} text={t('introText')} />;
    if (phase === 'loading' && !cameraActive)
      return (
        <StageCard icon={<Loader2 className="h-6 w-6 animate-spin" />} title={t('loading')} text={loadPct != null ? t('loadingHint') : undefined}>
          {loadPct != null && (
            <div className="mx-auto w-full max-w-[240px]">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-brand-200 transition-[width] duration-300" style={{ width: `${Math.max(4, loadPct)}%` }} />
              </div>
              <div className="mt-2 text-[12px] font-semibold tabular-nums text-white/60">{loadPct}%</div>
            </div>
          )}
        </StageCard>
      );
    if (phase === 'denied' || phase === 'nocamera' || phase === 'busy' || phase === 'camError' || phase === 'trackerError') {
      const text = { denied: t('deniedText'), nocamera: t('noCamera'), busy: t('cameraBusy'), camError: t('cameraError'), trackerError: trackerFail === 'runtime' ? t('trackerRuntime') : t('trackerError') }[phase];
      return (
        <StageCard
          icon={<CameraOff className="h-6 w-6" />}
          tone="alert"
          title={phase === 'denied' ? t('deniedTitle') : phase === 'trackerError' ? (trackerFail === 'runtime' ? t('trackerStoppedTitle') : t('trackerErrorTitle')) : t('cameraErrorTitle')}
          text={text}
          detail={errorDetail}
          note={inAppNote}
        >
          <button type="button" className={stageBtn(true)} onClick={() => startCamera(goalRef.current)}>
            <RefreshCw className="h-4 w-4" /> {t('retry')}
          </button>
          <Link to="/rezervo" className={stageBtn()}>
            <CalendarCheck className="h-4 w-4" /> {t('book')}
          </Link>
        </StageCard>
      );
    }
    if (phase === 'cardGuide')
      return (
        <div className="no-scrollbar absolute inset-0 z-10 flex overflow-y-auto p-3 sm:p-5" data-pd-guide>
          <div className="m-auto w-full max-w-[400px] motion-safe:animate-fade-up rounded-3xl bg-ink/60 p-5 text-center text-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] ring-1 ring-white/12 backdrop-blur-xl sm:p-6">
            <CardPicture />
            <h3 className="display mt-3 text-[22px] leading-[1.12] sm:text-[26px]">{t('cardTitle')}</h3>
            <p className={cn('mt-2 text-[13.5px] leading-relaxed', cardFailed ? 'text-amber-200' : 'text-white/70')} role={cardFailed ? 'alert' : undefined}>
              {cardFailed ? t('cardFail') : t('cardText')}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button type="button" className={stageBtn(true)} onClick={() => startCamera('card')}>
                <Camera className="h-[18px] w-[18px]" /> {t('cardStart')}
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full text-[13.5px] font-semibold text-white/75 transition hover:text-white"
                onClick={() => {
                  setCardFailed(false);
                  setPhase(result ? 'result' : 'idle');
                }}
              >
                {t('cardBack')}
              </button>
            </div>
            <p className="mt-1 flex items-start justify-center gap-1.5 text-[12px] leading-snug text-white/55">
              <LockKeyhole className="mt-px h-3.5 w-3.5 shrink-0" /> {t('cardPrivacy')}
            </p>
          </div>
        </div>
      );
    if (phase === 'cardAdjust' && adjust && stillRef.current)
      return (
        <CardAdjust
          still={stillRef.current}
          reading={adjust.reading}
          guess={adjust.guess}
          edges={adjust.edges}
          bad={cardBad}
          onUse={applyCard}
          onRetake={() => {
            setAdjust(null);
            startCamera('card');
          }}
        />
      );
    return null;
  })();

  const chip = (() => {
    if (phase === 'loading' && cameraActive) return { text: loadPct != null ? `${t('loading')} ${loadPct}%` : t('loading'), tone: 'busy' as const };
    if (videoPaused && live) return { text: t('tapToPlay'), tone: 'warn' as const };
    if (phase === 'measuring') return { text: t(HINT_KEY[hint]), tone: hint === 'ok' ? ('ok' as const) : ('warn' as const), extra: pct > 0 ? `${pct}%` : undefined };
    if (phase === 'cardLive') return { text: hint === 'ok' || hint === 'blink' || hint === 'noFace' ? t('cardCount') : t(HINT_KEY[hint]), tone: hint === 'ok' ? ('ok' as const) : ('warn' as const) };
    return null;
  })();

  const showStill = phase === 'result' || phase === 'cardAdjust' || (phase === 'cardGuide' && !!result);
  const showBackdrop = !cameraActive && !showStill;

  const stage = (
    <div
      ref={stageRef}
      data-pd-stage
      data-phase={phase}
      data-hint={live ? hint : undefined}
      className="relative isolate select-none overflow-hidden bg-ink shadow-[0_40px_90px_-50px_rgba(28,26,23,0.9)] -mx-1 h-[min(68svh,600px)] min-h-[420px] rounded-[24px] sm:mx-0 sm:aspect-[4/3] sm:h-auto sm:min-h-0 sm:rounded-[28px] lg:aspect-[16/10]"
      onClick={() => {
        if (videoPaused) videoRef.current?.play().catch(() => undefined);
      }}
    >
      <div className="absolute inset-0" style={{ background: STAGE_BG }} />
      {showBackdrop && <Img src="/images/hero/optical.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-[72%_35%] opacity-20 blur-[3px]" />}
      {/* Always in the DOM, so the stream is never attached to an element React is still creating. */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        disablePictureInPicture
        onPlaying={() => setVideoPaused(false)}
        onPause={() => setVideoPaused(!!streamRef.current)}
        className={cn('absolute inset-0 h-full w-full -scale-x-100 object-cover transition-opacity duration-500', cameraActive ? 'opacity-100' : 'opacity-0')}
      />
      <canvas ref={stillRef} aria-hidden className={cn('absolute inset-0 h-full w-full -scale-x-100 object-cover', showStill && !cameraActive ? 'opacity-100' : 'opacity-0', phase === 'cardGuide' && 'brightness-50')} />
      <canvas ref={hudRef} aria-hidden className={cn('pointer-events-none absolute inset-0 h-full w-full', (live && cameraActive) || phase === 'result' ? 'opacity-100' : 'opacity-0')} />

      {phase === 'cardLive' && count > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[18%] z-10 grid place-items-center" aria-hidden>
          <span key={count} className="display grid h-24 w-24 place-items-center rounded-full bg-black/45 text-[56px] leading-none text-white ring-1 ring-white/20 backdrop-blur-md motion-safe:animate-pop">{count}</span>
        </div>
      )}

      {overlay}

      {/* bottom bar: status + actions */}
      <div className="pointer-events-none absolute inset-x-2.5 bottom-2.5 z-20 flex items-end justify-between gap-2 sm:inset-x-4 sm:bottom-4">
        <div className="min-w-0">
          {chip && (
            <span role="status" aria-live="polite" className="pointer-events-auto inline-flex max-w-full items-center gap-2 rounded-full bg-black/50 py-2 pl-2.5 pr-3.5 text-[12.5px] font-semibold text-white ring-1 ring-white/10 backdrop-blur-md">
              {chip.tone === 'busy' ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <span className={cn('h-2 w-2 shrink-0 rounded-full', chip.tone === 'ok' ? 'bg-emerald-400' : 'bg-amber-300')} />}
              <span className="truncate">{chip.text}</span>
              {'extra' in chip && chip.extra && (
                <span className="tabular-nums text-white/65" aria-hidden>
                  {chip.extra}
                </span>
              )}
            </span>
          )}
        </div>
        <div className="pointer-events-auto flex shrink-0 items-center gap-2">
          {cameraActive && live && (
            <StageIconButton
              label={t('stop')}
              onClick={() => {
                stopCamera();
                setPhase(result ? 'result' : 'idle');
              }}
            >
              <CameraOff className="h-[18px] w-[18px]" />
            </StageIconButton>
          )}
        </div>
      </div>
    </div>
  );

  /* ---------------------------------------------------------------- the panel beside (below) the stage */
  const links = (
    <div className="grid gap-2.5">
      <ButtonLink to="/rezervo" size="lg" className="w-full" icon={<CalendarCheck className="h-4 w-4" />}>
        {t('book')}
      </ButtonLink>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5 min-[420px]:grid-cols-2 lg:grid-cols-[minmax(0,1fr)] xl:grid-cols-2">
        <ButtonLink to="/produktet/lente-me-recete" variant="outline" className="min-w-0 px-3" icon={<Layers className="h-4 w-4 shrink-0" />}>
          <span className="truncate">{t('lenses')}</span>
        </ButtonLink>
        <ButtonLink to="/provo-virtualisht" variant="outline" className="min-w-0 px-3" icon={<ScanFace className="h-4 w-4 shrink-0" />}>
          <span className="truncate">{t('tryOn')}</span>
        </ButtonLink>
      </div>
    </div>
  );

  const panel = result ? (
    <div className="space-y-4">
      <section aria-live="polite" data-pd-result className="rounded-[28px] bg-ink p-6 text-paper shadow-[0_30px_70px_-40px_rgba(28,26,23,0.9)] sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-200">{t('resultEyebrow')}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-paper/85">
            {result.method === 'card' ? <CreditCard className="h-3.5 w-3.5" /> : <ScanFace className="h-3.5 w-3.5" />}
            {t('noteBadge')}
          </span>
        </div>
        <p className="mt-3 flex items-baseline gap-2">
          <span className="display text-[76px] leading-[0.9] tracking-tight text-white sm:text-[88px]" data-pd-value>
            {num(result.pd)}
          </span>
          <span className="text-[20px] font-semibold text-paper/70">mm</span>
        </p>
        <p className="mt-2 text-[13.5px] leading-snug text-paper/70">{result.method === 'card' ? t('resultCard') : t('resultIris')}</p>


        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => startCamera('measure')} className="inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-full bg-white px-3 text-[13.5px] font-semibold text-ink transition hover:bg-sand active:scale-[0.98]">
            <RefreshCw className="h-4 w-4 shrink-0" /> <span className="truncate">{t('again')}</span>
          </button>
          <button type="button" onClick={copyResult} className="inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-full border border-white/25 px-3 text-[13.5px] font-semibold text-white transition hover:bg-white/10 active:scale-[0.98]">
            {copied ? <Check className="h-4 w-4 shrink-0" /> : <Copy className="h-4 w-4 shrink-0" />} <span className="truncate">{copied ? t('copied') : t('copy')}</span>
          </button>
        </div>
        {result.method === 'iris' && (
          <button
            type="button"
            onClick={() => {
              setCardFailed(false);
              setPhase('cardGuide');
              stageRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }}
            className="group mt-2.5 flex w-full items-center gap-3 rounded-2xl bg-white/[0.07] p-3.5 text-left ring-1 ring-white/10 transition hover:bg-white/[0.12]"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-brand-200">
              <CreditCard className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold leading-tight text-white">{t('refine')}</span>
              <span className="mt-0.5 block text-[12px] leading-snug text-paper/60">{t('refineSub')}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-paper/60 transition group-hover:translate-x-0.5" />
          </button>
        )}
      </section>

      <div className="rounded-[28px] bg-white p-5 ring-1 ring-line sm:p-6">
        <p className="flex gap-2.5 text-[13.5px] leading-relaxed text-ink-soft">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <span>
            {t('honest')} {t('monoNote')}
          </span>
        </p>
        <div className="mt-4">{links}</div>
      </div>
    </div>
  ) : (
    <div className="rounded-[28px] bg-white p-5 ring-1 ring-line sm:p-7">
      <div className="eyebrow hidden lg:block">{t('stepsEyebrow')}</div>
      <ol className="mt-4 hidden space-y-3.5 lg:block">
        {prep.map(({ icon: Icon, text }, i) => (
          <li key={text} className="flex items-center gap-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-paper text-brand-600 ring-1 ring-line">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 text-[14.5px] font-semibold leading-snug text-ink">
              <span className="mr-1.5 tabular-nums text-brand-600/60">{i + 1}.</span>
              {text}
            </span>
          </li>
        ))}
      </ol>
      <div className="flex gap-3 rounded-2xl bg-paper p-4 text-[12.5px] leading-relaxed text-ink-soft lg:mt-5">
        <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <span>{t('privacy')}</span>
      </div>
      <p className="mt-4 text-[13.5px] leading-relaxed text-muted">{t('honest')}</p>
      <div className="mt-4 border-t border-line pt-4">{links}</div>
      <Link to="/faqe/receta-dhe-pd" className="mt-3 inline-flex min-h-8 items-center gap-1.5 text-[13.5px] font-semibold text-brand-700 hover:underline">
        {t('whatIsPd')} <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-5 lg:grid-cols-[minmax(0,1fr)_372px] xl:grid-cols-[minmax(0,1fr)_392px]">
      <div className="min-w-0">{stage}</div>
      <aside className="min-w-0 self-start lg:sticky lg:top-24">{panel}</aside>
      {/* phones and tablets: how it works and the honest note, folded */}
      <div className="rounded-3xl bg-white px-4 ring-1 ring-line lg:hidden">
        <Disclosure icon={<ScanFace className="h-4 w-4" />} title={t('howOpen')} sub={t('stepsTitle').replace(/\*/g, '')}>
          <ol className="space-y-3">
            {(
              [
                ['step1Title', 'step1'],
                ['step2Title', 'step2'],
                ['step3Title', 'step3'],
              ] as const
            ).map(([title, text], i) => (
              <li key={title} className="flex gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-600 text-[12px] font-bold text-white">{i + 1}</span>
                <span className="min-w-0 text-[13.5px] leading-relaxed text-muted">
                  <strong className="block font-semibold text-ink">{t(title)}</strong>
                  {t(text)}
                </span>
              </li>
            ))}
          </ol>
        </Disclosure>
        <Disclosure icon={<Ruler className="h-4 w-4" />} title={t('noteBadge')} sub={t('noteOpen')}>
          <div className="space-y-2.5 text-[13.5px] leading-relaxed text-muted">
            <p>{t('noteText')}</p>
            <p className="flex gap-2 text-ink-soft">
              <LockKeyhole className="mt-1 h-3.5 w-3.5 shrink-0 text-brand-600" />
              <span>{t('notePrivacy')}</span>
            </p>
          </div>
        </Disclosure>
      </div>
    </div>
  );
}

/** A face with a card held flat above the eyebrows: where the card goes, drawn. */
function CardPicture() {
  return (
    <svg viewBox="0 0 200 120" className="mx-auto h-[84px] w-auto text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M60 38c0-22 18-34 40-34s40 12 40 34v30c0 26-18 46-40 46S60 94 60 68z" opacity="0.5" />
      <rect x="58" y="14" width="84" height="40" rx="5" fill="rgba(227,207,159,0.18)" stroke={GOLD} />
      <path d="M68 24h22M68 32h14" stroke={GOLD} opacity="0.7" />
      <path d="M74 62c5-3 13-3 18 0M108 62c5-3 13-3 18 0" opacity="0.6" />
      <circle cx="83" cy="72" r="4.5" />
      <circle cx="117" cy="72" r="4.5" />
      <path d="M83 84h34" stroke={GOLD} strokeDasharray="3 4" />
      <path d="M92 100c5 3 11 3 16 0" opacity="0.5" />
    </svg>
  );
}
