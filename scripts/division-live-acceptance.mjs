// Anonymous GET-only deployment checks. No cookies, auth, form submissions,
// account creation, orders or public catalogue API maintenance are requested.
// Run only after deployment: node scripts/division-live-acceptance.mjs --deployed
import https from 'node:https';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { editorialMedia } from '../src/editorialMedia.js';
import { products, blogPosts } from '../src/data/catalog.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const base = 'https://optika.itdks.tech';
const reportSlug = process.argv.find(value => value.startsWith('--report-dir='))?.split('=')[1] || 'division-release';
if (!/^[a-z0-9-]+$/.test(reportSlug)) throw new Error('Invalid report slug');
const output = join(root, 'output/qa', reportSlug, 'live-acceptance.json');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(await readFile(join(root, 'output/qa', reportSlug, 'deployment-package.json'), 'utf8'));
const release = manifest.artifact;
if (!/^optika-itdks-[a-z0-9-]+\.zip$/.test(release) || manifest.target !== base) throw new Error('The local manifest is not the intended release/target.');
if (sha(await readFile(join(root, 'release', release))) !== manifest.sha256) throw new Error('Archive hash differs from verified manifest');
const localHome = await readFile(join(root, 'dist/index.html'), 'utf8');
if (sha(Buffer.from(localHome)) !== manifest.manifest.find(entry => entry.path === 'index.html')?.sha256) throw new Error('Current build differs from the release');
const bundles = [...localHome.matchAll(/(?:src|href)="(\/assets\/index-[^\"]+\.(?:js|css))"/g)].map(match => match[1]);
if (bundles.length !== 2) throw new Error('Expected exactly one main script and stylesheet');
if (!process.argv.includes('--deployed')) {
  console.log(JSON.stringify({ status: 'prepared_only', release, target: base, bundles, networkRequests: 0, message: 'Await deployment confirmation before running with --deployed.' }, null, 2));
  process.exit(0);
}

