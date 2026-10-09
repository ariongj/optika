// Local-only verification/preview. Never ship this script or its environment file.
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import net from 'node:net';
import http from 'node:http';
import assert from 'node:assert/strict';

const serve = process.argv.includes('--serve');
const live = process.argv.includes('--live');
if ((live || serve) && !process.env.OPENAI_API_KEY) throw Error('Load the approved .env.local without printing it.');
await new Promise((yes, no) => { const probe = net.createServer(); probe.once('error', () => no(Error('Optika port 4190 is occupied; no process was stopped.'))); probe.listen(4190, '127.0.0.1', () => probe.close(yes)); });
const reportDir = resolve('output/qa/luna-20261005');
const storage = resolve(reportDir, `run-${Date.now()}`);
await mkdir(storage, { recursive: true });
const php = resolve('tmp/php-8.5.9/php.exe');
const args = ['-d', `extension_dir=${resolve('tmp/php-8.5.9/ext')}`, '-d', 'extension=curl', '-d', 'disable_functions=mail', '-S', '127.0.0.1:4190', '-t', 'dist', 'scripts/seo-router.php'];
let server;
// The local QA transport bypasses unrelated workstation proxy settings.
function localRequest(options = {}) {
  return new Promise((resolve, reject) => {
    const body = options.body || '';
    const req = http.request({ hostname: '127.0.0.1', port: 4190, path: '/api/luna.php', method: options.method || 'GET',
      headers: { ...options.headers, ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}) } }, response => {
      let raw = ''; response.on('data', data => { raw += data; });
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, raw }));
    });
    req.on('error', reject); req.setTimeout(35000, () => req.destroy(Error('Local request timeout'))); req.end(body);
  });
}
async function start(key) {
  let diagnostic = '';
  server = spawn(php, args, { env: { ...process.env, OPENAI_API_KEY: key, OPTIKA_STORAGE_DIR: storage }, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  server.stderr.on('data', chunk => { diagnostic = (diagnostic + chunk.toString()).slice(-3000); });
  server.on('error', error => { throw error; });
  for (let i = 0; i < 50; i++) {
    if (server.exitCode !== null) throw Error('PHP preview failed to start');
    try { const r = await localRequest(); if (r.status === 200) return; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw Error('PHP preview did not become ready: ' + diagnostic);
}
async function stop() { if (server && server.exitCode === null) { const closed = new Promise(resolve => server.once('exit', resolve)); server.kill(); await closed; } }
if (serve) {
  await start(process.env.OPENAI_API_KEY);
  console.log(`LUNA preview ready at http://127.0.0.1:4190/virtual-try-on/?lang=en ; PID ${server.pid}; isolated storage ${storage}`);
  process.on('SIGINT', async () => { await stop(); process.exit(); });
  await new Promise(resolve => server.once('exit', resolve));
} else {
  const checks = [];
  function check(ok, name) { checks.push({ name, status: ok ? 'verified' : 'failed' }); assert.ok(ok, name); console.log(`PASS ${name}`); }
  let cookie = '', csrf = '';
  const request = async (body, headers = {}, method = body ? 'POST' : 'GET') => {
    const response = await localRequest({ method,
      headers: { Cookie: cookie, ...(body ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } : {}), ...headers },
      ...(body ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });
    if (response.headers['set-cookie']) cookie = response.headers['set-cookie'].map(value => value.split(';')[0]).join('; ');
    try { return { status: response.status, body: JSON.parse(response.raw) }; }
    catch { throw Error('Non-JSON local response: ' + response.raw.replaceAll(process.env.OPENAI_API_KEY || 'NO_KEY_TO_REDACT', '[redacted]').slice(0, 1200)); }
  };
  try {
    await start('');
    let initial = await request(); csrf = initial.body.csrf;
    check(initial.status === 200 && initial.body.available === false, 'Missing key honestly reports unavailable');
    const base = { question: 'How do I use the 3D viewer without a camera?', language: 'en', mode: 'viewer', status: 'viewer', productId: '', consent: true };
    check((await request(base)).body.error === 'configuration_required', 'No-key requests never fake an answer');
    await stop(); cookie = ''; await start(live ? process.env.OPENAI_API_KEY : 'synthetic-unused-key');
    initial = await request(); csrf = initial.body.csrf;
    check(initial.body.available && initial.body.model === 'gpt-6-luna', 'Endpoint has exact requested model and server-side key');
    check((await request(base, { 'X-CSRF-Token': '' })).status === 403, 'Missing CSRF blocked before provider');
    check((await request(base, { Origin: 'https://unrelated.example' })).status === 403, 'Cross-origin blocked');
    check((await request(base, { 'Sec-Fetch-Site': 'cross-site' })).status === 403, 'Cross-site fetch blocked');
    check((await request(null, {}, 'DELETE')).status === 405, 'Unsupported method blocked');
    check((await request(base, { 'Content-Type': 'text/plain' })).status === 415, 'Non-JSON request blocked');
    check((await request('{')).status === 422, 'Malformed JSON blocked');
    check((await request('x'.repeat(4097))).status === 413, 'Oversized request blocked');
    for (const change of [{ consent: false }, { photo: 'data:image/png;base64,AAA' }, { question: '' }, { mode: 'invalid' }, { status: 'invalid' }, { language: 'invalid' }, { history: [] }]) {
      check((await request({ ...base, ...change })).status === 422, `Input allowlist rejects ${Object.keys(change)[0]}`);
    }
    if (live) {
      for (const context of [base, { ...base, language: 'sq', mode: 'live', status: 'denied', question: 'Kamera është bllokuar. Çfarë të bëj?' }, { ...base, mode: 'photo', status: 'photo_ready', question: 'Can you see my face and measure my PD from the photo?' }]) {
        const result = await request(context);
        check(result.status === 200 && result.body.model === 'gpt-6-luna' && result.body.answer?.length > 20, `Real Luna response: ${context.language}/${context.mode}`);
        // Synthetic prompts/answers only; no secrets or customer inputs in evidence.
        checks.at(-1).answer = result.body.answer;
      }
    }
    const { createHash } = await import('node:crypto');
    const day = new Date().toISOString().slice(0, 10);
    const ipId = createHash('sha256').update(day + ':127.0.0.1').digest('hex');
    for (const [count, ago, name] of [[6, 1, 'Minute'], [20, 120, 'Hourly']]) {
      await writeFile(resolve(storage, 'luna-usage.json'), JSON.stringify({ day, attempts: count, clients: { [ipId]: Array(count).fill(Math.floor(Date.now()/1000)-ago) } }));
      check((await request(base)).body.error === 'usage_limit', `${name} request guard blocks before provider call`);
    }
    await writeFile(resolve(storage, 'luna-usage.json'), JSON.stringify({ day, attempts: 200, clients: {} }));
    check((await request(base)).body.error === 'usage_limit', 'Daily spend guard blocks before another provider call');
    const usage = JSON.parse(await readFile(resolve(storage, 'luna-usage.json'), 'utf8'));
    check(!JSON.stringify(usage).includes(base.question), 'Usage evidence stores no question or answer');
    console.log(`${checks.length} checks passed`);
  } finally {
    await stop();
    await writeFile(resolve(reportDir, live ? 'api-live.json' : 'api-offline.json'), JSON.stringify({ checks, liveProviderRequests: live ? 3 : 0, storage, deployed: false }, null, 2));
  }
}
