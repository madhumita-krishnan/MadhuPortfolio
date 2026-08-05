#!/usr/bin/env node
/* Cleans up the hero handwriting mask and adds punctuation.
   Input : assets/hero/hero-line-handwritten.png   (raw ink lifted off the notebook photo)
   Output: assets/hero/hero-line-handwritten.png   (cleaned; the raw lift is kept as *-raw.png)

   Everything here is done on connected components rather than on rows, because the four
   written lines physically overlap — the descender of "design" reaches into "in order" —
   so a row-projection split would slice glyphs in half. Working per-component lets whole
   letters (descenders included) move as a unit.

   What it does, in order:
     1. drops dust specks (paper grain the lift mistook for ink)
     2. closes pinholes and smooths the threshold jaggies
     3. groups components into the 4 written lines, re-spaces them with even leading so
        descenders stop colliding with the line below, and flushes them to one left margin
     4. stamps a comma after "designer" and a full stop after "workflows" — both cloned
        from her own hand (the apostrophe of "I'm" and the i-dot of "designer") so the
        punctuation is hers and not a font's

   Re-run: node tools/clean-handwriting.js [--from raw]
*/
const fs = require('fs');
const path = require('path');
const { decode, encode } = require('./png');

const HERE = path.join(__dirname, '..', 'assets', 'hero');
const OUT = path.join(HERE, 'hero-line-handwritten.png');
const RAW = path.join(HERE, 'hero-line-handwritten-raw.png');

// keep a pristine copy of the lift the first time we run
if (!fs.existsSync(RAW)) fs.copyFileSync(OUT, RAW);
const src = decode(fs.readFileSync(RAW));

const W = src.width, H = src.height;
const A = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) A[i] = src.data[i * 4 + 3];

/* ---------------------------------------------------------------- 1. components */
const INK = 40;
function label(alpha, w, h) {
  const lab = new Int32Array(w * h).fill(-1), comps = [], stack = [];
  for (let i = 0; i < w * h; i++) {
    if (alpha[i] <= INK || lab[i] !== -1) continue;
    const c = { area: 0, x0: 1e9, y0: 1e9, x1: -1, y1: -1, px: [] };
    stack.push(i); lab[i] = comps.length;
    while (stack.length) {
      const q = stack.pop(), qx = q % w, qy = (q / w) | 0;
      c.area++; c.px.push(q);
      if (qx < c.x0) c.x0 = qx; if (qx > c.x1) c.x1 = qx;
      if (qy < c.y0) c.y0 = qy; if (qy > c.y1) c.y1 = qy;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = qx + dx, ny = qy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (alpha[n] > INK && lab[n] === -1) { lab[n] = comps.length; stack.push(n); }
      }
    }
    comps.push(c);
  }
  return comps;
}

/* Two specks in the lift are big enough to look deliberate but aren't letters — a pen
   touch beside the final "s" of "workflows". Listed by hand in raw pixel coords, because
   an area threshold big enough to catch them would also eat her i-dots (22-55px). */
const KILL = [[1630, 596, 1652, 615]];

let comps = label(A, W, H);
const DUST = 15;                       // her i-dots are ~22-55px; grain is 1-9px
const inside = (c, r) => c.x0 >= r[0] && c.y0 >= r[1] && c.x1 <= r[2] && c.y1 <= r[3];
const dust = comps.filter(c => c.area < DUST || KILL.some(r => inside(c, r)));
comps = comps.filter(c => !dust.includes(c));
console.log(`components ${comps.length + dust.length} → dropped ${dust.length} specks`);

/* ------------------------------------------------- 2. close pinholes + smooth edges */
// Work on a canvas that holds only the surviving components.
const clean = new Float32Array(W * H);
for (const c of comps) for (const p of c.px) clean[p] = A[p];
// carry the soft antialiased fringe of kept components across too
for (let i = 0; i < W * H; i++) if (A[i] > 0 && A[i] <= INK && clean[i] === 0) clean[i] = A[i];
for (const c of dust) for (const p of c.px) clean[p] = 0;

