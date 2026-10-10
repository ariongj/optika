// Storefront slot booking (/rezervo) — pure helpers on top of the CMS booking rules
// (admin/components/appointments/rules.ts: opening hours, holidays, notice, buffer, capacity).
import type { Booking, Service, Settings, StoreLocation } from '@/lib/types';
import { slotsForDay, type BookingException, type BookingRules, type DaySlot } from '@/admin/components/appointments/rules';
import { addDays, dayKey, startOfDay } from '@/admin/components/appointments/dates';

/** `?sherbimi=` aliases (also the booking-modal service keys) → seeded service ids. */
const ALIASES: Record<string, string> = {
  exam: 'sv-kontrolli',
  kontroll: 'sv-kontrolli',
  fitting: 'sv-pershtatja',
  pd: 'sv-pershtatja',
  contacts: 'sv-lente-kontakti',
  lenses: 'sv-lente-kontakti',
  kids: 'sv-femije',
  children: 'sv-femije',
  clinic: 'sv-klinika',
  klinika: 'sv-klinika',
  repair: 'sv-marrja',
  pickup: 'sv-marrja',
};

/** Name match for services renamed / re-created in the CMS (same idea as MeasureForm). */
const NAME_MATCH: Record<string, RegExp> = {
  'sv-kontrolli': /kontroll|exam|pregled/i,
  'sv-pershtatja': /përshtat|fitting|prilago/i,
  'sv-lente-kontakti': /lente kontakti|contact lens|kontaktn/i,
  'sv-femije': /fëmij|child|dec/i,
  'sv-klinika': /klinik|clinic/i,
  'sv-marrja': /marrja|riparim|repair|popravk/i,
};

/** Resolve `?sherbimi=<id | alias | id without "sv-">` to a bookable service. */
export function resolveService(param: string | null | undefined, services: Service[]): Service | undefined {
  const key = (param ?? '').trim().toLowerCase();
  if (!key) return undefined;
  const direct = services.find((s) => s.id === key) ?? services.find((s) => s.id === `sv-${key}`);
  if (direct) return direct;
  const id = ALIASES[key];
  if (!id) return undefined;
  const re = NAME_MATCH[id];
  return services.find((s) => s.id === id) ?? (re ? services.find((s) => re.test(`${s.name.sq} ${s.name.en} ${s.name.me}`)) : undefined);
}

/** Services the public can book: at least one staff member and a positive duration. */
export const bookable = (s: Service) => s.durationMin > 0 && s.staffIds.length > 0;

/** Card photo per seeded service (CMS-added services fall back to an icon). */
export const SERVICE_IMAGE: Record<string, string> = {
  'sv-kontrolli': '/images/s/kontrolli.webp',
  'sv-pershtatja': '/images/s/pershtatja.webp',
  'sv-lente-kontakti': '/images/misc/lens.webp',
  'sv-femije': '/images/hero/family.webp',
  'sv-klinika': '/images/s/klinika.webp',
  'sv-marrja': '/images/s/riparime.webp',
};

/** The store a service is performed at (service.location → settings.locations, else the default store). */
export function locationOf(service: Service | undefined, settings: Settings): StoreLocation | undefined {
  const list = settings.locations ?? [];
  return list.find((l) => l.id === service?.location) ?? list.find((l) => l.isDefault) ?? list[0];
}

export interface Ctx {
  bookings: Booking[];
  services: Service[];
  rules: BookingRules;
  now: number;
}

export interface DayInfo {
  key: string;
  date: Date;
  open: boolean;
  exception?: BookingException;
  /** Bookable start times (free) */
  free: number;
  /** Offered slots still in the future (free + taken) */
  slots: DaySlot[];
}

/** Gone = in the past or inside the minimum notice — hidden, not shown as "taken". */
const gone = (s: DaySlot) => !s.check.ok && (s.check.reason === 'past' || s.check.reason === 'notice');
export const isFree = (s: DaySlot) => s.check.ok && !!s.staffId;

export function dayInfo(day: Date, service: Service, ctx: Ctx): DayInfo {
  const key = dayKey(day);
  const { window, slots } = slotsForDay(key, service, '', { ...ctx, web: true });
  const visible = slots.filter((s) => !gone(s));
  return { key, date: startOfDay(day), open: window.open, exception: window.exception, free: visible.filter(isFree).length, slots: visible };
}

/** `count` consecutive days starting `offset` days from today. */
export function daysFrom(now: number, offset: number, count: number) {
  const first = addDays(startOfDay(now), offset);
  return Array.from({ length: count }, (_, i) => addDays(first, i));
}

/** First free slot within `horizon` days (service cards: "Termini i parë i lirë"). */
export function firstFree(service: Service, ctx: Ctx, horizon = 28): DaySlot | undefined {
  for (const d of daysFrom(ctx.now, 0, horizon)) {
    const slot = dayInfo(d, service, ctx).slots.find(isFree);
    if (slot) return slot;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Phone                                                               */
/* ------------------------------------------------------------------ */
/** Digits of a phone number without the international / trunk prefix: "+383 44 120 456" and "044 120 456" → "44120456". */
export function phoneKey(v: string | undefined) {
  let d = (v ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('383')) d = d.slice(3);
  return d.replace(/^0+/, '');
}

/** Same rule as MeasureForm: at least 8 digits; at most 15 (E.164). */
export const validPhone = (v: string) => {
  const n = v.replace(/\D/g, '').length;
  return n >= 8 && n <= 15;
};

export const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

/* ------------------------------------------------------------------ */
/* Calendar file (.ics)                                                */
/* ------------------------------------------------------------------ */
const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');

/** RFC 5545 line folding: lines longer than 75 octets continue on the next line after a space. */
function fold(line: string) {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > 73) {
      out.push(cur);
      cur = ' ';
      bytes = 1;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join('\r\n');
}

export function buildIcs(ev: { uid: string; start: string; durationMin: number; title: string; location: string; description: string; alarm: string; tentative?: boolean }) {
  const start = new Date(ev.start);
  const end = new Date(start.getTime() + ev.durationMin * 60000);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Optika Miftari//Rezervime//SQ',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${ev.uid}@optikamiftari.com`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(ev.title)}`,
    `LOCATION:${icsText(ev.location)}`,
    `DESCRIPTION:${icsText(ev.description)}`,
    `STATUS:${ev.tentative ? 'TENTATIVE' : 'CONFIRMED'}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(ev.alarm)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Hand the .ics to the browser (download / "open with Calendar" on phones). */
export function downloadIcs(filename: string, ics: string) {
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
