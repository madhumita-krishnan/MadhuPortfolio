/* Cut Madhu's handwritten hero sentence into one PNG per written line.

   WHY: the sentence used to ship as a single 1416x772 mask, so its four lines were locked
   into one rigid left-aligned rectangle — and a rectangle is exactly the wrong shape for
   this hero. The two blooms leave a diagonal channel between them, and a block with a flat
   left edge and a flat right edge has to either sit on paint or sit in the middle of a lot
   of empty page. Once each line is its own element the layout can indent them
   independently, so the paragraph's silhouette can follow the channel instead of fighting
   it. It also lets each line carry its own baseline tilt, which is how handwriting on
   unruled paper actually sits.

   HOW: not a row projection. Splitting on empty scanlines cuts the descender off the "g"
   in "designer" and the "g" in "design", because those tails reach down into the gap and
   in one case into the line below. So this labels every connected blob of ink, works out
   the four line bands from the row profile, and assigns each blob WHOLE to the band its
   own centre falls in. A descender travels with its letter; a dotted i keeps its dot.

   Run:  node tools/slice-hero-lines.js
   Out:  assets/hero/hero-line-1.png … hero-line-N.png
         assets/hero/hero-lines.json  — the manifest build.js reads for aspect ratios and
                                        the natural indent of each line, so the CSS never
                                        hardcodes a number that the PNGs could drift from.
*/
const fs = require('fs');
const path = require('path');
const { decode, encode } = require('./png.js');

const HERO = path.join(__dirname, '..', 'assets', 'hero');
const SRC = path.join(HERO, 'hero-line-handwritten.png');
const INK = 40;      // alpha at or above this counts as ink for labelling
const MIN_BLOB = 12; // a speck this small is scanner dirt, not a pen mark

const img = decode(fs.readFileSync(SRC));
const { width: W, height: H, data } = img;

/* ---- 1. line bands from the row profile ------------------------------------------------
   Only used to decide HOW MANY lines there are and roughly where each sits. The actual
   pixels are assigned per blob below, so a band boundary landing mid-descender is fine. */
const rowInk = new Int32Array(H);
for (let y = 0; y < H; y++) {
  let n = 0;
  for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] >= INK) n++;
  rowInk[y] = n;
}
/* A descender crossing a gap leaves a thin trickle of ink rather than a clean zero, so the
   run has to be cut at a low-but-nonzero threshold, proportional to the busiest row.
   Measured on this sheet: the busiest row is 438px of ink, a row through the middle of a
   written line runs 250-440, and the worst gap row — the one the "g" of "designer" and the
   "b" of "about" both pass through — is 61, i.e. 14% of peak. So the cut has to sit above
   14% and below the ~57% where the thinnest real line row sits. 22% is the middle of that
   gap and is not close to either edge. */
const peak = Math.max(...rowInk);
const QUIET = Math.max(1, Math.round(peak * 0.22));

const bands = [];
let start = -1;
for (let y = 0; y < H; y++) {
  const loud = rowInk[y] > QUIET;
  if (loud && start < 0) start = y;
  if (!loud && start >= 0) { bands.push([start, y]); start = -1; }
}
if (start >= 0) bands.push([start, H]);
/* Fold away any run too short to be a written line — a descender island that cleared the
   threshold on its own. Measured against the TALLEST run rather than against H/count, so
   one spurious run can't drag the yardstick down and legitimise the next one. */
const tallest = Math.max(...bands.map(([a, b]) => b - a), 1);
const merged = [];
for (const b of bands) {
  const prev = merged[merged.length - 1];
  if (prev && b[1] - b[0] < tallest * 0.35) prev[1] = b[1];
  else merged.push(b.slice());
}

