import type { Lang, Unit } from './types';

const LOCALE: Record<Lang, string> = { me: 'de-DE', sq: 'de-DE', en: 'en-IE' };
const DATE_LOCALE: Record<Lang, string> = { me: 'sr-Latn', sq: 'sq-AL', en: 'en-GB' };

// Building an Intl formatter costs far more than using one (a shop grid formats hundreds of prices per render),
// so each locale + options combination is built once and reused.
const FORMATTERS = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();
function numberFormat(locale: string, opts: Intl.NumberFormatOptions) {
  const key = `n|${locale}|${JSON.stringify(opts)}`;
  let f = FORMATTERS.get(key) as Intl.NumberFormat | undefined;
  if (!f) FORMATTERS.set(key, (f = new Intl.NumberFormat(locale, opts)));
  return f;
}
function dateFormat(locale: string, opts: Intl.DateTimeFormatOptions) {
  const key = `d|${locale}|${JSON.stringify(opts)}`;
  let f = FORMATTERS.get(key) as Intl.DateTimeFormat | undefined;
  if (!f) FORMATTERS.set(key, (f = new Intl.DateTimeFormat(locale, opts)));
  return f;
}

/** 1.249,00 € (ME/SQ) — €1,249.00 (EN) */
export function money(value: number, lang: Lang = 'sq', opts: { decimals?: boolean } = {}) {
  const d = (opts.decimals ?? true) ? 2 : 0;
  return numberFormat(LOCALE[lang], { style: 'currency', currency: 'EUR', minimumFractionDigits: d, maximumFractionDigits: d }).format(value);
}

/** Compact money for charts/KPIs: 12,4k € */
export function moneyCompact(value: number, lang: Lang = 'sq') {
  if (Math.abs(value) < 10000) return money(value, lang, { decimals: false });
  return numberFormat(LOCALE[lang], { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function num(value: number, lang: Lang = 'sq', maxDecimals = 2) {
  return numberFormat(LOCALE[lang], { maximumFractionDigits: maxDecimals }).format(value);
}

/* Chrome ships without Albanian Intl data: `Intl.DateTimeFormat('sq-AL')` silently falls back to English
   ("9 October 2026"). When the runtime can't do Albanian, format in en-GB (same day-month-year order) and swap
   the month and weekday names for the CLDR Albanian ones. Works with any options, including timeZone. */
let sqNative: boolean | undefined;
function hasNativeAlbanian() {
  if (sqNative === undefined) {
    try {
      sqNative = Intl.DateTimeFormat.supportedLocalesOf(['sq']).length > 0;
    } catch {
      sqNative = false;
    }
  }
  return sqNative;
}
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const EN_MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Sept', 'Oct', 'Nov', 'Dec'];
const SQ_MONTHS = ['janar', 'shkurt', 'mars', 'prill', 'maj', 'qershor', 'korrik', 'gusht', 'shtator', 'tetor', 'nëntor', 'dhjetor'];
const SQ_MONTHS_SHORT = ['jan', 'shk', 'mar', 'pri', 'maj', 'qer', 'korr', 'gush', 'sht', 'sht', 'tet', 'nën', 'dhj'];
const EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EN_DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SQ_DAYS = ['e diel', 'e hënë', 'e martë', 'e mërkurë', 'e enjte', 'e premte', 'e shtunë'];
const SQ_DAYS_SHORT = ['Die', 'Hën', 'Mar', 'Mër', 'Enj', 'Pre', 'Sht'];

function sqParts(d: Date, opts: Intl.DateTimeFormatOptions) {
  return dateFormat('en-GB', opts)
    .formatToParts(d)
    .map((p) => {
      if (p.type === 'month') {
        const long = EN_MONTHS.indexOf(p.value);
        if (long >= 0) return SQ_MONTHS[long];
        const short = EN_MONTHS_SHORT.indexOf(p.value);
        if (short >= 0) return SQ_MONTHS_SHORT[short];
      }
      if (p.type === 'weekday') {
        const long = EN_DAYS.indexOf(p.value);
        if (long >= 0) return SQ_DAYS[long];
        const short = EN_DAYS_SHORT.indexOf(p.value);
        if (short >= 0) return SQ_DAYS_SHORT[short];
      }
      return p.value;
    })
    .join('');
}

export function date(iso: string | Date, lang: Lang = 'sq', opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  try {
    if (lang === 'sq' && !hasNativeAlbanian()) return sqParts(d, opts);
    return dateFormat(DATE_LOCALE[lang], opts).format(d);
  } catch {
    return dateFormat('en-GB', opts).format(d);
  }
}

export function dateTime(iso: string, lang: Lang = 'sq') {
  return date(iso, lang, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const REL: Record<Lang, { now: string; min: string; h: string; d: string; ago: (s: string) => string }> = {
  me: { now: 'upravo sada', min: 'min', h: 'h', d: 'd', ago: (s) => `pre ${s}` },
  sq: { now: 'tani', min: 'min', h: 'orë', d: 'ditë', ago: (s) => `para ${s}` },
  en: { now: 'just now', min: 'min', h: 'h', d: 'd', ago: (s) => `${s} ago` },
};

export function timeAgo(iso: string, lang: Lang = 'sq') {
  const r = REL[lang];
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return r.now;
  if (diff < 3600) return r.ago(`${Math.floor(diff / 60)} ${r.min}`);
  if (diff < 86400) return r.ago(`${Math.floor(diff / 3600)} ${r.h}`);
  if (diff < 86400 * 30) return r.ago(`${Math.floor(diff / 86400)} ${r.d}`);
  return date(iso, lang);
}

const UNIT_LABEL: Record<Lang, Record<Unit, string>> = {
  me: { kom: 'kom', m2: 'm²', m: 'm', set: 'par' },
  sq: { kom: 'copë', m2: 'm²', m: 'm', set: 'palë' },
  en: { kom: 'pc', m2: 'm²', m: 'm', set: 'pair' },
};

export function unitLabel(unit: Unit, lang: Lang = 'sq') {
  return UNIT_LABEL[lang][unit];
}

/** "/ m²" style suffix for prices */
export function perUnit(unit: Unit, lang: Lang = 'sq') {
  return `/ ${unitLabel(unit, lang)}`;
}
