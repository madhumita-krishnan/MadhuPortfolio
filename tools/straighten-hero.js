#!/usr/bin/env node
/* Straightens the hero handwriting so it reads as SET TYPE in her hand, rather than as
   wobbly handwriting.
   Input : assets/hero/hero-line-handwritten.png   (the live mask — the only file that
                                                    carries the current sentence)
   Output: assets/hero/hero-line-handwritten-straight.png   (--apply overwrites the live one)

   The brief: "my handwriting is a font". A font has one baseline per line, one slant, one
   side bearing and one word space. Her hand has four lines of each. So every letter is
   lifted off the page as its own object and re-set on a grid measured from her own hand —
   nothing here is a hardcoded design decision, every target is a median of what she
   already did.

   ── why it is built this way (all of these are past failures, don't undo them) ─────────
   * COMPONENTS, NOT ROWS. The written lines physically overlap: the descender of "designer"
     hangs 110px below its own baseline, straight through the x-height of "curious" below
     it. A horizontal projection would slice glyphs in half.
   * LINES ARE CLUSTERED ON THE TOP EDGE. A descender hangs below its line but its top still
     sits on it, so y0 is the stable signal and y1/centre are not.
   * MERGE ONLY WITHIN A LINE. The i-dots, the pinhole islands and (if the lift ever breaks
     them off again) the closed ovals of the `g` descenders have to be glued back onto the
     letter they belong to. But merging on "x overlaps and is vertically close" across the
     whole page glues the `g` of "designer" onto the "ow" of "how" — its oval ends 24px
     above their tops. So lines are grouped first, merging happens inside a line.
   * A GLYPH'S BASELINE IS ITS OWN BOTTOM EDGE. Her hand is print, not cursive, so bottoms
     align. The exception is a real descender, and a real descender is found by SHAPE (a
     narrow neck below the body), never by "how far below the fitted line it sits" — her
     descenders run 20px (p) to 110px (g), and a depth threshold big enough to catch the g
     calls the 20px tail on `n`/`x` a descender while a small one calls the ordinary
     23px foot of `m` one and lifts it. That stagger looks worse than the wobble.
   * NEVER BLUR AND RE-THRESHOLD, and never resample. Every transform below is an integer
     pixel translation (the shear is a per-row integer shift), so the stroke keeps its
     exact weight and its edges stay as crisp as the source. Nothing is scaled up.

   ── what it does, in order ─────────────────────────────────────────────────────────────
     1. label connected components on the alpha channel (ink > 40), carrying the soft
        antialiased fringe with whichever component owns it
     2. cluster components into the written lines by top edge
     3. merge components that are one glyph: dots, fragments, pinholes, detached descender
        ovals — anything that sits directly above/below a neighbour with overlapping x
     4. find each glyph's baseline (own bottom, or body bottom if it has a descender) and
        shift it onto one horizontal baseline per line
     5. measure each glyph's slant from the second moments of its ink and shear it to the
        median slant, so the whole line leans the way she leans on average
     6. re-space: one side bearing inside a word, one word space between words, both the
        median of her own; punctuation keeps its original tuck
     7. re-set the lines on even leading, flush to one left margin

   Re-run: node tools/straighten-hero.js [--in F] [--out F] [--apply] [--no-slant]
           [--no-space] [--slant-max DEG] [--debug]
*/
const fs = require('fs');
const path = require('path');
const { decode, encode } = require('./png');

const HERE = path.join(__dirname, '..', 'assets', 'hero');
const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const flag = k => process.argv.includes(k);

const IN = path.resolve(arg('--in', path.join(HERE, 'hero-line-handwritten.png')));
const OUT = path.resolve(arg('--out', path.join(HERE, 'hero-line-handwritten-straight.png')));
const LIVE = path.join(HERE, 'hero-line-handwritten.png');
const DO_SLANT = !flag('--no-slant');
const DO_SPACE = !flag('--no-space');
const SLANT_MAX = Math.tan((+arg('--slant-max', 9)) * Math.PI / 180);
const DEBUG = flag('--debug');

const src = decode(fs.readFileSync(IN));
const W = src.width, H = src.height;
const A = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) A[i] = src.data[i * 4 + 3];

const INK = 40;                       // same ink threshold the rest of the toolchain uses
const median = a => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const quantile = (a, q) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
};

