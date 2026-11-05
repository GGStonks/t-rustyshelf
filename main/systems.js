// Definitions for every shelf the launcher knows about.
// Paths may use %ENV% variables and {app} (the folder Boxshelf lives in).
// Game launch options use {rom} for the game file; edit them later in Settings.
// coverSeconds: the longest Boxshelf's black loading screen stays on top while the emulator opens (it lifts as soon
// as the game's window is fullscreen), hiding its window until then (0 = off).
// Dolphin: -b closes Dolphin when the game stops, -C overrides a setting for this launch only.

const CONSOLES = [
  {
    id: 'gc', name: 'GameCube', emulatorName: 'Dolphin',
    exeNames: ['Dolphin.exe', 'DolphinQt.exe'],
    emulatorFolders: ['{app}\\Dolphin', '%ProgramFiles%\\Dolphin', '%ProgramFiles%\\Dolphin-x64', '%LOCALAPPDATA%\\Programs\\Dolphin'],
    romFolderNames: ['gamecube', 'gc', 'gcn', 'ngc'],
    extensions: ['rvz', 'iso', 'gcm', 'ciso', 'gcz', 'dol', 'elf'],
    gameArgs: '-b -C Dolphin.Display.Fullscreen=True -C Dolphin.Interface.ConfirmStop=False -e "{rom}"',
    emulatorArgs: '',
    coverSeconds: 4
  },
  {
    id: 'wii', name: 'Wii', emulatorName: 'Dolphin',
    exeNames: ['Dolphin.exe', 'DolphinQt.exe'],
    emulatorFolders: ['{app}\\Dolphin', '%ProgramFiles%\\Dolphin', '%ProgramFiles%\\Dolphin-x64', '%LOCALAPPDATA%\\Programs\\Dolphin'],
    romFolderNames: ['wii'],
    extensions: ['rvz', 'iso', 'wbfs', 'wia', 'ciso', 'gcz', 'wad'],
    gameArgs: '-b -C Dolphin.Display.Fullscreen=True -C Dolphin.Interface.ConfirmStop=False -e "{rom}"',
    emulatorArgs: '',
    coverSeconds: 4
  },
  {
    id: 'wiiu', name: 'Wii U', emulatorName: 'Cemu',
    exeNames: ['Cemu.exe', 'cemu.exe'],
    emulatorFolders: ['{app}\\Cemu', '{app}\\cemu', '%LOCALAPPDATA%\\Programs\\Cemu', '%ProgramFiles%\\Cemu', '%APPDATA%\\Cemu'],
    romFolderNames: ['wii u', 'wiiu', 'wii-u', 'cemu'],
    // .wua (Cemu's one-file archive, best), .wud / .wux disc images, or an extracted game folder (code\<name>.rpx,
    // with meta\meta.xml giving the title). -f fullscreen, -g the game.
    extensions: ['wua', 'wud', 'wux', 'rpx', 'tmd'], deep: true, // tmd: NUS-format folders (title.tmd + .app files), which Cemu opens directly
    gameArgs: '-f -g "{rom}"',
    emulatorArgs: '',
    coverSeconds: 5
  },
  {
    id: 'sw', name: 'Switch', emulatorName: 'Eden',
    exeNames: ['eden.exe', 'Eden.exe'],
    emulatorFolders: ['{app}\\Eden', '%LOCALAPPDATA%\\Programs\\Eden', '%ProgramFiles%\\Eden', '%APPDATA%\\Eden'],
    romFolderNames: ['switch', 'nsw', 'ns'],
    extensions: ['nsp', 'xci', 'nca', 'nro'],
    // Eden comes from the yuzu family: -f = fullscreen, -g = game file.
    gameArgs: '-f -g "{rom}"',
    emulatorArgs: '',
    coverSeconds: 6
  },
  {
    id: 'sw2', name: 'Switch 2', emulatorName: 'Eglantine',
    exeNames: ['eglantine.exe', 'Eglantine.exe'],
    emulatorFolders: ['{app}\\Switch 2 emu', '{app}\\Eglantine', '{app}\\Switch 2', '%LOCALAPPDATA%\\Programs\\Eglantine', '%ProgramFiles%\\Eglantine'],
    romFolderNames: ['switch 2', 'switch2', 'nsw2', 'ns2'],
    // Eglantine is an Eden fork (same -f / -g). Games are mostly unpacked folders (exefs\main + romfs, often as base\ and
    // updates\<version>\): main\nx2.js finds them, names them and picks the newest update to boot. .nsp / .xci / .nup
    // (the newer builds' packed format) work too. Play asks which build to use (people keep several forks).
    extensions: ['nsp', 'xci', 'nup'], deep: true, hint: 'unpacked game folders (exefs + romfs), or .nsp / .xci / .nup',
    gameArgs: '-f -g "{rom}"',
    emulatorArgs: '',
    coverSeconds: 10
  },
  {
    id: 'psp', name: 'PSP', emulatorName: 'PPSSPP',
    exeNames: ['PPSSPPWindows64.exe', 'PPSSPPWindows.exe'],
    emulatorFolders: ['{app}\\PPSPP', '{app}\\PPSSPP', '%ProgramFiles%\\PPSSPP', '%ProgramFiles(x86)%\\PPSSPP'],
    romFolderNames: ['psp'],
    extensions: ['iso', 'cso', 'chd', 'pbp'],
    gameArgs: '--fullscreen --pause-menu-exit "{rom}"',
    emulatorArgs: '',
    coverSeconds: 2
  },
  {
    id: 'ps2', name: 'PS2', emulatorName: 'PCSX2',
    exeNames: ['pcsx2-qt.exe', 'pcsx2-qtx64.exe', 'pcsx2-qtx64-avx2.exe', 'pcsx2.exe'],
    emulatorFolders: ['{app}\\PCSX2', '{app}\\pcsx2', '%ProgramFiles%\\PCSX2', '%ProgramFiles%\\PCSX2 1.7.0'],
    romFolderNames: ['ps2', 'playstation 2', 'pcsx2'],
    extensions: ['iso', 'chd', 'cso', 'zso', 'gz', 'bin'],
    // -batch: close PCSX2 when the game closes; -nogui: no main window in between
    gameArgs: '-fullscreen -nogui -batch -- "{rom}"',
    emulatorArgs: '',
    coverSeconds: 4
  },
  {
    id: 'ps3', name: 'PS3', emulatorName: 'RPCS3',
    exeNames: ['rpcs3.exe', 'RPCS3.exe'],
    emulatorFolders: ['{app}\\RPCS3', '{app}\\rpcs3', '%ProgramFiles%\\RPCS3', '%LOCALAPPDATA%\\RPCS3'],
    romFolderNames: ['ps3', 'playstation 3', 'rpcs3'],
    // PS3 games are folders: disc games  <Game>\PS3_GAME\USRDIR\EBOOT.BIN, digital ones  dev_hdd0\game\NPUB12345\USRDIR\EBOOT.BIN;
    // the scanner reads PARAM.SFO next to USRDIR for the title (and skips installed patches). Newer RPCS3 builds also boot .iso.
    extensions: ['bin', 'iso'], gameFile: 'eboot.bin', alsoFiles: ['iso'], hint: 'game folders with EBOOT.BIN, or .iso', // hint: what Settings says goes in the games folder (any .bin is not a game here)
    // --no-gui: straight into the game, no game list; --fullscreen: only used together with --no-gui
    gameArgs: '--no-gui --fullscreen "{rom}"',
    emulatorArgs: '',
    coverSeconds: 6
  },
  {
    id: 'ps4', name: 'PS4', emulatorName: 'shadPS4',
    exeNames: ['shadPS4.exe', 'shadps4.exe', 'shadPS4-qt.exe'],
    emulatorFolders: ['{app}\\shadPS4', '{app}\\shadps4', '{app}\\ShadPS4', '%LOCALAPPDATA%\\shadPS4', '%ProgramFiles%\\shadPS4'],
    romFolderNames: ['ps4', 'playstation 4', 'shadps4'],
    // PS4 games are folders (CUSAxxxxx\eboot.bin); the scanner looks for eboot.bin and reads sce_sys\param.sfo for the title
    extensions: ['bin', 'pkg'], gameFile: 'eboot.bin', hint: 'game folders with eboot.bin, or .pkg',
    gameArgs: '-f true -g "{rom}"',
    emulatorArgs: '',
    coverSeconds: 6
  },
  {
    id: 'ps5', name: 'PS5', emulatorName: 'Kyty',
    exeNames: ['kyty_emulator.exe'],
    // the KytyJets fork first (Kytyps5\KytyJets\KytyPS5-U59-Windows-x64\…), then any other Kyty build
    emulatorFolders: ['{app}\\Kytyps5\\KytyJets', '{app}\\KytyJets', '{app}\\Kytyps5', '{app}\\Kyty', '{app}\\KytyPS5', '%LOCALAPPDATA%\\Kyty', '%ProgramFiles%\\Kyty'],
    romFolderNames: ['ps5', 'playstation 5', 'kyty'],
    // PS5 games are folders (PPSAxxxxx\eboot.bin with sce_sys\param.json); main/kyty.js adds the Kyty launcher's
    // settings, the game's patch file and the build's preset, and hands the emulator the game's folder
    extensions: ['bin'], gameFile: 'eboot.bin', hint: 'game folders with eboot.bin',
    gameArgs: '--game "{rom}"',
    emulatorArgs: '',
    coverSeconds: 10
  },
  {
    id: 'x360', name: 'Xbox 360', emulatorName: 'Xenia',
    exeNames: ['xenia_canary.exe', 'xenia.exe', 'xenia_canary_netplay.exe'],
    emulatorFolders: ['{app}\\Xenia', '{app}\\Xenia\\Emulators\\Xenia Canary', '{app}\\xenia', '{app}\\xenia_canary', '{app}\\Xenia Canary', '%ProgramFiles%\\Xenia'],
    romFolderNames: ['xbox 360', 'xbox360', 'x360', 'xenia'],
    // disc images, XBLA / extracted games (default.xex inside a folder; the folder's name is the title), .zar archives
    extensions: ['iso', 'xex', 'zar'],
    gameArgs: '--fullscreen=true "{rom}"',
    emulatorArgs: '',
    coverSeconds: 6
  },
  {
    id: 'n3ds', name: '3DS', emulatorName: 'Azahar',
    exeNames: ['azahar.exe', 'azahar-qt.exe', 'lime3ds.exe', 'lime3ds-gui.exe', 'citra-qt.exe'],
    emulatorFolders: ['{app}\\Azahar', '{app}\\azahar', '%ProgramFiles%\\Azahar', '%LOCALAPPDATA%\\Programs\\Azahar', '%LOCALAPPDATA%\\Azahar', '%APPDATA%\\Azahar', '{app}\\Citra', '%LOCALAPPDATA%\\Citra\\nightly', '%LOCALAPPDATA%\\Citra\\canary', '{app}\\Lime3DS'],
    romFolderNames: ['3ds', 'n3ds', 'nintendo 3ds', 'azahar', 'citra'],
    // decrypted game images (.3ds/.cci/.cxi), homebrew (.3dsx), Azahar's compressed versions (.z*) and .cia installers
    // (Boxshelf installs a .cia into Azahar the first time it's played, then boots the installed game)
    extensions: ['3ds', 'cci', 'cxi', '3dsx', 'zcci', 'zcxi', 'z3dsx', 'cia'],
    // Azahar (Citra's successor): -f fullscreen, the game file last
    gameArgs: '-f "{rom}"',
    emulatorArgs: '',
    coverSeconds: 4
  }
];

