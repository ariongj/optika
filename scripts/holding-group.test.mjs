import test from 'node:test';
import assert from 'node:assert/strict';
import { holdingDefaults, groupRoutes, divisionName, enquiryError } from '../src/holdingContent.js';
import { queueItems } from '../src/servicePresentation.js';
import { editorialMedia } from '../src/editorialMedia.js';
import { existsSync, readFileSync } from 'node:fs';

test('Every new division has a unique public route', () => {
  assert.deepEqual(Object.keys(groupRoutes), ['home','optical','clinic','partners','labKosovo','labEurope']);
  assert.equal(new Set(Object.values(groupRoutes)).size, 6);
});
test('New content fields have matching server allowlist defaults', () => {
  const server = readFileSync('public/api/holding-content.php', 'utf8');
  for (const key of Object.keys(holdingDefaults)) assert.ok(server.includes(`'${key}' =>`), key);
});
test('Each division has separate CMS-editable artwork', () => {
  const images = ['groupOpticalImage','groupLabImage','clinicImage'].map(key => editorialMedia[key][1]);
  assert.equal(new Set(images).size, 3);
  for (const path of images) assert.ok(existsSync('public' + path), path);
});
test('Inbox division filtering retains older optical submissions', () => {
  const items = [{id:'old'}, {id:'optical',division:'optical'}, {id:'lab',division:'lab'}, {id:'clinic',division:'clinic'}];
  assert.deepEqual(queueItems(items,'opticalEnquiries','Contacts').map(x=>x.id), ['old','optical']);
  assert.deepEqual(queueItems(items,'labEnquiries','Contacts').map(x=>x.id), ['lab']);
  assert.deepEqual(queueItems(items,'clinicEnquiries','Contacts').map(x=>x.id), ['clinic']);
  assert.equal(queueItems(items,'','Appointments').length, 4);
});
test('Unknown display divisions remain backward compatible', () => {
  assert.equal(divisionName(undefined), 'Optical');
  assert.equal(divisionName('clinic'), 'Klinika Miftari');
});
test('Failure copy is not a false submission confirmation', () => {
  assert.match(enquiryError('unknown'), /Nuk morëm konfirmim/);
  assert.match(enquiryError('invalid_email'), /email/);
});
