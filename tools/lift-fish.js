/* Lift ONE painted koi off the grey plate in fish.jpg and turn it into a swimming sprite.

   The source is her acrylic painting: two koi on a blue-grey plate. The about-section
   animation (fish.js) needs a single fish as an RGBA cut-out, lying HORIZONTAL with the
   head pointing RIGHT — that orientation is load-bearing, because the swim shader in
   fish.js runs its tail-wave along the sprite's x axis and points the +x edge down the
   path tangent. Bake the orientation here once, and the runtime math stays two lines.

   Unlike the pot and the handwriting, this is NOT an alpha-from-darkness lift — the fish
   is a full-colour painting and ships as one. What separates fish from plate is WARMTH:
   the plate is a cool grey (blue channel above red), the fish is orange through warm
   white (red above blue, by a lot). One channel difference, r - b, is the whole key.

   Steps, and why each exists:
   1. warmth mask (r - b > threshold) — the plate sits ~-15, the fish +30..+120, so the
      two populations barely touch. The soft painted edge lands between and gets ramped.
   2. connected components — there are TWO fish; keep the one whose centroid is on the
      requested side (--fish=left|right, default left: the arched one, which reads as
      mid-leap once horizontal).
   3. hole fill — the white belly highlights dip near the threshold and can pinhole.
   4. PCA on the kept pixels → the body's major axis → rotate the whole image so that
      axis is horizontal. A painted koi is banana-shaped, so PCA is approximate; the
      --rotate=<deg> flag adds a manual trim after inspection.
   5. --flip-x mirrors AFTER rotation if the head came out pointing left.
   5b. STRAIGHTEN the spine. The painting caught the fish mid-stroke — tail swept to one
      side — and fish.js animates the swim itself as a traveling wave down the body, so
      the baked pose must be the NEUTRAL one or the shader's wave rides on top of a
      permanent bend and the tail reads as a stiff hinged flap. The spine is recovered
      as the per-column alpha centroid, smoothed, and the image is resampled in slices
      perpendicular to it, laid out along its arc length: the bent fish unrolls to a
      straight one at its true length, fins and all.
   6. trim, feather the edge (1px blur on alpha only), downsample to MAX_W, write.

   Run:  node tools/lift-fish.js [--fish=left|right] [--rotate=deg] [--flip-x] [--flip-y]
   Out:  assets/about/fish.png — RGBA, horizontal, head right
*/
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { decode, encode } = require('./png.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'about', 'fish.png');
const MAX_W = 640;             // the sprite renders ~160px long on desktop; 640 covers 2x with headroom
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const a = args.find(x => x.startsWith(`--${name}=`));
  return a ? a.split('=')[1] : dflt;
};
const SIDE = opt('fish', 'left');
const TRIM_DEG = Number(opt('rotate', '0'));
const FLIP_X = args.includes('--flip-x');
const FLIP_Y = args.includes('--flip-y');

const CANDIDATES = [
  args.find(a => !a.startsWith('--')),
  path.join(ROOT, 'about-src', 'fish.jpg'),
  path.join(ROOT, '..', 'fish.jpg'),
].filter(Boolean);
const SRC = CANDIDATES.find(p => { try { return fs.statSync(p).isFile(); } catch { return false; } });
if (!SRC) {
  console.error('lift-fish: no source found. Looked for:\n' + CANDIDATES.map(p => '  ' + p).join('\n'));
  process.exit(1);
}

/* same dependency-free JPEG story as lift-pot: macOS ships sips, tools/png.js does the rest */
let readPath = SRC;
if (!SRC.toLowerCase().endsWith('.png')) {
  const tmp = path.join(os.tmpdir(), 'lift-fish-src.png');
  execFileSync('sips', ['-s', 'format', 'png', SRC, '--out', tmp], { stdio: 'ignore' });
  readPath = tmp;
}
const img = decode(fs.readFileSync(readPath));
const W = img.width, H = img.height, D = img.data;

/* 1. warmth mask */
const mask = new Uint8Array(W * H);
for (let i = 0, p = 0; i < W * H; i++, p += 4) {
  const warm = D[p] - D[p + 2];
  if (warm > 16) mask[i] = 1;
}

