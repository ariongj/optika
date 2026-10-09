import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  EU_PARTNER_COUNTRIES, initialLabPartnerFields, applyLabInitialInterest, normalizeLabPartnerFields,
  validateLabPartnerFields, createLabApplicationRequestId, labPartnerFingerprint,
  buildLabPartnerPayload, submitLabPartnerApplication, LabPartnerSubmissionError,
  labPartnerErrorKey,
} from '../src/labPartnerForm.js';

const token = 'c2b1a17b-c4e6-4a03-a471-69d1e7d73d31';
const fields = {
  ...initialLabPartnerFields('eu'), name: 'Test Partner', organization: 'Example Optics',
  email: 'partner@example.test', country: 'DE', consent: true,
};
const options = { marketSegment: 'eu', locale: 'en', sourcePath: '/laboratory/europe', applicationRequestId: token };
const response = (body, status = 201) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const failure = async (body, status) => {
  try { await submitLabPartnerApplication(buildLabPartnerPayload(fields, options), { fetcher: async () => response(body, status) }); }
  catch (error) { return error; }
  throw new Error('Expected request to fail.');
};

test('Kosovo defaults to XK; EU requires a deliberate country choice', () => {
  assert.equal(initialLabPartnerFields('kosovo').country, 'XK');
  assert.equal(initialLabPartnerFields('eu').country, '');
  assert.equal(initialLabPartnerFields('eu', 'documentation').interest, 'documentation');
  assert.equal(initialLabPartnerFields('eu', 'made-up-interest').interest, 'partnership');
});

test('EU selector contains exactly the 27 member-country codes, not Kosovo or UK', () => {
  assert.equal(EU_PARTNER_COUNTRIES.length, 27);
  assert.equal(new Set(EU_PARTNER_COUNTRIES.map(([code]) => code)).size, 27);
  assert.equal(EU_PARTNER_COUNTRIES.some(([code]) => ['XK', 'GB'].includes(code)), false);
});

test('documentation CTA changes the initial topic after mount without losing typed contact details', () => {
  const changed = applyLabInitialInterest(fields, 'documentation');
  assert.equal(changed.interest, 'documentation');
  assert.deepEqual({ ...changed, interest: fields.interest }, fields);
  assert.equal(changed.name, fields.name); assert.equal(changed.email, fields.email);
});

test('a page CTA cannot silently change a pending, uncertain or confirmed attempt', () => {
  for (const state of [{ pending: true }, { hasAttempt: true }, { submitted: true }]) {
    assert.equal(applyLabInitialInterest(fields, 'documentation', state), fields);
  }
  assert.equal(applyLabInitialInterest(fields, 'unknown'), fields);
});

test('required identity, organisation, email and consent errors are reported', () => {
  const errors = validateLabPartnerFields(initialLabPartnerFields('eu'), 'eu');
  assert.deepEqual(Object.keys(errors), ['name', 'organization', 'email', 'country', 'consent']);
});

test('optional phone can remain blank; valid EU and Kosovo enquiries pass', () => {
  assert.deepEqual(validateLabPartnerFields(fields, 'eu'), {});
  assert.deepEqual(validateLabPartnerFields({ ...fields, country: 'XK' }, 'kosovo'), {});
  assert.deepEqual(validateLabPartnerFields({ ...fields, phone: '+383 (0) 44 123-456' }, 'eu'), {});
});

test('country cannot leak between the Kosovo and EU market routes', () => {
  assert.equal(validateLabPartnerFields(fields, 'kosovo').country, 'country');
  assert.equal(validateLabPartnerFields({ ...fields, country: 'XK' }, 'eu').country, 'country');
  assert.equal(validateLabPartnerFields({ ...fields, country: 'GB' }, 'eu').country, 'country');
  assert.equal(validateLabPartnerFields(fields, 'other').form, 'configuration');
});

