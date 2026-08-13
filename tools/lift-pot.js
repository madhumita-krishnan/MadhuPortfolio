/* Lift Madhu's ink drawing of the pot off its paper and turn it into an alpha mask.

   Same move as tools/clean-handwriting.js and tools/clean-logos.js, and for the same reason:
   the drawing arrives as dark ink on paper, and the page it has to sit on is cream (#F5EAD3).
   Shipping the photo as-is would put a grey rectangle in the middle of the page. Rebuilding
   the ALPHA from how much darker each pixel is than the paper gives a cut-out that composites
   onto anything, and lets the CSS paint the pot in a palette ink rather than in whatever grey
   the camera happened to record.

   The source is a PHONE PHOTO of a sketchbook, not a scan, and that drives every decision:

   1. THE PAPER IS NOT ONE COLOUR. It is lit from one side, so the sheet runs from about 205
      down to 150 across the frame, and the corner is darker than some of the ink elsewhere.
      A single global threshold either eats the light hatching or turns the dark corner solid.
      So the paper level is estimated LOCALLY — a coarse grid of high-percentile samples,
      bilinearly interpolated back up — and each pixel is measured against the paper next to
      it. This is flat-field correction, and it is the difference between a clean lift and a
      grey smear down one edge.

   2. THE DRAWING IS MOSTLY FINE HATCHING. The alpha ramp has to stay soft or the thin strokes
      alias into dashes. It ramps over a window instead of cutting at a threshold.

   3. THE PHOTO IS SIDEWAYS. She shot the page in landscape with the pot lying on its side.
      Handled below — see ROTATE.

   4. IT IS 12 MEGAPIXELS AND DISPLAYS AT ~150px. Downsampled by area-averaging at the end,
      which is both the correct filter for minification and what keeps the hatching from
      breaking into moire.

   Run:  node tools/lift-pot.js [path/to/scan] [--rotate=0|90|180|270]
   Out:  assets/about/pot.png  — greyscale+alpha, trimmed to the drawing
*/
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { decode, encode } = require('./png.js');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'about');
const OUT = path.join(OUT_DIR, 'pot.png');
const MAX_EDGE = 900;   // plenty for a ~150px element on a 2x screen
const args = process.argv.slice(2);
const rotArg = args.find(a => a.startsWith('--rotate='));
const explicitRot = rotArg ? Number(rotArg.split('=')[1]) : null;

const CANDIDATES = [
  args.find(a => !a.startsWith('--')),
  path.join(ROOT, 'about-src', 'pot.png'),
  path.join(ROOT, 'about-src', 'pot.jpg'),
  path.join(ROOT, '..', 'Pot.JPG'),
  path.join(ROOT, '..', 'pot.png'),
  path.join(ROOT, '..', 'pot.jpg'),
].filter(Boolean);

const SRC = CANDIDATES.find(p => { try { return fs.statSync(p).isFile(); } catch { return false; } });
if (!SRC) {
  console.error('lift-pot: no source found. Looked for:\n' + CANDIDATES.map(p => '  ' + p).join('\n'));
  process.exit(1);
}

/* tools/png.js is a PNG codec and nothing more — deliberately, so the repo stays
   dependency-free. macOS ships sips, so a JPEG straight off her phone is transcoded here
   rather than being handed back to her as a manual step. */
let readPath = SRC;
let tmp = null;
if (!/\.png$/i.test(SRC)) {
  tmp = path.join(os.tmpdir(), `lift-pot-${process.pid}.png`);
  try {
    execFileSync('sips', ['-s', 'format', 'png', SRC, '--out', tmp], { stdio: 'ignore' });
    readPath = tmp;
  } catch {
    console.error(`lift-pot: ${path.basename(SRC)} is not a PNG and 'sips' could not convert it.`);
    console.error("Re-save the photo as PNG (Preview: File > Export, Format: PNG) and run again.");
    process.exit(1);
  }
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const img = decode(fs.readFileSync(readPath));
if (tmp) fs.unlinkSync(tmp);
const { width: W, height: H, data } = img;
/* Perceptual luminance — the ink is neutral but the paper carries a warm cast, and a plain
   channel average would read that cast as darker than it looks. */
const lum = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) {
  lum[i] = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
}

/* ---- 1. local paper level -------------------------------------------------------------
   Grid of cells; in each, the 88th percentile of luminance. High percentile, because within
   any one cell the paper is the bright majority and the ink is the dark minority — the mean
   would be dragged down everywhere the drawing is dense, which is exactly where it matters. */
