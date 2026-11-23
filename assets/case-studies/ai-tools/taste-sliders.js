/* TASTE SLIDERS, on ONE design element, like Figma's properties panel (her 2026-11-23: "the tweaker is kind of like changing a specific
   design element that we're trying to adjust. It can also just be like padding or something like that, or corner radius"; "Nothing is
   happening to the paper plane"; "I have no idea what I'm moving around when I move that little color bar thing").
   The element is a CARD holding her clay paper plane (data-tile). Three properties, each changing only itself:
   - Corner radius (px): the card's corners.          - Padding (px): the space round the plane, so the plane visibly shrinks/grows.
   - Card fill: a COLOUR WHEEL (her 2026-11-23: "there should be like a circle thing that we can change the hue ... we can tweak purple or
     whatever ... the entire color, like gradient wheel thing"): angle = hue (every hue), distance from the centre = how strong (centre is
     white). The card is exactly the colour under the handle; a swatch shows it; no hex (her "you can't really use a number for color").
   Home tile: one control glides at a time, slowly, with a rest (her "move one thing at a time"); the wheel's turn sweeps the hue round.
   Grab one and it stays put. data-still (the try-it demo, tool-demos.js) or Reduce Motion: no auto-motion, the visitor drives it.
   Held knobs SQUISH (her 2026-11-23: "more tactile, not like there's a white orb around it ... When you grab it, there's almost like a
   squish to it, like an asymmetrical squish"): no ring, no grow. window.tasteSquish below is the one soft-body for every knob on the
   site's demos (range thumbs, wheel handles, the video playhead).
   window.tasteWheel(el, opts) is the same wheel for the Editor demo's Text colour. */
