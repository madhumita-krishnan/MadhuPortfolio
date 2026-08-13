#!/usr/bin/env node
/* make-hero-flower.js — crop Madhu's flower photograph down to the plant, and work out the
   two numbers the hero needs in order to hide the fact that it is a crop.

   THE PROBLEM. `hero-src/flower.jpg` is a white bloom standing on a deep red felt
   ground, 736x920. The hero is much wider than that and the plant only wants to be about as
   tall as the copy beside it, so the photo cannot just be dropped in — a rectangle of photo
   on a panel reads as a rectangle of photo. So the hero paints the red field itself (a
   gradient on .hero-band in makeCSS) and this script produces the plant alone, to be laid on
   top with its edges faded out by a CSS mask.

   WHY THAT IS SEAMLESS. Compositing a pixel over an identical colour is a no-op: if the
   photo's edge is #5A190C and the field behind it is #5A190C, every intermediate mask value
   also lands on #5A190C and the boundary cannot be seen. So the whole job is to make the
   photo fade out on a colour the field is already holding.

   The first attempt left the photo's own colours alone and tried to build a CSS gradient that
   arrived at each edge correctly, which does not work: the light in this photograph comes from
   the lower right, so the four edges fade out on four different colours (#5C190B at the top,
   #A43E27 at the bottom-right corner) and no gradient centred anywhere matches all of them.
   Instead the outer ring of the crop is graded to a single colour — TARGET_TOKEN in
   data/theme.json, read below so the two cannot drift apart — over the same profile the mask
   uses. The grade is complete only in the outer half of that profile, so the photograph itself
   is untouched everywhere it is more than half opaque; it is only bent where it is on its way
   to invisible.

   TWO THINGS THAT LOOKED WRONG ON THE FIRST BUILD, both worth keeping in mind if this is
   ever re-cut:

   1. Grading to the photograph's darkest corner made the crop glow. The photo's own pool of
      light is #BD5137 and the field was #5A190C, so even a perfectly smooth fade read as a lit
      panel hanging in a dark room — the join was invisible but the rectangle was not. The
      target is the photograph's *mid* brick instead, which is also the truer reading of the
      instruction: the red she asked to have extended is the red the felt mostly is, not the
      shadow in its corners.
   2. A crop fading out on four straight ramps still has four corners, and corners are what
      give a rectangle away. The profile is now those two ramps intersected with an ellipse,
      so the picture dissolves as an oval — a pool of light on the ground, which is what the
      photograph is anyway. The ellipse is deliberately wider than the crop (it would clip the
      bloom at any smaller radius); the straight ramps are what guarantee the outermost pixels
      still reach zero.

   3. Neither of those was enough on its own, because the mismatch is not only at the rim. The
      photograph is vignetted — its ground runs from #BD5137 in the pool of light down to
      #4A1409 in the corners — so however well the outermost ring is graded, the ground a
      little further in is still visibly darker than the flat field it is lying on, and the
      eye reads the whole crop as a panel. So the vignette is divided out: backgroundField()
      estimates the unshadowed ground under every pixel and the picture is rescaled onto the
      target, which lands the ground on one flat colour everywhere while leaving texture, the
      cast shadow and the plant exactly as they were relative to it.
      The estimate takes a high percentile of each block rather than a median on purpose. A
      median would treat the cast shadow as ground and divide it away too, and the shadow is
      the only thing stopping the plant floating; a percentile above it reads through to the
      lit felt, so the shadow survives as shadow.
      FLATTEN below is how much of that correction to apply — 1 is a perfectly even ground,
      lower keeps some of the photographer's falloff. The light that is taken out here is put
      back across the whole hero by .hero-light in makeCSS, which lies over the field and the
      photograph alike, so the pool of light no longer stops at the edge of the picture.

   The mask CSS and this grade are the same function of (x, y) — see profile() — so they cannot
   disagree about where the picture is on its way out.

   WHY THE FADE IS IN CSS AND NOT IN THE PIXELS. The obvious version of this script baked the
   alpha ramp into an RGBA PNG. It worked, but PNG stores a photograph badly — 717KB for a
   490x590 crop, eager-loaded at the top of the page — and this machine's sips cannot write
   WebP (`-s format webp` exits 0 and produces nothing), so there is no cheap alpha format
   available. The ramp is only a pair of crossed linear gradients, which CSS can express
   exactly, so it moved into the stylesheet: a ~70KB JPEG plus a mask, same picture.

   THE CROP. Subject bbox in source pixels is x 169-482, y 124-~560 — bloom, leaves, stem, and
   the point where the stem meets its cast shadow. The margins below are each wider than that
   edge's feather, so nothing is ever caught fading out half-drawn. The bottom deliberately
   takes in the head of the cast shadow and dissolves through it: the shadow is what stops the
   plant floating, and it is soft enough that ending it in a ramp reads as light falling off.

   Run after any change here:  node tools/make-hero-flower.js && node build.js            */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { decode, encode } = require('./png.js');