/* 2. connected components (8-way), keep the biggest one on the requested side */
const label = new Int32Array(W * H).fill(-1);
const comps = [];   // {n, sx, sy}
const stack = new Int32Array(W * H);
for (let seed = 0; seed < W * H; seed++) {
  if (!mask[seed] || label[seed] >= 0) continue;
  const id = comps.length; const c = { n: 0, sx: 0, sy: 0 };
  let top = 0; stack[top++] = seed; label[seed] = id;
  while (top) {
    const i = stack[--top], x = i % W, y = (i / W) | 0;
    c.n++; c.sx += x; c.sy += y;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (mask[j] && label[j] < 0) { label[j] = id; stack[top++] = j; }
    }
  }
  comps.push(c);
}
if (!comps.length) { console.error('lift-fish: warmth mask found nothing'); process.exit(1); }
const onSide = comps.map((c, i) => ({ i, n: c.n, cx: c.sx / c.n }))
  .filter(c => SIDE === 'left' ? c.cx < W / 2 : c.cx >= W / 2)
  .sort((a, b) => b.n - a.n);
const keep = (onSide[0] || comps.map((c, i) => ({ i, n: c.n })).sort((a, b) => b.n - a.n)[0]).i;
for (let i = 0; i < W * H; i++) mask[i] = label[i] === keep ? 1 : 0;

/* 3. hole fill: everything OUTSIDE the fish is reachable from the image border.
   Flood the outside on the inverted mask; whatever non-fish pixels remain are holes. */
const outside = new Uint8Array(W * H);
let top = 0;
const push = i => { if (!mask[i] && !outside[i]) { outside[i] = 1; stack[top++] = i; } };
for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
while (top) {
  const i = stack[--top], x = i % W, y = (i / W) | 0;
  if (x > 0) push(i - 1); if (x < W - 1) push(i + 1);
  if (y > 0) push(i - W); if (y < H - 1) push(i + W);
}
for (let i = 0; i < W * H; i++) if (!mask[i] && !outside[i]) mask[i] = 1;

/* 3b. soft alpha INSIDE the kept component. The binary mask decides topology, but the
   plate reflects a little warm light right next to the paint, and those grey pixels ride
   into the component at warmth 16–22. Rather than a knife-edge threshold (which would
   also cut the soft painted edge), alpha ramps with confidence: strongly warm pixels are
   fish, and so are BRIGHT ones (the white belly runs warm+light while the plate never
   leaves its mid grey), so each pixel takes the better of the two ramps. */
const soft = new Float32Array(W * H);
for (let i = 0, p = 0; i < W * H; i++, p += 4) {
  if (!mask[i]) continue;
  /* r-g, not r-b: the JPEG bleeds a little red into the plate right next to the
     saturated paint, so r-b stays slightly positive there — but g stays ABOVE r on
     every plate pixel and clearly below it on every painted one, white belly included */
  const orange = D[p] - D[p + 1];
  const lum = 0.299 * D[p] + 0.587 * D[p + 1] + 0.114 * D[p + 2];
  const byColor = Math.min(1, Math.max(0, (orange - 6) / 18));
  const byLight = Math.min(1, Math.max(0, (lum - 196) / 24));   // plate tops out ~190
  soft[i] = Math.max(byColor, byLight);
}

/* 4. PCA → rotation that lays the body horizontal */
let n = 0, mx = 0, my = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y * W + x]) { n++; mx += x; my += y; }
mx /= n; my /= n;
let sxx = 0, syy = 0, sxy = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y * W + x]) {
  const dx = x - mx, dy = y - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
}
const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);   // major-axis angle, y-down image coords
const rot = -theta + TRIM_DEG * Math.PI / 180;

/* rotate image + mask about the centroid, bilinear, into a canvas big enough for any angle */
const diag = Math.ceil(Math.hypot(W, H));
const RW = diag, RH = diag;
const rD = Buffer.alloc(RW * RH * 4);
const rA = new Float32Array(RW * RH);
const cos = Math.cos(-rot), sin = Math.sin(-rot);   // inverse map: dest → src
for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
  const ox = x - RW / 2, oy = y - RH / 2;
  const sx = mx + ox * cos - oy * sin, sy = my + ox * sin + oy * cos;
  const x0 = Math.floor(sx), y0 = Math.floor(sy);
  if (x0 < 0 || y0 < 0 || x0 >= W - 1 || y0 >= H - 1) continue;
  const fx = sx - x0, fy = sy - y0, q = y * RW + x;
  let a = 0;
  for (const [ddx, ddy, wgt] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
    const s = (y0 + ddy) * W + x0 + ddx;
    a += soft[s] * wgt;
    for (let ch = 0; ch < 3; ch++) rD[q * 4 + ch] += D[s * 4 + ch] * wgt;
  }
  rA[q] = a;
}

