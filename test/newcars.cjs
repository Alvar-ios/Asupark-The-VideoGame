const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const msgs = [];
  p.on('pageerror', (e) => msgs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning' && !/GL Driver|Unknown ext/.test(m.text())) msgs.push(m.type() + ' ' + m.text().slice(0, 300)); });
  await p.goto('http://127.0.0.1:8765/index.html');
  await p.waitForTimeout(5000);
  const ids = process.argv.slice(2);
  for (const id of ids) {
    const t0 = Date.now();
    const i = await p.evaluate((id) => window.__dr.CARS.findIndex((c) => c.id === id), id);
    await p.evaluate((i) => { window.__dr.sel.car = i; document.querySelectorAll('#carList .card')[i].click(); }, i);
    try { await p.waitForFunction((id) => window.__dr.modelCarReady(id, 'hi'), id, { timeout: 120000 }); } catch (e) { console.log(id, 'NO CARGA'); }
    await p.waitForTimeout(4000);
    console.log(id, 'listo en', ((Date.now() - t0) / 1000) | 0, 's');
    await p.screenshot({ path: `/home/claude/racer/test/nc_${id}.png` });
  }
  console.log(msgs.join('\n') || 'sin errores');
  await b.close();
})();
