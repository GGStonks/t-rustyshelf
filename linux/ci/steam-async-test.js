// Boxshelf beta issue 34: (T)rustyShelf stayed "not responding" at launch, its log ending at "Steam: found it". The library
// build reads Steam's libraries without holding the app up, a library that doesn't answer is left out, and the stall watch
// writes to the log while the main process is stuck. Run: node linux/ci/steam-async-test.js
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 400))); if (!ok) fails++; };
const root = path.join(__dirname, '..', '..');
const steam = require(path.join(root, 'main', 'steam.js')), stallwatch = require(path.join(root, 'main', 'stallwatch.js'));
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-steamasync-'));
const mk = (p, s) => { const f = path.join(T, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s == null ? 'x' : s); return f; };
const acf = (id, name, flags, dir, size) => `"AppState"\n{\n\t"appid"\t\t"${id}"\n\t"name"\t\t"${name}"\n\t"StateFlags"\t\t"${flags}"\n\t"installdir"\t\t"${dir}"\n\t"SizeOnDisk"\t\t"${size}"\n}\n`;
const esc = p => p.replace(/\\/g, '\\\\');
(async () => {
  try {
    const lib2 = path.join(T, 'SteamLibrary'), dead = path.join(T, 'AsleepDrive');
    mk('Steam/steamapps/libraryfolders.vdf', `"libraryfolders"\n{\n\t"0"\n\t{\n\t\t"path"\t\t"${esc(path.join(T, 'Steam'))}"\n\t}\n\t"1"\n\t{\n\t\t"path"\t\t"${esc(lib2)}"\n\t}\n\t"2"\n\t{\n\t\t"path"\t\t"${esc(dead)}"\n\t}\n}\n`);
    mk('Steam/steamapps/appmanifest_10.acf', acf(10, 'Installed Game', 4, 'Installed Game', 1000));
    mk('Steam/steamapps/appmanifest_20.acf', acf(20, 'Update Waiting', 1026, 'Update Waiting', 5000)); mk('Steam/steamapps/common/Update Waiting/game.exe');
    mk('Steam/steamapps/appmanifest_30.acf', acf(30, 'Still Downloading', 1026, 'Still Downloading', 0));
    mk('Steam/steamapps/appmanifest_40.acf', acf(40, 'Proton 9.0', 4, 'Proton 9.0', 100));
    mk('Steam/userdata/1/config/localconfig.vdf', '"UserLocalConfigStore"{"Software"{"Valve"{"Steam"{"apps"{"10"{"Playtime"\t"42"}}}}}}');
    mk('Steam/appcache/librarycache/10_library_600x900.jpg');
    mk('SteamLibrary/steamapps/appmanifest_50.acf', acf(50, 'Other Drive Game', 4, 'Other Drive Game', 100));
    mk('AsleepDrive/steamapps/appmanifest_60.acf', acf(60, 'Asleep Game', 4, 'Asleep Game', 100));
    const titles = l => l.map(g => g.title).sort();
    // the same games as the old read, while every drive answers
    const syncList = steam.scanSteam(path.join(T, 'Steam')), asyncList = await steam.scanSteamAsync(path.join(T, 'Steam'));
    check('every drive answering: the same games as before, with playtime and Steam\'s cover', JSON.stringify(titles(asyncList)) === JSON.stringify(titles(syncList)) && titles(asyncList).includes('Asleep Game')
      && asyncList.find(g => g.appid === '10').minutes === 42 && /10_library_600x900\.jpg$/.test(asyncList.find(g => g.appid === '10').art.front || ''), JSON.stringify([titles(asyncList), titles(syncList)]));
    // a library on a drive that never answers
    const real = steam._io.stat; steam._io.stat = p => String(p).startsWith(dead) ? new Promise(() => {}) : real(p);
    const logs = [], t0 = Date.now(); let ticks = 0; const ti = setInterval(() => ticks++, 20);
    const got = await steam.scanSteamAsync(path.join(T, 'Steam'), { waitMs: 400, log: m => logs.push(m) }); const took = Date.now() - t0;
    clearInterval(ti);
    check('a drive that never answers: the scan finishes after the time limit without it', took < 2500 && JSON.stringify(titles(got)) === JSON.stringify(['Installed Game', 'Other Drive Game', 'Update Waiting']), took + ' ms ' + JSON.stringify(titles(got)));
    check('the app kept running while it waited (timers went on)', ticks >= 10, ticks);
    check('the log says a library didn\'t answer, without its path', logs.some(l => /didn't answer within 0 s|didn't answer within/.test(l)) && !logs.some(l => l.includes(T)), JSON.stringify(logs));
    const t1 = Date.now(); const again = await steam.scanSteamAsync(path.join(T, 'Steam'), { waitMs: 400, log: () => {} });
    check('the next library build leaves that drive out without waiting again', Date.now() - t1 < 300 && titles(again).length === 3, (Date.now() - t1) + ' ms');
    steam._io.stat = real;
    // the Steam folder itself on a drive that never answers
    steam._io.stat = p => String(p).startsWith(path.join(T, 'Steam')) ? new Promise(() => {}) : real(p);
    const l2 = []; const none = await steam.scanSteamAsync(path.join(T, 'Steam'), { waitMs: 300, log: m => l2.push(m) });
    check('the Steam folder itself not answering: no Steam games this time, and the log says so', none.length === 0 && l2.some(l => /didn't answer/.test(l)), JSON.stringify(l2));
    steam._io.stat = real;
    // the library build uses it
    const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8'), lib = main.slice(main.indexOf('async function buildLibrary'), main.indexOf('async function buildLibrary') + 9000);
    check('the library build reads Steam with the time-limited read', /await scanSteamAsync\(/.test(lib) && !/[^.\w]scanSteam\(/.test(lib) && /await steamRootAsync\(cfg\.steam\.path\)/.test(lib), '');
    check('the stall watch starts with the app and hears each step', /stallwatch\.start\(LOG\)/.test(main) && /stallwatch\.mark\(lastEvent\)/.test(main), '');
    // the stall watch: a main process stuck for good is logged while it lasts
    const log = path.join(T, 'app.log'); fs.writeFileSync(log, '');
    check('the stall watch starts', stallwatch.start(log, { steps: [0.4, 1], every: 40, tick: 40 }), '');
    await new Promise(r => setTimeout(r, 300));
    stallwatch.mark('scan steam @12:00:00');
    await new Promise(r => setTimeout(r, 100));
    const until = Date.now() + 1400; while (Date.now() < until) {} // stuck, as on a drive that doesn't answer
    const mid = fs.readFileSync(log, 'utf8');
    await new Promise(r => setTimeout(r, 400));
    const after = fs.readFileSync(log, 'utf8');
    await stallwatch.stop();
    check('while the main process is stuck, the log already says so and names the last step', /stuck for 0\.4 s so far \(last: scan steam @12:00:00\)/.test(mid) && /stuck for 1 s so far/.test(mid), mid);
    check('once it answers again, the log says after how long', /answers again after \d+\.\d s/.test(after), after);
  } catch (e) { check('ran without an error', false, e.stack); }
  finally { fs.rmSync(T, { recursive: true, force: true }); }
  console.log(fails ? `\n${fails} check(s) failed` : '\nAll checks passed');
  process.exit(fails ? 1 : 0);
})();
