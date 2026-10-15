import { useMemo, type ComponentType } from 'react';
import { Link } from 'react-router';
import { ArrowRight, CalendarCheck, Check, FlaskConical, Ruler, Send, ShieldPlus, Smartphone, UserCheck, Wrench } from 'lucide-react';
import type { Product } from '@/lib/types';
import { Accordion, Img, Reveal } from '@/components/ui/misc';
import { ButtonLink } from '@/components/ui/Button';
import { WhatsAppIcon } from '@/components/brand/Social';
import { SectionHeading } from '@/site/components/SectionHeading';
import { MeasureForm } from '@/site/components/MeasureForm';
import { waHref } from '@/site/components/company/data';
import { useDict, useL } from '@/i18n';
import { common } from '@/i18n/common';
import { useSettings } from '@/store/hooks';
import { cn } from '@/lib/utils';
import { RenderChip } from './render';
import { SG } from './dict';
import { BOOK_SMART, kindOf } from './data';
import { kindLabels } from './Hero';
import { Backdrop, Headline, Kicker, glowMove } from './ui';

/** The dark render of a product (second image) where there is one. */
const darkImage = (p: Product) => p.images.find((i) => /-dark\.webp$/.test(i)) ?? p.images[0];

/* ------------------------------------------------------------------ */
/* 5 — The models (store products), dark cards                          */
/* ------------------------------------------------------------------ */
export function SmartModels({ products, categorySlug, onAsk }: { products: Product[]; categorySlug?: string; onAsk: (id: string) => void }) {
  const t = useDict(SG);
  const tc = useDict(common);
  const l = useL();
  const kinds = kindLabels(t);
  if (!products.length) return null;
  return (
    <section id="modelet" className="relative isolate scroll-mt-20 overflow-hidden rounded-b-[40px] bg-[#07090a] pb-20 pt-20 text-white sm:rounded-b-[64px] sm:pb-28 sm:pt-28">
      <Backdrop glow="center" grid={false} />
      <div className="container-x relative">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <Kicker n="04">{t('modelsEyebrow')}</Kicker>
            <Headline text={t('modelsTitle')} className="mt-5 text-[36px] leading-[1.04] sm:text-[52px] lg:text-[58px]" />
            <p className="mt-5 max-w-xl text-[15.5px] leading-relaxed text-white/55 sm:text-[16.5px]">{t('modelsText')}</p>
          </div>
          {categorySlug && (
            <Link
              to={`/produktet/${categorySlug}`}
              className="inline-flex h-11 shrink-0 items-center gap-2 self-start rounded-full bg-white/[0.06] px-5 text-sm font-semibold text-white ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/[0.11] md:self-end"
            >
              {t('modelsAll')} <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>

        {/* phones: a snap carousel; from lg a 3-column grid */}
        <ul className="no-scrollbar -mx-4 mt-10 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:mt-12 sm:scroll-px-6 sm:gap-4 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-5 lg:overflow-visible lg:px-0 lg:pb-0">
          {products.map((p, i) => {
            const kind = kindOf(p);
            const gen3 = /\(Gen 3\)/.test(l(p.name));
            const chips = [kinds[kind], ...(kind === 'camera' ? [kinds.audio] : []), ...(gen3 ? ['Gen 3'] : [])];
            return (
              <li key={p.id} className="w-[80%] shrink-0 snap-start sm:w-[46%] lg:w-auto">
                <article onPointerMove={glowMove} className="sg-card group flex h-full flex-col overflow-hidden rounded-[26px]">
                  <Link to={`/produkt/${p.slug}`} className="relative block aspect-[4/5] overflow-hidden bg-[#0b0f0d] lg:aspect-square" aria-label={l(p.name)}>
                    <Img src={darkImage(p)} small eager={i < 2} alt={l(p.name)} className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.05]" />
                    <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#07090a]/80 to-transparent" />
                    <RenderChip tone="dark" className="absolute left-4 top-4" />
                  </Link>
                  <div className="flex flex-1 flex-col p-5 sm:p-6">
                    <div className="flex flex-wrap gap-1.5">
                      {chips.map((c) => (
                        <span key={c} className="sg-mono rounded-md bg-white/[0.05] px-2 py-1 text-[10px] text-white/65 ring-1 ring-inset ring-white/10">
                          {c}
                        </span>
                      ))}
                    </div>
                    <h3 className="mt-4 text-[19px] font-semibold leading-snug tracking-[-0.02em]">
                      <Link to={`/produkt/${p.slug}`} className="hover:text-[#b5f0d3]">
                        {l(p.name).replace(/\s*\(Gen 3\)$/, '')}
                      </Link>
                    </h3>
                    <p className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-white/50">{l(p.short)}</p>
                    <div className="sg-mono mt-auto pt-5 text-[11px] text-[#6fd3a5]">{tc('priceOnRequest')}</div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => onAsk(p.id)}
                        className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-white px-3 text-[12.5px] sm:px-4 sm:text-[13px] font-semibold text-[#06110c] transition-colors hover:bg-[#b5f0d3]"
                      >
                        <Send className="h-3.5 w-3.5" /> {t('askAvail')}
                      </button>
                      <Link
                        to={`/produkt/${p.slug}`}
                        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-full px-3 text-[13px] sm:px-4 font-semibold text-white ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/[0.08]"
                      >
                        <span className="max-sm:sr-only">{t('view')}</span> <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 6 — Why buy them at an optician (back to the warm paper style)       */
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
    <section className="py-20 sm:py-28">
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
/* 7 — Privacy & etiquette (dark again, short) with a recording LED     */
/* ------------------------------------------------------------------ */
export function PrivacyBlock() {
  const t = useDict(SG);
  const items = [t('priv1'), t('priv2'), t('priv3'), t('priv4')];
  return (
    <section className="pb-20 sm:pb-28">
      <div className="container-x">
        <Reveal>
          <div className="relative isolate overflow-hidden rounded-[36px] bg-[#07090a] px-6 py-12 text-white sm:px-10 sm:py-14 lg:grid lg:grid-cols-12 lg:items-center lg:gap-12 lg:px-16 lg:py-16">
            <Backdrop glow="left" grid={false} />
            <div className="relative lg:col-span-5">
              {/* the recording LED */}
              <div aria-hidden className="relative grid h-28 w-28 place-items-center rounded-full bg-white/[0.03] ring-1 ring-white/10">
                <span className="sg-ring absolute inset-6 rounded-full border border-white/40" />
                <span className="sg-ring absolute inset-6 rounded-full border border-white/30 [animation-delay:1.2s]" />
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#111614] ring-1 ring-white/15">
                  <span className="sg-led h-3 w-3 rounded-full bg-white" />
                </span>
              </div>
              <div className="sg-mono mt-4 text-[10.5px] text-white/45">{t('privLed')}</div>
              <Kicker n="05" className="mt-8">
                {t('privEyebrow')}
              </Kicker>
              <Headline text={t('privTitle')} className="mt-4 text-[34px] leading-[1.05] sm:text-[44px]" />
              <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/55">{t('privText')}</p>
            </div>
            <ol className="relative mt-10 grid gap-3 sm:grid-cols-2 lg:col-span-7 lg:mt-0">
              {items.map((it, i) => (
                <li key={i} className="sg-card rounded-[22px] p-5">
                  <span className="sg-mono text-[11px] text-[#6fd3a5]">{String(i + 1).padStart(2, '0')}</span>
                  <p className="mt-3 text-[15px] leading-relaxed text-white/80">{it}</p>
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
/* 8 — FAQ                                                             */
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
export function RequestSection({ products, pick, onPick }: { products: Product[]; pick: string; onPick: (id: string) => void }) {
  const t = useDict(SG);
  const l = useL();
  const settings = useSettings();
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
                <button type="button" role="radio" aria-checked={!pick} onClick={() => onPick('')} className={chip(!pick)}>
                  {t('reqAny')}
                </button>
                {products.map((p) => (
                  <button key={p.id} type="button" role="radio" aria-checked={pick === p.id} onClick={() => onPick(p.id)} className={chip(pick === p.id)}>
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
    <section className="pb-6">
      <div className="container-x">
        <div className="flex flex-col gap-4 border-y border-line py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="mr-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted">{t('brandsLabel')}</span>
            {brands.map((b, i) => (
              <span key={b} className="inline-flex items-center gap-3">
                {i > 0 && <span aria-hidden className="h-1 w-1 rounded-full bg-ink/25" />}
                <span className="text-[20px] font-semibold tracking-[-0.03em] text-ink sm:text-[22px]">{b}</span>
              </span>
            ))}
            <span className="inline-flex items-center gap-3 text-[14px] font-medium text-muted">
              <span aria-hidden className="h-1 w-1 rounded-full bg-ink/25" />
              {t('brandsMore')}
            </span>
          </div>
          <Link to="/produktet/syze-inteligjente" className="group inline-flex min-h-10 shrink-0 items-center gap-1.5 text-[13.5px] font-semibold text-ink hover:text-brand-700">
            {t('modelsAll')} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        <p className="mt-4 flex max-w-3xl items-start gap-2 text-[12.5px] leading-relaxed text-muted">
          <RenderChip className="mt-px shrink-0 scale-90" />
          <span>{t('footnote')}</span>
        </p>
      </div>
    </section>
  );
}
