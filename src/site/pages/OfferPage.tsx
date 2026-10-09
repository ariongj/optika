// /oferta/:slug — landing page of an ACTIVE offer (offers centre, PDF pp.28–29): hero with countdown, "how it works"
// (code to copy / applied automatically / editorial), participating products, other live offers, help band.
// Draft, paused, scheduled, expired or unknown → friendly "offer ended" page. `?preview=1` lets a signed-in CMS user
// see a non-live offer (offer editor device preview), with a notice.
import { useParams } from 'react-router';
import { ArrowRight, Eye, Info } from 'lucide-react';
import { ProductCard } from '@/site/components/ProductCard';
import { SectionHeading } from '@/site/components/SectionHeading';
import { HelpBand } from '@/site/components/shop/HelpBand';
import { usePageTitle } from '@/site/layout/SiteLayout';
import { ButtonLink } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/misc';
import { useL, useLang } from '@/i18n';
import { OfferHero } from '@/site/components/offers/OfferHero';
import { HowItWorks } from '@/site/components/offers/HowItWorks';
import { OfferEnded } from '@/site/components/offers/OfferEnded';
import { OfferCard } from '@/site/components/offers/parts';
import { bumpOfferMetric, useCountVisit, useOfferLanding, valueText } from '@/site/components/offers/model';
import { useOT, type OTKey } from '@/site/components/offers/i18n';

const SHOWN = 8;

export default function OfferPage() {
  const { slug } = useParams();
  const t = useOT();
  const l = useL();
  const lang = useLang();
  const data = useOfferLanding(slug);
  const { offer, state, preview, visible, discount, products, scope, others, collectionSlug } = data;

  usePageTitle(visible && offer ? l(offer.name) : t('ended_page'));
  useCountVisit(offer, state === 'active');

  if (!offer || !visible) return <OfferEnded slug={slug} offer={offer} state={state} others={others} />;

  const value = valueText(discount, lang, { free: t('v_free'), bxgy: t('v_bxgy') });
  const cta = () => !preview && bumpOfferMetric(offer.id, 'ctaClicks');
  const shown = products.slice(0, SHOWN);
  const n = products.length;
  const count = t((lang === 'me' ? n % 10 === 1 && n % 100 !== 11 : n === 1) ? 'prod_one' : 'prod_many', { n });
  const viewAllTo = collectionSlug ? `/koleksioni/${collectionSlug}` : scope === 'all' ? '/produktet' : '/produktet?akcija=1';
  const titleKey: OTKey = scope === 'all' ? 'prod_title_all' : scope === 'collection' ? 'prod_title_ed' : 'prod_title';

  return (
    <>
      {preview && state && (
        <div className="border-b border-ink/10 bg-ink text-paper">
          <div className="container-x flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[13px]">
            <span className="inline-flex items-center gap-2 font-bold">
              <Eye className="h-4 w-4 text-brand-200" />
              {t('preview')}
            </span>
            <span className="text-paper/70">{t('previewText', { state: t(`st_${state}` as OTKey) })}</span>
          </div>
        </div>
      )}

      <OfferHero offer={offer} discount={discount} value={value} onCta={cta} />
      <HowItWorks offer={offer} discount={discount} value={value} wholeRange={scope === 'all'} />

      {/* Participating products */}
      <section id="produktet" className="scroll-mt-24 py-20 sm:py-24">
        <div className="container-x">
          <Reveal>
            <SectionHeading
              eyebrow={t('prod_eyebrow')}
              title={t(titleKey)}
              subtitle={scope === 'all' ? t('prod_sub_all') : count}
              action={
                <ButtonLink to={viewAllTo} variant="outline" iconRight={<ArrowRight className="h-4 w-4" />} onClick={cta}>
                  {products.length > SHOWN ? t('viewAll', { n: products.length }) : collectionSlug ? t('e1_t') : t('allProducts')}
                </ButtonLink>
              }
            />
          </Reveal>
          {discount && (
            <p className="mt-6 inline-flex max-w-full items-start gap-2 rounded-2xl bg-white px-4 py-2.5 text-[13.5px] leading-snug text-muted ring-1 ring-line sm:items-center sm:rounded-full">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 sm:mt-0" />
              {t('priceNote')}
            </p>
          )}
          <div className="mt-8 grid grid-cols-2 gap-x-3.5 gap-y-9 sm:gap-x-5 md:grid-cols-3 lg:gap-x-6 lg:gap-y-12 xl:grid-cols-4">
            {shown.map((p, i) => (
              <div key={p.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 7) * 45}ms` }}>
                <ProductCard product={p} priority={i < 4} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Other live offers */}
      {others.length > 0 && (
        <section className="container-x">
          <Reveal>
            <SectionHeading eyebrow={t('more_eyebrow')} title={t('more_title')} />
          </Reveal>
          <div className={others.length === 1 ? 'mt-10' : 'mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3'}>
            {others.map((o, i) => (
              <Reveal key={o.id} delay={i * 90}>
                <OfferCard offer={o} wide={others.length === 1} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <HelpBand />
    </>
  );
}
