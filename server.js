#!/usr/bin/env node
/* Tiny production-grade static server for the portfolio.
   - gzip for text assets
   - ETag/304 revalidation for everything (instant repeat loads, never stale)
   - Range requests for video scrubbing
   - dev mode: auto-rebuilds when data/ or build.js changes, so you just edit + refresh
   Run: node server.js [port]        (default 4173) */
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.argv[2]) || 4173;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.md': 'text/plain; charset=utf-8',
  '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon'
};
const COMPRESS = new Set(['.html', '.css', '.js', '.json', '.svg']);

function latestSourceMtime() {
  let max = 0;
  const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else max = Math.max(max, fs.statSync(p).mtimeMs);
    }
  };
  walk(path.join(ROOT, 'data'));
  max = Math.max(max, fs.statSync(path.join(ROOT, 'build.js')).mtimeMs);
  max = Math.max(max, fs.statSync(path.join(ROOT, 'walkthrough.js')).mtimeMs);
  return max;
}

function rebuildIfStale() {
  let stamp = 0;
  try { stamp = Number(fs.readFileSync(path.join(DIST, '.buildstamp'), 'utf8')); } catch { }
  if (latestSourceMtime() > stamp) {
    console.log('[dev] source changed → rebuilding');
    execFileSync(process.execPath, [path.join(ROOT, 'build.js')], { stdio: 'inherit' });
  }
}

/* POST /__edit — in-place text editing on walkthrough pages (localhost only). Sets one
   EXISTING string in data/case-studies/<slug>.json; it can't add keys or change types, so a
   stray edit can only ever reword copy. The next page load rebuilds from the new JSON. */
function handleEdit(req, res) {
  const loop = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  if (!loop) { res.writeHead(403); return res.end('localhost only'); }
  let body = '';
  req.on('data', c => { body += c; if (body.length > 1e5) req.destroy(); });
  req.on('end', () => {
    try {
      const { slug, path: keyPath, value } = JSON.parse(body);
      if (!/^[a-z0-9-]+$/.test(slug) || typeof keyPath !== 'string' || !['string', 'number'].includes(typeof value)) throw new Error('bad request');
      if (typeof value === 'number' && !(Number.isFinite(value) && Math.abs(value) <= 200)) throw new Error('number out of range');
      /* viewer captions live beside the screens: "iter:<group>.<i>.<field>" edits the
         iterations file, "clip:<name>.description" the clips file; plain paths edit the case */
      const caseFile = path.join(ROOT, 'data/case-studies', slug + '.json');
      const side = /^(iter|clip):(.+)$/.exec(keyPath);
      const file = side ? path.join(ROOT, JSON.parse(fs.readFileSync(caseFile, 'utf8')).dir, side[1] === 'iter' ? 'iter/iterations.json' : 'clips/clips.json') : caseFile;
      const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
      const keys = side ? side[2].split('.') : keyPath.split('.');
      if (keys.some(k => k === '__proto__' || k === 'constructor' || k === 'prototype')) throw new Error('bad path');   // no prototype pollution
      if (side && side[1] === 'clip') { const i = doc.findIndex(c => c.name === keys[0]); if (i < 0) throw new Error('no such clip: ' + keys[0]); keys[0] = String(i); }
      let o = doc;
      for (const k of keys.slice(0, -1)) { o = o[k]; if (o === null || typeof o !== 'object') throw new Error('no such path: ' + keyPath); }
      const last = keys[keys.length - 1];
      /* text stays text and a number (a callout's position) stays a number */
      if (typeof o[last] !== typeof value) throw new Error('not a ' + typeof value + ' field: ' + keyPath);
      const before = o[last];
      o[last] = value;
      fs.writeFileSync(file, JSON.stringify(doc, null, side ? (side[1] === 'clip' ? 2 : 1) : 1) + '\n');
      if (side) { const now = new Date(); fs.utimesSync(caseFile, now, now); } // the dev rebuild watches data/
      /* every edit is also appended to edit-log.jsonl (repo root, outside data/ and dist/),
         old and new side by side, so whoever works on the page next can see exactly what
         she changed by hand and never write over it */
      fs.appendFileSync(path.join(ROOT, 'edit-log.jsonl'), JSON.stringify({ at: new Date().toISOString(), slug, path: keyPath, before, after: value }) + '\n');
      console.log(`[edit] ${slug} ${keyPath}`);
      res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok');
    } catch (err) { res.writeHead(400, { 'Content-Type': 'text/plain' }); res.end(err.message); }
  });
}

