// Issue 19: comparative museum measurements, same library / runtime / viewport.
// Classic wall vs rooms (manufacturer): cold-open time, scene counts, per-frame work, room-switch cost,
// and the counts after visiting rooms repeatedly (caches settled).
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const WWW = path.resolve(process.argv[2] || 'www'), OUT = path.resolve(process.argv[3] || '../out');
const BIG = +(process.env.BIG || 300);
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? '✅ ' : '❌ ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 700))); if (!ok) fails++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary' };
const server = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const p = path.join(WWW, u === '/' ? 'index.html' : u);
  if (!p.startsWith(WWW)) { r.writeHead(403); return r.end(); }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
const w = ms => new Promise(r => setTimeout(r, ms));
const avg = o => o.n ? Math.round(o.js / o.n) : 0, mx = o => o.jsMax || 0; // _perf(): running totals → per-frame average and worst
async function run(browser, grouping, big, url) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }), page = await ctx.newPage(), errs = [];
  page.on('pageerror', e => errs.push(e.message));
  const openMs = [];
  page.on('console', m => { const t = /museum open: build\+shaders (\d+) ms/.exec(m.text()); if (t) openMs.push(+t[1]); });
  await page.goto(url); await w(6500);
  if (grouping) await page.evaluate(g => Shelf._mus.set('grouping', g), grouping);
  const t0 = Date.now();
  await page.keyboard.press('m'); await w(9000);
  await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); for (let i = 0; i < 10 && Museum._dv && Museum._dv(); i++) { Museum.skipDelivery(); await w(350); } if (Museum.skipFill) Museum.skipFill(); await w(1200); });
  const cold = Date.now() - t0;
  // settle: let covers/spines/uploads drain, then measure frame work over 3 s of viewing
  await page.evaluate(() => Museum._perf && Museum._perf(true)); await w(2500);
  await page.evaluate(() => Museum._perf && Museum._perf(true)); await w(3000);
  const perf = await page.evaluate(() => { const o = Museum._perf(); const s = Museum.stats(); return { js: o.js, jsMax: o.jsMax, up: o.up, fr: o.fr, sp: o.sp, sh: o.sh, n: o.n, calls: s.calls, tris: s.triangles, geos: s.geos, texs: s.texs, progs: s.progs, lights: s.lights, shadowL: s.shadowLights }; });
  // visit rooms repeatedly (20 round trips) — the caches settle, counts must not climb
  const roomsTour = await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); if (!Museum.rooms || !Museum.rooms()) return null;
    const n = Museum.rooms().rooms; for (let i = 0; i < Math.min(24, n * 2); i++) { Museum.stepRoom(1); await w(650); } for (let i = 0; i < Math.min(24, n * 2); i++) { Museum.stepRoom(1); await w(650); }
    await w(2500); const s = Museum.stats(); return { geos: s.geos, texs: s.texs, lights: s.lights, rooms: n, upQ: Museum._cam().upQ }; });
  const shot = `${grouping || 'classic'}-big${big}.png`;
  await page.screenshot({ path: path.join(OUT, shot) });
  await ctx.close();
  return { grouping: grouping || 'classic', openMs, cold, perf, roomsTour, errs };
}
server.listen(0, async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const port = server.address().port, base = `http://localhost:${port}/index.html?platform=windows&shelf=1&big=${BIG}`;
    const classic = await run(browser, null, BIG, base);
    const rooms = await run(browser, 'manufacturer', BIG, base);
    const report = [];
    const row = (k, a, b) => report.push(`${k}: classic=${a} rooms=${b}`);
    report.push(`library: ${BIG} games per console (mock), viewport 1280x720, SwiftShader`);
    report.push(`cold open (press m → playable): classic=${classic.cold} ms rooms=${rooms.cold} ms`);
    report.push(`build+shaders log: classic=${classic.openMs.join(',')} rooms=${rooms.openMs.join(',')}`);
    report.push(`scene geos/texs: classic=${classic.perf.geos}/${classic.perf.texs} rooms=${rooms.perf.geos}/${rooms.perf.texs}`);
    report.push(`draw calls/tris at rest: classic=${classic.perf.calls}/${classic.perf.tris} rooms=${rooms.perf.calls}/${rooms.perf.tris}`);
    report.push(`lights: classic=${classic.perf.lights} rooms=${rooms.perf.lights}`);
    report.push(`frame work over 3 s (per-frame avg, max): classic=${avg(classic.perf)}/${mx(classic.perf)} ms rooms=${avg(rooms.perf)}/${mx(rooms.perf)} ms`);
    report.push(`uploads/covers/spines over 3 s: classic=${classic.perf.up}/${classic.perf.fr}/${classic.perf.sp} rooms=${rooms.perf.up}/${rooms.perf.fr}/${rooms.perf.sp}`);
    if (rooms.roomsTour) report.push(`after ${rooms.roomsTour.rooms * 4} room visits: geos=${rooms.roomsTour.geos} texs=${rooms.roomsTour.texs} lights=${rooms.roomsTour.lights} upQ=${rooms.roomsTour.upQ}`);
    report.push(`page errors: classic=${classic.errs.length} rooms=${rooms.errs.length}`);
    console.log(report.join('\n'));
    fs.writeFileSync(path.join(OUT, 'museum-bench.txt'), report.join('\n') + '\n');
    check('no script errors in either mode', !classic.errs.length && !rooms.errs.length, [...classic.errs, ...rooms.errs].join(' | '));
    check('rooms mode keeps the active scene bounded (no more geometry than the classic wall of the same library)', rooms.perf.geos <= classic.perf.geos * 1.15, `classic ${classic.perf.geos} rooms ${rooms.perf.geos}`);
  } catch (e) { check('the bench ran to the end', false, e && e.stack); }
  await browser.close(); server.close();
  console.log(fails ? fails + ' check(s) failed' : 'bench done'); process.exit(0);
});
