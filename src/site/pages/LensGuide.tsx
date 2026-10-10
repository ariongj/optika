import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ArrowDown, ArrowRight, CalendarCheck, FlaskConical, Phone, Ruler, ShieldCheck } from 'lucide-react';
import type { Post } from '@/lib/types';
import { Accordion, Reveal } from '@/components/ui/misc';
import { Button, ButtonLink } from '@/components/ui/Button';
import { PageHero, SectionHeading } from '@/site/components/SectionHeading';
import { PostCard } from '@/site/components/content/PostCard';
import { usePublishedPosts } from '@/site/components/content/posts';
import { CtaBand } from '@/site/components/company/Blocks';
import { scrollToId, telHref } from '@/site/components/company/data';
import { isLensPackage } from '@/site/components/product/optical';
import { openBooking } from '@/site/components/utility/Booking';
import { usePageTitle } from '@/site/layout/SiteLayout';
import { LensChooser } from '@/site/components/guides/LensChooser';
import { ThicknessCompare } from '@/site/components/guides/ThicknessCompare';
import { Coatings, IndexTable, LabBlock, LensTypes, RxExplainer } from '@/site/components/guides/LensSections';
import { LG } from '@/site/components/guides/lensDict';
import { ADVICE_SLUGS, LENS_FAQ, STRENGTHS, USES, type LensUse, type Strength } from '@/site/components/guides/lensData';
import { useDict, useL } from '@/i18n';
import { useActiveProducts, useSettings } from '@/store/hooks';

const asUse = (v: string | null) => USES.find((u) => u.id === v)?.id;
const asStrength = (v: string | null) => STRENGTHS.find((s) => s.id === v)?.id;

const FACTS = [
  { icon: FlaskConical, key: 'fact1' },
  { icon: ShieldCheck, key: 'fact2' },
  { icon: Ruler, key: 'fact3' },
] as const;

