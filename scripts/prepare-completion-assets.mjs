// Format/size optimisation only; no content editing or recolouring.
import { createRequire } from 'node:module';
import { copyFile, stat } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const sharp = require(process.argv[2] || 'sharp');
const base = 'C:/Users/A/.codex/generated_images/019fa4a5-dc31-7581-9773-02b078bf6e7f/';
const assets = {
  contact: 'exec-fe8e3680-c9c6-47ff-b548-de92b3b9c149.png',
  examination: 'exec-abf4ae60-4118-4421-949c-6ca068b7ab00.png',
  craftsmanship: 'exec-cc10e5e3-d202-4681-8610-438c696f4bca.png',
  sunglasses: 'exec-df2a8336-3598-41fe-a3eb-6430395601ab.png',
  optical: 'exec-468889b9-7148-419c-bc69-bfcf47f13e5a.png',
  'lens-detail': 'exec-539e45ca-3ee8-4920-bba7-fd26f94f47fb.png',
  'home-category': 'exec-73c7e8a8-9996-4b37-80bc-a1a94a13460e.png',
};
for (const [key, filename] of Object.entries(assets)) {
  const source = `output/imagegen/optika-${key}-2026.png`;
  await copyFile(base + filename, source);
  for (const [suffix, width] of [['',1536],['-small',768]]) {
    const dest = `public/assets/brand/optika-${key}-2026${suffix}.webp`;
    await sharp(source).resize({width,withoutEnlargement:true}).webp({quality:83,effort:6}).toFile(dest);
    console.log(`${dest}: ${(await stat(dest)).size} bytes`);
  }
}
