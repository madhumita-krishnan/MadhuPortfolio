/* Shared helpers for lifting Madhu's ballpoint off a notebook photo.

   Why blue-minus-red and not luminance: `clean-logos.js` separates a mark from its baked
   drop shadow by LUMINANCE because both are neutral. A photo of a notebook page is a
   different problem — the page is lit unevenly (vignette, the shadow of the facing page,
   the darker gutter), so a luminance threshold picks up the page edge and the spine along
   with the ink. Her pen is blue-violet, the paper is warm cream, and B-R separates them
   almost perfectly regardless of exposure: paper sits at B-R -14..-6 (93% of pixels),
   ink runs 0..+62. See the histogram in the session notes.

   Everything here works on {width,height,data:RGBA} buffers from ./png. */
const { decode, encode } = require('./png');
const fs = require('fs');

/* ------------------------------------------------------------------ geometry */

/** EXIF orientation 6 (iPhone portrait) = the stored pixels need a 90° CW turn.
    sips reports the tag as <nil> and refuses to bake it, so we do it ourselves. */
function rotate90cw({ width: w, height: h, data }) {
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4;
      const d = (x * h + (h - 1 - y)) * 4;      // new (x,y) = (h-1-y, x)
      data.copy(out, d, s, s + 4);
    }
  }
  return { width: h, height: w, data: out };
}

/** A 90° CCW turn — the right edge becomes the top. Used to stand the monkey drawing up:
    photographed with the trunk running down the page, turned it becomes a branch the two
    of them sit along, and the mother's downward shove becomes a sideways one. */
function rotate90ccw({ width: w, height: h, data }) {
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4;
      const d = ((w - 1 - x) * h + y) * 4;        // new (x,y) = (y, w-1-x)
      data.copy(out, d, s, s + 4);
    }
  }
  return { width: h, height: w, data: out };
}

function crop(im, x0, y0, w, h) {
  x0 = Math.max(0, x0 | 0); y0 = Math.max(0, y0 | 0);
  w = Math.min(w | 0, im.width - x0); h = Math.min(h | 0, im.height - y0);
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const s = ((y0 + y) * im.width + x0) * 4;
    im.data.copy(out, y * w * 4, s, s + w * 4);
  }
  return { width: w, height: h, data: out };
}

/** Box-filter downscale. Averages in premultiplied alpha so half-covered ink edges
    don't drag the (meaningless) colour of transparent pixels into the average. */
function scale(im, nw, nh) {
  const { width: w, height: h, data } = im;
  const out = Buffer.alloc(nw * nh * 4);
  const sx = w / nw, sy = h / nh;
  for (let y = 0; y < nh; y++) {
    const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.ceil((y + 1) * sy));
    for (let x = 0; x < nw; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.ceil((x + 1) * sx));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = y0; yy < y1 && yy < h; yy++) {
        for (let xx = x0; xx < x1 && xx < w; xx++) {
          const s = (yy * w + xx) * 4, al = data[s + 3] / 255;
          r += data[s] * al; g += data[s + 1] * al; b += data[s + 2] * al;
          a += data[s + 3]; n++;
        }
      }
      const d = (y * nw + x) * 4, am = a / n;
      out[d + 3] = Math.round(am);
      const un = am > 0 ? 255 / a : 0;
      out[d] = Math.round(r * un); out[d + 1] = Math.round(g * un); out[d + 2] = Math.round(b * un);
    }
  }
  return { width: nw, height: nh, data: out };
}

/* ------------------------------------------------------------------ ink lift */

const smooth = t => t * t * (3 - 2 * t);

/** Photo → alpha mask. RGB is left at `tint` so the PNG is usable directly as artwork;
    the alpha is what carries the drawing. lo/hi are the B-R ramp in 0..255 units. */
function lift(im, { lo = 2, hi = 30, tint = [0x3c, 0x6b, 0x76], gamma = 1 } = {}) {
  const { width: w, height: h, data } = im;
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const br = data[i * 4 + 2] - data[i * 4];
    let t = (br - lo) / (hi - lo);
    t = t <= 0 ? 0 : t >= 1 ? 1 : smooth(t);
    if (gamma !== 1) t = Math.pow(t, gamma);
    out[i * 4] = tint[0]; out[i * 4 + 1] = tint[1]; out[i * 4 + 2] = tint[2];
    out[i * 4 + 3] = Math.round(t * 255);
  }
  return { width: w, height: h, data: out };
}

/* -------------------------------------------------------- connected components */

/** 8-connected labelling over alpha > `ink`. Returns {labels:Int32Array, comps:[…]}. */
function components(im, ink = 40) {
  const { width: w, height: h, data } = im;
  const lab = new Int32Array(w * h).fill(-1), comps = [], stack = [];
  for (let seed = 0; seed < w * h; seed++) {
    if (data[seed * 4 + 3] <= ink || lab[seed] !== -1) continue;
    const c = { id: comps.length, area: 0, x0: 1e9, y0: 1e9, x1: -1, y1: -1 };
    lab[seed] = c.id; stack.push(seed);
    while (stack.length) {
      const q = stack.pop(), qx = q % w, qy = (q / w) | 0;
      c.area++;
      if (qx < c.x0) c.x0 = qx; if (qx > c.x1) c.x1 = qx;
      if (qy < c.y0) c.y0 = qy; if (qy > c.y1) c.y1 = qy;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = qx + dx, ny = qy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const n = ny * w + nx;
          if (lab[n] === -1 && data[n * 4 + 3] > ink) { lab[n] = c.id; stack.push(n); }
        }
      }
    }
    comps.push(c);
  }
  return { labels: lab, comps };
}

/** Erase every component smaller than `minArea` — paper grain the lift mistook for ink. */
function despeckle(im, minArea = 24, ink = 40) {
  const { labels, comps } = components(im, ink);
  const kill = new Uint8Array(comps.length);
  comps.forEach(c => { if (c.area < minArea) kill[c.id] = 1; });
  for (let i = 0; i < im.width * im.height; i++) {
    if (labels[i] >= 0 && kill[labels[i]]) im.data[i * 4 + 3] = 0;
  }
  return im;
}

/** Tight bounding box of everything with alpha > ink, grown by `pad`. */
function inkBox(im, ink = 20, pad = 0) {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < im.height; y++) {
    for (let x = 0; x < im.width; x++) {
      if (im.data[(y * im.width + x) * 4 + 3] > ink) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return {
    x: Math.max(0, x0 - pad), y: Math.max(0, y0 - pad),
    w: Math.min(im.width, x1 + pad + 1) - Math.max(0, x0 - pad),
    h: Math.min(im.height, y1 + pad + 1) - Math.max(0, y0 - pad),
  };
}

const read = f => decode(fs.readFileSync(f));
const write = (f, im) => fs.writeFileSync(f, encode(im));

module.exports = { rotate90cw, rotate90ccw, crop, scale, lift, components, despeckle, inkBox, read, write };
