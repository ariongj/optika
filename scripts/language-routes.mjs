import { writeFile } from 'node:fs/promises';
import { products, blogPosts } from '../src/data/catalog.js';
import { pageDefinitions } from '../src/seoPages.js';
const paths = [...pageDefinitions.map(p=>p[0]).filter(p=>p!='/staff'), ...products.map(p=>`/syze-${p.type==='Sunglasses'?'dielli':'optike'}/${p.id}`), ...blogPosts.map(p=>`/lens-focus/articles/${p.slug}`)];
await writeFile('output/qa/language-20261004/routes.json',JSON.stringify(paths,null,2));
console.log(`${paths.length} customer-facing route targets`);
