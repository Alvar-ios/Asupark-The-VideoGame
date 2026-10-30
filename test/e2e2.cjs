const { chromium, devices } = require('playwright');
const mobile = process.argv[2] === 'mobile';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext(mobile ? { ...devices['Pixel 7 landscape'], viewport: { width: 915, height: 412 } } : { viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 200)); });
  await p.goto('file:///home/claude/racer/dist/index.html');
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `/home/claude/racer/test/${mobile ? 'm' : 'd'}_menu.png` });
  await p.evaluate(() => { window.__dr.sel.track = 0; window.__dr.sel.mode = 'tt'; });
  await p.evaluate(() => document.getElementById('startBtn').click());
  await p.waitForTimeout(5200);
  const st = () => p.evaluate(() => { const S = window.__dr.S, c = S.player; return { state: S.state, kmh: Math.round(c.speed * 3.6), ers: +c.ers.toFixed(2), ersOn: c.ersOn, D: Math.round(c.D), t: +S.t.toFixed(1), gear: c.gearNow, secIdx: S.secIdx }; });
  if (mobile) {
    // gas con el botón táctil + volante deslizando
    const g = await p.locator('#tG').boundingBox();
    await p.touchscreen.tap(g.x + 20, g.y + 20);
  }
  await p.keyboard.down('ArrowUp');
  await p.waitForTimeout(4000);
  console.log('accel', JSON.stringify(await st()));
  await p.keyboard.down('ShiftLeft');
  await p.waitForTimeout(2500);
  console.log('ers on', JSON.stringify(await st()));
  await p.screenshot({ path: `/home/claude/racer/test/${mobile ? 'm' : 'd'}_ers.png` });
  await p.keyboard.up('ShiftLeft'); await p.keyboard.up('ArrowUp');
  await p.keyboard.down('ArrowDown');
  await p.waitForTimeout(1800);
  console.log('braking', JSON.stringify(await st()));
  await p.keyboard.up('ArrowDown');
  await p.keyboard.down('ArrowUp');
  // fuerza paso por sectores colocando al coche cerca de la línea de sector
  for (let k = 0; k < 3; k++) {
    await p.evaluate((k) => { const { S } = window.__dr; const c = S.player, tr = S.tr; const s = tr.len * ((k + 1) / 3) - 40; const i = Math.floor((s % tr.len) / tr.ds); c.x = tr.X[i]; c.z = tr.Z[i]; c.y = tr.Y[i]; c.px = c.x; c.pz = c.z; c.py = c.y; c.psi = Math.atan2(tr.TX[i], tr.TZ[i]); c.ppsi = c.psi; c.hint = -1; c.lastS = s % tr.len; c.vx = Math.sin(c.psi) * 45; c.vz = Math.cos(c.psi) * 45; c.D = Math.floor(c.D / tr.len) * tr.len + (s % tr.len); c.lap = Math.floor(c.D / tr.len); S.secIdx = k; S.secStart = S.t - 10 + k; }, k);
    await p.waitForTimeout(2500);
    console.log('sector', k, await p.evaluate(() => [0, 1, 2].map((i) => document.getElementById('s' + i).className + ':' + document.getElementById('s' + i).lastElementChild.textContent).join(' | ')));
    if (k === 1) await p.screenshot({ path: `/home/claude/racer/test/${mobile ? 'm' : 'd'}_sector.png` });
  }
  await p.keyboard.up('ArrowUp');
  console.log('ERRORS', errs.length ? errs.join('\n') : 'none');
  await b.close();
})();
