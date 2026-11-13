// (T)rustyShelf issue 24: the box art download one press from Settings' sidebar, with how far it is.
// Windows 1280x720 on the demo page: the sidebar has Get box art right after Box art & manuals; it opens the download's
// picker (the consoles, Start download); while it runs the sidebar shows its percentage from any page and the page has
// an "Every console" row with the games done of all of them; when it ends the percentage goes.
// On the demo page. Run (after node copy-web.js): node ci/artget-test.js www ../out/artget
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const WWW = path.resolve(process.argv[2] || 'www'), OUT = path.resolve(process.argv[3] || '../out/artget');
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
    const navs = () => page.evaluate(() => [...document.querySelectorAll('#bss .bss-nav')].map(e => e.textContent.trim()));
    await page.evaluate(async () => { Setup.open(); for (let i = 0; i < 25 && !(window.Settings && Settings.isOpen && Settings.isOpen()); i++) await new Promise(r => setTimeout(r, 200)); });
    await page.waitForTimeout(600);
    const n0 = await navs(), at = n0.findIndex(t => /^Box art & manuals/.test(t));
    check('the sidebar has Get box art right after Box art & manuals', at >= 0 && /^Get box art/.test(n0[at + 1] || ''), JSON.stringify(n0));
    // a download that takes its time, with progress for its first console
    await page.evaluate(() => { window.trustyshelf.downloadCovers = ids => new Promise(res => { window.__endDl = () => res({ systems: ids.map(id => ({ id, name: id, total: 10, front: 3, back: 0, spine: 0, disc: 0, had: 0, missed: [] })) });
      setTimeout(() => (window.__mockCov || []).forEach(f => f({ systemId: ids[0], system: ids[0], done: 3, total: 10, stage: 'x', game: 'Example' })), 300); }); });
    await page.locator('#bss .bss-nav', { hasText: 'Get box art' }).first().click(); await page.waitForTimeout(2500); // (the check runs first)
    const txt = await page.evaluate(() => document.querySelector('#bss').innerText);
    check('it opens the download: the consoles to pick and Start download', /Start download/.test(txt) && /Consoles/.test(txt), txt.slice(0, 300));
    const start = page.locator('#bss .bss-row', { hasText: 'Start download' }).first();
    await start.click(); await page.waitForTimeout(300); if (!(await page.evaluate(() => /Getting box art/.test(document.querySelector('#bss').innerText)))) { await page.keyboard.press('Enter'); }
    await page.waitForTimeout(1200);
    const run = await page.evaluate(() => ({ txt: document.querySelector('#bss').innerText, badge: ([...document.querySelectorAll('#bss .bss-nav')].find(e => /Get box art/.test(e.textContent)) || { lastChild: {} }).lastChild.textContent }));
    check('while it runs: an "Every console" row with the games done of all of them', /Every console/.test(run.txt) && /3 of \d+ games/.test(run.txt), run.txt.slice(0, 400));
    check('while it runs: the sidebar shows how far it is', /^\d+%$/.test(run.badge || ''), JSON.stringify(run.badge));
    await page.locator('#bss .bss-nav', { hasText: 'Display' }).first().click(); await page.waitForTimeout(400);
    const elsewhere = await page.evaluate(() => ([...document.querySelectorAll('#bss .bss-nav')].find(e => /Get box art/.test(e.textContent)) || { lastChild: {} }).lastChild.textContent);
    check('…seen from another page of Settings too', /^\d+%$/.test(elsewhere || ''), JSON.stringify(elsewhere));
    await page.evaluate(() => window.__endDl && window.__endDl()); await page.waitForTimeout(800);
    const after = await page.evaluate(() => ([...document.querySelectorAll('#bss .bss-nav')].find(e => /Get box art/.test(e.textContent)) || { lastChild: {} }).lastChild.textContent);
    check('when it ends, the percentage goes', !/%/.test(after || ''), JSON.stringify(after));
    await page.screenshot({ path: path.join(OUT, 'artget.png') }).catch(() => {});
    check('no page errors', !errors.length, errors.slice(0, 3).join(' | '));
  } catch (e) { check('ran without throwing', false, e.stack); }
  finally { await browser.close(); server.close(); console.log(fails ? `\n${fails} FAILED` : '\nall passed'); process.exit(fails ? 1 : 0); }
});
