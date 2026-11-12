import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Check, ChevronLeft, ChevronRight, CircleAlert, RefreshCw } from 'lucide-react';
import { useDict, useLang } from '@/i18n';
import { cn } from '@/lib/utils';
import { clamp } from '@/site/tryon/pose';
import { stageBtn } from '@/site/tryon/parts';
import { PD } from './dict';
import type { Reading } from './measure';

export interface CardGuess {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface Props {
  /** The captured frame, as the camera gave it (not mirrored). */
  still: HTMLCanvasElement;
  reading: Reading;
  /** Where a card is expected in the frame, and where its edges were found (frame pixels). */
  guess: CardGuess;
  edges: { left: number; right: number; found: boolean };
  /** The last pair of lines could not be a card: say so. */
  bad: boolean;
  onUse: (left: number, right: number) => void;
  onRetake: () => void;
}

/**
 * The still picture, zoomed to the forehead, with two lines the visitor puts on the card's short edges. The view is
 * mirrored like the live camera, so the visitor's own left stays on the left. Positions are kept as fractions of the
 * view's width and turned back into frame pixels when the measurement is used.
 */
export function CardAdjust({ still, reading, guess, edges, bad, onUse, onRetake }: Props) {
  const t = useDict(PD);
  const lang = useLang();
  const boxRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  // The part of the frame on show: the card with room either side, from above it down to just below the eyes.
  const [crop] = useState(() => {
    const card = guess.right - guess.left;
    const cardH = guess.bottom - guess.top;
    const eyeY = (reading.left.y + reading.right.y) / 2;
    const x0 = clamp(Math.min(edges.left, guess.left) - card * 0.32, 0, still.width - 2);
    const x1 = clamp(Math.max(edges.right, guess.right) + card * 0.32, x0 + 2, still.width);
    const y0 = clamp(guess.top - cardH * 0.3, 0, still.height - 2);
    const y1 = clamp(eyeY + cardH * 0.55, y0 + 2, still.height);
    return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 };
  });
  const toView = (frameX: number) => (crop.x1 - frameX) / crop.w;
  const toFrame = (u: number) => crop.x1 - u * crop.w;
  /** One frame pixel, as a fraction of the view. */
  const px = 1 / crop.w;
  // Mirrored: the edge at the larger frame x is the one on the left of the view.
  const [l, setL] = useState(() => toView(Math.max(edges.left, edges.right)));
  const [r, setR] = useState(() => toView(Math.min(edges.left, edges.right)));
  const GAP = 0.18;
  const moveL = (u: number) => setL(clamp(u, 0, r - GAP));
  const moveR = (u: number) => setR(clamp(u, l + GAP, 1));

