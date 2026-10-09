// Read-only source/build acceptance checks. This script never contacts a server.
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { editorialMedia } from '../src/editorialMedia.js';
import { holdingDefaults, groupRoutes } from '../src/holdingContent.js';
import { products } from '../src/data/catalog.js';
import { applyLabInitialInterest, initialLabPartnerFields } from '../src/labPartnerForm.js';
import { canonicalUrl, seoGraph } from '../src/seo.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const read = name => readFile(path.join(root, name), 'utf8');
const exists = async name => { try { return (await stat(name)).isFile(); } catch { return false; } };
const routes = ['/', '/optical', '/laboratory', '/clinic', '/laboratory/partners', '/laboratory/kosovo', '/laboratory/europe'];
const routeFile = route => path.join(dist, route.replace(/^\//, ''), 'index.html');
const checks = [];
const check = (name, passed, evidence = '') => checks.push({ name, status: passed ? 'verified' : 'failed', evidence });
const [app, main, lab, form, clinic, editorial, home, prerender] = await Promise.all([
  'src/App.jsx', 'src/main.jsx', 'src/LabMarketPages.jsx', 'src/LabPartnerApplication.jsx',
  'src/HoldingPages.jsx', 'src/EditorialPages.jsx', 'src/PremiumHome.jsx', 'scripts/prerender.mjs',
].map(read));
const source = [app, lab, form, clinic, editorial, home].join('\n');
const docs = new Map();
for (const route of routes) {
  const found = await exists(routeFile(route));
  check(`${route}: packaged HTML`, found);
  if (!found) continue;
  const html = await readFile(routeFile(route), 'utf8');
  docs.set(route, html);
  const language = route === '/laboratory/europe' ? 'en' : 'sq';
  check(`${route}: correct document language`, html.includes(`<html lang="${language}">`), language);
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  check(`${route}: route-specific canonical`, Boolean(canonical && canonical === canonicalUrl('https://optika.itdks.tech', route)), canonical || 'missing');
  check(`${route}: one primary heading`, (html.match(/<h1[\s>]/g) || []).length === 1);
  check(`${route}: titled and described`, /<title>[^<]+<\/title>/.test(html) && /<meta name="description" content="[^\"]+"/.test(html));
  check(`${route}: no accidental noindex`, !/<meta name="robots" content="[^\"]*noindex/.test(html));
  const scripts = [...html.matchAll(/<script[^>]+src="(\/[^\"]+)"/g)].map(m => m[1]);
  check(`${route}: runtime chunk included`, scripts.length > 0);
  for (const script of scripts) check(`${route}: ${script}`, await exists(path.join(dist, script.slice(1))));
}

const seenLinks = new Set();
for (const [route, html] of docs) {
  for (const match of html.matchAll(/\b(?:href|src)="([^\"]+)"/g)) {
    const target = match[1];
    if (!target.startsWith('/') || target.startsWith('//')) continue;
    const url = new URL(target, 'https://example.invalid');
    if (seenLinks.has(url.pathname)) continue;
    seenLinks.add(url.pathname);
    const targetPath = path.join(dist, url.pathname.slice(1));
    const found = await exists(targetPath) || await exists(path.join(targetPath, 'index.html'));
    check(`Public reference: ${url.pathname}`, found, `referenced by ${route}`);
  }
}

const suppliedRoutes = new Set([...lab.matchAll(/href="(\/[^\"]+)"/g)].map(m => m[1].split('#')[0]));
for (const route of suppliedRoutes) check(`Lab source link packaged: ${route}`, await exists(routeFile(route)));
for (const [key, [, image, responsive]] of Object.entries(editorialMedia)) {
  check(`Editorial image: ${key}`, await exists(path.join(dist, image.slice(1))), image);
  if (responsive) {
    const small = image.replace('.webp', '-small.webp');
    check(`Responsive image: ${key}`, await exists(path.join(dist, small.slice(1))), small);
  }
}
const uniqueProductImages = [...new Set(products.flatMap(item => [item.image, ...(item.gallery || [])]).filter(Boolean))];
for (const image of uniqueProductImages) check(`Catalogue image: ${image}`, image.startsWith('/') && await exists(path.join(dist, image.slice(1))));

for (const [key, route] of Object.entries(groupRoutes)) check(`App route mapping: ${key}`, key === 'home' || app.includes(`page: "${key}"`) || app.includes(`page: '${key}'`), route);
check('English page uses a dedicated English footer', /page === 'labEurope' \? <LabEuropeFooter/.test(app));
check('Runtime HTML language changes with route', /document\.documentElement\.lang = page === 'labEurope' \? 'en' : 'sq'/.test(app));
for (const style of ['division-retail.css', 'lab-markets.css', 'clinic-department.css']) check(`Scoped stylesheet loaded: ${style}`, main.includes(style));
check('Repeated documentation CTA increments an explicit request counter', /function requestDocumentation\(\)\s*\{\s*setInterest\('documentation'\);\s*setInterestRequestKey\(value => value \+ 1\);\s*\}/.test(lab) && lab.includes('onClick={requestDocumentation}'));
check('Topic request counter is passed through both component boundaries', lab.includes('initialInterest={interest} interestRequestKey={interestRequestKey}') && form.includes('initialInterest={initialInterest} interestRequestKey={interestRequestKey}'));
check('Topic effect listens for repeated requests without remounting the form', form.includes('}, [initialInterest, interestRequestKey])') && form.includes('key={`${marketSegment}-${language}-${path}`}'));
check('Topic effect retains guards for pending, uncertain and confirmed attempts', form.includes("applyLabInitialInterest(current, initialInterest, { pending: pending.current, hasAttempt: Boolean(attempt.current), submitted: state.status === 'success' })"));
const entered = { ...initialLabPartnerFields('eu'), name: 'Audit Example', organization: 'Example Optical', email: 'audit@example.test', country: 'DE', consent: true };
const selected = applyLabInitialInterest(entered, 'documentation');
check('Documentation topic change preserves all entered business fields', selected.interest === 'documentation' && JSON.stringify({ ...selected, interest: entered.interest }) === JSON.stringify(entered));
const manuallyChanged = { ...selected, interest: 'mounting' };
const selectedAgain = applyLabInitialInterest(manuallyChanged, 'documentation');
check('Documentation request can reselect topic after manual topic change', selectedAgain.interest === 'documentation' && selectedAgain.email === entered.email && selectedAgain.name === entered.name);
for (const blockedState of ['pending', 'hasAttempt', 'submitted']) check(`Documentation request never mutates ${blockedState} form state`, applyLabInitialInterest(entered, 'documentation', { [blockedState]: true }) === entered);
check('Unknown requested topics do not mutate form state', applyLabInitialInterest(entered, 'unsupported-topic') === entered);
check('Runtime metadata removes stale prerendered route schema', app.includes("document.getElementById('optika-prerendered-structured-data')?.remove()") && app.includes('document.getElementById(dynamicSchemaId)?.remove()'));
check('Runtime removes the previous base schema before building a route-specific graph', app.includes('head script[data-optika-base-schema]') && app.includes('forEach(script => script.remove())') && app.includes('JSON.stringify(seoGraph('));
check('Runtime laboratory social image uses validated CMS image or registered fallback', app.includes("const imageKey = page === 'labEurope' ? 'labEuropeImage' : 'labKosovoImage'") && app.includes('safeEditorialImage(homepageContent[imageKey]) || editorialMedia[imageKey][1]'));
const euGraph = seoGraph({ site: 'https://optika.itdks.tech', path: '/laboratory/europe', title: 'Lab', description: 'Partnership', language: 'en' })['@graph'];
check('Runtime market metadata includes localized WebPage and Holding parent', euGraph.some(item => item['@type'] === 'WebPage' && item.inLanguage === 'en') && euGraph.some(item => item.name === 'Optical Lab' && item.parentOrganization) && !euGraph.some(item => item['@type'] === 'Optician'));
check('English business-data disclosure is provided inline', form.includes('How this business enquiry is used') && form.includes('Authorised Miftari staff') && form.includes('id="lab-application-privacy"'));
check('Privacy disclosure does not imply automatic marketing consent', form.includes('does not automatically subscribe you to marketing'));
check('Both market applications use the same actual intake component', lab.includes('marketSegment={marketSegment} locale={locale}') && form.includes('submitLabPartnerApplication'));
check('Lab application does not accept free patient records', !form.includes('<textarea') && form.includes('Do not include patient information or prescriptions'));
check('Application receipt is explicitly not approval', form.includes('This is not partner approval'));
check('Lab pages explicitly avoid unverifiable certification claims', lab.includes('No certification, approval or EU market authorisation is implied') && holdingDefaults.labDocumentationNoteEn.includes('No verified certificates'));
check('New division source contains no positive certification superlatives', !/(?:ISO\s?\d+.{0,30}certified|CE[- ]certified|fully EU compliant|guaranteed surgery|100% success)/i.test([lab, clinic, editorial, home].join('\n')));
check('Clinic booking is not presented as automatic treatment approval', clinic.includes('Ky nuk është konfirmim takimi') && clinic.includes('Ky formular nuk rezervon ndërhyrje'));
check('Three departments are distinct without invented three-location claim', home.includes('zotëron Optical, Optical Lab dhe Klinikën Miftari') && !/Tri lokacione|Tre lokacione|three locations/i.test([home, clinic, lab].join('\n')));

const euHtml = docs.get('/laboratory/europe') || '';
const euBody = euHtml.split('<body>')[1] || '';
check('EU no-JavaScript body avoids Albanian retail labels', !/Rezervo|Llogaria ime|Politikat|Kërko|Gjurmo|Kontaktoni/.test(euBody));
for (const anchor of ['application', 'documentation']) check(`EU static anchor: #${anchor}`, euBody.includes(`id="${anchor}"`));
const schemaBlocks = [...euHtml.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(match => {
  try { return JSON.parse(match[1]); } catch { return null; }
});
check('EU metadata JSON-LD parses', schemaBlocks.length > 0 && schemaBlocks.every(Boolean));
check('EU metadata identifies the laboratory, not only the retail optician', schemaBlocks.some(schema => JSON.stringify(schema).includes('Optical Lab')));
check('EU metadata excludes unrelated retail examination/reservation schema', !schemaBlocks.some(schema => /"Optician"|"ReserveAction"|"makesOffer"/.test(JSON.stringify(schema))));
for (const [route, language] of [['/laboratory/europe', 'en'], ['/laboratory/kosovo', 'sq']]) {
  const html = docs.get(route) || '';
  const graph = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap(match => {
    try { const schema = JSON.parse(match[1]); return schema['@graph'] || [schema]; } catch { return []; }
  });
  const webPage = graph.find(item => item['@type'] === 'WebPage');
  const organization = graph.find(item => item.name === 'Optical Lab');
  check(`${route}: market-specific WebPage metadata`, webPage?.inLanguage === language && webPage.url === canonicalUrl('https://optika.itdks.tech', route));
  check(`${route}: stable laboratory division metadata points to its parent page`, Boolean(organization?.parentOrganization) && new URL(organization.url).pathname === '/laboratory/');
}
const euSocialImage = euHtml.match(/property="og:image" content="([^"]+)"/)?.[1] || '';
check('EU social image is specific to the laboratory', euSocialImage.includes('miftari-lab-partnership'), euSocialImage);

const report = {
  createdAt: new Date().toISOString(), scope: 'Read-only source and generated-build audit; no browser, server or external requests',
  routes, catalogueProducts: products.length, distinctProductImages: uniqueProductImages.length,
  summary: { total: checks.length, verified: checks.filter(item => item.status === 'verified').length, failed: checks.filter(item => item.status === 'failed').length },
  limitations: ['Not a browser layout or accessibility test', 'No actual public form submission or protected user workflow performed', 'Existing catalogue stock, prices, clinical capability and certificates are not independently verified'], checks,
};
const reportSlug = process.env.OPTIKA_AUDIT_REPORT || 'division-release';
if (!/^[a-z0-9-]+$/.test(reportSlug)) throw new Error('Invalid audit report slug');
const destination = path.join(root, 'output/qa', reportSlug, 'static-audit.json');
await mkdir(path.dirname(destination), { recursive: true });
await writeFile(destination, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report.summary, report: destination, failures: checks.filter(item => item.status === 'failed') }, null, 2));
if (report.summary.failed) process.exitCode = 1;