test('types and interests are enums rather than free patient-text fields', () => {
  const errors = validateLabPartnerFields({ ...fields, businessType: 'patient', interest: 'Patient prescription: ...' }, 'eu');
  assert.equal(errors.businessType, 'businessType'); assert.equal(errors.interest, 'interest');
});

test('text limits and invalid email / phone values are caught before sending', () => {
  assert.equal(validateLabPartnerFields({ ...fields, name: 'a', organization: 'b', email: 'invalid', phone: 'please call' }, 'eu').name, 'name');
  assert.equal(validateLabPartnerFields({ ...fields, organization: 'b'.repeat(161) }, 'eu').organization, 'organization');
  assert.equal(validateLabPartnerFields({ ...fields, email: `${'a'.repeat(181)}@example.test` }, 'eu').email, 'email');
  assert.equal(validateLabPartnerFields({ ...fields, phone: '123' }, 'eu').phone, 'phone');
});

test('website is optional and HTTPS-only, never a credential-bearing URL', () => {
  assert.deepEqual(validateLabPartnerFields({ ...fields, website: 'https://example.test/about' }, 'eu'), {});
  for (const website of ['http://example.test', 'javascript:alert(1)', 'example.test', 'https://user:password@example.test', 'https://example.test/' + 'a'.repeat(300)]) {
    assert.equal(validateLabPartnerFields({ ...fields, website }, 'eu').website, 'website');
  }
});

test('consent must be the boolean true, not a truthy string', () => {
  assert.equal(validateLabPartnerFields({ ...fields, consent: 'true' }, 'eu').consent, 'consent');
});

test('normalization produces stable retries while retaining the honeypot', () => {
  const normalized = normalizeLabPartnerFields({ ...fields, name: ' Test Partner ', email: ' PARTNER@EXAMPLE.TEST ', country: 'de', company: 'bot' });
  assert.equal(normalized.name, fields.name); assert.equal(normalized.email, fields.email);
  assert.equal(normalized.country, 'DE'); assert.equal(normalized.company, 'bot');
});

test('payload forwards only business-contact contract fields, never arbitrary data', () => {
  const payload = buildLabPartnerPayload({ ...fields, patient: 'not forwarded', message: 'not forwarded', role: 'admin', service: 'not forwarded' }, options);
  assert.deepEqual(Object.keys(payload).sort(), ['type', 'division', 'applicationRequestId', 'name', 'organization', 'email', 'phone', 'country', 'businessType', 'interest', 'website', 'consent', 'company', 'marketSegment', 'sourcePath', 'locale'].sort());
  assert.equal(payload.type, 'enquiry'); assert.equal(payload.division, 'lab');
  assert.equal(payload.applicationRequestId, token);
});

test('invalid request IDs, unknown origins and unsupported locales cannot build a payload', () => {
  for (const change of [{ applicationRequestId: 'bad' }, { sourcePath: '/not-the-lab' }, { locale: 'de' }]) {
    assert.throws(() => buildLabPartnerPayload(fields, { ...options, ...change }), /invalid_application/);
  }
});

test('UUIDs are cryptographically generated, including standards-compatible fallback', () => {
  const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  assert.match(createLabApplicationRequestId(), pattern);
  assert.equal(createLabApplicationRequestId({ getRandomValues: bytes => bytes.fill(0) }), '00000000-0000-4000-8000-000000000000');
  assert.throws(() => createLabApplicationRequestId({}), /request_id_unavailable/);
});

test('fingerprint is stable for normalized values and different for altered details', () => {
  const original = labPartnerFingerprint(fields, 'eu', 'en', options.sourcePath);
  assert.equal(labPartnerFingerprint({ ...fields, email: ' PARTNER@EXAMPLE.TEST ' }, 'eu', 'en', options.sourcePath), original);
  assert.notEqual(labPartnerFingerprint({ ...fields, organization: 'New organisation' }, 'eu', 'en', options.sourcePath), original);
});

