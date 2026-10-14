import { lazy, type ComponentType } from 'react';
import { appPath } from '@/lib/paths';

/* ------------------------------------------------------------------ */
/* Storefront pages are code-split (only Home ships in the entry       */
/* bundle) and prefetched so navigation still feels instant:           */
/*  - on intent: pointer over / touch / focus on a link to the page    */
/*  - when idle after the first page has loaded: the likeliest next     */
/*    pages, unless the visitor is on Save-Data or a 2G connection     */
/* ------------------------------------------------------------------ */
type Loader = () => Promise<{ default: ComponentType }>;

const RELOAD_KEY = 'optika-chunk-reload';

/**
 * Reload the page to pick up fresh HTML and the current chunk names — at most once a minute, so a file that is
 * really gone ends on the error screen instead of a reload loop. False when a reload was done recently.
 */
export function reloadOnce(): boolean {
  try {
    if (Date.now() - Number(sessionStorage.getItem(RELOAD_KEY) || 0) < 60_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  location.reload();
  return true;
}

/**
 * A code-split chunk can fail to download (a CDN hiccup, a weak mobile signal, or a page left open across a new
 * deploy whose old file names no longer exist). Retry twice, then reload the page once to pick up fresh files;
 * only after that does the error reach the route's error screen.
 */
export function withRetry<T>(fn: () => Promise<T>): () => Promise<T> {
  return async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
          continue;
        }
        if (reloadOnce()) return new Promise<T>(() => {});
        throw err;
      }
    }
  };
}

/** `React.lazy` with retry + one-time reload (used for every code-split page, storefront and CMS). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const lazyRetry = <C extends ComponentType<any>>(fn: () => Promise<{ default: C }>) => lazy(withRetry(fn));

const LOADERS = {
  shop: () => import('@/site/pages/Shop'),
  product: () => import('@/site/pages/ProductPage'),
  cart: () => import('@/site/pages/CartPage'),
  checkout: () => import('@/site/pages/Checkout'),
  orderSuccess: () => import('@/site/pages/OrderSuccess'),
  services: () => import('@/site/pages/Services'),
  projects: () => import('@/site/pages/Projects'),
  about: () => import('@/site/pages/About'),
  contact: () => import('@/site/pages/Contact'),
  blog: () => import('@/site/pages/Blog'),
  post: () => import('@/site/pages/PostPage'),
  cmsPage: () => import('@/site/pages/CmsPageView'),
  search: () => import('@/site/pages/SearchPage'),
  wishlist: () => import('@/site/pages/Wishlist'),
  collection: () => import('@/site/pages/CollectionPage'),
  offer: () => import('@/site/pages/OfferPage'),
  notFound: () => import('@/site/pages/NotFound'),
  clinic: () => import('@/site/pages/Clinic'),
  lab: () => import('@/site/pages/OpticalLab'),
  lensGuide: () => import('@/site/pages/LensGuide'),
  frameFinder: () => import('@/site/pages/FrameFinder'),
  booking: () => import('@/site/pages/BookingPage'),
  tracking: () => import('@/site/pages/OrderTracking'),
  tryOn: () => import('@/site/pages/TryOn'),
  smart: () => import('@/site/pages/SmartGlasses'),
} satisfies Record<string, Loader>;

type Key = keyof typeof LOADERS;

const started = new Set<Key>();
/** Start loading a page chunk once (the browser caches the module afterwards). */
function load(key: Key) {
  if (started.has(key)) return;
  started.add(key);
  LOADERS[key]().catch(() => started.delete(key));
}

export const Pages = Object.fromEntries(Object.entries(LOADERS).map(([k, fn]) => [k, lazy(withRetry(fn as Loader))])) as Record<Key, ReturnType<typeof lazy>>;

/** First path segment → page chunk (mirrors the storefront routes in App.tsx). */
const BY_SEGMENT: Record<string, Key> = {
  produktet: 'shop',
  produkt: 'product',
  shporta: 'cart',
  pagesa: 'checkout',
  porosia: 'orderSuccess',
  sherbimet: 'services',
  lookbook: 'projects',
  'rreth-nesh': 'about',
  kontakt: 'contact',
  faqe: 'cmsPage',
  kerko: 'search',
  'te-preferuarat': 'wishlist',
  koleksioni: 'collection',
  oferta: 'offer',
  klinika: 'clinic',
  'optical-lab': 'lab',
  lentet: 'lensGuide',
  'gjej-kornizen': 'frameFinder',
  rezervo: 'booking',
  'gjurmo-porosine': 'tracking',
  'syze-inteligjente': 'smart',
};

/** Prefetch the chunk for an app path such as "/produkt/prism-m2". The try-on (three.js) only loads on demand. */
export function prefetchPath(path: string) {
  const [first, second] = path.replace(/^\/+/, '').split(/[/?#]/);
  if (!first) return;
  if (first === 'keshilla') return load(second ? 'post' : 'blog');
  const key = BY_SEGMENT[first];
  if (key) load(key);
}

/** Link intent → prefetch. Attach once (SiteLayout). Returns the cleanup. */
export function listenForLinkIntent() {
  const onIntent = (e: Event) => {
    const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || a.origin !== location.origin) return;
    prefetchPath(appPath(a.pathname) + a.search);
  };
  const opts = { passive: true, capture: true } as const;
  document.addEventListener('pointerover', onIntent, opts);
  document.addEventListener('touchstart', onIntent, opts);
  document.addEventListener('focusin', onIntent, opts);
  return () => {
    document.removeEventListener('pointerover', onIntent, opts);
    document.removeEventListener('touchstart', onIntent, opts);
    document.removeEventListener('focusin', onIntent, opts);
  };
}

/** After the first page is interactive: quietly fetch the pages shoppers open most. */
export function prefetchLikelyPages() {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? '')) return () => {};
  const queue: Key[] = ['shop', 'product', 'cart', 'booking', 'services', 'checkout'];
  let cancelled = false;
  const idle = (cb: () => void) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(cb, { timeout: 4000 }) : setTimeout(cb, 1200));
  const next = () => {
    if (cancelled) return;
    const key = queue.shift();
    if (!key) return;
    load(key);
    idle(next);
  };
  const start = window.setTimeout(() => idle(next), 2500);
  return () => {
    cancelled = true;
    window.clearTimeout(start);
  };
}
