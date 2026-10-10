import { lazy, Suspense, useEffect, useLayoutEffect, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet, RouterProvider, ScrollRestoration, useLocation, type RouteObject } from 'react-router';
import { BASENAME } from '@/lib/paths';
import { Toaster, toast } from 'sonner';
import { SiteLayout } from '@/site/layout/SiteLayout';
import { useDb } from '@/store/db';
import { useUi } from '@/store/ui';
import { applyBrand, setAdminTheme } from '@/lib/color';
import { startCrossTabSync } from '@/store/sync';
import { defineDict } from '@/i18n';
import { RequirePerm } from '@/admin/layout/RequirePerm';
import type { Action, Module } from '@/lib/permissions';

// Storefront pages: Home ships in the entry bundle; every other page is its own chunk, prefetched on link intent
// and when idle (see site/pages/lazy.ts), so first load stays small on phones and navigation still feels instant.
import Home from '@/site/pages/Home';
import { Pages as StorePages } from '@/site/pages/lazy';
const {
  shop: Shop, product: ProductPage, cart: CartPage, checkout: Checkout, orderSuccess: OrderSuccess, services: Services, projects: Projects,
  about: About, contact: Contact, blog: Blog, post: PostPage, cmsPage: CmsPageView, search: SearchPage, wishlist: Wishlist,
  collection: CollectionPage, offer: OfferPage, notFound: NotFound, clinic: Clinic, lab: OpticalLab, lensGuide: LensGuide,
  frameFinder: FrameFinder, booking: BookingPage, tracking: OrderTracking, tryOn: TryOn,
} = StorePages;

// CMS (lazy — separate bundle)
const AdminLayout = lazy(() => import('@/admin/layout/AdminLayout'));
const Login = lazy(() => import('@/admin/pages/Login'));
const Invoice = lazy(() => import('@/admin/pages/Invoice'));
// Overview, orders
const Dashboard = lazy(() => import('@/admin/pages/Dashboard'));
const Orders = lazy(() => import('@/admin/pages/Orders'));
const OrderDetail = lazy(() => import('@/admin/pages/OrderDetail'));
const DraftOrders = lazy(() => import('@/admin/pages/DraftOrders'));
const DraftOrderEdit = lazy(() => import('@/admin/pages/DraftOrderEdit'));
const Returns = lazy(() => import('@/admin/pages/Returns'));
// Products
const Products = lazy(() => import('@/admin/pages/Products'));
const ProductEdit = lazy(() => import('@/admin/pages/ProductEdit'));
const Collections = lazy(() => import('@/admin/pages/Collections'));
const CollectionEdit = lazy(() => import('@/admin/pages/CollectionEdit'));
const Categories = lazy(() => import('@/admin/pages/Categories'));
const Inventory = lazy(() => import('@/admin/pages/Inventory'));
const PurchaseOrders = lazy(() => import('@/admin/pages/PurchaseOrders'));
// Customers, growth, discounts
const Customers = lazy(() => import('@/admin/pages/Customers'));
const Segments = lazy(() => import('@/admin/pages/Segments'));
const Offers = lazy(() => import('@/admin/pages/Offers'));
const OfferEdit = lazy(() => import('@/admin/pages/OfferEdit'));
const Discounts = lazy(() => import('@/admin/pages/Discounts'));
const DiscountEdit = lazy(() => import('@/admin/pages/DiscountEdit'));
// Content
const Pages = lazy(() => import('@/admin/pages/Pages'));
const PageEdit = lazy(() => import('@/admin/pages/PageEdit'));
const Posts = lazy(() => import('@/admin/pages/Posts'));
const PostEdit = lazy(() => import('@/admin/pages/PostEdit'));
const ProjectsAdmin = lazy(() => import('@/admin/pages/ProjectsAdmin'));
const Menus = lazy(() => import('@/admin/pages/Menus'));
const ContentModels = lazy(() => import('@/admin/pages/ContentModels'));
const Media = lazy(() => import('@/admin/pages/Media'));
// Markets, analytics, contacts, appointments
const Markets = lazy(() => import('@/admin/pages/Markets'));
const Analytics = lazy(() => import('@/admin/pages/Analytics'));
const Inquiries = lazy(() => import('@/admin/pages/Inquiries'));
const Quotes = lazy(() => import('@/admin/pages/Quotes'));
const Appointments = lazy(() => import('@/admin/pages/Appointments'));
const AppointmentServices = lazy(() => import('@/admin/pages/AppointmentServices'));
// Sales channels, settings
const OnlineStore = lazy(() => import('@/admin/pages/OnlineStore'));
const ContentEditor = lazy(() => import('@/admin/pages/ContentEditor'));
const Slides = lazy(() => import('@/admin/pages/Slides'));
const SlideEdit = lazy(() => import('@/admin/pages/SlideEdit'));
const Integrations = lazy(() => import('@/admin/pages/Integrations'));
const SettingsPage = lazy(() => import('@/admin/pages/SettingsPage'));
const ModuleMap = lazy(() => import('@/admin/pages/ModuleMap'));

