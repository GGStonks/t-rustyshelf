// Based on Boxshelf by sassiestrhihno (https://github.com/sassiestrhihno/boxshelf-source, GPL-3.0): this file is the same as Boxshelf's
// main/lbindex.js apart from the app's name ((T)rustyShelf) and native Rust indexer acceleration.
// LaunchBox index builder: reading the 500 MB XML in JavaScript holds a lot of memory and causes OOM crashes.
// The native Rust binary 'trustyshelf-imgtools lbindex' parses the XML with streaming low memory and writes
// the index and shards in seconds. Worker threads and pure JS are kept as fallback.
const fs = require('fs');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');
const { spawn } = require('child_process');

let binPath = null;
let binChecked = false;

function findBinary() {
  if (binChecked) return binPath;
  binChecked = true;

  const ext = process.platform === 'win32' ? '.exe' : '';
  const binName = `trustyshelf-imgtools${ext}`;

  // 1. Unpacked asar path (packaged app)
  const unpacked = path.join(__dirname, 'bin', binName).replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
  if (fs.existsSync(unpacked)) { binPath = unpacked; return binPath; }

  // 2. Local main/bin path
  const local = path.join(__dirname, 'bin', binName);
  if (fs.existsSync(local)) { binPath = local; return binPath; }

  // 3. Cargo target/release build path
  const cargo = path.join(__dirname, '..', 'target', 'release', binName);
  if (fs.existsSync(cargo)) { binPath = cargo; return binPath; }

  binPath = null;
  return null;
}

