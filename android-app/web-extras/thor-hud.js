// Thor checkpoint meter (Android build only; copy-web.js adds it to www/, the shared renderer never loads it).
// Shows: time until the shelf is on screen, FPS, slow frames, worst frame, memory, controller, the app's own work (from
// perf-meter.js: wake-ups, main-thread time and draw calls a second, frames drawn while idle) and the results of
// Settings → System → Smoothness test. Tap it: big → small (fps only) → hidden → big. Hidden, it stops completely (no
// frame loop of its own) and stays hidden next time. Screenshot it to share the numbers.
(function () {
  const t0 = performance.now(), nav = performance.timeOrigin;
  const box = document.createElement('div');
  box.id = 'thorHud';
  const CSS = 'position:fixed;left:8px;bottom:84px;z-index:2147483647;font:12px/1.35 ui-monospace,monospace;color:#d6ffe0;' +
    'background:rgba(0,0,0,.72);border:1px solid rgba(120,255,160,.35);border-radius:8px;padding:6px 9px;pointer-events:auto;' +
    'max-width:46vw;white-space:pre-wrap;contain:content', HIDDEN_CSS = ';opacity:.35;padding:2px 7px;font-size:10px';
  box.style.cssText = CSS;
  const STATES = ['big', 'small', 'hidden'];
  let view = 'big'; try { const v = localStorage.getItem('bsThorHud'); if (STATES.includes(v)) view = v; } catch {}
  let shelfAt = 0, frames = 0, lastSec = performance.now(), fps = 0, gaps = [], prev = 0, worst5 = 0, slow = 0, total = 0, looping = false;
  const smooth = [], pad = { id: '', last: '' }, errs = [];
  const raf = (window.BS_METER && BS_METER.raf) || requestAnimationFrame.bind(window); // its own loop isn't counted as the app's work
  addEventListener('error', e => { errs.push(String(e.message || e.error || 'error').slice(0, 120) + (e.filename ? ' @' + e.filename.split('/').pop() + ':' + e.lineno : '')); if (errs.length > 3) errs.shift(); });
  addEventListener('unhandledrejection', e => { errs.push('promise: ' + String(e.reason && e.reason.message || e.reason).slice(0, 120)); if (errs.length > 3) errs.shift(); });
  box.addEventListener('pointerdown', e => { e.stopPropagation(); setView(STATES[(STATES.indexOf(view) + 1) % STATES.length]); }, true);
  function setView(v) {
    view = v; try { localStorage.setItem('bsThorHud', v); } catch {}
    box.style.cssText = CSS + (v === 'hidden' ? HIDDEN_CSS : '');
    if (v === 'hidden') { looping = false; prev = 0; box.textContent = 'meter'; return; } // the loop ends at its next frame
    if (!looping) { looping = true; prev = 0; frames = 0; lastSec = performance.now(); raf(loop); }
    draw();
  }
  // catch the smoothness test's result lines (they go through boxshelf.log)
  const api = window.boxshelf;
  if (api && api.log) { const orig = api.log.bind(api); try { api.log = m => { const s = String(m); if (/smoothness/i.test(s)) { smooth.push(s.replace(/^.*?smoothness/i, 'smoothness')); if (smooth.length > 6) smooth.shift(); } return orig(m); }; } catch {} }
  let medC = 16.7;
  function loop(t) {
    if (!looping) return;
    if (prev) { const g = t - prev; if (g > 0 && g < 1000) { gaps.push(g); if (gaps.length > 300) gaps.shift(); total++;
      if (g > medC * 1.5) slow++; worst5 = Math.max(worst5, g); } }
    prev = t; frames++;
    if (!shelfAt && document.querySelector('.slot')) { shelfAt = t; slow = 0; total = 0; gaps = []; } // count from the shelf on, not the loading
    if (t - lastSec >= 1000) { fps = Math.round(frames * 1000 / (t - lastSec)); frames = 0; lastSec = t; medC = gaps.length > 30 ? gaps.slice().sort((a, b) => a - b)[gaps.length >> 1] : 16.7; draw(); } // the typical frame, worked out once a second (sorting 300 numbers every frame was the meter's own cost)
    raf(loop);
  }
  // the app's own work in the last second (perf-meter.js), without this meter's loop
  let wPrev = null, wAt = 0, work = '';
  function workLine() {
    const M = window.BS_METER; if (!M) return 'work: meter not loaded';
    const c = M.counts(), now = performance.now();
    if (wPrev) { const s = Math.max(.2, (now - wAt) / 1000), d = k => (c[k] - wPrev[k]) / s;
      work = `work: ${d('cb').toFixed(0)} wake-ups/s · ${d('ms').toFixed(1)} ms/s · ${d('draws').toFixed(0)} draws/s · ${M.idle() ? 'idle' : 'active'}, idle frames ${c.idleFrames}`; }
    wPrev = c; wAt = now; return work || 'work: measuring…';
  }
  let worstReset = performance.now();
  // the screen line is worked out on resize only: reading innerWidth in the once-a-second redraw made the page restyle and
  // lay out right then (mid-slide, if the shelf was moving), instead of in its own frame
  let scr = ''; const scrNow = () => { scr = `${innerWidth}x${innerHeight} @${devicePixelRatio}x (device ${window.__bsRealDpr ? window.__bsRealDpr() : '?'}x)`; };
  addEventListener('resize', scrNow); addEventListener('load', scrNow); scrNow();
  function draw() {
    if (view === 'hidden') return;
    if (performance.now() - worstReset > 5000) { worstReset = performance.now(); worst5 = 0; }
    const gp = (navigator.getGamepads ? [...navigator.getGamepads()] : []).find(Boolean);
    if (gp) { pad.id = gp.id.slice(0, 40); const b = gp.buttons.findIndex(x => x && x.pressed); if (b >= 0) pad.last = 'button ' + b; }
    const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB JS' : 'n/a';
    if (view === 'small') { box.textContent = `${fps} fps`; return; }
    box.textContent =
      `BOXSHELF THOR TEST  (tap: small → hidden)   build ${window.BS_BUILD || '?'}\n` +
      `android: ${window.__bsAndroid || 'not loaded'}\n` +
      `shelf on screen: ${shelfAt ? Math.round(shelfAt) + ' ms after page start' : 'loading…'}\n` +
      `fps: ${fps}   worst frame (5 s): ${Math.round(worst5)} ms\n` +
      `slow frames: ${total ? (slow * 100 / total).toFixed(1) : 0}% of ${total}\n` +
      `${workLine()}\n` +
      `memory: ${mem}   screen: ${scr}  perf: ${window.Perf ? Perf.get().level : '?'}\n` +
      `controller: ${pad.id || 'none seen yet (press a button)'}${pad.last ? '  last: ' + pad.last : ''}\n` +
      (errs.length ? `\nerrors:\n${errs.join('\n')}` : '') +
      (smooth.length ? `\n${smooth.join('\n')}` : `\nSettings → System → Smoothness test for a full run`);
  }
  addEventListener('DOMContentLoaded', () => { document.body.appendChild(box); setView(view); });
  window.__thorHud = () => ({ view, looping }); // (the device test)
  addEventListener('gamepadconnected', draw);
})();
