/* Lift Madhu's pencil portrait of her dog off its paper, drop the cast shadow, and cut the
   head onto its own layer so it can bark.

   DIFFERENT FROM tools/lift-pot.js, and the difference matters. The pot is pure line: every
   mark is either ink or paper, so it survives being reduced to a hard-edged silhouette. This
   is CONTINUOUS-TONE GRAPHITE — the fur is rendered in values from the faintest grey up to
   near-black, and flattening that to one alpha level would turn a portrait into a blob. So
   alpha here is proportional to how dark the pencil is, which keeps the full tonal range and
   lets the CSS paint it as a monochrome drawing in a palette ink.

   Three problems the photo brings, in order:

   1. THE CAST SHADOW. She drew the dog lit from the left, so there is a soft graphite shadow
      falling to its right — and she asked for it gone, because the pot standing next to it is
      drawn dead-on with no shadow at all, and one lit object beside one unlit object reads as
      a mistake. The shadow cannot go by threshold: it sits at roughly 222-232 luminance,
      which is the same range as the dog's own lightest fur. What separates them is that the
      shadow is OUTSIDE the animal. So this finds the dog's solid strokes, grows them into a
      region, and keeps tone only inside it. The shadow is stranded outside and drops.

   2. UNEVEN LIGHTING, as with the pot — same local paper estimation.

   3. THE HEAD HAS TO MOVE ON ITS OWN. Written out a second time as dog-head.png, on the same
      canvas so the two stack pixel-for-pixel, with a feathered lower edge. The head is
      SUBTRACTED from the body layer, and not by a naive (1 - w) — see the split at the end,
      which solves the compositing equation so the two layers add back to exactly her drawing.

   Run:  node tools/lift-dog.js [path/to/photo]
   Out:  assets/about/dog.png       — the whole portrait
         assets/about/dog-head.png  — head only, feathered at the neck, same canvas
         assets/about/dog-tag.png   — the one coloured thing in the drawing, her Michigan tag
*/
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { decode, encode } = require('./png.js');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'about');
const MAX_EDGE = 1000;
const args = process.argv.slice(2);

const CANDIDATES = [
  args.find(a => !a.startsWith('--')),
  path.join(ROOT, 'about-src', 'dog.png'),
  path.join(ROOT, '..', 'dog.JPG'),
  path.join(ROOT, '..', 'dog.jpg'),
].filter(Boolean);
const SRC = CANDIDATES.find(p => { try { return fs.statSync(p).isFile(); } catch { return false; } });
if (!SRC) { console.error('lift-dog: no source found:\n' + CANDIDATES.map(p => '  ' + p).join('\n')); process.exit(1); }

let readPath = SRC, tmp = null;
if (!/\.png$/i.test(SRC)) {
  tmp = path.join(os.tmpdir(), `lift-dog-${process.pid}.png`);
  try { execFileSync('sips', ['-s', 'format', 'png', SRC, '--out', tmp], { stdio: 'ignore' }); readPath = tmp; }
  catch { console.error("lift-dog: not a PNG and 'sips' could not convert it."); process.exit(1); }
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const img = decode(fs.readFileSync(readPath));
if (tmp) fs.unlinkSync(tmp);
const { width: W, height: H, data } = img;
const lum = new Float32Array(W * H);
const sat = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) {
  const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
  lum[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  sat[i] = mx === 0 ? 0 : (mx - mn) / mx;
}

/* ---- local paper level (see lift-pot.js) ---------------------------------------------- */
const GX = 24, GY = 28;
const cell = new Float32Array(GX * GY);
for (let gy = 0; gy < GY; gy++) for (let gx = 0; gx < GX; gx++) {
  const x0 = (gx * W / GX) | 0, x1 = ((gx + 1) * W / GX) | 0;
  const y0 = (gy * H / GY) | 0, y1 = ((gy + 1) * H / GY) | 0;
  const v = [];
  for (let y = y0; y < y1; y += 3) for (let x = x0; x < x1; x += 3) v.push(lum[y * W + x]);
  v.sort((a, b) => a - b);
  cell[gy * GX + gx] = v[(v.length * 0.9) | 0];
}
function paperAt(x, y) {
  const fx = clamp(x * GX / W - 0.5, 0, GX - 1), fy = clamp(y * GY / H - 0.5, 0, GY - 1);
  const x0 = fx | 0, y0 = fy | 0, x1 = Math.min(x0 + 1, GX - 1), y1 = Math.min(y0 + 1, GY - 1);
  const tx = fx - x0, ty = fy - y0;
  const a = cell[y0 * GX + x0] * (1 - tx) + cell[y0 * GX + x1] * tx;
  const b = cell[y1 * GX + x0] * (1 - tx) + cell[y1 * GX + x1] * tx;
  return a * (1 - ty) + b * ty;
}

/* ---- tonal alpha ----------------------------------------------------------------------
   Straight proportional-to-darkness, with a small dead zone at the top so paper grain does
   not fog the whole sheet. FLOOR is where the graphite is counted as fully opaque; leaving it
   above 0 means her darkest darks reach solid ink instead of stopping at 80% grey. */
const DEAD = 0.965, FLOOR = 0.40;
const tone = new Float32Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x, p = paperAt(x, y);
  tone[i] = clamp((p * DEAD - lum[i]) / (p * DEAD - p * FLOOR), 0, 1);
}

