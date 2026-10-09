import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { request } from 'node:http';

// Run against the isolated local PHP preview only; never submits an order.
const base = 'http://127.0.0.1:4190';
const checks = [];
async function check(path, expected, options = {}) {
  const response = await new Promise((resolve, reject) => {
    const req = request(`${base}${path}`, { method: options.method || 'GET', headers: options.headers }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('Local PHP preview timed out')));
    req.end(options.body);
  });
  const data = JSON.parse(response.body);
  assert.equal(response.status, expected, path);
  checks.push({ path, status: response.status, passed: true });
  return data;
}
const publicData = await check('/api/index.php?resource=public', 200);
assert.equal(publicData.products.length, 40);
await check('/api/index.php?resource=orders', 401);
const session = await check('/api/account.php?resource=session', 200);
assert.equal(session.authenticated, false);
await check('/api/account.php?resource=profile', 401);
await check('/api/submit.php', 405);
await check('/api/submit.php', 422, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base },
  body: JSON.stringify({ type: 'appointment' }),
});
const app = await readFile('src/App.jsx', 'utf8');
assert.match(app, /EditorialHome/);
const lensPage = await readFile('src/LensFocusPage.jsx', 'utf8');
assert.equal((lensPage.match(/storyOpen && <LensStory/g) || []).length, 1);
const source = await readFile('src/EditorialPages.jsx', 'utf8');
assert.match(source, /laboratorin tonë privat/);
assert.match(source, /aria-modal="true"/);
const result = { checkedAt: new Date().toISOString(), environment: base, checks, sourceChecks: ['editorial home mounted', 'one lens animation mount', 'private laboratory proposition', 'filter modal semantics'], boundaries: ['no order submitted', 'no account created or password changed', 'no mail sent', 'no production requests'] };
await mkdir('output/qa/reference-rework', { recursive: true });
await writeFile('output/qa/reference-rework/api-checks.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
