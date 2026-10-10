// Post-build: per-route HTML shells with their own <title>, description, Open Graph / Twitter tags, canonical URL and
// JSON-LD, plus sitemap.xml and robots.txt.
//
// GitHub Pages has no rewrites: unknown paths fall back to 404.html (the app shell) with HTTP 404. Writing
// <route>/index.html for every route known at build time makes shared links, previews and crawlers get a 200 and the
// right preview text. The data comes from the same seed the app uses (src/data/seed.ts, bundled for Node with Vite).
// Content created later in the CMS still opens through 404.html.
//
// usage (after `vite build`): node scripts/prerender-meta.mjs   env: BASE_PATH (default "/"), SITE_URL (origin)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';

const DIST = 'dist';
const raw = (process.env.BASE_PATH ?? '/').trim();
const BASE = !raw || raw === '/' ? '/' : `/${raw.replace(/^\/+|\/+$/g, '')}/`;
const ORIGIN = (process.env.SITE_URL ?? 'https://ariongj.github.io').replace(/\/+$/, '');
// Seeded image paths may already carry the base (the vite config prefixes "/images/…" literals at build time).
const abs = (p = '') => `${ORIGIN}${BASE}${(BASE !== '/' && p.startsWith(BASE) ? p.slice(BASE.length) : p).replace(/^\/+/, '')}`;

/* ---- load the seed data (TypeScript + "@/" aliases) through a tiny Vite SSR build ---- */
const tmp = path.join('node_modules', '.optika-seed');
await build({
  logLevel: 'warn',
  publicDir: false,
  build: { ssr: 'src/data/seed.ts', outDir: tmp, emptyOutDir: true, minify: false, copyPublicDir: false },
});
const { createSeed } = await import(pathToFileURL(path.resolve(tmp, 'seed.js')).href);
const db = createSeed(new Date());
const s = db.settings;

