import { useEffect, useMemo, useRef, type ComponentType } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, ArrowUpRight, BookOpen, CalendarCheck, Car, Check, FlaskConical, Glasses, Info, Layers, Monitor, ShoppingBag, Sun, SunMoon } from 'lucide-react';
import type { L10n, Product } from '@/lib/types';
import { Accent, Img } from '@/components/ui/misc';
import { Button, ButtonLink } from '@/components/ui/Button';
import { openBooking } from '@/site/components/utility/Booking';
import { scrollToId } from '@/site/components/company/data';
import { labDays } from '@/site/components/product/optical';
import { useDict, useL, useLang } from '@/i18n';
import { useUi } from '@/store/ui';
import { defaultOptions, isOnSale, optionsLabel, regularUnitPrice, unitPrice } from '@/lib/pricing';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ChoiceGroup } from './ChoiceGroup';
import { LG } from './lensDict';
import {
  ALTERNATIVE,
  ALT_WHY,
  IDEAL_INDEX,
  PRIMARY,
  STRENGTHS,
  STRENGTH_WHY,
  THIN_ALT_WHY,
  THIN_ID,
  USES,
  USE_WHY,
  indexOf,
  specIndex,
  type LensUse,
  type Strength,
} from './lensData';

const USE_ICON: Record<LensUse, ComponentType<{ className?: string }>> = {
  distance: Car,
  reading: BookOpen,
  screen: Monitor,
  all: Layers,
  sun: Sun,
  inout: SunMoon,
};

export interface LensRec {
  product: Product;
  options: Record<string, string>;
  /** suggested lens index (null = decided once we see the prescription) */
  index: number | null;
  /** the index is one of the product's options (price includes it) */
  indexIsOption: boolean;
  alt?: Product;
  altWhy: L10n;
  /** very strong prescription on a package that tops out below 1.74 */
  highNote: boolean;
}

/** Pick the lens package + index for an answer pair (pure — also used by tests / other pages). */
export function recommendLens(use: LensUse, strength: Strength, lenses: Product[]): LensRec | null {
  const byId = (id: string) => lenses.find((p) => p.id === id);
  let primaryId = PRIMARY[use];
  let altId = ALTERNATIVE[use];
  let altWhy = ALT_WHY[use];
  if (strength === 'vhigh' && (use === 'distance' || use === 'reading') && byId(THIN_ID)) {
    altId = primaryId;
    primaryId = THIN_ID;
    altWhy = THIN_ALT_WHY;
  }
  const product = byId(primaryId) ?? lenses[0];
  if (!product) return null;

  const options = defaultOptions(product);
  const ideal = strength === 'unknown' ? null : IDEAL_INDEX[strength];
  const indexOpt = product.options.find((o) => o.id === 'index');
  let index = specIndex(product);
  // a package with a fixed index (1.74) is priced with it, like an index option
  let indexIsOption = index != null;
  if (indexOpt) {
    const vals = indexOpt.values.map((v) => ({ id: v.id, n: indexOf(v.label) })).filter((v): v is { id: string; n: number } => v.n != null);
    if (vals.length) {
      const target = ideal ?? Math.min(...vals.map((v) => v.n));
      const fit = vals.filter((v) => v.n <= target + 1e-6).sort((a, b) => b.n - a.n)[0] ?? vals[0];
      options.index = fit.id;
      index = ideal == null ? null : fit.n;
      indexIsOption = true;
    }
  } else if (index == null) {
    index = ideal;
  }
  const alt = altId !== product.id ? byId(altId) : undefined;
  const highNote = strength === 'vhigh' && product.id !== THIN_ID && (index ?? 0) < 1.74;
  return { product, options, index, indexIsOption, alt, altWhy, highNote };
}

