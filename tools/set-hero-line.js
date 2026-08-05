#!/usr/bin/env node
/* Re-sets the hero sentence from the words Madhu actually wrote.
   Input : assets/hero/hero-line-handwritten.png  (the cleaned 4-line lift)
   Output: the same file, re-flowed — plus the CSS aspect-ratio to paste into build.js

   The sentence changed from

     As a product designer, I'm curious about how design
     helps our mind FLOW IN ORDER TO SIMPLIFY complex workflows.
   to
     As a product designer, I'm curious about how design
     helps our mind PROCESS complex workflows.

   Six of the seven words in the new half are already on the page in her hand, so they are
   cut out and re-flowed rather than re-set. Only "process" has to be built, letter by
   letter, off the A–Z sheet.

   ── why the built word needs normalising ───────────────────────────────────────────────
   Letters on the alphabet sheet are NOT the same letters she writes inside a word, and the
   difference goes two ways at once:

       alphabet sheet   x-height ~77px   pen width ~4px
       inside a word    x-height ~60px   pen width ~7px

   She draws isolated letters bigger and lighter; writing a word she goes smaller and
   presses harder. Scaling the sheet letters down to the right height (×0.78) therefore
   makes them *thinner still* — ~3px against the 7px they sit next to — and the built word
   reads as a different, spindlier hand dropped into the middle of the line. That is the
   "cohesive height and width" problem.

   So the fix is two measurements, both taken from the page rather than guessed: scale to
   her in-word x-height, then dilate back to her in-word pen width. Both numbers are
   measured on every run, so this keeps working if the source lift is ever redone.

   Re-run: node tools/set-hero-line.js  [--dry]
*/
const fs = require('fs');
const path = require('path');
const I = require('./ink');
const G = require('./glyphs');

const HERE = path.join(__dirname, '..', 'assets', 'hero');
const FILE = path.join(HERE, 'hero-line-handwritten.png');
const BACKUP = path.join(HERE, 'hero-line-handwritten-4line.png');
const DRY = process.argv.includes('--dry');

/* What is written on the page now, line by line, and what each line should become.
   `keep` lists the words of the source line to carry over, in order; `add` is set fresh. */
const SOURCE = [
  ['As', 'a', 'product', 'designer,', "I'm"],
  ['curious', 'about', 'how', 'design'],
  ['helps', 'our', 'mind', 'flow', 'in', 'order'],
  ['to', 'simplify', 'complex', 'workflows.'],
];
const TARGET = [
  { from: 0, keep: null },                                  // whole line, untouched
  { from: 1, keep: null },
  { from: 2, keep: ['helps', 'our', 'mind'], add: 'process' },
  { from: 3, keep: ['complex', 'workflows.'] },
];

/* ------------------------------------------------------------------ read + segment */

/* Always re-set from the four-line lift, never from our own output — the second run would
   otherwise go looking for "flow in order" in a line that no longer has it. */
if (!fs.existsSync(BACKUP)) fs.copyFileSync(FILE, BACKUP);
const src = I.read(BACKUP);
const W = src.width, H = src.height;
const alphaAt = (im, x, y) => im.data[(y * im.width + x) * 4 + 3];

const { comps, labels } = I.components(src, 40);
const big = comps.filter(c => c.area >= 15).sort((a, b) => a.y0 - b.y0);

/* Cluster on the TOP edge: a descender hangs below its own line but its top still sits on
   it, so y0 is the stable signal (same reason as in clean-handwriting.js). */
const cuts = [];
for (let i = 1; i < big.length; i++) {
  if (big[i].y0 - big[i - 1].y0 > 60) cuts.push((big[i].y0 + big[i - 1].y0) / 2);
}
if (cuts.length !== 3) throw new Error(`expected 4 written lines, found ${cuts.length + 1}`);
const lineOf = c => cuts.filter(k => c.y0 > k).length;
const rawLines = [[], [], [], []];
for (const c of big) rawLines[lineOf(c)].push(c);