/* 5. optional mirrors (in place on the rotated canvas) */
const flip = (fx, fy) => {
  const nD = Buffer.alloc(RW * RH * 4), nA = new Float32Array(RW * RH);
  for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
    const s = y * RW + x, d = (fy ? RH - 1 - y : y) * RW + (fx ? RW - 1 - x : x);
    nA[d] = rA[s]; for (let ch = 0; ch < 4; ch++) nD[d * 4 + ch] = rD[s * 4 + ch];
  }
  nD.copy(rD); rA.set(nA);
};
if (FLIP_X || FLIP_Y) flip(FLIP_X, FLIP_Y);

/* 5b. unroll the spine to equilibrium (see header). All in the rotated frame: the body
   runs left-right here, so each column crosses the fish once and its alpha centroid is
   a point on the spine. */
let fD = rD, fA = rA, FW = RW, FH = RH;
{
  const colM = new Float64Array(RW), colC = new Float64Array(RW);
  for (let x = 0; x < RW; x++) {
    let m = 0, s = 0;
    for (let y = 0; y < RH; y++) { const a = rA[y * RW + x]; if (a > 0.04) { m += a; s += a * y; } }
    colM[x] = m; colC[x] = m ? s / m : 0;
  }
  let xa = -1, xb = -1;
  for (let x = 0; x < RW; x++) if (colM[x] > 0.6) { if (xa < 0) xa = x; xb = x; }
  for (let x = xa + 1; x <= xb; x++) if (colM[x] <= 0.6) colC[x] = colC[x - 1];
  /* the spine is a WEIGHTED DEGREE-4 POLYNOMIAL fit of the centroids, not a moving
     average: fins add mass above or below the body and drag the raw centroid up and
     down at fin scale, and any local smoother follows those wiggles — then adjacent
     perpendicular slices cross and the resample smears. A quartic can bend like a
     swimming fish but physically cannot wiggle at fin scale. Mass-weighted, so the
     thin tail columns don't outvote the body. x is normalised to [-1,1] first or the
     normal equations are hopelessly ill-conditioned at image scale. */
  const DEG = 4, M = DEG + 1;
  const A = Array.from({ length: M }, () => new Float64Array(M));
  const bv = new Float64Array(M);
  const nrm = x => (2 * (x - xa)) / (xb - xa) - 1;
  for (let x = xa; x <= xb; x++) {
    const w = colM[x], u = nrm(x);
    const pw = [1]; for (let k = 1; k < 2 * M; k++) pw[k] = pw[k - 1] * u;
    for (let i = 0; i < M; i++) {
      bv[i] += w * pw[i] * colC[x];
      for (let j = 0; j < M; j++) A[i][j] += w * pw[i + j];
    }
  }
  for (let i = 0; i < M; i++) {                  // Gaussian elimination, partial pivot
    let piv = i;
    for (let r = i + 1; r < M; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
    [A[i], A[piv]] = [A[piv], A[i]]; [bv[i], bv[piv]] = [bv[piv], bv[i]];
    for (let r = i + 1; r < M; r++) {
      const f = A[r][i] / A[i][i];
      for (let cCol = i; cCol < M; cCol++) A[r][cCol] -= f * A[i][cCol];
      bv[r] -= f * bv[i];
    }
  }
  const coef = new Float64Array(M);
  for (let i = M - 1; i >= 0; i--) {
    let s = bv[i];
    for (let j = i + 1; j < M; j++) s -= A[i][j] * coef[j];
    coef[i] = s / A[i][i];
  }
  const cS = new Float64Array(RW);
  for (let x = xa; x <= xb; x++) {
    const u = nrm(x);
    let v = 0; for (let i = DEG; i >= 0; i--) v = v * u + coef[i];
    cS[x] = v;
  }
  /* arc length, one segment per source column — the straight fish is LONGER than the
     bent one's x-extent, which is the point: the curl was foreshortening the tail */
  const nSeg = xb - xa;
  const arc = new Float64Array(nSeg + 1);
  for (let i = 1; i <= nSeg; i++)
    arc[i] = arc[i - 1] + Math.hypot(1, cS[xa + i] - cS[xa + i - 1]);
  let Hh = 0;                                    // worst reach off the spine, either side
  for (let x = xa; x <= xb; x++)
    for (let y = 0; y < RH; y++)
      if (rA[y * RW + x] > 0.04) Hh = Math.max(Hh, Math.abs(y - cS[x]));
  Hh = Math.ceil(Hh) + 4;
  const SW = Math.ceil(arc[nSeg]) + 9, SH = Hh * 2 + 1;
  const sD = Buffer.alloc(SW * SH * 4), sA = new Float32Array(SW * SH);
  let seg = 0;
  for (let ox = 0; ox < SW; ox++) {
    const s = Math.min(arc[nSeg], Math.max(0, ox - 4));
    while (seg < nSeg - 1 && arc[seg + 1] < s) seg++;
    const t = (s - arc[seg]) / (arc[seg + 1] - arc[seg] || 1);
    const px = xa + seg + t;
    const py = cS[xa + seg] + (cS[xa + seg + 1] - cS[xa + seg]) * t;
    const dy = cS[xa + seg + 1] - cS[xa + seg];
    const il = 1 / Math.hypot(1, dy);
    const nxv = -dy * il, nyv = il;              // unit normal to the spine
    for (let oy = 0; oy < SH; oy++) {
      const d = oy - Hh;
      const sx = px + nxv * d, sy = py + nyv * d;
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      if (x0 < 0 || y0 < 0 || x0 >= RW - 1 || y0 >= RH - 1) continue;
      const fx = sx - x0, fy = sy - y0, q = oy * SW + ox;
      for (const [ddx, ddy, wgt] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
        const sIdx = (y0 + ddy) * RW + x0 + ddx;
        sA[q] += rA[sIdx] * wgt;
        for (let ch = 0; ch < 3; ch++) sD[q * 4 + ch] += rD[sIdx * 4 + ch] * wgt;
      }
    }
  }
  fD = sD; fA = sA; FW = SW; FH = SH;
}

/* 6. trim to alpha bbox (+pad), feather, downsample by area-averaging, write */
let x0 = FW, y0 = FH, x1 = 0, y1 = 0;
for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) if (fA[y * FW + x] > 0.04) {
  if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
}
const PAD = 6;
x0 = Math.max(0, x0 - PAD); y0 = Math.max(0, y0 - PAD);
x1 = Math.min(FW - 1, x1 + PAD); y1 = Math.min(FH - 1, y1 + PAD);
const TW = x1 - x0 + 1, TH = y1 - y0 + 1;

