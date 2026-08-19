/* The site's icon — the pot, standing on its line.

   The browser tab showed the blank default globe because no page declared an icon
   (2026-08-19 her ask). The mark is the same object that stands above the footer:
   her ink drawing of the pot, lifted by tools/lift-pot.js, tinted the wordmark
   ink-blue and set on a hairline rule on the site's own cream. Nothing new is drawn
   here — it is the footer shelf, cropped to a square.

   Outputs (assets/favicon/):
     favicon-16.png, favicon-32.png   what the tab actually shows
     apple-touch-icon.png (180px)     iOS home screen; full-bleed, iOS rounds it itself
     favicon-512.png                  anything that wants a big one
     linkedin-400.png                 400x400 for the "I am not a freelancer" experience
                                      entry on LinkedIn — never referenced by the site

   Composed once at 1024 and box-filtered down, the same area-averaging every other
   tool here uses for minification: the pot is fine hatching, and anything sharper
   than a box filter breaks it into moire at 32px.

   Run:  node tools/make-favicon.js */
const fs = require('fs');
const path = require('path');
const { decode, encode } = require('./png');

const ROOT = path.join(__dirname, '..');
const theme = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/theme.json'), 'utf8'));
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const CREAM = hex(theme.colors['bg-base']);     // the page
const INK   = hex(theme.colors['ink-blue']);    // the pot, same var the CSS paints it with
const LINE  = [38, 51, 47];                     // the footer rule's ink (--line before its alpha)

const pot = decode(fs.readFileSync(path.join(ROOT, 'assets/about/pot.png')));

/* area-average resize, RGBA, alpha-weighted so soft edges do not darken */
function resize(src, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    const y0 = y * sh / dh, y1 = (y + 1) * sh / dh;
    for (let x = 0; x < dw; x++) {
      const x0 = x * sw / dw, x1 = (x + 1) * sw / dw;
      let r = 0, g = 0, b = 0, a = 0, area = 0;
      for (let sy = Math.floor(y0); sy < y1; sy++) {
        const wy = Math.min(y1, sy + 1) - Math.max(y0, sy);
        for (let sx = Math.floor(x0); sx < x1; sx++) {
          const wx = Math.min(x1, sx + 1) - Math.max(x0, sx);
          const w = wx * wy, i = (sy * sw + sx) * 4, al = src[i + 3] / 255;
          r += src[i] * al * w; g += src[i + 1] * al * w; b += src[i + 2] * al * w;
          a += al * w; area += w;
        }
      }
      const d = (y * dw + x) * 4;
      if (a > 0) { out[d] = r / a; out[d + 1] = g / a; out[d + 2] = b / a; }
      out[d + 3] = Math.round(a / area * 255);
    }
  }
  return out;
}

/* Each size is composed DIRECTLY at its own pixel count rather than downscaled from one
   master, because the drawing is fine hatching: at 32px a stroke covers a twentieth of a
   pixel and area-averaging honestly reports "5% ink", which reads as nothing. Same
   physics as the dog drawing's faded look — the lift's alpha is proportional to ink,
   which is a negative, not a print. So the small sizes get a GAMMA on the averaged
   alpha (a^g, g<1): it turns "a few hairlines crossed this pixel" into visible ink
   while leaving solid strokes solid. 512/400/180 have pixels to spare and stay honest;
   the gamma deepens as the pixels run out. The pot also grows a little as the tile
   shrinks — at 16px a 62%-wide mark is furniture, not an icon. */
function compose(size, { gamma = 1, potW = 0.62, ruleA = 0.26 } = {}) {
  const img = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) { img[i * 4] = CREAM[0]; img[i * 4 + 1] = CREAM[1]; img[i * 4 + 2] = CREAM[2]; img[i * 4 + 3] = 255; }

  const ruleY = Math.round(size * 0.76), ruleH = Math.max(1, Math.round(size * 0.012));
  for (let y = ruleY; y < ruleY + ruleH; y++) for (let x = 0; x < size; x++) {
    const d = (y * size + x) * 4;
    for (let c = 0; c < 3; c++) img[d + c] = Math.round(img[d + c] * (1 - ruleA) + LINE[c] * ruleA);
  }

  /* The pot and the tile must have the same PARITY, or the spare pixels cannot split
     evenly: at 16px the rounded pot came out 13px wide, sat 2px off one edge and 1px off
     the other, and a whole pixel of lean at tab size is exactly "the pot doesn't feel
     centered" (2026-08-19). Grown to match rather than shrunk — the small sizes already
     want the mark bigger. The drawing itself is balanced: its width-weighted silhouette
     midline sits within 2px of its box centre at 900px, so box-centering is honest once
     the margins can actually be equal. */
  let pw = Math.round(size * potW);
  if ((size - pw) % 2) pw += 1;
  const ph = Math.round(pw * pot.height / pot.width);
  const scaled = resize(pot.data, pot.width, pot.height, pw, ph);
  const px0 = (size - pw) / 2, py0 = ruleY - ph;   // foot exactly on the line
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const a = Math.pow(scaled[(y * pw + x) * 4 + 3] / 255, gamma);
    if (!a) continue;
    const d = ((py0 + y) * size + (px0 + x)) * 4;
    for (let c = 0; c < 3; c++) img[d + c] = Math.round(img[d + c] * (1 - a) + INK[c] * a);
  }
  return img;
}

const outDir = path.join(ROOT, 'assets/favicon');
fs.mkdirSync(outDir, { recursive: true });
const save = (name, size, opts) => {
  fs.writeFileSync(path.join(outDir, name), encode({ width: size, height: size, data: compose(size, opts) }));
  console.log(' ', name, size + 'x' + size);
};
save('favicon-512.png', 512);
save('linkedin-400.png', 400);
save('apple-touch-icon.png', 180, { gamma: .85 });
save('favicon-32.png', 32, { gamma: .45, potW: .74, ruleA: .4 });
save('favicon-16.png', 16, { gamma: .34, potW: .8, ruleA: .5 });
