// Modify only the explicitly named disposable browser QA catalogue.
// No live access, mail, accounts or credentials. Restore after the route checks.
import { readFile, writeFile, copyFile, access } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import assert from 'node:assert/strict';
const [folder, mode] = process.argv.slice(2);
const allowed = resolve('output/qa/feature-polish');
const target = resolve(folder || '');
assert.ok(target.startsWith(allowed + sep) && /browser-[\d-]+$/.test(target));
assert.ok(['add','empty','restore'].includes(mode));
const file = resolve(target, 'products.json'), backup = resolve(target, 'products-before-fixture.json');
if (mode === 'restore') { await copyFile(backup, file); console.log('Restored isolated catalogue'); }
else {
  try { await access(backup); } catch { await copyFile(file, backup); }
  const products = JSON.parse(await readFile(backup, 'utf8'));
  if (mode === 'empty') await writeFile(file, '[]');
  else {
    const sample = products.find(p => p.type === 'Sunglasses');
    assert.ok(sample);
    await writeFile(file, JSON.stringify([...products,{...sample,id:'qa-route-frame',name:'QA Route Frame',sku:'QA-ROUTE',stock:2,price:125,salePrice:null,status:'Published'}]));
  }
  console.log(`Isolated catalogue fixture: ${mode}`);
}
