// (T)rustyShelf: a Steam game's achievements, read from what Steam keeps on this PC ((T)rustyShelf discussion 22; main/pcach.js).
// Run: node linux/ci/pcach-test.js
//   - Valve's binary KeyValues are read (maps, strings, numbers)
//   - the achievement list comes from UserGameStatsSchema_<appid>.bin (English names, hidden ones kept hidden until unlocked,
//     the grey icon for a locked one), and which are unlocked and when from UserGameStats_<account>_<appid>.bin
//   - the account is the one Steam last signed in (loginusers.vdf, MostRecent); another account's progress isn't mixed in
//   - a game Steam has no stats for gives nothing
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const pa = require(path.join(__dirname, '..', '..', 'main', 'pcach.js'));
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 500))); if (!ok) fails++; };
// a binary KeyValues writer, as Steam writes them
function kv(o) {
  const parts = [], key = k => Buffer.concat([Buffer.from(String(k), 'utf8'), Buffer.from([0])]);
  const map = m => { for (const [k, v] of Object.entries(m)) {
    if (v && typeof v === 'object') { parts.push(Buffer.from([0]), key(k)); map(v); }
    else if (typeof v === 'number') { const b = Buffer.alloc(4); b.writeInt32LE(v | 0); parts.push(Buffer.from([2]), key(k), b); }
    else parts.push(Buffer.from([1]), key(k), key(v)); }
    parts.push(Buffer.from([8])); };
  map(o); return Buffer.concat(parts);
}
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-pcach-'));
try {
  const steam = path.join(T, 'Steam'), stats = path.join(steam, 'appcache', 'stats'); fs.mkdirSync(stats, { recursive: true }); fs.mkdirSync(path.join(steam, 'config'));
  const me = '76561198000000123', acct = String(BigInt(me) - 76561197960265728n);
  fs.writeFileSync(path.join(steam, 'config', 'loginusers.vdf'), `"users"\n{\n\t"76561198000000999"\n\t{\n\t\t"AccountName"\t"other"\n\t\t"MostRecent"\t"0"\n\t\t"Timestamp"\t"1700000000"\n\t}\n\t"${me}"\n\t{\n\t\t"AccountName"\t"me"\n\t\t"MostRecent"\t"1"\n\t\t"Timestamp"\t"1600000000"\n\t}\n}\n`);
  check('the account last signed in on this PC is found', pa.accountId(steam) === acct, pa.accountId(steam));
  const ach = (name, bit, en, desc, hidden) => ({ name, bit, display: { name: { english: en, german: en + ' (de)' }, desc: { english: desc }, hidden: hidden ? '1' : '0', icon: name + '.jpg', icon_gray: name + '_gray.jpg' } });
  fs.writeFileSync(path.join(stats, 'UserGameStatsSchema_4242.bin'), kv({ 4242: { gamename: 'Moon Forge', version: '7', stats: {
    1: { type: '4', id: '1', bits: { 0: ach('ACH_START', 0, 'First Steps', 'Start the game'), 1: ach('ACH_BOSS', 1, 'Boss Down', 'Beat the boss'), 2: ach('ACH_SECRET', 2, 'Secret Room', 'Find it', true) } },
    2: { type: '4', id: '2', bits: { 0: ach('ACH_ALL', 0, 'Completionist', 'Everything', true) } },
    3: { type: '1', id: '3', name: 'kills' } } } }));
  fs.writeFileSync(path.join(stats, `UserGameStats_${acct}_4242.bin`), kv({ cache: { crc: 1, PendingChanges: 0, 1: { data: 0b101, AchievementTimes: { 0: 1700000000, 2: 1700500000 } }, 3: { data: 12 } } }));
  fs.writeFileSync(path.join(stats, 'UserGameStats_999_4242.bin'), kv({ cache: { 1: { data: 0b111 }, 2: { data: 1 } } })); // (someone else on this PC)
  const p = pa.steamProgress(steam, 4242);
  check('the list: four achievements in Steam\'s order, with their English names', p && p.total === 4 && p.achievements.map(a => a.title).join('|') === 'First Steps|Boss Down|Secret Room|Completionist', JSON.stringify(p && p.achievements.map(a => a.title)));
  check('which are unlocked (the account\'s own file, not another one\'s), and when', p && p.earned === 2 && p.achievements[0].earned && !p.achievements[1].earned && p.achievements[2].earned && !p.achievements[3].earned && p.achievements[0].date === '2023-11-14 22:13:20', JSON.stringify(p && p.achievements.map(a => [a.earned, a.date])));
  check('a hidden one stays hidden until it\'s unlocked; an unlocked hidden one shows what it was', p && p.achievements[3].desc === 'Hidden achievement' && p.achievements[2].desc === 'Find it', JSON.stringify(p && p.achievements.map(a => a.desc)));
  check('icons: the colour one unlocked, the grey one locked', p && /\/4242\/ACH_START\.jpg$/.test(p.achievements[0].badge) && /ACH_BOSS_gray\.jpg$/.test(p.achievements[1].badge), JSON.stringify(p && p.achievements.map(a => a.badge)));
  check('the game\'s name and Steam as the source; no points', p && p.title === 'Moon Forge' && p.source === 'Steam' && p.points === 0, JSON.stringify(p && { t: p.title, s: p.source }));
  check('a game Steam has no stats for gives nothing', pa.steamProgress(steam, 777) === null && pa.steamProgress('', 4242) === null);
} catch (e) { check('ran without an error', false, e.stack); }
finally { fs.rmSync(T, { recursive: true, force: true }); }
console.log(fails ? `\n${fails} check(s) failed` : '\nAll checks passed');
process.exit(fails ? 1 : 0);
