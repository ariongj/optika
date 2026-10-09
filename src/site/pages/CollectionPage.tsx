// /koleksioni/:slug — public collection page (CMS proposal p.14). Only ACTIVE products of a PUBLISHED collection show;
// staff can preview an unpublished one with ?preview=1 while logged into the CMS.
import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ArrowDown, ArrowRight, ArrowUpDown, ChevronDown, Compass, Eye, LayoutGrid, Percent, ShieldPlus, Tag } from 'lucide-react';
import { ProductCard } from '@/site/components/ProductCard';
import { Breadcrumbs } from '@/site/components/SectionHeading';
import { HelpBand } from '@/site/components/shop/HelpBand';
import { CT, accentTitle, countLabel } from '@/site/components/collections/dict';
import { usePageTitle } from '@/site/layout/SiteLayout';
import { ButtonLink, buttonClass } from '@/components/ui/Button';
import { Accent, EmptyState, Img, Reveal } from '@/components/ui/misc';
import { useDict, useL, useLang } from '@/i18n';
import { site } from '@/i18n/site';
import { useDb } from '@/store/db';
import { useUi } from '@/store/ui';
import { useCollection } from '@/store/hooks';
import { collectionProducts, sortProducts } from '@/lib/collections';
import { basePrice, discountPct } from '@/lib/pricing';
import { discountState } from '@/lib/discounts';
import { money, perUnit } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Collection, CollectionSort, Product } from '@/lib/types';

type SortKey = 'featured' | Exclude<CollectionSort, 'manual'>;
const SORTS: SortKey[] = ['featured', 'bestselling', 'price-asc', 'price-desc', 'newest'];

export default function CollectionPage() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const { collection, products } = useCollection(slug);
  const adminAuthed = useUi((s) => s.adminAuthed);
  const l = useL();
  const t = useDict(CT);
  const preview = !!collection && !collection.published && params.get('preview') === '1' && adminAuthed;
  const visible = !!collection && (collection.published || preview);
  usePageTitle(visible ? l(collection!.title) : t('notFoundPageTitle'));

  if (!visible) return <NotFoundCollection current={collection?.id} />;
  return <CollectionView key={collection!.id} collection={collection!} products={products} preview={preview} />;
}

