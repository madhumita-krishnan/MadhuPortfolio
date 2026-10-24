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
/* Play / pause are drawn shapes centred on their 24-unit box, never the ▶ / ❚❚ characters —
   a font glyph sits wherever its font puts it, so it is never truly centred in the disc
   (2026-10-12, her rule: no off-centre icons in buttons, ever). lintIcons below enforces it. */
const PLAY_IC = '<svg class="btn-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 6 L7 18 L17 12 Z"/></svg>';
const PAUSE_IC = '<svg class="btn-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 6 H10 V18 H7 Z M14 6 H17 V18 H14 Z"/></svg>';
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
/* "#F5EAD3" → "245,234,211", for tokens that need an rgba() alpha ramp of a theme hex */
const rgbTriplet = h => `${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)}`;
/* An eased fade for the edge strips: a linear-gradient whose alpha follows smoothstep
   from `peak` at the screen edge to 0 at `end`% of the strip, in 10 stops. A two-stop
   gradient interpolates STRAIGHT, and a straight ramp is exactly what read as un-iOS
   (2026-08-26 second pass: "doesn't feel as gradual") — the eye catches both of its
   corners. Smoothstep leaves with zero slope and lands with zero slope, so neither end
   of the fade is findable. `color` is a paint-maker taking the alpha: pass black for
   masks, the page-ground triplet for the tint. */
const easedFade = (dir, peak, end, color = a => `rgba(0,0,0,${a})`) => {
  const stops = [];
  for (let i = 0; i <= 10; i += 1) {
    const t = i / 10, a = peak * (1 - t * t * (3 - 2 * t));
    stops.push(`${color(+a.toFixed(3))} ${+(t * end).toFixed(1)}%`);
  }
  return `linear-gradient(to ${dir},${stops.join(',')})`;
};
/* the iPhone frame's CSS, shared with the walkthrough template (walkthrough.js) so
   every phone on the site is the same device */
const PHONE_CSS = `/* ---------- iPhone frame (see DEVICE_MOCKUP_SPEC.md) ----------
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
@media (max-width:760px){.phone-media{max-width:178px}}`;

/* the tweakers' saved values (data/tweaks.json, written by the dev server's /__tweak when she presses
   Save) become each visual's defaults. Missing file = the hand-set defaults. */
