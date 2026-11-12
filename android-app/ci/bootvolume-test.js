// (T)rustyShelf: the boot sound's own volume (Settings → Sound → Boot sound volume; asked for in Boxshelf beta discussion 36),
// on the demo page as Windows. Run (after node copy-web.js): node ci/bootvolume-test.js www ../out/bootvolume
//   - Settings → Sound has the row, right below Boot sound, at 100% by default
//   - the boot, rendered offline, is about half as loud at 50% and silent at 0%, while a menu sound stays as loud as before
//   - moving the slider saves ui.bootVolume and reaches the sound engine
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const WWW = path.resolve(process.argv[2] || 'www'), OUT = path.resolve(process.argv[3] || '../out/bootvolume');
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? '✅ ' : '❌ ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 500))); if (!ok) fails++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary' };
const server = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const p = path.join(WWW, u === '/' ? 'index.html' : u);
  if (!p.startsWith(WWW)) { r.writeHead(403); return r.end(); }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });

server.listen(0, async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const base = `http://localhost:${server.address().port}/index.html?platform=windows&shelf=1`;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }), page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message)); await page.goto(base); await page.waitForTimeout(5000);
    const st = await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms));
      const names = () => [...document.querySelectorAll('#bss .bss-row')].map(r => ((r.querySelector('.nm') || {}).textContent || ''));
      const row = n => [...document.querySelectorAll('#bss .bss-row')].find(r => ((r.querySelector('.nm') || {}).textContent || '') === n);
      Setup.open({ page: 'sound' }); for (let i = 0; i < 40 && !row('Boot sound volume'); i++) await w(150); await w(400);
      const list = names(), out = { order: list.indexOf('Boot sound volume') - list.indexOf('Boot sound'), text: ((row('Boot sound volume') || {}).textContent || '') };
      // loudness of a rendered cue: the peak of its samples
      const peak = async name => { const b = await Sound.render(name, 3.2); if (!b) return -1; let m = 0; for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); } return m; };
      Sound.set({ bootVolume: 1 }); out.full = await peak('boot'); out.move1 = await peak('go');
      Sound.set({ bootVolume: .5 }); out.half = await peak('boot'); out.move2 = await peak('go');
      Sound.set({ bootVolume: 0 }); out.zero = await peak('boot');
      Sound.set({ bootVolume: 1 });
      const bar = (row('Boot sound volume') || document).querySelector('.bss-bar'), rc = bar && bar.getBoundingClientRect();
      out.bar = rc ? { x: rc.left + rc.width * .4, y: rc.top + rc.height / 2 } : null;
      return out; });
    // the slider: a press on its bar moves it, and it's saved
    if (st.bar) { await page.mouse.click(st.bar.x, st.bar.y); await page.waitForTimeout(1500); }
    st.saved = await page.evaluate(async () => (await trustyshelf.getConfig()).config.ui.bootVolume);
    check('Settings → Sound has Boot sound volume right below Boot sound, at 100%', st.order === 1 && /100%/.test(st.text), JSON.stringify(st));
    check('The boot is about half as loud at 50% and silent at 0%', st.full > 0.01 && st.half > st.full * .3 && st.half < st.full * .7 && st.zero < st.full * .01, JSON.stringify(st));
    check('…and the menu sounds stay as loud as before', st.move1 > 0 && Math.abs(st.move2 - st.move1) < st.move1 * .2 /* (each render varies a little: it's never halved) */, JSON.stringify(st));
    check('Moving the slider saves it (a press on its bar moves it)', !!st.bar && typeof st.saved === 'number' && st.saved < 1, JSON.stringify(st));
    check('No script errors', !errors.length, errors.slice(0, 3).join(' | '));
    await ctx.close();
  } catch (e) { check('the test ran to the end', false, e && e.stack); }
  await browser.close(); server.close();
  console.log(fails ? fails + ' check(s) failed' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
});
