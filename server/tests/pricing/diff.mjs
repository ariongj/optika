/**
 * Differential test: the PHP pricing port (server/api/lib/pricing.php) against the real TypeScript engine.
 *
 *   node server/tests/pricing/diff.mjs                    (run from the repo root, i.e. the optika/ folder)
 *   node server/tests/pricing/diff.mjs --cases 20000 --seed 7 --php C:/path/to/php.exe
 *
 * 1. Bundles priceCart (src/lib/pricing.ts), normalizeCode/allocateCents (src/lib/discounts.ts) and createSeed
 *    (src/data/seed.ts) with Vite (vite.ssr.config.mjs → .cache/ts; dist/ and the app config are never touched).
 * 2. Builds the hand-written checks of src/lib/__tests__/discounts.check.ts as whole carts, explicit local-delivery
 *    and free-shipping-rule cases, and --cases (default 6000) random but realistic cases from two seeds: seed and
 *    synthetic products (m²/pack/metre units, sale prices, option deltas, installation, quote-only), codes in any
 *    case/spacing (valid, invalid, duplicate, several), both delivery methods, every zone city, local-delivery
 *    towns and diacritic variants, `now` across and exactly on the discount windows (ms, ISO, offsets, date-only),
 *    all three languages, random collections/rules, legacy coupons without discounts, settings variants and
 *    rule sets above 12 candidates (greedy path).
 * 3. Prices every case in TS and in ONE php process (run.php), compares the JSON results (TS lines: product →
 *    productId; {} and [] are equal only when empty), plus normalizeCode and allocateCents directly.
 *    Prints a summary and the first diffs with JSON paths; writes each diff to .cache/; exit code 1 on any mismatch.
 *
 * PHP: --php <exe>, else $PHP, else C:/Users/A/Documents/MM/tmp/php83/php.exe when present, else `php` on PATH.
 * mbstring is loaded from <php dir>/ext when the binary lacks it; intl is never loaded (production may lack it).
 * Both sides run in UTC (date-time strings without an offset are local time in JS and in the port).
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';

process.env.TZ = 'UTC';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, '.cache');
const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : dflt;
};
const N = Number(arg('cases', 6000));
const SEED = Number(arg('seed', 20261116));
const DAY = 86400000;

/* ------------------------------------------------------------------ */
/* 1. the real engine + seed                                           */
/* ------------------------------------------------------------------ */
mkdirSync(CACHE, { recursive: true });
for (const f of readdirSync(CACHE)) if (/^mismatch-\d+\.json$/.test(f)) rmSync(join(CACHE, f)); // stale diffs of an earlier run
const t0 = Date.now();
await build({ configFile: join(HERE, 'vite.ssr.config.mjs'), logLevel: 'warn' });
const ts = await import(pathToFileURL(join(CACHE, 'ts', 'entry.mjs')).href);
console.log(`bundle: ${((Date.now() - t0) / 1000).toFixed(1)} s`);

const clone = (v) => JSON.parse(JSON.stringify(v));
const seeds = ['2026-11-16T09:00:00.000Z', '2026-03-02T15:30:00.000Z'].map((iso) => {
  const t = Date.parse(iso);
  return { iso, t, db: clone(ts.createSeed(new Date(t))) };
});
const A = seeds[0].db;

