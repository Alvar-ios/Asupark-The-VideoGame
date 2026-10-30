const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const msgs = [];
  p.on('pageerror', (e) => msgs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' || /Porsche|Bora/.test(m.text())) msgs.push(m.type() + ' ' + m.text().slice(0, 200)); });
  await p.goto('http://127.0.0.1:8765/index.html');
  await p.waitForTimeout(10000);
  for (const [i, name] of [[0, 'bora'], [1, 'porsche']]) {
    await p.evaluate((i) => { window.__dr.sel.car = i; document.querySelectorAll('#carList .card')[i].click(); }, i);
    await p.waitForTimeout(3500);
    await p.screenshot({ path: `/home/claude/racer/test/car_${name}.png` });
  }
  await p.evaluate(() => { window.__dr.sel.track = 0; window.__dr.sel.mode = 'tt'; document.getElementById('startBtn').click(); });
  await p.waitForFunction(() => window.__dr.S.state === 'racing', null, { timeout: 120000 });
  await p.keyboard.down('ArrowUp'); await p.waitForTimeout(5000);
  await p.screenshot({ path: '/home/claude/racer/test/car_porsche_race.png' });
  console.log(msgs.join('\n') || 'sin errores');
  await b.close();
})();
