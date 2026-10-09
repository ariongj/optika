import type { ReactNode } from 'react';
import { ArrowRight, Eye, Phone } from 'lucide-react';
import { Accent, Img, Reveal } from '@/components/ui/misc';
import { Button, ButtonLink } from '@/components/ui/Button';
import { SectionHeading } from '@/site/components/SectionHeading';
import { openBooking } from '@/site/components/utility/Booking';
import { defineDict, useDict, useL } from '@/i18n';
import { site } from '@/i18n/site';
import { useSettings } from '@/store/hooks';
import { cn } from '@/lib/utils';
import { pad2, telHref, type SectionData } from './data';

/** Strings shared by the company pages (services, lookbook, about). */
export const C = defineDict({
  me: {
    step: 'Korak',
    inNumbers: '{name} u brojkama',
    bookFree: 'Zakažite pregled vida',
    ctaEyebrow: 'Vidimo se u optici',
    ctaTitle: 'Spremni za *nove* naočare?',
    ctaText: 'Zakažite pregled vida ili svratite u optiku — pomoći ćemo vam da izaberete okvir, izmerićemo PD, a sočiva pripremamo u našoj laboratoriji.',
  },
  sq: {
    step: 'Hapi',
    inNumbers: '{name} në shifra',
    bookFree: 'Rezervo kontrollin e syve',
    ctaEyebrow: 'Shihemi në optikë',
    ctaTitle: 'Gati për një palë *të re*?',
    ctaText: 'Rezervoni kontrollin e syve ose ejani në optikë — ju ndihmojmë të zgjidhni kornizën, ua masim PD-në dhe lentet i përgatisim në laboratorin tonë.',
  },
  en: {
    step: 'Step',
    inNumbers: '{name} in numbers',
    bookFree: 'Book an eye exam',
    ctaEyebrow: 'See you in store',
    ctaTitle: 'Ready for a *new* pair?',
    ctaText: 'Book an eye exam or drop by the store — we’ll help you choose a frame, measure your PD and make your lenses in our own lab.',
  },
});

