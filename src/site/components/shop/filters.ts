import type { Badge, Category, L10n, Lang, Product } from '@/lib/types';
import { basePrice, isOnSale } from '@/lib/pricing';
import { rxReady } from '@/site/components/product/optical';

/* ------------------------------------------------------------------ */
/* Sorting (synced to ?sort=…)                                         */
/* ------------------------------------------------------------------ */
export type SortKey = 'popular' | 'new' | 'priceAsc' | 'priceDesc' | 'name';

export const SORTS: { key: SortKey; param: string | null }[] = [
  { key: 'popular', param: null },
  { key: 'new', param: 'me-te-rejat' },
  { key: 'priceAsc', param: 'cmimi-rritje' },
  { key: 'priceDesc', param: 'cmimi-zbritje' },
  { key: 'name', param: 'emri' },
];

export const sortFromParam = (v: string | null): SortKey => SORTS.find((s) => s.param === v)?.key ?? 'popular';
export const sortToParam = (k: SortKey) => SORTS.find((s) => s.key === k)?.param ?? null;

const COLLATOR: Record<Lang, string> = { me: 'sr-Latn', sq: 'sq', en: 'en' };

export function sortProducts(list: Product[], sort: SortKey, name: (v: L10n) => string, lang: Lang) {
  const out = [...list];
  switch (sort) {
    case 'new':
      return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case 'priceAsc':
      return out.sort((a, b) => basePrice(a) - basePrice(b));
    case 'priceDesc':
      return out.sort((a, b) => basePrice(b) - basePrice(a));
    case 'name': {
      const coll = new Intl.Collator(COLLATOR[lang], { sensitivity: 'base' });
      return out.sort((a, b) => coll.compare(name(a.name), name(b.name)));
    }
    default:
      return out.sort((a, b) => b.sold - a.sold || Number(b.featured) - Number(a.featured));
  }
}

/* ------------------------------------------------------------------ */
/* Product facets                                                      */
/* ------------------------------------------------------------------ */
export type Avail = 'stock' | 'order';
/** Eyewear features — each one narrows the list (AND). */
export type Feature = 'rx' | 'polarised' | 'care';
export type BadgeKey = Extract<Badge, 'new' | 'bestseller' | 'premium'>;

/** In stock vs. made to order (prescription lenses: stock ≥ 999 marks "made in our lab on demand"). */
export const availOf = (p: Product): Avail => (!p.quoteOnly && p.stock > 0 && p.stock < 999 ? 'stock' : 'order');
export const hasCare = (p: Product) => !!p.installation?.available;

const specText = (p: Product, re: RegExp) =>
  p.specs
    .filter((s) => re.test(`${s.label.en} | ${s.label.sq} | ${s.label.me}`))
    .map((s) => `${s.value.en} | ${s.value.sq} | ${s.value.me}`)
    .join(' | ');

const isPolarised = (p: Product) => /polari/i.test(`${specText(p, /lens|lente|sočiv|coating|shtres|sloj/i)} ${p.name.en} ${p.short.en}`);

export function hasFeature(p: Product, f: Feature) {
  if (f === 'rx') return rxReady(p);
  if (f === 'polarised') return isPolarised(p);
  return hasCare(p);
}

export const AVAILS: Avail[] = ['stock', 'order'];
export const FEATURES: Feature[] = ['rx', 'polarised', 'care'];
export const BADGES: BadgeKey[] = ['new', 'bestseller', 'premium'];

/* ------------------------------------------------------------------ */
/* Frame shape — read from the "Shape / Forma" spec                    */
/* ------------------------------------------------------------------ */
export const SHAPE_ORDER = ['rectangle', 'square', 'round', 'panto', 'aviator', 'cat-eye', 'geometric', 'sport'];

export function shapeOf(p: Product): { key: string; label: L10n } | null {
  const spec = p.specs.find((s) => /^(shape|forma|oblik)$/i.test(s.label.en.trim()) || /^(forma|oblik)$/i.test(s.label.sq.trim()));
  if (!spec) return null;
  const en = spec.value.en.trim().toLowerCase();
  if (!en) return null;
  const key = /sport|wrap|shield/.test(en) ? 'sport' : en.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { key, label: spec.value };
}

/* ------------------------------------------------------------------ */
/* Frame colour families — swatch values grouped into shopper-friendly */
/* families ("Titan i zi", "E zezë mat / tym" → black). Only the frame */
/* part of a "frame / lens" label counts; the hex is a fallback.       */
/* ------------------------------------------------------------------ */
export type ColorFamily = 'black' | 'tortoise' | 'gold' | 'silver' | 'grey' | 'clear' | 'green' | 'blue' | 'rose';

export const FAMILY_ORDER: ColorFamily[] = ['black', 'tortoise', 'gold', 'silver', 'grey', 'clear', 'green', 'blue', 'rose'];

