// (T)rustyShelf discussion 30: Settings can always be left, whatever the main process is doing. With main held up (a
// library scan on a slow network drive), the settings save never answered: Settings stayed on screen and every later Esc
// or Back did nothing. Windows 1280x720 on the demo page: a save that hangs, Esc still closes Settings (within ~3 s) and
// the save finishes behind; a rescan that hangs after closing doesn't stop Settings being opened and closed again.
// On the demo page. Run (after node copy-web.js): node ci/settingsquit-test.js www ../out/settingsquit
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const WWW = path.resolve(process.argv[2] || 'www'), OUT = path.resolve(process.argv[3] || '../out/settingsquit');
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
    await page.goto(`http://localhost:${server.address().port}/index.html?platform=windows&shelf=1&wave2=1`);
    await page.waitForFunction(() => window.Shelf && Shelf.getMode && Shelf.getMode() === 'browse' && window.Setup, null, { timeout: 60000, polling: 250 });
    await page.waitForTimeout(1000);
    const open = () => page.evaluate(async () => { Setup.open(); for (let i = 0; i < 25 && !(window.Settings && Settings.isOpen && Settings.isOpen()); i++) await new Promise(r => setTimeout(r, 200)); await new Promise(r => setTimeout(r, 400)); return Settings.isOpen(); });
    const isOpen = () => page.evaluate(() => !!(window.Settings && Settings.isOpen && Settings.isOpen()));
    // a save that hangs (main held up): change a setting so there is something to save
    await page.evaluate(() => { const api = window.trustyshelf, real = api.saveConfig; window.__saveDone = false; api.saveConfig = c => new Promise(res => { window.__releaseSave = () => { window.__saveDone = true; res(real(c)); }; }); });
    check('Settings opens', await open());
    await page.evaluate(() => { const nav = [...document.querySelectorAll('#bss .bss-nav')].find(e => /^Display/.test(e.textContent.trim())); if (nav) nav.click(); });
    await page.waitForTimeout(400);
    const flipped = await page.evaluate(async () => { const r = [...document.querySelectorAll('#bss .bss-row')].find(e => { const v = e.querySelector('.bss-val'); return v && /^(On|Off)$/.test(v.textContent.trim()); });
      if (!r) return ''; const before = r.querySelector('.bss-val').textContent.trim(); r.click(); await new Promise(z => setTimeout(z, 40)); return before + '>' + r.querySelector('.bss-val').textContent.trim(); });
    check('a setting is changed (so there is something to save)', /^(On>Off|Off>On)$/.test(flipped), flipped);
    const saves = await page.evaluate(() => typeof window.__releaseSave);
    const t0 = Date.now(); let presses = 0;
    await page.evaluate(() => { Settings.close(); }); // (Back clicked right after the change: the close itself has the save to make)
    for (let i = 0; i < 12 && await isOpen(); i++) { await page.keyboard.press('Escape'); presses++; await page.waitForTimeout(420); }
    const took = Date.now() - t0, closed = !(await isOpen());
    check('a save that hangs doesn\'t keep Settings on screen: Esc closes it within about 3 s', closed && took < 4800, JSON.stringify({ closed, took, presses, saves }));
    await page.evaluate(() => window.__releaseSave && window.__releaseSave()); await page.waitForTimeout(500);
    check('the save still finishes behind', await page.evaluate(() => window.__saveDone));
    // a rescan that hangs after closing: Settings can be opened and closed again meanwhile
    await page.evaluate(() => { const S = window.Shelf, real = S.refresh; window.__refreshHeld = true; S.refresh = () => new Promise(res => { window.__releaseRefresh = () => res(real.call(S, true)); }); });
    await open(); await page.evaluate(() => { const nav = [...document.querySelectorAll('#bss .bss-nav')].find(e => /^Consoles/.test(e.textContent.trim())); if (nav) nav.click(); });
    await page.waitForTimeout(400);
    await page.evaluate(() => { try { window.Settings && Settings._needRescan ? Settings._needRescan() : null; } catch {} });
    await page.evaluate(() => { const r = [...document.querySelectorAll('#bss .bss-row')].find(e => /Show this shelf|Find emulators again/.test(e.textContent)); if (r) r.click(); });
    await page.waitForTimeout(300); await page.keyboard.press('Escape'); await page.waitForTimeout(1500);
    const reopened = await open(); await page.keyboard.press('Escape'); await page.waitForTimeout(1500);
    check('with a rescan still running, Settings opens and closes again', reopened && !(await isOpen()), JSON.stringify({ reopened, still: await isOpen() }));
    await page.evaluate(() => window.__releaseRefresh && window.__releaseRefresh());
    check('no page errors', !errors.length, errors.slice(0, 3).join(' | '));
  } catch (e) { check('ran without throwing', false, e.stack); }
  finally { await browser.close(); server.close(); console.log(fails ? `\n${fails} FAILED` : '\nall passed'); process.exit(fails ? 1 : 0); }
});
