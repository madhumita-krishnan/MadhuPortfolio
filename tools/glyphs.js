#!/usr/bin/env node
/* Sets one line of the monkey story in Madhu's own hand.

   Four of the story's five text moments are straight photographs of her writing. The
   fifth — "A monkey stole my pijamas, when I was on a trip to India" — she never wrote,
   and a typeface among four handwritten lines would read as the odd one out. So this
   cuts the line out of writing she HAS done.

   It prefers whole words. Both source sheets are pages of known text, so the words can be
   segmented and labelled without any recognition: cluster ink into rows, split each row at
   its wide gaps, and hand the resulting boxes the words of the sentence we already know is
   written there. A whole word keeps her real rhythm and letter spacing; assembling one out
   of single letters never quite does. Only the words she never wrote — when, was, trip,
   India — get built from the alphabet sheet, letter by letter with a little jitter so the
   repeats don't stamp out identically.

   This is a compositor for ONE sentence, not a font. No metrics, no kerning pairs, no
   OpenType. If she ever wants real type from her hand, that is a different job.

   node tools/glyphs.js --sheet    # contact sheet: check the cut before trusting it
*/
const path = require('path');
const fs = require('fs');
const I = require('./ink');

const STORY = path.join(__dirname, '..', 'story-src');

/* ---------------------------------------------------------------- what is on each page */

/* The alphabet block sits under the four-line sentence at the top of IMG_6504. */
const SHEET = {
  sentence: { y0: 0, y1: 950 },
  alphabet: { y0: 950, y1: 1e9 },
  lines: [
    'As a product designer I,m',      // the apostrophe is its own box; ',' stands in for it
    'curious about how design',
    'helps our mind flow in order',
    'to simplify complex workflows',
  ],
  rows: ['ABCDEFGHIJK', 'LMNOPQRSTUV', 'WXYZ', 'abcdefghijklm', 'nopqrstuvwxy', 'z'],
  /* She blotted the page just after the lowercase m. It is ink, it is letter-sized and it
     is denser than a stroke — but so is her `l` — so no density or size rule tells it from
     a letter. It is a one-off mark on a known page; name it and move on.
     Coordinates are in the alphabet block, i.e. relative to alphabet.y0. */
  ignore: [{ x0: 1740, x1: 1845, y0: 655, y1: 775 }],
};

const PARAGRAPH = [
  'Looking to make design so',
  'simple that if a monkey stole',
  'my pijamas again, they,d',
  'know how to use them.',
];

/* ------------------------------------------------------------------- segmentation */

/** Split `items` into `n` runs at the n-1 largest values of `gapAt(i)` (the gap *before*
    item i). Every split in this file is driven by a count we already know is on the page
    rather than by a tuned threshold: the sheets are known text, so the counts are free,
    and any threshold that works on the uppercase row fails on the lowercase one. */
function splitInto(items, n, gapAt) {
  if (n >= items.length) return items.map(x => [x]);
  const gaps = [];
  for (let i = 1; i < items.length; i++) gaps.push({ gap: gapAt(i), at: i });
  const cuts = gaps.sort((a, b) => b.gap - a.gap).slice(0, n - 1)
    .map(g => g.at).sort((a, b) => a - b);
  const runs = [];
  let from = 0;
  for (const c of [...cuts, items.length]) { runs.push(items.slice(from, c)); from = c; }
  return runs;
}

/** Where the row sits on its (imaginary) ruled line — returns baseline(x), not a constant.

    Her rows run downhill: the A of "A B C … K" sits 100px higher than the K. One baseline
    for the whole row leaves every glyph with a different idea of where the line is, and
    the composed sentence visibly staggers.

    Most letters rest their bottom edge on the line and only descenders hang below it, so:
    fit a line through the box bottoms, drop the points sitting well below that line, and
    refit. Two passes is enough to shake off g, j, p, q and y. */