/* POST /__cursor — sets (or with x:null removes) where the drawn mouse pointer sits on one
   screen image, in cs.cursors keyed by the image's path. Localhost only, logged like edits. */
function handleCursor(req, res) {
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) { res.writeHead(403); return res.end('localhost only'); }
  let body = '';
  req.on('data', c => { body += c; if (body.length > 1e4) req.destroy(); });
  req.on('end', () => {
    try {
      const { slug, src, x, y } = JSON.parse(body);
      if (!/^[a-z0-9-]+$/.test(slug) || typeof src !== 'string' || !/^[\w./-]+$/.test(src) || src.includes('..')) throw new Error('bad request');
      const ok = v => typeof v === 'number' && v >= 0 && v <= 100;
      if (x !== null && !(ok(x) && ok(y))) throw new Error('x and y must be 0–100');
      const file = path.join(ROOT, 'data/case-studies', slug + '.json');
      const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
      doc.cursors = doc.cursors || {};
      const before = doc.cursors[src] || null;
      if (x === null) delete doc.cursors[src]; else doc.cursors[src] = [x, y];
      fs.writeFileSync(file, JSON.stringify(doc, null, 1) + '\n');
      fs.appendFileSync(path.join(ROOT, 'edit-log.jsonl'), JSON.stringify({ at: new Date().toISOString(), slug, path: 'cursors[' + src + ']', before, after: x === null ? null : [x, y] }) + '\n');
      res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok');
    } catch (err) { res.writeHead(400, { 'Content-Type': 'text/plain' }); res.end(err.message); }
  });
}

/* POST /__note — adds a new callout to one screen: {slug, base, x, y, dx, dy, text}, where base
   is the JSON path of the screen (the object that holds its src). Appends to its notes list
   (creating it) and answers with the new index, so the page can keep editing it in place. */
function handleNote(req, res) {
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) { res.writeHead(403); return res.end('localhost only'); }
  let body = '';
  req.on('data', c => { body += c; if (body.length > 1e4) req.destroy(); });
  req.on('end', () => {
    try {
      const { slug, base, x, y, dx, dy, text } = JSON.parse(body);
      const num = v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 200;
      if (!/^[a-z0-9-]+$/.test(slug) || typeof base !== 'string' || !/^[\w.]+$/.test(base) || typeof text !== 'string' || text.length > 300 || ![x, y, dx, dy].every(num)) throw new Error('bad request');
      const file = path.join(ROOT, 'data/case-studies', slug + '.json');
      const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
      let o = doc;
      for (const k of base.split('.')) { o = o[k]; if (o === null || typeof o !== 'object') throw new Error('no such screen: ' + base); }
      o.notes = o.notes || [];
      const note = { x, y, text, dx, dy };
      o.notes.push(note);
      fs.writeFileSync(file, JSON.stringify(doc, null, 1) + '\n');
      fs.appendFileSync(path.join(ROOT, 'edit-log.jsonl'), JSON.stringify({ at: new Date().toISOString(), slug, path: base + '.notes[+]', before: null, after: note }) + '\n');
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ i: o.notes.length - 1 }));
    } catch (err) { res.writeHead(400, { 'Content-Type': 'text/plain' }); res.end(err.message); }
  });
}

/* /__tweak — the tweakers' Save button (localhost only). POST {name, values} merges one tweaker's
   values into data/tweaks.json, which build.js bakes in as that visual's defaults; GET returns the file
   so a tweaker opens on what was saved. Names are slugs, values plain numbers/strings/booleans. */
