/* THE PAPER-AIRPLANE RESUME (her ask 2026-10-24: "a claymation of me folding up the resume into a paper airplane and
   then throwing it towards the screen and the paper airplane get super large … transitions into my resume"; then, on
   seeing a full-screen clip: "too zoomed in. I wanted the person on the screen to go do it on the screen", and "the
   path of the paper airplane to glide around and fly super close to the screen sideways swiftly").

   Any link to resume.pdf is taken over. If clay-her is standing on screen (the home hero), SHE does it, in her spot and
   at her size: a keyed Flora clip (assets/resume-throw.png, 62 frames at 12fps) of her folding the resume and throwing
   it stands in for her while stickman.js hides her own drawing. At the release frame a paper plane
   (assets/resume-plane.png) leaves her hand and GSAP flies it: up and around the page in long gliding curves, growing
   as it comes nearer, then a fast sideways pass right across the glass, huge, and as it covers the screen it whites
   out into the resume page (Download / Open / Close). Elsewhere (case studies, or she's scrolled away) the plane takes
   the same flight from the link that was clicked. Reduced motion, a modifier-click or a middle-click keep the plain
   PDF. */
(function () {
  var me = document.currentScript && document.currentScript.src || '';
  var base = me.replace(/resume-plane\.js.*$/, ''), ver = (me.match(/\?v=[^&#]*/) || [''])[0];
  var THROW = base + 'assets/resume-throw.png' + ver, PLANE = base + 'assets/resume-plane.png' + ver;
  var PAGE = base + 'assets/resume-page.jpg' + ver, PDF = base + 'assets/resume.pdf' + ver;
  /* the throw sheet (clay-character keying, half size): cells, her feet and centre in a cell, where the plane is at
     the release frame, her height in a cell */
  var SP = { n: 62, cols: 8, fw: 119, fh: 175, fps: 12, feet: 170, cx: 50.5, figH: 154, release: 44, plane: [64, 28.5] };
  var NOSE = 25 * Math.PI / 180;   // the plane picture's nose points right and ~25° down
  var rm = function () { return matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('rm-mode'); };
  var el, flash, sheet, opener, busy = false;

  function css() {
    var c = document.createElement('style');
    c.textContent =
      '.rz{position:fixed;inset:0;z-index:2147483000;opacity:0;visibility:hidden;transition:opacity .35s ease,visibility 0s linear .35s}' +
      '.rz.on{opacity:1;visibility:visible;transition:opacity .35s ease}' +
      /* the site hides the system cursor for its own, which sits UNDER this layer (her: "I can't find my cursor") */
      '.rz,.rz *{cursor:auto!important}.rz a,.rz button{cursor:pointer!important}' +
      /* closed means GONE: a child set visible outlives its hidden parent, so the closed page kept catching clicks */
      '.rz:not(.on),.rz:not(.on) *{visibility:hidden!important;pointer-events:none!important}' +
      '.rz-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none}' +
      '.rz-sheet{position:absolute;inset:0;overflow:auto;overscroll-behavior:contain;opacity:0;visibility:hidden;background:#0f1013;padding:84px 16px 48px;-webkit-overflow-scrolling:touch}' +
      '.rz-sheet.on{visibility:visible}' +
      '.rz-sheet img{display:block;width:min(880px,100%);height:auto;margin:0 auto;background:#fff;border-radius:6px;box-shadow:0 30px 80px rgba(0,0,0,.5)}' +
      '.rz-bar{position:fixed;top:0;left:0;right:0;display:flex;justify-content:flex-end;align-items:center;gap:10px;padding:20px clamp(16px,4vw,56px);background:linear-gradient(#0f1013 55%,rgba(15,16,19,0))}' +
      '.rz-bar a,.rz-bar button{font:500 15px/1 "Plus Jakarta Sans",system-ui,sans-serif;display:inline-flex;align-items:center;min-height:40px;padding:0 18px 2px;border-radius:999px;border:1px solid rgba(169,196,245,.55);background:none;color:#e9eaee;text-decoration:none}' +
      '.rz-bar a.rz-dl{background:#fff;border-color:#fff;color:#111}' +
      '.rz-bar :focus-visible{outline:2px solid #8fb2f2;outline-offset:2px}' +
      '.rz-bar .rz-title{margin-right:auto;color:#9aa0ad;font:300 15px/1 "Plus Jakarta Sans",system-ui,sans-serif}' +
      /* her throw, standing in for her, and the flying plane: above the page, below the resume layer */
      '.rz-her{position:fixed;z-index:2147482990;pointer-events:none;background-repeat:no-repeat}' +
      '.rz-plane{position:fixed;left:0;top:0;z-index:2147482995;pointer-events:none;will-change:transform;transform-origin:50% 50%;filter:drop-shadow(0 18px 24px rgba(0,0,0,.35))}';
    document.head.appendChild(c);
  }
  function build() {
    css();
    el = document.createElement('div');
    el.className = 'rz'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Resume');
    el.innerHTML = '<div class="rz-flash"></div><div class="rz-sheet"><div class="rz-bar"><span class="rz-title">Resume</span>' +
      '<a class="rz-dl" href="' + PDF + '" download="Madhumita-Krishnan-Resume.pdf">Download PDF</a>' +
      '<a href="' + PDF + '" target="_blank" rel="noopener">Open</a><button class="rz-x" type="button">Close</button></div>' +
      '<img alt="Madhumita Krishnan, resume" src="' + PAGE + '"></div>';
    document.body.appendChild(el);
    flash = el.querySelector('.rz-flash'); sheet = el.querySelector('.rz-sheet');
    el.querySelector('.rz-x').addEventListener('click', close);
    sheet.addEventListener('click', function (e) { if (e.target === sheet) close(); });   // the dark around the page
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && el.classList.contains('on')) close(); });
    new Image().src = THROW; new Image().src = PLANE;   // warm both
  }
  var gsapReady = function () {
    if (window.gsap) return Promise.resolve();
    return new Promise(function (ok) { var s = document.createElement('script'); s.src = base + 'vendor/gsap.min.js' + ver; s.onload = s.onerror = ok; document.head.appendChild(s); });
  };

  /* the resume itself: white, then the page settles out of it */
  function showSheet(fromWhite) {
    if (!el) build();
    el.classList.add('on');
    document.documentElement.style.overflow = 'hidden';
    sheet.classList.add('on'); sheet.scrollTop = 0;
    var img = sheet.querySelector('img');
    if (window.gsap && !rm()) {
      gsap.set(flash, { opacity: fromWhite ? 1 : 0 });
      gsap.timeline()
        .set(sheet, { opacity: 1 })
        .fromTo(img, { scale: 1.18, y: 30, transformOrigin: '50% 0%' }, { scale: 1, y: 0, duration: .9, ease: 'expo.out', clearProps: 'transform' })
        .to(flash, { opacity: 0, duration: .6, ease: 'power2.out' }, '<')
        .fromTo(sheet.querySelector('.rz-bar'), { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: .4, ease: 'power2.out', clearProps: 'all' }, '-=.45');
    } else { flash.style.opacity = '0'; sheet.style.opacity = '1'; }
    var x = el.querySelector('.rz-x'); x && x.focus({ preventScroll: true });
  }

  /* where clay-her stands on screen, if she's there to do it herself */
  function herOnScreen() {
    var S = window.__stick; if (!S || !S.clayH || !S.clayH()) return null;
    var f = S.fig, c = S.canvas().getBoundingClientRect(), x = c.left + f.x, y = c.top + f.y;
    if (f.state !== 'idle' && f.state !== 'move' && f.state !== 'sign' && f.state !== 'wave') return null;   // mid-air, hanging: just the plane
    if (y < 40 || y > innerHeight || x < 0 || x > innerWidth) return null;
    return { x: x, y: y, h: S.clayH() };
  }

  /* her throw, frame by frame in her spot; calls release(x, y, w) at the throw */
  function playThrow(her, release) {
    var k = her.h / SP.figH, w = SP.fw * k, h = SP.fh * k, d = document.createElement('div');
    d.className = 'rz-her';
    d.style.cssText += ';width:' + w + 'px;height:' + h + 'px;left:' + (her.x - SP.cx * k) + 'px;top:' + (her.y - SP.feet * k) + 'px;' +
      'background-image:url("' + THROW + '");background-size:' + (SP.cols * w) + 'px auto';
    document.body.appendChild(d);
    window.__stick.hide(true);
    var i = 0, show = function () { d.style.backgroundPosition = (-(i % SP.cols) * w) + 'px ' + (-Math.floor(i / SP.cols) * h) + 'px'; };
    show();
    var iv = setInterval(function () {
      i++;
      if (i === SP.release) release(her.x + (SP.plane[0] - SP.cx) * k, her.y + (SP.plane[1] - SP.feet) * k, 70 * k);
      if (i >= SP.n) { clearInterval(iv); d.remove(); window.__stick.hide(false); return; }
      show();
    }, 1000 / SP.fps);
  }

  /* THE FLIGHT: long gliding curves around the page, nearer and bigger as it goes, then a swift sideways pass across
     the glass, huge, which whites out into the resume */
  function fly(x0, y0, w0) {
    var W = innerWidth, H = innerHeight, p = document.createElement('img'), ar = 1241 / 2059;   // the picture's height/width
    p.className = 'rz-plane'; p.src = PLANE; p.alt = '';
    document.body.appendChild(p);
    /* the glide: a Catmull-Rom path through these points (viewport fractions), with the plane's width (fraction of W) */
    var pts = [[x0 / W, y0 / H, w0 / W], [x0 / W + .12, y0 / H - .3, .07], [.82, .14, .1], [.9, .42, .13], [.6, .62, .16],
               [.28, .5, .19], [.12, .28, .22], [-.05, .4, .3]];
    var seg = function (t) {
      var n = pts.length - 1, f = Math.min(n - 1e-6, t * n), i = Math.floor(f), u = f - i;
      var P = function (j) { return pts[Math.max(0, Math.min(n, j))]; }, a = P(i - 1), b = P(i), c = P(i + 1), e = P(i + 2);
      var cr = function (k) { return .5 * (2 * b[k] + (-a[k] + c[k]) * u + (2 * a[k] - 5 * b[k] + 4 * c[k] - e[k]) * u * u + (-a[k] + 3 * b[k] - 3 * c[k] + e[k]) * u * u * u); };
      return [cr(0) * W, cr(1) * H, Math.max(.01, cr(2)) * W];
    };
    var last = null, place = function (x, y, w, bank) {
      var ang = last && Math.hypot(x - last[0], y - last[1]) > .5 ? Math.atan2(y - last[1], x - last[0]) : (last ? last[2] : -0.9);
      var flip = Math.cos(ang) < 0 ? -1 : 1, rot = (flip > 0 ? ang : ang - Math.PI * (ang < 0 ? -1 : 1)) - NOSE * flip;
      p.style.width = w + 'px';
      p.style.transform = 'translate(' + (x - w / 2) + 'px,' + (y - w * ar / 2) + 'px) rotate(' + rot + 'rad) scaleX(' + flip + ')' + (bank ? ' scaleY(' + bank.toFixed(3) + ')' : '');
      last = [x, y, ang];
    };
    var o = { t: 0, s: 0, white: false };
    place(x0, y0, w0);
    gsap.timeline({ onComplete: function () { p.remove(); busy = false; } })
      /* the glide: unhurried, eased in and out, banking as it turns */
      .to(o, { t: 1, duration: 2.6, ease: 'sine.inOut', onUpdate: function () { var q = seg(o.t); place(q[0], q[1], q[2], 1 - .25 * Math.abs(Math.sin(o.t * Math.PI * 3))); } })
      /* the pass: in from the left edge, right up against the glass, tearing across sideways, huge */
      .to(o, { s: 1, duration: .55, ease: 'power3.in', onUpdate: function () {
        var s = o.s, x = (-.05 + 1.75 * s) * W, y = (.4 + .12 * Math.sin(s * Math.PI)) * H, w = (.3 + 3.2 * s * s) * W;
        place(x, y, w); p.style.filter = 'drop-shadow(0 18px 24px rgba(0,0,0,.35)) blur(' + (s * 3).toFixed(1) + 'px)';
        if (s > .55 && !o.white) { o.white = true; showSheet(true); }
      } });
  }

  function start(link) {
    if (busy) return; busy = true; opener = link;
    if (!el) build();
    if (rm()) { showSheet(false); busy = false; return; }
    gsapReady().then(function () {
      if (!window.gsap) { showSheet(false); busy = false; return; }
      var her = herOnScreen();
      if (her) playThrow(her, fly);
      else { var r = link.getBoundingClientRect(); fly(r.left + r.width / 2, r.top + r.height / 2, 40); }
    });
  }

  function close() {
    el.classList.remove('on');
    document.documentElement.style.overflow = '';
    setTimeout(function () { if (!el.classList.contains('on')) { sheet.classList.remove('on'); sheet.style.opacity = '0'; } }, 400);
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }

  var isResume = function (a) { return a && /resume\.pdf/.test(a.getAttribute('href') || '') && !(el && el.contains(a)); };
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!isResume(a) || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    start(a);
  }, true);
  document.addEventListener('pointerover', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (isResume(a) && !el) build();
  }, { passive: true });
})();