/** Merge boxes that overlap in x — puts an i-dot back on its stem and the apostrophe of
    "I'm" back on its letter, so neither can be mistaken for a word break. */
function mergeOverlaps(list) {
  const out = [];
  for (const b of [...list].sort((a, b) => a.x0 - b.x0)) {
    const p = out[out.length - 1];
    if (p && b.x0 <= p.x1 - 2) {
      p.x0 = Math.min(p.x0, b.x0); p.x1 = Math.max(p.x1, b.x1);
      p.y0 = Math.min(p.y0, b.y0); p.y1 = Math.max(p.y1, b.y1);
      p.members.push(b);
    } else out.push({ ...b, members: [b] });
  }
  return out;
}

/** Split into `n` runs at the n-1 widest gaps — driven by the word count we already know
    is on the line, never by a tuned threshold. */
function splitInto(items, n, gapAt) {
  if (n >= items.length) return items.map(x => [x]);
  const gaps = [];
  for (let i = 1; i < items.length; i++) gaps.push({ gap: gapAt(i), at: i });
  const at = gaps.sort((a, b) => b.gap - a.gap).slice(0, n - 1).map(g => g.at).sort((a, b) => a - b);
  const runs = []; let from = 0;
  for (const c of [...at, items.length]) { runs.push(items.slice(from, c)); from = c; }
  return runs;
}

/** → [{word, comps, x0, x1, y0, y1}] for one line. */
function wordsOfLine(li) {
  const boxes = mergeOverlaps(rawLines[li]);
  const rights = [];
  boxes.reduce((r, b, i) => { rights[i] = r; return Math.max(r, b.x1); }, boxes[0].x0);
  const groups = splitInto(boxes, SOURCE[li].length, i => boxes[i].x0 - rights[i]);
  if (groups.length !== SOURCE[li].length) {
    throw new Error(`line ${li}: cut into ${groups.length}, expected ${SOURCE[li].length}`);
  }
  return groups.map((g, wi) => ({
    word: SOURCE[li][wi],
    comps: g.flatMap(b => b.members),
    x0: Math.min(...g.map(b => b.x0)), x1: Math.max(...g.map(b => b.x1)),
    y0: Math.min(...g.map(b => b.y0)), y1: Math.max(...g.map(b => b.y1)),
  }));
}

/* Only the lines being edited need a word cut. Lines 0 and 1 carry over whole, which is
   just as well: their gaps are tight enough that the cut there is not reliable. */
const wordsOf = {};
for (const t of TARGET) if (t.keep) wordsOf[t.from] = wordsOfLine(t.from);

/* ------------------------------------------------------------------ her metrics */

/** Median horizontal run of ink — for a pen of near-constant width this is the pen width
    on vertical and diagonal strokes, inflated only where a stroke runs horizontal. The
    lower quartile is the more stable read, so use that. */
function penWidth(im, boxes) {
  const runs = [];
  const scan = (x0, y0, x1, y1, get) => {
    for (let y = y0; y <= y1; y++) {
      let run = 0;
      for (let x = x0; x <= x1; x++) {
        if (get(x, y) > 110) run++; else { if (run) runs.push(run); run = 0; }
      }
      if (run) runs.push(run);
    }
  };
  if (boxes) for (const b of boxes) scan(b.x0, b.y0, b.x1, b.y1, (x, y) => alphaAt(im, x, y));
  else scan(0, 0, im.width - 1, im.height - 1, (x, y) => alphaAt(im, x, y));
  runs.sort((a, b) => a - b);
  return runs[Math.floor(runs.length * 0.25)] || 1;
}

/** Her x-height: the lower quartile of component heights on the lines being edited.
    Ascenders and descenders push the upper half of that distribution around; the bottom
    quarter is x-height letters and nothing else. */
function xHeightOf(list) {
  const hs = list.map(c => c.y1 - c.y0).filter(h => h > 20).sort((a, b) => a - b);
  return hs[Math.floor(hs.length * 0.22)];
}

const editedComps = [...rawLines[2], ...rawLines[3]];
const HERO_XH = xHeightOf(editedComps);
const HERO_PEN = penWidth(src, editedComps.map(c => ({ x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 })));

