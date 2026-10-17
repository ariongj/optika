// /gjurmo-porosine — order lookup (number + e-mail/phone), progress stages and the lab ETA. Pure helpers.
import type { Booking, Customer, Order, OrderLine, Product } from '@/lib/types';
import { addDays, startOfDay } from '@/admin/components/appointments/dates';
import { phoneKey } from './availability';

export type Lookup = { kind: 'ok'; order: Order } | { kind: 'notFound' } | { kind: 'mismatch' };

const canon = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** "om 1234", "OM1234", "#OM-1234" and "1234" all find OM-1234 (and "w7k3qf" finds the web order OM-W7K3QF). */
export function findOrder(orders: Order[], input: string, prefix: string) {
  const want = canon(input);
  if (!want) return undefined;
  const p = canon(prefix || 'OM-');
  return orders.find((o) => {
    const c = canon(o.number);
    return c === want || c === p + want;
  });
}

/** E-mail: case-insensitive. Phone: digits only, +383 / 00383 / leading 0 ignored. */
export function contactMatches(c: Pick<Customer, 'email' | 'phone'>, contact: string) {
  const v = contact.trim();
  if (!v) return false;
  if (v.includes('@')) return !!c.email && c.email.trim().toLowerCase() === v.toLowerCase();
  const k = phoneKey(v);
  return k.length >= 6 && phoneKey(c.phone) === k;
}

/** Both fields must match before anything about the order is shown. */
export function lookupOrder(orders: Order[], number: string, contact: string, prefix: string): Lookup {
  const order = findOrder(orders, number, prefix);
  if (!order) return { kind: 'notFound' };
  return contactMatches(order.customer, contact) ? { kind: 'ok', order } : { kind: 'mismatch' };
}

/* ------------------------------------------------------------------ */
/* Stages                                                              */
/* ------------------------------------------------------------------ */
export const STAGES = ['new', 'confirmed', 'processing', 'ready', 'completed'] as const;
export type Stage = (typeof STAGES)[number];

const STAGE_INDEX: Record<string, number> = { new: 0, confirmed: 1, processing: 2, shipped: 3, installation: 3, completed: 4 };

/** Index of the current stage; for a cancelled order the last stage reached before cancelling. */
export function stageIndex(o: Order) {
  if (o.status !== 'cancelled') return STAGE_INDEX[o.status] ?? 0;
  return o.timeline.reduce((max, e) => Math.max(max, STAGE_INDEX[e.status] ?? -1), 0);
}

/** When each stage was reached (last matching timeline event). */
export function stageDates(o: Order): (string | undefined)[] {
  return STAGES.map((_, i) => {
    const hits = o.timeline.filter((e) => STAGE_INDEX[e.status] === i);
    return hits.length ? hits[hits.length - 1].at : i === 0 ? o.createdAt : undefined;
  });
}

export const lastUpdate = (o: Order) => o.timeline.reduce((max, e) => (e.at > max ? e.at : max), o.createdAt);
export const cancelledAt = (o: Order) => [...o.timeline].reverse().find((e) => e.status === 'cancelled')?.at;

/* ------------------------------------------------------------------ */
/* Optical Lab                                                         */
/* ------------------------------------------------------------------ */
/** A frame's prescription-lens choice → the lens package whose lead time applies. */
const LENS_PACKAGE: Record<string, string> = { single: 'p-lens-single', screen: 'p-lens-screen', progressive: 'p-lens-progressive', rx: 'p-lens-sun-rx' };
const NO_LAB = new Set(['frame', 'original']);

/** Working days the lab needs for this line, or null when no lenses are made for it. */
export function labDaysOf(line: OrderLine, products: Product[]): number | null {
  const p = products.find((x) => x.id === line.productId);
  if (!p) return null;
  if (p.categoryId === 'cat-lente') return p.leadDays ?? 5;
  const opt = p.options.find((o) => o.id === 'lenses');
  if (!opt) return null;
  // The line stores the options as text in the order language ("Lentet: Progresive") — match any language.
  const chosen = opt.values.find((v) => (['sq', 'en', 'me'] as const).some((lang) => line.options.includes(`${opt.name[lang]}: ${v.label[lang]}`)));
  if (!chosen || NO_LAB.has(chosen.id)) return null;
  const pkg = products.find((x) => x.id === LENS_PACKAGE[chosen.id]);
  return pkg?.leadDays ?? Math.max(p.leadDays ?? 3, 4);
}

/** Store working days: Monday–Saturday. */
export function addWorkingDays(from: Date, n: number) {
  let d = startOfDay(from);
  let left = n;
  while (left > 0) {
    d = addDays(d, 1);
    if (d.getDay() !== 0) left--;
  }
  return d;
}

/** Lenses ready around … — while the order is still before shipping / fitting. */
export function labEta(o: Order, products: Product[]): { days: number; date: Date } | null {
  if (o.status !== 'new' && o.status !== 'confirmed' && o.status !== 'processing') return null;
  const days = Math.max(0, ...o.items.map((l) => labDaysOf(l, products) ?? 0));
  if (!days) return null;
  const startEv = o.timeline.find((e) => e.status === 'processing') ?? o.timeline.find((e) => e.status === 'confirmed');
  return { days, date: addWorkingDays(new Date(startEv?.at ?? o.createdAt), days) };
}

export const usesLab = (o: Order, products: Product[]) => o.items.some((l) => labDaysOf(l, products) != null);

/* ------------------------------------------------------------------ */
/* The customer's upcoming appointments                                */
/* ------------------------------------------------------------------ */
export function upcomingFor(c: Pick<Customer, 'email' | 'phone'>, bookings: Booking[], now: number) {
  const email = c.email?.trim().toLowerCase();
  const phone = phoneKey(c.phone);
  return bookings
    .filter((b) => (b.status === 'pending' || b.status === 'confirmed') && new Date(b.start).getTime() > now)
    .filter((b) => (email && b.email?.trim().toLowerCase() === email) || (phone.length >= 6 && phoneKey(b.phone) === phone))
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 4);
}
