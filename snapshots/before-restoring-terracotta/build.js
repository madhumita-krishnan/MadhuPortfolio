#!/usr/bin/env node
/* Madhu portfolio — static site generator.
   Content lives in data/*.json. Run `node build.js` → dist/.
   No dependencies. */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const readJSON = p => JSON.parse(fs.readFileSync(p, 'utf8'));

const theme = readJSON(path.join(ROOT, 'data/theme.json'));
const site = readJSON(path.join(ROOT, 'data/site.json'));
const csDir = path.join(ROOT, 'data/case-studies');
const cases = fs.readdirSync(csDir).filter(f => f.endsWith('.json'))
  .map(f => readJSON(path.join(csDir, f)))
  .sort((a, b) => (a.order || 99) - (b.order || 99));

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const BUILD_V = Date.now().toString(36); // cache-buster: every rebuild gets fresh CSS/JS

/* The fade that dissolves the hero photograph into the red field behind it: two straight
   ramps and an oval, intersected. Verbatim output of `node tools/make-hero-flower.js` — that
   script crops and colour-grades the photograph against this exact profile, so the two are
   the same function rather than two sets of numbers left to drift. Re-run it and paste its
   last three lines if the crop ever moves. */
const HERO_BLOOM_MASK = [
  'linear-gradient(to right,rgba(0,0,0,0.000) 0.00%,rgba(0,0,0,0.043) 1.68%,rgba(0,0,0,0.156) 3.37%,rgba(0,0,0,0.316) 5.05%,rgba(0,0,0,0.500) 6.73%,rgba(0,0,0,0.684) 8.42%,rgba(0,0,0,0.844) 10.10%,rgba(0,0,0,0.957) 11.79%,rgba(0,0,0,1.000) 13.47%,rgba(0,0,0,1.000) 81.22%,rgba(0,0,0,0.957) 83.57%,rgba(0,0,0,0.844) 85.92%,rgba(0,0,0,0.684) 88.27%,rgba(0,0,0,0.500) 90.61%,rgba(0,0,0,0.316) 92.96%,rgba(0,0,0,0.156) 95.31%,rgba(0,0,0,0.043) 97.65%,rgba(0,0,0,0.000) 100.00%)',
  'linear-gradient(to bottom,rgba(0,0,0,0.000) 0.00%,rgba(0,0,0,0.043) 1.14%,rgba(0,0,0,0.156) 2.29%,rgba(0,0,0,0.316) 3.43%,rgba(0,0,0,0.500) 4.58%,rgba(0,0,0,0.684) 5.72%,rgba(0,0,0,0.844) 6.86%,rgba(0,0,0,0.957) 8.01%,rgba(0,0,0,1.000) 9.15%,rgba(0,0,0,1.000) 80.00%,rgba(0,0,0,0.957) 82.50%,rgba(0,0,0,0.844) 85.00%,rgba(0,0,0,0.684) 87.50%,rgba(0,0,0,0.500) 90.00%,rgba(0,0,0,0.316) 92.50%,rgba(0,0,0,0.156) 95.00%,rgba(0,0,0,0.043) 97.50%,rgba(0,0,0,0.000) 100.00%)',
  'radial-gradient(68% 64% at 50% 48%,rgba(0,0,0,1.000) 70.00%,rgba(0,0,0,0.957) 73.75%,rgba(0,0,0,0.844) 77.50%,rgba(0,0,0,0.684) 81.25%,rgba(0,0,0,0.500) 85.00%,rgba(0,0,0,0.316) 88.75%,rgba(0,0,0,0.156) 92.50%,rgba(0,0,0,0.043) 96.25%,rgba(0,0,0,0.000) 100.00%)',
].join(',');
const HERO_BLOOM_COMPOSITE = 'intersect,intersect,intersect';

