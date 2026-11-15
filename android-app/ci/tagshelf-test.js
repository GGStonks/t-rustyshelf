// (T)rustyShelf discussion 33: tag shelves across consoles. Windows 1280x720 on the demo page: Settings → Shelf →
// Collections lists "Add a tag shelf" with the library's genres and their game counts; adding Racing makes a Racing shelf
// with every Racing game from every console (and nothing else); adding it again doesn't make a second one; the tag is kept
// in the settings; a game added to it by hand stays on it too.
// On the demo page. Run (after node copy-web.js): node ci/tagshelf-test.js www ../out/tagshelf
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const WWW = path.resolve(process.argv[2] || 'www'), OUT = path.resolve(process.argv[3] || '../out/tagshelf');
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? '✅ ' : '❌ ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 700))); if (!ok) fails++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary' };
const server = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const p = path.join(WWW, u === '/' ? 'index.html' : u);
  if (!p.startsWith(WWW)) { r.writeHead(403); return r.end(); }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
server.listen(0, async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/index.html?platform=windows&shelf=1&wave2=1`);
    await page.waitForFunction(() => window.Shelf && Shelf.getMode && Shelf.getMode() === 'browse' && window.Setup && Shelf._lib, null, { timeout: 60000, polling: 250 });
    await page.waitForTimeout(1200);
    const counts = await page.evaluate(() => Shelf.genreCounts());
    check('the library\'s genres are counted across every console', Array.isArray(counts) && counts.some(([g, n]) => g === 'Racing' && n > 1), JSON.stringify(counts));
    const openCols = () => page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms));
      if (!(window.Settings && Settings.isOpen && Settings.isOpen())) { Setup.open(); for (let i = 0; i < 25 && !(window.Settings && Settings.isOpen && Settings.isOpen()); i++) await w(200); await w(400); }
      const nav = [...document.querySelectorAll('#bss .bss-nav')].find(e => /^Shelf/.test(e.textContent.trim())); if (nav) nav.click(); await w(500);
      const r = [...document.querySelectorAll('#bss .bss-row')].find(e => /^Collections/.test(e.textContent.trim())); if (r) r.click(); await w(600);
      return document.querySelector('#bss').innerText; });
    const txt = await openCols();
    check('Collections has Add a tag shelf with the genres and their counts', /Add a tag shelf/i.test(txt) && /Racing/.test(txt) && /\d+ games?/.test(txt), txt.slice(0, 400));
    const add = () => page.evaluate(async () => { const r = [...document.querySelectorAll('#bss .bss-row')].find(e => /^Racing/.test(e.textContent.trim())); if (!r) return 'no row'; r.click(); await new Promise(z => setTimeout(z, 500)); return 'ok'; });
    check('Add Racing', await add() === 'ok');
    await add(); // (again: no second shelf)
    const cfgCols = await page.evaluate(async () => { await new Promise(r => setTimeout(r, 900)); if (window.Settings && Settings.close) await Settings.close(); await new Promise(r => setTimeout(r, 1200)); return (await window.trustyshelf.getConfig()).config.ui.collections || []; });
    const racing = cfgCols.filter(c => c.tag === 'Racing');
    check('one Racing tag shelf, kept in the settings with its tag', racing.length === 1 && racing[0].name === 'Racing', JSON.stringify(cfgCols));
    const sh = await page.evaluate(() => { const L = Shelf._lib.shelves(), s = L.find(x => x.col && x.name === 'Racing'), all = window.Shelf._mus.games(); if (!s) return null;
      const by = new Map(all.map(g => [String(g.id), g.sys])); return { n: s.ids.length, consoles: [...new Set(s.ids.map(id => by.get(String(id))))].filter(Boolean) }; });
    const want = await page.evaluate(() => Shelf.genreCounts().find(([g]) => g === 'Racing')[1]);
    check('the Racing shelf holds every Racing game, from several consoles', !!sh && sh.n === want && sh.consoles.length > 1, JSON.stringify({ sh, want }));
    check('no page errors', !errors.length, errors.slice(0, 3).join(' | '));
  } catch (e) { check('ran without throwing', false, e.stack); }
  finally { await browser.close(); server.close(); console.log(fails ? `\n${fails} FAILED` : '\nall passed'); process.exit(fails ? 1 : 0); }
});
