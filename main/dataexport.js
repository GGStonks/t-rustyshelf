// (T)rustyShelf: Export everything / Import everything (Settings → System), asked for in Boxshelf's issue 18: a big
// collection's art and manuals take days to download, so they can be carried to another PC (or a second install) whole.
// Kept free of Electron (main.js passes in what it knows), so linux/ci/dataexport-test.js runs it on its own.
//
// An export is one folder, "(T)rustyShelf export <date>", holding:
//   data/          the data folder: settings, favourites, play history, box art database, caches of art, PC covers …
//                  (not the browser engine's caches, logs or sign-ins: cookies, Epic's login, the phone pairing)
//   app/<name>/    the app folder's Library (art kept in (T)rustyShelf's folder), themes, Custom themes, Guides,
//                  Magazines and Songs, and an art library kept elsewhere as app/Library-elsewhere
//   rom-art/<console>/<n>/   art and manuals kept next to the games (each console's covers / manuals folders)
//   manifest.json  what's where, and where it came from
// ((T)rustyShelf issue 6) exportSize() says how big an export is before a folder is chosen. An export said in bytes and files
// as it goes (onProgress: done / total, files, the step, time left), and it can be paused, resumed and cancelled (control:
// { paused, cancelled }, read between files). Exporting into a folder that already holds an export (or into the export
// itself) updates that export: only files that are new or changed (another size or time) are copied, so the second run of a
// big collection is quick. Nothing is ever deleted from an export.
// An import copies an export back: nothing is deleted, files of the same name are replaced (config.json is kept as
// config-before-import-<date>.json first); art from next to the games goes to the same folder if this PC has it, else
// to the same console's folder in the same place on the list. The app then starts again on the imported settings.
'use strict';
const fs = require('fs'), fsp = fs.promises, path = require('path');

const SKIP = /^(cache|code cache|gpucache|dawngraphitecache|dawnwebgpucache|grshadercache|shadercache|blob_storage|crashpad|logs|session storage|shared dictionary|sharedstorage|dictionaries|dips|trust tokens.*|cookies.*|network persistent state|transportsecurity|preferences|local state|devtoolsactiveport|padwatch|legendary|companion\.json|.*\.log|.*\.tmp|singleton.*|lockfile|.*\.lock|lock)$/i;
const APP_DIRS = ['Library', 'themes', 'Custom themes', 'Guides', 'Magazines', 'Songs'];
const isDir = p => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const inside = (p, root) => { const a = path.resolve(p).toLowerCase(), b = path.resolve(root).toLowerCase(); return a === b || a.startsWith(b + path.sep); };
// what's left out is decided at the data folder's top level only (inside Local Storage, *.log files are its data)
const topSkip = root => { const r = path.resolve(root); return src => path.resolve(path.dirname(src)) !== r || !SKIP.test(path.basename(src)); };
const stamp = () => new Date().toISOString().slice(0, 16).replace('T', ' ').replace(/:/g, '-');

async function ensureDir(d) {
  if (!d) return;
  if (/^([a-zA-Z]:[\\/]?|[\\/])$/.test(d)) return;
  if (isDir(d)) return;
  try { await fsp.mkdir(d, { recursive: true }); } catch (e) { if (e.code !== 'EEXIST' && !isDir(d)) throw e; }
}