export const FAMILY_SWATCH: Record<ColorFamily, string> = {
  black: '#1d1c1a',
  tortoise: 'radial-gradient(circle at 30% 30%,#c08a4e 0 22%,#7a4a26 45%,#3b2414 75%)',
  gold: 'linear-gradient(135deg,#ecd29b 0%,#c39f62 50%,#9b7a43 100%)',
  silver: 'linear-gradient(135deg,#f4f5f6 0%,#c4c8cc 45%,#8f959a 100%)',
  grey: '#7d8185',
  clear: 'linear-gradient(135deg,#ffffff 0%,#ece8e1 55%,#d6d0c4 100%)',
  green: '#5f6b52',
  blue: '#34486a',
  rose: 'linear-gradient(135deg,#e4b7a5 0%,#c98e7c 55%,#8c3b38 100%)',
};

/** Families whose swatch is light enough to need a dark check mark. */
export const LIGHT_FAMILIES: ColorFamily[] = ['gold', 'silver', 'clear', 'rose'];

const RULES: [RegExp, ColorFamily][] = [
  [/zlat|gold|\bar\b|šampanj|sampanj|champagne|shampanj/, 'gold'],
  [/roze|rozë|\brose\b|rubin|ruby|crven|\bred\b|kuq/, 'rose'],
  [/\bhrom|chrome|\bkrom|srebr|silver|argjend|čelik|celik|steel|inox/, 'silver'],
  [/kornjač|kornjac|tortoise|breshk|havan|ćilibar|cilibar|amber|qelibar|karamel|caramel|braon|brown|kafe/, 'tortoise'],
  [/\bsiv|grey|gray|\bgri\b|grafit|graphite|gunmetal|\bdim\b|smoke|\btym|ledeno|\bice\b|akull/, 'grey'],
  [/\bcrn|black|zez|\bi zi\b|\bner[oa]\b/, 'black'],
  [/providn|clear|tejdukshm|kristal|crystal|transparent/, 'clear'],
  [/zelen|green|jeshil|maslin|olive|ulli|šumsk|sumsk|forest|pyjor/, 'green'],
  [/plav|blue|navy|teget|\bblu\b|cobalt|kobalt/, 'blue'],
];

/** The frame half of "Frame / lens" swatch labels. */
const frameOnly = (s: string) => s.split('/')[0];

function familiesIn(text: string): ColorFamily[] {
  const s = text.toLowerCase();
  return RULES.filter(([re]) => re.test(s)).map(([, f]) => f);
}

function familyFromHex(hex: string | undefined): ColorFamily | null {
  const m = hex?.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  if (l > 0.88) return 'clear';
  if (l < 0.16) return 'black';
  if (s < 0.12) return l > 0.7 ? 'silver' : 'grey';
  if (h >= 18 && h < 52) return l > 0.65 ? 'gold' : 'tortoise';
  if (h >= 70 && h < 170) return 'green';
  if (h >= 170 && h < 260) return 'blue';
  if (h < 18 || h >= 330) return 'rose';
  return null;
}

export function colorFamilies(label: L10n, hex?: string): ColorFamily[] {
  const found = familiesIn(`${frameOnly(label.me)} | ${frameOnly(label.en)} | ${frameOnly(label.sq)}`);
  if (found.length) return found;
  const fam = familyFromHex(hex);
  return fam ? [fam] : [];
}

/** Frame colour families a product comes in (its `color` option; lens tints don't count). */
export function productColors(p: Product): ColorFamily[] {
  const out = new Set<ColorFamily>();
  const color = p.options.find((o) => o.id === 'color');
  const swatches = color ? [color] : p.options.filter((o) => o.type === 'swatch' && o.id !== 'tint');
  for (const o of swatches) for (const v of o.values) colorFamilies(v.label, v.swatch).forEach((f) => out.add(f));
  return FAMILY_ORDER.filter((f) => out.has(f));
}

/* ------------------------------------------------------------------ */
/* Filter state + matching                                             */
/* ------------------------------------------------------------------ */
export interface Filters {
  /** Category ids — only used on the all-products view */
  cats: string[];
  /** [min, max] in EUR; null = full range */
  price: [number, number] | null;
  avail: Avail[];
  feats: Feature[];
  badges: BadgeKey[];
  colors: ColorFamily[];
  shapes: string[];
}

export const EMPTY_FILTERS: Filters = { cats: [], price: null, avail: [], feats: [], badges: [], colors: [], shapes: [] };

export type Facet = 'cats' | 'price' | 'avail' | 'sale' | 'feats' | 'badges' | 'colors' | 'shapes';

export interface MatchCtx {
  sale: boolean;
  colors: Map<string, ColorFamily[]>;
}

