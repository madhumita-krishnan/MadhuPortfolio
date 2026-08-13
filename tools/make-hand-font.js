#!/usr/bin/env node
/* Madhu's handwriting, as an actual typeface.

   Everything else in this project that uses her hand uses a PHOTOGRAPH of it: the hero
   sentence is four PNG masks cut out of a sheet she wrote, and tools/glyphs.js stamps single
   words for the monkey story. That works until the words change. This turns the same sheets
   into a font file, so any sentence can be set in her hand — including one she never wrote.

   ── what it reads ──────────────────────────────────────────────────────────────────────
     story-src/alphabet.png    A–Z, a–z, drawn as isolated letters. The primary source.
     story-src/paragraph.png   her only full stop, comma and apostrophe.

   ── the two things that make it a typeface rather than a scan ───────────────────────────

   1. THE BASELINE IS DERIVED, NOT PHOTOGRAPHED. Her alphabet rows run downhill — the A sits
      111px higher than the K on the same row — and inside that drift each letter wanders on
      its own. A font has one baseline, so every letter is placed against ITS OWN ink rather
      than against where it happened to land on the page:

        letters that sit on the line    baseline = the bottom of the letter
        descenders (g j p q y)          baseline = the top of the letter + the x-height
        f, which descends and ascends   baseline = the top + the ascender height

      The x-height and ascender used there are measured first, from the letters that do sit
      on the line, so nothing is guessed. This is the whole of "make sure things are aligned".

   2. THE SIZES ARE PULLED TOGETHER, BUT NOT FLATTENED. She draws isolated letters at whatever
      size the pen felt like — measured, her capitals range over about a fifth of their own
      height. Left alone, that reads as unevenness rather than as character. Each letter is
      scaled UNIFORMLY (never squashed vertically, which would change the letterform) toward
      the median of its own zone, and the scale is clamped, so a letter she genuinely writes
      small stays a little small. The report prints the spread before and after.

   Widths are hers too: the sidebearing and the word space are measured from the gaps between
   letters in the sentence at the top of the alphabet sheet, not chosen.

   ── what it does NOT do ────────────────────────────────────────────────────────────────
   There are no digits, no dashes and no brackets, because she has never written any. A
   character with no glyph falls through to .notdef, which is deliberately empty — a gap in
   the line is a better failure than a tofu box. Add them by writing them down and re-running.

   Run:  node tools/make-hand-font.js [--proof] [--glyphs] [--audit]
   Out:  assets/fonts/madhu-hand.woff  (and .ttf)
         assets/fonts/madhu-hand.json  the measurements, for build.js and for the next person
*/
const fs = require('fs');
const path = require('path');
const I = require('./ink');
const G = require('./glyphs');
const T = require('./trace');
const TTF = require('./ttf');
const { encode } = require('./png');

const ROOT = path.join(__dirname, '..');
const STORY = path.join(ROOT, 'story-src');
const OUT_DIR = path.join(ROOT, 'assets', 'fonts');
/* Proof sheets are development output, not site assets. build.js copies assets/ into dist/
   wholesale, so a 330kb pair of contact sheets left in there would ship to Pages on every
   deploy — same reason _orig-backup/ sits outside assets/. */
const PROOF_DIR = path.join(ROOT, 'font-proofs');
const PROOF = process.argv.includes('--proof');
const GLYPHS = process.argv.includes('--glyphs');
const AUDIT = process.argv.includes('--audit');

/* Both sheets get read a dozen times over — once per letter that is cut out of a word, plus
   once for the spacing, the pen ratio and the letter library. Decoding a 2000x2095 PNG in
   pure JS is a couple of seconds, so a build that reads them fresh every time takes minutes
   for no reason. They never change during a run. */
const sheets = new Map();
const sheet = f => {
  if (!sheets.has(f)) sheets.set(f, I.read(path.join(STORY, f)));
  return sheets.get(f);
};

const UPEM = 1000;
const ASCENDER_UNITS = 760;      // where her ascenders land in the em; the rest follows
const VERSION = '1.000';

/* Her hand, sorted into the four vertical zones a Latin face has. Membership is a fact about
   her letterforms, checked against the sheet, not a general rule about the alphabet: her `t`
   stops well short of her `l`, so it is not counted when the ascender is measured. */
const CAPS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const XHEIGHT = 'acemnorsuvwxz';       // top at the x-height, bottom on the baseline
const ASCENDERS = 'bdhkl';             // the letters the ascender height is measured from
const TALL = 'bdhklt';                 // everything that reaches above the x-height
const DESCENDERS = 'gpqy';             // x-height body, tail below the line
const IJ = 'ij';                       // x-height body with a dot floating above it

const median = a => {
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/* ---------------------------------------------------------------- reading the glyphs */

/** Alpha as a 0..1 plane, plus the box the ink actually occupies. */
function plane(g) {
  const { width: w, height: h, data } = g;
  const a = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) a[i] = data[i * 4 + 3] / 255;
  return { a, w, h };
}

/** Bring her light strokes up to full ink.

    SHE DOES NOT PRESS EVENLY, and it is not random — she bears down on the way down and
    lifts on the way up, which is what a fast hand does. Every one of her upstrokes fades
    out towards its top: sampled off the sheet, the outer arms of her `w` peak at alpha 0.35
    where the middle column of the same letter is a solid 1.0, and one of the two diagonals
    of her `x` is the same.

    That does not show on paper, where a 35% stroke is simply a lighter stroke and the eye
    joins it up. It is fatal in a typeface, because everything downstream cuts the outline at
    the halfway mark: the faint half of the letter is not drawn thin, it is not drawn at all.
    Her `w` came out as two shallow bowls and read as `uu` — "how" as "hou", "with" as
    "uuth" — and her `x` lost a diagonal and came out as a check mark.

    THE FIRST VERSION OF THIS STRETCHED THE ALPHA GLOBALLY — 0.12 became 0, 0.50 became 1 —
    AND THAT IS NOT ENOUGH, because it is still one threshold for the whole page. Measured
    down the left diagonal of her capital A, the stroke peaks at 0.14 for a run of sixteen
    pixels and again at 0.31 further down: no global map that leaves a firm stroke alone can
    also lift a 0.14 one over the halfway mark, so the A came out with its left leg broken in
    two places. The same measurement explains the gaps she reported in g, y, u, e, h, x, B, w
    and f — every one of them at a point where her pen was on the way up.

    So the ink is measured against THE PRESSURE SHE USED RIGHT THERE, not against full black:
    every pixel is divided by the strongest ink near it, DISCOUNTED BY HOW FAR AWAY THAT INK
    IS. Inside a stroke she bore down on, the strongest ink near it is itself, the discount is
    1, and nothing changes. Along one she feathered, the local peak IS the feathered value and
    the stroke comes back at its true width instead of vanishing. Paper is untouched — the
    lift already keys the page to a hard zero, so a neighbourhood with no ink in it has no
    peak to divide by and stays paper.

    THE DISCOUNT IS WHAT MAKES IT WORK NEXT TO A FIRM STROKE, and leaving it out was worth one
    more broken letter. A plain box maximum says the local pressure at a point four pixels
    from a solid stroke is 1.0, so the faint arc that closes the top of her `q` — which runs
    parallel to the solid side of the bowl, four pixels away — was measured against ink she
    laid down somewhere else and dropped out anyway. `q` set as `y`: "quick" as "yuick". With
    the discount, ink a pixel away counts for two thirds and ink four pixels away for a
    quarter, so a faint stroke is judged against its own feathering and not against its
    neighbour's.

    The letter gets heavier doing it — dividing by anything under 1 inflates the edges — and
    that is fixed for free: every glyph is re-weighted to the median pen width further down,
    so the weight is set by the pen she used and not by how hard she happened to be leaning
    on it, nor by this. */
const PAPER = 0.10;      // no ink at all nearby: nothing to lift
const PRESS = 0.45;      // the local peak of a stroke she was pressing properly
const LO = 0.18, HI = 0.62;   // where the normalised profile crosses paper and full ink
const REACH = 5;         // how far the pressure estimate looks, about half a pen
const FALL = Math.exp(-1 / 3);   // what a pixel of distance costs the estimate
function firm(p) {
  const { a, w, h } = p;
  /* Distance-discounted maximum. The discount is multiplicative and the distance is the sum
     of the two axes, which is exactly what lets this factor into two 1-D passes — the max of
     a·g(|dx|)·g(|dy|) over a square is the max over dy of g(|dy|)·(the max over dx). O(n·REACH)
     rather than O(n·REACH²), and the whole font builds in under four seconds because of it. */
  const g = [];
  for (let d = 0; d <= REACH; d++) g.push(Math.pow(FALL, d));
  const rows = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let m = 0;
    for (let d = -REACH; d <= REACH; d++) {
      const k = x + d;
      if (k < 0 || k >= w) continue;
      const v = a[y * w + k] * g[d < 0 ? -d : d]; if (v > m) m = v;
    }
    rows[y * w + x] = m;
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let peak = 0;
    for (let d = -REACH; d <= REACH; d++) {
      const k = y + d;
      if (k < 0 || k >= h) continue;
      const v = rows[k * w + x] * g[d < 0 ? -d : d]; if (v > peak) peak = v;
    }
    if (peak < PAPER) continue;                    // paper, and nothing near it to lift
    /* Never *reduce* a firm stroke: the divisor is clamped at PRESS, so a stroke she leant
       on keeps its own anti-aliased edge and only a feathered one is scaled up. */
    const t = (a[y * w + x] / Math.max(peak, PRESS) - LO) / (HI - LO);
    out[y * w + x] = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  }
  return { a: out, w, h };
}