function baselineOf(im, row) {
  const pts = row.items.map(b => ({ x: (b.x0 + b.x1) / 2, y: b.y1 }));
  const fit = ps => {
    const n = ps.length;
    const sx = ps.reduce((s, p) => s + p.x, 0), sy = ps.reduce((s, p) => s + p.y, 0);
    const sxx = ps.reduce((s, p) => s + p.x * p.x, 0), sxy = ps.reduce((s, p) => s + p.x * p.y, 0);
    const den = n * sxx - sx * sx;
    if (!den) return { m: 0, c: sy / n };
    return { m: (n * sxy - sx * sy) / den, c: (sxx * sy - sx * sxy) / den };
  };
  if (pts.length < 4) {
    const med = pts.map(p => p.y).sort((a, b) => a - b)[pts.length >> 1];
    return () => med;
  }
  let keep = pts;
  for (let pass = 0; pass < 2; pass++) {
    const { m, c } = fit(keep);
    const res = keep.map(p => p.y - (m * p.x + c));
    const sd = Math.sqrt(res.reduce((s, r) => s + r * r, 0) / res.length) || 1;
    const next = keep.filter((p, i) => res[i] < sd);      // below the line = descender
    if (next.length >= 4 && next.length < keep.length) keep = next; else break;
  }
  const { m, c } = fit(keep);
  return x => m * x + c;
}

/** Cluster ink components into `nRows` written rows. */
function rowsOf(im, nRows, { minArea = 120, ignore = [] } = {}) {
  const { labels, comps } = I.components(im, 40);
  const inside = c => ignore.some(z => c.x0 >= z.x0 && c.x1 <= z.x1 && c.y0 >= z.y0 && c.y1 <= z.y1);
  const boxes = comps.filter(c => c.area >= minArea && !inside(c))
    // carry each box's component ids so a cut can be masked to its own ink, never a neighbour's
    .map(c => ({ x0: c.x0, x1: c.x1, y0: c.y0, y1: c.y1, ids: new Set([c.id]) }))
    .sort((a, b) => a.y0 - b.y0);
  /* Cluster on the TOP edge, not the vertical centre. Her `y` in "monkey" descends far
     enough that the letter's centre falls into the line below, so a centre-based split
     hands "ey" to the next row and "monkey" gets cut down to "monk". Tops only vary by
     the ascender height within a row, which is always less than her line spacing. */
  const rows = splitInto(boxes, nRows, i => boxes[i].y0 - boxes[i - 1].y0).map(items => ({ items }));
  for (const r of rows) {
    r.items.sort((a, b) => a.x0 - b.x0);
    // rejoin an i/j dot with its stem, and any other component sitting over another
    const merged = [];
    for (const b of r.items) {
      const p = merged[merged.length - 1];
      if (p && b.x0 <= p.x1 - 2) {
        p.x0 = Math.min(p.x0, b.x0); p.x1 = Math.max(p.x1, b.x1);
        p.y0 = Math.min(p.y0, b.y0); p.y1 = Math.max(p.y1, b.y1);
        b.ids.forEach(id => p.ids.add(id));
      } else merged.push({ ...b, ids: new Set(b.ids) });
    }
    r.items = merged;
    r.y0 = Math.min(...merged.map(b => b.y0));
    r.y1 = Math.max(...merged.map(b => b.y1));
    r.baseline = baselineOf(im, r);
    r.labels = labels;
    r.comps = comps;          // including the small ones this row dropped
  }
  return rows;
}

/** Split a row into `n` words at its n-1 widest gaps.

    The gap is measured against the running right edge rather than the previous box's, so a
    letter tucked under a neighbour's overhang — her `g` and `y` reach a long way back —
    doesn't read as a word break.

    This is right on most rows and wrong on some: on "my pijamas again, they'd" the gap
    inside "Pijamas" (51px) is wider than the one between "pijamas" and "again," (47px), so
    the widest gaps are not the word breaks. Widths from the alphabet sheet are too noisy a
    prior to arbitrate that — isolated letters are drawn wider than the same letters inside
    a word, by a different factor per row, and fitting against them moved as many rows off
    as it fixed. So this stays simple and `wordLibrary` throws out the cuts that come back
    the wrong size; a rejected word gets built from her letters instead. */