/* ================================================================== */
/* Page                                                                 */
/* ================================================================== */
function CollectionView({ collection, products, preview }: { collection: Collection; products: Product[]; preview: boolean }) {
  const t = useDict(CT);
  const ts = useDict(site);
  const l = useL();
  const lang = useLang();
  const [params, setParams] = useSearchParams();
  const raw = params.get('sort') as SortKey | null;
  const sort: SortKey = raw && SORTS.includes(raw) ? raw : 'featured';
  const list = useMemo(() => (sort === 'featured' ? products : sortProducts(products, sort)), [products, sort]);

  const title = l(collection.title);
  const cheapest = useMemo(() => products.filter((p) => !p.quoteOnly).sort((a, b) => basePrice(a) - basePrice(b))[0], [products]);
  const maxPct = Math.max(0, ...products.map(discountPct));
  const care = products.some((p) => p.installation?.available);
  // an automatic product discount on this collection (e.g. "Fund sezoni — syze dielli −20%") is applied in the cart — say so up front
  const discounts = useDb((s) => s.discounts);
  const auto = useMemo(
    () => discounts.find((d) => d.kind === 'products' && d.method === 'auto' && d.audience.type === 'all' && d.appliesTo.scope === 'collections' && d.appliesTo.ids.includes(collection.id) && discountState(d) === 'active'),
    [discounts, collection.id],
  );
  const pill = 'inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[13px] font-semibold text-ink-soft ring-1 ring-inset ring-line';

  return (
    <>
      {preview && (
        <div className="border-b border-amber-200 bg-amber-50 text-amber-900">
          <div className="container-x flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-[13.5px]">
            <span className="inline-flex items-center gap-2 font-semibold">
              <Eye className="h-4 w-4" /> {t('previewBanner')}
            </span>
            <Link to={`/admin/kolekcije/${collection.id}`} className="font-semibold underline underline-offset-2 hover:no-underline">
              {t('editInCms')}
            </Link>
          </div>
        </div>
      )}

      {/* ------------------------------ header ------------------------------ */}
      <section className="relative overflow-hidden border-b border-line bg-paper">
        <div className="bg-grain pointer-events-none absolute inset-0 opacity-70" />
        <div className="container-x relative pb-12 pt-7 sm:pb-16 sm:pt-9">
          <Breadcrumbs items={[{ label: ts('nav_products'), to: '/produktet' }, { label: title }]} />
          <div className="mt-8 grid gap-10 sm:mt-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-14">
            <div className="animate-fade-up">
              <div className="eyebrow">{t('eyebrow')}</div>
              <h1 className="display mt-3 text-[46px] leading-[1] text-ink sm:text-[68px]">
                <Accent text={accentTitle(title)} />
              </h1>
              {l(collection.description) && <p className="mt-5 max-w-xl font-display text-[20px] italic leading-[1.45] text-ink-soft sm:text-[23px]">{l(collection.description)}</p>}
              <div className="mt-7 flex flex-wrap gap-2">
                <span className={pill}>
                  <LayoutGrid className="h-3.5 w-3.5 text-brand-600" /> {countLabel(t, lang, products.length)}
                </span>
                {cheapest && (
                  <span className={pill}>
                    <Tag className="h-3.5 w-3.5 text-brand-600" />
                    {t('fromPrice', { price: money(basePrice(cheapest), lang, { decimals: basePrice(cheapest) % 1 !== 0 }) })}
                    {cheapest.unit !== 'kom' ? ` ${perUnit(cheapest.unit, lang)}` : ''}
                  </span>
                )}
                {care && (
                  <span className={cn(pill, 'max-sm:hidden')}>
                    <ShieldPlus className="h-3.5 w-3.5 text-brand-600" /> {t('install')}
                  </span>
                )}
                {auto && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-3.5 py-1.5 text-[13px] font-bold text-white shadow-[0_10px_24px_-14px_var(--color-brand-700)]">
                    <Percent className="h-3.5 w-3.5" /> {auto.valueType === 'percent' ? t('autoPct', { pct: auto.value }) : t('autoFixed', { amount: money(auto.value, lang) })}
                  </span>
                )}
                {!auto && maxPct > 0 && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-3.5 py-1.5 text-[13px] font-bold text-white shadow-[0_10px_24px_-14px_var(--color-brand-700)]">
                    <Percent className="h-3.5 w-3.5" /> {t('upTo', { pct: maxPct })}
                  </span>
                )}
              </div>
              {products.length > 0 && (
                <a href="#proizvodi" className={buttonClass({ variant: 'dark', size: 'lg', className: 'mt-8 max-sm:w-full' })}>
                  {t('browse')} <ArrowDown className="h-4 w-4" />
                </a>
              )}
            </div>

            <div className="relative animate-fade-up [animation-delay:120ms]">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-sand shadow-[0_40px_80px_-40px_rgb(28_26_23/0.55)]">
                {collection.image ? (
                  <Img src={collection.image} eager alt={title} className="absolute inset-0 h-full w-full object-cover" style={{ animation: 'kenburns 2.6s cubic-bezier(.16,1,.3,1) both' }} />
                ) : (
                  products[0]?.images[0] && <Img src={products[0].images[0]} eager alt={title} className="absolute inset-0 h-full w-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/25 via-transparent to-transparent" />
              </div>
              {products.length > 0 && (
                <div className="absolute -bottom-6 left-4 flex items-center gap-3 rounded-2xl bg-white/95 py-2.5 pl-2.5 pr-4 shadow-[0_18px_40px_-18px_rgb(28_26_23/0.45)] ring-1 ring-line backdrop-blur sm:left-6">
                  <div className="flex -space-x-3">
                    {products.slice(0, 3).map((p) => (
                      <Img key={p.id} src={p.images[0]} small alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-white" />
                    ))}
                  </div>
                  <div className="leading-tight">
                    <div className="text-[15px] font-bold tabular-nums text-ink">{products.length}</div>
                    <div className="text-[12px] text-muted">{t('inCollection')}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------ products ------------------------------ */}
      <section id="proizvodi" className="container-x scroll-mt-24 pt-10 sm:pt-14">
        {products.length === 0 ? (
          <EmptyState
            className="rounded-3xl border border-dashed border-line bg-white/50"
            icon={<LayoutGrid className="h-6 w-6" />}
            title={t('emptyTitle')}
            text={t('emptyText')}
            action={
              <ButtonLink to="/produktet" variant="dark" iconRight={<ArrowRight className="h-4 w-4" />}>
                {ts('allProducts')}
              </ButtonLink>
            }
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <p className="text-[15px] text-muted" aria-live="polite">
                <span className="font-bold text-ink">{countLabel(t, lang, products.length)}</span>
              </p>
              <label className="relative inline-flex h-11 min-w-0 cursor-pointer items-center rounded-full border border-line bg-white pl-4 pr-10 text-[14px] transition-colors focus-within:border-ink/40 focus-within:ring-4 focus-within:ring-ink/5 hover:border-ink/30 max-sm:flex-1">
                <ArrowUpDown className="mr-2 h-4 w-4 shrink-0 text-muted" />
                <span className="mr-1 shrink-0 text-muted max-sm:sr-only">{t('sortBy')}:</span>
                <select
                  value={sort}
                  onChange={(e) =>
                    setParams(
                      (prev) => {
                        const next = new URLSearchParams(prev);
                        if (e.target.value === 'featured') next.delete('sort');
                        else next.set('sort', e.target.value);
                        return next;
                      },
                      { replace: true, preventScrollReset: true },
                    )
                  }
                  className="min-w-0 flex-1 cursor-pointer appearance-none truncate bg-transparent font-semibold text-ink outline-none"
                >
                  {SORTS.map((s) => (
                    <option key={s} value={s}>
                      {t(`sort_${s}`)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 h-4 w-4 text-muted" />
              </label>
            </div>
            <div key={sort} className="mt-6 grid grid-cols-2 gap-x-3.5 gap-y-9 sm:gap-x-5 md:grid-cols-3 lg:mt-8 lg:gap-x-6 lg:gap-y-12 xl:grid-cols-4 xl:gap-x-5">
              {list.map((p, i) => (
                <div key={p.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 11) * 45}ms` }}>
                  <ProductCard product={p} priority={i < 8} />
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <OtherCollections current={collection.id} />
      <HelpBand />
    </>
  );
}

/* ================================================================== */
/* Other published collections (cross-navigation + not-found help)      */
/* ================================================================== */
function usePublishedCollections(exclude?: string) {
  const collections = useDb((s) => s.collections);
  const products = useDb((s) => s.products);
  return useMemo(
    () =>
      collections
        .filter((c) => c.published && c.id !== exclude)
        .map((c) => ({ c, items: collectionProducts(c, products, { publicOnly: true }) }))
        .filter((x) => x.items.length > 0),
    [collections, products, exclude],
  );
}

function CollectionTiles({ list }: { list: { c: Collection; items: Product[] }[] }) {
  const t = useDict(CT);
  const l = useL();
  const lang = useLang();
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:gap-4', list.length >= 4 ? 'lg:grid-cols-4' : list.length === 3 ? 'lg:grid-cols-3' : '')}>
      {list.slice(0, 4).map(({ c, items }, i) => (
        <Link
          key={c.id}
          to={`/koleksioni/${c.slug}`}
          className={cn('group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-ink animate-fade-up sm:aspect-[5/4]', list.length > 1 && i === Math.min(list.length, 4) - 1 && Math.min(list.length, 4) % 2 === 1 && 'max-lg:hidden')}
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <Img src={c.image || items[0]?.images[0]} small alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-110" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
          <span className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-ink opacity-0 transition-all duration-300 group-hover:opacity-100">
            <ArrowRight className="h-4 w-4" />
          </span>
          <div className="absolute inset-x-0 bottom-0 p-3.5 sm:p-4">
            <div className="text-[15px] font-semibold leading-tight text-white sm:text-[17px]">{l(c.title)}</div>
            <div className="mt-0.5 text-[12px] text-white/70">{countLabel(t, lang, items.length)}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function OtherCollections({ current }: { current: string }) {
  const t = useDict(CT);
  const list = usePublishedCollections(current);
  if (!list.length) return null;
  return (
    <section className="container-x mt-20 sm:mt-28">
      <Reveal>
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <div className="eyebrow">{t('otherEyebrow')}</div>
            <h2 className="display mt-2 text-[34px] leading-[1.05] text-ink sm:text-[44px]">
              <Accent text={t('otherTitle')} />
            </h2>
          </div>
        </div>
        <CollectionTiles list={list} />
      </Reveal>
    </section>
  );
}

/* ================================================================== */
/* Unknown / unpublished slug                                           */
/* ================================================================== */
function NotFoundCollection({ current }: { current?: string }) {
  const t = useDict(CT);
  const ts = useDict(site);
  const list = usePublishedCollections(current);
  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-line">
        <div aria-hidden className="bg-grain absolute inset-0 -z-10" />
        <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-full bg-[radial-gradient(70%_55%_at_50%_0%,var(--color-sand)_0%,transparent_75%)]" />
        <div className="container-x flex flex-col items-center pb-16 pt-14 text-center sm:pb-20 sm:pt-20">
          <span className="grid h-14 w-14 animate-fade-up place-items-center rounded-full bg-white text-brand-600 shadow-sm ring-1 ring-line">
            <Compass className="h-6 w-6" />
          </span>
          <div className="eyebrow mt-6 animate-fade-up">{t('eyebrow')}</div>
          <h1 className="display mt-3 max-w-3xl animate-fade-up text-[40px] leading-[1.04] text-ink [animation-delay:60ms] sm:text-[60px]">
            <Accent text={t('notFoundTitle')} />
          </h1>
          <p className="mt-5 max-w-xl animate-fade-up text-[16px] leading-relaxed text-muted [animation-delay:120ms] sm:text-[17px]">{t('notFoundText')}</p>
          <div className="mt-8 flex w-full animate-fade-up flex-col justify-center gap-3 [animation-delay:180ms] sm:w-auto sm:flex-row">
            <ButtonLink to="/produktet" variant="dark" size="lg" iconRight={<ArrowRight className="h-4 w-4" />}>
              {ts('allProducts')}
            </ButtonLink>
            <ButtonLink to="/produktet?akcija=1" variant="outline" size="lg" icon={<Percent className="h-4 w-4" />}>
              {ts('sale')}
            </ButtonLink>
          </div>
        </div>
      </section>
      {list.length > 0 && (
        <section className="container-x mt-14 sm:mt-20">
          <div className="mb-7">
            <div className="eyebrow">{t('otherEyebrow')}</div>
            <h2 className="display mt-2 text-[34px] leading-[1.05] text-ink sm:text-[44px]">
              <Accent text={t('otherTitle')} />
            </h2>
          </div>
          <CollectionTiles list={list} />
        </section>
      )}
      <HelpBand />
    </>
  );
}