async function size(p) { let n = 0, files = 0; const walk = async d => { let ents; try { ents = await fsp.readdir(d, { withFileTypes: true }); } catch { return; } for (const e of ents) { const f = path.join(d, e.name); if (e.isDirectory()) await walk(f); else if (e.isFile()) { try { n += (await fsp.stat(f)).size; files++; } catch {} } } }; if (isDir(p)) await walk(p); else { try { n = (await fsp.stat(p)).size; files = 1; } catch {} } return { bytes: n, files }; }
// every file under src that the filter lets through: [{ src, rel, size, mtimeMs }] (a single file: rel '')
async function list(src, filter = () => true) {
  const out = [], st = await fsp.stat(src).catch(() => null);
  if (!st || !filter(src)) return out;
  if (st.isFile()) { out.push({ src, rel: '', size: st.size, mtimeMs: st.mtimeMs }); return out; }
  const walk = async (d, rel) => {
    let ents; try { ents = await fsp.readdir(d, { withFileTypes: true }); } catch { return; }
    for (const ent of ents) {
      const f = path.join(d, ent.name), r = rel ? path.join(rel, ent.name) : ent.name;
      if (!filter(f)) continue;
      if (ent.isDirectory()) await walk(f, r);
      else if (ent.isFile()) { try { const s2 = await fsp.stat(f); out.push({ src: f, rel: r, size: s2.size, mtimeMs: s2.mtimeMs }); } catch {} }
    }
  };
  if (st.isDirectory()) await walk(src, '');
  return out;
}
const CANCELLED = 'The export was cancelled.';
// a copy job: steps of [label, files, destination root]; copied one file at a time, pausable and cancellable between files.
// same (differential): a file already there with the same size and time is left as it is
function job({ control = {}, onProgress = () => {}, same = false, what = 'export' }) {
  const t0 = Date.now(); let done = 0, files = 0, copied = 0, copiedBytes = 0, total = 0, ofFiles = 0, paused = 0, lastSay = 0, label = '';
  const say = force => { const now = Date.now(); if (!force && now - lastSay < 250) return; lastSay = now;
    const spent = (now - t0 - paused) / 1000, rate = spent > 2 && done > 0 ? done / spent : 0;
    onProgress({ what, bytes: done, of: total, files, ofFiles, label, copied, paused: !!control.paused, eta: rate ? Math.round((total - done) / rate) : null }); };
  async function gate() {
    if (control.paused && !control.cancelled) { const p0 = Date.now(); say(true); while (control.paused && !control.cancelled) await new Promise(r => setTimeout(r, 150)); paused += Date.now() - p0; say(true); }
    if (control.cancelled) { const e = new Error(what === 'import' ? 'The import was cancelled.' : CANCELLED); e.cancelled = true; throw e; }
  }
  async function one(f, dst) {
    await gate();
    if (same) { const d = await fsp.stat(dst).catch(() => null); if (d && d.isFile() && d.size === f.size && Math.abs(d.mtimeMs - f.mtimeMs) < 2000) { done += f.size; files++; say(); return; } }
    await ensureDir(path.dirname(dst));
    try { await fsp.copyFile(f.src, dst); const t = new Date(f.mtimeMs); await fsp.utimes(dst, t, t).catch(() => {}); /* (the file's own time kept: the next export into it compares by it) */ copied++; copiedBytes += f.size; }
    catch (e) { if (!['EBUSY', 'EPERM', 'EACCES', 'ETXTBSY'].includes(e.code)) throw e; }
    done += f.size; files++; say();
  }
  return {
    plan(steps) { total = steps.reduce((a, s) => a + s.files.reduce((b, f) => b + f.size, 0), 0); ofFiles = steps.reduce((a, s) => a + s.files.length, 0); },
    async run(step) { label = step.label; say(true); for (const f of step.files) await one(f, f.rel ? path.join(step.to, f.rel) : step.to); },
    end() { say(true); return { copied, copiedBytes, unchanged: files - copied }; }
  };
}

// the art kept next to each console's games: [{ console, n, path }] (not what's already inside the app folder or the library)
function romArt(cfg, artDirsFor, appRoot, artLib) {
  const out = [];
  for (const [id, sc] of Object.entries((cfg && cfg.systems) || {})) {
    let n = 0;
    for (const d of [...(artDirsFor(sc) || []), ...((sc && sc.romDirs) || []).map(r => path.join(r, 'manuals'))].filter(Boolean)) { // (and a manuals folder of your own beside the games)
      if (!isDir(d) || inside(d, appRoot) || (artLib && inside(d, artLib)) || out.some(o => path.resolve(o.path) === path.resolve(d))) continue;
      out.push({ console: id, n: n++, path: d });
    }
  }
  return out;
}

