import assert from 'node:assert/strict';
import { products } from '../src/data/catalog.js';
import { searchProducts, normalizeSearch } from '../src/catalogSearch.js';
import { accountOrderMatches, isOrderReady, isAppointmentOpen, queueItems, orderNextStep } from '../src/servicePresentation.js';

const checks = [];
const test = (name, run) => { run(); checks.push(name); console.log('PASS ' + name); };
test('Albanian polarization query matches product flags', () => {
  const result = searchProducts(products, 'të polarizuara');
  assert.ok(result.length > 0); assert.ok(result.every((p) => p.polarized));
});
test('Diacritics and word order do not change blue-light results', () => {
  assert.deepEqual(searchProducts(products, 'Dritë blu').map((p) => p.id), searchProducts(products, 'blu drite').map((p) => p.id));
  assert.ok(searchProducts(products, 'Dritë blu').length > 0);
});
test('Multi-token terms search across fields', () => assert.ok(searchProducts(products, 'syze dielli').every((p) => p.type === 'Sunglasses')));
test('SKU and exact model searches rank first', () => { const p = products.find((p) => p.sku); assert.equal(searchProducts(products, p.sku)[0].id, p.id); });
test('Unknown searches stay empty, not fabricated recommendations', () => assert.equal(searchProducts(products, 'zzzzznonexistent').length, 0));
test('Color labels work in Albanian', () => { const result = searchProducts(products, 'e zeze', (value) => value === 'Black gold' ? 'E zezë me ar' : value); assert.ok(result.length > 0); });
test('Search normalization handles punctuation', () => assert.equal(normalizeSearch('NOV / N04'), 'nov n04'));
const orders = [
  { id: 'OM-1', status: 'Ready', fulfillmentStatus: 'Ready for pickup', paymentStatus: 'Paid', items: [{ name: 'Syze të zeza', sku: 'SKU-1' }] },
  { id: 'OM-2', status: 'Cancelled', fulfillmentStatus: 'Ready for pickup' },
  { id: 'OM-3', status: 'Completed', fulfillmentStatus: 'Delivered', paymentStatus: 'Paid' },
  { id: 'OM-4', status: 'In lab', paymentStatus: 'Awaiting payment' },
  { id: 'OM-5', status: 'Returned', fulfillmentStatus: 'Ready for pickup', paymentStatus: 'Refunded' }
];
test('Cancelled and returned orders never count as ready', () => assert.deepEqual(orders.filter(isOrderReady).map((o) => o.id), ['OM-1']));
test('Account active filter excludes closed states', () => assert.deepEqual(orders.filter((o) => accountOrderMatches(o, 'active')).map((o) => o.id), ['OM-1','OM-4']));
test('Account search covers item SKU and accents', () => { assert.ok(accountOrderMatches(orders[0], 'all', 'SKU-1')); assert.ok(accountOrderMatches(orders[0], 'all', 'zeza')); });
test('Queue count and destination use identical rules', () => assert.deepEqual(queueItems(orders, 'ready', 'Orders'), orders.filter(isOrderReady)));
test('A filter from another module does not hide records', () => assert.deepEqual(queueItems(orders, 'published', 'Orders'), orders));
test('Payment queue excludes cancelled, returned and paid', () => assert.deepEqual(queueItems(orders, 'unpaid', 'Orders').map((o) => o.id), ['OM-4']));
test('Closed appointments are not counted as open', () => { for (const status of ['Completed','Closed','Cancelled']) assert.equal(isAppointmentOpen({ status }), false); });
test('Cancellation and returns have honest next steps', () => { assert.match(orderNextStep(orders[1]), /anuluar/); assert.match(orderNextStep(orders[4]), /Kthimi/); });
test('Stock queue includes zero and low stock only', () => assert.equal(queueItems([{ stock: 0 }, { stock: 5 }, { stock: 6 }], 'low', 'Products').length, 2));
console.log(`${checks.length} service-refinement checks passed.`);
