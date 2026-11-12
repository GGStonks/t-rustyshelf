// (T)rustyShelf issue 24: Settings → Box art → Download missing art now sat on "Checking what you have…" for ages on a big
// library on a NAS (every games folder read again), with no sign of progress. The check now takes each console's games from
// the library as last found and says which console it's on. On the real app on a virtual screen, in a made-up home folder.
// Run: node linux/ci/artcheck-test.js <the AppImage or unpacked app>
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { spawn } = require('child_process');
const img = path.resolve(process.argv[2] || '');
const OUT = path.resolve('linux-test-out'); fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 400))); if (!ok) fails++; };
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'bxartchk-'));
const mk = (p, body, exec) => { const f = path.join(HOME, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body || ''); if (exec) fs.chmodSync(f, 0o755); return f; };
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
const romDir = path.join(HOME, 'Emulation/roms/snes');
for (let i = 1; i <= 30; i++) mk(`Emulation/roms/snes/Game ${String(i).padStart(2, '0')} (USA).sfc`, 'x'.repeat(1024));
mk('Emulation/roms/snes/Game 01 (USA).png', 'not really a png');
mk('TrustyShelf/data/config.json', JSON.stringify({ setupDone: true,
  ui: { bootIntro: 'off', sound: false, music: 'off', startFullscreen: true, openInto: 'last', autoCovers: false, lastSeenVersion: require('../../package.json').version.replace('+', '.') },
  steam: { enabled: false }, pc: { epic: false, quiver: false, custom: [] }, systems: { snes: { enabled: true, emulator: '', romDirs: [romDir] } } }, null, 2));
(async () => {
  check('the app exists', fs.existsSync(img), img);
  const app = spawn(img, ['--no-sandbox', '--remote-debugging-port=9351'], { env: { ...process.env, HOME, APPIMAGE_EXTRACT_AND_RUN: '1' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let appOut = ''; app.stdout.on('data', d => appOut += d); app.stderr.on('data', d => appOut += d);
  let p;
  try {
    p = await cdp(await pageTarget(9351)); await p.send('Runtime.enable'); await p.send('Page.enable');
    for (let i = 0; i < 90; i++) { if (await p.ev('!!(window.Shelf && window.trustyshelf)').catch(() => false)) break; await sleep(500); }
    const lib = await p.ev('trustyshelf.scan().then(l => (l.find(s => s.id === "snes") || {}).games.length)').catch(e => 'error ' + e.message);
    check('the library has the SNES games', lib === 30, lib);
    // the games folder gone (a NAS asleep): the check still knows the 30 games from the library, and says where it is
    fs.renameSync(romDir, romDir + '-away');
    const r = await p.ev(`(async () => { const ev = []; trustyshelf.onCoversChecking(x => ev.push(x)); const c = await trustyshelf.artCoverage(); await new Promise(r => setTimeout(r, 300)); return { snes: c.find(x => x.id === 'snes'), ev }; })()`);
    check('the check takes the games from the library, not the games folder again', r.snes && r.snes.total === 30 && r.snes.front === 0, JSON.stringify(r.snes));
    const named = r.ev.find(x => x && x.id === 'snes');
    check('it says which console it is on, and when it has finished', named && named.name === 'SNES' && named.console === 1 && named.consoles === 1 && named.total === 30 && r.ev.some(x => x && x.finished), JSON.stringify(r.ev.slice(0, 3).concat(r.ev.slice(-2))));
    fs.renameSync(romDir + '-away', romDir);
    // Settings → Download missing art now: while the check runs, its page says so; the list follows
    const page = await p.ev(`(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); const inf = await trustyshelf.getConfig(); Settings.show(inf, { page: 'art-get' }); let first = ''; for (let i = 0; i < 80; i++) { const t = document.body.innerText; if (!first && /Checking what you have/.test(t)) first = t; if (/SNES/.test(t) && /0 of 30 covers/.test(t)) return { t, first }; await w(250); } return { t: document.body.innerText, first }; })()`).catch(e => ({ t: 'error ' + e.message }));
    check('Settings: the download page lists the SNES with its 30 games once checked', /SNES/.test(page.t) && /0 of 30 covers/.test(page.t), String(page.t).replace(/\s+/g, ' ').slice(0, 300));
    const errs = p.events.filter(e => e.method === 'Runtime.exceptionThrown').map(e => (e.params.exceptionDetails.exception || {}).description || e.params.exceptionDetails.text);
    check('no script errors', !errs.length, errs.slice(0, 3).join(' | '));
  } catch (e) { check('the test ran to the end', false, e && e.stack || e); }
  finally {
    try { fs.copyFileSync(path.join(HOME, 'TrustyShelf', 'data', 'trustyshelf.log'), path.join(OUT, 'trustyshelf-artcheck.log')); } catch {}
    fs.writeFileSync(path.join(OUT, 'app-output-artcheck.txt'), appOut);
    try { if (p) p.close(); } catch {} try { process.kill(app.pid, 'SIGTERM'); } catch {} await sleep(1500); try { process.kill(-app.pid, 'SIGKILL'); } catch {}
    fs.rmSync(HOME, { recursive: true, force: true });
  }
  console.log(fails ? `${fails} failed` : 'all passed'); process.exit(fails ? 1 : 0);
})();