const box = (buf, r) => {                       // separable box blur
  const tmp = new Float32Array(W * H), out = new Float32Array(W * H), n = 2 * r + 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s = 0;
    for (let d = -r; d <= r; d++) s += buf[y * W + Math.min(W - 1, Math.max(0, x + d))];
    tmp[y * W + x] = s / n;
  }
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
    let s = 0;
    for (let d = -r; d <= r; d++) s += tmp[Math.min(H - 1, Math.max(0, y + d)) * W + x];
    out[y * W + x] = s / n;
  }
  return out;
};
// Blur then re-threshold with a soft ramp: grain and jagged edges average away and the
// stroke keeps its weight. On its own this severs hairline joins (the arm of the "k" in
// "workflows" came off), so the solid core of the original is unioned back in — the blur
// then only ever softens an edge, it can never delete ink.
const sm = box(clean, 2);
const smoothed = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) {
  const t = sm[i] / 255, v = (t - 0.30) / 0.24;   // ramp 0.30 → 0.54 coverage
  smoothed[i] = Math.max(Math.max(0, Math.min(1, v)) * 255, clean[i] >= 120 ? clean[i] : 0);
}

/* Her "h" has almost no ascender — 13px above the x-height — so "how design" reads as
   "now design" and the sentence changes meaning. This is the one letterform that gets
   edited: the stem of that single h is copied 32px further up, so it's still her stroke,
   just carried the height an h needs. Raw coords of the h in "how". */
const ASCENDER = { x0: 803, y0: 218, x1: 823, y1: 262, lift: 32 };
for (let y = ASCENDER.y1; y >= ASCENDER.y0; y--) {
  for (let x = ASCENDER.x0; x <= ASCENDER.x1; x++) {
    const v = smoothed[y * W + x], d = (y - ASCENDER.lift) * W + x;
    if (v > smoothed[d]) smoothed[d] = v;
  }
}

/* ------------------------------------------------------------ 3. lines + re-spacing */
comps = label(smoothed, W, H).filter(c => c.area >= DUST);
comps.forEach(c => { c.cx = (c.x0 + c.x1) / 2; });

// cluster on the component top edge — a descender hangs below its own line but its top
// still sits on it, so y0 is the stable signal.
const tops = comps.map(c => c.y0).sort((a, b) => a - b);
const cuts = [];
for (let i = 1; i < tops.length; i++) if (tops[i] - tops[i - 1] > 60) cuts.push((tops[i] + tops[i - 1]) / 2);
console.log('line cuts at y =', cuts.map(Math.round).join(', '));
const lineOf = c => cuts.filter(k => c.y0 > k).length;
const lines = [];
for (const c of comps) (lines[lineOf(c)] ||= []).push(c);
lines.forEach(l => l.sort((a, b) => a.x0 - b.x0));
console.log('lines:', lines.map(l => l.length + ' glyphs').join(' | '));

/* ---- punctuation, cloned from her own hand ---- */
const stamp = (srcComp, dx, dy, scale = 1) => {   // returns pixels to paint {i, v}
  const out = [];
  const w = srcComp.x1 - srcComp.x0 + 1, h = srcComp.y1 - srcComp.y0 + 1;
  const tw = Math.round(w * scale), th = Math.round(h * scale);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const sx = srcComp.x0 + Math.min(w - 1, x / scale), sy = srcComp.y0 + Math.min(h - 1, y / scale);
    // bilinear sample of the source component
    const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
    const at = (px, py) => (px < 0 || py < 0 || px >= W || py >= H ? 0 : smoothed[py * W + px]);
    const v = at(x0, y0) * (1 - fx) * (1 - fy) + at(x0 + 1, y0) * fx * (1 - fy)
            + at(x0, y0 + 1) * (1 - fx) * fy + at(x0 + 1, y0 + 1) * fx * fy;
    if (v > 4) out.push({ x: dx + x, y: dy + y, v });
  }
  return out;
};

const line1 = lines[0];
// "I'm" = everything on line 1 to the right of the widest inter-word gap near the end
let splitAt = 0;
for (let i = 1; i < line1.length; i++) {
  const gap = line1[i].x0 - line1[i - 1].x1;
  if (gap > 30 && line1[i].x0 > W * 0.55) { splitAt = i; break; }
}
const imGroup = line1.slice(splitAt);
const designerEnd = Math.max(...line1.slice(0, splitAt).map(c => c.x1));
// the apostrophe of I'm: the narrow, tall-ish mark sitting high in that group
const apo = imGroup.reduce((best, c) =>
  (c.y1 - c.y0) > 20 && (c.x1 - c.x0) < 26 && (!best || c.y0 < best.y0) ? c : best, null);