function wordsOf(row, n) {
  const it = row.items;
  const rights = [];
  it.reduce((r, b, i) => { rights[i] = r; return Math.max(r, b.x1); }, it[0].x0);
  return groupsToBoxes(splitInto(it, Math.max(1, n), i => it[i].x0 - rights[i]));
}

function groupsToBoxes(groups) {
  return groups.filter(g => g.length).map(g => ({
    items: g,
    ids: g.reduce((s, b) => { b.ids.forEach(i => s.add(i)); return s; }, new Set()),
    x0: Math.min(...g.map(b => b.x0)), x1: Math.max(...g.map(b => b.x1)),
    y0: Math.min(...g.map(b => b.y0)), y1: Math.max(...g.map(b => b.y1)),
    n: g.length,
  }));
}

/* --------------------------------------------------------------------- the libraries */

const PAD = 4;
function cut(im, b, baselineAt, labels) {
  const x = Math.max(0, b.x0 - PAD), y = Math.max(0, b.y0 - PAD);
  const g = I.crop(im, x, y, b.x1 - x + PAD, b.y1 - y + PAD);
  /* Keep only this word's own strokes. The crop is a rectangle, and once "monkey" is tall
     enough to hold its descending y, that rectangle also reaches down into "again, they'd"
     on the line below and drags a piece of it along. Masking by component id cuts the word
     out by its ink instead of by its bounding box. */
  if (labels && b.ids) {
    for (let yy = 0; yy < g.height; yy++) {
      for (let xx = 0; xx < g.width; xx++) {
        const src = (y + yy) * im.width + (x + xx);
        if (!b.ids.has(labels[src])) g.data[(yy * g.width + xx) * 4 + 3] = 0;
      }
    }
  }
  // the baseline is sampled under this box, not at the row's midpoint, because the row slopes
  return { ...g, rise: baselineAt((b.x0 + b.x1) / 2) - y };
}

/** Every word we can label on the two sheets, keyed by the word itself (lowercased). */
function wordLibrary(report) {
  const lib = {};
  const letters = letterLibrary();
  const letterWidth = c => (letters[c] || letters[c.toLowerCase()] || { width: 0 }).width;
  const add = (im, lines, region, src) => {
    const page = region ? I.crop(im, 0, region.y0, im.width, Math.min(im.height, region.y1) - region.y0) : im;
    const rows = rowsOf(page, lines.length);
    rows.forEach((r, ri) => {
      const expect = (lines[ri] || '').split(' ').filter(Boolean);
      /* The comma is the only punctuation the story line needs and she wrote exactly one,
         after "again". Don't go looking for it inside a word cut — the split on that very
         row is the unreliable one. Find it by shape instead: a mark barely a fifth the
         height of a letter, sitting on or under the baseline where no letter body goes. */
      const med = r.items.map(b => b.y1 - b.y0).sort((a, b) => a - b)[r.items.length >> 1];
      for (const b of r.items) {
        if (lib[',']) break;
        if (b.y1 - b.y0 < med * 0.4 && b.y0 >= r.baseline((b.x0 + b.x1) / 2) - med * 0.1) {
          lib[','] = { ...cut(page, b, r.baseline, r.labels), src };
        }
      }

      const found = wordsOf(r, expect.length);
      if (report) console.log(`   row ${ri}: ${found.length}/${expect.length}`);
      if (found.length !== expect.length) return;      // mis-split: trust nothing in this row

      /* How much her hand tightens on this row: isolated letters are wider than the same
         letters inside a word, by a different amount per line. Measuring it per row makes
         the check below scale-free. */
      const want = expect.map(w => [...w.replace(/[.,]$/, '')].reduce((s, c) => s + letterWidth(c), 0) || 1);
      const scale = found.reduce((s, b) => s + (b.x1 - b.x0), 0) / want.reduce((a, b) => a + b, 0);

      found.forEach((b, i) => {
        const raw = expect[i];
        const w = raw.replace(/[.,]$/, '').toLowerCase();
        /* Reject rather than mis-render. A cut that comes back far from the width her own
           letters predict is a split in the wrong place — "pijamas" cut down to its P, or
           "to" that swallowed the descender of "Looking" — and stamping it would put a
           visibly wrong word in her handwriting. Dropping it just sends `compose` to the
           letter library for that word. Among instances that pass, keep the closest. */
        if (w) {
          const err = Math.abs((b.x1 - b.x0) / (scale * want[i]) - 1);
          if (err < 0.5 && (!lib[w] || err < lib[w].err)) lib[w] = { ...cut(page, b, r.baseline, r.labels), err, src };
        }
      });
    });
  };
  if (report) console.log(' paragraph:');
  add(I.read(path.join(STORY, 'paragraph.png')), PARAGRAPH, null, 'paragraph');
  if (report) console.log(' alphabet sheet sentence:');
  add(I.read(path.join(STORY, 'alphabet.png')), SHEET.lines, SHEET.sentence, 'sheet');
  return lib;
}

