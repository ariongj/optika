// Calendar date helpers for the appointments module (PDF pp.45–46).
// All maths is done in LOCAL time with setDate/setHours, so the week that contains the
// summer/winter-time switch (last Sunday of October / March) still lays out correctly.
//
// Opening hours and appointment times are the shop's wall clock (settings.timezone, Europe/Belgrade), not the
// visitor's. The convention here:
//   - a Date object is a WALL date: its local fields are read as-is (calendar days, grid days);
//   - an ISO string with a time, or a number, is an INSTANT: it is read on the shop's clock;
//   - a "YYYY-MM-DD" string is a calendar day.
// In the shop's own time zone (the staff, and most visitors) every conversion is the identity.
import type { Lang } from '@/lib/types';

let STORE_TZ = 'Europe/Belgrade';
let localIsStore: boolean | null = null;
const fmt = new Map<string, Intl.DateTimeFormat>();

/** Set from settings.timezone at the app root; an unknown zone name is ignored. */
export function setStoreZone(tz?: string | null) {
  if (!tz || tz === STORE_TZ) return;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
  } catch {
    return;
  }
  STORE_TZ = tz;
  localIsStore = null;
}

/** True when the browser's clock is the shop's (then nothing needs converting). */
export function inStoreZone() {
  if (localIsStore == null) {
    try {
      localIsStore = Intl.DateTimeFormat().resolvedOptions().timeZone === STORE_TZ;
    } catch {
      localIsStore = true;
    }
  }
  return localIsStore;
}

function wallParts(t: number) {
  let f = fmt.get(STORE_TZ);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: STORE_TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    fmt.set(STORE_TZ, f);
  }
  const p: Record<string, number> = {};
  for (const x of f.formatToParts(t)) if (x.type !== 'literal') p[x.type] = Number(x.value);
  return { y: p.year, mo: p.month - 1, d: p.day, h: p.hour % 24, mi: p.minute, s: p.second };
}

/** An instant on the shop's clock, as a wall Date (local fields = the shop's date and time). */
export function toStoreWall(instant: string | number | Date) {
  const t = typeof instant === 'number' ? instant : new Date(instant).getTime();
  if (inStoreZone() || !Number.isFinite(t)) return new Date(t);
  const w = wallParts(t);
  return new Date(w.y, w.mo, w.d, w.h, w.mi, w.s);
}

/** The instant at which the shop's clock shows this wall time. */
function storeInstant(y: number, mo: number, d: number, h: number, mi: number) {
  if (inStoreZone()) return new Date(y, mo, d, h, mi).getTime();
  const utc = Date.UTC(y, mo, d, h, mi);
  const offset = (t: number) => {
    const w = wallParts(t);
    return Date.UTC(w.y, w.mo, w.d, w.h, w.mi, w.s) - Math.floor(t / 1000) * 1000;
  };
  return utc - offset(utc - offset(utc));
}

/** Date → itself (wall); "YYYY-MM-DD" → that day; ISO instant / number → the shop's wall time. */
export function wallDate(d: Date | number | string): Date {
  if (d instanceof Date) return new Date(d);
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return parseDay(d);
  return toStoreWall(d);
}

/** Monday = 0 … Sunday = 6 */
export const weekdayIndex = (d: Date) => (d.getDay() + 6) % 7;

