// The museum's file box: picking up the issue you're on out of its fan (ported from upstream beta.11, sassiestrhihno), on
// the demo page as Windows. Run (after node copy-web.js): node ci/fanlift-test.js www ../out/fanlift
//   - a run of three issues of one magazine sits in a file box on the reading corner's rack; A fans them out
//   - P (Y on a controller) lifts the issue you're on into your hands: the fan is no longer what you hold, the museum's
//     current item is that issue, and the hints offer "Pick up" while the fan is open
//   - B puts it back at once, even when the museum isn't drawing (the stand-in used to wait for the next drawn frame and
//     could be left in the rack), and the fan is back in your hands
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const WWW = path.resolve(process.argv[2] || 'www'), OUT = path.resolve(process.argv[3] || '../out/fanlift');
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? '✅ ' : '❌ ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 500))); if (!ok) fails++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wasm': 'application/wasm' };
const server = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const p = path.join(WWW, u === '/' ? 'index.html' : u);
  if (!p.startsWith(WWW)) { r.writeHead(403); return r.end(); }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
server.listen(0, async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const base = `http://localhost:${server.address().port}/index.html?platform=windows&shelf=1`;
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }), page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base); await page.waitForTimeout(5000);
    // three issues of one magazine (a file box) and a one-off
    await page.evaluate(() => { const mag = (n, y) => ({ id: 'np-' + n, kind: 'magazine', type: 'file', title: `Nintendo Power Issue ${n} (${y})`, series: 'Nintendo Power', year: y });
      window.trustyshelf.library = async () => [mag('001', 1988), mag('002', 1988), mag('003', 1989), { id: 'gp-1', kind: 'magazine', type: 'file', title: 'GamePro 1994-05', series: '', year: 1994 }]; });
    await page.keyboard.press('m'); await page.waitForTimeout(5000);
    await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); for (let i = 0; i < 6 && window.Museum && Museum._dv && Museum._dv(); i++) { Museum.skipDelivery(); await w(800); } if (Museum.isFilling && Museum.isFilling()) Museum.skipFill(); });
    const boxed = await page.waitForFunction(() => ((window.Museum && Museum._rack && Museum._rack()) || []).some(x => x.box && x.box.issues.length === 3), null, { timeout: 60000, polling: 200 }).then(() => true, () => false);
    check('The three issues are one file box on the rack', boxed);
    // walk to the box and fan it out
    const fanned = await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)), it = Museum._rack().find(x => x.box); if (!it) return 'no box';
      const k = () => { const c = Museum.current() || {}; return c.stack ? 'stack' : c.fan ? 'fan' : c.lib ? 'lib:' + c.lib.title : c.wide ? 'wide:' + c.wide.label : 'other'; };
      Museum.setRow(it.ri); await w(500);
      for (let i = 0; i < 12 && !/^stack|^wide:Magazines/.test(k()); i++) { Museum.move(1, 0); await w(500); }
      if (/^wide:/.test(k())) { Museum.activate(); await w(1200); for (let i = 0; i < 6 && k() !== 'stack'; i++) { Museum.move(1, 0); await w(500); } }
      return k() === 'stack' ? 'stack' : 'at ' + k(); });
    // Enter (A), as a player opens it: the app's own handler, which also redraws the hints
    if (fanned === 'stack') { await page.keyboard.press('Enter'); await page.waitForTimeout(2000); }
    const isFan = await page.evaluate(() => Museum.handState().fan);
    check('A on the file box fans the issues out', isFan, fanned);
    const hint = await page.evaluate(() => (document.getElementById('musHints') || {}).innerText || '');
    check('The fan\'s hints offer "Pick up"', /Pick up/.test(hint), hint.replace(/\s+/g, ' '));
    // P: the issue you're on, into your hands
    const want = await page.evaluate(() => (Museum.current() || {}).lib && Museum.current().lib.title);
    await page.keyboard.press('p'); await page.waitForTimeout(1500);
    const up = await page.evaluate(() => { const h = Museum.handState(), c = Museum.current() || {}; return { libHeld: h.libHeld, fan: h.fan, lib: c.lib && c.lib.title, temps: Museum._rack().filter(x => x.temp).length }; });
    await page.screenshot({ path: path.join(OUT, 'picked-up.png') });
    check('P lifts the issue you\'re on into your hands (one stand-in on the rack; the fan isn\'t what you hold)', up.libHeld && !up.fan && up.lib === want && up.temps === 1, JSON.stringify({ ...up, want }));
    // B with the museum not drawing: the stand-in still goes at once
    const down = await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); Museum.setPaused(true, 'test'); Museum.back(); const at = { temps: Museum._rack().filter(x => x.temp).length, libHeld: Museum.handState().libHeld };
      Museum.setPaused(false, 'test'); await w(800); return { ...at, fan: Museum.handState().fan }; });
    check('B puts it back at once, even with the museum paused, and the fan is back', down.temps === 0 && !down.libHeld && down.fan, JSON.stringify(down));
    check('No script errors', !errors.length, errors.slice(0, 3).join(' | '));
    await ctx.close();
  } catch (e) { check('The test ran to the end', false, e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e); }
  await browser.close(); server.close();
  console.log(fails ? `\n${fails} failed` : '\nAll passed'); process.exit(fails ? 1 : 0);
});
