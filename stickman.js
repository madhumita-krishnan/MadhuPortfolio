/* stickman.js — the hero's little inhabitant.

   A procedural stick figure that lives ONLY in the hero band — the hero's height, but
   the full viewport's width, so on a wide desktop he can run all the way to the actual
   screen edge instead of stopping at the 1240px section cap. It starts holding the
   "say hey" board up over its head (the real CTA anchor is untouched — Calendly link, focus
   ring and button styling all survive; there is no drawn post, per her 2026-08-14 note).
   From there it is a tiny platformer whose TERRAIN IS THE INK:

     · everything that is not the beige page is solid — the painted blooms, every word of
       her handwriting, the headline glyphs, the eyebrow, the buttons. The hero is rendered
       once more into an offscreen mask (images drawn, text re-set with the same fonts at
       the same rects) and the figure walks on the alpha of that mask, so it can stand on a
       petal, crawl in the gap between two lines of handwriting, or balance on the dot of
       an i. Contact points are drawn ~0.7px INTO the surface so it reads as touching, not
       hovering.
     · click anywhere → it walks/runs there, climbing greedily via whatever ink is in reach
     · drag → it moves in the drag direction, incrementally faster the further you drag
     · gravity always applies — no ceiling walking; low clearance folds it into a crawl
     · long jumps and big drops get a full tuck flip; small hops don't
     · the undersides of the copy blocks are monkey bars — jump up, grab, swing, traverse
       toward the mouse
     · click the figure → a celebration, cycling a library so it differs every time
     · hover the say-hey button → it waves back

   The look follows her reference sheets ("Stick figure motion"): a sketchy open-ellipse
   head with a face, limbs drawn as slightly bowed ink strokes with per-stroke wobble and a
   slow 6Hz boil while moving, finger fans on expressive hands. All in --ink-blue.

   The rAF loop follows the pot's rule: started on demand, cancelled the moment the figure
   settles — an idle figure is a single static draw costing zero frames. Touch boots it
   too (her 2026-08-17 ask — it was desktop-only before): tap-to-walk, tap-to-celebrate,
   the sign hold, everything but DRAG, which on a phone is the scroll gesture and is left
   alone. Reduce Motion boots her too, standing still (see rmActive in start()); she is never hidden for it. */
