// (T)rustyShelf manual sorting with the mouse (Boxshelf beta discussion 19): a quick drag across the shelf scrolls it and never
// grabs a box; a drag and drop that ends leaves no scrolling behind; Custom can be left for A-Z (and the others) from the Sort
// panel. On the demo page. Run (after node copy-web.js): node ci/sortdrag-test.js www ../out/sortdrag
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const WWW = path.resolve(process.argv[2] || 'www'), OUT = path.resolve(process.argv[3] || '../out/sortdrag');
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? '✅ ' : '❌ ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 500))); if (!ok) fails++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary' };
const server = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const p = path.join(WWW, u === '/' ? 'index.html' : u);
  if (!p.startsWith(WWW)) { r.writeHead(403); return r.end(); }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
server.listen(0, async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }), page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/index.html?platform=windows&shelf=1`); await page.waitForTimeout(5000);
    const state = () => page.evaluate(() => Shelf._sort.state());
    // a quick drag across the shelf from a box that isn't the selected one
    const s0 = await state();
    const box = await page.evaluate(() => Shelf._sort.box(2) || Shelf._sort.box(1));
    await page.mouse.move(box.x, box.y); await page.mouse.down();
    for (let i = 1; i <= 12; i++) { await page.mouse.move(box.x - i * 40, box.y); await page.waitForTimeout(15); }
    await page.mouse.up(); await page.waitForTimeout(600);
    const s1 = await state();
    check('A quick drag across the shelf scrolls it and grabs no box (order and Custom list unchanged)', s1.sel !== s0.sel && s1.order === s0.order && s1.custom === s0.custom, JSON.stringify({ s0, s1 }));
    // a drag and drop the browser ends (no pointerup comes after one): the shelf doesn't keep scrolling with the mouse
    await page.mouse.move(box.x, box.y); await page.mouse.down(); await page.waitForTimeout(50);
    await page.evaluate(() => { dispatchEvent(new Event('dragend')); });
    const before = (await state()).sel; for (let i = 1; i <= 10; i++) await page.mouse.move(box.x - i * 50, box.y);
    const s2 = await state(); await page.mouse.up();
    check('After a drag and drop ends, moving the mouse no longer scrolls the shelf', !s2.drag && s2.sel === before, JSON.stringify({ before, s2 }));
    // a press held still before moving picks the box up (the browser's drag can start); a quick one can't
    const gate = await page.evaluate(() => ({ quick: Shelf._sort.probe(false), held: Shelf._sort.probe(true) }));
    check('A box is picked up only after a press held still; picking it up stops the shelf scroll', gate.quick.prevented === true && gate.held.prevented === false && gate.held.after === false, JSON.stringify(gate));
    // Custom, then back to A-Z from the Sort panel, also right after a rescan
    await page.evaluate(() => Shelf._sort.pick('custom')); await page.waitForTimeout(200);
    await page.keyboard.press('g'); await page.waitForTimeout(500);
    await page.evaluate(() => { const b = [...document.querySelectorAll('#spSort .sp-opt')].find(x => x.textContent === 'A–Z'); b.click(); });
    const mem = await page.evaluate(() => Shelf._sort.state());
    await page.keyboard.press('Escape'); await page.waitForTimeout(800);
    check('Custom can be left for A–Z from the Sort panel, and the choice holds at once (a rescan reads it back)', mem.sort === 'az' && mem.cfg === 'az', JSON.stringify(mem));
    await page.screenshot({ path: path.join(OUT, 'sortdrag.png') });
    check('No script errors', !errors.length, errors.slice(0, 3).join(' | '));
  } catch (e) { check('the test ran to the end', false, e && e.stack); }
  await browser.close(); server.close();
  console.log(fails ? fails + ' check(s) failed' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
});
