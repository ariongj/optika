import { Fragment, useEffect, useRef, useState, type PointerEvent, type ReactNode, type RefObject } from 'react';
import { useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Small building blocks of the dark launch page                       */
/* ------------------------------------------------------------------ */

/** Headline in Manrope with tight tracking; `*word*` becomes the Fraunces-italic mint accent. */
export function Headline({ text, as: Tag = 'h2', className }: { text: string; as?: 'h1' | 'h2' | 'h3'; className?: string }) {
  const parts = text.split(/(\*[^*]+\*)/g).filter(Boolean);
  return (
    <Tag className={cn('font-sans font-semibold tracking-[-0.035em] text-balance', className)}>
      {parts.map((p, i) =>
        p.startsWith('*') && p.endsWith('*') ? (
          <em key={i} className="sg-accent">
            {p.slice(1, -1)}
          </em>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </Tag>
  );
}

/** Mono HUD kicker: "01 — Specs" with a short mint rule. */
export function Kicker({ n, children, className, tone = 'dark' }: { n?: string; children: ReactNode; className?: string; tone?: 'dark' | 'light' }) {
  return (
    <div className={cn('sg-mono flex items-center gap-3 text-[11px]', tone === 'dark' ? 'text-white/55' : 'text-muted', className)}>
      {n && <span className={tone === 'dark' ? 'text-[#6fd3a5]' : 'text-brand-600'}>{n}</span>}
      <span aria-hidden className={cn('h-px w-8', tone === 'dark' ? 'bg-[#6fd3a5]/50' : 'bg-brand-600/40')} />
      <span>{children}</span>
    </div>
  );
}

/** Glowing mint status dot (with a soft ping unless reduced motion). */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn('relative inline-flex h-2 w-2 shrink-0', className)}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#6fd3a5] opacity-60 [animation-duration:2.4s]" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#6fd3a5] shadow-[0_0_10px_2px_rgb(111_211_165/0.7)]" />
    </span>
  );
}

/** Pointer-follow glow for `.sg-card` (sets --x / --y). */
export function glowMove(e: PointerEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--x', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--y', `${e.clientY - r.top}px`);
}

/** True once the element has scrolled into view (or always, without IntersectionObserver). */
export function useInView(ref: RefObject<Element | null>, { once = true, margin = '0px 0px -10% 0px', threshold = 0.15 } = {}) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        setInView(e.isIntersecting);
        if (e.isIntersecting && once) io.disconnect();
      },
      { rootMargin: margin, threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, once, margin, threshold]);
  return inView;
}

/** Number that counts up once it scrolls into view (instant under reduced motion). */
export function CountUp({ to, decimals = 0, duration = 1400, className }: { to: number; decimals?: number; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref);
  const reduce = useReducedMotion();
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setV(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / duration);
      setV(to * (1 - Math.pow(1 - k, 4)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce, to, duration]);
  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {/* the final value is always in the accessible text */}
      <span aria-hidden>{v.toFixed(decimals)}</span>
      <span className="sr-only">{to.toFixed(decimals)}</span>
    </span>
  );
}

/** Animated hairline grid + noise + soft radial glows — the page's backdrop. */
export function Backdrop({ glow = 'right', grid = true, className }: { glow?: 'right' | 'center' | 'left' | 'none'; grid?: boolean; className?: string }) {
  const pos = glow === 'right' ? '68% 45%' : glow === 'left' ? '25% 45%' : '50% 50%';
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {glow !== 'none' && (
        <div
          className="sg-glow absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 50% 45% at ${pos}, rgb(111 211 165 / 0.16), rgb(44 74 58 / 0.12) 45%, transparent 75%)`,
          }}
        />
      )}
      {grid && (
        <div className="sg-grid-mask absolute inset-0">
          <div className="sg-grid absolute -left-16 -top-16 bottom-0 right-0" />
        </div>
      )}
      {/* film grain, blended: phones skip it (a blend mode costs a compositing pass every frame, and on this near-black
          page it is all but invisible) */}
      <div className="bg-grain absolute inset-0 opacity-[0.35] mix-blend-overlay pointer-coarse:hidden" />
    </div>
  );
}

/** Live `matchMedia` flag (false during the first render on the server-less SPA is fine: it settles on mount). */
export function useMedia(query: string) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}
