import { ArrowRight, Box, CalendarCheck, Glasses, LockKeyhole, Ruler, ScanFace, UserRoundCheck } from 'lucide-react';
import { Accent, Reveal } from '@/components/ui/misc';
import { ButtonLink } from '@/components/ui/Button';
import { Breadcrumbs, SectionHeading } from '@/site/components/SectionHeading';
import { usePageTitle } from '@/site/layout/SiteLayout';
import { useDict } from '@/i18n';
import { TRY } from '@/site/tryon/dict';
import { TryOnStudio } from '@/site/tryon/TryOnStudio';

const STEPS = [
  { icon: ScanFace, title: 'step1Title', text: 'step1' },
  { icon: Glasses, title: 'step2Title', text: 'step2' },
  { icon: Ruler, title: 'step3Title', text: 'step3' },
] as const;

/** Virtual try-on (/provo-virtualisht?produkt=<slug>) — lazy route: three.js + MediaPipe stay out of the main bundle. */
export default function TryOn() {
  const t = useDict(TRY);
  usePageTitle(t('crumb'));

  return (
    <>
      <section className="bg-paper">
        <div className="container-x pb-6 pt-6 sm:pb-10 sm:pt-12">
          <Breadcrumbs items={[{ label: t('crumb') }]} />
          <div className="mt-5 grid gap-4 sm:mt-7 sm:gap-5 lg:grid-cols-[1.15fr_1fr] lg:items-end lg:gap-16">
            <div>
              <div className="eyebrow mb-3">{t('eyebrow')}</div>
              <h1 className="display max-w-3xl text-[34px] leading-[1.05] text-ink sm:text-[54px]">
                <Accent text={t('title')} />
              </h1>
            </div>
            <div>
              <p className="max-w-xl text-[15px] leading-relaxed text-muted sm:text-[17px]">{t('subtitle')}</p>
              <ul className="mt-4 flex flex-wrap gap-2 sm:mt-5">
                <li className="inline-flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2 text-[12.5px] font-semibold leading-snug text-ink-soft ring-1 ring-line sm:rounded-full">
                  <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-brand-600" /> {t('privacy')}
                </li>
                <li className="hidden items-center gap-2 rounded-full bg-white px-3.5 py-2 text-[12.5px] font-semibold text-ink-soft ring-1 ring-line sm:inline-flex">
                  <UserRoundCheck className="h-3.5 w-3.5 text-brand-600" /> {t('noAccount')}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-16 sm:pb-28">
        <div className="container-x">
          <TryOnStudio />
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-line bg-white/50 py-16 sm:py-28">
        <div className="container-x">
          <Reveal>
            <SectionHeading eyebrow={t('stepsEyebrow')} title={t('stepsTitle')} />
          </Reveal>
          <ol className="mt-8 grid gap-3 sm:mt-12 sm:grid-cols-3 sm:gap-6">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title} as="li" delay={i * 90} className="relative rounded-[28px] bg-paper p-5 ring-1 ring-line sm:p-8">
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-600 text-white sm:h-12 sm:w-12">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="display text-[36px] leading-none text-brand-600/15 sm:text-[44px]">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="mt-4 text-[18px] font-bold text-ink sm:mt-6 sm:text-[19px]">{t(title)}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{t(text)}</p>
              </Reveal>
            ))}
          </ol>

          {/* Honest note */}
          <Reveal className="mt-6 sm:mt-8">
            <div className="grid gap-8 rounded-[32px] bg-ink p-7 text-paper sm:p-10 lg:grid-cols-[1.4fr_1fr] lg:items-center lg:gap-16 lg:p-12">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-200">
                  <Box className="h-3.5 w-3.5" /> {t('approx')}
                </span>
                <h2 className="display mt-5 text-[32px] leading-[1.06] text-white sm:text-[42px]">
                  <Accent text={t('noteTitle')} accentClassName="text-brand-200!" />
                </h2>
                <p className="mt-4 max-w-2xl text-[15.5px] leading-relaxed text-paper/75">{t('noteText')}</p>
              </div>
              <div className="space-y-5">
                <div className="flex gap-3 rounded-2xl bg-white/[0.06] p-5 text-[14px] leading-relaxed text-paper/80 ring-1 ring-white/10">
                  <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-brand-200" />
                  <span>{t('notePrivacy')}</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  <ButtonLink to="/kontakt" variant="light" size="lg" icon={<CalendarCheck className="h-4 w-4" />}>
                    {t('bookExam')}
                  </ButtonLink>
                  <ButtonLink to="/produktet" variant="outlineLight" size="lg" iconRight={<ArrowRight className="h-4 w-4" />}>
                    {t('chooseFrame')}
                  </ButtonLink>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
