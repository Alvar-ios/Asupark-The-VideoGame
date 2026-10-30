const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const msgs = [];
  p.on('pageerror', (e) => msgs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning' || /Bora|Porsche/.test(m.text())) msgs.push(m.type() + ' ' + m.text().slice(0, 220)); });
  await p.goto('http://127.0.0.1:8765/index.html');
  await p.waitForTimeout(9000);
  console.log('bora loaded:', await p.evaluate(() => !!window.__dr.boraReady && window.__dr.boraReady()));
  await p.screenshot({ path: '/home/claude/racer/test/csp_menu.png' });
  console.log(msgs.filter((m) => !/GL Driver/.test(m)).join('\n') || 'sin errores');
  await b.close();
})();
