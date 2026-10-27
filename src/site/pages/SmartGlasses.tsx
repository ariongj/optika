import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
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
/** The sections below the hero, in page order. */
const SECTIONS = 9;

/**
 * The hero and its live 3D render first. The other sections (all below the fold) join afterwards one per frame —
 * once the glasses have started fading in, or after 1.8 s at most — so neither building the 3D nor its fade-in waits
 * behind one big render of the whole page. A #section link or the visitor's first scroll / tap / key shows them all
 * at once.
 */
function useRestOfPage() {
  const [count, setCount] = useState(() => (typeof window !== 'undefined' && window.location.hash.length > 1 ? SECTIONS : 0));
  const [go, setGo] = useState(false);
  const all = useCallback(() => setCount(SECTIONS), []);
  const heroReady = useCallback(() => window.setTimeout(() => setGo(true), 450), []);
  useEffect(() => {
    if (count >= SECTIONS) return;
    const t = window.setTimeout(() => setGo(true), 1800);
    const events = ['scroll', 'wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
    events.forEach((e) => window.addEventListener(e, all, { passive: true, once: true }));
    // a click alone (screen readers activate buttons that way): capture runs before the button's own handler, so
    // a "scroll to the models" button finds its section
    window.addEventListener('click', all, { capture: true, once: true });
    return () => {
      window.clearTimeout(t);
      events.forEach((e) => window.removeEventListener(e, all));
      window.removeEventListener('click', all, { capture: true });
    };
  }, [count, all]);
  useEffect(() => {
    if (!go || count >= SECTIONS) return;
    const id = requestAnimationFrame(() => startTransition(() => setCount((c) => Math.min(SECTIONS, c + 1))));
    return () => cancelAnimationFrame(id);
  }, [go, count]);
  return { count, heroReady };
}

export default function SmartGlasses() {
  const t = useDict(SG);
  usePageTitle(t('pageTitle'));
  const { category, products } = useSmartProducts();
  const [pick, setPick] = useState('');
  const { count, heroReady } = useRestOfPage();
  const ask = useCallback((id: string) => {
    setPick(id);
    // after the form has re-rendered with the model preselected
    requestAnimationFrame(() => scrollToId('kerkesa'));
  }, []);

  // Sections out of view pause their endless decorative loops (glows, equaliser, pings, LEDs, the grid — smart.css):
  // a running CSS animation restyles its element every frame even off screen, which kept phones busy all scroll long.
  const page = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sections = [...(page.current?.children ?? [])];
    if (!sections.length || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.target.toggleAttribute('data-sg-off', !e.isIntersecting)),
      { rootMargin: '25% 0px' },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [count]);

  return (
    <div ref={page} className="sg-page bg-[#07090a] text-white">
      <SmartHero onReady={heroReady} />
      {[
        <SmartSpecs key="specs" />,
        <SmartStory key="story" />,
        <SmartCompare key="compare" products={products} />,
        <SmartModels key="models" products={products} categorySlug={category?.slug} onAsk={ask} />,
        <WhyOptician key="why" />,
        <PrivacyBlock key="privacy" />,
        <SmartFaq key="faq" />,
        <RequestSection key="request" products={products} pick={pick} onPick={setPick} />,
        <BrandStrip key="brands" />,
      ].slice(0, count)}
    </div>
  );
}
