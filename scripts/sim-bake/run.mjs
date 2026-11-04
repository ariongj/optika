// node run.mjs <scene> <width> <spp> [hdri=2k|8k] [tag]
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import fs from 'node:fs';
const [scene = 'street', w = '512', spp = '20', hdri = '2k', tag0] = process.argv.slice(2);
const tag = tag0 || `${scene}-${w}`;
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-watchdog', '--disable-gpu-process-crash-limit', '--js-flags=--max-old-space-size=12000', '--force-gpu-mem-available-mb=5500'],
  protocolTimeout: 3000000,
});
const page = await browser.newPage();
page.setDefaultTimeout(0);
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' || !/THREE\.|GPU stall/.test(t)) console.log(`[${m.type()}]`, t.slice(0, 600));
});
page.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 600)));
await page.setViewport({ width: 800, height: 600 });
await page.goto(`http://localhost:4400/?scene=${scene}&w=${w}&spp=${spp}&hdri=${hdri}&tag=${tag}&tiles=${+w > 1200 ? 4 : 2}`, { waitUntil: 'load' });
await page.waitForFunction('window.__done === true || window.__failed', { timeout: 0, polling: 2000 });
const failed = await page.evaluate('window.__failed');
await browser.close();
if (failed) {
  console.log('FAILED', failed);
  process.exit(1);
}
const meta = JSON.parse(fs.readFileSync(`out/${tag}-size.json`));
await sharp(fs.readFileSync(`out/${tag}-plate.raw`), { raw: { width: meta.W, height: meta.H, channels: 4 } }).removeAlpha().png().toFile(`out/${tag}-plate.png`);
await sharp(fs.readFileSync(`out/${tag}-data.raw`), { raw: { width: meta.W, height: meta.H, channels: 4 } }).removeAlpha().png().toFile(`out/${tag}-data.png`);
console.log('done', tag, meta.W, meta.H);
