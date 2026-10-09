import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowRight, ArrowUpRight, CalendarCheck, ChevronDown, Phone, Search, SearchX, Sparkles, X } from 'lucide-react';
import type { Product } from '@/lib/types';
import { Accent, Img } from '@/components/ui/misc';
import { Button } from '@/components/ui/Button';
import { openBooking } from '@/site/components/utility/Booking';
import { EYEWEAR_SEARCHES } from '@/site/components/shop/searches';
import { Breadcrumbs } from '@/site/components/SectionHeading';
import { usePageTitle } from '@/site/layout/SiteLayout';
import { CategoryTiles } from '@/site/components/utility/CategoryTiles';
import { ProductGrid } from '@/site/components/utility/ProductGrid';
import { CtaBand } from '@/site/components/utility/CtaBand';
import { diverseBestsellers, pluralOne } from '@/site/components/utility/shared';
import { defineDict, useDict, useL, useLang } from '@/i18n';
import { useActiveProducts, useCategories, useSettings } from '@/store/hooks';
import { searchProducts } from '@/lib/search';
import { basePrice } from '@/lib/pricing';
import { cn } from '@/lib/utils';

const T = defineDict({
  me: {
    title: 'Pretraga',
    eyebrow: 'Pretražite ponudu',
    placeholder: 'Šta tražite?',
    submit: 'Traži',
    clear: 'Obriši pretragu',
    resultOne: '{n} rezultat',
    resultMany: '{n} rezultata',
    forQuery: 'za „{q}“',
    productOne: '{n} proizvod',
    productMany: '{n} proizvoda',
    startCount: 'Pretražite {count} — dioptrijske okvire, naočare za sunce i sočiva.',
    inCategories: 'Kategorije',
    all: 'Sve',
    wholeCategory: 'Cijela kategorija',
    sortLabel: 'Sortiraj',
    sort_relevance: 'Najrelevantnije',
    sort_popular: 'Najprodavanije',
    sort_priceAsc: 'Cijena: od najniže',
    sort_priceDesc: 'Cijena: od najviše',
    popular: 'Popularne pretrage',
    startTitle: 'Odakle *počinjemo*?',
    startText: 'Izaberite popularnu pretragu ili krenite od kategorije.',
    browse: 'Pregledajte *kategorije*',
    allProducts: 'Svi proizvodi',
    noTitle: 'Nismo pronašli *ništa*',
    noText: 'Za „{q}“ trenutno nemamo proizvod. Proverite pravopis ili probajte opštiji pojam — pretraga razume albanski, engleski i srpski.',
    tryPopular: 'Probajte neku od popularnih pretraga',
    bestsellers: 'Kupci najčešće *biraju*',
    related: 'Možda vas *zanima* i ovo',
    customEyebrow: 'U optici',
    customTitle: 'Niste pronašli *pravi okvir*?',
    customText: 'U optici imamo još modela, a sočiva po vašem receptu izrađujemo u našoj laboratoriji. Zakažite pregled ili nas pozovite — pomoći ćemo vam da izaberete.',
    customCta: 'Zakaži pregled',
  },
  sq: {
    title: 'Kërkimi',
    eyebrow: 'Kërkoni në katalog',
    placeholder: 'Çfarë kërkoni?',
    submit: 'Kërko',
    clear: 'Pastro kërkimin',
    resultOne: '{n} rezultat',
    resultMany: '{n} rezultate',
    forQuery: 'për „{q}“',
    productOne: '{n} produkt',
    productMany: '{n} produkte',
    startCount: 'Kërkoni ndër {count} — korniza optike, syze dielli dhe lente me recetë.',
    inCategories: 'Kategoritë',
    all: 'Të gjitha',
    wholeCategory: 'E gjithë kategoria',
    sortLabel: 'Rendit',
    sort_relevance: 'Më të përshtatshmet',
    sort_popular: 'Më të shiturat',
    sort_priceAsc: 'Çmimi: nga më i ulëti',
    sort_priceDesc: 'Çmimi: nga më i larti',
    popular: 'Kërkimet popullore',
    startTitle: 'Nga *fillojmë*?',
    startText: 'Zgjidhni një kërkim popullor ose nisni nga një kategori.',
    browse: 'Shfletoni *kategoritë*',
    allProducts: 'Të gjitha produktet',
    noTitle: 'Nuk gjetëm *asgjë*',
    noText: 'Për „{q}“ nuk kemi produkt për momentin. Kontrolloni drejtshkrimin ose provoni një term më të përgjithshëm — kërkimi kupton shqip, anglisht dhe serbisht.',
    tryPopular: 'Provoni një nga kërkimet popullore',
    bestsellers: 'Klientët më shpesh *zgjedhin*',
    related: 'Mund t’ju *interesojë* edhe',
    customEyebrow: 'Në optikë',
    customTitle: 'Nuk e gjetët *kornizën e duhur*?',
    customText: 'Në optikë kemi edhe më shumë modele, ndërsa lentet sipas recetës suaj i punojmë në laboratorin tonë. Rezervoni kontrollin ose na telefononi — ju ndihmojmë të zgjidhni.',
    customCta: 'Rezervo kontrollin',
  },
  en: {
    title: 'Search',
    eyebrow: 'Search the range',
    placeholder: 'What are you looking for?',
    submit: 'Search',
    clear: 'Clear search',
    resultOne: '{n} result',
    resultMany: '{n} results',
    forQuery: 'for “{q}”',
    productOne: '{n} product',
    productMany: '{n} products',
    startCount: 'Search {count} — optical frames, sunglasses and prescription lenses.',
    inCategories: 'Categories',
    all: 'All',
    wholeCategory: 'Whole category',
    sortLabel: 'Sort',
    sort_relevance: 'Best match',
    sort_popular: 'Bestselling',
    sort_priceAsc: 'Price: low to high',
    sort_priceDesc: 'Price: high to low',
    popular: 'Popular searches',
    startTitle: 'Where shall we *start*?',
    startText: 'Pick a popular search or start from a category.',
    browse: 'Browse by *category*',
    allProducts: 'All products',
    noTitle: 'We found *nothing*',
    noText: 'We don’t have anything for “{q}” right now. Check the spelling or try a broader term — search understands Albanian, English and Serbian.',
    tryPopular: 'Try one of these popular searches',
    bestsellers: 'Customer *favourites*',
    related: 'You may *also like*',
    customEyebrow: 'At the store',
    customTitle: 'Haven’t found the *right frame*?',
    customText: 'There are more models at the store, and we make lenses to your prescription in our own lab. Book an eye exam or give us a call — we’ll help you choose.',
    customCta: 'Book an eye exam',
  },
});

