import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';

// Source PHP is exercised on this project's assigned LOCAL port, with isolated
// data and mail disabled. This never contacts a live host or writes real records.
const root = resolve('.');
const port = 4190;
await new Promise((ready, fail) => {
  const probe = net.createServer();
  probe.once('error', () => fail(new Error('Port 4190 is occupied. Stop the prior Optika QA server before running isolated partner tests.')));
  probe.listen(port, '127.0.0.1', () => probe.close(ready));
});
const out = resolve(root, 'output/qa/lab-partners');
const data = resolve(out, `run-${Date.now()}`);
assert.ok(data.startsWith(out + sep));
await mkdir(data, { recursive: true });
const adminPassword = `Qa!${randomBytes(24).toString('hex')}`;
const salt = randomBytes(18).toString('hex');
await writeFile(resolve(data, 'credentials.json'), JSON.stringify({
  email: 'qa.lab.admin@example.test', salt,
  hash: pbkdf2Sync(adminPassword, salt, 120000, 32, 'sha256').toString('hex'),
  iterations: 120000, updatedAt: new Date().toISOString(),
}));
// Override shipped demonstration seeds; no account is provisioned by this test.
await writeFile(resolve(data, 'customer_accounts.json'), '[]');
await writeFile(resolve(data, 'customers.json'), '[]');

const results = [];
const check = (value, name) => {
  results.push({ name, status: value ? 'verified' : 'failed' });
  console.log(`${value ? 'PASS' : 'FAIL'} ${name}`);
};
function client() {
  let cookie = '';
  return async (path, body, csrf = '', extraHeaders = {}) => new Promise((ready, fail) => {
    const content = body ? JSON.stringify(body) : '';
    const req = http.request({
      host: '127.0.0.1', port, path, method: body ? 'POST' : 'GET',
      headers: {
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(content) } : {}),
        ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...extraHeaders,
      },
    }, (res) => {
      if (res.headers['set-cookie']) cookie = res.headers['set-cookie'].map((value) => value.split(';')[0]).join('; ');
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try { ready({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { fail(new Error(`Expected JSON from synthetic local ${path}, HTTP ${res.statusCode}: ${raw.slice(0,800)}`)); }
      });
    });
    req.setTimeout(10000, () => req.destroy(new Error('Isolated PHP request timed out')));
    req.on('error', fail);
    req.end(content);
  });
}
const api = '/api/index.php';
const submit = '/api/submit.php';
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
    if (php.exitCode !== null) throw new Error('Isolated PHP server exited during startup');
    try { await probe(api + '?resource=session'); return; }
    catch { await new Promise((ready) => setTimeout(ready, 100)); }
  }
  throw new Error('Isolated PHP server did not become ready');
}
async function stopServer() {
  if (!php || php.exitCode !== null) return;
  const exited = once(php, 'exit');
  php.kill();
  await exited;
}
const clearLocalRateHistory = () => writeFile(resolve(data, 'rate_limits_public_submissions.json'), '{}');
const application = (changes = {}) => ({
  type: 'enquiry', division: 'lab', applicationRequestId: randomUUID(), name: 'Synthetic B2B QA',
  organization: 'Synthetic optics test', email: 'qa.partner@example.test', phone: '',
  marketSegment: 'kosovo', country: 'XK', businessType: 'optical', interest: 'prescription',
  sourcePath: '/laboratory/kosovo', locale: 'sq', consent: true, website: '', company: '', ...changes,
});