/** A–Z and a–z off the alphabet block. */
function letterLibrary(report) {
  const sheet = I.read(path.join(STORY, 'alphabet.png'));
  const block = I.crop(sheet, 0, SHEET.alphabet.y0, sheet.width, sheet.height - SHEET.alphabet.y0);
  /* minArea has to drop to dot size here: her i and j dots are ~60px and the 120 used for
     word cutting throws them away, leaving a dotless i. The x-overlap merge in rowsOf puts
     each dot back on its own stem. */
  const rows = rowsOf(block, SHEET.rows.length, { minArea: 30, ignore: SHEET.ignore });
  const lib = {};
  rows.forEach((r, ri) => {
    const chars = SHEET.rows[ri] || '';
    /* She wrote `hi` and `lm` touching, so those rows come back short. Rather than guess a
       width threshold — which can't tell a joined `lm` from an honestly wide `w` — split
       the widest box repeatedly until the row holds as many letters as we know it does,
       each time cutting at its thinnest ink column. */
    let items = r.items.slice();
    /* Too many boxes means a dot came away from its stem — her `i` and `j` dots sit far
       enough right that the x-overlap merge misses them. The dot always sits directly
       over its own stem, so the tightest (most negative) gap in the row is always that
       pair, never two neighbouring letters. */
    while (items.length > chars.length) {
      let mi = 1;
      for (let i = 2; i < items.length; i++) {
        if (items[i].x0 - items[i - 1].x1 < items[mi].x0 - items[mi - 1].x1) mi = i;
      }
      const [a, b] = [items[mi - 1], items[mi]];
      items.splice(mi - 1, 2, {
        x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1),
        y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1),
      });
    }
    while (items.length < chars.length) {
      let wi = 0;
      items.forEach((b, i) => { if (b.x1 - b.x0 > items[wi].x1 - items[wi].x0) wi = i; });
      const b = items[wi], w = b.x1 - b.x0;
      let best = b.x0 + (w >> 1), bestInk = 1e9;
      for (let x = Math.round(b.x0 + w * 0.3); x <= Math.round(b.x1 - w * 0.3); x++) {
        let ink = 0;
        for (let y = b.y0; y <= b.y1; y++) if (block.data[(y * block.width + x) * 4 + 3] > 40) ink++;
        if (ink < bestInk) { bestInk = ink; best = x; }
      }
      items.splice(wi, 1, { ...b, x1: best }, { ...b, x0: best + 1 });
    }
    if (report) console.log(`   row ${ri}: ${items.length} letters, expect ${chars.length} "${chars}" ${items.length === chars.length ? '✓' : '✗'}`);
    items.forEach((b, i) => { const ch = chars[i]; if (ch && !lib[ch]) lib[ch] = cut(block, b, r.baseline, r.labels); });
  });
  return lib;
}

/* ------------------------------------------------- making the two sources agree

   A composed line draws from two libraries, and they are not the same hand at the same
   size. She writes isolated letters on an alphabet sheet BIGGER and LIGHTER than she
   writes the same letters inside a word — measured on her sheet, x-height 67px against 55,
   pen 6px against 7. Stamped together untouched, every word built from letters comes out
   oversized and spindly next to the words cut whole out of her writing, and the line reads
   as two different hands. That is the "cohesive height and width" problem.

   Fixing it needs both halves. Scaling the sheet letters down to the right height alone
   makes them thinner still — a 0.82 scale takes a 6px pen to 4.9px against her 7px — so
   after the scale they are dilated back to her in-word weight. Both numbers are measured
   from the libraries on every run rather than written down here, so this keeps working if
   either lift is ever redone. */

