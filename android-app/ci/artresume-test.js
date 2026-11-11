// (T)rustyShelf issue 14: one press for box art. A download that stopped part way is offered as "Resume box art download"
// (same consoles and parts); with nothing to resume, "Get all missing art" gets every console still missing something.
// On the demo page. Run (after node copy-web.js): node ci/artresume-test.js www ../out/artresume
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const WWW = path.resolve(process.argv[2] || 'www'), OUT = path.resolve(process.argv[3] || '../out/artresume');
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? '✅ ' : '❌ ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 500))); if (!ok) fails++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary' };
const server = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const p = path.join(WWW, u === '/' ? 'index.html' : u);
  if (!p.startsWith(WWW)) { r.writeHead(403); return r.end(); }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
// the row named name on the open Settings page: { found, sub, btn }, and clicks it when asked
const row = (page, name, click) => page.evaluate(async ([name, click]) => { const w = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 30 && !document.querySelector('#bss .bss-row'); i++) await w(150);
  const r = [...document.querySelectorAll('#bss .bss-row')].find(x => ((x.querySelector('.nm') || {}).textContent || '') === name);
  if (!r) return { found: false, names: [...document.querySelectorAll('#bss .bss-row .nm')].map(x => x.textContent).slice(0, 30) };
  const out = { found: true, text: r.textContent }; if (click) r.click(); return out; }, [name, !!click]);
server.listen(0, async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }), page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/index.html?platform=windows&shelf=1`); await page.waitForTimeout(5000);
    // a download that stopped part way: GameCube covers and backs
    const sys = await page.evaluate(async () => { const api = window.trustyshelf; const cov = await api.artCoverage(); const id = cov[0].id;
      const c = (await api.getConfig()).config; c.ui.artResume = { plan: { [id]: ['front', 'back'] }, at: Date.now() - 3600e3 }; await api.saveConfig(c);
      window.__dl = []; const real = api.downloadCovers; api.downloadCovers = async (ids, plan, hd) => { window.__dl.push({ ids, plan }); return real(ids, plan, hd); }; return { id, n: cov.length }; });
    await page.evaluate(() => Setup.open({ page: 'art' })); await page.waitForTimeout(1500);
    const r1 = await row(page, 'Resume box art download');
    check('A download stopped part way is offered as "Resume box art download", with what it has left', r1.found && /Stopped part way · 1 console/.test(r1.text), JSON.stringify(r1));
    await page.screenshot({ path: path.join(OUT, 'artresume.png') });
    await row(page, 'Resume box art download', true); await page.waitForTimeout(2500);
    const d1 = await page.evaluate(() => window.__dl[0] || null);
    check('One press resumes it: the same console and the same parts, nothing else', !!d1 && d1.ids.length === 1 && d1.ids[0] === sys.id && JSON.stringify(d1.plan[sys.id]) === '["front","back"]', JSON.stringify(d1));
    await page.waitForTimeout(1500);
    const left = await page.evaluate(async () => (await window.trustyshelf.getConfig()).config.ui.artResume || null);
    check('Once it finishes there is nothing left to resume', left == null, JSON.stringify(left));
    // nothing to resume: Get all missing art, every console still missing something, all four parts
    await page.evaluate(() => Settings.close()); await page.waitForTimeout(800);
    await page.evaluate(() => Setup.open({ page: 'art' })); await page.waitForTimeout(1500);
    const r2 = await row(page, 'Get all missing art', true); await page.waitForTimeout(2500);
    const d2 = await page.evaluate(() => window.__dl[1] || null);
    check('With nothing to resume, "Get all missing art" gets every console still missing art, all four parts', r2.found && !!d2 && d2.ids.length === sys.n && d2.ids.every(id => (d2.plan[id] || []).length === 4), JSON.stringify({ r2: r2.found, d2 }));
    check('No script errors', !errors.length, errors.slice(0, 3).join(' | '));
  } catch (e) { check('the test ran to the end', false, e && e.stack); }
  await browser.close(); server.close();
  console.log(fails ? fails + ' check(s) failed' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
});
