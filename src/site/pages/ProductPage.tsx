import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowRight, PackageSearch } from 'lucide-react';
import type { Product } from '@/lib/types';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState, Img } from '@/components/ui/misc';
import { Modal } from '@/components/ui/Overlay';
import { Breadcrumbs } from '@/site/components/SectionHeading';
import { MeasureForm } from '@/site/components/MeasureForm';
import { usePageTitle } from '@/site/layout/SiteLayout';
import { useDict, useL, useLang } from '@/i18n';
import { useUi } from '@/store/ui';
import { useActiveProducts, useCategory, useProduct } from '@/store/hooks';
import { optionsLabel } from '@/lib/pricing';
import { money, num, unitLabel } from '@/lib/format';
import { PD, packWord } from '@/site/components/product/dict';
import { useConfigurator } from '@/site/components/product/useConfigurator';
import { Gallery } from '@/site/components/product/Gallery';
import { BuyBox } from '@/site/components/product/BuyBox';
import { DetailTabs } from '@/site/components/product/DetailTabs';
import { StickyBar } from '@/site/components/product/StickyBar';
import { openBooking } from '@/site/components/utility/Booking';
import { ProductRail } from '@/site/components/product/ProductRail';

export default function ProductPage() {
  const { slug } = useParams();
  const product = useProduct(slug);
  const t = useDict(PD);
  const visible = product && product.status === 'active' ? product : undefined;
  const l = useL();
  usePageTitle(visible ? l(visible.name) : t('notFoundTitle'));

  if (!visible) return <NotFoundProduct />;
  // key → options/quantity reset when navigating to another product
  return <ProductView key={visible.id} product={visible} />;
}

function NotFoundProduct() {
  const t = useDict(PD);
  return (
    <div className="container-x py-16 sm:py-24">
      <div className="mx-auto max-w-xl rounded-[32px] bg-white ring-1 ring-line">
        <EmptyState
          icon={<PackageSearch className="h-6 w-6" />}
          title={<span className="display text-[30px] font-normal">{t('notFoundTitle')}</span>}
          text={t('notFoundText')}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink to="/produktet" iconRight={<ArrowRight className="h-4 w-4" />}>
                {t('browse')}
              </ButtonLink>
              <ButtonLink to="/" variant="outline">
                {t('backHome')}
              </ButtonLink>
            </div>
          }
        />
      </div>
    </div>
  );
}

