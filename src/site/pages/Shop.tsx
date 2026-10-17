import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { ArrowRight, Compass, Percent, RotateCcw, SearchX } from 'lucide-react';
import { ProductCard } from '@/site/components/ProductCard';
import { usePageTitle } from '@/site/layout/SiteLayout';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Overlay';
import { EmptyState } from '@/components/ui/misc';
import { useDict, useL, useLang } from '@/i18n';
import { site } from '@/i18n/site';
import { common } from '@/i18n/common';
import { useActiveProducts, useCategories } from '@/store/hooks';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { T, countLabel } from '@/site/components/shop/dict';
import {
  EMPTY_FILTERS,
  FAMILY_SWATCH,
  activeCount,
  computeFacets,
  passes,
  productColors,
  sortFromParam,
  sortProducts,
  sortToParam,
  type Filters,
  type MatchCtx,
  type SortKey,
} from '@/site/components/shop/filters';
import { AllHeader, CategoryBanner, CategoryChips, shopHref } from '@/site/components/shop/ShopHeader';
import { FilterPanel, useShapeLabel } from '@/site/components/shop/FilterPanel';
import { DensityToggle, FilterButton, FilterPills, SortSelect, type Pill } from '@/site/components/shop/Toolbar';
import { HelpBand } from '@/site/components/shop/HelpBand';

const PAGE = 24;
const DENSITY_KEY = 'optika-shop-cols';

function readDensity(): 3 | 4 {
  try {
    return localStorage.getItem(DENSITY_KEY) === '3' ? 3 : 4;
  } catch {
    return 4;
  }
}

export default function Shop() {
  const { category } = useParams();
  // Remount per category so local filters (price, shapes, colours…) start fresh.
  return <ShopView key={category ?? '*'} slug={category} />;
}

