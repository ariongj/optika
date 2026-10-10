import { forwardRef, useEffect, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { useDict } from '@/i18n';
import { cn } from '@/lib/utils';
import { bk } from './dict';

/** Current time, refreshed every minute — slots expire while the page is open. */
export function useNow(stepMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), stepMs);
    return () => window.clearInterval(id);
  }, [stepMs]);
  return now;
}

/** Smooth-scroll a step into view unless it's already comfortably on screen. */
export function reveal(el: HTMLElement | null) {
  if (!el) return;
  requestAnimationFrame(() => {
    const r = el.getBoundingClientRect();
    if (r.top < 70 || r.top > window.innerHeight * 0.55) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  });
}

/** Numbered step card of the booking flow. */
export const StepCard = forwardRef<
  HTMLElement,
  { n: number; title: string; hint?: string; done?: boolean; locked?: string | false; aside?: ReactNode; children: ReactNode; className?: string }
>(function StepCard({ n, title, hint, done, locked, aside, children, className }, ref) {
  const t = useDict(bk);
  const id = `bk-step-${n}`;
  return (
    <section ref={ref} aria-labelledby={id} className={cn('scroll-mt-28 rounded-3xl bg-white p-5 ring-1 ring-line sm:p-7', className)}>
      <header className="flex items-start gap-3.5">
        <span
          aria-hidden
          className={cn(
            'grid h-9 w-9 shrink-0 place-items-center rounded-full text-[14px] font-bold transition-colors',
            done ? 'bg-brand-600 text-white' : locked ? 'bg-sand text-muted' : 'bg-ink text-paper',
          )}
        >
          {done ? <Check className="h-4 w-4" strokeWidth={2.6} /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">{t('step', { n })}</div>
          <h2 id={id} className="display mt-0.5 text-[24px] leading-tight text-ink sm:text-[27px]">
            {title}
          </h2>
          {hint && !locked && <p className="mt-1 text-[13.5px] text-muted">{hint}</p>}
        </div>
        {aside && <div className="shrink-0 pt-1">{aside}</div>}
      </header>
      {locked && <p className="mt-4 rounded-2xl bg-paper px-4 py-3.5 text-[13.5px] text-muted ring-1 ring-inset ring-line">{locked}</p>}
      {/* kept mounted while locked, so typed details survive a time change */}
      <div className="mt-5" hidden={!!locked}>
        {children}
      </div>
    </section>
  );
});

/** Small pill with an icon (duration, location…). */
export function Meta({ icon, children, className }: { icon: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-paper px-2.5 py-1 text-[12px] font-semibold text-ink-soft ring-1 ring-inset ring-line', className)}>
      {icon}
      {children}
    </span>
  );
}

/** Capitalise the first letter ("e hënë 13 tetor" → "E hënë 13 tetor"). */
export const cap = (s: string) => (s ? s[0].toLocaleUpperCase() + s.slice(1) : s);
