// (T)rustyShelf's PS Vita shelf (asked for in the (T)rustyShelf discussions, #21), on the real app on a virtual screen (xvfb-run), in
// a made-up home folder. Run: node linux/ci/vita-test.js <TrustyShelf-…-linux.AppImage or the unpacked app>
// A pretend Vita3K (~/.local/bin/Vita3K: writes down the options it got, runs 4 s, closes), a game Vita3K has installed
// (~/.local/share/Vita3K/Vita3K/ux0/app/PCSE00120 with eboot.bin and a real param.sfo) and a .vpk in ~/Emulation/roms/psvita.
// Checks: detection finds Vita3K, its ux0/app folder and the roms folder; the PS Vita shelf names the installed game from its
// param.sfo; Play starts Vita3K fullscreen on the installed game's title id (-F -r PCSE00120), and hands a .vpk over as it is
// (-F <file>: Vita3K installs and runs it); no script errors.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { spawn } = require('child_process');
const img = path.resolve(process.argv[2] || '');
const OUT = path.resolve('linux-test-out'); fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 400))); if (!ok) fails++; };
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'bxvita-'));
const mk = (p, body, exec) => { const f = path.join(HOME, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body || ''); if (exec) fs.chmodSync(f, 0o755); return f; };
// a param.sfo as the PlayStation writes it: "\0PSF", version, key table, data table, then one 16-byte entry per key (utf8 strings)
function sfo(o) {
  const keys = Object.keys(o), kt = Buffer.concat(keys.map(k => Buffer.from(k + '\0'))), datas = keys.map(k => { const b = Buffer.alloc(Math.ceil((Buffer.byteLength(o[k]) + 1) / 4) * 4); b.write(o[k]); return b; });
  const head = Buffer.alloc(20), idx = Buffer.alloc(16 * keys.length), keyTab = 20 + idx.length, ktPad = Buffer.alloc((4 - (kt.length % 4)) % 4), dataTab = keyTab + kt.length + ktPad.length;
  head.writeUInt32LE(0x46535000, 0); head.writeUInt32LE(0x101, 4); head.writeUInt32LE(keyTab, 8); head.writeUInt32LE(dataTab, 12); head.writeUInt32LE(keys.length, 16);
  let ko = 0, dof = 0; keys.forEach((k, i) => { const e = i * 16; idx.writeUInt16LE(ko, e); idx.writeUInt16LE(0x0204, e + 2); idx.writeUInt32LE(Buffer.byteLength(o[k]) + 1, e + 4); idx.writeUInt32LE(datas[i].length, e + 8); idx.writeUInt32LE(dof, e + 12); ko += Buffer.byteLength(k) + 1; dof += datas[i].length; });
  return Buffer.concat([head, idx, kt, ktPad, ...datas]);
}
const argsFile = path.join(HOME, 'vita3k-args.txt');
const vita = mk('.local/bin/Vita3K', `#!/bin/sh\n{ for a in "$@"; do echo "$a"; done; } > "${argsFile}"\nsleep 4\nexit 0\n`, true);
const ux0 = path.join(HOME, '.local/share/Vita3K/Vita3K/ux0/app');
const eboot = mk('.local/share/Vita3K/Vita3K/ux0/app/PCSE00120/eboot.bin', 'x'.repeat(2048));
mk('.local/share/Vita3K/Vita3K/ux0/app/PCSE00120/sce_sys/param.sfo', sfo({ TITLE: 'Gravity Drift', TITLE_ID: 'PCSE00120', CATEGORY: 'gd' }));
const vpk = mk('Emulation/roms/psvita/Moon Garden (Homebrew).vpk', 'PK'.repeat(1024));
mk('TrustyShelf/data/config.json', JSON.stringify({ setupDone: true,
  ui: { bootIntro: 'off', sound: false, music: 'off', startFullscreen: true, openInto: 'last', autoCovers: false, lastSeenVersion: require('../../package.json').version.replace('+', '.') },
  steam: { enabled: false }, pc: { epic: false, quiver: false, custom: [] }, systems: {} }, null, 2));
