const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 200)); });
  await p.goto('file:///home/claude/racer/dist/index.html');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: '/home/claude/racer/test/menu.png' });
  const trackIdx = +(process.argv[2] || 0);
  await p.evaluate((i) => { window.__dr.sel.track = i; }, trackIdx);
  await p.click('#startBtn');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: '/home/claude/racer/test/cd.png' });
  await p.waitForTimeout(3500);
  await p.keyboard.down('ArrowUp');
  const shots = [];
  for (let i = 0; i < 6; i++) {
    await p.waitForTimeout(2500);
    const st = await p.evaluate(() => { const S = window.__dr.S, c = S.player; return { state: S.state, kmh: Math.round(c.speed * 3.6), D: Math.round(c.D), lat: +c.loc.lat.toFixed(1), air: c.air, t: +S.t.toFixed(1) }; });
    console.log(JSON.stringify(st));
    if (i === 1) await p.screenshot({ path: '/home/claude/racer/test/race1.png' });
    if (i === 4) await p.screenshot({ path: '/home/claude/racer/test/race2.png' });
    if (i === 2) { await p.keyboard.down('ArrowLeft'); await p.keyboard.down('Space'); await p.waitForTimeout(700); await p.screenshot({ path: '/home/claude/racer/test/drift.png' }); await p.keyboard.up('Space'); await p.keyboard.up('ArrowLeft'); }
  }
  console.log('ERRORS', errs.length ? errs.join('\n') : 'none');
  await b.close();
})();
