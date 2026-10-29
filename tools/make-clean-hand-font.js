#!/usr/bin/env node
/* Madhu Hand, cleaned (2026-10-28).

   She picked one Flora rewrite of her "stay curious" (story-src/clean/word.png: her letters,
   written again slowly with a smooth felt-tip, no tremor) and asked for "my entire handwriting
   font and grammar and numbers to look as clean as this". Flora then wrote three specimen
   sheets in that same hand, and this turns them into the font every bit of handwriting on the
   site is set in:

     story-src/clean/lower.png   a–z, two rows
     story-src/clean/upper.png   A–Z, two rows
     story-src/clean/marks.png   0–9 / . , ' ! ? : ; - / ( ) & @ / + " #
     story-src/clean/word.png    her pick: only read for the letter and word spacing

   The photographed hand (tools/make-hand-font.js) needed 1400 lines to rescue faint upstrokes
   and pen lifts. These sheets have neither, so this only has to find each letter, put it on
   its line, and bring the three sheets to one pen:

   - LETTERS are ink islands, grouped: a piece sitting mostly inside another's width (an i's
     dot, the bottom of a !) belongs to it; then, if a row still has more pieces than it has
     characters, the two closest neighbours join (the two ticks of a ", the strokes of a #).
     A row with FEWER pieces than characters is two letters touching, and stops the build.
   - THE BASELINE is fitted per row through the bottoms of the characters that sit on it
     (Flora's rows are straight, but not perfectly level).
   - ONE PEN. The sheets were written at different sizes; the stroke is the same pen, so each
     sheet is scaled until its median stroke width matches the lowercase sheet's.

   Run:  node tools/make-clean-hand-font.js [--proof]
   Out:  assets/fonts/madhu-hand.woff/.ttf/.json   (same family name, so nothing else changes)
         font-proofs/clean-*.png with --proof */
const fs = require('fs');
const path = require('path');
const I = require('./ink');
const TTF = require('./ttf');
const { decode } = require('./png');
const H = require('./make-hand-font');
const { median, inkBox, resample, reweight, penWidth, setBox, contoursOf, UPEM, ASCENDER_UNITS } = H;

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'story-src', 'clean');
const LOWER = process.env.LOWER || 'lower.png';
const OUT_DIR = path.join(ROOT, 'assets', 'fonts');

/* what each sheet says, row by row, and which characters in a row stand on the baseline */
const SHEETS = {
  lower: { rows: ['abcdefghijklm', 'nopqrstuvwxyz'], sit: 'abcdehiklmnorstuvwxz' },
  upper: { rows: ['ABCDEFGHIJKLM', 'NOPQRSTUVWXYZ'], sit: 'ABCDEFGHIJKLMNOPRSTUVWXYZ' },
  marks: { rows: ['0123456789', ".,'!?:;-", '()&@/+"#'], sit: '0123456789.!?:&@+#' },
};
const DESCENDERS = 'gjpqy';
const NAMES = { '.': 'period', ',': 'comma', "'": 'quotesingle', '!': 'exclam', '?': 'question',
  ':': 'colon', ';': 'semicolon', '-': 'hyphen', '(': 'parenleft', ')': 'parenright', '&': 'ampersand',
  '@': 'at', '/': 'slash', '+': 'plus', '"': 'quotedbl', '#': 'numbersign' };

/** black ink on white → an alpha plane (0..1) and the same as an RGBA image for ink.js */
function read(f) {
  const im = decode(fs.readFileSync(path.join(SRC, f)));
  const ch = im.data.length / (im.width * im.height), n = im.width * im.height;
  const a = new Float32Array(n), data = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const l = (im.data[i * ch] + im.data[i * ch + 1] + im.data[i * ch + 2]) / 3;
    a[i] = Math.max(0, Math.min(1, (225 - l) / 175));
    data[i * 4 + 3] = a[i] * 255;
  }
  return { a, w: im.width, h: im.height, im: { width: im.width, height: im.height, data } };
}

