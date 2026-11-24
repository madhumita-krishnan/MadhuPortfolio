#!/usr/bin/env node
/* THE NEW CASE STUDIES → THE LIVE SITE (her 2026-11-23: "the case study pages arent pushed").
   Her case studies are built in ../case-study-drafts (make-*.py, served on :4191 with a local editor). Vercel only sees this repo, so
   this copies each built draft into case-studies-live/<real url>.html with everything local-only taken out, and copies exactly the
   files those pages use into assets/. build.js puts case-studies-live/*.html into dist/ in place of the old walkthrough pages
   (delete a file there and its old page comes back).
     node tools/ship-drafts.mjs     (after any make-*.py, then  node build.js)
   AI tools is left out on purpose: it stays local until she approves the demos (build.js AI_TOOLS_LIVE). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRAFTS = path.join(ROOT, '..', 'case-study-drafts');
const AP1 = path.join(DRAFTS, 'ap1');                       // the drafts' <base href="ap1/">
const OUT = path.join(ROOT, 'case-studies-live');
const LIVE = 'assets/case-studies/live/';                   // files the site doesn't already have, byte for byte
const MAP = {                                               // real url ← draft (data/review-links.local.json, minus ai-tools)
  'driftwood-retention.html': 'driftwood-top.html', 'spotify-mix.html': 'spotify-top.html', 'vantage.html': 'vantage-top.html',
  'pratus-kitchen.html': 'pratus-kitchen-top.html', 'driftwood.html': 'driftwood-site-top.html', 'stack.html': 'stack-top.html',
  'message-testing.html': 'message-testing-top.html',
};
// ap1's Stack screens are 313px copies of the 780px crops the site already has (make-stack-top.py's ponytail note): use the sharp ones
const PREFER_SITE = ['assets/case-studies/stack/raw/'];

const same = (a, b) => fs.existsSync(b) && fs.statSync(a).size === fs.statSync(b).size && fs.readFileSync(a).equals(fs.readFileSync(b));
let added = 0; const copied = new Map(), unresolved = new Set();
function put(src, rel) {
  const dest = path.join(ROOT, rel);
  if (copied.has(rel) && copied.get(rel) !== src) throw new Error(`two files want ${rel}`);
  if (!copied.has(rel) && !same(src, dest)) { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(src, dest); added += fs.statSync(src).size; }
  copied.set(rel, src);
}
/* cut a local-only piece out; it must be there (a draft that changed shape stops the ship instead of leaking a switch) */
function cut(h, what, label, optional) {
  const n = h.length;
  h = typeof what === 'string' ? h.split(what).join('') : h.replace(what, '');
  if (h.length === n && !optional) throw new Error(`not found: ${label}`);
  return h;
}

