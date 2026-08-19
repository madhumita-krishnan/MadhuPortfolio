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
/* The hero sentence used to be read from assets/hero/hero-lines.json — one PNG per line of
   her handwriting, cut by tools/slice-hero-lines.js. It is now set as text in her own
   typeface (tools/make-hand-font.js), so nothing here reads the slices any more. The slicer
   and its output are left in place: they are the record of how the sheet was cut, and the
   raw lift beside them is still the source the font was measured from. */
const csDir = path.join(ROOT, 'data/case-studies');
const cases = fs.readdirSync(csDir).filter(f => f.endsWith('.json'))
  .map(f => readJSON(path.join(csDir, f)))
  .sort((a, b) => (a.order || 99) - (b.order || 99));

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const BUILD_V = Date.now().toString(36); // cache-buster: every rebuild gets fresh CSS/JS

/* The same stamp on every piece of MEDIA, for the same reason it is on the CSS. Half the
   images and clips on this site are regenerated in place by a tool — the flowers are cut out
   of her reference photo, the pot and her handwriting are lifted off a phone snap, the
   driftwood poster is grabbed out of its own video — so the bytes at a path change while the
   path does not, and a browser that already has the old ones is entitled to keep showing
   them. That is not a theoretical problem here: she has judged new art while being served
   the previous version out of cache, twice. Anything a tool can rewrite gets ?v=. */
const asset = p => (p ? `${p}${p.includes('?') ? '&' : '?'}v=${BUILD_V}` : '');

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
/* Hand-lifted artwork that build.js expects but cannot generate itself. Collected rather
   than thrown: a missing drawing should not stop the site building, but it must be said
   out loud, because the alternative is a section silently rendering without it. */
const missingArt = [];
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
  --font-hand:${f.hand};
  --r-card:${r.card};--r-media:${r.media};--r-pill:${r.pill};
  --motion-fast:${m.fast};--motion-base:${m.base};--motion-slow:${m.slow};
  --ease-standard:${m['ease-standard']};--ease-enter:${m['ease-enter']};
  --space:${theme.space};
}
/* Her hand, as a typeface — cut from the sheets in story-src by tools/make-hand-font.js.
   Self-hosted and tiny (14kb), so it is fetched from the same origin as the page and there is
   no third party in the critical path for the one line of copy the hero exists to deliver.
   swap, not block: the fallback is a rounded system face at a similar x-height, and a
   sentence that arrives late in the wrong face beats a sentence that is invisible for 3s. */
@font-face{font-family:'Madhu Hand';font-style:normal;font-weight:400;font-display:swap;
  src:url(assets/fonts/madhu-hand.woff?v=${BUILD_V}) format('woff')}
/* madhu-hand.ttf ships beside it but is deliberately NOT listed here. WOFF is the same
   outlines compressed and every browser since IE9 reads it, so a second src only gets both
   files fetched. The .ttf is there to be downloaded and installed — it is her typeface, and
   she should be able to use it in Figma. */
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

/* Brushed colour across the cream field + paper grain.
   This was three big radial-gradients standing in for warm light. She asked for "no
   gradients — think more paint strokes texture", so it is now her own brush swatch: the
   texture is an alpha-only mask (tools/make-paint-wash.js strips the swatch's own shading
   and mirror-quilts it so it tiles), and the COLOUR comes from a palette token painted
   through it. Retune the wash by editing --accent-wash, not the PNG. */
.atmosphere{position:fixed;inset:0;pointer-events:none;z-index:0;
  background:var(--accent-wash);opacity:.55;
  -webkit-mask:url(assets/hero/paint-wash.png?v=${BUILD_V}) repeat center/504px 2032px;
  mask:url(assets/hero/paint-wash.png?v=${BUILD_V}) repeat center/504px 2032px}
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
/* .glass-dark and .float were both dropped with the button rework and are not referenced by
   any markup or script. .glass-dark existed only for the case-study tags, which are now
   chips from the button system; .float was the slow bob on the hero CTAs, which the control
   sheet rules out — a flat control that drifts contradicts "solid fills only". The glass
   material itself is untouched and still carries the nav and the panels. */

/* ------------------------------------------------ buttons
   From Madhu's control sheet. The governing note on it is "solid fills only — the label
   always sits on flat colour, so it stays readable. The watercolour lives in the artwork,
   not in the controls." So everything a control could borrow from the hero — glass, paint
   texture, the drawn ink outline, drop shadows — is deliberately absent. A button is a
   flat fill or a flat outline, and nothing else. The art and the UI stay separate.

   Three ranks, in order of how loud they are:
     .solid    terracotta fill, cream label     — one per view, the thing to actually do
     .outline  terracotta line, terracotta label — the alternative
     .teal     baby-teal line, teal label        — quiet; case studies, tags, icons

   Labels are uppercase and widely letterspaced, so the glyph count is small and the
   letterforms carry the weight — which is why the size steps below move padding and
   tracking together rather than just font-size. */
.btn{font-family:var(--font-utility);font-weight:500;font-size:.75rem;letter-spacing:.14em;
  text-transform:uppercase;text-decoration:none;white-space:nowrap;
  padding:0 26px;border-radius:var(--r-pill);min-height:48px;
  display:inline-flex;align-items:center;justify-content:center;gap:10px;
  border:1.5px solid transparent;background:none;color:var(--text-primary);
  cursor:pointer;position:relative;
  transition:background-color var(--motion-fast) var(--ease-standard),
             border-color var(--motion-fast) var(--ease-standard),
             color var(--motion-fast) var(--ease-standard)}

/* PRIMARY. The hover and pressed steps are the accent walked down in value, not the accent
   plus a shadow — on a flat control the only honest way to show depression is that the
   colour gets heavier. --accent-deep is already the bottom of that walk, so pressed lands
   there and hover sits between the two. */
.btn.solid{background:var(--accent);color:var(--text-on-deep)}
.btn.solid:hover{background:var(--accent-press)}
.btn.solid:active{background:var(--accent-deep)}

/* SECONDARY. Fills with --accent-press rather than --accent on hover: a cream label on the
   plain accent measures 4.47:1, which is a hair under the 4.5 small text wants, and the
   hover state is supposed to be the darker one anyway. */
.btn.outline{border-color:var(--accent);color:var(--accent)}
.btn.outline:hover{background:var(--accent-press);border-color:var(--accent-press);color:var(--text-on-deep)}
.btn.outline:active{background:var(--accent-deep);border-color:var(--accent-deep);color:var(--text-on-deep)}

/* TERTIARY — the baby teal. The LINE is --teal-baby and the LABEL is --ink-blue, which is
   what the sheet shows and is also the only version that passes contrast: baby teal is a
   tint, and a tint that reads correctly as a 1.5px line on cream is far too pale to set
   small letterspaced type in. On hover the line fills and the label flips to cream.
   The hover fill is --ink-blue and not --teal-baby for the same reason: a cream label on
   baby teal is only 3.6:1, whereas on the full ink-blue it is 5.4:1. */
.btn.teal{border-color:var(--teal-baby);color:var(--ink-blue)}
.btn.teal:hover{background:var(--ink-blue);border-color:var(--ink-blue);color:var(--text-on-deep)}
.btn.teal:active{background:var(--bg-deep);border-color:var(--bg-deep);color:var(--text-on-deep)}

/* SIZES */
.btn.sm{min-height:38px;padding:0 20px;font-size:.68rem;letter-spacing:.12em}
.btn.lg{min-height:62px;padding:0 40px;font-size:.9rem;letter-spacing:.16em}

/* ICON — a circle, so it is sized rather than padded. aspect-ratio keeps it round whatever
   the min-height above resolves to. */
.btn.icon{padding:0;width:56px;min-width:56px;height:56px;min-height:56px;aspect-ratio:1;
  border-radius:50%;font-size:1rem;letter-spacing:0}
.btn.icon.sm{width:42px;min-width:42px;height:42px;min-height:42px;font-size:.85rem}

/* CHIP — a label, not a control: no hover state and no pointer, because nothing happens
   when you click it. Two jobs, so the dot is opt-in rather than built in:
     .chip        taxonomy — the three tags under a case study title
     .chip.live   status   — "OPEN TO WORK", where the dot is the point
   A dot on every case-study tag would read as three bullet points in a row. */
.chip{font-family:var(--font-utility);font-weight:500;font-size:.72rem;letter-spacing:.13em;
  text-transform:uppercase;display:inline-flex;align-items:center;gap:10px;
  padding:0 20px;min-height:40px;border-radius:var(--r-pill);
  border:1.5px solid var(--teal-baby);color:var(--ink-blue)}
.chip.live::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--teal-baby);flex:none}
.chip.accent{border-color:var(--accent-baby);color:var(--accent)}
.chip.accent.live::before{background:var(--accent)}

