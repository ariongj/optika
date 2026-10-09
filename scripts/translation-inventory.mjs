import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const parserPath = fs.readdirSync('node_modules/.pnpm').find(n => n.startsWith('@babel+parser@'));
const { parse } = require(path.resolve('node_modules/.pnpm', parserPath, 'node_modules/@babel/parser'));
const files = fs.readdirSync('src', {recursive:true}).filter(f => /\.(jsx|js)$/.test(f) && !f.startsWith('i18n'));
const entries = new Map();
function walk(n, file) {
  if (!n || typeof n !== 'object') return;
  if (['StringLiteral','JSXText','TemplateElement'].includes(n.type)) {
    const value = (n.type === 'TemplateElement' ? n.value.cooked : n.value)?.replace(/\s+/g,' ').trim();
    if(value && /[a-zA-ZëËçÇ]/.test(value) && (/\s|[ëËçÇ]/.test(value)) && !/[{}<>]|^\.|^\//.test(value)) {
      if(!entries.has(value)) entries.set(value, new Set());
      entries.get(value).add(file.replaceAll('\\','/'));
    }
  }
  for(const [key,value] of Object.entries(n)) if(!['loc','comments','tokens'].includes(key)) {
    if(Array.isArray(value)) value.forEach(child => walk(child,file));
    else if(value && typeof value === 'object') walk(value,file);
  }
}
for(const file of files) walk(parse(fs.readFileSync(path.join('src',file),'utf8'),{sourceType:'module',plugins:['jsx']}),file);
const data=[...entries].map(([text,files])=>({text,files:[...files]}));
fs.mkdirSync('output/qa/language-20261004',{recursive:true});
fs.writeFileSync('output/qa/language-20261004/inventory.json',JSON.stringify(data,null,2));
console.log(JSON.stringify({strings:data.length,byFile:files.map(f=>({file:f,count:data.filter(e=>e.files.includes(f.replaceAll('\\','/'))).length})).filter(e=>e.count)}));
