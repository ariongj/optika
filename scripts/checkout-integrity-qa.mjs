import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomBytes,pbkdf2Sync} from 'node:crypto';

// No live data or real customers. Fixed project port, random local credentials,
// private synthetic storage, outbound mail disabled, and owned process cleanup.
await new Promise((yes,no)=>{const probe=net.createServer();probe.once('error',()=>no(Error('Optika port 4190 is occupied')));probe.listen(4190,'127.0.0.1',()=>probe.close(yes));});
const out=resolve(process.env.OPTIKA_CMS_QA_REPORT_DIR || 'output/qa/ecommerce-20261004');
const data=resolve(out,`integrity-${Date.now()}`);await mkdir(data,{recursive:true});
const password=`Qa!${randomBytes(24).toString('hex')}`,salt=randomBytes(18).toString('hex');
await writeFile(resolve(data,'credentials.json'),JSON.stringify({email:'qa.admin@example.test',salt,hash:pbkdf2Sync(password,salt,120000,32,'sha256').toString('hex'),iterations:120000,updatedAt:new Date().toISOString()}));
const server=spawn(resolve('tmp/php-8.5.9/php.exe'),['-d','disable_functions=mail','-S','127.0.0.1:4190','-t','dist'],{env:{...process.env,OPTIKA_STORAGE_DIR:data},stdio:'ignore',windowsHide:true});
function client(){let cookie='';return (path,body,csrf='')=>new Promise((yes,no)=>{const payload=body?JSON.stringify(body):'';const req=http.request({host:'127.0.0.1',port:4190,path,method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}:{}),...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{})}},res=>{if(res.headers['set-cookie'])cookie=res.headers['set-cookie'].map(s=>s.split(';')[0]).join('; ');let raw='';res.on('data',d=>raw+=d);res.on('end',()=>{try{yes({status:res.statusCode,body:JSON.parse(raw)});}catch{no(Error(`Non-JSON response ${res.statusCode}`));}});});req.on('error',no);req.end(payload);});}
const guest=client(),admin=client(),checks=[];
const check=(value,name)=>{checks.push({name,status:value?'verified':'failed'});console.log(`${value?'PASS':'FAIL'} ${name}`);};
try {
  for(let n=0;n<50;n++){try{await guest('/api/index.php?resource=public');break;}catch{await new Promise(r=>setTimeout(r,100));}}
  const login=await admin('/api/index.php',{action:'login',email:'qa.admin@example.test',password});assert.equal(login.status,200);
  const csrf=login.body.csrf,snapshot=()=>admin('/api/index.php?resource=snapshot');
  const initial=await snapshot();assert.equal(initial.status,200,'Synthetic staff fixture must be provisioned');
  const start=initial.body;
  const product=start.products.find(p=>p.stock>5 && !p.salePrice);assert.ok(product);
  const input={type:'order',orderId:'OM-QA-PRICING',name:'Synthetic pricing QA',email:'qa.pricing@example.test',phone:'+000000000',shippingKey:'pickup',deliveryAddress:'Isolated test',items:[{productId:product.id,quantity:1}]};
  const quote=(body)=>guest('/api/quote.php',body);
  const original=(await quote(input)).body.quote;
  check(/^[a-f0-9]{64}$/.test(original.fingerprint),'Quote has a reproducible price fingerprint');
  check((await quote(input)).body.quote.fingerprint===original.fingerprint,'Unchanged quote preserves fingerprint');
  for(const quantity of [0,-1,0.5,11,'bad',true]) check((await quote({...input,items:[{productId:product.id,quantity}]})).body.error==='invalid_quantity',`Invalid quantity ${quantity} rejected without clamping`);
  check((await quote({...input,items:[null]})).body.error==='invalid_cart_item','Invalid cart entry rejected without dropping it');
  const oversized={...input,items:Array.from({length:26},()=>({productId:product.id,quantity:1}))};
  check((await quote(oversized)).body.error==='cart_line_limit','26-line quote rejected without truncation');
  check((await guest('/api/submit.php',oversized)).body.error==='cart_line_limit','26-line order rejected without partial order');
  const save=(price)=>admin('/api/index.php',{action:'save_product',product:{...product,price,status:product.status || 'Published'},expectedStock:product.stock},csrf);
  check((await save(product.price+10)).body.ok,'Synthetic CMS price changes between review and submission');
  const rejected=await guest('/api/submit.php',{...input,quoteFingerprint:original.fingerprint});
  check(rejected.status===409&&rejected.body.error==='quote_changed','Changed price requires explicit new review');
  const after=(await snapshot()).body;
  check(after.orders.length===start.orders.length&&after.submissions.length===start.submissions.length,'Rejected quote creates neither order nor inbox entry');
  check(after.products.find(p=>p.id===product.id).stock===product.stock,'Rejected quote never reserves stock');
  const refreshed=(await quote(input)).body.quote;
  check(refreshed.subtotal===product.price+10&&refreshed.items[0].unitPrice===refreshed.subtotal,'Updated item, subtotal and total use the same authoritative price');
  const accepted=await guest('/api/submit.php',{...input,quoteFingerprint:refreshed.fingerprint});
  check(accepted.body.accepted&&accepted.body.order.total===refreshed.total,'Reviewed replacement quote can be submitted');
  const retry=await guest('/api/submit.php',{...input,quoteFingerprint:original.fingerprint});
  check(retry.body.duplicate&&retry.body.order.id===input.orderId,'Lost-response retry returns saved order despite an older quote');
  check((await snapshot()).body.products.find(p=>p.id===product.id).stock===product.stock-1,'Retry reserves inventory only once');
  const products=(await guest('/api/index.php?resource=public')).body.products.filter(p=>p.stock>0).slice(0,25);
  assert.equal(products.length,25);
  const full={...input,orderId:'OM-QA-25-LINES',items:products.map(p=>({productId:p.id,quantity:1}))};
  const fullQuote=(await quote(full)).body.quote;
  check(fullQuote.items.length===25,'Maximum supported basket quotes all 25 lines');
  const fullOrder=await guest('/api/submit.php',{...full,quoteFingerprint:fullQuote.fingerprint});
  const saved=(await snapshot()).body.orders.find(o=>o.id===full.orderId);
  check(fullOrder.body.accepted&&saved.items.length===25,'Maximum supported order saves every line');
}catch(error){checks.push({name:error.message,status:'failed'});console.error(error.message);}
finally{server.kill();await writeFile(resolve(out,'checkout-integrity.json'),JSON.stringify({at:new Date().toISOString(),environment:'synthetic localhost only; mail disabled',checks},null,2));}
if(checks.some(c=>c.status==='failed'))process.exitCode=1;
