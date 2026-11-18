import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { scrollToSection } from '@/lib/utils';
import { Construction, LayoutDashboard, MessageCircle, Phone } from 'lucide-react';
import { readTheme } from '@/admin/components/store/theme';
import { Logo } from '@/components/brand/Logo';
import { waDigits } from '@/lib/format';
import { Header } from './Header';
import { Footer } from './Footer';
import { BOOK_ID, openBooking, useBooking } from '@/site/components/utility/Booking';
import { listenForLinkIntent, prefetchLikelyPages } from '@/site/pages/lazy';
import { flushLeadOutbox } from '@/lib/leads';
import { useUi } from '@/store/ui';
import { useDict, LANGS, lt, useLang } from '@/i18n';
import type { Lang } from '@/lib/types';
import { site } from '@/i18n/site';
import { useSettings, useTidyCart } from '@/store/hooks';
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
    <div data-page-loading className="late-in grid min-h-[100svh] place-items-center" aria-busy="true">
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
  // The lens simulator opens on its stage and scene photos: only the icon there, where it clears them, and the words on hover or focus.
  // The PD measurement has its buttons along the bottom of its stage: the same there.
  const compact = pathname.startsWith('/lentet') || pathname.startsWith('/matja-pd');
  if (!settings.demoBanner) return null;
  return (
    <Link
      to="/admin"
      aria-label={`${t('demoBanner')} ${t('demoBannerCta')}`}
      className={`group fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-3 z-30 ${compact ? 'hidden min-[1400px]:flex' : tryOn ? 'hidden lg:flex' : 'flex'} items-center gap-2.5 rounded-full bg-ink/90 p-1.5 text-[12px] font-semibold text-paper shadow-xl ring-1 ring-white/10 backdrop-blur transition-all hover:bg-ink sm:left-4 sm:pr-4`}
    >
      <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-600 sm:h-7 sm:w-7">
        <LayoutDashboard className="h-3.5 w-3.5" />
      </span>
      <span className={compact ? 'hidden group-hover:inline group-focus-visible:inline' : 'hidden sm:inline'}>{t('demoBanner')}</span>
      <span className={`hidden text-brand-200 group-hover:text-white ${compact ? 'group-hover:inline group-focus-visible:inline' : 'sm:inline'}`}>{t('demoBannerCta')} →</span>
    </Link>
  );
}

/** What visitors see while the CMS has maintenance mode on (Online Store → Theme). */
function MaintenancePage() {
  const t = useDict(site);
  const lang = useLang();
  const settings = useSettings();
  const message = lt(readTheme(settings).maintenance.message, lang);
  const wa = waDigits(settings.whatsapp);
  useEffect(() => {
    document.title = `${t('maintTitle')} — ${settings.companyName}`;
  }, [t, settings.companyName]);
  return (
    <main className="grid min-h-[100svh] place-items-center bg-paper px-5 py-16 text-center">
      <div className="max-w-[460px]">
        <Logo className="mx-auto h-11 w-auto" />
        <span className="mx-auto mt-10 grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-amber-800">
          <Construction className="h-5 w-5" />
        </span>
        <h1 className="mt-5 font-display text-[clamp(28px,6vw,40px)] font-semibold leading-tight text-ink">{t('maintTitle')}</h1>
        {message && <p className="mt-3 text-[15.5px] leading-relaxed text-ink-soft">{message}</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {settings.phone && (
            <a href={`tel:${settings.phone.replace(/\s+/g, '')}`} className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[14px] font-semibold text-paper transition hover:bg-ink/85">
              <Phone className="h-4 w-4" /> {t('maintCall')} {settings.phone}
            </a>
          )}
          {wa && (
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full border border-ink/15 bg-white px-5 text-[14px] font-semibold text-ink transition hover:border-ink/35">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          )}
        </div>
      </div>
    </main>
  );
}

/** Signed-in staff still see the site while maintenance is on — with this reminder that visitors don't. */
function MaintenanceNotice() {
  const t = useDict(site);
  return (
    <div role="status" className="fixed inset-x-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-[60] mx-auto flex max-w-[560px] items-center gap-2.5 rounded-2xl bg-amber-100 px-4 py-2.5 text-[12.5px] font-semibold leading-snug text-amber-950 shadow-lg ring-1 ring-amber-900/15">
      <Construction className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">{t('maintAdmin')}</span>
      <Link to="/admin/prodavnica" className="link-u shrink-0 underline underline-offset-2">
        {t('maintAdminCta')}
      </Link>
    </div>
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
  useTidyCart();
  const settings = useSettings();
  const authed = useUi((s) => s.adminAuthed);
  const maintenance = readTheme(settings).maintenance.on;

  useEffect(() => listenForLinkIntent(), []);
  // leads that could not be e-mailed (offline submit) go out on the next visit
  useEffect(() => flushLeadOutbox(), []);
  useEffect(() => prefetchLikelyPages(), []);

  useEffect(() => {
    document.documentElement.lang = LANGS.find((l) => l.code === lang)?.htmlLang ?? 'sq';
  }, [lang]);

  // Settings → Languages: a first visit starts in the shop's default language, and a language switched off there
  // moves its visitors to the default one (the switcher no longer lists it, so they could not leave it themselves).
  // Signed-in staff are left alone: the CMS preview opens the site in any language, switched on or not.
  const langChosen = useUi((s) => s.langChosen);
  const langDefault = (settings as typeof settings & { ext?: { langDefault?: Lang } }).ext?.langDefault ?? 'sq';
  useEffect(() => {
    if (authed) return;
    const on = settings.languages;
    const fallback: Lang = on[langDefault] ? langDefault : (LANGS.find((x) => on[x.code])?.code ?? 'sq');
    if (!on[lang] || (!langChosen && lang !== fallback)) useUi.setState({ lang: fallback });
  }, [authed, lang, langChosen, langDefault, settings.languages]);

  // In-page anchors after navigation (/#rezervo, /sherbimet#lab…): smooth-scroll to the target. Pages are lazy, so on a
  // first visit the target only exists once the page's code has arrived: keep looking until then, plus a moment for a
  // page that streams its sections in. The booking anchor opens the booking modal when the page has no inline booking
  // form (e.g. the homepage CTA block is off).
  useEffect(() => {
    if (!location.hash) return;
    // a hand-typed or mangled link ("#100%") must not crash the page
    let id = location.hash.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch {
      /* keep it as typed */
    }
    let t = 0;
    let waited = 0;
    let grace = 6;
    const look = () => {
      const el = document.getElementById(id);
      if (el) {
        scrollToSection(el);
        return;
      }
      const pageLoading = document.querySelector('[data-page-loading]') !== null;
      if (pageLoading ? waited++ < 150 : grace-- > 0) {
        t = window.setTimeout(look, 100);
        return;
      }
      if (id === BOOK_ID) {
        openBooking();
        navigate({ pathname: location.pathname, search: location.search }, { replace: true, preventScrollReset: true });
      }
    };
    t = window.setTimeout(look, 80);
    return () => clearTimeout(t);
  }, [location.pathname, location.search, location.hash, location.key, navigate]);

  // maintenance mode (CMS → Online Store → Theme): visitors get the notice page, signed-in staff keep the site
  if (maintenance && !authed) return <MaintenancePage />;

  return (
    <div className="flex min-h-screen flex-col">
      {maintenance && <MaintenanceNotice />}
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
