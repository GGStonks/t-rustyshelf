// (T)rustyShelf issue 24: a drive that runs out of space while box art or manuals download. The art run used to go on
// trying every picture for every game there (5,000 "no space left on device" in one log, the run looking frozen), and
// manual pages were copied to the library's drive with the app held up. Run: node linux/ci/fulldrive-test.js
//   - a picture that can't be written for lack of space marks its drive full for the run (logged once), and the next
//     picture for that drive isn't even downloaded
//   - Settings' result names the full drive; the shelf's art card says it when the background run ends
//   - manual pages move with fs.promises (a rename, or a copy when the rename can't), and a full drive stops the move
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 500))); if (!ok) fails++; };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tsfull-'));
let fetches = 0;
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(4000, 1)]);
{ const Mod = require('module'), load0 = Mod._load; Mod._load = function (r, ...x) { return r === 'electron' ? { net: { fetch: async () => { fetches++; return { ok: true, status: 200, arrayBuffer: async () => PNG }; } } } : load0.call(this, r, ...x); }; }
const ENOSPC = () => Object.assign(new Error('ENOSPC: no space left on device, write'), { code: 'ENOSPC' });
const wf = fs.promises.writeFile; fs.promises.writeFile = async (f, ...a) => { if (String(f).includes('FULL')) throw ENOSPC(); return wf.call(fs.promises, f, ...a); };
(async () => {
  try {
    const covers = require(path.join(ROOT, 'main', 'covers.js'));
    const logs = []; try { covers.init({ cacheDir: path.join(tmp, 'cache'), log: (...a) => logs.push(a.join(' ')) }); } catch {}
    const full = path.join(tmp, 'FULL', 'covers');
    const r1 = await covers._fetchInto('https://example.com/a.png', full, 'Game A', '', '.png', null, false);
    check('a picture that can\'t be written for lack of space: "full", and its drive is marked full for the run', r1 === 'full' && covers._fullDrives().length === 1, JSON.stringify({ r1, full: covers._fullDrives() }));
    const r2 = await covers._fetchInto('https://example.com/b.png', full, 'Game B', '', '.png', null, false);
    check('no leftover temp files where it failed', !fs.existsSync(full) || !fs.readdirSync(full).some(f => /incoming|\.part$/.test(f)), fs.existsSync(full) ? fs.readdirSync(full).join(',') : '');
    check('the next one there is "full" too (no thousands of failures in the log)', r2 === 'full', r2);
    const ok = await covers._fetchInto('https://example.com/c.png', path.join(tmp, 'roomy', 'covers'), 'Game C', '', '.png', null, false);
    check('a drive with room still gets its picture', ok === true && fs.existsSync(path.join(tmp, 'roomy', 'covers', 'Game C.png')), ok);
    const src = fs.readFileSync(path.join(ROOT, 'main', 'covers.js'), 'utf8');
    check('a run skips the games on a full drive and its report names the drive', /if \(fullDrives\.has\(driveOf\(dir\)\)\) \{ done\+\+;/.test(src) && /report\.full = \[\.\.\.fullDrives\]/.test(src) && /fullDrives\.clear\(\)/.test(src));
    const set = fs.readFileSync(path.join(ROOT, 'renderer', 'settings.js'), 'utf8'), app = fs.readFileSync(path.join(ROOT, 'renderer', 'app.js'), 'utf8'), main = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
    check('Settings\' result names the full drive; the shelf\'s art card says it at the end', /\(r\.full\|\|\[\]\)\.forEach\(d=>L\.push\(infoRow\(`\$\{String\(d\)/.test(set) && /i\.full\.length\)toast\(/.test(app) && /full: rep\.full \|\| \[\]/.test(main));
    // manuals: the pages' move
    const mc = require(path.join(ROOT, 'main', 'manualcoll.js'));
    const a = path.join(tmp, 'p1.jpg'), b = path.join(tmp, 'lib', 'p1.jpg'); fs.writeFileSync(a, 'x'); fs.mkdirSync(path.dirname(b));
    const rn = fs.promises.rename; fs.promises.rename = async () => { throw Object.assign(new Error('EXDEV: cross-device link not permitted'), { code: 'EXDEV' }); };
    try { await mc._moveFileA(a, b); } finally { fs.promises.rename = rn; }
    check('a manual page moves to another drive by copying (async), the temp copy gone', fs.existsSync(b) && !fs.existsSync(a));
    fs.writeFileSync(a, 'x'); fs.promises.rename = async () => { throw ENOSPC(); }; let err = null;
    try { await mc._moveFileA(a, path.join(tmp, 'lib', 'p2.jpg')); } catch (e) { err = e; } finally { fs.promises.rename = rn; }
    check('a full drive stops the move with ENOSPC (the manual is put back, the drive skipped for the run)', err && err.code === 'ENOSPC' && fs.existsSync(a), err && err.message);
    const msrc = fs.readFileSync(path.join(ROOT, 'main', 'manualcoll.js'), 'utf8');
    check('manual pages are moved with await (the app isn\'t held up), a full drive is skipped for the rest of the run', /await moveFileA\(path\.join\(stage, f\), d\)/.test(msrc) && /if \(fullDrives\.has\(r\)\)/.test(msrc));
  } catch (e) { check('the test ran to the end', false, e && e.stack); }
  finally { fs.promises.writeFile = wf; try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} }
  console.log(fails ? `${fails} failed` : 'all passed'); process.exit(fails ? 1 : 0);
})();
