// Device test pass "pcgames" (beta.4), run by web-device-test.js. Checks results, never speed.
//   Node (main/pcgames.js on made-up folders): Epic's install list keeps installed games only (not the engine, plugins or
//   half-installed ones) and starts them through the launcher's link; Quiver 3 (apps.json beside its program) and Quiver 4
//   (installs.json + library.json) give each installed app its program and name; games added by hand whose program is
//   gone are left out; a saved config keeps only clean entries.
//   The demo page as Windows with ?pcx=1: the PC shelf has the Epic game, a Custom shelf has the Quiver recomp; Play on it
//   goes through launch:pc by id (and back to the shelf when it closes), the Epic game says it starts through Epic;
//   Settings → Custom games adds a program, names it, removes it (twice); Settings → PC games has the Epic switch.
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');

module.exports = async function pcGamesPass({ browser, base, check, newPage }) {
  const root = path.resolve(__dirname, '..', '..');
  try {
    const pcg = require(path.join(root, 'main', 'pcgames.js'));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bs-pc-'));
    const mk = (p, body) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, body); };
    // Epic: a game, the engine, a plugin, a half-installed game, a game whose folder is gone
    const man = path.join(tmp, 'Manifests'), inst = path.join(tmp, 'Epic Games');
    mk(path.join(inst, 'Ember', 'Ember.exe'), 'MZ'); mk(path.join(inst, 'UE', 'x'), ''); mk(path.join(inst, 'Half', 'x'), '');
    const item = (f, o) => mk(path.join(man, f + '.item'), JSON.stringify(o));
    item('a', { DisplayName: 'Ember Trail', AppName: 'Ember', CatalogNamespace: 'ns1', CatalogItemId: 'it1', InstallLocation: path.join(inst, 'Ember'), LaunchExecutable: 'Ember.exe', AppCategories: ['public', 'games', 'applications'] });
    item('b', { DisplayName: 'Unreal Engine', AppName: 'UE_5.4', InstallLocation: path.join(inst, 'UE'), AppCategories: ['engines'] });
    item('c', { DisplayName: 'A Plugin', AppName: 'plug', InstallLocation: path.join(inst, 'UE'), AppCategories: ['plugins'] });
    item('d', { DisplayName: 'Half Done', AppName: 'Half', InstallLocation: path.join(inst, 'Half'), bIsIncompleteInstall: true, AppCategories: ['games'] });
    item('e', { DisplayName: 'Gone', AppName: 'Gone', InstallLocation: path.join(inst, 'Gone'), AppCategories: ['games'] });
    const epic = pcg.epicGames(man);
    check('PC games: Epic lists installed games only, started through the Epic launcher\'s link',
      epic.length === 1 && epic[0].title === 'Ember Trail' && epic[0].uri === 'com.epicgames.launcher://apps/ns1%3Ait1%3AEmber?action=launch&silent=true', JSON.stringify(epic));
    // Quiver 3 (portable): apps.json + settings.json beside its program, the games in Apps\<folder>; one listed app not installed
    const q3 = path.join(tmp, 'QuiverLauncher-win-Portable');
    mk(path.join(q3, 'QuiverLauncher.exe'), 'MZ');
    mk(path.join(q3, 'apps.json'), JSON.stringify({ apps: [{ name: 'Quarantine', folderName: 'Quarantine-Recomp', installPath: null, appIconUrl: 'https://cdn.example/icon.png', repository: 'acr/quarantine', tags: ['recomp'] }, { name: 'Not Installed', folderName: 'Nope', repository: 'x/nope' }] }));
    mk(path.join(q3, 'settings.json'), JSON.stringify({ AppsPath: '', UserAppDisplayNames: {} }));
    mk(path.join(q3, 'Apps', 'Quarantine-Recomp', 'Quarantine.exe'), 'MZ' + 'x'.repeat(5000)); mk(path.join(q3, 'Apps', 'Quarantine-Recomp', 'unins000.exe'), 'MZ' + 'x'.repeat(9000));
    const g3 = pcg.quiverGames(q3);
    check('PC games: Quiver 3 gives each installed app its program and name (not the uninstaller, not apps that aren\'t installed)',
      g3.length === 1 && g3[0].title === 'Quarantine' && /Quarantine\.exe$/.test(g3[0].exe) && g3[0].source === 'quiver', JSON.stringify(g3.map(g => ({ t: g.title, e: path.basename(g.exe) }))));
    // Quiver 4: installs.json + library.json (the player's own name wins)
    const q4 = path.join(tmp, 'q4');
    mk(path.join(q4, 'installs.json'), JSON.stringify({ 'github:a/ship': { version: '1', folder: 'Ship', executables: ['soh.exe'] } }));
    mk(path.join(q4, 'library.json'), JSON.stringify([{ id: 'github:a/ship', slug: 'ship', overrides: { name: 'Ship of Harkinian' } }]));
    mk(path.join(q4, 'apps', 'Ship', 'soh.exe'), 'MZ');
    const g4 = pcg.quiverGames(q4);
    check('PC games: Quiver 4 gives each install its program and the name the player chose',
      g4.length === 1 && g4[0].title === 'Ship of Harkinian' && /soh\.exe$/.test(g4[0].exe), JSON.stringify(g4.map(g => ({ t: g.title, e: path.basename(g.exe) }))));
    // games added by hand: a missing program is left out; the config keeps clean entries only
    const c = pcg.customGames([{ id: 'a', title: 'Mine', exe: path.join(q3, 'QuiverLauncher.exe') }, { id: 'b', title: 'Gone', exe: path.join(tmp, 'gone.exe') }]);
    const config = require(path.join(root, 'main', 'config.js'));
    const clean = config.normalize({ pc: { custom: [{ title: 'Ok', exe: 'C:\\x.exe' }, { title: 'No exe' }, 'junk'], epic: 'yes' } }).pc;
    fs.rmSync(tmp, { recursive: true, force: true });
    check('PC games: a hand-added game whose program is gone is left out; a saved config keeps clean entries only',
      c.length === 1 && c[0].title === 'Mine' && clean.custom.length === 1 && clean.custom[0].exe === 'C:\\x.exe' && clean.epic === true, JSON.stringify({ c, clean }));
  } catch (e) { check('PC games: module checks ran', false, e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e); }

  const { ctx, page, errors } = await newPage(browser, null);
  try {
    await page.goto(base + '?platform=windows&shelf=1&pcx=1');
    await page.waitForFunction(() => window.Shelf && Shelf._qs && Shelf._qs().g && window.Setup, null, { timeout: 90000, polling: 250 });
    await page.waitForTimeout(1500);
    const sh = await page.evaluate(() => ({ counts: Shelf.gameCounts(), tabs: [...document.querySelectorAll('#tabs > *')].map(e => e.textContent.trim()) }));
    check('PC games (Windows): a Custom shelf (its own tab) holds the Quiver recomp; the PC shelf has one more game (Epic\'s)',
      sh.tabs.includes('Custom') && sh.counts.custom === 1 && sh.counts.pc >= 1, JSON.stringify(sh)); // (the demo has no Steam folder: PC holds Epic's game only)
    // to the Custom shelf (↓ walks the shelves), then Play: launch:pc by id, the launch screen, back to the shelf when it closes
    const play = await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms));
      const key = k => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
      const word = () => (document.getElementById('sysWord') || {}).textContent || '';
      for (let i = 0; i < 20 && !/Custom/i.test(word()); i++) { key('ArrowDown'); await w(500); }
      const out = { shelf: word(), game: Shelf._qs().g };
      key('i'); await w(900); out.how = ((document.getElementById('dDesc') || {}).textContent || '') + ' ' + ((document.getElementById('dHow') || {}).textContent || ''); out.chips = ((document.getElementById('dChips') || {}).textContent || ''); key('i'); await w(700);
      key('Enter'); await w(1500); out.mode = Shelf.getMode(); out.launched = (window.__pcLaunched || []).slice();
      for (let i = 0; i < 40 && Shelf.getMode() !== 'browse'; i++) await w(250); out.back = Shelf.getMode();
      // the PC shelf's Epic game: details say Epic, Play hands it to the Epic launcher by id, Back returns to the shelf
      for (let i = 0; i < 20 && !word().trim().startsWith('PC'); i++) { key('ArrowUp'); await w(500); } // (the word carries its tagline)
      for (let i = 0; i < 10 && Shelf._qs().g !== 'Ember Trail'; i++) { key('ArrowRight'); await w(350); }
      out.epic = { shelf: word(), game: Shelf._qs().g };
      if (out.epic.game !== 'Ember Trail') return out; // never Play some other game
      key('i'); await w(900); out.epic.how = ((document.getElementById('dDesc') || {}).textContent || '') + ' ' + ((document.getElementById('dHow') || {}).textContent || ''); out.epic.chips = ((document.getElementById('dChips') || {}).textContent || ''); key('i'); await w(700);
      key('Enter'); await w(1600); out.epic.launched = (window.__pcLaunched || []).includes('epic-ember-trail'); out.epic.mode = Shelf.getMode();
      key('Escape'); for (let i = 0; i < 20 && Shelf.getMode() !== 'browse'; i++) await w(250); out.epic.back = Shelf.getMode(); return out; });
    check('PC games (Windows): the Epic game on the PC shelf says it starts through Epic, Play hands it over by id, Back returns',
      play.epic.game === 'Ember Trail' && /Epic/.test(play.epic.how) && /Epic Games/.test(play.epic.chips) && play.epic.launched && play.epic.back === 'browse', JSON.stringify(play.epic));
    check('PC games (Windows): Play on a Custom shelf game starts it by id (launch:pc) and the shelf comes back when it closes',
      /Custom/i.test(play.shelf) && play.game === 'Quarantine' && play.launched.includes('quiver-quarantine') && play.mode === 'launch' && play.back === 'browse', JSON.stringify(play));
    check('PC games (Windows): a Quiver game says where it came from (no Steam wording)', /Quiver/.test(play.how + play.chips) && !/Steam/.test(play.how), JSON.stringify({ how: play.how, chips: play.chips }));
    // Settings → Custom games: add a program (named from its file), rename it, remove it (twice); PC games has the Epic switch
    const st = await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)), out = {};
      const names = () => [...document.querySelectorAll('#bss .bss-row .nm')].map(e => e.textContent);
      const row = n => [...document.querySelectorAll('#bss .bss-row')].find(r => ((r.querySelector('.nm') || {}).textContent || '') === n);
      const cfg = async () => (await window.boxshelf.getConfig()).config.pc || {};
      for (let i = 0; i < 40 && Shelf.getMode() !== 'browse'; i++) await w(250); // (Settings opens from the shelf only)
      Setup.open({ page: 'pc' }); for (let i = 0; i < 40 && !document.querySelector('#bss.on .bss-row'); i++) await w(150); await w(600);
      out.pcPage = names();
      if (window.Settings && Settings.isOpen && Settings.isOpen()) { await Settings.close(); await w(800); }
      Setup.open({ page: 'custom' }); for (let i = 0; i < 40 && !row('Add a game'); i++) await w(150); await w(800);
      out.page = names(); out.quiverRow = (row('Quiver Launcher') || {}).textContent || '';
      row('Add a game').click(); await w(1200); out.added = (await cfg()).custom; out.after = names();
      const rm = names().find(n => /^Remove /.test(n)); if (rm) { row(rm).click(); await w(300); row(rm).click(); await w(1200); }
      out.removed = (await cfg()).custom;
      if (window.Settings && Settings.isOpen && Settings.isOpen()) { await Settings.close(); await w(800); } return out; });
    check('PC games (Windows): Settings → PC games has the Epic switch; Custom games has Quiver and Add a game',
      st.pcPage.includes('Show installed Epic Games') && st.page.includes("Show Quiver's games") && st.page.includes('Add a game') && /Found/.test(st.quiverRow), JSON.stringify({ pc: st.pcPage, page: st.page, q: st.quiverRow }).slice(0, 500));
    check('PC games (Windows): Add a game puts the program on the Custom shelf named from its file; Remove (pressed twice) takes it off',
      (st.added || []).length === 1 && st.added[0].title === 'program' && /program\.exe$/.test(st.added[0].exe) && st.after.includes('program') && (st.removed || []).length === 0, JSON.stringify({ added: st.added, removed: st.removed }).slice(0, 400));
    check('PC games pass (Windows page): no script errors', !errors.length, errors.slice(0, 3).join(' | '));
  } catch (e) { check('PC games pass (Windows page) ran to the end', false, e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e); }
  await ctx.close();

  // (beta.4) a big library (?big=3000: 3,000 games on every console): the shelf builds only the cases near the one in view,
  // so the page stays small however far you scroll or page through (measured: 21,000 games, ~27 cases, ~30 MB)
  const big = await newPage(browser, null);
  try {
    await big.page.goto(base + '?platform=windows&shelf=1&big=3000');
    await big.page.waitForFunction(() => window.Shelf && Shelf._qs && Shelf._qs().g && Shelf.getMode() === 'browse', null, { timeout: 120000, polling: 250 });
    const b = await big.page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms));
      const key = k => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
      const total = Object.values(Shelf.gameCounts()).reduce((a, x) => a + x, 0); let most = 0;
      for (let i = 0; i < 40; i++) { key('ArrowRight'); await w(90); most = Math.max(most, document.querySelectorAll('#track > *').length); }
      for (let i = 0; i < 15; i++) { key('e'); await w(160); most = Math.max(most, document.querySelectorAll('#track > *').length); }
      key('ArrowDown'); await w(900); most = Math.max(most, document.querySelectorAll('#track > *').length);
      return { total, most, nodes: document.getElementsByTagName('*').length, game: Shelf._qs().g }; });
    check('Big library (21,000 games): the shelf keeps only the cases near the one in view (the page stays small while scrolling)',
      b.total >= 20000 && b.most > 0 && b.most <= 60 && b.nodes < 4000 && !!b.game, JSON.stringify(b));
    check('Big library pass: no script errors', !big.errors.length, big.errors.slice(0, 3).join(' | '));
  } catch (e) { check('Big library pass ran to the end', false, e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e); }
  await big.ctx.close();
};
