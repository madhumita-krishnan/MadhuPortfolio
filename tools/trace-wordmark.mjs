/* Bakes the corner logo's goo into plain shapes: data/wordmark-paths.json.
   Why (her 2026-10-27: "the logo in the corner needs to be the same as well across devices and the logo motion in the
   corner needs to be the same across devices"): Safari paints an SVG goo filter at one buffer pixel per CSS pixel, so at
   the logo's ~23px it came out soft and blocky on every iPhone and in Mac Safari, while Chrome was crisp. Measured edge
   softness at 2x: Chrome .034, Safari .186. Shapes have no filter, so every browser draws them the same, at any density.

   How: the live goo logo (wordmark.js liveSVG, her loader study's numbers) is rendered in Chrome at 16 pixels per unit,
   once whole and once per piece; each picture is traced to an outline. The M and K are their own goo; the strand gets
   its own goo PLUS every bit of the whole that neither letter covers (the gooey joins), so the three pieces together are
   exactly the whole at rest, and still slide, fold and pop separately (the hover, greeting and pop are unchanged).

   Run after changing the goo numbers in data/loader.json, with the site served on :4174 (for her face, Plus Jakarta Sans):
     node tools/trace-wordmark.mjs
   Needs Google Chrome; uses the loadability skill's small CDP driver. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), here = path.dirname(fileURLToPath(import.meta.url));
const { launch, client, sleep } = await import(process.env.HOME + '/.claude/skills/loadability/scripts/cdp.mjs');
const { decode } = require('./png.js');
const { liveSVG, VIEW } = require('../wordmark.js');

const K = 16, [vx, vy, vw, vh] = VIEW, W = Math.round(vw * K), H = Math.round(vh * K);
const { proc, ws } = await launch(); const c = await client(ws);
await c.send('Page.enable');
await c.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await c.send('Page.navigate', { url: process.env.BASE || 'http://127.0.0.1:4174/driftwood.html' }); await sleep(2500);
await c.evaluate(`document.fonts.load('600 100px "Plus Jakarta Sans"').then(() => document.fonts.check('600 100px "Plus Jakarta Sans"'))`) || (console.error('her face did not load'), process.exit(1));

/* one picture: white goo on black, only the pieces asked for */
async function shot(show) {
  await c.evaluate(`(() => { document.body.innerHTML = ${JSON.stringify(liveSVG('trace'))};
    document.documentElement.style.cssText = 'background:#000'; document.body.style.cssText = 'margin:0;background:#000;color:#fff';
    const s = document.querySelector('svg'); s.setAttribute('width', ${W}); s.setAttribute('height', ${H}); s.style.cssText = 'display:block;position:fixed;left:0;top:0;z-index:2147483647;margin:0;width:${W}px;height:${H}px;color:#fff;overflow:hidden';
    for (const k of ['wm-m', 'wm-d', 'wm-k']) s.querySelectorAll('g[filter] .' + k).forEach(e => e.style.display = ${JSON.stringify(show)}.includes(k) ? '' : 'none');
    return 1; })()`);
  await sleep(150);
  const r = await c.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
  const im = decode(Buffer.from(r.result.data, 'base64')), ch = im.data.length / (im.width * im.height), b = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) b[i] = im.data[i * ch] > 127 ? 1 : 0;
  return b;
}
const U = await shot(['wm-m', 'wm-d', 'wm-k']), Mb = await shot(['wm-m']), Kb = await shot(['wm-k']), Sb = await shot(['wm-d']);
c.close(); proc.kill();
/* the strand piece: its own goo, plus the joins. "The whole minus both letters" also leaves hairlines along the letters'
   edges (a few pixels at 16x); those are dropped (opened away, then only what touches the strand is kept), or they rode
   along with the strand when it folds on hover and stretched its box across the whole logo */
const morph = (b, r, grow) => { let cur = b; for (const [sx, sy] of [[1, 0], [0, 1]]) { const n = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = grow ? 0 : 1;
    for (let t = -r; t <= r; t++) { const xx = x + t * sx, yy = y + t * sy, o = xx >= 0 && yy >= 0 && xx < W && yy < H ? cur[yy * W + xx] : 0; v = grow ? v | o : v & o; }
    n[y * W + x] = v; } cur = n; } return cur; };
