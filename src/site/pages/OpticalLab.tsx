import { ArrowRight, Building2, Gauge, Globe2, Handshake, Timer } from 'lucide-react';
import { Accent, Img } from '@/components/ui/misc';
import { Button } from '@/components/ui/Button';
import { Breadcrumbs } from '@/site/components/SectionHeading';
import { scrollToId } from '@/site/components/company/data';
import { FaqSection, GroupFamily } from '@/site/components/group/shared';
import { LB } from '@/site/components/group/labDict';
import { LabProcess } from '@/site/components/group/LabProcess';
import { LabLenses } from '@/site/components/group/LabLenses';
import { LabPartners, PARTNER_ID } from '@/site/components/group/LabPartners';
import { usePageTitle } from '@/site/layout/SiteLayout';
import { useDict } from '@/i18n';
import { site } from '@/i18n/site';

const PROCESS_ID = 'procesi';
const FAQ = [1, 2, 3, 4, 5, 6] as const;

export default function OpticalLab() {
  const t = useDict(LB);
  const ts = useDict(site);
  usePageTitle('Optical Lab');

  const facts = [
    { icon: Timer, text: t('fact1') },
    { icon: Gauge, text: t('fact2') },
    { icon: Globe2, text: t('fact3') },
  ];
  const strip = [
    { icon: Building2, text: t('strip1') },
    { icon: Handshake, text: t('strip3') },
  ];

  return (
    <>
      {/* Hero — dark, crafted, lab photography */}
      <section className="relative isolate overflow-hidden bg-ink text-white">
        <Img src="/images/s/lab-polish.webp" eager alt="" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink via-ink/90 to-ink/55" />
        <div className="bg-grain pointer-events-none absolute inset-0 -z-10" />
        <div className="container-x grid items-center gap-12 pb-16 pt-12 sm:pt-16 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:pb-24 lg:pt-20">
          <div className="animate-fade-up">
            <Breadcrumbs tone="light" items={[{ label: ts('nav_services'), to: '/sherbimet' }, { label: 'Optical Lab' }]} />
            <div className="eyebrow mb-4 mt-10 text-brand-200">{t('eyebrow')}</div>
            <h1 className="display max-w-xl text-[46px] leading-[1.0] sm:text-[68px]">
              <Accent text={t('title')} accentClassName="text-brand-200!" />
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-[1.7] text-paper/75">{t('subtitle')}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => scrollToId(PARTNER_ID)} iconRight={<ArrowRight className="h-4 w-4" />}>
                {t('ctaPartner')}
              </Button>
              <Button size="lg" variant="outlineLight" onClick={() => scrollToId(PROCESS_ID)}>
                {t('ctaProcess')}
              </Button>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-7 gap-y-3 border-t border-white/12 pt-6 text-[13.5px] font-medium text-paper/80">
              {facts.map(({ icon: Icon, text }) => (
                <li key={text} className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4 text-brand-200" /> {text}
                </li>
              ))}
            </ul>
          </div>

          {/* Mosaic */}
          <div className="relative animate-fade-up [animation-delay:120ms]">
            <div className="grid grid-cols-[1.2fr_1fr] gap-3 sm:gap-4">
              <div className="row-span-2 aspect-[4/5] overflow-hidden rounded-[28px] bg-ink-soft ring-1 ring-white/10 sm:aspect-auto">
                <Img src="/images/s/lab-laser.webp" eager alt="" className="h-full w-full object-cover" />
              </div>
              <div className="aspect-square overflow-hidden rounded-[24px] bg-ink-soft ring-1 ring-white/10">
                <Img src="/images/s/lab-blank.webp" small eager alt="" className="h-full w-full object-cover" />
              </div>
              <div className="aspect-square overflow-hidden rounded-[24px] bg-ink-soft ring-1 ring-white/10">
                <Img src="/images/s/laboratori.webp" small eager alt="" className="h-full w-full object-cover object-[60%_50%]" />
              </div>
            </div>
            <div className="absolute -bottom-5 left-4 inline-flex items-center gap-3 rounded-full bg-white py-2 pl-2 pr-5 text-[13px] font-semibold text-ink shadow-[0_24px_50px_-24px_rgba(0,0,0,0.6)] sm:left-8">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-white">
                <Gauge className="h-4 w-4" />
              </span>
              {t('chip')}
            </div>
          </div>
        </div>

        {/* Context strip */}
        <div className="border-t border-white/10">
          <ul className="container-x flex flex-wrap items-center gap-x-8 gap-y-2 py-5 text-[12.5px] font-semibold uppercase tracking-[0.14em] text-paper/60">
            {strip.map(({ icon: Icon, text }) => (
              <li key={text} className="inline-flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-brand-200" /> {text}
              </li>
            ))}
            <li className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-200" /> {t('strip2')}
            </li>
          </ul>
        </div>
      </section>

      <LabProcess id={PROCESS_ID} />

      <LabLenses />

      <LabPartners />

      <FaqSection title={t('faqTitle')} items={FAQ.map((n) => ({ q: t(`q${n}`), a: t(`a${n}`) }))} />

      <GroupFamily current="lab" />
    </>
  );
}