/* ---- the dog region -------------------------------------------------------------------
   CORE is "definitely a pencil stroke". The cast shadow never reaches it — measured, the
   shadow tops out around 0.10 of full tone while the dog's real strokes run 0.3 to 1.0. */
const CORE = 0.34;
const core = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) core[i] = tone[i] >= CORE ? 1 : 0;

/* GROW FIRST, THEN CLUSTER — the order matters and getting it backwards fails outright.
   Taking the largest connected component of the raw core finds only the muzzle: this is fur
   drawn as thousands of separate short pencil strokes, so the core comes out as ~1300
   disconnected fragments and the biggest is a few percent of the animal. Dilating first
   merges the strokes that belong to the same coat, and only then does "largest component"
   mean the dog.

   RADIUS has to bridge the gaps between fur strokes and catch the wispy edge of the coat,
   while staying under the ~90px of clear paper between the body and the cast shadow. */
const RADIUS = Math.round(W * 0.022);
const dist = new Float32Array(W * H).fill(1e9);
for (let i = 0; i < W * H; i++) if (core[i]) dist[i] = 0;
const relax = (i, j, d) => { if (dist[j] + d < dist[i]) dist[i] = dist[j] + d; };
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x;
  if (x > 0) relax(i, i - 1, 1);
  if (y > 0) relax(i, i - W, 1);
  if (x > 0 && y > 0) relax(i, i - W - 1, 1.414);
  if (x < W - 1 && y > 0) relax(i, i - W + 1, 1.414);
}
for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
  const i = y * W + x;
  if (x < W - 1) relax(i, i + 1, 1);
  if (y < H - 1) relax(i, i + W, 1);
  if (x < W - 1 && y < H - 1) relax(i, i + W + 1, 1.414);
  if (x > 0 && y < H - 1) relax(i, i + W - 1, 1.414);
}
/* now the merged blobs — the largest is the animal. The leash hangs off the collar and comes
   with it; her initials in the bottom corner sit ~100px clear of the nearest paw, never
   merge, and are dropped with the shadow. */
const grown = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) grown[i] = dist[i] <= RADIUS ? 1 : 0;
const lab = new Int32Array(W * H).fill(-1);
const stack = new Int32Array(W * H);
const areas = [];
for (let s = 0; s < W * H; s++) {
  if (lab[s] >= 0 || !grown[s]) continue;
  const id = areas.length; let sp = 0, n = 0;
  stack[sp++] = s; lab[s] = id;
  while (sp) {
    const p = stack[--sp]; n++;
    const x = p % W, y = (p / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const q = ny * W + nx;
      if (lab[q] < 0 && grown[q]) { lab[q] = id; stack[sp++] = q; }
    }
  }
  areas.push(n);
}
let main = 0;
for (let i = 1; i < areas.length; i++) if (areas[i] > areas[main]) main = i;

/* soft edge on the region so the coat fades out rather than ending on a cut line. Distance is
   re-measured from the KEPT component only, so a discarded blob nearby cannot feather back in. */
const FEATHER = RADIUS * 0.55;
const d2 = new Float32Array(W * H).fill(1e9);
for (let i = 0; i < W * H; i++) if (lab[i] === main) d2[i] = 0;
const relax2 = (i, j, d) => { if (d2[j] + d < d2[i]) d2[i] = d2[j] + d; };
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x;
  if (x > 0) relax2(i, i - 1, 1);
  if (y > 0) relax2(i, i - W, 1);
  if (x > 0 && y > 0) relax2(i, i - W - 1, 1.414);
  if (x < W - 1 && y > 0) relax2(i, i - W + 1, 1.414);
}
for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
  const i = y * W + x;
  if (x < W - 1) relax2(i, i + 1, 1);
  if (y < H - 1) relax2(i, i + W, 1);
  if (x < W - 1 && y < H - 1) relax2(i, i + W + 1, 1.414);
  if (x > 0 && y < H - 1) relax2(i, i + W - 1, 1.414);
}
const region = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) {
  region[i] = d2[i] <= 0 ? 1 : d2[i] >= FEATHER ? 0 : 1 - d2[i] / FEATHER;
}

let shadowKilled = 0;
for (let i = 0; i < W * H; i++) {
  if (tone[i] > 0 && region[i] < 1) shadowKilled += tone[i] * (1 - region[i]);
  tone[i] *= region[i];
}

