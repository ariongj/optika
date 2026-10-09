import { useCallback, useEffect, useRef } from 'react';
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Eye, MapPin, ScanFace, X } from 'lucide-react';
import type { Project } from '@/lib/types';
import { Modal } from '@/components/ui/Overlay';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Img } from '@/components/ui/misc';
import { openBooking } from '@/site/components/utility/Booking';
import { defineDict, useDict, useL } from '@/i18n';
import { site } from '@/i18n/site';
import { cn } from '@/lib/utils';
import { C } from './Blocks';
import { pad2 } from './data';

const T = defineDict({
  me: {
    location: 'Lokacija',
    year: 'Godina',
    prev: 'Prethodna priča',
    next: 'Sledeća priča',
    close: 'Zatvori',
    similar: 'Sviđa vam se ovaj stil?',
    similarText: 'Isprobajte okvire virtuelno ili svratite u optiku — pomoći ćemo vam da pronađete svoj par.',
    shop: 'Pogledajte kolekciju',
    keys: 'Listajte strelicama ← →',
    more: 'Još priča',
  },
  sq: {
    location: 'Vendi',
    year: 'Viti',
    prev: 'Historia e mëparshme',
    next: 'Historia e radhës',
    close: 'Mbyll',
    similar: 'Ju pëlqen ky stil?',
    similarText: 'Provoni kornizat virtualisht ose ejani në optikë — ju ndihmojmë ta gjeni palën tuaj.',
    shop: 'Shikoni koleksionin',
    keys: 'Shfletoni me ← →',
    more: 'Më shumë histori',
  },
  en: {
    location: 'Location',
    year: 'Year',
    prev: 'Previous story',
    next: 'Next story',
    close: 'Close',
    similar: 'Like this look?',
    similarText: 'Try frames on virtually or drop by the store — we’ll help you find your pair.',
    shop: 'Shop the collection',
    keys: 'Browse with ← →',
    more: 'More stories',
  },
});

/** Full-screen lookbook viewer with prev/next, arrow keys, swipe and a thumbnail strip. */
export function ProjectLightbox({
  projects,
  index,
  open,
  onClose,
  onIndex,
}: {
  projects: Project[];
  index: number;
  open: boolean;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const t = useDict(T);
  const tc = useDict(C);
  const ts = useDict(site);
  const l = useL();
  const n = projects.length;
  const i = Math.min(index, Math.max(0, n - 1));
  const p = projects[i];
  const go = useCallback((d: number) => n > 1 && onIndex((i + d + n) % n), [i, n, onIndex]);

  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [open, go]);

  // Warm the cache for the neighbours so prev/next feels instant
  useEffect(() => {
    if (!open || n < 2) return;
    [projects[(i + 1) % n], projects[(i - 1 + n) % n]].forEach((x) => {
      const img = new Image();
      img.src = x.image;
    });
  }, [open, i, n, projects]);

  // Keep the active thumbnail in view
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const el = strip.current?.querySelector<HTMLElement>(`[data-i="${i}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [open, i]);

  const touchX = useRef<number | null>(null);

  const arrow = 'grid h-12 w-12 place-items-center rounded-full bg-white/90 text-ink shadow-lg backdrop-blur transition hover:scale-105 hover:bg-white';

  return (
    <Modal open={open && !!p} onClose={onClose} size="full">
      {p && (
        <div className="grid lg:h-[min(84vh,760px)] lg:grid-cols-[1.62fr_1fr]">
          {/* Image */}
          <div
            className="relative aspect-[4/3] overflow-hidden bg-ink lg:aspect-auto lg:h-full"
            onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (touchX.current === null) return;
              const dx = e.changedTouches[0].clientX - touchX.current;
              touchX.current = null;
              if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
            }}
          >
            <Img key={p.id} src={p.image} eager alt={l(p.title)} className="absolute inset-0 h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-ink/60 to-transparent" />
            {n > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label={t('prev')} title={t('prev')} className={cn(arrow, 'absolute left-4 top-1/2 -translate-y-1/2')}>
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button type="button" onClick={() => go(1)} aria-label={t('next')} title={t('next')} className={cn(arrow, 'absolute right-4 top-1/2 -translate-y-1/2')}>
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
            <div className="absolute bottom-4 left-4 rounded-full bg-ink/55 px-3 py-1.5 text-[12px] font-bold tabular-nums tracking-[0.16em] text-white ring-1 ring-white/15 backdrop-blur-md">
              {pad2(i + 1)} / {pad2(n)}
            </div>
          </div>

          {/* Details */}
          <div className="flex min-h-0 flex-col p-6 sm:p-8 lg:overflow-y-auto lg:p-10">
            <div key={p.id} className="animate-fade-in">
              <div className="flex flex-wrap gap-1.5 pr-12">
                {p.tags.map((tg, k) => (
                  <span key={k} className="rounded-full bg-sand px-3 py-1 text-[12px] font-semibold text-ink-soft">
                    {l(tg)}
                  </span>
                ))}
              </div>
              <h2 className="display mt-4 text-[30px] leading-[1.06] text-ink sm:text-[38px]">{l(p.title)}</h2>
              <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-line py-5">
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">{t('location')}</dt>
                  <dd className="mt-1.5 flex items-center gap-1.5 text-[15px] font-semibold text-ink">
                    <MapPin className="h-4 w-4 text-brand-600" /> {p.location || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">{t('year')}</dt>
                  <dd className="mt-1.5 flex items-center gap-1.5 text-[15px] font-semibold text-ink">
                    <CalendarDays className="h-4 w-4 text-brand-600" /> {p.year}
                  </dd>
                </div>
              </dl>
              <p className="mt-6 text-[16px] leading-relaxed text-ink-soft">{l(p.summary)}</p>
            </div>

            <div className="mt-8 rounded-2xl bg-sand/70 p-5">
              <div className="font-bold text-ink">{t('similar')}</div>
              <p className="mt-1 text-[14px] leading-relaxed text-muted">{t('similarText')}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <ButtonLink to="/provo-virtualisht" onClick={onClose} size="sm" icon={<ScanFace className="h-3.5 w-3.5" />}>
                  {ts('nav_tryon')}
                </ButtonLink>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Eye className="h-3.5 w-3.5" />}
                  onClick={() => {
                    onClose();
                    openBooking();
                  }}
                >
                  {tc('bookFree')}
                </Button>
              </div>
              <ButtonLink to="/produktet" onClick={onClose} variant="ghost" size="sm" className="-ml-3 mt-2" iconRight={<ArrowRight className="h-3.5 w-3.5" />}>
                {t('shop')}
              </ButtonLink>
            </div>

            {n > 1 && (
              <div className="mt-auto pt-8">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">{t('more')}</span>
                  <span className="hidden text-[12px] text-muted lg:inline">{t('keys')}</span>
                </div>
                <div ref={strip} className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-1">
                  {projects.map((x, k) => (
                    <button
                      key={x.id}
                      type="button"
                      data-i={k}
                      onClick={() => onIndex(k)}
                      aria-label={l(x.title)}
                      aria-current={k === i}
                      className={cn(
                        'relative h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-sand transition',
                        k === i ? 'ring-2 ring-brand-600 ring-offset-2 ring-offset-white' : 'opacity-55 hover:opacity-100',
                      )}
                    >
                      <Img src={x.image} small alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label={t('close')}
        title={t('close')}
        className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink shadow-md backdrop-blur transition hover:bg-white lg:right-4 lg:top-4"
      >
        <X className="h-5 w-5" />
      </button>
    </Modal>
  );
}
