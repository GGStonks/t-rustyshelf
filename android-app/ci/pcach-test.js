// (T)rustyShelf: a Steam game's achievements in its Details ((T)rustyShelf discussion 22), on the demo page as Windows.
// Run (after node copy-web.js): node ci/pcach-test.js www ../out/pcach
//   - Details of a Steam game Steam has achievements cached for shows the row: 2 of 4 unlocked, Steam
//   - See all opens the list (Unlocked 2, Locked 2), with no points
//   - a Steam game without any shows no row
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const WWW = path.resolve(process.argv[2] || 'www'), OUT = path.resolve(process.argv[3] || '../out/pcach');
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? '✅ ' : '❌ ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 500))); if (!ok) fails++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary' };
const server = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const p = path.join(WWW, u === '/' ? 'index.html' : u);
  if (!p.startsWith(WWW)) { r.writeHead(403); return r.end(); }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });

server.listen(0, async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const base = `http://localhost:${server.address().port}/index.html?platform=windows&shelf=1`;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }), page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message)); await page.goto(base); await page.waitForTimeout(5000);
    await page.evaluate(async () => { const c = (await trustyshelf.getConfig()).config; c.steam = { ...c.steam, enabled: true, path: 'C:\\Steam' }; await trustyshelf.saveConfig(c); await Shelf.refresh(true); });
    await page.waitForTimeout(2500);
    const pick = title => page.evaluate(async title => { const w = ms => new Promise(r => setTimeout(r, ms));
      const tab = [...document.querySelectorAll('#tabs .tab')].find(t => t.textContent.trim() === 'PC'); if (!tab) return 'no PC tab'; tab.click(); await w(1500);
      for (let i = 0; i < 12 && Shelf._tour.game() && Shelf._tour.game().title !== title; i++) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await w(450); }
      if (!Shelf._tour.game() || Shelf._tour.game().title !== title) return 'not found: ' + (Shelf._tour.game() || {}).title;
      Shelf._tour.openDetails(); await w(1500); const box = document.getElementById('dAch');
      return { hidden: box.hidden, title: document.getElementById('dAchTitle').textContent, sub: document.getElementById('dAchSub').textContent, ring: document.getElementById('dRingTxt').textContent }; }, title);
    const d = await pick('Cobalt Drift');
    check('Details of a Steam game shows its achievements: 2 of 4 unlocked, from Steam', d && !d.hidden && /2 of 4 unlocked · Steam/.test(d.sub) && d.ring === '50%', JSON.stringify(d));
    const list = await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); document.getElementById('dAchBtn').click(); await w(1200);
      return { on: document.getElementById('achv').classList.contains('on'), tabs: [...document.querySelectorAll('#achTabs .ach-tab')].map(b => b.textContent), rows: document.querySelectorAll('#achList .ach').length, pts: [...document.querySelectorAll('#achList .ach-pts')].map(x => x.textContent).join(''), sub: document.getElementById('achSub').textContent }; });
    check('See all opens the list: Unlocked 2, Locked 2, four rows, no points', list.on && list.rows === 4 && list.tabs.includes('Unlocked 2') && list.tabs.includes('Locked 2') && !list.pts && !/points/.test(list.sub), JSON.stringify(list));
    await page.keyboard.press('Escape'); await page.waitForTimeout(600); await page.keyboard.press('Escape'); await page.waitForTimeout(900);
    const d2 = await pick('Glasshouse');
    check('a Steam game with no achievements cached shows no row', d2 && d2.hidden === true, JSON.stringify(d2));
    check('No script errors', !errors.length, errors.slice(0, 3).join(' | '));
    await ctx.close();
  } catch (e) { check('the test ran to the end', false, e && e.stack); }
  await browser.close(); server.close();
  console.log(fails ? fails + ' check(s) failed' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
});