const letters = G.letterLibrary();
/* Measure the sheet through the same crispen the built word will get, or the fringe on that
   soft lift inflates both numbers and the scale comes out wrong. */
const SHEET_XH = (() => {
  // pure x-height letters only — no ascender, no descender, no dot
  const hs = [...'cemnorsuvwxz'].filter(c => letters[c])
    .map(c => trim(crispen(letters[c])).height).sort((a, b) => a - b);
  return hs[hs.length >> 1];
})();
const SHEET_PEN = (() => {
  const ps = [...'ocesnru'].filter(c => letters[c])
    .map(c => penWidth(crispen(letters[c]))).sort((a, b) => a - b);
  return ps[ps.length >> 1];
})();

const SCALE = HERO_XH / SHEET_XH;
console.log('her hand, measured:');
console.log(`  inside a word : x-height ${HERO_XH}px, pen ${HERO_PEN}px`);
console.log(`  alphabet sheet: x-height ${SHEET_XH}px, pen ${SHEET_PEN}px`);
console.log(`  → scale ${SCALE.toFixed(3)}, which would leave the pen at ` +
            `${(SHEET_PEN * SCALE).toFixed(1)}px against her ${HERO_PEN}px`);

/* ------------------------------------------------------- building the missing word */

function scaleGlyph(g, k) {
  const nw = Math.max(1, Math.round(g.width * k)), nh = Math.max(1, Math.round(g.height * k));
  const data = Buffer.alloc(nw * nh * 4);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const sx = Math.min(g.width - 1.001, x / k), sy = Math.min(g.height - 1.001, y / k);
      const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
      const a = (i, j) => g.data[((y0 + j) * g.width + x0 + i) * 4 + 3];
      data[(y * nw + x) * 4 + 3] = Math.round(
        a(0, 0) * (1 - fx) * (1 - fy) + a(1, 0) * fx * (1 - fy) +
        a(0, 1) * (1 - fx) * fy + a(1, 1) * fx * fy);
    }
  }
  return { width: nw, height: nh, data, rise: g.rise * k };
}

/** Pad a glyph with empty margin, so a dilate has somewhere to grow into. */
function pad(g, m) {
  const nw = g.width + m * 2, nh = g.height + m * 2;
  const data = Buffer.alloc(nw * nh * 4);
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      data[((y + m) * nw + x + m) * 4 + 3] = g.data[(y * g.width + x) * 4 + 3];
    }
  }
  return { width: nw, height: nh, data, rise: g.rise + m };
}

/** Re-ramp alpha so the ink is bimodal — a solid core with a thin edge.

    This is the difference between the two lifts, and it is what makes a built word look
    smudged next to a written one. Her hero line came off the photo hard: ~90k pixels at
    full alpha against a couple of thousand in each intermediate bucket. The alphabet block
    came off soft — its fringe outnumbers its solid core four to one — so every glyph is a
    grey smear with no edge. Ramping about the 50% contour restores the edge without moving
    it, which means the stroke keeps the width it was written at. */
function crispen(g, lo = 96, hi = 160) {
  const data = Buffer.alloc(g.width * g.height * 4);
  for (let i = 0; i < g.width * g.height; i++) {
    const a = g.data[i * 4 + 3];
    data[i * 4 + 3] = Math.round(Math.max(0, Math.min(1, (a - lo) / (hi - lo))) * 255);
  }
  return { ...g, data };
}

/** Grow the ink by `r` pixels (max over a disc), fractional r blended between radii.
    This is what puts her pressure back after the scale-down takes it away. */