/* LINK — the quietest rank. The rule is drawn with a border rather than text-decoration so
   it sits clear of the letterforms and can animate its colour independently. */
.btn-link{font-family:var(--font-utility);font-weight:500;font-size:.78rem;letter-spacing:.14em;
  text-transform:uppercase;text-decoration:none;color:var(--accent);cursor:pointer;
  display:inline-flex;align-items:center;gap:12px;padding-bottom:7px;
  border-bottom:1.5px solid var(--accent);background:none;
  transition:color var(--motion-fast) var(--ease-standard),
             border-color var(--motion-fast) var(--ease-standard),
             gap var(--motion-fast) var(--ease-standard)}
.btn-link:hover{color:var(--accent-deep);border-color:var(--accent-deep);gap:18px}
.btn-link.teal{color:var(--ink-blue);border-color:var(--teal-baby)}
.btn-link.teal:hover{color:var(--ink-blue);border-color:var(--ink-blue)}

/* DISABLED. Colour only — a disabled control must still be legible enough to read what it
   would have done, so this is the accent desaturated toward the paper rather than made
   transparent (which would let the blooms show through a control). */
.btn[disabled],.btn[aria-disabled="true"]{background:var(--accent-mute);border-color:transparent;
  color:var(--bg-raised);cursor:not-allowed;pointer-events:none}

/* FOCUS. One ring for every control on the site, teal so it never disappears against a
   terracotta fill, and offset so it reads as a ring around the button rather than as part
   of its outline. */
.btn:focus-visible,.btn-link:focus-visible{outline:2px solid var(--ink-blue);outline-offset:3px}

/* On the dark case-study bands the terracotta line is too close in value to the ground, so
   both quiet ranks switch to the cream inks that are already used for type down there. */
.on-deep .btn.outline,.btn.outline.on-deep{border-color:var(--text-on-deep-secondary);color:var(--text-on-deep)}
.on-deep .btn.outline:hover,.btn.outline.on-deep:hover{background:var(--text-on-deep);color:var(--bg-deep)}
.on-deep .chip,.chip.on-deep{border-color:var(--line-on-deep);color:var(--text-on-deep-secondary)}
.on-deep .chip::before,.chip.on-deep::before{background:var(--text-on-deep-secondary)}

/* ------------------------------------------------ nav */
.nav-wrap{position:fixed;top:14px;left:0;right:0;z-index:50;display:flex;justify-content:center;padding:0 16px}
nav.bar{display:flex;align-items:center;gap:6px;padding:6px 6px 6px 20px;border-radius:var(--r-pill);max-width:820px;width:100%;justify-content:space-between}
/* The SVG displacement warp lives on the nav and on the company chips, and nowhere else.
   Every element carrying backdrop-filter:url() costs a full backdrop snapshot + turbulence +
   displacement pass, and there were twelve of them once (nav, every button, every chip, the
   play button), which is why this is a list and not a property of .glass. The nav has always
   been on it. The four company chips joined it 2026-08-12, at her ask — they carried .glass
   already, but .glass without the warp is a frosted pill, and a frosted pill on flat cream
   has nothing to frost. What was missing was the one thing that reads as glass rather than as
   translucency: the edges of what is behind it moving as it passes.
   Five warped elements, all static filters. Do not promote this to .glass. */