/* ---- intrinsic size of a local PNG/JPEG, so phone screens can be aspect-checked ---- */
const SCREEN_AR = 9 / 19.5; // 0.4615 — a modern iPhone screen
function imageSize(rel) {
  try {
    const buf = fs.readFileSync(path.join(ROOT, rel));
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47)         // PNG: IHDR
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    if (buf[0] === 0xff && buf[1] === 0xd8) {                          // JPEG: walk to SOFn
      let i = 2;
      while (i < buf.length - 9) {
        if (buf[i] !== 0xff) { i++; continue }
        const marker = buf[i + 1];
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
          return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
  } catch { /* remote or unreadable — fall back to cover */ }
  return null;
}
const fitWarnings = [];
/* Spec §3: if the source is within ~5% of 9:19.5 the mismatch is invisible when the
   image is stretched, and stretching keeps the whole screen — status bar AND tab bar.
   Beyond that, cover-crop from the top instead of distorting the design. */
function screenFit(src) {
  const d = imageSize(src);
  if (!d) return '';
  const ar = d.w / d.h, off = (ar / SCREEN_AR - 1) * 100;
  fitWarnings.push(`  ${src}  ${d.w}x${d.h}  ar ${ar.toFixed(4)}  ${off >= 0 ? '+' : ''}${off.toFixed(1)}% off 9:19.5  → ${Math.abs(off) <= 5 ? 'fill' : 'cover'}`);
  return Math.abs(off) <= 5 ? ' data-fit="fill"' : '';
}

/* ---- typography rule: never leave one word alone on the last line ----
   Site-wide. Escapes, then ties the last two words together with a nowrap span so the
   line breaks earlier instead. A span (not &nbsp;) because the hero's word-by-word
   reveal re-splits text nodes — it preserves elements, so the tie survives it. */
function typo(s) {
  const w = esc(s).trim().split(/\s+/);
  if (w.length < 3) return w.join(' ');
  // a dangling dash is a deliberate break, not a widow — leave it alone
  if (/^[—–-]$/.test(w[w.length - 2])) return w.join(' ');
  const tail = w.splice(-2).join(' ');
  return `${w.join(' ')} <span class="nw">${tail}</span>`;
}

/* ---------------------------------------------------------------- CSS */
function makeCSS() {
  const c = theme.colors, g = theme.glass, f = theme.fonts, r = theme.radii, m = theme.motion;
  return `
:root{
${Object.entries(c).map(([k, v]) => `  --${k}:${v};`).join('\n')}
  --font-display:${f.display};
  --font-body:${f.body};
  --font-utility:${f.utility};
  --r-card:${r.card};--r-media:${r.media};--r-pill:${r.pill};
  --motion-fast:${m.fast};--motion-base:${m.base};--motion-slow:${m.slow};
  --ease-standard:${m['ease-standard']};--ease-enter:${m['ease-enter']};
  --space:${theme.space};
}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{background:var(--bg-base);color:var(--text-primary);font-family:var(--font-body);-webkit-font-smoothing:antialiased;overflow-x:hidden}
img,video{max-width:100%;display:block}
a{color:inherit}
/* site-wide typography rule: never a single word alone on the last line. build.js ties
   the last two words of every string together (see typo()); text-wrap:pretty asks the
   browser to avoid widows everywhere else it can. */
.nw{white-space:nowrap}
p,h1,h2,h3,li,figcaption,blockquote{text-wrap:pretty}
.svg-defs{position:absolute;width:0;height:0;overflow:hidden}

/* ------------------------------------------------ cursor
   A small solid dot. On a case-study card it does three quick flips and then rolls out
   into a pill offering "I'm curious".
   Three layers, because each needs its own transform: .dc is positioned by JS, .dc-spin
   owns the flips, .dc-body owns the shape. Stacking them on one element would mean the
   follow, the turn and the roll-out all fighting over 'transform'.
   dc-on is set by JS only, and only for a fine pointer, so if the script never runs or
   the visitor is on a touch device the real cursor is never taken away. */
body.dc-on,body.dc-on a,body.dc-on button,body.dc-on [role=tab]{cursor:none}
.dc{position:fixed;left:0;top:0;z-index:9999;pointer-events:none;opacity:0;
  will-change:transform;transition:opacity .25s linear}
.dc.live{opacity:1}
.dc-spin{position:absolute;left:0;top:0;transform:translate(-50%,-50%);transform-style:preserve-3d}
/* a solid circle has no features, so a spin would be invisible — rotateY works because
   the disc foreshortens to a line and back on each half turn */
.dc.turning .dc-spin{animation:dcTurn .5s cubic-bezier(.5,0,.5,1)}
@keyframes dcTurn{
  from{transform:translate(-50%,-50%) rotateY(0deg)}
  to{transform:translate(-50%,-50%) rotateY(1080deg)}}
.dc-body{height:13px;width:13px;border-radius:999px;background:var(--accent);
  display:flex;align-items:center;justify-content:center;overflow:hidden;white-space:nowrap;
  box-shadow:0 2px 8px rgba(38,51,47,.22);
  transition:width .34s var(--ease-enter),height .34s var(--ease-enter),background .2s linear}
.dc-body span{opacity:0;transition:opacity .16s linear;padding:0 16px;
  font-family:var(--font-utility);font-weight:500;font-size:.62rem;letter-spacing:.16em;
  text-transform:uppercase;color:var(--bg-base)}
/* width is hand-fitted to the label — the pill animates width, so it can't be auto */
.dc.pill .dc-body{width:140px;height:34px}
.dc.pill .dc-body span{opacity:1;transition-delay:.1s}
.dc.go .dc-spin{animation:dcGo .34s var(--ease-standard) forwards}
@keyframes dcGo{
  from{transform:translate(-50%,-50%) scale(1);opacity:1}
  to{transform:translate(-50%,-50%) scale(1.35);opacity:0}}
@media (hover:none),(pointer:coarse){.dc{display:none}body.dc-on{cursor:auto}}

/* warm light across the cream field + paper grain */
.atmosphere{position:fixed;inset:0;pointer-events:none;z-index:0;
  background:
    radial-gradient(58vw 42vh at 12% -6%, rgba(169,78,44,.07), transparent 62%),
    radial-gradient(46vw 38vh at 88% 4%, rgba(157,186,180,.13), transparent 60%),
    radial-gradient(70vw 52vh at 55% 110%, rgba(196,137,47,.07), transparent 64%);}
body::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:60;opacity:.045;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}

/* chalk underline in fern */
.chalk-line{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='9' viewBox='0 0 140 9'%3E%3Cfilter id='c' x='-10%25' y='-150%25' width='120%25' height='400%25'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.14 0.9' numOctaves='2' seed='7'/%3E%3CfeDisplacementMap in='SourceGraphic' scale='4'/%3E%3C/filter%3E%3Cpath d='M3 5 Q 35 3.5 70 4.5 T 137 4.5' fill='none' stroke='%231B6E49' stroke-width='2.6' stroke-linecap='round' stroke-dasharray='9 2 14 3 6 2 11 2' filter='url(%23c)' opacity='.85'/%3E%3C/svg%3E");
  background-repeat:repeat-x;background-position:left bottom;background-size:140px 9px;padding-bottom:.14em}

/* ------------------------------------------------ liquid glass
   Four things make glass read as glass, and the old version only had one of them:
   1. it bends what is behind it       → backdrop-filter:url(#glassWarp), a low-frequency
                                         feDisplacementMap, so edges of things behind
                                         the panel visibly shift
   2. light catches the top and bottom → bright inset crescents, not a flat 1px line
   3. the rim splits light like a prism→ a faint conic rainbow masked to the edge only
   4. it is never perfectly still      → a slow, tiny float
   No sweeping shimmer on hover — it read as a swipe effect, not as a material. */
.glass{
  position:relative;
  background:linear-gradient(150deg, rgba(255,255,255,.50) 0%, ${g['light-bg']} 52%, rgba(255,255,255,.26) 100%);
  -webkit-backdrop-filter:blur(${g.blur}) saturate(${g.saturate});
  backdrop-filter:blur(${g.blur}) saturate(${g.saturate});
  border:1px solid ${g['light-border']};
  box-shadow:
    inset 0 1.5px 1.5px -1px rgba(255,255,255,.98),
    inset 0 -2px 2px -1px rgba(255,255,255,.62),
    inset 1.5px 0 2px -1px rgba(255,255,255,.42),
    inset -1.5px 0 2px -1px rgba(255,255,255,.42),
    inset 0 0 18px rgba(255,255,255,.16),
    0 10px 30px var(--shadow-soft);
}
/* the prism rim. Sits on the edge only, so the middle of the panel stays clean. */
.glass::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:0;
  background:conic-gradient(from 38deg,
    rgba(255,255,255,0) 0deg, rgba(255,120,128,.34) 22deg, rgba(255,214,96,.30) 42deg,
    rgba(126,240,186,.26) 62deg, rgba(112,178,255,.34) 82deg, rgba(192,152,255,.24) 102deg,
    rgba(255,255,255,0) 128deg);
  -webkit-mask:linear-gradient(#000,#000) content-box exclude,linear-gradient(#000,#000);
  mask:linear-gradient(#000,#000) content-box exclude,linear-gradient(#000,#000);
  padding:1.5px;mix-blend-mode:screen;opacity:.9}
.glass>*{position:relative;z-index:1}
.glass-dark{
  background:linear-gradient(150deg, rgba(255,255,255,.14) 0%, ${g['dark-bg']} 52%, rgba(18,35,32,.44) 100%);
  -webkit-backdrop-filter:blur(${g.blur}) saturate(${g.saturate});
  backdrop-filter:blur(${g.blur}) saturate(${g.saturate});
  border:1px solid ${g['dark-border']};
  box-shadow:inset 0 1.5px 1.5px -1px rgba(255,255,255,.55), inset 0 -2px 2px -1px rgba(255,255,255,.22),
             0 10px 30px rgba(0,0,0,.25);
  color:var(--text-on-deep);
}
/* it floats — a couple of pixels over eight seconds, out of phase per element */
.float{animation:glassFloat 9s ease-in-out infinite}
.float:nth-of-type(even){animation-duration:11s;animation-delay:-3s}
@keyframes glassFloat{0%,100%{translate:0 0}33%{translate:.5px -2px}66%{translate:-.5px 1px}}
.btn{font-family:var(--font-utility);font-size:.8rem;letter-spacing:.04em;text-decoration:none;
  padding:0 22px;border-radius:var(--r-pill);min-height:46px;display:inline-flex;align-items:center;gap:8px;
  color:var(--text-primary);cursor:pointer;position:relative;
  transition:transform var(--motion-fast) var(--ease-standard), box-shadow var(--motion-base) var(--ease-standard)}
.btn:hover,.btn:focus-visible{transform:translateY(-1px);box-shadow:inset 0 1.5px 1.5px -1px rgba(255,255,255,.98), inset 0 -2px 2px -1px rgba(255,255,255,.62), 0 14px 34px var(--shadow-soft)}
.btn.solid{background:var(--accent);border-color:var(--accent-deep);color:var(--text-on-deep);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.35), 0 10px 26px var(--shadow-clay)}
.btn.solid:hover{box-shadow:inset 0 1px 0 rgba(255,255,255,.35), 0 14px 32px var(--shadow-clay)}
.glass-dark.btn{color:var(--text-on-deep)}

/* ------------------------------------------------ nav */
.nav-wrap{position:fixed;top:14px;left:0;right:0;z-index:50;display:flex;justify-content:center;padding:0 16px}
nav.bar{display:flex;align-items:center;gap:6px;padding:6px 6px 6px 20px;border-radius:var(--r-pill);max-width:820px;width:100%;justify-content:space-between}
/* The SVG displacement warp lives HERE and nowhere else. Every element carrying
   backdrop-filter:url() costs a full backdrop snapshot + turbulence + displacement pass,
   and there were twelve of them (nav, every button, every chip, the play button). The nav
   is the only one big enough for a 5px displacement to be visible at all — on a 46px pill
   the warp is imperceptible but costs the same. Buttons and chips keep blur+saturate.
   Do not promote this to .glass. */
nav.bar.glass{backdrop-filter:url(#glassWarp) blur(${g.blur}) saturate(${g.saturate})}
.wordmark{font-family:var(--font-display);font-size:1.35rem;letter-spacing:.02em;text-decoration:none;color:var(--text-primary);margin-right:8px;white-space:nowrap}
.nav-links{display:flex;gap:2px;align-items:center}
.nav-links a{font-family:var(--font-utility);font-size:.74rem;letter-spacing:.05em;text-decoration:none;color:var(--text-secondary);
  padding:10px 13px;border-radius:var(--r-pill);transition:color var(--motion-fast) var(--ease-standard),background var(--motion-fast) var(--ease-standard)}
.nav-links a:hover,.nav-links a:focus-visible{color:var(--accent-deep);background:var(--accent-wash)}
@media (max-width:700px){.nav-links a.optional{display:none}}
/* The nav floats over the hero's red field before it floats over the cream page, and dark
   text on a light pane over deep red is unreadable. So for as long as the field is behind it
   the bar takes the dark glass instead — .glass-dark is declared after .glass and both are
   one class, so simply adding it wins, while nav.bar.glass keeps the displacement warp. The
   swap is driven by an observer on .hero-band in makeJS. */
nav.bar{transition:background var(--motion-base) var(--ease-standard),border-color var(--motion-base) var(--ease-standard)}
nav.bar.on-field .wordmark{color:var(--text-on-deep)}
nav.bar.on-field .nav-links a{color:var(--text-on-deep-secondary)}
nav.bar.on-field .nav-links a:hover,nav.bar.on-field .nav-links a:focus-visible{
  color:var(--field-edge);background:var(--text-on-deep-secondary)}
nav.bar.on-field .btn.solid{background:var(--text-on-deep);border-color:rgba(255,255,255,.55);color:var(--accent-deep)}
.wordmark,.nav-links a,nav .btn.solid{transition:color var(--motion-base) var(--ease-standard),background var(--motion-base) var(--ease-standard)}

/* ------------------------------------------------ shared sections */
main{position:relative;z-index:1}
section{padding:calc(var(--space)*14) calc(var(--space)*6);max-width:1240px;margin:0 auto;position:relative}
.eyebrow{font-family:var(--font-utility);font-size:.78rem;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:calc(var(--space)*3)}
.section-title{font-family:var(--font-display);font-weight:400;font-size:clamp(1.8rem,3.4vw,2.7rem);line-height:1.2;max-width:26ch;margin-bottom:calc(var(--space)*7);color:var(--ink-display)}
.fade{opacity:0;transform:translateY(24px);transition:opacity var(--motion-slow) var(--ease-enter),transform var(--motion-slow) var(--ease-enter)}
.fade.visible{opacity:1;transform:none}
.below-fold{}

/* ------------------------------------------------ hero
   The hero is the photograph's world, not a page with a photograph placed on it. Her picture
   is a white bloom standing on red felt; .hero-band paints that red from edge to edge of the
   viewport and .hero-bloom lays the plant on top with its own edges dissolved into it, so
   nothing in here has a frame or a corner. tools/make-hero-flower.js has the how.
   Everything else follows from the ground going dark: the copy is the petal cream, because
   cream on red is the only bright thing in the photograph too. */
.hero-band{position:relative;isolation:isolate;color:var(--text-on-deep);
  /* Flat --field out to 46%, and only then a vignette. The plateau is the whole trick: --field
     is the colour the photograph's outer ring was graded to, so as long as the field does not
     vary anywhere the flower's fade lands, the join cannot be seen. The plateau is centred on
     the bloom and reaches ~760px at desktop, which clears it by a wide margin — but if the
     bloom is ever moved or grown, check that first.
     The falloff runs down and to the left, which is both where the copy is (cream wants the
     darker ground under it) and where the light goes in the photograph. */
  background:radial-gradient(115% 120% at 72% 54%,
    var(--field) 0%, var(--field) 46%, var(--field-deep) 76%, var(--field-edge) 100%)}
/* The felt. Once the colour matched, the join was no longer a colour step at all — levels
   agreed to within 4% — and it was still perfectly visible, because the photograph's grain had
   about seven times the amplitude of a CSS gradient (stddev 6.9 against 1.0 in rendered
   luminance), and the eye reads texture starting as an edge just as readily as it reads a line.
   So the field gets grain of its own at the felt's frequency.
   These numbers were fitted, not guessed, and matching amplitude alone was not enough — the
   first attempt had the right stddev and still read as speckle against felt, because its
   frequency was wrong. What is matched is the structure function: mean |ΔL| between pixels at
   increasing separation, measured on bare field and bare felt in a real 1440px render. Felt
   gives 1px:6.5 2px:9.6 3px:10.2, plateau 11.4; this gives 7.4 / 10.5 / 11.2, plateau 10.6.
   If the photograph is ever replaced, re-fit rather than reuse: baseFrequency sets where the
   curve saturates, opacity sets its plateau.
   It sits UNDER the photograph, not over it: where the picture is opaque you get the real
   felt, where it has faded you get this, and across the fade the two cross-dissolve. Painting
   it on top instead would stack grain on grain in the middle and make the mismatch worse.
   Static, and a plain background-image — one feTurbulence rasterised once and tiled. Never
   put this in a backdrop-filter; an animated one there cost 17fps on this site before.
   The turbulence is desaturated and forced to full alpha before use. Raw feTurbulence puts
   noise in the alpha channel as well as the colour channels, which makes the layer brighten
   what is under it on average rather than only roughening it — and because this sits under
   the photograph, that average landed as the photograph reading ~10 luminance darker than
   the field it was lying on. Grey noise centred on 0.5 at alpha 1 keeps 'overlay'
   mean-preserving, which is the whole reason it can go underneath at all. */
.hero-band::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;opacity:1;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='f' color-interpolation-filters='sRGB'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.34' numOctaves='2' seed='4'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3CfeGaussianBlur stdDeviation='.35'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='discrete' tableValues='1'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23f)'/%3E%3C/svg%3E");
  mix-blend-mode:overlay}
/* The pool of light. tools/make-hero-flower.js divides most of the photographer's falloff out
   of the picture so its ground can lie flat on the field; this puts light back — but across
   the whole hero at once, over the field and the photograph alike, so it no longer stops at
   the edge of the crop. That is the point: a pool of light that runs off the picture is what
   makes the picture stop being a picture. Centred on the bloom, same centre as the field.
   Kept weak: at .30 it washed the petals salmon, which is the one thing in the frame that
   has to stay white. */
.hero-light{position:absolute;inset:0;pointer-events:none;z-index:2;
  background:radial-gradient(52% 58% at 72% 54%,
    rgba(236,140,94,.15) 0%, rgba(228,124,78,.09) 44%, rgba(214,104,64,.03) 70%, transparent 88%)}
.hero-bloom{position:relative;z-index:1}
.hero-copy{position:relative;z-index:3}
.hero{padding-top:calc(var(--space)*22);padding-bottom:calc(var(--space)*12);min-height:min(88vh,860px);
  display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;
  column-gap:clamp(20px,3.4vw,56px)}
/* deliberately NOT isolated: .hero-light is a sibling of this section and has to be able to
   lie between the photograph and the copy in the band's stacking context */
.hero-copy{display:flex;flex-direction:column;justify-content:center;min-width:0}
.hero .eyebrow{margin-bottom:calc(var(--space)*4);color:var(--text-on-deep-secondary)}
/* the headline is the petal cream. It also lost a step of size against the old cream hero:
   it is sharing the row with the flower now, and at 7rem it crowded the leaves. */
.hero h1{font-family:var(--font-display);font-weight:300;font-size:clamp(2.9rem,6.2vw,6rem);
  line-height:1;letter-spacing:-.005em;color:var(--text-on-deep)}
/* Madhu's own handwriting, lifted off a photo of her notebook and used as a mask so it
   takes the design-system ink rather than being a flat black picture — which is what lets
   it be the reference blue instead of the near-black it was photographed in. The sentence
   is still in the DOM for screen readers and search — see .vh.
   Despeckled, re-spaced and punctuated by tools/clean-handwriting.js; the untouched lift
   is kept beside it as hero-line-handwritten-raw.png, and the aspect-ratio below belongs
   to the cleaned file (the extra leading made it taller). */
.hero-line{width:min(100%,470px);aspect-ratio:1416/772;margin-top:calc(var(--space)*5);
  background:var(--text-on-deep);
  /* versioned like the CSS and JS: the sentence itself lives in this file, so a returning
     visitor holding the old PNG in cache would keep reading the old copy */
  -webkit-mask:url(assets/hero/hero-line-handwritten.png?v=${BUILD_V}) left center/contain no-repeat;
  mask:url(assets/hero/hero-line-handwritten.png?v=${BUILD_V}) left center/contain no-repeat}
.vh{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;
  clip-path:inset(50%);white-space:nowrap;border:0}
.hero-cta-row{margin-top:calc(var(--space)*7);display:flex;gap:14px;flex-wrap:wrap}

/* the plant. Her instruction was that it stand about as tall as the copy beside it, so the
   element is sized against the copy block rather than against the viewport: at desktop the
   copy measures ~520px and the plant fills roughly 84% of the crop's height, which is where
   the 620px cap comes from. The photograph is only 736x920 at source, so it is never allowed
   to grow past the point where it visibly softens. */
.hero-bloom{margin:0;display:flex;justify-content:center;align-items:center}
.hero-bloom img{display:block;height:clamp(360px,46vw,664px);width:auto;
  /* the two crossed ramps that dissolve the crop into .hero-band — see HERO_BLOOM_MASK at
     the top of this file, which is generated by tools/make-hero-flower.js. Smoothstep
     sampled at eight points, not a plain linear fade: a linear alpha ramp leaves a Mach
     band where it meets full opacity. */
  -webkit-mask-image:${HERO_BLOOM_MASK};mask-image:${HERO_BLOOM_MASK};
  -webkit-mask-composite:${HERO_BLOOM_COMPOSITE};mask-composite:${HERO_BLOOM_COMPOSITE}}
/* the field is dark now, so the bright thing has to be the button — a clay button on clay
   ground vanishes. This is the bloom's job in the photograph, done by the CTA. */
.hero .btn.solid{background:var(--text-on-deep);border-color:rgba(255,255,255,.55);color:var(--accent-deep);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.75), 0 12px 30px rgba(46,11,4,.45)}
.hero .btn.solid:hover{box-shadow:inset 0 1px 0 rgba(255,255,255,.75), 0 16px 36px rgba(46,11,4,.52)}
.w{display:inline-block;white-space:pre;opacity:0;transform:translateY(.45em);transition:opacity var(--motion-slow) var(--ease-enter),transform var(--motion-slow) var(--ease-enter)}
.revealed .w{opacity:1;transform:none}
.lively .ch{display:inline-block;white-space:pre;transition:transform var(--motion-base) var(--ease-standard),color var(--motion-base) var(--ease-standard)}
/* the wave used to tint clay; on the red field that is invisible, so it tints to the stem
   green picked off the photograph instead */
.lively:hover .ch{color:var(--sage)}
.lively.waving .ch{transform:translateY(-7px)}
/* below ~900px the two columns stop fitting side by side. The plant goes under the copy
   rather than shrinking into a stamp, and the field carries on around it either way. */
@media (max-width:900px){
  .hero{grid-template-columns:minmax(0,1fr);row-gap:calc(var(--space)*4)}
  .hero-bloom{justify-content:flex-start}
  .hero-bloom img{height:clamp(300px,52vw,440px)}
  /* Both centres follow the flower down to the bottom left. This is not decoration: the
     plateau is the colour the photograph's rim was graded to match, and leaving it behind in
     the right-hand column brought the rectangle straight back at 880px. Measured — the bloom
     centres at 26-40% across and 75% down over this whole range and reaches 21% of the band's
     width, so the plateau is sized to clear it at both ends. */
  .hero-band{background:radial-gradient(150% 120% at 33% 76%,
    var(--field) 0%, var(--field) 55%, var(--field-deep) 84%, var(--field-edge) 100%)}
  .hero-light{background:radial-gradient(58% 34% at 33% 76%,
    rgba(236,140,94,.15) 0%, rgba(228,124,78,.09) 44%, rgba(214,104,64,.03) 70%, transparent 88%)}}
@media (max-width:760px){.hero{padding-top:calc(var(--space)*20);min-height:0}.hero-line{max-width:none}}

/* ------------------------------------------------ brands strip */
.brands{padding-top:0;padding-bottom:calc(var(--space)*6)}
.brands-head{border-top:1px solid var(--line);padding-top:calc(var(--space)*4);
  display:flex;align-items:baseline;justify-content:space-between;gap:calc(var(--space)*4);flex-wrap:wrap}
.brands-head p{font-family:var(--font-utility);font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--text-secondary)}
.brands-row{margin-top:calc(var(--space)*6);display:grid;
  grid-template-columns:repeat(auto-fit,minmax(80px,1fr));align-items:center;
  gap:calc(var(--space)*5) calc(var(--space)*3.5)}
/* logos are a mixed bag of cream, black and full-colour marks — masking them to one
   ink is the only way a row of nine reads as a set rather than a clip-art pile.
   The masks come from assets/logos/clean/, not the raw files: each original is a cream
   mark with an opaque dark outline + drop shadow baked in, and an alpha mask can't tell
   mark from shadow, so every glyph doubled and smeared. tools/clean-logos.js rebuilds
   the alpha from luminance to recover just the letterforms. */
.brand{height:38px;width:100%;background:var(--brand-ink);
  -webkit-mask:var(--logo) center/contain no-repeat;mask:var(--logo) center/contain no-repeat;
  transition:background var(--motion-base) var(--ease-standard)}
.brand:hover{background:var(--ink-display)}
@media (max-width:600px){.brands-row{gap:calc(var(--space)*4)}.brand{height:28px}}

/* ------------------------------------------------ work cards (outcome statements) */
.wproject{display:grid;grid-template-columns:1fr minmax(0,46%);gap:calc(var(--space)*8);align-items:center;margin-bottom:calc(var(--space)*13);
  text-decoration:none;color:inherit;border-radius:var(--r-card);padding:calc(var(--space)*3);
  transition:background var(--motion-base) var(--ease-standard)}
/* hover wash is the terracotta wash token, not white — white is not in this palette and
   read as a cold sheet laid over the warm cream */
.wproject:hover{background:var(--accent-wash)}
.wproject:last-of-type{margin-bottom:0}
.w-outcome{font-family:var(--font-display);font-weight:400;font-size:clamp(1.45rem,2.7vw,2.15rem);line-height:1.28;max-width:24ch}
.w-chiprow{display:flex;align-items:center;gap:12px;margin-top:calc(var(--space)*2.5);flex-wrap:wrap}
.w-chip{font-family:var(--font-utility);font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;
  padding:9px 16px;border-radius:var(--r-pill);color:var(--text-primary)}
.w-tags{font-family:var(--font-utility);font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:var(--text-secondary)}
@media (max-width:760px){.wproject{grid-template-columns:1fr;gap:calc(var(--space)*4);margin-bottom:calc(var(--space)*9)}
  .wproject .project-media-wrap{order:-1}}
.project-media-wrap{display:flex;justify-content:center}

/* ---------- iPhone frame (see DEVICE_MOCKUP_SPEC.md) ----------
   Every dimension is a fraction of the screen width SW, so one frame scales to any
   size. Screen is 9:19.5 (0.4615); black glass bezel 0.0305·SW; titanium rail
   0.0213·SW; screen corner radius 0.1341·SW. Border T = 0.0518·SW, so the device is
   1.1036·SW wide and 2.2705·SW tall — that is the aspect-ratio below. Percentages
   here are of the DEVICE width, i.e. the spec fraction divided by 1.1036.
   Container query units make 1cqw = 1% of the device width, which is what lets the
   rail be shaded by distance inward (see .phone) rather than with a flat gradient. */
.phone-media{container-type:inline-size;width:100%;max-width:222px}
.phone{position:relative;aspect-ratio:1.1036/2.2705;
  --rail:1.930cqw;              /* 0.0213·SW */
  --border:4.694cqw;            /* rail + black bezel = T */
  border-radius:16.85% / 8.19%; /* (screen radius + T) as % of device w / h */
  background:#8E9195;
  /* distance-inward metallic ramp: each inset ring follows the rounded corners, so the
     specular highlight lands ON the visible rail and wraps the corners correctly.
     A left-to-right gradient would hide the highlight under the black bezel. */
  box-shadow:
    inset 0 0 0 calc(var(--rail)*.06) rgb(108,110,114),
    inset 0 0 0 calc(var(--rail)*.16) rgb(172,175,180),
    inset 0 0 0 calc(var(--rail)*.30) rgb(240,242,245),
    inset 0 0 0 calc(var(--rail)*.50) rgb(214,216,220),
    inset 0 0 0 calc(var(--rail)*.70) rgb(190,193,198),
    inset 0 0 0 calc(var(--rail)*.86) rgb(160,163,168),
    inset 0 0 0 var(--rail) rgb(112,114,119);
  filter:drop-shadow(0 1.1cqw 1.9cqw rgba(12,14,20,.28)) drop-shadow(0 2.8cqw 4.7cqw rgba(12,14,20,.20))}
/* key light from the upper left, so the frame is not symmetrical and synthetic.
   Only visible over the rail — the glass layer covers the middle. */
.phone::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:1;
  background:linear-gradient(152deg,rgba(255,255,255,.34),rgba(255,255,255,0) 30%,rgba(0,0,0,0) 64%,rgba(0,0,0,.18))}
/* black glass, inset by the rail; radius = screen radius + bezel */
.phone::after{content:"";position:absolute;inset:var(--rail);z-index:2;pointer-events:none;
  border-radius:14.92% / 7.25%;background:#08080A;
  box-shadow:inset 0 0 0 1px rgba(60,61,64,.9)}
.phone-screen{position:absolute;inset:var(--border);z-index:3;overflow:hidden;background:#000;
  border-radius:12.15% / 5.91%}
.phone-screen img,.phone-screen video{position:absolute;inset:0;width:100%;height:100%;
  object-fit:cover;object-position:top center}
/* Sources within ~5% of 9:19.5 are stretched rather than cropped, so nothing is lost
   off the bottom of the screen. build.js decides this per source — see screenFit(). */
.phone-screen img[data-fit=fill]{object-fit:fill}
/* The still screens are only ~300px wide at source, so on a Retina display they are
   being upscaled. A gentle unsharp mask restores edge definition on the upscale — it
   cannot invent detail, only re-crisp what is there. Videos are already sharp, so the
   filter is scoped to images. */
.phone-screen img{filter:url(#screenSharpen)}
/* Dynamic Island: 0.3186 × 0.0915 of SW, sitting 0.0274·SW below the screen top */
.phone-island{position:absolute;z-index:4;left:50%;transform:translateX(-50%);
  top:7.18cqw;width:28.87cqw;height:8.29cqw;border-radius:999px;background:#06060A}
.phone-island::after{content:"";position:absolute;right:19%;top:50%;transform:translateY(-50%);
  width:2.1cqw;height:2.1cqw;border-radius:50%;background:radial-gradient(circle at 36% 32%,#243042,#0A0C12 70%)}
/* side buttons. The inner end fades to the rail colour so they read as tucked under
   it rather than pasted on top (a child can't paint behind its parent's background). */
.phone-btn{position:absolute;z-index:0}
.phone-btn.l{left:-.97cqw;width:2.4cqw;border-radius:.6cqw 0 0 .6cqw;
  background:linear-gradient(90deg,#5C5F63,#9A9DA1 46%,rgba(150,153,157,0))}
.phone-btn.r{right:-.97cqw;width:2.4cqw;border-radius:0 .6cqw .6cqw 0;
  background:linear-gradient(270deg,#5C5F63,#9A9DA1 46%,rgba(150,153,157,0))}
.phone-btn.action{top:16%;height:4.2%}
.phone-btn.volup{top:23%;height:6.4%}
.phone-btn.voldn{top:31%;height:6.4%}
.phone-btn.power{top:24%;height:9%}
.phone-btn.camera{top:36%;height:4.6%}
@media (max-width:760px){.phone-media{max-width:178px}}

/* the landscape card and the Mac window must end up the SAME box. The window is
   1.945 of body plus 80 logical px of chrome at a 1280pt reference, i.e. total height
   = w*(1/1.945 + 80/1280) — a constant ratio of 1.7343, whatever the width. */
.project-media{position:relative;border-radius:var(--r-media);overflow:hidden;border:1px solid var(--line);background:var(--bg-raised);aspect-ratio:1.7343;width:100%}
.project-media video,.project-media img.poster{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
[data-video] video{opacity:0;transition:opacity var(--motion-base) var(--ease-standard)}
[data-video].playing video{opacity:1}

/* ---------- Mac browser window (for shipped websites) ----------
   The window stands in for a real 1280pt-wide Chrome window, so every piece of chrome
   is sized in --u = one logical pixel at that width. Hard-coded px made the traffic
   lights and tab strip roughly 2-3x oversized for the frame they sat in, which is the
   single thing that gives a fake browser away. Chrome's real metrics: 40pt tab strip,
   34pt tabs, 12pt lights 8pt apart, 40pt toolbar, 28pt omnibox, 10pt window radius. */
.browser{container-type:inline-size;width:100%;--u:.0781cqw;
  border-radius:calc(10*var(--u));overflow:hidden;background:#E6E8E3;
  box-shadow:0 calc(24*var(--u)) calc(54*var(--u)) var(--shadow-mid),
             0 calc(2*var(--u)) calc(6*var(--u)) var(--shadow-soft),
             inset 0 0 0 1px rgba(24,38,32,.10)}
.browser-chrome{background:linear-gradient(#E9EBE6,#DFE1DC)}
.browser-row{display:flex;align-items:flex-end;height:calc(40*var(--u));padding-left:calc(20*var(--u))}
.browser-dots{display:flex;gap:calc(8*var(--u));flex:0 0 auto;align-self:center;
  margin-bottom:calc(-3*var(--u));padding-right:calc(18*var(--u))}
.browser-dots i{width:calc(12*var(--u));height:calc(12*var(--u));border-radius:50%;display:block}
.browser-dots i:nth-child(1){background:#EC6A5E}
.browser-dots i:nth-child(2){background:#F4BF4F}
.browser-dots i:nth-child(3){background:#61C554}
.browser-tab{display:flex;align-items:center;gap:calc(8*var(--u));background:#FBFCF8;
  border-radius:calc(8*var(--u)) calc(8*var(--u)) 0 0;
  height:calc(34*var(--u));width:calc(240*var(--u));padding:0 calc(12*var(--u));
  overflow:hidden;white-space:nowrap;
  font-family:var(--font-utility);font-size:max(6px,calc(12*var(--u)));letter-spacing:.01em;color:var(--text-secondary)}
.browser-tab .fav{width:calc(16*var(--u));height:calc(16*var(--u));border-radius:calc(3*var(--u));background:var(--accent);flex:0 0 auto}
.browser-url{display:flex;align-items:center;height:calc(40*var(--u));padding:0 calc(12*var(--u));
  background:#FBFCF8;border-bottom:1px solid rgba(24,38,32,.10)}
.browser-url .pill{flex:1;height:calc(28*var(--u));border-radius:999px;background:#F1F3EE;
  display:flex;align-items:center;padding:0 calc(12*var(--u));
  font-family:var(--font-utility);font-size:max(6px,calc(12*var(--u)));color:var(--text-secondary)}
.browser-url .lock{width:calc(9*var(--u));height:calc(9*var(--u));border-radius:calc(2*var(--u));
  border:1px solid var(--text-secondary);opacity:.6;margin-right:calc(8*var(--u));flex:0 0 auto}
/* matches the 2880x1480 screen captures, so nothing gets cropped */
.browser-body{position:relative;aspect-ratio:1.945;background:#fff;overflow:hidden}
.browser-body img.poster,.browser-body video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top center}

/* ------------------------------------------------ disciplines */
.panels{display:flex;gap:calc(var(--space)*1.5);height:min(72vh,620px)}
.panel{position:relative;flex:1 1 0;min-width:0;border-radius:var(--r-media);overflow:hidden;cursor:pointer;border:1px solid var(--line);
  transition:flex-grow var(--motion-slow) var(--ease-enter);background:var(--bg-raised)}
.panel.active{flex-grow:8}
.panel img,.panel video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(.94)}
.panel::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(18,35,32,0) 38%,rgba(18,35,32,.85) 100%)}
.panel video{opacity:0;transition:opacity var(--motion-base) var(--ease-standard);z-index:1}
.panel.active.has-video video{opacity:1}
.panel-collapsed-label{position:absolute;bottom:calc(var(--space)*3);left:50%;transform:translateX(-50%) rotate(180deg);writing-mode:vertical-rl;
  font-family:var(--font-utility);font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--text-on-deep);white-space:nowrap;z-index:2;opacity:.9;
  transition:opacity var(--motion-base) var(--ease-standard);text-shadow:0 1px 6px var(--shadow-strong)}
.panel.active .panel-collapsed-label{opacity:0;pointer-events:none}
.panel-content{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:calc(var(--space)*4);opacity:0;transform:translateY(12px);
  transition:opacity var(--motion-base) var(--ease-enter) 120ms,transform var(--motion-base) var(--ease-enter) 120ms;pointer-events:none}
.panel.active .panel-content{opacity:1;transform:none}
.p-org{font-family:var(--font-utility);font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:var(--accent-bright);margin-bottom:calc(var(--space)*1)}
.p-title{font-family:var(--font-display);font-weight:400;color:var(--text-on-deep);font-size:clamp(1.3rem,2.2vw,1.9rem);line-height:1.2;margin-bottom:calc(var(--space)*1);max-width:24ch}
.p-desc{color:var(--text-on-deep-secondary);font-size:.98rem;line-height:1.5;max-width:52ch}
@media (max-width:760px){.panels{flex-direction:column;height:auto}
  .panel{height:84px;flex:none;transition:height var(--motion-slow) var(--ease-enter)}
  .panel.active{height:360px;flex:none}
  .panel-collapsed-label{writing-mode:horizontal-tb;transform:translateX(-50%);bottom:auto;top:50%;margin-top:-.5em}}

/* ------------------------------------------------ story */
.story{margin:0}
/* capped at its natural width so it is never upscaled — a soft GIF would undo the point */
.story img{width:100%;max-width:1000px;height:auto}
/* the stacked cut is a different shape, and <source> carries no dimensions — without this
   the phone reserves the wide aspect and the page jumps when the GIF lands */
@media (max-width:760px){.story img{aspect-ratio:660/1060;max-width:none}}

/* ------------------------------------------------ about + footer */
.about-band{display:grid;grid-template-columns:180px 1fr;gap:calc(var(--space)*7);align-items:center}
.about-band .headshot{width:180px;height:180px;border-radius:50%;object-fit:cover;box-shadow:0 18px 40px var(--shadow-mid)}
/* display type is the reference blue, same rule as .hero h1 and .section-title — this is
   the architecture/brand sentence, and it is a headline, not body copy */
.about-title{font-family:var(--font-display);font-weight:400;font-size:clamp(1.5rem,2.9vw,2.3rem);line-height:1.25;margin-bottom:calc(var(--space)*2);max-width:30ch;color:var(--ink-display)}
.about-body{color:var(--text-secondary);line-height:1.6;max-width:62ch;margin-bottom:calc(var(--space)*3)}
@media (max-width:700px){.about-band{grid-template-columns:1fr}.about-band .headshot{width:130px;height:130px}}
.resume-band{text-align:center}
.big-link{font-family:var(--font-display);font-size:clamp(2rem,5vw,3.6rem);color:var(--text-primary);text-decoration:none;transition:color var(--motion-fast) var(--ease-standard)}
.big-link:hover,.big-link:focus-visible{color:var(--accent)}
footer{border-top:1px solid var(--line);padding:calc(var(--space)*5) calc(var(--space)*6);display:flex;justify-content:space-between;align-items:center;gap:16px;max-width:1240px;margin:0 auto;position:relative;z-index:1}
footer a{color:var(--text-primary);text-decoration:none;font-size:.92rem;transition:color var(--motion-fast) var(--ease-standard)}
footer a:hover{color:var(--accent)}
.foot-mark{font-family:var(--font-display);font-size:1.3rem}
.foot-note{font-family:var(--font-utility);font-size:.7rem;letter-spacing:.08em;color:var(--text-secondary)}
@media (max-width:640px){footer{flex-direction:column;gap:10px;text-align:center}
  section{padding-left:calc(var(--space)*3);padding-right:calc(var(--space)*3);padding-top:calc(var(--space)*10);padding-bottom:calc(var(--space)*10)}}

/* ================================================ case study pages */
.cs-hero{position:relative;z-index:1;padding:96px 16px 0}
.cs-hero-band{max-width:1240px;margin:0 auto;border-radius:24px;overflow:hidden;position:relative;
  background:
    radial-gradient(80% 120% at 15% 0%, var(--bg-deep-raised) 0%, var(--bg-deep) 55%, var(--bg-deep-shade) 100%);
  color:var(--text-on-deep);padding:clamp(28px,4.5vw,56px)}
.cs-hero-band.light{background:linear-gradient(160deg,var(--bg-raised) 0%,var(--accent-wash) 100%);color:var(--text-primary)}
.cs-kicker{font-family:var(--font-utility);font-size:.75rem;letter-spacing:.16em;text-transform:uppercase;color:var(--accent-bright);margin-bottom:14px}
.cs-hero-band.light .cs-kicker{color:var(--accent-deep)}
.cs-title{font-family:var(--font-display);font-weight:400;font-size:clamp(2rem,4.6vw,3.6rem);line-height:1.12;max-width:22ch;margin-bottom:12px}
.cs-tagline{font-size:clamp(1rem,1.6vw,1.2rem);line-height:1.5;max-width:58ch;color:var(--text-on-deep-secondary)}
.cs-hero-band.light .cs-tagline{color:var(--text-secondary)}
.cs-hero-media{margin-top:clamp(24px,4vw,44px);border-radius:var(--r-media);overflow:hidden;box-shadow:0 30px 80px var(--shadow-strong)}
.cs-hero-media img,.cs-hero-media video{width:100%;height:auto}
.cs-hero-phones{margin-top:clamp(24px,4vw,44px);display:flex;justify-content:center;gap:clamp(16px,3vw,42px);align-items:flex-start}
.cs-hero-phones>img{width:min(38%,300px);height:auto;filter:drop-shadow(0 24px 44px var(--shadow-mid))}
.cs-hero-phones .phone-media{width:min(38%,218px);max-width:218px}
.cs-hero-phone-video{margin-top:clamp(24px,4vw,44px);display:flex;justify-content:center}
.cs-hero-phone-video .phone-media{max-width:225px}
.cs-intro{max-width:900px;margin:0 auto;padding:calc(var(--space)*9) calc(var(--space)*6) 0}
.cs-intro p{font-size:clamp(1.05rem,1.7vw,1.25rem);line-height:1.65;margin-bottom:calc(var(--space)*3);max-width:62ch}
.cs-meta{max-width:900px;margin:0 auto;padding:calc(var(--space)*5) calc(var(--space)*6);display:flex;flex-wrap:wrap;gap:calc(var(--space)*6) calc(var(--space)*8)}
.cs-meta div{min-width:120px}
.cs-meta dt{font-family:var(--font-utility);font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;color:var(--text-secondary);margin-bottom:6px}
.cs-meta dd{font-size:.95rem}
.cs-meta a{color:var(--accent-deep)}
.cs-tags{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}
.cs-tag{font-family:var(--font-utility);font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;padding:8px 14px;border-radius:var(--r-pill)}

.cs-stats{max-width:1240px;margin:calc(var(--space)*6) auto 0;padding:0 calc(var(--space)*2)}
.cs-stats-band{border-radius:24px;background:linear-gradient(150deg,var(--accent-wash),var(--bg-raised));padding:clamp(20px,3.5vw,40px);display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}
.stat-card{border-radius:var(--r-card);padding:22px 22px 20px}
.stat-value{font-family:var(--font-display);font-size:clamp(1.9rem,3.4vw,2.8rem);color:var(--accent-deep);line-height:1.05;margin-bottom:8px}
.stat-label{font-size:.88rem;line-height:1.45;color:var(--text-secondary)}

.cs-row{max-width:1100px;margin:0 auto;padding:calc(var(--space)*10) calc(var(--space)*6) 0;display:grid;grid-template-columns:220px 1fr;gap:calc(var(--space)*6)}
.cs-label{font-family:var(--font-utility);font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);position:sticky;top:96px;align-self:start;padding-top:6px}
/* the case-study equivalent of .section-title, so it takes the same reference blue.
   .cs-title is deliberately NOT blue — it sits on the deep teal band, where the blue goes
   muddy; on that band the light cream is the display colour. */
.cs-heading{font-family:var(--font-display);font-weight:400;font-size:clamp(1.5rem,2.8vw,2.2rem);line-height:1.2;margin-bottom:calc(var(--space)*3);max-width:26ch;color:var(--ink-display)}
.cs-body p{color:var(--text-secondary);line-height:1.65;font-size:1.02rem;margin-bottom:calc(var(--space)*2.5);max-width:62ch}
.cs-quote{border-left:3px solid var(--accent);padding:6px 0 6px 22px;margin:calc(var(--space)*3) 0}
.cs-quote p{font-family:var(--font-display);font-size:clamp(1.2rem,2vw,1.6rem);line-height:1.35;color:var(--text-primary);margin-bottom:8px}
.cs-quote cite{font-family:var(--font-utility);font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--text-secondary);font-style:normal}
@media (max-width:820px){.cs-row{grid-template-columns:1fr;gap:calc(var(--space)*2)}.cs-label{position:static}}

.cs-media-band{max-width:1240px;margin:calc(var(--space)*7) auto 0;padding:0 calc(var(--space)*2)}
.cs-media-inner{border-radius:24px;padding:clamp(20px,4vw,56px);display:flex;flex-direction:column;align-items:center;gap:18px}
.cs-media-inner.wash{background:linear-gradient(150deg,var(--bg-raised),var(--accent-wash))}
.cs-media-inner.deep{background:radial-gradient(90% 130% at 20% 0%,var(--bg-deep-raised) 0%,var(--bg-deep) 60%,var(--bg-deep-shade) 100%)}
.cs-media-frame{border-radius:var(--r-media);overflow:hidden;width:100%;box-shadow:0 24px 60px var(--shadow-mid);position:relative}
.cs-media-frame img,.cs-media-frame video{width:100%;height:auto}
.cs-phones{display:flex;justify-content:center;gap:clamp(14px,3vw,40px);width:100%;align-items:flex-start}
.cs-phones>img{width:min(42%,300px);height:auto;filter:drop-shadow(0 22px 40px var(--shadow-mid))}
.cs-phones .phone-media{width:min(42%,218px);max-width:218px}
.cs-caption{font-family:var(--font-utility);font-size:.74rem;letter-spacing:.05em;line-height:1.6;color:var(--text-secondary);max-width:64ch;text-align:center}
.cs-media-inner.deep .cs-caption{color:var(--text-on-deep-secondary)}

/* before / after compare */
.cs-compare{max-width:1100px;margin:calc(var(--space)*6) auto 0;padding:0 calc(var(--space)*6);display:grid;grid-template-columns:1fr 1fr;gap:16px}
.cmp-col{border-radius:var(--r-card);padding:clamp(18px,2.6vw,30px)}
.cmp-col.before{background:var(--bg-raised);border:1px solid var(--line)}
.cmp-col.after{background:linear-gradient(160deg,var(--bg-raised),var(--accent-wash));border:1px solid var(--line-accent)}
.cmp-head{font-family:var(--font-utility);font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;margin-bottom:18px;color:var(--text-secondary)}
.cmp-col.after .cmp-head{color:var(--accent-deep)}
.cmp-item{margin-bottom:20px}
.cmp-item:last-child{margin-bottom:0}
.cmp-item h4{font-size:.98rem;margin-bottom:6px}
.cmp-col.before .cmp-item h4{color:var(--text-secondary)}
.cmp-item p{font-size:.9rem;line-height:1.55;color:var(--text-secondary)}
.cmp-note{margin-top:6px;font-size:.8rem;color:var(--accent-deep);font-family:var(--font-utility)}
@media (max-width:760px){.cs-compare{grid-template-columns:1fr}}

.cs-next{max-width:1240px;margin:calc(var(--space)*12) auto 0;padding:0 calc(var(--space)*2) calc(var(--space)*4)}
.cs-next-card{display:flex;justify-content:space-between;align-items:center;gap:20px;border-radius:24px;padding:clamp(24px,4vw,48px);text-decoration:none;
  background:radial-gradient(90% 140% at 15% 0%,var(--bg-deep-raised) 0%,var(--bg-deep) 60%,var(--bg-deep-shade) 100%);color:var(--text-on-deep)}
.cs-next-card .k{font-family:var(--font-utility);font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--accent-bright);margin-bottom:10px}
.cs-next-card .t{font-family:var(--font-display);font-size:clamp(1.5rem,3.2vw,2.6rem);line-height:1.15}
.cs-next-card .arrow{font-size:clamp(1.6rem,3vw,2.4rem);transition:transform var(--motion-base) var(--ease-standard)}
.cs-next-card:hover .arrow{transform:translate(6px,-6px)}

.play-btn{position:absolute;bottom:16px;right:16px;z-index:6;width:52px;height:52px;border-radius:50%;border:none;cursor:pointer;
  font-size:1.05rem;display:none;align-items:center;justify-content:center;color:var(--text-primary)}
.phone-media .play-btn{bottom:9cqw;right:50%;transform:translateX(50%);width:34px;height:34px;font-size:.8rem}
.rm-mode .play-btn{display:flex}
a:focus-visible,button:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:4px}

/* settle fail-safe: nothing ever stays invisible, even if transitions never run */
.settled .w{opacity:1;transform:none}
.settled .fade{opacity:1;transform:none}

/* reduced motion */
.rm-mode .w,.rm-mode .fade{opacity:1;transform:none;transition:none}
@media (prefers-reduced-motion:reduce){
  .w,.fade{opacity:1 !important;transform:none !important;transition:none !important}
  .play-btn{display:flex}
  html{scroll-behavior:auto}
}
`;
}

/* ---------------------------------------------------------------- JS */
function makeJS() {
  return `(function(){
  const prefersRM=matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer=matchMedia('(hover: hover) and (pointer: fine)');
  const rmActive=()=>prefersRM.matches||document.body.classList.contains('rm-mode');

  /* hero word-by-word reveal */
  const hero=document.querySelector('.hero');
  if(hero){
    /* split into per-word spans, recursing through elements so inline markup
       (the <em> in the hero line) survives the rewrite */
    document.querySelectorAll('.reveal-words').forEach(el=>{
      let seq=Number(el.dataset.seq||0);
      const walk=node=>{
        [...node.childNodes].forEach(child=>{
          if(child.nodeType===3){
            const frag=document.createDocumentFragment();
            child.textContent.split(/(?<=\\s)/).forEach(tok=>{
              if(!tok)return;
              const w=document.createElement('span');w.className='w';
              w.style.transitionDelay=(seq++*55)+'ms';w.textContent=tok;frag.appendChild(w);
            });
            node.replaceChild(frag,child);
          }else if(child.nodeType===1){walk(child)}
        });
      };
      walk(el);
      el.dataset.seqEnd=seq;
    });
    document.querySelectorAll('.lively').forEach(el=>{
      const txt=el.textContent;el.textContent='';
      [...txt].forEach(ch=>{const c=document.createElement('span');c.className='ch';c.textContent=ch;el.appendChild(c)});
      const stagger=26;
      el.addEventListener('mouseenter',()=>{if(!rmActive()){[...el.querySelectorAll('.ch')].forEach((c,i)=>c.style.transitionDelay=(i*stagger)+'ms')}el.classList.add('waving')});
      el.addEventListener('mouseleave',()=>{if(!rmActive()){const chs=[...el.querySelectorAll('.ch')];chs.forEach((c,i)=>c.style.transitionDelay=((chs.length-1-i)*stagger)+'ms')}el.classList.remove('waving')});
    });
    requestAnimationFrame(()=>setTimeout(()=>hero.classList.add('revealed'),120));
  }
  /* absolute fail-safe: everything visible even if transitions never tick */
  setTimeout(()=>document.body.classList.add('settled'),1900);

  /* nav over the hero's red field: swap the pane to dark glass while the field is behind it.
     Measured against the bar's own bottom edge rather than a scroll threshold, so it stays
     right whatever the hero's height works out to at this viewport. */
  const band=document.querySelector('.hero-band'), bar=document.querySelector('nav.bar');
  if(band&&bar){
    const sync=()=>{
      const b=bar.getBoundingClientRect();
      bar.classList.toggle('on-field',band.getBoundingClientRect().bottom>b.top+b.height*0.5);
      bar.classList.toggle('glass-dark',bar.classList.contains('on-field'));
    };
    sync();
    addEventListener('scroll',sync,{passive:true});
    addEventListener('resize',sync,{passive:true});
  }

  /* screenshot/QA hook: ?shot=1200 shifts the page up by 1200px with everything
     revealed and every lazy image eagerly loaded (headless Chrome can't screenshot
     a scrolled page, and lazy images below the fold never fire otherwise). */
  const shot=location.search.match(/shot=(\\d+)/);
  if(shot){
    document.body.classList.add('settled');
    document.querySelectorAll('.fade').forEach(el=>el.classList.add('visible'));
    document.querySelectorAll('img[loading=lazy]').forEach(i=>i.loading='eager');
    document.querySelectorAll('video[data-src]').forEach(v=>{if(!v.src)v.src=v.dataset.src});
    document.body.style.marginTop=(-shot[1])+'px';
  }

  /* ================= cursor =================
     A small solid dot that follows with a touch of lag. On a case-study card it flips
     three times, then rolls out into a pill reading "I'm curious"; clicking rolls
     it back up and turns the page. Pointer-only — on touch, coarse pointers or reduced
     motion it never arms and the real cursor is left alone. */
  const dc=document.getElementById('dc');
  if(dc&&finePointer.matches&&!prefersRM.matches){
    document.body.classList.add('dc-on');
    let tx=innerWidth/2, ty=innerHeight/2, x=tx, y=ty, seen=false, raf=0;
    addEventListener('pointermove',e=>{
      tx=e.clientX;ty=e.clientY;
      if(!seen){seen=true;x=tx;y=ty;dc.classList.add('live');if(!raf)raf=requestAnimationFrame(tick)}
    },{passive:true});
    /* a little lag, not a lot — enough to feel physical, not enough to feel laggy */
    function tick(){
      x+=(tx-x)*0.24; y+=(ty-y)*0.24;
      dc.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px)';
      raf=requestAnimationFrame(tick);
    }
    addEventListener('pointerleave',()=>dc.classList.remove('live'));
    addEventListener('pointerenter',()=>{if(seen)dc.classList.add('live')});
    /* keyboard users get their cursor back the moment they tab */
    addEventListener('keydown',e=>{if(e.key==='Tab'){document.body.classList.remove('dc-on');dc.classList.remove('live')}},{once:true});

    let turnTimer=0;
    const TURN_MS=500;                                   // must match the dcTurn keyframe
    function curious(on){
      clearTimeout(turnTimer);
      if(on){
        dc.classList.add('turning');
        /* the pill only rolls out once the three turns have finished, so it reads as
           one gesture rather than two things happening at once */
        turnTimer=setTimeout(()=>{dc.classList.remove('turning');dc.classList.add('pill')},TURN_MS);
      }else{
        dc.classList.remove('turning','pill');
      }
    }
    document.querySelectorAll('[data-curious]').forEach(card=>{
      card.addEventListener('pointerenter',()=>curious(true));
      card.addEventListener('pointerleave',()=>curious(false));
      card.addEventListener('click',e=>{
        if(e.metaKey||e.ctrlKey||e.shiftKey||e.button!==0)return;   // let people open in a new tab
        e.preventDefault();
        curious(false);
        dc.classList.add('go');
        const go=()=>{location.href=card.href};
        dc.addEventListener('animationend',go,{once:true});
        setTimeout(go,420);                                        // never strand them
      });
    });
  }

  /* scroll reveal */
  const fades=[...document.querySelectorAll('.fade')];
  if(rmActive()){fades.forEach(el=>el.classList.add('visible'))}
  else{
    const io=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target)}})},{threshold:.08});
    fades.forEach(el=>{const r=el.getBoundingClientRect();if(r.top<innerHeight*.95)el.classList.add('visible');else io.observe(el)});
    setTimeout(()=>fades.forEach(el=>el.classList.add('visible')),3000);
  }

  /* lazy video: hover-to-play on desktop, in-view autoplay on touch; src attached on first need */
  document.querySelectorAll('[data-video]').forEach(box=>{
    const vid=box.querySelector('video');if(!vid)return;
    const btn=box.querySelector('.play-btn');
    const hoverZone=box.closest('.wproject')||box;
    function arm(){if(!vid.src&&vid.dataset.src){vid.src=vid.dataset.src}}
    function play(){arm();vid.play().then(()=>box.classList.add('playing')).catch(()=>{})}
    function pause(){vid.pause();box.classList.remove('playing')}
    if(btn){btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();
      if(box.classList.contains('playing')){pause();btn.textContent='▶'}else{play();btn.textContent='❚❚'}})}
    /* data-autoplay = behave like a GIF: run whenever it is on screen, on any device */
    if(box.hasAttribute('data-autoplay')){
      new IntersectionObserver(es=>{es.forEach(e=>{if(rmActive())return;e.isIntersecting?play():pause()})},{threshold:.15}).observe(box);
      return;
    }
    if(finePointer.matches){
      hoverZone.addEventListener('mouseenter',()=>{if(!rmActive())play()});
      hoverZone.addEventListener('mouseleave',()=>{if(!rmActive())pause()});
    }else{
      new IntersectionObserver(es=>{es.forEach(e=>{if(rmActive())return;e.isIntersecting&&e.intersectionRatio>=.5?play():pause()})},{threshold:[0,.5,1]}).observe(box);
    }
    new IntersectionObserver(es=>{es.forEach(e=>{if(!e.isIntersecting)pause()})},{threshold:0}).observe(box);
  });

  /* disciplines panels */
  const panels=[...document.querySelectorAll('#panels .panel')];
  if(panels.length){
    function activate(target){panels.forEach(p=>{const on=p===target;p.classList.toggle('active',on);p.setAttribute('aria-selected',String(on));
      const v=p.querySelector('video');if(v){if(on&&!rmActive()){if(!v.src&&v.dataset.src)v.src=v.dataset.src;v.play().catch(()=>{})}else v.pause()}})}
    panels.forEach(p=>{
      p.addEventListener('click',()=>activate(p));
      p.addEventListener('mouseenter',()=>{if(finePointer.matches)activate(p)});
      p.addEventListener('keydown',e=>{
        if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(p)}
        if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();const n=panels[(panels.indexOf(p)+1)%panels.length];n.focus();activate(n)}
        if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();const n=panels[(panels.indexOf(p)-1+panels.length)%panels.length];n.focus();activate(n)}
      });
    });
    const sec=document.getElementById('disciplines');
    if(sec)new IntersectionObserver(es=>{es.forEach(e=>{if(!e.isIntersecting)panels.forEach(p=>{const v=p.querySelector('video');if(v)v.pause()})
      else{const a=document.querySelector('#panels .panel.active video');if(a&&!rmActive())a.play().catch(()=>{})}})},{threshold:0}).observe(sec);
  }
})();`;
}

/* ---------------------------------------------------------------- shared HTML bits */
function head(title, desc) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${theme.fonts['google-css']}" rel="stylesheet">
<link rel="stylesheet" href="styles.css?v=${BUILD_V}">
<noscript><style>.w{opacity:1;transform:none}.fade{opacity:1;transform:none}.dc{display:none}</style></noscript>
</head>
<body>
${svgFilters()}
<div class="atmosphere" aria-hidden="true"></div>
<div class="dc" id="dc" aria-hidden="true"><div class="dc-spin"><div class="dc-body"><span>I'm curious</span></div></div></div>`;
}

