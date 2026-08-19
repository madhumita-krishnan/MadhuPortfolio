/* Lift the ACTUAL painted flowers out of Madhu's reference image.

   `color pallete I like.png` (the Orange & Mellow candle packaging) is the source of the
   whole terracotta system. Every previous attempt DREW flowers from a description of it and
   she rejected all of them — "you keep re making the flowers, i need use the literal flowers
   from the picture as is". So this tool does no drawing. It cuts her artwork out of the
   photograph pixel-for-pixel and hands the hero the real thing.

   Three things have to be right or the cut-out betrays itself:

   1. KEY, don't threshold. The paper is exactly #F5EAD3 and every petal edge is a soft
      brush blend into it. A hard threshold gives a jagged sticker outline. Alpha instead
      ramps over a colour-distance window, so the brush edge survives as a brush edge.

   2. UNPREMULTIPLY. An edge pixel is C = a*ink + (1-a)*paper. Ship that as-is and the
      flower carries a ring of the ORIGINAL cream around it, which glows against our page
      cream (#F6F0E2) wherever it overlaps something else. Solving back for the pure ink,
      F = (C - (1-a)*paper)/a, gives straight alpha that composites over anything.

   3. RE-CRISP AFTER UPSCALING. The source bloom is only ~260px wide but the hero runs it
      off both edges of a 1440px viewport, so it has to grow ~3x. Catmull-Rom alone leaves
      a mushy silhouette and she is sensitive to soft images. Upscaling on PREMULTIPLIED
      values (no dark halo), then steepening the alpha ramp back to its original width,
      keeps the outline as sharp as the original while the interior brush texture stays
      smooth. Sharp edge + soft interior is what reads as paint rather than as a blur.

   The wordmark ("ORANGE & MELLOW" and its rule) keys in like everything else, so anything
   under MIN_AREA px is dropped as a connected component before cropping.

   Run:  node tools/lift-flowers.js
   Out:  assets/hero/bloom-left.png, bloom-right.png  (+ --debug writes the full keyed sheet)
*/
const fs = require('fs');
const path = require('path');
const { decode, encode } = require('./png.js');

/* The lift now reads a 4x super-resolved copy of the reference, not the reference
   itself. hero-src/color-palette-4x.png is the SAME artwork — Real-ESRGAN x4plus run
   over `color pallete I like.png` (486x886 → 1944x3544), which recovers a crisp brush
   edge and the paint speckle instead of inventing them at display time. The shapes are
   untouched: this is her literal paint, only resolved. All hand-tuned coordinates below
   (ERASE, CUTS) stay in ORIGINAL source pixels and are scaled by SRCS at use, so they
   never need retuning. Regenerate the sheet with Real-ESRGAN x4plus if the reference
   ever changes (see the 2026-08-18 commit for the exact script). */
const SRC = path.join(__dirname, '..', 'hero-src', 'color-palette-4x.png');
const SRCS = 4; // source pixels per original-reference pixel
const OUT = path.join(__dirname, '..', 'assets', 'hero');

const PAPER = [249, 236, 213]; // sampled from the SR sheet (drifted ~4 units from the raw scan's 245,234,211)
const KEY_LO = 26;   // colour distance where the paper starts becoming ink
const KEY_HI = 92;   // ...and where it is fully ink
const MIN_AREA = 900; // drops the rule and the "EST'D 2024" line
/* Published size is unchanged (3x the ORIGINAL reference, ~786px wide) — but the path
   there is now a 0.75x DOWNSCALE of real 4x detail instead of a 3x blow-up, so every
   output pixel is earned. */
const SCALE = 3 / SRCS;
/* How far the coverage ramp is squeezed at the silhouette. 1 leaves the resampled edge
   alone; higher is a harder outline. 2.6 lands the edge at roughly the width it had in the
   source, i.e. still a brush edge and not a die cut. */
const EDGE_GAIN = 1.35; // was 2.6 when the ramp had been stretched 3x; the downsampled ramp is already brush-width

/* The set wordmark keys in exactly like the paint does, and "ORANGE & MELLOW" is at display
   size so its letters clear MIN_AREA on their own. Blanked by hand instead. */
const ERASE = [{ x0: 96, y0: 396, x1: 392, y1: 484 }];

/* The two blooms, in source pixels. Each cut runs to the edge of the sheet on the side that
   will hang off the screen, and carries the teal stem the bloom is actually attached to —
   in her reference a stem only ever appears with its flower. */