nav.bar.glass,.w-chip.glass{backdrop-filter:url(#glassWarp) blur(${g.blur}) saturate(${g.saturate})}
.wordmark{font-family:var(--font-display);font-size:1.35rem;letter-spacing:.02em;text-decoration:none;color:var(--text-primary);margin-right:8px;white-space:nowrap}
.nav-links{display:flex;gap:2px;align-items:center}
.nav-links a{font-family:var(--font-utility);font-size:.74rem;letter-spacing:.05em;text-decoration:none;color:var(--text-secondary);
  padding:10px 13px;border-radius:var(--r-pill);transition:color var(--motion-fast) var(--ease-standard),background var(--motion-fast) var(--ease-standard)}
.nav-links a:hover,.nav-links a:focus-visible{color:var(--accent-deep);background:var(--accent-wash)}
@media (max-width:700px){.nav-links a.optional{display:none}}

/* ------------------------------------------------ shared sections */
main{position:relative;z-index:1}
section{padding:calc(var(--space)*14) calc(var(--space)*6);max-width:1240px;margin:0 auto;position:relative}
.eyebrow{font-family:var(--font-utility);font-size:.78rem;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:calc(var(--space)*3)}
.section-title{font-family:var(--font-display);font-weight:400;font-size:clamp(1.8rem,3.4vw,2.7rem);line-height:1.2;max-width:26ch;margin-bottom:calc(var(--space)*7);color:var(--ink-blue)}
.fade{opacity:0;transform:translateY(24px);transition:opacity var(--motion-slow) var(--ease-enter),transform var(--motion-slow) var(--ease-enter)}
.fade.visible{opacity:1;transform:none}
.below-fold{}

/* ------------------------------------------------ hero */
/* Full viewport height so the flora's clip edge lands exactly on the fold. At any shorter
   height the bottom bloom gets sliced by a visible horizontal line partway up the screen,
   which reads as the edge of a box rather than as art running off the page. */
.hero{padding-top:calc(var(--space)*24);padding-bottom:calc(var(--space)*10);min-height:100vh;
  display:flex;flex-direction:column;justify-content:center;isolation:isolate}
/* The copy sits in a clear column between the two blooms — no longer over them.
   The overlap used to be defended as "on thin petal tips only", but at 1440 it put the rust
   eyebrow flat on a rust petal, which is the one pairing on this site with no contrast at
   all, and ran petals through the last handwritten line. So the rule is now simply: type
   never touches paint. The blooms hold the outer margins (see --flora-keep below) and the
   copy owns everything between them.

   The indent is DERIVED from the keep-out rather than being its own hand-tuned clamp. It
   used to be clamp(0px,13vw,190px), which happened to clear the blooms at 1440 and closed
   to a 6px gap around 1200, because the two numbers grew at different rates and nothing
   tied them together. Now the copy simply starts one gutter past wherever the left bloom is
   allowed to reach, and the arithmetic converts that viewport position into a margin on the
   section box — a section is capped at 1240px and centred, so its own left edge moves with
   the viewport too and has to be subtracted back out. max(0px,…) is the narrow case, where
   the section already starts outside the keep-out and no indent is wanted at all.

   --copy-max closes the same trap on the other side. Indenting the copy past the left bloom
   without also capping its width just pushes its right edge into the RIGHT bloom instead:
   at a fixed 640px the two would have collided at about 950px of viewport, which is exactly
   the class of width-dependent overlap this rule exists to abolish. So the cap is whatever
   is left of the viewport once both keep-outs, both gutters and the indent are taken out —
   the copy is never allowed to be wider than its own channel. */
.hero{--section-left:calc(max(0px,(100vw - 1240px)/2) + var(--space)*6);
  --flora-gutter:46px;
  --copy-indent:max(0px,calc(var(--flora-keep) + var(--flora-gutter) - var(--section-left)));
  --copy-max:calc(100vw - var(--flora-keep) - var(--flora-gutter) - var(--section-left) - var(--copy-indent))}
/* 640px was the width of the old copy block, chosen when it was sitting ON the blooms and
   had to stay narrow to keep off them. In a clear channel that same 640 leaves a dead strip
   between the last handwritten line and the right bloom, and unused space at this scale
   reads as a mistake rather than as air. The block now takes most of its channel and lets
   her own line lengths — which shorten 96% → 70% down the paragraph — open the space
   diagonally, away from the bloom rising into the bottom right corner. */
.hero>:not(.hero-flora){position:relative;margin-left:var(--copy-indent);
  max-width:min(100%,760px,var(--copy-max))}
.hero .eyebrow{margin-bottom:calc(var(--space)*4)}
/* display type is the reference blue, the way the wordmark is on her Orange & Mellow
   sheet — body copy stays the warm near-black so long paragraphs still read easily */
.hero h1{font-family:var(--font-display);font-weight:300;font-size:clamp(3.2rem,8vw,7rem);
  line-height:1;letter-spacing:-.005em;color:var(--ink-blue)}
/* Madhu's own handwriting — and now actually SET, not photographed.

   It used to be four PNG masks cut out of a sheet she wrote (tools/slice-hero-lines.js), one
   per written line, dropped back at the exact fractions her hand put them at. That was the
   only way to show her writing when her writing was a picture, and it had the cost you would
   expect: the copy could not change without her writing it out again, the line breaks were
   baked into the image so they could not respond to the viewport, and none of it was text.

   tools/make-hand-font.js turns the same sheets into a real typeface, so this is now a
   paragraph. It re-flows, it selects, it is read aloud correctly, it is indexed, and the copy
   lives in data/site.json where the rest of the words live.

   SET SMALLER AND WIDER than the old block, which she asked for and the type agrees with: at
   620px the old sentence ran only five or six words to the line. At 860px and this size it
   runs ten or eleven, which is a paragraph measure rather than a pull quote — and it stays
   under 75 characters, so the eye still finds the next line.

   THE SIZE WENT UP 15% when the ascenders were fixed, and it had to. Her x-height used to be
   60% of the em because the font was built with ascenders barely above it; giving b d h k l
   their real rise puts the x-height at 53%, which is an ordinary number for a typeface but
   means the same font-size renders visibly smaller. Same optical size, taller letters.

   line-height has to be generous and is: her descenders reach 64% of the em below the baseline
   and her f goes further still, so at anything tighter the tail of a g lands in the line
   underneath. 1.75 clears everything except the f, which is allowed to reach — it does on her
   page too. */
.hero-line{font-family:var(--font-hand);color:var(--ink-blue);
  width:min(100%,860px);margin-top:calc(var(--space)*5);
  font-size:clamp(1.18rem,1.78vw,1.52rem);line-height:1.75;
  letter-spacing:.005em;text-wrap:pretty}
/* Each sentence is its own line of thought, so it starts on its own line — but as a block
   the three still read as one paragraph, so the space between them is smaller than the space
   between the paragraph and anything else. */
.hero-line span.hs{display:block}
.hero-line span.hs + span.hs{margin-top:.5em}
.vh{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;
  clip-path:inset(50%);white-space:nowrap;border:0}
.hero-cta-row{margin-top:calc(var(--space)*7);display:flex;gap:14px;flex-wrap:wrap}

/* florals. The composition is her reference's: one bloom hanging from the top and running
   off the LEFT edge, one rising from the bottom and running off the RIGHT, with the copy in
   the open diagonal channel between them.

   The container is 100vw, not the section box. A section is capped at 1240px, so a bloom
   pinned inside it stops ~100px short of the screen on a wide display and reads as a framed
   picture. The whole effect is the hard crop AT THE SCREEN EDGE, so the flora spans the
   viewport and clips there. (body already sets overflow-x:hidden, so 100vw is safe.) */
.hero-flora{position:absolute;top:0;bottom:0;left:50%;width:100vw;transform:translateX(-50%);
  z-index:-1;pointer-events:none;overflow:hidden}
/* height:auto is load-bearing — the width/height attributes on the tags reserve the right
   box before the PNGs land, but without it the CSS width fights the height attribute and
   each bloom stretches into a 1680px-tall smear. */
.hero-flora img{position:absolute;display:block;height:auto}
/* KEEP-OUT. The blooms used to be placed by nudging left/right offsets until it looked
   about right, and the result was that at 1440 they covered most of the frame and the copy
   was set on top of them. This is the same composition — one bloom hanging from the top
   left, one rising from the bottom right — but stated as a rule instead of a nudge:

     a bloom may reach --flora-keep in from its own edge of the viewport, and no further.

   Everything else follows from that. Each bloom's inner edge is pinned at --flora-keep, so
   its width can change with the viewport (or be clamped at the ends) without ever
   re-entering the copy: widening a bloom pushes it further off-screen rather than inward.
   That is what makes "type never touches paint" a property of the layout and not a
   coincidence that has to be re-checked at every width. The copy column starts outside it
   — see the margin-left on .hero's children — and the gap between the two is the channel.

   Roughly half of each bloom hangs off its edge, which is what keeps them reading as art
   running off the page rather than as two pictures placed in two corners. */
/* The WIDTHS are capped at what the artwork can actually pay for. bloom-left.png is 785px
   wide, so on a 2x screen it can fill 393 CSS px before the browser starts inventing
   detail — and inventing detail is precisely the softness she is objecting to. 27vw lands
   on 389px at 1440. There is no more resolution to be had: the source sheet is 486px wide
   and these are already upscaled 3x from it, so the display size is the last lever.
   Note this does not change how much bloom is on screen — that is --flora-keep, and it is
   independent. A narrower flower at the same keep-out simply hangs less far off the edge,
   so slightly more of the whole bloom is visible. */
:root{--flora-keep:16.5vw;--flora-a-w:clamp(280px,27vw,393px);--flora-b-w:clamp(280px,28vw,396px)}
.flora-a{top:-11%;width:var(--flora-a-w);left:calc(var(--flora-keep) - var(--flora-a-w))}
.flora-b{bottom:-12%;width:var(--flora-b-w);right:calc(var(--flora-keep) - var(--flora-b-w))}
/* They ran at 82% because the copy was on top of them and two inks of near-identical
   luminance cannot share a pixel. Nothing overlaps now, so the paint is at full strength —
   which is also most of what she meant by "sharper": a bloom faded into the cream loses its
   darkest edge first, and the dark rust line around each petal IS the definition. */
.hero-flora img{opacity:1}
/* Below ~1180 the copy column and the two keep-outs stop fitting side by side on one line,
   so the blooms give up width rather than the type giving up its channel. */
@media (max-width:1180px){:root{--flora-keep:13vw;--flora-a-w:clamp(260px,26vw,360px);--flora-b-w:clamp(260px,27vw,380px)}}
/* on a phone the copy runs full width, so the blooms come almost all the way off the
   edge — a sliver of colour at each margin rather than a picture behind the text */
@media (max-width:760px){.hero-flora img{opacity:.5}
  /* Same keep-out rule, just a much smaller one — and it is the one place on the site where
     type does end up over paint, because a phone has no room for both a full-width column
     and a channel either side of it. Hence the 50%: at a sliver's width and half strength
     the blooms read as colour at the margin rather than as a picture behind the words. */
  :root{--flora-keep:7vw;--flora-a-w:230px;--flora-b-w:240px}
  .flora-a{top:-6%}.flora-b{bottom:-4%}
  /* the indent that keeps the copy clear of the blooms on a desktop is pure lost margin on a
     phone, where the blooms are slivers at the edges and the copy needs the full width */
  .hero>:not(.hero-flora){margin-left:0;max-width:none}}
/* the stick figure's canvas — the hero's HEIGHT but the VIEWPORT's width, the same trick
   as .hero-flora above. A section is capped at 1240px, so a canvas pinned to the hero box
   ended his world (100vw − 1240)/2 short of the screen on a wide display: told to run
   right, he stopped at an invisible wall in the middle of the page. His cage is now the
   same box the blooms clip at — the actual screen edge. (body sets overflow-x:hidden, so
   100vw is safe here too.) pointer-events:none means every real control under it keeps
   working; stick.js listens on the document and gates input to this band. The say-hey
   button stays a real anchor — the figure only holds a drawn post under it, so the
   control sheet is untouched.
   Written as .hero>.stick-cv, not bare .stick-cv: the ".hero>:not(.hero-flora)" copy-column
   rule is specificity 0,2,0 and would otherwise win, putting the canvas back IN FLOW —
   which grows the hero, which resizes the canvas, which grows the hero, forever. Same
   specificity + later in the sheet, plus explicit resets of the column's margin and cap.
   width/height are not decor: a canvas is a replaced element, so positioning alone leaves
   it at its intrinsic bitmap size (device pixels — double size on Retina) instead of
   stretching it to its box. */
.hero>.stick-cv{position:absolute;top:0;left:50%;width:100vw;height:100%;transform:translateX(-50%);z-index:3;pointer-events:none;margin-left:0;max-width:none;
  opacity:0;transition:opacity 600ms var(--ease-standard)}
.hero.stick-on>.stick-cv{opacity:1}
.hero.stick-dragging{user-select:none;-webkit-user-select:none}
/* ---- the cinematic load. The hero used to arrive in two registers at once: the
   handwriting wrote itself in word by word while the blooms, the headline and the two
   buttons just APPEARED at first paint — which is the harshness she named (2026-08-19,
   "fade in cinematically"). Now it assembles in layers off the same .revealed trigger
   the word reveal already uses, each layer fading up a few px as it lands:

     paint (1.6s fade from 150ms) → headline (rises, 450ms→1.4s) → the handwriting
     (word stagger now starts at a 900ms base, so the pen starts writing while the
     headline is still settling) → buttons (1.35s→2.15s) → the figure last (stick.js
     boots at 2.4s and fades his canvas in — he reads his world from the LIVE rects,
     so booting while the headline is mid-rise would bake his terrain 16px low; he
     also rebuilds on hero transitionend, which catches the words settling).

   Opacity and transform only, both composited — nothing here re-runs layout or
   touches the glass filters (the feTurbulence lesson). The flora fades as a
   CONTAINER so the per-image opacity rules (1 desktop, .5 phone) stay untouched. */
.hero-flora{opacity:0;transition:opacity 1600ms var(--ease-standard) 150ms}
.hero.revealed .hero-flora{opacity:1}
.hero h1{opacity:0;transform:translateY(16px);transition:opacity 950ms var(--ease-enter) 450ms,transform 950ms var(--ease-enter) 450ms}
.hero.revealed h1{opacity:1;transform:none}
.hero-cta-row{opacity:0;transform:translateY(14px);transition:opacity 800ms var(--ease-enter) 1350ms,transform 800ms var(--ease-enter) 1350ms}
.hero.revealed .hero-cta-row{opacity:1;transform:none}
.w{display:inline-block;white-space:pre;opacity:0;transform:translateY(.45em);transition:opacity var(--motion-slow) var(--ease-enter),transform var(--motion-slow) var(--ease-enter)}
.revealed .w{opacity:1;transform:none}
.lively .ch{display:inline-block;white-space:pre;transition:transform var(--motion-base) var(--ease-standard),color var(--motion-base) var(--ease-standard)}
.lively:hover .ch{color:var(--accent)}
.lively.waving .ch{transform:translateY(-7px)}
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
.brand{height:38px;width:100%;background:var(--brand-blue);
  -webkit-mask:var(--logo) center/contain no-repeat;mask:var(--logo) center/contain no-repeat;
  transition:background var(--motion-base) var(--ease-standard)}
.brand:hover{background:var(--ink-blue)}

/* THE WALL INTRODUCES ITSELF. Nine marks that are simply present when you arrive at them
   read as wallpaper; the same nine arriving one after another read as a list of people who
   hired her, which is what they are.

   Each logo sits in a slot with a hard bottom edge and starts BELOW it, so what you see is
   not a logo fading in — it is a logo coming up from behind a line that is not drawn. The
   slot is exactly the height of the mark, so overflow:hidden IS the line: there is nothing to
   draw and nothing to keep in register.

   The cascade is 65ms a step, left to right, set from --i on the slot. That is slow enough to
   read as one-after-another and quick enough that the ninth is up within six tenths of a
   second — a longer step turns a credential list into a performance. The rise is a fraction
   over its own height so the mark clears the edge before it starts easing, and the fade
   finishes early, so it is the movement you notice rather than the opacity. */
.brand-slot{overflow:hidden;display:block;line-height:0}
/* display:block, and it is load-bearing rather than tidy: .brand used to be a grid item,
   which blockifies it, and putting it inside a slot made it an inline span again — where
   height:38px does not apply, the box collapses to nothing, and translateY(118%) of nothing
   is 0. The logos simply faded, with no movement at all. */
.brand-slot .brand{display:block;transform:translateY(118%);opacity:0;
  transition:background var(--motion-base) var(--ease-standard),
             transform 620ms var(--ease-enter) calc(var(--i) * 65ms),
             opacity 380ms var(--ease-standard) calc(var(--i) * 65ms)}
.brands-row.visible .brand{transform:none;opacity:1}
/* The row itself carries the observer but not the movement — the logos do that, and a row
   that also slid up would set every mark going before its own delay had run. */
.brands-row.fade{opacity:1;transform:none;transition:none}
.settled .brand,.rm-mode .brand{transform:none;opacity:1}
@media (prefers-reduced-motion:reduce){.brand{transform:none !important;opacity:1 !important;transition:background var(--motion-base) var(--ease-standard) !important}}
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
/* The nav reads as glass because content scrolls under it; these chips sit in the flat
   cream gutter, where the shared .glass fill (white up to .50) has nothing to frost and
   just paints a small pill solid white. So the chips keep the material but drop the milk:
   a much clearer interior lets the cream and paint wash genuinely show through, and the
   edge does the talking — the same crescents, a slightly stronger prism rim, and a real
   lift shadow so it floats the way the nav does. Label contrast survives because the ink
   is #26332F on cream either way. */
.w-chip.glass{
  background:linear-gradient(150deg, rgba(255,255,255,.22) 0%, rgba(255,252,244,.12) 52%, rgba(255,255,255,.07) 100%);
  border-color:rgba(255,255,255,.72);
  box-shadow:
    inset 0 1.5px 1.5px -1px rgba(255,255,255,.98),
    inset 0 -2px 2px -1px rgba(255,255,255,.70),
    inset 1.5px 0 2px -1px rgba(255,255,255,.48),
    inset -1.5px 0 2px -1px rgba(255,255,255,.48),
    inset 0 0 10px rgba(255,255,255,.10),
    0 6px 16px var(--shadow-soft),
    0 1px 3px rgba(30,54,52,.10)}
.w-chip.glass::after{opacity:1}
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
.about-title{font-family:var(--font-display);font-weight:400;font-size:clamp(1.5rem,2.9vw,2.3rem);line-height:1.25;margin-bottom:calc(var(--space)*2);max-width:30ch;color:var(--ink-blue)}
/* The about copy is a short essay, not a blurb, so it is set as paragraphs. The gap between
   them is one line of its own leading — enough to separate two thoughts, not so much that
   the three read as three separate blocks — and only the last one carries the full space
   down to the resume button. */
.about-body{color:var(--text-secondary);line-height:1.6;max-width:62ch;margin-bottom:1.6em}
.about-body:last-of-type{margin-bottom:calc(var(--space)*3)}
@media (max-width:700px){.about-band{grid-template-columns:1fr}.about-band .headshot{width:130px;height:130px}}

/* ---- the pot ---------------------------------------------------------------------------
   Madhu's ink drawing, standing on the rule that runs across the top of the footer, so it
   reads as an object resting on a surface rather than as an image placed near one.

   bottom:100% is what does that. An absolutely positioned child is laid out against its
   containing block's PADDING box, and the footer's 1px rule is drawn just outside that — so
   bottom:100% puts the base of the pot exactly on the underside of the line, and the line
   passes behind its foot. Tying it to the footer rather than to the section above also means
   it stays on the line if the about copy ever changes length.

   A MASK rather than an <img>: the drawing is ink on paper photographed on a phone, and the
   page is cream, so a plain image would land a grey rectangle above the footer.
   tools/lift-pot.js rebuilds the alpha from the photo's local contrast and the colour comes
   from the palette here — same treatment as her handwriting in the hero and the client logos.

   transform-origin is the bottom centre because that is exactly where the pot meets the
   line it is standing on; rotating about anything else reads as it pivoting in mid-air
   rather than tipping on its base. The rocking is integrated in JS — see makeJS. */
/* The shelf is the footer rule, and align-items:flex-end is what puts the pot's foot on it
   and keeps it there whatever the drawing's height does. --pot-base is the single size knob.
   It went up by half (116 -> 172px at the top of the ramp) when the dog was taken off the
   line: the old number was chosen so the pot would not be dwarfed by an animal 3.5x its
   height standing next to it, and with nothing beside it that size reads as a leftover
   rather than as an object. */
.footer-shelf{position:absolute;bottom:100%;right:clamp(8px,5vw,76px);
  --pot-base:clamp(112px,12vw,172px);
  display:flex;align-items:flex-end;pointer-events:none}
.footer-shelf>*{pointer-events:auto}

.pot{width:var(--pot-base);aspect-ratio:var(--pot-w)/var(--pot-h);
  background:var(--ink-blue);
  -webkit-mask:var(--pot) center bottom/contain no-repeat;
  mask:var(--pot) center bottom/contain no-repeat;
  transform-origin:50% 100%;will-change:transform;cursor:pointer}

/* THE DOG THAT USED TO STAND HERE IS GONE (her ask, 2026-08-12) — with it went .dog,
   .dog-l, .dog-head, the four stacked masks and the three-spring bark in makeJS. The pot is
   now the only thing on the shelf, which is why it has grown: at the old size it was scaled
   to sit beside an animal three and a half times its height, and alone on the line that
   reads as an ornament that got left behind. tools/lift-dog.js and assets/about/dog*.png
   are still on disk; nothing references them. */

@media (max-width:640px){.footer-shelf{right:clamp(6px,4vw,32px);--pot-base:clamp(92px,17vw,124px)}}
.resume-band{text-align:center}
.big-link{font-family:var(--font-display);font-size:clamp(2rem,5vw,3.6rem);color:var(--text-primary);text-decoration:none;transition:color var(--motion-fast) var(--ease-standard)}
.big-link:hover,.big-link:focus-visible{color:var(--accent)}
footer{border-top:1px solid var(--line);padding:calc(var(--space)*5) calc(var(--space)*6);display:flex;justify-content:space-between;align-items:center;gap:16px;max-width:1240px;margin:0 auto;position:relative;z-index:1}
footer a{color:var(--text-primary);text-decoration:none;font-size:.92rem;transition:color var(--motion-fast) var(--ease-standard)}
footer a:hover{color:var(--accent)}
.foot-links{display:flex;align-items:center;gap:calc(var(--space)*3);flex-wrap:wrap;justify-content:center}
.foot-mark{font-family:var(--font-display);font-size:1.3rem}
.foot-note{font-family:var(--font-utility);font-size:.7rem;letter-spacing:.08em;color:var(--text-secondary)}
@media (max-width:640px){footer{flex-direction:column;gap:10px;text-align:center}
  section{padding-left:calc(var(--space)*3);padding-right:calc(var(--space)*3);padding-top:calc(var(--space)*10);padding-bottom:calc(var(--space)*10)}}

/* ------------------------------------------------ painted panels
   Every decorative panel gradient on the case-study pages is gone: she asked for paint
   texture rather than gradients. Each surface is now a flat palette token with her own
   brush swatch laid over it, so a big block of colour still has grain and brush direction
   without being shaded from one corner to another.
   The ::before sits at z-index:-1 inside the panel's own isolated stacking context, which
   paints it above the panel's background but below its content — so text stays crisp.
   ONE gradient survives on purpose: the scrim on .panel::after. That one is not decoration,
   it is what keeps cream type legible over an arbitrary photograph. */
.cs-hero-band,.cs-next-card,.cs-media-inner.deep,
.cs-stats-band,.cs-media-inner.wash,.cmp-col.after{position:relative;isolation:isolate}
.cs-hero-band::before,.cs-next-card::before,.cs-media-inner.deep::before,
.cs-stats-band::before,.cs-media-inner.wash::before,.cmp-col.after::before{
  content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:inherit;
  background:var(--paint-ink);opacity:.5;
  -webkit-mask:url(assets/hero/paint-wash.png?v=${BUILD_V}) repeat center/504px 2032px;
  mask:url(assets/hero/paint-wash.png?v=${BUILD_V}) repeat center/504px 2032px}
/* the brush ink is one step off the panel's own fill, so the texture reads as brushwork in
   the same colour rather than as a stain in a different one */
.cs-hero-band,.cs-next-card,.cs-media-inner.deep{--paint-ink:var(--bg-deep-raised)}
.cs-hero-band.light,.cs-stats-band,.cs-media-inner.wash,.cmp-col.after{--paint-ink:var(--bg-raised)}

/* ================================================ case study pages */
.cs-hero{position:relative;z-index:1;padding:96px 16px 0}
.cs-hero-band{max-width:1240px;margin:0 auto;border-radius:24px;overflow:hidden;position:relative;
  background:var(--bg-deep);color:var(--text-on-deep);padding:clamp(28px,4.5vw,56px)}
.cs-hero-band.light{background:var(--accent-wash);color:var(--text-primary)}
.cs-kicker{font-family:var(--font-utility);font-size:.75rem;letter-spacing:.16em;text-transform:uppercase;color:var(--accent-bright);margin-bottom:14px}
.cs-hero-band.light .cs-kicker{color:var(--accent-deep)}
.cs-title{font-family:var(--font-display);font-weight:400;font-size:clamp(2rem,4.6vw,3.6rem);line-height:1.12;max-width:22ch;text-wrap:balance;margin-bottom:12px}
/* A HEADLINE THAT STATES THE BUSINESS PROBLEM IS LONGER THAN ONE THAT ASKS A QUESTION.
   "What if your playlist knew how to DJ?" fits a 22ch measure at 3.6rem in two lines; the
   Atlantic headline is a full sentence with the number in it and would run to six. Rather
   than cut her copy, a long one steps down a size and out to a wider measure — the same
   move a magazine makes, and it still reads as the loudest thing on the band. The cut is at
   72 characters because that is where 22ch × 3.6rem stops fitting three lines. */
.cs-title.long{font-size:clamp(1.65rem,3.1vw,2.5rem);line-height:1.2;max-width:32ch}
.cs-tagline{font-size:clamp(1rem,1.6vw,1.2rem);line-height:1.5;max-width:58ch;text-wrap:balance;color:var(--text-on-deep-secondary)}
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
/* The tags under a case study title are the button sheet's chip — same shape, same rank, so
   they now carry .chip and this rule only lays them out. They used to be glass pills, which
   put a frosted panel treatment on a piece of taxonomy and made them read as controls. */
.cs-tags{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}

.cs-stats{max-width:1240px;margin:calc(var(--space)*6) auto 0;padding:0 calc(var(--space)*2)}
.cs-stats-band{border-radius:24px;background:var(--accent-wash);padding:clamp(20px,3.5vw,40px);display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}
.stat-card{border-radius:var(--r-card);padding:22px 22px 20px}
.stat-value{font-family:var(--font-display);font-size:clamp(1.9rem,3.4vw,2.8rem);color:var(--accent-deep);line-height:1.05;margin-bottom:8px}
.stat-label{font-size:.88rem;line-height:1.45;color:var(--text-secondary)}

.cs-row{max-width:1100px;margin:0 auto;padding:calc(var(--space)*10) calc(var(--space)*6) 0;display:grid;grid-template-columns:220px 1fr;gap:calc(var(--space)*6)}
.cs-label{font-family:var(--font-utility);font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);position:sticky;top:96px;align-self:start;padding-top:6px}
/* the case-study equivalent of .section-title, so it takes the same reference blue.
   .cs-title is deliberately NOT blue — it sits on the deep teal band, where the blue goes
   muddy; on that band the light cream is the display colour. */
/* a section heading breaks as AT MOST two lines: an inline per-heading
   max-width (see twoLine() in the case-study template — titles, taglines and
   captions get the same treatment) forces the wrap on long strings, and balance
   splits the pair evenly instead of leaving a one-word second line. A heading
   short enough to fit this 34ch measure on one line gets no inline clamp and
   stays a single line — never stretch a short heading across two. */
.cs-heading{font-family:var(--font-display);font-weight:400;font-size:clamp(1.5rem,2.8vw,2.2rem);line-height:1.2;margin-bottom:calc(var(--space)*3);max-width:34ch;text-wrap:balance;color:var(--ink-blue)}
.cs-body p{color:var(--text-secondary);line-height:1.65;font-size:1.02rem;margin-bottom:calc(var(--space)*2.5);max-width:62ch}
.cs-quote{border-left:3px solid var(--accent);padding:6px 0 6px 22px;margin:calc(var(--space)*3) 0}
.cs-quote p{font-family:var(--font-display);font-size:clamp(1.2rem,2vw,1.6rem);line-height:1.35;color:var(--text-primary);margin-bottom:8px}
.cs-quote cite{font-family:var(--font-utility);font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--text-secondary);font-style:normal}
@media (max-width:820px){.cs-row{grid-template-columns:1fr;gap:calc(var(--space)*2)}.cs-label{position:static}}