/** the characters of one sheet: {ch, comps:[...], box} per character, rows in order */
function cut(sheet, spec, name) {
  const { labels, comps } = I.components(sheet.im, 127);
  const real = comps.filter(c => c.area >= 60);
  const hs = median(real.map(c => c.y1 - c.y0));
  /* rows: a row's centre line is the median middle of its full-height pieces */
  const big = real.filter(c => c.y1 - c.y0 > hs * 0.6).sort((p, q) => (p.y0 + p.y1) - (q.y0 + q.y1));
  const bands = [];
  for (const c of big) {
    const b = bands[bands.length - 1];
    if (b && c.y0 < b.y1 - hs * 0.2) { b.y0 = Math.min(b.y0, c.y0); b.y1 = Math.max(b.y1, c.y1); b.cs.push(c); }
    else bands.push({ y0: c.y0, y1: c.y1, cs: [c] });
  }
  if (bands.length !== spec.rows.length) throw new Error(`${name}: found ${bands.length} rows, expected ${spec.rows.length}`);
  const mids = bands.map(b => median(b.cs.map(c => (c.y0 + c.y1) / 2)));
  const rows = bands.map(() => []);
  for (const c of real) {
    const cy = (c.y0 + c.y1) / 2;
    let best = 0;
    mids.forEach((m, i) => { if (Math.abs(cy - m) < Math.abs(cy - mids[best])) best = i; });
    rows[best].push(c);
  }
  const out = [];
  rows.forEach((cs, r) => {
    const want = spec.rows[r];
    cs.sort((p, q) => p.x0 - q.x0);
    let gl = [];
    for (const c of cs) {
      /* a piece mostly inside another's width is part of the same character */
      const host = gl.find(g => Math.min(g.x1, c.x1) - Math.max(g.x0, c.x0) > 0.5 * Math.min(g.x1 - g.x0, c.x1 - c.x0));
      if (host) { host.cs.push(c); host.x0 = Math.min(host.x0, c.x0); host.x1 = Math.max(host.x1, c.x1); }
      else gl.push({ cs: [c], x0: c.x0, x1: c.x1 });
    }
    gl.sort((p, q) => p.x0 - q.x0);
    while (gl.length > want.length) {
      let k = 0;
      for (let i = 1; i < gl.length - 1; i++) if (gl[i + 1].x0 - gl[i].x1 < gl[k + 1].x0 - gl[k].x1) k = i;
      const [p, q] = gl.splice(k, 2);
      gl.splice(k, 0, { cs: [...p.cs, ...q.cs], x0: Math.min(p.x0, q.x0), x1: Math.max(p.x1, q.x1) });
    }
    if (gl.length < want.length) throw new Error(`${name} row ${r + 1}: ${gl.length} characters for "${want}" — two are touching`);
    gl.forEach((g, i) => {
      g.ch = want[i];
      g.y0 = Math.min(...g.cs.map(c => c.y0)); g.y1 = Math.max(...g.cs.map(c => c.y1));
      g.row = r;
    });
    /* baseline: a line fitted through the bottoms of the characters that sit on it, refitted
       once without whatever it missed by more than a tenth of the row */
    const fit = pts => {
      const n = pts.length, mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
      const sxx = pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0), sxy = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0);
      const m = sxx ? sxy / sxx : 0; return x => my + m * (x - mx);
    };
    let pts = gl.filter(g => spec.sit.includes(g.ch)).map(g => [(g.x0 + g.x1) / 2, g.y1]);
    let line = fit(pts);
    pts = pts.filter(p => Math.abs(p[1] - line(p[0])) < hs * 0.1);
    line = fit(pts);
    for (const g of gl) { g.baseY = line((g.x0 + g.x1) / 2); out.push(g); }
  });
  /* each character's own plane: its box, padded, with every other piece of ink wiped out */
  const PAD = 6;
  for (const g of out) {
    const ids = new Set(g.cs.map(c => c.id));
    const x0 = Math.max(0, g.x0 - PAD), y0 = Math.max(0, g.y0 - PAD);
    const w = Math.min(sheet.w, g.x1 + PAD + 1) - x0, h = Math.min(sheet.h, g.y1 + PAD + 1) - y0;
    const a = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y + y0) * sheet.w + x + x0, l = labels[i];
      a[y * w + x] = l !== -1 && !ids.has(l) ? 0 : sheet.a[i];
    }
    g.p = soften({ a, w, h }, SOFTEN);
    g.baseline = g.baseY - y0;
  }
  return out;
}

/** Flora's lowercase sheet came back with a slightly blotchy ink edge (her 2026-10-28 pick kept
    the letter shapes, not the edge). A blur cut back at the same 0.5 level the tracer uses
    rounds off bumps smaller than the radius and leaves the stroke where it was. */