const CUTS = [
  { name: 'bloom-left',  x0: 0,   y0: 0,   x1: 300, y1: 560 },
  { name: 'bloom-right', x0: 215, y0: 250, x1: 486, y1: 886 },
];

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Colour-distance key → straight-alpha RGBA. */
function keyPaper(img) {
  const { width: w, height: h, data: src } = img;
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const r = src[i * 4], g = src[i * 4 + 1], b = src[i * 4 + 2];
    const dist = Math.abs(r - PAPER[0]) + Math.abs(g - PAPER[1]) + Math.abs(b - PAPER[2]);
    const a = clamp((dist - KEY_LO) / (KEY_HI - KEY_LO), 0, 1);
    if (a <= 0) continue;
    // straight alpha: undo the blend with the paper this pixel is sitting on
    out[i * 4]     = clamp(Math.round((r - (1 - a) * PAPER[0]) / a), 0, 255);
    out[i * 4 + 1] = clamp(Math.round((g - (1 - a) * PAPER[1]) / a), 0, 255);
    out[i * 4 + 2] = clamp(Math.round((b - (1 - a) * PAPER[2]) / a), 0, 255);
    out[i * 4 + 3] = Math.round(a * 255);
  }
  return { width: w, height: h, data: out };
}

/** Zero out any blob smaller than MIN_AREA — that is the wordmark, not the art. */
function dropSpecks(img) {
  const { width: w, height: h, data } = img;
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const blob = new Int32Array(w * h);
  let dropped = 0;
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || data[s * 4 + 3] < 90) continue;
    let sp = 0, n = 0;
    stack[sp++] = s; seen[s] = 1;
    while (sp) {
      const p = stack[--sp];
      blob[n++] = p;
      const x = p % w, y = (p / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (!seen[q] && data[q * 4 + 3] >= 90) { seen[q] = 1; stack[sp++] = q; }
      }
    }
    if (n < MIN_AREA * SRCS * SRCS) {
      for (let i = 0; i < n; i++) data[blob[i] * 4 + 3] = 0;
      dropped++;
    }
  }
  return dropped;
}

function crop(img, x0, y0, x1, y1) {
  const w = x1 - x0, h = y1 - y0;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    img.data.copy(out, y * w * 4, ((y + y0) * img.width + x0) * 4, ((y + y0) * img.width + x1) * 4);
  }
  return { width: w, height: h, data: out };
}

/* Lanczos-3, separable, on premultiplied float RGBA.

   It replaced Catmull-Rom because she asked for the blooms to be "way sharper" and
   Catmull-Rom is the wrong tool for a 3x blow-up: its 4-tap kernel is a smoothing spline,
   so it interpolates cleanly but carries almost none of the source's high frequency
   forward. The brush striations inside each petal and the dark rust line around it are
   exactly that high frequency, and they were arriving as mush. Lanczos' windowed sinc has
   negative lobes, which is what puts an edge back on an edge.

   Premultiplied matters either way: interpolating raw colour across a transparent
   neighbour drags that neighbour's (undefined) colour into the edge. */
const LOBES = 3;
const sinc = x => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
const lanczos = x => (Math.abs(x) < 1e-8 ? 1 : Math.abs(x) >= LOBES ? 0 : sinc(x) * sinc(x / LOBES));

/** Precompute the taps for one axis: for each dest index, which source pixels and weights. */
function taps(srcLen, dstLen) {
  const k = dstLen / srcLen;
  /* downscaling (k<1) must widen the kernel to 1/k source pixels per lobe — a fixed
     footprint would alias the paint speckle into moire; upscaling keeps it at LOBES */
  const scale = Math.min(1, k);
  const support = LOBES / scale;
  const rows = [];
  for (let d = 0; d < dstLen; d++) {
    const center = (d + 0.5) / k - 0.5;
    const lo = Math.ceil(center - support), hi = Math.floor(center + support);
    const idx = [], wt = [];
    let sum = 0;
    for (let s = lo; s <= hi; s++) {
      const w = lanczos((s - center) * scale);
      if (w === 0) continue;
      idx.push(clamp(s, 0, srcLen - 1)); wt.push(w); sum += w;
    }
    for (let i = 0; i < wt.length; i++) wt[i] /= sum; // unity gain, no brightness drift
    rows.push({ idx, wt });
  }
  return rows;
}

