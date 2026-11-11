// Boxshelf beta issues 31 and 32: the DS box was too narrow for its cover (DS box art is about 512 x 460, the box was
// drawn 0.9 wide, so the sides of every cover were cut off), and the DS cartridge showed its gold contacts on both faces.
// On the demo page. Run (after node copy-web.js): node ci/dscase-test.js www ../out/dscase
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const WWW = path.resolve(process.argv[2] || 'www'), OUT = path.resolve(process.argv[3] || '../out/dscase');
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
    const c = await page.evaluate(() => ({ nds: Shelf._caseOf('nds'), n3ds: Shelf._caseOf('n3ds') }));
    const art = 512 / 460, area = o => (o.ratio - o.edgeIn - o.edge) / (1 - 2 * o.edge); // the cover's window on the front: the box less its borders
    check('the DS box is wider than tall, like the 3DS case it is the same size as', c.nds && c.nds.ratio > 1 && Math.abs(c.nds.ratio - c.n3ds.ratio) < .05 && c.nds.h === c.n3ds.h, JSON.stringify(c));
    check('a DS cover (about 512 x 460) fills the front within 3%, the sides no longer cut off', c.nds && Math.abs(area(c.nds) / art - 1) < .03, c.nds && area(c.nds).toFixed(3) + ' vs ' + art.toFixed(3));
    check('no page errors', !errors.length, errors.join(' | '));
    // the cartridge: its contacts are a thin strip on the back, not a block through it (Inspect and the museum)
    const isp = fs.readFileSync(path.join(WWW, 'inspect3d.js'), 'utf8'), mus = fs.readFileSync(path.join(WWW, 'museum.js'), 'utf8');
    const ip = /const pins = new THREE\.Mesh\(new THREE\.BoxGeometry\(cw \* \.7, ch \* \.12, ([^)]+)\)[^;]*;\s*pins\.position\.set\(0, [^,]+, ([^)]+)\)/.exec(isp);
    check('Inspect: the cartridge\'s contacts are a thin strip behind its back face only', ip && /^\.\d+$/.test(ip[1]) && +ip[1] < .005 && /^-cd \/ 2/.test(ip[2]), ip && ip.slice(1).join(' | '));
    const mp = /const pins = mesh\(new THREE\.BoxGeometry\(cw \* \.7, ch \* \.1, ([^)]+)\)[^;]*;[^;]*;\s*pins\.position\.set\(0, [^,]+, ([^)]+)\)/.exec(mus);
    check('Museum: the same, the label side (front) left clear', mp && +mp[1] < .005 && +mp[2] < 0, mp && mp.slice(1).join(' | '));
    await page.screenshot({ path: path.join(OUT, 'dscase.png') });
  } catch (e) { check('the test ran to the end', false, e && e.stack); }
  await browser.close(); server.close();
  console.log(fails ? fails + ' check(s) failed' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
});