/* ------------------------------------------------------------------ */
/* random helpers (mulberry32 — reproducible with --seed)              */
/* ------------------------------------------------------------------ */
let state = SEED >>> 0;
const R = () => {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (a, b) => a + Math.floor(R() * (b - a + 1));
const pick = (arr) => arr[Math.floor(R() * arr.length)];
const chance = (p) => R() < p;
const sample = (arr, n) => {
  const c = [...arr];
  const out = [];
  while (out.length < n && c.length) out.push(c.splice(Math.floor(R() * c.length), 1)[0]);
  return out;
};
const set = (o, k, v) => {
  if (v === undefined) delete o[k];
  else o[k] = v;
  return o;
};
const iso = (ms) => new Date(ms).toISOString();
function offsetIso(ms, off, colon = true) {
  const a = Math.abs(off);
  const hh = String(Math.floor(a / 60)).padStart(2, '0');
  const mm = String(a % 60).padStart(2, '0');
  return `${iso(ms + off * 60000).slice(0, 23)}${off < 0 ? '-' : '+'}${hh}${colon ? ':' : ''}${mm}`;
}

/* ------------------------------------------------------------------ */
/* pools shared by many cases (written once to the cases file)         */
/* ------------------------------------------------------------------ */
const pools = { products: [], settings: [], discounts: [], collections: [], coupons: [] };
const addPool = (kind, value) => pools[kind].push(value) - 1;

const categories = [...new Set(A.products.map((p) => p.categoryId))];
const allTags = [...new Set(A.products.flatMap((p) => p.tags ?? []))];
const vendors = [...new Set(A.products.map((p) => p.vendor).filter(Boolean))];
const zoneCities = A.settings.shippingZones.flatMap((z) => z.cities);

/* ---- products ---- */
const PRICES = [19.99, 0.1, 0.3, 33.33, 1.005, 2.675, 12.345, 100, 149.99, 150, 89.9, 249.5, 999.99, 4.35, 0.07, 1234.56, 7, 45.45, 0.30000000000000004, 1e-7, 1234567.89, 79.995, 10.9, 3.33];
const DELTAS = [0, 0, 0, 80, 30, -5, 12.5, 0.1, 0.2, 2.675, 0.005, undefined, 210];
const INSTALLS = [null, undefined, { available: true, price: 19 }, { available: true, price: 7.5 }, { available: false, price: 10 }, { available: true, price: 0 }, { available: true, price: 0.333 }, { available: true, price: 12.345 }];
const TAG_EXTRA = ['Titan', 'FEMRA', ' meshkuj', 'Đak', 'Çelik', 'ëmbël', 'ﬁne', 'ǅuk'];
const extraOption = () => ({
  id: pick(['extra', 'size', 'lens']),
  name: pick([{ me: '', sq: '', en: 'Extra' }, { me: 'Dodatak', sq: ' ', en: '' }, { me: '', sq: '', en: '' }, { me: 'Veličina', sq: 'Madhësia', en: 'Size' }]),
  type: 'button',
  values: [
    { id: 'e1', label: { me: 'Jedan', sq: '', en: '' }, priceDelta: 5 },
    { id: 'e2', label: { me: '', sq: '', en: '' }, priceDelta: 0 },
    { id: 'e3', label: { me: 'Tri', sq: 'Tre', en: 'Three' }, priceDelta: 0.15 },
  ],
});
function synthProducts(base, count) {
  const out = [];
  for (let n = 0; n < count; n++) {
    const p = structuredClone(pick(base));
    Object.assign(p, { id: `syn-${n}`, slug: `syn-${n}`, sku: `SYN-${n}`, categoryId: pick(categories) });
    p.unit = pick(['kom', 'kom', 'set', 'm2', 'm2', 'm']);
    set(p, 'packSize', p.unit === 'm2' ? (chance(0.85) ? pick([1.44, 2.13, 0.5, 1, 1.75, 2.2, 1.29, 0.96, 2.22]) : undefined) : chance(0.2) ? pick([1.5, 2]) : undefined);
    p.price = chance(0.5) ? pick(PRICES) : int(100, 99999) / 100;
    const sp = R();
    set(p, 'salePrice', sp < 0.3 ? undefined : sp < 0.4 ? null : sp < 0.7 ? Math.round(p.price * pick([0.8, 0.75, 0.9, 0.5]) * 100) / 100 : sp < 0.78 ? p.price : sp < 0.84 ? p.price + 5 : sp < 0.9 ? 0 : sp < 0.94 ? -1 : Math.round((p.price - 0.01) * 100) / 100);
    for (const o of p.options ?? []) for (const v of o.values) set(v, 'priceDelta', pick(DELTAS));
    if (chance(0.25)) p.options = [...(p.options ?? []), extraOption()];
    set(p, 'installation', structuredClone(pick(INSTALLS)));
    set(p, 'quoteOnly', chance(0.06) ? true : undefined);
    set(p, 'tags', chance(0.1) ? undefined : sample([...allTags, ...TAG_EXTRA], int(0, 3)));
    set(p, 'vendor', pick([undefined, '', ...vendors.slice(0, 6), 'Đorđe Optik', 'ÇELIK', 'ﬁne frames']));
    p.badges = sample(['new', 'sale', 'bestseller', 'premium'], int(0, 2));
    set(p, 'stock', pick([undefined, 0, 3, 999, 12]));
    p.status = pick(['active', 'active', 'active', 'draft', 'archived']);
    if (chance(0.3)) p.name = pick([{ me: 'Naočare Đ', sq: '', en: '' }, { me: '', sq: ' ', en: 'Frame Ç' }, { me: p.name.me, sq: 'Syze ëmbël', en: p.name.en }, { me: '', sq: '', en: '' }]);
    out.push(p);
  }
  return out;
}
const P0 = addPool('products', A.products);
const synthetic = synthProducts(A.products, 70);
const P1 = addPool('products', [...A.products, ...synthetic]);
const relevantIds = [
  ...A.products.filter((p) => ['cat-dielli', 'cat-optike', 'cat-lente'].includes(p.categoryId)).map((p) => p.id),
  'p-lens-single', 'p-lens-single', 'p-lens-single', 'p-lens-screen',
  ...synthetic.map((p) => p.id),
];

/* ---- settings ---- */
const baseSettings = A.settings;
const S = (patch) => addPool('settings', { ...clone(baseSettings), ...patch });
const LD = (local, more = {}) => ({ ext: { localDelivery: local }, ...more });
const zonesWith = (fees) => baseSettings.shippingZones.map((z, i) => ({ ...z, fee: fees[i] ?? z.fee }));
const SETTINGS = [
  S({}),
  S(LD({ enabled: true, fee: 1.5, area: 'Mitrovicë', v: 2 })),
  S(LD({ enabled: true, fee: 0, area: ' mitrovice ', v: 2 })),
  S(LD({ enabled: true, fee: '2.5', area: 'MITROVICË', v: 2 })),
  S(LD({ enabled: false, fee: 3, area: 'Mitrovicë', v: 2 })),
  S(LD({ enabled: true, fee: -2, area: 'Zveçan', v: 2 })),
  S(LD({ enabled: true, fee: 5, area: '', v: 2 })),
  S({ shippingZones: [], vatRate: 0 }),
  S({ vatRate: 8, shippingZones: zonesWith([2.5, 3.99, 0.1]) }),
  S({ vatRate: 20, shippingZones: zonesWith([0, 3, 4]) }),
  S(LD({ enabled: true, area: 'Prishtinë', v: 2 })),
  S(LD({ enabled: true, fee: 'abc', area: 'Mitrovica', v: 2 })),
  S({ vatRate: '18' }),
  // legacy entries without `v` (readLocalDelivery): free + enabled → off; with a fee → on
  S(LD({ enabled: true, fee: 0, area: 'Mitrovicë' })),
  S(LD({ enabled: true, fee: 2, area: 'Mitrovicë' })),
  S(LD({ enabled: true, area: 'Mitrovicë' })),
  S(LD({ enabled: true, fee: '2', area: 'mitrovicë' })),
  S(LD({ enabled: 1, fee: 0, area: 'Mitrovicë' })),
  S(LD({ enabled: true, fee: 0, area: 'Mitrovicë', v: null })),
  S(LD({ enabled: true, fee: null, area: 'Mitrovicë', v: 1 })),
  S(LD({ enabled: true, fee: 0.5, area: 'Vushtrri' })),
  S(LD({ enabled: false, fee: 0, area: 'Mitrovicë' })),
  S(LD({ enabled: true, fee: -1, area: 'Mitrovicë' })),
  S(LD(null)),
  S({ ext: {} }),
  S(LD({ enabled: true, fee: 2, area: 'Mitrovicë', v: 2 }, { shippingZones: [] })),
  S(LD({ enabled: true, fee: 0, area: 'Mitrovicë', v: 2 }, { vatRate: 8 })),
];
const LOCAL_SETTINGS = SETTINGS.filter((i) => pools.settings[i].ext?.localDelivery);

/* ---- collections ---- */
const CO0 = addPool('collections', A.collections);
const seedCollectionIds = A.collections.map((c) => c.id);
function randRule() {
  const field = pick(['category', 'price', 'compareAt', 'stock', 'status', 'tag', 'title', 'vendor', 'onSale', 'badge', 'color']);
  const ops3 = ['eq', 'neq', 'contains'];
  switch (field) {
    case 'category':
      return { field, op: pick(ops3), value: pick([...categories, 'CAT-DIELLI', ' cat-optike ', 'cat-', 'Cat-Lente']) };
    case 'price':
    case 'compareAt':
      return { field, op: pick(['gt', 'lt', 'eq', 'neq', 'contains']), value: pick(['100', '99,5', ' 150 ', 'abc', '', '0x64', '1e2', '320', '285.45', '79.99', '1,5,0']) };
    case 'stock':
      return { field, op: pick(['gt', 'lt', 'eq', 'neq']), value: pick(['0', '10', '999', '3']) };
    case 'status':
      return { field, op: pick(['eq', 'neq', 'gte']), value: pick(['active', 'ACTIVE', 'draft', 'archived', ' Active ']) };
    case 'tag':
      return { field, op: pick(ops3), value: pick([...allTags.slice(0, 10), 'TITAN', 'titan ', 'Đ', 'dj', 'ëmbël', 'embel', 'ﬁ', 'fi', 'ǅuk', 'dzuk', 'celik']) };
    case 'title':
      return { field, op: pick(ops3), value: pick(['Ray', 'ray-ban', 'Syze', 'Naočare', 'naocare', 'Çelik', 'lente', 'Sun', 'ő', '']) };
    case 'vendor':
      return { field, op: pick(ops3), value: pick([...vendors.slice(0, 5), 'ray-ban', 'RAY-BAN', 'Djordje Optik', 'celik', 'FINE']) };
    case 'onSale':
      return { field, op: pick(['eq', 'neq']), value: pick(['true', 'Yes', 'DA', '0', 'no', ' po ', 'TRUE ', 'false', '1']) };
    case 'badge':
      return { field, op: pick(ops3), value: pick(['sale', 'SALE', 'best', 'new', 'premium']) };
    default:
      return { field, op: 'eq', value: 'red' };
  }
}
function randCollection(id) {
  const base = { id, slug: id, title: { me: id, sq: id, en: id }, description: { me: '', sq: '', en: '' }, image: '', published: true };
  if (chance(0.3)) return { ...base, kind: 'manual', productIds: sample(relevantIds, int(1, 6)), match: 'all', rules: [], sort: 'manual' };
  const rules = Array.from({ length: pick([0, 1, 1, 2, 3]) }, randRule);
  return { ...base, kind: 'smart', productIds: [], match: chance(0.5) ? 'all' : 'any', rules, sort: 'bestselling' };
}
const randCollectionIds = [];
const COLLECTION_POOLS = [CO0];
for (let k = 0; k < 40; k++) {
  const extra = Array.from({ length: int(1, 5) }, (_, j) => randCollection(`rc-${k}-${j}`));
  randCollectionIds.push(...extra.map((c) => c.id));
  COLLECTION_POOLS.push(addPool('collections', [...A.collections, ...extra]));
}
const targetCollectionIds = [...seedCollectionIds, ...seedCollectionIds, ...randCollectionIds.slice(0, 40), 'col-none'];

/* ---- discounts ---- */
const CODE_VOCAB = ['SAVE10', 'Vjeshta5', 'straße', 'STRASSE', 'MIFTARI10', 'ǆungla', 'ÇMIM', 'test 5', 'mıftari', 'DIELLI', 'lab b2b', 'ﬁx10', 'VERA15', undefined, ''];
const PCTS = [5, 10, 12.5, 15, 20, 25, 33.33, 50, 100, 120, 0, -5];
const FIXED = [1, 2.5, 5, 10, 15, 25, 50, 100, 0.01, 1000, 0, -3, 4.99];
const ZONE_IDS = [[], ['z1'], ['z2', 'z3'], ['zX'], ['z1', 'z2', 'z3']];
function randDate(ref, a, b) {
  const ms = ref + Math.round((a + R() * (b - a)) * DAY);
  const f = R();
  if (f < 0.8) return iso(ms);
  if (f < 0.86) return iso(ms).slice(0, 10);
  if (f < 0.91) return offsetIso(ms, pick([60, 120, -240]));
  if (f < 0.93) return offsetIso(ms, 60, false);
  if (f < 0.95) return '';
  if (f < 0.96) return 'soon';
  if (f < 0.98) return iso(ms).replace(/\.\d{3}Z$/, 'Z');
  return iso(ms).replace(/\.\d{3}Z$/, '.5Z');
}
const randTarget = () => {
  const r = R();
  if (r < 0.4) return { scope: 'all', ids: [] };
  if (r < 0.7) return { scope: 'products', ids: sample(relevantIds, int(1, 4)) };
  return { scope: 'collections', ids: sample(targetCollectionIds, int(1, 2)) };
};
const randMinimum = () => {
  const r = R();
  if (r < 0.5) return { type: 'none', value: 0 };
  if (r < 0.8) return { type: 'amount', value: pick([50, 100, 150, 99.99, 250, 30.005, 0, 600]) };
  return { type: 'qty', value: pick([1, 2, 3, 4, 2.5, 0]) };
};
function randBxgy() {
  const side = () => (chance(0.5) ? { scope: 'products', ids: sample(relevantIds, int(1, 4)) } : { scope: 'collections', ids: sample(targetCollectionIds, int(1, 2)) });
  const x = side();
  const y = chance(0.3) ? x : side();
  return { buyIds: x.ids, buyScope: x.scope, buyQty: pick([1, 1, 2, 3, 1.5, 0]), getIds: y.ids, getScope: y.scope, getQty: pick([1, 1, 2]), getType: chance(0.5) ? 'free' : 'percent', getValue: pick([50, 100, 30, 0, 120]), maxUses: pick([0, 1, 2, 5]) };
}
function randDiscount(ref, id, forceAuto = false) {
  const kind = pick(['products', 'products', 'order', 'order', 'bxgy', 'shipping']);
  const method = forceAuto || chance(0.55) ? 'auto' : 'code';
  const valueType = chance(0.55) ? 'percent' : 'fixed';
  const d = {
    id,
    title: `R ${id}`,
    publicTitle: { me: id, sq: id, en: id },
    kind,
    method,
    valueType,
    value: valueType === 'percent' ? pick(PCTS) : pick(FIXED),
    appliesTo: randTarget(),
    minimum: randMinimum(),
    audience: forceAuto || chance(0.85) ? { type: 'all' } : { type: 'segment', ...(chance(0.9) ? { segmentId: pick(['seg-vip', 'seg-b2b', 'seg-none']) } : {}) },
    combines: { products: chance(0.6), order: chance(0.6), shipping: chance(0.7) },
    startsAt: forceAuto ? iso(ref - 30 * DAY) : randDate(ref, -60, 10),
    status: forceAuto ? 'active' : pick(['active', 'active', 'active', 'active', 'draft', 'paused']),
    uses: int(0, 12),
    createdAt: iso(ref - 61 * DAY),
  };
  if (method === 'code') set(d, 'code', pick(CODE_VOCAB));
  if (kind === 'products' && valueType === 'fixed' && chance(0.4)) d.perItem = true;
  if (kind === 'bxgy') d.bxgy = randBxgy();
  if (kind === 'shipping') {
    d.shipping = {};
    if (chance(0.4)) d.shipping.zoneIds = pick(ZONE_IDS);
    if (chance(0.3)) d.shipping.maxRate = pick([3, 2, 0, 10, 2.5]);
  }
  if (!forceAuto && chance(0.15)) d.usageLimit = pick([0, 5, 10, 200]);
  if (chance(0.15)) d.oncePerCustomer = true;
  if (!forceAuto && chance(0.5)) d.endsAt = randDate(ref, -10, 60);
  if (chance(0.04)) set(d, 'combines', pick([undefined, {}, { products: 1, order: 'yes', shipping: 0 }]));
  return d;
}
const DPOOLS = []; // { idx, ref, list, weight }
const addDiscounts = (list, ref, weight = 1) => {
  const idx = addPool('discounts', list);
  DPOOLS.push({ idx, ref, list, weight });
  return idx;
};
for (const s of seeds) addDiscounts(s.db.discounts, s.t, 60);
for (let k = 0; k < 400; k++) {
  const s = pick(seeds);
  const big = chance(0.06);
  const list = [...sample(s.db.discounts, big ? int(0, 3) : int(0, 9))];
  const extra = big ? int(13, 16) : int(0, 8);
  for (let j = 0; j < extra; j++) list.push(randDiscount(s.t, `rd-${k}-${j}`, big));
  addDiscounts(chance(0.5) ? list : sample(list, list.length), s.t);
}
// live automatic free-shipping rules: minimum qty / none / amount, alone and several at once
const shipRule = (id, minimum, more = {}) => ({
  id,
  title: id,
  publicTitle: { me: id, sq: id, en: id },
  kind: 'shipping',
  method: 'auto',
  valueType: 'percent',
  value: 100,
  appliesTo: { scope: 'all', ids: [] },
  minimum,
  audience: { type: 'all' },
  combines: { products: true, order: true, shipping: false },
  startsAt: '2025-06-01T00:00:00.000Z',
  status: 'active',
  uses: 0,
  createdAt: '2025-06-01T00:00:00.000Z',
  ...more,
});
const SHIP_RULES = [
  shipRule('sr-qty2', { type: 'qty', value: 2 }),
  shipRule('sr-qty5', { type: 'qty', value: 5 }),
  shipRule('sr-none', { type: 'none', value: 0 }),
  shipRule('sr-none50', { type: 'none', value: 0 }, { value: 50 }),
  shipRule('sr-amt60', { type: 'amount', value: 60 }),
  shipRule('sr-amt150', { type: 'amount', value: 150 }),
  shipRule('sr-amt0', { type: 'amount', value: 0 }),
  shipRule('sr-fix2', { type: 'amount', value: 30 }, { valueType: 'fixed', value: 2 }),
];
for (let a = 0; a < SHIP_RULES.length; a++) {
  for (let b = a; b < SHIP_RULES.length; b++) {
    for (let c = b; c < SHIP_RULES.length; c++) {
      const rules = [...new Set([SHIP_RULES[a], SHIP_RULES[b], SHIP_RULES[c]])];
      const s = pick(seeds);
      addDiscounts([...rules, ...sample(s.db.discounts.filter((d) => d.kind !== 'shipping'), int(0, 4))], s.t, 0.5);
    }
  }
}
const pickPool = (() => {
  const total = DPOOLS.reduce((s, p) => s + p.weight, 0);
  return () => {
    let x = R() * total;
    for (const p of DPOOLS) if ((x -= p.weight) <= 0) return p;
    return DPOOLS[DPOOLS.length - 1];
  };
})();

/* ---- legacy coupons ---- */
const COUPON_POOLS = seeds.map((s) => addPool('coupons', s.db.coupons));
for (let k = 0; k < 20; k++) {
  const ref = pick(seeds).t;
  const list = Array.from({ length: int(1, 5) }, (_, j) => {
    const c = { id: `rcp-${k}-${j}`, code: pick(['MIFTARI10', 'Miresevini', 'VERA2026', 'KUPON5', 'kupon 5', 'straße', 'ZERO']), type: chance(0.5) ? 'percent' : 'fixed', value: pick([5, 10, 15, 0, 50, 12.5]), active: chance(0.8), uses: int(0, 50) };
    set(c, 'minTotal', pick([undefined, 0, 50, 100, 80]));
    const ex = R();
    set(c, 'expiresAt', ex < 0.3 ? iso(ref - int(1, 60) * DAY) : ex < 0.6 ? iso(ref + int(1, 60) * DAY) : ex < 0.65 ? null : undefined);
    set(c, 'description', pick([undefined, '', 'Kupon']));
    return c;
  });
  COUPON_POOLS.push(addPool('coupons', list));
}

/* ------------------------------------------------------------------ */
/* 2a. hand-written cases (discounts.check.ts as whole carts, …)        */
/* ------------------------------------------------------------------ */
const cases = []; // { name, cart, p, s, opts }
const NOW = '2026-10-05T10:00:00.000Z';
const BASE = {
  id: '', title: '', publicTitle: { me: '', sq: '', en: '' }, kind: 'order', method: 'auto', valueType: 'percent', value: 0,
  appliesTo: { scope: 'all', ids: [] }, minimum: { type: 'none', value: 0 }, audience: { type: 'all' },
  combines: { products: true, order: true, shipping: true }, startsAt: '2026-01-01T00:00:00.000Z', status: 'active', uses: 0, createdAt: '2026-01-01T00:00:00.000Z',
};
const D = (p) => ({ ...BASE, title: p.id, ...p });
const prod = (id, price, extra = {}) => ({
  id, slug: id, sku: id, categoryId: 'cat-test', name: { me: id, sq: id, en: id }, short: { me: '', sq: '', en: '' }, description: { me: '', sq: '', en: '' },
  price, unit: 'kom', stock: 999, images: [], options: [], specs: [], badges: [], featured: false, status: 'active', createdAt: NOW, sold: 0, ...extra,
});
const item = (productId, qty = 1, extra = {}) => ({ key: `${productId}|${qty}`, productId, qty, options: {}, installation: false, ...extra });
const manual = (id, productIds) => ({ id, slug: id, title: { me: id, sq: id, en: id }, description: { me: '', sq: '', en: '' }, image: '', kind: 'manual', productIds, match: 'all', rules: [], sort: 'manual', published: true });
const checkSettings = new Map();
const zoneSettings = (fee) => {
  if (!checkSettings.has(fee)) checkSettings.set(fee, S({ shippingZones: [{ id: 'zc', name: 'Check', cities: ['Checkville'], fee, days: '1' }] }));
  return checkSettings.get(fee);
};
function edge(name, { products, fee = 0, discounts, collections, cart, opts = {} }) {
  const p = addPool('products', products);
  const o = { lang: 'sq', now: NOW, delivery: 'delivery', city: 'Checkville', ...opts };
  if (discounts) o.discounts = { $pool: addPool('discounts', discounts) };
  if (collections) o.collections = { $pool: addPool('collections', collections) };
  cases.push({ name, cart, p, s: zoneSettings(fee), opts: o });
}
const none = { products: false, order: false, shipping: false };
const bxgy = D({ id: 'b2g1', kind: 'bxgy', combines: { products: false, order: true, shipping: true }, bxgy: { buyIds: ['X'], buyScope: 'products', buyQty: 2, getIds: ['Y'], getScope: 'products', getQty: 1, getType: 'free', getValue: 100, maxUses: 1 } });
const M10 = D({ id: 'M10', method: 'code', code: 'MIFTARI10', kind: 'order', valueType: 'percent', value: 10, minimum: { type: 'amount', value: 100 } });
edge('check 01 combination allowed', { products: [prod('A', 100), prod('B', 50)], fee: 5, cart: [item('A'), item('B')], discounts: [D({ id: 'prodA20', kind: 'products', value: 20, appliesTo: { scope: 'products', ids: ['A'] } }), D({ id: 'order10', value: 10 }), D({ id: 'ship', kind: 'shipping', value: 100 })] });
edge('check 02 no combination', { products: [prod('X', 100)], cart: [item('X')], opts: { codes: ['a20', ' B15 '] }, discounts: [D({ id: 'A', method: 'code', code: 'A20', valueType: 'fixed', value: 20, combines: none }), D({ id: 'B', method: 'code', code: 'B15', value: 15, combines: none })] });
edge('check 02 two shipping rules', { products: [prod('X', 100)], fee: 10, cart: [item('X')], opts: { codes: ['SHIP5'] }, discounts: [D({ id: 'shipFree', kind: 'shipping', value: 100 }), D({ id: 'ship5', method: 'code', code: 'SHIP5', kind: 'shipping', valueType: 'fixed', value: 5 })] });
edge('check 03 fixed amount capped', { products: [prod('X', 30)], cart: [item('X')], opts: { codes: ['MINUS50'] }, discounts: [D({ id: 'm50', method: 'code', code: 'MINUS50', valueType: 'fixed', value: 50 })] });
edge('check 03 bxgy', { products: [prod('X', 20), prod('Y', 10)], cart: [item('X', 2), item('Y')], discounts: [bxgy] });
edge('check 03 bxgy without Y', { products: [prod('X', 20), prod('Y', 10)], cart: [item('X', 2)], discounts: [bxgy] });
edge('check 03 bxgy one X', { products: [prod('X', 20), prod('Y', 10)], cart: [item('X'), item('Y')], discounts: [bxgy] });
edge('check 03 bxgy shared X/Y', { products: [prod('A', 50), prod('B', 30)], cart: [item('A', 2), item('B')], collections: [manual('col', ['A', 'B'])], discounts: [D({ id: 'same', kind: 'bxgy', bxgy: { buyIds: ['col'], buyScope: 'collections', buyQty: 2, getIds: ['col'], getScope: 'collections', getQty: 1, getType: 'free', getValue: 100, maxUses: 5 } })] });
edge('check threshold €100.00', { products: [prod('P', 100)], cart: [item('P')], opts: { codes: ['miftari10'] }, discounts: [M10] });
edge('check threshold €99.99', { products: [prod('P', 99.99)], cart: [item('P')], opts: { codes: ['MIFTARI10'] }, discounts: [M10] });
edge('check threshold after product discount', { products: [prod('P', 110)], cart: [item('P')], opts: { codes: ['MIFTARI10'] }, discounts: [M10, D({ id: 'auto15', kind: 'products', value: 15 })] });
edge('check free-shipping base after product discount', { products: [prod('P', 160)], fee: 4, cart: [item('P')], discounts: [D({ id: 'free150', kind: 'shipping', value: 100, minimum: { type: 'amount', value: 150 } }), D({ id: 'p10', kind: 'products', value: 10 })] });
edge('check cents €1 over 3 × €3.33', { products: [prod('A', 3.33), prod('B', 3.33), prod('C', 3.33)], cart: [item('A'), item('B'), item('C')], opts: { codes: ['ONE'] }, discounts: [D({ id: 'one', method: 'code', code: 'ONE', valueType: 'fixed', value: 1 })] });
edge('check 15% of €261.59 (m² line 72.59)', { products: [prod('A', 10.9, { unit: 'm2', packSize: 2.22 }), prod('B', 189)], cart: [item('A', 3), item('B')], discounts: [D({ id: 'o15', value: 15 })] });
edge('check fixed €5 per item capped', { products: [prod('A', 4)], cart: [item('A', 2)], discounts: [D({ id: 'per', kind: 'products', valueType: 'fixed', value: 5, perItem: true })] });
edge('check one product discount per line', { products: [prod('A', 100)], cart: [item('A')], collections: [manual('sun', ['A'])], discounts: [D({ id: 'p10', kind: 'products', value: 10 }), D({ id: 'p15', kind: 'products', value: 15, appliesTo: { scope: 'collections', ids: ['sun'] } })] });
edge('check product rules on different lines', {
  products: [prod('p-lumen-l11', 285.45), prod('p-prism-m2', 320), prod('p-lens-single', 80)],
  cart: [item('p-lumen-l11'), item('p-prism-m2'), item('p-lens-single')],
  collections: [manual('col-dielli-fund-sezoni', ['p-lumen-l11'])],
  discounts: [
    D({ id: 'd-dielli20', kind: 'products', value: 20, appliesTo: { scope: 'collections', ids: ['col-dielli-fund-sezoni'] } }),
    D({ id: 'd-korniza-lente', kind: 'bxgy', bxgy: { buyIds: ['p-prism-m2', 'p-nova-n04', 'p-origin-o06'], buyScope: 'products', buyQty: 1, getIds: ['p-lens-single'], getScope: 'products', getQty: 1, getType: 'percent', getValue: 50, maxUses: 2 } }),
  ],
});
const noOrderStack = { products: true, order: false, shipping: true };
edge('check best monetary saving', { products: [prod('A', 60)], cart: [item('A')], opts: { codes: ['PCT20', 'EUR15'] }, discounts: [D({ id: 'pct', method: 'code', code: 'PCT20', value: 20, combines: noOrderStack }), D({ id: 'eur', method: 'code', code: 'EUR15', valueType: 'fixed', value: 15, combines: noOrderStack })] });
edge('check combination must be mutual', { products: [prod('A', 200)], cart: [item('A')], opts: { codes: ['ORD'] }, discounts: [D({ id: 'auto', kind: 'products', value: 10, combines: { products: false, order: true, shipping: true } }), D({ id: 'ord', method: 'code', code: 'ORD', value: 10, combines: { products: false, order: false, shipping: true } })] });
edge('check rejection reasons', {
  products: [prod('A', 100)],
  cart: [item('A')],
  opts: { codes: ['NOPE', 'DRAFT', 'LATER', 'OLD', 'FULL', 'VIP', 'draft'], customer: { segmentIds: [] } },
  discounts: [
    D({ id: 'draft', method: 'code', code: 'DRAFT', status: 'draft', value: 5 }),
    D({ id: 'later', method: 'code', code: 'LATER', startsAt: '2026-12-01T00:00:00.000Z', value: 5 }),
    D({ id: 'old', method: 'code', code: 'OLD', endsAt: '2026-09-01T00:00:00.000Z', value: 5 }),
    D({ id: 'full', method: 'code', code: 'FULL', usageLimit: 10, uses: 10, value: 5 }),
    D({ id: 'vip', method: 'code', code: 'VIP', audience: { type: 'segment', segmentId: 'seg-vip' }, value: 5 }),
  ],
});
// free-shipping rule picked for the "free from" figure: none → lowest amount → item counts last
const shipCombos = [['sr-qty2'], ['sr-qty2', 'sr-qty5'], ['sr-none'], ['sr-amt60'], ['sr-qty2', 'sr-amt60'], ['sr-qty5', 'sr-none', 'sr-amt150'], ['sr-amt150', 'sr-amt60', 'sr-amt0'], ['sr-qty5', 'sr-qty2', 'sr-none50'], ['sr-fix2', 'sr-qty2']];
for (const ids of shipCombos) {
  for (const [qty, price] of [[1, 40], [2, 40], [5, 40], [1, 200]]) {
    edge(`free-shipping rules ${ids.join('+')} · ${qty} × €${price}`, { products: [prod('A', price)], fee: 3, cart: [item('A', qty)], discounts: ids.map((id) => SHIP_RULES.find((r) => r.id === id)) });
  }
}
edge('free-shipping rule amount without value', { products: [prod('A', 40)], fee: 3, cart: [item('A')], discounts: [shipRule('sr-amt-novalue', { type: 'amount' })] });
// local delivery (readLocalDelivery): legacy entries without `v`, `v: 2`, town spelling variants
for (const s of LOCAL_SETTINGS) {
  for (const city of ['Mitrovicë', 'mitrovice', 'MITROVICË ', 'Mitrovice\u0308', 'Vushtrri', 'Prishtinë', 'Zveçan', 'Zvecan']) {
    cases.push({ name: `local delivery settings #${s} · ${JSON.stringify(city)}`, cart: [item('p-lens-single', 1)], p: P0, s, opts: { lang: 'sq', delivery: 'delivery', city, discounts: { $pool: 0 }, now: seeds[0].t } });
  }
}

/* ------------------------------------------------------------------ */
/* 2b. random cases                                                    */
/* ------------------------------------------------------------------ */
const CITY_VARIANTS = ['Mitrovicë', 'mitrovicë', 'MITROVICË', 'Mitrovice', ' Mitrovicë', 'Mitrovicë ', '\u00a0Mitrovicë\u00a0', 'Mitrovice\u0308', 'Mitrovica', 'Prishtine', 'PRISHTINË', 'prishtinë', 'Fushe Kosove', 'Fushë Kosovë', 'FUSHË KOSOVË', 'Zveçan', 'Zvecan', 'Zvečan', 'ZVEÇAN', 'Gjakovë', 'Deçan', 'Kaçanik', 'İstog', 'Istog', 'ISTOG', 'Pejë', 'Peje', 'Mitrovicë\t', 'Vushtrri'];
const SEED_CODES = ['MIFTARI10', 'VJESHTA25', 'LABB2B15', 'VERA15', 'VIP50', 'MIRESEVINI', 'VERA2026'];
const EXTRA_CODES = ['NOPE', 'XYZ123', '', '  ', 'strasse', 'STRAßE', 'miftarı10', 'Miftari 10', 'vjeshta 25', 'ﬁx10', 'FIX10', 'kupon5', 'Ǆungla'];
function variant(code) {
  let c = code;
  if (chance(0.3)) c = c.toLowerCase();
  else if (chance(0.2)) c = [...c].map((ch) => (chance(0.5) ? ch.toLowerCase() : ch.toUpperCase())).join('');
  if (chance(0.2)) c = ` ${c} `;
  if (chance(0.1)) c = `${c.slice(0, 3)} ${c.slice(3)}`;
  if (chance(0.05)) c = `\u00a0${c}\t`;
  if (chance(0.03)) c = c.replace(/I/g, 'ı');
  return c;
}
function randCart(products) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const relevant = relevantIds.filter((id) => byId.has(id));
  const items = [];
  const n = chance(0.03) ? 0 : int(1, 6);
  for (let i = 0; i < n; i++) {
    if (chance(0.03)) {
      items.push({ key: 'ghost', productId: 'p-does-not-exist', qty: 1, options: {}, installation: false });
      continue;
    }
    let p = chance(0.5) ? byId.get(pick(relevant)) : pick(products);
    if (items.length && chance(0.12)) p = byId.get(pick(items).productId) ?? p;
    const options = {};
    for (const o of p.options ?? []) {
      const r = R();
      if (r < 0.8 && o.values.length) options[o.id] = pick(o.values).id;
      else if (r >= 0.9) options[o.id] = 'nope';
    }
    const qty = chance(0.05) ? 0 : chance(0.03) ? pick([1.5, 2.25, 0.5]) : chance(0.06) ? pick([8, 12, 20]) : int(1, 5);
    const installation = chance(0.3);
    const key = chance(0.1) ? '' : `${p.id}|${Object.keys(options).sort().map((k) => `${k}=${options[k]}`).join('&')}|${installation ? 'i' : ''}`;
    items.push({ key, productId: p.id, qty, options, installation });
  }
  return items;
}
function genNow(pool) {
  const ref = pool.ref;
  const r = R();
  let ms;
  if (r < 0.15 && pool.list.length) {
    const d = pick(pool.list);
    const b = [d.startsAt, d.endsAt].filter((x) => typeof x === 'string' && x);
    const t = b.length ? Date.parse(pick(b)) : NaN;
    ms = Number.isFinite(t) ? t + pick([-1, 0, 0, 1]) : ref;
  } else if (r < 0.6) ms = ref + Math.round((R() * 40 - 15) * DAY);
  else if (r < 0.85) ms = ref + Math.round((R() * 160 - 120) * DAY);
  else ms = ref + Math.round((R() * 160 - 260) * DAY);
  const f = R();
  if (f < 0.7) return ms;
  if (f < 0.85) return iso(ms);
  if (f < 0.89) return iso(ms).slice(0, 10);
  if (f < 0.91) return offsetIso(ms, pick([60, -300, 330, 0]));
  if (f < 0.92) return offsetIso(ms, 60, false);
  if (f < 0.94) return iso(ms).replace('T', 't').replace('Z', 'z');
  if (f < 0.96) return ref === seeds[1].t ? undefined : ms; // missing → Date.now(); only where no boundary is near today
  if (f < 0.97) return null;
  if (f < 0.98) return 'garbage';
  if (f < 0.99) return iso(ms).slice(0, 16); // local time (both sides run in UTC)
  return ms + 0.5;
}
for (let i = 0; i < N; i++) {
  const p = chance(0.55) ? P1 : P0;
  const pool = pickPool();
  const s = chance(0.45) ? SETTINGS[0] : pick(SETTINGS);
  const settings = pools.settings[s];
  const opts = {};
  if (chance(0.98)) opts.lang = pick(['me', 'sq', 'en']);
  else if (chance(0.5)) opts.lang = 'de';
  const poolCodes = pool.list.filter((d) => d.method === 'code' && typeof d.code === 'string').map((d) => d.code);
  const vocab = [...poolCodes, ...poolCodes, ...SEED_CODES, ...EXTRA_CODES];
  const nCodes = pick([0, 0, 1, 1, 1, 2, 2, 3, 4]);
  const codes = Array.from({ length: nCodes }, () => variant(pick(vocab)));
  if (codes.length && chance(0.15)) codes.push(codes[0]);
  if (nCodes || chance(0.3)) opts.codes = codes;
  const cc = R();
  if (cc < 0.12) opts.couponCode = variant(pick(vocab));
  else if (cc < 0.2) opts.couponCode = null;
  else if (cc < 0.23) opts.couponCode = '';
  const dr = R();
  if (dr < 0.82) opts.discounts = { $pool: pool.idx };
  else if (dr < 0.86) opts.discounts = [];
  else if (dr < 0.9) opts.discounts = null;
  if (opts.discounts == null ? chance(0.85) : chance(0.1)) opts.coupons = { $pool: pick(COUPON_POOLS) };
  const co = R();
  if (co < 0.65) opts.collections = { $pool: CO0 };
  else if (co < 0.85) opts.collections = { $pool: pick(COLLECTION_POOLS) };
  else if (co >= 0.95) opts.collections = [];
  const de = R();
  if (de < 0.6) opts.delivery = 'delivery';
  else if (de < 0.85) opts.delivery = 'pickup';
  const zc = (settings.shippingZones ?? []).flatMap((z) => z.cities);
  const area = settings.ext?.localDelivery?.area;
  const ci = R();
  if (ci < 0.5) opts.city = zc.length ? pick(zc) : pick(zoneCities);
  else if (ci < 0.75) opts.city = pick(CITY_VARIANTS);
  else if (ci < 0.85) opts.city = typeof area === 'string' ? pick([area, area.trim(), area.toUpperCase(), area.normalize('NFD'), ` ${area}`]) : pick(zoneCities);
  else if (ci < 0.92) opts.city = pick(['Beograd', 'Tirana', 'Shkup', 'Митровица', 'Podgorica']);
  else if (ci < 0.96) opts.city = '';
  const now = genNow(pool);
  if (now !== undefined) opts.now = now;
  const cu = R();
  const ids = pool.list.map((d) => d.id);
  if (cu < 0.5);
  else if (cu < 0.6) opts.customer = null;
  else if (cu < 0.75) opts.customer = { segmentIds: [pick(['seg-b2b', 'seg-vip', 'seg-none'])] };
  else if (cu < 0.88) opts.customer = { segmentIds: ['seg-vip', 'seg-b2b'], usedDiscountIds: sample(ids, 2) };
  else opts.customer = pick([{}, { usedDiscountIds: sample(ids, 3) }]);
  cases.push({ name: `random #${i}`, cart: randCart(pools.products[p]), p, s, opts });
}