/** Ink box at the SAME level the tracer cuts the outline at, which has to be said out loud
    because it was 0.35 here against 0.5 there and that discrepancy is a bug you can see:
    every letter whose stroke tapers off at the end — her x, her v, her k — had a few pixels
    of faint tail that counted towards the box and not towards the outline, so the letter was
    placed against ink the font does not draw and ended up floating above the baseline. Her x
    sat a tenth of an em clear of the line. One threshold, everywhere. */
const INK = 0.5;
function inkBox({ a, w, h }, t = INK) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (a[y * w + x] < t) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/* ---------------------------------------------------------------- scale and weight

   Making every capital the same height needs a uniform scale, and a uniform scale takes the
   stroke weight with it: her D is drawn 157px tall and her V 54px, so shrinking the D to
   match the others also makes it 40% lighter than its neighbours. That is the same problem
   tools/set-hero-line.js hit building one word out of loose letters, and it has the same
   answer — scale for height, then put the weight back.

   Weight is put back through a signed distance field rather than by dilating pixels, because
   the correction is fractions of a pixel and a pixel dilate cannot do fractions. Moving the
   whole field by d and re-cutting at the same level grows or shrinks every stroke by exactly
   2d, evenly, and leaves the anti-aliased edge intact for the tracer to interpolate. */

/** Bilinear resample of an alpha plane. */
function resample(p, k) {
  const w = Math.max(1, Math.round(p.w * k)), h = Math.max(1, Math.round(p.h * k));
  const a = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(p.h - 1.001, (y + 0.5) / k - 0.5), y0 = Math.max(0, Math.floor(sy)), ty = sy - y0;
    for (let x = 0; x < w; x++) {
      const sx = Math.min(p.w - 1.001, (x + 0.5) / k - 0.5), x0 = Math.max(0, Math.floor(sx)), tx = sx - x0;
      const g = (xx, yy) => p.a[Math.min(p.h - 1, Math.max(0, yy)) * p.w + Math.min(p.w - 1, Math.max(0, xx))];
      a[y * w + x] = (g(x0, y0) * (1 - tx) + g(x0 + 1, y0) * tx) * (1 - ty)
                   + (g(x0, y0 + 1) * (1 - tx) + g(x0 + 1, y0 + 1) * tx) * ty;
    }
  }
  return { a, w, h };
}

/** Exact squared euclidean distance transform, one dimension at a time (Felzenszwalb's
    lower-envelope method). Called twice per plane — once for the ink, once for the paper. */
function edt1d(f, n) {
  const d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s;
    for (;;) {
      s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      if (s <= z[k]) k--; else break;
    }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
  return d;
}

function edt(bin, w, h) {
  const INF = 1e12;
  const f = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) f[i] = bin[i] ? 0 : INF;
  const col = new Float64Array(h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) col[y] = f[y * w + x];
    const d = edt1d(col, h);
    for (let y = 0; y < h; y++) f[y * w + x] = d[y];
  }
  const row = new Float64Array(w);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) row[x] = f[y * w + x];
    const d = edt1d(row, w);
    for (let x = 0; x < w; x++) f[y * w + x] = Math.sqrt(d[x]);
  }
  return f;
}

/** Grow (delta > 0) or shrink (delta < 0) every stroke by 2*delta pixels.
    Near the edge the sub-pixel position comes from the alpha itself rather than from the
    distance field, so delta = 0 leaves the mask exactly as it was. */
function reweight(p, delta) {
  if (Math.abs(delta) < 0.02) return p;
  const { a, w, h } = p;
  const inside = new Uint8Array(w * h), outside = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) { if (a[i] >= 0.5) inside[i] = 1; else outside[i] = 1; }
  const dIn = edt(outside, w, h), dOut = edt(inside, w, h);
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const far = a[i] >= 0.5 ? dIn[i] - 0.5 : -(dOut[i] - 0.5);
    const near = a[i] - 0.5;
    const d = Math.abs(far) < 1 ? near : far;
    out[i] = Math.max(0, Math.min(1, 0.5 + d + delta));
  }
  return { a: out, w, h };
}

/** How wide the pen was, from ink area over stroke length.

    A stroke of length L and width W covers L*W, and its boundary runs down both sides, so
    the perimeter is about 2L. Divide and the length cancels: W = 2 * area / perimeter.

    THIS REPLACED COUNTING HORIZONTAL INK RUNS, which is what tools/glyphs.js and
    set-hero-line.js both do, and which is wrong here in a way that shows. A run measures the
    stroke along the scanline, not across it, so a stroke at 45 degrees measures 1.41x too
    wide and a horizontal one measures its whole length. Taking the lower quartile hides that
    for a letter with some verticals in it and does nothing at all for a letter without any:
    measured both ways, her `x` came out at 8px by runs against 5.7 by this — so the weight
    correction below decided it was too heavy and thinned it further. Her x, X, T, S, Z, k and
    l were all being eroded, which is exactly the set that looked faded.

    Ink area and perimeter are both direction-free, so this cannot happen. It over-reads a
    little on a compact blob, where the "length" is no longer much greater than the width —
    which is why the three punctuation marks skip the correction entirely. */
function penWidth(p) {
  let area = 0;
  for (let i = 0; i < p.w * p.h; i++) if (p.a[i] >= 0.5) area++;
  let perimeter = 0;
  for (const poly of T.contours(p.a, p.w, p.h, 0.5)) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      perimeter += Math.hypot(a[0] - b[0], a[1] - b[1]);
    }
  }
  return perimeter > 0 ? 2 * area / perimeter : 1;
}

/* ---------------------------------------------------------------- the gaps her pen left

   She writes fast and she lifts. Photographed inside a word that is invisible — the eye
   carries the stroke across a two-pixel skip without noticing — but a typeface has to draw
   what is actually there, and what is actually there is often two pieces. On the alphabet
   sheet her capital B is a top structure and a bottom curve with thirty pixels of daylight
   between them (it sets as "13"), her lowercase w is two arches that miss each other, her x
   is two diagonals that do not cross, and her A, D, G, H and K all have an arm that stops
   short of the stem it belongs to.

   The morphological close below (grow by a quarter pen, shrink back) seals the two-pixel
   skips and nothing else, which is right — a closing big enough for the B would swallow the
   counter of every `a` on the page. So the wide gaps are closed one at a time instead, by
   the only thing that can tell "she lifted here" from "she meant to leave this open": how
   many separate pieces the letter is in. An `n` is one piece. A `c` is one piece, gaping
   open. A broken `B` is two, and two is never a letter. */

/** 8-connected ink islands of an alpha plane, at the threshold the tracer will cut at. */
function islands(p) {
  const { a, w, h } = p;
  const lab = new Int32Array(w * h).fill(-1), out = [], stack = [];
  for (let seed = 0; seed < w * h; seed++) {
    if (a[seed] < INK || lab[seed] !== -1) continue;
    const c = { id: out.length, px: [] };
    lab[seed] = c.id; stack.push(seed);
    while (stack.length) {
      const q = stack.pop(), qx = q % w, qy = (q / w) | 0;
      c.px.push(q);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = qx + dx, ny = qy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (lab[n] === -1 && a[n] >= INK) { lab[n] = c.id; stack.push(n); }
      }
    }
    c.area = c.px.length;
    /* Only the edge of an island can be the near end of a gap, and it is a tenth of the
       pixels — worth keeping, because the search below is every rim against every rim. */
    c.rim = c.px.filter(i => {
      const x = i % w, y = (i / w) | 0;
      return x === 0 || y === 0 || x === w - 1 || y === h - 1
        || a[i - 1] < INK || a[i + 1] < INK || a[i - w] < INK || a[i + w] < INK;
    });
    out.push(c);
  }
  return out.sort((x, y) => y.area - x.area);
}

/** Erase the flecks: pen specks she left on the page, and the corner of a neighbouring
    letter caught by a box cut. Anything under a fifteenth of the letter is not a stroke —
    her i and j dots are a seventh of their stems, so they are safely clear of this. */
