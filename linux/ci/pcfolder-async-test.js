// (T)rustyShelf, Boxshelf beta issue 34 (the app hung at launch, "not responding"): the PC games folder is read without
// holding the main process up, and each step of the PC library is named for the freeze watch. Made-up folders.
// Run: node linux/ci/pcfolder-async-test.js
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 500))); if (!ok) fails++; };
const ROOT = path.join(__dirname, '..', '..'), pf = require(path.join(ROOT, 'main', 'pcfolder.js'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-pcfolder-'));
const mk = (p, body, exec) => { const f = path.join(tmp, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body == null ? 'x' : body); if (exec) fs.chmodSync(f, 0o755); return f; };
(async () => {
  try {
    mk('Games/Hollow Knight/hollow_knight.x86_64', Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.alloc(64)]), true);
    mk('Games/Hollow Knight/UnityPlayer.so', 'x', true);
    mk('Games/Celeste/Celeste.exe', 'c'.repeat(900)); mk('Games/Celeste/unins000.exe', 'u'.repeat(9000));
    mk('Games/Moon Forge/start.sh', '#!/bin/sh\n', true); mk('Games/Moon Forge/bin/x64/MoonForge.exe', 'm'.repeat(500));
    mk('Games/Epic One/.egstore/x.manifest'); mk('Games/Epic One/EpicOne.exe');
    mk('Games/Docs only/readme.txt');
    mk('Mine/Celeste/Celeste.exe', 'c'.repeat(800));
    const opts = { gamesDir: path.join(tmp, 'Games'), ownDir: path.join(tmp, 'Mine'), programs: { 'Moon Forge': path.join('bin', 'x64', 'MoonForge.exe') } };
    const a = pf.scan(opts), b = await pf.scanAsync(opts);
    const shape = l => JSON.stringify(l.map(g => [g.id, g.title, path.relative(tmp, g.exe), g.native, g.own, g.programs.map(p => p.rel)]));
    check('The async scan finds the same games, programs and choices as before', shape(a) === shape(b) && b.length === 3, shape(a) + '\n' + shape(b));
    check('…Epic installs and folders with nothing to start left out, your own copy used, a chosen program kept', !b.some(g => /Epic|Docs/.test(g.title)) && b.find(g => g.title === 'Celeste').own === true && /MoonForge\.exe$/.test(b.find(g => g.title === 'Moon Forge').exe), shape(b));
    // a big folder: the event loop keeps getting turns
    for (let i = 0; i < 300; i++) { mk(`Big/Game ${i}/Game${i}.exe`, 'e'.repeat(100)); for (let j = 0; j < 3; j++) mk(`Big/Game ${i}/data${j}/f.pak`); }
    let last = Date.now(), worst = 0, ticks = 0; const t = setInterval(() => { const n = Date.now(); worst = Math.max(worst, n - last); last = n; ticks++; }, 5);
    const big = await pf.scanAsync({ gamesDir: path.join(tmp, 'Big') }); clearInterval(t);
    check('A big folder: every game found, and the main process keeps answering (no stall over 250 ms)', big.length === 300 && ticks >= 2 && worst < 250, JSON.stringify({ n: big.length, ticks, worst }));
    const main = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
    check('The library build uses it, and names each PC step for the freeze watch (Steam, Epic, the folder, stores, Quiver, custom)', /await folderGamesAsync\(epic\)/.test(main) && ['steam', 'epic', 'pc games folder', 'pc stores', 'quiver', 'custom games'].every(n => main.includes(`step('${n}')`)), null);
  } catch (e) { check('the test ran', false, e.stack); }
  finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  console.log(fails ? `\n${fails} check(s) failed` : '\nAll checks passed');
  process.exit(fails ? 1 : 0);
})();
