import { ArrowRight, ArrowUpRight, Clock, FlaskConical, HeartHandshake, Mail, MapPin, Phone, ScanFace, Users } from 'lucide-react';
import { Link } from 'react-router';
import { Accent, Img, Reveal } from '@/components/ui/misc';
import { ButtonLink, buttonClass } from '@/components/ui/Button';
import { LogoMark } from '@/components/brand/Logo';
import { Breadcrumbs, SectionHeading } from '@/site/components/SectionHeading';
import { openBooking } from '@/site/components/utility/Booking';
import { usePageTitle } from '@/site/layout/SiteLayout';
import { CtaBand, ProcessSteps, StatsBand } from '@/site/components/company/Blocks';
import { pad2, telHref, useHomeData } from '@/site/components/company/data';
import { defineDict, useDict, useL } from '@/i18n';
import { site } from '@/i18n/site';
import { useSettings } from '@/store/hooks';
import { cn } from '@/lib/utils';

const T = defineDict({
  me: {
    eyebrow: 'O nama',
    title: 'Jasnoća, *s generacije na generaciju*.',
    ourWork: 'Pogledajte lookbook',
    country: 'Kosovo',
    floatSub: '30 godina porodične tradicije',
    yearsLabel: 'godina u Mitrovici',
    storyEyebrow: 'Naša priča',
    storyTitle: 'Porodična optika, *već 30 godina*',
    story1: 'Već trideset godina Optika Miftari je porodična optika u Mitrovici. Od prvog dana vodi nas isto pravilo: svakom kupcu posvetiti vreme, dati iskren savet i pomoći mu da pronađe par koji mu zaista pristaje.',
    story2: 'Danas smo deo grupe Miftari Vision Group — sa dve optike, sopstvenom optičkom laboratorijom i Klinikom Miftari. Okvire biramo sa ukusom, sočiva pripremamo pažljivo, a svaki par lično prilagođavamo.',
    groupEyebrow: 'Miftari Vision Group',
    groupTitle: 'Tri kompanije, *jedna grupa*',
    groupText: 'Miftari Vision Group je matična kompanija Klinike Miftari, Optike Miftari i Optical Lab-a — tri kompanije koje rade zajedno, od pregleda i recepta do gotovih naočara.',
    typeClinic: 'Klinika',
    typeBoutique: 'Optički butik',
    typeLab: 'Optička laboratorija',
    g1: 'Naš optički butik: okviri i naočare za sunce, pregled vida i lično prilagođavanje.',
    g2: 'Naša laboratorija za sočiva po receptu — za naše kupce i, kao B2B partner, za optike na Kosovu i u EU.',
    g3: 'Specijalistička briga o zdravlju oka: konsultacije i procena za lečenje.',
    g1cta: 'Pogledajte kolekciju',
    g2cta: 'Optical Lab za optike',
    g3cta: 'Zakažite konsultaciju',
    valuesEyebrow: 'Naše vrednosti',
    valuesTitle: 'Ono u šta *verujemo*',
    valuesText: 'Četiri principa koja prate svaki par — od prvog pregleda do poslednjeg podešavanja.',
    v1t: 'Iskren savet',
    v1: 'Preporučujemo ono što vam zaista treba — ni skuplji okvir ni deblje sočivo od potrebnog.',
    v2t: 'Laboratorijska izrada',
    v2: 'Sočiva brusimo, centriramo i proveravamo u sopstvenoj laboratoriji, zato znamo kvalitet svakog para.',
    v3t: 'Lično prilagođavanje',
    v3: 'PD, visina centra, drške i jastučići — svaki par podešavamo prema vašem licu.',
    v4t: 'Porodična tradicija',
    v4: 'Trideset godina u Mitrovici: znanje se prenosi u porodici, a poverenje sa jedne generacije kupaca na drugu.',
    allServices: 'Sve usluge',
    showEyebrow: 'Optika',
    showTitle: 'Posetite našu *optiku*',
    showText: 'Isprobajte okvire u miru, zakažite pregled vida i porazgovarajte sa našim optičarima — svaki par lično prilagođavamo.',
    address: 'Adresa',
    phone: 'Telefon',
    email: 'E-mail',
    openMap: 'Otvori mapu',
  },
  sq: {
    eyebrow: 'Rreth nesh',
    title: 'Qartësi, *brez pas brezi*.',
    ourWork: 'Shikoni lookbook-un',
    country: 'Kosovë',
    floatSub: '30 vjet traditë familjare',
    yearsLabel: 'vjet në Mitrovicë',
    storyEyebrow: 'Historia jonë',
    storyTitle: 'Optikë familjare, *prej 30 vjetësh*',
    story1: 'Prej tridhjetë vjetësh, Optika Miftari është optika e familjes në Mitrovicë. Që nga dita e parë na udhëheq i njëjti parim: çdo klienti t’i kushtojmë kohë, t’i japim këshillë të sinqertë dhe ta ndihmojmë të gjejë palën që i shkon vërtet.',
    story2: 'Sot jemi pjesë e Miftari Vision Group — me dy optika, laboratorin tonë optik dhe Klinikën Miftari. Kornizat i zgjedhim me shije, lentet i përgatitim me kujdes dhe çdo palë e përshtatim personalisht.',
    groupEyebrow: 'Miftari Vision Group',
    groupTitle: 'Tri kompani, *një grup*',
    groupText: 'Miftari Vision Group është kompania mëmë e Klinikës Miftari, Optikës Miftari dhe Optical Lab — tri kompani që punojnë bashkë, nga kontrolli dhe receta deri te syzet e gatshme.',
    typeClinic: 'Klinikë',
    typeBoutique: 'Butik optik',
    typeLab: 'Laborator optik',
    g1: 'Butiku ynë optik: korniza optike dhe syze dielli, kontroll i syve dhe përshtatje personale.',
    g2: 'Laboratori ynë për lente me recetë — për klientët tanë dhe, si partner B2B, për optikat në Kosovë dhe në BE.',
    g3: 'Kujdes specialistik për shëndetin e syve: konsulta dhe vlerësim për trajtim.',
    g1cta: 'Shikoni koleksionin',
    g2cta: 'Optical Lab për optikat',
    g3cta: 'Rezervoni konsultë',
    valuesEyebrow: 'Vlerat tona',
    valuesTitle: 'Ajo në të cilën *besojmë*',
    valuesText: 'Katër parime që e shoqërojnë çdo palë — nga kontrolli i parë deri te rregullimi i fundit.',
    v1t: 'Këshillim i sinqertë',
    v1: 'Ju rekomandojmë atë që ju nevojitet vërtet — as kornizë më të shtrenjtë, as lente më të trashë se ç’duhet.',
    v2t: 'Punim laboratorik',
    v2: 'Lentet i presim, i centrojmë dhe i kontrollojmë në laboratorin tonë, prandaj e njohim cilësinë e çdo pale.',
    v3t: 'Përshtatje personale',
    v3: 'PD, lartësia e qendrës, krahët dhe mbështetëset e hundës — çdo palë e rregullojmë sipas fytyrës suaj.',
    v4t: 'Traditë familjare',
    v4: 'Tridhjetë vjet në Mitrovicë: dija kalon brenda familjes, ndërsa besimi nga një brez klientësh te tjetri.',
    allServices: 'Të gjitha shërbimet',
    showEyebrow: 'Optika',
    showTitle: 'Ejani në *optikën tonë*',
    showText: 'Provoni kornizat me qetësi, rezervoni kontrollin e syve dhe bisedoni me optikët tanë — çdo palë e përshtatim personalisht.',
    address: 'Adresa',
    phone: 'Telefoni',
    email: 'E-mail',
    openMap: 'Hap hartën',
  },
  en: {
    eyebrow: 'About us',
    title: 'Clarity, *generation after generation*.',
    ourWork: 'See the lookbook',
    country: 'Kosovo',
    floatSub: '30 years of family tradition',
    yearsLabel: 'years in Mitrovica',
    storyEyebrow: 'Our story',
    storyTitle: 'A family optician *for 30 years*',
    story1: 'For thirty years, Optika Miftari has been the family optician in Mitrovica. From day one the same rule has guided us: give every client time, honest advice and help finding the pair that truly suits them.',
    story2: 'Today we are part of Miftari Vision Group — with two stores, our own optical lab and Klinika Miftari. We choose frames with taste, prepare lenses with care and fit every pair personally.',
    groupEyebrow: 'Miftari Vision Group',
    groupTitle: 'Three companies, *one group*',
    groupText: 'Miftari Vision Group is the parent company of Klinika Miftari, Optika Miftari and Optical Lab — three companies working together, from the eye exam and prescription to the finished glasses.',
    typeClinic: 'Clinic',
    typeBoutique: 'Optical boutique',
    typeLab: 'Optical lab',
    g1: 'Our optical boutique: optical frames and sunglasses, eye exams and personal fitting.',
    g2: 'Our prescription-lens laboratory — for our own clients and, as a B2B partner, for opticians in Kosovo and the EU.',
    g3: 'Specialist eye care: consultations and assessment for treatment.',
    g1cta: 'Shop the collection',
    g2cta: 'Optical Lab for opticians',
    g3cta: 'Book a consultation',
    valuesEyebrow: 'Our values',
    valuesTitle: 'What we *stand for*',
    valuesText: 'Four principles behind every pair — from the first exam to the final adjustment.',
    v1t: 'Honest advice',
    v1: 'We recommend what you actually need — never a pricier frame or a thicker lens than necessary.',
    v2t: 'Lab craftsmanship',
    v2: 'We edge, centre and check lenses in our own lab, so we know the quality of every single pair.',
    v3t: 'Personal fitting',
    v3: 'PD, fitting height, temples and nose pads — every pair is adjusted to your face.',
    v4t: 'Family tradition',
    v4: 'Thirty years in Mitrovica: know-how passed down in the family, trust passed from one generation of clients to the next.',
    allServices: 'All services',
    showEyebrow: 'The store',
    showTitle: 'Visit our *store*',
    showText: 'Try frames on at your own pace, book an eye exam and talk to our opticians — every pair is fitted personally.',
    address: 'Address',
    phone: 'Phone',
    email: 'E-mail',
    openMap: 'Open map',
  },
});

