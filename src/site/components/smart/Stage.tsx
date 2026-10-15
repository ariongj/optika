import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { lazyRetry } from '@/site/pages/lazy';
import { cn } from '@/lib/utils';
import type { SmartGlasses3DProps } from './three/SmartGlasses3D';
import { canWebGL, lightMode } from './data';
import { useInView } from './ui';

/** three.js stays out of the page chunk: the model loads on demand (and is prefetched once the page is idle). */
const SmartGlasses3D = lazyRetry(() => import('./three/SmartGlasses3D'));
export const preload3D = () => import('./three/SmartGlasses3D').catch(() => undefined);

interface StageProps extends Omit<SmartGlasses3DProps, 'poster' | 'className' | 'background'> {
  /** Desktop poster (and phone poster below 1024 px) — shown until WebGL draws, or instead of it. */
  poster: string;
  posterMobile?: string;
  /** object-position etc. for the poster */
  posterClassName?: string;
  className?: string;
  /** The canvas only exists while the stage is within this margin of the viewport (one WebGL context per region). */
  margin?: string;
  /** Overlays (HUD lines, chips…) drawn over the canvas box. */
  children?: ReactNode;
}

/**
 * The real-time 3D smart glasses (agent smart3d's component) with a poster as the Suspense fallback. The canvas is
 * mounted only near the viewport and skipped entirely without WebGL or on Save-Data/2G; the poster fades out once
 * the first frame is drawn.
 */
export function Stage({ poster, posterMobile, posterClassName, className, margin = '40% 0px', children, onReady, ...props }: StageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { once: false, margin, threshold: 0 });
  const [enabled] = useState(() => typeof window !== 'undefined' && canWebGL() && !lightMode());
  const [ready, setReady] = useState(false);
  const live = enabled && near;

  // a remounted canvas has to draw again before the poster may go
  useEffect(() => {
    if (!live) setReady(false);
  }, [live]);

  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  const handleReady = useCallback(() => {
    setReady(true);
    readyRef.current?.();
  }, []);

  const posterEl = (
    <picture>
      {posterMobile && <source media="(max-width: 1023px)" srcSet={posterMobile} />}
      <img
        src={poster}
        alt=""
        draggable={false}
        decoding="async"
        className={cn(
          // the render has its own backdrop: feather its edges into the page
          'pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-700 select-none [mask-image:radial-gradient(ellipse_70%_65%_at_50%_50%,#000_45%,transparent_100%)]',
          ready ? 'opacity-0' : 'opacity-100',
          posterClassName,
        )}
      />
    </picture>
  );

  return (
    <div ref={ref} className={cn('relative', className)}>
      {posterEl}
      {live && (
        <Suspense fallback={null}>
          <SmartGlasses3D {...props} background="transparent" onReady={handleReady} className={cn('absolute inset-0 h-full w-full transition-opacity duration-700', ready ? 'opacity-100' : 'opacity-0')} />
        </Suspense>
      )}
      {children}
    </div>
  );
}