const SOFTEN = +(process.env.SOFTEN || 0);
function soften(p, r) {
  if (!r) return p;
  let a = p.a;
  for (let pass = 0; pass < 3; pass++) for (const [dx, dy] of [[1, 0], [0, 1]]) {
    const b = new Float32Array(a.length);
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
      let s = 0, n = 0;
      for (let t = -r; t <= r; t++) { const xx = x + t * dx, yy = y + t * dy; if (xx >= 0 && yy >= 0 && xx < p.w && yy < p.h) { s += a[yy * p.w + xx]; n++; } }
      b[y * p.w + x] = s / n;
    }
    a = b;
  }
  /* re-sharpen around the 0.5 cut so the tracer still gets a crisp, anti-aliased edge */
  for (let i = 0; i < a.length; i++) a[i] = Math.max(0, Math.min(1, (a[i] - 0.5) * 4 + 0.5));
  return { a, w: p.w, h: p.h };
}

/** letter and word spacing, from the gaps in her picked "stay curious" */
function spacing() {
  const s = read('word.png');
  const { comps } = I.components(s.im, 127);
  const big = comps.filter(c => c.area >= 60);
  const hs = median(big.map(c => c.y1 - c.y0));
  const letters = big.filter(c => c.y1 - c.y0 > hs * 0.5).sort((p, q) => p.x0 - q.x0);
  const base = median(letters.map(c => c.y1));
  /* boxes above the line, so the y's loop does not count into the gap */
  const boxes = letters.map(c => {
    let x0 = c.x1, x1 = c.x0;
    for (let y = c.y0; y <= Math.min(c.y1, base); y++) for (let x = c.x0; x <= c.x1; x++)
      if (s.a[y * s.w + x] >= 0.5) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    return { x0, x1 };
  });
  const gaps = boxes.slice(1).map((b, i) => b.x0 - boxes[i].x1);
  const word = Math.max(...gaps);
  const letter = median(gaps.filter(g => g !== word));
  const pen = median(letters.map(c => {
    const w = c.x1 - c.x0 + 1, h = c.y1 - c.y0 + 1, a = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a[y * w + x] = s.a[(y + c.y0) * s.w + x + c.x0];
    return penWidth({ a, w, h });
  }));
  const xh = median(letters.map(c => base - c.y0));
  if (process.env.DEBUG) console.log("  word.png gaps", gaps.join(" "), "xh", xh);
  const span = boxes[boxes.length - 1].x1 - boxes[0].x0;   // "stay curious", first ink to last
  return { letter, word, pen, xh, span };
}

