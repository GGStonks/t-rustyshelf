// (T)rustyShelf, Boxshelf beta issue 1: a PlayStation pad Windows has but Chromium never lists (a DualSense over Bluetooth)
// is read by the controller helper instead. Run (after node copy-web.js): node ci/padfeed-test.js www ../out/padfeed
//   - the helper script reads it on FEED 1 and reports PAD <button> lines; main presses them on the page as keys
//   - on the demo page: no pad in Chromium and a PlayStation pad plugged in turns the feed on; a pad Chromium sees turns it off;
//     an Xbox pad (Chromium lists those) never turns it on
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const WWW = path.resolve(process.argv[2] || 'www'), OUT = path.resolve(process.argv[3] || '../out/padfeed');
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? '✅ ' : '❌ ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 500))); if (!ok) fails++; };
const ROOT = path.join(__dirname, '..', '..');
const pw = fs.readFileSync(path.join(ROOT, 'main', 'padwatch.js'), 'utf8'), main = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8'), pre = fs.readFileSync(path.join(ROOT, 'preload.js'), 'utf8');
check('The helper takes FEED 1/0 and reads the HID pads while it\'s on (not only with the Home menu open)', /\$w\[0\] -eq 'FEED'/.test(pw) && /NinOn = \(\$menu -or \$feed\)/.test(pw), null);
check('…reports the PlayStation pad\'s button changes and its stick as PAD lines, and main hands them to the shelf', /Write-Output \("PAD " \+ \$feedNames\[\$bit\]/.test(pw) && /line\.startsWith\('PAD '\) && opts\.onPad/.test(pw) && /onPad: padFeedKey/.test(main), null);
check('…as the shelf\'s own keys (Cross Enter, Circle Escape), only while no game runs and the Home menu is closed', /a: 'Enter', b: 'Escape'/.test(main) && /launcher\.isRunning\(\) \|\| homemenu\.isOpen\(\)\) return/.test(main) && /padFeed: on => call\('pad:feed'/.test(pre), null);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary' };
const server = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const p = path.join(WWW, u === '/' ? 'index.html' : u);
  if (!p.startsWith(WWW)) { r.writeHead(403); return r.end(); }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
server.listen(0, async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const run = async (pads, name) => {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }), page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(`http://localhost:${server.address().port}/index.html?platform=windows&shelf=1`); await page.waitForTimeout(3000);
      await page.evaluate(p => { window.__feed = []; const api = window.trustyshelf; api.padsPresent = async () => p; api.padFeed = async on => { window.__feed.push(on); return on; }; }, pads);
      await page.bringToFront(); await page.waitForTimeout(6800);
      const on = await page.evaluate(() => ({ on: window.BS_padFeed(), calls: window.__feed.slice() }));
      await page.evaluate(() => dispatchEvent(new Event('gamepadconnected'))); await page.waitForTimeout(200);
      const off = await page.evaluate(() => ({ on: window.BS_padFeed(), calls: window.__feed.slice() }));
      await ctx.close(); return { on, off, errors };
    };
    const ps = await run([{ vendor: '054c', product: '0ce6', style: 'ps' }]);
    check('No pad in Chromium and a DualSense plugged in: the shelf asks for it to be read directly', ps.on.on === true && ps.on.calls[0] === true, JSON.stringify(ps.on));
    check('A pad Chromium sees turns the direct reading off at once', ps.off.on === false && ps.off.calls[ps.off.calls.length - 1] === false, JSON.stringify(ps.off));
    const xb = await run([{ vendor: '045e', product: '0b13', style: 'xbox' }]);
    check('An Xbox pad never turns it on', xb.on.on === false && !xb.on.calls.includes(true), JSON.stringify(xb.on));
    check('No script errors', !ps.errors.length && !xb.errors.length, [...ps.errors, ...xb.errors].slice(0, 3).join(' | '));
  } catch (e) { check('the test ran to the end', false, e && e.stack); }
  await browser.close(); server.close();
  console.log(fails ? fails + ' check(s) failed' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
});
