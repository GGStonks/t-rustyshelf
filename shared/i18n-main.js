// Based on Boxshelf by sassiestrhihno (https://github.com/sassiestrhihno/boxshelf-source, GPL-3.0). Written by Thanks2111
// (https://github.com/Thanks2111) in their Boxshelf fork (branch portugues): the Brazilian Portuguese interface. Brought into
// (T)rustyShelf as a language you choose (Settings → Display → Language; the system windows follow it, set from main.js), English by default.
// Boxshelf em português no processo principal: traduz as janelas do sistema (abrir arquivo, salvar,
// perguntas e erros) com o mesmo dicionário da interface (shared/i18n-pt.json).
'use strict';
const path = require('path');
let DATA = null;
try { DATA = require(path.join(__dirname, 'i18n-pt.json')); } catch { DATA = null; }

const exact = new Map(DATA ? Object.entries(DATA.d) : []);
const tpls = DATA ? DATA.t.map(t => ({ re: new RegExp('^' + t[0] + '$'), out: t[1], lit: t[2] })) : [];

function fill(out, m) {
  let s = '';
  for (const p of out) {
    if (typeof p === 'string') { s += p; continue; }
    const v = m[p.g + 1] === undefined ? '' : m[p.g + 1];
    if (p.o) s += p.o[v === p.a ? 0 : v === p.b ? 1 : (v === '' || v === '1' ? 0 : 1)];
    else s += tr(v);
  }
  return s;
}
function tr(text) {
  if (typeof text !== 'string' || !text) return text;
  const lines = text.split('\n');
  if (lines.length > 1) return lines.map(tr).join('\n');
  const key = text.replace(/\s+/g, ' ').trim();
  if (!key) return text;
  let hit = exact.get(key);
  if (hit === undefined) for (const t of tpls) { if (key.includes(t.lit)) { const m = t.re.exec(key); if (m) { hit = fill(t.out, m); break; } } }
  return hit === undefined ? text : hit;
}
function opts(o) {
  if (!o || typeof o !== 'object') return o;
  const c = { ...o };
  for (const k of ['title', 'message', 'detail', 'buttonLabel', 'checkboxLabel', 'nameFieldLabel']) if (typeof c[k] === 'string') c[k] = tr(c[k]);
  if (Array.isArray(c.buttons)) c.buttons = c.buttons.map(tr);
  if (Array.isArray(c.filters)) c.filters = c.filters.map(f => (f && typeof f.name === 'string' ? { ...f, name: tr(f.name) } : f));
  return c;
}
// ((T)rustyShelf) installed once; translates only while Portuguese is the language chosen (setActive)
let active = false, installed = false;
function setActive(on) { active = !!on; }
function install(electron) {
  if (!DATA || installed || process.env.BS_LANG === 'en') return; installed = true;
  const d = electron.dialog;
  for (const f of ['showOpenDialog', 'showOpenDialogSync', 'showSaveDialog', 'showSaveDialogSync', 'showMessageBox', 'showMessageBoxSync']) {
    const orig = d[f];
    if (typeof orig !== 'function') continue;
    d[f] = function (...a) { if (!active) return orig.apply(d, a); const i = a.findIndex(x => x && typeof x === 'object' && !x.webContents && !x.id); if (i >= 0) a[i] = opts(a[i]); return orig.apply(d, a); };
  }
  const err = d.showErrorBox;
  if (typeof err === 'function') d.showErrorBox = (t, c) => active ? err.call(d, tr(t), tr(c)) : err.call(d, t, c);
}
module.exports = { tr, install, setActive };