test('only the actual same-origin endpoint is called with the stable token and JSON contract', async () => {
  const payload = buildLabPartnerPayload(fields, options);
  const result = await submitLabPartnerApplication(payload, { fetcher: async (path, init) => {
    assert.equal(path, '/api/submit.php'); assert.equal(init.method, 'POST'); assert.equal(init.credentials, 'same-origin');
    assert.equal(init.headers['Content-Type'], 'application/json'); assert.deepEqual(JSON.parse(init.body), payload);
    assert.ok(init.signal instanceof AbortSignal);
    return response({ ok: true, accepted: true, id: 'ENQ-20260929-TEST' });
  } });
  assert.deepEqual(result, { id: 'ENQ-20260929-TEST', duplicate: false });
});

test('idempotent retry returns the same server reference, not a new submission', async () => {
  const payload = buildLabPartnerPayload(fields, options); const seen = [];
  const fetcher = async (_, init) => { seen.push(JSON.parse(init.body).applicationRequestId); return response({ ok: true, accepted: true, id: 'ENQ-TEST', duplicate: seen.length > 1 }, seen.length > 1 ? 200 : 201); };
  const first = await submitLabPartnerApplication(payload, { fetcher });
  const retry = await submitLabPartnerApplication(payload, { fetcher });
  assert.deepEqual(seen, [token, token]); assert.equal(first.id, retry.id); assert.equal(retry.duplicate, true);
});

test('HTTP 200 alone, missing acceptance or absent reference can never show success', async () => {
  for (const body of [{ ok: true }, { ok: true, accepted: true }, { accepted: true, id: 'TEST' }, { ok: true, accepted: false, id: 'TEST' }, { ok: true, accepted: true, id: '<script>bad</script>' }]) {
    const error = await failure(body, 200);
    assert.equal(error.code, 'unconfirmed'); assert.equal(labPartnerErrorKey(error), 'unconfirmed');
  }
});

test('backend validation errors, rate limits and request conflicts stay actionable', async () => {
  const validation = await failure({ error: 'invalid_email', fields: { email: 'invalid' } }, 422);
  assert.deepEqual(validation.fieldErrors, { email: 'invalid' }); assert.equal(labPartnerErrorKey(validation), 'validation');
  assert.equal(labPartnerErrorKey(await failure({ error: 'rate_limited' }, 429)), 'rate');
  assert.equal(labPartnerErrorKey(await failure({ error: 'application_request_conflict' }, 409)), 'conflict');
});

test('older server contract fails honestly instead of treating refusal as receipt', async () => {
  const error = await failure({ ok: false, error: 'name_and_phone_required' }, 422);
  assert.equal(error.code, 'name_and_phone_required'); assert.equal(error.status, 422);
});

test('non-JSON hosting / PHP error pages do not become a successful enquiry', async () => {
  await assert.rejects(() => submitLabPartnerApplication(buildLabPartnerPayload(fields, options), { fetcher: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('HTML'); } }) }), error => error instanceof LabPartnerSubmissionError && error.code === 'unavailable');
});

test('network failure is explicit; no fabricated reference is created', async () => {
  await assert.rejects(() => submitLabPartnerApplication(buildLabPartnerPayload(fields, options), { fetcher: async () => { throw new TypeError('offline'); } }), error => error.code === 'network');
});

test('request timeout aborts fetch and is safe to retry with the original token', async () => {
  await assert.rejects(() => submitLabPartnerApplication(buildLabPartnerPayload(fields, options), {
    timeoutMs: 5, fetcher: (_, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })),
  }), error => error.code === 'timeout' && labPartnerErrorKey(error) === 'timeout');
});

test('unmount abort propagates without being mislabeled a timeout', async () => {
  const controller = new AbortController();
  const submitting = submitLabPartnerApplication(buildLabPartnerPayload(fields, options), {
    signal: controller.signal, fetcher: (_, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })),
  });
  controller.abort(); await assert.rejects(submitting, error => error.code === 'aborted');
});

