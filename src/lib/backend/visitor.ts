// What a visitor sends to the shop's server in the server-backed build: orders, bookings, requests, newsletter
// sign-ups, order look-ups and discount-code look-ups. Typed wrappers around api() (see server/api/lib/visitor.php
// and consent.php for the routes), plus the mapping from the server's error codes to message keys.
// The GitHub Pages demo never calls any of this: every caller checks BACKEND first.
import { useEffect } from 'react';
import { defineDict } from '@/i18n';
import type { Booking, Discount, Inquiry, Lang, Order } from '@/lib/types';
import { useDb, type InquiryInput, type PlaceOrderInput } from '@/store/db';
import { useUi } from '@/store/ui';
import { api, ApiError, BACKEND } from './api';
import { dataMode, forgetDiscounts, loadPublic, rememberDiscount, showLookedUpOrder, showOwnBooking, showOwnInquiry, showOwnOrder } from './data';

/** The answer was not what the route promises (e.g. the hosting answered with a page instead of the API). */
const badAnswer = () => new ApiError(502, 'bad_answer', null);

const errorOf = (err: unknown) => (err instanceof ApiError ? err : null);
/** Offline, or the server failed: nothing is known to have been saved. */
const unreachable = (e: ApiError) => e.status === 0 || e.status >= 500;

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

/*
 * One reference per order attempt, so a lost answer cannot turn into two orders: the same bag, details and total sent
 * again from this tab carry the same reference, and the server answers with the order it already saved. The salt
 * changes after every placed order (ordering the same things again later is a new order).
 */
const SALT_KEY = 'mv-order-salt';
function orderSalt(): string {
  try {
    let s = window.sessionStorage.getItem(SALT_KEY);
    if (!s) {
      s = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
      window.sessionStorage.setItem(SALT_KEY, s);
    }
    return s;
  } catch {
    return '';
  }
}
function newOrderSalt() {
  try {
    window.sessionStorage.removeItem(SALT_KEY);
  } catch {
    /* storage blocked: there was no reference either */
  }
}
async function orderRef(input: PlaceOrderInput, total: number): Promise<string> {
  const salt = orderSalt();
  if (!salt || !globalThis.crypto?.subtle) return '';
  try {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + JSON.stringify([input, total])));
    return Array.from(new Uint8Array(hash).slice(0, 24), (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return '';
  }
}

interface OrderAnswer {
  order?: Order;
  /** The ordered products' figures after the order (server: mv_build_web_order) */
  stock?: { id: string; stock: number; sold: number }[];
}

/**
 * POST order. `total` is the total the shopper saw: the server prices the bag itself and refuses (409 price_changed)
 * when the two differ. On success the order is kept on this device and the ordered products get their new stock.
 */
export async function sendOrder(input: PlaceOrderInput, total: number, consentText: string): Promise<Order> {
  const ref = await orderRef(input, total);
  const r = await api<OrderAnswer>('order', { body: { input, total, consentText, website: '', ...(ref ? { ref } : {}) } });
  if (!r?.order?.id) throw badAnswer();
  newOrderSalt();
  showOwnOrder(r.order);
  const after = new Map((r.stock ?? []).map((x) => [x.id, x]));
  // staff browsing the shop get the change through their own feed (and an edit here would be sent back as theirs)
  if (after.size && dataMode() === 'visitor') {
    useDb.setState((s) => ({
      products: s.products.map((p) => {
        const x = after.get(p.id);
        return x ? { ...p, stock: x.stock, sold: x.sold } : p;
      }),
    }));
  }
  return r.order;
}

export type OrderErrorKey =
  | 'srv_price' | 'srv_stock' | 'srv_unavailable' | 'srv_discountUsed' | 'srv_payment' | 'srv_pickup'
  | 'srv_field' | 'srv_bag' | 'srv_invalid' | 'srv_rate' | 'srv_network' | 'srv_refused';

/** Which checkout field a 422 answer is about (the page names it and moves the focus there). */
export type OrderField = 'firstName' | 'email' | 'phone' | 'address' | 'company';
const ORDER_FIELD: Record<string, OrderField> = {
  name_required: 'firstName', email_invalid: 'email', phone_invalid: 'phone', address_required: 'address', company_required: 'company',
};

