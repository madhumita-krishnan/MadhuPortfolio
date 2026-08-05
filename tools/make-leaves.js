#!/usr/bin/env node
/* Generates the hero leaf SVGs from a midrib curve + a width profile.
   Run: node tools/make-leaves.js     → writes assets/hero/leaf-*.svg
   Tune the SPECS below and re-run; the droplet anchors in data/site.json are
   expressed against the same midrib, so the physics follows the drawing. */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'assets', 'hero');

/* ---- bezier helpers ---- */
const B = (p, t) => {
  const u = 1 - t;
  return [
    u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0],
    u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1]
  ];
};
const dB = (p, t) => {
  const u = 1 - t;
  return [
    3 * u * u * (p[1][0] - p[0][0]) + 6 * u * t * (p[2][0] - p[1][0]) + 3 * t * t * (p[3][0] - p[2][0]),
    3 * u * u * (p[1][1] - p[0][1]) + 6 * u * t * (p[2][1] - p[1][1]) + 3 * t * t * (p[3][1] - p[2][1])
  ];
};
const norm = v => { const m = Math.hypot(v[0], v[1]) || 1; return [v[0] / m, v[1] / m]; };
const r2 = n => Math.round(n * 10) / 10;

/* width at t: 0 at the base, swells, tapers to 0 at the tip; notches cut into it */
function widthAt(t, s, side) {
  const shape = Math.pow(Math.sin(Math.PI * Math.pow(t, s.skew)), s.fullness);
  let w = s.maxW * shape * (side < 0 ? s.leftScale : 1);
  w *= 1 + s.wobble * Math.sin(t * s.wobbleFreq * Math.PI * 2 + (side < 0 ? 1.1 : 0));
  for (const c of (s.notches || [])) {
    const d = (t - c) / s.notchWidth;
    w *= 1 - s.notchDepth * Math.exp(-d * d);
  }
  return Math.max(s.minW, w);
}

function edgePath(s, side, N = 220) {
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const b = B(s.mid, t), d = norm(dB(s.mid, t));
    const n = [-d[1] * side, d[0] * side];
    const w = widthAt(t, s, side);
    pts.push([b[0] + n[0] * w, b[1] + n[1] * w]);
  }
  return pts;
}

function leafSVG(s) {
  const right = edgePath(s, 1), left = edgePath(s, -1).reverse();
  const all = right.concat(left);
  const blade = 'M ' + all.map(p => `${r2(p[0])} ${r2(p[1])}`).join(' L ') + ' Z';

  /* fenestration holes, riding along the midrib */
  const holes = (s.holes || []).map(h => {
    const b = B(s.mid, h.t), d = norm(dB(s.mid, h.t));
    const n = [-d[1] * h.side, d[0] * h.side];
    const w = widthAt(h.t, s, h.side);
    const cx = b[0] + n[0] * w * h.out, cy = b[1] + n[1] * w * h.out;
    /* slits run out along the side veins, i.e. across the midrib */
    const ang = Math.atan2(d[1], d[0]) * 180 / Math.PI + 90;
    return `<ellipse cx="${r2(cx)}" cy="${r2(cy)}" rx="${h.rx}" ry="${h.ry}" transform="rotate(${r2(ang)} ${r2(cx)} ${r2(cy)})"/>`;
  }).join('\n    ');

  /* midrib as an explicit cubic */
  const m = s.mid;
  const midrib = `M ${m[0][0]} ${m[0][1]} C ${m[1][0]} ${m[1][1]}, ${m[2][0]} ${m[2][1]}, ${m[3][0]} ${m[3][1]}`;

  /* side veins: midrib → toward the edge, swept to the tip */
  const veins = [];
  for (let i = 1; i <= s.veinCount; i++) {
    const t = s.veinFrom + (s.veinTo - s.veinFrom) * (i / (s.veinCount + 1));
    for (const side of [1, -1]) {
      const b = B(s.mid, t), d = norm(dB(s.mid, t));
      const n = [-d[1] * side, d[0] * side];
      const w = widthAt(t, s, side) * 0.88;
      const tipT = Math.min(1, t + 0.13);
      const bt = B(s.mid, tipT);
      const end = [b[0] + n[0] * w, b[1] + n[1] * w];
      const ctrl = [b[0] + n[0] * w * 0.55 + (bt[0] - b[0]) * 0.5,
                    b[1] + n[1] * w * 0.55 + (bt[1] - b[1]) * 0.5];
      veins.push(`<path d="M ${r2(b[0])} ${r2(b[1])} Q ${r2(ctrl[0])} ${r2(ctrl[1])} ${r2(end[0])} ${r2(end[1])}"/>`);
    }
  }

  const stem = s.stem ? `<path d="${s.stem}" stroke-width="${s.stemW || 9}" fill="none"/>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s.w} ${s.h}" fill="none">
  <defs>
    <linearGradient id="g" x1="0.05" y1="0" x2="0.95" y2="1">
      <stop offset="0" stop-color="${s.c1}"/>
      <stop offset="0.5" stop-color="${s.c2}"/>
      <stop offset="1" stop-color="${s.c3}"/>
    </linearGradient>
  </defs>
  <g stroke="#12352A" stroke-linejoin="round" stroke-linecap="round">
    ${stem}
    <path fill="url(#g)" fill-rule="evenodd" stroke-width="${s.outline}" d="${blade}"/>
    ${holes ? `<g fill="#F2F5EE" stroke-width="${s.outline * 0.72}">\n    ${holes}\n    </g>` : ''}
    <path d="${midrib}" stroke="#0F2E22" stroke-width="${s.ribW}" fill="none" opacity=".88"/>
    <g stroke="#0F2E22" stroke-width="${s.veinW}" opacity=".42" fill="none">
      ${veins.join('\n      ')}
    </g>
  </g>
</svg>
`;
}

