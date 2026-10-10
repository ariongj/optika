import { forwardRef, type ComponentType, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  AlertCircle,
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  Check,
  Copy,
  CreditCard,
  FlaskConical,
  MapPin,
  PackageCheck,
  PackageSearch,
  Phone,
  ShieldPlus,
  Store,
  Truck,
  X,
} from 'lucide-react';
import { Accent, Badge, Img, type BadgeTone } from '@/components/ui/misc';
import { ButtonLink } from '@/components/ui/Button';
import { WhatsAppIcon } from '@/components/brand/Social';
import { useDict, useL, useLang } from '@/i18n';
import { common } from '@/i18n/common';
import { useDb } from '@/store/db';
import { useSettings } from '@/store/hooks';
import { date, dateTime, money, unitLabel } from '@/lib/format';
import { fulfillmentOf, paymentOf } from '@/lib/orders';
import type { Booking, Order, PaymentState, Product } from '@/lib/types';
import { cn } from '@/lib/utils';
import { timeRange } from '@/admin/components/appointments/dates';
import { telHref } from '@/site/components/content/posts';
import { STAGES, cancelledAt, labEta, lastUpdate, stageDates, stageIndex, usesLab } from './tracking';
import { tr } from './trackDict';
import { longDay, midDay } from './Pickers';

type TT = ReturnType<typeof useDict<typeof tr.me>>;

const PAY_TONE: Record<PaymentState, BadgeTone> = { pending: 'amber', authorized: 'blue', paid: 'green', partially_refunded: 'violet', refunded: 'gray', failed: 'red' };

/* ------------------------------------------------------------------ */
/* Before / failed lookup                                              */
/* ------------------------------------------------------------------ */
export function TrackEmpty() {
  const t = useDict(tr);
  const items = [t('e1'), t('e2'), t('e3')];
  return (
    <div className="flex h-full flex-col justify-center rounded-3xl bg-white p-7 ring-1 ring-line sm:p-10">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-sand text-ink-soft">
        <PackageCheck className="h-7 w-7" strokeWidth={1.6} />
      </span>
      <h2 className="display mt-6 text-[30px] leading-tight text-ink sm:text-[36px]">{t('emptyTitle')}</h2>
      <p className="mt-2 max-w-md text-[15px] leading-relaxed text-muted">{t('emptyText')}</p>
      <ol className="mt-7 space-y-3">
        {items.map((x, i) => (
          <li key={x} className="flex items-center gap-3 text-[14.5px] font-medium text-ink-soft">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-paper text-[13px] font-bold text-ink ring-1 ring-inset ring-line">{i + 1}</span>
            {x}
          </li>
        ))}
      </ol>
    </div>
  );
}

