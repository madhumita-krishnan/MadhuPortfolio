#!/usr/bin/env node
/* Daily site health check — no dependencies, Node 18+.
 *
 *   node tools/site-check.js            build + content + live-site checks
 *   node tools/site-check.js --offline  skip the live-site checks (local dev)
 *
 * Exits non-zero if anything fails, so CI turns red and sends an alert.
 * The site is fully static (data/*.json → build.js → dist/) served by Vercel;
 * these checks cover the whole chain: content parses, build succeeds, the
 * generated JS is at least syntactically loadable, no page references a file
 * that does not exist, and the LIVE domain actually serves every page.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const LIVE = 'https://www.m--k.me';
const offline = process.argv.includes('--offline');

const failures = [];
const ok = (m) => console.log('  ✓ ' + m);
const fail = (m) => { failures.push(m); console.error('  ✗ ' + m); };
const section = (m) => console.log('\n' + m);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    e.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}

/* 1 — every content file parses. This is "the database": data/*.json holds
   all of the site's info; a malformed edit here is the one way content can
   take the build down, so it is checked first and reported by name. */
section('content (data/*.json)');
const dataFiles = walk(path.join(ROOT, 'data')).filter((f) => f.endsWith('.json'));
for (const f of dataFiles) {
  const rel = path.relative(ROOT, f);
  try { JSON.parse(fs.readFileSync(f, 'utf8')); ok(rel); }
  catch (e) { fail(rel + ' is not valid JSON — ' + e.message); }
}
if (!dataFiles.length) fail('no data/*.json files found at all');

/* 2 — the site builds from scratch */
section('build (node build.js)');
try {
  cp.execSync('node build.js', { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  ok('build.js completed');
} catch (e) {
  fail('build.js crashed — ' + String(e.stderr || e.message).slice(0, 400));
}

/* 3 — generated JS parses as JavaScript (a stray syntax error in app.js or
   stick.js kills every script on the page at parse time) */
section('generated JS syntax');
if (fs.existsSync(DIST)) {
  for (const f of walk(DIST).filter((f) => f.endsWith('.js'))) {
    const rel = path.relative(DIST, f);
    try { cp.execSync('node --check ' + JSON.stringify(f), { stdio: 'pipe' }); ok(rel); }
    catch (e) { fail(rel + ' has a syntax error — ' + String(e.stderr).slice(0, 300)); }
  }
} else fail('dist/ missing after build');

/* 4 — no page references an internal file that does not exist */
section('internal links & assets');
if (fs.existsSync(DIST)) {
  const htmls = walk(DIST).filter((f) => f.endsWith('.html'));
  let refs = 0, broken = 0;
  for (const f of htmls) {
    const html = fs.readFileSync(f, 'utf8');
    const rel = path.relative(DIST, f);
    for (const m of html.matchAll(/(?:src|href|poster)\s*=\s*["']([^"']+)["']/g)) {
      const url = m[1];
      if (/^(https?:|mailto:|tel:|data:|#|javascript:)/i.test(url)) continue;
      const clean = url.split(/[?#]/)[0];
      if (!clean) continue;
      const target = clean.startsWith('/')
        ? path.join(DIST, clean)
        : path.join(path.dirname(f), clean);
      refs++;
      if (!fs.existsSync(target)) { broken++; fail(rel + ' references missing file: ' + url); }
    }
  }
  if (!broken) ok(refs + ' internal references across ' + htmls.length + ' pages all resolve');
}

/* 5 — the LIVE site serves every page (catches exactly the class of failure
   from 2026-08-18, when Vercel ran app.js server-side and 500'd site-wide) */
async function live() {
  section('live site (' + LIVE + ')');
  const pages = fs.existsSync(DIST)
    ? walk(DIST).filter((f) => f.endsWith('.html')).map((f) => '/' + path.relative(DIST, f).replace(/\\/g, '/'))
    : ['/index.html'];
  const targets = ['/', ...pages.filter((p) => p !== '/index.html'), '/app.js', '/styles.css']
    .filter((p, i, a) => a.indexOf(p) === i);
  for (const p of targets) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 20000);
      const res = await fetch(LIVE + p, { redirect: 'follow', signal: ctl.signal });
      clearTimeout(t);
      const vercelError = res.headers.get('x-vercel-error');
      if (res.status !== 200) fail(p + ' → HTTP ' + res.status + (vercelError ? ' (' + vercelError + ')' : ''));
      else if (vercelError) fail(p + ' → 200 but x-vercel-error: ' + vercelError);
      else ok(p + ' → 200');
      if (p === '/') {
        const body = await res.text();
        if (!/Madhu/.test(body)) fail('homepage body does not look like the portfolio (no "Madhu" found)');
        else ok('homepage content sanity');
      }
    } catch (e) {
      fail(p + ' → fetch failed: ' + e.message);
    }
  }
}

(async () => {
  if (!offline) await live();
  else section('live site: skipped (--offline)');
  console.log('');
  if (failures.length) {
    console.error('FAILED — ' + failures.length + ' problem(s):');
    for (const f of failures) console.error('  • ' + f);
    process.exit(1);
  }
  console.log('ALL CHECKS PASSED');
})();
