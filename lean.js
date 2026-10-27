/* THE LEAN (her 2026-10-27): "the first time people go into focus mode on horizontal scroll can you have my avatar pop up.
   rest her inner forearm with her elbow bent and her legs crossed. as she leans on the logo scroll and then all the logos fall
   out. and she looks at it surprised. like when you lean on something you didnt expect to move and then she gets up leaves",
   then "the surprised look doesnt need to be that dramatic … analyze what would happen to someones weight distribution",
   "its only there the first time you do horizontal scroll on focus mode", and her rule that she never just vanishes.

   Once per visitor (localStorage), only on a fine pointer with motion allowed, only when she fits standing on the screen's floor:
     0      the logo row under the progress bar comes up
     200    she springs up from the bottom edge into the lean: forearm on the last logos, legs crossed, feet on the floor
     1900   the logos let go and fall, slow at first then faster (gravity); her forearm sinks with them and she tips toward them
     2050   she catches herself: the crossed foot uncrosses into one small step, the other arm out for balance (tilt eases back)
     2450   a mild glance down at where they went
     then   she crouches, springs up and drops out through the bottom of the screen; the row is put back quietly
   (she jumps IN from below the screen too: her 2026-10-27 "rather than running can she jump in and jump out from the bottom?")
   Poses: assets/clay/lean/{lean,catch,glance}.png, lifted from Flora (project "Loader · clay bar break") off green. */