/* ---- direct checks of normalizeCode and allocateCents ---- */
const normStrings = [...new Set([
  ...cases.flatMap((c) => [...(Array.isArray(c.opts.codes) ? c.opts.codes : []), ...(typeof c.opts.couponCode === 'string' ? [c.opts.couponCode] : [])]),
  ...CODE_VOCAB.filter((c) => typeof c === 'string'), ...SEED_CODES, ...EXTRA_CODES,
  ' miftari 10 ', 'a\u2028b\u2029c', '\ufeffX\u3000Y\u205fZ', 'x\u0085y', 'ß', 'ﬁ', 'ǅ', 'İ', 'ı', 'e\u0301', 'ŉ', 'ǰ', 'ΐ', 'ﬀﬃ', '\u180eQ', 'Ⅻ', 'ⓐ',
])];
const allocCases = Array.from({ length: 800 }, () => {
  const w = Array.from({ length: int(1, 6) }, () => (chance(0.1) ? pick([0, -5]) : int(1, chance(0.5) ? 500 : 100000)));
  const total = chance(0.05) ? pick([0, -3, 100.5]) : int(1, chance(0.5) ? 1000 : 2000000);
  return [total, w];
});

/* ------------------------------------------------------------------ */
/* 3. run both sides and compare                                       */
/* ------------------------------------------------------------------ */
const casesFile = join(CACHE, 'cases.ndjson');
const outFile = join(CACHE, 'php.ndjson');
const lines = [JSON.stringify({ pools }), ...cases.map((c) => JSON.stringify({ cart: c.cart, p: c.p, s: c.s, opts: c.opts })), JSON.stringify({ normalize: normStrings }), JSON.stringify({ alloc: allocCases })];
writeFileSync(casesFile, `${lines.join('\n')}\n`);