test('timeout while reading the server response remains a timeout, not a false receipt', async () => {
  await assert.rejects(() => submitLabPartnerApplication(buildLabPartnerPayload(fields, options), {
    timeoutMs: 5, fetcher: async (_, { signal }) => ({ ok: true, status: 201, json: () => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })) }),
  }), error => error.code === 'timeout');
});

test('component provides a real form, labelled errors, focus feedback and no patient free-text area', async () => {
  const component = await readFile(new URL('../src/LabPartnerApplication.jsx', import.meta.url), 'utf8');
  assert.match(component, /onSubmit=\{submit\}/); assert.match(component, /aria-invalid/);
  assert.match(component, /statusRef\.current\?\.focus/); assert.match(component, /role="alert"/);
  assert.match(component, /fieldset disabled=\{pendingState\}/); assert.match(component, /pending\.current/);
  assert.match(component, /attempt\.current\.fingerprint !== fingerprint/); assert.match(component, /startNew\(false\)/);
  assert.match(component, /applyLabInitialInterest\(current, initialInterest/); assert.match(component, /\}, \[initialInterest, interestRequestKey\]\)/);
  assert.doesNotMatch(component, /<textarea|localStorage|sessionStorage/);
  assert.match(component, /This is not partner approval/);
});

test('repeated documentation CTA uses a request key without remounting or clearing the form', async () => {
  const component = await readFile(new URL('../src/LabPartnerApplication.jsx', import.meta.url), 'utf8');
  assert.match(component, /interestRequestKey = 0/);
  assert.match(component, /initialInterest=\{initialInterest\} interestRequestKey=\{interestRequestKey\}/);
  assert.match(component, /\[initialInterest, interestRequestKey\]/);
  assert.doesNotMatch(component, /key=\{[^}]*interestRequestKey/);
  const changedByVisitor = { ...fields, interest: 'mounting' };
  const repeated = applyLabInitialInterest(changedByVisitor, 'documentation');
  assert.equal(repeated.interest, 'documentation');
  assert.equal(repeated.email, fields.email); assert.equal(repeated.organization, fields.organization);
  assert.equal(applyLabInitialInterest(changedByVisitor, 'documentation', { hasAttempt: true }), changedByVisitor);
});

test('privacy is explained in both form languages without automatic marketing or invented retention guarantees', async () => {
  const component = await readFile(new URL('../src/LabPartnerApplication.jsx', import.meta.url), 'utf8');
  assert.match(component, /Authorised Miftari staff/);
  assert.match(component, /Stafi i autorizuar i Miftarit/);
  assert.match(component, /does not automatically subscribe you to marketing/);
  assert.match(component, /nuk ju regjistron automatikisht për mesazhe marketingu/);
  assert.match(component, /contact name, business name, email, optional phone and website, country, business type and selected topic/);
  assert.match(component, /To request a correction or removal/);
  assert.match(component, /fullPrivacy: 'Full privacy policy'/);
  assert.doesNotMatch(component, /retained for \d|GDPR.certified|guaranteed deletion/i);
});

test('consent privacy link opens and focuses the inline disclosure without losing form progress', async () => {
  const component = await readFile(new URL('../src/LabPartnerApplication.jsx', import.meta.url), 'utf8');
  assert.match(component, /href="#lab-application-privacy" aria-controls="lab-application-privacy" aria-expanded=\{privacyOpen\} onClick=\{showPrivacy\}/);
  assert.match(component, /setPrivacyOpen\(true\)/);
  assert.match(component, /privacySummaryRef\.current\?\.focus/);
  assert.match(component, /<details className="lab-application-privacy" id="lab-application-privacy" open=\{privacyOpen\}/);
  assert.match(component, /href="tel:\+38343777667"/);
  assert.match(component, /href="\/policies#privacy" target="_blank" rel="noopener noreferrer">\{copy.fullPrivacy\}/);
});
