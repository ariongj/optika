import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useDict } from '@/i18n';
import { common } from '@/i18n/common';
import { cn } from '@/lib/utils';
import { SG } from './dict';

/* ------------------------------------------------------------------ */
/* Geometry — a generic camera frame (front view) and its temple       */
/* (side view), drawn in a 640×470 box. Not any one product.           */
/* ------------------------------------------------------------------ */
const VB_W = 640;
const VB_H = 470;
const INK = 'var(--color-ink)';
const FRAME = '#fbf8f3';
const GREEN = 'var(--color-brand-600)';

type Seg = [string, ...number[]];
const W = 196;
const H = 136;
const OFF = W / 2 + 26;
const CX = 320;
const CY = 146;
const RIM = 15;

/** Wayfarer-like lens outline (right lens, centred on 0,0). */
const LENS: Seg[] = [
  ['M', -0.5 * W, -0.36 * H],
  ['C', -0.2 * W, -0.43 * H, 0.2 * W, -0.5 * H, 0.52 * W, -0.56 * H],
  ['C', 0.56 * W, -0.2 * H, 0.5 * W, 0.18 * H, 0.32 * W, 0.42 * H],
  ['C', 0.16 * W, 0.6 * H, -0.24 * W, 0.58 * H, -0.4 * W, 0.34 * H],
  ['C', -0.5 * W, 0.18 * H, -0.53 * W, -0.12 * H, -0.5 * W, -0.36 * H],
];
const r1 = (n: number) => Math.round(n * 10) / 10;
/** Lens path placed on one side (dir 1 = viewer's right, -1 = viewer's left), shifted up by `up`. */
const place = (segs: Seg[], dir: 1 | -1, up = 0) =>
  segs.map(([c, ...v]) => c + v.map((n, i) => (i % 2 === 0 ? r1(CX + dir * (OFF + n)) : r1(CY + n - up))).join(' ')).join(' ');
const lensR = `${place(LENS, 1)} Z`;
const lensL = `${place(LENS, -1)} Z`;
const pt = (x: number, y: number, dir: 1 | -1) => [r1(CX + dir * (OFF + x)), r1(CY + y)] as const;
const [rix, riy] = pt(-0.5 * W, -0.36 * H, 1);
const [lix] = pt(-0.5 * W, -0.36 * H, -1);
const [rox, roy] = pt(0.52 * W, -0.56 * H, 1);
const [lox] = pt(0.52 * W, -0.56 * H, -1);
const EP_Y = roy + RIM * 0.32;
const MEMBERS: { d: string; w: number; cap?: 'round' }[] = [
  { d: lensR, w: RIM },
  { d: lensL, w: RIM },
  { d: `M${lix + 2} ${riy + RIM * 0.55} C${lix + 22} ${riy - 4} ${rix - 22} ${riy - 4} ${rix - 2} ${riy + RIM * 0.55}`, w: RIM * 1.08 },
  // brow: a slightly heavier top edge
  { d: `M${rix} ${riy - 3} ${place([LENS[1]], 1, 3)}`, w: RIM * 1.3, cap: 'round' },
  { d: `M${lix} ${riy - 3} ${place([LENS[1]], -1, 3)}`, w: RIM * 1.3, cap: 'round' },
  // end pieces (they hold the camera and the LED)
  { d: `M${rox - 7} ${EP_Y} L${rox + 15} ${EP_Y}`, w: RIM * 1.4, cap: 'round' },
  { d: `M${lox + 7} ${EP_Y} L${lox - 15} ${EP_Y}`, w: RIM * 1.4, cap: 'round' },
];

/* ------------------------------------------------------------------ */
type Key = 'camera' | 'led' | 'speaker' | 'mics' | 'touch' | 'battery';
/** Hotspots (x, y) with the part they point at (ax, ay), in viewBox coordinates — numbers sit beside the drawing. */
const SPOTS: { key: Key; x: number; y: number; ax: number; ay: number }[] = [
  { key: 'camera', x: rox + 30, y: 30, ax: rox + 6, ay: EP_Y - 9 },
  { key: 'led', x: lox - 30, y: 30, ax: lox - 6, ay: EP_Y - 8 },
  { key: 'speaker', x: 520, y: 380, ax: 474, ay: 336 },
  { key: 'mics', x: 116, y: 362, ax: 108, ay: 311 },
  { key: 'touch', x: 186, y: 252, ax: 186, ay: 292 },
  { key: 'battery', x: 318, y: 252, ax: 318, ay: 293 },
];

