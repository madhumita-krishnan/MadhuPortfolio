#!/usr/bin/env node
/* Generates the hero florals as SVG — assets/hero/flower-*.svg.

   Drawn from Madhu's reference, "color pallete I like.png" in the project root (the
   "Orange & Mellow" candle packaging). Look at that image before editing this file.

   WHAT THE REFERENCE ACTUALLY DOES, and what the first two attempts got wrong:
   - Petals are BROAD — roughly 2:1 long-to-wide, spatulate, blunt at the tip. The
     previous version made them 5:1 and pointed.
   - Petals DROOP. Each one bends along its length, so the bloom hangs under its own
     weight. The previous version built every petal on a straight axis.
   - Petals hang NEARLY PARALLEL and OVERLAP heavily — a spread of ~35 degrees, not the
     92-degree fan the previous version splayed them over.
   Those three together are why it read as "weird and childish" (hers, 2026-08-05): five
   narrow pointed spikes radiating from one point is a firework, or a maple leaf, not a
   flower. Fixing the width ratio alone is not enough — the droop is what makes it read
   as painted botanical rather than clip art.
   - Scale: in the reference a SINGLE petal is about a third of the frame and every bloom
     runs off the edge. The crop is the whole effect. See .flora-a/.flora-b widths in
     build.js — the art and the CSS width have to be chosen together.

   Three things do the work of making it look painted rather than vector:
   1. every outline is pushed through feDisplacementMap, so no edge is mathematically
      smooth — that alone is most of the "brush" read;
   2. each petal carries darker striations that follow its curved spine, the way gouache
      pools along the drag of a bristle;
   3. a turbulence wash is multiplied over the fill so the colour is uneven, and each
      petal is tinted slightly differently so no two read as the same swatch.

   Re-run after editing SPECS:  node tools/make-flowers.js
*/
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'assets', 'hero');

/* muted, earth-fired rust rather than a bright red — the reference is closer to
   terracotta clay than to vermilion. Keep in step with theme.json. */
const RUST = '#A94E2C', RUST_DEEP = '#7E3218', RUST_LIGHT = '#C46A44';
const SAGE = '#9DBAB4';

/* deterministic jitter, so a rebuild doesn't reshuffle the artwork */
let seed = 20260805;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const jit = a => (rnd() - 0.5) * 2 * a;
const r2 = n => Math.round(n * 10) / 10;