/* ─────────────────────────────────────────────────── 1. components (+ their fringe) */
/* Same 8-connected flood fill as tools/clean-handwriting.js — kept local rather than
   imported because that file is a script, not a module. */
function label(alpha) {
  const lab = new Int32Array(W * H).fill(-1), comps = [], stack = [];
  for (let seed = 0; seed < W * H; seed++) {
    if (alpha[seed] <= INK || lab[seed] !== -1) continue;
    const c = { id: comps.length, area: 0, x0: 1e9, y0: 1e9, x1: -1, y1: -1, px: [] };
    lab[seed] = c.id; stack.push(seed);
    while (stack.length) {
      const q = stack.pop(), qx = q % W, qy = (q / W) | 0;
      c.area++; c.px.push(q);
      if (qx < c.x0) c.x0 = qx; if (qx > c.x1) c.x1 = qx;
      if (qy < c.y0) c.y0 = qy; if (qy > c.y1) c.y1 = qy;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = qx + dx, ny = qy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (lab[n] === -1 && alpha[n] > INK) { lab[n] = c.id; stack.push(n); }
      }
    }
    comps.push(c);
  }
  return { comps, lab };
}

let { comps, lab } = label(A);
const owner = Int32Array.from(lab);          // which component every pixel belongs to

/* The antialiased fringe (0 < alpha <= 40) is what keeps the strokes from looking cut out
   of paper. It has no component of its own, so it is handed to the nearest solid pixel by
   a 3-step multi-source flood. Fringe further than that from any ink is lift noise and is
   dropped — which is the only ink this tool ever discards. */
{
  let front = [];
  for (let i = 0; i < W * H; i++) if (owner[i] >= 0) front.push(i);
  for (let step = 0; step < 3; step++) {
    const next = [];
    for (const p of front) {
      const px = p % W, py = (p / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = px + dx, ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (owner[n] === -1 && A[n] > 0) { owner[n] = owner[p]; next.push(n); }
      }
    }
    front = next;
  }
  for (let i = 0; i < W * H; i++) if (owner[i] >= 0 && A[i] <= INK) comps[owner[i]].px.push(i);
}

const DUST = 8;                              // her i-dots are 22-55px; lift grain is 1-9px
const dropped = comps.filter(c => c.area < DUST);
comps = comps.filter(c => c.area >= DUST);
console.log(`components: ${comps.length}  (dropped ${dropped.length} specks < ${DUST}px)`);

/* ─────────────────────────────────────────────────────── 2. lines, by TOP edge only */
const tops = comps.map(c => c.y0).sort((a, b) => a - b);
const cuts = [];
for (let i = 1; i < tops.length; i++) if (tops[i] - tops[i - 1] > 60) cuts.push((tops[i] + tops[i - 1]) / 2);
console.log('line cuts at y =', cuts.map(Math.round).join(', '));
const lineOf = c => cuts.filter(k => c.y0 > k).length;
const rawLines = [];
for (const c of comps) (rawLines[lineOf(c)] ||= []).push(c);

/* ───────────────────────────── 3. merge the components that are really one glyph */
/* A dot, a broken-off fragment, a pinhole island or a detached descender oval sits
   directly above or below the stroke it belongs to and shares most of its x range. */
const GAP_V = 34;                            // vertical slack between the two pieces
const overlapX = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + 1;
const spanX = c => c.x1 - c.x0 + 1;

const glyphLines = rawLines.map((line, li) => {
  const parent = line.map((_, i) => i);
  const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const join = (i, j) => { const a = find(i), b = find(j); if (a !== b) parent[a] = b; };

  for (let i = 0; i < line.length; i++) for (let j = 0; j < line.length; j++) {
    if (i === j) continue;
    const a = line[i], b = line[j];
    const ov = overlapX(a, b);
    if (ov <= 0) continue;
    const share = ov / Math.min(spanX(a), spanX(b));
    // a pinhole / fragment fully swallowed by another component's box
    const inside = b.x0 >= a.x0 - 3 && b.x1 <= a.x1 + 3 && b.y0 >= a.y0 - 3 && b.y1 <= a.y1 + 3;
    // b hangs below a (detached descender oval) or floats above it (i-dot, apostrophe tip)
    const stacked = share >= 0.5 &&
      ((b.y0 > a.y1 && b.y0 - a.y1 <= GAP_V) || (a.y0 > b.y1 && a.y0 - b.y1 <= GAP_V));
    if (inside || stacked) join(i, j);
  }

  const groups = new Map();
  line.forEach((c, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(c);
  });
  const glyphs = [...groups.values()].map(parts => {
    const g = {
      line: li, parts, px: [].concat(...parts.map(p => p.px)),
      area: parts.reduce((s, p) => s + p.area, 0),
      x0: Math.min(...parts.map(p => p.x0)), x1: Math.max(...parts.map(p => p.x1)),
      y0: Math.min(...parts.map(p => p.y0)), y1: Math.max(...parts.map(p => p.y1)),
      // the piece that sits ON the line — used as the fallback body bottom for a glyph
      // whose descender came off as its own component
      anchor: parts.reduce((best, p) => (!best || p.area > best.area ? p : best), null),
    };
    return g;
  });
  glyphs.sort((a, b) => a.x0 - b.x0);
  const merged = line.length - glyphs.length;
  console.log(`line ${li}: ${line.length} components → ${glyphs.length} glyphs (${merged} merged in)`);
  return glyphs;
});

