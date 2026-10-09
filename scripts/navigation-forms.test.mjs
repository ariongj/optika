import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bookingCalendar, bookingTimes, bookingContactError, sendAppointment, appointmentFailure, initialMeasurementMarkers, estimatePhotoDimensions } from '../src/navigationForms.js';

const valid = { name: 'Test Person', phone: '+383 44 123 456', email: 'person@example.test', message: '', consent: true };
const reply = (body, status = 201) => ({ status, ok: status < 300, json: async () => body });

test('booking days use Kosovo time, tomorrow onwards, and skip Sundays', () => {
  const days = bookingCalendar(new Date('2026-09-29T22:30:00Z'));
  assert.equal(days[0].value, '2026-10-01');
  assert.equal(days.length, 12);
  assert.equal(new Set(days.map(day => day.value)).size, 12);
  assert.equal(days.some(day => new Date(`${day.value}T12:00:00Z`).getUTCDay() === 0), false);
});
test('booking calendar remains stable across daylight saving and year boundaries', () => {
  const days = bookingCalendar(new Date('2026-12-31T23:30:00Z'));
  assert.equal(days[0].value, '2027-01-02');
  assert.equal(days[1].value, '2027-01-04');
  assert.deepEqual(bookingTimes, ['10:00', '11:30', '13:00', '15:00', '16:30', '18:00']);
});
test('booking validates names, phone digits, optional email, note and consent', () => {
  assert.equal(bookingContactError(valid), null);
  assert.equal(bookingContactError({ ...valid, email: '' }), null);
  for (const [field, value] of [['name', '  '], ['name', 'A'], ['phone', '123'], ['phone', 'hello1234567'], ['phone', '1234567890123456'], ['email', 'not-email'], ['message', 'x'.repeat(1001)], ['consent', false]]) {
    assert.equal(bookingContactError({ ...valid, [field]: value })?.[0], field);
  }
});
test('appointment sender requires a real accepted reference and forwards idempotency key', async () => {
  let sent;
  const result = await sendAppointment({ appointmentRequestId: 'same-key', ...valid }, async (url, options) => {
    assert.equal(url, '/api/submit.php'); assert.equal(options.credentials, 'same-origin');
    sent = JSON.parse(options.body);
    return reply({ ok: true, accepted: true, id: 'SUB-ABC123' });
  });
  assert.equal(result.id, 'SUB-ABC123'); assert.equal(sent.appointmentRequestId, 'same-key'); assert.equal(sent.company, '');
});
test('fake OK, missing reference and malformed responses never claim success', async () => {
  for (const body of [null, { ok: true }, { ok: true, accepted: true }, { ok: true, accepted: true, id: '<script>' }]) {
    await assert.rejects(sendAppointment(valid, async () => reply(body)), /appointment_unconfirmed/);
  }
});
test('validation, rate limit and conflicts retain meaningful response codes', async () => {
  for (const status of [422, 429, 409]) {
    await assert.rejects(sendAppointment(valid, async () => reply({ ok: false, error: 'test', fields: { name: 'invalid' } }, status)), error => error.status === status && error.fields.name === 'invalid');
    assert.ok(appointmentFailure({ status }).length > 30);
  }
  assert.match(appointmentFailure(new Error('network')), /mund të jetë ruajtur/);
});
test('measurement uses only card-ratio geometry without made-up confidence or fitting sizes', () => {
  const result = estimatePhotoDimensions(initialMeasurementMarkers());
  assert.ok(Math.abs(result.pd - 62.06) < .001);
  assert.ok(Math.abs(result.faceWidth - 139.1) < .001);
  assert.deepEqual(Object.keys(result), ['pd', 'faceWidth']);
});
test('measurement rejects missing, inverted, nonfinite, tiny or crossed geometry', () => {
  for (const markers of [null, {}, { ...initialMeasurementMarkers(), card: [50, 50] }, { ...initialMeasurementMarkers(), card: [49, 50] }, { ...initialMeasurementMarkers(), pupils: [0, 65] }, { ...initialMeasurementMarkers(), pupils: [40, Infinity] }, { ...initialMeasurementMarkers(), face: [90, 10] }]) assert.equal(estimatePhotoDimensions(markers), null);
});
test('measurements depend on ratios, not viewport size', () => {
  const result = estimatePhotoDimensions({ card: [10, 50], pupils: [22, 51], face: [5, 70] });
  assert.ok(Math.abs(result.pd - 62.06) < .001);
});
test('UI preserves confirmation gate, photo reset, private analytics and accessible navigation', () => {
  const app = readFileSync('src/App.jsx', 'utf8');
  const measurement = app.slice(app.indexOf('function OnlineMeasurement('), app.indexOf('function LensFocusHero('));
  assert.match(measurement, /Boolean\(photoData && calibrationConfirmed && results\)/);
  assert.match(measurement, /setCalibrationConfirmed\(false\)/);
  assert.match(measurement, /Hiq fotografinë/);
  assert.doesNotMatch(measurement, /placementScore|frameRange|estimated_pd:/);
  const header = app.slice(app.indexOf('function Header('), app.indexOf('function HomePage('));
  assert.match(header, /useDialogFocus\(mobileOpen, mobileNavRef/);
  assert.match(header, /hidden=\{!isOpen\}/);
  assert.match(header, /aria-controls=\{hasSubpages \? `desktop-subnav-/);
  assert.match(header, /role="dialog" aria-modal="true"/);
  assert.match(header, /"ArrowDown", "ArrowUp", "Home", "End"/);
  assert.doesNotMatch(header, /aria-haspopup="menu"/);
});

test('mobile menu overrides the rejected navy and bright blue legacy states', () => {
  const css = readFileSync('src/styles/navigation-forms.css', 'utf8');
  assert.match(css, /\.mobile-nav :is\(\.mobile-nav-primary, \.mobile-account-link\) \{ color: #fffefa !important; background: #263e33 !important; border-color: #263e33 !important;/);
  assert.match(css, /\.mobile-nav-heading \.mobile-nav-parent\.active,/);
  assert.match(css, /\.mobile-subnav button\[aria-current="page"\] \{ color: #263e33 !important; background: #edf0e8 !important;/);
  assert.match(css, /\.mobile-subnav button \{ border-left-color: #d8d9ce !important;/);
  assert.doesNotMatch(css, /#00102e|#1059ca|#edf3fc|#b9c9e3/i);
});
