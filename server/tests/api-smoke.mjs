// API smoke test against a FRESH local install (empty data folder), e.g. the PHP built-in server with
// server/dev/router.php. Exercises first setup, import, the public snapshot, staff roles, sync/merge, the change feed,
// invites, lockout, 2-step codes, sessions, visitor forms, consent + unsubscribe, uploads and abuse checks.
//   node server/tests/seed-export.mjs            (once: writes server/tests/.cache/seed.json)
//   node server/tests/api-smoke.mjs http://127.0.0.1:8090 <path to the data folder>
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import zlib from 'node:zlib';

/** Minimal fetch() over node:http (undici trips over the PHP built-in server's connection handling). */
async function hfetch(url, { method = 'GET', headers = {}, body } = {}) {
  let buf = null;
  const h = { ...headers };
  if (body instanceof FormData) {
    const rr = new Response(body);
    buf = Buffer.from(await rr.arrayBuffer());
    h['Content-Type'] = rr.headers.get('content-type');
  } else if (typeof body === 'string') buf = Buffer.from(body);
  if (buf) h['Content-Length'] = String(buf.length);
  h['Accept-Encoding'] = h['Accept-Encoding'] ?? 'gzip';
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers: h }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        let data = Buffer.concat(chunks);
        if (/gzip/.test(res.headers['content-encoding'] ?? '')) data = zlib.gunzipSync(data);
        const hs = new Headers();
        for (const [k, v] of Object.entries(res.headers)) for (const x of [].concat(v)) hs.append(k, x);
        resolve({ status: res.statusCode, headers: hs, text: async () => data.toString('utf8') });
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    if (buf) req.write(buf);
    req.end();
  });
}

const BASE = (process.argv[2] ?? 'http://127.0.0.1:8090').replace(/\/+$/, '');
const DATA = process.argv[3];
if (!DATA) throw new Error('usage: api-smoke.mjs <base url> <data folder>');
const seed = JSON.parse(fs.readFileSync(path.join('server', 'tests', '.cache', 'seed.json'), 'utf8'));

let pass = 0;
let fail = 0;
const ok = (cond, label, extra) => {
  if (cond) pass++;
  else {
    fail++;
    console.log('FAIL', label, extra === undefined ? '' : JSON.stringify(extra).slice(0, 400));
  }
};

/** A browser-like client: cookie jar + CSRF token. */
function client(name) {
  const jar = new Map();
  const c = {
    name,
    csrf: '',
    async req(method, route, body, { headers = {}, raw = false } = {}) {
      const h = { ...headers };
      if (jar.size) h.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
      if (c.csrf && method !== 'GET') h['X-MV-CSRF'] = c.csrf;
      let payload;
      if (body instanceof FormData) payload = body;
      else if (body !== undefined) {
        h['Content-Type'] = 'application/json';
        payload = JSON.stringify(body);
      }
      const r = await hfetch(`${BASE}/api/${route}`, { method, headers: h, body: payload });
      for (const sc of r.headers.getSetCookie()) {
        const [pair] = sc.split(';');
        const i = pair.indexOf('=');
        const k = pair.slice(0, i).trim();
        const v = pair.slice(i + 1).trim();
        if (v === '' || /expires=Thu, 01 Jan 1970|max-age=0/i.test(sc) || /expires=[^;]*19\d\d/i.test(sc)) jar.delete(k);
        else jar.set(k, v);
      }
      const text = await r.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* html / csv */
      }
      if (json?.csrf) c.csrf = json.csrf;
      return raw ? { status: r.status, headers: r.headers, text, json } : { status: r.status, ...(json ?? { text }) };
    },
    get: (route, opts) => c.req('GET', route, undefined, opts),
    post: (route, body, opts) => c.req('POST', route, body ?? {}, opts),
    cookies: () => [...jar.keys()],
  };
  return c;
}

/** RFC 6238 code for a base32 secret. */
function totp(secret, offset = 0) {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const ch of secret.replace(/=+$/, '')) bits += abc.indexOf(ch).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const step = Math.floor(Date.now() / 30000) + offset;
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac('sha1', key).update(msg).digest();
  const o = h[h.length - 1] & 15;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, '0');
}

const owner = client('owner');
const PASS = 'Kalem-Syze-7421!';

