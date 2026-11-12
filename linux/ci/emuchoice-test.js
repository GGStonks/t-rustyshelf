// (T)rustyShelf: the emulator and RetroArch core of your choice per console (asked for in the (T)rustyShelf discussions, #10), on
// the real app on a virtual screen (xvfb-run), in a made-up home folder. Run: node linux/ci/emuchoice-test.js <the AppImage or unpacked app>
// A pretend RetroArch and Flycast (~/.local/bin: each writes down the options it got, runs 3 s, closes), two cores (Mesen, FCEUmm).
// Checks: every emulator found for the Dreamcast is listed (RetroArch and Flycast), Settings → Dreamcast offers the other one and
// pressing it sets it; Settings → NES has the RetroArch core choice; Play starts the NES game in the core picked (FCEUmm), and in
// the usual one (Mesen) when none is; a core name that isn't one of the console's is ignored; no script errors.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { spawn } = require('child_process');
const img = path.resolve(process.argv[2] || '');
const OUT = path.resolve('linux-test-out'); fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 400))); if (!ok) fails++; };
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'bxemuch-'));
const mk = (p, body, exec) => { const f = path.join(HOME, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body || ''); if (exec) fs.chmodSync(f, 0o755); return f; };
const argsFile = path.join(HOME, 'emu-args.txt');
const fake = n => mk('.local/bin/' + n, `#!/bin/sh\n{ echo "${n}"; for a in "$@"; do echo "$a"; done; } > "${argsFile}"\nsleep 3\nexit 0\n`, true);
const ra = fake('retroarch'), fly = fake('flycast');
const mesen = mk('.config/retroarch/cores/mesen_libretro.so', 'x'), fceumm = mk('.config/retroarch/cores/fceumm_libretro.so', 'x');
const nesRom = mk('Emulation/roms/nes/Moon Hopper (USA).nes', 'x'.repeat(1024)); mk('Emulation/roms/dreamcast/Sky Racer (USA).cdi', 'x'.repeat(1024));
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
  const app = spawn(img, ['--no-sandbox', '--remote-debugging-port=9349'], { env: { ...process.env, HOME, APPIMAGE_EXTRACT_AND_RUN: '1' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let appOut = ''; app.stdout.on('data', d => appOut += d); app.stderr.on('data', d => appOut += d);
  let p;
  try {
    p = await cdp(await pageTarget(9349)); await p.send('Runtime.enable'); await p.send('Page.enable');
    for (let i = 0; i < 90; i++) { if (await p.ev('!!(window.Shelf && window.trustyshelf)').catch(() => false)) break; await sleep(500); }
    await sleep(1500);
    const found = await p.ev(`trustyshelf.emulatorsFound('dreamcast')`).catch(e => ({ error: e.message }));
    check('every emulator found for the Dreamcast is listed: RetroArch and Flycast', Array.isArray(found) && found.includes(ra) && found.includes(fly), JSON.stringify(found));
    const setSys = (id, o) => p.ev(`(async () => { const c = (await trustyshelf.getConfig()).config; c.systems.${id} = { ...(c.systems.${id} || {}), enabled: true, ...${JSON.stringify(o)} }; await trustyshelf.saveConfig(c); })()`);
    await setSys('dreamcast', { emulator: ra, romDirs: [path.join(HOME, 'Emulation/roms/dreamcast')] });
    await setSys('nes', { emulator: ra, romDirs: [path.dirname(nesRom)], raCore: 'fceumm' });
    await p.ev('window.Shelf && Shelf.refresh && Shelf.refresh(true)').catch(() => {}); await sleep(2000);
    const rows = id => p.ev(`(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); Setup.open({ page: '${id}' }); for (let i = 0; i < 40 && !document.querySelector('#bss .bss-row'); i++) await w(150); await w(2500);
      return [...document.querySelectorAll('#bss .bss-row')].map(r => r.textContent.replace(/\s+/g, ' ').trim()); })()`);
    const dc = await rows('dreamcast');
    check('Settings → Dreamcast offers the other emulator found (Use Flycast)', dc.some(t => /^U\W*s?\W*e Flyca/.test(t)) && !dc.some(t => /^U\W*s?\W*e RetroArch/.test(t)), JSON.stringify(dc.slice(0, 8)));
    const pressed = await p.ev(`(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); const r = [...document.querySelectorAll('#bss .bss-row')].find(r => /^U\W*s?\W*e Flyca/.test(r.textContent.trim())); if (!r) return 'no row'; r.dispatchEvent(new MouseEvent('mousemove', { bubbles: true })); await w(300); r.click(); await w(900); const now = (await trustyshelf.getConfig()).config.systems.dreamcast.emulator; if (!/flycast/.test(now)) { r.click(); await w(900); } const mid = (await trustyshelf.getConfig()).config.systems.dreamcast.emulator; Settings.close(); await w(2500); return (await trustyshelf.getConfig()).config.systems.dreamcast.emulator + ' (open: ' + now + ' / ' + mid + ')'; })()`);
    check('…and pressing it makes Flycast the Dreamcast\'s emulator', String(pressed).startsWith(fly + ' '), pressed);
    await p.ev(`Settings.close()`).catch(() => {});
    await sleep(1500);
    const nes = await rows('nes');
    check('Settings → NES has the RetroArch core choice, on FCEUmm', nes.some(t => /^RetroArch core/.test(t) && /FCEUmm/.test(t)), JSON.stringify(nes.slice(0, 10)));
    await p.ev(`Settings.close()`).catch(() => {});
    await sleep(2000);
    const run = async () => { try { fs.rmSync(argsFile, { force: true }); } catch {} const r = await p.ev(`trustyshelf.launchGame('nes', ${JSON.stringify(nesRom)}).then(() => 'ok', e => e.message)`).catch(e => e.message);
      let a = null; for (let i = 0; i < 30 && !a; i++) { await sleep(500); try { a = fs.readFileSync(argsFile, 'utf8').split('\n').filter(Boolean); } catch {} } await sleep(4000); return { r, a }; };
    const one = await run();
    check('Play starts the NES game in the core picked (FCEUmm)', !!one.a && one.a[0] === 'retroarch' && one.a.includes(fceumm), JSON.stringify(one));
    await setSys('nes', { raCore: 'not-a-core' });
    const two = await run();
    check('a core that isn\'t one of the NES\'s is ignored: the usual one (Mesen)', !!two.a && two.a.includes(mesen), JSON.stringify(two));
    const errs = p.events.filter(e => e.method === 'Runtime.exceptionThrown').map(e => (e.params.exceptionDetails.exception || {}).description || e.params.exceptionDetails.text);
    // (disc 10, again) the RetroArch set in Settings, kept outside every folder searched, is offered for the PlayStation too
    // (DuckStation is its first choice), and never for a console RetroArch doesn't run
    const oddRa = mk('Odd Place/RetroArch/retroarch', fs.readFileSync(ra, 'utf8'), true);
    await p.ev(`(async () => { const c = (await trustyshelf.getConfig()).config; c.retroarch = ${JSON.stringify(oddRa)}; await trustyshelf.saveConfig(c); })()`); await sleep(500);
    const psx = await p.ev(`trustyshelf.emulatorsFound('psx')`).catch(e => ({ error: e.message })), ps2 = await p.ev(`trustyshelf.emulatorsFound('ps2')`).catch(e => ({ error: e.message }));
    check('the RetroArch set in Settings is listed for the PlayStation, even outside the folders searched; not for the PS2', Array.isArray(psx) && psx.includes(oddRa) && Array.isArray(ps2) && !ps2.includes(oddRa), JSON.stringify([psx, ps2]));
    check('no script errors', !errs.length, errs.slice(0, 3).join(' | '));
  } catch (e) { check('the test ran to the end', false, e && e.stack || e); }
  finally {
    try { fs.copyFileSync(path.join(HOME, 'TrustyShelf', 'data', 'trustyshelf.log'), path.join(OUT, 'trustyshelf-emuchoice.log')); } catch {}
    fs.writeFileSync(path.join(OUT, 'app-output-emuchoice.txt'), appOut);
    try { if (p) p.close(); } catch {} try { process.kill(app.pid, 'SIGTERM'); } catch {} await sleep(1500); try { process.kill(-app.pid, 'SIGKILL'); } catch {}
    fs.rmSync(HOME, { recursive: true, force: true });
  }
  console.log(fails ? `${fails} failed` : 'all passed'); process.exit(fails ? 1 : 0);
})();