const TWEAKS = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tweaks.json'), 'utf8')); } catch (e) { return {}; } })();
function swipeTweaks() {
  const t = TWEAKS['swipe-deck']; if (!t) return '';
  const u = { aw: '--sd-aw', ah: '--sd-ah', side: '--sd-side', gap: '--sd-gap', peek: '--sd-peek', settle: '--sd-settle', radius: '--sd-radius', bg: '--sd-bg',
    dh: '--sd-dh', dw: '--sd-dw', lane: '--sd-lane', tgap: '--sd-tgap', tw: '--sd-tw', ease: '--sd-ease', speed: '--sd-speed' };
  const decl = Object.entries(t).filter(([k, v]) => u[k] && /^[#\w.%-]+$/.test(String(v))).map(([k, v]) => u[k] + ':' + v).join(';');
  return decl ? '.work-sec{' + decl + '}' : '';
}
function makeCSS() {
  const c = theme.colors, g = theme.glass, f = theme.fonts, r = theme.radii, m = theme.motion;
  return `
:root{
${Object.entries(c).map(([k, v]) => `  --${k}:${v};`).join('\n')}
  --edge-rgb:${rgbTriplet(c['bg-base'])};
  --font-display:${f.display};
  --font-body:${f.body};
  --font-utility:${f.utility};
  --font-hand:${f.hand};
  --r-card:${r.card};--r-media:${r.media};--r-pill:${r.pill};
  --motion-fast:${m.fast};--motion-base:${m.base};--motion-slow:${m.slow};
  --ease-standard:${m['ease-standard']};--ease-enter:${m['ease-enter']};
  --space:${theme.space};
  --glass-grad-a:rgba(255,255,255,.50);--glass-bg:${g['light-bg']};--glass-grad-b:rgba(255,255,255,.26);
  --glass-border:${g['light-border']};
  --glass-cres-top:rgba(255,255,255,.98);--glass-cres-bottom:rgba(255,255,255,.62);
  --glass-cres-side:rgba(255,255,255,.42);--glass-glow:rgba(255,255,255,.16);--glass-prism-o:.9;
  color-scheme:light;
}
/* ---- night mode: the same site moved onto its deep-green surface. Every value here
   lives in data/theme.json under "night" — resampled LIGHTER rust/teal so all text
   pairings hold WCAG AA on the dark grounds (checked in-session 2026-08-19). The
   attribute is stamped on <html> before first paint by the boot script in <head>
   (stored choice first, otherwise the viewer's own sunrise/sunset). */
[data-theme="night"]{
${Object.entries(theme.night.colors).map(([k, v]) => `  --${k}:${v};`).join('\n')}
  --edge-rgb:${rgbTriplet(theme.night.colors['bg-base'])};
  --glass-grad-a:${theme.night.glass['grad-a']};--glass-bg:${theme.night.glass.bg};--glass-grad-b:${theme.night.glass['grad-b']};
  --glass-border:${theme.night.glass.border};
  --glass-cres-top:${theme.night.glass['cres-top']};--glass-cres-bottom:${theme.night.glass['cres-bottom']};
  --glass-cres-side:${theme.night.glass['cres-side']};--glass-glow:${theme.night.glass.glow};--glass-prism-o:${theme.night.glass['prism-o']};
  color-scheme:dark;
}
/* the theme switch: where the browser has the View Transitions API the crossing is ONE
   composited cross-fade of two full-page snapshots — no per-element work at all. The
   .theme-anim class below is the fallback for engines without it: every surface
   transitions its own paint, minus box-shadow (repainting every shadowed card's spread
   each frame was most of the lag she named 2026-08-25). Both paths are skipped under
   reduced motion by the toggle JS. */
::view-transition-old(root),::view-transition-new(root){
  animation-duration:520ms;animation-timing-function:var(--ease-standard)}
.theme-anim,.theme-anim *,.theme-anim *::before,.theme-anim *::after{
  transition:background-color 600ms var(--ease-standard),color 600ms var(--ease-standard),
    border-color 600ms var(--ease-standard),
    opacity 600ms var(--ease-standard) !important}
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
/* night: the dot trades terracotta for the ink blue (2026-08-19 her ask). Night's
   ink-blue is a light value, so the dark bg-base label on the pill still reads. */
[data-theme="night"] .dc-body{background:var(--ink-blue)}
.dc-body span{opacity:0;transition:opacity .16s linear;padding:0 16px;
  font-family:var(--font-utility);font-weight:500;font-size:.62rem;letter-spacing:.16em;
  text-transform:uppercase;color:var(--bg-base)}
/* the pill animates width, so it can't be auto — the cursor code measures the label
   at hover time and pins the target width in --dc-pill-w (140px is "I'm curious") */
.dc.pill .dc-body{width:var(--dc-pill-w,140px);height:34px}
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
  background:linear-gradient(150deg, var(--glass-grad-a) 0%, var(--glass-bg) 52%, var(--glass-grad-b) 100%);
  -webkit-backdrop-filter:blur(${g.blur}) saturate(${g.saturate});
  backdrop-filter:blur(${g.blur}) saturate(${g.saturate});
  border:1px solid var(--glass-border);
  box-shadow:
    inset 0 1.5px 1.5px -1px var(--glass-cres-top),
    inset 0 -2px 2px -1px var(--glass-cres-bottom),
    inset 1.5px 0 2px -1px var(--glass-cres-side),
    inset -1.5px 0 2px -1px var(--glass-cres-side),
    inset 0 0 18px var(--glass-glow),
    0 10px 30px var(--shadow-soft);
}
/* the prism rim. Sits on the edge only, so the middle of the panel stays clean. */
.glass::after,.theme-toggle .tt-rim{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:0;
  background:conic-gradient(from 38deg,
    rgba(255,255,255,0) 0deg, rgba(255,120,128,.34) 22deg, rgba(255,214,96,.30) 42deg,
    rgba(126,240,186,.26) 62deg, rgba(112,178,255,.34) 82deg, rgba(192,152,255,.24) 102deg,
    rgba(255,255,255,0) 128deg);
  -webkit-mask:linear-gradient(#000,#000) content-box exclude,linear-gradient(#000,#000);
  mask:linear-gradient(#000,#000) content-box exclude,linear-gradient(#000,#000);
  padding:1.5px;mix-blend-mode:screen;opacity:var(--glass-prism-o)}
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

/* buttons used to swap into her handwriting on hover (2026-08-19); she turned it off 2026-10-23 ("I don't like the
   hover handwriting feature on my buttons"). The nav links keep theirs. */

/* PRIMARY. The hover and pressed steps are the accent walked down in value, not the accent
   plus a shadow — on a flat control the only honest way to show depression is that the
   colour gets heavier. --accent-deep is already the bottom of that walk, so pressed lands
   there and hover sits between the two. */
.btn.solid{background:var(--accent);color:var(--text-on-accent)}
.btn.solid:hover{background:var(--accent-press)}
.btn.solid:active{background:var(--accent-deep)}

/* SECONDARY. Fills with --accent-press rather than --accent on hover: a cream label on the
   plain accent measures 4.47:1, which is a hair under the 4.5 small text wants, and the
   hover state is supposed to be the darker one anyway. */
.btn.outline{border-color:var(--accent);color:var(--accent)}
.btn.outline:hover{background:var(--accent-press);border-color:var(--accent-press);color:var(--text-on-accent)}
.btn.outline:active{background:var(--accent-deep);border-color:var(--accent-deep);color:var(--text-on-accent)}

/* TERTIARY — the baby teal. The LINE is --teal-baby and the LABEL is --ink-blue, which is
   what the sheet shows and is also the only version that passes contrast: baby teal is a
   tint, and a tint that reads correctly as a 1.5px line on cream is far too pale to set
   small letterspaced type in. On hover the line fills and the label flips to cream.
   The hover fill is --ink-blue and not --teal-baby for the same reason: a cream label on
   baby teal is only 3.6:1, whereas on the full ink-blue it is 5.4:1. */
.btn.teal{border-color:var(--teal-baby);color:var(--ink-blue)}
.btn.teal:hover{background:var(--ink-blue);border-color:var(--ink-blue);color:var(--text-on-accent)}
.btn.teal:active{background:var(--bg-deep);border-color:var(--bg-deep);color:var(--text-on-deep)}

/* SIZES */
.btn.sm{min-height:38px;padding:0 20px;font-size:.68rem;letter-spacing:.12em}
nav.bar .btn.sm{min-height:42px;padding:0 22px;font-size:.76rem}
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

/* nothing may widen the page sideways: on iPhone a single element past the right edge zooms the WHOLE page out.
   clip (not hidden) so position:sticky keeps working */
html,body{overflow-x:clip}
/* ------------------------------------------------ nav */
.nav-wrap{position:fixed;top:14px;left:0;right:0;z-index:50;display:flex;justify-content:center;padding:0 16px}
/* STANDING RULE (her ask 2026-10-23, then "all across my page, not just the driftwood retention
   page"): the nav behaves EXACTLY like the walkthrough pages' pill (walkthrough.js .nav-away) —
   slides up and fades while reading down, drops back after a real scroll up or when the pointer
   comes near the top. Same curve and timing as the pill. app.js toggles .nav-hidden. */
.nav-wrap{transition:transform .6s cubic-bezier(.22,1,.36,1),opacity .5s ease}
.nav-wrap.nav-hidden{transform:translateY(-160%);opacity:0;pointer-events:none}
/* never two say hey!s on screen (her ask 2026-10-23): the nav's steps aside while the hero's is in view. It keeps its
   space, so the nav doesn't reflow */
.nav-wrap .bar>.btn.sm{transition:opacity .3s var(--ease-standard),transform .3s var(--ease-standard),visibility 0s linear 0s}
body.hero-cta-on .nav-wrap .bar>.btn.sm{opacity:0;transform:scale(.9);visibility:hidden;pointer-events:none;
  transition:opacity .3s var(--ease-standard),transform .3s var(--ease-standard),visibility 0s linear .3s}
@media (prefers-reduced-motion:reduce){.nav-wrap,.nav-wrap.nav-hidden{transition:none}}
nav.bar{display:flex;align-items:center;gap:6px;padding:6px 6px 6px 20px;border-radius:var(--r-pill);max-width:820px;width:100%;justify-content:space-between}
/* The SVG displacement warp lives on the nav and on the company chips, and nowhere else.
   Every element carrying backdrop-filter:url() costs a full backdrop snapshot + turbulence +
   displacement pass, and there were twelve of them once (nav, every button, every chip, the
   play button), which is why this is a list and not a property of .glass. The nav has always
   been on it. The four company chips joined it 2026-08-12, at her ask — they carried .glass
   already, but .glass without the warp is a frosted pill, and a frosted pill on flat cream
   has nothing to frost. What was missing was the one thing that reads as glass rather than as
   translucency: the edges of what is behind it moving as it passes.
   Six warped elements, all static filters. Do not promote this to .glass. The sixth is
   the day/night toggle (2026-08-19: "make it the same style as the nav bar at the top") —
   a second fixed pill, so it reads as the nav's counterweight in the opposite corner. */
nav.bar.glass,.w-chip.glass,.theme-toggle.glass{backdrop-filter:url(#glassWarp) blur(${g.blur}) saturate(${g.saturate})}
.wordmark{font-family:var(--font-display);font-size:1.55rem;letter-spacing:.02em;text-decoration:none;color:var(--text-primary);margin-right:8px;white-space:nowrap}
.nav-links{display:flex;gap:2px;align-items:center}
/* header type a step up (2026-10-13, "the font on my website header is too small") */
.nav-links a,.theme-toggle{font-family:var(--font-utility);font-size:.88rem;letter-spacing:.05em;text-decoration:none;color:var(--text-secondary);
  padding:10px 13px;border-radius:var(--r-pill);transition:color var(--motion-fast) var(--ease-standard),background var(--motion-fast) var(--ease-standard)}
/* hover keeps the color shift only — the wash pill left with the handwriting swap
   (2026-08-19: "remove the hover highlight thing. just do the text") */
.nav-links a:hover,.nav-links a:focus-visible,.theme-toggle:hover,.theme-toggle:focus-visible{color:var(--accent-deep)}
/* ---- the day/night label (2026-08-19 her ask). The label names the mode you'll GET:
   in day it reads "night mode", click it and the site crosses over and the label flips.
   Both faces are CSS content keyed off [data-theme] so the right words are painted
   before any JS runs; the sans face is the ::before, and the ::after is the same
   handwriting swap every other control gets. */
.theme-toggle{position:fixed;left:18px;bottom:18px;z-index:80;cursor:pointer;white-space:nowrap;
  /* (2026-08-19 her ask) the toggle leaves the nav bar for the bottom-left corner — fixed,
     so day/night is reachable from anywhere without riding the bar, and the phone bar gets
     its width back. Bottom-LEFT because the right is spoken for: the pot stands above the
     footer on the right and say-hey caps the bar. It wears the nav's glass, not the sheet's
     flat fill (2026-08-19: "make it the same style as the nav bar at the top") — the ONE
     control allowed to, because like the nav it is a fixed pill floating over whatever
     scrolls beneath it, and a flat fill pinned over moving content read as a sticker. The
     material comes from .glass on the markup plus the warp list above; the prism rim, which
     .glass normally draws with ::after, lives on a real child (.tt-rim) here because ::after
     is spoken for below — it is the handwriting face. */
  padding:12px 18px}
/* (2026-08-25, second pass: "the line looks weird… I don't like how thick it is… it looks
   messy"). The rim still names the mode the button will GIVE you — rust ringing "Night
   Mode", night-blue ringing "Day Mode" — but the 2px full-strength band read as a frame
   fighting a grey label. Now it is a HAIRLINE at half strength and the LABEL takes the
   same ink as its ring, so line and word read as one control: matched, quiet, and still
   the only coloured pill in that corner. Both key off [data-theme] so everything flips
   together. Day ink is --accent (4.7:1 on cream); night ink is night's --ink-blue. */
.theme-toggle{color:var(--accent)}
.theme-toggle .tt-rim{background:rgba(176,69,22,.5);mix-blend-mode:normal;opacity:1;padding:1px}
[data-theme="night"] .theme-toggle{color:var(--ink-blue)}
[data-theme="night"] .theme-toggle .tt-rim{background:rgba(133,196,214,.55)}
.theme-toggle::before{content:"Night Mode"}
[data-theme="night"] .theme-toggle::before{content:"Day Mode"}
.theme-toggle::after{content:"Night Mode";
  /* this ::after also matches .glass::after (the prism rim), so the rim's paint has to be
     taken back off the handwriting BEFORE the positioning below — inset:auto first, or it
     would reset the left/right/top it is meant to protect. The rim is drawn by .tt-rim. */
  background:none;-webkit-mask:none;mask:none;padding:0;mix-blend-mode:normal;inset:auto;z-index:1;
  position:absolute;left:0;right:0;top:50%;transform:translateY(-.52em);
  text-align:center;font-family:var(--font-hand);font-size:1.05em;letter-spacing:0;color:var(--ink-blue);
  opacity:0;transition:opacity var(--motion-fast) var(--ease-standard);pointer-events:none;white-space:nowrap}
[data-theme="night"] .theme-toggle::after{content:"Day Mode"}
@media (hover:hover){
  .theme-toggle:hover,.theme-toggle:focus-visible{color:transparent}
  .theme-toggle:hover::after,.theme-toggle:focus-visible::after{opacity:1}
}
@media (max-width:700px){.nav-links a.optional{display:none}
  /* corner pill on phones too — it never fit the 375px bar; down here it clears the
     home-indicator strip instead */
  .theme-toggle{left:14px;bottom:max(14px,env(safe-area-inset-bottom, 14px))}}

/* ---- phone edge fades (2026-08-26, her iOS Messages screenshot): the nav and the
   day/night pill staying see-through is right — what was wrong was the content under
   them staying SHARP enough to read. iOS softens each end of the screen with a
   PROGRESSIVE blur: not one blur thinning out, but the blur radius itself dying toward
   the middle of the screen. The first pass here was the thinning kind — a single
   blur(12px) whose mask faded its opacity — and she caught it ("doesn't feel as
   gradual"): opacity-fading a fixed blur reads as a veil lifting, not softness
   receding. Now each strip is THREE stacked backdrop layers (the element and both
   pseudos): 18px hugging the screen edge, 8px reaching to ~60% of the strip, 3px
   running its full height, every mask and the tint an easedFade() — smoothstep, so no
   fade has a findable start or end. Where the layers overlap the radii compound, and
   the eye reads one continuous ramp from ~20px to nothing. The strips sit at z-index
   40 — under the nav (50) and the toggle (80), so the pills float on softened ground
   and stay the only crisp things in their corners. --edge-rgb is bg-base as a bare
   triplet (emitted per theme above), so night fades into its own deep green, never
   cream. pointer-events:none throughout — the pot under the bottom strip keeps its
   clicks. Phones only: on desktop the pills sit in open margins and the page never
   scrolls under them at reading size. Six static blurs total, none animated, so this
   does not repeat the feTurbulence-in-backdrop lag of 2026-08. */
.edge-fade{position:fixed;left:0;right:0;height:128px;z-index:40;pointer-events:none;display:none}
.edge-fade::before,.edge-fade::after{content:"";position:absolute;inset:0;pointer-events:none}
.edge-fade.top{top:0}
.edge-fade.bottom{bottom:0}
${['top', 'bottom'].map(edge => {
    const dir = edge === 'top' ? 'bottom' : 'top';
    const tint = a => `rgba(var(--edge-rgb),${a})`;
    return `.edge-fade.${edge}{background:${easedFade(dir, .5, 85, tint)};
  -webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);
  -webkit-mask-image:${easedFade(dir, 1, 100)};mask-image:${easedFade(dir, 1, 100)}}
.edge-fade.${edge}::before{-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);
  -webkit-mask-image:${easedFade(dir, 1, 60)};mask-image:${easedFade(dir, 1, 60)}}
.edge-fade.${edge}::after{-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);
  -webkit-mask-image:${easedFade(dir, 1, 34)};mask-image:${easedFade(dir, 1, 34)}}`;
  }).join('\n')}
@media (max-width:700px){.edge-fade{display:block}}

/* ---- the wordmark's greeting (2026-08-19). M and K load side by side and spread apart,
   the dashes revealing themselves between them; hovering squishes them back together and
   the dashes disappear. Transforms and opacity only, and the two letters move INWARD into
   the dash's space, so the a's box never changes size — the nav does not re-layout and
   the glass filter is not disturbed. --wm-dx is half the rendered width of "--" in the
   wordmark's own font (measured at 1.35rem Cormorant + .02em tracking); the letters
   meeting exactly is that measurement, so re-measure if the font or tracking changes. */
.wm-m,.wm-k,.wm-d{display:inline-block}
.wordmark{--wm-dx:.34em}
.wm-m,.wm-k{transition:transform .38s var(--ease-enter)}
.wm-d{transform-origin:50% 50%;transition:transform .38s var(--ease-enter),opacity .28s var(--ease-standard)}
.wordmark:hover .wm-m{transform:translateX(var(--wm-dx))}
.wordmark:hover .wm-k{transform:translateX(calc(-1*var(--wm-dx)))}
.wordmark:hover .wm-d{opacity:0;transform:scaleX(.1)}
@keyframes wm-in-m{from{transform:translateX(var(--wm-dx))}to{transform:none}}
@keyframes wm-in-k{from{transform:translateX(calc(-1*var(--wm-dx)))}to{transform:none}}
@keyframes wm-in-d{from{opacity:0;transform:scaleX(.1)}to{opacity:1;transform:none}}
/* .wm-load is stamped on the index's wordmark only: the greeting plays where the site
   is entered; clicking into a case study keeps M--K still, as if the bar persisted */
.wm-load .wm-m{animation:wm-in-m .8s var(--ease-enter) .5s backwards}
.wm-load .wm-k{animation:wm-in-k .8s var(--ease-enter) .5s backwards}
.wm-load .wm-d{animation:wm-in-d .8s var(--ease-enter) .5s backwards}

/* ---- nav labels turn into her hand on hover (same day). The handwritten copy is a
   ::after overlay, absolutely positioned so the pill never changes width — the sans
   label fades to transparent under it rather than leaving the layout. It exists at
   opacity 0 from first paint, which is also what keeps madhu-hand.woff (14KB) warm on
   every page — no flash of fallback on the first hover. The double content declaration
   is the alt-text syntax: modern browsers take the second form and keep the duplicate
   word out of the accessibility tree; older ones keep the first and stay functional.
   Gated to (hover:hover) so a phone tap never strands a link in its hover face. */
.nav-links a{position:relative}
.nav-links a[data-hand]::after{content:attr(data-hand);content:attr(data-hand) / "";
  /* -.52em drops the hand's BASELINE onto the sans label's baseline (2026-08-19: it sat
     visibly high). Madhu Hand carries a deep descender box (asc 9 / desc 8), so centring
     the line box floats the ink upward; the constant folds the two fonts' ascents and
     half-leadings together and scales with the pill's type size. */
  position:absolute;left:0;right:0;top:50%;transform:translateY(-.52em);text-align:center;
  font-family:var(--font-hand);font-size:1.05em;letter-spacing:0;color:var(--ink-blue);
  opacity:0;transition:opacity var(--motion-fast) var(--ease-standard);pointer-events:none;white-space:nowrap}
@media (hover:hover){
  .nav-links a[data-hand]:hover,.nav-links a[data-hand]:focus-visible{color:transparent}
  .nav-links a[data-hand]:hover::after,.nav-links a[data-hand]:focus-visible::after{opacity:1}
}

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
/* hovering a bio line: hover devices only (a phone tap shouldn't set anything moving) */
@media (hover:hover){
  /* the bio no longer dims anything when a line is hovered (her call 2026-10-23: "we don't need to do the dimming thing
     anymore"): no page dim, no other line stepping back. The hovered line still lifts and waves. */
  .hero-line span.hs{position:relative;transition:transform 320ms var(--ease-standard),filter 320ms var(--ease-standard)}
  .hero-line span.hs:hover{transform:translateY(-4px);filter:drop-shadow(0 6px 10px rgba(0,0,0,.55))}
  /* the hovered line WAVES like "Hi, I'm Madhu" (her ask 2026-10-23, replacing the blue glimmer): app.js splits each
     word into letters, and they rise 7px in the accent one after another, falling back in reverse on leave */
  .hero-line .hs .ch{display:inline-block;white-space:pre;transition:transform var(--motion-base) var(--ease-standard),color var(--motion-base) var(--ease-standard)}
  .hero-line .hs.waving .ch{transform:translateY(-7px);color:var(--accent)}
}
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
/* min(0px,…) is the ultra-wide guard (2026-08-19, her "stem is cut off" report): past
   ~2380px of viewport the keep-out grows beyond the artwork's width, keep − width goes
   POSITIVE, and the bloom detaches from the screen edge — showing the PNG's own cut
   boundary (and, before it was erased from the asset, the stem ending mid-air). A bloom
   may reach LESS far than its keep-out; it must never float free of its edge. */
.flora-a{top:-11%;width:var(--flora-a-w);left:min(0px,calc(var(--flora-keep) - var(--flora-a-w)))}
.flora-b{bottom:-12%;width:var(--flora-b-w);right:min(0px,calc(var(--flora-keep) - var(--flora-b-w)))}
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
/* THE JUMP! BOX (placeholder clay, drawn in CSS). app.js places it beside the name; stickman.js treats the
   (still) button as ground, while .jb-art bobs gently inside it. Under the figure's canvas (z 3) so she
   stands ON it; the socials sit under the box (z 1) so they come OUT of its opening. Laptop only for now. */
.hero>.jump-box{position:absolute;margin:0;max-width:none;z-index:2;width:136px;padding:0;border:0;background:none;cursor:pointer;
  opacity:0;transition:opacity 700ms var(--ease-standard) 1700ms}
.hero.revealed>.jump-box{opacity:1}
.jump-box:focus-visible{outline:2px solid var(--accent);outline-offset:6px;border-radius:16px}
/* the clay piece: a WHITE clay cloud that bobs (her call 2026-10-23, after a blue box, blue shapes and a blue cloud;
   the Flora blue cloud re-inked white by its own shading). "jump!" is type laid over it, never painted into the art */
.jb-art{position:relative;display:block;transform-origin:50% 100%;animation:jb-bob 2.8s ease-in-out infinite}
.jb-img{display:block;width:100%;height:auto;pointer-events:none;-webkit-user-drag:none;transition:opacity 1.1s ease-in-out}
/* the cloud MORPHS (her ask: "morph around in shape and have light hit it differently as it morphs"): six Flora clay
   frames of the same cloud, each reshaped and lit from another side, cross-faded slowly in a loop by app.js */
.jb-img.jb-f{position:absolute;left:0;top:0;opacity:0}
.jb-img.jb-f.on{opacity:1}
.jb-word{position:absolute;left:0;right:0;top:54%;transform:translateY(-50%);text-align:center;font-family:var(--font-body);font-weight:600;font-size:19px;color:#151a2b;letter-spacing:.01em;pointer-events:none}   /* "jump!" set like the say hey! button (not her handwriting) */
@keyframes jb-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
.jb-art.still{animation:none;transition:transform 250ms var(--ease-standard)}
.jump-box:hover .jb-art:not(.still){animation-duration:1.6s}
.jb-art.slam{animation:jb-slam 420ms cubic-bezier(.3,1.5,.5,1)}
@keyframes jb-slam{0%{transform:none}25%{transform:scale(1.08,.82)}100%{transform:none}}
.hero>.jb-socials{position:absolute;inset:0;margin:0;max-width:none;z-index:1;pointer-events:none}
.jb-logo{position:absolute;left:0;top:0;width:52px;height:52px;opacity:0;pointer-events:none;will-change:transform;
  filter:drop-shadow(0 6px 8px rgba(0,0,0,.45));transition:opacity 120ms linear}
.jb-logo img{display:block;width:100%;height:100%;object-fit:contain;-webkit-user-drag:none}
.jb-logo.out{opacity:1;pointer-events:auto}
.jb-logo:focus-visible{outline:2px solid var(--accent);outline-offset:4px;border-radius:8px}
.hero>.jump-box.gone{visibility:hidden;pointer-events:none}
.hero>.jb-dust{position:absolute;margin:0;max-width:none;z-index:2;border-radius:50%;pointer-events:none;
  background:radial-gradient(circle at 35% 30%,#f6d08a,#d39a45 60%,#a8732c)}
@media (max-width:760px){.hero>.jump-box,.hero>.jb-socials{display:none}}
@media (prefers-reduced-motion:reduce){.jb-art{animation:none}}
/* ---- the cinematic load. The hero used to arrive in two registers at once: the
   handwriting wrote itself in word by word while the blooms, the headline and the two
   buttons just APPEARED at first paint — which is the harshness she named (2026-08-19,
   "fade in cinematically"). Now it assembles in layers off the same .revealed trigger
   the word reveal already uses, each layer fading up a few px as it lands:

     paint (1.6s fade from 150ms) → headline (rises, 450ms→1.4s) → the eyebrow's
     handwriting (900ms base, in step with the blooms' own resolve) → buttons
     (1.35s→2.15s) → the hero paragraph (data-base 1800: the architecture line only
     starts writing once the blooms have fully arrived — 2026-08-25 her ask) →
     the figure last (stick.js
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
/* THE HAND-OFF (her ask 2026-10-23: "once hi I'm Madhu loads in and rises with the blue and falls, it
   should shrink and my bio words would become the big focal"). app.js plays one wave after the
   headline lands, then adds .handoff: the name steps back to a smaller size and the bio grows into
   the lead. Reduced motion lands on the hand-off state with no movement. */
/* the name STAYS big (her follow-up: "keep Madhu big"). The bio is set at its big, focal size FROM THE
   START: growing it after load re-wrapped every sentence mid-animation ("why does the text in the bio
   readjust when it loads in?"). Height-aware, so say hey! and Resume stay on the first screen. */
.hero .hero-line{width:min(100%,1040px);font-size:clamp(1.02rem,min(2.3vw,2.9vh),2.2rem);line-height:1.36}
@media (max-width:600px){.hero .hero-line{line-height:1.3}}
.hero-cta-row{opacity:0;transform:translateY(14px);transition:opacity 800ms var(--ease-enter) 1350ms,transform 800ms var(--ease-enter) 1350ms}
.hero.revealed .hero-cta-row{opacity:1;transform:none}
/* words land clean — the blur-resolve tried on the whole hero came straight back out
   (2026-08-19, same day: "it hurts my eyes"). It survives on the EYEBROW ONLY below,
   because she asked to keep it for the word portfolio. */
.w{display:inline-block;white-space:pre;opacity:0;transform:translateY(.45em);transition:opacity var(--motion-slow) var(--ease-enter),transform var(--motion-slow) var(--ease-enter)}
/* iOS WebKit culls glyph ink it believes cannot exist: it takes a text run's ink bounds
   from the font's hhea descent (656 units), and her g's loop reaches 1098 — so on a phone
   the bottom of one g (whichever crosses a tile boundary; "guidance." on the iPhone 17
   wrap, 2026-08-19 "one of the g's on mobile is still getting cut off") was simply never
   painted. Chrome computes real outline bounds and never shows it. The fix is to make the
   overflow not be overflow: pad each word-box past the deepest tail (1.098em down, ±.35em
   sideways for the left-swinging loops and right flicks) and take the exact same amount
   back with negative margins. An inline-block's line contribution is its MARGIN box, and
   its baseline is its text baseline, so layout, wrapping and rhythm do not move by a
   pixel — only the box WebKit rasterises grows to hold all of her ink. */
.hero-line .w{padding:0 .35em .3em .35em;margin:0 -.35em -.3em -.35em}
.eyebrow .w{filter:blur(9px);transition:opacity 900ms var(--ease-enter),transform 900ms var(--ease-enter),filter 1400ms var(--ease-standard)}
.revealed .w{opacity:1;transform:none}
.revealed .eyebrow .w{filter:blur(0)}
/* the blooms arrive WITH the word Portfolio (2026-08-19 "can portfolio blur in with the
   flowers in the background") — the same blur-resolve the eyebrow kept, on the eyebrow's
   own 900ms cue with the same pair of clocks, so word and paint read as one layer
   resolving. Only the HIDDEN state is written, so each bloom lands on the stylesheet's
   own resting opacity — 1 on desktop, .5 on a phone. Gated to no-preference rather than
   patched in the reduced-motion block: under RM the blooms must simply BE there, at
   whatever opacity their width tier says, from the first frame. */
@media (prefers-reduced-motion:no-preference){
  .hero-flora img{transition:opacity 900ms var(--ease-enter) 900ms,filter 1400ms var(--ease-standard) 900ms}
  .hero:not(.revealed) .hero-flora img{opacity:0;filter:blur(14px)}
}
.lively .ch{display:inline-block;white-space:pre;transition:transform var(--motion-base) var(--ease-standard),color var(--motion-base) var(--ease-standard)}
.lively:hover .ch{color:var(--accent)}
.lively.waving .ch{transform:translateY(-7px);color:var(--accent)}   /* rises in the accent, on hover and in the load hand-off */
@media (max-width:760px){.hero{padding-top:calc(var(--space)*20);min-height:0}
  /* phone measure wraps her sentences onto more lines, so descender collisions that
     desktop never sees show up here — the g of "strategy" landing in "study"
     (2026-08-19 "the g in the hero text gets cut off"). More leading, not less type. */
  .hero-line{max-width:none;line-height:1.95}
  .hero-line span.hs + span.hs{margin-top:.7em}}

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

/* THE WALL ARRIVES AS WISPS OF DOTS (her ask 2026-10-23, after the coin roll: "make the logos roll
   in like whisp dots"). Each mark is sampled from its own mask into square dots that drift in from
   the left on curling paths, settle into the letterforms, then hand over to the crisp masked logo.
   GSAP drives the timing (vendor/gsap.min.js, fetched only when the wall nears view); one canvas over
   the row (.brands-wisp) draws every dot. .gs-roll holds the marks hidden until then, and app.js adds
   it only when motion is allowed, so no-JS and reduced motion simply show the wall. */
.brands-row{position:relative}
.brands-wisp{position:absolute;pointer-events:none;z-index:1}
.brand-slot{display:block;line-height:0}
/* display:block is load-bearing: inside a slot .brand is an inline span, where height:38px
   does not apply and the mark collapses to nothing */
.brand-slot .brand{display:block}
/* the logos that LINK somewhere glow blue ON HOVER (her ask 2026-10-23, then "only when hovering"): at rest they
   match the wall; hovering one turns it blue with a soft glow, so you learn it opens a proof link. Logos without a
   link keep the plain .brand:hover. The glow sits on the link, not the mark: a filter on the masked .brand would be
   masked away with it. */
a.brand-slot{transition:filter var(--motion-base) var(--ease-standard)}
a.brand-slot:hover,a.brand-slot:focus-visible{filter:drop-shadow(0 0 8px color-mix(in srgb,var(--accent) 75%,transparent))}
a.brand-slot:hover .brand,a.brand-slot:focus-visible .brand{background:var(--accent)}
.brands-row.gs-roll .brand{opacity:0}
/* the row carries the observer, not the movement — the logos do that */
.brands-row.fade{opacity:1;transform:none;transition:none}
@media (max-width:600px){.brands-row{gap:calc(var(--space)*4)}.brand{height:28px}}

/* ------------------------------------------------ work cards (outcome statements) */
.wproject{display:grid;grid-template-columns:1fr minmax(0,46%);gap:calc(var(--space)*8);align-items:center;margin-bottom:calc(var(--space)*13);
  text-decoration:none;color:inherit;border-radius:var(--r-card);padding:calc(var(--space)*3);
  transition:background var(--motion-base) var(--ease-standard)}
/* hover wash is the terracotta wash token, not white — white is not in this palette and
   read as a cold sheet laid over the warm cream */
.wproject:hover{background:var(--accent-wash)}
.wproject:last-of-type{margin-bottom:0}
/* ------------------------------------------------ the swipe deck (deck.html, see sdeckHTML)
   Her v2 brief, measured from reference-swipe-deck.mov: the active card is ~73% of the width (capped by the
   screen's height so card + headline fit) and centred at 51% of the deck's height; every other card waits at
   half size in a corner lane, top (30%) or bottom (72%); the two neighbours always sit in opposite corners and
   the pairing flips with each swipe, as in the video. app.js places every card from one swipe progress p (y and scale
   move with x, never as a separate step). Background #101010, corners 8% of the card. Dials read --sd-* first. */
${swipeTweaks()}
/* the work section: SWIPE (deck, default) or SCROLL (list), flipped by the toggle in its head */
.work-sec[data-view="deck"]{max-width:none;padding:calc(var(--space)*9) 0 calc(var(--space)*6);background:var(--sd-bg,#101010)}
.work-head{max-width:1240px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.work-sec[data-view="deck"] .work-head{padding:0 calc(var(--space)*6)}
.work-head .section-title{margin:0}
.view-toggle{display:inline-flex;gap:4px;padding:4px;border-radius:var(--r-pill);border:1px solid var(--line)}
/* icons, not words (her ask): three cards side by side = swipe, two stacked rows = scroll */
.view-btn{display:grid;place-items:center;width:44px;height:36px;padding:0;border:0;border-radius:var(--r-pill);
  background:transparent;color:var(--text-secondary);cursor:pointer;transition:background var(--motion-base) var(--ease-standard),color var(--motion-base) var(--ease-standard)}
.view-btn[aria-pressed="true"]{background:var(--text-primary);color:var(--bg-base)}
.view-btn svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.6}
.view-btn:focus-visible{outline:2px solid var(--ink-blue);outline-offset:2px}
.work-sec[data-view="deck"] .view-list,.work-sec[data-view="list"] .view-deck{display:none}
.work-sec[data-view="list"] .view-list{margin-top:calc(var(--space)*6)}
/* the toggle's dock: sticky to the bottom of the screen while the work section is on screen, so it is always
   in reach; it comes to rest at the end of the section. z-index 45 keeps it ABOVE the phone's bottom edge-fade
   haze (40), which was blurring it (her: "the toggle at the bottom is hidden behind a haze") */
.view-dock{display:flex;justify-content:center;margin-top:calc(var(--space)*4)}
/* app.js lifts the dock out of <main> (whose z-index:1 kept it UNDER the phone's bottom haze however high its own
   z-index went) and floats it at the bottom of the screen while the work section is on screen */
.view-dock.floating{position:fixed;left:0;right:0;bottom:16px;z-index:45;margin:0;pointer-events:none;opacity:0;transform:translateY(8px);
  transition:opacity 200ms var(--ease-standard),transform 200ms var(--ease-standard)}
.view-dock.floating.on{opacity:1;transform:none}
.view-dock.floating.on .view-toggle{pointer-events:auto}
/* laptop: nav and toggle take turns (her ask) — scrolling up brings the nav back, so the toggle steps away until it hides again */
@media (hover:hover) and (pointer:fine){body:has(.nav-wrap:not(.nav-hidden)) .view-dock.floating.on{opacity:0;transform:translateY(8px)}
  body:has(.nav-wrap:not(.nav-hidden)) .view-dock.floating.on .view-toggle{pointer-events:none}}
/* the toggle STARTS beside the "Selected Projects" title (her ask: "toggle should start next to selected project
   first and then move — right now it feels in the way"); the floating one at the bottom only appears once that
   title has scrolled away, and the first time it MATERIALIZES (her Apple reference): one small dark pill at its
   centre that widens into the bar (a clip, so the icons never stretch), then the icons fade in. Once per visit. */
.work-head .head-toggle{background:rgba(22,27,40,.88);transition:opacity 200ms var(--ease-standard)}
body:has(.view-dock.on) .work-head .head-toggle{opacity:0;pointer-events:none}   /* never two toggles on screen */
.view-toggle.materialize{animation:vt-grow 700ms cubic-bezier(.22,1,.36,1) 150ms both}   /* the pill shows for a beat, then widens */
.view-toggle.materialize .view-btn{animation:vt-icons 260ms ease-out 820ms both}   /* icons once the bar is whole: ~1.1s in all */
@keyframes vt-grow{from{clip-path:inset(0 calc(50% - 22px) round 999px)}to{clip-path:inset(0 0 round 999px)}}
@keyframes vt-icons{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.view-toggle.materialize,.view-toggle.materialize .view-btn{animation:none}}
.view-dock .view-toggle{pointer-events:auto;background:rgba(22,27,40,.88);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
/* the project name, plain (no pill): small capitals over the headline/tags */
.w-name{font-family:var(--font-utility);font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;color:var(--text-primary)}
.sdeck{--aw:var(--sd-aw,73);--ah:var(--sd-ah,75);--side:var(--sd-side,.5);--gap:var(--sd-gap,6);--peek:var(--sd-peek,7);
  --settle:var(--sd-settle,.5);--radius:var(--sd-radius,.08);
  position:relative;margin-top:calc(var(--space)*3);overflow:hidden;touch-action:pan-y;cursor:grab;outline:none;-webkit-user-select:none;user-select:none}
.sdeck:focus-visible{box-shadow:inset 0 0 0 2px var(--ink-blue)}
.sdeck.dragging{cursor:grabbing}
.sdeck-stage{position:relative;height:var(--stage,60vh)}
.scard{position:absolute;left:50%;top:0;width:var(--S,50vw);height:var(--S,50vw);margin:calc(var(--S,50vw) / -2) 0 0 calc(var(--S,50vw) / -2);
  border-radius:calc(var(--S,50vw) * var(--radius));background:var(--bg-raised);display:grid;place-items:center;padding:calc(var(--S,50vw) * .08);
  overflow:hidden;transform-origin:50% 50%;color:inherit;text-decoration:none;-webkit-user-drag:none;will-change:transform}
.scard-media{width:100%;height:100%;display:grid;place-items:center;pointer-events:none}
/* PRESS AND HOLD a card (her ask): its tech stack rises over the card while held; a tap still opens it.
   No long-press link menu on phones. */
.scard{-webkit-touch-callout:none}
.scard-stack{position:absolute;left:0;right:0;bottom:0;padding:calc(var(--S,50vw) * .07);padding-top:calc(var(--S,50vw) * .2);text-align:left;
  background:linear-gradient(to top,rgba(10,10,12,.94) 55%,rgba(10,10,12,0));opacity:0;transform:translateY(10px);
  transition:opacity 220ms var(--ease-standard),transform 220ms var(--ease-standard);pointer-events:none}
.scard.held .scard-stack{opacity:1;transform:none}
.scard-stack-label{display:block;margin-bottom:.7em;font-family:var(--font-utility);font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;color:var(--text-secondary)}
.scard-stack ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px}
.scard-stack li{font-family:var(--font-utility);font-size:.74rem;line-height:1.2;color:var(--text-primary);border:1px solid rgba(255,255,255,.22);border-radius:var(--r-pill);padding:5px 11px}
@media (prefers-reduced-motion:reduce){.scard-stack{transition:none}}
.scard-media>*{max-width:100%;max-height:100%}
.scard-media .phone-media{height:100%;width:auto;max-width:none;aspect-ratio:1.1036/2.2705}
/* the centred project's full-sentence headline, directly under the card; wraps freely, and its box is held
   at the height of the longest headline so nothing below jumps when it changes */
.sdeck-title{margin:1.2rem auto 0;padding:0 16px;width:min(100%,calc(var(--S,50vw) + 2rem));min-height:var(--title-h,auto);box-sizing:border-box;
  text-align:center;font-family:var(--font-display);font-weight:500;font-size:clamp(1.05rem,2vw,1.6rem);line-height:1.3;letter-spacing:-.01em;
  color:var(--text-primary);text-wrap:balance}
.sdeck-title>span{display:inline-block;transition:opacity 240ms var(--ease-standard),transform 240ms var(--ease-standard)}
.sdeck-title.swap>span{opacity:0;transform:translateY(10px)}
/* her ask: "I can't tell that the text changed when I swiped … when you swipe the text should fully disappear":
   it is gone the moment the deck moves and comes back once a project has clicked into place */
.sdeck-title.moving>span{opacity:0;transform:translateY(10px);transition-duration:110ms}
/* the project name, plain, over its full-sentence headline */
.sdeck-name{display:block;margin-bottom:.45em;font-family:var(--font-utility);font-size:.72rem;font-weight:400;letter-spacing:.14em;text-transform:uppercase;color:var(--text-secondary)}
.sdeck-line{display:block}
@media (prefers-reduced-motion:reduce){.sdeck-title>span{transition:none}}
/* WHERE YOU ARE, AND A WAY TO THE END (her ask 2026-10-23): one thin segment per project under the headline;
   the current one is bright, the ones passed stay lit, the rest are faint. Tap a segment or drag along the bar
   to jump straight there. Each segment's hit area is taller than its 3px line. */
/* THE DEMO IS THE CARD, on every screen (her 2026-10-23 correction for laptops, then "I want the screens to be
   bigger for the phone especially"): no navy square, no padding; each card keeps its own media's shape and app.js
   sizes it. Phones: the demo fills ~58% of the screen's height or 88% of its width, the headline under it.
   Laptops (1000px+, .sdeck.side): the demo sits left of centre and the headline reads in a column on its RIGHT
   ("can you have the case study text show up on the right? it just feels hard to read"), bigger and in white. */
.scard{width:var(--w,40vw);height:var(--h,auto);margin:calc(var(--h,0px) / -2) 0 0 calc(var(--w,40vw) / -2);padding:0;background:none;border-radius:0;overflow:visible}
.scard-media{display:block;height:auto}
.scard-media>*,.scard-media .phone-media{width:100%;height:auto;max-width:none;max-height:none}
.scard-stack{border-radius:0 0 var(--r-media) var(--r-media);padding:24px;padding-top:64px}
.sdeck-title{width:min(100% - 32px,calc(var(--sd-tw,56) * 1vw));margin-top:calc(var(--sd-tgap,28) * 1px);font-size:clamp(1.2rem,1.9vw,1.75rem)}
@media (max-width:760px){.sdeck-title{width:calc(100% - 32px);font-size:1.15rem}}
.sdeck.side .sdeck-title{position:absolute;left:var(--tl,60%);top:var(--tt,50%);width:var(--tw,30%);margin:0;padding:0;min-height:0 !important;
  transform:translateY(-50%);text-align:left;text-wrap:pretty;font-size:clamp(1.45rem,1.9vw,2.05rem);line-height:1.25;color:var(--ink-blue)}
.sdeck.side .sdeck-name{margin-bottom:.7em;font-size:.76rem}
/* phones (.stack): every demo centred in the stage and the headline follows right under whichever one is showing,
   so a short landscape demo doesn't leave a tall empty gap above it; the bar below keeps room for the longest */
.sdeck.stack .sdeck-title{position:absolute;left:16px;right:16px;width:auto;top:var(--tt,100%);margin:0;min-height:0 !important}
.sdeck.stack .sdeck-progress{margin-top:var(--tres,24px)}
.sdeck-progress{display:flex;gap:6px;width:min(72vw,380px);margin:calc(var(--space)*2.5) auto 0;touch-action:none}
.sdeck-progress button{flex:1;padding:10px 0;margin:0;border:0;background:none;cursor:pointer}
.sdeck-progress button::before{content:"";display:block;height:3px;border-radius:2px;background:var(--line);transition:background 200ms var(--ease-standard)}
.sdeck-progress button.done::before{background:var(--text-secondary)}
.sdeck-progress button.on::before{background:var(--text-primary)}
.sdeck-progress button:focus-visible{outline:2px solid var(--ink-blue);outline-offset:2px}
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
/* the tech stack (her ask 2026-10-23: "a tech stack of all the things I used, the language it was coded
   in, if I used GitHub"), from site.json work.projects[].stack — only what the repos and case studies verify */
.w-stack{list-style:none;display:flex;flex-wrap:wrap;gap:6px;margin:calc(var(--space)*2) 0 0;padding:0}
.w-stack li{font-family:var(--font-utility);font-size:.72rem;letter-spacing:.02em;line-height:1.2;color:var(--text-secondary);
  border:1px solid var(--line);border-radius:var(--r-pill);padding:5px 11px}
@media (max-width:760px){.wproject{grid-template-columns:1fr;gap:calc(var(--space)*4);margin-bottom:calc(var(--space)*9)}
  .wproject .project-media-wrap{order:-1}}
/* PHONES, LIKE REELS (her ask 2026-10-23: A "doesn't feel like I'm scrolling on reels or tik tok"): each
   project fills the screen and a swipe settles on the next one, one at a time (REELS SETTLE in app.js eases
   it there once the finger is off and the scroll has stopped; nothing moves during the gesture). The GSAP focus still eases each
   project in and out on top. */
@media (max-width:760px){
  /* ONE SWIPE = ONE PROJECT, NEVER OVERSHOT (her: "I swipe and it stays over shot for too long and then snaps
     in. I just don't want the swipe to ever be over shot"). iPhone's native snapping on the page glides past and
     snaps back, so app.js pages the list itself (REELS PAGING): the page follows the finger 1:1, and on release
     GSAP eases to the next project (or back) with a decelerating curve that never passes it. */
  #work .wproject{min-height:100svh;margin-bottom:0;align-content:center;gap:calc(var(--space)*3);
    padding-top:calc(var(--space)*5);padding-bottom:calc(var(--space)*5)}
  /* the WHOLE phone always shows (her: "the phone should never get cut off"): every screen is capped by the
     screen's height, and the card carries only the name and its headline, smaller; the tags and stack stay
     on desktop, in the swipe deck (press and hold) and on the case study */
  #work .wproject .project-media-wrap{max-height:64svh;display:grid;grid-template-columns:minmax(0,1fr);place-items:center}   /* a full-width column: an auto one sized the shots to nothing */
  #work .wproject .project-media-wrap>*{width:100%}   /* browser and laptop shots keep full width; phones size by height below */
  #work .wproject .phone-media{height:min(64svh,560px);width:auto;max-width:none;aspect-ratio:1.1036/2.2705}
  #work .wproject .project-media,#work .wproject .browser-media,#work .wproject .mac-media{max-height:64svh}
  #work .wproject .w-outcome{font-size:clamp(1.15rem,5vw,1.4rem);line-height:1.3}
  #work .wproject .w-tags,#work .wproject .w-stack{display:none}
  #work .wproject .w-chiprow{margin-top:calc(var(--space)*1.5)}
  /* paging back UP shows where you are (her ask: "when you scroll up, Selected Projects should show"): the section
     head pins to the top and slides in on the way up, tucks away on the way down. Above the top haze. */
  .work-sec[data-view="list"] .work-head{position:sticky;top:78px;z-index:45;padding:10px 0 16px;margin:0;   /* sits just under the nav, which also comes back on the way up */
    background:linear-gradient(var(--bg-base) 72%,rgba(15,16,19,0));transition:transform 260ms var(--ease-standard)}
  /* it only tucks away WHILE paging through the projects; arriving at the section it sits in its place */
  .work-sec[data-view="list"] .work-head.tuck{transform:translateY(-110%)}
  .work-sec[data-view="list"] .work-head .section-title{font-size:1.25rem}
}
.project-media-wrap{display:flex;justify-content:center}

${PHONE_CSS}

/* the landscape card and the Mac window must end up the SAME box. The window is
   1.945 of body plus 80 logical px of chrome at a 1280pt reference, i.e. total height
   = w*(1/1.945 + 80/1280) — a constant ratio of 1.7343, whatever the width. */
.project-media{position:relative;border-radius:var(--r-media);overflow:hidden;border:1px solid var(--line);background:var(--bg-raised);aspect-ratio:1.7343;width:100%}
.project-media video,.project-media img.poster{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
[data-video] video{opacity:0;transition:opacity var(--motion-base) var(--ease-standard)}
[data-video].playing video{opacity:1}

/* ---------- Chrome, drawn once (home-card window + the MacBook's screen) ----------
   Everything is sized in --u = one logical pt of the window the chrome pretends to
   be, so the same two rows serve the 1280pt standalone window and the maximized
   window on the MacBook's 1512pt display. Metrics and colors are Chrome's own,
   checked against her screenshot: 40pt tab strip #DEE1E6 with a white 34pt active
   tab, 12pt traffic lights 8pt apart, 40pt toolbar with the #F1F3F4 omnibox pill,
   ink #202124, icons #5F6368. Hard-coded px or invented tints are the two things
   that give a fake browser away. */
.chrome-tabs{display:flex;align-items:flex-end;height:calc(40*var(--u));background:#DEE1E6;
  padding-left:calc(14*var(--u));flex:0 0 auto;overflow:hidden}
.chrome-tabs .lights{display:flex;gap:calc(8*var(--u));align-self:center;margin-right:calc(14*var(--u));flex:0 0 auto}
.chrome-tabs .lights i{width:calc(12*var(--u));height:calc(12*var(--u));border-radius:50%;display:block}
.chrome-tabs .lights i:nth-child(1){background:#EC6A5E}
.chrome-tabs .lights i:nth-child(2){background:#F4BF4F}
.chrome-tabs .lights i:nth-child(3){background:#61C554}
.chrome-tabs .tab{display:flex;align-items:center;gap:calc(7*var(--u));background:#fff;
  border-radius:calc(9*var(--u)) calc(9*var(--u)) 0 0;height:calc(34*var(--u));
  width:calc(240*var(--u));padding:0 calc(10*var(--u));overflow:hidden;white-space:nowrap;
  font-family:var(--font-utility);font-size:max(6px,calc(12*var(--u)));letter-spacing:.01em;color:#202124}
.chrome-tabs .fav{width:calc(14*var(--u));height:calc(14*var(--u));border-radius:calc(3*var(--u));background:var(--accent);flex:0 0 auto}
.chrome-tabs .tab-t{flex:1;overflow:hidden;text-overflow:ellipsis}
.chrome-tabs .tab-x{color:#5F6368;flex:0 0 auto}
.chrome-tabs .tab-plus{align-self:center;margin-left:calc(10*var(--u));color:#5F6368;
  font-family:var(--font-utility);font-size:max(7px,calc(16*var(--u)));line-height:1}
.chrome-nav{display:flex;align-items:center;gap:calc(10*var(--u));height:calc(40*var(--u));
  background:#fff;padding:0 calc(14*var(--u));border-bottom:1px solid #DADCE0;flex:0 0 auto}
.chrome-nav .nav-ic{font-family:var(--font-utility);font-size:max(6px,calc(13*var(--u)));color:#5F6368;flex:0 0 auto}
.chrome-nav .nav-ic.is-off{opacity:.35}
.chrome-nav .omni{flex:1;display:flex;align-items:center;gap:calc(7*var(--u));height:calc(28*var(--u));
  border-radius:999px;background:#F1F3F4;padding:0 calc(12*var(--u));overflow:hidden;white-space:nowrap;
  font-family:var(--font-utility);font-size:max(6px,calc(12*var(--u)));color:#202124}
.chrome-nav .lock{width:calc(9*var(--u));height:calc(9*var(--u));border-radius:calc(2*var(--u));
  border:1px solid #5F6368;opacity:.7;flex:0 0 auto}
.chrome-nav .prof{width:calc(18*var(--u));height:calc(18*var(--u));border-radius:50%;
  background:linear-gradient(135deg,#7A9CC6,#4A6B96);flex:0 0 auto}

/* the standalone window: 1280pt wide, 10pt radius. Tab strip + toolbar stay 80u
   total — the 1.7343 SAME-box contract with the landscape cards depends on it. */
.browser{container-type:inline-size;width:100%;--u:.0781cqw;
  border-radius:calc(10*var(--u));overflow:hidden;background:#DEE1E6;
  box-shadow:0 calc(24*var(--u)) calc(54*var(--u)) var(--shadow-mid),
             0 calc(2*var(--u)) calc(6*var(--u)) var(--shadow-soft),
             inset 0 0 0 1px rgba(24,38,32,.10)}
/* matches the 2880x1480 screen captures, so nothing gets cropped */
.browser-body{position:relative;aspect-ratio:1.945;background:#fff;overflow:hidden}
.browser-body img.poster,.browser-body video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top center}

/* ---------- MacBook bezel (horizontal screens on case-study pages) ----------
   Drawn the way the phone is drawn: measured from her reference photo, not from
   memory. "mac bezel.png" is 917x576; with the base slab as the unit (896px wide)
   the pixels say: lid 759x515, inset 68px a side; bezel 11px on sides and bottom,
   25px on top with the camera 13px down; base slab 31px tall, thumb scoop 130x10px,
   bottom corners sweeping in 50px. Colors are sampled, not styled: #020202 glass
   behind a #3A3B3E edge line; base face #B1B3BA falling through #5E5F63 with a
   #97989D floor bounce; the scoop reads BRIGHTER than the face (#F2F4F9), its ends
   falling to #9EA0A5. Everything is in cqw so one frame serves every width. */
.mac-media{container-type:inline-size;width:100%}
.mac{position:relative;aspect-ratio:896/546;
  filter:drop-shadow(0 1.1cqw 2cqw rgba(12,14,20,.26)) drop-shadow(0 .3cqw .7cqw rgba(12,14,20,.16))}
.mac-lid{position:absolute;top:0;left:7.59cqw;right:7.59cqw;height:57.48cqw;
  background:#020202;border-radius:1.8cqw 1.8cqw 0 0;
  box-shadow:inset 0 0 0 1px #3A3B3E,inset 0 .16cqw .3cqw rgba(255,255,255,.16)}
/* key light from the upper left, same rule as the phone — a symmetric device
   reads synthetic. The screen div paints over this, so it only touches the bezel. */
.mac-lid::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;
  background:linear-gradient(152deg,rgba(255,255,255,.07),rgba(255,255,255,0) 24%,rgba(0,0,0,0) 70%,rgba(0,0,0,.10))}
.mac-cam{position:absolute;top:1.05cqw;left:50%;transform:translateX(-50%);
  width:.6cqw;height:.6cqw;border-radius:50%;
  background:radial-gradient(circle at 36% 32%,#243048,#0A0C12 70%)}
/* The screen is a working Mac, not a void: menu bar, then Chrome maximized, then
   the page filling every remaining pixel — her rule from the reference screenshot,
   where no black glass shows around the site. The display plays a 1512pt 14",
   so inside the screen --u = screen-width/1512; the shared .chrome-* rows scale
   themselves. Menu bar is 24pt like the real one. */
.mac-screen{position:absolute;top:2.79cqw;left:8.82cqw;right:8.82cqw;bottom:4.69cqw;
  border-radius:.55cqw;background:#000;overflow:hidden;
  display:flex;flex-direction:column;--u:.05447cqw}
.mac-menubar{height:calc(24*var(--u));background:#F4F4F6;flex:0 0 auto;
  display:flex;align-items:center;gap:calc(11*var(--u));padding:0 calc(12*var(--u));
  font-family:var(--font-utility);font-size:max(4px,calc(10*var(--u)));color:#1D1D1F;
  white-space:nowrap;overflow:hidden}
.mac-menubar b{font-weight:700}
.mac-menubar .mb-apple{width:calc(11*var(--u));height:calc(11*var(--u));fill:#1D1D1F;flex:0 0 auto}
.mac-menubar .mb-right{margin-left:auto;display:flex;align-items:center;gap:calc(9*var(--u))}
.mac-menubar .mb-ic{width:calc(11*var(--u));height:calc(11*var(--u));fill:currentColor;flex:0 0 auto}
.mac-menubar .mb-batt{width:calc(17*var(--u))}
/* the page under the chrome lands at ~1.72; captures run 1.77-2.03, so cover from
   the top — a site cropping at the fold is what a real screen does anyway */
.mac-page{position:relative;flex:1;min-height:0;background:#fff;overflow:hidden}
.mac-page img.poster,.mac-page video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top center}
.mac-base{position:absolute;left:0;right:0;bottom:0;height:3.47cqw;
  border-radius:.3cqw .3cqw 5.6cqw 5.6cqw / .3cqw .3cqw 2.6cqw 2.6cqw;
  background:linear-gradient(#B1B3BA 0 40%,#A9ABB2 50%,#83848A 62%,#5E5F63 76%,#56575C 82%,#97989D 90%,#6E6F74 100%)}
/* the ends fall off darker — the right a touch more, the same key light again */
.mac-base::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;
  background:linear-gradient(90deg,rgba(0,0,0,.14),rgba(0,0,0,0) 7%,rgba(0,0,0,0) 93%,rgba(0,0,0,.20))}
.mac-base::before{content:"";position:absolute;top:0;left:50%;transform:translateX(-50%);
  width:14.5cqw;height:1.15cqw;border-radius:0 0 999px 999px;
  background:linear-gradient(90deg,#9EA0A5,#EDEFF4 14%,#F2F4F9 86%,#9EA0A5)}

/* ------------------------------------------------ disciplines */
.panels{display:flex;gap:calc(var(--space)*1.5);height:min(72vh,620px)}
.panel{position:relative;flex:1 1 0;min-width:0;border-radius:var(--r-media);overflow:hidden;cursor:pointer;border:1px solid var(--line);
  transition:flex-grow var(--motion-slow) var(--ease-enter);background:var(--bg-raised)}
.panel.active{flex-grow:8}
.panel img,.panel video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(.94)}
.panel::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(18,35,32,0) 38%,rgba(18,35,32,.85) 100%);
  transition:opacity var(--motion-base) var(--ease-standard)}
.panel video{opacity:0;transition:opacity var(--motion-base) var(--ease-standard);z-index:1}
/* .v-live is stamped by JS the moment play() resolves: the clip shows whenever it is
   actually running — active or collapsed — and the poster img holds the frame anywhere
   playback can't start (Low Power Mode, reduced motion, data saver) */
.panel.has-video.v-live video{opacity:1}
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
  /* the open panel's scrim starts much higher on a phone (2026-08-19: "the gradient
     doesn't go high enough so the text is a little hard to read") — 360px of panel
     holds three lines of content, and the desktop 38% start left them on raw photo */
  .panel.active::after{background:linear-gradient(180deg,rgba(18,35,32,0) 6%,rgba(18,35,32,.62) 45%,rgba(18,35,32,.92) 100%)}
  .panel-collapsed-label{writing-mode:horizontal-tb;transform:translateX(-50%);bottom:auto;top:50%;margin-top:-.5em}}
/* press-and-hold on touch peeks at the photo: text and scrim lift while held
   (2026-08-19 her ask). Hover devices don't need it — nothing covers the image
   until the panel is active, and a mouse can simply move away. */
@media (hover:none){
  .panel,.panel img{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}
  .panel.peek::after,.panel.peek .panel-content,.panel.peek .panel-collapsed-label{opacity:0}
}

/* ------------------------------------------------ story */
.story{margin:0}
/* capped at its natural width so it is never upscaled — a soft GIF would undo the point */
.story img{width:100%;max-width:1000px;height:auto}
/* the stacked cut is a different shape, and <source> carries no dimensions — without this
   the phone reserves the wide aspect and the page jumps when the GIF lands */
@media (max-width:760px){.story img{aspect-ratio:660/1060;max-width:none}}
/* night: the GIF's background is the DAY cream, baked into its pixels so it can sit
   seamlessly on the day page. Rather than repaint her artwork, night frames it as the
   object it is — a notebook page, lit on a dark desk. */
[data-theme="night"] .story img{border-radius:var(--r-media);box-shadow:0 16px 44px var(--shadow-mid)}

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
/* ---- the longer story (2026-08-25 her ask): the headline stands alone and the writing
   folds away. The reveal is the 0fr→1fr grid-row trick — the browser animates the row,
   the inner div clips, nothing is ever measured in JS. The paragraphs also drift in a
   few px and fade, so opening reads as the text arriving, not a box resizing. */
.about-more{display:grid;grid-template-rows:0fr;transition:grid-template-rows var(--motion-slow) var(--ease-standard)}
/* visibility rides the fade with a delay so screen readers and find-in-page skip the
   folded copy, but the close animation still shows the text on its way out */
.about-more>div{overflow:hidden;opacity:0;transform:translateY(-6px);visibility:hidden;
  transition:opacity var(--motion-slow) var(--ease-standard),transform var(--motion-slow) var(--ease-standard),
    visibility 0s var(--ease-standard) var(--motion-slow)}
.about-more.open{grid-template-rows:1fr}
.about-more.open>div{opacity:1;transform:none;visibility:visible;transition-delay:0s}
.rm-mode .about-more,.rm-mode .about-more>div{transition:none}
/* .btn-link was drawn for <a>; on a real <button> the UA's own border and padding come
   with it and read as a boxed control — strip everything but the drawn underline */
.about-toggle{margin-bottom:calc(var(--space)*4);position:relative;
  border:0;border-bottom:1.5px solid var(--teal-baby);padding:0 0 7px;background:none}
.about-toggle:hover{border-color:var(--ink-blue)}
}
/* ---- education (2026-08-25 her ask): the Block M and the Google G, official marks at
   full colour — credentials, so they sit small beside their words above a hairline,
   the same quiet register as the client wall. The marks are height-locked so the two
   sit optically equal whatever their native boxes are. */
.about-creds{display:flex;flex-wrap:wrap;gap:calc(var(--space)*3) calc(var(--space)*7);
  border-top:1px solid var(--line);padding-top:calc(var(--space)*4);
  margin:calc(var(--space)*1) 0 calc(var(--space)*4);max-width:62ch}
.about-cred{display:flex;align-items:center;gap:14px}
.about-cred img{height:30px;width:auto;flex:none}
.about-cred .cred-name{font-weight:500;color:var(--text-primary);font-size:.92rem;line-height:1.35}
.about-cred .cred-detail{color:var(--text-secondary);font-size:.83rem;line-height:1.4}
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
  /* no tap-highlight: iOS paints its dark rectangle over the pot's whole box on touch
     (2026-08-19 "i dont like that it has this dark background") — the rock is the feedback */
  -webkit-tap-highlight-color:transparent;
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
@media (max-width:640px){footer{flex-direction:column;gap:10px;text-align:center;
  /* the fixed Night/Day pill lives in the bottom-left corner — without this the last
     footer line scrolls in underneath it */
  padding-bottom:calc(var(--space)*11)}
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

/* ---- the design-system door (2026-08-26 "I just want it to be an icon"): one round
   outlined control in the hero band's top-right corner, sitting on the band's own
   padding grid. No label at rest — the brush glyph is the whole button. The words live
   in the CURSOR (2026-08-28 her ask): hovering rolls the dot out into the same pill
   the case cards use for "I'm curious", reading "View design system" — data-curious
   carries the label, the cursor code does the rest. Hairline border, matching the
   theme-toggle ring, is what "delicate" means on this site. */
/* the case-study corner arrows (see edgeArrows): the walkthrough pages' round arrow buttons, hiding with the nav */
.cs-edge{position:fixed;top:22px;z-index:60;width:48px;height:48px;border-radius:50%;border:1px solid #2a2f3a;display:grid;place-items:center;
  background:rgba(15,16,19,.75);color:#e9eaee;transition:transform .6s cubic-bezier(.22,1,.36,1),opacity .5s ease,border-color .2s}
.cs-edge svg{width:20px;height:20px}
.cs-edge.prev{left:24px}.cs-edge.next{right:24px}
.cs-edge:hover{border-color:#5a6070}
.cs-edge:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
body:has(.nav-wrap.nav-hidden) .cs-edge{transform:translateY(-160%);opacity:0;pointer-events:none}
@media (max-width:700px){.cs-edge{display:none}}
.ds-link{position:absolute;top:clamp(28px,4.5vw,56px);right:clamp(28px,4.5vw,56px);z-index:3;
  width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  border:1px solid currentColor;color:var(--text-on-deep);
  transition:background-color var(--motion-fast) var(--ease-standard),
             border-color var(--motion-fast) var(--ease-standard),
             color var(--motion-fast) var(--ease-standard)}
.cs-hero-band.light .ds-link{color:var(--accent)}
.ds-link:hover,.ds-link:focus-visible{background:var(--accent-press);border-color:var(--accent-press);
  color:var(--text-on-accent)}
.ds-link svg{width:15px;height:15px;display:block}
@media (max-width:600px){
  .ds-link{width:32px;height:32px}
  .ds-link svg{width:13px;height:13px}
}
/* below 900px the title's first line can run under the circle (Stack's "Budgeting that"
   did) — clear its lane, but only when the band actually carries the button. Desktop
   widths are left alone so the twoLine() fitting keeps measuring the real column. */
@media (max-width:900px){
  .cs-hero-band:has(.ds-link) .cs-kicker,
  .cs-hero-band:has(.ds-link) .cs-title{padding-right:44px}
}

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

/* width:100% because the auto side-margins switch off flex-stretch inside .cs-section,
   and a band that shrink-wraps is sized by its CAPTION — so browser-framed videos
   (absolutely-positioned contents, no intrinsic width) rendered 755/728/576px wide in
   one scroll (2026-08-28 "jumping around in size"). Full width pins every band to the
   same 1240px rail the hero band sits on. */
.cs-media-band{width:100%;max-width:1240px;margin:calc(var(--space)*7) auto 0;padding:0 calc(var(--space)*2)}
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
/* the empty slot: a phone-shaped dashed outline (same ratio and corner radius as
   .phone) holding a sentence instead of a screen */
.cs-phone-none{width:100%;max-width:218px;aspect-ratio:1.1036/2.2705;box-sizing:border-box;
  border:1.5px dashed var(--line);border-radius:16.85%/8.19%;
  display:flex;align-items:center;justify-content:center;padding:14%}
.cs-phone-none p{font-family:var(--font-utility);font-size:.85rem;line-height:1.55;
  color:var(--text-secondary);text-align:center;text-wrap:balance;margin:0}
.cs-media-inner.deep .cs-phone-none{border-color:var(--line-on-deep)}
.cs-media-inner.deep .cs-phone-none p{color:var(--text-on-deep-secondary)}
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

/* ---- one section at a time (2026-08-25, from the Framer reference she sent) ------------
   Each .cs-section is sized to own the screen — min-height centres its content on the
   viewport — and app.js drives a scroll-LINKED crossfade over it: a section materialises
   as it approaches the middle of the screen and dissolves as it leaves, so the reader
   always holds exactly one thought. Inside these sections the old one-shot .fade
   entrances are retired (the section IS the fade — two fades stacked read as flicker).
   .cs-scroll is stamped by app.js only when the effect actually runs, so reduced motion
   and no-JS get plain stacked sections with the classic entrances. */
.cs-section{min-height:86svh;display:flex;flex-direction:column;justify-content:center;
  padding:calc(var(--space)*4) 0}
.cs-section .cs-row{padding-top:0}
.cs-scroll .cs-section{will-change:opacity}
.cs-scroll .cs-section .fade{opacity:1;transform:none;transition:none}
/* media keeps its NATURAL size (2026-08-25: the svh caps that squeezed a section onto
   one screen made the phone screens "way too small" — reverted). A tall section simply
   scrolls; the crossfade, not shrinking, is what delivers one-section-at-a-time. */
/* phones: content runs taller than the screen, so pinning each section to a viewport
   would leave dead cream between them — the crossfade still runs, sizing goes back to
   natural flow */
@media (max-width:820px){.cs-section{min-height:0;padding:calc(var(--space)*8) 0 calc(var(--space)*2)}}

/* The next-project tease, her spec: the pop-up shows up IN the box. On hover the
   card grows 128px upward (negative margin + equal extra bottom padding, so the
   page below never moves), the text — anchored to the card's top — rides up with
   the top edge, and the next case's cover device rises inside the card from its
   bottom edge, clipped by the card's own rounded corners. The 144px of margin
   above the card is the room the expansion grows into. */
.cs-next{max-width:1240px;margin:calc(var(--space)*18) auto calc(var(--space)*4);padding:0 calc(var(--space)*2)}
.cs-next-card{position:relative;overflow:hidden;display:flex;justify-content:space-between;align-items:flex-start;gap:20px;border-radius:24px;padding:clamp(24px,4vw,48px);text-decoration:none;
  background:var(--bg-deep);color:var(--text-on-deep);
  transition:margin var(--motion-base) var(--ease-standard),padding var(--motion-base) var(--ease-standard)}
.cs-next-copy{position:relative;z-index:1}
/* the plain tools page (renderSimpleCase) */
.tools-page{max-width:980px;margin:0 auto;padding:calc(var(--space)*20) calc(var(--space)*6) calc(var(--space)*12)}
.tp-title{font-family:var(--font-display);font-weight:600;font-size:clamp(2.4rem,5.2vw,4.2rem);line-height:1.05;letter-spacing:-.02em;color:var(--ink-blue)}
.tp-lead{margin-top:calc(var(--space)*3);max-width:52ch;font-size:clamp(1.05rem,1.6vw,1.25rem);line-height:1.6;color:var(--text-secondary)}
.tools-page .tp-tool{margin:calc(var(--space)*14) 0 0;padding:0;max-width:none}   /* not the global section padding */
.tp-h{font-family:var(--font-display);font-weight:600;font-size:clamp(1.5rem,2.6vw,2rem);line-height:1.2;color:var(--ink-blue)}
.tp-p{margin-top:calc(var(--space)*1.5);max-width:56ch;font-size:1.05rem;line-height:1.65;color:var(--text-secondary)}
.tp-tool .mac-media{margin-top:calc(var(--space)*5)}
@media (max-width:760px){.tools-page{padding:calc(var(--space)*14) calc(var(--space)*3) calc(var(--space)*8)}.tools-page .tp-tool{margin-top:calc(var(--space)*10)}}
.cs-next-card .k{font-family:var(--font-utility);font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--accent-bright);margin-bottom:10px}
.cs-next-card .t{font-family:var(--font-display);font-size:clamp(1.5rem,3.2vw,2.6rem);line-height:1.15}
.cs-next-peek{position:absolute;z-index:0;top:100%;right:clamp(28px,6vw,84px);pointer-events:none;
  transition:transform var(--motion-base) var(--ease-standard)}
.cs-next-peek.is-phone{width:190px}
.cs-next-peek.is-mac{width:470px}
@media (hover:hover) and (min-width:900px) and (prefers-reduced-motion:no-preference){
  .cs-next-card:hover,.cs-next-card:focus-visible{margin-top:-128px;padding-bottom:calc(clamp(24px,4vw,48px) + 128px)}
  /* a fixed 190px slice rises whatever the device: with top:100% the visible
     height IS the translate, so phone and MacBook tease equally */
  .cs-next-card:hover .cs-next-peek,.cs-next-card:focus-visible .cs-next-peek{transform:translateY(-190px)}
}

/* A play button is .play-btn + .btn.icon.solid — the shape, size and colour all come from
   the button system, and this rule only says where it sits and when it appears. It carries
   .solid rather than the sheet's teal outline because it is the one control that does not
   sit on the page cream: it floats over a screenshot or a video frame, and a transparent
   pill with a 1.5px line disappears against arbitrary artwork. A filled terracotta disc is
   the same system saying the same thing on an unknown background. */
.play-btn{position:absolute;bottom:16px;right:16px;z-index:6;display:none}
.btn-ic{display:block;width:40%;height:40%;fill:currentColor}
/* min-width/height too, or .btn's own min-height wins and the disc turns into a stadium */
.phone-media .play-btn.icon{bottom:9cqw;right:50%;transform:translateX(50%);
  width:36px;min-width:36px;height:36px;min-height:36px;font-size:.8rem}
.rm-mode .play-btn{display:inline-flex}
/* the button system brings its own teal focus ring (see .btn:focus-visible); this is the
   catch-all for every other link and control on the site */
a:focus-visible,button:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:4px}

/* settle fail-safe: nothing ever stays invisible, even if transitions never run */
.settled .w{opacity:1;transform:none;filter:none}
.settled .fade{opacity:1;transform:none}
/* flora and canvas keep their translateX(-50%) centering — force OPACITY only there;
   transform:none on either shoves it half a viewport right (found the hard way) */
.settled .hero h1,.settled .hero-cta-row{opacity:1;transform:none}
.settled .hero-flora{opacity:1}

/* reduced motion */
.rm-mode .w,.rm-mode .fade{opacity:1;transform:none;filter:none;transition:none}
.rm-mode .hero h1,.rm-mode .hero-cta-row{opacity:1;transform:none;transition:none}
.rm-mode .hero-flora,.rm-mode .stick-cv{opacity:1;transition:none}
.rm-mode .wm-m,.rm-mode .wm-k,.rm-mode .wm-d{animation:none;transition:none}
.rm-mode .wordmark:hover .wm-m,.rm-mode .wordmark:hover .wm-k{transform:none}
.rm-mode .wordmark:hover .wm-d{opacity:1;transform:none}
.rm-mode .nav-links a::after,.rm-mode .btn::after,.rm-mode .theme-toggle::after{transition:none}
.rm-mode .hero-line span.hs,.rm-mode .hero-line:hover span.hs{color:var(--ink-blue);transition:none}
@media (prefers-reduced-motion:reduce){.hero-line span.hs:hover,.hero-line .hs.waving .ch{transform:none}}
.rm-mode .hero-line span.hs:hover,.rm-mode .hero-line .hs.waving .ch{transform:none}
@media (prefers-reduced-motion:reduce){
  .w,.fade{opacity:1 !important;transform:none !important;filter:none !important;transition:none !important}
  .hero h1,.hero-cta-row{opacity:1 !important;transform:none !important;transition:none !important}
  .hero-flora,.stick-cv{opacity:1 !important;transition:none !important}
  .wm-m,.wm-k,.wm-d{animation:none !important;transition:none !important;transform:none !important;opacity:1 !important}
  .hero-line span.hs{transition:none !important}
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

  /* ---- day/night (2026-08-19). The boot script in <head> already stamped the right
     theme before paint; this is the live half: the labelled toggle, the smooth
     cross-fade (skipped under reduced motion), and — while no explicit choice is
     stored — a timer that flips the site the moment the viewer's own sun rises or
     sets mid-visit. mk-theme tells the stickman to re-read his ink. */
  const root=document.documentElement;
  const tgl=document.querySelector('.theme-toggle');
  let themeAnimT=0;
  function setTheme(mode,anim){
    const apply=()=>{
      if(mode==='night')root.setAttribute('data-theme','night');else root.removeAttribute('data-theme');
      if(tgl)tgl.setAttribute('aria-label',mode==='night'?'Switch to day mode':'Switch to night mode');
      dispatchEvent(new Event('mk-theme'));
    };
    if(anim&&!rmActive()){
      /* one snapshot cross-fade where the API exists; the per-element .theme-anim
         class only for engines without it */
      if(document.startViewTransition){document.startViewTransition(apply);return;}
      root.classList.add('theme-anim');clearTimeout(themeAnimT);
      themeAnimT=setTimeout(()=>root.classList.remove('theme-anim'),900);
    }
    apply();
  }
  if(tgl){
    tgl.setAttribute('aria-label',root.getAttribute('data-theme')==='night'?'Switch to day mode':'Switch to night mode');
    tgl.addEventListener('click',()=>{
      const next=root.getAttribute('data-theme')==='night'?'day':'night';
      /* the timestamp is what lets the boot script expire this at the next sunrise or
         sunset — a choice made at noon should not still be pinning the site at 1am */
      try{localStorage.setItem('mk-theme',next);localStorage.setItem('mk-theme-at',String(Date.now()))}catch(e){}
      setTheme(next,true);
    });
  }
  (function(){
    const sun=window.__mkSun;
    if(!sun||!sun.next||!sun.mode)return;
    const wait=sun.next-Date.now();
    /* the sun takes the site back mid-visit WHATEVER is stored: a toggle override only
       lasts until the next solar event, so the timer clears it and applies the sun's
       own mode (not a blind flip — a viewer already in that mode just stays there) */
    if(wait>0&&wait<=864e5)setTimeout(()=>{
      try{localStorage.removeItem('mk-theme');localStorage.removeItem('mk-theme-at')}catch(e){}
      setTheme(sun.mode,true);
    },wait);
  })();

  /* hero word-by-word reveal */
  const hero=document.querySelector('.hero');
  if(hero){
    /* split into per-word spans, recursing through elements so inline markup
       (the <em> in the hero line) survives the rewrite */
    document.querySelectorAll('.reveal-words').forEach(el=>{
      let seq=Number(el.dataset.seq||0);
      /* 900ms base: the pen starts while the headline (450ms->1.4s) settles. The hero
         paragraph overrides it via data-base so the architecture line only starts
         writing once the blooms have fully faded in (~1.8s) — the eyebrow keeps 900,
         which is the cue the blooms themselves resolve on. */
      const base=Number(el.dataset.base||900);
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
              w.style.transitionDelay=(base+seq++*55+hold)+'ms';w.textContent=tok;frag.appendChild(w);
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
    /* the bio lines wave like the headline (see .hero-line .hs .ch). Letters go INSIDE the reveal's word spans, so the
       words still arrive the same way and the clay figure still reads each word as one block of ground */
    if(matchMedia('(hover:hover)').matches)hero.querySelectorAll('.hero-line .hs').forEach(hs=>{
      hs.querySelectorAll('.w').forEach(w=>{const t=w.textContent;w.textContent='';[...t].forEach(ch=>{const c=document.createElement('span');c.className='ch';c.textContent=ch;w.appendChild(c)})});
      const chs=[...hs.querySelectorAll('.ch')],st=Math.min(26,700/Math.max(1,chs.length));   // the whole line rises in ~0.7s, however long it is
      hs.addEventListener('mouseenter',()=>{if(!rmActive())chs.forEach((c,i)=>c.style.transitionDelay=(i*st)+'ms');hs.classList.add('waving')});
      hs.addEventListener('mouseleave',()=>{if(!rmActive())chs.forEach((c,i)=>c.style.transitionDelay=((chs.length-1-i)*st)+'ms');hs.classList.remove('waving')});
    });
    document.querySelectorAll('.lively').forEach(el=>{
      const txt=el.textContent;el.textContent='';
      [...txt].forEach(ch=>{const c=document.createElement('span');c.className='ch';c.textContent=ch;el.appendChild(c)});
      const stagger=26;
      el.addEventListener('mouseenter',()=>{if(!rmActive()){[...el.querySelectorAll('.ch')].forEach((c,i)=>c.style.transitionDelay=(i*stagger)+'ms')}el.classList.add('waving')});
      el.addEventListener('mouseleave',()=>{if(!rmActive()){const chs=[...el.querySelectorAll('.ch')];chs.forEach((c,i)=>c.style.transitionDelay=((chs.length-1-i)*stagger)+'ms')}el.classList.remove('waving')});
    });
    requestAnimationFrame(()=>setTimeout(()=>hero.classList.add('revealed'),120));
    /* the hand-off (see .handoff): the headline lands ~1.4s in, waves once (rises in the accent, falls
       back), then shrinks while the bio grows. mk-hero-settled tells the clay figure the headline is at
       its final size, so she spawns on the d where it will stay. */
    const settleHero=()=>{window.__mkHeroSettled=true;dispatchEvent(new Event('mk-hero-settled'))};
    const nameEl=hero.querySelector('h1 .lively');
    if(rmActive()||!nameEl){hero.classList.add('handoff');settleHero()}
    else setTimeout(()=>{
      const chs=[...nameEl.querySelectorAll('.ch')],run=chs.length*26;
      chs.forEach((c,i)=>c.style.transitionDelay=(i*26)+'ms');nameEl.classList.add('waving');
      setTimeout(()=>{
        chs.forEach((c,i)=>c.style.transitionDelay=((chs.length-1-i)*26)+'ms');nameEl.classList.remove('waving');
        setTimeout(()=>{hero.classList.add('handoff');setTimeout(settleHero,950)},run+350);
      },run+450);
    },1600);
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
    const nudge=(e,mult)=>{
      if(rmActive())return;
      /* push it away from the side you came in on, so it reacts to you rather than always
         falling the same way */
      const r=pot.getBoundingClientRect();
      const dir=(e&&typeof e.clientX==='number'&&e.clientX>r.left+r.width/2)?-1:1;
      s.kick(dir*KICK*(mult||1));
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
    /* the koi lands here (fish.js announces its splashdown; detail.x is where it hit,
       so the pot tips away from the impact). A falling fish outranks a passing cursor,
       hence the harder kick — the spring's MAX cap still holds it under tipping. */
    addEventListener('mk-pot-kick',e=>{const d=(e&&e.detail)||{};
      nudge(typeof d.x==='number'?{clientX:d.x}:null,1.7)});
  }

  /* ---- the longer story (2026-08-25) --------------------------------------------------
     The about copy folds behind its headline; the button flips the .open class (CSS does
     the motion) and trades labels — data-more/data-less carry both faces, and data-hand
     is re-stamped so the handwriting hover always matches the visible words. */
  const at=document.querySelector('.about-toggle');
  if(at){
    const box=document.getElementById('about-more');
    at.addEventListener('click',()=>{
      const open=box.classList.toggle('open');
      at.setAttribute('aria-expanded',String(open));
      const label=open?at.dataset.less:at.dataset.more;
      at.textContent=label;
      /* data-hand only carries glyphs Madhu Hand covers — same filter as the CTAs */
      at.setAttribute('data-hand',label.replace(/[^ '!,.A-Za-z\\u2019]/g,'').trim().toUpperCase());
    });
  }

  /* absolute fail-safe: everything visible even if transitions never tick */
  setTimeout(()=>document.body.classList.add('settled'),1900);

  const heroSay=document.querySelector('.hero-cta-row .btn.solid');
  if(heroSay)new IntersectionObserver(es=>es.forEach(e=>document.body.classList.toggle('hero-cta-on',e.isIntersecting))).observe(heroSay);

  /* the nav hides on the way down and comes back on the way up — the same rules as the walkthrough
     pill (walkthrough.js): hidden past 140px going down, back after 40px of scrolling up, at the top,
     or whenever the pointer comes within 90px of the top. Never hidden while it holds keyboard focus. */
  const navW=document.querySelector('.nav-wrap');
  if(navW){
    let navY=scrollY,navUp=0,navHover=false;
    addEventListener('scroll',()=>{const y=scrollY,d=y-navY;navY=y;
      if(d>0){navUp=0;if(y>140&&!navHover&&!navW.contains(document.activeElement))navW.classList.add('nav-hidden')}
      else{navUp-=d;if(navUp>40||y<140)navW.classList.remove('nav-hidden')}},{passive:true});   // scrolling up always brings it back (her ask), Reels included
    /* only a real mouse near the top reveals it: phones send a mousemove with every tap, which kept popping it up */
    if(matchMedia('(hover:hover) and (pointer:fine)').matches)addEventListener('mousemove',e=>{const near=e.clientY<90;if(near===navHover)return;navHover=near;if(near)navW.classList.remove('nav-hidden')},{passive:true});
    navW.addEventListener('focusin',()=>navW.classList.remove('nav-hidden'));
  }

  /* one shared loader for the vendored GSAP files: the logo wisps and the phone work-list focus both
     ask for GSAP, and whichever asks first fetches it; the other waits on the same promise */
  const vendorJS=f=>(window.__vjs=window.__vjs||{})[f]||(window.__vjs[f]=new Promise((res,rej)=>{const sc=document.createElement('script');sc.src='vendor/'+f+'?v=${BUILD_V}';sc.onload=res;sc.onerror=rej;document.head.appendChild(sc)}));

  /* the client logos arrive as wisps of dots (see .brands-wisp). window.__wisp holds every dial so the
     local tweaker (studies/tweaker-logos/) can drive it; a 'tweak' event updates it and replays. */
  const brandRow=document.querySelector('.brands-row');
  if(brandRow&&!rmActive()&&'IntersectionObserver' in window){
    const W=window.__wisp=Object.assign({step:3,dot:1.6,scatter:170,curl:36,dur:1.7,stagger:.11,spread:.45,lift:.6},${JSON.stringify(TWEAKS['logo-wisps'] || {})},window.__wisp||{});
    const marks=[...brandRow.querySelectorAll('.brand')],PAD=220;
    const hide=()=>marks.forEach(b=>{b.style.transition='opacity .6s ease';b.style.opacity='0'});
    brandRow.classList.add('gs-roll');
    let cv=null,tl=null,data=null;
    /* every dot of a mark: its mask drawn "contain" into the mark's own box, read back on a grid */
    const sample=b=>new Promise(res=>{
      const m=getComputedStyle(b).getPropertyValue('--logo').match(/url\\(["']?([^"')]+)/);if(!m)return res(null);
      const img=new Image();img.onerror=()=>res(null);img.onload=()=>{
        const r=b.getBoundingClientRect(),w=Math.max(1,Math.round(r.width)),h=Math.max(1,Math.round(r.height)),c=document.createElement('canvas');c.width=w;c.height=h;
        const x=c.getContext('2d'),k=Math.min(w/img.naturalWidth,h/img.naturalHeight),dw=img.naturalWidth*k,dh=img.naturalHeight*k;
        x.drawImage(img,(w-dw)/2,(h-dh)/2,dw,dh);const D=x.getImageData(0,0,w,h).data,pts=[];
        for(let yy=0;yy<h;yy+=W.step)for(let xx=0;xx<w;xx+=W.step)if(D[(yy*w+xx)*4+3]>110)pts.push(xx,yy);
        res({b,pts,col:getComputedStyle(b).backgroundColor,rnd:pts.map(()=>Math.random())});};img.src=m[1];});
    const run=()=>{
      if(tl)tl.kill();if(cv)cv.remove();hide();brandRow.classList.remove('gs-roll');
      const rr=brandRow.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);
      cv=document.createElement('canvas');cv.className='brands-wisp';cv.setAttribute('aria-hidden','true');
      /* the canvas spans the row plus room for the drifting dots, but never past the screen's own edges: wider,
         and iPhone Safari zoomed the whole page out while the wisps played ("glitchy and keeps zooming out") */
      const padL=Math.min(PAD,Math.max(0,rr.left)),padR=Math.min(PAD,Math.max(0,document.documentElement.clientWidth-rr.right)),cw=rr.width+padL+padR,ch=rr.height+PAD*2;
      Object.assign(cv.style,{left:-padL+'px',top:-PAD+'px',width:cw+'px',height:ch+'px'});
      cv.width=cw*dpr;cv.height=ch*dpr;brandRow.appendChild(cv);
      const ctx=cv.getContext('2d');ctx.scale(dpr,dpr);
      const ms=data.filter(Boolean).map(d=>{const r=d.b.getBoundingClientRect();return Object.assign({},d,{ox:r.left-rr.left+padL,oy:r.top-rr.top+PAD,p:0,f:1})});
      const draw=()=>{ctx.clearRect(0,0,cv.width,cv.height);
        for(const m of ms){if(!m.f||!m.p)continue;ctx.fillStyle=m.col;
          for(let i=0,n=m.pts.length;i<n;i+=2){const r=m.rnd[i>>1],d=r*W.spread,q=Math.min(1,Math.max(0,(m.p-d)/(1-W.spread)));if(!q)continue;
            const e=1-Math.pow(1-q,3),tx=m.ox+m.pts[i],ty=m.oy+m.pts[i+1],ph=r*6.283,
              sx=tx-W.scatter*(.35+.65*((r*7.31)%1)),sy=ty+(((r*3.17)%1)-.5)*W.scatter*W.lift,wob=Math.sin(q*Math.PI)*W.curl*(1-e*.6);
            const x=sx+(tx-sx)*e+Math.cos(ph)*wob*.5,y=sy+(ty-sy)*e+Math.sin(ph+q*4)*wob,s=W.dot*(1+(1-e)*.7);
            ctx.globalAlpha=Math.min(1,q*2.2)*(.5+.5*e)*m.f;ctx.fillRect(x-s/2,y-s/2,s,s);}}
        ctx.globalAlpha=1;};
      tl=gsap.timeline({onUpdate:draw,onComplete:()=>{cv&&cv.remove();cv=null}});
      ms.forEach((m,i)=>{
        tl.to(m,{p:1,duration:W.dur,ease:'none'},i*W.stagger);
        /* hand-over: the crisp logo fades up as its dots fade out */
        tl.add(()=>{m.b.style.opacity=''},i*W.stagger+W.dur-.15);
        tl.to(m,{f:0,duration:.5,ease:'power1.out'},i*W.stagger+W.dur-.1);
      });
    };
    /* "the logos take too long to load in, so I scroll past" (2026-10-23): GSAP and every mark's dots are made
       READY a screen before the row arrives, and the wisps PLAY the moment its first pixel shows (it used to start
       fetching only once the row was 12% in). The wisps' own pace is unchanged: "I just wanted the animation to start faster" */
    let ready=null,seen=false;
    const prep=()=>ready||(ready=vendorJS('gsap.min.js').then(()=>Promise.all(marks.map(sample))).then(d=>{data=d},e=>{brandRow.classList.remove('gs-roll');marks.forEach(b=>b.style.opacity='');throw e}));
    const near=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){near.disconnect();prep().catch(()=>{})}},{rootMargin:'100% 0px'});
    near.observe(brandRow);
    const bio=new IntersectionObserver(es=>{
      if(seen||!es.some(e=>e.isIntersecting))return;seen=true;bio.disconnect();
      prep().then(run,()=>{});
    });
    bio.observe(brandRow);
    addEventListener('tweak',e=>{Object.assign(W,e.detail.values||{});if(data&&window.gsap){clearTimeout(run.t);run.t=setTimeout(()=>Promise.all(marks.map(sample)).then(d=>{data=d;run()}),250)}});
    addEventListener('tweak-replay',()=>{if(data&&window.gsap)run()});
  }

  /* SWIPE / SCROLL (see .work-sec): flips the work section's view, remembers it in this browser, and tells the
     deck (it lays out when shown) and the phone list (snapping, focus) to catch up */
  const workEl=document.querySelector('.work-sec');
  if(workEl){
    const btns=[...workEl.querySelectorAll('.view-btn')];
    const setView=(v,save)=>{
      workEl.dataset.view=v;btns.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===v)));
      if(save)try{localStorage.setItem('mk-work-view',v)}catch(e){}
      dispatchEvent(new Event('mk-work-view'));if(window.ScrollTrigger)ScrollTrigger.refresh();
    };
    let saved=null;try{saved=localStorage.getItem('mk-work-view')}catch(e){}
    if(saved==='list'||saved==='deck')setView(saved,false);
    btns.forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view,true)));
    const dock=workEl.querySelector('.view-dock');
    if(dock){document.body.appendChild(dock);dock.classList.add('floating');
      const head=workEl.querySelector('.work-head'),bar=dock.querySelector('.view-toggle');
      let inWork=false,headGone=false,grown=false;
      const sync=()=>{const on=inWork&&headGone;dock.classList.toggle('on',on);
        if(on&&!grown){grown=true;if(!rmActive()){bar.classList.add('materialize');bar.querySelector('.view-btn').addEventListener('animationend',()=>bar.classList.remove('materialize'),{once:true})}}};
      new IntersectionObserver(es=>es.forEach(e=>{inWork=e.isIntersecting;sync()}),{rootMargin:'-20% 0px -20% 0px'}).observe(workEl);
      /* the head is "gone" once it has slipped up under the nav band (the top 70px), not before you reach it */
      new IntersectionObserver(es=>es.forEach(e=>{headGone=!e.isIntersecting&&e.boundingClientRect.top<innerHeight/2;sync()}),{rootMargin:'-70px 0px 0px 0px'}).observe(head)}
  }

  /* THE SWIPE DECK (see .sdeck), her v2 lane model. pos is the one source of truth: a continuous index of the
     card at the centre. For card i, t = i - pos and p = max(0, 1 - |t|) is its progress toward the centre:
       y     = lane + p x (centre - lane)        lanes 30% (top) and 72% (bottom) of the stage
     Lanes as in her reference video (she chose "match the video"): the two neighbours always sit in OPPOSITE
     corners and the pairing flips with each swipe, so a card peeks from one lane on the right and the other on
     the left, switching only as it passes the centre (p = 1, where its lane doesn't show).
       scale = side + (1 - side) x p             side 0.5
       x     = sign(t) x |t| x R                 (R past one card: the next cards queue further out)
     R = 0.75 x card + gap keeps the active card's edge and the incoming card's edge a constant gap apart through
     the whole drag; on wide screens R grows so only a ~7% slice of each neighbour peeks in. Release settles on
     the nearest card with a decelerating ease (no overshoot, rotation or fading); stops at both ends; vertical
     swipes and wheel stay with the page. */
  const sd=document.querySelector('.sdeck');
  if(sd){
    const stage=sd.querySelector('.sdeck-stage'),cards=[...stage.children],titleEl=sd.querySelector('.sdeck-title'),nameEl=titleEl.querySelector('.sdeck-name'),lineEl=titleEl.querySelector('.sdeck-line'),bar=sd.querySelector('.sdeck-progress'),segs=bar?[...bar.children]:[];
    const fill=i=>{nameEl.textContent=cards[i].dataset.name;lineEl.textContent=cards[i].dataset.title;
      if(sd.classList.contains('stack')&&dims[i])sd.style.setProperty('--tt',(stage.offsetTop+dims[i].cy+dims[i].h/2+tgNow)+'px')};
    let tgNow=18;
    const rm=rmActive(),num=n=>parseFloat(getComputedStyle(sd).getPropertyValue(n));
    let pos=0,S=300,H=400,W=400,R=300,R2=200,active=-1,tween=null,drag=null,suppress=false,wheelT=0;
    /* per-card geometry. Phones: every card the same square (S), centred at 51% of the stage, lanes 30%/72%.
       Laptops: each card its own media's size; R per card so each neighbour, wide or tall, peeks the same slice */
    let dims=[],top=0,bot=0,shift=0,nudging=false,touched=false;
    const setTitle=i=>{
      active=i;cards.forEach((c,k)=>c.setAttribute('aria-current',k===i?'true':'false'));
      if(rm||lineEl.textContent===cards[i].dataset.title){fill(i);return}
      titleEl.classList.add('swap');clearTimeout(setTitle.t);
      setTitle.t=setTimeout(()=>{fill(active);titleEl.classList.remove('swap')},130);
    };
    const place=v=>{
      pos=v;const side=num('--side')||.5;
      cards.forEach((c,i)=>{
        const t=i-v,a=Math.abs(t),p=Math.max(0,1-a),lane=t>0?(i%2?bot:top):(i%2?top:bot),d=dims[i];
        const Rs=t>0?d.Rr:d.Rl,x=shift+Math.sign(t)*(a<=1?a*Rs:Rs+(a-1)*R2),y=lane+p*(d.cy-lane),sc=side+(1-side)*p;
        c.style.transform='translate3d('+x.toFixed(2)+'px,'+y.toFixed(2)+'px,0) scale('+sc.toFixed(4)+')';c.style.zIndex=String(Math.round(p*10));
      });
      titleEl.classList.toggle('moving',!nudging&&Math.abs(v-Math.round(v))>.02);
      const near=Math.max(0,Math.min(cards.length-1,Math.round(v)));if(near!==active){setTitle(near);segs.forEach((b,k)=>{b.classList.toggle('on',k===near);b.classList.toggle('done',k<near)})}
    };
    const layout=()=>{
      W=sd.clientWidth;const side=num('--side')||.5,gap=(num('--gap')||6)/100*W,peek=(num('--peek')||7)/100*W;
      /* the tallest headline sets the reserved title height, so the card can be sized to leave room for it */
      if(!W)return;   // hidden (SCROLL view): laid out again when SWIPE is shown
      let th=0;titleEl.style.minHeight='0';titleEl.style.setProperty('--S',Math.min(W*(num('--aw')||73)/100,W)+'px');sd.classList.remove('side');
      cards.forEach((c,i)=>{fill(i);th=Math.max(th,titleEl.offsetHeight)});fill(Math.max(0,active));
      const avail=innerHeight-th-150;   // nav, section heading and breathing room
      const ah=(num('--ah')||75)/100;S=Math.max(160,Math.min(W*(num('--aw')||73)/100,avail*ah));   // ~73% of the width, or 75% of the room
      H=S/ah;   // the stage the lanes live in: the active card fills ah of its height
      R=Math.max(.75*S+gap,W/2-peek+side*S/2);R2=side*S+gap;
      /* the demo's height: dh of the screen, less if everything under/around it wouldn't fit (the stage is 'room' x it:
         space above for the top lane, plus the demo). Phones and tablets: headline UNDER the demo, as wide as the
         dial allows. Laptops 1000px+ (.side): the demo's centre sits at 34% of the width, at most 48% wide, and the
         headline takes the column to its right; the neighbours peek in at both screen edges, past that column.
         Dials (studies/tweaker-swipe/): dh, dw, lane, tgap, tw. */
      const sideM=W>=1000;sd.classList.toggle('side',sideM);sd.classList.remove('stack');
      const phone=W<761,dh=(num('--sd-dh')||58)/100,dw=sideM?.48:phone?.88:(num('--sd-dw')||80)/100,ln=num('--sd-lane'),lane=isNaN(ln)?(phone?.2:.28):ln,
        tgap=num('--sd-tgap'),tg=isNaN(tgap)?(phone?18:28):tgap;
      const above=Math.max(.18,lane+side/2-.5),room=above+1,cyF=above+.5;
      const under=sideM?0:th+tg;   // a side headline takes no height
      const Ht=Math.max(phone?220:200,Math.min(innerHeight*dh,(innerHeight-under-bar.offsetHeight-(phone?166:100))/room)),cyB=cyF*Ht;
      let wMax=0;
      dims=cards.map(c=>{const m=c.querySelector('.scard-media>*'),ar=m.classList.contains('phone-media')?1.1036/2.2705:m.offsetWidth/m.offsetHeight;
        let w=Ht*ar,h=Ht;if(w>dw*W){w=dw*W;h=w/ar}wMax=Math.max(wMax,w);
        c.style.setProperty('--w',w+'px');c.style.setProperty('--h',h+'px');return {w,h,cy:sideM||phone?cyB:cyB+(Ht-h)/2}});   // under: bottoms aligned so the headline gap never changes; side: centred
      const cx=sideM?.34*W:W/2;shift=cx-W/2;
      dims.forEach(d=>{const sw=side*d.w/2,min=wMax/2+sw+gap;
        d.Rl=Math.max(min,cx-peek+sw);d.Rr=Math.max(min,W-peek-cx+sw)});
      R=(dims[0].Rl+dims[0].Rr)/2;R2=side*wMax+gap;H=room*Ht;top=cyB-lane*Ht;bot=cyB+lane*Ht;
      if(sideM){const aw=Math.max(...dims.map(d=>d.w)),tl=cx+aw/2+48;
        sd.style.setProperty('--tl',tl+'px');sd.style.setProperty('--tw',Math.max(240,W-tl-peek-40)+'px');
        sd.style.setProperty('--tt',(stage.offsetTop+cyB)+'px')}
      sd.style.setProperty('--S',S+'px');sd.style.setProperty('--stage',H+'px');titleEl.style.setProperty('--S',S+'px');
      if(phone){tgNow=tg;sd.classList.add('stack');sd.style.setProperty('--tres',(tg+th+16)+'px');fill(Math.max(0,active))}
      titleEl.style.minHeight=th+'px';place(pos);
    };
    const edge=v=>Math.max(-.2,Math.min(cards.length-1+.2,v));
    /* speed (px/ms) = a GLIDE (her ask: "no matter how strong the horizontal scroll, don't lose speed till it clicks
       in place"): constant speed, never slower than --sd-speed, no ease-out — it holds its pace and stops dead on the
       card. Without speed (keys, the progress bar) it eases in as before. */
    const settle=(i,instant,speed)=>{
      const to=Math.max(0,Math.min(cards.length-1,i));if(tween)tween.kill();
      if(instant||rm||!window.gsap)return place(to);
      const o={v:pos};
      if(speed){const px=Math.abs(to-pos)*R,sp=Math.min(8,Math.max(num('--sd-speed')||1.6,speed));
        tween=gsap.to(o,{v:to,duration:Math.max(.08,px/sp/1000),ease:'none',onUpdate:()=>place(o.v),onComplete:()=>{tween=null}});return}
      tween=gsap.to(o,{v:to,duration:num('--settle')||.5,ease:getComputedStyle(sd).getPropertyValue('--sd-ease').trim()||'power3.out',onUpdate:()=>place(o.v)});
    };
    sd.addEventListener('pointerdown',e=>{if(e.button!==0)return;if(tween)tween.kill();drag={sx:e.clientX,sy:e.clientY,p0:pos,axis:null,pts:[[e.timeStamp,e.clientX]],id:e.pointerId}});
    sd.addEventListener('pointermove',e=>{
      if(!drag)return;const dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;
      if(!drag.axis){if(Math.abs(dx)<6&&Math.abs(dy)<6)return;drag.axis=Math.abs(dx)>Math.abs(dy)?'x':'y';if(drag.axis==='x'){sd.setPointerCapture(drag.id);sd.classList.add('dragging')}}
      if(drag.axis!=='x')return;drag.pts.push([e.timeStamp,e.clientX]);if(drag.pts.length>6)drag.pts.shift();place(edge(drag.p0-dx/R));
    });
    const end=()=>{
      if(!drag)return;const d=drag;drag=null;sd.classList.remove('dragging');if(d.axis!=='x')return;
      const a=d.pts[0],b=d.pts[d.pts.length-1],v=(b[1]-a[1])/Math.max(16,b[0]-a[0]);   // px per ms
      const near=Math.round(pos),pick=Math.round(pos-v*110/R);   // the nearest card; a real flick may carry one further
      settle(Math.max(near-1,Math.min(near+1,pick)),false,Math.abs(v));suppress=true;setTimeout(()=>{suppress=false},0);
    };
    sd.addEventListener('pointerup',end);sd.addEventListener('pointercancel',end);
    stage.addEventListener('click',e=>{const c=e.target.closest('.scard');if(!c)return;if(suppress){e.preventDefault();return}const i=+c.dataset.i;if(i!==active){e.preventDefault();settle(i)}});
    stage.addEventListener('focusin',e=>{const c=e.target.closest('.scard');if(c&&+c.dataset.i!==active)settle(+c.dataset.i)});
    /* press and hold (~0.45s, without dragging) shows that card's tech stack while held; letting go hides it and
       swallows the click, so only a quick tap opens the case study */
    let holdT=0,held=null;
    stage.addEventListener('pointerdown',e=>{const c=e.target.closest('.scard');if(!c||e.button!==0)return;clearTimeout(holdT);
      holdT=setTimeout(()=>{held=c;c.classList.add('held');drag=null;sd.classList.remove('dragging')},450)});
    sd.addEventListener('pointermove',()=>{if(drag&&drag.axis)clearTimeout(holdT)});
    const unhold=()=>{clearTimeout(holdT);if(held){held.classList.remove('held');held=null;suppress=true;setTimeout(()=>{suppress=false},0)}};
    addEventListener('pointerup',unhold);addEventListener('pointercancel',unhold);
    stage.addEventListener('contextmenu',e=>{if(e.target.closest('.scard'))e.preventDefault()});
    /* the progress bar: tap a segment to go there, or drag along it to scrub straight to the end (or back) */
    if(bar){
      const segAt=x=>{const r=bar.getBoundingClientRect();return Math.max(0,Math.min(cards.length-1,Math.floor((x-r.left)/r.width*cards.length)))};
      let scrub=false;
      bar.addEventListener('pointerdown',e=>{e.stopPropagation();scrub=true;settle(segAt(e.clientX));try{bar.setPointerCapture(e.pointerId)}catch(err){}});
      bar.addEventListener('pointermove',e=>{if(!scrub)return;const i=segAt(e.clientX);if(i!==Math.round(pos))settle(i)});
      const stop=()=>{scrub=false};bar.addEventListener('pointerup',stop);bar.addEventListener('pointercancel',stop);
      bar.addEventListener('keydown',e=>{const b=e.target.closest('button');if(b&&(e.key==='Enter'||e.key===' ')){e.preventDefault();settle(+b.dataset.i)}});
    }
    sd.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();settle(active+1)}else if(e.key==='ArrowLeft'){e.preventDefault();settle(active-1)}});
    /* trackpad: the deck follows the fingers 1:1 until the push reaches 40px, then COMMITS to the next card and glides
       there at the push's speed (one push = one project). The trackpad's own momentum after that is swallowed until
       the wheel goes quiet, so it never drags the glide down. */
    let wAcc=0,wFrom=0,wLock=false;
    /* on the WINDOW, not the deck (her: "depending on where my mouse is, I find it hard to horizontally scroll"):
       a sideways swipe works anywhere while the deck holds the middle of the screen */
    addEventListener('wheel',e=>{
      if(Math.abs(e.deltaX)<=Math.abs(e.deltaY)||!sd.offsetParent)return;
      const r=sd.getBoundingClientRect();if(r.top>innerHeight*.5||r.bottom<innerHeight*.5)return;
      e.preventDefault();touched=true;
      clearTimeout(wheelT);wheelT=setTimeout(()=>{if(!wLock)settle(Math.round(pos),false,1);wLock=false;wAcc=0},180);
      if(wLock)return;
      if(!wAcc){if(tween)tween.kill();wFrom=Math.round(pos)}
      wAcc+=e.deltaX;place(edge(pos+e.deltaX/R));
      if(Math.abs(wAcc)>=40){wLock=true;settle(wFrom+Math.sign(wAcc),false,Math.abs(e.deltaX)/16)}
    },{passive:false});
    /* "I'm not sure I realized I can swipe": the first time the deck is well in view it leans toward the next project
       and back, once, unless you've already touched it. The headline stays put for the nudge. */
    sd.addEventListener('pointerdown',()=>{touched=true});
    new IntersectionObserver((es,io)=>{if(!es.some(e=>e.intersectionRatio>=.6))return;io.disconnect();
      setTimeout(()=>{if(touched||rm||!window.gsap||pos!==0||cards.length<2)return;nudging=true;const o={v:0};
        gsap.timeline({onComplete:()=>{nudging=false;place(0)}}).to(o,{v:.22,duration:.45,ease:'power2.out',onUpdate:()=>place(o.v)}).to(o,{v:0,duration:.55,ease:'power2.inOut',onUpdate:()=>place(o.v)},'+=.08')},700)},{threshold:.6}).observe(sd);
    addEventListener('resize',layout);layout();settle(0,true);
    addEventListener('tweak',()=>{layout()});addEventListener('mk-work-view',()=>{layout()});
    if(!rm)vendorJS('gsap.min.js').catch(()=>{});
  }

  /* PHONES: the work list focuses on one project at a time (her ask 2026-10-23: "make the scroll
     between each selected project more focused, use gsap to make it more fluid"). ScrollTrigger RIDES
     the scroll, it never steers it (her no-scroll-jacking rule): each card is full size and bright as
     it crosses the middle of the screen, and eases back, smaller and dimmer, on the way in and out.
     scrub smooths it so the hand-off between projects glides. The card's own .fade entrance is dropped
     here, since GSAP owns its opacity and transform. */
  const phoneList=matchMedia('(max-width:760px)');
  const cardsM=[...document.querySelectorAll('.wproject')];
  if(phoneList.matches&&cardsM.length&&!rmActive()){
    vendorJS('gsap.min.js').then(()=>vendorJS('ScrollTrigger.min.js')).then(()=>{
      gsap.registerPlugin(ScrollTrigger);
      cardsM.forEach(c=>{
        c.classList.remove('fade');c.style.transition='background var(--motion-base) var(--ease-standard)';
        gsap.timeline({scrollTrigger:{trigger:c,start:'top bottom',end:'bottom top',scrub:.7}})
          .fromTo(c,{opacity:.28,scale:.9,y:48},{opacity:1,scale:1,y:0,ease:'power2.out',duration:.45})
          .to(c,{opacity:1,scale:1,y:0,duration:.1})
          .to(c,{opacity:.28,scale:.9,y:-48,ease:'power2.in',duration:.45});
      });
    }).catch(()=>{});
  }

  /* REELS PAGING (phones, SCROLL view). While the list holds the middle of the screen (html.reels-on), a vertical
     swipe on it is taken over: the page tracks the finger exactly, and on release eases to the next or previous
     project, or back to the same one for a small nudge, with power3.out (no overshoot, no spring). Swiping above
     the first project or below the last hands back to ordinary scrolling, so the list never traps you. Measures
     layout positions (offsetTop), which the GSAP focus effect doesn't shift. */
  if(phoneList.matches&&cardsM.length){
    const workSec=document.getElementById('work'),root=document.documentElement;let inMid=false;
    const sync=()=>{root.classList.toggle('reels-on',inMid&&workSec.dataset.view==='list');if(!inMid){const h=workSec.querySelector('.work-head');h&&h.classList.remove('tuck')}};
    new IntersectionObserver(es=>es.forEach(e=>{inMid=e.isIntersecting;sync()}),{rootMargin:'-50% 0px -50% 0px'}).observe(workSec);
    addEventListener('mk-work-view',sync);
    const docTop=e=>{let t=0;while(e){t+=e.offsetTop;e=e.offsetParent}return t};
    const aim=i=>docTop(cardsM[i])+cardsM[i].offsetHeight/2-innerHeight/2;
    const nearest=()=>{let n=0,bd=1e9;cardsM.forEach((c,i)=>{const d=Math.abs(aim(i)-scrollY);if(d<bd){bd=d;n=i}});return n};
    const jump=y=>window.scrollTo({top:y,behavior:'instant'});
    let t0=null,glide=null;
    addEventListener('touchstart',e=>{
      if(!root.classList.contains('reels-on')||e.touches.length!==1||!workSec.contains(e.target)){t0=null;return}
      if(glide)glide.kill();const y=e.touches[0].clientY;t0={y,x:e.touches[0].clientX,s:scrollY,i:nearest(),pts:[[e.timeStamp,y]],own:null};
    },{passive:true});
    addEventListener('touchmove',e=>{
      if(!t0)return;const y=e.touches[0].clientY,dy=y-t0.y,dx=e.touches[0].clientX-t0.x;
      if(t0.own===null){if(Math.abs(dy)<6&&Math.abs(dx)<6)return;
        const out=(t0.i===0&&dy>0)||(t0.i===cardsM.length-1&&dy<0);   // past either end: ordinary scrolling
        t0.own=Math.abs(dy)>Math.abs(dx)&&!out;if(!t0.own){t0=null;return}}
      e.preventDefault();if(t0.done)return;   // already clicked to the next one: the rest of this drag is ignored
      /* a slow drag CLICKS into place (her ask: "when I slow scroll I want it to click into place, not slowly
         scroll and overshoot"): past ~70px it commits to the next/previous project at once */
      if(Math.abs(dy)>70){t0.done=true;glideTo(t0.i+(dy<0?1:-1));return}
      jump(t0.s-dy);t0.pts.push([e.timeStamp,y]);if(t0.pts.length>6)t0.pts.shift();
    },{passive:false});
    /* the click: a short, decisive ease onto the project (power2.out, ~0.32s), never past it */
    const head=workSec.querySelector('.work-head');let at=0;
    const glideTo=i=>{const go=Math.max(0,Math.min(cardsM.length-1,i)),o={y:scrollY},to=aim(go);if(glide)glide.kill();
      if(head){if(go>at)head.classList.add('tuck');else if(go<at)head.classList.remove('tuck')}at=go;   // down = tuck the title, up = bring it back
      if(rmActive()||!window.gsap)return jump(to);glide=gsap.to(o,{y:to,duration:.32,ease:'power2.out',onUpdate:()=>jump(o.y)})};
    const release=()=>{
      if(!t0||!t0.own||t0.done){t0=null;return}const a=t0.pts[0],b=t0.pts[t0.pts.length-1],v=(b[1]-a[1])/Math.max(16,b[0]-a[0]);
      const go=v<-.35?t0.i+1:v>.35?t0.i-1:t0.i;t0=null;glideTo(go);   // a quick flick moves one; a small nudge clicks back
    };
    addEventListener('touchend',release,{passive:true});addEventListener('touchcancel',release,{passive:true});
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
    const dcSpan=dc.querySelector('.dc-body span');
    /* one pill, many labels: an element's data-curious value is the words it rolls out
       (empty attr = the default "I'm curious" — the case cards; the design-system brush
       says "View design system"). The label is set and MEASURED before the turn starts —
       the pill animates width, so the target must be a fixed px, and measuring while the
       spin foreshortens the disc would read a false width. */
    function curious(on,label){
      clearTimeout(turnTimer);
      if(on){
        dcSpan.textContent=label||"I'm curious";
        /* +32 restores the air the hand-fitted 140px gave "I'm curious" beyond its
           measured 107px — every label breathes the same, whatever its length */
        dc.style.setProperty('--dc-pill-w',(Math.ceil(dcSpan.getBoundingClientRect().width)+32)+'px');
        dc.classList.add('turning');
        /* the pill only rolls out once the three turns have finished, so it reads as
           one gesture rather than two things happening at once */
        turnTimer=setTimeout(()=>{dc.classList.remove('turning');dc.classList.add('pill')},TURN_MS);
      }else{
        dc.classList.remove('turning','pill');
      }
    }
    document.querySelectorAll('[data-curious]').forEach(card=>{
      /* deck cards: the pill only on the centred demo, and the deck's own code owns the click (drag, peeks) */
      if(card.classList.contains('scard')){
        card.addEventListener('pointerenter',()=>{if(card.getAttribute('aria-current')==='true')curious(true,card.dataset.curious)});
        card.addEventListener('pointerleave',()=>curious(false));
        card.addEventListener('pointerdown',()=>curious(false));
        return;
      }
      card.addEventListener('pointerenter',()=>curious(true,card.dataset.curious));
      card.addEventListener('pointerleave',()=>curious(false));
      card.addEventListener('click',e=>{
        if(e.metaKey||e.ctrlKey||e.shiftKey||e.button!==0)return;   // let people open in a new tab
        if(card.target==='_blank'){curious(false);return}           // new-tab links keep their default
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

  /* lazy video: hover-to-play on desktop, in-view autoplay on touch; src attached on first need.
     2026-08-20, "videos on mobile aren't autoplaying": two real causes, both fixed here —
     1. the old play test was intersectionRatio>=.5, which a box TALLER than the phone's
        viewport can never reach (the ratio is visible/total). "Half visible" is now judged
        against whichever is shorter, the box or the viewport.
     2. a fast scroll could land a stale pause AFTER the entering play() resolved and the
        video stayed dark — the disciplines panels got this guard on 2026-08-19, these boxes
        never did. Same cure: track inView, and replay any pause that arrives while visible
        (unless the viewer pressed the pause button — their pause is not stale). */
  /* iOS can refuse a programmatic play() outright — Low Power Mode and Settings >
     Accessibility "Auto-Play Video Previews" off both make play() reject even for a
     muted playsinline video, so every observer above fires and nothing moves
     (2026-08-26: "the gifs aren't automatically playing when i scroll past them", from
     a phone whose status bar showed the Low Power battery). The one thing that lifts
     the ban is a user gesture, and scrolling IS one: every touchend re-tries whichever
     clips are on screen and not deliberately paused, from inside the gesture Safari
     honours. One closure per clip, registered by both the boxes below and the
     disciplines panels. */
  const gestureRetries=[];
  addEventListener('touchend',()=>{gestureRetries.forEach(f=>f())},{passive:true});
  document.querySelectorAll('[data-video]').forEach(box=>{
    const vid=box.querySelector('video');if(!vid)return;
    const btn=box.querySelector('.play-btn');
    const hoverZone=box.closest('.wproject')||box;
    let inView=false,userPaused=false;
    function arm(){if(!vid.src&&vid.dataset.src){vid.preload='auto';vid.src=vid.dataset.src;vid.load()}}
    /* fetch AHEAD of arrival (2026-08-26, "the gifs still aren't playing as I scroll"):
       preload=none + src-on-half-visible meant the mp4's first byte wasn't requested
       until the clip was already on screen, so a phone showed the frozen poster for the
       whole scroll-past — instant on localhost, seconds on cellular. Start the download
       while the clip is still ~1.5 viewports away; by the time it arrives it can play
       its first frame immediately. preload flips to auto inside arm() because load()
       under preload=none fetches nothing at all. */
    new IntersectionObserver((es,io)=>{es.forEach(e=>{if(e.isIntersecting){arm();io.disconnect()}})},
      {rootMargin:'150% 0px 150% 0px'}).observe(box);
    function play(){arm();vid.play().then(()=>box.classList.add('playing')).catch(()=>{
      /* play() can lose the race with its own metadata on iOS (preload=none + src just
         attached): if the data wasn't there yet, try once more when it is */
      vid.addEventListener('loadeddata',()=>{if(inView&&!userPaused&&!rmActive())play()},{once:true});
    })}
    function pause(){vid.pause();box.classList.remove('playing')}
    vid.addEventListener('pause',()=>{if(inView&&!userPaused&&!rmActive())play()});
    gestureRetries.push(()=>{if(inView&&!userPaused&&vid.paused&&!rmActive())play()});
    if(btn){btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();
      if(box.classList.contains('playing')){userPaused=true;pause();btn.innerHTML=${JSON.stringify(PLAY_IC)}}
      else{userPaused=false;play();btn.innerHTML=${JSON.stringify(PAUSE_IC)}}})}
    const seen=e=>e.isIntersecting&&
      e.intersectionRect.height>=Math.min(e.boundingClientRect.height||1,innerHeight)*.5;
    /* data-autoplay = behave like a GIF: run whenever it is on screen, on any device */
    if(box.hasAttribute('data-autoplay')){
      new IntersectionObserver(es=>{es.forEach(e=>{inView=e.isIntersecting;
        if(rmActive())return;inView?play():pause()})},{threshold:.15}).observe(box);
      return;
    }
    if(finePointer.matches){
      hoverZone.addEventListener('mouseenter',()=>{if(!rmActive()){inView=true;play()}});
      hoverZone.addEventListener('mouseleave',()=>{inView=false;if(!rmActive())pause()});
    }else{
      new IntersectionObserver(es=>{es.forEach(e=>{if(rmActive())return;
        if(seen(e)){inView=true;if(!userPaused)play()}else{inView=false;pause()}})},
        {threshold:[0,.25,.5,.75,1]}).observe(box);
    }
    new IntersectionObserver(es=>{es.forEach(e=>{if(!e.isIntersecting){inView=false;pause()}})},{threshold:0}).observe(box);
  });

  /* disciplines panels */
  const panels=[...document.querySelectorAll('#panels .panel')];
  if(panels.length){
    function activate(target){panels.forEach(p=>{const on=p===target;p.classList.toggle('active',on);p.setAttribute('aria-selected',String(on))})}
    panels.forEach(p=>{
      p.addEventListener('click',()=>activate(p));
      p.addEventListener('mouseenter',()=>{if(finePointer.matches)activate(p)});
      p.addEventListener('keydown',e=>{
        if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(p)}
        if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();const n=panels[(panels.indexOf(p)+1)%panels.length];n.focus();activate(n)}
        if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();const n=panels[(panels.indexOf(p)-1+panels.length)%panels.length];n.focus();activate(n)}
      });
    });
    /* press-and-hold peek (touch, 2026-08-19 her ask): holding a panel ~350ms lifts the
       text and the scrim so the photo reads clean; releasing puts them back. The release
       of a hold must NOT count as the activating tap — the capture-phase click handler
       swallows exactly that one click. A finger that wanders >10px is scrolling, not
       holding, and cancels the peek so the page never fights the scroll gesture. */
    panels.forEach(p=>{
      let t=0,sx=0,sy=0,held=false;
      const clr=()=>{if(t){clearTimeout(t);t=0}};
      p.addEventListener('touchstart',e=>{held=false;const c=e.touches[0];sx=c.clientX;sy=c.clientY;
        clr();t=setTimeout(()=>{held=true;p.classList.add('peek')},350)},{passive:true});
      p.addEventListener('touchmove',e=>{const c=e.touches[0];
        if(Math.hypot(c.clientX-sx,c.clientY-sy)>10){clr();if(held){held=false;p.classList.remove('peek')}}},{passive:true});
      const end=()=>{clr();p.classList.remove('peek')};
      p.addEventListener('touchend',end,{passive:true});
      p.addEventListener('touchcancel',end,{passive:true});
      p.addEventListener('click',e=>{if(held){held=false;e.stopImmediatePropagation();e.preventDefault()}},true);
    });
    /* a panel clip is a GIF, not a reward for the active state (2026-08-19: "always
       autoplay the Michelob video, desktop and mobile"): it runs whenever its panel is
       on screen at all — expanded, collapsed, hovered or not — and pauses off-screen */
    panels.forEach(p=>{const v=p.querySelector('video');if(!v)return;
      let inView=false;
      const run=()=>{if(!v.src&&v.dataset.src)v.src=v.dataset.src;v.play().then(()=>p.classList.add('v-live')).catch(()=>{})};
      /* same fetch-ahead as the [data-video] boxes — start the download ~1.5 viewports out */
      new IntersectionObserver((es,io)=>{es.forEach(e=>{if(e.isIntersecting){
        if(!v.src&&v.dataset.src){v.preload='auto';v.src=v.dataset.src;v.load()}io.disconnect()}})},
        {rootMargin:'150% 0px 150% 0px'}).observe(p);
      /* a fast scroll can land a stale pause AFTER the entering play resolves — the
         pause listener puts it back: any pause that arrives while the panel is still
         on screen is wrong by definition and gets replayed */
      v.addEventListener('pause',()=>{if(inView&&!rmActive())run()});
      gestureRetries.push(()=>{if(inView&&v.paused&&!rmActive())run()});
      new IntersectionObserver(es=>{es.forEach(e=>{inView=e.isIntersecting;
        if(inView&&!rmActive())run();else v.pause()})},{threshold:.1}).observe(p);
    });
  }

  /* ---- one section at a time (2026-08-25, case studies) -----------------------------
     Scroll-LINKED crossfade over the .cs-section wrappers: opacity follows how close a
     section sits to the viewport centre, driven by position rather than a one-shot class
     flip — scrub back up and the previous section re-materialises, exactly like the
     Framer reference. A section spanning the centre is fully on; the ramp is 28% of the
     viewport either side, smoothstepped, and it fades to ZERO — no floor. Both are her
     2026-08-25 correction to the first pass (.05 floor, 40% ramp): "the things above and
     below disappear and aren't peeking", like the reference — so a neighbour is fully
     gone while the centred section is read, at the price of a briefly quiet screen
     mid-handover, which the reference also accepts. Entering sections also drift up
     their last 18px (leaving ones drift 12px the other way), which is what makes the
     arrival read as a reveal and not a dimmer. Off under reduced motion and in ?shot=
     QA mode — .cs-scroll is only stamped when the effect runs, so those paths keep the
     classic .fade entrances. */
  const csSecs=[...document.querySelectorAll('.cs-section')];
  if(csSecs.length&&!rmActive()&&!shot){
    document.body.classList.add('cs-scroll');
    let csTick=0;
    const csUpd=()=>{csTick=0;
      const cV=innerHeight/2,ramp=innerHeight*.28;
      csSecs.forEach(s=>{
        const r=s.getBoundingClientRect();
        let d=0;
        if(r.top>cV)d=r.top-cV;else if(r.bottom<cV)d=cV-r.bottom;
        const o=Math.max(0,1-d/ramp),eased=o*o*(3-2*o);
        s.style.opacity=eased.toFixed(3);
        s.style.transform=eased>=1?'':'translateY('+((1-eased)*(r.top>cV?18:-12)).toFixed(1)+'px)';
      })};
    const csQ=()=>{if(!csTick)csTick=requestAnimationFrame(csUpd)};
    addEventListener('scroll',csQ,{passive:true});
    addEventListener('resize',csQ,{passive:true});
    csUpd();
  }

  /* ---- the koi (2026-08-20) --------------------------------------------------------
     One fish from her plate painting leaps out of the POT, flips, and dives back in
     (fish.js). The whole show happens at the pot, so the pot is the trigger — firing
     off the about eyebrow (the old flight's cue) would spend the one jump per visit
     while the pot was still below the fold. fish.js ships with three.js under it — a
     deliberately heavy module, which is exactly why it is NOT in this bundle: the code
     is FETCHED when the reader is within a screen or two of the pot and RUN when the
     pot is properly on screen (60% visible), once per visit. */
  /* THE JUMP! BOX (see .jump-box). Placed beside the name; a click sends clay-her (stickman.js 'mk-box-jump'), and
     her slam ('mk-box-slam') drops the bottom open and tumbles the socials out: real gravity, a couple of bounces,
     they come to rest standing upright on the line of the buttons, as ordinary links. If she can't jump (reduced
     motion, or she isn't there) the box simply opens. */
  const jb=document.querySelector('.hero>.jump-box');
  if(jb&&matchMedia('(min-width:761px)').matches){
    const heroEl=jb.parentElement,art=jb.querySelector('.jb-art'),soc=heroEl.querySelector('.jb-socials'),logos=[...soc.children];
    const placeBox=()=>{const hr=heroEl.getBoundingClientRect(),t=heroEl.querySelector('h1 .lively').getBoundingClientRect();if(!t.width)return;
      const x=Math.min(t.right-hr.left+80,hr.width-jb.offsetWidth-24),y=t.top-hr.top+t.height/2-jb.offsetHeight/2;
      jb.style.left=x+'px';jb.style.top=y+'px';dispatchEvent(new Event('mk-terrain'))};
    const jimg=jb.querySelector('.jb-img');if(jimg&&!jimg.complete)jimg.addEventListener('load',placeBox,{once:true});
    placeBox();setTimeout(placeBox,2100);addEventListener('resize',placeBox,{passive:true});   // 2.1s: after the headline's rise lands
    /* the morph loop: one frame at a time fades up over the last, every 1.1s; paused off screen, stopped once jumped on */
    const frames=[...jb.querySelectorAll('.jb-img')];let fk=0,morphT=0,seen=false;
    const morph=()=>{clearTimeout(morphT);if(!seen||state!=='idle'||rmActive()||frames.length<2)return;
      const nk=(fk+1)%frames.length;frames[nk].classList.add('on');const prev=fk;fk=nk;
      if(prev)setTimeout(()=>frames[prev].classList.remove('on'),1100);   // frame 0 is the base underneath, always on
      if(!nk)frames.slice(1).forEach(f=>setTimeout(()=>f.classList.remove('on'),1100));
      morphT=setTimeout(morph,1100)};
    new IntersectionObserver(es=>{seen=es.some(e=>e.isIntersecting);if(seen)morph();else clearTimeout(morphT)}).observe(jb);
    let state='idle',fallback=0;
    const tumble=still=>{
      const hr=heroEl.getBoundingClientRect(),br=jb.getBoundingClientRect(),cta=heroEl.querySelector('.hero-cta-row').getBoundingClientRect();
      const S=52,n=logos.length,x0=br.left-hr.left+br.width/2,y0=br.bottom-hr.top-6,floor=Math.max(cta.bottom-hr.top,y0+110);
      const ps=logos.map((a,i)=>({a,x:x0,y:y0,vx:(i-(n-1)/2)*150+(Math.random()-.5)*50,vy:40+Math.random()*80,r:0,vr:(Math.random()<.5?-1:1)*(300+Math.random()*320),rest:false}));
      if(still)ps.forEach((p,i)=>{p.x=x0+(i-(n-1)/2)*72;p.y=floor;p.rest=true});
      const paint=()=>ps.forEach(p=>{p.a.style.transform='translate('+(p.x-S/2).toFixed(1)+'px,'+(p.y-S).toFixed(1)+'px) rotate('+p.r.toFixed(1)+'deg)'});
      paint();logos.forEach(a=>{a.classList.add('out');a.removeAttribute('tabindex')});
      /* her ask: "I want to be able to jump on top of the linkedin and the x logos": once they rest they are ground */
      if(still){logos.forEach(a=>a.classList.add('rest'));return dispatchEvent(new Event('mk-terrain'))}
      let last=performance.now();
      const step=t=>{const dt=Math.min(.033,(t-last)/1000);last=t;let moving=false;
        for(const p of ps){if(p.rest)continue;moving=true;
          p.vy+=1900*dt;p.x=Math.max(S/2,Math.min(hr.width-S/2,p.x+p.vx*dt));p.y+=p.vy*dt;
          const up=Math.round(p.r/360)*360;
          if(p.y>=floor){p.y=floor;
            if(p.vy>160){p.vy*=-.38;p.vx*=.6;p.vr*=.4}            // a bounce, smaller each time
            else{p.vy=0;p.vx*=Math.pow(.004,dt);p.r+=(up-p.r)*Math.min(1,dt*12);p.vr=0;   // on the line: slide to a stop, stand upright
              if(Math.abs(p.vx)<6&&Math.abs(up-p.r)<.6){p.r=up;p.rest=true}}}
          else p.r+=p.vr*dt;}
        paint();if(moving)requestAnimationFrame(step);else{logos.forEach(a=>a.classList.add('rest'));dispatchEvent(new Event('mk-terrain'))}};
      requestAnimationFrame(step);
    };
    /* then the box is DONE (her ask: "when the box opens it dissolves in a puff of dust and the person falls down"):
       it bulges, shrinks to nothing inside a burst of clay dust, stops being ground, and she drops */
    const dissolve=still=>{
      const hr=heroEl.getBoundingClientRect(),br=jb.getBoundingClientRect(),cx=br.left-hr.left+br.width/2,cy=br.top-hr.top+br.height/2;
      if(!still)for(let i=0;i<34;i++){const d=document.createElement("i"),z=7+Math.random()*13,a=Math.random()*Math.PI*2,r=34+Math.random()*80;
        d.className='jb-dust';Object.assign(d.style,{left:cx-z/2+(Math.random()-.5)*br.width*.7+'px',top:cy-z/2+(Math.random()-.5)*br.height*.7+'px',width:z+'px',height:z+'px'});
        heroEl.appendChild(d);
        d.animate([{transform:'translate(0,0) scale(1)',opacity:.95},{transform:'translate('+(Math.cos(a)*r*1.3).toFixed(1)+'px,'+(Math.sin(a)*r-46).toFixed(1)+'px) scale(.15)',opacity:0}],
          {duration:650+Math.random()*450,easing:'cubic-bezier(.2,.7,.3,1)'}).onfinish=()=>d.remove()}
      const gone=()=>{const f=document.activeElement===jb;jb.classList.add('gone');if(f&&logos[0])logos[0].focus();dispatchEvent(new Event('mk-box-gone'))};
      if(still)return gone();
      art.animate([{transform:'none',opacity:1},{transform:'scale(1.12,.9)',opacity:.9,offset:.3},{transform:'scale(.35)',opacity:0}],{duration:300,easing:'ease-in',fill:'forwards'});
      setTimeout(gone,150);
    };
    const open=still=>{if(state==='open')return;state='open';clearTimeout(fallback);jb.setAttribute('aria-expanded','true');
      if(!still){art.classList.remove('slam');void art.offsetWidth;art.classList.add('slam')}
      setTimeout(()=>tumble(still),still?0:120);setTimeout(()=>dissolve(still),still?0:560)};
    jb.addEventListener('click',()=>{
      if(state!=='idle')return;state='jumping';
      /* stop the bob where it is and ease it level, so the lid is exactly where she will land */
      const cur=getComputedStyle(art).transform;art.style.transform=cur==='none'?'':cur;art.classList.add('still');
      requestAnimationFrame(()=>{art.style.transform=''});
      if(rmActive())return open(true);
      dispatchEvent(new CustomEvent('mk-box-jump',{detail:{el:jb}}));
      fallback=setTimeout(()=>open(false),2200);
    });
    addEventListener('mk-box-slam',()=>{if(state==='jumping')open(false)});
  }

  const potEl=document.querySelector('.pot');
  if(potEl){
    /* QA hook in the ?shot= family: ?fishfreeze=0.5 holds the flight at that fraction
       of the airtime (0.5 = apex) by pre-setting the __fishFreeze knob fish.js already
       reads per frame — headless screenshots can't reach the console mid-leap */
    const ff=location.search.match(/fishfreeze=([\\d.]+)/);
    if(ff)window.__fishFreeze=+ff[1];
    const phone=matchMedia('(max-width:700px)').matches;
    let mod=null,fired=false;
    const fetchIt=()=>mod||(mod=import('./fish.js?v=${BUILD_V}'));
    const leap=()=>{if(!rmActive())fetchIt().then(m=>m.run({phone})).catch(()=>{})};
    new IntersectionObserver((es,io)=>{es.forEach(e=>{if(!e.isIntersecting)return;
      io.disconnect();if(!rmActive())fetchIt()})},{rootMargin:'900px 0px'}).observe(potEl);
    new IntersectionObserver((es,io)=>{es.forEach(e=>{if(!e.isIntersecting||fired)return;
      fired=true;io.disconnect();leap()})},{threshold:.6}).observe(potEl);
    /* (2026-08-25 her ask) hitting the pot brings the koi back: every click/tap after the
       once-per-visit auto-leap fires another jump. 'click' and not pointerdown, so a
       scroll gesture that merely starts on the pot never launches a fish (the same rule
       the stickman follows: a drag is the scroll gesture). fish.js guards itself against
       overlapping flights — hammering the pot queues nothing, one fish at a time. */
    potEl.addEventListener('click',leap);
    potEl.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();leap()}});
    /* (2026-09-06 her ask) a WOBBLE launches the fish too — the same user gestures that
       nudge the pot's spring (hover, touch, keyboard focus). Deliberately NOT mk-pot-kick:
       that kick is the fish's own splashdown, and leaping on it would chain flights
       forever. fish.js's live flag still holds it to one fish in the air. */
    potEl.addEventListener('mouseenter',leap);
    potEl.addEventListener('touchstart',leap,{passive:true});
    potEl.addEventListener('focus',leap);
    /* the disappear-line dial (studies/tweaker-fish/, local only): moves the front-lip line, can draw it on the
       pot, slows the flight down, and re-launches the fish after each change */
    window.__fishLip=${JSON.stringify((TWEAKS['fish-lip'] || {}).lip ?? 10.5)}/100;
    let guide=null,again=0;
    addEventListener('tweak',e=>{const v=e.detail.values||{};if(v.lip==null)return;
      window.__fishLip=v.lip/100;window.__fishSlow=v.slow||1;
      if(v.showLine){potEl.style.position='relative';   // the line rides on the pot, rocking and all
        guide=guide||potEl.appendChild(Object.assign(document.createElement('i'),{style:'position:absolute;left:-24px;right:-24px;height:1px;background:#ff3b6b;pointer-events:none'}));
        guide.style.top=v.lip+'%'}
      else if(guide){guide.remove();guide=null}
      clearTimeout(again);again=setTimeout(()=>fetchIt().then(m=>{m.stop();leap()}),250)});
    addEventListener('tweak-replay',leap);
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
<!-- the pot, standing on its line — same object that lives above the footer. Generated
     from her ink drawing by tools/make-favicon.js; the 400px square in assets/favicon/
     is for LinkedIn, not referenced here. -->
<link rel="icon" type="image/png" sizes="32x32" href="assets/favicon/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="assets/favicon/favicon-16.png">
<link rel="apple-touch-icon" href="assets/favicon/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${theme.fonts['google-css']}" rel="stylesheet">
<!-- theme boots BEFORE the stylesheet so night never flashes cream: a stored choice
     wins; otherwise the viewer's own sunrise/sunset decides (NOAA short-form solar
     position, coordinates approximated from the IANA timezone — no permission prompt,
     no network call). window.__mkSun carries the times so app.js can flip the theme
     live when the sun actually rises or sets mid-visit. -->
<script>(function(){try{
var Z={'America/New_York':[40.7,-74],'America/Detroit':[42.3,-83],'America/Chicago':[41.9,-87.7],'America/Denver':[39.7,-105],'America/Los_Angeles':[34.1,-118.2],'America/Phoenix':[33.4,-112.1],'America/Toronto':[43.7,-79.4],'America/Vancouver':[49.3,-123.1],'America/Mexico_City':[19.4,-99.1],'America/Sao_Paulo':[-23.5,-46.6],'America/Argentina/Buenos_Aires':[-34.6,-58.4],'America/Bogota':[4.7,-74.1],'America/Lima':[-12,-77],'America/Santiago':[-33.4,-70.7],'America/Anchorage':[61.2,-149.9],'Pacific/Honolulu':[21.3,-157.9],'Europe/London':[51.5,-.1],'Europe/Dublin':[53.3,-6.3],'Europe/Paris':[48.9,2.3],'Europe/Berlin':[52.5,13.4],'Europe/Madrid':[40.4,-3.7],'Europe/Rome':[41.9,12.5],'Europe/Amsterdam':[52.4,4.9],'Europe/Stockholm':[59.3,18.1],'Europe/Oslo':[59.9,10.8],'Europe/Copenhagen':[55.7,12.6],'Europe/Zurich':[47.4,8.5],'Europe/Vienna':[48.2,16.4],'Europe/Warsaw':[52.2,21],'Europe/Athens':[38,23.7],'Europe/Istanbul':[41,29],'Europe/Moscow':[55.8,37.6],'Europe/Lisbon':[38.7,-9.1],'Africa/Cairo':[30,31.2],'Africa/Lagos':[6.5,3.4],'Africa/Nairobi':[-1.3,36.8],'Africa/Johannesburg':[-26.2,28],'Asia/Dubai':[25.2,55.3],'Asia/Karachi':[24.9,67],'Asia/Kolkata':[19,72.8],'Asia/Dhaka':[23.8,90.4],'Asia/Bangkok':[13.8,100.5],'Asia/Singapore':[1.3,103.8],'Asia/Hong_Kong':[22.3,114.2],'Asia/Shanghai':[31.2,121.5],'Asia/Taipei':[25,121.5],'Asia/Seoul':[37.6,127],'Asia/Tokyo':[35.7,139.7],'Asia/Jakarta':[-6.2,106.8],'Asia/Manila':[14.6,121],'Asia/Jerusalem':[31.8,35.2],'Asia/Riyadh':[24.7,46.7],'Australia/Sydney':[-33.9,151.2],'Australia/Melbourne':[-37.8,145],'Australia/Brisbane':[-27.5,153],'Australia/Perth':[-32,115.9],'Pacific/Auckland':[-36.8,174.8]};
var zone='';try{zone=Intl.DateTimeFormat().resolvedOptions().timeZone||''}catch(e){}
var co=Z[zone];
if(!co){var off=-(new Date().getTimezoneOffset())/60;
  var south=/Australia|Auckland|Johannesburg|Sao_Paulo|Argentina|Santiago|Lima|La_Paz|Asuncion|Montevideo|Harare|Maputo|Antarctica/.test(zone);
  co=[south?-30:35,off*15];}
function sunUTC(d,lat,lon){
  var r=Math.PI/180,doy=Math.floor((d-Date.UTC(d.getUTCFullYear(),0,0))/864e5),
      g=2*Math.PI/365*(doy-1+.5),
      eq=229.18*(75e-6+.001868*Math.cos(g)-.032077*Math.sin(g)-.014615*Math.cos(2*g)-.040849*Math.sin(2*g)),
      dec=.006918-.399912*Math.cos(g)+.070257*Math.sin(g)-.006758*Math.cos(2*g)+9.07e-4*Math.sin(2*g)-.002697*Math.cos(3*g)+.00148*Math.sin(3*g),
      ch=(Math.cos(90.833*r)-Math.sin(lat*r)*Math.sin(dec))/(Math.cos(lat*r)*Math.cos(dec));
  if(ch>1||ch<-1)return null; /* polar day/night: fall through to the 7-19 fallback */
  var ha=Math.acos(ch)/r,noon=720-4*lon-eq,
      day0=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());
  return{rise:day0+(noon-4*ha)*6e4,set:day0+(noon+4*ha)*6e4};}
var now=new Date(),t=null,at=NaN;
try{t=localStorage.getItem('mk-theme');at=Number(localStorage.getItem('mk-theme-at'))}catch(e){}
if(t!=='day'&&t!=='night')t=null;
/* the last solar event before now decides — computed across yesterday/today/tomorrow
   (UTC dates), because east of Greenwich "today's" set can precede "today's" rise and
   a naive before/after check calls a Sydney morning night */
var evs=[];[-1,0,1].forEach(function(k){
  var su=sunUTC(new Date(now.getTime()+k*864e5),co[0],co[1]);
  if(su){evs.push(['rise',su.rise],['set',su.set])}});
evs.sort(function(a,b){return a[1]-b[1]});
var last=null,nxt=null;
for(var i=0;i<evs.length;i++){if(evs[i][1]<=now.getTime())last=evs[i];else{nxt=evs[i];break}}
/* a toggle click is an OVERRIDE of the current stretch of day or night, not a policy
   (2026-08-20: her site sat in day at 1am because a stored choice used to win forever).
   It expires the moment the sun next rises or sets after it was made; a stored choice
   with no timestamp is from before this rule and counts as already expired. */
if(t&&(!isFinite(at)||(last&&last[1]>at))){
  t=null;try{localStorage.removeItem('mk-theme');localStorage.removeItem('mk-theme-at')}catch(e){}}
if(!t){
  if(last)t=last[0]==='rise'?'day':'night';
  else{var h=now.getHours();t=(h<7||h>=19)?'night':'day';}
}
window.__mkSun={next:nxt?nxt[1]:null,mode:nxt?(nxt[0]==='rise'?'day':'night'):null};
if(t==='night')document.documentElement.setAttribute('data-theme','night');
}catch(e){}})();</script>
<link rel="stylesheet" href="styles.css?v=${BUILD_V}">
<!-- .w is the word wrapper reveal-words puts around every word, and it starts at opacity 0
     waiting for the .revealed class, which only JS ever adds. Without this the hero sentence
     is invisible to a no-JS visitor. It is real text now, so a reader with no JS still gets
     the copy — but it would look like the hero simply has none. -->
<noscript><style>.w{opacity:1;transform:none;filter:none}.fade{opacity:1;transform:none}.hero h1,.hero-cta-row{opacity:1;transform:none}.hero-flora{opacity:1}.dc{display:none}</style></noscript>
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
    ? `<a href="#work" data-hand="Work">Work</a><a class="optional" href="#disciplines" data-hand="Disciplines">Disciplines</a><a class="optional" href="#about" data-hand="About">About</a><a href="assets/resume.pdf?v=${BUILD_V}" target="_blank" rel="noopener" data-hand="Resume">Resume</a>`
    : `<a href="index.html#work" data-hand="All work">All work</a><a class="optional" href="assets/resume.pdf?v=${BUILD_V}" target="_blank" rel="noopener" data-hand="Resume">Resume</a>`;
  return `<div class="edge-fade top" aria-hidden="true"></div><div class="edge-fade bottom" aria-hidden="true"></div>