async function cdp(url) {
  const ws = new WebSocket(url); let id = 0; const wait = new Map(), events = [];
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); } else if (d.method) events.push(d); };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300)); return r.result && r.result.result ? r.result.result.value : undefined; };
  return { send, ev, events, close: () => ws.close() };
}
async function pageTarget(port) {
  for (let i = 0; i < 120; i++) { try { const l = await (await fetch('http://127.0.0.1:' + port + '/json')).json(); const t = l.find(x => x.type === 'page' && /index\.html/.test(x.url)); if (t) return t.webSocketDebuggerUrl; } catch {} await sleep(500); }
  throw new Error('the (T)rustyShelf page never came up');
}
const shot = async (p, name) => { try { const r = await p.send('Page.captureScreenshot', { format: 'png' }); if (r.result && r.result.data) fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64')); } catch {} };



(async () => {
  check('the app exists', fs.existsSync(img), img);
  const app = spawn(img, ['--no-sandbox', '--remote-debugging-port=9347'], { env: { ...process.env, HOME, XDG_DATA_HOME: '', APPIMAGE_EXTRACT_AND_RUN: '1' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let appOut = ''; app.stdout.on('data', d => appOut += d); app.stderr.on('data', d => appOut += d);
  let p;
  try {
    p = await cdp(await pageTarget(9347)); await p.send('Runtime.enable'); await p.send('Page.enable');
    for (let i = 0; i < 90; i++) { if (await p.ev('!!(window.Shelf && window.trustyshelf)').catch(() => false)) break; await sleep(500); }
    await sleep(1500);
    const det = await p.ev('window.trustyshelf.detect()').catch(e => ({ error: e.message })), d = (det.systems || {}).psvita || {};
    check('detection finds Vita3K, its installed games (ux0/app) and the psvita folder', d.emulator === vita && (d.romDirs || []).includes(ux0) && (d.romDirs || []).includes(path.dirname(vpk)), JSON.stringify(d));
    await p.ev(`(async () => { const c = (await trustyshelf.getConfig()).config; c.systems.psvita = { ...(c.systems.psvita || {}), enabled: true, emulator: ${JSON.stringify(vita)}, romDirs: ${JSON.stringify([ux0, path.dirname(vpk)])} }; await trustyshelf.saveConfig(c); })()`);
    const lib = await p.ev('window.trustyshelf.scan()'), sh = lib.find(s => s.id === 'psvita'), titles = sh ? sh.games.map(g => g.title) : [];
    check('a PS Vita shelf, Vita3K as its emulator, the installed game named from its param.sfo and the .vpk', !!sh && sh.name === 'PS Vita' && /Vita3K/.test(sh.emulatorName || '') && titles.includes('Gravity Drift') && titles.some(t => /Moon Garden/.test(t)) && titles.length === 2, JSON.stringify(sh && { name: sh.name, emu: sh.emulatorName, titles }));
    await p.ev('window.Shelf && Shelf.refresh && Shelf.refresh(true)').catch(() => {}); await sleep(2500); await shot(p, 'vita-1-shelf');
    const run = async file => { try { fs.rmSync(argsFile, { force: true }); } catch {} const r = await p.ev(`window.trustyshelf.launchGame('psvita', ${JSON.stringify(file)}).then(() => 'ok', e => e.message)`).catch(e => e.message);
      let a = null; for (let i = 0; i < 40 && !a; i++) { await sleep(500); try { a = fs.readFileSync(argsFile, 'utf8').split('\n').filter(Boolean); } catch {} } return { r, a }; };
    const one = await run(eboot);
    check('Play starts an installed game in Vita3K by its title id, fullscreen (-F -r PCSE00120)', !!one.a && one.a.join(' ') === '-F -r PCSE00120', JSON.stringify(one));
    await sleep(5500);
    const two = await run(vpk);
    check('a .vpk is handed to Vita3K as it is, fullscreen (it installs and runs it)', !!two.a && two.a.join(' ') === '-F ' + vpk, JSON.stringify(two));
    await sleep(5000);
    const errs = p.events.filter(e => e.method === 'Runtime.exceptionThrown').map(e => (e.params.exceptionDetails.exception || {}).description || e.params.exceptionDetails.text);
    check('no script errors', !errs.length, errs.slice(0, 3).join(' | '));
  } catch (e) { check('the test ran to the end', false, e && e.stack || e); }
  finally {
    try { fs.copyFileSync(path.join(HOME, 'TrustyShelf', 'data', 'trustyshelf.log'), path.join(OUT, 'trustyshelf-vita.log')); } catch {}
    fs.writeFileSync(path.join(OUT, 'app-output-vita.txt'), appOut);
    try { if (p) p.close(); } catch {} try { process.kill(-app.pid, 'SIGTERM'); } catch {} await sleep(1500); try { process.kill(-app.pid, 'SIGKILL'); } catch {}
  }
  console.log(fails ? `${fails} failed` : 'all passed'); process.exit(fails ? 1 : 0);
})();
