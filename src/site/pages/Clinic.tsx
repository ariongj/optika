import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, ArrowUpRight, CalendarCheck, CalendarClock, Check, Clock, FileText, Glasses, Info, Package, Pill, ScanEye, ShieldCheck, Stethoscope } from 'lucide-react';
import { Accent, Img, Reveal } from '@/components/ui/misc';
import { Button } from '@/components/ui/Button';
import { LogoMark } from '@/components/brand/Logo';
import { Breadcrumbs, SectionHeading } from '@/site/components/SectionHeading';
import { MeasureForm } from '@/site/components/MeasureForm';
import { ProcessSteps } from '@/site/components/company/Blocks';
import { pad2, scrollToId } from '@/site/components/company/data';
import { ContactButtons, FaqSection, GroupFamily, l10nOf } from '@/site/components/group/shared';
import { CL } from '@/site/components/group/clinicDict';
import { usePageTitle } from '@/site/layout/SiteLayout';
import { useDict, useL, useLang } from '@/i18n';
import { site } from '@/i18n/site';
import { useSettings } from '@/store/hooks';
import { cn } from '@/lib/utils';

/** In-page anchor of the clinic booking form (`/klinika#konsulta`). */
const BOOK = 'konsulta';

type Topic = 'consult' | 'assess' | 'follow';

const COVERS = [
  { topic: 'consult', icon: Stethoscope, title: 'c1t', text: 'c1', cta: 'c1cta' },
  { topic: 'assess', icon: ScanEye, title: 'c2t', text: 'c2', cta: 'c2cta' },
  { topic: 'follow', icon: CalendarClock, title: 'c3t', text: 'c3', cta: 'c3cta' },
] as const;

/** Visit topic → the sentence pre-filled in the booking form's message. */
const TOPIC_MSG: Record<Topic, 'm1' | 'm2' | 'm3'> = { consult: 'm1', assess: 'm2', follow: 'm3' };

const FLOW = [
  { title: 'f1t', text: 'f1', image: '/images/s/kontrolli.webp', to: '/sherbimet', link: 'f1link' },
  { title: 'f2t', text: 'f2', image: '/images/s/laboratori.webp', to: undefined, link: undefined },
  { title: 'f3t', text: 'f3', image: '/images/s/lab-blank.webp', to: '/optical-lab', link: 'f3link' },
  { title: 'f4t', text: 'f4', image: '/images/s/pershtatja.webp', to: '/produktet', link: 'f4link' },
] as const;

const BRING = [
  { icon: FileText, title: 'b1t', text: 'b1' },
  { icon: Glasses, title: 'b2t', text: 'b2' },
  { icon: Pill, title: 'b3t', text: 'b3' },
  { icon: Package, title: 'b4t', text: 'b4' },
] as const;

/** "How a visit goes" in the shape of the CMS process block, so it reuses the house ProcessSteps. */
const VISIT = {
  eyebrow: l10nOf(CL, 'stepsEyebrow'),
  title: l10nOf(CL, 'stepsTitle'),
  steps: [
    { title: l10nOf(CL, 's1t'), text: l10nOf(CL, 's1') },
    { title: l10nOf(CL, 's2t'), text: l10nOf(CL, 's2') },
    { title: l10nOf(CL, 's3t'), text: l10nOf(CL, 's3') },
    { title: l10nOf(CL, 's4t'), text: l10nOf(CL, 's4') },
  ],
};

const FAQ = [1, 2, 3, 4, 5, 6] as const;

