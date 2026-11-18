// Where the shop's data comes from in the server-backed build:
//  - visitors get the public snapshot (catalogue, pages, settings, which booking slots are taken — nothing private),
//    kept in this browser between visits for a fast first screen; their own orders / requests stay on this device
//    so the confirmation and order pages can show them;
//  - signed-in staff get the full shop from the server and keep it in memory only (orders, customers… are never
//    written to this browser's storage); edits go back through the sync engine (./sync).
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Booking, Db, Discount, Inquiry, Order } from '@/lib/types';
import { useDb } from '@/store/db';
import { safeStorage } from '@/store/storage';
import { DB_VERSION } from '@/data/seed';
import { api, BACKEND } from './api';
import { dataMode, PUBLIC_KEYS, useBackend, type PublicKey } from './mode';
import { checkSession, staffHint } from './session';

export { dataMode, useBackend, PUBLIC_KEYS };

/** Staff-only lists: empty for visitors (their own orders / requests come from useMine). */
const PRIVATE_LISTS = [
  'orders', 'inquiries', 'coupons', 'media', 'segments', 'movements', 'purchaseOrders', 'drafts', 'returns', 'quotes', 'contentModels', 'audit',
  'homeHistory',
] as const satisfies readonly (keyof Db)[];

/* ------------------------------------------------------------------ */
/* The visitor's own submissions (kept on this device, newest first)   */
/* ------------------------------------------------------------------ */

interface MineState {
  orders: Order[];
  inquiries: Inquiry[];
  bookings: Booking[];
  addOrder: (o: Order) => void;
  addInquiry: (q: Inquiry) => void;
  addBooking: (b: Booking) => void;
}
const KEEP = 12;
const upsert = <T extends { id: string }>(list: T[], item: T) => [item, ...list.filter((x) => x.id !== item.id)].slice(0, KEEP);

export const useMine = create<MineState>()(
  persist(
    (set) => ({
      orders: [],
      inquiries: [],
      bookings: [],
      addOrder: (o) => set((s) => ({ orders: upsert(s.orders, o) })),
      addInquiry: (q) => set((s) => ({ inquiries: upsert(s.inquiries, q) })),
      addBooking: (b) => set((s) => ({ bookings: upsert(s.bookings, b) })),
    }),
    { name: 'mv-mine', version: 1, storage: createJSONStorage(() => safeStorage), partialize: (s) => ({ orders: s.orders, inquiries: s.inquiries, bookings: s.bookings }) },
  ),
);

/** Put an order the visitor just placed into the shop data the pages read, and keep it on this device. */
export function showOwnOrder(o: Order) {
  if (dataMode() === 'visitor') {
    useMine.getState().addOrder(o);
    useDb.setState((s) => ({ orders: upsert(s.orders, o) }));
  } else {
    // staff trying the shop while signed in: the order reaches the CMS data through the change feed
    void import('./sync').then((m) => m.pull()).catch(() => {});
  }
}

/* Rules of discount codes the shopper typed (the public snapshot only lists advertised codes): kept across refreshes. */
const typedCodes = new Map<string, Discount>();
export function rememberDiscount(d: Discount) {
  typedCodes.set(d.id, d);
}
export function forgetDiscounts() {
  typedCodes.clear();
}
/**
 * An order looked up on the tracking page: shown for this visit only. Unlike an order placed here it is not kept on
 * the device — the look-up may have been made on someone else's computer.
 */
export function showLookedUpOrder(o: Order) {
  if (dataMode() === 'visitor') useDb.setState((s) => ({ orders: upsert(s.orders, o) }));
}
export function showOwnInquiry(q: Inquiry) {
  useMine.getState().addInquiry(q);
  if (dataMode() === 'visitor') useDb.setState((s) => ({ inquiries: upsert(s.inquiries, q) }));
}
export function showOwnBooking(b: Booking) {
  useMine.getState().addBooking(b);
  if (dataMode() === 'visitor') useDb.setState((s) => ({ bookings: [...s.bookings.filter((x) => x.id !== b.id), b] }));
}

