import https from 'node:https';
import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';

const base = 'https://optika.itdks.tech';
const paths = ['/', '/optical', '/clinic', '/laboratory/partners', '/shop', '/prescription-glasses', '/sunglasses', '/about', '/laboratory', '/ekzaminimi', '/contact', '/policies', '/order-status', '/wishlist', '/account', '/staff', '/syze-optike/nov-n04', '/virtual-try-on', '/lens-focus'];
function get(path) {
  return new Promise((resolve, reject) => {
    const req = https.get(base + path, {headers:{'User-Agent':'OptikaDeploymentCheck/1.0'}}, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));
    });
    req.setTimeout(20000, () => req.destroy(new Error('HTTPS timeout')));
    req.on('error', reject);
  });
}
const checks = [];
for (const path of paths) {
  const response = await get(path);
  // Apache may canonicalize directory routes with a trailing slash.
  const final = [301,302,307,308].includes(response.status) && response.headers.location
    ? await get(new URL(response.headers.location, base + path).pathname) : response;
  assert.equal(final.status,200,path);
  const text = final.body.toString();
  assert.match(text,/optika\.itdks\.tech/,path);
  checks.push({path,status:final.status,redirect:response===final?null:response.status,bytes:final.body.length});
}
const home = (await get('/')).body.toString();
const localHome = await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
const script = localHome.match(/src="(\/assets\/index-[^\"]+\.js)"/)?.[1];
const stylesheet = localHome.match(/href="(\/assets\/index-[^\"]+\.css)"/)?.[1];
assert.ok(script && home.includes(script),'Live homepage must reference exact deployment build');
assert.ok(stylesheet && home.includes(stylesheet),'Live homepage must reference exact deployment stylesheet');
assert.doesNotMatch(home, /https:\/\/optikamiftari\.com/, 'Review-site metadata must not reference the production domain');
const campaignImages = ['editorial-campaign','examination','craftsmanship','sunglasses','optical','lens-detail','home-category','contact'].flatMap(name => [`/assets/brand/optika-${name}-2026.webp`, `/assets/brand/optika-${name}-2026-small.webp`]);
const premiumImages = ['miftari-generations-campaign', 'miftari-sun-campaign', 'miftari-craft-campaign'].flatMap(name => [`/assets/brand/${name}.webp`, `/assets/brand/${name}-small.webp`]);
for (const path of [script, stylesheet, ...campaignImages, ...premiumImages, '/assets/brand/miftari-clinic-2026.webp', '/assets/brand/miftari-clinic-2026-small.webp']) {
  const response = await get(path);
  assert.equal(response.status,200,path);
  const local = await readFile(new URL('../dist'+path,import.meta.url));
  assert.ok(response.body.equals(local),'Live asset mismatch: '+path);
  checks.push({path,status:response.status,exactMatchToBuild:true,bytes:response.body.length});
}
for (const [path,expected] of [['/api/index.php?resource=public',200],['/api/index.php?resource=orders',401],['/api/account.php?resource=session',200],['/api/account.php?resource=profile',401],['/this-page-does-not-exist-campaign-check',404],['/optika-pre-campaign-public-20260928.zip',404],['/optika-pre-completion-public-20260928.zip',404],['/optika-pre-completion-data-20260928.zip',404]]) {
  const response = await get(path);
  assert.equal(response.status,expected,path);
  if(path.includes('resource=public')) {
    const payload = JSON.parse(response.body);
    assert.equal(payload.products.length,40);
    assert.ok(payload.content?.groupTitle && payload.content?.clinicTitle && payload.content?.partnersTitle, 'Group CMS defaults available');
    assert.match(payload.content.groupSubtitle, /30 vjet/, 'Confirmed heritage available');
    assert.doesNotMatch(payload.content.aboutSubtitle, /20\+|20 vjet/, 'Old heritage must not remain in CMS response');
    assert.ok(!payload.submissions, 'Public API must not expose enquiries');
  }
  if(path.includes('resource=session')) assert.equal(JSON.parse(response.body).authenticated,false);
  checks.push({path,status:response.status});
}
for (const path of ['/optika-pre-service-public-20260928.zip', '/optika-pre-service-data-20260928.zip', '/optika-pre-checkout-public-20260928.zip', '/optika-itdks-checkout-aftercare-20260928-r3.zip', '/optika-pre-holding-public-20260928.zip', '/optika-itdks-holding-group-20260928-r4.zip', '/optika-pre-premium-public-20260928.zip', '/optika-itdks-premium-30-20260928-r5.zip']) {
  const response = await get(path);
  assert.equal(response.status, 404, path);
  checks.push({path, status:response.status});
}
const report = {checkedAt:new Date().toISOString(),domain:base,checks,ordersSubmitted:0,accountsCreated:0,mailSent:0,scope:'Anonymous read-only live verification; authenticated workflows and payments not tested'};
const reportPath = process.env.OPTIKA_SMOKE_REPORT || '../output/qa/campaign-rebuild/live-smoke.json';
await writeFile(new URL(reportPath,import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
