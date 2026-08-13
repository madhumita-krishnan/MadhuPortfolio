/* Turn Madhu's `paint strokes texture.png` into a tileable brush-stroke mask.

   She asked for "no gradients — think more paint strokes texture". The site's `.atmosphere`
   layer was three big radial-gradients standing in for warm light across the cream, which is
   exactly the thing she means. This replaces it with real brush striation.

   Two problems with using her file directly:

   1. IT IS ITSELF A GRADIENT. The swatch is a green panel that is lighter at the top than at
      the bottom. Tile that and you get her brush marks plus a slow green ramp — the very
      thing being removed. So the low-frequency component is subtracted out (a wide box blur
      is the "lighting", everything above it is the "brush") and only the striation survives.

   2. IT DOES NOT TILE. A 126px swatch repeated across a 1440px page shows its seam eight
      times. Mirroring it into a 2x2 quilt makes every edge meet its own reflection, so the
      tile is seamless by construction. Brush strokes are directional, not structured, so the
      mirror reads as more brushwork rather than as a kaleidoscope.

   The result is written as an ALPHA-ONLY texture — the image carries no colour of its own.
   The atmosphere layer paints a palette token through it as a mask, so the wash is tinted by
   the design system rather than by whatever green this swatch happened to be. Retune the
   colour by editing that token, never this file.

   Run:  node tools/make-paint-wash.js
   Out:  assets/hero/paint-wash.png
*/
const fs = require('fs');
const path = require('path');
const { decode, encode } = require('./png.js');

const SRC = path.join(__dirname, '..', '..', 'paint strokes texture.png');
const OUT = path.join(__dirname, '..', 'assets', 'hero', 'paint-wash.png');

const BLUR = 24;    // radius of the "lighting" we subtract; well above the stroke width
const GAIN = 3.4;   // striation is subtle in the source — this brings it to a usable range

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

const src = decode(fs.readFileSync(SRC));
const { width: w, height: h, data } = src;

// luminance
const lum = new Float32Array(w * h);
for (let i = 0; i < w * h; i++) {
  lum[i] = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
}

/* Separable box blur, twice, which is close enough to a Gaussian for a low-pass we are only
   going to subtract. This is the panel's own shading — the gradient being removed. */
function blur(sig) {
  let a = sig;
  for (let pass = 0; pass < 2; pass++) {
    const tmp = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let d = -BLUR; d <= BLUR; d++) { const nx = clamp(x + d, 0, w - 1); s += a[y * w + nx]; n++; }
      tmp[y * w + x] = s / n;
    }
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let d = -BLUR; d <= BLUR; d++) { const ny = clamp(y + d, 0, h - 1); s += tmp[ny * w + x]; n++; }
      out[y * w + x] = s / n;
    }
    a = out;
  }
  return a;
}

const low = blur(lum);
// high-pass, centred on zero: positive where the brush left more pigment
const hi = new Float32Array(w * h);
let min = Infinity, max = -Infinity;
for (let i = 0; i < w * h; i++) { hi[i] = lum[i] - low[i]; if (hi[i] < min) min = hi[i]; if (hi[i] > max) max = hi[i]; }
console.log(`striation range after removing the panel's own shading: ${min.toFixed(1)} .. ${max.toFixed(1)}`);

/* Alpha rides where the brush laid down MORE pigment (darker in the source), so the wash
   reads as strokes of colour on cream rather than as scratches taken out of it. */
const alpha = new Float32Array(w * h);
for (let i = 0; i < w * h; i++) alpha[i] = clamp(-hi[i] * GAIN / 255 + 0.5, 0, 1);

// mirror into a 2x2 quilt so every edge meets its own reflection
const W = w * 2, H = h * 2;
const out = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) {
  const sy = y < h ? y : H - 1 - y;
  for (let x = 0; x < W; x++) {
    const sx = x < w ? x : W - 1 - x;
    const o = (y * W + x) * 4;
    out[o] = out[o + 1] = out[o + 2] = 255; // colour comes from the token this masks
    out[o + 3] = Math.round(alpha[sy * w + sx] * 255);
  }
}

fs.writeFileSync(OUT, encode({ width: W, height: H, data: out }));
console.log(`paint-wash.png  ${w}x${h} → ${W}x${H} seamless  ${(fs.statSync(OUT).size / 1024).toFixed(0)}kb`);
