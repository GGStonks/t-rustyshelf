// Based on Boxshelf by sassiestrhihno (https://github.com/sassiestrhihno/boxshelf-source, GPL-3.0): this file is the same as Boxshelf's
// main/vdf.js apart from the app's name ((T)rustyShelf) and the fix below that keeps the parser from looping forever.
// Minimal parser for Valve's text KeyValues format (.vdf / .acf).
function parse(text) {
  let i = 0;
  const n = text.length;
  function skip() {
    while (i < n) {
      const c = text[i];
      // ((T)rustyShelf, beta issue 34) every kind of space counts: a no-break space, form feed or stray byte-order mark
      // between two strings used to stop both this and an unquoted string, so the parser went round forever on that
      // character and the app hung at launch reading Steam's files
      if (/\s/.test(c)) { i++; continue; }
      if (c === '/' && text[i + 1] === '/') { while (i < n && text[i] !== '\n') i++; continue; }
      break;
    }
  }
  function str() {
    skip();
    if (text[i] === '"') {
      i++;
      let out = '';
      while (i < n && text[i] !== '"') {
        if (text[i] === '\\' && i + 1 < n) { const e = text[i + 1]; out += e === 'n' ? '\n' : e === 't' ? '\t' : e; i += 2; }
        else out += text[i++];
      }
      i++;
      return out;
    }
    let out = '';
    while (i < n && !/[\s{}"]/.test(text[i])) out += text[i++];
    return out;
  }
  function obj() {
    const o = {};
    for (;;) {
      skip();
      if (i >= n) return o;
      if (text[i] === '}') { i++; return o; }
      const at = i, key = str();
      skip();
      if (text[i] === '{') { i++; o[key] = obj(); }
      else o[key] = str();
      if (i === at) i++; // (and whatever else stops a string without being read is stepped over: always forward)
    }
  }
  return obj();
}

// Case-insensitive property lookup.
function get(o, ...keys) {
  let cur = o;
  for (const k of keys) {
    if (!cur || typeof cur !== 'object') return undefined;
    const real = Object.keys(cur).find(x => x.toLowerCase() === String(k).toLowerCase());
    cur = real === undefined ? undefined : cur[real];
  }
  return cur;
}

module.exports = { parse, get };