export function startOfDay(d: Date | number | string): Date {
  const x = wallDate(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function mondayOf(d: Date | number | string) {
  const x = startOfDay(d);
  x.setDate(x.getDate() - weekdayIndex(x));
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "YYYY-MM-DD" of a wall date, or of an instant on the shop's clock */
export function dayKey(d: Date | string | number) {
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const x = wallDate(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

/** "YYYY-MM-DD" → local midnight (not UTC). */
export function parseDay(v: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : startOfDay(v);
}

/** "HH:MM" → minutes after midnight */
export function toMin(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** minutes after midnight → "HH:MM" */
export function fromMin(min: number) {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

/** Minutes after midnight on the shop's clock (an instant) or of a wall Date */
export function minutesOf(iso: string | number | Date) {
  const d = wallDate(iso);
  return d.getHours() * 60 + d.getMinutes();
}

/** Shop day + minutes on the shop's clock → ISO instant */
export function atMinutes(day: string | Date, minutes: number) {
  const d = typeof day === 'string' ? parseDay(day) : startOfDay(day);
  return new Date(storeInstant(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(minutes / 60), minutes % 60)).toISOString();
}

export function hhmm(iso: string | number | Date) {
  return fromMin(minutesOf(iso));
}

export function timeRange(start: string, durationMin: number) {
  const s = new Date(start).getTime();
  return `${hhmm(s)}–${hhmm(s + durationMin * 60000)}`;
}

export function sameDay(a: Date | string, b: Date | string) {
  return dayKey(a) === dayKey(b);
}

/* ------------------------------------------------------------------ */
/* Names — written out so Albanian reads like the proposal ("Hënë 05") */
/* ------------------------------------------------------------------ */
const DAYS: Record<Lang, string[]> = {
  me: ['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja'],
  sq: ['Hënë', 'Martë', 'Mërkurë', 'Enjte', 'Premte', 'Shtunë', 'Diel'],
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
};
const DAYS_SHORT: Record<Lang, string[]> = {
  me: ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'],
  sq: ['Hën', 'Mar', 'Mër', 'Enj', 'Pre', 'Sht', 'Die'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};
/** ME uses the genitive after a day number ("5. oktobra") */
const MONTHS: Record<Lang, string[]> = {
  me: ['januara', 'februara', 'marta', 'aprila', 'maja', 'juna', 'jula', 'avgusta', 'septembra', 'oktobra', 'novembra', 'decembra'],
  sq: ['janar', 'shkurt', 'mars', 'prill', 'maj', 'qershor', 'korrik', 'gusht', 'shtator', 'tetor', 'nëntor', 'dhjetor'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
const MONTHS_SHORT: Record<Lang, string[]> = {
  me: ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'],
  sq: ['jan', 'shk', 'mar', 'pri', 'maj', 'qer', 'kor', 'gus', 'sht', 'tet', 'nën', 'dhj'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

export const dayName = (i: number, lang: Lang, short = false) => (short ? DAYS_SHORT : DAYS)[lang][i];

/** "Hënë 05" / "Pon 05" — calendar column header */
export function dayHeader(d: Date, lang: Lang, short = false) {
  return `${dayName(weekdayIndex(d), lang, short)} ${pad(d.getDate())}`;
}

/** "05 tetor" / "5. oktobra" / "5 October" */
export function dayMonth(d: Date, lang: Lang, short = false) {
  const m = (short ? MONTHS_SHORT : MONTHS)[lang][d.getMonth()];
  if (lang === 'me') return `${d.getDate()}. ${m}`;
  if (lang === 'sq') return `${pad(d.getDate())} ${m}`;
  return `${d.getDate()} ${m}`;
}

/** "E mërkurë, 07 tetor 2026" style long date */
export function longDate(d: Date | string, lang: Lang) {
  const x = wallDate(d);
  const name = dayName(weekdayIndex(x), lang);
  return `${name}, ${dayMonth(x, lang)} ${x.getFullYear()}`;
}

/** Range label for a week: "05–10 tetor" · "28 shtator – 03 tetor" */
export function rangeLabel(from: Date, to: Date, lang: Lang) {
  const sameMonth = from.getMonth() === to.getMonth();
  if (!sameMonth) return `${dayMonth(from, lang, true)} – ${dayMonth(to, lang, true)}`;
  const m = MONTHS[lang][to.getMonth()];
  if (lang === 'me') return `${from.getDate()}–${to.getDate()}. ${m}`;
  if (lang === 'sq') return `${pad(from.getDate())}–${pad(to.getDate())} ${m}`;
  return `${from.getDate()}–${to.getDate()} ${m}`;
}

/** ISO week number (for the "W41" hint) */
export function isoWeek(d: Date) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - dow);
  const y0 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil(((x.getTime() - y0.getTime()) / 86400000 + 1) / 7);
}
