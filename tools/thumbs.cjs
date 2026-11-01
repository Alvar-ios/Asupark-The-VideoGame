// Genera las miniaturas del selector: node tools/thumbs.cjs [id ...] (con `npm run serve` en marcha)
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright-core');
const fs = require('node:fs'); const path = require('node:path');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1100, height: 650 } })).newPage();
  await p.goto('http://localhost:4173/index.html'); await p.waitForTimeout(2500);
  const requested = new Set(process.argv.slice(2));
  const ids = (await p.evaluate(() => window.__dr.CARS.map((c) => c.id))).filter((id) => !requested.size || requested.has(id)); const out = path.join(__dirname, '..', 'src', 'assets', 'thumbs'); fs.mkdirSync(out, { recursive: true });
  const sharp = require(process.env.SHARP_PATH || 'sharp');
  for (const id of ids) {
    const url = await p.evaluate((id) => window.__dr.renderThumb(id), id);
    await sharp(Buffer.from(url.split(',')[1], 'base64')).trim({ threshold: 1 }).resize({ width: 300, height: 160, fit: 'inside' }).webp({ quality: 88 }).toFile(path.join(out, id + '.webp'));
    console.log('miniatura', id);
  }
  await b.close();
})();