/** Lower quartile of the horizontal ink runs — the pen width on vertical and diagonal
    strokes, ignoring the horizontal ones that inflate a plain median. */
function penWidth(g) {
  const runs = [];
  for (let y = 0; y < g.height; y++) {
    let run = 0;
    for (let x = 0; x < g.width; x++) {
      if (g.data[(y * g.width + x) * 4 + 3] > 110) run++; else { if (run) runs.push(run); run = 0; }
    }
    if (run) runs.push(run);
  }
  runs.sort((a, b) => a - b);
  return runs[Math.floor(runs.length * 0.25)] || 1;
}

const median = xs => [...xs].sort((a, b) => a - b)[xs.length >> 1];

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

/** Re-ramp alpha about the 50% contour: restores an edge without moving it, so the stroke
    keeps the width it was written at. The alphabet block was lifted soft and needs it. */
function crispen(g, lo = 96, hi = 160) {
  const data = Buffer.alloc(g.width * g.height * 4);
  for (let i = 0; i < g.width * g.height; i++) {
    const a = g.data[i * 4 + 3];
    data[i * 4 + 3] = Math.round(Math.max(0, Math.min(1, (a - lo) / (hi - lo))) * 255);
  }
  return { ...g, data };
}

/** Grow the ink by `r` px (max over a disc, fractional radii blended). Pads first, or the
    growth is clipped by the glyph's own tight crop. */
function dilate(g, r) {
  if (r <= 0.01) return g;
  const lo = Math.floor(r), hi = lo + 1, f = r - lo;
  const m = hi, nw = g.width + m * 2, nh = g.height + m * 2;
  const padded = Buffer.alloc(nw * nh * 4);
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) padded[((y + m) * nw + x + m) * 4 + 3] = g.data[(y * g.width + x) * 4 + 3];
  }
  const pass = radius => {
    if (radius === 0) return padded;
    const out = Buffer.alloc(nw * nh * 4);
    const offs = [];
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) if (dx * dx + dy * dy <= radius * radius) offs.push([dx, dy]);
    }
    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        let mx = 0;
        for (const [dx, dy] of offs) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= nw || ny >= nh) continue;
          const v = padded[(ny * nw + nx) * 4 + 3];
          if (v > mx) mx = v;
        }
        out[(y * nw + x) * 4 + 3] = mx;
      }
    }
    return out;
  };
  const a = pass(lo), b = pass(hi);
  const data = Buffer.alloc(nw * nh * 4);
  for (let i = 0; i < nw * nh; i++) data[i * 4 + 3] = Math.round(a[i * 4 + 3] * (1 - f) + b[i * 4 + 3] * f);
  return { width: nw, height: nh, data, rise: g.rise + m };
}

function trimGlyph(g) {
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
  const nw = x1 - x0 + 1, nh = y1 - y0 + 1, data = Buffer.alloc(nw * nh * 4);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) data[(y * nw + x) * 4 + 3] = g.data[((y + y0) * g.width + x + x0) * 4 + 3];
  }
  return { width: nw, height: nh, data, rise: g.rise - y0 };
}

/** Bring every stamp — both libraries, all three sources — onto one scale and one weight.

    There are three different hands in play, not two, and that is why the composed line
    never settled:

      paragraph.png   she wrote small and tight   — most of the story's words
      alphabet.png    the sentence at the top     — the rest of the words
      alphabet.png    the A–Z block underneath    — every letter

    The two pages were photographed at different distances, so a word off one is about 40%
    bigger than the same word off the other, and the sheet's isolated letters are bigger
    and lighter again. Stamped together untouched they read as three hands.

    So: measure each source's own x-height and pen, pick the smallest x-height as the target
    (scaling DOWN keeps edges sharp; scaling up would soften them), scale every glyph of
    every source to it, and dilate each back to a common pen weight afterwards — a scale
    alone would leave the shrunk sources spindly. Every number is measured on each run. */
