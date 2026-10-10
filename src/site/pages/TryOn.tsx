import { ArrowRight, Box, CalendarCheck, LockKeyhole, UserRoundCheck } from 'lucide-react';
import { Accent, Reveal } from '@/components/ui/misc';
import { ButtonLink } from '@/components/ui/Button';
import { Breadcrumbs, SectionHeading } from '@/site/components/SectionHeading';
import { usePageTitle } from '@/site/layout/SiteLayout';
import { useDict } from '@/i18n';
import { TRY } from '@/site/tryon/dict';
import { TRY_STEPS } from '@/site/tryon/parts';
import { TryOnStudio } from '@/site/tryon/TryOnStudio';

/**
 * Virtual try-on (/provo-virtualisht?produkt=<slug>) — lazy route: three.js + MediaPipe stay out of the main bundle.
 * Below `lg` it behaves like a focused camera app: a one-line header, the stage, then a compact dock (the studio
 * folds "how it works" and the approximation note into disclosure rows there).
 */
export default function TryOn() {
  const t = useDict(TRY);
  usePageTitle(t('crumb'));

  return (
    <>
      <section className="bg-paper">
        <div className="container-x pb-3 pt-4 sm:pb-6 sm:pt-8 lg:pb-10 lg:pt-12">
          <div className="hidden sm:block">
            <Breadcrumbs items={[{ label: t('crumb') }]} />
          </div>
          <div className="grid gap-4 sm:mt-5 lg:mt-7 lg:grid-cols-[1.15fr_1fr] lg:items-end lg:gap-16">
            <div>
              <div className="eyebrow mb-1 lg:mb-3">{t('eyebrow')}</div>
              <h1 className="display max-w-3xl text-[26px] leading-[1.1] text-ink sm:text-[34px] lg:text-[54px] lg:leading-[1.05]">
                <Accent text={t('titleShort')} className="lg:hidden" />
                <Accent text={t('title')} className="hidden lg:inline" />
              </h1>
            </div>
            <div className="hidden lg:block">
              <p className="max-w-xl text-[17px] leading-relaxed text-muted">{t('subtitle')}</p>
              <ul className="mt-5 flex flex-wrap gap-2">
                <li className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-[12.5px] font-semibold leading-snug text-ink-soft ring-1 ring-line">
                  <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-brand-600" /> {t('privacy')}
                </li>
                <li className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-[12.5px] font-semibold text-ink-soft ring-1 ring-line">
                  <UserRoundCheck className="h-3.5 w-3.5 text-brand-600" /> {t('noAccount')}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="sm:pb-6 lg:pb-28">
        <div className="container-x">
          <TryOnStudio />
        </div>
      </section>

      {/* How it works + honest note (desktop; phones get them as disclosure rows inside the studio) */}
      <section className="hidden border-t border-line bg-white/50 py-28 lg:block">
        <div className="container-x">
          <Reveal>
            <SectionHeading eyebrow={t('stepsEyebrow')} title={t('stepsTitle')} />
          </Reveal>
          <ol className="mt-12 grid grid-cols-3 gap-6">
            {TRY_STEPS.map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title} as="li" delay={i * 90} className="relative rounded-[28px] bg-paper p-8 ring-1 ring-line">
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-600 text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="display text-[44px] leading-none text-brand-600/15">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="mt-6 text-[19px] font-bold text-ink">{t(title)}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{t(text)}</p>
              </Reveal>
            ))}
          </ol>

          {/* Honest note */}
          <Reveal className="mt-8">
            <div className="grid grid-cols-[1.4fr_1fr] items-center gap-16 rounded-[32px] bg-ink p-12 text-paper">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-200">
                  <Box className="h-3.5 w-3.5" /> {t('approx')}
                </span>
                <h2 className="display mt-5 text-[42px] leading-[1.06] text-white">
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
                  <ButtonLink to="/rezervo" variant="light" size="lg" icon={<CalendarCheck className="h-4 w-4" />}>
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
