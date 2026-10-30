const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('ERR ' + m.text().slice(0, 200)); });
  await p.goto('file:///home/claude/racer/dist/index.html');
  await p.waitForTimeout(2000);
  await p.evaluate(() => { window.__dr.sel.track = 0; window.__dr.sel.mode = 'tt'; document.getElementById('startBtn').click(); });
  await p.waitForFunction(() => window.__dr.S.state === 'racing', null, { timeout: 60000 });
  await p.keyboard.down('ArrowUp');
  await p.waitForTimeout(8000);
  await p.screenshot({ path: '/home/claude/racer/test/f_race.png' });
  console.log(await p.evaluate(() => { const S = window.__dr.S; return JSON.stringify({ state: S.state, kmh: Math.round(S.player.speed * 3.6), D: Math.round(S.player.D), delta: document.getElementById('delta').textContent }); }));
  // terminar 3 vueltas rápido: teletransporte cerca de meta en cada vuelta
  for (let lap = 1; lap <= 3; lap++) {
    await p.evaluate((lap) => { const { S } = window.__dr; const c = S.player, tr = S.tr; const s = tr.len - 40; const i = Math.floor(s / tr.ds); c.x = tr.X[i]; c.z = tr.Z[i]; c.y = tr.Y[i]; c.px = c.x; c.pz = c.z; c.py = c.y; c.psi = Math.atan2(tr.TX[i], tr.TZ[i]); c.ppsi = c.psi; c.hint = -1; c.lap = lap - 1; c.lastS = s; c.D = (lap - 1) * tr.len + s; c.vx = Math.sin(c.psi) * 40; c.vz = Math.cos(c.psi) * 40; }, lap);
    await p.waitForTimeout(5000);
  }
  await p.waitForTimeout(6000);
  await p.screenshot({ path: '/home/claude/racer/test/f_results.png' });
  console.log(await p.evaluate(() => JSON.stringify({ state: window.__dr.S.state, title: document.getElementById('rTitle').textContent, rows: document.getElementById('rTable').innerText.replace(/\n/g, ' | ') })));
  console.log('ERRORS', errs.length ? errs.join('\n') : 'none');
  await b.close();
})();
