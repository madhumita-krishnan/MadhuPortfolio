/* tweaker.js — a viewport + a panel of live controls for every parameter that shapes a
   visual. Dependency-free; inline it into the page (artifacts can't load local files).

   Tweaker({
     title: 'Clay card',                       // also the storage key
     params: [                                 // one entry per visual decision
       { key: 'grow', label: 'Spring stiffness', group: 'Motion', type: 'range',
         min: 100, max: 900, step: 10, value: 420, unit: '', hint: 'Higher snaps open faster' },
       { key: 'clay', label: 'Clay colour', group: 'Colour', type: 'color', value: '#b9a58f' },
       { key: 'ease', label: 'Easing', group: 'Motion', type: 'select', options: ['spring', 'ease-out'], value: 'spring' },
       { key: 'grain', label: 'Fingerprints', group: 'Texture', type: 'toggle', value: true },
     ],
     // INLINE mode: draw into the stage element. Called (batched per frame) on every change.
     render(v, stage) { ... },
     // optional: the motion to replay from the start (R key / Replay button)
     replay(v, stage) { ... },
     // optional: a per-frame loop for canvas/WebGL work; t is scaled by the speed control
     frame(v, stage, t, dt) { ... },
     // IFRAME mode instead of render: a real page carrying tweaker-receiver.js
     url: 'http://localhost:4174/',
   });

   Every param with `css: '--name'` is also written as a CSS custom property on the stage
   (inline mode) or the page's :root (iframe mode), so plain CSS can bind to it directly. */
