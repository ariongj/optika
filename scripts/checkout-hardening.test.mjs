import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { transformWithEsbuild } from 'vite';
import { checkoutDeliveryErrors, confirmedCheckoutOrder, checkoutWithDeadline } from '../src/checkoutExperience.js';
import { emptyCheckoutCustomer, readCheckoutDraft, checkoutDraftKey, createCheckoutRequestIdentity } from '../src/checkoutDraft.js';

const customer = { ...emptyCheckoutCustomer(), firstName: 'Test', lastName: 'Customer', email: 'checkout@example.test', phone: '+383 44 123 456', address: 'Test Street 1', city: 'Mitrovicë', postcode: '40000' };
const memory = () => { const values = new Map(); return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; };

test('Delivery validates the complete guest journey without requiring an account', () => {
  assert.deepEqual(checkoutDeliveryErrors(customer), {});
  assert.deepEqual(Object.keys(checkoutDeliveryErrors(emptyCheckoutCustomer())), ['firstName', 'lastName', 'email', 'phone', 'address', 'city', 'postcode']);
  assert.ok(checkoutDeliveryErrors({ ...customer, firstName: '   ' }).firstName);
  assert.ok(checkoutDeliveryErrors({ ...customer, email: 'missing-at.test' }).email);
});

test('Pickup does not require a hidden delivery address', () => {
  assert.deepEqual(checkoutDeliveryErrors({ ...customer, shipping: 'pickup', address: '', city: '', postcode: '', country: '' }), {});
});

test('Telephone permits ordinary international formatting but rejects prose and invalid lengths', () => {
  for (const phone of ['+38344123456', '(044) 123-456', '044 123 456']) assert.equal(checkoutDeliveryErrors({ ...customer, phone }).phone, undefined, phone);
  for (const phone of ['abc1234567', '123', '+1234567890123456', ' ']) assert.ok(checkoutDeliveryErrors({ ...customer, phone }).phone, phone);
});

test('Shipping choices and postal formats are checked before final review', () => {
  assert.ok(checkoutDeliveryErrors({ ...customer, shipping: 'unknown' }).shipping);
  assert.ok(checkoutDeliveryErrors({ ...customer, country: 'unknown' }).country);
  assert.ok(checkoutDeliveryErrors({ ...customer, postcode: '' }).postcode);
  for (const postcode of ['40000', '1001', 'AB 123']) assert.equal(checkoutDeliveryErrors({ ...customer, postcode }).postcode, undefined);
});

test('Confirmation requires explicit server acceptance, matching reference and numeric total', () => {
  const order = { id: 'OM-TEST', total: 123.45 };
  assert.equal(confirmedCheckoutOrder({ accepted: true, order }, 'OM-TEST'), order);
  assert.equal(confirmedCheckoutOrder({ accepted: true, duplicate: true, order }, 'OM-TEST'), order);
  for (const result of [null, { ok: true }, { accepted: true }, { accepted: false, order }, { accepted: true, order: { ...order, id: 'OM-OTHER' } }, { accepted: true, order: { ...order, total: '123.45' } }, { accepted: true, order: { ...order, total: -1 } }, { accepted: true, order: { ...order, total: NaN } }]) assert.equal(confirmedCheckoutOrder(result, 'OM-TEST'), null);
});

test('Checkout deadline returns completed work and preserves original rejection', async () => {
  assert.equal(await checkoutWithDeadline(Promise.resolve('accepted'), 100), 'accepted');
  const original = Object.assign(new Error('stock'), { code: 'insufficient_stock' });
  await assert.rejects(checkoutWithDeadline(Promise.reject(original), 100), error => error === original);
});

test('Checkout deadline returns an unknown state, never an invented cancellation or success', async () => {
  await assert.rejects(checkoutWithDeadline(new Promise(() => {}), 5), error => error.code === 'checkout_timeout');
});

