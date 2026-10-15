import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router';
import { ArrowRight, ArrowUpRight, CalendarCheck, FlaskConical, Glasses, LayoutGrid, Percent, ShieldPlus, Tag } from 'lucide-react';
import type { Category, Product } from '@/lib/types';
import { Accent, Img } from '@/components/ui/misc';
import { Breadcrumbs } from '@/site/components/SectionHeading';
import { useDict, useL, useLang } from '@/i18n';
import { site } from '@/i18n/site';
import { basePrice, discountPct, isOnSale, priceOnRequest } from '@/lib/pricing';
import { money, perUnit } from '@/lib/format';
import { cn } from '@/lib/utils';
import { isLensPackage, rxReady } from '@/site/components/product/optical';
import { T, countLabel } from './dict';
import { common } from '@/i18n/common';
import { RenderChip, isRender } from '@/site/components/smart/render';

/** Link to a category (or the all-products view) keeping ?akcija / ?sort. */
export function shopHref(slug: string | null, params: URLSearchParams, patch: Record<string, string | null> = {}) {
  const next = new URLSearchParams();
  for (const k of ['akcija', 'sort']) {
    const v = k in patch ? patch[k] : params.get(k);
    if (v) next.set(k, v);
  }
  const qs = next.toString();
  return `/produktet${slug ? `/${slug}` : ''}${qs ? `?${qs}` : ''}`;
}