.cs-media-band{max-width:1240px;margin:calc(var(--space)*7) auto 0;padding:0 calc(var(--space)*2)}
.cs-media-inner{border-radius:24px;padding:clamp(20px,4vw,56px);display:flex;flex-direction:column;align-items:center;gap:18px}
.cs-media-inner.wash{background:var(--accent-wash)}
.cs-media-inner.deep{background:var(--bg-deep)}
.cs-media-frame{border-radius:var(--r-media);overflow:hidden;width:100%;box-shadow:0 24px 60px var(--shadow-mid);position:relative}
.cs-media-frame img,.cs-media-frame video{width:100%;height:auto}
.cs-phones{display:flex;justify-content:center;gap:clamp(14px,3vw,40px);width:100%;align-items:flex-start}
.cs-phones>img{width:min(42%,300px);height:auto;filter:drop-shadow(0 22px 40px var(--shadow-mid))}
.cs-phones .phone-media{width:min(42%,218px);max-width:218px}
.cs-phone-col{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(42%,218px)}
.cs-phone-col .phone-media{width:100%;max-width:218px}
.cs-phone-label{font-family:var(--font-utility);font-size:.78rem;letter-spacing:.14em;text-transform:uppercase;color:var(--text-caption)}
.cs-media-inner.deep .cs-phone-label{color:var(--text-on-deep-secondary)}
/* 1rem = 12pt — the floor for caption legibility. --text-caption exists because
   --text-secondary is only 3.9:1 on the accent-wash band these captions sit on;
   the darker step clears WCAG AA (4.5:1) on both wash and raised fills. */
