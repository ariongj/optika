import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createHash, pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';

// LOCAL-ONLY source API tests. Uses the project's fixed port and refuses to
// reuse an already-running server. No real records, email or production calls.
const root = resolve('.');
const port = 4190;
await new Promise((ready, fail) => {
  const probe = net.createServer();
  probe.once('error', () => fail(new Error('Port 4190 is occupied. Stop the prior Optika QA server before running isolated appointment tests.')));
  probe.listen(port, '127.0.0.1', () => probe.close(ready));
});
const out = resolve(root, 'output/qa/appointment-contract');
const data = resolve(out, `run-${Date.now()}`);
assert.ok(data.startsWith(out + sep));
await mkdir(data, { recursive: true });
const adminPassword = `Qa!${randomBytes(24).toString('hex')}`;
const customerPassword = `Qa!${randomBytes(24).toString('hex')}`;
const salt = randomBytes(18).toString('hex');
await writeFile(resolve(data, 'credentials.json'), JSON.stringify({
  email: 'qa.appointment.admin@example.test', salt,
  hash: pbkdf2Sync(adminPassword, salt, 120000, 32, 'sha256').toString('hex'),
  iterations: 120000, updatedAt: new Date().toISOString(),
}));
await writeFile(resolve(data, 'customer_accounts.json'), '[]');
await writeFile(resolve(data, 'customers.json'), '[]');

