/* A GIF89a encoder, because this machine has no ffmpeg, no ImageMagick, no gifsicle and
   no PIL — see the note in the architecture memo. Node ships zlib, which is no help here:
   GIF uses LZW, not deflate, so the compressor is written out below.

   What it does beyond "write a GIF":
     · one global palette, built from the flat colours we actually draw with rather than
       quantised out of the pixels — the artwork is ink blended over cream, so a ramp per
       tint reproduces every antialiased edge exactly
     · inter-frame differencing: each frame is cropped to the rectangle that actually
       changed, and pixels equal to the previous frame are written as the transparent
       index with disposal 1 (leave in place). On this animation only a small part moves
       per frame, so this is the difference between a usable file and a huge one.

   Usage:
     const g = new Gif(w, h, palette);        // palette: [[r,g,b], …] ≤ 255 entries
     g.addFrame(indexBuffer, delayCentiseconds);
     fs.writeFileSync(f, g.finish());
*/

class ByteWriter {
  constructor() { this.parts = []; this.buf = Buffer.alloc(4096); this.n = 0; }
  byte(b) { if (this.n === this.buf.length) { this.parts.push(this.buf); this.buf = Buffer.alloc(4096); this.n = 0; } this.buf[this.n++] = b; }
  bytes(arr) { for (const b of arr) this.byte(b); }
  short(v) { this.byte(v & 0xff); this.byte((v >> 8) & 0xff); }
  str(s) { for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i)); }
  done() { this.parts.push(this.buf.subarray(0, this.n)); return Buffer.concat(this.parts); }
}

/** GIF's LZW: variable code width from minCodeSize+1, a clear code that resets the
    dictionary when it fills at 4096, and an end code. Output is packed LSB-first and cut
    into sub-blocks of at most 255 bytes. */
function lzw(indices, minCodeSize, out) {
  const CLEAR = 1 << minCodeSize, END = CLEAR + 1;
  let dict = new Map(), next = END + 1, width = minCodeSize + 1;
  let block = [], acc = 0, accBits = 0;

  const push = b => {
    block.push(b);
    if (block.length === 255) { out.byte(255); for (const v of block) out.byte(v); block = []; }
  };
  const emit = code => {
    acc |= code << accBits; accBits += width;
    while (accBits >= 8) { push(acc & 0xff); acc >>>= 8; accBits -= 8; }
  };

  emit(CLEAR);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i], key = prefix * 4096 + k;
    const found = dict.get(key);
    if (found !== undefined) { prefix = found; continue; }
    emit(prefix);
    /* Widen BEFORE handing out the next code, never after. A code is emitted at the width
       current when it is written, and the decoder widens on exactly this schedule; bumping
       one entry late writes code 2^width in width bits and the two sides desync — which
       shows up as a GIF that decodes to garbage from the first dictionary growth on. */
    if (next === 4096) { emit(CLEAR); dict = new Map(); next = END + 1; width = minCodeSize + 1; }
    else {
      if (next >= (1 << width) && width < 12) width++;
      dict.set(key, next++);
    }
    prefix = k;
  }
  emit(prefix);
  emit(END);
  if (accBits > 0) push(acc & 0xff);
  if (block.length) { out.byte(block.length); for (const v of block) out.byte(v); }
  out.byte(0);                                   // block terminator
}

class Gif {
  /** @param palette [[r,g,b], …]; index `palette.length` is reserved as transparent. */
  constructor(width, height, palette) {
    if (palette.length > 255) throw new Error('palette must leave room for a transparent index');
    this.width = width; this.height = height;
    this.palette = palette;
    this.transparent = palette.length;
    this.bits = Math.max(2, Math.ceil(Math.log2(palette.length + 1)));
    this.prev = null;
    this.out = new ByteWriter();

    const o = this.out;
    o.str('GIF89a');
    o.short(width); o.short(height);
    o.byte(0x80 | (this.bits - 1));               // global colour table, `bits` deep
    o.byte(0); o.byte(0);
    for (let i = 0; i < (1 << this.bits); i++) {
      const c = palette[i] || [0, 0, 0];
      o.byte(c[0]); o.byte(c[1]); o.byte(c[2]);
    }
    // Netscape looping extension
    o.byte(0x21); o.byte(0xff); o.byte(11); o.str('NETSCAPE2.0');
    o.byte(3); o.byte(1); o.short(0); o.byte(0);
  }

  /** @param indices Uint8Array of width*height palette indices. @param delay centiseconds. */
  addFrame(indices, delay) {
    let x0 = 0, y0 = 0, w = this.width, h = this.height;
    let data = indices;

    if (this.prev) {
      // shrink to the changed rectangle
      let minX = this.width, minY = this.height, maxX = -1, maxY = -1;
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const i = y * this.width + x;
          if (indices[i] !== this.prev[i]) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < 0) { minX = minY = 0; maxX = maxY = 0; }      // nothing moved: 1px frame
      x0 = minX; y0 = minY; w = maxX - minX + 1; h = maxY - minY + 1;
      const sub = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const src = (y0 + y) * this.width + (x0 + x);
          sub[y * w + x] = indices[src] === this.prev[src] ? this.transparent : indices[src];
        }
      }
      data = sub;
    }

    const o = this.out;
    o.byte(0x21); o.byte(0xf9); o.byte(4);
    o.byte((1 << 2) | 1);                          // disposal 1 (leave), transparency on
    o.short(Math.max(1, Math.round(delay)));
    o.byte(this.transparent);
    o.byte(0);

    o.byte(0x2c);
    o.short(x0); o.short(y0); o.short(w); o.short(h);
    o.byte(0);                                     // no local colour table, not interlaced

    const minCode = Math.max(2, this.bits);
    o.byte(minCode);
    lzw(data, minCode, o);

    this.prev = Uint8Array.from(indices);
    return { x0, y0, w, h };
  }

  finish() { this.out.byte(0x3b); return this.out.done(); }
}

/** Build a palette of `steps` blends from `bg` toward each tint, plus bg itself, and a
    matching RGB→index mapper. Exact for flat artwork: every pixel we draw is one of the
    tints laid over the background at some coverage. */
function rampPalette(bg, tints, steps = 48) {
  const palette = [bg.slice()];
  const key = (r, g, b) => (r << 16) | (g << 8) | b;
  const map = new Map([[key(...bg), 0]]);
  for (const t of tints) {
    for (let i = 1; i <= steps; i++) {
      const a = i / steps;
      const c = [0, 1, 2].map(k => Math.round(bg[k] * (1 - a) + t[k] * a));
      const kk = key(...c);
      if (!map.has(kk)) { map.set(kk, palette.length); palette.push(c); }
    }
  }
  const cache = new Map(map);
  const indexOf = (r, g, b) => {
    const kk = key(r, g, b);
    const hit = cache.get(kk);
    if (hit !== undefined) return hit;
    let best = 0, bestD = Infinity;
    for (let i = 0; i < palette.length; i++) {
      const p = palette[i];
      const d = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    cache.set(kk, best);
    return best;
  };
  return { palette, indexOf };
}

module.exports = { Gif, rampPalette };