function despeck(p, frac = 0.065) {
  const isl = islands(p);
  if (isl.length < 2) return p;
  const floor = Math.max(24, isl[0].area * frac);
  const out = new Float32Array(p.a);
  let dropped = 0;
  for (const c of isl) if (c.area < floor) { for (const i of c.px) out[i] = 0; dropped++; }
  return dropped ? { a: out, w: p.w, h: p.h } : p;
}

/** Lay a stroke of the pen down between two points, alpha maxed into what is there.
    Soft-edged rather than hard, so the tracer still has a sub-pixel edge to interpolate and
    the join reads as one continuous stroke instead of a welded seam. */
function bridge(p, ax, ay, bx, by, r) {
  const { a, w, h } = p;
  const out = new Float32Array(a);
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - r - 1));
  const x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + r + 1));
  const y0 = Math.max(0, Math.floor(Math.min(ay, by) - r - 1));
  const y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by) + r + 1));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const t = len2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
    const d = Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
    const v = Math.max(0, Math.min(1, 0.5 + (r - d)));
    const i = y * w + x;
    if (v > out[i]) out[i] = v;
  }
  return { a: out, w, h };
}

/** Join the pieces up until the letter is one stroke — or two, for the i and the j, whose
    dot is a piece she meant to leave loose. Always the closest pair first, which is the pair
    her pen actually skipped: on every letter on both sheets the shortest gap is the join she
    dropped, and once it is made the next-shortest is the next one.

    Nothing is joined across more than half the letter. That limit has never been reached —
    the widest real gap on either sheet is the thirty pixels inside her B, against a letter
    145 tall — and it is there so that a letter which somehow arrives in two halves is left
    visibly broken in the proof rather than quietly welded into a shape she never wrote. */
function seal(p, pen, expect, note) {
  const span = Math.max(p.w, p.h) * 0.5;
  for (let guard = 0; guard < 6; guard++) {
    const isl = islands(p);
    if (isl.length <= expect) return p;
    let best = null;
    for (let i = 0; i < isl.length; i++) for (let j = i + 1; j < isl.length; j++) {
      for (const q of isl[i].rim) {
        const qx = q % p.w, qy = (q / p.w) | 0;
        for (const r of isl[j].rim) {
          const rx = r % p.w, ry = (r / p.w) | 0;
          const d = Math.hypot(qx - rx, qy - ry);
          if (!best || d < best.d) best = { d, qx, qy, rx, ry };
        }
      }
    }
    if (!best || best.d > span) {
      if (note) note.push(`${isl.length} pieces, widest gap ${best ? best.d.toFixed(0) : '?'}px — LEFT OPEN`);
      return p;
    }
    if (note) note.push(`${best.d.toFixed(0)}px`);
    p = bridge(p, best.qx, best.qy, best.rx, best.ry, pen / 2);
  }
  return p;
}

/** The part of the letter that sets its width: everything on or above the baseline.

    A DESCENDER'S TAIL IS NOT WIDTH. Her g finishes with a loop that swings a whole letter to
    the left of the bowl and her y with a flick half a letter to the right, and counting
    either one into the advance pads the letter with empty space on the side the tail is not
    on — "designer" set as "desig ner" and "guide" as "g uide", which is exactly the gap she
    can see in the hero. Below the line the tail simply overhangs its neighbour, which is what
    it does on the page: in her own "design" the loop of the g passes under the letter before
    it. Anything with no ink above the baseline (the comma) keeps its whole box. */
