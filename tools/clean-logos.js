/* Rebuild the client logo masks so the row reads as clean letterforms.

   Why this exists: every PNG in assets/logos/ is the same treatment — a CREAM mark with
   an OPAQUE dark-grey outline plus a soft drop-shadow halo baked into the pixels. The
   logo wall masks each file by its ALPHA channel (.brand in build.js), and alpha can't
   tell the mark from its shadow: both are opaque, so both become ink. Every glyph came
   out as a doubled, offset silhouette with a smeared edge — Madhu's "heavy and smudged".

   The mark and the shadow ARE separable by LUMINANCE, though. Measured over all nine
   files, opaque pixels sit in two clean clusters: ~8-14% dark (lum 50-77, the shadow)
   and ~75-90% bright (lum >205, the cream mark). So: keep alpha where the pixel is
   bright, drop it where it is dark, with a short ramp between the clusters so edges stay
   antialiased instead of going jagged.

   Writes assets/logos/clean/*.png (RGBA white at the recovered alpha — the colour never
   ships, only the alpha does, since .brand paints the ink and uses the file as a mask).
   Originals are untouched. Run: node tools/clean-logos.js
*/
const fs = require('fs');
const path = require('path');
const { decode, encode } = require('./png.js');

/* Between these the ramp runs — well inside the empty gap between the two clusters. */
const DARK = 140;   // at or below: shadow, discard
const LIGHT = 195;  // at or above: mark, keep in full

const SRC = path.join(__dirname, '..', 'assets', 'logos');
const OUT = path.join(SRC, 'clean');
fs.mkdirSync(OUT, { recursive: true });

for (const file of fs.readdirSync(SRC).filter(f => f.endsWith('.png'))) {
  const { width, height, data } = decode(fs.readFileSync(path.join(SRC, file)));
  const out = Buffer.alloc(width * height * 4);
  let kept = 0, dropped = 0;

  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    const keep = lum <= DARK ? 0 : lum >= LIGHT ? 1 : (lum - DARK) / (LIGHT - DARK);
    const na = Math.round(a * keep);
    if (a > 200) (na > 200 ? kept++ : dropped++);
    /* White body: only the alpha survives into the CSS mask. */
    out[i * 4] = 255; out[i * 4 + 1] = 255; out[i * 4 + 2] = 255; out[i * 4 + 3] = na;
  }

  fs.writeFileSync(path.join(OUT, file), encode({ width, height, data: out }));
  const pct = (100 * dropped / Math.max(1, kept + dropped)).toFixed(1);
  console.log(`${file.padEnd(20)} ${width}x${height}  shadow removed: ${pct}% of opaque pixels`);
}
