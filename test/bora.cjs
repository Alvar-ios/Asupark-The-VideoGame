const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' || /Bora/.test(m.text())) errs.push(m.type() + ' ' + m.text().slice(0, 200)); });
  await p.goto('file:///home/claude/racer/dist/index.html');
  await p.waitForTimeout(6000);
  await p.screenshot({ path: '/home/claude/racer/test/b_menu.png' });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: '/home/claude/racer/test/b_menu2.png' });
  await p.evaluate(() => { window.__dr.sel.track = 0; window.__dr.sel.mode = 'tt'; document.getElementById('startBtn').click(); });
  await p.waitForFunction(() => window.__dr.S.state === 'racing', null, { timeout: 90000 });
  await p.keyboard.down('ArrowUp'); await p.waitForTimeout(5000);
  await p.screenshot({ path: '/home/claude/racer/test/b_race.png' });
  console.log('ERRORS', errs.length ? errs.join('\n') : 'none');
  await b.close();
})();
