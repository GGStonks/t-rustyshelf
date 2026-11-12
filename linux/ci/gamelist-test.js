// (T)rustyShelf: a Batocera / RetroBat / EmulationStation gamelist.xml beside the games (Boxshelf beta discussion 35): the shelf takes
// its names and the pictures and manual it points to. Run: node linux/ci/gamelist-test.js
//   - names from <name> (XML escapes read), a game in a sub-folder found in the system folder's gamelist
//   - <thumbnail> is the box front (<image>, a screenshot, only when there's no box), <boxback>, <cartridge>, a PDF <manual>
//   - art (T)rustyShelf already has for a game comes first; a picture the gamelist names but that isn't there is left out
//   - a changed gamelist.xml is read again; a folder without one is scanned as before
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 400))); if (!ok) fails++; };
const ROOT = path.join(__dirname, '..', '..');
const snes = require(path.join(ROOT, 'main', 'systems.js')).CONSOLES.find(c => c.id === 'snes');
const { scanSystem } = require(path.join(ROOT, 'main', 'scanner.js'));
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-gamelist-')), dir = path.join(T, 'roms', 'snes');
const mk = (rel, body) => { const f = path.join(dir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body == null ? 'x' : body); return f; };
try {
  mk('smw.sfc'); mk('Hacks/kaizo.sfc'); mk('zelda3.sfc'); mk('Plain Game (USA).sfc');
  mk('images/smw-thumb.png'); mk('images/smw-image.png'); mk('images/smw-boxback.png'); mk('images/smw-cartridge.png'); mk('manuals/smw-manual.pdf');
  mk('images/kaizo-image.png'); mk('images/zelda3-thumb.png');
  mk('covers/zelda3.png', 'own cover'); // (art kept the (T)rustyShelf way: the covers folder beside the games)
  const xml = n => `<?xml version="1.0"?>\n<gameList>\n  <game id="1" source="ScreenScraper.fr">\n    <path>./smw.sfc</path>\n    <name>${n}</name>\n    <thumbnail>./images/smw-thumb.png</thumbnail>\n    <image>./images/smw-image.png</image>\n    <boxback>./images/smw-boxback.png</boxback>\n    <cartridge>./images/smw-cartridge.png</cartridge>\n    <manual>./manuals/smw-manual.pdf</manual>\n    <video>./videos/smw-video.mp4</video>\n  </game>\n  <game><path>./Hacks/kaizo.sfc</path><name>Kaizo Mario &#8211; World</name><image>./images/kaizo-image.png</image><thumbnail>./images/missing.png</thumbnail></game>\n  <game><path>./zelda3.sfc</path><name>The Legend of Zelda: A Link to the Past</name><thumbnail>./images/zelda3-thumb.png</thumbnail></game>\n</gameList>\n`;
  fs.writeFileSync(path.join(dir, 'gamelist.xml'), xml('Super Mario World &amp; Friends'));
  const byFile = () => Object.fromEntries(scanSystem(snes, { romDirs: [dir] }, true).map(g => [path.relative(dir, g.file).replace(/\\/g, '/'), g]));
  let g = byFile();
  check('names come from the gamelist (its XML escapes read)', g['smw.sfc'] && g['smw.sfc'].title === 'Super Mario World & Friends' && g['zelda3.sfc'].title === 'The Legend of Zelda: A Link to the Past', JSON.stringify(Object.values(g).map(x => x.title)));
  check('a game in a sub-folder is found in the system folder\'s gamelist', g['Hacks/kaizo.sfc'] && g['Hacks/kaizo.sfc'].title === 'Kaizo Mario – World', g['Hacks/kaizo.sfc'] && g['Hacks/kaizo.sfc'].title);
  const a = g['smw.sfc'].art;
  check('the box front is <thumbnail>, with <boxback>, <cartridge> and the PDF <manual>', /smw-thumb\.png$/.test(a.front) && /smw-boxback\.png$/.test(a.back) && /smw-cartridge\.png$/.test(a.disc) && /smw-manual\.pdf$/.test(a.manualPdf), JSON.stringify(a));
  check('<image> (the screenshot) is the picture behind the game', /smw-image\.png$/.test(a.hero || ''), a.hero);
  check('a picture the gamelist names but that isn\'t there is left out (the screenshot stands in for the box)', /kaizo-image\.png$/.test(g['Hacks/kaizo.sfc'].art.front || ''), g['Hacks/kaizo.sfc'].art.front);
  check('art (T)rustyShelf already has comes first', /covers[\\/]zelda3\.png$/.test(g['zelda3.sfc'].art.front || ''), g['zelda3.sfc'].art.front);
  check('a game the gamelist doesn\'t list is named and found as before', g['Plain Game (USA).sfc'] && /^Plain Game/.test(g['Plain Game (USA).sfc'].title) && !g['Plain Game (USA).sfc'].art.front, JSON.stringify(g['Plain Game (USA).sfc']));
  fs.writeFileSync(path.join(dir, 'gamelist.xml'), xml('Super Mario World (renamed)')); const t = new Date(Date.now() + 5000); fs.utimesSync(path.join(dir, 'gamelist.xml'), t, t);
  g = byFile();
  check('a changed gamelist.xml is read again', g['smw.sfc'].title === 'Super Mario World (renamed)', g['smw.sfc'].title);
} catch (e) { check('ran without an error', false, e.stack); }
finally { fs.rmSync(T, { recursive: true, force: true }); }
console.log(fails ? `\n${fails} check(s) failed` : '\nAll checks passed');
process.exit(fails ? 1 : 0);
