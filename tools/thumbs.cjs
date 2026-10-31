// Genera las miniaturas del selector de coches: node tools/thumbs.cjs  (con `npm run serve` en marcha en :4173 y playwright instalado)
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs'); const path = require('node:path');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1100, height: 650 } })).newPage();
  await p.goto('http://localhost:4173/index.html'); await p.waitForTimeout(2500);
  const ids = await p.evaluate(() => window.__dr.CARS.map((c) => c.id)); const out = path.join(__dirname, '..', 'src', 'assets', 'thumbs'); fs.mkdirSync(out, { recursive: true });
  const sharp = require(process.env.SHARP_PATH || 'sharp');
  for (const id of ids) {
    const url = await p.evaluate((id) => window.__dr.renderThumb(id), id);
    await sharp(Buffer.from(url.split(',')[1], 'base64')).trim({ threshold: 1 }).resize({ width: 300, height: 160, fit: 'inside' }).webp({ quality: 88 }).toFile(path.join(out, id + '.webp'));
    console.log('miniatura', id);
  }
  await b.close();
})();