/* ───────────────────────────────────────────── 4. baselines, one horizontal per line */
/* row ink profile of a glyph: how many ink pixels each row holds, and how wide the row's
   ink spans. The two disagree in a useful way — see the descender test below. */
const rowProfile = g => {
  const n = g.y1 - g.y0 + 1;
  const ink = new Int32Array(n), lo = new Int32Array(n).fill(1e9), hi = new Int32Array(n).fill(-1);
  for (const p of g.px) {
    if (A[p] <= INK) continue;
    const y = ((p / W) | 0) - g.y0, x = p % W;
    ink[y]++; if (x < lo[y]) lo[y] = x; if (x > hi[y]) hi[y] = x;
  }
  const wide = new Int32Array(n);
  for (let i = 0; i < n; i++) wide[i] = hi[i] < 0 ? 0 : hi[i] - lo[i] + 1;
  return { ink, wide };
};
/* x extent of a glyph limited to rows at or above `yb` — the advance width of the letter,
   with a swash descender excluded so it doesn't inflate the spacing. */
const bodyExtent = (g, yb) => {
  let x0 = 1e9, x1 = -1;
  for (const p of g.px) {
    if (A[p] <= INK) continue;
    const y = (p / W) | 0; if (y > yb) continue;
    const x = p % W; if (x < x0) x0 = x; if (x > x1) x1 = x;
  }
  return x1 < 0 ? [g.x0, g.x1] : [x0, x1];
};