/* ---- print the mid-tones back in ------------------------------------------------------
   Everything above is measurement: how dark is the graphite here, on paper this bright. What
   comes out of it is a photographic negative of a pencil drawing, and a photographic negative
   is not what a drawing looks like when it is PRINTED — she asked why the dog was "weirdly
   faded in places", and the places are exactly the ones she shaded lightly.

   Two things gang up. Her fur is drawn light and open over most of the animal and worked dark
   only at the muzzle, the collar and the lead, so proportional alpha puts three quarters of
   the drawing under 0.35. And the page is cream while the ink is a mid-blue, so there is less
   than half the contrast to spend that a pencil has against white paper — at 0.2 alpha a
   stroke is a rumour. The result reads as a hole in the drawing rather than as light fur,
   which is the one thing shading must never do.

   The curve pulls the mid-tones up and leaves both ends alone: paper is still paper, her
   darkest darks are still solid, and the ORDER of every tone in between is preserved, so it
   is still her drawing and still lit from the left. 0.55 was picked by looking at it on the
   page at the size it is actually used, which is the only place this can be judged.

   It goes here, after the shadow has been stranded and before the head is cut off the body:
   the shadow is separated by tone and would come back up with everything else, and the two
   layers below solve a compositing equation against whatever `tone` says at that point. */
const TONE_GAMMA = 0.55;
for (let i = 0; i < W * H; i++) if (tone[i] > 0) tone[i] = Math.pow(tone[i], TONE_GAMMA);

/* ---- trim ------------------------------------------------------------------------------ */
let x0 = W, y0 = H, x1 = -1, y1 = -1;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (tone[y * W + x] > 0.02) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
}
const cw = x1 - x0 + 1, ch = y1 - y0 + 1;

/* ---- head layer -----------------------------------------------------------------------
   The cut sits just under the jaw, at the collar. Feathered over a deep band rather than cut
   on a line: the head layer is composited OVER the untouched body, so where the two overlap
   they simply add up to the same drawing — but a hard edge would still show as a step in
   density the moment the head rotates. Across a 9%-of-height ramp the transition is invisible
   at any rotation the bark actually uses. */
const HEAD_CUT = 0.455;   // fraction of the trimmed height — measured to the collar
const HEAD_FADE = 0.09;
function headWeight(yFrac) {
  if (yFrac <= HEAD_CUT - HEAD_FADE) return 1;
  if (yFrac >= HEAD_CUT) return 0;
  const t = (HEAD_CUT - yFrac) / HEAD_FADE;
  return t * t * (3 - 2 * t);   // smoothstep
}

/* ---- jaw layer ------------------------------------------------------------------------
   A bark is not a head movement, it is a MOUTH movement that the head goes along with, so
   the lower jaw has to come off the head the same way the head came off the body.

   She drew him with his mouth already open, which is the whole reason this is possible: the
   dark interior, the tongue and the lower lip are all on the page, and opening the jaw a few
   more degrees reads as a bark rather than as a face being deformed. There is no line in the
   drawing where the jaw ends and the cheek begins — it is all fur — so the cut cannot be a
   traced outline. It is three soft conditions multiplied together, all measured off the lift
   (tools/preview-mask.js, and the red-wash preview it prints):

     below the lip     the mouth line runs from the hinge up-left under the nose at a slope
                       of about 0.10; everything under it is jaw, ramped in over 2.4% of the
                       height so the upper lip stays with the skull
     near the hinge    an ellipse around the pivot, squashed to 62% vertically because a jaw
                       is wide and shallow — this is what keeps the chest ruff out of it
     not behind it     faded off just past the hinge, since the jaw only extends forward

   PIVOT is the corner of his mouth, and it is duplicated as transform-origin in build.js —
   if it moves here it has to move there, or the jaw will swing around the wrong point. */
const PIVOT_X = 0.355, PIVOT_Y = 0.322;   // fractions of the trimmed box (x of w, y of h)
const LIP_SLOPE = 0.10, LIP_FADE = 0.024;
const JAW_R0 = 0.115, JAW_R1 = 0.175, JAW_VSQUASH = 0.62;
const JAW_BACK = 0.045;
const AR = cw / ch;
const smoothstep = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/* everything in units of the trimmed HEIGHT, so the shapes above are actual geometry and
   not stretched by the box being twice as tall as it is wide */
const Xp = PIVOT_X * AR, Yp = PIVOT_Y;
function jawWeight(xFrac, yFrac) {
  const X = xFrac * AR, Y = yFrac;
  const below = (Y - (Yp + LIP_SLOPE * (X - Xp))) / Math.hypot(1, LIP_SLOPE);
  const r = Math.hypot(X - Xp, (Y - Yp) / JAW_VSQUASH);
  return smoothstep(below / LIP_FADE)
    * (1 - smoothstep((r - JAW_R0) / (JAW_R1 - JAW_R0)))
    * (1 - smoothstep((X - Xp) / JAW_BACK));
}

