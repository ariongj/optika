// GitHub Pages has no rewrites: unknown paths are answered by 404.html (the app shell) with HTTP status 404.
// To make shared links, previews and crawlers see a 200, copy the shell to <route>/index.html for every route
// we know at build time — static pages plus the seeded categories, products, collections, offers, pages and posts.
// Content created later in the CMS still opens through the 404.html fallback.
// usage (after `vite build`): node scripts/spa-shells.mjs [distDir=dist]
import fs from 'node:fs';
import path from 'node:path';

const dist = process.argv[2] ?? 'dist';
const shell = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const read = (f) => fs.readFileSync(path.join('src/data', f), 'utf8');

/** `slug: '…'` values between `start` and the next top-level declaration. */
function slugsIn(source, start) {
  const from = source.indexOf(start);
  if (from < 0) throw new Error(`spa-shells: "${start}" not found`);
  const rest = source.slice(from + start.length);
  const end = rest.search(/\n(?:export )?(?:const|function) /);
  const block = end < 0 ? rest : rest.slice(0, end);
  return [...block.matchAll(/\bslug: '([^']+)'/g)].map((m) => m[1]);
}

const catalog = read('catalog.ts');
const content = read('content.ts');
const cms = read('cms.ts');

const routes = [
  'produktet', 'sherbimet', 'lookbook', 'rreth-nesh', 'kontakt', 'keshilla', 'provo-virtualisht',
  'shporta', 'pagesa', 'kerko', 'te-preferuarat', 'admin', 'admin/login',
  ...slugsIn(catalog, 'export const CATEGORIES').map((s) => `produktet/${s}`),
  ...slugsIn(catalog, 'const DRAFTS').map((s) => `produkt/${s}`),
  ...slugsIn(cms, 'export function buildCollections').map((s) => `koleksioni/${s}`),
  ...slugsIn(cms, 'export function buildOffers').map((s) => `oferta/${s}`),
  ...slugsIn(content, 'export function buildPages').map((s) => `faqe/${s}`),
  ...slugsIn(content, 'export function buildPosts').map((s) => `keshilla/${s}`),
];

for (const r of new Set(routes)) {
  const dir = path.join(dist, ...r.split('/'));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), shell);
}
fs.writeFileSync(path.join(dist, '404.html'), shell);
console.log(`spa-shells: ${new Set(routes).size} route shells + 404.html`);