function setBox(p, baseline) {
  const cut = Math.min(p.h - 1, Math.round(baseline));
  const { a, w } = p;
  let x0 = w, y0 = cut + 1, x1 = -1, y1 = -1;
  for (let y = 0; y <= cut; y++) for (let x = 0; x < w; x++) {
    if (a[y * w + x] < INK) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** An alpha plane back as an image, so the component tools can be pointed at it. */
function planeToMask(p) {
  const data = Buffer.alloc(p.w * p.h * 4);
  for (let i = 0; i < p.w * p.h; i++) data[i * 4 + 3] = Math.round(p.a[i] * 255);
  return { width: p.w, height: p.h, data };
}

/** Where a tall letter stops being a stem and becomes its x-height body — the top of the
    bowl of b and d, the shoulder of h, the arm of k, the crossbar of t.

    Scanning down the letter's own width profile: a stem is one pen wide and a body is not,
    so the body starts at the first scanline whose ink spans more than three pens AND more
    than half the letter's widest point. Both halves of that are needed — three pens alone
    catches the top curl of her `k`, half the width alone catches nothing on her `l`, whose
    widest point IS the pen.

    Returns null when there is no body: her `l` is a single stroke top to bottom, and a
    letter with no x-height part cannot be aligned by one. */
function bodyTop(q, pen) {
  const { a, w, h } = q.p;
  let maxSpan = 0;
  const span = new Int32Array(h);
  for (let y = 0; y < h; y++) {
    let x0 = -1, x1 = -1;
    for (let x = 0; x < w; x++) if (a[y * w + x] >= INK) { if (x0 < 0) x0 = x; x1 = x; }
    span[y] = x0 < 0 ? 0 : x1 - x0 + 1;
    if (span[y] > maxSpan) maxSpan = span[y];
  }
  const wide = Math.max(3 * pen, 0.5 * maxSpan);
  for (let y = q.top; y <= q.bottom; y++) if (span[y] >= wide) {
    /* A body that starts in the top eighth of the letter is not a body — it is an x-height
       letter that wandered into this test, or a stem with a curl on it. */
    return y - q.top < (q.bottom - q.top) * 0.125 ? null : y;
  }
  return null;
}

/** Bring the dot of an i or a j back down to the ascender line.

    The stem of her isolated `i` is 46px where her x-height letters are 69, so aligning it
    scales the letter up by half — and a uniform scale moves the dot half as far again from
    the stem it belongs to. Left alone it ends up level with nothing, a speck the width of a
    line above the letter, and once the light strokes were brought up (see `firm`) it was
    solid enough to read as dirt on the page rather than as a tittle.

    The dot goes where a dot goes: its top at the ascender, level with the l and the h it
    stands beside. Nothing about the mark itself changes — it is her dot, moved. */
function settleDot(p, baselineY, asc) {
  const { comps } = I.components(planeToMask(p), 40);
  if (comps.length < 2) return p;
  const main = comps.reduce((m, c) => (c.area > m.area ? c : m), comps[0]);
  const dots = comps.filter(c => c.y1 < main.y0 - 2);
  if (!dots.length) return p;
  const shift = Math.round((baselineY - asc) - Math.min(...dots.map(c => c.y0)));
  if (shift <= 0) return p;
  const out = new Float32Array(p.w * p.h);
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const v = p.a[y * p.w + x];
    if (v <= 0) continue;
    const above = y <= main.y0 - 2;
    const ty = above ? y + shift : y;
    if (ty >= 0 && ty < p.h) out[ty * p.w + x] = Math.max(out[ty * p.w + x], v);
  }
  return { a: out, w: p.w, h: p.h };
}

/** The box of the letter's BODY — everything except a dot floating clear above it.
    Used for i and j, where the overall top is the dot and the metrics want the stem. */
function bodyBox(g) {
  const { comps } = I.components(g, 40);
  const main = comps.reduce((m, c) => (c.area > m.area ? c : m), comps[0]);
  const keep = comps.filter(c => c.area >= 40 && !(c.y1 < main.y0 - 2));
  return {
    x0: Math.min(...keep.map(c => c.x0)), x1: Math.max(...keep.map(c => c.x1)),
    y0: Math.min(...keep.map(c => c.y0)), y1: Math.max(...keep.map(c => c.y1)),
  };
}

/* The one letter on the sheet that cannot be used as she drew it.

   Her `o` is not a ring. It is a single stroke that starts at the top, runs down the left,
   round the bottom and back up the right, and stops two thirds of the way up — leaving a gap
   a third of the letter tall down its right side. On the page, inside a word, it reads as an
   o because of what is beside it. Standing alone in a font it reads as a `c`, and `how` comes
   out as `hcw`. Her capital O is worse: she blotted it and drew over the blot.

   Both sheets were searched for a closed one and there is not a single closed o in either —
   she does not write them closed. So this is not a bad take to be swapped out; it is a fact
   about her hand that a typeface has to answer.

   The answer uses nothing but her own stroke: the letter is rotated 180 degrees about the
   centre of its own ink and laid over itself. Her o is very nearly point-symmetric already,
   so the copy's left shoulder lands exactly where the missing right shoulder should be, and
   the two agree everywhere they overlap. The result is her curve, her weight and her
   proportions, closed — and it is one letter, done knowingly, rather than a rule applied
   quietly to the whole alphabet.

   The capital is the same mask taken up to cap height by the ordinary zone scaling. */
const REJOIN = 'oO';

/* Capitals that are simply their own lowercase drawn bigger, and where the drawn capital is
   worse than the lowercase one. Her capital X has the same fault her lowercase x had — the
   second diagonal is a faint upstroke and it drops out, leaving a lambda in the middle of
   "UVWXYZ" — and unlike the lowercase there is no capital X anywhere in her writing to cut a
   better one from. An X is one of the handful of letters whose capital IS its lowercase at
   cap height (C, O, S, U, V, W, X, Z), so this borrows the good one and lets the ordinary
   zone scaling take it up. Her O already comes through the same door, via REJOIN. */
const CAP_FROM_LOWER = 'X';

/* The letters where the alphabet sheet is not how she writes.

   DRAWING AN ALPHABET IS NOT WRITING, and this is the single largest source of wrong letters
   in this font. Setting the sheet against her own four lines of prose at the top of the same
   page, a dozen letters come out as different shapes in the two places — every one of them a
   letter she draws in more strokes, or more carefully, when she is thinking about it than
   when she is simply writing:

     d   on the sheet the stem is a tick a few pixels proud of the bowl, so "design" comes
         out as "aesign" and "guide" as "guiae". In "mind" it is a bowl with a full stem.
     p   on the sheet a flat-topped P on a stub with no descender: "people" as "Deople".
         In "helps" it is a proper bowl on a proper tail.
     m   on the sheet two strokes that miss each other, and it reads as "rn". In "mind" it
         is one clean three-arch m.
     e   ON THE SHEET THE BOTTOM CURVE STOPS UNDER THE EYE — she draws the loop and lifts,
         so there is no exit stroke at all and the letter sets as a tight `c` with a bar
         through it. Her written e has the bottom sweeping out to the right and down past
         the eye, which is what makes it an e. Cut from "complex".
     u   on the sheet it is a single deep bowl with the left arm barely a third of the way
         up, so it reads as an `o`: "product" set as "prodoct" and "curious" as "corious".
         In "curious" both arms rise the full x-height. Cut from that word.
     g   on the sheet the bowl is open at the top and the tail is a flat flick that never
         comes back — it reads as a `q` with a broken ear. In "designer" it is a closed bowl
         under a long open descending loop, and it is the best letter on the page.
     x   on the sheet the second diagonal is one of her faint upstrokes and it breaks either
         side of the crossing, so the letter sets as a lambda — "complex" as "compleλ". In
         that word she drew it in two firm strokes that meet. Cut below the baseline, because
         the exit stroke she runs out of it is a join to the next letter, not part of the x.
     y   on the sheet the bowl does not close on the descender. In "simplify" it does.
     f   ON THE SHEET THERE IS NO CROSSBAR AT ALL — it is a bare descending loop and it sets
         as an integral sign. In "flow" it has her crossbar, cut left across the stem.
     w   the sheet's w is two arches with daylight between them ("how" as "holu"). This used
         to be cut from "workflows", where it is a tight zig-zag that sits low; "how" has
         the same letter written open, with both middle peaks reaching the x-height.

   Every one of them comes off the SAME sheet, a few lines higher up, so they carry the same
   pen, the same lift and the same ink density as the other forty. They are cut by box rather
   than found, because they are known letters in known words: the general machinery that
   splits a row into words gets these right and half the other words wrong, and a rule that
   is right half the time is worse here than a coordinate. Where a box has to clip a
   neighbour — her hand joins letters up — the sliver that comes with it is under a fifteenth
   of the letter and `despeck` drops it.

   `h` WAS ON THIS LIST AND CAME OFF IT AGAIN, which is worth writing down because the sheet
   is the wrong source for every other letter here and the right one for this one. On the
   sheet her h's shoulder is a separate arc that stops clear of the stem, so the obvious move
   was to cut a joined-up one out of "how". But WRITING an h is what flattens it: measured,
   the stem of the h in "how" rises 0.22 of an x-height above its shoulder and the one on the
   sheet rises 0.35, against 0.39–0.49 for her b, d and k. At 0.22 it is an n — "how" set as
   "now" and "Architecture" as "Arcnitecture". The sheet's h is drawn with a proper ascender
   and its one fault, the gap, is the fault `seal` exists to fix. */
const FROM_WORDS = {
  d: { file: 'alphabet.png', box: { x0: 870, y0: 420, x1: 952, y1: 556 } },    // "mind"
  p: { file: 'alphabet.png', box: { x0: 202, y0: 454, x1: 256, y1: 558 } },    // "helps"
  m: { file: 'alphabet.png', box: { x0: 663, y0: 455, x1: 774, y1: 541 } },    // "mind"
  w: { file: 'alphabet.png', box: { x0: 1056, y0: 284, x1: 1167, y1: 363 } },  // "how"
  e: { file: 'alphabet.png', box: { x0: 1132, y0: 656, x1: 1192, y1: 747 } },  // "complex"
  u: { file: 'alphabet.png', box: { x0: 92, y0: 276, x1: 160, y1: 358 } },     // "curious"
  /* CUT BY COMPONENT, NOT BY COORDINATE — and it is the g that needed it. Her descending
     loop reaches x=1125 and the stem of the `n` after it starts at x=1116, so there is no
     vertical line that keeps the whole g and none of the n. Cut at 1114 to miss the n and
     eleven pixels come off the outside of the loop: the tail sets visibly flat-ended, which
     is what "the g looks cut off" was. The loop and the n never touch, though, so a generous
     box plus `pick:'largest'` keeps every pixel of the letter and drops the n whole.
     Only the g gets this. Her `u` and `w` are genuinely fused into their neighbours in
     "curious" and "how" — one island of ink across three letters — so for those the knife
     has to be a coordinate, and their boxes are right as they stand. */
  g: { file: 'alphabet.png', box: { x0: 1030, y0: 36, x1: 1136, y1: 270 }, pick: 'largest' },  // "designer"
  x: { file: 'alphabet.png', box: { x0: 1184, y0: 653, x1: 1242, y1: 748 } },  // "complex"
  y: { file: 'alphabet.png', box: { x0: 624, y0: 613, x1: 722, y1: 807 } },    // "simplify"
  f: { file: 'alphabet.png', box: { x0: 1025, y0: 405, x1: 1110, y1: 624 } },  // "flow"
};

function fromWord(ch) {
  const o = FROM_WORDS[ch];
  if (!o) return null;
  const g = I.crop(sheet(o.file), o.box.x0, o.box.y0, o.box.x1 - o.box.x0 + 1, o.box.y1 - o.box.y0 + 1);
  if (o.pick !== 'largest') return g;
  /* Keep the biggest island of ink and erase the rest — the letter, without the neighbours
     the box had to be widened past. Safe only where the letter does not touch them; see the
     note on the g above. */
  const { labels, comps } = I.components(g, 40);
  const main = comps.reduce((m, c) => (c.area > m.area ? c : m), comps[0]);
  for (let i = 0; i < g.width * g.height; i++) if (labels[i] !== main.id) g.data[i * 4 + 3] = 0;
  return g;
}

function rejoin(g) {
  const { width: w, height: h, data } = g;
  const a = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) a[i] = data[i * 4 + 3] / 255;
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (a[y * w + x] < 0.4) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const out = Buffer.from(data);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const mx = x0 + x1 - x, my = y0 + y1 - y;
    if (mx < 0 || my < 0 || mx >= w || my >= h) continue;
    const v = Math.max(a[y * w + x], a[my * w + mx]);
    out[(y * w + x) * 4 + 3] = Math.round(v * 255);
  }
  return { width: w, height: h, data: out };
}

/** How much bigger the alphabet sheet is than the paragraph sheet.

    The two photographs were taken at different distances, so the same pen leaves a 7.2px
    stroke on one and a 5.0px stroke on the other. Since it IS the same pen, the ratio of the
    two stroke widths is the ratio of the two photographs — which means scaling the paragraph
    marks by it lands them at both the right size AND the right weight in one move, with
    nothing to correct afterwards. Measured on every run off the whole of each sheet, where
    there is plenty of writing for the area-over-length measure to be steady. */
function sheetRatio() {
  const alphabet = sheet('alphabet.png');
  const block = I.crop(alphabet, 0, 950, alphabet.width, alphabet.height - 950);
  return penWidth(plane(block)) / penWidth(plane(sheet('paragraph.png')));
}

/** The three marks of punctuation she has written, all on the last two lines of the
    paragraph sheet. Their positions are measured, not searched for: they are three specific
    marks on one known page, and a rule general enough to find "the comma" would also find
    the dot of an i. The baseline beside each one is taken from the letter it follows. */
