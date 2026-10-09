import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

// Isolated PHP CLI checks: no HTTP server, network, mail or real store writes.
const root = resolve('.');
const out = resolve(root, 'output/qa/catalogue-empty-state');
const data = resolve(out, `run-${Date.now()}`);
assert.ok(data.startsWith(out + sep));
await mkdir(data, { recursive: true });
const results = [];
const check = (condition, name) => {
  results.push({ name, status: condition ? 'verified' : 'failed' });
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}`);
};
const readCatalogue = () => new Promise((ready, fail) => {
  const source = "require 'public/api/bootstrap.php'; echo json_encode(['all'=>om_all_products(),'public'=>om_products()], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);";
  const php = spawn(resolve(root, 'tmp/php-8.5.9/php.exe'), ['-d', 'disable_functions=mail', '-r', source], {
    cwd: root, env: { ...process.env, OPTIKA_STORAGE_DIR: data }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  let stdout = '';
  php.stdout.on('data', (chunk) => { stdout += chunk; });
  php.once('error', fail);
  php.once('close', (code) => {
    if (code !== 0) return fail(new Error(`Isolated catalogue PHP exited with code ${code}`));
    try { ready(JSON.parse(stdout)); } catch { fail(new Error('Isolated catalogue PHP did not return JSON')); }
  });
});
const seed = JSON.parse(await readFile(resolve(root, 'public/api/storage/commerce-seed.json'), 'utf8'));
const initial = await readCatalogue();
check(initial.all.length === seed.products.length && seed.products.length > 0, 'Absent products store uses bundled initial catalogue');
check(initial.all.every((product, index) => product.id === seed.products[index].id), 'Initial fallback preserves the seed product identities');

await writeFile(resolve(data, 'products.json'), '[]');
const empty = await readCatalogue();
check(empty.all.length === 0 && empty.public.length === 0, 'Intentionally empty products store stays empty in CMS and public catalogue');
const emptyAgain = await readCatalogue();
check(emptyAgain.all.length === 0 && emptyAgain.public.length === 0, 'Empty catalogue remains empty across independent PHP requests');
check((await readFile(resolve(data, 'products.json'), 'utf8')) === '[]', 'Reading empty catalogue does not rewrite or seed the data file');

const draft = { id: 'qa-only-draft', name: 'Synthetic draft frame', status: 'Draft', price: 99, stock: 2, image: '/assets/products/vortex-x1-studio.png' };
await writeFile(resolve(data, 'products.json'), JSON.stringify([draft]));
const draftOnly = await readCatalogue();
check(draftOnly.all.length === 1 && draftOnly.all[0].id === draft.id && draftOnly.public.length === 0, 'Draft-only store does not resurrect published seed products');
check(draftOnly.all[0].image === '/assets/products/vortex-x1-studio.webp', 'Stored catalogue image normalization is preserved');

await writeFile(resolve(data, 'products.json'), JSON.stringify([{ ...draft, status: 'Published' }]));
const onePublished = await readCatalogue();
check(onePublished.all.length === 1 && onePublished.public.length === 1 && onePublished.public[0].id === draft.id, 'Existing one-product catalogue is authoritative over seed');

await writeFile(resolve(data, 'products.json'), '[]');
const deletedLast = await readCatalogue();
check(deletedLast.all.length === 0 && deletedLast.public.length === 0, 'Persisting deletion of the last product never restores seed catalogue');
await writeFile(resolve(out, 'checks.json'), JSON.stringify({
  testedAt: new Date().toISOString(), environment: 'Isolated PHP CLI and private synthetic store; no HTTP or production calls',
  storageDirectory: data, results,
}, null, 2));
process.exitCode = results.some((item) => item.status === 'failed') ? 1 : 0;