(function () {
  'use strict';
  var hero = document.querySelector('.hero');
  if (!hero) return;
  var fine = matchMedia('(hover: hover) and (pointer: fine)');
  /* FULL MOTION FOR EVERYONE (her 2026-11-25: "I don't care about reduced motion"): the OS Reduce Motion setting is ignored;
     only the site's own rm-mode class (no switch for it yet) stills her. */
  var touchMode = !fine.matches;
  var rmActive = function () { return document.body.classList.contains('rm-mode'); };

  var cv = document.createElement('canvas');
  cv.className = 'stick-cv';
  cv.setAttribute('aria-hidden', 'true');
  hero.appendChild(cv);
  var ctx = cv.getContext('2d');

  /* ------------------------------------------------------------------ proportions */
  /* ~12% up from the first pass — at the old size the face, finger fans and arm poses
     vanished into the head at reading distance; the reference figures are stockier */
  var TH = 13, SH = 13, UA = 10.5, FA = 10.5, TO = 18, NK = 3.5, HR = 7.6;
  var LEG = TH + SH;
  var HANDUP = TO + UA + FA - 4;   // raised hands, this far above the pelvis

  /* ------------------------------------------------------------------ tuning */
  var G = 2300;
  var WALK = 150, RUN = 460, DRAGMAX = 640;   // her 2026-10-26 (#84, "move with more haste"): were 120 / 360
  var STEP_UP = 20;      // absorbed in stride — the x-height bumps along a word
  var HOP_UP = 62;       // auto-hop: ascenders, petal ledges, stairs of letters
  var STEP_DOWN = 30;
  var JUMP_MAX = 240;
  var FLIP_DX = 150, FLIP_DROP = 145;
  /* grip line → pelvis in a hang. 26 parked the pelvis so high that the head top rode
     ~9px ABOVE the hands (2026-08-25: "if he was hanging and there was gravity his
     hands would be higher than his head"). 41 is a true dead hang: the head hangs
     clear below the grips — it needs the hang pose's armStretch to stay reachable,
     because the head alone is ~18px of the arm's 21. */
  var HANG_L = 41;
  var MIN_CLR = 15;      // a surface with less headroom than this isn't standable at all
  var CRAWL_CLR = 50;    // less headroom than this and the figure folds into a crawl

  /* ------------------------------------------------------------------ the ink mask
     Half-resolution alpha of everything visible in the hero that is not the page itself.
     One mask pixel = 2 CSS px, which is exactly the granularity a 60px figure needs. */
  var W = 0, H = 0, DPR = 1, floorY = 0, floorX1 = null, floorX2 = null;   // floorX1/2: where the divider she runs on is drawn
  var S = 0.5, W2 = 0, H2 = 0, md = null;
  var mk = document.createElement('canvas');
  var bars = [];
  var chRide = [];               // headline glyphs' RESTING boxes — see rideDy()
  var sign = null;               // {cx, bottom} — the say-hey board he holds up
  var ink = '#3C6B76';

  /* ONLY WHAT SHOWS IS GROUND (her 2026-10-29, "sometimes when I load my page the avatar still doesn't jump in the right
     place"): the bio writes itself in word by word over ~5s after she arrives, and the clay tiles pop in ~6s after her, but
     the map took every one of them as solid the moment it was read, so a tap in those first seconds sent her onto a word or
     a tile nobody could see yet. A piece counts once it is mostly visible; the map is re-read as each one lands */
  function shown(el) {
    for (var e = el; e && e !== hero; e = e.parentElement) if (+getComputedStyle(e).opacity < 0.5) return false;
    return true;
  }
  function localRect(el, hr) {
    var r = el.getBoundingClientRect(), d = liftOf(el);
    return { x1: r.left - hr.left, x2: r.right - hr.left, y1: r.top - hr.top - d, y2: r.bottom - hr.top - d, w: r.width, h: r.height };
  }
  /* how far CSS has lifted an element right now (its own translateY and every one above it in the hero: the name's
     load rise, a hovered bio line's -4px, its letters' -7px). The world is read where things REST; rideDy() puts her
     back on the live, moved glyph (her 2026-10-26: "her contact point with the text … is attached to her") */
  function liftOf(el) {
    var d = 0;
    if (!window.DOMMatrix) return 0;
    for (var e = el; e && e !== hero; e = e.parentElement) {
      var t = getComputedStyle(e).transform;
      if (t && t !== 'none') try { d += new DOMMatrix(t).m42; } catch (x) { }
    }
    return d;
  }

  /* re-set a text span into the mask with the same font at the same place. The baseline
     is recovered from the inline-layout half-leading formula; canvas letterSpacing is set
     where the browser supports it so the eyebrow's tracked caps land where they render. */
  function maskText(g, el, hr) {
    var t = el.textContent;
    if (!t.trim()) return;
    var cs = getComputedStyle(el);
    g.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + '/' + cs.lineHeight + ' ' + cs.fontFamily;
    if ('letterSpacing' in g) g.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
    var m = g.measureText('Mg');
    var asc = m.fontBoundingBoxAscent || parseFloat(cs.fontSize) * 0.8;
    var desc = m.fontBoundingBoxDescent || parseFloat(cs.fontSize) * 0.2;
    var r = localRect(el, hr);
    /* the hero words carry padding purely so iOS rasterises their overhanging tails
       (the ink-overflow cull — see .hero-line .w in build.js); the TYPE still sits in
       the content box, so the mask sheds the padding or every word would set low-left */
    var pl = parseFloat(cs.paddingLeft) || 0, pt = parseFloat(cs.paddingTop) || 0,
        pb = parseFloat(cs.paddingBottom) || 0;
    var baseline = r.y1 + pt + (r.h - pt - pb - (asc + desc)) / 2 + asc;
    g.fillText(t, r.x1 + pl, baseline);
  }

  var rebuilt = 0;   // how many times her map has been read (her entrance waits for one after the eyebrow comes to rest)
  function rebuild() {
    rebuilt++;
    /* the stage is the CANVAS box, not the hero box — the canvas runs the full viewport
       width (see .hero>.stick-cv in build.js) while the hero section is capped at 1240px;
       measuring the hero here is exactly what used to end his world mid-page on wide
       screens. All terrain rects stay relative to this same origin, so the mask and the
       figure agree about where everything is. */
    var hr = cv.getBoundingClientRect();
    if (hr.width < 40) return;
    /* she arrives while the name is still RISING (her 2026-10-24: "I need the person to be there before the text under
       I'm madhu"), so the headline is read where it will rest (localRect takes out every live lift); rideDy() carries
       her up with it meanwhile */
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = hr.width; H = hr.height;
    /* only when the size really changed: a new bitmap is a fresh full-screen GPU buffer, and the bio's write-in asks for
       a re-read many times at the same size */
    var cw = Math.round(W * DPR), chh = Math.round(H * DPR);
    if (cv.width !== cw || cv.height !== chh) { cv.width = cw; cv.height = chh; dirty = null; }   /* resizing the bitmap wiped the canvas — nothing left to erase */
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';   /* her clay, crisp (2026-11-22: "I want it to be crystal"): the default 'low' downscale softened every frame; set after every resize, which resets it */
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ink = (getComputedStyle(document.documentElement).getPropertyValue('--ink-blue') || '#3C6B76').trim();
    floorY = H - 14;
    /* SHE RUNS ON THE DIVIDER (her 2026-11-22: "i wish the avatar ran directly on the divider. not like hovering over it"): the
       hairline under the hero (the next section's first border-top, .brands-head) is her floor, measured where it rests; the
       floor used to be 14px above it, so she ran on air over the line */
    var nxs = hero.nextElementSibling, rule = nxs && [nxs].concat([].slice.call(nxs.querySelectorAll('*'), 0, 12)).filter(function (e) { return parseFloat(getComputedStyle(e).borderTopWidth) > 0; })[0];
    floorX1 = floorX2 = null;
    if (rule) { var rr = localRect(rule, hr), rt = rr.y1; if (rt > H - 40 && rt <= H + 1) { floorY = Math.min(H, Math.round(rt)); floorX1 = rr.x1; floorX2 = rr.x2; } }
    readRamp(floorX1 != null && rule, hr);
    if (ramp) floorX1 = floorX2 = null;   // the line reaches the page edges: no ends to stop at, no gap to leap

    W2 = Math.max(1, Math.ceil(W * S)); H2 = Math.max(1, Math.ceil(H * S));
    if (mk.width !== W2 || mk.height !== H2) { mk.width = W2; mk.height = H2; }   // same size: the clearRect below empties it
    var g = mk.getContext('2d', { willReadFrequently: true });
    g.setTransform(S, 0, 0, S, 0, 0);
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#000';
    g.textBaseline = 'alphabetic';

    /* the blooms — cut from her reference file, and now terrain */
    hero.querySelectorAll('.hero-flora img').forEach(function (im) {
      if (!im.complete || !im.naturalWidth) return;
      var r = localRect(im, hr);
      try { g.drawImage(im, r.x1, r.y1, r.w, r.h); } catch (e) { }
    });
    /* every piece of type: headline glyph by glyph (app.js has split it into .ch), the
       eyebrow and the handwritten lines word by word (.w spans from reveal-words) */
    hero.querySelectorAll('h1 .ch').forEach(function (el) { maskText(g, el, hr); });
    /* the same glyphs' resting boxes, kept so the figure can RIDE the hover wave. The
       .lively .ch transforms are cosmetic and deliberately never rebuild the mask (see
       the transitionend allowlist below), so the WORLD stays still while the drawing of
       it moves — the delta between a glyph's live box and this resting one is applied
       to the figure at draw time instead (2026-08-19 "if i hover over hi im madhu and
       it moves, the stickman should move too"). */
    chRide = [];
    hero.querySelectorAll('h1 .ch, .eyebrow .ch, .hero-line .ch, .hero-cta-row .cta-socials a, .jb-logo.rest').forEach(function (el) {
      if (!el.textContent.trim() && el.tagName !== 'A' && !el.classList.contains('jb-logo')) return;
      var cr = localRect(el, hr);
      chRide.push({ el: el, x1: cr.x1, x2: cr.x2, y1: cr.y1, y2: cr.y2 });
    });
    var words = hero.querySelectorAll('.eyebrow .w, .hero-line .w');
    if (!words.length) words = hero.querySelectorAll('.eyebrow, .hero-line .hs');
    words.forEach(function (el) { if (shown(el)) maskText(g, el, hr); });
    /* the buttons are solid boards */
    hero.querySelectorAll('.hero-cta-row .btn').forEach(function (b) {
      var r = localRect(b, hr);
      if (g.roundRect) { g.beginPath(); g.roundRect(r.x1, r.y1, r.w, r.h, r.h / 2); g.fill(); }
      else g.fillRect(r.x1, r.y1, r.w, r.h);
    });

    /* the JUMP! box is a solid block she can land on (its art bobs inside; this outer box stays still) */
    hero.querySelectorAll('.jump-box:not(.gone)').forEach(function (b) {
      var r = localRect(b, hr); if (r.w) g.fillRect(r.x1 + 6, r.y1 + r.h * .12, r.w - 12, r.h * .88);
    });
    /* the clay icons that tumbled out of it are blocks to stand on too — once they have come to REST, so the fall
       out of the dissolving piece goes all the way to the floor (her ask) instead of catching on a mid-air icon */
    /* …and on phones the clay tiles beside say hey! (her ask 2026-10-24: "I want to be able to jump on top of
       the claymation icons too") */
    hero.querySelectorAll('.jb-logo.rest, .hero-cta-row .cta-socials a').forEach(function (b) {
      if (!shown(b)) return;
      var r = localRect(b, hr); if (r.w) g.fillRect(r.x1 + 3, r.y1 + 3, r.w - 6, r.h - 3);
    });

    md = g.getImageData(0, 0, W2, H2).data;

    /* monkey bars: the undersides of the copy blocks (reachable from the floor with one
       hop, so the hang is discoverable) and the headline baseline */
    bars = [];
    /* a bar under EVERY line of the bio, not just under the block (her ask 2026-10-23: hang under all the words):
       the words are grouped into visual lines by where they sit, so a wrapped sentence gives two bars */
    /* EVERY VISIBLE LINE OF TYPE is a bar (her 2026-11-22: "the avatar should be able to monkey bar jump up to any text
       directly above it"): the name, the eyebrow and the bio, grouped into the lines they really wrap into, so a name or
       eyebrow that wraps on a phone gives a bar per line. Her hands hold the TOPS of the letters (glyphTop) */
    var rows = [];
    hero.querySelectorAll('h1 .ch, .eyebrow .w, .hero-line .w').forEach(function (w) {
      var r = localRect(w, hr); if (!r.w || !w.textContent.trim() || !shown(w)) return;
      var row = rows.filter(function (q) { return Math.abs(q.y1 + q.y2 - r.y1 - r.y2) / 2 < Math.min(r.h, q.y2 - q.y1) * .5; })[0];   // same line: centres within half the smaller line's height
      if (row) { row.x1 = Math.min(row.x1, r.x1); row.x2 = Math.max(row.x2, r.x2); row.y1 = Math.min(row.y1, r.y1); row.y2 = Math.max(row.y2, r.y2); }
      else rows.push({ x1: r.x1, x2: r.x2, y1: r.y1, y2: r.y2 });
    });
    rows.forEach(function (q) { bars.push({ x1: q.x1, x2: q.x2, y: q.y2 - 2, top: q.y1 }); });   // top..y: the line box
    /* HER REACH (her 2026-11-24: "the highest words you should be able to reach is the, as a product design engineer, I combine both
       disciplines to help align ... Like those two words are too high"): from where she stands she can jump to hang from a line no
       higher than the bio's last sentence's FIRST line is above the divider, plus a fifth of her height. One k × her height does not
       hold on every width (that line is 2.56 heights up on a 375 phone but the next line up, "in that guidance", only 2.11 on a 1440
       laptop), so it is read off the layout: the same reach from the floor and from every line she has climbed to (stages) */
    reachBase = null;
    var hs = hero.querySelectorAll('.hero-line .hs:not(.hs-now)'), lw = hs.length && (hs[hs.length - 1].querySelector('.w') || hs[hs.length - 1]);   // (.hs-now: the "Currently at" status line, not the bio)
    if (lw) { var lr = localRect(lw, hr); if (lr.h) reachBase = floorY - (lr.y2 - 2); }   // that first word's line, where it rests (read before it has written itself in, too)

    var btn = hero.querySelector('.hero-cta-row .btn.solid');
    sign = null;
    if (btn) {
      var sr = localRect(btn, hr);
      sign = { cx: sr.x1 + sr.w / 2, bottom: sr.y2 };
    }
    if (WORLD) showWorld();
  }

  /* ?world — HER MAP, MADE VISIBLE (her 2026-10-29: "You need figure it out for the avatar", after "sometimes when I load my
     page the avatar still doesn't jump in the right place", which no Chrome or WebKit run here reproduced). Everything she
     can stand on is painted red over the real page, with when it was read; on her phone, a screenshot the moment a jump
     goes wrong shows at once whether her map and the letters disagree. Never on without ?world in the address */
  var WORLD = /[?&]world\b/.test(location.search), wcv = null, wN = 0, wT0 = performance.now();
  function showWorld() {
    if (!wcv) { wcv = document.createElement('canvas'); wcv.setAttribute('aria-hidden', 'true'); hero.appendChild(wcv); }
    var cr = cv.getBoundingClientRect(), hb = hero.getBoundingClientRect();   // the canvas is centred by a transform: measure, don't read offsets
    wcv.style.cssText = 'position:absolute;pointer-events:none;z-index:2147483000;max-width:none;margin:0;transform:none;left:'   /* (the hero's copy-column cap squeezed the map to ~2/3 size) */ + (cr.left - hb.left) + 'px;top:' + (cr.top - hb.top) + 'px;width:' + W + 'px;height:' + H + 'px';
    wcv.width = Math.round(W * DPR); wcv.height = Math.round(H * DPR);
    var x = wcv.getContext('2d'); x.setTransform(DPR, 0, 0, DPR, 0, 0);
    x.globalAlpha = .45; x.drawImage(mk, 0, 0, W, H);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = '#ff2050'; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    x.strokeStyle = '#ffd400'; x.lineWidth = 1.5;
    bars.forEach(function (q) { x.beginPath(); x.moveTo(q.x1, q.y); x.lineTo(q.x2, q.y); x.stroke(); });
    wN++;
    x.font = '600 11px -apple-system, system-ui, sans-serif'; x.fillStyle = '#ffd400';
    x.fillText('map #' + wN + ' read at ' + ((performance.now() - wT0) / 1000).toFixed(1) + 's · fonts ' + (document.fonts ? document.fonts.status : '?') +
      ' · ' + innerWidth + 'x' + innerHeight + ' · dpr ' + (devicePixelRatio || 1), 8, 14);
  }

  /* mask queries — CSS px in, CSS px out. The floor line is solid everywhere. */
  /* the floor is the divider, only where it is drawn (her 2026-11-23: "the avatar should just stop at the ends of the
     divider … she can never fall directly in that space") */
  function onFloor(x) { return floorX1 == null || (x >= floorX1 && x <= floorX2); }
  /* THE DIVIDER CAN CURVE UP INTO THE PAGE EDGE (her 2026-11-23: "design the divider so that it almost like curves up and she can
     like run up and get up to the wall"; "she needs to be able to walk all the way to the wall now that this corner radius ramp
     thing is happening"): when the rule carries a drawn line (svg.mk-div inside it, build.js) that line IS her floor, whatever its
     shape. Its two ends are sampled from the path itself once per layout: surf[x] = the top of the line at each whole px (the flat
     middle is floorY), x1/x2 where the flat ends, eL/eR the wall (the page edge it turns up into), topL/R where the wall ends,
     limL/R the steepest spot she can stand on (RAMP_MAX). No path, or it isn't shown: the flat border, as before */
  var ramp = null, rampKey = '', rampMO = null, RAMP_MAX = 35 * Math.PI / 180, SLOPE_TILT = 1;
  function readRamp(rule, hr) {
    var pa = rule && rule.querySelector('svg.mk-div path'), sv = pa && pa.ownerSVGElement;
    if (rule && !rampMO && window.MutationObserver) {   // re-read when the line is redrawn or switched on/off (it is drawn after layout, on its own clock)
      rampMO = new MutationObserver(queueRebuild);
      rampMO.observe(rule, { subtree: true, childList: true, attributes: true, attributeFilter: ['d', 'style'] });
      rampMO.observe(document.documentElement, { attributes: true, attributeFilter: ['data-divider'] });   // (the local review switch shows/hides it; a filter, so scroll-time class flips never cost a re-read)
    }
    var L = pa && pa.getTotalLength ? pa.getTotalLength() : 0;
    if (!L || getComputedStyle(sv).display === 'none') { ramp = null; rampKey = ''; return; }
    var M = pa.getScreenCTM(), dx = -hr.left, dy = -hr.top - liftOf(rule) - .5;   // page px → her stage, where it rests; the surface is the stroke's top
    var key = pa.getAttribute('d') + '|' + [M.a, M.d, M.e, M.f, dx, dy, W, floorY].join(',');
    if (key === rampKey) return;
    var P = function (l) { var q = pa.getPointAtLength(l), x = M.a * q.x + M.c * q.y + M.e, y = M.b * q.x + M.d * q.y + M.f; return { x: x + dx, y: y + dy }; };
    var off = floorY - P(L / 2).y, n = Math.ceil(W) + 2, surf = new Float32Array(n).fill(floorY), ends = [];
    [[0, 1], [L, -1]].forEach(function (e) {   // from each wall's top down its lip and curve to where it runs flat
      var pts = [];
      for (var l = e[0], k = 0; k < 3000 && l >= 0 && l <= L; k++, l += e[1]) { var q = P(l); q.y += off; pts.push(q); if (k > 2 && floorY - q.y < .02) break; }
      for (var i = 1; i < pts.length; i++) { var a = pts[i - 1], b = pts[i];
        if (Math.abs(b.x - a.x) < 1e-3) continue;   // the wall itself
        for (var xi = Math.ceil(Math.min(a.x, b.x)); xi <= Math.floor(Math.max(a.x, b.x)); xi++) if (xi >= 0 && xi < n) surf[xi] = Math.min(surf[xi], a.y + (b.y - a.y) * (xi - a.x) / (b.x - a.x)); }
      ends.push(pts);
    });
    var A = ends[0], B = ends[1];
    if (!A.length || !B.length || A[A.length - 1].x > W / 2 || B[B.length - 1].x < W / 2) { ramp = null; rampKey = ''; return; }
    for (var xi = 0; xi < Math.floor(A[0].x + 1) && xi < n; xi++) surf[xi] = Math.min(surf[xi], surf[Math.min(n - 1, Math.ceil(A[0].x))]);   // (outside the wall: as high as its foot)
    for (xi = Math.ceil(B[0].x); xi < n; xi++) if (xi > 0) surf[xi] = Math.min(surf[xi], surf[Math.max(0, Math.floor(B[0].x))]);
    ramp = { s: surf, x1: A[A.length - 1].x, x2: B[B.length - 1].x, eL: A[0].x, eR: B[0].x, topL: A[0].y, topR: B[0].y };
    var tm = Math.tan(RAMP_MAX), lim = function (x0, st, stop) { for (var x = x0; st * (stop - x) > 0; x += st * .25) if (Math.abs(slopeAt(x)) >= tm) return x; return stop; };
    ramp.limL = Math.max(10, lim(ramp.x1, -1, ramp.eL)); ramp.limR = Math.min(W - 10, lim(ramp.x2, 1, ramp.eR));
    rampKey = key;
  }
  /* the top of the floor line at x: the flat divider, or up its curved ends */
  function floorAt(x) {
    if (!ramp || (x >= ramp.x1 && x <= ramp.x2)) return floorY;
    var s = ramp.s, i = Math.max(0, Math.min(s.length - 2, Math.floor(x))), f = Math.max(0, Math.min(1, x - i));
    return s[i] + (s[i + 1] - s[i]) * f;
  }
  function slopeAt(x) { return (floorAt(x + .75) - floorAt(x - .75)) / 1.5; }   // dy/dx of the line (y down): + on the left curve
  function onCurve(x) { return !!ramp && (x < ramp.x1 || x > ramp.x2); }
  function wallX(side) { return ramp ? (side < 0 ? ramp.eL + .5 : ramp.eR - .5) : side < 0 ? 2 : W - 2; }   // the face of the wall her hand meets
  function solid(x, y) {
    if (y >= floorAt(x)) return onFloor(x);
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    return md[(((y * S) | 0) * W2 + ((x * S) | 0)) * 4 + 3] > 60;
  }
  /* from yStart, find the next surface top at or below it (the y where ink begins) */
  var gtMemo = null;   // while a route is planned: the same scans recur thousands of times (her feet's samples overlap)
  function groundTop(x, yStart, maxScan) {
    if (gtMemo) { var mk = (x * 4096 + Math.round(yStart)) * 1024 + (maxScan || 260), v = gtMemo.get(mk); if (v === undefined) gtMemo.set(mk, v = gt(x, yStart, maxScan)); return v; }
    return gt(x, yStart, maxScan);
  }
  function gt(x, yStart, maxScan) {
    var y = Math.round(yStart), n = 0, cap = maxScan || 260;
    while (!solid(x, y) && n < cap) { y++; n++; }
    if (n >= cap) return null;
    while (solid(x, y - 1) && y > 0) y--;
    return Math.min(y, floorAt(x));   // (the scan steps whole px: on the curve that is up to 1px under its line, so the line's own top)
  }
  /* free headroom above a surface point */
  function clearance(x, ySurface) {
    var n = 0;
    while (n < 90 && !solid(x, ySurface - 2 - n)) n++;
    return n + 2;
  }
  /* the real glyph edge a hand can grip: walk outward from x (within ±rad) for a column
     whose ink bottom sits near the bar line, and return that lowest ink pixel. The bars
     are line-BOX bottoms, which are often air — half-leading below the glyphs, and pure
     nothing in the spaces between words — and a hand must never hold air. */
  function grip(x, barY, rad) {
    x = Math.round(x); barY = Math.round(barY);
    for (var dx = 0; dx <= (rad || 26); dx += 2) {
      for (var s = -1; s <= 1; s += 2) {
        var cx = x + s * dx;
        for (var up = -4; up <= 34; up++) {
          if (solid(cx, barY - up)) return { x: cx, y: barY - up };
        }
        if (!dx) break;
      }
    }
    return null;
  }
  /* the top of the letter in this column of a line (her hands hold the TOPS, the way a hand closes over a bar), or null
     where the column is a gap or the ink starts above the line */
  function glyphTop(x, b) {
    var y0 = Math.round(b.top) - 6, y1 = Math.round(b.y) + 4;
    for (var y = y0; y <= y1; y++) if (solid(x, y)) return y > y0 ? y : null;
    return null;
  }
  /* a hold for a hand: the column near x (between lo and hi, when given) whose letter top is nearest the other hand's
     height, so she goes hand over hand along the x-height, not up and down every capital */
  /* the UNDERSIDE of the letter in this column of a line: the edge just under its lowest ink (her 2026-11-23: "I want her
     to do monkey bars at the bottom of the words, not at the top of the words"), or null for a gap */
  function glyphBottom(x, b) {
    var y0 = Math.round(b.top), y1 = Math.round(b.y) + 4;
    for (var y = y1; y >= y0; y--) if (solid(x, y)) return y < y1 ? y + 1 : null;
    return null;
  }
  /* the line's baseline: the commonest letter bottom along it, so her hands take the baseline, not a descender (y, g, p) */
  function baseOf(b) {
    if (b.base != null) return b.base;
    var a = []; for (var x = Math.round(b.x1); x <= b.x2; x += 2) { var t = glyphBottom(x, b); if (t != null) a.push(t); }
    a.sort(function (p, q) { return p - q; });
    return (b.base = a.length ? a[a.length >> 1] : Math.round(b.y));
  }
  /* the top of the word near x: the commonest letter top within ±30px (the x-height, not the top of a bowl inside a letter) */
  function wordTop(x, b) {
    var a = []; for (var dx = -30; dx <= 30; dx += 2) { var t = glyphTop(Math.round(x + dx), b); if (t != null) a.push(t); }
    a.sort(function (p, q) { return p - q; });
    return a.length ? a[a.length >> 1] : null;
  }
  function topGrip(x, b, rad, nearY, lo, hi, under) {
    if (under && nearY == null) nearY = baseOf(b);
    var best = null;
    for (var dx = 0; dx <= rad; dx += 2) for (var s = -1; s <= 1; s += 2) {
      if (!dx && s > 0) continue;
      var cx = Math.round(x + s * dx);
      if (cx < b.x1 - 2 || cx > b.x2 + 2 || (lo != null && cx < lo) || (hi != null && cx > hi)) continue;
      var t = under ? glyphBottom(cx, b) : glyphTop(cx, b); if (t == null) continue;
      var sc = dx + (nearY == null ? 0 : Math.abs(t - nearY) * 1.5);
      if (!best || sc < best.sc) best = { x: cx, y: t, sc: sc };
    }
    return best;
  }
  /* march along the surface the way the walker would — steps, hops over ascender bumps,
     strides over glyph gaps — until it truly ends WITH a drop below. An ascender is a
     bump, not an edge: falling at one just lands you back at the same height, which is
     exactly the dithering loop this function exists to avoid. */
  /* THE CARTWHEEL TRAVELS (her: "the person doesn't move forward in the direction that they cartwheel"): about one
     body length the way she faces, eased, the feet riding the surface; never past an edge or out of the hero */
  function cartwheelTravel() {
    var c = fig.celeb, n = CW_SEQ.length, sc = CLAY.H / (CLAY.man ? CLAY.man._ref : 252), total = CW_DX[n - 1] * sc;
    if (c.x0 == null) {
      var e = walkEdge(fig.x, fig.y, fig.dir), room = e == null ? (fig.dir > 0 ? W - 10 - fig.x : fig.x - 10) : Math.abs(e - fig.x) - 14;
      c.x0 = fig.x; c.k = Math.max(0, Math.min(1, room / total));   // short of room (an edge): the roll compresses, never overshoots
    }
    var j = Math.min(n - 1, Math.floor(c.t * n)), nx = c.x0 + fig.dir * CW_DX[j] * sc * c.k;   // per frame, like the clay: contacts hold still
    var gy = groundTop(nx, fig.y - STEP_UP, STEP_UP + STEP_DOWN + 4);
    if (gy != null && gy >= fig.y - STEP_UP - .5 && gy <= fig.y + STEP_DOWN + .5) { fig.x = nx; fig.y = gy; }
  }
  /* A LEVEL WALK ALONG A LINE OF TYPE (her 2026-10-26: "walking on the text looks super glitchy"; her pick, "smooth level
     walk"): her feet read the ground across their whole span, not one pixel column, and stand on the SHORT letters'
     tops, the line's x-height, like a floor; an ascender or capital under one foot passes behind her legs, and the gap
     between two letters or words is spanned. One column snapped her to every glyph top and into every gap (pops of up
     to 12px, every other frame). A real change of level is still a step: when the ground right under her middle is
     higher than the level by more than an ascender, or the level is gone under it and lower ground is there. */
  function levelAt(x, y) {
    var ts = [], mid = null, low = null, any = false, L = false, R = false;
    var t0 = groundTop(x, y - STEP_UP, STEP_UP + STEP_DOWN + 4);
    /* ink taller than a step right where she'd stand, rising from her ground: a wall, not a stem to pass. Ink up there
       with air below it is the line above's descenders hanging over her (the bio lines sit 36px apart): she walks under
       them, where she used to read a wall and hop up onto the line above */
    if (t0 != null && t0 < y - STEP_UP - .5 && solid(x, y - 3)) return null;
    for (var k = -12; k <= 12; k += 4) {
      var t = k ? groundTop(x + k, y - STEP_UP, STEP_UP + STEP_DOWN + 4) : t0;
      if (t == null || t < y - STEP_UP - .5 || t > y + STEP_DOWN + .5 || !openAbove(x + k, t, MIN_CLR - 2)) continue;   // openAbove: clearance() >= MIN_CLR, without counting to 90
      var c = Math.abs(k) <= 4;
      if (Math.abs(k) <= 8) any = true;
      if (t < y - 2.5 && !openAbove(x + k, t, 30)) continue;   // a step UP needs room for her: not the bottom of the line above's letters (she'd climb into that line and loop)
      if (t <= y + 6) { ts.push(t); if (c && (mid == null || t < mid)) mid = t; if (k < 0) L = true; if (k > 0) R = true; }
      else if (c && (low == null || t < low)) low = t;
    }
    if (mid != null && mid < y - 8) return mid;                  // a real step up, under her middle
    if (mid == null && low != null && !(L && R)) return low;     // the level ends under her: a step down (level both sides: a word space)
    if (ts.some(function (t) { return Math.abs(t - y) <= 2.5; })) return y;   // still on her level: not a pixel of bob
    /* off it (she landed on an ascender, or a new line's letters start): the height at least two foot samples agree on */
    var best = null, bn = 1;
    ts.forEach(function (t) { var n = ts.filter(function (u) { return Math.abs(u - t) <= 1.5; }).length;
      if (n > bn || (n === bn && best != null && t > best)) { bn = n; best = t; } });
    return best != null ? best : any ? y : null;   // a gap between letters, or only a stem underfoot: the level carries on (null: an edge)
  }
  function walkEdge(x0, y0, dir) {
    var y = y0;
    for (var n = 3; n < 500; n += 3) {
      var cx = x0 + dir * n;
      if (cx < 6 || cx > W - 6) return null;
      var t = groundTop(cx, y - HOP_UP, HOP_UP + STEP_DOWN + 4);
      if (t != null && t >= y - HOP_UP - 0.5 && t <= y + STEP_DOWN + 0.5) { y = t; continue; }
      var t2 = groundTop(cx + dir * 8, y - HOP_UP, HOP_UP + STEP_DOWN + 4);
      if (t2 != null && t2 >= y - HOP_UP - 0.5 && t2 <= y + STEP_DOWN + 0.5) { y = t2; n += 8; continue; }
      var below = groundTop(cx + dir * 4, y + 2, 420);
      if (below == null || below > y + STEP_DOWN) return cx + dir * 12;
      y = below;
    }
    return null;
  }
  /* all surface tops in a column between two heights — for stepping-stone searches */
  function topsIn(x, yMin, yMax) {
    var res = [];
    for (var y = Math.round(yMin); y <= yMax; y++) if (solid(x, y) && !solid(x, y - 1)) res.push(y);
    return res;
  }

  /* ------------------------------------------------------------------ figure state */
  var fig = {
    x: 0, y: 0,            // FEET
    vx: 0, vy: 0, dir: 1,
    state: 'sign',         // sign | idle | move | air | hang | mantle | celeb | wave
    phase: 0,
    gait: 0,               // the walk cycle's own clock — slows as the stride lengthens
    target: null,          // {x, y, tries}
    waypoint: null,        // {x, y, drop}
    drag: null,
    flip: null,
    fallFrom: 0,
    landT: 0, land0: 0, slideT: 0,
    loadT: 0, load0: 0, loadV: null,   // the crouch before a launch: its timer and the launch it holds
    hang: null,
    mantle: null,
    flipQueued: false,     // one landing-prediction per airtime — reset on the ground
    celeb: null,
    celebIdx: 0,
    hangCool: 0,
    wave: 0, prev: null,
    crawl: 0,              // 0..1 — how folded-up the low-clearance pose is
  };
  var mouse = { x: 0, y: 0 };
  var puffs = [];
  var visible = true;

  function spawn() {
    /* boot standing ON the headline, not down at the CTA (her 2026-08-17 note —
       tucked beside the say-hey button he went unnoticed; perched on the biggest
       type he's the first thing the eye snags on). Scan columns across the first
       headline line for a glyph top with real headroom; the CTA sign-hold remains
       the fallback if the headline isn't there to stand on.

       Phones used to boot him on the hero FLOOR (2026-08-19), and that is where the
       "can't see the stickman on mobile" reports came from: the hero is 100vh, phone
       browsers show less than that behind their toolbars, so the floor — and him on
       it — sat below the first screen. 2026-09-06 her ask: same place as desktop, on
       the d. The say-hey/night-pill corner collision that motivated the floor only
       applies to the CTA sign-hold FALLBACK, which phones now share with desktop and
       reach just as rarely. */
    var h1 = hero.querySelector('h1');
    if (h1) {
      var r = localRect(h1, cv.getBoundingClientRect());
      /* her 2026-08-19 note: he loads standing ON THE d of "Madhu". Find the d among the
         .ch spans (app.js split the headline per glyph) and aim for its bowl; the old
         left-to-right scan below stays as the fallback so a future headline without a
         d still gives him somewhere to stand. */
      var dEl = null, chs = h1.querySelectorAll('.ch');
      for (var ci = chs.length - 1; ci >= 0; ci--) {
        if (chs[ci].textContent === 'd') { dEl = chs[ci]; break; }
      }
      if (dEl) {
        var dr = localRect(dEl, cv.getBoundingClientRect());
        var gh = dr.y2 - dr.y1;
        /* the STEM, not the bowl (2026-08-19 "have the stick figure start on the top of
           the stem of the d"): in Cormorant the d's ascender is its right-hand stroke, so
           walk columns in from the right edge and take the first whose ink top sits in
           the upper third of the glyph box — that is the stem; the bowl's top is a whole
           x-height lower. The bowl columns below stay as the fallback for a headline
           whose d (or typeface) is shaped differently. */
        for (var fs = 0.94; fs >= 0.45; fs -= 0.03) {
          var sx = Math.round(dr.x1 + dr.w * fs);
          var st = groundTop(sx, Math.max(0, dr.y1 - 30), gh + 40);
          if (st != null && st < dr.y1 + gh * 0.33 && clearance(sx, st) > MIN_CLR) {
            fig.x = sx; fig.y = st; fig.dir = 1; fig.state = 'idle';
            return;
          }
        }
        /* three columns across the glyph: centre first, then either side of the bowl */
        var dxs = [(dr.x1 + dr.x2) / 2, dr.x1 + dr.w * 0.35, dr.x1 + dr.w * 0.65];
        for (var di = 0; di < dxs.length; di++) {
          var dx = Math.round(dxs[di]);
          var dt = groundTop(dx, Math.max(0, dr.y1 - 30), (r.y2 - dr.y1) + 40);
          if (dt != null && dt < r.y2 - 8 && clearance(dx, dt) > MIN_CLR) {
            fig.x = dx; fig.y = dt; fig.dir = 1; fig.state = 'idle';
            return;
          }
        }
      }
      for (var fx = 0.22; fx < 0.75; fx += 0.06) {
        var x = Math.round(r.x1 + r.w * fx);
        var t = groundTop(x, Math.max(0, r.y1 - 30), (r.y2 - r.y1) + 40);
        if (t != null && t < r.y2 - 8 && clearance(x, t) > MIN_CLR) {
          fig.x = x; fig.y = t; fig.dir = 1; fig.state = 'idle';
          return;
        }
      }
    }
    if (!sign) { fig.x = W * 0.3; fig.y = floorY; return; }
    fig.x = sign.cx;
    fig.y = floorY;
    fig.dir = 1;
    fig.state = 'sign';
  }

  /* ------------------------------------------------------------------ celebrations */
  /* her 2026-10-26 (#85): the first click on her is the cartwheel, the second the flip; then the star and the bow, round
     again. The dance is out of the rotation (her call 2026-10-24: she didn't like how it looks) */
  var CELEBS = ['cartwheel', 'backflip', 'star', 'bow'];
  function celebrate() {
    if (fig.state === 'air' || fig.state === 'hang' || fig.state === 'mantle') return;
    /* the trick frames load on idle, or on a slow connection only now (#102): the move plays the moment they're in */
    var name = CELEBS[fig.celebIdx % CELEBS.length], need = { cartwheel: ['cartwheel-in', 'cartwheel-50'], backflip: ['backflip-x3'], star: ['star-bow-x3'], bow: ['star-bow-x3'] }[name] || [];
    if (CLAY.ready && CLAY.sheetIn && need.some(function (k) { return !CLAY.sheetIn[k]; })) {
      CLAY.onSheet = function () { if (need.every(function (k) { return CLAY.sheetIn[k]; })) { CLAY.onSheet = null; celebrate(); } };
      if (CLAY.tricks) CLAY.tricks(need);
      return;
    }
    fig.target = null; fig.waypoint = null; fig.vx = 0;
    fig.celeb = { name: name, t: 0, dur: { star: 1.1, backflip: 1.0, dance: 1.5, cartwheel: 1.3, bow: 1.2 }[name] };
    fig.celebIdx++;
    fig.state = 'celeb';
    start();
  }
  /* THE JUMP! BOX (2026-10-23 her ask: "the claymation madhu does a tuck flip slam jump on it"). app.js sends
     'mk-box-jump' with the box; she leaves on a true projectile whose apex clears both her and the lid by 110px,
     throws ONE tuck flip timed to finish just before her feet arrive, and lands hard (see the landing hook). No
     steering in the air (no target), so the arc is exactly the one solved here. */
  addEventListener('mk-box-jump', function (e) {
    if (!booted || rmActive() || !e.detail || !e.detail.el) return;
    boxLaunch(e.detail.el);
  });
  function boxLaunch(el) {
    var r = localRect(el, cv.getBoundingClientRect());
    var tx = (r.x1 + r.x2) / 2, ty = r.y1;
    if (fig.state === 'hang') release(0);
    fig.celeb = null; fig.target = null; fig.waypoint = null; fig.drag = null; fig.wave = 0;
    /* FORCEFUL (her: "momentum filled and forceful so the cloud immediately pops"): a lower apex and 1.8x gravity — she
       snaps up, spins fast, and drives down into the cloud */
    var GB = G * 1.8, apex = Math.min(fig.y, ty) - 80, up = fig.y - apex, dn = ty - apex;
    var T = Math.sqrt(2 * up / GB) + Math.sqrt(2 * dn / GB);
    fig.vy = -Math.sqrt(2 * GB * up); fig.vx = (tx - fig.x) / T;
    /* the spinning tuck flip, facing the cloud (her call: the clay backflip version was tried 2026-10-24 and "the jump on
       the cloud used to be cooler" — this one) */
    fig.dir = tx >= fig.x ? 1 : -1;
    fig.fallFrom = fig.y; fig.state = 'air'; fig.flipQueued = true;
    startFlip(fig.dir); fig.flip.w = (Math.PI * 2) / (T * 0.85);
    fig.boxJump = { at: performance.now(), g: GB };
    start();
  }
  /* THE CLOUD MAGNET (her rule 2026-10-24: "if the person is going to make contact with the cloud the motion always has
     to be tuck jump flip slam"). Every frame: if she's been sent to the cloud and is within a leap of it, or she's
     come close to it any other way (mid-air, climbing its edge, walking under its lip), she launches the same tuck
     jump flip slam its click sends. Standing on the floor beneath it doesn't count; neither does dropping out of it. */
  function cloudMagnet() {
    if (fig.boxJump || fig.dropping || fig.state === 'hang' || rmActive()) return;
    var cl = hero.querySelector('.jump-box:not(.gone)'); if (!cl) return;
    var r = localRect(cl, cv.getBoundingClientRect()), ctop = r.y1 + r.h * .12, cx = (r.x1 + r.x2) / 2, g = fig.waypoint || fig.target;
    var sentThere = g && g.x >= r.x1 - 10 && g.x <= r.x2 + 10 && Math.abs(g.y - ctop) < 16 && Math.abs(fig.x - cx) < 380;
    var close = fig.x > r.x1 - 50 && fig.x < r.x2 + 50 && fig.y > ctop - 130 && fig.y < r.y2 + 110 && (fig.state === 'air' || fig.state === 'mantle' || fig.state === 'move');
    if (sentThere || close) { if (fig.state === 'mantle') fig.mantle = null; boxLaunch(cl); }
  }
  addEventListener('mk-terrain', queueRebuild, { passive: true });
  /* the web fonts now load without blocking the page, so they can arrive AFTER she boots: re-read the letters she stands on */
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', queueRebuild);
  addEventListener('tweak', queueRebuild);   // a local tweaker resized the hero (studies/tweaker-hero/)
  /* the box dissolved under her: the world is rebuilt without it at once, and she simply drops (no flip) */
  addEventListener('mk-box-gone', function () {
    if (!booted) return;
    rebuild();
    if (fig.state === 'idle' || fig.state === 'move' || fig.state === 'sign' || fig.state === 'wave' || fig.state === 'celeb') {
      fig.celeb = null; fig.target = null; fig.waypoint = null;
      fig.state = 'air'; fig.vy = 0; fig.vx = 0; fig.fallFrom = fig.y; fig.flipQueued = true; fig.dropping = true;   // all the way to the floor
      start();
    }
  });
  /* one wave, then a breather (her 2026-10-26: "sometimes the avatar glitches when I move my mouse near it"): a cursor
     wobbling on her outline started a fresh wave every time it crossed back in, 14 frames after the last one ended */
  var waveAt = -1e9;
  function waveHello() {
    if (rmActive() || fig.loadT || (CLAY.ready && !CLAY.moveReady) || performance.now() - waveAt < 3600) return;
    if (fig.state === 'idle' || fig.state === 'sign' || (fig.state === 'move' && !fig.target && !fig.drag)) {
      waveAt = performance.now();
      fig.prev = fig.state === 'sign' ? 'sign' : 'idle';
      fig.state = 'wave'; fig.wave = 0;
      start();
    }
  }

  /* ------------------------------------------------------------------ input */
  var down = null, lastTap = null;
  /* stage coordinates come from the canvas rect, and the listeners sit on the document:
     the hero ELEMENT is capped at 1240px, so a click in the strip between it and the
     screen edge never reached a hero listener — the one stretch he can run that he could
     not be SENT. pointerdown gates to the canvas band (and skips controls and the nav),
     so the rest of the page stays an ordinary page. */
  function stagePoint(e) {
    var r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  document.addEventListener('pointermove', function (e) {
    /* the listener is document-wide (the run-to-the-edge fix), so bail while the hero
       is scrolled away — no rect reads on every mousemove over the rest of the page */
    if (!visible && !down) return;
    var p = stagePoint(e); mouse.x = p.x; mouse.y = p.y; CLAY.away = false;
    wallRestFree(p);
    /* her ask: hover over clay-her and she smiles (the standing frame swaps to its smile twin) */
    var sm = !touchMode && CLAY.ready && onClay(p, CLAY.smile ? 14 : 0);   // let go 14px further out than it catches: no flicker on her edge
    /* …and as the cursor arrives on her she WAVES with one hand, smiling (her ask 2026-10-24), then keeps smiling
       while you stay; the same wave she gives the say-hey button. Once per arrival. */
    if (sm && !CLAY.smile) waveHello();
    if (sm !== CLAY.smile) { CLAY.smile = sm; if (!raf) draw(performance.now()); }
    /* drag never arms on touch — a moving finger on the hero is the page scrolling */
    if (!touchMode && down && !down.moved && Math.hypot(p.x - down.x, p.y - down.y) > 10) { down.moved = true; hero.classList.add('stick-dragging'); }
    /* HOLD AND DRAG = she FOLLOWS you (her 2026-10-26: "if I hold and drag can it follow me"): the spot under the pointer
       is her target, walked (or run, if it's far) along the surfaces like a click, never a grab into the air. A new spot
       every 24px of pointer travel, at most every 200ms (a plan is ~30ms), plus the last one once the pointer rests */
    if (down && down.moved && !rmActive()) {
      /* DRAG UP = JUMP (her 2026-10-26, #78): a stroke up 60px from the lowest point of the drag, more up than across,
         launches her (higher for a longer stroke) toward the pointer, free to catch the text and hang; fast enough
         across, she flips */
      if (down.jy == null || p.y >= down.jy - 4) { down.jy = Math.max(p.y, down.jy || p.y); down.jx = p.x; }   // the stroke starts where the drag last ran level or down
      if (down.jy - p.y > 60 && down.jy - p.y > Math.abs(p.x - down.jx) && !onCurve(p.x) && dragJump(down.jy - p.y, p)) { down.jy = p.y; down.jx = p.x; return; }   // (up the divider's curved end it is the wall attempt instead: wallLead)
      down.p = p; clearTimeout(down.tt);
      var now = performance.now(), tg = fig.target;
      if (!tg || !tg.follow || (now - (down.ft || 0) > 120 && Math.abs(tg.x - p.x) + Math.abs(tg.py - p.y) > 24)) follow(p);
      else { var dd = down; dd.tt = setTimeout(function () { if (down === dd) follow(dd.p); }, 140); }
    }
  }, { passive: true });
  function dragJump(up, p) {
    if (CLAY.ready && !CLAY.moveReady) return false;
    if (fig.state !== 'move' && fig.state !== 'idle') return false;
    fig.target = null; fig.waypoint = null; fig.celeb = null; fig.hangCool = 0; fig.flip = null; fig.flipQueued = false;
    var ab = !fig.loadT && aimBar(p);
    if (ab && fig.y - ab.y > JUMP_MAX && hangJump(ab, p)) { start(); return true; }   // a line out of a plain jump's reach: aimed
    var vy = -Math.sqrt(2 * G * (Math.min(up * 1.6, JUMP_MAX) + 20)), vx = Math.max(-RUN, Math.min(RUN, (p.x - fig.x) * 1.5));
    if (Math.abs(vx) > 20) fig.dir = Math.sign(vx);
    if (Math.abs(vx) > 240) flipFor(2 * -vy / G);
    if (fig.loadT) { fig.loadV = { vx: vx, vy: vy }; return true; }   // already crouched for a jump of her own: this one goes instead
    fig.vy = vy; fig.vx = vx; fig.fallFrom = fig.y; fig.state = 'air';
    puff(fig.x, fig.y, 2); start();
    return true;
  }
  /* THE ARROW KEYS (her 2026-10-26, #97: "I want to be able to move the character with arrows on the keyboard"): Left/Right
     run her along whatever she's on (in the air they steer, hanging she goes hand over hand), Up jumps (crouch, whoosh;
     hanging, a muscle-up), Down drops through what she stands on to the next thing below (hanging, she lets go).
     Only while she's on screen and focus is on the page or in the hero, never in the deck, a field or a dialog; Up only
     once you're driving her (or the page is at its top) and Down only then AND when there's somewhere to drop, so the
     arrows still scroll the page whenever she isn't using them. Each key she uses is the only one preventDefault'd. */
  var keys = {}, keyAt = -1e9;
  function keyOK(e) {
    if (!booted || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || rmActive() || !visible) return false;
    var a = document.activeElement;
    if (a && a !== document.body && a !== document.documentElement && (!hero.contains(a) || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return false;
    var y = cv.getBoundingClientRect().top + fig.y;
    return y > 0 && y - CLAY.H < innerHeight;   // she's on screen
  }
  function steer() {
    var dir = (keys[1] ? 1 : 0) - (keys[-1] ? 1 : 0);
    if (!dir) { if (fig.drag && fig.drag.key) fig.drag = null; return; }
    fig.target = null; fig.waypoint = null; fig.celeb = null; fig.dir = dir;
    fig.drag = { vx: dir * RUN, key: true };
    if (fig.state === 'idle' || fig.state === 'sign' || fig.state === 'celeb' || fig.state === 'wave') fig.state = 'move';
  }
  function keyJump() {
    if (fig.state !== 'mantle') fig.muStand = false;
    if (CLAY.ready && !CLAY.moveReady) return;
    if (fig.state === 'hang') { muscleUp(); return; }
    if ((fig.state !== 'move' && fig.state !== 'idle') || fig.loadT) return;
    fig.target = null; fig.waypoint = null; fig.celeb = null; fig.hangCool = 0; fig.flip = null; fig.flipQueued = false;
    fig.vy = -Math.sqrt(2 * G * (JUMP_MAX * .6 + 20)); fig.vx = fig.drag ? fig.drag.vx : 0;
    if (Math.abs(fig.vx) > 240) flipFor(2 * -fig.vy / G);   // a running jump flips
    fig.fallFrom = fig.y; fig.state = 'air';
  }
  function tapJump(p) {
    if (CLAY.ready && !CLAY.moveReady) return;
    if (fig.state === 'hang') return;
    if (fig.state === 'air' || fig.state === 'mantle' || fig.loadT) {   // mid-climb from the first tap: stop the climb, jump on landing
      fig.target = null; fig.waypoint = null; fig.tapQ = { x: p.x, y: p.y, t: performance.now() }; return;
    }
    fig.target = null; fig.waypoint = null; fig.celeb = null; fig.hangCool = 0; fig.flip = null; fig.flipQueued = false; fig.state = 'idle';
    var ty = clickGround(p), b = ty != null && ty < fig.y - STEP_UP ? { x: p.x, y: ty } : null, ab;
    /* (phone-only "stand on it, no hang first" of 2026-11-24 removed 2026-11-25: on a phone a tap above her is the same jump-and-hang as on a laptop) */
    if (canHang() && (ab = aimBar(p) || overheadBar(p)) && hangJump(ab, p, false)) { }   // phones too since 2026-11-25: a tap above her = jump up and hang (monkey bars)   // phone: too high for one jump, so up by the letters and a muscle-up onto them (auto); a word double-tapped: up to hang from it (her 2026-11-23: never an automatic muscle-up)
    else if (b && arcLands(fig.x, fig.y, b)) { routeJump(b); fig.waypoint = null; }   // a line up there she can reach: onto it
    else {   // nothing to land on in reach: straight up toward the finger and back down
      fig.dir = p.x >= fig.x ? 1 : -1;
      jumpFor(Math.max(40, fig.y - p.y), 0); fig.vx = Math.max(-220, Math.min(220, (p.x - fig.x) * 1.6));
    }
    start();
  }
  /* THE DOUBLE JUMP (her 2026-11-23, #965): a second push from the air, once per flight, toward the second click: up to hang
     from the line there if her hands can reach it from here (no flip: her hands are for the letters), else a tuck flip over
     the top of it. The swish as she comes down; the boing only if it lifts her more than her own height (the sound rule) */
  function doubleJump(p) {
    if (fig.dbl || fig.state !== 'air' || fig.wall || fig.parkour || fig.boxJump) return;
    fig.dbl = true;
    var ab = canHang() && aimBar(p), hr = ab && hangRise(ab, Math.max(ab.x1 + 8, Math.min(ab.x2 - 8, p.x)), fig.y), rise;
    if (hr && fig.fallFrom != null && fig.fallFrom - ab.y > reach()) hr = null;   // her reach counts from where she took off, not from mid-air
    if (hr && hr.rise <= JUMP_MAX) { fig.aim = ab; fig.hangGoal = p.x; rise = hr.rise + 4; }
    else { fig.aim = null; hr = null; rise = Math.max(80, Math.min(JUMP_MAX * .6, fig.y - p.y)); }
    var v = -Math.sqrt(2 * G * rise), tUp = -v / G;
    fig.vy = v; fig.vx = Math.max(-RUN, Math.min(RUN, ((hr ? hr.g.x : p.x) - fig.x) / tUp));
    if (Math.abs(fig.vx) > 20) fig.dir = Math.sign(fig.vx);
    fig.fallFrom = fig.y; fig.target = null; fig.waypoint = null; fig.hangCool = 0; fig.flip = null; fig.flipQueued = !!hr;
    if (!hr) flipFor(2 * tUp);
    fig.shhV = v; if (rise >= herH()) once('jump', function () { springJump(v, 'rise'); });
    puff(fig.x, fig.y, 2);
  }
  function keyDrop() {
    if (fig.state === 'hang') { release(0); return true; }
    if ((fig.state !== 'move' && fig.state !== 'idle') || fig.y >= floorAt(fig.x) - 4) return false;
    fig.target = null; fig.waypoint = null; fig.celeb = null;
    fig.thru = fig.y + 28;   // through the letters under her feet; she lands on whatever comes next
    fig.state = 'air'; fig.vy = 60; fig.fallFrom = fig.y; fig.hangCool = 0.5;
    return true;
  }
  document.addEventListener('keydown', function (e) {
    var k = e.key, dir = k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : 0;
    if ((!dir && k !== 'ArrowUp' && k !== 'ArrowDown') || !keyOK(e)) return;
    if (fig.state === 'enter') endEnter();
    var driving = performance.now() - keyAt < 4000;
    if (dir) { keys[dir] = true; steer(); }
    else if (k === 'ArrowUp') { if (!driving && scrollY > 2) return; if (!e.repeat) keyJump(); }
    else if (!driving || (!e.repeat && !keyDrop())) return;
    keyAt = performance.now(); e.preventDefault(); start();
    if (CLAY.tricks) CLAY.tricks();
  });
  document.addEventListener('keyup', function (e) { var dir = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0; if (dir && keys[dir]) { keys[dir] = false; steer(); } });
  addEventListener('blur', function () { keys = {}; steer(); });
  /* A FINGER DRAGS HER ALONG THE BARS TOO (her 2026-11-23: "I want her to be able to follow my cursor drag"): on a phone a moving finger
     is the page scrolling, so a drag never arms on touch. While she hangs, a finger that sets off sideways from her line (its band,
     down to her feet) drags her along it instead (the pointermove follow above). The listener can't be passive (it stops that scroll),
     so it is only there while she hangs: everywhere else the page scrolls exactly as before */
  var hangTouchOn = false;
  function hangTouchMove(e) {
    if (!down || down.hz === false || (fig.state !== 'hang' && !down.hz) || e.touches.length !== 1) return;
    var p = stagePoint(e.touches[0]);
    /* off the end of the bars (barPast) the same finger keeps leading her on the ground: the page still mustn't scroll under it,
       and the throttled pointermove follow does the leading */
    if (fig.state !== 'hang') { if (e.cancelable) e.preventDefault(); mouse.x = p.x; mouse.y = p.y; return; }
    if (down.hz == null) {
      var dx = p.x - down.x, dy = p.y - down.y, b = fig.hang.bar; if (!dx && !dy) return;
      down.hz = Math.abs(dx) > Math.abs(dy) && down.y > (b.top != null ? b.top : fig.hang.G.y - 40) - 30 && down.y < fig.y + 30;
      if (!down.hz) return;
    }
    if (e.cancelable) e.preventDefault();
    if (!down.moved) { down.moved = true; hero.classList.add('stick-dragging'); }
    mouse.x = p.x; mouse.y = p.y; follow(p);
  }
  function hangTouch(on) {
    if (on === hangTouchOn) return;
    hangTouchOn = on;
    if (on) document.addEventListener('touchmove', hangTouchMove, { passive: false }); else document.removeEventListener('touchmove', hangTouchMove, { passive: false });
  }
  /* LED UP THE WALL (her 2026-11-23: "When I try to lead her up the wall, she like glitches. She needs to like try to go up the wall
     and then, or like jump or I don't know, do something to try to go up the wall just a little bit and then like do her like jump
     off wall thing"): a drag that reaches the divider's curved end, or goes on up the wall, is ONE attempt: she runs up the curve,
     springs up the wall a little and does her wall rebound (rampCling), landing on the flat by the wall's foot. She stood flickering
     at the steepest spot (every pointer move re-sent her, she arrived, stopped, was sent again) and hopped at the strokes up the wall.
     Then she WAITS there (fig.wallRest) while the pointer stays at that wall; it going back out over the flat, or a new press, frees her */
  function wallLead(p) {
    if (!ramp || !onCurve(p.x)) return false;
    var side = p.x < W / 2 ? -1 : 1;
    if (fig.wallRest && fig.wallRest.side === side) {   // done that: wait on the flat by the wall's foot
      var rx = side < 0 ? ramp.x1 + 40 : ramp.x2 - 40;
      if (Math.abs(fig.x - rx) > 40 && !(fig.target && fig.target.rest)) { fig.target = { x: rx, y: floorY, tries: 0, follow: true, rest: true }; fig.waypoint = null; wake(); }
      return true;
    }
    if (fig.target && fig.target.wall === side) return true;   // already on her way up it
    var lim = side < 0 ? ramp.limL : ramp.limR;
    fig.target = { x: lim, y: floorAt(lim), tries: 0, wall: side, follow: true }; fig.waypoint = null; wake();
    return true;
  }
  function wake() { if (fig.state === 'idle' || fig.state === 'sign' || fig.state === 'celeb' || fig.state === 'wave') { fig.state = 'move'; fig.celeb = null; } start(); }
  function wallRestFree(p) {
    var R = fig.wallRest;
    if (R && ramp && (R.side < 0 ? p.x > ramp.x1 + 60 : p.x < ramp.x2 - 60)) fig.wallRest = null;
  }
  function follow(p) {
    /* in the air (or crouching to go) the drag waits for her to land, then she follows on from there */
    if (fig.loadT || fig.state === 'air' || fig.state === 'mantle') {
      var dw = down; if (dw) { clearTimeout(dw.tt); dw.tt = setTimeout(function () { if (down === dw) follow(dw.p || p); }, 120); }
      return;
    }
    /* hanging: she goes hand over hand after the pointer (tickHang); dragged well below her, she lets go */
    if (fig.state === 'hang') {
      if (p.y > fig.y + 60) release(Math.sign(p.x - fig.x)); else fig.hang.goal = p.x;
      return;
    }
    if (down) down.ft = performance.now();
    if (wallLead(p)) return;
    var ty = groundTop(p.x, p.y - 2, H);
    fig.target = { x: p.x, y: ty == null ? floorY : ty, py: p.y, tries: 0, follow: true }; fig.waypoint = null;
    if (fig.state === 'idle' || fig.state === 'sign' || fig.state === 'celeb' || fig.state === 'wave') { fig.state = 'move'; fig.celeb = null; }
    start();
  }
  /* cursor left the window: forget where it was, or she keeps smiling at nobody */
  document.addEventListener('pointerout', function (e) { if (!e.relatedTarget) { CLAY.away = true; CLAY.smile = false; if (!raf && CLAY.ready) draw(performance.now()); } });
  /* her muscle-up is a double click above her hands: it must not also select the word under it */
  document.addEventListener('mousedown', function (e) { if (e.detail > 1 && (fig.state === 'hang' || fig.state === 'mantle') && e.target.closest && e.target.closest('.hero')) e.preventDefault(); });
  document.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || rmActive()) return;
    if (fig.state === 'enter' && !(e.target.closest && e.target.closest('a,button,nav'))) endEnter();   // mid-entrance, a press takes over at once
    if (e.target.closest && e.target.closest('a,button,nav')) return;
    var p = stagePoint(e);
    if (p.x < 0 || p.x > W || p.y < 0 || p.y > H) return;
    down = Object.assign(p, { t: performance.now(), moved: false });
    fig.wallRest = null;   // a new press: she may go up the wall again
    if (fig.state !== 'mantle') fig.muStand = false;   // a new press: she may hang again (one made during the muscle-up itself doesn't count)
    if (CLAY.tricks) CLAY.tricks();   // someone's playing with her: the trick frames come now (on a slow connection they wait for this)
  }, { passive: true });
  /* a touch the browser reclaims for scrolling ends in pointercancel, not pointerup —
     without this a scroll leaves a stale `down` behind */
  addEventListener('pointercancel', function () { hero.classList.remove('stick-dragging'); down = null; fig.drag = null; });
  addEventListener('pointerup', function (e) {
    hero.classList.remove('stick-dragging');
    if (!down) { fig.drag = null; return; }
    var wasDrag = down.moved; down = null;
    if (rmActive()) { fig.drag = null; return; }
    if (wasDrag) {   // let go: she stops where she is (no fling, no jump)
      fig.target = null; fig.waypoint = null; fig.drag = null;
      start();
      return;
    }
    fig.drag = null;
    var p = stagePoint(e);
    if (p.x < 0 || p.x > W || p.y < 0 || p.y > H) return;
    var pelY = fig.y - LEG * (1 - fig.crawl * 0.6);
    /* the clay figure is bigger than the stick one, so tapping anywhere on her body counts */
    var onHer = CLAY.ready ? onClay(p) : Math.hypot(p.x - fig.x, p.y - (pelY - TO / 2)) < 46;
    if (onHer && fig.state !== 'hang') {   // (hanging, a click on her is a monkey-bar click: never a drop, her 2026-11-23)
      celebrate();
      return;
    }
    /* SHE FINISHES THE MUSCLE-UP (her 2026-11-25: "rather than muscle upping and then just standing on top of the text that she just
       muscled up over, she jumps up further and monkey bars on the text above that. I don't want her to do that extra step. I just want
       her to finish the muscle up and stand on that text"): a 2nd tap, or the 2nd half of a double tap, while she is still climbing out
       of the hang used to set a new goal (up onto the next line, or back down) that took over the moment she stood. Now it is ignored */
    if (fig.state === 'mantle' && fig.muStand) { lastTap = null; return; }
    var tnow = performance.now(), lt = lastTap; lastTap = { t: tnow, x: p.x, y: p.y };
    var dbl = lt && tnow - lt.t < 400 && Math.hypot(p.x - lt.x, p.y - lt.y) < 70;
    var reach = CLAY.ready ? CLAY.H : 90, herTop = fig.y - (CLAY.ready ? CLAY.H : LEG + TO), grounded = /^(idle|move|sign|wave)$/.test(fig.state) && !fig.loadT;
    if (fig.state === 'hang') {
      /* MONKEY BARS (her 2026-11-23: "I can't get her to monkey bar … every time I click up, she does a muscle up and goes
         over … if I click another place, she goes down and then comes back up"): a click or tap anywhere along the line she
         holds sends her there hand over hand; only a click well below her lets her drop and walk there.
         ABOVE the line she holds (her 2026-11-23, #962: "I click above her, she should still try to go there. I shouldn't have
         to double click to like the muscle up to then move up"): ONE click, and she muscles up onto it and goes on to the spot
         (a route), or, with nothing to stand on there, jumps for it once she's up (#965) */
      var hb = fig.hang.bar, G0 = fig.hang.G;
      /* ON A PHONE A TAP ENDS WITH HER STANDING (her 2026-11-24: "on mobile, the avatar is constantly going into monkey bars as the
         default ... If she's already on monkey bars and I click above her, she shouldn't go back into monkey bars. She should, no matter
         what, always go into standing on something"): hanging, any tap that isn't well below her is a muscle-up onto the line she holds
         (then a walk to the spot if it is on that line); the desktop monkey-bar travel and the tap-near-her stop are mouse-only. No
         muscle-up possible there: she lets go and lands on what is below */
      /* A CLICK ABOVE HER WHILE SHE HANGS IS A MUSCLE-UP, NEVER MORE HANGING (her 2026-11-25: "she's hanging on the monkey bars ... The next
         thing that I do is tap above her in the white space between some letters. Rather than just muscling up and standing on those
         letters, she attempts to hang once again ... If I wanted her to hang, I would then, from the standing position, ask her to, like,
         jump up or click above her again"): on a laptop "above" only counted from the line's TOP, so a click on the line she holds,
         between the letters right over her head (or a gap between words there), was the click-near-her stop and she kept swinging under
         the cursor. Now anything at or above her hands within her reach is above her too; clicks beside her body stay the stop, and
         clicks further along the line stay the hand-over-hand travel (her 2026-11-23 rules) */
      var upTap = p.y < (hb.top != null ? hb.top : G0.y - 30) - 6 || (p.y <= G0.y + 4 && Math.abs(p.x - G0.x) < (CLAY.ready ? CLAY.H : 120) * .6);   // phones too since 2026-11-25: a tap further along the line is hand-over-hand travel, as on a laptop
      if (upTap) {
        lastTap = null;
        if (muscleUp()) { var gy = clickGround(p);
          if (gy != null && Math.abs(gy - fig.mantle.y1) <= 8) { if (Math.abs(p.x - fig.mantle.x1) > 12) fig.target = { x: p.x, y: gy, tries: 0 }; } }   // on top of the line she held: she walks there; higher up, she just stands (fig.muStand: a new click takes her on)
        else release(0);   // no way up over these letters: down she comes and stands (never left hanging; laptop too since 2026-11-25)
        return;
      }
      /* A CLICK NEAR HER = STOP (her 2026-11-23: "If I click near her, that means I just want her to stop swinging ... there's a
         difference when I'm ... trying to click to get her to go somewhere and click to just be like, okay, you can stop moving"):
         within ~60% of her height of her hands she settles where she is (the gentle beside-pose stop if travelling, the swing dies
         down) and the cursor no longer pulls her until it moves well away from that spot. Further along the line = go there. */
      /* (no goal: one set at the hand she held then was behind her a catch later, and she turned straight back for it) */
      if (p.y < fig.y + 60 && Math.abs(p.x - G0.x) < (CLAY.ready ? CLAY.H : 120) * .6) { fig.hang.goal = null; fig.hang.pin = { x: p.x }; fig.hang.settle = true; fig.hang.auto = null; start(); return; }
      if (p.y < fig.y + 60 && p.x > hb.x1 - 40 && p.x < hb.x2 + 40) { fig.hang.goal = p.x; fig.hang.pin = null; fig.hang.settle = false; fig.hang.auto = null; start(); return; }
      release(Math.sign(p.x - fig.x));
      var dy = clickGround(p); fig.target = { x: p.x, y: dy == null ? floorY : dy, tries: 0 };
      return;
    }
    if (e.target.closest && e.target.closest('a,button')) return;
    /* ABOVE HER IS A JUMP (her 2026-11-23, #965: "If I click above her, she should jump. If I click twice ... above her, she should
       like double jump"): one click over her head and she jumps for it (tapJump: hangs from the line there if there is one, her
       2026-11-22 "monkey bar jump up to any text directly above it"; else onto a line in reach, else up and back down); the second
       click of a double click, while that jump is still going up, is a second jump from the air at the top of the first
       (doubleJump); a double click or tap anywhere above her head is a jump too (her 2026-10-28 phone ask) */
    if (!fig.wall && !fig.parkour) {
      if (dbl && (fig.state === 'air' || fig.loadT) && p.y < fig.y && Math.abs(p.x - fig.x) < reach * 1.6) { lastTap = null; fig.dblQ = { x: p.x, y: p.y }; start(); return; }
      if (grounded && p.y < herTop && (Math.abs(p.x - fig.x) < reach * .8 || dbl)) { if (dbl) lastTap = null; tapJump(p); return; }
    }
    var ty = clickGround(p);
    /* a click is a WALK there (her 2026-10-26: "the avatar jumps anytime I click. I don't like that. why can't it just walk
       over"): no hop at the finger any more, even right above her; she only climbs when the spot is on a surface she
       can't walk to */
    fig.target = { x: p.x, y: ty == null ? floorY : ty, tries: 0 };
    /* a click out past the divider's end, beside it: she goes to that end and does the wall jump (wallJump) */
    if (ty == null && floorX1 != null && (p.x < floorX1 || p.x > floorX2)) { var ws = p.x < floorX1 ? -1 : 1; fig.target = { x: ws < 0 ? floorX1 : floorX2, y: floorY, tries: 0, wall: ws }; }
    /* …and where the line curves up into the page edge, a click at or past where it stops being flat (on the curve, up the wall):
       she runs up the curve to the wall and rebounds off it from the top (rampCling), no leap */
    if (onCurve(p.x) && (ty == null || ty >= floorAt(p.x) - 2)) { var rw = p.x < W / 2 ? -1 : 1, rl = rw < 0 ? ramp.limL : ramp.limR; fig.target = { x: rl, y: floorAt(rl), tries: 0, wall: rw }; }
    fig.waypoint = null;
    if (fig.state === 'idle' || fig.state === 'sign' || fig.state === 'celeb' || fig.state === 'wave') { fig.state = 'move'; fig.celeb = null; }
    start();
  });

  /* where a click asks her to stand: on the line of type you clicked INSIDE (a tap between two letters used to fall
     through to the line below), else the first ink at or below the click */
  function clickGround(p) {
    for (var i = 0; i < bars.length; i++) { var b = bars[i];
      if (p.x < b.x1 || p.x > b.x2 || p.y < b.top - 4 || p.y > b.y + 4) continue;
      var best = null;
      for (var k = -12; k <= 12; k += 3) { var t = groundTop(p.x + k, b.top - 2, b.y - b.top + 6); if (t != null && t <= b.y + 2 && (best == null || t > best)) best = t; }
      if (best != null) return best;
    }
    return groundTop(p.x, p.y - 2, H);
  }
  function startFlip(dir) {
    var t = Math.max(2 * Math.abs(fig.vy) / G, 0.45);
    fig.flip = { rot: 0, w: (Math.PI * 2) / t, dir: dir || fig.dir };
  }
  function release(dirX) {
    if (!fig.hang) return;
    var b = fig.hang;
    fig.state = 'air';
    /* fig.x/fig.y already track her body and feet under the hands — reassigning them here would pop */
    fig.vx = dirX * 220 + (b.L ? b.om * b.L * Math.cos(b.th) : b.om * 40);   // the swing's speed goes with her
    fig.vy = -320;
    fig.fallFrom = fig.y;
    fig.hang = null; fig.hangCool = 0.6; fig.flipQueued = false;
    start();
  }

  /* THE MUSCLE-UP (her ask 2026-10-24: "my person needs to be able to muscle up and jump to the top of madhu from
     hanging"): from the hang, a pull and a press up over the very letter in her hands, ending stood on its top. It is
     the ledge mantle's motion run slower, its hands walking up the face of the glyph from her grip to its top. */
  function muscleUp() {
    var h = fig.hang;
    if (!h) return false;
    /* (her 2026-11-23: "she might grab the bottom of a word and then reach up to the top of the word and then get both
       hands at the top of the word and then have to jump up"): from the underside she holds, one hand goes up to the top of
       that word, then the other joins it there, then she pulls and steps up onto it (tickMantle / clayPick) */
    var b = h.bar, hy = Math.min(h.hands[0].y, h.hands[1].y), cx = (h.hands[0].x + h.hands[1].x) / 2, hx = null, top = null;
    if (b.top == null) return false;
    var wt = wordTop(cx, b); if (wt == null) return false;
    for (var k = 0; k <= 24 && hx == null; k++) {   // the nearest column whose letter top is the word's top (never a stroke inside a letter)
      var x = Math.round(cx + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 2), t = glyphTop(x, b);
      if (t != null && t <= wt + 2 && t < hy && hy - t < 140 && clearance(x, t) >= MIN_CLR) { hx = x; top = t; }
    }
    if (hx == null) return false;
    fig.state = 'mantle';
    fig.mantle = { t: 0, x0: fig.x, y0: fig.y, x1: hx, y1: top, dur: 1.05, hy0: hy, hx0: cx, up: true };
    fig.mantle.d0 = Math.max(0, Math.min(12, fig.y - muFeet(fig.mantle)));   // the reach starts with her feet where the hang had them (it popped her up ~5px): the reaching hand leaves the edge from that low
    fig.hang = null; fig.hangCool = 0.6; fig.vx = 0; fig.vy = 0; fig.flip = null;
    fig.target = null; fig.waypoint = null; fig.celeb = null;
    /* AFTER A MUSCLE-UP SHE STANDS (her 2026-11-23 rule: "if you muscle up on top of something, never go straight into another
       monkey bar situation unless there is another click ... If you muscle up, you just always stand on top of the thing you
       muscle up. Like that has to be the next move."): no hang of any kind (a route's next bar, a queued jump, a mid-air grab)
       until a new press or key clears this */
    fig.muStand = true; fig.tapQ = null;
    // no sound for a muscle-up (her 2026-11-23: "I don't think there needs to be a sound for the muscle up.")
    start();
    return true;
  }

  /* ------------------------------------------------------------------ physics */
  /* AN AIMED HANG (her 2026-11-19: "avatar need to be able to jump high enough to hang on the word disciplines"): a jump
     aimed at a line (double tap on a phone, drag-up on a laptop) used to grab the FIRST bar her hands passed, the line
     under the one she was sent to, so a word two or three lines up was never reachable. Now the line under the pointer
     is the aim: bars below it are let go by on the way up, and the jump is sized (past JUMP_MAX, up to HANG_MAX) so her
     raised hands reach it. */
  var HANG_MAX = 340, reachBase = null;
  function reach() { return reachBase == null ? HANG_MAX : Math.min(HANG_MAX + 60, reachBase + .2 * (CLAY.ready ? CLAY.H : 100)); }   // how far above her feet a line can be for her to jump and hang from it
  function aimBar(p) {
    var best = null;
    for (var i = 0; i < bars.length; i++) {
      var b = bars[i], d = b.y - p.y;   // the line the pointer is on: its box runs from b.top down to the bar
      if (p.x < b.x1 - 4 || p.x > b.x2 + 4 || d < -6 || b.y > fig.y - 30) continue;
      if (b.top != null ? p.y < b.top - 6 : d > 60) continue;
      if (!best || d < best.y - p.y) best = b;
    }
    return best;
  }
  /* the jump that puts her hands on the TOPS of line b's letters at x: the apex is where her hanging body's feet will be,
     so the catch is a change of grip, not a jump of the drawing. null when she can reach it standing (no hang there) or
     it's out of a jump */
  function hangRise(b, x, y0) {
    if (y0 - b.y > reach()) return null;   // out of her reach from here: a line lower down first, then up from there
    var g = topGrip(x, b, 24, null, null, null, true); if (!g) return null;   // she hangs from the underside of the letters
    var rise = y0 - (g.y + rig().soles) + 2;
    return rise >= 8 && rise <= HANG_MAX ? { rise: rise, g: g } : null;
  }
  /* auto: she muscles up onto the line once she has it (a tap or a click above her, her route): her 2026-11-22 ask */
  function hangJump(b, p, auto) {
    if (fig.muStand) return false;   // just muscled up: she stands until a new click
    var gx = Math.max(b.x1 + 8, Math.min(b.x2 - 8, p.x)), hr = hangRise(b, gx, fig.y);
    if (!hr) return false;
    fig.aim = b; fig.autoUp = auto ? { x: p.x, y: p.y } : null; fig.hangGoal = p.x; fig.dir = p.x >= fig.x ? 1 : -1;
    /* a touch over the catch height (a frame-stepped rise comes up a few px short of the formula's), so her hands reach
       the letters while she is still rising, slowly */
    var v0 = Math.sqrt(2 * G * hr.rise);
    fig.vy = -Math.sqrt(2 * G * (hr.rise + rig().soles * .03 + v0 / 90)); fig.fallFrom = fig.y; fig.state = 'air';
    var tUp = -fig.vy / G;
    fig.vx = Math.max(-RUN, Math.min(RUN, (hr.g.x - fig.x) / tUp));   // arrives under the aim at the top of the jump
    puff(fig.x, fig.y, 2);
    return true;
  }
  /* a line straight over her head she can hang from (the one nearest the pointer's height) */
  function overheadBar(p) {
    var best = null;
    for (var i = 0; i < bars.length; i++) { var b = bars[i];
      if (fig.x < b.x1 + 4 || fig.x > b.x2 - 4 || b.y > fig.y - 20 || !hangRise(b, fig.x, fig.y)) continue;
      var d = Math.abs((b.top + b.y) / 2 - p.y);
      if (!best || d < best.d) best = { b: b, d: d };
    }
    return best && best.b;
  }
  function jumpFor(rise, dx) {
    /* the cap must afford JUMP_MAX plus the clearance margin — a lower cap silently
       shaves the apex and a "reachable" ledge never is */
    fig.vy = -Math.min(Math.sqrt(2 * G * (Math.min(rise, JUMP_MAX) + 34)), 1210);
    fig.fallFrom = fig.y;
    fig.state = 'air';
    if (Math.abs(dx) > FLIP_DX) startFlip(Math.sign(dx));
    puff(fig.x, fig.y, 2);
  }

  /* the walk cycle's clock. fig.phase (0.05 rad/px, untouched — the crawl reads it) is
     distance; the GAIT consumes distance slower as the stride lengthens: pose() widens
     the half-stride to L·m while this advance divides by the same m, so the stance
     foot's backward drift stays exactly -vx — world-pinned — at every speed. Without m
     a full run cycled ~7 strides/sec at the fixed walking stride: a scurry, not a run. */
  function gaitM(sp) { return 1 + 0.32 * sp; }
  function advGait(dt) {
    var sp = Math.min(Math.abs(fig.vx) / RUN, 1);
    fig.gait += Math.abs(fig.vx) * dt * 0.12 / gaitM(sp);
  }

  /* THE ROUTE (her ask 2026-10-24: "sometimes it starts spazzing out when it has trouble getting to a place I clicked
     … make sure it gets there efficiently"). The old way was greedy: hop at the nearest ledge, fail, try the other
     side, up to 24 times. Now a click is PLANNED once: every standable spot in the hero (sampled every 12px) is a
     node; walking/hopping links neighbours, jumps link spots up to JUMP_MAX higher within 180px, drops link an edge
     to the first surface below it. Dijkstra finds the cheapest way to the click, or to the closest reachable spot when
     the click itself can't be reached, and she follows it: walk, jump, drop. If a move goes wrong (a bonk, a missed
     ledge) she re-plans from wherever she landed; after a few failed plans she simply stops. The route lives on the
     target, so anything that clears the target clears the route. */
  var PCOL = 12;
  function openAbove(x, y, h) { for (var k = 2; k <= h; k += 2) if (solid(x, y - k)) return false; return true; }   // clearance() stops counting at 92px
  function planRoute(tx, ty, bans) {
    gtMemo = window.Map ? new Map() : null;
    try { return planRoute1(tx, ty, bans); } finally { gtMemo = null; }
  }
  function planRoute1(tx, ty, bans) {
    var cols = [], nodes = [];
    for (var x = 10, c = 0; x <= W - 10; x += PCOL, c++) {
      var col = [];
      topsIn(x, 4, H).forEach(function (y) { if (clearance(x, y) >= MIN_CLR) { var n = { x: x, y: y, c: c, i: nodes.length }; nodes.push(n); col.push(n); } });
      cols.push(col);
    }
    /* where she stands now */
    var sc = Math.round((fig.x - 10) / PCOL), start = null;
    for (var k = sc - 1; k <= sc + 1; k++) (cols[k] || []).forEach(function (n) {
      if (Math.abs(n.y - fig.y) < 14 && (!start || Math.abs(n.x - fig.x) < Math.abs(start.x - fig.x))) start = n; });
    if (!start) return null;
    /* a jump whose arc would clip a letter on the way (or already did, on this tap) is never offered again: re-planning
       kept choosing it, so she went round and tried the same leap until she gave up */
    bans = bans || [];
    var banned = function (ax, ay, b) { return bans.some(function (q) { return q.bx === b.x && q.by === b.y && Math.abs(q.ax - ax) <= 18 && Math.abs(q.ay - ay) < 14; }); };
    /* ink taller than a step right ahead of a drop: the 12px sampling stepped over a letter's stem, so she was sent to
       walk through it (she stood in the cup of a u, against its far side, until she gave up) */
    var wall = function (x0, x1, y) { for (var x = x0; Math.abs(x - x1) > 1; x += x1 > x0 ? 2 : -2) if (solid(x, y)) return true; return false; };
    /* a walk is what tickGround can really do between two points, read pixel by pixel: steps, strides over a gap of a
       few px, little hops over a bump. Linking only neighbouring columns made every word space a jump (her hopping
       along the bio), and could hide a gap she then fell into */
    /* up to 3 columns: under the line above's descenders a column can have too little headroom to be a stand point,
       and her feet carry her under it, so the walk spans it. One scan per node and direction (her feet's own read of the
       ground, levelAt, so the plan and the walk agree), read by every walk edge out of it */
    var scans = {}, walkScan = function (a, sd) {
      var key = a.i * 2 + (sd > 0 ? 1 : 0); if (scans[key]) return scans[key];
      var ys = scans[key] = {}, y = a.y, gap = 0;
      for (var x = a.x + sd; Math.abs(x - a.x) <= PCOL * 3; x += sd) {   // sd = 4: the feet's own sample spacing, so the memo hits
        var lv = levelAt(x, y);
        if (lv == null) {
          var t = groundTop(x, y - STEP_UP, STEP_UP + STEP_DOWN + 4);
          if (t != null && t < y - STEP_UP && solid(x, y - 3)) { var hp = groundTop(x, y - HOP_UP, HOP_UP);
            if (hp != null && hp >= y - HOP_UP && openAbove(x, hp, MIN_CLR - 2)) lv = hp; else break; }
          else if ((gap += 4) > 8) break;
        }
        if (lv != null) { y = lv; gap = 0; }
        ys[x] = y;
      }
      return ys;
    };
    var walkTo = function (a, b) {
      if (Math.abs(a.c - b.c) > 3 || b.y < a.y - HOP_UP || b.y > a.y + STEP_DOWN) return false;
      var y = walkScan(a, b.x > a.x ? 4 : -4)[b.x];
      return y != null && Math.abs(y - b.y) <= STEP_UP;
    };
    var edges = function (a) {
      var out = [], unders = {};
      /* per column: the first surface under her if she walked off at her height */
      for (var d0 = -15; d0 <= 15; d0++) { var u = null;
        (cols[a.c + d0] || []).forEach(function (n) { if (n.y > a.y + STEP_DOWN && (!u || n.y < u.y)) u = n; }); unders[d0] = u; }
      for (var d = -15; d <= 15; d++) {
        var col = cols[a.c + d]; if (!col || !d) continue;
        var adx = Math.abs(d) * PCOL, under = unders[d];
        /* a drop lands on the first thing below its path: nothing she passes over may be higher than where it aims */
        for (var k2 = 1; under && k2 < Math.abs(d); k2++) { var uk = unders[k2 * Math.sign(d)]; if (uk && uk.y < under.y - 2) under = null; }
        col.forEach(function (b) {
          var rise = a.y - b.y;
          if (walkTo(a, b)) out.push({ n: b, how: 'walk', cost: PCOL + Math.max(0, rise) * .5 });
          else if (Math.abs(d) <= 3 && rise > 0 && rise <= HOP_UP && openAbove(a.x, a.y, rise + 24))
            out.push({ n: b, how: 'jump', cost: adx + rise + 25 });   // a little hop up a stair of letters
          else if (b === under && Math.abs(d) <= 12 && !wall(a.x, a.x + Math.sign(d) * 24, a.y - STEP_UP - 2) && [1, 2].every(function (k) { return !(cols[a.c + k * Math.sign(d)] || []).some(function (m) { return Math.abs(m.y - a.y) <= STEP_DOWN; }); }))   // a real gap (her stride spans a letter gap)
            out.push({ n: b, how: 'fall', cost: adx + 25 });   // off an edge (nothing walkable that way), down to the first surface
          else if (rise <= JUMP_MAX + 50 && adx <= 180 && (rise <= 0 || openAbove(a.x, a.y, rise + 30))   // + her reach to a ledge; clear air above the take-off
                   && openAbove(b.x, b.y, b.y - Math.min(a.y, b.y) + 30))   // and she comes down onto it from above: open sky over the landing
            out.push({ n: b, how: 'jump', cost: adx + Math.max(0, rise) * 1.2 + 90 });
        });
      }
      return out;
    };
    /* A LINE STRAIGHT OVERHEAD (her 2026-11-22): a jump up to hang from it and a muscle-up onto it, from right under it;
       only where she can't just step up (it's above her reach) and with her hang frames in */
    var hangs = canHang(), R = rig();
    var hangTo = function (a) {
      var out = [];
      if (!hangs) return out;
      for (var d = -1; d <= 1; d++) (cols[a.c + d] || []).forEach(function (b) {
        if (b.y >= a.y - 30) return;
        for (var i = 0; i < bars.length; i++) { var q = bars[i];
          if (a.x < q.x1 + 4 || a.x > q.x2 - 4 || b.y < q.top - 6 || b.y > q.y + 4) continue;
          if (a.y - q.y > reach()) return;   // (her reach: hangRise)
          var gb = glyphBottom(b.x, q); if (gb == null) return;
          var rise = a.y - (gb + R.soles) + 2;   // she hangs from the underside of that line's letters
          if (rise >= 8 && rise <= HANG_MAX) out.push({ n: b, how: 'hang', cost: rise + 60, bar: q });
          return;
        }
      });
      return out;
    };
    var ec = {}, path;
    for (var tries = 0; tries < 8; tries++) {
      var dist = {}, prev = {}, done = {}, open = [start];
      dist[start.i] = 0;
      while (open.length) {
        var bi = 0; for (var j = 1; j < open.length; j++) if (dist[open[j].i] < dist[open[bi].i]) bi = j;
        var a = open.splice(bi, 1)[0]; if (done[a.i]) continue; done[a.i] = true;
        (ec[a.i] || (ec[a.i] = edges(a).concat(hangTo(a)))).forEach(function (e) { var nd = dist[a.i] + e.cost;
          if ((e.how === 'jump' || e.how === 'hang') && banned(a === start ? fig.x : a.x, a === start ? fig.y : a.y, e.n)) return;
          if (dist[e.n.i] == null || nd < dist[e.n.i]) { dist[e.n.i] = nd; prev[e.n.i] = { from: a, how: e.how, bar: e.bar }; open.push(e.n); } });
      }
      /* the click if she can reach it, else the closest spot she can (and the cheaper way there on a tie) */
      var goal = null, gs = Infinity;
      nodes.forEach(function (n) { if (dist[n.i] == null) return; var sc2 = Math.hypot(n.x - tx, (n.y - ty) * 1.5) + dist[n.i] * .02;
        if (sc2 < gs) { gs = sc2; goal = n; } });
      if (!goal || goal === start) return [];
      path = [];
      for (var n2 = goal; n2 !== start; n2 = prev[n2.i].from) path.unshift({ x: n2.x, y: n2.y, how: prev[n2.i].how, bar: prev[n2.i].bar, dir: Math.sign(n2.x - prev[n2.i].from.x) || 1, from: prev[n2.i].from });
      /* fly each jump the way tickAir will; the first that would come down anywhere else is banned and the way re-planned */
      var bad = null;
      path.some(function (q) { if (q.how !== 'jump') return false;
        var ax = q.from === start ? fig.x : q.from.x, ay = q.from === start ? fig.y : q.from.y;
        if (!arcLands(ax, ay, q)) bad = { ax: ax, ay: ay, bx: q.x, by: q.y };
        return true; });   // only the next jump: those after it start from wherever she really lands
      if (!bad) break;
      bans.push(bad);
    }
    /* keep only the points where the way of moving changes, plus the end: a walk is one stretch */
    return path.filter(function (q, i) { return i === path.length - 1 || q.how !== 'walk' || path[i + 1].how !== 'walk'; });
  }
  /* routeJump's launch, and the flight tickAir gives it (same steering, letter-side stop, mantle and landing), from
     (ax, ay): does she come down on b? */
  function jumpV(ax, ay, b) {
    var rise = ay - b.y, dx = b.x - ax;
    var up = Math.min(Math.max(rise, 0) + 34 + Math.min(40, Math.abs(dx) * .15), 330);   // ~the old 1210px/s cap
    var vy0 = Math.sqrt(2 * G * up), T = vy0 / G + Math.sqrt(2 * (up - rise) / G);
    return { vx: dx / T, vy: -vy0 };
  }
  function arcLands(x, y, b) {
    var v = jumpV(x, y, b), vx = v.vx, vy = v.vy, dt = 1 / 60;
    var near = function (lx, ly) { return Math.abs(lx - b.x) < 24 && Math.abs(ly - b.y) <= 14; };
    for (var i = 0; i < 240; i++) {
      vy = Math.min(vy + G * dt, 1500);
      vx += (Math.max(-RUN, Math.min(RUN, (b.x - x) * 3)) - vx) * Math.min(1, dt * 2.2);
      var nx = Math.max(10, Math.min(W - 10, x + vx * dt)), ny = y + vy * dt;
      if (vx && !(b.y > ny - 10)) { var dirx = vx > 0 ? 1 : -1, py = ny - LEG;
        if (solid(nx + dirx * 5, py)) { var t = groundTop(nx + dirx * 5, py - 64, 74);
          if (t != null && t <= py + 10 && t >= py - 64 && clearance(nx + dirx * 5, t) >= MIN_CLR) return near(nx + dirx * 11, t); } }
      if (solid(nx, Math.min(ny, y) - 6) && !solid(x, Math.min(ny, y) - 6)) { nx = x; vx = 0; }
      if (vy > 0) { var land = groundTop(nx, y + 0.5, Math.max(2, ny - y + 2));
        if (land != null && land >= y - 2 && land <= ny + 0.5 && clearance(nx, land) >= MIN_CLR) return near(nx, land); }
      x = nx; y = Math.min(ny, floorAt(nx));
      if (y >= floorAt(x) && vy >= 0) return near(x, y);
    }
    return false;
  }
  /* there: she stops (the 2026-10-24 hop up at a tap above her is gone, her 2026-10-26 call) */
  function arrived() { var ws = fig.target && fig.target.wall, v0 = Math.abs(fig.vx); fig.target = null; fig.waypoint = null; fig.vx = 0;
    if (ws && ramp && Math.abs(fig.y - floorAt(fig.x)) <= 3 && Math.abs(fig.x - (ws < 0 ? ramp.limL : ramp.limR)) < 30) { rampCling(ws, v0, true); return; }
    if (ws && floorX1 != null && fig.y >= floorY - .5 && Math.abs(fig.x - (ws < 0 ? floorX1 : floorX2)) < 24) wallJump(ws); }
  /* PARKOUR OFF THE SIDE WALL (her 2026-11-23: "if I click outside the divider line, her goal is that she jumps on the wall like
     Spider-Man and then jumps back. Like it's like a parkour sort of thing"): from the divider's end she leaps out over the gap,
     at the top of the leap her feet plant on the side of the page (a crouch turned flat against it, tickAir), a beat, and she
     kicks back onto the divider. The click is used up at take-off, so nothing re-triggers it */
  /* UP THE CURVE AND ONTO THE WALL: at the steepest spot she can stand on, a run still going (or a click that sent her to the
     wall) carries on up it, her own wall rebound (wallOn / tickWall: facing us, the wall-side hand and both soles on it) rising with
     what is left of her speed (v²/2G: a run takes her ~30px up), so she slows, stops and slides back down it, then pushes off;
     at the top of a short wall (the quarter-pipe's lip) she pushes off from there. Never lower than where the curve turns up */
  function rampCling(side, v, spring) {
    var f0 = wallF(), need = fig.y - ((CLAY.ready ? CLAY.H : 113) * .5 - (f0.base - f0.gy) / 2 * wallSc()) - floorAt(wallX(side));   // how far up her wall pose has to go
    fig.target = null; fig.waypoint = null; fig.celeb = null; fig.flip = null; fig.flipQueued = true;
    /* her run's speed, 90% of it upward; sent to the wall (a click), her legs add what a run up a big curve lacks, so she always gets there */
    fig.state = 'air'; fig.fallFrom = fig.y; fig.vx = 0; fig.vy = -Math.max(v * .9, spring ? Math.sqrt(2 * G * Math.max(0, need + 14)) : 0, 270); fig.dir = side;
    fig.rampUp = { side: side, low: floorAt(wallX(side)) }; fig.rampUp.s0 = wallF().s;
    fig.wallRest = { side: side };   // one attempt per lead (wallLead)   // she rises off the curve until her wall pose's soles reach the wall (tickAir)
    start();
  }
  function wallJump(side) {
    var wx = wallX(side), ta = 600 / G;
    fig.target = null; fig.waypoint = null; fig.celeb = null; fig.flip = null; fig.flipQueued = true;
    fig.state = 'air'; fig.vy = -600; fig.fallFrom = fig.y; fig.dir = side;
    fig.vx = side * Math.max(20, Math.abs(wx - fig.x) - WALL_GX()) / ta;   // her hand meets the wall at the top of the leap
    fig.parkour = { side: side, wx: wx };
    puff(fig.x, fig.y, 3); start();
  }
  /* ON THE WALL LIKE SPIDER-MAN (her 2026-11-23: "she needs to have one hand on the wall, one leg on the wall ... slide down,
     jump off"; "Right now she's like defying gravity"): facing the wall in her climb frame 6, the raised fist and the bent
     knee both touching it (WALL_GX: the column of her frame they share), the rest of her hanging. Gravity still works: friction
     on her hand and knee only takes some of it, so she slows (or rises on a little if she hit it going up) and slides down, then
     pushes off, turning away from the wall, back onto the divider */
  /* THE WALL REBOUND (her 2026-11-23: "I don't like that she's facing the wall. I want her to face like me ... one hand in contact
     with the wall and one foot ... two legs and one hand in contact with the wall and you're like facing the front"): Flora
     poses of her own clay, facing us with her side to the wall: 0 sliding (crouched, the wall-side hand flat on it, both soles
     on it), 1 coiled to spring, 2 the push-off. Each is pinned where her hand meets the wall's face (-ox, -oy); mx/my her centre
     of mass from there. Drawn facing the wall's side (unmirrored = wall on her right). Until the sheet is in: climb frame 6 */
  var WALL_S = 'wall-rebound', WALL_COIL = .18;   // s: a still beat (her slide pose) for the last of her .55s on the wall, before the push
  /* HER PALM AND SOLES REST ON THE WALL, NEVER IN IT (her 2026-11-24: "Her smushing he body against the wall it weird for the avatar"):
     each pose was pinned at -ox, ~12 clay px in from where her palm and soles end (the frames are cut to her ink, so their right edge,
     w, is that surface), so she sank that far into the wall; on a phone the wall is the screen edge and her hand and toes were cut
     off flat against it. Now the frame's edge is the wall's face. And ONE set of poses per visit to the wall (s0, locked when she
     sets off for it): the rebound sheet streams in late on a phone, and landing mid-slide it swapped climb frame 6 for the rebound
     pose, a different size and pin, in one frame (part of her "glitchy") */
  function wallF(k) {
    var lk = (fig.wall || fig.rampUp || {}).s0;
    var W0 = lk !== 'climb-x3' && CLAY.sheetIn && CLAY.sheetIn[WALL_S] && CLAY.man[WALL_S], f = W0 && W0[k || 0];
    if (f) return { s: WALL_S, k: k || 0, gx: f.w - 2, gy: -f.oy, base: f.base, cx: -f.ox + f.mx };
    var L = CLAY.man && CLAY.man['climb-x3'], c = L && L[6] || { cx: 39, base: 263 };
    return { s: 'climb-x3', k: 6, gx: 68, gy: 12, base: c.base, cx: c.cx, rot: .05 };
  }
  /* HER SIZE ON THE WALL (her 2026-11-23: "she gets larger ... when she's on the wall and she's like sliding down the wall ... Her body
     parts become bigger"): the three rebound poses were cut from Flora stills at the hang clip's px scale, so her head, hands and shoes
     came out ~1.22x her walk/idle size (bandana, face, eye and earring spans, brow to chin, measured against idle-wave-sign-0). Drawn
     at WALL_Z, about the hand on the wall, so the hand and soles stay on it */
  /* …and then "Avatar is now too small I think when it's on the wall" (her 2026-11-24): .82 matched only her HEAD (the Flora stills'
     head is ~1.23x hers: eye, earring and brow-to-chin spans against idle-wave-sign-0) while her shirt, legs and shoes are her own
     size in them, so at .82 her body shrank ~18% the moment she touched the wall. .9 = 1/sqrt(1.23) splits it: head ~1.1x, body ~0.9x */
  var WALL_Z = .9;
  function wallSc() { return (CLAY.ready ? CLAY.H : 113) / (CLAY.man ? CLAY.man._ref : 252) * (wallF().s === WALL_S ? WALL_Z : 1); }
  function WALL_GX() { var f = wallF(); return (f.gx - f.cx) * wallSc(); }   // her middle → the wall, in px
  function wallOn(side, wx, nx) {
    var f = wallF(), sc = wallSc(), mid = fig.y - (CLAY.ready ? CLAY.H : 113) * .5;   // her airborne frame is pinned by its middle: the cling frame's middle goes there
    var v = Math.hypot(fig.vx, fig.vy);
    fig.wall = { t: 0, side: side, hx: wx, hy: mid - (f.base - f.gy) / 2 * sc, s0: f.s };
    fig.parkour = null; fig.vx = 0; fig.vy = Math.min(fig.vy, 0) * .5; fig.flip = null; fig.flipQueued = true; fig.dir = side;
    fig.x = wx - side * WALL_GX(); fig.y = fig.wall.hy + (f.base - f.gy) * sc;
    once('grip', function () { squeeze(v); });   // her hand and knee meet the wall
  }
  function tickWall(dt) {
    var Wl = fig.wall, f = wallF(), sc = wallSc();
    Wl.t += dt;
    fig.vy = Math.min(150, fig.vy + (fig.vy < 0 ? G : G * .3) * dt);   // going up, gravity and the rub both stop her; coming down, the rub takes 70% of it
    Wl.hy += fig.vy * dt;
    fig.y = Wl.hy + (f.base - f.gy) * sc; fig.x = Wl.hx - Wl.side * WALL_GX(); fig.vx = 0;
    var lowY = ramp ? floorAt(Wl.hx) : floorY - 2, low = fig.y >= lowY;   // (on a curved divider: down to where it turns up into the wall)
    if (low) { fig.y = lowY; Wl.hy = fig.y - (f.base - f.gy) * sc; }
    var topY = ramp ? (Wl.side < 0 ? ramp.topL : ramp.topR) : null, atTop = topY != null && fig.y <= topY;   // over the top of a short wall: nothing under her soles
    if (atTop) { fig.y = topY; Wl.hy = fig.y - (f.base - f.gy) * sc; fig.vy = 0; }
    /* on a curved divider, at the top of the wall or back down at its foot, she coils (her frame 1) a beat, then pushes */
    if (ramp && (atTop || low) && !Wl.end) { Wl.end = true; Wl.t = Math.max(Wl.t, .55 - WALL_COIL); }
    if (Wl.t < .55 && (ramp || !low)) return;
    /* the push: off the wall, turned away from it, onto the divider a stride past its end */
    var into = -Wl.side, end = ramp ? (into > 0 ? ramp.x1 : ramp.x2) : into > 0 ? floorX1 : floorX2, lx = (end == null ? fig.x + into * 80 : end + into * 40), vy = -560;
    var KF = f.s === WALL_S && wallF(2);
    if (KF) { fig.x = Wl.hx + into * (KF.gx - KF.cx) * sc; fig.wallPush = { t: 0, side: Wl.side }; }   // her middle out to where the push-off pose has it, feet still on the wall
    var T = (-vy + Math.sqrt(vy * vy + 2 * G * Math.max(0, floorY - fig.y))) / G;
    fig.wall = null; fig.endFix = true; fig.vy = vy; fig.vx = (lx - fig.x) / T; fig.dir = into; fig.fallFrom = fig.y; fig.shhV = vy;   // (a swish as she comes down: the kick lifts her less than her height)
    puff(Wl.hx, fig.y - 10, 2);
  }
  function routeJump(b) {
    var v = jumpV(fig.x, fig.y, b), dx = b.x - fig.x;
    fig.vy = v.vy; fig.vx = v.vx; fig.fallFrom = fig.y; fig.state = 'air'; fig.waypoint = b;
    if (fig.target) fig.target.jumped = { ax: fig.x, ay: fig.y, bx: b.x, by: b.y };
    fig.dir = dx >= 0 ? 1 : -1;
    /* the FLIPS are back (her 2026-10-26, #77/#79: "she used to flip down when she jumped down from high places"; the
       a269ee0 calm-down had made every jump on the way to a tap a plain one): a long leap or a jump down a level turns
       one full tuck, timed to her airtime */
    var drop = b.y - fig.y;
    if (drop > 90 || Math.abs(dx) > FLIP_DX) flipFor((-v.vy + Math.sqrt(v.vy * v.vy + 2 * G * Math.max(drop, 0))) / G);
  }
  /* her route's way up onto a line straight over her head: jump, hang from its letters, muscle up (tickHang keeps the route) */
  function routeHang(wp) {
    var tg = fig.target;
    var last = !tg || !tg.route || tg.route[tg.route.length - 1] === wp;   // the line she was sent to: she stays on the bars there
    if (wp.bar && hangJump(wp.bar, { x: last && tg ? tg.x : wp.x, y: wp.y }, !last)) { fig.waypoint = wp; if (last) { fig.target = null; fig.waypoint = null; } return true; }
    if (tg) { (tg.bans = tg.bans || []).push({ ax: fig.x, ay: fig.y, bx: wp.x, by: wp.y }); tg.route = null; }
    return false;
  }
  function pace(d) {   // a walk within ~45px of where she's going (~25px in the phone's smaller hero), else a run
    var ph = CLAY.H < 100;
    return WALK + (RUN - WALK) * Math.max(0, Math.min((d - (ph ? 8 : 20)) / (ph ? 28 : 50), 1));
  }
  /* a full flip timed to land: one turn over the time she'll be in the air (a short hop has no room for one) */
  function flipFor(T) { if (T < .4) return; startFlip(fig.dir); fig.flip.w = (Math.PI * 2) / (T * .85); fig.flipQueued = true; }
  /* one tick of following the route; returns the speed she wants, or null when this tick is spent */
  function followRoute(dt) {
    var tg = fig.target, wp = tg.route[0];
    if (wp.how === 'hang' && Math.abs(wp.x - fig.x) <= 14) { routeHang(wp); return null; }   // under the line she goes up by: up she goes
    /* a walk point counts within a step's height (she walks the surface between them); a jump/drop must land on it */
    /* her 2026-10-26: "it just spazzes back and forth". At walking speed she carries ~15px past a point before she can
       turn, so a 7px window made her overshoot, turn, overshoot again. A point she has just walked past counts as
       reached, and a jump or drop counts once she lands on its level within a stride of it */
    /* a walk point she's already beyond (or that sits just behind her where a route starts), on her level, with the next
       point onward from here: skip it. She landed past a drop's spot, ran past a point, or set off on a 13px step the wrong
       way, then turned round (her "spazzes back and forth") */
    var nw = tg.route[1];
    var onWp = wp.how === 'walk' ? Math.abs(fig.y - wp.y) <= STEP_UP : wp.how === 'fall' && Math.abs(fig.y - wp.y) <= 14;   // (a drop: already landed on its level)
    var beyond = nw && (nw.x - fig.x) * (nw.x - wp.x) > 0 && Math.abs(nw.x - fig.x) < Math.abs(nw.x - wp.x);
    if (onWp && nw && (nw.how === 'walk' ? beyond && Math.abs(nw.y - fig.y) <= STEP_UP : nw.how === 'fall' ? beyond && Math.sign(nw.x - fig.x) === nw.dir :
        nw.how === 'hang' ? Math.abs(nw.x - fig.x) <= 14 : (beyond || Math.abs(wp.x - fig.x) < 40) && arcLands(fig.x, fig.y, nw))) {   // a jump she can already make from here: no running on past and back
      tg.route.shift(); wp = nw; tg.best = Infinity; tg.stuck = 0;
      if (wp.how === 'hang') { routeHang(wp); return null; }
      if (wp.how === 'jump') { routeJump(wp); return null; }   // (from here: it was just flown and lands)
    }
    var wdx = wp.x - fig.x, past = fig.vx && Math.sign(wdx) !== Math.sign(fig.vx) && Math.abs(wdx) < 24;
    /* (a drop's landing x is only roughly where she comes down: on its level is enough, never a walk back to the spot) */
    var hit = (Math.abs(wdx) < (wp.how === 'walk' ? 7 : wp.how === 'fall' ? 60 : 24) || past) && Math.abs(fig.y - wp.y) <= (wp.how === 'walk' ? STEP_UP + 6 : 14);
    if (tg.jumped) { var jb = tg.jumped; tg.jumped = null; if (!hit) { (tg.bans = tg.bans || []).push(jb); tg.route = null; return null; } }   // missed it: plan again from here, without that leap
    if (hit) {
      tg.route.shift(); tg.best = Infinity; tg.stuck = 0;
      if (!tg.route.length) { arrived(); return null; }
      wp = tg.route[0];
      if (wp.how === 'hang') { routeHang(wp); return null; }
      if (wp.how === 'jump') {
        /* fly it first from where she really stands (a stride off the planned spot can clip a letter): no good, plan again */
        if (!arcLands(fig.x, fig.y, wp)) {
          /* it flies from the spot the route chose, a step or two back: go back to it (once), rather than ban the jump and
             plan a way round across the whole hero */
          var o = wp.from;
          if (!wp.back && o && Math.abs(o.x - fig.x) < 40 && Math.abs(o.y - fig.y) <= STEP_UP && arcLands(o.x, o.y, wp)) {
            wp.back = true; tg.route.unshift({ x: o.x, y: o.y, how: 'walk', dir: Math.sign(o.x - fig.x) || 1 }); fig.waypoint = tg.route[0]; return 0;
          }
          (tg.bans = tg.bans || []).push({ ax: fig.x, ay: fig.y, bx: wp.x, by: wp.y }); tg.route = null; return null;
        }
        routeJump(wp); return null;
      }
    }
    fig.waypoint = wp;
    /* a drop: she keeps walking the way it goes until the ground runs out (committed: never back toward the landing x) */
    var falling = wp.how === 'fall' && fig.y < wp.y - STEP_DOWN;
    /* right column, wrong level (a missed ledge): plan again from here at once, never shuffle on the spot */
    if (!falling && Math.abs(wp.x - fig.x) < 7) {
      /* …unless it's a walk point a hop above her (the far side of a letter's cup): walking on into it IS the hop up.
         Re-planning only found the same way again, four times in four frames, and she gave up */
      var ahead = groundTop(fig.x + wp.dir * 4, fig.y - STEP_UP, STEP_UP + STEP_DOWN + 4);
      if (wp.how === 'walk' && wp.y < fig.y && wp.y >= fig.y - HOP_UP - 2 && ahead != null && ahead < fig.y - STEP_UP) return wp.dir * WALK;
      if (wp.how === 'hang') (tg.bans = tg.bans || []).push({ ax: fig.x, ay: fig.y, bx: wp.x, by: wp.y });   // she went for that line and missed it: another way
      tg.route = null; return null;
    }
    /* no progress toward this point for a while (a bonk, a missed ledge): plan again from here */
    var d = falling ? -wp.dir * fig.x : Math.abs(wp.x - fig.x) + Math.abs(wp.y - fig.y);
    if (d < tg.best - 4) { tg.best = d; tg.stuck = 0; } else if ((tg.stuck += dt) > .8) { tg.route = null; return null; }
    if (falling) return wp.dir * pace(Math.abs(wp.x - fig.x));
    /* she RUNS to get somewhere (her 2026-10-26, #80: "make her run more often than she walks"), walking only the last
       few steps or a short shuffle. The distance is the whole straight stretch of walk points ahead, not just the next
       one: measured to each point, she ran most of every leg and dropped to a walk at each point on the way */
    var dx = wp.x - fig.x, run = Math.abs(dx);
    for (var i = 1; i < tg.route.length && tg.route[i].how === 'walk' && (tg.route[i].x - tg.route[i - 1].x) * dx > 0; i++) run += Math.abs(tg.route[i].x - tg.route[i - 1].x);
    if (tg.route[i] && tg.route[i].how === 'jump') run -= CLAY.H < 100 ? 35 : 60;   // run up to a jump, but slow in time to plant on its spot (overrun, the jump no longer fits and she turns round)
    return Math.sign(dx) * pace(run);
  }

  function brace(t) { fig.landT = fig.land0 = t; }
  /* she LOADS before she jumps (her 2026-10-26, #76: "athletes load up before they jump"): a launch from her feet is held
     back for a crouch, longer for a bigger jump, then goes off with the same speed it was planned with */
  function crouchFirst(was, x0) {
    if (fig.state !== 'air' || fig.vy > -150 || fig.loadV || fig.wall || fig.rampUp || (was !== 'move' && was !== 'idle')) return;   // (up the curve onto the wall: no crouch, her run carries on)
    fig.loadV = { vx: fig.vx, vy: fig.vy };
    fig.loadT = fig.load0 = 0.05 + 0.08 * Math.min(1, -fig.vy / 1000);   // quick and springy (#84): was 0.07-0.18s
    fig.state = was; fig.vx = 0; fig.vy = 0;
    if (x0 != null) fig.x = x0;   // the hop's first step waits for the crouch too: no slide while she bends
  }
  function tickLoad(dt) {
    if (fig.state !== 'move' && fig.state !== 'idle') { fig.loadT = 0; fig.loadV = null; return; }   // something else took her (a drop, a wave)
    fig.loadT = Math.max(0, fig.loadT - dt);
    if (fig.loadT) return;
    fig.vx = fig.loadV.vx; fig.vy = fig.loadV.vy; fig.loadV = null;
    fig.fallFrom = fig.y; fig.state = 'air';
  }
  function tickGround(dt) {
    fig.wallPush = null; fig.rampUp = null;
    fig.flipQueued = false;
    /* SHE NEVER STANDS ON THE CURVE (her 2026-11-24: "have her like avoid the corner or like either slide down it ... or like run up
       to it and like jump ... never like stand. Like she never stands on it. I think that's kind of weird no matter what"): a spot on
       the curve that isn't the wall is the flat just before it; on the curve without being sent up it (the wall, or the keys / a drag
       driving at it), she SLIDES down it (her slide frame, feet on the line) and stops on the flat. Up it she only ever runs */
    if (ramp && fig.target && !fig.target.wall && onCurve(fig.target.x)) { var ts = fig.target.x < W / 2 ? -1 : 1; fig.target.x = ts < 0 ? ramp.x1 + 3 : ramp.x2 - 3; fig.target.y = floorY; fig.target.route = null; }
    if (ramp && onCurve(fig.x) && Math.abs(fig.y - floorAt(fig.x)) <= 3) {
      var cs = fig.x < W / 2 ? -1 : 1;
      if (!((fig.target && fig.target.wall === cs) || (fig.drag && fig.drag.vx * cs > 0))) {
        fig.landT = 0; fig.state = 'move'; fig.slideT = .12; fig.dir = -cs;
        fig.vx = -cs * Math.max(Math.abs(fig.vx) * (fig.vx * cs < 0 ? 1 : 0), 240);
        var sx = fig.x + fig.vx * dt; if (!onCurve(sx)) sx = cs < 0 ? Math.max(sx, ramp.x1) : Math.min(sx, ramp.x2);
        fig.x = sx; fig.y = floorAt(sx); fig.phase += Math.abs(fig.vx) * dt * 0.05;
        return;
      }
    }
    if (fig.landT > 0 && !fig.drag) { fig.vx = 0; return; }   // the landing crouch holds still, then she sets off
    if (CLAY.ready && !CLAY.moveReady) { fig.vx = 0; return; }   // her walking frames aren't in yet (#102): she waits, then goes
    var want = 0;
    var g = fig.waypoint || fig.target;
    /* a spot on the divider's curve, from the divider: straight along the line (the curve branch below), no route; the planner's
       walk points stop short of the steep end, where she has to get all the way to the wall */
    var tgR = !fig.drag && fig.target && ramp && onCurve(fig.target.x) && Math.abs(fig.y - floorAt(fig.x)) <= 3 && Math.abs(fig.target.y - floorAt(fig.target.x)) <= 4;
    if (tgR) { var rdx = fig.target.x - fig.x, atLim = Math.abs(fig.target.x - ramp.limL) < .5 || Math.abs(fig.target.x - ramp.limR) < .5;
      if (Math.abs(rdx) < (atLim ? .5 : 3)) { arrived(); return; }   // (the steepest spot: walked right onto it, the curve branch stops her there)
      want = Math.sign(rdx) * pace(Math.abs(rdx)); }
    else if (fig.drag) { want = fig.drag.vx; }
    else if (fig.target && !fig.target.manual) {
      var tg = fig.target;
      if (!tg.route) {
        if ((tg.plans = (tg.plans || 0) + 1) > 4) { fig.target = null; fig.waypoint = null; fig.vx = 0; return; }   // she tried; she stops
        var r = planRoute(tg.x, tg.y, tg.bans || (tg.bans = []));
        if (r == null) tg.manual = true;   // can't place her on the map (mid-step): the old greedy way, this once
        /* no way out on the map (she can stand in a pocket between two lines whose spot links to nothing, and then every
           tap after was "already there": her 2026-10-29 "sometimes I tap and she won't move"): a tap that isn't where she
           stands goes the old greedy way instead, which walks, drops and hops on what's really there */
        else if (!r.length) { if (Math.abs(tg.x - fig.x) > 40 || Math.abs(tg.y - fig.y) > 26) tg.manual = true; else { arrived(); return; } }
        else { tg.route = r; tg.best = Infinity; tg.stuck = 0; if (r[0].how === 'jump' && Math.abs(r[0].x - fig.x) > 0) { routeJump(r[0]); return; } if (r[0].how === 'hang') { routeHang(r[0]); return; } }
      }
      if (tg.route) { var rw = followRoute(dt); if (rw === null) return; want = rw; }
    }
    if (!tgR && !fig.drag && fig.target && fig.target.manual) {
      var dx = g.x - fig.x;
      want = Math.sign(dx) * pace(Math.abs(dx));
      /* near enough on the same bump of ink counts as arrived — waypoint or not */
      if (Math.abs(fig.target.x - fig.x) < 40 && Math.abs(fig.y - fig.target.y) < 26) { arrived(); return; }
      if (Math.abs(dx) < 8) {
        var dyP = fig.y - g.y;
        if (Math.abs(dyP) <= 12) {
          if (fig.waypoint) fig.waypoint = null;
          else { fig.target = null; want = 0; }
        } else if (dyP > 12 && fig.target.tries < 3) {   // 3 goes, then she gives up (24 read as jumping up and down forever)
          /* the boundaries must be continuous with the arrived-band: a 16px rise that no
             branch owned used to fall through to the give-up else */
          fig.target.tries++;
          if (dyP <= JUMP_MAX + 40) {
            jumpFor(dyP, 0);
            fig.vx = Math.max(-70, Math.min(70, (g.x - fig.x) * 2));
            return;
          }
          /* too high for one jump — climb greedily via the nearest ink that IS in reach */
          var stone = null, fx = fig.x, fy = fig.y;
          for (var cx = fx - 240; cx <= fx + 240; cx += 10) {
            if (cx < 8 || cx > W - 8) continue;
            var tops = topsIn(cx, fy - JUMP_MAX - 40, fy - 30);
            for (var i = 0; i < tops.length; i++) {
              if (clearance(cx, tops[i]) < MIN_CLR) continue;
              var d2 = Math.abs(cx - fx) + (tops[i] - (fy - JUMP_MAX - 40)) * 0.1;
              if (!stone || d2 < stone.d) stone = { x: cx, y: tops[i], d: d2 };
            }
          }
          if (stone) fig.waypoint = { x: stone.x, y: stone.y };
          else { fig.target = null; fig.waypoint = null; want = 0; }
        } else if (dyP < -12 && fig.target.tries < 3) {
          /* the click was BELOW: gravity is the elevator, but it needs an edge — walk to
             the end of the WALKABLE surface (following it, gaps and steps included, not
             just this blob's top row) and fall a level, then re-approach */
          fig.target.tries++;
          var eL = fig.target.avoid === -1 ? null : walkEdge(fig.x, fig.y, -1);
          var eR = fig.target.avoid === 1 ? null : walkEdge(fig.x, fig.y, 1);
          var ex = null;
          if (eL != null && eR != null) ex = Math.abs(fig.x - eL) < Math.abs(eR - fig.x) ? eL : eR;
          else ex = eL != null ? eL : eR;
          if (ex != null) {
            fig.target.avoid = ex < fig.x ? -1 : 1; // if this side dithers, try the other next
            fig.waypoint = { x: Math.max(8, Math.min(W - 8, ex)), y: fig.y, drop: true };
          }
          else { fig.target = null; fig.waypoint = null; want = 0; }
        } else { fig.target = null; fig.waypoint = null; want = 0; }
      }
    }
    /* low headroom folds the walk into a crawl (and slows it). Sampled over three
       columns so one overhead ascender doesn't hunch the figure for a stride. */
    var clr = Math.max(clearance(fig.x, fig.y),
                       clearance(fig.x - 7, fig.y),
                       clearance(fig.x + 7, fig.y));
    fig.crawl += (Math.max(0, Math.min(1, (CRAWL_CLR - clr) / (CRAWL_CLR - 22))) - fig.crawl) * Math.min(1, dt * 10);
    want *= 1 - fig.crawl * 0.55;

    if (ramp && fig.target && fig.target.wall && want) want = Math.sign(want) * RUN;   // sent to the wall: a run-up all the way, no slowing for the spot
    fig.vx += (want - fig.vx) * Math.min(1, dt * 15);   // snappy starts and turns (was dt * 9: ~0.25s to full pace, now ~0.15s)
    if (Math.abs(fig.vx) < 6 && !fig.target && !fig.drag) {
      fig.vx = 0;
      if (fig.state === 'move') fig.state = 'idle';
      return;
    }
    if (fig.vx) fig.dir = fig.vx > 0 ? 1 : -1;
    /* ON THE CURVE: her feet stay on the drawn line (floorAt), and climbing it costs her: gravity along the slope takes G·sinθ off
       her speed each moment she goes up it (never pushing her down while she stands), so a run slows as it climbs and a walk
       crawls up the steepest part. She can stand up to RAMP_MAX (35°); a run still going there, or a click that sent her to the
       wall, carries on up the wall (rampCling) */
    if (ramp && Math.abs(fig.y - floorAt(fig.x)) <= 3 && (onCurve(fig.x) || onCurve(fig.x + fig.vx * dt))) {
      var rs = fig.x < W / 2 ? -1 : 1, lim = rs < 0 ? ramp.limL : ramp.limR, sl = slopeAt(fig.x);
      if (fig.vx * rs > 0 && onCurve(fig.x)) fig.vx -= rs * G * Math.abs(sl) / Math.sqrt(1 + sl * sl) * dt;
      var rx = Math.max(10, Math.min(W - 10, fig.x + fig.vx * dt)), toWall = fig.target && fig.target.wall === rs;
      if (rs * (fig.x - lim) > .5 && fig.vx * rs <= 0) rx = fig.x + (lim - fig.x) * Math.min(1, dt * 8);   // (came down on the steep part: she steps down to where she can stand)
      else if (rs * (rx - lim) >= 0 && fig.vx * rs > 0) {   // the steepest spot she can stand on
        /* (sent to a spot on the curve: she stops there; sent to the wall, or run at it by the keys or a drag: up the wall) */
        if (toWall || (fig.drag && fig.drag.vx * rs > 0) || (Math.abs(fig.vx) > 200 && (!fig.target || fig.target.follow))) { fig.x = lim; fig.y = floorAt(lim); rampCling(rs, Math.abs(fig.vx), true); return; }   // (up the curve she always gets to the wall: never left standing at its top)
        rx = lim; fig.vx = 0;
      }
      fig.x = rx; fig.y = floorAt(rx);
      if (rx === lim && fig.target && rs * (fig.target.x - lim) >= -1) arrived();   // as far as she can stand: there
      fig.phase += Math.abs(fig.vx) * dt * 0.05;
      advGait(dt);
      return;
    }
    var nx = Math.max(10, Math.min(W - 10, fig.x + fig.vx * dt));
    if (fig.y >= floorY - .5 && floorX1 != null && !onFloor(nx)) {   // the divider's end
      var side = nx < floorX1 ? -1 : 1, tgo = fig.target;
      if (tgo && (tgo.wall === side || (side < 0 ? tgo.x < floorX1 - 1 : tgo.x > floorX2 + 1))) { wallJump(side); return; }   // sent past it: the wall jump and back
      /* else she stops at it. (It clamped to 2px inside the end while her stride was allowed right up to it, so with a click out
         past the end she flicked between the two every frame, walking and standing at once: her "tweaks and glitches") */
      nx = Math.max(floorX1, Math.min(floorX2, nx)); fig.vx = 0; if (Math.abs(nx - fig.x) < .5) { if (fig.target) arrived(); fig.x = nx; return; }
    }
    /* follow the ink's surface: a step either way is walked, not fallen */
    var s = groundTop(nx, fig.y - STEP_UP, STEP_UP + STEP_DOWN + 4), lv = levelAt(nx, fig.y);
    /* ink up there with air under it is the line above's descenders, not a wall: what's under her is the ground below
       (or nothing), never a hop up onto that line */
    if (s != null && s < fig.y - STEP_UP && !solid(nx, fig.y - 3)) s = groundTop(nx, fig.y - 2, STEP_DOWN + 6);
    if (lv != null) {
      fig.x = nx; fig.y = lv;
      fig.phase += Math.abs(fig.vx) * dt * 0.05;
      advGait(dt);
      return;
    }
    /* the gaps BETWEEN glyphs are a few px of air — a stride simply spans them, the way a
       foot spans the gap between two letters. Only real edges are worth falling off. */
    if (s == null || s > fig.y + STEP_DOWN) {
      var s2 = groundTop(nx + fig.dir * 8, fig.y - STEP_UP, STEP_UP + STEP_DOWN + 4);
      if (s2 != null && s2 >= fig.y - STEP_UP - 0.5 && s2 <= fig.y + STEP_DOWN + 0.5) {
        fig.x = nx;
        fig.phase += Math.abs(fig.vx) * dt * 0.05;
        advGait(dt);
        return;
      }
    }
    var goalBelow = g && g.y > fig.y + STEP_DOWN && (!fig.waypoint || (fig.target && fig.target.route));   // a planned drop is never undone by a reflex hop
    /* stair of letters / petal ledge: a little spring up, no flip */
    if (!goalBelow) {
      var hop = groundTop(nx, fig.y - HOP_UP, HOP_UP);
      if (hop != null && hop < fig.y - STEP_UP && hop >= fig.y - HOP_UP && clearance(nx, hop) >= MIN_CLR) {
        fig.x = nx;
        fig.vy = -Math.sqrt(2 * G * (fig.y - hop + 20));
        fig.fallFrom = fig.y; fig.state = 'air';
        return;
      }
      /* a wall taller than a hop? jump properly if we're being driven at it */
      if ((fig.drag || fig.target) && solid(nx + (fig.dir * 5), fig.y - LEG)) {
        var wt = groundTop(nx + fig.dir * 5, fig.y - JUMP_MAX - 40, JUMP_MAX + 40);
        if (wt != null && wt < fig.y - HOP_UP && fig.y - wt <= JUMP_MAX + 40 && clearance(nx + fig.dir * 5, wt) >= MIN_CLR) {
          jumpFor(fig.y - wt, 0);
          fig.x = nx;
          return;
        }
      }
    }
    /* ink ahead that is a wall or a too-low gap, not an edge: she stops at it. Treating it as an edge sent her into the
       air, where the letter's side stopped her and she landed on the same spot: a jump pose flickering every frame while
       she crept forward (her 2026-10-26: "it just spazzes", "it moves without the walking motion") */
    if (s != null && s <= fig.y + STEP_DOWN) { fig.vx = 0; return; }
    /* nothing to stand on ahead: walk off the edge and fall… */
    fig.x = nx;
    fig.state = 'air'; fig.vy = 0; fig.fallFrom = fig.y;
    fig.vx = fig.dir * Math.min(Math.abs(fig.vx), 100);   // a run's speed carried her clean past the level the route dropped to (and on a phone ledge, even a walk's)
    /* …or, off a HIGH edge, spring off it and flip down (her #77/#79): walking off, a fall in the hero is over before a
       turn fits, so she hops out, slower across than her run so she still comes down near where the route meant */
    var dd = g && g.how === 'fall' ? g.y - fig.y : 0;   // only a drop her route means to take (a word space is a step across, not a dive)
    fig.dropSnd = dd > 60 ? dd : 0;   // a real drop: its sound is the shh alone, when she starts coming down (sfxTick)
    if (dd > 90 && openAbove(nx, fig.y - 4, 90) && openAbove(nx + fig.dir * 30, fig.y - 4, 90)) {   // (never with a line just above: she'd hop up onto it)
      var T = 560 / G + Math.sqrt(2 * (560 * 560 / (2 * G) + dd) / G);
      fig.vy = -560; fig.vx = fig.vx * Math.sqrt(2 * dd / G) / T;   // across no further than walking off would have taken her
      flipFor(T);
    }
  }

  function tickAir(dt) {
    if (fig.wall) { tickWall(dt); return; }
    /* up off the curve toward the wall (rampCling): once her wall pose's soles would be on the wall (above where the curve turns up
       into it) she is on it, with the speed she has left; a run that runs out first drops her back down onto the curve */
    if (fig.rampUp) {
      var U = fig.rampUp, f0 = wallF(), off = (CLAY.ready ? CLAY.H : 113) * .5 - (f0.base - f0.gy) / 2 * wallSc();
      fig.vy = Math.min(fig.vy + G * dt, 1500); fig.y += fig.vy * dt;
      if (fig.y - off <= U.low) { var uv = fig.vy; wallOn(U.side, wallX(U.side), fig.x); fig.rampUp = null; if (fig.y > U.low) { fig.wall.hy -= fig.y - U.low; fig.y = U.low; } fig.vy = uv; return; }
      if (fig.vy < 0) return;
      fig.rampUp = null;
    }
    if (fig.wallPush && (fig.wallPush.t += dt) > .26) fig.wallPush = null;   // the push-off pose, then the jump's own
    fig.vy = fig.boxJump && fig.boxJump.g ? Math.min(fig.vy + fig.boxJump.g * dt, 2600) : Math.min(fig.vy + G * dt, 1500);
    if (fig.dblQ && fig.vy > -220) { var dq = fig.dblQ; fig.dblQ = null; doubleJump(dq); }   // a double click: the second jump comes off the top of the first
    var g = fig.waypoint || fig.target;
    /* steer proportionally, not at full run — the dot of an i is a small landing pad */
    var want = fig.drag ? fig.drag.vx : (g ? Math.max(-RUN, Math.min(RUN, (g.x - fig.x) * 3)) : fig.vx);
    if (g && g.how === 'fall' && (g.x - fig.x) * g.dir < 0) want = fig.vx;   // a drop she walked off past its spot: no pull back mid-fall (she'd land and turn round)
    if (fig.parkour || fig.endFix) want = fig.vx;   // headed for the wall, or back over the divider: her leap is already aimed
    fig.vx += (want - fig.vx) * Math.min(1, dt * 2.2);
    var nx = Math.max(10, Math.min(W - 10, fig.x + fig.vx * dt));
    var ny = fig.y + fig.vy * dt;
    /* SHE NEVER GOES THROUGH THE DIVIDER (her 2026-11-24: "She jumped down and went lower than the curved divider. She shouldn't be
       falling out of bounds like that"): this frame's step is stopped at the line BEFORE anything reads it. Only the last line of this
       tick used to clamp it, so on a long frame (a phone's slow one: up to 75px of fall) the grab, the edge mantle and the wall catch
       all started from a spot under the line; the mantle off the curved end then drew her rising from ~45px below it. The floor is a
       half-plane under a line that only rises toward the edges, so a step that ends above it never crossed it: the end is the sweep */
    ny = Math.min(ny, floorAt(nx));
    /* PAST THE DIVIDER'S END SHE NEVER JUST FALLS (her 2026-11-23: "she can never fall directly in that space"): the moment she
       starts coming down out there, nearer the side of the screen she goes for it (hand and knee on it, slide, kick back: tickWall),
       nearer the divider's end her fall is aimed back onto it */
    if (floorX1 != null && !fig.parkour && !fig.endFix && fig.vy > 0 && !onFloor(nx)) {
      var sW = nx < floorX1 ? -1 : 1, wX = sW < 0 ? 2 : W - 2, eX = sW < 0 ? floorX1 + 24 : floorX2 - 24;
      var Tf = (-fig.vy + Math.sqrt(fig.vy * fig.vy + 2 * G * Math.max(8, floorY - 2 - fig.y))) / G;
      if (Math.abs(wX - nx) < Math.abs(nx - eX)) { fig.parkour = { side: sW, wx: wX }; fig.vx = sW * Math.max(Math.abs(fig.vx) * (fig.vx * sW > 0 ? 1 : 0), (Math.abs(wX - nx) - WALL_GX()) / Tf); }
      else { fig.endFix = true; fig.vx = Math.max(-900, Math.min(900, (eX - nx) / Tf)); }
      nx = Math.max(10, Math.min(W - 10, fig.x + fig.vx * dt));
    }
    if (fig.endFix && onFloor(nx)) fig.endFix = false;
    if (fig.parkour) {   // her hand reaches the wall: on it
      var P = fig.parkour;
      if (P.side * (P.wx - nx) <= WALL_GX() + 1 || (ny >= floorY - 2 && !onFloor(nx))) { fig.y = ny; wallOn(P.side, P.wx, nx); return; }
    } else if (floorX1 != null && ny >= floorY - 2 && !onFloor(nx)) nx = Math.max(floorX1, Math.min(floorX2, nx));   // (a fall aimed back that comes up short: onto the end)
    if (fig.flip) {
      /* the turn always completes before her feet arrive (#99: a flip timed for a lower landing was cut off at ~320° and
         snapped upright as she touched down): falling, if the ground below comes sooner, the spin speeds up to finish */
      if (fig.vy > 0) {
        var fl = groundTop(nx, ny, H), fr = (fl == null ? floorY : fl) - ny;
        var tl = (Math.sqrt(fig.vy * fig.vy + 2 * G * Math.max(fr, 0)) - fig.vy) / G;
        fig.flip.w = Math.max(fig.flip.w, (Math.PI * 2 - fig.flip.rot) / Math.max(tl * .85, .03));
      }
      fig.flip.rot += fig.flip.w * dt;
      if (fig.flip.rot >= Math.PI * 2) fig.flip = null;
    } else if (fig.vy >= 0 && !fig.flipQueued) {   // a tap too: a FAR drop flips (her 2026-10-24: "when it jumps down from far can it do a flip"); hops up and small steps down never reach FLIP_DROP
      /* a big fall earns a full tuck flip — but the LANDING decides, not the fall so
         far. The old rule measured distance already fallen and demanded 60px of floor
         clearance, so most real drops (off a petal, off the headline, onto the floor)
         either never fired or fired too late and got cut off mid-spin. Now, the moment
         the fall begins — or a jump tips over its apex — the landing is read straight
         down off the mask and the spin rate is solved so one clean rotation completes
         just before the feet arrive. */
      fig.flipQueued = true;
      var landAt = groundTop(nx, ny + 1, H);
      var ly = landAt == null ? floorY : landAt;
      var remain = ly - ny;
      /* headed for the CLOUD, however she took off (a hop, a drag-jump, a climb toward a click): always the tuck flip, timed
         to finish as her feet arrive, and the slam (her: "I want it to do a tuck jump flip slam onto the cloud") */
      var cl = hero.querySelector('.jump-box:not(.gone)'), toCloud = false;
      if (cl && !fig.boxJump) {
        var cr = localRect(cl, cv.getBoundingClientRect()), ctop = cr.y1 + cr.h * .12, gT = fig.waypoint || fig.target;
        toCloud = nx >= cr.x1 && nx <= cr.x2 && Math.abs(ly - ctop) < 10;   // straight down is the cloud
        /* …or the cloud is where she's going (a click on/above it): she drifts onto it, so aim the flip at its top */
        if (!toCloud && gT && gT.x >= cr.x1 && gT.x <= cr.x2 && Math.abs(gT.y - ctop) < 14 && ctop > ny) { toCloud = true; ly = ctop; remain = ly - ny; }
      }
      if (toCloud && remain > 12) {
        var tc = (Math.sqrt(fig.vy * fig.vy + 2 * G * remain) - fig.vy) / G;
        startFlip(fig.dir); fig.flip.w = (Math.PI * 2) / (Math.max(tc, .12) * 0.9);
        fig.boxJump = { at: performance.now() };
      } else if (ly - fig.fallFrom > FLIP_DROP && remain > 40) {
        var tl = (Math.sqrt(fig.vy * fig.vy + 2 * G * remain) - fig.vy) / G;
        if (tl > 0.42) {
          startFlip(fig.dir);
          fig.flip.w = Math.min((Math.PI * 2) / (tl * 0.88), 13);
        }
      }
    }
    fig.hangCool = Math.max(0, fig.hangCool - dt);
    if (fig.aim && (fig.vy >= 0 || fig.state !== 'air')) fig.aim = fig.autoUp = null;   // the aim lasts the climb only
    /* monkey-bar grab — free-form leaps, and a jump aimed at a line (a click or tap above her, her route); never while
       chasing a click otherwise */
    if (!fig.flip && !fig.boxJump && !fig.dropping && fig.vy < 160 && !fig.hangCool && !fig.muStand && (!fig.target || fig.aim) && !fig.tapQ && canHang()) {   // never grabs a bar mid box-jump, or while dropping out of the burst cloud
      /* THE CATCH IS A CHANGE OF GRIP, NOT A JUMP OF HER DRAWING: her hands close on a letter top at the moment her
         hanging body's feet would be where her feet are now. Of the lines in reach, the one nearest her hands wins */
      var R = rig(), handY = ny - R.soles, win = R.soles * .03, best = null;
      for (var i = 0; i < bars.length; i++) {
        var b = bars[i];
        if (nx < b.x1 - 4 || nx > b.x2 + 4) continue;
        if (fig.fallFrom != null && fig.fallFrom - b.y > reach()) continue;   // out of her reach from where she took off
        if (fig.aim && b !== fig.aim) continue;   // rising to an aimed line: the ones below pass by
        var g0 = topGrip(nx, b, 12, null, null, null, true);
        if (!g0) continue;
        var dh = handY - g0.y;
        if (dh < -win || dh > Math.max(1.5, -fig.vy / 60)) continue;   // within a frame's rise of the exact height: her feet stay put
        if (best && Math.abs(dh) >= Math.abs(best.dh)) continue;
        best = { b: b, g: g0, dh: dh };
      }
      if (best) {
        fig.aim = null;
        fig.state = 'hang';
        /* her momentum carries into the swing: what was her sideways speed is now the pendulum's (θ' = v / L) */
        var g = { x: best.g.x, y: best.g.y };
        /* PHONE: EVERY CATCH IS ON THE WAY UP (her 2026-11-24: "no matter what, always go into standing on something"): whatever got her
           hands on the letters (a tap's aimed jump, her route's last line, a double jump, a free leap), on touch she muscles up onto them */
        var au = fig.autoUp;   // (her 2026-11-25 "if I tell her to go monkey bar on the phone, then I want her to monkey bar on the phone": a phone catch is a hang again, not an automatic muscle-up; a far line she was sent to still carries autoUp)
        fig.hang = { bar: best.b, G: g, hands: [g, g], th: 0, om: Math.max(-2.2, Math.min(2.2, fig.vx / R.L)), t: 0, rest: 0, k: 0, L: R.L, auto: au,
                     i: 0, u: 0, mode: 'idle', r: 0, off: { x: 0, y: 0 }, goal: au ? null : fig.hangGoal };
        if (!au) { fig.target = null; fig.waypoint = null; }   // a hang she was sent to is where she was going: from here the bars
        fig.autoUp = null; fig.hangGoal = null;
        fig.x = nx; fig.y = ny; fig.vx = 0; fig.vy = 0; fig.flip = null;
        return;
      }
    }
    /* edge mantle: moving into ink whose top is at hand height → climb its lip. Never
       when the goal is BELOW us — mantling up is the opposite of a descent, and it can
       intercept the very landing the route is falling toward. */
    var gA = fig.waypoint || fig.target;
    if (fig.vx && !fig.boxJump && !fig.aim && !(gA && gA.y > ny - 10) && !(fig.flip && fig.flip.off)) {   // never mid aimed hang: the bar is the goal; nor mid bar-end flip (it climbed the next line's letters mid-spin)
      var dirx = fig.vx > 0 ? 1 : -1;
      var py = ny - LEG;
      if (solid(nx + dirx * 5, py)) {
        var t = groundTop(nx + dirx * 5, py - 64, 74);
        if (t != null && t <= py + 10 && t >= py - 64 && clearance(nx + dirx * 5, t) >= MIN_CLR) {
          fig.state = 'mantle';
          fig.mantle = { t: 0, x0: nx, y0: ny, x1: nx + dirx * 11, y1: t };
          fig.vx = 0; fig.vy = 0; fig.flip = null;
          return;
        }
      }
    }
    /* a letter's SIDE stops her sideways (she slides down it); before this, falling into one snapped her up onto its
       top in a single frame, which is most of what read as "spazzing" on the way somewhere */
    if (!fig.boxJump && !(fig.flip && fig.flip.off) && solid(nx, Math.min(ny, fig.y) - 6) && !solid(fig.x, Math.min(ny, fig.y) - 6)) { nx = fig.x; fig.vx = 0; }   // (never the cloud jump: its arc flies through the copy by design)
    if (fig.vy > 0) {
      var land = groundTop(nx, fig.y + 0.5, Math.max(2, ny - fig.y + 2));
      if (fig.thru && ny > fig.thru) fig.thru = 0;
      if (land != null && land >= fig.y - 2 && land <= ny + 0.5 && clearance(nx, land) >= MIN_CLR && !(fig.thru && land < fig.thru)) {   // never lands ABOVE her feet (nor on the letters a Down key drops her through)
        fig.x = nx; fig.y = land;
        var drop = fig.y - fig.fallFrom;
        fig.flip = null;
        /* a drop waypoint is only served by landing LOWER — same-height landings are the
           bump-dither this route is trying to escape; also, dropping a level worked, so
           the side bias is no longer needed */
        if (fig.waypoint && fig.waypoint.drop && fig.y > fig.waypoint.y + STEP_DOWN) {
          fig.waypoint = null;
          if (fig.target) fig.target.avoid = 0;
        }
        fig.state = (fig.target || fig.drag || onCurve(fig.x)) ? 'move' : 'idle';   // (down on the curve: she slides off it, tickGround)
        /* she BRACES (her 2026-10-26, #76: "athletes ... brace impact"): every landing that comes down with any speed bends
           the knees and stands back up, longer the harder she hit; a frame-deep gap between letters is still a walk */
        if (fig.vy > 150) brace(0.07 + 0.15 * Math.min(1, (fig.vy - 150) / 900));   // (#84: was 0.09-0.29s)
        if (fig.vy > 620 || drop > 130) puff(fig.x, fig.y, 4);
        /* the SLAM: a long crouch, a bigger puff, and the cloud hears it. ANY landing on the cloud counts, not only the
           jump its click sends (her: "nothing happens when I jump on the cloud" — she'd hopped onto it herself) */
        if (fig.boxJump) { fig.boxJump = null; brace(0.36); puff(fig.x, fig.y, 11); }   // the SLAM: deep crouch, big puff
        fig.dropping = false;
        /* she LANDS: no skid on into the next spot (her: "when it lands it keeps moving … it slides"). Not off a gap
           between two letters a frame deep: that is still a walk, and stopping dead there stuttered every word */
        if (fig.vy > 250 || drop > STEP_DOWN) fig.vx = 0;
        fig.vy = 0;
        return;
      }
    }
    fig.x = nx; fig.y = onFloor(nx) ? Math.min(ny, floorAt(nx)) : ny;
    /* only when coming DOWN: a jump launched from the floor sits on it for its first (zero-length) frame, and this used to
       cancel it on the spot — why a second jump at the cloud, from the floor, sometimes never left the ground */
    if (fig.y >= floorAt(fig.x) && fig.vy >= 0 && onFloor(fig.x)) { fig.state = (fig.target || fig.drag || onCurve(fig.x)) ? 'move' : 'idle'; fig.vy = 0; fig.flip = null; fig.dropping = false; fig.thru = 0; }
  }

  /* ------------------------------------------------------------------ the hang: a pendulum
     (her 2026-11-22, on the rigged hand-over-hand: "super weird and disjointed … it looks like the elbows are getting
     dislocated because you're just manipulating the pictures"; and "gravity should work for her, so she like is down,
     but like she needs momentum to swing … use the laws of physics"). No cut-out limbs and no bending of her pictures:
     she is a WHOLE clay frame turned about the fist on the letter, and the turn is a real pendulum,
       θ'' = −(g/L)·sin θ − c·θ'      L = grip → her centre of mass, g scaled so one swing takes PERIOD s at any size,
     so at rest her centre of mass hangs straight under her hands, any lean comes from the swing and passes back through
     vertical, and the speed peaks at the bottom and dies at each end. Driven (the arrows, or the cursor off to one side)
     she PUMPS: a small hip kick each time she passes the bottom going that way, the swing builds and turns at each end
     (her: "I do like the swinging, like when it changes directions"); let go, and the swing's speed carries her. Which
     whole frame shows is read off the swing (HANGF + SWING.front/back), so new frames slot in by angle and phase.
     Hand over hand waits for whole frames made for it (Flora); the rigged version is retired. */
  /* the old hang frame, in its own pixels: where the fists close (gx, gy) — the muscle-up's climb frames are pinned the same way */
  var HANGF = { 0: { gx: 29.5, gy: 13, cx: 28.7, cy: 131.1 } };
  var SWING = { period: 1.25, rest: 1.6, drive: .25, amp: .32, kick: .7 };   // s; damping /s idle and driven; rad (the clip's own swing); rad/s
  /* THE TARZAN CLIP (Flora, 2026-11-23, her "think about Tarzan … gravity should work for her … she needs momentum to swing"):
     75 whole frames of her going hand over hand along a bar (MiniMax i2v from her own clay, keyed, the bar taken out, sized to
     her clay). Each frame is pinned to the fist she hangs from (ox, oy) and carries its centre of mass (mx, my) and swing
     angle (th), measured off the clip with the camera's pan taken out. Holds A (the dead hang, then the first reach), B, C, D;
     the next hold is a step further on (TZ.step), and D runs back into B at the pose that matches (raw 148 → 66). */
  var TZ = null, TZQ = 272 / 688, TZ_FLIGHT = [36, 38, 80, 82, 122, 124];   // clip px → clay px; the frames with neither hand on the bar
  function tz() {
    if (TZ) return TZ;
    var L = CLAY.man && CLAY.man['tarzan-x3']; if (!L || !L.length) return null;
    var at = function (raw) { for (var i = 0; i < L.length; i++) if (L[i].raw === raw) return i; return 0; };
    TZ = { L: L, loopFrom: at(148), loopTo: at(66), step: { B: (726.5 - 476) * TZQ, C: (963 - 726.5) * TZQ, D: (1213.5 - 963) * TZQ } };
    /* HAND OVER HAND (her 2026-11-23: "if she's continuously moving, one hand reaches out and the other hand extends and swings
       past where the one hand is reaching out … The only time that the following hand reaches and grabs the bar at the same place
       is when she is stopping"). A second Flora clip (alternate-2, 12 poses/s like the first) is a true hand-over-hand: S (from a
       dead hang the far arm reaches out and catches), H1 (the near hand lets go behind and swings PAST it to the next letter),
       H2 (the far hand swings past), H3 (the near hand again), and H3's catch is H2's first pose, so it runs on and on, the hands
       taking turns to lead. Each frame is pinned to the leading hand. TRAVELLING, every catch is a pass; on the LAST catch she
       stops: the trailing hand only comes up beside the leading one (its beside pose, T.hoh.stop) and she cross-fades into the
       first clip's dead hang (C 100), both hands together, straight under them. A single step from a dead hang is the first clip's
       reach she loved, which ends in exactly that match. */
    var first = {}, last = {}; L.forEach(function (g, q) { if (/^(S|H[123])$/.test(g.seg)) { if (first[g.seg] == null) first[g.seg] = q; last[g.seg] = q; } });
    var rawAt = function (raw) { for (var q = 0; q < L.length; q++) if (L[q].raw === raw) return q; return -1; };
    if (first.S != null && first.H1 != null && first.H2 != null && first.H3 != null) {
      var Q2 = 272 / 975;
      TZ.hoh = { go: rawAt(1012), first: first, last: last, catchTo: { S: 'H1', H1: 'H2', H2: 'H3', H3: 'H2' }, stop: { H1: rawAt(1050), H2: rawAt(1094), H3: rawAt(1136) }, rest: at(100) };
      TZ.step.S = (902.5 - 682) * Q2; TZ.step.H1 = (1058 - 902.5) * Q2; TZ.step.H2 = (1267 - 1058) * Q2; TZ.step.H3 = (1440 - 1267) * Q2;   // the catch that ends each
    }
    TZ.after = { A: 'B', B: 'C', C: 'D', D: 'B' };   // the first clip's reaches: the hold each lands on
    return TZ;
  }
  function hohSeg(g) { return !!TZ.hoh && /^(S|H[123])$/.test(g.seg); }
  function tzNext(i) { var H = TZ.hoh, g = TZ.L[i]; if (H && hohSeg(g) && i === H.last[g.seg]) return H.first[H.catchTo[g.seg]]; return i === TZ.loopFrom ? TZ.loopTo : Math.min(i + 1, TZ.L.length - 1); }
  function tzSame(i) { return i === TZ.loopFrom; }   // the next pose is on the same hold: a change of pose, not a catch
  function rig() {
    var H0 = CLAY.ready ? CLAY.H : 113, sc = H0 / (CLAY.man ? CLAY.man._ref : 252), T = tz(), f = T && T.L[0];
    return f ? { h: H0, sc: sc, soles: (f.oy + f.base) * sc, L: Math.hypot(f.mx, f.my) * sc } : { h: H0, sc: sc, soles: 272 * sc, L: 118 * sc };
  }
  function canHang() {
    if (!CLAY.ready) return true;
    if (CLAY.sheetIn && CLAY.sheetIn['tarzan-x3']) return true;
    if (CLAY.tricks) CLAY.tricks(['tarzan-x3']);   // asked for: it comes next
    return false;
  }
  /* the next hold a step on: the underside of a letter at the same height (±6px), the nearest to where her hand lands in the clip */
  function tzHold(h, seg) { return holdNear(h, h.G.x + fig.dir * TZ.step[seg] * rig().sc, 10); }
  function holdNear(h, want, r) {
    var best = null;
    for (var dx = 0; dx <= r; dx++) for (var s2 = -1; s2 <= 1; s2 += 2) {
      var x = Math.round(want + s2 * dx), t = glyphBottom(x, h.bar);
      if (t != null && Math.abs(t - h.G.y) <= 6 && (!best || dx + Math.abs(t - h.G.y) * .5 < best.sc)) best = { x: x, y: t, sc: dx + Math.abs(t - h.G.y) * .5 };
      if (!dx) break;
    }
    return best && { x: best.x, y: best.y, dx: best.x - want, dy: best.y - h.G.y };
  }
  function ofs2(h, q) { var z = TZ_FLIGHT.indexOf(TZ.L[q].raw); return h.next && z >= 0 ? (z % 2 + 1) / 2 : 0; }   // how much of the gap to the next letter is taken up by pose q (in the air, halves)
  function turnReady() { return !CLAY.ready || !!(CLAY.sheetIn && CLAY.sheetIn['hang-turn-x3'] && CLAY.man['hang-turn-x3']); }
  /* THE TURN, A SWING ROUND ONE HAND (her 2026-11-23: "your hand that is holding the bar faces direction A. When you're turning, rather
     than reaching your hand forward for the next rung like you normally would, instead you kind of reach it forward and turn around ...
     you're rotating on your shoulder cuff around, and so your hand is still facing the old direction and you're twisting on your body.
     And then the second hand now faces the new direction and holds it. And once it grasps a hold of the new direction, then the old
     direction is released from hand one, and then it kind of does the scoop up, swing, grab in the new direction"). The Flora clip of her
     turning under the bar (hang-turn-x3: side, three-quarter, front, three-quarter, the other side) used to be pinned at the midpoint
     between her fists, so she spun in place ("like a ballerina that just like twirled in place"). Now every frame is pinned to the fist
     that is actually holding, and the swing is a real pendulum about that fist:
       b  frames 0-7 on HAND 1 (the hold she had): hand 2 reaches forward and her body swings out and round under hand 1, whatever swing
          she had carried on, arriving at the top of it just as hand 2 meets the next letter (her centre of mass then sits between them)
       c  frame 7: both hands on the bar, her body square to us
       d  hand 1 lets go: frames 8-14 on HAND 2, swinging back under it as she comes round to face the new way
       e  the hand-over-hand clip's own reach (its S: from one hand, the other scoops up and catches) the new way (tickHang 'go')
     TURN_L / TURN_R: each frame's two fists (x, the clip's own px from its pin), measured off the frames; L is the fist on the new
     direction's side, R the old one's. Hand 2 reaches forward (R) when there is a letter there; else back (L), mirrored roles */
  var TURN_L = [0, -1, -2.4, -2.9, -18, -26.3, -26.4, -26, -24.8, -23, -21, -19, -15, -6, -3],
      TURN_R = [0, 12, 20.1, 20.1, 21, 22.2, 23.6, 26, 27.7, 28, 21, 3, 0, -2, -3];
  var TURN_B = .26, TURN_C = .06, TURN_D = .16, TURN_IN = .08, TURN_CATCH = 7;   // s: swing round, both hands, round onto hand 2, the fade out of the pose she was in; the both-hands frame
  /* THE SCOOP (her 2026-11-23, on the turn above: "instead of scooping forward, it scoops around, like the head turns and it scoops around to
     the other side ... the head turns and the arm scoops around to the other side and the body twists to grab the other direction", and
     "the head has to turn too ... the head leads the movement, and the arm sweeps, or like scoops"): a second Flora clip (hang-scoop-x3,
     MiniMax first/middle/last frames from her face-fixed turn frames, 480p, keyed and sized like the others) of exactly that, every frame
     pinned at HAND 1, which never moves in it: her head turns first, the free hand comes off the bar, drops to her side and scoops round in
     front of her as her body twists and swings, then comes up and catches the bar SCOOP_R further on (frame SCOOP_CATCH); both hands
     hold while the swing comes back (to the last frame), then the turn's own frames 8-14 bring her round to face the new way on hand 2.
     It replaces b and c when hand 2 has a letter on the old direction's side; else the turn above */
  var SCOOP = 'hang-scoop-x3', SCOOP_R = 33, SCOOP_CATCH = 11, SCOOP_B = .34, SCOOP_C = .12, SCOOP_D0 = 8;   // clay px; frame; s, s; the turn frame d starts from
  function scoopIn() { return !!(CLAY.sheetIn && CLAY.sheetIn[SCOOP] && CLAY.man[SCOOP]); }
  function turnTh(k, P) { var g = CLAY.man['hang-turn-x3'][k]; return Math.atan2(g.mx - P, g.my); }   // frame k: her centre of mass from its fist P, as an angle
  /* waiting for a hand to be on a letter: mid-catch (the drift to the next letter) or in the first clip's flight frames */
  function turnWait(h) {
    if (h.mode !== 'go') return false;
    var L = TZ.L, n = tzNext(h.i);
    return TZ_FLIGHT.indexOf(L[h.i].raw) >= 0 || (!!h.next && L[n].seg !== L[h.i].seg && !tzSame(h.i));
  }
  /* THE WHIP, ONE SWIFT MOTION, NEVER FACING US (her 2026-11-23, on the scoop: "she's like smiling like at nowhere ... She should be always
     looking towards the direction that she is moving ... She just never need to look at us ... in one swift motion she turns around and
     grabs the other direction bar with her other hand. However, her first hand is still on the bar facing the original direction. She then
     lets go of it and grabs a bar further in the new direction"). Only frames whose face points along the bar: the turn clip's 0-3 (side
     on, her old way, the free hand coming up off her side) on HAND 1, then a cut straight to 12-14 (side on, the new way): in 12 hand 2 has
     just closed on the bar beside hand 1, toward the new way (the overlap is that one instant), 13-14 on HAND 2 as hand 1 comes off, and
     on into the hand-over-hand reach. The front views (4-11, and the scoop clip) are her looking at the camera, so they are not used.
     ponytail: no frame of her head turning toward the new way BEFORE her body exists (no back view), so the head does not lead yet */
  /* (the scoop clip, hang-scoop-x3, stays in assets/clay but is not fetched while TURN_WHIP is on: add it back to TRICKS to use it) */
  var TURN_WHIP = true, WHIP = [[0, 'L', 1], [1, 'L', 1], [2, 'L', 1], [3, 'L', 1], [12, 'R', 1], [13, 'L', 2], [14, 'L', 2]], WHIP_T = .3;   // frame, fist, hand; s for all of it
  function whipStart(h) {
    var sc = rig().sc, A = fig.dir, G1 = { x: h.G.x + h.off.x, y: h.G.y + h.off.y }, sep = (TURN_R[12] - TURN_L[12]) * sc;
    var G2 = holdNear(h, G1.x - A * sep, 3) || holdNear(h, G1.x - A * sep, 10) || G1;   // hand 2 beside hand 1, the new way's side (else on the same letter)
    G2 = { x: G2.x, y: G2.y };
    h.turn = { t: 0, A: A, whip: true, G1: G1, G2: G2, th: h.th, om: h.om || 0, ph: 'b', from: { k: h.i, rot: h.r + (h.ri || 0) } };
    h.mode = 'idle'; h.next = null; h.stop = false; h.fade = null; h.xf = null; h.mix = null; h.off = { x: 0, y: 0 }; h.u = 0; h.ri = 0;
    return true;
  }
  function tickWhip(h, dt, sc) {
    var tu = h.turn, A = tu.A, w0 = 2 * Math.PI / SWING.period, n = WHIP.length, step = WHIP_T / n;
    tu.t += dt;
    if (tu.t >= WHIP_T) return turnEnd(h);
    var q = Math.min(n - 1, Math.floor(tu.t / step)), e = tu.t / step - q, W = WHIP[q], hand = W[2];
    if (hand === 2 && tu.ph !== 'd') { tu.ph = 'd'; tu.th = A * turnTh(W[0], TURN_L[W[0]]) - tu.rho; tu.om = 0; }   // hand 1 off: she swings from hand 2
    else if (W[0] === 12 && tu.ph === 'b') { tu.ph = 'c'; }   // hand 2 closes on the bar
    for (var s3 = 0; s3 < 2; s3++) { tu.om += (-w0 * w0 * Math.sin(tu.th) - SWING.drive * tu.om) * dt / 2; tu.th += tu.om * dt / 2; }
    var at = function (w) { var P = (w[1] === 'L' ? TURN_L : TURN_R)[w[0]], G = w[2] === 1 ? tu.G1 : tu.G2; return turnAt(w[0], P, G, A * turnTh(w[0], P) - tu.th, sc); };
    var cur = at(W), mix = null, nx = q < n - 1 ? WHIP[q + 1] : null;
    tu.rho = cur.rot;
    if (tu.t < TURN_IN && tu.from) { var fi = tu.t / TURN_IN; fi = fi * fi * (3 - 2 * fi);   // the pose she was in fades out, pinned at hand 1 as it was
      mix = { s: 'tarzan-x3', k: tu.from.k, a: 1 - fi, rot: tu.from.rot, tx: tu.G1.x - cur.x, ty: tu.G1.y - cur.y }; }
    else if (nx && nx[0] !== 12 && e > .6) { var nn = at(nx), a = (e - .6) / .4; a = a * a * (3 - 2 * a); mix = { k: nn.k, a: a, rot: nn.rot, tx: nn.x - cur.x, ty: nn.y - cur.y }; }   // (into 12, a cut: the whip)
    tu.pk = { s: 'hang-turn-x3', k: cur.k, anchor: 'hands', ax: cur.x, ay: cur.y, rot: cur.rot, pin: true, mix: mix, hold: hand === 1 ? (tu.ph === 'c' ? [tu.G1, tu.G2] : [tu.G1]) : [tu.G2], ph: tu.ph };
    var f = CLAY.man['hang-turn-x3'][cur.k], cr = Math.cos(cur.rot), sr = Math.sin(cur.rot), mx = A * f.mx * sc, my = f.my * sc, fy = (f.oy + f.base) * sc;
    h.P = { x: cur.x + mx * cr - my * sr, y: cur.y + mx * sr + my * cr };
    fig.x = h.hx = h.P.x; fig.y = cur.y + mx * sr + fy * cr;
    h.th = tu.th; h.om = tu.om;
  }
  function turnStart(h) {
    if (TURN_WHIP) return whipStart(h);
    var sc = rig().sc, A = fig.dir, k = TURN_CATCH, sep = (TURN_R[k] - TURN_L[k]) * sc, G1 = { x: h.G.x + h.off.x, y: h.G.y + h.off.y }, G2 = null, side = 0, scoop = false;
    /* a letter right where hand 2 lands (the scoop first), else the nearest within 10px (the difference is taken up as hand 1 lets go) */
    var ss = scoopIn() ? SCOOP_R * sc : 0;
    [3, 10].some(function (r) {
      if (ss && (G2 = holdNear(h, G1.x + A * ss, r))) { side = 1; scoop = true; sep = ss; return true; }
      return [1, -1].some(function (s) { return (G2 = holdNear(h, G1.x + A * s * sep, r)) && (side = s); });
    });
    if (!G2) return false;
    G2 = { x: G2.x, y: G2.y };
    var dx = G2.x - G1.x, dy = G2.y - G1.y, rc = Math.atan2(A * side * dy, A * side * dx);   // her turn at the catch: the line through her fists runs through both letters
    var P1 = side > 0 ? TURN_L : TURN_R, w0 = 2 * Math.PI / SWING.period;
    var thC = A * turnTh(k, P1[k]) - rc, th0 = h.th, wt = w0 * TURN_B;
    /* momentum: from wherever her swing has her (θ0, often trailing behind a hand that has just caught), she throws her weight so the
       swing carries her centre of mass out to where hanging from hand 1 lifts hand 2 to the letter (θc) just as it gets there:
       θ(t) = θ0·cos w0t + (θ'/w0)·sin w0t = θc at t = TURN_B */
    var om = w0 * (thC - th0 * Math.cos(wt)) / Math.sin(wt);
    h.turn = { t: 0, A: A, side: side, G1: G1, G2: G2, rc: rc, res: { x: G2.x - G1.x - A * side * sep * Math.cos(rc), y: G2.y - G1.y - A * side * sep * Math.sin(rc) },
      th: th0, om: om, ph: 'b', from: { k: h.i, rot: h.r + (h.ri || 0) }, scoop: scoop };
    if (scoop) { h.turn.r0 = A * CLAY.man[SCOOP][0].th - th0; h.turn.om = 0; }   // her lean as she was, easing into the clip's own swing
    h.mode = 'idle'; h.next = null; h.stop = false; h.fade = null; h.xf = null; h.mix = null; h.off = { x: 0, y: 0 }; h.u = 0; h.ri = 0;
    return true;
  }
  /* one frame of the turn: frame k pinned so its fist P (own px) is ON grip G, turned rho (the anchor is the clip's own pin) */
  function turnAt(k, P, G, rho, sc, s) {
    var d = fig.hang.turn.A;
    return { s: s || 'hang-turn-x3', k: k, x: G.x - d * P * sc * Math.cos(rho), y: G.y - d * P * sc * Math.sin(rho), rot: rho };
  }
  /* b and c from the scoop clip (pinned at hand 1, its own swing), then d from the turn's frames 8-14 on hand 2 */
  function tickScoop(h, dt, sc) {
    var tu = h.turn, A = tu.A, SL = CLAY.man[SCOOP], TL = CLAY.man['hang-turn-x3'], w0 = 2 * Math.PI / SWING.period, last = TL.length - 1, SN = SL.length - 1, C = SCOOP_CATCH;
    tu.t += dt;
    if (tu.ph === 'b' && tu.t >= SCOOP_B) tu.ph = 'c';   // hand 2 on the letter
    if (tu.ph === 'c' && tu.t >= SCOOP_B + SCOOP_C) { tu.ph = 'd'; tu.th = A * turnTh(SCOOP_D0, TURN_R[SCOOP_D0]) - tu.rc; tu.om = 0; }   // hand 1 lets go: she swings from hand 2
    if (tu.ph === 'd' && tu.t >= SCOOP_B + SCOOP_C + TURN_D) return turnEnd(h);
    var cur, nxt = null, e = 0, hold, G1r = { x: tu.G1.x + tu.res.x, y: tu.G1.y + tu.res.y };
    if (tu.ph === 'b') {
      var u = tu.t / SCOOP_B, kf = u * C, k = Math.min(C, Math.floor(kf)), w = Math.max(0, Math.min(1, (u - .55) / .45));
      w = w * w * (3 - 2 * w); e = kf - k;
      var r0 = tu.r0 * Math.exp(-tu.t / .15), rho = (1 - w) * r0 + w * tu.rc;   // the lean she had eases into the clip's own swing, landing level with the letters
      cur = turnAt(k, 0, tu.G1, rho, sc, SCOOP); if (k < C) nxt = turnAt(k + 1, 0, tu.G1, rho, sc, SCOOP);
      hold = [tu.G1];
    } else if (tu.ph === 'c') {
      var v = (tu.t - SCOOP_B) / SCOOP_C, kf1 = C + Math.min(1, v) * (SN - C), k1 = Math.min(SN, Math.floor(kf1)), vv = v * v * (3 - 2 * v);
      var G = { x: tu.G1.x + tu.res.x * vv, y: tu.G1.y + tu.res.y * vv };   // (a letter a few px off where hand 2 lands: hand 1 gives way that much)
      e = kf1 - k1; cur = turnAt(k1, 0, G, tu.rc, sc, SCOOP); if (k1 < SN) nxt = turnAt(k1 + 1, 0, G, tu.rc, sc, SCOOP);
      hold = [G, tu.G2];
    } else {
      for (var s3 = 0; s3 < 2; s3++) { tu.om += (-w0 * w0 * Math.sin(tu.th) - SWING.drive * tu.om) * dt / 2; tu.th += tu.om * dt / 2; }
      var u2 = (tu.t - SCOOP_B - SCOOP_C) / TURN_D, kf2 = SCOOP_D0 + u2 * (last - SCOOP_D0), k2 = Math.min(last, Math.floor(kf2));
      e = kf2 - k2;
      cur = turnAt(k2, TURN_R[k2], tu.G2, A * turnTh(k2, TURN_R[k2]) - tu.th, sc);
      if (k2 < last) nxt = turnAt(k2 + 1, TURN_R[k2 + 1], tu.G2, A * turnTh(k2 + 1, TURN_R[k2 + 1]) - tu.th, sc);
      hold = [tu.G2];
    }
    var mix = null, td = tu.t - SCOOP_B - SCOOP_C;
    if (tu.t < TURN_IN && tu.from) { var fi = tu.t / TURN_IN; fi = fi * fi * (3 - 2 * fi);   // the pose she was in fades out, pinned at hand 1 as it was
      mix = { s: 'tarzan-x3', k: tu.from.k, a: 1 - fi, rot: tu.from.rot, tx: tu.G1.x - cur.x, ty: tu.G1.y - cur.y }; }
    else if (tu.ph === 'd' && td < TURN_IN) { var fd = td / TURN_IN; fd = fd * fd * (3 - 2 * fd);   // the scoop's last frame fades into the turn's, both on hand 2
      mix = { s: SCOOP, k: SN, a: 1 - fd, rot: tu.rc, tx: G1r.x - cur.x, ty: G1r.y - cur.y }; }
    else if (nxt && e > .65) { var a = (e - .65) / .35; a = a * a * (3 - 2 * a); mix = { s: nxt.s, k: nxt.k, a: a, rot: nxt.rot, tx: nxt.x - cur.x, ty: nxt.y - cur.y }; }   // stepped like clay, each pose fading into the next only at its end (the scoop moves a lot between poses: a longer fade showed two of her)
    tu.pk = { s: cur.s, k: cur.k, anchor: 'hands', ax: cur.x, ay: cur.y, rot: cur.rot, pin: true, mix: mix, hold: hold, ph: tu.ph };
    var f = CLAY.man[cur.s][cur.k], cr = Math.cos(cur.rot), sr = Math.sin(cur.rot), mx = A * f.mx * sc, my = f.my * sc, fy = (f.oy + f.base) * sc;
    h.P = { x: cur.x + mx * cr - my * sr, y: cur.y + mx * sr + my * cr };
    fig.x = h.hx = h.P.x; fig.y = cur.y + mx * sr + fy * cr;
    if (tu.ph !== 'd') { tu.th = Math.atan2(h.P.x - tu.G1.x, h.P.y - tu.G1.y); }   // (her swing angle about hand 1, for a release mid-turn)
    h.th = tu.th; h.om = tu.om;
  }
  function tickTurn(h, dt, sc) {
    if (h.turn.whip) return tickWhip(h, dt, sc);
    if (h.turn.scoop) return tickScoop(h, dt, sc);
    var tu = h.turn, A = tu.A, TL = CLAY.man['hang-turn-x3'], w0 = 2 * Math.PI / SWING.period, last = TL.length - 1, C = TURN_CATCH;
    var P1 = tu.side > 0 ? TURN_L : TURN_R, P2 = tu.side > 0 ? TURN_R : TURN_L;
    tu.t += dt;
    if (tu.ph === 'b' && tu.t >= TURN_B) { tu.ph = 'c'; tu.th = A * turnTh(C, P1[C]) - tu.rc; tu.om = 0; }   // hand 2 on: both hands hold her still
    if (tu.ph === 'c' && tu.t >= TURN_B + TURN_C) { tu.ph = 'd'; tu.th = A * turnTh(C, P2[C]) - tu.rc; tu.om = 0; }   // hand 1 lets go: she swings from hand 2
    if (tu.ph === 'd' && tu.t >= TURN_B + TURN_C + TURN_D) return turnEnd(h);
    if (tu.ph !== 'c') for (var s3 = 0; s3 < 2; s3++) { tu.om += (-w0 * w0 * Math.sin(tu.th) - SWING.drive * tu.om) * dt / 2; tu.th += tu.om * dt / 2; }
    var cur, nxt = null, e = 0, hold, G;
    if (tu.ph === 'b') {
      var u = tu.t / TURN_B, kf = u * C, k = Math.min(C, Math.floor(kf)), w = Math.max(0, Math.min(1, (u - .45) / .55));
      w = w * w * (3 - 2 * w); e = kf - k;
      var rho = function (q) { return (1 - w) * (A * turnTh(q, P1[q]) - tu.th) + w * tu.rc; };   // the pendulum's, landing exactly level with the letters
      cur = turnAt(k, P1[k], tu.G1, rho(k), sc); if (k < C) nxt = turnAt(k + 1, P1[k + 1], tu.G1, rho(k + 1), sc);
      hold = [tu.G1];
    } else if (tu.ph === 'c') {
      var v = (tu.t - TURN_B) / TURN_C; v = v * v * (3 - 2 * v);
      G = { x: tu.G1.x + tu.res.x * v, y: tu.G1.y + tu.res.y * v };   // (a letter a few px off where hand 2 lands: hand 1 gives way that much as it lets go)
      cur = turnAt(C, P1[C], G, tu.rc, sc); hold = [G, tu.G2];
    } else {
      var u2 = (tu.t - TURN_B - TURN_C) / TURN_D, kf2 = C + u2 * (last - C), k2 = Math.min(last, Math.floor(kf2));
      e = kf2 - k2;
      cur = turnAt(k2, P2[k2], tu.G2, A * turnTh(k2, P2[k2]) - tu.th, sc);
      if (k2 < last) nxt = turnAt(k2 + 1, P2[k2 + 1], tu.G2, A * turnTh(k2 + 1, P2[k2 + 1]) - tu.th, sc);
      hold = [tu.G2];
    }
    var mix = null;
    if (tu.t < TURN_IN && tu.from) { var fi = tu.t / TURN_IN; fi = fi * fi * (3 - 2 * fi);   // the pose she was in fades out, pinned at hand 1 as it was
      mix = { s: 'tarzan-x3', k: tu.from.k, a: 1 - fi, rot: tu.from.rot, tx: tu.G1.x - cur.x, ty: tu.G1.y - cur.y }; }
    else if (nxt && e > .01) { var a = e * e * (3 - 2 * e); mix = { k: nxt.k, a: a, rot: nxt.rot, tx: nxt.x - cur.x, ty: nxt.y - cur.y }; }   // frame to frame, a cross-fade, never a pop
    tu.pk = { s: 'hang-turn-x3', k: cur.k, anchor: 'hands', ax: cur.x, ay: cur.y, rot: cur.rot, pin: true, mix: mix, hold: hold, ph: tu.ph };
    /* her body and feet, from the frame as drawn */
    var f = TL[cur.k], cr = Math.cos(cur.rot), sr = Math.sin(cur.rot), mx = A * f.mx * sc, my = f.my * sc, fy = (f.oy + f.base) * sc;
    h.P = { x: cur.x + mx * cr - my * sr, y: cur.y + mx * sr + my * cr };
    fig.x = h.hx = h.P.x; fig.y = cur.y + mx * sr + fy * cr;
    h.th = tu.th; h.om = tu.om;
  }
  /* e: facing the new way from hand 2; the swing goes on in the hand-over-hand clip (or she just hangs, if she's there) */
  function turnEnd(h) {
    var tu = h.turn, T = TZ, L = T.L, want = h.turnWant;
    fig.dir = -tu.A; h.turn = null; h.G = tu.G2; h.hands = [tu.G2, tu.G2]; h.off = { x: 0, y: 0 }; h.th = tu.th; h.om = tu.om; h.u = 0; h.ri = 0; h.mix = null; h.xf = null;
    var onward = want === fig.dir && T.hoh && tzHold(h, 'S');
    if (onward) { h.mode = 'go'; h.i = T.hoh.go; h.next = onward; h.stop = false; h.fade = null; }   // the reach the new way, already under way
    else { h.mode = 'idle'; h.i = 0; }
    h.r = fig.dir * L[h.i].th - h.th;   // her centre of mass where the swing has it
    tickHang(0);
  }
  /* THE END OF THE BARS (her 2026-11-25: "if I were dragging the avatar left and right ... and then I pull the drag like past the edge
     of a direction, and then there's like no more monkey bars left, then when she reaches the end of the monkey bars, she does like a
     flip and jumps down and then continues to run to the point like she normally would" · "Right now ... she just stops ... and she
     swings there. She doesn't continue to go to the mouse"): a drag (mouse or finger) or a held arrow past the end of the line she
     holds is a way she wants to go (barPast); with no letter left to reach that way she lets go at the catch with a forward flip
     (dismount), lands on whatever is below (tickAir: text, box or floor), and the drag's follow runs her on to the pointer once she
     is down. The cursor merely hovering past the end is not a drag: she still swings there */
  function barPast(h, raw) {
    if (raw == null || h.auto || !((down && down.moved) || (fig.drag && fig.drag.key))) return 0;
    return raw > h.bar.x2 ? 1 : raw < h.bar.x1 ? -1 : 0;
  }
  function dismount(dir) {
    release(dir);
    fig.dir = dir; fig.vx = dir * 150; fig.vy = -400; fig.flipQueued = true;   // a short hop forward, so she comes down just past the end (one flip: none again on a long fall)
    if (!rmActive()) { startFlip(dir); fig.flip.off = true; }   // Reduce Motion: a plain drop. (off: hanging, her body hangs in front of the line below; the flip passes in front of it too, never caught by it: tickAir)
    follow({ x: mouse.x, y: mouse.y });   // in the air this waits for her landing, then runs her on (a held arrow steers by itself)
  }
  function tickHang(dt) {
    var h = fig.hang, R = rig(), T = tz(), sc = R.sc;
    h.t += dt; h.L = R.L;
    if (!T) { fig.x = h.G.x; fig.y = h.G.y + R.soles; return; }
    var L = T.L;
    /* where she's going: the arrows; else the click or tap along the line; else, on a laptop, the cursor */
    if (h.pin && Math.abs(mouse.x - h.pin.x) > 2 * (CLAY.ready ? CLAY.H : 120)) { h.pin = null; h.settle = false; }   // the cursor has moved well away: following again
    var gx = fig.drag && fig.drag.key ? (fig.drag.vx > 0 ? 1e6 : -1e6) : h.goal != null ? h.goal : !touchMode && performance.now() - keyAt > 4000 && !CLAY.away && !h.pin ? mouse.x : null;
    var past = barPast(h, gx);
    if (gx != null) gx = Math.max(h.bar.x1, Math.min(h.bar.x2, gx));
    var near = T.step.B * sc * (down && down.moved ? .2 : .55), want = past || (h.auto || gx == null || Math.abs(gx - h.G.x) < near ? 0 : gx > h.G.x ? 1 : -1);
    if (!want && h.goal != null && h.mode === 'idle') h.goal = null;   // there
    h.rest = want ? 0 : h.rest + dt;
    /* THE TURN STARTS AT ONCE (her 2026-11-23, dragging along the bars and back: "the animation has to like pause and think. It doesn't
       just do the swift turn with my cursor"): it used to wait for the reach under way to finish, a stop, a 0.45s settle into the dead
       hang and the swing to pass the bottom. Now from whatever she's doing, the moment a hand is on a letter (tickTurn) */
    h.turnWant = want;
    if (h.turn) { if (CLAY.man && CLAY.man['hang-turn-x3']) { tickTurn(h, dt, sc); return; } h.turn = null; }
    if (want && want !== fig.dir && CLAY.ready && turnReady() && !turnWait(h) && turnStart(h)) { tickTurn(h, 0, sc); return; }
    var w0 = 2 * Math.PI / SWING.period, f = L[h.i];
    if (h.mode === 'go') {
      /* TRAVELLING: the clip's own swing, played on her pendulum's clock (its swing took ~1.67s; hers takes SWING.period) */
      /* RUN, NOT ALWAYS WALK (her 2026-11-23, #960: "she could probably move a little bit faster ... kind of like running versus
         walking. She's like almost always walking"): with more than a couple of reaches to go the clip plays up to ~2x faster (a
         catch every ~1.1s, not ~2.2s), easing back to the walk for the last reaches so the stop is still the gentle one */
      var stepPx = (T.step.H2 || T.step.B) * sc, togo = gx == null ? 0 : Math.abs(gx - h.G.x);
      var tp = 1.2 + 1.2 * Math.max(0, Math.min(1, (togo - 2 * stepPx) / (3 * stepPx)));
      h.pace = (h.pace || 1.2) + (tp - (h.pace || 1.2)) * Math.min(1, dt * 3);
      if (!h.fade) h.u += dt * 12 * (1.67 / SWING.period) * h.pace;   // (stopping: held on the beside pose while she cross-fades into the dead hang)
      while (h.u >= 1) {
        h.u -= 1;
        var n = tzNext(h.i), fn = L[n], loop = tzSame(h.i);
        /* leaving the hold for the reach: only if the next hold is there and she still wants to go that way */
        if (h.stop && h.i === T.hoh.stop[f.seg]) { h.fade = { t: 0 }; h.u = 0; break; }   // the trailing hand is up beside the leading one: settle
        if (!hohSeg(f) && f.hang && !fn.hang && !loop && fn.seg === f.seg) {
          var nh = want === fig.dir && tzHold(h, T.after[f.seg]);
          if (!nh) { h.mode = 'idle'; h.th = fig.dir * f.th - h.r - (h.ri || 0); h.u = 0; h.ri = 0; h.mix = null; break; }   // (from where the swing has her, at the speed it has her: no hitch)
          h.next = nh;
        }
        if (fn.seg !== f.seg && !loop && h.next) {   // the catch: the reaching hand closes on the next letter
          h.G = { x: h.next.x, y: h.next.y }; h.hands = [h.G, h.G]; h.next = null; h.off = { x: 0, y: 0 };
          if (hohSeg(fn)) { var nx = want === fig.dir && tzHold(h, fn.seg); if (nx) h.next = nx; else if (past && past === fig.dir) { dismount(past); return; } else h.stop = true; }   // more to go: the trailing hand will swing past; else this was the last catch
        }
        h.i = n; f = fn;
        /* the next letter is never exactly a clip's step away: the difference is taken up in the air (neither hand on) */
        if (h.next && TZ_FLIGHT.indexOf(f.raw) >= 0) { var k = TZ_FLIGHT.indexOf(f.raw) % 2 + 1; h.off = { x: h.next.dx * k / 2, y: h.next.dy * k / 2 }; }
        if (f.hang && want !== fig.dir) { h.mode = 'idle'; h.th = fig.dir * f.th - h.r; h.u = 0; h.ri = 0; h.mix = null; break; }   // stopped (or turned): she swings on from here, with the swing's own speed
      }
      if (h.mode === 'go') {
        var fn2 = L[tzNext(h.i)], th1 = fig.dir * f.th, th2 = fig.dir * fn2.th;
        h.om = (th2 - th1) * 12 * (1.67 / SWING.period) * (h.pace || 1);   // the clip's swing speed, for when she stops and swings on by herself
        h.r *= Math.exp(-dt / .15);   // whatever lean the pendulum had going in eases out into the clip's own
      }
    }
    if (h.mode === 'idle') {
      /* HANGING: a pendulum. At rest her centre of mass is straight under her hand; she swings only with momentum */
      var th0 = h.th, c = want ? SWING.drive : h.settle ? SWING.rest * 5 : SWING.rest;   // told to stop: the swing dies down quickly, never a freeze
      for (var s3 = 0; s3 < 2; s3++) { h.om += (-w0 * w0 * Math.sin(h.th) - c * h.om) * dt / 2; h.th += h.om * dt / 2; }
      if (want && want !== fig.dir && Math.abs(h.th) < .08 && h.om * want > -.1 && Math.abs(L[h.i].th) < .25) fig.dir = want;   // (no turn frames, or no letter for hand 2: she turns as she passes under her hand)
      if (want && (th0 < 0) !== (h.th < 0) && h.om * want > 0 && Math.abs(h.om) / w0 < SWING.amp) h.om += want * Math.min(SWING.kick, (SWING.amp - Math.abs(h.om) / w0) * w0);   // the end of the line: she pumps the swing instead
      /* the frame from the same hold whose angle and direction of swing match hers */
      var best = h.i, bs = 1e9;
      for (var i = 0; i < L.length; i++) { var g = L[i];
        if (!g.hang || g.seg !== f.seg) continue;
        var gn = L[tzNext(i)], dirOk = (gn.th - g.th) * fig.dir * h.om >= 0 ? 0 : .08;
        var sc2 = Math.abs(fig.dir * g.th - h.th) + dirOk + Math.abs(i - h.i) * .012   // and near the frame she's in: never a jump to another pose at the same angle
          + Math.abs(g.oy + g.base - f.oy - f.base) * .0025;   // nor to legs at another height (stopping mid-reach popped her feet up 23px); light enough that she still settles into the upright pose (heavier, she stayed in a tilted one and never turned)
        if (sc2 < bs) { bs = sc2; best = i; } }
      if (best !== h.i) h.xf = { k: h.i, t: 0 };   // a change of pose while she swings: the last one fades out over 0.2s, never a pop
      h.i = best; f = L[h.i];
      h.r = fig.dir * f.th - h.th;   // turned so her centre of mass is exactly where the swing has it
      /* set off: a kick from where she hangs, then the clip carries her on */
      /* ALWAYS THE SMOOTH ONE (her 2026-11-23: "when I click up ... and then just move my cursor to the side ... She does the really choppy one. I want her to do the smooth one that ... happens when I ... drag"): following the cursor, the gap grows a little at a time, so it used to start with single reach-and-stop moves (the choppy one) and only went hand over hand once a drag put the goal >1.3 reaches away. Any travel is now the continuous hand-over-hand clip; it ends in its own gentle beside-pose stop */
      var far = T.hoh && gx != null && want !== 0;
      var onward = want === fig.dir && tzHold(h, far ? 'S' : T.after[f.seg]);   // only with a letter to reach for: at the end of the line she just swings (it used to flick go/idle every frame and freeze her)
      if (!onward && past && past === fig.dir) { dismount(past); return; }   // …unless she's dragged past it: off she flips (barPast)
      if (onward && Math.abs(h.th - fig.dir * f.th) < .12) { h.mode = 'go'; h.u = 0; h.stop = false; h.fade = null;
        if (far) { h.xf = { k: h.i, t: 0 }; h.i = T.hoh.first.S; f = L[h.i]; h.r = fig.dir * f.th - h.th; h.next = onward; } }   // from her dead hang into the clip's own (cross-faded)
      else if (onward && Math.abs(h.th) < .03 && Math.abs(h.om) < .15) h.om += want * SWING.kick;
      if (h.auto && h.t > .5 && (Math.abs(h.th) < .12 && Math.abs(h.om) < .8 || h.t > 1.6)) {   // her route climbs on through this line
        var tg0 = fig.target, wp0 = fig.waypoint; h.auto = null;
        if (muscleUp()) return;   // she stands on it (fig.muStand); her route used to carry on into the next bar
        if (touchMode) { release(0); return; }   // phone (her 2026-11-24): no way up over these letters, so she drops and stands below, never left hanging
      }
    }
    f = L[h.i];
    /* SMOOTH, NOT STEPPED (her 2026-11-23: "She almost doesn't like swing smoothly"): the clip is ~16 poses a second, so between
       two poses of the same hold her body is turned about the fist along the swing's line from one to the next (it used to sit
       still for 4 screen frames, then jump up to 12px), the next pose fades in over the second half (drawn 'lighter', a true
       cross-fade), and the in-air drift to the next letter is eased the same way */
    h.ri = 0; h.mix = null;
    if (h.mode === 'go' && h.fade) {   // STOPPING: the beside pose cross-fades into the dead hang, both hands together, then she just hangs and swings
      h.fade.t += dt; var fa = Math.min(1, h.fade.t / .45); fa = fa * fa * (3 - 2 * fa);
      if (h.fade.t >= .45) { h.i = T.hoh.rest; f = L[h.i]; h.mode = 'idle'; h.r = fig.dir * f.th - h.th; h.fade = null; h.stop = false; h.xf = null; }
      else h.mix = { k: T.hoh.rest, a: fa, rot: fig.dir * L[T.hoh.rest].th - h.th };
    } else if (h.mode === 'go' && h.xf) { h.xf.t += dt; var xg = 1 - h.xf.t / .25; if (xg <= 0) h.xf = null; else h.mix = { k: h.xf.k, a: xg * xg * (3 - 2 * xg), rot: fig.dir * L[h.xf.k].th - h.th }; }
    else if (h.mode === 'go') {
      var nI = tzNext(h.i), fN = L[nI];
      if (fN.seg === f.seg || tzSame(h.i)) {
        var e = Math.min(1, h.u), dth = fN.th - f.th, ofs = function (q) { return ofs2(h, q); };
        h.ri = -fig.dir * e * dth;
        if (h.next) { var o0 = ofs(h.i), o1 = ofs(nI), ok = o0 + (o1 - o0) * e; h.off = { x: h.next.dx * ok, y: h.next.dy * ok }; }
        var a = Math.max(0, Math.min(1, (e - .5) / .5)); a = a * a * (3 - 2 * a);
        if (a > .01) h.mix = { k: nI, a: a, rot: h.r + fig.dir * (1 - e) * dth };
      } else if (h.next) {
        /* THE CATCH, eased too: in the air her drawing drifts from where this pose has her centre of mass to where the catching
           pose (pinned at the next letter) has it, so the hand-off is a glide, not the 13px jump it was */
        var e2 = Math.min(1, h.u), o2 = ofs2(h, h.i), A0 = { x: h.G.x + h.next.dx * o2, y: h.G.y + h.next.dy * o2 }, c0 = Math.cos(h.r), s0 = Math.sin(h.r), dd = fig.dir;
        var P0 = { x: A0.x + dd * f.mx * sc * c0 - f.my * sc * s0, y: A0.y + dd * f.mx * sc * s0 + f.my * sc * c0 };
        var P1 = { x: h.next.x + dd * fN.mx * sc * c0 - fN.my * sc * s0, y: h.next.y + dd * fN.mx * sc * s0 + fN.my * sc * c0 };
        var dP = { x: P1.x - P0.x, y: P1.y - P0.y };
        h.off = { x: A0.x - h.G.x + e2 * dP.x, y: A0.y - h.G.y + e2 * dP.y };
        var a2 = Math.max(0, Math.min(1, (e2 - .5) / .5)); a2 = a2 * a2 * (3 - 2 * a2);
        if (a2 > .01) h.mix = { k: nI, a: a2, rot: h.r, tx: h.next.x - A0.x - dP.x, ty: h.next.y - A0.y - dP.y };
      }
    }
    if (h.mode === 'idle' && h.xf) { h.xf.t += dt; var xa = 1 - h.xf.t / .2; if (xa <= 0) h.xf = null; else h.mix = { k: h.xf.k, a: xa * xa * (3 - 2 * xa), rot: fig.dir * L[h.xf.k].th - h.th }; }
    else h.xf = null;
    var rr = h.r + h.ri;
    var d = fig.dir, cr = Math.cos(rr), sr = Math.sin(rr), ax = h.G.x + h.off.x, ay = h.G.y + h.off.y;
    var mx = d * f.mx * sc, my = f.my * sc, fy = (f.oy + f.base) * sc;
    h.P = { x: ax + mx * cr - my * sr, y: ay + mx * sr + my * cr };
    h.th = h.mode === 'go' ? Math.atan2(h.P.x - ax, h.P.y - ay) : h.th;
    fig.x = h.hx = h.P.x;
    fig.y = ay + mx * sr + fy * cr;   // her feet
  }

  /* HER ENTRANCE (her 2026-11-25: "I don't like the way that the avatar just kind of like spawns on top of the Madhu ... she should
     jump in from the left side" · "she somersaults over product design engineer. So she jumps onto product design engineer, and in one
     smooth motion, with the momentum of her jump, does she somersault, pop up, and jump onto the DH in Madhu"): one continuous move,
     the moment she would have appeared on the d (the headline has landed: her 2026-10-27 rule). From off the left edge she leaps onto
     the eyebrow, lands in a squat, rolls forward along it (her tuck from the backflip turned about its own middle, its lowest pixel
     always ON the eyebrow's cap line, and moving as far as it turns: rolling, never sliding), pops up through her crouch and jumps onto
     the d where she has always stood, then waves. Once a visit; Reduce Motion, a missing eyebrow or frames that are slow to come
     (3.5s) mean she simply stands on the d as before; a press or key mid-way hands her straight to it (endEnter). */
  var ENTER_KEY = 'mk-entered', ROLL_T = .55, ROLL_AIR = Math.PI / 2;   // s for a whole turn; how far she has already turned when her back meets the line (a dive roll: the rest is on the line, and fits a phone's eyebrow)
  function enterFrames() { var m = CLAY.man; return m['jump-land-slide-x3'].concat([m['backflip-x3'][9]], (m['idle-wave-sign-x3'] || []).slice(3, 6)); }
  function startEnter() {
    var seen = true; try { seen = !!sessionStorage.getItem(ENTER_KEY); sessionStorage.setItem(ENTER_KEY, '1'); } catch (e) {}
    return;   // her 2026-11-25 "No no. Just have her spawn": no entrance, she appears on the d as before (code below kept, unreached)
    if (seen || rmActive() || !CLAY.on || !hero.querySelector('.eyebrow') || fig.state !== 'idle') return;
    fig.enter = { ph: 'wait', t: 0, D: { x: fig.x, y: fig.y } };
    fig.state = 'enter'; fig.x = -400; fig.dir = 1;
  }
  /* the eyebrow writes itself in word by word (app.js .reveal-words): she lands only once its words are at rest and her map has been
     read since (a map read mid-reveal had the line ~8px low, and she rolled through the letters) */
  function ledgeStill() {
    var ws = hero.querySelectorAll('.eyebrow .w');
    for (var i = 0; i < ws.length; i++) { var cs = getComputedStyle(ws[i]);
      if (+cs.opacity < .99 || (cs.transform !== 'none' && cs.transform !== 'matrix(1, 0, 0, 1, 0, 0)') || parseFloat((/blur\(([\d.]+)/.exec(cs.filter) || [0, 0])[1]) > .6) return false; }   // (at rest its filter reads blur(0px))
    return true;
  }
  function enterLedge(E) {
    var eb = hero.querySelector('.eyebrow'), r = localRect(eb, cv.getBoundingClientRect()), ys = [], x1 = null, x2 = null;   // (the <p> runs the hero's width: the WORDS are the ledge)
    for (var x = r.x1 + 1; x < r.x2 - 1; x += 2) { var t = groundTop(x, r.y1 - 12, r.h + 16); if (t != null) { ys.push(t); if (x1 == null) x1 = x; x2 = x; } }
    if (ys.length < 8) return false;
    ys.sort(function (a, b) { return a - b; });
    E.ex1 = x1; E.ex2 = x2; E.Ey = ys[Math.floor(ys.length * .1)];   // the cap line: the caps' common top (the median sat on the rounder letters, ~3px into the caps)
    return true;
  }
  function endEnter() {   // a press or key mid-entrance: from wherever she is, with the speed she has
    var E = fig.enter; fig.enter = null; if (!E) return;
    if (E.ph === 'wait' || E.ph === 'land2' || fig.x < 0) { fig.x = E.D.x; fig.y = E.D.y; fig.state = 'idle'; fig.vx = fig.vy = 0; draw(performance.now()); return; }
    fig.state = 'air'; fig.vx = E.vx || 0; fig.vy = E.ph === 'jump' || E.ph === 'fly' ? E.vy : -150; fig.fallFrom = fig.y; fig.flipQueued = true; fig.hangCool = .4;
  }
  /* her tuck (backflip frame 9, turned upside down it is a squat ball) read off its own pixels: its middle, and every 2nd pixel
     around it, so the lowest point at any turn is known exactly (the roll's contact with the line) */
  var TUCK = null;
  function tuck() {
    if (TUCK) return TUCK;
    var f = CLAY.man['backflip-x3'][9], im = CLAY.img[f.f], c = document.createElement('canvas'), x = c.getContext('2d');
    c.width = im.naturalWidth; c.height = im.naturalHeight; x.drawImage(im, 0, 0);
    var a = x.getImageData(0, 0, c.width, c.height).data, P = [], sx = 0, sy = 0, k = f.w / c.width;   // (frame px, whatever size the file came in)
    for (var y = 0; y < c.height; y += 2) for (var i = 0; i < c.width; i += 2) if (a[(y * c.width + i) * 4 + 3] > 128) { P.push(i * k, y * k); sx += i * k; sy += y * k; }
    var n = P.length / 2, gx = sx / n, gy = sy / n;
    for (var j = 0; j < P.length; j += 2) { P[j] -= gx; P[j + 1] -= gy; }
    TUCK = { f: f, gx: gx, gy: gy, P: P };
    var s = 0; for (var q = 0; q < 24; q++) s += tuckLow(q / 24 * 2 * Math.PI, 1); TUCK.r = s / 24;
    return TUCK;
  }
  function tuckLow(rot, d) {   // how far below its middle her tuck reaches, turned by rot (canvas px)
    var T = TUCK, sc = CLAY.H / CLAY.man._ref, sn = Math.sin(rot), cs = Math.cos(rot), lo = -1e9;
    for (var j = 0; j < T.P.length; j += 2) { var v = sn * T.P[j] * d * sc + cs * T.P[j + 1] * sc; if (v > lo) lo = v; }
    return lo;
  }
  function enterPlan(E) {
    var Tk = tuck(), H0 = CLAY.H, r = Tk.r, v = 2 * Math.PI * r / ROLL_T, len = E.ex2 - E.ex1;
    E.v = v; E.xL = E.ex1 + Math.max(.3 * r, (len - (2 * Math.PI - ROLL_AIR) * r) * .4);   // room for the rest of the roll after she touches down
    /* the leap: its top under half her height over the line (higher, her head met the nav); from off the left edge, rising from lower down when it has further to come, so
       she arrives at about the roll's speed (the momentum carries on into it) */
    var h = .4 * H0, tf = Math.sqrt(2 * h / G), Ts = 2 * tf, x0 = Math.min(-.6 * H0, E.xL - 1.2 * v * Ts), TA = Math.max(Ts, (E.xL - x0) / (1.3 * v)), ta = TA - tf;
    E.fly = { x0: x0, y0: E.Ey - h + G * ta * ta / 2, vx: (E.xL - x0) / TA, vy: -G * ta, T: TA, TU: ROLL_AIR * r / v };   // TU: the tuck turns in the air at the roll's own rate
  }
  function tickEnter(dt) {
    var E = fig.enter; E.t += dt;
    if (E.ph === 'wait') {
      if (E.t > 5) { endEnter(); return; }   // frames (or the eyebrow) too slow: she is just there, as before
      if (!CLAY.ready || !CLAY.man || !CLAY.need) return;
      if (!E.asked) { E.asked = true; CLAY.need(enterFrames(), function () { E.ready = true; }); }
      if (!E.ready) return;
      if (!ledgeStill()) { E.still = null; return; }
      if (E.still == null) E.still = { n: rebuilt, t: E.t };
      if (rebuilt === E.still.n) { if (E.t - E.still.t < .35) return; rebuild(); }   // (the words' transitionend asks for one within ~0.2s)
      try { if (!enterLedge(E)) { endEnter(); return; } enterPlan(E); } catch (e) { endEnter(); return; }
      E.ph = 'fly'; E.t = 0;
    }
    var F = E.fly;
    if (E.ph === 'fly') {
      var t = Math.min(E.t, F.T);
      fig.x = F.x0 + F.vx * t; fig.y = F.y0 + F.vy * t + G * t * t / 2; E.vx = F.vx; E.vy = F.vy + G * t;
      E.th = null;   // her 2026-11-25 "Remove the tumbling": no tuck or roll; she lands on her feet (the roll code below stays, unreached)
      if (E.t >= F.T) { fig.x = E.xL; fig.y = E.Ey; E.ph = 'pop'; E.t = 0; touchdown(E.vy); }
      return;
    }
    if (E.ph === 'roll') {
      var w = E.v / TUCK.r, th1 = Math.min(2 * Math.PI, E.th + w * dt);
      fig.x += tuckLow(Math.PI + E.th, 1) * (th1 - E.th); E.th = th1;   // rolling: as far along as the contact point turns
      if (E.th >= 2 * Math.PI) { E.ph = 'pop'; E.t = 0; }
      return;
    }
    if (E.ph === 'pop') {   // up through her crouch onto her toes, and off
      fig.x += E.v * .3 * dt;
      if (E.t < .15) return;   // a beat in the landing crouch, then off
      var apex = Math.min(E.Ey, E.D.y) - .5 * CLAY.H, vy = -Math.sqrt(2 * G * (E.Ey - apex)), T = -vy / G + Math.sqrt(2 * (E.D.y - apex) / G);
      E.jump = { x0: fig.x, vx: (E.D.x - fig.x) / T, vy: vy, T: T }; E.ph = 'jump'; E.t = 0; fig.dir = E.D.x >= fig.x ? 1 : -1;
    }
    if (E.ph === 'jump') {
      var J = E.jump, u = Math.min(E.t, J.T);
      fig.x = J.x0 + J.vx * u; fig.y = E.Ey + J.vy * u + G * u * u / 2; E.vx = J.vx; E.vy = J.vy + G * u;
      if (E.t >= J.T) { fig.x = E.D.x; fig.y = E.D.y; E.ph = 'land2'; E.t = 0; touchdown(E.vy); puff(fig.x, fig.y, 3); }
      return;
    }
    if (E.ph === 'land2' && E.t >= .3) { fig.enter = null; fig.state = 'wave'; fig.prev = 'idle'; fig.wave = 0; waveAt = performance.now(); }
  }
  function enterPick() {
    var E = fig.enter, none = { s: '_', k: 0 };
    if (!E || E.ph === 'wait') return none;
    if (E.ph === 'fly' && E.th != null) {   // tucked and turning; her middle eases from where the jump frame had it down to the ball's own
      var T0 = tuck(), ro = Math.PI + E.th, u = E.th / ROLL_AIR;
      return { s: 'backflip-x3', k: 9, anchor: 'hands', ax: fig.x, ay: fig.y - (CLAY.H * .5 * (1 - u) + tuckLow(ro, 1) * u), gx: T0.gx, gy: T0.gy, rot: ro };
    }
    if (E.ph === 'fly' || E.ph === 'jump') {   // the jump's own frames by her speed, pinned by her middle, the feet slid onto the landing (as in 'air')
      var vy = E.vy, gy = E.ph === 'fly' ? E.Ey : E.D.y, win = Math.max(60, vy * .1);
      return { s: 'jump-land-slide-x3', k: vy < -500 ? 4 : vy < -300 ? 5 : vy < -90 ? 6 : vy < 120 ? 7 : vy < 300 ? 8 : 9, mid: true, feet: vy > 0 ? Math.max(0, Math.min(1, 1 - (gy - fig.y) / win)) : 0 };
    }
    if (E.ph === 'pop') return { s: 'jump-land-slide-x3', k: 3 };
    if (E.ph === 'land2') return { s: 'jump-land-slide-x3', k: [11, 12, 13, 14, 22][Math.min(4, Math.floor(E.t / .3 * 5))] };
    var rot = Math.PI + E.th, T = tuck();
    return { s: 'backflip-x3', k: 9, anchor: 'hands', ax: fig.x, ay: E.Ey - tuckLow(rot, 1), gx: T.gx, gy: T.gy, rot: rot };
  }
  function tickMantle(dt) {
    var m = fig.mantle;
    m.t += dt / (m.dur || 0.3);
    if (m.t >= 1) {
      fig.x = m.x1; fig.y = m.y1;
      fig.state = (fig.target || fig.drag) ? 'move' : 'idle';
      fig.mantle = null;
      return;
    }
    var e = m.t * m.t * (3 - 2 * m.t);
    if (m.up) {
      /* the muscle-up: first the pull, drawn from her hands on the letters (clayPick), her feet where that frame puts them;
         then the press and step up, drawn from her feet, which carry on from exactly there up onto the line (it used to
         start them half a body higher: she popped up ~60px at the hand-over) */
      var fy = muFeet(m);
      if (m.t < MU_PULL) { fig.x = m.x1; fig.y = fy; return; }
      if (m.ya == null) m.ya = fy;
      var u = (m.t - MU_PULL) / (1 - MU_PULL), eu = u * u * (3 - 2 * u);
      fig.x = m.x1; fig.y = m.ya + (m.y1 - m.ya) * eu;
      return;
    }
    fig.x = m.x0 + (m.x1 - m.x0) * e;
    fig.y = m.y0 + (m.y1 - m.y0) * e - Math.sin(m.t * Math.PI) * 14;
  }
  var MU_PULL = .5, MU_REACH = .2, CLIMB_FIST = { 7: 53.5, 9: 47.5, 10: 33, 11: 32.5, 12: 34, 13: 33.5, 14: 35.5 };   // the climb frames' fists (x, their own px): pinned there, on the edge   // of the climb: the one-hand reach up to the top edge, then both hands there and the pull
  /* one arm up (climb 7) while that hand travels up to the top edge; then both hands on it (climb 9..14) as she pulls */
  function muFrame(m) { return m.t < MU_REACH ? 7 : 9 + Math.min(5, Math.floor((m.t - MU_REACH) / (MU_PULL - MU_REACH) * 6)); }
  function muHandX(m) { var u = Math.min(1, m.t / MU_REACH); return m.hx0 == null ? m.x1 : m.hx0 + (m.x1 - m.hx0) * u * u * (3 - 2 * u); }
  function muHand(m) { var u = Math.min(1, m.t / MU_REACH), e = u * u * (3 - 2 * u); return m.hy0 + (m.y1 - m.hy0) * e + (m.d0 || 0) * (1 - e); }   // her reaching hand: from the underside up to the word's top, then there
  /* where the pull frame drawn from her hands puts her feet */
  function muFeet(m) {
    var L = CLAY.man && CLAY.man['climb-x3'], f = L && L[muFrame(m)];
    return muHand(m) + ((f ? f.base : 256) - HANGF[0].gy) * (CLAY.ready ? CLAY.H : 113) / (CLAY.man ? CLAY.man._ref : 252);
  }

  function puff(x, y, n) {
    for (var i = 0; i < n; i++) puffs.push({ x: x + (Math.sin(i * 2.4) * 8), y: y - 2, vx: (i % 2 ? 1 : -1) * (24 + i * 9), vy: -18 - i * 6, t: 0.34 });
  }

  /* ------------------------------------------------------------------ the rAF driver */
  var raf = 0, last = 0;
  var rideT = 0;   // seconds of rAF kept alive so a CSS-only glyph wave still animates him
  function needsLoop() {
    return fig.state !== 'idle' && fig.state !== 'sign' || fig.target || fig.drag || puffs.length || fig.landT > 0 || fig.loadT > 0 || fig.slideT > 0 || rideT > 0 || rideBusy;
  }
  /* the moment she is STANDING on the cloud — however she got there: its click-jump, a hop, a climb up its edge, a walk
     across — the cloud hears the slam (her: "nothing happens when I jump on the cloud") */
  function cloudCheck() {
    var jbEl = hero.querySelector('.jump-box:not(.gone)'), on = false;
    if (jbEl && (fig.state === 'idle' || fig.state === 'move')) {
      var jr = localRect(jbEl, cv.getBoundingClientRect());
      on = fig.x >= jr.x1 + 4 && fig.x <= jr.x2 - 4 && Math.abs(fig.y - (jr.y1 + jr.h * .12)) < 6;
    }
    if (on && !fig.onCloud) { if (!fig.landT) { brace(0.32); puff(fig.x, fig.y, 7); } dispatchEvent(new CustomEvent('mk-box-slam')); }
    fig.onCloud = on;
  }
  /* her sounds (Flora / ElevenLabs SFX, 2026-10-24, beside the cloud's squish/pop/clonk): a push-off WHOOSH whenever she
     launches upward, two soft steps when she lands, a GRIP when her hands catch a bar — only on a change of motion, no
     footstep-per-stride while walking or running. Tried and cut, her calls: sneaker squeaks, a boing jump
     ("makes me think something is bouncing"), a creaky-bar grab. Browsers keep them silent until the visitor's first click. */
  var SFX = (function () {
    var base = (document.querySelector('script[src*="stick.js"]') || {}).src || '';
    var dir = base.replace(/stick\.js.*$/, '') + 'assets/sfx/', ver = (base.match(/\?v=[^&#]*/) || [''])[0], s = { ctx: null, buf: {} };
    /* Web Audio, decoded once (her 2026-10-24: "the person sounds are delayed"): a cloned <audio> per play started
       late, worst on iPhones, so the step landed after the foot did. A buffer source starts on the frame. */
    /* the context is made on the visitor's first touch, click or key, not at load: iOS Safari can give a context made
       before then the wrong sample rate (44.1k files on 48k hardware) and every sound comes out warped (her: "the
       jumping up sound sounds super weird now"). The files download at load; they decode once the context exists. */
    var AC = window.AudioContext || window.webkitAudioContext, raw = {};
    if (!AC) return s;
    ['step', 'jump-springy'].forEach(function (n) {   // land.mp3 is retired: landings are two soft steps. HER PICKS 2026-11-23 ("FJ2 · Springy jump, G4 · Squeeze ship these"): jump = jump-springy.mp3 (Flora/ElevenLabs FJ2, played as recorded); grab = the browser-made squeeze below; landing = the two muffled steps (B)
      fetch(dir + n + '.mp3' + ver).then(function (r) { return r.arrayBuffer(); }).then(function (ab) { raw[n] = ab; decode(); }).catch(function () {});
    });
    function decode() {
      if (s.ctx) Object.keys(raw).forEach(function (n) { var ab = raw[n]; delete raw[n]; s.ctx.decodeAudioData(ab, function (d) { s.buf[n] = d; }, function () {}); });
    }
    var wake = function () {
      if (!s.ctx) { try { s.ctx = new AC(); } catch (e) { return; } decode(); }
      if (s.ctx.state !== 'running') s.ctx.resume();
    };
    /* a finger wakes it on a TAP only (her 2026-11-04: "i try to scroll and it keeps stopping and starting"): on iOS the
       context is first made here, and making it on the touch that STARTS a scroll froze that scroll for most of a second */
    var t0 = null, opt = { passive: true, capture: true };
    addEventListener('pointerdown', function (e) { if (e.pointerType !== 'touch') wake(); }, opt);
    addEventListener('touchstart', function (e) { var t = e.touches[0]; t0 = t && e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null; }, opt);
    addEventListener('touchend', function (e) { var t = e.changedTouches[0]; if (t0 && t && Math.hypot(t.clientX - t0.x, t.clientY - t0.y) < 10) wake(); t0 = null; }, opt);
    addEventListener('keydown', wake, opt);
    /* …except where that iOS bug can't happen: making a context is slow (most of a second on a throttled phone, and it
       was made by the same tap that sends her walking, so she froze as she set off — her 2026-10-28 "super choppy").
       Everywhere but iOS it is made while the page is idle (after the loader has lifted and she has landed, never during
       either), silent until the first touch resumes it */
    var iOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
    if (!iOS) Promise.resolve(window.__mkBoot).then(function () {
      setTimeout(function () {
        var make = function () {
          if (s.ctx) return;
          if (fig.target || fig.state !== 'idle') return setTimeout(make, 1000);   // never while she's on the move
          try { s.ctx = new AC(); } catch (e) { return; } decode(); };
        if (window.requestIdleCallback) requestIdleCallback(make, { timeout: 4000 }); else make();
      }, 3500);
    });
    return s;
  })();
  function sfx(n, vol, rate) {
    var c = SFX.ctx, d = SFX.buf[n];
    if (!c || !d || c.state !== 'running' || rmActive() || document.documentElement.dataset.mute === 'on') return;   // the site's mute button
    var src = c.createBufferSource(), g = c.createGain(), t = c.currentTime, len = CLIP[n], tone = TONE[n];
    src.buffer = d; src.playbackRate.value = (rate || 1) * PITCH; g.gain.value = vol;
    if (tone) {   // the low-pass takes the edge off, the high-pass drops lows a speaker can't play, the fade-in rounds off the attack
      if (tone.gain) { vol *= tone.gain; g.gain.value = vol; }
      var node = src;
      ['lp', 'hp'].forEach(function (k) { if (!tone[k]) return; var f = c.createBiquadFilter(); f.type = k === 'lp' ? 'lowpass' : 'highpass'; f.frequency.value = tone[k]; f.Q.value = 0.5; node.connect(f); node = f; });
      if (tone.attack) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + tone.attack); }
      node.connect(g);
    } else src.connect(g);
    g.connect(muffle(c));   // every sound through the pillow (her: muffled, "not like beans in a rain stick")
    if (len) { g.gain.setValueAtTime(vol, t + len - 0.06); g.gain.linearRampToValueAtTime(0, t + len); src.start(t, 0, len); }
    else src.start();
  }
  /* A PILLOW OVER THE MIC (her 2026-11-22: "a more muffle sound for the movements of the avatar? like a pillow is over the mic" →
     "you never fixed the sounds … I want it to sound muffled. not like beans in a rain stick"): every one of her sounds ends in this ONE
     bus, the same on phone and laptop. Two gentle low-passes (a soft, steep roll-off of the hiss and grain, no ringing) and a little warm
     body under 250Hz; gain keeps each as loud as before (measured in the preview build: step .0056→.0071, grip .018→.022 RMS) */
  var MUFFLE = { lp: 750, body: 3, gain: 0.9 };
  function muffle(c) {
    if (c.__muffle) return c.__muffle;
    var a = c.createBiquadFilter(), b = c.createBiquadFilter(), w = c.createBiquadFilter(), g = c.createGain();
    a.type = b.type = 'lowpass'; a.frequency.value = b.frequency.value = MUFFLE.lp; a.Q.value = b.Q.value = 0.6;
    w.type = 'lowshelf'; w.frequency.value = 250; w.gain.value = MUFFLE.body;
    g.gain.value = MUFFLE.gain;
    a.connect(b); b.connect(w); w.connect(g); g.connect(c.destination);
    return (c.__muffle = a);
  }
  /* jump.mp3 is a whoosh that builds for 0.3s and THEN a thump at 0.34s, its loudest moment; that thump landed while
     she was still in the air (her: "the jumping up sound sounds super weird"). Only the whoosh plays, faded out. */
  var CLIP = { jump: 0.3 };
  /* her 2026-10-24: "the landing sound is too harsh and the jumping up sound is too sharp". The whoosh's energy sits
     around 2.2kHz (a hiss) and the thud opens on a click, so both are low-passed and given a soft attack */
  var TONE = { jump: { lp: 800, attack: 0.06 } };
  /* PHONES get their own tuning (her 2026-10-24: 'the jumping sounds on the phone don't sound as good as the laptop'): phone
     speakers can't play below ~300Hz, so the low-passed whoosh came out as a faint muddy puff. On a touch device every sound
     loses the lows it can't play (high-pass, so nothing distorts) and the jump keeps more of its middle, a touch louder. */
  var PHONE = matchMedia('(pointer: coarse)').matches;
  /* her 2026-10-29: "Her movement sounds on the phone are too airy and too high pitched". The 2200Hz low-pass let the whoosh's
     hiss through and the 320/220Hz high-passes left only the thin top: now the hiss is cut as on the laptop, only the true
     rumble below ~150Hz goes, and every phone sound plays a little slower (PITCH), so lower */
  if (PHONE) TONE = { jump: { lp: 900, hp: 150, attack: 0.06, gain: 1.5 }, step: { lp: 2400, hp: 120, gain: 1.2 }, grip: { lp: 2400, hp: 120 } };
  var PITCH = PHONE ? 0.88 : 1;
  var sfxWas = null, fallV = 0, leapt = false;
  function whoosh(v) { springJump(v); }
  /* FJ2 "Springy jump" exactly as she heard it on the sounds page: the recording, levelled to the same peak (.55), no pillow */
  var SPRING_PEAK = null;
  function springJump(v, mode) {   // mode: 'rise' = the boing only, 'fall' = the shh only, none = both (celebrations, the muscle-up)
    var c = SFX.ctx, d = SFX.buf['jump-springy'];
    if (!c || !d || c.state !== 'running' || rmActive() || document.documentElement.dataset.mute === 'on') return;   // the site's mute button
    if (SPRING_PEAK == null) { var pk = 0; for (var ch = 0; ch < d.numberOfChannels; ch++) { var a = d.getChannelData(ch); for (var i = 0; i < a.length; i++) { var v = Math.abs(a[i]); if (v > pk) pk = v; } } SPRING_PEAK = pk || 1; }
    /* TWO HALVES (her 2026-11-23, again: "super shrill ... way quieter and ... deeper ... not the second part, just the first part"):
       the recording is a boing (0–0.2s, its loud peak) then a soft shh (0.2s on). The boing alone gets ~-10dB, ~4 more semitones
       down and a dark 1.4kHz low-pass; the shh plays straight after it exactly as before (0.84 rate, 3.2kHz, 0.6) */
    var SPLIT = 0.2, t = c.currentTime + 0.005;
    function part(rate, cut, vol, from, len, at) {
      var src = c.createBufferSource(), g = c.createGain(), lp = c.createBiquadFilter(); src.buffer = d;
      src.playbackRate.value = PITCH * rate; lp.type = 'lowpass'; lp.frequency.value = cut; lp.Q.value = 0.5;
      g.gain.value = vol / SPRING_PEAK; src.connect(lp); lp.connect(g); g.connect(c.destination);
      if (len) src.start(at, from, len); else src.start(at, from);
      return len ? len / (PITCH * rate) : 0;   // how long it lasts in real time
    }
    var k = v == null ? 1 : force(v);   // a harder push-off is a louder spring (FORCE below)
    /* FALLS ARE ONLY THE SHH (her 2026-11-23: "I don't want the beginning half of the jump sound ... it's really just mainly
       falling ... I only want the falling sound, which is the second half"): a drop plays the shh alone, at its own force */
    if (mode === 'fall') { part(0.84, 3200, 0.6 * k, SPLIT, 0, t); return; }
    /* THE DROP (her 2026-11-23: "when she jumps down from really far, there needs to be like a dropping sound ... the opposite sound"):
       the same boing played BACKWARDS, so its rising notes fall, at the same deep, quiet setting; its envelope is re-shaped (quick
       attack, natural decay) so it doesn't swell; then the shh, exactly as a jump's boing is followed by its shh */
    if (mode === 'drop') {
      if (!springJump.rev) { var n0 = Math.round(SPLIT * d.sampleRate), rb = c.createBuffer(d.numberOfChannels, n0, d.sampleRate);
        for (var ch2 = 0; ch2 < d.numberOfChannels; ch2++) { var src0 = d.getChannelData(ch2), dst = rb.getChannelData(ch2); for (var j = 0; j < n0; j++) dst[j] = src0[n0 - 1 - j]; }
        springJump.rev = rb; }
      var rs = c.createBufferSource(), rg = c.createGain(), rl = c.createBiquadFilter(), rate = PITCH * 0.66, len = SPLIT / rate;
      rs.buffer = springJump.rev; rs.playbackRate.value = rate; rl.type = 'lowpass'; rl.frequency.value = 1400; rl.Q.value = 0.5;
      var pk = 0.19 * k / SPRING_PEAK * 2.2;   // (the reversed tail is quieter than the original's peak: lifted to sit at the boing's level)
      rg.gain.setValueAtTime(0, t); rg.gain.linearRampToValueAtTime(pk, t + 0.012); rg.gain.exponentialRampToValueAtTime(pk * 0.25, t + len);
      rs.connect(rl); rl.connect(rg); rg.connect(c.destination); rs.start(t, 0, SPLIT);
      part(0.84, 3200, 0.6 * k, SPLIT, 0, t + len * 0.8);
      return;
    }
    if (mode === 'rise') { part(0.66, 1400, 0.19 * k, 0, SPLIT, t); return; }
    var boing = part(0.66, 1400, 0.19 * k, 0, SPLIT, t);
    part(0.84, 3200, 0.6 * k, SPLIT, 0, t + boing);
  }
  /* G4 "Squeeze": made in the browser, a gentle squeeze as her fingers close, through the same pillow as her landing */
  var SQ_NOISE = null;
  function squeeze(v) {
    var kq = v == null ? 1 : Math.max(0.5, force(v));   // her hands take the speed she arrives with; a soft catch still makes a sound
    var c = SFX.ctx; if (!c || c.state !== 'running' || rmActive() || document.documentElement.dataset.mute === 'on') return;   // the site's mute button
    if (!SQ_NOISE) { var n = c.sampleRate, b = c.createBuffer(1, n, c.sampleRate), dd = b.getChannelData(0), last = 0; for (var i = 0; i < n; i++) { var w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; dd[i] = last * 3.5 + w * 0.15; } SQ_NOISE = b; }
    var t = c.currentTime + 0.01, bus = muffle(c);
    var env = function (g, a, peak, dur) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); };
    var o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(320 * PITCH, t); o.frequency.exponentialRampToValueAtTime(260 * PITCH, t + 0.1);
    env(og, 0.01, 0.35 * kq, 0.1); o.connect(og); og.connect(bus); o.start(t); o.stop(t + 0.15);
    var s2 = c.createBufferSource(), f = c.createBiquadFilter(), ng = c.createGain(); s2.buffer = SQ_NOISE; f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(400, t + 0.09); env(ng, 0.01, 0.45 * kq, 0.09);
    s2.connect(f); f.connect(ng); ng.connect(bus); s2.start(t, Math.random() * 0.5, 0.14);
  }
  /* FORCE (her 2026-11-23: "the amplitude of the sound is based off of the amount of force exerted ... mathematically scaled
     based off of the height and the force of the action"): every take-off, catch and landing is played at a gain proportional
     to the speed of the impact, the same law for all of them. Impact speed comes from physics, not guesses: a fall of height h
     lands at v = √(2gh) (G, her gravity); an arc drawn in a celebration lands at its own slope (see arc()). The reference is
     her standard hop (JUMP_MAX × .6 + 20 px, the JUMP! box): that speed plays at gain 1, the level she approved, so a step off a
     ledge is a pat, a long drop a thud, and the gain is clamped to [.25, 1.8] so nothing vanishes or clips. */
  var V_REF = Math.sqrt(2 * G * (JUMP_MAX * .6 + 20));
  function force(v) { return Math.max(0.25, Math.min(1.8, Math.abs(v || 0) / V_REF)); }
  function fallSpeed(h) { return Math.sqrt(2 * G * Math.max(0, h)); }
  var herH = function () { return CLAY.ready ? CLAY.H : 120; };
  /* ONE BOOM WHEN BOTH FEET LAND TOGETHER (her 2026-11-24: "whenever I'm landing with 2 feet at the same time, it's one boom. But if I'm doing one of my feet at a time, then it's boom boom ... it literally is just supposed to be about when my feet are touching the floor"): jumps, flips and the star land on both feet at once = one sound; staggered feet (the cartwheel) use foot() per foot in CUES */
  function touchdown(v) { var k = force(v == null ? V_REF : v); sfx('step', 0.5 * k, 1.08); }
  function foot(liftH) { return function () { sfx('step', 0.42 * force(fallSpeed(liftH * herH())), 1.08); }; }   // ONE foot, on the frame it meets the floor, from the height it swung down
  /* a celebration's flight is a true gravity arc: lift = 4·P·u(1−u) over u = (ct − a)/(b − a), off the floor exactly from the
     take-off frame a to the landing frame b. Its take-off and landing speed is the arc's slope at either end, 4·P·H / T,
     T = (b − a) × the move's duration in seconds. */
  var ARC = { backflip: { a: 4 / 18, b: 14 / 18, P: .5 }, star: { a: .22, b: .78, P: .32 } };
  function arcLift(name, ct) { var A = ARC[name], u = (ct - A.a) / (A.b - A.a); return u > 0 && u < 1 ? 4 * A.P * u * (1 - u) : 0; }
  function arcV(name) { var A = ARC[name], c = fig.celeb; return 4 * A.P * herH() / ((A.b - A.a) * (c ? c.dur : 1)); }
  /* the moves a click on her plays leave the ground too, on their own clock, never through 'air' (her 2026-10-26, #87:
     "where is the jump and landing sound?", right after the cartwheel and the flip became her first two clicks): the same
     whoosh as she springs and the same two soft steps as she lands, at the moments the frames leave and meet the floor */
  /* CARTWHEEL FEET (her 2026-11-23: "the boom boom landing sound needs to be ... timed with the feet"): measured on CW_SEQ (33
     frames over 1.3s) the lead foot plants on frame 26 (t .79) swinging down from about half her height, the trailing foot on
     frame 28 (t .85) from lower; the old single cue at .92 came ~170ms late, once she was already standing. Celebration
     heights are their peak lift (fractions of her height, as clayPick draws them). */
  var CUES = { backflip: [[ARC.backflip.a, function () { whoosh(arcV('backflip')); }], [ARC.backflip.b, function () { touchdown(arcV('backflip')); }]],
    star: [[ARC.star.a, function () { whoosh(arcV('star')); }], [ARC.star.b, function () { touchdown(arcV('star')); }]], cartwheel: [[26 / 33, foot(.45)], [28 / 33, foot(.25)]] };
  /* ONCE PER REAL EVENT (her 2026-11-23: "I keep hearing the sound stuff play a bunch of times"): a sound never repeats within
     a quarter second of itself, whatever the states do in between, and letting go of a bar is a drop, not a jump */
  var sfxAt = {};
  function once(n, fn) { var t = performance.now(); if (t - (sfxAt[n] || -1e9) < 250) return; sfxAt[n] = t; fn(); }
  function sfxTick() {
    var st = fig.state;
    if (st !== sfxWas) {
      if (st === 'air' && fig.vy < -300 && sfxWas !== 'hang' && !fig.dropSnd) { var v0 = fig.vy, gl = fig.waypoint || fig.target, down = !!(gl && (gl.drop || gl.y > fig.y + 8)); fig.bigDrop = down && gl ? gl.y - fig.y : 0; if (!down && v0 * v0 / (2 * G) >= herH()) once('jump', function () { springJump(v0, 'rise'); }); fig.shhV = v0; leapt = true; }   /* THE BIG SOUND IS FOR BIG MOVES (her 2026-11-23: "The jumping sound should only apply when we're moving ... bigger distances" / "That swishy sound can be there for ... smaller movements"): the boing only when the launch would lift her more than her own height (h = v²/2g); a small hop, a stair-step or a wall kick gets the swish alone, as she comes down — and NEVER on the way DOWN (her 2026-11-23: "she's moving down, shrill sound can't be there ... the second half of the sound needs to be there"): a jump whose goal is lower than where she takes off is a swish only */   // a launch, not a fall off an edge, nor her hands opening on a bar (release() gives her a little upward toss)
      if (st === 'hang') { var vc = fallV; once('grip', function () { squeeze(vc); }); }
      /* a landing, ALWAYS after a jump (her ask: "a sound when I land on something I
         jumped on" — landing up on a ledge comes in slow, near the top of the arc) */
      if ((sfxWas === 'air' || sfxWas === 'mantle') && (st === 'move' || st === 'idle') && (fallV > 150 || leapt)) { var vl = fallV; once('land', function () { touchdown(Math.max(0, vl)); }); }   // her real downward speed as she touched   // LIGHT ON HER FEET (her 2026-10-24: the landing 'so heavy'): two soft quick footfalls, not the thud;
      if (st !== 'air' && st !== 'mantle') leapt = false;
      sfxWas = st;
    }
    /* a drop's shh: the moment she is coming down (at once for a walk-off, at the top of the little spring for a hop-off),
       as loud as the speed the drop will land with (√(2g·h), the FORCE law) */
    if (st === 'air' && fig.dropSnd && (fig.vy || 0) >= 0) { var dh = fig.dropSnd; fig.dropSnd = 0; leapt = true; once('jump', function () { springJump(fallSpeed(dh), dh >= 2 * herH() ? 'drop' : 'fall'); }); }   // from really far (2+ of her heights): the falling notes
    /* A JUMP'S SHH WAITS FOR THE FALL (her 2026-11-23: "the jumping up sound is followed by the landing sound ... doesn't need to
       be there because the monkey bar grabbing sound is there"; and #944, the shh is "the second half when she's coming down"):
       the boing plays at take-off, the shh only once she is actually coming down. A jump that catches a bar never comes down,
       so it is boing → grab, nothing else (an aimed jump keeps fig.aim until its apex; if she misses, the shh plays as she falls) */
    if (st === 'air' && fig.shhV && (fig.vy || 0) >= 0 && !fig.aim) { var sv = fig.shhV, bd = fig.bigDrop || 0; fig.shhV = 0; fig.bigDrop = 0; once('shh', function () { bd >= 2 * herH() ? springJump(fallSpeed(bd), 'drop') : springJump(sv, 'fall'); }); }   // a jump DOWN from really far: the falling notes as she starts down
    if (st !== 'air' && !(fig.loadT > 0)) { fig.dropSnd = 0; fig.shhV = 0; fig.bigDrop = 0; }   // (kept through the take-off crouch, which runs on the ground)
    if (st === 'air') fallV = fig.vy || 0;
  }

  var stWas = 'idle';
  function advance(dt) {
    hangTouch(touchMode && (fig.state === 'hang' || !!(down && down.hz)));
    crouchFirst(stWas);   // a launch set outside the tick (the JUMP! box) loads first too, before the whoosh can hear it
    sfxTick();   // first: a launch set by a click or last frame's hop still has its full upward speed
    cloudMagnet();
    cloudCheck();
    rideT = Math.max(0, rideT - dt);
    fig.landT = Math.max(0, fig.landT - dt);
    fig.slideT = Math.max(0, fig.slideT - dt);
    /* a double tap that came while the first tap's climb had her in the air: it fires the moment she's on her feet */
    if (fig.tapQ && !fig.loadT && (fig.state === 'move' || fig.state === 'idle')) { var q = fig.tapQ; fig.tapQ = null; if (performance.now() - q.t < 1500) tapJump(q); }
    if (fig.loadT > 0) tickLoad(dt);
    else if (fig.state === 'move' || fig.state === 'idle') { var w = fig.state, wx = fig.x; tickGround(dt); crouchFirst(w, wx); }
    else if (fig.state === 'air') tickAir(dt);
    else if (fig.state === 'hang') tickHang(dt);
    else if (fig.state === 'mantle') tickMantle(dt);
    else if (fig.state === 'enter') tickEnter(dt);
    else if (fig.state === 'celeb') {
      var c0 = fig.celeb.t;
      fig.celeb.t += dt / fig.celeb.dur;
      (CUES[fig.celeb.name] || []).forEach(function (q) { if (c0 < q[0] && fig.celeb.t >= q[0]) q[1](); });
      if (fig.celeb.name === 'cartwheel') cartwheelTravel();
      if (fig.celeb.t >= 1) { fig.celeb = null; fig.state = 'idle'; }
    }
    else if (fig.state === 'wave') {
      fig.wave += dt / 1.6;
      if (fig.wave >= 1) { fig.state = fig.prev || 'idle'; fig.prev = null; }
    }
    if (fig.state !== 'air' && !fig.loadT) fig.dbl = fig.dblQ = null;   // one double jump per flight
    puffs = puffs.filter(function (p) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; return p.t > 0; });
    stWas = fig.state;
  }
  function frame(now) {
    raf = 0;
    var dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (rmActive()) { cv.style.display = ''; draw(now); return; }   // Reduce Motion: she stands still, but she's THERE
    if (!visible) return;
    advance(dt);
    draw(now);
    if (needsLoop()) raf = requestAnimationFrame(frame);
    else if (CLAY.ready) requestAnimationFrame(function (t) { draw(t); });   // settle on the resting clay frame, not the last moving one
  }
  function start() {
    if (rmActive()) { cv.style.display = ''; draw(performance.now()); return; }
    if (!raf) { cv.style.display = ''; last = performance.now(); raf = requestAnimationFrame(frame); }
  }

  /* ------------------------------------------------------------------ ink rendering
     Hand-drawn, after her reference sheets: every stroke is a shallow curve with its own
     wobble, the head is an open sketchy ellipse with a face, and while the figure moves
     the whole drawing "boils" at ~6Hz the way flipbook animation does. The wobble is
     deterministic per (stroke, boil-seed), so a resting figure is rock steady. */
  var seed = 0;
  function rnd(a, b) {
    var t = (a * 374761393 + b * 668265263 + seed * 974711) | 0;
    t = ((t ^ (t >>> 13)) * 1274126177) | 0;
    return (((t ^ (t >>> 16)) >>> 0) % 1000) / 1000 - 0.5;
  }
  var sid = 0; // stroke counter within a frame — the "a" of the wobble hash
  function stroke2(ax, ay, bx, by, w, bow) {
    sid++;
    var mx = (ax + bx) / 2, my = (ay + by) / 2;
    var dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1;
    var px = -dy / d, py = dx / d;
    var b = (bow || 0) + rnd(sid, 1) * 1.5;
    ctx.lineWidth = Math.max(1.2, w + rnd(sid, 2) * 0.7);
    ctx.beginPath();
    ctx.moveTo(ax + rnd(sid, 3) * 0.8, ay + rnd(sid, 4) * 0.8);
    ctx.quadraticCurveTo(mx + px * b, my + py * b, bx + rnd(sid, 5) * 0.8, by + rnd(sid, 6) * 0.8);
    ctx.stroke();
  }
  function fingers(x, y, baseA, n) {
    for (var i = 0; i < n; i++) {
      var a = baseA + (i - (n - 1) / 2) * 0.5 + rnd(sid + i, 7) * 0.2;
      stroke2(x, y, x + Math.cos(a) * 3.4, y + Math.sin(a) * 3.4, 1.4, 0);
    }
  }
  function ik(ax, ay, bx, by, l1, l2, side) {
    var dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
    var m = Math.min(d, l1 + l2 - 0.6); if (d > 0) { dx *= m / d; dy *= m / d; d = m; }
    var h = Math.sqrt(Math.max(l1 * l1 - (d / 2) * (d / 2), 0));
    return { ex: ax + dx / 2 - dy / d * h * side, ey: ay + dy / 2 + dx / d * h * side, hx: ax + dx, hy: ay + dy };
  }
  /* leg IK — a foot TARGET (x forward of the pelvis in stride units, y below it) solved
     back into the hip/knee angle convention of figure(): knee = (sin(a)·TH, cos(a)·TH),
     foot = knee + (sin(a-k)·SH, cos(a-k)·SH). The knee always folds forward. */
  function legIK(x, y) {
    var d = Math.min(Math.hypot(x, y), TH + SH - 0.4);
    var t = Math.atan2(x, y);
    var cg = Math.max(-1, Math.min(1, (TH * TH + d * d - SH * SH) / (2 * TH * d)));
    var cs = Math.max(-1, Math.min(1, (SH * SH + d * d - TH * TH) / (2 * SH * d)));
    var g2 = Math.acos(cg), s2 = Math.acos(cs);
    return { hip: t + g2, knee: g2 + s2 };
  }

  /* o: lean, hip:[], knee:[], sh:[], el:[], dy, rot, smile, grin, wavingHand, hands:[{x,y}],
     snap (plant the lowest foot/knee exactly on the surface), tiptoe (px of toe drop),
     headFollow (how much of the lean the head takes — default 0.5, it rights itself) */
  /* ------------------------------------------------------------------ clay Madhu
     (2026-10-23, her ask: "push the claymation to the main page instead of the stick man").
     Every state still runs through the same physics; only the drawing changes. Frames are
     Flora stop-motion poses of her (assets/clay/, made in clay-character/), chosen from the
     state and its timers, stepped like stop motion, mirrored by dir. The stick figure stays
     as the fallback until the frames load, and under ?stick. */
  /* HANG LOOK, a LOCAL review switch (her 2026-11-23: "The hanging avatar feels like a different treatment and like a different like visual
     quality than the normal avatar"): html[data-hang] is set only by build.js's local-review block (never on Vercel). 'colour': the hang
     sheets (tarzan-x3, hang-turn-x3) from assets/clay/graded/, colour-matched to walk/run/idle; 'step': that, and a change of pose while
     she hangs is a cut, like her walk, instead of the two poses blended (clayFigure); the swing's rotation and her pinned hands as they are */
  var HANG_LOOK = document.documentElement.getAttribute('data-hang') || '', HANG_STEP = HANG_LOOK === 'step';
  function HANG_DIR(f) { return HANG_LOOK && /^(tarzan-x3|hang-turn-x3)-\d+\.png$/.test(f) ? 'graded/' : ''; }
  var CLAY = { on: !/[?&]stick\b/.test(location.search), ready: false, man: null, img: {}, hx: {}, ph: 0, run: false, lastX: null, H: matchMedia('(max-width:760px)').matches ? 92 : 113, sk: 1, want: 0, skT: 0 };   // a little smaller on phones (her ask)
  function loadClay() {
    if (!CLAY.on) return;
    var base = (document.querySelector('script[src*="stick.js"]') || {}).src || '';
    var dir = base.replace(/stick\.js.*$/, '') + 'assets/clay/';
    var ver = (base.match(/\?v=[^&#]*/) || [''])[0];   // the build's cache-buster, so a re-rendered frame isn't served stale
    fetch(dir + 'clay.json' + ver).then(function (r) { return r.json(); }).then(function (m) {
      CLAY.man = m;
      /* LIGHT ON DATA (her 2026-10-26, #102: "i can't have slow load or anything. this is a crucial moment"). It was every
         sheet up front, ~230 PNGs / 6.3MB on a phone's first visit. Now in three steps, as WebP (q.95: side by side at her
         size it can't be told from the PNG, a third of the bytes):
           1. her standing frame (the PNG the page preloads) and her resting smile: she appears;
           2. 1.5s on (6s, or the page's load, on a slow connection), one sheet after another so each is usable as soon as
              it's in: every third walk frame (the old stride) with the jump and the hover wave, and she can move; then
              the ledge climb, every third run frame, then the in-between walk and run frames;
           3. the tricks (cartwheel, backflip, star, bow, hang, monkey bars), one sheet at a time: when the browser is idle,
              or, on Save-Data or a 2g/3g connection, only once someone plays with her (a trick she's asked for first).
         A frame not in yet is drawn as the nearest one of the same move that is (clayFigure), running borrows walking,
         a trick waits for its frames, and a browser without WebP gets the PNG. The unused clips (cartwheel-x3, dance-x3,
         the rest of idle-wave-sign-x3) are never fetched. */
      function src(f) { return dir + HANG_DIR(f) + (f === 'idle-wave-sign-0.png' ? f : f.replace(/\.png$/, '.webp')) + ver; }
      var pend = {};   // one load per frame, shared: a sheet is "in" only once its images really are, whoever asked first
      function getImg(f) {
        return pend[f] || (pend[f] = new Promise(function (res) {
          var im = new Image(); im.decoding = 'async';
          im.onload = function () { (im.decode ? im.decode() : Promise.resolve()).then(res, res); };   // decoded off the main thread BEFORE its first draw, or that draw decodes it, mid-move
          im.onerror = function () { if (/\.webp/.test(im.src)) im.src = dir + HANG_DIR(f) + f + ver; else res(); };
          im.src = src(f); CLAY.img[f] = im;
        }));
      }
      function loadSet(keys, done) {
        var ps = [];
        keys.forEach(function (k) { (Array.isArray(k) ? k : m[k] || []).forEach(function (f) { ps.push(getImg(f.f)); }); });
        Promise.all(ps).then(function () { done(); });
      }
      /* the tricks (~2.4 MB, ~250 frames) wait for a quiet moment. iPhones have no requestIdleCallback, and the old fallback,
         setTimeout(f, { timeout: 4000 }), read the object as a 0ms delay: every trick frame was requested the moment her run was
         in, in the page's first seconds, on top of the page's own start-up downloads (2026-11-24, her mom's iPhone: "choppy") */
      function laterIdle(f) {
        if (window.requestIdleCallback) return requestIdleCallback(f, { timeout: 4000 });
        var go = function () { setTimeout(f, 4000); };
        if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
      }
      function every3(k, r) { return (m[k] || []).filter(function (f, i) { return i % 3 === r; }); }
      /* ONE queue, one set at a time, so each is usable the moment it's in; a trick someone asks for goes to the front */
      var Q = [], busy = false;
      function pump() { if (busy || !Q.length) return; busy = true; var st = Q.shift(); loadSet(st[0], function () { busy = false; if (st[1]) st[1](); pump(); }); }
      function queue(st, front) { if (front) Q.unshift(st); else Q.push(st); pump(); }
      function sheet(k) { return [[k], function () { CLAY.sheetIn[k] = true; if (CLAY.onSheet) CLAY.onSheet(); }]; }
      var TRICKS = ['tarzan-x3', 'hang-turn-x3', 'cartwheel-in', 'cartwheel-50', 'backflip-x3', 'star-bow-x3'];   // tarzan-x3: the Flora hand-over-hand clip (2026-11-23); hang-swing-climb-x3 is no longer fetched   // (monkey-x3 retired 2026-11-22: the rigged hang goes hand over hand)
      var net = navigator.connection, lean = !!(net && (net.saveData || /2g|3g/.test(net.effectiveType || '')));
      CLAY.sheetIn = {};
      CLAY.need = function (fs, cb) { queue([[fs], cb], true); };   // a few named frames, ahead of everything else (her entrance: enterFrames)
      CLAY.tricks = function (first) {
        (first || []).slice().reverse().forEach(function (k) { if (!CLAY.sheetIn[k]) queue(sheet(k), true); });
        if (CLAY.tricksAsked) return; CLAY.tricksAsked = true;
        TRICKS.forEach(function (k) { if ((first || []).indexOf(k) < 0) queue(sheet(k)); });
      };
      if (m._smile) { var sm = new Image(); sm.src = src([].concat(m._smile)[0]); CLAY.img.smile = [sm]; }   // the soft smile is her resting face (the grin, smile-2, is never shown)
      loadSet(['idle-wave-sign'], function () {
        CLAY.ready = true; draw(performance.now()); start();
        var went = false, go = function () {
          if (went) return; went = true;
          queue([[every3('walk-x3', 0), 'jump-land-slide-x3', (m['idle-wave-sign-x3'] || []).slice(3, 6)], function () { CLAY.moveReady = true; start(); }]);
          queue([['climb-x3']]); queue(sheet('wall-rebound'));   // (3 small frames: any tap on the divider's curved end sends her up the wall, so they come with her moves, not with the tricks)
          queue([[every3('run-x3', 0)]]);
          queue([['walk-x3']]); queue([['run-x3'], function () { if (!lean) laterIdle(function () { CLAY.tricks(); }); }]);
        };
        if (!lean) setTimeout(go, 1500);
        else if (document.readyState === 'complete') go(); else { addEventListener('load', go); setTimeout(go, 6000); }
      });
    }).catch(function () { CLAY.on = false; });
  }
  function onClay(p, pad) { pad = pad || 0; return Math.abs(p.x - fig.x) < 34 + pad && p.y > fig.y - CLAY.H - 6 - pad && p.y < fig.y + 6 + pad; }
  loadClay();   // at once, not on idle: her standing frame must be in by the time the name rises (the link preload in the hero has it in flight already)
  /* her ask (2026-10-23, "the wave is spazzy. smile and only wave one hand"): frames 2/5 and 3/4 are
     DIFFERENT hands with the body turned opposite ways, so mixing them flipped her back and forth.
     Only 3↔4 now: one hand, one stance, both smiling, unhurried. */
  /* x3 (2026-10-23): frames 3-5 of idle-wave-sign-x3 are the one hand, one stance, smiling; ping-pong them */
  var WAVE_T = [[3, .25], [4, .25], [5, .35], [4, .25], [3, .25], [4, .25], [5, .6], [4, .4], [3, .4]];
  function timedAt(list, t) { var tot = 0, i; for (i = 0; i < list.length; i++) tot += list[i][1]; var x = Math.min(t, tot - 1e-6); for (i = 0; i < list.length; i++) { if (x < list[i][1]) return list[i][0]; x -= list[i][1]; } return list[list.length - 1][0]; }
  /* which clay frame, how it is anchored: feet on the ground (default), hands on a grip, or
     lifted; rot in radians about the anchor; flip mirrors on top of dir */
  /* [sheet, frame, mirrored]: the cartwheel, built so it reads as an athletic gymnast's (her notes 2026-10-24: the
     clip's frames dropped her back onto a foot mid-roll, lowered her arms before the hands went down, swung the legs
     back after the handstand, and a rigid tilt "doesn't feel like an athletic gymnast"). The ENTRY is a Flora pose
     sheet (cartwheel-in: arms up, a real lunge, tipping over the bent leg, hand down with the leg kicking up); then
     the 50-frame set's hand frames to the handstand (cartwheel-50, half size); then all of it mirrored and played
     back, so she lands in a lunge on the far side and stands tall, arms up. Both old clips' raw orders are wrong. */
  var CW_IN = 'cartwheel-in', CW_50 = 'cartwheel-50';
  var CW_SEQ = (function () {
    var hands = [2, 3, 4, 5, 8, 9, 10], top = [11, 12, 13, 14, 15, 16, 17], entry = [0, 0, 1, 1, 2, 3];
    var s = entry.map(function (k) { return [CW_IN, k, 0]; });
    hands.concat(top).forEach(function (k) { s.push([CW_50, k, 0]); });
    hands.slice().reverse().forEach(function (k) { s.push([CW_50, k, 1]); });
    return s.concat(entry.slice().reverse().map(function (k) { return [CW_IN, k, 1]; }));
  })();
  /* where her torso sits in each cartwheel frame (clay px, forward), so whatever is touching the floor STAYS put and
     the body rotates over it: foot, hand, other hand, foot (her: "she moves too far to the right and left … it's really
     dictated by the points of contact"). Measured off each frame's lowest pixels: of the contacts that carry over from
     the frame before, the one that keeps her from going backwards is the planted one. */
  var CW_DX = [0,0,58,58,77,77,161,161,218,218,228,228,228,257,257,257,264,265,270,331,352,352,352,362,362,419,419,503,503,522,522,580,580];
  /* TILT IN MOTION ONLY (her 2026-10-26, #91: "i only want the tilting gone when shes stopping moving. tilt is important
     when shes in motion"): she tips forward from her feet as she walks (~4°) and runs (~11°), easing into it; the moment
     she stops she stands straight, no lean-back and no unwinding (#86/#89: both read as weird) */
  var RUN_LEAN = 0.2, WALK_LEAN = 0.07;
  function clayPick(o, groundY) {
    var st = fig.state, sp = Math.abs(fig.vx || 0);
    if (CLAY.lastX == null) CLAY.lastX = fig.x;
    /* ONE stride clock for walk and run (her 2026-10-26: "spazzy"): each sheet used to count its own frames off the same
       distance, so every change of pace snapped her legs to an unrelated frame. The phase carries over (run frame =
       walk frame + 11 lines up their heel strikes), and the pace only changes well past the line, not back and forth on it */
    CLAY.run = sp > (CLAY.run ? 200 : 260);
    /* the lean goes with her speed, so it has faded to a walk's few degrees by the time she stops (easing down quicker than
       up): straight up from there is a step too small to see as a rotation */
    var lt = st === 'move' && sp >= 12 && !fig.landT && !fig.loadT ? (CLAY.run ? RUN_LEAN * Math.min(1, sp / RUN) : WALK_LEAN * Math.min(1, sp / WALK)) : 0, l0 = CLAY.lean || 0;
    if (lt) lt *= fig.target ? Math.min(1, Math.abs(fig.target.x - fig.x) / 40) : fig.drag ? 1 : 0;   // and fades over her last 40px to the spot (let go mid-run: she's stopping)
    CLAY.lean = lt ? l0 + (lt - l0) * (lt < l0 ? .4 : .18) : 0;
    /* up the divider's curved end her stride counts the way she really travels, along the line: counted across only, her legs
       all but stopped on the steep part and she slid up it in one held run frame just before the wall (her 2026-11-24 "glitchy") */
    var sdy = st === 'move' && CLAY.lastY != null && onCurve(fig.x) ? fig.y - CLAY.lastY : 0;
    CLAY.ph = (CLAY.ph + Math.hypot(fig.x - CLAY.lastX, sdy) / (CLAY.run ? 3 : 1.83)) % 48; CLAY.lastX = fig.x; CLAY.lastY = fig.y;
    /* the sheet's own crouch (0-3: sink, arms back, rise onto the toes) and landing (10-14: feet reach, knees take it,
       stand back up, 22: tall again), stepped through by the time left, so a quick hop is a quick dip and a slam is a deep one */
    if (fig.loadT > 0 && (st === 'move' || st === 'idle')) return { s: 'jump-land-slide-x3', k: [0, 1, 2, 3][Math.min(3, Math.floor((1 - fig.loadT / fig.load0) * 4))] };
    if (fig.landT > 0 && (st === 'move' || st === 'idle')) { var LS = fig.land0 < .15 ? [11, 12, 13, 14] : [10, 11, 12, 12, 13, 14, 22];
      return { s: 'jump-land-slide-x3', k: LS[Math.min(LS.length - 1, Math.floor((1 - fig.landT / fig.land0) * LS.length))] }; }
    if (fig.slideT > 0 && st === 'move') return { s: 'jump-land-slide-x3', k: 18 };
    switch (st) {
      case 'move':
        if (sp < 12) return { s: 'idle-wave-sign', k: 0 };
        if (CLAY.run) return { s: 'run-x3', k: Math.floor(CLAY.ph + 11) % 48, lean: CLAY.lean };
        return { s: 'walk-x3', k: Math.floor(CLAY.ph), lean: CLAY.lean };   // x3: a frame every third of the old stride step
      case 'air': { var vy = fig.vy || 0;
        /* on the wall (tickWall): her climb frame 6 facing it, the raised fist and the bent knee on it, pinned by that fist */
        /* her slide pose the whole time she is on the wall, from the moment she leaves the curve for it (rampUp): the coiled frame 1
           squashed her into the wall (her 2026-11-24: "Her smushing he body against the wall it weird"), and on the way up a
           stretched jump frame flashed between her run and the wall pose (her "glitchy") */
        var U = !fig.wall && fig.rampUp, wq = fig.wall || U && { hx: wallX(U.side), hy: fig.y - CLAY.H * .5 - (wallF().base - wallF().gy) / 2 * wallSc(), side: U.side };
        if (wq) { var wf = wallF();
          return { s: wf.s, k: wf.k, anchor: 'hands', ax: wq.hx, ay: wq.hy, gx: wf.gx, gy: wf.gy, rot: -wq.side * (wf.rot || 0), flip: wq.side !== fig.dir, zoom: wf.s === WALL_S ? WALL_Z : 1 }; }   // (both pinned at her hand on the wall)
        if (fig.wallPush && CLAY.man[WALL_S]) { var kf = CLAY.man[WALL_S][2]; return { s: WALL_S, k: 2, anchor: 'hands', ax: fig.x, ay: groundY - CLAY.H * .5, gx: kf.mx - kf.ox, gy: kf.my - kf.oy, flip: fig.wallPush.side !== fig.dir, zoom: WALL_Z }; }   // the push-off: her middle where the air frames put it, still facing us
        if (fig.flip) return { s: 'jump-land-slide-x3', k: 7, spin: (fig.flip.rot || 0) * (fig.flip.dir || 1) };
        /* falling, the last 60px to the ground slide the pin from the frame's middle to its feet, so they meet the floor
           exactly (#99: pinned by the middle all the way, the feet sat 9px off and snapped down as she touched) */
        var win = Math.max(60, vy * .1), gd = vy > 0 ? groundBelow(fig.x, fig.y, win) : null;   // (a fast fall gets a longer run-in)
        return { s: 'jump-land-slide-x3', k: fig.aim && vy < 0 ? (vy < -500 ? 4 : 5) : vy < -500 ? 4 : vy < -300 ? 5 : vy < -90 ? 6 : vy < 120 ? 7 : vy < 300 ? 8 : 9, mid: true, feet: gd == null ? 0 : Math.max(0, Math.min(1, 1 - (gd - fig.y) / win)) }; }
      case 'hang': {   /* a whole Tarzan frame pinned at her fist, turned only as the pendulum needs (tickHang) */
        var h = fig.hang;
        if (!tz()) return { s: 'hang-swing-climb-x3', k: 0, anchor: 'hands', ax: h.G.x, ay: h.G.y, gx: HANGF[0].gx, gy: HANGF[0].gy };
        if (h.turn && h.turn.pk) return h.turn.pk;   // the turn round one hand (tickTurn), pinned at whichever fist holds
        return { s: 'tarzan-x3', k: h.i, anchor: 'hands', ax: h.G.x + h.off.x, ay: h.G.y + h.off.y, rot: h.r + (h.ri || 0), pin: true, mix: h.mix };
      }
      case 'mantle': { var m = fig.mantle, t = m.t;
        if (t < MU_PULL) return { s: 'climb-x3', k: m.up ? muFrame(m) : 9 + Math.min(5, Math.floor(t / MU_PULL * 6)), anchor: 'hands', ax: m.up ? muHandX(m) : m.x1, gx: m.up ? CLIMB_FIST[muFrame(m)] : undefined,
          ay: m.hy0 == null ? m.y1 : muHand(m), gy: m.up ? HANGF[0].gy : 0 };   // a muscle-up's hands on the letters' tops, the fist closed over them as in the hang
        return { s: 'climb-x3', k: 18 + Math.min(12, Math.floor((t - MU_PULL) / (1 - MU_PULL) * 13)) }; }
      case 'wave': return { s: 'idle-wave-sign-x3', k: timedAt(WAVE_T, fig.wave * 3) };
      case 'enter': return enterPick();
      case 'sign': return { s: 'star-bow-x3', k: 8 };
      case 'celeb': { var c = fig.celeb, ct = c.t;
        switch (c.name) {
          case 'star': return { s: 'star-bow-x3', k: ct < .22 ? Math.min(2, Math.floor(ct / .22 * 3)) : ct < .78 ? 3 : 4 + Math.min(2, Math.floor((ct - .78) / .22 * 3)), lift: arcLift('star', ct) };
          case 'backflip': return { s: 'backflip-x3', k: Math.min(17, Math.floor(ct * 18)), lift: arcLift('backflip', ct) };   // off the floor only between take-off (frame 4) and landing (frame 14)
          case 'dance': return { s: 'dance-x3', k: Math.min(47, Math.floor(ct * 48)) };
          /* (2026-10-24, her: "glitchy … at one point she's already on one hand but the next image has her back on her
             foot"): the clip's frames 12-15 drop her back onto a foot, and its second half swings the legs back the
             way they came. So the cartwheel is built from the coherent first half only (stand, lean, one hand,
             handstand) and its MIRROR played backwards: foot, hand, other hand, foot, foot, travelling one way. The
             clip was cut ~1.18x bigger than her standing frame, hence the zoom. */
          case 'cartwheel': { var cw = CW_SEQ[Math.min(CW_SEQ.length - 1, Math.floor(ct * CW_SEQ.length))];
            if (!CLAY.man[cw[0]]) return { s: 'idle-wave-sign', k: 0 };   // (a clay.json without these sheets)
            return { s: cw[0], k: cw[1], flip: !!cw[2] }; }
          case 'bow': return { s: 'star-bow-x3', k: [9, 10, 11, 12, 12, 12, 11, 10, 13, 14][Math.min(9, Math.floor(ct * 10))] };
        }
        return { s: 'idle-wave-sign', k: 0 }; }
    }
    return { s: 'idle-wave-sign', k: 0 };
  }
  /* THE RUN'S BODY MOVES AT ONE SPEED (2026-10-26, "spazzy … like it's jumping frames"): the run frames' anchors drift
     her head ~28 clay px back over each half-stride and snap it forward again at frames 1 and 25, a lurch every step.
     Each frame is placed by its head instead (the mean of the top 40 rows of ink, measured off the frames once they
     load), held where the WALK carries its head, so the body glides, the legs do the running, and setting off into a
     run doesn't throw her head forward. null until the frames are in; false if unreadable. */
  function bodyOff(sheet) {
    var raw = headX(sheet), ref = headX('walk-x3');
    if (!raw) return raw;
    var mean = function (a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; }, m = mean(ref || raw);
    return raw.map(function (h) { return h - m; });
  }
  function headX(sheet) {
    if (CLAY.hx[sheet] != null) return CLAY.hx[sheet];
    var list = CLAY.man[sheet], ims = list.map(function (f) { return CLAY.img[f.f]; });
    /* baked by tools/clay-heads.js: reading the pixels back here froze phones for half a second as she set off (her
       2026-10-28: "people are complaining that the avatar is super choppy"). The scan below is only for a clay.json
       without them */
    if (list.every(function (f) { return f.hx != null; })) return (CLAY.hx[sheet] = list.map(function (f) { return f.hx; }));
    if (ims.some(function (im) { return !im || !im.complete || !im.naturalWidth; })) return null;
    try {
      var c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true });
      var hs = list.map(function (f, i) {
        var im = ims[i], w = c.width = im.naturalWidth, h = c.height = im.naturalHeight; g.drawImage(im, 0, 0);
        var px = g.getImageData(0, 0, w, h).data, top = -1, sx = 0, n = 0;
        for (var y = 0; y < h && (top < 0 || y < top + 40); y++) for (var x = 0; x < w; x++)
          if (px[(y * w + x) * 4 + 3] > 128) { if (top < 0) top = y; sx += x; n++; }
        return n ? sx / n - f.cx : 0;
      });
      return (CLAY.hx[sheet] = hs);
    } catch (e) { return (CLAY.hx[sheet] = false); }
  }
  /* running on the divider's curve she goes square to the line, her body along its normal (pivoting on her feet), never more
     than RAMP_MAX; eased in and out so stepping onto the curve is not a snap. IN MOTION ONLY, like her lean (her 2026-10-26, #91):
     stopped on the curve she settles to half of it (all of it standing still, at 35°, she read as falling over; bolt upright, her
     downhill foot hung in the air: the 2026-11-23 check). SLOPE_TILT 0 = upright in motion too. footDrop() plants the feet */
  var slopeA = 0;
  function slopeTilt() {
    var st = fig.state, on = ramp && (st === 'move' || st === 'idle') && onCurve(fig.x) && Math.abs(fig.y - floorAt(fig.x)) < 1.5;
    var t = on ? Math.max(-RAMP_MAX, Math.min(RAMP_MAX, Math.atan(slopeAt(fig.x)))) * SLOPE_TILT * (st === 'move' && Math.abs(fig.vx || 0) >= 12 ? 1 : .5) : 0;
    slopeA += (t - slopeA) * .35; if (Math.abs(slopeA - t) < .002) slopeA = t;
    return slopeA;
  }
  /* SHE NEVER FLOATS ON THE CURVE: her soles span ~±6.5% of her height either side of her middle; turned by her tilt, if the line
     under either one is lower than that foot, her drawing comes down until it touches (the other foot presses into the line) */
  function footDrop(px, sa) {
    if (!ramp || !onCurve(px) || (fig.state !== 'move' && fig.state !== 'idle') || Math.abs(fig.y - floorAt(px)) > 1.5) return 0;
    var f = CLAY.H * .065, c = Math.cos(sa), sn = Math.sin(sa), d = 0;
    for (var k = -1; k <= 1; k += 2) d = Math.max(d, floorAt(px + k * f * c) - (fig.y + k * f * sn));
    return d;
  }
  function clayFigure(px, py, dir, o) {
    var sa = slopeTilt();   // (every frame, so it is never stale from before a jump)
    var groundY = py + LEG - 0.7, pk = clayPick(o, groundY), list = CLAY.man[pk.s], f = list && list[pk.k % list.length];
    CLAY.pk = pk; CLAY.pts = pk.anchor === 'hands' ? { hands: pk.hold || [{ x: pk.ax, y: pk.ay }] } : null;
    if (!f) return false;
    var im = CLAY.img[f.f];
    if ((!im || !im.complete || !im.naturalWidth) && list) {   // not in yet: the nearest earlier frame of the same move that is, else the walk's (for a run)
      var alt = function (L, k) { for (var j = 0; j < 3; j++) { var g = L && L[(k - j + L.length) % L.length], gi = g && CLAY.img[g.f]; if (gi && gi.complete && gi.naturalWidth) return [g, gi]; } };
      var a = alt(list, pk.k) || (pk.s === 'run-x3' && alt(CLAY.man['walk-x3'], pk.k));
      if (a) { f = a[0]; im = a[1]; if (list !== CLAY.man[pk.s] || CLAY.man['walk-x3'].indexOf(f) >= 0) pk.s = CLAY.man['walk-x3'].indexOf(f) >= 0 ? 'walk-x3' : pk.s; }
    }
    if (!im || !im.complete || !im.naturalWidth) { if (!CLAY.last) return false; CLAY.miss = (CLAY.miss || 0) + 1; im = CLAY.last.im; f = CLAY.last.f; }   // still streaming in: hold her last frame
    else CLAY.last = { im: im, f: f };
    /* hover smile, stepped like clay on the 12fps clock: neutral → soft smile → eyes-closed grin,
       and back down on leave. Standing frame only; re-tested per draw, so she also smiles when SHE
       walks under a still cursor. naturalWidth, not complete: a missing file is "complete" too. */
    var sl = CLAY.img.smile;
    if (sl && f.f === 'idle-wave-sign-0.png') {
      /* her face is the soft smile, resting AND on hover (her: "my claymation resting face looks so rbf and uninviting",
         then "I don't need super big smile with teeth": the eyes-closed grin, smile-2, is never shown) */
      CLAY.want = 1;
      if (CLAY.want !== CLAY.sk && !CLAY.skT) CLAY.skT = setTimeout(function () {
        CLAY.skT = 0; CLAY.sk += CLAY.want > CLAY.sk ? 1 : CLAY.want < CLAY.sk ? -1 : 0;
        if (!raf) draw(performance.now());
      }, 83);
      var si = sl[CLAY.sk - 1]; if (si && si.naturalWidth) im = si;
    } else CLAY.sk = 1;   // back to standing she is already smiling, never a beat of the flat face
    var sc = CLAY.H / CLAY.man._ref, d = dir * (pk.flip ? -1 : 1);
    ctx.save();
    if (pk.anchor === 'hands' && pk.pin) {   /* a Tarzan frame: placed by its own pin to the fist */
      var mf = pk.mix && (pk.mix.s ? CLAY.man[pk.mix.s] : list)[pk.mix.k], mi = mf && CLAY.img[mf.f], ga = ctx.globalAlpha;
      if (mi && mi.complete && mi.naturalWidth && HANG_STEP) {   // HANG LOOK 'step': only the pose that outweighs the other, each where it is pinned
        ctx.translate(pk.ax, pk.ay);
        if (pk.mix.a < .5) { if (pk.rot) ctx.rotate(pk.rot); ctx.scale(sc * d * (pk.sx || 1), sc); ctx.drawImage(im, f.ox, f.oy); }
        else { if (pk.mix.tx || pk.mix.ty) ctx.translate(pk.mix.tx || 0, pk.mix.ty || 0); ctx.rotate(pk.mix.rot); ctx.scale(sc * d * (pk.sx || 1), sc); ctx.drawImage(mi, mf.ox, mf.oy); }
      } else if (mi && mi.complete && mi.naturalWidth) {   // cross-fading into the next pose: both added ('lighter') on the clear canvas, weights summing to 1
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = ga * (1 - pk.mix.a);
        ctx.translate(pk.ax, pk.ay); ctx.save(); if (pk.rot) ctx.rotate(pk.rot); ctx.scale(sc * d * (pk.sx || 1), sc); ctx.drawImage(im, f.ox, f.oy); ctx.restore();
        ctx.globalAlpha = ga * pk.mix.a; if (pk.mix.tx || pk.mix.ty) ctx.translate(pk.mix.tx || 0, pk.mix.ty || 0); ctx.rotate(pk.mix.rot); ctx.scale(sc * d * (pk.sx || 1), sc); ctx.drawImage(mi, mf.ox, mf.oy);
      } else { ctx.translate(pk.ax, pk.ay); if (pk.rot) ctx.rotate(pk.rot); ctx.scale(sc * d * (pk.sx || 1), sc); ctx.drawImage(im, f.ox, f.oy); }
    }
    else if (pk.anchor === 'hands') { ctx.translate(pk.ax, pk.ay); if (pk.rot) ctx.rotate(pk.rot); var z = pk.zoom || 1; ctx.scale(sc * d * z, sc * z); ctx.drawImage(im, -(pk.gx != null ? pk.gx : f.gx != null ? f.gx : f.cx), -(pk.gy != null ? pk.gy : f.gy || 0)); }   /* gx/gy: the gripping fist, so it lands ON the letter */
    else if (pk.spin != null) { ctx.translate(px, groundY - CLAY.H * .5); ctx.rotate(Math.round(pk.spin / .5) * .5); ctx.scale(sc * d, sc); ctx.drawImage(im, -f.cx, -f.base + CLAY.man._ref * .5); }   /* stepped spin, like clay */
    /* airborne frames pin by their MIDDLE, not their feet: a tuck is ~25% shorter than a stretch, and
       feet-pinning dropped her head ~50px every time the frame changed (the "glitch when I jump") */
    else if (pk.mid) { var w = 1 - (pk.feet || 0); ctx.translate(px, groundY - CLAY.H * .5 * w); ctx.scale(sc * d, sc); ctx.drawImage(im, -f.cx, -f.base + f.h * .5 * w); }
    else { var bo = pk.s === 'run-x3' && bodyOff(pk.s);
      ctx.translate(px, groundY - (pk.lift || 0) * CLAY.H + footDrop(px, sa)); if (sa) ctx.rotate(sa); if (pk.lean) ctx.rotate(pk.lean * dir); ctx.scale(sc * d, sc); ctx.drawImage(im, -f.cx - (bo ? bo[pk.k % bo.length] : 0), -f.base); }   /* lean pivots on the feet, top toward travel */
    ctx.restore();
    return true;
  }

  function figure(px, py, dir, o) {
    if (fig.hidden) return;   // stood in for by another drawing of her (resume-plane.js plays her paper-airplane throw in her spot)
    if (CLAY.on) { if (CLAY.ready) clayFigure(px, py, dir, o); return; }   // NEVER the stick figure (her call 2026-10-24: "no more stick man"); until her clay frames are in, nothing
    /* grounded poses NEVER float: whatever the gait is doing, the lowest contact —
       foot, or knee when the legs are folded — is planted exactly on the surface */
    if (o.snap) {
      var low = 0;
      for (var iS = 0; iS < 2; iS++) {
        var aS = o.hip[iS], fyS = Math.cos(aS) * TH + Math.cos(aS - o.knee[iS]) * SH;
        low = Math.max(low, fyS, Math.cos(aS) * TH);
      }
      o.dy = (LEG - 0.7) - low;
    }
    ctx.save();
    ctx.translate(px, py + (o.dy || 0));
    if (o.rot) ctx.rotate(o.rot * dir);
    ctx.strokeStyle = ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var lean = o.lean || 0;
    var hf = o.headFollow == null ? 0.5 : o.headFollow;
    var nx = Math.sin(lean) * TO * dir, ny = -Math.cos(lean) * TO;
    var hx = nx + Math.sin(lean * hf) * (NK + HR) * dir, hy = ny - Math.cos(lean * hf) * (NK + HR);
    // legs, each with a small forward bow so they read as drawn, not plotted
    for (var i = 0; i < 2; i++) {
      var a = o.hip[i], k = o.knee[i];
      var kx = Math.sin(a) * TH * dir, ky = Math.cos(a) * TH;
      var fx = kx + Math.sin(a - k) * SH * dir, fy = ky + Math.cos(a - k) * SH;
      stroke2(0, 0, kx, ky, 2.4, 0.7 * dir);
      stroke2(kx, ky, fx, fy, 2.2, -0.5 * dir);
      // a foot: short stroke pressed ~0.7px into whatever it stands on; on tiptoe the
      // heel rises and the TOE stays on the ground — contact, never a hover. A swing
      // foot mid-stride carries a pitch instead (toe trailing on lift, levelling to
      // strike) and gets NO press — it is the one foot that is honestly in the air.
      var fp = o.footPitch ? o.footPitch[i] : 0;
      if (o.tiptoe) stroke2(fx, fy + 0.7, fx + 3.4 * dir, fy + 0.7 + o.tiptoe, 2.0, 0);
      else if (fp) stroke2(fx, fy, fx + 4.4 * Math.cos(fp) * dir, fy + 4.4 * Math.sin(fp), 2.0, 0);
      else stroke2(fx, fy + 0.7, fx + 4.4 * dir, fy + 0.7, 2.0, 0);
    }
    // torso
    stroke2(0, 0, nx, ny, 2.6, 0.9 * dir);
    // arms
    for (var j = 0; j < 2; j++) {
      var hxw = null, hyw = null;
      if (o.hands && o.hands[j]) {
        var t = o.hands[j];
        var lx = t.x - px, ly = t.y - (py + (o.dy || 0));
        /* armStretch: a dead hang pulls the shoulder girdle up out of the torso, so a
           hanging arm is honestly longer than a swinging one — without it the deeper
           HANG_L would leave the ik clamp drawing hands short of the grips */
        var as = o.armStretch || 0;
        var r = ik(nx, ny, lx, ly, UA + as, FA + as, j ? -dir : dir);
        stroke2(nx, ny, r.ex, r.ey, 2.2, 0.6 * dir);
        stroke2(r.ex, r.ey, r.hx, r.hy, 2.0, -0.4 * dir);
        hxw = r.hx; hyw = r.hy;
      } else {
        var s = o.sh[j], el = o.el[j];
        var ex = nx + Math.sin(s) * UA * dir, ey = ny + Math.cos(s) * UA;
        var wx = ex + Math.sin(s + el) * FA * dir, wy = ey + Math.cos(s + el) * FA;
        stroke2(nx, ny, ex, ey, 2.2, 0.6 * dir);
        stroke2(ex, ey, wx, wy, 2.0, -0.4 * dir);
        hxw = wx; hyw = wy;
      }
      if (o.fingers && (o.fingers === 3 || o.fingers === j + 1) && hxw != null) {
        fingers(hxw, hyw, o.wavingHand === j ? -Math.PI / 2 : -Math.PI / 3 * dir, 3);
      }
    }
    // head — a sketchy open ellipse, never a perfect circle. It SITS on the neck: the
    // ellipse is centred at the neck-top point, and a short neck stroke joins it to the
    // shoulders — the head must never float free of the body.
    stroke2(nx, ny, hx, hy + HR * 0.9, 2.2, 0);
    sid++;
    var hr = HR + rnd(sid, 8) * 0.6;
    var tilt = lean * 0.4 + rnd(sid, 9) * 0.1;
    var a0 = -Math.PI / 2 + 0.25 + rnd(sid, 10) * 0.3;
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.ellipse(hx, hy, hr, hr * 0.93, tilt, a0, a0 + Math.PI * 1.97);
    ctx.stroke();
    // the face — always there, bigger smile when it has something to celebrate
    var cxf = hx + 1.6 * dir, cyf = hy - 0.6;
    ctx.fillStyle = ink;
    ctx.beginPath(); ctx.arc(cxf + 1.6 * dir, cyf - 1.6, 0.85, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(cxf - 1.4 * dir, cyf - 1.6, 0.85, 0, 7); ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    var sm = o.grin ? 3.4 : (o.smile ? 2.6 : 1.8);
    ctx.arc(cxf, cyf + (o.grin ? 0.4 : 0.8), sm, 0.3, Math.PI - 0.3);
    ctx.stroke();
    ctx.restore();
  }

  function mix(a, b, t) { return a + (b - a) * t; }

  function pose() {
    var p = { lean: 0.03, hip: [0.06, -0.06], knee: [0.06, 0.06], sh: [0.1, -0.1], el: [0.12, 0.12], dy: 0, rot: 0 };
    var sp = Math.min(Math.abs(fig.vx) / RUN, 1);
    var ph = fig.phase;
    switch (fig.state) {
      case 'sign': {
        /* on tiptoe, both hands flat on the board's underside, holding it up. The lift
           is modest and the toes stay ON the ground — a raised heel, not a levitation.
           ONLY when the board is genuinely within reach: pretending to hold a board the
           arms can't touch is exactly the floating look she vetoed, so an out-of-reach
           board gets a flat-footed ta-da beneath it instead. */
        if (sign && sign.bottom >= fig.y - 67) {
          p.dy = -4; p.tiptoe = 3.4;
          p.hip = [0.04, -0.04]; p.knee = [0.03, 0.03];
          p.hands = [{ x: sign.cx - 13, y: sign.bottom + 1 }, { x: sign.cx + 13, y: sign.bottom + 1 }];
        } else {
          p.sh = [-2.75, -2.55]; p.el = [-0.15, -0.2]; p.fingers = 3;
        }
        p.smile = true;
        break;
      }
      case 'idle': break;
      case 'wave': {
        var wv = fig.wave;
        var env = Math.min(wv / 0.15, 1) * Math.min((1 - wv) / 0.2, 1);
        if (fig.prev === 'sign' && sign && sign.bottom >= fig.y - 67) {
          /* keep one hand holding the board, wave with the other */
          p.dy = -4; p.tiptoe = 3.4;
          p.hands = [null, { x: sign.cx + 13, y: sign.bottom + 1 }];
          p.sh = [-2.9, 0]; p.el = [(-0.5 + Math.sin(wv * 22) * 0.8) * env, 0];
        } else {
          p.sh = [-2.9 * env - 0.1, -0.15];
          p.el = [(-0.5 + Math.sin(wv * 22) * 0.8) * env, 0.2];
        }
        p.fingers = 1; p.wavingHand = 0;
        p.grin = true;
        break;
      }
      case 'move': {
        /* the gait is FEET-first now. The old sinusoidal hips swept both feet
           symmetrically under the body, so the planted foot slid backward along the ink
           — a skate, not a step. Here each foot is a placed TARGET and legIK solves the
           angles: phase advances 0.05 rad per px travelled (tickGround), the gait
           consumes it ×2.4, so over a stance half-cycle the planted foot travels
           backward under the pelvis at exactly -vx — stationary on the page — while the
           swing foot arcs over it with a real pick-up: toe trailing as it lifts,
           levelling out to reach past for the next strike. The pelvis dips into double
           support on its own, because snap plants whichever contact is lowest. */
        /* the walk stands TALL. Stance height is the whole posture: at 24 under a 26px
           leg the knees carried ~45° of flex through every stride — a groucho creep.
           25.5 leaves ~22° at mid-stance (a natural walking knee), and the deeper dip
           at the stride ends keeps the ±L reach inside the leg so the pin still holds.
           At speed the STRIDE lengthens (gaitM) rather than the cadence exploding, and
           the dip deepens with it — DIP is linear in sp on purpose: L grows linearly,
           so a linear dip holds √(L² + (STAND−DIP)²) ≈ 25.3 ≤ 25.6 across every speed
           (an sp² dip lets the reach clip the clamp near sp 0.7 and the foot skates). */
        var L = 13.09 * gaitM(sp);           // half-stride: π/(2·0.12) at a walk
        var STAND = 25.5, DIP = 3.6 + 3.4 * sp;
        var lift = 4 + 12 * sp;              // the run picks its knees UP
        /* the trailing leg mirrors the arm's deep backswing (her rule): the foot
           can't be PLANTED farther back — the IK reach clamp would make it skate —
           so the extension lives in early swing, where a real runner's does: after
           toe-off the airborne foot drifts a further `trail` px back in pelvis
           space while the heel snaps up toward the seat (`kick` shifts the lift
           peak early). Thigh trails ~59° behind vertical with the shin folded —
           read against the 90° tricep, the leg finally scissors like the arms.
           Both fade with sp², so the walk keeps its low, quiet recovery. */
        var trail = 9 * sp * sp;
        var kick = 1 - 0.35 * sp;
        var fpitch = [0, 0], nrm = [0, 0];
        for (var li = 0; li < 2; li++) {
          var cyc = (fig.gait + li * Math.PI) % (Math.PI * 2);
          var xf, yf;
          if (cyc < Math.PI) {               // stance — pinned flat on the ground
            xf = L * (1 - 2 * (cyc / Math.PI));
            yf = STAND - DIP * (1 - Math.cos((xf / L) * (Math.PI / 2)));
            nrm[li] = xf / L;
          } else {                           // swing — back-trail, heel-kick, then over
            var u = (cyc - Math.PI) / Math.PI;
            var xb = -L + 2 * L * u;
            yf = STAND - DIP * (1 - Math.cos((xb / L) * (Math.PI / 2))) - lift * Math.sin(Math.PI * Math.pow(u, kick));
            xf = xb - trail * Math.sin(Math.PI * Math.min(u / 0.45, 1));
            fpitch[li] = Math.sin(u * Math.PI) * (0.7 - 0.95 * u);
            nrm[li] = xb / L;                // arms key off the bounded sweep, not the trail
          }
          var lk = legIK(xf, yf);
          p.hip[li] = lk.hip; p.knee[li] = lk.knee;
        }
        p.footPitch = fpitch;
        /* arms counter-swing the same-side foot — near-straight at a walk (an elbow
           carried at 0.35 rad read as a skulk). The run pumps like a real runner:
           the elbow FLEXES to ~88° as the arm drives forward (hand rises to chest
           height) and OPENS on the backswing so the hand trails low behind the hip —
           a constant full bend swung far back cocked the elbow behind the torso,
           which read as a creep, not a run (her 2026-08-17 note). The swing is
           BACKWARD-BIASED like real sprint form (her rule, same day): at full run
           the TRICEP comes parallel to the ground — the back extreme ramps to 90°
           behind vertical — while the forward drive stays moderate (~26°) and gets
           its height from the elbow pump, hand to chest. A walk (sp→0) is symmetric
           ±0.3 and numerically unchanged. The opening elbow is what keeps the deep
           backswing honest — a near-straight trailing arm reads as a runner, never
           the cocked-claw creep. */
        var armFwd = 0.3 + 0.15 * sp;
        var armBack = 0.3 + (Math.PI / 2 - 0.3) * sp;
        var s0 = -nrm[0], s1 = -nrm[1];
        /* the backswing DWELLS (her 2026-08-19 note: "I don't see the front hand swing
           backwards"). It always reached 90° — but the arm tracked the gait linearly, a
           triangle wave that spends ~25ms/stride near the extreme at full speed, which
           no eye can catch. |s|^0.6 sweeps back fast and HOLDS deep, so the trailing
           arm is a readable phase of the stride, not a spike between two pumps. The
           exponent eases to 1 as sp→0: a walk keeps its quiet symmetric swing. */
        var bp = 1 - 0.4 * sp;
        p.sh = [
          s0 > 0 ? s0 * armFwd : -Math.pow(-s0, bp) * armBack,
          s1 > 0 ? s1 * armFwd : -Math.pow(-s1, bp) * armBack
        ];
        /* the elbow bend keys off FORWARDNESS, not the raw sweep (2026-08-25: "the
           front arm never seems like it moves down... there's a moment where both
           hands should be down"). The old linear ramp held ~58° of flex even with the
           arm straight down, so the hand rode at the waist through the whole transit
           and never visibly dropped. Now the arm is only bent while it is actually
           driving forward — full ~88° at the front extreme, opening to near-straight
           by mid-swing — so the hand falls past the hip on every backswing. And since
           the legs are antiphase, both sweeps cross zero together: once per stride
           both arms hang straight down at the same instant, the beat she asked for. */
        var pump = 1.15 * sp * sp;
        p.el = [0.15 + pump * (0.1 + 1.1 * Math.max(0, -nrm[0])),
                0.15 + pump * (0.1 + 1.1 * Math.max(0, -nrm[1]))];
        /* a runner leans, but from the GROUND, not the waist: the lean is modest and
           the head follows more of it at speed — head-bolt-upright over a tipped torso
           was the posture kink she flagged; a walker stays vertical and self-righting */
        p.lean = 0.02 + 0.16 * sp;
        p.headFollow = 0.5 + 0.25 * sp;
        if (fig.slideT > 0) { p.lean = -0.34; p.headFollow = 1.0; p.hip = [0.9, 0.45]; p.knee = [1.3, 0.9]; p.sh = [-0.7, 0.5]; p.el = [0.3, 0.3]; p.footPitch = null; }
        if (fig.landT > 0) { p.lean = 0.28; p.hip = [0.75, -0.5]; p.knee = [1.5, 1.2]; p.sh = [0.5, -0.6]; p.el = [0.5, 0.5]; p.dy = 9; p.footPitch = null; }
        break;
      }
      case 'air': {
        if (fig.flip) {
          var r = fig.flip.rot;
          p.rot = r;
          var tuck = r > 0.7 && r < Math.PI * 2 - 0.7 ? 1 : Math.min(r, Math.PI * 2 - r) / 0.7;
          p.hip = [1.7 * tuck + 0.2, 1.5 * tuck + 0.1];
          p.knee = [2.1 * tuck + 0.1, 2.0 * tuck + 0.1];
          p.sh = [1.1 * tuck + 0.2, 0.9 * tuck - 0.3];
          p.el = [1.5 * tuck, 1.4 * tuck];
          p.lean = 0.45 * tuck;
          p.headFollow = 1.2;   /* the head tucks INTO the ball */
          p.grin = true;
        } else if (fig.vy < 0) {
          p.hip = [0.55, -0.75]; p.knee = [0.4, 1.3]; p.sh = [-2.6, -2.4]; p.el = [-0.2, -0.3]; p.lean = 0.12;
        } else {
          p.hip = [0.5, -0.25]; p.knee = [0.35, 0.6]; p.sh = [-2.2, 0.7]; p.el = [-0.3, 0.4]; p.lean = 0.08;
        }
        break;
      }
      case 'hang': {
        var h = fig.hang, th = h.th;
        p.rot = 0; p.lean = th * 0.5;
        /* the hands were resolved to real ink in tickHang — glyph bottoms, never the
           empty line box; drawn a hair past the edge so the grip reads as contact */
        p.hands = h.hands || [{ x: h.hx - 5, y: h.bar.y + 0.75 }, { x: h.hx + 5, y: h.bar.y + 0.75 }];
        p.armStretch = 1.6;   // shoulders ride up in a dead hang — see HANG_L
        p.hip = [0.25 + th * 0.6, -0.2 + th * 0.6];
        p.knee = [0.35, 0.3];
        break;
      }
      case 'mantle': {
        var m = fig.mantle;
        p.hands = [{ x: m.x1 - 6 * fig.dir, y: m.y1 + 0.75 }, { x: m.x1 + 2 * fig.dir, y: m.y1 + 0.75 }];
        p.hip = [1.3, 0.6]; p.knee = [1.8, 1.1]; p.lean = 0.5;
        break;
      }
      case 'celeb': {
        var t = fig.celeb.t;
        p.grin = true; p.fingers = 3;
        switch (fig.celeb.name) {
          case 'star': {
            var hop = Math.abs(Math.sin(t * Math.PI * 2));
            p.dy = -hop * 24;
            p.hip = [0.85 * hop + 0.1, -0.85 * hop - 0.1];
            p.knee = [0.08, 0.08];
            p.sh = [-2.5 - 0.5 * hop, 2.5 + 0.5 * hop];
            p.el = [-0.2, 0.2];
            break;
          }
          case 'backflip': {
            var f = Math.min(Math.max((t - 0.12) / 0.76, 0), 1);
            p.rot = -f * Math.PI * 2;
            p.dy = -Math.sin(t * Math.PI) * 52;
            var tk = Math.sin(f * Math.PI);
            p.hip = [1.8 * tk + 0.1, 1.6 * tk + 0.1]; p.knee = [2.1 * tk + 0.1, 2.0 * tk + 0.1];
            p.sh = [1.0 * tk - 0.4, 0.8 * tk - 0.4]; p.el = [1.4 * tk, 1.3 * tk];
            break;
          }
          case 'dance': {
            var w = t * Math.PI * 6;
            p.dy = -Math.abs(Math.sin(w)) * 5;
            p.hip = [0.35 * Math.sin(w), -0.35 * Math.sin(w)];
            p.knee = [0.3 + 0.2 * Math.sin(w), 0.3 - 0.2 * Math.sin(w)];
            p.sh = [-2.4 + Math.sin(w) * 0.9, 2.4 + Math.sin(w + Math.PI) * 0.9];
            p.el = [-0.4, 0.4];
            p.lean = 0.12 * Math.sin(w / 2);
            break;
          }
          case 'cartwheel': {
            p.rot = t < 0.1 ? 0 : Math.min((t - 0.1) / 0.8, 1) * Math.PI * 2;
            p.dy = -Math.sin(t * Math.PI) * 26;
            p.hip = [0.9, -0.9]; p.knee = [0.1, 0.1];
            p.sh = [-2.6, 2.6]; p.el = [0, 0];
            break;
          }
          case 'bow': {
            var bw = Math.sin(Math.min(t / 0.4, 1) * Math.PI / 2) * (t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1);
            p.lean = 1.0 * bw;
            p.headFollow = 1.15;   /* a bow bows the head too */
            p.hip = [0.12, -0.12]; p.knee = [0.1, 0.12];
            p.sh = [1.5 * bw - 0.1, -1.2 * bw + 0.1];
            p.el = [0.7 * bw, 0.2];
            p.dy = 2 * bw;
            break;
          }
        }
        break;
      }
    }
    /* low headroom, in two distinct stages — because the halfway blend of the old
       single fold was exactly the hunched slouch she dislikes:
         · crouch: the KNEES take the height, the back stays proud (a duck-walk)
         · fold:   only genuinely low ceilings pitch the torso into a real crawl,
                   hands down on the ink, head in line with the spine */
    var c = fig.crawl;
    if (c > 0.08 && (fig.state === 'move' || fig.state === 'idle')) {
      var ph2 = ph * 1.4;
      var k = Math.min(c / 0.5, 1), f = Math.max(0, (c - 0.5) / 0.5);
      p.hip = [mix(p.hip[0], 1.0 + 0.22 * Math.sin(ph2), k), mix(p.hip[1], 1.0 - 0.22 * Math.sin(ph2), k)];
      p.knee = [mix(p.knee[0], 1.7, k), mix(p.knee[1], 1.7, k)];
      p.lean = mix(p.lean, 0.16, k);
      /* the arms keep their walking swing through the crouch — the old fixed bent-arm
         carry (sh 0.5, el 0.9) was the sneak; only the true crawl reaches for the ink */
      if (f > 0) {
        var af = Math.min(f / 0.3, 1);
        p.lean = mix(p.lean, 1.45, f);
        p.headFollow = mix(0.5, 1.05, f);
        p.sh = [mix(p.sh[0], 0.5, af), mix(p.sh[1], -0.4, af)];
        p.el = [mix(p.el[0], 0.9, af), mix(p.el[1], 0.9, af)];
        p.hip = [mix(p.hip[0], 1.05 + 0.25 * Math.sin(ph2), f), mix(p.hip[1], 1.05 - 0.25 * Math.sin(ph2), f)];
        p.knee = [mix(p.knee[0], 2.3, f), mix(p.knee[1], 2.3, f)];
        if (f > 0.3) p.hands = [
          { x: fig.x + fig.dir * (13 + 3 * Math.sin(ph2)), y: fig.y + 0.7 },
          { x: fig.x + fig.dir * (19 - 3 * Math.sin(ph2)), y: fig.y + 0.7 }];
      }
    }
    /* every grounded pose is planted — feet (or crawl knees) exactly on the surface.
       Airborne states and the deliberately leaping celebrations are the only exceptions;
       the sign tiptoe plants its own toes. */
    p.snap = fig.state === 'move' || fig.state === 'idle' ||
             ((fig.state === 'wave' || fig.state === 'sign') && !p.tiptoe) ||
             (fig.state === 'celeb' && fig.celeb && fig.celeb.name === 'bow');
    return p;
  }

  /* the drawn region of the LAST frame, so this frame knows what to erase */
  var dirty = null;
  function draw(now) {
    /* the boil ticks at ~6Hz while animating; a resting figure keeps its last seed and
       is perfectly still */
    if (needsLoop()) seed = ((now || performance.now()) / 160) | 0;
    sid = 0;
    /* clear only where ink was or will be. The canvas is viewport-sized now (the
       run-to-the-edge fix), and a full clearRect + recomposite of the whole layer per
       frame is what made him feel laggy on a wide screen — ~6.5M px erased to move a
       60px figure. His wildest pose (flip apex, sign-cheer arms, hang reach) fits in
       ±150 of the pelvis; puffs stretch the box; the union with last frame's box
       erases the old drawing even on a fast drag. */
    var R = CLAY.ready ? 230 : 150;
    /* clay hangs well BELOW fig.y (the hang frames are ~131px from grip to toe; the grip sits only
       67px above fig.y), so the box reaches R down too — at +40 her shins and feet were never erased
       and smeared behind her along the monkey bars (her "leaves body parts behind") */
    var rd = rideDy();
    var b = { x1: fig.x - R, y1: fig.y - LEG - R + Math.min(0, rd), x2: fig.x + R, y2: fig.y + (CLAY.ready ? R : 40) + Math.max(0, rd) };
    for (var pi = 0; pi < puffs.length; pi++) {
      var pf = puffs[pi];
      if (pf.x - 10 < b.x1) b.x1 = pf.x - 10; if (pf.x + 10 > b.x2) b.x2 = pf.x + 10;
      if (pf.y - 10 < b.y1) b.y1 = pf.y - 10; if (pf.y + 10 > b.y2) b.y2 = pf.y + 10;
    }
    var u = dirty ? {
      x1: Math.min(dirty.x1, b.x1), y1: Math.min(dirty.y1, b.y1),
      x2: Math.max(dirty.x2, b.x2), y2: Math.max(dirty.y2, b.y2)
    } : b;
    ctx.clearRect(u.x1, u.y1, u.x2 - u.x1, u.y2 - u.y1);
    dirty = b;
    /* feet planted a hair below the surface line — contact, not hover */
    ctx.save(); ctx.translate(0, rd);   // the whole drawing, so a hang's hands ride with her feet's rule
    puffs.forEach(function (p) {   // (the landing puff rides too: on a lifted line it was 11px under her feet)
      ctx.strokeStyle = ink; ctx.globalAlpha = Math.max(p.t / 0.34, 0) * 0.5; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x - 3, p.y); ctx.lineTo(p.x + 3, p.y); ctx.stroke();
      ctx.globalAlpha = 1;
    });
    figure(fig.x, fig.y - LEG + 0.7, fig.dir, pose());
    ctx.restore();
  }

  /* How far the glyph under his feet has moved off its resting box RIGHT NOW. The
     headline's hover wave (.lively.waving .ch) lifts each letter 7px on a stagger; the
     mask is deliberately not rebuilt for it, so without this he stood mid-air while the
     d dipped out from under him. Render-time offset only — fig.y and the physics keep
     talking to the resting world, and the CSS transition itself supplies the easing in
     both directions. Grounded states only: airborne/hanging/dragged figures answer to
     other math, and the sign-hold stands at the CTA, not on type. */
  /* (2026-10-26) every letter of the bio and eyebrow and the clay tiles too, not just the name, and her HANDS on a
     hang as well as her feet: whatever she touches, she moves with */
  /* ONE smoothed offset, never a letter's own (her 2026-10-26: "it was better before we did the contact point thing"):
     taking the single glyph under her made her drawing jump letter to letter as a hovered line's letters rose on their
     stagger. Now: the mean lift of every letter under her feet's span, eased over a few frames, and exactly 0 while
     nothing under her is lifted */
  var rideS = 0, rideBusy = false;
  /* the nearest thing she could land on within d below her feet: three columns across them, and the floor (#99) */
  function groundBelow(x, y, d) {
    var best = null;
    for (var k = -6; k <= 6; k += 6) { var t = groundTop(x + k, y - 2, d + 2); if (t != null && t >= y - 2 && (best == null || t < best)) best = t; }
    var fa = floorAt(x); return best != null ? best : fa - y <= d ? fa : null;
  }
  function rideTarget() {
    if (!chRide.length || fig.state === 'sign') return 0;
    /* falling onto a lifted (hovered) line, she takes its lift on the way down, not after she lands (#99: she touched
       down, then floated up 8px over five frames) */
    var gl = fig.state === 'air' && fig.vy > 0 ? groundBelow(fig.x, fig.y, 150) : null;
    if (fig.state === 'air' && gl == null) return 0;
    var hg = fig.state === 'hang' && fig.hang, cx = hg ? (hg.hands[0].x + hg.hands[1].x) / 2 : fig.x, cy = hg ? hg.hands[0].y : gl != null ? gl : fig.y;
    var top = null, sum = 0, n = 0;
    for (var i = 0; i < chRide.length; i++) {
      var c = chRide[i];
      if (cx + 12 < c.x1 || cx - 12 > c.x2) continue;
      /* feet (fig.y = the glyph's ink top) must sit inside this glyph's own line box, hands around its bottom —
         otherwise she is on the floor or another line, not on this letter */
      if (hg ? cy < c.y1 - 4 || cy > c.y2 + 8 : cy < c.y1 - 10 || cy > c.y2 + 6) continue;
      if (top == null) top = cv.getBoundingClientRect().top;
      sum += (c.el.getBoundingClientRect().top - top) - c.y1; n++;
    }
    var t = n ? sum / n : 0;
    return Math.abs(t) < .5 ? 0 : t;
  }
  var rideAir = false;
  function rideDy() {
    var t = rideTarget();
    var air = fig.state === 'air';
    rideS = rideAir && !air ? t : rideS + (t - rideS) * (air ? .5 : .25);   // touching down it's exactly the line's lift: no settling on her feet
    rideAir = air;
    if (Math.abs(t - rideS) < .1) rideS = t;
    rideBusy = rideS !== t;
    return rideS;
  }

  /* ------------------------------------------------------------------ boot */
  var rebuildT = 0, rebuildLater = false;
  function queueRebuild() {
    clearTimeout(rebuildT);
    rebuildT = setTimeout(function () {
      if (!booted) return;
      /* off screen, the re-read waits until the hero is back (her 2026-11-04: "i try to scroll and it keeps stopping and
         starting"): the bio's word-by-word write-in asked for one every ~1s while she scrolled down the page, and each
         froze a mid phone for 0.6-1.8s */
      if (!visible) { rebuildLater = true; return; }
      rebuild(); spawnIfLost(); draw();
    }, 160);
  }
  addEventListener('resize', queueRebuild, { passive: true });
  /* night mode repaints the tokens under him — rebuild re-reads --ink-blue so the
     figure doesn't keep standing there in day ink on a night page */
  addEventListener('mk-theme', queueRebuild, { passive: true });
  new ResizeObserver(queueRebuild).observe(hero);
  hero.querySelectorAll('.hero-flora img').forEach(function (im) {
    if (!im.complete) im.addEventListener('load', queueRebuild, { once: true });
  });
  function spawnIfLost() {
    /* the window got narrower and left her past its edge (her 2026-10-27: "when I make the window smaller, my avatar
       disappears"): back home on the d, whatever she was doing */
    if (fig.state === 'enter') { var ex = fig.x, ey = fig.y; spawn(); fig.enter.D = { x: fig.x, y: fig.y }; fig.x = ex; fig.y = ey; fig.state = 'enter'; return; }   // mid-entrance: only where she lands moves
    if (fig.x < 6 || fig.x > W - 6 || fig.y > H + 4) { fig.target = null; fig.waypoint = null; fig.vx = 0; fig.vy = 0; spawn(); return; }
    if (fig.state === 'air' || fig.state === 'hang' || fig.state === 'mantle') return;
    /* her level read across her feet (over a word space or a stem she is NOT lost), or the old one-column check */
    var t = levelAt(fig.x, fig.y), c = groundTop(fig.x, fig.y - 3, 8);
    if ((t == null || Math.abs(t - fig.y) > 5) && (c == null || Math.abs(c - fig.y) > 5)) {
      /* lost: the nearest ground just around her feet, never the top of the hero (a hover's rebuild once put her on the
         name from the bio) */
      var l = groundTop(fig.x, fig.y - 24, H + 40);
      fig.y = l == null ? floorY : l;
    }
  }
  new IntersectionObserver(function (es) {
    visible = es[0].isIntersecting;
    if (visible && rebuildLater) { rebuildLater = false; queueRebuild(); }
    if (visible && needsLoop()) start();
  }, { threshold: 0.05 }).observe(hero);

  /* the hero's cinematic load (build.js) moves things while it plays — the headline
     rises 16px, the buttons 14px — and the mask is built from LIVE rects, so any mask
     baked mid-flight has his terrain in the wrong place. Every settling piece fires
     transitionend on the hero; queueRebuild's debounce collapses the word-by-word
     storm into one rebuild after the last thing stops moving. This also fixes a bug
     older than the fade: the mask used to be built at boot while the handwriting was
     still ~.45em low in its own reveal. .ch transitions are the wave — skipped, or
     every hover of the headline would re-read the world. */
  hero.addEventListener('animationend', function (e) {
    if (e.target && e.target.closest && e.target.closest('.cta-socials')) queueRebuild();   // a clay tile has popped in: it is ground now
  });
  hero.addEventListener('transitionend', function (e) {
    var t = e.target;
    if (!t || !t.classList) return;
    /* allowlist, not blocklist: only the load sequence MOVES terrain. Cosmetic hovers
       (.ch wave, .hs sentence focus) transition the same properties and must not
       trigger a mask re-read on every mouse pass. */
    if (!(t.classList.contains('w') || t.tagName === 'H1' ||
          t.classList.contains('hero-cta-row') || t.classList.contains('hero-flora'))) return;
    if (e.propertyName !== 'transform' && e.propertyName !== 'opacity') return;
    queueRebuild();
  });

  /* the hover wave is pure CSS — no input reaches the canvas, so nothing above would
     wake the rAF loop while the letters (and the figure riding them, see rideDy) move.
     Hovering on or off the headline buys the loop a beat: longest stagger (26ms x the
     glyph count) + the transition itself is well under a second each way. */
  /* …the same for every hover or press in the hero (a bio line lifting, the clay tiles spreading) */
  ['mouseover', 'mouseout', 'pointerdown', 'pointerup'].forEach(function (ev) {
    hero.addEventListener(ev, function (e) {
      if (!booted || (touchMode && ev.indexOf('mouse') === 0)) return;
      if (!e.target.closest || !e.target.closest('h1, .eyebrow, .hero-line, .hero-cta-row')) return;
      rideT = Math.max(rideT, 2.2); start();
    }, { passive: true });
  });

  var booted = false;
  function boot() {
    if (booted) return; booted = true;
    rebuild();
    spawn();
    startEnter();
    draw();
    /* fades the canvas in (see .hero.stick-on in build.js) — he is the last layer of
       the load sequence, arriving after the type he stands on has stopped moving */
    hero.classList.add('stick-on');
    /* hover (or tab onto) ANY say hey! and she waves (her 2026-10-26: "the avatar still isn't waving when I hover over say
       hey"): this used to listen on the hero's own say hey! button, which moved into the nav on 2026-10-24, so it
       silently listened to nothing. Matched by its Calendly link, wherever the button lives */
    var sayHey = function (e) { var a = e.target.closest && e.target.closest('a[href*="calendly"]'); if (a && !a.contains(e.relatedTarget)) waveHello(); };
    document.addEventListener('pointerover', sayHey);
    document.addEventListener('focusin', sayHey);
  }
  /* 2400ms, up from 350: the load sequence owns the first ~2.3s (buttons settle at
     ~2.27s including the .revealed trigger delay), and he spawns standing on the
     headline, which must be AT REST when his world is read */
  /* 2026-10-23: the headline now waves, then SHRINKS while the bio grows (her ask), so she waits for
     that hand-off (app.js fires mk-hero-settled, and sets __mkHeroSettled in case it already did) and
     spawns on the d at the headline's final size. 4.2s is the fail-safe if it never comes. */
  /* (her ask 2026-10-24: "I need the person to load onto the page with I'm MADHU and before the text under") she
     arrives the moment the headline has LANDED (app.js mk-hero-landed, ~1.6s), not after the whole hero has settled;
     the name's load wave then plays under her feet, so the loop runs through it to let her ride the d */
  var bootArmed = false;
  function bootWhenSettled() {
    if (bootArmed) return; bootArmed = true;
    var go = function () { boot(); rideT = 2.6; start(); };
    /* RULE (her 2026-10-27: "the avatar is still loading in before the hi im madhu. its weird to see her floating. she
       should never be floating as a rule"): she appears only once the headline has LANDED, never while it rises and
       never before it shows; and the fail-safe clock starts when the home page loader lifts, not at page load (the
       loader holds until the page has loaded, so a clock from page load spawned her over an invisible headline) */
    if (window.__mkHeroLanded || window.__mkHeroSettled) return go();
    addEventListener('mk-hero-landed', go, { once: true });
    addEventListener('mk-hero-settled', go, { once: true });
    Promise.race([window.__mkBoot || 0, new Promise(function (r) { setTimeout(r, 32000); })]).then(function () { setTimeout(go, 4200); });
  }
  /* never wait on fonts alone: on a slow connection document.fonts.ready can take longer than a visitor stays (device-check
     slow-3g: she never appeared in 20s). Whichever comes first: fonts ready, or 2.5s after this script runs. */
  setTimeout(bootWhenSettled, 2500);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(bootWhenSettled);
  else addEventListener('load', bootWhenSettled);

  /* QA hook — the world plus a synchronous stepper for headless checks (the browser pane
     pauses rAF while hidden, so tests drive time by hand); not a public API */
  window.__stick = {
    fig: fig, bars: function () { return bars; }, step: advance, draw: draw,
    plan: function (x, y) { return planRoute(x, y); },
    clayH: function () { return CLAY.ready ? CLAY.H : 0; },
    sound: function () { return { ctx: SFX.ctx ? SFX.ctx.state : null, buf: SFX.buf }; },   // QA: is the sound context awake, and the decoded clips (to tell which one played)
    clay: function () { var k = CLAY.pk || {}; return { f: CLAY.last && CLAY.last.f.f, lean: k.lean || 0, rot: k.rot || 0, spin: k.spin || 0, miss: CLAY.miss || 0, moveReady: !!CLAY.moveReady, sheets: Object.keys(CLAY.sheetIn || {}) }; },   // QA: the frame drawn last and every rotation on it
    canvas: function () { return cv; },
    pts: function () { return CLAY.pts; },   // QA: where a hands-anchored frame was pinned
    rig: function () { return rig(); },
    hangRise: function (i, x, y) { return hangRise(bars[i], x, y); },   // QA: the jump that would hang her from bar i at x, from feet y
    hide: function (on) { fig.hidden = !!on; draw(performance.now()); if (on) { fig.target = null; fig.waypoint = null; fig.vx = 0; } },
    solid: function (x, y) { return solid(x, y); },
    groundTop: function (x, y) { return groundTop(x, y, H); },
    floor: function () { return { y: floorY, x1: floorX1, x2: floorX2, w: W, ramp: ramp && { x1: ramp.x1, x2: ramp.x2, eL: ramp.eL, eR: ramp.eR, topL: ramp.topL, topR: ramp.topR, limL: ramp.limL, limR: ramp.limR } }; },   // QA: the divider she runs on, and its ends (and its curved ends, if drawn)
    go: function () { start(); }, reach: function () { return reach(); }, floorAt: function (x) { return floorAt(x); }, tilt: function (k) { if (k != null) SLOPE_TILT = k; return slopeA; }, drop: function () { return footDrop(fig.x, slopeA); },   // QA: the line's top at x; the slope tilt (0 = upright)
  };
})();
