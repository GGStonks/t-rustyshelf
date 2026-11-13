// Issue 19: the museum room planner (shared/museum-layout.js) and the organization config migration.
// Pure: no Electron, no DOM, no THREE. Runs against a made-up user-data folder for the config part.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const ML = require('../../shared/museum-layout.js');
const cfg = require('../../main/config.js');

let failed = 0;
function check(name, ok, detail) { if (ok) console.log(`ok   ${name}`); else { failed++; console.log(`FAIL ${name}${detail !== undefined ? ` — ${detail}` : ''}`); } }
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------- planner ----------
const GAMES = [];
const add = (n, sys, genre) => { for (let i = 0; i < n; i++) { let k = i, id = `${sys}:${k}`; while (GAMES.some(g => g.id === id)) id = `${sys}:${++k}`; GAMES.push({ id, systemId: sys, primaryGenre: genre, sourceOrder: GAMES.length }); } };
add(1250, 'gc', 'Racing'); // one system over one room's cap → continuation rooms (Xbox 360-sized and beyond)
add(3, 'pcengine', null); add(1, 'neogeo', 'Fighting'); add(1, 'weird-box', 'Shmup'); // Other, incl. an unknown system id
add(2, 'arcade', 'Fighting'); add(1, 'arcade', null);
add(2, 'dos', 'Puzzle'); add(2, 'pc', 'Racing'); add(1, 'custom', 'Homebrew'); // computers
add(1, 'xone', 'Sports'); // a known alias resolves to xboxone
const ALL = GAMES.slice();

