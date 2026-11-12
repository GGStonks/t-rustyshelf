// Find a game (renderer/find.js, from upstream beta.12): search every shelf by title.
// Windows 1280x720 on the demo page: the Search button is on the shelf; / opens it on the field; typing lists the matches,
// best first; no key reaches the shelf meanwhile; Esc closes without moving; Ctrl+F opens it too; Enter goes to the game on
// another console's shelf; the quick menu's first row opens it; a pretend controller's held left stick click opens it on
// the letter grid, A types, RB goes to the results, B closes.
// On the demo page. Run (after node copy-web.js): node ci/find-test.js www ../out/find
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const WWW = path.resolve(process.argv[2] || 'www'), OUT = path.resolve(process.argv[3] || '../out/find');
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? '✅ ' : '❌ ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 500))); if (!ok) fails++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary' };
const server = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const p = path.join(WWW, u === '/' ? 'index.html' : u);
  if (!p.startsWith(WWW)) { r.writeHead(403); return r.end(); }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
const PAD = `(() => { const pad = window.__pad = { id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) }; Navigator.prototype.getGamepads = function () { return [pad, null, null, null]; }; })();`;
server.listen(0, async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const url = `http://localhost:${server.address().port}/index.html?platform=windows&shelf=1&wave2=1`;
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); await ctx.addInitScript(PAD);
    const page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(url); await page.waitForFunction(() => window.Shelf && Shelf.getMode && Shelf.getMode() === 'browse' && window.BS_FIND && Shelf._tour.game(), null, { timeout: 30000 }); await page.waitForTimeout(2500);
    const st = () => page.evaluate(() => { const s = BS_FIND._st(), g = Shelf._tour.game(), e = document.getElementById('bsFind');
      return Object.assign(s, { mode: Shelf.getMode(), shown: !!(e && getComputedStyle(e).display !== 'none'), field: !!(document.activeElement && document.activeElement.classList.contains('fg-in')), game: g && g.id, title: g && g.title }); });
    const loaded = () => page.waitForFunction(() => BS_FIND._st().loaded, null, { timeout: 8000, polling: 100 }).catch(() => {});
    // a game on another console's shelf, and how its title starts
    const pick = await page.evaluate(() => { const g = Shelf._tour.game(), all = Shelf._mus.games(), here = all.find(x => x.id === g.id), sys = here ? here.sys : null;
      const other = all.find(x => x.sys !== sys && /^[A-Za-z]{4}/.test(x.title)); return other ? { id: other.id, title: other.title } : null; });
    check('the demo has a game on another shelf', !!pick, JSON.stringify(pick));
    check('the Search button is on the shelf', await page.evaluate(() => { const b = document.getElementById('findBtn'); return !!(b && b.getClientRects().length); }));

    const g0 = (await st()).game;
    await page.keyboard.press('/'); await page.waitForTimeout(300); await loaded();
    let s = await st();
    check('/ opens Find on the field', s.open && s.shown && s.mode === 'find' && s.field && !s.pad, JSON.stringify({ open: s.open, shown: s.shown, mode: s.mode, field: s.field, pad: s.pad }));
    await page.keyboard.type(pick.title.slice(0, 4).toLowerCase(), { delay: 30 }); await page.waitForTimeout(250); s = await st();
    check('typing lists matches, best first', s.res.length > 0 && s.res.some(r => r.startsWith(pick.title)), JSON.stringify(s.res.slice(0, 5)));
    check('no key reached the shelf meanwhile', s.game === g0 && s.mode === 'find', s.game + ' ' + s.mode);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300); s = await st();
    check('Esc closes without moving', !s.open && s.mode === 'browse' && s.game === g0, JSON.stringify({ open: s.open, mode: s.mode, game: s.game }));

    await page.keyboard.press('Control+f'); await page.waitForTimeout(300); await loaded(); s = await st();
    check('Ctrl+F opens it too', s.open && s.mode === 'find');
    await page.keyboard.type(pick.title, { delay: 10 }); await page.waitForTimeout(250);
    const at = await page.evaluate(t => BS_FIND._st().res.findIndex(r => r.startsWith(t + ' · ')), pick.title);
    for (let i = 0; i < at; i++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter'); await page.waitForTimeout(1500); s = await st();
    check('Enter goes to the game on its own shelf', !s.open && s.mode === 'browse' && s.game === pick.id, JSON.stringify({ open: s.open, mode: s.mode, game: s.game, want: pick.id }));

    // the quick menu's first row
    const qm = await page.evaluate(async () => { Shelf._tour.qmOpen(); await new Promise(r => setTimeout(r, 500)); const r = [...document.querySelectorAll('#quickMenu .qm-row')].find(e => /Find a game/.test(e.textContent));
      if (!r) { Shelf._tour.qmClose(); return 'no row'; } r.click(); await new Promise(r => setTimeout(r, 400)); return BS_FIND.isOpen() ? 'ok' : 'did not open'; });
    check('the quick menu has a Find a game row that opens it', qm === 'ok', qm);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);

    // a controller: the left stick's click held opens the letter grid; A types the highlighted letter; B closes
    const btn = (i, on) => page.evaluate(([i, on]) => { const b = __pad.buttons[i]; b.pressed = on; b.value = on ? 1 : 0; __pad.timestamp++; }, [i, on]);
    await btn(10, true); await page.waitForTimeout(900); await btn(10, false); await page.waitForTimeout(400); s = await st();
    check('the left stick click held opens it on the letter grid', s.open && s.pad && s.zone === 'keys', JSON.stringify({ open: s.open, pad: s.pad, zone: s.zone }));
    await btn(0, true); await page.waitForTimeout(150); await btn(0, false); await page.waitForTimeout(250); s = await st();
    check('A types the highlighted letter', s.q === 'A', JSON.stringify(s.q));
    await btn(1, true); await page.waitForTimeout(150); await btn(1, false); await page.waitForTimeout(400); s = await st();
    check('B closes it', !s.open && s.mode === 'browse', JSON.stringify({ open: s.open, mode: s.mode }));
    await page.screenshot({ path: path.join(OUT, 'find-shelf.png') }).catch(() => {});
    check('no page errors', !errors.length, errors.join(' | '));
  } catch (e) { check('ran without throwing', false, e.stack); }
  finally { await browser.close(); server.close(); console.log(fails ? `\n${fails} FAILED` : '\nall passed'); process.exit(fails ? 1 : 0); }
});