function dilate(g, r) {
  if (r <= 0.01) return g;
  const lo = Math.floor(r), hi = lo + 1, f = r - lo;
  const src = pad(g, hi);
  const pass = (radius) => {
    if (radius === 0) return src.data;
    const out = Buffer.alloc(src.width * src.height * 4);
    const offs = [];
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) if (dx * dx + dy * dy <= radius * radius) offs.push([dx, dy]);
    }
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        let m = 0;
        for (const [dx, dy] of offs) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= src.width || ny >= src.height) continue;
          const v = src.data[(ny * src.width + nx) * 4 + 3];
          if (v > m) m = v;
        }
        out[(y * src.width + x) * 4 + 3] = m;
      }
    }
    return out;
  };
  const a = pass(lo), b = pass(hi);
  const data = Buffer.alloc(src.width * src.height * 4);
  for (let i = 0; i < src.width * src.height; i++) {
    data[i * 4 + 3] = Math.round(a[i * 4 + 3] * (1 - f) + b[i * 4 + 3] * f);
  }
  return { ...src, data };
}

/** Shrink the glyph back to its ink, so the layout spaces letters by their strokes and not
    by whatever padding the dilate needed. */
function trim(g) {
  let x0 = g.width, y0 = g.height, x1 = -1, y1 = -1;
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      if (g.data[(y * g.width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return g;
  const nw = x1 - x0 + 1, nh = y1 - y0 + 1;
  const data = Buffer.alloc(nw * nh * 4);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) data[(y * nw + x) * 4 + 3] = g.data[((y + y0) * g.width + x + x0) * 4 + 3];
  }
  return { width: nw, height: nh, data, rise: g.rise - y0 };
}

/* ── where each letter of the built word comes from ────────────────────────────────────
   Not the alphabet sheet. That block was lifted soft — its fringe outnumbers its solid
   core four to one — and worse, the letters there are drawn in isolation: bigger, lighter
   and more open than the same letters inside a word. Her sheet `o` does not close at the
   top, which on its own is survivable at alphabet size and reads as a `c` once it is
   scaled down to sit next to "mind".

   So every letter of "process" is cut out of a word she wrote on this very line instead.
   That makes the height, the pen weight and the crispness right by construction, with
   nothing to normalise. `x` is the component's own x-range in the four-line lift; where a
   component holds more than one letter, `of`/`i` split it at its thinnest ink column —
   the same cut glyphs.js uses to separate her joined `hi` and `lm`. Only splits that are
   unambiguous are used: a two- or three-letter run, never a whole joined word. */
const LETTER_SOURCES = {
  p: { line: 2, x: [156, 195], of: 1, i: 0, note: 'the p of "helps" — keeps its descender' },
  e: { line: 2, x: [77, 113], of: 1, i: 0, note: 'the e of "helps"' },
  s: { line: 2, x: [197, 245], of: 1, i: 0, note: 'the s of "helps"' },
  /* Her o is the awkward one: she writes it into whatever follows, so most instances come
     away as an arch open on the right. The o of "workflows" is the one that closes.
     Checked on the contact sheet — `node tools/set-hero-line.js --letters`. */
  o: { line: 3, x: [1188, 1293], of: 2, i: 0, note: '"or" of "workflows", cut o|r' },
  c: { line: 1, x: [24, 118], of: 2, i: 0, note: '"cu" of "curious", cut c|u' },
  r: { line: 1, x: [119, 176], of: 2, i: 0, note: '"ri" of "curious", cut r|i' },
  S: { line: 1, x: [1124, 1153], of: 1, i: 0, note: 'the s of "design" — her other s' },
};

/** Cut a glyph into `n` letters at its thinnest ink columns. Splits the widest piece each
    time, searching only the middle of it so a cut can never shave a letter's edge off. */
function splitGlyph(g, n) {
  let parts = [{ x0: 0, x1: g.width - 1 }];
  while (parts.length < n) {
    let wi = 0;
    parts.forEach((p, i) => { if (p.x1 - p.x0 > parts[wi].x1 - parts[wi].x0) wi = i; });
    const p = parts[wi], w = p.x1 - p.x0;
    let best = p.x0 + (w >> 1), bestInk = Infinity;
    for (let x = Math.round(p.x0 + w * 0.3); x <= Math.round(p.x1 - w * 0.3); x++) {
      let ink = 0;
      for (let y = 0; y < g.height; y++) if (g.data[(y * g.width + x) * 4 + 3] > 40) ink++;
      if (ink < bestInk) { bestInk = ink; best = x; }
    }
    parts.splice(wi, 1, { x0: p.x0, x1: best }, { x0: best + 1, x1: p.x1 });
  }
  return parts.sort((a, b) => a.x0 - b.x0).map(p => {
    const nw = p.x1 - p.x0 + 1;
    const data = Buffer.alloc(nw * g.height * 4);
    for (let y = 0; y < g.height; y++) {
      for (let x = 0; x < nw; x++) data[(y * nw + x) * 4 + 3] = g.data[(y * g.width + x + p.x0) * 4 + 3];
    }
    return trim({ width: nw, height: g.height, data, rise: g.rise });
  });
}

/** Lift one letter out of the words she wrote, masked to its own ink. */
function letterFromHand(ch) {
  const spec = LETTER_SOURCES[ch];
  if (!spec) return null;
  const group = rawLines[spec.line].filter(c => c.x0 >= spec.x[0] - 2 && c.x1 <= spec.x[1] + 2);
  if (!group.length) throw new Error(`no ink at ${spec.x} on line ${spec.line} for "${ch}"`);
  const ids = new Set(group.map(c => c.id));
  const x0 = Math.min(...group.map(c => c.x0)), x1 = Math.max(...group.map(c => c.x1));
  const y0 = Math.min(...group.map(c => c.y0)), y1 = Math.max(...group.map(c => c.y1));
  const nw = x1 - x0 + 1, nh = y1 - y0 + 1;
  const data = Buffer.alloc(nw * nh * 4);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      if (ids.has(labels[(y + y0) * W + x + x0])) data[(y * nw + x) * 4 + 3] = alphaAt(src, x + x0, y + y0);
    }
  }
  // rise = distance from the top of this crop down to the line's baseline
  const base = baselineOf(rawLines[spec.line]);
  const g = { width: nw, height: nh, data, rise: base - y0 };
  return spec.of > 1 ? splitGlyph(g, spec.of)[spec.i] : trim(g);
}

