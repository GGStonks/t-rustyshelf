// Boxshelf beta discussion 39: Xbox app / Microsoft Store games showed as not installed. A PowerShell lookup that failed or
// timed out once left every game remembered as not installed for good, and a MicrosoftGame.config saved in UTF-16 was
// never read. (1.6.3) Two or more games asked about in one Get-AppxPackage were refused by Windows, so none showed. Run: node linux/ci/xbox-games-test.js
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 400))); if (!ok) fails++; };
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-xbox-'));
const pub = 'CN=Microsoft Corporation, O=Microsoft Corporation, L=Redmond, S=Washington, C=US';
const conf = (name, title) => `<?xml version="1.0" encoding="utf-8"?>\n<Game configVersion="1">\n  <Identity Name="${name}" Publisher="${pub}" Version="1.0.0.0"/>\n  <ExecutableList><Executable Name="game.exe" Id="Game"/></ExecutableList>\n  <ShellVisuals DefaultDisplayName="${title}"/>\n</Game>\n`;
const put = (rel, buf) => { const f = path.join(T, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, buf); };
(async () => {
  try {
    const pcg = require(path.join(__dirname, '..', '..', 'main', 'pcgames.js'));
    const logs = []; pcg.init(path.join(T, 'data'), m => logs.push(m));
    const root = path.join(T, 'XboxGames');
    put('XboxGames/Forza Horizon 5/Content/MicrosoftGame.config', conf('Microsoft.SunriseBaseGame', 'Forza Horizon 5'));
    put('XboxGames/Halo Infinite/Content/MicrosoftGame.config', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(conf('Microsoft.Chelan', 'Halo Infinite'), 'utf16le')]));
    put('XboxGames/GameSave/readme.txt', 'x');
    check('Windows\' own publisher id is worked out the same way (Microsoft: 8wekyb3d8bbwe)', pcg.publisherId(pub) === '8wekyb3d8bbwe', pcg.publisherId(pub));
    const scan = pcg.xboxScan([root]);
    check('a MicrosoftGame.config saved in UTF-16 is read too', scan.length === 2 && scan.some(g => g.title === 'Halo Infinite' && g.name === 'Microsoft.Chelan' && g.publisher === pub), JSON.stringify(scan));
    const io = pcg._xboxIo; io.platform = () => 'win32'; io.roots = () => [root];
    // PowerShell fails (timed out at startup): the games still show, families worked out, nothing remembered
    let calls = 0; io.run = async () => { calls++; return ''; };
    let g = await pcg.xboxGames();
    check('PowerShell not answering: the games in the Xbox games folders still show, with their families worked out', g.length === 2 && g.every(x => /^Microsoft\.\w+_8wekyb3d8bbwe!Game$/.test(x.shellApp)), JSON.stringify(g));
    check('…and nothing is remembered as not installed', !fs.existsSync(path.join(T, 'data', 'pc-xbox.json')), fs.existsSync(path.join(T, 'data', 'pc-xbox.json')) && fs.readFileSync(path.join(T, 'data', 'pc-xbox.json'), 'utf8'));
    check('the log says Windows didn\'t answer', logs.some(l => /didn't answer/.test(l)), JSON.stringify(logs));
    // PowerShell answers: one installed, one not
    io.run = async () => { calls++; return 'Microsoft.SunriseBaseGame|Microsoft.SunriseBaseGame_8wekyb3d8bbwe\r\nTS-END\r\n'; };
    g = await pcg.xboxGames();
    check('PowerShell answering: its answer counts (the one it doesn\'t list is not installed)', g.length === 1 && g[0].title === 'Forza Horizon 5' && g[0].shellApp === 'Microsoft.SunriseBaseGame_8wekyb3d8bbwe!Game', JSON.stringify(g));
    const n0 = calls; await pcg.xboxGames();
    check('a real answer is remembered (not asked again the same day)', calls === n0, calls - n0);
    // a day later, the not-installed one is asked about again (installed since)
    const f = path.join(T, 'data', 'pc-xbox.json'), j = JSON.parse(fs.readFileSync(f, 'utf8')); j.__askedAt = Date.now() - 25 * 3600e3; fs.writeFileSync(f, JSON.stringify(j)); pcg._xboxReset();
    let asked = ''; io.run = async (c, a) => { calls++; asked = a.join(' '); return 'Microsoft.Chelan|Microsoft.Chelan_8wekyb3d8bbwe\nTS-END\n'; };
    g = await pcg.xboxGames();
    check('a day later a game Windows said wasn\'t installed is asked about again, and shows once installed', /Microsoft\.Chelan/.test(asked) && !/SunriseBaseGame/.test(asked) && g.length === 2, asked + ' ' + JSON.stringify(g.map(x => x.title)));
    // (1.6.3) PowerShell's own rule: Get-AppxPackage -Name takes one name; a list of two or more is refused (nothing listed),
    // which made every game look uninstalled for anyone with two Xbox games or more
    const ps = cmd => { const listed = /-Name\s+'[^']*'\s*,/.test(cmd); if (listed) return 'TS-END\n'; const m = /@\(([^)]*)\)/.exec(cmd); const names = m ? m[1].split(',').map(x => x.trim().replace(/^'|'$/g, '')) : []; return names.map(n => `${n}|${n}_8wekyb3d8bbwe`).join('\n') + '\nTS-END\n'; };
    fs.writeFileSync(f, JSON.stringify({ 'Microsoft.SunriseBaseGame': '', 'Microsoft.Chelan': '', __askedAt: Date.now() })); pcg._xboxReset(); // (saved by 1.6.2's lookup: both "not installed", today)
    let cmd = ''; io.run = async (c, a) => { cmd = a.join(' '); return ps(cmd); };
    g = await pcg.xboxGames();
    check('answers saved by the old all-at-once lookup are thrown away, and both games are asked about again', /SunriseBaseGame/.test(cmd) && /Chelan/.test(cmd), cmd);
    check('two installed games are both found (one name per Get-AppxPackage, as PowerShell wants)', g.filter(x => /_8wekyb3d8bbwe!Game$/.test(x.shellApp)).length === 2, cmd + ' ' + JSON.stringify(g));
    // (beta discussion 39, again) Minecraft for Windows lives in WindowsApps, not an Xbox games folder: asked about by name too,
    // and started as its Store app
    const mc = g.find(x => x.title === 'Minecraft for Windows');
    check('Minecraft for Windows (no Xbox games folder of its own) is asked about and found, started as its Store app', /MinecraftUWP/.test(cmd) && mc && mc.shellApp === 'Microsoft.MinecraftUWP_8wekyb3d8bbwe!App', JSON.stringify(mc));
    fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(f, { force: true }); pcg._xboxReset(); io.roots = () => [];
    g = await pcg.xboxGames();
    check('…even on a PC with no Xbox games folder at all', g.length === 1 && g[0].title === 'Minecraft for Windows', JSON.stringify(g));
    // Settings → Add games → Microsoft Store apps: the Start menu's Store apps (programs and duplicates left out), and a
    // custom game that is a Store app
    io.run = async () => 'Calculator|Microsoft.WindowsCalculator_8wekyb3d8bbwe!App\r\nNotepad++|C:\\Program Files\\Notepad++\\notepad++.exe\r\nA Store Game|Publisher.AStoreGame_abc123xyz!Game\r\nCalculator|Microsoft.WindowsCalculator_8wekyb3d8bbwe!App\r\nTS-END\r\n';
    const apps = await pcg.storeApps();
    check('the Store apps in the Start menu are listed by name, sorted, without plain programs or doubles', JSON.stringify(apps) === JSON.stringify([{ title: 'A Store Game', app: 'Publisher.AStoreGame_abc123xyz!Game' }, { title: 'Calculator', app: 'Microsoft.WindowsCalculator_8wekyb3d8bbwe!App' }]), JSON.stringify(apps));
    io.run = async () => '';
    check('Windows not answering: no list (the page says so) rather than an empty one', await pcg.storeApps() === null);
    const cg = pcg.customGames([{ id: 's1', title: 'A Store Game', exe: '', shellApp: 'Publisher.AStoreGame_abc123xyz!Game' }, { id: 's2', title: 'Bad', exe: '', shellApp: 'shell:evil & calc' }]);
    check('a Store app added by hand is a custom game started as that app; a malformed address is left out', cg.length === 1 && cg[0].shellApp === 'Publisher.AStoreGame_abc123xyz!Game' && cg[0].exe === '' && cg[0].title === 'A Store Game', JSON.stringify(cg));
  } catch (e) { check('ran without an error', false, e.stack); }
  finally { fs.rmSync(T, { recursive: true, force: true }); }
  console.log(fails ? `\n${fails} check(s) failed` : '\nAll checks passed');
  process.exit(fails ? 1 : 0);
})();
