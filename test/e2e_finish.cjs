const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 200)); });
  await p.goto('file:///home/claude/racer/dist/index.html');
  await p.waitForTimeout(800);
  for (const mode of ['race']) {
    await p.evaluate((m) => { window.__dr.sel.track = 3; window.__dr.sel.mode = m; }, mode);
    await p.evaluate(() => document.getElementById('startBtn').click());
    await p.waitForTimeout(4800);
    await p.keyboard.down('ArrowUp');
    await p.evaluate(() => { const { S } = window.__dr; const tr = S.tr; S.player.D; });
    await p.evaluate(async () => {
      const m = await import('data:text/javascript,export default 1'); // noop to keep context
    }).catch(() => {});
    // teletransporta al jugador casi a la meta final usando la API expuesta
    await p.evaluate(() => { const { S } = window.__dr; const c = S.player, tr = S.tr; const s = 3 * tr.len - 60; const i = Math.floor((s % tr.len) / tr.ds); c.x = tr.X[i]; c.z = tr.Z[i]; c.y = tr.Y[i]; c.px = c.x; c.pz = c.z; c.py = c.y; c.psi = Math.atan2(tr.TX[i], tr.TZ[i]); c.ppsi = c.psi; c.hint = -1; c.lap = 2; c.lastS = (s % tr.len); c.D = s; c.vx = Math.sin(c.psi) * 40; c.vz = Math.cos(c.psi) * 40; });
    await p.waitForTimeout(14000);
    const st = await p.evaluate(() => ({ state: window.__dr.S.state, res: !document.getElementById('results').classList.contains('hidden'), title: document.getElementById('rTitle').textContent, big: document.getElementById('rBig').textContent, rows: document.getElementById('rTable').innerText }));
    console.log(mode, JSON.stringify(st));
    await p.screenshot({ path: `/home/claude/racer/test/res_${mode}.png` });
    await p.keyboard.up('ArrowUp');
    await p.evaluate(() => document.getElementById('menuBtn2').click());
  }
  console.log('ERRORS', errs.length ? errs.join('\n') : 'none');
  await b.close();
})();
