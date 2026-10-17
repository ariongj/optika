import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { LayoutDashboard } from 'lucide-react';
import { Header } from './Header';
import { Footer } from './Footer';
import { BOOK_ID, openBooking, useBooking } from '@/site/components/utility/Booking';
import { listenForLinkIntent, prefetchLikelyPages } from '@/site/pages/lazy';
import { flushLeadOutbox } from '@/lib/leads';
import { useUi } from '@/store/ui';
import { useDict, LANGS, useLang } from '@/i18n';
import { site } from '@/i18n/site';
import { useSettings } from '@/store/hooks';
import { useDb } from '@/store/db';

// Overlays are loaded the first time they open, then stay mounted (so their exit animations still run).
const CartDrawer = lazy(() => import('./CartDrawer').then((m) => ({ default: m.CartDrawer })));
const SearchOverlay = lazy(() => import('./SearchOverlay').then((m) => ({ default: m.SearchOverlay })));
const BookingModal = lazy(() => import('@/site/components/utility/BookingModal'));

/** True from the first time `open` is true. */
function useOpenedOnce(open: boolean) {
  const [once, setOnce] = useState(open);
  useEffect(() => {
    if (open) setOnce(true);
  }, [open]);
  return once || open;
}

/**
 * Shown while a page chunk downloads. At least a full screen tall, so the footer starts below the fold and doesn't
 * visibly jump when the page arrives (that jump was the only layout shift Lighthouse measured on desktop pages).
 */
function PageLoading() {
  return (
    <div className="grid min-h-[100svh] place-items-center" aria-busy="true">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-brand-600" />
    </div>
  );
}

function DemoBadge() {
  const t = useDict(site);
  const settings = useSettings();
  // The try-on stage fills the phone screen (status pill bottom-left) and the smart-glasses story pins its text
  // cards to the bottom-left — keep the badge out of their way on phones.
  const { pathname } = useLocation();
  const tryOn = pathname.startsWith('/provo-virtualisht') || pathname.startsWith('/syze-inteligjente');
  if (!settings.demoBanner) return null;
  return (
    <Link
      to="/admin"
      aria-label={`${t('demoBanner')} ${t('demoBannerCta')}`}
      className={`group fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-3 z-30 ${tryOn ? 'hidden lg:flex' : 'flex'} items-center gap-2.5 rounded-full bg-ink/90 p-1.5 text-[12px] font-semibold text-paper shadow-xl ring-1 ring-white/10 backdrop-blur transition-all hover:bg-ink sm:left-4 sm:pr-4`}
    >
      <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-600 sm:h-7 sm:w-7">
        <LayoutDashboard className="h-3.5 w-3.5" />
      </span>
      <span className="hidden sm:inline">{t('demoBanner')}</span>
      <span className="hidden text-brand-200 group-hover:text-white sm:inline">{t('demoBannerCta')} →</span>
    </Link>
  );
}

export function SiteLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const lang = useLang();
  const isHome = location.pathname === '/';
  // the smart-glasses launch page is dark from the top: transparent header over its hero, dark glass once scrolled
  // (GitHub Pages serves the prerendered shell with a trailing slash)
  const darkPage = /^\/syze-inteligjente\/?$/.test(location.pathname);
  const heroFirst = useDb((s) => s.home.find((h) => h.enabled)?.type === 'hero');
  const cartOpened = useOpenedOnce(useUi((s) => s.cartOpen));
  const searchOpened = useOpenedOnce(useUi((s) => s.searchOpen));
  const bookingOpened = useOpenedOnce(useBooking((s) => s.open));

  useEffect(() => listenForLinkIntent(), []);
  // leads that could not be e-mailed (offline submit) go out on the next visit
  useEffect(() => flushLeadOutbox(), []);
  useEffect(() => prefetchLikelyPages(), []);

  useEffect(() => {
    document.documentElement.lang = LANGS.find((l) => l.code === lang)?.htmlLang ?? 'sq';
  }, [lang]);

  // In-page anchors after navigation (/#rezervo, /sherbimet#lab…): smooth-scroll to the target. The booking
  // anchor opens the booking modal when the page has no inline booking form (e.g. the homepage CTA block is off).
  useEffect(() => {
    if (!location.hash) return;
    const id = decodeURIComponent(location.hash.slice(1));
    const t = setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else if (id === BOOK_ID) {
        openBooking();
        navigate({ pathname: location.pathname, search: location.search }, { replace: true, preventScrollReset: true });
      }
    }, 80);
    return () => clearTimeout(t);
  }, [location.pathname, location.search, location.hash, location.key, navigate]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header transparentTop={(isHome && heroFirst) || darkPage} dark={darkPage} />
      <main className={darkPage ? 'flex-1 bg-[#07090a]' : 'flex-1'}>
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer dark={darkPage} />
      <Suspense fallback={null}>
        {cartOpened && <CartDrawer />}
        {searchOpened && <SearchOverlay />}
        {bookingOpened && <BookingModal />}
      </Suspense>
      <DemoBadge />
    </div>
  );
}

/** Page title helper for storefront pages. */
export function usePageTitle(title: string | undefined) {
  const settings = useSettings();
  useEffect(() => {
    document.title = title ? `${title} — ${settings.companyName}` : settings.seo.title;
  }, [title, settings.companyName, settings.seo.title]);
}
