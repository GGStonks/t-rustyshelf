// (T)rustyShelf issue 7: the PC kept awake while a long job runs (main.js awake: Electron's powerSaveBlocker), on the real app on
// a virtual screen (xvfb-run), in a made-up home folder. Run: node linux/ci/keepawake-test.js <TrustyShelf-…-linux.AppImage or the unpacked app>
// Checks: nothing is held at rest; an Export everything holds it while it runs ('awake:state' says on, with the job's name) and
// lets go when it ends; with Settings → System → "Keep the PC awake during long jobs" off, the same export holds nothing; the log
// says when; Settings → System has the switch; no script errors.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { spawn } = require('child_process');
const img = path.resolve(process.argv[2] || '');
const OUT = path.resolve('linux-test-out'); fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 400))); if (!ok) fails++; };
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'bxawake-'));
const mk = (p, body) => { const f = path.join(HOME, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body || ''); return f; };
// some downloads to carry, so the export takes a moment
for (let i = 0; i < 300; i++) mk(`TrustyShelf/Library/gc/Game ${i}/front.png`, Buffer.alloc(16384, i));
const dest1 = path.join(HOME, 'Exports1'), dest2 = path.join(HOME, 'Exports2'); fs.mkdirSync(dest1); fs.mkdirSync(dest2);
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
  const app = spawn(img, ['--no-sandbox', '--remote-debugging-port=9348'], { env: { ...process.env, HOME, APPIMAGE_EXTRACT_AND_RUN: '1' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let appOut = ''; app.stdout.on('data', d => appOut += d); app.stderr.on('data', d => appOut += d);
  let p;
  try {
    p = await cdp(await pageTarget(9348)); await p.send('Runtime.enable'); await p.send('Page.enable');
    for (let i = 0; i < 90; i++) { if (await p.ev('!!(window.Shelf && window.trustyshelf)').catch(() => false)) break; await sleep(500); }
    await sleep(1500);
    const rest = await p.ev('window.trustyshelf.awakeState()');
    check('nothing keeps the PC awake at rest', rest && rest.on === false && !rest.jobs.length, JSON.stringify(rest));
    const exportOnce = dest => p.ev(`(async () => { const ev = []; window.__aw = ev; if (!window.__awHooked) { window.__awHooked = 1; trustyshelf.onAwake(s => (window.__aw || []).push(s)); }
      const r = await trustyshelf.exportData(${JSON.stringify(dest)}).then(x => ({ files: x.files }), e => ({ error: e.message })); await new Promise(r => setTimeout(r, 300));
      return { r, ev: window.__aw.slice(), after: await trustyshelf.awakeState() }; })()`);
    const one = await exportOnce(dest1);
    check('an export keeps the PC awake while it runs, by name', one.ev.some(s => s.on && s.jobs.includes('export')), JSON.stringify(one));
    check('…and lets go when it ends', one.after.on === false && one.ev.length && one.ev[one.ev.length - 1].on === false, JSON.stringify(one));
    await p.ev(`(async () => { const c = (await trustyshelf.getConfig()).config; c.ui.keepAwake = false; await trustyshelf.saveConfig(c); })()`);
    const two = await exportOnce(dest2);
    check('with the switch off, the same export holds nothing', !two.r.error && !two.ev.some(s => s.on), JSON.stringify(two));
    const log = fs.readFileSync(path.join(HOME, 'TrustyShelf', 'data', 'trustyshelf.log'), 'utf8');
    check('the log says when the PC is kept awake and let go', /Keeping the PC awake: export/.test(log) && /The PC may sleep again/.test(log), log.split('\n').filter(l => /awake|sleep/i.test(l)).join(' | '));
    const row = await p.ev(`(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); Setup.open({ page: 'sys' }); for (let i = 0; i < 40; i++) { const r = [...document.querySelectorAll('#bss .bss-row')].find(r => /Keep the PC awake during long jobs/.test(r.textContent)); if (r) return r.textContent; await w(150); } return ''; })()`).catch(e => 'error ' + e.message);
    check('Settings → System has the switch', /Keep the PC awake during long jobs/.test(row), row);
    const errs = p.events.filter(e => e.method === 'Runtime.exceptionThrown').map(e => (e.params.exceptionDetails.exception || {}).description || e.params.exceptionDetails.text);
    check('no script errors', !errs.length, errs.slice(0, 3).join(' | '));
  } catch (e) { check('the test ran to the end', false, e && e.stack || e); }
  finally {
    try { fs.copyFileSync(path.join(HOME, 'TrustyShelf', 'data', 'trustyshelf.log'), path.join(OUT, 'trustyshelf-keepawake.log')); } catch {}
    fs.writeFileSync(path.join(OUT, 'app-output-keepawake.txt'), appOut);
    try { if (p) p.close(); } catch {} try { process.kill(app.pid, 'SIGTERM'); } catch {} await sleep(1500); try { process.kill(-app.pid, 'SIGKILL'); } catch {}
    fs.rmSync(HOME, { recursive: true, force: true });
  }
  console.log(fails ? `${fails} failed` : 'all passed'); process.exit(fails ? 1 : 0);
})();
