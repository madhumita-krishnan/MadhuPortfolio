#!/usr/bin/env node
/* Renders the monkey story to assets/story/monkey-story.gif (and a poster still).

   node tools/make-story-gif.js                    # the wide (desktop) loop
   node tools/make-story-gif.js --variant tall     # the stacked loop phones get
   node tools/make-story-gif.js --at 6.2           # one frame to a PNG, to eyeball a beat
   node tools/make-story-gif.js --scale .5         # smaller/faster while tuning

   Both variants must be rebuilt after any change — the page serves one or the other.

   The drawing is warped, not cut apart — see the note on FIELDS in story.js.
*/
const fs = require('fs');
const path = require('path');
const I = require('./ink');
const S = require('./story');
const { Gif, rampPalette } = require('./gif');

/* Deliberately NOT under assets/ — everything there is copied into dist/ and shipped, and
   this is a standalone piece now rather than a section of the site. */
const OUT = path.join(__dirname, '..', 'monkey-gif');
fs.mkdirSync(OUT, { recursive: true });
const BG = [0xf6, 0xf0, 0xe2];                    // --bg-base
const INK = [0x3c, 0x6b, 0x76];                   // --ink-blue
const ACCENT = [0xa9, 0x4e, 0x2c];                // --accent, for the two labels

const arg = (flag, def) => {
  const i = process.argv.indexOf(flag);
  return i < 0 ? def : process.argv[i + 1];
};
const VARIANT = arg('--variant', 'wide');
const LAYOUT = S.LAYOUTS[VARIANT];
if (!LAYOUT) throw new Error(`unknown variant "${VARIANT}" — expected wide or tall`);
const SCALE = +arg('--scale', LAYOUT.scale);
const NAME = VARIANT === 'wide' ? 'monkey-story' : 'monkey-story-tall';

/* ------------------------------------------------------------------------ compositing */

/** A canvas of straight (non-premultiplied) coverage per tint. Everything here is flat
    ink on flat paper, so a coverage buffer per colour is all that is needed, and the
    palette lookup at the end is exact. */
function canvas(w, h) {
  return { w, h, cov: [new Float32Array(w * h), new Float32Array(w * h)] };  // [ink, accent]
}

/** Draw a mask into `c` at (dx,dy), scaled by `k`, into coverage channel `ch`. */
function draw(c, mask, dx, dy, k, ch = 0, clip = null) {
  const w = Math.round(mask.width * k), h = Math.round(mask.height * k);
  const x0 = Math.max(0, Math.round(dx)), y0 = Math.max(0, Math.round(dy));
  const x1 = Math.min(c.w, Math.round(dx) + w), y1 = Math.min(c.h, Math.round(dy) + h);
  const cov = c.cov[ch];
  for (let y = y0; y < y1; y++) {
    const sy = (y - dy) / k;
    const sy0 = Math.floor(sy), fy = sy - sy0;
    for (let x = x0; x < x1; x++) {
      const sx = (x - dx) / k;
      const sx0 = Math.floor(sx), fx = sx - sx0;
      if (sx0 < 0 || sy0 < 0 || sx0 + 1 >= mask.width || sy0 + 1 >= mask.height) continue;
      if (clip && !clip(sx, sy)) continue;
      const a = (i, j) => mask.data[((sy0 + j) * mask.width + sx0 + i) * 4 + 3];
      const v = (a(0, 0) * (1 - fx) * (1 - fy) + a(1, 0) * fx * (1 - fy)
        + a(0, 1) * (1 - fx) * fy + a(1, 1) * fx * fy) / 255;
      const d = y * c.w + x;
      if (v > cov[d]) cov[d] = v;
    }
  }
}

/** Flatten to RGB and map through the palette. */
function toIndices(c, indexOf) {
  const out = new Uint8Array(c.w * c.h);
  const [ink, acc] = c.cov;
  for (let i = 0; i < out.length; i++) {
    const a = ink[i], b = acc[i];
    let r = BG[0], g = BG[1], bl = BG[2];
    if (a > 0) { r = r * (1 - a) + INK[0] * a; g = g * (1 - a) + INK[1] * a; bl = bl * (1 - a) + INK[2] * a; }
    if (b > 0) { r = r * (1 - b) + ACCENT[0] * b; g = g * (1 - b) + ACCENT[1] * b; bl = bl * (1 - b) + ACCENT[2] * b; }
    out[i] = indexOf(Math.round(r), Math.round(g), Math.round(bl));
  }
  return out;
}

/* ------------------------------------------------------------------------------ warp */

const smooth = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** Falloff of an elliptical field: 1 at the centre, 0 at the rim and beyond. */
function weight(f, x, y) {
  const d = Math.hypot((x - f.cx) / f.rx, (y - f.cy) / f.ry);
  return smooth(1 - d);
}