fs.mkdirSync(OUT, { recursive: true });
for (const [url, draft] of Object.entries(MAP)) {
  let h = fs.readFileSync(path.join(DRAFTS, draft), 'utf8');

  /* 1 · local-only bits */
  h = cut(h, '<base href="ap1/">\n', 'base');
  h = cut(h, /<script>window\.__SHOTS=[\s\S]*?<\/script>\n?/, '__SHOTS (the local image picker)');
  // the old page's localhost tools inside the walkthrough runtime: Edit text pill, picker, /__edit saves, __checkIcons
  const a = h.indexOf('/* localhost only: click any text to rewrite it.'), b = h.indexOf('/* a #view-x link opens straight into that viewer');
  if (a < 0 || b < a) throw new Error('localhost editor block not found');
  h = h.slice(0, a) + h.slice(b);
  if (/location\.hostname|\/__edit|\/__pe\b|page-editor/.test(h)) throw new Error(`${draft}: localhost code left`);
  // review switches: WHAT SHIPPED (inserted by script), the switch painter, their stacks; the TITLES switch keeps its default (NEW)
  h = cut(h, /<script>\(function\(\)\{var st=document\.querySelector\('\.rv-stack'\)[\s\S]*?<\/script>/, 'WHAT SHIPPED switches');
  h = cut(h, /<script>\(function\(\)\{var h=document\.documentElement;document\.querySelectorAll\('\.rv-sw2'\)[\s\S]*?<\/script>/, 'rv-sw2 painter');
  h = cut(h, '<div class="rv-stack"></div>', 'rv-stack');
  h = cut(h, '<div class="tt-stack"></div>', 'tt-stack', true);
  h = cut(h, /<script>document\.querySelectorAll\('\.tt-sw:not\(\.grn-sw\)'\)[\s\S]*?<\/script>/, 'tt-sw painter', true);
  if (h.includes('<div class="tt-sw" role="group" aria-label="Section title drafts to compare">')) {
    h = h.replace(/(<p class="fw-short[^"]*"[^>]*data-b="([^"]*)"[^>]*>)[^<]*</g, '$1$2<');   // bake NEW, the switch's default
    h = cut(h, /<div class="tt-sw" role="group" aria-label="Section title drafts to compare">[\s\S]*?<\/div>/, 'TITLES switch');
    h = cut(h, /<script>\(function\(\)\{var K='mk-dws-titles'[\s\S]*?<\/script>/, 'TITLES painter');
  }
  if (/class="(rv-sw2?|tt-sw)[" ]/.test(h.replace(/<style[\s\S]*?<\/style>/g, ''))) throw new Error(`${draft}: a review switch is left`);
  h = cut(h, /\/\* DRAFT: a line that is not her words[^*]*\*\/\n?/, 'DRAFT css note', true);
  h = h.replace(/[^{}\n]*\[data-draft\][^{}]*\{[^}]*\}\n?/g, '');
  if (/data-draft|>DRAFT</.test(h)) throw new Error(`${draft}: a DRAFT mark is left`);

  // the picker's file names on her screens (data-src / data-src-path): only the local editor read them
  h = h.replace(/ data-src(-path)?="[^"]*"/g, '');
  /* 2 · links: the local site and the other drafts → the real urls */
  h = h.replace(/http:\/\/localhost:4183\//g, '');
  for (const [u, d] of Object.entries(MAP)) h = h.split('"/' + d).join('"' + u);
  // day/night carries back to the home page (her 2026-11-22 rule), same origin instead of the :4183 port
  h = cut(h, "if(u.port!=='4183')return;", 'look carry');
  h = h.replace("u.searchParams.set('theme'", "if(u.origin!==location.origin||!/\\/(index\\.html)?$/.test(u.pathname))return;u.searchParams.set('theme'");
  { const m = /https?:\/\/(localhost|127\.)|['"]41(83|91)['"]|["'(\/][a-z-]+-top\.html/.exec(h); if (m) throw new Error(`${draft}: a local url is left: ${h.slice(m.index - 80, m.index + 60)}`); }

  /* 3 · every video has a poster: a missing one comes from <name>-poster.jpg beside its mp4 */
  h = h.replace(/<video\b(?![^>]*\bposter=)([^>]*)>(<source src="([^"?]+)\.mp4[^"]*")/g, (m, attrs, src, stem) => {
    const p = stem + '-poster.jpg';
    if (!fs.existsSync(path.resolve(AP1, p))) throw new Error(`${draft}: no poster for ${stem}.mp4`);
    return `<video poster="${p}"${attrs}>${src}`;
  });

  /* 4 · assets: keep what the site already has byte for byte, copy the rest, rewrite those urls; ?v= follows the build */
  h = h.replace(/(["'(=])((?:\.\.\/)*[A-Za-z0-9_][^"'()\s<>]*?\.(?:png|jpe?g|webp|gif|svg|mp4|webm|mov|woff2?|ttf|js|css|json|mp3|wav|m4a|pdf))(\?v=[A-Za-z0-9]+)?(?=["')\s])/g,
    (m, pre, p, v) => {
      if (/^(https?:|data:|\/\/)/.test(p)) return m;
      const abs = path.resolve(AP1, p);
      if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
        if (fs.existsSync(path.join(ROOT, p))) return pre + p + (v ? '?v=__V__' : '');   // the site's own file (was a :4183 url)
        unresolved.add(p); return m; }
      let site;
      if (abs.startsWith(AP1 + path.sep)) {
        site = path.relative(AP1, abs);
        const mine = path.join(ROOT, site);
        if (!fs.existsSync(mine) && site.startsWith('assets/')) put(abs, site);
        else if (!same(abs, mine) && !PREFER_SITE.some(x => site.startsWith(x))) put(abs, site = LIVE + site.replace(/^assets\//, ''));
      } else put(abs, site = LIVE + path.relative(DRAFTS, abs));
      return pre + site + (v ? '?v=__V__' : '');
    });

  /* 5 · Low Power Mode / no autoplay: a touch (scrolling is one) starts any on-screen clip that iOS refused to start */
  h = h.replace('</body>', `<script>addEventListener('touchend',function(){document.querySelectorAll('video[autoplay],.fw-stage video').forEach(function(v){if(!v.paused||v.closest('dialog'))return;var r=v.getBoundingClientRect();if(r.bottom>0&&r.top<innerHeight){var p=v.play();p&&p.catch&&p.catch(function(){})}})},{passive:true});</script>\n</body>`);

  fs.writeFileSync(path.join(OUT, url), h);
  console.log(`${url.padEnd(26)} ← ${draft}  ${(h.length / 1024).toFixed(0)} KB`);
}
console.log(`${copied.size} files the site didn't have, ${(added / 1048576).toFixed(1)} MB written this run`);
console.log('copied into the repo:\n  ' + [...copied.keys()].sort().join('\n  '));
if (unresolved.size) console.log('left as written (built at runtime from a prefix, not files):', [...unresolved].join(' '));
