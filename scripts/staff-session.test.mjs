import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { confirmStaffLogout } from '../src/staffSession.js';

test('Successful server logout confirms the session ended', async () => {
  assert.deepEqual(await confirmStaffLogout(async () => ({ ok: true })), { confirmed: true, error: '' });
});

test('Network, invalid CSRF and rejected responses never masquerade as logout', async () => {
  for (const request of [
    async () => { throw new TypeError('Network unavailable'); },
    async () => { throw Object.assign(new Error('CSRF expired'), { code: 'invalid_csrf_token' }); },
    async () => ({ ok: false }),
    async () => null
  ]) {
    const result = await confirmStaffLogout(request);
    assert.equal(result.confirmed, false);
    assert.match(result.error, /Dalja nuk u konfirmua/);
  }
});

test('An authoritative expired-auth response also permits local session cleanup', async () => {
  const result = await confirmStaffLogout(async () => { throw Object.assign(new Error('Expired'), { code: 'authentication_required' }); });
  assert.deepEqual(result, { confirmed: true, error: '' });
});

test('Staff snapshot respects empty catalogue and never silently imports products', async () => {
  const source = await readFile('src/AdminPortal.jsx', 'utf8');
  assert.doesNotMatch(source, /apiPost\(["']import_products["']/);
  assert.match(source, /if \(Array\.isArray\(next\.products\) && canCms\(next\.cms\?\.permissions, 'catalog\.read'\)\) setStoreProducts\(publicProducts\(next\.products\)\)/);
  assert.match(source, /if \(result\.confirmed\)/);
  assert.match(source, /failure\.code = payload\.error/);
  assert.match(source, /setup_required: "Portali kërkon konfigurimin e hyrjes nga administratori teknik\."/);
  assert.doesNotMatch(source, /await mutate\("logout"/);
});
