import { useMemo, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { ArrowRight, ArrowUpRight, CalendarCheck, Check, Eye, FlaskConical, Globe2, Phone, ShieldCheck, Sparkles } from 'lucide-react';
import type { Category, L10n } from '@/lib/types';
import { Accent, Accordion, Img, Reveal } from '@/components/ui/misc';
import { Button } from '@/components/ui/Button';
import { WhatsAppIcon } from '@/components/brand/Social';
import { PageHero, SectionHeading } from '@/site/components/SectionHeading';
import { MeasureForm } from '@/site/components/MeasureForm';
import { BOOK_ID, openBooking } from '@/site/components/utility/Booking';
import { usePageTitle } from '@/site/layout/SiteLayout';
import { C, ProcessSteps, StatsBand } from '@/site/components/company/Blocks';
import { pad2, scrollToId, telHref, useHomeData, waHref } from '@/site/components/company/data';
import { defineDict, useDict, useL } from '@/i18n';
import { site } from '@/i18n/site';
import { useCategories, useSettings } from '@/store/hooks';
import { cn } from '@/lib/utils';

const T = defineDict({
  me: {
    heroFact1: 'Pregled 15 € — besplatno uz okvir',
    heroFact2: 'Sopstvena optička laboratorija',
    heroFact3: '30 godina porodične tradicije',
    index: 'Pregled usluga',
    included: 'Šta je uključeno',
    bookVisit: 'Zakažite termin',
    moreClinic: 'O klinici',
    moreLab: 'O laboratoriji',
    askLab: 'Zatražite ponudu',
    fromRange: 'Proizvodi',
    faqHelp: 'Imate pitanje koje nije na listi? Pozovite nas — savet je uvek besplatan.',
    labEyebrow: 'Optical Lab · B2B',
    labTitle: 'Vaš recept, *naša preciznost*.',
    labText: 'Optical Lab je laboratorija grupe Miftari Holding Group. Za optike na Kosovu i u EU izrađujemo sočiva po receptu — od brušenja i centriranja do montaže i završne provere.',
    lab1: 'Sočiva po receptu za optike na Kosovu i u EU',
    lab2: 'Brušenje, centriranje, montaža i provera porudžbine',
    lab3: 'Direktna komunikacija sa laboratorijom',
    lab4: 'Uslovi, rokovi i tehnička dokumentacija dogovaraju se pojedinačno',
    labFormTitle: 'Zahtev za saradnju',
    labFormText: 'Opišite vrstu sočiva, okvirne količine i tržište. Javljamo se sa ponudom i uslovima.',
    bookEyebrow: 'Pregled vida',
    bookTitle: 'Zakažite *pregled vida*',
    bookText: 'Izaberite uslugu i dan koji vam odgovara — termin vam potvrđujemo telefonom istog dana.',
    book1: 'Pregled 15 € — besplatan uz kupovinu okvira',
    book2: 'Merenje PD-a i prilagođavanje besplatno',
    book3: 'Sočiva iz naše laboratorije za 2–7 radnih dana',
    preferPhone: 'Radije telefonom?',
  },
  sq: {
    heroFact1: 'Kontrolli 15 € — falas me kornizë',
    heroFact2: 'Laborator optik i yni',
    heroFact3: '30 vjet traditë familjare',
    index: 'Pasqyra e shërbimeve',
    included: 'Çfarë përfshihet',
    bookVisit: 'Rezervo termin',
    moreClinic: 'Rreth klinikës',
    moreLab: 'Rreth laboratorit',
    askLab: 'Kërko ofertë',
    fromRange: 'Produktet',
    faqHelp: 'Keni një pyetje që nuk është në listë? Na telefononi — këshilla është gjithmonë falas.',
    labEyebrow: 'Optical Lab · B2B',
    labTitle: 'Receta juaj, *precizioni ynë*.',
    labText: 'Optical Lab është laboratori i Miftari Holding Group. Për optikat në Kosovë dhe në BE punojmë lente me recetë — nga prerja dhe centrimi deri te montimi dhe kontrolli përfundimtar.',
    lab1: 'Lente me recetë për optika në Kosovë dhe në BE',
    lab2: 'Prerje, centrim, montim dhe kontroll i porosisë',
    lab3: 'Komunikim i drejtpërdrejtë me laboratorin',
    lab4: 'Kushtet, afatet dhe dokumentacioni teknik konfirmohen individualisht',
    labFormTitle: 'Kërkesë për bashkëpunim',
    labFormText: 'Përshkruani llojin e lenteve, sasitë e përafërta dhe tregun. Ju kthejmë përgjigje me ofertë dhe kushte.',
    bookEyebrow: 'Kontroll i syve',
    bookTitle: 'Rezervoni *kontrollin e syve*',
    bookText: 'Zgjidhni shërbimin dhe ditën që ju përshtatet — orarin jua konfirmojmë me telefon po atë ditë.',
    book1: 'Kontrolli 15 € — falas me blerjen e kornizës',
    book2: 'Matja e PD-së dhe përshtatja falas',
    book3: 'Lente nga laboratori ynë për 2–7 ditë pune',
    preferPhone: 'Preferoni telefonin?',
  },
  en: {
    heroFact1: 'Eye exam €15 — free with a frame',
    heroFact2: 'Our own optical lab',
    heroFact3: '30 years of family tradition',
    index: 'Services at a glance',
    included: 'What’s included',
    bookVisit: 'Book a visit',
    moreClinic: 'About the clinic',
    moreLab: 'About the lab',
    askLab: 'Request a quote',
    fromRange: 'Shop',
    faqHelp: 'Got a question that isn’t listed? Give us a call — advice is always free.',
    labEyebrow: 'Optical Lab · B2B',
    labTitle: 'Your prescription, *our precision*.',
    labText: 'Optical Lab is the lens laboratory of Miftari Holding Group. For opticians in Kosovo and the EU we make prescription lenses — from edging and centring to mounting and a final check.',
    lab1: 'Prescription lenses for opticians in Kosovo and the EU',
    lab2: 'Edging, centring, mounting and order verification',
    lab3: 'Direct communication with the lab',
    lab4: 'Terms, lead times and technical documents agreed individually',
    labFormTitle: 'Partnership request',
    labFormText: 'Tell us the lens types, rough volumes and your market. We’ll come back with a quote and terms.',
    bookEyebrow: 'Eye exam',
    bookTitle: 'Book an *eye exam*',
    bookText: 'Choose a service and a day that suits you — we’ll confirm the time by phone the same day.',
    book1: 'Eye exam €15 — free with a frame purchase',
    book2: 'Free PD measurement and fitting',
    book3: 'Lenses from our own lab in 2–7 working days',
    preferPhone: 'Prefer to call?',
  },
});

const tri = (me: string, sq: string, en: string): L10n => ({ me, sq, en });

/** Service kinds the CMS rows are matched to (by title, so the client can reorder and rename freely). */
type Kind = 'exam' | 'fitting' | 'contacts' | 'lab' | 'repair' | 'clinic' | 'b2b';

const MATCH: [Kind, RegExp][] = [
  ['b2b', /b2b|optical lab|partner/i],
  ['clinic', /klinik|clinic/i],
  ['contacts', /kontakt|contact/i],
  ['repair', /riparim|repair|popravk/i],
  ['fitting', /përshtat|fitting|prilago|\bPD\b/i],
  ['exam', /kontroll|exam|pregled/i],
  ['lab', /laborator|\blab\b|lente|lens|sočiv/i],
];
const kindOf = (title: L10n): Kind | undefined => MATCH.find(([, re]) => re.test(`${title.sq} ${title.en}`))?.[0];

/** What's included per kind of service. */
const INCLUDED: Record<Kind, L10n[]> = {
  exam: [
    tri('Oštrina vida na daljinu i blizinu', 'Matje e mprehtësisë së shikimit për larg dhe afër', 'Visual acuity for distance and near'),
    tri('Određivanje dioptrije i provera starog recepta', 'Përcaktim i dioptrisë dhe verifikim i recetës së vjetër', 'Refraction and a check of your old prescription'),
    tri('Savet o sočivima prema poslu i načinu života', 'Këshillë për lentet sipas punës dhe stilit të jetës', 'Lens advice for your work and lifestyle'),
    tri('15 € — besplatno uz kupovinu okvira', '15 € — falas me blerjen e kornizës', '€15 — free with a frame purchase'),
  ],
  fitting: [
    tri('Merenje pupilarne distance (PD) i visine centra', 'Matje e distancës pupilare (PD) dhe e lartësisë së qendrës', 'Pupillary distance (PD) and fitting-height measurement'),
    tri('Podešavanje drški i jastučića za nos', 'Përshtatje e krahëve dhe e mbështetëseve të hundës', 'Temple and nose-pad adjustment'),
    tri('Provera okvira nakon montaže sočiva', 'Kontroll i kornizës pas montimit të lenteve', 'Frame check after the lenses are mounted'),
    tri('Besplatno za svaki par iz naše optike', 'Falas për çdo palë nga optika jonë', 'Free for every pair from our store'),
  ],
  contacts: [
    tri('Procena oka i izbor vrste sočiva', 'Vlerësim i syrit dhe zgjedhje e llojit të lenteve', 'Eye assessment and choice of lens type'),
    tri('Probna sočiva i provera udobnosti', 'Lente prove dhe kontroll i komoditetit', 'Trial lenses and a comfort check'),
    tri('Uputstvo za stavljanje, skidanje i higijenu', 'Udhëzime për vendosjen, heqjen dhe higjienën', 'Guidance on insertion, removal and hygiene'),
    tri('Kontrolni pregled posle prvih nedelja', 'Kontroll pasues pas javëve të para', 'A follow-up check after the first weeks'),
  ],
  lab: [
    tri('Jednožižna, progresivna, za ekran i fotohromatska sočiva', 'Lente njëvizore, progresive, për ekran dhe fotokromatike', 'Single-vision, progressive, screen and photochromic lenses'),
    tri('Brušenje, centriranje i montaža u našoj laboratoriji', 'Prerje, centrim dhe montim në laboratorin tonë', 'Edging, centring and mounting in our own lab'),
    tri('Završna provera dioptrije pre preuzimanja', 'Kontroll përfundimtar i dioptrisë para dorëzimit', 'Final power check before handover'),
    tri('Gotovo za 2–7 radnih dana', 'Gati për 2–7 ditë pune', 'Ready in 2–7 working days'),
  ],
  repair: [
    tri('Zatezanje šrafova i zamena jastučića', 'Shtrëngim i vidave dhe ndërrim i mbështetëseve të hundës', 'Screw tightening and nose-pad replacement'),
    tri('Ispravljanje i podešavanje okvira', 'Drejtim dhe rregullim i kornizës', 'Frame straightening and re-alignment'),
    tri('Nova sočiva u vašem okviru', 'Lente të reja në kornizën tuaj', 'New lenses in your own frame'),
    tri('Sitna podešavanja obično odmah', 'Rregullimet e vogla zakonisht në vend', 'Small adjustments usually on the spot'),
  ],
  clinic: [
    tri('Specijalistička konsultacija o zdravlju oka', 'Konsultë specialistike për shëndetin e syve', 'Specialist eye-health consultation'),
    tri('Procena za lečenje i kontrolni pregledi', 'Vlerësim për trajtim dhe kontrolle pasuese', 'Assessment for treatment and follow-up visits'),
    tri('Direktna veza sa optikom i laboratorijom', 'Lidhje e drejtpërdrejtë me optikën dhe laboratorin', 'A direct link with our store and lab'),
    tri('Uslugu i termin potvrđuje naš tim', 'Shërbimin dhe orarin i konfirmon ekipi ynë', 'Service and time confirmed by our team'),
  ],
  b2b: [
    tri('Sočiva po receptu za optike na Kosovu i u EU', 'Lente me recetë për optika në Kosovë dhe në BE', 'Prescription lenses for opticians in Kosovo and the EU'),
    tri('Brušenje, montaža i provera porudžbina', 'Prerje, montim dhe kontroll i porosive', 'Edging, mounting and order verification'),
    tri('Direktna komunikacija sa laboratorijom', 'Komunikim i drejtpërdrejtë me laboratorin', 'Direct communication with the lab'),
    tri('Uslovi i rokovi se dogovaraju pojedinačno', 'Kushtet dhe afatet konfirmohen individualisht', 'Terms and lead times agreed individually'),
  ],
};

/** Price / lead-time chip per kind (only where the figure is known). */
const PRICE: Partial<Record<Kind, L10n>> = {
  exam: tri('15 € · besplatno uz okvir', '15 € · falas me kornizë', '€15 · free with a frame'),
  fitting: tri('Besplatno', 'Falas', 'Free'),
  lab: tri('2–7 radnih dana', '2–7 ditë pune', '2–7 working days'),
  b2b: tri('Ponuda po porudžbini', 'Ofertë sipas porosisë', 'Quoted per order'),
};

/** Shop categories next to each kind (by slug). */
const RELATED: Partial<Record<Kind, string[]>> = {
  fitting: ['syze-optike'],
  lab: ['lente-me-recete', 'syze-optike'],
  exam: ['lente-me-recete'],
};

/** Booking-form service pre-selected by each row's button. */
const BOOK_SERVICE: Partial<Record<Kind, string>> = { exam: 'exam', fitting: 'fitting', contacts: 'contacts', repair: 'repair', clinic: 'clinic', lab: 'exam' };

const LAB_ID = 'optical-lab';

const HERO_FACTS = [
  { icon: Eye, key: 'heroFact1' },
  { icon: FlaskConical, key: 'heroFact2' },
  { icon: ShieldCheck, key: 'heroFact3' },
] as const;

export default function Services() {
  const ts = useDict(site);
  const t = useDict(T);
  const tc = useDict(C);
  const l = useL();
  const settings = useSettings();
  const cats = useCategories();
  const services = useHomeData('services');
  const process = useHomeData('process');
  const stats = useHomeData('stats');
  const faq = useHomeData('faq');
  usePageTitle(ts('nav_services'));

  const items = useMemo(() => (services?.items ?? []).map((it) => ({ ...it, kind: kindOf(it.title) })), [services]);
  const related = (kind?: Kind) => (kind ? (RELATED[kind] ?? []).map((s) => cats.find((c) => c.slug === s)).filter(Boolean) as Category[] : []);

  return (
    <>
      <PageHero
        image="/images/hero/exam.webp"
        crumbs={[{ label: ts('nav_services') }]}
        eyebrow={services ? l(services.eyebrow) : ts('nav_services')}
        title={services ? l(services.title) : ts('nav_services')}
        subtitle={services ? l(services.subtitle) : undefined}
      >
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={() => openBooking('exam')} icon={<Eye className="h-4 w-4" />}>
            {tc('bookFree')}
          </Button>
          <a href={telHref(settings.phone)} className="inline-flex h-13 items-center gap-2.5 rounded-full border border-white/40 px-6 text-[15px] font-semibold text-white backdrop-blur-sm transition hover:bg-white/10">
            <Phone className="h-4 w-4" /> {settings.phone}
          </a>
        </div>
        <ul className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-[13.5px] font-medium text-paper/75">
          {HERO_FACTS.map(({ icon: Icon, key }) => (
            <li key={key} className="inline-flex items-center gap-2">
              <Icon className="h-4 w-4 text-brand-200" /> {t(key)}
            </li>
          ))}
        </ul>
      </PageHero>

      {/* Index — quick jump to each service */}
      {items.length > 0 && (
        <div className="container-x relative z-10 -mt-8 sm:-mt-10">
          <nav
            aria-label={t('index')}
            style={{ '--n': items.length } as CSSProperties}
            className="no-scrollbar flex overflow-x-auto rounded-3xl bg-white shadow-[0_30px_70px_-40px_rgba(28,26,23,0.5)] ring-1 ring-line lg:grid lg:grid-cols-[repeat(var(--n),minmax(0,1fr))] lg:overflow-visible"
          >
            {items.map((it, i) => (
              <button
                key={i}
                type="button"
                onClick={() => scrollToId(`sherbimi-${i + 1}`)}
                className={cn('group flex min-w-[168px] flex-1 flex-col items-start gap-1.5 px-5 py-5 text-left transition-colors hover:bg-paper lg:min-w-0', i > 0 && 'border-l border-line', i === 0 && 'rounded-l-3xl', i === items.length - 1 && 'rounded-r-3xl')}
              >
                <span className="flex w-full items-center justify-between">
                  <span className="display text-[15px] text-brand-600">{pad2(i + 1)}</span>
                  <ArrowRight className="h-3.5 w-3.5 rotate-90 text-ink/25 transition-all group-hover:translate-y-0.5 group-hover:text-brand-600" />
                </span>
                <span className="text-[14px] font-semibold leading-snug text-ink">{l(it.title)}</span>
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Services — alternating rows */}
      <section className="py-24 sm:py-32">
        <div className="container-x space-y-24 sm:space-y-32">
          {items.map((it, i) => {
            const flip = i % 2 === 1;
            const incl = it.kind ? INCLUDED[it.kind] : [];
            const rel = related(it.kind);
            const price = it.kind ? PRICE[it.kind] : undefined;
            return (
              <article key={i} id={`sherbimi-${i + 1}`} className="grid scroll-mt-32 items-center gap-10 lg:grid-cols-2 lg:gap-20">
                <Reveal className={cn('relative', flip && 'lg:order-2')}>
                  <div className={cn('absolute inset-0 rounded-[32px] bg-sand', flip ? '-translate-x-4 translate-y-4 sm:-translate-x-6 sm:translate-y-6' : 'translate-x-4 translate-y-4 sm:translate-x-6 sm:translate-y-6')} />
                  <div className="group relative aspect-[4/3] overflow-hidden rounded-[28px] bg-sand-2 lg:aspect-[5/4]">
                    <Img src={it.image} alt={l(it.title)} className="h-full w-full object-cover transition-transform duration-[1.4s] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.04]" />
                    <span className="absolute left-5 top-5 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-ink backdrop-blur-md">
                      {pad2(i + 1)} / {pad2(items.length)}
                    </span>
                    {price && (
                      <span className="absolute bottom-5 left-5 rounded-full bg-ink/80 px-3.5 py-1.5 text-[12.5px] font-semibold text-white ring-1 ring-white/15 backdrop-blur-md">{l(price)}</span>
                    )}
                  </div>
                </Reveal>
                <Reveal delay={120} className={cn(flip && 'lg:order-1')}>
                  <div className="display select-none text-[88px] leading-[0.8] text-brand-600/15 sm:text-[120px]" aria-hidden>
                    {pad2(i + 1)}
                  </div>
                  <h2 className="display -mt-5 text-[34px] leading-[1.05] text-ink sm:-mt-8 sm:text-[46px]">
                    <Accent text={l(it.title)} />
                  </h2>
                  <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted">{l(it.text)}</p>
                  {incl.length > 0 && (
                    <div className="mt-8 rounded-3xl border border-line bg-white/60 p-5 sm:p-6">
                      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-soft">{t('included')}</div>
                      <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                        {incl.map((x, k) => (
                          <li key={k} className="flex items-start gap-3 text-[14.5px] leading-snug text-ink-soft">
                            <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
                              <Check className="h-3 w-3" strokeWidth={3} />
                            </span>
                            {l(x)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    {it.kind === 'b2b' ? (
                      <Button variant="dark" onClick={() => scrollToId(LAB_ID)} iconRight={<ArrowRight className="h-4 w-4" />}>
                        {t('askLab')}
                      </Button>
                    ) : (
                      <Button variant="dark" onClick={() => openBooking(it.kind ? BOOK_SERVICE[it.kind] : undefined)} iconRight={<CalendarCheck className="h-4 w-4" />}>
                        {t('bookVisit')}
                      </Button>
                    )}
                    {(it.kind === 'clinic' || it.kind === 'lab' || it.kind === 'b2b') && (
                      <Link
                        to={it.kind === 'clinic' ? '/klinika' : '/optical-lab'}
                        className="inline-flex h-11 items-center gap-1.5 rounded-full border border-line bg-white px-5 text-[14px] font-semibold text-ink transition hover:border-ink/30"
                      >
                        {t(it.kind === 'clinic' ? 'moreClinic' : 'moreLab')} <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    )}
                    {rel.length > 0 && <span className="ml-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">{t('fromRange')}</span>}
                    {rel.map((c) => (
                      <Link
                        key={c.id}
                        to={`/produktet/${c.slug}`}
                        className="group inline-flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-3.5 text-[13.5px] font-semibold text-ink transition hover:border-ink/30"
                      >
                        <Img src={c.image} small alt="" className="h-8 w-8 rounded-full object-cover" />
                        {l(c.name)}
                        <ArrowUpRight className="h-3.5 w-3.5 text-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-600" />
                      </Link>
                    ))}
                  </div>
                </Reveal>
              </article>
            );
          })}
        </div>
      </section>

      {process && (
        <ProcessSteps
          data={process}
          action={
            <Button variant="outline" onClick={() => openBooking('exam')} icon={<Eye className="h-4 w-4" />}>
              {tc('bookFree')}
            </Button>
          }
        />
      )}

      {/* Optical Lab — B2B lens partnership */}
      <section id={LAB_ID} className="scroll-mt-24 py-24 sm:py-28">
        <div className="container-x">
          <Reveal>
            <div className="relative isolate grid gap-10 overflow-hidden rounded-[36px] bg-ink p-6 text-white sm:p-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:p-14">
              <Img src="/images/s/lab-polish.webp" alt="" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-35" />
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-ink via-ink/90 to-ink/60" />
              <div className="bg-grain pointer-events-none absolute inset-0 -z-10" />
              <div className="flex flex-col">
                <div className="eyebrow text-brand-200">{t('labEyebrow')}</div>
                <h2 className="display mt-4 text-[36px] leading-[1.04] sm:text-[52px]">
                  <Accent text={t('labTitle')} accentClassName="text-brand-200!" />
                </h2>
                <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-paper/70">{t('labText')}</p>
                <ul className="mt-8 space-y-3.5">
                  {(['lab1', 'lab2', 'lab3', 'lab4'] as const).map((k, i) => {
                    const Icon = [Globe2, FlaskConical, Sparkles, ShieldCheck][i];
                    return (
                      <li key={k} className="flex items-start gap-3 text-[15px] text-white/90">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-brand-200 ring-1 ring-white/15">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="pt-1">{t(k)}</span>
                      </li>
                    );
                  })}
                </ul>
                <Link to="/optical-lab" className="mt-8 inline-flex w-fit items-center gap-1.5 text-[15px] font-semibold text-brand-200 transition-colors hover:text-white">
                  {t('moreLab')} <ArrowRight className="h-4 w-4" />
                </Link>
                <div className="mt-auto grid grid-cols-3 gap-2 pt-10">
                  {['/images/s/lab-laser.webp', '/images/s/lab-blank.webp', '/images/s/b2b.webp'].map((src) => (
                    <div key={src} className="aspect-[4/3] overflow-hidden rounded-2xl bg-ink-soft ring-1 ring-white/10">
                      <Img src={src} small alt="" className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[28px] bg-white text-ink">
                <div className="px-6 pt-7 sm:px-8 sm:pt-8">
                  <h3 className="display text-[28px] leading-tight sm:text-[32px]">{t('labFormTitle')}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{t('labFormText')}</p>
                </div>
                <MeasureForm type="quote" b2b defaultService="Optical Lab B2B" className="ring-0! sm:pt-6!" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {stats && <StatsBand data={stats} />}

      {/* FAQ */}
      {faq && faq.items.length > 0 && (
        <section className="py-24 sm:py-28">
          <div className="container-x grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
            <Reveal>
              <SectionHeading eyebrow={l(faq.eyebrow)} title={l(faq.title)} />
              <p className="mt-5 max-w-sm text-[15.5px] leading-relaxed text-muted">{t('faqHelp')}</p>
              <a href={telHref(settings.phone)} className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-ink-soft">
                <Phone className="h-4 w-4" /> {settings.phone}
              </a>
            </Reveal>
            <Reveal delay={120}>
              <Accordion items={faq.items.map((it) => ({ title: l(it.q), content: l(it.a) }))} />
            </Reveal>
          </div>
        </section>
      )}

      {/* Booking */}
      <section id={BOOK_ID} className="scroll-mt-24 pb-8">
        <div className="container-x">
          <Reveal>
            <div className="grid gap-4 rounded-[36px] bg-sand/80 p-3 sm:p-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="relative isolate flex min-h-[440px] flex-col justify-end overflow-hidden rounded-[28px] bg-ink p-7 sm:p-10">
                <Img src="/images/s/kontrolli.webp" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
                <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/60 to-ink/10" />
                <div className="eyebrow text-brand-200">{t('bookEyebrow')}</div>
                <h2 className="display mt-3 text-[34px] leading-[1.04] text-white sm:text-[46px]">
                  <Accent text={t('bookTitle')} accentClassName="text-brand-200!" />
                </h2>
                <p className="mt-4 max-w-md text-[15.5px] leading-relaxed text-paper/75">{t('bookText')}</p>
                <ul className="mt-6 space-y-2.5">
                  {[t('book1'), t('book2'), t('book3')].map((b) => (
                    <li key={b} className="flex items-center gap-3 text-[15px] font-medium text-white">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
                <div className="mt-8 border-t border-white/15 pt-6">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-paper/55">{t('preferPhone')}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href={telHref(settings.phone)} className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-ink transition hover:bg-sand">
                      <Phone className="h-4 w-4" /> {settings.phone}
                    </a>
                    {settings.whatsapp && (
                      <a
                        href={waHref(settings.whatsapp)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-11 items-center gap-2 rounded-full border border-white/30 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
                      >
                        <WhatsAppIcon className="h-4 w-4" /> WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              </div>
              <MeasureForm type="measurement" defaultService="exam" className="shadow-none ring-0! lg:p-10!" />
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
