// (T)rustyShelf: a Switch games folder lists the games, not the content archives a dump is split into (Boxshelf beta issue
// 29: .nca files showed up as games of their own). Run: node linux/ci/switch-files-test.js
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 400))); if (!ok) fails++; };
const ROOT = path.join(__dirname, '..', '..');
const systems = require(path.join(ROOT, 'main', 'systems.js'));
const list = systems.SYSTEMS || systems.CONSOLES || systems.systems || systems;
const sw = (Array.isArray(list) ? list : Object.values(list)).find(s => s && s.id === 'sw');
check('the Switch shelf knows its games\' files (nsp, xci, nro) and not .nca', !!sw && ['nsp', 'xci', 'nro'].every(e => sw.extensions.includes(e)) && !sw.extensions.includes('nca'), sw && sw.extensions);
const mock = fs.readFileSync(path.join(ROOT, 'renderer', 'mock.js'), 'utf8'), android = fs.readFileSync(path.join(ROOT, 'android-app', 'web-extras', 'android-systems.js'), 'utf8');
check('the demo page and the Android app leave .nca out too', !/id:"sw"[^\n]*"nca"/.test(mock) && !/sys\('sw'[^\n]*'nca'/.test(android));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-switch-'));
try {
  fs.writeFileSync(path.join(dir, 'Moon Forge [0100ABCD00000000].nsp'), 'x');
  fs.mkdirSync(path.join(dir, 'Star Rally'));
  for (const h of ['0a1b2c3d4e5f60718293a4b5c6d7e8f9', '1a1b2c3d4e5f60718293a4b5c6d7e8f9', '2a1b2c3d4e5f60718293a4b5c6d7e8f9']) fs.writeFileSync(path.join(dir, 'Star Rally', h + '.nca'), 'x');
  fs.writeFileSync(path.join(dir, 'Star Rally', 'Star Rally.xci'), 'x');
  const { scanSystem } = require(path.join(ROOT, 'main', 'scanner.js'));
  const games = scanSystem(sw, { romDirs: [dir] }, true);
  const files = games.map(g => path.basename(g.file || ''));
  check('a folder with a game and its .nca parts gives the games only', games.length === 2 && !files.some(f => /\.nca$/i.test(f)), files);
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
console.log(fails ? `\n${fails} check(s) failed` : '\nAll checks passed');
process.exit(fails ? 1 : 0);