// the i-dot of "designer": smallest component on line 1
const dot = line1.reduce((best, c) => (!best || c.area < best.area ? c : best), null);
console.log(`"I'm" starts at glyph ${splitAt} (x=${imGroup[0].x0}); "designer" ends x=${designerEnd}`);
console.log(`apostrophe ${apo.x1 - apo.x0 + 1}x${apo.y1 - apo.y0 + 1} @${apo.x0},${apo.y0}; dot area ${dot.area}`);

const SHIFT = 34;                                  // room the comma needs
imGroup.forEach(c => { c.dx = SHIFT; });

// baseline of line 1 = the modal bottom edge of its non-descending glyphs
const baselineOf = l => {
  const bs = l.map(c => c.y1).sort((a, b) => a - b);
  return bs[Math.floor(bs.length * 0.55)];
};

const extras = [];   // {px:[{x,y,v}], line}
const commaX = designerEnd + 8;
const commaY = baselineOf(line1) - Math.round((apo.y1 - apo.y0) * 0.55);
extras.push({ line: 0, px: stamp(apo, commaX, commaY, 0.95) });

const lastLine = lines[lines.length - 1];
const endX = Math.max(...lastLine.map(c => c.x1));
const periodY = baselineOf(lastLine) - (dot.y1 - dot.y0);
extras.push({ line: lines.length - 1, px: stamp(dot, endX + 16, periodY, 1.25) });

/* ---- re-space the lines ---- */
const LEAD = 186;                 // was ~160 — the extra 26px is what stops the descenders
const PAD_L = 24, PAD_T = 18, PAD_B = 26, PAD_R = 30;
const lineTop = l => Math.min(...l.map(c => c.y0));
const lineLeft = l => Math.min(...l.map(c => c.x0));

const dst = new Float32Array(W * (H + 260));
const DH = H + 260;
let maxY = 0, maxX = 0;
lines.forEach((l, i) => {
  const oy = PAD_T + i * LEAD - lineTop(l);
  const ox = PAD_L - lineLeft(l);
  const put = (x, y, v) => {
    if (x < 0 || y < 0 || x >= W || y >= DH) return;
    const j = y * W + x;
    if (v > dst[j]) dst[j] = v;
    if (y > maxY) maxY = y;
    if (x > maxX) maxX = x;
  };
  for (const c of l) {
    const dx = ox + (c.dx || 0);
    for (const p of c.px) put((p % W) + dx, ((p / W) | 0) + oy, smoothed[p]);
    // carry the soft fringe around each component
    for (const p of c.px) {
      const px = p % W, py = (p / W) | 0;
      for (let ddy = -2; ddy <= 2; ddy++) for (let ddx = -2; ddx <= 2; ddx++) {
        const q = (py + ddy) * W + px + ddx;
        if (q >= 0 && q < W * H && smoothed[q] > 0 && smoothed[q] <= INK)
          put(px + ddx + dx, py + ddy + oy, smoothed[q]);
      }
    }
  }
  for (const e of extras) if (e.line === i) for (const p of e.px) put(p.x + ox, p.y + oy, p.v);
});

/* ---------------------------------------------------------------- 4. crop + write */
const NW = Math.min(W, maxX + PAD_R), NH = maxY + PAD_B;
const out = { width: NW, height: NH, data: Buffer.alloc(NW * NH * 4) };
for (let y = 0; y < NH; y++) for (let x = 0; x < NW; x++) {
  const d = (y * NW + x) * 4;
  out.data[d] = out.data[d + 1] = out.data[d + 2] = 0;
  out.data[d + 3] = Math.round(Math.max(0, Math.min(255, dst[y * W + x])));
}
fs.writeFileSync(OUT, encode(out));
console.log(`wrote ${path.relative(process.cwd(), OUT)} — ${NW}x${NH} (was ${W}x${H})`);
console.log(`CSS aspect-ratio: ${NW}/${NH}`);
