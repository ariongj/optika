import assert from 'node:assert/strict';
import { lstat, realpath, writeFile, unlink } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, pbkdf2Sync } from 'node:crypto';
import { spawnSync } from 'node:child_process';

// Local browser QA only. This fixed fixture is outside public/ and dist/.
// Never accept an environment variable, CLI path or credential override here.
const expectedRoot = 'C:\\Users\\A\\Documents\\MM';
const expectedFixture = 'C:\\Users\\A\\Documents\\MM\\output\\qa\\division-browser-data';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const fixture = resolve(root, 'output', 'qa', 'division-browser-data');
const equalPath = (left, right) => resolve(left).toLowerCase() === resolve(right).toLowerCase();
assert.equal(process.platform, 'win32', 'This local fixture generator is Windows-only.');
assert.equal(process.argv.length, 2, 'This fixture generator accepts no arguments.');
assert.ok(equalPath(root, expectedRoot), 'Unexpected project root; no credentials written.');
assert.ok(equalPath(fixture, expectedFixture), 'Unexpected fixture target; no credentials written.');
assert.ok(equalPath(process.cwd(), root), 'Run from the verified project root.');

for (const path of [root, join(root, 'output'), join(root, 'output', 'qa'), fixture]) {
  const entry = await lstat(path);
  assert.ok(entry.isDirectory() && !entry.isSymbolicLink(), 'Fixture ancestry must be existing directories, not links.');
  assert.ok(equalPath(await realpath(path), path), 'A redirected fixture path was rejected.');
}

const credentialPath = join(fixture, 'credentials.json');
const loginPath = join(fixture, 'browser-login.json');
for (const path of [credentialPath, loginPath]) {
  try {
    await lstat(path);
    throw new Error('An existing fixture credential file was found; nothing was replaced.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const ignored = spawnSync('git', ['check-ignore', '--quiet', '--', relative(root, path)], { cwd: root, windowsHide: true, stdio: 'ignore' });
  assert.equal(ignored.status, 0, 'Fixture credentials must be ignored by Git before creation.');
}

const email = `qa.lab.${randomBytes(6).toString('hex')}@example.test`;
const password = `Qa!${randomBytes(32).toString('hex')}`;
const salt = randomBytes(18).toString('hex');
const iterations = 120000;
const updatedAt = new Date().toISOString();
const credentials = { email, salt, hash: pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex'), iterations, updatedAt };

// Exclusive creation prevents overwriting a credential even if another process
// creates one after the checks above. Plaintext never appears in console output.
await writeFile(loginPath, JSON.stringify({ email, password }), { flag: 'wx', mode: 0o600 });
try {
  await writeFile(credentialPath, JSON.stringify(credentials), { flag: 'wx', mode: 0o600 });
} catch (error) {
  await unlink(loginPath); // Only the exact plaintext file this process created.
  throw error;
}
console.log(`Local QA login fixture ready: ${loginPath}`);