/** Warp the drawing for time t. Returns a mask the same size as the input.
    Inverse-mapped: for each destination pixel we ask where it came from, which is what
    keeps the result hole-free. */
function warpDrawing(src, shove, deg) {
  const { press: P, wriggle: W } = S.FIELDS;
  const rad = deg * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  const out = Buffer.from(src.data);              // start as a copy: most of the frame is still

  /* Only the union of the two fields can move, so only re-sample there. On this drawing
     that is about a third of the pixels, and this runs 240 times. */
  const bx0 = Math.max(0, Math.floor(Math.min(P.cx - P.rx, W.cx - W.rx)));
  const bx1 = Math.min(src.width, Math.ceil(Math.max(P.cx + P.rx, W.cx + W.rx)));
  const by0 = Math.max(0, Math.floor(Math.min(P.cy - P.ry, W.cy - W.ry)));
  const by1 = Math.min(src.height, Math.ceil(Math.max(P.cy + P.ry, W.cy + W.ry)));

  for (let y = by0; y < by1; y++) {
    for (let x = bx0; x < bx1; x++) {
      let sx = x, sy = y;

      /* Her shove runs along the field's own axis. Turned on its side that is x — she is
         pushing the pants sideways into the baby, not down into the branch she sits on. */
      const wp = shove !== 0 ? weight(P, x, y) : 0;
      if (wp > 0) { if (P.axis === 'x') sx -= shove * wp; else sy -= shove * wp; }

      const ww = deg !== 0 ? weight(W, x, y) : 0;
      if (ww > 0) {
        const px = x - W.pivot.x, py = y - W.pivot.y;
        const rx = px * cos - py * sin, ry = px * sin + py * cos;
        sx -= (rx - px) * ww; sy -= (ry - py) * ww;
      }

      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      let v = 0;
      if (x0 >= 0 && y0 >= 0 && x0 + 1 < src.width && y0 + 1 < src.height) {
        const fx = sx - x0, fy = sy - y0;
        const a = (i, j) => src.data[((y0 + j) * src.width + x0 + i) * 4 + 3];
        v = a(0, 0) * (1 - fx) * (1 - fy) + a(1, 0) * fx * (1 - fy)
          + a(0, 1) * (1 - fx) * fy + a(1, 1) * fx * fy;
      }
      out[(y * src.width + x) * 4 + 3] = Math.round(v);
    }
  }
  return { width: src.width, height: src.height, data: out };
}

/* ------------------------------------------------------------------------ text reveal */

/** How many words of a beat are showing at time t, and how many have been rubbed out.
    Reveal runs left to right; the erase runs the same way, like wiping a board. */
function revealState(beat, t, n) {
  if (t < beat.t0) return { from: 0, to: 0 };
  if (t < beat.tIn) return { from: 0, to: Math.ceil(n * (t - beat.t0) / (beat.tIn - beat.t0)) };
  if (t < beat.tHold) return { from: 0, to: n };
  if (beat.t1 <= beat.tHold) return { from: 0, to: n };            // this beat never leaves
  if (t < beat.t1) return { from: Math.ceil(n * (t - beat.tHold) / (beat.t1 - beat.tHold)), to: n };
  return { from: n, to: n };
}

/** Draw words[from..to) of a mask that has been segmented into word boxes. */
function drawWords(c, mask, boxes, labels, from, to, dx, dy, k, ch) {
  if (to <= from) return;
  const show = new Set();
  for (let i = from; i < to && i < boxes.length; i++) {
    if (boxes[i].ids) boxes[i].ids.forEach(id => show.add(id));
  }
  const useIds = show.size > 0 && labels;
  const clip = useIds
    ? (sx, sy) => show.has(labels[Math.round(sy) * mask.width + Math.round(sx)])
    : (sx, sy) => {
      for (let i = from; i < to && i < boxes.length; i++) {
        const b = boxes[i];
        if (sx >= b.x - 2 && sx <= b.x + b.w + 2 && sy >= b.y - 2 && sy <= b.y + b.h + 2) return true;
      }
      return false;
    };
  draw(c, mask, dx, dy, k, ch, clip);
}

/* ---------------------------------------------------------------------------- a frame */

