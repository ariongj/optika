import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('Unknown pages and malformed article paths never impersonate another page', () => {
  assert.ok(app.includes('return { page: normalized === "/" ? "home" : "notFound" };'));
  assert.match(app, /if \(articleMatch\)[\s\S]*?catch\s*\{\s*return \{ page: "notFound" \}/);
  assert.ok(app.includes('const selectedArticle = blogPosts.find((post) => post.slug === selectedArticleSlug) || null;'));
  assert.ok(app.includes('page === "article" && selectedArticle && <ArticlePage'));
  assert.ok(app.includes('<NotFoundPage navigate={navigate} article={page === \'article\'} />'));
});
test('Recovery uses real keyboard-accessible links and retains ordinary SPA navigation', () => {
  assert.ok(app.includes('aria-labelledby="recovery-title"'));
  assert.ok(app.includes("href={article ? '/lens-focus/' : '/shop/'}"));
  assert.ok(app.includes('href="/contact/"'));
  assert.match(app, /function NotFoundPage[\s\S]*?event\.metaKey \|\| event\.ctrlKey \|\| event\.shiftKey \|\| event\.altKey/);
});
test('Missing article schema and malformed anchors cannot crash page recovery', () => {
  assert.ok(app.includes("article: page === 'article' && selectedArticle ? selectedArticle : undefined"));
  assert.match(app, /try \{ hashTarget = decodeURIComponent\(window\.location\.hash/);
  assert.ok(app.includes("page === 'notFound' ||"));
});
test('Product responsive layout retains one primary heading without remounting the configurator', () => {
  assert.ok(app.includes("const MobileProductTitle = compactProductLayout ? 'h1' : 'h2';"));
  assert.ok(app.includes("const DesktopProductTitle = compactProductLayout ? 'h2' : 'h1';"));
  assert.ok(app.includes('<MobileProductTitle>{product.name}</MobileProductTitle>'));
  assert.ok(app.includes('<DesktopProductTitle>{product.name}</DesktopProductTitle>'));
  assert.ok(app.includes("query.removeEventListener('change', update)"));
});
