/* A TrueType font, written by hand.

   There is no font library in this project and there is not going to be one — png.js decodes
   and encodes PNG in 200 lines for the same reason. What a font file needs is nine tables of
   big-endian numbers and one checksum trick, and all of it is here.

   The tables, and why each one has to exist:

     glyf  the outlines. Quadratic curves, which is why tools/trace.js fits quadratics.
     loca  where each glyph starts inside glyf. Written in the long format throughout —
           the short format halves the offsets and cannot address a glyf table over 128kb.
     cmap  character code -> glyph. Format 4, the segmented one every renderer supports.
     head  units per em, the bounding box, and checkSumAdjustment (see the end of build).
     hhea  vertical metrics for line layout; hmtx the advance width of each glyph.
     maxp  the counts a rasteriser allocates from before it reads a single outline.
     name  the strings a font menu shows.
     post  version 3.0: no glyph names at all, which is legal and saves several kilobytes.
     OS/2  Windows metrics. Optional in the specification and mandatory in practice —
           a browser will reject a webfont without it.

   Glyph 0 is .notdef and MUST be first; a font whose glyph 0 is a letter renders that letter
   for every character it cannot find. Here it is left empty, so a missing character comes out
   as a space rather than a box — the kinder failure for a handwriting face on a website.

   Coordinates arriving here are already in font units with y UP and the baseline at y=0. */
const zlib = require('zlib');

/* ---------------------------------------------------------------- writing bytes */
class W {
  constructor() { this.b = []; }
  u8(v) { this.b.push(v & 0xff); return this; }
  u16(v) { return this.u8(v >> 8).u8(v); }
  i16(v) { return this.u16(v < 0 ? v + 0x10000 : v); }
  u32(v) { return this.u16(v >>> 16).u16(v & 0xffff); }
  tag(s) { for (let i = 0; i < 4; i++) this.u8(s.charCodeAt(i)); return this; }
  /* Fixed 16.16. Rounding rather than truncating matters for fontRevision, which is the one
     place a version like 1.001 has to survive the round trip. */
  fixed(v) { return this.u32(Math.round(v * 65536)); }
  /* LONGDATETIME: seconds since 1904-01-01, 64-bit. JavaScript has no int64, but the value
     fits comfortably in a double, so it is split into two 32-bit halves. */
  date(sec) { return this.u32(Math.floor(sec / 0x100000000)).u32(sec >>> 0); }
  bytes(arr) { for (const v of arr) this.u8(v); return this; }
  get buf() { return Buffer.from(this.b); }
}

const pad4 = b => (b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - (b.length % 4))]) : b);

/** Sum of the table as big-endian uint32s, which is what every checksum in sfnt is. */
function checksum(buf) {
  const b = pad4(buf);
  let s = 0;
  for (let i = 0; i < b.length; i += 4) s = (s + b.readUInt32BE(i)) >>> 0;
  return s;
}

/* ---------------------------------------------------------------- glyf */

const ON_CURVE = 1, X_SHORT = 2, Y_SHORT = 4, REPEAT = 8, X_SAME = 16, Y_SAME = 32;

/** One glyph's outlines -> its glyf entry.

    `contours` is [[{x, y, on}]]: a flat list of points per closed contour, already in font
    units and integers. Quadratic control points are the `on:false` ones. TrueType allows two
    consecutive off-curve points and implies an on-curve point halfway between them, but this
    writes the implied points out explicitly — the file is a few hundred bytes larger and the
    encoder has one less way to be subtly wrong.

    An empty glyph (space, .notdef) is zero bytes long, not a header with no contours. */
function glyfEntry(contours) {
  const pts = [];
  const ends = [];
  for (const c of contours) {
    if (c.length < 2) continue;
    for (const p of c) pts.push(p);
    ends.push(pts.length - 1);
  }
  if (!ends.length) return Buffer.alloc(0);

  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const w = new W();
  w.i16(ends.length);
  w.i16(Math.min(...xs)).i16(Math.min(...ys)).i16(Math.max(...xs)).i16(Math.max(...ys));
  for (const e of ends) w.u16(e);
  w.u16(0);                                   // no hinting instructions

  /* Flags and coordinates are stored as deltas from the previous point, each delta as one
     byte when it fits in 0..255 with a sign bit in the flag, two otherwise. REPEAT collapses
     a run of identical flags, which on a traced outline is most of them — long stretches of
     off-curve points with the same short/sign pattern. */
  const flags = [], dxs = [], dys = [];
  let px = 0, py = 0;
  for (const p of pts) {
    const dx = p.x - px, dy = p.y - py;
    px = p.x; py = p.y;
    let f = p.on ? ON_CURVE : 0;
    if (dx === 0) f |= X_SAME;
    else if (dx >= -255 && dx <= 255) { f |= X_SHORT; if (dx > 0) f |= X_SAME; dxs.push(Math.abs(dx)); }
    else dxs.push(dx);
    if (dy === 0) f |= Y_SAME;
    else if (dy >= -255 && dy <= 255) { f |= Y_SHORT; if (dy > 0) f |= Y_SAME; dys.push(Math.abs(dy)); }
    else dys.push(dy);
    flags.push(f);
  }
  for (let i = 0; i < flags.length;) {
    let n = 0;
    while (i + n + 1 < flags.length && flags[i + n + 1] === flags[i] && n < 254) n++;
    if (n > 0) { w.u8(flags[i] | REPEAT).u8(n); i += n + 1; }
    else { w.u8(flags[i]); i++; }
  }
  let di = 0;
  for (const f of flags) {
    if (f & X_SHORT) w.u8(dxs[di++]);
    else if (!(f & X_SAME)) w.i16(dxs[di++]);
  }
  di = 0;
  for (const f of flags) {
    if (f & Y_SHORT) w.u8(dys[di++]);
    else if (!(f & Y_SAME)) w.i16(dys[di++]);
  }
  return pad4(w.buf);
}