function makeRenderer() {
  const A = S.artwork();
  const { beats, duration } = S.schedule();
  const L = LAYOUT;
  const W = Math.round(L.canvas.w * SCALE), H = Math.round(L.canvas.h * SCALE);

  const crop = S.DRAW_CROP;
  const drawH = L.drawing.h * SCALE;
  const kDraw = drawH / crop.h;
  const drawX = L.drawing.x * SCALE, drawY = L.drawing.y * SCALE;
  // drawing space → canvas space
  const dx2c = x => drawX + (x - crop.x) * kDraw;
  const dy2c = y => drawY + (y - crop.y) * kDraw;

  const textX = L.text.x * SCALE, textW = L.text.w * SCALE, textMid = L.text.mid * SCALE;

  function frame(t) {
    const c = canvas(W, H);

    const warped = warpDrawing(A.drawing, S.press(t), S.wriggle(t));
    /* Clip to DRAW_CROP. The mask is the whole 1500×2092 lift, most of which is the trunk
       running on down the page; without this it draws straight through the text below it
       in the stacked layout, and the paragraph gets a tree through it. */
    draw(c, warped, drawX - crop.x * kDraw, drawY - crop.y * kDraw, kDraw, 0,
      (sx, sy) => sx >= crop.x && sx <= crop.x + crop.w && sy >= crop.y && sy <= crop.y + crop.h);

    for (const b of beats) {
      if (t < b.t0 || (b.t1 > b.tHold && t >= b.t1)) continue;

      if (b.key === 'stealing') {
        const boxes = A.stealingWords;
        const { from, to } = revealState(b, t, boxes.length);
        const k = textW / A.stealing.width;
        drawWords(c, A.stealing, boxes, null, from, to,
          textX, textMid - A.stealing.height * k / 2, k, 0);
      } else if (b.key === 'notWorking' || b.key === 'paragraph') {
        const src = b.key === 'paragraph' ? A.paragraph : A.notWorking;
        const seg = b.key === 'paragraph' ? A.paragraphWords : A.notWorkingWords;
        const boxes = seg.words.map(w => ({ x: w.x0, y: w.y0, w: w.x1 - w.x0, h: w.y1 - w.y0, ids: w.ids }));
        const { from, to } = revealState(b, t, boxes.length);
        const k = textW / src.width;
        drawWords(c, src, boxes, seg.labels, from, to,
          textX, textMid - src.height * k / 2, k, 0);
      } else {
        // the two labels: one piece of artwork, faded in and out rather than word by word
        const src = b.key === 'shirt' ? A.shirt : A.pants;
        const spot = S.LABELS[b.key];
        /* A label is one mark, so there are no words to reveal one at a time — wipe it on
           left to right instead, which reads like she is writing it in, and wipe it off
           the same way. */
        let lo = 0, hi = 1;
        if (t < b.tIn) hi = (t - b.t0) / (b.tIn - b.t0);
        else if (t >= b.tHold && b.t1 > b.tHold) lo = (t - b.tHold) / (b.t1 - b.tHold);
        if (hi > lo) {
          const x0 = src.width * lo, x1 = src.width * hi;
          draw(c, src, dx2c(spot.at.x), dy2c(spot.at.y), spot.w * kDraw / src.width, 1,
            sx => sx >= x0 && sx <= x1);
        }
      }
    }
    return c;
  }

  return { frame, duration, W, H };
}

/* ------------------------------------------------------------------------------- main */

function main() {
  const { frame, duration, W, H } = makeRenderer();
  const { palette, indexOf } = rampPalette(BG, [INK, ACCENT], 28);

  const at = arg('--at', null);
  if (at !== null) {
    const c = frame(+at);
    const idx = toIndices(c, indexOf);
    const data = Buffer.alloc(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      const p = palette[idx[i]];
      data[i * 4] = p[0]; data[i * 4 + 1] = p[1]; data[i * 4 + 2] = p[2]; data[i * 4 + 3] = 255;
    }
    const f = path.join(process.env.TMPDIR || '/tmp', `story-${VARIANT}-${at}.png`);
    I.write(f, { width: W, height: H, data });
    console.log('wrote', f, `${W}×${H}  t=${at}s of ${duration.toFixed(1)}s`);
    return;
  }

  /* The poster is the last resting frame — the paragraph up, the monkeys mid-shove. It is
     what `prefers-reduced-motion` readers get instead of the loop, so it has to carry the
     punchline on its own. */
  const rest = frame(duration - 0.05);
  const restIdx = toIndices(rest, indexOf);
  const posterData = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const p = palette[restIdx[i]];
    posterData[i * 4] = p[0]; posterData[i * 4 + 1] = p[1]; posterData[i * 4 + 2] = p[2];
    posterData[i * 4 + 3] = 255;
  }
  I.write(path.join(OUT, NAME + '-poster.png'), { width: W, height: H, data: posterData });

  const n = Math.round(duration * S.FPS);
  const delay = Math.round(100 / S.FPS);
  const gif = new Gif(W, H, palette);
  console.log(`${W}×${H}, ${n} frames, ${duration.toFixed(1)}s @ ${S.FPS}fps`);
  for (let i = 0; i < n; i++) {
    const c = frame(i / S.FPS);
    gif.addFrame(toIndices(c, indexOf), delay);
    if (i % 25 === 0) process.stdout.write(`  ${i}/${n}\r`);
  }
  const buf = gif.finish();
  fs.writeFileSync(path.join(OUT, NAME + '.gif'), buf);
  console.log(`${NAME}.gif  ${(buf.length / 1024).toFixed(0)} kb`);
}

if (require.main === module) main();
module.exports = { makeRenderer, toIndices };
