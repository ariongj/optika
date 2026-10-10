import { useMemo } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Timer } from 'lucide-react';
import { Accent, Reveal } from '@/components/ui/misc';
import { ButtonLink } from '@/components/ui/Button';
import { ProductCard } from '@/site/components/ProductCard';
import { SectionHeading } from '@/site/components/SectionHeading';
import { LENS_CATEGORY, labDays } from '@/site/components/product/optical';
import { LB } from '@/site/components/group/labDict';
import { useDict, useL } from '@/i18n';
import { useActiveProducts, useCategories } from '@/store/hooks';

/** Lab-time scale of the lead-time chart (working days). */
const SCALE = 7;

/** "2–4" → [2, 4]; "~4" → [4, 4]. */
function range(days: string): [number, number] {
  const m = days.match(/(\d+)\D+(\d+)/);
  if (m) return [Number(m[1]), Number(m[2])];
  const n = Number(days.replace(/\D/g, '')) || SCALE;
  return [n, n];
}

/** "What we make": the prescription-lens packages from the store + their lab lead times. */
export function LabLenses() {
  const t = useDict(LB);
  const l = useL();
  const products = useActiveProducts();
  const cats = useCategories();
  const lenses = useMemo(() => products.filter((p) => p.categoryId === LENS_CATEGORY), [products]);
  const category = cats.find((c) => c.id === LENS_CATEGORY);
  const rows = useMemo(() => lenses.map((p) => ({ p, days: labDays(p), r: range(labDays(p)) })), [lenses]);
  if (!lenses.length) return null;

  return (
    <section className="bg-sand/50 py-24 sm:py-28">
      <div className="container-x">
        <Reveal>
          <SectionHeading
            eyebrow={t('makeEyebrow')}
            title={t('makeTitle')}
            subtitle={t('makeText')}
            action={
              category && (
                <ButtonLink to={`/produktet/${category.slug}`} variant="outline" iconRight={<ArrowRight className="h-4 w-4" />}>
                  {t('allLenses')}
                </ButtonLink>
              )
            }
          />
        </Reveal>
        <div className="mt-12 grid grid-cols-2 gap-x-3.5 gap-y-9 sm:grid-cols-3 sm:gap-x-5 xl:grid-cols-6 xl:gap-x-5">
          {lenses.map((p, i) => (
            <Reveal key={p.id} delay={(i % 6) * 70} className="h-full">
              <ProductCard product={p} className="h-full" />
            </Reveal>
          ))}
        </div>

        {/* Lead times */}
        <Reveal>
          <div className="mt-16 grid gap-8 rounded-[32px] bg-white p-6 ring-1 ring-line sm:p-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
            <div>
              <div className="eyebrow">{t('leadEyebrow')}</div>
              <h3 className="display mt-3 text-[32px] leading-[1.05] text-ink sm:text-[42px]">
                <Accent text={t('leadTitle')} />
              </h3>
              <p className="mt-4 max-w-md text-[15.5px] leading-relaxed text-muted">{t('leadText')}</p>
              <p className="mt-5 flex items-start gap-2.5 rounded-2xl bg-paper px-4 py-3 text-[13.5px] leading-snug text-ink-soft ring-1 ring-line">
                <Timer className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {t('leadNote')}
              </p>
            </div>
            <div className="min-w-0">
              <ul className="space-y-4">
                {rows.map(({ p, days, r: [from, to] }) => (
                  <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_4.5rem]">
                    <Link to={`/produkt/${p.slug}`} className="link-u truncate text-[14px] font-semibold text-ink sm:col-start-1">
                      {l(p.name)}
                    </Link>
                    <span className="text-right text-[13px] font-semibold tabular-nums text-ink-soft sm:col-start-3">{t('days', { days })}</span>
                    <div className="relative col-span-2 h-2.5 rounded-full bg-sand sm:col-span-1 sm:col-start-2 sm:row-start-1" role="img" aria-label={t('days', { days })}>
                      <span
                        className="absolute inset-y-0 rounded-full bg-brand-600"
                        style={{ left: `${((from - 1) / SCALE) * 100}%`, width: `${(Math.max(1, to - from + 1) / SCALE) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 grid grid-cols-[minmax(0,1fr)] sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_4.5rem] sm:gap-x-4">
                <div className="grid grid-cols-7 text-center text-[11px] font-semibold tabular-nums text-muted sm:col-start-2">
                  {Array.from({ length: SCALE }, (_, i) => (
                    <span key={i} className="border-l border-line first:border-l-0">
                      {i + 1}
                    </span>
                  ))}
                </div>
                <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-muted sm:col-start-2">{t('leadAxis')}</div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
