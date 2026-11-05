// Android build only (copy-web.js puts it first in <head>, before anything reads the pixel ratio).
// The Android page is laid out 1440 CSS px wide and the WebView scales it to fit the screen (page zoom), but
// window.devicePixelRatio still reports the device's own density (2.25 on the AYN Thor). Every canvas sized from it
// (Inspect, the 3D case model, the theme layer, cover thumbnails, manual pages) was drawn 1.7x too wide and tall, up to
// 2.8x the pixels the screen actually shows. Here the ratio is what it really is for this layout: screen pixels per CSS
// pixel (1920 / 1440 = 1.33 on the Thor), read live so a rotation or window change stays right.
(function () {
  if (window.__bsDprFixed) return; window.__bsDprFixed = true;
  const desc = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio') || Object.getOwnPropertyDescriptor(Window.prototype, 'devicePixelRatio');
  const real = () => { try { return (desc && desc.get ? desc.get.call(window) : 0) || 1; } catch { return 1; } };
  window.__bsRealDpr = real;
  function effective() {
    const r = real(), sw = Math.max(screen.width || 0, screen.height || 0), iw = Math.max(innerWidth || 0, innerHeight || 0);
    if (!sw || !iw) return r;
    const e = r * sw / iw;                        // physical screen pixels across ÷ CSS pixels across
    return e > .5 && e < r ? Math.round(e * 1000) / 1000 : r; // only ever lowers it; nonsense (0 sizes while loading) keeps the real one
  }
  try { Object.defineProperty(window, 'devicePixelRatio', { configurable: true, enumerable: true, get: effective, set() {} }); } catch {}
})();
