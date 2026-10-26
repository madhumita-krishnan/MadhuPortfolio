/* THE CURSOR IS THE LIGHT (her 2026-10-26: "can the lighting source be my cursor so as my mouse moves the lighting moves
   with me and changes on the object?"). Every lit object (the iPhone and MacBook bezels, browser frames, the clay tiles,
   case-study phones, the headshot) gets two variables from where the pointer is relative to its own centre:
     --lx/--ly  the unit direction its shadow falls (away from the cursor); CSS default 0,1 = straight down
     --la       the angle of the bezel's rail highlight, which turns to face the cursor; CSS default 152deg
   Mouse/trackpad only: on touch the light stays where the CSS puts it. Only objects on screen are updated, once a frame. */
(function () {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var SEL = '.phone,.mac,.browser,.cta-socials img,.headshot,.cs-hero-phones>img,.cs-phones>img';
  var seen = new Set(), mx = -1, my = -1, raf = 0;
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { e.isIntersecting ? seen.add(e.target) : seen.delete(e.target); }); });
  function watch() { document.querySelectorAll(SEL).forEach(function (el) { if (!el.__lit) { el.__lit = 1; io.observe(el); } }); }
  function paint() {
    raf = 0;
    seen.forEach(function (el) {
      var r = el.getBoundingClientRect(), vx = r.left + r.width / 2 - mx, vy = r.top + r.height / 2 - my, d = Math.hypot(vx, vy) || 1;
      /* right on top of it the light is overhead: the shadow shortens instead of flipping wildly */
      var k = Math.min(1, d / Math.max(120, r.width * .6));
      el.style.setProperty('--lx', (vx / d * k).toFixed(3));
      el.style.setProperty('--ly', (vy / d * k).toFixed(3));
      el.style.setProperty('--la', (Math.atan2(vx, -vy) * 180 / Math.PI).toFixed(1) + 'deg');
    });
  }
  addEventListener('pointermove', function (e) { mx = e.clientX; my = e.clientY; if (!raf) raf = requestAnimationFrame(paint); }, { passive: true });
  addEventListener('scroll', function () { if (mx >= 0 && !raf) raf = requestAnimationFrame(paint); }, { passive: true });
  var mt; watch(); new MutationObserver(function () { clearTimeout(mt); mt = setTimeout(watch, 300); }).observe(document.body, { childList: true, subtree: true });   // the deck and viewers add frames later
})();