/* ------------------------------------------------------------------ */
/* Category banner                                                      */
/* ------------------------------------------------------------------ */
export function CategoryBanner({ category, products, sale }: { category: Category; products: Product[]; sale: boolean }) {
  const t = useDict(T);
  const ts = useDict(site);
  const l = useL();
  const lang = useLang();
  const cheapest = useMemo(() => products.filter((p) => !priceOnRequest(p)).sort((a, b) => basePrice(a) - basePrice(b))[0], [products]);
  const care = products.some((p) => p.installation?.available);
  const lab = products.length > 0 && products.every(isLensPackage);
  const rx = !lab && products.some(rxReady);
  const maxPct = Math.max(0, ...products.map(discountPct));
  const pill = 'inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[13px] font-semibold text-white ring-1 ring-inset ring-white/15 backdrop-blur-md';

  // Smart glasses (rendered category picture, sold on request): the dark launch-style banner.
  if (isRender(category.image)) return <SmartBanner category={category} products={products} />;

  return (
    <section className="relative isolate overflow-hidden bg-ink">
      <Img src={category.image} eager alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" style={{ animation: 'kenburns 2.6s cubic-bezier(.16,1,.3,1) both' }} />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(28_26_23/0.9)_0%,rgb(28_26_23/0.62)_42%,rgb(28_26_23/0.12)_100%)]" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/70 via-transparent to-ink/30" />
      <div className="container-x flex min-h-[400px] flex-col pb-10 pt-7 sm:min-h-[460px] sm:pb-14 sm:pt-9">
        <Breadcrumbs tone="light" items={[{ label: ts('nav_products'), to: '/produktet' }, { label: l(category.name) }]} />
        <div className="mt-auto pt-14 animate-fade-up">
          <div className="eyebrow text-brand-200">{l(category.tagline)}</div>
          <h1 className="display mt-3 text-[56px] leading-[0.95] text-white sm:text-[84px]">{l(category.name)}</h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-paper/75 sm:text-[17px]">{l(category.description)}</p>
          <div className="mt-7 flex flex-wrap gap-2">
            <span className={pill}>
              <LayoutGrid className="h-3.5 w-3.5 text-brand-200" /> {countLabel(t, lang, products.length)}
            </span>
            {cheapest && !cheapest.quoteOnly && (
              <span className={pill}>
                <Tag className="h-3.5 w-3.5 text-brand-200" />
                {t('fromPrice', { price: money(basePrice(cheapest), lang, { decimals: basePrice(cheapest) % 1 !== 0 }) })}
                {cheapest.unit !== 'kom' ? ` ${perUnit(cheapest.unit, lang)}` : ''}
              </span>
            )}
            {lab && (
              <span className={pill}>
                <FlaskConical className="h-3.5 w-3.5 text-brand-200" /> {t('labMade')}
              </span>
            )}
            {rx && (
              <span className={cn(pill, 'max-sm:hidden')}>
                <Glasses className="h-3.5 w-3.5 text-brand-200" /> {t('rxAvail')}
              </span>
            )}
            {care && (
              <span className={cn(pill, 'max-md:hidden')}>
                <ShieldPlus className="h-3.5 w-3.5 text-brand-200" /> {t('careAvail')}
              </span>
            )}
            {sale && (
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-3.5 py-1.5 text-[13px] font-bold text-white shadow-lg">
                <Percent className="h-3.5 w-3.5" /> {ts('sale')}
                {maxPct > 0 && ` · ${t('upTo')} −${maxPct}%`}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Dark category banner for smart glasses (sold on request) — the same launch look as /syze-inteligjente. */
function SmartBanner({ category, products }: { category: Category; products: Product[] }) {
  const t = useDict(T);
  const ts = useDict(site);
  const tc = useDict(common);
  const l = useL();
  const lang = useLang();
  const onReq = products.length > 0 && products.every(priceOnRequest);
  const pill = 'inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3.5 py-1.5 text-[13px] font-semibold text-white/85 ring-1 ring-inset ring-white/12 backdrop-blur-md';
  return (
    <section className="relative isolate overflow-hidden bg-[#07090a] text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ background: 'radial-gradient(ellipse 45% 70% at 78% 50%, rgb(111 211 165 / 0.16), rgb(44 74 58 / 0.1) 50%, transparent 80%)' }} />
      <div className="bg-grain pointer-events-none absolute inset-0 -z-10 opacity-40 mix-blend-overlay" />
      <div className="container-x grid items-center gap-8 pb-10 pt-7 sm:pb-12 sm:pt-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.62fr)] lg:gap-14">
        <div className="min-w-0 animate-fade-up">
          <Breadcrumbs tone="light" items={[{ label: ts('nav_products'), to: '/produktet' }, { label: l(category.name) }]} />
          <div className="mt-8 inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#6fd3a5] sm:mt-10">
            <span className="h-1.5 w-1.5 rounded-full bg-[#6fd3a5] shadow-[0_0_10px_2px_rgb(111_211_165/0.7)]" />
            {l(category.tagline)}
          </div>
          <h1 className="mt-3 text-[46px] font-semibold leading-[0.98] tracking-[-0.045em] text-white sm:text-[68px]">{l(category.name)}</h1>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-white/60 sm:text-[17px]">{l(category.description)}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className={pill}>
              <LayoutGrid className="h-3.5 w-3.5 text-[#6fd3a5]" /> {countLabel(t, lang, products.length)}
            </span>
            {onReq && (
              <span className={pill}>
                <Tag className="h-3.5 w-3.5 text-[#6fd3a5]" /> {tc('priceOnRequest')}
              </span>
            )}
            <span className={cn(pill, 'max-sm:hidden')}>
              <CalendarCheck className="h-3.5 w-3.5 text-[#6fd3a5]" /> {t('smartTry')}
            </span>
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/syze-inteligjente"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[#6fd3a5] px-5 text-sm font-semibold text-[#06110c] shadow-[0_0_36px_-10px_rgb(111_211_165/0.8)] transition-colors hover:bg-[#8fe2bd]"
            >
              {t('smartGuide')} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/rezervo?sherbimi=sv-smart"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white/[0.06] px-5 text-sm font-semibold text-white ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/[0.11]"
            >
              <CalendarCheck className="h-4 w-4 text-[#6fd3a5]" /> {t('smartBook')}
            </Link>
          </div>
        </div>
        <div className="relative hidden aspect-[4/3] overflow-hidden rounded-3xl bg-[#0b0f0d] ring-1 ring-white/10 sm:block lg:aspect-[4/4.2]">
          <Img src={category.image} eager alt="" className="absolute inset-0 h-full w-full object-cover" />
          <RenderChip tone="dark" className="absolute left-4 top-4" />
        </div>
      </div>
      <p className="container-x relative pb-5 text-[12px] leading-snug text-white/40">{t('smartNote')}</p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Calm header for the all-products / sale view                        */
/* ------------------------------------------------------------------ */
export function AllHeader({ products, categories, sale, params }: { products: Product[]; categories: Category[]; sale: boolean; params: URLSearchParams }) {
  const t = useDict(T);
  const ts = useDict(site);
  const l = useL();
  const lang = useLang();
  const onSale = useMemo(() => products.filter(isOnSale), [products]);
  const maxPct = Math.max(0, ...products.map(discountPct));
  const shown = sale ? onSale : products;

  return (
    <section className="relative overflow-hidden border-b border-line bg-paper">
      <div className="bg-grain pointer-events-none absolute inset-0 opacity-70" />
      <div className="container-x relative pb-10 pt-7 sm:pb-12 sm:pt-9">
        <Breadcrumbs items={sale ? [{ label: ts('nav_products'), to: '/produktet' }, { label: ts('sale') }] : [{ label: ts('nav_products') }]} />
        <div className="mt-8 grid gap-8 animate-fade-up sm:mt-10 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="eyebrow">{sale ? t('saleEyebrow') : t('catalog')}</div>
            <h1 className="display mt-3 text-[46px] leading-[1] text-ink sm:text-[68px]">
              <Accent text={sale ? t('saleTitle') : t('allTitle')} />
            </h1>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-muted sm:text-[17px]">{sale ? t('saleSubtitle', { pct: maxPct }) : t('allSubtitle')}</p>
          </div>
          {sale ? (
            <div className="hidden h-36 w-36 rotate-[-8deg] place-items-center rounded-full bg-brand-600 text-center text-white shadow-[0_24px_50px_-20px_var(--color-brand-700)] lg:grid">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-100">{t('upTo')}</div>
                <div className="display text-[44px] leading-none">−{maxPct}%</div>
              </div>
            </div>
          ) : (
            <dl className="hidden gap-10 lg:flex">
              {[
                [products.length, t('statProducts')],
                [categories.length, t('statCategories')],
                [onSale.length, t('statSale')],
              ].map(([v, label]) => (
                <div key={label as string} className="text-right">
                  <dt className="sr-only">{label}</dt>
                  <dd className="display text-[44px] leading-none text-ink">{v}</dd>
                  <dd className="mt-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">{label}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {/* Category tiles */}
        <div className={cn('mt-10 hidden gap-3 sm:grid sm:grid-cols-3', categories.length > 4 && 'lg:grid-cols-6')}>
          {categories.map((c, i) => {
            const n = shown.filter((p) => p.categoryId === c.id).length;
            return (
              <Link
                key={c.id}
                to={shopHref(c.slug, params)}
                className={cn('group relative block overflow-hidden rounded-2xl bg-ink animate-fade-up', categories.length > 4 ? 'aspect-[5/4]' : 'aspect-[16/9]', sale && n === 0 && 'opacity-50')}
                style={{ animationDelay: `${120 + i * 60}ms` }}
              >
                <Img src={c.image} small alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
                <span className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-ink opacity-0 transition-all duration-300 group-hover:opacity-100">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
                <div className="absolute inset-x-0 bottom-0 p-3.5 sm:p-4">
                  <div className={cn('font-semibold leading-tight text-white', categories.length > 4 ? 'text-[15px]' : 'text-[17px]')}>{l(c.name)}</div>
                  <div className="mt-0.5 text-[12px] text-white/65">{sale ? t('saleCount', { n }) : countLabel(t, lang, n)}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Chip row: all categories + Akcija                                   */
/* ------------------------------------------------------------------ */
export function CategoryChips({
  categories,
  products,
  active,
  sale,
  params,
  onToggleSale,
}: {
  categories: Category[];
  products: Product[];
  active: string | null;
  sale: boolean;
  params: URLSearchParams;
  onToggleSale: () => void;
}) {
  const t = useDict(T);
  const ts = useDict(site);
  const l = useL();
  const counted = sale ? products.filter(isOnSale) : products;
  const saleN = products.filter((p) => isOnSale(p) && (!active || p.categoryId === active)).length;
  // phones: bring the active chip into view (horizontal only — never scroll the page)
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = row.current;
    const el = box?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!box || !el) return;
    const r = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    if (r.right > b.right) box.scrollLeft += r.left - b.left - 16;
  }, [active]);
  const chip = (on: boolean) =>
    cn(
      'inline-flex h-11 shrink-0 items-center gap-2 rounded-full border text-[14px] font-semibold transition-all duration-200',
      on ? 'border-ink bg-ink text-paper shadow-[0_8px_20px_-12px_rgb(28_26_23/0.7)]' : 'border-line bg-white text-ink-soft hover:border-ink/30 hover:text-ink',
    );

  return (
    <div className="border-b border-line bg-paper">
      <div className="container-x">
        <div ref={row} className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 py-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
          <Link to={shopHref(null, params)} className={cn(chip(!active), 'px-4')} aria-current={!active ? 'page' : undefined}>
            <LayoutGrid className="h-4 w-4 opacity-70" />
            {t('all')}
            <span className={cn('text-[12px] font-medium tabular-nums', !active ? 'text-paper/55' : 'text-muted')}>{counted.length}</span>
          </Link>
          {categories.map((c) => {
            const on = active === c.id;
            const n = counted.filter((p) => p.categoryId === c.id).length;
            return (
              <Link key={c.id} to={shopHref(c.slug, params)} className={cn(chip(on), 'pl-1.5 pr-4')} aria-current={on ? 'page' : undefined}>
                <Img src={c.image} small alt="" className={cn('h-8 w-8 rounded-full object-cover', on && 'ring-2 ring-white/25')} />
                {l(c.name)}
                <span className={cn('text-[12px] font-medium tabular-nums', on ? 'text-paper/55' : 'text-muted')}>{n}</span>
              </Link>
            );
          })}
          <span className="mx-1 h-6 w-px shrink-0 bg-line" aria-hidden />
          <button
            type="button"
            onClick={onToggleSale}
            aria-pressed={sale}
            className={cn(
              'inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-[14px] font-bold transition-all duration-200',
              sale
                ? 'border-brand-600 bg-brand-600 text-white shadow-[0_10px_24px_-12px_var(--color-brand-700)]'
                : 'border-brand-200 bg-brand-50 text-brand-700 hover:border-brand-400 hover:bg-brand-100',
            )}
          >
            <Percent className="h-4 w-4" />
            {ts('sale')}
            <span className={cn('text-[12px] font-semibold tabular-nums', sale ? 'text-white/70' : 'text-brand-600/70')}>{saleN}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
