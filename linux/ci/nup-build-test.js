// (T)rustyShelf issue 18: Fortune's Eden, a Switch 2 build that opens .nup games, was greyed out at Play ("can't open .nup
// games"). The look inside a build also finds the text in UTF-16 and in the build's own libraries, and a build it isn't
// sure about stays startable. Run: node linux/ci/nup-build-test.js
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 400))); if (!ok) fails++; };
const root = path.join(__dirname, '..', '..');
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-nup-'));
const put = (p, ...parts) => { const f = path.join(T, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, Buffer.concat([Buffer.alloc(5000, 7), ...parts.map(x => Buffer.isBuffer(x) ? x : Buffer.from(x, 'latin1')), Buffer.alloc(3000, 9)])); return f; };
(async () => {
  try {
    const nx2 = require(path.join(root, 'main', 'nx2.js'));
    nx2.setMemoFile(path.join(T, 'memo.json'));
    const plain = put('a/eglantine.exe', 'Switch games (*.nsp *.xci *.nup)');
    const wide = put('b/fortunes-eden.exe', Buffer.from('Switch games (*.nsp *.xci *.nup)', 'utf16le'));
    const inDll = put('c/fortunes-eden.exe', 'nothing here'); put('c/eden-core.dll', Buffer.from('*.nup', 'utf16le'));
    const runtimeOnly = put('d/eglantine.exe', 'nothing here'); put('d/Qt6Core.dll', '*.nup'); put('d/vcruntime140.dll', '*.nup');
    const none = put('e/eglantine.exe', 'Switch games (*.nsp *.xci)');
    const nup = async f => (await nx2.buildOf(f)).nup;
    check('.nup named as plain text in the program: opens .nup', await nup(plain) === true);
    check('.nup named in UTF-16 (Windows and Qt programs keep their text so): opens .nup', await nup(wide) === true);
    check('.nup named in the build\'s own library beside the program: opens .nup', await nup(inDll) === true);
    check('.nup only in the runtimes every build carries (Qt, Visual C++): not counted', await nup(runtimeOnly) === false);
    check('no .nup anywhere: not seen to open .nup', await nup(none) === false);
    const memo = JSON.parse(fs.readFileSync(path.join(T, 'memo.json'), 'utf8'));
    check('answers are remembered under the new key (older "no" answers are looked at again)', Object.keys(memo).length >= 4 && Object.keys(memo).every(k => k.startsWith('v3|')), Object.keys(memo).join(' '));
    // the picker at Play: a build not seen to open .nup is marked, never greyed out or refused
    const app = fs.readFileSync(path.join(root, 'renderer', 'app.js'), 'utf8'), pick = app.slice(app.indexOf('async function pickBuild'), app.indexOf('const BP_ADD'));
    check('the build picker keeps every build startable, marking the unsure ones', /may not open \.nup games/.test(pick) && !/disabled:/.test(pick) && !/None of your Switch 2 builds can open/.test(pick), '');
    const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8'), h = main.slice(main.indexOf("handle('sw2:builds'"), main.indexOf("handle('launch:game'"));
    check('with no build seen to open .nup, the game\'s own pick and the shelf\'s are still offered first', /\|\| want\.map\(w => list\.find\(b => low\(b\.exe\) === w\)\)\.find\(Boolean\)/.test(h), '');
  } catch (e) { check('ran without an error', false, e.stack); }
  finally { fs.rmSync(T, { recursive: true, force: true }); }
  console.log(fails ? `\n${fails} check(s) failed` : '\nAll checks passed');
  process.exit(fails ? 1 : 0);
})();