.cs-caption{font-family:var(--font-utility);font-size:1rem;letter-spacing:.03em;line-height:1.6;color:var(--text-caption);max-width:58ch;text-wrap:balance;text-align:center}
.cs-media-inner.deep .cs-caption{color:var(--text-on-deep-secondary)}

/* before / after compare */
.cs-compare{max-width:1100px;margin:calc(var(--space)*6) auto 0;padding:0 calc(var(--space)*6);display:grid;grid-template-columns:1fr 1fr;gap:16px}
.cmp-col{border-radius:var(--r-card);padding:clamp(18px,2.6vw,30px)}
.cmp-col.before{background:var(--bg-raised);border:1px solid var(--line)}
.cmp-col.after{background:var(--accent-wash);border:1px solid var(--line-accent)}
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
  background:var(--bg-deep);color:var(--text-on-deep)}
.cs-next-card .k{font-family:var(--font-utility);font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--accent-bright);margin-bottom:10px}
.cs-next-card .t{font-family:var(--font-display);font-size:clamp(1.5rem,3.2vw,2.6rem);line-height:1.15}
.cs-next-card .arrow{font-size:clamp(1.6rem,3vw,2.4rem);transition:transform var(--motion-base) var(--ease-standard)}
.cs-next-card:hover .arrow{transform:translate(6px,-6px)}

