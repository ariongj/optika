// Synthetic public-endpoint activation test. Does not load a local key or customer data.
import https from 'node:https';
import { writeFile } from 'node:fs/promises';
const origin = 'https://optika.itdks.tech';
let cookie = '', csrf = '';
const checks = [];
const check = (name, ok, evidence) => { checks.push({ name, status: ok ? 'verified' : 'failed', evidence }); };
function request(path, payload, extra = {}) {
  return new Promise((resolve, reject) => {
    const raw = payload ? JSON.stringify(payload) : '';
    const req = https.request(origin + path, { method: raw ? 'POST' : 'GET', timeout: 35000,
      headers: { Cookie: cookie, ...(raw ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(raw), 'X-CSRF-Token': csrf, Origin: origin } : {}), ...extra } }, res => {
      if (res.headers['set-cookie']) cookie = res.headers['set-cookie'].map(v => v.split(';')[0]).join('; ');
      const chunks = []; res.on('data', c => chunks.push(c)); res.on('error', reject);
      res.on('end', () => { const text = Buffer.concat(chunks).toString(); let body = {}; try { body = JSON.parse(text); } catch {} resolve({ status: res.statusCode, body }); });
    });
    req.on('timeout', () => req.destroy(Error('Timeout'))); req.on('error', reject); req.end(raw);
  });
}
const initial = await request('/api/luna.php'); csrf = initial.body.csrf || '';
check('Luna active on real domain', initial.status === 200 && initial.body.available === true && initial.body.model === 'gpt-6-luna', { status: initial.status, available: initial.body.available, model: initial.body.model });
const prompt = { question: 'Si ta përdor modelin 3D pa ndezur kamerën?', language: 'sq', mode: 'viewer', status: 'viewer', productId: '', consent: true };
if (initial.body.available) {
  const badCsrf = await request('/api/luna.php', prompt, { 'X-CSRF-Token': '' });
  check('Invalid CSRF blocked', badCsrf.status === 403, badCsrf.status);
  const badConsent = await request('/api/luna.php', { ...prompt, consent: false });
  check('Missing consent blocked', badConsent.status === 422, badConsent.status);
  const badImage = await request('/api/luna.php', { ...prompt, photo: 'synthetic-not-an-image' });
  check('Unapproved image field blocked', badImage.status === 422, badImage.status);
  const result = await request('/api/luna.php', prompt);
  check('Real-domain Albanian GPT-6 Luna response', result.status === 200 && result.body.model === 'gpt-6-luna' && result.body.answer?.length > 20, { status: result.status, model: result.body.model, answer: result.body.answer, error: result.body.error });
}
for (const path of ['/.env.local', '/luna.env', '/optika-miftari-data/luna.env', '/api/storage/luna.env', '/optika-itdks-luna-demo-20261005-r17.zip']) {
  const r = await request(path); check('Private path not public: ' + path, [403, 404].includes(r.status), r.status);
}
const report = { at: new Date().toISOString(), target: origin, checks, passed: checks.filter(c => c.status === 'verified').length, total: checks.length };
await writeFile('output/qa/luna-activation-20261005/live-api.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (report.passed !== report.total) process.exitCode = 1;