const GX = 24, GY = 18;
const cell = new Float32Array(GX * GY);
for (let gy = 0; gy < GY; gy++) {
  for (let gx = 0; gx < GX; gx++) {
    const x0 = Math.floor(gx * W / GX), x1 = Math.floor((gx + 1) * W / GX);
    const y0 = Math.floor(gy * H / GY), y1 = Math.floor((gy + 1) * H / GY);
    const vals = [];
    for (let y = y0; y < y1; y += 3) for (let x = x0; x < x1; x += 3) vals.push(lum[y * W + x]);
    vals.sort((a, b) => a - b);
    cell[gy * GX + gx] = vals[Math.floor(vals.length * 0.88)];
  }
}
/* Bilinear lookup of that grid — a nearest-cell lookup would band the background into
   visible rectangles right where the alpha ramp is most sensitive. */
function paperAt(x, y) {
  const fx = clamp(x * GX / W - 0.5, 0, GX - 1), fy = clamp(y * GY / H - 0.5, 0, GY - 1);
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, GX - 1), y1 = Math.min(y0 + 1, GY - 1);
  const tx = fx - x0, ty = fy - y0;
  const a = cell[y0 * GX + x0] * (1 - tx) + cell[y0 * GX + x1] * tx;
  const b = cell[y1 * GX + x0] * (1 - tx) + cell[y1 * GX + x1] * tx;
  return a * (1 - ty) + b * ty;
}

/* How far below its local paper a pixel must fall to count. Fractions of the local paper
   level, not absolute values, so the same numbers hold in the bright and dim parts of the
   sheet. LO is where it is fully ink; HI is where it is still paper. */
const HI = 0.86, LO = 0.52;
const out = Buffer.alloc(W * H * 4);
let inkPx = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const p = paperAt(x, y);
    const a = clamp((p * HI - lum[i]) / (p * HI - p * LO), 0, 1);
    if (a <= 0) continue;
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = 0; // colour is irrelevant: this is a mask
    out[i * 4 + 3] = Math.round(a * 255);
    if (a > 0.5) inkPx++;
  }
}

/* ---- 2. keep only the drawing ----------------------------------------------------------
   A photographed page also catches the edge of the sheet and the table beyond it, plus dust.
   Filtering those by AREA does not work: the junk along the frame edge comes to ~480px,
   which is bigger than plenty of real marks — the dots around the pot's shoulder, the short
   ticks on the rim — so any threshold that removes the junk also removes parts of the pot.

   What actually separates them is WHERE they are. The drawing is one spatially coherent
   cluster in the middle of the sheet; the junk is stranded out on the border, about 1200px
   from the nearest real ink. So this grows a cluster outward from the largest blob, taking
   in anything that comes within GAP of what it has collected so far, and discards the rest.
   The rim abuts the body and every dot sits on the pot, so they all join in the first pass;
   nothing on the frame edge ever gets close enough. */
function blobs(buf, w, h, thresh) {
  const lab = new Int32Array(w * h).fill(-1);
  const stack = new Int32Array(w * h);
  const areas = [], boxes = [];
  for (let s = 0; s < w * h; s++) {
    if (lab[s] >= 0 || buf[s * 4 + 3] < thresh) continue;
    const id = areas.length;
    let sp = 0, n = 0, bx0 = w, by0 = h, bx1 = -1, by1 = -1;
    stack[sp++] = s; lab[s] = id;
    while (sp) {
      const p = stack[--sp]; n++;
      const x = p % w, y = (p / w) | 0;
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
      if (y < by0) by0 = y; if (y > by1) by1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (lab[q] < 0 && buf[q * 4 + 3] >= thresh) { lab[q] = id; stack[sp++] = q; }
      }
    }
    areas.push(n); boxes.push([bx0, by0, bx1, by1]);
  }
  return { lab, areas, boxes };
}
const { lab, areas, boxes } = blobs(out, W, H, 80);
const GAP = Math.round(Math.max(W, H) * 0.03); // ~120px on a 12MP frame
let seed = 0;
for (let i = 1; i < areas.length; i++) if (areas[i] > areas[seed]) seed = i;
const inCluster = new Uint8Array(areas.length);
inCluster[seed] = 1;
let [cx0, cy0, cx1, cy1] = boxes[seed];
for (let grew = 1; grew;) {
  grew = 0;
  for (let i = 0; i < areas.length; i++) {
    if (inCluster[i]) continue;
    const [a, b, c, d] = boxes[i];
    if (a <= cx1 + GAP && c >= cx0 - GAP && b <= cy1 + GAP && d >= cy0 - GAP) {
      inCluster[i] = 1; grew = 1;
      if (a < cx0) cx0 = a; if (c > cx1) cx1 = c;
      if (b < cy0) cy0 = b; if (d > cy1) cy1 = d;
    }
  }
}
let dropped = 0, keptBlobs = 0;
for (let i = 0; i < areas.length; i++) if (inCluster[i]) keptBlobs++;
for (let i = 0; i < W * H; i++) {
  if (lab[i] < 0) { if (out[i * 4 + 3]) out[i * 4 + 3] = 0; continue; }
  if (!inCluster[lab[i]]) { out[i * 4 + 3] = 0; dropped++; }
}