/* A play button is .play-btn + .btn.icon.solid — the shape, size and colour all come from
   the button system, and this rule only says where it sits and when it appears. It carries
   .solid rather than the sheet's teal outline because it is the one control that does not
   sit on the page cream: it floats over a screenshot or a video frame, and a transparent
   pill with a 1.5px line disappears against arbitrary artwork. A filled terracotta disc is
   the same system saying the same thing on an unknown background. */
.play-btn{position:absolute;bottom:16px;right:16px;z-index:6;display:none}
/* min-width/height too, or .btn's own min-height wins and the disc turns into a stadium */
.phone-media .play-btn.icon{bottom:9cqw;right:50%;transform:translateX(50%);
  width:36px;min-width:36px;height:36px;min-height:36px;font-size:.8rem}
.rm-mode .play-btn{display:inline-flex}
/* the button system brings its own teal focus ring (see .btn:focus-visible); this is the
   catch-all for every other link and control on the site */
a:focus-visible,button:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:4px}

/* settle fail-safe: nothing ever stays invisible, even if transitions never run */
.settled .w{opacity:1;transform:none}
.settled .fade{opacity:1;transform:none}
/* flora and canvas keep their translateX(-50%) centering — force OPACITY only there;
   transform:none on either shoves it half a viewport right (found the hard way) */
.settled .hero h1,.settled .hero-cta-row{opacity:1;transform:none}
.settled .hero-flora{opacity:1}

