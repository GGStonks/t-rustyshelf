// Inspect's cases and media (ported from upstream beta.11, sassiestrhihno), on the demo page as Windows (?dos=1: DOS and
// Xbox 360 shelves with games). Run (after node copy-web.js): node ci/media-test.js www ../out/media
//   - Xbox 360: one printed sheet wraps front, spine and back (no border on the spine side); other cases keep theirs
//   - a disc out of its case spins about its own centre on Windows too ("Spin"), and the printed spine is on the 3D case
//   - DOS games come on a 3.5" floppy disk: the case opens on a floppy ("Take out floppy disk", "Floppy out"), handled
//     like a cartridge (it doesn't spin)
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const WWW = path.resolve(process.argv[2] || 'www'), OUT = path.resolve(process.argv[3] || '../out/media');
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? '✅ ' : '❌ ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 500))); if (!ok) fails++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wasm': 'application/wasm' };
const server = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const p = path.join(WWW, u === '/' ? 'index.html' : u);
  if (!p.startsWith(WWW)) { r.writeHead(403); return r.end(); }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
server.listen(0, async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const base = `http://localhost:${server.address().port}/index.html?platform=windows&shelf=1&dos=1`;
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }), page = await ctx.newPage(), errors = [];
    // a pretend controller: R3 (button 11) opens Inspect (the keyboard has no key for it)
    await page.addInitScript(() => { const pad = window.__pad = { id: 'test pad', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
      Navigator.prototype.getGamepads = function () { return [pad, null, null, null]; }; });
    const r3 = () => page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); __pad.buttons[11] = { pressed: true, touched: true, value: 1 }; __pad.timestamp++; await w(250); __pad.buttons[11] = { pressed: false, touched: false, value: 0 }; __pad.timestamp++; await w(200); });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base); await page.waitForTimeout(6000);
    const tabs = await page.evaluate(() => [...document.querySelectorAll('#tabs .tab')].map(t => t.textContent.trim()));
    // a shelf by its tab, and the spine-side border of the case selected there
    const shelf = name => page.evaluate(async name => { const w = ms => new Promise(r => setTimeout(r, ms)), t = [...document.querySelectorAll('#tabs .tab')].find(x => x.textContent.trim() === name);
      if (!t) return null; t.click(); await w(1800); const s = document.querySelector('#track .slot:not(.far)'); if (!s) return { none: true };
      const cs = getComputedStyle(s); return { edgeIn: parseFloat(cs.getPropertyValue('--edge-in')) || 0, edge: parseFloat(cs.getPropertyValue('--edge')) || 0, padL: parseFloat(getComputedStyle(s.querySelector('.f-front') || s).paddingLeft) || 0 }; }, name);
    const x360 = await shelf('Xbox 360'), gc = await shelf('GameCube');
    check('Xbox 360: the cover runs round the spine (no border on that side); GameCube keeps its border', x360 && x360.edge > 0 && x360.edgeIn === 0 && x360.padL === 0 && gc && gc.edgeIn > 0, JSON.stringify({ tabs, x360, gc }));
    // Inspect on the GameCube shelf: open, disc out
    const insp = async () => page.evaluate(() => { const el = document.getElementById('inspect'); return { on: el.classList.contains('on'), cls: [...el.classList].filter(c => ['cart', 'floppy', 'umd'].includes(c)), step: (document.getElementById('ispStep') || {}).textContent, text: el.innerText.replace(/\s+/g, ' '), spine: window.Inspect3D && Inspect3D._st ? Inspect3D._st().spine : null }; });
    await r3(); await page.waitForTimeout(3000);
    const g0 = await insp();
    await page.keyboard.press('Enter'); await page.waitForTimeout(1500); await page.keyboard.press('Enter'); await page.waitForTimeout(1800);
    const g2 = await insp();
    await page.screenshot({ path: path.join(OUT, 'gc-disc-out.png') });
    check('A disc out of its case spins on Windows too', g0.on && g2.step === 'Disc out' && /Spin/.test(g2.text) && !/Next side/.test(g2.text), JSON.stringify({ step: g2.step, text: g2.text.slice(0, 200) }));
    check('The printed spine is on the 3D case', g0.spine !== false, JSON.stringify({ spine: g0.spine }));
    for (let i = 0; i < 4 && await page.evaluate(() => document.getElementById('inspect').classList.contains('on')); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(1200); }
    await page.waitForFunction(() => !document.getElementById('inspect').classList.contains('on'), null, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(1500);
    // DOS: a floppy disk
    const dos = await shelf('DOS');
    await r3(); await page.waitForTimeout(3000);
    const d0 = await insp();
    await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
    const d1 = await insp();
    await page.keyboard.press('Enter'); await page.waitForTimeout(1800);
    const d2 = await insp();
    await page.screenshot({ path: path.join(OUT, 'dos-floppy-out.png') });
    check('DOS: Inspect opens on a floppy disk, handled like a cartridge', !!dos && d0.on && d0.cls.includes('cart') && d0.cls.includes('floppy'), JSON.stringify({ dos, cls: d0.cls }));
    check('DOS: the case says "Take out floppy disk", then "Floppy out" (and the floppy doesn\'t spin)', /Take out floppy disk/.test(d1.text) && d2.step === 'Floppy out' && !/Spin/.test(d2.text), JSON.stringify({ d1: d1.text.slice(0, 160), step: d2.step, d2: d2.text.slice(0, 160) }));
    check('No script errors', !errors.length, errors.slice(0, 3).join(' | '));
    await ctx.close();
  } catch (e) { check('The test ran to the end', false, e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e); }
  await browser.close(); server.close();
  console.log(fails ? `\n${fails} failed` : '\nAll passed'); process.exit(fails ? 1 : 0);
});