  // Fit the view into the space the stage leaves, keeping the picture's proportions.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const fit = () => {
      const w = Math.min(box.clientWidth, (box.clientHeight * crop.w) / crop.h);
      if (w > 0) setSize({ w: Math.floor(w), h: Math.floor((w * crop.h) / crop.w) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [crop]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(still, crop.x0, crop.y0, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
  }, [still, crop, size]);

  const drag = (move: (u: number) => void) => (e: ReactPointerEvent<HTMLDivElement>) => {
    const view = viewRef.current;
    if (!view) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    el.focus({ preventScroll: true });
    const at = (ev: PointerEvent | ReactPointerEvent) => {
      const b = view.getBoundingClientRect();
      move((ev.clientX - b.left) / b.width);
    };
    const onMove = (ev: PointerEvent) => at(ev);
    const end = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  };
  const keys = (value: number, move: (u: number) => void) => (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    move(value + (e.key === 'ArrowLeft' ? -1 : 1) * px * (e.shiftKey ? 5 : 1));
  };

  const line = (value: number, move: (u: number) => void, label: string) => (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      onPointerDown={drag(move)}
      onKeyDown={keys(value, move)}
      className="group absolute inset-y-0 z-10 -ml-[22px] flex w-11 cursor-ew-resize touch-none justify-center outline-none"
      style={{ left: `${value * 100}%` }}
    >
      <span className="h-full w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.45),0_0_12px_rgba(255,255,255,0.6)]" />
      <span className="absolute top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-lg ring-4 ring-white/25 transition group-focus-visible:ring-brand-300 group-active:scale-95">
        <span className="flex gap-0.5">
          <i className="h-3.5 w-0.5 rounded-full bg-ink/60" />
          <i className="h-3.5 w-0.5 rounded-full bg-ink/60" />
        </span>
      </span>
    </div>
  );

  const nudge = (label: string, onClick: () => void, dir: 'left' | 'right') => (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-white/20 active:scale-95">
      {dir === 'left' ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
    </button>
  );

  return (
    <div className="absolute inset-0 z-10 bg-ink text-white" data-pd-adjust>
      <div className="mx-auto flex h-full w-full max-w-[600px] flex-col p-3 sm:p-6">
      <div className="shrink-0 px-1 text-center">
        <h3 className="display text-[21px] leading-[1.12] sm:text-[26px]">{t('adjustTitle')}</h3>
        <p className={cn('mx-auto mt-1.5 max-w-md text-[13px] leading-snug sm:text-[14px]', bad ? 'text-amber-200' : 'text-white/70')} role={bad ? 'alert' : undefined}>
          {bad && <CircleAlert className="-mt-0.5 mr-1.5 inline h-4 w-4" />}
          {bad ? t('cardBad') : edges.found ? t('adjustFound') : t('adjustText')}
        </p>
      </div>

      <div ref={boxRef} className="my-3 grid min-h-0 flex-1 place-items-center sm:my-4">
        {size && (
          <div ref={viewRef} className="relative select-none" style={{ width: size.w, height: size.h }}>
            <canvas ref={canvasRef} role="img" aria-label={t('photoAlt')} className="block h-full w-full rounded-2xl" />
            {/* outside the card: dimmed, so the part being measured stands out */}
            <div className="pointer-events-none absolute inset-y-0 left-0 rounded-l-2xl bg-ink/45" style={{ width: `${l * 100}%` }} />
            <div className="pointer-events-none absolute inset-y-0 right-0 rounded-r-2xl bg-ink/45" style={{ width: `${(1 - r) * 100}%` }} />
            <div className="pointer-events-none absolute top-2 flex items-center justify-center" style={{ left: `${l * 100}%`, width: `${(r - l) * 100}%` }}>
              <span className="rounded-full bg-black/60 px-2.5 py-1 text-[11.5px] font-bold tabular-nums tracking-wide text-white ring-1 ring-white/15 backdrop-blur-sm">{lang === 'en' ? '85.6' : '85,6'} mm</span>
            </div>
            {line(l, moveL, t('edgeLeft'))}
            {line(r, moveR, t('edgeRight'))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="flex gap-2">
          {nudge(`${t('edgeLeft')}: ${t('nudgeLeft')}`, () => moveL(l - px), 'left')}
          {nudge(`${t('edgeLeft')}: ${t('nudgeRight')}`, () => moveL(l + px), 'right')}
        </div>
        <div className="flex gap-2">
          {nudge(`${t('edgeRight')}: ${t('nudgeLeft')}`, () => moveR(r - px), 'left')}
          {nudge(`${t('edgeRight')}: ${t('nudgeRight')}`, () => moveR(r + px), 'right')}
        </div>
      </div>
      <div className="mt-3 grid shrink-0 gap-2 sm:grid-cols-2">
        <button type="button" className={cn(stageBtn(true), 'sm:order-2')} onClick={() => onUse(toFrame(l), toFrame(r))}>
          <Check className="h-[18px] w-[18px]" /> {t('useCard')}
        </button>
        <button type="button" className={stageBtn()} onClick={onRetake}>
          <RefreshCw className="h-4 w-4" /> {t('retake')}
        </button>
      </div>
      </div>
    </div>
  );
}
