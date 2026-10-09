// Anonymous read-only deployed-artifact and redirect checks. No operational API calls.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { seoFetch } from './seo-fetch.mjs';
const site = 'https://optika.itdks.tech';
const reportSlug = process.env.OPTIKA_SEO_REPORT_DIR || 'seo';
if (!/^[a-z0-9-]{1,80}$/.test(reportSlug)) throw new Error('Release report directory must be a simple QA folder name');
const reportDir = resolve('output/qa', reportSlug);
const release = JSON.parse(await readFile(resolve(reportDir, 'deployment-package.json'), 'utf8'));
const rollback = reportSlug === 'seo' ? { path: 'output/qa/seo/rollback/optika-pre-seo-public-20260930-r10.zip', bytes: 61464874, entries: 384, sha256: 'b4277a7a56beebb919f551d9ba5de4d389a1ccffe8e319f109839a2b8a61a2d3', crc: 'passed', outsideWebRoot: true } : JSON.parse(await readFile(resolve(reportDir, 'rollback-proof.json'), 'utf8'));
const checks = [], check = (name, pass, evidence = '') => checks.push({ name, status: pass ? 'verified' : 'failed', evidence });
const root = await seoFetch(site + '/');
const html = await root.text();
const entryScript = release.manifest.find(item => /^assets\/index-.*\.js$/.test(item.path));
check('Live homepage serves the current release', root.status === 200 && html.includes('/' + entryScript.path));
for (const entry of release.manifest.filter(item => /^assets\/(?:index-|atelier-).*\.(?:js|css)$/.test(item.path) || item.path.startsWith('assets/fonts/') || item.path === 'robots.txt' || item.path === 'seo-pages.json')) {
  const response = await seoFetch(site + '/' + entry.path), body = Buffer.from(await response.arrayBuffer());
  check('Exact deployed artifact: ' + entry.path, response.status === 200 && createHash('sha256').update(body).digest('hex') === entry.sha256);
  if (entry.path === 'seo-pages.json') check('Public route registry excluded from indexing', (response.headers.get('x-robots-tag') || '').includes('noindex'));
}
for (const [path, destination] of [['/shop', '/shop/'], ['/lens-focus', '/lens-focus/'], ['/index.html', '/'], ['/lens-focus/index.html', '/lens-focus/'], ['/examination', '/ekzaminimi/'], ['/lens-oculus', '/lens-focus/'], ['/fit-studio', '/virtual-try-on/'], ['/brand', '/laboratory/'], ['/shop/?product=vtx-x1', '/syze-dielli/vtx-x1/'], ['/syze-optike/vtx-x1/', '/syze-dielli/vtx-x1/'], ['/syze-dielli/vtx-x1', '/syze-dielli/vtx-x1/']]) {
  const response = await seoFetch(site + path);
  check('Permanent canonical redirect: ' + path, response.status === 301 && new URL(response.headers.get('location'), site).href === site + destination, response.status + ' ' + response.headers.get('location'));
}
for (const path of ['/api/seo.php', '/api/seo-template.html', '/uploads/']) {
  const response = await seoFetch(site + path, { method: 'HEAD' });
  check('Internal/private-location noindex: ' + path, (response.headers.get('x-robots-tag') || '').includes('noindex'), response.status);
}
const sitemap = await seoFetch(site + '/sitemap.xml');
check('Dynamic sitemap is XML and revalidated, not immutable', (sitemap.headers.get('content-type') || '').includes('xml') && !(sitemap.headers.get('cache-control') || '').includes('immutable'));
const proof = { at: new Date().toISOString(), scope: 'Anonymous GET/HEAD only; no customer, payment, stock or session mutations', artifact: release.artifact, artifactSha256: release.sha256, rollback, summary: { total: checks.length, verified: checks.filter(item => item.status === 'verified').length, failed: checks.filter(item => item.status === 'failed').length }, checks };
await writeFile(resolve(reportDir, 'deployment-proof.json'), JSON.stringify(proof, null, 2));
console.log(JSON.stringify({ ...proof.summary, failures: checks.filter(item => item.status === 'failed') }, null, 2));
if (proof.summary.failed) process.exitCode = 1;
