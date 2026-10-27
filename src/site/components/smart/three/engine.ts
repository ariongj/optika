// Live engine: owns the canvas, render loop (on demand), visibility / tab pausing, pointer + touch rotation with
// inertia, eased explode / highlight transitions and throttled part projection. Loaded lazily by SmartGlasses3D.
import { createStage, DEFAULT_FRAMING, type Stage, type StagePose } from './stage';
import { SMART_PARTS, type SmartBackground, type SmartColorway, type SmartFraming, type SmartPart, type SmartPartPoints, type SmartShape, type SmartVariant } from './types';

export interface EngineProps {
  variant: SmartVariant;
  colorway: SmartColorway;
  shape?: SmartShape;
  exploded: number;
  spread: number;
  zoom: number;
  rotation: { yaw: number; pitch: number } | null;
  autoRotate: boolean;
  interactive: boolean;
  activePart: SmartPart | null;
  showDisplayHud: boolean;
  background: SmartBackground;
  framing?: SmartFraming;
  wantParts: boolean;
  /** variants to get ready in idle time (see Stage.prepare) */
  prepare: SmartVariant[];
}

export interface EngineCallbacks {
  onFirstFrame?: () => void;
  onParts?: (pts: SmartPartPoints) => void;
  onLost?: () => void;
}

export interface SmartEngine {
  set(props: EngineProps): void;
  dispose(): void;
}

const damp = (cur: number, target: number, speed: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-speed * dt));
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/* ------------------------------------------------------------------ */
/* One spare renderer                                                  */
/* ------------------------------------------------------------------ */
// The page shows the 3D in several places one after another (hero → scroll story → comparison). A new renderer costs
// a WebGL context, the studio environment and every shader — a few hundred ms on a phone, felt as a jolt mid-scroll —
// so a stage leaving the screen keeps its canvas and renderer here for the next one instead of destroying them. At most
// one, freed after a minute unused.
interface Spare {
  canvas: HTMLCanvasElement;
  stage: Stage;
  key: string;
  timer: number;
}
let spare: Spare | null = null;
const SPARE_MS = 60_000;

function takeSpare(key: string): Spare | null {
  const s = spare;
  if (!s || s.key !== key) return null;
  spare = null;
  window.clearTimeout(s.timer);
  if (s.stage.renderer.getContext().isContextLost()) {
    s.stage.dispose();
    return null;
  }
  return s;
}

function keepSpare(canvas: HTMLCanvasElement, stage: Stage, key: string) {
  if (spare) spare.stage.dispose();
  canvas.remove();
  const s: Spare = { canvas, stage, key, timer: 0 };
  s.timer = window.setTimeout(() => {
    if (spare !== s) return;
    spare = null;
    s.stage.dispose();
  }, SPARE_MS);
  spare = s;
}

