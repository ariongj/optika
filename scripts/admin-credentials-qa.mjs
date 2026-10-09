import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { randomBytes, pbkdf2Sync } from 'node:crypto';

// Real PHP login code, isolated CLI request fixtures: no HTTP port, network,
// production credentials, mail or account provisioning outside this QA folder.
const root = resolve('.');
const out = resolve(root, 'output/qa/admin-credentials');
const data = resolve(out, `run-${Date.now()}`);
assert.ok(data.startsWith(out + sep));
const sessions = resolve(data, 'sessions');
await mkdir(sessions, { recursive: true });
const secret = `Qa!${randomBytes(24).toString('hex')}`;
const salt = randomBytes(18).toString('hex');
const credentials = {
  email: 'qa.credentials@example.test', salt,
  hash: pbkdf2Sync(secret, salt, 120000, 32, 'sha256').toString('hex'),
  iterations: 120000, updatedAt: new Date().toISOString(),
};
const results = [];
const check = (condition, name) => {
  results.push({ name, status: condition ? 'verified' : 'failed' });
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}`);
};
const runPhp = (source, request = {}) => new Promise((ready, fail) => {
  const php = spawn(resolve(root, 'tmp/php-8.5.9/php.exe'), ['-d', 'disable_functions=mail', '-d', `session.save_path=${sessions}`, '-r', source], {
    cwd: root, env: { ...process.env, OPTIKA_STORAGE_DIR: data, OPTIKA_QA_LOGIN_REQUEST: JSON.stringify(request) },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  let stdout = '', stderr = '';
  php.stdout.on('data', (chunk) => { stdout += chunk; });
  php.stderr.on('data', (chunk) => { stderr += chunk; });
  php.once('error', fail);
  php.once('close', (code) => {
    if (code !== 0) return fail(new Error(`Isolated credential PHP exited with code ${code}`));
    try {
      const status = /QA_HTTP_STATUS:(\d+)/.exec(stderr)?.[1];
      ready({ body: JSON.parse(stdout), status: Number(status || 200), cleanOutput: stderr.replace(/QA_HTTP_STATUS:\d+/, '').trim() === '' });
    } catch { fail(new Error('Isolated credential PHP did not return valid JSON')); }
  });
});
const login = (password = secret, email = credentials.email) => runPhp(
  "$_SERVER['REQUEST_METHOD']='POST'; $_SERVER['HTTP_HOST']='127.0.0.1'; $_SERVER['REMOTE_ADDR']='127.0.0.1'; $_POST=json_decode(getenv('OPTIKA_QA_LOGIN_REQUEST'),true); register_shutdown_function(static function(){fwrite(STDERR,'QA_HTTP_STATUS:'.http_response_code());}); require 'public/api/index.php';",
  { action: 'login', email, password },
);
const inspect = () => runPhp(
  "require 'public/api/bootstrap.php'; $c=om_credentials(); echo json_encode(['ready'=>om_credentials_ready($c),'emptySalt'=>$c['salt']==='','emptyHash'=>$c['hash']==='','hasDefaultEmail'=>$c['email']===OM_DEFAULT_ADMIN_EMAIL,'embeddedSaltDefined'=>defined('OM_DEFAULT_PASSWORD_SALT'),'embeddedHashDefined'=>defined('OM_DEFAULT_PASSWORD_HASH')]);",
);

const absent = await inspect();
check(!absent.body.ready && absent.body.emptyHash && absent.body.emptySalt, 'Missing credentials have no usable password salt or hash');
check(absent.body.hasDefaultEmail, 'Public default email remains available for existing notification configuration');
check(!absent.body.embeddedSaltDefined && !absent.body.embeddedHashDefined, 'Bootstrap defines no embedded default password salt or hash');
const missingLogin = await login();
check(missingLogin.status === 503 && missingLogin.body.error === 'setup_required' && !missingLogin.body.authenticated, 'Missing credentials deny login with explicit setup-required response');
check(missingLogin.cleanOutput, 'Missing credential login emits no PHP warnings');
let createdMissingFile = true;
try { await access(resolve(data, 'credentials.json')); } catch { createdMissingFile = false; }
check(!createdMissingFile, 'Missing credential login does not create default credentials');

const invalidConfigurations = [
  ['empty store', []],
  ['missing hash', { email: credentials.email, salt, iterations: 120000 }],
  ['malformed hash', { ...credentials, hash: 'not-a-password-hash' }],
  ['empty salt', { ...credentials, salt: '' }],
  ['non-string email', { ...credentials, email: [] }],
  ['zero iterations', { ...credentials, iterations: 0 }],
  ['non-numeric iterations', { ...credentials, iterations: 'bad' }],
];
for (const [label, record] of invalidConfigurations) {
  await writeFile(resolve(data, 'credentials.json'), JSON.stringify(record));
  const response = await login();
  check(response.status === 503 && response.body.error === 'setup_required' && !response.body.authenticated, `${label}: configuration cannot authenticate`);
  check(response.cleanOutput, `${label}: safe response without PHP warnings`);
}
await writeFile(resolve(data, 'credentials.json'), '{malformed-json');
const invalidJson = await login();
check(invalidJson.status === 503 && invalidJson.body.error === 'setup_required' && invalidJson.cleanOutput, 'Corrupt credential JSON fails closed without default fallback');

const configuredBytes = JSON.stringify(credentials);
await writeFile(resolve(data, 'credentials.json'), configuredBytes);
check((await inspect()).body.ready, 'Existing valid private credentials remain configured');
const correct = await login();
check(correct.status === 200 && correct.body.authenticated && !correct.body.passwordChangeRequired, 'Configured administrator still signs in using its existing password');
check(correct.cleanOutput, 'Configured login emits no PHP warnings');
check((await readFile(resolve(data, 'credentials.json'), 'utf8')) === configuredBytes, 'Configured login leaves credential file bytes unchanged');
const wrong = await login('NotTheSyntheticPassword!123');
check(wrong.status === 401 && wrong.body.error === 'invalid_credentials' && !wrong.body.authenticated, 'Wrong password still denied for configured administrator');
const wrongType = await login([]);
check(wrongType.status === 401 && wrongType.cleanOutput, 'Non-string password fails safely without conversion warnings');

await writeFile(resolve(data, 'credentials.json'), JSON.stringify({ ...credentials, iterations: '120000' }));
check((await login()).body.authenticated, 'Legacy numeric-string iteration count remains compatible');
await writeFile(resolve(data, 'credentials.json'), JSON.stringify({ ...credentials, updatedAt: null }));
const rotationRequired = await login();
check(rotationRequired.body.authenticated && rotationRequired.body.passwordChangeRequired, 'Provisioned account requiring password rotation still retains that workflow');
check(!JSON.stringify(rotationRequired.body).includes(credentials.hash) && !JSON.stringify(rotationRequired.body).includes(salt), 'Authentication responses expose no credential salt or hash');

await writeFile(resolve(out, 'checks.json'), JSON.stringify({
  testedAt: new Date().toISOString(), environment: 'Isolated PHP CLI requests with synthetic private credentials; no HTTP or production calls',
  storageDirectory: data, results,
}, null, 2));
process.exitCode = results.some((item) => item.status === 'failed') ? 1 : 0;