/* The untouched photograph lives OUTSIDE assets/, next to story-src/ and for the same reason:
   build.js copies assets/ into dist/ wholesale, so leaving the 122KB original in there shipped
   it to Pages on every deploy even though only the derived crop is ever requested. */
const SRC = path.join(__dirname, '..', 'hero-src', 'flower.jpg');
const OUT = path.join(__dirname, '..', 'assets', 'hero', 'hero-flower.jpg');
const THEME = path.join(__dirname, '..', 'data', 'theme.json');

/* crop box in source pixels, and how far in from each edge the fade runs. Every feather is
   smaller than the gap between that edge and the subject bbox in the header note. */
const CROP = { x0: 95, y0: 58, x1: 585, y1: 648 };
const FEATHER = { left: 66, right: 92, top: 54, bottom: 118 };
/* the oval that rounds the rectangle off, in fractions of the crop. rx/ry are the ellipse's
   radii and PLATEAU is how far out along them the picture stays fully opaque. The bloom sits
   at r≈0.69 of this ellipse, which is why the radii are larger than the crop itself. */
const OVAL = { cx: 0.50, cy: 0.48, rx: 0.68, ry: 0.64, plateau: 0.70 };
const TARGET_TOKEN = 'field';
/* How completely to subtract the photograph's own vignette. 0.95 is what shipped — the rest is
   left in so the felt is not perfectly, obviously even, and .hero-light in makeCSS lays a pool
   of light back over the whole hero anyway. Overridable for a quick look: FLATTEN=0.5 node
   tools/make-hero-flower.js. Below about 0.8 the join starts to show as the crop reading
   darker than the field it lies on. */
const FLATTEN = Number(process.env.FLATTEN ?? 0.95);
/* the ground estimate: block size in source pixels, which percentile of each block counts as
   "unshadowed ground", and how many 3x3 passes smooth the grid before it is interpolated. */
const BG = { block: 46, percentile: 0.72, smooth: 3 };
const QUALITY = 86;

/* A linear alpha ramp leaves a visible Mach band where it meets full opacity — the eye picks
   up the discontinuity in the first derivative. CSS gradients interpolate linearly between
   stops, so every ramp below is a smoothstep sampled at eight points instead. */
const smoothstep = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const STEPS = 8;

/* how opaque the picture is at (x, y), 0..1 — the exact function the three CSS mask layers
   compute between them, so the colour grade below can track it */
function profile(x, y, W, H) {
  const fx = Math.min(x / FEATHER.left, (W - 1 - x) / FEATHER.right);
  const fy = Math.min(y / FEATHER.top, (H - 1 - y) / FEATHER.bottom);
  const nx = (x / W - OVAL.cx) / OVAL.rx;
  const ny = (y / H - OVAL.cy) / OVAL.ry;
  const r = Math.sqrt(nx * nx + ny * ny);
  const fr = (1 - r) / (1 - OVAL.plateau);
  return Math.min(smoothstep(fx), smoothstep(fy), smoothstep(fr));
}

function edgeRamp(dir, fracIn, fracOut) {
  /* one axis: 0 -> transparent, fracIn -> opaque, 1-fracOut -> opaque, 1 -> transparent */
  const stops = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    stops.push(`rgba(0,0,0,${smoothstep(t).toFixed(3)}) ${(t * fracIn * 100).toFixed(2)}%`);
  }
  for (let i = STEPS; i >= 0; i--) {
    const t = i / STEPS;
    stops.push(`rgba(0,0,0,${smoothstep(t).toFixed(3)}) ${(100 - t * fracOut * 100).toFixed(2)}%`);
  }
  return `linear-gradient(to ${dir},${stops.join(',')})`;
}

/* The lit felt under every pixel of the whole source frame, as a smooth low-resolution field
   that is then read back bilinearly. Per block: throw away anything that is obviously the
   plant (green, or bright and neutral — the petals), rank what is left by luminance, and take
   a high percentile. High, not median, so that the cast shadow reads as something lying on the
   ground rather than as the ground itself. */