test('The exact checkout reference survives timeout and reload without persisting payload details', async () => {
  const storage = memory();
  const first = createCheckoutRequestIdentity(storage, 'guest', webcrypto);
  const payload = { items: [{ productId: 'test', quantity: 1 }], customer: { note: 'SENSITIVE_NOT_STORED' } };
  const id = await first.get(payload);
  await assert.rejects(checkoutWithDeadline(new Promise(() => {}), 5));
  assert.equal(await first.get(payload), id);
  assert.equal(await createCheckoutRequestIdentity(storage, 'guest', webcrypto).get(payload), id);
  assert.ok(!JSON.stringify([...storage.values.values()]).includes('SENSITIVE_NOT_STORED'));
});

test('Drafts without valid expiration metadata cannot persist indefinitely', () => {
  const storage = memory();
  for (const savedAt of [undefined, null, 'yesterday', Date.now() - 86400001, Date.now() + 60000]) {
    storage.setItem(checkoutDraftKey('guest'), JSON.stringify({ customer, savedAt }));
    assert.deepEqual(readCheckoutDraft(storage, 'guest'), emptyCheckoutCustomer());
  }
  storage.setItem(checkoutDraftKey('guest'), JSON.stringify({ customer, savedAt: Date.now() }));
  assert.equal(readCheckoutDraft(storage, 'guest').firstName, 'Test');
  assert.equal(readCheckoutDraft(storage, 'another-owner').firstName, '');
});

test('Future-dated idempotency metadata is rejected rather than reused indefinitely', async () => {
  const storage = memory();
  const payload = { items: [] };
  const first = await createCheckoutRequestIdentity(storage, 'guest', webcrypto).get(payload);
  const saved = JSON.parse(storage.getItem('optika-checkout-request:guest'));
  storage.setItem('optika-checkout-request:guest', JSON.stringify({ ...saved, createdAt: Date.now() + 60000 }));
  assert.notEqual(await createCheckoutRequestIdentity(storage, 'guest', webcrypto).get(payload), first);
});

test('Rendered component source wires consent, pending guards and honest recovery', async () => {
  const app = await readFile('src/App.jsx', 'utf8');
  const cart = app.slice(app.indexOf('function CartDrawer('), app.indexOf('export default App;'));
  assert.match(app, /<CartDrawer\s+key=\{customerSession\?\.profile\?\.id \|\| "guest"\}/);
  assert.match(cart, /confirmedCheckoutOrder\(result, id\)/);
  assert.match(cart, /checkoutWithDeadline\(submitPublicRecord\(/);
  assert.match(cart, /<fieldset className="checkout-review-fields" disabled=\{isSubmitting\}/);
  assert.match(cart, /checked=\{reviewConsent\.contact\}/);
  assert.match(cart, /checked=\{reviewConsent\.policies\}/);
  assert.match(cart, /Statusi nuk është konfirmuar/);
  assert.doesNotMatch(cart, /completeOrder\(pendingOrder/);
  assert.match(cart, /tabIndex=\{-1\}><strong>\{pendingOrder\?\.uncertain/);
  await transformWithEsbuild(app, 'src/App.jsx', { loader: 'jsx', jsx: 'automatic' });
});

test('Prescription reentry blocks continue and final submit and has an explicit recovery action', async () => {
  const app = await readFile('src/App.jsx', 'utf8');
  const cart = app.slice(app.indexOf('function CartDrawer('));
  assert.match(cart, /configuration\?\.prescriptionNeedsReentry/);
  assert.equal((cart.match(/stockIssues\.length \|\| prescriptionIssues\.length/g) || []).length, 2);
  assert.match(cart, /!stockIssues\.length && !prescriptionIssues\.length/);
  assert.match(cart, /Plotëso recetën —/);
});

test('Quick view communicates selection and uses a bounded current gallery index', async () => {
  const app = await readFile('src/App.jsx', 'utf8');
  const quick = app.slice(app.indexOf('function ProductQuickView('), app.indexOf('function LensTechnology('));
  assert.match(quick, /images\[visibleImageIndex\]/);
  assert.match(quick, /aria-pressed=\{index === visibleImageIndex\}/);
  assert.match(quick, /aria-pressed=\{Boolean\(wishlist\?\.has\(product.id\)\)\}/);
  assert.match(quick, /aria-label="Sasia e zgjedhur"/);
  assert.doesNotMatch(quick, /: "Me porosi"/);
});
