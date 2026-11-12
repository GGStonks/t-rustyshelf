// Boxshelf beta issue 30 (a later comment): with more than ten shelves the museum is lit by three lamps that follow the row
// (issue 17), and in the wide view they stayed on the last shelf you'd been on. They follow the gold frame there too, and
// the row and the game you're on up close. On the demo page. Run (after node copy-web.js): node ci/lamppool-test.js www ../out/lamppool
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const WWW = path.resolve(process.argv[2] || 'www'), OUT = path.resolve(process.argv[3] || '../out/lamppool');
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? '✅ ' : '❌ ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 600))); if (!ok) fails++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary' };
const server = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const p = path.join(WWW, u === '/' ? 'index.html' : u);
  if (!p.startsWith(WWW)) { r.writeHead(403); return r.end(); }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
server.listen(0, async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/index.html?platform=windows&shelf=1&big=300`); await page.waitForTimeout(6000);
    await page.keyboard.press('m'); await page.waitForTimeout(6000);
    await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); for (let i = 0; i < 8 && Museum._dv && Museum._dv(); i++) { Museum.skipDelivery(); await w(600); } if (Museum.skipFill) Museum.skipFill(); await w(1500); });
    const W = () => page.evaluate(() => Museum._wall());
    const key = async k => { await page.keyboard.press(k); await page.waitForTimeout(1500); };
    const rowY = async i => { const w = await W(); return w; };
    await key('Enter'); await key('ArrowDown'); await key('ArrowDown'); await key('ArrowDown');
    let w = await W();
    check('a big library: three shared lamps, the middle one on the row you\'re on', w.pooled && w.pool && w.pool.length === 3 && w.want && Math.abs(w.pool[1].y - w.want.y) < .01, JSON.stringify(w.pool) + ' ' + JSON.stringify(w.want));
    await key('ArrowRight'); await key('ArrowRight'); w = await W();
    check('…and its light follows the game you\'re on', w.pool.some(p => Math.abs(p.x - w.want.x) < .05 && Math.abs(p.y - w.want.y) < .01), JSON.stringify(w.pool) + ' ' + JSON.stringify(w.want));
    await key('Escape'); const w0 = await W();
    await key('ArrowDown'); await key('ArrowDown'); await key('ArrowDown'); const w1 = await W();
    const ys0 = w0.pool.map(p => p.y), ys1 = w1.pool.map(p => p.y);
    check('in the wide view the lamps follow the gold frame to other shelves (they stayed on the last one you\'d been on)', w1.wide && w1.wideSel === w0.wideSel + 3 && w1.rowI === w0.rowI && ys1[1] < ys0[1] - 3, JSON.stringify({ sel: [w0.wideSel, w1.wideSel], ys0, ys1 }));
    await page.screenshot({ path: path.join(OUT, 'lamppool.png') });
    check('no page errors', !errors.length, errors.join(' | '));
  } catch (e) { check('the test ran to the end', false, e && e.stack); }
  await browser.close(); server.close();
  console.log(fails ? fails + ' check(s) failed' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
});
