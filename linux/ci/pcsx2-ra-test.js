// (T)rustyShelf: PCSX2's RetroAchievements sign-in is found wherever PCSX2 keeps its settings (Boxshelf beta issue 28: signed
// in inside PCSX2, but not ticked). Made-up home folders. Run: node linux/ci/pcsx2-ra-test.js
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 400))); if (!ok) fails++; };
const raemu = require(path.join(__dirname, '..', '..', 'main', 'raemu.js'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-pcsx2ra-'));
const put = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); return f; };
const INI = '﻿[UI]\nConfirmShutdown = false\n\n[Achievements]\nEnabled = true\nUsername = Stonk\nToken = abcdef123\nLoginTimestamp = 1762700000\n';
const exe = put(path.join(tmp, 'emu', 'pcsx2-qtx64-avx2.exe'), 'x');
const cfg = { ra: { user: 'stonk' }, systems: { ps2: { emulator: exe } } };
const ps2 = async env => (await raemu.check(cfg, { ps2: true }, env)).find(r => r.system === 'ps2');
(async () => {
  try {
    // Documents moved to another drive (Windows' Location tab): only Windows knows where
    let home = path.join(tmp, 'h1'), docs = path.join(tmp, 'D', 'MyDocs'); fs.mkdirSync(home, { recursive: true }); put(path.join(docs, 'PCSX2', 'inis', 'PCSX2.ini'), INI);
    let r = await ps2({ USERPROFILE: home, BS_DOCUMENTS: docs });
    check('Documents moved to another drive: signed in, as the account set in (T)rustyShelf', r.state === 'ok' && r.user === 'Stonk', JSON.stringify(r));
    // OneDrive for work, with a translated Documents folder
    home = path.join(tmp, 'h2'); put(path.join(home, 'OneDrive - Contoso', 'Documenti', 'PCSX2', 'inis', 'PCSX2.ini'), INI);
    r = await ps2({ USERPROFILE: home });
    check('Documents under a business OneDrive, in Italian: signed in', r.state === 'ok', JSON.stringify(r));
    // the usual place still works, and signed out is still told apart
    home = path.join(tmp, 'h3'); put(path.join(home, 'Documents', 'PCSX2', 'inis', 'PCSX2.ini'), INI.replace(/Token = .*\n/, ''));
    r = await ps2({ USERPROFILE: home });
    check('The usual Documents\\PCSX2: found, and a missing token is "signed out"', r.state === 'signed-out', JSON.stringify(r));
    // Linux: ~/.config/PCSX2, and the Flatpak's folder
    home = path.join(tmp, 'h4'); put(path.join(home, '.config', 'PCSX2', 'inis', 'PCSX2.ini'), INI);
    r = await ps2({ HOME: home, USERPROFILE: path.join(tmp, 'nohome'), BS_LINUX: '1' });
    check('Linux ~/.config/PCSX2: signed in', r.state === 'ok', JSON.stringify(r));
    home = path.join(tmp, 'h5'); put(path.join(home, '.var', 'app', 'net.pcsx2.PCSX2', 'config', 'PCSX2', 'inis', 'PCSX2.ini'), INI);
    r = await ps2({ HOME: home, USERPROFILE: path.join(tmp, 'nohome'), BS_LINUX: '1' });
    check('Linux Flatpak PCSX2: signed in', r.state === 'ok', JSON.stringify(r));
  } catch (e) { check('ran without an error', false, e.stack); }
  finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  console.log(fails ? `\n${fails} check(s) failed` : '\nAll checks passed');
  process.exit(fails ? 1 : 0);
})();