/* Filters the CSS references. Chrome only gained SVG filter functions in
   backdrop-filter recently; where it is unsupported the -webkit- fallback in each
   rule still gives blur+saturate, so the glass degrades to frosted, never to nothing. */
function svgFilters() {
  return `<svg class="svg-defs" width="0" height="0" aria-hidden="true" focusable="false">
  <!-- nav: one octave of very low-frequency noise = a few broad, smooth swells, so the
       backdrop reads as refracted through glass, not scrambled.

       PERFORMANCE, do not re-add the <animate> that used to live in here. Animating
       baseFrequency means the browser regenerates fractal noise and re-runs the
       displacement map over the whole backdrop EVERY frame, forever, on every element
       that references this filter — it pinned the page to 43fps while sitting idle
       doing nothing. A static warp still bends what is behind the panel, which is the
       part of the look that matters; "it is never perfectly still" is carried by the
       .float translate instead, which the compositor does for free.

       The old #dropletWarp filter was deleted with it: the droplet cursor was cut, so
       nothing referenced it, but its indefinite <animate> was still in the DOM. -->
  <filter id="glassWarp" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.005 0.007" numOctaves="1" seed="9" result="n"/>
    <feGaussianBlur in="n" stdDeviation="1.8" result="ns"/>
    <feDisplacementMap in="SourceGraphic" in2="ns" scale="5" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <!-- gentle unsharp mask for the low-resolution phone screenshots -->
  <filter id="screenSharpen" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feConvolveMatrix order="3" preserveAlpha="true" divisor="1"
      kernelMatrix="0 -0.35 0  -0.35 2.4 -0.35  0 -0.35 0"/>
  </filter>
</svg>`;
}

