import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Hash, Phone, Search, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { WhatsAppIcon } from '@/components/brand/Social';
import { useDict } from '@/i18n';
import { useDb } from '@/store/db';
import { useSettings } from '@/store/hooks';
import { PageHero } from '@/site/components/SectionHeading';
import { usePageTitle } from '@/site/layout/SiteLayout';
import { useCopy } from '@/site/components/checkout/parts';
import { telHref } from '@/site/components/content/posts';
import { lookupOrder, upcomingFor } from '@/site/components/booking/tracking';
import { tr } from '@/site/components/booking/trackDict';
import { TrackEmpty, TrackError, TrackResult } from '@/site/components/booking/TrackResult';
import { useNow } from '@/site/components/booking/parts';

type Result = { kind: 'ok'; orderId: string } | { kind: 'notFound' } | { kind: 'mismatch' };

function lookup(number: string, contact: string): Result {
  const st = useDb.getState();
  const r = lookupOrder(st.orders, number, contact, st.settings.orderPrefix);
  return r.kind === 'ok' ? { kind: 'ok', orderId: r.order.id } : r;
}

/**
 * /gjurmo-porosine — order tracking. The order is shown only when the number AND the e-mail / phone match.
 * Deep link: ?nr=OM-1234&kontakt=… (the contact is removed from the address bar after the lookup).
 */
export default function OrderTracking() {
  const t = useDict(tr);
  usePageTitle(t('pageTitle'));
  const orders = useDb((s) => s.orders);
  const bookings = useDb((s) => s.bookings);
  const settings = useSettings();
  const copy = useCopy();
  const now = useNow();
  const [params, setParams] = useSearchParams();
  const [number, setNumber] = useState(() => params.get('nr') ?? '');
  const [contact, setContact] = useState(() => params.get('kontakt') ?? '');
  const [errors, setErrors] = useState<{ number?: string; contact?: string }>({});
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<Result | null>(() => {
    const n = params.get('nr');
    const c = params.get('kontakt');
    return n && c ? lookup(n, c) : null;
  });
  const heading = useRef<HTMLHeadingElement>(null);
  const numberInput = useRef<HTMLInputElement>(null);
  const timer = useRef<number | undefined>(undefined);

  // Kept by id, so status changes made in the CMS meanwhile show up live.
  const order = result?.kind === 'ok' ? orders.find((o) => o.id === result.orderId) : undefined;
  const upcoming = useMemo(() => (order ? upcomingFor(order.customer, bookings, now) : []), [order, bookings, now]);

  // Personal data doesn't stay in the address bar / history.
  useEffect(() => {
    if (!params.has('kontakt')) return;
    const nr = params.get('nr');
    setParams(nr ? { nr } : {}, { replace: true, preventScrollReset: true });
  }, [params, setParams]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Move focus to the outcome (screen readers) and bring it into view on phones.
  useEffect(() => {
    if (!result || checking) return;
    const el = heading.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    if (window.matchMedia('(max-width: 1023px)').matches) el.closest('section,div[role=alert]')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [result, checking]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const err: typeof errors = {};
    if (!number.trim()) err.number = t('required');
    if (!contact.trim()) err.contact = t('required');
    setErrors(err);
    if (err.number || err.contact) return;
    setChecking(true);
    setResult(null);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setResult(lookup(number, contact));
      setChecking(false);
    }, 450);
  };

  const retry = () => {
    setResult(null);
    numberInput.current?.focus();
    numberInput.current?.select();
  };

  const wa = (settings.whatsapp ?? '').replace(/\D/g, '');

  return (
    <>
      <PageHero eyebrow={t('eyebrow')} title={t('title')} subtitle={t('lead')} crumbs={[{ label: t('crumb') }]} />

      <section className="container-x grid grid-cols-1 items-start gap-6 py-10 sm:py-14 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[400px_minmax(0,1fr)]">
        <form onSubmit={submit} noValidate aria-busy={checking} className="rounded-3xl bg-white p-6 ring-1 ring-line sm:p-8 lg:sticky lg:top-[100px]">
          <h2 className="display text-[28px] leading-tight text-ink">{t('formTitle')}</h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{t('formText')}</p>
          <div className="mt-6 space-y-4">
            <Input
              ref={numberInput}
              label={t('number')}
              required
              value={number}
              onChange={(e) => {
                setNumber(e.target.value.toUpperCase());
                if (errors.number) setErrors((x) => ({ ...x, number: undefined }));
              }}
              error={errors.number}
              hint={t('numberHint')}
              placeholder="OM-1234"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={40}
              leading={<Hash className="h-4 w-4" />}
            />
            <Input
              label={t('contact')}
              required
              value={contact}
              onChange={(e) => {
                setContact(e.target.value);
                if (errors.contact) setErrors((x) => ({ ...x, contact: undefined }));
              }}
              error={errors.contact}
              placeholder={t('contactPh')}
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              maxLength={160}
            />
          </div>
          <Button type="submit" size="lg" loading={checking} icon={<Search className="h-4 w-4" />} className="mt-6 w-full">
            {checking ? t('checking') : t('submit')}
          </Button>
          <p className="mt-4 flex items-start gap-2 text-[12.5px] leading-snug text-muted">
            <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-brand-600" />
            {t('privacy')}
          </p>
          <div className="mt-6 border-t border-line pt-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">{t('help')}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={telHref(settings.phone)} className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-white px-4 text-[13.5px] font-semibold text-ink transition hover:border-ink/30">
                <Phone className="h-4 w-4" /> {settings.phone}
              </a>
              {wa && (
                <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full bg-[#25d366] px-4 text-[13.5px] font-semibold text-white transition hover:brightness-95">
                  <WhatsAppIcon className="h-4 w-4" /> WhatsApp
                </a>
              )}
            </div>
          </div>
        </form>

        <div aria-live="polite" aria-busy={checking} className="min-w-0">
          {checking ? (
            <ResultSkeleton />
          ) : order ? (
            <TrackResult ref={heading} order={order} bookings={upcoming} onCopy={copy} />
          ) : result && result.kind !== 'ok' ? (
            <TrackError ref={heading} kind={result.kind} onRetry={retry} />
          ) : result ? (
            <TrackError ref={heading} kind="notFound" onRetry={retry} />
          ) : (
            <TrackEmpty />
          )}
        </div>
      </section>
    </>
  );
}

function ResultSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <div className="rounded-3xl bg-white p-6 ring-1 ring-line sm:p-8">
        <div className="skeleton h-3 w-32 rounded-full" />
        <div className="skeleton mt-4 h-9 w-2/3 rounded-xl" />
        <div className="skeleton mt-6 h-14 w-full rounded-2xl" />
        <div className="mt-7 grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="skeleton h-8 rounded-full" />
          ))}
        </div>
      </div>
      <div className="skeleton h-40 rounded-3xl" />
    </div>
  );
}
