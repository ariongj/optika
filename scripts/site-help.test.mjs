import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getSiteHelp, helpIsAvailable, helpCartPages } from '../src/siteHelp.js';

const server = await createServer({ configLoader: 'runner', logLevel: 'error', server: { middlewareMode: true, watch: null }, appType: 'custom' });
after(() => server.close());
const { default: SiteHelp } = await server.ssrLoadModule('/src/SiteHelp.jsx');

test('Help keeps all critical purchase, camera and private screens clear', () => {
  for (const page of ['admin', 'account', 'fit', 'product', 'guides']) {
    assert.equal(helpIsAvailable(page), false);
    assert.equal(renderToStaticMarkup(createElement(SiteHelp, { page })), '');
  }
  for (const page of ['home', 'optical', 'clinic', 'labEurope', 'shop', 'contact']) {
    assert.equal(helpIsAvailable(page), true);
    assert.equal(helpIsAvailable(page, true), false);
    assert.equal(renderToStaticMarkup(createElement(SiteHelp, { page, blocked: true })), '');
  }
});

test('Launcher never auto-opens and truthfully labels itself as help', () => {
  const sq = renderToStaticMarkup(createElement(SiteHelp, { page: 'home' }));
  assert.match(sq, /Ndihmë/);
  assert.match(sq, /aria-expanded="false"/);
  assert.doesNotMatch(sq, /role="dialog"|AI|typing|unread|online/i);
  const en = renderToStaticMarkup(createElement(SiteHelp, { page: 'labEurope' }));
  assert.match(en, /lang="en"/);
  assert.match(en, />Help</);
  assert.doesNotMatch(en, /Ndihmë/);
});

test('Retail help leaves separate room for the existing floating cart', () => {
  for (const page of ['shop', 'prescription', 'sunglasses']) {
    assert.ok(helpCartPages.has(page));
    assert.match(renderToStaticMarkup(createElement(SiteHelp, { page })), /has-cart/);
  }
  assert.doesNotMatch(renderToStaticMarkup(createElement(SiteHelp, { page: 'home' })), /has-cart/);
});

test('Guidance prioritizes the current division and keeps IDs unique', () => {
  for (const [page, topic] of [['clinic','clinic'], ['partners','partners'], ['labKosovo','partners'], ['guides','prescription'], ['orderStatus','order']]) {
    const content = getSiteHelp(page);
    assert.equal(content.topics[0].id, topic);
    assert.equal(new Set(content.topics.map(item => item.id)).size, content.topics.length);
  }
});

test('EU business copy remains English and never claims approved certification', () => {
  const content = getSiteHelp('labEurope');
  assert.equal(content.locale, 'en');
  assert.equal(content.topics.length, 5);
  assert.match(content.disclosure, /not AI or live chat/);
  assert.match(content.topics.find(t => t.id === 'documentation').body, /does not publish verified certificates/);
  assert.match(content.topics.find(t => t.id === 'partners').body, /not partner approval/);
  assert.match(content.topics.find(t => t.id === 'privacy').body, /Do not include prescriptions/);
});

test('Guidance does not overstate order payments, medical advice or virtual accuracy', () => {
  const content = getSiteHelp('home');
  assert.match(content.disclosure, /jo inteligjencë artificiale apo bisedë live/);
  assert.match(content.topics.find(t => t.id === 'order').body, /nuk kryen pagesë me kartë/);
  assert.match(content.topics.find(t => t.id === 'tryon').body, /nuk garantojnë përshtatjen reale/);
  assert.match(content.topics.find(t => t.id === 'clinic').body, /nuk është një takim i konfirmuar/);
});

test('Every suggested destination is an existing application route, not an external mutation', () => {
  const paths = new Map([
    ['shop','/shop'], ['fit','/virtual-try-on'], ['prescription','/prescription-glasses'], ['contact','/contact'],
    ['orderStatus','/order-status'], ['clinic','/clinic'], ['labKosovo','/laboratory/kosovo'],
    ['labEurope','/laboratory/europe'], ['partners','/laboratory/partners'],
  ]);
  for (const page of ['home','labEurope']) for (const topic of getSiteHelp(page).topics) for (const action of topic.actions) {
    if (action.action) { assert.equal(action.action, 'cart'); continue; }
    assert.equal(action.path.split('#')[0], paths.get(action.page));
  }
});

test('Help has accessible dialog behavior without collecting or sending user data', async () => {
  const source = await readFile('src/SiteHelp.jsx','utf8');
  const css = await readFile('src/styles/site-help.css','utf8');
  assert.match(source, /useDialogFocus\(visible, panelRef/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /aria-describedby="miftari-help-disclosure"/);
  assert.match(source, /answerRef\.current\?\.focus/);
  assert.match(source, /topicRefs\.current\.get\(previous\)\?\.focus/);
  assert.match(source, /setOpen\(false\); setSelected\(null\); }, \[page, blocked\]/);
  assert.match(source, /rel="noopener noreferrer"/);
  assert.doesNotMatch(source, /<input|<textarea|fetch\(|localStorage|sessionStorage|setInterval\(/);
  assert.match(css, /aria-modal="true".*:not\(\[data-help-dialog\]\)/);
  assert.match(css, /input,select,textarea/);
  assert.match(css, /100dvh/);
  assert.match(css, /safe-area-inset-bottom/);
});
