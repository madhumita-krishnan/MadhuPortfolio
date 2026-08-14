/* stickman.js — the hero's little inhabitant.

   A procedural stick figure that lives ONLY in the hero section. It starts holding the
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
   settles — an idle figure is a single static draw costing zero frames. Touch, coarse
   pointers and reduced motion never boot it: the CTA stays an ordinary button. */
(function () {
  'use strict';
  var hero = document.querySelector('.hero');
  if (!hero) return;
  var fine = matchMedia('(hover: hover) and (pointer: fine)');
  var prefersRM = matchMedia('(prefers-reduced-motion: reduce)');
  if (!fine.matches || prefersRM.matches) return;
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
  var HANG_L = 26;
  var MIN_CLR = 15;      // a surface with less headroom than this isn't standable at all
  var CRAWL_CLR = 50;    // less headroom than this and the figure folds into a crawl

  /* ------------------------------------------------------------------ the ink mask
     Half-resolution alpha of everything visible in the hero that is not the page itself.
     One mask pixel = 2 CSS px, which is exactly the granularity a 60px figure needs. */
  var W = 0, H = 0, DPR = 1, floorY = 0;
  var S = 0.5, W2 = 0, H2 = 0, md = null;
  var mk = document.createElement('canvas');
  var bars = [];
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
    var baseline = r.y1 + (r.h - (asc + desc)) / 2 + asc;
    g.fillText(t, r.x1, baseline);
  }

  function rebuild() {
    var hr = hero.getBoundingClientRect();
    if (hr.width < 40) return;
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = hr.width; H = hr.height;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
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
    var words = hero.querySelectorAll('.eyebrow .w, .hero-line .w');
    if (!words.length) words = hero.querySelectorAll('.eyebrow, .hero-line .hs');
    words.forEach(function (el) { maskText(g, el, hr); });
    /* the buttons are solid boards */
    hero.querySelectorAll('.hero-cta-row .btn').forEach(function (b) {
      var r = localRect(b, hr);
      if (g.roundRect) { g.beginPath(); g.roundRect(r.x1, r.y1, r.w, r.h, r.h / 2); g.fill(); }
      else g.fillRect(r.x1, r.y1, r.w, r.h);
    });

    md = g.getImageData(0, 0, W2, H2).data;

    /* monkey bars: the undersides of the copy blocks (reachable from the floor with one
       hop, so the hang is discoverable) and the headline baseline */
    bars = [];
    var line = hero.querySelector('.hero-line');
    if (line) { var lr = localRect(line, hr); bars.push({ x1: lr.x1 + 10, x2: lr.x2 - 10, y: lr.y2 - 2 }); }
    var eb = hero.querySelector('.eyebrow');
    if (eb) { var er = localRect(eb, hr); bars.push({ x1: er.x1, x2: er.x2, y: er.y2 - 2 }); }
    var h1 = hero.querySelector('h1');
    if (h1) { var hb = localRect(h1, hr); bars.push({ x1: hb.x1, x2: hb.x2, y: hb.y2 - 6 }); }

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
  /* march along the surface the way the walker would — steps, hops over ascender bumps,
     strides over glyph gaps — until it truly ends WITH a drop below. An ascender is a
     bump, not an edge: falling at one just lands you back at the same height, which is
     exactly the dithering loop this function exists to avoid. */
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
    target: null,          // {x, y, tries}
    waypoint: null,        // {x, y, drop}
    drag: null,
    flip: null,
    fallFrom: 0,
    landT: 0, slideT: 0,
    hang: null,
    mantle: null,
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
    if (!sign) { fig.x = W * 0.3; fig.y = floorY; return; }
    fig.x = sign.cx;
    fig.y = floorY;
    fig.dir = 1;
    fig.state = 'sign';
  }

  /* ------------------------------------------------------------------ celebrations */
  var CELEBS = ['star', 'backflip', 'dance', 'cartwheel', 'bow'];
  function celebrate() {
    if (fig.state === 'air' || fig.state === 'hang' || fig.state === 'mantle') return;
    fig.target = null; fig.waypoint = null; fig.vx = 0;
    var name = CELEBS[fig.celebIdx % CELEBS.length];
    fig.celeb = { name: name, t: 0, dur: { star: 1.1, backflip: 1.0, dance: 1.5, cartwheel: 1.0, bow: 1.2 }[name] };
    fig.celebIdx++;
    fig.state = 'celeb';
    start();
  }
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
  function heroPoint(e) {
    var hr = hero.getBoundingClientRect();
    return { x: e.clientX - hr.left, y: e.clientY - hr.top };
  }
  hero.addEventListener('pointermove', function (e) {
    var p = heroPoint(e); mouse.x = p.x; mouse.y = p.y;
    if (down && !down.moved && Math.hypot(p.x - down.x, p.y - down.y) > 10) { down.moved = true; hero.classList.add('stick-dragging'); }
    if (down && down.moved && !rmActive()) {
      var dx = p.x - down.x, dy = p.y - down.y;
      fig.drag = { vx: Math.max(-DRAGMAX, Math.min(DRAGMAX, dx * 2.6)), up: dy < -70 ? -dy : 0 };
      fig.target = null; fig.waypoint = null;
      if (fig.state === 'idle' || fig.state === 'sign' || fig.state === 'celeb' || fig.state === 'wave') { fig.state = 'move'; fig.celeb = null; }
      start();
    }
  }, { passive: true });
  hero.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || rmActive()) return;
    if (e.target.closest('a,button')) return;
    down = Object.assign(heroPoint(e), { t: performance.now(), moved: false });
  }, { passive: true });
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
    var hr = hero.getBoundingClientRect();
    var p = { x: e.clientX - hr.left, y: e.clientY - hr.top };
    if (p.x < 0 || p.x > W || p.y < 0 || p.y > H) return;
    var pelY = fig.y - LEG * (1 - fig.crawl * 0.6);
    if (Math.hypot(p.x - fig.x, p.y - (pelY - TO / 2)) < 46) {
      if (fig.state === 'hang') release(0);
      celebrate();
      return;
    }
    if (fig.state === 'hang') { release(Math.sign(p.x - fig.x)); return; }
    if (e.target.closest && e.target.closest('a,button')) return;
    /* the click means: the first ink at or below where you clicked */
    var ty = groundTop(p.x, p.y - 2, H);
    fig.target = { x: p.x, y: ty == null ? floorY : ty, tries: 0 };
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
    fig.x = b.hx; fig.y = b.bar.y + HANG_L + LEG;
    fig.vx = dirX * 220 + b.om * 40;
    fig.vy = -320;
    fig.fallFrom = fig.y;
    fig.hang = null; fig.hangCool = 0.6;
    start();
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

  function tickGround(dt) {
    var want = 0;
    var g = fig.waypoint || fig.target;
    if (fig.drag) { want = fig.drag.vx; }
    else if (fig.target) {
      var dx = g.x - fig.x;
      var far = Math.min(Math.abs(dx) / 120, 1);
      want = Math.sign(dx) * (WALK + (RUN - WALK) * far);
      /* near enough on the same bump of ink counts as arrived — waypoint or not */
      if (Math.abs(fig.target.x - fig.x) < 40 && Math.abs(fig.y - fig.target.y) < 26) {
        fig.target = null; fig.waypoint = null; fig.vx = 0; return;
      }
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
    /* low headroom folds the walk into a crawl (and slows it) */
    var clr = clearance(fig.x, fig.y);
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
      if (s - fig.y > 8) fig.slideT = 0.3;
      fig.x = nx; fig.y = s;
      fig.phase += Math.abs(fig.vx) * dt * 0.05;
      return;
    }
    /* the gaps BETWEEN glyphs are a few px of air — a stride simply spans them, the way a
       foot spans the gap between two letters. Only real edges are worth falling off. */
    if (s == null || s > fig.y + STEP_DOWN) {
      var s2 = groundTop(nx + fig.dir * 8, fig.y - STEP_UP, STEP_UP + STEP_DOWN + 4);
      if (s2 != null && s2 >= fig.y - STEP_UP - 0.5 && s2 <= fig.y + STEP_DOWN + 0.5) {
        fig.x = nx;
        fig.phase += Math.abs(fig.vx) * dt * 0.05;
        return;
      }
    }
    var goalBelow = g && g.y > fig.y + STEP_DOWN && !fig.waypoint;
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
    fig.vy = Math.min(fig.vy + G * dt, 1500);
    var g = fig.waypoint || fig.target;
    /* steer proportionally, not at full run — the dot of an i is a small landing pad */
    var want = fig.drag ? fig.drag.vx : (g ? Math.max(-RUN, Math.min(RUN, (g.x - fig.x) * 3)) : fig.vx);
    fig.vx += (want - fig.vx) * Math.min(1, dt * 2.2);
    var nx = Math.max(10, Math.min(W - 10, fig.x + fig.vx * dt));
    var ny = fig.y + fig.vy * dt;
    if (fig.flip) {
      fig.flip.rot += fig.flip.w * dt;
      if (fig.flip.rot >= Math.PI * 2) fig.flip = null;
    } else if (fig.vy > 0 && fig.y - fig.fallFrom > FLIP_DROP && ny < floorY - 60) {
      startFlip(fig.dir);
      fig.flip.w = 9;
    }
    fig.hangCool = Math.max(0, fig.hangCool - dt);
    /* monkey-bar grab — never while chasing a click; bars serve free-form leaps */
    if (!fig.flip && fig.vy < 160 && !fig.hangCool && !fig.target) {
      var handY = ny - LEG - HANDUP;
      for (var i = 0; i < bars.length; i++) {
        var b = bars[i];
        if (nx >= b.x1 - 4 && nx <= b.x2 + 4 && Math.abs(handY - b.y) < 15) {
          fig.state = 'hang';
          fig.hang = { bar: b, hx: nx, th: Math.max(-0.9, Math.min(0.9, fig.vx / 500)), om: fig.vx / 160, reach: 0 };
          fig.vx = 0; fig.vy = 0; fig.flip = null;
          return;
        }
      }
    }
    /* edge mantle: moving into ink whose top is at hand height → climb its lip. Never
       when the goal is BELOW us — mantling up is the opposite of a descent, and it can
       intercept the very landing the route is falling toward. */
    var gA = fig.waypoint || fig.target;
    if (fig.vx && !(gA && gA.y > ny - 10)) {
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
    if (fig.vy > 0) {
      var land = groundTop(nx, fig.y + 0.5, Math.max(2, ny - fig.y + 2));
      if (land != null && land <= ny + 0.5 && clearance(nx, land) >= MIN_CLR) {
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
        fig.vy = 0;
        if (!fig.target && !fig.drag) fig.vx = 0;
        return;
      }
    }
    fig.x = nx; fig.y = Math.min(ny, floorY);
    if (fig.y >= floorY) { fig.state = (fig.target || fig.drag) ? 'move' : 'idle'; fig.vy = 0; fig.flip = null; }
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
      if (next) { h.bar = next.bar; }
      else { release(dir); return; }
    }
    fig.x = h.hx;
    fig.y = b.y + HANG_L + LEG;
    fig.dir = (tv || h.om) > 0 ? 1 : -1;
  }

  function tickMantle(dt) {
    var m = fig.mantle;
    m.t += dt / 0.3;
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
  function needsLoop() {
    return fig.state !== 'idle' && fig.state !== 'sign' || fig.target || fig.drag || puffs.length || fig.landT > 0 || fig.slideT > 0;
  }
  function advance(dt) {
    fig.landT = Math.max(0, fig.landT - dt);
    fig.slideT = Math.max(0, fig.slideT - dt);
    if (fig.state === 'move' || fig.state === 'idle') tickGround(dt);
    else if (fig.state === 'air') tickAir(dt);
    else if (fig.state === 'hang') tickHang(dt);
    else if (fig.state === 'mantle') tickMantle(dt);
    else if (fig.state === 'celeb') {
      fig.celeb.t += dt / fig.celeb.dur;
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
    if (rmActive()) { cv.style.display = 'none'; return; }
    if (!visible) return;
    advance(dt);
    draw(now);
    if (needsLoop()) raf = requestAnimationFrame(frame);
  }
  function start() {
    if (!raf && !rmActive()) { cv.style.display = ''; last = performance.now(); raf = requestAnimationFrame(frame); }
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

  /* o: lean, hip:[], knee:[], sh:[], el:[], dy, rot, smile, grin, wavingHand, hands:[{x,y}] */
  function figure(px, py, dir, o) {
    ctx.save();
    ctx.translate(px, py + (o.dy || 0));
    if (o.rot) ctx.rotate(o.rot * dir);
    ctx.strokeStyle = ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var lean = o.lean || 0;
    var nx = Math.sin(lean) * TO * dir, ny = -Math.cos(lean) * TO;
    var hx = nx + Math.sin(lean * 1.15) * (NK + HR) * dir, hy = ny - Math.cos(lean * 1.15) * (NK + HR);
    // legs, each with a small forward bow so they read as drawn, not plotted
    for (var i = 0; i < 2; i++) {
      var a = o.hip[i], k = o.knee[i];
      var kx = Math.sin(a) * TH * dir, ky = Math.cos(a) * TH;
      var fx = kx + Math.sin(a - k) * SH * dir, fy = ky + Math.cos(a - k) * SH;
      stroke2(0, 0, kx, ky, 2.4, 0.7 * dir);
      stroke2(kx, ky, fx, fy, 2.2, -0.5 * dir);
      // a foot: short stroke pressed ~0.7px into whatever it stands on
      stroke2(fx, fy + 0.7, fx + 4.4 * dir, fy + 0.7, 2.0, 0);
    }
    // torso
    stroke2(0, 0, nx, ny, 2.6, 0.9 * dir);
    // arms
    for (var j = 0; j < 2; j++) {
      var hxw = null, hyw = null;
      if (o.hands && o.hands[j]) {
        var t = o.hands[j];
        var lx = t.x - px, ly = t.y - (py + (o.dy || 0));
        var r = ik(nx, ny, lx, ly, UA, FA, j ? -dir : dir);
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
    // head — a sketchy open ellipse, never a perfect circle
    sid++;
    var hr = HR + rnd(sid, 8) * 0.6;
    var tilt = lean * 0.4 + rnd(sid, 9) * 0.1;
    var a0 = -Math.PI / 2 + 0.25 + rnd(sid, 10) * 0.3;
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.ellipse(hx, hy - HR + 1.2, hr, hr * 0.93, tilt, a0, a0 + Math.PI * 1.97);
    ctx.stroke();
    // the face — always there, bigger smile when it has something to celebrate
    var cxf = hx + 1.6 * dir, cyf = hy - HR + 0.6;
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

  function pose() {
    var p = { lean: 0.03, hip: [0.06, -0.06], knee: [0.06, 0.06], sh: [0.1, -0.1], el: [0.12, 0.12], dy: 0, rot: 0 };
    var sp = Math.min(Math.abs(fig.vx) / RUN, 1);
    var ph = fig.phase;
    switch (fig.state) {
      case 'sign': {
        /* on tiptoe, both hands flat on the board's underside, holding it up */
        if (sign) {
          p.dy = -7;
          p.hip = [0.04, -0.04]; p.knee = [0.03, 0.03];
          p.hands = [{ x: sign.cx - 13, y: sign.bottom + 1 }, { x: sign.cx + 13, y: sign.bottom + 1 }];
        }
        p.smile = true;
        break;
      }
      case 'idle': break;
      case 'wave': {
        var wv = fig.wave;
        var env = Math.min(wv / 0.15, 1) * Math.min((1 - wv) / 0.2, 1);
        if (fig.prev === 'sign' && sign) {
          /* keep one hand holding the board, wave with the other */
          p.dy = -7;
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
        var A = 0.45 + 0.5 * sp;
        p.hip = [A * Math.sin(ph), A * Math.sin(ph + Math.PI)];
        p.knee = [Math.max(0, -Math.cos(ph)) * A * 0.9 + 0.08, Math.max(0, -Math.cos(ph + Math.PI)) * A * 0.9 + 0.08];
        p.sh = [A * 0.7 * Math.sin(ph + Math.PI), A * 0.7 * Math.sin(ph)];
        p.el = [0.35 + 0.3 * sp, 0.35 + 0.3 * sp];
        p.lean = 0.06 + 0.3 * sp;
        p.dy = -Math.abs(Math.sin(ph)) * 2.5 * sp;
        if (fig.slideT > 0) { p.lean = -0.34; p.hip = [0.9, 0.45]; p.knee = [1.3, 0.9]; p.sh = [-0.7, 0.5]; p.el = [0.3, 0.3]; p.dy = 6; }
        if (fig.landT > 0) { p.lean = 0.28; p.hip = [0.75, -0.5]; p.knee = [1.5, 1.2]; p.sh = [0.5, -0.6]; p.el = [0.5, 0.5]; p.dy = 9; }
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
        var r0 = Math.sin(h.reach), spread = h.reach ? 5 + 3 * r0 : 5;
        /* hands drawn a hair past the bar line so the grip reads as contact */
        p.hands = [{ x: h.hx - spread, y: h.bar.y + 0.75 }, { x: h.hx + spread, y: h.bar.y + 0.75 }];
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
    /* low headroom folds any grounded pose toward a crawl: pelvis drops, torso pitches
       to horizontal, hands come down onto the ink ahead */
    var c = fig.crawl;
    if (c > 0.12 && (fig.state === 'move' || fig.state === 'idle')) {
      var ph2 = ph * 1.4;
      p.dy = (p.dy || 0) + (LEG - 8) * c;
      p.lean = p.lean * (1 - c) + 1.45 * c;
      p.hip = [p.hip[0] * (1 - c) + (1.3 + 0.25 * Math.sin(ph2)) * c, p.hip[1] * (1 - c) + (1.3 - 0.25 * Math.sin(ph2)) * c];
      p.knee = [p.knee[0] * (1 - c) + 1.5 * c, p.knee[1] * (1 - c) + 1.5 * c];
      if (c > 0.4) p.hands = [
        { x: fig.x + fig.dir * (13 + 3 * Math.sin(ph2)), y: fig.y + 0.7 },
        { x: fig.x + fig.dir * (19 - 3 * Math.sin(ph2)), y: fig.y + 0.7 }];
    }
    return p;
  }

  function draw(now) {
    /* the boil ticks at ~6Hz while animating; a resting figure keeps its last seed and
       is perfectly still */
    if (needsLoop()) seed = ((now || performance.now()) / 160) | 0;
    sid = 0;
    ctx.clearRect(0, 0, W, H);
    puffs.forEach(function (p) {
      ctx.strokeStyle = ink; ctx.globalAlpha = Math.max(p.t / 0.34, 0) * 0.5; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x - 3, p.y); ctx.lineTo(p.x + 3, p.y); ctx.stroke();
      ctx.globalAlpha = 1;
    });
    /* feet planted a hair below the surface line — contact, not hover */
    figure(fig.x, fig.y - LEG + 0.7, fig.dir, pose());
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

  var booted = false;
  function boot() {
    if (booted) return; booted = true;
    rebuild();
    spawn();
    draw();
    var btn = hero.querySelector('.hero-cta-row .btn.solid');
    if (btn) btn.addEventListener('mouseenter', waveHello);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { setTimeout(boot, 350); });
  else addEventListener('load', function () { setTimeout(boot, 600); });

  /* QA hook — the world plus a synchronous stepper for headless checks (the browser pane
     pauses rAF while hidden, so tests drive time by hand); not a public API */
  window.__stick = {
    fig: fig, bars: function () { return bars; }, step: advance, draw: draw,
    solid: function (x, y) { return solid(x, y); },
    groundTop: function (x, y) { return groundTop(x, y, H); },
  };
})();
