// (T)rustyShelf discussion 31: a games folder that can't be reached (a network drive gone for a moment) keeps its games on the
// shelf. On the real app on a virtual screen (xvfb-run), in a made-up home folder. Run: node linux/ci/netdrop-test.js <app>
// A pretend MAME and two Game.com games in a folder of their own. Checks: the first scan finds both; with the folder gone,
// a rescan still lists both (from the last library) and the log says so; back again, the next scan reads it as usual.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { spawn } = require('child_process');
const img = path.resolve(process.argv[2] || '');
const OUT = path.resolve('linux-test-out'); fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 400))); if (!ok) fails++; };
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'tsnetdrop-'));
const mk = (p, body, exec) => { const f = path.join(HOME, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body || ''); if (exec) fs.chmodSync(f, 0o755); return f; };
const argsFile = path.join(HOME, 'mame-args.txt');
const mame = mk('.local/bin/mame', `#!/bin/sh\n{ echo "PWD=$PWD"; for a in "$@"; do echo "$a"; done; } > "${argsFile}"\nsleep 4\nexit 0\n`, true);
const rom = mk('NAS/gamecom/Lights Out (USA).tgc', 'x'.repeat(4096)); mk('NAS/gamecom/Sonic Jam (USA).tgc', 'x'.repeat(4096));
const dir = path.dirname(rom), away = dir + '-away';
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
  const app = spawn(img, ['--no-sandbox', '--remote-debugging-port=9361'], { env: { ...process.env, HOME, APPIMAGE_EXTRACT_AND_RUN: '1' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let appOut = ''; app.stdout.on('data', d => appOut += d); app.stderr.on('data', d => appOut += d);
  let p;
  try {
    p = await cdp(await pageTarget(9361)); await p.send('Runtime.enable'); await p.send('Page.enable');
    for (let i = 0; i < 90; i++) { if (await p.ev('!!(window.Shelf && window.trustyshelf)').catch(() => false)) break; await sleep(500); }
    await sleep(1500);
    await p.ev(`(async () => { const c = (await trustyshelf.getConfig()).config; c.systems.gamecom = { ...(c.systems.gamecom || {}), enabled: true, emulator: ${JSON.stringify(mame)}, romDirs: [${JSON.stringify(dir)}] }; await trustyshelf.saveConfig(c); return true; })()`);
    const titles = lib => ((lib || []).find(s => s.id === 'gamecom') || { games: [] }).games.map(g => g.title).sort().join(' | ');
    const t1 = titles(await p.ev('window.trustyshelf.scan()'));
    check('the first scan finds both games', /Lights Out/.test(t1) && /Sonic Jam/.test(t1), t1);
    fs.renameSync(dir, away); // (the network drive gone)
    const t2 = titles(await p.ev('window.trustyshelf.scan()'));
    check('the folder unreachable: a rescan keeps both games on the shelf', t2 === t1, JSON.stringify({ before: t1, after: t2 }));
    await sleep(500); let logTxt = ''; try { logTxt = fs.readFileSync(path.join(HOME, 'TrustyShelf', 'data', 'trustyshelf.log'), 'utf8'); } catch {}
    check('the log says the folder wasn\'t reachable and the games were kept', /games folder not reachable, 2 games kept from the last scan/.test(logTxt), logTxt.split('\n').filter(l => /reachable/.test(l)).join(' / '));
    fs.renameSync(away, dir); fs.writeFileSync(path.join(dir, 'Tiger Hunt (USA).tgc'), 'x'.repeat(4096));
    const t3 = titles(await p.ev('window.trustyshelf.scan()'));
    check('back again, the folder is read as usual (a game added meanwhile shows)', /Tiger Hunt/.test(t3) && /Lights Out/.test(t3), t3);
    const errs = p.events.filter(e => e.method === 'Runtime.exceptionThrown').map(e => (e.params.exceptionDetails.exception || {}).description || e.params.exceptionDetails.text);
    check('no script errors', !errs.length, errs.slice(0, 3).join(' | '));
  } catch (e) { check('the test ran to the end', false, e && e.stack || e); }
  finally {
    try { if (fs.existsSync(away)) fs.renameSync(away, dir); } catch {}
    try { fs.copyFileSync(path.join(HOME, 'TrustyShelf', 'data', 'trustyshelf.log'), path.join(OUT, 'trustyshelf-netdrop.log')); } catch {}
    fs.writeFileSync(path.join(OUT, 'app-output-netdrop.txt'), appOut);
    try { if (p) p.close(); } catch {} try { process.kill(app.pid, 'SIGTERM'); } catch {} await sleep(1500); try { process.kill(-app.pid, 'SIGKILL'); } catch {}
  }
  console.log(fails ? `${fails} failed` : 'all passed'); process.exit(fails ? 1 : 0);
})();
