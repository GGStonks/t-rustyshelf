// (T)rustyShelf: a PC game's achievements, read from what Steam keeps on this PC (asked for in the (T)rustyShelf discussions, #22).
// Steam caches every game's achievement list and your progress in its appcache\stats folder, in its binary KeyValues format:
//   UserGameStatsSchema_<appid>.bin   the achievements: stats → <stat> → bits → <bit> { name, bit, display { name, desc, hidden,
//                                     icon, icon_gray } } (names in every language Steam has; English is used, else the first)
//   UserGameStats_<account id>_<appid>.bin   your progress: cache → <stat> { data (the unlocked bits), AchievementTimes { <bit>: time } }
// The account is the one Steam last signed in (config\loginusers.vdf, MostRecent; its id is the SteamID64 minus 76561197960265728).
// Nothing is sent anywhere: a game Steam hasn't cached stats for yet (never started on this PC) simply has none.
// progress() answers in the shape the RetroAchievements row and list use (main/ra.js), with no points.
'use strict';
const fs = require('fs'), path = require('path');
const vdf = require('./vdf');

// Valve's binary KeyValues: one type byte, the key (zero-ended UTF-8), the value; 0 opens a map, 8 (or 11) closes it
function parseBin(b) {
  let i = 0;
  const cstr = () => { const s = i; while (i < b.length && b[i] !== 0) i++; const t = b.toString('utf8', s, i); i++; return t; };
  function map() {
    const o = {};
    while (i < b.length) {
      const t = b[i++]; if (t === 8 || t === 11) return o;
      const k = cstr();
      if (t === 0) o[k] = map();
      else if (t === 1) o[k] = cstr();
      else if (t === 2 || t === 4 || t === 6) { o[k] = b.readInt32LE(i); i += 4; }
      else if (t === 3) { o[k] = b.readFloatLE(i); i += 4; }
      else if (t === 7 || t === 10) { o[k] = Number(t === 7 ? b.readBigUInt64LE(i) : b.readBigInt64LE(i)); i += 8; }
      else if (t === 5) { const s = i; while (i + 1 < b.length && (b[i] || b[i + 1])) i += 2; o[k] = b.toString('utf16le', s, i); i += 2; }
      else throw new Error('Unknown KeyValues type ' + t);
    }
    return o;
  }
  return map();
}
const readBin = f => { try { return parseBin(fs.readFileSync(f)); } catch { return null; } };
const lower = o => { const m = {}; for (const [k, v] of Object.entries(o || {})) m[k.toLowerCase()] = v; return m; };
const text = v => typeof v === 'string' ? v : v && typeof v === 'object' ? (lower(v).english || Object.values(v).find(x => typeof x === 'string') || '') : '';

// the Steam account last signed in on this PC: its 32-bit account id ('' when none)
function accountId(steamDir) {
  let t = ''; try { t = fs.readFileSync(path.join(steamDir, 'config', 'loginusers.vdf'), 'utf8'); } catch { return ''; }
  const users = vdf.get(vdf.parse(t), 'users') || {}; let best = null, bestT = -1;
  for (const [sid, u] of Object.entries(users)) { const m = lower(u), ts = +m.timestamp || 0; if (String(m.mostrecent) === '1') { best = sid; break; } if (ts > bestT) { bestT = ts; best = sid; } }
  if (!best || !/^\d{17}$/.test(best)) return '';
  return String(BigInt(best) - 76561197960265728n);
}
// the stats files there are for this game: the account's own, else the only one (one person on this PC)
function userStatsFile(dir, appid, acct) {
  const own = acct && path.join(dir, `UserGameStats_${acct}_${appid}.bin`); if (own && fs.existsSync(own)) return own;
  let names = []; try { names = fs.readdirSync(dir).filter(n => new RegExp(`^UserGameStats_\\d+_${appid}\\.bin$`).test(n)); } catch {}
  return names.length === 1 ? path.join(dir, names[0]) : null;
}

// → null (no achievements known for it here) or { title, total, earned, points: 0, pointsEarned: 0, source: 'Steam', achievements: [...] }
function steamProgress(steamDir, appid) {
  appid = String(appid || ''); if (!/^\d+$/.test(appid) || !steamDir) return null;
  const dir = path.join(steamDir, 'appcache', 'stats'), schema = readBin(path.join(dir, `UserGameStatsSchema_${appid}.bin`));
  if (!schema) return null;
  const root = lower(schema)[appid] || Object.values(schema)[0] || {}, r = lower(root), stats = lower(r.stats);
  const userF = userStatsFile(dir, appid, accountId(steamDir)), user = userF ? readBin(userF) : null, cache = user ? (lower(user).cache || {}) : {};
  const list = [];
  for (const [sid, st] of Object.entries(stats)) {
    const s = lower(st); if (!s.bits || typeof s.bits !== 'object') continue;
    const mine = lower(cache[sid] || cache[String(sid)]), data = (+mine.data || 0) >>> 0, times = lower(mine.achievementtimes);
    for (const [bid, bt] of Object.entries(s.bits)) {
      const b = lower(bt), d = lower(b.display), bit = +(b.bit ?? bid), earned = bit >= 0 && bit < 32 && !!(data & (1 << bit)), t = +times[String(bit)] || 0, icon = earned ? d.icon : (d.icon_gray || d.icon);
      list.push({ id: `${sid}.${bit}`, title: text(d.name) || b.name || 'Achievement', desc: String(d.hidden) === '1' && !earned ? 'Hidden achievement' : text(d.desc), points: 0,
        badge: icon ? `https://cdn.akamai.steamstatic.com/steamcommunity/public/images/apps/${appid}/${icon}` : null, earned, hardcore: false,
        date: earned && t ? new Date(t * 1000).toISOString().slice(0, 19).replace('T', ' ') : null, rarity: null, order: +sid * 64 + bit });
    }
  }
  if (!list.length) return null;
  list.sort((a, b) => a.order - b.order); list.forEach(a => delete a.order);
  const earned = list.filter(a => a.earned).length;
  return { id: appid, title: text(r.gamename) || '', source: 'Steam', total: list.length, earned, points: 0, pointsEarned: 0, mastered: earned === list.length ? 'completed' : '', achievements: list };
}

module.exports = { parseBin, accountId, steamProgress };
