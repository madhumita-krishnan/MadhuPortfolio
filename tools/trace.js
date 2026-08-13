/* Turn a lifted mask into outlines — the half of "make a font out of my handwriting" that
   has nothing to do with fonts and everything to do with the fact that her letters arrive as
   pixels and a font stores curves.

   Three steps, and each one exists because the step before it leaves a specific artefact:

     1. MARCHING SQUARES gives the boundary between ink and paper. Done on the raw alpha with
        LINEAR INTERPOLATION along each cell edge rather than snapping to pixel corners: the
        lift is anti-aliased, so the exact position of the 50% crossing is real information,
        and using it removes most of the staircase before anything has to smooth it away.
        Snapping instead and smoothing afterwards loses the thin ends of her strokes.

     2. CORNER DETECTION, before any fitting. Her hand has genuine corners — the join of the
        A, the elbow of the k, every pen lift — and a fitter that does not know where they are
        will round them off, which is the single thing that makes traced handwriting stop
        looking like handwriting. Corners are found on a SMOOTHED copy of the boundary so
        pixel noise cannot invent them, then held fixed.

     3. QUADRATIC FITTING between corners, by recursive subdivision. Quadratic because that is
        what TrueType stores natively; fitting cubics and converting doubles the point count
        for nothing. Each span gets one curve if one curve fits, and is split at its worst
        point if not, so simple arcs cost two points and only the complicated places pay.

   Everything is in pixel coordinates with y DOWN, the way the image is. Flipping to font
   coordinates is the caller's job, because only the caller knows where the baseline is. */

/* ---------------------------------------------------------------- marching squares */

