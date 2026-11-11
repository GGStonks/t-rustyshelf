// (T)rustyShelf's folder scan for Add games (main/addgames.js; Boxshelf's folder-scan freeze). Run: node linux/ci/addgames-test.js
//   - the async scan finds the same games as the synchronous one (main program picked the same way, helpers and
//     loose programs handled the same)
//   - a big folder doesn't hold the main process up: the event loop keeps getting turns during the scan
// Everything in a made-up folder.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..', '..');
const ag = require(path.join(ROOT, 'main', 'addgames.js'));
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 500))); if (!ok) fails++; };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tsaddgames-'));
const mk = (p, body) => { const f = path.join(tmp, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body == null ? 'x' : body); return f; };

(async () => {
  try {
    // a small folder of games: one folder per game, a nested bin folder, helpers, a loose program
    mk('Games/Alpha-Game.v1.2/Alpha.exe', 'a'.repeat(900)); mk('Games/Alpha-Game.v1.2/UnityCrashHandler64.exe', 'c'.repeat(9000)); mk('Games/Alpha-Game.v1.2/unins000.exe');
    mk('Games/Beta.Two/bin/x64/Launcher.exe', 'b'.repeat(500)); mk('Games/Beta.Two/bin/x64/Beta_Two_Main.exe', 'b'.repeat(5000));
    mk('Games/Gamma/redist/vcredist.exe'); mk('Games/Gamma/Gamma.exe', 'g'.repeat(300));
    mk('Games/Dangerous-Dave/DangerousDave.exe', 'd'.repeat(400)); mk('Games/Dangerous-Dave/cover.jpg', 'img');
    mk('Games/Native-Runner/run.sh', '#!/bin/sh');
    mk('Games/loose-tool.exe', 't'); mk('Games/readme.txt', 'r');
    const sync = ag.scanFolder(path.join(tmp, 'Games')), asyn = await ag.scanFolderAsync(path.join(tmp, 'Games'));
    const shape = r => r.games.map(g => [g.title, path.relative(tmp, g.exe), g.others.map(o => path.basename(o))]);
    check('Same games as the synchronous scan', JSON.stringify(shape(sync)) === JSON.stringify(shape(asyn)), JSON.stringify([shape(sync), shape(asyn)]));
    check('Main program is the one named like its folder, nested bin folders included', shape(asyn).some(([t, exe]) => t === 'Beta Two' && exe.endsWith('Beta_Two_Main.exe')), JSON.stringify(shape(asyn)));
    check('Helpers and folders to skip are left out', !shape(asyn).some(([, exe]) => /unins|vcredist|Crash/i.test(exe)) && !shape(asyn).some(([t]) => t === 'redist'));
    const dd = asyn.games.find(g => g.title === 'Dangerous Dave');
    check('Hyphens and dots in folder names cleaned nicely', !!dd, JSON.stringify(asyn.games.map(g => g.title)));
    check('Local folder cover detected during scan', dd && dd.cover && dd.cover.endsWith('cover.jpg'), JSON.stringify(dd));
    const nr = asyn.games.find(g => g.title === 'Native Runner');
    check('Linux script executable detected on Linux', !!nr && nr.exe.endsWith('run.sh'), JSON.stringify(nr));
    const gone = await ag.scanFolderAsync(path.join(tmp, 'nope'));
    check('A missing folder is reported, not thrown', gone.error && gone.games.length === 0, JSON.stringify(gone));

    // (issue 4) a folder of category folders: each category is stepped into, its games are games of their own; a game whose
    // program sits in bin\ or under its own subfolders stays one game; folders with only an installer are listed as skipped
    mk('Lib/Racing/Blur/Blur.exe', 'b'.repeat(800)); mk('Lib/Racing/FlatOut 2/FlatOut2.exe', 'f'.repeat(800)); mk('Lib/Racing/Grip/bin/Grip.exe', 'g'.repeat(800));
    mk('Lib/Racing/Unreal Racer/Engine/Binaries/Win64/CrashReportClient.exe', 'c'.repeat(90)); mk('Lib/Racing/Unreal Racer/Racer/Binaries/Win64/Racer-Win64-Shipping.exe', 'u'.repeat(900));
    mk('Lib/Racing/FUEL-P2P/setup.exe', 's'); mk('Lib/Racing/FUEL-P2P/data-1.rar', 'r');
    mk('Lib/2D games/Retro/Dangerous Dave/dave.exe', 'd'.repeat(300)); mk('Lib/2D games/Retro/Commander Keen/keen.exe', 'k'.repeat(300));
    mk('Lib/2D games/Celeste/Celeste.exe', 'c'.repeat(300));
    mk('Lib/Solo Game/Solo.exe', 's'.repeat(500)); mk('Lib/Solo Game/Tools/Editor/editor.exe', 'e'.repeat(50));
    const cat = await ag.scanFolderAsync(path.join(tmp, 'Lib')), ct = cat.games.map(g => g.title).sort();
    check('Category folders are stepped into: each game inside is its own entry, two levels deep too', ['Blur', 'Celeste', 'Commander Keen', 'Dangerous Dave', 'FlatOut 2', 'Grip', 'Solo Game', 'Unreal Racer'].every(t => ct.includes(t)) && !ct.includes('Racing') && !ct.includes('2D games') && !ct.includes('Retro'), JSON.stringify(ct));
    const ur = cat.games.find(g => g.title === 'Unreal Racer');
    check('A game with its program deep in its own folders stays one game, its real program picked', !!ur && /Racer-Win64-Shipping\.exe$/.test(ur.exe) && ct.length === 8, JSON.stringify(cat.games.map(g => [g.title, path.basename(g.exe)])));
    check('A game found inside a category says which one (group)', (cat.games.find(g => g.title === 'Blur') || {}).group === 'Racing' && (cat.games.find(g => g.title === 'Commander Keen') || {}).group === path.join('2D games', 'Retro'), JSON.stringify(cat.games.map(g => [g.title, g.group])));
    const sk = (cat.skipped || []).find(s => /FUEL/.test(s.folder));
    check('A folder with only an installer is listed as skipped, with the reason', !!sk && sk.why === 'only an installer', JSON.stringify(cat.skipped));

    // a big folder: 400 game folders, each with a few nested folders and files
    const big = path.join(tmp, 'Big');
    for (let i = 0; i < 400; i++) { for (let j = 0; j < 4; j++) mk(`Big/Game ${i}/sub${j}/data${j}.pak`, 'p'); mk(`Big/Game ${i}/Game${i}.exe`, 'e'.repeat(1000 + i)); }
    let last = Date.now(), worst = 0, ticks = 0, running = true;
    const timer = setInterval(() => { const now = Date.now(); worst = Math.max(worst, now - last); last = now; ticks++; }, 5);
    const t0 = Date.now(); const r = await ag.scanFolderAsync(big, 1000); const took = Date.now() - t0;
    running = false; clearInterval(timer);
    check('Big folder: every game found', r.games.length === 400, r.games.length);
    check('Big folder: the window gets turns during the scan', ticks >= 2, 'ticks ' + ticks + ' in ' + took + ' ms');
    check('Big folder: no single stall longer than 250 ms', worst < 250, 'worst stall ' + worst + ' ms over ' + took + ' ms');
    void running;
  } catch (e) { check('the test ran', false, e.stack || e.message); }
  finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  console.log(fails ? `\n${fails} check(s) failed` : '\nall checks passed');
  process.exit(fails ? 1 : 0);
})();