(function () {
  if (window.__tasteSliders) return; window.__tasteSliders = 1;
  const HUES = [[255, 0, 0], [255, 255, 0], [0, 255, 0], [0, 255, 255], [0, 0, 255], [255, 0, 255], [255, 0, 0]];
  const hueRGB = h => { h = ((h % 360) + 360) % 360; const x = h / 60, i = Math.min(5, Math.floor(x)), f = x - i; return HUES[i].map((v, k) => v + (HUES[i + 1][k] - v) * f); };
  /* the rim at lightness L (0..1, undefined = the plain hue): hsl(h,100%,L), an affine copy of the hue so a 7-stop conic is exact */
  const ring = (h, L) => hueRGB(h).map(v => L == null ? v : L <= .5 ? v * 2 * L : v + (255 - v) * (2 * L - 1));
  const mix = (h, r, b, L) => ring(h, L).map((v, k) => Math.round(b[k] * (1 - r) + v * r));   // = the CSS: radial base→transparent over the conic (so with a grey base, exactly hsl(h, r, L))
  const NAMES = ['red', 'orange', 'yellow', 'green', 'green', 'teal', 'blue', 'blue', 'purple', 'pink', 'pink', 'red'];
  const css = document.createElement('style');
  css.textContent = `
.ts-demo{--ink:#161a24;--mut:rgba(22,26,36,.66);--line:rgba(22,26,36,.18);position:absolute;inset:0;display:grid;grid-template-rows:1fr auto;padding:6% 9% 6%;box-sizing:border-box;container-type:size}
html[data-theme=night] .ts-demo,html[data-look=dark] .ts-demo{--ink:#f3f4f6;--mut:rgba(243,244,246,.6);--line:rgba(243,244,246,.22)}
.ts-stage{display:grid;place-items:center;min-height:0;padding-bottom:3cqh}
.ts-card{height:min(36cqw,100%);max-height:40cqh;aspect-ratio:1;box-sizing:border-box;display:grid;place-items:center;box-shadow:inset 0 0 0 1px var(--line)}
.ts-card img{display:block;width:100%;height:100%;object-fit:contain;min-width:0;min-height:0}
.ts-rows{display:grid;grid-template-columns:max-content 1fr max-content;column-gap:max(12px,3cqw);row-gap:min(2.6cqw,3.4cqh)}
.ts-row{display:contents;font:500 max(12px,min(2.8cqw,3.6cqh))/1 'Plus Jakarta Sans',system-ui,sans-serif;letter-spacing:0;color:var(--mut)}
.ts-row>output{align-self:center;min-width:3.2em;padding:4px 6px;border-radius:6px;box-shadow:inset 0 0 0 1px var(--line);text-align:right;font-variant-numeric:tabular-nums;color:var(--ink)}
.ts-row>.ts-sw{align-self:center;justify-self:end;width:1.6em;height:1.6em;border-radius:6px;box-shadow:inset 0 0 0 1px var(--line)}
.ts-row>span{align-self:center;transition:color .4s ease}.ts-row.live>span{color:var(--ink)}
.ts-row .tw{--tw:min(26cqh,150px);justify-self:start}
.ts-row input{-webkit-appearance:none;appearance:none;margin:0;width:100%;height:24px;background:linear-gradient(var(--ink),var(--ink)) 8px 50%/calc((100% - 16px) * var(--f,.5)) 2px no-repeat,linear-gradient(var(--line),var(--line)) 8px 50%/calc(100% - 16px) 2px no-repeat;cursor:grab;touch-action:pan-y}
.ts-row input::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:var(--sq-br,50%);background:var(--ink);border:0;transform:var(--sq,none)}
.ts-row input::-moz-range-thumb{width:16px;height:16px;border-radius:var(--sq-br,50%);background:var(--ink);border:0;transform:var(--sq,none)}
.ts-row input.held,.ts-row input:active{cursor:grabbing}
.ts-row input:focus-visible{outline:2px solid var(--ink);outline-offset:4px;border-radius:4px}
/* the colour wheel */
.tw{position:relative;width:var(--tw,96px);height:var(--tw,96px);flex:none;touch-action:none;cursor:pointer;color:var(--ink)}
.tw-disc{position:absolute;inset:0;border-radius:50%;box-shadow:inset 0 0 0 1px var(--line,rgba(22,26,36,.18))}
.tw-k{position:absolute;left:50%;top:50%;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;box-sizing:border-box;
  box-shadow:0 0 0 2px #fff,0 0 0 3px rgba(22,26,36,.9);cursor:grab;transform:var(--sq,none);border-radius:var(--sq-br,50%)}   /* a solid disc of the applied colour; white + dark hairline rings read on any colour, day or night */
.tw-k.held{cursor:grabbing}
.tw-k:focus-visible{outline:2px solid var(--ink);outline-offset:5px}
@media (prefers-reduced-motion:reduce){.ts-row input::-webkit-slider-thumb{transform:none!important}.ts-row input::-moz-range-thumb{transform:none!important}.tw-k{transform:none!important}}`;
  document.head.appendChild(css);

  /* SQUISH: a soft body driven by the pointer. Grab = a quick pinch; drag = stretch along the drag, more the faster you go, with the
     LEADING side flatter than the trailing one (asymmetric: per-side radii + rotate(angle) scale(x, y)); let go = it springs back with a
     small wobble (a damped spring). It writes two custom properties on `target` (--sq transform, --sq-br radius), which inherit into
     ::-webkit-slider-thumb / ::-moz-range-thumb, so range thumbs squish too. axis 'x' = sliders/playhead (left or right only).
     Reduce Motion: nothing. */
  function squish(el, o) {
    o = o || {}; const tg = o.target || el, ax = o.axis || 'free';
    let id = null, held = false, lx = 0, ly = 0, lt = 0, vx = 0, vy = 0, ang = 0, s = 0, sv = 0, raf = 0, last = 0;
    const K = 520, C = 15;   // stiffness / damping: under-damped, so the release has a small wobble
    const paint = () => {
      if (Math.abs(s) < .002 && !held) { tg.style.removeProperty('--sq'); tg.style.removeProperty('--sq-br'); return; }
      const st = Math.max(0, s), lead = (50 * (1 - Math.min(.62, st * 1.5))).toFixed(1);
      tg.style.setProperty('--sq', `rotate(${ang.toFixed(1)}deg) scale(${(1 + s).toFixed(3)},${(1 - s * .55).toFixed(3)})`);
      tg.style.setProperty('--sq-br', `50% ${lead}% ${lead}% 50% / 50% 50% 50% 50%`);
    };
    const tick = t => {
      const dt = Math.min(.032, Math.max(.001, (t - last) / 1000)); last = t;
      if (performance.now() - lt > 40) { vx *= .8; vy *= .8; }   // the pointer stopped: the stretch relaxes even while held
      const sp = ax === 'x' ? Math.abs(vx) : Math.hypot(vx, vy);
      if (sp > .04) ang = ax === 'x' ? (vx < 0 ? 180 : 0) : Math.atan2(vy, vx) * 180 / Math.PI;
      const goal = held ? -.06 + Math.min(.46, sp * .32) : 0;
      sv += (K * (goal - s) - C * sv) * dt; s += sv * dt;
      paint();
      raf = (held || Math.abs(s) > .002 || Math.abs(sv) > .01) ? requestAnimationFrame(tick) : (paint(), 0);
    };
    const go = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
    el.addEventListener('pointerdown', e => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      id = e.pointerId; held = true; lx = e.clientX; ly = e.clientY; lt = performance.now(); vx = vy = 0; sv -= 7; go();   // the grab: a quick pinch
    });
    addEventListener('pointermove', e => {
      if (!held || e.pointerId !== id) return;
      const now = performance.now(), dt = Math.max(4, now - lt);
      vx += ((e.clientX - lx) / dt - vx) * .4; vy += ((e.clientY - ly) / dt - vy) * .4; lx = e.clientX; ly = e.clientY; lt = now;
    }, { passive: true });
    const up = e => { if (held && (e.pointerId === id || e.type === 'blur')) { held = false; go(); } };
    ['pointerup', 'pointercancel'].forEach(t => addEventListener(t, up)); el.addEventListener('lostpointercapture', up);
  }
  window.tasteSquish = squish;

  /* opts: {h, r, base: 'white' | 'ink', l (0..1: centre = grey at that lightness, colour = exactly hsl(h, r, l)), label, change(rgbArray)} */
  function wheel(el, o) {
    el.classList.add('tw');
    el.innerHTML = `<span class="tw-disc"></span><span class="tw-k" role="slider" tabindex="0" aria-label="${o.label}" aria-valuemin="0" aria-valuemax="359"></span>`;
    const disc = el.querySelector('.tw-disc'), k = el.querySelector('.tw-k');
    let h = o.h || 0, r = o.r || 0, L = o.l;
    const base = () => { if (L != null) return [0, 0, 0].map(() => Math.round(255 * L)); if (o.base !== 'ink') return [255, 255, 255]; const m = getComputedStyle(el).color.match(/\d+/g); return m ? m.slice(0, 3).map(Number) : [22, 26, 36]; };
    const api = {
      el, get h() { return h; }, get r() { return r; }, get l() { return L; },
      colorAt: (hh, rr, ll) => mix(hh, rr, ll == null ? base() : [0, 0, 0].map(() => Math.round(255 * ll)), ll == null ? L : ll),
      setL(ll, quiet) { L = Math.max(0, Math.min(1, ll)); return api.set(h, r, quiet); },
      set(hh, rr, quiet) {
        h = ((hh % 360) + 360) % 360; r = Math.max(0, Math.min(1, rr));
        const b = base(), c = mix(h, r, b, L), a = h * Math.PI / 180;
        disc.style.background = `radial-gradient(circle closest-side,rgb(${b}),rgba(${b},0)),conic-gradient(${[0, 60, 120, 180, 240, 300, 360].map(d => `rgb(${ring(d, L).map(Math.round)})`)})`;
        k.style.left = (50 + 50 * r * Math.sin(a)) + '%'; k.style.top = (50 - 50 * r * Math.cos(a)) + '%'; k.style.background = `rgb(${c})`; el.style.setProperty('--tw-c', `rgb(${c})`);
        k.setAttribute('aria-valuenow', Math.round(h)); k.setAttribute('aria-valuetext', r < .15 ? (L != null ? (L < .2 ? 'ink' : L > .85 ? 'white' : 'grey') : o.base === 'ink' ? 'ink' : 'white') : NAMES[Math.round(h / 30) % 12]);
        if (!quiet && o.change) o.change(c);
        return c;
      }
    };
    const at = e => { const b = el.getBoundingClientRect(), dx = e.clientX - (b.left + b.width / 2), dy = e.clientY - (b.top + b.height / 2);
      api.set(Math.atan2(dx, -dy) * 180 / Math.PI, Math.hypot(dx, dy) / (b.width / 2)); el.dispatchEvent(new Event('input', { bubbles: true })); };
    el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); k.classList.add('held'); k.focus({ preventScroll: true }); at(e); });
    el.addEventListener('pointermove', e => { if (el.hasPointerCapture(e.pointerId)) at(e); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => el.addEventListener(t, () => k.classList.remove('held')));
    squish(el, { target: k });
    k.addEventListener('keydown', e => {
      const d = { ArrowRight: [5, 0], ArrowLeft: [-5, 0], ArrowUp: [0, .05], ArrowDown: [0, -.05] }[e.key];
      if (!d) return; e.preventDefault(); api.set(h + d[0], (r < .05 && d[0] ? .6 : r) + d[1]); el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    api.set(h, r, true);
    return api;
  }
  window.tasteWheel = wheel;

  // [label, key, min, max, start]: literal property names + units, the way her tweaker panel names things
  const ROWS = [['Corner radius (px)', 'r', 0, 48, 16], ['Padding (px)', 'p', 4, 40, 18]];
  function mount(el) {
    el.innerHTML = `<div class="ts-stage"><div class="ts-card"><img src="${el.dataset.tile}" alt=""></div></div><div class="ts-rows">`
      + ROWS.map(([l, k, a, b, v]) => `<label class="ts-row"><span>${l}</span><input type="range" min="${a}" max="${b}" value="${v}" data-k="${k}" aria-label="${l}"><output aria-hidden="true"></output></label>`).join('')
      + `<div class="ts-row"><span>Card fill</span><div class="ts-w"></div><i class="ts-sw" aria-hidden="true"></i></div></div>`;
    const card = el.querySelector('.ts-card'), ins = [...el.querySelectorAll('input')], held = new Set(), sw = el.querySelector('.ts-sw'), outs = el.querySelectorAll('output');
    const paint = c => { card.style.background = `rgb(${c})`; sw.style.background = `rgb(${c})`; };
    const wh = wheel(el.querySelector('.ts-w'), { h: 35, r: .14, base: 'white', label: 'Card fill', change: paint });
    paint(wh.set(wh.h, wh.r, true));
    const apply = () => {
      ins.forEach(i => i.style.setProperty('--f', ((i.value - i.min) / (i.max - i.min)).toFixed(4)));
      card.style.borderRadius = Math.round(+ins[0].value) + 'px'; card.style.padding = Math.round(+ins[1].value) + 'px';
      outs[0].textContent = Math.round(+ins[0].value); outs[1].textContent = Math.round(+ins[1].value);
    };
    ins.forEach(i => {
      i.addEventListener('input', () => { held.add(i); apply(); });
      i.addEventListener('pointerdown', () => i.classList.add('held')); squish(i, { axis: 'x' });
      ['pointerup', 'pointercancel', 'lostpointercapture', 'blur'].forEach(t => i.addEventListener(t, () => i.classList.remove('held')));
    });
    wh.el.addEventListener('input', () => held.add(wh.el));
    addEventListener('pointerup', () => ins.forEach(i => i.classList.remove('held')));
    apply();
    el.tasteWheel = wh;   // for checks
    if (el.hasAttribute('data-still') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let on = false; new IntersectionObserver(es => { on = es[0].isIntersecting; }).observe(el);
    const ctl = [ins[0], ins[1], wh.el], MOVE = 3600, REST = 2200, TO = [[40, 4, 16], [36, 10, 18]], n = [0, 0, 0], rows = [...el.querySelectorAll('.ts-row')];
    let k = 0, start = null, from = 0, to = 0, last = 0;
    (function tick(t) {
      const dt = t - last; last = t;
      if (!on || document.hidden) { if (start !== null) start += dt; }          // pause the clock while off screen
      else {
        if (start === null) {
          while (held.has(ctl[k]) && held.size < 3) k = (k + 1) % 3;
          start = t;
          if (k < 2) { from = +ins[k].value; to = TO[k][n[k]++ % 3]; } else { from = wh.h; to = wh.h + 120; }   // the wheel: a slow third of a turn
          rows.forEach((r, j) => r.classList.toggle('live', j === k));
        }
        const p = Math.min(1, (t - start) / MOVE), e = (1 - Math.cos(Math.PI * p)) / 2;   // sine in-out: the gentlest start and stop
        if (!held.has(ctl[k])) { if (k < 2) { ins[k].value = from + (to - from) * e; apply(); } else wh.set(from + (to - from) * e, Math.max(wh.r, .55)); }
        if (t - start >= MOVE + REST) { rows[k].classList.remove('live'); k = (k + 1) % 3; start = null; }
      }
      requestAnimationFrame(tick);
    })(performance.now());
  }
  window.tasteSliders = mount;   // for a copy shown elsewhere (the try-it demo)
  const go = () => document.querySelectorAll('.ts-demo').forEach(mount);
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', go) : go();
})();
