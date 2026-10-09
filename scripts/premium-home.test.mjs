import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { products } from '../src/data/catalog.js';
import { homepageSelection } from '../src/premiumPresentation.js';
import { editorialMedia } from '../src/editorialMedia.js';
import { holdingDefaults } from '../src/holdingContent.js';

test('Homepage presents four unique, real catalogue models', () => {
  const cards = homepageSelection(products);
  assert.equal(cards.length, 4);
  assert.equal(new Set(cards.map(({product}) => product.baseId || product.id)).size, 4);
  for (const {product, variants} of cards) {
    assert.ok(products.includes(product));
    assert.ok(variants.includes(product));
    assert.ok(variants.every(item => (item.baseId || item.id) === (product.baseId || product.id)));
  }
});
test('Both homepage category controls filter products and their variants', () => {
  for (const kind of ['Sunglasses', 'Prescription Glasses']) {
    const cards = homepageSelection(products, kind);
    assert.equal(cards.length, Math.min(4, new Set(products.filter(product => product.type === kind).map(product => product.baseId || product.id)).size));
    assert.ok(cards.every(({product, variants}) => product.type === kind && variants.every(item => item.type === kind)));
  }
});
test('Curated CMS IDs are honoured; unknown IDs and duplicate models are safe', () => {
  const cards = homepageSelection(products, 'all', 'not-a-product,sol-s7, sol-s7');
  assert.equal(cards[0].product.id, 'sol-s7');
  assert.equal(cards.length, 4);
  assert.deepEqual(homepageSelection([], 'Sunglasses'), []);
});
test('Three new independent campaign images have responsive files and CMS allowlist entries', () => {
  const server = readFileSync('public/api/index.php', 'utf8');
  const sources = ['groupHeroImage','groupSunImage','groupCraftImage'].map(key => {
    assert.ok(server.includes(`'${key}'`));
    const [, path, responsive] = editorialMedia[key];
    assert.ok(responsive);
    assert.ok(existsSync('public' + path));
    assert.ok(existsSync('public' + path.replace('.webp','-small.webp')));
    return path;
  });
  assert.equal(new Set(sources).size, 3);
});
test('Client-confirmed 30 years is reflected in the default proposition and metadata', () => {
  assert.match(holdingDefaults.groupSubtitle, /30 vjet/);
  assert.match(holdingDefaults.groupSeoDescription, /30 vjet/);
  for (const file of ['src/App.jsx','src/EditorialPages.jsx','index.html','scripts/prerender.mjs']) {
    assert.doesNotMatch(readFileSync(file,'utf8'), /20\+|20 vjet|dy dekad/);
  }
});
