#!/usr/bin/env node
/* Generates the hero florals as SVG — assets/hero/flower-*.svg.

   Drawn from Madhu's reference, "color pallete I like.png" in the project root (the
   "Orange & Mellow" candle packaging). Look at that image before editing this file —
   and look at it CLOSE, one bloom at a time. Crop it and zoom; the whole-image view
   hides everything below.

   WHAT THE REFERENCE ACTUALLY DOES, from a zoomed crop of each bloom:
   - Petals are STRAPS, not teardrops. The width comes up fast near the base, then holds
     almost constant for ~80% of the length and rounds off at the tip — and it is very
     slightly WIDER near the tip than at the middle. Roughly 4:1 long-to-wide.
   - The paint is DARKER AT THE EDGE than in the middle (gouache pools against the
     contour), and the interior carries LIGHT lengthwise streaks where the brush ran dry
     and the cream paper shows through. Earlier versions had this backwards — darker
     striations on flat colour — which reads as engraving, not paint.
   - Petals DROOP TOWARD VERTICAL. Each one leaves the stem splayed wide and then bends
     back toward straight down (or straight up, for the bloom rising from the bottom), so
     the tips end up hanging parallel but separated — thin slits of cream between them.
     That separation is the single thing that stops the bloom reading as one solid clump.
   - Scale: a single petal is about a third of the frame and every bloom runs off the
     edge. The crop is the whole effect. See .flora-a/.flora-b widths in build.js — the
     art and the CSS width have to be chosen together.
   - The sage stems are a GRAPHIC ELEMENT, not an attachment: thick, slack, and running
     the full height of the frame past both ends of the bloom.

   Three things do the work of making it look painted rather than vector:
   1. every outline is pushed through feDisplacementMap, so no edge is mathematically
      smooth — that alone is most of the "brush" read;
   2. the dark contour + light dry-brush streaks described above;
   3. a turbulence wash is multiplied over the fill so the colour is uneven, and each
      petal is tinted slightly differently so no two read as the same swatch.

   Re-run after editing SPECS:  node tools/make-flowers.js
*/
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'assets', 'hero');

/* muted, earth-fired rust rather than a bright red — the reference is closer to
   terracotta clay than to vermilion. Keep in step with theme.json. CREAM is the page
   background, and it is what the dry-brush streaks are made of: in the reference those
   streaks are not white paint, they are the paper. */
const RUST = '#A94E2C', RUST_DEEP = '#7E3218', RUST_LIGHT = '#C46A44';
const SAGE = '#9DBAB4', SAGE_DEEP = '#6F918C';
const CREAM = '#F6F0E2';

/* deterministic jitter, so a rebuild doesn't reshuffle the artwork */
let seed = 20260805;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const r2 = n => Math.round(n * 10) / 10;

