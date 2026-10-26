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
  /* a shadow is nearly invisible on the night ground (her: "I don't see the cursor lighting thing happening"), so the light
     also shows ON the object: a glint on the side facing the cursor and shade on the far side (.lit-glint). On a clay tile
     it's masked to the tile's own shape; on a device it covers the frame */
  var GLINT = '.phone,.mac,.browser,.cta-socials img';
  function glint(el) {
    var g = document.createElement('span'); g.className = 'lit-glint'; g.setAttribute('aria-hidden', 'true');
    if (el.tagName === 'IMG') { var m = 'url("' + el.currentSrc + '")'; g.style.webkitMaskImage = g.style.maskImage = m; el.after(g); el.__g = g; }
    else { el.appendChild(g); el.__g = g; }
  }
  function watch() { document.querySelectorAll(SEL).forEach(function (el) { if (!el.__lit) { el.__lit = 1; io.observe(el); if (el.matches(GLINT)) glint(el); } }); }
  function paint() {
    raf = 0;
    seen.forEach(function (el) {
      var r = el.getBoundingClientRect(), vx = r.left + r.width / 2 - mx, vy = r.top + r.height / 2 - my, d = Math.hypot(vx, vy) || 1;
      /* right on top of it the light is overhead: the shadow shortens instead of flipping wildly */
      var k = Math.min(1, d / Math.max(120, r.width * .6));
      el.style.setProperty('--lx', (vx / d * k).toFixed(3));
      el.style.setProperty('--ly', (vy / d * k).toFixed(3));
      el.style.setProperty('--la', (Math.atan2(vx, -vy) * 180 / Math.PI).toFixed(1) + 'deg');
      if (el.__g) { el.__g.style.setProperty('--gx', (50 - vx / d * 42).toFixed(1) + '%'); el.__g.style.setProperty('--gy', (50 - vy / d * 42).toFixed(1) + '%');
        el.__g.style.setProperty('--sx', (50 + vx / d * 46).toFixed(1) + '%'); el.__g.style.setProperty('--sy', (50 + vy / d * 46).toFixed(1) + '%');
        el.__g.style.opacity = (.55 + .45 * (1 - Math.min(1, d / 900))).toFixed(2); }   // nearer the cursor, brighter
    });
  }
  addEventListener('pointermove', function (e) { mx = e.clientX; my = e.clientY; if (!raf) raf = requestAnimationFrame(paint); }, { passive: true });
  addEventListener('scroll', function () { if (mx >= 0 && !raf) raf = requestAnimationFrame(paint); }, { passive: true });
  var mt; watch(); new MutationObserver(function () { clearTimeout(mt); mt = setTimeout(watch, 300); }).observe(document.body, { childList: true, subtree: true });   // the deck and viewers add frames later
})();