<div class="nav-wrap"><nav class="bar glass" aria-label="Main">
  <a class="wordmark${home ? ' wm-load' : ''}" href="index.html">${wordmarkHTML(site.wordmark)}</a>
  <div class="nav-links">${links}</div>
  <a class="btn solid sm" href="${esc(site.calendly)}" target="_blank" rel="noopener" data-hand="SAY HEY!">say hey!</a>
</nav></div>
<button class="theme-toggle glass" type="button" aria-label="Switch to night mode"><span class="tt-rim" aria-hidden="true"></span></button>`;
}

/* "M--K" split for the nav interaction: the letters are movable spans, the dashes their
   own. Any wordmark not shaped letter-dashes-letter passes through untouched. */
function wordmarkHTML(wm) {
  const m = wm.match(/^(.)(-+)(.)$/);
  if (!m) return esc(wm);
  return `<span class="wm-m">${esc(m[1])}</span><span class="wm-d">${esc(m[2])}</span><span class="wm-k">${esc(m[3])}</span>`;
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
/* The two Chrome rows, shared by the standalone window and the MacBook's screen.
   Tab title falls back to the url so old data keeps rendering. */
function chromeHTML(m) {
  const url = esc(m.url || '');
  const title = esc(m.tab || m.url || '');
  return `<div class="chrome-tabs" aria-hidden="true">
        <span class="lights"><i></i><i></i><i></i></span>
        <span class="tab"><span class="fav"></span><span class="tab-t">${title}</span><span class="tab-x">×</span></span>
        <span class="tab-plus">+</span>
      </div>
      <div class="chrome-nav" aria-hidden="true">
        <span class="nav-ic">←</span><span class="nav-ic is-off">→</span><span class="nav-ic">⟳</span>
        <span class="omni"><span class="lock"></span>${url}</span>
        <span class="nav-ic">☆</span><span class="prof"></span><span class="nav-ic">⋮</span>
      </div>`;
}

function mediaBody(m, eager) {
  const isVideo = /\.(mp4|webm)$/.test(m.src || '');
  return {
    isVideo,
    body: isVideo
      ? `<img class="poster" src="${esc(asset(m.poster))}" alt="${esc(m.alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">
       <video muted loop playsinline preload="none" data-src="${esc(asset(m.src))}" poster="${esc(asset(m.poster))}" aria-label="${esc(m.alt || '')}"></video>
       <button class="play-btn btn icon solid" type="button" aria-label="Play preview">${PLAY_IC}</button>`
      : `<img class="poster" src="${esc(asset(m.src))}" alt="${esc(m.alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`,
  };
}

