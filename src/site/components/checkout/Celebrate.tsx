import { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';

const EASE = [0.16, 1, 0.3, 1] as const;

/** Animated success badge: soft halo, disc pops in, check mark draws itself. */
export function SuccessCheck() {
  const reduce = useReducedMotion();
  return (
    <div className="relative grid h-24 w-24 place-items-center">
      {!reduce &&
        [0, 1].map((i) => (
          <motion.span
            key={i}
            className="absolute inset-0 rounded-full bg-emerald-600/25"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [0.8, 1.9], opacity: [0.55, 0] }}
            transition={{ duration: 1.6, delay: 0.35 + i * 0.45, ease: 'easeOut' }}
          />
        ))}
      <motion.span
        className="absolute inset-0 rounded-full bg-emerald-600 shadow-[0_18px_40px_-14px_rgb(5_150_105/0.75)]"
        initial={reduce ? false : { scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 17, delay: 0.1 }}
      />
      <svg viewBox="0 0 52 52" className="relative h-12 w-12 text-white" fill="none" stroke="currentColor" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <motion.path d="M14 27.5l8 8 16-18" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.45, ease: EASE }} />
      </svg>
    </div>
  );
}

/** Deterministic pseudo-random (stable across renders). */
function prand(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const COLORS = ['var(--color-brand-600)', 'var(--color-brand-300)', 'var(--color-oak)', 'var(--color-sage)', '#e9c46a', 'var(--color-ink)'];

/** One gentle burst of paper confetti from the centre of its (relative) parent. */
export function Confetti({ count = 46, className }: { count?: number; className?: string }) {
  const reduce = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = -Math.PI / 2 + (prand(i, 1) - 0.5) * Math.PI * 1.15;
        const power = 170 + prand(i, 2) * 260;
        return {
          dx: Math.cos(angle) * power * 1.35,
          up: Math.sin(angle) * power * 0.9,
          fall: 260 + prand(i, 3) * 220,
          rot: (prand(i, 4) - 0.5) * 900,
          w: 6 + prand(i, 5) * 6,
          h: prand(i, 6) > 0.5 ? 6 + prand(i, 7) * 4 : 12 + prand(i, 7) * 6,
          round: prand(i, 8) > 0.72,
          color: COLORS[Math.floor(prand(i, 9) * COLORS.length)],
          delay: 0.35 + prand(i, 10) * 0.25,
          duration: 2.2 + prand(i, 11) * 1.2,
        };
      }),
    [count],
  );
  if (reduce) return null;
  return (
    <div aria-hidden className={'pointer-events-none absolute inset-0 overflow-hidden ' + (className ?? '')}>
      <div className="absolute left-1/2 top-[120px] sm:top-[150px]">
        {pieces.map((p, i) => (
          <motion.span
            key={i}
            className="absolute block"
            style={{ width: p.w, height: p.h, background: p.color, borderRadius: p.round ? 999 : 2, left: -p.w / 2, top: -p.h / 2 }}
            initial={{ x: 0, y: 0, rotate: 0, opacity: 0, scale: 0.6 }}
            animate={{
              x: [0, p.dx * 0.75, p.dx],
              y: [0, p.up, p.up + p.fall],
              rotate: [0, p.rot * 0.4, p.rot],
              opacity: [1, 1, 0],
              scale: [0.6, 1, 0.9],
            }}
            transition={{ duration: p.duration, delay: p.delay, times: [0, 0.32, 1], ease: 'easeOut' }}
          />
        ))}
      </div>
    </div>
  );
}
