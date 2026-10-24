/* THE PAPER-AIRPLANE RESUME (her ask 2026-10-24: "a claymation of me folding up the resume into a paper airplane and
   then throwing it towards the screen and the paper airplane get super large … transitions into my resume"; then, on
   seeing a full-screen clip: "too zoomed in. I wanted the person on the screen to go do it on the screen", and "the
   path of the paper airplane to glide around and fly super close to the screen sideways swiftly").

   Only the clay resume tile (.cta-resume, beside say hey!) is taken over; other resume links open the PDF.
   If clay-her is standing on screen (the home hero), SHE does it, in her spot and
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
  var SP = { n: 62, cols: 8, fw: 119, fh: 175, fps: 18, feet: 170, cx: 50.5, figH: 154, release: 44, plane: [64, 28.5] };   // 18fps: the fold no longer drags (her: "super disjointed")
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
      '.rz-bar{position:fixed;top:0;left:0;right:0;display:flex;justify-content:space-between;align-items:center;padding:16px clamp(16px,4vw,56px);background:linear-gradient(#0f1013 55%,rgba(15,16,19,0))}' +
      /* = walkthrough.js .arrow-btn + .ic */
      '.rz-ib{flex:none;width:44px;height:44px;padding:0;border-radius:50%;border:1px solid #2a2f3a;display:grid;place-items:center;background:rgba(15,16,19,.75);color:#e9eaee;transition:border-color .2s,transform .3s cubic-bezier(.2,.7,.2,1)}' +
      '.rz-ib:hover{border-color:#5a6070;transform:scale(1.06)}.rz-ib:active{transform:scale(.94)}' +
      '.rz-ib svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}' +
      '.rz-acts{display:flex;align-items:center;gap:10px}' +
      '.rz-toast{font:300 13px/1 "Plus Jakarta Sans",system-ui,sans-serif;color:#9aa0ad;opacity:0;transition:opacity .25s ease;white-space:nowrap}.rz-toast.on{opacity:1}' +
      '.rz-bar :focus{outline:none}.rz-bar :focus-visible{outline:2px solid #8fb2f2;outline-offset:2px}' +
      /* her throw, standing in for her, and the flying plane: above the page, below the resume layer */
      '.rz-her{position:fixed;z-index:2147482990;pointer-events:none;background-repeat:no-repeat}' +
      '.rz-plane{position:fixed;left:0;top:0;z-index:2147482995;pointer-events:none;will-change:transform;transform-origin:50% 50%;filter:drop-shadow(0 18px 24px rgba(0,0,0,.35))}';
    document.head.appendChild(c);
  }
  function build() {
    css();
    el = document.createElement('div');
    el.className = 'rz'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Resume');
    /* the bar in the site's own controls (her: "the buttons here don't feel like they work in my design system … just use
       the download and share and copy icons"): the walkthrough pages' round arrow-buttons and line icons. Back on the
       left; download, share (where the device has a share sheet) and copy-link on the right. */
    var ic = function (d) { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg>'; };
    el.innerHTML = '<div class="rz-flash"></div><div class="rz-sheet"><div class="rz-bar">' +
      '<button class="rz-ib rz-x" type="button" aria-label="Back">' + ic('M19 12 L5 12 M11 6 L5 12 L11 18') + '</button>' +
      '<span class="rz-acts"><span class="rz-toast" role="status" aria-live="polite"></span>' +
      '<a class="rz-ib" href="' + PDF + '" download="Madhumita-Krishnan-Resume.pdf" aria-label="Download the resume">' + ic('M12 4 L12 15 M7 10 L12 15 L17 10 M5 19.5 L19 19.5') + '</a>' +
      (navigator.share ? '<button class="rz-ib rz-share" type="button" aria-label="Share the resume">' + ic('M12 3.5 L12 14 M8 7.5 L12 3.5 L16 7.5 M8.5 10.5 L6.5 10.5 L6.5 20 L17.5 20 L17.5 10.5 L15.5 10.5') + '</button>' : '') +
      '<button class="rz-ib rz-copy" type="button" aria-label="Copy the link to the resume">' + ic('M9 9 L19 9 L19 20 L9 20 Z M15 9 L15 5 L5 5 L5 16 L9 16') + '</button></span></div>' +
      '<img alt="Madhumita Krishnan, resume" src="' + PAGE + '"></div>';
    document.body.appendChild(el);
    flash = el.querySelector('.rz-flash'); sheet = el.querySelector('.rz-sheet');
    el.querySelector('.rz-x').addEventListener('click', close);
    var url = new URL('assets/resume.pdf', base || location.href).href, toast = el.querySelector('.rz-toast');
    var say = function (t) { toast.textContent = t; toast.classList.add('on'); clearTimeout(say.t); say.t = setTimeout(function () { toast.classList.remove('on'); }, 1600); };
    var sh = el.querySelector('.rz-share');
    if (sh) sh.addEventListener('click', function () { navigator.share({ title: 'Madhumita Krishnan, resume', url: url }).catch(function () {}); });
    el.querySelector('.rz-copy').addEventListener('click', function () {
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { say('Link copied'); }, function () { say(url); });
    });
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
    if (matchMedia('(hover: hover)').matches) { var x = el.querySelector('.rz-x'); x && x.focus({ preventScroll: true }); }   // keyboard/desktop only: no ring on a phone
  }

  /* where clay-her stands on screen, if she's there to do it herself. ready = on her feet; a celebration is cut short */
  function herOnScreen() {
    var S = window.__stick; if (!S || !S.clayH || !S.clayH()) return null;
    var f = S.fig, c = S.canvas().getBoundingClientRect(), x = c.left + f.x, y = c.top + f.y;
    if (y < 40 || y > innerHeight + 60 || x < 0 || x > innerWidth) return null;
    if (f.state === 'celeb') { f.celeb = null; f.state = 'idle'; }
    return { x: x, y: y, h: S.clayH(), ready: f.state === 'idle' || f.state === 'move' || f.state === 'sign' || f.state === 'wave' };
  }
  /* WHENEVER she's on screen she makes the plane herself (her 2026-10-24: "I want the paper plane be folded and made by
     the person in the hero when the screen is on them"): clicked while she's mid-air, hanging or climbing, the throw
     waits for her to land (up to 2.5s); only if she never does, or she's off screen, does it fly from the icon */
  function whenReady(done) {
    var t0 = performance.now();
    (function poll() {
      var her = herOnScreen();
      if (!her) return done(null);
      if (her.ready) return done(her);
      if (performance.now() - t0 > 2500) return done(null);
      setTimeout(poll, 80);
    })();
  }

  /* her throw, frame by frame in her spot; calls release(x, y, w) at the throw */
  function playThrow(her, release) {
    var k = her.h / SP.figH, w = SP.fw * k, h = SP.fh * k, d = document.createElement('div');
    d.className = 'rz-her';
    d.style.cssText += ';width:' + w + 'px;height:' + h + 'px;left:' + (her.x - SP.cx * k) + 'px;top:' + (her.y - SP.feet * k) + 'px;' +
      'background-image:url("' + THROW + '");background-size:' + (SP.cols * w) + 'px auto';
    document.body.appendChild(d);
    window.__stick.hide(true);
    /* from frame 8: the clip opens with her just holding the page */
    var i = 8, show = function () { d.style.backgroundPosition = (-(i % SP.cols) * w) + 'px ' + (-Math.floor(i / SP.cols) * h) + 'px'; };
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
    /* ONE swoop: up off her hand, a wide arc across the top and round, then in from the left for the pass */
    var pts = [[x0 / W, y0 / H, w0 / W], [Math.min(.85, x0 / W + .2), .18, .09], [.55, .12, .13], [.2, .3, .18], [-.04, .42, .28]];
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
      .to(o, { t: 1, duration: 1.7, ease: 'power1.inOut', onUpdate: function () { var q = seg(o.t); place(q[0], q[1], q[2], 1 - .2 * Math.abs(Math.sin(o.t * Math.PI * 2))); } })
      /* the pass: in from the left edge, right up against the glass, tearing across sideways, huge */
      .to(o, { s: 1, duration: .5, ease: 'power2.in', onUpdate: function () {
        var s = o.s, x = (-.05 + 1.75 * s) * W, y = (.4 + .12 * Math.sin(s * Math.PI)) * H, w = (.3 + 3.2 * s * s) * W;
        place(x, y, w);
        if (s > .55 && !o.white) { o.white = true; showSheet(true); }
      } });
  }

  function start(link) {
    if (busy) return; busy = true; opener = link;
    if (!el) build();
    if (rm()) { showSheet(false); busy = false; return; }
    gsapReady().then(function () {
      if (!window.gsap) { showSheet(false); busy = false; return; }
      whenReady(function (her) {
        if (her) playThrow(her, fly);
        else { var r = link.getBoundingClientRect(); fly(r.left + r.width / 2, r.top + r.height / 2, 40); }
      });
    });
  }

  function close() {
    el.classList.remove('on');
    document.documentElement.style.overflow = '';
    setTimeout(function () { if (!el.classList.contains('on')) { sheet.classList.remove('on'); sheet.style.opacity = '0'; } }, 400);
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }

  /* only the CLAY resume icon flies (her 2026-10-24: "I only want the airplane claymation thing to happen when you click
     on the clay icon"); every other resume link (nav, About, footer, case studies) just opens the PDF */
  var isResume = function (a) { return a && a.classList.contains('cta-resume') && /resume\.pdf/.test(a.getAttribute('href') || '') && !(el && el.contains(a)); };
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
