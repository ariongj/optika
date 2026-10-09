import { useMemo } from 'react';
import { toast } from 'sonner';
import { ArrowRight, CalendarCheck, Heart, Phone, ScanFace, Trash2 } from 'lucide-react';
import { Accent } from '@/components/ui/misc';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Breadcrumbs } from '@/site/components/SectionHeading';
import { openBooking } from '@/site/components/utility/Booking';
import { usePageTitle } from '@/site/layout/SiteLayout';
import { ProductGrid } from '@/site/components/utility/ProductGrid';
import { CtaBand } from '@/site/components/utility/CtaBand';
import { diverseBestsellers, pluralOne } from '@/site/components/utility/shared';
import { defineDict, useDict, useLang } from '@/i18n';
import { useUi } from '@/store/ui';
import { useActiveProducts, useSettings } from '@/store/hooks';
import type { Product } from '@/lib/types';

const T = defineDict({
  me: {
    pageTitle: 'Lista želja',
    eyebrow: 'Sačuvano za kasnije',
    title: 'Lista *želja*',
    subtitle: 'Proizvodi koje ste označili srcem čekaju vas ovdje — uporedite ih na miru i vratite im se kada budete spremni.',
    productOne: '{n} proizvod',
    productMany: '{n} proizvoda',
    clearAll: 'Obriši sve',
    cleared: 'Lista želja je obrisana',
    undo: 'Poništi',
    continue: 'Nastavite kupovinu',
    emptyTitle: 'Vaša lista želja je *prazna*',
    emptyText: 'Kliknite na srce na bilo kojem proizvodu i sačuvajte ga ovdje — tako ćete lako uporediti opcije prije kupovine.',
    emptyCta: 'Pogledajte proizvode',
    inspiration: 'Možda će vam se *dopasti*',
    helpEyebrow: 'Pregled vida',
    helpTitle: 'Isprobajte ih *uživo* — u optici.',
    helpText: 'Ne možete da se odlučite? Probajte sačuvane okvire virtuelno ili svratite u optiku — pregledaćemo vid, izmeriti PD i prilagoditi okvir vašem licu.',
    helpCta: 'Zakažite pregled',
    helpTryOn: 'Probaj virtuelno',
  },
  sq: {
    pageTitle: 'Të preferuarat',
    eyebrow: 'Ruajtur për më vonë',
    title: 'Të *preferuarat*',
    subtitle: 'Produktet që i keni shënuar me zemër ju presin këtu — krahasojini me qetësi dhe kthehuni kur të jeni gati.',
    productOne: '{n} produkt',
    productMany: '{n} produkte',
    clearAll: 'Fshiji të gjitha',
    cleared: 'Lista e të preferuarave u pastrua',
    undo: 'Anulo',
    continue: 'Vazhdoni blerjen',
    emptyTitle: 'Lista juaj është *bosh*',
    emptyText: 'Klikoni zemrën në çdo produkt për ta ruajtur këtu — kështu i krahasoni lehtë opsionet para blerjes.',
    emptyCta: 'Shikoni produktet',
    inspiration: 'Mund t’ju *pëlqejnë*',
    helpEyebrow: 'Kontroll i syve',
    helpTitle: 'Provojini *drejtpërdrejt* — në optikë.',
    helpText: 'Nuk po vendosni dot? Provoni kornizat e ruajtura virtualisht ose kaloni në optikë — ua kontrollojmë shikimin, masim PD-në dhe e përshtatim kornizën me fytyrën tuaj.',
    helpCta: 'Rezervo kontrollin',
    helpTryOn: 'Provo virtualisht',
  },
  en: {
    pageTitle: 'Wishlist',
    eyebrow: 'Saved for later',
    title: 'Your *wishlist*',
    subtitle: 'Everything you’ve hearted waits here — compare at your own pace and come back when you’re ready.',
    productOne: '{n} product',
    productMany: '{n} products',
    clearAll: 'Clear all',
    cleared: 'Wishlist cleared',
    undo: 'Undo',
    continue: 'Continue shopping',
    emptyTitle: 'Your wishlist is *empty*',
    emptyText: 'Tap the heart on any product to save it here — it makes comparing options before you buy easy.',
    emptyCta: 'Browse products',
    inspiration: 'You might *like*',
    helpEyebrow: 'Eye exam',
    helpTitle: 'Try them on *in person* — at the store.',
    helpText: 'Can’t decide? Try your saved frames on virtually or drop by the store — we’ll check your vision, measure your PD and fit the frame to your face.',
    helpCta: 'Book an eye exam',
    helpTryOn: 'Try on virtually',
  },
});

