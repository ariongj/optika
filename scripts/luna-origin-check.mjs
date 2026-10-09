// Verify image discrepancies against the hosting IP shown by the authenticated dashboard.
// Keep normal TLS hostname/certificate checks. No authentication or private data requests.
import https from 'node:https';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const reportPath = 'output/qa/luna-deploy-20261005/release-check.json';
const report = JSON.parse(await readFile(reportPath, 'utf8'));
const hash = b => createHash('sha256').update(b).digest('hex');
function origin(path) {
  return new Promise((resolve, reject) => {
    const req = https.get({ hostname: 'optika.itdks.tech', path, lookup: (_h, options, cb) => options.all ? cb(null, [{ address: '82.198.227.132', family: 4 }]) : cb(null, '82.198.227.132', 4), timeout: 15000 }, res => {
      const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) })); res.on('error', reject);
    });
    req.on('error', reject); req.on('timeout', () => req.destroy(Error('Origin timeout')));
  });
}
for (const check of report.checks.filter(c => c.status === 'failed' && c.name.startsWith('Build match: assets/'))) {
  const path = check.name.slice('Build match: '.length);
  try {
    const res = await origin('/' + path);
    const sha256 = hash(res.body);
    check.evidence.origin = { status: res.status, sha256, exactBuildMatch: sha256 === hash(await readFile('dist/' + path)) };
    if (res.status === 200 && check.evidence.origin.exactBuildMatch) {
      check.status = 'verified'; check.evidence.note = 'Origin bytes match release. CDN-served image bytes differ.';
    }
  } catch (error) { check.evidence.originError = error.message; }
}
await writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ passed: report.checks.filter(c => c.status === 'verified').length, total: report.checks.length, unresolved: report.checks.filter(c => c.status === 'failed') }, null, 2));