const SPECS = {
  /* 1 — monstera: big split blade hanging from the top, tip down-right */
  'leaf-monstera': {
    w: 600, h: 580,
    mid: [[262, 66], [250, 206], [304, 352], [378, 512]],
    maxW: 246, minW: 16, skew: 0.78, fullness: 0.44, leftScale: 0.94,
    wobble: 0.025, wobbleFreq: 3,
    notches: [0.22, 0.36, 0.50, 0.64, 0.78, 0.90], notchDepth: 0.80, notchWidth: 0.024,
    holes: [
      { t: 0.34, side: 1, out: 0.26, rx: 34, ry: 9 },
      { t: 0.51, side: -1, out: 0.24, rx: 30, ry: 8 },
      { t: 0.67, side: 1, out: 0.22, rx: 25, ry: 7 }
    ],
    veinCount: 6, veinFrom: 0.10, veinTo: 0.88,
    stem: 'M 214 8 C 210 28, 210 46, 214 62', stemW: 9,
    outline: 5.5, ribW: 7.5, veinW: 3,
    c1: '#59AC77', c2: '#2F7E51', c3: '#175636'
  },
  /* 2 — alocasia / elephant ear: broad heart, tip to the lower right */
  'leaf-alocasia': {
    w: 600, h: 540,
    mid: [[86, 178], [196, 228], [316, 288], [508, 396]],
    maxW: 158, minW: 3, skew: 0.70, fullness: 0.52, leftScale: 1.06,
    wobble: 0.035, wobbleFreq: 2,
    veinCount: 6, veinFrom: 0.10, veinTo: 0.86,
    stem: 'M 26 118, C 52 142, 72 164, 86 178', stemW: 10,
    outline: 6, ribW: 8, veinW: 3.4,
    c1: '#5FB37E', c2: '#2F7E51', c3: '#175636'
  },
  /* 3 — long philodendron: the perch, tip to the right */
  'leaf-philo': {
    w: 680, h: 280,
    mid: [[62, 124], [206, 104], [388, 126], [612, 176]],
    maxW: 92, minW: 3, skew: 0.66, fullness: 0.55, leftScale: 1.04,
    wobble: 0.04, wobbleFreq: 2.5,
    veinCount: 7, veinFrom: 0.08, veinTo: 0.88,
    stem: 'M 10 100 C 30 110, 48 118, 62 124', stemW: 9,
    outline: 5.5, ribW: 7, veinW: 3,
    c1: '#5FB37E', c2: '#2F7E51', c3: '#175636'
  }
};

for (const [name, spec] of Object.entries(SPECS)) {
  fs.writeFileSync(path.join(OUT, name + '.svg'), leafSVG(spec));
}

/* report the midrib in image fractions, so data/site.json anchors can follow it */
for (const [name, s] of Object.entries(SPECS)) {
  const at = t => { const b = B(s.mid, t); return [Math.round(b[0] / s.w * 1000) / 1000, Math.round(b[1] / s.h * 1000) / 1000]; };
  console.log(name, JSON.stringify({ size: [s.w, s.h], t: [0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95, 1].map(t => [t, at(t)]) }));
}
