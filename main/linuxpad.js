// (beta.9) Linux / Steam Deck: hold Select + Start for 1.5 s during a game and Boxshelf closes it (closeGame), whatever
// the emulator, configured or not. Windows has the Home menu on the Guide button (padwatch.js, XInput); in Steam's Game
// Mode the Steam button belongs to Steam, so Linux gets this instead.
// It reads the joystick devices (/dev/input/js*: Steam's virtual gamepad shows up as one, with the Xbox layout) only while
// a game is running, and stops when it ends. Each event is 8 bytes: time (ms), value, type (1 button, 2 axis, | 0x80 the
// first "this is how it is now" report), number. Button numbers: Xbox layout Select 6 / Start 7; PlayStation pads 8 / 9.
'use strict';
const fs = require('fs');
const path = require('path');

const HOLD_MS = 1500;
let log = () => {}, dir = '/dev/input', sysDir = '/sys/class/input', force = false;
function init(o) { log = o.log || log; if (o.dir) dir = o.dir; if (o.sysDir) sysDir = o.sysDir; force = !!o.force; }

let on = null; // { onQuit, devs: Map(name -> { stream, down: Set, sel, start }), timer, scan, fired }
function layout(name) {
  let n = ''; try { n = fs.readFileSync(path.join(sysDir, name, 'device', 'name'), 'utf8'); } catch {}
  return /sony|playstation|dualsense|dualshock|wireless controller/i.test(n) ? { sel: 8, start: 9, label: n.trim() } : { sel: 6, start: 7, label: n.trim() || 'gamepad' };
}
function check() {
  if (!on || on.fired) return;
  const held = [...on.devs.values()].some(d => d.down.has(d.sel) && d.down.has(d.start));
  if (held && !on.timer) on.timer = setTimeout(() => { if (!on) return; on.timer = null; if ([...on.devs.values()].some(d => d.down.has(d.sel) && d.down.has(d.start))) { on.fired = true; log('Linux pad: Select + Start held, closing the game'); try { on.onQuit(); } catch (e) { log('Linux pad: quit failed', e.message); } } }, HOLD_MS);
  if (!held && on.timer) { clearTimeout(on.timer); on.timer = null; }
}
function open(name) {
  if (!on || on.devs.has(name)) return;
  const L = layout(name), d = { ...L, down: new Set(), stream: null, rest: Buffer.alloc(0) };
  let s; try { s = fs.createReadStream(path.join(dir, name), { highWaterMark: 512 }); } catch { return; }
  d.stream = s; on.devs.set(name, d);
  s.on('data', chunk => feed(d, chunk));
  s.on('error', () => { on && on.devs.delete(name); });
  s.on('close', () => { if (on && on.devs.get(name) === d && !d.keep) on.devs.delete(name); });
}
function feed(d, chunk) { const b = d.rest.length ? Buffer.concat([d.rest, chunk]) : chunk; let i = 0;
  for (; i + 8 <= b.length; i += 8) { const value = b.readInt16LE(i + 4), type = b[i + 6], num = b[i + 7];
    if ((type & 0x7f) !== 1) continue; // buttons only
    if (value) d.down.add(num); else d.down.delete(num);
    if (!(type & 0x80)) check(); } // (the opening "how it is now" report never starts a hold)
  d.rest = b.subarray(i); }
// (tests) events for a pretend pad that stays plugged in
function _feed(name, buf, sysName) { if (!on) return; let d = on.devs.get(name); if (!d) { d = { ...layout(sysName || name), down: new Set(), stream: null, rest: Buffer.alloc(0) }; on.devs.set(name, d); } feed(d, buf); }
function scan() { if (!on) return; let names = []; try { names = fs.readdirSync(dir).filter(n => /^js\d+$/.test(n)); } catch {} for (const n of names) open(n); }
// a game started: watch the pads until end()
function begin(onQuit) {
  if (process.platform !== 'linux' && !force) return false;
  end(); on = { onQuit, devs: new Map(), timer: null, fired: false, scan: null };
  scan(); on.scan = setInterval(scan, 3000); // (a pad plugged in during the game)
  return true;
}
function end() { if (!on) return; const o = on; on = null; clearTimeout(o.timer); clearInterval(o.scan); for (const d of o.devs.values()) { d.keep = true; try { d.stream.destroy(); } catch {} } }
const watching = () => !!on;

module.exports = { init, begin, end, watching, HOLD_MS, _feed };