const _normCache = new WeakMap();
function normaliseHand(words, letters) {
  if (_normCache.has(words)) return _normCache.get(words);

  /* One yardstick per source. Median trimmed height over everything that source has is far
     steadier than picking x-height-only words — ascenders and descenders are distributed
     much the same way in each source, so the medians stay comparable, and there are only a
     handful of ascender-free words per page to choose from anyway. */
  const bySource = {};
  const note = (g, src) => { (bySource[src] ||= []).push(g); };
  for (const [k, g] of Object.entries(words)) if (g && g.width) note(g, g.src || 'sheet');
  for (const [k, g] of Object.entries(letters)) note(crispen(g), 'letters');

  /* The yardstick has to be x-height, and it has to be the same idea of x-height in every
     source. A plain median is not it: the letter source is half capitals, so its median
     lands near cap-height and the letters come back under-scaled. The lower quartile is,
     because x-height glyphs are the largest single class everywhere and everything taller
     (capitals, ascenders, descenders) sits above them. Punctuation sits below and would
     drag the quartile down, so drop anything less than 40% of the source median first —
     that is her comma and nothing else. */
  const metric = {};
  for (const [src, gs] of Object.entries(bySource)) {
    const hs = gs.map(g => trimGlyph(g).height).sort((a, b) => a - b);
    const mid = hs[hs.length >> 1];
    const body = hs.filter(h => h >= mid * 0.4);
    metric[src] = {
      xh: body[Math.floor(body.length * 0.25)],
      pen: median(gs.map(g => penWidth(g))),
    };
  }
  const target = Math.min(...Object.values(metric).map(m => m.xh));
  const pen = median(Object.values(metric).map(m => m.pen));

  const fit = (g, src) => {
    const m = metric[src];
    const k = target / m.xh;
    const base = scaleGlyph(k < 0.995 ? crispen(g) : g, k);
    let r = Math.max(0, (pen - m.pen * k) / 2);
    let done = trimGlyph(crispen(dilate(base, r), 110, 150));
    for (let i = 0; i < 4; i++) {
      const got = penWidth(done);
      if (Math.abs(got - pen) < 0.6) break;
      r = Math.max(0, r + (pen - got) / 2);
      done = trimGlyph(crispen(dilate(base, r), 110, 150));
    }
    return done;
  };

  /* Put every stamp back on the line.

     `rise` — how far the baseline sits below a glyph's top — comes from a least-squares fit
     through the bottom edges of a whole written row, and on a row of isolated letters that
     fit is loose: it hands her `m` a 23px descender and her `a` a baseline 2px above its
     own feet. Stamped, the letters ride at a dozen different heights and the line staggers,
     which is most of what reads as "not cohesive" — more than the scale ever was.

     Her hand is print, not cursive: a letter rests ON the line unless it is one of the five
     that hang below it. So a single letter with no descender gets its baseline put at its
     own bottom edge, exactly, and the five that do descend keep whatever the fit gave them.

     This is for SINGLE LETTERS only. A whole word's baseline is fit through the bottoms of
     all of its letters at once, which is a much better-conditioned problem — and a word
     box spans ascender to descender, so its bottom edge is not its baseline at all.
     Forcing the same rule onto words sends every word with a descender in it flying off
     the line. */
  const DESCENDS = 'gjpqy';
  const sit = (g, ch) => (DESCENDS.includes(ch.toLowerCase()) ? g : { ...g, rise: g.height });

  const outW = {}, outL = {};
  for (const [k, g] of Object.entries(words)) if (g && g.width) outW[k] = fit(g, g.src || 'sheet');
  for (const [k, g] of Object.entries(letters)) outL[k] = sit(fit(g, 'letters'), k);
  const res = { words: outW, letters: outL, metric, target, pen };
  _normCache.set(words, res);
  return res;
}

/* ----------------------------------------------------------------------- composition */

/** Deterministic per-stamp wobble — same input always draws the same line. */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

