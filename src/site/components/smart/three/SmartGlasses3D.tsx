// Real-time 3D smart glasses (three.js). This module itself is light: the three.js engine is loaded with a dynamic
// import on mount, so even a static import of the helpers below never pulls three.js into the main bundle.
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { EngineProps, SmartEngine } from './engine';
import type { SmartGlasses3DProps } from './types';

export type {
  SmartBackground,
  SmartColorway,
  SmartFraming,
  SmartGlasses3DProps,
  SmartPart,
  SmartPartPoint,
  SmartPartPoints,
  SmartShape,
  SmartVariant,
} from './types';
export { SMART_PARTS, partsForVariant } from './types';

let webgl: boolean | null = null;
/** True when the browser can create a WebGL context (cached; the probe context is released at once). */
export function isWebGLAvailable() {
  if (webgl !== null) return webgl;
  if (typeof document === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    webgl = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webgl = false;
  }
  return webgl;
}

/** the host must be positioned (the canvas and poster are absolutely placed); keep a caller's own position class */
const POSITIONED = /(^|\s)(absolute|fixed|sticky|relative)(\s|$)/;

function toEngine(p: SmartGlasses3DProps): EngineProps {
  return {
    variant: p.variant ?? 'camera',
    colorway: p.colorway ?? 'black',
    shape: p.shape,
    exploded: p.exploded ?? 0,
    spread: p.spread ?? 1,
    zoom: p.zoom ?? 0,
    rotation: p.rotation ?? null,
    autoRotate: p.autoRotate ?? false,
    interactive: p.interactive ?? false,
    activePart: p.activePart ?? null,
    showDisplayHud: p.showDisplayHud ?? false,
    background: p.background ?? 'transparent',
    framing: p.framing,
    wantParts: !!p.onParts,
  };
}

export default function SmartGlasses3D(props: SmartGlasses3DProps) {
  const { poster, className, label, interactive } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SmartEngine | null>(null);
  const propsRef = useRef(props);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    propsRef.current = props;
    engineRef.current?.set(toEngine(props));
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let engine: SmartEngine | null = null;
    // Download the engine now, but build the scene once the page is idle: the poster is on screen meanwhile, and
    // the page's own first render and images don't compete with geometry, environment and shader work. No separate
    // WebGL probe (it costs a context of its own) — if the renderer can't start, the poster simply stays.
    const loaded = import('./engine');
    const idle = (cb: () => void) =>
      'requestIdleCallback' in window ? window.requestIdleCallback(cb, { timeout: 2500 }) : (setTimeout(cb, 300) as unknown as number);
    const cancelIdle = (h: number) => ('cancelIdleCallback' in window ? window.cancelIdleCallback(h) : clearTimeout(h));
    let idleHandle = 0;
    loaded
      .then(({ createSmartEngine }) => new Promise<typeof createSmartEngine>((resolve) => (idleHandle = idle(() => resolve(createSmartEngine)))))
      .then((createSmartEngine) => {
        if (cancelled) return;
        engine = createSmartEngine(host, toEngine(propsRef.current), {
          onFirstFrame: () => {
            if (cancelled) return;
            setReady(true);
            propsRef.current.onReady?.();
          },
          onParts: (pts) => {
            if (!cancelled) propsRef.current.onParts?.(pts);
          },
          onLost: () => {
            if (!cancelled) setFailed(true);
          },
        });
        engineRef.current = engine;
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (idleHandle) cancelIdle(idleHandle);
      engine?.dispose();
      engineRef.current = null;
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className={cn(!POSITIONED.test(className ?? '') && 'relative', 'overflow-hidden', className)}
      style={{ touchAction: interactive ? 'pan-y' : undefined }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {poster && (
        <img
          src={poster}
          alt=""
          draggable={false}
          decoding="async"
          className={cn(
            'pointer-events-none absolute inset-0 z-[1] h-full w-full object-cover transition-opacity duration-700 select-none',
            ready && !failed ? 'opacity-0' : 'opacity-100',
          )}
        />
      )}
    </div>
  );
}
