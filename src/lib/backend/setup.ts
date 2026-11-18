// First set-up of the server-backed shop: what the owner's first import contains.
//  - a clean start: the catalogue, pages, menus and settings built into this version of the site, WITHOUT the sample
//    orders, customers' requests, appointments, stock history and usage counters the demo ships with;
//  - or a backup file: one exported from the server (Settings → Data), or a backup made in the demo CMS.
import { createSeed } from '@/data/seed';
import type { Db } from '@/lib/types';
import { hostedPrivacy } from './privacyHosted';
import { readRules } from '@/admin/components/appointments/rules';

export interface ShopImport {
  lists: Record<string, unknown[]>;
  singles: Record<string, unknown>;
  crm?: unknown;
}

const SINGLES = ['settings', 'home', 'homeDraft', 'homeHistory', 'seededAt', 'version'] as const;
/** Records of business done: a new shop starts with none. */
const ACTIVITY = ['orders', 'inquiries', 'bookings', 'movements', 'audit', 'drafts', 'returns', 'quotes', 'purchaseOrders'] as const;

/** A whole shop state (the demo's shape) → the lists and single values the server stores. */
export function splitDb(db: Partial<Db>): ShopImport {
  const lists: Record<string, unknown[]> = {};
  const singles: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(db)) {
    if ((SINGLES as readonly string[]).includes(k)) singles[k] = v;
    else if (Array.isArray(v)) lists[k] = v;
  }
  return { lists, singles };
}

const zeroed = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? 0 : v])) as T;

/** The built-in catalogue and content with every trace of the demo's sample business removed. */
export function cleanStart(now = new Date()): ShopImport {
  const s = createSeed(now);
  const rules = readRules(s.settings, now);
  const db: Db = {
    ...s,
    ...(Object.fromEntries(ACTIVITY.map((k) => [k, []])) as unknown as Pick<Db, (typeof ACTIVITY)[number]>),
    homeDraft: null,
    homeHistory: [],
    // the booking rules are saved with the shop (opening hours, public holidays, notice), so the server can hold
    // requests to them; the demo's sample "staff training" day is not a real closure
    settings: { ...s.settings, demoBanner: false, booking: { ...rules, exceptions: rules.exceptions.filter((e) => e.id !== 'ex-trajnim') } } as Db['settings'],
    // counters start from nothing: no invented sales, code uses or campaign figures
    products: s.products.map((p) => ({ ...p, sold: 0 })),
    coupons: s.coupons.map((c) => ({ ...c, uses: 0 })),
    discounts: s.discounts.map((d) => ({ ...d, uses: 0 })),
    offers: s.offers.map((o) => ({ ...o, metrics: zeroed(o.metrics) })),
    // the privacy notice of a shop on its own server (the bundled one describes the demo)
    pages: s.pages.map((p) => (p.slug === 'privatesia' ? { ...p, body: hostedPrivacy(p.body) } : p)),
    seededAt: now.toISOString(),
  };
  return splitDb(db);
}

export type BackupProblem = 'not_json' | 'not_backup';

/** A backup made in the demo may say "show the demo banner": the server-backed shop takes real orders. */
function notDemo(data: ShopImport): ShopImport {
  const s = data.singles.settings;
  if (s && typeof s === 'object') data.singles.settings = { ...(s as object), demoBanner: false };
  return data;
}

/** Read a backup file's text. Accepts a server export and a demo-CMS backup (the whole shop state). */
export function readBackup(text: string): ShopImport | BackupProblem {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    return 'not_json';
  }
  if (!j || typeof j !== 'object') return 'not_backup';
  const o = j as Record<string, unknown>;
  if (o.kind === 'miftari-vision-backup' && o.lists && typeof o.lists === 'object' && o.singles && typeof o.singles === 'object') {
    return notDemo({ lists: o.lists as Record<string, unknown[]>, singles: o.singles as Record<string, unknown>, crm: o.crm });
  }
  // demo backup: { state: {...} } as the browser stores it, or the bare state
  const state = (o.state && typeof o.state === 'object' ? o.state : o) as Partial<Db>;
  if (Array.isArray(state.products) && state.settings && typeof state.settings === 'object') return notDemo(splitDb(state));
  return 'not_backup';
}