/* ---- 2. label the ink ---------------------------------------------------------------- */
const label = new Int32Array(W * H).fill(-1);
const stack = new Int32Array(W * H);
const blobs = [];
for (let s = 0; s < W * H; s++) {
  if (label[s] >= 0 || data[s * 4 + 3] < INK) continue;
  const id = blobs.length;
  let sp = 0, n = 0, sumY = 0, x0 = W, x1 = -1, y0 = H, y1 = -1;
  const px = [];
  stack[sp++] = s; label[s] = id;
  while (sp) {
    const p = stack[--sp];
    px.push(p); n++;
    const x = p % W, y = (p / W) | 0;
    sumY += y;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const q = ny * W + nx;
      if (label[q] < 0 && data[q * 4 + 3] >= INK) { label[q] = id; stack[sp++] = q; }
    }
  }
  blobs.push({ n, cy: sumY / n, x0, x1, y0, y1, px });
}

/* ---- 3. assign each blob to a band --------------------------------------------------
   By centre of mass, not by top edge: the "g" of "designer" has its bowl on line 1 and its
   tail well into the gap, and its centre still sits on line 1 where it belongs. A blob
   whose centre lands in a gap goes to whichever band centre is nearest. */
const bandMid = merged.map(([a, b]) => (a + b) / 2);
const lines = merged.map(() => []);
let dropped = 0;
for (const b of blobs) {
  if (b.n < MIN_BLOB) { dropped++; continue; }
  let hit = merged.findIndex(([a, z]) => b.cy >= a && b.cy < z);
  if (hit < 0) {
    let best = 0;
    for (let i = 1; i < bandMid.length; i++) {
      if (Math.abs(b.cy - bandMid[i]) < Math.abs(b.cy - bandMid[best])) best = i;
    }
    hit = best;
  }
  lines[hit].push(b);
}

/* ---- 4. write one tight PNG per line -------------------------------------------------- */
const manifest = { source: path.basename(SRC), sheet: { w: W, h: H }, lines: [] };
lines.forEach((group, i) => {
  if (!group.length) return;
  const x0 = Math.min(...group.map(b => b.x0)), x1 = Math.max(...group.map(b => b.x1));
  const y0 = Math.min(...group.map(b => b.y0)), y1 = Math.max(...group.map(b => b.y1));
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const out = Buffer.alloc(w * h * 4);
  for (const b of group) {
    for (const p of b.px) {
      const x = (p % W) - x0, y = ((p / W) | 0) - y0;
      const o = (y * w + x) * 4, s = p * 4;
      out[o] = data[s]; out[o + 1] = data[s + 1]; out[o + 2] = data[s + 2]; out[o + 3] = data[s + 3];
    }
  }
  const name = `hero-line-${i + 1}.png`;
  fs.writeFileSync(path.join(HERO, name), encode({ width: w, height: h, data: out }));
  /* Every measurement is a FRACTION OF THE ORIGINAL SHEET, not of the line's own box, so
     the hero can drop the four lines back onto a box of the sheet's aspect ratio and land
     each one exactly where her hand put it. That matters most for `top`: the boxes are
     trimmed to ink, so line 1 (which carries the descender of "designer") is 209px tall
     while line 3 is 112px. Stacking those with a uniform gap would give the paragraph a
     visibly uneven leading. Absolute-positioning them at her own offsets keeps her own
     leading, and leaves the CSS free to restagger only the horizontal.
     `lead` is likewise her own indent — the editorial stagger is added ON TOP of it rather
     than flattening every line to a hard left margin. */
  manifest.lines.push({
    file: `assets/hero/${name}`, w, h,
    lead: +(x0 / W).toFixed(4),
    span: +(w / W).toFixed(4),
    top: +(y0 / H).toFixed(4),
    vh: +(h / H).toFixed(4),
    blobs: group.length,
  });
  console.log(`  ${name}  ${w}x${h}  lead ${(x0 / W * 100).toFixed(1)}%  span ${(w / W * 100).toFixed(1)}%` +
    `  top ${(y0 / H * 100).toFixed(1)}%  (${group.length} marks)`);
});

fs.writeFileSync(path.join(HERO, 'hero-lines.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`sliced ${path.basename(SRC)} ${W}x${H} into ${manifest.lines.length} lines` +
  ` (${blobs.length} marks, ${dropped} specks dropped) → assets/hero/hero-lines.json`);