type Sort = 'relevance' | 'popular' | 'priceAsc' | 'priceDesc';
const SORTS: Sort[] = ['relevance', 'popular', 'priceAsc', 'priceDesc'];

function sortProducts(list: Product[], sort: Sort) {
  switch (sort) {
    case 'popular':
      return [...list].sort((a, b) => b.sold - a.sold);
    case 'priceAsc':
      return [...list].sort((a, b) => basePrice(a) - basePrice(b));
    case 'priceDesc':
      return [...list].sort((a, b) => basePrice(b) - basePrice(a));
    default:
      return list;
  }
}

/** Two-way sync between the search box and `?q=` (debounced, replaces history). */
function useQueryParam() {
  const [params, setParams] = useSearchParams();
  const urlQ = params.get('q') ?? '';
  const [value, setValue] = useState(urlQ);
  const [pushed, setPushed] = useState(urlQ);
  const [seen, setSeen] = useState(urlQ);

  // The URL changed from outside (header search overlay, back button) → adopt it.
  if (urlQ !== seen) {
    setSeen(urlQ);
    if (urlQ !== pushed) {
      setPushed(urlQ);
      setValue(urlQ);
    }
  }

  useEffect(() => {
    const v = value.trim();
    if (v === pushed) return;
    const id = window.setTimeout(() => {
      setPushed(v);
      setParams(v ? { q: v } : {}, { replace: true, preventScrollReset: true });
    }, 280);
    return () => window.clearTimeout(id);
  }, [value, pushed, setParams]);

  return { value, setValue, urlQ };
}