function navBar(kind) {
  const home = kind === 'home';
  const links = home
    ? `<a href="#work">Work</a><a class="optional" href="#disciplines">Disciplines</a><a class="optional" href="#about">About</a><a href="assets/resume.pdf" target="_blank" rel="noopener">Resume</a>`
    : `<a href="index.html#work">← All work</a><a class="optional" href="assets/resume.pdf" target="_blank" rel="noopener">Resume</a>`;
  return `<div class="nav-wrap"><nav class="bar glass" aria-label="Main">
  <a class="wordmark" href="index.html">${esc(site.wordmark)}</a>
  <div class="nav-links">${links}</div>
  <a class="btn glass solid" href="${esc(site.calendly)}" target="_blank" rel="noopener">say hey</a>
</nav></div>`;
}

function footerHTML() {
  return `<footer>
  <span class="foot-mark">${esc(site.wordmark)}</span>
  <a href="mailto:${esc(site.email)}">${esc(site.email)}</a>
  <span class="foot-note">${esc(site.footer.note)}</span>
</footer>
<script src="app.js?v=${BUILD_V}" defer></script>
</body>
</html>`;
}

function videoTag(m, { eager = false } = {}) {
  return `<video muted loop playsinline preload="none" data-src="${esc(m.src)}" poster="${esc(m.poster || '')}" aria-label="${esc(m.alt || '')}"></video>`;
}