// what goes into an export: [{ label, src, to (relative to the export), filter, part / art }]
function parts({ appRoot, dataDir, cfg, artDirsFor, artLib }) {
  const out = [{ label: 'Settings and downloads', src: dataDir, to: 'data', filter: topSkip(dataDir), part: 'data' }];
  for (const name of APP_DIRS) { const p = path.join(appRoot, name); if (isDir(p)) out.push({ label: name, src: p, to: path.join('app', name), part: 'app/' + name }); }
  if (artLib && isDir(artLib) && !inside(artLib, appRoot)) out.push({ label: 'Art library', src: artLib, to: path.join('app', 'Library-elsewhere'), part: 'app/Library-elsewhere', artLib: true });
  for (const a of romArt(cfg, artDirsFor, appRoot, artLib)) out.push({ label: `${a.console} art next to the games`, src: a.path, to: path.join('rom-art', a.console, String(a.n)), art: a });
  return out;
}
// → { bytes, files }: how big an export of this install would be (before a folder is chosen)
async function exportSize(o) { let bytes = 0, files = 0; for (const p of parts(o)) for (const f of await list(p.src, p.filter)) { bytes += f.size; files++; } return { bytes, files }; }
const isExport = d => { try { return /\(T\)rustyShelf/.test(JSON.parse(fs.readFileSync(path.join(d, 'manifest.json'), 'utf8')).app || ''); } catch { return false; } };
// the earlier export to update: dest itself, else the newest "(T)rustyShelf export …" folder in it
function earlier(dest) {
  if (isExport(dest)) return dest;
  let ents = []; try { ents = fs.readdirSync(dest, { withFileTypes: true }); } catch {}
  return ents.filter(e => e.isDirectory() && /^\(T\)rustyShelf export /.test(e.name)).map(e => path.join(dest, e.name)).filter(isExport).sort().pop() || null;
}
// → { dir, bytes, files, parts, updated, copied, copiedBytes, unchanged }
async function exportAll({ dest, appRoot, dataDir, cfg, artDirsFor, artLib, version, onStep = () => {}, onProgress, control }) {
  if (!dest || !isDir(dest)) throw new Error('Choose a folder to export to.');
  const prev = earlier(dest), dir = prev || path.join(dest, `(T)rustyShelf export ${stamp()}`); await ensureDir(dir);
  const manifest = { app: '(T)rustyShelf', version: version || '', at: new Date().toISOString(), from: { appRoot, dataDir }, parts: [], romArt: [] };
  if (prev) { try { const m = JSON.parse(await fsp.readFile(path.join(dir, 'manifest.json'), 'utf8')); manifest.first = m.first || m.at; } catch {} }
  const j = job({ control, onProgress, same: !!prev, what: 'export' }), steps = [];
  for (const p of parts({ appRoot, dataDir, cfg, artDirsFor, artLib })) steps.push({ ...p, to: path.join(dir, p.to), files: await list(p.src, p.filter) });
  j.plan(steps);
  for (let i = 0; i < steps.length; i++) { const st = steps[i]; onStep({ i: i + 1, of: steps.length, label: st.label }); await j.run(st);
    if (st.part) manifest.parts.push(st.part); if (st.artLib) manifest.artLib = artLib; if (st.art) manifest.romArt.push({ ...st.art, rel: path.relative(dir, st.to) }); }
  await fsp.writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  const s = await size(dir); return { dir, ...s, parts: manifest.parts.length + manifest.romArt.length, updated: !!prev, ...j.end() };
}

// → { files, parts, skipped: [what had nowhere to go] }
async function importAll({ src, appRoot, dataDir, artDirsFor, artLib, readCfg, onStep = () => {}, onProgress, control }) {
  const j = job({ control, onProgress, what: 'import' }), copy = async (from, to, filter) => { await j.run({ label: '', to, files: await list(from, filter) }); };
  let manifest; try { manifest = JSON.parse(await fsp.readFile(path.join(src, 'manifest.json'), 'utf8')); } catch { throw new Error('That folder isn\'t a (T)rustyShelf export (no manifest.json in it).'); }
  if (manifest.app !== '(T)rustyShelf' && manifest.app !== 'Boxshelf') throw new Error('That folder isn\'t a (T)rustyShelf export.');
  const steps = [], skipped = [];
  if (isDir(path.join(src, 'data'))) steps.push(['Settings and downloads', async () => {
    const cfgNow = path.join(dataDir, 'config.json');
    if (fs.existsSync(cfgNow)) {
      try { await fsp.copyFile(cfgNow, path.join(dataDir, `config-before-import-${stamp()}.json`)); } catch {}
    }
    await copy(path.join(src, 'data'), dataDir, topSkip(path.join(src, 'data'))); }]);
  for (const name of APP_DIRS) { const p = path.join(src, 'app', name); if (isDir(p)) steps.push([name, () => copy(p, path.join(appRoot, name))]); }
  const elsewhere = path.join(src, 'app', 'Library-elsewhere');
  if (isDir(elsewhere)) steps.push(['Art library', () => copy(elsewhere, artLib && !inside(artLib, appRoot) ? artLib : path.join(appRoot, 'Library'))]);
  // art from next to the games: the folder it came from when this PC has it, else that console's folder in the same place
  const cfg = (readCfg && readCfg()) || {};
  for (const a of manifest.romArt || []) {
    steps.push([`${a.console} art next to the games`, async () => {
      const from = path.join(src, a.rel); if (!isDir(from)) return;
      let to = isDir(path.dirname(a.path)) ? a.path : null;
      if (!to) { const sc = cfg.systems && cfg.systems[a.console]; const list = sc ? (artDirsFor(sc) || []).filter(d => d && !inside(d, appRoot) && !(artLib && inside(d, artLib))) : []; to = list[a.n] || list[0] || null; if (to && !isDir(path.dirname(to))) to = null; }
      if (!to) { skipped.push(`${a.console}: ${a.path}`); return; }
      await copy(from, to);
    }]);
  }
  j.plan([{ files: [{ size: (await size(src)).bytes }] }]);
  for (let i = 0; i < steps.length; i++) { onStep({ i: i + 1, of: steps.length, label: steps[i][0] }); await steps[i][1](); }
  return { parts: steps.length, skipped, from: manifest.at, ...j.end() };
}

module.exports = { exportAll, importAll, exportSize, romArt, SKIP };
