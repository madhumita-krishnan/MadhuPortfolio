#!/usr/bin/env node
/* Lifts the monkey-story artwork off Madhu's notebook photos into alpha masks.

   Sources live in ~/Downloads as camera originals; nothing here writes back to them.
   Output: assets/story/*.png — RGB is the ink-blue token, alpha is the drawing, so each
   file works either as artwork or (via -webkit-mask) as a recolourable mask, the same way
   the logo wall works.

   Two rotations are involved and they are NOT the same thing:
     · EXIF orientation 6 — the iPhone stored the pixels landscape (sips reports the tag
       as <nil> and won't bake it, so ink.js does the 90° CW turn itself).
     · `turns` below — she photographed the notebook sideways, so the writing still runs
       bottom-to-top after the EXIF turn. One more CW turn per item sets it upright.

   Re-run: node tools/lift-story.js
*/
const path = require('path');
const fs = require('fs');
const I = require('./ink');

const DL = path.join(process.env.HOME, 'Downloads');
/* The lifted masks are build INPUTS, not site assets: everything under assets/ is copied
   into dist/, and shipping 1.2 MB of source ink nobody downloads is just dead weight. Only
   the finished GIF and its poster land in assets/story/. */
const OUT = path.join(__dirname, '..', 'story-src');
const CACHE = path.join(__dirname, '..', '.story-cache');

/* sips is the only thing on this machine that can read a JPEG, so every source is
   transcoded to PNG once and cached — the transcode is by far the slowest step. */
function sourcePNG(name) {
  const png = path.join(CACHE, name.replace(/\.[^.]+$/, '') + '.png');
  if (!fs.existsSync(png)) {
    fs.mkdirSync(CACHE, { recursive: true });
    const { execFileSync } = require('child_process');
    execFileSync('sips', ['-s', 'format', 'png', path.join(DL, name), '--out', png], { stdio: 'ignore' });
  }
  return I.read(png);
}

const ITEMS = [
  // name          file             exif  turns  width  the ramp is per-photo because the
  //                                                    three sheets were shot in different light
  { name: 'drawing', file: 'IMG_6506.JPG', exif: true, turns: 0, w: 1500, lo: 2, hi: 30, speck: 40 },
  { name: 'paragraph', file: 'IMG_6507.JPG', exif: true, turns: 3, w: 1400, lo: 4, hi: 34, speck: 60 },
  { name: 'not-working', file: 'IMG_6510.JPG', exif: true, turns: 3, w: 1200, lo: 4, hi: 34, speck: 60 },
  { name: 'shirt', file: 'IMG_6508.jpg', exif: false, turns: 3, w: 700, lo: 4, hi: 34, speck: 30 },
  { name: 'pants', file: 'IMG_6509.jpg', exif: false, turns: 3, w: 700, lo: 4, hi: 34, speck: 30 },
  { name: 'alphabet', file: 'IMG_6504.JPG', exif: true, turns: 0, w: 2000, lo: 4, hi: 34, speck: 40 },
];

fs.mkdirSync(OUT, { recursive: true });

for (const it of ITEMS) {
  let im = sourcePNG(it.file);
  if (it.exif) im = I.rotate90cw(im);
  for (let t = 0; t < it.turns; t++) im = I.rotate90cw(im);

  let m = I.lift(im, { lo: it.lo, hi: it.hi });
  I.despeckle(m, it.speck);

  const bb = I.inkBox(m, 20, 12);
  if (!bb) { console.error(it.name, '— no ink found'); continue; }
  m = I.crop(m, bb.x, bb.y, bb.w, bb.h);

  if (m.width > it.w) m = I.scale(m, it.w, Math.round(it.w * m.height / m.width));
  I.write(path.join(OUT, it.name + '.png'), m);
  console.log(`${it.name.padEnd(12)} ${String(m.width).padStart(5)}×${String(m.height).padEnd(5)}  ${(fs.statSync(path.join(OUT, it.name + '.png')).size / 1024).toFixed(0)}kb`);
}
