import type { Db, MediaItem } from '@/lib/types';
import { CATEGORIES, buildProducts } from './catalog';
import { DEFAULT_SETTINGS, PROJECTS, buildCoupons, buildHome, buildPages, buildPosts } from './content';
import { generateInquiries, generateOrders } from './demo';
import {
  ARCHIVED_PRODUCT, SEGMENTS, SERVICES, STAFF, buildAudit, buildBookings, buildCollections, buildContentModels, buildDiscounts,
  buildDrafts, buildHomeHistory, buildMenus, buildMovements, buildOffers, buildPlacements, buildPurchaseOrders, buildQuotes,
  buildReturns, countDiscountUses, enrichInquiries, enrichProducts,
} from './cms';

/** Bump to force every browser to reload fresh demo data. */
export const DB_VERSION = 6;

/** Every bundled image (besides product shots), exposed in the CMS media library. */
const IMAGE_PATHS = [
  'hero/optical', 'hero/sun', 'hero/exam', 'hero/family',
  'cat/optike', 'cat/dielli', 'cat/lente', 'cat/sport',
  's/kontrolli', 's/pershtatja', 's/laboratori', 's/riparime', 's/klinika', 's/b2b', 's/lab-polish', 's/lab-laser', 's/lab-blank',
  'lookbook/riviera', 'lookbook/atelier-sun', 'lookbook/editorial', 'lookbook/generations', 'lookbook/generations-craft',
  'lookbook/craft', 'lookbook/sun-terrace', 'lookbook/still-life', 'lookbook/atelier-optical', 'lookbook/sun-portrait',
  'lookbook/optical-portrait',
  'misc/about', 'misc/contact', 'misc/promo', 'misc/craft', 'misc/sun-collection', 'misc/lens',
];

/** Media-library folder per image directory (stored in Albanian, the primary admin language). */
const OTHER = 'Të ndryshme';
const FOLDER: Record<string, string> = { hero: 'Hero', cat: 'Kategoritë', s: 'Shërbimet', lookbook: 'Lookbook', misc: OTHER, p: 'Produktet' };

function buildMedia(productImages: string[], now: Date): MediaItem[] {
  const all = [...IMAGE_PATHS.map((p) => `/images/${p}.webp`), ...productImages];
  const unique = Array.from(new Set(all));
  return unique.map((url, i) => {
    const seg = url.split('/')[2] ?? 'misc';
    const name = url.split('/').pop()!.replace('.webp', '');
    return {
      id: `m_${i + 1}`,
      url,
      name: `${name}.webp`,
      alt: name.replace(/-\d$/, '').replace(/-/g, ' '),
      folder: FOLDER[seg] ?? OTHER,
      uploaded: false,
      createdAt: new Date(now.getTime() - (unique.length - i) * 3600000).toISOString(),
    };
  });
}

export function createSeed(now = new Date()): Db {
  const catalog = enrichProducts(buildProducts(now));
  const settings = structuredClone(DEFAULT_SETTINGS);
  const collections = buildCollections(now);
  const home = buildHome(now);

  // Orders go through the real discount engine (with each order's date), then uses are recounted.
  const generated = generateOrders(catalog, settings, buildDiscounts(now), collections, now);
  const { returns, orders } = buildReturns(now, generated);
  const discounts = countDiscountUses(buildDiscounts(now), orders);

  // A discontinued line: archived after it had sales (orders keep their copy of it).
  const products = catalog.map((p) => (p.id === ARCHIVED_PRODUCT ? { ...p, status: 'archived' as const, featured: false } : p));

  const { bookings, inquiries } = buildBookings(now, enrichInquiries(now, generateInquiries(now)));

  return {
    version: DB_VERSION,
    settings,
    categories: structuredClone(CATEGORIES),
    products,
    orders,
    inquiries,
    coupons: buildCoupons(now),
    pages: buildPages(now),
    posts: buildPosts(now),
    projects: structuredClone(PROJECTS),
    media: buildMedia(products.flatMap((p) => p.images), now),
    home,
    seededAt: now.toISOString(),

    collections,
    discounts,
    offers: buildOffers(now, discounts, orders),
    placements: buildPlacements(home),
    staff: structuredClone(STAFF),
    services: structuredClone(SERVICES),
    bookings,
    segments: structuredClone(SEGMENTS),
    movements: buildMovements(now, orders, returns),
    purchaseOrders: buildPurchaseOrders(now),
    drafts: buildDrafts(now, products),
    returns,
    quotes: buildQuotes(now),
    menus: buildMenus(),
    contentModels: buildContentModels(PROJECTS, home, settings.locations.length),
    audit: buildAudit(now, orders),
    homeDraft: null,
    homeHistory: buildHomeHistory(now, home),
  };
}
