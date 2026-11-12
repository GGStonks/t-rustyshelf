// (T)rustyShelf issue 25: "Hide the taskbar during games" hides the taskbar on (T)rustyShelf's monitor only (where the game
// opens), not on every monitor. Run: node linux/ci/taskbar-test.js
//   - the pad helper hides it with its own window handle ($self), so only that monitor's taskbar goes
//   - the one-off PowerShell (no helper running) hides it near the window handle main gave (setSelf); showing shows them all
//   - the helper's C# compiles with a C# 5 compiler (the one Windows PowerShell's Add-Type uses), where one is installed,
//     with Taskbar(show) and Taskbar(show, near)
// The window changes themselves are Win32 calls and can only be tried on Windows; nothing here touches a window.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 500))); if (!ok) fails++; };
try {
  const pw = require(path.join(ROOT, 'main', 'padwatch.js')), S = pw._script();
  const hides = S.match(/\[XI\]::Taskbar\(\$false[^)]*\)/g) || [];
  check('the helper hides the taskbar near its own window ($self), every time', hides.length >= 3 && hides.every(x => x === '[XI]::Taskbar($false, $self)'), hides.join(' | '));
  check('the helper shows them all again', /\[XI\]::Taskbar\(\$true\)/.test(S));
  pw.setSelf('123456789');
  const hide = pw._taskbarPs(false), show = pw._taskbarPs(true);
  check('without the helper, the hide names the window (its monitor only)', /Taskbar\(\$false, \[IntPtr\]\[long\]123456789\)|Set\(\$false, \[IntPtr\]\[long\]123456789\)/.test(hide), hide.slice(-120));
  check('a bad window handle never reaches the command as text', !/;\s*calc/.test((pw.setSelf('1; calc'), pw._taskbarPs(false))));
  check('showing passes $true (every monitor\'s comes back)', /\(\$true, /.test(show), show.slice(-120));
  // the C# between @" and "@ in the helper's script
  const a = S.indexOf('@"'), b = S.indexOf('"@', a), cs = S.slice(a + 2, b).replace(/""/g, '"');
  check('the C# has both Taskbar(show) and Taskbar(show, near)', /public static int Taskbar\(bool show\) \{ return Taskbar\(show, IntPtr\.Zero\); \}/.test(cs) && /public static int Taskbar\(bool show, IntPtr near\)/.test(cs));
  let cc = ''; for (const c of ['mcs', 'csc']) { try { execFileSync('which', [c], { stdio: 'pipe' }); cc = c; break; } catch {} }
  if (!cc) console.log('SKIP  no C# compiler here: the helper\'s C# was not compiled');
  else {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tstb-')); fs.writeFileSync(path.join(tmp, 'XI.cs'), cs);
    let out = '', ok = true; try { execFileSync(cc, cc === 'mcs' ? ['-langversion:5', '-target:library', '-out:' + path.join(tmp, 'XI.dll'), path.join(tmp, 'XI.cs')] : ['/target:library', '/langversion:5', '/out:' + path.join(tmp, 'XI.dll'), path.join(tmp, 'XI.cs')], { stdio: 'pipe' }); } catch (e) { ok = false; out = String(e.stdout || '') + String(e.stderr || ''); }
    const fb = /Add-Type -TypeDefinition '([^']+)'/.exec(pw._taskbarPs(false)); fs.writeFileSync(path.join(tmp, 'Tb.cs'), fb ? fb[1] : '');
    let out2 = '', ok2 = !!fb; try { execFileSync(cc, cc === 'mcs' ? ['-langversion:5', '-target:library', '-out:' + path.join(tmp, 'Tb.dll'), path.join(tmp, 'Tb.cs')] : ['/target:library', '/langversion:5', '/out:' + path.join(tmp, 'Tb.dll'), path.join(tmp, 'Tb.cs')], { stdio: 'pipe' }); } catch (e) { ok2 = false; out2 = String(e.stdout || '') + String(e.stderr || ''); }
    check('the one-off fallback\'s C# (no cached helper) compiles too, with Set(show, near)', ok2 && /Set\(bool show, IntPtr near\)/.test(fb ? fb[1] : ''), out2.split('\n').filter(l => /error/i.test(l)).slice(0, 4).join(' | '));
    check('the helper\'s C# compiles (C# 5)', ok && fs.existsSync(path.join(tmp, 'XI.dll')), out.split('\n').filter(l => /error/i.test(l)).slice(0, 4).join(' | ')); try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  }
} catch (e) { check('the test ran to the end', false, e && e.stack); }
console.log(fails ? `${fails} failed` : 'all passed'); process.exit(fails ? 1 : 0);
