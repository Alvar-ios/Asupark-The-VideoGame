const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const errs = [];
  for (const [name, opts] of [['d', { viewport: { width: 1280, height: 720 } }], ['m', { ...devices['Pixel 7 landscape'], viewport: { width: 915, height: 412 } }]]) {
    const ctx = await b.newContext(opts); const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(name + ' PAGEERROR ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(name + ' ' + m.type() + ' ' + m.text().slice(0, 240)); });
    await p.goto('file:///home/claude/racer/dist/index.html');
    await p.waitForTimeout(3000);
    await p.screenshot({ path: `/home/claude/racer/test/e_${name}_menu.png` });
    await p.evaluate(() => { window.__dr.sel.track = 0; window.__dr.sel.mode = 'tt'; });
    await p.evaluate(() => document.getElementById('startBtn').click());
    await p.waitForTimeout(1800);
    await p.screenshot({ path: `/home/claude/racer/test/e_${name}_lights.png` });
    await p.waitForTimeout(3500);
    await p.keyboard.down('ArrowUp');
    await p.waitForTimeout(4500);
    await p.screenshot({ path: `/home/claude/racer/test/e_${name}_race.png` });
    console.log(name, await p.evaluate(() => { const S = window.__dr.S; return JSON.stringify({ state: S.state, kmh: Math.round(S.player.speed * 3.6), shadows: window.__dr.QUAL.shadows, delta: document.getElementById('delta').textContent }); }));
    // reinicio instantáneo
    await p.keyboard.up('ArrowUp'); await p.keyboard.press('KeyT'); await p.waitForTimeout(600);
    console.log(name, 'restart', await p.evaluate(() => window.__dr.S.state + ' t=' + window.__dr.S.t.toFixed(1)));
    await ctx.close();
  }
  console.log('ERRORS', errs.length ? errs.join('\n') : 'none');
  await b.close();
})();