export default function Clinic() {
  const t = useDict(CL);
  const ts = useDict(site);
  const l = useL();
  const lang = useLang();
  const settings = useSettings();
  const [topic, setTopic] = useState<Topic>('consult');
  usePageTitle('Klinika Miftari');

  const hours = l(settings.hours).split(/\s*·\s*/)[0];
  const book = (next?: Topic) => {
    if (next) setTopic(next);
    scrollToId(BOOK);
  };

  return (
    <>
      {/* Hero — split, on paper */}
      <section className="overflow-hidden border-b border-line bg-paper">
        <div className="container-x grid items-center gap-14 pb-20 pt-10 sm:pt-14 lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:pb-24">
          <div className="animate-fade-up">
            <Breadcrumbs items={[{ label: ts('nav_services'), to: '/sherbimet' }, { label: 'Klinika Miftari' }]} />
            <div className="eyebrow mb-4 mt-10">{t('eyebrow')}</div>
            <h1 className="display max-w-xl text-[44px] leading-[1.02] text-ink sm:text-[64px]">
              <Accent text={t('title')} />
            </h1>
            <p className="mt-7 max-w-xl text-[17.5px] leading-[1.7] text-ink-soft">{t('subtitle')}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => book()} icon={<CalendarCheck className="h-4 w-4" />}>
                {t('ctaBook')}
              </Button>
              <Button size="lg" variant="outline" onClick={() => scrollToId('perfshin')} iconRight={<ArrowRight className="h-4 w-4 rotate-90" />}>
                {t('covEyebrow')}
              </Button>
            </div>
            <p className="mt-10 flex items-start gap-3 border-t border-line pt-6 text-[13.5px] leading-relaxed text-muted">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              {t('heroNote')}
            </p>
          </div>
          <div className="relative animate-fade-up [animation-delay:120ms]">
            <div className="absolute -right-6 -top-6 hidden h-40 w-40 rounded-full bg-brand-100/70 blur-2xl lg:block" />
            <div className="relative aspect-[4/3] overflow-hidden rounded-[32px] bg-sand sm:aspect-[5/4] lg:aspect-[4/5]">
              <Img src="/images/s/klinika.webp" eager alt="Klinika Miftari" className="h-full w-full object-cover object-[40%_50%]" />
              <div className="absolute left-5 top-5 flex flex-wrap gap-1.5">
                {[t('tag1'), t('tag2'), t('tag3')].map((tag) => (
                  <span key={tag} className="rounded-full bg-white/90 px-3 py-1 text-[11.5px] font-bold text-ink shadow-sm backdrop-blur-md">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="absolute -bottom-8 left-4 right-4 flex items-center gap-4 rounded-3xl bg-white p-5 shadow-[0_30px_60px_-30px_rgba(28,26,23,0.45)] ring-1 ring-line sm:left-auto sm:right-8 sm:w-[340px] lg:-left-10 lg:right-auto">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-paper ring-1 ring-line">
                <LogoMark className="h-9" />
              </span>
              <div className="min-w-0">
                <div className="display text-[22px] leading-tight text-ink">Miftari Vision Group</div>
                <div className="mt-0.5 text-[12px] font-bold uppercase tracking-[0.16em] text-brand-700">{t('floatText')}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What a consultation covers */}
      <section id="perfshin" className="scroll-mt-24 pb-24 pt-28 sm:pb-28 sm:pt-32">
        <div className="container-x">
          <Reveal>
            <SectionHeading eyebrow={t('covEyebrow')} title={t('covTitle')} subtitle={t('covText')} />
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-3 lg:gap-5">
            {COVERS.map((c, i) => {
              const Icon = c.icon;
              const featured = i === 0;
              return (
                <Reveal key={c.topic} delay={i * 100} className="h-full">
                  <article
                    className={cn(
                      'group flex h-full flex-col rounded-3xl p-7 ring-1 transition-[box-shadow,transform] duration-500 hover:-translate-y-1 hover:shadow-[0_28px_60px_-34px_rgba(28,26,23,0.4)] sm:p-8',
                      featured ? 'bg-ink text-white ring-ink' : 'bg-white ring-line',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn('grid h-12 w-12 place-items-center rounded-2xl transition-transform duration-500 group-hover:-rotate-6', featured ? 'bg-white/10 text-brand-200 ring-1 ring-white/15' : 'bg-brand-600 text-white')}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className={cn('display text-[15px]', featured ? 'text-paper/50' : 'text-muted')}>{pad2(i + 1)}</span>
                    </div>
                    <h3 className={cn('display mt-10 text-[28px] leading-tight', featured ? 'text-white' : 'text-ink')}>{t(c.title)}</h3>
                    <p className={cn('mt-3 text-[15px] leading-relaxed', featured ? 'text-paper/70' : 'text-muted')}>{t(c.text)}</p>
                    <div className={cn('mt-6 inline-flex items-center gap-2 self-start rounded-full px-3 py-1 text-[11.5px] font-semibold', featured ? 'bg-white/10 text-paper/80' : 'bg-sand/70 text-ink-soft')}>
                      <Info className="h-3.5 w-3.5" /> {t('confirmed')}
                    </div>
                    <button
                      type="button"
                      onClick={() => book(c.topic)}
                      className={cn('mt-auto inline-flex items-center gap-1.5 self-start pt-8 text-sm font-semibold', featured ? 'text-white' : 'text-ink')}
                    >
                      <span className="link-u">{t(c.cta)}</span>
                      <ArrowRight className={cn('h-4 w-4 transition-transform group-hover:translate-x-0.5', featured ? 'text-brand-200' : 'text-brand-600')} />
                    </button>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* One family — clinic → prescription → lab → store */}
      <section className="bg-ink py-24 text-white sm:py-28">
        <div className="container-x">
          <Reveal>
            <SectionHeading tone="light" eyebrow={t('flowEyebrow')} title={t('flowTitle')} subtitle={t('flowText')} />
          </Reveal>
          <ol className="relative mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            <span aria-hidden className="absolute left-[12%] right-[12%] top-[60px] hidden h-px border-t border-dashed border-white/25 lg:block" />
            {FLOW.map((f, i) => (
              <Reveal as="li" key={f.title} delay={i * 110} className="relative">
                <div className="relative mx-auto h-[120px] w-[120px]">
                  <div className={cn('h-full w-full overflow-hidden rounded-full ring-1', i === 0 ? 'ring-2 ring-brand-200' : 'ring-white/15')}>
                    <Img src={f.image} small alt="" className="h-full w-full object-cover" />
                  </div>
                  <span className="display absolute -right-1 top-0 grid h-10 w-10 place-items-center rounded-full bg-brand-600 text-[15px] text-white ring-4 ring-ink">{pad2(i + 1)}</span>
                </div>
                <div className="mt-6 text-center">
                  <h3 className="display text-[24px] leading-tight">{t(f.title)}</h3>
                  <p className="mx-auto mt-2 max-w-[260px] text-[14.5px] leading-relaxed text-paper/70">{t(f.text)}</p>
                  {f.to && f.link && (
                    <Link to={f.to} className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-200 transition-colors hover:text-white">
                      {t(f.link)} <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* How a visit goes */}
      <ProcessSteps
        data={VISIT}
        tone="plain"
        action={
          <Button variant="outline" onClick={() => book()} icon={<CalendarCheck className="h-4 w-4" />}>
            {t('ctaBook')}
          </Button>
        }
      />

      {/* What to bring */}
      <section className="pb-24 sm:pb-28">
        <div className="container-x">
          <Reveal>
            <div className="grid overflow-hidden rounded-[36px] bg-sand/70 ring-1 ring-sand-2 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="relative min-h-[280px] bg-sand-2 sm:min-h-[360px]">
                <Img src="/images/misc/contact.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
              </div>
              <div className="p-7 sm:p-10 lg:p-14">
                <div className="eyebrow">{t('bringEyebrow')}</div>
                <h2 className="display mt-3 text-[34px] leading-[1.05] text-ink sm:text-[46px]">
                  <Accent text={t('bringTitle')} />
                </h2>
                <p className="mt-4 max-w-md text-[15.5px] leading-relaxed text-muted">{t('bringText')}</p>
                <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                  {BRING.map(({ icon: Icon, title, text }) => (
                    <li key={title} className="flex gap-3.5 rounded-2xl bg-white/80 p-4 ring-1 ring-line">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[14.5px] font-semibold leading-snug text-ink">{t(title)}</span>
                        <span className="mt-1 block text-[13.5px] leading-snug text-muted">{t(text)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-6 flex items-start gap-2.5 text-[13.5px] leading-relaxed text-ink-soft">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {t('bringNote')}
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Booking — books the Klinika service */}
      <section id={BOOK} className="scroll-mt-24 pb-4">
        <div className="container-x">
          <Reveal>
            <div className="grid gap-4 rounded-[36px] bg-sand/80 p-3 sm:p-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="relative isolate flex min-h-[460px] flex-col justify-end overflow-hidden rounded-[28px] bg-ink p-7 sm:p-10">
                <Img src="/images/hero/exam.webp" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover object-[30%_50%]" />
                <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/80 to-ink/30 sm:via-ink/65 sm:to-ink/10" />
                <div className="eyebrow text-brand-200">{t('bookEyebrow')}</div>
                <h2 className="display mt-3 text-[34px] leading-[1.04] text-white sm:text-[46px]">
                  <Accent text={t('bookTitle')} accentClassName="text-brand-200!" />
                </h2>
                <p className="mt-4 max-w-md text-[15.5px] leading-relaxed text-paper/75">{t('bookText')}</p>
                <ul className="mt-6 space-y-2.5">
                  {[
                    { icon: Check, text: t('bp1') },
                    { icon: Check, text: t('bp2') },
                    { icon: Clock, text: hours },
                  ]
                    .filter((p) => p.text)
                    .map(({ icon: Icon, text }) => (
                      <li key={text} className="flex items-center gap-3 text-[15px] font-medium text-white">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        {text}
                      </li>
                    ))}
                </ul>
                <p className="mt-6 text-[12.5px] leading-relaxed text-paper/60">{t('formNote')}</p>
                <div className="mt-6 border-t border-white/15 pt-6">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-paper/55">{t('preferPhone')}</div>
                  <ContactButtons tone="light" className="mt-3" />
                </div>
              </div>
              <div className="flex min-w-0 flex-col gap-3">
                <div className="rounded-3xl bg-white/70 px-5 py-4 ring-1 ring-line sm:px-6">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">{t('topic')}</div>
                  <div className="mt-2.5 flex flex-wrap gap-2" role="group" aria-label={t('topic')}>
                    {COVERS.map((c) => (
                      <button
                        key={c.topic}
                        type="button"
                        aria-pressed={topic === c.topic}
                        onClick={() => setTopic(c.topic)}
                        className={cn(
                          'rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors',
                          topic === c.topic ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-ink-soft hover:border-ink/30',
                        )}
                      >
                        {t(c.title)}
                      </button>
                    ))}
                  </div>
                </div>
                <MeasureForm key={`${topic}-${lang}`} type="measurement" defaultService="clinic" defaultMessage={t(TOPIC_MSG[topic])} className="flex-1 shadow-none ring-0! lg:p-10!" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <FaqSection title={t('faqTitle')} items={FAQ.map((n) => ({ q: t(`q${n}`), a: t(`a${n}`) }))} />

      <GroupFamily current="clinic" />
    </>
  );
}
