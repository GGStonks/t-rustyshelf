// Native Rust image tools engine for (T)rustyShelf.
// Replaces hidden Chromium BrowserWindow helpers with the high-performance native binary 'trustyshelf-imgtools'.
'use strict';
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let binPath = null;
let binChecked = false;

function findBinary() {
  if (binChecked) return binPath;
  binChecked = true;

  const ext = process.platform === 'win32' ? '.exe' : '';
  const binName = `trustyshelf-imgtools${ext}`;

  // 1. Unpacked asar path (packaged app)
  const unpacked = path.join(__dirname, 'bin', binName).replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
  if (fs.existsSync(unpacked)) { binPath = unpacked; return binPath; }

  // 2. Local main/bin path
  const local = path.join(__dirname, 'bin', binName);
  if (fs.existsSync(local)) { binPath = local; return binPath; }

  // 3. Cargo target/release build path
  const cargo = path.join(__dirname, '..', 'target', 'release', binName);
  if (fs.existsSync(cargo)) { binPath = cargo; return binPath; }

  binPath = null;
  return null;
}

let worker = null;
let reqId = 1;
const pending = new Map();
let stdoutBuf = '';

function startWorker() {
  const bin = findBinary();
  if (!bin) return null;
  if (worker && !worker.killed) return worker;

  try {
    worker = spawn(bin, ['--worker'], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    stdoutBuf = '';

    worker.stdout.on('data', chunk => {
      stdoutBuf += chunk.toString('utf8');
      let nl;
      while ((nl = stdoutBuf.indexOf('\n')) >= 0) {
        const line = stdoutBuf.slice(0, nl).trim();
        stdoutBuf = stdoutBuf.slice(nl + 1);
        if (!line) continue;
        try {
          const resp = JSON.parse(line);
          if (resp.id != null && pending.has(resp.id)) {
            const { resolve, timer } = pending.get(resp.id);
            clearTimeout(timer);
            pending.delete(resp.id);
            resolve(resp);
          }
        } catch {}
      }
    });

    worker.on('error', () => {
      stopWorker();
    });

    worker.on('exit', () => {
      stopWorker();
    });

    return worker;
  } catch {
    worker = null;
    return null;
  }
}

function stopWorker() {
  if (worker) {
    try { worker.kill(); } catch {}
    worker = null;
  }
  for (const [, { reject, timer }] of pending) {
    clearTimeout(timer);
    reject(new Error('worker stopped'));
  }
  pending.clear();
  stdoutBuf = '';
}

function sendJob(req, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const w = startWorker();
    if (!w) return resolve({ ok: false, err: 'no binary' });

    const id = reqId++;
    req.id = id;

    const timer = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        resolve({ ok: false, err: 'timeout' });
      }
    }, timeoutMs);

    pending.set(id, { resolve, reject, timer });

    try {
      w.stdin.write(JSON.stringify(req) + '\n');
    } catch (e) {
      clearTimeout(timer);
      pending.delete(id);
      resolve({ ok: false, err: e.message });
    }
  });
}

function isAvailable() {
  return !!findBinary();
}

async function shrink(fileOrBuf, w) {
  const req = { mode: 'shrink', w };
  if (typeof fileOrBuf === 'string') req.file = fileOrBuf;
  else if (Buffer.isBuffer(fileOrBuf)) req.data = fileOrBuf.toString('base64');
  else return null;

  const resp = await sendJob(req);
  if (!resp || !resp.ok || !resp.data) return null;
  return Buffer.from(resp.data, 'base64');
}

async function crop(fileOrBuf) {
  const req = { mode: 'crop' };
  if (typeof fileOrBuf === 'string') req.file = fileOrBuf;
  else if (Buffer.isBuffer(fileOrBuf)) req.data = fileOrBuf.toString('base64');
  else return null;

  const resp = await sendJob(req);
  if (!resp || !resp.ok || !Array.isArray(resp.pages) || resp.pages.length < 2) return null;
  return {
    left: Buffer.from(resp.pages[0], 'base64'),
    right: Buffer.from(resp.pages[1], 'base64'),
  };
}

async function spine(fileOrBuf, opts = {}) {
  const req = {
    mode: 'spine',
    front: opts.front || 0.71,
    spine: opts.spine || 0.074,
    part: opts.part || 'spine',
  };
  if (typeof fileOrBuf === 'string') req.file = fileOrBuf;
  else if (Buffer.isBuffer(fileOrBuf)) req.data = fileOrBuf.toString('base64');
  else return null;

  const resp = await sendJob(req);
  if (!resp || !resp.ok || !resp.data) return null;
  return Buffer.from(resp.data, 'base64');
}

async function rebrand(fileOrBuf, opts = {}) {
  const req = {
    mode: 'rebrand',
    plat: opts.plat || 'ps5',
    part: opts.part || '',
  };
  if (typeof fileOrBuf === 'string') req.file = fileOrBuf;
  else if (Buffer.isBuffer(fileOrBuf)) req.data = fileOrBuf.toString('base64');
  else return null;

  const resp = await sendJob(req);
  if (!resp || !resp.ok || !resp.data) return null;
  return Buffer.from(resp.data, 'base64');
}

async function cart(fileOrBuf, sys = 'sw') {
  const req = { mode: 'cart', sys };
  if (typeof fileOrBuf === 'string') req.file = fileOrBuf;
  else if (Buffer.isBuffer(fileOrBuf)) req.data = fileOrBuf.toString('base64');
  else return null;

  const resp = await sendJob(req);
  if (!resp || !resp.ok || !resp.data) return null;
  return Buffer.from(resp.data, 'base64');
}

module.exports = {
  isAvailable,
  findBinary,
  shrink,
  crop,
  spine,
  rebrand,
  cart,
  stop: stopWorker,
};
