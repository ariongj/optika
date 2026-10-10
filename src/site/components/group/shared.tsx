import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowRight, ArrowUpRight, Phone } from 'lucide-react';
import { Accordion, Img, Reveal } from '@/components/ui/misc';
import { WhatsAppIcon } from '@/components/brand/Social';
import { SectionHeading } from '@/site/components/SectionHeading';
import { pad2, telHref, waHref } from '@/site/components/company/data';
import { defineDict, useDict } from '@/i18n';
import { site } from '@/i18n/site';
import { useSettings } from '@/store/hooks';
import type { L10n } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Shared pieces of the Miftari Holding Group pages (/klinika, /optical-lab): the "one family" cross-links,
 * the FAQ block and the phone / WhatsApp buttons.
 */
export const G = defineDict({
  me: {
    familyEyebrow: 'Miftari Holding Group',
    familyTitle: 'Ista porodica, *u svakom koraku*',
    familyText: 'Optika, laboratorija i klinika rade zajedno — od pregleda i recepta do gotovih naočara.',
    optika: 'Okviri i naočare za sunce, pregled vida i lično prilagođavanje u našoj optici.',
    lab: 'Sočiva po receptu za naše kupce i za optike na Kosovu i u EU.',
    clinic: 'Specijalističke konsultacije, procena i kontrolni pregledi za zdravlje oka.',
    optikaCta: 'Pogledajte kolekciju',
    labCta: 'Upoznajte laboratoriju',
    clinicCta: 'Upoznajte kliniku',
    here: 'Ovde ste',
    more: 'Saznajte više',
    faqEyebrow: 'Česta pitanja',
    faqHelp: 'Niste našli odgovor? Pozovite nas ili nam pišite na WhatsApp — rado ćemo pomoći.',
  },
  sq: {
    familyEyebrow: 'Miftari Holding Group',
    familyTitle: 'E njëjta familje, *në çdo hap*',
    familyText: 'Optika, laboratori dhe klinika punojnë bashkë — nga kontrolli dhe receta deri te syzet e gatshme.',
    optika: 'Korniza optike dhe syze dielli, kontroll i syve dhe përshtatje personale në optikën tonë.',
    lab: 'Lente me recetë për klientët tanë dhe për optika në Kosovë e në BE.',
    clinic: 'Konsultë specialistike, vlerësim dhe kontrolle pasuese për shëndetin e syve.',
    optikaCta: 'Shikoni koleksionin',
    labCta: 'Njihuni me laboratorin',
    clinicCta: 'Njihuni me klinikën',
    here: 'Jeni këtu',
    more: 'Mësoni më shumë',
    faqEyebrow: 'Pyetje të shpeshta',
    faqHelp: 'Nuk e gjeni përgjigjen? Na telefononi ose na shkruani në WhatsApp — ju ndihmojmë me kënaqësi.',
  },
  en: {
    familyEyebrow: 'Miftari Holding Group',
    familyTitle: 'One family, *every step of the way*',
    familyText: 'Store, lab and clinic work together — from the exam and prescription to the finished glasses.',
    optika: 'Optical frames and sunglasses, eye exams and personal fitting in our store.',
    lab: 'Prescription lenses for our own clients and for opticians in Kosovo and the EU.',
    clinic: 'Specialist consultations, assessment and follow-up visits for eye health.',
    optikaCta: 'Shop the collection',
    labCta: 'Meet the lab',
    clinicCta: 'Meet the clinic',
    here: 'You are here',
    more: 'Find out more',
    faqEyebrow: 'FAQ',
    faqHelp: 'Can’t find the answer? Call us or message us on WhatsApp — we’re happy to help.',
  },
});

type AnyDict<T extends Record<string, string>> = { me: T; sq: Record<keyof T, string>; en: Record<keyof T, string> };

/** The three-language value of one dictionary key — for shared blocks that take an `L10n` (e.g. ProcessSteps). */
export function l10nOf<T extends Record<string, string>>(d: AnyDict<T>, key: keyof T): L10n {
  return { me: d.me[key], sq: d.sq[key], en: d.en[key] };
}

/** Phone + WhatsApp pills from the store settings. `light` for dark panels. */
export function ContactButtons({ tone = 'dark', className }: { tone?: 'dark' | 'light'; className?: string }) {
  const settings = useSettings();
  const light = tone === 'light';
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      <a
        href={telHref(settings.phone)}
        className={cn('inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold transition', light ? 'bg-white text-ink hover:bg-sand' : 'bg-ink text-paper hover:bg-ink-soft')}
      >
        <Phone className="h-4 w-4" /> {settings.phone}
      </a>
      {settings.whatsapp && (
        <a
          href={waHref(settings.whatsapp)}
          target="_blank"
          rel="noreferrer"
          className={cn(
            'inline-flex h-11 items-center gap-2 rounded-full border px-5 text-sm font-semibold transition',
            light ? 'border-white/30 text-white hover:bg-white/10' : 'border-ink/15 bg-white/50 text-ink hover:border-ink/35 hover:bg-white',
          )}
        >
          <WhatsAppIcon className="h-4 w-4" /> WhatsApp
        </a>
      )}
    </div>
  );
}

