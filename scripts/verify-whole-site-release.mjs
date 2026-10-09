import https from 'node:https';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const base = 'https://optika.itdks.tech';
const reportRoot = new URL('../output/qa/whole-site/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('deployment-package.json', reportRoot), 'utf8'));
await mkdir(new URL('live-images/', reportRoot), { recursive: true });
function get(path, redirects = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(base + path, { headers: { 'User-Agent': 'OptikaReleaseVerification/1.0' } }, response => {
      if ([301, 302, 307, 308].includes(response.statusCode) && response.headers.location) {
        const target = new URL(response.headers.location, base + path);
        response.resume();
        if (target.origin !== base || redirects >= 3) return reject(new Error('Unexpected redirect'));
        return resolve(get(target.pathname + target.search, redirects + 1));
      }
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks) }));
    });
    request.setTimeout(20000, () => request.destroy(new Error('Request timeout')));
    request.on('error', reject);
  });
}
const checks = [];
const publicFiles = manifest.manifest.filter(file => file.path !== '.htaccess');
let next = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (next < publicFiles.length) {
    const file = publicFiles[next++];
    try {
      const response = await get('/' + file.path);
      const sha256 = createHash('sha256').update(response.body).digest('hex');
      if (sha256 !== file.sha256 && response.status === 200 && /\.(png|jpe?g)$/i.test(file.path)) {
        await writeFile(new URL('live-images/' + file.path.replaceAll('/', '_'), reportRoot), response.body);
      }
      checks.push({ path: file.path, status: response.status, exactMatch: sha256 === file.sha256, verified: response.status === 200 && sha256 === file.sha256 });
    } catch (error) {
      checks.push({ path: file.path, verified: false, error: error.message });
    }
  }
}));
for (const path of ['/.htaccess', '/optika-pre-whole-site-public-20260929.zip', '/optika-itdks-whole-site-20260929-r6.zip']) {
  const response = await get(path);
  checks.push({ path, status: response.status, verified: [403, 404].includes(response.status) });
}
checks.sort((a, b) => a.path.localeCompare(b.path));
const report = { checkedAt: new Date().toISOString(), domain: base, release: manifest.artifact, scope: 'Anonymous read-only exact-byte release verification', checks };
await writeFile(new URL('live-exact-release.json', reportRoot), JSON.stringify(report, null, 2));
const failed = checks.filter(check => !check.verified);
console.log(JSON.stringify({ checked: checks.length, publicFilesChecked: publicFiles.length, exactPublicFiles: checks.filter(check => check.exactMatch && check.verified).length, failures: failed }, null, 2));
if (failed.length) process.exitCode = 1;
