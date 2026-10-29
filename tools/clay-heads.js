#!/usr/bin/env node
/* Writes each clay frame's head offset (hx) into assets/clay/clay.json.

   Why (her 2026-10-28: "people are complaining that the avatar is super choppy"): stickman.js used to find where her head
   is by drawing every frame of a move to a canvas and reading its pixels back (getImageData) the first time she made that
   move. Reading pixels back is slow on phones: half a second of frozen page, measured on a 4x-throttled phone, right as
   she set off. The frames never change between builds, so it is measured here once, the same way: the mean x of the top
   40 rows of ink (alpha > 128), minus the frame's cx.

   Run after adding or re-cutting frames:  node tools/clay-heads.js */
const fs = require('fs');
const path = require('path');
const { decode } = require('./png');
const DIR = path.join(__dirname, '..', 'assets', 'clay'), FILE = path.join(DIR, 'clay.json');
const man = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let n = 0;
for (const [k, list] of Object.entries(man)) {
  if (k.startsWith('_') || !Array.isArray(list)) continue;
  for (const f of list) {
    const im = decode(fs.readFileSync(path.join(DIR, f.f))), w = im.width, h = im.height, ch = im.data.length / (w * h);
    let top = -1, sx = 0, c = 0;
    for (let y = 0; y < h && (top < 0 || y < top + 40); y++) for (let x = 0; x < w; x++)
      if ((ch === 4 ? im.data[(y * w + x) * 4 + 3] : 255) > 128) { if (top < 0) top = y; sx += x; c++; }
    f.hx = c ? +(sx / c - f.cx).toFixed(2) : 0; n++;
  }
}
fs.writeFileSync(FILE, JSON.stringify(man) + '\n');
console.log(`head offsets written for ${n} frames`);