export interface OrderError {
  key: OrderErrorKey;
  /** 409 price_changed: the total the server calculated */
  total?: number;
  /** 409 stock / product_unavailable, 422 qty_invalid / options_invalid: the product concerned */
  productId?: string;
  /** 409 stock: the most that can be ordered now */
  available?: number;
  /** 409 discount_used: the code (or, for an automatic rule, its id) */
  code?: string;
  /** 422 on one of the contact fields */
  field?: OrderField;
  /** The shop data on this page is out of date: refresh it (refreshShop) before the shopper tries again */
  stale: boolean;
}

/** An `order` failure as a message key of the checkout dictionary (`ck`) + what the message needs. */
export function orderError(err: unknown): OrderError {
  const e = errorOf(err);
  if (!e) return { key: 'srv_refused', stale: false };
  if (unreachable(e)) return { key: 'srv_network', stale: false };
  if (e.status === 429) return { key: 'srv_rate', stale: false };
  const d = e.data ?? {};
  const productId = typeof d.productId === 'string' && d.productId ? d.productId : undefined;
  switch (e.code) {
    case 'price_changed':
      return { key: 'srv_price', total: typeof d.total === 'number' ? d.total : undefined, stale: true };
    case 'stock':
      return { key: 'srv_stock', productId, available: typeof d.available === 'number' ? d.available : undefined, stale: true };
    case 'product_unavailable':
      return { key: 'srv_unavailable', productId, stale: true };
    case 'discount_used':
      return { key: 'srv_discountUsed', code: typeof d.code === 'string' ? d.code : undefined, stale: false };
    case 'payment_unavailable':
      return { key: 'srv_payment', stale: true };
    case 'pickup_unavailable':
      return { key: 'srv_pickup', stale: true };
    case 'items_invalid':
    case 'qty_invalid':
    case 'options_invalid':
      return { key: 'srv_bag', productId, stale: true };
  }
  if (ORDER_FIELD[e.code]) return { key: 'srv_field', field: ORDER_FIELD[e.code], stale: false };
  return { key: e.status === 422 ? 'srv_invalid' : 'srv_refused', stale: false };
}

/* ------------------------------------------------------------------ */
/* Requests & bookings                                                 */
/* ------------------------------------------------------------------ */

/** POST inquiry (contact message, exam request, quote / partner request). The saved request is kept on this device. */
export async function sendInquiry(input: InquiryInput): Promise<Inquiry> {
  const r = await api<{ inquiry?: Inquiry | null }>('inquiry', { body: { input, website: '' } });
  // "ok" without a request is the server's answer to a filled bot trap: nothing was saved, so this is not a success
  if (!r?.inquiry?.id) throw badAnswer();
  showOwnInquiry(r.inquiry);
  return r.inquiry;
}

/** What the server reads from `booking` (the name, phone and e-mail come from the request, the length from the service). */
export interface BookingRequest {
  serviceId: string;
  staffId: string;
  /** ISO start */
  start: string;
  /** settings.locations id or 'onsite' */
  location?: string;
  note?: string;
  address?: string;
  city?: string;
}

/** POST booking: the request and its pending appointment are saved together, or neither (slot just taken). */
export async function sendBooking(inquiry: InquiryInput, booking: BookingRequest): Promise<{ inquiry: Inquiry; booking: Booking }> {
  const r = await api<{ inquiry?: Inquiry; booking?: Booking }>('booking', { body: { inquiry, booking, website: '' } });
  if (!r?.booking?.id || !r.inquiry?.id) throw badAnswer();
  showOwnBooking(r.booking);
  showOwnInquiry(r.inquiry);
  return { inquiry: r.inquiry, booking: r.booking };
}

/** The server refused the time or the service itself (taken, in the past, no longer bookable) — not the visitor's details. */
export function isSlotRefusal(err: unknown): boolean {
  const code = errorOf(err)?.code;
  return code === 'taken' || code === 'time_invalid' || code === 'service_invalid';
}

export type BookingErrorKey = 'takenError' | 'srv_time' | 'srv_service' | 'srv_details' | 'srv_rate' | 'srv_network' | 'srv_refused';

