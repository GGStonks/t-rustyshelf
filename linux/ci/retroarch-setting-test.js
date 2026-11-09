// Shared RetroArch configuration across retro consoles. Run: node linux/ci/retroarch-setting-test.js
'use strict';
const path = require('path');
const config = require(path.join(__dirname, '..', '..', 'main', 'config.js'));
const { CONSOLES } = require(path.join(__dirname, '..', '..', 'main', 'systems.js'));
const detect = require(path.join(__dirname, '..', '..', 'main', 'detect.js'));

let fails = 0;
const check = (name, ok, detail) => {
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail == null ? '' : '  -> ' + JSON.stringify(detail)));
  if (!ok) fails++;
};

// 1. Defaults and sanitize
const defs = config.defaults();
check('defaults: retroarch setting exists and defaults to empty string', defs.retroarch === '', defs.retroarch);

const norm = config.normalize({ retroarch: 'C:\\RetroArch\\retroarch.exe' });
check('normalize: preserves valid retroarch path', norm.retroarch === 'C:\\RetroArch\\retroarch.exe', norm.retroarch);

const normBad = config.normalize({ retroarch: 12345 });
check('normalize: resets non-string retroarch to empty string', normBad.retroarch === '', normBad.retroarch);

// 2. Retro consoles list check
const nes = CONSOLES.find(c => c.id === 'nes');
check('systems: NES is a retro console with raCore', nes && nes.retro === true && !!nes.raCore, nes);

const gc = CONSOLES.find(c => c.id === 'gc');
check('systems: GameCube is not a retro console', gc && !gc.retro, gc);

// 3. Fallback logic verification
const cfg = config.normalize({ retroarch: 'C:\\RetroArch\\retroarch.exe' });

function resolveEmu(def, sc, c) {
  return sc.emulator || (def.retro && c.retroarch ? c.retroarch : '');
}

check('fallback: retro console without emulator falls back to shared retroarch',
  resolveEmu(nes, { emulator: '' }, cfg) === 'C:\\RetroArch\\retroarch.exe');

check('fallback: retro console with own emulator keeps its own emulator',
  resolveEmu(nes, { emulator: 'C:\\Mesen\\Mesen.exe' }, cfg) === 'C:\\Mesen\\Mesen.exe');

check('fallback: non-retro console without emulator does NOT fall back to retroarch',
  resolveEmu(gc, { emulator: '' }, cfg) === '');

// 4. detectAll / emulatorsIn structure
check('detect: detectAll is a function', typeof detect.detectAll === 'function');
check('detect: emulatorsIn is a function', typeof detect.emulatorsIn === 'function');
const emuRes = detect.emulatorsIn('');
check('detect: emulatorsIn returns retroarch property', 'retroarch' in emuRes, emuRes);

console.log(fails ? `${fails} check(s) failed` : 'all passed');
process.exit(fails ? 1 : 0);
