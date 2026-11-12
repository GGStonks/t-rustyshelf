// beta issue 34: (T)rustyShelf 1.7.0.0 still hung at launch, the stall watch naming "scan steam" for minutes. Valve's text
// format reader went round forever on a space it didn't know (a no-break space, a form feed, a byte-order mark) between two
// strings: neither the space skipper nor an unquoted string moved past it. Each case runs in a child process with a time
// limit, so a parser that loops fails the check instead of hanging the test. Run: node linux/ci/vdf-test.js
'use strict';
const path = require('path'), { spawnSync } = require('child_process');
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 400))); if (!ok) fails++; };
const VDF = path.join(__dirname, '..', '..', 'main', 'vdf.js');
const parse = text => { const r = spawnSync(process.execPath, ['-e', `process.stdout.write(JSON.stringify(require(${JSON.stringify(VDF)}).parse(${JSON.stringify(text)})))`], { timeout: 3000, encoding: 'utf8' });
  return r.error || r.status !== 0 ? { hung: true, err: String(r.error || r.stderr).slice(0, 200) } : JSON.parse(r.stdout); };
const acf = sp => `"AppState"\n{\n\t"appid"${sp}"10"\n\t"name"\t\t"Game"\n}\n`;
for (const [what, sp] of [['a no-break space', '\u00a0'], ['a form feed', '\f'], ['a vertical tab', '\v'], ['a byte-order mark', '\ufeff'], ['an ideographic space', '\u3000']]) {
  const r = parse(acf(sp));
  check(`${what} between a key and its value: read, not stuck`, !r.hung && r.AppState && r.AppState.appid === '10' && r.AppState.name === 'Game', JSON.stringify(r));
}
const odd = parse('"a" "b"\n}\n}\n"c"\t"d"'), eof = parse('"a"\t{\n"b"\t"');
check('stray closing braces and a file cut short: still finishes', !odd.hung && !eof.hung, JSON.stringify([odd, eof]));
const normal = parse('// a comment\n"libraryfolders"\n{\n\t"0"\n\t{\n\t\t"path"\t\t"C:\\\\Steam"\n\t}\n\tunquoted value\n}\n');
check('ordinary files read as before (comments, escapes, unquoted words)', !normal.hung && normal.libraryfolders && normal.libraryfolders['0'].path === 'C:\\Steam' && normal.libraryfolders.unquoted === 'value', JSON.stringify(normal));
console.log(fails ? `\n${fails} FAILED` : '\nall passed'); process.exit(fails ? 1 : 0);
