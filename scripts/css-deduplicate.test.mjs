import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
// Use the same PostCSS installation that Vite uses (pnpm keeps it scoped).
const postcss = createRequire(import.meta.resolve('vite'))('postcss');
import { deduplicateCss } from './css-deduplicate.mjs';

test('Identical earlier rule is removed but its final cascade position remains', () => {
  const root = postcss.parse('.a{color:red}.a{color:blue}.a{color:red}');
  assert.equal(deduplicateCss(root), 1);
  assert.equal(root.toString(), '.a{color:blue}.a{color:red}');
});
test('Conditional rules only deduplicate under the same complete condition chain', () => {
  const root = postcss.parse('@media(max-width:600px){.a{color:red}}@media(min-width:600px){.a{color:red}}@media(max-width:600px){.a{color:red}}@supports(display:grid){.a{color:red}}');
  assert.equal(deduplicateCss(root), 1);
  assert.equal(root.toString().match(/\.a/g).length, 3);
});
test('Layers, keyframes, font faces and nested selectors are never deduplicated', () => {
  const root = postcss.parse('@layer a{.a{color:red}.a{color:red}}@keyframes k{0%{opacity:0}0%{opacity:0}}@font-face{font-family:a;src:url(a)}@font-face{font-family:a;src:url(a)}.a{& .b{color:red}}.a{& .b{color:red}}');
  const before = root.toString();
  assert.equal(deduplicateCss(root), 0);
  assert.equal(root.toString(), before);
});
test('Different declaration order, importance, selector and values remain untouched', () => {
  const root = postcss.parse('.a{margin:0;margin-left:4px}.a{margin-left:4px;margin:0}.a{color:red!important}.a{color:red}.b{color:red}');
  const before = root.toString();
  assert.equal(deduplicateCss(root), 0);
  assert.equal(root.toString(), before);
});
