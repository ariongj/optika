import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, ChevronLeft, ChevronRight, Eye, ScanFace } from 'lucide-react';
import type { HeroSlide } from '@/lib/types';
import { Accent } from '@/components/ui/misc';
import { CtaLink, isBookingHref } from '@/site/components/utility/Booking';
import { useDict, useL } from '@/i18n';
import { site } from '@/i18n/site';
import { common } from '@/i18n/common';
import { cn } from '@/lib/utils';

const DURATION = 7000;

const isTryOnHref = (href: string) => href.trim().split(/[?#]/)[0] === '/provo-virtualisht';

/** Bundled hero photos have a 2:3 portrait crop for phones (`<name>-m.webp`); uploaded images don't. */
const portraitOf = (src: string) => (/\/images\/hero\/[^/]+\.webp$/.test(src) && !src.endsWith('-m.webp') ? src.replace(/\.webp$/, '-m.webp') : null);

export function HeroSection({ slides, autoplay }: { slides: HeroSlide[]; autoplay: boolean }) {
  const l = useL();
  const t = useDict(site);
  const tc = useDict(common);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;
  const go = useCallback((n: number) => setI(((n % count) + count) % count), [count]);
  // Only slides that are showing (or next up) get an image, so a phone downloads one photo first, not all of them.
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (i >= count) setI(0);
  }, [count, i]);

  useEffect(() => {
    setSeen((prev) => (prev.has(i) && prev.has((i + 1) % count) ? prev : new Set([...prev, i, (i + 1) % count])));
  }, [i, count]);

  if (!count) return null;
  const s = slides[Math.min(i, count - 1)];

  return (
    <section
      className="relative isolate h-[calc(100svh-36px)] min-h-[600px] max-h-[1000px] overflow-hidden bg-ink sm:min-h-[640px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }}
      onTouchEnd={(e) => {
        const start = touch.current;
        touch.current = null;
        if (!start || count < 2) return;
        const dx = e.changedTouches[0].clientX - start.x;
        const dy = e.changedTouches[0].clientY - start.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) go(i + (dx < 0 ? 1 : -1));
      }}
    >
      {/* Images */}
      {slides.map((sl, k) => {
        const portrait = portraitOf(sl.image);
        return (
          <div key={sl.id} className={cn('absolute inset-0 -z-20 transition-opacity duration-[1400ms] ease-out', k === i ? 'opacity-100' : 'opacity-0')} aria-hidden={k !== i}>
            {seen.has(k) && (
              <picture>
                {portrait && <source media="(max-width: 767px)" srcSet={portrait} />}
                <img
                  src={sl.image}
                  alt=""
                  fetchPriority={k === 0 ? 'high' : 'low'}
                  decoding={k === 0 ? 'sync' : 'async'}
                  className={cn('h-full w-full object-cover will-change-transform', k === i ? 'animate-[kenburns_9s_ease-out_both]' : '')}
                />
              </picture>
            )}
          </div>
        );
      })}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink/80 via-ink/40 to-ink/5" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/70 via-transparent to-ink/30" />

      <div className="container-x flex h-full flex-col justify-end pb-36 pt-28 sm:pt-32">
        {/* initial={false}: the first slide's copy is on screen immediately (fast first paint); later slides animate in. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={s.id} initial="hidden" animate="show" exit="exit" className="max-w-3xl">
            <motion.div
              variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, delay: 0.1 } }, exit: { opacity: 0, y: -8, transition: { duration: 0.25 } } }}
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[11.5px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur-md"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
              {l(s.eyebrow)}
            </motion.div>
            <motion.h1
              variants={{ hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { duration: 0.9, delay: 0.18, ease: [0.16, 1, 0.3, 1] } }, exit: { opacity: 0, y: -10, transition: { duration: 0.25 } } }}
              className="display text-shadow-soft text-[46px] leading-[0.98] text-white sm:text-7xl lg:text-[92px]"
            >
              <Accent text={l(s.title)} accentClassName="text-brand-200!" />
            </motion.h1>
            <motion.p
              variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.8, delay: 0.3 } }, exit: { opacity: 0, transition: { duration: 0.2 } } }}
              className="mt-6 max-w-xl text-[17px] leading-relaxed text-white/85 sm:text-lg"
            >
              {l(s.subtitle)}
            </motion.p>
            <motion.div
              variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, delay: 0.42 } }, exit: { opacity: 0, transition: { duration: 0.2 } } }}
              className="mt-9 flex flex-wrap gap-3"
            >
              {l(s.primary.label) && (
                <CtaLink to={s.primary.href} size="lg" icon={isBookingHref(s.primary.href) ? <Eye className="h-4 w-4" /> : undefined} iconRight={isBookingHref(s.primary.href) ? undefined : <ArrowRight className="h-4 w-4" />}>
                  {l(s.primary.label)}
                </CtaLink>
              )}
              {l(s.secondary.label) && (
                <CtaLink to={s.secondary.href} size="lg" variant="outlineLight" icon={isBookingHref(s.secondary.href) ? <Eye className="h-4 w-4" /> : isTryOnHref(s.secondary.href) ? <ScanFace className="h-4 w-4" /> : undefined}>
                  {l(s.secondary.label)}
                </CtaLink>
              )}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controls */}
      {count > 1 && (
        <div className="absolute bottom-[86px] right-0 w-full sm:bottom-32">
          <div className="container-x flex items-center justify-start gap-5 sm:justify-end">
            <span className="font-display text-sm tabular-nums text-white/80">
              <span className="text-white">{String(i + 1).padStart(2, '0')}</span> / {String(count).padStart(2, '0')}
            </span>
            <div className="flex gap-1">
              {slides.map((sl, k) => (
                <button key={sl.id} onClick={() => go(k)} className="group grid h-10 w-12 place-items-center sm:w-14" aria-label={tc('slideN', { n: k + 1 })} aria-current={k === i}>
                  <span className="relative h-[3px] w-full overflow-hidden rounded-full bg-white/25">
                    <span
                      className={cn('absolute inset-y-0 left-0 rounded-full bg-white', k < i || (k === i && !autoplay) ? 'w-full' : 'w-0')}
                      style={k === i && autoplay ? { animation: `heroprogress ${DURATION}ms linear forwards`, animationPlayState: paused ? 'paused' : 'running' } : undefined}
                      onAnimationEnd={k === i && autoplay ? () => go(i + 1) : undefined}
                    />
                  </span>
                </button>
              ))}
            </div>
            <div className="hidden gap-2 md:flex">
              <button onClick={() => go(i - 1)} className="grid h-11 w-11 place-items-center rounded-full border border-white/30 text-white backdrop-blur transition hover:bg-white hover:text-ink" aria-label={tc('prev')}>
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button onClick={() => go(i + 1)} className="grid h-11 w-11 place-items-center rounded-full border border-white/30 text-white backdrop-blur transition hover:bg-white hover:text-ink" aria-label={tc('next')}>
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <Link to="/produktet" className="sr-only">
        {t('allProducts')}
      </Link>
    </section>
  );
}
