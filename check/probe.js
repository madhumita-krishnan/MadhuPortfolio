/* SITE CHECK PROBE v2 (2026-11-25). Loaded FIRST in <head> of the live home page when it is opened with ?vcheck (from m--k.me/check),
   or on a normal visit only when a report is waiting to be delivered. Sends to the site's own cloud collector (api/check.js).
   Her asks, verbatim: "I think almost every single thing that someone can interact with should probably be checked." / "I thought she
   doesn't have to do anything on the screen" / "can you actually go and reliably check everything?"
   So the visitor does NOTHING: this file exercises every interaction itself (check/INTERACTIONS.md is the list), as close to a real
   finger as a page can get (hit-test the spot a thumb would press, then the full pointer → touch → mouse → click sequence at real
   coordinates), verifies the observable effect, times it, and puts everything back. Real touches are recorded too, as a bonus.
   Rules: never navigate away, never play sound during self-tests (muted for their length), never block the main thread, never send
   personal data, leave the page as it found it. tools/site-check-test/triage.mjs reads the result (check/TRIAGE.md). */
(function () {
  if (window.__vcheck) return;
  var EP = window.__vcheckEndpoint || '/api/check';
  /* EVENTUAL DELIVERY: a report that could not be sent is kept on the phone (localStorage, newest 5) and sent the next time this phone
     opens the site. The home page loads this file on a normal visit ONLY when something is waiting; then it just delivers and stops. */
  var PK = 'vcheck-pending', q = function () { try { return JSON.parse(localStorage.getItem(PK) || '[]'); } catch (e) { return []; } };
  var tag = function (b) { var m = /"stage":"([^"]*)","run":"([^"]*)"/.exec(b); return m ? m[2] + '|' + m[1].replace(/^late-/, '') : b; };
  var keep = function (b) { try { var t = tag(b), a = q().filter(function (x) { return tag(x) !== t; }); a.push(b); localStorage.setItem(PK, JSON.stringify(a.slice(-5))); } catch (e) { } };
  (function flush() {
    var a = q(); if (!a.length) return;
    try { localStorage.removeItem(PK); } catch (e) { }
    a.forEach(function (b) {
      var j; try { j = JSON.parse(b); j.stage = 'late-' + j.stage; b = JSON.stringify(j); } catch (e) { }
      fetch(EP, { method: 'POST', keepalive: b.length < 60000, headers: { 'content-type': 'text/plain' }, body: b }).then(function (r) { if (!r.ok && r.status !== 400 && r.status !== 413) keep(b); }).catch(function () { keep(b); });
    });
  })();
  if (!/[?&]vcheck(=|&|$)/.test(location.search)) return;   // a normal visit: delivery only, no measuring

  try { performance.setResourceTimingBufferSize(1500); } catch (e) { }   // the default 250 hid every file after the 250th (files:250 on every report)
  var Q = location.search, P = performance, t0 = P.now(), now = function () { return Math.round(P.now() - t0); };
  var R = window.__vcheck = {
    v: 2, run: (/[?&]run=([\w-]{1,40})/.exec(Q) || [])[1] || String(Date.now()), who: (/[?&]who=([\w-]{1,40})/.exec(Q) || [])[1] || '',
    self: /[?&]selftest/.test(Q), errors: [], gl: [], glLost: 0, ctxNull: 0, taps: [], states: {}, playRefused: 0,
    frames: { n: 0, over100: 0, over250: 0, worst: 0, hist: [0, 0, 0, 0, 0] }, fb: [], hb: [], life: [], tests: [], suite: { at: null, done: null },
    audio: { api: !!(window.AudioContext || window.webkitAudioContext), session: null, ctxs: [], starts: 0, startsRunning: 0, startsMuted: 0 },
    listen: [], realScroll: { n: 0 }, stage: 'loading'
  };
  window.__vantageNoReload = true;
  try { sessionStorage.setItem('__vantage_nobtn', '1'); } catch (e) { }
  var inFrame = parent !== window;
  var post = function (m) { try { if (inFrame) parent.postMessage(Object.assign({ vcheck: 1 }, m), location.origin); } catch (e) { } };

  // 1 · every error, including files that fail to load (capture phase sees resource errors too)
  addEventListener('error', function (e) {
    if (R.errors.length >= 25) return; var t = e.target;
    R.errors.push(now() + 'ms ' + (e.message ? e.message + ' @ ' + String(e.filename || '').split('/').pop().split('?')[0] + ':' + (e.lineno || '')
      : 'failed to load ' + String(t && (t.currentSrc || t.src || t.href) || '?').split('/').pop().slice(0, 80)));
  }, true);
  addEventListener('unhandledrejection', function (e) { if (R.errors.length < 25) R.errors.push(now() + 'ms promise: ' + String(e.reason && (e.reason.message || e.reason)).slice(0, 160)); });
  // 2 · drawing surfaces: a phone that refuses a canvas (memory cap) or WebGL (Lockdown Mode, old GPU) returns null; a lost context = memory pressure
  var gc = HTMLCanvasElement.prototype.getContext;
  var WR = typeof WeakRef === 'function', trackImgs = [], trackCvs = [], glUp = { n: 0, bytes: 0 };
  try { HTMLCanvasElement.prototype.getContext = function (t, o) { var c = gc.call(this, t, o); if (!c) R.ctxNull++; if (/webgl/.test(t) && R.gl.length < 10) R.gl.push(!!c);
    if (c && !this.__vcm) { this.__vcm = /webgl/.test(t) ? 'gl' : '2d'; if (WR && trackCvs.length < 400) trackCvs.push(new WeakRef(this)); } return c; }; } catch (e) { }
  /* MEMORY ESTIMATE (her 2026-11-25: "Is this something that you can test for if it's like a memory situation … how much memory her phone
     can handle?"). Safari has no memory API, so the page counts what it holds: every image made with new Image() (the avatar frame cache,
     preloads) is remembered weakly here; DOM images, canvases and videos are found when counting; WebGL uploads are summed as they happen */
  try { if (WR && typeof Proxy === 'function') { var Img0 = window.Image; window.Image = new Proxy(Img0, { construct: function (t, a, nt) { var im = Reflect.construct(t, a, nt); if (trackImgs.length < 4000) trackImgs.push(new WeakRef(im)); return im; } }); } } catch (e) { }
  try {
    var texB = function (a) { if (a[1] !== 0) return 0; if (a.length >= 8 && typeof a[3] === 'number' && typeof a[4] === 'number') return a[3] * a[4] * 4; var x = a[a.length - 1]; if (!x || typeof x !== 'object') return 0;
      var w = x.naturalWidth || x.videoWidth || x.displayWidth || x.width || 0, h = x.naturalHeight || x.videoHeight || x.displayHeight || x.height || 0; return w * h * 4; };
    [window.WebGLRenderingContext, window.WebGL2RenderingContext].forEach(function (G) { if (!G) return; var t0 = G.prototype.texImage2D;
      G.prototype.texImage2D = function () { try { glUp.n++; glUp.bytes += texB(arguments); } catch (e) { } return t0.apply(this, arguments); }; });
  } catch (e) { }
  addEventListener('webglcontextlost', function () { R.glLost++; }, true);
  // 3 · videos the phone refuses to play on their own (Low Power Mode does this)
  try {
    var pl = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { var p = pl.apply(this, arguments); if (p && p.catch) p.catch(function (er) { if (er && er.name === 'NotAllowedError') R.playRefused++; }); return p; };
  } catch (e) { }
  // 4 · SOUND, observed only: every AudioContext the site makes, its state changes, and every sound that actually starts
  try {
    var wrapAC = function (name) {
      var O = window[name]; if (!O || typeof Proxy !== 'function') return;
      window[name] = new Proxy(O, { construct: function (t, a, nt) {
        var c = Reflect.construct(t, a, nt), rec = { at: now(), state: c.state, seen: [c.state] };
        if (R.audio.ctxs.length < 4) R.audio.ctxs.push(rec);
        try { c.addEventListener('statechange', function () { rec.state = c.state; if (rec.seen.length < 8) rec.seen.push(c.state + '@' + now()); }); } catch (e) { }
        return c;
      } });
    };
    wrapAC('AudioContext'); wrapAC('webkitAudioContext');
    var SN = window.AudioScheduledSourceNode || window.AudioBufferSourceNode;
    if (SN && SN.prototype.start) {
      var st0 = SN.prototype.start;
      SN.prototype.start = function () {
        R.audio.starts++; try { if (this.context.state === 'running') R.audio.startsRunning++; } catch (e) { }
        if (document.documentElement.dataset.mute === 'on') R.audio.startsMuted++;
        return st0.apply(this, arguments);
      };
    }
  } catch (e) { }
  // 5 · who listens for touches/taps on the whole page (the sound unlock, the avatar, scroll work): type, phase, passive, which file
  try {
    var WATCH = /^(touchstart|touchend|touchmove|pointerdown|pointerup|pointermove|click|wheel|scroll|keydown)$/, ael = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, fn, o) {
      if ((this === window || this === document) && WATCH.test(type) && R.listen.length < 60) {
        var f = ''; try { f = (/([\w.-]+\.js)/.exec(String(new Error().stack).split('\n').slice(1).join(' ').replace(/probe\.js/g, '')) || [])[1] || 'inline'; } catch (e) { }
        var cap = o === true || !!(o && o.capture), pas = !!(o && o.passive);
        R.listen.push((this === window ? 'win' : 'doc') + ' ' + type + (cap ? ' capture' : '') + (pas ? ' passive' : '') + ' ' + f);
      }
      return ael.apply(this, arguments);
    };
  } catch (e) { }

  // 6 · frames: every gap between frames, in a histogram (≤12ms = 120Hz, ≤20 = 60Hz, ≤40 = 30Hz: Low Power Mode, ≤100, more) and 5s buckets
  var lastF = 0, skipF = false, bucket = null, phaseF = null;
  var rafAlive = 0;
  requestAnimationFrame(function f(t) {
    rafAlive = P.now();
    if (skipF) { skipF = false; lastF = t; return requestAnimationFrame(f); }
    if (lastF) {
      var g = t - lastF, F = R.frames; F.n++; if (g > 100) F.over100++; if (g > 250) F.over250++; if (g > F.worst) F.worst = Math.round(g);
      F.hist[g <= 12 ? 0 : g <= 20 ? 1 : g <= 40 ? 2 : g <= 100 ? 3 : 4]++;
      var b5 = Math.floor(now() / 5000);
      if (!bucket || bucket[0] !== b5) { if (bucket && R.fb.length < 40) R.fb.push(bucket); bucket = [b5, 0, 0, 0, 0, R.stage]; }   // [5s slot, frames, total ms, over100, worst, stage]
      bucket[1]++; bucket[2] += Math.round(g); if (g > 100) bucket[3]++; if (g > bucket[4]) bucket[4] = Math.round(g);
      if (phaseF) { phaseF.n++; if (g > 100) phaseF.o100++; if (g > phaseF.worst) { phaseF.worst = Math.round(g); phaseF.worstAtY = Math.round(scrollY); if (g > 100) try { var se = document.elementFromPoint(innerWidth / 2, innerHeight / 2); se = se && se.closest('section[id],[id]'); phaseF.worstIn = se ? '#' + se.id : null; } catch (e) { } } }
    }
    lastF = t; requestAnimationFrame(f);
  });
  // 7 · heartbeat: a timer that should tick every 250ms. A gap = the page was frozen (hidden/locked) or the main thread was blocked
  var lastHb = P.now();
  setInterval(function () { var g = P.now() - lastHb; lastHb = P.now(); if (g > 1200 && R.hb.length < 20) R.hb.push([now(), Math.round(g), document.visibilityState[0]]); }, 250);
  // 8 · life events: hidden/shown, frozen/resumed (Chrome), offline/online, bfcache restore
  var life = function (s) { if (R.life.length < 30) R.life.push(s + '@' + now()); };
  document.addEventListener('visibilitychange', function () { life(document.visibilityState); });
  ['freeze', 'resume', 'online', 'offline', 'pagehide'].forEach(function (n) { (n === 'freeze' || n === 'resume' ? document : window).addEventListener(n, function () { life(n); }); });
  addEventListener('pageshow', function (e) { if (e.persisted) life('bfcache-restore'); });
  try { var cn = navigator.connection; if (cn && cn.addEventListener) cn.addEventListener('change', function () { life('net:' + (cn.effectiveType || '') + '/' + (cn.type || '')); }); } catch (e) { }

  // 9 · the avatar, from her QA hook (stickman.js window.__stick): which states she was in, sampled twice a second
  var stk = function () { return window.__stick; }, st = function () { var s = stk(); return s && s.fig ? s.fig.state : null; };
  var fr = function () { try { return stk().clay().f; } catch (e) { return null; } };
  setInterval(function () { var s = st(); if (s) R.states[s] = (R.states[s] || 0) + 1; }, 500);
  var mo = new MutationObserver(function () { if (document.body && document.body.classList.contains('settled') && R.settledAt == null) { R.settledAt = now(); try { R.filesAtSettle = P.getEntriesByType('resource').length; } catch (e) { } mo.disconnect(); } });
  mo.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['class'] });
  addEventListener('load', function () { R.loadAt = now(); try { R.filesAtLoad = P.getEntriesByType('resource').length; } catch (e) { } });

  // 10 · REAL touches (a bonus: she isn't asked to touch). Each: where, how late the phone handed it over, and whether anything answered
  var suiteScroll = false, curTest = null;
  addEventListener('pointerdown', function (e) {
    if (!e.isTrusted || R.taps.length >= 20) return;
    var tap = { at: now(), type: e.pointerType, delay: Math.max(0, Math.round(P.now() - e.timeStamp)), on: desc(e.target), before: st(), during: curTest };
    R.taps.push(tap); if (curTest) curTest.touched = 1;
    var f0 = fr(), s0 = st(), y0 = scrollY, a0 = audioState(), t1 = P.now(), m = 0, f1 = R.frames.over100;
    var ob = new MutationObserver(function () { if (!m) m = P.now(); }); ob.observe(document.documentElement, { subtree: true, attributes: true, childList: true });
    setTimeout(function () {
      ob.disconnect(); tap.after = st(); tap.resp = m ? Math.round(m - t1) : -1; tap.drop = R.frames.over100 - f1;
      tap.moved = fr() !== f0 || st() !== s0; tap.scrolled = scrollY !== y0; tap.audio = a0 + '>' + audioState();
    }, 1000);
  }, true);
  var lastJump = 0;   // our own scrolls land as scroll events a frame later: anything within 200ms of one is ours
  addEventListener('scroll', function () { if (!suiteScroll && P.now() - lastJump > 200) { R.realScroll.n++; if (curTest) curTest.otherScroll = (curTest.otherScroll || 0) + 1; } }, { passive: true });
  addEventListener('touchstart', function (e) { if (!e.isTrusted) return; R.realTouches = (R.realTouches || 0) + 1; if (curTest) curTest.touched = 1; }, { capture: true, passive: true });

  function audioState() { try { var s = stk() && stk().sound && stk().sound(); return s && s.ctx || 'none'; } catch (e) { return 'err'; } }
  function desc(el) {
    if (!el || !el.tagName) return '?';
    var s = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
    var c = el.closest && el.closest('.hero,#work,#panels,#ai-tools-band,.about,nav,.brands-row,.pot,dialog');
    return (c && c !== el ? (c.id ? '#' + c.id : '.' + String(c.className).split(' ')[0]) + ' ' : '') + s.slice(0, 60);
  }

  function env() {
    var n = navigator, c = n.connection, mm = function (x) { try { return matchMedia(x).matches; } catch (e) { return null; } };
    var gpu = null, webgl = (function () { try { var cv = document.createElement('canvas'), g = gc.call(cv, 'webgl2') || gc.call(cv, 'webgl'); if (!g) return false;
      try { var di = g.getExtension('WEBGL_debug_renderer_info'); gpu = String(g.getParameter(di ? di.UNMASKED_RENDERER_WEBGL : g.RENDERER)).slice(0, 80); } catch (e) { }
      try { var lc = g.getExtension('WEBGL_lose_context'); lc && lc.loseContext(); } catch (e) { }   // give the test context's memory straight back
      return true; } catch (e) { return false; } })();
    var statics = (function () { try { new Function('class A{static{}}'); return true; } catch (e) { return false; } })();
    skipF = true;   // the speed test is our own freeze: never count it against her site
    var speed = (function () { var t = P.now(), x = 0; for (var i = 0; i < 3e6; i++) x += Math.sqrt(i) % 7; window.__vcx = x; return Math.round(P.now() - t); })();
    /* the WebKit generation from features (Chrome and every in-app browser on iPhone are WebKit too, and hide the version) */
    var ver = !([].at) ? 'below 15.4' : !('adoptedStyleSheets' in document) ? '15.4–16.3' : !Promise.withResolvers ? '16.4–17.3' : !window.Float16Array ? '17.4–18.1' : '18.2+';
    var ua = n.userAgent, br = /CriOS/.test(ua) ? 'Chrome' : /FxiOS/.test(ua) ? 'Firefox' : /EdgiOS/.test(ua) ? 'Edge' : /GSA\//.test(ua) ? 'Google app'
      : /FBAN|FBAV|Instagram|LinkedInApp|Line\/|Twitter|Snapchat|Pinterest/.test(ua) ? 'in-app: ' + (/(FBAN|FBAV|Instagram|LinkedInApp|Line|Twitter|Snapchat|Pinterest)/.exec(ua) || [])[1]
      : /iP(hone|ad|od)/.test(ua) && !/Safari\//.test(ua) ? 'in-app (WebView)' : /Version\/[\d.]+.*Safari/.test(ua) ? 'Safari' : /Chrome\//.test(ua) ? 'Chrome (desktop/Android)' : 'other';
    var dyn = (function () { try { var d = document.createElement('span'); d.style.cssText = 'font:-apple-system-body;position:absolute;visibility:hidden'; d.textContent = 'x'; document.body.appendChild(d); var cs = getComputedStyle(d), r = [parseFloat(cs.fontSize) || null, cs.fontWeight]; d.remove(); return r; } catch (e) { return null; } })();
    var fonts = null; try { fonts = {}; document.fonts.forEach(function (f) { fonts[f.status] = (fonts[f.status] || 0) + 1; }); } catch (e) { }
    var src = document.querySelector('script[src*="app.js"]');
    return { ua: ua, browser: br, safariVer: (/Version\/([\d.]+)/.exec(ua) || [])[1] || null, screen: screen.width + 'x' + screen.height + '@' + devicePixelRatio, view: innerWidth + 'x' + innerHeight,
      webkit: ver, staticBlocks: statics, webgl: webgl, gpu: gpu, wasm: typeof WebAssembly === 'object', codeMs: speed,
      reduceMotion: mm('(prefers-reduced-motion: reduce)'), aiBand: !!document.getElementById('ai-tools-band'), rmClass: !!(document.body && document.body.classList.contains('rm-mode')), reduceTransparency: mm('(prefers-reduced-transparency: reduce)'),
      contrastMore: mm('(prefers-contrast: more)'), inverted: mm('(inverted-colors: inverted)'), forcedColors: mm('(forced-colors: active)'), dark: mm('(prefers-color-scheme: dark)'),
      bodyText: dyn, zoom: window.visualViewport ? +visualViewport.scale.toFixed(2) : null,
      touch: mm('(pointer: coarse)'), hover: mm('(hover: hover)'), cores: n.hardwareConcurrency || null, mem: n.deviceMemory || null,
      net: c ? (c.effectiveType || '') + (c.saveData ? ' saveData' : '') + (c.type ? ' ' + c.type : '') : null, online: n.onLine,
      cookies: n.cookieEnabled, standalone: !!(n.standalone || mm('(display-mode: standalone)')), fonts: fonts,
      build: src ? (src.getAttribute('src').split('v=')[1] || '') : '', page: location.pathname, theme: document.documentElement.getAttribute('data-theme') || 'day' };
  }
  function res() {
    try {
      var rs = P.getEntriesByType('resource'), tot = 0, zero = 0, slow = rs.map(function (r) { tot += r.transferSize || 0; if (!r.transferSize && !r.decodedBodySize) zero++; return [Math.round(r.duration), r.transferSize || 0, String(r.name).split('/').pop().split('?')[0].slice(0, 40)]; })
        .sort(function (a, b) { return b[0] - a[0]; }).slice(0, 5);
      var nav = P.getEntriesByType('navigation')[0];
      var need = ['app.js', 'stick.js', 'fish.js', 'gsap'], got = {};
      need.forEach(function (k) { got[k] = rs.some(function (r) { return r.name.indexOf(k) >= 0; }); });
      return { files: rs.length, kb: Math.round(tot / 1024), emptyOrCached: zero, slowest: slow, scripts: got, nav: nav ? { type: nav.type, ttfb: Math.round(nav.responseStart), dom: Math.round(nav.domContentLoadedEventEnd) } : null };
    } catch (e) { return null; }
  }
  var storage = null;
  try { if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(function (s) { storage = { quotaMB: Math.round(s.quota / 1048576), usedMB: Math.round(s.usage / 1048576) }; }).catch(function () { storage = 'err'; }); } catch (e) { }
  try { navigator.storage && navigator.storage.persisted && navigator.storage.persisted().then(function (p) { R.persisted = p; }); } catch (e) { }

  var fileKey = function (u) { u = String(u || '').split('?')[0].split('/').pop() || 'inline'; return u.replace(/\d+(?=\.\w+$)/, '#').slice(0, 48); };   // frame sequences group as one (tarzan-x3-#.webp)
  function mem() {
    var seen = typeof Set === 'function' ? new Set() : null, by = {}, img = 0, cv = 0, vid = 0, n = 0;
    var add = function (k, b) { by[k] = (by[k] || 0) + b; };
    var doImg = function (im) { if (!im || (seen && seen.has(im))) return; if (seen) seen.add(im); if (im.complete && im.naturalWidth) { var cs = im.currentSrc || im.src || ''; if (/^data:image\/svg/.test(cs)) return;   /* an SVG placeholder (the gallery's empty print) is drawn as a vector at its shown size, never a photo-sized bitmap */ var sc = /^data:/.test(cs) ? 1 : 1; var b = im.naturalWidth * im.naturalHeight * 4; img += b; n++; add(fileKey(im.currentSrc || im.src), b); } };
    try { [].forEach.call(document.images, doImg); trackImgs = trackImgs.filter(function (w) { var im = w.deref(); if (im) doImg(im); return !!im; }); } catch (e) { }
    try {
      var cvsAll = [].slice.call(document.querySelectorAll('canvas')); trackCvs = trackCvs.filter(function (w) { var c = w.deref(); if (c && cvsAll.indexOf(c) < 0) cvsAll.push(c); return !!c; });
      cvsAll.forEach(function (c) { var b = c.width * c.height * 4 * (c.__vcm === 'gl' ? 3 : 1); if (!b) return; cv += b; add('canvas ' + (c.className ? '.' + String(c.className).split(' ')[0] : c.__vcm === 'gl' ? '(webgl)' : '(2d)') + (c.isConnected ? '' : ' offscreen'), b); });
    } catch (e) { }
    try { [].forEach.call(document.querySelectorAll('video'), function (v) { if (v.readyState >= 2 && v.videoWidth) { var b = v.videoWidth * v.videoHeight * 4 * 4; vid += b; add('video ' + fileKey(v.currentSrc), b); } }); } catch (e) { }
    if (glUp.bytes) add('webgl textures (uploaded)', glUp.bytes);
    var MB = function (b) { return Math.round(b / 1048576); }, tot = img + cv + vid + glUp.bytes;
    var top = Object.keys(by).map(function (k) { return [k, MB(by[k])]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10);
    return { t: now(), stage: R.stage, test: curTest ? curTest.id : null, mb: MB(tot), img: MB(img), imgs: n, cv: MB(cv), vid: MB(vid), gl: MB(glUp.bytes), top: top };
  }
  var lastMem = null;
  function memSample() {
    var m = mem(); lastMem = m; var M = R.mem || (R.mem = { weak: WR, hist: [], peak: null });
    if (M.hist.length < 60) M.hist.push([m.t, m.mb, m.stage === 'suite' ? (m.test || 'suite') : m.stage]);
    if (!M.peak || m.mb > M.peak.mb) M.peak = m; M.now = m; mark(); return m;
  }
  /* KILL / RELOAD MARKER: written at the start, at every test and every snapshot; removed on a clean finish or when the page is closed.
     iOS kills a page that uses too much memory WITHOUT any pagehide, and the browser reloads it: the next load then finds the marker */
  var MK = 'vcheck-alive', markedAt = 0;
  function mark(extra) {
    var m = { run: R.run, who: R.who, self: R.self, at: Date.now(), ms: now(), stage: R.stage, test: curTest ? curTest.id : null, mb: lastMem ? lastMem.mb : null,
      top: lastMem ? lastMem.top.slice(0, 3) : null, hidden: document.visibilityState === 'hidden', ua: navigator.userAgent.slice(0, 200), x: extra || (R.stressAt || null) };
    var j = JSON.stringify(m); markedAt = Date.now();
    try { sessionStorage.setItem(MK, j); } catch (e) { } try { localStorage.setItem(MK, j); } catch (e) { }
  }
  function unmark() { try { sessionStorage.removeItem(MK); } catch (e) { } try { localStorage.removeItem(MK); } catch (e) { } }
  (function lastRunDied() {
    var j = null; try { j = sessionStorage.getItem(MK) || localStorage.getItem(MK); } catch (e) { }
    if (!j) return; var m; try { m = JSON.parse(j); } catch (e) { return unmark(); }
    if (!m || m.run === R.run) return;
    R.prevDied = { run: m.run, stage: m.stage, test: m.test, mb: m.mb, ago: Math.round((Date.now() - m.at) / 1000) };
    var b = JSON.stringify({ diag: 1, check: 'site-check', stage: 'killed-or-reloaded', run: String(m.run).slice(0, 40), who: m.who || R.who, self: !!m.self, ua: navigator.userAgent,
      report: { v: 2, marker: m, secsBetween: Math.round((Date.now() - m.at) / 1000), sameTab: (function () { try { return !!sessionStorage.getItem(MK); } catch (e) { return null; } })(), newRun: R.run } });
    fetch(EP, { method: 'POST', keepalive: true, headers: { 'content-type': 'text/plain' }, body: b }).catch(function () { keep(b); });
    unmark();
  })();
  addEventListener('pagehide', function (e) { if (!e.persisted) unmark(); });
  document.addEventListener('visibilitychange', function () { if (markedAt) mark(); });   // the marker knows if the page was in the background when it died

  /* ================== THE SELF-TEST SUITE (check/INTERACTIONS.md lists every row and how it is proven) ================== */
  var wait = function (ms) { return new Promise(function (k) { setTimeout(k, ms); }); };
  /* poll a condition every ~16ms (timers, not frames: a page whose rAF is dead must still be measurable). Resolves ms, or -1 */
  function until(fn, max) {
    var t = P.now();
    return new Promise(function (k) { (function lp() { var ok = false; try { ok = fn(); } catch (e) { } if (ok) return k(Math.round(P.now() - t)); if (P.now() - t > max) return k(-1); setTimeout(lp, 16); })(); });
  }
  var V = function (ms, slow, note, extra) { var r = { v: ms < 0 ? 'NO EFFECT' : ms > slow ? 'SLOW' : 'PASS', ms: ms }; if (note) r.note = note; if (extra) Object.assign(r, extra); return r; };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  /* FULL MOTION (her 2026-11-25): the site ignores the OS Reduce Motion setting, so the probe expects motion under it too. Only the site's
     own MOTION OFF (body.rm-mode, no switch for it yet) makes stillness BY DESIGN. */
  var rm = function () { return !!(document.body && document.body.classList.contains('rm-mode')); };
  var touchDev = matchMedia('(pointer: coarse)').matches;
  function vis(el) { if (!el) return false; var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; }
  /* jump: an instant scroll. The site sets html{scroll-behavior:smooth}, which makes even behavior:'auto' glide, so the inline style is
     set to auto for the one call and put straight back */
  function jump(y) { var h = document.documentElement, was = h.style.scrollBehavior; lastJump = P.now(); suiteScroll = true; h.style.scrollBehavior = 'auto'; scrollTo(0, y); h.style.scrollBehavior = was; suiteScroll = false; }
  function into(el) { var r = el.getBoundingClientRect(); jump(Math.max(0, scrollY + r.top + r.height / 2 - innerHeight / 2)); }
  /* HIT TEST: what a finger at the middle (and the four spots a thumb would also use) would really land on. An overlay, a canvas or a
     transparent layer on top eats real taps even though a scripted event straight to the element would "work" */
  function hit(el) {
    var r = el.getBoundingClientRect(), pts = [[.5, .5], [.3, .35], [.7, .35], [.3, .65], [.7, .65]], ok = 0, block = null;
    pts.forEach(function (p) {
      var x = Math.min(innerWidth - 2, Math.max(1, r.left + r.width * p[0])), y = Math.min(innerHeight - 2, Math.max(1, r.top + r.height * p[1]));
      var top = document.elementFromPoint(x, y); if (top && (top === el || el.contains(top))) ok++; else if (!block) block = desc(top);
    });
    var ta = []; for (var n = el; n && n !== document.documentElement && ta.length < 1; n = n.parentElement) { var t = getComputedStyle(n).touchAction; if (t && t !== 'auto') ta.push(t + ' on ' + desc(n)); }
    return { hit: ok + '/5', blocker: block, touchAction: ta[0] || 'auto', pe: getComputedStyle(el).pointerEvents };
  }
  /* A TAP as the phone sends it: pointerdown → touchstart → pointerup → touchend → mouse compatibility events → click, at real
     coordinates, on whatever is really at that spot (bubbling the way a finger's would) */
  var pid = 9000;
  function tapAt(x, y, opt) {
    opt = opt || {};
    var tgt = document.elementFromPoint(x, y) || document.body, id = ++pid, pt = touchDev ? 'touch' : 'mouse';
    var base = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, screenX: x, screenY: y, view: window };
    var pe = function (type, b) { try { tgt.dispatchEvent(new PointerEvent(type, Object.assign({ pointerId: id, pointerType: pt, isPrimary: true, button: 0, buttons: b, width: touchDev ? 30 : 1, height: touchDev ? 30 : 1, pressure: b ? .5 : 0 }, base))); } catch (e) { } };
    var te = function (type) {
      if (!touchDev || typeof Touch !== 'function' || typeof TouchEvent !== 'function') return;
      try { var t = new Touch({ identifier: id, target: tgt, clientX: x, clientY: y, pageX: x + scrollX, pageY: y + scrollY, screenX: x, screenY: y, radiusX: 15, radiusY: 15, force: .5 });
        var on = type === 'touchend' ? [] : [t];
        tgt.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, composed: true, touches: on, targetTouches: on, changedTouches: [t], view: window })); } catch (e) { }
    };
    var me = function (type, b) { try { tgt.dispatchEvent(new MouseEvent(type, Object.assign({ button: 0, buttons: b, detail: 1 }, base))); } catch (e) { } };
    pe('pointerover', 0); pe('pointerenter', 0); pe('pointerdown', 1); te('touchstart');
    var up = function () {
      pe('pointerup', 0); te('touchend'); pe('pointerout', 0); pe('pointerleave', 0);
      if (!opt.noClick) { me('mouseover', 0); me('mousemove', 0); me('mousedown', 1); me('mouseup', 0); me('click', 0); }
    };
    if (opt.hold) return wait(opt.hold).then(up).then(function () { return tgt; });
    up(); return tgt;
  }
  function tapEl(el, opt) { var r = el.getBoundingClientRect(); return tapAt(r.left + r.width / 2, r.top + r.height / 2, opt); }
  var key = function (el, k) { try { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); } catch (e) { } };
  /* the next frame the phone actually draws after an effect (two rAFs ≈ painted): the time a person would SEE it. -1 if frames are dead */
  function nf() { var t = P.now(); return Promise.race([new Promise(function (k) { requestAnimationFrame(function () { requestAnimationFrame(function () { k(Math.round(P.now() - t)); }); }); }), wait(1000).then(function () { return -1; })]); }
  var frStart = function () { phaseF = { n: 0, o100: 0, worst: 0 }; return phaseF; };

  /* NEVER LEAVE THE PAGE: while the suite runs, any click that reaches a link and wasn't already handled by the site is stopped here
     (this runs after every site handler) and noted, so a broken resume interceptor shows as BROKEN instead of opening the PDF */
  var suiteOn = false, linkStops = [];
  addEventListener('click', function (e) {
    if (!suiteOn || e.isTrusted) return; var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (a) { linkStops.push({ el: desc(a), sitePrevented: e.defaultPrevented }); e.preventDefault(); }
  });
  var LS = ['mk-theme', 'mk-theme-at', 'mk-shown', 'mk-mute', 'mk-work-view'];
  function saveLS() { var o = {}; LS.forEach(function (k) { try { o[k] = localStorage.getItem(k); } catch (e) { } }); return o; }
  function putLS(o) { LS.forEach(function (k) { try { if (o[k] == null) localStorage.removeItem(k); else localStorage.setItem(k, o[k]); } catch (e) { } }); }

  /* the plan: id, words for the check page ("Now: …"), typical seconds (for an honest time left), and the test itself */
  var A = {};   // avatar bookkeeping
  var avatarOK = function () { var s = stk(); return !!(s && s.fig && s.clayH && s.clayH() > 0 && s.canvas && s.canvas()); };
  var idleish = function () { var s = st(); var f = stk() && stk().fig; return /^(idle|sign|wave)$/.test(s) && f && !f.loadT && !f.target; };
  function herPoint(dx, dy) { var s = stk(), cv = s.canvas().getBoundingClientRect(), f = s.fig; return { x: cv.left + f.x + dx, y: cv.top + f.y + dy }; }
  async function avatarTap(dx, dy, what, okFn, slow, settle) {
    if (!avatarOK()) return { v: 'NO EFFECT', note: 'avatar never became ready (__stick missing or clay frames not loaded)' };
    if (rm()) return { v: 'BY DESIGN', note: 'the site\'s own MOTION OFF is set: she is drawn standing still and ignores taps on purpose' };
    var hero = $('.hero'); if (hero && hero.getBoundingClientRect().top < -40) { jump(0); await wait(250); }
    await until(idleish, 4000);
    var p = herPoint(dx, dy), W = innerWidth; p.x = Math.min(W - 8, Math.max(8, p.x)); p.y = Math.max(8, p.y);
    var top = document.elementFromPoint(p.x, p.y), blocked = top && top.closest && top.closest('a,button,nav');
    var f0 = fr(), x0 = stk().fig.x, fx = frStart();
    tapAt(p.x, p.y, { noClick: false });
    var ms = await until(function () { return okFn(); }, 1500), drawn = await until(function () { return fr() !== f0; }, 1500);
    var anim = 0, lastf = fr(); var t = P.now();
    while (P.now() - t < 900) { await wait(30); var nf = fr(); if (nf !== lastf) { anim++; lastf = nf; } }
    var moved = Math.round(Math.abs(stk().fig.x - x0));
    var out = V(ms < 0 ? -1 : Math.max(ms, drawn), 300, null, { what: what, decided: ms, drawnMs: drawn, state: st(), frames: anim, movedPx: moved, under: desc(top), fps: fx.n, worst: fx.worst });
    if (blocked) { out.v = 'BLOCKED'; out.note = 'a link/button sits on that spot, so the avatar ignores a tap there (by design: ' + desc(blocked) + ')'; }
    else if (ms >= 0 && anim < 2 && !/air|hang|mantle/.test(st())) { out.v = 'SLOW'; out.note = 'state changed but she was barely drawn (' + anim + ' new frames in 0.9s): the drawing loop is starved'; }
    if (settle) await until(function () { return idleish() || st() === 'hang'; }, settle);
    return out;
  }

  var PLAN = [
    ['avatar-ready', 'the little girl appearing', 1, async function () {
      var ms = await until(avatarOK, 12000), s = stk();
      return V(ms, 6000, ms < 0 ? (s ? 'hook present, clay frames never ready (clayH 0)' : 'stick.js never ran (no window.__stick)') : null,
        { stickOn: !!$('.hero.stick-on'), state: st(), sheets: s && s.clay ? (s.clay().sheets || null) : null });
    }],
    ['avatar-walk', 'the little girl walking', 2, async function () {
      var s = stk(); if (!avatarOK()) return { v: 'NO EFFECT', note: 'avatar not ready' };
      A.x0 = s.fig.x; A.y0 = s.fig.y; var H = s.clayH() || 100, side = s.fig.x < innerWidth / 2 ? 1 : -1; A.side = side;
      return avatarTap(side * H * 1.3, -4, 'tap the ground beside her → she walks there', function () { return st() === 'move' || Math.abs(stk().fig.x - A.x0) > 2; }, 300, 5000);
    }],
    ['avatar-jump', 'the little girl jumping', 2, async function () {
      var H = (stk() && stk().clayH()) || 100;
      return avatarTap(0, -H - 24, 'tap above her head → she jumps (or grabs the line above: monkey bars)', function () { var f = stk().fig; return /air|hang/.test(f.state) || f.loadT > 0; }, 300, 4000);
    }],
    ['avatar-monkeybars', 'the monkey bars and muscle-up', 6, async function () {
      /* from her perch there is usually no line above her head, so: send her down onto the words below a line of type (a tap on
         them), then tap just above her head at that line: she jumps and hangs from it (monkey bars), then the muscle-up */
      if (st() !== 'hang' && avatarOK()) {
        var sk = stk(), H0 = sk.clayH() || 100, bars = (sk.bars && sk.bars()) || [], cv0 = sk.canvas().getBoundingClientRect();
        /* the lowest long line (her name), whatever perch the jump test left her on */
        var bar = bars.filter(function (b) { return b.x2 - b.x1 > 80; }).sort(function (a, b) { return b.y - a.y; })[0];
        for (var tries = 0; bar && tries < 2 && st() !== 'hang'; tries++) {
          var bx = Math.max(bar.x1 + 30, Math.min(bar.x2 - 30, stk().fig.x));
          if (stk().fig.y < bar.y + H0 * .8) { tapAt(cv0.left + bx, cv0.top + bar.y + H0 * 1.5); await wait(300); await until(idleish, 5000); }
          var f1 = stk().fig; tapAt(cv0.left + f1.x, cv0.top + Math.min(bar.y - 4, f1.y - H0 - 6));
          await until(function () { return st() === 'hang'; }, 2500);
          if (st() !== 'hang') await until(idleish, 3000);
        }
      }
      if (st() !== 'hang') return { v: 'SKIPPED', note: 'could not get her under a line of type to hang from (she is at y=' + Math.round(stk() ? stk().fig.y : 0) + ')' };
      var f = stk().fig, bar = f.hang && f.hang.bar, H = stk().clayH() || 100;
      var cv = stk().canvas().getBoundingClientRect(), y = (bar && bar.top != null ? bar.top : f.y - H) - 30;
      var x = cv.left + f.x, fx = frStart(); tapAt(x, cv.top + y);
      var ms = await until(function () { return st() === 'mantle'; }, 1500);
      await until(idleish, 5000);
      return V(ms, 300, 'tap above the bar → muscle-up', { end: st(), worst: fx.worst });
    }],
    ['avatar-trick', 'the little girl doing a trick', 2, async function () {
      var H = (stk() && stk().clayH()) || 100;
      return avatarTap(0, -H / 2, 'tap on her → a trick (cartwheel / backflip / star / bow)', function () { return st() === 'celeb'; }, 300, 6000);
    }],
    ['avatar-home', 'the little girl walking back', 3, async function () {
      if (!avatarOK() || A.x0 == null) return { v: 'SKIPPED', note: 'no start spot' };
      var s = stk(), dx = A.x0 - s.fig.x, dy = A.y0 - s.fig.y;
      if (Math.abs(dx) < (s.clayH() || 100) * .45 && Math.abs(dy) < 4) return { v: 'PASS', note: 'already home', ms: 0 };
      /* below her perch (the monkey-bar test leaves her on the words under her name): up first, the way a visitor would get her
         there: tap just above her head at the perch line (she jumps and grabs it), then tap above it (muscle-up) */
      for (var up = 0; up < 2 && stk().fig.y > A.y0 + 20; up++) {
        var cvh = stk().canvas().getBoundingClientRect(), Hh = stk().clayH() || 100, fh = stk().fig;
        tapAt(cvh.left + fh.x, cvh.top + Math.min(A.y0 - 4, fh.y - Hh - 6)); await until(function () { return st() === 'hang'; }, 2500);
        if (st() === 'hang') { tapAt(cvh.left + stk().fig.x, cvh.top + A.y0 - Hh * .6); await until(function () { return st() === 'mantle'; }, 1500); }
        await until(idleish, 5000);
      }
      dx = A.x0 - stk().fig.x; dy = A.y0 - stk().fig.y;
      var r = Math.abs(dx) < (stk().clayH() || 100) * .45 ? { v: 'PASS', ms: 0, note: 'climbed back up' } :
        await avatarTap(dx, dy - 4, 'walk back to where she started (puts the page back)', function () { return st() === 'move' || st() === 'air' || stk().fig.loadT > 0; }, 300, 6000);
      r.home = Math.abs(stk().fig.y - A.y0) < 16 && Math.abs(stk().fig.x - A.x0) < 40 ? 'back on her perch' : 'ended at x' + Math.round(stk().fig.x) + ' y' + Math.round(stk().fig.y) + ' (began x' + Math.round(A.x0) + ' y' + Math.round(A.y0) + ')';
      return r;
    }],
    ['sound-wiring', 'the sound engine', 0, async function () {
      var s = stk(), snd = null; try { snd = s && s.sound && s.sound(); } catch (e) { }
      var unlock = R.listen.filter(function (l) { return /stick/.test(l) && /(touchend|pointerdown|keydown)/.test(l) && /^win/.test(l); });
      try { R.audio.session = navigator.audioSession ? navigator.audioSession.type || 'present' : 'n/a'; } catch (e) { R.audio.session = 'err'; }
      var buf = snd && snd.buf ? Object.keys(snd.buf).filter(function (k) { return snd.buf[k]; }) : [];
      var out = { ctx: snd ? snd.ctx : 'no hook', buffers: buf.join(',') || 'none', unlockListeners: unlock.length, created: R.audio.ctxs.length, starts: R.audio.starts, startsRunning: R.audio.startsRunning };
      if (!snd) return Object.assign({ v: 'NO EFFECT', note: 'no sound hook (stick.js not running)' }, out);
      if (!unlock.length) return Object.assign({ v: 'NO EFFECT', note: 'no gesture listener to unlock sound was attached' }, out);
      if (!R.audio.api) return Object.assign({ v: 'BLOCKED', note: 'this browser has no Web Audio' }, out);
      return Object.assign({ v: 'PASS', note: 'everything up to the speaker is wired. Audible playback needs a real finger on iPhone: NOT PROVABLE here' }, out);
    }],
    ['mute-toggle', 'the sound on/off button', 1, async function () {
      var b = $('button.lt-mute'); if (!b) return { v: 'NO EFFECT', note: 'no mute button on the page' };
      if (!vis(b)) return { v: 'NO EFFECT', note: 'mute button is not visible' };
      var h = hit(b), was = document.documentElement.dataset.mute || '', ap = b.getAttribute('aria-pressed');
      tapEl(b); var ms = await until(function () { return (document.documentElement.dataset.mute || '') !== was && b.getAttribute('aria-pressed') !== ap; }, 800); h.paint = await nf();
      tapEl(b); var back = await until(function () { return (document.documentElement.dataset.mute || '') === was; }, 800);
      return V(ms, 100, back < 0 ? 'did not switch back' : null, h);
    }],
    ['theme-toggle', 'day / night switch', 2, async function () {
      var cur = document.documentElement.getAttribute('data-theme') === 'night' ? 'night' : 'day', other = cur === 'night' ? 'day' : 'night';
      var b = $('.lt-btn[data-look-to="' + other + '"]'), bb = $('.lt-btn[data-look-to="' + cur + '"]');
      if (!b) return { v: 'NO EFFECT', note: 'no day/night switch found' };
      var h = hit(b), fx = frStart();
      tapEl(b); var ms = await until(function () { return (document.documentElement.getAttribute('data-theme') === 'night' ? 'night' : 'day') === other; }, 1500);
      h.paint = await nf();
      /* during the cross-fade (a view transition) the whole page is a snapshot and a finger hits nothing: wait until the switch is tappable */
      var tb = bb || b, ready = await until(function () { var r = tb.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e && (e === tb || tb.contains(e)); }, 3000);
      tapEl(tb);
      var back = await until(function () { return (document.documentElement.getAttribute('data-theme') === 'night' ? 'night' : 'day') === cur; }, 1500);
      if (back < 0) { var tt = $('.theme-toggle'); if (tt) tt.click(); await until(function () { return (document.documentElement.getAttribute('data-theme') === 'night' ? 'night' : 'day') === cur; }, 1500); }
      /* and wait out the second cross-fade too, or the next test's tap lands on the snapshot (found 2026-11-25: about-fold hit "html") */
      await until(function () { var r = tb.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e && (e === tb || tb.contains(e)); }, 3000);
      return V(ms, 300, back < 0 ? 'the second tap did not switch it back (put back by script)' : null, Object.assign(h, { tappableAgainMs: ready, worst: fx.worst }));
    }],
    ['headline-wave', 'the name waving', 0, async function () {
      var l = $('h1 .lively'); if (!l) return { v: 'NO EFFECT', note: 'no .lively name' };
      if (rm()) return { v: 'BY DESIGN', note: 'the site\'s own MOTION OFF is set: the name stays still' };
      into($('.hero') || l); l.dispatchEvent(new MouseEvent('mouseenter')); var ms = await until(function () { return l.classList.contains('waving'); }, 600);
      l.dispatchEvent(new MouseEvent('mouseleave')); await wait(100);
      return V(ms, 100, 'touch phones send this on a tap');
    }],
    ['about-fold', '"The longer story" button', 1, async function () {
      var b = $('button.about-toggle'), box = $('#about-more'); if (!b || !box) return { v: 'NO EFFECT', note: 'button missing' };
      into(b); await wait(150); var h = hit(b), was = box.classList.contains('open');
      var t = P.now(); tapEl(b); var ms = await until(function () { return box.classList.contains('open') !== was; }, 600);
      var press = await until(function () { return b.getAnimations && b.getAnimations().length > 0; }, 250);   // press.js squish (touch waits 60ms)
      await wait(500); tapEl(b); await until(function () { return box.classList.contains('open') === was; }, 600);
      return V(ms, 100, null, Object.assign(h, { pressAnim: press >= 0 ? press + 'ms' : 'none' }));
    }],
    ['scroll', 'scrolling the whole page', 8, async function () {
      /* a finger-speed flick down the whole page and back (2,400px/s down, 3,600px/s up), one step per frame. Programmatic: no momentum and
         no finger, so close to her thumb but not identical. Watches frames, the nav hiding/plopping back, and what fires on the way */
      var trace = [], lastTr = 0, nav = $('.nav-wrap'), navHid = -1, navBack = -1, wisp = 0, koi = 0, vids = 0, fx = frStart(), t = P.now();
      var ob = new MutationObserver(function (ms) { ms.forEach(function (m) { [].forEach.call(m.addedNodes || [], function (n) { if (n.matches && n.matches('canvas.brands-wisp')) wisp++; if (n.querySelector && n.querySelector('canvas[data-engine]')) koi++; }); }); });
      ob.observe(document.body, { childList: true, subtree: true });
      var max = 0, pace = function (dir, pxs) {
        return new Promise(function (k) { var last = P.now(), started = P.now(), still = 0, py = -1;
          (function step() { var n = P.now(), dt = Math.min(64, n - last); last = n; max = document.documentElement.scrollHeight - innerHeight;   // the page changes height as it goes (found: a stale max kept it pushing at the bottom for 15s)
            still = Math.round(scrollY) === py ? still + 1 : 0; py = Math.round(scrollY); if (n - lastTr > 1000 && trace.length < 30) { lastTr = n; trace.push(Math.round(scrollY)); } jump(Math.max(0, Math.min(max, scrollY + dir * pxs * dt / 1000)));
            if (nav && navHid < 0 && dir > 0 && nav.classList.contains('nav-hidden')) navHid = Math.round(scrollY);
            if (nav && navBack < 0 && dir < 0 && navHid >= 0 && !nav.classList.contains('nav-hidden')) navBack = Math.round(n - started);
            if ((dir > 0 && scrollY >= max - 1) || (dir < 0 && scrollY <= 0) || still > 20 || n - started > 15000) return k();
            (P.now() - rafAlive < 200 ? requestAnimationFrame : function (f) { setTimeout(f, 16); })(step); })(); });
      };
      jump(0); await wait(300); if (scrollY > 2) { jump(0); await wait(300); }   // a glide the site started earlier can still be running: jump again
      await pace(1, 2400); await wait(600); var navBottom = nav ? (nav.classList.contains('nav-hidden') ? 'hidden' : 'showing') : null; await pace(-1, 3600); ob.disconnect();
      [].forEach.call(document.querySelectorAll('video'), function (v) { if (!v.paused) vids++; });
      var ms = Math.round(P.now() - t), out = { v: fx.worst > 250 || fx.o100 > 3 ? 'SLOW' : 'PASS', ms: ms, frames: fx.n, over100: fx.o100, worst: fx.worst, worstAtY: fx.worstAtY, worstIn: fx.worstIn || null, pageH: max,
        navHidAtY: navHid, navBackMs: navBack, wisps: wisp, koiAuto: koi, navAtBottom: navBottom, yEverySec: trace };
      out.note = 'programmatic scroll (no finger, no momentum)';
      return out;
    }],
    ['nav-hide-plop', 'the menu bar hiding and coming back', 0, async function () {
      var s = R.tests.filter(function (x) { return x.id === 'scroll'; })[0]; if (!s) return { v: 'SKIPPED' };
      if (!$('.nav-wrap')) return { v: 'NO EFFECT', note: 'no nav' };
      if (s.navHidAtY < 0) return { v: 'NO EFFECT', note: 'scrolled the whole page down; the menu bar never hid' };
      if (s.navBackMs < 0) return { v: 'NO EFFECT', note: 'it hid but never came back on the way up' };
      return { v: 'PASS', ms: s.navBackMs, note: 'hid at y=' + s.navHidAtY + ', back after scrolling up ' + s.navBackMs + 'ms' };
    }],
    ['logo-wisps', 'the logos arriving as dots', 1, async function () {
      if (rm()) return { v: 'BY DESIGN', note: 'the site\'s own MOTION OFF is set: logos show still' };
      var s = R.tests.filter(function (x) { return x.id === 'scroll'; })[0] || {}, row = $('.brands-row');
      if (!row) return { v: 'NO EFFECT', note: 'no logo row' };
      if (s.wisps > 0) return { v: 'PASS', ms: 0, note: 'played on the way down' };
      into(row); var ms = await until(function () { return $('canvas.brands-wisp'); }, 3000);
      if (ms < 0 && window.__wisp) { dispatchEvent(new Event('tweak-replay')); ms = await until(function () { return $('canvas.brands-wisp'); }, 1500); }
      return V(ms, 1500, ms < 0 ? (window.gsap ? 'GSAP loaded, no dots drawn' : 'GSAP never loaded (blocked or slow network?)') : 'played when scrolled to');
    }],
    ['video-autoplay', 'the project clips playing', 3, async function () {
      /* muted inline autoplay needs no finger: a clip whose time stands still is refused (Low Power Mode) or never loaded */
      var box = [].filter.call(document.querySelectorAll('[data-video][data-autoplay]'), function (x) { return x.getBoundingClientRect().width > 0; })[0];
      if (box) { into(box); }
      var cand = box ? box.querySelector('video') : null;
      var ms = await until(function () { var v = cand || $('[data-video] video'); return v && v.currentSrc && !v.paused && v.currentTime > 0.05; }, 4500);
      var v = cand || $('[data-video] video'), t1 = v ? v.currentTime : 0; await wait(700); var adv = v ? +(v.currentTime - t1).toFixed(2) : 0;
      var all = [].map.call(document.querySelectorAll('video'), function (x) { return (x.currentSrc ? '' : 'nosrc ') + (x.paused ? 'paused' : 'playing') + ' rs' + x.readyState + (x.error ? ' err' + x.error.code : ''); }).slice(0, 10);
      var r = V(ms, 2500, null, { advanced: adv, refused: R.playRefused, src: v ? !!v.currentSrc : false, all: all });
      if (ms < 0 && rm()) return Object.assign(r, { v: 'BY DESIGN', note: 'the site\'s own MOTION OFF is set: project clips wait for their play button' });
      if (ms < 0) r.note = R.playRefused ? 'the phone refused to play it (Low Power Mode does this)' : !v || !v.currentSrc ? 'the clip never loaded' : 'loaded but its time never moved';
      return r;
    }],
    ['panel-clip', 'the disciplines clip', 1, async function () {
      var pan = $('#panels'); if (!pan) return { v: 'NO EFFECT', note: 'no panels' };
      into(pan); var v = pan.querySelector('video');
      if (!v) return { v: 'NO EFFECT', note: 'no clip in the panels' };
      var ms = await until(function () { return !v.paused && v.currentTime > 0.05; }, 3500);
      return V(ms, 2000, ms < 0 ? (R.playRefused ? 'refused (Low Power Mode?)' : 'never played') : null, { live: pan.querySelector('.v-live') ? 1 : 0 });
    }],
    ['panels', 'the disciplines panels', 2, async function () {
      var ps = [].slice.call(document.querySelectorAll('#panels .panel')); if (ps.length < 2) return { v: 'NO EFFECT', note: 'no panels' };
      var act = ps.filter(function (p) { return p.classList.contains('active'); })[0] || ps[0], other = ps[(ps.indexOf(act) + 1) % ps.length];
      into(other); await wait(150); var h = hit(other);
      tapEl(other); var ms = await until(function () { return other.classList.contains('active'); }, 600);
      var hold = 'n/a (no touch)';
      if (touchDev) { var pr = tapEl(other, { hold: 450, noClick: true }); var hm = await until(function () { return other.classList.contains('peek'); }, 500); await pr; hold = hm >= 0 ? hm + 'ms' : 'none'; }
      await wait(200); tapEl(act); await until(function () { return act.classList.contains('active'); }, 600);
      return V(ms, 100, null, Object.assign(h, { holdPeek: hold }));
    }],
    ['gallery', 'the photo gallery', 0, async function () {
      var act = $('#panels .panel.active'), dg = $('dialog#dg'); if (!act || !dg) return { v: 'NO EFFECT', note: 'no gallery' };
      into(act); await wait(150); var hY = scrollY, fx = frStart();
      tapEl(act); var ms = await until(function () { return dg.open; }, 1500);
      var flip = -1;
      if (dg.open) {
        await wait(500); var sl = function () { return [].map.call(dg.querySelectorAll('.dg-slide'), function (x) { return x.className + (x.dataset.pile || '') + (x.dataset.d || ''); }).join('|') + ((dg.querySelector('.dg-cap') || {}).textContent || ''); }, on0 = sl();
        key(dg, 'ArrowRight'); flip = await until(function () { return sl() !== on0; }, 800);
        var x = dg.querySelector('.dg-x'); if (x) x.click();
        await until(function () { return !dg.open; }, 1500);
        if (dg.open) { try { dg.close(); } catch (e) { } document.documentElement.classList.remove('dg-on'); }
      }
      jump(hY);
      return V(ms, 500, ms < 0 ? 'tapping the open panel did not open the gallery' : null, { nextPhoto: flip >= 0 ? flip + 'ms' : 'none', closed: !dg.open, worst: fx.worst });
    }],
    ['koi', 'the koi jumping out of the pot', 4, async function () {
      var pot = $('.pot'); if (!pot) return { v: 'NO EFFECT', note: 'no pot' };
      if (rm()) return { v: 'BY DESIGN', note: 'the site\'s own MOTION OFF is set: the koi stays in the pot' };
      var fishOK = ('adoptedStyleSheets' in document) && window.CSS && CSS.supports && CSS.supports('selector(:has(a))');
      if (!fishOK) return { v: 'BY DESIGN', note: 'this engine is older than Safari 16.4: no koi, no error' };
      if (!window.WebGLRenderingContext) return { v: 'BLOCKED', note: 'no WebGL (Lockdown Mode or an old GPU)' };
      var s = R.tests.filter(function (x) { return x.id === 'scroll'; })[0] || {};
      into(pot); await until(function () { return !$('canvas[data-engine]'); }, 4000); await wait(150);
      var h = hit(pot), fx = frStart();
      tapEl(pot);
      var rock = await until(function () { return pot.style.transform; }, 400);
      var ms = await until(function () { return $('canvas[data-engine]'); }, 6000);
      var shown = await until(function () { return !$('canvas[data-engine]'); }, 5000);
      var r = V(ms, 1500, null, Object.assign(h, { rock: rock >= 0 ? rock + 'ms' : 'none', auto: s.koiAuto ? 'leapt by itself on the way down' : 'no auto leap seen', flightMs: shown, worst: fx.worst, fishJs: !!P.getEntriesByType('resource').filter(function (e) { return /fish\.js/.test(e.name); }).length }));
      if (ms < 0) r.note = r.fishJs ? 'fish.js loaded but no koi canvas appeared (WebGL refused? see webgl/ctxNull)' : 'fish.js never downloaded';
      return r;
    }],
    ['work-views', 'the list / swipe switch', 4, async function () {
      var work = $('#work'); if (!work) return { v: 'NO EFFECT', note: 'no work section' };
      var was = work.getAttribute('data-view'), y0 = scrollY, orient = document.documentElement.classList.contains('orient-views');
      var b = orient ? $('.turn-hint') : $('.work-head .view-btn[data-view="' + (was === 'deck' ? 'list' : 'deck') + '"]');
      if (!b || !vis(b)) return { v: orient ? 'BY DESIGN' : 'NO EFFECT', note: orient ? 'phone: turning the phone picks the view; no hint button showing' : 'no view switch visible' };
      into(b); await wait(150); var h = hit(b), fx = frStart();
      tapEl(b); var ms = await until(function () { return work.getAttribute('data-view') !== was; }, 1200);
      var swipe = 'n/a';
      if (work.getAttribute('data-view') === 'deck') {
        await wait(900); var dk = $('.sdeck'), cur = function () { var c = $('.sdeck [aria-current="true"]'); return c ? [].indexOf.call(c.parentNode.children, c) : -1; }, c0 = cur();
        if (dk) { key(dk, 'ArrowRight'); var sm = await until(function () { return cur() !== c0; }, 1200); swipe = sm >= 0 ? sm + 'ms' : 'none'; key(dk, 'ArrowLeft'); await wait(700); }
        key(document, 'Escape');
      }
      await wait(400); var back = orient ? b : $('.work-head .view-btn[data-view="' + (was || 'list') + '"]');
      if (back) { if (orient) into(back); tapEl(back); }
      await until(function () { return work.getAttribute('data-view') === was; }, 1500); await wait(600);
      document.documentElement.classList.remove('hfocus'); jump(y0);
      return V(ms, 300, null, Object.assign(h, { nextCard: swipe, restored: work.getAttribute('data-view') === was, worst: fx.worst }));
    }],
    ['tool-demo', 'the AI tool demos', 4, async function () {
      if (!$('#ai-tools-band')) return { v: 'BY DESIGN', note: 'the AI tools band is not on this page (AI_TOOLS_LIVE is off on the live site)' };
      var b = $('#ai-tools-band .tb-open'); if (!b) return { v: 'NO EFFECT', note: 'the AI tools band is on the page but has no demo button' };
      var vp = $('meta[name=viewport]'), vp0 = vp && vp.content;
      into(b); await wait(150); var h = hit(b), fx = frStart();
      tapEl(b); var ms = await until(function () { var d = $('dialog.td'); return d && d.open; }, 1500);
      await wait(900);
      try { window.toolDemo && window.toolDemo.close(); } catch (e) { }
      var gone = await until(function () { var d = $('dialog.td'); return !d || !d.open; }, 1500); await wait(600);
      var d = $('dialog.td'); if (d && d.open) try { d.close(); } catch (e) { }
      document.documentElement.classList.remove('td-lock'); if (vp && vp.content !== vp0) vp.content = vp0;
      var bandVid = $('#ai-tools-band video'), adv = null; if (bandVid) { into(bandVid); var t1 = bandVid.currentTime; await wait(800); adv = +(bandVid.currentTime - t1).toFixed(2); }
      return V(ms, 500, null, Object.assign(h, { closed: gone >= 0, bandVideoAdvanced: adv, worst: fx.worst }));
    }],
    ['resume-plane', 'the resume paper plane', 6, async function () {
      /* a resume link IN THE PAGE, never the nav's: the nav tucks away on scroll (rule), and testing its link while tucked put the finger on
         #work under it, so her mom's run read "something covers it" (2026-11-25; with the nav showing, all 3 links hit 5/5 at 390) */
      var rl = [].filter.call(document.querySelectorAll('a[href*="Resume.pdf"],a[href*="resume.pdf"]'), vis), a = rl.filter(function (x) { return !x.closest('nav'); })[0] || rl[0];
      if (!a) return { v: 'NO EFFECT', note: 'no visible resume link' };
      into(a); await wait(200); var h = hit(a), n0 = linkStops.length, fx = frStart();
      tapEl(a);
      var stop = linkStops[n0];
      if (stop && !stop.sitePrevented) return Object.assign({ v: 'BROKEN', note: 'the resume link was NOT taken over by the paper plane: a real tap would open the PDF directly (resume-plane.js not running?)' }, h);
      var ms = await until(function () { return $('.rz'); }, 1500), sheet = await until(function () { return $('.rz-sheet.on'); }, 9000);
      var x = $('.rz-x'); if (x) x.click(); else key(document, 'Escape');
      await until(function () { return !$('.rz.on'); }, 1500); await wait(500);
      var rz = $('.rz.on'); if (rz) rz.classList.remove('on'); document.documentElement.style.overflow = '';
      /* the tap is answered at once (the link is taken over); the plane flight is ~3s by design, so SLOW only past 6s */
      return V(sheet, 6000, sheet < 0 ? (ms < 0 ? 'the link was taken over but no plane or sheet appeared' : 'the plane started but the resume sheet never showed') : 'link taken over at once; resume sheet after the flight', Object.assign(h, { overlayMs: ms, worst: fx.worst }));
    }],
    ['cursor', 'the desktop cursor', 0, async function () {
      if (touchDev) return { v: 'BY DESIGN', note: 'touch screen: no custom cursor' };
      var dc = $('#dc'); if (!dc || !document.body.classList.contains('dc-on')) return { v: rm() ? 'BY DESIGN' : 'NO EFFECT', note: 'custom cursor not armed' };
      var w = $('.wproject'); dispatchEvent(new CustomEvent('mk-wh', { detail: w })); var ms = await until(function () { return dc.classList.contains('turning') || dc.classList.contains('pill'); }, 900);
      dispatchEvent(new CustomEvent('mk-wh', { detail: null })); return V(ms, 200);
    }],
    ['hover-hands', 'the handwriting on hover', 0, async function () {
      return touchDev ? { v: 'BY DESIGN', note: 'touch: there is no hover; the handwriting shows on desktop only' } : { v: 'NOT PROVABLE', note: 'pure CSS :hover, which a page cannot trigger on itself' };
    }],
    ['links', 'the links', 1, async function () {
      var seen = {}, bad = [], n = 0, ext = 0;
      [].forEach.call(document.querySelectorAll('a[href]'), function (a) {
        var u; try { u = new URL(a.getAttribute('href'), location.href); } catch (e) { return; }
        if (u.origin !== location.origin) { ext++; return; } if (/\.pdf$/i.test(u.pathname) || u.hash && u.pathname === location.pathname) return;
        u.hash = ''; u.search = ''; if (!seen[u.href] && n < 14) { seen[u.href] = 1; n++; }
      });
      await Promise.all(Object.keys(seen).map(function (u) { return fetch(u, { method: 'HEAD', cache: 'no-store' }).then(function (r) { if (!r.ok) bad.push(r.status + ' ' + u.split('/').pop()); }).catch(function () { bad.push('fail ' + u.split('/').pop()); }); }));
      var cal = $('a[href*="calendly"]');
      return { v: bad.length ? 'BROKEN' : 'PASS', ms: 0, note: n + ' own pages answered' + (bad.length ? ', broken: ' + bad.join(', ') : '') + '; ' + ext + ' outside links (not opened); say hey → Calendly ' + (cal ? 'present' : 'MISSING') };
    }],
  ];
  var estLeft = function (i) { var s = 0; for (var k = i; k < PLAN.length; k++) s += PLAN[k][2]; return s + 3; };

  async function suite() {
    if (R.suite.at != null) return; R.suite.at = now(); R.stage = 'suite';
    var y0 = scrollY, ls = saveLS(), mute0 = document.documentElement.dataset.mute;
    suiteOn = true;
    for (var i = 0; i < PLAN.length; i++) {
      var p = PLAN[i], t = P.now(), rec = { id: p[0] }; curTest = rec; mark();
      /* the gallery decodes its full-size photos (found 2026-11-25: +650 MB of pixels on opening it once): it runs AFTER the main
         report is confirmed sent, so a memory kill can never cost the main results */
      if (p[0] === 'gallery') { rec.v = 'DEFERRED'; rec.note = 'runs after the main report is sent (memory heavy)'; rec.ms = 0; R.tests.push(rec); curTest = null; continue; }
      post({ test: p[1], i: i + 1, n: PLAN.length, left: estLeft(i) });
      /* silent while testing (her rule: no loud sound) — except the mute test itself, which flips it and back */
      if (p[0] !== 'mute-toggle') document.documentElement.dataset.mute = 'on'; else if (mute0) document.documentElement.dataset.mute = mute0; else delete document.documentElement.dataset.mute;
      var tick = setInterval(function () { post({ test: p[1], i: i + 1, n: PLAN.length, left: estLeft(i), slowFor: Math.round((P.now() - t) / 1000) }); }, 1000);
      try {
        var r = await Promise.race([p[3](), wait(20000).then(function () { return { v: 'NO EFFECT', note: 'test timed out after 20s (the page stopped answering?)' }; })]);
        Object.assign(rec, r);
      } catch (e) { rec.v = 'ERROR'; rec.note = String(e && e.message || e).slice(0, 160); }
      clearInterval(tick); phaseF = null;
      if (rec.ms == null) rec.ms = Math.round(P.now() - t); rec.took = Math.round(P.now() - t);
      try { rec.memMB = memSample().mb; } catch (e) { }
      R.tests.push(rec); curTest = null;
    }
    suiteOn = false;
    /* put everything back the way it was */
    if (mute0) document.documentElement.dataset.mute = mute0; else delete document.documentElement.dataset.mute;
    putLS(ls); jump(y0);
    try { var ae = document.activeElement; if (ae && ae !== document.body && ae.blur) ae.blur(); } catch (e) { }   // the resume sheet hands focus back to the link: no focus ring left behind
    R.linkStops = linkStops.slice(0, 6); R.suite.done = now(); R.stage = 'done';
  }

  // 11 · sending: confirmed by the server (2xx) before anyone is told "done"; retried; and a last beacon if the page is closed early
  var sentFull = false;
  function body(stage) {
    var s = window.__stick;
    var rep = Object.assign({}, R, { env: R.env || (R.env = env()), res: res(), ms: now(), storage: storage, avatarReady: !!(s && s.clayH && s.clayH()), sound: audioState(),
      fbNow: bucket, koiCanvas: !!document.querySelector('canvas[data-engine]'), videos: [].map.call(document.querySelectorAll('video'), function (v) { return v.paused ? 'paused' : 'playing'; }).slice(0, 8), raf: Math.round(P.now() - rafAlive) });
    var b = JSON.stringify({ diag: 1, check: 'site-check', stage: stage, run: R.run, who: R.who, self: R.self, ua: navigator.userAgent, report: rep });
    if (b.length > 56000) { rep.listen = rep.listen.slice(0, 12); rep.taps = rep.taps.slice(0, 6); rep.res = null; rep.fb = rep.fb.slice(-12); rep.trimmed = 1; b = JSON.stringify({ diag: 1, check: 'site-check', stage: stage, run: R.run, who: R.who, self: R.self, ua: navigator.userAgent, report: rep }); }
    return b;
  }
  function send(stage, tries) {
    tries = tries || 0;
    if (stage === 'full') post({ sending: 1, tries: tries });
    var b = body(stage);
    fetch(EP, { method: 'POST', keepalive: b.length < 60000, headers: { 'content-type': 'text/plain' }, body: b })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); if (stage === 'full') { sentFull = true; post({ sent: 1 }); try { localStorage.setItem(PK, JSON.stringify(q().filter(function (x) { return x.indexOf('"run":"' + R.run + '"') < 0; }))); } catch (e) { } } })
      .catch(function (er) { if (stage === 'full' && tries < 3) post({ retry: tries + 1, offline: navigator.onLine === false, why: String(er && er.message || er) }); if (tries < 3) setTimeout(function () { send(stage, tries + 1); }, 1500 * (tries + 1)); else if (stage === 'full') { keep(body('full')); post({ failed: String(er && er.message || er) }); } });
  }
  /* a snapshot every 5s until the full report: if the phone freezes the page (app switched, tab closed), the newest is at most 5s old */
  var nSnap = 0, snaps = setInterval(function () { try { memSample(); } catch (e) { } if (sentFull || R.stage === 'done' || ++nSnap > 30) return clearInterval(snaps); send('snapshot'); }, 5000);
  /* START: once the page has settled (or 9s after it began, whichever first) and the avatar has had a moment: a 3-second still baseline
     (frame rate with nothing happening: 30fps here = Low Power Mode), then the suite, then the full report */
  post({ start: 1, total: estLeft(0) + 6 });
  addEventListener('message', function (e) { if (e.origin === location.origin && e.data && e.data.vcheck === 'send') send('full'); });
  (async function go() {
    await until(function () { return R.settledAt != null; }, 9000);
    R.stage = 'baseline'; post({ test: 'watching the site at rest', i: 0, n: PLAN.length, left: estLeft(0) + 3 });
    var b0 = { n: R.frames.n, h: R.frames.hist.slice() }; await wait(3000);
    R.baseline = { frames: R.frames.n - b0.n, hist: R.frames.hist.map(function (v, k) { return v - b0.h[k]; }) };
    await suite();
    try { memSample(); } catch (e) { }
    send('full');
    /* MEMORY STRESS (only once the main report is confirmed sent, so a kill can never cost it): open the gallery from every
       disciplines panel and page through each project's photos at full size, counting memory after each. A kill here shows up as
       "killed-or-reloaded" from the next load, with the project it was on. Skipped if the previous run on this phone died */
    await until(function () { return sentFull; }, 60000);
    if (!sentFull) { R.stress = { skipped: 'main report not confirmed sent' }; return; }
    if (R.prevDied) { R.stress = { skipped: 'the previous run on this phone died (' + R.prevDied.stage + '/' + (R.prevDied.test || '') + '): not pushing it again' }; send('memory'); unmark(); post({ stressDone: 1 }); return; }
    /* the gallery's own test first (open, next photo, close), then the paging through every project */
    R.stage = 'stress'; post({ stress: 1, i: 0, n: 7, left: 25 });
    var g = PLAN.filter(function (x) { return x[0] === 'gallery'; })[0], gr = { id: 'gallery' }, gt = P.now(); curTest = gr; mark();
    try { Object.assign(gr, await Promise.race([g[3](), wait(20000).then(function () { return { v: 'NO EFFECT', note: 'timed out' }; })])); } catch (e) { gr.v = 'ERROR'; gr.note = String(e && e.message || e).slice(0, 160); }
    gr.took = Math.round(P.now() - gt); try { gr.memMB = memSample().mb; } catch (e) { } curTest = null;
    R.tests = R.tests.map(function (x) { return x.id === 'gallery' ? gr : x; });
    await stress(); send('memory'); unmark(); post({ stressDone: 1 });
  })();
  async function stress() {
    R.stage = 'stress'; var log = R.stress = { log: [], startMB: memSample().mb }, ps = [].slice.call(document.querySelectorAll('#panels .panel')), dg = $('dialog#dg');
    if (!ps.length || !dg) { log.skipped = 'no gallery on this page'; return; }
    var act0 = $('#panels .panel.active') || ps[0], y0 = scrollY; document.documentElement.dataset.mute = 'on';
    for (var i = 0; i < ps.length; i++) {
      post({ stress: 1, i: i + 1, n: ps.length, left: (ps.length - i) * 3 });
      var p = ps[i]; into(p); tapEl(p); await wait(250);
      if (!p.classList.contains('active')) { log.log.push([i, 'panel would not open']); continue; }
      R.stressAt = { project: i, slide: 0 }; mark();
      tapEl(p); await until(function () { return dg.open; }, 1500); if (!dg.open) { log.log.push([i, 'gallery would not open']); continue; }
      var nextKey = document.documentElement.dataset.gal === 'prints' ? 'ArrowUp' : 'ArrowRight';
      for (var k = 0; k < 4; k++) { key(dg, nextKey); await wait(420); R.stressAt.slide = k + 1; memSample(); }   // page through this project's prints
      var m = memSample(); log.log.push([i, m.mb, m.imgs, m.top[0] ? m.top[0][0] : '']);
      var x = dg.querySelector('.dg-x'); if (x) x.click(); await until(function () { return !dg.open; }, 1500);
      if (dg.open) { try { dg.close(); } catch (e) { } document.documentElement.classList.remove('dg-on'); }
      await wait(200);
    }
    R.stressAt = null; tapEl(act0); jump(y0); delete document.documentElement.dataset.mute;
    var mu = null; try { mu = localStorage.getItem('mk-mute'); } catch (e) { } if (mu === 'on') document.documentElement.dataset.mute = 'on';
    log.endMB = memSample().mb; log.peakMB = R.mem.peak.mb; R.stage = 'done';
  }
  /* iPhones rarely fire pagehide when a tab is closed or the app is switched, and they freeze hidden pages: so the moment the page is
     HIDDEN, send what we have (beacon + keepalive fetch, text/plain: Chrome refuses a JSON beacon). Named lastSend: "last" once
     shadowed a function and every hide report died silently (2026-11-25). */
  window.__vcheckLast = function (stage) { lastSend(stage); };
  var lastDone = {};
  function lastSend(stage) {
    if (sentFull || lastDone[stage]) return; lastDone[stage] = 1; var b = body(stage); keep(b);
    try { fetch(EP, { method: 'POST', keepalive: b.length < 60000, headers: { 'content-type': 'text/plain' }, body: b }).catch(function () { }); } catch (e) { }
    try { navigator.sendBeacon(EP, new Blob([b], { type: 'text/plain' })); } catch (e) { }
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') lastSend('hidden'); });
  addEventListener('pagehide', function () { lastSend('closed-early'); });
})();