/** Visitor view of the private lists: only this device's own records. */
function visitorPrivate(): Partial<Db> {
  const mine = useMine.getState();
  const out: Partial<Db> = {};
  for (const k of PRIVATE_LISTS) (out as Record<string, unknown>)[k] = [];
  out.orders = mine.orders;
  out.inquiries = mine.inquiries;
  out.homeDraft = null;
  return out;
}

/* ------------------------------------------------------------------ */
/* Public snapshot                                                     */
/* ------------------------------------------------------------------ */

type PublicSnapshot = { ok: true; rev: number; ready: boolean } & Partial<Pick<Db, PublicKey>>;

let publicRev = -1;
let publicAt = 0;

function applyPublic(pub: PublicSnapshot) {
  publicRev = pub.rev;
  publicAt = Date.now();
  useBackend.setState({ ready: !!pub.ready, loaded: true, offline: false });
  if (!pub.ready || dataMode() !== 'visitor') return;
  const mine = useMine.getState();
  useDb.setState((s) => {
    const next: Partial<Db> = {};
    for (const k of PUBLIC_KEYS) {
      const v = pub[k];
      if (v === undefined || v === null) continue;
      (next as Record<string, unknown>)[k] = v;
    }
    // settings: the server leaves out staff-only keys — keep the app defaults for those
    if (pub.settings) next.settings = { ...s.settings, ...pub.settings, demoBanner: false };
    // a code the shopper typed stays applied when the catalogue is fetched again
    if (pub.discounts && typedCodes.size) {
      const listed = new Set(pub.discounts.map((d) => d.id));
      next.discounts = [...pub.discounts, ...[...typedCodes.values()].filter((d) => !listed.has(d.id))];
    }
    // booked times arrive without names; this device's own bookings keep theirs
    if (pub.bookings) {
      const own = new Map(mine.bookings.map((b) => [b.id, b]));
      next.bookings = pub.bookings.map((b) => own.get(b.id) ?? b);
    }
    return next;
  });
}

/** Fetch the public snapshot (the browser revalidates it with its ETag: unchanged data costs one short request). */
export async function loadPublic(): Promise<boolean> {
  try {
    applyPublic(await api<PublicSnapshot>('public', { cache: 'no-cache' }));
    return true;
  } catch {
    useBackend.setState({ offline: true });
    return false;
  }
}

/** Fresh catalogue when a visitor comes back to a tab that has been open a while (prices, stock, slots). */
function refreshWhenVisible() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && dataMode() === 'visitor' && Date.now() - publicAt > 5 * 60_000) void loadPublic();
  });
}

/* ------------------------------------------------------------------ */
/* Start-up                                                            */
/* ------------------------------------------------------------------ */

/** Did this browser keep a public snapshot from an earlier visit (fast first screen)? */
function hasCachedPublic(): boolean {
  try {
    const raw = window.localStorage.getItem('mv-db');
    return !!raw && (JSON.parse(raw) as { version?: number }).version === DB_VERSION;
  } catch {
    return false;
  }
}

/**
 * Called once before the app mounts (main.tsx). Staff (CMS pages, or a browser where staff signed in before) get the
 * full data from the server; everyone else the public snapshot — awaited on a first visit (the static first screen
 * shows meanwhile), refreshed in the background when this browser already has a copy.
 */
export async function bootData(path: string): Promise<void> {
  if (!BACKEND) return;
  // never show the bundled demo orders / customers to anyone
  useDb.setState(visitorPrivate());
  refreshWhenVisible();
  const cms = path === '/admin' || path.startsWith('/admin/');
  if (cms || staffHint()) {
    const user = await checkSession();
    if (user) {
      try {
        const { startStaffData } = await import('./sync');
        await startStaffData();
      } catch {
        // signed in, but the shop could not be loaded (connection, server): the CMS shows "try again", never sample data
        useBackend.setState({ mode: 'staff', loaded: false, failed: true });
      }
      return;
    }
  }
  if (cms) {
    // sign-in page: no shop data needed up front
    void loadPublic();
    return;
  }
  if (hasCachedPublic()) {
    useBackend.setState({ loaded: true });
    void loadPublic();
    return;
  }
  await Promise.race([loadPublic(), new Promise((r) => setTimeout(r, 6000))]);
}

/** The public snapshot revision last applied (for tests and the CMS status line). */
export const lastPublicRev = () => publicRev;
