// Boxshelf beta issue 32 (a later comment): the 3D case in Inspect looked like a 3DS case inside on every console: case.glb is
// a cartridge case, and a disc case showed its card holder under the disc. A disc case hides the holder and the opening
// under it is the case's own colour. Each console opens into its own real case: keep, jewel, cardboard box or its moulded
// case (the DS and 3DS with their own cartridge). On the demo page.
// Run (after node copy-web.js): node ci/caseinside-test.js www ../out/caseinside
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const WWW = path.resolve(process.argv[2] || 'www'), OUT = path.resolve(process.argv[3] || '../out/caseinside');
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? '✅ ' : '❌ ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 600))); if (!ok) fails++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary' };
const server = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const p = path.join(WWW, u === '/' ? 'index.html' : u);
  if (!p.startsWith(WWW)) { r.writeHead(403); return r.end(); }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
server.listen(0, async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }), page = await ctx.newPage(), errors = [];
    await page.addInitScript(() => { const pad = window.__pad = { id: 'test pad', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
      Navigator.prototype.getGamepads = function () { return [pad, null, null, null]; }; });
    page.on('pageerror', e => errors.push(e.message));
    const r3 = () => page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); __pad.buttons[11] = { pressed: true, touched: true, value: 1 }; __pad.timestamp++; await w(250); __pad.buttons[11] = { pressed: false, touched: false, value: 0 }; __pad.timestamp++; await w(200); });
    const base = `http://localhost:${server.address().port}/index.html?platform=windows&shelf=1&wave2=1&every=1`;
    const open = async tab => {
      await page.goto(base); await page.waitForTimeout(5000);
      await page.evaluate(async n => { const t = [...document.querySelectorAll('#tabs .tab')].find(x => x.textContent.trim() === n); t.click(); await new Promise(r => setTimeout(r, 1800)); }, tab);
      await r3(); await page.waitForFunction(() => window.Inspect3D && Inspect3D._st().phase === 'shown', null, { timeout: 15000 }).catch(() => {});
      await page.keyboard.press('Enter'); await page.waitForTimeout(2200);
      await page.screenshot({ path: path.join(OUT, tab + '-open.png') });
      return page.evaluate(() => Inspect3D._parts());
    };
    const ps3 = await open('PS3'), P = ps3.parts;
    const holder = Object.values(P).filter((x, i) => Object.keys(P)[i].startsWith('Case') && !x.visible);
    check('a disc case (PS3) opens on the 3D case model', ps3.kind === 'disc' && Object.keys(P).some(k => k.startsWith('Case')), JSON.stringify(ps3));
    check('…without the cartridge case\'s card holder', holder.length === 1 && !(P.Cartridge || {}).visible, JSON.stringify(P));
    const inside = P.Cover_2 || {}, shell = P.Case_1 || {};
    check('…and the opening under it is the case\'s own plastic colour, not a white cut-out', inside.color && inside.color === shell.color && inside.color !== 'ffffff', JSON.stringify({ inside, shell }));
    // each console's own case (beta issue 32, the screenshots): the keep-case model only where games came in keep cases
    const forms = await page.evaluate(() => Object.fromEntries(['gc', 'ps2', 'wii', 'wiiu', 'ps3', 'sw', 'x360', 'psp', 'psx', 'saturn', 'dreamcast', 'nes', 'snes', 'gb', 'gba', 'dos', 'nds', 'n3ds', 'megadrive'].map(id => [id, Inspect3D.caseForm(id)])));
    check('the PS2, Wii, Wii U and GameCube in their own modelled cases, keep cases for the other DVD / Blu-ray / Switch consoles, jewel cases for the CD ones, cardboard boxes for the cartridge ones, the DS / 3DS / Mega Drive in their own moulded cases',
      ['gc', 'ps2', 'wii', 'wiiu'].every(k => forms[k] === 'model') && ['ps3', 'sw', 'x360', 'psp'].every(k => forms[k] === 'keep') && ['psx', 'saturn', 'dreamcast'].every(k => forms[k] === 'jewel') && ['nes', 'snes', 'gb', 'gba', 'dos'].every(k => forms[k] === 'box') && ['nds', 'n3ds', 'megadrive'].every(k => forms[k] === 'hinged'), JSON.stringify(forms));
    const shapes = await page.evaluate(() => ({ ps3: Inspect3D.caseShape('ps3'), nds: Inspect3D.caseShape('nds'), snes: Inspect3D.caseShape('snes') }));
    check('only keep-case shelves take the keep-case model\'s shape on the shelf; the others keep their own', shapes.ps3 && !shapes.nds && !shapes.snes, JSON.stringify(shapes));
    const gc = await open('GameCube'), gm = await page.evaluate(() => Inspect3D._models());
    check('a GameCube game opens into the GameCube case model (case-gc.glb), as thick as the real one', gm.form === 'model' && gm.model && Math.abs(gm.D - 14 / 190) < .002, JSON.stringify(gm));
    const ds = await open('DS'), D = ds.parts;
    check('a DS game opens into its own case with a DS cartridge, not the Switch case and card', ds.kind === 'cart' && !Object.keys(D).length, JSON.stringify(D));
    const gb = await (async () => { await page.goto(base); await page.waitForTimeout(5000);
      await page.evaluate(async () => { const t = [...document.querySelectorAll('#tabs .tab')].find(x => x.textContent.trim() === 'Game Boy'); t.click(); await new Promise(r => setTimeout(r, 1800)); });
      await r3(); await page.waitForFunction(() => window.Inspect3D && Inspect3D._st().phase === 'shown', null, { timeout: 15000 }).catch(() => {});
      const hint0 = await page.evaluate(() => document.getElementById('inspect').innerText);
      await page.keyboard.press('Enter'); await page.waitForTimeout(2200); await page.screenshot({ path: path.join(OUT, 'Game Boy-open.png') });
      await page.keyboard.press('Enter'); await page.waitForTimeout(2600); await page.screenshot({ path: path.join(OUT, 'Game Boy-out.png') });
      return { hint0, step: await page.evaluate(() => (document.getElementById('ispStep') || {}).textContent) }; })();
    check('a Game Boy game is a cardboard box: "Open box", then the cartridge comes out', /Open box/.test(gb.hint0) && /Cartridge out/i.test(gb.step), JSON.stringify(gb).slice(0, 300));
    check('no page errors', !errors.length, errors.join(' | '));
  } catch (e) { check('the test ran to the end', false, e && e.stack); }
  await browser.close(); server.close();
  console.log(fails ? fails + ' check(s) failed' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
});