/* mix two #rrggbb by t, so each petal can sit at its own point on the clay ramp */
function mix(a, b, t) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a), [r2_, g2, b2] = p(b);
  const c = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(r1, r2_)}${c(g1, g2)}${c(b1, b2)}`;
}

/* Width profile across a petal. (1-(2t-1)^6)^(1/3) is a PLATEAU, not a bump: it is past
   0.9 by t=0.1 and stays there until t=0.9, then rounds to zero over the last tenth —
   which is exactly the strap-with-a-round-tip in the reference. The (0.84+0.2t) term
   makes the tip end slightly fuller than the waist, as hers do. Do not swap this back
   for a sine: a sine is widest at the middle and tapers both ways, which is a leaf. */
const widthAt = t => Math.pow(1 - Math.pow(2 * t - 1, 6), 1 / 3) * (0.84 + 0.2 * t);

/* One petal, leaving (x,y) along `angle` (degrees, 90 = straight down) and bending
   `bend` degrees over its length — the bend is what makes it droop back toward vertical.

   Built by walking a curved spine and offsetting perpendicular by widthAt(t), rather
   than from fixed cubic control points: a sampled spine is the only way to get a petal
   that both curves AND keeps a believable width profile along the curve. `lean` makes
   one side fuller than the other, because a real petal is not symmetrical. */
function petal(x, y, angle, len, wid, bend, tone = 0.5) {
  /* N is the spine sample count. Below ~50 the rounded tip comes out visibly faceted —
     the width profile drops from 0.8 to 0 over the last tenth of the length, so a coarse
     walk turns that into three or four straight chamfers and every petal ends in a
     stop-sign. It is the cheapest thing in the file; keep it high. */
  const N = 56, step = len / N;
  const half = wid / 2;
  const L = [], R = [];
  let px = x, py = y, a = angle * Math.PI / 180;
  const dBend = (bend * Math.PI / 180) / N;
  const lean = 0.9 + rnd() * 0.2;
  const spine = [[px, py]];
  for (let i = 1; i <= N; i++) {
    a += dBend;
    px += Math.cos(a) * step;
    py += Math.sin(a) * step;
    spine.push([px, py]);
    const w = half * widthAt(i / N);
    // perpendicular to the current heading
    const nx = -Math.sin(a), ny = Math.cos(a);
    L.push([r2(px + nx * w * lean), r2(py + ny * w * lean)]);
    R.push([r2(px - nx * w * (2 - lean)), r2(py - ny * w * (2 - lean))]);
  }
  // outline: up the left edge, round the tip, back down the right edge
  const d = `M${r2(x)} ${r2(y)}` +
    L.map(p => `L${p[0]} ${p[1]}`).join('') +
    R.slice().reverse().slice(1).map(p => `L${p[0]} ${p[1]}`).join('') + 'Z';

  /* dry-brush streaks: cream, following the spine, so they bend with the petal. `across`
     places each one at its own fraction of the half-width, and they start and stop at
     random points along the length so none of them runs the full petal — a streak that
     reaches both ends reads as a fold, not as a missed patch of paper. */
  const streaks = [];
  const n = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const across = (-0.62 + (i + rnd() * 0.6) * (1.24 / n));
    const i0 = Math.floor(N * (0.06 + rnd() * 0.22));
    const i1 = Math.floor(N * (0.62 + rnd() * 0.30));
    const pts = [];
    for (let k = i0; k <= i1; k += 3) {
      const w = half * widthAt(k / N) * across;
      const [sx, sy] = spine[k];
      const [nx2, ny2] = k < N ? [-(spine[k + 1][1] - sy), spine[k + 1][0] - sx] : [0, 0];
      const m = Math.hypot(nx2, ny2) || 1;
      pts.push(`${r2(sx + nx2 / m * w)} ${r2(sy + ny2 / m * w)}`);
    }
    if (pts.length > 1) {
      const dark = i % 3 === 2;   // one streak in three is a shadow rather than a highlight
      streaks.push(`<path d="M${pts.join('L')}" stroke="${dark ? RUST_DEEP : CREAM}" stroke-width="${r2(half * (0.06 + rnd() * 0.12))}" stroke-linecap="round" fill="none" opacity="${r2((dark ? 0.10 : 0.16) + rnd() * 0.16)}"/>`);
    }
  }

  const fill = tone < 0.5 ? mix(RUST_DEEP, RUST, tone * 2) : mix(RUST, RUST_LIGHT, (tone - 0.5) * 2);
  /* the contour is stroked in the deep clay at low opacity — that is the pooled edge.
     Stroke and fill on the SAME path, so the displacement filter wobbles them together. */
  return `<g><path d="${d}" fill="${fill}" stroke="${RUST_DEEP}" stroke-width="${r2(half * 0.13)}" stroke-opacity=".46" stroke-linejoin="round"/>${streaks.join('')}</g>`;
}

/* A stem: one long, slack curve — the reference stems bend like they carry weight, they
   are THICK, and they run off both ends of the frame. Painted like the petals: a darker
   contour down one side and a cream highlight down the other, so it is a brushstroke
   rather than a pipe. */
function stem(x1, y1, x2, y2, bow, wdt) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
  const nx = -dy / L, ny = dx / L;
  const cx = r2(mx + nx * bow), cy = r2(my + ny * bow);
  const curve = (o = 0) => `M${r2(x1 + nx * o)} ${r2(y1 + ny * o)}Q${r2(cx + nx * o)} ${r2(cy + ny * o)} ${r2(x2 + nx * o)} ${r2(y2 + ny * o)}`;
  return `<g>
    <path d="${curve()}" stroke="${SAGE}" stroke-width="${wdt}" stroke-linecap="round" fill="none"/>
    <path d="${curve(wdt * 0.34)}" stroke="${SAGE_DEEP}" stroke-width="${r2(wdt * 0.22)}" stroke-linecap="round" fill="none" opacity=".5"/>
    <path d="${curve(-wdt * 0.22)}" stroke="${CREAM}" stroke-width="${r2(wdt * 0.16)}" stroke-linecap="round" fill="none" opacity=".28"/>
  </g>`;
}

const defs = `<defs>
  <filter id="brush" x="-12%" y="-12%" width="124%" height="124%">
    <feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves="3" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="wash" x="0%" y="0%" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="3"/>
    <feColorMatrix type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="linear" slope="0.12"/></feComponentTransfer>
  </filter>
