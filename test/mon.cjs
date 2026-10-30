const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const msgs = [];
  p.on('pageerror', (e) => msgs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') msgs.push(m.text().slice(0, 200)); });
  await p.goto('http://127.0.0.1:8765/index.html');
  await p.waitForTimeout(9000);
  await p.evaluate(() => { const i = window.__dr.tracks.findIndex((t) => t.key === 'monaco'); window.__dr.sel.track = i; window.__dr.sel.mode = 'tt'; window.__dr.sel.car = 0; document.getElementById('startBtn').click(); });
  await p.waitForFunction(() => window.__dr.S.state === 'racing', null, { timeout: 120000 });
  await p.keyboard.down('ArrowUp'); await p.waitForTimeout(9000);
  await p.screenshot({ path: '/home/claude/racer/test/mon_race.png' });
  // saltar a una zona de curva/cuesta
  await p.evaluate(() => { const { S } = window.__dr; const c = S.player, tr = S.tr; const s = tr.len * 0.27; const i = Math.floor(s); c.x = tr.X[i]; c.z = tr.Z[i]; c.y = tr.Y[i]; c.px = c.x; c.pz = c.z; c.py = c.y; c.psi = Math.atan2(tr.TX[i], tr.TZ[i]); c.ppsi = c.psi; c.hint = -1; c.lastS = s; c.D = s; c.lap = 0; c.vx = Math.sin(c.psi) * 25; c.vz = Math.cos(c.psi) * 25; });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: '/home/claude/racer/test/mon_hill.png' });
  console.log(msgs.join('\n') || 'sin errores');
  await b.close();
})();