function backgroundField(src) {
  const gw = Math.ceil(src.width / BG.block), gh = Math.ceil(src.height / BG.block);
  let grid = new Float64Array(gw * gh * 3);
  for (let by = 0; by < gh; by++) {
    for (let bx = 0; bx < gw; bx++) {
      const px = [];
      for (let y = by * BG.block; y < Math.min(src.height, (by + 1) * BG.block); y++)
        for (let x = bx * BG.block; x < Math.min(src.width, (bx + 1) * BG.block); x++) {
          const i = (y * src.width + x) * 4;
          const r = src.data[i], g = src.data[i + 1], b = src.data[i + 2];
          const mn = Math.min(r, g, b);
          if (g > r + 6 && g > b + 6) continue;          // stem and leaves
          if (mn > 110 && Math.max(r, g, b) - mn < 70) continue; // petals
          px.push([r, g, b, 0.2126 * r + 0.7152 * g + 0.0722 * b]);
        }
      const k = gw * by + bx;
      if (!px.length) { grid[k * 3] = grid[k * 3 + 1] = grid[k * 3 + 2] = NaN; continue; }
      px.sort((a, b) => a[3] - b[3]);
      /* average a narrow band around the percentile rather than one pixel, so a single
         speck of lint in a block cannot set the level for it */
      const at = Math.min(px.length - 1, Math.round(px.length * BG.percentile));
      const lo = Math.max(0, at - 3), hi = Math.min(px.length - 1, at + 3);
      let t = [0, 0, 0];
      for (let i = lo; i <= hi; i++) { t[0] += px[i][0]; t[1] += px[i][1]; t[2] += px[i][2]; }
      for (let c = 0; c < 3; c++) grid[k * 3 + c] = t[c] / (hi - lo + 1);
    }
  }
  /* fill any block that was entirely plant from its neighbours, then smooth */
  for (let pass = 0; pass < BG.smooth + 1; pass++) {
    const next = new Float64Array(grid.length);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      let t = [0, 0, 0], n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = y + dy, xx = x + dx;
        if (yy < 0 || yy >= gh || xx < 0 || xx >= gw) continue;
        const k = (gw * yy + xx) * 3;
        if (Number.isNaN(grid[k])) continue;
        t[0] += grid[k]; t[1] += grid[k + 1]; t[2] += grid[k + 2]; n++;
      }
      const k = (gw * y + x) * 3;
      for (let c = 0; c < 3; c++) next[k + c] = n ? t[c] / n : grid[k + c];
    }
    grid = next;
  }
  /* bilinear read, in block coordinates with the samples at block centres */
  return (x, y) => {
    const gx = Math.min(gw - 1.001, Math.max(0, x / BG.block - 0.5));
    const gy = Math.min(gh - 1.001, Math.max(0, y / BG.block - 0.5));
    const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    const at = (xx, yy, c) => grid[((gw * Math.min(gh - 1, yy)) + Math.min(gw - 1, xx)) * 3 + c];
    const out = [0, 0, 0];
    for (let c = 0; c < 3; c++)
      out[c] = at(x0, y0, c) * (1 - fx) * (1 - fy) + at(x0 + 1, y0, c) * fx * (1 - fy)
        + at(x0, y0 + 1, c) * (1 - fx) * fy + at(x0 + 1, y0 + 1, c) * fx * fy;
    return out;
  };
}

