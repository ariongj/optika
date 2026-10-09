import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { accountIdentity, emptyAccountData, accountDataForSession, mergeAccountData, accountPaymentUrl } from '../src/accountState.js';

const a = { authenticated: true, profile: { id: 'ACC-A', firstName: 'A' } };
const b = { authenticated: true, profile: { id: 'ACC-B', firstName: 'B' } };
const complete = { ...a, orders: [{ id: 'ORDER-A' }], appointments: [{ id: 'VISIT-A' }] };

test('Login establishes identity but does not claim an empty history has loaded', () => {
  assert.equal(accountIdentity(a), 'ACC-A');
  const result = mergeAccountData(emptyAccountData(), a);
  assert.equal(result.loaded, false);
  assert.deepEqual(result.orders, []);
  assert.deepEqual(result.appointments, []);
});

test('Only the complete profile response establishes loaded customer history', () => {
  assert.equal(mergeAccountData(emptyAccountData(), { ...a, orders: [] }).loaded, false);
  const result = mergeAccountData(emptyAccountData(), complete);
  assert.equal(result.loaded, true);
  assert.equal(result.orders[0].id, 'ORDER-A');
  assert.equal(result.appointments[0].id, 'VISIT-A');
});

test('Session expiry removes access to cached order and appointment records immediately', () => {
  const data = mergeAccountData(emptyAccountData(), complete);
  assert.deepEqual(accountDataForSession(data, { authenticated: false, profile: a.profile }), emptyAccountData());
  assert.deepEqual(mergeAccountData(data, { authenticated: false }), emptyAccountData());
});

test('Switching customers never retains previous customer records, even before effect cleanup', () => {
  const data = mergeAccountData(emptyAccountData(), complete);
  assert.deepEqual(accountDataForSession(data, b), emptyAccountData('ACC-B'));
  const switched = mergeAccountData(data, b);
  assert.deepEqual(switched, emptyAccountData('ACC-B'));
  assert.equal(mergeAccountData(switched, { ...b, orders: [], appointments: [] }).loaded, true);
});

test('Non-destructive profile updates preserve the same customer history', () => {
  const data = mergeAccountData(emptyAccountData(), complete);
  assert.deepEqual(mergeAccountData(data, a), data);
  assert.equal(accountDataForSession(data, a), data);
  assert.deepEqual(data.orders, [{ id: 'ORDER-A' }]);
});

test('Absent or malformed authenticated identity cannot expose private records', () => {
  const data = mergeAccountData(emptyAccountData(), complete);
  for (const session of [null, {}, { authenticated: true }, { authenticated: true, profile: {} }]) {
    assert.equal(accountIdentity(session), '');
    assert.deepEqual(accountDataForSession(data, session), emptyAccountData());
  }
});

test('Paid, refunded, cancelled and returned orders never invite a duplicate payment', () => {
  const order = { status: 'Confirmed', paymentStatus: 'Awaiting payment', paymentLink: 'https://payments.example.test/order' };
  assert.equal(accountPaymentUrl(order), order.paymentLink);
  for (const status of ['Cancelled', 'Returned', 'Return requested']) assert.equal(accountPaymentUrl({ ...order, status }), '');
  for (const paymentStatus of ['Paid', 'Refunded']) assert.equal(accountPaymentUrl({ ...order, paymentStatus }), '');
  for (const paymentLink of ['', 'javascript:alert(1)', 'http://payments.example.test/order', 'https://user:password@example.test/order']) assert.equal(accountPaymentUrl({ ...order, paymentLink }), '');
});

test('Account UI keeps terms separate and bounds requests without persisting form secrets', async () => {
  const source = await readFile('src/AccountPage.jsx', 'utf8');
  assert.match(source, /href="\/policies" target="_blank" rel="noopener noreferrer"/);
  assert.match(source, /currentIdentity\.current !== accountId/);
  assert.match(source, /return \(\) => profileRequest\.current\?\.abort\(\)/);
  assert.match(source, /setTimeout\(abort, 15000\)/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
  assert.doesNotMatch(source, /setLoaded\(true\)/);
});