function rotateScale(g, deg, k) {
  const rad = deg * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
  const w = g.width, h = g.height;
  const nw = Math.ceil((Math.abs(w * c) + Math.abs(h * s)) * k);
  const nh = Math.ceil((Math.abs(w * s) + Math.abs(h * c)) * k);
  const out = Buffer.alloc(nw * nh * 4);
  const cx = w / 2, cy = h / 2, ncx = nw / 2, ncy = nh / 2;
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const dx = (x - ncx) / k, dy = (y - ncy) / k;
      const sx = cx + dx * c + dy * s, sy = cy - dx * s + dy * c;      // inverse rotate
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      if (x0 < 0 || y0 < 0 || x0 + 1 >= w || y0 + 1 >= h) continue;
      const fx = sx - x0, fy = sy - y0, d = (y * nw + x) * 4;
      const a = (i, j) => g.data[((y0 + j) * w + x0 + i) * 4 + 3];
      out[d] = g.data[0]; out[d + 1] = g.data[1]; out[d + 2] = g.data[2];
      out[d + 3] = Math.round(
        a(0, 0) * (1 - fx) * (1 - fy) + a(1, 0) * fx * (1 - fy) +
        a(0, 1) * (1 - fx) * fy + a(1, 1) * fx * fy);
    }
  }
  // rotateScale drops the tint on fully transparent pixels; restore it everywhere
  for (let i = 0; i < nw * nh; i++) { out[i * 4] = 0x3c; out[i * 4 + 1] = 0x6b; out[i * 4 + 2] = 0x76; }
  return { width: nw, height: nh, data: out, rise: (g.rise + (nh - h) / 2) * k };
}

/** Set `text` as an alpha mask. Words she wrote are stamped whole; the rest are built
    from letters. Returns {width,height,data} plus the stamp boxes, in order, so the
    animation can reveal the line word by word. */
/* `bearing` is the gap left after each stamp, as a fraction of x-height. It is larger than
   it looks like it should be because normaliseHand trims every glyph tight to its ink —
   the cuts used to carry 4px of padding a side, which was doing the letter-spacing by
   accident, and once that goes the letters run into each other. */
function compose(text, { words: rawWords, letters: rawLetters, space = 0.42, bearing = 0.2, jitter = 1, seed = 7 } = {}) {
  /* Put the three sources on one scale before a single stamp is placed — otherwise the
     line is a mix of three sizes of her handwriting and reads as three different hands. */
  const { words, letters } = normaliseHand(rawWords, rawLetters);
  const rand = rng(seed);
  const wob = amt => (rand() * 2 - 1) * amt * jitter;
  let wi = 0;                                       // which word each stamp belongs to

  // x-height sets every spacing constant, so the line scales with the source hand
  const xh = letters.o ? letters.o.height : 60;
  const stamps = [];
  let pen = 0;

  for (const token of text.split(' ')) {
    const bare = token.replace(/[.,]+$/, '');
    const tail = token.slice(bare.length);
    const key = bare.toLowerCase();
    const start = pen;

    if (words[key] && bare === bare.toLowerCase()) {
      const g = rotateScale(words[key], wob(1.4), 1 + wob(0.02));
      stamps.push({ g, x: pen, token: bare, wi });
      pen += g.width + xh * bearing;
    } else {
      for (const ch of bare) {
        const src = letters[ch] || letters[ch.toLowerCase()] || letters[ch.toUpperCase()];
        if (!src) { console.warn(`  no glyph for "${ch}"`); continue; }
        const g = rotateScale(src, wob(2.2), 1 + wob(0.035));
        stamps.push({ g, x: pen, token: ch, wi });
        pen += g.width + xh * bearing;
      }
    }
    for (const ch of tail) {
      const src = words[ch] || letters[ch];
      if (src) { const g = rotateScale(src, wob(1.5), 1); stamps.push({ g, x: pen, token: ch, wi }); pen += g.width; }
    }
    stamps[stamps.length - 1].wordEnd = true;
    pen += xh * space;
    stamps[stamps.length - 1].advance = pen - start;
    wi++;
  }

  /* place on a baseline with a slow drift, the way a hand rides a ruled line */
  const baseline = Math.max(...stamps.map(s => s.g.rise)) + xh * 0.25;
  stamps.forEach((s, i) => { s.y = baseline - s.g.rise + Math.sin(i * 0.7) * xh * 0.035 + wob(xh * 0.03); });

  const W = Math.ceil(pen - xh * space) + 8;
  const H = Math.ceil(Math.max(...stamps.map(s => s.y + s.g.height))) + 8;
  const data = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) { data[i * 4] = 0x3c; data[i * 4 + 1] = 0x6b; data[i * 4 + 2] = 0x76; }
  for (const s of stamps) {
    const ox = Math.round(s.x) + 4, oy = Math.round(s.y) + 4;
    for (let y = 0; y < s.g.height; y++) {
      const ty = oy + y; if (ty < 0 || ty >= H) continue;
      for (let x = 0; x < s.g.width; x++) {
        const tx = ox + x; if (tx < 0 || tx >= W) continue;
        const a = s.g.data[(y * s.g.width + x) * 4 + 3];
        const d = (ty * W + tx) * 4;
        if (a > data[d + 3]) data[d + 3] = a;
      }
    }
    s.box = { x: ox, y: oy, w: s.g.width, h: s.g.height };
  }
  /* One box per word, not per stamp: a word built out of single letters is many stamps,
     and revealing it a stamp at a time would spell it out letter by letter instead of
     word by word. */
  const wordBoxes = [];
  for (const s of stamps) {
    const b = wordBoxes[s.wi];
    if (!b) { wordBoxes[s.wi] = { x: s.box.x, y: s.box.y, w: s.box.w, h: s.box.h }; continue; }
    const x1 = Math.max(b.x + b.w, s.box.x + s.box.w), y1 = Math.max(b.y + b.h, s.box.y + s.box.h);
    b.x = Math.min(b.x, s.box.x); b.y = Math.min(b.y, s.box.y);
    b.w = x1 - b.x; b.h = y1 - b.y;
  }
  return { width: W, height: H, data, stamps, words: wordBoxes };
}

