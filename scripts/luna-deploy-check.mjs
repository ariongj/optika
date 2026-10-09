// Read-only public deployment verification; never reads local secrets or private records.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { seoFetch } from './seo-fetch.mjs';
const base = 'https://optika.itdks.tech';
const reportDir = resolve('output/qa/luna-deploy-20261005');
const pkg = JSON.parse(await readFile('output/qa/luna-20261005/package.json', 'utf8'));
const checks = [];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const record = (name, ok, evidence) => checks.push({ name, status: ok ? 'verified' : 'failed', evidence });
const paths = pkg.entries.filter(path => /^(assets|mediapipe|crafted-lens)\//.test(path) && !path.endsWith('.html'));
let cursor = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (cursor < paths.length) {
    const path = paths[cursor++];
    try {
      const res = await seoFetch(`${base}/${path}`);
      const remoteHash = hash(Buffer.from(await res.arrayBuffer()));
      record(`Build match: ${path}`, res.status === 200 && remoteHash === hash(await readFile(resolve('dist', path))), { status: res.status, sha256: remoteHash });
    } catch (error) { record(path, false, error.message); }
  }
}));
for (const [path, validate] of [
  ['/api/index.php?resource=public', b => b.ok && Array.isArray(b.products) && b.products.length > 0],
  ['/api/index.php?resource=session', b => b.ok && b.authenticated === false && b.email === ''],
  ['/api/account.php?resource=session', b => b.ok && b.authenticated === false && b.profile === null],
  ['/api/cms-public.php', b => b.ok],
  ['/api/luna.php', b => b.ok && b.model === 'gpt-6-luna' && typeof b.available === 'boolean'],
]) {
  const res = await seoFetch(base + path);
  const body = JSON.parse(await res.text());
  record(path, res.status === 200 && validate(body), { status: res.status, ...(path.includes('luna') ? { model: body.model, available: body.available } : {}) });
}
for (const path of ['/.env.local', '/optika-miftari-data/luna.env', '/optika-pre-luna-data-20261005-r16.zip', '/optika-itdks-luna-upgrade-20261005-r16.zip']) {
  const res = await seoFetch(base + path);
  record(`Not public: ${path}`, [403, 404].includes(res.status), { status: res.status });
}
const report = { at: new Date().toISOString(), target: base, release: pkg.artifact, releaseSha256: pkg.sha256, checks, limitations: ['No authenticated customer/admin mutations or real orders/payments submitted', 'Luna key activation pending explicit private destination confirmation'] };
await mkdir(reportDir, { recursive: true });
await writeFile(resolve(reportDir, 'release-check.json'), JSON.stringify(report, null, 2));
const failures = checks.filter(c => c.status === 'failed');
console.log(JSON.stringify({ checks: checks.length, passed: checks.length - failures.length, failures, luna: checks.find(c => c.name === '/api/luna.php') }, null, 2));
if (failures.length) process.exitCode = 1;
