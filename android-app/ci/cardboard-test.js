// beta issue 40: SNES and Game Boy Advance boxes (every printed card box) showed a thin case-coloured frame round the cover,
// as if it sat in a plastic case. A card box has its cover printed right to the edges; the plastic cases keep their frame.
// On the demo page. Run (after node copy-web.js): node ci/cardboard-test.js www ../out/cardboard
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const WWW = path.resolve(process.argv[2] || 'www'), OUT = path.resolve(process.argv[3] || '../out/cardboard');
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? '✅ ' : '❌ ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 500))); if (!ok) fails++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary' };
const server = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const p = path.join(WWW, u === '/' ? 'index.html' : u);
  if (!p.startsWith(WWW)) { r.writeHead(403); return r.end(); }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
server.listen(0, async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/index.html?platform=windows&shelf=1&wave2=1`); await page.waitForTimeout(5000);
    const card = ['snes', 'gba', 'nes', 'n64', 'gb', 'gbc'], cases = ['gc', 'ps2', 'wii', 'psp'];
    const c = await page.evaluate(ids => Object.fromEntries(ids.map(id => [id, Shelf._caseOf(id)])), [...card, ...cases]);
    check('card boxes (SNES, GBA, NES, N64, Game Boy): no frame round the cover', card.every(id => c[id] && c[id].edge === 0), JSON.stringify(card.map(id => [id, c[id] && c[id].edge])));
    check('plastic cases keep their frame', cases.every(id => c[id] && c[id].edge > 0), JSON.stringify(cases.map(id => [id, c[id] && c[id].edge])));
    check('no page errors', !errors.length, errors.join(' | '));
  } catch (e) { check('ran without throwing', false, e.stack); }
  finally { await browser.close(); server.close(); console.log(fails ? `\n${fails} FAILED` : '\nall passed'); process.exit(fails ? 1 : 0); }
});
