// (T)rustyShelf: Quiver Launcher's apps (issue 16: apps installed after the first import never showed). Pretend Quiver 3
// (portable: apps.json + settings.json beside it, games in Apps\) and Quiver 4 (%APPDATA%\com.quiverlauncher.app:
// installs.json, apps-folder.json) folders, each with one app its list names and one it doesn't show yet.
// Run: node linux/ci/quiver-test.js
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 400))); if (!ok) fails++; };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quiver-'));
const put = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); return f; };
const exe = (f, kb = 64) => put(f, Buffer.alloc(kb * 1024));
try {
  process.env.APPDATA = path.join(tmp, 'Roaming'); process.env.LOCALAPPDATA = path.join(tmp, 'Local');
  const pc = require(path.join(__dirname, '..', '..', 'main', 'pcgames.js'));
  if (pc.init) pc.init(path.join(tmp, 'data'), () => {});

  // Quiver 3, portable
  const q3 = path.join(tmp, 'Quiver');
  put(path.join(q3, 'QuiverLauncher.exe'), 'x');
  put(path.join(q3, 'apps.json'), JSON.stringify({ apps: [{ name: 'Ship of Harkinian', repository: 'HarbourMasters/Shipwright', folderName: 'Shipwright' }] }));
  put(path.join(q3, 'settings.json'), '{}');
  exe(path.join(q3, 'Apps', 'Shipwright', 'soh.exe'));
  exe(path.join(q3, 'Apps', 'Zelda64Recomp', 'Zelda64Recompiled.exe')); exe(path.join(q3, 'Apps', 'Zelda64Recomp', 'unins000.exe'), 900);
  fs.mkdirSync(path.join(q3, 'Apps', 'temp'), { recursive: true }); exe(path.join(q3, 'Apps', 'temp', 'half-downloaded.exe'));
  fs.mkdirSync(path.join(q3, 'Apps', 'Empty'), { recursive: true });
  let g = pc.quiverGames(q3);
  const t3 = g.map(x => x.title).sort();
  check('Quiver 3: the listed app is there', t3.includes('Ship of Harkinian'), t3);
  check('Quiver 3: an app in Apps\\ that apps.json doesn\'t show gets its case, started from its own program (not the uninstaller)', g.some(x => x.title === 'Zelda64Recomp' && /Zelda64Recompiled\.exe$/.test(x.exe)), JSON.stringify(g));
  check('Quiver 3: a listed app is not added a second time, a temp folder and a folder with no program are left out', g.length === 2, t3);
  g = pc.quiverGames(q3);
  check('a rescan gives the same games with the same ids', JSON.stringify(g.map(x => x.id).sort()) === JSON.stringify(pc.quiverGames(q3).map(x => x.id).sort()) && g.length === 2);

  // Quiver 4, installed
  const q4 = path.join(process.env.APPDATA, 'com.quiverlauncher.app'), apps4 = path.join(tmp, 'QuiverApps');
  put(path.join(q4, 'apps-folder.json'), JSON.stringify({ path: apps4 }));
  put(path.join(q4, 'installs.json'), JSON.stringify({ a1: { folder: 'Perfect Dark', program: 'pd.exe' } }));
  put(path.join(q4, 'library.json'), JSON.stringify([{ id: 'a1', slug: 'perfect-dark', overrides: { name: 'Perfect Dark' } }]));
  exe(path.join(apps4, 'Perfect Dark', 'pd.exe'));
  exe(path.join(apps4, 'Sonic_Unleashed_Recomp', 'UnleashedRecomp.exe'));
  g = pc.quiverGames('').filter(x => /QuiverApps/.test(x.exe));
  const t4 = g.map(x => x.title).sort();
  check('Quiver 4: the installed app and the one installs.json doesn\'t show yet are both there, once each', t4.length === 2 && t4.includes('Perfect Dark') && t4.includes('Sonic Unleashed Recomp'), t4);

  // (issue 16 again) an app in the apps folder that Quiver's list names without pointing at its folder gets the list's name
  // (the one the first import gave it), not the folder's; a versioned folder too; a folder no entry matches keeps its own
  const q3b = path.join(tmp, 'Quiver2');
  put(path.join(q3b, 'QuiverLauncher.exe'), 'x'); put(path.join(q3b, 'settings.json'), JSON.stringify({ UserAppDisplayNames: { 'Zelda64Recomp/Zelda64Recomp': 'Majora\'s Mask' } }));
  put(path.join(q3b, 'apps.json'), JSON.stringify({ apps: [{ name: 'Star Fox 64', repository: 'HarbourMasters/Starship', appIconUrl: 'https://example.com/sf.png', tags: ['decomp'] },
    { name: 'Zelda 64: Recompiled', repository: 'Zelda64Recomp/Zelda64Recomp' }, { name: 'Not Installed', repository: 'Someone/Nothing', folderName: 'Nothing' }] }));
  exe(path.join(q3b, 'Apps', 'Starship-v1.0.2', 'Starship.exe')); exe(path.join(q3b, 'Apps', 'Zelda64Recomp', 'Zelda64Recompiled.exe')); exe(path.join(q3b, 'Apps', 'Mystery_Port', 'mystery.exe'));
  const gb = pc.quiverGames(q3b).filter(x => x.exe.includes(q3b)), by = t => gb.find(x => x.title === t);
  check('Quiver 3: an app its list names by repository gets the list\'s name and icon (a version on the folder\'s end too)', by('Star Fox 64') && /Starship\.exe$/.test(by('Star Fox 64').exe) && by('Star Fox 64').icon === 'https://example.com/sf.png', JSON.stringify(gb));
  check('Quiver 3: the name you gave an app in Quiver wins', !!by('Majora\'s Mask'), JSON.stringify(gb.map(x => x.title)));
  check('Quiver 3: a folder no entry matches keeps its folder name; ids stay the folder\'s', !!by('Mystery Port') && gb.length === 3 && by('Star Fox 64').id === 'quiver-' + 'starship-v1-0-2', JSON.stringify(gb.map(x => [x.id, x.title])));
  // Quiver 4: library.json's entry for an app installs.json doesn't show yet
  put(path.join(q4, 'library.json'), JSON.stringify([{ id: 'a1', slug: 'perfect-dark', overrides: { name: 'Perfect Dark' } }, { id: 'a2', slug: 'sonic-unleashed-recomp', local: { name: 'Sonic Unleashed' } }]));
  const g4 = pc.quiverGames('').filter(x => /QuiverApps/.test(x.exe)).map(x => x.title).sort();
  check('Quiver 4: the app installs.json doesn\'t show yet gets library.json\'s name', JSON.stringify(g4) === JSON.stringify(['Perfect Dark', 'Sonic Unleashed']), g4);
} catch (e) { check('ran without an error', false, e.stack); }
finally { fs.rmSync(tmp, { recursive: true, force: true }); }
console.log(fails ? `\n${fails} check(s) failed` : '\nAll checks passed');
process.exit(fails ? 1 : 0);
