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
   alone. Only reduced motion never boots it: there the CTA stays an ordinary button. */
(function () {
  'use strict';
  var hero = document.querySelector('.hero');
  if (!hero) return;
  var fine = matchMedia('(hover: hover) and (pointer: fine)');
  var prefersRM = matchMedia('(prefers-reduced-motion: reduce)');
  if (prefersRM.matches) return;
  var touchMode = !fine.matches;
  var rmActive = function () { return prefersRM.matches || document.body.classList.contains('rm-mode'); };

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
  var WALK = 120, RUN = 360, DRAGMAX = 640;
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
  var W = 0, H = 0, DPR = 1, floorY = 0;
  var S = 0.5, W2 = 0, H2 = 0, md = null;
  var mk = document.createElement('canvas');
  var bars = [];
  var chRide = [];               // headline glyphs' RESTING boxes — see rideDy()
  var sign = null;               // {cx, bottom} — the say-hey board he holds up
  var ink = '#3C6B76';

  function localRect(el, hr) {
    var r = el.getBoundingClientRect();
    return { x1: r.left - hr.left, x2: r.right - hr.left, y1: r.top - hr.top, y2: r.bottom - hr.top, w: r.width, h: r.height };
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

  function rebuild() {
    /* the stage is the CANVAS box, not the hero box — the canvas runs the full viewport
       width (see .hero>.stick-cv in build.js) while the hero section is capped at 1240px;
       measuring the hero here is exactly what used to end his world mid-page on wide
       screens. All terrain rects stay relative to this same origin, so the mask and the
       figure agree about where everything is. */
    var hr = cv.getBoundingClientRect();
    if (hr.width < 40) return;
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = hr.width; H = hr.height;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    dirty = null;   /* resizing the bitmap wiped the canvas — nothing left to erase */
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ink = (getComputedStyle(document.documentElement).getPropertyValue('--ink-blue') || '#3C6B76').trim();
    floorY = H - 14;

    W2 = Math.max(1, Math.ceil(W * S)); H2 = Math.max(1, Math.ceil(H * S));
    mk.width = W2; mk.height = H2;
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
    hero.querySelectorAll('h1 .ch').forEach(function (el) {
      if (!el.textContent.trim()) return;
      var cr = localRect(el, hr);
      chRide.push({ el: el, x1: cr.x1, x2: cr.x2, y1: cr.y1, y2: cr.y2 });
    });
    var words = hero.querySelectorAll('.eyebrow .w, .hero-line .w');
    if (!words.length) words = hero.querySelectorAll('.eyebrow, .hero-line .hs');
    words.forEach(function (el) { maskText(g, el, hr); });
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
    /* …and on phones the clay tiles that pop out of say hey! (her ask 2026-10-24: "I want to be able to jump on top of
       the claymation icons too"), while they're out */
    hero.querySelectorAll('.jb-logo.rest, .hero-cta-row.socials-open .cta-socials a').forEach(function (b) {
      var r = localRect(b, hr); if (r.w) g.fillRect(r.x1 + 3, r.y1 + 3, r.w - 6, r.h - 3);
    });

    md = g.getImageData(0, 0, W2, H2).data;

    /* monkey bars: the undersides of the copy blocks (reachable from the floor with one
       hop, so the hang is discoverable) and the headline baseline */
    bars = [];
    /* a bar under EVERY line of the bio, not just under the block (her ask 2026-10-23: hang under all the words):
       the words are grouped into visual lines by where they sit, so a wrapped sentence gives two bars */
    var rows = [];
    hero.querySelectorAll('.hero-line .w').forEach(function (w) {
      var r = localRect(w, hr); if (!r.w || !w.textContent.trim()) return;
      var row = rows.filter(function (q) { return Math.abs(q.y1 - r.y1) < r.h * .5; })[0];
      if (row) { row.x1 = Math.min(row.x1, r.x1); row.x2 = Math.max(row.x2, r.x2); row.y2 = Math.max(row.y2, r.y2); }
      else rows.push({ x1: r.x1, x2: r.x2, y1: r.y1, y2: r.y2 });
    });
    rows.forEach(function (q) { bars.push({ x1: q.x1, x2: q.x2, y: q.y2 - 2, top: q.y1 }); });   // top: the line box's, for the muscle-up
    var eb = hero.querySelector('.eyebrow');
    if (eb) { var er = localRect(eb, hr); bars.push({ x1: er.x1, x2: er.x2, y: er.y2 - 2, top: er.y1 }); }
    var h1 = hero.querySelector('h1');
    if (h1) { var hb = localRect(h1, hr); bars.push({ x1: hb.x1, x2: hb.x2, y: hb.y2 - 6, top: hb.y1 }); }

    var btn = hero.querySelector('.hero-cta-row .btn.solid');
    sign = null;
    if (btn) {
      var sr = localRect(btn, hr);
      sign = { cx: sr.x1 + sr.w / 2, bottom: sr.y2 };
    }
  }

  /* mask queries — CSS px in, CSS px out. The floor line is solid everywhere. */
  function solid(x, y) {
    if (y >= floorY) return true;
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    return md[(((y * S) | 0) * W2 + ((x * S) | 0)) * 4 + 3] > 60;
  }
  /* from yStart, find the next surface top at or below it (the y where ink begins) */
  function groundTop(x, yStart, maxScan) {
    var y = Math.round(yStart), n = 0, cap = maxScan || 260;
    while (!solid(x, y) && n < cap) { y++; n++; }
    if (n >= cap) return null;
    while (solid(x, y - 1) && y > 0) y--;
    return y;
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
    landT: 0, slideT: 0,
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
  var CELEBS = ['star', 'backflip', 'cartwheel', 'bow'];   // the dance is out of the rotation (her call 2026-10-24: she didn't like how it looks)
  function celebrate() {
    if (fig.state === 'air' || fig.state === 'hang' || fig.state === 'mantle') return;
    fig.target = null; fig.waypoint = null; fig.vx = 0;
    var name = CELEBS[fig.celebIdx % CELEBS.length];
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
  function waveHello() {
    if (rmActive()) return;
    if (fig.state === 'idle' || fig.state === 'sign' || (fig.state === 'move' && !fig.target && !fig.drag)) {
      fig.prev = fig.state === 'sign' ? 'sign' : 'idle';
      fig.state = 'wave'; fig.wave = 0;
      start();
    }
  }

  /* ------------------------------------------------------------------ input */
  var down = null;
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
    /* her ask: hover over clay-her and she smiles (the standing frame swaps to its smile twin) */
    var sm = !touchMode && CLAY.ready && onClay(p);
    /* …and as the cursor arrives on her she WAVES with one hand, smiling (her ask 2026-10-24), then keeps smiling
       while you stay; the same wave she gives the say-hey button. Once per arrival. */
    if (sm && !CLAY.smile) waveHello();
    if (sm !== CLAY.smile) { CLAY.smile = sm; if (!raf) draw(performance.now()); }
    /* drag never arms on touch — a moving finger on the hero is the page scrolling */
    if (!touchMode && down && !down.moved && Math.hypot(p.x - down.x, p.y - down.y) > 10) { down.moved = true; hero.classList.add('stick-dragging'); }
    if (down && down.moved && !rmActive()) {
      var dx = p.x - down.x, dy = p.y - down.y;
      fig.drag = { vx: Math.max(-DRAGMAX, Math.min(DRAGMAX, dx * 2.6)), up: dy < -70 ? -dy : 0 };
      fig.target = null; fig.waypoint = null;
      if (fig.state === 'idle' || fig.state === 'sign' || fig.state === 'celeb' || fig.state === 'wave') { fig.state = 'move'; fig.celeb = null; }
      start();
    }
  }, { passive: true });
  /* cursor left the window: forget where it was, or she keeps smiling at nobody */
  document.addEventListener('pointerout', function (e) { if (!e.relatedTarget) { CLAY.away = true; CLAY.smile = false; if (!raf && CLAY.ready) draw(performance.now()); } });
  document.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || rmActive()) return;
    if (e.target.closest && e.target.closest('a,button,nav')) return;
    var p = stagePoint(e);
    if (p.x < 0 || p.x > W || p.y < 0 || p.y > H) return;
    down = Object.assign(p, { t: performance.now(), moved: false });
  }, { passive: true });
  /* a touch the browser reclaims for scrolling ends in pointercancel, not pointerup —
     without this a scroll leaves a stale `down` behind */
  addEventListener('pointercancel', function () { hero.classList.remove('stick-dragging'); down = null; fig.drag = null; });
  addEventListener('pointerup', function (e) {
    hero.classList.remove('stick-dragging');
    if (!down) { fig.drag = null; return; }
    var wasDrag = down.moved; down = null;
    if (rmActive()) { fig.drag = null; return; }
    if (wasDrag) {
      if (fig.drag && fig.drag.up && fig.state === 'move') {
        fig.vy = -Math.min(Math.sqrt(2 * G * Math.min(fig.drag.up * 1.6, JUMP_MAX)), 1210);
        fig.fallFrom = fig.y; fig.state = 'air';
        if (Math.abs(fig.vx) > 420) startFlip(Math.sign(fig.vx) || fig.dir);
      }
      fig.drag = null;
      start();
      return;
    }
    fig.drag = null;
    var p = stagePoint(e);
    if (p.x < 0 || p.x > W || p.y < 0 || p.y > H) return;
    var pelY = fig.y - LEG * (1 - fig.crawl * 0.6);
    /* the clay figure is bigger than the stick one, so tapping anywhere on her body counts */
    var onHer = CLAY.ready ? onClay(p) : Math.hypot(p.x - fig.x, p.y - (pelY - TO / 2)) < 46;
    if (onHer) {
      if (fig.state === 'hang') release(0);
      celebrate();
      return;
    }
    if (fig.state === 'hang') {
      /* a click on or above the line she's holding: she MUSCLES UP onto it (her ask 2026-10-24) and then goes on to
         where you clicked; anywhere else she lets go toward it */
      if (p.y < fig.hang.bar.y && muscleUp()) {
        var gy = groundTop(p.x, p.y - 2, H);
        if (gy != null && gy <= fig.mantle.y1 + 4) fig.target = { x: p.x, y: gy, tries: 0 };
        return;
      }
      release(Math.sign(p.x - fig.x)); return;
    }
    if (e.target.closest && e.target.closest('a,button')) return;
    /* the click means: the first ink at or below where you clicked */
    var ty = groundTop(p.x, p.y - 2, H);
    /* reach: only a tap RIGHT ABOVE her asks for a hop; tapping somewhere to walk or run to is just that, a walk (her:
       "why does it always jump when I tap to make it walk or run in a direction") */
    var overHead = Math.abs(p.x - fig.x) < 50 && p.y < fig.y - CLAY.H * .6;
    fig.target = { x: p.x, y: ty == null ? floorY : ty, tries: 0, reach: overHead ? { x: p.x, y: p.y } : null };
    fig.waypoint = null;
    if (fig.state === 'idle' || fig.state === 'sign' || fig.state === 'celeb' || fig.state === 'wave') { fig.state = 'move'; fig.celeb = null; }
    start();
  });

  function startFlip(dir) {
    var t = Math.max(2 * Math.abs(fig.vy) / G, 0.45);
    fig.flip = { rot: 0, w: (Math.PI * 2) / t, dir: dir || fig.dir };
  }
  function release(dirX) {
    if (!fig.hang) return;
    var b = fig.hang;
    fig.state = 'air';
    fig.x = b.hx;   /* fig.y already tracks the grips — reassigning it here would pop */
    fig.vx = dirX * 220 + b.om * 40;
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
    /* the top of the ink of the line she holds, nearest her hands: scanned down from the line box's top (the stroke
       right above a hand can be a broken fragment of a small letter, so "the top of that stroke" isn't the top) */
    var b = h.bar, hy = Math.min(h.hands[0].y, h.hands[1].y), cx = (h.hands[0].x + h.hands[1].x) / 2, hx = null, top = null;
    if (b.top == null) return false;
    for (var k = 0; k <= 24 && hx == null; k++) {
      var x = cx + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 2, t = groundTop(x, b.top, Math.max(1, hy - b.top));
      if (t != null && t < hy - 8 && clearance(x, t) >= MIN_CLR) { hx = x; top = t; }
    }
    if (hx == null) return false;
    fig.state = 'mantle';
    fig.mantle = { t: 0, x0: fig.x, y0: fig.y, x1: hx, y1: top, dur: 0.85, hy0: hy };
    fig.hang = null; fig.hangCool = 0.6; fig.vx = 0; fig.vy = 0; fig.flip = null;
    fig.target = null; fig.waypoint = null; fig.celeb = null;
    sfx('jump', 0.3, 1.05);
    start();
    return true;
  }

  /* ------------------------------------------------------------------ physics */
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
  function planRoute(tx, ty) {
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
    var walkTo = function (a, b) { return Math.abs(a.c - b.c) === 1 && b.y >= a.y - STEP_UP && b.y <= a.y + STEP_DOWN; };
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
          else if (b === under && Math.abs(d) <= 12 && [1, 2].every(function (k) { return !(cols[a.c + k * Math.sign(d)] || []).some(function (m) { return Math.abs(m.y - a.y) <= STEP_DOWN; }); }))   // a real gap (her stride spans a letter gap)
            out.push({ n: b, how: 'fall', cost: adx + 25 });   // off an edge (nothing walkable that way), down to the first surface
          else if (rise <= JUMP_MAX + 50 && adx <= 180 && (rise <= 0 || openAbove(a.x, a.y, rise + 30))   // + her reach to a ledge; clear air above the take-off
                   && openAbove(b.x, b.y, b.y - Math.min(a.y, b.y) + 30))   // and she comes down onto it from above: open sky over the landing
            out.push({ n: b, how: 'jump', cost: adx + Math.max(0, rise) * 1.2 + 90 });
        });
      }
      return out;
    };
    var dist = {}, prev = {}, done = {}, open = [start];
    dist[start.i] = 0;
    while (open.length) {
      var bi = 0; for (var j = 1; j < open.length; j++) if (dist[open[j].i] < dist[open[bi].i]) bi = j;
      var a = open.splice(bi, 1)[0]; if (done[a.i]) continue; done[a.i] = true;
      edges(a).forEach(function (e) { var nd = dist[a.i] + e.cost;
        if (dist[e.n.i] == null || nd < dist[e.n.i]) { dist[e.n.i] = nd; prev[e.n.i] = { from: a, how: e.how }; open.push(e.n); } });
    }
    /* the click if she can reach it, else the closest spot she can (and the cheaper way there on a tie) */
    var goal = null, gs = Infinity;
    nodes.forEach(function (n) { if (dist[n.i] == null) return; var sc2 = Math.hypot(n.x - tx, (n.y - ty) * 1.5) + dist[n.i] * .02;
      if (sc2 < gs) { gs = sc2; goal = n; } });
    if (!goal || goal === start) return [];
    var path = [];
    for (var n2 = goal; n2 !== start; n2 = prev[n2.i].from) path.unshift({ x: n2.x, y: n2.y, how: prev[n2.i].how, dir: Math.sign(n2.x - prev[n2.i].from.x) || 1 });
    /* keep only the points where the way of moving changes, plus the end: a walk is one stretch */
    return path.filter(function (q, i) { return i === path.length - 1 || q.how !== 'walk' || path[i + 1].how !== 'walk'; });
  }
  /* WHERE YOU TAP IS WHERE SHE TRIES TO GO (her ask 2026-10-24: "if I double tap or single tap above the person can you
     make them jump"): a tap remembers the exact spot; once she's as close as walking and climbing get her and the spot
     is still above her, she jumps up at it, and with no target left she can catch any text up there and hang */
  function arrived() {
    var r = fig.target && fig.target.reach;
    fig.target = null; fig.waypoint = null; fig.vx = 0;
    if (!r || r.y > fig.y - 30) return;
    /* a calm hop toward the finger, not a grab-and-swing (her: "the person is too too much when I tap") */
    var up = Math.min(fig.y - r.y, 90);
    fig.vy = -Math.sqrt(2 * G * (up + 10)); fig.vx = Math.max(-120, Math.min(120, (r.x - fig.x) * 2));
    fig.dir = r.x >= fig.x ? 1 : -1; fig.fallFrom = fig.y; fig.state = 'air'; fig.hangCool = 1.2; fig.flipQueued = true;
    start();
  }
  function routeJump(b) {
    var rise = fig.y - b.y, dx = b.x - fig.x;
    var up = Math.min(Math.max(rise, 0) + 34 + Math.min(40, Math.abs(dx) * .15), 330);   // ~the old 1210px/s cap
    var vy0 = Math.sqrt(2 * G * up), T = vy0 / G + Math.sqrt(2 * (up - rise) / G);
    fig.vy = -vy0; fig.vx = dx / T; fig.fallFrom = fig.y; fig.state = 'air'; fig.waypoint = b;
    fig.dir = dx >= 0 ? 1 : -1; fig.flipQueued = true;   // a plain jump on the way somewhere: no flip (only the cloud gets one)
  }
  /* one tick of following the route; returns the speed she wants, or null when this tick is spent */
  function followRoute(dt) {
    var tg = fig.target, wp = tg.route[0];
    /* a walk point counts within a step's height (she walks the surface between them); a jump/drop must land on it */
    if (Math.abs(wp.x - fig.x) < 7 && Math.abs(fig.y - wp.y) <= (wp.how === 'walk' ? STEP_UP + 6 : 14)) {
      tg.route.shift(); tg.best = Infinity; tg.stuck = 0;
      if (!tg.route.length) { arrived(); return null; }
      wp = tg.route[0];
      if (wp.how === 'jump') { routeJump(wp); return null; }
    }
    fig.waypoint = wp;
    if (Math.abs(wp.x - fig.x) < 7) {
      /* a drop: keep walking the way it goes until the ground runs out */
      if (wp.how === 'fall' && fig.y < wp.y) return wp.dir * WALK;
      /* right column, wrong level (a missed ledge): plan again from here at once, never shuffle on the spot */
      tg.route = null; return null;
    }
    /* no progress toward this point for a while (a bonk, a missed ledge): plan again from here */
    var d = Math.abs(wp.x - fig.x) + Math.abs(wp.y - fig.y);
    if (d < tg.best - 4) { tg.best = d; tg.stuck = 0; } else if ((tg.stuck += dt) > .8) { tg.route = null; return null; }
    var dx = wp.x - fig.x;
    return Math.sign(dx) * (WALK + (RUN - WALK) * Math.min(Math.abs(dx) / 120, 1));
  }

  function tickGround(dt) {
    fig.flipQueued = false;
    if (fig.landT > 0 && !fig.drag) { fig.vx = 0; return; }   // the landing crouch holds still, then she sets off
    var want = 0;
    var g = fig.waypoint || fig.target;
    if (fig.drag) { want = fig.drag.vx; }
    else if (fig.target && !fig.target.manual) {
      var tg = fig.target;
      if (!tg.route) {
        if ((tg.plans = (tg.plans || 0) + 1) > 4) { fig.target = null; fig.waypoint = null; fig.vx = 0; return; }   // she tried; she stops
        var r = planRoute(tg.x, tg.y);
        if (r == null) tg.manual = true;   // can't place her on the map (mid-step): the old greedy way, this once
        else if (!r.length) { arrived(); return; }   // already as close as she can get
        else { tg.route = r; tg.best = Infinity; tg.stuck = 0; if (r[0].how === 'jump' && Math.abs(r[0].x - fig.x) > 0) { routeJump(r[0]); return; } }
      }
      if (tg.route) { var rw = followRoute(dt); if (rw === null) return; want = rw; }
    }
    if (!fig.drag && fig.target && fig.target.manual) {
      var dx = g.x - fig.x;
      var far = Math.min(Math.abs(dx) / 120, 1);
      want = Math.sign(dx) * (WALK + (RUN - WALK) * far);
      /* near enough on the same bump of ink counts as arrived — waypoint or not */
      if (Math.abs(fig.target.x - fig.x) < 40 && Math.abs(fig.y - fig.target.y) < 26) { arrived(); return; }
      if (Math.abs(dx) < 8) {
        var dyP = fig.y - g.y;
        if (Math.abs(dyP) <= 12) {
          if (fig.waypoint) fig.waypoint = null;
          else { fig.target = null; want = 0; }
        } else if (dyP > 12 && fig.target.tries < 24) {
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
        } else if (dyP < -12 && fig.target.tries < 24) {
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

    fig.vx += (want - fig.vx) * Math.min(1, dt * 9);
    if (Math.abs(fig.vx) < 6 && !fig.target && !fig.drag) {
      fig.vx = 0;
      if (fig.state === 'move') fig.state = 'idle';
      return;
    }
    if (fig.vx) fig.dir = fig.vx > 0 ? 1 : -1;
    var nx = Math.max(10, Math.min(W - 10, fig.x + fig.vx * dt));
    /* follow the ink's surface: a step either way is walked, not fallen */
    var s = groundTop(nx, fig.y - STEP_UP, STEP_UP + STEP_DOWN + 4);
    if (s != null && s >= fig.y - STEP_UP - 0.5 && s <= fig.y + STEP_DOWN + 0.5 && clearance(nx, s) >= MIN_CLR) {
      fig.x = nx; fig.y = s;
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
    /* nothing to stand on ahead: walk off the edge and fall */
    fig.x = nx;
    fig.state = 'air'; fig.vy = 0; fig.fallFrom = fig.y;
  }

  function tickAir(dt) {
    fig.vy = fig.boxJump && fig.boxJump.g ? Math.min(fig.vy + fig.boxJump.g * dt, 2600) : Math.min(fig.vy + G * dt, 1500);
    var g = fig.waypoint || fig.target;
    /* steer proportionally, not at full run — the dot of an i is a small landing pad */
    var want = fig.drag ? fig.drag.vx : (g ? Math.max(-RUN, Math.min(RUN, (g.x - fig.x) * 3)) : fig.vx);
    fig.vx += (want - fig.vx) * Math.min(1, dt * 2.2);
    var nx = Math.max(10, Math.min(W - 10, fig.x + fig.vx * dt));
    var ny = fig.y + fig.vy * dt;
    if (fig.flip) {
      fig.flip.rot += fig.flip.w * dt;
      if (fig.flip.rot >= Math.PI * 2) fig.flip = null;
    } else if (fig.vy >= 0 && !fig.flipQueued && !fig.target) {   // no showy flips on the way to a tap
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
    /* monkey-bar grab — never while chasing a click; bars serve free-form leaps */
    if (!fig.flip && !fig.boxJump && !fig.dropping && fig.vy < 160 && !fig.hangCool && !fig.target) {   // never grabs a bar mid box-jump, or while dropping out of the burst cloud
      var handY = ny - LEG - HANDUP;
      /* hands within 15px below a bar, or up to 70px above it: clay-her is taller than the gaps in the hero, so on "Hi"
         her hands already start above the eyebrow, and on the second bio sentence they start ~54px above the first
         one's underside (2026-10-23 "my claymation isn't hanging on the top text"; 2026-10-24 "hang off the top
         sentence as well"). Of the bars in reach, the one nearest her hands wins; it must have real ink to hold. */
      var best = null;
      for (var i = 0; i < bars.length; i++) {
        var b = bars[i], dh = handY - b.y;
        if (nx < b.x1 - 4 || nx > b.x2 + 4 || dh >= 15 || dh <= -70) continue;
        if (best && Math.abs(dh) >= Math.abs(best.dh)) continue;
        var gp = grip(nx, b.y, 14);   // a word gap is not a bar
        if (gp) best = { b: b, gp: gp, dh: dh };
      }
      if (best) {
        fig.state = 'hang';
        fig.hang = { bar: best.b, hx: nx, th: Math.max(-0.9, Math.min(0.9, fig.vx / 500)), om: fig.vx / 160, reach: 0,
                     hands: [{ x: best.gp.x - 2, y: best.gp.y + 1.75 }, { x: best.gp.x + 2, y: best.gp.y + 1.75 }] };
        fig.vx = 0; fig.vy = 0; fig.flip = null;
        return;
      }
    }
    /* edge mantle: moving into ink whose top is at hand height → climb its lip. Never
       when the goal is BELOW us — mantling up is the opposite of a descent, and it can
       intercept the very landing the route is falling toward. */
    var gA = fig.waypoint || fig.target;
    if (fig.vx && !fig.boxJump && !(gA && gA.y > ny - 10)) {
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
    if (!fig.boxJump && solid(nx, Math.min(ny, fig.y) - 6) && !solid(fig.x, Math.min(ny, fig.y) - 6)) { nx = fig.x; fig.vx = 0; }   // (never the cloud jump: its arc flies through the copy by design)
    if (fig.vy > 0) {
      var land = groundTop(nx, fig.y + 0.5, Math.max(2, ny - fig.y + 2));
      if (land != null && land >= fig.y - 2 && land <= ny + 0.5 && clearance(nx, land) >= MIN_CLR) {   // never lands ABOVE her feet
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
        fig.state = (fig.target || fig.drag) ? 'move' : 'idle';
        if (fig.vy > 620 || drop > 130) { fig.landT = 0.18; puff(fig.x, fig.y, 4); }
        /* the SLAM: a long crouch, a bigger puff, and the cloud hears it. ANY landing on the cloud counts, not only the
           jump its click sends (her: "nothing happens when I jump on the cloud" — she'd hopped onto it herself) */
        if (fig.boxJump) { fig.boxJump = null; fig.landT = 0.36; puff(fig.x, fig.y, 11); }   // the SLAM: deep crouch, big puff
        fig.dropping = false;
        fig.vy = 0;
        fig.vx = 0;   // she LANDS: no skid on into the next spot (her: "when it lands it keeps moving … it slides")
        return;
      }
    }
    fig.x = nx; fig.y = Math.min(ny, floorY);
    /* only when coming DOWN: a jump launched from the floor sits on it for its first (zero-length) frame, and this used to
       cancel it on the spot — why a second jump at the cloud, from the floor, sometimes never left the ground */
    if (fig.y >= floorY && fig.vy >= 0) { fig.state = (fig.target || fig.drag) ? 'move' : 'idle'; fig.vy = 0; fig.flip = null; fig.dropping = false; }
  }

  function tickHang(dt) {
    var h = fig.hang, b = h.bar;
    var mdx = mouse.x - h.hx;
    h.om += (-(G / 90) * Math.sin(h.th) - 1.1 * h.om + Math.max(-3, Math.min(3, mdx / 60))) * dt;
    h.th += h.om * dt;
    var tv = Math.abs(mdx) < 26 ? 0 : Math.max(-170, Math.min(170, mdx * 2.4));
    h.hx += tv * dt;
    h.reach = tv ? (h.reach + dt * 6) % (Math.PI * 2) : 0;
    if (h.hx < b.x1 - 4 || h.hx > b.x2 + 4) {
      var dir = tv > 0 || h.om > 0 ? 1 : -1;
      var next = null;
      bars.forEach(function (nb) {
        if (nb === b || Math.abs(nb.y - b.y) > 16) return;
        var gap = dir > 0 ? nb.x1 - b.x2 : b.x1 - nb.x2;
        if (gap > -30 && gap < 52 && (!next || gap < next.gap)) next = { bar: nb, gap: gap };
      });
      if (next) { h.bar = next.bar; b = h.bar; }
      else { release(dir); return; }
    }
    /* the hands hold LETTERS, not the line box: resolve each to the nearest real ink.
       Crossing a word gap, the trailing hand keeps the last letter while the leading one
       reaches for the next — and if neither can find ink, there is nothing to hold. */
    var spread = 5 + (h.reach ? 3 * Math.sin(h.reach) : 0);
    var gl = grip(h.hx - spread, b.y, 30), gr = grip(h.hx + spread, b.y, 30);
    if (!gl && !gr) { release((tv || h.om) > 0 ? 1 : -1); return; }
    /* one hand found nothing (a word gap): both hands share the one real hold */
    if (!gl) gl = gr;
    if (!gr) gr = gl;
    h.hands = [{ x: gl.x, y: gl.y + 1.75 }, { x: gr.x, y: gr.y + 1.75 }];
    fig.x = h.hx;
    /* body hangs from the grips themselves, so it rides up under tall glyphs */
    fig.y += ((gl.y + gr.y) / 2 + HANG_L + LEG - fig.y) * Math.min(1, dt * 10);
    fig.dir = (tv || h.om) > 0 ? 1 : -1;
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
    fig.x = m.x0 + (m.x1 - m.x0) * e;
    fig.y = m.y0 + (m.y1 - m.y0) * e - Math.sin(m.t * Math.PI) * 14;
  }

  function puff(x, y, n) {
    for (var i = 0; i < n; i++) puffs.push({ x: x + (Math.sin(i * 2.4) * 8), y: y - 2, vx: (i % 2 ? 1 : -1) * (24 + i * 9), vy: -18 - i * 6, t: 0.34 });
  }

  /* ------------------------------------------------------------------ the rAF driver */
  var raf = 0, last = 0;
  var rideT = 0;   // seconds of rAF kept alive so a CSS-only glyph wave still animates him
  function needsLoop() {
    return fig.state !== 'idle' && fig.state !== 'sign' || fig.target || fig.drag || puffs.length || fig.landT > 0 || fig.slideT > 0 || rideT > 0;
  }
  /* the moment she is STANDING on the cloud — however she got there: its click-jump, a hop, a climb up its edge, a walk
     across — the cloud hears the slam (her: "nothing happens when I jump on the cloud") */
  function cloudCheck() {
    var jbEl = hero.querySelector('.jump-box:not(.gone)'), on = false;
    if (jbEl && (fig.state === 'idle' || fig.state === 'move')) {
      var jr = localRect(jbEl, cv.getBoundingClientRect());
      on = fig.x >= jr.x1 + 4 && fig.x <= jr.x2 - 4 && Math.abs(fig.y - (jr.y1 + jr.h * .12)) < 6;
    }
    if (on && !fig.onCloud) { if (!fig.landT) { fig.landT = 0.32; puff(fig.x, fig.y, 7); } dispatchEvent(new CustomEvent('mk-box-slam')); }
    fig.onCloud = on;
  }
  /* her sounds (Flora / ElevenLabs SFX, 2026-10-24, beside the cloud's squish/pop/clonk): a soft FOOTSTEP on the very
     clay frames where a foot lands (her ask: "the running sound echoes the footsteps"), a push-off WHOOSH whenever she
     launches upward, a THUD when she lands, a GRIP when her hands catch a bar. Tried and cut, her calls: sneaker squeaks, a boing jump
     ("makes me think something is bouncing"), a creaky-bar grab. Browsers keep them silent until the visitor's first click. */
  var SFX = (function () {
    var base = (document.querySelector('script[src*="stick.js"]') || {}).src || '';
    var dir = base.replace(/stick\.js.*$/, '') + 'assets/sfx/', ver = (base.match(/\?v=[^&#]*/) || [''])[0], a = {};
    ['step', 'jump', 'grip', 'land'].forEach(function (n) { try { a[n] = new Audio(dir + n + '.mp3' + ver); a[n].preload = 'auto'; } catch (e) {} });
    return a;
  })();
  function sfx(n, vol, rate) {
    if (!SFX[n] || rmActive()) return;
    try { var c = SFX[n].cloneNode(); c.volume = vol; c.playbackRate = rate || 1; c.preservesPitch = false;
      var p = c.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
  }
  /* the heel strikes, read off the frames themselves: the walk's two widest-stride frames, and the run's two frames
     where the foot drops lowest after the flight */
  var STRIKES = { 'walk-x3': [10, 34], 'run-x3': [21, 44] };
  var sfxWas = null, stepS = null, stepK = 0, fallV = 0, leapt = false;
  function sfxTick() {
    var st = fig.state, sp = Math.abs(fig.vx || 0);
    if (st !== sfxWas) {
      if (st === 'air' && fig.vy < -300) { sfx('jump', 0.35, 0.95 + Math.random() * 0.1); leapt = true; }   // a launch, not a fall off an edge
      if (st === 'hang') sfx('grip', 0.4);
      /* a landing THUD, firmer for a longer fall; and ALWAYS after a jump (her ask: "a sound when I land on something I
         jumped on" — landing up on a ledge comes in slow, near the top of the arc) */
      if ((sfxWas === 'air' || sfxWas === 'mantle') && (st === 'move' || st === 'idle') && (fallV > 150 || leapt)) sfx('land', Math.min(0.5, 0.2 + Math.max(0, fallV) / 3000), 0.95 + Math.random() * 0.1);
      if (st !== 'air' && st !== 'mantle') leapt = false;
      sfxWas = st;
    }
    if (st === 'air') fallV = fig.vy || 0;
    /* the same sheet and frame clayPick draws: each strike frame passed since the last tick is one footstep */
    var sh = st === 'move' && sp >= 12 && !fig.landT && !fig.slideT ? (sp > 230 ? 'run-x3' : 'walk-x3') : null;
    var k = sh ? Math.floor(CLAY.dist / (sh === 'run-x3' ? 3 : 1.83)) % 48 : 0;
    if (sh && sh === stepS)
      for (var j = stepK; j !== k; j = (j + 1) % 48)
        if (STRIKES[sh].indexOf((j + 1) % 48) >= 0) { sfx('step', sh === 'run-x3' ? 0.32 : 0.22, 0.92 + Math.random() * 0.16); break; }
    stepS = sh; stepK = k;
  }

  function advance(dt) {
    sfxTick();   // first: a launch set by a click or last frame's hop still has its full upward speed
    cloudMagnet();
    cloudCheck();
    rideT = Math.max(0, rideT - dt);
    fig.landT = Math.max(0, fig.landT - dt);
    fig.slideT = Math.max(0, fig.slideT - dt);
    if (fig.state === 'move' || fig.state === 'idle') tickGround(dt);
    else if (fig.state === 'air') tickAir(dt);
    else if (fig.state === 'hang') tickHang(dt);
    else if (fig.state === 'mantle') tickMantle(dt);
    else if (fig.state === 'celeb') {
      fig.celeb.t += dt / fig.celeb.dur;
      if (fig.celeb.name === 'cartwheel') cartwheelTravel();
      if (fig.celeb.t >= 1) { fig.celeb = null; fig.state = 'idle'; }
    }
    else if (fig.state === 'wave') {
      fig.wave += dt / 1.6;
      if (fig.wave >= 1) { fig.state = fig.prev || 'idle'; fig.prev = null; }
    }
    puffs = puffs.filter(function (p) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; return p.t > 0; });
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
  var CLAY = { on: !/[?&]stick\b/.test(location.search), ready: false, man: null, img: {}, dist: 0, lastX: null, H: matchMedia('(max-width:760px)').matches ? 92 : 113, sk: 1, want: 0, skT: 0 };   // a little smaller on phones (her ask)
  function loadClay() {
    if (!CLAY.on) return;
    var base = (document.querySelector('script[src*="stick.js"]') || {}).src || '';
    var dir = base.replace(/stick\.js.*$/, '') + 'assets/clay/';
    var ver = (base.match(/\?v=[^&#]*/) || [''])[0];   // the build's cache-buster, so a re-rendered frame isn't served stale
    fetch(dir + 'clay.json' + ver).then(function (r) { return r.json(); }).then(function (m) {
      CLAY.man = m;
      /* triple frames (2026-10-23) is ~11MB of clay: she appears once the CORE motions are in, and
         the celebrations, climb and monkey bars stream in behind; a frame that hasn't arrived yet is
         covered by her last drawn clay frame (clayFigure), never by the stick figure */
      var CORE = ['idle-wave-sign', 'walk-x3', 'run-x3', 'jump-land-slide-x3', 'hang-swing-climb-x3'];
      /* the hover wave's three frames come in WITH her (108KB): streamed later, an early hover froze her on her last
         frame instead of waving and smiling (her: "when I hover … the smile … plus the wave") */
      var CORE_FRAMES = (m['idle-wave-sign-x3'] || []).slice(3, 6);
      function loadSet(keys, done) {
        var n = 0, total = 0;
        keys.forEach(function (k) { (Array.isArray(k) ? k : m[k] || []).forEach(function (f) { total++; var im = new Image(); im.decoding = 'async';
          im.onload = im.onerror = function () { if (++n === total) done(); }; im.src = dir + f.f + ver; CLAY.img[f.f] = im; }); });
        if (!total) done();
      }
      /* she APPEARS the moment her standing frame is in (one small file); everything else streams behind her, a frame
         not yet arrived holding her last drawn one (clayFigure). Waiting for all 4.4MB of core motion first meant on a
         phone over cellular she simply never showed up (her: "people report … doesn't show up on mobile") */
      loadSet(['idle-wave-sign'], function () {
        CLAY.ready = true; draw(performance.now()); start();
        loadSet(CORE.slice(1).concat([CORE_FRAMES]), function () {
          /* the rest: what a click shows first (the celebrations) goes first; the dance is out of the rotation, so its
             frames are never fetched at all */
          var FIRST = ['cartwheel-x3', 'cartwheel-50', 'star-bow-x3', 'backflip-x3'];
          loadSet(Object.keys(m).filter(function (k) { return k[0] !== '_' && CORE.indexOf(k) < 0 && k.indexOf('dance') !== 0; })
            .sort(function (x, y) { return (FIRST.indexOf(x) < 0 ? 9 : FIRST.indexOf(x)) - (FIRST.indexOf(y) < 0 ? 9 : FIRST.indexOf(y)); }), function () {});
        });
      });
      /* the hover smile only exists once clay.json names it (_smile), so the site never asks for a frame that isn't there */
      if (m._smile) CLAY.img.smile = [].concat(m._smile).map(function (n) { var sm = new Image(); sm.src = dir + n + ver; return sm; });   // same box as idle-wave-sign-0, only the face differs
    }).catch(function () { CLAY.on = false; });
  }
  function onClay(p) { return Math.abs(p.x - fig.x) < 34 && p.y > fig.y - CLAY.H - 6 && p.y < fig.y + 6; }
  (window.requestIdleCallback || function (f) { setTimeout(f, 600); })(loadClay);
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
  var RUN_LEAN = 0.2;   // radians (~11°) the clay runner tips forward from her feet
  function clayPick(o, groundY) {
    var st = fig.state, sp = Math.abs(fig.vx || 0);
    if (CLAY.lastX == null) CLAY.lastX = fig.x;
    CLAY.dist += Math.abs(fig.x - CLAY.lastX); CLAY.lastX = fig.x;
    if (fig.landT > 0 && (st === 'move' || st === 'idle')) return { s: 'jump-land-slide-x3', k: 12 };
    if (fig.slideT > 0 && st === 'move') return { s: 'jump-land-slide-x3', k: 18 };
    switch (st) {
      case 'move':
        if (sp < 12) return { s: 'idle-wave-sign', k: 0 };
        if (sp > 230) return { s: 'run-x3', k: Math.floor(CLAY.dist / 3) % 48, lean: RUN_LEAN };   // her ask: tilted forward more when she runs
        return { s: 'walk-x3', k: Math.floor(CLAY.dist / 1.83) % 48 };   // x3: a frame every third of the old stride step
      case 'air': { var vy = fig.vy || 0;
        if (fig.flip) return { s: 'jump-land-slide-x3', k: 7, spin: (fig.flip.rot || 0) * (fig.flip.dir || 1) };
        return { s: 'jump-land-slide-x3', k: vy < -500 ? 4 : vy < -300 ? 5 : vy < -90 ? 6 : vy < 120 ? 7 : vy < 300 ? 8 : 9, mid: true }; }
      case 'hang': {
        var h = fig.hang, hs = o.hands || [], hx = 0, hy = 0, n = 0;
        hs.forEach(function (q) { if (q) { hx += q.x; hy += q.y; n++; } });
        if (!n) { hx = fig.x; hy = fig.y - LEG - HANG_L; n = 1; }
        /* only the dead-hang frame keeps both hands on the grip, so the swing is that frame
           pivoting from the hands like a pendulum (stepped to 12 positions a turn of the swing) */
        var th = Math.max(-1.1, Math.min(1.1, h.th || 0));
        /* travelling along the line: hand over hand, like the stick figure (her ask 2026-10-23,
           "monkey bars and alternating hands"). The 8 clay frames follow the same reach phase that
           alternates the stick figure's grips; each frame's top is its gripping hand. */
        /* zoom .82: these 24 frames were cut from their sheet ~1.2x bigger than her standing frame (her: "when it's hanging,
           why does the person get bigger") */
        if (h.reach && CLAY.man['monkey-x3']) return { s: 'monkey-x3', k: Math.floor(h.reach / (Math.PI * 2) * 24) % 24, anchor: 'hands', ax: hx / n, ay: hy / n, rot: -Math.round(th * .4 / .09) * .09 * fig.dir, zoom: .82 };
        return { s: 'hang-swing-climb-x3', k: 0, anchor: 'hands', ax: hx / n, ay: hy / n, rot: -Math.round(th / .09) * .09 * fig.dir };
      }
      case 'mantle': { var m = fig.mantle, t = m.t;
        if (t < .45) return { s: 'climb-x3', k: 9 + Math.min(5, Math.floor(t / .45 * 6)), anchor: 'hands', ax: m.x1,
          ay: m.hy0 == null ? m.y1 : m.hy0 + (m.y1 - m.hy0) * Math.min(1, t / .4) };   // a muscle-up's hands climb the glyph
        return { s: 'climb-x3', k: 18 + Math.min(12, Math.floor((t - .45) / .55 * 13)) }; }
      case 'wave': return { s: 'idle-wave-sign-x3', k: timedAt(WAVE_T, fig.wave * 3) };
      case 'sign': return { s: 'star-bow-x3', k: 8 };
      case 'celeb': { var c = fig.celeb, ct = c.t;
        switch (c.name) {
          case 'star': return { s: 'star-bow-x3', k: ct < .22 ? Math.min(2, Math.floor(ct / .22 * 3)) : ct < .78 ? 3 : 4 + Math.min(2, Math.floor((ct - .78) / .22 * 3)), lift: ct >= .22 && ct < .78 ? Math.sin((ct - .22) / .56 * Math.PI) * .32 : 0 };
          case 'backflip': return { s: 'backflip-x3', k: Math.min(17, Math.floor(ct * 18)), lift: Math.sin(Math.PI * ct) * .5 };
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
  function clayFigure(px, py, dir, o) {
    var groundY = py + LEG - 0.7, pk = clayPick(o, groundY), list = CLAY.man[pk.s], f = list && list[pk.k % list.length];
    if (!f) return false;
    var im = CLAY.img[f.f];
    if (!im || !im.complete || !im.naturalWidth) { if (!CLAY.last) return false; im = CLAY.last.im; f = CLAY.last.f; }   // still streaming in: hold her last frame
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
    if (pk.anchor === 'hands') { ctx.translate(pk.ax, pk.ay); if (pk.rot) ctx.rotate(pk.rot); var z = pk.zoom || 1; ctx.scale(sc * d * z, sc * z); ctx.drawImage(im, -(f.gx != null ? f.gx : f.cx), -(f.gy || 0)); }   /* gx/gy: the gripping fist, so it lands ON the letter */
    else if (pk.spin != null) { ctx.translate(px, groundY - CLAY.H * .5); ctx.rotate(Math.round(pk.spin / .5) * .5); ctx.scale(sc * d, sc); ctx.drawImage(im, -f.cx, -f.base + CLAY.man._ref * .5); }   /* stepped spin, like clay */
    /* airborne frames pin by their MIDDLE, not their feet: a tuck is ~25% shorter than a stretch, and
       feet-pinning dropped her head ~50px every time the frame changed (the "glitch when I jump") */
    else if (pk.mid) { ctx.translate(px, groundY - CLAY.H * .5); ctx.scale(sc * d, sc); ctx.drawImage(im, -f.cx, -f.base + f.h * .5); }
    else { ctx.translate(px, groundY - (pk.lift || 0) * CLAY.H); if (pk.lean) ctx.rotate(pk.lean * dir); ctx.scale(sc * d, sc); ctx.drawImage(im, -f.cx, -f.base); }   /* lean pivots on the feet, top toward travel */
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
    var b = { x1: fig.x - R, y1: fig.y - LEG - R, x2: fig.x + R, y2: fig.y + (CLAY.ready ? R : 40) };
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
    puffs.forEach(function (p) {
      ctx.strokeStyle = ink; ctx.globalAlpha = Math.max(p.t / 0.34, 0) * 0.5; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x - 3, p.y); ctx.lineTo(p.x + 3, p.y); ctx.stroke();
      ctx.globalAlpha = 1;
    });
    /* feet planted a hair below the surface line — contact, not hover */
    figure(fig.x, fig.y - LEG + 0.7 + rideDy(), fig.dir, pose());
  }

  /* How far the glyph under his feet has moved off its resting box RIGHT NOW. The
     headline's hover wave (.lively.waving .ch) lifts each letter 7px on a stagger; the
     mask is deliberately not rebuilt for it, so without this he stood mid-air while the
     d dipped out from under him. Render-time offset only — fig.y and the physics keep
     talking to the resting world, and the CSS transition itself supplies the easing in
     both directions. Grounded states only: airborne/hanging/dragged figures answer to
     other math, and the sign-hold stands at the CTA, not on type. */
  function rideDy() {
    if (!chRide.length) return 0;
    if (fig.state !== 'idle' && fig.state !== 'move' && fig.state !== 'celeb' && fig.state !== 'wave') return 0;
    for (var i = 0; i < chRide.length; i++) {
      var c = chRide[i];
      if (fig.x < c.x1 - 2 || fig.x > c.x2 + 2) continue;
      /* his feet (fig.y = the glyph's ink top) must sit inside this glyph's own line
         box — otherwise he is standing on the floor or a lower line, not on this letter */
      if (fig.y < c.y1 - 10 || fig.y > c.y2 + 6) continue;
      return (c.el.getBoundingClientRect().top - cv.getBoundingClientRect().top) - c.y1;
    }
    return 0;
  }

  /* ------------------------------------------------------------------ boot */
  var rebuildT = 0;
  function queueRebuild() {
    clearTimeout(rebuildT);
    rebuildT = setTimeout(function () {
      if (!booted) return;
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
    if (fig.state === 'air' || fig.state === 'hang' || fig.state === 'mantle') return;
    var t = groundTop(fig.x, fig.y - 3, 8);
    if (t == null || Math.abs(t - fig.y) > 5) {
      var l = groundTop(fig.x, 0, H + 40);
      fig.y = l == null ? floorY : l;
    }
  }
  new IntersectionObserver(function (es) {
    visible = es[0].isIntersecting;
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
  var h1Lively = hero.querySelector('h1');
  if (h1Lively) ['mouseenter', 'mouseleave'].forEach(function (ev) {
    h1Lively.addEventListener(ev, function () {
      if (touchMode || !booted) return;
      rideT = 2.2; start();
    });
  });

  var booted = false;
  function boot() {
    if (booted) return; booted = true;
    rebuild();
    spawn();
    draw();
    /* fades the canvas in (see .hero.stick-on in build.js) — he is the last layer of
       the load sequence, arriving after the type he stands on has stopped moving */
    hero.classList.add('stick-on');
    var btn = hero.querySelector('.hero-cta-row .btn.solid');
    if (btn) btn.addEventListener('mouseenter', waveHello);
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
  function bootWhenSettled() {
    var go = function () { boot(); rideT = 2.6; start(); };
    if (window.__mkHeroLanded || window.__mkHeroSettled) return go();
    addEventListener('mk-hero-landed', go, { once: true });
    addEventListener('mk-hero-settled', go, { once: true });
    setTimeout(go, 4200);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(bootWhenSettled);
  else addEventListener('load', bootWhenSettled);

  /* QA hook — the world plus a synchronous stepper for headless checks (the browser pane
     pauses rAF while hidden, so tests drive time by hand); not a public API */
  window.__stick = {
    fig: fig, bars: function () { return bars; }, step: advance, draw: draw,
    plan: function (x, y) { return planRoute(x, y); },
    clayH: function () { return CLAY.ready ? CLAY.H : 0; },
    canvas: function () { return cv; },
    hide: function (on) { fig.hidden = !!on; draw(performance.now()); if (on) { fig.target = null; fig.waypoint = null; fig.vx = 0; } },
    solid: function (x, y) { return solid(x, y); },
    groundTop: function (x, y) { return groundTop(x, y, H); },
  };
})();