const ROMAN = { ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15, xvi: 16, xvii: 17, xviii: 18, xix: 19, xx: 20 };
const ROMAN_RE = new RegExp('\\b(' + Object.keys(ROMAN).sort((a, b) => b.length - a.length).join('|') + ')\\b', 'g');
function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') // é -> e
    .replace(/&/g, ' and ').replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(ROMAN_RE, r => ROMAN[r]) /* "Black Ops III" == "Black Ops 3"; lone i / x left alone (Mega Man X) */
    .replace(/\s+/g, ' ').trim();
}
const TAG_RE = {};
const tag = (block, name) => {
  const re = TAG_RE[name] || (TAG_RE[name] = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  const m = block.match(re);
  return m ? m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim() : '';
};

// A string cut out of a 4 MB chunk is a V8 "sliced string" that keeps the whole chunk alive: stored values get their own
// copy, or the index would hold on to most of the XML. (A JSON round trip always makes a fresh, flat string.)
const own = s => s ? JSON.parse(JSON.stringify(s)) : s;

// Stream the big XML (500+ MB) and keep only the platforms we use.
function buildLaunchboxIndex(xmlFile, onPct, platformList, version) {
  return new Promise((resolve, reject) => {
    const platforms = new Set(platformList);
    const games = {}; const ids = new Set(); const images = {};
    for (const p of platforms) games[p] = []; // (every platform asked for is listed, even one with no games yet: a missing one means "rebuild")
    let total = 0; try { total = fs.statSync(xmlFile).size; } catch {}
    let buf = '', read = 0, lastPct = -1;
    const stream = fs.createReadStream(xmlFile, { encoding: 'utf8', highWaterMark: 4 << 20 });
    stream.on('data', chunk => {
      read += Buffer.byteLength(chunk);
      buf += chunk;
      let pos = 0;
      for (;;) {
        const i = buf.indexOf('<Game', pos);
        if (i < 0) { pos = Math.max(pos, buf.length - 16); break; }
        let close;
        if (buf.length - i < 11) { pos = i; break; } // tag split across chunks: wait for more
        if (buf.startsWith('<Game>', i)) close = '</Game>';
        else if (buf.startsWith('<GameImage>', i)) close = '</GameImage>';
        else { pos = i + 5; continue; }
        const end = buf.indexOf(close, i);
        if (end < 0) { pos = i; break; }
        const block = buf.slice(i, end);
        pos = end + close.length;
        if (close === '</Game>') {
          const plat = tag(block, 'Platform');
          if (!platforms.has(plat)) continue;
          const id = own(tag(block, 'DatabaseID')), name = own(tag(block, 'Name'));
          if (!id || !name) continue;
          ids.add(id);
          const g = { id, name, n: norm(name) };
          const ov = tag(block, 'Overview'); if (ov) g.overview = own(ov.replace(/\s+/g, ' ').slice(0, 2500));
          for (const [k, t] of [['release', 'ReleaseDate'], ['year', 'ReleaseYear'], ['dev', 'Developer'], ['pub', 'Publisher'], ['genres', 'Genres'], ['esrb', 'ESRB'], ['players', 'MaxPlayers'], ['coop', 'Cooperative'], ['rating', 'CommunityRating'], ['wiki', 'WikipediaURL'], ['video', 'VideoURL']]) { const v = tag(block, t); if (v) g[k] = own(v); }
          (games[plat] = games[plat] || []).push(g);
        } else {
          const id = tag(block, 'DatabaseID');
          if (!ids.has(id)) continue;
          const type = tag(block, 'Type');
          // (the "- Reconstructed" clean rebuilds are Art Studio choices; an index from before has none until its next
          // natural rebuild: the format version isn't bumped for them, so nobody re-downloads 110 MB just for this)
          if (!/^(Box - (Front|Back)( - Reconstructed)?|Box - (Spine|Full)|Disc|Cart - Front|Fanart - (Box - (Front|Back)|Cart - Front|Disc|Background)|Steam Poster|Screenshot - (Gameplay|Game Title|Game Select)|Clear Logo)$/.test(type)) continue;
          const list = images[id] || (images[own(id)] = []);
          // screenshots and backgrounds are for the Details panel, the clear logo for a made spine: keep a handful per game so
          // the index stays small (an index from before has no logos until its next natural rebuild, as above)
          if (/^(Screenshot|Fanart - Background|Clear Logo)/.test(type) && list.filter(x => x.type === type).length >= (type === 'Fanart - Background' ? 2 : type === 'Clear Logo' ? 1 : 6)) continue;
          list.push({ type: own(type), region: own(tag(block, 'Region')), file: own(tag(block, 'FileName')) });
        }
      }
      buf = buf.slice(pos);
      const pct = total ? Math.floor(read / total * 100) : 0;
      if (onPct && pct !== lastPct) { lastPct = pct; onPct(pct); }
    });
    stream.on('close', () => resolve( /* 'close', not 'end': the file is released by then, so it can be deleted on Windows */{ v: version, at: Date.now(), games, images }));
    stream.on('error', reject);
  });
}

const LOAD_ERRORS = new Set(['ERR_WORKER_PATH', 'ERR_WORKER_INIT_FAILED', 'ERR_WORKER_UNSUPPORTED_OPERATION', 'MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND']);
const WORKER_FILE = __filename.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');

function buildInWorkerThread(xmlFile, idxFile, platformList, version, onPct, signal) {
  return new Promise((resolve, reject) => {
    let w, heard = false, settled = false;
    const done = (fn, v) => { if (!settled) { settled = true; fn(v); } };
    if (signal && signal.aborted) return reject(Object.assign(new Error('Refresh cancelled'), { code: 'cancelled' }));
    try { w = new Worker(WORKER_FILE, { workerData: { xmlFile, idxFile, platformList, version }, resourceLimits: { maxOldGenerationSizeMb: 4096 } }); }
    catch (e) { e.workerUnavailable = true; return reject(e); }
    if (signal) signal.addEventListener('abort', () => { done(reject, Object.assign(new Error('Refresh cancelled'), { code: 'cancelled' })); w.terminate().catch(() => {}); setTimeout(() => { try { fs.unlinkSync(idxFile + '.tmp'); } catch {} }, 500); }, { once: true });
    w.on('message', m => { heard = true; if (m && m.pct != null && onPct) onPct(m.pct); else if (m && m.error) done(reject, new Error('LaunchBox index: ' + m.error)); else if (m && m.done) done(resolve, m.counts); });
    w.on('error', e => { if (!heard && e && LOAD_ERRORS.has(e.code)) e.workerUnavailable = true; done(reject, e); });
    w.on('exit', code => done(reject, new Error(code ? 'index worker stopped (' + code + ')' : 'index worker ended without an index')));
  });
}

// Build the index: prefers the high-speed Rust native binary which streams the 500 MB XML with low memory.
function buildInWorker(xmlFile, idxFile, platformList, version, onPct, signal) {
  const bin = findBinary();
  if (!bin) {
    return buildInWorkerThread(xmlFile, idxFile, platformList, version, onPct, signal);
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn, v) => { if (!settled) { settled = true; fn(v); } };
    if (signal && signal.aborted) return reject(Object.assign(new Error('Refresh cancelled'), { code: 'cancelled' }));

    const args = [
      'lbindex',
      '--xml', xmlFile,
      '--out', idxFile,
      '--platforms', JSON.stringify(platformList),
      '--version', String(version),
      '--shards', path.dirname(idxFile)
    ];

    let child;
    try {
      child = spawn(bin, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch {
      return buildInWorkerThread(xmlFile, idxFile, platformList, version, onPct, signal).then(resolve, reject);
    }

    if (signal) {
      signal.addEventListener('abort', () => {
        done(reject, Object.assign(new Error('Refresh cancelled'), { code: 'cancelled' }));
        try { child.kill('SIGTERM'); } catch {}
        setTimeout(() => { try { fs.unlinkSync(idxFile + '.tmp'); } catch {} }, 500);
      }, { once: true });
    }

    let stdoutBuf = '', counts = null;
    child.stdout.on('data', chunk => {
      stdoutBuf += chunk.toString('utf8');
      let nl;
      while ((nl = stdoutBuf.indexOf('\n')) >= 0) {
        const line = stdoutBuf.slice(0, nl).trim();
        stdoutBuf = stdoutBuf.slice(nl + 1);
        if (!line) continue;
        try {
          const m = JSON.parse(line);
          if (m.pct != null && onPct) onPct(m.pct);
          if (m.counts != null) counts = m.counts;
          if (m.error) done(reject, new Error('LaunchBox index: ' + m.error));
        } catch {}
      }
    });

    let stderrBuf = '';
    child.stderr.on('data', chunk => { stderrBuf += chunk.toString('utf8'); });

    child.on('error', () => {
      // Fallback to worker thread if native binary fails to start
      buildInWorkerThread(xmlFile, idxFile, platformList, version, onPct, signal).then(resolve, reject);
    });

    child.on('close', code => {
      if (code === 0 && counts != null) {
        done(resolve, counts);
      } else if (!settled) {
        if (stderrBuf.trim()) {
          done(reject, new Error('LaunchBox index failed: ' + stderrBuf.trim()));
        } else {
          done(reject, new Error('LaunchBox index exited with code ' + code));
        }
      }
    });
  });
}

// The index split by console (launchbox-<platform>.json + launchbox-shards.json), so lookups read a few MB instead of
// the whole file. Written next to the index; the stamp ties the split to the index file it came from.
const shardName = (dir, plat) => path.join(dir, `launchbox-${String(plat).replace(/[^a-z0-9]+/gi, '_')}.json`);
function writeShards(idx, dir, stamp) {
  for (const plat of Object.keys(idx.games || {})) {
    const list = idx.games[plat] || [], images = {};
    if (idx.images) for (const g of list) if (idx.images[g.id]) images[g.id] = idx.images[g.id];
    const f = shardName(dir, plat);
    fs.writeFileSync(f + '.tmp', JSON.stringify({ v: idx.v, plat, games: list, images }));
    fs.renameSync(f + '.tmp', f);
  }
  fs.writeFileSync(path.join(dir, 'launchbox-shards.json'), JSON.stringify({ v: idx.v, at: idx.at, plats: Object.keys(idx.games || {}), stamp }));
}

function splitInWorkerThread(idxFile, dir) {
  return new Promise((resolve, reject) => {
    let w, settled = false; const done = (fn, v) => { if (!settled) { settled = true; fn(v); } };
    try { w = new Worker(WORKER_FILE, { workerData: { split: idxFile, dir }, resourceLimits: { maxOldGenerationSizeMb: 2048 } }); }
    catch (e) { e.workerUnavailable = true; return reject(e); }
    w.on('message', m => { if (m && m.error) done(reject, new Error(m.error)); else if (m && m.split) done(resolve, true); });
    w.on('error', e => { if (e && LOAD_ERRORS.has(e.code)) e.workerUnavailable = true; done(reject, e); });
    w.on('exit', code => done(reject, new Error('split worker ended (' + code + ')')));
  });
}

// Split an existing index: prefers the native Rust binary
function splitInWorker(idxFile, dir) {
  const bin = findBinary();
  if (!bin) {
    return splitInWorkerThread(idxFile, dir);
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn, v) => { if (!settled) { settled = true; fn(v); } };

    const args = ['lbshards', '--index', idxFile, '--dir', dir];
    let child;
    try {
      child = spawn(bin, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch {
      return splitInWorkerThread(idxFile, dir).then(resolve, reject);
    }

    let stdoutBuf = '', ok = false;
    child.stdout.on('data', chunk => {
      stdoutBuf += chunk.toString('utf8');
      let nl;
      while ((nl = stdoutBuf.indexOf('\n')) >= 0) {
        const line = stdoutBuf.slice(0, nl).trim();
        stdoutBuf = stdoutBuf.slice(nl + 1);
        if (!line) continue;
        try {
          const m = JSON.parse(line);
          if (m.split) ok = true;
          if (m.error) done(reject, new Error(m.error));
        } catch {}
      }
    });

    let stderrBuf = '';
    child.stderr.on('data', chunk => { stderrBuf += chunk.toString('utf8'); });

    child.on('error', () => {
      splitInWorkerThread(idxFile, dir).then(resolve, reject);
    });

    child.on('close', code => {
      if (code === 0 || ok) {
        done(resolve, true);
      } else if (!settled) {
        done(reject, new Error(stderrBuf.trim() || ('split failed with code ' + code)));
      }
    });
  });
}

if (!isMainThread && workerData && workerData.split) {
  try {
    const idx = JSON.parse(fs.readFileSync(workerData.split, 'utf8'));
    writeShards(idx, workerData.dir, Math.floor(fs.statSync(workerData.split).mtimeMs));
    parentPort.postMessage({ split: true });
  } catch (e) {
    parentPort.postMessage({ error: (e && e.message) || String(e) });
  }
}
if (!isMainThread && workerData && workerData.xmlFile) {
  buildLaunchboxIndex(workerData.xmlFile, pct => parentPort.postMessage({ pct }), workerData.platformList, workerData.version).then(idx => {
    fs.writeFileSync(workerData.idxFile + '.tmp', JSON.stringify(idx));
    fs.renameSync(workerData.idxFile + '.tmp', workerData.idxFile);
    parentPort.postMessage({ done: true, counts: Object.entries(idx.games).map(([k, v]) => `${k}=${v.length}`).join(', ') });
  }).catch(e => {
    try { fs.unlinkSync(workerData.idxFile + '.tmp'); } catch {}
    parentPort.postMessage({ error: (e && e.message) || String(e) });
  });
}

module.exports = { norm, tag, buildLaunchboxIndex, buildInWorker, splitInWorker, writeShards, shardName };