export const TrackError = forwardRef<HTMLHeadingElement, { kind: 'notFound' | 'mismatch'; onRetry: () => void }>(function TrackError({ kind, onRetry }, ref) {
  const t = useDict(tr);
  const settings = useSettings();
  const nf = kind === 'notFound';
  const tips = nf ? [t('nf1'), t('nf2'), t('nf3')] : [t('mm1'), t('mm2')];
  return (
    <div role="alert" className="rounded-3xl bg-white p-7 ring-1 ring-line sm:p-10">
      <span className={cn('grid h-14 w-14 place-items-center rounded-2xl', nf ? 'bg-sand text-ink-soft' : 'bg-amber-50 text-amber-700')}>
        {nf ? <PackageSearch className="h-7 w-7" strokeWidth={1.6} /> : <AlertCircle className="h-7 w-7" strokeWidth={1.6} />}
      </span>
      <h2 ref={ref} tabIndex={-1} className="display mt-6 text-[30px] leading-tight text-ink outline-none sm:text-[34px]">
        {nf ? t('nfTitle') : t('mmTitle')}
      </h2>
      <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted">{nf ? t('nfText') : t('mmText')}</p>
      <ul className="mt-6 space-y-2.5">
        {tips.map((x) => (
          <li key={x} className="flex items-start gap-2.5 text-[14px] leading-snug text-ink-soft">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
            {x}
          </li>
        ))}
      </ul>
      <div className="mt-7 flex flex-wrap gap-2.5">
        <button type="button" onClick={onRetry} className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[14px] font-semibold text-paper transition hover:bg-ink-soft">
          {t('tryAgain')}
        </button>
        <a href={telHref(settings.phone)} className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-white px-5 text-[14px] font-semibold text-ink transition hover:border-ink/30">
          <Phone className="h-4 w-4" /> {settings.phone}
        </a>
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Result                                                              */
/* ------------------------------------------------------------------ */
export const TrackResult = forwardRef<HTMLHeadingElement, { order: Order; bookings: Booking[]; onCopy: (n: string) => void }>(function TrackResult({ order, bookings, onCopy }, ref) {
  const t = useDict(tr);
  const tc = useDict(common);
  const lang = useLang();
  const settings = useSettings();
  const products = useDb((s) => s.products);
  const lab = usesLab(order, products);
  const pickup = order.delivery.method === 'pickup';
  const cancelled = order.status === 'cancelled';
  const status = statusLabel(order, lab, t);
  const eta = labEta(order, products);

  const next = t(nextKey(order, lab), { address: settings.pickupAddress, date: date(cancelledAt(order) ?? lastUpdate(order), lang, { day: 'numeric', month: 'long' }) });

  return (
    <div className="space-y-5">
      {/* Header + progress */}
      <section className="rounded-3xl bg-white p-5 ring-1 ring-line sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="eyebrow">{t('orderNo', { n: order.number })}</div>
            <h2 ref={ref} tabIndex={-1} className="display mt-1.5 text-[32px] leading-[1.05] text-ink outline-none sm:text-[40px]">
              {status}
            </h2>
            <p className="mt-2 text-[13px] text-muted">
              {t('placed', { date: dateTime(order.createdAt, lang) })} · {t('updated', { date: dateTime(lastUpdate(order), lang) })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onCopy(order.number)}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-sand px-4 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-ink hover:text-paper"
          >
            <Copy className="h-3.5 w-3.5" /> {t('copy')}
          </button>
        </div>

        <p className={cn('mt-5 flex items-start gap-3 rounded-2xl px-4 py-3.5 text-[14.5px] leading-relaxed ring-1 ring-inset', cancelled ? 'bg-red-50 text-red-800 ring-red-600/15' : 'bg-paper text-ink-soft ring-line')}>
          {cancelled ? <X className="mt-0.5 h-4 w-4 shrink-0" /> : <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-brand-600" />}
          {next}
        </p>

        <Progress order={order} lab={lab} t={t} />

        {eta && (
          <div className="mt-6 flex items-start gap-3.5 rounded-2xl bg-brand-600 p-4 text-white sm:p-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15">
              <FlaskConical className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/65">{t('labTitle')}</div>
              {eta.date.getTime() >= startToday() ? (
                <>
                  <p className="mt-0.5 text-[16px] font-semibold">{t('labEta', { date: midDay(eta.date, lang) })}</p>
                  <p className="mt-0.5 text-[13px] text-white/75">{t('labDays', { n: eta.days })}</p>
                </>
              ) : (
                <p className="mt-0.5 text-[14.5px] font-medium">{t('labLate')}</p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Payment · fulfilment · method · tracking */}
      <section className="grid gap-px overflow-hidden rounded-3xl bg-line ring-1 ring-line sm:grid-cols-2">
        <Fact icon={CreditCard} label={t('payment')}>
          <span className="block">{tc(`pay_${order.payment.method}`)}</span>
          <Badge tone={PAY_TONE[paymentOf(order)]} dot className="mt-2">
            {t(`pay_${paymentOf(order)}`)}
          </Badge>
        </Fact>
        <Fact icon={PackageCheck} label={t('fulfilment')}>
          <Badge tone={cancelled ? 'red' : order.status === 'completed' ? 'green' : 'sand'} dot className="mt-0.5">
            {t(cancelled ? 'ful_cancelled' : fulfilmentKey(order))}
          </Badge>
        </Fact>
        <Fact icon={pickup ? Store : Truck} label={t('method')}>
          <span className="block">{tc(`delivery_${order.delivery.method}`)}</span>
          <span className="mt-0.5 block text-[13px] font-normal text-muted">
            {pickup ? settings.pickupAddress : [order.customer.address, order.customer.city].filter(Boolean).join(', ')}
          </span>
        </Fact>
        <Fact icon={MapPin} label={t('tracking')}>
          {order.fulfillment?.tracking ? (
            <span className="block tabular-nums">
              {order.fulfillment.tracking}
              {order.fulfillment.carrier && <span className="block text-[13px] font-normal text-muted">{order.fulfillment.carrier}</span>}
            </span>
          ) : (
            <span className="block text-[13.5px] font-normal text-muted">{pickup ? t('trackingPickup') : cancelled ? '—' : t('trackingLater')}</span>
          )}
        </Fact>
      </section>

      {/* Lines */}
      <section className="overflow-hidden rounded-3xl bg-white ring-1 ring-line">
        <h3 className="border-b border-line px-5 py-4 text-[15px] font-bold text-ink sm:px-6">{t('items')}</h3>
        <ul className="divide-y divide-line px-5 sm:px-6">
          {order.items.map((it, i) => (
            <Line key={i} it={it} products={products} />
          ))}
        </ul>
        <div className="flex items-baseline justify-between gap-4 border-t border-line bg-paper/60 px-5 py-4 sm:px-6">
          <span className="text-[14px] font-semibold text-ink">
            {t('total')} <span className="text-[12px] font-normal text-muted">· {t('vat')}</span>
          </span>
          <span className="text-[20px] font-bold tabular-nums text-ink">{money(order.total, lang)}</span>
        </div>
      </section>

      <Appointments bookings={bookings} />
      <Help order={order} />
    </div>
  );
});

const startToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

function statusLabel(o: Order, lab: boolean, t: TT) {
  switch (o.status) {
    case 'processing':
      return t(lab ? 'st_lab' : 'st_processing');
    case 'installation':
      return t('st_ready');
    default:
      return t(`st_${o.status}`);
  }
}

function nextKey(o: Order, lab: boolean) {
  switch (o.status) {
    case 'cancelled':
      return 'next_cancelled' as const;
    case 'shipped':
    case 'installation':
    case 'completed':
      return `next_${o.status}` as const;
    default:
      return lab ? (`next_${o.status}Rx` as const) : (`next_${o.status}` as const);
  }
}

function fulfilmentKey(o: Order) {
  const f = fulfillmentOf(o);
  if (f === 'fulfilled' && o.delivery.method === 'pickup') return 'ful_ready' as const;
  return `ful_${f}` as const;
}

function Fact({ icon: Icon, label, children }: { icon: ComponentType<{ className?: string }>; label: string; children: ReactNode }) {
  return (
    <div className="bg-white p-5 sm:p-6">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-[14px] font-semibold text-ink">{children}</div>
    </div>
  );
}

/** Horizontal stepper on wide screens, vertical list on phones. */
function Progress({ order, lab, t }: { order: Order; lab: boolean; t: TT }) {
  const lang = useLang();
  const idx = stageIndex(order);
  const dates = stageDates(order);
  const cancelled = order.status === 'cancelled';
  const pickup = order.delivery.method === 'pickup';
  const label = (s: (typeof STAGES)[number]) =>
    s === 'processing' ? t(lab ? 'st_lab' : 'st_processing') : s === 'ready' ? t(pickup ? 'st_ready' : 'st_shipped') : t(`st_${s}`);
  type StepState = 'done' | 'current' | 'todo' | 'cancelled';
  const steps: { key: string; label: string; at?: string; state: StepState }[] = STAGES.map((s, i) => ({
    key: s,
    label: label(s),
    at: i <= idx ? dates[i] : undefined,
    state: i < idx || (i === idx && (order.status === 'completed' || cancelled)) ? 'done' : i === idx ? 'current' : 'todo',
  }));
  if (cancelled) steps.splice(idx + 1, steps.length, { key: 'cancelled', label: t('st_cancelled'), at: cancelledAt(order), state: 'cancelled' });

  return (
    <ol aria-label={t('progress')} className={cn('mt-7 grid gap-0 md:gap-2', cancelled ? 'md:grid-cols-[repeat(var(--n),minmax(0,1fr))]' : 'md:grid-cols-5')} style={{ ['--n' as string]: steps.length }}>
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={`${s.key}-${i}`} aria-current={s.state === 'current' ? 'step' : undefined} className={cn('relative flex gap-3.5 md:flex-col md:gap-2.5', !last && 'pb-5 md:pb-0')}>
            {!last && (
              <span
                aria-hidden
                className={cn(
                  'absolute left-[15px] top-8 h-[calc(100%-32px)] w-0.5 md:left-8 md:top-[15px] md:h-0.5 md:w-[calc(100%-24px)]',
                  s.state === 'done' && steps[i + 1].state !== 'cancelled' ? 'bg-brand-600' : 'bg-line',
                )}
              />
            )}
            <span
              className={cn(
                'relative z-[1] grid h-8 w-8 shrink-0 place-items-center rounded-full text-[12px] font-bold',
                s.state === 'done' && 'bg-brand-600 text-white',
                s.state === 'current' && 'bg-white text-brand-700 ring-2 ring-brand-600 shadow-[0_0_0_5px_var(--color-brand-100)]',
                s.state === 'todo' && 'bg-paper text-muted ring-1 ring-inset ring-line',
                s.state === 'cancelled' && 'bg-red-600 text-white',
              )}
            >
              {s.state === 'done' ? <Check className="h-4 w-4" strokeWidth={2.8} /> : s.state === 'cancelled' ? <X className="h-4 w-4" strokeWidth={2.8} /> : i + 1}
            </span>
            <span className="min-w-0 pt-1 md:pt-0">
              <span className={cn('block text-[14px] font-semibold leading-snug', s.state === 'todo' ? 'text-muted' : s.state === 'cancelled' ? 'text-red-700' : 'text-ink')}>{s.label}</span>
              {s.at && s.state !== 'todo' && <span className="mt-0.5 block text-[12px] text-muted">{date(s.at, lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
              {s.state === 'current' && (
                <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-brand-700">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-600" />
                  </span>
                  {t('current')}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Line({ it, products }: { it: Order['items'][number]; products: Product[] }) {
  const t = useDict(tr);
  const lang = useLang();
  const p = products.find((x) => x.id === it.productId);
  const href = p && p.status !== 'archived' ? `/produkt/${p.slug}` : undefined;
  const name = <span className="line-clamp-2 text-[14px] font-semibold leading-snug text-ink">{it.name}</span>;
  return (
    <li className="flex gap-3.5 py-4">
      <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-sand ring-1 ring-line">{it.image && <Img src={it.image} small alt="" className="h-full w-full object-cover" />}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          {href ? (
            <Link to={href} className="hover:underline">
              {name}
            </Link>
          ) : (
            name
          )}
          <span className="shrink-0 text-[14px] font-semibold tabular-nums text-ink">{money(it.lineTotal, lang)}</span>
        </div>
        <p className="mt-0.5 text-[12.5px] text-muted">
          {t('qty', { n: it.qty, unit: unitLabel(it.unit, lang) })}
          {it.options && <span className="block">{it.options}</span>}
        </p>
        {it.installation && (
          <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-[11.5px] font-semibold text-brand-700">
            <ShieldPlus className="h-3 w-3" />
            {t('care')}
          </p>
        )}
      </div>
    </li>
  );
}

function Appointments({ bookings }: { bookings: Booking[] }) {
  const t = useDict(tr);
  const l = useL();
  const lang = useLang();
  const services = useDb((s) => s.services);
  if (!bookings.length) return null;
  return (
    <section className="rounded-3xl bg-white p-5 ring-1 ring-line sm:p-6">
      <h3 className="display text-[24px] leading-tight text-ink">
        <Accent text={t('apptTitle')} />
      </h3>
      <p className="mt-1 text-[13px] text-muted">{t('apptText')}</p>
      <ul className="mt-4 space-y-2.5">
        {bookings.map((b) => {
          const svc = services.find((s) => s.id === b.serviceId);
          return (
            <li key={b.id} className="flex items-center gap-3.5 rounded-2xl bg-paper px-4 py-3 ring-1 ring-inset ring-line">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-brand-600 ring-1 ring-line">
                <CalendarClock className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-ink">{svc ? l(svc.name) : '—'}</span>
                <span className="block text-[12.5px] text-muted">
                  {longDay(b.start, lang)} · {timeRange(b.start, b.durationMin)}
                </span>
              </span>
              <Badge tone={b.status === 'confirmed' ? 'green' : 'amber'} dot>
                {t(b.status === 'confirmed' ? 'appt_confirmed' : 'appt_pending')}
              </Badge>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Help({ order }: { order: Order }) {
  const t = useDict(tr);
  const settings = useSettings();
  const wa = (settings.whatsapp ?? '').replace(/\D/g, '');
  const pickupReady = order.status === 'installation';
  return (
    <section className="relative overflow-hidden rounded-3xl bg-ink p-6 text-paper sm:p-8">
      <div className="bg-grain pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative">
        <h3 className="display text-[26px] leading-tight text-white sm:text-[30px]">
          <Accent text={t('helpTitle')} accentClassName="text-brand-200!" />
        </h3>
        <p className="mt-1.5 text-[14px] text-paper/65">{t('helpText', { n: order.number })}</p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          {wa && (
            <a
              href={`https://wa.me/${wa}?text=${encodeURIComponent(t('waMsg', { n: order.number }))}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[#25d366] px-5 text-[14px] font-semibold text-white transition hover:brightness-95"
            >
              <WhatsAppIcon className="h-[18px] w-[18px]" /> {t('whatsapp')}
            </a>
          )}
          <a href={telHref(settings.phone)} className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-semibold text-ink transition hover:bg-sand">
            <Phone className="h-4 w-4" /> {t('call')}
          </a>
          <ButtonLink to="/rezervo?sherbimi=sv-marrja" variant="outlineLight" icon={<CalendarCheck className="h-4 w-4" />}>
            {t(pickupReady ? 'bookPickup' : 'bookFitting')}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
