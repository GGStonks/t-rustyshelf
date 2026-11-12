// (T)rustyShelf: more portable emulators with RetroAchievements built in (Boxshelf beta discussion 15): BizHawk (EmuHawk.exe) for
// the shelves it covers, Gopher64 and RAProject64 (RAP64.exe) for the N64. Run: node linux/ci/raportable-test.js
//   - Find emulators in a folder finds them (Windows' program names, a versioned Gopher64 build too), per console
//   - RetroArch still comes first where both are there; BizHawk is looked for last
//   - each starts with its own options (main.js ALT_ARGS), and is named in Settings by its own name (shared/emuname.js)
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 500))); if (!ok) fails++; };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tsraport-'));
const mk = p => { const f = path.join(tmp, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, ''); return f; };
// detect.js as on Windows (its program names), in a child process
const win = code => JSON.parse(execFileSync(process.execPath, ['-e', `Object.defineProperty(process, 'platform', { value: 'win32' }); const C = require(${JSON.stringify(path.join(ROOT, 'main', 'systems.js'))}).CONSOLES, D = require(${JSON.stringify(path.join(ROOT, 'main', 'detect.js'))}); console.log(JSON.stringify((${code})()))`], { encoding: 'utf8' }));
try {
  const hawk = mk('Stick/BizHawk-2.10/EmuHawk.exe'), gopher = mk('Stick/Gopher64/gopher64-windows-x86_64.exe'), rap = mk('Stick2/RAProject64/RAP64.exe');
  const r = win(`() => D.emulatorsIn(${JSON.stringify(path.join(tmp, 'Stick'))}).systems`);
  check('BizHawk is found for the shelves it covers (NES, SNES, Game Boys, Mega Drive, PlayStation …)', ['nes', 'snes', 'gb', 'gbc', 'gba', 'megadrive', 'mastersystem', 'gamegear', 'psx', 'saturn', 'pcengine', 'atari2600', 'atarilynx', 'wonderswan', 'nds'].every(id => r[id] === hawk), JSON.stringify(r));
  check('Gopher64 (a versioned build\'s program) is found for the N64, before BizHawk', r.n64 === gopher, r.n64);
  const r2 = win(`() => D.emulatorsIn(${JSON.stringify(path.join(tmp, 'Stick2'))}).systems`);
  check('RAProject64 (RAP64.exe) is found for the N64', r2.n64 === rap, JSON.stringify(r2));
  const order = win(`() => Object.fromEntries(['nes', 'psx', 'nds', 'n64'].map(id => [id, C.find(c => c.id === id).exeNames]))`);
  check('BizHawk is looked for last, after RetroArch too (PlayStation and DS: after DuckStation / melonDS and RetroArch)', Object.values(order).every(l => l[l.length - 1] === 'EmuHawk.exe' && l.indexOf('retroarch.exe') < l.indexOf('EmuHawk.exe')), JSON.stringify(order));
  const main = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8'), alt = (/const ALT_ARGS = (\[[\s\S]*?\]\]);/.exec(main) || [])[1] || '';
  const args = eval(alt), argsFor = exe => (args.find(([re]) => re.test(exe)) || [])[1];
  check('each starts with its own options: EmuHawk and Gopher64 fullscreen, RAProject64 with the game alone', argsFor('EmuHawk.exe') === '--fullscreen "{rom}"' && argsFor('gopher64-windows-x86_64.exe') === '--fullscreen "{rom}"' && argsFor('RAP64.exe') === '"{rom}"', alt.slice(0, 300));
  const en = require(path.join(ROOT, 'shared', 'emuname.js'));
  const labels = ['C:\\E\\BizHawk-2.10\\EmuHawk.exe', 'C:\\E\\gopher64-windows-x86_64.exe', 'C:\\E\\RAProject64\\RAP64.exe'].map(en.label);
  check('Settings names them BizHawk, Gopher64 and RAProject64', labels[0] === 'BizHawk · 2.10' && labels[1] === 'Gopher64' && labels[2] === 'RAProject64', JSON.stringify(labels));
} catch (e) { check('ran without an error', false, e.stack); }
finally { fs.rmSync(tmp, { recursive: true, force: true }); }
console.log(fails ? `\n${fails} check(s) failed` : '\nAll checks passed');
process.exit(fails ? 1 : 0);