function total(plan) { return plan.rooms.reduce((a, r) => a + r.gameIds.length, 0); }
function onceEverywhere(plan, label) {
  const seen = new Set();
  for (const r of plan.rooms) {
    const cap = r.kind === 'arcade' ? ML.ARCADE_CAP : ML.ROOM_CAP;
    check(`${label}: room ${r.id} within its kind's cap`, r.gameIds.length <= cap, r.gameIds.length);
    check(`${label}: room ${r.id} within the segment cap`, r.segments.length <= ML.SEGMENTS_MAX, r.segments.length);
    for (const s of r.segments) {
      check(`${label}: segment ${s.id} within the case cap`, s.gameIds.length <= ML.SEGMENT_MAX, s.gameIds.length);
      const walls = r.segments.filter(x => x.wallId === s.wallId).length;
      check(`${label}: wall ${s.wallId} within the per-wall cap`, walls <= ML.WALL_MAX, walls);
      const sys = new Set(s.gameIds.map(id => ALL.find(g => g.id === id).systemId));
      check(`${label}: segment ${s.id} is one source system`, sys.size === 1, [...sys].join(','));
    }
    for (const id of r.gameIds) check(`${label}: ${id} appears once`, !seen.has(id) && seen.add(id));
  }
  check(`${label}: every eligible game planned`, seen.size === ALL.length, `${seen.size} of ${ALL.length}`);
  check(`${label}: byGame covers every game`, plan.byGame.size === ALL.length, plan.byGame.size);
}
{
  const p = ML.planMuseum(ALL, { grouping: 'manufacturer' });
  onceEverywhere(p, 'manufacturer');
  const titles = p.rooms.filter(r => r.kind === 'shelves').map(r => r.title);
  check('manufacturer rooms: Nintendo, Microsoft, Other in order', eq([...new Set(titles.map(t => t.split(' · ')[0]))], ['Nintendo', 'Microsoft', 'Other']), titles.join(' | '));
  check('Nintendo 1,250 games → 2 continuation rooms (1,200 + 50)', p.rooms.filter(r => r.title.startsWith('Nintendo')).length === 2 && p.rooms[0].gameIds.length === ML.ROOM_CAP && p.rooms[1].gameIds.length === 1250 - ML.ROOM_CAP, titles.join(' | '));
  const other = p.rooms.find(r => r.id === 'manufacturer:other:0');
  check('unknown system id stays reachable in Other', other && other.gameIds.includes('weird-box:0'));
  check('neogeo is a home console, not arcade', other && other.gameIds.includes('neogeo:0') && !p.rooms.some(r => r.kind === 'arcade' && r.gameIds.includes('neogeo:0')));
  check('arcade rooms carry only arcade-system games', p.rooms.filter(r => r.kind === 'arcade').every(r => r.gameIds.every(id => id.startsWith('arcade:'))));
  check('arcade games grouped by genre, no-genre arcade kept', p.rooms.some(r => r.id === 'arcade:fighting:0') && p.rooms.some(r => r.id === 'arcade:unknown:0'));
  const comp = p.rooms.find(r => r.kind === 'computers');
  check('computers room holds dos, pc and custom', comp && ['dos:0', 'pc:0', 'custom:0'].every(id => comp.gameIds.includes(id)));
  check('a PC game is never classified by console box art', comp && comp.gameIds.includes('pc:0') && !comp.segments.some(s => s.systemId === 'ps2'));
  const x = p.rooms.find(r => r.segments.some(s => s.systemId === 'xboxone'));
  check('alias xone lands on the Microsoft shelf', !!x && x.id === 'manufacturer:microsoft:0');
  check('a Reading & media room always exists', p.rooms.some(r => r.kind === 'media' && r.id === 'media:0'));
  check('locate() finds a game by id', eq(ML.locate(p, 'gc:0'), { roomId: p.rooms[0].id, seg: 0, i: 0 }));
  check('locate() of an unknown game is null', ML.locate(p, 'nope') === null);
  check('roomsForSystem lists both Nintendo rooms', ML.roomsForSystem(p, 'gc').length === 2);
  { // whole-platform atomicity: a big Xbox 360 collection never splits because Xbox took the first room's slots
    const ms = [];
    const put = (n, sys) => { for (let i = 0; i < n; i++) ms.push({ id: `${sys}:${i}`, systemId: sys, primaryGenre: 'Racing', sourceOrder: ms.length }); };
    put(300, 'xbox'); put(1100, 'x360'); put(40, 'xboxone');
    const pm = ML.planMuseum(ms, { grouping: 'manufacturer' });
    const mrooms = pm.rooms.filter(r => r.kind === 'shelves');
    check('Xbox 360 stays whole: its 1,100 games are all in the same room', (() => { const rooms360 = mrooms.filter(r => r.segments.some(s => s.systemId === 'x360')); return rooms360.length === 1 && rooms360[0].segments.filter(s => s.systemId === 'x360').reduce((a, s) => a + s.gameIds.length, 0) === 1100; })(), JSON.stringify(mrooms.map(r => [r.id, r.gameIds.length, r.segments.map(s => s.systemId).join('+')])));
    check('Xbox (300) gets its own room, not one the 360 collection was split around', mrooms.length === 2 && mrooms[0].segments.every(s => s.systemId === 'xbox') && mrooms[0].gameIds.length === 300, JSON.stringify(mrooms.map(r => [r.id, r.gameIds.length])));
  }
}
{
  const p = ML.planMuseum(ALL, { grouping: 'genre' });
  onceEverywhere(p, 'genre');
  check('genre mode: Arcade and Computers are their own categories', p.rooms[0].kind === 'arcade' && p.rooms[1].kind === 'computers', p.rooms.slice(0, 3).map(r => r.kind).join(','));
  check('genre mode: unknown genre bucket exists', p.rooms.some(r => r.id === 'genre:unknown:0' && r.gameIds.includes('pcengine:0')));
  const racing = p.rooms.filter(r => r.id.startsWith('genre:racing:'));
  check('genre mode: shelf systems share a genre room by segment, PC stays out', racing.length === 2 && racing.every(r => r.segments.every(s => s.systemId === 'gc')));
  { // small mixed library: gc and Mega Drive racing games side by side in one room (PC games stay in Computers)
    const p2 = ML.planMuseum([{ id: 'g1', systemId: 'gc', primaryGenre: 'Racing' }, { id: 'p1', systemId: 'megadrive', primaryGenre: 'Racing' }], { grouping: 'genre' });
    const r = p2.rooms.find(x => x.id.startsWith('genre:racing:'));
    check('genre mode: small mixed room keeps one segment per system', r && r.segments.length === 2 && r.segments.some(s => s.systemId === 'gc') && r.segments.some(s => s.systemId === 'megadrive'), r && JSON.stringify(r.segments));
    const c = ML.planMuseum([{ id: 'p1', systemId: 'pc', primaryGenre: 'Racing' }], { grouping: 'genre' });
    check('genre mode: PC games stay in the Computers category', c.rooms.some(x => x.kind === 'computers' && x.gameIds.includes('p1')) && !c.rooms.some(x => x.id.startsWith('genre:racing')));
  }
  check('genre mode: display labels keep their casing', p.rooms.some(r => r.id === 'genre:racing:0' && r.title.startsWith('Racing')));
}
{
  // 10,000 games in one manufacturer; many small systems must not bypass the caps
  const big = []; for (let i = 0; i < 10000; i++) big.push({ id: 'sw' + i, systemId: 'sw', primaryGenre: 'Action', sourceOrder: i });
  const p = ML.planMuseum(big, { grouping: 'manufacturer' });
  const shelf = p.rooms.filter(r => r.kind === 'shelves');
  check('10,000 games: rooms split at the room cap', shelf.length === Math.ceil(10000 / ML.ROOM_CAP), shelf.length);
  check('10,000 games: each room full or the last', shelf.slice(0, -1).every(r => r.gameIds.length === ML.ROOM_CAP) && shelf.at(-1).gameIds.length > 0);
  check('a full room spans all three walls, ML.WALL_MAX shelves each', eq([...new Set(shelf[0].segments.map(s => s.wallId))], ['back', 'left', 'right']) && shelf[0].segments.filter(s => s.wallId === 'back').length === ML.WALL_MAX);
  const tiny = []; ['pcengine', 'neogeo', 'ngp', 'ngpc', 'wonderswan', 'gamecom', 'atari2600', 'atarilynx', 'segacd', 'sega32x', 'saturn', 'gamegear', 'mastersystem', 'dreamcast'].forEach(s => { for (let k = 0; k < 3; k++) tiny.push({ id: `${s}${k}`, systemId: s, primaryGenre: null, sourceOrder: k }); });
  const p2 = ML.planMuseum(tiny, { grouping: 'manufacturer' });
  check('14 tiny systems: game cap AND segment cap both bind', p2.rooms.filter(r => r.kind === 'shelves').every(r => r.segments.length <= ML.SEGMENTS_MAX && r.gameIds.length <= ML.ROOM_CAP));
  const many = []; for (let i = 0; i < 40; i++) for (let k = 0; k < 3; k++) many.push({ id: `m${i}_${k}`, systemId: 'sys' + i, primaryGenre: null, sourceOrder: many.length });
  const p3 = ML.planMuseum(many, { grouping: 'manufacturer' });
  check('40 systems of 3 games: segment count triggers continuation rooms', p3.rooms.filter(r => r.kind === 'shelves').length === Math.ceil(40 / ML.SEGMENTS_MAX), p3.rooms.filter(r => r.kind === 'shelves').length);
}
{
  // arcade overflow: one genre with more cabinets than ARCADE_CAP continues into another room
  const cab = []; for (let i = 0; i < 310; i++) cab.push({ id: `arc${i}`, systemId: 'arcade', primaryGenre: 'Fighting', sourceOrder: i });
  const pa = ML.planMuseum(cab, { grouping: 'manufacturer' });
  const arcade = pa.rooms.filter(r => r.kind === 'arcade');
  check('310 same-genre arcade cabinets split into continuation rooms of ≤ ARCADE_CAP', arcade.length === 2 && arcade.every(r => r.gameIds.length <= ML.ARCADE_CAP) && arcade.reduce((a, r) => a + r.gameIds.length, 0) === 310, JSON.stringify(arcade.map(r => r.gameIds.length)));
  const pg = ML.planMuseum(cab, { grouping: 'genre' });
  const gen = pg.rooms.filter(r => r.kind === 'arcade');
  check('genre mode splits an over-cap arcade genre the same way', gen.length === 2 && gen.every(r => r.gameIds.length <= ML.ARCADE_CAP), JSON.stringify(gen.map(r => r.gameIds.length)));
  check('empty library: no rooms but media', eq(ML.planMuseum([], { grouping: 'genre' }).rooms.map(r => r.id), ['media:0']));
  const one = ML.planMuseum([{ id: 'a', systemId: 'nes' }], { grouping: 'manufacturer' });
  check('one game: one room plus media', one.rooms.filter(r => r.gameIds.length).length === 1 && one.rooms.length === 2);
  check('missing system id lands in Other', ML.planMuseum([{ id: 'x', systemId: undefined }], { grouping: 'manufacturer' }).rooms.some(r => r.id === 'manufacturer:other:0' && r.gameIds.includes('x')));
  check('missing primary genre lands in the Unknown bucket', ML.planMuseum([{ id: 'y', systemId: 'nes' }], { grouping: 'genre' }).rooms.some(r => r.id === 'genre:unknown:0'));
  check('duplicate shelf representation is planned once', (() => { const p = ML.planMuseum([{ id: 'a', systemId: 'nes' }, { id: 'a', systemId: 'nes' }], { grouping: 'manufacturer' }); return p.byGame.size === 1 && p.rooms.reduce((s, r) => s + r.gameIds.length, 0) === 1; })());
  check('genre keys ignore case and extra whitespace', ML.genreKeyOf('Racing  Game') === 'racing game' && ML.genreKeyOf(' racing ') === 'racing');
  check('mixed-case and spaced genres share a room', (() => { const p = ML.planMuseum([{ id: 'a', systemId: 'nes', primaryGenre: 'Racing' }, { id: 'b', systemId: 'gc', primaryGenre: ' racing ' }], { grouping: 'genre' }); return p.rooms.some(r => r.gameIds.length === 2); })());
  check('planner does not mutate its input', eq(ALL, GAMES));
}
{
  // no DOM / WebGL allocation: the factory must run in plain Node (it does, above) and never touch the DOM or THREE
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'shared', 'museum-layout.js'), 'utf8');
  check('planner has no DOM or WebGL references', !/document\./.test(src) && !/new THREE/.test(src) && !/createElement/.test(src));
}