const PUNCT = [
  { ch: '.', box: { x0: 1094, y0: 664, x1: 1112, y1: 681 }, baseline: 677, zone: 'base' },
  { ch: ',', box: { x0: 924, y0: 496, x1: 951, y1: 526 }, baseline: 500, zone: 'base' },
  { ch: "'", box: { x0: 1164, y0: 442, x1: 1185, y1: 474 }, baseline: 500, zone: 'top' },
];

function punctuation() {
  const page = sheet('paragraph.png');
  return PUNCT.map(p => {
    const g = I.crop(page, p.box.x0, p.box.y0, p.box.x1 - p.box.x0 + 1, p.box.y1 - p.box.y0 + 1);
    return { ch: p.ch, g, rise: p.baseline - p.box.y0, zone: p.zone };
  });
}

/* ---------------------------------------------------------------- her spacing */

/** How far apart she sets letters, and how far apart she sets words — both read off the
    sentence at the top of the alphabet sheet, where she was writing normally rather than
    spacing out an alphabet.

    Within a row the word breaks are simply the (words - 1) widest gaps; everything narrower
    is a letter gap. That is the same assumption tools/glyphs.js makes to cut words out, and
    it is safe here in a way it is not there, because a couple of mis-sorted gaps move a
    median by nothing. */
function spacing(report) {
  const page = sheet('alphabet.png');
  const block = I.crop(page, 0, 0, page.width, 950);
  const WORDS = [5, 4, 6, 4];
  const rows = G.rowsOf(block, 4, { minArea: 60 });
  const letter = [], word = [], heights = [];
  rows.forEach((r, ri) => {
    const it = r.items.slice().sort((a, b) => a.x0 - b.x0);
    const gaps = [];
    for (let i = 1; i < it.length; i++) gaps.push({ g: it[i].x0 - it[i - 1].x1, i });
    const breaks = new Set(gaps.slice().sort((a, b) => b.g - a.g)
      .slice(0, Math.max(0, (WORDS[ri] || 1) - 1)).map(x => x.i));
    gaps.forEach(x => (breaks.has(x.i) ? word : letter).push(x.g));
    it.forEach(b => heights.push(b.y1 - b.y0));
  });
  const s = { letter: median(letter), word: median(word), inWordHeight: median(heights) };
  if (report) {
    console.log(`  her spacing, off the sentence: letter gap ${s.letter.toFixed(1)}px `
      + `(${letter.length} gaps), word gap ${s.word.toFixed(1)}px (${word.length} gaps)`);
  }
  return s;
}

/* ---------------------------------------------------------------- measure and align */

function measure(report) {
  const lib = G.letterLibrary(report);
  const glyphs = [];
  for (const ch of Object.keys(lib)) {
    const low = ch.toLowerCase();
    const g = REJOIN.includes(ch) ? rejoin(lib[low])
      : CAP_FROM_LOWER.includes(ch) ? (fromWord(low) || lib[low])
      : ch === low && FROM_WORDS[ch] ? fromWord(ch)
      : lib[ch];
    /* despeck BEFORE anything is measured off this: a box cut out of a word clips the edge
       of the letter beside it, and a sliver of a neighbour left in would widen the ink box
       and drag the letter off its own centre before the scaling ever sees it. */
    const p = despeck(firm(plane(g)));
    const ink = inkBox(p);
    const body = IJ.includes(ch) ? bodyBox(g) : null;
    glyphs.push({ ch, g, p, ink, top: body ? body.y0 : ink.y0, bottom: ink.y1 });
  }
  const by = ch => glyphs.find(x => x.ch === ch);

  /* Round letters overshoot the line by a pixel or two by design — that is why an o does not
     look small next to an n — so the x-height is a median across all of them rather than a
     measurement of any one. */
  const xh = median(XHEIGHT.split('').map(c => by(c).bottom - by(c).top));
  const cap = median(CAPS.split('').map(c => by(c).bottom - by(c).top));

  /* THE ASCENDER IS NOT MEASURED OFF THE ALPHABET SHEET, and this is the difference between
     a hand you can read and one you cannot.

     Drawing an alphabet is not writing — the same thing that made her p, m and w the wrong
     shapes below does something quieter and worse to her b d h k l. Setting letters out one
     per slot, she fills the same mental box every time: measured off the sheet her `l` is
     66px tall and her `a` is 86, and the median ascender (86) is only 1.26x the median
     x-height (68). Scaled to those two numbers, an ascender rises a quarter of an x-height
     above the shoulder — so `d` came out as `a`, `h` as `n`, `b` as `o`, and the hero read
     "guiae" for "guide" and "aesign" for "design". In the four lines of ordinary writing at
     the top of the same sheet her `d` in "mind" is 1.8x the `n` beside it.

     So an ascender letter is sized by its X-HEIGHT BODY — the bowl of b and d, the shoulder
     of h, the arm of k, the crossbar of t — which is set to the same x-height as her n and
     her o. How far the stem then rises above it is her own letterform, kept as drawn and not
     normalised to anything. Aligning the bodies is also what makes a line of her look level:
     the thing an eye tracks along a line is the x-height band, not the tops of the tall ones.

     The body starts where the letter stops being one pen stroke wide, found by scanning down
     the width profile. Her `l` has no body at all — max span 6px, the pen — and so falls
     through to the old rule, scaled to the ascender height the others end up at. */
  const pen0 = median(XHEIGHT.split('').map(c => penWidth(by(c).p)));
  for (const q of glyphs) if (TALL.includes(q.ch)) q.bodyTop = bodyTop(q, pen0);
  const ascReach = ASCENDERS.split('').map(c => by(c))
    .filter(q => q.bodyTop != null)
    .map(q => (q.bottom - q.top) * (xh / (q.bottom - q.bodyTop)));
  const asc = median(ascReach);

  /* Now every letter can be placed against its own ink. Measuring a descender DOWN from its
     x-height top, rather than up from its tail, is what makes this work across her hand: her
     q and her y both finish with a wide horizontal flick, so anything that looks for "where
     the letter stops being one stroke wide" finds the end of the flick and puts them on the
     line with no tail at all. Their tops are all honestly at the x-height, and checked:
     against her bowls, this places the p, q, g and y within two pixels of where the bowl
     actually closes. */
  for (const q of glyphs) {
    if (DESCENDERS.includes(q.ch) || q.ch === 'j') q.baseline = q.top + xh;
    else if (q.ch === 'f') q.baseline = q.top + asc;          // her f descends as well as ascends
    else q.baseline = q.bottom;
  }
  const desc = median(DESCENDERS.split('').map(c => by(c).ink.y1 - by(c).baseline));

  /* Zone height per letter — the number that gets pulled toward its median. */
  for (const q of glyphs) {
    q.zone = CAPS.includes(q.ch) ? 'cap' : TALL.includes(q.ch) || q.ch === 'f' ? 'asc'
      : IJ.includes(q.ch) ? 'x' : 'x';
    q.reach = q.baseline - q.top;
  }
  const target = { cap, asc, x: xh };
  /* The clamp is wide because the weight correction below pays for it: a letter can be
     resized by a third without going light or heavy. It is not removed altogether because a
     letter she genuinely writes small — her `w` and `r` sit below her other x-height letters,
     consistently, on both sheets — should stay a little small. That is her hand, not noise. */
  const CLAMP = [0.68, 1.42];
  for (const q of glyphs) {
    /* An ascender with a body is matched at the body and left alone above it — see the note
       on the ascender above. It is deliberately outside the clamp: the clamp exists to stop
       the median dragging an oddly-drawn letter around, and this is not the median, it is
       the one measurement that has to be exact for the line to sit level. */
    if (q.bodyTop != null) { q.scale = xh / (q.bottom - q.bodyTop); continue; }
    const want = target[q.zone];
    q.scale = Math.max(CLAMP[0], Math.min(CLAMP[1], want / q.reach));
  }

  if (report) {
    const spread = (label, list, sel) => {
      const v = list.map(sel);
      console.log(`    ${label.padEnd(10)} ${Math.min(...v).toFixed(0)}–${Math.max(...v).toFixed(0)}px`
        + `  median ${median(v).toFixed(1)}  spread ±${((Math.max(...v) - Math.min(...v)) / 2 / median(v) * 100).toFixed(1)}%`);
    };
    console.log('  her zones, as written:');
    spread('capitals', glyphs.filter(q => q.zone === 'cap'), q => q.reach);
    spread('ascenders', glyphs.filter(q => q.zone === 'asc'), q => q.reach);
    spread('x-height', glyphs.filter(q => q.zone === 'x'), q => q.reach);
    console.log('  after aligning:');
    spread('capitals', glyphs.filter(q => q.zone === 'cap'), q => q.reach * q.scale);
    spread('ascenders', glyphs.filter(q => q.zone === 'asc'), q => q.reach * q.scale);
    spread('x-height', glyphs.filter(q => q.zone === 'x'), q => q.reach * q.scale);
    const bodied = glyphs.filter(q => q.bodyTop != null);
    console.log(`    tall letters sized by their body (${bodied.map(q => q.ch).join('')}), `
      + `each body set to the ${xh.toFixed(0)}px x-height:`);
    console.log('      ' + bodied.map(q => `${q.ch} rises ${(((q.bottom - q.top) * q.scale / xh) - 1).toFixed(2)}x`
      + ` above it`).join(', ') + `  —  ascender ${asc.toFixed(0)}px, ${(asc / xh).toFixed(2)}x the x-height`);
  }
  return { glyphs, xh, cap, asc, desc };
}