function ovalRamp() {
  const stops = [];
  for (let i = STEPS; i >= 0; i--) {
    const t = i / STEPS;
    const at = 100 - t * (1 - OVAL.plateau) * 100;
    stops.push(`rgba(0,0,0,${smoothstep(t).toFixed(3)}) ${at.toFixed(2)}%`);
  }
  return `radial-gradient(${(OVAL.rx * 100).toFixed(0)}% ${(OVAL.ry * 100).toFixed(0)}% at ` +
    `${(OVAL.cx * 100).toFixed(0)}% ${(OVAL.cy * 100).toFixed(0)}%,${stops.join(',')})`;
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`missing ${path.relative(process.cwd(), SRC)} — copy the photograph there first`);
    process.exit(1);
  }
  const W = CROP.x1 - CROP.x0;
  const H = CROP.y1 - CROP.y0;

  /* the one colour the whole outer ring is graded to, straight out of the design tokens so
     the photograph and .hero-band cannot drift apart */
  const target = require(THEME).colors[TARGET_TOKEN];
  const TGT = [1, 3, 5].map(i => parseInt(target.slice(i, i + 2), 16));

  /* png.js only speaks PNG and there is no ffmpeg or PIL on this machine, so sips does the
     JPEG decode. See the README's note on the media toolchain. */
  const probe = path.join(os.tmpdir(), 'hero-flower-probe.png');
  execFileSync('sips', ['-s', 'format', 'png', SRC, '--out', probe], { stdio: 'ignore' });
  const src = decode(fs.readFileSync(probe));
  if (CROP.x1 > src.width || CROP.y1 > src.height) {
    console.error(`crop ${CROP.x1}x${CROP.y1} falls outside the ${src.width}x${src.height} source`);
    process.exit(1);
  }

  /* estimated off the whole frame, not the crop, so the crop's own edges do not skew it */
  const ground = backgroundField(src);

  const data = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sx = CROP.x0 + x, sy = CROP.y0 + y;
      const bg = ground(sx, sy);
      const s = (sy * src.width + sx) * 4;
      const d = (y * W + x) * 4;
      /* Doubling the mask's own profile before the smoothstep is what confines the rim grade
         to the outer half of the fade — it reaches full strength at the halfway point, so
         everything the mask leaves more than 50% opaque keeps its own colour. */
      const keep = smoothstep(Math.min(1, profile(x, y, W, H) * 2));
      /* How much of the correction a pixel takes, by how bright it already is. The lift is
         there to raise the ground; the petals are the brightest thing in the frame and do not
         need raising, and giving them the full lift is what clipped them to pink when this
         was a straight multiply. Rolling it off with headroom means nothing can clip. */
      const sl = 0.2126 * src.data[s] + 0.7152 * src.data[s + 1] + 0.0722 * src.data[s + 2];
      const headroom = 1 - (sl / 255) ** 2;
      for (let c = 0; c < 3; c++) {
        /* subtract the vignette: every patch is offset by however far its own ground is from
           the target, so the ground lands flat while texture, cast shadow and plant keep
           their relationship to the felt they are lying on */
        const flat = src.data[s + c] + FLATTEN * headroom * (TGT[c] - bg[c]);
        data[d + c] = Math.max(0, Math.min(255, Math.round(TGT[c] + keep * (flat - TGT[c]))));
      }
      data[d + 3] = 255;
    }
  }

  /* out as PNG, then let sips do the JPEG encode — png.js has no JPEG writer */
  const graded = path.join(os.tmpdir(), 'hero-flower-graded.png');
  fs.writeFileSync(graded, encode({ width: W, height: H, data }));
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(QUALITY),
    graded, '--out', OUT], { stdio: 'ignore' });

  /* re-measure what actually landed on disk, JPEG artefacts and all */
  const check = path.join(os.tmpdir(), 'hero-flower-check.png');
  execFileSync('sips', ['-s', 'format', 'png', OUT, '--out', check], { stdio: 'ignore' });
  const img = decode(fs.readFileSync(check));
  const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0').toUpperCase()).join('');
  const patch = (cx, cy, r = 10) => {
    let t = [0, 0, 0], n = 0;
    for (let y = Math.max(0, cy - r); y < Math.min(img.height, cy + r); y++)
      for (let x = Math.max(0, cx - r); x < Math.min(img.width, cx + r); x++) {
        const i = (y * img.width + x) * 4;
        t[0] += img.data[i]; t[1] += img.data[i + 1]; t[2] += img.data[i + 2]; n++;
      }
    return hex(t.map(v => v / n));
  };

  const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
  console.log(`wrote ${path.relative(process.cwd(), OUT)}  ${W}x${H}  ${kb}KB  q${QUALITY}`);
  console.log('');
  console.log('  aspect-ratio for .hero-bloom img:');
  console.log(`    ${W}/${H}`);
  console.log('');
  console.log(`  graded to ${target} (theme colors.${TARGET_TOKEN}). Every edge below should now read`);
  console.log('  as that colour — if one does not, its feather is wider than its margin:');
  console.log(`    top     ${patch(Math.round(W / 2), 2, 2)}        bottom ${patch(Math.round(W / 2), H - 3, 2)}`);
  console.log(`    left    ${patch(2, Math.round(H / 2), 2)}        right  ${patch(W - 3, Math.round(H / 2), 2)}`);
  console.log(`    corners ${patch(2, 2, 2)} ${patch(W - 3, 2, 2)} ${patch(2, H - 3, 2)} ${patch(W - 3, H - 3, 2)}`);
  console.log(`    the photo's own pool of light, untouched  ${patch(Math.round(W * 0.55), Math.round(H * 0.68), 22)}`);
  console.log('');
  console.log('  HERO_BLOOM_MASK for build.js — the three layers, intersected:');
  console.log(`    ${edgeRamp('right', FEATHER.left / W, FEATHER.right / W)}`);
  console.log(`    ${edgeRamp('bottom', FEATHER.top / H, FEATHER.bottom / H)}`);
  console.log(`    ${ovalRamp()}`);
}

main();
