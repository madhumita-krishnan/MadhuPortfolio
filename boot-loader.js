/* THE HOME PAGE LOADER (her 2026-10-27, designed in the loader study, artifact Lwn7LGfHwskvXQeWhCDkhM).
   M and K start stuck together and pull apart while the site loads; the goo between them stretches into a strand
   that thins as it lengthens (that strand is the loading bar). They keep struggling until the page has loaded. Then
   clay-her tuck-flips onto the strand, it sags and snaps, she hops onto the right hyphen, the ends pinch off into the
   two hyphens of the logo, she waves (looking at you, kind smile), leaps off, and the loader opens at the gap.

   Her rules for it (2026-10-27): "the loading animation doesnt slow down the site and … give the site the full time to
   load everything even on slow data, wifi and all old appliances and even intel processors"; "i want the site to be
   able to load while this runs". So:
   - it is an overlay; the page loads underneath it, and it fetches nothing the page doesn't need anyway (her frames
     are the same files the hero uses, at the same URLs, so they come out of the cache there);
   - the struggle holds until window `load` (everything fetched), capped at CAP ms, so nobody waits forever;
   - per frame it only moves a few SVG attributes, and it looks the same on every device (no flatter fallback: her rule);
   - she performs EVERY time, seamlessly (her: "this can never happen when it runs. the animation needs to be seamless and
     perfect everytime"): the struggle holds until her frames are loaded AND decoded as well as the page, so she never
     arrives as a blank or a half-drawn frame and the logo never snaps on its own;
   - Reduce Motion: plays the same as everywhere else (her rule, see `rm` below); any tap or key skips;
   - no script: a <noscript> rule hides it; script trouble: a CSS animation lifts it at 16s.
   ES5 only: this runs inline before anything else on old Safari too. build.js fills in the settings and frame list (the CFG placeholder). */
