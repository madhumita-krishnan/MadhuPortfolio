#!/usr/bin/env node
/* Flattens an alpha mask onto the cream page colour so it can be eyeballed in a viewer
   that shows transparency as checkerboard (or as black, which reads as a solid blob).
   node tools/preview-mask.js in.png out.png [width] [x y w h] */
const I = require('./ink');
const [, , inp, outp, wArg, cx, cy, cw, ch] = process.argv;
let m = I.read(inp);
if (cx !== undefined) m = I.crop(m, +cx, +cy, +cw, +ch);
const f = Buffer.alloc(m.width * m.height * 4);
for (let i = 0; i < m.width * m.height; i++) {
  const a = m.data[i * 4 + 3] / 255;
  f[i * 4] = Math.round(0xf6 * (1 - a) + m.data[i * 4] * a);
  f[i * 4 + 1] = Math.round(0xf0 * (1 - a) + m.data[i * 4 + 1] * a);
  f[i * 4 + 2] = Math.round(0xe2 * (1 - a) + m.data[i * 4 + 2] * a);
  f[i * 4 + 3] = 255;
}
let flat = { width: m.width, height: m.height, data: f };
const w = wArg ? +wArg : flat.width;
if (w !== flat.width) flat = I.scale(flat, w, Math.round(w * flat.height / flat.width));
I.write(outp, flat);
console.log(outp, flat.width + '×' + flat.height);