const extra = morph(morph(U.map((v, i) => v && !Mb[i] && !Kb[i] ? 1 : 0), 3, false), 3, true);
const Db = new Uint8Array(W * H), stack = [];
for (let i = 0; i < W * H; i++) if (Sb[i]) { Db[i] = 1; stack.push(i); }
while (stack.length) { const i = stack.pop(), x = i % W, y = (i / W) | 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy, j = yy * W + xx;
    if (xx >= 0 && yy >= 0 && xx < W && yy < H && !Db[j] && extra[j]) { Db[j] = 1; stack.push(j); } } }
/* and it reaches 1.5 units in UNDER each letter: pieces that only touch show a hairline seam at the join (each edge is
   blended with the background on its own), seen on the iPhone. Hidden under the letters, so the logo looks the same */
const under = morph(Db, 24, true);
for (let i = 0; i < W * H; i++) if (under[i] && (Mb[i] || Kb[i])) Db[i] = 1;

/* outline of a 0/1 picture: every pixel edge between ink and not, ink kept on the left, chained into loops, then thinned
   (Ramer-Douglas-Peucker, 1.5 pixels at 16x: a 40th of a CSS pixel in the nav) */
function trace(b) {
  const at = (x, y) => x >= 0 && y >= 0 && x < W && y < H && b[y * W + x];
  const out = new Map(), key = (x, y) => y * (W + 1) + x, add = (x0, y0, x1, y1) => { const k = key(x0, y0); (out.get(k) || out.set(k, []).get(k)).push([x1, y1]); };
  for (let y = 0; y <= H; y++) for (let x = 0; x <= W; x++) {
    if (at(x, y) !== at(x, y - 1)) at(x, y) ? add(x + 1, y, x, y) : add(x, y, x + 1, y);           // horizontal edge above pixel (x,y)
    if (at(x, y) !== at(x - 1, y)) at(x, y) ? add(x, y, x, y + 1) : add(x, y + 1, x, y);           // vertical edge left of pixel (x,y)
  }
  const loops = [];
  for (const [k0, list] of out) while (list.length) {
    let [x, y] = [k0 % (W + 1), Math.floor(k0 / (W + 1))]; const pts = [[x, y]]; let px = x, py = y;
    for (;;) { const l = out.get(key(x, y)); if (!l || !l.length) break;
      const dx = x - px, dy = y - py; let j = 0;
      if (l.length > 1) j = l.findIndex(([nx, ny]) => (nx - x) === dy && (ny - y) === -dx) >= 0 ? l.findIndex(([nx, ny]) => (nx - x) === dy && (ny - y) === -dx) : 0;   // saddle: keep diagonal pixels apart
      const [nx, ny] = l.splice(j, 1)[0]; px = x; py = y; x = nx; y = ny; pts.push([x, y]); if (key(x, y) === k0 && !out.get(k0).length) break; }
    /* a closed loop starts and ends on one point: split it at the point farthest from there, thin each half */
    let far = 0, fd = -1; pts.forEach(([qx, qy], i) => { const dd = (qx - pts[0][0]) ** 2 + (qy - pts[0][1]) ** 2; if (dd > fd) { fd = dd; far = i; } });
    loops.push(rdp(pts.slice(0, far + 1), 1.5).slice(0, -1).concat(rdp(pts.slice(far), 1.5)));
  }
  return loops.filter(l => l.length > 3);
}
function rdp(p, eps) {
  if (p.length < 3) return p;
  const [a, b] = [p[0], p[p.length - 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; let m = 0, mi = 0;
  for (let i = 1; i < p.length - 1; i++) { const d = Math.abs((b[0] - a[0]) * (a[1] - p[i][1]) - (a[0] - p[i][0]) * (b[1] - a[1])) / L; if (d > m) { m = d; mi = i; } }
  return m > eps ? rdp(p.slice(0, mi + 1), eps).slice(0, -1).concat(rdp(p.slice(mi), eps)) : [a, b];
}
const d = b => trace(b).map(l => 'M' + l.map(([x, y]) => +(vx + x / K).toFixed(1) + ' ' + +(vy + y / K).toFixed(1)).join('L') + 'Z').join('');
const res = { _note: 'Generated by tools/trace-wordmark.mjs from the live goo logo (wordmark.js liveSVG + data/loader.json). Do not edit by hand; re-run the tool.', viewBox: VIEW, m: d(Mb), d: d(Db), k: d(Kb) };
fs.writeFileSync(path.join(here, '../data/wordmark-paths.json'), JSON.stringify(res, null, 1) + '\n');
console.log('wrote data/wordmark-paths.json', Object.fromEntries(['m', 'd', 'k'].map(k => [k, res[k].length + ' chars'])));