// ---------- config: new vs existing users, restart, malformed values ----------
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-museum-'));
cfg.init(dir, () => {});
(async () => {
{
  // a config file from before the grouping key existed keeps the Classic wall
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ setupDone: true, ui: { museumStyle: { walkIn: false } } }));
  const c = cfg.load();
  check('existing config without grouping keeps classic', c.ui.museumStyle.grouping === 'classic', c.ui.museumStyle.grouping);
  check('existing config keeps its own walkIn', c.ui.museumStyle.walkIn === false);
  await cfg.save(c); await cfg.flush();
}
{
  // restart: the saved choice survives a reload
  const c = cfg.load();
  check('restart: grouping survives save and reload', c.ui.museumStyle.grouping === 'classic');
  c.ui.museumStyle.grouping = 'genre';
  await cfg.save(c); await cfg.flush();
  const c2 = cfg.load();
  check('restart: a chosen grouping is kept', c2.ui.museumStyle.grouping === 'genre');
}
{
  // malformed values: dropped on load (sanitize), so the renderer's fallback applies
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ setupDone: true, ui: { museumStyle: { grouping: 'bogus', walkIn: true } } }));
  const c = cfg.load();
  check('malformed grouping is dropped', c.ui.museumStyle.grouping === 'classic', c.ui.museumStyle.grouping);
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ setupDone: true, ui: { museumStyle: 'junk' } }));
  const c2 = cfg.load();
  check('a museumStyle of the wrong shape falls back safely', c2.ui.museumStyle && typeof c2.ui.museumStyle === 'object' && c2.ui.museumStyle.grouping === 'classic', JSON.stringify(c2.ui.museumStyle));
}
{
  // normalize() (settings saves): same shape rules as a loaded file
  const n = cfg.normalize({ ui: { museumStyle: { grouping: 'manufacturer' } } });
  check('normalize: valid grouping kept', n.ui.museumStyle.grouping === 'manufacturer');
  const n2 = cfg.normalize({ ui: { museumStyle: { grouping: 42 } } });
  check('normalize: invalid grouping falls back to classic', n2.ui.museumStyle.grouping === 'classic');
}
{
  // new install (no file): manufacturer
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-museum-new-'));
  cfg.init(dir2, () => {});
  const d = cfg.load();
  check('new install defaults to manufacturer', d.ui.museumStyle.grouping === 'manufacturer');
  fs.rmSync(dir2, { recursive: true, force: true });
}
fs.rmSync(dir, { recursive: true, force: true });

// ---------- Android defaultConfig (read from the source, as copy-web ships it) ----------
{
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'android-app', 'web-extras', 'android-api.js'), 'utf8');
  check('Android new installs default to manufacturer', /defaultConfig\(\)[\s\S]{0,900}grouping: 'manufacturer'/.test(src));
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
})();
