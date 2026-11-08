import { memo, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ArrowDown, ArrowRight, FlaskConical, Phone, Ruler, ShieldCheck } from 'lucide-react';
import type { Post, Product } from '@/lib/types';
import { Accent, Accordion, Reveal } from '@/components/ui/misc';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Breadcrumbs, SectionHeading } from '@/site/components/SectionHeading';
import { PostCard } from '@/site/components/content/PostCard';
import { usePublishedPosts } from '@/site/components/content/posts';
import { CtaBand } from '@/site/components/company/Blocks';
import { scrollToId, telHref } from '@/site/components/company/data';
import { isLensPackage } from '@/site/components/product/optical';
import { usePageTitle } from '@/site/layout/SiteLayout';
import { LensChooser } from '@/site/components/guides/LensChooser';
import { LensSimulator } from '@/site/components/guides/simulator/LensSimulator';
import { SIM } from '@/site/components/guides/simulator/dict';
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

/** The rest of the page. The sliders above change the page's state as they are dragged, and none of this depends on it. */
const GuideSections = memo(function GuideSections({ lenses }: { lenses: Product[] }) {
  const t = useDict(LG);
  const l = useL();
  const settings = useSettings();
  const posts = usePublishedPosts();
  const advice = useMemo(() => ADVICE_SLUGS.map((s) => posts.find((p) => p.slug === s)).filter((p): p is Post => !!p), [posts]);

  return (
    <>
      {/* 03 — lens types: the chooser's own bottom padding is the gap, on the same background */}
      <section className="below-fold pb-20 sm:pb-28">
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
      <section className="below-fold border-y border-line bg-white/50 py-20 sm:py-28">
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
      <section className="below-fold py-20 sm:py-28">
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
      <section id="receta" className="below-fold scroll-mt-24 border-y border-line bg-sand/40 py-20 sm:py-28">
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
      <section className="below-fold pt-20 sm:pt-28">
        <div className="container-x">
          <Reveal>
            <LabBlock />
          </Reveal>
        </div>
      </section>

      {/* Advice */}
      {advice.length > 0 && (
        <section className="below-fold pt-20 sm:pt-28">
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
      <section className="below-fold py-20 sm:py-28">
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
});

/** /lentet — lens guide: 3D simulator first, then chooser, lens types, coatings, index table, prescription explainer. */
export default function LensGuide() {
  const t = useDict(LG);
  const ts = useDict(SIM);
  const products = useActiveProducts();
  const lenses = useMemo(() => products.filter(isLensPackage), [products]);
  // Deep links: /lentet?per=screen&fuqia=mid pre-answers the chooser.
  const [params] = useSearchParams();
  const [use, setUse] = useState<LensUse | undefined>(() => asUse(params.get('per')));
  const [strength, setStrength] = useState<Strength | undefined>(() => asStrength(params.get('fuqia')));
  // the sliders up top set this as they are dragged: the chooser's answer doesn't hold them up
  const chooserStrength = useDeferredValue(strength);
  usePageTitle(t('title'));
  // the chooser sits below the simulator: a link that pre-answers it should land on it
  const toChooser = !!(params.get('per') || params.get('fuqia'));
  useEffect(() => {
    if (toChooser) scrollToId('zgjedhesi');
  }, [toChooser]);

  return (
    <>
      {/* 01 — the simulator opens the page: it is what people came to see, so the engine starts right away */}
      <section id="simulatori" className="scroll-mt-24 bg-ink pb-16 pt-6 text-paper sm:pb-20 sm:pt-8">
        <div className="container-x">
          <Breadcrumbs items={[{ label: t('title') }]} tone="light" />
          <h1 className="display mt-3 max-w-4xl text-[32px] leading-[1.06] text-white sm:text-[44px]">
            <Accent text={ts('title')} accentClassName="text-brand-200!" />
          </h1>
          <p className="mt-2.5 max-w-3xl text-[15px] leading-relaxed text-paper/75 sm:text-base">{ts('text')}</p>
          <LensSimulator strength={strength} onStrength={setStrength} lenses={lenses} />
          <div className="mt-8 flex flex-wrap items-center justify-between gap-x-8 gap-y-5 border-t border-white/10 pt-7">
            <ul className="flex flex-wrap gap-x-7 gap-y-3 text-[13.5px] font-medium text-paper/75">
              {FACTS.map(({ icon: Icon, key }) => (
                <li key={key} className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4 text-brand-200" /> {t(key)}
                </li>
              ))}
            </ul>
            <Button size="lg" variant="outlineLight" onClick={() => scrollToId('zgjedhesi')} iconRight={<ArrowDown className="h-4 w-4" />}>
              {t('heroCta')}
            </Button>
          </div>
        </div>
      </section>

      {/* 02 — chooser */}
      <section id="zgjedhesi" className="scroll-mt-24 pb-20 pt-16 sm:pb-28 sm:pt-24">
        <div className="container-x">
          <Reveal>
            <SectionHeading eyebrow={t('chooserEyebrow')} title={t('chooserTitle')} subtitle={t('chooserText')} />
          </Reveal>
          <div className="mt-10 sm:mt-12">
            <LensChooser use={use} strength={chooserStrength} onUse={setUse} onStrength={setStrength} lenses={lenses} />
          </div>
        </div>
      </section>

      <GuideSections lenses={lenses} />
    </>
  );
}
