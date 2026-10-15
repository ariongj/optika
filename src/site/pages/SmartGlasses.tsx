import { useCallback, useState } from 'react';
import { usePageTitle } from '@/site/layout/SiteLayout';
import { scrollToId } from '@/site/components/company/data';
import { SG } from '@/site/components/smart/dict';
import { useSmartProducts } from '@/site/components/smart/data';
import { SmartHero } from '@/site/components/smart/Hero';
import { SmartSpecs } from '@/site/components/smart/Specs';
import { SmartStory } from '@/site/components/smart/Story';
import { SmartCompare } from '@/site/components/smart/Compare';
import { BrandStrip, PrivacyBlock, RequestSection, SmartFaq, SmartModels, WhyOptician } from '@/site/components/smart/sections';
import { useDict } from '@/i18n';
import '@/site/components/smart/smart.css';

/**
 * /syze-inteligjente — smart glasses (Ray-Ban Meta, Oakley Meta, Meta Ray-Ban Display) as a dark, high-tech launch
 * page: real-time 3D hero with HUD callouts, spec bento, scroll-driven exploded view, the three kinds, the store's
 * models, why buy them at an optician, privacy, FAQ and an availability request — dark from top to bottom.
 * The site header and footer run in their dark mode on this route (SiteLayout).
 */
export default function SmartGlasses() {
  const t = useDict(SG);
  usePageTitle(t('pageTitle'));
  const { category, products } = useSmartProducts();
  const [pick, setPick] = useState('');
  const ask = useCallback((id: string) => {
    setPick(id);
    // after the form has re-rendered with the model preselected
    requestAnimationFrame(() => scrollToId('kerkesa'));
  }, []);

  return (
    <div className="sg-page bg-[#07090a] text-white">
      <SmartHero />
      <SmartSpecs />
      <SmartStory />
      <SmartCompare products={products} />
      <SmartModels products={products} categorySlug={category?.slug} onAsk={ask} />
      <WhyOptician />
      <PrivacyBlock />
      <SmartFaq />
      <RequestSection products={products} pick={pick} onPick={setPick} />
      <BrandStrip />
    </div>
  );
}