/* ---------------------------------------------------------------- outlines -> font units */

/** Trace one glyph and hand back contours in font units: y up, baseline at 0, origin at the
    left sidebearing.

    The mask is resized and re-weighted FIRST and traced afterwards, never the other way
    round: scaling an outline is exact but scaling it is also what changes the weight, and
    the weight can only be corrected where there is still a distance field to move. `u` is
    then the plain conversion from the resized pixel to the font unit. */
function contoursOf(q, u, sb) {
  const outs = T.outlines(q.p.a, q.p.w, q.p.h, { tol: 0.32, minLen: 10 });
  /* Measured off the SET box, not the ink box, so a descender's tail hangs over its
     neighbour instead of being padded around — see setBox. */
  const X = x => Math.round((x - q.set.x0) * u + sb);
  const Y = y => Math.round((q.baseline - y) * u);
  const out = [];
  for (const o of outs) {
    const pts = [{ x: X(o.start[0]), y: Y(o.start[1]), on: true }];
    for (const s of o.segs) {
      if (s.c) pts.push({ x: X(s.c[0]), y: Y(s.c[1]), on: false });
      pts.push({ x: X(s.p1[0]), y: Y(s.p1[1]), on: true });
    }
    pts.pop();                                     // the closing point repeats the first
    /* Drop points that land on top of their neighbour after rounding — at these scales a
       few always do, and a zero-length segment is a cusp the rasteriser has to guess at. */
    const clean = pts.filter((p, i) => {
      const n = pts[(i + 1) % pts.length];
      return !(p.x === n.x && p.y === n.y && p.on === n.on);
    });
    if (clean.length < 3 || o.area * u * u < 900) continue;   // a fleck, not a counter
    /* TrueType fills by non-zero winding with outer contours running clockwise, which with y
       pointing up is a negative shoelace area. The tracer already gives outers and holes
       opposite signs; this only decides which way round the pair goes. */
    let area = 0;
    for (let i = 0; i < clean.length; i++) {
      const a = clean[i], b = clean[(i + 1) % clean.length];
      area += a.x * b.y - b.x * a.y;
    }
    if ((o.outer && area > 0) || (!o.outer && area < 0)) clean.reverse();
    out.push(clean);
  }
  return out;
}

/* ---------------------------------------------------------------- build */

function main() {
  console.log('reading her sheets');
  const space = spacing(true);
  const { glyphs, xh, cap, asc, desc } = measure(true);

  /* One scale for the whole font, fixed by putting her ascender where it belongs in the em.
     Everything else — cap height, x-height, descender, sidebearings — is then hers. */
  const k0 = ASCENDER_UNITS / asc;
  const sbPx = space.letter / 2;
  console.log(`  em: ascender ${asc.toFixed(0)}px -> ${ASCENDER_UNITS}/${UPEM} units (x${k0.toFixed(3)})`);

  /* Her punctuation joins the same pipeline, scaled up out of the paragraph sheet's
     coordinates into the alphabet sheet's. The full stop and comma sit on the line; the
     apostrophe hangs from the top, so it is placed by its own height above the baseline
     rather than by an ink bottom that means nothing — and that height is expressed in the
     paragraph's own pixels, because the scale is applied to the whole baseline afterwards. */
  const markScale = sheetRatio();
  console.log(`  punctuation: the paragraph sheet is ${(1 / markScale).toFixed(3)}x the alphabet `
    + `sheet, so her marks are scaled x${markScale.toFixed(3)} to match its pen`);
  const marks = punctuation().map(m => {
    const p = firm(plane(m.g));
    const ink = inkBox(p);
    return {
      ch: m.ch, g: m.g, p, ink,
      /* The apostrophe hangs from the top of the line, so it is placed by its own TOP — set
         at the ascender, level with the l and the h it stands between. Placing it by its
         bottom instead put it at mid-x-height, where it reads as a dot rather than a tick. */
      baseline: m.zone === 'top' ? ink.y0 + asc / markScale : m.rise,
      top: ink.y0, bottom: ink.y1, scale: markScale, zone: 'punct',
    };
  });

  const all = [...glyphs, ...marks];
  /* The word space is the ink-to-ink gap she leaves between words MINUS the sidebearing each
     neighbouring letter already contributes. Skipping that subtraction sets her words a full
     letter-gap too far apart, which at the size the hero runs is very visible. */
  const wordUnits = Math.round((space.word - space.letter) * k0);
  const sb = Math.round(sbPx * k0);
  const entries = [{ name: '.notdef', code: null, advance: wordUnits, contours: [] },
                   { name: 'space', code: 32, advance: wordUnits, contours: [] }];

  /* Her pen, measured on the letters she wrote at her normal size — the weight everything
     else is brought back to after being resized. */
  const pen = median(glyphs.filter(q => Math.abs(q.scale - 1) < 0.08).map(q => penWidth(q.p)));
  let heaviest = 0;
  for (const q of all) {
    if (q.scale !== 1) q.p = resample(q.p, q.scale);
    /* Punctuation keeps whatever weight she gave it. A full stop is a blob, and the width
       measure divides ink by stroke length — on something with no length to speak of it
       reports about half what it should, and the correction would blow the full stop up to
       twice the size of the letters beside it. */
    const before = q.zone === 'punct' ? pen : penWidth(q.p);
    const delta = (pen - before) / 2;
    heaviest = Math.max(heaviest, Math.abs(delta));
    /* Close the pen skips. Grown by a quarter of a pen width and shrunk back by the same,
       every gap narrower than half a stroke seals and nothing else moves at all — a closing
       is idempotent on any shape whose openings are wider than the radius.

       She writes fast and lifts the pen mid-letter, so on the sheet her `a` is two strokes
       that miss each other by two pixels, her `w` is two arches with daylight between them,
       and her `s` has a fleck hanging off it. Photographed at speed inside a word none of
       that shows. Traced into outlines it is the difference between an `a` and a pair of
       arcs, and between `how` and `holu`. Gaps she left open on purpose — the whole right
       side of her `c` — are an order of magnitude wider and survive untouched. */
    q.p = reweight(reweight(reweight(q.p, delta), pen / 4), -pen / 4);
    /* …and then the wide ones, which a closing that size cannot reach and a closing large
       enough to reach them would fill the counters in. One letter is one stroke; the i and
       the j are two, because the dot is loose on purpose. See `seal`. */
    q.gaps = [];
    q.p = seal(q.p, pen, IJ.includes(q.ch) ? 2 : 1, q.gaps);
    /* Now the letter is at its final size, so the dot has a line to be brought down to. The
       stem is on the baseline, which after the resize is simply the bottom of its ink. */
    if (IJ.includes(q.ch)) {
      /* the i stands on the line, the j hangs below it — so the j's baseline comes off the
         top of its stem and the x-height, the same way it does everywhere else here */
      const line = q.ch === 'j' ? bodyBox(planeToMask(q.p)).y0 + xh : inkBox(q.p).y1;
      q.p = settleDot(q.p, line, asc);
    }
    /* Re-measure and re-place from the FINAL mask, not from the one that was measured three
       steps ago and scaled. Resizing moved the ink, re-weighting grew or shrank it, and
       closing sealed bits of it; carrying a baseline through all of that by multiplying it by
       the scale leaves every letter off the line by whatever the weight correction was.
       Everything below is in this glyph's own final pixels — and after the resize the x-height
       and ascender ARE the targets, because that is what the resize was for. */
    q.ink = inkBox(q.p);
    const body = IJ.includes(q.ch) ? bodyBox(planeToMask(q.p)) : null;
    const top = body ? body.y0 : q.ink.y0;
    if (q.zone === 'punct') q.baseline *= q.scale;
    else if (DESCENDERS.includes(q.ch) || q.ch === 'j') q.baseline = top + xh;
    else if (q.ch === 'f') q.baseline = top + asc;
    else q.baseline = q.ink.y1;
    /* Punctuation is set by its whole box: the comma has nothing above the line to be set
       by, and a full stop that overhangs is a full stop in the wrong place. */
    q.set = (q.zone === 'punct' ? null : setBox(q.p, q.baseline)) || q.ink;
    const contours = contoursOf(q, k0, sb);
    const advance = Math.round(q.set.w * k0 + sb * 2);
    q.entry = { name: q.ch, code: q.ch.charCodeAt(0), advance, contours, ch: q.ch };
    entries.push(q.entry);
  }
  console.log(`  pen ${pen.toFixed(1)}px, restored on every resized letter (largest correction `
    + `${heaviest.toFixed(2)}px per side)`);
  const lifted = all.filter(q => q.gaps && q.gaps.length);
  console.log(`  pen lifts sealed on ${lifted.length} letters: `
    + lifted.map(q => `${q.ch} (${q.gaps.join(', ')})`).join('  ') || '  no pen lifts left open');
  const hang = all.filter(q => q.set !== q.ink && (q.ink.x0 < q.set.x0 || q.ink.x1 > q.set.x1));
  if (hang.length) {
    console.log('  tails hanging over their neighbours (not counted into the advance): '
      + hang.map(q => `${q.ch} ${((q.set.x0 - q.ink.x0) * k0 / UPEM).toFixed(2)}/`
        + `${((q.ink.x1 - q.set.x1) * k0 / UPEM).toFixed(2)}em`).join('  '));
  }
  if (AUDIT) audit(all, k0);
  /* the curly apostrophe is the one a browser gets from smart quotes, and it is the same mark */
  const apos = entries.find(e => e.ch === "'");
  if (apos) entries.push({ ...apos, code: 0x2019 });

  const meta = {
    unitsPerEm: UPEM,
    ascender: Math.round(asc * k0),
    descender: -Math.round(desc * k0),
    lineGap: Math.round(xh * k0 * 0.55),
    capHeight: Math.round(cap * k0),
    xHeight: Math.round(xh * k0),
    family: 'Madhu Hand', subfamily: 'Regular',
    version: VERSION, revision: 1.0,
    designer: 'Madhumita Krishnan', vendor: 'MKRI',
  };

  const ttf = TTF.build(entries, meta);
  const wof = TTF.woff(ttf);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'madhu-hand.ttf'), ttf);
  fs.writeFileSync(path.join(OUT_DIR, 'madhu-hand.woff'), wof);

  const json = {
    source: ['story-src/alphabet.png', 'story-src/paragraph.png'],
    unitsPerEm: UPEM, ascender: meta.ascender, descender: meta.descender,
    capHeight: meta.capHeight, xHeight: meta.xHeight,
    /* the numbers build.js needs to set her hand without guessing */
    capRatio: +(meta.capHeight / UPEM).toFixed(4),
    xRatio: +(meta.xHeight / UPEM).toFixed(4),
    wordSpace: +(Math.round(space.word * k0) / UPEM).toFixed(4),
    sidebearing: +(Math.round(sbPx * k0) / UPEM).toFixed(4),
    characters: entries.filter(e => e.code).map(e => String.fromCharCode(e.code)).join(''),
    glyphs: entries.length,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'madhu-hand.json'), JSON.stringify(json, null, 2) + '\n');

  const kb = f => (fs.statSync(path.join(OUT_DIR, f)).size / 1024).toFixed(0) + 'kb';
  console.log(`  ${entries.length} glyphs · cap ${meta.capHeight} · x ${meta.xHeight} · `
    + `asc ${meta.ascender} · desc ${meta.descender}`);
  console.log(`  madhu-hand.ttf ${kb('madhu-hand.ttf')} · madhu-hand.woff ${kb('madhu-hand.woff')}`);
  console.log(`  characters: ${json.characters}`);

  if (PROOF) proof(entries, meta);
  if (GLYPHS) glyphSheet(all, meta, k0);
}

