// (T)rustyShelf issue 6: Export everything's size up front, its progress, Pause / Resume / Cancel, and exporting again into the same
// folder copying only what changed, on the real app on a virtual screen (xvfb-run), in a made-up home folder.
// Run: node linux/ci/export-app-test.js <the AppImage or the unpacked app>
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { spawn } = require('child_process');
const img = path.resolve(process.argv[2] || '');
const OUT = path.resolve('linux-test-out'); fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 400))); if (!ok) fails++; };
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'bxexport-'));
const mk = (p, body) => { const f = path.join(HOME, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body || ''); return f; };
for (let i = 0; i < 400; i++) mk(`TrustyShelf/Library/gc/Game ${i}/front.png`, Buffer.alloc(32768, i));
const d1 = path.join(HOME, 'Backup'), d2 = path.join(HOME, 'Backup2'); fs.mkdirSync(d1); fs.mkdirSync(d2);
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
  const app = spawn(img, ['--no-sandbox', '--remote-debugging-port=9350'], { env: { ...process.env, HOME, APPIMAGE_EXTRACT_AND_RUN: '1' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let appOut = ''; app.stdout.on('data', d => appOut += d); app.stderr.on('data', d => appOut += d);
  let p;
  try {
    p = await cdp(await pageTarget(9350)); await p.send('Runtime.enable'); await p.send('Page.enable');
    for (let i = 0; i < 90; i++) { if (await p.ev('!!(window.Shelf && window.trustyshelf)').catch(() => false)) break; await sleep(500); }
    await sleep(1500);
    const sz = await p.ev('trustyshelf.dataSize()');
    check('the export\'s size is known before a folder is chosen (the 400 covers and the settings: over 12 MB)', sz && sz.files >= 401 && sz.bytes > 400 * 32768, JSON.stringify(sz));
    const row = await p.ev(`(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); Setup.open({ page: 'sys' }); for (let i = 0; i < 40; i++) { const r = [...document.querySelectorAll('#bss .bss-row')].find(r => /Export everything/.test(r.textContent) && /About/.test(r.textContent)); if (r) return r.textContent; await w(250); } return ([...document.querySelectorAll('#bss .bss-row')].find(r => /Export everything/.test(r.textContent)) || {}).textContent || ''; })()`).catch(e => 'error ' + e.message);
    check('Settings → System → Export everything says how big it is', /About \d+ MB · [\d,.]+ files/.test(row.replace(/\s+/g, ' ')), row);
    await p.ev('Settings.close()').catch(() => {}); await sleep(1500);
    // paused right away: nothing copied while paused, the progress says so; resumed, it finishes
    const run = await p.ev(`(async () => { const w = ms => new Promise(r => setTimeout(r, ms)), ev = []; trustyshelf.onDataProgress(s => ev.push(s));
      const job = trustyshelf.exportData(${JSON.stringify(d1)}); await trustyshelf.pauseData(true); await w(1500); const n0 = ev.length ? ev[ev.length - 1].files : 0, paused = ev.some(s => s.paused);
      await w(1000); const n1 = ev.length ? ev[ev.length - 1].files : 0; await trustyshelf.pauseData(false); const r = await job.then(x => x, e => ({ error: e.message }));
      const last = ev[ev.length - 1] || {}; return { n0, n1, paused, r: { files: r.files, updated: r.updated, copied: r.copied, error: r.error }, last: { bytes: last.bytes, of: last.of, files: last.files, ofFiles: last.ofFiles, eta: 'eta' in last } }; })()`);
    check('paused, it copies nothing and says paused; resumed, it finishes', run.paused && run.n0 === run.n1 && !run.r.error && run.r.copied >= 401, JSON.stringify(run));
    check('the progress counts bytes and files up to the total, with the time left', run.last.bytes === run.last.of && run.last.files === run.last.ofFiles && run.last.eta, JSON.stringify(run.last));
    fs.writeFileSync(path.join(HOME, 'TrustyShelf/Library/gc/Game 7/front.png'), 'changed');
    const again = await p.ev(`trustyshelf.exportData(${JSON.stringify(d1)}).then(r => ({ updated: r.updated, copied: r.copied, unchanged: r.unchanged, dir: r.dir }), e => ({ error: e.message }))`);
    check('exporting into the same folder again updates that export, copying only what changed', again.updated && again.copied >= 1 && again.copied <= 3 && again.unchanged >= 398 && fs.readdirSync(d1).length === 1, JSON.stringify(again));
    const cancel = await p.ev(`(async () => { const job = trustyshelf.exportData(${JSON.stringify(d2)}); await trustyshelf.cancelData(); return job.then(() => 'finished', e => e.message); })()`);
    check('Cancel stops it, with a message', /cancelled/.test(cancel), cancel);
    const log = fs.readFileSync(path.join(HOME, 'TrustyShelf', 'data', 'trustyshelf.log'), 'utf8');
    check('the log says paused, resumed, updated and cancelled', /paused/.test(log) && /resumed/.test(log) && /Export updated:/.test(log) && /cancelled/.test(log), log.split('\n').filter(l => /Export|import/i.test(l)).join(' | '));
    const errs = p.events.filter(e => e.method === 'Runtime.exceptionThrown').map(e => (e.params.exceptionDetails.exception || {}).description || e.params.exceptionDetails.text);
    check('no script errors', !errs.length, errs.slice(0, 3).join(' | '));
  } catch (e) { check('the test ran to the end', false, e && e.stack || e); }
  finally {
    try { fs.copyFileSync(path.join(HOME, 'TrustyShelf', 'data', 'trustyshelf.log'), path.join(OUT, 'trustyshelf-export.log')); } catch {}
    fs.writeFileSync(path.join(OUT, 'app-output-export.txt'), appOut);
    try { if (p) p.close(); } catch {} try { process.kill(app.pid, 'SIGTERM'); } catch {} await sleep(1500); try { process.kill(-app.pid, 'SIGKILL'); } catch {}
    fs.rmSync(HOME, { recursive: true, force: true });
  }
  console.log(fails ? `${fails} failed` : 'all passed'); process.exit(fails ? 1 : 0);
})();