/* one phone frame for every phone screen on the site — geometry lives in the CSS,
   so it is crisp at any size and needs no bezel image. Pass island:false when the
   source recording already has a notch or island baked into it. */
function phoneFrame(inner, { attrs = '', extra = '', island = true } = {}) {
  return `<div class="phone-media"${attrs}>
      <div class="phone">
        <span class="phone-btn l action" aria-hidden="true"></span>
        <span class="phone-btn l volup" aria-hidden="true"></span>
        <span class="phone-btn l voldn" aria-hidden="true"></span>
        <span class="phone-btn r power" aria-hidden="true"></span>
        <span class="phone-btn r camera" aria-hidden="true"></span>
        <div class="phone-screen">${inner}</div>
        ${island ? '<span class="phone-island" aria-hidden="true"></span>' : ''}
        ${extra}
      </div>
    </div>`;
}

/* Mac browser window for shipped websites */
function browserFrame(m, { eager = false } = {}) {
  const isVideo = /\.(mp4|webm)$/.test(m.src || '');
  const body = isVideo
    ? `<img class="poster" src="${esc(m.poster)}" alt="${esc(m.alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">
       <video muted loop playsinline preload="none" data-src="${esc(m.src)}" poster="${esc(m.poster || '')}" aria-label="${esc(m.alt || '')}"></video>
       <button class="play-btn glass" type="button" aria-label="Play preview">▶</button>`
    : `<img class="poster" src="${esc(m.src)}" alt="${esc(m.alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`;
  const url = esc(m.url || '');
  return `<div class="browser">
      <div class="browser-chrome">
        <div class="browser-row">
          <span class="browser-dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="browser-tab"><span class="fav" aria-hidden="true"></span>${url}</span>
        </div>
        <div class="browser-url" aria-hidden="true">
          <span class="pill"><span class="lock"></span>${url}</span>
        </div>
      </div>
      <div class="browser-body"${isVideo ? ' data-video' : ''}>${body}</div>
    </div>`;
}

