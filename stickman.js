/* stickman.js — the hero's little inhabitant.

   A procedural stick figure that lives ONLY in the hero section. It starts holding the
   "say hey" sign (the real CTA button becomes the sign board — the anchor is untouched, so
   the Calendly link, focus ring and button styling all survive; we only draw a post from the
   board down to the ground and a figure holding it). From there it is a tiny platformer:

     · click anywhere in the hero → it walks/runs to the click, jumping and climbing as needed
     · drag → it moves in the drag direction, incrementally faster the further you drag
     · gravity always applies — it can never walk on air or ceilings
     · the headline glyphs are terrain: per-character tops measured from the actual font
       metrics (span rects only give the line box, so 'i' and 'M' would otherwise be the
       same height and the staircase would vanish)
     · long jumps and big drops get a full tuck flip; small hops don't
     · the underside of the headline is a monkey bar — jump up, grab, swing; the hands
       traverse toward wherever the mouse is
     · steep descents read as a slide; hard landings absorb into a crouch
     · click the figure itself → a celebration, cycling through a library so it is
       different every time

   Everything is drawn on one canvas in --ink-blue, matching the site's line weight. The rAF
   loop follows the pot's rule: started on demand, cancelled the moment the figure settles —
   an idle figure is a single static draw costing zero frames. Touch, coarse pointers and
   reduced motion never boot it: the CTA stays an ordinary button. */
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
  var TH = 11.5, SH = 11.5, UA = 9.5, FA = 9.5, TO = 16, NK = 3.5, HR = 6.8;
  var LEG = TH + SH;               // pelvis sits ~this far above the feet when standing
  var HANDUP = TO + UA + FA - 4;   // how far above the pelvis a raised hand reaches

  /* ------------------------------------------------------------------ tuning */
  var G = 2300;          // px/s^2 — heavier than earth so hops feel snappy at this scale
  var WALK = 120, RUN = 360, DRAGMAX = 640;
  var STEP_UP = 20;      // walked without breaking stride: this is "a slope", not a ledge
  var HOP_UP = 62;       // auto-hop range — climbing stairs of letters
  var STEP_DOWN = 30;    // walked down without going airborne
  var JUMP_MAX = 240;    // the most height a single deliberate jump can buy
  var FLIP_DX = 150;     // horizontal jump distance that earns a flip
  var FLIP_DROP = 145;   // free-fall depth that earns one on the way down
  var HANG_L = 26;       // pelvis below the hands while hanging

  /* ------------------------------------------------------------------ world */
  var W = 0, H = 0, DPR = 1, floorY = 0;
  var plats = [];        // {x1,x2,y,kind} one-way tops — stand on them, pass from below
  var bars = [];         // {x1,x2,y} monkey-bar segments under the headline glyphs
  var sign = null;       // {cx, top, bottom} — the post under the real say-hey button
  var ink = '#3C6B76';

  function localRect(el, hr) {
    var r = el.getBoundingClientRect();
    return { x1: r.left - hr.left, x2: r.right - hr.left, y1: r.top - hr.top, y2: r.bottom - hr.top, w: r.width, h: r.height };
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
    plats = [{ x1: -40, x2: W + 40, y: floorY, kind: 'floor' }];
    bars = [];

    /* the headline, glyph by glyph. app.js has already split it into .ch spans. A span's
       rect is the inline line box — same top for every character — so the real glyph top
       comes from canvas font metrics: top = baseline − actualBoundingBoxAscent(ch), with
       the baseline recovered from the standard inline-layout formula (half-leading). */
    var h1 = hero.querySelector('h1');
    if (h1) {
      var chs = h1.querySelectorAll('.ch');
      if (chs.length) {
        var cs = getComputedStyle(chs[0]);
        ctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + '/' + cs.lineHeight + ' ' + cs.fontFamily;
        var fm = ctx.measureText('Mg');
        var asc = fm.fontBoundingBoxAscent || parseFloat(cs.fontSize) * 0.8;
        var desc = fm.fontBoundingBoxDescent || parseFloat(cs.fontSize) * 0.2;
        chs.forEach(function (el) {
          var t = el.textContent;
          if (!t.trim()) return;
          var r = localRect(el, hr);
          var baseline = r.y1 + (r.h - (asc + desc)) / 2 + asc;
          var m = ctx.measureText(t);
          var top = baseline - (m.actualBoundingBoxAscent || asc * 0.6);
          plats.push({ x1: r.x1, x2: r.x2, y: top, kind: 'glyph' });
          bars.push({ x1: r.x1, x2: r.x2, y: baseline + 2 });
        });
        bars.sort(function (a, b) { return a.x1 - b.x1; });
      }
    }
    var line = hero.querySelector('.hero-line');
    if (line) {
      var lr = localRect(line, hr);
      plats.push({ x1: lr.x1, x2: lr.x2, y: lr.y1 + 4, kind: 'para' });
      /* the paragraph's underside is the long monkey-bar run — reachable with one hop
         from the floor, so the hang is discoverable, not just theoretically possible */
      bars.push({ x1: lr.x1 + 10, x2: lr.x2 - 10, y: lr.y2 - 2 });
    }
    var eb = hero.querySelector('.eyebrow');
    if (eb) {
      var er = localRect(eb, hr);
      plats.push({ x1: er.x1, x2: er.x2, y: er.y1 + 2, kind: 'eyebrow' });
      bars.push({ x1: er.x1, x2: er.x2, y: er.y2 - 2 });
    }
    hero.querySelectorAll('.hero-cta-row .btn').forEach(function (b) {
      var br = localRect(b, hr);
      plats.push({ x1: br.x1, x2: br.x2, y: br.y1, kind: 'btn' });
    });
    var btn = hero.querySelector('.hero-cta-row .btn.solid');
    sign = null;
    if (btn) {
      var sr = localRect(btn, hr);
      sign = { cx: sr.x1 + sr.w / 2, top: sr.y2 - 2, bottom: floorY };
    }
    needsDraw = true;
  }

  /* ------------------------------------------------------------------ platform queries */
  function under(x) { return plats.filter(function (p) { return x >= p.x1 - 2 && x <= p.x2 + 2; }); }
  /* highest platform whose top lies in (from, to] at x — what a falling figure lands on */
  function landing(x, from, to) {
    var best = null;
    under(x).forEach(function (p) { if (p.y > from + 0.5 && p.y <= to + 0.5 && (!best || p.y < best.y)) best = p; });
    return best;
  }
  /* platform standable at x whose top is within [y-rise, y+drop] of the current feet */
  function stepTarget(x, y, rise, drop) {
    var best = null;
    under(x).forEach(function (p) {
      var d = p.y - y; // negative = above
      if (d >= -rise - 0.5 && d <= drop + 0.5 && (!best || Math.abs(d) < Math.abs(best.y - y))) best = p;
    });
    return best;
  }
  /* the platform the user most plausibly meant when clicking (cx, cy):
     the highest top at cx that is at or below the click */
  function clickPlat(cx, cy) {
    var best = null;
    under(cx).forEach(function (p) { if (p.y >= cy - 8 && (!best || p.y < best.y)) best = p; });
    return best || plats[0];
  }

  /* ------------------------------------------------------------------ figure state */
  var fig = {
    x: 0, y: 0,            // FEET position — ground logic lives in feet space
    vx: 0, vy: 0, dir: 1,
    state: 'sign',         // sign | idle | move | air | hang | mantle | celeb
    phase: 0,              // gait cycle
    target: null,          // {x, plat, tries}
    waypoint: null,        // intermediate hop of the greedy climb toward target
    drag: null,            // {vx, up}
    flip: null,            // {rot, w, dir}
    fallFrom: 0,
    landT: 0, slideT: 0,   // pose timers (s remaining)
    hang: null,            // {bar, s, th, om, reach}
    mantle: null,          // {t, x0, y0, x1, y1}
    celeb: null,           // {i, t, dur}
    celebIdx: 0,
    hangCool: 0,
  };
  var mouse = { x: 0, y: 0 };
  var puffs = [];          // {x,y,vx,vy,t} landing dust
  var visible = true, needsDraw = false;

  function spawn() {
    if (!sign) { fig.x = W * 0.3; fig.y = floorY; return; }
    fig.x = sign.cx - 26;
    fig.y = floorY;
    fig.dir = 1;
    fig.state = 'sign';
  }

  /* ------------------------------------------------------------------ celebrations */
  /* each returns pose overrides for t in [0,1] — cycled so no two clicks in a row match */
  var CELEBS = ['star', 'backflip', 'dance', 'cartwheel', 'bow'];

  function celebrate() {
    if (fig.state === 'air' || fig.state === 'hang' || fig.state === 'mantle') return;
    fig.target = null; fig.vx = 0;
    fig.celeb = { name: CELEBS[fig.celebIdx % CELEBS.length], t: 0, dur: { star: 1.1, backflip: 1.0, dance: 1.5, cartwheel: 1.0, bow: 1.2 }[CELEBS[fig.celebIdx % CELEBS.length]] };
    fig.celebIdx++;
    fig.state = 'celeb';
    start();
  }

  /* ------------------------------------------------------------------ input */
  var down = null; // {x,y,t,moved}
  function heroPoint(e) {
    var hr = hero.getBoundingClientRect();
    return { x: e.clientX - hr.left, y: e.clientY - hr.top };
  }
  hero.addEventListener('pointermove', function (e) {
    var p = heroPoint(e); mouse.x = p.x; mouse.y = p.y;
    if (down && !down.moved && Math.hypot(p.x - down.x, p.y - down.y) > 10) { down.moved = true; hero.classList.add('stick-dragging'); }
    if (down && down.moved && !rmActive()) {
      /* drag: direction and magnitude become his velocity — further = faster */
      var dx = p.x - down.x, dy = p.y - down.y;
      fig.drag = { vx: Math.max(-DRAGMAX, Math.min(DRAGMAX, dx * 2.6)), up: dy < -70 ? -dy : 0 };
      fig.target = null; fig.waypoint = null;
      if (fig.state === 'idle' || fig.state === 'sign' || fig.state === 'celeb') { fig.state = 'move'; fig.celeb = null; }
      start();
    }
  }, { passive: true });
  hero.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || rmActive()) return;
    if (e.target.closest('a,button')) return;   // real controls keep their clicks
    down = Object.assign(heroPoint(e), { t: performance.now(), moved: false });
  }, { passive: true });
  addEventListener('pointerup', function (e) {
    hero.classList.remove('stick-dragging');
    if (!down) { fig.drag = null; return; }
    var wasDrag = down.moved; down = null;
    if (rmActive()) { fig.drag = null; return; }
    if (wasDrag) {
      /* released — momentum carries, an upward drag becomes a leap */
      if (fig.drag && fig.drag.up && fig.state === 'move') {
        fig.vy = -Math.min(Math.sqrt(2 * G * Math.min(fig.drag.up * 1.6, JUMP_MAX)), 1000);
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
    var pelY = fig.y - LEG;
    if (Math.hypot(p.x - fig.x, p.y - (pelY - TO / 2)) < 46) {
      /* clicked the figure itself → celebration, a different one each time */
      if (fig.state === 'hang') release(0);
      celebrate();
      return;
    }
    if (fig.state === 'hang') { release(Math.sign(p.x - fig.x)); return; }
    if (e.target.closest && e.target.closest('a,button')) return;
    fig.target = { x: p.x, plat: clickPlat(p.x, p.y), tries: 0 };
    fig.waypoint = null;
    if (fig.state === 'idle' || fig.state === 'sign' || fig.state === 'celeb') { fig.state = 'move'; fig.celeb = null; }
    start();
  });

  function startFlip(dir) {
    /* one full rotation timed to the flight: w = 2π / (time back to launch height) */
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
    /* the cap must be able to pay for JUMP_MAX plus the clearance margin — a cap below
       sqrt(2G·(JUMP_MAX+34)) silently shaves the apex and a "reachable" ledge never is */
    fig.vy = -Math.min(Math.sqrt(2 * G * (Math.min(rise, JUMP_MAX) + 34)), 1210);
    fig.fallFrom = fig.y;
    fig.state = 'air';
    if (Math.abs(dx) > FLIP_DX) startFlip(Math.sign(dx));
    puff(fig.x, fig.y, 2);
  }

  function tickGround(dt) {
    var want = 0;
    if (fig.drag) { want = fig.drag.vx; }
    else if (fig.target) {
      /* pursue the waypoint if the route needs one, else the click itself */
      var g = fig.waypoint || fig.target;
      var dx = g.x - fig.x;
      var far = Math.min(Math.abs(dx) / 120, 1);
      want = Math.sign(dx) * (WALK + (RUN - WALK) * far);
      /* "on the headline" is close enough: if the click meant a glyph and he is standing
         on any glyph within reach of it, call it arrived rather than demanding the exact
         letter — the tops differ by a few px and the last hop reads as fidgeting */
      if (!fig.waypoint && fig.target.plat.kind === 'glyph' && Math.abs(dx) < 40) {
        var here = stepTarget(fig.x, fig.y, 4, 4);
        if (here && here.kind === 'glyph') { fig.target = null; fig.vx = 0; return; }
      }
      if (Math.abs(dx) < 8) {
        var dyP = fig.y - g.plat.y;
        if (Math.abs(dyP) <= 10) {
          /* standing where this leg of the route ends */
          if (fig.waypoint) fig.waypoint = null;
          else { fig.target = null; want = 0; }
        } else if (dyP > STEP_UP + 4 && fig.target.tries < 8) {
          fig.target.tries++;
          if (dyP <= JUMP_MAX + 40) {
            /* one jump away: go straight up — air steering drifts the last few px */
            jumpFor(dyP, 0);
            fig.vx = Math.max(-70, Math.min(70, (g.x - fig.x) * 2));
            return;
          }
          /* too high for one jump — climb greedily via the nearest platform that IS
             reachable from here: floor → button → paragraph → glyph. This is what makes
             "click a letter" work from the ground. */
          var stone = null, fx = fig.x, fy = fig.y;
          plats.forEach(function (p2) {
            var rise = fy - p2.y;
            if (rise < 30 || rise > JUMP_MAX + 40) return;
            var cx = Math.max(p2.x1 + 8, Math.min(p2.x2 - 8, fx));
            var d2 = Math.abs(cx - fx);
            if (d2 <= 240 && (!stone || d2 < stone.d)) stone = { p: p2, cx: cx, d: d2 };
          });
          if (stone) fig.waypoint = { x: stone.cx, plat: stone.p };
          else { fig.target = null; fig.waypoint = null; want = 0; }
        } else if (fig.target.tries < 8) {
          /* the click was BELOW us: gravity is the elevator, but it needs an edge — walk
             off the nearest end of whatever we're standing on and fall a level, then
             re-approach. The drop flag stops the route from trying to climb back up. */
          fig.target.tries++;
          var cur = stepTarget(fig.x, fig.y, 4, 4);
          if (cur && cur.kind !== 'floor') {
            var ex = fig.x - cur.x1 < cur.x2 - fig.x ? cur.x1 - 18 : cur.x2 + 18;
            fig.waypoint = { x: ex, plat: cur, drop: true };
          } else { fig.target = null; fig.waypoint = null; want = 0; }
        } else { fig.target = null; fig.waypoint = null; want = 0; }
      }
    }
    fig.vx += (want - fig.vx) * Math.min(1, dt * 9);
    if (Math.abs(fig.vx) < 6 && !fig.target && !fig.drag) {
      fig.vx = 0;
      if (fig.state === 'move') fig.state = 'idle';
      return;
    }
    if (fig.vx) fig.dir = fig.vx > 0 ? 1 : -1;
    var nx = Math.max(10, Math.min(W - 10, fig.x + fig.vx * dt));
    var s = stepTarget(nx, fig.y, STEP_UP, STEP_DOWN);
    if (s) {
      var d = s.y - fig.y;
      if (d > 8) { fig.slideT = 0.3; }       // stepping down reads as a slide
      fig.x = nx; fig.y = s.y;
      fig.phase += Math.abs(fig.vx) * dt * 0.05;
      return;
    }
    /* never stair-hop UP when the goal is a level below — prefer the edge and the fall */
    var goalBelow = g && g.plat.y > fig.y + STEP_DOWN && !fig.waypoint;
    var hop = goalBelow ? null : stepTarget(nx, fig.y, HOP_UP, 0);
    if (hop && hop.y < fig.y - STEP_UP) {
      /* stair of letters: a little spring up, no flip */
      fig.x = nx;
      fig.vy = -Math.sqrt(2 * G * (fig.y - hop.y + 20));
      fig.fallFrom = fig.y; fig.state = 'air';
      return;
    }
    /* a wall taller than a hop? jump properly if we're being driven at it */
    var wall = null;
    under(nx).forEach(function (p) { if (p.y < fig.y - HOP_UP && (!wall || p.y > wall.y)) wall = p; });
    if (wall && (fig.drag || fig.target) && !goalBelow && fig.y - wall.y <= JUMP_MAX + 40) {
      jumpFor(fig.y - wall.y, 0);
      fig.x = nx;
      return;
    }
    /* nothing to stand on ahead: walk off the edge and fall */
    fig.x = nx;
    fig.state = 'air'; fig.vy = 0; fig.fallFrom = fig.y;
  }

  function tickAir(dt) {
    fig.vy = Math.min(fig.vy + G * dt, 1500);
    /* mild air control toward an intent */
    /* steer proportionally, not at full run — a narrow glyph top is a small landing pad,
       and flying past it at RUN speed misses forever */
    var g = fig.waypoint || fig.target;
    var want = fig.drag ? fig.drag.vx : (g ? Math.max(-RUN, Math.min(RUN, (g.x - fig.x) * 3)) : fig.vx);
    fig.vx += (want - fig.vx) * Math.min(1, dt * 2.2);
    var nx = Math.max(10, Math.min(W - 10, fig.x + fig.vx * dt));
    var ny = fig.y + fig.vy * dt;
    if (fig.flip) {
      fig.flip.rot += fig.flip.w * dt;
      if (fig.flip.rot >= Math.PI * 2) fig.flip = null;
    } else if (fig.vy > 0 && fig.y - fig.fallFrom > FLIP_DROP && ny < floorY - 60) {
      startFlip(fig.dir); // a genuinely long drop earns its flip mid-air
      fig.flip.w = 9;
    }
    fig.hangCool = Math.max(0, fig.hangCool - dt);
    /* monkey-bar grab: hands over head, close under a bar, not plummeting. Never while
       chasing a click — a grab mid-route flings the climb off course; bars are for
       free-form jumps and drag leaps. */
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
    /* edge mantle: moving into a ledge whose top is at hand height → climb it */
    if (fig.vx) {
      var py = ny - LEG;
      for (var j = 0; j < plats.length; j++) {
        var p = plats[j];
        if (p.kind === 'floor') continue;
        var edge = fig.vx > 0 ? p.x1 : p.x2;
        if (p.y > py - 6 && p.y < py + 52 && (fig.vx > 0 ? nx > edge - 15 && nx < edge + 6 : nx < edge + 15 && nx > edge - 6)) {
          fig.state = 'mantle';
          fig.mantle = { t: 0, x0: nx, y0: ny, x1: edge + (fig.vx > 0 ? 12 : -12), y1: p.y };
          fig.vx = 0; fig.vy = 0; fig.flip = null;
          return;
        }
      }
    }
    if (fig.vy > 0) {
      var land = landing(nx, fig.y, ny);
      if (land) {
        fig.x = nx; fig.y = land.y;
        var drop = fig.y - fig.fallFrom;
        fig.flip = null;
        if (fig.waypoint && fig.waypoint.drop) fig.waypoint = null; // the drop happened
        fig.state = (fig.target || fig.drag) ? 'move' : 'idle';
        if (fig.vy > 620 || drop > 130) { fig.landT = 0.18; puff(fig.x, fig.y, 4); }
        fig.vy = 0;
        if (!fig.target && !fig.drag) fig.vx = 0;
        return;
      }
    }
    fig.x = nx; fig.y = Math.min(ny, floorY);
    if (fig.y >= floorY) { fig.state = 'idle'; fig.vy = 0; fig.flip = null; }
  }

  function tickHang(dt) {
    var h = fig.hang, b = h.bar;
    /* a pendulum, driven a little by where the mouse is — and the hands walk the bar
       toward the mouse, which is the monkey-bar traverse */
    var mdx = mouse.x - h.hx;
    h.om += (-(G / 90) * Math.sin(h.th) - 1.1 * h.om + Math.max(-3, Math.min(3, mdx / 60))) * dt;
    h.th += h.om * dt;
    var tv = Math.abs(mdx) < 26 ? 0 : Math.max(-170, Math.min(170, mdx * 2.4));
    h.hx += tv * dt;
    h.reach = tv ? (h.reach + dt * 6) % (Math.PI * 2) : 0;
    if (h.hx < b.x1 - 4 || h.hx > b.x2 + 4) {
      /* off this bar's end: the next glyph's bar continues the run, otherwise let go */
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

  /* ------------------------------------------------------------------ the rAF driver
     (same shape as the pot's: cancel the moment nothing is moving) */
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
    puffs = puffs.filter(function (p) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; return p.t > 0; });
  }
  function frame(now) {
    raf = 0;
    var dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (rmActive()) { cv.style.display = 'none'; return; }
    if (!visible) return;
    advance(dt);
    draw(now / 1000);
    if (needsLoop()) raf = requestAnimationFrame(frame);
  }
  function start() {
    if (!raf && !rmActive()) { cv.style.display = ''; last = performance.now(); raf = requestAnimationFrame(frame); }
  }

  /* ------------------------------------------------------------------ drawing */
  function ik(ax, ay, bx, by, l1, l2, side) {
    var dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
    var m = Math.min(d, l1 + l2 - 0.6); if (d > 0) { dx *= m / d; dy *= m / d; d = m; }
    var h = Math.sqrt(Math.max(l1 * l1 - (d / 2) * (d / 2), 0));
    return { ex: ax + dx / 2 - dy / d * h * side, ey: ay + dy / 2 + dx / d * h * side, hx: ax + dx, hy: ay + dy };
  }
  function seg(a, b) { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }

  /* o: lean, hip:[f,b], knee:[f,b], sh:[f,b], el:[f,b], dy, rot, smile, hands:[{x,y}|null,...] (world) */
  function figure(px, py, dir, o) {
    ctx.save();
    ctx.translate(px, py + (o.dy || 0));
    if (o.rot) ctx.rotate(o.rot * dir);
    ctx.strokeStyle = ink; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    var lean = o.lean || 0;
    var nx = Math.sin(lean) * TO * dir, ny = -Math.cos(lean) * TO;
    var hx = nx + Math.sin(lean * 1.15) * (NK + HR) * dir, hy = ny - Math.cos(lean * 1.15) * (NK + HR);
    // legs
    for (var i = 0; i < 2; i++) {
      var a = o.hip[i], k = o.knee[i];
      var kx = Math.sin(a) * TH * dir, ky = Math.cos(a) * TH;
      var fx = kx + Math.sin(a - k) * SH * dir, fy = ky + Math.cos(a - k) * SH;
      seg([0, 0], [kx, ky]); seg([kx, ky], [fx, fy]);
    }
    // torso
    seg([0, 0], [nx, ny]);
    // arms
    for (var j = 0; j < 2; j++) {
      if (o.hands && o.hands[j]) {
        var t = o.hands[j];
        var lx = t.x - px, ly = t.y - (py + (o.dy || 0));
        var r = ik(nx, ny, lx, ly, UA, FA, j ? -dir : dir);
        seg([nx, ny], [r.ex, r.ey]); seg([r.ex, r.ey], [r.hx, r.hy]);
      } else {
        var s = o.sh[j], el = o.el[j];
        var ex = nx + Math.sin(s) * UA * dir, ey = ny + Math.cos(s) * UA;
        var wx = ex + Math.sin(s + el) * FA * dir, wy = ey + Math.cos(s + el) * FA;
        seg([nx, ny], [ex, ey]); seg([ex, ey], [wx, wy]);
      }
    }
    ctx.stroke();
    // head — an open circle, like her reference sheets
    ctx.beginPath();
    ctx.arc(hx, hy - HR + 1.2, HR, 0, Math.PI * 2);
    ctx.stroke();
    if (o.smile) {
      ctx.beginPath();
      ctx.lineWidth = 1.6;
      ctx.arc(hx + 1.4 * dir, hy - HR + 1.6, 3.1, 0.25, Math.PI - 0.25);
      ctx.stroke();
      ctx.fillStyle = ink;
      ctx.beginPath(); ctx.arc(hx - 1.6 * dir + 2.4 * dir, hy - HR - 1.2, 0.9, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(hx - 1.6 * dir - 1.2 * dir, hy - HR - 1.2, 0.9, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  function pose() {
    var p = { lean: 0.03, hip: [0.06, -0.06], knee: [0.06, 0.06], sh: [0.1, -0.1], el: [0.12, 0.12], dy: 0, rot: 0 };
    var sp = Math.min(Math.abs(fig.vx) / RUN, 1);
    var ph = fig.phase;
    switch (fig.state) {
      case 'sign': {
        // both hands on the post, holding the sign up — proud of it
        p.lean = -0.04;
        p.hip = [0.1, -0.08]; p.knee = [0.08, 0.1];
        if (sign) p.hands = [{ x: sign.cx - 1.5 * fig.dir, y: fig.y - LEG - TO - 6 }, { x: sign.cx + 1.5 * fig.dir, y: fig.y - LEG - TO + 6 }];
        break;
      }
      case 'idle': break;
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
        p.hands = [{ x: h.hx - spread, y: h.bar.y }, { x: h.hx + spread, y: h.bar.y }];
        p.hip = [0.25 + th * 0.6, -0.2 + th * 0.6];
        p.knee = [0.35, 0.3];
        p.dy = 0;
        break;
      }
      case 'mantle': {
        var m = fig.mantle;
        p.hands = [{ x: m.x1 - 6 * fig.dir, y: m.y1 }, { x: m.x1 + 2 * fig.dir, y: m.y1 }];
        p.hip = [1.3, 0.6]; p.knee = [1.8, 1.1]; p.lean = 0.5;
        break;
      }
      case 'celeb': {
        var t = fig.celeb.t;
        p.smile = true;
        switch (fig.celeb.name) {
          case 'star': {
            var hop = Math.abs(Math.sin(t * Math.PI * 2));
            p.dy = -hop * 24;
            p.hip = [0.85 * hop + 0.1, -0.85 * hop - 0.1];
            p.knee = [0.08, 0.08];
            p.sh = [-2.5 - 0.5 * hop, 2.5 + 0.5 * hop]; // both arms up in a V
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
            p.sh = [-2.6, 2.6]; p.el = [0, 0];   // limbs spread in an X
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
    return p;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    if (sign) {
      /* the post the sign stands on — the board itself IS the real button above it */
      ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sign.cx, sign.top);
      ctx.lineTo(sign.cx, sign.bottom);
      ctx.stroke();
    }
    puffs.forEach(function (p) {
      ctx.strokeStyle = ink; ctx.globalAlpha = Math.max(p.t / 0.34, 0) * 0.5; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x - 3, p.y); ctx.lineTo(p.x + 3, p.y); ctx.stroke();
      ctx.globalAlpha = 1;
    });
    figure(fig.x, fig.y - LEG, fig.dir, pose());
  }

  /* ------------------------------------------------------------------ boot */
  /* the hero's box changes without a window resize — the hand font swapping in, images
     landing, the copy re-flowing — and a canvas sized to a stale box gets stretched by
     inset:0 into the new one, which scales every drawing. So watch the ELEMENT, not the
     window. */
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
  function spawnIfLost() {
    /* after a resize the old position may be inside a wall or over nothing — re-seat.
       Only when standing: a mid-air figure is exactly where gravity wants it. */
    if (fig.state === 'air' || fig.state === 'hang' || fig.state === 'mantle') return;
    var s = stepTarget(fig.x, fig.y, 4, 4);
    if (!s) { var l = landing(fig.x, -40, floorY + 2); fig.y = l ? l.y : floorY; }
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
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { setTimeout(boot, 350); });
  else addEventListener('load', function () { setTimeout(boot, 600); });

  /* QA hook — view of the world plus a synchronous stepper for headless checks (the
     browser pane pauses rAF when hidden, so tests drive time by hand); not a public API */
  window.__stick = { fig: fig, plats: function () { return plats; }, bars: function () { return bars; }, step: advance, draw: draw };
})();