/* ------------------------------------------------------------------ */
/* Ink band: CMS quote + key numbers                                   */
/* ------------------------------------------------------------------ */
export function StatsBand({ data }: { data: SectionData<'stats'> }) {
  const l = useL();
  const t = useDict(C);
  const settings = useSettings();
  return (
    <section className="relative isolate overflow-hidden bg-ink py-24 text-white sm:py-32">
      <div className="bg-grain pointer-events-none absolute inset-0 -z-10" />
      <div className="pointer-events-none absolute -right-48 -top-48 -z-10 h-[560px] w-[560px] rounded-full bg-brand-600/25 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-56 -left-40 -z-10 h-[460px] w-[460px] rounded-full bg-oak/20 blur-[120px]" />
      <div className="container-x">
        <Reveal className="mx-auto max-w-4xl text-center">
          <div className="eyebrow text-brand-200">{t('inNumbers', { name: settings.companyName })}</div>
          <blockquote className="display mt-6 text-[30px] leading-[1.18] text-white sm:text-[44px] lg:text-[50px]">
            <span className="text-brand-200">„</span>
            {l(data.quote)}
            <span className="text-brand-200">“</span>
          </blockquote>
          <div className="mt-9 inline-flex items-center gap-3 text-left">
            {data.image && <Img src={data.image} small alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-white/15" />}
            <div>
              <div className="text-[14px] font-bold tracking-wide text-white">{settings.companyName}</div>
              <div className="text-[13px] text-paper/55">{l(settings.tagline)}</div>
            </div>
          </div>
        </Reveal>
        <div className="mt-16 grid grid-cols-2 gap-y-12 border-t border-white/10 pt-12 sm:mt-20 lg:grid-cols-4 lg:gap-y-0">
          {data.items.map((s, i) => (
            <Reveal key={i} delay={i * 90} className={cn('px-3 text-center lg:px-6', i % 2 === 1 && 'border-l border-white/10', i > 0 && 'lg:border-l lg:border-white/10')}>
              <div className="display text-[56px] leading-none text-white sm:text-[76px]">{s.value}</div>
              <p className="mx-auto mt-4 max-w-[19ch] text-[14.5px] leading-snug text-paper/60">{l(s.label)}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* "How we work" — the CMS process steps as numbered cards             */
/* ------------------------------------------------------------------ */
export function ProcessSteps({ data, action, className, tone = 'sand' }: { data: SectionData<'process'>; action?: ReactNode; className?: string; tone?: 'sand' | 'plain' }) {
  const l = useL();
  const t = useDict(C);
  const n = data.steps.length;
  return (
    <section className={cn('py-24 sm:py-28', tone === 'sand' && 'bg-sand/60', className)}>
      <div className="container-x">
        <Reveal>
          <SectionHeading eyebrow={l(data.eyebrow)} title={l(data.title)} action={action} />
        </Reveal>
        <ol className={cn('mt-14 grid gap-4 sm:grid-cols-2 lg:gap-5', n >= 4 ? 'lg:grid-cols-4' : n === 3 && 'lg:grid-cols-3')}>
          {data.steps.map((s, i) => (
            <Reveal as="li" key={i} delay={i * 100}>
              <div className={cn('flex h-full flex-col rounded-3xl p-7 ring-1 ring-line transition-[box-shadow,transform] duration-500 hover:-translate-y-1 hover:shadow-[0_28px_60px_-34px_rgba(28,26,23,0.4)]', tone === 'sand' ? 'bg-paper' : 'bg-white')}>
                <div className="flex items-start justify-between gap-4">
                  <span className="display text-[56px] leading-none text-brand-600">{pad2(i + 1)}</span>
                  <span className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-muted">
                    {t('step')} {i + 1}/{n}
                  </span>
                </div>
                <h3 className="mt-10 text-xl font-bold text-ink">{l(s.title)}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{l(s.text)}</p>
                <div className="mt-auto pt-8">
                  <div className="h-1 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full bg-brand-600" style={{ width: `${((i + 1) / n) * 100}%` }} />
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Closing call-to-action band                                         */
/* ------------------------------------------------------------------ */
export function CtaBand({ image, className }: { image: string; className?: string }) {
  const t = useDict(C);
  const ts = useDict(site);
  const settings = useSettings();
  return (
    <section className={cn('pt-24 sm:pt-28', className)}>
      <div className="container-x">
        <Reveal>
          <div className="relative isolate overflow-hidden rounded-[36px] bg-ink px-6 py-14 sm:px-12 sm:py-20 lg:px-20 lg:py-24">
            <Img src={image} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/75 to-ink/30 sm:bg-gradient-to-r sm:from-ink sm:via-ink/80 sm:to-ink/10" />
            <div className="bg-grain absolute inset-0 -z-10" />
            <div className="max-w-2xl">
              <div className="eyebrow text-brand-200">{t('ctaEyebrow')}</div>
              <h2 className="display mt-4 text-[40px] leading-[1.03] text-white sm:text-[58px]">
                <Accent text={t('ctaTitle')} accentClassName="text-brand-200!" />
              </h2>
              <p className="mt-5 max-w-lg text-[16.5px] leading-relaxed text-paper/75">{t('ctaText')}</p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Button size="lg" onClick={() => openBooking()} icon={<Eye className="h-4 w-4" />}>
                  {t('bookFree')}
                </Button>
                <ButtonLink to="/kontakt" size="lg" variant="outlineLight" iconRight={<ArrowRight className="h-4 w-4" />}>
                  {ts('nav_contact')}
                </ButtonLink>
              </div>
              <a href={telHref(settings.phone)} className="mt-7 inline-flex items-center gap-2.5 text-[15px] font-semibold text-white/80 transition-colors hover:text-white">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 ring-1 ring-white/15">
                  <Phone className="h-4 w-4" />
                </span>
                {ts('callUs')}: {settings.phone}
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