</defs>`;

/* the wash is drawn over the flower and clipped to it by re-using the same shapes */
const washOver = (inner, id) => `<g style="mix-blend-mode:multiply" opacity=".5">
    <mask id="m${id}"><g fill="#fff">${inner}</g></mask>
    <rect width="100%" height="100%" filter="url(#wash)" mask="url(#m${id})"/>
  </g>`;

/* Five petals per bloom, ~5.5:1, arranged as an OPEN BELL: they leave the stem clustered
   across 40 degrees and each one bends OUTWARD so the tips finish across 70. The envelope
   therefore widens toward the mouth, and because the angular gap between neighbouring
   tips grows faster than the petals do, cream slits open down the lower half. That flare
   is the difference between her reference and a pinecone.

   Three failed versions are worth not repeating: bending every petal the same way closes
   the bloom into a bud; bending them all back toward plumb (the "droop" reading) packs
   the tips into one solid rust mass with gaps only at the very ends; and opening the tips
   past ~90 degrees total turns the bloom into a palm frond. 70 is the number — her petals
   still overlap each other for the top half of their length.

   The bloom fills its viewBox nearly edge to edge, and is cropped by .hero-flora's
   overflow rather than by the viewBox — a viewBox crop is a dead straight line, and in
   the hero the frame edge does not sit where the section edge does. */
const SPECS = {
  /* hangs from the top of the frame, opening downward — her top-left bloom */
  'flower-a': { w: 700, h: 800, build() {
    const s = [stem(404, -70, 358, 218, 26, 18)];
    /* lengths and tones are deliberately not symmetrical about the centre petal — a
       mirror-symmetric bloom reads as a logo */
    const P = [
      petal(370, 208,  70, 472,  96, -15, 0.30),   // outermost right, flares right
      petal(364, 214,  80, 545, 104,  -8, 0.60),
      petal(358, 216,  90, 575, 110,   0, 0.72),   // the big one, front and centre
      petal(352, 214, 100, 520, 100,   8, 0.45),
      petal(346, 208, 110, 490,  94,  15, 0.25),   // outermost left, flares left
    ];
    return { stems: s.join(''), petals: P.join('') };
  }},
  /* rises from the bottom of the frame, opening upward — her lower bloom */
  'flower-b': { w: 680, h: 780, build() {
    const s = [stem(296, 840, 348, 570, -24, 18)];
    const P = [
      petal(336, 560, 290, 480,  94,  15, 0.28),
      petal(342, 566, 280, 528, 102,   8, 0.58),
      petal(348, 568, 270, 556, 108,   0, 0.70),
      petal(354, 566, 260, 512,  98,  -8, 0.44),
      petal(360, 560, 250, 468,  92, -15, 0.24),
    ];
    return { stems: s.join(''), petals: P.join('') };
  }},
};

fs.mkdirSync(OUT, { recursive: true });
for (const [name, spec] of Object.entries(SPECS)) {
  const { stems, petals } = spec.build();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${spec.w} ${spec.h}" fill="none">
${defs}
<g filter="url(#brush)">
  <g opacity=".92">${stems}</g>
  ${petals}
  ${petals ? washOver(petals, name) : ''}
</g>
</svg>`;
  fs.writeFileSync(path.join(OUT, name + '.svg'), svg);
  console.log(`${name}.svg  ${spec.w}x${spec.h}  ${(svg.length / 1024).toFixed(1)}KB`);
}
