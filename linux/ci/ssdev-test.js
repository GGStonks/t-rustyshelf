// (T)rustyShelf issue 26: the builds carry (T)rustyShelf's own ScreenScraper developer login, written by CI from the
// repository's secrets. Run: node linux/ci/ssdev-test.js
//   - scripts/ss-dev.js writes { devId, devPass } with both secrets, and nothing without them
//   - main/screenscraper.js takes it from main/ss-dev.json; neither file can go into git (.gitignore)
//   - every build job runs it from the secrets, and the calling workflows pass the secrets on
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 400))); if (!ok) fails++; };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tsssdev-'));
try {
  const run = (out, env) => execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'ss-dev.js'), out], { env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' });
  const a = path.join(tmp, 'a', 'ss-dev.json'), log = run(a, { SS_DEV_ID: 'devname', SS_DEV_PASS: 'devsecret' });
  check('with both secrets: { devId, devPass } is written', JSON.stringify(JSON.parse(fs.readFileSync(a, 'utf8'))) === JSON.stringify({ devId: 'devname', devPass: 'devsecret' }));
  check('the log never shows the login itself', !/devname|devsecret/.test(log), log);
  const b = path.join(tmp, 'b.json'); run(b, { SS_DEV_ID: 'only-one' });
  check('without both secrets nothing is written', !fs.existsSync(b));
  const ss = fs.readFileSync(path.join(ROOT, 'main', 'screenscraper.js'), 'utf8');
  check('main/screenscraper.js reads main/ss-dev.json', /require\('\.\/ss-dev\.json'\)/.test(ss));
  const ign = execFileSync('git', ['-C', ROOT, 'check-ignore', 'main/ss-dev.json', 'android-app/android/app/src/main/assets/ss-dev.json'], { encoding: 'utf8' });
  check('neither login file can go into git', /main\/ss-dev\.json/.test(ign) && /assets\/ss-dev\.json/.test(ign), ign);
  const wf = f => fs.readFileSync(path.join(ROOT, '.github', 'workflows', f), 'utf8'), b2 = wf('build.yml');
  check('the Linux, Windows and Android builds write it from the secrets', (b2.match(/node scripts\/ss-dev\.js main\/ss-dev\.json/g) || []).length === 2 && /node scripts\/ss-dev\.js android-app\/android\/app\/src\/main\/assets\/ss-dev\.json/.test(b2) && (b2.match(/SS_DEV_PASS: \$\{\{ secrets\.SS_DEV_PASS \}\}/g) || []).length === 3);
  check('the workflows that call the build pass the secrets on', ['build-release-check.yml', 'release.yml'].every(f => /uses: \.\/\.github\/workflows\/build\.yml\n\s+secrets: inherit/.test(wf(f))));
} catch (e) { check('the test ran to the end', false, e && e.stack); }
finally { fs.rmSync(tmp, { recursive: true, force: true }); }
console.log(fails ? `${fails} failed` : 'all passed'); process.exit(fails ? 1 : 0);