/* ---------------------------------------------------------------- home page */
function renderHome() {
  const h = site.hero;

  /* .hero-band wraps the section rather than being a ::before on it, because the red has to
     run the full width of the viewport while the copy stays inside the 1240px column — and
     the usual 100vw trick for that overflows horizontally the moment there is a scrollbar.
     The secondary CTA takes glass-dark, not glass: two pale pills side by side on the red
     both read as primary. */
  const heroHTML = `
<div class="hero-band">
<section class="hero" id="hero">
  <div class="hero-copy">
    <p class="eyebrow reveal-words" data-seq="0">${esc(h.eyebrow)}</p>
    <h1><span class="lively">${esc(h.headline)}</span></h1>
    <p class="hero-line"><span class="vh">${esc(h.lines.join(' '))}</span></p>
    <p class="hero-cta-row">
      <a class="btn glass solid float" href="${esc(h.ctaPrimary.href)}" target="_blank" rel="noopener">${esc(h.ctaPrimary.label)}</a>
      <a class="btn glass-dark float" href="${esc(h.ctaSecondary.href)}" target="_blank" rel="noopener">${esc(h.ctaSecondary.label)}</a>
    </p>
  </div>
  <!-- ?v= for the same reason the handwriting mask carries it: the file is regenerated in
       place by tools/make-hero-flower.js, so without a version a returning visitor — or the
       person iterating on the crop — keeps being served the previous one out of cache. -->
  <figure class="hero-bloom">
    <img src="assets/hero/hero-flower.jpg?v=${BUILD_V}" alt="" width="490" height="590" loading="eager" decoding="async" fetchpriority="high">
  </figure>
</section>
<div class="hero-light" aria-hidden="true"></div>
</div>`;

  /* logo wall: masked to a single ink so nine marks in nine different house styles
     read as one row (see .brand). role=img + aria-label keeps the names available. */
  const brandsHTML = `
<section class="brands" id="brands">
  <div class="brands-head fade">
    <h2 class="eyebrow" style="margin:0">${typo(site.brands.title)}</h2>
    <p>${typo(site.brands.sub)}</p>
  </div>
  <div class="brands-row fade">
    ${site.brands.logos.map(l => `<span class="brand" role="img" aria-label="${esc(l.alt)}" style="--logo:url('${esc(l.src)}')"></span>`).join('\n    ')}
  </div>
</section>`;

  const projectMedia = p => {
    const m = p.media;
    if (m.type === 'phone-video') {
      return phoneFrame(`<img class="poster" src="${esc(m.poster)}" alt="${esc(m.alt)}" loading="lazy" decoding="async">
          ${videoTag(m)}`, { attrs: ` data-video${m.autoplay ? ' data-autoplay' : ''}`, island: m.island !== false,
            extra: '<button class="play-btn glass" type="button" aria-label="Play project preview">▶</button>' });
    }
    if (m.type === 'phone-gif' || m.type === 'phone-image') {
      return phoneFrame(`<img src="${esc(m.src)}" alt="${esc(m.alt)}"${screenFit(m.src)} loading="lazy" decoding="async">`,
        { island: m.island !== false });
    }
    if (m.type === 'browser') return browserFrame(m, { lazy: true });
    return `<div class="project-media" data-video>
      <img class="poster" src="${esc(m.poster)}" alt="${esc(m.alt)}" loading="lazy" decoding="async">
      ${videoTag(m)}
      <button class="play-btn glass" type="button" aria-label="Play project preview">▶</button>
    </div>`;
  };

  const workHTML = `
<section id="work">
  ${site.work.eyebrow ? `<p class="eyebrow fade">${esc(site.work.eyebrow)}</p>` : ''}
  <h2 class="section-title fade">${typo(site.work.title)}</h2>
  ${site.work.projects.map(p => `
  <a class="wproject fade" href="${esc(p.slug)}.html" data-curious>
    <div class="w-copy">
      <h3 class="w-outcome">${typo(p.outcome)}</h3>
      <p class="w-chiprow"><span class="w-chip glass">${esc(p.name)}</span><span class="w-tags">${esc(p.tags)}</span></p>
    </div>
    <div class="project-media-wrap">${projectMedia(p)}</div>
  </a>`).join('\n')}
</section>`;

  const panels = site.disciplines.panels;
  const panelsHTML = `
<section id="disciplines" class="below-fold">
  <p class="eyebrow fade">${esc(site.disciplines.eyebrow)}</p>
  <h2 class="section-title fade">${typo(site.disciplines.title)}</h2>
  <div class="panels" id="panels" role="tablist" aria-label="Design work across disciplines">
    ${panels.map((p, i) => `
    <div class="panel${i === 0 ? ' active' : ''}${p.video ? ' has-video' : ''}" role="tab" aria-selected="${i === 0}" tabindex="0">
      <img src="${esc(p.img)}" alt="${esc(p.alt)}" loading="lazy" decoding="async">
      ${p.video ? `<video muted loop playsinline preload="none" data-src="${esc(p.video)}"></video>` : ''}
      <span class="panel-collapsed-label">${esc(p.shortLabel)}</span>
      <div class="panel-content">
        <p class="p-org">${esc(p.org)}</p>
        <h3 class="p-title">${typo(p.title)}</h3>
        <p class="p-desc">${typo(p.desc)}</p>
      </div>
    </div>`).join('\n')}
  </div>
</section>`;

  /* The GIF's own background is --bg-base, so it sits on the page with no visible edge —
     the notebook page bleeding into the site rather than a framed picture.

     Four sources, first match wins: narrow screens get the stacked cut (side by side, her
     handwriting lands at ~120px on a phone and stops being readable), and anyone who has
     asked their OS for less motion gets the matching still instead of the loop. The alt
     text carries the whole story, because in this section the words ARE the artwork. */
  const st = site.story;
  const storyHTML = !st ? '' : `
<section id="story" class="below-fold">
  <p class="eyebrow fade">${esc(st.eyebrow)}</p>
  <h2 class="section-title fade">${typo(st.title)}</h2>
  <figure class="story fade">
    <picture>
      <source media="(prefers-reduced-motion:reduce) and (max-width:${esc(st.tallBelow)})" srcset="${esc(st.posterTall)}">
      <source media="(prefers-reduced-motion:reduce)" srcset="${esc(st.poster)}">
      <source media="(max-width:${esc(st.tallBelow)})" srcset="${esc(st.gifTall)}">
      <img src="${esc(st.gif)}" alt="${esc(st.alt)}" width="${esc(String(st.width))}" height="${esc(String(st.height))}" loading="lazy" decoding="async">
    </picture>
  </figure>
</section>`;

  const aboutHTML = `
<section id="about" class="below-fold">
  <div class="about-band fade">
    <img class="headshot" src="${esc(site.about.headshot)}" alt="Portrait of ${esc(site.fullName)}" width="180" height="180" loading="lazy" decoding="async">
    <div>
      <p class="eyebrow">${esc(site.about.eyebrow)}</p>
      <h2 class="about-title">${typo(site.about.title)}</h2>
      <p class="about-body">${typo(site.about.body)}</p>
      <a class="btn glass" href="assets/resume.pdf" target="_blank" rel="noopener">${esc(site.about.resumeLabel)} <span aria-hidden="true">↗</span></a>
    </div>
  </div>
</section>`;

  return head(site.title, site.description) + `
${navBar('home')}
<main>
${heroHTML}
${brandsHTML}
${workHTML}
${panelsHTML}
${storyHTML}
${aboutHTML}
</main>
` + footerHTML();
}

