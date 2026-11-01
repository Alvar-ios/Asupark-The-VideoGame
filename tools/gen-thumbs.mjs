import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const distRoot = path.resolve('dist');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.gz': 'application/gzip',
  '.wav': 'audio/wav',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost:4173').pathname);
  const target = path.resolve(distRoot, '.' + (urlPath === '/' ? '/index.html' : urlPath));
  fs.readFile(target, (err, data) => {
    if (err) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream' });
    res.end(data);
  });
});

await new Promise(r => server.listen(4173, r));
console.log('Server running on 4173');

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({
  executablePath: chromePath,
  args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist']
});

const page = await browser.newPage({ viewport: { width: 1100, height: 650 } });
await page.goto('http://localhost:4173/index.html');
await page.waitForTimeout(2000);

const outDir = path.resolve('src/assets/thumbs');
fs.mkdirSync(outDir, { recursive: true });

const cars = ['r24', 'brawngp', 'mp423', 'mp45', 'fordgt06', 'rx7toon', 'minis'];
for (const id of cars) {
  try {
    const url = await page.evaluate(async (carId) => {
      return await window.__dr.renderThumb(carId);
    }, id);
    const buf = Buffer.from(url.split(',')[1], 'base64');
    await sharp(buf)
      .trim({ threshold: 1 })
      .resize({ width: 300, height: 160, fit: 'inside' })
      .webp({ quality: 88 })
      .toFile(path.join(outDir, `${id}.webp`));
    console.log(`Generated thumbnail for ${id}`);
  } catch (err) {
    console.error(`Error for ${id}:`, err);
  }
}

await browser.close();
server.close();
console.log('All thumbnails generated successfully!');
