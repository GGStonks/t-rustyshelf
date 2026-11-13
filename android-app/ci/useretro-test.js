// (T)rustyShelf discussion 10 again: a console RetroArch runs always has a way over to it. With no RetroArch found or set
// under RetroArch location, the PlayStation's page only offered the file window for DuckStation. Windows 1280x720 on the
// demo page: the PlayStation's page has "Use RetroArch"; picking retroarch.exe makes it the shelf's emulator, keeps it as
// the RetroArch location (none was set) and brings the RetroArch core choice; something else is turned down; a console
// RetroArch doesn't run (PS2) never gets the row.
// On the demo page. Run (after node copy-web.js): node ci/useretro-test.js www ../out/useretro
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const WWW = path.resolve(process.argv[2] || 'www'), OUT = path.resolve(process.argv[3] || '../out/useretro');
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
    await page.waitForTimeout(800);
    // no RetroArch anywhere: none set, none found; the PlayStation on DuckStation
    await page.evaluate(async () => { const api = window.trustyshelf, c = (await api.getConfig()).config; c.retroarch = ''; c.systems.n64 = Object.assign({}, c.systems.n64, { emulator: 'C:\\Emu\\RMG\\RMG.exe' }); await api.saveConfig(c);
      api.emulatorsFound = async () => []; window.__picks = []; api.pick = async o => { window.__picks.push(o); return window.__pickAnswer; }; });
    const openConsole = async name => page.evaluate(async name => { const w = ms => new Promise(r => setTimeout(r, ms));
      if (!(window.Settings && Settings.isOpen && Settings.isOpen())) { Setup.open(); for (let i = 0; i < 25 && !(window.Settings && Settings.isOpen && Settings.isOpen()); i++) await w(200); await w(500); }
      const nav = [...document.querySelectorAll('#bss .bss-nav')].find(e => /^Consoles/.test(e.textContent.trim())); if (nav) nav.click(); await w(600);
      const row = [...document.querySelectorAll('#bss .bss-row, #bss .bss-ctile')].find(e => e.textContent.trim().startsWith(name)); if (row) row.click(); await w(800);
      return [...document.querySelectorAll('#bss .bss-row')].map(e => e.textContent.trim().slice(0, 40)); }, name);
    const rows = await openConsole('Nintendo 64');
    check('a RetroArch console\'s page (N64 on RMG here, the PlayStation on DuckStation in the report) has Use RetroArch with no RetroArch found or set', rows.some(r => /^Use RetroArch/.test(r)), JSON.stringify(rows));
    const use = () => page.locator('#bss .bss-row', { hasText: 'Use RetroArch' }).first();
    await page.evaluate(() => { window.__pickAnswer = 'C:\\Emu\\pcsx2\\pcsx2-qt.exe'; }); await use().click(); await page.waitForTimeout(700);
    const bad = await page.evaluate(async () => (await window.trustyshelf.getConfig()).config.systems.n64.emulator);
    check('a program that isn\'t RetroArch is turned down (the shelf\'s emulator stays)', /RMG\.exe$/i.test(bad), bad);
    await page.evaluate(() => { window.__pickAnswer = 'C:\\RetroArch-Win64\\retroarch.exe'; }); await use().click(); await page.waitForTimeout(1200);
    const st = await page.evaluate(async () => { const t = document.querySelector('#bss').innerText; return { core: /RetroArch core/.test(t), still: /Use RetroArch/.test(t), title: (window.__picks[window.__picks.length - 1] || {}).title }; });
    const cfg = await page.evaluate(async () => { await new Promise(r => setTimeout(r, 1500)); if (window.Settings && Settings.close) await Settings.close(); await new Promise(r => setTimeout(r, 800)); const c = (await window.trustyshelf.getConfig()).config; return { emu: c.systems.n64.emulator, ra: c.retroarch }; });
    check('retroarch.exe picked: it\'s the shelf\'s emulator and kept as the RetroArch location, the row gone', /retroarch\.exe$/i.test(cfg.emu) && /retroarch\.exe$/i.test(cfg.ra) && !st.still, JSON.stringify({ cfg, st }));
    check('the file window asks for RetroArch, not the console\'s own emulator', /RetroArch/.test(st.title || ''), st.title);
    const ps2 = await openConsole('PS3');
    check('a console RetroArch doesn\'t run (PS3) never gets the row', ps2.length > 2 && !ps2.some(r => /^Use RetroArch/.test(r)), JSON.stringify(ps2));
    check('no page errors', !errors.length, errors.slice(0, 3).join(' | '));
  } catch (e) { check('ran without throwing', false, e.stack); }
  finally { await browser.close(); server.close(); console.log(fails ? `\n${fails} FAILED` : '\nall passed'); process.exit(fails ? 1 : 0); }
});