function Loader() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-brand-600" />
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const authed = useUi((s) => s.adminAuthed);
  if (!authed) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

const STORAGE_FULL = defineDict({
  me: { full: 'Prostor za demo podatke je pun — obrišite neke otpremljene slike ili resetujte demo.' },
  sq: { full: 'Hapësira për të dhënat e demos është plot — fshini disa imazhe të ngarkuara ose rivendosni demon.' },
  en: { full: 'Demo data storage is full — delete some uploaded images or reset the demo.' },
});

/** Old v1 CMS URLs → v2 screens, keeping ?query (e.g. /admin/upiti?id=inq_120 → /admin/kontakti?id=inq_120). */
function Redirect({ to }: { to: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={`${to}${search}${hash}`} replace />;
}

function Root() {
  const brand = useDb((s) => s.settings.brandColor);
  const { pathname } = useLocation();
  const admin = pathname === '/admin' || pathname.startsWith('/admin/');
  // Neutral CMS theme under /admin (PDF p.07); the storefront (and the builder's preview iframe) keeps the Optika Miftari green.
  useLayoutEffect(() => setAdminTheme(admin), [admin]);
  useEffect(() => applyBrand(brand), [brand]);
  useEffect(() => startCrossTabSync(), []);
  useEffect(() => {
    const fn = () => {
      const ui = useUi.getState();
      const lang = document.documentElement.hasAttribute('data-admin') ? ui.adminLang : ui.lang;
      toast.error(STORAGE_FULL[lang].full);
    };
    window.addEventListener('optika:storage-full', fn);
    return () => window.removeEventListener('optika:storage-full', fn);
  }, []);
  return (
    <>
      <ScrollRestoration />
      <Suspense fallback={<Loader />}>
        <Outlet />
      </Suspense>
      <Toaster position="bottom-right" richColors closeButton toastOptions={{ className: 'font-sans' }} />
    </>
  );
}

/** CMS screen guarded by roles & permissions (PDF p.42): `module` + optional `action` (default view). */
const screen = (path: string, module: Module | null, element: ReactNode, action?: Action): RouteObject => ({
  path,
  element: module ? (
    <RequirePerm module={module} action={action}>
      {element}
    </RequirePerm>
  ) : (
    element
  ),
});

// Route map — keep in sync with src/admin/layout/nav.ts (sidebar) and AGENT_BRIEF.md ("CMS v2 route map").
const adminRoutes: RouteObject[] = [
  { index: true, element: <RequirePerm module="overview"><Dashboard /></RequirePerm> },
  // Porositë
  screen('narudzbe', 'orders', <Orders />),
  screen('narudzbe/:id', 'orders', <OrderDetail />),
  screen('nacrti', 'drafts', <DraftOrders />),
  screen('nacrti/:id', 'drafts', <DraftOrderEdit />), // 'novi' = new draft
  screen('povrati', 'returns', <Returns />),
  // Produktet
  screen('proizvodi', 'products', <Products />),
  screen('proizvodi/novi', 'products', <ProductEdit />),
  screen('proizvodi/:id', 'products', <ProductEdit />),
  screen('kolekcije', 'collections', <Collections />),
  screen('kolekcije/:id', 'collections', <CollectionEdit />),
  screen('kategorije', 'products', <Categories />),
  screen('inventar', 'inventory', <Inventory />),
  screen('nabavke', 'purchasing', <PurchaseOrders />),
  // Klientët
  screen('kupci', 'customers', <Customers />),
  screen('segmenti', 'segments', <Segments />),
  // Rritja · Zbritjet
  screen('ponude', 'offers', <Offers />),
  screen('ponude/:id', 'offers', <OfferEdit />),
  screen('popusti', 'discounts', <Discounts />),
  screen('popusti/:id', 'discounts', <DiscountEdit />),
  // Përmbajtja
  screen('stranice', 'content', <Pages />),
  screen('stranice/:id', 'content', <PageEdit />),
  screen('savjeti', 'content', <Posts />),
  screen('savjeti/:id', 'content', <PostEdit />),
  screen('projekti', 'content', <ProjectsAdmin />),
  screen('meniji', 'content', <Menus />),
  screen('modeli', 'content', <ContentModels />),
  screen('mediji', 'content', <Media />),
  // Tregjet · Analitika
  screen('trzista', 'markets', <Markets />),
  screen('analitika', 'analytics', <Analytics />),
  // Kontaktet · Terminet
  screen('kontakti', 'contacts', <Inquiries />),
  screen('kontakti/ponude', 'quotes', <Quotes />),
  screen('termini', 'appointments', <Appointments />),
  screen('termini/usluge', 'appointments', <AppointmentServices />),
  // Kanale shitjeje
  screen('prodavnica', 'onlineStore', <OnlineStore />),
  screen('prodavnica/editor', 'onlineStore', <ContentEditor />),
  screen('prodavnica/slajdovi', 'onlineStore', <Slides />),
  screen('prodavnica/slajdovi/:id', 'onlineStore', <SlideEdit />),
  screen('integracije', 'integrations', <Integrations />),
  // Konfigurimet · Harta e moduleve
  screen('konfiguracija', 'settings', <SettingsPage />),
  screen('konfiguracija/:section', 'settings', <SettingsPage />),
  screen('moduli', null, <ModuleMap />),
  // v1 URLs
  { path: 'upiti', element: <Redirect to="/admin/kontakti" /> },
  { path: 'sadrzaj', element: <Redirect to="/admin/prodavnica/editor" /> },
  { path: 'kuponi', element: <Redirect to="/admin/popusti" /> },
  { path: 'postavke', element: <Redirect to="/admin/konfiguracija" /> },
  { path: '*', element: <Navigate to="/admin" replace /> },
];

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      {
        element: <SiteLayout />,
        children: [
          { index: true, element: <Home /> },
          { path: 'produktet', element: <Shop /> },
          { path: 'produktet/:category', element: <Shop /> },
          { path: 'produkt/:slug', element: <ProductPage /> },
          { path: 'koleksioni/:slug', element: <CollectionPage /> },
          { path: 'oferta/:slug', element: <OfferPage /> },
          { path: 'shporta', element: <CartPage /> },
          { path: 'pagesa', element: <Checkout /> },
          { path: 'porosia/:id', element: <OrderSuccess /> },
          { path: 'sherbimet', element: <Services /> },
          { path: 'lookbook', element: <Projects /> },
          { path: 'rreth-nesh', element: <About /> },
          { path: 'kontakt', element: <Contact /> },
          { path: 'keshilla', element: <Blog /> },
          { path: 'keshilla/:slug', element: <PostPage /> },
          { path: 'faqe/:slug', element: <CmsPageView /> },
          { path: 'kerko', element: <SearchPage /> },
          { path: 'te-preferuarat', element: <Wishlist /> },
          { path: 'klinika', element: <Clinic /> },
          { path: 'optical-lab', element: <OpticalLab /> },
          { path: 'lentet', element: <LensGuide /> },
          { path: 'gjej-kornizen', element: <FrameFinder /> },
          { path: 'rezervo', element: <BookingPage /> },
          { path: 'gjurmo-porosine', element: <OrderTracking /> },
          { path: 'provo-virtualisht', element: <TryOn /> },
          { path: '*', element: <NotFound /> },
        ],
      },
      { path: 'admin/login', element: <Login /> },
      {
        // Printable invoice — outside the CMS shell
        path: 'admin/faktura/:id',
        element: (
          <RequireAuth>
            <Invoice />
          </RequireAuth>
        ),
      },
      {
        path: 'admin',
        element: (
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        ),
        children: adminRoutes,
      },
    ],
  },
], { basename: BASENAME });

export default function App() {
  return <RouterProvider router={router} />;
}