/* ---------------------------------------------------------------- the audit

   "Check all the letters for gaps" is a question a machine can answer better than an eye can,
   because at reading size a hairline join and a two-pixel skip look identical and only one of
   them is a bug. Every letter is measured for the two ways a glyph can be broken:

     PIECES  — how many separate islands of ink it is in. One, always, except the i and the j.
     THROAT  — the narrowest place any stroke passes through, as a fraction of her pen. A
               join she made with the corner of the nib measures 0.3 of a pen and will drop
               out at small sizes even though the letter is technically in one piece; a
               stroke she drew properly never goes below about 0.6.

   Run with --audit. Anything flagged is a letter to look at on the glyph sheet, not
   necessarily a letter to fix — her `c` is meant to be open and her `s` is meant to be thin
   at the waist. */
function audit(all, k0) {
  console.log('\n  gap audit — pieces of ink per letter, and the narrowest place in each:');
  const pen = median(all.filter(q => q.zone !== 'punct').map(q => penWidth(q.p)));
  const rows = [];
  for (const q of all) {
    const isl = islands(q.p);
    const want = IJ.includes(q.ch) ? 2 : 1;
    /* The throat: the smallest distance from an ink pixel to paper, doubled, taken over the
       ridge of every stroke. The distance transform is already here for the re-weighting. */
    const inside = new Uint8Array(q.p.w * q.p.h);
    for (let i = 0; i < inside.length; i++) inside[i] = q.p.a[i] >= INK ? 0 : 1;
    const d = edt(inside, q.p.w, q.p.h);
    /* Only ridge pixels count — a point on the EDGE of a stroke is near paper by definition.
       A pixel is on the ridge if nothing within a pen of it is further from paper. */
    let throat = Infinity;
    const R = Math.max(2, Math.round(pen / 2));
    for (let y = R; y < q.p.h - R; y++) for (let x = R; x < q.p.w - R; x++) {
      const i = y * q.p.w + x;
      if (q.p.a[i] < INK) continue;
      let peak = true;
      for (let dy = -R; dy <= R && peak; dy++) for (let dx = -R; dx <= R; dx++) {
        if (d[(y + dy) * q.p.w + x + dx] > d[i] + 1e-9) { peak = false; break; }
      }
      if (peak && d[i] * 2 < throat) throat = d[i] * 2;
    }
    rows.push({ ch: q.ch, pieces: isl.length, want, throat: throat / pen });
  }
  const bad = rows.filter(r => r.pieces !== r.want || r.throat < 0.45);
  const line = rows.map(r => `${r.ch}${r.pieces !== r.want ? '×' + r.pieces : ''}`
    + `${r.throat < 0.45 ? '!' : ''}`).join(' ');
  console.log('    ' + line);
  console.log(`    ${bad.length ? bad.map(r => `${r.ch}: ${r.pieces} piece(s), throat `
    + `${r.throat.toFixed(2)} pen`).join('; ') : 'every letter is one unbroken stroke'}`);
  console.log(`    (× = more pieces than it should be, ! = a stroke thinner than 0.45 of her `
    + `${(pen * k0 / UPEM * 100).toFixed(1)}% em pen)`);
}

/* ---------------------------------------------------------------- the glyph sheet
   Every letter three times over: as she wrote it, as it is after being resized and brought
   back to her pen weight, and as the font finally draws it. Any step that quietly eats a
   stroke shows up as a difference between two neighbouring tiles, which is the only way to
   tell a tracing bug from a letter she simply drew that way. */