/** Set one word from the sheet, at her in-word height AND her in-word pen weight. */
function buildWord(text) {
  /* A repeated letter takes her other version of it rather than stamping the same bitmap
     twice — she does not write two esses the same way, and a duplicate reads as a paste. */
  const seen = {};
  const grown = [...text].map(ch => {
    const alt = (seen[ch] = (seen[ch] || 0) + 1) > 1 && LETTER_SOURCES[ch.toUpperCase()]
      ? ch.toUpperCase() : ch;
    const hand = letterFromHand(alt);
    if (hand) return hand;
    /* Fallback only — a letter she never wrote on this line. Bring it over from the sheet
       and normalise it: crispen at native size, scale to her x-height, then dilate back to
       her pen weight, solving for the radius by measurement rather than assuming one. */
    const s = letters[ch] || letters[ch.toLowerCase()];
    if (!s) throw new Error(`no glyph for "${ch}"`);
    const base = scaleGlyph(crispen(s), SCALE);
    const finish = r => trim(crispen(dilate(base, r), 110, 150));
    let r = Math.max(0, (HERO_PEN - SHEET_PEN * SCALE) / 2), g = finish(r);
    for (let i = 0; i < 5; i++) {
      const got = penWidth(g);
      if (Math.abs(got - HERO_PEN) < 0.6) break;
      r = Math.max(0, r + (HERO_PEN - got) / 2); g = finish(r);
    }
    console.log(`  "${ch}" is not on this line — set from the alphabet sheet, dilated ${r.toFixed(2)}px`);
    return g;
  });
  const fromHand = [...text].filter(ch => LETTER_SOURCES[ch]).length;
  console.log(`  "${text}": ${fromHand}/${text.length} letters cut from her own words, ` +
              `pen ${median(grown.map(g => penWidth(g)))}px against her ${HERO_PEN}px`);

  /* Lay the letters out on a common baseline with her own letter spacing. */
  const bearing = Math.round(HERO_XH * 0.10);
  let pen = 0;
  const placed = grown.map(g => { const at = pen; pen += g.width + bearing; return { g, x: at }; });
  const w = pen - bearing, riseMax = Math.max(...placed.map(p => p.g.rise));
  const h = Math.ceil(Math.max(...placed.map(p => riseMax - p.g.rise + p.g.height)));
  const data = Buffer.alloc(w * h * 4);
  for (const p of placed) {
    const oy = Math.round(riseMax - p.g.rise);
    for (let y = 0; y < p.g.height; y++) {
      for (let x = 0; x < p.g.width; x++) {
        const ty = oy + y, tx = p.x + x;
        if (ty < 0 || ty >= h || tx < 0 || tx >= w) continue;
        const a = p.g.data[(y * p.g.width + x) * 4 + 3];
        const d = (ty * w + tx) * 4;
        if (a > data[d + 3]) data[d + 3] = a;
      }
    }
  }
  return { width: w, height: h, data, rise: riseMax };
}

