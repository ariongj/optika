// Format optimisation only. Original AI-generated campaign assets remain intact.
import { createRequire } from 'node:module';
import { mkdir, copyFile, stat } from 'node:fs/promises';
const sharp = createRequire(import.meta.url)(process.argv[2] || 'sharp');
const generated = 'C:/Users/A/.codex/generated_images/019f8661-28d8-7f11-b215-506a85eec1e2/';
await mkdir('output/imagegen/atelier-20261008', {recursive:true});
for (const [name,source] of [
  ['atelier-optical-2026','exec-4a211631-c5d2-4038-b6f1-20eb84b4d9c2.png'],
  ['atelier-sun-2026','exec-bb2d008d-1e9d-476b-92ac-76799cce2101.png'],
]) {
  await copyFile(generated+source, `output/imagegen/atelier-20261008/${name}.png`);
  for (const [suffix,width] of [['',1536],['-small',768]]) {
    const destination = `public/assets/brand/${name}${suffix}.webp`;
    await sharp(generated+source).resize({width,withoutEnlargement:true}).webp({quality:85,effort:6}).toFile(destination);
    console.log(destination, (await stat(destination)).size);
  }
}