function glyphSheet(all, meta, k0) {
  /* ONE SCALE FOR EVERY TILE, AND THE TILE IS SIZED TO THE DEEPEST LETTER.

     This used to fit each glyph to its own tile, which is wrong in both directions. A letter
     with a long descender — her g, her f, her j — was shrunk to squeeze into the same box as
     an `n`, so the sheet showed the two at different sizes and a tail that ran past the tile
     was simply painted off the edge. Looking at the g on that sheet, the one thing you could
     not tell was whether the loop came round: it ended flat at the bottom of its cell whether
     the letter did or not.

     Now every glyph is drawn at the same k, the tile is as tall as the tallest thing in the
     font, and each one gets its own baseline rule — so the sheet answers "is this letter the
     right size, does it sit on the line, and does the tail close" all at once. */
  const COLS = 9, PAD = 10;
  const BODY = 132;                       // drawing height budget, deepest tail to tallest stem
  /* Sized from how far the ink actually reaches ABOVE and BELOW the baseline, not from the
     tallest glyph box — the two are different numbers and using the wrong one is what cropped
     the g. Her g drops 1098 units under the line where the font's descender is 656, so a tile
     laid out from the declared metrics cuts the loop off halfway round. */
  const above = Math.max(...all.map(q => q.baseline));
  const below = Math.max(...all.map(q => q.p.h - q.baseline));
  const maxW = Math.max(...all.map(q => q.p.w));
  const k = BODY / (above + below);
  const CW = Math.ceil(2 * (maxW * k + PAD * 2)), CH = Math.ceil((above + below) * k + PAD * 3);
  const rows = Math.ceil(all.length / COLS);
  const W = COLS * CW, H = rows * CH;
  const buf = Buffer.alloc(W * H * 4, 255);
  const cov = new Float32Array(W * H);

  all.forEach((q, i) => {
    const cx = (i % COLS) * CW, cy = ((i / COLS) | 0) * CH;
    /* Both halves are aligned by their BASELINE rather than by their top, because that is the
       only registration under which a descender and an x-height letter are comparable. */
    const base = cy + PAD + Math.round(above * k);
    const top = base - q.baseline * k;
    for (let y = 0; y < q.p.h * k; y++) for (let x = 0; x < q.p.w * k; x++) {
      const a = q.p.a[Math.min(q.p.h - 1, (y / k) | 0) * q.p.w + Math.min(q.p.w - 1, (x / k) | 0)];
      if (a <= 0.02) continue;
      const py = Math.round(top + y), px = cx + PAD + x;
      if (py < cy || py >= cy + CH || px < 0 || px >= W) continue;
      const o = (py * W + px) * 4;
      buf[o] = Math.round(255 * (1 - a) + 30 * a);
      buf[o + 1] = Math.round(255 * (1 - a) + 90 * a);
      buf[o + 2] = Math.round(255 * (1 - a) + 110 * a);
    }
    for (let x = 2; x < CW - 2; x++) {     // the line the letter is standing on
      const o = ((base | 0) * W + cx + x) * 4;
      buf[o] = 236; buf[o + 1] = 208; buf[o + 2] = 196;
    }
    fill(edgesOf(q.entry.contours, cx + CW / 2 + PAD, base, k / k0), cov, W, H);
  });
  for (let i = 0; i < W * H; i++) {
    const a = Math.min(1, cov[i]);
    if (a <= 0) continue;
    const o = i * 4;
    buf[o] = Math.round(buf[o] * (1 - a) + 150 * a);
    buf[o + 1] = Math.round(buf[o + 1] * (1 - a) + 40 * a);
    buf[o + 2] = Math.round(buf[o + 2] * (1 - a) + 40 * a);
  }
  fs.mkdirSync(PROOF_DIR, { recursive: true });
  const out = path.join(PROOF_DIR, 'madhu-hand-glyphs.png');
  fs.writeFileSync(out, encode({ width: W, height: H, data: buf }));
  console.log(`  glyphs: ${path.relative(ROOT, out)}  (left teal = her mask, right red = the font)`);
}

/* ---------------------------------------------------------------- proof sheet
   Rasterised from the font's OWN outlines rather than from the source masks, so what this
   shows is what a browser will show and not what the tracer meant.

   Anti-aliased properly — 5 sub-scanlines and exact fractional coverage at the ends of every
   span. Rounding the ends instead, which is the obvious shortcut, drops any stroke that falls
   between two pixel centres, and at 64px her lighter letters are exactly that thin. The first
   version of this sheet did that and made a perfectly good font look broken. */

/** Flatten a glyph's quadratic contours into edges, offset to a pen position. */
function edgesOf(contours, ox, oy, k) {
  const edges = [];
  for (const c of contours) {
    const pts = [];
    for (let i = 0; i < c.length; i++) {
      const p = c[i];
      if (p.on) { pts.push([p.x, p.y]); continue; }
      const prev = c[(i - 1 + c.length) % c.length], next = c[(i + 1) % c.length];
      const a = prev.on ? [prev.x, prev.y] : [(prev.x + p.x) / 2, (prev.y + p.y) / 2];
      const b = next.on ? [next.x, next.y] : [(next.x + p.x) / 2, (next.y + p.y) / 2];
      for (let t = 1; t <= 12; t++) {
        const u = t / 12, v = 1 - u;
        pts.push([v * v * a[0] + 2 * v * u * p.x + u * u * b[0],
                  v * v * a[1] + 2 * v * u * p.y + u * u * b[1]]);
      }
    }
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      edges.push([ox + a[0] * k, oy - a[1] * k, ox + b[0] * k, oy - b[1] * k]);
    }
  }
  return edges;
}

/** Non-zero-winding scanline fill into a float coverage plane. */
function fill(edges, cov, W, H, SS = 5) {
  let lo = H, hi = 0;
  for (const e of edges) { lo = Math.min(lo, e[1], e[3]); hi = Math.max(hi, e[1], e[3]); }
  for (let y = Math.max(0, Math.floor(lo)); y < Math.min(H, Math.ceil(hi) + 1); y++) {
    for (let s = 0; s < SS; s++) {
      const py = y + (s + 0.5) / SS;
      const xs = [];
      for (const [x0, y0, x1, y1] of edges) {
        if ((y0 <= py && y1 > py) || (y1 <= py && y0 > py)) {
          xs.push({ x: x0 + (py - y0) / (y1 - y0) * (x1 - x0), d: y1 > y0 ? 1 : -1 });
        }
      }
      if (xs.length < 2) continue;
      xs.sort((p, q) => p.x - q.x);
      let wind = 0, from = 0;
      for (const seg of xs) {
        const prev = wind; wind += seg.d;
        if (prev === 0 && wind !== 0) from = seg.x;
        else if (prev !== 0 && wind === 0) {
          const a = Math.max(0, from), b = Math.min(W, seg.x);
          for (let x = Math.floor(a); x < Math.ceil(b); x++) {
            if (x < 0 || x >= W) continue;
            const c = Math.min(x + 1, b) - Math.max(x, a);     // how much of this pixel
            if (c > 0) cov[y * W + x] += c / SS;
          }
        }
      }
    }
  }
}

function proof(entries, meta) {
  const LINES = [
    'ABCDEFGHIJKLM',
    'NOPQRSTUVWXYZ',
    'abcdefghijklm',
    'nopqrstuvwxyz',
    "As a product designer, I'm curious about",
    'Architecture taught me how to guide people',
    'with design.',
    /* The pairs her hand confuses, set together on purpose. Every one of these was a real
       misreading at some point: h/n ("how" as "now"), u/o ("product" as "prodoct"), d/a
       ("guide" as "guiae"), w/uu, x as a lambda, q as a y, e as a c. If a line of this
       reads clean, the font is clean. */
    'how now, quick equal, guide aide, exit quiz',
  ];
  const PX = 64, PAD = 34;
  const k = PX / meta.unitsPerEm;
  const lead = Math.round(PX * 1.85);
  const byCode = new Map(entries.filter(e => e.code).map(e => [e.code, e]));
  /* AND AGAIN AT THE SIZE SHE ACTUALLY SETS IT. The hero runs at 20-24px, and a proof at 64
     is a proof of the outlines, not of the font: a join half a pen wide is a clean corner at
     64 and nothing at all at 20. Every stroke that has ever dropped out of this face dropped
     out down here first. */
  const SMALL = [24, 19, 15];
  const W = 1560, H = PAD * 2 + lead * LINES.length + PAD + SMALL.reduce((s, p) => s + p * 2.1, 0);
  const cov = new Float32Array(W * H);
  const guides = [];

  const set = (line, px, base) => {
    let x = PAD;
    for (const ch of line) {
      const e = byCode.get(ch.charCodeAt(0));
      if (!e) continue;
      if (e.contours.length) fill(edgesOf(e.contours, x, base, px / meta.unitsPerEm), cov, W, H);
      x += e.advance * px / meta.unitsPerEm;
    }
  };

  LINES.forEach((line, li) => {
    const base = PAD + lead * li + PX;
    set(line, PX, base);
    guides.push([base, [232, 142, 110]]);
    guides.push([base - meta.xHeight * k, [214, 216, 224]]);
    guides.push([base - meta.capHeight * k, [214, 216, 224]]);
  });
  let y = PAD * 2 + lead * LINES.length;
  for (const px of SMALL) {
    y += px * 1.4;
    set(LINES[LINES.length - 1], px, y);
    y += px * 0.7;
  }

  const buf = Buffer.alloc(W * H * 4, 255);
  for (const [yy, col] of guides) {
    const y = Math.round(yy);
    if (y < 0 || y >= H) continue;
    for (let x = PAD; x < W - PAD; x++) {
      const o = (y * W + x) * 4;
      buf[o] = col[0]; buf[o + 1] = col[1]; buf[o + 2] = col[2];
    }
  }
  for (let i = 0; i < W * H; i++) {
    const a = Math.min(1, cov[i]);
    if (a <= 0) continue;
    const o = i * 4;
    buf[o] = Math.round(buf[o] * (1 - a) + 30 * a);
    buf[o + 1] = Math.round(buf[o + 1] * (1 - a) + 90 * a);
    buf[o + 2] = Math.round(buf[o + 2] * (1 - a) + 110 * a);
  }
  fs.mkdirSync(PROOF_DIR, { recursive: true });
  const out = path.join(PROOF_DIR, 'madhu-hand-proof.png');
  fs.writeFileSync(out, encode({ width: W, height: H, data: buf }));
  console.log(`  proof: ${path.relative(ROOT, out)}`);
}

main();