/** Two-column FAQ: heading + help text + contact buttons on the left, accordion on the right. */
export function FaqSection({ title, items, eyebrow, className }: { title: string; items: { q: string; a: ReactNode }[]; eyebrow?: string; className?: string }) {
  const t = useDict(G);
  return (
    <section className={cn('py-24 sm:py-28', className)}>
      <div className="container-x grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
        <Reveal>
          <SectionHeading eyebrow={eyebrow ?? t('faqEyebrow')} title={title} />
          <p className="mt-5 max-w-sm text-[15.5px] leading-relaxed text-muted">{t('faqHelp')}</p>
          <ContactButtons className="mt-6" />
        </Reveal>
        <Reveal delay={120}>
          <Accordion items={items.map((it) => ({ title: it.q, content: it.a }))} />
        </Reveal>
      </div>
    </section>
  );
}

export type Division = 'optika' | 'lab' | 'clinic';

const DIVISIONS: { id: Division; name: string; image: string; to: string; cta: 'optikaCta' | 'labCta' | 'clinicCta' }[] = [
  { id: 'optika', name: 'Optika Miftari', image: '/images/lookbook/atelier-optical.webp', to: '/produktet', cta: 'optikaCta' },
  { id: 'lab', name: 'Optical Lab', image: '/images/s/laboratori.webp', to: '/optical-lab', cta: 'labCta' },
  { id: 'clinic', name: 'Klinika Miftari', image: '/images/s/klinika.webp', to: '/klinika', cta: 'clinicCta' },
];

/** "One family" cross-links between the three divisions, plus the company pages. */
export function GroupFamily({ current }: { current: Division }) {
  const t = useDict(G);
  const ts = useDict(site);
  const links = [
    { to: '/sherbimet', label: ts('nav_services') },
    { to: '/rreth-nesh', label: ts('nav_about') },
    { to: '/kontakt', label: ts('nav_contact') },
  ];
  return (
    <section className="pb-4 pt-4 sm:pt-8">
      <div className="container-x">
        <div className="rounded-[36px] bg-sand/70 p-4 py-8 ring-1 ring-sand-2 sm:p-10 lg:p-14">
          <Reveal>
            <SectionHeading className="px-2 sm:px-0" eyebrow={t('familyEyebrow')} title={t('familyTitle')} subtitle={t('familyText')} />
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-3 lg:gap-5">
            {DIVISIONS.map((d, i) => {
              const here = d.id === current;
              const body = (
                <>
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-sand-2 sm:h-28 sm:w-28">
                    <Img src={d.image} small alt="" className="h-full w-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.06]" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className={cn('text-[11px] font-bold uppercase tracking-[0.18em]', here ? 'text-brand-200' : 'text-muted')}>{here ? t('here') : pad2(i + 1)}</div>
                    <h3 className={cn('display mt-1.5 text-[24px] leading-tight', here ? 'text-white' : 'text-ink')}>{d.name}</h3>
                    <p className={cn('mt-1.5 text-[14px] leading-relaxed', here ? 'text-paper/70' : 'text-muted')}>{t(d.id)}</p>
                    {!here && (
                      <span className="mt-auto inline-flex items-center gap-1.5 self-start pt-4 text-[13.5px] font-semibold text-ink">
                        <span className="link-u">{t(d.cta)}</span>
                        <ArrowUpRight className="h-4 w-4 text-brand-600 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </span>
                    )}
                  </div>
                </>
              );
              const cls = 'group flex h-full gap-4 rounded-3xl p-4 sm:gap-5 transition-[box-shadow,transform] duration-500 sm:p-5';
              return (
                <Reveal key={d.id} delay={i * 100} className="h-full">
                  {here ? (
                    <div className={cn(cls, 'bg-ink')} aria-current="page">
                      {body}
                    </div>
                  ) : (
                    <Link to={d.to} className={cn(cls, 'bg-white ring-1 ring-line hover:-translate-y-1 hover:shadow-[0_28px_60px_-34px_rgba(28,26,23,0.4)]')}>
                      {body}
                    </Link>
                  )}
                </Reveal>
              );
            })}
          </div>
          <Reveal delay={200}>
            <div className="mt-10 flex flex-wrap items-center gap-2.5 px-2 sm:px-0">
              <span className="mr-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">{t('more')}</span>
              {links.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className="group inline-flex h-10 items-center gap-2 rounded-full border border-line bg-white px-4 text-[13.5px] font-semibold text-ink transition hover:border-ink/30"
                >
                  {l.label}
                  <ArrowRight className="h-3.5 w-3.5 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
                </Link>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