/* ---------------------------------------------------------------- cmap format 4 */

/** Segments of consecutive codepoints that also map to consecutive glyph ids — the whole
    point of format 4, and why an alphabet costs about forty bytes rather than one entry per
    letter. The mandatory 0xFFFF terminator segment is appended at the end. */
function cmap4(map) {
  const codes = [...map.keys()].sort((a, b) => a - b);
  const segs = [];
  for (const c of codes) {
    const last = segs[segs.length - 1];
    if (last && c === last.end + 1 && map.get(c) === map.get(last.end) + 1) last.end = c;
    else segs.push({ start: c, end: c, gid: map.get(c) });
  }
  segs.push({ start: 0xffff, end: 0xffff, gid: 0 });

  const n = segs.length, x2 = n * 2;
  let sel = 0; while ((1 << (sel + 1)) <= n) sel++;
  const sub = new W();
  sub.u16(4).u16(16 + n * 8).u16(0);
  sub.u16(x2).u16((1 << sel) * 2).u16(sel).u16(x2 - (1 << sel) * 2);
  for (const s of segs) sub.u16(s.end);
  sub.u16(0);
  for (const s of segs) sub.u16(s.start);
  /* idDelta carries the mapping outright — glyph = (code + delta) mod 65536 — so
     idRangeOffset is zero everywhere and the glyphIdArray is empty. The terminator segment
     maps 0xFFFF to glyph 0 via a delta of 1, which is the convention every parser expects. */
  for (const s of segs) sub.i16(s.start === 0xffff ? 1 : ((s.gid - s.start) % 0x10000));
  for (const s of segs) sub.u16(0);
  const subBuf = sub.buf;

  const t = new W();
  t.u16(0).u16(1);                       // one encoding record...
  t.u16(3).u16(1).u32(12);               // ...Windows, Unicode BMP, at offset 12
  return Buffer.concat([t.buf, subBuf]);
}

/* ---------------------------------------------------------------- the font */

/**
 * glyphs: [{ name, code (or null), advance, contours: [[{x,y,on}]] }]
 *         index 0 must be .notdef.
 * head:   { unitsPerEm, ascender, descender, lineGap, capHeight, xHeight, family,
 *           subfamily, version, revision }
 */
