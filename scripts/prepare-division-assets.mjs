// Optimize generated originals for responsive website delivery; no retouching.
import { createRequire } from 'node:module';
import { copyFile, mkdir, stat } from 'node:fs/promises';
const sharp = createRequire(import.meta.url)(process.argv[2] || 'sharp');
await mkdir('output/imagegen/divisions', { recursive: true });
const assets = [
  ['miftari-lab-partnership', 'exec-86d6535f-a03e-4d8d-9618-e24c671b7c15.png'],
  ['miftari-optical-lifestyle', 'exec-15537bc2-7295-42b8-8a15-49d9c8646082.png'],
];
for (const [name, file] of assets) {
  const original = `output/imagegen/divisions/${name}.png`;
  await copyFile(`C:/Users/A/.codex/generated_images/019fa4a5-dc31-7581-9773-02b078bf6e7f/${file}`, original);
  for (const [suffix, width] of [['', 1536], ['-small', 768]]) {
    const target = `public/assets/brand/${name}${suffix}.webp`;
    await sharp(original).resize({ width, withoutEnlargement: true }).webp({ quality: 84, effort: 6 }).toFile(target);
    console.log(target, (await stat(target)).size);
  }
}
