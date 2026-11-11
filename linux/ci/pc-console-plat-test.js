// (T)rustyShelf issue 1: a PC game's case follows the cover in use. A Steam or SteamGridDB cover picked over the automatic
// console box used to keep that console's case (proportions, colour), mixed up with the art. Run: node linux/ci/pc-console-plat-test.js
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 400))); if (!ok) fails++; };
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-pcplat-'));
const put = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
try {
  const pc = require(path.join(__dirname, '..', '..', 'main', 'pccovers.js'));
  pc.init({ dataDir: data, log: () => {} });
  const auto = path.join(data, 'pc-console-covers'), mine = path.join(data, 'pc-covers');
  // the automatic console box only
  put(path.join(auto, 'steam-10.jpg'), 'j'); put(path.join(auto, 'steam-10.plat'), 'ps5');
  check('the automatic console box gives its console', pc.consolePlat('steam-10') === 'ps5', pc.consolePlat('steam-10'));
  // a SteamGridDB / Steam cover chosen over it: no console case
  put(path.join(mine, 'steam-10.jpg'), 'j');
  check('a Steam or SteamGridDB cover chosen over it: no console case any more', pc.consolePlat('steam-10') === null, pc.consolePlat('steam-10'));
  // an alternate console box chosen in the picker: its own console
  put(path.join(mine, 'steam-10.plat'), 'xone');
  check('a console box chosen in the picker gives that console (Xbox One over the automatic PS5)', pc.consolePlat('steam-10') === 'xone', pc.consolePlat('steam-10'));
  // an older box with only a .from note: read by the platform name, never by letters in the address
  put(path.join(auto, 'epic-a.jpg'), 'j'); put(path.join(auto, 'epic-a.from'), 'Nintendo Switch https://images.launchbox-app.com/x.jpg');
  put(path.join(auto, 'epic-b.jpg'), 'j'); put(path.join(auto, 'epic-b.from'), 'Sony Playstation 4 https://images.launchbox-app.com/answer-sw.jpg');
  put(path.join(auto, 'epic-c.jpg'), 'j'); put(path.join(auto, 'epic-c.from'), 'https://cdn2.steamgriddb.com/grid/swish-ps5.png');
  check('an older box note is read by its platform name', pc.consolePlat('epic-a') === 'sw' && pc.consolePlat('epic-b') === 'ps4', [pc.consolePlat('epic-a'), pc.consolePlat('epic-b')]);
  check('letters inside an address ("sw", "ps5") never make a console', pc.consolePlat('epic-c') === null, pc.consolePlat('epic-c'));
} catch (e) { check('ran without an error', false, e.stack); }
finally { fs.rmSync(data, { recursive: true, force: true }); }
console.log(fails ? `\n${fails} check(s) failed` : '\nAll checks passed');
process.exit(fails ? 1 : 0);