function build(glyphs, meta) {
  const upem = meta.unitsPerEm;
  const entries = glyphs.map(g => glyfEntry(g.contours));
  const glyf = Buffer.concat(entries);
  const locaW = new W();
  let off = 0;
  for (const e of entries) { locaW.u32(off); off += e.length; }
  locaW.u32(off);
  const loca = locaW.buf;

  /* bounding box and the metrics that follow from it */
  let xMin = 1e9, yMin = 1e9, xMax = -1e9, yMax = -1e9, maxPts = 0, maxCont = 0;
  for (const g of glyphs) {
    let n = 0;
    for (const c of g.contours) {
      n += c.length;
      for (const p of c) {
        if (p.x < xMin) xMin = p.x; if (p.x > xMax) xMax = p.x;
        if (p.y < yMin) yMin = p.y; if (p.y > yMax) yMax = p.y;
      }
    }
    maxPts = Math.max(maxPts, n);
    maxCont = Math.max(maxCont, g.contours.length);
  }
  if (xMin > xMax) { xMin = yMin = 0; xMax = yMax = 0; }

  const advances = glyphs.map(g => Math.round(g.advance));
  const lsbs = glyphs.map(g => {
    let m = 1e9;
    for (const c of g.contours) for (const p of c) if (p.x < m) m = p.x;
    return m === 1e9 ? 0 : Math.round(m);
  });

  const hmtxW = new W();
  glyphs.forEach((g, i) => hmtxW.u16(advances[i]).i16(lsbs[i]));
  const hmtx = hmtxW.buf;

  const now = Math.floor(Date.now() / 1000) + 2082844800;   // 1904 epoch

  const head = new W()
    .fixed(1).fixed(meta.revision ?? 1)
    .u32(0)                                  // checkSumAdjustment, filled in at the end
    .u32(0x5f0f3cf5)
    .u16(0x000b)                             // baseline at y=0, lsb at x=0, integer ppem
    .u16(upem)
    .date(now).date(now)
    .i16(xMin).i16(yMin).i16(xMax).i16(yMax)
    .u16(0)                                  // macStyle: regular
    .u16(8)                                  // lowestRecPPEM
    .i16(2).i16(1).i16(0).buf;               // directionHint, long loca, glyphDataFormat

  const hhea = new W()
    .fixed(1)
    .i16(meta.ascender).i16(meta.descender).i16(meta.lineGap)
    .u16(Math.max(...advances))
    .i16(Math.min(...lsbs)).i16(0).i16(xMax)
    .i16(1).i16(0).i16(0)                    // caret vertical
    .i16(0).i16(0).i16(0).i16(0)
    .i16(0).u16(glyphs.length).buf;

  const maxp = new W()
    .fixed(1).u16(glyphs.length)
    .u16(maxPts).u16(maxCont).u16(0).u16(0)
    .u16(2).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).buf;

  const codes = new Map();
  glyphs.forEach((g, i) => { if (g.code != null) codes.set(g.code, i); });
  const cmap = cmap4(codes);

  /* name: the strings a font needs to be installable, written TWICE — once for Windows as
     UTF-16BE, once for Macintosh as single-byte MacRoman.

     Both, because this font is going to be double-clicked on a Mac and then looked for in
     Figma. A Windows-only name table is legal and most software copes, but Font Book and a
     handful of older Mac tools fall back to the PostScript name when there is no platform-1
     record, so the font installs and then turns up in the menu as "MadhuHand-Regular".
     MacRoman and ASCII agree over every character in these strings. */
  const strings = [
    [1, meta.family], [2, meta.subfamily], [3, `${meta.family} ${meta.subfamily} ${meta.version}`],
    [4, `${meta.family} ${meta.subfamily}`], [5, `Version ${meta.version}`],
    [6, `${meta.family.replace(/\s+/g, '')}-${meta.subfamily.replace(/\s+/g, '')}`],
    [8, meta.designer || meta.family], [11, meta.url || ''],
  ].filter(([, s]) => s);
  const nameData = [];
  const records = [];
  const addName = (plat, enc, lang, id, buf) => {
    records.push({ plat, enc, lang, id, off: nameData.reduce((n, x) => n + x.length, 0), len: buf.length });
    nameData.push(buf);
  };
  for (const [id, s] of strings) addName(1, 0, 0, id, Buffer.from(s, 'latin1'));
  for (const [id, s] of strings) addName(3, 1, 0x409, id, Buffer.from(s, 'utf16le').swap16());
  /* the specification requires the records sorted by platform, encoding, language, then id */
  records.sort((a, b) => a.plat - b.plat || a.enc - b.enc || a.lang - b.lang || a.id - b.id);
  const nameW = new W().u16(0).u16(records.length).u16(6 + records.length * 12);
  for (const r of records) nameW.u16(r.plat).u16(r.enc).u16(r.lang).u16(r.id).u16(r.len).u16(r.off);
  const name = Buffer.concat([nameW.buf, ...nameData]);

  const post = new W().fixed(3).fixed(0).i16(0).i16(0).u32(0).u32(0).u32(0).u32(0).u32(0).buf;

  const letters = [...codes.keys()].filter(c => c > 32);
  const os2 = new W()
    .u16(4)
    .i16(Math.round(advances.reduce((s, a) => s + a, 0) / advances.length))
    .u16(400).u16(5).u16(0)                                 // regular, medium, installable
    .i16(Math.round(upem * 0.65)).i16(Math.round(upem * 0.7)).i16(0).i16(Math.round(upem * 0.14))
    .i16(Math.round(upem * 0.65)).i16(Math.round(upem * 0.7)).i16(0).i16(Math.round(upem * 0.48))
    .i16(Math.round(upem * 0.05)).i16(Math.round(upem * 0.26))
    .i16(0)                                                 // sFamilyClass: no classification
    .bytes([2, 0, 5, 3, 0, 0, 0, 0, 0, 0])                  // panose: latin text, else unset
    .u32(1).u32(0).u32(0).u32(0)                            // basic latin only
    .tag(meta.vendor || 'NONE')
    /* fsSelection: regular, plus USE_TYPO_METRICS (bit 7). The bit matters here because the
       two pairs below are deliberately different numbers, and without it Windows would take
       the clipping box as the line height and set her at nearly two ems of leading. */
    .u16(0x40 | 0x80)
    .u16(Math.min(...letters)).u16(Math.max(...letters))
    /* sTypo*: the TYPOGRAPHIC zones — where her ascenders and descenders sit as a class.
       This is what line spacing should follow, and it is the same pair hhea carries. */
    .i16(meta.ascender).i16(meta.descender).i16(meta.lineGap)
    /* usWin*: the CLIPPING box, which is a different question and has to be answered with the
       real ink. Her `g` is the case that makes it different: cut from the word "designer",
       its loop swings 1098 units below the baseline against a descender of 656, because the
       descender is a median over g/p/q/y and her g is far and away the deepest of them. Set
       usWinDescent to 656 and a rasteriser is entitled to throw away everything below that —
       which is exactly what "the g looks cut off" is. These two must always cover every
       contour in the font, whatever the typographic zones say. */
    .u16(Math.max(meta.ascender, yMax)).u16(Math.max(Math.abs(meta.descender), -yMin))
    .u32(1).u32(0)
    .i16(meta.xHeight).i16(meta.capHeight)
    .u16(0).u16(32).u16(2).buf;

  /* ---- assemble. Tables go in the directory in alphabetical order by tag, which the
     specification requires; their data can be in any order and is written in the order that
     puts the two big ones last. */
  const tables = [
    ['OS/2', os2], ['cmap', cmap], ['glyf', glyf], ['head', head], ['hhea', hhea],
    ['hmtx', hmtx], ['loca', loca], ['maxp', maxp], ['name', name], ['post', post],
  ].sort((a, b) => (a[0] < b[0] ? -1 : 1));

  const n = tables.length;
  let sel = 0; while ((1 << (sel + 1)) <= n) sel++;
  const dir = new W().u32(0x00010000).u16(n).u16((1 << sel) * 16).u16(sel).u16(n * 16 - (1 << sel) * 16);
  let offset = 12 + n * 16;
  const body = [];
  for (const [tag, data] of tables) {
    const p = pad4(data);
    dir.tag(tag).u32(checksum(data)).u32(offset).u32(data.length);
    body.push(p);
    offset += p.length;
  }
  const font = Buffer.concat([dir.buf, ...body]);

  /* checkSumAdjustment: the number that makes the whole file sum to a constant. It is
     computed with its own field zeroed, which it already is, then written in place. */
  const headEntry = tables.findIndex(t => t[0] === 'head');
  let headOff = 12 + n * 16;
  for (let i = 0; i < headEntry; i++) headOff += pad4(tables[i][1]).length;
  font.writeUInt32BE((0xb1b0afba - checksum(font)) >>> 0, headOff + 8);
  return font;
}