try {
  await startServer();
  const anon = client();
  let admin = client();
  const loginAdmin = async () => {
    const result = await admin(api, { action: 'login', email: 'qa.lab.admin@example.test', password: adminPassword });
    assert.equal(result.body.authenticated, true);
    return result.body.csrf;
  };
  let csrf = await loginAdmin();
  const snapshot = async () => (await admin(api + '?resource=snapshot')).body;
  for (const key of ['labKosovoImage', 'labEuropeImage', 'opticalLifestyleImage']) {
    const imagePath = '/assets/brand/optika-examination-2026.webp';
    const savedImage = await admin(api, { action: 'save_content', content: { [key]: imagePath } }, csrf);
    check(savedImage.body.ok && (await anon(api + '?resource=public')).body.content[key] === imagePath, `${key}: local CMS image is accepted and published`);
    check((await admin(api, { action: 'save_content', content: { [key]: 'https://outside.example.test/tracker.jpg' } }, csrf)).status === 422, `${key}: remote image URL is rejected`);
    await admin(api, { action: 'save_content', content: { [key]: '' } }, csrf);
  }
  check((await anon(api + '?resource=snapshot')).status === 401, 'Anonymous application inbox access denied');
  check((await anon(submit)).status === 405, 'Application endpoint rejects GET');
  check((await anon(submit, application(), '', { Origin: 'https://different.example.test' })).status === 403, 'Cross-origin application rejected');

  const kosovo = application();
  const created = await anon(submit, kosovo);
  check(created.status === 201 && created.body.accepted && created.body.id, 'Kosovo business application accepted without a phone');
  const first = (await snapshot()).submissions.find((item) => item.id === created.body.id);
  check(first?.marketSegment === 'kosovo' && first.country === 'XK' && first.market === 'Kosovë', 'Kosovo routing persisted separately from display market');
  check(first?.organization === kosovo.organization && first.email === kosovo.email && first.businessType === 'optical' && first.interest === 'prescription', 'Required business contact and interest persisted');
  check(first?.sourcePath === '/laboratory/kosovo' && first.locale === 'sq' && first.contactConsentAt && first.status === 'New', 'Source, locale, consent timestamp and pending review preserved');
  check(first?.message === '' && first.applicationSchemaVersion === 1 && first.applicationRequestId === kosovo.applicationRequestId, 'Business-only schema saved without patient message');
  check((await snapshot()).accounts.length === 0 && (await snapshot()).customers.length === 0, 'Application does not create or approve an account or customer');
  check(!JSON.stringify(created.body).includes(kosovo.email) && !JSON.stringify(created.body).includes('idempotencyFingerprint'), 'Public acknowledgement contains no contact details or fingerprint');
  const retry = await anon(submit, kosovo);
  check(retry.status === 200 && retry.body.duplicate && retry.body.id === created.body.id, 'Identical retry returns same application reference');
  check((await snapshot()).submissions.filter((item) => item.applicationRequestId === kosovo.applicationRequestId).length === 1, 'Retry creates no duplicate record');

  for (const changes of [{ email: 'someone.else@example.test' }, { organization: 'Another test organization' }, { interest: 'mounting' }]) {
    const conflict = await client()(submit, { ...kosovo, ...changes });
    check(conflict.status === 409 && conflict.body.error === 'application_request_conflict' && !conflict.body.id && !conflict.body.accepted, 'Changed retry payload conflicts without revealing existing application');
  }
  await clearLocalRateHistory();
  const european = application({ marketSegment: 'eu', country: 'DE', businessType: 'distributor', interest: 'documentation', sourcePath: '/laboratory/europe', locale: 'en', website: 'https://optical.example.test/partners' });
  const europeCreated = await anon(submit, european);
  const europeRecord = (await snapshot()).submissions.find((item) => item.id === europeCreated.body.id);
  check(europeCreated.status === 201 && europeRecord?.country === 'DE' && europeRecord.market === 'BE · DE', 'European application reaches its own market and country');
  check(europeRecord?.interest === 'documentation' && europeRecord.service === 'Kërkesë për dokumentacion profesional' && europeRecord.website === european.website && europeRecord.locale === 'en', 'Documentation interest and HTTPS business website stored without certification claims');

  const invalidCases = [
    [{ consent: false }, 'consent_required'], [{ consent: 'true' }, 'consent_required'],
    [{ name: '' }, 'application_contact_required'], [{ organization: '' }, 'application_contact_required'],
    [{ email: '' }, 'application_contact_required'], [{ email: 'not-an-email' }, 'invalid_email'],
    [{ applicationRequestId: '' }, 'invalid_application_request_id'], [{ applicationRequestId: 'predictable' }, 'invalid_application_request_id'],
    [{ marketSegment: 'world' }, 'invalid_application_market'], [{ country: 'DE' }, 'invalid_application_country'],
    [{ marketSegment: 'eu', country: 'US', sourcePath: '/laboratory/europe' }, 'invalid_application_country'],
    [{ businessType: 'approved' }, 'invalid_application_business_type'], [{ interest: 'surgery' }, 'invalid_application_interest'],
    [{ sourcePath: 'https://outside.example.test' }, 'invalid_application_source'], [{ sourcePath: '/laboratory/europe' }, 'invalid_application_source'],
    [{ locale: 'xx' }, 'invalid_application_locale'], [{ type: 'order' }, 'invalid_division_type'],
    [{ website: 'http://optical.example.test' }, 'invalid_application_website'], [{ website: 'javascript:alert(1)' }, 'invalid_application_website'],
    [{ website: 'https://user:password@optical.example.test' }, 'invalid_application_website'], [{ website: 'https://127.0.0.1/' }, 'invalid_application_website'],
    [{ website: 'https://optical.local/' }, 'invalid_application_website'], [{ website: 'https://optical.example.test:8443/' }, 'invalid_application_website'],
    [{ website: 'https://optical.example.test/' + 'x'.repeat(300) }, 'invalid_application_website'], [{ website: [] }, 'invalid_application_website'],
    [{ message: 'Synthetic health data must not be collected' }, 'application_business_contact_only'],
    [{ patient: { name: 'Synthetic' } }, 'application_business_contact_only'], [{ prescriptionToken: 'synthetic-private-token' }, 'application_business_contact_only'],
  ];
  const beforeInvalid = (await snapshot()).submissions.length;
  for (const [changes, error] of invalidCases) {
    await clearLocalRateHistory();
    const invalid = await anon(submit, application(changes));
    check(invalid.status === 422 && invalid.body.error === error, `Invalid application rejected: ${Object.keys(changes).join(',')} / ${error}`);
  }
  check((await snapshot()).submissions.length === beforeInvalid, 'Invalid applications leave no stored records');
  await clearLocalRateHistory();
  const honey = await anon(submit, application({ company: 'synthetic spam' }));
  check(honey.body.accepted && !honey.body.id && (await snapshot()).submissions.length === beforeInvalid, 'Honeypot remains a silent non-persisted acceptance');
  const hubCreated = await anon(submit, application({ sourcePath: '/laboratory/partners', phone: '+000000000', interest: 'partnership', businessType: 'clinic' }));
  check(hubCreated.status === 201, 'Partner hub supports the same explicit application contract');
  const legacy = await anon(submit, { type: 'enquiry', division: 'lab', name: 'Legacy QA', phone: '+000000000', organization: 'Legacy optics', market: 'Kosovë', service: 'Bashkëpunim për lente me recetë', consent: true, message: 'Legacy medical free text must still be dropped' });
  const legacyRecord = (await snapshot()).submissions.find((item) => item.id === legacy.body.id);
  check(legacy.status === 201 && legacyRecord?.market === 'Kosovë' && legacyRecord.message === '' && !legacyRecord.applicationSchemaVersion, 'Legacy lab form remains compatible and excludes free text');
  const appointment = await anon(submit, { type: 'appointment', name: 'Synthetic appointment', phone: '+000000000', service: 'QA only', preferredDate: '2026-10-02', message: 'Synthetic appointment note' });
  check(appointment.status === 201, 'Existing optical appointment still accepted');
  const clinic = await anon(submit, { type: 'enquiry', division: 'clinic', name: 'Synthetic clinic', phone: '+000000000', service: 'Konsultë me specialistin e syve', consent: true });
  check(clinic.status === 201, 'Existing clinic enquiry still accepted');

  check((await anon(api, { action: 'update_submission', submission: { id: created.body.id, status: 'Confirmed' } })).status === 401, 'Anonymous status mutation denied');
  check((await admin(api, { action: 'update_submission', submission: { id: created.body.id, status: 'Confirmed' } })).status === 403, 'Application management requires CSRF');
  const edit = await admin(api, { action: 'update_submission', submission: { id: created.body.id, status: 'Contacted', assignedTo: 'QA Lab team', internalNote: 'Synthetic internal follow-up', marketSegment: 'eu', country: 'DE', applicationRequestId: randomUUID() } }, csrf);
  const edited = edit.body.submissions.find((item) => item.id === created.body.id);
  check(edit.body.ok && edited.status === 'Contacted' && edited.assignedTo === 'QA Lab team' && edited.internalNote === 'Synthetic internal follow-up', 'Admin can assign and progress an application');
  check(edited.marketSegment === 'kosovo' && edited.country === 'XK' && edited.applicationRequestId === kosovo.applicationRequestId && edited.contactConsentAt === first.contactConsentAt, 'Admin workflow cannot rewrite consent, market or retry identity');
  check((await admin(api, { action: 'update_submission', submission: { id: created.body.id, status: 'Approved partner' } }, csrf)).status === 422, 'Unimplemented partner approval status rejected');
  const afterEditRetry = await anon(submit, kosovo);
  check(afterEditRetry.body.duplicate && afterEditRetry.body.id === created.body.id && !JSON.stringify(afterEditRetry.body).includes('Synthetic internal'), 'Retry remains safe after admin follow-up');
  check(!(await anon(api + '?resource=public')).body.submissions, 'Public catalogue never exposes partner inbox');
  check((await snapshot()).audit.some((item) => item.action === 'public_submission' && item.entityId === created.body.id) && (await snapshot()).audit.some((item) => item.action === 'update_submission' && item.entityId === created.body.id), 'Application creation and staff update have audit entries');

  await clearLocalRateHistory();
  const burstPayload = application({ marketSegment: 'eu', country: 'FR', sourcePath: '/laboratory/europe', interest: 'mounting' });
  const burst = await Promise.all(Array.from({ length: 8 }, () => client()(submit, burstPayload)));
  check(burst.filter((item) => item.status === 201).length === 1 && burst.filter((item) => item.body.duplicate).length === 7, 'Simultaneously issued retries produce one application and seven acknowledgements');
  check((await snapshot()).submissions.filter((item) => item.applicationRequestId === burstPayload.applicationRequestId).length === 1, 'Retry burst persists only one application');
  await clearLocalRateHistory();
  await stopServer();
  await startServer();
  admin = client();
  csrf = await loginAdmin();
  const restored = (await snapshot()).submissions.find((item) => item.id === created.body.id);
  check(restored?.status === 'Contacted' && restored.country === 'XK' && restored.contactConsentAt === first.contactConsentAt, 'Application routing, consent and staff follow-up survive server restart');
  check((await client()(submit, kosovo)).body.duplicate, 'Idempotent retry survives server restart and new browser session');
  check((await snapshot()).accounts.length === 0, 'No partner account has been silently provisioned');

  await clearLocalRateHistory();
  const existingInbox = JSON.parse(await readFile(resolve(data, 'submissions.json'), 'utf8'));
  const syntheticInbox = Array.from({ length: 3000 }, (_, index) => ({ id: `QA-ROLLING-${index}`, type: 'appointment', division: 'optical', name: 'Synthetic retention check', status: 'Closed' }));
  await writeFile(resolve(data, 'submissions.json'), JSON.stringify([...syntheticInbox, ...existingInbox]));
  await anon(submit, { type: 'appointment', name: 'Synthetic new appointment', phone: '+000000000', service: 'QA only' });
  const retainedInbox = (await snapshot()).submissions;
  check(retainedInbox.some((item) => item.id === created.body.id) && retainedInbox.some((item) => item.id === europeCreated.body.id), 'Structured partner applications survive the legacy rolling-inbox limit');
  check(retainedInbox.filter((item) => item.applicationSchemaVersion !== 1).length === 3000, 'Existing non-application rolling retention remains unchanged');
  check((await client()(submit, kosovo)).body.duplicate, 'Application retry identity survives rolling-inbox pressure');

  await clearLocalRateHistory();
  for (let attempt = 0; attempt < 20; attempt++) await anon(submit, { ...kosovo, consent: false });
  const limited = await anon(submit, application());
  check(limited.status === 429 && limited.body.retryAfter > 0, 'Existing twenty-per-hour public submission limit remains enforced');
  const stored = JSON.parse(await readFile(resolve(data, 'submissions.json'), 'utf8'));
  check(stored.every((item) => !item.patient && !item.patientData && !item.prescriptionToken), 'No clinical or prescription fields stored in business applications');
  await writeFile(resolve(out, 'checks.json'), JSON.stringify({
    testedAt: new Date().toISOString(), environment: 'Isolated localhost PHP source, mail disabled; no production calls',
    storageDirectory: data, results, limitations: ['PHP built-in server serializes execution; retry burst is not a multi-worker load test.', 'No transactional email or automatic partner approval is part of this application flow.'],
  }, null, 2));
  process.exitCode = results.some((item) => item.status === 'failed') ? 1 : 0;
} finally {
  await stopServer();
}