(function () {
  var root = document.documentElement, sd = document.querySelector('.sdeck'); if (!sd) return;
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches, rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var seen = false; try { seen = localStorage.getItem('mk-lean') === '1'; } catch (e) {}
  if (/[?&]lean\b/.test(location.search)) seen = false;   // ?lean plays it again (for checking)
  if (seen || rm || !fine) return;
  var base = (document.querySelector('script[src*="lean.js"]') || {}).src || '', ver = (base.match(/\?v=[^&]*/) || [''])[0];
  var DIR = 'assets/clay/', P = {   // each pose: the image's own fractions (feet x, top and bottom of the figure, the forearm)
    lean: { f: 'lean/lean.png', fx: .756, top: .0054, bot: .993, tipX: .0126, armY: .287, ar: 476 / 1112 },
    caught: { f: 'lean/catch.png', fx: .548, top: .0063, bot: .993, ar: 558 / 1112 },
    glance: { f: 'lean/glance.png', fx: .482, top: .0063, bot: .993, ar: 382 / 1106 }
  };
  /* her poses (~400KB) never compete with the first screen: fetched a moment after the page has loaded */
  var imgs = {}, fetchPoses = function () { if (imgs.lean) return; Object.keys(P).forEach(function (k) { var im = new Image(); im.decoding = 'async'; im.src = DIR + P[k].f + ver; imgs[k] = im; }); };
  if (document.readyState === 'complete') setTimeout(fetchPoses, 1500); else addEventListener('load', function () { setTimeout(fetchPoses, 1500); }, { once: true });
  /* OPTION B, her alternative (2026-10-27: "or maybe just have a large hand generated on flora come in from below and tap the
     lines. the icons show themselves, the hand disappears and the icons disappear"). The default since she chose the hand
     (2026-10-27: "i like the one with the finger out"); ?pose shows the clay-her lean instead */
  var TAP = !/[?&]pose\b/.test(location.search);
  /* her right forearm rising from below, PALM FACING LEFT toward the lines, side-on, all four fingers showing, thumb tucked
     beside the index (her 2026-10-27: "you can barely see the fingers because the thumb covers them. palm faces to the left.
     not out of the screen. the idea is the wrist and the finger tapping the lines"); her pick, take B: "the one with the finger
     out" (index leads, the other fingers curled behind it); wX/wY = the wrist the hand bends at */
  var hand = null, HP = { f: 'lean/hand-tap.png', tipX: .084, tipY: .007, wX: .697, wY: .489, tilt: -38, ar: 451 / 1046 };   // tip = the index fingertip; its finger points ~50° up, so tilt -38° lays it ~12° off the dashes
  if (TAP) { var fetchHand = function () { if (hand) return; hand = new Image(); hand.decoding = 'async'; hand.src = DIR + HP.f + ver; };
    if (document.readyState === 'complete') setTimeout(fetchHand, 1500); else addEventListener('load', function () { setTimeout(fetchHand, 1500); }, { once: true }); }
  var busy = false;
  new MutationObserver(function () { if (!busy && root.classList.contains('hfocus')) { busy = true; setTimeout(play, 350); } })
    .observe(root, { attributes: true, attributeFilter: ['class'] });

  /* her jump frames (the loader's sheet): she jumps IN from below the screen and OUT through it (her 2026-10-27: "rather than
     running can she jump in and jump out from the bottom?") */
  var J = {}, JK = [3, 4, 5, 7, 8, 9];
  function fetchJumps() {
    return fetch(DIR + 'clay.json' + ver).then(function (r) { return r.json(); }).then(function (j) {
      var a = j['jump-land-slide-x3'], ref = j._ref || 252;
      return Promise.all(JK.map(function (i) { var e = a[i], im = new Image(); im.src = DIR + e.f.replace(/\.png$/, '.webp') + ver; J['j' + i] = { e: e, im: im, ref: ref };
        return im.decode ? im.decode().catch(function () {}) : null; }));
    }).catch(function () {});
  }
  function tap() {
    fetchHand();
    var bar = sd.querySelector('.sdeck-progress'), icos = [].slice.call(sd.querySelectorAll('.sd-ico'));
    if (!bar || !icos.length) return;
    (hand.decode ? hand.decode().catch(function () {}) : Promise.resolve()).then(function () {
      var br = bar.getBoundingClientRect(), W = innerWidth, H = innerHeight, line = br.top + 11.5, tipX = br.right;
      /* hand-sized (her: "the hand is too large"); the forearm runs on below the screen's bottom edge: if the picture stops short
         on a tall screen, its own last strip of forearm is stretched down so the shading carries on */
      /* the whole arm leans in from the lower right (TILT, around the wrist) so the index finger lies along the dashes and its
         TIP sits on the end of the last one (her: "make sure the finger tip is aligned with the dashed line") */
      var hw = Math.max(120, Math.min(170, W * .11)), hh = hw / HP.ar, px = HP.wX * hw, py = HP.wY * hh, r = HP.tilt * Math.PI / 180,
        dx = HP.tipX * hw - px, dy = HP.tipY * hh - py,
        left = tipX - px - (dx * Math.cos(r) - dy * Math.sin(r)), top = line - py - (dx * Math.sin(r) + dy * Math.cos(r)),
        armH = Math.max(0, (H - top) / Math.cos(r) - hh) + 80;
      var el = document.createElement('div'); el.className = 'mk-lean hf-on';
      el.style.cssText = 'position:fixed;z-index:70;pointer-events:none;will-change:transform;left:' + left + 'px;top:' + top + 'px;width:' + hw + 'px;height:' + (hh + armH) + 'px;transform-origin:' + px + 'px ' + py + 'px';
      /* two layers of the one picture: the forearm (below the wrist) holds still, the hand (above it) bends AT THE WRIST, and
         the two cross-fade over a short band at the wrist so the bend never shows a seam */
      var wy = (HP.wY * 100).toFixed(1), msk = function (g) { return '-webkit-mask-image:' + g + ';mask-image:' + g; },
        img = 'position:absolute;left:0;top:0;width:' + hw + 'px;height:' + hh + 'px;';
      el.innerHTML = '<img alt="" src="' + hand.src + '" style="' + img + msk('linear-gradient(transparent ' + wy + '%,#000 ' + (+wy + 3) + '%)') + '">' +
        '<span style="position:absolute;left:0;width:' + hw + 'px;top:' + (hh - 2) + 'px;height:' + (armH + 2) + 'px;background:url(' + hand.src + ') center bottom/' + hw + 'px ' + ((armH + 2) * 60) + 'px no-repeat"></span>' +
        '<img alt="" src="' + hand.src + '" style="' + img + 'transform-origin:' + (HP.wX * 100) + '% ' + wy + '%;will-change:transform;' + msk('linear-gradient(#000 ' + (+wy + 1) + '%,transparent ' + (+wy + 7) + '%)') + '">';
      document.body.appendChild(el);
      var wrist = el.lastChild, from = H - top + 120, t0 = performance.now(), shown = false;
      var ein = function (u) { return u * u; }, eout = function (u) { return 1 - (1 - u) * (1 - u); };
      (function step(now) {
        /* a = how far the wrist is cocked back (deg; 0 = fingertips on the end of the lines) */
        var t = now - t0, y = 0, a = 0;
        if (t < 520) { var u = t / 520; y = from * Math.pow(1 - u, 3); a = 16; }                 // up from below, hand cocked back
        else if (t < 640) a = 16 * (1 - ein((t - 520) / 120));                                    // tap 1: the wrist snaps the fingertips onto the lines
        else if (t < 780) a = 9 * eout((t - 640) / 140);                                          // lift
        else if (t < 880) a = 9 * (1 - ein((t - 780) / 100));                                     // tap 2
        else if (t < 1120) a = 0;
        else if (t < 1600) { var d = (t - 1120) / 480; y = from * d * d; a = 12 * eout(Math.min(1, d * 2)); }   // wrist relaxes, back down and away
        else { el.remove(); setTimeout(function () { done(bar, icos); }, 1300); return; }         // then the logos go
        if (t >= 640 && !shown) { shown = true; bar.classList.add('lean'); }                      // the logos pop out on the first tap
        el.style.transform = 'translateY(' + y.toFixed(1) + 'px) rotate(' + HP.tilt + 'deg)';
        wrist.style.transform = 'rotate(' + a.toFixed(2) + 'deg)';
        requestAnimationFrame(step);
      })(t0);
    });
  }
  function play() {
    if (TAP) return tap();
    fetchPoses();
    var bar = sd.querySelector('.sdeck-progress'), icos = [].slice.call(sd.querySelectorAll('.sd-ico'));
    if (!bar || !icos.length) return;
    Promise.all(Object.keys(imgs).map(function (k) { return imgs[k].decode ? imgs[k].decode().catch(function () {}) : null; }).concat([fetchJumps()])).then(function () {
      if (!J.j8) { done(bar, icos); return; }
      bar.classList.add('lean');   // the row shows as it does on hover
      setTimeout(function () { stage(bar, icos); }, 220);
    });
  }

  function stage(bar, icos) {
    var last = icos[icos.length - 1].getBoundingClientRect(), H = innerHeight, Lp = P.lean, br = bar.getBoundingClientRect();
    /* on the LINES themselves, at their right-hand end (her 2026-10-27: "she needs to lean on the lines up higher and more to
       the right"): the dashes sit 10px into the bar's hit area */
    var ledge = br.top + 10;
    var h = (H - ledge) / (1 - Lp.armY / Lp.bot);                   // figure height that puts her feet on the screen's floor
    if (h < 90 || h > 240) { done(bar, icos); return; }             // she wouldn't fit standing: never float, so not this time
    var imgH = h / (Lp.bot - Lp.top), feet = H - 2;
    var el = document.createElement('img'); el.alt = ''; el.className = 'mk-lean hf-on';   // hf-on: focus mode fades everything else on the page, never her
    el.style.cssText = 'position:fixed;left:0;top:0;z-index:70;pointer-events:none;transform-origin:50% 100%;will-change:transform';
    document.body.appendChild(el);
    var tipX = br.right - 8, fx = tipX + (Lp.fx - Lp.tipX) * imgH * Lp.ar;   // only her hand over the end of the last line
    if (fx + imgH * Lp.ar * (1 - Lp.fx) > innerWidth - 8) { el.remove(); done(bar, icos); return; }
    function pose(k, dy, rot) {
      var p = P[k], w = imgH * p.ar;
      el.src = imgs[k].src; el.style.width = w + 'px'; el.style.height = imgH + 'px';
      el.style.left = (fx - p.fx * w) + 'px'; el.style.top = (feet - p.bot * imgH) + 'px';
      el.style.transform = 'translateY(' + (dy || 0).toFixed(1) + 'px) rotate(' + (rot || 0).toFixed(2) + 'deg)';
    }
    /* a jump frame, feet (or where the feet would be) at y, centred on x */
    function jf(key, x, y, rot) {
      var J0 = J[key], e = J0.e, k = h / J0.ref;
      el.src = J0.im.src; el.style.width = e.w * k + 'px'; el.style.height = e.h * k + 'px';
      el.style.left = (x - e.cx * k) + 'px'; el.style.top = (y - e.base * k) + 'px'; el.style.transform = 'rotate(' + (rot || 0) + 'deg)';
    }
    var t0 = performance.now(), fell = false, IN = 560, OUT0 = IN + 3230 - 300, OUT = 700;
    (function step(now) {
      var t = now - t0, apex = feet - h * .55, below = H + h * 1.2;
      if (t < IN) {                                                  // up from below the screen, tuck at the top, down onto her spot, land
        var u = t / IN;
        if (u < .55) { var a1 = u / .55, y1 = below + (apex - below) * (1 - Math.pow(1 - a1, 2)); jf(a1 < .5 ? 'j5' : 'j7', fx, y1, 0); }
        else if (u < .85) { var a2 = (u - .55) / .3; jf('j8', fx, apex + (feet - apex) * a2 * a2, 0); }
        else jf('j9', fx, feet, 0);                                    // the landing crouch, then she leans
      } else if (t < IN + 1380) pose('lean', 0, 0);
      else if (t < IN + 1530) { var a = (t - IN - 1380) / 150; pose('lean', 4 * a * a, -3 * a * a); if (!fell) { fell = true; fall(icos); } }   // the arm sinks with them, she tips toward them
      else if (t < IN + 1930) { var c = Math.min(1, (t - IN - 1530) / 400), e = 1 - Math.pow(1 - c, 3); pose('caught', 0, -6 * (1 - e)); }       // the catch step; the tilt eases out
      else if (t < IN + 2930) pose('glance', 0, 0);
      else if (t < IN + 2930 + OUT) {                                // crouch, spring up, tuck, and drop out through the bottom of the screen
        var v = (t - IN - 2930) / OUT;
        if (v < .15) jf('j3', fx, feet, 0);
        else if (v < .45) { var b1 = (v - .15) / .3, y2 = feet + (apex - feet) * (1 - Math.pow(1 - b1, 2)); jf(b1 < .5 ? 'j4' : 'j7', fx, y2, 0); }
        else { var b2 = (v - .45) / .55; jf('j8', fx, apex + (below - apex) * b2 * b2, 0); }
      } else { el.remove(); done(bar, icos); return; }
      requestAnimationFrame(step);
    })(t0);
  }

  /* gravity: each logo lets go a beat apart, starting with the ones under her arm, and drops off the bottom turning a little */
  function fall(icos) {
    icos.slice().reverse().forEach(function (ic, i) {
      var r = ic.getBoundingClientRect(), d = innerHeight - r.top + 80, rot = (i % 2 ? 1 : -1) * (18 + i * 6);
      ic.animate([{ transform: 'translate(-50%,0) scale(1)', offset: 0 }, { transform: 'translate(-50%,' + d + 'px) rotate(' + rot + 'deg) scale(1)' }],
        { duration: 620 + i * 25, delay: i * 45, easing: 'cubic-bezier(.55,0,1,.45)', fill: 'forwards' });
    });
  }

  function done(bar, icos) {
    try { localStorage.setItem('mk-lean', '1'); } catch (e) {}
    bar.classList.remove('lean');
    setTimeout(function () { icos.forEach(function (ic) { (ic.getAnimations ? ic.getAnimations() : []).forEach(function (a) { a.cancel(); }); }); }, 400);   // back in place, hidden as usual, once the row has faded
  }
})();