function main() {
  const all = [];
  const pens = {};
  for (const [name, spec] of Object.entries(SHEETS)) {
    const gl = cut(read(name === 'lower' ? LOWER : name + '.png'), spec, name);
    pens[name] = median(gl.filter(g => /[a-zA-Z0-9]/.test(g.ch)).map(g => penWidth(g.p)));
    gl.forEach(g => (g.sheet = name));
    all.push(...gl);
  }
  /* ONE SIZE, ONE PEN. Flora wrote each sheet at its own size and, on some takes, with a finer
     pen. Sizes: capitals stand at 0.95 of the lowercase ascender and the digits as tall as the
     capitals (what the first full set of sheets measured, all written in one go with one pen).
     Weight: every stroke is brought to HER PICK's pen, as a share of the x-height — the weight
     she said yes to, not whichever pen Flora reached for on a given sheet. */
  const sp = spacing();
  const xh0 = median(all.filter(g => g.sheet === 'lower' && 'acemnorsuvwxz'.includes(g.ch)).map(g => g.baseline - inkBox(g.p).y0));
  const penTo = sp.pen / sp.xh * xh0;
  const reach0 = g => g.baseline - inkBox(g.p).y0;
  const med = (sheet, chars) => median(all.filter(g => g.sheet === sheet && chars.includes(g.ch)).map(reach0));
  const capTo = 0.95 * med('lower', 'bdhkl');
  const kSheet = { lower: 1, upper: capTo / med('upper', 'ABCDEFHIKLMNPRTUVWXYZ'), marks: capTo / med('marks', '0123456789') };
  for (const g of all) {
    const k = kSheet[g.sheet];
    if (Math.abs(k - 1) > 0.005) { g.p = resample(g.p, k); g.baseline *= k; }
    const delta = (penTo - pens[g.sheet] * k) / 2;
    if (Math.abs(delta) > 0.25) g.p = reweight(g.p, delta);
    g.ink = inkBox(g.p);
    g.reach = g.baseline - g.ink.y0;
  }
  const by = c => all.find(g => g.ch === c);
  const xh = median('acemnorsuvwxz'.split('').map(c => by(c).reach));
  const asc = median('bdhkl'.split('').map(c => by(c).reach));
  const cap = median('ABCDEFHIKLMNPRTUVWXYZ'.split('').map(c => by(c).reach));
  const desc = median(DESCENDERS.split('').map(c => by(c).ink.y1 - by(c).baseline));
  const k0 = ASCENDER_UNITS / asc;

  const toLower = xh / sp.xh;          // word.png pixels → lowercase-sheet pixels
  const wordUnits = Math.round((sp.word - sp.letter) * toLower * k0);
  for (const g of all) {
    /* letters set by the box above the line, so tails overhang the way they do on paper;
       marks that live below it (the comma) by their whole box */
    g.set = setBox(g.p, g.baseline) || g.ink;
    if (/[,;()]/.test(g.ch)) g.set = g.ink;
  }
  /* THE SIDEBEARING IS SOLVED, NOT MEASURED: "stay curious" set in the font must be as long, per
     x-height, as it is in her pick. Measured gaps alone set it 13% tighter, because Flora's
     sheet letters are narrower than the ones she said yes to (her 2026-10-28 "as clean as
     this" means the rhythm of the line too). Ten letter gaps and one word space in between. */
  const letters = 'staycurious'.split('').map(c => by(c).set.w * k0);
  const target = sp.span / sp.xh * xh * k0;
  const sb = Math.max(Math.round(sp.letter * toLower / 2 * k0), Math.round((target - letters.reduce((a, b) => a + b, 0) - wordUnits) / 20));

  console.log(`  sheet scales: ${Object.entries(kSheet).map(([n, k]) => `${n} x${k.toFixed(2)}`).join(', ')}`);
  console.log(`  pens: ${Object.entries(pens).map(([n, p]) => `${n} ${p.toFixed(1)}px`).join(', ')}; word.png ${sp.pen.toFixed(1)}px`);
  console.log(`  x-height ${xh.toFixed(0)}px · ascender ${(asc / xh).toFixed(2)}x · cap ${(cap / xh).toFixed(2)}x · descender ${(desc / xh).toFixed(2)}x`);

  const entries = [{ name: '.notdef', code: null, advance: wordUnits, contours: [] },
                   { name: 'space', code: 32, advance: wordUnits, contours: [] }];
  for (const g of all) {
    const contours = contoursOf(g, k0, sb);
    const advance = Math.round(g.set.w * k0 + sb * 2);
    entries.push({ name: NAMES[g.ch] || g.ch, code: g.ch.charCodeAt(0), advance, contours, ch: g.ch });
  }
  /* the curly and typographic twins a browser produces from smart quotes and dashes */
  const alias = { 0x2019: "'", 0x2018: "'", 0x201C: '"', 0x201D: '"', 0x2013: '-', 0x2014: '-' };
  for (const [code, ch] of Object.entries(alias)) {
    const e = entries.find(x => x.ch === ch);
    entries.push({ ...e, code: +code });
  }

  const meta = {
    unitsPerEm: UPEM,
    ascender: Math.round(asc * k0),
    descender: -Math.round(desc * k0),
    lineGap: Math.round(xh * k0 * 0.55),
    capHeight: Math.round(cap * k0),
    xHeight: Math.round(xh * k0),
    family: 'Madhu Hand', subfamily: 'Regular',
    version: '2.000', revision: 2.0,
    designer: 'Madhumita Krishnan', vendor: 'MKRI',
  };
  const ttf = TTF.build(entries, meta);
  fs.writeFileSync(path.join(OUT_DIR, 'madhu-hand.ttf'), ttf);
  fs.writeFileSync(path.join(OUT_DIR, 'madhu-hand.woff'), TTF.woff(ttf));
  const json = {
    source: ['story-src/clean/lower.png', 'story-src/clean/upper.png', 'story-src/clean/marks.png', 'story-src/clean/word.png'],
    unitsPerEm: UPEM, ascender: meta.ascender, descender: meta.descender,
    capHeight: meta.capHeight, xHeight: meta.xHeight,
    capRatio: +(meta.capHeight / UPEM).toFixed(4),
    xRatio: +(meta.xHeight / UPEM).toFixed(4),
    wordSpace: +((wordUnits + 2 * sb) / UPEM).toFixed(4),
    sidebearing: +(sb / UPEM).toFixed(4),
    characters: entries.filter(e => e.code).map(e => String.fromCharCode(e.code)).join(''),
    glyphs: entries.length,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'madhu-hand.json'), JSON.stringify(json, null, 2) + '\n');
  console.log(`  ${entries.length} glyphs · cap ${meta.capHeight} · x ${meta.xHeight} · asc ${meta.ascender} · desc ${meta.descender} · sb ${sb} · space ${wordUnits}`);
  console.log(`  madhu-hand.woff ${(fs.statSync(path.join(OUT_DIR, 'madhu-hand.woff')).size / 1024).toFixed(0)}kb · ${json.characters}`);
}

main();
