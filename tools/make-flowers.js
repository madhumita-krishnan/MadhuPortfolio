#!/usr/bin/env node
/* Generates the hero florals as SVG — assets/hero/flower-*.svg.

   Drawn from Madhu's reference (the "Orange & Mellow" packaging): long narrow rust
   petals with visible vertical brush striations, hung off pale sage-teal stems that
   curve across a cream field, with a lot of air around them.

   Three things do the work of making it look painted rather than vector:
   1. every outline is pushed through feDisplacementMap, so no edge is mathematically
      smooth — that alone is most of the "brush" read;
   2. each petal carries darker striations at varying opacity, the way gouache pools
      along the drag of a bristle;
   3. a turbulence wash is multiplied over the fill so the colour is uneven.

   Re-run after editing SPECS:  node tools/make-flowers.js
*/
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'assets', 'hero');

/* muted, earth-fired rust rather than a bright red — the reference is closer to
   terracotta clay than to vermilion */
const RUST = '#A94E2C', RUST_DEEP = '#7E3218', SAGE = '#9DBAB4', SAGE_DEEP = '#7E9E98';

/* deterministic jitter, so a rebuild doesn't reshuffle the artwork */
let seed = 20260805;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const jit = a => (rnd() - 0.5) * 2 * a;
const r2 = n => Math.round(n * 10) / 10;

/* One petal, hanging from (x,y) along `angle` (degrees, 90 = straight down).
   Narrow at the attachment, widest around 55% of the way out, tip slightly flared —
   the tulip-ish shape in the reference rather than a symmetrical leaf. */
function petal(x, y, angle, len, wid) {
  const a = angle * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  // local (along, across) → page
  const P = (al, ac) => [r2(x + al * ca - ac * sa), r2(y + al * sa + ac * ca)];
  const w = wid / 2;
  const [bx1, by1] = P(0, -w * 0.22), [bx2, by2] = P(0, w * 0.22);
  const [c1x, c1y] = P(len * 0.22, -w * 1.02);
  const [c2x, c2y] = P(len * 0.74, -w * 1.16);
  const [tx, ty] = P(len * (1 + jit(0.03)), jit(w * 0.16));
  const [c3x, c3y] = P(len * 0.78, w * 1.1);
  const [c4x, c4y] = P(len * 0.24, w * 0.96);
  const d = `M${bx1} ${by1}C${c1x} ${c1y} ${c2x} ${c2y} ${tx} ${ty}C${c3x} ${c3y} ${c4x} ${c4y} ${bx2} ${by2}Z`;

  /* striations: bristle drags, longer and stronger near the middle of the petal */
  const lines = [];
  const n = 4 + Math.floor(rnd() * 2);
  for (let i = 0; i < n; i++) {
    const across = (-0.62 + (i + rnd() * 0.5) * (1.24 / n)) * w;
    const from = len * (0.10 + rnd() * 0.12), to = len * (0.72 + rnd() * 0.22);
    const [sx, sy] = P(from, across * 0.75);
    const [mx, my] = P((from + to) / 2, across * 1.02);
    const [ex, ey] = P(to, across * 0.5);
    lines.push(`<path d="M${sx} ${sy}Q${mx} ${my} ${ex} ${ey}" stroke="${RUST_DEEP}" stroke-width="${r2(w * (0.10 + rnd() * 0.12))}" stroke-linecap="round" fill="none" opacity="${r2(0.14 + rnd() * 0.24)}"/>`);
  }
  return `<g><path d="${d}" fill="${RUST}"/>${lines.join('')}</g>`;
}

/* a stem: one long, slack curve — the reference stems bend like they carry weight */
function stem(x1, y1, x2, y2, bow, wdt) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
  const nx = -dy / L, ny = dx / L;
  return `<path d="M${r2(x1)} ${r2(y1)}Q${r2(mx + nx * bow)} ${r2(my + ny * bow)} ${r2(x2)} ${r2(y2)}"
    stroke="${SAGE}" stroke-width="${wdt}" stroke-linecap="round" fill="none"/>`;
}

const defs = `<defs>
  <filter id="brush" x="-12%" y="-12%" width="124%" height="124%">
    <feTurbulence type="fractalNoise" baseFrequency="0.021" numOctaves="3" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="wash" x="0%" y="0%" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="3"/>
    <feColorMatrix type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="linear" slope="0.14"/></feComponentTransfer>
  </filter>
</defs>`;

/* the wash is drawn over the flower and clipped to it by re-using the same shapes */
const washOver = inner => `<g style="mix-blend-mode:multiply" opacity=".55">
    <mask id="m${seed % 9999}"><g fill="#fff">${inner}</g></mask>
    <rect width="100%" height="100%" filter="url(#wash)" mask="url(#m${seed % 9999})"/>
  </g>`;

/* Petals are ~5:1 long-to-wide and splayed over a wide arc, with air between them.
   The first pass made them 2.5:1 and tightly clustered, which read as a maple leaf. */
const SPECS = {
  /* hangs from the top of the frame, blooming downward — her top-left flower */
  'flower-a': { w: 560, h: 780, build() {
    const s = [];
    s.push(stem(300, -20, 286, 300, 26, 11));
    s.push(stem(300, 250, 168, 780, -84, 8));
    const P = [];
    P.push(petal(292, 250, 118, 372, 82));
    P.push(petal(296, 248, 96, 430, 74));
    P.push(petal(300, 246, 74, 400, 78));
    P.push(petal(288, 254, 142, 300, 66));
    P.push(petal(306, 244, 50, 322, 62));
    return { stems: s.join(''), petals: P.join('') };
  }},
  /* rises from the bottom of the frame, opening upward — her lower flower */
  'flower-b': { w: 520, h: 740, build() {
    const s = [];
    s.push(stem(250, 760, 244, 470, -22, 11));
    s.push(stem(244, 470, 400, 30, 70, 8));
    const P = [];
    P.push(petal(246, 470, 262, 356, 80));
    P.push(petal(250, 472, 284, 418, 72));
    P.push(petal(242, 472, 240, 384, 76));
    P.push(petal(254, 468, 308, 296, 64));
    P.push(petal(238, 474, 216, 314, 60));
    return { stems: s.join(''), petals: P.join('') };
  }},
  /* bare stems, to carry the eye across the space between the two blooms */
  'stem-a': { w: 320, h: 700, build() {
    return { stems: stem(70, -10, 268, 710, 86, 9) + stem(150, 200, 74, 700, -52, 6), petals: '' };
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
  ${petals ? washOver(petals) : ''}
</g>
</svg>`;
  fs.writeFileSync(path.join(OUT, name + '.svg'), svg);
  console.log(`${name}.svg  ${spec.w}x${spec.h}  ${(svg.length / 1024).toFixed(1)}KB`);
}