(function () {
  'use strict';
  var CSS = '\
.tw{position:fixed;inset:0;display:grid;grid-template-columns:1fr minmax(300px,360px);background:#0d0e12;color:#e9ebf1;font:13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;z-index:2147483000}\
.tw *{box-sizing:border-box}\
.tw-view{display:grid;grid-template-rows:auto 1fr;min-width:0;min-height:0}\
.tw-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:10px 12px;border-bottom:1px solid #23262f}\
.tw-bar b{font-weight:600;margin-right:8px;white-space:nowrap}\
.tw-btn{font:inherit;color:#e9ebf1;background:#1a1d25;border:1px solid #2b2f3a;border-radius:8px;padding:6px 10px;cursor:pointer;white-space:nowrap}\
.tw-btn:hover{border-color:#4a5163}.tw-btn[aria-pressed="true"]{background:#e9ebf1;color:#0d0e12;border-color:#e9ebf1}\
.tw-btn:focus-visible,.tw input:focus-visible,.tw select:focus-visible{outline:2px solid #8fb2f2;outline-offset:2px}\
.tw-sep{width:1px;height:20px;background:#2b2f3a;margin:0 4px}\
.tw-wrap{position:relative;overflow:auto;display:grid;place-items:center;padding:20px}\
.tw-wrap[data-bg="dark"]{background:#0d0e12}.tw-wrap[data-bg="light"]{background:#f1efe9}\
.tw-wrap[data-bg="check"]{background:repeating-conic-gradient(#20232b 0 25%,#171a20 0 50%) 0 0/20px 20px}\
.tw-stage{position:relative;width:100%;height:100%;max-width:100%;overflow:hidden;border-radius:10px;box-shadow:0 0 0 1px #2b2f3a;container-type:inline-size;transition:width .35s cubic-bezier(.2,.8,.2,1)}\
.tw-stage>iframe{width:100%;height:100%;border:0;display:block;background:#fff}\
.tw-tag{position:absolute;top:8px;right:10px;font:11px ui-monospace,Menlo,monospace;color:#7d8495;pointer-events:none}\
.tw-panel{border-left:1px solid #23262f;overflow:auto;display:flex;flex-direction:column;min-height:0}\
.tw-acts{display:flex;flex-wrap:wrap;gap:6px;padding:12px;border-bottom:1px solid #23262f;position:sticky;top:0;background:#0d0e12;z-index:1}\
.tw-group{border-bottom:1px solid #1d2028}\
.tw-group>summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:10px 12px;font-weight:600;letter-spacing:.02em}\
.tw-group>summary::-webkit-details-marker{display:none}\
.tw-group>summary .tw-btn{padding:2px 8px;font-size:11px;font-weight:400}\
.tw-rows{display:grid;gap:12px;padding:2px 12px 14px}\
.tw-row{display:grid;grid-template-columns:1fr auto;gap:4px 10px;align-items:center}\
.tw-row label{color:#c4c8d2}.tw-row.changed label{color:#fff}.tw-row.changed label::after{content:" •";color:#8fb2f2}\
.tw-row .tw-hint{grid-column:1/-1;color:#7d8495;font-size:11.5px;margin-top:-2px}\
.tw-row input[type=range]{grid-column:1/-1;width:100%;accent-color:#8fb2f2}\
.tw-num{width:74px;font:12px ui-monospace,Menlo,monospace;color:#e9ebf1;background:#14161c;border:1px solid #2b2f3a;border-radius:6px;padding:3px 6px;text-align:right}\
.tw-row input[type=color]{width:46px;height:26px;border:1px solid #2b2f3a;border-radius:6px;background:none;padding:0}\
.tw-row select{font:inherit;color:#e9ebf1;background:#14161c;border:1px solid #2b2f3a;border-radius:6px;padding:4px 6px}\
.tw-out{margin:12px;display:none}.tw-out.on{display:block}\
.tw-out textarea{width:100%;height:150px;font:12px ui-monospace,Menlo,monospace;color:#e9ebf1;background:#14161c;border:1px solid #2b2f3a;border-radius:8px;padding:8px}\
.tw-toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:#e9ebf1;color:#0d0e12;border-radius:999px;padding:8px 14px;font-weight:600;opacity:0;transition:opacity .2s;pointer-events:none;z-index:2147483001}\
.tw-toast.on{opacity:1}\
.tw-save{position:fixed;right:20px;bottom:20px;z-index:2147483000;padding:14px 30px;border:0;border-radius:999px;background:#ffd23f;color:#0d0e12;font-size:15px;font-weight:700;letter-spacing:.04em;box-shadow:0 8px 24px rgba(0,0,0,.45)}\
.tw-save:hover{background:#ffe07a;border:0}\
@media (max-width:760px){.tw{grid-template-columns:1fr;grid-template-rows:minmax(42vh,1fr) minmax(0,48vh)}.tw-panel{border-left:0;border-top:1px solid #23262f}}\
';
  var SIZES = [['Phone', 390, 760], ['Tablet', 820, 1000], ['Laptop', 1280, 800], ['Fill', 0, 0]];

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) { if (k === 'text') e.textContent = attrs[k]; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]); else e.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function decimals(step) { var s = String(step || 1); return s.indexOf('.') < 0 ? 0 : s.length - s.indexOf('.') - 1; }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }

  function Tweaker(cfg) {
    var KEY = 'tweaker:' + cfg.title;
    var defs = {}, v = {}, rows = {};
    cfg.params.forEach(function (p) { defs[p.key] = p.value; });
    var saved = store(KEY) || {};
    cfg.params.forEach(function (p) { v[p.key] = saved.values && p.key in saved.values ? saved.values[p.key] : p.value; });

    document.head.appendChild(el('style', { text: CSS }));
    var stage = el('div', { class: 'tw-stage' });
    var tag = el('span', { class: 'tw-tag' });
    var wrap = el('div', { class: 'tw-wrap', 'data-bg': saved.bg || 'dark' }, [stage, tag]);
    var frameEl = null;
    if (cfg.url) { frameEl = el('iframe', { src: cfg.url, title: cfg.title + ' preview' }); stage.appendChild(frameEl); frameEl.addEventListener('load', function () { push(); }); }

    /* ---- toolbar: device size, background, motion controls ---- */
    var sizeBtns = SIZES.map(function (s) {
      return el('button', { class: 'tw-btn', type: 'button', 'aria-pressed': 'false', text: s[0], onclick: function () { setSize(s); } });
    });
    function setSize(s) {
      sizeBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.textContent === s[0])); });
      stage.style.width = s[1] ? s[1] + 'px' : '100%';
      stage.style.height = s[2] ? Math.min(s[2], wrap.clientHeight - 40) + 'px' : '100%';
      tag.textContent = s[1] ? s[1] + ' × ' + s[2] : '';
      saveUI({ size: s[0] });
      schedule();
    }
    var bgBtn = el('button', { class: 'tw-btn', type: 'button', text: 'Background', onclick: function () {
      var order = ['dark', 'light', 'check'], b = order[(order.indexOf(wrap.dataset.bg) + 1) % 3];
      wrap.dataset.bg = b; saveUI({ bg: b });
    } });
    var speed = 1, paused = false;
    var hasMotion = cfg.replay || cfg.frame || cfg.url;
    var speedBtn = el('button', { class: 'tw-btn', type: 'button', text: 'Speed 1×', title: 'Slow motion, to judge timing', onclick: function () {
      speed = speed === 1 ? 0.5 : speed === 0.5 ? 0.25 : 1; speedBtn.textContent = 'Speed ' + speed + '×'; applySpeed();
    } });
    var pauseBtn = el('button', { class: 'tw-btn', type: 'button', text: 'Pause', 'aria-pressed': 'false', onclick: function () {
      paused = !paused; pauseBtn.setAttribute('aria-pressed', String(paused)); pauseBtn.textContent = paused ? 'Play' : 'Pause'; applySpeed();
    } });
    var replayBtn = el('button', { class: 'tw-btn', type: 'button', text: 'Replay (R)', onclick: replay });
    var bar = el('div', { class: 'tw-bar' }, [el('b', { text: cfg.title })].concat(sizeBtns, [el('span', { class: 'tw-sep' }), bgBtn],
      hasMotion ? [el('span', { class: 'tw-sep' }), replayBtn, pauseBtn, speedBtn] : []));

    /* ---- panel: actions + grouped controls ---- */
    var abSnap = null;
    var abBtn = el('button', { class: 'tw-btn', type: 'button', text: 'Pin A', title: 'Pin the current look as A, then hold to compare', onclick: function () {
      if (!abSnap) { abSnap = Object.assign({}, v); abBtn.textContent = 'Hold for A'; toast('Pinned as A. Keep tweaking, then hold the button to compare'); }
    } });
    var abLive = null;
    abBtn.addEventListener('pointerdown', function () { if (abSnap && abBtn.textContent === 'Hold for A') { abLive = Object.assign({}, v); Object.assign(v, abSnap); abBtn.setAttribute('aria-pressed', 'true'); schedule(); } });
    ['pointerup', 'pointerleave'].forEach(function (ev) { abBtn.addEventListener(ev, function () { if (abLive) { Object.assign(v, abLive); abLive = null; abBtn.setAttribute('aria-pressed', 'false'); schedule(); } }); });
    abBtn.addEventListener('dblclick', function () { abSnap = null; abBtn.textContent = 'Pin A'; toast('A cleared'); });

    var out = el('div', { class: 'tw-out' });
    var outText = el('textarea', { 'aria-label': 'Values to send back', spellcheck: 'false' });
    out.appendChild(outText);
    /* Save (her ask 2026-10-23: "I made changes on the sliders. I need a save button"): only when the
       page passes save(values) — e.g. a POST to the local dev server that writes them into the source */
    var saveBtn = cfg.save ? el('button', { class: 'tw-btn tw-save', type: 'button', text: 'SAVE', title: 'Write these values into the site', onclick: function () {
      Promise.resolve().then(function () { return cfg.save(JSON.parse(JSON.stringify(v))); }).then(function () { toast('Saved into the site'); }, function () { toast('Could not save. Is the dev server running?'); });
    } }) : null;
    /* Save floats big and yellow in the bottom-right corner of the screen (her ask: "more obvious") */
    var acts = el('div', { class: 'tw-acts' }, [
      el('button', { class: 'tw-btn', type: 'button', text: 'Copy values', title: 'Paste these back into the chat to bake them in', onclick: copy }),
      el('button', { class: 'tw-btn', type: 'button', text: 'Paste values', onclick: function () { out.classList.toggle('on'); outText.value = ''; outText.placeholder = 'Paste a values block here'; outText.focus(); } }),
      abBtn,
      el('button', { class: 'tw-btn', type: 'button', text: 'Shuffle', title: 'Random values within each range', onclick: function () { shuffle(null); } }),
      el('button', { class: 'tw-btn', type: 'button', text: 'Reset all', onclick: function () { cfg.params.forEach(function (p) { set(p.key, defs[p.key]); }); toast('Back to the starting values'); } }),
    ]);
    outText.addEventListener('input', function () {
      var m = outText.value.match(/\{[\s\S]*\}/); if (!m) return;
      try { var o = JSON.parse(m[0]); Object.keys(o).forEach(function (k) { if (k in v) set(k, o[k]); }); toast('Values loaded'); } catch (e) { }
    });

    var groups = {};
    cfg.params.forEach(function (p) { (groups[p.group || 'Settings'] = groups[p.group || 'Settings'] || []).push(p); });
    var panelKids = [acts, out];
    Object.keys(groups).forEach(function (g) {
      var rowsEl = el('div', { class: 'tw-rows' });
      groups[g].forEach(function (p) { rowsEl.appendChild(control(p)); });
      var shuf = el('button', { class: 'tw-btn', type: 'button', text: 'shuffle', title: 'Random values for ' + g, onclick: function (e) { e.preventDefault(); shuffle(g); } });
      panelKids.push(el('details', { class: 'tw-group', open: '' }, [el('summary', {}, [el('span', { text: g }), shuf]), rowsEl]));
    });
    var panel = el('aside', { class: 'tw-panel', 'aria-label': 'Controls' }, panelKids);
    var toastEl = el('div', { class: 'tw-toast', role: 'status' });
    var root = el('div', { class: 'tw' }, [el('section', { class: 'tw-view' }, [bar, wrap]), panel]);
    document.body.appendChild(root); document.body.appendChild(toastEl); if (saveBtn) document.body.appendChild(saveBtn);

    function control(p) {
      var id = 'tw-' + p.key, input, num = null;
      if (p.type === 'color') input = el('input', { type: 'color', id: id, value: v[p.key] });
      else if (p.type === 'select') { input = el('select', { id: id }); p.options.forEach(function (o) { var op = el('option', { value: o, text: o }); input.appendChild(op); }); input.value = v[p.key]; }
      else if (p.type === 'toggle') { input = el('input', { type: 'checkbox', id: id }); input.checked = !!v[p.key]; }
      else {
        input = el('input', { type: 'range', id: id, min: p.min, max: p.max, step: p.step || 'any', value: v[p.key] });
        num = el('input', { class: 'tw-num', type: 'text', inputmode: 'decimal', 'aria-label': p.label + ' value' });
      }
      var lab = el('label', { for: id, text: p.label + (p.unit ? ' (' + p.unit + ')' : ''), title: 'Double-click to reset' });
      var row = el('div', { class: 'tw-row' }, [lab, num || (p.type === 'range' ? null : input), num ? input : null, p.hint ? el('div', { class: 'tw-hint', text: p.hint }) : null]);
      var read = function () { return p.type === 'toggle' ? input.checked : p.type === 'range' ? parseFloat(input.value) : input.value; };
      input.addEventListener('input', function () { set(p.key, read(), true); });
      input.addEventListener('change', function () { set(p.key, read(), true); });
      if (num) num.addEventListener('change', function () { var n = parseFloat(num.value); if (!isNaN(n)) set(p.key, n); });
      lab.addEventListener('dblclick', function () { set(p.key, defs[p.key]); });
      rows[p.key] = { p: p, input: input, num: num, row: row };
      sync(p.key);
      return row;
    }
    function sync(k) {
      var r = rows[k]; if (!r) return;
      var p = r.p, val = v[k];
      if (p.type === 'toggle') r.input.checked = !!val; else r.input.value = val;
      if (r.num) r.num.value = Number(val).toFixed(decimals(p.step));
      r.row.classList.toggle('changed', JSON.stringify(val) !== JSON.stringify(defs[k]));
    }
    function set(k, val, fromInput) {
      v[k] = val; if (!fromInput || rows[k].num) sync(k); else rows[k].row.classList.toggle('changed', JSON.stringify(val) !== JSON.stringify(defs[k]));
      store(KEY, Object.assign(store(KEY) || {}, { values: v }));
      schedule();
    }
    function shuffle(group) {
      cfg.params.forEach(function (p) {
        if (group && (p.group || 'Settings') !== group) return;
        if (p.type === 'range') { var s = p.step || 0.01, n = p.min + Math.random() * (p.max - p.min); set(p.key, Math.round(n / s) * s); }
        else if (p.type === 'select') set(p.key, p.options[Math.floor(Math.random() * p.options.length)]);
        else if (p.type === 'toggle') set(p.key, Math.random() < 0.5);
        else if (p.type === 'color') { var h = Math.floor(Math.random() * 16777215).toString(16); set(p.key, '#' + ('000000' + h).slice(-6)); }
      });
      toast(group ? 'Shuffled ' + group : 'Shuffled everything');
    }

    /* ---- applying values ---- */
    var queued = false;
    function schedule() { if (!queued) { queued = true; requestAnimationFrame(function () { queued = false; apply(); }); } }
    /* the CSS value of a param: its number plus a CSS-legal unit (° → deg; × and Hz are
       unitless in CSS). cssUnit overrides, including cssUnit: '' for calc()-ready numbers */
    function cssVal(p) {
      if (p.type !== 'range') return String(v[p.key]);
      var u = 'cssUnit' in p ? p.cssUnit : ({ px: 'px', ms: 'ms', '%': '%', '°': 'deg', s: 's', vw: 'vw', vh: 'vh', em: 'em', rem: 'rem' })[p.unit] || '';
      return v[p.key] + u;
    }
    function cssVars(target) { cfg.params.forEach(function (p) { if (p.css) target.style.setProperty(p.css, cssVal(p)); }); }
    function push(msg) { if (frameEl && frameEl.contentWindow) frameEl.contentWindow.postMessage(Object.assign({ tweaker: true, values: v, css: cfg.params.filter(function (p) { return p.css; }).map(function (p) { return [p.css, cssVal(p)]; }) }, msg || {}), '*'); }
    function apply() {
      if (frameEl) { push(); return; }
      cssVars(stage);
      if (cfg.render) cfg.render(v, stage);
    }
    function replay() {
      if (frameEl) { push({ replay: true }); return; }
      if (cfg.replay) cfg.replay(v, stage);
      applySpeed();
    }
    function applySpeed() {
      var rate = paused ? 0 : speed;
      (stage.getAnimations ? stage.getAnimations({ subtree: true }) : []).forEach(function (a) { a.playbackRate = rate; });
      if (window.gsap) window.gsap.globalTimeline.timeScale(rate || 0.0001);
      if (frameEl) push({ speed: rate });
      /* pages with their own clocks (video, physics) listen for this */
      dispatchEvent(new CustomEvent("tweaker-speed", { detail: rate }));
    }
    /* per-frame clock for canvas work, scaled by the speed control */
    if (cfg.frame) {
      var t = 0, last = performance.now();
      (function loop(now) { var dt = Math.min((now - last) / 1000, 0.05) * (paused ? 0 : speed); last = now; t += dt; cfg.frame(v, stage, t, dt); requestAnimationFrame(loop); })(last);
    }

    /* ---- sending values back ---- */
    function block() {
      var changed = cfg.params.filter(function (p) { return JSON.stringify(v[p.key]) !== JSON.stringify(defs[p.key]); }).map(function (p) { return p.key; });
      var o = {}; cfg.params.forEach(function (p) { o[p.key] = v[p.key]; });
      return 'tweaker: ' + cfg.title + '\nchanged: ' + (changed.join(', ') || 'nothing') + '\n' + JSON.stringify(o, null, 2);
    }
    function copy() {
      var text = block();
      out.classList.add('on'); outText.value = text; outText.select();
      var done = function () { toast('Copied. Paste it into the chat to bake it in'); };
      try { navigator.clipboard.writeText(text).then(done, function () { toast('Select the text below and copy it'); }); } catch (e) { toast('Select the text below and copy it'); }
    }
    function toast(m) { toastEl.textContent = m; toastEl.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.classList.remove('on'); }, 2200); }
    function saveUI(o) { store(KEY, Object.assign(store(KEY) || {}, o)); }

    addEventListener('keydown', function (e) { if ((e.key === 'r' || e.key === 'R') && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) replay(); });
    addEventListener('resize', schedule);
    setSize(SIZES.filter(function (s) { return s[0] === saved.size; })[0] || SIZES[3]);
    apply();
    if (cfg.replay) setTimeout(replay, 60);
    return { values: v, stage: stage, set: set, replay: replay };
  }

  /* A spring as a CSS linear() easing — real physics, so "one small overshoot" is a
     damping value, not a guess at a bezier. Returns { easing, duration } in ms. */
  Tweaker.spring = function (stiffness, damping, mass) {
    mass = mass || 1;
    var x = 0, vel = 0, dt = 1 / 240, t = 0, pts = [], still = 0;
    while (t < 4) {
      var a = (-stiffness * (x - 1) - damping * vel) / mass;
      vel += a * dt; x += vel * dt; t += dt;
      if (Math.round(t * 240) % 4 === 0) pts.push(x);
      still = Math.abs(x - 1) < 0.001 && Math.abs(vel) < 0.01 ? still + dt : 0;
      if (still > 0.05) break;
    }
    pts.push(1);
    return { easing: 'linear(0, ' + pts.map(function (p) { return p.toFixed(4); }).join(', ') + ')', duration: Math.round(t * 1000) };
  };
  window.Tweaker = Tweaker;
})();