const lineInfo = glyphLines.map((glyphs, li) => {
  const b0 = median(glyphs.map(g => g.y1));
  const areaMed = median(glyphs.map(g => g.area));
  const xh = quantile(glyphs.map(g => b0 - g.y0), 0.35) || 60;

  /* punctuation: too small to be a letter, or floating clear of the baseline (the
     apostrophe of "I'm"). It is never baselined on its own — a comma belongs below the
     baseline and an apostrophe above it, so both ride along with the letter to their left
     and keep the tuck she gave them. */
  for (const g of glyphs) {
    g.punct = (g.area < 0.3 * areaMed && (g.y1 - g.y0) < 1.0 * xh) || g.y1 < b0 - 0.4 * xh;
  }

  /* Body bottom = where the letter stops and a descender tail begins. Found by SHAPE, in
     two stages, because her two kinds of descender look nothing alike in profile:

       STEM tail (p, f, the leg of an x, the tail of an s) — the ink count collapses to one
       stroke below the body and stays there. Stage 1 catches it.
       LOOPED tail (her g, whose descender is a closed oval the full width of the letter) —
       the ink count does NOT drop, because every row of the oval still crosses two strokes.
       Measured on the g of "designer": 24 ink px through the body, 20 through the whole
       oval — no collapse anywhere. What *does* show is the neck: the row SPAN narrows from
       47px to 31px and then opens back out to 73. Stage 2 finds that minimum.

     Stage 2 only runs on a glyph that reaches a long way below the line, so an ordinary
     letter can never acquire a fictional descender from a wobble in its span. */
  const TAIL_MIN = 8;
  for (const g of glyphs) {
    g.base = g.y1;
    g.desc = 0;
    if (g.punct) continue;
    // a descender that broke off as its own component: the anchor already ends at the line
    if (g.parts.length > 1 && g.anchor.y1 < g.y1 - TAIL_MIN &&
        g.parts.some(p => p.y0 > g.anchor.y1)) {
      g.base = g.anchor.y1; g.desc = g.y1 - g.base; continue;
    }
    const { ink, wide } = rowProfile(g);
    const bandTop = Math.max(g.y0, Math.round(b0 - 0.80 * xh));
    const bandBot = Math.min(g.y1, Math.round(b0 - 0.12 * xh));
    if (bandBot <= bandTop) continue;
    const band = [];
    for (let y = bandTop; y <= bandBot; y++) band.push(ink[y - g.y0]);
    const ref = median(band);
    if (!ref) continue;
    const narrow = 0.55 * ref;
    for (let y = bandBot; y <= g.y1; y++) {                       // stage 1: stem tail
      if (ink[y - g.y0] <= narrow) {
        if (g.y1 - y >= TAIL_MIN) { g.base = y - 1; g.desc = g.y1 - g.base; }
        break;
      }
    }
    if (!g.desc && g.y1 - b0 > 0.5 * xh) {                        // stage 2: looped tail
      const lo = Math.max(g.y0 + 2, Math.round(b0 - 0.25 * xh));
      const hi = Math.min(g.y1 - TAIL_MIN, Math.round(b0 + 0.6 * xh));
      let neck = -1, nw = 1e9;
      for (let y = lo; y <= hi; y++) if (wide[y - g.y0] && wide[y - g.y0] < nw) { nw = wide[y - g.y0]; neck = y; }
      if (neck > 0) { g.base = neck; g.desc = g.y1 - g.base; }
    }
  }

  const bases = glyphs.filter(g => !g.punct).map(g => g.base);
  const target = Math.round(median(bases));
  const drift = { min: Math.min(...bases) - target, max: Math.max(...bases) - target };
  const rms = Math.sqrt(bases.reduce((s, b) => s + (b - target) ** 2, 0) / bases.length);

  /* the shift, and punctuation inherits its left-hand neighbour's */
  let lastDy = 0;
  const CAP = Math.round(0.6 * xh);
  for (const g of glyphs) {
    if (g.punct) { g.dy = lastDy; continue; }
    let dy = target - g.base;
    if (Math.abs(dy) > CAP) { console.log(`  ! clamped dy ${dy} → ${Math.sign(dy) * CAP} on glyph x${g.x0}`); dy = Math.sign(dy) * CAP; }
    g.dy = dy; lastDy = dy;
  }
  console.log(`line ${li}: baseline ${target}  xh ${Math.round(xh)}  drift ${drift.min}..+${drift.max}px rms ${rms.toFixed(1)}` +
    `  descenders ${glyphs.filter(g => g.desc).map(g => g.desc).join('/') || 'none'}`);
  return { glyphs, b0, target, xh, drift, rms };
});

/* ───────────────────────────────────────────────────────────── 5. slant, to her median */
/* second moments of the ink; tan = -Sxy/Syy so a right lean is positive. Confidence is how
   much taller than wide the ink cloud is — a round `o` or a joined "abou" chunk has no
   readable slant, and shearing it to the median would invent a lean it never had. */
const allSlant = [];
for (const { glyphs } of lineInfo) for (const g of glyphs) {
  let n = 0, sx = 0, sy = 0;
  for (const p of g.px) { if (A[p] <= INK) continue; sx += p % W; sy += (p / W) | 0; n++; }
  if (!n) { g.tan = 0; g.conf = 0; continue; }
  const mx = sx / n, my = sy / n;
  let xx = 0, yy = 0, xy = 0;
  for (const p of g.px) {
    if (A[p] <= INK) continue;
    const dx = (p % W) - mx, dy = ((p / W) | 0) - my;
    xx += dx * dx; yy += dy * dy; xy += dx * dy;
  }
  g.tan = yy > 0 ? -xy / yy : 0;
  g.conf = xx + yy > 0 ? Math.max(0, (yy - xx) / (yy + xx)) : 0;
  if (!g.punct && g.conf > 0.15) allSlant.push(g.tan);
}
const SLANT = DO_SLANT ? median(allSlant) : 0;
const degs = allSlant.map(t => Math.atan(t) * 180 / Math.PI);
console.log(`slant: ${allSlant.length} readable glyphs, median ${(Math.atan(SLANT) * 180 / Math.PI).toFixed(1)}°` +
  `  spread ${quantile(degs, 0.05).toFixed(1)}..${quantile(degs, 0.95).toFixed(1)}°` +
  `  sd ${Math.sqrt(degs.reduce((s, d) => s + (d - median(degs)) ** 2, 0) / degs.length).toFixed(1)}°`);
