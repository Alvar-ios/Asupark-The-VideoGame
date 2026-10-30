const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const errs = [];
  for (const [name, vp] of [['land', { width: 915, height: 412 }], ['port', { width: 412, height: 915 }]]) {
    const ctx = await b.newContext({ ...devices['Pixel 7'], viewport: vp });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 200)); });
    await p.goto('file:///home/claude/racer/dist/index.html');
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `/home/claude/racer/test/s_${name}_menu.png` });
    if (name === 'land') {
      await p.evaluate(() => { window.__dr.sel.track = 0; window.__dr.sel.mode = 'tt'; });
      await p.tap('#startBtn');
      await p.waitForTimeout(5500);
      // botones táctiles: gas + derecha
      const g = await p.locator('#tG').boundingBox();
      await p.touchscreen.tap(g.x + 10, g.y + 10);
      await p.keyboard.down('ArrowUp');
      await p.waitForTimeout(3500);
      await p.screenshot({ path: '/home/claude/racer/test/s_land_race.png' });
      await p.keyboard.up('ArrowUp');
    }
    await ctx.close();
  }
  console.log('ERRORS', errs.length ? errs.join('\n') : 'none');
  await b.close();
})();
