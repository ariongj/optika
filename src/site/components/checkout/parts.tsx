import { Fragment, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { Award, Check, ChevronDown, Eye, ShieldCheck, ShieldPlus, TicketPercent, X } from 'lucide-react';
import { Img } from '@/components/ui/misc';
import { useDict, useL, useLang } from '@/i18n';
import { common } from '@/i18n/common';
import { useUi } from '@/store/ui';
import { useDb } from '@/store/db';
import { useSettings } from '@/store/hooks';
import { money, num, unitLabel } from '@/lib/format';
import type { PricedLine, Totals } from '@/lib/pricing';
import type { AppliedDiscount } from '@/lib/types';
import { discountState } from '@/lib/discounts';
import { cn } from '@/lib/utils';
import { ck, pluralKey } from './dict';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** "5 artikala" / "5 artikuj" / "5 items" */
export function useItemsLabel() {
  const t = useDict(ck);
  const lang = useLang();
  return (n: number) => t(pluralKey(n, lang), { n });
}

export function useCopy() {
  const t = useDict(ck);
  return async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable — still confirm, the value is visible on screen */
    }
    toast.success(t('copied'), { description: text });
  };
}

/* ------------------------------------------------------------------ */
/* Stepper: Korpa → Podaci → Plaćanje → Potvrda                         */
/* ------------------------------------------------------------------ */
/** current = index of the active step; 4 = every step completed. */
export function CheckoutSteps({ current, className }: { current: 0 | 1 | 2 | 3 | 4; className?: string }) {
  const t = useDict(ck);
  const steps = [t('step_cart'), t('step_details'), t('step_payment'), t('step_done')];
  return (
    <nav aria-label={t('stepsLabel')} className={className}>
      <ol className="flex items-center gap-1.5 sm:gap-2.5">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          const dot = (
            <span
              className={cn(
                'grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold transition-colors duration-300',
                done && 'bg-ink text-paper',
                active && 'bg-brand-600 text-white ring-4 ring-brand-600/15',
                !done && !active && 'border border-ink/20 bg-white text-muted',
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
            </span>
          );
          const text = <span className={cn('text-[12px] font-semibold sm:text-[13px]', active ? 'text-ink' : done ? 'text-ink-soft' : 'text-muted')}>{label}</span>;
          return (
            <Fragment key={label}>
              {i > 0 && <li aria-hidden className={cn('h-px w-3 shrink sm:w-8', i <= current ? 'bg-ink/50' : 'bg-ink/15')} />}
              <li aria-current={active ? 'step' : undefined} className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                {done && i === 0 ? (
                  <Link to="/shporta" className="flex items-center gap-1.5 hover:opacity-75 sm:gap-2">
                    {dot}
                    {text}
                  </Link>
                ) : (
                  <>
                    {dot}
                    {text}
                  </>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Coupon box                                                          */
/* ------------------------------------------------------------------ */
export function CouponBox({ totals, collapsible, className }: { totals: Totals; collapsible?: boolean; className?: string }) {
  const t = useDict(ck);
  const lang = useLang();
  const applied = useUi((s) => s.coupon);
  const setCoupon = useUi((s) => s.setCoupon);
  const discounts = useDb((s) => s.discounts);
  const [code, setCode] = useState(applied ?? '');
  const [open, setOpen] = useState(!collapsible || !!applied);

  const apply = (value = code) => {
    const v = value.trim().toUpperCase();
    setCode(v);
    setCoupon(v || null);
  };

  // Valid coupon → success state
  if (totals.coupon) {
    const c = totals.coupon;
    return (
      <div className={cn('flex animate-fade-in items-center gap-3 rounded-xl bg-emerald-50 px-3.5 py-3 ring-1 ring-inset ring-emerald-600/15', className)}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-emerald-600 shadow-sm">
          <TicketPercent className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-bold tracking-wide text-emerald-800">
            {c.code}
            <span className="ml-1.5 font-semibold tracking-normal text-emerald-700">· {c.type === 'percent' ? `−${c.value}%` : `−${money(c.value, lang, { decimals: c.value % 1 !== 0 })}`}</span>
          </div>
          {/* saving of THIS code only — automatic discounts are listed separately in the totals */}
          <div className="text-[12.5px] leading-snug text-emerald-700">{t('couponSaving', { amount: money(totals.applied.find((a) => a.code === c.code)?.amount ?? totals.discount, lang) })}</div>
        </div>
        <button
          type="button"
          onClick={() => {
            setCoupon(null);
            setCode('');
          }}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-emerald-700 transition-colors hover:bg-white hover:text-ink"
          aria-label={t('couponRemove')}
          title={t('couponRemove')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const showError = !!applied && !!totals.couponError && code.trim().toUpperCase() === applied.toUpperCase();
  let error = '';
  if (showError && applied) {
    if (totals.couponError === 'min') {
      const m = totals.couponMinimum;
      error =
        m?.type === 'qty'
          ? t('err_minQty', { amount: m.value, left: m.missing })
          : t('err_min', { amount: money(m?.value ?? 0, lang, { decimals: false }), left: money(m?.missing ?? 0, lang) });
    } else error = t(`err_${totals.couponError ?? 'notfound'}`, { code: applied });
  }
  // suggest a live public code the cart already qualifies for (minimum counted after product discounts)
  const demo = discounts.find(
    (d) =>
      d.method === 'code' &&
      d.code &&
      d.audience.type === 'all' &&
      discountState(d) === 'active' &&
      (d.minimum.type !== 'amount' || d.minimum.value <= totals.subtotal - totals.productDiscount),
  );

  return (
    <div className={className}>
      {collapsible ? (
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 text-left text-[13.5px] font-semibold text-ink hover:text-brand-700" aria-expanded={open}>
          <span className="flex items-center gap-2">
            <TicketPercent className="h-4 w-4 text-brand-600" />
            {t('couponHave')}
          </span>
          <ChevronDown className={cn('h-4 w-4 text-muted transition-transform duration-300', open && 'rotate-180')} />
        </button>
      ) : (
        <label htmlFor="coupon-code" className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-ink-soft">
          <TicketPercent className="h-4 w-4 text-brand-600" />
          {t('couponLabel')}
        </label>
      )}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={collapsible ? { height: 0, opacity: 0 } : false}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className={cn(collapsible && 'pt-3')}>
              <div className="flex gap-2">
                <input
                  id="coupon-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      apply();
                    }
                  }}
                  placeholder={t('couponPh')}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={!!error || undefined}
                  className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-white px-3.5 text-[14px] font-semibold uppercase tracking-wider text-ink outline-none transition-colors placeholder:font-medium placeholder:normal-case placeholder:tracking-normal placeholder:text-muted/70 focus:border-ink/40 focus:ring-4 focus:ring-ink/5 aria-[invalid=true]:border-red-500"
                />
                <button
                  type="button"
                  onClick={() => apply()}
                  disabled={!code.trim()}
                  className="h-11 shrink-0 rounded-xl bg-ink px-4 text-[13.5px] font-semibold text-paper transition-colors hover:bg-ink-soft disabled:opacity-40"
                >
                  {t('couponApply')}
                </button>
              </div>
              {error ? (
                <p className="mt-2 text-[12.5px] font-medium leading-snug text-red-600" role="alert">
                  {error}
                </p>
              ) : (
                demo && (
                  <p className="mt-2 text-[12px] text-muted">
                    {t('couponDemo')}{' '}
                    <button type="button" onClick={() => apply(demo.code)} className="font-bold tracking-wide text-ink-soft underline decoration-dotted underline-offset-2 hover:text-brand-700">
                      {demo.code}
                    </button>
                  </p>
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Totals                                                              */
/* ------------------------------------------------------------------ */
function Row({ label, value, sub, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <span className="text-muted">
        {label}
        {sub && <span className="block text-[11.5px] leading-snug text-muted/80">{sub}</span>}
      </span>
      <span className="shrink-0 text-right font-medium tabular-nums text-ink">{value}</span>
    </div>
  );
}

export interface TotalsView {
  subtotal: number;
  installationTotal: number;
  discount: number;
  couponCode?: string | null;
  /** Every applied product / order discount (shipping discounts show in the shipping row). Replaces the single discount row. */
  discounts?: { id: string; label: string; code?: string; amount: number }[];
  shipping: number;
  /** show "od 10 €" */
  shippingFrom?: boolean;
  /** free shipping (or shipping = 0) */
  shippingFree?: boolean;
  shippingNote?: string;
  shippingLabel?: string;
  total: number;
  vat: number;
}

export function TotalsRows({ v, className, big }: { v: TotalsView; className?: string; big?: boolean }) {
  const t = useDict(ck);
  const tc = useDict(common);
  const lang = useLang();
  const settings = useSettings();
  return (
    <div className={cn('text-[14px]', className)}>
      <div className="space-y-2.5">
        <Row label={tc('subtotal')} value={money(v.subtotal, lang)} />
        {v.installationTotal > 0 && <Row label={tc('installation')} value={money(v.installationTotal, lang)} />}
        {v.discounts?.length
          ? v.discounts.map((d) => (
              <Row
                key={d.id}
                label={
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    {d.label}
                    {d.code && <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-emerald-700">{d.code}</span>}
                  </span>
                }
                value={<span className="text-emerald-700">−{money(d.amount, lang)}</span>}
              />
            ))
          : v.discount > 0 && (
          <Row
            label={
              <span className="inline-flex flex-wrap items-center gap-1.5">
                {tc('discount')}
                {v.couponCode && <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-emerald-700">{v.couponCode}</span>}
              </span>
            }
            value={<span className="text-emerald-700">−{money(v.discount, lang)}</span>}
          />
        )}
        <Row
          label={v.shippingLabel ?? tc('shipping')}
          sub={v.shippingNote}
          value={
            v.shippingFree || v.shipping === 0 ? (
              <span className="font-semibold text-emerald-700">{t('free')}</span>
            ) : v.shippingFrom ? (
              t('from', { amount: money(v.shipping, lang) })
            ) : (
              money(v.shipping, lang)
            )
          }
        />
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-line pt-4">
        <span className="text-[15px] font-bold text-ink">{tc('total')}</span>
        <span className={cn('font-bold tracking-tight tabular-nums text-ink', big ? 'text-[28px] leading-none' : 'text-[22px] leading-none')}>{money(v.total, lang)}</span>
      </div>
      <p className="mt-1.5 text-right text-[11.5px] text-muted">{t('vatNote', { rate: settings.vatRate, amount: money(v.vat, lang) })}</p>
    </div>
  );
}

/** Shopper-facing name of an applied discount: the rule's public title (storefront language), else its internal title. */
export function useDiscountLabel() {
  const l = useL();
  const discounts = useDb((s) => s.discounts);
  return (a: Pick<AppliedDiscount, 'id' | 'title'>) => {
    const d = discounts.find((x) => x.id === a.id);
    return (d && l(d.publicTitle)) || a.title;
  };
}

/** Applied product / order discounts as totals rows (shipping discounts are shown in the shipping row). */
export function useDiscountRows(applied: AppliedDiscount[] | undefined): TotalsView['discounts'] {
  const label = useDiscountLabel();
  return (applied ?? []).filter((a) => a.kind !== 'shipping' && a.amount > 0).map((a) => ({ id: a.id, label: label(a), code: a.code, amount: a.amount }));
}

/** Maps a priced cart (useCart) to the totals view. */
export function useTotalsView(totals: Totals, opts: { showEstimateHint?: boolean } = {}): TotalsView {
  const t = useDict(ck);
  const tc = useDict(common);
  const lang = useLang();
  const settings = useSettings();
  const discountRows = useDiscountRows(totals.applied);
  // Care+ also frees delivery; once the amount threshold is met as well, that is the clearer reason to show
  const r = totals.freeShippingReason === 'installation' && totals.freeShippingThreshold != null && totals.freeShippingRemaining <= 0 ? 'threshold' : totals.freeShippingReason;
  const note =
    r === 'threshold'
      ? t('free_threshold', { amount: money(totals.freeShippingThreshold ?? settings.freeShippingThreshold, lang, { decimals: false }) })
      : r === 'installation'
        ? t('free_installation')
        : r === 'pickup'
          ? undefined
          : totals.shippingEstimate && opts.showEstimateHint
            ? t('shippingCalc')
            : undefined;
  return {
    subtotal: totals.subtotal,
    installationTotal: totals.installationTotal,
    discount: totals.discount,
    couponCode: totals.coupon?.code,
    discounts: discountRows,
    shipping: totals.shipping,
    shippingFrom: totals.shippingEstimate,
    shippingFree: !!r,
    shippingNote: note,
    shippingLabel: r === 'pickup' ? tc('delivery_pickup') : tc('shipping'),
    total: totals.total,
    vat: totals.vat,
  };
}

/* ------------------------------------------------------------------ */
/* Trust notes                                                         */
/* ------------------------------------------------------------------ */
export function TrustNotes({ className, compact }: { className?: string; compact?: boolean }) {
  const t = useDict(ck);
  const items = [
    { icon: ShieldCheck, title: t('trust_secure'), text: t('trust_secureText') },
    { icon: Eye, title: t('trust_exam'), text: t('trust_examText') },
    { icon: Award, title: t('trust_warranty'), text: t('trust_warrantyText') },
  ];
  return (
    <ul className={cn('space-y-3.5', className)}>
      {items.map(({ icon: Icon, title, text }) => (
        <li key={title} className="flex items-start gap-3">
          <span className={cn('grid shrink-0 place-items-center rounded-xl bg-white text-brand-600 ring-1 ring-line', compact ? 'h-8 w-8' : 'h-10 w-10')}>
            <Icon className={compact ? 'h-4 w-4' : 'h-[18px] w-[18px]'} />
          </span>
          <span className="min-w-0 pt-0.5">
            <span className="block text-[13.5px] font-semibold text-ink">{title}</span>
            {!compact && <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{text}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Product-level discounts on a cart line                              */
/* ------------------------------------------------------------------ */
/** e.g. "Fund sezoni −20% · −88,00 €" — order discounts stay in the totals. */
export function LineDiscounts({ line, className }: { line: PricedLine; className?: string }) {
  const lang = useLang();
  const label = useDiscountLabel();
  const discounts = useDb((s) => s.discounts);
  const rows = line.allocations
    .map((a) => ({ a, d: discounts.find((x) => x.id === a.discountId) }))
    .filter(({ a, d }) => d && (d.kind === 'products' || d.kind === 'bxgy') && a.amount > 0);
  if (!rows.length) return null;
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {rows.map(({ a, d }) => (
        <span key={a.discountId} className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11.5px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
          <TicketPercent className="h-3 w-3 shrink-0" />
          {label({ id: d!.id, title: d!.title })} · −{money(a.amount, lang)}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Compact summary line (checkout sidebar)                             */
/* ------------------------------------------------------------------ */
export function CompactLine({ line }: { line: PricedLine }) {
  const t = useDict(ck);
  const l = useL();
  const lang = useLang();
  const p = line.product;
  const name = l(p.name);
  const isPack = p.unit === 'm2' && p.packSize;
  return (
    <div className="flex gap-3.5 py-3.5">
      <div className="relative shrink-0">
        <div className="h-16 w-16 overflow-hidden rounded-xl bg-sand ring-1 ring-line">
          <Img src={p.images[0]} small alt="" className="h-full w-full object-cover" />
        </div>
        <span className="absolute -right-2 -top-2 grid h-[22px] min-w-[22px] place-items-center rounded-full bg-ink px-1.5 text-[11px] font-bold tabular-nums text-paper ring-2 ring-white">{line.item.qty}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-ink">{name}</p>
          <span className="shrink-0 text-[13.5px] font-semibold tabular-nums text-ink">{money(line.lineTotal, lang)}</span>
        </div>
        {(line.optionsLabel || isPack) && (
          <p className="mt-0.5 truncate text-[12px] text-muted">{isPack ? t('packsArea', { packs: line.item.qty, area: num(line.units, lang), unit: unitLabel('m2', lang) }) : line.optionsLabel}</p>
        )}
        {line.installationTotal > 0 && (
          <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-[11.5px] font-semibold text-brand-700">
            <ShieldPlus className="h-3 w-3" />
            {t('plusInstallation', { amount: money(line.installationTotal, lang) })}
          </p>
        )}
        <LineDiscounts line={line} className="mt-1" />
      </div>
    </div>
  );
}