function browserFrame(m, { eager = false } = {}) {
  const { isVideo, body } = mediaBody(m, eager);
  return `<div class="browser">
      ${chromeHTML(m)}
      <div class="browser-body"${isVideo ? ` data-video${m.autoplay ? ' data-autoplay' : ''}` : ''}${m.ar ? ` style="aspect-ratio:${esc(m.ar)}"` : ''}>${body}</div>
    </div>`;
}

/* The Mac menu bar: apple, Chrome's menus, and the status corner. Icons are tiny
   inline SVGs (wifi, battery, search) so they render on every platform — the
   glyph is macOS-only and would tofu elsewhere. */
const MAC_MENUBAR = `<div class="mac-menubar" aria-hidden="true">
      <svg class="mb-apple" viewBox="0 0 24 24"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.03 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>
      <b>Chrome</b><span>File</span><span>Edit</span><span>View</span><span>History</span><span>Bookmarks</span><span>Profiles</span><span>Tab</span><span>Window</span><span>Help</span>
      <span class="mb-right">
        <svg class="mb-ic" viewBox="0 0 24 24"><path d="M12 18.2a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2zm-4.9-4.6a7.4 7.4 0 0 1 9.8 0l-1.6 1.9a4.9 4.9 0 0 0-6.6 0zm-3.4-4a12.4 12.4 0 0 1 16.6 0l-1.6 1.9a9.9 9.9 0 0 0-13.4 0z"/></svg>
        <svg class="mb-ic mb-batt" viewBox="0 0 28 12"><rect x=".5" y=".5" width="23" height="11" rx="3" fill="none" stroke="currentColor"/><rect x="2.5" y="2.5" width="16" height="7" rx="1.5"/><path d="M25.5 3.6v4.8a2.4 2.4 0 0 0 0-4.8z"/></svg>
        <svg class="mb-ic" viewBox="0 0 24 24"><path d="M10.5 3a7.5 7.5 0 1 0 4.55 13.46l4.24 4.24 1.42-1.42-4.24-4.24A7.5 7.5 0 0 0 10.5 3zm0 2a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z"/></svg>
        <span>Fri Aug 28&nbsp;&nbsp;12:52 PM</span>
      </span>
    </div>`;

