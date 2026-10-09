// Format/size optimisation only. The original generated artwork stays in output/imagegen.
import { createRequire } from 'node:module';
import { stat } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const sharp = require(process.argv[2] || 'sharp');
const source = 'output/imagegen/optika-editorial-campaign-2026.png';
for (const [suffix, width] of [['', 1536], ['-small', 768]]) {
  const destination = `public/assets/brand/optika-editorial-campaign-2026${suffix}.webp`;
  await sharp(source).resize({ width, withoutEnlargement: true }).webp({ quality: 84, effort: 6 }).toFile(destination);
  console.log(`${destination}: ${(await stat(destination)).size} bytes`);
}
