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

/* TAP SHIPS (her 2026-11-25: "I want, like, the tap feature to be on there"; her RULE: "tap needs to be on every single before and after
   widget that I create"). In make-driftwood-top.py TAP is built inside the BA hint lab (HINTLAB=1, local only, cut above), so the live
   page had none. This is the lab's TAP at her decided settings: MIST (her "I like mist"), nothing dims ("No dim for sure"), no glint
   ("skip glimmer"), the default MIST pace, lit 2.9s then calm, starts when a third of the widget is in view, first rings after 0.2s,
   gone once the card is touched. No switches, no TUNE sheet. CSS and timings copied from the lab, 2026-11-25.
   ponytail: a copy of the lab's TAP; when TAP moves out of the lab in the draft source, the guard where it's injected skips this. */
const TAP_SHIP = `<script>/* TAP: the before/after hint (shipped copy of the draft's MIST) */
(function(){var st0=document.querySelector('.ba');if(!st0)return;
var c=document.createElement('style');c.textContent=
'.bh-tap{position:absolute;z-index:4;left:20%;top:80%;width:0;height:0;pointer-events:none}'+
'.bh-tap span{position:absolute;left:0;top:0;transform:translate(-50%,-50%) scale(0);opacity:0}'+
'.bh-tap.on span{animation:bh-pop 1.1s cubic-bezier(.33,.9,.35,1) .25s forwards}'+
'html:not([data-look=dark]) .bh-tap.lit em{opacity:1;color:#0d2a44;text-shadow:0 0 14px rgba(255,255,255,.95)}'+
'html:not([data-look=dark]) .bh-tap.calm em{opacity:.78}'+
'html:not([data-look=dark]) .bh-tap[data-tv=mist]{--tr-col:#15557E;--tr-a:.58;--tr-ta:.28;--tr-blur:2.4px}'+
'.bh-tap em{transition:opacity .9s ease}.bh-tap.lit em{opacity:.95}.bh-tap.calm em{opacity:.42}'+
'.bh-tap.gone{opacity:0;transition:opacity .6s ease}'+
'.bh-tap em{display:block;padding-left:.16em;font:500 11px/1 "Plus Jakarta Sans",system-ui,sans-serif;font-style:normal;letter-spacing:.16em;text-transform:uppercase;white-space:nowrap;color:var(--t-label);opacity:.55}'+
'.bh-tap{--tr-col:var(--t-label);--tr-size:44px;--tr-in:52%;--tr-peak:64%;--tr-tail:72%;--tr-out:80%;--tr-a:.38;--tr-ta:.14;--tr-blur:1.6px;--tr-scale:1.8;--tr-dur:3s;--tr-lo:.1;--tr-turn:9s;--tr-gap:.36s}'+
'html[data-look=dark] .bh-tap{--tr-col:#dbe7ff}'+
'.bh-tap[data-tv=mist]{--tr-size:70px;--tr-in:34%;--tr-peak:58%;--tr-tail:74%;--tr-out:88%;--tr-a:.26;--tr-ta:.16;--tr-blur:3.2px;--tr-scale:1.6;--tr-dur:4s;--tr-lo:.05}'+
'html[data-look=dark] .bh-tap[data-tv=mist]{--tr-a:.34;--tr-ta:.2}'+
'.bh-tap i{position:absolute;left:50%;top:50%;width:var(--tr-size);height:var(--tr-size);margin:calc(var(--tr-size)/-2) 0 0 calc(var(--tr-size)/-2);border-radius:50%;opacity:0;'+
'background:radial-gradient(circle closest-side,transparent var(--tr-in),color-mix(in srgb,var(--tr-col) calc(var(--tr-a)*100%),transparent) var(--tr-peak),color-mix(in srgb,var(--tr-col) calc(var(--tr-ta)*100%),transparent) var(--tr-tail),transparent var(--tr-out));'+
'-webkit-mask:conic-gradient(from var(--ra,20deg),#000,rgba(0,0,0,var(--tr-lo)) 30%,rgba(0,0,0,calc(var(--tr-lo) + .45)) 55%,rgba(0,0,0,var(--tr-lo)) 80%,#000);'+
'mask:conic-gradient(from var(--ra,20deg),#000,rgba(0,0,0,var(--tr-lo)) 30%,rgba(0,0,0,calc(var(--tr-lo) + .45)) 55%,rgba(0,0,0,var(--tr-lo)) 80%,#000);'+
'filter:blur(var(--tr-blur));animation:bh-turn2 var(--tr-turn) linear infinite}'+
'@property --ra{syntax:"<angle>";inherits:false;initial-value:20deg}@keyframes bh-turn2{to{--ra:380deg}}'+
'html[data-look=dark] .bh-tap em{color:#dbe7ff}'+
'@keyframes bh-pop{0%{transform:translate(-50%,-50%) scale(.82);opacity:0}60%{transform:translate(-50%,-50%) scale(1.03);opacity:1}100%{transform:translate(-50%,-50%) scale(1);opacity:1}}'+
'@media (prefers-reduced-motion:x-never){.bh-tap em,.bh-tap i{animation:none}.bh-tap.on span{animation:none;transform:translate(-50%,-50%);opacity:1}.bh-tap i{opacity:.3}}';
document.head.appendChild(c);
var RM=matchMedia('(prefers-reduced-motion:x-never)'),P={n:3,g:320,gm:1.4,d:1800,dm:1.06,s0:.55,c:3900};   // MIST's own pace
document.querySelectorAll('.ba').forEach(function(st){var box=st.querySelector('.ba-box');if(!st.__ba||!box)return;
 var tap=document.createElement('div');tap.className='bh-tap';tap.dataset.tv='mist';tap.setAttribute('aria-hidden','true');tap.innerHTML='<span><i></i><i></i><i></i><em>TAP</em></span>';box.appendChild(tap);
 var touched=false,cyc=0,lt=0;
 function place(){var b=box.getBoundingClientRect(),fr=st.__ba.get().front==='after',F=st.querySelector(fr?'.ba-after .mac-lid':'.ba-before .mac-lid'),B=st.querySelector(fr?'.ba-before .mac-media':'.ba-after .mac-media');if(!F||!B)return;
  var f=F.getBoundingClientRect(),k=B.getBoundingClientRect();tap.style.left=((f.left-b.left)/2).toFixed(1)+'px';tap.style.top=(((k.bottom-b.top)+b.height)/2).toFixed(1)+'px'}
 function ripple(){if(touched||!tap.classList.contains('on')||!tap.animate)return;
  var rs=tap.querySelectorAll('i'),S=parseFloat(getComputedStyle(tap).getPropertyValue('--tr-scale'))||1.6,d=0,g=P.g;
  for(var q=0;q<P.n;q++){var pk=.9*Math.pow(.8,q),kf=[];for(var z=0;z<=14;z++){var t=z/14;kf.push({opacity:+(pk*Math.pow(Math.sin(Math.PI*Math.pow(t,.55)),1.6)).toFixed(3),offset:t})}
   kf[0].transform='scale('+P.s0+')';kf[14].transform='scale('+(S*(1+q*.06)).toFixed(2)+')';rs[q].animate(kf,{duration:P.d*Math.pow(P.dm,q),delay:d,easing:'cubic-bezier(.33,.5,.35,1)'});d+=g;g*=P.gm}
  var em=tap.querySelector('em'),o=getComputedStyle(em).opacity;em.animate([{transform:'scale(1)',opacity:o},{transform:'scale(.95)',opacity:1,offset:.3},{transform:'scale(1)',opacity:o}],{duration:1800,easing:'cubic-bezier(.45,0,.55,1)'});
  cyc=setTimeout(ripple,P.c)}
 function stop(){clearTimeout(cyc);clearTimeout(lt);tap.classList.remove('on','lit')}
 function start(){stop();if(touched)return;place();tap.classList.add('on');
  if(RM.matches){tap.classList.add('calm');return}
  cyc=setTimeout(ripple,200);tap.classList.add('lit');lt=setTimeout(function(){tap.classList.remove('lit');tap.classList.add('calm')},2900)}
 addEventListener('resize',place);
 st.addEventListener('ba-touch',function(){touched=true;clearTimeout(cyc);clearTimeout(lt);tap.classList.add('gone')});
 new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)start();else stop()})},{threshold:.3}).observe(st)})})();
</script>`;

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
  h = cut(h, /<script>\/\* PHONE-DS review switch[\s\S]*?<\/script>\n?/, 'PHONE switch (local review of the phone design system)', true);   // retired on every draft 2026-11-24 (HERS kept)
  h = cut(h, /<script>\/\* BA hint lab[\s\S]*?<\/script>\n?/, 'BA hint lab (local only)', true);
  // TAP lives inside that lab in the drafts, so without this the before/after widgets would ship with no TAP (see TAP_SHIP)
  if (/class="[^"]*\bba\b[^"]*"/.test(h) && h.includes('st.__ba=') && !h.includes("className='bh-tap'")) h = h.replace('</body>', TAP_SHIP + '\n</body>');
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
