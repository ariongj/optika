import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { english } from '../src/i18n/en.js';
const require = createRequire(import.meta.url);
const parserPath = fs.readdirSync('node_modules/.pnpm').find(n => n.startsWith('@babel+parser@'));
const { parse } = require(path.resolve('node_modules/.pnpm', parserPath, 'node_modules/@babel/parser'));
const filename = process.argv[2] || 'src/App.jsx';
const functions = new Set(process.argv.slice(3));
const entries = new Set();
function walk(n, context='') {
  if (!n || typeof n !== 'object') return;
  if(n.type==='FunctionDeclaration') context=n.id?.name || context;
  if (!functions.size || functions.has(context)) {
    if (['StringLiteral','JSXText','TemplateElement'].includes(n.type)) {
      const value = (n.type==='TemplateElement'?n.value.cooked:n.value)?.replace(/\s+/g,' ').trim();
      if(value && !english[value] && /[a-zA-ZëËçÇ]/.test(value) && (/\s|[ëËçÇ]/.test(value)) && !/[{}<>]|^\.|^\//.test(value)) entries.add(value);
    }
  }
  for(const [key,value] of Object.entries(n)) if(!['loc','comments','tokens'].includes(key)) {
    if(Array.isArray(value)) value.forEach(child => walk(child,context));
    else if(value && typeof value==='object') walk(value,context);
  }
}
walk(parse(fs.readFileSync(filename,'utf8'),{sourceType:'module',plugins:['jsx']}));
console.log([...entries].join('\n'));
