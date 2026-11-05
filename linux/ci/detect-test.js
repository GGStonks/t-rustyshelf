// Linux build, test 1 (plain Node, on Linux): emulator and games detection in a made-up Steam Deck-style home folder.
// An EmuDeck ROM folder (~/Emulation/roms/snes), a RetroDECK one (~/retrodeck/roms/psx), a Flatpak Dolphin (its
// exported launcher), a DuckStation AppImage in ~/Applications, RetroArch in ~/.local/bin with its SNES core in
// ~/.config/retroarch/cores, and Steam in ~/.local/share/Steam. Exit code 1 = something wasn't found.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
if (process.platform !== 'linux') { console.log('Linux only: skipped'); process.exit(0); }

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'bxhome-'));
process.env.HOME = HOME; // (os.homedir() and %HOME% both follow it)
const mk = (p, body, exec) => { const f = path.join(HOME, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body || ''); if (exec) fs.chmodSync(f, 0o755); return f; };
const ra = mk('.local/bin/retroarch', '#!/bin/sh\nexit 0\n', true);
const dolphin = mk('.local/share/flatpak/exports/bin/org.DolphinEmu.dolphin-emu', '#!/bin/sh\nexit 0\n', true);
const duck = mk('Applications/DuckStation-x64.AppImage', '#!/bin/sh\nexit 0\n', true);
const core = mk('.config/retroarch/cores/snes9x_libretro.so', 'x');
mk('Emulation/roms/snes/Test Game (USA).sfc', 'x'); mk('Emulation/roms/gc/Test (USA).rvz', 'x'); mk('retrodeck/roms/psx/Test (USA).cue', 'x');
fs.mkdirSync(path.join(HOME, '.local/share/Steam/steamapps'), { recursive: true });

const root = path.resolve(__dirname, '..', '..');
const paths = require(path.join(root, 'main', 'paths.js')); paths.setAppRoot(path.join(HOME, 'Boxshelf'));
const { CONSOLES } = require(path.join(root, 'main', 'systems.js'));
const { detectAll } = require(path.join(root, 'main', 'detect.js'));
const linux = require(path.join(root, 'main', 'linux.js'));

let fails = 0; const check = (name, ok, detail) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok ? '' : '  -> ' + detail)); if (!ok) fails++; };
(async () => {
  check('Linux tables in use (no Windows .exe names)', !CONSOLES.some(c => c.exeNames.some(n => /\.exe$/i.test(n))), CONSOLES.find(c => c.exeNames.some(n => /\.exe$/i.test(n)))?.id);
  const d = await detectAll();
  const s = id => d.systems[id] || {};
  check('Flatpak Dolphin found for GameCube (its exported launcher)', s('gc').emulator === dolphin, s('gc').emulator);
  check('DuckStation AppImage found for PlayStation (standalone first)', s('psx').emulator === duck, s('psx').emulator);
  check('RetroArch found for SNES', s('snes').emulator === ra, s('snes').emulator);
  check('EmuDeck ROM folder found (~/Emulation/roms/snes)', (s('snes').romDirs || []).includes(path.join(HOME, 'Emulation/roms/snes')), JSON.stringify(s('snes').romDirs));
  check('EmuDeck GameCube folder found (~/Emulation/roms/gc)', (s('gc').romDirs || []).includes(path.join(HOME, 'Emulation/roms/gc')), JSON.stringify(s('gc').romDirs));
  check('RetroDECK ROM folder found (~/retrodeck/roms/psx)', (s('psx').romDirs || []).includes(path.join(HOME, 'retrodeck/roms/psx')), JSON.stringify(s('psx').romDirs));
  check('Steam found (~/.local/share/Steam)', d.steam.path === fs.realpathSync(path.join(HOME, '.local/share/Steam')), d.steam.path);
  check('RetroArch recognised, its SNES core found (.so)', linux.isRetroArch(ra) && linux.isRetroArch('/x/org.libretro.RetroArch') && linux.isRetroArch('/x/RetroArch-Linux-x86_64.AppImage') && !linux.isRetroArch(duck) && linux.retroCore(ra, 'snes9x') === core, linux.retroCore(ra, 'snes9x'));
  check('a missing core is reported as missing', linux.retroCore(ra, 'mesen') === null, linux.retroCore(ra, 'mesen'));
  console.log(fails ? `${fails} failed` : 'all passed');
  fs.rmSync(HOME, { recursive: true, force: true });
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
