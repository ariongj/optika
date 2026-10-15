import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import type { SmartPart } from './three/SmartGlasses3D';
import { cn } from '@/lib/utils';

export type PartPoints = Partial<Record<SmartPart, { x: number; y: number; visible: boolean }>>;
export type Corner = 'tl' | 'tr' | 'bl' | 'br';
export interface Callout {
  part: SmartPart;
  label: string;
  corner: Corner;
  /** Small index shown before the label (default: its position, 01…) */
  tag?: string;
}
export interface HudHandle {
  update: (pts: PartPoints) => void;
}

/** Where each corner's label sits (fractions of the stage box). */
const ANCHOR: Record<Corner, { x: number; y: number }> = {
  tl: { x: 0.24, y: 0.22 },
  tr: { x: 0.76, y: 0.19 },
  bl: { x: 0.22, y: 0.74 },
  br: { x: 0.78, y: 0.7 },
};
const left = (c: Corner) => c === 'tl' || c === 'bl';

/**
 * HUD callouts that follow the 3D model: a glowing dot on each part, a hairline to a mono label in a corner.
 * Positions arrive ~30×/s from the 3D component (`onParts`) and are written straight to the DOM — no React renders.
 * Below `xl` only the dots are drawn (the page shows compact chips instead of labels).
 */
export const Hud = forwardRef<HudHandle, { callouts: Callout[]; className?: string }>(function Hud({ callouts, className }, ref) {
  const dots = useRef<(HTMLSpanElement | null)[]>([]);
  const lines = useRef<(SVGPolylineElement | null)[]>([]);
  const labels = useRef<(HTMLSpanElement | null)[]>([]);
  const list = useRef(callouts);
  list.current = callouts;
  const last = useRef<PartPoints>({});

  const apply = (pts: PartPoints) => {
    list.current.forEach((c, i) => {
      const p = pts[c.part];
      const dot = dots.current[i];
      const line = lines.current[i];
      const label = labels.current[i];
      if (!dot || !line || !label) return;
      if (!p) {
        dot.style.opacity = line.style.opacity = label.style.opacity = '0';
        return;
      }
      const a = ANCHOR[c.corner];
      const elbow = a.x + (left(c.corner) ? 0.05 : -0.05);
      dot.style.left = `${p.x * 100}%`;
      dot.style.top = `${p.y * 100}%`;
      line.setAttribute('points', `${p.x * 1000},${p.y * 1000} ${elbow * 1000},${a.y * 1000} ${a.x * 1000},${a.y * 1000}`);
      const o = p.visible ? '1' : '0.28';
      dot.style.opacity = o;
      line.style.opacity = p.visible ? '0.7' : '0.18';
      label.style.opacity = p.visible ? '1' : '0.5';
    });
  };

  // a new set of callouts (variant switch) picks up the last known positions right away
  useLayoutEffect(() => apply(last.current));

  useImperativeHandle(ref, () => ({
    update: (pts) => {
      last.current = pts;
      apply(pts);
    },
  }));

  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0', className)}>
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" className="absolute inset-0 hidden h-full w-full overflow-visible xl:block">
        {callouts.map((c, i) => (
          <polyline
            key={`${c.part}-${c.corner}`}
            ref={(el) => {
              lines.current[i] = el;
            }}
            fill="none"
            stroke="#6fd3a5"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            style={{ opacity: 0, transition: 'opacity .35s ease' }}
          />
        ))}
      </svg>
      {callouts.map((c, i) => {
        const a = ANCHOR[c.corner];
        return (
          <span
            key={`l-${c.part}-${c.corner}`}
            ref={(el) => {
              labels.current[i] = el;
            }}
            className={cn(
              'sg-mono absolute hidden -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-md bg-[#07090a]/55 px-2.5 py-1.5 text-[11px] text-white/85 ring-1 ring-white/12 backdrop-blur-md xl:inline-flex',
              left(c.corner) ? '-translate-x-full' : '',
            )}
            style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, opacity: 0, transition: 'opacity .35s ease' }}
          >
            <span className="text-[#6fd3a5]">{c.tag ?? String(i + 1).padStart(2, '0')}</span>
            {c.label}
          </span>
        );
      })}
      {callouts.map((c, i) => (
        <span
          key={`d-${c.part}-${c.corner}`}
          ref={(el) => {
            dots.current[i] = el;
          }}
          className="sg-dot absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#b5f0d3]"
          style={{ opacity: 0, transition: 'opacity .35s ease' }}
        />
      ))}
    </div>
  );
});
