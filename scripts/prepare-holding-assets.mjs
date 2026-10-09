// Format optimisation only. The original generated image is preserved.
import { createRequire } from 'node:module';
import { copyFile, stat } from 'node:fs/promises';
const sharp = createRequire(import.meta.url)(process.argv[2] || 'sharp');
const source = 'output/imagegen/miftari-clinic-2026.png';
await copyFile('C:/Users/A/.codex/generated_images/019fa4a5-dc31-7581-9773-02b078bf6e7f/exec-dac2c410-d5ba-4c54-a35f-d83eb5dbcaea.png', source);
for (const [suffix,width] of [['',1536],['-small',768]]) {
  const path = `public/assets/brand/miftari-clinic-2026${suffix}.webp`;
  await sharp(source).resize({ width, withoutEnlargement: true }).webp({ quality: 83, effort: 6 }).toFile(path);
  console.log(path, (await stat(path)).size);
}
