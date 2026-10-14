import { useMemo, useState, type ComponentType } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight, ArrowUpRight, AudioLines, CalendarCheck, Camera, Check, CircleDot, FlaskConical, Minus, MonitorSmartphone, Ruler, Send, ShieldPlus, Smartphone, Sparkles,
  UserCheck, Wrench, type LucideIcon,
} from 'lucide-react';
import type { Product } from '@/lib/types';
import { Accordion, Img, Reveal } from '@/components/ui/misc';
import { ButtonLink } from '@/components/ui/Button';
import { WhatsAppIcon } from '@/components/brand/Social';
import { SectionHeading } from '@/site/components/SectionHeading';
import { ProductCard } from '@/site/components/ProductCard';
import { MeasureForm } from '@/site/components/MeasureForm';
import { waHref } from '@/site/components/company/data';
import { useDict, useL } from '@/i18n';
import { useSettings } from '@/store/hooks';
import { cn } from '@/lib/utils';
import { IllustrationChip } from './illustration';
import { SG } from './dict';

/** The few dictionary keys the comparison cells need (a full SG translator is assignable). */
type T = (key: 'v_model' | 'v_yes' | 'v_no') => string;
export const BOOK_SMART = '/rezervo?sherbimi=sv-smart';

/* ------------------------------------------------------------------ */
/* What you can do                                                     */
/* ------------------------------------------------------------------ */
export function CanDo() {
  const t = useDict(SG);
  const items: { icon: LucideIcon; title: string; text: string; badge?: string }[] = [
    { icon: Camera, title: t('can1Title'), text: t('can1Text') },
    { icon: AudioLines, title: t('can2Title'), text: t('can2Text') },
    { icon: Sparkles, title: t('can3Title'), text: t('can3Text') },
    { icon: MonitorSmartphone, title: t('can4Title'), text: t('can4Text'), badge: t('can4Badge') },
  ];
  return (
    <section className="py-20 sm:py-28">
      <div className="container-x">
        <Reveal>
          <SectionHeading eyebrow={t('canEyebrow')} title={t('canTitle')} />
        </Reveal>
        <div className="mt-10 grid gap-3 sm:mt-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {items.map(({ icon: Icon, title, text, badge }, i) => (
            <Reveal key={title} delay={i * 70}>
              <article className="flex h-full items-start gap-4 rounded-3xl bg-white p-4 ring-1 ring-line sm:flex-col sm:gap-0 sm:p-6">
                <div className="flex shrink-0 items-center justify-between gap-3 sm:w-full">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700 sm:h-12 sm:w-12">
                    <Icon className="h-[21px] w-[21px]" strokeWidth={1.75} />
                  </span>
                  {badge && <span className="hidden rounded-full bg-sand px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-soft sm:inline">{badge}</span>}
                </div>
                <div className="min-w-0 sm:mt-5">
                  <h3 className="text-[16px] font-bold leading-snug text-ink sm:text-[17px]">
                    {title}
                    {badge && <span className="ml-2 inline-block rounded-full bg-sand px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-[0.12em] text-ink-soft sm:hidden">{badge}</span>}
                  </h3>
                  <p className="mt-1 text-[14px] leading-relaxed text-muted sm:mt-2 sm:text-[14.5px]">{text}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Three kinds — comparison cards                                      */
/* ------------------------------------------------------------------ */
type Cell = boolean | 'model';
const TYPES: { id: string; name: 'type1Name' | 'type2Name' | 'type3Name'; text: 'type1Text' | 'type2Text' | 'type3Text'; image: string; products: string[]; rows: Cell[] }[] = [
  // rows: camera, audio, assistant, display, prescription
  { id: 'camera', name: 'type1Name', text: 'type1Text', image: '/images/smart/rayban-meta-wayfarer.webp', products: ['p-rayban-meta-wayfarer', 'p-rayban-meta-aviator', 'p-rayban-meta-zena', 'p-oakley-meta-hstn'], rows: [true, true, true, false, 'model'] },
  { id: 'audio', name: 'type2Name', text: 'type2Text', image: '/images/smart/rayban-meta-audio.webp', products: ['p-rayban-meta-audio'], rows: [false, true, true, false, true] },
  { id: 'display', name: 'type3Name', text: 'type3Text', image: '/images/smart/meta-rayban-display.webp', products: ['p-meta-rayban-display'], rows: [ 'model', 'model', true, true, 'model'] },
];
const ROWS = ['row_camera', 'row_audio', 'row_assistant', 'row_display', 'row_rx'] as const;

function CellValue({ v, t }: { v: Cell; t: T }) {
  if (v === 'model') return <span className="text-[12.5px] font-semibold text-oak">{t('v_model')}</span>;
  return v ? (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-white">
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
      {t('v_yes')}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-sand text-muted">
        <Minus className="h-3 w-3" strokeWidth={3} />
      </span>
      {t('v_no')}
    </span>
  );
}

export function TypesCompare({ products }: { products: Product[] }) {
  const t = useDict(SG);
  const l = useL();
  return (
    <section className="border-y border-line bg-white/50 py-20 sm:py-28">
      <div className="container-x">
        <Reveal>
          <SectionHeading eyebrow={t('typesEyebrow')} title={t('typesTitle')} subtitle={t('typesText')} />
        </Reveal>
        <div className="no-scrollbar -mx-4 mt-10 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:mt-12 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-5 lg:overflow-visible lg:px-0 lg:pb-0">
          {TYPES.map((ty, i) => {
            const models = ty.products.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => !!p);
            return (
              <Reveal key={ty.id} delay={i * 80} className="w-[86%] shrink-0 snap-start sm:w-[58%] lg:w-auto">
                <article className="flex h-full flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-line">
                  <div className="relative aspect-[16/9] overflow-hidden bg-sand">
                    <Img src={ty.image} small alt="" className="absolute inset-0 h-full w-full object-cover" />
                    <span className="absolute left-4 top-4 rounded-full bg-ink px-3 py-1 text-[11px] font-bold tabular-nums tracking-[0.14em] text-paper">0{i + 1}</span>
                  </div>
                  <div className="flex flex-1 flex-col p-5 sm:p-6">
                    <h3 className="display text-[26px] leading-tight text-ink">{t(ty.name)}</h3>
                    <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{t(ty.text)}</p>
                    <dl className="mt-5 divide-y divide-line/70 border-y border-line/70">
                      {ROWS.map((row, r) => (
                        <div key={row} className="flex min-h-11 items-center justify-between gap-3 py-2">
                          <dt className="text-[13.5px] text-ink-soft">{t(row)}</dt>
                          <dd className="shrink-0 text-right">
                            <CellValue v={ty.rows[r]} t={t} />
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {models.length > 0 && (
                      <div className="mt-auto pt-5">
                        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">{t('typesModels')}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {models.map((p) => (
                            <Link
                              key={p.id}
                              to={`/produkt/${p.slug}`}
                              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-paper px-3.5 py-1.5 text-[13px] font-semibold text-ink transition-colors hover:border-ink/30 hover:bg-white"
                            >
                              {l(p.name).replace(/\s*\(Gen 3\)$/, '')}
                              <ArrowUpRight className="h-3.5 w-3.5 text-muted" />
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The models (store products in the smart-glasses category)            */
/* ------------------------------------------------------------------ */
export function Models({ products, categorySlug }: { products: Product[]; categorySlug?: string }) {
  const t = useDict(SG);
  if (!products.length) return null;
  return (
    <section id="modelet" className="scroll-mt-24 py-20 sm:py-28">
      <div className="container-x">
        <Reveal>
          <SectionHeading
            eyebrow={t('modelsEyebrow')}
            title={t('modelsTitle')}
            subtitle={t('modelsText')}
            action={
              categorySlug && (
                <ButtonLink to={`/produktet/${categorySlug}`} variant="outline" iconRight={<ArrowRight className="h-4 w-4" />}>
                  {t('modelsAll')}
                </ButtonLink>
              )
            }
          />
        </Reveal>
        <div className="mt-10 grid grid-cols-2 gap-x-3 gap-y-9 sm:mt-12 sm:gap-x-5 lg:grid-cols-3 xl:grid-cols-6 xl:gap-x-5">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 2} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Why buy them at an optician                                         */
/* ------------------------------------------------------------------ */
export function WhyOptician() {
  const t = useDict(SG);
  const items: { icon: ComponentType<{ className?: string }>; title: string; text: string; to?: string; link?: string }[] = [
    { icon: FlaskConical, title: t('why1Title'), text: t('why1Text'), to: '/optical-lab', link: t('whyLab') },
    { icon: Ruler, title: t('why2Title'), text: t('why2Text'), to: '/lentet', link: t('whyLens') },
    { icon: Smartphone, title: t('why3Title'), text: t('why3Text') },
    { icon: UserCheck, title: t('why4Title'), text: t('why4Text'), to: BOOK_SMART, link: t('whyBook') },
    { icon: Wrench, title: t('why5Title'), text: t('why5Text') },
    { icon: ShieldPlus, title: t('why6Title'), text: t('why6Text') },
  ];
  return (
    <section className="bg-sand/60 py-20 sm:py-28">
      <div className="container-x grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-5">
          <Reveal>
            <SectionHeading eyebrow={t('whyEyebrow')} title={t('whyTitle')} subtitle={t('whyText')} />
            <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-3xl bg-ink sm:mt-10 lg:aspect-[4/3]">
              <Img src="/images/s/pershtatja.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
            </div>
          </Reveal>
        </div>
        <ul className="grid content-start gap-3 sm:grid-cols-2 lg:col-span-7 lg:gap-4">
          {items.map(({ icon: Icon, title, text, to, link }, i) => (
            <Reveal key={title} as="li" delay={(i % 2) * 70}>
              <div className="flex h-full items-start gap-4 rounded-3xl bg-white p-4 ring-1 ring-line sm:flex-col sm:gap-0 sm:p-6">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col self-stretch sm:mt-4">
                  <h3 className="text-[16px] font-bold leading-snug text-ink sm:text-[16.5px]">{title}</h3>
                  <p className="mt-1 text-[14px] leading-relaxed text-muted sm:mt-1.5 sm:text-[14.5px]">{text}</p>
                  {to && link && (
                    <Link to={to} className="group mt-auto inline-flex min-h-10 items-center gap-1.5 pt-2 text-[13.5px] font-semibold text-ink hover:text-brand-700 sm:pt-3">
                      {link} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  )}
                </div>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Privacy & etiquette                                                 */
/* ------------------------------------------------------------------ */
export function PrivacyBlock() {
  const t = useDict(SG);
  const items = [t('priv1'), t('priv2'), t('priv3'), t('priv4')];
  return (
    <section className="py-20 sm:py-28">
      <div className="container-x">
        <Reveal>
          <div className="bg-grain relative overflow-hidden rounded-[32px] bg-ink px-6 py-12 sm:px-10 sm:py-14 lg:grid lg:grid-cols-12 lg:gap-12 lg:px-16 lg:py-16">
            <div className="lg:col-span-5">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-brand-200 ring-1 ring-white/15">
                <CircleDot className="h-5 w-5" />
              </span>
              <SectionHeading className="mt-6" tone="light" eyebrow={t('privEyebrow')} title={t('privTitle')} />
            </div>
            <ol className="mt-8 space-y-4 lg:col-span-7 lg:mt-0">
              {items.map((it, i) => (
                <li key={i} className="flex items-start gap-4">
                  <span className="display grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-[16px] text-brand-200">{i + 1}</span>
                  <span className="pt-1.5 text-[15.5px] leading-relaxed text-paper/85">{it}</span>
                </li>
              ))}
            </ol>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */
export function SmartFaq() {
  const t = useDict(SG);
  const settings = useSettings();
  const address = `${settings.address}, ${settings.city}`;
  const qa = ([1, 2, 3, 4, 5, 6, 7, 8] as const).map((n) => ({ title: t(`q${n}`), content: t(`a${n}`, { address }) }));
  return (
    <section className="border-t border-line py-20 sm:py-28">
      <div className="container-x grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-4">
          <Reveal>
            <SectionHeading eyebrow={t('faqEyebrow')} title={t('faqTitle')} />
          </Reveal>
        </div>
        <div className="lg:col-span-8">
          <Accordion items={qa} defaultOpen={0} />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Availability request (inline form, tagged for the CMS inbox)         */
/* ------------------------------------------------------------------ */
export function RequestSection({ products }: { products: Product[] }) {
  const t = useDict(SG);
  const l = useL();
  const settings = useSettings();
  const [pick, setPick] = useState<string>('');
  const product = products.find((p) => p.id === pick);
  const message = useMemo(() => (product ? t('reqMsgModel', { name: l(product.name) }) : t('reqMsgAny')), [product, t, l]);
  const wa = settings.whatsapp ? waHref(settings.whatsapp) : '';
  const chip = (on: boolean) =>
    cn(
      'inline-flex min-h-10 items-center rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
      on ? 'border-ink bg-ink text-paper' : 'border-line bg-white text-ink-soft hover:border-ink/30 hover:text-ink',
    );

  return (
    <section id="kerkesa" className="scroll-mt-24 pb-10 pt-4 sm:pb-14">
      <div className="container-x">
        <Reveal>
          <div className="grid gap-4 rounded-[36px] bg-sand/80 p-3 sm:p-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex flex-col rounded-[28px] bg-paper p-6 ring-1 ring-line sm:p-9">
              <SectionHeading eyebrow={t('reqEyebrow')} title={t('reqTitle')} subtitle={t('reqText')} />
              <ul className="mt-6 space-y-2.5">
                {[t('reqPoint1'), t('reqPoint2')].map((p) => (
                  <li key={p} className="flex items-center gap-3 text-[14.5px] font-medium text-ink">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    {p}
                  </li>
                ))}
                {wa && (
                  <li>
                    <a href={wa} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-3 text-[14.5px] font-semibold text-ink hover:text-brand-700">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#25d366] text-white">
                        <WhatsAppIcon className="h-3.5 w-3.5" />
                      </span>
                      {t('reqPoint3')}
                    </a>
                  </li>
                )}
              </ul>
              <div className="mt-auto pt-8">
                <div className="relative overflow-hidden rounded-3xl bg-white p-5 ring-1 ring-line sm:p-6">
                  <div className="flex items-start gap-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                      <CalendarCheck className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[16px] font-bold text-ink">{t('tryTitle')}</div>
                      <p className="mt-1 text-[14px] leading-relaxed text-muted">{t('tryText')}</p>
                    </div>
                  </div>
                  <ButtonLink to={BOOK_SMART} variant="dark" className="mt-4 w-full sm:w-auto" icon={<CalendarCheck className="h-4 w-4" />}>
                    {t('tryCta')}
                  </ButtonLink>
                </div>
              </div>
            </div>
            <div className="rounded-[28px] bg-white p-6 ring-1 ring-line sm:p-8">
              <div className="text-[13px] font-semibold text-ink-soft">{t('reqPick')}</div>
              <div className="mt-2.5 flex flex-wrap gap-2" role="radiogroup" aria-label={t('reqPick')}>
                <button type="button" role="radio" aria-checked={!pick} onClick={() => setPick('')} className={chip(!pick)}>
                  {t('reqAny')}
                </button>
                {products.map((p) => (
                  <button key={p.id} type="button" role="radio" aria-checked={pick === p.id} onClick={() => setPick(p.id)} className={chip(pick === p.id)}>
                    {l(p.name)}
                  </button>
                ))}
              </div>
              <div className="mt-5 border-t border-line pt-5">
                <MeasureForm
                  key={pick || 'any'}
                  type="contact"
                  productId={product?.id}
                  defaultService={l({ me: 'Pametne naočare', sq: 'Syze inteligjente', en: 'Smart glasses' })}
                  defaultMessage={message}
                  tags={['smart-glasses']}
                  className="p-0! ring-0! sm:p-0!"
                />
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Brands (as text — no logos) + trademark / availability footnote     */
/* ------------------------------------------------------------------ */
export function BrandStrip() {
  const t = useDict(SG);
  const brands = ['Ray-Ban Meta', 'Oakley Meta', 'Meta'];
  return (
    <section className="pb-20 sm:pb-28">
      <div className="container-x">
        <div className="flex flex-col gap-4 border-y border-line py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="mr-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted">{t('brandsLabel')}</span>
            {brands.map((b, i) => (
              <span key={b} className="inline-flex items-center gap-3">
                {i > 0 && <span aria-hidden className="h-1 w-1 rounded-full bg-ink/25" />}
                <span className="display text-[22px] text-ink sm:text-[24px]">{b}</span>
              </span>
            ))}
            <span className="inline-flex items-center gap-3 text-[14px] font-medium text-muted">
              <span aria-hidden className="h-1 w-1 rounded-full bg-ink/25" />
              {t('brandsMore')}
            </span>
          </div>
          <Link to="/produktet/syze-inteligjente" className="group inline-flex min-h-10 shrink-0 items-center gap-1.5 text-[13.5px] font-semibold text-ink hover:text-brand-700">
            <Send className="h-4 w-4 text-brand-600" /> {t('modelsAll')} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        <p className="mt-4 flex max-w-3xl items-start gap-2 text-[12.5px] leading-relaxed text-muted">
          <IllustrationChip className="mt-px shrink-0 scale-90" />
          <span>{t('footnote')}</span>
        </p>
      </div>
    </section>
  );
}
