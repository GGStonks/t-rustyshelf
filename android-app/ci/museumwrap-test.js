// (T)rustyShelf issue 17: the museum with a big library. A console with more than 120 games continues on the shelves below
// (evenly split, the plaque says which part), the wall no longer stretches with the biggest console, and past ten shelves
// three picture lights follow the row in view instead of one spot light per row. On the demo page (?big= gives every
// console that many games). Run (after node copy-web.js): node ci/museumwrap-test.js www ../out/museumwrap
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const WWW = path.resolve(process.argv[2] || 'www'), OUT = path.resolve(process.argv[3] || '../out/museumwrap');
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? '✅ ' : '❌ ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 600))); if (!ok) fails++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary' };
const server = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const p = path.join(WWW, u === '/' ? 'index.html' : u);
  if (!p.startsWith(WWW)) { r.writeHead(403); return r.end(); }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
const visit = async (browser, big) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }), page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://localhost:${server.address().port}/index.html?platform=windows&shelf=1&big=${big}`); await page.waitForTimeout(6000);
  await page.keyboard.press('m'); await page.waitForTimeout(6000);
  await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 8 && Museum._dv && Museum._dv(); i++) { Museum.skipDelivery(); await w(600); } if (Museum.skipFill) Museum.skipFill(); await w(1500); });
  const info = await page.evaluate(() => { const W = Museum._wall(); return { rows: W.rows, total: W.rows.length, lights: W.lights, pooled: W.pooled }; });
  await page.screenshot({ path: path.join(OUT, `museum-big${big}.png`) });
  await ctx.close(); return { info, errors };
};
server.listen(0, async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const big = await visit(browser, 300), R = big.info.rows;
    const byId = {}; R.forEach((r, i) => { (byId[r.id] = byId[r.id] || []).push({ ...r, i }); });
    const ids = Object.keys(byId), parts = ids.map(id => byId[id]);
    check('A console with 300 games goes on 3 shelves of 100, one after another, its plaque naming the part', parts.length > 0 && parts.every(p => p.length === 3 && p.every(r => r.n === 100) && p[1].i === p[0].i + 1 && p[2].i === p[0].i + 2 && /· 1 of 3$/.test(p[0].name) && /· 3 of 3$/.test(p[2].name)), JSON.stringify(R.slice(0, 6)));
    check('No shelf holds more than 120 games', R.every(r => r.n <= 120), JSON.stringify(R.map(r => r.n)));
    console.log('  wall:', JSON.stringify({ shelves: big.info.total, lights: big.info.lights })); check('Past ten shelves the room is lit by three lights that follow the row, not one per shelf', big.info.total > 10 && big.info.pooled === true && big.info.lights < big.info.total, JSON.stringify({ shelves: big.info.total, lights: big.info.lights, pooled: big.info.pooled }));
    const small = await visit(browser, 0), S = small.info.rows;
    check('A small library keeps one shelf per console, named as before', S.length > 0 && S.every(r => !/ of \d+$/.test(r.name)) && new Set(S.map(r => r.id)).size === S.length && small.info.pooled === (S.length > 10), JSON.stringify({ rows: S.slice(0, 4), n: S.length, pooled: small.info.pooled }));
    check('No script errors', !big.errors.length && !small.errors.length, [...big.errors, ...small.errors].slice(0, 3).join(' | '));
  } catch (e) { check('the test ran to the end', false, e && e.stack); }
  await browser.close(); server.close();
  console.log(fails ? fails + ' check(s) failed' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
});
