import type { CSSProperties } from 'react';
import type { FrameShape } from '@/site/tryon/frames';
import { cn } from '@/lib/utils';
import type { Face, Fit, Material } from './finderData';

/* ------------------------------------------------------------------ */
/* Face outlines                                                        */
/* ------------------------------------------------------------------ */
const FACE_PATH: Record<Exclude<Face, 'unknown'>, string> = {
  oval: 'M40 12C55 12 64 27 64 45C64 66 54 84 40 84C26 84 16 66 16 45C16 27 25 12 40 12Z',
  round: 'M40 16C57 16 67 30 67 48C67 66 56 80 40 80C24 80 13 66 13 48C13 30 23 16 40 16Z',
  square: 'M17 23C17 17 21 14 27 14H53C59 14 63 17 63 23L64 62C64 71 58 79 49 81H31C22 79 16 71 16 62Z',
  heart: 'M40 85C31 81 20 67 16 51C13 38 14 25 21 18C27 13 33 12 40 12C47 12 53 13 59 18C66 25 67 38 64 51C60 67 49 81 40 85Z',
  long: 'M40 7C53 7 59 20 59 38V60C59 77 51 89 40 89C29 89 21 77 21 60V38C21 20 27 7 40 7Z',
};

/** Line drawing of a face shape (with dashed width guides) for the quiz and the face guide. */
export function FaceGlyph({ face, className }: { face: Face; className?: string }) {
  if (face === 'unknown') {
    return (
      <svg viewBox="0 0 80 96" className={className} aria-hidden fill="none">
        <path d={FACE_PATH.oval} stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.6" strokeDasharray="4 4" />
        <text x="40" y="56" textAnchor="middle" fontSize="26" fontFamily="Fraunces, serif" fill="currentColor" opacity="0.7">
          ?
        </text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 80 96" className={className} aria-hidden fill="none">
      <path d={FACE_PATH[face]} fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="32.5" cy="44" r="1.9" fill="currentColor" />
      <circle cx="47.5" cy="44" r="1.9" fill="currentColor" />
      <path d="M28.5 38.5q4-2 8 0M43.5 38.5q4-2 8 0" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M40 49v8l-2 1" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M35 67q5 3 10 0" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Frame silhouettes                                                    */
/* ------------------------------------------------------------------ */
/** One lens outline (left lens; the right one is mirrored). */
const LENS_PATH: Record<FrameShape, string> = {
  rectangle: 'M12 15C12 12 14 11 17 11H49C52 11 53 12 53 15V30C53 35 50 37 45 37H21C15 37 12 34 12 30Z',
  square: 'M13 10C13 8 14 7 16 7H50C52 7 53 8 53 10V33C53 38 50 40 45 40H21C16 40 13 38 13 33Z',
  round: 'M33 6C44 6 52 14 52 24C52 35 44 42 33 42C22 42 13 35 13 24C13 14 22 6 33 6Z',
  panto: 'M13 12C13 9 15 8 18 8H48C51 8 53 10 52 13C51 29 45 41 32 41C19 41 13 30 13 12Z',
  aviator: 'M12 12C12 9 14 8 18 8H48C51 8 53 10 52 13C51 26 46 42 32 42C18 42 12 26 12 12Z',
  'cat-eye': 'M10 9C20 11 36 9 52 13C54 14 54 16 53 18C51 31 44 38 33 38C21 38 14 30 12 18C11 15 10 12 10 9Z',
  geometric: 'M20 8H46L53 16V32L45 40H21L13 32V16Z',
  wrap: '',
};
const WRAP_PATH = 'M6 16C6 11 10 9 16 9H104C110 9 114 11 114 16C113 30 104 39 90 39C78 39 70 33 64 26H56C50 33 42 39 30 39C16 39 7 30 6 16Z';

export function FrameGlyph({ shape, build = 'acetate', tint = 'clear', className }: { shape: FrameShape; build?: 'metal' | 'acetate'; tint?: 'clear' | 'sun'; className?: string }) {
  const sw = build === 'metal' ? 1.6 : 4.2;
  const fill = tint === 'sun' ? 'currentColor' : 'transparent';
  const fillOpacity = tint === 'sun' ? 0.78 : 0;
  if (shape === 'wrap') {
    return (
      <svg viewBox="0 0 120 48" className={className} aria-hidden fill="none">
        <path d={WRAP_PATH} fill={fill} fillOpacity={tint === 'sun' ? 0.78 : 0.06} stroke="currentColor" strokeWidth={3} strokeLinejoin="round" />
        <path d="M6 15L1 13M114 15L119 13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }
  const d = LENS_PATH[shape];
  return (
    <svg viewBox="0 0 120 48" className={className} aria-hidden fill="none">
      <path d={d} fill={fill} fillOpacity={fillOpacity} stroke="currentColor" strokeWidth={sw} strokeLinejoin="round" />
      <path d={d} transform="translate(120 0) scale(-1 1)" fill={fill} fillOpacity={fillOpacity} stroke="currentColor" strokeWidth={sw} strokeLinejoin="round" />
      <path d="M52 17C56 14 64 14 68 17" stroke="currentColor" strokeWidth={build === 'metal' ? 1.6 : 3.2} strokeLinecap="round" />
      <path d="M12 14L3 12M108 14L117 12" stroke="currentColor" strokeWidth={build === 'metal' ? 1.6 : 3} strokeLinecap="round" />
      {tint === 'sun' && <path d="M19 15C22 12 27 12 30 12" stroke="#fff" strokeOpacity="0.45" strokeWidth="1.6" strokeLinecap="round" />}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Material swatches                                                    */
/* ------------------------------------------------------------------ */
const SWATCH: Record<Material, CSSProperties> = {
  metal: { background: 'linear-gradient(135deg,#f6f7f8 0%,#a6abb0 38%,#eef0f1 55%,#8a8f94 100%)' },
  dark: { background: 'radial-gradient(circle at 32% 28%,#5a5a5a 0%,#1c1c1c 45%,#0d0d0d 100%)' },
  warm: {
    background:
      'radial-gradient(circle at 26% 30%,#d79a52 0 11%,transparent 12%),radial-gradient(circle at 68% 62%,#2d190d 0 15%,transparent 16%),radial-gradient(circle at 44% 76%,#e0aa66 0 8%,transparent 9%),radial-gradient(circle at 66% 24%,#3a2214 0 10%,transparent 11%),radial-gradient(circle at 22% 66%,#4a2c18 0 9%,transparent 10%),linear-gradient(135deg,#9a5d2b,#5a3620)',
  },
  clear: { background: 'linear-gradient(135deg,rgba(255,255,255,0.95) 0%,rgba(226,220,210,0.7) 55%,rgba(255,255,255,0.9) 100%)' },
};

export function MaterialSwatch({ material, className }: { material: Material; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('relative block rounded-full shadow-[inset_0_1px_2px_rgba(255,255,255,0.6),0_6px_14px_-8px_rgba(28,26,23,0.5)] ring-1 ring-ink/10', material === 'clear' && 'ring-ink/20', className)}
      style={SWATCH[material]}
    >
      {material === 'clear' && <span className="absolute inset-[18%] rounded-full border border-dashed border-ink/20" />}
      <span className="absolute left-[22%] top-[16%] h-[18%] w-[34%] -rotate-[25deg] rounded-full bg-white/40 blur-[1px]" />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Face width                                                           */
/* ------------------------------------------------------------------ */
const FIT_W: Record<Exclude<Fit, 'unknown'>, number> = { narrow: 64, medium: 80, wide: 96 };

export function WidthGlyph({ fit, className }: { fit: Fit; className?: string }) {
  if (fit === 'unknown') {
    return (
      <svg viewBox="0 0 120 48" className={className} aria-hidden fill="none">
        <path d="M14 30H106" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.6" strokeDasharray="3 4" />
        {[14, 34, 54, 74, 94].map((x) => (
          <path key={x} d={`M${x} 26v8`} stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.4" />
        ))}
        <text x="60" y="20" textAnchor="middle" fontSize="14" fontFamily="Fraunces, serif" fill="currentColor" opacity="0.7">
          ?
        </text>
      </svg>
    );
  }
  const w = FIT_W[fit];
  const x0 = 60 - w / 2;
  const x1 = 60 + w / 2;
  return (
    <svg viewBox="0 0 120 48" className={className} aria-hidden fill="none">
      <rect x={x0} y="10" width={w / 2 - 4} height="16" rx="5" stroke="currentColor" strokeWidth="2.4" />
      <rect x={60 + 4} y="10" width={w / 2 - 4} height="16" rx="5" stroke="currentColor" strokeWidth="2.4" />
      <path d={`M${x0} 38H${x1}M${x0} 34v8M${x1} 34v8`} stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.4" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Match ring                                                           */
/* ------------------------------------------------------------------ */
export function MatchRing({ pct, label, className }: { pct: number; label: string; className?: string }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <span className={cn('grid h-14 w-14 place-items-center rounded-full bg-white/95 shadow-md backdrop-blur', className ?? 'relative')} title={label}>
      <svg viewBox="0 0 48 48" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
        <circle cx="24" cy="24" r={r} fill="none" stroke="#efe7dc" strokeWidth="3.5" />
        <circle cx="24" cy="24" r={r} fill="none" stroke="#2c4a3a" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} />
      </svg>
      <span aria-hidden className="relative text-[13px] font-bold tabular-nums text-ink">
        {pct}
        <span className="text-[9px]">%</span>
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
