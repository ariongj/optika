// Format optimisation only; generated originals remain in output/imagegen.
import { createRequire } from 'node:module';
import { stat } from 'node:fs/promises';
const sharp = createRequire(import.meta.url)(process.argv[2] || 'sharp');
for (const name of ['miftari-generations-campaign', 'miftari-sun-campaign', 'miftari-craft-campaign']) {
  for (const [suffix, width] of [['', 1536], ['-small', 768]]) {
    const path = `public/assets/brand/${name}${suffix}.webp`;
    await sharp(`output/imagegen/premium-30/${name}.png`).resize({ width, withoutEnlargement: true }).webp({ quality: 84, effort: 6 }).toFile(path);
    console.log(path, (await stat(path)).size);
  }
}