/* ---- write ----------------------------------------------------------------------------
   Area-average down; alpha only, since these are masks. */
function emit(pick) {
  const k = MAX_EDGE / Math.max(cw, ch);
  const nw = Math.max(1, Math.round(cw * k)), nh = Math.max(1, Math.round(ch * k));
  const acc = new Float64Array(nw * nh), cnt = new Float64Array(nw * nh);
  for (let y = 0; y < ch; y++) {
    const dy = Math.min(nh - 1, (y * nh / ch) | 0);
    for (let x = 0; x < cw; x++) {
      const dx = Math.min(nw - 1, (x * nw / cw) | 0);
      acc[dy * nw + dx] += pick(x0 + x, y0 + y, y / ch, x / cw);
      cnt[dy * nw + dx]++;
    }
  }
  const buf = Buffer.alloc(nw * nh * 4);
  for (let i = 0; i < nw * nh; i++) buf[i * 4 + 3] = Math.round(clamp(acc[i] / (cnt[i] || 1), 0, 1) * 255);
  return { width: nw, height: nh, data: buf };
}

/* THE SPLIT HAS TO BE COMPLEMENTARY, AND NOT NAIVELY SO.

   Writing the body layer as the whole drawing and laying the head on top of it looks right
   until the head moves: then you see the rotated head AND the original head still sitting
   underneath it, and the face smears. So the head has to be REMOVED from the body layer.

   But subtracting it as (1 - w) leaves a pale seam, because two half-transparent layers of the
   same ink do not add — compositing alpha h over alpha b gives h + b(1-h), not h + b. At the
   middle of the feather band a 50/50 split of solid graphite composites back to 0.75, not 1.

   Solving that equation for the body instead, b = (T - h) / (1 - h), makes the two layers
   composite back to exactly the original tone T everywhere, so at rest the drawing is
   pixel-identical to the one she made — and the head still lifts cleanly off it.

   The jaw comes off the head by the same equation one level down: jaw over head-minus-jaw
   composites back to the whole head, which composites over the body back to her drawing. So
   adding a third layer changes nothing at rest — dog.png is byte-for-byte what it was. */
fs.mkdirSync(OUT_DIR, { recursive: true });
const split = (t, top) => (top >= 0.999 ? 0 : clamp((t - top) / (1 - top), 0, 1));
const headAt = (x, y, f) => tone[y * W + x] * headWeight(f);          // head incl. jaw
const jawAt = (x, y, f, g) => headAt(x, y, f) * jawWeight(g, f);
const skullAt = (x, y, f, g) => split(headAt(x, y, f), jawAt(x, y, f, g));
const bodyAt = (x, y, f) => split(tone[y * W + x], headAt(x, y, f));
const whole = emit(bodyAt);
const head = emit(skullAt);
const jaw = emit(jawAt);
/* The Michigan tag is the only colour on the sheet. Kept as its own mask so it can be painted
   in --sun instead of being flattened into the graphite with everything else. */
const tag = emit((x, y) => (sat[y * W + x] > 0.3 && lum[y * W + x] > 90 ? 1 : 0));
fs.writeFileSync(path.join(OUT_DIR, 'dog.png'), encode(whole));
fs.writeFileSync(path.join(OUT_DIR, 'dog-head.png'), encode(head));
fs.writeFileSync(path.join(OUT_DIR, 'dog-jaw.png'), encode(jaw));
fs.writeFileSync(path.join(OUT_DIR, 'dog-tag.png'), encode(tag));

const kb = f => (fs.statSync(path.join(OUT_DIR, f)).size / 1024).toFixed(0) + 'kb';
console.log(`source ${path.basename(SRC)}  ${W}x${H}`);
console.log(`  paper ${Math.min(...cell).toFixed(0)}..${Math.max(...cell).toFixed(0)}; merged blobs ${areas.length}, animal = ${areas[main]}px`);
console.log(`  region radius ${RADIUS}px (+${FEATHER.toFixed(0)} feather); removed ${(shadowKilled / 1000).toFixed(0)}k tone-units outside it (the cast shadow)`);
console.log(`  trimmed ${cw}x${ch} → ${whole.width}x${whole.height}`);
console.log(`  jaw pivot ${(PIVOT_X * 100).toFixed(1)}% ${(PIVOT_Y * 100).toFixed(1)}% — must match transform-origin of .dog-l.jaw in build.js`);
console.log(`  dog.png ${kb('dog.png')} · dog-head.png ${kb('dog-head.png')} · dog-jaw.png ${kb('dog-jaw.png')} · dog-tag.png ${kb('dog-tag.png')}`);
