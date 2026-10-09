import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Images, MapPin, Maximize2 } from 'lucide-react';
import type { Project } from '@/lib/types';
import { EmptyState, Img, Reveal } from '@/components/ui/misc';
import { PageHero } from '@/site/components/SectionHeading';
import { usePageTitle } from '@/site/layout/SiteLayout';
import { CtaBand } from '@/site/components/company/Blocks';
import { ProjectLightbox } from '@/site/components/company/ProjectLightbox';
import { useHomeData } from '@/site/components/company/data';
import { defineDict, useDict, useL, useLang } from '@/i18n';
import { site } from '@/i18n/site';
import { useDb } from '@/store/db';
import { cn } from '@/lib/utils';

const T = defineDict({
  me: {
    eyebrow: 'Lookbook',
    title: 'Naočare koje *pričaju priču*',
    subtitle: 'Kampanje i portreti iz naše optike — okviri, sunce i ljudi koji ih nose.',
    statProjects: 'Priča',
    statCities: 'Lokacija',
    statYears: 'Sezone',
    all: 'Sve',
    filter: 'Filtriraj po temi',
    showing: 'Prikazano {n} od {total}',
    view: 'Otvori priču',
    emptyTitle: 'Uskoro nove priče',
    emptyText: 'Lookbook se upravo dopunjava novom kampanjom. Svratite ponovo za nekoliko dana.',
  },
  sq: {
    eyebrow: 'Lookbook',
    title: 'Syze që *tregojnë një histori*',
    subtitle: 'Fushata dhe portrete nga optika jonë — korniza, diell dhe njerëzit që i mbajnë.',
    statProjects: 'Histori',
    statCities: 'Vende',
    statYears: 'Sezone',
    all: 'Të gjitha',
    filter: 'Filtro sipas temës',
    showing: 'Shfaqen {n} nga {total}',
    view: 'Hap historinë',
    emptyTitle: 'Së shpejti histori të reja',
    emptyText: 'Lookbook-u po plotësohet me një fushatë të re. Na vizitoni sërish pas disa ditësh.',
  },
  en: {
    eyebrow: 'Lookbook',
    title: 'Eyewear with *a story to tell*',
    subtitle: 'Campaigns and portraits from our store — frames, sunshine and the people who wear them.',
    statProjects: 'Stories',
    statCities: 'Locations',
    statYears: 'Seasons',
    all: 'All',
    filter: 'Filter by theme',
    showing: 'Showing {n} of {total}',
    view: 'Open story',
    emptyTitle: 'New stories coming soon',
    emptyText: 'The lookbook is being updated with a new campaign. Please check back in a few days.',
  },
});

/* ------------------------------------------------------------------ */
/* Bento layout                                                        */
/* Blocks of three tile a 12-column grid with no holes: one large      */
/* (7 cols × 2 rows) + two small (5 cols), mirrored every other block. */
/* Leftovers become 7/5 pairs so the last row is always full.          */
/* ------------------------------------------------------------------ */
type Size = 'big' | 'small' | 'pairWide' | 'pairNarrow' | 'solo';

function bento(n: number): Size[] {
  if (n === 1) return ['solo'];
  const out: Size[] = [];
  const rem = n % 3;
  // with one leftover, the last full block + leftover form two 7/5 pairs
  const blocks = Math.floor(n / 3) - (rem === 1 ? 1 : 0);
  for (let b = 0; b < blocks; b++) out.push(...((b % 2 === 0 ? ['big', 'small', 'small'] : ['small', 'big', 'small']) as Size[]));
  const pairs = rem === 1 ? 2 : rem === 2 ? 1 : 0;
  for (let k = 0; k < pairs; k++) {
    const mirror = (blocks + k) % 2 === 1;
    out.push(...((mirror ? ['pairNarrow', 'pairWide'] : ['pairWide', 'pairNarrow']) as Size[]));
  }
  return out;
}

