import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes, pbkdf2Sync } from 'node:crypto';

// Isolated localhost only. The server cannot send mail; no real accounts, orders,
// credentials, uploads or databases are read or modified by this runner.
const root = resolve('.');
// Fail before creating fixtures or making requests if a previous server owns
// this project's fixed port. A responding server is not proof of isolation.
await new Promise((resolveReady, reject) => {
  const probe = net.createServer();
  probe.once('error', () => reject(new Error('Port 4190 is already in use. Verify and stop the previous Optika QA server before running this test.')));
  probe.listen(4190, '127.0.0.1', () => probe.close(resolveReady));
});
const out = resolve(root, process.env.OPTIKA_QA_REPORT_DIR || 'output/qa/completion-pass');
const data = resolve(out, `run-${Date.now()}`);
assert.ok(data.startsWith(out + '\\') || data.startsWith(out + '/'));
await mkdir(data, { recursive: true });
const password = `Qa!${randomBytes(24).toString('hex')}`;
const adminPassword = `Qa!${randomBytes(24).toString('hex')}`;
const salt = randomBytes(18).toString('hex');
await writeFile(resolve(data, 'credentials.json'), JSON.stringify({ email: 'qa.admin@example.test', salt, hash: pbkdf2Sync(adminPassword, salt, 120000, 32, 'sha256').toString('hex'), iterations: 120000, updatedAt: new Date().toISOString() }));
const php = spawn(resolve(root, 'tmp/php-8.5.9/php.exe'), ['-d', 'disable_functions=mail', '-d', `extension=${resolve(root, 'tmp/php-8.5.9/ext/php_fileinfo.dll')}`, '-S', '127.0.0.1:4190', '-t', 'dist', 'tmp/qa/php_router.php'], { cwd: root, env: { ...process.env, OPTIKA_STORAGE_DIR: data }, stdio: 'ignore', windowsHide: true });
const results = [];
const check = (condition, name) => { results.push({ name, status: condition ? 'verified' : 'failed' }); console.log(`${condition ? 'PASS' : 'FAIL'} ${name}`); };
function client() {
  let cookie = '';
  const request = async (path, body, csrf = '', extraHeaders = {}) => new Promise((resolveResponse, reject) => {
    const content = Buffer.isBuffer(body) ? body : body ? JSON.stringify(body) : '';
    const req = http.request({ host: '127.0.0.1', port: 4190, path, method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(content) } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...extraHeaders } }, (res) => {
      if (res.headers['set-cookie']) cookie = res.headers['set-cookie'].map((value) => value.split(';')[0]).join('; ');
      let raw = ''; res.on('data', (chunk) => raw += chunk); res.on('end', () => { try { resolveResponse({ status: res.statusCode, body: JSON.parse(raw) }); } catch { reject(new Error(`Invalid JSON from ${path} (${res.statusCode})`)); } });
    }); req.on('error', reject); req.end(content);
  });
  request.sessionCookie = () => cookie;
  return request;
}
const anon = client(), admin = client(), alice = client(), bob = client();
const index = '/api/index.php', account = '/api/account.php', submit = '/api/submit.php';
try {
  for (let attempt = 0; attempt < 50; attempt++) { try { await anon(index + '?resource=public'); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  check((await anon(index + '?resource=snapshot')).status === 401, 'Anonymous CMS access denied');
  check((await anon(account + '?resource=profile')).status === 401, 'Anonymous profile access denied');
  const login = await admin(index, { action: 'login', email: 'qa.admin@example.test', password: adminPassword });
  check(login.body.authenticated, 'Admin sign-in');
  const csrf = login.body.csrf;
  check((await admin(index, { action: 'save_product', product: { name: 'Should not save' } })).status === 403, 'CMS mutations require CSRF');
  const product = { id: 'qa-completion-frame', sku: 'QA-COMPLETION', name: 'Isolated QA frame', type: 'Sunglasses', price: 125, stock: 2, status: 'Draft', prescriptionReady: false, image: '/assets/products/vortex-x1-studio.webp' };
  check((await admin(index, { action: 'save_product', product }, csrf)).body.ok, 'CMS saves draft product');
  check(!(await anon(index + '?resource=public')).body.products.some((p) => p.id === product.id), 'Draft excluded from storefront');
  await admin(index, { action: 'save_product', product: { ...product, status: 'Published' } }, csrf);
  check((await anon(index + '?resource=public')).body.products.some((p) => p.id === product.id), 'Published product appears in storefront');
  await admin(index, { action: 'save_content', content: { shopTitle: 'Isolated QA catalogue' } }, csrf);
  check((await anon(index + '?resource=public')).body.content.shopTitle === 'Isolated QA catalogue', 'CMS copy persists to public API');
  const groupFields = { groupTitle: 'Grupi QA', labTitle: 'Lab QA', clinicTitle: 'Klinika QA', partnersTitle: 'Partnerët QA' };
  await admin(index, { action: 'save_content', content: groupFields }, csrf);
  const groupPublished = (await anon(index + '?resource=public')).body.content;
  check(Object.entries(groupFields).every(([key, value]) => groupPublished[key] === value), 'All four group CMS pages persist to public API');
  for (const [key, image] of Object.entries({groupHeroImage: 'miftari-generations-campaign', groupSunImage: 'miftari-sun-campaign', groupCraftImage: 'miftari-craft-campaign'})) {
    const imagePath = `/assets/brand/${image}.webp`;
    check((await admin(index, { action: 'save_content', content: { [key]: imagePath } }, csrf)).body.ok, `${key}: CMS save succeeds`);
    check((await anon(index + '?resource=public')).body.content[key] === imagePath, `${key}: saved image reaches storefront`);
    check((await admin(index, { action: 'save_content', content: { [key]: 'https://external.example.test/image.jpg' } }, csrf)).status === 422, `${key}: remote image rejected`);
    await admin(index, { action: 'save_content', content: { [key]: '' } }, csrf);
  }
  await admin(index, { action: 'save_content', content: { aboutSubtitle: 'Mbi 20 vjet përvojë. Teksti i klientit ruhet.' } }, csrf);
  check((await anon(index + '?resource=public')).body.content.aboutSubtitle === '30 vjet përvojë. Teksti i klientit ruhet.', 'Legacy CMS heritage corrected without losing client copy');
  await admin(index, { action: 'save_content', content: { aboutSubtitle: '30 vjet përvojë, dy lokacione dhe një laborator privat.' } }, csrf);
  await admin(index, { action: 'save_content', content: (await import('../src/holdingContent.js')).holdingDefaults }, csrf);
  check((await admin(index, { action: 'save_content', content: { clinicImage: '/assets/brand/miftari-clinic-2026.webp' } }, csrf)).body.ok, 'Clinic image independently editable in CMS');
  check((await admin(index, { action: 'save_content', content: { clinicImage: 'https://external.example.test/tracker.jpg' } }, csrf)).status === 422, 'Clinic CMS image rejects external tracking URL');
  await admin(index, { action: 'save_content', content: { clinicImage: '' } }, csrf);
  const campaignImage = '/assets/brand/optika-examination-2026.webp';
  check((await admin(index, { action: 'save_content', content: { examinationImage: campaignImage } }, csrf)).body.ok, 'CMS accepts an existing local campaign image');
  check((await anon(index + '?resource=public')).body.content.examinationImage === campaignImage, 'CMS image reaches storefront API');
  for (const unsafe of ['https://external.example.test/tracker.jpg', '/assets/../api/index.php', '/uploads/not-present.png']) {
    check((await admin(index, { action: 'save_content', content: { examinationImage: unsafe } }, csrf)).status === 422, 'CMS rejects unsafe or missing image: ' + unsafe);
  }
  await admin(index, { action: 'save_content', content: { examinationImage: '' } }, csrf);
  check((await anon(index + '?resource=public')).body.content.examinationImage === '', 'CMS can restore default campaign image');
  const boundary = 'OptikaLocalImageTest';
  const imageBytes = await readFile(resolve(root, 'public/assets/brand/optika-examination-2026-small.webp'));
  const multipart = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="qa-campaign.webp"\r\nContent-Type: image/webp\r\n\r\n`), imageBytes, Buffer.from(`\r\n--${boundary}--\r\n`)]);
  const imageHeaders = { 'Content-Type': `multipart/form-data; boundary=${boundary}` };
  check((await anon('/api/upload.php', multipart, '', imageHeaders)).status === 401, 'Image upload requires staff authentication');
  check((await admin('/api/upload.php', multipart, '', imageHeaders)).status === 403, 'Image upload requires CSRF');
  const upload = await admin('/api/upload.php', multipart, csrf, imageHeaders);
  check(upload.status === 201 && upload.body.url?.startsWith('/uploads/products/'), 'Authenticated CMS image upload succeeds');
  if (upload.body.url) {
    const uploadedFile = resolve(root, 'dist' + upload.body.url);
    check((await readFile(uploadedFile)).equals(imageBytes), 'Uploaded image persists exactly');
    await admin(index, { action: 'save_content', content: { examinationImage: upload.body.url } }, csrf);
    check((await anon(index + '?resource=public')).body.content.examinationImage === upload.body.url, 'Uploaded media can be published to an individual page');
    await admin(index, { action: 'save_content', content: { examinationImage: '' } }, csrf);
    await rename(uploadedFile, resolve(data, 'verified-upload.webp'));
  }
  const register = (email) => ({ action: 'register', firstName: 'Synthetic', lastName: 'QA', email, phone: '+000000000', password, termsAccepted: true, marketingConsent: false });
  const a = await alice(account, register('qa.alice@example.test'));
  const b = await bob(account, register('qa.bob@example.test'));
  check(a.body.authenticated && b.body.authenticated, 'Two isolated customer registrations');
  check((await alice(index + '?resource=snapshot')).status === 401, 'Customer cannot access CMS');
  check((await alice(account, { action: 'update_profile', firstName: 'Wrong' })).status === 403, 'Customer profile mutations require CSRF');
  await alice(account, { action: 'update_profile', firstName: 'Synthetic', lastName: 'QA', phone: '+000000000', address: 'Local test only', city: 'QA', postcode: '00000', country: 'Kosovë', contactPreference: 'Email', marketingConsent: false }, a.body.csrf);
  check((await alice(account + '?resource=profile')).body.profile.address === 'Local test only', 'Customer address persists');
  const order = { type: 'order', orderId: 'OM-QA-COMPLETION', name: 'Synthetic QA', phone: '+000000000', email: 'qa.alice@example.test', items: [{ productId: product.id, quantity: 1, unitPrice: 1, configuration: { purchaseMode: 'ready' } }], total: 1, shippingKey: 'pickup', deliveryAddress: 'Local test only' };
  const placed = await alice(submit, order);
  check(placed.body.accepted && placed.body.order.total === 125, 'Order stored with server price, not browser price');
  const recordedOrder = (await admin(index + '?resource=snapshot')).body.orders.find((o) => o.id === order.orderId);
  check(recordedOrder.notificationStatus.customer === 'Unavailable' && recordedOrder.notificationStatus.staff === 'Unavailable', 'QA mail disabled and reported honestly');
  const retry = await alice(submit, order);
  check(retry.body.duplicate && retry.body.orderId === order.orderId, 'Retry returns the same order');
  check((await anon(index + '?resource=public')).body.products.find((p) => p.id === product.id).stock === 1, 'Retry does not reserve stock twice');
  check((await bob(submit, { ...order, email: 'qa.bob@example.test' })).status === 409, 'Another customer cannot reuse an order reference');
  check((await alice(submit, { ...order, orderId: 'OM-QA-OVERSTOCK', items: [{ productId: product.id, quantity: 2 }] })).status === 409, 'Insufficient stock rejected');
  check((await alice(account + '?resource=profile')).body.orders.length === 1, 'Customer sees own order');
  check((await bob(account + '?resource=profile')).body.orders.length === 0, 'Customer cannot see another customer order');
  const snapshot = await admin(index + '?resource=snapshot');
  check(snapshot.body.orders.some((o) => o.id === order.orderId), 'New order reaches admin dashboard');
  await admin(index, { action: 'update_order', order: { id: order.orderId, status: 'Confirmed', staffNote: 'PRIVATE QA STAFF NOTE' } }, csrf);
  const afterUpdate = await alice(account + '?resource=profile');
  check(afterUpdate.body.orders[0].status === 'Confirmed', 'Admin order status reaches customer');
  check(!JSON.stringify(afterUpdate.body).includes('PRIVATE QA STAFF NOTE'), 'Staff note excluded from customer response');
  check((await admin(index + '?resource=snapshot')).body.orders.find((o) => o.id === order.orderId).staffNote === 'PRIVATE QA STAFF NOTE', 'Staff note retained in CMS');
  check(!JSON.stringify((await alice(submit, order)).body).includes('PRIVATE QA STAFF NOTE'), 'Retry response also excludes staff notes');
  const appointment = await alice(submit, { type: 'appointment', name: 'Synthetic QA', phone: '+000000000', email: 'qa.alice@example.test', service: 'Local test', preferredDate: '2026-10-01', preferredTime: '11:00' });
  check(appointment.body.accepted, 'Appointment request persists');
  const withAppointment = await admin(index + '?resource=snapshot');
  const appt = withAppointment.body.submissions.find((s) => s.type === 'appointment');
  await admin(index, { action: 'update_submission', submission: { id: appt.id, status: 'Confirmed', confirmedDate: '2026-10-02', confirmedTime: '12:00', internalNote: 'PRIVATE QA APPOINTMENT NOTE', assignedTo: 'Private QA staff' } }, csrf);
  const customerAppts = (await alice(account + '?resource=profile')).body;
  check(customerAppts.appointments[0].confirmedDate === '2026-10-02', 'Appointment confirmation reaches customer');
  check(!JSON.stringify(customerAppts).includes('PRIVATE QA APPOINTMENT NOTE') && !JSON.stringify(customerAppts).includes('Private QA staff'), 'Internal appointment fields excluded');
  await anon(submit, { type: 'appointment', name: 'Guest QA', phone: '+000000000', email: 'qa.bob@example.test', service: 'Unverified email appointment' });
  check((await bob(account + '?resource=profile')).body.appointments.length === 0, 'Unverified email does not claim guest appointment');
  await admin(index, { action: 'update_order', order: { id: order.orderId, status: 'Cancelled' } }, csrf);
  check((await anon(index + '?resource=public')).body.products.find((p) => p.id === product.id).stock === 2, 'Cancellation releases reserved stock');
  await admin(index, { action: 'update_order', order: { id: order.orderId, status: 'Cancelled' } }, csrf);
  check((await anon(index + '?resource=public')).body.products.find((p) => p.id === product.id).stock === 2, 'Repeated cancellation does not increase stock twice');
  check((await admin(index + '?resource=snapshot')).body.audit.length > 0, 'Operational mutations have audit records');
  await alice(account, { action: 'logout' }, a.body.csrf);
  check((await alice(account + '?resource=profile')).status === 401, 'Customer logout revokes session');
  check((await alice(account, { action: 'login', email: 'qa.alice@example.test', password })).body.authenticated, 'Customer can sign back in');
  check((await alice(account + '?resource=profile')).body.orders[0].status === 'Cancelled', 'Order survives sign-out and sign-in');
  const clinicRequest = { type: 'enquiry', division: 'clinic', name: 'Synthetic Clinic QA', phone: '+000000000', service: 'Konsultë me specialistin e syve', consent: true };
  check((await anon(submit, { ...clinicRequest, consent: false })).status === 422, 'Clinic contact consent enforced on server');
  check((await anon(submit, { ...clinicRequest, division: 'admin' })).status === 422, 'Unknown division rejected');
  check((await anon(submit, { ...clinicRequest, service: 'Unexpected medical free text' })).status === 422, 'Clinic accepts only defined enquiry topics');
  const clinicResult = await anon(submit, { ...clinicRequest, message: 'MUST NOT STORE medical free text' });
  check(clinicResult.body.accepted && clinicResult.body.id, 'Clinic enquiry accepted with reference');
  const labRequest = { type: 'enquiry', division: 'lab', name: 'Synthetic Lab QA', phone: '+000000000', service: 'Bashkëpunim për lente me recetë', consent: true, organization: 'QA Optics', market: 'Kosovë' };
  check((await anon(submit, { ...labRequest, organization: '' })).status === 422, 'Lab requires company and market');
  const labResult = await anon(submit, labRequest);
  check(labResult.body.accepted, 'Lab B2B enquiry accepted');
  const inbox = (await admin(index + '?resource=snapshot')).body.submissions;
  const clinicRecord = inbox.find(item => item.id === clinicResult.body.id);
  const labRecord = inbox.find(item => item.id === labResult.body.id);
  check(clinicRecord?.division === 'clinic' && clinicRecord.contactConsentAt && clinicRecord.message === '', 'Clinic inbox stores routing and consent but not medical free text');
  check(labRecord?.division === 'lab' && labRecord.organization === 'QA Optics' && labRecord.market === 'Kosovë', 'Lab inbox retains company and market');
  check(!(await anon(index + '?resource=public')).body.submissions, 'Group enquiries never appear in public catalogue API');
  await admin(index, { action: 'logout' }, csrf);
  check((await admin(index + '?resource=snapshot')).status === 401, 'Admin logout revokes session');
  if (process.env.OPTIKA_QA_KEEP_SERVER === '1') {
    const uiAdmin = await admin(index, { action: 'login', email: 'qa.admin@example.test', password: adminPassword });
    const second = await alice(submit, { ...order, orderId: 'OM-QA-ACTIVE', items: [{ productId: product.id, quantity: 1, configuration: { purchaseMode: 'ready' } }] });
    check(second.body.accepted, 'UI fixture has a second active order');
    check((await admin(index, { action: 'update_order', order: { id: 'OM-QA-ACTIVE', status: 'In lab' } }, uiAdmin.body.csrf)).body.ok, 'UI fixture is in laboratory queue');
    // Ephemeral localhost-only sessions, excluded from every release. No passwords saved.
    await writeFile(resolve(out, 'local-ui-sessions.json'), JSON.stringify({ origin: 'http://127.0.0.1:4190', customer: alice.sessionCookie(), admin: admin.sessionCookie() }));
  }
  await writeFile(resolve(out, 'workflow-checks.json'), JSON.stringify({ testedAt: new Date().toISOString(), environment: 'Isolated localhost PHP, mail disabled', results }, null, 2));
  process.exitCode = results.some((r) => r.status === 'failed') ? 1 : 0;
} finally {
  if (process.env.OPTIKA_QA_KEEP_SERVER !== '1' || results.some((r) => r.status === 'failed')) php.kill();
  else console.log('Isolated QA server remains on port 4190 for browser checks. Mail disabled.');
}