/* ---------------------------------------------------------------- case study pages */
function csMedia(m) {
  if (!m) return '';
  const caption = m.caption ? `<p class="cs-caption">${typo(m.caption)}</p>` : '';
  let inner = '';
  if (m.frame === 'browser') {
    inner = browserFrame(m);
  } else if (m.type === 'video') {
    inner = `<div class="cs-media-frame" data-video>
      <img class="poster" src="${esc(m.poster)}" alt="${esc(m.alt)}" loading="lazy" decoding="async" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
      ${videoTag(m)}
      <button class="play-btn glass" type="button" aria-label="Play video">▶</button>
    </div>`;
    /* the frame needs intrinsic size: use aspect ratio wrapper */
    inner = `<div class="cs-media-frame" data-video style="aspect-ratio:16/9;background:var(--bg-deep-shade)">
      <img class="poster" src="${esc(m.poster)}" alt="${esc(m.alt)}" loading="lazy" decoding="async" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
      <video muted loop playsinline preload="none" data-src="${esc(m.src)}" poster="${esc(m.poster)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" aria-label="${esc(m.alt || '')}"></video>
      <button class="play-btn glass" type="button" aria-label="Play video">▶</button>
    </div>`;
  } else if (m.type === 'image') {
    inner = `<div class="cs-media-frame"><img src="${esc(m.src)}" alt="${esc(m.alt)}" loading="lazy" decoding="async"></div>`;
  } else if (m.type === 'phones') {
    /* frame:"phone" wraps raw screens in the CSS frame. Screens that already have a
       device drawn into the PNG are dropped in as plain images — never double-frame. */
    inner = `<div class="cs-phones">${m.items.map(it => m.frame === 'phone'
      ? phoneFrame(`<img src="${esc(it.src)}" alt="${esc(it.alt)}"${screenFit(it.src)} loading="lazy" decoding="async">`, { island: m.island !== false })
      : `<img src="${esc(it.src)}" alt="${esc(it.alt)}" loading="lazy" decoding="async">`).join('')}</div>`;
  }
  return `<div class="cs-media-band fade"><div class="cs-media-inner ${esc(m.wash || 'wash')}">${inner}${caption}</div></div>`;
}

