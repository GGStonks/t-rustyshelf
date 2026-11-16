// Museum room planning, shared by the renderer, the main process' tests and Android: a pure module with no Electron,
// DOM or THREE in it. Given the museum's games as plain entries ({ id, systemId, primaryGenre, sourceOrder }), it works
// out the rooms (manufacturer or genre grouping), their walls and shelf segments, and where every game lives.
// Classification uses canonical source-system IDs only — never translated names, emulator names, publishers or file
// extensions — and a PC game's console box art says nothing about it.
// Every eligible game occurs exactly once in the plan; overflow makes another room, never a truncation.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.BSMuseumLayout = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // ---- room budgets (numbers the museum is sized around; measured, not free) ----
  // A console/computer room holds at most ROOM_CAP games across at most SEGMENTS_MAX shelf segments; a segment holds at
  // most SEGMENT_MAX cases and belongs to one source system. The segments stand on three walls, WALL_MAX each. The caps
  // are sized so one platform's whole collection fits a single room: Xbox 360 alone has 1,000+ titles (1200 = 30
  // segments × 40 cases over the three walls), like the old single wall showed a 2,100-game library at once.
  // An arcade room holds at most ARCADE_CAP cabinets (a big MAME-style library still continues into further rooms).
  // Both the game count and the segment count trigger continuation rooms, so many small systems never slip past the limits.
  const ROOM_CAP = 1200, SEGMENT_MAX = 40, SEGMENTS_MAX = 30, WALLS = 3, WALL_MAX = 10, ARCADE_CAP = 300;
  // The reading & media room's display capacity (magazines, guides and movies shown on its ledges): the rest keep
  // working through search and the fans, the way a full rack already behaves.
  const MEDIA_CAP = 2000;

  // ---- manufacturer rooms: canonical system ID → maker group ----
  const MANUFACTURERS = {
    nintendo: ['gc', 'wii', 'wiiu', 'sw', 'sw2', 'nes', 'snes', 'n64', 'gb', 'gbc', 'gba', 'nds', 'n3ds'],
    sony: ['psx', 'ps2', 'ps3', 'ps4', 'ps5', 'psp', 'psvita'],
    sega: ['megadrive', 'mastersystem', 'gamegear', 'dreamcast', 'saturn', 'segacd', 'sega32x'],
    atari: ['atari2600', 'atarilynx'],
    microsoft: ['xbox', 'x360', 'xboxone']
  };
  // Rooms in display order. Other (pcengine, neogeo, ngp, ngpc, wonderswan, game.com and anything unrecognised) keeps
  // everything reachable; computers and arcade are their own rooms, never part of a maker.
  const MAKER_ORDER = ['nintendo', 'sony', 'sega', 'microsoft', 'atari', 'other'];
  const MAKER_TITLES = { nintendo: 'Nintendo', sony: 'Sony', sega: 'Sega', microsoft: 'Microsoft', atari: 'Atari', other: 'Other' };
  const MAKER_KEYS = {}; // systemId → maker, for lookup
  Object.keys(MANUFACTURERS).forEach(mk => MANUFACTURERS[mk].forEach(id => { MAKER_KEYS[id] = mk; }));
  // Arcade (the arcade shelf's own games) and computers (DOS, PC programs and the Custom shelf) are separate categories.
  const SYSTEM_ARCADE = 'arcade', SYSTEM_DOS = 'dos', SYSTEM_PC = 'pc', SYSTEM_CUSTOM = 'custom';
  const COMPUTERS = [SYSTEM_DOS, SYSTEM_PC, SYSTEM_CUSTOM];
  // Known aliases other adapters may one day supply. Only a real adapter's ID belongs here; an unknown ID falls back
  // to the Other room instead of being guessed.
  const ALIASES = { xone: 'xboxone', xsx: 'xboxone' };

  function systemOf(systemId) { return systemId == null ? null : ALIASES[String(systemId)] || String(systemId); }
  function makerOf(systemId) { const s = systemOf(systemId); return s == null ? null : MAKER_KEYS[s] || 'other'; } // unknown → Other, still on a shelf
  function isComputer(systemId) { return COMPUTERS.includes(systemOf(systemId)); }
  function isArcade(systemId) { return systemOf(systemId) === SYSTEM_ARCADE; }
  // home-console Neo Geo games are not arcade: the data doesn't reliably tell the two apart
  function kindOf(systemId) { return isArcade(systemId) ? 'arcade' : isComputer(systemId) ? 'computers' : 'shelves'; }

  // ---- genre rooms: the existing info.genres convention (semicolon-separated, first is primary) ----
  // Key: lowercase, whitespace-collapsed; the display label keeps the original casing. No primary genre → Unknown.
  function genreKeyOf(primaryGenre) {
    const s = String(primaryGenre == null ? '' : primaryGenre).trim();
    return s ? s.toLowerCase().replace(/\s+/g, ' ') : ''; // '' = Unknown
  }
  const UNKNOWN_LABEL = 'Unknown';
  function genreLabel(key, primary) { const s = String(primary == null ? '' : primary).trim(); return s ? s : UNKNOWN_LABEL; }

  // ---- the plan ----
  // entries: [{ id, systemId, primaryGenre, sourceOrder }] in the shelf's own order. Nothing is read or changed on them.
  // opts: { grouping: 'manufacturer' | 'genre' } (classic never calls this module: it keeps the old single wall).
  // → { rooms, byGame }
  //   room: { id, groupKey, kind ('shelves'|'arcade'|'computers'|'media'), title, part, parts, gameIds, segments,
  //           themeKey }
  //   segment: { id, systemId, gameIds, wallId ('back'|'left'|'right'), row, kind } — one system per segment, so case
  //   sizes, console exhibits and launch identity stay right. row counts segments on the wall (0…WALL_MAX-1).
  //   byGame: Map gameId → { roomId, seg, i } — selection is restored by game ID, never by a room ordinal.
  function planMuseum(entries, opts) {
    const grouping = opts && opts.grouping === 'genre' ? 'genre' : 'manufacturer';
    const list = (entries || []).map(e => e).filter(Boolean);
    const rooms = [], byGame = new Map();
    const seen = new Set(); // the exactly-once guarantee

    // buckets: { key, title, themeKey, kind, games: [entry…] }, grouped by maker / genre, each keeping source order
    const buckets = [];
    const bucketOf = new Map();
    const bucket = (key, title, kind, themeKey) => { let b = bucketOf.get(key); if (!b) { b = { key, title, kind, themeKey, games: [] }; bucketOf.set(key, b); buckets.push(b); } return b; };

    list.forEach((e, i) => {
      const id = String(e.id);
      if (seen.has(id)) return; // duplicate shelf representation: first occurrence wins (the planner never duplicates)
      seen.add(id);
      const sys = systemOf(e.systemId);
      if (grouping === 'genre') {
        if (isArcade(sys)) bucket('genre:arcade', 'Arcade', 'arcade', 'genre:arcade').games.push(e);
        else if (isComputer(sys)) bucket('genre:computers', 'Computers', 'computers', 'genre:computers').games.push(e);
        else { const gk = genreKeyOf(e.primaryGenre) || 'unknown'; bucket('genre:' + gk, genreLabel(gk, e.primaryGenre), 'shelves', 'genre:' + gk).games.push(e); }
      } else {
        if (isArcade(sys)) { const gk = genreKeyOf(e.primaryGenre) || 'unknown'; bucket('arcade:' + gk, gk === 'unknown' ? 'Arcade' : 'Arcade · ' + genreLabel(gk, e.primaryGenre), 'arcade', 'arcade').games.push(e); }
        else if (isComputer(sys)) bucket('computers:0', 'Computers', 'computers', 'computers').games.push(e);
        else { const mk = makerOf(sys) || 'other'; bucket('manufacturer:' + mk, MAKER_TITLES[mk], 'shelves', mk).games.push(e); }
      }
    });

    // buckets keep a stable order: makers in MAKER_ORDER, then arcade, then computers (manufacturer grouping);
    // genres alphabetical with Unknown last, arcade and computers first (genre grouping)
    if (grouping === 'manufacturer') buckets.sort((a, b) => rank(a) - rank(b) || nat(a.title, b.title));
    else buckets.sort((a, b) => rank(a) - rank(b) || nat(a.title, b.title));
    function rank(b) {
      if (grouping === 'genre') { if (b.key === 'genre:arcade') return 0; if (b.key === 'genre:computers') return 1; if (b.key === 'genre:unknown') return 3; return 2; }
      // makers in their order, then the arcade, then computers, then the media room (pushed last below)
      if (b.kind === 'arcade') return MAKER_ORDER.length;
      if (b.kind === 'computers') return MAKER_ORDER.length + 1;
      return MAKER_ORDER.indexOf(b.key.slice('manufacturer:'.length));
    }

    buckets.forEach(b => packBucket(b, rooms, byGame));
    const media = { id: 'media:0', groupKey: 'media', kind: 'media', title: 'Reading & media', part: 0, parts: 1, gameIds: [], segments: [], themeKey: 'media' };
    rooms.push(media);
    return { rooms, byGame };
  }

  const nat = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });

  // pack one bucket into rooms: systems (in source order) into per-system segments, segments into rooms up to the
  // game cap and the segment cap. A system's games never share a segment with another system's.
  function packBucket(b, rooms, byGame) {
    const groupKey = b.kind === 'arcade' ? 'arcade' : b.kind === 'computers' ? 'computers' : b.key;
    // group the bucket's games by system, keeping the order they appear in
    const bySys = [];
    const at = new Map();
    b.games.forEach(e => {
      const sys = systemOf(e.systemId) || 'other'; // a missing system still lands somewhere (Other)
      let g = at.get(sys);
      if (!g) { g = { sys, games: [] }; at.set(sys, g); bySys.push(g); }
      g.games.push(e);
    });
    // pack segments into rooms: the room's own cap (arcade cabinets: ARCADE_CAP; shelves/computers: the game cap) and
    // the segment cap both bind, so many small systems still split. A source system is packed ATOMICALLY: its segments
    // never straddle a room that couldn't hold the whole system — a platform's entire collection is together in one
    // room (only a system larger than the room cap itself continues, into rooms of its own).
    const roomCap = b.kind === 'arcade' ? ARCADE_CAP : ROOM_CAP;
    let room = null, gameCount = 0, segCount = 0, part = -1;
    const newRoom = () => {
      part++;
      room = { id: `${b.key}:${part}`, bucketKey: b.key, groupKey, kind: b.kind, title: b.title, part, parts: 0, gameIds: [], segments: [], themeKey: b.themeKey };
      gameCount = 0; segCount = 0; rooms.push(room);
    };
    const put = seg => {
      const wallId = ['back', 'left', 'right'][Math.floor(segCount / WALL_MAX)] || 'back';
      const row = segCount % WALL_MAX;
      const s = { id: `${room.id}:s${segCount}`, systemId: seg.sys, gameIds: [], wallId, row, kind: b.kind === 'shelves' ? 'shelves' : 'cabinets' };
      seg.games.forEach(e => { const id = String(e.id); s.gameIds.push(id); room.gameIds.push(id); byGame.set(id, { roomId: room.id, seg: room.segments.length, i: s.gameIds.length - 1 }); });
      room.segments.push(s); gameCount += seg.games.length; segCount++;
    };
    newRoom();
    bySys.forEach(g => {
      const segs = Math.ceil(g.games.length / SEGMENT_MAX);
      if (gameCount && (gameCount + g.games.length > roomCap || segCount + segs > SEGMENTS_MAX)) newRoom(); // the whole system moves to a fresh room
      g.games.forEach((x, i) => { if (i % SEGMENT_MAX === 0 && i && (segCount >= SEGMENTS_MAX || gameCount + Math.min(SEGMENT_MAX, g.games.length - i) > roomCap)) newRoom(); if (i % SEGMENT_MAX === 0) put({ sys: g.sys, games: g.games.slice(i, i + SEGMENT_MAX) }); }); // (a system larger than a whole room: its own rooms, one after another)
    });
    // every room of this bucket says which part it is ("Nintendo · 2 of 3"); a lone room keeps its plain title
    const mine = rooms.filter(r => r.bucketKey === b.key);
    mine.forEach(r => { r.parts = mine.length; r.part = mine.indexOf(r); if (mine.length > 1) r.title = `${b.title} · ${r.part + 1} of ${mine.length}`; });
  }

  // where a game lives now (selection restore): byGame.get(String(id)) → { roomId, seg, i } | undefined
  function locate(plan, gameId) { return plan && plan.byGame.get(String(gameId)) || null; }

  // which rooms carry a system's games (openMuseum(systemId) consumers): room IDs with one of that system's segments
  function roomsForSystem(plan, systemId) {
    const sys = systemOf(systemId); if (sys == null || !plan) return [];
    return plan.rooms.filter(r => r.segments.some(s => s.systemId === sys)).map(r => r.id);
  }

  return {
    ROOM_CAP, SEGMENT_MAX, SEGMENTS_MAX, WALLS, WALL_MAX, ARCADE_CAP, MEDIA_CAP,
    MANUFACTURERS, MAKER_ORDER, MAKER_TITLES, COMPUTERS,
    makerOf, isComputer, isArcade, kindOf, systemOf,
    genreKeyOf, UNKNOWN_LABEL,
    planMuseum, locate, roomsForSystem
  };
});
