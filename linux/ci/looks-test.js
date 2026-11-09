// (T)rustyShelf's saved looks (Settings → Display → Looks) as the settings file keeps them (main/config.js). Run: node linux/ci/looks-test.js
//   - a look keeps its name (tidied, at most 40 characters) and plain values only; anything else is dropped
//   - at most 20 looks; a missing or wrong `looks` is an empty list; the order is kept
//   - a settings file that passes through twice (saved and read again) comes out the same
'use strict';
const path = require('path');
const config = require(path.join(__dirname, '..', '..', 'main', 'config.js'));
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 500))); if (!ok) fails++; };
const looksOf = ui => config.normalize({ ui }).ui.looks;

let l = looksOf({ looks: [{ name: '  Couch   night ', set: { theme: 'oled', uiScale: 1.15, clock24: true, music: 'own', bad: { x: 1 }, 'x y': 1, arr: [1] } }, { name: '', set: {} }, { name: 5 }, null, 'x'] });
check('a look keeps its tidied name and its plain values', l.length === 2 && l[0].name === 'Couch night' && JSON.stringify(l[0].set) === JSON.stringify({ theme: 'oled', uiScale: 1.15, clock24: true, music: 'own' }), JSON.stringify(l));
check('a look with no name is called Look; objects, lists and odd key names are left out', l[1].name === 'Look' && JSON.stringify(l[1].set) === '{}' && !('bad' in l[0].set) && !('arr' in l[0].set) && !('x y' in l[0].set), JSON.stringify(l));
check('a name is cut at 40 characters', looksOf({ looks: [{ name: 'x'.repeat(100), set: {} }] })[0].name.length === 40);
check('a value that is too long is left out', !('theme' in looksOf({ looks: [{ name: 'a', set: { theme: 'x'.repeat(200) } }] })[0].set));
check('at most 20 looks are kept, in order', (() => { const r = looksOf({ looks: Array.from({ length: 30 }, (_, i) => ({ name: 'L' + i, set: {} })) }); return r.length === 20 && r[0].name === 'L0' && r[19].name === 'L19'; })());
check('no looks, or a wrong value, is an empty list', JSON.stringify(looksOf({})) === '[]' && JSON.stringify(looksOf({ looks: 'x' })) === '[]' && JSON.stringify(looksOf({ looks: { a: 1 } })) === '[]');
const once = config.normalize({ ui: { looks: [{ name: 'A', set: { theme: 'forest', sort: 'year', filter: 'dec:1990' } }] } });
check('passing through twice changes nothing', JSON.stringify(config.normalize(JSON.parse(JSON.stringify(once))).ui.looks) === JSON.stringify(once.ui.looks));

const uiTest = config.normalize({ ui: { autoHideHints: true, allShelf: true, boxScale: 1.2, shelfScale: { gc: 1.1 }, gameScale: { 'gc:game1': 0.9 }, customSort: { gc: ['g1', 'g2'] } } }).ui;
check('autoHideHints is preserved as boolean', uiTest.autoHideHints === true);
check('allShelf is preserved as boolean', uiTest.allShelf === true);
check('boxScale is preserved as valid number', uiTest.boxScale === 1.2);
check('shelfScale and gameScale are preserved as sanitized mappings', uiTest.shelfScale.gc === 1.1 && uiTest.gameScale['gc:game1'] === 0.9);
check('customSort is preserved as array of game IDs', Array.isArray(uiTest.customSort.gc) && uiTest.customSort.gc[0] === 'g1');

const uiInvalid = config.normalize({ ui: { autoHideHints: 'yes', allShelf: 1, boxScale: 999, shelfScale: 'bad', gameScale: 123, customSort: 'bad' } }).ui;
check('invalid feature values fallback to clean defaults', uiInvalid.autoHideHints === false && uiInvalid.allShelf === false && uiInvalid.boxScale === 1 && JSON.stringify(uiInvalid.shelfScale) === '{}' && JSON.stringify(uiInvalid.gameScale) === '{}' && JSON.stringify(uiInvalid.customSort) === '{}');
console.log(fails ? `${fails} failed` : 'all passed'); process.exit(fails ? 1 : 0);