function csHeroMedia(cs) {
  const m = cs.heroMedia;
  if (!m) return '';
  if (m.frame === 'browser') return `<div class="cs-hero-media" style="box-shadow:none;border-radius:0;overflow:visible">${browserFrame(m, { eager: true })}</div>`;
  if (m.type === 'image') return `<div class="cs-hero-media"><img src="${esc(m.src)}" alt="${esc(m.alt)}" loading="eager" decoding="async" fetchpriority="high"></div>`;
  if (m.type === 'video') return `<div class="cs-hero-media" data-video style="position:relative;aspect-ratio:16/9;background:var(--bg-deep-shade)">
    <img class="poster" src="${esc(m.poster)}" alt="${esc(m.alt)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
    <video muted loop playsinline preload="none" data-src="${esc(m.src)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" aria-label="${esc(m.alt || '')}"></video>
    <button class="play-btn glass" type="button" aria-label="Play video">▶</button></div>`;
  if (m.type === 'phones') return `<div class="cs-hero-phones">${m.items.map(it => m.frame === 'phone'
    ? phoneFrame(`<img src="${esc(it.src)}" alt="${esc(it.alt)}"${screenFit(it.src)} loading="eager" decoding="async">`, { island: m.island !== false })
    : `<img src="${esc(it.src)}" alt="${esc(it.alt)}" loading="eager" decoding="async">`).join('')}</div>`;
  if (m.type === 'phone-video') return `<div class="cs-hero-phone-video">${phoneFrame(
    `<img class="poster" src="${esc(m.poster)}" alt="${esc(m.alt)}" loading="eager" decoding="async">${videoTag(m)}`,
    { attrs: ' data-video', island: m.island !== false,
      extra: '<button class="play-btn glass" type="button" aria-label="Play video">▶</button>' })}</div>`;
  return '';
}

function renderCase(cs) {
  const tone = cs.heroTone === 'light' ? 'light' : '';
  const tagGlass = tone ? 'glass' : 'glass-dark';
  const metaHTML = `<dl class="cs-meta fade">${cs.meta.map(m => `<div><dt>${esc(m.label)}</dt><dd>${m.href ? `<a href="${esc(m.href)}" target="_blank" rel="noopener">${esc(m.value)} ↗</a>` : esc(m.value)}</dd></div>`).join('')}</dl>`;

  const statsHTML = cs.stats ? `<div class="cs-stats fade"><div class="cs-stats-band">
    ${cs.stats.map(s => `<div class="stat-card glass"><div class="stat-value">${esc(s.value)}</div><div class="stat-label">${typo(s.label)}</div></div>`).join('')}
  </div></div>` : '';

  const sectionHTML = s => {
    const quote = s.quote ? `<blockquote class="cs-quote"><p>“${typo(s.quote.text)}”</p><cite>${esc(s.quote.attr)}</cite></blockquote>` : '';
    const compare = s.compare ? `
<div class="cs-compare fade">
  <div class="cmp-col before"><p class="cmp-head">Before</p>
    ${s.compare.before.map(i => `<div class="cmp-item"><h4>${esc(i.title)}</h4><p>${typo(i.body)}</p></div>`).join('')}
  </div>
  <div class="cmp-col after"><p class="cmp-head">After — tested winners</p>
    ${s.compare.after.map(i => `<div class="cmp-item"><h4>${esc(i.title)}</h4><p>${typo(i.body)}</p>${i.note ? `<p class="cmp-note">${esc(i.note)}</p>` : ''}</div>`).join('')}
  </div>
</div>` : '';
    return `
<div class="cs-row fade">
  <p class="cs-label">${esc(s.label)}</p>
  <div>
    <h2 class="cs-heading">${typo(s.heading)}</h2>
    <div class="cs-body">${s.body.map(p => `<p>${typo(p)}</p>`).join('')}</div>
    ${quote}
  </div>
</div>${compare}${csMedia(s.media)}`;
  };

  const next = cases.find(c => c.slug === cs.next);
  const nextHTML = next ? `<div class="cs-next fade"><a class="cs-next-card" href="${esc(next.slug)}.html">
    <div><p class="k">Next project</p><p class="t">${esc(next.title)}</p></div>
    <span class="arrow" aria-hidden="true">↗</span></a></div>` : '';

  const refl = cs.reflection ? `
<div class="cs-row fade">
  <p class="cs-label">${esc(cs.reflection.label || 'Reflection')}</p>
  <div>
    <h2 class="cs-heading">${typo(cs.reflection.heading)}</h2>
    <div class="cs-body">${cs.reflection.body.map(p => `<p>${typo(p)}</p>`).join('')}</div>
  </div>
</div>` : '';

  return head(`${cs.name} — ${site.title}`, cs.tagline) + `
${navBar('case')}
<main>
<header class="cs-hero">
  <div class="cs-hero-band ${tone}">
    <p class="cs-kicker">${esc(cs.name)}</p>
    <h1 class="cs-title">${typo(cs.title)}</h1>
    <p class="cs-tagline">${typo(cs.tagline)}</p>
    <div class="cs-tags">${cs.tags.map(t => `<span class="cs-tag ${tagGlass}">${esc(t)}</span>`).join('')}</div>
    ${csHeroMedia(cs)}
  </div>
</header>
<div class="cs-intro fade">${cs.intro.map(p => `<p>${typo(p)}</p>`).join('')}</div>
${metaHTML}
${statsHTML}
<div class="below-fold">
${cs.sections.map(sectionHTML).join('\n')}
${refl}
</div>
${nextHTML}
</main>
` + footerHTML();
}

/* ---------------------------------------------------------------- asset copy + emit */
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const s = path.join(src, entry.name), d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else {
      const st = fs.statSync(s);
      let stale = true;
      try { stale = fs.statSync(d).mtimeMs < st.mtimeMs; } catch { }
      if (stale) fs.copyFileSync(s, d);
    }
  }
}

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, 'styles.css'), makeCSS());
fs.writeFileSync(path.join(DIST, 'app.js'), makeJS());
fs.writeFileSync(path.join(DIST, 'index.html'), renderHome());
for (const cs of cases) fs.writeFileSync(path.join(DIST, `${cs.slug}.html`), renderCase(cs));
copyDir(path.join(ROOT, 'assets'), path.join(DIST, 'assets'));

/* The custom domain has to be written INTO dist/, not just set in Settings > Pages.
   GitHub's settings page writes a CNAME file to the repo root, which works when Pages
   serves a branch — but this site is deployed as an Actions artifact built from dist/, and
   the artifact is the whole published site. A CNAME sitting in the repo root is not in it,
   so the domain silently reverts to <user>.github.io on the next deploy. Writing it here
   means the domain survives every build. Blank it out to go back to a github.io URL. */
const DOMAIN = 'm--k.me';
if (DOMAIN) fs.writeFileSync(path.join(DIST, 'CNAME'), DOMAIN + '\n');

/* Pages runs Jekyll over an artifact unless told not to, and Jekyll drops any file or
   folder whose name starts with an underscore. Nothing here starts with one today, but a
   silently missing asset is a miserable thing to debug later. */
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');
fs.writeFileSync(path.join(DIST, '.buildstamp'), String(Date.now()));
console.log(`Built ${1 + cases.length} pages → dist/ (${cases.map(c => c.slug).join(', ')})`);
if (fitWarnings.length) {
  console.log('Phone screens (aspect check against 9:19.5 = 0.4615):');
  console.log([...new Set(fitWarnings)].join('\n'));
}
