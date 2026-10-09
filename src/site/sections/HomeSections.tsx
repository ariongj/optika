import { useMemo, useRef, useState, type ComponentType } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import {
  ArrowRight, ArrowUpRight, Award, BadgeCheck, BadgePercent, CalendarCheck, Check, ChevronLeft, ChevronRight, Clock, Copy,
  CreditCard, Eye, FlaskConical, Gem, Gift, Glasses, HeartHandshake, Home as HomeIcon, Layers, Leaf, MapPin, MessageCircle,
  Microscope, Package, Phone, RotateCcw, Ruler, ScanEye, ScanFace, ShieldCheck, Sparkles, Star, Stethoscope, Store, Sun, Timer,
  Truck, Users, Wrench,
} from 'lucide-react';
import type { HomeSection, Product } from '@/lib/types';
import { Accent, Accordion, Img, Reveal, useCountdown } from '@/components/ui/misc';
import { ButtonLink } from '@/components/ui/Button';
import { InstagramIcon } from '@/components/brand/Social';
import { SectionHeading } from '@/site/components/SectionHeading';
import { ProductCard } from '@/site/components/ProductCard';
import { MeasureForm } from '@/site/components/MeasureForm';
import { BOOK_ID, CtaLink } from '@/site/components/utility/Booking';
import { pluralOne } from '@/site/components/utility/shared';
import { defineDict, useDict, useL, useLang } from '@/i18n';
import { site } from '@/i18n/site';
import { common } from '@/i18n/common';
import { useDb } from '@/store/db';
import { useActiveProducts, useCategories, useSettings } from '@/store/hooks';
import { isOnSale } from '@/lib/pricing';
import { date } from '@/lib/format';
import { cn } from '@/lib/utils';

type DataOf<T extends HomeSection['type']> = Extract<HomeSection, { type: T }>['data'];

const H = defineDict({
  me: {
    days: 'dana',
    hours: 'sati',
    minutes: 'min',
    seconds: 'sek',
    endsIn: 'Akcija ističe za',
    useCode: 'Kod za dodatni popust',
    copied: 'Kod je kopiran',
    allProducts: 'Svi proizvodi',
    productsOne: '{n} proizvod',
    productsMany: '{n} proizvoda',
    tab_bestsellers: 'Najprodavanije',
    tab_sale: 'Na akciji',
    tab_new: 'Novo',
    tab_manual: 'Izdvojeno',
    allProjects: 'Ceo lookbook',
    readMore: 'Pročitaj',
    minRead: '{n} min čitanja',
    allPosts: 'Svi saveti',
    helpTitle: 'Niste pronašli odgovor?',
    helpText: 'Pozovite nas ili pošaljite poruku — odgovaramo istog dana.',
    follow: 'Zapratite nas',
    benefit1: 'Pregled 15 € — besplatan uz kupovinu okvira',
    benefit2: 'Merenje PD-a i prilagođavanje besplatno',
    benefit3: 'Sočiva iz naše laboratorije za 2–7 radnih dana',
    learnMore: 'Sve usluge',
    serviceMore: 'Saznajte više',
    step: 'Korak',
  },
  sq: {
    days: 'ditë',
    hours: 'orë',
    minutes: 'min',
    seconds: 'sek',
    endsIn: 'Oferta përfundon për',
    useCode: 'Kodi për zbritje shtesë',
    copied: 'Kodi u kopjua',
    allProducts: 'Të gjitha produktet',
    productsOne: '{n} produkt',
    productsMany: '{n} produkte',
    tab_bestsellers: 'Më të shiturat',
    tab_sale: 'Në ofertë',
    tab_new: 'Të reja',
    tab_manual: 'Të veçuara',
    allProjects: 'I gjithë lookbook-u',
    readMore: 'Lexo',
    minRead: '{n} min lexim',
    allPosts: 'Të gjitha këshillat',
    helpTitle: 'Nuk e gjetët përgjigjen?',
    helpText: 'Na telefononi ose na shkruani — përgjigjemi të njëjtën ditë.',
    follow: 'Na ndiqni',
    benefit1: 'Kontrolli 15 € — falas me blerjen e kornizës',
    benefit2: 'Matja e PD-së dhe përshtatja falas',
    benefit3: 'Lente nga laboratori ynë për 2–7 ditë pune',
    learnMore: 'Të gjitha shërbimet',
    serviceMore: 'Mësoni më shumë',
    step: 'Hapi',
  },
  en: {
    days: 'days',
    hours: 'hrs',
    minutes: 'min',
    seconds: 'sec',
    endsIn: 'Sale ends in',
    useCode: 'Code for an extra discount',
    copied: 'Code copied',
    allProducts: 'All products',
    productsOne: '{n} product',
    productsMany: '{n} products',
    tab_bestsellers: 'Bestsellers',
    tab_sale: 'On sale',
    tab_new: 'New in',
    tab_manual: 'Featured',
    allProjects: 'The full lookbook',
    readMore: 'Read',
    minRead: '{n} min read',
    allPosts: 'All advice',
    helpTitle: 'Didn’t find your answer?',
    helpText: 'Call us or send a message — we reply the same day.',
    follow: 'Follow us',
    benefit1: 'Eye exam €15 — free with a frame purchase',
    benefit2: 'Free PD measurement and fitting',
    benefit3: 'Lenses from our own lab in 2–7 working days',
    learnMore: 'All services',
    serviceMore: 'Learn more',
    step: 'Step',
  },
});

