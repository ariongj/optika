import assert from 'node:assert/strict';
import { uniqueModels, modelVariants, heroDestination } from '../src/commercePresentation.js';
import { products } from '../src/data/catalog.js';

assert.equal(uniqueModels(products).length, 12);
assert.equal(uniqueModels([{ id: 'a', image: 'same.jpg' }, { id: 'b', image: 'same.jpg' }]).length, 2, 'Unrelated models sharing a photograph stay discoverable');
assert.equal(uniqueModels([{ id: 'a' }, { id: 'a-blue', baseId: 'a' }]).length, 1, 'One card per model family');
for (const product of products) {
  const family = modelVariants(products, product);
  assert.ok(family.some((variant) => variant.id === product.id));
  assert.ok(family.every((variant) => (variant.baseId || variant.id) === (product.baseId || product.id)));
  assert.ok(family.every((variant) => Number.isFinite(variant.price) && Number.isFinite(variant.stock)));
}
assert.equal(heroDestination({primaryCta: 'Rezervo ekzaminimin'}, 'primary'), 'contact');
assert.equal(heroDestination({secondaryCta: 'Shiko kornizat'}, 'secondary'), 'shop');
assert.equal(heroDestination({primaryAction: 'sunglasses'}, 'primary'), 'sunglasses');
assert.equal(heroDestination({primaryAction: 'javascript:alert(1)'}, 'primary'), 'shop');
assert.equal(heroDestination({}, 'secondary'), 'contact');
console.log('PASS: 12 model families, 40 variant identities/prices/stocks, shared-image independence, legacy CMS CTA destinations and safe fallback.');