export function LensChooser({
  use,
  strength,
  onUse,
  onStrength,
  lenses,
}: {
  use: LensUse | undefined;
  strength: Strength | undefined;
  onUse: (v: LensUse) => void;
  onStrength: (v: Strength) => void;
  lenses: Product[];
}) {
  const t = useDict(LG);
  const l = useL();
  const reduce = useReducedMotion();
  const rec = useMemo(() => (use && strength ? recommendLens(use, strength, lenses) : null), [use, strength, lenses]);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasComplete = useRef(!!rec);
  const answered = Number(!!use) + Number(!!strength);

  // Phones: when the recommendation first appears below the questions, bring it into view.
  useEffect(() => {
    const complete = !!rec;
    if (complete && !wasComplete.current && window.matchMedia('(max-width: 1023px)').matches) {
      const el = panelRef.current;
      if (el && el.getBoundingClientRect().top > window.innerHeight * 0.6) el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
    wasComplete.current = complete;
  }, [rec, reduce]);

  return (
    <div className="grid gap-3 rounded-[36px] bg-sand/70 p-3 sm:gap-4 sm:p-4 lg:grid-cols-[1.3fr_1fr]">
      <div className="rounded-[28px] bg-paper p-5 sm:p-8">
        <div className="flex items-baseline justify-between gap-4">
          <h3 id="lg-q1" className="flex items-baseline gap-3 text-[19px] font-bold text-ink sm:text-[21px]">
            <span className="display text-[15px] font-normal text-brand-600">01</span>
            {t('q1')}
          </h3>
          <span className="shrink-0 text-[12px] font-semibold tabular-nums text-muted" aria-live="polite">
            {t('answered', { n: answered })}
          </span>
        </div>
        <ChoiceGroup
          labelledBy="lg-q1"
          value={use}
          onChange={onUse}
          variant="row"
          className="mt-5 grid gap-2.5 sm:grid-cols-2"
          options={USES.map((u) => {
            const Icon = USE_ICON[u.id];
            return {
              id: u.id,
              label: l(u.label),
              hint: l(u.hint),
              visual: (
                <span className={cn('grid h-11 w-11 place-items-center rounded-full transition-colors', use === u.id ? 'bg-brand-600 text-white' : 'bg-sand text-ink-soft')}>
                  <Icon className="h-5 w-5" />
                </span>
              ),
            };
          })}
        />

        <div className="mt-9 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 id="lg-q2" className="flex items-baseline gap-3 text-[19px] font-bold text-ink sm:text-[21px]">
            <span className="display text-[15px] font-normal text-brand-600">02</span>
            {t('q2')}
          </h3>
          <button type="button" onClick={() => scrollToId('receta')} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700 hover:underline">
            <Info className="h-3.5 w-3.5" /> {t('howToRead')}
          </button>
        </div>
        <p id="lg-q2-hint" className="mt-1.5 text-[13.5px] text-muted">
          {t('q2hint')}
        </p>
        <ChoiceGroup
          labelledBy="lg-q2"
          describedBy="lg-q2-hint"
          value={strength}
          onChange={onStrength}
          variant="tile"
          indicator={false}
          className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5"
          options={STRENGTHS.map((s) => ({
            id: s.id,
            label: <span className="whitespace-nowrap text-[16px] tabular-nums">{l(s.label)}</span>,
            hint: l(s.hint),
            className: cn('min-h-[78px] gap-0! p-3.5! sm:px-4!', s.id === 'unknown' && 'col-span-2 sm:col-span-1'),
          }))}
        />
      </div>

      <div ref={panelRef} className="scroll-mt-24">
        <div className="relative isolate h-full overflow-hidden rounded-[28px] bg-ink p-6 text-white sm:p-8 lg:min-h-[560px]">
          <div className="pointer-events-none absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-brand-600/35 blur-[90px]" />
          <div className="bg-grain pointer-events-none absolute inset-0 -z-10" />
          <div className="eyebrow text-brand-200">{t('recEyebrow')}</div>
          <p className="sr-only" aria-live="polite">
            {rec ? `${t('recEyebrow')}: ${l(rec.product.name)}` : ''}
          </p>
          <AnimatePresence mode="wait" initial={false}>
            {rec ? (
              <motion.div
                key={`${rec.product.id}-${rec.options.index ?? ''}-${strength}`}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <Recommendation rec={rec} use={use!} strength={strength!} />
              </motion.div>
            ) : (
              <motion.div key="empty" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-full flex-col">
                <EmptyLens className="mx-auto mt-8 h-40 w-40 text-brand-200 sm:h-48 sm:w-48" step={answered} />
                <h3 className="display mt-6 text-center text-[28px] leading-tight sm:text-[32px]">
                  <Accent text={t('recEmptyTitle')} accentClassName="text-brand-200!" />
                </h3>
                <p className="mx-auto mt-3 max-w-sm text-center text-[15px] leading-relaxed text-paper/70">{t('recEmptyText')}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Recommendation({ rec, use, strength }: { rec: LensRec; use: LensUse; strength: Strength }) {
  const t = useDict(LG);
  const l = useL();
  const lang = useLang();
  const addToCart = useUi((s) => s.addToCart);
  const setCartOpen = useUi((s) => s.setCartOpen);
  const { product: p, options } = rec;
  const price = unitPrice(p, options);
  const regular = regularUnitPrice(p, options);
  const coating = p.specs.find((s) => /coating|shtres/i.test(`${s.label.en} ${s.label.sq}`));
  const unknown = strength === 'unknown';
  const fmt = (n: number) => money(n, lang, { decimals: n % 1 !== 0 });
  const indexLabel = rec.index != null ? rec.index.toFixed(2) : null;

  const add = () => {
    addToCart({ productId: p.id, qty: 1, options, installation: false });
    const opts = optionsLabel(p, options, lang);
    toast.success(t('added'), {
      description: `${l(p.name)}${opts ? ` · ${opts}` : ''} · ${fmt(price)}`,
      action: { label: t('viewCart'), onClick: () => setCartOpen(true) },
    });
  };

  // "not sure" gets its own booking box below instead of a reason line
  const reasons = [l(USE_WHY[use]), unknown ? null : l(STRENGTH_WHY[strength]), coating ? t('included', { coating: l(coating.value) }) : null].filter(Boolean) as string[];

  return (
    <div className="mt-5">
      <div className="flex gap-4 sm:gap-5">
        <Link to={`/produkt/${p.slug}`} className="block h-28 w-[92px] shrink-0 overflow-hidden rounded-2xl bg-ink-soft ring-1 ring-white/10 sm:h-32 sm:w-[104px]">
          <Img src={p.images[0]} small alt={l(p.name)} className="h-full w-full object-cover" />
        </Link>
        <div className="min-w-0">
          <h3 className="display text-[26px] leading-[1.08] text-white sm:text-[30px]">{l(p.name)}</h3>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
            <span className="text-[22px] font-bold tabular-nums text-white">{fmt(price)}</span>
            <span className="text-[13px] font-medium text-paper/60">/ {t('perPair')}</span>
            {isOnSale(p) && <span className="text-[13px] text-paper/50 line-through tabular-nums">{fmt(regular)}</span>}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1.5 text-[12.5px] font-semibold text-white ring-1 ring-white/10">
          <Glasses className="h-3.5 w-3.5" />
          {indexLabel ? (rec.indexIsOption ? t('suggestedIndex', { index: indexLabel }) : t('indexConfirm', { index: indexLabel })) : t('indexAfterRx')}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12.5px] font-semibold text-paper/85 ring-1 ring-white/15">
          <FlaskConical className="h-3.5 w-3.5" /> {t('labReady', { days: labDays(p) })}
        </span>
      </div>

      <ul className="mt-6 space-y-3">
        {reasons.map((r) => (
          <li key={r} className="flex items-start gap-3 text-[15px] leading-snug text-paper/90">
            <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-200 text-ink">
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            {r}
          </li>
        ))}
      </ul>

      {rec.highNote && <p className="mt-4 rounded-2xl bg-white/[0.06] p-3.5 text-[13.5px] leading-relaxed text-paper/80 ring-1 ring-white/10">{t('highNote')}</p>}

      {unknown && (
        <div className="mt-5 rounded-2xl bg-brand-600/40 p-4 ring-1 ring-brand-200/25">
          <div className="text-[14.5px] font-bold text-white">{t('noRxTitle')}</div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-paper/80">{t('noRxText')}</p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2.5">
        {unknown ? (
          <Button onClick={() => openBooking('exam')} icon={<CalendarCheck className="h-4 w-4" />}>
            {t('bookExam')}
          </Button>
        ) : (
          <Button onClick={add} icon={<ShoppingBag className="h-4 w-4" />}>
            {t('addToCart')}
          </Button>
        )}
        <ButtonLink to={`/produkt/${p.slug}`} variant="outlineLight" iconRight={<ArrowUpRight className="h-4 w-4" />}>
          {t('viewLens')}
        </ButtonLink>
      </div>

      {rec.alt && (
        <Link to={`/produkt/${rec.alt.slug}`} className="group mt-6 flex items-center gap-3 rounded-2xl bg-white/[0.05] p-2.5 pr-4 ring-1 ring-white/10 transition hover:bg-white/10">
          <Img src={rec.alt.images[0]} small alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
          <span className="min-w-0 text-[13.5px] leading-snug text-paper/75">
            <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-brand-200">{t('altLabel')}</span>
            {t('altWhy', { name: l(rec.alt.name), why: l(rec.altWhy) })}
          </span>
          <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-paper/50 transition group-hover:translate-x-0.5 group-hover:text-white" />
        </Link>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-white/10 pt-5 text-[13.5px]">
        <span className="text-paper/60">{t('needFrame')}</span>
        <Link to="/gjej-kornizen" className="inline-flex items-center gap-1.5 font-semibold text-white hover:text-brand-200">
          {t('findFrame')} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-paper/45">{t('disclaimer')}</p>
    </div>
  );
}

/** Lens outline that fills as the two questions are answered. */
function EmptyLens({ className, step }: { className?: string; step: number }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden fill="none">
      <circle cx="60" cy="60" r="52" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="3 5" />
      <circle cx="60" cy="60" r="40" stroke="currentColor" strokeOpacity={step >= 1 ? 0.75 : 0.25} strokeWidth="1.5" className="transition-[stroke-opacity] duration-500" />
      <circle cx="60" cy="60" r="26" fill="currentColor" fillOpacity={step >= 2 ? 0.25 : step >= 1 ? 0.12 : 0.04} className="transition-[fill-opacity] duration-500" />
      <path d="M38 44a30 30 0 0 1 22-12" stroke="currentColor" strokeOpacity="0.8" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M54 60h12M60 54v12" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