/* mix two #rrggbb by t, so each petal can sit at its own point on the clay ramp */
function mix(a, b, t) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a), [r2_, g2, b2] = p(b);
  const c = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(r1, r2_)}${c(g1, g2)}${c(b1, b2)}`;
}

/* Width profile across a petal: 0 at the base, widest just past the middle, tapering
   toward the tip. Note this reaches ZERO at t=1, which would give a needle point — the
   petal() walk deliberately stops at TIP_T (0.94) and closes the outline flat across the
   remaining ~22% of width, so the tip is BLUNT. Her reference petals are rounded at the
   end; a point is most of what made the old art read as spiky. */
const widthAt = t => Math.pow(Math.sin(Math.PI * Math.pow(t, 0.66)), 0.72);
const TIP_T = 0.94;

/* One petal, hanging from (x,y) heading along `angle` (degrees, 90 = straight down) and
   bending `bend` degrees over its length — positive bend curls it clockwise.

   Built by walking a curved spine and offsetting perpendicular by widthAt(t), rather
   than from fixed cubic control points: a sampled spine is the only way to get a petal
   that both curves AND keeps a believable width profile along the curve. `lean` makes
   one side fuller than the other, because a real petal is not symmetrical. */
function petal(x, y, angle, len, wid, bend, tone = 0.5) {
  const N = 26, step = len / N;
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
    const t = (i / N) * TIP_T;          // stop short of the point → blunt tip
    const w = half * widthAt(t);
    // perpendicular to the current heading
    const nx = -Math.sin(a), ny = Math.cos(a);
    L.push([r2(px + nx * w * lean), r2(py + ny * w * lean)]);
    R.push([r2(px - nx * w * (2 - lean)), r2(py - ny * w * (2 - lean))]);
  }
  // outline: up the left edge, blunt cap across the tip, back down the right edge
  const d = `M${r2(x)} ${r2(y)}` +
    L.map(p => `L${p[0]} ${p[1]}`).join('') +
    `L${R[R.length - 1][0]} ${R[R.length - 1][1]}` +
    R.slice().reverse().slice(1).map(p => `L${p[0]} ${p[1]}`).join('') + 'Z';

  /* striations follow the spine, so they bend with the petal */
  const lines = [];
  const n = 5 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const across = (-0.58 + (i + rnd() * 0.5) * (1.16 / n));
    const i0 = Math.floor(N * (0.08 + rnd() * 0.10));
    const i1 = Math.floor(N * (0.74 + rnd() * 0.22));
    const pts = [];
    for (let k = i0; k <= i1; k += 3) {
      const t = (k / N) * TIP_T, w = half * widthAt(t) * across;
      const [sx, sy] = spine[k];
      const [nx2, ny2] = k < N ? [-(spine[k + 1][1] - sy), spine[k + 1][0] - sx] : [0, 0];
      const m = Math.hypot(nx2, ny2) || 1;
      pts.push(`${r2(sx + nx2 / m * w)} ${r2(sy + ny2 / m * w)}`);
    }
    if (pts.length > 1) {
      lines.push(`<path d="M${pts.join('L')}" stroke="${RUST_DEEP}" stroke-width="${r2(half * (0.07 + rnd() * 0.10))}" stroke-linecap="round" fill="none" opacity="${r2(0.12 + rnd() * 0.22)}"/>`);
    }
  }
  const fill = tone < 0.5 ? mix(RUST_DEEP, RUST, tone * 2) : mix(RUST, RUST_LIGHT, (tone - 0.5) * 2);
  return `<g><path d="${d}" fill="${fill}"/>${lines.join('')}</g>`;
}

/* a stem: one long, slack curve — the reference stems bend like they carry weight, and
   they are THICK. They are a graphic element in their own right, not a hairline. */
function stem(x1, y1, x2, y2, bow, wdt) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
  const nx = -dy / L, ny = dx / L;
  return `<path d="M${r2(x1)} ${r2(y1)}Q${r2(mx + nx * bow)} ${r2(my + ny * bow)} ${r2(x2)} ${r2(y2)}"
    stroke="${SAGE}" stroke-width="${wdt}" stroke-linecap="round" fill="none"/>`;
}

const defs = `<defs>
  <filter id="brush" x="-12%" y="-12%" width="124%" height="124%">
    <feTurbulence type="fractalNoise" baseFrequency="0.016" numOctaves="3" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="8" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="wash" x="0%" y="0%" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="3"/>
    <feColorMatrix type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="linear" slope="0.14"/></feComponentTransfer>
  </filter>
</defs>`;

/* the wash is drawn over the flower and clipped to it by re-using the same shapes */
const washOver = (inner, id) => `<g style="mix-blend-mode:multiply" opacity=".55">
    <mask id="m${id}"><g fill="#fff">${inner}</g></mask>
    <rect width="100%" height="100%" filter="url(#wash)" mask="url(#m${id})"/>
  </g>`;

/* Petals are ~2.7:1 long-to-wide and fan over ~80 degrees, and — the part that matters —
   the bend SPLAYS: petals on the left of the bloom curl further left, petals on the right
   curl right, so the tips separate and cream shows between them. That open bell is what
   the reference has. All bends turning the same way (the first fix) closed the petals into
   a tight bud, which was no better than the spikes. 2.1:1 also still read as chunky; the
   reference is nearer 2.7:1.

   Each bloom deliberately runs past the edge of its own viewBox so it is already cropped
   before the CSS crops it again. */
const SPECS = {
  /* hangs from the top of the frame, drooping open — her top-left bloom.
     Centre of the fan is 90deg (straight down); bend runs +out to -out across it. */
  'flower-a': { w: 560, h: 720, build() {
    const s = [stem(392, -30, 368, 236, 22, 15)];
    const P = [
      petal(372, 214,  56, 322, 116,  40, 0.46),   // right-most, curls out right
      petal(366, 222,  78, 352, 128,  15, 0.86),   // the big one, front and centre
      petal(358, 226, 102, 336, 124, -15, 0.62),
      petal(352, 232, 124, 300, 112, -40, 0.34),   // left-most, curls out left
    ];
    return { stems: s.join(''), petals: P.join('') };
  }},
  /* rises from the bottom of the frame, opening upward — her lower bloom */
  'flower-b': { w: 540, h: 700, build() {
    const s = [stem(196, 730, 216, 456, -20, 15)];
    const P = [
      petal(208, 474, 302, 318, 114, -40, 0.44),
      petal(214, 466, 280, 348, 128, -15, 0.84),
      petal(222, 462, 256, 332, 122,  15, 0.60),
      petal(230, 456, 234, 296, 110,  40, 0.36),
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
