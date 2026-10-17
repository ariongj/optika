import { useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight, Banknote, CalendarCheck, CircleDot, Clock, FlaskConical, MapPin, Ruler, RotateCcw, ShieldCheck, ShieldPlus, Smartphone, Sparkles, Store, Truck, Wrench,
} from 'lucide-react';
import type { Category, Product } from '@/lib/types';
import { Img, Tabs } from '@/components/ui/misc';
import { useDict, useL, useLang } from '@/i18n';
import { useSettings } from '@/store/hooks';
import { money, num, unitLabel } from '@/lib/format';
import { priceOnRequest } from '@/lib/pricing';
import { cn } from '@/lib/utils';
import { PD } from './dict';
import { frameSize, isLensPackage, labDays } from './optical';

type Tab = 'desc' | 'specs' | 'shipping' | 'care';

export function DetailTabs({ product, category }: { product: Product; category?: Category }) {
  const t = useDict(PD);
  const [tab, setTab] = useState<Tab>('desc');
  const onReq = priceOnRequest(product);
  return (
    <section id="detalji" className="scroll-mt-28">
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        className="gap-4 sm:gap-8"
        tabs={[
          { id: 'desc', label: <span className="text-[15px] sm:text-base">{t('tab_desc')}</span> },
          { id: 'specs', label: <span className="text-[15px] sm:text-base">{t('tab_specs')}</span> },
          { id: 'shipping', label: <span className="text-[15px] sm:text-base">{onReq ? t('sg_tab') : t('tab_shipping')}</span> },
          { id: 'care', label: <span className="text-[15px] sm:text-base">{t('tab_care')}</span> },
        ]}
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="pt-8 sm:pt-10">
          {tab === 'desc' && <Description product={product} />}
          {tab === 'specs' && <Specs product={product} category={category} />}
          {tab === 'shipping' && (onReq ? <SmartOrderInfo /> : <Shipping />)}
          {tab === 'care' && <Care product={product} />}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

/* ------------------------------------------------------------------ */
function Description({ product: p }: { product: Product }) {
  const t = useDict(PD);
  const l = useL();
  const lang = useLang();
  const size = frameSize(p);
  const lens = isLensPackage(p);
  const onReq = priceOnRequest(p);
  const facts = [
    ...(onReq
      ? [
          { icon: Store, label: t('sg_fact_price'), value: t('sg_fact_priceValue') },
          { icon: CalendarCheck, label: t('sg_fact_try'), value: t('sg_fact_tryValue') },
          { icon: FlaskConical, label: t('sg_fact_rx'), value: t('sg_fact_rxValue') },
          { icon: Smartphone, label: t('sg_trust_setup'), value: t('sg_trust_setupText') },
        ]
      : []),
    p.warrantyYears ? { icon: ShieldCheck, label: t('spec_warranty'), value: t('years', { n: p.warrantyYears }) } : null,
    lens
      ? { icon: FlaskConical, label: t('spec_lead'), value: t('daysValue', { days: labDays(p) }) }
      : p.leadDays
        ? { icon: Truck, label: t('spec_delivery'), value: t('daysApprox', { n: p.leadDays }) }
        : null,
    p.installation?.available ? { icon: ShieldPlus, label: t('careTitle'), value: `${money(p.installation.price, lang, { decimals: p.installation.price % 1 !== 0 })} ${t('carePer')}` } : null,
    size ? { icon: Ruler, label: t('spec_size'), value: `${size.lens}-${size.bridge}-${size.temple}` } : null,
    p.unit === 'set' ? { icon: Sparkles, label: t('spec_unit'), value: t('unit_set') } : null,
    p.unit === 'm2' && p.packSize ? { icon: Clock, label: t('spec_unit'), value: t('unit_m2', { size: num(p.packSize, lang), unit: unitLabel('m2', lang) }) } : null,
  ].filter(Boolean) as { icon: typeof Clock; label: string; value: string }[];
  const paragraphs = l(p.description).split(/\n{2,}/).filter(Boolean);

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
      <div className="lg:col-span-7">
        <p className="display text-[26px] leading-[1.25] text-ink sm:text-[30px]">{l(p.short)}</p>
        <div className="mt-6 space-y-4 text-[16px] leading-[1.75] text-ink-soft">
          {paragraphs.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
        {p.specs.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {p.specs.slice(0, 4).map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-2 text-[13px]">
                <span className="text-muted">{l(s.label)}</span>
                <span className="font-semibold text-ink">{l(s.value)}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="lg:col-span-5">
        <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-line">
          {p.images[1] && (
            <div className="aspect-[16/10] overflow-hidden bg-sand">
              <Img src={p.images[1]} small alt="" className="h-full w-full object-cover" />
            </div>
          )}
          <div className="p-5 sm:p-6">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">{t('highlights')}</div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5">
              {facts.map((f, i) => {
                const Icon = f.icon;
                // dt/dd straight inside the group (valid <dl>); the icon sits in the term, out of the flow
                return (
                  <div key={i} className="relative min-w-0 pl-12">
                    <dt className="text-[12px] text-muted">
                      <span aria-hidden className="absolute left-0 top-0 grid h-9 w-9 place-items-center rounded-full bg-sand text-ink">
                        <Icon className="h-4 w-4" />
                      </span>
                      {f.label}
                    </dt>
                    <dd className="text-[14px] font-bold text-ink">{f.value}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
function Specs({ product: p, category }: { product: Product; category?: Category }) {
  const t = useDict(PD);
  const l = useL();
  const lang = useLang();
  const size = frameSize(p);
  const hasWarranty = p.specs.some((s) => /garanc|warrant/i.test(s.label.me + s.label.en));
  const hasLead = p.specs.some((s) => /lead time/i.test(s.label.en));
  const unitText =
    p.unit === 'm2' && p.packSize
      ? t('unit_m2', { size: num(p.packSize, lang), unit: unitLabel('m2', lang) })
      : p.unit === 'm'
        ? t('unit_m')
        : p.unit === 'set'
          ? t('unit_set')
          : t('unit_kom');
  const rows: [string, string][] = [
    ...p.specs.map((s) => [l(s.label), l(s.value)] as [string, string]),
    ...(!hasWarranty && p.warrantyYears ? [[t('spec_warranty'), t('years', { n: p.warrantyYears })] as [string, string]] : []),
    ...(!hasLead && p.leadDays ? [[isLensPackage(p) ? t('spec_lead') : t('spec_delivery'), t('daysApprox', { n: p.leadDays })] as [string, string]] : []),
    [t('spec_unit'), unitText],
    ...(category ? [[t('spec_category'), l(category.name)] as [string, string]] : []),
    [t('spec_sku'), p.sku],
  ];
  return (
    <div className={cn('grid gap-8', size && 'lg:grid-cols-12 lg:gap-12')}>
      <div className={cn(size ? 'lg:col-span-7' : 'max-w-3xl')}>
        <dl className="overflow-hidden rounded-3xl bg-white ring-1 ring-line">
          {rows.map(([k, v], i) => (
            <div key={i} className={cn('grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 px-5 py-4 text-[14.5px] sm:px-7', i % 2 === 1 && 'bg-paper/60', i > 0 && 'border-t border-line/70')}>
              <dt className="text-muted">{k}</dt>
              <dd className="font-semibold text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      {size && (
        <div className="lg:col-span-5">
          <SizeGuide size={size} />
        </div>
      )}
    </div>
  );
}

/** "Masat e kornizës" — what 49-19-142 means, drawn on a frame. */
function SizeGuide({ size }: { size: { lens: number; bridge: number; temple: number } }) {
  const t = useDict(PD);
  const label = `${size.lens}-${size.bridge}-${size.temple}`;
  const items = [
    { k: 'A', name: t('size_lens'), v: size.lens },
    { k: 'B', name: t('size_bridge'), v: size.bridge },
    { k: 'C', name: t('size_temple'), v: size.temple },
  ];
  return (
    <div className="rounded-3xl bg-sand/60 p-5 ring-1 ring-inset ring-line sm:p-7">
      <h3 className="flex items-center gap-2.5 text-lg font-bold text-ink">
        <Ruler className="h-5 w-5 text-brand-600" /> {t('sizeTitle')}
      </h3>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{t('sizeText', { size: label })}</p>

      <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-line sm:p-5">
        <svg viewBox="0 0 320 132" className="w-full text-ink" role="img" aria-label={label}>
          <defs>
            <marker id="sz-arrow" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0 L8 4 L0 8 z" fill="var(--color-brand-600)" />
            </marker>
          </defs>
          {/* front view */}
          <rect x="24" y="34" width="112" height="70" rx="30" fill="var(--color-paper)" stroke="currentColor" strokeWidth="3" />
          <rect x="184" y="34" width="112" height="70" rx="30" fill="var(--color-paper)" stroke="currentColor" strokeWidth="3" />
          <path d="M136 52 C 148 40, 172 40, 184 52" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M24 46 L8 42 M296 46 L312 42" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          {/* A — lens width */}
          <line x1="26" y1="118" x2="134" y2="118" stroke="var(--color-brand-600)" strokeWidth="1.6" markerStart="url(#sz-arrow)" markerEnd="url(#sz-arrow)" />
          <text x="80" y="129" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--color-brand-700)">A · {size.lens} mm</text>
          {/* B — bridge */}
          <line x1="138" y1="22" x2="182" y2="22" stroke="var(--color-brand-600)" strokeWidth="1.6" markerStart="url(#sz-arrow)" markerEnd="url(#sz-arrow)" />
          <text x="160" y="13" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--color-brand-700)">B · {size.bridge}</text>
        </svg>
        <svg viewBox="0 0 320 52" className="mt-3 w-full text-ink" aria-hidden>
          {/* side view — temple */}
          <path d="M14 14 L262 14 C 284 14, 296 22, 304 38" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <rect x="8" y="6" width="10" height="18" rx="3" fill="currentColor" />
          <line x1="16" y1="34" x2="300" y2="34" stroke="var(--color-brand-600)" strokeWidth="1.6" markerStart="url(#sz-arrow)" markerEnd="url(#sz-arrow)" />
          <text x="150" y="49" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--color-brand-700)">C · {size.temple} mm</text>
        </svg>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-2">
        {items.map((it) => (
          <div key={it.k} className="flex flex-col-reverse justify-end rounded-2xl bg-white px-3 py-3 text-center ring-1 ring-line">
            <dt className="mt-1 text-[11.5px] font-semibold leading-tight text-muted">
              <span className="font-bold text-brand-700">{it.k}</span> · {it.name}
            </dt>
            <dd className="text-[20px] font-bold tabular-nums text-ink">
              {it.v}
              <span className="ml-0.5 text-[12px] font-semibold text-muted">mm</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-[13px] leading-snug text-muted">{t('sizeHint')}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
function Shipping() {
  const t = useDict(PD);
  const lang = useLang();
  const settings = useSettings();
  const returns = [
    { icon: Wrench, text: t('ret1') },
    { icon: FlaskConical, text: t('ret2') },
    { icon: RotateCcw, text: t('ret3') },
  ];
  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
      <div>
        <h3 className="flex items-center gap-2.5 text-lg font-bold text-ink">
          <Truck className="h-5 w-5 text-brand-600" /> {t('zonesTitle')}
        </h3>
        <div className="mt-4 overflow-hidden rounded-3xl bg-white ring-1 ring-line">
          {settings.shippingZones.map((z, i) => (
            <div key={z.id} className={cn('flex items-start justify-between gap-4 px-5 py-4 sm:px-6', i > 0 && 'border-t border-line/70')}>
              <div className="min-w-0">
                <div className="text-[14.5px] font-bold text-ink">{z.name}</div>
                <div className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-muted">{z.cities.join(', ')}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[15px] font-bold tabular-nums text-ink">{money(z.fee, lang, { decimals: z.fee % 1 !== 0 })}</div>
                <div className="mt-0.5 text-[12px] text-muted">{t('daysValue', { days: z.days })}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-3 rounded-2xl bg-emerald-50 p-4 ring-1 ring-inset ring-emerald-600/15">
          <CalendarCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <div>
            <div className="text-[14px] font-bold text-emerald-900">{t('freeOver', { amount: money(settings.freeShippingThreshold, lang, { decimals: false }) })}</div>
            <p className="mt-0.5 text-[13px] leading-snug text-emerald-800/80">{t('freeOverText')}</p>
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-line">
            <Store className="mt-0.5 h-5 w-5 shrink-0 text-ink-soft" />
            <div>
              <div className="text-[14px] font-bold text-ink">{t('pickup')}</div>
              <p className="mt-0.5 flex items-start gap-1 text-[12.5px] leading-snug text-muted">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                {t('pickupText', { address: settings.pickupAddress })}
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-line">
            <Banknote className="mt-0.5 h-5 w-5 shrink-0 text-ink-soft" />
            <div>
              <div className="text-[14px] font-bold text-ink">{t('payTitle')}</div>
              <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{t('payText')}</p>
            </div>
          </div>
        </div>
        <Link to="/faqe/dergesa-dhe-pagesa" className="group mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink hover:text-brand-700">
          {t('deliveryLink')} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      <div>
        <h3 className="flex items-center gap-2.5 text-lg font-bold text-ink">
          <RotateCcw className="h-5 w-5 text-brand-600" /> {t('returnsTitle')}
        </h3>
        <div className="mt-4 rounded-3xl bg-ink p-6 text-paper sm:p-7">
          <ul className="space-y-5">
            {returns.map(({ icon: Icon, text }, i) => (
              <li key={i} className="flex items-start gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-brand-200">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="pt-1.5 text-[14.5px] leading-snug text-paper/85">{text}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 border-t border-white/10 pt-5">
            <div className="text-[14.5px] font-bold text-white">{t('lensTitle')}</div>
            <p className="mt-1 text-[14px] leading-relaxed text-paper/70">{t('lensText')}</p>
            <Link to="/faqe/kthimet-dhe-garancia" className="group mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-200 hover:text-white">
              {t('returnsLink')} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/** Smart glasses (no online price): how a request turns into a pair, plus the recording / privacy note. */
function SmartOrderInfo() {
  const t = useDict(PD);
  const steps = [t('sg_order1'), t('sg_order2'), t('sg_order3'), t('sg_order4')];
  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
      <div>
        <h3 className="display text-[26px] leading-tight text-ink sm:text-[30px]">{t('sg_orderTitle')}</h3>
        <ol className="mt-6 space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-4 rounded-2xl bg-white p-4 ring-1 ring-line sm:p-5">
              <span className="display grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sand text-[17px] text-ink">{i + 1}</span>
              <span className="pt-1.5 text-[15px] leading-snug text-ink-soft">{step}</span>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
          <Link to="/rezervo?sherbimi=sv-smart" className="group inline-flex min-h-10 items-center gap-1.5 text-[13.5px] font-semibold text-ink hover:text-brand-700">
            <CalendarCheck className="h-4 w-4 text-brand-600" /> {t('sg_book')} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link to="/syze-inteligjente" className="group inline-flex min-h-10 items-center gap-1.5 text-[13.5px] font-semibold text-ink hover:text-brand-700">
            {t('sg_guide')} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
      <div>
        <div className="rounded-3xl bg-ink p-6 text-paper sm:p-7">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-brand-200">
              <CircleDot className="h-[18px] w-[18px]" />
            </span>
            <h3 className="text-[16px] font-bold text-white">{t('sg_privacyTitle')}</h3>
          </div>
          <p className="mt-4 text-[14.5px] leading-relaxed text-paper/75">{t('sg_privacyText')}</p>
        </div>
        <p className="mt-4 px-1 text-[12.5px] leading-snug text-muted">{t('sg_note')}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
function Care({ product: p }: { product: Product }) {
  const t = useDict(PD);
  const tips = [t('care1'), t('care2'), t('care3'), t('care4'), t('care5')];
  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
      <div className="lg:col-span-7">
        <h3 className="display text-[26px] leading-tight text-ink sm:text-[30px]">{t('careTabTitle')}</h3>
        <ol className="mt-6 space-y-3">
          {tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-4 rounded-2xl bg-white p-4 ring-1 ring-line sm:p-5">
              <span className="display grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sand text-[17px] text-ink">{i + 1}</span>
              <span className="pt-1.5 text-[15px] leading-snug text-ink-soft">{tip}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="lg:col-span-5">
        <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-line">
          <div className="aspect-[3/2] overflow-hidden bg-sand">
            <Img src="/images/s/riparime.webp" small alt="" className="h-full w-full object-cover" />
          </div>
          <div className="p-5 sm:p-6">
            <div className="flex items-center gap-2.5 text-[16px] font-bold text-ink">
              <ShieldPlus className="h-5 w-5 text-brand-600" /> {t('careVisitTitle')}
            </div>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{p.installation?.available ? t('careVisitText') : t('sizeHint')}</p>
            {p.installation?.available && (
              <Link to="/faqe/kujdes-plus" className="group mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink hover:text-brand-700">
                {t('careLink')} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