function upscale(img, k) {
  const { width: sw, height: sh, data: src } = img;
  const w = Math.round(sw * k), h = Math.round(sh * k);

  // premultiply once into floats — the two passes both read this
  const pm = new Float32Array(sw * sh * 4);
  for (let i = 0; i < sw * sh; i++) {
    const a = src[i * 4 + 3] / 255;
    pm[i * 4] = src[i * 4] * a; pm[i * 4 + 1] = src[i * 4 + 1] * a;
    pm[i * 4 + 2] = src[i * 4 + 2] * a; pm[i * 4 + 3] = src[i * 4 + 3];
  }

  // horizontal pass: sw x sh → w x sh
  const tx = taps(sw, w);
  const mid = new Float32Array(w * sh * 4);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < w; x++) {
      const { idx, wt } = tx[x];
      let r = 0, g = 0, b = 0, a = 0;
      for (let i = 0; i < idx.length; i++) {
        const p = (y * sw + idx[i]) * 4, q = wt[i];
        r += pm[p] * q; g += pm[p + 1] * q; b += pm[p + 2] * q; a += pm[p + 3] * q;
      }
      const o = (y * w + x) * 4;
      mid[o] = r; mid[o + 1] = g; mid[o + 2] = b; mid[o + 3] = a;
    }
  }

  // vertical pass: w x sh → w x h
  const ty = taps(sh, h);
  const out = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const { idx, wt } = ty[y];
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let i = 0; i < idx.length; i++) {
        const p = (idx[i] * w + x) * 4, q = wt[i];
        r += mid[p] * q; g += mid[p + 1] * q; b += mid[p + 2] * q; a += mid[p + 3] * q;
      }
      const o = (y * w + x) * 4;
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = a;
    }
  }
  return { width: w, height: h, data: out }; // still premultiplied float
}

/* ---- resolve: sharpen, harden the silhouette, return real pixels ----------------------

   A 3x blow-up of a 262px painting cannot invent detail, but almost all of the "it looks
   blurry" signal is local CONTRAST, not resolution — the dark rust line the brush leaves
   where two petals meet, and the striations along each petal. Those survive the upscale at
   the right position and the wrong amplitude. An unsharp mask puts the amplitude back.

   RADIUS is tied to SCALE on purpose: after a 3x upscale the finest real feature in the
   source is 3px across here, so blurring by ~half that and adding back the difference
   targets exactly the frequency band the resample flattened. A larger radius would just
   draw halos around the petals.

   Alpha is sharpened separately, and not with the same tool. Unsharp on a coverage channel
   rings — it overshoots past 1 inside the edge and below 0 outside it, which shows up as a
   pale outline hugging the flower. A smoothstep remap around the midpoint narrows the
   coverage ramp without ever leaving [0,1], so the silhouette hardens cleanly. */
/* Down from 0.9/1.65: the detail is real now, so the unsharp mask is a finish, not a
   rescue — 0.9 on top of true 4x texture crunched the speckle into grit. */
const SHARP_AMOUNT = 0.5;
const SHARP_RADIUS = 0.8;

/** Separable Gaussian on a premultiplied float RGBA buffer; alpha is copied, not blurred. */
function blurRGB(buf, w, h, radius) {
  const r = Math.max(1, Math.ceil(radius * 2.5));
  const sig = radius, k = new Float32Array(r * 2 + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) { const v = Math.exp(-(i * i) / (2 * sig * sig)); k[i + r] = v; sum += v; }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  const tmp = new Float32Array(w * h * 4), out = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = 0, b = 0, c = 0;
    for (let i = -r; i <= r; i++) {
      const p = (y * w + clamp(x + i, 0, w - 1)) * 4, q = k[i + r];
      a += buf[p] * q; b += buf[p + 1] * q; c += buf[p + 2] * q;
    }
    const o = (y * w + x) * 4; tmp[o] = a; tmp[o + 1] = b; tmp[o + 2] = c;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = 0, b = 0, c = 0;
    for (let i = -r; i <= r; i++) {
      const p = (clamp(y + i, 0, h - 1) * w + x) * 4, q = k[i + r];
      a += tmp[p] * q; b += tmp[p + 1] * q; c += tmp[p + 2] * q;
    }
    const o = (y * w + x) * 4; out[o] = a; out[o + 1] = b; out[o + 2] = c;
  }
  return out;
}

const smoothstep = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** premultiplied float RGBA → straight-alpha 8-bit RGBA, sharpened. */
function resolve(img) {
  const { width: w, height: h, data: f } = img;
  const blur = blurRGB(f, w, h, SHARP_RADIUS);
  const out = Buffer.alloc(w * h * 4);
  const half = 1 / EDGE_GAIN; // width of the coverage ramp after hardening
  for (let i = 0; i < w * h; i++) {
    const cov = clamp(f[i * 4 + 3] / 255, 0, 1); // Lanczos can ring past the ends
    let a = smoothstep((cov - 0.5) / half + 0.5);
    out[i * 4 + 3] = Math.round(a * 255);
    if (a <= 0) continue;
    for (let c = 0; c < 3; c++) {
      const sharp = f[i * 4 + c] + SHARP_AMOUNT * (f[i * 4 + c] - blur[i * 4 + c]);
      // un-premultiply with the RESAMPLED coverage, not the hardened one — the hardened
      // alpha is a display decision, the resampled one is what the colour was mixed with
      out[i * 4 + c] = clamp(Math.round(sharp / clamp(cov, 0.004, 1)), 0, 255);
    }
  }
  return { width: w, height: h, data: out };
}