export function createSmartEngine(host: HTMLElement, initial: EngineProps, cb: EngineCallbacks): SmartEngine {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.screen.width, window.screen.height) < 820;
  const dprCap = coarse && small ? 1.5 : 2;
  // phones: lighter geometry (rings / sides / triangles × 0.65) — the model builds much faster, no visible difference
  const stageOpts = { antialias: true, shadowRes: coarse ? 256 : 512, detail: coarse && small ? 0.65 : 1 };
  const spareKey = JSON.stringify(stageOpts);
  const reused = takeSpare(spareKey);

  const canvas = reused?.canvas ?? document.createElement('canvas');
  if (!reused) {
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block', outline: 'none', userSelect: 'none', webkitUserSelect: 'none' });
  }
  host.prepend(canvas);
  const stage = reused?.stage ?? createStage(canvas, stageOpts);

  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = reducedQuery.matches;

  let props = initial;
  let disposed = false;
  let visible = true;
  let tabVisible = document.visibilityState !== 'hidden';
  let raf = 0;
  let last = 0;
  let clock = 0;
  let firstFrame = false;
  let lastPartsAt = -1;
  let partsDirty = true;

  // animated state
  let exploded = initial.exploded;
  let spread = initial.spread;
  let zoom = initial.zoom;
  const highlight: Record<SmartPart, number> = { camera: 0, led: 0, speaker: 0, mics: 0, touch: 0, battery: 0, display: 0, hinge: 0 };
  let hud = initial.showDisplayHud ? 1 : 0;
  let baseYaw = initial.rotation ? initial.rotation.yaw : DEFAULT_FRAMING.restYaw;
  let basePitch = initial.rotation ? initial.rotation.pitch : DEFAULT_FRAMING.restPitch;
  let userYaw = 0;
  let userPitch = 0;
  let velYaw = 0;
  let velPitch = 0;
  let lastInteract = -10;
  let idleT = 0;

  const lookKey = (p: EngineProps) => `${p.variant}|${p.colorway}|${p.shape ?? ''}|${p.background}`;
  const framingKey = (f?: SmartFraming) => JSON.stringify(f ?? {});
  let currentLook = '';
  let currentFraming = '';
  /** shader compiles in flight: no frame is drawn meanwhile (drawing would compile them synchronously) */
  let compiling = 0;
  const precompile = () => {
    compiling++;
    void stage.compile().then(() => {
      compiling--;
      if (disposed) return;
      partsDirty = true;
      invalidate();
    });
  };

  const applyLook = () => {
    const k = lookKey(props);
    if (k !== currentLook) {
      currentLook = k;
      stage.setLook({ variant: props.variant, colorway: props.colorway, shape: props.shape, background: props.background });
      precompile();
    }
    const fk = framingKey(props.framing);
    if (fk !== currentFraming) {
      currentFraming = fk;
      stage.setFraming({ ...DEFAULT_FRAMING, ...props.framing });
    }
  };

  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    stage.setSize(w, h, Math.min(window.devicePixelRatio || 1, dprCap));
    partsDirty = true;
    invalidate();
  };

  /** advances animation; returns true while anything still moves */
  const step = (dt: number) => {
    let moving = false;
    const idle = !reduced && props.autoRotate && props.rotation === null;

    // explode
    const te = clamp(props.exploded, 0, 1);
    exploded = Math.abs(te - exploded) < 1e-4 ? te : damp(exploded, te, reduced ? 30 : 7, dt);
    if (exploded !== te) moving = true;

    // explode distance and camera fly-in ease too (scroll moves them in steps)
    const ts = Math.max(0, props.spread);
    spread = Math.abs(ts - spread) < 1e-3 ? ts : damp(spread, ts, reduced ? 30 : 4, dt);
    const tz = clamp(props.zoom, 0, 1);
    zoom = Math.abs(tz - zoom) < 1e-3 ? tz : damp(zoom, tz, reduced ? 30 : 3.2, dt);
    if (spread !== ts || zoom !== tz) moving = true;

    // highlights
    for (const p of SMART_PARTS) {
      const t = props.activePart === p ? 1 : 0;
      const v = Math.abs(t - highlight[p]) < 0.002 ? t : damp(highlight[p], t, 7, dt);
      if (v !== t) moving = true;
      highlight[p] = v;
    }
    const th = props.showDisplayHud ? 1 : 0;
    hud = Math.abs(th - hud) < 0.002 ? th : damp(hud, th, 5, dt);
    if (hud !== th) moving = true;

    // rotation
    const dragging = drag?.active ?? false;
    if (!dragging) {
      if (Math.abs(velYaw) > 0.005 || Math.abs(velPitch) > 0.005) {
        userYaw += velYaw * dt;
        userPitch = clamp(userPitch + velPitch * dt, -0.55, 0.55);
        const k = Math.exp(-3.8 * dt);
        velYaw *= k;
        velPitch *= k;
        moving = true;
      } else {
        velYaw = 0;
        velPitch = 0;
      }
    } else moving = true;

    let ty: number;
    let tp: number;
    /** the slow idle sway (a few hundredths of a degree per frame): an ambient loop too — see below */
    let sway = false;
    if (props.rotation) {
      ty = props.rotation.yaw;
      tp = props.rotation.pitch;
      if (!dragging && clock - lastInteract > 1.6 && (Math.abs(userYaw) > 1e-3 || Math.abs(userPitch) > 1e-3)) {
        userYaw = damp(userYaw, 0, 2.4, dt);
        userPitch = damp(userPitch, 0, 2.4, dt);
        moving = true;
      }
    } else if (idle) {
      if (!dragging && clock - lastInteract > 2.2) idleT += dt;
      ty = DEFAULT_FRAMING.restYaw + 0.5 * Math.sin(idleT * 0.38);
      tp = DEFAULT_FRAMING.restPitch + 0.045 * Math.sin(idleT * 0.53 + 1.2);
      sway = true;
    } else {
      ty = DEFAULT_FRAMING.restYaw;
      tp = DEFAULT_FRAMING.restPitch;
    }
    const ny = Math.abs(ty - baseYaw) < 1e-4 ? ty : damp(baseYaw, ty, reduced ? 30 : 4.5, dt);
    const np = Math.abs(tp - basePitch) < 1e-4 ? tp : damp(basePitch, tp, reduced ? 30 : 4.5, dt);
    if ((ny !== ty || np !== tp) && !sway) moving = true;
    baseYaw = ny;
    basePitch = np;

    // capture LED: active highlight, or a soft breathing pulse every ~5 s while idling
    let led = 0;
    if (idle && props.activePart === null && props.variant !== 'audio') {
      const ph = (clock % 5.2) / 5.2;
      led = ph < 0.22 ? Math.sin((ph / 0.22) * Math.PI) * 0.75 : 0;
    }
    // Ambient loops — the idle sway, and the pulsing glows / sound rings / swipe on an active part — are drawn at ~30 fps
    // once nothing else moves (no drag, inertia, scroll-driven change or transition): half the CPU and GPU work while
    // the visitor just looks, and no visible difference at these speeds.
    const ambient = !moving && !reduced && (sway || !!props.activePart);
    if (ambient) moving = true;

    const pose: StagePose = {
      yaw: baseYaw + userYaw,
      pitch: clamp(basePitch + userPitch, -0.7, 0.7),
      lift: idle ? 0.012 * Math.sin(clock * 0.9) : 0,
      exploded,
      spread,
      focus: { part: props.activePart, amount: zoom },
      highlight,
      hud,
      led,
      time: clock,
      reduced,
    };
    return { moving, ambient, pose };
  };

  /** only the ambient loop is running (see step): every other frame is skipped */
  let ambientOnly = false;
  const frame = (now: number) => {
    raf = 0;
    if (disposed || !running() || compiling) return;
    if (ambientOnly && last && now - last < 31) {
      raf = requestAnimationFrame(frame);
      return;
    }
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    clock += dt;
    const { moving, ambient, pose } = step(dt);
    ambientOnly = ambient;
    stage.apply(pose);
    stage.render();
    if (!firstFrame) {
      firstFrame = true;
      cb.onFirstFrame?.();
      prepareNext();
    }
    if (props.wantParts && cb.onParts && (partsDirty || moving)) {
      if (!moving || now - lastPartsAt > 33) {
        lastPartsAt = now;
        partsDirty = false;
        cb.onParts(stage.project(pose));
      }
    }
    if (moving) raf = requestAnimationFrame(frame);
    else last = 0;
  };

  /* ------------------------------------------------------------ prepared variants */
  // One build step (a part of the model) per idle period — more while the period lasts — so getting the next variant
  // ready never blocks scrolling for long; at most 0.4 s apart, so it keeps going while the reader scrolls.
  let prepareHandle = 0;
  let preparing: { step(): boolean } | null = null;
  const idle = (fn: (d?: IdleDeadline) => void) =>
    'requestIdleCallback' in window ? window.requestIdleCallback(fn, { timeout: 400 }) : (setTimeout(fn, 100) as unknown as number);
  const cancelIdle = (h: number) => ('cancelIdleCallback' in window ? window.cancelIdleCallback(h) : clearTimeout(h));
  const prepareNext = () => {
    if (disposed || prepareHandle) return;
    if (!preparing) {
      for (const v of props.prepare) {
        if (v === props.variant) continue;
        preparing = stage.prepare(v);
        if (preparing) break;
      }
      if (!preparing) return;
    }
    prepareHandle = idle((deadline) => {
      prepareHandle = 0;
      if (disposed || !preparing) return;
      let done = preparing.step();
      while (!done && deadline && deadline.timeRemaining() > 10) done = preparing.step();
      if (done) preparing = null;
      prepareNext();
    });
  };

  const running = () => visible && tabVisible && !disposed;
  function invalidate() {
    ambientOnly = false; // something changed (scroll, props, size): draw it on the next frame
    if (raf || !running() || compiling) return;
    raf = requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------------- input */
  let drag: { id: number; x0: number; y0: number; x: number; y: number; t: number; active: boolean; mouse: boolean } | null = null;
  const onDown = (e: PointerEvent) => {
    if (!props.interactive) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const mouse = e.pointerType === 'mouse';
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t: e.timeStamp, active: mouse, mouse };
    if (mouse) {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      canvas.style.cursor = 'grabbing';
    }
    velYaw = 0;
    velPitch = 0;
    lastInteract = clock;
  };
  const onMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.active) {
      const tx = e.clientX - drag.x0;
      const ty = e.clientY - drag.y0;
      if (Math.abs(ty) > 8 && Math.abs(ty) >= Math.abs(tx)) {
        drag = null; // vertical intent: leave it to the page scroll
        return;
      }
      if (Math.abs(tx) < 7) return;
      drag.active = true;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    const dts = Math.max(0.008, (e.timeStamp - drag.t) / 1000);
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.t = e.timeStamp;
    const k = (Math.PI * 1.15) / Math.max(360, canvas.clientWidth);
    userYaw += dx * k;
    if (drag.mouse) userPitch = clamp(userPitch + dy * k * 0.55, -0.55, 0.55);
    velYaw = damp(velYaw, (dx * k) / dts, 0.6, 1);
    velPitch = drag.mouse ? damp(velPitch, (dy * k * 0.55) / dts, 0.6, 1) : 0;
    lastInteract = clock;
    if (e.cancelable && !drag.mouse) e.preventDefault();
    invalidate();
  };
  const onUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (e.timeStamp - drag.t > 90) {
      velYaw = 0;
      velPitch = 0;
    }
    drag = null;
    canvas.style.cursor = props.interactive ? 'grab' : '';
    lastInteract = clock;
    invalidate();
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  const syncInteractive = () => {
    canvas.style.touchAction = props.interactive ? 'pan-y' : 'auto';
    canvas.style.cursor = props.interactive ? 'grab' : '';
    host.style.touchAction = props.interactive ? 'pan-y' : '';
  };

  /* ---------------------------------------------------------------- lifecycle */
  const io = new IntersectionObserver(
    (entries) => {
      visible = entries.some((en) => en.isIntersecting);
      if (visible) {
        last = 0;
        invalidate();
      }
    },
    { rootMargin: '80px' },
  );
  io.observe(host);
  const ro = new ResizeObserver(() => resize());
  ro.observe(host);
  const onVis = () => {
    tabVisible = document.visibilityState !== 'hidden';
    if (tabVisible) {
      last = 0;
      invalidate();
    }
  };
  document.addEventListener('visibilitychange', onVis);
  const onReduced = () => {
    reduced = reducedQuery.matches;
    invalidate();
  };
  reducedQuery.addEventListener('change', onReduced);
  let lost = false;
  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    cb.onLost?.();
  };
  canvas.addEventListener('webglcontextlost', onLost);

  applyLook();
  syncInteractive();
  resize();
  invalidate();

  return {
    set(next) {
      if (disposed) return;
      props = next;
      applyLook();
      syncInteractive();
      partsDirty = true;
      invalidate();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (prepareHandle) cancelIdle(prepareHandle);
      prepareHandle = 0;
      preparing = null;
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      reducedQuery.removeEventListener('change', onReduced);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('webglcontextlost', onLost);
      if (lost) {
        stage.dispose(); // frees GPU resources and the context once any shader compile has settled
        canvas.remove();
      } else keepSpare(canvas, stage, spareKey); // the next stage on the page takes over this renderer
    },
  };
}
