import { useMemo } from 'react';
import { ArrowDown, BatteryMedium, CalendarCheck, Camera, Store } from 'lucide-react';
import { Accent } from '@/components/ui/misc';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Breadcrumbs } from '@/site/components/SectionHeading';
import { scrollToId } from '@/site/components/company/data';
import { usePageTitle } from '@/site/layout/SiteLayout';
import { AnnotatedGlasses } from '@/site/components/smart/AnnotatedGlasses';
import { BOOK_SMART, BrandStrip, CanDo, Models, PrivacyBlock, RequestSection, SmartFaq, TypesCompare, WhyOptician } from '@/site/components/smart/sections';
import { SG } from '@/site/components/smart/dict';
import { useDict } from '@/i18n';
import { useActiveProducts, useCategories } from '@/store/hooks';

/** The storefront category that holds the smart glasses (by id, with a slug fallback for CMS-made copies). */
const SMART_CATEGORY = 'cat-smart';

/**
 * /syze-inteligjente — smart glasses (Ray-Ban Meta, Oakley Meta, Meta Ray-Ban Display): what they do, the three kinds,
 * the models from the store, why buy them at an optician, privacy, FAQ and an availability request.
 */
export default function SmartGlasses() {
  const t = useDict(SG);
  usePageTitle(t('pageTitle'));
  const categories = useCategories();
  const all = useActiveProducts();
  const category = categories.find((c) => c.id === SMART_CATEGORY) ?? categories.find((c) => c.slug === 'syze-inteligjente');
  const products = useMemo(
    () => (category ? all.filter((p) => p.categoryId === category.id) : []).sort((a, b) => Number(b.featured) - Number(a.featured)),
    [all, category],
  );
  const facts = [
    { icon: Camera, text: t('fact1') },
    { icon: BatteryMedium, text: t('fact2') },
    { icon: Store, text: t('fact3') },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line bg-paper">
        <div className="bg-grain pointer-events-none absolute inset-0 opacity-70" />
        <div className="container-x relative grid items-center gap-10 pb-14 pt-7 sm:pb-20 sm:pt-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)] lg:gap-14 xl:gap-20">
          <div className="min-w-0 animate-fade-up">
            <Breadcrumbs items={[{ label: t('crumb') }]} />
            <div className="eyebrow mb-3 mt-8 sm:mt-12">{t('eyebrow')}</div>
            <h1 className="display max-w-xl text-[42px] leading-[1.02] text-ink sm:text-[60px] xl:text-[68px]">
              <Accent text={t('title')} />
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-soft sm:text-[17.5px]">{t('text')}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={() => scrollToId('modelet')} iconRight={<ArrowDown className="h-4 w-4" />} className="max-sm:w-full">
                {t('ctaModels')}
              </Button>
              <ButtonLink to={BOOK_SMART} size="lg" variant="outline" icon={<CalendarCheck className="h-4 w-4" />} className="max-sm:w-full">
                {t('ctaBook')}
              </ButtonLink>
            </div>
            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-[13.5px] font-medium text-ink-soft">
              {facts.map(({ icon: Icon, text }) => (
                <li key={text} className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4 text-brand-600" /> {text}
                </li>
              ))}
            </ul>
          </div>
          <AnnotatedGlasses className="animate-fade-up [animation-delay:120ms]" />
        </div>
      </section>

      <CanDo />
      <TypesCompare products={products} />
      <Models products={products} categorySlug={category?.slug} />
      <WhyOptician />
      <PrivacyBlock />
      <SmartFaq />
      <RequestSection products={products} />
      <BrandStrip />
    </>
  );
}