/* ---- helpers ---- */
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = (v) =>
  String(v ?? '')
    .replace(/\*/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^[>-]\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
const clip = (v, n = 158) => {
  const t = plain(v);
  return t.length <= n ? t : `${t.slice(0, n - 1).replace(/\s+\S*$/, '')}…`;
};
const brand = s.companyName || 'Optika Miftari';
const titled = (t) => `${plain(t)} · ${brand}`;
const shell = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const today = new Date().toISOString().slice(0, 10);

const business = {
  '@context': 'https://schema.org',
  '@type': 'Optician',
  name: brand,
  url: abs(),
  image: abs('images/hero/optical.webp'),
  logo: abs('icon-512.png'),
  telephone: s.phone,
  email: s.email,
  priceRange: '€€',
  address: { '@type': 'PostalAddress', streetAddress: s.address, postalCode: '40000', addressLocality: s.city, addressCountry: 'XK' },
  openingHours: 'Mo-Sa 10:00-19:30',
  sameAs: s.instagram ? [`https://www.instagram.com/${s.instagram}/`] : [],
  parentOrganization: { '@type': 'Organization', name: s.legalName },
};

/** route → { title, description, image, type?, noindex?, jsonld? } */
const pages = new Map();
const put = (route, meta) => pages.set(route, meta);

// Home: preload the first hero photo (portrait crop on phones) so it downloads in parallel with the JavaScript.
const hero = db.home.find((h) => h.enabled && h.type === 'hero');
const heroImg = hero?.data.slides?.[0]?.image;
const heroRel = heroImg ? (BASE !== '/' && heroImg.startsWith(BASE) ? heroImg.slice(BASE.length) : heroImg).replace(/^\/+/, '') : '';
const heroPortrait = /^images\/hero\/[^/]+\.webp$/.test(heroRel) ? heroRel.replace(/\.webp$/, '-m.webp') : '';
const heroPreload = heroRel
  ? heroPortrait && fs.existsSync(path.join(DIST, heroPortrait))
    ? [
        `<link rel="preload" as="image" href="${BASE}${heroPortrait}" media="(max-width: 767px)" fetchpriority="high" />`,
        `<link rel="preload" as="image" href="${BASE}${heroRel}" media="(min-width: 768px)" fetchpriority="high" />`,
      ]
    : [`<link rel="preload" as="image" href="${BASE}${heroRel}" fetchpriority="high" />`]
  : [];
put('', { title: s.seo.title, description: s.seo.description, image: '/images/hero/optical.webp', jsonld: business, raw: true, preload: heroPreload });
const STATIC = [
  ['produktet', 'Produktet — syze optike, syze dielli dhe lente', 'Korniza optike dhe syze dielli në titan dhe acetat, lente me recetë nga laboratori ynë. Dërgesë në gjithë Kosovën.', '/images/cat/optike.webp'],
  ['sherbimet', 'Shërbimet — kontroll i syve, laborator dhe klinikë', 'Kontroll profesional i syve, matje e PD-së dhe përshtatje, lente nga laboratori ynë, riparime, Klinika Miftari dhe Optical Lab për optikat.', '/images/s/kontrolli.webp'],
  ['lookbook', 'Lookbook — fytyra, dritë dhe stil', 'Fushatat dhe fotografitë editoriale të Optika Miftari — nga Mitrovica deri në Rugovë.', '/images/lookbook/riviera.webp'],
  ['rreth-nesh', 'Rreth nesh — 30 vjet traditë familjare', 'Optika Miftari: optikë familjare nga Mitrovica me laborator optik dhe Klinikën Miftari — qartësi, brez pas brezi.', '/images/hero/family.webp'],
  ['kontakt', 'Kontakt — Mbretëresha Teutë 182, Mitrovicë', `Na telefononi në ${s.phone}, na shkruani në WhatsApp ose ejani në optikë. Hën–Sht 10:00–19:30.`, '/images/misc/contact.webp'],
  ['keshilla', 'Këshilla për syzet dhe shëndetin e syve', 'Si ta lexoni recetën, çfarë është PD, lentet progresive, lentet për ekran dhe më shumë — të shpjeguara thjesht.', '/images/misc/lens.webp'],
  ['provo-virtualisht', 'Provo virtualisht — syzet në fytyrën tuaj', 'Provoni kornizat me kamerën live, me një foto ose në 3D. Imazhi përpunohet vetëm në pajisjen tuaj.', '/images/hero/sun.webp'],
  ['klinika', 'Klinika Miftari — kujdes specialistik për sytë', 'Konsulta specialistike dhe vlerësim për sytë në Klinikën Miftari, Mitrovicë. Rezervoni termin online ose me telefon.', '/images/s/klinika.webp'],
  ['optical-lab', 'Optical Lab — lente me recetë dhe partneritet B2B', 'Laboratori optik i Miftari Holding Group: punim, centrim, montim dhe kontroll i lenteve me recetë — edhe për optikat partnere në Kosovë dhe BE.', '/images/s/lab-polish.webp'],
  ['lentet', 'Udhëzuesi i lenteve — zgjidhni lentet e duhura', 'Njëvizore, progresive, për ekran, fotokromatike apo me dioptri dielli? Gjeni lentet dhe indeksin e duhur për recetën tuaj.', '/images/misc/lens.webp'],
  ['gjej-kornizen', 'Gjeni kornizën tuaj — kuiz i shpejtë', 'Pesë pyetje për formën e fytyrës, stilin dhe madhësinë — dhe tri korniza që ju shkojnë, me provë virtuale.', '/images/cat/optike.webp'],
  ['rezervo', 'Rezervo kontrollin e syve', 'Zgjidhni shërbimin, ditën dhe orën — kontroll i syve, përshtatje, lente kontakti ose konsultë në Klinikën Miftari.', '/images/hero/exam.webp'],
];
for (const [r, t, d, img] of STATIC) put(r, { title: t, description: d, image: img });
for (const [r, t] of [['shporta', 'Shporta'], ['pagesa', 'Pagesa'], ['kerko', 'Kërko'], ['te-preferuarat', 'Të preferuarat'], ['gjurmo-porosine', 'Gjurmo porosinë'], ['admin', 'CMS'], ['admin/login', 'Hyrje në CMS']])
  put(r, { title: t, description: s.seo.description, image: '/images/hero/optical.webp', noindex: true });

const catName = new Map(db.categories.map((c) => [c.id, c.name.sq]));
for (const c of db.categories) put(`produktet/${c.slug}`, { title: `${c.name.sq} — ${c.tagline.sq}`, description: c.description.sq, image: c.image });
for (const p of db.products.filter((x) => x.status === 'active')) {
  const price = p.salePrice ?? p.price;
  put(`produkt/${p.slug}`, {
    title: p.seo?.title || `${p.name.sq} — ${catName.get(p.categoryId) ?? ''}`,
    description: p.seo?.description || `${plain(p.short.sq)} ${price} € · ${brand}, Mitrovicë.`,
    image: p.images[0],
    type: 'product',
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.name.sq,
      sku: p.sku,
      brand: { '@type': 'Brand', name: p.vendor || brand },
      description: plain(p.description.sq),
      image: p.images.map((i) => abs(i)),
      category: catName.get(p.categoryId),
      offers: {
        '@type': 'Offer',
        price: String(price),
        priceCurrency: 'EUR',
        availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
        url: abs(`produkt/${p.slug}`),
        seller: { '@type': 'Organization', name: brand },
      },
    },
  });
}
for (const c of db.collections.filter((x) => x.published)) put(`koleksioni/${c.slug}`, { title: c.seo?.title || c.title.sq, description: c.seo?.description || c.description.sq, image: c.image });
for (const o of db.offers.filter((x) => x.status !== 'draft')) put(`oferta/${o.slug}`, { title: o.landing?.title?.sq || o.name.sq, description: o.landing?.text?.sq || o.description.sq, image: o.image });
for (const pg of db.pages.filter((x) => x.published)) put(`faqe/${pg.slug}`, { title: pg.title.sq, description: pg.body.sq, image: '/images/misc/contact.webp' });
for (const po of db.posts.filter((x) => x.published))
  put(`keshilla/${po.slug}`, {
    title: po.title.sq,
    description: po.excerpt.sq,
    image: po.cover,
    type: 'article',
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: plain(po.title.sq),
      description: plain(po.excerpt.sq),
      image: abs(po.cover),
      datePublished: po.publishedAt,
      author: { '@type': 'Organization', name: po.author || brand },
      publisher: { '@type': 'Organization', name: brand, logo: { '@type': 'ImageObject', url: abs('icon-512.png') } },
    },
  });