/* ---------- health & first setup ---------- */
const health = await owner.get('health');
ok(health.ok && health.sqlite, 'health', health);
let st = await owner.get('auth/status');
ok(st.setup === true, 'setup needed on a fresh install', st);
const codeFile = path.join(DATA, 'SETUP-CODE.txt');
ok(fs.existsSync(codeFile), 'SETUP-CODE.txt written');
const code = fs.readFileSync(codeFile, 'utf8').split('\n')[0].trim();
let r = await owner.post('auth/setup', { code: 'WRONG-CODE-0000', name: 'Pronari', email: 'owner@example.test', password: PASS });
ok(r.status === 401 && r.error === 'code_bad', 'setup rejects a wrong code', r);
r = await owner.post('auth/setup', { code, name: 'Pronari', email: 'owner@example.test', password: 'short' });
ok(r.status === 422 && r.error === 'password_short', 'setup rejects a short password', r);
r = await owner.post('auth/setup', { code, name: 'Pronari', email: 'owner@example.test', password: PASS });
ok(r.ok && r.user?.role === 'owner' && owner.csrf, 'setup creates the owner', r);
ok(!fs.existsSync(codeFile), 'setup code file deleted');
ok(owner.cookies().includes('mv_sid'), 'session cookie set (http → mv_sid)', owner.cookies());
r = await client('x').post('auth/setup', { code, name: 'X', email: 'x@example.test', password: PASS });
ok(r.status === 409 || r.status === 401, 'second setup refused', r);
st = await owner.get('auth/status');
ok(st.setup === false && st.recovery === false, 'status after setup', st);