(function () {
  var de = document.documentElement, B = document.getElementById('boot'); if (!B) return;
  var C = __CFG__, V = C.v, FR = C.frames, ORDER = Object.keys(FR), NS = 'http://www.w3.org/2000/svg';
  var now = function () { return performance.now(); };
  /* WHEN IT PLAYS (her 2026-10-27, first "only when the site is loading the first time", then "i want the loading animation
     everytime I reload the site from the home page but not when I go to the home page from another page"): it plays on a
     fresh arrival and on every reload; coming to the home page from another page of the site (a link, or back/forward)
     goes straight to the page. ?boot shows it anyway (for checking) */
  var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0], how = nav ? nav.type : '';
  var fromSite = false; try { fromSite = !!document.referrer && new URL(document.referrer).origin === location.origin && new URL(document.referrer).pathname !== location.pathname; } catch (e) {}
  if (how !== 'reload' && (how === 'back_forward' || fromSite) && !/[?&]boot\b/.test(location.search)) { B.parentNode.removeChild(B); de.classList.add('booted'); window.__mkBootAt = now(); window.__mkBoot = Promise.resolve(); return; }
  var res; window.__mkBoot = new Promise(function (r) { res = r; });
  if (window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches)
    addEventListener('pointermove', function (e) { S.ptr = { x: e.clientX, y: e.clientY }; }, { passive: true });   // where her cursor dot is (the swoop's target)
  /* SAME ON EVERY DEVICE, Reduce Motion included (her 2026-10-27: "I liked the tilt and the wobbly jitters and stuff that
     the laptop animation has. I don't know what you don't get about exactly the same"): her iPhone's Reduce Motion gave
     the still logo and a fade. The full loader plays everywhere; a tap or key still skips it */
  var rm = false;
  var cast = !rm;
  if (!cast) { V.fly = V.wait = 0; V.breakAt = 140; V.flipT = V.land = V.rise = V.turn = V.crouch = V.exit = 0; V.waves = 0; V.hold = 380; }
  if (rm) { V.liftStyle = 'Fade'; V.lift = 260; }

  /* ---- the stage ---- */
  function el(tag, a, p) { var e = document.createElementNS(NS, tag); for (var k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }
  var S = {}, M = null, T = 0, readyT = null, done = false, last = 0;
  S.ld = document.createElement('div'); S.ld.className = 'mk-ld'; B.appendChild(S.ld);
  S.ld.innerHTML = '<span class="mk-mark"><span class="m">M</span><span class="h1">-</span><span class="h2">-</span><span class="k">K</span><span class="bl"></span></span>';
  var q = function (c) { return S.ld.querySelector('.' + c); };
  S.mark = q('mk-mark'); S.m = q('m'); S.k = q('k'); S.h1 = q('h1'); S.h2 = q('h2'); S.bl = q('bl');
  S.svg = el('svg', { 'class': 'mk-goo', 'aria-hidden': 'true' }); S.ld.appendChild(S.svg);
  var f = el('filter', { id: 'mk-goo', x: '-20%', y: '-60%', width: '140%', height: '220%', 'color-interpolation-filters': 'sRGB' }, el('defs', {}, S.svg));
  S.blur = el('feGaussianBlur', { 'in': 'SourceGraphic', stdDeviation: '0', result: 'b' }, f);
  S.cm = el('feColorMatrix', { 'in': 'b', mode: 'matrix', values: '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0' }, f);
  S.g = el('g', {}, S.svg);
  S.tm = el('text', {}, S.g); S.tm.textContent = 'M';
  S.tk = el('text', {}, S.g); S.tk.textContent = 'K';
  S.strand = el('path', {}, S.g); S.pL = el('path', {}, S.g); S.pR = el('path', {}, S.g);
  /* the goo stays on everything, letters included; only the EMPTY space inside the M and inside the K is kept clear of it
     (her: "the hyphen just bulges into the inside of the M and dont like the internal bulge"). A mask: everywhere allowed,
     except each letter's inside, where only the letter itself (a hair wider, so its goo-rounded edge survives) shows */
  var mk = el('mask', { id: 'mk-in', maskUnits: 'userSpaceOnUse', x: -1e4, y: -1e4, width: 2e4, height: 2e4 }, S.svg.querySelector('defs'));
  el('rect', { x: -1e4, y: -1e4, width: 2e4, height: 2e4, fill: '#fff' }, mk);
  S.mIn = el('g', {}, mk); S.mInR = el('rect', { fill: '#000' }, S.mIn); S.mInT = el('text', { fill: '#fff', stroke: '#fff' }, S.mIn); S.mInT.textContent = 'M';
  S.kIn = el('g', {}, mk); S.kInR = el('rect', { fill: '#000' }, S.kIn); S.kInT = el('text', { fill: '#fff', stroke: '#fff' }, S.kIn); S.kInT.textContent = 'K';
  S.g.setAttribute('mask', 'url(#mk-in)');
  S.drops = [0, 1, 2].map(function () { return el('circle', { r: '0' }, S.g); });
  [S.tm, S.tk, S.strand, S.pL, S.pR].forEach(function (e) { e.setAttribute('fill', V.ink); });
  S.img = {};
  if (cast) ORDER.forEach(function (k) {
    var im = new Image(); im.decoding = 'async'; im.alt = ''; im.className = 'mk-her';
    if ('fetchPriority' in im) im.fetchPriority = 'high';     // she is the loader: her frames come first (~170KB)
    im.src = C.dir + FR[k].f + C.ver; S.ld.appendChild(im); S.img[k] = im;
  });
  /* all her frames in AND decoded, so the first time each one shows it is already a picture, not a blank */
  var framesIn = !cast ? Promise.resolve() : Promise.all(ORDER.map(function (k) { var im = S.img[k];
    return new Promise(function (r) { var ok = function () { (im.decode ? im.decode() : Promise.resolve()).then(r, r); };
      if (im.complete && im.naturalWidth) ok(); else { im.addEventListener('load', ok); im.addEventListener('error', r); } }); }));

  /* ---- measuring: the real wordmark, laid out by the browser, tells us where everything goes ---- */
  function glyph(font, fs) {
    var W = Math.ceil(fs * 1.2), H = Math.ceil(fs * 1.4), pad = Math.ceil(fs * .2), base = Math.ceil(fs);
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d'); x.font = font; x.fillText('-', pad, base);
    var d = x.getImageData(0, 0, W, H).data, cols = [];
    for (var i = 0; i < W; i++) { var sum = 0, wy = 0; for (var j = 0; j < H; j++) { var a = d[(j * W + i) * 4 + 3] / 255; sum += a; wy += a * j; } if (sum > .3) cols.push({ x: i, c: wy / sum, t: sum }); }
    var n = cols.length; if (!n) return { l: 0, r: fs * .3, cy: -fs * .3, stroke: fs * .08 };
    var mid = cols.slice(Math.floor(n * .2), Math.ceil(n * .8)), ths = mid.map(function (p) { return p.t; }).sort(function (a, b) { return a - b; });
    var cy = mid.reduce(function (s, p) { return s + p.c; }, 0) / mid.length;
    return { l: cols[0].x - pad, r: cols[n - 1].x + 1 - pad, cy: cy - base, stroke: ths[ths.length >> 1] };
  }
  /* where a letter's INK is, read from pixels: Safari's measureText gives the advance box for actualBoundingBox*, not the
     ink, so on iPhones the M ran 6px long, the K started 6px early, the stretch came out short and the goo pockets inside
     the letters sat in the wrong place (her: "I want the gooeyness to be the same on the laptop and the iPhone") */
  function ink(font, fs, ch) {
    var W = Math.ceil(fs * 1.6), H = Math.ceil(fs * 1.4), pad = Math.ceil(fs * .2), base = Math.ceil(fs);
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d'); x.font = font; x.fillText(ch, pad, base);
    var d = x.getImageData(0, 0, W, H).data, l = W, r = -1, t = H;
    for (var j = 0; j < H; j++) for (var i = 0; i < W; i++) if (d[(j * W + i) * 4 + 3] > 127) { if (i < l) l = i; if (i > r) r = i; if (j < t) t = j; }
    if (r < 0) { var m = x.measureText(ch); return { actualBoundingBoxLeft: 0, actualBoundingBoxRight: m.width, actualBoundingBoxAscent: fs * .72 }; }
    return { actualBoundingBoxLeft: pad - l, actualBoundingBoxRight: r + 1 - pad, actualBoundingBoxAscent: base - t };
  }
  function measure() {
    var lr = S.ld.getBoundingClientRect(), base = S.bl.getBoundingClientRect().top - lr.top, cs = getComputedStyle(S.mark);
    var font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily, fs = parseFloat(cs.fontSize), g = glyph(font, fs);
    var mm = ink(font, fs, 'M'), mk = ink(font, fs, 'K');
    var L = function (e) { return e.getBoundingClientRect().left - lr.left; };
    var mx = L(S.m), kx = L(S.k), h1 = L(S.h1), h2 = L(S.h2);
    M = { fs: fs, base: base, W: lr.width, H: lr.height, g: g, mx: mx, kx: kx,
          mR: mx + mm.actualBoundingBoxRight, kL: kx - mk.actualBoundingBoxLeft,
          a: { l: h1 + g.l, r: h1 + g.r }, b: { l: h2 + g.l, r: h2 + g.r }, y0: base + g.cy };
    S.svg.setAttribute('viewBox', '0 0 ' + lr.width + ' ' + lr.height);
    [S.tm, S.tk, S.mInT, S.kInT].forEach(function (t) { t.setAttribute('style', 'font:' + font + ';letter-spacing:0'); });
    [S.mInT, S.kInT].forEach(function (t) { t.setAttribute('stroke-width', (fs * .03).toFixed(2)); });
    /* each letter's inside: between its two stems (M), right of its stem (K), in the letter's own coordinates */
    var st = g.stroke * 1.25, cap = mm.actualBoundingBoxAscent, mL = -mm.actualBoundingBoxLeft, kR = mk.actualBoundingBoxRight;
    S.mInR.setAttribute('x', (mL + st).toFixed(1)); S.mInR.setAttribute('width', Math.max(0, mm.actualBoundingBoxRight - mL - 2 * st).toFixed(1)); S.mInR.setAttribute('y', (-cap).toFixed(1)); S.mInR.setAttribute('height', cap.toFixed(1));
    S.kInR.setAttribute('x', (-mk.actualBoundingBoxLeft + st).toFixed(1)); S.kInR.setAttribute('width', Math.max(0, kR + mk.actualBoundingBoxLeft - st).toFixed(1)); S.kInR.setAttribute('y', (-cap).toFixed(1)); S.kInR.setAttribute('height', cap.toFixed(1));
  }

  /* ---- time ---- */
  function seg(b, t) { return Math.max(0, Math.min(1, (t - b.s) / Math.max(1, b.d))); }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function sys(u) { var lo = 0, hi = 1; for (var i = 0; i < 20; i++) { var m = (lo + hi) / 2, x = 3 * m * (1 - m) * (1 - m) * .2 + 3 * m * m * (1 - m) * .2 + m * m * m; if (x < u) lo = m; else hi = m; } var t = (lo + hi) / 2; return 3 * t * (1 - t) * (1 - t) * .7 + 3 * t * t * (1 - t) + t * t * t; }
  function wob(ms, hz, z) { if (ms <= 0) return 0; var s = ms / 1000; return Math.exp(-s * z) * Math.sin(2 * Math.PI * hz * s); }
  function spring(ms, stiff, damp) { if (ms <= 0) return 0; var w = Math.sqrt(stiff), z = damp / (2 * w), s = ms / 1000;
    if (z < 1) { var wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * s) * (Math.cos(wd * s) + z * w / wd * Math.sin(wd * s)); }
    return 1 - Math.exp(-w * s) * (1 + w * s); }
  function arc(y0, y1, apex, u) { var yc = apex - Math.sqrt(Math.max(0, (apex - y0) * (apex - y1))); return (1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * yc + u * u * y1; }
  /* the stretch is EXACTLY her tweaker's (her 2026-10-27: "this is not what I created in the tweaker"): her duration and her
     easing (with or without the loading stalls). If the page isn't ready when it's fully stretched, M and K hold at full
     stretch, still struggling, until it is; then the strand snaps as designed */
  var FILL0 = V.markIn / V.tempo, FILLD = (V.fill || 1000) / V.tempo;
  function fillEnd() { return readyT === null ? 1e12 : Math.max(readyT, FILL0 + FILLD); }
  function ease(u) { return 1 - Math.pow(1 - u, 3); }
  function prog(t) {
    var u = Math.max(0, Math.min(1, (t - FILL0) / FILLD));
    if (!V.stalls) return ease(u);
    return u < .4 ? .6 * ease(u / .4) : u < .62 ? .6 + .08 * (u - .4) / .22 : .68 + .32 * ease((u - .62) / .38);
  }
  function beats() {
    var k = 1 / V.tempo, b = {}, at = 0, fe = fillEnd();
    [['in', V.markIn], ['fill', null], ['wait', V.wait], ['fly', V.fly], ['land', V.breakAt], ['flip', V.flipT], ['flipLand', V.land], ['rise', V.rise],
     ['wave', V.waves * V.waveCycle], ['turn', V.turn], ['load', V.crouch], ['exit', V.exit], ['hold', V.hold], ['lift', V.lift]].forEach(function (x) {
      var d = x[1] === null ? fe - at : x[1] * k; b[x[0]] = { s: at, d: d }; at += d; });
    b.end = at; return b;
  }
  /* flat0 / flat1: a square end instead of a round one. The ends that meet a letter are flat (her: "the hyphen just
     bulges into the inside of the M"): a round end sat inside the letter's leg and the goo spread it into the M's inner gap */
  function taper(x0, y0, cx, cy, x1, y1, wf, flat0, flat1) {
    var N = 20, Lp = [], Rp = [];
    for (var i = 0; i <= N; i++) {
      var u = i / N, a = 1 - u, x = a * a * x0 + 2 * a * u * cx + u * u * x1, y = a * a * y0 + 2 * a * u * cy + u * u * y1;
      var dx = 2 * a * (cx - x0) + 2 * u * (x1 - cx), dy = 2 * a * (cy - y0) + 2 * u * (y1 - cy), n = Math.sqrt(dx * dx + dy * dy) || 1, h = wf(u) / 2;
      Lp.push([x - dy / n * h, y + dx / n * h]); Rp.push([x + dy / n * h, y - dx / n * h]);
    }
    var h0 = wf(0) / 2, h1 = wf(1) / 2, d = 'M' + Lp[0][0].toFixed(1) + ' ' + Lp[0][1].toFixed(1);
    for (var j = 1; j <= N; j++) d += 'L' + Lp[j][0].toFixed(1) + ' ' + Lp[j][1].toFixed(1);
    d += flat1 ? 'L' + Rp[N][0].toFixed(1) + ' ' + Rp[N][1].toFixed(1) : 'A' + h1.toFixed(1) + ' ' + h1.toFixed(1) + ' 0 0 0 ' + Rp[N][0].toFixed(1) + ' ' + Rp[N][1].toFixed(1);
    for (var k2 = N - 1; k2 >= 0; k2--) d += 'L' + Rp[k2][0].toFixed(1) + ' ' + Rp[k2][1].toFixed(1);
    return d + (flat0 ? 'Z' : 'A' + h0.toFixed(1) + ' ' + h0.toFixed(1) + ' 0 0 0 ' + Lp[0][0].toFixed(1) + ' ' + Lp[0][1].toFixed(1) + 'Z');
  }
  function lean(t, x, deg) { t.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + M.base.toFixed(1) + ') skewX(' + (-deg).toFixed(2) + ')'); }

  /* ---- one frame ---- */
  function draw() {
    var b = beats(), t = T, fs = M.fs, H = fs * V.her, sc = H / 252, g = M.g, th = g.stroke * V.thick;
    /* her pixel values (sag, tug, tremble, bounce, dips, drops) were tuned on the 150px laptop logo; on a phone the logo is
       ~20vw, so they scale with it (her: "the loading animation on the phone looks nothing like the laptop") */
    var z = fs / V.fs;
    var ui = rm ? 1 : sys(seg(b.in, t)), rise = (1 - ui) * 28 * z;
    S.svg.style.opacity = ui; S.svg.style.transform = 'translateY(' + rise.toFixed(1) + 'px)';
    var y0 = M.y0, p = rm ? 1 : prog(t);
    var stuck = V.stuck * (M.kL - M.mR) / 2, tb = b.land.s + b.land.d, tt = t - tb;
    var fighting = !rm && p > 0 && t < tb, ts = t / 1000 * V.tempo;
    var shake = fighting ? (Math.sin(ts * 2 * Math.PI * V.shakeHz) + .5 * Math.sin(ts * 2 * Math.PI * V.shakeHz * 1.7 + 1)) * V.shake : 0;
    var tremble = fighting ? (Math.sin(ts * 2 * Math.PI * V.tugHz) * .7 + Math.sin(ts * 2 * Math.PI * V.tugHz * 2.3 + 2) * .3) * V.tremble * z : 0;
    var off = stuck * (1 - p) - tremble;
    var su = cast && t >= b.land.s && tt < 0 ? Math.sin(Math.min(1, (t - b.land.s) / Math.max(1, b.land.d)) * Math.PI / 2) : tt >= 0 && cast ? 1 : 0;
    var sag = V.sag * z * su, tug = V.tug * z * su * (tt < 0 ? 1 : 0);
    var o = tt > 0 ? spring(tt, V.stiff, V.damp) : 0, w = tt > 0 ? wob(tt, V.wobHz, V.wobDie) : 0;
    if (rm) { tt = 1e5; o = 1; w = 0; }
    var tension = tt > 0 ? -V.recoil * w : (fighting ? V.strain : 0) + su * V.strain * .8 + shake;
    lean(S.tm, M.mx + off + tug, tension); lean(S.tk, M.kx - off - tug, -tension);
    lean(S.mIn, M.mx + off + tug, tension); lean(S.kIn, M.kx - off - tug, -tension);   // the masks move with their letters
    /* the strand meets each letter's OUTSIDE edge at its own height, even as the letter leans */
    var leanX = (M.base - y0) * Math.tan(tension * Math.PI / 180);
    var xa = M.mR + off + tug + leanX, xb = M.kL - off - tug - leanX;
    var sw = th * lerp(V.fat, V.thin, Math.pow(p, .7)) * (1 - .15 * su), se = th * lerp(V.fat, V.endFat, Math.pow(p, .7));
    var feetY = y0 + sag - sw / 2;
    if (tt <= 0) {
      S.strand.setAttribute('d', taper(xa, y0, (xa + xb) / 2, y0 + sag * 2, xb, y0, function (u) { return lerp(sw, se, Math.pow(Math.abs(2 * u - 1), V.taper)); }, true, true));
      S.strand.style.display = ''; S.pL.style.display = S.pR.style.display = 'none';
    } else {
      S.strand.style.display = 'none'; S.pL.style.display = S.pR.style.display = '';
      var pinch = rm ? 1 : spring(tt - V.pinch / V.tempo, V.stiff * .8, V.damp), mid = (xa + xb) / 2, dip = sag * (1 - Math.min(1, o));
      var ldv = cast && t >= b.flipLand.s ? V.landDip * z * wob(t - b.flipLand.s, V.wobHz * 1.3, V.wobDie) : 0;
      [[S.pL, M.mR + leanX, M.a.l + th / 2, mid, M.a.r - th / 2], [S.pR, M.kL - leanX, M.b.r - th / 2, mid, M.b.l + th / 2]].forEach(function (h, i) {
        var dd = i === 1 ? ldv : 0, root = lerp(h[1], h[2], pinch), tip = lerp(h[3], h[4], o), ty = y0 + dip + V.bounce * z * w + dd, oc = Math.min(1, o);
        var wr = lerp(se, th, oc), wt = lerp(sw * .7, th, oc);
        h[0].setAttribute('d', taper(root, y0 + dd, (root + tip) / 2, (y0 + dd + ty) / 2, tip, ty, function (u) { return lerp(wr, wt, Math.pow(u, 1 / Math.max(.5, V.taper))); }, pinch < .5));   // flat while it still holds the letter
      });
      feetY = y0 - th / 2 + dip;
    }
    S.drops.forEach(function (c, i) {
      var on = !rm && tt > 0 && tt < 700; if (!on) { c.setAttribute('r', 0); return; }
      var s = tt / 1000, dir = i === 1 ? 0 : i ? 1 : -1;
      c.setAttribute('cx', ((M.mR + M.kL) / 2 + dir * (60 + i * 20) * z * s).toFixed(1));
      c.setAttribute('cy', (y0 + sag + ((-120 - i * 40) * s + 900 * s * s) * z).toFixed(1));
      c.setAttribute('r', (th * (.55 - i * .1) * Math.max(0, 1 - s / .7)).toFixed(2)); c.setAttribute('fill', V.ink);
    });
    var set = tt > 0 ? Math.min(1, Math.max(0, (tt - V.setAfter / V.tempo) / (V.setFor / V.tempo))) : 0;
    var gb = rm ? 0 : V.goo * fs / 100 * (1 - set);   // the goo always, exactly as designed: no device ever gets a flatter version
    if (gb > .05) { S.g.setAttribute('filter', 'url(#mk-goo)'); S.blur.setAttribute('stdDeviation', gb.toFixed(2)); S.cm.setAttribute('values', '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ' + V.sharp + ' -' + (V.sharp * .45).toFixed(2)); }
    else S.g.removeAttribute('filter');                       // no filter at all once it has set: nothing left to compute

    /* the loader leaves: two doors opening at the gap, onto the page */
    var lu = seg(b.lift, t), midX = (M.mR + M.kL) / 2;
    if (V.liftStyle === 'Doors' && t >= b.lift.s) {
      if (!S.ld2) { S.ld2 = S.ld.cloneNode(true); B.appendChild(S.ld2); B.style.background = 'transparent'; }
      var e = lu < .5 ? 4 * lu * lu * lu : 1 - Math.pow(-2 * lu + 2, 3) / 2, far = Math.max(midX, M.W - midX) + 40;
      S.ld.style.clipPath = 'inset(0 ' + (M.W - midX) + 'px 0 0)'; S.ld.style.transform = 'translateX(' + (-e * far) + 'px)';
      S.ld2.style.clipPath = 'inset(0 0 0 ' + midX + 'px)'; S.ld2.style.transform = 'translateX(' + (e * far) + 'px)';
    } else if (V.liftStyle === 'Drop' && t >= b.lift.s && safeDrop(lu)) {
    } else if (t >= b.lift.s) B.style.opacity = 1 - lu * lu;

    /* her */
    if (!cast) return;
    var top = (t < b.land.s ? y0 - sw / 2 : feetY) + rise, k = null, x = midX, fy = top, spin = 0;
    var hx = (M.b.l + M.b.r) / 2, hyTop = y0 - th / 2 + rise + (t >= b.flipLand.s ? V.landDip * z * wob(t - b.flipLand.s, V.wobHz * 1.3, V.wobDie) : 0);
    if (t >= b.flip.s) x = hx;
    if (t >= b.fly.s && t < b.fly.s + b.fly.d) {
      /* her path in, measured from the letters, not the screen edge: it was "from the bottom of the screen", which on a tall
         phone is twice as far below the letters as on the laptop, so she flew a steeper, different arc (her: "the jump isn't
         lined up properly"). 3.15 logo-heights below is where the laptop she approved starts (1440x900); a big screen where
         that point is still on screen starts her below the bottom edge instead, so she never pops in mid-air */
      var u = seg(b.fly, t), x0 = midX - V.fromX * fs, sy = top + 3.15 * fs, fu1 = Math.max(0, Math.min(1, (u - .14) / .7));
      if (x0 > 0 && sy < M.H + H * .2) sy = M.H + H * .2;
      x = x0 + (midX - x0) * u; fy = arc(sy, top, top - V.apex * H, u);
      k = u < .14 ? 'j4' : u < .84 ? 'j7' : u < .92 ? 'j8' : 'j9';
      spin = k === 'j7' ? 360 * (1 - Math.pow(1 - fu1, 1.6)) : 0;          // the hero's spinning tuck flip, on the way in
    } else if (t >= b.land.s && t < b.flip.s) {
      k = ['j10', 'j11', 'j12', 'j13'][Math.min(3, Math.floor(seg(b.land, t) * 4))];
    } else if (t >= b.flip.s && t < b.flipLand.s) {                     // the snap: a hop onto the right hyphen
      var fu = seg(b.flip, t); x = lerp(midX, hx, fu); fy = arc(top, hyTop, Math.min(top, hyTop) - V.hopH * H, fu);
      k = fu < .15 ? 'j4' : fu < .4 ? 'j6' : fu < .75 ? 'j7' : fu < .9 ? 'j8' : 'j9';
    } else if (t >= b.flipLand.s && t < b.rise.s) { k = ['j10', 'j11', 'j12', 'j13'][Math.min(3, Math.floor(seg(b.flipLand, t) * 4))]; fy = hyTop; }
    else if (t >= b.rise.s && t < b.wave.s) { k = ['j14', 'j15', 'j24', 'w27'][Math.min(3, Math.floor(seg(b.rise, t) * 4))]; fy = hyTop; }
    else if (t >= b.wave.s && t < b.turn.s) { var wu = (t - b.wave.s) / (V.waveCycle / V.tempo); k = wu < .25 ? 'w27' : Math.floor(wu * 2) % 2 ? 'w29' : 'w28'; fy = hyTop; }
    else if (t >= b.turn.s && t < b.load.s) { k = seg(b.turn, t) < .5 ? 'w27' : 'j24'; fy = hyTop; }
    else if (t >= b.load.s && t < b.exit.s) { k = seg(b.load, t) < .5 ? 'j3' : 'j0'; fy = hyTop; }
    else if (t >= b.exit.s && t < b.hold.s) {
      var eu = seg(b.exit, t), x1 = hx + V.toX * fs, ey = hyTop + 4.61 * fs;   // her path out, the same way: the laptop's, from the letters
      if (x1 < M.W && ey < M.H + H * 1.3) ey = M.H + H * 1.3;
      x = hx + (x1 - hx) * eu; fy = arc(hyTop, ey, hyTop - V.exitApex * H, eu);
      k = eu < .12 ? 'j4' : eu < .25 ? 'j5' : eu < .42 ? 'j6' : eu < .6 ? 'j7' : 'j8';
    }
    if (k !== S.cur) { if (S.cur) S.img[S.cur].style.display = 'none'; if (k) S.img[k].style.display = 'block'; S.cur = k; }
    if (k) { var fr = FR[k], im = S.img[k]; im.style.width = (fr.w * sc).toFixed(1) + 'px';
      im.style.transform = 'translate(' + (x - fr.cx * sc).toFixed(1) + 'px,' + (fy - fr.base * sc).toFixed(1) + 'px) rotate(' + spin.toFixed(1) + 'deg)'; }
  }

  /* LINE, DOT, DROP, POP (her 2026-10-27: "collapse into a circle and drop out of the screen and then pop in the upper corner",
     then "have the loading animation collapse into a line. then a small dot and then drop"), like the corner toggle's exit:
       0–32%   M--K squashes down onto its hyphen line, the goo melting it into ONE line as wide as the logo
       32–56%  the line draws in from both ends to a small dot (a hyphen's thickness)
       56–66%  the dot bounces once and holds
       66–100% it drops off the bottom, accelerating and stretching along the fall, while the page fades in
     then finish() pops the nav logo in, in the upper corner (.wm-pop). The home page's wordmark greeting is dropped (the pop
     is the greeting) and the nav logo stays hidden until then */
  /* if the drop ever throws, the loader falls back to a plain fade and the nav logo is put back, never left hidden */
  function safeDrop(lu) { try { return !S.dropFail && dropOut(lu); } catch (e) { S.dropFail = true; if (S.navA) S.navA.style.opacity = ''; return false; } }
  function dropOut(lu) {
    if (!S.drop) {
      S.navA = document.querySelector('.wordmark'); if (S.navA) { S.navA.classList.remove('wm-load'); S.navA.style.opacity = '0'; }
      var th = M.g.stroke * V.thick, cap = M.fs * .72, mr = S.tm.getBoundingClientRect(), kr = S.tk.getBoundingClientRect(), lr = S.ld.getBoundingClientRect();
      S.drop = { l: mr.left - lr.left, r: kr.right - lr.left, cy: M.y0, th: th, cap: cap, R: Math.max(2.5, th * .25) };   // the dot, in proportion to the thin line: ~7px across on a laptop, about twice the line (her: "if the line is thinner the dot needs to be similarly smaller")
      S.drop.cx = (S.drop.l + S.drop.r) / 2;
      S.g.removeAttribute('mask');
      S.line = el('rect', { fill: V.ink }, S.svg); B.style.background = 'transparent';
      if (S.ptr) de.classList.add('boot-swoop');   // the page's cursor dot waits until this dot has landed in it: never two dots
    }
    var d = S.drop, io = function (u) { return u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }, TL = Math.max(2, d.th * .2);   // the line: a fifth of a hyphen, 3px on a laptop (her: "make the line thinner", twice)
    var u1 = Math.min(1, lu / .28), u2 = Math.max(0, Math.min(1, (lu - .28) / .18)), u4 = Math.max(0, (lu - .68) / .32), tb = Math.max(0, lu - .46) * V.lift / V.tempo;
    /* 1: the letters squash onto the hyphens' line and hand over to ONE thin solid line as wide as the logo */
    var ky = 1 - (1 - TL / d.cap) * io(u1), hand = Math.max(0, Math.min(1, (u1 - .55) / .4));
    S.g.setAttribute('transform', 'translate(0 ' + d.cy + ') scale(1 ' + ky.toFixed(4) + ') translate(0 ' + (-d.cy) + ')');
    S.g.style.opacity = (1 - hand).toFixed(3);
    /* 2: it draws in from both ends, speeding up, and SLAMS into the dot · 3: the dot rings out like a spring (her: "make the
       collapse into the dot bouncier"): narrow-and-tall first (still carrying the draw-in), then wide-and-flat, three times,
       dying away · 4: the drop, stretching as it falls */
    var w = (d.r - d.l) - ((d.r - d.l) - 2 * d.R) * Math.pow(u2, 2.2), h = TL + (2 * d.R - TL) * Math.pow(u2, 6);   // it stays a thin line until the last moment, then balls up into the dot
    if (u2 >= 1) { var wb = u4 > 0 ? 0 : -Math.exp(-tb / 110) * Math.sin(2 * Math.PI * tb / 140), st = 1 + 1.2 * u4 * u4;
      w = 2 * d.R * (1 + .55 * wb) / Math.sqrt(st); h = 2 * d.R * (1 - .4 * wb) * st; }
    var fall = (M.H - d.cy + d.R * 4) * u4 * u4, X = d.cx, Y = d.cy + fall;
    /* INTO HER CURSOR (her 2026-10-27: "instead of dropping out of the page … it starts falling then swoops into my dot
       cursor"): with a mouse that has moved, the dot starts to fall, then curves up into the pointer, growing to the cursor
       dot's size and taking its blue; the page's own cursor dot takes over exactly there. No pointer (a phone, or a mouse
       that hasn't moved): it drops out of the page as before */
    if (S.ptr && u4 > 0) {
      var f0 = .3, fu = Math.min(u4, f0) / f0, y0 = d.cy + (M.H - d.cy) * .22 * fu * fu;      // a short fall first
      if (u4 <= f0) Y = y0;
      else { var q = (u4 - f0) / (1 - f0), e = q < .5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2, ax = d.cx, ay = d.cy + (M.H - d.cy) * .22,
          cx2 = ax, cy2 = Math.max(ay, S.ptr.y) + Math.min(160, M.H * .2), bx = S.ptr.x, by = S.ptr.y;   // a curve that dips under, then rises into the pointer
        X = (1 - e) * (1 - e) * ax + 2 * e * (1 - e) * cx2 + e * e * bx; Y = (1 - e) * (1 - e) * ay + 2 * e * (1 - e) * cy2 + e * e * by;
        var z = d.R + (6.5 - d.R) * e; w = h = 2 * z;                                            // to the cursor dot's 13px
        S.line.setAttribute('fill', e > .5 ? '#8fb2f2' : V.ink); S.line.style.transition = 'fill .25s linear'; }
    }
    S.line.setAttribute('x', (X - w / 2).toFixed(2)); S.line.setAttribute('width', w.toFixed(2));
    S.line.setAttribute('y', (Y - h / 2).toFixed(2)); S.line.setAttribute('height', h.toFixed(2));
    S.line.setAttribute('rx', (Math.min(w, h) / 2).toFixed(2)); S.line.style.opacity = hand.toFixed(3);
    S.ld.style.background = 'rgba(15,16,19,' + (1 - u4 * u4).toFixed(3) + ')';
    return true;
  }

  /* ---- running it ---- */
  /* QA only: lets the checks freeze the loader at a moment to compare it with the tweaker frame by frame */
  var held = false; window.__mkBootQA = { M: function () { return M; }, seek: function (t) { held = true; T = t; if (readyT === null) readyT = 0; if (T >= beats().end) return finish(); draw(); } };
  var qs = /[?&]bootseek=(\d+)/.exec(location.search); if (qs) setTimeout(function () { window.__mkBootQA.seek(+qs[1]); }, 3000);   // ?boot&bootseek=1500: freeze there (for comparing devices where no script can be run, iPhone Safari)
  function tick(nw) {
    if (done || held) return;
    var dt = last ? Math.min(nw - last, 100) : 16; last = nw;
    if (!rm || readyT !== null) T += dt;
    var b = beats();
    if (rm && readyT !== null && T < b.lift.s) T = b.lift.s;
    if (T >= b.end) return finish();
    draw();
    requestAnimationFrame(tick);
  }
  function finish() {
    if (done) return; done = true;
    if (S.navA) { S.navA.style.opacity = ''; S.navA.classList.add('wm-pop'); }
    de.classList.remove('boot-swoop');
    if (S.ptr && S.drop) { try { dispatchEvent(new PointerEvent('pointermove', { clientX: S.ptr.x, clientY: S.ptr.y })); } catch (e) {} }   // the page's cursor dot appears right where the loader's dot landed
    de.classList.add('booted'); window.__mkBootAt = now(); res();
    if (B.parentNode) B.parentNode.removeChild(B);
  }
  /* ready = the page has loaded AND her frames are in. The page alone may stop waiting at the cap; her frames are
     never skipped (a last-resort ceiling, 30s, exists only so a broken network can't trap anyone) */
  var pageIn = false, herIn = false;
  function ready() { if (readyT === null) readyT = T; }
  function check() { if (pageIn && herIn) ready(); }
  framesIn.then(function () { herIn = true; check(); });
  if (document.readyState === 'complete') pageIn = true; else addEventListener('load', function () { pageIn = true; check(); });
  setTimeout(function () { pageIn = true; check(); }, Math.max(0, C.cap - now()));
  function cutShort() { if (readyT === null) { herIn = pageIn = true; if (cast && !S.allIn()) { cast = false; V.fly = V.wait = 0; V.breakAt = 140; V.flipT = V.land = V.rise = V.turn = V.crouch = V.exit = 0; V.waves = 0; V.hold = 380; } ready(); } }
  /* a slow connection gets the SHORT loader (her 2026-10-27 pick, after slow 3G measured the headline at 20.5s against 7s
     live): if her frames still aren't all in after C.slow, she sits this one out and M--K goes straight to the dot and
     drops, so the page shows by ~8s. Fast connections never reach this: her frames are in long before.
     Counted from when the loader starts, not from navigation start (her: "the loading animation on the phone looks nothing
     like the laptop"): on cellular the page itself can take seconds to arrive, which used the timer up before her frames
     had a chance, so phones got the short loader on connections that load her fine. Not one frame in by half that is a
     truly slow link: cut then, so slow 3G stays as quick as before */
  setTimeout(function () { if (!S.anyIn()) cutShort(); }, C.slow / 2);
  setTimeout(function () { if (!S.allIn()) cutShort(); }, C.slow);
  setTimeout(cutShort, Math.max(0, 30000 - now()));
  S.anyIn = function () { for (var k in S.img) if (S.img[k].complete && S.img[k].naturalWidth) return true; return false; };
  S.allIn = function () { for (var k in S.img) if (!S.img[k].complete || !S.img[k].naturalWidth) return false; return true; };
  check();
  function skip() { ready(); var b = beats(); if (T < b.lift.s) T = b.lift.s; }
  B.addEventListener('pointerdown', skip); addEventListener('keydown', function onk() { removeEventListener('keydown', onk); if (!done) skip(); });

  /* start once the wordmark's face is in (or after a moment without it, in the fallback) */
  var go = function () { if (S.started) return; S.started = true; try { measure(); } catch (e) { return finish(); } requestAnimationFrame(tick); };
  if (document.fonts && document.fonts.load) document.fonts.load('600 100px "Plus Jakarta Sans"').then(function () { if (S.started && !done) measure(); else go(); }, go);
  /* "sometimes the m--k doesnt stretch as far" (her 2026-10-27): on a slow connection the loader starts at 1.5s in the fallback
     face and was measured in it; when her face arrives, the letters, the stretch and the hyphens are measured again */
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', function () { if (S.started && !done) measure(); });
  setTimeout(go, 1500);
  addEventListener('resize', function () { if (!done && S.started) measure(); });
  /* Safari can lay the mark out in her face AFTER the font events above have fired, so it was measured in the fallback
     face and kept those spacings: M and K sat closer than on the laptop. Any change in the mark's size measures again */
  if (window.ResizeObserver) new ResizeObserver(function () { if (!done && S.started) measure(); }).observe(S.mark);
})();
