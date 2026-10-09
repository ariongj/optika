import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve, sep } from 'node:path';

// Separate PHP CLI workers exercise real account endpoints and the exact RX
// registry critical section. No HTTP port, real uploads, mail or live data.
const root = resolve('.');
const out = resolve(root, 'output/qa/shared-store-concurrency');
const data = resolve(out, `run-${Date.now()}`);
assert.ok(data.startsWith(out + sep));
const sessions = resolve(data, 'sessions');
await mkdir(sessions, { recursive: true });
const originalPassword = `Qa!1${randomBytes(16).toString('hex')}`;
const nextPassword = `Qa!2${randomBytes(16).toString('hex')}`;
const conflictPasswords = [`Qa!3${randomBytes(16).toString('hex')}`, `Qa!4${randomBytes(16).toString('hex')}`];
const csrf = randomBytes(24).toString('hex');
const children = new Set();
const results = [];
const check = (condition, name) => {
  results.push({ name, status: condition ? 'verified' : 'failed' });
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}`);
};
function phpWorker(source, payload = {}) {
  const child = spawn(resolve(root, 'tmp/php-8.5.9/php.exe'), ['-d', 'disable_functions=mail', '-d', `session.save_path=${sessions}`, '-r', source], {
    cwd: root, env: { ...process.env, OPTIKA_STORAGE_DIR: data, OPTIKA_QA_PAYLOAD: JSON.stringify(payload) },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  children.add(child);
  const worker = { child, done: false, promise: null };
  worker.promise = new Promise((ready, fail) => {
    let stdout = '', stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', fail);
    child.once('close', (code) => {
      children.delete(child); worker.done = true;
      if (code !== 0) return fail(new Error(`Isolated concurrency worker exited ${code}`));
      try {
        ready({ body: JSON.parse(stdout), status: Number(/QA_HTTP_STATUS:(\d+)/.exec(stderr)?.[1] || 200), cleanOutput: stderr.replace(/QA_HTTP_STATUS:\d+/, '').trim() === '' });
      } catch { fail(new Error('Isolated concurrency worker returned invalid JSON')); }
    });
  });
  // Attach a handler immediately while a batch waits at its file-lock barrier.
  worker.promise.catch(() => {});
  return worker;
}
const waitForFile = async (path) => {
  for (let attempt = 0; attempt < 500; attempt++) {
    try { await access(path); return; } catch { await new Promise((ready) => setTimeout(ready, 20)); }
  }
  throw new Error('Isolated concurrency barrier did not become ready');
};
let gateNumber = 0;
async function withWriterBarrier(startWorkers, inspectWhileLocked) {
  const gateRoot = resolve(data, `gate-${++gateNumber}`);
  const gateReady = gateRoot + '-ready';
  const gateRelease = gateRoot + '-release';
  const holder = phpWorker("require 'public/api/bootstrap.php'; $p=json_decode(getenv('OPTIKA_QA_PAYLOAD'),true); $lock=om_acquire_commerce_lock(); file_put_contents($p['ready'],'ready'); $until=microtime(true)+20; while(!is_file($p['release']) && microtime(true)<$until){usleep(10000);} om_release_commerce_lock($lock); echo json_encode(['ok'=>is_file($p['release'])]);", { ready: gateReady, release: gateRelease });
  await waitForFile(gateReady);
  const workers = startWorkers(gateRoot);
  try {
    await Promise.all(workers.map((worker) => waitForFile(worker.readyPath)));
    await new Promise((ready) => setTimeout(ready, 300));
    check(workers.every((worker) => !worker.done), 'Every competing writer waits while commerce lock is held');
    if (inspectWhileLocked) await inspectWhileLocked();
  } finally {
    await writeFile(gateRelease, 'release');
  }
  assert.equal((await holder.promise).body.ok, true);
  return Promise.all(workers.map((worker) => worker.promise));
}

const endpointSource = `
$p=json_decode(getenv('OPTIKA_QA_PAYLOAD'),true);
$_SERVER['REQUEST_METHOD']='POST'; $_SERVER['HTTP_HOST']='127.0.0.1'; $_SERVER['REMOTE_ADDR']='127.0.0.1';
$_SERVER['HTTP_X_CSRF_TOKEN']=$p['csrfHeader'] ?? $p['csrf']; $_POST=$p['request'];
session_name('optika_ops'); session_id('qa'.bin2hex(random_bytes(16))); session_start();
if(($p['role'] ?? '')==='admin') {
  $_SESSION['optika_admin']=true; $_SESSION['admin_email']='qa.staff@example.test'; $_SESSION['last_seen']=time(); $_SESSION['csrf']=$p['csrf'];
} elseif(($p['role'] ?? '')==='customer') {
  $_SESSION['customer_authenticated']=true; $_SESSION['customer_id']=$p['accountId']; $_SESSION['customer_email']='qa.customer@example.test'; $_SESSION['customer_last_seen']=time(); $_SESSION['customer_csrf']=$p['csrf'];
}
register_shutdown_function(static function(){fwrite(STDERR,'QA_HTTP_STATUS:'.http_response_code());});
if(isset($p['ready'])) file_put_contents($p['ready'],'ready');
require $p['endpoint'];
`;
function endpointWorker(endpoint, request, options = {}) {
  const worker = phpWorker(endpointSource, { endpoint: `public/api/${endpoint}`, request, csrf, role: 'customer', accountId: 'QA-ACC-0', ...options });
  worker.readyPath = options.ready;
  return worker;
}
const profileRequest = (index) => ({ action: 'update_profile', firstName: `Updated ${index}`, lastName: 'Synthetic QA', phone: '+000000000', address: `Synthetic address ${index}`, city: 'QA', postcode: '000', country: 'Kosovë', contactPreference: 'Email', marketingConsent: false });

try {
  const seed = phpWorker("require 'public/api/bootstrap.php'; $p=json_decode(getenv('OPTIKA_QA_PAYLOAD'),true); $hash=password_hash($p['password'],PASSWORD_DEFAULT); $a=[]; for($i=0;$i<6;$i++){$a[]=['id'=>'QA-ACC-'.$i,'email'=>'qa.'.$i.'@example.test','firstName'=>'Initial '.$i,'lastName'=>'Synthetic QA','phone'=>'+000000000','status'=>'Active','passwordHash'=>$hash,'mustChangePassword'=>false];} om_write('customer_accounts',$a); $salt=bin2hex(random_bytes(16)); om_write('credentials',['email'=>'qa.staff@example.test','salt'=>$salt,'hash'=>om_password_hash($p['password'],$salt,120000),'iterations'=>120000,'updatedAt'=>gmdate('c')]); echo json_encode(['ok'=>true]);", { password: originalPassword });
  assert.equal((await seed.promise).body.ok, true);
  const concurrent = await withWriterBarrier((gateRoot) => [
    ...Array.from({ length: 4 }, (_, index) => endpointWorker('account.php', profileRequest(index), { accountId: `QA-ACC-${index}`, ready: `${gateRoot}-profile-${index}` })),
    endpointWorker('account.php', { action: 'change_password', currentPassword: originalPassword, newPassword: nextPassword }, { ready: `${gateRoot}-password` }),
    endpointWorker('account.php', { action: 'register', firstName: 'Concurrent', lastName: 'Synthetic QA', email: 'qa.concurrent@example.test', phone: '+000000000', password: originalPassword, termsAccepted: true }, { role: '', ready: `${gateRoot}-register` }),
    endpointWorker('index.php', { action: 'update_customer_account', id: 'QA-ACC-4', status: 'Disabled' }, { role: 'admin', ready: `${gateRoot}-staff` }),
  ]);
  check(concurrent.every((response) => response.body.ok && response.cleanOutput), 'Parallel profile, password, registration and staff updates all succeed without warnings');
  const afterConcurrent = JSON.parse(await readFile(resolve(data, 'customer_accounts.json'), 'utf8'));
  check(afterConcurrent.length === 7 && afterConcurrent.some((record) => record.email === 'qa.concurrent@example.test'), 'Concurrent registration remains in the shared accounts array');
  check(Array.from({ length: 4 }, (_, index) => afterConcurrent.find((record) => record.id === `QA-ACC-${index}`)?.firstName === `Updated ${index}`).every(Boolean), 'All independent profile edits survive competing writes');
  check(afterConcurrent.find((record) => record.id === 'QA-ACC-4')?.status === 'Disabled', 'Concurrent staff account disable is preserved');
  check(afterConcurrent.find((record) => record.id === 'QA-ACC-5')?.firstName === 'Initial 5', 'Unrelated account remains unchanged');
  const passwordKept = phpWorker("require 'public/api/bootstrap.php'; $p=json_decode(getenv('OPTIKA_QA_PAYLOAD'),true); $a=om_customer_account_by_id('QA-ACC-0'); echo json_encode(['ok'=>password_verify($p['password'],$a['passwordHash'])]);", { password: nextPassword });
  check((await passwordKept.promise).body.ok, 'Same-account profile edit never overwrites a concurrent password change');
  check(!JSON.stringify(concurrent.map((response) => response.body)).includes('passwordHash'), 'Account endpoint responses do not expose password hashes');

  const passwordRace = await withWriterBarrier((gateRoot) => conflictPasswords.map((password, index) => endpointWorker('account.php', { action: 'change_password', currentPassword: originalPassword, newPassword: password }, { accountId: 'QA-ACC-1', ready: `${gateRoot}-password-${index}` })));
  check(passwordRace.filter((response) => response.status === 200).length === 1 && passwordRace.filter((response) => response.status === 422 && response.body.error === 'current_password_incorrect').length === 1, 'Two password changes recheck latest hash and accept only one stale-current-password request');
  const winningPassword = conflictPasswords[passwordRace.findIndex((response) => response.status === 200)];
  const winnerStored = phpWorker("require 'public/api/bootstrap.php'; $p=json_decode(getenv('OPTIKA_QA_PAYLOAD'),true); $a=om_customer_account_by_id('QA-ACC-1'); echo json_encode(['ok'=>password_verify($p['password'],$a['passwordHash'])]);", { password: winningPassword });
  check((await winnerStored.promise).body.ok, 'Successful competing password change is the persisted credential');

  const disabledWhileWaiting = await withWriterBarrier((gateRoot) => [endpointWorker('account.php', profileRequest(2), { accountId: 'QA-ACC-2', ready: `${gateRoot}-profile` })], async () => {
    const accounts = JSON.parse(await readFile(resolve(data, 'customer_accounts.json'), 'utf8'));
    accounts.find((record) => record.id === 'QA-ACC-2').status = 'Disabled';
    await writeFile(resolve(data, 'customer_accounts.json'), JSON.stringify(accounts));
  });
  check(disabledWhileWaiting[0].status === 401 && disabledWhileWaiting[0].body.error === 'authentication_required', 'Profile rechecks disabled account after waiting for writer lock');
  const deniedAnonymous = await endpointWorker('account.php', profileRequest(0), { role: '' }).promise;
  check(deniedAnonymous.status === 401, 'Anonymous profile mutation remains denied');
  const deniedCsrf = await endpointWorker('account.php', profileRequest(0), { csrfHeader: 'invalid' }).promise;
  check(deniedCsrf.status === 403, 'Profile mutation still requires matching CSRF');
  const invalidStaff = await endpointWorker('index.php', { action: 'update_customer_account', id: 'QA-MISSING', status: 'Disabled' }, { role: 'admin' }).promise;
  check(invalidStaff.status === 404, 'Unknown staff account update returns 404 without hanging the shared lock');
  check((await endpointWorker('account.php', profileRequest(3), { accountId: 'QA-ACC-3' }).promise).body.ok, 'Subsequent writer proceeds after an early error response');

  const rxSource = await readFile(resolve(root, 'public/api/prescription-upload.php'), 'utf8');
  const startMarker = '$registryLock = om_acquire_commerce_lock();';
  const endMarker = 'om_release_commerce_lock($registryLock);';
  const startIndex = rxSource.indexOf(startMarker);
  const endIndex = rxSource.indexOf(endMarker, startIndex);
  assert.ok(startIndex >= 0 && endIndex > startIndex, 'RX registry must have the shared writer lock around its critical section');
  const criticalSection = rxSource.slice(startIndex, endIndex + endMarker.length);
  check(criticalSection.indexOf("om_read('prescription_uploads'") > 0 && criticalSection.indexOf("om_write('prescription_uploads'") > criticalSection.indexOf("om_read('prescription_uploads'"), 'Upload source locks before registry read and unlocks after write');
  await writeFile(resolve(data, 'synthetic-image.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'));
  const existingRx = { token: 'RX-QA-EXISTING', storedName: 'synthetic-existing.png', status: 'Attached', orderId: 'OM-QA-EXISTING', attachedAt: '2026-01-01T00:00:00Z' };
  await writeFile(resolve(data, 'prescription_uploads.json'), JSON.stringify([existingRx]));
  const uploadWorkerSource = `require 'public/api/bootstrap.php'; $p=json_decode(getenv('OPTIKA_QA_PAYLOAD'),true); $token=$p['token']; $storedName=strtolower($token).'.png'; $file=['name'=>'synthetic-no-patient.png']; $allowed=['image/png'=>'png']; $mime='image/png'; $target=om_storage_dir().'/synthetic-image.png'; $size=filesize($target); file_put_contents($p['ready'],'ready'); ${criticalSection} echo json_encode(['ok'=>true,'token'=>$token]);`;
  const uploads = await withWriterBarrier((gateRoot) => Array.from({ length: 8 }, (_, index) => {
    const readyPath = `${gateRoot}-upload-${index}`;
    const worker = phpWorker(uploadWorkerSource, { token: `RX-QA-NEW-${index}`, ready: readyPath });
    worker.readyPath = readyPath; return worker;
  }));
  check(uploads.every((response) => response.body.ok && response.cleanOutput), 'Concurrent actual registry critical sections all finish safely');
  const registry = JSON.parse(await readFile(resolve(data, 'prescription_uploads.json'), 'utf8'));
  check(registry.length === 9 && new Set(registry.map((record) => record.token)).size === 9, 'Every concurrent upload token remains in the registry exactly once');
  check(JSON.stringify(registry.find((record) => record.token === existingRx.token)) === JSON.stringify(existingRx), 'Existing prescription attachment and order reference remain unchanged');
  check(registry.filter((record) => record.token !== existingRx.token).every((record) => record.status === 'Unassigned' && record.orderId === '' && record.sha256.length === 64), 'New upload registry metadata preserves normal unassigned semantics');
  const audit = JSON.parse(await readFile(resolve(data, 'audit.json'), 'utf8'));
  check(uploads.every((response) => audit.some((event) => event.action === 'prescription_uploaded' && event.entityId === response.body.token)), 'Concurrent upload audit entries persist while guarded by the lock');

  await writeFile(resolve(out, 'checks.json'), JSON.stringify({
    testedAt: new Date().toISOString(), environment: 'Concurrent PHP CLI workers, isolated synthetic account store and lock barriers; no HTTP ports or live calls',
    storageDirectory: data, results,
    limitations: ['The prescription test executes the exact registry critical section extracted from prescription-upload.php, after simulated file validation. Actual multipart upload, is_uploaded_file and move_uploaded_file are not exercised by this CLI suite.'],
  }, null, 2));
  process.exitCode = results.some((item) => item.status === 'failed') ? 1 : 0;
} finally {
  for (const child of children) child.kill();
}