/**
 * Icons the CMS can pick for trust-strip items (by lucide name; keep in sync with the builder's TRUST_ICONS in
 * admin/components/builder/meta.ts). Unknown keys fall back to Sparkles.
 */
const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  Eye, ScanEye, ScanFace, Glasses, Sun, ShieldCheck, BadgeCheck, Truck, Package, FlaskConical, Microscope, Stethoscope, Clock, Timer,
  Sparkles, Award, Star, Gem, Phone, Wrench, Ruler, Store, MapPin, CalendarCheck, BadgePercent, Gift, RotateCcw, CreditCard,
  HeartHandshake, Users, Layers, Leaf, Home: HomeIcon,
};

/** Discount badge for the promo block, taken from its own copy ("… deri −20% …"); none when the copy has no percentage. */
const percentIn = (...texts: string[]) => texts.join(' ').match(/[−–-]\s?\d{1,2}\s?%/)?.[0]?.replace(/^[–-]/, '−').replace(/\s/g, '') ?? '';

/* ------------------------------------------------------------------ */
export function TrustSection({ data, overlap }: { data: DataOf<'trust'>; overlap: boolean }) {
  const l = useL();
  return (
    <section className={cn('relative z-10', overlap ? '-mt-[64px]' : 'pt-14')}>
      <div className="container-x">
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-3xl bg-line shadow-[0_30px_70px_-35px_rgba(28,26,23,0.45)] ring-1 ring-line sm:grid-cols-2 lg:grid-cols-4">
          {data.items.map((it, i) => {
            const Icon = ICONS[it.icon] ?? Sparkles;
            return (
              <div key={i} className="flex items-start gap-4 bg-white px-5 py-5 sm:px-6 sm:py-6">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-[15px] font-bold text-ink">{l(it.title)}</div>
                  <div className="mt-0.5 text-[13.5px] leading-snug text-muted">{l(it.text)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
export function CategoriesSection({ data }: { data: DataOf<'categories'> }) {
  const l = useL();
  const lang = useLang();
  const h = useDict(H);
  const cats = useCategories();
  const products = useActiveProducts();
  return (
    <section className="py-24 sm:py-28">
      <div className="container-x">
        <Reveal>
          <SectionHeading
            eyebrow={l(data.eyebrow)}
            title={l(data.title)}
            subtitle={l(data.subtitle)}
            action={
              <ButtonLink to="/produktet" variant="outline" iconRight={<ArrowRight className="h-4 w-4" />}>
                {h('allProducts')}
              </ButtonLink>
            }
          />
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3 lg:gap-6 lg:pb-14">
          {cats.map((c, i) => {
            const n = products.filter((p) => p.categoryId === c.id).length;
            return (
              <Reveal key={c.id} delay={(i % 3) * 90} className={cn(i % 3 === 1 && 'lg:translate-y-14')}>
                <Link to={`/produktet/${c.slug}`} className="group relative block aspect-[4/5] overflow-hidden rounded-3xl bg-ink">
                  <Img src={c.image} alt={l(c.name)} className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.4s] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.07]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/15 to-transparent" />
                  <div className="absolute left-5 top-5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-white backdrop-blur-md">{String(i + 1).padStart(2, '0')}</div>
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-6 sm:p-7">
                    <div>
                      <h3 className="display text-[34px] leading-none text-white sm:text-[40px]">{l(c.name)}</h3>
                      <p className="mt-2 text-[14px] text-white/75">{l(c.tagline)}</p>
                      <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">{h(pluralOne(n, lang) ? 'productsOne' : 'productsMany', { n })}</p>
                    </div>
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-ink transition-transform duration-500 group-hover:-rotate-45 group-hover:bg-brand-600 group-hover:text-white">
                      <ArrowRight className="h-5 w-5" />
                    </span>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
type FeatMode = DataOf<'featured'>['mode'];

function pickProducts(products: Product[], mode: FeatMode, ids: string[]) {
  switch (mode) {
    case 'sale':
      return products.filter(isOnSale).sort((a, b) => b.sold - a.sold);
    case 'new':
      return [...products].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case 'manual':
      return ids.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[];
    default:
      return [...products].sort((a, b) => b.sold - a.sold);
  }
}

export function Scroller({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const tc = useDict(common);
  const by = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' });
  return (
    <div className={cn('relative', className)}>
      <div ref={ref} className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:gap-6 lg:px-0">
        {children}
      </div>
      <div className="pointer-events-none absolute -top-[76px] right-0 hidden gap-2 lg:flex">
        <button onClick={() => by(-1)} className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full border border-ink/15 bg-white transition hover:border-ink hover:bg-ink hover:text-white" aria-label={tc('prev')}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button onClick={() => by(1)} className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full border border-ink/15 bg-white transition hover:border-ink hover:bg-ink hover:text-white" aria-label={tc('next')}>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

export function FeaturedSection({ data }: { data: DataOf<'featured'> }) {
  const l = useL();
  const h = useDict(H);
  const products = useActiveProducts();
  const [mode, setMode] = useState<FeatMode>(data.mode);
  const tabs: FeatMode[] = data.mode === 'manual' ? ['manual', 'bestsellers', 'sale', 'new'] : ['bestsellers', 'sale', 'new'];
  const list = useMemo(() => pickProducts(products, mode, data.productIds).slice(0, 10), [products, mode, data.productIds]);
  return (
    <section className="pb-24 sm:pb-28">
      <div className="container-x">
        <Reveal>
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="eyebrow mb-3">{l(data.eyebrow)}</div>
              <h2 className="display text-[34px] leading-[1.05] sm:text-5xl">
                <Accent text={l(data.title)} />
              </h2>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-1 rounded-full bg-white p-1 ring-1 ring-line">
              {tabs.map((m) => (
                <button key={m} onClick={() => setMode(m)} className={cn('rounded-full px-4 py-2 text-[13.5px] font-semibold transition-colors', mode === m ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink')}>
                  {h(`tab_${m}`)}
                </button>
              ))}
            </div>
          </div>
        </Reveal>
        <Scroller className="mt-8 lg:mt-24">
          {list.map((p, i) => (
            <div key={p.id} className="w-[72%] shrink-0 snap-start sm:w-[44%] lg:w-[calc((100%-72px)/4)]">
              <ProductCard product={p} priority={i < 4} />
            </div>
          ))}
        </Scroller>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
export function PromoSection({ data }: { data: DataOf<'promo'> }) {
  const l = useL();
  const h = useDict(H);
  const cd = useCountdown(data.endsAt);
  const pct = percentIn(l(data.title), l(data.eyebrow), l(data.text));
  const cells: [number, string][] = [
    [cd.days, h('days')],
    [cd.hours, h('hours')],
    [cd.minutes, h('minutes')],
    [cd.seconds, h('seconds')],
  ];
  return (
    <section className="pb-24 sm:pb-28">
      <div className="container-x">
        <Reveal>
          <div className="grid overflow-hidden rounded-[32px] bg-ink lg:grid-cols-2">
            <div className="relative min-h-[320px] overflow-hidden lg:min-h-[560px]">
              <Img src={data.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-ink/30" />
              {pct && (
                <div className="absolute left-6 top-6 grid h-28 w-28 rotate-[-10deg] place-items-center rounded-full bg-brand-600 text-center text-white shadow-2xl sm:h-32 sm:w-32">
                  <span className="display text-[34px] leading-none sm:text-[40px]">{pct}</span>
                </div>
              )}
            </div>
            <div className="bg-grain relative flex flex-col justify-center p-8 sm:p-12 lg:p-16">
              <div className="eyebrow text-brand-200">{l(data.eyebrow)}</div>
              <h2 className="display mt-4 text-[38px] leading-[1.02] text-white sm:text-[54px]">
                <Accent text={l(data.title)} accentClassName="text-brand-200!" />
              </h2>
              <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-paper/70">{l(data.text)}</p>
              <div className="mt-8">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-paper/45">{h('endsIn')}</div>
                <div className="mt-3 flex gap-2 sm:gap-3">
                  {cells.map(([v, label]) => (
                    <div key={label} className="w-[68px] rounded-2xl bg-white/[0.07] py-3 text-center ring-1 ring-white/10 sm:w-20">
                      <div className="display text-3xl tabular-nums text-white sm:text-4xl">{String(v).padStart(2, '0')}</div>
                      <div className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-paper/45">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <CtaLink to={data.cta.href} variant="light" size="lg" iconRight={<ArrowRight className="h-4 w-4" />}>
                  {l(data.cta.label)}
                </CtaLink>
                {data.code && (
                  <button
                    onClick={() => {
                      void navigator.clipboard?.writeText(data.code);
                      toast.success(h('copied'), { description: data.code });
                    }}
                    className="group inline-flex h-13 items-center gap-3 rounded-full border border-dashed border-white/35 px-5 text-left text-white transition hover:border-white"
                    title={h('useCode')}
                  >
                    <span className="text-[11px] font-semibold uppercase leading-tight tracking-[0.14em] text-paper/55">{h('useCode')}</span>
                    <span className="font-mono text-[15px] font-bold tracking-wider">{data.code}</span>
                    <Copy className="h-4 w-4 opacity-60 group-hover:opacity-100" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
export function ProcessSection({ data }: { data: DataOf<'process'> }) {
  const l = useL();
  const h = useDict(H);
  return (
    <section className="bg-sand/60 py-24 sm:py-28">
      <div className="container-x">
        <Reveal>
          <SectionHeading eyebrow={l(data.eyebrow)} title={l(data.title)} align="center" />
        </Reveal>
        <ol className="relative mt-16 grid gap-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div className="pointer-events-none absolute left-0 right-0 top-[27px] hidden border-t border-dashed border-ink/20 lg:block" />
          {data.steps.map((s, i) => (
            <Reveal as="li" key={i} delay={i * 110} className="relative">
              <div className="relative z-10 grid h-14 w-14 place-items-center rounded-full bg-paper text-brand-700 ring-1 ring-line">
                <span className="display text-xl">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <div className="mt-6 text-[11px] font-bold uppercase tracking-[0.2em] text-muted">
                {h('step')} {i + 1}
              </div>
              <h3 className="mt-2 text-xl font-bold text-ink">{l(s.title)}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{l(s.text)}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/** Each homepage service links to its row on the services page (ids `sherbimi-1`…, see pages/Services). */
const serviceHref = (i: number) => `/sherbimet#sherbimi-${i + 1}`;

export function ServicesSection({ data }: { data: DataOf<'services'> }) {
  const l = useL();
  const h = useDict(H);
  const [active, setActive] = useState(0);
  const items = data.items;
  return (
    <section className="py-24 sm:py-28">
      <div className="container-x">
        <Reveal>
          <SectionHeading
            eyebrow={l(data.eyebrow)}
            title={l(data.title)}
            subtitle={l(data.subtitle)}
            action={
              <ButtonLink to="/sherbimet" variant="outline" iconRight={<ArrowRight className="h-4 w-4" />}>
                {h('learnMore')}
              </ButtonLink>
            }
          />
        </Reveal>

        {/* Desktop: hover list with image reveal */}
        <div className="mt-14 hidden gap-12 lg:grid lg:grid-cols-[1.05fr_1fr]">
          <ul className="border-t border-line">
            {items.map((it, i) => (
              <li key={i}>
                <Link
                  to={serviceHref(i)}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  className="group flex w-full items-start gap-6 border-b border-line py-7 text-left"
                >
                  <span className={cn('display mt-1 w-10 text-lg tabular-nums transition-colors', active === i ? 'text-brand-600' : 'text-muted/60')}>{String(i + 1).padStart(2, '0')}</span>
                  <span className="flex-1">
                    <span className={cn('display block text-[30px] leading-tight transition-colors', active === i ? 'text-ink' : 'text-ink/45 group-hover:text-ink/75')}>{l(it.title)}</span>
                    <span className={cn('grid transition-all duration-500', active === i ? 'mt-2 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
                      <span className="overflow-hidden text-[15px] leading-relaxed text-muted">{l(it.text)}</span>
                    </span>
                  </span>
                  <ArrowUpRight className={cn('mt-2 h-6 w-6 transition-all', active === i ? 'text-brand-600' : 'text-ink/25')} />
                </Link>
              </li>
            ))}
          </ul>
          <div className="relative">
            <div className="sticky top-28 aspect-[4/5] overflow-hidden rounded-[28px] bg-sand">
              {items.map((it, i) => (
                <Img key={i} src={it.image} alt={l(it.title)} className={cn('absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-700', active === i ? 'scale-100 opacity-100!' : 'scale-105 opacity-0!')} />
              ))}
              <div className="absolute bottom-5 left-5 right-5 rounded-2xl bg-white/90 p-4 backdrop-blur-md">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">{String(active + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}</div>
                <div className="mt-1 font-semibold text-ink">{l(items[active]?.title)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile/tablet: cards */}
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:hidden">
          {items.map((it, i) => (
            <Reveal key={i} delay={(i % 2) * 80} className="h-full">
              <Link to={serviceHref(i)} className="group flex h-full flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-line">
                <div className="aspect-[16/10] overflow-hidden bg-sand">
                  <Img src={it.image} small alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="display text-sm text-brand-600">{String(i + 1).padStart(2, '0')}</div>
                  <h3 className="mt-1 text-lg font-bold">{l(it.title)}</h3>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{l(it.text)}</p>
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-[13.5px] font-semibold text-ink">
                    {h('serviceMore')} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
export function ProjectsSection({ data }: { data: DataOf<'projects'> }) {
  const l = useL();
  const h = useDict(H);
  const all = useDb((s) => s.projects);
  const projects = useMemo(() => [...all].sort((a, b) => Number(b.featured) - Number(a.featured)).slice(0, 8), [all]);
  return (
    <section className="relative overflow-hidden bg-ink py-24 text-white sm:py-28">
      <div className="bg-grain pointer-events-none absolute inset-0" />
      <div className="container-x relative">
        <Reveal>
          <SectionHeading eyebrow={l(data.eyebrow)} title={l(data.title)} subtitle={l(data.subtitle)} tone="light" />
        </Reveal>
        <Scroller className="mt-10 lg:mt-24 [&_button]:border-white/20 [&_button]:bg-transparent [&_button]:text-white [&_button:hover]:bg-white [&_button:hover]:text-ink">
          {projects.map((p) => (
            <Link key={p.id} to={`/lookbook?p=${encodeURIComponent(p.id)}`} className="group relative block aspect-[4/5] w-[78%] shrink-0 snap-start overflow-hidden rounded-3xl bg-ink-soft sm:aspect-[4/3] sm:w-[62%] lg:w-[46%]">
              <Img src={p.image} alt={l(p.title)} className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.4s] group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                <div className="flex flex-wrap gap-1.5">
                  {p.tags.map((tg, k) => (
                    <span key={k} className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                      {l(tg)}
                    </span>
                  ))}
                </div>
                <h3 className="display mt-3 text-2xl leading-tight text-white sm:text-[32px]">{l(p.title)}</h3>
                <p className="mt-1.5 text-sm text-white/65">{[p.location, p.year].filter(Boolean).join(' · ')}</p>
              </div>
            </Link>
          ))}
        </Scroller>
        <div className="mt-10">
          <ButtonLink to="/lookbook" variant="outlineLight" iconRight={<ArrowRight className="h-4 w-4" />}>
            {h('allProjects')}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
export function StatsSection({ data }: { data: DataOf<'stats'> }) {
  const l = useL();
  return (
    <section className="py-24 sm:py-28">
      <div className="container-x grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <Reveal className="relative">
          <div className="aspect-[5/6] overflow-hidden rounded-[32px] bg-sand">
            <Img src={data.image} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="absolute -bottom-8 left-6 right-6 rounded-3xl bg-white p-6 shadow-[0_30px_60px_-30px_rgba(28,26,23,0.45)] ring-1 ring-line sm:left-auto sm:right-[-24px] sm:w-[380px]">
            <MessageCircle className="h-6 w-6 text-brand-600" />
            <p className="display mt-3 text-[22px] leading-snug text-ink">„{l(data.quote)}“</p>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 gap-x-6 gap-y-12 pt-10 lg:pt-0">
          {data.items.map((s, i) => (
            <Reveal key={i} delay={i * 90} className="border-t border-ink/15 pt-6">
              <div className="display text-[56px] leading-none text-ink sm:text-7xl">{s.value}</div>
              <p className="mt-3 max-w-[16ch] text-[15px] leading-snug text-muted">{l(s.label)}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
export function BlogSection({ data }: { data: DataOf<'blog'> }) {
  const l = useL();
  const lang = useLang();
  const h = useDict(H);
  const all = useDb((s) => s.posts);
  const posts = useMemo(() => all.filter((p) => p.published).slice(0, 3), [all]);
  if (!posts.length) return null;
  return (
    <section className="bg-sand/50 py-24 sm:py-28">
      <div className="container-x">
        <Reveal>
          <SectionHeading
            eyebrow={l(data.eyebrow)}
            title={l(data.title)}
            action={
              <ButtonLink to="/keshilla" variant="outline" iconRight={<ArrowRight className="h-4 w-4" />}>
                {h('allPosts')}
              </ButtonLink>
            }
          />
        </Reveal>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {posts.map((p, i) => (
            <Reveal key={p.id} delay={i * 90}>
              <Link to={`/keshilla/${p.slug}`} className="group block">
                <div className="aspect-[4/3] overflow-hidden rounded-3xl bg-sand">
                  <Img src={p.cover} small alt="" className="h-full w-full object-cover transition-transform duration-[1.2s] group-hover:scale-105" />
                </div>
                <div className="mt-5 flex items-center gap-3 text-[12px] font-semibold text-muted">
                  <span className="rounded-full bg-white px-2.5 py-1 text-ink ring-1 ring-line">{l(p.tag)}</span>
                  <span>{date(p.publishedAt, lang)}</span>
                  <span>·</span>
                  <span>{h('minRead', { n: p.readMinutes })}</span>
                </div>
                <h3 className="display mt-3 text-[26px] leading-tight text-ink group-hover:text-brand-700">{l(p.title)}</h3>
                <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-muted">{l(p.excerpt)}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
                  {h('readMore')} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
export function FaqSection({ data }: { data: DataOf<'faq'> }) {
  const l = useL();
  const h = useDict(H);
  const t = useDict(site);
  const settings = useSettings();
  return (
    <section className="py-24 sm:py-28">
      <div className="container-x grid gap-12 lg:grid-cols-[1fr_1.35fr] lg:gap-20">
        <Reveal>
          <SectionHeading eyebrow={l(data.eyebrow)} title={l(data.title)} />
          <div className="mt-10 rounded-3xl bg-white p-6 ring-1 ring-line">
            <h3 className="text-lg font-bold">{h('helpTitle')}</h3>
            <p className="mt-1.5 text-[15px] text-muted">{h('helpText')}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <a href={`tel:${settings.phone.replace(/\s/g, '')}`} className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-paper hover:bg-ink-soft">
                <Phone className="h-4 w-4" /> {settings.phone}
              </a>
              <ButtonLink to="/kontakt" variant="outline">
                {t('nav_contact')}
              </ButtonLink>
            </div>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <Accordion items={data.items.map((it) => ({ title: l(it.q), content: l(it.a) }))} />
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
export function InstagramSection({ data }: { data: DataOf<'instagram'> }) {
  const l = useL();
  const h = useDict(H);
  const settings = useSettings();
  const url = `https://www.instagram.com/${settings.instagram}/`;
  return (
    <section className="pb-24 sm:pb-28">
      <div className="container-x">
        <Reveal>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <a href={url} target="_blank" rel="noreferrer" className="eyebrow inline-flex items-center gap-2">
                <InstagramIcon className="h-4 w-4" /> @{settings.instagram}
              </a>
              <h2 className="display mt-3 text-[34px] leading-tight sm:text-[44px]">{l(data.title)}</h2>
            </div>
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 self-start rounded-full bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] px-5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 sm:self-auto">
              <InstagramIcon className="h-4 w-4" /> {h('follow')}
            </a>
          </div>
        </Reveal>
        <div className="mt-10 grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-6">
          {data.images.map((src, i) => (
            <Reveal key={i} delay={i * 60}>
              <a href={url} target="_blank" rel="noreferrer" className="group relative block aspect-square overflow-hidden rounded-2xl bg-sand">
                <Img src={src} small alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <span className="absolute inset-0 grid place-items-center bg-ink/0 text-white opacity-0 transition group-hover:bg-ink/35 group-hover:opacity-100">
                  <InstagramIcon className="h-7 w-7" />
                </span>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
export function CtaSection({ data }: { data: DataOf<'cta'> }) {
  const l = useL();
  const h = useDict(H);
  return (
    <section id={BOOK_ID} className="scroll-mt-28 pb-8">
      <div className="container-x">
        <Reveal>
          <div className="grid gap-4 rounded-[36px] bg-sand/80 p-3 sm:p-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="relative min-h-[420px] overflow-hidden rounded-[28px] bg-ink">
              <Img src={data.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-75" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-ink/10" />
              <div className="relative flex h-full flex-col justify-end p-7 sm:p-10">
                <div className="eyebrow text-brand-200">{l(data.eyebrow)}</div>
                <h2 className="display mt-3 text-[34px] leading-[1.04] text-white sm:text-5xl">
                  <Accent text={l(data.title)} accentClassName="text-brand-200!" />
                </h2>
                <p className="mt-4 max-w-md text-[15.5px] leading-relaxed text-paper/75">{l(data.text)}</p>
                <ul className="mt-6 space-y-2.5">
                  {[h('benefit1'), h('benefit2'), h('benefit3')].map((b) => (
                    <li key={b} className="flex items-center gap-3 text-[15px] font-medium text-white">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-600">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <MeasureForm type="measurement" className="shadow-none ring-0! lg:p-10!" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
