// Based on Boxshelf by sassiestrhihno (https://github.com/sassiestrhihno/boxshelf-source, GPL-3.0): this file is the same as Boxshelf's
// android-app/ci/beta-test.js apart from the app's name ((T)rustyShelf).
// Device test pass "beta" (1.82), run by web-device-test.js. Checks results, never speed.
//   Node: a new install starts with the menu music off and the beta update check on, and a saved config keeps its music
//   choice; the fork's own version numbers order (1.0.1.1 after 1.0.1.0, 1.0.1+0 is 1.0.1.0).
//   The demo page as Windows: Settings → System has Report a bug online, Updates (showing this build's own version, the
//   fork's version from package.json as the app shows it) and Check for new versions. No made-up newer release.
//   (beta.2) Node: update / DLC files are skipped by the scanner; the Switch 2 build list is cached, a copy per caller.
//   The first-run wizard as Windows: "I'll pick them myself" explains what's next, and box art is a plain Yes / Not now
//   where Not now leaves the download off.
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');

module.exports = async function betaPass({ browser, base, check, newPage, OUT }) {
  const root = path.resolve(__dirname, '..', '..');
  const SHOWN = (() => { try { return require(path.join(root, 'package.json')).version.replace('+', '.'); } catch { return ''; } })(); // this build's own version, as shown
  try {
    const config = require(path.join(root, 'main', 'config.js'));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bs-beta-'));
    config.init(tmp); const fresh = config.load(); // no config.json: a new install
    fs.writeFileSync(path.join(tmp, 'config.json'), JSON.stringify({ setupDone: true, systems: {}, ui: { music: 'drift', soundRev: 4 } }));
    config.init(tmp); const saved = config.load(); // someone who picked Drift before 1.82
    fs.rmSync(tmp, { recursive: true, force: true });
    check('Beta: a new install starts with the menu music off and the update check on; a saved config keeps its music',
      fresh.ui.music === 'off' && fresh.ui.updateCheck === true && saved.ui.music === 'drift' && saved.ui.updateCheck === true,
      `new ${fresh.ui.music}/${fresh.ui.updateCheck} · saved ${saved.ui.music}/${saved.ui.updateCheck}`);
    const { compare } = require(path.join(root, 'main', 'updates.js'));
    const order = [['1.0.1.1', '1.0.1.0', 1], ['1.0.1.0', '1.0.0.1', 1], ['v1.0.2.0', '1.0.1.0', 1], ['1.0.1.0', '1.0.1+0', 0],
      ['1.0.1.0', '1.0.1.0', 0], ['1.0.0.0', '1.0.1.0', -1], ['1.0.1.0', '1.0.1.10', -1]];
    const bad = order.filter(([a, b, s]) => Math.sign(compare(a, b)) !== s);
    check('Beta: versions order with betas (beta.10 after beta.9, a release after its betas)', !bad.length, JSON.stringify(bad));
    // (beta.2) update and DLC files beside the games aren't shelved as games; titles that only contain the word are
    const { SKIP_NAME } = require(path.join(root, 'main', 'scanner.js'));
    const names = [['Zelda (Update).nsp', true], ['Zelda [UPD].nsp', true], ['Zelda [DLC].nsp', true], ['Zelda_update_v3.nsp', true],
      ['Zelda - DLC Pack.nsp', true], ['Zelda.nsp', false], ['Updated Racer.iso', false], ['Dlcville.iso', false]];
    const wrong = names.filter(([n, skip]) => SKIP_NAME.test(n) !== skip).map(([n]) => n);
    check('Beta: update and DLC files are skipped by the scanner, game titles are kept', !wrong.length, wrong.join(', '));
    // (beta.2) the Switch 2 build list is cached and every caller gets its own copy; a missing build is no build
    const nx2 = require(path.join(root, 'main', 'nx2.js'));
    const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'bs-nx2-'));
    const a = await nx2.builds([tmp2]), b = await nx2.builds([tmp2]), none = await nx2.buildOf(path.join(tmp2, 'gone', 'eden.exe'));
    fs.rmSync(tmp2, { recursive: true, force: true });
    check('Beta: the Switch 2 build list is cached, each caller gets its own copy, and a missing build is null',
      Array.isArray(a) && Array.isArray(b) && a !== b && JSON.stringify(a) === JSON.stringify(b) && none === null, `${JSON.stringify(a)} ${JSON.stringify(b)} ${none}`);
  } catch (e) { check('Beta: config and version checks ran', false, e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e); }

  const { ctx, page, errors } = await newPage(browser, null);
  try {
    await page.goto(base + '?platform=windows&shelf=1&update=1');
    await page.waitForFunction(() => window.Shelf && Shelf._qs && Shelf._qs().g && window.Setup, null, { timeout: 90000, polling: 250 });
    const s = await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms));
      Setup.open({ page: 'sys' }); for (let i = 0; i < 40 && !document.querySelector('#bss.on .bss-row'); i++) await w(150);
      let btn = '';
      for (let i = 0; i < 30; i++) { await w(200); const r = [...document.querySelectorAll('#bss .bss-row')].find(e => /^Updates/.test(e.textContent.trim())); btn = r ? r.textContent.replace(/\s+/g, ' ') : ''; if (btn) break; }
      return { names: [...document.querySelectorAll('#bss .bss-row .nm')].map(e => e.textContent), btn }; });
    check('Beta (Windows): Settings → System has Report a bug online, Updates (Up to date: this build is the newest) and Check for new versions',
      s.names.includes('Report a bug online') && s.names.includes('Check for new versions') && s.names.includes('Updates') && !!SHOWN && /Up to date/.test(s.btn), JSON.stringify({ shown: SHOWN, updatesRow: s.btn, names: s.names }).slice(0, 600));
    // (beta.3) a game's manual page: its left column (Manual, Lock this manual, the console's choice), the cards and the first
    // page all have real width and fit the screen, for a game with a manual and one without (1.80 had squeezed the column to 0)
    const man = await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)), out = [];
      const G = await window.trustyshelf.manualGames({ systemId: 'gc' });
      for (const g of [G.find(x => x.status === 'have'), G.find(x => x.status === 'missing')]) {
        if (!g) { out.push({ none: true }); continue; }
        if (window.Settings && Settings.isOpen && Settings.isOpen()) { await Settings.close(); await w(800); }
        Setup.open({ page: 'manualgame', systemId: 'gc', file: g.file, title: g.title });
        for (let i = 0; i < 40 && !document.querySelector('#bss .bsm-pk .bsa-glock'); i++) await w(150); await w(1200);
        const box = s => { const e = document.querySelector('#bss ' + s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), w: e.offsetWidth }; }; // (w unscaled: Settings is drawn scaled to fit the window)
        const pk = document.querySelector('#bss .bsa-pk');
        out.push({ status: g.status, tpl: pk ? pk.style.gridTemplateColumns + ' / ' + getComputedStyle(pk).gridTemplateColumns + ' / ' + pk.className : '', page: box('.bsa-pk'), parts: box('.bsm-pk .bsa-parts'), lock: box('.bsm-pk .bsa-glock'), cards: box('.bsm-pk .bsa-cw'), first: box('.bsm-pk .bsm-pv') });
      }
      return out; });
    if (OUT) await page.screenshot({ path: path.join(OUT, 'beta-manual-page.png') }).catch(() => {});
    await page.evaluate(async () => { if (window.Settings && Settings.isOpen && Settings.isOpen()) { await Settings.close(); await new Promise(r => setTimeout(r, 800)); } });
    const fitsMan = m => m.parts && m.lock && m.cards && m.first && m.parts.w >= 240 && m.lock.w >= 220 && m.cards.w >= 300 && m.first.w >= 300
      && m.parts.r <= m.cards.l && m.cards.r <= m.first.l && m.first.r <= m.page.r + 2;
    check('Beta (Windows): a game\'s manual page has its left column, the cards and the first page side by side on screen (with and without a manual)',
      man.length === 2 && man.every(fitsMan), JSON.stringify(man).slice(0, 500));
    check('Beta pass (Windows page): no script errors', !errors.length, errors.slice(0, 3).join(' | '));
  } catch (e) { check('Beta pass (Windows page) ran to the end', false, e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e); }
  await ctx.close();

  // (beta.3) Settings → Switch 2 → Builds (the mock's ?sw2=1 shelf, three builds) and A on the theme tiles
  const w3 = await newPage(browser, null);
  try {
    await w3.page.goto(base + '?platform=windows&shelf=1&sw2=1');
    await w3.page.waitForFunction(() => window.Shelf && Shelf._qs && Shelf._qs().g && window.Setup, null, { timeout: 90000, polling: 250 });
    const b = await w3.page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)), out = {};
      const rowsNow = () => [...document.querySelectorAll('#bss .bss-row')].map(r => ({ nm: (r.querySelector('.nm') || {}).textContent || '', t: r.textContent.replace(/\s+/g, ' ').trim() }));
      const row = n => [...document.querySelectorAll('#bss .bss-row')].find(r => ((r.querySelector('.nm') || {}).textContent || '') === n);
      const click = async (n, ms = 500) => { const r = row(n); if (r) r.click(); await w(ms); return !!r; };
      const sw2 = async () => (await window.trustyshelf.getConfig()).config.systems.sw2;
      Setup.open({ page: 'sw2' }); for (let i = 0; i < 40 && !row('Builds'); i++) await w(150); await w(800);
      for (let i = 0; i < 20; i++) { out.consoleRow = (rowsNow().find(r => r.nm === 'Builds') || {}).t || ''; if (/builds found/.test(out.consoleRow)) break; await w(200); }
      await click('Builds', 900); out.page = rowsNow().map(r => r.nm);
      await click('Orchid v0.7.0', 900); let c = await sw2(); out.fixed = { ask: c.askBuild, emu: c.emulator, row: (rowsNow().find(r => r.nm === 'Orchid v0.7.0') || {}).t };
      await click('Ask each time', 900); c = await sw2(); out.ask = c.askBuild;
      await click('Add a folder of builds', 1500); c = await sw2(); out.added = { dirs: c.buildDirs, names: rowsNow().map(r => r.nm) };
      const f = rowsNow().find(r => /^Folder · /.test(r.nm)); if (f) { await click(f.nm, 200); await click(f.nm, 1500); }
      c = await sw2(); out.removed = { dirs: c.buildDirs, names: rowsNow().map(r => r.nm) };
      if (window.Settings && Settings.isOpen && Settings.isOpen()) { await Settings.close(); await w(800); } return out; });
    check('Beta (Windows): Settings → Switch 2 has a Builds page listing every build (the list Play shows) with Ask each time and ways to add more',
      /Builds/.test(b.consoleRow) && /3 builds found/.test(b.consoleRow) && /Ask each time/.test(b.consoleRow)
        && ['Ask each time', 'Selvet · Performance 6', 'Lichii pgo', 'Orchid v0.7.0', 'Add a folder of builds', 'Add a build'].every(n => b.page.includes(n)), JSON.stringify(b).slice(0, 500));
    check('Beta (Windows): choosing a build always starts in it; Ask each time goes back to the list at Play',
      b.fixed.ask === false && /orchid\.exe$/i.test(b.fixed.emu || '') && /✓ Always/.test(b.fixed.row || '') && b.ask === true, JSON.stringify({ fixed: b.fixed, ask: b.ask }));
    check('Beta (Windows): a folder of builds kept elsewhere adds its builds, and Remove (pressed twice) takes it off the list',
      (b.added.dirs || []).length === 1 && b.added.names.includes('Fork 1') && b.added.names.some(n => /^Folder · /.test(n))
        && (b.removed.dirs || []).length === 0 && !b.removed.names.includes('Fork 1'), JSON.stringify({ added: b.added, removed: b.removed }).slice(0, 500));
    // A on the theme tiles keeps the highlighted theme (it used to step on to the next one) and puts it on the shelf now
    const th = await w3.page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms));
      const key = k => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
      const on = () => { const t = document.querySelector('#bss .bss-tile.on span'); return t ? t.textContent : ''; };
      const cur = () => { const r = document.querySelector('#bss .bss-row.cur .nm'); return r ? r.textContent : ''; };
      Setup.open({ page: 'display' }); for (let i = 0; i < 40 && !document.querySelector('#bss.on .bss-tiles'); i++) await w(150); await w(600);
      for (let i = 0; i < 6 && cur() !== 'Theme'; i++) { key('ArrowDown'); await w(200); }
      key('ArrowRight'); await w(60); const picked = on(); key('Enter'); await w(120); const shelfNow = [...document.body.classList].filter(c => /^theme-/.test(c)).join(' ');
      key('Enter'); await w(300); const out = { row: cur(), picked, afterA: on(), shelfNow, saved: (await window.trustyshelf.getConfig()).config.ui.theme, toast: ((document.querySelector('#bss .bss-toast') || {}).textContent || '') };
      if (window.Settings && Settings.isOpen && Settings.isOpen()) { await Settings.close(); await w(800); }
      const c = (await window.trustyshelf.getConfig()).config; c.ui.theme = 'spectrum'; await window.trustyshelf.saveConfig(c); Shelf.setTheme(null); await w(300); return out; });
    check('Beta (Windows): A on a theme tile keeps that theme (twice: still the same), puts it on the shelf at once and says so',
      th.row === 'Theme' && !!th.picked && th.afterA === th.picked && !!th.shelfNow && /Theme: /.test(th.toast), JSON.stringify(th));
    // a console's box art games page never stays on "Loading…": a list that doesn't come says so after 20 s, and the page
    // asks again by itself (the first ask is made to hang here)
    const lg = await w3.page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)), api = window.trustyshelf, orig = api.artGames; let n = 0;
      api.artGames = a => (++n === 1 ? new Promise(() => {}) : orig(a));
      Setup.open({ page: 'artstudio', systemId: 'wii' }); const txt = () => ((document.querySelector('#bss .bsa-empty') || {}).textContent || '').trim();
      let said = ''; for (let i = 0; i < 60; i++) { await w(500); if (/took too long/.test(txt())) { said = txt(); break; } }
      const allN = () => { const p = [...document.querySelectorAll('#bss *')].find(e => e.children.length <= 2 && /^All\s*\d+$/.test((e.textContent || '').trim())); return p ? +p.textContent.replace(/\D/g, '') : 0; };
      let tiles = 0; for (let i = 0; i < 30; i++) { await w(500); tiles = !document.querySelector('#bss .bsa-empty') ? allN() : 0; if (tiles) break; }
      api.artGames = orig; const out = { said, tiles, asks: n, left: txt().slice(0, 80) };
      if (window.Settings && Settings.isOpen && Settings.isOpen()) { await Settings.close(); await w(800); } return out; });
    check('Beta (Windows): a box art games page that gets no list says so after 20 s and then loads by itself (no endless "Loading…")',
      /Couldn't load the games/.test(lg.said) && lg.asks >= 2 && lg.tiles > 0, JSON.stringify(lg));
    // (beta.11) the magazine finder says how big each download is, flags a big one and asks once more before a very big one
    const iaw = await w3.page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)), out = {};
      Setup.open({ page: 'reading' }); for (let i = 0; i < 30 && !document.querySelector('#bss.on .bss-row'); i++) await w(150); await w(600);
      const row = [...document.querySelectorAll('#bss .bss-row')].find(r => /Find on the Internet Archive/.test(r.textContent)); if (row) row.click();
      for (let i = 0; i < 30 && !document.querySelector('.ia-input'); i++) await w(150);
      const inp = document.querySelector('.ia-input'); if (inp) { inp.value = 'big issue'; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }
      const card = () => document.querySelector('.ia-card'); for (let i = 0; i < 40 && !card(); i++) await w(200); await w(500);
      out.text = card() ? card().innerText.replace(/\s+/g, ' ').slice(0, 160) : '';
      const b1 = card() && [...card().querySelectorAll('button')].find(x => x.textContent === 'Download'); if (b1) b1.click(); await w(250);
      out.armed = card() ? [...card().querySelectorAll('button')].map(x => x.textContent).join(' | ') : '';
      const b2 = card() && [...card().querySelectorAll('button')].find(x => /^Yes, download/.test(x.textContent)); if (b2) b2.click(); await w(500);
      out.started = card() ? [...card().querySelectorAll('button,.ia-state,.badge')].map(x => x.textContent).join(' | ') : '';
      const c2 = document.querySelectorAll('.ia-card')[1]; out.small = c2 ? c2.innerText.replace(/\s+/g, ' ').slice(0, 120) : '';
      if (Settings.isOpen && Settings.isOpen()) { await Settings.close(); await w(600); } return out; });
    check('Beta (Windows): the magazine finder shows each download\'s size, flags a big one, and a very big one asks "Yes, download 753 MB" before it starts',
      /753 MB/.test(iaw.text) && /Large download: 753 MB/.test(iaw.text) && /Yes, download 753 MB/.test(iaw.armed) && !/Yes, download/.test(iaw.started) && /Starting|Cancel|%/.test(iaw.started) && /40 MB/.test(iaw.small) && !/Large download/.test(iaw.small), JSON.stringify(iaw));
    // (beta.4) Quick menu → Updates: A checks now (the release check answers with this build's own version, so nothing is offered)
    const qu = await w3.page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)), api = window.trustyshelf;
      const key = k => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
      let opened = ''; const oe = api.openExternal; api.openExternal = async u => { opened = u; return true; };
      Shelf.homeButton(); await w(700);
      for (let i = 0; i < 20 && Shelf._qs().id !== 'upd'; i++) { key('ArrowDown'); await w(160); }
      const row = () => { const l = [...document.querySelectorAll('.qm-lbl')].find(x => x.textContent === 'Updates'), v = l && l.nextElementSibling; return v ? v.textContent : ''; };
      const out = { at: Shelf._qs().id, before: row() };
      key('Enter'); await w(900); out.after = row();
      out.menuOpen = Shelf.quickMenuOpen();
      api.openExternal = oe; if (Shelf.quickMenuOpen()) Shelf.homeButton(); await w(400); return out; });
    check('Beta (Windows): Quick menu → Updates opens on the Updates row and checks now; the row shows this build\'s version',
      qu.at === 'upd' && !!SHOWN && (qu.after.includes(SHOWN) || qu.before.includes(SHOWN)) && qu.menuOpen === true, JSON.stringify({ shown: SHOWN, qu }));
    check('Beta pass (Windows, Switch 2 builds): no script errors', !w3.errors.length, w3.errors.slice(0, 3).join(' | '));
  } catch (e) { check('Beta pass (Windows, Switch 2 builds) ran to the end', false, e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e); }
  await w3.ctx.close();

  // (beta.2) first run on Windows: box art is a plain Yes / Not now, and only Yes turns the download on
  const w2 = await newPage(browser, null);
  try {
    await w2.page.goto(base + '?platform=windows');
    await w2.page.waitForFunction(() => document.querySelector('#setup.on #suTitle'), null, { timeout: 90000, polling: 250 });
    const r = await w2.page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms));
      const title = () => (document.getElementById('suTitle') || {}).textContent || '';
      const next = () => [...document.querySelectorAll('#setup button')].find(b => b.textContent.trim() === 'Next' && !b.disabled);
      const seen = [];
      const self = [...document.querySelectorAll('#setup button')].find(b => /pick them myself/.test(b.textContent)); if (self) { self.click(); await w(400); }
      const lead = ((document.querySelector('#suBody .su-lead') || {}).textContent || '');
      for (let i = 0; i < 8 && !/Download box art\?/.test(title()); i++) { seen.push(title()); const n = next(); if (!n) break; n.click(); await w(400); }
      if (!/Download box art\?/.test(title())) return { ask: title(), seen, lead };
      const ask = title(), yes = !!document.querySelector('#setup [data-art="yes"]'), no = document.querySelector('#setup [data-art="no"]');
      if (!no) return { ask, seen };
      no.click(); await w(400); const after = title();
      const back = [...document.querySelectorAll('#setup button')].find(b => b.textContent.trim() === 'Back'); if (back) back.click(); await w(400);
      const ac = document.getElementById('wz2-ac'), on = ac ? ac.checked : null;
      return { ask, yes, after, backTo: title(), on, seen, lead };
    });
    check('Beta (Windows wizard): "I\'ll pick them myself" says what comes next instead of "didn\'t find any emulators"',
      !!r.lead && !/didn't find/.test(r.lead) && /Tick the consoles you play|found these/.test(r.lead), r.lead || 'no lead text');
    check('Beta (Windows wizard): box art is asked as Yes / Not now; Not now moves on and leaves the download off',
      /Download box art\?/.test(r.ask) && r.yes && r.after && !/Download box art\?/.test(r.after) && /How should your boxes look\?/.test(r.backTo) && r.on === false,
      JSON.stringify(r).slice(0, 400));
    check('Beta pass (Windows wizard): no script errors', !w2.errors.length, w2.errors.slice(0, 3).join(' | '));
  } catch (e) { check('Beta pass (Windows wizard) ran to the end', false, e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e); }
  await w2.ctx.close();

  // (beta.11) the museum's file box (?mags=1: three Nintendo Power issues): A fans them out, Y / P picks the one you're on
  // up into your hands (still in its bag), it turns, B puts it back and the fan returns, with no stand-in left behind
  const w4 = await newPage(browser, null);
  try {
    await w4.page.goto(base + '?platform=windows&shelf=1&mags=1');
    await w4.page.waitForFunction(() => window.Shelf && Shelf._qs && Shelf._qs().g, null, { timeout: 90000, polling: 250 });
    const f = await w4.page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)), out = {};
      const key = k => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
      const st = () => { const c = Museum.current() || {}; return c.stack ? 'stack' : c.fan ? 'fan' : c.lib ? 'lib' : c.wide ? 'wide:' + c.wide.label : 'other'; };
      key('m'); for (let i = 0; i < 80 && Shelf.getMode() !== 'museum'; i++) await w(250); await w(4000);
      for (let i = 0; i < 6 && Museum._dv && Museum._dv(); i++) { Museum.skipDelivery(); await w(800); }
      for (let i = 0; i < 60 && !((Museum._rack && Museum._rack()) || []).some(x => x.box); i++) await w(300);
      const it = (Museum._rack() || []).find(x => x.box); if (!it) return { nobox: true };
      Museum.setRow(it.ri); await w(500);
      for (let i = 0; i < 10 && !/^wide:Magazines|^lib|^stack/.test(st()); i++) { Museum.move(1, 0); await w(600); }
      if (/^wide:/.test(st())) { Museum.activate(); await w(1200); }
      for (let i = 0; i < 8 && st() !== 'stack'; i++) { Museum.move(1, 0); await w(600); }
      out.at = st(); key('Enter'); await w(1500); out.fan = st(); out.items0 = Museum._rack().length;
      const t0 = (Museum.current() || {}).lib; out.t0 = t0 && t0.title;
      // (waits for each state, up to a few seconds: GitHub's software-drawn runner is slower than a PC)
      const until = async (fn, ms) => { for (let i = 0; i < ms / 150 && !fn(); i++) await w(150); };
      key('p'); await until(() => Museum.isHolding(), 6000); await w(400); out.held = Museum.isHolding(); out.hint = [...document.querySelectorAll('#musHints > *')].map(h => h.textContent.trim()).join(' | ');
      key('ArrowRight'); await w(500); key('e'); await w(300); key('q'); await w(600); // (Q / E, L1 / R1 used to flip the fan behind the issue in your hands)
      const t1 = (Museum.current() || {}).lib; out.t1 = t1 && t1.title;
      key('Escape'); await until(() => !Museum.isHolding() && st() === 'fan', 6000); await w(400);
      out.back = st(); out.holding = Museum.isHolding(); out.items1 = Museum._rack().length; const t2 = (Museum.current() || {}).lib; out.t2 = t2 && t2.title;
      key('Escape'); await until(() => st() === 'stack', 6000); out.closed = st(); return out; });
    const fd = f.nobox ? { nobox: true } : { back: f.back, holding: f.holding, items: f.items0 + '>' + f.items1, closed: f.closed, at: f.at, fan: f.fan, held: f.held, same: f.t1 === f.t0 && f.t2 === f.t0, t0: f.t0, hint: f.hint };
    check('Museum (beta.11): in a file box\'s fan, Y / P picks the issue up into your hands (in its bag), and B puts it back into the fan, nothing left behind',
      f.at === 'stack' && f.fan === 'fan' && f.held === true && /Turn/.test(f.hint) && !!f.t0 && f.t1 === f.t0 && f.t2 === f.t0 && f.back === 'fan' && f.holding === false && f.items1 === f.items0 && f.closed === 'stack', JSON.stringify(fd));
    // (beta.11) A on a console with no 3D model of its own opens "Add a 3D model" (a file on this PC, or a free model site); Not now closes it
    const am = await w4.page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)), out = {};
      const key = k => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
      for (let i = 0; i < 4 && Museum.isHolding(); i++) { key('Escape'); await w(600); }
      Museum.setRow(0); await w(600); Museum.toConsole && Museum.toConsole(); await w(1200);
      const c = Museum.current() || {}; out.onConsole = !!c.console; out.hasModel = !!(Museum.consoleFit && Museum.consoleFit());
      key('Enter'); await w(700); const el = document.getElementById('musAdd'); out.open = !!(el && el.classList.contains('on'));
      out.rows = el ? [...el.querySelectorAll('.mr-row .mr-lbl')].map(r => r.textContent.trim()) : [];
      key('ArrowUp'); await w(250); out.last = el && (el.querySelector('.mr-row.on .mr-lbl') || {}).textContent;
      key('Enter'); await w(500); out.closed = !(el && el.classList.contains('on')); out.holding = Museum.isHolding(); return out; });
    check('Museum (beta.11): A on a console with no 3D model of its own opens "Add a 3D model" (a file, Sketchfab, Poly Pizza, Not now); Not now closes it',
      am.onConsole && !am.hasModel && am.open && am.rows.length === 4 && /model file on this PC/.test(am.rows[0]) && /Sketchfab/.test(am.rows[1]) && am.last === 'Not now' && am.closed && !am.holding, JSON.stringify(am));
    check('Museum file box pass: no script errors', !w4.errors.length, w4.errors.slice(0, 3).join(' | '));
  } catch (e) { check('Museum file box pass ran to the end', false, e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e); }
  await w4.ctx.close();
};
