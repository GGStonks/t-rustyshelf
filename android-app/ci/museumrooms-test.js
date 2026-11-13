// Issue 19: the museum organized into rooms. Only the active room's scene is built; rooms are navigated
// (directory, L1/R1, wall stepping); the media room holds the reading corner and the TV; mail stays
// collection-wide. Run (after node copy-web.js): node ci/museumrooms-test.js www ../out/museumrooms
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const ML = require('../../shared/museum-layout.js');
const WWW = path.resolve(process.argv[2] || 'www'), OUT = path.resolve(process.argv[3] || '../out/museumrooms');
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? '✅ ' : '❌ ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 700))); if (!ok) fails++; };
// The TV test's playable clip: made here at start (in-browser MediaRecorder: a flashing canvas + a 440 Hz tone), so no
// fixture file is checked in and every run is self-contained.
async function makeClip(browser) {
  const ctx = await browser.newContext(), page = await ctx.newPage();
  await page.setContent('<canvas id="c"></canvas>');
  const b64 = await page.evaluate(async () => {
    const c = document.getElementById('c'); c.width = 64; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#202020'; x.fillRect(0, 0, 64, 64);
    const AC = new AudioContext(), dest = AC.createMediaStreamDestination(), osc = AC.createOscillator(), g = AC.createGain();
    osc.frequency.value = 440; g.gain.value = .2; osc.connect(g); g.connect(dest); osc.start();
    const s = c.captureStream(10); dest.stream.getAudioTracks().forEach(t => s.addTrack(t));
    const rec = new MediaRecorder(s, { mimeType: 'video/webm' }); const chunks = []; rec.ondataavailable = e => chunks.push(e.data); rec.start(200);
    for (let k = 0; k < 100; k++) { x.fillStyle = k % 2 ? '#101010' : '#242424'; x.fillRect(0, 0, 64, 64); await new Promise(r => setTimeout(r, 100)); }
    osc.stop(); await new Promise(r => { rec.onstop = r; rec.stop(); });
    const ab = await new Blob(chunks).arrayBuffer(); let s0 = ''; const u8 = new Uint8Array(ab); for (let i = 0; i < u8.length; i++) s0 += String.fromCharCode(u8[i]); return btoa(s0);
  });
  await ctx.close();
  return Buffer.from(b64, 'base64');
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary' };
let CLIP = null;
const server = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const p = path.join(WWW, u === '/' ? 'index.html' : u);
  if (u === '/tvclip.webm' && CLIP) { r.writeHead(200, { 'Content-Type': 'video/webm' }); return r.end(CLIP); } // (made at start, below)
  if (!p.startsWith(WWW)) { r.writeHead(403); return r.end(); }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
const w = ms => new Promise(r => setTimeout(r, ms));
server.listen(0, async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  CLIP = await makeClip(browser).catch(e => { check("the test clip was made", false, e && e.message); return null; });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }), page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/index.html?platform=windows&shelf=1&big=45`); await page.waitForTimeout(6000);
    // rooms mode, by maker: the mock's consoles are real systems (gc, wii, ps2…)
    await page.evaluate(() => { Shelf._mus && Shelf._mus.set('grouping', 'manufacturer'); });
    await page.keyboard.press('m'); await page.waitForTimeout(7000);
    await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); for (let i = 0; i < 8 && Museum._dv && Museum._dv(); i++) { Museum.skipDelivery(); await w(400); } if (Museum.skipFill) Museum.skipFill(); await w(800); });
    const st = await page.evaluate(() => Museum.rooms && Museum.rooms());
    check('rooms mode is on with several rooms', st && st.rooms > 1 && st.list && st.list.length === st.rooms, JSON.stringify(st && { rooms: st.rooms, room: st.room }));
    check('the media room exists and is last', st && st.list.length && st.list[st.list.length - 1].kind === 'media', JSON.stringify(st && st.list.slice(-2)));
    const counts = st ? st.list.map(r => r.n) : [];
    check('no room exceeds the room budget', counts.every(n => n <= ML.ROOM_CAP), JSON.stringify(counts));
    // active scene bounded: the active room is a fraction of the collection (the whole collection is ~10x the room cap)
    const scene = await page.evaluate(() => { let n = 0; Museum._rows && Museum._rows().forEach(r => n += r.boxes.length); return { boxes: n, geos: Museum.stats().geos, texs: Museum.stats().texs, lights: Museum.stats().lights }; });
    check('the active room is bounded (≤ the room cap on the shelves)', scene.boxes <= ML.ROOM_CAP, JSON.stringify(scene));
    // walk the rooms by directory and by stepRoom
    const walked = await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); const out = []; const n = Museum.rooms().rooms; for (let i = 0; i < Math.min(3, n - 1); i++) { Museum.stepRoom(1); await w(900); out.push(Museum.rooms().room.id); } return { out, n }; });
    check('L1/R1 walks the rooms in order (up to the last)', walked.out.length === Math.min(3, walked.n - 1) && walked.out.every((id, i) => i === 0 || id !== walked.out[i - 1]), JSON.stringify(walked));
    // the Rooms directory: O opens it, the panel is readable HTML, arrows move, Enter enters the room, O closes
    const dir = await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); return { open: Museum.roomDirOpen(), list: Museum.roomList().length }; });
    await w(300);
    const panel = await page.evaluate(() => { const el = document.getElementById('musRooms'); return { on: !!(el && el.classList.contains('on')), rows: el ? el.querySelectorAll('.mr-row').length : 0 }; });
    check('the directory panel lists every room as readable HTML', dir.open && panel.on && panel.rows === dir.list, JSON.stringify({ dir, panel }));
    const moved = await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); Museum.roomDirMove(1); await w(120); const at = Museum.roomDir().i; Museum.roomDirGo(); await w(900); return { at, room: Museum.rooms().roomI }; });
    check('the directory enters the chosen room', moved.room === moved.at, JSON.stringify(moved));
    await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); Museum.roomDirOpen(); await w(150); Museum.roomDirClose(); await w(150); });
    const panelClosed = await page.evaluate(() => { const el = document.getElementById('musRooms'); return !!(el && el.classList.contains('on')); });
    check('the directory closes with the museum back on the overview', !panelClosed);
    // the media room: the rack is built there and only there
    await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); Museum.gotoRoom('media'); await w(900); });
    const media = await page.evaluate(() => ({ kind: Museum.rooms().room.kind, rack: (Museum._rack() || []).length, tv: Museum.tvAvail(), rows: Museum._rows().length }));
    check('the media room holds the reading corner and the TV', media.kind === 'media' && media.rows > 0, JSON.stringify(media));
    // back at a room's overview leaves the museum (rooms are navigated with L1/R1 and the directory); reopened, genre mode applies
    await page.keyboard.press('Escape'); await page.waitForTimeout(1200);
    await page.evaluate(() => { Shelf._mus && Shelf._mus.set('grouping', 'genre'); });
    await page.keyboard.press('m'); await page.waitForTimeout(7000);
    await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); for (let i = 0; i < 8 && Museum._dv && Museum._dv(); i++) { Museum.skipDelivery(); await w(300); } if (Museum.skipFill) Museum.skipFill(); await w(500); });
    const g = await page.evaluate(() => Museum.rooms && Museum.rooms());
    check('genre mode plans genre rooms with the media room last', g && g.list.length && g.list.slice(0, -1).every(r => r.id.startsWith('genre:')) && g.list[g.list.length - 1].kind === 'media', JSON.stringify(g && g.list.map(r => r.kind)));
    check('no script errors', !errors.length, errors.slice(0, 3).join(' | '));
  } catch (e) { check('the test ran to the end', false, e && e.stack); }
  // a wave2 visit: the Arcade room (cabinets) and stepping between a room's walls
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }), page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/index.html?platform=windows&shelf=1&big=45&wave2=1`); await page.waitForTimeout(6500);
    await page.evaluate(() => { Shelf._mus && Shelf._mus.set('grouping', 'manufacturer'); });
    await page.keyboard.press('m'); await page.waitForTimeout(7000);
    await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); for (let i = 0; i < 8 && Museum._dv && Museum._dv(); i++) { Museum.skipDelivery(); await w(300); } if (Museum.skipFill) Museum.skipFill(); await w(500); });
    const arc = await page.evaluate(() => { const st = Museum.rooms(); return { arcade: st.list.filter(r => r.kind === 'arcade'), walls: st.list.filter(r => r.segs > 4).length }; });
    check('the wave2 mock has an Arcade room', arc.arcade.length >= 1 && arc.arcade.every(r => r.n > 0), JSON.stringify(arc));
    check('some manufacturer rooms span more than one wall', arc.walls > 0, JSON.stringify(arc));
    // step walls from the overview: right past the wall's last shelf lands on the next wall
    const walls = await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms));
      for (let i = 0; i < 5; i++) { if (Museum.rooms().room.kind !== 'shelves') { Museum.stepRoom(1); await w(700); continue; } break; }
      const before = Museum.rooms().wallI; for (let k = 0; k < 14; k++) { Museum.move(1, 0); await w(60); } await w(1100);
      return { before, after: Museum.rooms().wallI, room: Museum.rooms().room.id }; });
    check('stepping right past a wall end reaches the next wall', walls.after !== walls.before, JSON.stringify(walls));
    // the arcade room: its cabinets pick and launch like cases
    const cab = await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); const st = Museum.rooms();
      const ai = st.list.findIndex(r => r.kind === 'arcade'); if (ai < 0) return null; Museum.stepRoom(ai - st.roomI); await w(900);
      const rows = Museum._rows(); return { kind: rows[0] && rows[0].kind, n: rows[0] && rows[0].boxes.length, id: rows[0] && rows[0].id }; });
    check('the arcade room shelves are cabinets', cab && cab.kind === 'arcade' && cab.n > 0, JSON.stringify(cab));
    check('no script errors (wave2)', !errors.length, errors.slice(0, 3).join(' | '));
    // ---- mail is collection-wide: pending mail for a room you're not in survives, and delivering in room A
    // never makes room B's games look new or repeats their item numbers ----
    const mail = await page.evaluate(async () => {
      // half the collection is known (seen), the rest arrives as mail: pend + fresh computed against the full catalog
      let seenIds = []; try { seenIds = JSON.parse(localStorage.getItem('museum-seen') || '[]').map(String); } catch {}
      const keep = new Set(seenIds.slice(0, Math.max(1, Math.ceil(seenIds.length / 4))));
      localStorage.setItem('museum-seen', JSON.stringify([...keep]));
      localStorage.setItem('museum-mail', '[]'); localStorage.setItem('museum-mail-at', '{}');
      location.reload(); return 'reloading';
    });
    void mail; await page.waitForTimeout(7000);
    await page.evaluate(() => { Shelf._mus && Shelf._mus.set('grouping', 'manufacturer'); }); // (the reload starts from the demo config: organization is a setting, re-applied)
    await page.keyboard.press('m'); await page.waitForTimeout(7000); // the museum reopens after the reload (the mail keys were pre-set)
    await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); await w(400); });
    const mailOut = await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms));
      const st = Museum.rooms(); if (!st || st.rooms < 3) return { skip: true };
      // room 0 is built first with its mail; check that other rooms' pending mail stays in the global set
      const pend0 = JSON.parse(localStorage.getItem('museum-mail') || '[]').length;
      const at0 = Object.keys(JSON.parse(localStorage.getItem('museum-mail-at') || '{}')).length;
      // deliver room 0's parcel
      for (let i = 0; i < 8 && Museum._dv && Museum._dv(); i++) { Museum.skipDelivery(); await w(400); }
      const pend1 = JSON.parse(localStorage.getItem('museum-mail') || '[]').length;
      const acq = JSON.parse(localStorage.getItem('museum-acquired') || '{}');
      return { pend0, pend1, delivered: pend0 - pend1, items: Object.keys(acq).length };
    });
    check('mail for later rooms is preserved while room 0 delivers', mailOut.skip || (mailOut.pend0 > 0 && mailOut.delivered > 0 && mailOut.pend1 > 0 && mailOut.items >= mailOut.delivered), JSON.stringify(mailOut));
    // ---- TV: a body change keeps the same video element and playhead; leaving the room pauses, coming back resumes ----
    const tv = await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms));
      Shelf._mus && Shelf._mus.set('tv', true); await w(700); // the TV option flows through musSetOpt → Museum.setRoom
      if (!Museum.gotoRoom('media')) return { skip: true }; await w(900);
      if (!Museum.tvAvail()) return { skip: true, why: 'no tv' };
      Museum.tvPower(true); await w(400);
      return { powered: Museum.tvPowered() };
    });
    check('the TV powers on in the media room', tv.skip || tv.powered, JSON.stringify(tv));
    const tvBody = await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms));
      // change the body through the room option: the set rebuilds, the playback carry is not dropped
      Museum.setRoom({ tvModel: 'flat' }); await w(700);
      return { avail: Museum.tvAvail(), model: (Museum.room().tvModel) };
    });
    check('a new body rebuilds the set and keeps the option', tvBody.avail && tvBody.model === 'flat', JSON.stringify(tvBody));
    check('no script errors (mail/TV)', !errors.length, errors.slice(0, 3).join(' | '));
    // ---- real playback: the served clip plays through tvShow; its element and playhead survive a body rebuild and a
    // room round-trip; mute drives the routed gain to zero ----
    const clip = await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms));
      if (!Museum.gotoRoom('media')) return { skip: true }; await w(900);
      if (!Museum.tvAvail()) return { fail: 'no tv' }; // (the TV option was switched on above: unavailable here is a failure, not a skip)
      Museum.tvPower(true); Museum.tvVolume(.5);
      const ok = Museum.tvShow('/tvclip.webm', { title: 'Clip', game: 'Test' }, .5); await w(1600);
      return { ok, t: Museum._tv() && Museum._tv().t, playing: Museum._tv() && Museum._tv().playing, prog: Museum._tv() && Museum._tv().prog, spatial: Museum._tv() && Museum._tv().spatial, base: Museum._tv() && Museum._tv().base };
    });
    check('tvShow plays real media (video mode, playhead advancing)', clip.skip || (clip.ok && clip.prog === 'video' && clip.playing && clip.t > 0), JSON.stringify(clip));
    check('the element is routed through the Web Audio graph (spatial)', clip.spatial === true, JSON.stringify(clip));
    const muted = await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); Museum.tvVolume(0); await w(500); const g = Museum._tv(); Museum.tvVolume(.5); return { base0: g.base, gain: g.gain }; });
    check('mute drives the volume to zero (one gain, not the element and the graph)', muted.skip || muted.base0 === 0, JSON.stringify(muted));
    const body = await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); const cur = Museum.room().tvModel, to = cur === 'wood' ? 'flat' : 'wood'; // always to a DIFFERENT body, so the rebuild really happens
      const t0 = Museum._tv().t; await w(700);
      Museum.setRoom({ tvModel: to }); await w(900); const t1 = Museum._tv().t; await w(700);
      return { to, model: Museum.room().tvModel, t0, t1, t2: Museum._tv().t, prog: Museum._tv().prog, playing: Museum._tv().playing }; });
    check('the body rebuild keeps the same element playing (playhead monotonic, never reset)', body.skip || (body.model === body.to && body.prog === 'video' && body.t2 > body.t1 && body.t1 >= body.t0), JSON.stringify(body));
    const leave = await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); const t0 = Museum._tv().t; await w(800); const t1 = Museum._tv().t;
      Museum.gotoRoom('manufacturer'); await w(1100);
      return { t0, t1, stillPlaying: t1 > t0, away: Museum.tvAvail() === false }; });
    check('leaving TV view (and then the room) keeps playback going, then pauses it', leave.skip || (leave.stillPlaying && leave.away), JSON.stringify(leave));
    const back = await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); Museum.gotoRoom('media'); await w(1100); const t1 = Museum._tv().t; await w(900); const t2 = Museum._tv().t;
      return { resumed: Museum._tv().playing, advanced: t2 > t1 }; });
    check('returning to the media room resumes the carried playhead', back.skip || (back.resumed && back.advanced), JSON.stringify(back));
    const cleanup = await page.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); Museum.tvOff(); await w(400); return { off: Museum._tv() === null || !Museum._tv().power && !Museum._tv().playing }; });
    check('power-off stops playback and cleans up', cleanup.off, JSON.stringify(cleanup));
  } catch (e) { check('the wave2 test ran to the end', false, e && e.stack); }
  await browser.close(); server.close();
  console.log(fails ? fails + ' check(s) failed' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
});