for (const { glyphs } of lineInfo) for (const g of glyphs) {
  g.shear = 0;
  if (!DO_SLANT || g.punct || g.conf <= 0.15) continue;
  g.shear = Math.max(-SLANT_MAX, Math.min(SLANT_MAX, SLANT - g.tan));
}

/* ────────────────────────────────────────────────────── 6. one bearing, one word space */
for (const info of lineInfo) {
  for (const g of info.glyphs) {
    const [bx0, bx1] = bodyExtent(g, g.base + Math.min(g.desc, Math.round(0.15 * info.xh)));
    g.bx0 = bx0; g.bx1 = bx1;
  }
}
/* gaps, and the split between "inside a word" and "between words" found by minimum
   within-class variance rather than a guessed pixel number */
const allGaps = [];
for (const info of lineInfo) {
  const gs = info.glyphs;
  for (let i = 1; i < gs.length; i++) {
    gs[i].gap = gs[i].bx0 - gs[i - 1].bx1;
    if (!gs[i].punct && !gs[i - 1].punct) allGaps.push(gs[i].gap);
  }
}
/* Otsu: maximise BETWEEN-class variance. Minimising the within-class sum of squares
   instead puts the cut at 37px, inside the word gaps — the word-gap cluster is small and
   widely spread, so absorbing its low end into the letter cluster reduces total SSE. That
   read four of her eleven word gaps as letter gaps and ran the words together. */
const sortedGaps = [...allGaps].sort((a, b) => a - b);
let bestT = 0, bestV = -Infinity;
for (let k = 1; k < sortedGaps.length; k++) {
  if (sortedGaps[k] === sortedGaps[k - 1]) continue;
  const lo = sortedGaps.slice(0, k), hi = sortedGaps.slice(k);
  const mean = arr => arr.reduce((s, x) => s + x, 0) / arr.length;
  const between = lo.length * hi.length * (mean(lo) - mean(hi)) ** 2;
  if (between > bestV) { bestV = between; bestT = (sortedGaps[k - 1] + sortedGaps[k]) / 2; }
}
const intra = allGaps.filter(g => g <= bestT), inter = allGaps.filter(g => g > bestT);
const BEARING = Math.round(median(intra));
const WORDSPACE = Math.round(median(inter));
console.log(`spacing: word-gap threshold ${bestT.toFixed(1)}px → letter bearing ${BEARING}px ` +
  `(from ${intra.length} gaps, ${Math.min(...intra)}..${Math.max(...intra)}), ` +
  `word space ${WORDSPACE}px (from ${inter.length} gaps, ${Math.min(...inter)}..${Math.max(...inter)})`);

const PAD_L = 24;
for (const info of lineInfo) {
  const gs = info.glyphs;
  let pen = PAD_L;
  gs.forEach((g, i) => {
    if (!DO_SPACE) { g.dx = 0; return; }
    if (i === 0) { g.dx = pen - g.bx0; return; }
    const prev = gs[i - 1];
    // punctuation keeps the tuck she gave it, on both sides
    const gap = (g.punct || prev.punct) ? g.gap : (g.gap > bestT ? WORDSPACE : BEARING);
    g.dx = prev.bx1 + prev.dx + gap - g.bx0;
  });
  if (!DO_SPACE) { const off = PAD_L - Math.min(...gs.map(g => g.bx0)); gs.forEach(g => { g.dx = off; }); }
}

/* ──────────────────────────────────────────────────────────────────── 7. even leading */
const leads = [];
for (let i = 1; i < lineInfo.length; i++) leads.push(lineInfo[i].target - lineInfo[i - 1].target);
const LEAD = Math.round(leads.reduce((s, x) => s + x, 0) / leads.length);
console.log(`leading: measured ${leads.join(', ')}px → even ${LEAD}px`);

const PAD_T = 18, PAD_B = 26, PAD_R = 30;
const ascent = Math.max(...lineInfo[0].glyphs.map(g => g.dy + g.base - g.y0));
const baseAt = i => PAD_T + ascent + i * LEAD;

