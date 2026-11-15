// (T)rustyShelf issue 27: a case's spine is as tall as its box on every console's shelf (since 1.6.1 it stuck out below
// it: the spine's frame caps were padding on top of its full height). Also, inside a case in Inspect: the modelled cases'
// booklet clips are clear plastic (they covered the booklet's art as solid blocks), and a disc game in the card case
// doesn't show that case's booklet under its disc.
// On the demo page. Run (after node copy-web.js): node ci/spinefit-test.js www ../out/spinefit
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const WWW = path.resolve(process.argv[2] || 'www'), OUT = path.resolve(process.argv[3] || '../out/spinefit');
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? '✅ ' : '❌ ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 700))); if (!ok) fails++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary' };
const server = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const p = path.join(WWW, u === '/' ? 'index.html' : u);
  if (!p.startsWith(WWW)) { r.writeHead(403); return r.end(); }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
server.listen(0, async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } }), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/index.html?platform=windows&shelf=1&wave2=1&every=1`);
    await page.waitForFunction(() => window.Shelf && Shelf.getMode && Shelf.getMode() === 'browse' && document.querySelector('.slot .f-left'), null, { timeout: 60000, polling: 250 });
    await page.waitForTimeout(1500);
    const bad = [], seen = [];
    for (let k = 0; k < 14; k++) {
      const r = await page.evaluate(() => { const sys = (document.getElementById('sysWord') || {}).textContent || '', out = [];
        document.querySelectorAll('.slot').forEach(sl => { const f = sl.querySelector('.f-front'), l = sl.querySelector('.f-left'); if (f && l && f.offsetHeight) out.push([f.offsetHeight, l.offsetHeight]); });
        return { sys, out }; });
      if (seen.includes(r.sys)) break; seen.push(r.sys);
      const off = r.out.filter(([f, l]) => Math.abs(f - l) > 1); if (off.length) bad.push(r.sys + ': ' + JSON.stringify(off.slice(0, 2)));
      await page.keyboard.press('ArrowDown'); await page.waitForTimeout(1400);
    }
    check('every console\'s spines are as tall as their boxes', seen.length >= 4 && !bad.length, JSON.stringify({ seen: seen.length, bad }));
    const src = fs.readFileSync(path.join(WWW, 'inspect3d.js'), 'utf8');
    check('Inspect: the modelled cases\' booklet clips are clear plastic, not solid blocks over the booklet', /\/Clip\/\.test\(n\.name \|\| ''\)\) \{ n\.material = clear;/.test(src) && /opacity: \.28/.test(src));
    check('Inspect: a disc game in the card case doesn\'t show that case\'s booklet under its disc', /if \(disc && names\.includes\('Booklet'\)\) \{ n\.visible = false;/.test(src));
    check('no page errors', !errors.length, errors.slice(0, 3).join(' | '));
  } catch (e) { check('ran without throwing', false, e.stack); }
  finally { await browser.close(); server.close(); console.log(fails ? `\n${fails} FAILED` : '\nall passed'); process.exit(fails ? 1 : 0); }
});
