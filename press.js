/* PRESS, on every button of every page (her 2026-11-24: "the demo buttons don't have the press down press up states. Make sure all
   buttons have press down and press up states"). ONE rule, the press her demos already had (Velocity's): down = scale .96 in 80ms,
   up = back on a soft spring in 280ms (cubic-bezier(.34,1.56,.64,1)). Driven from pointer events, not :active, so it is the same on
   iPhone Safari, Android and a mouse, and a quick tap still shows the whole dip. Fills stay flat; colour steps (.btn:active) stay CSS.
   - touch waits 60ms before dipping, so a scroll that starts on a card never pulses it; a tap shorter than that still dips + springs
   - moving 10px or the browser taking the touch for a scroll lets go (springs back), so drags and swipes are never held down
   - a see-through button laid over a tile (.tb-open) presses the tile
   - transform is ADDED to the element's own (composite add), so cards placed by transform don't drift; old Safari: the scale property
   - skipped: sliders and drag handles, the colour wheel, the video timeline, disabled buttons, and the CLAY buttons (they cave in instead,
     her 2026-10-24 "getting smaller isn't what clay does")
   - Reduce Motion: no scale, a tint (brightness .86) for as long as it is held */
(function () {
  if (window.mkPress || !Element.prototype.animate) return; window.mkPress = 1;
  var SEL = 'button,[role=button],[role=tab],[role=switch],[role=option],.btn,summary,a.cta-resume,a.scard,a.wproject,a.brand-slot,'
    + 'a.cta,a.lk-btn,a.btn-o,a.ff-card,a.ff-hey,a.v-live';   // links drawn as buttons / cards (home; the case-study pages)
  var SKIP = 'input,textarea,select,.vx-cv *,.vx-aim,.tw,.tw *,.cta-socials a,.vt-clay a,.tune-acts button,:disabled,[aria-disabled=true]';
  var still = matchMedia('(prefers-reduced-motion: reduce)');
  var ADD = typeof KeyframeEffect !== 'undefined' && 'composite' in KeyframeEffect.prototype;
  var cur = null;   // { el, x, y, anim, timer, up }
  var st = document.createElement('style');
  st.textContent = 'html{-webkit-tap-highlight-color:transparent}';   // no grey iOS flash over the press
  document.head.appendChild(st);
  document.addEventListener('touchstart', function () {}, { passive: true });   // iOS only runs CSS :active (the colour steps) with a touch listener

  function target(el) {
    var p = el.parentElement;
    if (p && getComputedStyle(el).position === 'absolute' && el.offsetWidth >= p.offsetWidth - 1 && el.offsetHeight >= p.offsetHeight - 1) return p;
    return el;
  }
  function frames(on) {
    if (still.matches) return { filter: on ? ['brightness(1)', 'brightness(.86)'] : ['brightness(.86)', 'brightness(1)'] };
    var a = on ? 1 : .96, b = on ? .96 : 1;
    return ADD ? { transform: ['scale(' + a + ')', 'scale(' + b + ')'] } : { scale: [String(a), String(b)] };
  }
  function down(c) {
    c.timer = 0; c.at = performance.now();
    c.anim = c.el.animate(frames(true), { duration: 80, easing: 'ease-out', fill: 'forwards', composite: ADD ? 'add' : 'replace' });
  }
  function up(c) {
    if (c.timer) { clearTimeout(c.timer); c.timer = 0; if (!c.tap) return; down(c); }   // a tap quicker than the touch wait: dip anyway
    if (!c.anim) return;
    var wait = Math.max(0, 80 - (performance.now() - c.at));   // let the dip land before the spring, or a fast click shows nothing
    setTimeout(function () {
      var d = c.anim; c.anim = null;
      c.el.animate(frames(false), { duration: still.matches ? 160 : 280, easing: still.matches ? 'ease-out' : 'cubic-bezier(.34,1.56,.64,1)', composite: ADD ? 'add' : 'replace' });
      d.cancel();
    }, wait);
  }
  function release(tap) { if (!cur) return; var c = cur; cur = null; c.tap = tap; up(c); }

  document.addEventListener('pointerdown', function (e) {
    if (e.button > 0 || !e.isPrimary) return;
    release(false);
    var el = e.target.closest && e.target.closest(SEL);
    if (!el || e.target.closest(SKIP) || el.matches(SKIP)) return;
    var c = cur = { el: target(el), x: e.clientX, y: e.clientY };
    if (e.pointerType === 'touch') c.timer = setTimeout(function () { down(c); }, 60); else down(c);
  }, { capture: true, passive: true });
  document.addEventListener('pointermove', function (e) {
    if (cur && e.isPrimary && Math.abs(e.clientX - cur.x) + Math.abs(e.clientY - cur.y) > 10) release(false);
  }, { capture: true, passive: true });
  document.addEventListener('pointerup', function (e) { if (e.isPrimary) release(true); }, { capture: true, passive: true });
  document.addEventListener('pointercancel', function () { release(false); }, { capture: true, passive: true });
  addEventListener('blur', function () { release(false); });
})();
