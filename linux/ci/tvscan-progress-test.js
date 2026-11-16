// The Retro TV's commercial search reports its progress (TrapEmAll's live progress, sassiestrhihno/boxshelf-source
// pull request 5): commercials.scan() calls the tick it is given with { phase, at, of, found, done } after each game,
// then a consoles tick and a done tick. main.js hands the tick to scan(), so scan() must use it (it used to wait for one
// from init(), which never came, and the guide's progress line never showed). Plain Node, no network:
// node linux/ci/tvscan-progress-test.js  → exits 1 on a failure.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const commercials = require(path.join(__dirname, '..', '..', 'main', 'commercials.js'));
let bad = 0; const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' ' + info}`); if (!ok) bad++; };

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tvscan-'));
  // the archive answers every search with nothing found
  commercials.init({ log: () => {}, dir: path.join(dir, 'ads'), memoFile: path.join(dir, 'commercials.json'), fetchBuf: async () => Buffer.from('{"response":{"docs":[]}}') });
  const ticks = [];
  const games = [{ sysId: 'snes', file: 'a.sfc', title: 'Aether Drift' }, { sysId: 'snes', file: 'b.sfc', title: 'Echo Hollow' }];
  const n = await commercials.scan(games, { tick: p => ticks.push(p) });
  const ads = ticks.filter(t => t.phase === 'ads' && !t.done), last = ticks[ticks.length - 1] || {};
  check('scan() finds nothing when the archive has nothing', n === 0, String(n));
  check('a tick before the round and after each game, counting what this round searches', ads.length === 3 && ads.every(t => t.of === 2) && ads.map(t => t.at).join() === '0,1,2', JSON.stringify(ads));
  check('a consoles tick, then a done tick at the end', ticks.some(t => t.phase === 'consoles') && last.done === true, JSON.stringify(ticks.slice(-2)));
  // a second round skips the games looked at lately: nothing to count
  const again = []; await commercials.scan(games, { tick: p => again.push(p) });
  check('a second round counts only the games still to search (none)', again.length >= 1 && again[0].of === 0 && again[again.length - 1].done === true, JSON.stringify(again));
  // no tick given: the round still runs
  let threw = null; try { await commercials.scan(games, {}); } catch (e) { threw = e; }
  check('no tick given: scan() still runs', !threw, threw && threw.message);
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(bad ? 1 : 0);
})();