/** Sample the alpha at integer pixel centres; outside the image is paper. */
function sampler(mask, w, h) {
  return (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : mask[y * w + x];
}

/** Where between two samples the boundary crosses. Guarded against a zero denominator,
    which happens on a hard-edged mask where both samples are already on the same side. */
const cross = (a, b, t) => (Math.abs(b - a) < 1e-9 ? 0.5 : (t - a) / (b - a));

/** Closed boundary polylines at `t` (0..1), one per connected region and hole.

    The grid runs over CELL CORNERS offset by half a pixel, so a cell's four samples are four
    neighbouring pixel centres and the contour comes out lying between them — which is where
    the edge of a stroke actually is, not on top of a row of pixels.

    Segments are emitted per cell and then chained, rather than walked directly, because
    walking has to make a decision at the ambiguous saddle cases and chaining does not: a
    saddle emits both of its segments and the chain follows whichever one it arrived on. */
function contours(mask, w, h, t = 0.5) {
  const at = sampler(mask, w, h);
  /* key a point by its position on a 1/64 grid so the two ends of a shared edge, computed
     from opposite cells, land on exactly the same key */
  const K = p => Math.round(p[0] * 64) + ',' + Math.round(p[1] * 64);
  const segs = new Map();          // start key -> [start, end]
  const push = (a, b) => {
    if (Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6) return;
    const k = K(a);
    if (!segs.has(k)) segs.set(k, []);
    segs.get(k).push([a, b]);
  };

  for (let y = -1; y < h; y++) {
    for (let x = -1; x < w; x++) {
      const v0 = at(x, y), v1 = at(x + 1, y), v2 = at(x + 1, y + 1), v3 = at(x, y + 1);
      let code = 0;
      if (v0 >= t) code |= 1; if (v1 >= t) code |= 2; if (v2 >= t) code |= 4; if (v3 >= t) code |= 8;
      if (code === 0 || code === 15) continue;
      // crossing points on the four cell edges, in pixel-centre coordinates
      const top = [x + cross(v0, v1, t), y];
      const right = [x + 1, y + cross(v1, v2, t)];
      const bottom = [x + cross(v3, v2, t), y + 1];
      const left = [x, y + cross(v0, v3, t)];
      /* Wound so that ink is on the LEFT of travel; the caller relies on outer boundaries
         and holes coming back with opposite signed areas. */
      switch (code) {
        case 1: push(left, top); break;
        case 2: push(top, right); break;
        case 3: push(left, right); break;
        case 4: push(right, bottom); break;
        case 5: push(left, top); push(right, bottom); break;   // saddle
        case 6: push(top, bottom); break;
        case 7: push(left, bottom); break;
        case 8: push(bottom, left); break;
        case 9: push(bottom, top); break;
        case 10: push(top, right); push(bottom, left); break;  // saddle
        case 11: push(bottom, right); break;
        case 12: push(right, left); break;
        case 13: push(right, top); break;
        case 14: push(top, left); break;
      }
    }
  }

  const out = [];
  while (segs.size) {
    const firstKey = segs.keys().next().value;
    const seg = segs.get(firstKey).pop();
    if (!segs.get(firstKey).length) segs.delete(firstKey);
    const poly = [seg[0], seg[1]];
    for (;;) {
      const k = K(poly[poly.length - 1]);
      const list = segs.get(k);
      if (!list || !list.length) break;
      const nxt = list.pop();
      if (!list.length) segs.delete(k);
      poly.push(nxt[1]);
      if (K(nxt[1]) === K(poly[0])) break;   // closed
    }
    if (poly.length > 3) out.push(poly);
  }
  return out;
}

/* ---------------------------------------------------------------- tidying the boundary */

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Signed area; positive and negative tell an outer boundary from a hole. */
function area(poly) {
  let s = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

/** Drop points closer together than `min`. Marching squares emits a lot of these where the
    boundary skims a cell corner, and they carry no shape — only noise for the corner
    detector to trip over. */
function dedupe(poly, min = 0.18) {
  const out = [poly[0]];
  for (let i = 1; i < poly.length; i++) if (dist(poly[i], out[out.length - 1]) >= min) out.push(poly[i]);
  while (out.length > 3 && dist(out[0], out[out.length - 1]) < min) out.pop();
  return out;
}

/** A closed moving average, used ONLY to decide where the corners are — never to move the
    points that get fitted. Smoothing the real boundary would eat the thin tapered ends where
    her pen lifts; smoothing a copy just makes the turn angles readable. */
function smoothed(poly, passes = 2) {
  let p = poly.map(q => q.slice());
  for (let k = 0; k < passes; k++) {
    const n = p.length, q = new Array(n);
    for (let i = 0; i < n; i++) {
      const a = p[(i - 1 + n) % n], b = p[i], c = p[(i + 1) % n];
      q[i] = [(a[0] + 2 * b[0] + c[0]) / 4, (a[1] + 2 * b[1] + c[1]) / 4];
    }
    p = q;
  }
  return p;
}

/** Indices where the boundary genuinely turns.

    The turn is measured across a WINDOW of `look` points either side rather than between
    immediate neighbours, because at this resolution a neighbour-to-neighbour angle is mostly
    quantisation. A run of consecutive candidates — one real corner will always produce
    several — collapses to the sharpest of the run. */
function corners(poly, { look = 4, limit = 0.72 } = {}) {
  const n = poly.length;
  if (n < look * 3) return [];
  const sm = smoothed(poly);
  const turn = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const a = sm[(i - look + n) % n], b = sm[i], c = sm[(i + look) % n];
    const v1 = [b[0] - a[0], b[1] - a[1]], v2 = [c[0] - b[0], c[1] - b[1]];
    const l1 = Math.hypot(v1[0], v1[1]), l2 = Math.hypot(v2[0], v2[1]);
    if (l1 < 1e-6 || l2 < 1e-6) continue;
    const dot = (v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2);
    turn[i] = Math.acos(Math.max(-1, Math.min(1, dot)));
  }
  const hit = [];
  for (let i = 0; i < n; i++) if (turn[i] >= limit) hit.push(i);
  if (!hit.length) return [];
  // collapse runs (including one that wraps the seam) to their sharpest point
  const keep = [];
  let run = [hit[0]];
  for (let i = 1; i < hit.length; i++) {
    if (hit[i] === hit[i - 1] + 1) run.push(hit[i]);
    else { keep.push(run); run = [hit[i]]; }
  }
  keep.push(run);
  if (keep.length > 1 && keep[0][0] === 0 && keep[keep.length - 1][keep[keep.length - 1].length - 1] === n - 1) {
    keep[0] = keep.pop().concat(keep[0]);
  }
  return keep.map(r => r.reduce((best, i) => (turn[i] > turn[best] ? i : best), r[0]))
    .sort((a, b) => a - b);
}

/* ---------------------------------------------------------------- quadratic fitting */

const qAt = (p0, c, p1, t) => {
  const u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0],
          u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]];
};

