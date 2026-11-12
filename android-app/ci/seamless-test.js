// Seamless play (main/seamless.js, from upstream beta.12) on the demo page as Windows (?watch=1: the pretend main watches
// Steam games as main/seamless.js does):
//   - a Steam game started with Seamless play on is watched: the starting screen stays up with no "Running through Steam"
//     note, B can't leave a game that's running, and the shelf comes back when it ends; one that never shows up gets the
//     old note and B returns; with Seamless play off it's handed to Steam with the old note, as before.
//   - Settings → Display has Seamless play; Screen & motion has Screen mode instead of Start in fullscreen (choosing
//     Window reaches main); Seamless play off: the old row back.
// On the demo page. Run (after node copy-web.js): node ci/seamless-test.js www ../out/seamless
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const WWW = path.resolve(process.argv[2] || 'www'), OUT = path.resolve(process.argv[3] || '../out/seamless');
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? '✅ ' : '❌ ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 700))); if (!ok) fails++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary' };
const server = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const p = path.join(WWW, u === '/' ? 'index.html' : u);
  if (!p.startsWith(WWW)) { r.writeHead(403); return r.end(); }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
server.listen(0, async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const base = `http://localhost:${server.address().port}/index.html`;
  try {
    // ---------- a Steam game, watched ----------
    { const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(base + '?platform=windows&shelf=1&wave2=1&watch=1');
      await page.waitForFunction(() => window.Shelf && Shelf._qs && Shelf._qs().g && window.Setup && Shelf.getMode() === 'browse', null, { timeout: 60000, polling: 250 });
      await page.waitForTimeout(1500);
      const r = await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)), out = {};
        const key = k => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
        const word = () => (document.getElementById('sysWord') || {}).textContent || '';
        const noteOn = () => { const n = document.getElementById('lNote'); return n && n.classList.contains('on') ? n.textContent : ''; };
        const back = async () => { for (let i = 0; i < 40 && Shelf.getMode() !== 'browse'; i++) await w(250); return Shelf.getMode(); };
        const c = (await window.trustyshelf.getConfig()).config; c.steam = { enabled: true, path: 'C:\\Steam' }; await window.trustyshelf.saveConfig(c); await Shelf.refresh(true); await w(1500);
        for (let i = 0; i < 30 && !word().trim().startsWith('PC'); i++) { key('ArrowDown'); await w(500); }
        out.shelf = word(); out.game = Shelf._qs().g;
        if (!/Cobalt Drift|Glasshouse|Hollow Crown|Night Courier/.test(out.game || '')) return out; // (never Play some other game)
        key('Enter'); await w(1200); out.on = { mode: Shelf.getMode(), watched: (window.__watched || []).length, note: noteOn() };
        key('Escape'); await w(500); out.on.afterB = Shelf.getMode(); out.on.back = await back();
        await w(800);
        window.__watchMode = 'giveup'; key('Enter'); await w(3500); out.gu = { mode: Shelf.getMode(), note: noteOn() }; key('Escape'); out.gu.back = await back(); window.__watchMode = '';
        await w(800);
        const c2 = (await window.trustyshelf.getConfig()).config; c2.ui.seamless = false; await window.trustyshelf.saveConfig(c2);
        const n0 = (window.__watched || []).length; key('Enter'); await w(2600); out.off = { mode: Shelf.getMode(), watched: (window.__watched || []).length - n0, note: noteOn() };
        key('Escape'); out.off.back = await back();
        return out; });
      check('the demo PC shelf has a Steam game to start', !!r.on, JSON.stringify(r));
      check('Seamless play: a Steam game is watched: the starting screen stays up with no "Running through Steam" note, B can\'t leave a running game, the shelf comes back when it ends',
        !!r.on && r.on.mode === 'launch' && r.on.watched >= 1 && !/Running through/.test(r.on.note) && r.on.afterB === 'launch' && r.on.back === 'browse', JSON.stringify(r.on));
      check('Seamless play: a Steam game that never shows up gets the old "Running through Steam" note, and B returns',
        !!r.gu && r.gu.mode === 'launch' && /Running through Steam/.test(r.gu.note) && r.gu.back === 'browse', JSON.stringify(r.gu));
      check('Seamless play off: a Steam game is handed to Steam as before (the note, not watched), B returns',
        !!r.off && r.off.mode === 'launch' && r.off.watched === 0 && /Running through Steam/.test(r.off.note) && r.off.back === 'browse', JSON.stringify(r.off));
      check('no page errors on the Steam launches', !errors.length, errors.slice(0, 3).join(' | '));
      await page.close(); }

    // ---------- Settings → Display: Seamless play, Screen mode ----------
    { const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(base + '?platform=windows&shelf=1&wave2=1');
      await page.waitForFunction(() => window.Shelf && Shelf.getMode && Shelf.getMode() === 'browse' && window.Setup, null, { timeout: 60000, polling: 250 });
      await page.waitForTimeout(1000);
      const labels = async () => page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms));
        Setup.open(); for (let i = 0; i < 20 && !(window.Settings && Settings.isOpen && Settings.isOpen()); i++) await w(200); await w(400);
        const nav = [...document.querySelectorAll('#bss .bss-nav')].find(e => /^Display\b/.test(e.textContent.trim())); if (nav) nav.click(); await w(500);
        const top = [...document.querySelectorAll('#bss .bss-row, #bss .bss-head, #bss [class*="row"]')].map(e => e.textContent.trim().split('\n')[0]).filter(Boolean);
        const more = [...document.querySelectorAll('#bss *')].find(e => e.children.length < 6 && /^Screen & motion/.test(e.textContent.trim())); if (more) more.click(); await w(600);
        const inner = document.querySelector('#bss') ? document.querySelector('#bss').innerText : '';
        return { seamless: /Seamless play/.test(top.join('|') + inner), screenMode: /Screen mode/.test(inner), startFs: /Start in fullscreen/.test(inner) }; });
      const on = await labels();
      check('Settings (Windows): Seamless play on Display; Screen mode instead of Start in fullscreen', on.seamless && on.screenMode && !on.startFs, JSON.stringify(on));
      await page.locator('#bss .bss-row', { hasText: 'Screen mode' }).first().click().catch(() => {}); await page.waitForTimeout(300); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(700);
      const sent = await page.evaluate(() => window.__screenModes || []);
      check('choosing Window reaches main', sent.includes('window'), JSON.stringify(sent));
      check('no page errors in Settings', !errors.length, errors.slice(0, 3).join(' | '));
      await page.close(); }
  } catch (e) { check('ran without throwing', false, e.stack); }
  finally { await browser.close(); server.close(); console.log(fails ? `\n${fails} FAILED` : '\nall passed'); process.exit(fails ? 1 : 0); }
});
