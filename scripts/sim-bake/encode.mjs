// node encode.mjs <tag> <id>: raw bake results into the site's plates.
import sharp from 'sharp';
import fs from 'node:fs';
const [tag, id = tag] = process.argv.slice(2);
const dest = new URL('../../public/images/sim', import.meta.url).pathname.replace(/^/([A-Za-z]:)/, '$1');
fs.mkdirSync(dest, { recursive: true });
const meta = JSON.parse(fs.readFileSync(`out/${tag}-size.json`));
const raw = (name) => sharp(fs.readFileSync(`out/${tag}-${name}.raw`), { raw: { width: meta.W, height: meta.H, channels: 4 } }).removeAlpha();
const H = (w) => Math.round((w * meta.H) / meta.W);
await raw('plate').resize(2048, H(2048), { kernel: 'lanczos3' }).webp({ quality: 84, effort: 6, smartSubsample: true }).toFile(`${dest}/${id}.webp`);
await raw('plate').resize(1280, H(1280), { kernel: 'lanczos3' }).sharpen({ sigma: 0.5 }).webp({ quality: 80, effort: 6, smartSubsample: true }).toFile(`${dest}/${id}-sm.webp`);
await raw('data').resize(1024, H(1024), { kernel: 'mitchell' }).webp({ nearLossless: true, quality: 40, effort: 6 }).toFile(`${dest}/${id}-d.webp`);
for (const f of [`${id}.webp`, `${id}-sm.webp`, `${id}-d.webp`]) console.log(f, (fs.statSync(`${dest}/${f}`).size / 1024).toFixed(0) + ' KB');