const checks = [];
const redirects = [];
let requestCount = 0;
const record = (name, passed, detail = {}) => checks.push({ name, status: passed ? 'verified' : 'failed', ...detail });
function get(path, maxBytes = 3 * 1024 * 1024, depth = 0) {
  return new Promise((resolve, reject) => {
    requestCount++;
    const request = https.get(base + path, {
      headers: { 'User-Agent': 'MiftariReleaseAcceptance/1.0', Accept: '*/*', 'Accept-Encoding': 'identity' },
    }, response => {
      if ([301, 302, 307, 308].includes(response.statusCode) && response.headers.location) {
        const target = new URL(response.headers.location, base + path);
        response.resume();
        if (target.origin !== base || depth >= 3) return reject(new Error('Off-target or excessive redirect rejected'));
        redirects.push({ from: path, to: target.pathname + target.search, status: response.statusCode });
        return resolve(get(target.pathname + target.search, maxBytes, depth + 1));
      }
      const chunks = []; let length = 0; let settled = false;
      const finish = truncated => {
        if (settled) return;
        settled = true;
        resolve({ status: response.statusCode, contentType: response.headers['content-type'] || '', body: Buffer.concat(chunks), truncated, path });
      };
      response.on('data', chunk => {
        const remaining = maxBytes - length;
        chunks.push(chunk.subarray(0, Math.max(0, remaining))); length += chunk.length;
        if (length > maxBytes) { finish(true); response.destroy(); }
      });
      response.on('end', () => finish(false));
      response.on('error', error => { if (!settled) reject(error); });
    });
    request.setTimeout(18000, () => request.destroy(new Error('HTTPS request timed out')));
    request.on('error', reject);
  });
}
async function inspect(name, run) {
  try { await run(); } catch (error) {
    const codes = [error.code, ...(error.errors || []).map(cause => cause.code)].filter(Boolean);
    record(name, false, { error: error.message || error.name || 'Transport failure', ...(codes.length ? { transportCodes: [...new Set(codes)] } : {}) });
  }
}
const routes = ['/', '/optical', '/laboratory', '/laboratory/kosovo', '/laboratory/europe', '/laboratory/partners', '/clinic', '/shop', '/sunglasses', '/prescription-glasses', '/lens-focus', '/virtual-try-on', '/account', '/staff', '/contact', '/policies'];
if (release.includes('menu-lens')) routes.push('/about', '/ekzaminimi', '/order-status', '/wishlist', ...blogPosts.map(post => `/lens-focus/articles/${post.slug}`));
for (const route of routes) await inspect(route, async () => {
  const response = await get(route);
  record(`${route}: available HTML`, response.status === 200 && /text\/html/i.test(response.contentType) && !response.truncated, { httpStatus: response.status, bytes: response.body.length });
  if (response.status !== 200 || response.truncated) return;
  const html = response.body.toString('utf8');
  for (const bundle of bundles) record(`${route}: correct release ${bundle.endsWith('.js') ? 'script' : 'stylesheet'}`, html.includes(bundle));
  const lang = route === '/laboratory/europe' ? 'en' : 'sq';
  record(`${route}: document language`, html.includes(`<html lang="${lang}">`), { expected: lang });
  const canonical = html.match(/<link[^>]+rel="canonical"[^>]+href="([^\"]+)"/)?.[1];
  record(`${route}: canonical matches target`, canonical === base + route, { canonical: canonical || null });
  record(`${route}: no old-domain metadata`, !html.includes('https://optikamiftari.com'));
  record(`${route}: one primary heading`, (html.match(/<h1[\s>]/g) || []).length === 1);
  if (route === '/lens-focus' && release.includes('menu-lens')) {
    record('Lens Focus: new heading and metadata', html.includes('Bota juaj. Në fokus.') && html.includes('Lentet tuaja, hap pas hapi'));
    record('Lens Focus: optional 3D and staff bundles not preloaded', !/<link[^>]*modulepreload[^>]*(?:three-|AdminPortal-|LegacyAssemblyScene)/.test(html));
  }
  if (['/staff', '/account'].includes(route)) record(`${route}: private page is noindex`, /<meta name="robots" content="noindex, nofollow"/.test(html));
  if (['/laboratory/europe', '/laboratory/kosovo'].includes(route)) {
    const schemaMatches = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
    const schemas = schemaMatches.map(match => JSON.parse(match[1]));
    const graph = schemas.flatMap(schema => schema['@graph'] || [schema]);
    const page = graph.find(item => item['@type'] === 'WebPage');
    const lab = graph.find(item => item['@type'] === 'Organization' && item.name === 'Optical Lab');
    record(`${route}: market-specific page metadata`, page?.url === base + route && page.inLanguage === lang);
    record(`${route}: lab parent identity`, lab?.url === base + route && Boolean(lab.parentOrganization));
    record(`${route}: no unrelated retail schema`, !schemas.some(schema => /"Optician"|"ReserveAction"|"makesOffer"/.test(JSON.stringify(schema))));
    const imageKey = route.endsWith('/europe') ? 'labEuropeImage' : 'labKosovoImage';
    record(`${route}: market image metadata`, html.includes(`property="og:image" content="${base}${editorialMedia[imageKey][1]}"`));
    record(`${route}: application anchor`, html.includes('id="application"'));
    record(`${route}: cautious documentation statement`, route.endsWith('/europe') ? html.includes('No verified certificates are currently published') : html.includes('pa dokumente të verifikuara'));
  }
});

