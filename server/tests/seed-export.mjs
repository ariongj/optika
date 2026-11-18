// Writes the app's built-in data (src/data/seed.ts) as an API import body: server/tests/.cache/seed.json
// = {lists: {collection: [items]}, singles: {key: value}}. Used by the API tests.
//   node server/tests/seed-export.mjs
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';

const OUT = path.join('server', 'tests', '.cache');
const tmp = path.join(OUT, 'seed');
await build({
  logLevel: 'warn',
  publicDir: false,
  build: { ssr: 'src/data/seed.ts', outDir: tmp, emptyOutDir: true, minify: false, copyPublicDir: false },
});
const { createSeed } = await import(pathToFileURL(path.resolve(tmp, 'seed.js')).href);
const db = createSeed(new Date());
const SINGLES = ['settings', 'home', 'homeDraft', 'homeHistory', 'seededAt', 'version'];
const lists = {};
const singles = {};
for (const [k, v] of Object.entries(db)) (SINGLES.includes(k) ? singles : lists)[k] = v;
fs.writeFileSync(path.join(OUT, 'seed.json'), JSON.stringify({ lists, singles }));
console.log('seed.json:', Object.entries(lists).map(([k, v]) => `${k}=${v.length}`).join(' '));