/** One quadratic through a span, with the control point placed by least squares.

    Solving for the control point directly is better than the usual trick of intersecting the
    end tangents: end tangents on a traced boundary are noisy, and near-straight spans send
    the intersection off to infinity. With the parameterisation fixed by chord length, the
    control point that minimises squared error has a closed form, which is what this is. */
function fitOne(pts) {
  const p0 = pts[0], p1 = pts[pts.length - 1];
  // chord-length parameterisation
  const u = [0];
  for (let i = 1; i < pts.length; i++) u.push(u[i - 1] + dist(pts[i], pts[i - 1]));
  const total = u[u.length - 1] || 1;
  for (let i = 0; i < u.length; i++) u[i] /= total;
  let num0 = 0, num1 = 0, den = 0;
  for (let i = 0; i < pts.length; i++) {
    const t = u[i], b = 2 * (1 - t) * t;
    const rx = pts[i][0] - ((1 - t) * (1 - t) * p0[0] + t * t * p1[0]);
    const ry = pts[i][1] - ((1 - t) * (1 - t) * p0[1] + t * t * p1[1]);
    num0 += b * rx; num1 += b * ry; den += b * b;
  }
  const c = den < 1e-9 ? [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2] : [num0 / den, num1 / den];
  let err = 0, at = 0;
  for (let i = 0; i < pts.length; i++) {
    const q = qAt(p0, c, p1, u[i]);
    const e = dist(q, pts[i]);
    if (e > err) { err = e; at = i; }
  }
  return { c, err, at };
}

/** Fit a span with as few quadratics as the tolerance allows, splitting at the worst point. */
function fitSpan(pts, tol, depth = 0) {
  if (pts.length < 3) return [{ c: null, p1: pts[pts.length - 1] }];   // a straight line
  const { c, err, at } = fitOne(pts);
  if (err <= tol || depth > 9 || at <= 0 || at >= pts.length - 1) {
    return [{ c, p1: pts[pts.length - 1] }];
  }
  return fitSpan(pts.slice(0, at + 1), tol, depth + 1)
    .concat(fitSpan(pts.slice(at), tol, depth + 1));
}

/** Trace one mask into closed outlines of quadratic segments.

    Returns [{ start:[x,y], segs:[{c:[x,y]|null, p1:[x,y]}], outer:bool }], in pixel
    coordinates with y down. `tol` is the fitting tolerance in pixels — 0.35 is about a
    third of the anti-aliased edge and well under anything visible once the glyph is set at
    reading size.

    Contours shorter than `minLen` are dropped: the lift leaves the odd two-pixel fleck, and
    a stray fleck in a font is a permanent smudge on every page that uses it. */
function outlines(mask, w, h, { t = 0.5, tol = 0.35, minLen = 8 } = {}) {
  return contours(mask, w, h, t).map(dedupe).filter(p => p.length >= minLen).map(poly => {
    const a = area(poly);
    const cs = corners(poly);
    /* No corners at all — a bowl, an o, the inside of a d. Cut it at its extremes anyway so
       the fit has fixed points to work between and cannot drift around the whole loop. */
    let cuts = cs;
    if (cuts.length < 2) {
      let top = 0, bot = 0, lef = 0, rig = 0;
      poly.forEach((p, i) => {
        if (p[1] < poly[top][1]) top = i; if (p[1] > poly[bot][1]) bot = i;
        if (p[0] < poly[lef][0]) lef = i; if (p[0] > poly[rig][0]) rig = i;
      });
      cuts = [...new Set([top, rig, bot, lef])].sort((x, y) => x - y);
    }
    const segs = [];
    for (let i = 0; i < cuts.length; i++) {
      const from = cuts[i], to = cuts[(i + 1) % cuts.length];
      const span = [];
      for (let k = from; ; k = (k + 1) % poly.length) {
        span.push(poly[k]);
        if (k === to) break;
      }
      fitSpan(span, tol).forEach(s => segs.push(s));
    }
    return { start: poly[cuts[0]], segs, outer: a > 0, area: Math.abs(a) };
  });
}

module.exports = { contours, outlines, area, corners };
