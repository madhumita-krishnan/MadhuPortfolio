/* SITE CHECK PROBE (copy of Vantage cli/check-probe.js). Loaded FIRST in <head> of the live home page when it is opened with ?vcheck
   (from m--k.me/check). Sends to the site's own cloud collector (api/check.js), so a check never depends on the Mac (her 2026-11-25). It measures what only a real phone shows and sends one report to /__vantage/note.
   Her 2026-11-24 asks: "do checks for if all the things that normally happen on the site work … what worked and what didn't work,
   and like why", and after her mom's report was lost: debug "every single part of this process … no stone … unturned".
   Rules: never change the page's behaviour (only observe), never block the main thread, never send personal data. */
(function () {
  if (window.__vcheck) return;
  var EP = window.__vcheckEndpoint || '/api/check';
  /* EVENTUAL DELIVERY (her 2026-11-25: "it can go and do the test and like write it down somewhere … that then eventually gets to you"):
     a report that could not be sent is kept on the phone (localStorage, newest 5) and sent the next time this phone opens the site.
     The home page loads this file on a normal visit ONLY when something is waiting; then it just delivers and stops. */
  var PK = 'vcheck-pending', q = function () { try { return JSON.parse(localStorage.getItem(PK) || '[]'); } catch (e) { return []; } };
  var tag = function (b) { var m = /"stage":"([^"]*)","run":"([^"]*)"/.exec(b); return m ? m[2] + '|' + m[1].replace(/^late-/, '') : b; };
  var keep = function (b) { try { var t = tag(b), a = q().filter(function (x) { return tag(x) !== t; }); a.push(b); localStorage.setItem(PK, JSON.stringify(a.slice(-5))); } catch (e) { } };   // one copy per run + stage
  (function flush() {
    var a = q(); if (!a.length) return;
    try { localStorage.removeItem(PK); } catch (e) { }
    a.forEach(function (b) {
      var j; try { j = JSON.parse(b); j.stage = 'late-' + j.stage; b = JSON.stringify(j); } catch (e) { }
      fetch(EP, { method: 'POST', keepalive: true, headers: { 'content-type': 'text/plain' }, body: b }).then(function (r) { if (!r.ok && r.status !== 400 && r.status !== 413) keep(b); }).catch(function () { keep(b); });
    });
  })();
  if (!/[?&]vcheck(=|&|$)/.test(location.search)) return;   // a normal visit: delivery only, no measuring
  var Q = location.search, P = performance, t0 = P.now();
  var R = window.__vcheck = {
    v: 1, run: (/[?&]run=([\w-]{1,40})/.exec(Q) || [])[1] || String(Date.now()), who: (/[?&]who=([\w-]{1,40})/.exec(Q) || [])[1] || '',
    self: /[?&]selftest/.test(Q), errors: [], gl: [], ctxNull: 0, taps: [], states: {}, playRefused: 0, frames: { n: 0, over100: 0, over250: 0, worst: 0 }
  };
  window.__vantageNoReload = true;                                   // the relay's live reload must never restart a check mid-way
  try { sessionStorage.setItem('__vantage_nobtn', '1'); } catch (e) { }   // no "add to home screen" panel for a visitor
  var post = function (m) { try { if (parent !== window) parent.postMessage(Object.assign({ vcheck: 1 }, m), location.origin); } catch (e) { } };
  // 1 · every error, including scripts and images that fail to load (capture phase sees resource errors too)
  addEventListener('error', function (e) {
    if (R.errors.length >= 25) return; var t = e.target;
    R.errors.push(e.message ? e.message + ' @ ' + String(e.filename || '').split('/').pop().split('?')[0] + ':' + (e.lineno || '')
      : 'failed to load ' + (t && (t.currentSrc || t.src || t.href) || '?'));
  }, true);
  addEventListener('unhandledrejection', function (e) { if (R.errors.length < 25) R.errors.push('promise: ' + (e.reason && (e.reason.message || e.reason))); });
  // 2 · drawing surfaces: a phone that refuses a canvas (memory cap) or WebGL (Lockdown Mode, old GPU) returns null
  try {
    var gc = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, o) { var c = gc.call(this, t, o); if (!c) R.ctxNull++; if (/webgl/.test(t)) R.gl.push(!!c); return c; };
  } catch (e) { }
  // 3 · videos the phone refuses to play on their own (Low Power Mode does this)
  try {
    var pl = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { var p = pl.apply(this, arguments); if (p && p.catch) p.catch(function (er) { if (er && er.name === 'NotAllowedError') R.playRefused++; }); return p; };
  } catch (e) { }
  // 4 · freezes: gaps between frames while the page runs
  var last = 0, skip = false; requestAnimationFrame(function f(t) { if (skip) { skip = false; last = t; return requestAnimationFrame(f); } if (last) { var g = t - last; R.frames.n++; if (g > 100) R.frames.over100++; if (g > 250) R.frames.over250++; if (g > R.frames.worst) R.frames.worst = Math.round(g); } last = t; requestAnimationFrame(f); });
  // 5 · taps: how long the phone took to hand each touch to the page, and what the avatar was doing before and 0.8s after
  var st = function () { var s = window.__stick; return s && s.fig ? s.fig.state : null; };
  addEventListener('pointerdown', function (e) {
    if (R.taps.length >= 20) return; var tap = { at: Math.round(P.now() - t0), delay: Math.max(0, Math.round(P.now() - e.timeStamp)), before: st(), on: (e.target && e.target.closest && (e.target.closest('.hero') ? 'hero' : e.target.closest('#ai-tools-band,.pot,[class*=pot]') ? 'pot/tools' : 'page')) || 'page' };
    R.taps.push(tap); setTimeout(function () { tap.after = st(); }, 800);
  }, true);
  // 6 · the avatar, from her own QA hook (stickman.js window.__stick): which states she was in, sampled twice a second
  setInterval(function () { var s = st(); if (s) R.states[s] = (R.states[s] || 0) + 1; }, 500);
  // 7 · when the page finished starting up (her app.js adds body.settled)
  var mo = new MutationObserver(function () { if (document.body && document.body.classList.contains('settled') && R.settledAt == null) { R.settledAt = Math.round(P.now() - t0); mo.disconnect(); } });
  mo.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['class'] });
  addEventListener('load', function () { R.loadAt = Math.round(P.now() - t0); });

  function env() {
    var n = navigator, c = n.connection, mm = function (q) { try { return matchMedia(q).matches; } catch (e) { return null; } };
    var webgl = (function () { try { var cv = document.createElement('canvas'); return !!(gc.call(cv, 'webgl2') || gc.call(cv, 'webgl')); } catch (e) { return false; } })();
    var statics = (function () { try { new Function('class A{static{}}'); return true; } catch (e) { return false; } })();
    skip = true;   // the speed test is our own freeze: never count it against her site
    var speed = (function () { var t = P.now(), x = 0; for (var i = 0; i < 3e6; i++) x += Math.sqrt(i) % 7; window.__vcx = x; return Math.round(P.now() - t); })();
    var ver = [].at ? ('adoptedStyleSheets' in document ? (Promise.withResolvers ? '17.4+' : '16.4–17.3') : '15.4–16.3') : 'below 15.4';
    var src = document.querySelector('script[src*="app.js"]');
    return { ua: n.userAgent, screen: screen.width + 'x' + screen.height + '@' + devicePixelRatio, view: innerWidth + 'x' + innerHeight,
      webkit: ver, staticBlocks: statics, webgl: webgl, codeMs: speed, reduceMotion: mm('(prefers-reduced-motion: reduce)'),
      touch: mm('(pointer: coarse)'), cores: n.hardwareConcurrency || null, net: c ? (c.effectiveType || '') + (c.saveData ? ' saveData' : '') : null,
      standalone: !!(n.standalone || mm('(display-mode: standalone)')), build: src ? (src.getAttribute('src').split('v=')[1] || '') : '', page: location.pathname };
  }
  function res() {
    try {
      var rs = P.getEntriesByType('resource'), tot = 0, slow = rs.map(function (r) { tot += r.transferSize || 0; return [Math.round(r.duration), r.transferSize || 0, String(r.name).split('/').pop().split('?')[0]]; })
        .sort(function (a, b) { return b[0] - a[0]; }).slice(0, 5);
      return { files: rs.length, kb: Math.round(tot / 1024), slowest: slow };
    } catch (e) { return null; }
  }
  // 8 · sending: confirmed by the Mac (204) before anyone is told "done"; retried; and a last beacon if the page is closed early
  var sentFull = false;
  function body(stage) {
    var s = window.__stick, koi = document.querySelector('.pot canvas, canvas[data-engine], .koi canvas');
    return JSON.stringify({ diag: 1, check: 'site-check', stage: stage, run: R.run, who: R.who, self: R.self, ua: navigator.userAgent,
      report: Object.assign({}, R, { env: R.env || (R.env = env()), res: res(), ms: Math.round(P.now() - t0), avatarReady: !!(s && s.clayH && s.clayH()),
        koiCanvas: !!koi, videos: [].map.call(document.querySelectorAll('video'), function (v) { return v.paused ? 'paused' : 'playing'; }).slice(0, 8) }) });
  }
  function send(stage, tries) {
    tries = tries || 0;
    fetch(EP, { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: body(stage) })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); if (stage === 'full') { sentFull = true; post({ sent: 1 }); try { localStorage.setItem(PK, JSON.stringify(q().filter(function (b) { return b.indexOf('"run":"' + R.run + '"') < 0; }))); } catch (e) { } } })
      .catch(function (er) { if (tries < 3) setTimeout(function () { send(stage, tries + 1); }, 1500 * (tries + 1)); else if (stage === 'full') { keep(body('full')); post({ failed: String(er && er.message || er) }); } });
  }
  /* a snapshot every 5s until the full report: if the phone freezes the page (app switched, tab closed), the newest snapshot is at
     most 5s old. Each line is the whole report so far; the reader keeps the newest line per run. */
  var snaps = setInterval(function () { if (P.now() - t0 < 24000) send('snapshot'); else clearInterval(snaps); }, 5000);
  setTimeout(function () { send('full'); }, 25000);
  addEventListener('message', function (e) { if (e.origin === location.origin && e.data && e.data.vcheck === 'send') send('full'); });
  /* iPhones rarely fire pagehide when a tab is closed or the app is switched, and they freeze hidden pages (timers stop): so the moment
     the page is HIDDEN, send what we have (a beacon survives the freeze); pagehide stays as a second chance. Found by test 2026-11-25:
     a check hidden at 6s only ever sent its 9s report. */
  window.__vcheckLast = function (stage) { lastSend(stage); };   // the outer check page calls this when IT is hidden (iPhones tell the top page reliably)
  /* Chrome silently REFUSES sendBeacon with a non-safelisted type (application/json): found 2026-11-25, the hide test sent nothing.
     Plain text is accepted everywhere and the collector parses it the same. A keepalive fetch goes out too, in the same moment. */
  /* named lastSend: "last" is also the frame-timing variable above, and that var silently replaced a function called last
     (found 2026-11-25: every hide report died with "last is not a function", swallowed by try/catch) */
  var lastDone = {};
  function lastSend(stage) {
    // once per stage (two channels already give it a second chance)
    if (sentFull || lastDone[stage]) return; lastDone[stage] = 1; var b = body(stage); keep(b);
    try { fetch(EP, { method: 'POST', keepalive: true, headers: { 'content-type': 'text/plain' }, body: b }).catch(function () { }); } catch (e) { }
    try { navigator.sendBeacon(EP, new Blob([b], { type: 'text/plain' })); } catch (e) { }
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') lastSend('hidden'); });
  addEventListener('pagehide', function () { lastSend('closed-early'); });
})();
