import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  queueItems, labMarketLabel, labMarketSegment, submissionCountryLabel,
  submissionMatches, labBusinessLabels, labInterestLabels
} from '../src/servicePresentation.js';

const applications = [
  { id: 'legacy', division: 'lab', organization: 'Optika e mëparshme', market: 'Kosovë dhe BE', status: 'New' },
  { id: 'ks', division: 'lab', marketSegment: 'kosovo', country: 'XK', organization: 'Optika Drita', businessType: 'optical', interest: 'prescription', name: 'Arta Shembull', email: 'arta@example.test', locale: 'sq', sourcePath: '/laboratory/kosovo', status: 'New' },
  { id: 'eu', division: 'lab', marketSegment: 'eu', country: 'DE', organization: 'Berlin Optical', businessType: 'distributor', interest: 'documentation', name: 'Alex Example', email: 'alex@example.test', locale: 'en', sourcePath: '/laboratory/europe', assignedTo: 'Ekipi Lab', status: 'Contacted' },
  { id: 'clinic', division: 'clinic', marketSegment: 'eu', status: 'New' },
  { id: 'retail', name: 'Klient i mëparshëm', status: 'New' }
];
const ids = (queue) => queueItems(applications, queue, 'Contacts').map((item) => item.id);

test('All-lab filter preserves legacy requests alongside both markets', () => {
  assert.deepEqual(ids('labEnquiries'), ['legacy', 'ks', 'eu']);
});
test('Kosovo and EU filters are distinct and do not guess old market strings', () => {
  assert.deepEqual(ids('labKosovoEnquiries'), ['ks']);
  assert.deepEqual(ids('labEuropeEnquiries'), ['eu']);
  assert.deepEqual(ids('labLegacyEnquiries'), ['legacy']);
});
test('Invalid or foreign-division market metadata cannot populate the lab queues', () => {
  assert.equal(labMarketSegment({ division: 'lab', marketSegment: 'unknown' }), '');
  assert.equal(labMarketSegment(applications[3]), '');
});
test('Existing optical and clinic queues still work', () => {
  assert.deepEqual(ids('opticalEnquiries'), ['retail']);
  assert.deepEqual(ids('clinicEnquiries'), ['clinic']);
});
test('Unsegmented legacy markets are displayed honestly', () => {
  assert.equal(labMarketLabel(applications[0]), 'Kosovë dhe BE');
  assert.match(labMarketLabel({ division: 'lab' }), /Pa segment/);
  assert.match(labMarketLabel(applications[2]), /Evropian/);
});
test('Search spans organization, country and interest in one query', () => {
  assert.equal(submissionMatches(applications[2], 'Berlin DE dokumentacion'), true);
  assert.equal(submissionMatches(applications[2], 'Berlin XK dokumentacion'), false);
});
test('Country search supports Albanian and English labels and ISO codes', () => {
  for (const term of ['Gjermani', 'Germany', 'DE']) assert.equal(submissionMatches(applications[2], term), true);
  for (const term of ['Kosovë', 'Kosove', 'Kosovo', 'XK']) assert.equal(submissionMatches(applications[1], term), true);
});
test('Search supports all stored business and source metadata', () => {
  for (const term of ['distributor', 'documentation', '/laboratory/europe', 'eu', 'Ekipi Lab', 'alex@example.test', 'Optical Lab B2B']) {
    assert.equal(submissionMatches(applications[2], term), true, term);
  }
});
test('Albanian diacritics and punctuation do not hide a request', () => {
  assert.equal(submissionMatches(applications[1], 'Optikë / recetë'), true);
  assert.equal(submissionMatches(applications[1], 'optike recete'), true);
  assert.equal(submissionMatches(applications[1], ''), true);
});
test('Unknown country values do not crash the management screen', () => {
  assert.equal(submissionCountryLabel(''), 'Nuk është dhënë');
  assert.equal(submissionCountryLabel('not-a-code'), 'not-a-code');
});
test('Public intake enums have readable Albanian labels', () => {
  assert.deepEqual(Object.keys(labBusinessLabels), ['optical', 'clinic', 'distributor', 'other']);
  assert.deepEqual(Object.keys(labInterestLabels), ['prescription', 'mounting', 'documentation', 'partnership']);
});

const portal = readFileSync(new URL('../src/AdminPortal.jsx', import.meta.url), 'utf8');
test('Both market pages and documentation notes are CMS editable', () => {
  for (const key of ['labKosovoTitle', 'labKosovoSubtitle', 'labKosovoSeoTitle', 'labKosovoSeoDescription',
    'labEuropeTitle', 'labEuropeSubtitle', 'labEuropeSeoTitle', 'labEuropeSeoDescription',
    'labDocumentationNoteSq', 'labDocumentationNoteEn']) assert.ok(portal.includes(key), key);
});
test('Staff updates send only the changed property, preserving concurrent metadata', () => {
  for (const key of ['status', 'assignedTo', 'confirmedDate', 'confirmedTime', 'internalNote']) {
    assert.ok(portal.includes(`submission: { id: item.id, ${key}: e.target.value }`), key);
  }
  assert.equal(portal.includes('submission: { ...item,'), false);
});
test('B2B contact confirmation is explicitly not partner or certificate approval', () => {
  assert.ok(portal.includes('Kontakt i konfirmuar'));
  assert.ok(portal.includes('nuk miraton partneritetin, çmimet, dokumentacionin ose certifikimin'));
  assert.ok(portal.includes('["New", "Contacted", "Confirmed", "Completed", "Closed"]'));
});
