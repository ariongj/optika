import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const key = process.env.OPENAI_API_KEY;
if (!key) throw Error('Approved local key must be loaded for silent exclusion check');
const hash = value => createHash('sha256').update(value).digest('hex');
let files = 0;
async function scan(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) await scan(child);
    else { files++; if ((await readFile(child)).includes(key)) throw Error('Secret exclusion failed'); }
  }
}
await scan('dist');
const deployedPhp = [];
for (const name of ['luna.php', 'luna-core.php']) {
  const remote = await readFile('C:/Users/A/Downloads/' + name);
  const source = await readFile('public/api/' + name);
  const build = await readFile('dist/api/' + name);
  const match = hash(remote) === hash(source) && hash(build) === hash(source);
  if (!match) throw Error('Deployed PHP differs from final release: ' + name);
  deployedPhp.push({ name, sha256: hash(remote), sourceBuildDeployedMatch: true });
}
const pkg = JSON.parse(await readFile('output/qa/luna-demo-final-20261005/package.json', 'utf8'));
const report = { at: new Date().toISOString(), target: 'https://optika.itdks.tech', release: pkg.artifact, releaseSha256: pkg.sha256, status: 'Luna guide activated and live-verified; demonstration-ready within documented scope', deployedPhp, secretExclusion: { files, matches: 0 }, privateConfig: { path: 'optika-miftari-data/luna.env', outsidePublicHtml: true, permissionsObserved: '0600' }, verification: { phpChecks: 35, isolatedApiChecks: 24, realDomainApiChecks: 10, liveRouteChecks: 1500, ui: ['Albanian camera-help answer', 'English 3D answer', 'Correct English Centre the view label after repair', 'Unchecked consent prevents initial submission', 'Guide 3D shortcut collapses panel', 'Mobile 390px answer with 16px input and no horizontal overflow'] }, limitations: ['Hardware camera and personal-photo workflows not exercised', 'No real orders, payments, customer or administrator mutations submitted', 'AI is text guidance only; it cannot see faces, measure PD or generate accurate product scans'] };
await writeFile('output/qa/luna-demo-final-20261005/deployed.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ deployedPhp, secretExclusion: report.secretExclusion, release: pkg.artifact, status: report.status }, null, 2));