/* Drop the slivers a rectangular cut leaves behind. Clipping through a neighbouring stem
   strands a bare teal streak, and a stem with no flower on the end of it reads as a scratch
   across the copy rather than as botany. Not "keep the largest blob", though: the top-left
   bloom is painted as TWO overlapping petal masses that never quite touch, so keeping one
   would throw away half the flower. Anything within KEEP_FRAC of the biggest blob is real
   art; the rest is a clipped stem. */
const KEEP_FRAC = 0.18;

function dropOrphans(img) {
  const { width: w, height: h, data } = img;
  const lab = new Int32Array(w * h).fill(-1);
  const stack = new Int32Array(w * h);
  const areas = [];
  for (let s = 0; s < w * h; s++) {
    if (lab[s] >= 0 || data[s * 4 + 3] < 90) continue;
    const id = areas.length;
    let sp = 0, n = 0;
    stack[sp++] = s; lab[s] = id;
    while (sp) {
      const p = stack[--sp]; n++;
      const x = p % w, y = (p / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (lab[q] < 0 && data[q * 4 + 3] >= 90) { lab[q] = id; stack[sp++] = q; }
      }
    }
    areas.push(n);
  }
  const max = Math.max(...areas, 1);
  const keep = areas.map(a => a >= max * KEEP_FRAC);
  for (let i = 0; i < w * h; i++) if (lab[i] < 0 || !keep[lab[i]]) data[i * 4 + 3] = 0;
  return { kept: keep.filter(Boolean).length, dropped: keep.filter(k => !k).length, areas };
}

/* These two PNGs load eagerly at the top of the home page, so their weight is the hero's
   time-to-paint. Two things make them far bigger than the art warrants:
   - unpremultiplying divides by alpha, so pixels that are 2% opaque come out as amplified
     colour noise. They are invisible, but deflate has to store every byte of them.
   - the paint is continuous tone, and full 8-bit colour keeps gradations no eye can see.
   Flattening the invisible pixels and quantising takes bloom-left from ~1230kb to a third
   of that with no visible change to the brushwork.

   The step was 4 (64 levels) while the blooms sat at 82% opacity behind the copy. They now
   sit at full strength and are the sharpest thing in the hero, and at 64 levels the unsharp
   mask's fine tonal steps along a petal collapse into visible banding — which is the exact
   opposite of the ask. 2 (128 levels) keeps the striations smooth and still compresses. */
const QUANT = 2;

function slim(img) {
  const { data } = img;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 10) { data[i] = data[i + 1] = data[i + 2] = 0; data[i + 3] = 0; continue; }
    for (let c = 0; c < 3; c++) data[i + c] = Math.min(255, Math.round(data[i + c] / QUANT) * QUANT);
  }
  return img;
}

/** Shrink the box to the art actually present, so CSS positions the bloom and not padding. */
function trim(img) {
  const { width: w, height: h, data } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > 8) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return img;
  return crop(img, x0, y0, x1 + 1, y1 + 1);
}

const src = decode(fs.readFileSync(SRC));
console.log(`source ${path.basename(SRC)}  ${src.width}x${src.height}`);
const keyed = keyPaper(src);
for (const e of ERASE) {
  for (let y = e.y0 * SRCS; y < e.y1 * SRCS; y++) for (let x = e.x0 * SRCS; x < e.x1 * SRCS; x++) keyed.data[(y * keyed.width + x) * 4 + 3] = 0;
}
console.log(`keyed the paper out; blanked ${ERASE.length} wordmark rect, dropped ${dropSpecks(keyed)} specks`);

if (process.argv.includes('--debug')) {
  fs.writeFileSync(path.join(OUT, 'sheet-keyed.png'), encode(keyed));
  console.log('  wrote assets/hero/sheet-keyed.png (whole sheet, debug)');
}

for (const c of CUTS) {
  const cut = crop(keyed, c.x0 * SRCS, c.y0 * SRCS, c.x1 * SRCS, c.y1 * SRCS);
  const { kept, dropped, areas } = dropOrphans(cut);
  const piece = trim(cut);
  const big = slim(resolve(upscale(piece, SCALE)));
  const file = path.join(OUT, `${c.name}.png`);
  fs.writeFileSync(file, encode(big));
  console.log(`  ${c.name}.png  ${piece.width}x${piece.height} → ${big.width}x${big.height}  ` +
    `${(fs.statSync(file).size / 1024).toFixed(0)}kb  ` +
    `(kept ${kept} of ${kept + dropped} blobs; areas ${areas.slice().sort((a, b) => b - a).slice(0, 6).join(',')})`);
}