export default function Wishlist() {
  const t = useDict(T);
  const lang = useLang();
  const settings = useSettings();
  const wishlist = useUi((s) => s.wishlist);
  const products = useActiveProducts();
  usePageTitle(t('pageTitle'));

  // Most recently saved first; ignore products that were unpublished or deleted in the CMS
  const items = useMemo(
    () => [...wishlist].reverse().map((id) => products.find((p) => p.id === id)).filter((p): p is Product => !!p),
    [wishlist, products],
  );
  const suggestions = useMemo(
    () => diverseBestsellers(products.filter((p) => !wishlist.includes(p.id)), 4),
    [products, wishlist],
  );

  const clearAll = () => {
    const prev = useUi.getState().wishlist;
    useUi.setState({ wishlist: [] });
    toast(t('cleared'), { action: { label: t('undo'), onClick: () => useUi.setState({ wishlist: prev }) } });
  };

  const empty = items.length === 0;
  const tel = `tel:${settings.phone.replace(/[^+\d]/g, '')}`;

  return (
    <>
      <section className="border-b border-line bg-paper">
        <div className="container-x pb-10 pt-8 sm:pb-14 sm:pt-12">
          <Breadcrumbs items={[{ label: t('pageTitle') }]} />
          <div className="mt-8 flex flex-col gap-6 sm:mt-10 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <div className="eyebrow mb-3">{t('eyebrow')}</div>
              <h1 className="display flex flex-wrap items-baseline gap-x-4 gap-y-2 text-[40px] leading-[1.04] text-ink sm:text-[56px]">
                <Accent text={t('title')} />
                {!empty && (
                  <span className="translate-y-[-0.35em] rounded-full bg-brand-600 px-3 py-1 font-sans text-[13px] font-bold tracking-normal text-white sm:text-[14px]">
                    {t(pluralOne(items.length, lang) ? 'productOne' : 'productMany', { n: items.length })}
                  </span>
                )}
              </h1>
              <p className="mt-4 text-[16.5px] leading-relaxed text-muted">{t('subtitle')}</p>
            </div>
            {!empty && (
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button variant="ghost" onClick={clearAll} icon={<Trash2 className="h-4 w-4" />} className="text-ink-soft hover:text-brand-700 max-md:-ml-4">
                  {t('clearAll')}
                </Button>
                <ButtonLink to="/produktet" variant="outline" iconRight={<ArrowRight className="h-4 w-4" />}>
                  {t('continue')}
                </ButtonLink>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="container-x pt-12 sm:pt-16">
        {empty ? (
          <div className="mx-auto flex max-w-xl animate-fade-up flex-col items-center py-6 text-center sm:py-10">
            <span className="relative grid h-24 w-24 place-items-center">
              <span className="absolute inset-0 rounded-full bg-brand-100/70" />
              <span className="absolute inset-3 rounded-full bg-brand-50 ring-1 ring-brand-200/70" />
              <Heart className="relative h-9 w-9 text-brand-600" strokeWidth={1.6} />
            </span>
            <h2 className="display mt-7 text-[34px] leading-[1.06] text-ink sm:text-[44px]">
              <Accent text={t('emptyTitle')} />
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-muted">{t('emptyText')}</p>
            <ButtonLink to="/produktet" size="lg" className="mt-8" iconRight={<ArrowRight className="h-4 w-4" />}>
              {t('emptyCta')}
            </ButtonLink>
          </div>
        ) : (
          <ProductGrid products={items} layout />
        )}

        {empty && suggestions.length > 0 && (
          <section className="mt-16 border-t border-line pt-14 sm:mt-20 sm:pt-16">
            <h2 className="display mb-8 text-[30px] leading-[1.05] text-ink sm:text-[40px]">
              <Accent text={t('inspiration')} />
            </h2>
            <ProductGrid products={suggestions} />
          </section>
        )}

        <CtaBand
          className="mt-16 sm:mt-24"
          image="/images/lookbook/editorial.webp"
          eyebrow={t('helpEyebrow')}
          title={t('helpTitle')}
          text={t('helpText')}
          actions={
            <>
              <Button variant="light" size="lg" icon={<CalendarCheck className="h-4 w-4" />} onClick={() => openBooking('exam')}>
                {t('helpCta')}
              </Button>
              <ButtonLink to="/provo-virtualisht" variant="outlineLight" size="lg" icon={<ScanFace className="h-4 w-4" />}>
                {t('helpTryOn')}
              </ButtonLink>
              <a href={tel} className="inline-flex h-13 items-center justify-center gap-2.5 rounded-full px-4 text-[15px] font-semibold text-white/85 transition-colors hover:text-white">
                <Phone className="h-4 w-4" /> {settings.phone}
              </a>
            </>
          }
        />
      </div>
    </>
  );
}