/** /lentet — lens guide: chooser, thickness comparison, lens types, coatings, index table, prescription explainer. */
export default function LensGuide() {
  const t = useDict(LG);
  const l = useL();
  const settings = useSettings();
  const products = useActiveProducts();
  const lenses = useMemo(() => products.filter(isLensPackage), [products]);
  const posts = usePublishedPosts();
  const advice = useMemo(() => ADVICE_SLUGS.map((s) => posts.find((p) => p.slug === s)).filter((p): p is Post => !!p), [posts]);
  // Deep links: /lentet?per=screen&fuqia=mid pre-answers the chooser.
  const [params] = useSearchParams();
  const [use, setUse] = useState<LensUse | undefined>(() => asUse(params.get('per')));
  const [strength, setStrength] = useState<Strength | undefined>(() => asStrength(params.get('fuqia')));
  usePageTitle(t('title'));

  return (
    <>
      <PageHero image="/images/misc/lens.webp" crumbs={[{ label: t('title') }]} eyebrow={t('heroEyebrow')} title={t('heroTitle')} subtitle={t('heroText')}>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={() => scrollToId('zgjedhesi')} iconRight={<ArrowDown className="h-4 w-4" />}>
            {t('heroCta')}
          </Button>
          <Button size="lg" variant="outlineLight" onClick={() => openBooking('exam')} icon={<CalendarCheck className="h-4 w-4" />}>
            {t('bookExam')}
          </Button>
        </div>
        <ul className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-[13.5px] font-medium text-paper/75">
          {FACTS.map(({ icon: Icon, key }) => (
            <li key={key} className="inline-flex items-center gap-2">
              <Icon className="h-4 w-4 text-brand-200" /> {t(key)}
            </li>
          ))}
        </ul>
      </PageHero>

      {/* 01 — chooser */}
      <section id="zgjedhesi" className="scroll-mt-24 pb-20 pt-16 sm:pb-28 sm:pt-24">
        <div className="container-x">
          <Reveal>
            <SectionHeading eyebrow={t('chooserEyebrow')} title={t('chooserTitle')} subtitle={t('chooserText')} />
          </Reveal>
          <div className="mt-10 sm:mt-12">
            <LensChooser use={use} strength={strength} onUse={setUse} onStrength={setStrength} lenses={lenses} />
          </div>
        </div>
      </section>

      {/* 02 — thickness */}
      <section className="border-y border-line bg-white/50 py-20 sm:py-28">
        <div className="container-x">
          <Reveal>
            <SectionHeading eyebrow={t('thickEyebrow')} title={t('thickTitle')} subtitle={t('thickText')} />
          </Reveal>
          <Reveal className="mt-10 sm:mt-12">
            <ThicknessCompare strength={strength} onStrength={setStrength} />
          </Reveal>
        </div>
      </section>

      {/* 03 — lens types */}
      <section className="py-20 sm:py-28">
        <div className="container-x">
          <Reveal>
            <SectionHeading
              eyebrow={t('typesEyebrow')}
              title={t('typesTitle')}
              subtitle={t('typesText')}
              action={
                <ButtonLink to="/produktet/lente-me-recete" variant="outline" size="sm" iconRight={<ArrowRight className="h-4 w-4" />}>
                  {t('allLenses')}
                </ButtonLink>
              }
            />
          </Reveal>
          <div className="mt-10 sm:mt-12">
            <LensTypes lenses={lenses} />
          </div>
        </div>
      </section>

      {/* 04 — coatings */}
      <section className="border-y border-line bg-white/50 py-20 sm:py-28">
        <div className="container-x">
          <Reveal>
            <SectionHeading eyebrow={t('coatEyebrow')} title={t('coatTitle')} subtitle={t('coatText')} />
          </Reveal>
          <div className="mt-10 sm:mt-12">
            <Coatings lenses={lenses} />
          </div>
        </div>
      </section>

      {/* 05 — index table */}
      <section className="py-20 sm:py-28">
        <div className="container-x">
          <Reveal>
            <SectionHeading eyebrow={t('indexEyebrow')} title={t('indexTitle')} subtitle={t('indexText')} />
          </Reveal>
          <Reveal className="mt-10 sm:mt-12">
            <IndexTable lenses={lenses} />
            <p className="mt-4 text-[13px] text-muted">{t('approx')}</p>
          </Reveal>
        </div>
      </section>

      {/* 06 — prescription */}
      <section id="receta" className="scroll-mt-24 border-y border-line bg-sand/40 py-20 sm:py-28">
        <div className="container-x">
          <Reveal>
            <SectionHeading eyebrow={t('rxEyebrow')} title={t('rxTitle')} subtitle={t('rxText')} />
          </Reveal>
          <Reveal className="mt-10 sm:mt-12">
            <RxExplainer />
          </Reveal>
        </div>
      </section>

      {/* Optical Lab */}
      <section className="pt-20 sm:pt-28">
        <div className="container-x">
          <Reveal>
            <LabBlock />
          </Reveal>
        </div>
      </section>

      {/* Advice */}
      {advice.length > 0 && (
        <section className="pt-20 sm:pt-28">
          <div className="container-x">
            <Reveal>
              <SectionHeading
                eyebrow={t('adviceEyebrow')}
                title={t('adviceTitle')}
                action={
                  <ButtonLink to="/keshilla" variant="outline" size="sm" iconRight={<ArrowRight className="h-4 w-4" />}>
                    {t('allAdvice')}
                  </ButtonLink>
                }
              />
            </Reveal>
            <div className="no-scrollbar -mx-4 mt-10 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 sm:mx-0 sm:mt-12 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 lg:grid-cols-4">
              {advice.map((p, i) => (
                <Reveal key={p.id} delay={i * 70} className="w-[78%] shrink-0 snap-start sm:w-auto">
                  <PostCard post={p} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="py-20 sm:py-28">
        <div className="container-x grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          <Reveal>
            <SectionHeading eyebrow={t('faqEyebrow')} title={t('faqTitle')} />
            <p className="mt-5 max-w-sm text-[15.5px] leading-relaxed text-muted">{t('faqText')}</p>
            <a href={telHref(settings.phone)} className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-ink-soft">
              <Phone className="h-4 w-4" /> {settings.phone}
            </a>
          </Reveal>
          <Reveal delay={120}>
            <Accordion items={LENS_FAQ.map((f) => ({ title: l(f.q), content: l(f.a) }))} />
          </Reveal>
        </div>
      </section>

      <CtaBand image="/images/s/kontrolli.webp" className="pt-0! pb-8" />
    </>
  );
}
