// Based on Boxshelf by sassiestrhihno (https://github.com/sassiestrhihno/boxshelf-source, GPL-3.0): this file is the same as Boxshelf's
// main/updates.js apart from the app's name ((T)rustyShelf).
// Beta update notice. Once per start (a little after the window is up), when Settings → About → "Check for new betas"
// is on, asks the public beta page's Releases which version is newest and tells the shelf when it's newer than this
// one. Nothing is downloaded or installed: the notice opens the download page. Offline, or with GitHub busy, it stays
// quiet and the next start tries again.
const fs = require('fs');
const path = require('path');
const https = require('https');

const REPO = 'GGStonks/t-rustyshelf'; // (this fork's own releases: the official Boxshelf's would offer to replace it)
const PAGE = `https://github.com/${REPO}`;
const LINKS = { page: PAGE, releases: `${PAGE}/releases`, issues: `${PAGE}/issues/new/choose` };

let log = () => {}, last = null, inflight = null;
function init(logger) { if (logger) log = logger; }

// "1.82.0-beta.1" → { nums: [1, 82, 0, 0], pre: ['beta', 1] }; a release without a pre part is newer than its betas.
// ((T)rustyShelf) a build number counts too: "2.12.4.284" (a release's tag) and "2.12.4+284" (the app's own version)
// → nums [2, 12, 4, 284]
function parse(v) {
  const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[.+](\d+))?(?:-([0-9A-Za-z.-]+))?/.exec(String(v || '').trim());
  if (!m) return null;
  return { nums: [+m[1], +(m[2] || 0), +(m[3] || 0), +(m[4] || 0)], pre: m[5] ? m[5].split('.').map(x => (/^\d+$/.test(x) ? +x : x)) : [] };
}
// < 0: a is older; 0: the same; > 0: a is newer
function compare(a, b) {
  const x = parse(a), y = parse(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 4; i++) if (x.nums[i] !== y.nums[i]) return x.nums[i] - y.nums[i];
  if (!x.pre.length || !y.pre.length) return (x.pre.length ? -1 : 0) + (y.pre.length ? 1 : 0);
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i], q = y.pre[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    if (p === q) continue;
    if (typeof p === 'number' && typeof q === 'number') return p - q;
    if (typeof p === 'number') return -1;
    if (typeof q === 'number') return 1;
    return p < q ? -1 : 1;
  }
  return 0;
}

function getJson(url, version) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': `TrustyShelf/${version}`, Accept: 'application/vnd.github+json' } }, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`GitHub answered ${res.statusCode}`)); }
      let b = ''; res.setEncoding('utf8');
      res.on('data', c => { b += c; if (b.length > 2e6) req.destroy(new Error('answer too big')); });
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch { reject(new Error('unreadable answer')); } });
      res.on('error', reject);
    });
    req.on('error', reject); req.setTimeout(15000, () => req.destroy(new Error('timed out')));
  });
}

// { current, latest, newer, url, notes, checkedAt } or { current, error }
async function check(current, force = false) {
  if (!force && last && Date.now() - last.checkedAt < 6 * 3600e3) return last;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      // the list, not /releases/latest: that one skips pre-releases, and every beta is one
      const list = await getJson(`https://api.github.com/repos/${REPO}/releases?per_page=10`, current);
      const best = (Array.isArray(list) ? list : []).filter(r => r && !r.draft && parse(r.tag_name))
        .sort((p, q) => compare(q.tag_name, p.tag_name))[0];
      const latest = best ? String(best.tag_name).replace(/^v/, '') : null;
      last = { current, latest, newer: !!latest && compare(latest, current) > 0, url: best ? best.html_url : LINKS.releases,
        notes: best && typeof best.body === 'string' ? best.body.slice(0, 2000) : '', checkedAt: Date.now(),
        assets: best && Array.isArray(best.assets) ? best.assets.map(a => ({ name: a.name, url: a.browser_download_url, size: a.size })) : [] };
      log('Update check:', latest ? `newest ${latest}${last.newer ? ' (newer)' : ''}` : 'no releases yet');
      return last;
    } catch (e) {
      log('Update check failed:', e.message);
      return { current, error: e.message, checkedAt: Date.now() };
    } finally { inflight = null; }
  })();
  return inflight;
}

function downloadFile(url, dest, onProgress, hops = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'TrustyShelf' } }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && hops < 5) {
        res.resume();
        return resolve(downloadFile(new URL(res.headers.location, url).toString(), dest, onProgress, hops + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error('the download server said ' + res.statusCode));
      }
      const total = +res.headers['content-length'] || 0;
      let got = 0, lastPct = -1;
      res.on('data', c => {
        got += c.length;
        if (total && onProgress) {
          const p = Math.floor(got / total * 100);
          if (p !== lastPct) { lastPct = p; onProgress(p); }
        }
      });
      const fileStream = fs.createWriteStream(dest);
      require('stream').pipeline(res, fileStream, err => {
        clearTimeout(cap);
        if (err) reject(err);
        else if (total && got < total) reject(new Error('the download was cut short'));
        else resolve();
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error('the download timed out')));
    const cap = setTimeout(() => req.destroy(new Error('the download took too long')), 15 * 60e3);
  });
}

async function applyUpdate(release, onProgress) {
  const isLinux = process.platform === 'linux';
  const isWin = process.platform === 'win32';
  const assets = release.assets || [];
  const asset = assets.find(a => isLinux ? /\.AppImage$/i.test(a.name) : isWin ? /\.exe$/i.test(a.name) : false);
  if (!asset || !asset.url) throw new Error('No matching download asset found for this platform.');

  let target = isLinux ? process.env.APPIMAGE : (process.env.PORTABLE_EXECUTABLE_FILE || process.execPath);
  if (!target && isLinux) target = process.execPath;
  if (!target || /node_modules|electron(?:\.exe)?$/i.test(target)) {
    throw new Error('Development environment detected; skipping executable replacement.');
  }

  const tmpFile = target + '.update.tmp';
  log('Auto-update: downloading', asset.name, 'to', tmpFile);
  await downloadFile(asset.url, tmpFile, onProgress);

  if (isLinux) {
    fs.chmodSync(tmpFile, 0o755);
  }

  if (isWin) {
    try { fs.renameSync(target, target + '.old'); } catch {}
  }
  fs.renameSync(tmpFile, target);
  try {
    const generic = path.join(path.dirname(target), '(T)rustyShelf.AppImage');
    if (generic !== target && fs.existsSync(generic)) {
      fs.copyFileSync(target, generic);
      fs.chmodSync(generic, 0o755);
    }
  } catch {}
  log('Auto-update: installed cleanly to', target);
  return { ok: true, target, version: release.latest };
}

function relaunchApp() {
  const { app } = require('electron');
  const target = process.env.APPIMAGE || (process.platform === 'linux' ? process.execPath : undefined);
  if (target) {
    app.relaunch({ execPath: target });
  } else {
    app.relaunch();
  }
  app.exit(0);
}

module.exports = { init, check, compare, applyUpdate, relaunchApp, LINKS };