export default function SearchPage() {
  const t = useDict(T);
  const l = useL();
  const lang = useLang();
  const settings = useSettings();
  const products = useActiveProducts();
  const cats = useCategories();
  const { value, setValue, urlQ } = useQueryParam();
  const input = useRef<HTMLInputElement>(null);
  const [sort, setSort] = useState<Sort>('relevance');
  const [catFilter, setCatFilter] = useState<string | null>(null);

  usePageTitle(urlQ ? `${t('title')}: ${urlQ}` : t('title'));

  const q = useDeferredValue(value.trim());
  const results = useMemo(() => searchProducts(products, cats, q, lang), [products, cats, q, lang]);

  // Categories the results fall into, most hits first
  const groups = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of results) m.set(p.categoryId, (m.get(p.categoryId) ?? 0) + 1);
    return cats.filter((c) => m.has(c.id)).map((c) => ({ cat: c, n: m.get(c.id)! })).sort((a, b) => b.n - a.n);
  }, [results, cats]);

  const activeCat = groups.find((g) => g.cat.id === catFilter)?.cat ?? null;
  const shown = useMemo(
    () => sortProducts(activeCat ? results.filter((p) => p.categoryId === activeCat.id) : results, sort),
    [results, activeCat, sort],
  );

  const popular = useMemo(
    () => EYEWEAR_SEARCHES[lang].map((term) => ({ term, n: searchProducts(products, cats, term, lang).length })).filter((s) => s.n > 0),
    [products, cats, lang],
  );
  const bestsellers = useMemo(() => diverseBestsellers(products, 4), [products]);
  // Few hits → suggest neighbours from the same categories so the page never feels thin
  const related = useMemo(() => {
    if (results.length === 0 || results.length >= 8) return [];
    const ids = new Set(results.map((p) => p.id));
    const catIds = new Set(results.map((p) => p.categoryId));
    return products.filter((p) => catIds.has(p.categoryId) && !ids.has(p.id)).sort((a, b) => b.sold - a.sold).slice(0, 4);
  }, [results, products]);

  const count = (n: number, one: 'resultOne' | 'productOne', many: 'resultMany' | 'productMany') => t(pluralOne(n, lang) ? one : many, { n });

  const pickSuggestion = (term: string) => {
    setValue(term);
    setCatFilter(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasQuery = q.length > 0;
  const noResults = hasQuery && results.length === 0;

  return (
    <>
      {/* ---------------------------------------------------------------- Search header */}
      <section className="border-b border-line bg-paper">
        <div className="container-x pb-8 pt-8 sm:pb-10 sm:pt-12">
          <Breadcrumbs items={[{ label: t('title') }]} />
          <h1 className="sr-only">{urlQ ? `${t('title')}: ${urlQ}` : t('title')}</h1>
          <div className="eyebrow mb-4 mt-8 sm:mt-10">{t('eyebrow')}</div>

          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              input.current?.blur();
            }}
            className="group flex items-center gap-3 border-b-2 border-ink/80 pb-3 transition-colors focus-within:border-brand-600 sm:gap-5 sm:pb-4"
          >
            <Search className="h-6 w-6 shrink-0 text-muted transition-colors group-focus-within:text-brand-600 sm:h-9 sm:w-9" strokeWidth={1.75} />
            <input
              ref={input}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t('placeholder')}
              aria-label={t('placeholder')}
              autoFocus={!value}
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              className="display min-w-0 flex-1 bg-transparent text-[30px] leading-tight text-ink outline-none placeholder:text-muted/45 sm:text-[52px] lg:text-[60px]"
            />
            {value && (
              <button
                type="button"
                onClick={() => {
                  setValue('');
                  input.current?.focus();
                }}
                aria-label={t('clear')}
                title={t('clear')}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-soft transition-colors hover:bg-ink/[0.06] hover:text-ink sm:h-12 sm:w-12"
              >
                <X className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            )}
            <button
              type="submit"
              className="hidden h-12 shrink-0 items-center gap-2 rounded-full bg-ink px-6 text-[14px] font-semibold text-paper transition-colors hover:bg-brand-600 sm:inline-flex"
            >
              {t('submit')}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Summary + sort */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <p className="text-[15px] text-muted" aria-live="polite">
              {hasQuery ? (
                <>
                  <span className="font-bold text-ink">{count(results.length, 'resultOne', 'resultMany')}</span> {t('forQuery', { q })}
                </>
              ) : (
                t('startCount', { count: count(products.length, 'productOne', 'productMany') })
              )}
            </p>
            {results.length > 1 && (
              <label className="relative inline-flex items-center gap-2 text-[13.5px] text-muted">
                <span className="hidden sm:inline">{t('sortLabel')}:</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className="h-10 cursor-pointer appearance-none rounded-full border border-line bg-white pl-4 pr-10 text-[13.5px] font-semibold text-ink outline-none transition-colors hover:border-ink/30 focus:border-ink/40"
                >
                  {SORTS.map((s) => (
                    <option key={s} value={s}>
                      {t(`sort_${s}`)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 h-4 w-4 text-muted" />
              </label>
            )}
          </div>

          {/* Matching categories */}
          {groups.length > 0 && (
            <div className="no-scrollbar -mx-4 mt-6 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
              <span className="mr-1 hidden shrink-0 text-[11px] font-bold uppercase tracking-[0.18em] text-muted sm:inline">{t('inCategories')}</span>
              <Chip active={!activeCat} onClick={() => setCatFilter(null)}>
                {t('all')} <span className="tabular-nums opacity-60">{results.length}</span>
              </Chip>
              {groups.map(({ cat, n }) => (
                <Chip key={cat.id} active={activeCat?.id === cat.id} onClick={() => setCatFilter(activeCat?.id === cat.id ? null : cat.id)} image={cat.image}>
                  {l(cat.name)} <span className="tabular-nums opacity-60">{n}</span>
                </Chip>
              ))}
              {activeCat && (
                <Link to={`/produktet/${activeCat.slug}`} className="ml-1 inline-flex shrink-0 items-center gap-1 text-[13.5px] font-semibold text-brand-700 hover:text-brand-800">
                  {t('wholeCategory')} <ArrowUpRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------------- Body */}
      <div className="container-x pt-12 sm:pt-16">
        {hasQuery && !noResults && <ProductGrid products={shown} />}

        {related.length > 0 && (
          <section className="mt-16 border-t border-line pt-12 sm:mt-20 sm:pt-16">
            <h2 className="display mb-8 text-[30px] leading-[1.05] text-ink sm:text-[40px]">
              <Accent text={t('related')} />
            </h2>
            <ProductGrid products={related} />
          </section>
        )}

        {noResults && (
          <div className="grid items-start gap-8 lg:grid-cols-12 lg:gap-12">
            <div className="animate-fade-up lg:col-span-5">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                <SearchX className="h-6 w-6" />
              </span>
              <h2 className="display mt-6 text-[38px] leading-[1.04] text-ink sm:text-[48px]">
                <Accent text={t('noTitle')} />
              </h2>
              <p className="mt-4 max-w-md text-[16px] leading-relaxed text-muted">{t('noText', { q })}</p>
            </div>
            <div className="animate-fade-up rounded-3xl border border-line bg-white p-5 [animation-delay:80ms] sm:p-8 lg:col-span-7">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
                <Sparkles className="h-3.5 w-3.5 text-brand-600" /> {t('tryPopular')}
              </div>
              <Suggestions items={popular} onPick={pickSuggestion} className="mt-5" />
            </div>
          </div>
        )}

        {!hasQuery && (
          <div className="grid items-start gap-8 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-5">
              <h2 className="display text-[34px] leading-[1.05] text-ink sm:text-[44px]">
                <Accent text={t('startTitle')} />
              </h2>
              <p className="mt-3 max-w-md text-[16px] leading-relaxed text-muted">{t('startText')}</p>
            </div>
            <div className="lg:col-span-7">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">{t('popular')}</div>
              <Suggestions items={popular} onPick={pickSuggestion} className="mt-4" />
            </div>
          </div>
        )}

        {(noResults || !hasQuery) && (
          <section className="mt-16 sm:mt-20">
            <div className="mb-7 flex items-end justify-between gap-4">
              <h2 className="display text-[30px] leading-[1.05] text-ink sm:text-[40px]">
                <Accent text={t('browse')} />
              </h2>
              <Link to="/produktet" className="inline-flex shrink-0 items-center gap-1.5 text-[14px] font-semibold text-ink hover:text-brand-700">
                {t('allProducts')} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <CategoryTiles />
          </section>
        )}

        {noResults && bestsellers.length > 0 && (
          <section className="mt-16 sm:mt-20">
            <h2 className="display mb-8 text-[30px] leading-[1.05] text-ink sm:text-[40px]">
              <Accent text={t('bestsellers')} />
            </h2>
            <ProductGrid products={bestsellers} />
          </section>
        )}

        {hasQuery && (
          <CtaBand
            className="mt-16 sm:mt-24"
            image="/images/s/laboratori.webp"
            eyebrow={t('customEyebrow')}
            title={t('customTitle')}
            text={t('customText')}
            actions={
              <>
                <Button variant="light" size="lg" icon={<CalendarCheck className="h-4 w-4" />} onClick={() => openBooking('exam')}>
                  {t('customCta')}
                </Button>
                <a
                  href={`tel:${settings.phone.replace(/[^+\d]/g, '')}`}
                  className="inline-flex h-13 items-center justify-center gap-2.5 rounded-full border border-white/30 px-6 text-[15px] font-semibold text-white transition-colors hover:bg-white/10"
                >
                  <Phone className="h-4 w-4" /> {settings.phone}
                </a>
              </>
            }
          />
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
function Chip({ active, onClick, image, children }: { active: boolean; onClick: () => void; image?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-10 shrink-0 items-center gap-2 rounded-full border text-[13.5px] font-semibold transition-colors',
        image ? 'pl-1 pr-4' : 'px-4',
        active ? 'border-ink bg-ink text-paper' : 'border-line bg-white text-ink hover:border-ink/30',
      )}
    >
      {image && (
        <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-sand">
          <Img src={image} small alt="" className="h-full w-full object-cover" />
        </span>
      )}
      {children}
    </button>
  );
}

function Suggestions({ items, onPick, className }: { items: { term: string; n: number }[]; onPick: (term: string) => void; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {items.map(({ term, n }) => (
        <button
          key={term}
          type="button"
          onClick={() => onPick(term)}
          className="group inline-flex h-10 items-center gap-2 rounded-full border border-line bg-paper/60 pl-3.5 pr-1.5 text-[13.5px] font-semibold sm:h-11 sm:gap-2.5 sm:pl-4 sm:pr-2 sm:text-[14px] text-ink transition-colors hover:border-ink hover:bg-ink hover:text-paper"
        >
          <Search className="h-3.5 w-3.5 text-muted transition-colors group-hover:text-paper/70" />
          {term}
          <span className="grid h-7 min-w-7 place-items-center rounded-full bg-white px-1.5 max-sm:h-6 max-sm:min-w-6 text-[11.5px] font-bold tabular-nums text-muted ring-1 ring-line transition-colors group-hover:bg-white/15 group-hover:text-paper group-hover:ring-transparent">
            {n}
          </span>
        </button>
      ))}
    </div>
  );
}