/* ─────────────────────────────────────────────────────────────── compose (integer only) */
const DH = baseAt(lineInfo.length - 1) + Math.max(...lineInfo.map(l => Math.max(...l.glyphs.map(g => g.y1 - g.base)))) + PAD_B;
const DW = W + 400;
const dst = new Float32Array(DW * DH);
let maxX = 0, maxY = 0, minX = DW;
lineInfo.forEach((info, li) => {
  const outBase = baseAt(li);
  const lineDy = outBase - info.target;
  for (const g of info.glyphs) {
    const dy = g.dy + lineDy;
    for (const p of g.px) {
      const y = ((p / W) | 0) + dy;
      // shear about the destination baseline, as a whole-pixel row shift: no resampling,
      // so the stroke cannot be thinned or softened
      const x = (p % W) + g.dx + Math.round(g.shear * (outBase - y));
      if (x < 0 || y < 0 || x >= DW || y >= DH) continue;
      const j = y * DW + x;
      if (A[p] > dst[j]) dst[j] = A[p];
      if (A[p] > INK) {
        if (x > maxX) maxX = x; if (x < minX) minX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
});

/* ───────────────────────────────────────────────── pen weight check + crop + write */
const penWidth = (buf, w, h) => {
  const runs = [];
  for (let y = 0; y < h; y++) {
    let n = 0;
    for (let x = 0; x < w; x++) {
      if (buf[y * w + x] > 128) n++;
      else { if (n) runs.push(n); n = 0; }
    }
    if (n) runs.push(n);
  }
  // LOWER QUARTILE, not the median: a median is inflated by every horizontal stroke, which
  // reads as one long run rather than as a pen width.
  return quantile(runs, 0.25);
};
const penIn = penWidth(A, W, H), penOut = penWidth(dst, DW, DH);
let inkIn = 0, inkOut = 0;
for (let i = 0; i < W * H; i++) if (A[i] > INK) inkIn++;
for (let i = 0; i < DW * DH; i++) if (dst[i] > INK) inkOut++;
console.log(`pen width: in ${penIn}px  out ${penOut}px   ink px: in ${inkIn} out ${inkOut} (${(100 * inkOut / inkIn).toFixed(1)}%)`);
if (penOut < penIn) console.log(`  ! strokes thinned — dilating back to ${penIn}px`);
for (let d = penOut; d < penIn; d++) {                        // only ever runs if something resampled
  const grown = Float32Array.from(dst);
  for (let y = 0; y < DH; y++) for (let x = 1; x < DW; x++) {
    const j = y * DW + x;
    if (dst[j - 1] > grown[j]) grown[j] = dst[j - 1];
  }
  dst.set(grown);
}

const x0 = Math.max(0, minX - PAD_L), y0 = 0;
const NW = Math.min(DW, maxX + PAD_R) - x0, NH = maxY + PAD_B;
const out = { width: NW, height: NH, data: Buffer.alloc(NW * NH * 4) };
for (let y = 0; y < NH; y++) for (let x = 0; x < NW; x++) {
  const d = (y * NW + x) * 4;
  out.data[d] = out.data[d + 1] = out.data[d + 2] = 0;
  out.data[d + 3] = Math.round(Math.max(0, Math.min(255, dst[(y + y0) * DW + x + x0])));
}
fs.writeFileSync(OUT, encode(out));
console.log(`wrote ${path.relative(process.cwd(), OUT)} — ${NW}x${NH} (was ${W}x${H})`);
console.log(`CSS aspect-ratio: ${NW}/${NH}`);

if (flag('--apply')) {
  fs.copyFileSync(OUT, LIVE);
  console.log(`applied over ${path.relative(process.cwd(), LIVE)} — update .hero-line aspect-ratio in build.js to ${NW}/${NH}`);
} else {
  console.log('(not applied — pass --apply once the result has been eyeballed)');
}

if (DEBUG) {
  for (const info of lineInfo) {
    console.log(`— line ${info.glyphs[0].line}`);
    for (const g of info.glyphs) console.log(
      `   x${g.x0}-${g.x1} y${g.y0}-${g.y1} a${g.area} parts${g.parts.length}` +
      ` base${g.base} desc${g.desc} dy${g.dy} dx${g.dx} gap${g.gap ?? '-'}` +
      ` tan${g.tan.toFixed(3)} conf${g.conf.toFixed(2)} shear${g.shear.toFixed(3)}${g.punct ? ' PUNCT' : ''}`);
  }
}
