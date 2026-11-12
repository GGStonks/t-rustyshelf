// (T)rustyShelf: the PS Vita shelf, played in Vita3K (asked for in the (T)rustyShelf discussions, #21).
// Vita3K installs each game into its own folder, ux0\app\<title id> (eboot.bin and sce_sys\param.sfo inside, which the
// scanner already reads as a PlayStation game folder), so the shelf lists those folders. An installed game is started with
// `-r <title id>` (run the installed app) and -F (fullscreen); a .vpk that isn't installed yet is handed to Vita3K as it is,
// which installs it and runs it.
// Where ux0 is: the pref-path its config.yml names, else beside the program (older and portable builds), else its user folder
// (%APPDATA%\Vita3K\Vita3K on Windows, ~/.local/share/Vita3K/Vita3K on Linux).
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');

const isDir = p => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const TITLE_ID = /^[A-Z]{4}\d{5}$/;

function userDir() {
  return process.platform === 'win32' ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Vita3K', 'Vita3K')
    : path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'Vita3K', 'Vita3K');
}
// the folders that can hold ux0 for this Vita3K program (exe may be empty: only the usual ones)
function prefDirs(exe) {
  const out = [], beside = exe ? path.dirname(exe) : '', home = userDir();
  for (const f of [beside && path.join(beside, 'config.yml'), path.join(home, 'config.yml')].filter(Boolean)) {
    let t = ''; try { t = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const m = /^pref-path:\s*(.*?)\s*$/m.exec(t), p = m && m[1].replace(/^(['"])(.*)\1$/, '$2').trim();
    if (p) out.push(path.isAbsolute(p) ? p : path.join(path.dirname(f), p));
  }
  if (beside) out.push(beside, path.join(beside, 'portable'));
  out.push(home);
  const seen = new Set(); return out.filter(d => { const k = path.resolve(d).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}
// the ux0\app folders that exist: the games folders for the Vita shelf
function appDirs(exe) { return prefDirs(exe).map(d => path.join(d, 'ux0', 'app')).filter(isDir); }

// an installed game's title id: its folder's name (ux0\app\PCSE00000), else the one in its param.sfo
function titleIdOf(file) {
  const dir = path.dirname(file), name = path.basename(dir);
  if (TITLE_ID.test(name)) return name;
  try { const m = /([A-Z]{4}\d{5})/.exec(fs.readFileSync(path.join(dir, 'sce_sys', 'param.sfo')).toString('latin1')); if (m) return m[1]; } catch {}
  return '';
}
// what Vita3K is given: { rom, args } (args in the shelf's {rom} form)
function launchSpec(file) {
  if (/\.vpk$/i.test(file)) return { rom: file, args: '-F "{rom}"' };
  const id = titleIdOf(file);
  if (!id) throw new Error("This PS Vita game's title id couldn't be read (its folder should be named like PCSE00000). Install it in Vita3K first.");
  return { rom: id, args: '-F -r "{rom}"' };
}

module.exports = { prefDirs, appDirs, titleIdOf, launchSpec, userDir };