/** A `booking` failure as a message key of the booking dictionary (`bk`). */
export function bookingErrorKey(err: unknown): BookingErrorKey {
  const e = errorOf(err);
  if (!e) return 'srv_refused';
  if (unreachable(e)) return 'srv_network';
  if (e.status === 429) return 'srv_rate';
  if (e.code === 'taken') return e.data?.reason === 'service' ? 'srv_service' : 'takenError';
  if (e.code === 'time_invalid') return 'srv_time';
  if (e.code === 'service_invalid') return 'srv_service';
  return e.status === 422 ? 'srv_details' : 'srv_refused';
}

/* ------------------------------------------------------------------ */
/* Newsletter                                                          */
/* ------------------------------------------------------------------ */

/**
 * POST subscribe. `wording` is the text the visitor was shown when signing up — the server keeps it with the consent
 * record. (`source` says which box it was; today the server files every sign-up of this route as "newsletter".)
 */
export async function sendSubscribe(email: string, lang: Lang, wording: string, source = 'footer'): Promise<void> {
  await api('subscribe', { body: { email, lang, wording, source, website: '' } });
}

/* ------------------------------------------------------------------ */
/* Order tracking                                                      */
/* ------------------------------------------------------------------ */

/** The customer's upcoming appointments as the tracking route returns them: no names, no notes, no staff. */
type TrackedBooking = Pick<Booking, 'id' | 'serviceId' | 'start' | 'durationMin' | 'status' | 'location'>;

/**
 * POST track: the order when the number AND the e-mail / phone match it, else null (the server gives the same
 * answer for an unknown number and for a wrong contact). The order is shown for this visit only, not kept on the device.
 */
export async function trackOrder(number: string, contact: string): Promise<{ order: Order; bookings: Booking[] } | null> {
  let r: { order?: Order; bookings?: TrackedBooking[] } | null;
  try {
    r = await api<{ order?: Order; bookings?: TrackedBooking[] }>('track', { body: { number, contact } });
  } catch (err) {
    const e = errorOf(err);
    if (e && (e.status === 404 || e.status === 422)) return null;
    throw err;
  }
  if (!r?.order?.id) throw badAnswer();
  showLookedUpOrder(r.order);
  const bookings = (Array.isArray(r.bookings) ? r.bookings : []).map((b) => ({ staffId: '', customerName: '', phone: '', createdAt: '', ...b }));
  return { order: r.order, bookings };
}

/** Why a look-up could not be done at all. */
export const trackFailure = (err: unknown): 'rate' | 'network' => (errorOf(err)?.status === 429 ? 'rate' : 'network');

/* ------------------------------------------------------------------ */
/* Discount codes                                                      */
/* ------------------------------------------------------------------ */
// The public snapshot only carries codes an offer advertises. A code the shopper types is looked up here and its rule
// added to the discounts on this page, so the bag shows the same total the server will calculate.

const normCode = (code: string) => code.trim().replace(/\s+/g, '').toUpperCase();
/** This visit's look-ups (null = no such code) and the ones in flight. */
const answers = new Map<string, Discount | null>();
const pending = new Map<string, Promise<Discount | null>>();

const localCode = (code: string) => useDb.getState().discounts.find((d) => d.method === 'code' && normCode(d.code ?? '') === code);

function keepDiscount(d: Discount) {
  if (dataMode() !== 'visitor') return;
  rememberDiscount(d);
  useDb.setState((s) => {
    // already there (the very answer kept earlier): leave the list untouched, or everything priced from it runs again
    if (s.discounts.includes(d)) return {};
    return { discounts: s.discounts.some((x) => x.id === d.id) ? s.discounts.map((x) => (x.id === d.id ? d : x)) : [...s.discounts, d] };
  });
}

/**
 * Make sure the rule behind a typed code is on this page: resolves with it, or null when the shop has no such code.
 * Rejects (ApiError) when the shop could not be asked. No-op outside the server-backed visitor build.
 */
export async function ensureCode(code: string): Promise<Discount | null> {
  const c = normCode(code);
  if (!BACKEND || !c || dataMode() !== 'visitor') return null;
  const here = localCode(c);
  if (here) return here;
  const known = answers.get(c);
  if (known !== undefined) {
    if (known) keepDiscount(known);
    return known;
  }
  let p = pending.get(c);
  if (!p) {
    p = api<{ discount?: Discount | null }>('coupon', { body: { code: c } })
      .then((r) => {
        const d = r?.discount ?? null;
        answers.set(c, d);
        if (d) keepDiscount(d);
        return d;
      })
      .finally(() => pending.delete(c));
    pending.set(c, p);
  }
  return p;
}

