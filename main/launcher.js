// Based on Boxshelf by sassiestrhihno (https://github.com/sassiestrhihno/boxshelf-source, GPL-3.0): most of this file is Boxshelf's
// main/launcher.js; modified for (T)rustyShelf (see the git history).
// Starts emulators, Steam games and media apps, and reports when they close.
const { spawn } = require('child_process');
const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');
const { shell } = require('electron');
const { isFile, expand } = require('./paths');
const cleanEnv = process.platform === 'linux' ? require('./linuxpc').cleanEnv : null;

let running = null;

// Split an options string like  -b -e "{rom}"  into arguments, filling in {rom}.
function buildArgs(template, rom) {
  const out = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m;
  while ((m = re.exec(template || ''))) out.push((m[1] !== undefined ? m[1] : m[2]).replace(/\{rom\}/g, () => rom || '')); // a function: a path like Ca$$h\game.iso must not be read as a replacement pattern
  return out.filter(a => a !== '');
}

// ((T)rustyShelf) a program whose manifest asks for administrator rights (requireAdministrator) can't be started by a normal
// process: Windows refuses it (spawn says UNKNOWN or EACCES). Only looked for after such a refusal: the program is then
// started through PowerShell's Start-Process -Verb RunAs, which shows Windows' own prompt (HoYoPlay's games need it).
function needsAdmin(exe) { try { if (fs.statSync(exe).size > 600e6) return false; return fs.readFileSync(exe).includes('requireAdministrator'); } catch { return false; } }
const psq = s => "'" + String(s).replace(/'/g, "''") + "'"; // (one PowerShell string: a quote inside is doubled)
function elevatedScript(exe, args) {
  return `$p = Start-Process -FilePath ${psq(exe)} -WorkingDirectory ${psq(path.win32.dirname(exe))} -Verb RunAs ${args && args.length ? '-ArgumentList @(' + args.map(psq).join(',') + ') ' : ''}-PassThru; $p.WaitForExit()`;
}

function start(exe, args, onExit, env, cwd, logFile, elevate) { // elevate: a PC game or app, which may need administrator rights (the emulators never do) // env: the emulator's own environment (PS5: the KytyJets preset); else (T)rustyShelf's. cwd: else the program's folder
  exe = exe && expand(String(exe).trim().replace(/^"(.*)"$/, '$1')); // same rules as the Settings check: %VAR%, {app}, pasted "quotes"
  if (!exe || !isFile(exe)) throw new Error(`Can't find ${exe || 'the program'}. Check its path in Settings.`);
  if (running) throw new Error(busyMessage());
  // detached: on Windows a normal child sits in Node's kill-on-close job object, so a (T)rustyShelf crash or update restart
  // would take the emulator (and its unsaved game) with it. Not unref'd: the 'exit' event must still reach us.
  // logFile: the program's output goes there (Linux PC games), else nowhere
  let fd = null; if (logFile) { try { fd = require('fs').openSync(logFile, 'w'); } catch { fd = null; } }
  const childEnv = process.platform === 'linux' && cleanEnv ? cleanEnv(env || {}) : env;
  let child; try { child = spawn(exe, args, Object.assign({ cwd: cwd || path.dirname(exe), windowsHide: false, stdio: fd != null ? ['ignore', fd, fd] : 'ignore', detached: true }, childEnv ? { env: childEnv } : {})); }
  finally { if (fd != null) { try { require('fs').closeSync(fd); } catch {} } }
  running = child; child.bsName = path.basename(exe, path.extname(exe)); // (beta.10) its program name, never the path: the "already running" message names it
  const started = Date.now(); let done = false, spawned = false;
  const finish = info => { if (done) return; done = true; running = null; onExit({ ...info, ms: Date.now() - started }); };
  child.on('spawn', () => { spawned = true; });
  // failedToStart: the program never ran (EACCES, a bad exe, blocked by antivirus), so it wasn't a play
  child.on('error', err => {
    if (elevate && !spawned && process.platform === 'win32' && ['UNKNOWN', 'EACCES'].includes(err.code) && needsAdmin(exe)) {
      try { // (it stays "running" as long as the elevated program does: PowerShell waits for it; Quit can only close PowerShell's side)
        const el = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', Buffer.from(elevatedScript(exe, args), 'utf16le').toString('base64')], { windowsHide: true, stdio: 'ignore' });
        running = el; spawned = true; el.bsName = child.bsName;
        el.on('error', e => finish({ code: -1, error: e.message, failedToStart: true }));
        el.on('exit', code => finish({ code, failedToStart: code !== 0 && Date.now() - started < 4000 })); // (the prompt refused: it wasn't a play)
        return;
      } catch { /* PowerShell itself couldn't start: the refusal below */ }
    }
    finish({ code: -1, error: err.message, failedToStart: !spawned });
  });
  child.on('exit', code => finish({ code }));
  return { pid: child.pid, args };
}

function launchGame(sysCfg, rom, onExit, extraArgs = [], env = null) {
  return start(sysCfg.emulator, [...extraArgs, ...buildArgs(sysCfg.gameArgs, rom)], onExit, env);
}

function launchEmulator(sysCfg, onExit) {
  return start(sysCfg.emulator, buildArgs(sysCfg.emulatorArgs, ''), onExit);
}

function launchApp(exe, onExit, args) { return start(exe, Array.isArray(args) ? args : [], onExit, null, undefined, undefined, true); }
// (Linux) a Windows game through Wine / Proton: the runner (umu-run, proton, wine) with the game's own folder and environment
function launchCommand(cmd, args, onExit, { env, cwd, log } = {}) { return start(cmd, Array.isArray(args) ? args : [], onExit, env || null, cwd, log); }

function launchSteam(appid) {
  if (!/^\d+$/.test(String(appid))) throw new Error('Unknown Steam game.');
  return shell.openExternal(`steam://rungameid/${appid}`);
}

function isRunning() { return !!running; }
// (beta.10) what's running, by name (a game's title once main.js gives it one, else the program's name; no folders)
function runningName() { return running ? String(running.bsName || '').trim().slice(0, 120) : ''; }
function setRunningName(n) { if (running && n) running.bsName = String(n); }
function busyMessage() { const n = runningName(); return n ? `${n} is already running. Close it first.` : 'Something is already running. Close it first.'; }
function stopRunning() { if (running) { try { running.kill(); } catch {} } }
// a helper spawn (taskkill) that can't be found or started must not become an uncaught 'error' event
function quiet(cmd, args) { try { const c = spawn(cmd, args, { windowsHide: true, stdio: 'ignore' }); c.on('error', () => {}); return c; } catch { return null; } }
let forceTimer = null;
// Ask the emulator to close like a click on its X (saves, settings and Dolphin's batch mode all behave),
// and force it if it's still there forceAfterMs later: Cemu, RPCS3 and Xenia can take several seconds to flush saves
// and shader caches, so the default is a generous 8 s. onForce(pid) is called if the force kill was needed.
// Returns false when nothing is running, else true (same as before).
function closeRunning(forceAfterMs = 8000, onForce) {
  if (!running) return false;
  // (beta.12, Seamless play) a watched game (adopt below): its watcher asks the game's own processes, never its launcher
  if (running.bsWatch) { try { Promise.resolve(running.bsWatch.close(forceAfterMs, onForce)).catch(() => {}); } catch {} return true; }
  const pid = running.pid, child = running;
  if (process.platform === 'win32') quiet('taskkill', ['/PID', String(pid)]);
  // (Linux: the whole process group, which detached started: a Flatpak's launcher, an AppImage's runtime and the emulator
  // itself all get the request, not just the first process)
  else { try { process.kill(-pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} } }
  if (!forceTimer) { // pressed again while waiting: ask again, but keep the first deadline
    const ms = Number.isFinite(+forceAfterMs) && +forceAfterMs >= 0 ? +forceAfterMs : 8000;
    forceTimer = setTimeout(() => {
      forceTimer = null;
      if (running !== child || child.exitCode !== null || child.signalCode !== null) return;
      // a "really quit?" dialog (or anything else) is holding it open: end the whole tree
      if (process.platform === 'win32') quiet('taskkill', ['/PID', String(pid), '/T', '/F']); else { try { process.kill(-pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch {} } }
      if (typeof onForce === 'function') { try { onForce(pid); } catch {} }
    }, ms);
    child.once('exit', () => { clearTimeout(forceTimer); forceTimer = null; });
  }
  return true;
}

// (beta.12, Seamless play) A game the shelf didn't start itself but watches (main/gamewatch.js: a Steam or store game). It
// counts as the running game like one the shelf started, so the busy check, the Home menu's Quit, the quit cover and the
// return to the shelf all work the same. watcher: { close(forceAfterMs, onForce) }. Returns { setPid(pid), finish(info):
// it ended (onExit runs, as for a started game), release(): let go without onExit (watching gave up) }.
function adopt(name, watcher, onExit) {
  if (running) throw new Error(busyMessage());
  const me = new EventEmitter();
  Object.assign(me, { pid: 0, exitCode: null, signalCode: null, bsName: String(name || '').slice(0, 120), bsWatch: watcher, kill: () => { try { Promise.resolve(watcher.close(0)).catch(() => {}); } catch {} } });
  running = me; const started = Date.now(); let done = false;
  const end = () => { if (done) return false; done = true; if (running === me) running = null; return true; };
  return {
    setPid: pid => { me.pid = +pid || 0; try { onEvent('process started', me.pid); } catch {} },
    finish: info => { if (!end()) return; me.exitCode = 0; me.emit('exit', 0); onExit({ code: 0, ...(info || {}), ms: Date.now() - started }); },
    release: () => { end(); },
    isCurrent: () => running === me
  };
}
// (beta.12) what happens to a launch, for the launch timeline in the log (main/seamless.js): onEvent(what, pid)
let onEvent = () => {};
function setEventHook(fn) { onEvent = typeof fn === 'function' ? fn : () => {}; }

module.exports = { buildArgs, launchGame, launchEmulator, launchApp, launchCommand, launchSteam, needsAdmin, elevatedScript, isRunning, runningName, setRunningName, busyMessage, stopRunning, closeRunning, adopt, setEventHook };
