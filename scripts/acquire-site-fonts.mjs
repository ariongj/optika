// Reproducible acquisition of the existing typography from official Google Fonts.
// Font files and the generated CSS are public assets, never executable code.
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve('public/assets/fonts');
const cssUrl = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300..500;1,300..500&family=IBM+Plex+Mono:wght@400;500&family=Manrope:wght@400..800&display=swap';
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
async function get(url) {
  const response = await fetch(url, { headers: { 'User-Agent': userAgent }, signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, `Official asset unavailable: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}
await mkdir(root, { recursive: true });
const source = (await get(cssUrl)).toString('utf8');
assert.ok(source.includes("format('woff2')") && !source.includes("format('truetype')"), 'Modern WOFF2 delivery is required');
const manifest = [];
const faces = [...source.matchAll(/\/\* ([\w-]+) \*\/\s*(@font-face\s*\{[^}]+\})/g)];
assert.equal(faces.length, 26, 'Review upstream font changes before replacing the approved font collection');
let localCss = '/* Self-hosted original site typography. Sources and SIL OFL licenses: this folder. */\n';
for (const [, subset, face] of faces) {
  const family = face.match(/font-family: '([^']+)'/)[1];
  const style = face.match(/font-style: ([^;]+)/)[1];
  const weight = face.match(/font-weight: ([^;]+)/)[1];
  const url = face.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/)[1];
  assert.equal(new URL(url).hostname, 'fonts.gstatic.com');
  const name = `${family.toLowerCase().replaceAll(' ', '-')}-${style}-${weight.replaceAll(' ', '-')}-${subset}-v20260930.woff2`;
  const bytes = await get(url);
  assert.equal(bytes.subarray(0, 4).toString('ascii'), 'wOF2');
  await writeFile(resolve(root, name), bytes);
  localCss += `/* ${subset} */\n${face.replace(url, '/assets/fonts/' + name)}\n`;
  manifest.push({ name, family, style, weight, subset, source: url, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
for (const [family, folder] of [['Manrope', 'manrope'], ['Cormorant Garamond', 'cormorantgaramond'], ['IBM Plex Mono', 'ibmplexmono']]) {
  const url = `https://raw.githubusercontent.com/google/fonts/main/ofl/${folder}/OFL.txt`;
  const license = await get(url);
  assert.ok(license.toString('utf8').includes('SIL OPEN FONT LICENSE'));
  await writeFile(resolve(root, `${folder}-OFL.txt`), license);
  manifest.push({ name: `${folder}-OFL.txt`, family, source: url, bytes: license.length, sha256: createHash('sha256').update(license).digest('hex') });
}
// Mechanical localization of upstream asset URLs; no manual font redesign.
await writeFile(resolve(root, 'fonts.css'), localCss);
await mkdir(resolve('output/qa/readiness-20260930'), { recursive: true });
await writeFile(resolve('output/qa/readiness-20260930/font-acquisition.json'), JSON.stringify({ acquiredAt: new Date().toISOString(), cssSource: cssUrl, files: manifest }, null, 2));
for (const item of manifest) assert.equal(createHash('sha256').update(await readFile(resolve(root, item.name))).digest('hex'), item.sha256);
console.log(JSON.stringify({ verifiedFonts: faces.length, verifiedLicenses: 3, bytes: manifest.reduce((sum, item) => sum + item.bytes, 0), mainLatinFont: '/assets/fonts/manrope-normal-400-800-latin-v20260930.woff2' }));
