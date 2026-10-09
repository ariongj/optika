// Remove only earlier, identical declaration-only rules in the same conditional
// context. The final identical rule preserves the existing cascade. No selector
// rewriting, unused-style purge, media merging or layer ordering is performed.
export function deduplicateCss(root) {
  const candidates = [];
  root.walkRules(rule => {
    if (!rule.nodes?.every(node => node.type === 'decl' || node.type === 'comment')) return;
    const context = [];
    for (let parent = rule.parent; parent && parent.type !== 'root'; parent = parent.parent) {
      if (parent.type !== 'atrule' || !['media', 'supports'].includes(parent.name.toLowerCase())) return;
      context.unshift([parent.name, parent.params]);
    }
    const declarations = rule.nodes.filter(node => node.type === 'decl').map(node => [node.prop, node.value, Boolean(node.important)]);
    if (!declarations.length) return;
    candidates.push({ rule, key: JSON.stringify([context, rule.selector, declarations]) });
  });
  const seen = new Set();
  let removed = 0;
  for (let index = candidates.length - 1; index >= 0; index--) {
    const { rule, key } = candidates[index];
    if (seen.has(key)) { rule.remove(); removed++; }
    else seen.add(key);
  }
  return removed;
}

export default () => ({ postcssPlugin: 'optika-exact-rule-deduplication', OnceExit: deduplicateCss });
