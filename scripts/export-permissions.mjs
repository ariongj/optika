// Writes server/api/permissions.json from src/lib/permissions.ts, so the server enforces exactly the role rules the
// CMS shows. Run: node --experimental-strip-types scripts/export-permissions.mjs   (the package script does it)
import { writeFileSync } from 'node:fs';

const perms = await import(new URL('../src/lib/permissions.ts', import.meta.url).href);
const out = {
  note: 'Generated from src/lib/permissions.ts by scripts/export-permissions.mjs — do not edit by hand.',
  modules: perms.MODULES,
  actions: perms.ACTIONS,
  roles: perms.ROLES,
  matrix: perms.PERMISSIONS,
};
const file = new URL('../server/api/permissions.json', import.meta.url);
writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
console.log(`permissions.json: ${out.roles.length} roles, ${out.modules.length} modules`);
