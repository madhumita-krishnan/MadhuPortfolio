/* Minimal dependency-free PNG reader/writer.
   This machine has no PIL, numpy, ImageMagick or canvas — but Node ships zlib, and a PNG
   is just zlib-deflated scanlines with a per-row filter byte. That's enough to do real
   pixel work on Madhu's handwriting (despeckle, re-space lines, stamp punctuation)
   without a browser round-trip. Reads 8-bit greyscale / greyscale+alpha / RGB / RGBA,
   writes 8-bit RGBA. */
const zlib = require('zlib');

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return buf => {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
})();

const paeth = (a, b, c) => {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** → {width, height, data:Buffer RGBA} */
function decode(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a png');
  let p = 8, w = 0, h = 0, depth = 0, type = 0, idat = [], plte = null, trns = null;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), tag = buf.toString('ascii', p + 4, p + 8);
    const body = buf.subarray(p + 8, p + 8 + len);
    if (tag === 'IHDR') {
      w = body.readUInt32BE(0); h = body.readUInt32BE(4);
      depth = body[8]; type = body[9];
      if (body[12] !== 0) throw new Error('interlaced png unsupported');
    } else if (tag === 'IDAT') idat.push(body);
    else if (tag === 'PLTE') plte = Buffer.from(body);
    else if (tag === 'tRNS') trns = Buffer.from(body);
    else if (tag === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8) throw new Error('only 8-bit png supported, got ' + depth);
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!ch) throw new Error('colour type ' + type + ' unsupported');
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch, out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride), cur = Buffer.alloc(stride), q = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[q++];
    raw.copy(cur, 0, q, q + stride); q += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      cur[i] = (cur[i] + (f === 1 ? a : f === 2 ? b : f === 3 ? ((a + b) >> 1) : f === 4 ? paeth(a, b, c) : 0)) & 0xff;
    }
    for (let x = 0; x < w; x++) {
      const s = x * ch, d = (y * w + x) * 4;
      if (type === 0) { out[d] = out[d + 1] = out[d + 2] = cur[s]; out[d + 3] = 255; }
      else if (type === 4) { out[d] = out[d + 1] = out[d + 2] = cur[s]; out[d + 3] = cur[s + 1]; }
      else if (type === 2) { out[d] = cur[s]; out[d + 1] = cur[s + 1]; out[d + 2] = cur[s + 2]; out[d + 3] = 255; }
      else if (type === 6) { out[d] = cur[s]; out[d + 1] = cur[s + 1]; out[d + 2] = cur[s + 2]; out[d + 3] = cur[s + 3]; }
      else if (type === 3) {
        const i = cur[s] * 3;
        out[d] = plte[i]; out[d + 1] = plte[i + 1]; out[d + 2] = plte[i + 2];
        out[d + 3] = trns && cur[s] < trns.length ? trns[cur[s]] : 255;
      }
    }
    const t = prev; prev = cur; cur = t;
  }
  return { width: w, height: h, data: out };
}

/** {width,height,data:RGBA} → Buffer */
function encode({ width: w, height: h, data }) {
  const stride = w * 4, raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;                       // filter: none — the deflate stage
    data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); // handles it fine here
  }
  const chunk = (tag, body) => {
    const c = Buffer.alloc(12 + body.length);
    c.writeUInt32BE(body.length, 0);
    c.write(tag, 4, 'ascii');
    body.copy(c, 8);
    c.writeUInt32BE(CRC(c.subarray(4, 8 + body.length)), 8 + body.length);
    return c;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = ihdr[11] = ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

module.exports = { decode, encode };
