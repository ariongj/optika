// Serial HTTP suites share the project's fixed port; every suite owns synthetic storage.
import {spawn} from 'node:child_process';
import {mkdir,writeFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const reportName=process.env.OPTIKA_AUDIT_REPORT || 'final-audit-20261003';
if(!/^[a-z0-9-]+$/.test(reportName))throw new Error('Audit report must be a simple folder name');
const out=resolve('output/qa',reportName);
await mkdir(out,{recursive:true});
const node=process.execPath, php=resolve('tmp/php-8.5.9/php.exe');
const suites=[
  ['unit',node,['--test','--test-concurrency=1','--test-timeout=60000',...((await readdir('scripts')).filter(n=>n.endsWith('.test.mjs')).map(n=>resolve('scripts',n)))]],
  ['build',node,['node_modules/vite/bin/vite.js','build','--configLoader','runner']],
  ['prerender',node,['scripts/prerender.mjs']],
  ['cms-api',node,['scripts/cms-proposal-qa.mjs']],
  ['checkout-account',node,['scripts/completion-workflow-qa.mjs']],
  ['checkout-integrity',node,['scripts/checkout-integrity-qa.mjs']],
  ['b2b',node,['scripts/lab-partner-api-qa.mjs']],
  ['appointments',node,['scripts/appointment-api-qa.mjs']],
  ['credentials',node,['scripts/admin-credentials-qa.mjs']],
  ['concurrency',node,['scripts/shared-store-concurrency-qa.mjs']],
  ['empty-catalogue',node,['scripts/catalogue-empty-state-qa.mjs']],
  ['discounts',php,['scripts/cms-discounts.test.php']],
  ['seo-build',node,['scripts/seo-audit.mjs']],
  ['seo-cms',node,['scripts/seo-cms-qa.mjs']],
  ...((await readdir('public/api')).filter(n=>n.endsWith('.php')).map(n=>['lint-'+n,php,['-l',resolve('public/api',n)]])),
];
const results=[];
for(const[name,exe,args]of suites){
  const start=Date.now();
  const result=await new Promise(done=>{
    const child=spawn(exe,args,{windowsHide:true,env:{...process.env,VITE_PUBLIC_SITE_URL:'https://optika.itdks.tech',OPTIKA_CMS_QA_REPORT_DIR:out,OPTIKA_QA_REPORT_DIR:resolve(out,'completion'),OPTIKA_SEO_REPORT_DIR:reportName},stdio:['ignore','pipe','pipe']});
    let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);
    child.on('error',e=>done({code:-1,output:e.message}));child.on('close',code=>done({code,output}));
  });
  await writeFile(resolve(out,name+'.log'),result.output);
  results.push({name,status:result.code===0?'verified':'failed',exitCode:result.code,ms:Date.now()-start});
  console.log(`${result.code===0?'PASS':'FAIL'} ${name}`);
  await writeFile(resolve(out,'suite-results.json'),JSON.stringify({at:new Date().toISOString(),environment:'isolated local data; no production mutations',results},null,2));
  if(result.code!==0&&(name==='build'||name==='prerender'))break;
}
if(results.some(r=>r.status==='failed'))process.exitCode=1;