/** Prefer the 1200×630 JPG made for link previews (public/og/<dir>-<name>.jpg) over the WebP page image. */
function ogImage(img) {
  const rel = (BASE !== '/' && img.startsWith(BASE) ? img.slice(BASE.length) : img).replace(/^\/+/, '');
  const m = rel.match(/^images\/(.+)\.webp$/);
  const og = m ? `og/${m[1].replace(/\//g, '-')}.jpg` : null;
  return og && fs.existsSync(path.join(DIST, og)) ? abs(og) : abs(rel);
}

/* ---- write shells ---- */
function render(route, m) {
  const url = abs(route ? `${route}/` : '');
  const title = m.raw ? plain(m.title) : titled(m.title);
  const desc = clip(m.description);
  const image = ogImage(m.image || '/images/hero/optical.webp');
  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    m.noindex ? '<meta name="robots" content="noindex, follow" />' : '<meta name="robots" content="index, follow" />',
    `<meta property="og:site_name" content="${esc(brand)}" />`,
    `<meta property="og:locale" content="sq_AL" />`,
    `<meta property="og:type" content="${m.type === 'article' ? 'article' : m.type === 'product' ? 'product' : 'website'}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(desc)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
    ...(m.preload ?? []),
    m.jsonld ? `<script type="application/ld+json">${JSON.stringify(m.jsonld).replace(/</g, '\\u003c')}</script>` : '',
  ]
    .filter(Boolean)
    .join('\n    ');
  return shell
    .replace(/\s*<title>[\s\S]*?<\/title>/, '')
    .replace(/\s*<meta name="description"[^>]*>/, '')
    .replace(/\s*<meta property="og:[^>]*>/g, '')
    .replace(/\s*<meta name="twitter:[^>]*>/g, '')
    .replace(/\s*<link rel="canonical"[^>]*>/, '')
    .replace(/\s*<meta name="robots"[^>]*>/, '')
    .replace('</head>', `    ${head}\n  </head>`);
}

let n = 0;
for (const [route, meta] of pages) {
  const dir = route ? path.join(DIST, ...route.split('/')) : DIST;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), render(route, meta));
  n++;
}
// Fallback for anything unknown (CMS-created pages, typos): generic shell, not indexed.
fs.writeFileSync(path.join(DIST, '404.html'), render('', { ...pages.get(''), noindex: true, preload: [] }));

const urls = [...pages].filter(([, m]) => !m.noindex).map(([r]) => abs(r ? `${r}/` : ''));
fs.writeFileSync(
  path.join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${esc(u)}</loc><lastmod>${today}</lastmod></url>`)
    .join('\n')}\n</urlset>\n`,
);
fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nDisallow: ${BASE}admin/\nAllow: /\n\nSitemap: ${abs('sitemap.xml')}\n`);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`prerender-meta: ${n} route shells, ${urls.length} URLs in sitemap.xml, robots.txt, 404.html`);