/** Compose several lines and stack them, returning one mask plus the per-line stamps with
    their offsets applied — the animation reveals the sentence stamp by stamp. */
function composeLines(lines, opts = {}) {
  const laid = lines.map((t, i) => compose(t, { ...opts, seed: (opts.seed || 7) + i * 31 }));
  /* leading follows the NORMALISED x-height, not the raw sheet's — the sheet's is larger,
     and using it opened a gap you could park another line in */
  const norm = opts.letters && opts.words ? normaliseHand(opts.words, opts.letters) : null;
  const xh = norm && norm.letters.o ? norm.letters.o.height : 60;
  const leading = Math.round(xh * (opts.leading || 2.05));
  const W = Math.max(...laid.map(l => l.width));
  const tops = [];
  let y = 0;
  for (const l of laid) { tops.push(y); y += leading; }
  const H = y - leading + laid[laid.length - 1].height;
  const data = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) { data[i * 4] = 0x3c; data[i * 4 + 1] = 0x6b; data[i * 4 + 2] = 0x76; }
  const stamps = [], words = [];
  laid.forEach((l, li) => {
    const oy = tops[li];
    for (let yy = 0; yy < l.height; yy++) {
      for (let xx = 0; xx < l.width; xx++) {
        const a = l.data[(yy * l.width + xx) * 4 + 3];
        const d = ((oy + yy) * W + xx) * 4;
        if (a > data[d + 3]) data[d + 3] = a;
      }
    }
    for (const s of l.stamps) stamps.push({ ...s, box: { ...s.box, y: s.box.y + oy } });
    for (const b of l.words) words.push({ ...b, y: b.y + oy });
  });
  return { width: W, height: H, data, stamps, words };
}

module.exports = { wordLibrary, letterLibrary, compose, composeLines, rowsOf, wordsOf };

/* ------------------------------------------------------------------- verification */
if (require.main === module) {
  console.log('word library:');
  const words = wordLibrary(true);
  console.log('  →', Object.keys(words).sort().join(' '));
  console.log('letter library:');
  const letters = letterLibrary(true);
  console.log('  →', Object.keys(letters).join(''));
}