const median = xs => [...xs].sort((a, b) => a - b)[xs.length >> 1];

/* -------------------------------------------------------------------- re-flow */

/* Her own numbers, so the rebuilt lines sit the way the untouched ones do. */
const WORD_GAP = (() => {
  const gaps = [];
  for (const li of [2, 3]) {
    const ws = wordsOf[li];
    for (let i = 1; i < ws.length; i++) gaps.push(ws[i].x0 - ws[i - 1].x1);
  }
  return Math.round(median(gaps));
})();
const LEAD = Math.round((cuts[2] - cuts[0]) / 2);
const LEFT = Math.min(...big.map(c => c.x0));
const TOP = Math.min(...big.map(c => c.y0));
console.log(`  word gap ${WORD_GAP}px, leading ${LEAD}px, left margin ${LEFT}px`);

/* Baseline of a line = the modal bottom edge of its non-descending glyphs. Everything is
   placed against this, so a built word sits on the same ruled line as the written ones. */
function baselineOf(list) {
  const bs = list.map(c => c.y1).sort((a, b) => a - b);
  return bs[Math.floor(bs.length * 0.55)];
}

const OUT_H = TOP + LEAD * 3 + 320;
const dst = new Float32Array(W * OUT_H);
let maxX = 0, maxY = 0;
const put = (x, y, v) => {
  if (x < 0 || y < 0 || x >= W || y >= OUT_H) return;
  const j = y * W + x;
  if (v > dst[j]) dst[j] = v;
  if (x > maxX) maxX = x;
  if (y > maxY) maxY = y;
};

/** Copy a set of components, masked to their OWN ink.

    Never copy the bounding rectangle. The box of a word with a descender reaches down into
    the line below and across into its neighbours, so a rectangle copy drags pieces of other
    words along with it. Masking by component id cuts the word out by its ink instead.
    The soft antialiased fringe (alpha at or below the ink threshold) carries no label, so
    it is picked up separately from the neighbourhood of labelled pixels — without it every
    re-placed word comes back with hard, aliased edges. */
function blit(group, ox, oy) {
  const ids = new Set(group.map(c => c.id));
  const x0 = Math.min(...group.map(c => c.x0)), x1 = Math.max(...group.map(c => c.x1));
  const y0 = Math.min(...group.map(c => c.y0)), y1 = Math.max(...group.map(c => c.y1));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (ids.has(labels[y * W + x])) put(x + ox, y + oy, alphaAt(src, x, y));
    }
  }
  for (let y = Math.max(0, y0 - 2); y <= Math.min(H - 1, y1 + 2); y++) {
    for (let x = Math.max(0, x0 - 2); x <= Math.min(W - 1, x1 + 2); x++) {
      const a = alphaAt(src, x, y);
      if (a === 0 || a > 40 || labels[y * W + x] !== -1) continue;
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (ids.has(labels[ny * W + nx])) { near = true; break; }
        }
      }
      if (near) put(x + ox, y + oy, a);
    }
  }
}

