import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reloadableProductPath, shopProductId } from '../src/productRoutes.js';
const bundled = [{id: 'seed', type: 'Sunglasses'}];
test('bundled routes stay compatible with generated Hostinger pages', () => {
  assert.equal(reloadableProductPath('seed', bundled), '/syze-dielli/seed');
  assert.equal(reloadableProductPath({id:'seed', type:'Optical'}, bundled), '/syze-dielli/seed');
});
test('CMS additions have reloadable share URLs, independent of category', () => {
  const path = reloadableProductPath({id:'new / frame', type:'Sunglasses'}, bundled);
  assert.equal(path, '/shop?product=new%20%2F%20frame');
  const url = new URL(path, 'https://example.test');
  assert.equal(shopProductId(url.pathname, url.search), 'new / frame');
  assert.equal(shopProductId('/clinic', '?product=x'), null);
  assert.equal(shopProductId('/shop', '?product='), null);
  assert.equal(reloadableProductPath(null), '/shop');
});