const results = [];
const check = (condition, name) => {
  results.push({ name, status: condition ? 'verified' : 'failed' });
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}`);
};
function client() {
  let cookie = '';
  return async (path, body, csrf = '', extraHeaders = {}) => new Promise((ready, fail) => {
    const content = body ? JSON.stringify(body) : '';
    const req = http.request({ host: '127.0.0.1', port, path, method: body ? 'POST' : 'GET', headers: {
      ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(content) } : {}),
      ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...extraHeaders,
    } }, (res) => {
      if (res.headers['set-cookie']) cookie = res.headers['set-cookie'].map((value) => value.split(';')[0]).join('; ');
      let raw = ''; res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try { ready({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { fail(new Error(`Expected local JSON response from ${path}; HTTP ${res.statusCode}`)); }
      });
    });
    req.setTimeout(10000, () => req.destroy(new Error('Isolated appointment API request timed out')));
    req.on('error', fail); req.end(content);
  });
}

const api = '/api/index.php';
const submit = '/api/submit.php';
const account = '/api/account.php';
let php;
async function startServer() {
  php = spawn(resolve(root, 'tmp/php-8.5.9/php.exe'), ['-d', 'disable_functions=mail', '-S', `127.0.0.1:${port}`, '-t', 'public'], {
    cwd: root, env: { ...process.env, OPTIKA_STORAGE_DIR: data }, stdio: 'ignore', windowsHide: true,
  });
  let spawnError;
  php.once('error', (error) => { spawnError = error; });
  const probe = client();
  for (let attempt = 0; attempt < 50; attempt++) {
    if (spawnError) throw spawnError;
    if (php.exitCode !== null) throw new Error('Isolated appointment PHP server exited during startup');
    try { await probe(api + '?resource=session'); return; }
    catch { await new Promise((ready) => setTimeout(ready, 100)); }
  }
  throw new Error('Isolated appointment PHP server did not become ready');
}
async function stopServer() {
  if (!php || php.exitCode !== null) return;
  const exited = once(php, 'exit'); php.kill(); await exited;
}
const clearLocalRateHistory = () => writeFile(resolve(data, 'rate_limits_public_submissions.json'), '{}');
const dateParts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Belgrade', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(({ type, value }) => [type, value]));
const today = new Date(Date.UTC(Number(dateParts.year), Number(dateParts.month) - 1, Number(dateParts.day), 12));
const ymd = (value) => value.toISOString().slice(0, 10);
const days = [];
const cursor = new Date(today);
while (days.length < 13) {
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  if (cursor.getUTCDay() !== 0) days.push(ymd(cursor));
}
const sunday = new Date(today);
do { sunday.setUTCDate(sunday.getUTCDate() + 1); } while (sunday.getUTCDay() !== 0);
const yesterday = new Date(today);
do { yesterday.setUTCDate(yesterday.getUTCDate() - 1); } while (yesterday.getUTCDay() === 0);
const booking = (changes = {}) => ({
  type: 'appointment', appointmentSchemaVersion: 1, appointmentRequestId: randomUUID(),
  name: 'Synthetic booking QA', phone: '+383 (00) 000-000', email: 'qa.booking@example.test',
  service: 'Ekzaminim i syrit', preferredDate: days[0], preferredTime: '10:00',
  message: 'Synthetic fitting preference only', consent: true, company: '', ...changes,
});

try {
  await startServer();
  const anon = client();
  let admin = client();
  const loginAdmin = async () => {
    const response = await admin(api, { action: 'login', email: 'qa.appointment.admin@example.test', password: adminPassword });
    assert.equal(response.body.authenticated, true);
    return response.body.csrf;
  };
  let csrf = await loginAdmin();
  const snapshot = async () => (await admin(api + '?resource=snapshot')).body;
  const payload = booking({ name: '  Synthetic booking QA  ', email: ' QA.Booking@Example.Test ', preferredDate: ` ${days[0]} `, preferredTime: ' 10:00 ', message: '  Synthetic fitting preference only  ' });
  const created = await anon(submit, payload);
  check(created.status === 201 && created.body.accepted && created.body.id, 'Valid versioned appointment is saved with a reference');
  const first = (await snapshot()).submissions.find((item) => item.id === created.body.id);
  check(first?.name === 'Synthetic booking QA' && first.phone === '+38300000000' && first.email === 'qa.booking@example.test', 'Appointment contact is trimmed and phone is normalized');
  check(first?.preferredDate === days[0] && first.preferredTime === '10:00' && first.message === 'Synthetic fitting preference only', 'Selected date, time and note are normalized');
  check(first?.appointmentSchemaVersion === 1 && first.appointmentRequestId === payload.appointmentRequestId && first.appointmentTimezone === 'Europe/Belgrade' && first.contactConsentAt, 'Appointment schema, retry identity, timezone and consent persist');
  check(first?.status === 'New' && !first.confirmedDate && !first.confirmedTime, 'Saved request is not represented as a confirmed appointment');
  check(!JSON.stringify(created.body).includes('qa.booking@example.test') && !JSON.stringify(created.body).includes('idempotencyFingerprint'), 'Public acknowledgement excludes contact details and fingerprint');
  const retry = await client()(submit, payload);
  check(retry.status === 200 && retry.body.duplicate && retry.body.id === created.body.id, 'Identical retry returns the original appointment reference');
  const normalizedRetry = await client()(submit, { ...payload, name: first.name, phone: first.phone, email: first.email, preferredDate: first.preferredDate, preferredTime: first.preferredTime, message: first.message });
  check(normalizedRetry.body.duplicate && normalizedRetry.body.id === created.body.id, 'Equivalent formatting shares the same retry identity');
  check((await snapshot()).submissions.filter((item) => item.appointmentRequestId === payload.appointmentRequestId).length === 1, 'Retry never stores a second appointment');
  for (const changes of [{ name: 'Different synthetic person' }, { phone: '+38300111111' }, { preferredTime: '11:30' }, { preferredDate: days[1] }, { message: 'Different synthetic preference' }]) {
    const conflict = await client()(submit, { ...payload, ...changes });
    check(conflict.status === 409 && conflict.body.error === 'appointment_request_conflict' && !conflict.body.id && !conflict.body.accepted, `Changed ${Object.keys(changes)[0]} conflicts without disclosure`);
  }
  await clearLocalRateHistory();
  const beforeInvalid = (await snapshot()).submissions.length;
  const invalidCases = [
    [{ name: '' }, 'name'], [{ name: ' x ' }, 'name'], [{ name: 'ë'.repeat(141) }, 'name'], [{ name: [] }, 'name'],
    [{ phone: '' }, 'phone'], [{ phone: '123456' }, 'phone'], [{ phone: '1'.repeat(16) }, 'phone'],
    [{ phone: '+383/00123456' }, 'phone'], [{ phone: 'words 1234567' }, 'phone'], [{ phone: '<b>1234567</b>' }, 'phone'],
    [{ email: 'invalid' }, 'email'], [{ email: 'a'.repeat(181) }, 'email'], [{ email: [] }, 'email'],
    [{ service: 'Unapproved service' }, 'service'], [{ preferredDate: '2026-02-30' }, 'preferredDate'],
    [{ preferredDate: '30/09/2026' }, 'preferredDate'], [{ preferredDate: ymd(sunday) }, 'preferredDate'],
    [{ preferredDate: ymd(today) }, 'preferredDate'], [{ preferredDate: ymd(yesterday) }, 'preferredDate'], [{ preferredDate: days[12] }, 'preferredDate'],
    [{ preferredTime: '10:30' }, 'preferredTime'], [{ preferredTime: '23:00' }, 'preferredTime'],
    [{ message: 'ë'.repeat(1001) }, 'message'], [{ message: {} }, 'message'],
    [{ consent: false }, 'consent'], [{ consent: 'true' }, 'consent'],
  ];
  for (const [changes, field] of invalidCases) {
    await clearLocalRateHistory();
    const result = await anon(submit, booking(changes));
    check(result.status === 422 && result.body.error === 'invalid_appointment' && result.body.fields?.[field], `Invalid appointment field rejected: ${field} (${Object.values(changes)[0]?.length ?? typeof Object.values(changes)[0]})`);
  }
  for (const [changes, code] of [
    [{ appointmentSchemaVersion: '1' }, 'invalid_appointment_schema'],
    [{ appointmentSchemaVersion: 2 }, 'invalid_appointment_schema'],
    [{ appointmentSchemaVersion: undefined }, 'invalid_appointment_schema'],
    [{ appointmentRequestId: '' }, 'invalid_appointment_request_id'],
    [{ appointmentRequestId: 'not-a-uuid' }, 'invalid_appointment_request_id'],
  ]) {
    await clearLocalRateHistory();
    const result = await anon(submit, booking(changes));
    check(result.status === 422 && result.body.error === code, `Unsupported appointment contract rejected: ${code}`);
  }
  check((await snapshot()).submissions.length === beforeInvalid, 'Validation failures persist no appointment');
  await clearLocalRateHistory();
  check((await anon(submit, booking(), '', { Origin: 'https://different.example.test' })).status === 403, 'Cross-origin appointment rejected');
  const honey = await anon(submit, booking({ company: 'spam trap' }));
  check(honey.body.accepted && !honey.body.id && (await snapshot()).submissions.length === beforeInvalid, 'Appointment honeypot persists nothing');
  const lastDay = await anon(submit, booking({ name: 'ë'.repeat(140), email: '', message: 'ë'.repeat(1000), preferredDate: days[11], preferredTime: '18:00' }));
  const unicodeRecord = (await snapshot()).submissions.find((item) => item.id === lastDay.body.id);
  check(lastDay.status === 201 && unicodeRecord?.name.length === 140 && unicodeRecord.message.length === 1000, 'Unicode limits and final offered day/slot work without truncation');
  for (const service of ['Matje për progresive', 'Këshillim për recetën', 'Përshtatje e kornizës', 'Ndihmë për porosinë']) {
    check((await anon(submit, booking({ service }))).status === 201, `Existing appointment service accepted: ${service}`);
  }
  const legacy = await anon(submit, { type: 'appointment', name: 'Legacy synthetic QA', phone: '000', service: 'Legacy callback', message: 'Synthetic legacy message' });
  const legacyRecord = (await snapshot()).submissions.find((item) => item.id === legacy.body.id);
  check(legacy.status === 201 && !legacyRecord.appointmentSchemaVersion && legacyRecord.contactConsentAt === null, 'Unversioned legacy booking contract remains unchanged');

  await clearLocalRateHistory();
  const alice = client(), bob = client();
  const registration = (email) => ({ action: 'register', firstName: 'Synthetic', lastName: 'QA', email, phone: '+000000000', password: customerPassword, termsAccepted: true });
  assert.equal((await alice(account, registration('qa.appointment.alice@example.test'))).body.authenticated, true);
  assert.equal((await bob(account, registration('qa.appointment.bob@example.test'))).body.authenticated, true);
  const ownedPayload = booking();
  const owned = await alice(submit, ownedPayload);
  check(owned.status === 201 && (await alice(account + '?resource=profile')).body.appointments.some((item) => item.id === owned.body.id), 'Signed-in customer sees their own appointment');
  const differentAccount = await bob(submit, ownedPayload);
  check(differentAccount.status === 409 && !differentAccount.body.id, 'Identical contact payload cannot replay another account booking');
  check(!(await bob(account + '?resource=profile')).body.appointments.some((item) => item.id === owned.body.id), 'Other account cannot see the appointment');
  check((await anon(submit, ownedPayload)).status === 409, 'Anonymous replay cannot claim an account-owned appointment');
  check((await anon(api, { action: 'update_submission', submission: { id: owned.body.id, status: 'Confirmed' } })).status === 401, 'Anonymous appointment management denied');
  check((await admin(api, { action: 'update_submission', submission: { id: owned.body.id, status: 'Confirmed' } })).status === 403, 'Appointment management requires CSRF');
  const edited = await admin(api, { action: 'update_submission', submission: { id: owned.body.id, status: 'Confirmed', confirmedDate: days[1], confirmedTime: '11:30', internalNote: 'Synthetic private staff note' } }, csrf);
  check(edited.body.ok && (await alice(account + '?resource=profile')).body.appointments.find((item) => item.id === owned.body.id)?.confirmedDate === days[1], 'Staff confirmation reaches only the owning customer');
  check(!JSON.stringify((await alice(account + '?resource=profile')).body).includes('Synthetic private staff note'), 'Internal appointment note stays private');
  const afterEdit = await alice(submit, ownedPayload);
  check(afterEdit.body.duplicate && afterEdit.body.id === owned.body.id && !JSON.stringify(afterEdit.body).includes('Synthetic private staff note'), 'Retry after staff confirmation returns safe original reference');

  await clearLocalRateHistory();
  const burstPayload = booking();
  const burst = await Promise.all(Array.from({ length: 6 }, () => client()(submit, burstPayload)));
  check(burst.filter((item) => item.status === 201).length === 1 && burst.filter((item) => item.body.duplicate).length === 5, 'Simultaneously issued booking retries create one request');
  await stopServer();
  await startServer();
  admin = client();
  csrf = await loginAdmin();
  check((await client()(submit, payload)).body.id === created.body.id, 'Appointment retry survives server restart');
  check((await snapshot()).submissions.find((item) => item.id === created.body.id)?.contactConsentAt === first.contactConsentAt, 'Consent timestamp survives restart unchanged');

  // A seeded historical request simulates an acknowledgement lost until after
  // the booked date, without modifying the system clock or the live store.
  const historicalPayload = booking({ preferredDate: ymd(yesterday), phone: '+38300000000' });
  const historicalValues = Object.fromEntries(['name', 'phone', 'email', 'service', 'preferredDate', 'preferredTime', 'message'].map((field) => [field, historicalPayload[field]]));
  const historicalRecord = {
    ...historicalValues, id: 'SUB-QA-HISTORICAL', type: 'appointment', division: 'optical', status: 'New', accountId: '',
    appointmentSchemaVersion: 1, appointmentRequestId: historicalPayload.appointmentRequestId,
    appointmentTimezone: 'Europe/Belgrade', contactConsentAt: '2020-01-01T00:00:00Z',
    idempotencyFingerprint: createHash('sha256').update(JSON.stringify({ appointment: historicalValues, requestId: historicalPayload.appointmentRequestId, accountId: '', consent: true })).digest('hex'),
  };
  const stored = JSON.parse(await readFile(resolve(data, 'submissions.json'), 'utf8'));
  await writeFile(resolve(data, 'submissions.json'), JSON.stringify([...stored, historicalRecord]));
  await clearLocalRateHistory();
  const historicalRetry = await anon(submit, historicalPayload);
  check(historicalRetry.body.duplicate && historicalRetry.body.id === historicalRecord.id, 'Previously saved appointment can retry after its chosen date');
  const syntheticInbox = Array.from({ length: 3000 }, (_, index) => ({ id: `QA-ROLLING-${index}`, type: 'appointment', division: 'optical', status: 'Closed' }));
  await writeFile(resolve(data, 'submissions.json'), JSON.stringify([...syntheticInbox, ...stored, historicalRecord]));
  await anon(submit, { type: 'appointment', name: 'Legacy synthetic retention check', phone: '000' });
  check((await snapshot()).submissions.some((item) => item.id === created.body.id), 'Versioned appointment survives the legacy rolling inbox cap');
  check((await anon(submit, payload)).body.duplicate, 'Retry still deduplicates after inbox retention pressure');
  check(!(await anon(api + '?resource=public')).body.submissions, 'Public catalogue exposes no appointment inbox');
  check((await snapshot()).audit.some((item) => item.action === 'public_submission' && item.entityId === created.body.id), 'Appointment creation is auditable');
  await clearLocalRateHistory();
  for (let index = 0; index < 20; index++) await anon(submit, booking({ consent: false }));
  const limited = await anon(submit, booking());
  check(limited.status === 429 && limited.body.retryAfter > 0, 'Existing submission rate limit still applies to appointments');

  await writeFile(resolve(out, 'checks.json'), JSON.stringify({
    testedAt: new Date().toISOString(), environment: 'Isolated localhost source PHP; mail disabled; no live mutations',
    storageDirectory: data, results,
    limitations: ['Built-in PHP serializes execution; the retry burst is not a multi-worker load test.', 'Selected times are requests requiring staff confirmation, not live availability.', 'Unversioned deployed forms retain their existing validation behavior.'],
  }, null, 2));
  process.exitCode = results.some((item) => item.status === 'failed') ? 1 : 0;
} finally {
  await stopServer();
}