const assets = new Map(bundles.map(asset => [asset, 'exact']));
if (reportSlug === 'feature-polish') {
  for (const entry of manifest.manifest) {
    if (/^assets\/VirtualTryOn3D-.*\.(?:js|css)$/.test(entry.path) || ['crafted-lens/index.html', 'crafted-lens/lens3d.js'].includes(entry.path)) assets.set('/' + entry.path, 'exact');
  }
}
for (const [, image, responsive] of Object.values(editorialMedia)) {
  assets.set(image, image.endsWith('.webp') ? 'exact' : 'presence');
  if (responsive) assets.set(image.replace('.webp', '-small.webp'), 'exact');
}
assets.set('/assets/brand/optika-miftari-monogram.png', 'presence');
if (release.includes('menu-lens')) {
  assets.set('/crafted-lens/index.html', 'exact');
  assets.set('/crafted-lens/lens3d.js', 'exact');
}
for (const image of new Set(products.flatMap(product => [product.image, ...(product.gallery || [])]))) if (image) assets.set(image, image.endsWith('.webp') ? 'exact' : 'presence');
const assetList = [...assets]; let cursor = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  while (cursor < assetList.length) {
    const [asset, mode] = assetList[cursor++];
    await inspect(asset, async () => {
      const response = await get(asset);
      const isImage = /\.(?:webp|png|jpe?g)$/i.test(asset);
      const available = response.status === 200 && response.body.length > 0 && !response.truncated && (!isImage || /^image\//.test(response.contentType));
      const local = await readFile(join(root, 'dist', asset.slice(1)));
      const exactMatch = sha(response.body) === sha(local);
      record(`Asset ${asset}`, available && (mode !== 'exact' || exactMatch), {
        httpStatus: response.status, bytes: response.body.length, check: mode,
        exactMatchToLocalBuild: exactMatch,
        ...(mode === 'presence' ? { note: 'PNG/JPEG CDN compression can change bytes; this verifies image delivery, not pixel equivalence.' } : {}),
      });
    });
  }
}));

for (const route of ['/api/index.php?resource=session', '/api/account.php?resource=session']) await inspect(route, async () => {
  const response = await get(route, 65536);
  // Never persist response bodies or session headers to the report.
  let payload = null; try { payload = JSON.parse(response.body); } catch {}
  record(`${route}: anonymous session`, response.status === 200 && payload?.authenticated === false && !payload?.csrf, { httpStatus: response.status });
});
for (const route of ['/api/index.php?resource=snapshot', '/api/index.php?resource=submissions', '/api/index.php?resource=orders', '/api/account.php?resource=profile']) await inspect(route, async () => {
  const response = await get(route, 65536);
  record(`${route}: anonymous access denied`, response.status === 401, { httpStatus: response.status, bodySaved: false });
});
await inspect('Submission endpoint rejects GET', async () => {
  const response = await get('/api/submit.php', 65536);
  record('Submission endpoint rejects GET', response.status === 405, { httpStatus: response.status });
});

const protectedPaths = [
  '/.htaccess', '/.env', '/optika-miftari-data/', '/optika-miftari-data/submissions.json',
  '/' + release, '/optika-itdks-whole-site-20260929-r6.zip',
  '/optika-pre-divisions-public-20260929.zip', '/optika-pre-divisions-data-20260929.zip',
  '/optika-pre-whole-site-public-20260929.zip',
  '/optika-pre-features-public-20260929-r8.zip', '/optika-pre-features-data-20260929-r8.zip',
  '/optika-miftari-data/credentials.json',
];
if (release.includes('menu-lens')) protectedPaths.push('/optika-pre-menu-lens-public-20260930-r9.zip');
for (const route of protectedPaths) await inspect(route, async () => {
  const response = await get(route, 65536);
  record(`${route}: not publicly retrievable`, [403, 404].includes(response.status), { httpStatus: response.status, bodySaved: false });
});
await inspect('Unknown public page is a real 404', async () => {
  const response = await get('/release-acceptance-page-does-not-exist', 65536);
  record('Unknown public page is a real 404', response.status === 404, { httpStatus: response.status });
});

const failed = checks.filter(check => check.status === 'failed');
const report = {
  checkedAt: new Date().toISOString(), domain: base, release, releaseSha256: manifest.sha256,
  scope: 'Anonymous GET-only release verification; no authentication or business-record mutations requested',
  summary: { checked: checks.length, verified: checks.length - failed.length, failed: failed.length, httpsRequests: requestCount },
  limitations: ['No browser layout/interaction check', 'No actual B2B submission, staff login, order, payment or email tested', 'Public catalogue endpoint intentionally skipped because it invokes expired-reservation maintenance', 'Presence-only PNG/JPEG checks do not establish decoded pixel equivalence'],
  ordersSubmitted: 0, applicationsSubmitted: 0, accountsCreated: 0, authenticatedRequests: 0,
  redirects, checks,
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report.summary, report: output, failures: failed }, null, 2));
if (failed.length) process.exitCode = 1;
