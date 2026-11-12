// (T)rustyShelf: the gamelist.xml that Batocera, RetroBat and EmulationStation keep in each system's games folder (asked for in
// Boxshelf beta discussion 35). Each <game> names its file (<path>) and what was scraped for it: <name>, and pictures, a video
// and a manual kept beside the games (./images/…, ./videos/…, ./manuals/…). The shelf takes the name and uses those files as
// the game's art, so a collection already scraped there needs nothing downloaded again.
// Which picture is which (Batocera's and RetroBat's own tags): <thumbnail> / <boxart> the box front (Batocera keeps the box
// there; <image> is its screenshot or mix, used only when there's no box), <boxback> the back, <cartridge> the disc or
// cartridge, <fanart> / <image> the picture behind the game, <manual> a PDF, <video> a clip.
// Read once per folder and kept until the file changes (its time and size).
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');

const cache = new Map(); // folder (lower case) → { key: 'mtime:size', games: Map(file lower case → entry) }
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unxml = s => String(s || '').replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e.toLowerCase()] ?? m)).trim();
const isFile = p => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const TAGS = ['path', 'name', 'image', 'thumbnail', 'boxart', 'boxback', 'cartridge', 'fanart', 'marquee', 'wheel', 'video', 'manual', 'desc', 'releasedate', 'developer', 'publisher', 'genre'];

// a path as gamelist.xml writes it ("./x.zip", "~/roms/…", "/userdata/roms/…", "images\\x.png") made real, from its folder
function real(p, dir) {
  let s = unxml(p); if (!s) return '';
  if (/^~[\\/]/.test(s)) s = path.join(os.homedir(), s.slice(2));
  else if (!path.isAbsolute(s) && !/^[a-z]:[\\/]/i.test(s)) s = path.join(dir, s.replace(/^\.[\\/]/, ''));
  return path.normalize(s.replace(/[\\/]/g, path.sep));
}
function parse(xml, dir, exists = isFile) {
  const games = new Map();
  for (const m of String(xml).matchAll(/<game\b[^>]*>([\s\S]*?)<\/game>/gi)) {
    const body = m[1], e = {};
    for (const t of TAGS) { const x = new RegExp(`<${t}>([\\s\\S]*?)</${t}>`, 'i').exec(body); if (x && unxml(x[1])) e[t] = unxml(x[1]); }
    if (!e.path) continue;
    const file = real(e.path, dir); if (!file) continue;
    const pic = (...ks) => { for (const k of ks) if (e[k]) { const f = real(e[k], dir); if (f && exists(f)) return f; } return null; };
    games.set(file.toLowerCase(), { name: e.name || '', front: pic('thumbnail', 'boxart') || pic('image'), back: pic('boxback'), disc: pic('cartridge'),
      hero: pic('fanart', 'image'), manualPdf: /\.pdf$/i.test(e.manual || '') ? pic('manual') : null, video: pic('video'),
      desc: e.desc || '', developer: e.developer || '', publisher: e.publisher || '', genre: e.genre || '', released: (e.releasedate || '').slice(0, 8) });
  }
  return games;
}
// (the scan that mustn't hold the main process up: every folder's gamelist.xml read ahead with fs.promises, then looked up in
// memory only; a folder not read ahead counts as having none)
async function preload(files, romDirs) {
  const dirs = new Set(), roots = (romDirs || []).map(d => path.resolve(d).toLowerCase());
  for (const f of files || []) { let d = path.dirname(path.resolve(String(f))); for (let i = 0; i < 4; i++) { dirs.add(d); if (roots.includes(d.toLowerCase())) break; const up = path.dirname(d); if (up === d) break; d = up; } }
  const ready = new Set();
  await Promise.all([...dirs].map(async dir => { const f = path.join(dir, 'gamelist.xml');
    const st = await fs.promises.stat(f).catch(() => null); ready.add(dir.toLowerCase());
    if (!st) { cache.delete(dir.toLowerCase()); return; }
    const key = st.mtimeMs + ':' + st.size, c = cache.get(dir.toLowerCase()); if (c && c.key === key) return;
    let games = new Map(); try { games = await parseAsync(await fs.promises.readFile(f, 'utf8'), dir); } catch {}
    cache.set(dir.toLowerCase(), { key, games }); }));
  return ready;
}
// (the same as parse, with the pictures' checks done by fs.promises)
async function parseAsync(xml, dir) {
  const names = new Set();
  for (const m of String(xml).matchAll(/<(thumbnail|boxart|image|boxback|cartridge|fanart|manual|video)>([\s\S]*?)<\/\1>/gi)) names.add(real(m[2], dir));
  const there = new Set(); await Promise.all([...names].filter(Boolean).map(f => fs.promises.stat(f).then(s => { if (s.isFile()) there.add(f); }, () => {})));
  return parse(xml, dir, f => there.has(f));
}
// the games of the gamelist.xml in this folder (an empty map when there's none)
function forDir(dir) {
  const f = path.join(dir, 'gamelist.xml'); let st; try { st = fs.statSync(f); } catch { cache.delete(dir.toLowerCase()); return null; }
  const key = st.mtimeMs + ':' + st.size, c = cache.get(dir.toLowerCase()); if (c && c.key === key) return c.games;
  let games = new Map(); try { games = parse(fs.readFileSync(f, 'utf8'), dir); } catch {}
  cache.set(dir.toLowerCase(), { key, games }); return games;
}
// a game file's entry: from the gamelist.xml in its folder, or in a folder above it up to the games folder (a game kept in
// a sub-folder of the system folder is listed in the system folder's gamelist)
function lookup(file, romDirs, ready) { // ready: the folders read ahead (preload); then nothing is read here
  const roots = (romDirs || []).map(d => path.resolve(d).toLowerCase()), key = path.resolve(file).toLowerCase();
  let dir = path.dirname(path.resolve(file));
  for (let i = 0; i < 4; i++) {
    const g = ready ? (ready.has(dir.toLowerCase()) ? (cache.get(dir.toLowerCase()) || {}).games : null) : forDir(dir); const hit = g && g.get(key); if (hit) return hit;
    if (roots.includes(dir.toLowerCase())) break;
    const up = path.dirname(dir); if (up === dir) break; dir = up;
  }
  return null;
}
const clear = () => cache.clear();

module.exports = { lookup, forDir, parse, preload, clear };
