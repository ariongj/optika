// GET-only crawl. Does not authenticate, submit forms or touch private records.
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pageDefinitions } from '../src/seoPages.js';
import { products, blogPosts } from '../src/data/catalog.js';
import { canonicalUrl, privateSeoPaths } from '../src/seo.js';
import { seoFetch as fetch } from './seo-fetch.mjs';
const root = resolve('.'), dist = resolve('dist');
const base = process.env.OPTIKA_SEO_BASE || '';
const site = 'https://optika.itdks.tech';
const reportSlug = process.env.OPTIKA_SEO_REPORT_DIR || 'seo';
if (!/^[a-z0-9-]{1,80}$/.test(reportSlug)) throw new Error('SEO report directory must be a simple QA folder name');
const out = resolve('output/qa', reportSlug, base.includes('optika.itdks.tech') ? 'live-audit.json' : base ? 'local-audit.json' : 'build-audit.json');
const checks = [], titles = new Map(), descriptions = new Map(), links = new Set(), assets = new Set();
const check = (name, pass, evidence = '') => checks.push({ name, status: pass ? 'verified' : 'failed', evidence });
const doc = async path => {
  if (!base) return { status: 200, body: await readFile(resolve(dist, path.replace(/^\//, ''), 'index.html'), 'utf8'), headers: null };
  const response = await fetch(base + path, { redirect: 'manual', signal: AbortSignal.timeout(30000) });
  return { status: response.status, body: await response.text(), headers: response.headers };
};
const sitemap = base ? await (await fetch(base + '/sitemap.xml', { signal: AbortSignal.timeout(30000) })).text() : await readFile(resolve(dist, 'sitemap.xml'), 'utf8');
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1].replaceAll('&amp;', '&'));
check('Sitemap has unique public URLs', urls.length >= 56 && new Set(urls).size === urls.length, urls.length);
check('No fictitious build-date lastmod', !sitemap.includes('<lastmod>'));
check('Sitemap excludes private utility pages', urls.every(url => !privateSeoPaths.includes(new URL(url).pathname.replace(/\/$/, ''))));
const routes = [...urls.map(url => new URL(url).pathname + new URL(url).search), '/account/', '/staff/', '/wishlist/', '/order-status/'];
let cursor = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (cursor < routes.length) {
    const path = routes[cursor++];
    try {
      const response = await doc(path), html = response.body;
      check(`${path}: direct HTTP 200`, response.status === 200, response.status);
      const title = html.match(/<title>(.*?)<\/title>/s)?.[1] || '';
      const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1] || '';
      const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1]?.replaceAll('&amp;', '&') || '';
      const robots = html.match(/<meta name="robots" content="([^"]*)"/)?.[1] || '';
      check(`${path}: one title and description`, Boolean(title && description) && (html.match(/<title>/g) || []).length === 1 && (html.match(/name="description"/g) || []).length === 1);
      check(`${path}: self-canonical without redirects`, canonical === canonicalUrl(site, path), canonical);
      check(`${path}: one visible primary heading`, (html.match(/<h1[\s>]/g) || []).length === 1);
      check(`${path}: correct document language`, html.includes(`lang="${path.startsWith('/laboratory/europe') ? 'en' : 'sq'}"`));
      const privatePage = privateSeoPaths.includes(path.replace(/\/$/, ''));
      check(`${path}: correct index directive`, privatePage ? robots.includes('noindex') : !robots.includes('noindex') && robots.includes('index'));
      if (!privatePage) { check(`${path}: unique title`, !titles.has(title), titles.get(title)); titles.set(title, path); check(`${path}: unique description`, !descriptions.has(description), descriptions.get(description)); descriptions.set(description, path); }
      const graph = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)].flatMap(match => { try { const value = JSON.parse(match[1]); return value['@graph'] || [value]; } catch { return [null]; } });
      check(`${path}: structured data parses`, graph.length > 0 && graph.every(Boolean));
      check(`${path}: consistent WebPage identity`, graph.some(value => value?.['@type'] === 'WebPage' && value.url === canonical));
      check(`${path}: no invented delivery or article dates`, !/shippingRate|2026-07-30|"aggregateRating"/.test(JSON.stringify(graph)));
      const product = graph.find(value => value?.['@type'] === 'Product');
      if (product) {
        check(`${path}: valid product offer`, Number.isFinite(product.offers?.price) && product.offers.price >= 0 && product.offers.priceCurrency === 'EUR' && product.offers.url === canonical && ['https://schema.org/InStock', 'https://schema.org/OutOfStock'].includes(product.offers.availability));
        check(`${path}: product offer matches preview price`, html.includes(`property="product:price:amount" content="${product.offers.price}"`));
      }
      check(`${path}: complete social metadata`, ['og:title', 'og:description', 'og:url', 'og:image', 'twitter:card'].every(key => html.includes(`="${key}"`)));
      if (response.headers) check(`${path}: no accidental X-Robots noindex`, privatePage || !(response.headers.get('x-robots-tag') || '').includes('noindex'));
      for (const match of html.matchAll(/href="(\/[^"]*)"/g)) links.add(new URL(match[1].replaceAll('&amp;', '&'), site).pathname.replace(/\/$/, '') || '/');
      for (const match of html.matchAll(/(?:src|property="og:image" content)="((?:https:\/\/optika\.itdks\.tech)?\/[^"]+)"/g)) assets.add(new URL(match[1], site).pathname);
    } catch (error) { check(`${path}: fetched`, false, error.message); }
  }
}));
for (const url of urls) { const path = new URL(url).pathname.replace(/\/$/, '') || '/'; check(`${path}: has a crawlable incoming link`, links.has(path)); }
for (const asset of assets) {
  try { const result = base ? await fetch(base + asset, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(30000) }) : await stat(resolve(dist, asset.slice(1))); check(`Asset ${asset}`, base ? result.status === 200 : result.isFile()); } catch (error) { check(`Asset ${asset}`, false, error.message); }
}
const robots = base ? await (await fetch(base + '/robots.txt')).text() : await readFile(resolve(dist, 'robots.txt'), 'utf8');
check('Private HTML is crawlable so noindex can be read', !/Disallow: \/(?:account|staff|wishlist|order-status)/.test(robots));
check('API and uploads are excluded from crawl', robots.includes('Disallow: /api/') && robots.includes('Disallow: /uploads/'));
check('Sitemap is discoverable in robots', robots.includes(`Sitemap: ${site}/sitemap.xml`));
if (base) {
  for (const path of ['/not-a-real-optika-page/', '/syze-dielli/not-a-real-product/', '/api/seo.php']) { const response = await fetch(base + path, { redirect: 'manual' }); check(`${path}: real HTTP 404`, response.status === 404); }
}
const report = { at: new Date().toISOString(), scope: base || 'Generated release HTML', indexableURLs: urls.length, assets: assets.size, summary: { total: checks.length, verified: checks.filter(item => item.status === 'verified').length, failed: checks.filter(item => item.status === 'failed').length }, checks, limitations: ['Not proof of Google indexing, ranking or Rich Results acceptance', 'No Search Console/Business Profile/merchant account access or real-user Core Web Vitals data', 'Catalogue facts and clinical capabilities remain owner-confirmed, not independently certified'] };
await mkdir(dirname(out), { recursive: true }); await writeFile(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report.summary, indexableURLs: urls.length, report: out, failures: checks.filter(item => item.status === 'failed') }, null, 2));
if (report.summary.failed) process.exitCode = 1;
