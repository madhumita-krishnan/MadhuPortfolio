/* THE PAPER-AIRPLANE RESUME (her ask 2026-10-24: "if someone looks at my resume, can I have a claymation of me folding
   up the resume into a paper airplane and then throwing it towards the screen and the paper airplane get super large,
   like bleeds out of the screen and that transitions into my resume").

   Any link to resume.pdf on any page is taken over: the screen goes night-dark and plays the Flora clay clip
   (assets/resume-plane.mp4: clay-her folds the resume, throws it at the lens, the plane grows until paper fills the
   frame). As the paper fills the screen it flashes to white and the white settles into the resume itself, shown as a
   page (assets/resume-page.jpg) with Download / Open / Close. GSAP drives the hand-off when it's on the page; plain
   CSS transitions otherwise. Reduced motion, a modifier-click or a middle-click keep the plain PDF link. */
(function () {
  var me = document.currentScript && document.currentScript.src || '';
  var base = me.replace(/resume-plane\.js.*$/, ''), ver = (me.match(/\?v=[^&#]*/) || [''])[0];
  var VID = base + 'assets/resume-plane.mp4' + ver, PAGE = base + 'assets/resume-page.jpg' + ver, PDF = base + 'assets/resume.pdf' + ver;
  var LEAD = .55;   // seconds before the clip ends that the white takes over (the plane is already filling the frame)
  var rm = function () { return matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('rm-mode'); };
  var el, vid, flash, sheet, opener, handed = false;

  function build() {
    var css = document.createElement('style');
    css.textContent =
      '.rz{position:fixed;inset:0;z-index:2147483000;background:#0f1013;opacity:0;visibility:hidden;transition:opacity .35s ease,visibility 0s linear .35s}' +
      '.rz.on{opacity:1;visibility:visible;transition:opacity .35s ease}' +
      /* the site hides the system cursor for its own, which sits UNDER this layer (her: "I can't find my cursor") */
      '.rz,.rz *{cursor:auto!important}.rz a,.rz button{cursor:pointer!important}' +
      '.rz-vid{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#0f1013}' +
      '.rz-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none}' +
      '.rz-sheet{position:absolute;inset:0;overflow:auto;overscroll-behavior:contain;opacity:0;visibility:hidden;background:#0f1013;' +
        'padding:84px 16px 48px;-webkit-overflow-scrolling:touch}' +
      '.rz-sheet.on{visibility:visible}' +
      '.rz-sheet img{display:block;width:min(880px,100%);height:auto;margin:0 auto;background:#fff;border-radius:6px;box-shadow:0 30px 80px rgba(0,0,0,.5)}' +
      '.rz-bar{position:fixed;top:0;left:0;right:0;display:flex;justify-content:flex-end;align-items:center;gap:10px;padding:20px clamp(16px,4vw,56px);' +
        'background:linear-gradient(#0f1013 55%,rgba(15,16,19,0))}' +
      '.rz-bar a,.rz-bar button{font:500 15px/1 "Plus Jakarta Sans",system-ui,sans-serif;display:inline-flex;align-items:center;min-height:40px;padding:0 18px 2px;' +
        'border-radius:999px;border:1px solid rgba(169,196,245,.55);background:none;color:#e9eaee;text-decoration:none;cursor:pointer}' +
      '.rz-bar a.rz-dl{background:#fff;border-color:#fff;color:#111}' +
      '.rz-bar :focus-visible{outline:2px solid #8fb2f2;outline-offset:2px}' +
      '.rz-bar .rz-title{margin-right:auto;color:#9aa0ad;font:300 15px/1 "Plus Jakarta Sans",system-ui,sans-serif}';
    document.head.appendChild(css);
    el = document.createElement('div');
    el.className = 'rz'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Resume');
    el.innerHTML = '<video class="rz-vid" muted playsinline preload="auto"></video><div class="rz-flash"></div>' +
      '<div class="rz-sheet"><div class="rz-bar"><span class="rz-title">Resume</span>' +
      '<a class="rz-dl" href="' + PDF + '" download="Madhumita-Krishnan-Resume.pdf">Download PDF</a>' +
      '<a href="' + PDF + '" target="_blank" rel="noopener">Open</a><button class="rz-x" type="button">Close</button></div>' +
      '<img alt="Madhumita Krishnan, resume" src="' + PAGE + '"></div>';
    document.body.appendChild(el);
    vid = el.querySelector('.rz-vid'); flash = el.querySelector('.rz-flash'); sheet = el.querySelector('.rz-sheet');
    vid.src = VID;
    vid.addEventListener('timeupdate', function () { if (vid.duration && vid.currentTime >= vid.duration - LEAD) handOff(); });
    vid.addEventListener('ended', handOff);
    vid.addEventListener('error', handOff);
    el.querySelector('.rz-x').addEventListener('click', close);
    sheet.addEventListener('click', function (e) { if (e.target === sheet) close(); });   // the dark around the page
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && el.classList.contains('on')) close(); });
  }

  /* the paper fills the screen → white → the resume */
  function handOff() {
    if (handed) return; handed = true;
    sheet.classList.add('on'); sheet.scrollTop = 0;
    var img = sheet.querySelector('img');
    if (window.gsap && !rm()) {
      gsap.timeline()
        .to(flash, { opacity: 1, duration: .28, ease: 'power2.in' })
        .set(sheet, { opacity: 1 })
        .fromTo(img, { scale: 1.18, y: 30, transformOrigin: '50% 0%' }, { scale: 1, y: 0, duration: .9, ease: 'expo.out', clearProps: 'transform' })
        .to(flash, { opacity: 0, duration: .55, ease: 'power2.out' }, '<')
        .fromTo(sheet.querySelector('.rz-bar'), { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: .4, ease: 'power2.out', clearProps: 'all' }, '-=.4');
    } else {
      sheet.style.transition = 'opacity .35s ease'; sheet.style.opacity = '1';
    }
    vid.pause();
    var x = el.querySelector('.rz-x'); x && x.focus({ preventScroll: true });
  }

  function open(link) {
    if (!el) build();
    opener = link; handed = false;
    flash.style.opacity = '0'; sheet.classList.remove('on'); sheet.style.opacity = '0';
    document.documentElement.style.overflow = 'hidden';
    el.classList.add('on');
    if (rm()) return handOff();
    try { vid.currentTime = 0; } catch (e) {}
    var p = vid.play();
    if (p && p.catch) p.catch(handOff);   // can't play (data saver, an old browser): straight to the page
  }

  function close() {
    el.classList.remove('on');
    document.documentElement.style.overflow = '';
    vid.pause();
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }

  var isResume = function (a) { return a && /resume\.pdf/.test(a.getAttribute('href') || '') && !(el && el.contains(a)); };
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!isResume(a) || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    open(a);
  }, true);
  /* warm the clip the moment a pointer heads for a resume link, so it starts instantly */
  document.addEventListener('pointerover', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (isResume(a) && !el) build();
  }, { passive: true });
})();