/** Wrap an sfnt as WOFF — the same tables, each deflated, for about a third of the bytes. */
function woff(ttf) {
  const numTables = ttf.readUInt16BE(4);
  const dir = [], out = [];
  let offset = 44 + numTables * 20;
  for (let i = 0; i < numTables; i++) {
    const e = 12 + i * 16;
    const tag = ttf.subarray(e, e + 4);
    const csum = ttf.readUInt32BE(e + 4), off = ttf.readUInt32BE(e + 8), len = ttf.readUInt32BE(e + 12);
    const raw = ttf.subarray(off, off + len);
    const z = zlib.deflateSync(raw, { level: 9 });
    /* the specification says to store the table uncompressed if deflating made it bigger */
    const data = z.length < len ? z : raw;
    dir.push({ tag, csum, len, comp: data.length, offset });
    out.push(data);
    offset += Math.ceil(data.length / 4) * 4;
    if (data.length % 4) out.push(Buffer.alloc(4 - (data.length % 4)));
  }
  /* 44 bytes exactly: signature, flavor, length, numTables, reserved, totalSfntSize,
     major, minor, then FIVE zeroed fields — metaOffset, metaLength, metaOrigLength,
     privOffset, privLength. There were six here once, which made the header 48 bytes, put
     every table offset 4 bytes out and left `length` 4 short of the real file. Chrome
     rejects that with "incorrect file size in WOFF header" and falls back to the next src,
     so with a truetype fallback listed the font still rendered and the bug stayed invisible.
     Hence the assertion below: a header this small should never be wrong twice. */
  const h = new W().tag('wOFF').u32(0x00010000).u32(offset).u16(numTables).u16(0)
    .u32(ttf.length).u16(1).u16(0).u32(0).u32(0).u32(0).u32(0).u32(0);
  for (const d of dir) { h.bytes(d.tag); h.u32(d.offset).u32(d.comp).u32(d.len).u32(d.csum); }
  const file = Buffer.concat([h.buf, ...out]);
  if (file.length !== offset) {
    throw new Error(`woff: header says ${offset} bytes, wrote ${file.length}`);
  }
  return file;
}

module.exports = { build, woff };