/* reduced motion */
.rm-mode .w,.rm-mode .fade{opacity:1;transform:none;transition:none}
.rm-mode .hero h1,.rm-mode .hero-cta-row{opacity:1;transform:none;transition:none}
.rm-mode .hero-flora,.rm-mode .stick-cv{opacity:1;transition:none}
@media (prefers-reduced-motion:reduce){
  .w,.fade{opacity:1 !important;transform:none !important;transition:none !important}
  .hero h1,.hero-cta-row{opacity:1 !important;transform:none !important;transition:none !important}
  .hero-flora,.stick-cv{opacity:1 !important;transition:none !important}
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
      /* the hero paragraph arrives a sentence at a time: each .hs after the first sits out
         an extra beat, so a thought finishes before the next one starts writing */
      let hold=0;
      const walk=node=>{
        [...node.childNodes].forEach(child=>{
          if(child.nodeType===3){
            const frag=document.createDocumentFragment();
            /* token = run-of-ink + its trailing space (same cut as a lookbehind split
               after \\s — but written without lookbehind, which iOS Safari only parses
               from 16.4: one lookbehind literal is a SyntaxError that kills this WHOLE
               file at parse time on older phones — no reveal, no video, no pot */
            (child.textContent.match(/[^\\s]*\\s|[^\\s]+$/g)||[]).forEach(tok=>{
              if(!tok)return;
              const w=document.createElement('span');w.className='w';
              /* 900ms base: the pen starts writing while the headline (450ms→1.4s) settles */
              w.style.transitionDelay=(900+seq++*55+hold)+'ms';w.textContent=tok;frag.appendChild(w);
            });
            node.replaceChild(frag,child);
          }else if(child.nodeType===1){
            if(child.classList.contains('hs')&&child.previousElementSibling)hold+=1000;
            walk(child);
          }
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

  /* ---- the damped spring the pot rocks on -----------------------------------------------
     The pot moves by being knocked and then settling, which is an equation and not an easing
     curve:

       theta'' = -w0^2 * f(theta) - 2*zeta*w0*theta'

     The first term is the restoring force, the second is the loss. zeta below 1 is
     underdamped, which is the case where it oscillates at all, and the pot wants a low one so
     that it rocks several times before it comes back to centre.

     f() is the shape of the restoring force, and the pot passes sin, because gravity's pull
     on a leaning body really does fall off as the sine of the tilt — which is most of why a
     big lean takes visibly longer to come back than a small one. (The solver takes f as an
     argument because the dog's neck, which used to stand beside it, was linear. The dog is
     gone; the argument is kept because a spring solver that hard-codes its own force law is
     the wrong shape of function.)

     Integrated at a FIXED substep with semi-implicit Euler. Fixed, because stepping by the
     frame delta makes the damping frame-rate dependent — the same nudge would settle faster
     on a 120Hz display than on a 60Hz one. Semi-implicit (velocity first, then position from
     the NEW velocity) because plain Euler slowly gains energy and these would never stop. */
  const DT=1/240;
  function spring(w0,zeta,shape){
    const f=shape||(t=>t);
    return {
      x:0, v:0,
      kick(dv){this.v+=dv},
      advance(dt){
        let acc=dt;
        while(acc>=DT){
          this.v+=(-w0*w0*f(this.x)-2*zeta*w0*this.v)*DT;
          this.x+=this.v*DT;
          acc-=DT;
        }
        return acc;
      },
      /* "still" has to be judged on BOTH position and velocity — a spring passing through
         zero at full speed is momentarily at x=0 and is not remotely at rest */
      resting(px,pv){return Math.abs(this.x)<px&&Math.abs(this.v)<pv},
      w0:w0
    };
  }
  /* One rAF loop per animated object, started on demand and cancelled the moment it settles —
     this site has been bitten before by an idle animation costing frames. */
  function driver(tick){
    let raf=0,last=0,carry=0;
    const frame=now=>{
      raf=0;
      /* clamp the delta: returning to a backgrounded tab hands you several seconds at once,
         and integrating that in one go would fling things off the shelf */
      const dt=Math.min((now-last)/1000,0.05)+carry; last=now;
      carry=tick(dt,now);
      if(carry===false)return;
      raf=requestAnimationFrame(frame);
    };
    return ()=>{if(!raf){last=performance.now();carry=0;raf=requestAnimationFrame(frame)}};
  }

  /* ---- the pot rocks -------------------------------------------------------------------
     Nudge it and it tips, swings back past centre, and each swing overshoots less than the
     last until it is standing still again. w0 = 11 rad/s is about 1.75 swings a second, which
     reads as something heavy and ceramic; zeta = 0.11 leaves roughly six visible swings, each
     about 30% smaller than the one before. */
  const pot=document.querySelector('.pot');
  if(pot){
    const KICK=3.05;   // rad/s per nudge → about a 16 degree first lean
    const MAX=0.44;    // ~25 degrees, the most it will ever lean however hard you nudge it
    const s=spring(11.0,0.11,Math.sin);
    const start=driver(dt=>{
      const carry=s.advance(dt);
      if(s.resting(0.0015,0.012)){s.x=0;s.v=0;pot.style.transform='';return false}
      pot.style.transform='rotate('+(s.x*180/Math.PI).toFixed(3)+'deg)';
      return carry;
    });
    const nudge=e=>{
      if(rmActive())return;
      /* push it away from the side you came in on, so it reacts to you rather than always
         falling the same way */
      const r=pot.getBoundingClientRect();
      const dir=(e&&typeof e.clientX==='number'&&e.clientX>r.left+r.width/2)?-1:1;
      s.kick(dir*KICK);
      // a second nudge adds energy, as it would in life — but never past the tipping point
      const peak=Math.abs(s.x)+Math.abs(s.v)/s.w0;
      if(peak>MAX)s.v*=MAX/peak;
      start();
    };
    pot.addEventListener('mouseenter',nudge);
    /* touch has no hover, and focus keeps it reachable from the keyboard; the first
       touch point stands in for the mouse so a tap still tips it away from the finger */
    pot.addEventListener('touchstart',e=>nudge(e.touches&&e.touches[0]),{passive:true});
    pot.addEventListener('focus',()=>nudge());
    pot.tabIndex=0;
  }

  /* absolute fail-safe: everything visible even if transitions never tick */
  setTimeout(()=>document.body.classList.add('settled'),1900);

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
<!-- .w is the word wrapper reveal-words puts around every word, and it starts at opacity 0
     waiting for the .revealed class, which only JS ever adds. Without this the hero sentence
     is invisible to a no-JS visitor. It is real text now, so a reader with no JS still gets
     the copy — but it would look like the hero simply has none. -->
<noscript><style>.w{opacity:1;transform:none}.fade{opacity:1;transform:none}.hero h1,.hero-cta-row{opacity:1;transform:none}.hero-flora{opacity:1}.dc{display:none}</style></noscript>
<!-- her handwriting carries the one sentence the hero exists for, and it is same-origin and
     14kb, so it is worth the early connection rather than waiting on the stylesheet -->
<link rel="preload" href="assets/fonts/madhu-hand.woff?v=${BUILD_V}" as="font" type="font/woff" crossorigin>
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
  <a class="btn solid sm" href="${esc(site.calendly)}" target="_blank" rel="noopener">say hey!</a>
</nav></div>`;
}

function footerHTML(extra = '') {
  /* Outbound profiles (LinkedIn) sit with the email as one group of ways to reach her,
     rather than being scattered — so the footer reads mark / contact / place. They carry
     rel=noopener like every other external link on the site. */
  const links = (site.footer.links || []).map(l =>
    `<a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('\n    ');
  return `<footer>${extra}
  <span class="foot-mark">${esc(site.wordmark)}</span>
  <span class="foot-links">
    <a href="mailto:${esc(site.email)}">${esc(site.email)}</a>
    ${links}
  </span>
  <span class="foot-note">${esc(site.footer.note)}</span>
</footer>
<script src="app.js?v=${BUILD_V}" defer></script>
</body>
</html>`;
}

function videoTag(m, { eager = false } = {}) {
  return `<video muted loop playsinline preload="none" data-src="${esc(asset(m.src))}" poster="${esc(asset(m.poster))}" aria-label="${esc(m.alt || '')}"></video>`;
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
    ? `<img class="poster" src="${esc(asset(m.poster))}" alt="${esc(m.alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">
       <video muted loop playsinline preload="none" data-src="${esc(asset(m.src))}" poster="${esc(asset(m.poster))}" aria-label="${esc(m.alt || '')}"></video>
       <button class="play-btn btn icon solid" type="button" aria-label="Play preview">▶</button>`
    : `<img class="poster" src="${esc(asset(m.src))}" alt="${esc(m.alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`;
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

  /* Her sentences, set in her own hand — one span each so they break where the thought
     breaks rather than wherever the measure happens to run out. reveal-words then writes
     them on a word at a time, which is the one thing the old picture could never do and the
     one thing handwriting most obviously should: it arrives the way it was written. */
  const heroLinesHTML = h.lines.map(l => `<span class="hs">${typo(l)}</span>`).join('');

  const heroHTML = `
<section class="hero" id="hero">
  <div class="hero-flora" aria-hidden="true">
    <!-- These are not drawings of her reference — they ARE her reference, cut out of
         "color pallete I like.png" pixel-for-pixel by tools/lift-flowers.js. Every attempt
         to redraw them got rejected; the brush striations and the blunt drooping petals
         only look right because they are the actual paint.
         ?v= for the same reason the handwriting mask carries it: the art is regenerated in
         place, so without a version a returning visitor keeps being served the old bloom. -->
    <img class="flora-a" src="assets/hero/bloom-left.png?v=${BUILD_V}" alt="" width="785" height="1680" loading="eager" decoding="async" fetchpriority="high">
    <img class="flora-b" src="assets/hero/bloom-right.png?v=${BUILD_V}" alt="" width="791" height="1175" loading="eager" decoding="async" fetchpriority="high">
  </div>
  <p class="eyebrow reveal-words" data-seq="0">${esc(h.eyebrow)}</p>
  <h1><span class="lively">${esc(h.headline)}</span></h1>
  <p class="hero-line reveal-words" data-seq="3">${heroLinesHTML}</p>
  <p class="hero-cta-row">
    <a class="btn solid" href="${esc(h.ctaPrimary.href)}" target="_blank" rel="noopener">${esc(h.ctaPrimary.label)}</a>
    <a class="btn outline" href="${esc(h.ctaSecondary.href)}" target="_blank" rel="noopener">${esc(h.ctaSecondary.label)}</a>
  </p>
</section>
<!-- the hero's stick figure (see stickman.js at the repo root). Home page only, hero only.
     defer keeps it after app.js, which must split the headline into .ch spans first —
     the figure climbs those. -->
<script src="stick.js?v=${BUILD_V}" defer></script>`;

  /* logo wall: masked to a single ink so nine marks in nine different house styles
     read as one row (see .brand). role=img + aria-label keeps the names available. */
  const brandsHTML = `
<section class="brands" id="brands">
  <div class="brands-head fade">
    <h2 class="eyebrow" style="margin:0">${typo(site.brands.title)}</h2>
    <p>${typo(site.brands.sub)}</p>
  </div>
  <div class="brands-row fade">
    ${site.brands.logos.map((l, i) => `<span class="brand-slot" style="--i:${i}"><span class="brand" role="img" aria-label="${esc(l.alt)}" style="--logo:url('${esc(l.src)}')"></span></span>`).join('\n    ')}
  </div>
</section>`;

  const projectMedia = p => {
    const m = p.media;
    if (m.type === 'phone-video') {
      return phoneFrame(`<img class="poster" src="${esc(asset(m.poster))}" alt="${esc(m.alt)}" loading="lazy" decoding="async">
          ${videoTag(m)}`, { attrs: ` data-video${m.autoplay ? ' data-autoplay' : ''}`, island: m.island !== false,
            extra: '<button class="play-btn btn icon solid" type="button" aria-label="Play project preview">▶</button>' });
    }
    if (m.type === 'phone-gif' || m.type === 'phone-image') {
      return phoneFrame(`<img src="${esc(asset(m.src))}" alt="${esc(m.alt)}"${screenFit(m.src)} loading="lazy" decoding="async">`,
        { island: m.island !== false });
    }
    if (m.type === 'browser') return browserFrame(m, { lazy: true });
    return `<div class="project-media" data-video>
      <img class="poster" src="${esc(asset(m.poster))}" alt="${esc(m.alt)}" loading="lazy" decoding="async">
      ${videoTag(m)}
      <button class="play-btn btn icon solid" type="button" aria-label="Play project preview">▶</button>
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

  /* Her ink drawing of the pot. It stands ON the rule that separates the about section from
     the footer, so it belongs to the footer and not to the about section — that line is the
     surface it is resting on, and anchoring it to anything else would leave it floating the
     moment the section above changed height. Home page only: the about section is only here,
     and a pot standing on the footer of a case study would be a non sequitur.

     It is a mask, not a picture (tools/lift-pot.js), so it takes a palette ink and composites
     onto the cream — see .pot. Rendered only when the asset exists: the drawing is lifted off
     a photo by hand, and a missing file should leave a clean footer rather than a broken image. */
  const potSrc = 'assets/about/pot.png';
  const potDims = imageSize(potSrc);
  const potHTML = !potDims ? '' : `<span class="pot" style="--pot:url(${potSrc}?v=${BUILD_V});--pot-w:${potDims.w};--pot-h:${potDims.h}"></span>`;
  if (!potDims) missingArt.push(`  ${potSrc} — run: node tools/lift-pot.js`);

  /* The shelf, anchored to the footer rule — see .footer-shelf. */
  const shelfHTML = !potDims ? '' : `
  <span class="footer-shelf" aria-hidden="false">${potHTML}</span>`;

  const aboutHTML = `
<section id="about" class="below-fold">
  <div class="about-band fade">
    <img class="headshot" src="${esc(site.about.headshot)}" alt="Portrait of ${esc(site.fullName)}" width="180" height="180" loading="lazy" decoding="async">
    <div>
      <p class="eyebrow">${esc(site.about.eyebrow)}</p>
      <h2 class="about-title">${typo(site.about.title)}</h2>
      ${[].concat(site.about.body).map(p => `<p class="about-body">${typo(p)}</p>`).join('\n      ')}
      <a class="btn outline" href="assets/resume.pdf" target="_blank" rel="noopener">${esc(site.about.resumeLabel)} <span aria-hidden="true">↗</span></a>
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
` + footerHTML(shelfHTML);
}

/* ---------------------------------------------------------------- case study pages */
/* A section can carry either one media object or an array of them. The array case exists for
   evidence: "The misconception" has to show two different pieces of the OLD site side by
   side, and each needs its own caption saying what was wrong with it — one shared caption
   under a collage would not attach the reason to the artefact. */
/* Case-study display text — headline, tagline, section headings, captions — breaks
   as AT MOST two lines. No single CSS measure can do that (the strings run 33–220
   chars), so each element gets an inline per-text max-width: k·length in ch, where
   k sits between the font's per-character width (forces the wrap) and half of it
   (fits in two). Measured: Cormorant renders 0.79–0.91ch per character → k 0.62;
   DM Sans 0.64–0.71 → k 0.48. text-wrap:balance splits the pair evenly.

   Short strings are left alone (her rule 2026-08-13: a heading that fits on one
   line must not be stretched across two awkward lines). "Fits" is decided with the
   font's UPPER per-char width (wide) against the class's own max-width measure, so
   a string only skips the clamp when one line is guaranteed, not merely hoped for
   — typo() still ties the last two words if a narrow viewport wraps it anyway.
   If a new string ever renders 3 lines, re-measure its k — don't eyeball one. */
const twoLine = (t, f, fitCh) =>
  t.length * f.wide <= fitCh ? '' : ` style="max-width:${(t.length * f.k).toFixed(1)}ch"`;
const CORMORANT = { k: 0.62, wide: 0.91 }, DMSANS = { k: 0.48, wide: 0.71 };

function csMedia(m) {
  if (Array.isArray(m)) return m.map(csMedia).join('\n');
  if (!m) return '';
  const caption = m.caption ? `<p class="cs-caption"${twoLine(m.caption, DMSANS, 58)}>${typo(m.caption)}</p>` : '';
  let inner = '';
  if (m.frame === 'browser') {
    inner = browserFrame(m);
  } else if (m.type === 'video') {
    inner = `<div class="cs-media-frame" data-video>
      <img class="poster" src="${esc(asset(m.poster))}" alt="${esc(m.alt)}" loading="lazy" decoding="async" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
      ${videoTag(m)}
      <button class="play-btn btn icon solid" type="button" aria-label="Play video">▶</button>
    </div>`;
    /* the frame needs intrinsic size: use aspect ratio wrapper */
    inner = `<div class="cs-media-frame" data-video style="aspect-ratio:16/9;background:var(--bg-deep-shade)">
      <img class="poster" src="${esc(asset(m.poster))}" alt="${esc(m.alt)}" loading="lazy" decoding="async" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
      <video muted loop playsinline preload="none" data-src="${esc(asset(m.src))}" poster="${esc(asset(m.poster))}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" aria-label="${esc(m.alt || '')}"></video>
      <button class="play-btn btn icon solid" type="button" aria-label="Play video">▶</button>
    </div>`;
  } else if (m.type === 'image') {
    inner = `<div class="cs-media-frame"><img src="${esc(asset(m.src))}" alt="${esc(m.alt)}" loading="lazy" decoding="async"></div>`;
  } else if (m.type === 'phones') {
    /* frame:"phone" wraps raw screens in the CSS frame. Screens that already have a
       device drawn into the PNG are dropped in as plain images — never double-frame. */
    inner = `<div class="cs-phones">${m.items.map(it => {
      const ph = m.frame === 'phone'
        ? phoneFrame(`<img src="${esc(it.src)}" alt="${esc(it.alt)}"${screenFit(it.src)} loading="lazy" decoding="async">`, { island: m.island !== false })
        : `<img src="${esc(it.src)}" alt="${esc(it.alt)}" loading="lazy" decoding="async">`;
      return it.label ? `<div class="cs-phone-col"><p class="cs-phone-label">${esc(it.label)}</p>${ph}</div>` : ph;
    }).join('')}</div>`;
  }
  return `<div class="cs-media-band fade"><div class="cs-media-inner ${esc(m.wash || 'wash')}">${inner}${caption}</div></div>`;
}

function csHeroMedia(cs) {
  const m = cs.heroMedia;
  if (!m) return '';
  if (m.frame === 'browser') return `<div class="cs-hero-media" style="box-shadow:none;border-radius:0;overflow:visible">${browserFrame(m, { eager: true })}</div>`;
  if (m.type === 'image') return `<div class="cs-hero-media"><img src="${esc(asset(m.src))}" alt="${esc(m.alt)}" loading="eager" decoding="async" fetchpriority="high"></div>`;
  if (m.type === 'video') return `<div class="cs-hero-media" data-video style="position:relative;aspect-ratio:16/9;background:var(--bg-deep-shade)">
    <img class="poster" src="${esc(asset(m.poster))}" alt="${esc(m.alt)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
    <video muted loop playsinline preload="none" data-src="${esc(asset(m.src))}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" aria-label="${esc(m.alt || '')}"></video>
    <button class="play-btn btn icon solid" type="button" aria-label="Play video">▶</button></div>`;
  if (m.type === 'phones') return `<div class="cs-hero-phones">${m.items.map(it => m.frame === 'phone'
    ? phoneFrame(`<img src="${esc(it.src)}" alt="${esc(it.alt)}"${screenFit(it.src)} loading="eager" decoding="async">`, { island: m.island !== false })
    : `<img src="${esc(it.src)}" alt="${esc(it.alt)}" loading="eager" decoding="async">`).join('')}</div>`;
  if (m.type === 'phone-video') return `<div class="cs-hero-phone-video">${phoneFrame(
    `<img class="poster" src="${esc(asset(m.poster))}" alt="${esc(m.alt)}" loading="eager" decoding="async">${videoTag(m)}`,
    { attrs: ' data-video', island: m.island !== false,
      extra: '<button class="play-btn btn icon solid" type="button" aria-label="Play video">▶</button>' })}</div>`;
  return '';
}

function renderCase(cs) {
  const tone = cs.heroTone === 'light' ? 'light' : '';
  /* the light hero band sits on cream, the default band is the deep green — so the chips
     take the on-deep inks there, the same switch the rest of that band already makes */
  const tagTone = tone ? '' : ' on-deep';
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
    <h2 class="cs-heading"${twoLine(s.heading, CORMORANT, 34)}>${typo(s.heading)}</h2>
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
    <h2 class="cs-heading"${twoLine(cs.reflection.heading, CORMORANT, 34)}>${typo(cs.reflection.heading)}</h2>
    <div class="cs-body">${cs.reflection.body.map(p => `<p>${typo(p)}</p>`).join('')}</div>
  </div>
</div>` : '';

  return head(`${cs.name} — ${site.title}`, cs.tagline) + `
${navBar('case')}
<main>
<header class="cs-hero">
  <div class="cs-hero-band ${tone}">
    <p class="cs-kicker">${esc(cs.name)}</p>
    <h1 class="cs-title${cs.title.length > 72 ? ' long' : ''}"${twoLine(cs.title, CORMORANT, cs.title.length > 72 ? 32 : 22)}>${typo(cs.title)}</h1>
    <p class="cs-tagline"${twoLine(cs.tagline, DMSANS, 58)}>${typo(cs.tagline)}</p>
    <div class="cs-tags">${cs.tags.map(t => `<span class="chip${tagTone}">${esc(t)}</span>`).join('')}</div>
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

/* The whole stylesheet is one long template literal with a lot of prose in it, so an unclosed
   or double-closed comment is easy to introduce and invisible afterwards: CSS does not fail
   loudly, it silently discards rules until the parser resynchronises. That is exactly what
   happened to the .btn.teal and .btn.icon rules — a stray second `*​/` left the tertiary and
   icon buttons rendering as bare text with no outline at all, and nothing reported it.
   Scanning for balance costs nothing and turns a silent visual regression into a build error. */
function checkComments(css) {
  let i = 0, depth = 0, line = 1;
  while (i < css.length) {
    if (css[i] === '\n') line++;
    if (css.startsWith('/*', i)) {
      if (depth) throw new Error(`styles.css: nested "/*" at line ${line} — CSS comments do not nest`);
      depth = 1; i += 2; continue;
    }
    if (css.startsWith('*/', i)) {
      if (!depth) throw new Error(`styles.css: stray "*/" at line ${line} — every rule after it is silently dropped`);
      depth = 0; i += 2; continue;
    }
    i++;
  }
  if (depth) throw new Error('styles.css: unclosed "/*" — the rest of the stylesheet is inside a comment');
  return css;
}

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, 'styles.css'), checkComments(makeCSS()));
fs.writeFileSync(path.join(DIST, 'app.js'), makeJS());
/* the stick figure ships as-is — it is hand-written client JS, not generated */
fs.copyFileSync(path.join(ROOT, 'stickman.js'), path.join(DIST, 'stick.js'));
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
if (missingArt.length) {
  console.log('Missing artwork — built without it:');
  missingArt.forEach(w => console.log(w));
}
if (fitWarnings.length) {
  console.log('Phone screens (aspect check against 9:19.5 = 0.4615):');
  console.log([...new Set(fitWarnings)].join('\n'));
}