TARGET.forEach((t, li) => {
  const srcLine = rawLines[t.from];
  const oy = TOP + li * LEAD - Math.min(...srcLine.map(c => c.y0));

  if (!t.keep) {                                   // whole line, only re-flushed left
    blit(srcLine, LEFT - Math.min(...srcLine.map(c => c.x0)), oy);
    return;
  }

  /* An edited line: stamp the kept words at her word gap, then the built one. */
  const kept = t.keep.map(w => {
    const found = wordsOf[t.from].find(x => x.word === w);
    if (!found) throw new Error(`line ${t.from} has no word "${w}"`);
    return found;
  });
  const base = baselineOf(rawLines[t.from]);
  let pen = LEFT;
  for (const w of kept) {
    blit(w.comps, pen - w.x0, oy);
    pen += (w.x1 - w.x0) + WORD_GAP;
  }
  if (t.add) {
    const g = buildWord(t.add);
    const oy2 = oy + base - Math.round(g.rise);
    for (let y = 0; y < g.height; y++) {
      for (let x = 0; x < g.width; x++) {
        const a = g.data[(y * g.width + x) * 4 + 3];
        if (a > 0) put(pen + x, oy2 + y, a);
      }
    }
    pen += g.width + WORD_GAP;
  }
});

/* -------------------------------------------------------------------- write */

const PAD_R = 30, PAD_B = 26;
const NW = Math.min(W, maxX + PAD_R), NH = maxY + PAD_B;
const out = { width: NW, height: NH, data: Buffer.alloc(NW * NH * 4) };
for (let y = 0; y < NH; y++) {
  for (let x = 0; x < NW; x++) {
    const d = (y * NW + x) * 4;
    out.data[d] = out.data[d + 1] = out.data[d + 2] = 0;
    out.data[d + 3] = Math.round(Math.max(0, Math.min(255, dst[y * W + x])));
  }
}
/* --letters: a contact sheet of every cut, black on white and blown up 3x. Look at this
   before trusting a cut — a split in the wrong place puts a visibly wrong letter in her
   handwriting, and the only reliable check is the eye. */
if (process.argv.includes('--letters')) {
  const keys = Object.keys(LETTER_SOURCES);
  const gs = keys.map(k => letterFromHand(k));
  const GAP = 24, K = 3;
  const sw = gs.reduce((s, g) => s + g.width * K + GAP, GAP);
  const sh = Math.max(...gs.map(g => g.height * K)) + GAP * 2;
  const sheet = { width: sw, height: sh, data: Buffer.alloc(sw * sh * 4) };
  for (let i = 0; i < sw * sh; i++) { sheet.data[i * 4] = sheet.data[i * 4 + 1] = sheet.data[i * 4 + 2] = 255; sheet.data[i * 4 + 3] = 255; }
  let px = GAP;
  gs.forEach((g, gi) => {
    for (let y = 0; y < g.height * K; y++) {
      for (let x = 0; x < g.width * K; x++) {
        const a = g.data[(((y / K) | 0) * g.width + ((x / K) | 0)) * 4 + 3];
        const d = ((y + GAP) * sw + px + x) * 4;
        sheet.data[d] = sheet.data[d + 1] = sheet.data[d + 2] = 255 - a;
      }
    }
    console.log(`  ${keys[gi]}: ${g.width}x${g.height}  ${LETTER_SOURCES[keys[gi]].note}`);
    px += g.width * K + GAP;
  });
  const p = path.join(__dirname, '..', 'story-src', 'hero-letters.png');
  fs.writeFileSync(p, require('./png').encode(sheet));
  console.log(`contact sheet → ${path.relative(process.cwd(), p)}`);
  process.exit(0);
}

if (DRY) {
  console.log(`\n[dry] would write ${NW}x${NH}, aspect-ratio ${NW}/${NH}`);
} else {
  if (!fs.existsSync(BACKUP)) fs.copyFileSync(FILE, BACKUP);
  fs.writeFileSync(FILE, require('./png').encode(out));
  console.log(`\nwrote ${path.relative(process.cwd(), FILE)} — ${NW}x${NH}`);
  console.log(`CSS aspect-ratio: ${NW}/${NH}`);
}