/* ---------- CSRF & origin ---------- */
const csrf = owner.csrf;
owner.csrf = '';
r = await owner.post('admin/sync', { ops: [] });
ok(r.status === 403 && r.error === 'csrf', 'staff write without CSRF header refused', r);
owner.csrf = 'nope';
r = await owner.post('admin/sync', { ops: [] });
ok(r.status === 403 && r.error === 'csrf', 'wrong CSRF refused', r);
owner.csrf = csrf;
r = await owner.post('admin/sync', { ops: [] }, { headers: { Origin: 'https://evil.example' } });
ok(r.status === 403 && r.error === 'cross_site', 'cross-site Origin refused', r);
r = await owner.post('admin/sync', { ops: [] }, { headers: { 'Sec-Fetch-Site': 'cross-site' } });
ok(r.status === 403 && r.error === 'cross_site', 'Sec-Fetch-Site cross-site refused', r);
r = await owner.req('POST', 'subscribe', undefined, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
ok(r.status === 415, 'form-encoded POST refused (JSON only)', r);

/* ---------- import ---------- */
r = await client('anon').get('admin/snapshot');
ok(r.status === 401, 'snapshot needs sign-in', r);
r = await owner.post('admin/import', { mode: 'init', lists: seed.lists, singles: seed.singles });
ok(r.ok && r.count > 1000, 'import init', r);
r = await owner.post('admin/import', { mode: 'init', lists: seed.lists, singles: seed.singles });
ok(r.status === 409 && r.error === 'not_empty', 'second init refused', r);

/* ---------- public snapshot ---------- */
const anon = client('anon');
const pubRaw = await anon.req('GET', 'public', undefined, { raw: true });
const pub = pubRaw.json;
ok(pubRaw.status === 200 && pub.ready, 'public snapshot', pubRaw.status);
const etag = pubRaw.headers.get('etag');
ok(!!etag, 'public has an ETag');
const p304 = await anon.req('GET', 'public', undefined, { raw: true, headers: { 'If-None-Match': etag } });
ok(p304.status === 304, 'public 304 on same ETag', p304.status);
ok(pub.products.length === seed.lists.products.filter((p) => p.status === 'active').length, 'only active products public');
ok(pub.products.every((p) => !('cost' in p) && !('barcode' in p)), 'no cost/barcode in public products');
ok(!('adminEmail' in pub.settings) && !('integrations' in pub.settings), 'private settings stripped');
ok(!('orders' in pub) && !('inquiries' in pub) && !('audit' in pub), 'no orders/inquiries/audit in public');
ok(pub.bookings.every((b) => b.customerName === '' && b.phone === '' && !('email' in b)), 'bookings redacted');
ok(pub.staff.every((m) => m.email === ''), 'staff e-mails hidden');
const codeDiscounts = seed.lists.discounts.filter((d) => d.method === 'code' && d.status !== 'draft');
const advertised = new Set(seed.lists.offers.filter((o) => o.status !== 'draft' && o.discountId).map((o) => o.discountId));
ok(pub.discounts.filter((d) => d.method === 'code').every((d) => advertised.has(d.id)), 'only advertised codes public', pub.discounts.map((d) => d.code));
ok(JSON.stringify(pub).indexOf('owner@example.test') < 0, 'owner e-mail not in public data');

/* ---------- staff snapshot & sync ---------- */
const snap = await owner.get('admin/snapshot');
ok(snap.ok && snap.lists.products.length === seed.lists.products.length, 'owner snapshot has every product');
ok(snap.lists.products.some(([, , , p]) => 'cost' in p), 'owner sees cost');
const [pid, prev, ppos, pdoc] = snap.lists.products[0];
const edited = { ...pdoc, name: { ...pdoc.name, en: 'Test name EN' } };
r = await owner.post('admin/sync', { ops: [{ col: 'products', id: pid, base: prev, prev: pdoc, data: edited, pos: ppos }] });
ok(r.ok && r.results[0].status === 'ok', 'sync edit ok', r);
const rev1 = r.results[0].rev;
// a second editor working from the old version changes another field → merged, both edits kept
const edited2 = { ...pdoc, featured: !pdoc.featured };
r = await owner.post('admin/sync', { ops: [{ col: 'products', id: pid, base: prev, prev: pdoc, data: edited2 }] });
ok(r.results[0].status === 'merged' && r.results[0].data.name.en === 'Test name EN' && r.results[0].data.featured === !pdoc.featured, 'three-way merge keeps both edits', r.results[0]);
// both changed the same field → clash reported, last writer wins
r = await owner.post('admin/sync', { ops: [{ col: 'products', id: pid, base: prev, prev: pdoc, data: { ...pdoc, name: { ...pdoc.name, en: 'Clash' } } }] });
ok(r.results[0].status === 'merged' && (r.results[0].clash ?? []).includes('name'), 'clash reported', r.results[0]);
r = await owner.post('admin/sync', { ops: [{ col: 'nope', id: 'x', base: 0, data: { id: 'x' } }, { col: '$', id: 'nope', base: 0, data: 1 }] });
ok(r.results[0].reason === 'unknown_collection' && r.results[1].reason === 'unknown_single', 'unknown targets rejected', r);
// empty objects survive the round trip ({} stays {}, [] stays [])
{
  const cur = (await owner.get('admin/snapshot')).lists.products.find(([id]) => id === pid);
  r = await owner.post('admin/sync', { ops: [{ col: 'products', id: pid, base: cur[1], prev: cur[3], data: { ...cur[3], extraObj: {}, extraList: [] } }] });
  const back = (await owner.get('admin/snapshot')).lists.products.find(([id]) => id === pid)[3];
  ok(r.results[0].status === 'ok' && JSON.stringify(back.extraObj) === '{}' && JSON.stringify(back.extraList) === '[]', 'empty object / list round trip', { extraObj: back.extraObj, extraList: back.extraList });
}
const ch = await owner.get(`admin/changes?since=${snap.rev}`);
ok(ch.ok && ch.docs.some((d) => d[0] === 'products' && d[1] === pid) && ch.rev >= rev1, 'change feed lists the edit', ch);
// audit log is append-only
const aud = snap.lists.audit[0];
r = await owner.post('admin/sync', { ops: [{ col: 'audit', id: aud[0], base: aud[1], data: { ...aud[3], detail: 'rewritten' } }, { col: 'audit', id: aud[0], base: aud[1], data: null }] });
ok(r.results.every((x) => x.status === 'ignored'), 'audit entries cannot be edited or deleted', r);
r = await owner.post('admin/sync', { ops: [{ col: 'audit', id: 'aud_test1', base: 0, data: { id: 'aud_test1', at: new Date().toISOString(), actor: 'x', action: 'update', object: 'product', objectId: pid, detail: 't' } }] });
ok(r.results[0].status === 'ok', 'audit entry can be added', r);

/* ---------- staff accounts: invite → accept → role limits ---------- */
r = await owner.post('admin/users', { name: 'Arta Porosi', email: 'orders@example.test', role: 'orders' });
ok(r.ok && r.link?.token, 'invite created', r);
const invite = r.link.token;
const orders = client('orders');
r = await orders.post('auth/link-info', { token: invite });
ok(r.ok && r.kind === 'invite' && r.email === 'orders@example.test', 'invite link info', r);
r = await orders.post('auth/link-accept', { token: invite, password: 'orders' });
ok(r.status === 422, 'weak password refused on invite', r);
r = await orders.post('auth/link-accept', { token: invite, password: 'Porosi-Te-Reja-55' });
ok(r.ok && r.signedIn && r.user.role === 'orders', 'invite accepted and signed in', r);
r = await client('y').post('auth/link-info', { token: invite });
ok(r.status === 404, 'invite link single-use', r);
const osnap = await orders.get('admin/snapshot');
ok(osnap.ok && osnap.lists.products.every(([, , , p]) => !('cost' in p)), 'orders role does not see cost');
const [opid, orev, , odoc] = osnap.lists.products.find(([, , , p]) => typeof p.stock === 'number' && p.stock > 2 && p.stock < 900);
r = await orders.post('admin/sync', { ops: [{ col: 'products', id: opid, base: orev, prev: odoc, data: { ...odoc, name: { ...odoc.name, en: 'Hacked' } } }] });
ok(r.results[0].status === 'rejected' && r.results[0].reason === 'forbidden', 'orders role cannot rename a product', r.results[0]);
r = await orders.post('admin/sync', { ops: [{ col: 'products', id: opid, base: orev, prev: odoc, data: { ...odoc, stock: odoc.stock - 1 } }] });
ok(r.results[0].status === 'ok' && !('data' in r.results[0]), 'orders role can change stock (side effect), no cost sent back', r.results[0]);
const after = (await owner.get('admin/snapshot')).lists.products.find(([id]) => id === opid)[3];
ok('cost' in after || !('cost' in seed.lists.products.find((p) => p.id === opid)), 'cost kept after a cost-blind edit', after.cost);
const s0 = (await owner.get('admin/snapshot')).singles.settings;
r = await orders.post('admin/sync', { ops: [{ col: '$', id: 'settings', base: s0[0], prev: s0[1], data: { ...s0[1], companyName: 'X' } }] });
ok(r.results[0].status === 'rejected', 'orders role cannot change settings', r.results[0]);
r = await orders.post('admin/import', { mode: 'replace', confirm: 'REPLACE', lists: {}, singles: {} });
ok(r.status === 403, 'only the owner imports', r);
r = await orders.get('admin/users');
ok(r.status === 403, 'only the owner lists accounts', r);
r = await orders.get('admin/export');
ok(r.status === 403, 'only the owner exports', r);

/* ---------- lockout ---------- */
const bad = client('bad');
for (let i = 0; i < 5; i++) r = await bad.post('auth/login', { email: 'orders@example.test', password: `wrong-${i}-password` });
r = await bad.post('auth/login', { email: 'orders@example.test', password: 'Porosi-Te-Reja-55' });
ok(r.status === 423 && r.error === 'locked', 'locked after 5 wrong passwords (even with the right one)', r);
r = await bad.post('auth/login', { email: 'nobody@example.test', password: 'whatever-123' });
ok(r.status === 401 && r.error === 'bad_credentials', 'unknown e-mail: same answer as wrong password', r);
const users = await owner.get('admin/users');
const ou = users.users.find((u) => u.email === 'orders@example.test');
ok(ou.locked === true, 'owner sees the lock', ou);
r = await owner.post('admin/users/update', { id: ou.id, unlock: true });
ok(r.ok && r.user.locked === false, 'owner unlocks', r);
r = await bad.post('auth/login', { email: 'ORDERS@example.test', password: 'Porosi-Te-Reja-55' });
ok(r.ok && r.user.role === 'orders', 'sign-in after unlock (e-mail case-insensitive)', r);

/* ---------- sessions ---------- */
let ses = await orders.get('admin/sessions');
ok(ses.ok && ses.sessions.length === 2, 'two sessions for the orders user', ses);
const other = ses.sessions.find((s) => !s.current);
r = await orders.post('admin/sessions/revoke', { id: other.id });
ok(r.ok, 'revoke the other session', r);
r = await bad.get('auth/me');
ok(r.status === 401, 'revoked session is signed out', r);
r = await owner.post('admin/users/update', { id: ou.id, active: false });
ok(r.ok && r.user.active === false, 'owner blocks the account', r);
r = await orders.get('auth/me');
ok(r.status === 401, 'blocked account is signed out at once', r);
r = await owner.post('admin/users/update', { id: users.users.find((u) => u.role === 'owner').id, role: 'manager' });
ok(r.status === 409 && r.error === 'last_owner', 'the last owner cannot be demoted', r);
const ev = await owner.get('admin/auth-events?limit=100');
ok(ev.ok && ['setup', 'login_failed', 'locked', 'invite_accepted', 'session_revoked', 'user_updated'].every((k) => ev.events.some((e) => e.kind === k)), 'login history has the events', ev.events?.map((e) => e.kind));

/* ---------- 2-step codes ---------- */
r = await owner.post('auth/totp/begin');
ok(r.ok && /^[A-Z2-7]{32}$/.test(r.secret) && r.uri.startsWith('otpauth://totp/'), 'totp begin', r);
const secret = r.secret;
r = await owner.post('auth/totp/enable', { code: '000000' === totp(secret) ? '111111' : '000000' });
ok(r.status === 422, 'wrong first code refused', r);
r = await owner.post('auth/totp/enable', { code: totp(secret) });
ok(r.ok, 'totp enabled', r);
const o2 = client('owner2');
r = await o2.post('auth/login', { email: 'owner@example.test', password: PASS });
ok(r.status === 401 && r.error === 'code_required', 'password alone not enough with 2-step on', r);
r = await o2.post('auth/login', { email: 'owner@example.test', password: PASS, code: totp(secret) });
ok(r.status === 401 && r.error === 'code_bad', 'same code cannot be used twice', r);
r = await o2.post('auth/login', { email: 'owner@example.test', password: PASS, code: totp(secret, 1) });
ok(r.ok, 'next code accepted (±1 step)', r);
r = await owner.post('auth/password', { current: 'wrong', password: 'Nje-Fjalekalim-I-Ri-9' });
ok(r.status === 401, 'password change needs the current one', r);
r = await owner.post('auth/password', { current: PASS, password: 'Nje-Fjale-Tjeter-9x' });
ok(r.ok, 'password changed', r);
r = await o2.get('auth/me');
ok(r.status === 401, 'other sessions signed out after a password change', r);
r = await owner.get('auth/me');
ok(r.ok, 'this session stays signed in', r);

/* ---------- visitors: forms, bookings, consent ---------- */
const visitor = client('visitor');
r = await visitor.post('inquiry', { input: { type: 'contact', name: 'Besa Test', phone: '044 123 456', email: 'besa@example.test', message: 'Përshëndetje' } });
ok(r.ok && r.inquiry?.id && r.inquiry.status === 'new', 'contact request saved', r);
r = await visitor.post('inquiry', { input: { type: 'contact', name: '', phone: '044 123 456', message: 'x' } });
ok(r.status === 422 && r.error === 'name_required', 'contact request needs a name', r);
r = await visitor.post('inquiry', { input: { type: 'contact', name: 'Bot', phone: '044 123 456', message: 'x' }, website: 'http://spam' });
ok(r.ok && r.inquiry === null, 'bot trap: answered ok, not saved', r);
const svc = seed.lists.services.find((s) => (s.staffIds ?? []).length && s.durationMin > 0);
const start = new Date(Date.now() + 9 * 86400000);
start.setUTCHours(8, 0, 0, 0);
const bookingBody = (who) => ({
  inquiry: { type: 'measurement', name: who, phone: '049 555 111', email: 'b@example.test', message: 'Kontroll' },
  booking: { serviceId: svc.id, staffId: svc.staffIds[0], start: start.toISOString(), location: 'onsite' },
});
r = await visitor.post('booking', bookingBody('Driton Test'));
ok(r.ok && r.booking?.status === 'pending' && r.inquiry?.id === r.booking.inquiryId, 'booking saved with its request', r);
r = await visitor.post('booking', bookingBody('Second'));
ok(r.status === 409 && r.error === 'taken', 'same slot twice refused', r);
const pub2 = await anon.get('public');
ok(pub2.bookings.some((b) => b.start === start.toISOString() && b.customerName === ''), 'new booking visible as taken, without name');
r = await visitor.post('booking', { ...bookingBody('Past'), booking: { ...bookingBody('x').booking, start: '2020-01-01T10:00:00Z' } });
ok(r.status === 422 && r.error === 'time_invalid', 'past booking refused', r);

r = await visitor.post('subscribe', { email: 'Lajme@Example.test', lang: 'sq', wording: 'Dua lajme' });
ok(r.ok, 'newsletter sign-up', r);
let subs = await owner.get('admin/subscribers');
const sub = subs.subscribers?.find((s) => s.email === 'lajme@example.test');
ok(sub?.status === 'subscribed' && sub.unsubscribeUrl.includes('/api/unsubscribe?u='), 'subscriber listed with unsubscribe link', subs);
const csv = await owner.req('GET', 'admin/subscribers?format=csv', undefined, { raw: true });
ok(csv.status === 200 && csv.text.includes('lajme@example.test') && /text\/csv/.test(csv.headers.get('content-type')), 'CSV export');
const u = new URL(sub.unsubscribeUrl);
const page = await hfetch(`${BASE}${u.pathname}${u.search}`);
const html = await page.text();
ok(page.status === 200 && html.includes('<form method="post"'), 'unsubscribe page asks first (GET does not unsubscribe)');
subs = await owner.get('admin/subscribers');
ok(subs.subscribers.find((s) => s.key === sub.key).status === 'subscribed', 'still subscribed after GET');
const post = await hfetch(`${BASE}${u.pathname}${u.search}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `u=${encodeURIComponent(u.searchParams.get('u'))}` });
ok(post.status === 200 && (await post.text()).includes('çregjistruat'), 'unsubscribe POST');
subs = await owner.get('admin/subscribers');
ok(subs.subscribers.find((s) => s.key === sub.key).status === 'unsubscribed', 'unsubscribed after POST');
const bogus = await hfetch(`${BASE}/api/unsubscribe?u=nope`);
ok(bogus.status === 404, 'unknown unsubscribe id → 404');
const cons = await owner.get(`admin/consent?key=${encodeURIComponent(sub.key)}`);
ok(cons.ok && cons.events.length === 2 && cons.events[0].action === 'unsubscribe' && cons.events[1].wording === 'Dua lajme', 'consent history keeps both events with wording', cons);
r = await owner.post('admin/consent', { key: 'besa@example.test', channel: 'sms', action: 'subscribe', note: 'asked in the shop' });
ok(r.ok && r.state.sms.action === 'subscribe', 'staff records consent', r);
const crm = ((await owner.get('admin/snapshot')).lists.crm_profiles ?? []).find(([id]) => id === 'besa@example.test');
ok(crm?.[3]?.marketing?.sms?.status === 'subscribed', 'consent shown on the CRM profile', crm);

/* ---------- discount code lookup & tracking ---------- */
const anyCode = codeDiscounts[0];
r = await visitor.post('coupon', { code: ` ${anyCode.code.toLowerCase()} ` });
ok(r.ok && r.discount?.id === anyCode.id, 'coupon lookup normalises the code', r);
r = await visitor.post('coupon', { code: 'NOPE-NOPE' });
ok(r.ok && r.discount === null, 'unknown coupon → null', r);
const ord = seed.lists.orders.find((o) => o.customer?.email);
r = await visitor.post('track', { number: ord.number.toLowerCase(), contact: ord.customer.email.toUpperCase() });
ok(r.ok && r.order.number === ord.number && !('notes' in r.order) && !(r.order.timeline ?? []).some((e) => 'by' in e || 'note' in e), 'tracking shows a limited view', r.order && Object.keys(r.order));
r = await visitor.post('track', { number: ord.number, contact: 'someone@else.test' });
ok(r.status === 404, 'tracking needs the matching contact', r);
// the number as people type it: spaces instead of the dash, any case
r = await visitor.post('track', { number: ` ${ord.number.replace(/[^a-z0-9]+/gi, ' ').toLowerCase()} `, contact: ord.customer.email });
ok(r.ok && r.order.number === ord.number, 'tracking reads the number loosely', r);
// the customer's upcoming appointments come with the order: booked with the order's e-mail, listed without names or notes
const trackStart = new Date(Date.now() + 2 * 86400000);
trackStart.setUTCHours(2, 0, 0, 0);
r = await visitor.post('booking', {
  inquiry: { type: 'measurement', name: 'Track Test', phone: '049 555 222', email: ord.customer.email.toUpperCase(), message: 'x' },
  booking: { serviceId: svc.id, staffId: svc.staffIds[0], start: trackStart.toISOString(), location: 'onsite', note: 'only for staff' },
});
ok(r.ok && r.booking?.status === 'pending', 'booking with the tracked customer’s e-mail', r);
r = await visitor.post('track', { number: ord.number, contact: ord.customer.email });
const trackedBooking = (r.bookings ?? []).find((x) => x.start === trackStart.toISOString());
ok(
  Array.isArray(r.bookings) && r.bookings.length <= 4 && trackedBooking?.status === 'pending' && trackedBooking.serviceId === svc.id &&
    ['customerName', 'phone', 'email', 'note', 'staffId', 'inquiryId'].every((k) => !(k in trackedBooking)),
  'tracking lists the customer’s upcoming appointments (when and what only)',
  r.bookings,
);
r = await visitor.post('track', { number: ord.number, contact: 'someone@else.test' });
ok(r.status === 404 && !('bookings' in r), 'no appointments without the matching contact', r);

/* ---------- orders (needs the pricing port) ---------- */
if (health.pricing) {
  const prod = pub.products.find((p) => p.price > 0 && !p.quoteOnly && (p.stock ?? 0) > 3 && (p.stock ?? 0) < 900);
  // the first value of every option, as the storefront's defaultOptions does
  const options = Object.fromEntries((prod.options ?? []).filter((o) => o.values?.[0]).map((o) => [o.id, o.values[0].id]));
  const item = { productId: prod.id, qty: 1, options };
  const input = { customer: { firstName: 'Ana', lastName: 'Test', email: 'ana@example.test', phone: '044 987 654', city: 'Mitrovicë', address: 'Rr. 1' }, items: [item], delivery: 'pickup', payment: 'cod', codes: [], lang: 'sq' };
  r = await visitor.post('order', { input, total: 1 });
  ok(r.status === 409 && r.error === 'price_changed' && typeof r.total === 'number', 'order with a wrong total → price_changed', r);
  const total = r.total;
  r = await visitor.post('order', { input, total, consentText: '' });
  ok(r.ok && r.order?.number && r.stock?.[0]?.id === prod.id, 'order placed', r);
  r = await visitor.post('track', { number: r.order.number, contact: '+383 44 987 654' });
  ok(r.ok, 'new order trackable by phone', r);
  r = await visitor.post('order', { input: { ...input, items: [{ ...item, qty: 999 }] }, total });
  ok(r.status === 409 && r.error === 'stock', 'too many → stock', r);
} else console.log('(skipped orders: pricing.php not installed yet)');

/* ---------- uploads ---------- */
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
let fd = new FormData();
fd.append('file', new Blob([png], { type: 'image/png' }), 'pixel.png');
r = await owner.req('POST', 'admin/upload', fd);
ok(r.ok && /^\/uploads\/\d{4}\/\d{2}\/[a-z0-9_-]+\.png$/.test(r.url), 'image upload', r);
if (r.ok) {
  const img = await hfetch(`${BASE}${r.url}`);
  ok(img.status === 200 && img.headers.get('content-type') === 'image/png', 'uploaded image served', img.status);
}
fd = new FormData();
fd.append('file', new Blob(['<?php echo 1; ?>'], { type: 'image/png' }), 'shell.png');
r = await owner.req('POST', 'admin/upload', fd);
ok(r.status === 415, 'PHP disguised as PNG refused', r);
fd = new FormData();
fd.append('file', new Blob([png], { type: 'image/png' }), 'pixel.png');
r = await visitor.req('POST', 'admin/upload', fd);
ok(r.status === 401, 'visitors cannot upload', r);

/* ---------- exposure & rate limits ---------- */
for (const p of ['/api/lib/core.php', '/api/permissions.json', '/api/index.php/../lib/auth.php', '/api/.htaccess']) {
  const x = await hfetch(`${BASE}${p}`);
  const t = await x.text();
  ok(x.status === 403 || x.status === 404 || (x.status === 200 && !t.includes('<?php') && !t.includes('"matrix"')), `not served: ${p}`, x.status);
}
r = await owner.get('admin/export');
ok(r.ok && r.kind === 'miftari-vision-backup' && !JSON.stringify(r).includes('pass_hash') && !JSON.stringify(r).includes('argon2'), 'export has no password hashes', r.kind);
let last;
for (let i = 0; i < 22; i++) last = await anon.post('track', { number: 'X', contact: 'y' });
ok(last.status === 429, 'rate limit on tracking', last);
r = await owner.post('auth/logout');
ok(r.ok, 'logout');
r = await owner.get('auth/me');
ok(r.status === 401, 'signed out after logout', r);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