const VALUES = [
  { icon: HeartHandshake, title: 'v1t', text: 'v1' },
  { icon: FlaskConical, title: 'v2t', text: 'v2' },
  { icon: ScanFace, title: 'v3t', text: 'v3' },
  { icon: Users, title: 'v4t', text: 'v4' },
] as const;

export default function About() {
  const ts = useDict(site);
  const t = useDict(T);
  const l = useL();
  const settings = useSettings();
  const stats = useHomeData('stats');
  const process = useHomeData('process');
  usePageTitle(ts('nav_about'));

  const hours = l(settings.hours)
    .split('·')
    .map((s) => s.trim())
    .filter(Boolean);

  const contactRows = [
    { icon: MapPin, label: t('address'), value: [settings.address, settings.city].filter(Boolean).join(', '), href: settings.mapUrl, external: true },
    { icon: Clock, label: ts('hours'), value: hours, href: undefined, external: false },
    { icon: Phone, label: t('phone'), value: settings.phone, href: telHref(settings.phone), external: false },
    { icon: Mail, label: t('email'), value: settings.email, href: `mailto:${settings.email}`, external: false },
  ];

  const group = [
    { name: 'Klinika Miftari', type: t('typeClinic'), text: t('g3'), image: '/images/s/klinika.webp', cta: t('g3cta'), to: '/klinika' },
    { name: 'Optika Miftari', type: t('typeBoutique'), text: t('g1'), image: '/images/lookbook/atelier-optical.webp', cta: t('g1cta'), to: '/produktet' },
    { name: 'Optical Lab', type: t('typeLab'), text: t('g2'), image: '/images/s/laboratori.webp', cta: t('g2cta'), to: '/optical-lab' },
  ];

  return (
    <>
      {/* Split hero */}
      <section className="overflow-hidden border-b border-line bg-paper">
        <div className="container-x grid items-center gap-14 pb-20 pt-10 sm:pt-14 lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:pb-24">
          <div className="animate-fade-up">
            <Breadcrumbs items={[{ label: ts('nav_about') }]} />
            <div className="eyebrow mb-4 mt-10">{t('eyebrow')}</div>
            <h1 className="display max-w-xl text-[44px] leading-[1.02] text-ink sm:text-[64px]">
              <Accent text={t('title')} />
            </h1>
            <p className="mt-7 max-w-xl text-[17.5px] leading-[1.7] text-ink-soft">{l(settings.about)}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink to="/lookbook" variant="dark" size="lg" iconRight={<ArrowRight className="h-4 w-4" />}>
                {t('ourWork')}
              </ButtonLink>
              <ButtonLink to="/kontakt" variant="outline" size="lg">
                {ts('nav_contact')}
              </ButtonLink>
            </div>
            <div className="mt-10 flex items-center gap-3 border-t border-line pt-6 text-[13px] text-muted">
              <MapPin className="h-4 w-4 text-brand-600" />
              <span>
                <span className="font-semibold text-ink">{settings.legalName}</span> · {settings.city}, {t('country')}
              </span>
            </div>
          </div>
          <div className="relative animate-fade-up [animation-delay:120ms]">
            <div className="absolute -right-6 -top-6 hidden h-40 w-40 rounded-full bg-brand-100/70 blur-2xl lg:block" />
            <div className="relative aspect-[4/3] overflow-hidden rounded-[32px] bg-sand sm:aspect-[5/4] lg:aspect-[4/5]">
              <Img src="/images/misc/about.webp" eager alt={settings.companyName} className="h-full w-full object-cover object-[50%_35%]" />
            </div>
            <div className="absolute -bottom-8 left-4 right-4 flex items-center gap-4 rounded-3xl bg-white p-5 shadow-[0_30px_60px_-30px_rgba(28,26,23,0.45)] ring-1 ring-line sm:left-auto sm:right-8 sm:w-[340px] lg:-left-10 lg:right-auto">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-paper ring-1 ring-line">
                <LogoMark className="h-9" />
              </span>
              <div className="min-w-0">
                <div className="display text-[22px] leading-tight text-ink">{l(settings.tagline)}</div>
                <div className="mt-0.5 text-[12px] font-bold uppercase tracking-[0.16em] text-brand-700">{t('floatSub')}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="pt-28 sm:pt-32">
        <div className="container-x grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
          <Reveal className="relative order-2 lg:order-1">
            <div className="grid grid-cols-[1.35fr_1fr] gap-3 sm:gap-4">
              <div className="aspect-[4/5] overflow-hidden rounded-[28px] bg-sand">
                <Img src="/images/lookbook/generations.webp" alt="" className="h-full w-full object-cover" />
              </div>
              <div className="flex flex-col gap-3 pt-10 sm:gap-4 sm:pt-16">
                <div className="aspect-[4/5] overflow-hidden rounded-[24px] bg-sand">
                  <Img src="/images/lookbook/craft.webp" small alt="" className="h-full w-full object-cover" />
                </div>
                <div className="rounded-[24px] bg-ink p-5 text-white">
                  <div className="display text-[44px] leading-none">30</div>
                  <div className="mt-2 text-[12px] font-bold uppercase leading-snug tracking-[0.14em] text-paper/65">{t('yearsLabel')}</div>
                </div>
              </div>
            </div>
          </Reveal>
          <Reveal delay={120} className="order-1 lg:order-2">
            <SectionHeading eyebrow={t('storyEyebrow')} title={t('storyTitle')} />
            <p className="mt-6 text-[17px] leading-[1.75] text-ink-soft">{t('story1')}</p>
            <p className="mt-4 text-[17px] leading-[1.75] text-ink-soft">{t('story2')}</p>
          </Reveal>
        </div>
      </section>

      {/* The group */}
      <section className="py-24 sm:py-32">
        <div className="container-x">
          <Reveal>
            <SectionHeading eyebrow={t('groupEyebrow')} title={t('groupTitle')} subtitle={t('groupText')} />
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-3 lg:gap-6">
            {group.map((g, i) => {
              const inner = (
                <>
                  <div className="relative aspect-[4/3] overflow-hidden bg-sand">
                    <Img src={g.image} small alt="" className="h-full w-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.05]" />
                    <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-ink backdrop-blur-md">{g.type}</span>
                  </div>
                  <div className="flex flex-1 flex-col p-6 sm:p-7">
                    <h3 className="display text-[28px] leading-tight text-ink">{g.name}</h3>
                    <p className="mt-2.5 text-[15px] leading-relaxed text-muted">{g.text}</p>
                    <span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-semibold text-ink">
                      <span className="link-u">{g.cta}</span>
                      <ArrowUpRight className="h-4 w-4 text-brand-600 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </>
              );
              const cls = 'group flex h-full flex-col overflow-hidden rounded-3xl bg-white text-left ring-1 ring-line transition-[box-shadow,transform] duration-500 hover:-translate-y-1 hover:shadow-[0_28px_60px_-34px_rgba(28,26,23,0.4)]';
              return (
                <Reveal key={g.name} delay={i * 100} className="h-full">
                  {g.to ? (
                    <Link to={g.to} className={cls}>
                      {inner}
                    </Link>
                  ) : (
                    <button type="button" onClick={() => openBooking('clinic')} className={cn(cls, 'w-full')}>
                      {inner}
                    </button>
                  )}
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="pb-24 sm:pb-32">
        <div className="container-x grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <Reveal className="lg:sticky lg:top-32 lg:self-start">
            <SectionHeading eyebrow={t('valuesEyebrow')} title={t('valuesTitle')} subtitle={t('valuesText')} />
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:gap-5">
            {VALUES.map((v, i) => {
              const Icon = v.icon;
              const tone = i === 1 || i === 2;
              return (
                <Reveal key={v.title} delay={(i % 2) * 110} className="h-full">
                  <div className={cn('h-full', i % 2 === 1 && 'sm:translate-y-12')}>
                    <div className={cn('group flex h-full flex-col rounded-3xl p-7 ring-1 transition-[box-shadow,transform] duration-500 hover:-translate-y-1 hover:shadow-[0_28px_60px_-34px_rgba(28,26,23,0.4)] sm:p-8', tone ? 'bg-sand/70 ring-sand-2' : 'bg-white ring-line')}>
                      <div className="flex items-center justify-between">
                        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-600 text-white transition-transform duration-500 group-hover:-rotate-6">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="display text-[15px] text-muted">{pad2(i + 1)}</span>
                      </div>
                      <h3 className="display mt-10 text-[30px] leading-tight text-ink">{t(v.title)}</h3>
                      <p className="mt-3 text-[15px] leading-relaxed text-muted">{t(v.text)}</p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {stats && <StatsBand data={stats} />}

      {process && (
        <ProcessSteps
          data={process}
          action={
            <ButtonLink to="/sherbimet" variant="outline" iconRight={<ArrowRight className="h-4 w-4" />}>
              {t('allServices')}
            </ButtonLink>
          }
        />
      )}

      {/* The store */}
      <section className="pt-24 sm:pt-28">
        <div className="container-x">
          <Reveal>
            <div className="grid overflow-hidden rounded-[36px] bg-white ring-1 ring-line lg:grid-cols-[1.05fr_1fr]">
              <div className="relative min-h-[300px] bg-sand sm:min-h-[380px] lg:min-h-[600px]">
                <Img src="/images/s/pershtatja.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 text-[12px] font-bold text-ink shadow-sm backdrop-blur-md">
                  <MapPin className="h-3.5 w-3.5 text-brand-600" /> {settings.city}
                </div>
              </div>
              <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-14">
                <div className="eyebrow">{t('showEyebrow')}</div>
                <h2 className="display mt-3 text-[36px] leading-[1.05] text-ink sm:text-[48px]">
                  <Accent text={t('showTitle')} />
                </h2>
                <p className="mt-4 max-w-md text-[16px] leading-relaxed text-muted">{t('showText')}</p>
                <ul className="mt-8 divide-y divide-line border-y border-line">
                  {contactRows.map((r) => {
                    const Icon = r.icon;
                    const body = Array.isArray(r.value) ? (
                      r.value.map((line) => <span key={line} className="block">{line}</span>)
                    ) : (
                      r.value
                    );
                    return (
                      <li key={r.label} className="flex items-start gap-4 py-4">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                          <Icon className="h-[18px] w-[18px]" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">{r.label}</div>
                          {r.href ? (
                            <a
                              href={r.href}
                              {...(r.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                              className="link-u mt-0.5 inline-block break-words text-[15.5px] font-semibold text-ink"
                            >
                              {body}
                            </a>
                          ) : (
                            <div className="mt-0.5 text-[15.5px] font-semibold text-ink">{body}</div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-8 flex flex-wrap gap-3">
                  <a href={settings.mapUrl} target="_blank" rel="noreferrer" className={buttonClass({ variant: 'dark', size: 'lg' })}>
                    {t('openMap')} <ArrowUpRight className="h-4 w-4" />
                  </a>
                  <a href={telHref(settings.phone)} className={buttonClass({ variant: 'outline', size: 'lg' })}>
                    <Phone className="h-4 w-4" /> {ts('callUs')}
                  </a>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <CtaBand image="/images/misc/contact.webp" />
    </>
  );
}