function ShopView({ slug }: { slug?: string }) {
  const t = useDict(T);
  const ts = useDict(site);
  const tc = useDict(common);
  const l = useL();
  const lang = useLang();
  const shapeLabel = useShapeLabel();
  const categories = useCategories();
  const products = useActiveProducts();
  const [params, setParams] = useSearchParams();

  const category = slug ? categories.find((c) => c.slug === slug) : undefined;
  const sale = params.get('akcija') === '1';
  const sort = sortFromParam(params.get('sort'));

  usePageTitle(category ? l(category.name) : slug ? t('notFoundTitle') : sale ? ts('sale') : ts('allProducts'));

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [drawer, setDrawer] = useState(false);
  const [density, setDensityState] = useState<3 | 4>(readDensity);
  const setDensity = (v: 3 | 4) => {
    setDensityState(v);
    try {
      localStorage.setItem(DENSITY_KEY, String(v));
    } catch {
      /* private mode — keep it in memory */
    }
  };

  /* --------------------------- URL state ---------------------------- */
  const patchParams = useCallback(
    (patch: Record<string, string | null>, replace = false) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
          return next;
        },
        { replace, preventScrollReset: true },
      ),
    [setParams],
  );
  const setSale = (v: boolean) => patchParams({ akcija: v ? '1' : null });
  const setSort = (v: SortKey) => patchParams({ sort: sortToParam(v) }, true);

  /* ---------------------------- Derived ----------------------------- */
  const scope = useMemo(() => (category ? products.filter((p) => p.categoryId === category.id) : products), [products, category]);
  const ctx: MatchCtx = useMemo(() => ({ sale, colors: new Map(scope.map((p) => [p.id, productColors(p)])) }), [scope, sale]);
  const results = useMemo(() => sortProducts(scope.filter((p) => passes(p, filters, ctx)), sort, l, lang), [scope, filters, ctx, sort, l, lang]);
  const facets = useMemo(() => computeFacets(scope, filters, ctx, categories), [scope, filters, ctx, categories]);
  const nActive = activeCount(filters, sale);

  // "Show more" pagination — resets whenever the result set changes
  const sig = `${JSON.stringify(filters)}|${sale}|${sort}`;
  const [paging, setPaging] = useState({ sig, n: PAGE });
  const limit = paging.sig === sig ? paging.n : PAGE;
  const shown = results.slice(0, limit);

  // Close the drawer when the layout switches to desktop
  useEffect(() => {
    if (!drawer) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const fn = () => mq.matches && setDrawer(false);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [drawer]);

  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
    if (sale) setSale(false);
  };

  /* ------------------------- Active pills --------------------------- */
  const pills: Pill[] = [];
  if (sale) pills.push({ key: 'sale', tone: 'brand', label: <><Percent className="h-3.5 w-3.5" /> {t('onSale')}</>, onRemove: () => setSale(false) });
  for (const id of filters.cats) {
    const c = categories.find((x) => x.id === id);
    if (c) pills.push({ key: `c-${id}`, label: l(c.name), onRemove: () => setFilters({ ...filters, cats: filters.cats.filter((x) => x !== id) }) });
  }
  if (filters.price) {
    const [a, b] = filters.price;
    pills.push({ key: 'price', label: `${money(a, lang, { decimals: false })} – ${money(b, lang, { decimals: false })}`, onRemove: () => setFilters({ ...filters, price: null }) });
  }
  for (const s of filters.shapes) {
    const label = facets.shapes.find((x) => x.id === s)?.label;
    pills.push({ key: `s-${s}`, label: shapeLabel(s, label), onRemove: () => setFilters({ ...filters, shapes: filters.shapes.filter((x) => x !== s) }) });
  }
  for (const f of filters.feats) pills.push({ key: `f-${f}`, label: t(`feat_${f}`), onRemove: () => setFilters({ ...filters, feats: filters.feats.filter((x) => x !== f) }) });
  for (const b of filters.badges) pills.push({ key: `b-${b}`, label: tc(`badge_${b}`), onRemove: () => setFilters({ ...filters, badges: filters.badges.filter((x) => x !== b) }) });
  for (const a of filters.avail) pills.push({ key: `a-${a}`, label: t(a === 'stock' ? 'inStock' : a === 'request' ? 'onRequestAvail' : 'toOrder'), onRemove: () => setFilters({ ...filters, avail: filters.avail.filter((x) => x !== a) }) });
  for (const c of filters.colors)
    pills.push({
      key: `col-${c}`,
      label: (
        <>
          <span className="h-3.5 w-3.5 rounded-full shadow-[inset_0_0_0_1px_rgb(28_26_23/0.15)]" style={{ background: FAMILY_SWATCH[c] }} />
          {t(`c_${c}`)}
        </>
      ),
      onRemove: () => setFilters({ ...filters, colors: filters.colors.filter((x) => x !== c) }),
    });

  /* --------------------------- Not found ---------------------------- */
  if (slug && !category) {
    return (
      <div className="container-x py-24">
        <EmptyState
          icon={<Compass className="h-6 w-6" />}
          title={t('notFoundTitle')}
          text={t('notFoundText')}
          action={
            <ButtonLink to="/produktet" variant="dark" iconRight={<ArrowRight className="h-4 w-4" />}>
              {ts('allProducts')}
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const panel = (
    <FilterPanel
      filters={filters}
      setFilters={setFilters}
      sale={sale}
      setSale={setSale}
      facets={facets}
      categories={categories}
      showCategories={!category}
    />
  );

  const saleEmpty = sale && results.length === 0 && scope.length > 0 && facets.sale === 0 && activeCount(filters, false) === 0;

  return (
    <>
      {category ? <CategoryBanner category={category} products={scope} sale={sale} /> : <AllHeader products={products} categories={categories} sale={sale} params={params} />}
      <CategoryChips categories={categories} products={products} active={category?.id ?? null} sale={sale} params={params} onToggleSale={() => setSale(!sale)} />

      <section className="container-x pt-6 lg:pt-10">
        <div className="lg:grid lg:grid-cols-[256px_minmax(0,1fr)] lg:gap-12 xl:gap-14">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block" aria-label={t('filters')}>
            <div className="sticky top-[96px] -mr-4 max-h-[calc(100vh-112px)] overflow-y-auto overscroll-contain pb-6 pr-4 [scrollbar-color:var(--color-sand-2)_transparent] [scrollbar-width:thin]">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">{t('filters')}</h2>
                {nActive > 0 && (
                  <button type="button" onClick={clearAll} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft hover:text-brand-700">
                    <RotateCcw className="h-3.5 w-3.5" /> {t('clear')}
                  </button>
                )}
              </div>
              {panel}
            </div>
          </aside>

          <div className="min-w-0">
            {/* Mobile: sticky filter + sort bar */}
            <div className="sticky top-[76px] z-30 -mx-4 mb-4 flex gap-2 border-b border-line/70 bg-paper/92 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:hidden">
              <FilterButton count={nActive} onClick={() => setDrawer(true)} />
              <SortSelect value={sort} onChange={setSort} compact className="flex-1" />
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <p className="text-[15px] text-muted" aria-live="polite">
                <span className="font-bold text-ink">{countLabel(t, lang, results.length)}</span>
                {nActive > 0 && scope.length !== results.length && <span className="max-sm:hidden"> / {scope.length}</span>}
              </p>
              <div className="hidden items-center gap-2 lg:flex">
                <SortSelect value={sort} onChange={setSort} />
                <DensityToggle value={density} onChange={setDensity} />
              </div>
            </div>
            <FilterPills pills={pills} onClear={clearAll} className="mt-3" />

            {/* Grid */}
            {results.length > 0 ? (
              <>
                {/* outline: page h1 → this h2 → the product-card h3s (the sidebar's h2 is desktop-only) */}
                <h2 className="sr-only">{countLabel(t, lang, results.length)}</h2>
                <div
                  key={`${sort}-${density}`}
                  className={cn('mt-6 grid grid-cols-2 gap-x-3.5 gap-y-9 sm:gap-x-5 md:grid-cols-3 lg:mt-7 lg:gap-x-6 lg:gap-y-12', density === 4 && 'xl:grid-cols-4 xl:gap-x-5')}
                >
                  {shown.map((p, i) => (
                    <div key={p.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i % PAGE, 11) * 45}ms` }}>
                      <ProductCard product={p} priority={i < 8} />
                    </div>
                  ))}
                </div>
                {results.length > shown.length && (
                  <div className="mt-14 flex flex-col items-center">
                    <p className="text-[13px] font-medium text-muted">{t('shownOf', { a: shown.length, b: results.length })}</p>
                    <div className="mt-3 h-[3px] w-52 overflow-hidden rounded-full bg-ink/10">
                      <div className="h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${(shown.length / results.length) * 100}%` }} />
                    </div>
                    <Button variant="outline" size="lg" className="mt-6" onClick={() => setPaging({ sig, n: limit + PAGE })}>
                      {t('loadMore', { n: Math.min(PAGE, results.length - shown.length) })}
                    </Button>
                  </div>
                )}
              </>
            ) : saleEmpty ? (
              <EmptyState
                className="mt-6 rounded-3xl border border-dashed border-line bg-white/50"
                icon={<Percent className="h-6 w-6" />}
                title={t('emptySaleTitle')}
                text={t('emptySaleText')}
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="dark" onClick={() => setSale(false)}>
                      {t('allInCategory')}
                    </Button>
                    <ButtonLink to={shopHref(null, params, { akcija: '1' })} variant="soft">
                      {t('allOnSale')}
                    </ButtonLink>
                  </div>
                }
              />
            ) : (
              <EmptyState
                className="mt-6 rounded-3xl border border-dashed border-line bg-white/50"
                icon={<SearchX className="h-6 w-6" />}
                title={t('emptyTitle')}
                text={t('emptyText')}
                action={
                  <Button variant="dark" icon={<RotateCcw className="h-4 w-4" />} onClick={clearAll}>
                    {t('resetFilters')}
                  </Button>
                }
              />
            )}
          </div>
        </div>
      </section>

      <HelpBand />

      {/* Mobile filter drawer */}
      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        side="right"
        width="max-w-[420px]"
        title={
          <span className="inline-flex items-center gap-2.5">
            {t('filters')}
            {nActive > 0 && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-brand-600 px-1.5 text-[12px] font-bold text-white">{nActive}</span>}
          </span>
        }
        footer={
          <div className="flex gap-2.5">
            <Button variant="outline" size="lg" onClick={clearAll} disabled={nActive === 0} className="px-5">
              {t('clear')}
            </Button>
            <Button variant="dark" size="lg" className="flex-1" onClick={() => setDrawer(false)}>
              {t('showResults', { what: countLabel(t, lang, results.length) })}
            </Button>
          </div>
        }
      >
        <div className="px-5 pb-4 sm:px-6">{panel}</div>
      </Drawer>
    </>
  );
}
