#!/usr/bin/env node
// (T)rustyShelf: every test, all at once. One command runs what used to be run by hand, one suite after another (about half an
// hour), at the same time on this PC: it takes as long as the slowest part (a device group, about 8 minutes) instead of the sum.
//
//   node scripts/test-all.js                 everything (the app is built unpacked first: a few seconds; the AppImage is built beside the
//                                            others, for the one suite that checks the AppImage itself)
//   node scripts/test-all.js --only node,desktop       only some kinds: node, desktop, demo, device
//   node scripts/test-all.js --skip-build    reuse the builds in dist/ts-unpacked and dist/ts-appimage as they are (nothing in the app changed)
//   node scripts/test-all.js --jobs 6        how many run at the same time (default 8)
//   node scripts/test-all.js --list          what would run, and nothing else
//
// The kinds (nothing is left out, and a test file this script doesn't know is reported, so a new test can't be forgotten):
//   node     linux/ci/*-test.js that need no app: the backend pieces, run on made-up folders
//   desktop  linux/ci/*-test.js that start the real app on a virtual screen: the unpacked build (APPIMAGE set, so the app acts as
//            from an AppImage), and app-test on the real AppImage (it checks what only the AppImage has: its name in Steam's
//            shortcut, the wrapper's --no-sandbox and X11 options)
//   demo     android-app/ci/*-test.js that drive the demo page on their own
//   device   the three groups of android-app/ci/web-device-test.js (thor, screens, windows), the way GitHub runs them
// Each job's output is in linux-test-out/all/<name>.log. The exit code is 1 when a check fails that isn't in KNOWN.
//
// It runs under a memory cap (systemd-run, when there is one: --cap 12G) and at a lower priority, and every job's processes are
// stopped when it ends, so nothing is left running.
'use strict';
const { spawn, spawnSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');

const ROOT = path.join(__dirname, '..');
const arg = n => { const i = process.argv.indexOf('--' + n); return i < 0 ? null : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const only = arg('only') && arg('only') !== true ? String(arg('only')).split(',') : null;
const JOBS = Math.max(1, +arg('jobs') || 8), CAP = arg('cap') && arg('cap') !== true ? String(arg('cap')) : '12G';

// the tests, by kind (the first of each is the slowest: they start first)
const NODE = ['detect', 'pad', 'portable', 'dataexport', 'release-version', 'presence', 'epicdl', 'storage', 'windowmode', 'hoyoplay', 'music', 'looks'];
const DESKTOP = ['app', 'pc', 'xbox', 'home', 'music-app', 'windowmode-app', 'epicdl-app'];
const DEMO = ['android-artcard', 'android-pc', 'usermusic', 'windowmode', 'looks'];
const GROUPS = ['screens', 'thor', 'windows'];
// not tests of their own: run by a device group, or a probe
const NOT_STANDALONE = new Set(['heat-probe.js', 'web-device-test.js', 'device-test-parallel.js']);
// checks that failed before and are known (printed as known, they don't fail the run)
const KNOWN = ["Bottom page becomes the museum's companion (its row, the chosen case)"];

function unlisted() { // test files this script doesn't know
  const out = [];
  for (const f of fs.readdirSync(path.join(ROOT, 'linux', 'ci'))) if (/-test\.js$/.test(f) && ![...NODE, ...DESKTOP].includes(f.replace(/-test\.js$/, ''))) out.push('linux/ci/' + f);
  for (const f of fs.readdirSync(path.join(ROOT, 'android-app', 'ci'))) {
    if (!/\.js$/.test(f) || NOT_STANDALONE.has(f)) continue;
    const src = fs.readFileSync(path.join(ROOT, 'android-app', 'ci', f), 'utf8');
    if (/server\.listen\(/.test(src) && !/module\.exports/.test(src) && !DEMO.includes(f.replace(/-test\.js$/, ''))) out.push('android-app/ci/' + f);
  }
  return out;
}

const logDir = path.join(ROOT, 'linux-test-out', 'all');
const UNPACKED = path.join(ROOT, 'dist', 'ts-unpacked'), APPIMAGE_DIR = path.join(ROOT, 'dist', 'ts-appimage'); // (their own folders: the usual dist/ is left alone)
const exe = path.join(UNPACKED, 'linux-unpacked', 'trustyshelf');
const appImage = () => { try { return fs.readdirSync(APPIMAGE_DIR).filter(f => /\.AppImage$/.test(f)).map(f => path.join(APPIMAGE_DIR, f))[0] || ''; } catch { return ''; } };
const jobs = [];
const add = (kind, name, cmd, args, o = {}) => { if (!only || only.includes(kind)) jobs.push({ kind, name, cmd, args, cwd: o.cwd || ROOT, env: o.env || {}, wait: o.wait || [] }); };
for (const g of GROUPS) add('device', 'device-' + g, process.execPath, ['ci/web-device-test.js', 'www', path.join(ROOT, 'out', 'all-' + g), '--group=' + g], { cwd: path.join(ROOT, 'android-app'), wait: ['web'], env: { GITHUB_STEP_SUMMARY: '' } });
for (const t of DESKTOP) { // (app-test on the real AppImage, the others on the unpacked build; the AppImage's path is filled in when it is built)
  if (t === 'app') add('desktop', t + '-test', 'xvfb-run', ['-a', process.execPath, path.join('linux', 'ci', t + '-test.js'), '@APPIMAGE@'], { wait: ['appimage'] });
  else add('desktop', t + '-test', 'xvfb-run', ['-a', process.execPath, path.join('linux', 'ci', t + '-test.js'), exe], { wait: ['app'], env: { APPIMAGE: exe } }); }
for (const t of DEMO) add('demo', 'demo-' + t, process.execPath, ['ci/' + t + '-test.js', 'www', path.join(ROOT, 'out', 'all-' + t)], { cwd: path.join(ROOT, 'android-app'), wait: ['web'] });
for (const t of NODE) add('node', t + '-test', process.execPath, [path.join('linux', 'ci', t + '-test.js')]);

if (arg('list')) { for (const j of jobs) console.log(`${j.kind.padEnd(8)} ${j.name}`); const u = unlisted(); if (u.length) console.log('NOT IN THE LISTS:', u.join(', ')); process.exit(0); }

// run under a memory cap and a lower priority, once (when systemd can do that for this user)
if (!process.env.TS_TEST_ALL_CAPPED && process.platform === 'linux' && spawnSync('systemd-run', ['--user', '--scope', '-q', '-p', 'MemoryMax=' + CAP, 'true'], { stdio: 'ignore' }).status === 0) {
  const r = spawnSync('systemd-run', ['--user', '--scope', '-q', '-p', 'MemoryMax=' + CAP, 'nice', '-n', '5', process.execPath, __filename, ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, TS_TEST_ALL_CAPPED: '1' } });
  process.exit(r.status === null ? 1 : r.status);
}

const sh = (cmd, args, cwd) => new Promise(res => { const p = spawn(cmd, args, { cwd, stdio: 'ignore' }); p.on('close', c => res(c)); p.on('error', () => res(-1)); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const t0 = Date.now(), secs = t => ((Date.now() - t) / 1000).toFixed(0) + 's';
const running = new Set(), results = [];
process.on('exit', () => { for (const p of running) try { process.kill(-p.pid, 'SIGKILL'); } catch {} });
process.on('SIGINT', () => process.exit(130)); process.on('SIGTERM', () => process.exit(143));

(async () => {
  fs.mkdirSync(logDir, { recursive: true });
  const u = unlisted(); if (u.length) console.log('WARNING: tests this script does not know (add them to its lists): ' + u.join(', '));
  const needApp = jobs.some(j => j.wait.includes('app')), needWeb = jobs.some(j => j.wait.includes('web')), needImg = jobs.some(j => j.wait.includes('appimage'));
  const ready = { app: !needApp, web: !needWeb, appimage: !needImg };
  const build = (what, args, out) => sh('npx', ['electron-builder', '--linux', ...args, '--publish', 'never', '--config.directories.output=' + out], ROOT);
  // the preparations run beside the first jobs (the node tests need none of them)
  const prep = [];
  if (needApp) prep.push((async () => {
    const t = Date.now();
    if (arg('skip-build') && fs.existsSync(exe)) console.log('app: unpacked build reused');
    else { const c = await build('unpacked', ['dir'], UNPACKED); if (c !== 0 || !fs.existsSync(exe)) { console.log('app: the unpacked build failed (npx electron-builder --linux dir)'); process.exit(2); } console.log(`app: built unpacked in ${secs(t)}`); }
    ready.app = true; })());
  if (needImg) prep.push((async () => {
    const t = Date.now();
    if (arg('skip-build') && appImage()) console.log('AppImage: reused');
    else { try { fs.rmSync(APPIMAGE_DIR, { recursive: true, force: true }); } catch {} const c = await build('AppImage', ['AppImage'], APPIMAGE_DIR); if (c !== 0 || !appImage()) { console.log('AppImage: the build failed (npx electron-builder --linux AppImage)'); process.exit(2); } console.log(`AppImage: built in ${secs(t)}`); }
    for (const j of jobs) j.args = j.args.map(a => a === '@APPIMAGE@' ? appImage() : a);
    ready.appimage = true; })());
  if (needWeb) prep.push((async () => { const t = Date.now(); const c = await sh(process.execPath, ['copy-web.js'], path.join(ROOT, 'android-app')); if (c !== 0) { console.log('demo page: copy-web.js failed'); process.exit(2); } console.log(`demo page: copied in ${secs(t)}`); ready.web = true; })());
  console.log(`${jobs.length} jobs, ${JOBS} at a time${only ? ' (only ' + only.join(', ') + ')' : ''}`);

  const queue = jobs.slice(); let lastStart = 0;
  const start = j => new Promise(res => {
    const t = Date.now(), log = fs.createWriteStream(path.join(logDir, j.name + '.log'));
    const p = spawn(j.cmd, j.args, { cwd: j.cwd, env: { ...process.env, ...j.env }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    running.add(p); let out = '';
    p.stdout.on('data', d => { out += d; log.write(d); }); p.stderr.on('data', d => log.write(d));
    p.on('error', e => { log.write('could not start: ' + e.message); });
    p.on('close', code => {
      running.delete(p); log.end();
      const lines = out.split('\n'), bad = lines.filter(l => /^(FAIL|❌)|^\| ❌/.test(l)), good = lines.filter(l => /^(PASS|✅)|^\| ✅/.test(l)).length;
      const unknown = bad.filter(l => !KNOWN.some(k => l.includes(k))), known = bad.length - unknown.length;
      const ok = code === 0 || (code === 1 && bad.length > 0 && !unknown.length);
      const r = { name: j.name, kind: j.kind, ok, code, secs: secs(t), passed: good, failed: unknown, known };
      results.push(r); console.log(`${ok ? 'ok  ' : 'FAIL'} ${j.name.padEnd(24)} ${r.secs.padStart(5)}${good ? '  ' + good + ' checks' : ''}${known ? '  (' + known + ' known)' : ''}${ok ? '' : '  exit ' + code}`);
      for (const l of unknown.slice(0, 6)) console.log('       ' + l.slice(0, 220));
      res();
    });
  });
  const active = new Set();
  while (queue.length || active.size) {
    const i = queue.findIndex(j => j.wait.every(w => ready[w]));
    if (i >= 0 && active.size < JOBS) {
      const j = queue.splice(i, 1)[0], gap = Math.max(0, lastStart + 900 - Date.now()); // (xvfb-run -a picks its screen number: not two at the very same moment)
      lastStart = Date.now() + gap; await sleep(gap);
      const pr = start(j).then(() => active.delete(pr)); active.add(pr); continue;
    }
    await Promise.race([sleep(300), ...active]);
  }
  await Promise.all(prep);
  const bad = results.filter(r => !r.ok), checks = results.reduce((n, r) => n + r.passed, 0);
  console.log(`\n${bad.length ? bad.length + ' of ' + results.length + ' jobs FAILED: ' + bad.map(r => r.name).join(', ') : 'all ' + results.length + ' jobs passed'} · ${checks} checks · ${secs(t0)}`);
  process.exit(bad.length ? 1 : 0);
})();