const APPS = [
  {
    id: 'stremio', name: 'Stremio',
    exeNames: ['stremio.exe', 'stremio-shell-ng.exe', 'Stremio.exe'],
    folders: ['%LOCALAPPDATA%\\Programs\\LNV\\Stremio-4', '%LOCALAPPDATA%\\Programs\\Stremio', '%ProgramFiles%\\Stremio', '%ProgramFiles%\\LNV\\Stremio-4']
  },
  {
    id: 'nuvio', name: 'Nuvio',
    exeNames: ['Nuvio.exe', 'nuvio.exe'],
    folders: ['%LOCALAPPDATA%\\Programs\\Nuvio', '%LOCALAPPDATA%\\Programs\\nuvio', '%ProgramFiles%\\Nuvio']
  }
];

// Extra places to look for portable emulators and ROM folders. (1.82) Windows 11 with OneDrive backup moves the Desktop and
// Documents into the OneDrive folder (%OneDrive%; a place whose variable isn't set is simply skipped).
const SEARCH_ROOTS = [
  '{app}', '{app}\\Emulators',
  '%USERPROFILE%\\Desktop', '%OneDrive%\\Desktop', '%USERPROFILE%\\Emulators', '%USERPROFILE%\\Downloads',
  '%USERPROFILE%\\Documents', '%OneDrive%\\Documents',
  'C:\\Emulators', 'D:\\Emulators', 'E:\\Emulators', 'C:\\Games', 'D:\\Games'
];
const ROM_ROOT_NAMES = ['roms', 'games', 'isos'];

module.exports = { CONSOLES, APPS, SEARCH_ROOTS, ROM_ROOT_NAMES };
