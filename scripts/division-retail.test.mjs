import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { products } from '../src/data/catalog.js';
import { uniqueModels } from '../src/commercePresentation.js';

const server = await createServer({ configLoader: 'runner', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, watch: null }, appType: 'custom' });
after(() => server.close());
const { default: PremiumHome } = await server.ssrLoadModule('/src/AtelierHome.jsx');
const { EditorialHome, EditorialLaboratory, EditorialAbout } = await server.ssrLoadModule('/src/EditorialPages.jsx');
const shared = { navigate() {}, openQuickView() {}, toggleWishlist() {}, wishlist: new Set(), label: value => value, products };

test('The retail homepage puts shopping first and preserves all group destinations', () => {
  const html = renderToStaticMarkup(createElement(PremiumHome, shared));
  assert.ok(html.indexOf('atelier-selection') < html.indexOf('atelier-divisions'));
  const divisionNav = html.match(/<nav class="atelier-divisions"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(divisionNav);
  for (const route of ['/optical', '/laboratory', '/clinic']) assert.ok(divisionNav.includes(`href="${route}"`));
  assert.ok(divisionNav.includes('href="/about"'));
  assert.match(html, /MIFTARI HOLDING GROUP/);
  assert.match(html, /krijuara me AI/);
  const ids = [...html.matchAll(/data-testid="product-open-([^\"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, 4);
  for (const id of ids) assert.ok(products.some(product => product.id === id));
});

test('Retail redesign preserves custom CMS copy and honest empty catalogue', () => {
  const html = renderToStaticMarkup(createElement(PremiumHome, {...shared, products: [], content:{groupTitle:'Custom title',groupSubtitle:'Custom subtitle',groupHeroImage:'/uploads/campaign.webp'}}));
  assert.match(html, /Custom title/);
  assert.match(html, /Custom subtitle/);
  assert.match(html, /src="\/uploads\/campaign.webp"/);
  assert.match(html, /Nuk ka modele/);
  assert.doesNotMatch(html, /data-testid="product-open-/);
});

test('Optical expands the existing catalogue without making up identities or losing quick view', () => {
  const html = renderToStaticMarkup(createElement(EditorialHome, shared));
  const ids = [...html.matchAll(/data-testid="product-open-([^\"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, Math.min(8, uniqueModels(products).length));
  assert.equal(new Set(ids.map(id => { const product = products.find(item => item.id === id); assert.ok(product); return product.baseId || product.id; })).size, ids.length);
  assert.match(html, /aria-label="Përzgjedhja në Optical"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /optical-selection-footer/);
  assert.match(html, /Pjesë e Miftari Holding Group/);
});

test('New Optical homepage retains its independent CMS hero and both CTA destinations', () => {
  const html = renderToStaticMarkup(createElement(PremiumHome, {...shared, optical:true, content:{heroTitle:'Optical custom title',heroSubtitle:'Optical custom subtitle',heroImage:'/uploads/optical.webp',primaryCta:'Custom shopping action',primaryAction:'sunglasses',secondaryCta:'Custom visit action',secondaryAction:'examination',groupTitle:'Not the optical heading'}}));
  assert.match(html, /Optical custom title/);
  assert.match(html, /Optical custom subtitle/);
  assert.match(html, /src="\/uploads\/optical.webp"/);
  assert.match(html, /href="\/sunglasses" class="atelier-button light">Custom shopping action/);
  assert.match(html, /href="\/ekzaminimi" class="atelier-secondary">Custom visit action/);
  assert.doesNotMatch(html, /Not the optical heading/);
});

test('The Optical empty catalogue renders honest recovery rather than fabricated cards', () => {
  const html = renderToStaticMarkup(createElement(EditorialHome, { ...shared, products: [] }));
  assert.match(html, /Nuk ka modele në këtë përzgjedhje/);
  assert.doesNotMatch(html, /data-testid="product-open-/);
});

test('The laboratory points to separate Kosovo, Europe and B2B pages without claiming certification', () => {
  const html = renderToStaticMarkup(createElement(EditorialLaboratory, shared));
  for (const route of ['/laboratory/kosovo', '/laboratory/europe', '/laboratory/partners']) assert.ok(html.includes(`href="${route}"`), route);
  assert.match(html, /lang="en"/);
  assert.match(html, /technical documentation/);
  assert.doesNotMatch(html, /certified|CE certified|ISO 13485 certified|EU compliant/i);
});

test('About distinguishes department ownership from physical locations', () => {
  const html = renderToStaticMarkup(createElement(EditorialAbout, shared));
  assert.match(html, /zotëron Optical, Optical Lab dhe Klinikën Miftari/);
  assert.match(html, /Departamenti i shitjes/);
  assert.match(html, /Departamenti i punimit/);
  assert.match(html, /Departamenti klinik/);
  assert.doesNotMatch(html, /Tri lokacione|Tre lokacione|three locations/i);
});

test('Retail campaign uses its own registered image and scoped responsive styling', async () => {
  const source = await readFile('src/EditorialPages.jsx', 'utf8');
  const style = await readFile('src/styles/division-retail.css', 'utf8');
  assert.match(source, /name="opticalLifestyleImage"/);
  assert.match(source, /fotografi ilustruese e fushatës Optical/);
  assert.match(style, /\.mh-division-entry/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(style, /@media \(max-width: 600px\)/);
  assert.match(style, /focus-visible/);
});