export function passes(p: Product, f: Filters, ctx: MatchCtx, skip?: Facet) {
  if (skip !== 'cats' && f.cats.length && !f.cats.includes(p.categoryId)) return false;
  if (skip !== 'sale' && ctx.sale && !isOnSale(p)) return false;
  if (skip !== 'price' && f.price) {
    const v = basePrice(p);
    if (v < f.price[0] || v > f.price[1]) return false;
  }
  if (skip !== 'avail' && f.avail.length && !f.avail.includes(availOf(p))) return false;
  if (skip !== 'feats' && f.feats.some((x) => !hasFeature(p, x))) return false;
  if (skip !== 'badges' && f.badges.length && !f.badges.some((b) => p.badges.includes(b))) return false;
  if (skip !== 'colors' && f.colors.length && !(ctx.colors.get(p.id) ?? []).some((c) => f.colors.includes(c))) return false;
  if (skip !== 'shapes' && f.shapes.length && !f.shapes.includes(shapeOf(p)?.key ?? '')) return false;
  return true;
}

export function activeCount(f: Filters, sale: boolean) {
  return f.cats.length + (f.price ? 1 : 0) + f.avail.length + f.feats.length + f.badges.length + f.colors.length + f.shapes.length + (sale ? 1 : 0);
}

export interface FacetData {
  cats: { id: string; count: number }[];
  avail: Record<Avail, number>;
  sale: number;
  feats: { id: Feature; count: number }[];
  badges: { id: BadgeKey; count: number }[];
  colors: { id: ColorFamily; count: number }[];
  shapes: { id: string; label: L10n; count: number }[];
  /** Effective prices of products matching every filter except price — feeds the histogram */
  prices: number[];
  bounds: [number, number];
}

/**
 * Facet counts, each computed against every *other* active filter — so a
 * count always tells the shopper how many results that choice would give.
 */
export function computeFacets(scope: Product[], f: Filters, ctx: MatchCtx, categories: Category[]): FacetData {
  const count = (skip: Facet, pred: (p: Product) => boolean) => scope.reduce((n, p) => (passes(p, f, ctx, skip) && pred(p) ? n + 1 : n), 0);

  const famPresent = new Set<ColorFamily>();
  const shapes = new Map<string, L10n>();
  for (const p of scope) {
    (ctx.colors.get(p.id) ?? []).forEach((c) => famPresent.add(c));
    const s = shapeOf(p);
    if (s && !shapes.has(s.key)) shapes.set(s.key, s.label);
  }
  const shapeKeys = [...shapes.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

  const priced = (ctx.sale ? scope.filter(isOnSale) : scope).map(basePrice);
  const lo = priced.length ? Math.floor(Math.min(...priced)) : 0;
  const hi = priced.length ? Math.ceil(Math.max(...priced)) : 0;

  return {
    cats: categories.map((c) => ({ id: c.id, count: count('cats', (p) => p.categoryId === c.id) })),
    avail: { stock: count('avail', (p) => availOf(p) === 'stock'), order: count('avail', (p) => availOf(p) === 'order') },
    sale: count('sale', isOnSale),
    // features are AND-ed: a feature's count keeps the other selected features applied
    feats: FEATURES.filter((x) => scope.some((p) => hasFeature(p, x))).map((x) => ({ id: x, count: count('feats', (p) => [...f.feats, x].every((y) => hasFeature(p, y))) })),
    badges: BADGES.filter((b) => scope.some((p) => p.badges.includes(b))).map((b) => ({ id: b, count: count('badges', (p) => p.badges.includes(b)) })),
    colors: FAMILY_ORDER.filter((c) => famPresent.has(c)).map((c) => ({ id: c, count: count('colors', (p) => (ctx.colors.get(p.id) ?? []).includes(c)) })),
    shapes: shapeKeys.map((k) => ({ id: k, label: shapes.get(k)!, count: count('shapes', (p) => shapeOf(p)?.key === k) })),
    prices: scope.filter((p) => passes(p, f, ctx, 'price')).map(basePrice),
    bounds: [lo, Math.max(hi, lo + 1)],
  };
}

const rank = (k: string) => {
  const i = SHAPE_ORDER.indexOf(k);
  return i < 0 ? 99 : i;
};

/* ------------------------------------------------------------------ */
/* Price slider scale — lens packages start around 80 €, frames run to */
/* ~500 €, so a gentle power curve gives the cheap end enough travel.  */
/* ------------------------------------------------------------------ */
export function priceScale(lo: number, hi: number) {
  const span = Math.max(1, hi - lo);
  const ratio = hi / Math.max(lo, 1);
  const k = ratio > 12 ? 2.4 : ratio > 4 ? 1.6 : 1;
  const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
  return {
    toValue: (pos: number) => lo + span * Math.pow(clamp01(pos), k),
    toPos: (v: number) => Math.pow(clamp01((v - lo) / span), 1 / k),
  };
}

/** Round slider values to steps a person would type: 1 € → 5 € → 10 €. */
export function nicePrice(v: number) {
  if (v < 100) return Math.round(v);
  if (v < 1000) return Math.round(v / 5) * 5;
  return Math.round(v / 10) * 10;
}
