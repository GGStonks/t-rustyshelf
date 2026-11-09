#!/usr/bin/env node
'use strict';
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const root = path.join(__dirname, '..');
let cargoCmd = 'cargo';
const cargoUser = path.join(os.homedir(), '.cargo', 'bin', process.platform === 'win32' ? 'cargo.exe' : 'cargo');
if (fs.existsSync(cargoUser)) {
  cargoCmd = cargoUser;
}

console.log(`Building Rust tools using ${cargoCmd}...`);
execFileSync(cargoCmd, ['build', '--release'], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    PATH: `${path.dirname(cargoUser)}${path.delimiter}${process.env.PATH || ''}`,
  },
});

const ext = process.platform === 'win32' ? '.exe' : '';
const binName = `trustyshelf-imgtools${ext}`;
const src = path.join(root, 'target', 'release', binName);
const dstDir = path.join(root, 'main', 'bin');
const dst = path.join(dstDir, binName);

fs.mkdirSync(dstDir, { recursive: true });
fs.copyFileSync(src, dst);
if (process.platform !== 'win32') {
  fs.chmodSync(dst, 0o755);
}
console.log(`Copied ${binName} to main/bin/`);
