import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalUrl, seoGraph, socialImagePath, privateSeoPaths } from '../src/seo.js';
import { reloadableProductPath } from '../src/productRoutes.js';

const site = 'https://optika.itdks.tech';
test('HTML canonical URLs use the real directory URL without filter noise', () => {
  for (const [path, expected] of [['/', '/'], ['/lens-focus', '/lens-focus/'], ['/lens-focus/', '/lens-focus/'], ['/shop?sort=price#filter', '/shop/'], ['/shop?product=cms&sort=price', '/shop/?product=cms'], ['/404.html', '/404.html']]) assert.equal(canonicalUrl(site, path), site + expected);
});
test('private utility pages have a noindex contract, not a robots disallow', () => {
  for (const path of ['/account', '/staff', '/wishlist', '/order-status']) assert.ok(privateSeoPaths.includes(path));
});
test('social previews use the existing JPEG derivative', () => {
  assert.equal(socialImagePath('/assets/products/nov.webp'), '/assets/social/nov.jpg');
  assert.equal(socialImagePath('/uploads/products/new.webp'), '/uploads/products/new.webp');
});
test('CMS products get a real category route without a static rebuild', () => {
  assert.equal(reloadableProductPath({ id: 'cms-frame', type: 'Sunglasses' }), '/syze-dielli/cms-frame');
  assert.equal(reloadableProductPath({ id: 'cms-frame', type: 'Prescription Glasses' }), '/syze-optike/cms-frame');
  assert.equal(reloadableProductPath({ id: 'same', type: 'Prescription Glasses' }, [{ id: 'same', type: 'Sunglasses' }]), '/syze-optike/same');
});
test('every public route shares the same website and holding identity', () => {
  for (const path of ['/', '/clinic', '/laboratory/europe', '/optical']) {
    const graph = seoGraph({ site, path, title: 'A', description: 'B' })['@graph'];
    assert.ok(graph.find(entity => entity['@type'] === 'WebSite'));
    assert.ok(graph.find(entity => entity['@id'] === site + '/#holding-group'));
    assert.equal(graph.find(entity => entity['@type'] === 'WebPage').url, canonicalUrl(site, path));
  }
});
test('EU Lab is not falsely described as the retail optician or a certified clinic', () => {
  const graph = seoGraph({ site, path: '/laboratory/europe', title: 'Lab', description: 'Partnership', language: 'en' })['@graph'];
  assert.ok(!graph.some(entity => entity['@type'] === 'Optician'));
  assert.equal(graph.find(entity => entity['@type'] === 'WebPage').inLanguage, 'en');
  assert.equal(graph.find(entity => entity.name === 'Optical Lab').url, site + '/laboratory/');
});
test('product schema reflects actual price and stock without fabricated shipping or brand', () => {
  for (const stock of [0, 3]) {
    const product = { id: 'cms', name: 'Frame', price: 120, salePrice: 100, stock, image: '/assets/products/nov.webp', description: 'Frame', sku: 'CMS', staffNote: 'PRIVATE' };
    const schema = seoGraph({ site, path: '/syze-dielli/cms', title: 'Frame', description: 'Frame', product });
    const entity = schema['@graph'].find(entity => entity['@type'] === 'Product');
    assert.equal(entity.offers.price, 100);
    assert.equal(entity.offers.availability, stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock');
    assert.equal(entity.brand, undefined);
    assert.equal(entity.offers.shippingDetails, undefined);
    assert.equal(entity.offers.hasMerchantReturnPolicy, undefined);
    assert.ok(!JSON.stringify(schema).includes('PRIVATE'));
  }
});
test('article dates are only emitted when an actual date is supplied', () => {
  const article = { title: 'Guide', excerpt: 'Excerpt', category: 'Lenses' };
  const render = article => seoGraph({ site, path: '/lens-focus/articles/guide', title: 'Guide', description: 'Excerpt', article })['@graph'].find(entity => entity['@type'] === 'Article');
  assert.equal(render(article).datePublished, undefined);
  assert.equal(render({ ...article, datePublished: '2026-09-01' }).datePublished, '2026-09-01');
  assert.equal(render({ ...article, datePublished: 'unknown' }).datePublished, undefined);
});
