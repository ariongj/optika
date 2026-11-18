// Builds the server-backed site and assembles what goes into public_html on the hosting.
//
//   node scripts/package-hostinger.mjs --site https://www.example.com [--out release] [--no-zip]
//
//   --site   the address the shop will answer on (canonical links, sitemap.xml, robots.txt). Required.
//   --out    output folder (default: release/, ignored by git)
//
// Result in <out>/:
//   public_html/         the site (index.html, assets/, images/ …), api/ (the PHP server), uploads/.htaccess, .htaccess
//   SHA256SUMS.txt       one line per file in public_html, to compare after the upload
//   miftari-vision-hostinger-<date>.zip   the CONTENTS of public_html (unzip inside public_html)
//
// Never packaged: config.php, the data folder (database, set-up code), tests, anything secret. The server creates its
// data folder next to public_html on first use.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const site = (opt('site') ?? '').replace(/\/+$/, '');
if (!/^https?:\/\/[^/\s]+$/.test(site)) {
  console.error('Give the address the shop will answer on:  --site https://www.example.com');
  process.exit(2);
}
const OUT = path.resolve(opt('out') ?? 'release');
const SITE = path.join(OUT, 'site');
const PUB = path.join(OUT, 'public_html');
const env = { ...process.env, VITE_BACKEND: '1', BASE_PATH: '/', SITE_URL: site, OUT_DIR: SITE };

function run(label, cmd, argv) {
  console.log(`\n== ${label}`);
  const r = spawnSync(cmd, argv, { stdio: 'inherit', env, shell: false });
  if (r.status !== 0) {
    console.error(`${label} failed`);
    process.exit(1);
  }
}
const walk = (dir, base = dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name)).replace(/\\/g, '/')]));

/* 1. role table for the server, type check, build, static pages */
run('role table', process.execPath, ['--experimental-strip-types', 'scripts/export-permissions.mjs']);
run('type check', process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '-p', '.']);
fs.rmSync(OUT, { recursive: true, force: true });
run('build (server-backed)', process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', SITE, '--emptyOutDir']);
run('static pages, sitemap', process.execPath, ['scripts/prerender-meta.mjs']);

/* 2. assemble public_html */
console.log('\n== assemble public_html');
fs.cpSync(SITE, PUB, { recursive: true });
for (const f of ['_headers', '.nojekyll']) fs.rmSync(path.join(PUB, f), { force: true });
fs.cpSync('server/api', path.join(PUB, 'api'), {
  recursive: true,
  filter: (src) => {
    const rel = path.relative('server/api', src).replace(/\\/g, '/');
    return !/^(tests|storage)(\/|$)/.test(rel) && rel !== 'config.php';
  },
});
fs.mkdirSync(path.join(PUB, 'uploads'), { recursive: true });
fs.copyFileSync('server/uploads/.htaccess', path.join(PUB, 'uploads', '.htaccess'));
fs.copyFileSync('server/root/.htaccess', path.join(PUB, '.htaccess'));
fs.rmSync(SITE, { recursive: true, force: true });

/* 3. checks: nothing of the demo, nothing secret, nothing that calls another host */
console.log('\n== checks');
const files = walk(PUB).sort();
const problems = [];
const banned = [/(^|\/)config\.php$/, /\.sqlite3?$/, /(^|\/)(SETUP|RECOVERY)-CODE\.txt$/, /(^|\/)RECOVER$/, /(^|\/)\.env/, /(^|\/)api\/(tests|storage)\//];
for (const f of files) if (banned.some((re) => re.test(f))) problems.push(`must not be packaged: ${f}`);
const NEEDLES = [
  ['miftari2026', 'the demo CMS password'],
  ['api.web3forms.com', 'the demo form relay (an outside host)'],
];
for (const f of files.filter((x) => /\.(js|html|css|json|php)$/.test(x))) {
  const text = fs.readFileSync(path.join(PUB, f), 'utf8');
  for (const [needle, what] of NEEDLES) if (text.includes(needle)) problems.push(`${f} contains ${what}`);
}
const index = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
if (!/connect-src 'self' blob: data:[;"]/.test(index)) problems.push('index.html: the page policy still allows an outside host for connections');
for (const need of ['index.html', '404.html', '.htaccess', 'api/index.php', 'api/.htaccess', 'api/permissions.json', 'api/lib/pricing.php', 'uploads/.htaccess', 'sitemap.xml', 'robots.txt']) {
  if (!files.includes(need)) problems.push(`missing: ${need}`);
}
if (problems.length) {
  console.error(problems.map((p) => `  ✗ ${p}`).join('\n'));
  process.exit(1);
}
console.log(`  ${files.length} files, none of the banned kinds; no demo password, no outside form relay`);

/* 4. checksums */
const sums = files.map((f) => `${createHash('sha256').update(fs.readFileSync(path.join(PUB, f))).digest('hex')}  ${f}`);
fs.writeFileSync(path.join(OUT, 'SHA256SUMS.txt'), sums.join('\n') + '\n');
const bytes = files.reduce((n, f) => n + fs.statSync(path.join(PUB, f)).size, 0);

/* 5. zip (the contents of public_html) */
let zip = '';
if (!args.includes('--no-zip')) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  zip = path.join(OUT, `miftari-vision-hostinger-${stamp}.zip`);
  const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe') : 'zip';
  const r = process.platform === 'win32' ? spawnSync(tar, ['-a', '-c', '-f', zip, '-C', PUB, '.'], { stdio: 'inherit' }) : spawnSync(tar, ['-q', '-r', zip, '.'], { stdio: 'inherit', cwd: PUB });
  if (r.status !== 0 || !fs.existsSync(zip)) {
    console.error('zip failed — the public_html folder is complete and can be uploaded as it is');
    zip = '';
  }
}

console.log(`\nReady: ${PUB}`);
console.log(`  ${files.length} files, ${(bytes / 1048576).toFixed(1)} MB · site address ${site}`);
console.log(`  checksums: ${path.join(OUT, 'SHA256SUMS.txt')}`);
if (zip) console.log(`  zip: ${zip} (${(fs.statSync(zip).size / 1048576).toFixed(1)} MB, sha256 ${createHash('sha256').update(fs.readFileSync(zip)).digest('hex')})`);