function ProductView({ product }: { product: Product }) {
  const t = useDict(PD);
  const l = useL();
  const lang = useLang();
  const category = useCategory(product.categoryId);
  const all = useActiveProducts();
  const recentIds = useUi((s) => s.recentlyViewed);
  const pushViewed = useUi((s) => s.pushViewed);
  const addToCart = useUi((s) => s.addToCart);
  const setCartOpen = useUi((s) => s.setCartOpen);
  const cfg = useConfigurator(product);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);
  const sticky = useStickyVisibility(ctaRef);

  // Remember the visit once per product (recentlyViewed shown below + on other pages)
  const [recentAtMount] = useState(recentIds);
  useEffect(() => {
    pushViewed(product.id);
  }, [product.id, pushViewed]);

  const related = useMemo(
    () => all.filter((p) => p.categoryId === product.categoryId && p.id !== product.id).sort((a, b) => Number(b.featured) - Number(a.featured) || b.sold - a.sold).slice(0, 10),
    [all, product.categoryId, product.id],
  );
  const recent = useMemo(
    () => recentAtMount.filter((id) => id !== product.id).map((id) => all.find((p) => p.id === id)).filter((p): p is Product => !!p).slice(0, 10),
    [recentAtMount, all, product.id],
  );

  const add = () => {
    addToCart({ productId: product.id, qty: cfg.qty, options: cfg.options, installation: cfg.installation });
    const qty =
      product.unit === 'm2' && product.packSize
        ? `${cfg.qty} ${packWord(cfg.qty, lang, t('pack_one'), t('pack_many'))} (${num(cfg.units, lang)} ${unitLabel('m2', lang)})`
        : `${num(cfg.qty, lang)} ${unitLabel(product.unit, lang)}`;
    toast.success(t('added'), {
      description: `${l(product.name)} · ${qty} · ${money(cfg.total, lang)}`,
      action: { label: t('viewCart'), onClick: () => setCartOpen(true) },
    });
    setCartOpen(true);
  };

  const opts = optionsLabel(product, cfg.options, lang);
  const quoteMessage = t('quoteMsg', { name: l(product.name), opts: opts ? ` (${opts})` : '' });

  return (
    <div>
      <div className="container-x pt-6 sm:pt-8">
        <Breadcrumbs items={[...(category ? [{ label: l(category.name), to: `/produktet/${category.slug}` }] : []), { label: l(product.name) }]} />

        <div className="mt-6 grid gap-8 sm:mt-8 lg:grid-cols-12 lg:gap-12 xl:gap-16">
          <div className="lg:col-span-7">
            <div className="lg:sticky lg:top-[100px]">
              <Gallery images={product.images} alt={l(product.name)} />
            </div>
          </div>
          <div className="lg:col-span-5">
            <BuyBox cfg={cfg} category={category} onAdd={add} onQuote={() => setQuoteOpen(true)} onBook={() => openBooking('exam')} ctaRef={ctaRef} />
          </div>
        </div>
      </div>

      <div className="container-x mt-20 sm:mt-28">
        <DetailTabs product={product} category={category} />
      </div>

      <ProductRail
        className="mt-24 sm:mt-32"
        eyebrow={t('relatedEyebrow')}
        title={t('relatedTitle')}
        products={related}
        action={
          category && (
            <ButtonLink to={`/produktet/${category.slug}`} variant="outline" size="sm" iconRight={<ArrowRight className="h-4 w-4" />} className="hidden sm:inline-flex">
              {t('seeCategory')}
            </ButtonLink>
          )
        }
      />
      <ProductRail className="mt-20 sm:mt-28" eyebrow={t('recentEyebrow')} title={t('recentTitle')} products={recent} />

      <StickyBar cfg={cfg} visible={sticky} onAdd={add} onQuote={() => setQuoteOpen(true)} />

      <Modal open={quoteOpen} onClose={() => setQuoteOpen(false)} title={t('quoteTitle')} description={t('quoteText')} size="lg">
        <div className="p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-3 rounded-2xl bg-sand/60 p-3">
            <Img src={product.images[0]} small alt="" className="h-14 w-14 rounded-xl object-cover" />
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold text-ink">{l(product.name)}</div>
              <div className="truncate text-[12.5px] text-muted">{opts || `${t('sku')}: ${product.sku}`}</div>
            </div>
          </div>
          <MeasureForm type="quote" productId={product.id} defaultMessage={quoteMessage} className="p-0! ring-0! sm:p-0!" />
        </div>
      </Modal>
    </div>
  );
}

/**
 * Sticky bar visibility: on phones whenever the main CTA is off-screen,
 * on desktop only once the shopper has scrolled past it. Hidden while the
 * site footer is on screen so it never covers it.
 */
function useStickyVisibility(ref: RefObject<HTMLDivElement | null>) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const footer = document.querySelector('footer');
    let cta: IntersectionObserverEntry | null = null;
    let footerVisible = false;
    const apply = () => {
      if (!cta) return;
      const off = !cta.isIntersecting && (!mq.matches || cta.boundingClientRect.top < 0);
      setShow(off && !footerVisible);
    };
    // the sticky header (76px) hides whatever scrolls under it
    const io = new IntersectionObserver(
      ([e]) => {
        cta = e;
        apply();
      },
      { rootMargin: '-76px 0px 0px 0px' },
    );
    const fo = new IntersectionObserver(([e]) => {
      footerVisible = e.isIntersecting;
      apply();
    });
    io.observe(el);
    if (footer) fo.observe(footer);
    mq.addEventListener('change', apply);
    return () => {
      io.disconnect();
      fo.disconnect();
      mq.removeEventListener('change', apply);
    };
  }, [ref]);
  return show;
}