/* Same media contract as browserFrame, inside the CSS MacBook: the screen shows a
   whole working Mac — menu bar, Chrome maximized, the capture filling the rest. */
function macFrame(m, { eager = false } = {}) {
  const { isVideo, body } = mediaBody(m, eager);
  return `<div class="mac-media">
      <div class="mac">
        <div class="mac-lid" aria-hidden="true"><span class="mac-cam"></span></div>
        <div class="mac-screen">
          ${MAC_MENUBAR}
          ${chromeHTML(m)}
          <div class="mac-page"${isVideo ? ` data-video${m.autoplay ? ' data-autoplay' : ''}` : ''}>${body}</div>
        </div>
        <div class="mac-base" aria-hidden="true"></div>
      </div>
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
  <p class="hero-line reveal-words" data-seq="3" data-base="1800">${heroLinesHTML}</p>
  <!-- THE JUMP! BOX (2026-10-23 her ask). A placeholder drawn in CSS until the clay art is made. Click it: clay-her
       tuck-flips onto it, slams, its bottom drops open and her socials tumble out. The socials are the footer's
       LinkedIn / Twitter / X links, so adding one there adds it here. -->
  <button class="jump-box" type="button" aria-label="Jump on the box to see my socials" aria-expanded="false">
    <span class="jb-art" aria-hidden="true">${[0, 1, 2, 3, 4, 5].map(k => `<img class="jb-img${k ? ' jb-f' : ' on'}" src="assets/clay/props/cloud-${k}.png?v=${BUILD_V}" alt="" draggable="false"${k ? ' loading="lazy"' : ''}>`).join('')}<span class="jb-word">jump!</span></span>
  </button>
  <div class="jb-socials" aria-label="Socials">${[...(site.footer.links || []).filter(l => /linkedin\.com|twitter\.com|\/\/(www\.)?x\.com/i.test(l.href)).map(l => ({ label: l.label, href: l.href, icon: /linkedin/i.test(l.href) ? 'linkedin' : 'x' })),
    { label: 'Resume', href: h.ctaSecondary.href, icon: 'resume' }].map(l => `<a class="jb-logo" href="${esc(l.href)}" target="_blank" rel="noopener" aria-label="${esc(l.label)}" tabindex="-1"><img src="assets/clay/props/${l.icon}.png?v=${BUILD_V}" alt="" draggable="false"></a>`).join('')}</div>
  <p class="hero-cta-row">
    <a class="btn solid" href="${esc(h.ctaPrimary.href)}" target="_blank" rel="noopener" data-hand="${esc(h.ctaPrimary.label.replace(/[^ '!,.A-Za-z\u2019]/g,'').trim().toUpperCase())}">${esc(h.ctaPrimary.label)}</a>
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
    ${site.brands.logos.map((l, i) => {
      /* a logo with an href (the same proof link her resume carries for that brand)
         becomes the anchor itself — the slot doubles as the link so the whole mark
         is the target; the rest stay plain spans, not dead links */
      const mark = `<span class="brand" role="img" aria-label="${esc(l.alt)}" style="--logo:url('${esc(l.src)}')"></span>`;
      return l.href
        ? `<a class="brand-slot" style="--i:${i}" href="${esc(l.href)}" target="_blank" rel="noopener" aria-label="${esc(l.alt)}">${mark}</a>`
        : `<span class="brand-slot" style="--i:${i}">${mark}</span>`;
    }).join('\n    ')}
  </div>
</section>`;

  const projectMedia = p => {
    const m = p.media;
    if (m.type === 'phone-video') {
      return phoneFrame(`<img class="poster" src="${esc(asset(m.poster))}" alt="${esc(m.alt)}" loading="lazy" decoding="async">
          ${videoTag(m)}`, { attrs: ` data-video${m.autoplay ? ' data-autoplay' : ''}`, island: m.island !== false,
            extra: '<button class="play-btn btn icon solid" type="button" aria-label="Play project preview">${PLAY_IC}</button>' });
    }
    if (m.type === 'phone-gif' || m.type === 'phone-image') {
      return phoneFrame(`<img src="${esc(asset(m.src))}" alt="${esc(m.alt)}"${screenFit(m.src)} loading="lazy" decoding="async">`,
        { island: m.island !== false });
    }
    if (m.type === 'browser') return browserFrame(m, { lazy: true });
    /* m.ar pins the box to a recording's native aspect (default 1.7343) so a clip that
       isn't 16:9 fills the frame instead of getting cover-cropped — Vantage's console
       walkthrough is 1064x672 and its bottom captions would otherwise be cut off */
    return `<div class="project-media" data-video${m.ar ? ` style="aspect-ratio:${esc(m.ar)}"` : ''}>
      <img class="poster" src="${esc(asset(m.poster))}" alt="${esc(m.alt)}" loading="lazy" decoding="async">
      ${videoTag(m)}
      <button class="play-btn btn icon solid" type="button" aria-label="Play project preview">${PLAY_IC}</button>
    </div>`;
  };

  /* the SCROLL view: one project per screen on phones (Reels), the stacked list on desktop. The project name is
     plain text now: she didn't like the pill around it (2026-10-23) */
  const listHTML = `${site.work.projects.map(p => `
  <a class="wproject fade" href="${esc(p.slug)}.html" data-curious>
    <div class="w-copy">
      <h3 class="w-outcome">${typo(p.outcome)}</h3>
      <p class="w-chiprow"><span class="w-name">${esc(p.name)}</span><span class="w-tags">${esc(p.tags)}</span></p>
      ${p.stack ? `<ul class="w-stack" aria-label="Built with">${p.stack.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    </div>
    <div class="project-media-wrap">${projectMedia(p)}</div>
  </a>`).join('\n')}`;

  /* THE SWIPE DECK (review copy, branch review/swipe-deck; her spec claude-case-study-swipe-deck.md and her
     reference-swipe-deck.mov): one large centred case-study card; the others wait in alternating corner lanes
     (her v2 brief, claude-case-study-swipe-deck-v2.md). Only the centred project's FULL-SENTENCE headline shows,
     UNDER the card (her change from the reference). Cards use the same media and links as the list. */
  const sdeckHTML = `
  <div class="sdeck" tabindex="0" role="region" aria-roledescription="carousel" aria-label="${esc(site.work.title)}. Drag, swipe or use the arrow keys">
    <div class="sdeck-stage">
      ${site.work.projects.map((p, i) => `<a class="scard" href="${esc(p.slug)}.html" data-curious data-i="${i}" data-name="${esc(p.name)}" data-title="${esc(p.outcome)}" aria-label="${esc(p.name)}: ${esc(p.outcome)}" draggable="false"><div class="scard-media">${projectMedia(p)}</div>${p.stack ? `<div class="scard-stack" aria-hidden="true"><span class="scard-stack-label">Built with</span><ul>${p.stack.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}</a>`).join('\n      ')}
    </div>
    <div class="sdeck-title" aria-live="polite"><span><span class="sdeck-name">${esc(site.work.projects[0].name)}</span><span class="sdeck-line">${typo(site.work.projects[0].outcome)}</span></span></div>
    <div class="sdeck-progress" role="group" aria-label="Jump to a project">${site.work.projects.map((p, i) => `<button type="button" data-i="${i}" aria-label="Go to project ${i + 1} of ${site.work.projects.length}: ${esc(p.name)}"></button>`).join('')}</div>
  </div>`;

  /* THE WORK SECTION (her ask 2026-10-23: the swipe deck on the main screen, "with a toggle that lets you go
     into scroll mode"). SWIPE (the deck) is the default; SCROLL is the stacked list (one project per screen
     on phones). app.js flips data-view and remembers the choice in this browser. */
  const workHTML = `
<section id="work" class="work-sec" data-view="deck">
  <div class="work-head">
    <h2 class="section-title fade">${typo(site.work.title)}</h2>
    <div class="view-toggle head-toggle" role="group" aria-label="How to browse the projects (top)">
      <button type="button" class="view-btn" data-view="deck" aria-pressed="true" aria-label="Swipe through the projects" title="Swipe"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="4.5" width="10" height="15" rx="2.2"/><rect x="1.5" y="8" width="3.6" height="8" rx="1.2"/><rect x="18.9" y="8" width="3.6" height="8" rx="1.2"/></svg></button>
      <button type="button" class="view-btn" data-view="list" aria-pressed="false" aria-label="Scroll through the projects" title="Scroll"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="8" rx="2.2"/><rect x="4" y="13" width="16" height="8" rx="2.2"/></svg></button>
    </div>
  </div>
  <div class="view-deck">${sdeckHTML}</div>
  <div class="view-list">${listHTML}</div>
  <!-- the toggle floats at the bottom of the screen the whole time the projects are on screen (her ask: "should always be visible") -->
  <div class="view-dock">
    <div class="view-toggle" role="group" aria-label="How to browse the projects">
      <button type="button" class="view-btn" data-view="deck" aria-pressed="true" aria-label="Swipe through the projects" title="Swipe"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="4.5" width="10" height="15" rx="2.2"/><rect x="1.5" y="8" width="3.6" height="8" rx="1.2"/><rect x="18.9" y="8" width="3.6" height="8" rx="1.2"/></svg></button>
      <button type="button" class="view-btn" data-view="list" aria-pressed="false" aria-label="Scroll through the projects" title="Scroll"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="8" rx="2.2"/><rect x="4" y="13" width="16" height="8" rx="2.2"/></svg></button>
    </div>
  </div>
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

  /* (2026-08-25 her ask) the about section leads with ONE line — "I love designing
     experiences that make it easier for people to stay curious" is the real headline —
     and the rest of the writing folds away behind "The longer story", a btn-link that
     swaps labels once it is open. The paragraphs live in about.more; the reveal is the
     0fr→1fr grid-row transition in .about-more (no measuring, no jank), wired in makeJS. */
  const edu = site.about.education;
  const eduHTML = !edu || !edu.items ? '' : `
      <div class="about-creds">
        ${edu.items.map(it => `<div class="about-cred">
          <img src="${esc(it.logo)}?v=${BUILD_V}" alt="${esc(it.name)} logo" width="${esc(String(it.logoW))}" height="${esc(String(it.logoH))}" loading="lazy" decoding="async">
          <div><p class="cred-name">${esc(it.name)}</p><p class="cred-detail">${esc(it.detail)}</p></div>
        </div>`).join('\n        ')}
      </div>`;
  const aboutHTML = `
<section id="about" class="below-fold">
  <div class="about-band fade">
    <img class="headshot" src="${esc(site.about.headshot)}" alt="Portrait of ${esc(site.fullName)}" width="180" height="180" loading="lazy" decoding="async">
    <div>
      <p class="eyebrow">${esc(site.about.eyebrow)}</p>
      <h2 class="about-title"${twoLine(site.about.title, CORMORANT, 30)}>${typo(site.about.title)}</h2>
      <div class="about-more" id="about-more">
        <div>${[].concat(site.about.more).map(p => `<p class="about-body">${typo(p)}</p>`).join('\n        ')}</div>
      </div>
      <button class="btn-link teal about-toggle" type="button" aria-expanded="false" aria-controls="about-more"
        data-more="${esc(site.about.moreLabel)}" data-less="${esc(site.about.lessLabel)}"
        data-hand="${esc(site.about.moreLabel.replace(/[^ '!,.A-Za-z’]/g, '').trim().toUpperCase())}">${esc(site.about.moreLabel)}</button>
      ${eduHTML}
      <a class="btn outline" href="assets/resume.pdf?v=${BUILD_V}" target="_blank" rel="noopener" data-hand="${esc(site.about.resumeLabel.toUpperCase())}">${esc(site.about.resumeLabel)}</a>
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
  } else if (m.frame === 'mac') {
    inner = macFrame(m);
  } else if (m.type === 'video') {
    inner = `<div class="cs-media-frame" data-video>
      <img class="poster" src="${esc(asset(m.poster))}" alt="${esc(m.alt)}" loading="lazy" decoding="async" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
      ${videoTag(m)}
      <button class="play-btn btn icon solid" type="button" aria-label="Play video">${PLAY_IC}</button>
    </div>`;
    /* the frame needs intrinsic size: use aspect ratio wrapper */
    inner = `<div class="cs-media-frame" data-video style="aspect-ratio:16/9;background:var(--bg-deep-shade)">
      <img class="poster" src="${esc(asset(m.poster))}" alt="${esc(m.alt)}" loading="lazy" decoding="async" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
      <video muted loop playsinline preload="none" data-src="${esc(asset(m.src))}" poster="${esc(asset(m.poster))}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" aria-label="${esc(m.alt || '')}"></video>
      <button class="play-btn btn icon solid" type="button" aria-label="Play video">${PLAY_IC}</button>
    </div>`;
  } else if (m.type === 'image') {
    inner = `<div class="cs-media-frame"><img src="${esc(asset(m.src))}" alt="${esc(m.alt)}" loading="lazy" decoding="async"></div>`;
  } else if (m.type === 'phones') {
    /* frame:"phone" wraps raw screens in the CSS frame. Screens that already have a
       device drawn into the PNG are dropped in as plain images — never double-frame. */
    inner = `<div class="cs-phones">${m.items.map(it => {
      /* an item with note instead of src is an empty slot: the counterpart product
         has no screen to show, and the slot says so rather than repeating ours */
      const ph = it.note
        ? `<div class="cs-phone-none"><p>${typo(it.note)}</p></div>`
        : m.frame === 'phone'
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
  if (m.frame === 'mac') return `<div class="cs-hero-media" style="box-shadow:none;border-radius:0;overflow:visible">${macFrame(m, { eager: true })}</div>`;
  if (m.type === 'image') return `<div class="cs-hero-media"><img src="${esc(asset(m.src))}" alt="${esc(m.alt)}" loading="eager" decoding="async" fetchpriority="high"></div>`;
  if (m.type === 'video') return `<div class="cs-hero-media" data-video style="position:relative;aspect-ratio:16/9;background:var(--bg-deep-shade)">
    <img class="poster" src="${esc(asset(m.poster))}" alt="${esc(m.alt)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
    <video muted loop playsinline preload="none" data-src="${esc(asset(m.src))}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" aria-label="${esc(m.alt || '')}"></video>
    <button class="play-btn btn icon solid" type="button" aria-label="Play video">${PLAY_IC}</button></div>`;
  if (m.type === 'phones') return `<div class="cs-hero-phones">${m.items.map(it => m.frame === 'phone'
    ? phoneFrame(`<img src="${esc(it.src)}" alt="${esc(it.alt)}"${screenFit(it.src)} loading="eager" decoding="async">`, { island: m.island !== false })
    : `<img src="${esc(it.src)}" alt="${esc(it.alt)}" loading="eager" decoding="async">`).join('')}</div>`;
  if (m.type === 'phone-video') return `<div class="cs-hero-phone-video">${phoneFrame(
    `<img class="poster" src="${esc(asset(m.poster))}" alt="${esc(m.alt)}" loading="eager" decoding="async">${videoTag(m)}`,
    { attrs: ' data-video', island: m.island !== false,
      extra: '<button class="play-btn btn icon solid" type="button" aria-label="Play video">${PLAY_IC}</button>' })}</div>`;
  return '';
}

/* a plain page (her ask 2026-10-23 on the AI tools page: "the tool page is weird. Make it simpler
   looking. The title should be simpler."): one title, one line, then each tool as a plain heading,
   a sentence or two, and its screen in the bezel. No hero band, badges, meta, labels or next card. */
function renderSimpleCase(cs) {
  return head(`${cs.name} — ${site.title}`, cs.tagline) + `
${navBar('case')}
<main class="tools-page">
  <header class="tp-head">
    <h1 class="tp-title">${typo(cs.title)}</h1>
    <p class="tp-lead">${typo(cs.tagline)}</p>
  </header>
  ${cs.sections.map(s => `
  <section class="tp-tool fade">
    <h2 class="tp-h">${typo(s.heading)}</h2>
    ${s.body.map(p => `<p class="tp-p">${typo(p)}</p>`).join('')}
    ${macFrame(s.media)}
  </section>`).join('')}
</main>
` + footerHTML();
}

function renderCase(cs) {
  if (cs.layout === 'simple') return renderSimpleCase(cs);
  const tone = cs.heroTone === 'light' ? 'light' : '';
  /* the light hero band sits on cream, the default band is the deep green — so the chips
     take the on-deep inks there, the same switch the rest of that band already makes */
  const tagTone = tone ? '' : ' on-deep';
  const metaHTML = `<dl class="cs-meta fade">${cs.meta.map(m => `<div><dt>${esc(m.label)}</dt><dd>${m.href ? `<a href="${esc(m.href)}" target="_blank" rel="noopener">${esc(m.value)}</a>` : esc(m.value)}</dd></div>`).join('')}</dl>`;

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
    /* each section is one <section class="cs-section"> — the unit the scroll-linked
       crossfade owns (2026-08-25, from the Framer reference she sent): heading, body,
       evidence and captions arrive and leave the screen together, one thought at a time */
    return `
<section class="cs-section">
<div class="cs-row fade">
  <p class="cs-label">${esc(s.label)}</p>
  <div>
    <h2 class="cs-heading"${twoLine(s.heading, CORMORANT, 34)}>${typo(s.heading)}</h2>
    <div class="cs-body">${s.body.map(p => `<p>${typo(p)}</p>`).join('')}</div>
    ${quote}
  </div>
</div>${compare}${csMedia(s.media)}
</section>`;
  };

  const next = cases.find(c => c.slug === cs.next);
  /* the tease: the next case's own cover device, waiting under the card's top edge.
     Phone cases peek as a phone, shipped-site cases as the MacBook — the same frames
     the page above already used, at card scale. */
  const nextPeek = (() => {
    if (!next || !next.heroMedia) return '';
    const hm = next.heroMedia;
    if (hm.type === 'phones' || hm.type === 'phone-video') {
      const src = hm.type === 'phones' ? hm.items[0].src : hm.poster;
      return `<div class="cs-next-peek is-phone" aria-hidden="true">${phoneFrame(`<img src="${esc(src)}" alt="" loading="lazy" decoding="async">`, { island: hm.island !== false })}</div>`;
    }
    const src = /\.(mp4|webm)$/.test(hm.src || '') ? hm.poster : hm.src;
    return src ? `<div class="cs-next-peek is-mac" aria-hidden="true">${macFrame({ src, alt: '', url: hm.url, tab: hm.tab })}</div>` : '';
  })();
  const nextHTML = next ? `<div class="cs-next fade"><a class="cs-next-card" href="${esc(next.slug)}.html">${nextPeek}
    <div class="cs-next-copy"><p class="k">Next project</p><p class="t">${esc(next.title)}</p></div></a></div>` : '';

  const refl = cs.reflection ? `
<section class="cs-section">
<div class="cs-row fade">
  <p class="cs-label">${esc(cs.reflection.label || 'Reflection')}</p>
  <div>
    <h2 class="cs-heading"${twoLine(cs.reflection.heading, CORMORANT, 34)}>${typo(cs.reflection.heading)}</h2>
    <div class="cs-body">${cs.reflection.body.map(p => `<p>${typo(p)}</p>`).join('')}</div>
  </div>
</div>
</section>` : '';

  /* the glyph is a paint brush (2026-08-28, her ask — it replaced a component-shapes
     swatch): a round artist's brush, handle up, bristles down. Strokes only,
     currentColor, so the band tone and night mode both recolor it for free. */
  const dsIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/>
    <path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/>
  </svg>`;
  const dsLink = cs.designSystem ? `<a class="ds-link" href="${esc(cs.designSystem)}" target="_blank" rel="noopener"
      aria-label="View the design system" data-curious="View design system">${dsIcon}</a>` : '';

  return head(`${cs.name} — ${site.title}`, cs.tagline) + `
${navBar('case')}
<main>
<header class="cs-hero">
  <div class="cs-hero-band ${tone}">
    ${dsLink}
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
fs.writeFileSync(path.join(DIST, 'styles.css'), checkComments(makeCSS() + fs.readFileSync(path.join(ROOT, 'skin-walkthrough.css'), 'utf8')));
fs.writeFileSync(path.join(DIST, 'app.js'), makeJS());
/* the stick figure ships as-is — it is hand-written client JS, not generated */
fs.copyFileSync(path.join(ROOT, 'stickman.js'), path.join(DIST, 'stick.js'));
/* the koi ships as-is too (fish.js at the repo root), with three.js under it from
   vendor/ — COMMITTED files, not node_modules: Vercel and the Pages workflow both run
   this script in a clean checkout where nothing was ever npm-installed, so a dependency
   read from node_modules builds here and 404s in production. vendor/ holds BOTH
   three.module.min.js and three.core.min.js because the module imports its core half by
   RELATIVE path — they must land in the same directory. (To upgrade three: npm i three,
   copy the two files from node_modules/three/build/ into vendor/, commit.) Vendored
   rather than CDN'd so the site stays a folder of files with no third origin; nobody
   pays the ~150k gz unless they scroll near the about section (app.js lazy-imports). */
fs.copyFileSync(path.join(ROOT, 'fish.js'), path.join(DIST, 'fish.js'));
for (const f of ['three.module.min.js', 'three.core.min.js', 'gsap.min.js', 'ScrollTrigger.min.js']) {
  const src = path.join(ROOT, 'vendor', f);
  if (!fs.existsSync(src)) throw new Error(`build: vendor/${f} missing (three for fish.js, gsap + ScrollTrigger for the logo wisps and the phone work list)`);
  fs.mkdirSync(path.join(DIST, 'vendor'), { recursive: true });
  fs.copyFileSync(src, path.join(DIST, 'vendor', f));
}
/* lintIcons: a button (or anything acting as one) may not use a font character as its icon.
   Those glyphs are positioned by font metrics, not by the button, so they sit off-centre in
   a circle — the build fails and names the button instead of shipping it. Words in buttons
   are fine; only these icon characters are refused. */
const ICON_GLYPHS = /[‹›«»←→↑↓↗↘↖↙⇆⇄⇅✎✏✓✔✕✖×▶◀▸◂►◄❚⏸⏵⏴⌖☆★☰]/;
function lintIcons(html, page) {
  const bad = [];
  const strip = t => t.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').replace(/\$\{[^}]*\}/g, '');
  for (const m of html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)) if (ICON_GLYPHS.test(strip(m[1]))) bad.push(m[0].slice(0, 120));
  for (const m of html.matchAll(/<(\w+)\b[^>]*role="button"[^>]*>([^<]*)/g)) if (ICON_GLYPHS.test(m[2])) bad.push(m[0].slice(0, 120));
  for (const m of html.matchAll(/(?:textContent|innerText)\s*=\s*(['"`])([^'"`]*)\1/g)) if (ICON_GLYPHS.test(m[2])) bad.push(m[0].slice(0, 120));
  if (bad.length) throw new Error(`${page}: icon characters inside buttons — draw them as SVG (see ICONS in walkthrough.js):\n  ` + bad.join('\n  '));
  return html;
}
/* locally the home page carries the tweaker receiver for the logo wisps (studies/tweaker-logos/); never on Vercel */
const homePage = lintIcons(renderHome(), 'index.html');
fs.writeFileSync(path.join(DIST, 'index.html'), process.env.VERCEL ? homePage : homePage.replace('</body>', '<script src="studies/tweaker-deck/tweaker-receiver.js"></script>\n</body>'));
/* preview only (unlinked): the home page with the work list as the swipe deck (option C, see sdeckHTML; she ruled the first deck, B, "wrong") */
/* "template": "walkthrough" cases are the presented-live format (walkthrough.js) */
const renderWalkthrough = require('./walkthrough.js');
/* back-and-forth arrows at the top corners of EVERY case study (2026-10-23 her ask: "only the driftwood page has the back
   and forth arrows. they should all have back and forth arrows"; this overrides the old no-UI-arrows rule). The
   walkthrough pages draw their own; the others get the same pair here. Order = the home page's project order,
   wrapping round, except where a study names its own next. */
const ORDER = site.work.projects.map(p => p.slug).filter(sl => cases.some(c => c.slug === sl));
const ARROW = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const edgeArrows = cs => {
  const i = ORDER.indexOf(cs.slug), n = ORDER.length; if (i < 0 || n < 2) return '';
  const prev = cs.prev || ORDER[(i - 1 + n) % n], next = cs.next || ORDER[(i + 1) % n];
  return `<a class="cs-edge prev" href="${esc(prev)}.html" aria-label="Previous project">${ARROW('M19 12 L5 12 M11 6 L5 12 L11 18')}</a>`
    + `<a class="cs-edge next" href="${esc(next)}.html" aria-label="Next project">${ARROW('M5 12 L19 12 M13 6 L19 12 L13 18')}</a>`;
};
for (const cs of cases) fs.writeFileSync(path.join(DIST, `${cs.slug}.html`), lintIcons(
  cs.template === 'walkthrough' ? renderWalkthrough(cs, { esc, asset, site, cases, ROOT, phoneFrame, screenFit, PHONE_CSS })
    : renderCase(cs).replace(/(<body[^>]*>)/, '$1' + edgeArrows(cs)), `${cs.slug}.html`));
fs.writeFileSync(path.join(DIST, 'app.js'), lintIcons(fs.readFileSync(path.join(DIST, 'app.js'), 'utf8'), 'app.js'));
copyDir(path.join(ROOT, 'assets'), path.join(DIST, 'assets'));
/* the design-system showcase pages are standalone HTML (their own tokens, their own
   fonts) — copied through as-is, reachable from each case study's ds-link icon.
   The repo README rides along as the folder's "read the rules" link: the hub at
   design-systems/index.html mirrors the workshop hub (landing → rules → system),
   and the rules doc IS this README — one file, never two copies to drift. */
copyDir(path.join(ROOT, 'design-systems'), path.join(DIST, 'design-systems'));
/* design studies (preview only): standalone playable studies served at /studies/<name>/ */
if (!process.env.VERCEL && fs.existsSync(path.join(ROOT, 'studies'))) copyDir(path.join(ROOT, 'studies'), path.join(DIST, 'studies'));
fs.copyFileSync(path.join(ROOT, 'README.md'), path.join(DIST, 'design-systems', 'README.md'));

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
