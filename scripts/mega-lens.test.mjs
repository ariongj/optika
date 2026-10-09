import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { megaNavigation, navigationIndex } from '../src/megaNavigation.js';
import { lensChoices, lensTreatments, lensMeasurements } from '../src/lensFocusContent.js';

const app = fs.readFileSync('src/App.jsx', 'utf8');
const page = fs.readFileSync('src/LensFocusPage.jsx', 'utf8');
const navLiteral = app.slice(app.indexOf('  const nav = [', app.indexOf('function Header(')) + '  const nav = '.length, app.indexOf('\n  if (english)', app.indexOf('function Header('))).trim().replace(/;$/, '');
const original = vm.runInNewContext(`(${navLiteral})`, {headerText: (sq) => sq});

test('every mega-menu destination is a unique real page, and original destinations remain reachable', () => {
  const menus = megaNavigation(original);
  for (let i = 0; i < menus.length; i++) {
    const menu = menus[i];
    if (!original[i].children.length) { assert.equal(menu.children.length, 0); continue; }
    const paths = menu.children.map(link => link.path);
    assert.equal(paths.length, new Set(paths).size, menu.label);
    for (const item of [original[i], ...original[i].children]) assert.ok(paths.includes(item.path), `${menu.label}: ${item.path}`);
    for (const link of menu.children) {
      assert.ok(link.label && link.target && link.path);
      assert.doesNotMatch(link.path, /#|articles/);
    }
    for (const feature of menu.features) assert.ok(fs.existsSync(`public${feature.image}`), feature.image);
  }
});

test('English market navigation has English support links and same route coverage', () => {
  const sq = megaNavigation(original), en = megaNavigation(original, true);
  assert.deepEqual(sq.flatMap(item => item.children.map(child => child.path)), en.flatMap(item => item.children.map(child => child.path)));
  assert.ok(en[0].children.some(child => child.label === 'My account'));
  assert.ok(en.find(item => item.target === 'brand').columns.some(col => col.title === 'For professionals'));
});

test('menu keyboard movement wraps and handles empty collections', () => {
  assert.equal(navigationIndex('ArrowDown', 3, 4), 0);
  assert.equal(navigationIndex('ArrowUp', 0, 4), 3);
  assert.equal(navigationIndex('Home', 3, 4), 0);
  assert.equal(navigationIndex('End', 0, 4), 3);
  assert.equal(navigationIndex('ArrowDown', 0, 0), -1);
});

test('lens content has four distinct choices and honest personal-fitting limitations', () => {
  assert.equal(lensChoices.length, 4);
  assert.equal(new Set(lensChoices.map(lens => lens.id)).size, 4);
  for (const lens of lensChoices) for (const key of ['label','need','title','copy','use','discuss','note']) assert.ok(lens[key].length > 3);
  assert.equal(lensTreatments.length, 4);
  assert.equal(lensMeasurements.length, 4);
  assert.doesNotMatch(JSON.stringify(lensTreatments), /ISO|UV400|100%|99%/);
});

test('3D is user-initiated; all guides, search and page links are retained', () => {
  assert.match(page, /storyOpen && <LensStory/);
  assert.match(page, /useState\('guided'\)/);
  assert.match(page, /<option value="scroll">/);
  assert.match(page, /role="tablist"/);
  assert.match(page, /role="tabpanel"/);
  assert.match(page, /blogPosts\.filter/);
  assert.match(page, /setLimit\(count => count \+ 8\)/);
  assert.match(page, /Pastro filtrat/);
  assert.match(page, /event\.key === 'Escape'/);
  assert.match(page, /event\.source !== frame\?\.contentWindow/);
  assert.match(app, /return <LensFocusPage \{\.\.\.props\} \/>/);
});
