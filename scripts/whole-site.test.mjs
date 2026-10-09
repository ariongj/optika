import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { blogPosts } from '../src/data/catalog.js';
import { guideDetails, guideReadingTime } from '../src/guideContent.js';

test('All 40 guides have a unique body and consultation question', () => {
  assert.equal(blogPosts.length, 40);
  assert.equal(Object.keys(guideDetails).length, 40);
  for (const post of blogPosts) {
    const detail = guideDetails[post.slug];
    assert.equal(detail?.length, 3, post.slug);
    assert.ok(detail[1].length > 100, post.slug);
    assert.ok(detail[2].endsWith('?'), post.slug);
    assert.equal(post.readTime, guideReadingTime(post));
  }
  assert.equal(new Set(Object.values(guideDetails).map(d => d[1])).size, 40);
  assert.equal(new Set(Object.values(guideDetails).map(d => d[2])).size, 40);
});
test('Reading time comes from text length, not slug length', () => {
  assert.equal(guideReadingTime({title:'Një', excerpt:'Fjalë', points:[]}), '1 min');
  assert.equal(guideReadingTime({title:'Një', excerpt:'fjalë '.repeat(400), points:[]}), '3 min');
});
test('Lens navigation points to the collection, not a product with a mismatched URL', async () => {
  const app = await readFile('src/App.jsx','utf8');
  assert.ok(!app.includes('navigate("product", "prm-m2", "/prescription-glasses")'));
  assert.ok(app.includes('navigate("prescription", undefined, "/prescription-glasses")'));
  const lens = await readFile('src/LensFocusPage.jsx','utf8');
  assert.ok(lens.includes('aria-label="Kërko udhëzues për lentet"'));
  assert.ok(lens.includes('target="prescription" href="/prescription-glasses"'));
  assert.ok(!app.includes('product.polarized ? "Të polarizuara" : "Antireflektuese"'));
});
test('Public reading and prerender share the same guide content', async () => {
  const prerender = await readFile('scripts/prerender.mjs','utf8');
  assert.ok(prerender.includes('guideDetails[article.slug]'));
  const article = await readFile('src/AdviceArticle.jsx','utf8');
  assert.ok(article.includes('guideDetails[article.slug]'));
  assert.ok(!article.includes('Përditësuar {article.updated}'));
});
test('Private data boundaries remain explicit in public service copy', async () => {
  const account = await readFile('src/AccountPage.jsx','utf8');
  const app = await readFile('src/App.jsx','utf8');
  const holding = await readFile('src/HoldingPages.jsx','utf8');
  const markets = await readFile('src/LabMarketPages.jsx','utf8');
  const application = await readFile('src/LabPartnerApplication.jsx','utf8');
  assert.ok(app.includes('Lista ruhet në këtë shfletues'));
  assert.ok(app.includes('Mos shkruani diagnoza ose të dhëna mjekësore'));
  assert.ok(account.includes('Gjurmo porosinë pa llogari'));
  assert.ok(holding.includes('Miftari Holding Group'));
  assert.ok(markets.includes('Aplikimi nuk krijon detyrim blerjeje'));
  assert.ok(markets.includes('No purchase commitment'));
  assert.ok(application.includes('Ky nuk është miratim partneriteti, konfirmim porosie'));
  assert.ok(application.includes('This is not partner approval, an order confirmation'));
});