const TWEAKS = path.join(ROOT, 'data', 'tweaks.json');
function handleTweak(req, res) {
  const loop = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  if (!loop) { res.writeHead(403); return res.end('localhost only'); }
  const all = () => { try { return JSON.parse(fs.readFileSync(TWEAKS, 'utf8')); } catch (e) { return {}; } };
  if (req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(all())); }
  let body = '';
  req.on('data', c => { body += c; if (body.length > 2e4) req.destroy(); });
  req.on('end', () => {
    try {
      const { name, values } = JSON.parse(body);
      if (!/^[a-z0-9-]+$/.test(name) || !values || typeof values !== 'object') throw new Error('bad request');
      const clean = {};
      for (const [k, v] of Object.entries(values)) if (/^[a-zA-Z0-9_]+$/.test(k) && ['number', 'string', 'boolean'].includes(typeof v)) clean[k] = v;
      const t = all(); t[name] = clean;
      fs.writeFileSync(TWEAKS, JSON.stringify(t, null, 2) + '\n');
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true }));
    } catch (e) { res.writeHead(400); res.end(String(e.message)); }
  });
}

/* the /__ dev endpoints write her data files, so they answer ONLY her own pages on this machine. The loopback check
   in each handler isn't enough on its own: any website she has open can make HER browser POST here (a text/plain body
   skips the CORS preflight) and DNS rebinding can point a foreign name at 127.0.0.1. So: the Host must be this
   machine, and a browser's Origin / Sec-Fetch-Site (which pages can't forge) must say same-origin. */
const devOnly = req => {
  const host = req.headers.host || '', origin = req.headers.origin, site = req.headers['sec-fetch-site'];
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) return false;
  if (origin && origin !== 'http://' + host) return false;
  if (site && site !== 'same-origin' && site !== 'none') return false;
  return true;
};

http.createServer((req, res) => {
  if (req.url.startsWith('/__') && !devOnly(req)) { res.writeHead(403); return res.end('same-origin only'); }
  if (req.url === '/__tweak' && (req.method === 'POST' || req.method === 'GET')) return handleTweak(req, res);
  if (req.method === 'POST' && req.url === '/__edit') return handleEdit(req, res);
  if (req.method === 'POST' && req.url === '/__cursor') return handleCursor(req, res);
  if (req.method === 'POST' && req.url === '/__note') return handleNote(req, res);
  try {
    let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (urlPath.endsWith('/')) urlPath += 'index.html';
    const file = path.normalize(path.join(DIST, urlPath));
    if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
    const ext = path.extname(file).toLowerCase();

    if (ext === '.html' || urlPath === '/index.html') rebuildIfStale();

    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found');
    }
    const st = fs.statSync(file);
    const etag = `"${st.size}-${st.mtimeMs}"`;
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'ETag': etag,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'max-age=3600, stale-while-revalidate=86400',
      'Accept-Ranges': 'bytes'
    };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); return res.end(); }

    /* Range support (video scrubbing) */
    const range = req.headers.range;
    if (range && /^bytes=/.test(range)) {
      const [a, b] = range.replace('bytes=', '').split('-');
      const start = Number(a) || 0;
      const end = b ? Number(b) : st.size - 1;
      headers['Content-Range'] = `bytes ${start}-${end}/${st.size}`;
      headers['Content-Length'] = end - start + 1;
      res.writeHead(206, headers);
      return fs.createReadStream(file, { start, end }).pipe(res);
    }

    if (COMPRESS.has(ext) && /gzip/.test(req.headers['accept-encoding'] || '')) {
      headers['Content-Encoding'] = 'gzip';
      res.writeHead(200, headers);
      return fs.createReadStream(file).pipe(zlib.createGzip({ level: 6 })).pipe(res);
    }
    headers['Content-Length'] = st.size;
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  } catch (err) {
    console.error(err);
    res.writeHead(500); res.end('Server error');
  }
}).listen(PORT, () => console.log(`Portfolio running at http://localhost:${PORT} (auto-rebuilds on data changes)`));
