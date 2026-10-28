/* THE LOGO (her 2026-10-27: "you didnt use the gooey stretched logo" → "1"): M and K pulled apart, joined by the gooey
   strand, exactly the moment in the home page loader just before clay-her snaps it. The loader breaks the logo; the
   nav shows it whole again.
   Drawn as SVG in the site's own face (Plus Jakarta Sans 600) so it stays type: the letters are <text>, the strand a
   tapered shape between them, and the same blur + threshold goo filter as the loader melts the joins. Geometry is
   the loader's at full stretch, measured once at 100px (Chrome, 2026-10-27): M ink right 79.7, K at 203.6 with its
   ink starting at 211.3, the hyphen's centre 27.9 above the baseline, its stroke 10.6; the strand's thickness, neck and
   goo are HER loader study's numbers, read from data/loader.json.
   The pieces keep the wm-m / wm-d / wm-k classes, so the nav's greeting (M and K start together and spread) and its
   hover (they close up as the strand folds away) still work: --wm-dx is half the gap, in the SVG's own units. */
/* the goo's numbers come from her loader study (data/loader.json), the one source: thin middle, fat ends, neck, blur */
const L = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'data/loader.json'), 'utf8')).values;
const STROKE = 10.58 * (L.thick || 1), Y = -27.88, XA = 79.7, XB = 211.33, KX = 203.63, THIN = Math.max(L.thin, .62),   // never thinner than .62 of a hyphen in the nav: at ~23px tall a thinner neck is under a pixel and the goo erases it, so the strand looked cut in two (her 2026-10-27: "the logo stretch center is disconnected")
   FAT = L.endFat, NECK = L.taper;

function strand() {
  const N = 24, L = [], R = [], w = u => STROKE * (THIN + (FAT - THIN) * Math.pow(Math.abs(2 * u - 1), NECK));
  for (let i = 0; i <= N; i++) { const u = i / N, x = XA + (XB - XA) * u, h = w(u) / 2; L.push([x, Y - h]); R.push([x, Y + h]); }
  const f = n => n.toFixed(2), h0 = w(0) / 2;
  let d = 'M' + f(L[0][0]) + ' ' + f(L[0][1]);
  for (let i = 1; i <= N; i++) d += 'L' + f(L[i][0]) + ' ' + f(L[i][1]);
  d += 'L' + f(R[N][0]) + ' ' + f(R[N][1]);   // flat where it meets K (no bulge into the letter)
  for (let i = N - 1; i >= 0; i--) d += 'L' + f(R[i][0]) + ' ' + f(R[i][1]);
  return d + 'Z';   // flat where it meets M
}
const D = strand();

/* THE LIVE GOO VERSION: only the source the baked shapes are traced from now (tools/trace-wordmark.mjs).
   id: a unique suffix per copy on a page, so each has its own filter */
function liveSVG(id) {
  const font = "font:600 100px 'Plus Jakarta Sans',system-ui,sans-serif";
  return `<svg class="wm-svg" viewBox="${module.exports.VIEW.join(' ')}" role="img" aria-label="M--K" focusable="false" style="--wm-dx:${((XB - XA) / 2).toFixed(1)}px">` +
    `<defs><filter id="wm-goo-${id}" x="-10%" y="-20%" width="120%" height="140%" color-interpolation-filters="sRGB">` +
    `<feGaussianBlur in="SourceGraphic" stdDeviation="${L.goo}" result="b"/><feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${L.sharp} -${(L.sharp * .45).toFixed(2)}"/></filter></defs>` +
    /* the goo stays on everything; only the empty space inside the M and the K is kept clear of it (her: "dont like the
       internal bulge"): a mask lets only the letters themselves (a hair wider) show between each letter's stems */
    `<mask id="wm-in-${id}" maskUnits="userSpaceOnUse" x="-10" y="-100" width="300" height="120"><rect x="-10" y="-100" width="300" height="120" fill="#fff"/>` +
    /* each letter's stencil moves WITH its letter (same wm-m / wm-k class, so the same hover, greeting and pop transforms):
       a still stencil sliced the letters while they slid together and apart (her 2026-10-27: "it does this weird warping thing") */
    `<g class="wm-m"><rect x="20.9" y="-74.5" width="45.6" height="74.5" fill="#000"/><text x="0" y="0" style="${font}" fill="#fff" stroke="#fff" stroke-width="3">M</text></g>` +
    `<g class="wm-k"><rect x="224.5" y="-74.5" width="45.1" height="74.5" fill="#000"/><text x="${KX}" y="0" style="${font}" fill="#fff" stroke="#fff" stroke-width="3">K</text></g></mask>` +
    `<g mask="url(#wm-in-${id})"><g filter="url(#wm-goo-${id})" fill="currentColor"><text class="wm-m" x="0" y="0" style="${font}">M</text>` +
    `<path class="wm-d" d="${D}"/><text class="wm-k" x="${KX}" y="0" style="${font}">K</text></g></g></svg>`;
}

/* WHAT THE SITE SHOWS: the same logo with its goo baked into three plain shapes (data/wordmark-paths.json, traced from
   liveSVG at 16x). Safari paints a live goo filter at one pixel per CSS pixel, soft and blocky at ~23px on every iPhone
   (her 2026-10-27: "the logo in the corner needs to be the same as well across devices and the logo motion in the corner
   needs to be the same across devices"); shapes are drawn the same by every browser, sharp at any density, and need no
   font. The pieces keep wm-m / wm-d / wm-k, so the greeting, hover and pop move them exactly as before */
let P = null;
function wordmarkSVG() {
  P = P || JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'data/wordmark-paths.json'), 'utf8'));
  return `<svg class="wm-svg" viewBox="${P.viewBox.join(' ')}" role="img" aria-label="M--K" focusable="false" style="--wm-dx:${((XB - XA) / 2).toFixed(1)}px">` +
    `<g fill="currentColor"><path class="wm-m" d="${P.m}"/><path class="wm-d" d="${P.d}"/><path class="wm-k" d="${P.k}"/></g></svg>`;
}
module.exports = wordmarkSVG;
module.exports.liveSVG = liveSVG;
module.exports.VIEW = [2, -84, 276, 92];
