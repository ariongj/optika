// Fresh synthetic data, localhost only. Never uses customer/production records.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import net from 'node:net';
import { createHash } from 'node:crypto';
import { products } from '../src/data/catalog.js';
import { seoFetch as fetch } from './seo-fetch.mjs';
const root = resolve('.'), out = resolve('output/qa/seo'), data = resolve(out, `cms-${Date.now()}`);
await new Promise((done, reject) => { const probe = net.createServer(); probe.once('error', () => reject(new Error('Verify the existing owner of the assigned Optika port 4190 before running QA'))); probe.listen(4190, '127.0.0.1', () => probe.close(done)); });
await mkdir(data, { recursive: true });
const special = { ...products[0], id: 'seo-qa-special', sku: 'SEO-QA', name: 'Synthetic <frame> $1', description: 'Synthetic & isolated', metaDescription: 'Synthetic <description>', price: 123, salePrice: 99, stock: 0, staffNote: 'PRIVATE_SENTINEL', status: 'Published', baseId: undefined };
const draft = { ...special, id: 'seo-qa-draft', name: 'DO_NOT_PUBLISH', status: 'Draft' };
await writeFile(resolve(data, 'products.json'), JSON.stringify([...products, special, draft]));
await writeFile(resolve(data, 'content.json'), JSON.stringify({ shopSeoTitle: 'Synthetic CMS title $1', shopSeoDescription: 'Synthetic CMS description', shopTitle: 'Synthetic CMS heading', labEuropeImage: '/assets/brand/optika-lens-detail-2026.webp' }));
await writeFile(resolve(data, 'customers.json'), JSON.stringify([{ email: 'PRIVATE_CUSTOMER_SENTINEL' }]));
const fingerprint = async () => Object.fromEntries(await Promise.all((await readdir(data)).map(async name => [name, createHash('sha256').update(await readFile(resolve(data, name))).digest('hex')])));
const before = await fingerprint();
const server = spawn(resolve('tmp/php-8.5.9/php.exe'), ['-d', 'disable_functions=mail', '-S', '127.0.0.1:4190', '-t', 'dist', 'scripts/seo-router.php'], { windowsHide: true, stdio: 'ignore', env: { ...process.env, OPTIKA_STORAGE_DIR: data } });
const results = [], check = (name, pass) => results.push({ name, status: pass ? 'verified' : 'failed' });
const fetchDoc = async (path, options = {}) => { const response = await fetch('http://127.0.0.1:4190' + path, { redirect: 'manual', ...options }); return { response, html: await response.text() }; };
try {
  for (let i = 0; i < 40; i++) { try { await fetchDoc('/shop/'); break; } catch { await new Promise(done => setTimeout(done, 100)); } }
  const shop = await fetchDoc('/shop/');
  check('CMS title/description reach server HTML before JavaScript', shop.html.includes('<title>Synthetic CMS title $1</title>') && shop.html.includes('Synthetic CMS description'));
  check('CMS heading reaches server HTML', shop.html.includes('<h1>Synthetic CMS heading</h1>'));
  check('CMS laboratory social image reaches server HTML', (await fetchDoc('/laboratory/europe/')).html.includes('property="og:image" content="https://optika.itdks.tech/assets/brand/optika-lens-detail-2026.webp"'));
  check('Published additions have crawlable catalogue links', shop.html.includes('/syze-dielli/seo-qa-special/'));
  check('Drafts excluded from catalogue HTML', !shop.html.includes('DO_NOT_PUBLISH') && !shop.html.includes('/seo-qa-draft/'));
  const product = await fetchDoc('/syze-dielli/seo-qa-special/');
  check('CMS product URL renders without a static product directory', product.response.status === 200);
  check('Product copy is escaped, including replacement-token characters', product.html.includes('Synthetic &lt;frame&gt; $1'));
  const graph = JSON.parse(product.html.match(/id="optika-prerendered-structured-data"[^>]*>(.*?)<\/script>/s)[1])['@graph'];
  const entity = graph.find(entity => entity['@type'] === 'Product');
  check('CMS sale price appears in markup', entity.offers.price === 99);
  check('Zero stock is accurately marked OutOfStock', entity.offers.availability.endsWith('/OutOfStock'));
  check('Product breadcrumb and canonical match its actual identity', graph.find(entity => entity['@type'] === 'BreadcrumbList').itemListElement.at(-1).item === entity.offers.url);
  check('Private product fields and customer records never enter HTML', !product.html.includes('PRIVATE_SENTINEL') && !product.html.includes('PRIVATE_CUSTOMER_SENTINEL'));
  check('Draft product URLs return a real 404', (await fetchDoc('/syze-dielli/seo-qa-draft/')).response.status === 404);
  check('Removed product URLs return a real 404', (await fetchDoc('/syze-dielli/no-such-product/')).response.status === 404);
  const wrong = await fetchDoc('/syze-optike/seo-qa-special/');
  check('Wrong category redirects to the real product category', wrong.response.status === 301 && wrong.response.headers.get('location').endsWith('/syze-dielli/seo-qa-special/'));
  const legacy = await fetchDoc('/shop/?product=seo-qa-special');
  check('Legacy CMS query URL redirects to its descriptive canonical', legacy.response.status === 301 && legacy.response.headers.get('location').endsWith('/syze-dielli/seo-qa-special/'));
  const sitemap = await fetchDoc('/sitemap.xml');
  check('Sitemap reads published additions immediately', sitemap.html.includes('/seo-qa-special/'));
  check('Sitemap excludes drafts and private customer data', !sitemap.html.includes('/seo-qa-draft/') && !sitemap.html.includes('PRIVATE_'));
  check('Direct API renderer URL is not an indexable alternative', (await fetchDoc('/api/seo.php?route=shop')).response.status === 404);
  const head = await fetchDoc('/syze-dielli/seo-qa-special/', { method: 'HEAD' });
  check('HEAD has the same success status and no body', head.response.status === 200 && head.html === '');
  check('Writes are rejected', (await fetchDoc('/shop/', { method: 'POST' })).response.status === 405);
  check('Query parameters cannot select a different file or private route', (await fetchDoc('/shop/?route=../../customers')).html.includes('Synthetic CMS title $1'));
  // Explicit empty catalogue is never repopulated from the bundled seed.
  await writeFile(resolve(data, 'products.json'), '[]');
  const empty = await fetchDoc('/shop/'), emptyMap = await fetchDoc('/sitemap.xml');
  check('An empty catalogue has an honest recovery state', empty.html.includes('Aktualisht nuk ka modele të publikuara'));
  check('Empty catalogue removes product sitemap entries', !/\/syze-(?:dielli|optike)\//.test(emptyMap.html));
  await writeFile(resolve(data, 'products.json'), JSON.stringify([...products, special, draft]));
  check('SEO requests never modify operational data', JSON.stringify(await fingerprint()) === JSON.stringify(before));
  const report = { at: new Date().toISOString(), scope: 'Isolated synthetic CMS data, mail disabled, localhost 4190 only', checks: results, summary: { total: results.length, verified: results.filter(item => item.status === 'verified').length, failed: results.filter(item => item.status === 'failed').length } };
  await writeFile(resolve(out, 'cms-qa.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report.summary, failures: results.filter(item => item.status === 'failed') }, null, 2));
  if (report.summary.failed) process.exitCode = 1;
  if (process.env.OPTIKA_SEO_KEEP_SERVER === '1') { await writeFile(resolve(data, 'products.json'), JSON.stringify(products)); await writeFile(resolve(data, 'content.json'), '{}'); await writeFile(resolve(out, 'preview-server.json'), JSON.stringify({ pid: server.pid, port: 4190, data, router: 'scripts/seo-router.php' })); server.unref(); }
} finally { if (process.env.OPTIKA_SEO_KEEP_SERVER !== '1') server.kill(); }