const SPAN: Record<Size, string> = {
  big: 'sm:col-span-2 lg:col-span-7 lg:row-span-2',
  solo: 'sm:col-span-2 lg:col-span-12 lg:row-span-2',
  small: 'lg:col-span-5',
  pairWide: 'lg:col-span-7',
  pairNarrow: 'lg:col-span-5',
};

const ASPECT: Record<Size, string> = {
  big: 'aspect-[4/5] sm:aspect-[16/10]',
  solo: 'aspect-[4/5] sm:aspect-[16/10]',
  small: 'aspect-[5/4] sm:aspect-[4/5]',
  pairWide: 'aspect-[5/4] sm:aspect-[4/5]',
  pairNarrow: 'aspect-[5/4] sm:aspect-[4/5]',
};

function ProjectTile({ project: p, size, onOpen }: { project: Project; size: Size; onOpen: () => void }) {
  const l = useL();
  const t = useDict(T);
  const big = size === 'big' || size === 'solo';
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${t('view')}: ${l(p.title)}`}
      className={cn('group relative block w-full overflow-hidden rounded-3xl bg-ink text-left lg:aspect-auto lg:h-full', ASPECT[size])}
    >
      <Img
        src={p.image}
        small={!big}
        alt={l(p.title)}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.4s] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.06]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/15 to-transparent" />
      <div className="absolute inset-0 bg-ink/0 transition-colors duration-500 group-hover:bg-ink/30" />

      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-5 sm:p-6">
        <div className="flex flex-wrap gap-1.5">
          {p.tags.map((tg, k) => (
            <span key={k} className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-white/10 backdrop-blur-md">
              {l(tg)}
            </span>
          ))}
        </div>
        <span className="grid h-11 w-11 shrink-0 translate-y-1 scale-90 place-items-center rounded-full bg-white text-ink opacity-0 shadow-lg transition-all duration-500 group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 group-focus-visible:opacity-100">
          <Maximize2 className="h-4 w-4" />
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
        <div className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.16em] text-white/70">
          <MapPin className="h-3.5 w-3.5" />
          {p.location} · {p.year}
        </div>
        <h3 className={cn('display mt-2 max-w-xl leading-[1.08] text-white', big ? 'text-[28px] sm:text-[38px] lg:text-[44px]' : 'text-[24px] sm:text-[28px]')}>{l(p.title)}</h3>
        <div className="grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(.16,1,.3,1)] group-hover:grid-rows-[1fr] group-hover:opacity-100">
          <div className="overflow-hidden">
            <p className="max-w-lg pt-2.5 text-[14.5px] leading-relaxed text-white/80">{l(p.summary)}</p>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function Projects() {
  const ts = useDict(site);
  const t = useDict(T);
  const l = useL();
  const lang = useLang();
  const all = useDb((s) => s.projects);
  const head = useHomeData('projects');
  usePageTitle(ts('nav_projects'));

  // Selected tag is remembered together with the language it was picked in,
  // so switching language simply falls back to "all".
  const [sel, setSel] = useState<{ lang: string; label: string } | null>(null);
  const active = sel && sel.lang === lang ? sel.label : null;
  // Homepage lookbook cards link to /lookbook?p=<id> — open that story straight away.
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(() => all.some((p) => p.id === params.get('p')));
  const [index, setIndex] = useState(() => Math.max(0, all.findIndex((p) => p.id === params.get('p'))));
  const close = () => {
    setOpen(false);
    if (params.has('p')) setParams({}, { replace: true, preventScrollReset: true });
  };

  const tags = useMemo(() => {
    const m = new Map<string, number>();
    all.forEach((p) => {
      const seen = new Set<string>();
      p.tags.forEach((tg) => {
        const label = l(tg).trim();
        if (!label || seen.has(label)) return;
        seen.add(label);
        m.set(label, (m.get(label) ?? 0) + 1);
      });
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([label, count]) => ({ label, count }));
  }, [all, l]);

  const list = useMemo(() => (active ? all.filter((p) => p.tags.some((tg) => l(tg).trim() === active)) : all), [all, active, l]);
  const sizes = useMemo(() => bento(list.length), [list.length]);

  const facts = useMemo(() => {
    const cities = new Set(all.map((p) => p.location.trim()).filter(Boolean)).size;
    const years = all.map((p) => p.year).filter(Boolean);
    const min = Math.min(...years);
    const max = Math.max(...years);
    return [
      { value: String(all.length), label: t('statProjects') },
      { value: String(cities), label: t('statCities') },
      { value: years.length ? (min === max ? String(min) : `${min}–${String(max).slice(2)}`) : '—', label: t('statYears') },
    ];
  }, [all, t]);

  const chip = (on: boolean) =>
    cn(
      'inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold transition-colors',
      on ? 'bg-ink text-paper' : 'bg-white text-ink-soft ring-1 ring-line hover:text-ink hover:ring-ink/30',
    );

  return (
    <>
      <PageHero
        crumbs={[{ label: ts('nav_projects') }]}
        eyebrow={head ? l(head.eyebrow) : t('eyebrow')}
        title={head ? l(head.title) : t('title')}
        subtitle={head && l(head.subtitle) ? l(head.subtitle) : t('subtitle')}
      >
        {all.length > 0 && (
          <ul className="mt-10 flex flex-wrap gap-x-12 gap-y-6">
            {facts.map((f) => (
              <li key={f.label} className="border-l-2 border-brand-600 pl-4">
                <div className="display text-[40px] leading-none text-ink">{f.value}</div>
                <div className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">{f.label}</div>
              </li>
            ))}
          </ul>
        )}
      </PageHero>

      {all.length === 0 ? (
        <div className="container-x py-16">
          <EmptyState icon={<Images className="h-6 w-6" />} title={t('emptyTitle')} text={t('emptyText')} />
        </div>
      ) : (
        <>
          {/* Filter bar */}
          <div className="sticky top-[76px] z-30 border-b border-line bg-paper/90 backdrop-blur-xl">
            <div className="container-x flex items-center gap-4 py-3">
              <div role="group" aria-label={t('filter')} className="no-scrollbar -mx-4 flex flex-1 gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
                <button type="button" aria-pressed={!active} onClick={() => setSel(null)} className={chip(!active)}>
                  {t('all')}
                  <span className={cn('text-[12px] tabular-nums', !active ? 'text-paper/55' : 'text-muted')}>{all.length}</span>
                </button>
                {tags.map((tg) => {
                  const on = active === tg.label;
                  return (
                    <button key={tg.label} type="button" aria-pressed={on} onClick={() => setSel(on ? null : { lang, label: tg.label })} className={chip(on)}>
                      {tg.label}
                      <span className={cn('text-[12px] tabular-nums', on ? 'text-paper/55' : 'text-muted')}>{tg.count}</span>
                    </button>
                  );
                })}
              </div>
              <div className="hidden shrink-0 text-[13px] text-muted md:block">{t('showing', { n: list.length, total: all.length })}</div>
            </div>
          </div>

          {/* Bento grid */}
          <section className="pb-4 pt-10 sm:pt-14">
            <div className="container-x">
              <div key={active ?? '*'} className="grid grid-cols-1 gap-4 sm:grid-flow-row-dense sm:grid-cols-2 lg:auto-rows-[300px] lg:grid-flow-row lg:grid-cols-12 lg:gap-6">
                {list.map((p, i) => (
                  <Reveal key={p.id} delay={(i % 3) * 90} className={SPAN[sizes[i]]}>
                    <ProjectTile
                      project={p}
                      size={sizes[i]}
                      onOpen={() => {
                        setIndex(i);
                        setOpen(true);
                      }}
                    />
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      <CtaBand image="/images/hero/family.webp" />

      <ProjectLightbox projects={list} index={index} open={open} onClose={close} onIndex={setIndex} />
    </>
  );
}
