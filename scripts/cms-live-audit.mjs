// Public GET-only post-deployment checks; no login, orders, messages or records.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {seoFetch} from './seo-fetch.mjs';
const base='https://optika.itdks.tech';
const out='output/qa/final-audit-20261008';
const verification=JSON.parse(await readFile(`${out}/release-verification.json`,'utf8'));
const checks=[];
const check=(name,ok,evidence='')=>checks.push({name,status:ok?'verified':'failed',evidence});
const digest=b=>createHash('sha256').update(b).digest('hex');
for(const path of verification.release.newAssets){
  const response=await seoFetch(`${base}/${path}`);
  check(`Exact deployed asset: ${path}`,response.status===200 && digest(Buffer.from(await response.arrayBuffer()))===digest(await readFile(`dist/${path}`)));
}
const entry=(await readFile('dist/index.html','utf8')).match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];
if(!entry)throw Error('No final entry script');
const paths=verification.release.changedHtml.filter(p=>!p.startsWith('api/'));
let cursor=0;
await Promise.all(Array.from({length:4},async()=>{
  while(cursor<paths.length){
    const path=paths[cursor++];
    const url='/'+path.replace(/index\.html$/,'');
    const response=await seoFetch(base+url);
    check(`Final entry loaded: ${url}`,response.status===200&&(await response.text()).includes(entry));
  }
}));
for(const path of ['/.env.local','/optika-miftari-data/luna.env','/optika-pre-cms-audit-public-20261008-r19.zip','/optika-itdks-cms-audit-20261008-r19.zip']){
  const r=await seoFetch(base+path); check(`Private/release file not public: ${path}`,[403,404].includes(r.status),r.status);
}
for(const path of ['/api/index.php?resource=snapshot','/api/account.php?resource=profile']){
  const r=await seoFetch(base+path); check(`Anonymous protected request denied: ${path}`,r.status===401,r.status);
}
const luna=await seoFetch(base+'/api/luna.php');
const state=JSON.parse(await luna.text());
check('Luna remains available after frontend release',luna.status===200&&state.available===true&&state.model==='gpt-6-luna',{available:state.available,model:state.model});
const result={at:new Date().toISOString(),target:base,release:verification.release.path,sha256:verification.release.sha256,status:checks.every(c=>c.status==='verified')?'deployed-live-verified':'live-verification-failed',summary:{total:checks.length,failed:checks.filter(c=>c.status==='failed').length},checks};
await writeFile(`${out}/live-release.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify({summary:result.summary,failures:checks.filter(c=>c.status==='failed')},null,2));
if(result.summary.failed)process.exitCode=1;
