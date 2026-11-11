// (T)rustyShelf discussion 15: Settings → PC games → Console box color. PC games in their console box keep each console's
// colour, take one colour for all, or one per console. On the demo page. Run (after node copy-web.js):
// node ci/boxcolor-test.js www ../out/boxcolor
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const WWW = path.resolve(process.argv[2] || 'www'), OUT = path.resolve(process.argv[3] || '../out/boxcolor');
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? '✅ ' : '❌ ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 500))); if (!ok) fails++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary' };
const server = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const p = path.join(WWW, u === '/' ? 'index.html' : u);
  if (!p.startsWith(WWW)) { r.writeHead(403); return r.end(); }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
const rows = page => page.evaluate(() => [...document.querySelectorAll('#bss .bss-row')].map(r => ({ nm: (r.querySelector('.nm') || {}).textContent || '', text: r.textContent })));
const click = (page, name) => page.evaluate(n => { const r = [...document.querySelectorAll('#bss .bss-row')].find(x => ((x.querySelector('.nm') || {}).textContent || '') === n); if (r) r.click(); return !!r; }, name);
server.listen(0, async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }), page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/index.html?platform=windows&shelf=1`); await page.waitForTimeout(5000);
    const st = () => page.evaluate(() => ({ ps5: Shelf._boxStyle('ps5'), xone: Shelf._boxStyle('xone') }));
    const own = await st();
    check('By default each console keeps its own colour (PS5 blue, Xbox One green)', own.ps5.case !== own.xone.case && /^#/.test(own.xone.case), JSON.stringify(own));
    await page.evaluate(() => Setup.open({ page: 'pc' })); await page.waitForTimeout(1500);
    let L = await rows(page);
    if (!L.some(r => r.nm === 'Console box color')) { await click(page, 'Console box art'); await page.waitForTimeout(500); L = await rows(page); }
    check('Settings → PC games has Console box color once Console box art is on', L.some(r => r.nm === 'Console box color') && L.some(r => r.nm === 'Box color per console'), JSON.stringify(L.map(r => r.nm)));
    // the choice row: right picks the next option (Dark blue)
    await page.evaluate(() => { const r = [...document.querySelectorAll('#bss .bss-row')].find(x => ((x.querySelector('.nm') || {}).textContent || '') === 'Console box color'); r.click(); });
    await page.waitForTimeout(300); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, 'boxcolor-settings.png') });
    await page.evaluate(() => Settings.close()); await page.waitForTimeout(2500);
    const one = await st();
    check('One colour for every PC game: PS5 and Xbox One boxes both dark blue, sides a shade darker', one.ps5.case === '#14233f' && one.xone.case === '#14233f' && one.ps5.side !== one.ps5.case, JSON.stringify(one));
    // one console on its own: Xbox One green again by its own setting? set it to Green through the per-console page
    await page.evaluate(() => Setup.open({ page: 'pc' })); await page.waitForTimeout(1500);
    await click(page, 'Box color per console'); await page.waitForTimeout(800);
    await page.evaluate(() => { const r = [...document.querySelectorAll('#bss .bss-row')].find(x => ((x.querySelector('.nm') || {}).textContent || '') === 'Xbox One'); r.click(); });
    for (let i = 0; i < 6; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150); } // Same as above → … → Green (the 6th)
    await page.evaluate(() => Settings.close()); await page.waitForTimeout(2500);
    const per = await st();
    check('A colour for one console: Xbox One boxes green, PS5 still the colour for all', per.xone.case === '#107c10' && per.ps5.case === '#14233f', JSON.stringify(per));
    check('No script errors', !errors.length, errors.slice(0, 3).join(' | '));
  } catch (e) { check('the test ran to the end', false, e && e.stack); }
  await browser.close(); server.close();
  console.log(fails ? fails + ' check(s) failed' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
});