/** Keeps the rules of the shopper's entered codes on the page — also after the public snapshot is fetched again. */
export function useCodeDiscounts() {
  const codes = useUi((s) => s.codes);
  const discounts = useDb((s) => s.discounts);
  useEffect(() => {
    if (!BACKEND) return;
    for (const c of codes) void ensureCode(c).catch(() => undefined);
  }, [codes, discounts]);
}

/**
 * Fresh catalogue, prices, stock, booked times and code rules — after the server said this page is out of date.
 * Resolves false when the shop could not be reached (the page keeps what it had).
 */
export async function refreshShop(): Promise<boolean> {
  answers.clear();
  forgetDiscounts();
  const ok = await loadPublic();
  await Promise.all(useUi.getState().codes.map((c) => ensureCode(c).catch(() => null)));
  return ok;
}

/* ------------------------------------------------------------------ */
/* Messages every form shares                                          */
/* ------------------------------------------------------------------ */

/** Failures of the contact, request and newsletter forms. `me` = Serbian (Latin, ekavian). */
export const visitorErrors = defineDict({
  me: {
    sv_network: 'Nismo uspeli da kontaktiramo prodavnicu — ništa nije poslato. Pokušajte ponovo.',
    sv_rate: 'Previše zahteva za kratko vreme — ništa nije poslato. Sačekajte malo i pokušajte ponovo, ili nas pozovite.',
    sv_refused: 'Zahtev nije prihvaćen — ništa nije poslato. Osvežite stranicu i pokušajte ponovo, ili nas pozovite.',
    sv_invalid: 'Neki podaci nisu prihvaćeni — ništa nije poslato. Proverite polja i pokušajte ponovo.',
    sv_name: 'Upišite svoje ime.',
    sv_phone: 'Unesite ispravan broj telefona.',
    sv_email: 'Unesite ispravnu e-mail adresu.',
  },
  sq: {
    sv_network: 'Nuk arritëm ta kontaktojmë dyqanin — asgjë nuk u dërgua. Ju lutemi provoni sërish.',
    sv_rate: 'Shumë kërkesa në pak kohë — asgjë nuk u dërgua. Prisni pak dhe provoni sërish, ose na telefononi.',
    sv_refused: 'Kërkesa nuk u pranua — asgjë nuk u dërgua. Rifreskoni faqen dhe provoni sërish, ose na telefononi.',
    sv_invalid: 'Disa të dhëna nuk u pranuan — asgjë nuk u dërgua. Kontrolloni fushat dhe provoni sërish.',
    sv_name: 'Shkruani emrin tuaj.',
    sv_phone: 'Shkruani një numër telefoni të saktë.',
    sv_email: 'Shkruani një adresë e-maili të saktë.',
  },
  en: {
    sv_network: 'We could not reach the shop — nothing was sent. Please try again.',
    sv_rate: 'Too many requests in a short time — nothing was sent. Please wait a little and try again, or call us.',
    sv_refused: 'The request was not accepted — nothing was sent. Refresh the page and try again, or call us.',
    sv_invalid: 'Some details were not accepted — nothing was sent. Please check the fields and try again.',
    sv_name: 'Please enter your name.',
    sv_phone: 'Enter a valid phone number.',
    sv_email: 'Enter a valid e-mail address.',
  },
});

export type FormErrorKey = keyof typeof visitorErrors.me;

/** An `inquiry` / `subscribe` failure as a message key of `visitorErrors`. */
export function formErrorKey(err: unknown): FormErrorKey {
  const e = errorOf(err);
  if (!e) return 'sv_refused';
  if (unreachable(e)) return 'sv_network';
  if (e.status === 429) return 'sv_rate';
  if (e.code === 'name_required') return 'sv_name';
  if (e.code === 'phone_invalid') return 'sv_phone';
  if (e.code === 'email_invalid') return 'sv_email';
  return e.status === 422 ? 'sv_invalid' : 'sv_refused';
}