/**
 * Hero visual: a smart-glasses line drawing (front + temple) with numbered hotspots. Hover, focus or tap a number
 * to read what the part does; works with the keyboard (buttons in reading order) and on touch screens.
 */
export function AnnotatedGlasses({ className }: { className?: string }) {
  const t = useDict(SG);
  const tc = useDict(common);
  const [active, setActive] = useState(0);
  const spot = SPOTS[active];
  const go = (d: number) => setActive((i) => (i + d + SPOTS.length) % SPOTS.length);

  return (
    <div className={cn('rounded-[28px] bg-white p-3 ring-1 ring-line shadow-[0_30px_60px_-36px_rgba(28,26,23,0.45)] sm:p-4', className)}>
      <div className="relative overflow-hidden rounded-[22px] bg-[linear-gradient(135deg,#efe7dc,#f7f3ee)]">
        <div className="pointer-events-none absolute left-[3.5%] top-[46%] text-[10.5px] font-bold uppercase tracking-[0.18em] text-muted">{t('annoFront')}</div>
        <div className="pointer-events-none absolute left-[3.5%] top-[87%] text-[10.5px] font-bold uppercase tracking-[0.18em] text-muted">{t('annoSide')}</div>
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="block h-auto w-full" role="img" aria-label={t('annoTitle')}>
          <defs>
            <linearGradient id="sg-lens" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#2c4a3a" stopOpacity="0.2" />
              <stop offset="1" stopColor="#1c1a17" stopOpacity="0.06" />
            </linearGradient>
            <clipPath id="sg-lenses">
              <path d={lensR} />
              <path d={lensL} />
            </clipPath>
          </defs>
          {/* soft plinth */}
          <ellipse cx={CX} cy={CY + 84} rx="230" ry="12" fill="#5a4330" opacity="0.08" />
          {/* ---- front view ---- */}
          <path d={lensR} fill="url(#sg-lens)" />
          <path d={lensL} fill="url(#sg-lens)" />
          <g clipPath="url(#sg-lenses)" stroke="#fff" strokeOpacity="0.9" strokeWidth="5" strokeLinecap="round">
            <path d={`M${CX + OFF + 34} ${CY - 44} l-36 46 M${CX + OFF + 56} ${CY - 40} l-24 31`} />
            <path d={`M${CX - OFF + 34} ${CY - 44} l-36 46 M${CX - OFF + 56} ${CY - 40} l-24 31`} />
          </g>
          {MEMBERS.map((m, i) => (
            <path key={`i${i}`} d={m.d} fill="none" stroke={INK} strokeWidth={m.w + 6} strokeLinejoin="round" strokeLinecap={m.cap ?? 'butt'} />
          ))}
          {MEMBERS.map((m, i) => (
            <path key={`p${i}`} d={m.d} fill="none" stroke={FRAME} strokeWidth={m.w} strokeLinejoin="round" strokeLinecap={m.cap ?? 'butt'} />
          ))}
          {/* camera (viewer's right) + LED (viewer's left) */}
          <circle cx={rox + 6} cy={EP_Y} r="11" fill={GREEN} fillOpacity="0.14" />
          <circle cx={rox + 6} cy={EP_Y} r="7" fill={FRAME} stroke={GREEN} strokeWidth="2.6" />
          <circle cx={rox + 6} cy={EP_Y} r="3.4" fill={GREEN} />
          <circle cx={lox - 6} cy={EP_Y} r="8" fill={GREEN} fillOpacity="0.14" />
          <circle cx={lox - 6} cy={EP_Y} r="3.2" fill={GREEN} />

          {/* ---- side view: temple ---- */}
          <line x1="40" y1="262" x2="600" y2="262" stroke={INK} strokeOpacity="0.08" strokeDasharray="2 8" strokeLinecap="round" />
          <rect x="48" y="276" width="24" height="112" rx="10" fill={FRAME} stroke={INK} strokeWidth="3" />
          <rect x="70" y="292" width="16" height="20" rx="4" fill={FRAME} stroke={INK} strokeWidth="3" />
          <path
            d="M86 288 L360 288 C420 288 470 291 520 295 C556 298 582 312 598 348 C592 356 584 356 580 349 C566 324 548 312 520 310 C470 307 420 314 360 314 L86 314 Z"
            fill={FRAME}
            stroke={INK}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* touch panel */}
          <rect x="114" y="293.5" width="144" height="15" rx="7.5" fill={GREEN} fillOpacity="0.07" stroke={GREEN} strokeOpacity="0.55" strokeWidth="1.6" strokeDasharray="5 4" />
          {/* battery */}
          <rect x="280" y="294" width="76" height="14" rx="3.5" fill="none" stroke={INK} strokeOpacity="0.45" strokeWidth="1.6" strokeDasharray="4 3" />
          <rect x="356" y="298" width="4" height="6" rx="1" fill={INK} fillOpacity="0.45" />
          {/* microphones */}
          {[98, 108, 118].map((x) => (
            <circle key={x} cx={x} cy="309" r="1.9" fill={INK} fillOpacity="0.7" />
          ))}
          {/* open-ear speaker + sound */}
          {[456, 463, 470, 477].map((x) => (
            <line key={x} x1={x} y1="303.5" x2={x} y2="309" stroke={INK} strokeOpacity="0.7" strokeWidth="2" strokeLinecap="round" />
          ))}
          {/* leader lines from each number to its part */}
          {SPOTS.map((sp, i) => (
            <g key={sp.key} className="transition-opacity duration-200" opacity={i === active ? 1 : 0.45}>
              <line x1={sp.x} y1={sp.y} x2={sp.ax} y2={sp.ay} stroke={i === active ? GREEN : INK} strokeWidth="1.6" strokeDasharray="3 3" />
              <circle cx={sp.ax} cy={sp.ay} r="3" fill={i === active ? GREEN : INK} />
            </g>
          ))}
          {[14, 25, 36].map((r, i) => (
            <path key={r} d={`M${467 - r * 0.8} ${316 + r * 0.6} A${r} ${r} 0 0 0 ${467 + r * 0.8} ${316 + r * 0.6}`} fill="none" stroke={GREEN} strokeOpacity={0.8 - i * 0.22} strokeWidth="2.4" strokeLinecap="round" />
          ))}
        </svg>

        {/* hotspots: real buttons laid over the drawing (≥40 px tap targets) */}
        {SPOTS.map((s, i) => {
          const on = i === active;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setActive(i)}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              aria-pressed={on}
              aria-label={`${i + 1}. ${t(`hs_${s.key}`)}`}
              className="group absolute grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full outline-none"
              style={{ left: `${(s.x / VB_W) * 100}%`, top: `${(s.y / VB_H) * 100}%` }}
            >
              {on && <span aria-hidden className="absolute inset-1 animate-ping rounded-full bg-brand-500/30 [animation-duration:2.2s]" />}
              <span
                className={cn(
                  'relative grid h-[26px] w-[26px] place-items-center rounded-full text-[12px] font-bold tabular-nums shadow-[0_4px_10px_-4px_rgba(28,26,23,0.5)] ring-2 transition-all duration-200 group-focus-visible:ring-4 group-focus-visible:ring-brand-300',
                  on ? 'scale-110 bg-brand-600 text-white ring-white' : 'bg-white text-ink ring-white/80 group-hover:bg-ink group-hover:text-paper',
                )}
              >
                {i + 1}
              </span>
            </button>
          );
        })}
      </div>

      {/* explanation of the active part */}
      <div className="flex items-start gap-3 px-1.5 pt-4 sm:px-2">
        <span className="display grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-600 text-[18px] text-white">{active + 1}</span>
        <div className="min-h-[7.25rem] min-w-0 flex-1 sm:min-h-[4.5rem]" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={spot.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
              <div className="text-[15.5px] font-bold leading-snug text-ink">{t(`hs_${spot.key}`)}</div>
              <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{t(`hs_${spot.key}Text`)}</p>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="hidden shrink-0 gap-1 sm:flex">
          <button type="button" onClick={() => go(-1)} aria-label={tc('prev')} className="grid h-10 w-10 place-items-center rounded-full border border-line text-ink transition-colors hover:border-ink/30 hover:bg-paper">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => go(1)} aria-label={tc('next')} className="grid h-10 w-10 place-items-center rounded-full border border-line text-ink transition-colors hover:border-ink/30 hover:bg-paper">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 px-1.5 pb-1 pt-2 sm:px-2">
        <p className="text-[12px] leading-snug text-muted">
          <span className="font-semibold text-ink-soft">{t('annoHint')}</span> · {t('annoNote')}
        </p>
        <div className="flex shrink-0 gap-1 sm:hidden">
          <button type="button" onClick={() => go(-1)} aria-label={tc('prev')} className="grid h-10 w-10 place-items-center rounded-full border border-line text-ink transition-colors hover:border-ink/30 hover:bg-paper">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => go(1)} aria-label={tc('next')} className="grid h-10 w-10 place-items-center rounded-full border border-line text-ink transition-colors hover:border-ink/30 hover:bg-paper">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
