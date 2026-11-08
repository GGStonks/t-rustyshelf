// (T)rustyShelf's box art card on Android (Boxshelf's issue 9), in a browser on the adapter's pretend device (?fakeNative=1).
// Run (after node copy-web.js): node ci/android-artcard-test.js www ../out/android-artcard
//   - a box art run shows the shelf's art card ("Box art 3 of 40") with Pause and Cancel, as on Windows; Android's own
//     progress card steps aside meanwhile
//   - Pause holds the run (no new pictures are started), Resume carries on
//   - Cancel drops what's still queued: the run ends and the card goes
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const WWW = path.resolve(process.argv[2] || 'www'), OUT = path.resolve(process.argv[3] || '../out/android-artcard');
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? '✅ ' : '❌ ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 500))); if (!ok) fails++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary' };
const server = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const p = path.join(WWW, u === '/' ? 'index.html' : u);
  if (!p.startsWith(WWW)) { r.writeHead(403); return r.end(); }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });

server.listen(0, async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 853, height: 480 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const url = `http://localhost:${server.address().port}/index.html?fakeNative=1`;
    await page.goto(url); await page.waitForTimeout(4000);
    // three consoles with games, then the shelf
    await page.evaluate(async () => { const api = window.trustyshelf, info = await api.getConfig(), det = await api.detect(), c = info.config;
      for (const id of ['gc', 'psx', 'snes']) { c.systems[id].romDirs = [await api.pick({ kind: 'folder' })]; c.systems[id].emulator = det.systems[id].emulator; }
      c.setupDone = true; c.ui.autoCovers = false; await api.saveConfig(c); });
    await page.goto(url); await page.waitForTimeout(6000);
    const r = await page.evaluate(async () => { const api = window.trustyshelf, wait = ms => new Promise(res => setTimeout(res, ms)), out = {};
      const cardEl = () => document.querySelector('.art-card'), on = () => !!document.querySelector('.art-card.on');
      const n = () => +((/(\d+) of/.exec((cardEl() || {}).textContent || '') || [0, -1])[1]), btn = k => cardEl() && cardEl().querySelector(`[data-k="${k}"]`);
      window.__fakeArt.lat = 1500; // (slow pictures: the run lasts long enough to pause)
      out.queued = (await api.artFetchNow()).queued;
      for (let i = 0; i < 40 && !on(); i++) await wait(150);
      await wait(600);
      out.cardOn = on(); out.text = ((cardEl() || {}).textContent || '').replace(/\s+/g, ' ');
      out.ownCard = !!document.querySelector('.bs-artcard.show');
      out.hasButtons = !!(btn('pause') && !btn('pause').hidden && btn('cancel') && !btn('cancel').hidden);
      // Pause: what was on its way finishes, nothing new starts
      if (btn('pause')) btn('pause').click(); await wait(3500); // (the pictures already on their way finish)
      const p0 = n(); await wait(3000); out.pausedStill = n() === p0; out.pauseLabel = (btn('pause') || {}).textContent || '';
      out.pausedText = ((cardEl() || {}).textContent || '');
      // Resume: it carries on
      if (btn('pause')) btn('pause').click(); for (let i = 0; i < 30 && on() && n() <= p0; i++) await wait(250); out.resumed = n() > p0 || !on(); out.afterResume = n();
      // Cancel: the rest is dropped, the run ends and the card goes
      const total = +((/of (\d+)/.exec((cardEl() || {}).textContent || '') || [0, 0])[1]), before = n(), f0 = window.__fakeArt.fetch.length; if (btn('cancel')) btn('cancel').click();
      for (let i = 0; i < 60 && on(); i++) await wait(250);
      out.cardGone = !on(); const f1 = window.__fakeArt.fetch.length; await wait(3000); out.stopped = window.__fakeArt.fetch.length === f1; out.doneAtCancel = before; out.total = total; out.fetchedAfterCancel = f1 - f0;
      window.__fakeArt.lat = 40; return out; });
    check('Box art run on Android: the shelf\'s art card shows its progress, with Pause and Cancel (Android\'s own card steps aside)',
      r.queued > 6 && r.cardOn && /Box art/.test(r.text) && /of/.test(r.text) && r.hasButtons && !r.ownCard, JSON.stringify(r));
    check('Pause holds the run (no new pictures start) and says Resume; Resume carries on', r.pausedStill && /Resume/.test(r.pauseLabel) && /paused/.test(r.pausedText) && r.resumed, JSON.stringify(r));
    check('Cancel drops the rest: the run ends, the card goes and no more pictures are fetched', r.cardGone && r.stopped && r.doneAtCancel >= 0 && r.doneAtCancel < r.total, JSON.stringify(r));
    await page.screenshot({ path: path.join(OUT, 'android-artcard.png') });
    check('No script errors', !errors.length, errors.slice(0, 3).join(' | '));
    await ctx.close();
  } catch (e) { check('the test ran to the end', false, e && e.stack); }
  await browser.close(); server.close();
  console.log(fails ? fails + ' check(s) failed' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
});
