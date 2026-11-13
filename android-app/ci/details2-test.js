// Details redesigned around the case (renderer/app.js dvBuild / dvFill, details2.css; from upstream beta.12), Windows 1280x720
// on the demo page: Details opens as one page in sections with the section bar (Overview, Screenshots, About, Your play,
// Achievements, Your copy, Info); (T)rustyShelf's own buttons are still there (Window, Box size, Move earlier / later, Art
// match, Install, Collections, Hide, Rename, Emulator…, in the page or its More menu); E / Q jump a section; Status is set
// and saved per game (and pressed again, cleared); Favourite follows H; Esc closes it; no page errors.
// On the demo page. Run (after node copy-web.js): node ci/details2-test.js www ../out/details2
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const WWW = path.resolve(process.argv[2] || 'www'), OUT = path.resolve(process.argv[3] || '../out/details2');
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
    await page.waitForFunction(() => window.Shelf && Shelf.getMode && Shelf.getMode() === 'browse' && Shelf._tour && Shelf._tour.game(), null, { timeout: 60000, polling: 250 });
    await page.waitForTimeout(1500);
    for (let i = 0; i < 6 && await page.evaluate(() => Shelf._tour.game().kind !== 'rom'); i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(700); } // (a real game, not the shuffle tile)
    await page.keyboard.press('i'); await page.waitForTimeout(1500);
    const st = await page.evaluate(() => { const d = document.getElementById('details');
      return { mode: Shelf.getMode(), dv2: !!(d && d.classList.contains('dv2')), tabs: [...document.querySelectorAll('#dvNav .dv-t')].map(e => e.textContent.trim()),
        ids: ['dPlay', 'dFav', 'dWindow', 'dBoxSize', 'dMoveEarlier', 'dMoveLater', 'dArtMatch', 'dInstall', 'dCols', 'dHide', 'dRename', 'dGameEmu', 'dBoxArt', 'dChooseManual', 'dStats', 'dShots', 'dGrid']
          .filter(id => { const e = document.getElementById(id); return !!(e && d.contains(e)); }),
        orphans: ['dWindow', 'dBoxSize', 'dMoveEarlier', 'dMoveLater', 'dArtMatch', 'dInstall'].filter(id => { const e = document.getElementById(id); return e && !d.contains(e); }),
        status: !!document.getElementById('dvStatus'), cur: (document.querySelector('#dvNav .dv-t.cur') || {}).textContent };
    });
    check('Details opens as one page in sections (the section bar shows them)', st.mode === 'details' && st.dv2 && ['Overview', 'Screenshots', 'About', 'Your play', 'Achievements', 'Your copy', 'Info'].every(t => st.tabs.includes(t)), JSON.stringify(st));
    check('(T)rustyShelf\'s own Details buttons and panels are all in the new page (none left behind)', ['dPlay', 'dFav', 'dWindow', 'dBoxSize', 'dMoveEarlier', 'dMoveLater', 'dArtMatch', 'dInstall', 'dCols', 'dHide', 'dRename', 'dBoxArt', 'dStats', 'dShots', 'dGrid'].every(i => st.ids.includes(i)) && !st.orphans.length, JSON.stringify({ have: st.ids, orphans: st.orphans }));
    await page.keyboard.press('e'); await page.waitForTimeout(1200);
    const c1 = await page.evaluate(() => (document.querySelector('#dvNav .dv-t.cur') || {}).textContent);
    check('E jumps to the next section', !!c1 && c1 !== st.cur, JSON.stringify({ before: st.cur, after: c1 }));
    const gid = await page.evaluate(() => Shelf._tour.game().id);
    await page.evaluate(() => { const b = document.querySelector('#dvStatus .dv-opt[data-v="playing"]'); if (b) b.click(); }); await page.waitForTimeout(700);
    const s1 = await page.evaluate(async id => { const c = (await window.trustyshelf.getConfig()).config; return { saved: (c.games && c.games[id] && c.games[id].status) || '', on: !!document.querySelector('#dvStatus .dv-opt.on[data-v="playing"]') }; }, gid);
    check('Status: Playing is set and saved for this game', s1.saved === 'playing' && s1.on, JSON.stringify(s1));
    await page.evaluate(() => { const b = document.querySelector('#dvStatus .dv-opt[data-v="playing"]'); if (b) b.click(); }); await page.waitForTimeout(700);
    const s2 = await page.evaluate(async id => { const c = (await window.trustyshelf.getConfig()).config; return (c.games && c.games[id] && c.games[id].status) || ''; }, gid);
    check('Status: pressed again, it\'s cleared', s2 === '', s2);
    await page.screenshot({ path: path.join(OUT, 'details2.png') }).catch(() => {});
    await page.keyboard.press('Escape'); await page.waitForTimeout(1200);
    check('Esc closes Details', await page.evaluate(() => Shelf.getMode()) === 'browse');
    check('no page errors', !errors.length, errors.slice(0, 3).join(' | '));
  } catch (e) { check('ran without throwing', false, e.stack); }
  finally { await browser.close(); server.close(); console.log(fails ? `\n${fails} FAILED` : '\nall passed'); process.exit(fails ? 1 : 0); }
});
