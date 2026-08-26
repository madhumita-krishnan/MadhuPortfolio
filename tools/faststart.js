/* Move an MP4's moov atom in front of its mdat, in place — qt-faststart, no ffmpeg.
   Why this exists: assets/projects/spotify-screen.mp4 shipped with its moov (the index
   that says where every frame lives) at the END of the file, so a phone on a slow
   connection had to range-request around the whole file before frame one could play —
   found 2026-08-26 chasing "the gifs aren't automatically playing when i scroll".
   This machine has no ffmpeg/HandBrake/VLC (avconvert re-encodes, which is lossy and
   pointless here), but the fix is pure byte surgery: lift moov to just after ftyp and
   add its length to every chunk offset it holds (stco 32-bit / co64 64-bit), since
   those are absolute file positions of the media data that just moved down.

   Run: node tools/faststart.js <file.mp4> [more.mp4 ...]     (rewrites in place)
   A file whose moov already precedes its mdat is left untouched. */
const fs = require('fs');

function topAtoms(buf) {
  const out = [];
  let pos = 0;
  while (pos < buf.length - 8) {
    let len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    let hdr = 8;
    if (len === 1) { len = Number(buf.readBigUInt64BE(pos + 8)); hdr = 16 }
    if (len < hdr) throw new Error(`bad atom ${type}@${pos}`);
    out.push({ type, pos, len, hdr });
    pos += len;
  }
  return out;
}

/* find every stco/co64 inside a (sub)tree, walking only the containers that can hold them */
function chunkTables(buf, start, end) {
  const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl']);
  const out = [];
  let pos = start;
  while (pos < end - 8) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    if (len < 8) break;
    if (type === 'stco' || type === 'co64') out.push({ type, pos });
    if (type === 'cmov') throw new Error('compressed moov — cannot patch');
    if (CONTAINERS.has(type)) out.push(...chunkTables(buf, pos + 8, pos + len));
    pos += len;
  }
  return out;
}

for (const file of process.argv.slice(2)) {
  const buf = fs.readFileSync(file);
  const tops = topAtoms(buf);
  const moov = tops.find(a => a.type === 'moov');
  const mdat = tops.find(a => a.type === 'mdat');
  if (!moov || !mdat) { console.log(`${file}: no moov/mdat — skipped`); continue }
  if (moov.pos < mdat.pos) { console.log(`${file}: already fast-start — untouched`); continue }

  /* everything between ftyp and moov shifts down by moov.len; patch the offsets first */
  const moovBuf = Buffer.from(buf.subarray(moov.pos, moov.pos + moov.len));
  for (const t of chunkTables(moovBuf, 8, moovBuf.length)) {
    const n = moovBuf.readUInt32BE(t.pos + 12);          // entry count after version/flags
    for (let i = 0; i < n; i++) {
      if (t.type === 'stco') {
        const at = t.pos + 16 + i * 4;
        moovBuf.writeUInt32BE(moovBuf.readUInt32BE(at) + moov.len, at);
      } else {
        const at = t.pos + 16 + i * 8;
        moovBuf.writeBigUInt64BE(moovBuf.readBigUInt64BE(at) + BigInt(moov.len), at);
      }
    }
  }
  const ftyp = tops[0].type === 'ftyp' ? buf.subarray(0, tops[0].len) : Buffer.alloc(0);
  const middle = buf.subarray(ftyp.length, moov.pos);    // free/mdat/etc, order preserved
  fs.writeFileSync(file, Buffer.concat([ftyp, moovBuf, middle]));
  console.log(`${file}: moov (${moov.len}b) moved to front`);
}
