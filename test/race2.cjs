const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const msgs = [];
  p.on('pageerror', (e) => msgs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') msgs.push(m.text().slice(0, 300)); });
  await p.goto('http://127.0.0.1:8765/index.html');
  await p.waitForTimeout(5000);
  await p.evaluate(() => { const D = window.__dr; D.sel.car = D.CARS.findIndex((c) => c.id === 'cupra'); D.sel.track = D.tracks.findIndex((t) => t.key === 'monaco'); D.sel.mode = 'race'; document.getElementById('startBtn').click(); });
  await p.waitForFunction(() => window.__dr.S.state === 'racing', null, { timeout: 180000 });
  await p.keyboard.down('ArrowUp'); await p.waitForTimeout(7000);
  await p.screenshot({ path: '/home/claude/racer/test/race_cupra.png' });
  console.log(await p.evaluate(() => JSON.stringify({ kmh: Math.round(window.__dr.S.player.speed * 3.6), cars: window.__dr.S.cars.map((c) => c.type.id) })));
  console.log(msgs.join('\n') || 'sin errores');
  await b.close();
})();