function findPhp() {
  const fromArg = arg('php', process.env.PHP);
  if (fromArg) return fromArg;
  const local = 'C:/Users/A/Documents/MM/tmp/php83/php.exe';
  return existsSync(local) ? local : 'php';
}
const php = findPhp();
const phpArgs = ['-n', '-d', 'memory_limit=2G', '-d', 'date.timezone=UTC', '-d', 'serialize_precision=-1'];
const probe = spawnSync(php, [...phpArgs, '-r', 'echo extension_loaded("mbstring") ? 1 : 0;'], { encoding: 'utf8' });
if (probe.error) throw new Error(`cannot run PHP (${php}): ${probe.error.message}`);
if (probe.stdout.trim() !== '1') phpArgs.push('-d', `extension_dir=${join(dirname(php), 'ext')}`, '-d', 'extension=mbstring');
const phpDone = new Promise((resolve, reject) => {
  const child = spawn(php, [...phpArgs, join(HERE, 'run.php'), casesFile, outFile], { stdio: ['ignore', 'inherit', 'inherit'] });
  child.on('error', reject);
  child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`php exited with ${code}`))));
});

const freezeDeep = (v) => {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const x of Object.values(v)) freezeDeep(x);
  }
  return v;
};
// TS sees exactly what PHP sees: everything goes through the same JSON lines
const tsPools = freezeDeep(JSON.parse(lines[0]).pools);
const resolveOpts = (opts) => {
  const o = { ...opts };
  for (const k of ['discounts', 'collections', 'coupons']) if (o[k] && typeof o[k] === 'object' && '$pool' in o[k]) o[k] = tsPools[k][o[k].$pool];
  return o;
};
const t1 = Date.now();
let tsErrors = 0;
const tsOut = cases.map((c, i) => {
  const input = freezeDeep(JSON.parse(lines[i + 1]));
  try {
    const t = JSON.parse(JSON.stringify(ts.priceCart(input.cart, tsPools.products[input.p], tsPools.settings[input.s], resolveOpts(input.opts))));
    t.lines = t.lines.map(({ product, ...rest }) => {
      const out = {};
      for (const [k, v] of Object.entries(rest)) {
        out[k] = v;
        if (k === 'item' && product?.id !== undefined) out.productId = product.id;
      }
      return out;
    });
    return t;
  } catch (e) {
    tsErrors++;
    return { __tsError: String(e?.stack ?? e) };
  }
});
const tsNorm = normStrings.map((s) => ts.normalizeCode(s));
const tsAlloc = allocCases.map(([t, w]) => ts.allocateCents(t, w));
console.log(`ts: ${cases.length} cases in ${((Date.now() - t1) / 1000).toFixed(1)} s (${tsErrors} threw)`);
await phpDone;
const phpLines = readFileSync(outFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

function diff(a, b, path = '$') {
  if (a === b) return null;
  if (typeof a === 'number' && typeof b === 'number') return a === b ? null : { path, ts: a, php: b };
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return { path, ts: a, php: b };
  const emptyA = Array.isArray(a) ? a.length === 0 : Object.keys(a).length === 0;
  const emptyB = Array.isArray(b) ? b.length === 0 : Object.keys(b).length === 0;
  if (emptyA && emptyB) return null;
  if (Array.isArray(a) !== Array.isArray(b)) return { path, ts: a, php: b };
  if (Array.isArray(a)) {
    if (a.length !== b.length) return { path: `${path}.length`, ts: a.length, php: b.length };
    for (let i = 0; i < a.length; i++) {
      const d = diff(a[i], b[i], `${path}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!(k in a)) return { path: `${path}.${k}`, ts: '(missing)', php: b[k] };
    if (!(k in b)) return { path: `${path}.${k}`, ts: a[k], php: '(missing)' };
    const d = diff(a[k], b[k], `${path}.${k}`);
    if (d) return d;
  }
  return null;
}

const mismatches = [];
cases.forEach((c, i) => {
  if (tsOut[i].__tsError) return;
  const d = diff(tsOut[i], phpLines[i]);
  if (d) mismatches.push({ i, name: c.name, ...d });
});
const normRes = phpLines[cases.length] ?? [];
const allocRes = phpLines[cases.length + 1] ?? [];
const normBad = normStrings.map((s, i) => ({ s, ts: tsNorm[i], php: normRes[i] })).filter((x) => x.ts !== x.php);
const allocBad = allocCases.map((a, i) => ({ a, d: diff(tsAlloc[i], allocRes[i]) })).filter((x) => x.d);

/* ---- coverage (what the cases exercised, from the TS results) ---- */
const hist = (f) => {
  const h = {};
  for (const t of tsOut) if (!t.__tsError) for (const k of [f(t)].flat()) if (k !== undefined) h[k] = (h[k] ?? 0) + 1;
  return Object.entries(h).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join(', ');
};
console.log('coverage:');
console.log(`  applied     ${hist((t) => t.applied.map((a) => a.kind))}`);
console.log(`  rejected    ${hist((t) => t.rejected.map((r) => r.reason))}`);
console.log(`  couponError ${hist((t) => t.couponError)} · coupon applied ${hist((t) => (t.coupon ? 'yes' : undefined))} · couponMinimum ${hist((t) => (t.couponMinimum ? t.couponMinimum.type : undefined))}`);
console.log(`  freeShippingReason ${hist((t) => String(t.freeShippingReason))} · threshold ${hist((t) => (!('freeShippingThreshold' in t) ? 'undefined' : t.freeShippingThreshold === null ? 'null' : t.freeShippingThreshold === 0 ? '0' : 'amount'))}`);
console.log(`  lines ${hist((t) => String(t.lines.length))} · estimate ${hist((t) => (t.shippingEstimate ? 'yes' : undefined))} · >12 rules evaluated ${hist((t) => (t.applied.length + t.rejected.length > 12 ? 'yes' : undefined))}`);

console.log(`normalizeCode: ${normStrings.length} strings, ${normBad.length} mismatches · allocateCents: ${allocCases.length} splits, ${allocBad.length} mismatches`);
for (const x of normBad.slice(0, 5)) console.log(`  normalizeCode(${JSON.stringify(x.s)}): ts ${JSON.stringify(x.ts)} php ${JSON.stringify(x.php)}`);
for (const x of allocBad.slice(0, 5)) console.log(`  allocateCents(${JSON.stringify(x.a)}): ${JSON.stringify(x.d)}`);
mismatches.slice(0, 8).forEach((m, k) => {
  console.log(`MISMATCH ${m.name} at ${m.path}\n  ts:  ${JSON.stringify(m.ts)?.slice(0, 300)}\n  php: ${JSON.stringify(m.php)?.slice(0, 300)}`);
  writeFileSync(join(CACHE, `mismatch-${k + 1}.json`), JSON.stringify({ case: cases[m.i], path: m.path, ts: tsOut[m.i], php: phpLines[m.i] }, null, 2));
});
const bad = mismatches.length + normBad.length + allocBad.length;
console.log(`\n${cases.length} cases (${cases.length - N} hand-written + ${N} random, seed ${SEED}): ${mismatches.length} mismatches, ${tsErrors} skipped (TS threw)`);
console.log(bad ? `FAIL — ${bad} mismatches (details in ${CACHE})` : 'OK — PHP and TS agree on every case');
if (tsErrors) for (const t of tsOut.filter((x) => x.__tsError).slice(0, 3)) console.log(`  TS error: ${t.__tsError.split('\n')[0]}`);
process.exit(bad || tsErrors ? 1 : 0);
