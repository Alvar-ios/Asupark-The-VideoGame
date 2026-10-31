const { chromium } = require('/home/claude/racer/node_modules/playwright');
(async () => {
  const [ids, out, lod] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1080, height: 240 * ids.split(',').length } });
  p.on('pageerror', (e) => console.log('ERR', e.message)); p.on('console', (m) => { if (m.type() === 'error') console.log('CERR', m.text().slice(0, 200)); });
  await p.goto(`http://localhost:8123/sheet.html?ids=${ids}&lod=${lod || 'hi'}`);
  await p.waitForFunction(() => window.DONE, null, { timeout: 240000 });
  await p.screenshot({ path: out }); await b.close();
})();
