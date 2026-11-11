// ((T)rustyShelf, Boxshelf beta issue 34) The stall watch: a small thread of its own that writes to the log while the main
// process is stuck, not only once it's free again. The freeze watch in main.js measures a stall when it ends, so a stall
// that never ends (the window "not responding" until Windows closes it) left nothing in the log after the last step. The
// main process ticks a shared counter four times a second and tells the thread what it's doing (markEvent); when the
// counter stops, the thread logs it after 5 s, 15 s, 30 s, 1, 2 and 5 minutes, naming the last step.
'use strict';
const { Worker } = require('worker_threads');

const CODE = `
const { workerData, parentPort } = require('worker_threads'), fs = require('fs');
const beat = new Int32Array(workerData.sab), steps = workerData.steps;
let last = 'start', seen = Atomics.load(beat, 0), since = Date.now(), told = 0;
parentPort.on('message', e => { last = String(e).slice(0, 160); });
const write = m => { try { fs.appendFileSync(workerData.logFile, '[' + new Date().toISOString() + '] ' + m + '\\n'); } catch {} };
const secs = s => s >= 60 ? (s / 60) + (s === 60 ? ' minute' : ' minutes') : s + ' s';
setInterval(() => {
  const b = Atomics.load(beat, 0), now = Date.now();
  if (b !== seen) { if (told) write('stall watch: the main process answers again after ' + ((now - since) / 1000).toFixed(1) + ' s'); seen = b; since = now; told = 0; return; }
  if (told < steps.length && now - since >= steps[told] * 1000) { write('stall watch: the main process has been stuck for ' + secs(steps[told]) + ' so far (last: ' + last + ')'); told++; }
}, workerData.every);
`;

let worker = null, beat = null, tick = null;
// logFile: the app's log. opts.steps (seconds) and opts.every (ms) are for the tests
function start(logFile, opts = {}) {
  if (worker) return true;
  try {
    const sab = new SharedArrayBuffer(4); beat = new Int32Array(sab);
    worker = new Worker(CODE, { eval: true, workerData: { sab, logFile, steps: opts.steps || [5, 15, 30, 60, 120, 300], every: opts.every || 500 } });
    worker.on('error', () => { worker = null; }); worker.unref();
    tick = setInterval(() => Atomics.add(beat, 0, 1), opts.tick || 250); tick.unref();
    return true;
  } catch { worker = null; return false; }
}
function mark(what) { if (worker) try { worker.postMessage(String(what)); } catch {} }
function stop() { clearInterval(tick); tick = null; if (worker) { const w = worker; worker = null; return w.terminate().catch(() => {}); } return Promise.resolve(); }

module.exports = { start, mark, stop };
