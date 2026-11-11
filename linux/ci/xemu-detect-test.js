// Boxshelf beta issue 38: xemu kept in its own folder inside the app's folder, with its BIOS files, didn't show as the Xbox
// emulator (the original app has no Xbox shelf; (T)rustyShelf has one since 1.0.2). xemu in a folder of any name inside
// the app's folder (or its Emulators folder) is found for the Xbox shelf, on Windows and on Linux.
// Run: node linux/ci/xemu-detect-test.js
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 400))); if (!ok) fails++; };
const root = path.resolve(__dirname, '..', '..');
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-xemu-'));
process.env.HOME = HOME; process.env.USERPROFILE = HOME;
const mk = (p, body) => { const f = path.join(HOME, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body || ''); fs.chmodSync(f, 0o755); return f; };
(async () => {
  try {
    // the Windows table: xemu.exe looked for in the app's folder two levels deep (any folder name), and the usual installs
    const win = require(path.join(root, 'main', 'systems.js'));
    const xb = win.CONSOLES.find(c => c.id === 'xbox');
    if (process.platform !== 'win32') {
      // (the tables are already Linux's here: read the Windows one from the source)
      const src = fs.readFileSync(path.join(root, 'main', 'systems.js'), 'utf8'), def = src.slice(src.indexOf("id: 'xbox'"), src.indexOf("id: 'xbox'") + 900);
      check('Windows: the Xbox shelf looks for xemu.exe in the app\'s xemu folders and the usual installs', /exeNames: \['xemu\.exe'/.test(def) && /\{app\}\\\\xemu/.test(def) && /Programs\\\\xemu/.test(def), def.slice(0, 300));
      check('Windows: the app\'s own folder and its Emulators folder are searched for every emulator', /SEARCH_ROOTS = \[\s*'\{app\}', '\{app\}\\\\Emulators'/.test(src), '');
    }
    check('the Xbox shelf exists, played in xemu', !!xb && /xemu/i.test(xb.emulatorName), xb && xb.emulatorName);
    // on Linux: xemu's AppImage in a versioned folder inside the app's folder, beside its BIOS files
    if (process.platform === 'linux') {
      const paths = require(path.join(root, 'main', 'paths.js')); paths.setAppRoot(path.join(HOME, 'TrustyShelf'));
      const x = mk('TrustyShelf/xemu-v0.8.5/xemu-v0.8.5-x86_64.AppImage', '#!/bin/sh\nexit 0\n'); mk('TrustyShelf/xemu-v0.8.5/mcpx_1.0.bin'); mk('TrustyShelf/xemu-v0.8.5/Complex_4627.bin');
      const { detectAll } = require(path.join(root, 'main', 'detect.js'));
      const d = await detectAll(), s = d.systems.xbox || {};
      check('xemu in a folder of its own inside the app\'s folder is found for the Xbox shelf', s.emulator === x, JSON.stringify(s));
    }
  } catch (e) { check('ran without an error', false, e.stack); }
  finally { fs.rmSync(HOME, { recursive: true, force: true }); }
  console.log(fails ? `\n${fails} check(s) failed` : '\nAll checks passed');
  process.exit(fails ? 1 : 0);
})();
