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
    mk('Games/loose-tool.exe', 't'); mk('Games/readme.txt', 'r');
    const sync = ag.scanFolder(path.join(tmp, 'Games')), asyn = await ag.scanFolderAsync(path.join(tmp, 'Games'));
    const shape = r => r.games.map(g => [g.title, path.relative(tmp, g.exe), g.others.map(o => path.basename(o))]);
    check('Same games as the synchronous scan', JSON.stringify(shape(sync)) === JSON.stringify(shape(asyn)), JSON.stringify([shape(sync), shape(asyn)]));
    check('Main program is the one named like its folder, nested bin folders included', shape(asyn).some(([t, exe]) => t === 'Beta Two' && exe.endsWith('Beta_Two_Main.exe')), JSON.stringify(shape(asyn)));
    check('Helpers and folders to skip are left out', !shape(asyn).some(([, exe]) => /unins|vcredist|Crash/i.test(exe)) && !shape(asyn).some(([t]) => t === 'redist'));
    const gone = await ag.scanFolderAsync(path.join(tmp, 'nope'));
    check('A missing folder is reported, not thrown', gone.error && gone.games.length === 0, JSON.stringify(gone));

    // a big folder: 400 game folders, each with a few nested folders and files
    const big = path.join(tmp, 'Big');
    for (let i = 0; i < 400; i++) { for (let j = 0; j < 4; j++) mk(`Big/Game ${i}/sub${j}/data${j}.pak`, 'p'); mk(`Big/Game ${i}/Game${i}.exe`, 'e'.repeat(1000 + i)); }
    let last = Date.now(), worst = 0, ticks = 0, running = true;
    const timer = setInterval(() => { const now = Date.now(); worst = Math.max(worst, now - last); last = now; ticks++; }, 5);
    const t0 = Date.now(); const r = await ag.scanFolderAsync(big, 1000); const took = Date.now() - t0;
    running = false; clearInterval(timer);
    check('Big folder: every game found', r.games.length === 400, r.games.length);
    check('Big folder: the window gets turns during the scan', ticks >= 5, 'ticks ' + ticks + ' in ' + took + ' ms');
    check('Big folder: no single stall longer than 250 ms', worst < 250, 'worst stall ' + worst + ' ms over ' + took + ' ms');
    void running;
  } catch (e) { check('the test ran', false, e.stack || e.message); }
  finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  console.log(fails ? `\n${fails} check(s) failed` : '\nall checks passed');
  process.exit(fails ? 1 : 0);
})();