/* ---- 3. trim to the art --------------------------------------------------------------- */
let x0 = W, y0 = H, x1 = -1, y1 = -1;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (out[(y * W + x) * 4 + 3] > 10) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
}
if (x1 < 0) { console.error('lift-pot: found no ink.'); process.exit(1); }
let cw = x1 - x0 + 1, ch = y1 - y0 + 1;
let cur = Buffer.alloc(cw * ch * 4);
for (let y = 0; y < ch; y++) {
  out.copy(cur, y * cw * 4, ((y + y0) * W + x0) * 4, ((y + y0) * W + x1 + 1) * 4);
}

/* ---- 4. stand it up -------------------------------------------------------------------
   She photographed the sketchbook in landscape with the pot lying on its side, rim pointing
   left. Upright, this pot is wider than it is tall (a squat round body under a flared rim),
   so art that comes out TALLER than wide is lying down and gets turned a quarter turn
   clockwise to put the rim back at the top. --rotate= overrides if a future photo is
   already upright, or is lying the other way. */
const ROTATE = explicitRot != null ? ((explicitRot % 360) + 360) % 360 : (ch > cw ? 90 : 0);
function rotate(buf, w, h, deg) {
  if (!deg) return { buf, w, h };
  const quarter = deg / 90 | 0;
  let b = buf, bw = w, bh = h;
  for (let q = 0; q < quarter; q++) {
    const nb = Buffer.alloc(bw * bh * 4);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      // clockwise: (x,y) -> (bh-1-y, x) in a bh x bw image
      const s = (y * bw + x) * 4, d = (x * bh + (bh - 1 - y)) * 4;
      nb[d] = b[s]; nb[d + 1] = b[s + 1]; nb[d + 2] = b[s + 2]; nb[d + 3] = b[s + 3];
    }
    b = nb; const t = bw; bw = bh; bh = t;
  }
  return { buf: b, w: bw, h: bh };
}
({ buf: cur, w: cw, h: ch } = rotate(cur, cw, ch, ROTATE));

/* ---- 5. down to display size ----------------------------------------------------------
   Area-averaging, which is the correct filter for minification: every source pixel
   contributes to exactly one destination pixel, weighted by overlap. Point-sampling 12MP of
   fine parallel hatching down to 900px would alias it into moire bands. */
function downscale(buf, w, h, maxEdge) {
  const k = maxEdge / Math.max(w, h);
  if (k >= 1) return { buf, w, h };
  const nw = Math.max(1, Math.round(w * k)), nh = Math.max(1, Math.round(h * k));
  const acc = new Float64Array(nw * nh), cnt = new Float64Array(nw * nh);
  for (let y = 0; y < h; y++) {
    const dy = Math.min(nh - 1, (y * nh / h) | 0);
    for (let x = 0; x < w; x++) {
      const dx = Math.min(nw - 1, (x * nw / w) | 0);
      acc[dy * nw + dx] += buf[(y * w + x) * 4 + 3];
      cnt[dy * nw + dx]++;
    }
  }
  const nb = Buffer.alloc(nw * nh * 4);
  for (let i = 0; i < nw * nh; i++) nb[i * 4 + 3] = Math.round(acc[i] / (cnt[i] || 1));
  return { buf: nb, w: nw, h: nh };
}
const small = downscale(cur, cw, ch, MAX_EDGE);

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, encode({ width: small.w, height: small.h, data: small.buf }));
console.log(`source ${path.basename(SRC)}  ${W}x${H}`);
console.log(`  local paper level ${Math.min(...cell).toFixed(0)}..${Math.max(...cell).toFixed(0)} across the sheet`);
console.log(`  ${inkPx} ink px; kept ${keptBlobs} marks as the drawing, dropped ${dropped} px of frame edge and dust`);
console.log(`  trimmed to ${x1 - x0 + 1}x${y1 - y0 + 1}, rotated ${ROTATE}°, scaled to ${small.w}x${small.h}`);
console.log(`  → assets/about/pot.png  ${(fs.statSync(OUT).size / 1024).toFixed(0)}kb`);