const scale = Math.min(1, MAX_W / TW);
const OW = Math.round(TW * scale), OH = Math.round(TH * scale);
const out = Buffer.alloc(OW * OH * 4);
for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) {
  const gx0 = x0 + x / scale, gx1 = x0 + (x + 1) / scale;
  const gy0 = y0 + y / scale, gy1 = y0 + (y + 1) / scale;
  let r = 0, g = 0, b = 0, a = 0, cnt = 0;
  for (let sy = Math.floor(gy0); sy < gy1 && sy <= y1; sy++)
    for (let sx = Math.floor(gx0); sx < gx1 && sx <= x1; sx++) {
      const s = sy * FW + sx;
      /* colour is averaged ALPHA-WEIGHTED so plate grey never bleeds into the edge ramp */
      const wA = fA[s];
      r += fD[s * 4] * wA; g += fD[s * 4 + 1] * wA; b += fD[s * 4 + 2] * wA;
      a += wA; cnt++;
    }
  const q = (y * OW + x) * 4;
  if (a > 0) { out[q] = r / a; out[q + 1] = g / a; out[q + 2] = b / a; }
  out[q + 3] = Math.round(255 * Math.min(1, a / cnt * 1.15));   // slight alpha gain seals the soft paint edge
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, encode({ width: OW, height: OH, data: out }));
console.log(`lift-fish: ${SIDE} fish → ${path.relative(ROOT, OUT)} ${OW}x${OH} (rotated ${(rot * 180 / Math.PI).toFixed(1)}°${FLIP_X ? ', flipped x' : ''}${FLIP_Y ? ', flipped y' : ''})`);
