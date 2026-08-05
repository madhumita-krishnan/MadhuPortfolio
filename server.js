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

http.createServer((req, res) => {
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
