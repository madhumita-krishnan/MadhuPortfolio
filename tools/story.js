/* The monkey story: artwork, layout and timeline.

   Kept separate from the renderer so the thing you tune (where the pants sit, how long she
   presses, when a word appears) is readable on its own, and so both the GIF and the still
   poster are built from exactly the same description.

   Coordinates for the warp fields are in the ORIGINAL drawing's pixel space (assets/story/
   drawing.png, 1500×2092) — that way they survive a change of output size.
*/
const path = require('path');
const I = require('./ink');
const G = require('./glyphs');

const STORY = path.join(__dirname, '..', 'story-src');
const read = n => I.read(path.join(STORY, n + '.png'));

/* --------------------------------------------------------------------------- artwork */

/** Cut a text mask into its words, in reading order, so they can be revealed one at a
    time. Reuses the same row/word segmentation that cut her alphabet apart. */
function wordsOfMask(mask, lines) {
  const rows = G.rowsOf(mask, lines.length);
  const out = [];
  rows.forEach((r, ri) => {
    const expect = (lines[ri] || '').split(' ').filter(Boolean);
    for (const b of G.wordsOf(r, expect.length)) {
      out.push({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, ids: new Set(b.ids) });
    }
  });

  /* Row segmentation drops marks below its minimum area, which is right for finding words
     but wrong for drawing them: her apostrophes and full stops are exactly that small, so
     "it's" revealed as "its" and the paragraph lost its last full stop. Give every
     unclaimed speck to the nearest word so it appears when that word does. */
  const comps = (rows[0] && rows[0].comps) || [];
  const claimed = new Set();
  for (const w of out) w.ids.forEach(id => claimed.add(id));
  for (const c of comps) {
    if (claimed.has(c.id) || c.area < 8) continue;
    const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2;
    let best = null, bd = Infinity;
    for (const w of out) {
      const dx = Math.max(w.x0 - cx, 0, cx - w.x1), dy = Math.max(w.y0 - cy, 0, cy - w.y1);
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = w; }
    }
    if (best) best.ids.add(c.id);
  }
  return { rows, words: out, labels: rows[0] && rows[0].labels };
}

/* ---------------------------------------------------------------- standing the drawing up

   She photographed the scene with the tree running down the page: the mother above, the
   baby below her, the trunk vertical along the left edge. Turned 90° anticlockwise it
   becomes a different picture — the trunk is a BRANCH the two of them are sitting along,
   the mother is on the left, and the baby is on its back with its legs in the air. Every
   beat of the animation reads better that way round, and two of them come for free: her
   downward shove becomes a sideways one, and the legs she is fighting with end up on top.

   Everything below is in the turned-and-extended drawing's own pixel space. */
const ROT = { w: 2092, h: 1500 };          // the lift, turned
const EXTEND_LEFT = 200;                   // room the branch is carried out into
const DRAW = { w: ROT.w + EXTEND_LEFT, h: ROT.h };

/** Carry the branch off the left edge of the frame.

    Her branch stops in a ragged tip a little way in from the left, which is fine on a page
    and wrong in a frame — it reads as a stick the monkeys are balanced on rather than a
    branch running out of shot. So a section of the real branch is mirrored and butted onto
    its left end. Mirroring rather than repeating matters: a repeat of a hand-drawn squiggle
    shows up as a pattern immediately, and a mirror joins cleanly because the two halves
    meet on the same cross-section. The ragged tip ends up in the middle of the run, where
    it just reads as a knot. */
function extendBranch(im) {
  /* x 40–240 is clear branch: the mother's tail does not start until x≈280, and copying so
     much as the tip of it puts a mirrored blob out on the left where nothing should be.
     The y band is a second guard on the same thing — the branch is the only ink down here,
     so anything outside the band is by definition not branch. */
  const SRC = { x: 40, w: EXTEND_LEFT, y0: 1000, y1: 1400 };
  const out = { width: DRAW.w, height: DRAW.h, data: Buffer.alloc(DRAW.w * DRAW.h * 4) };
  for (let y = 0; y < im.height; y++) {
    for (let x = 0; x < im.width; x++) {
      out.data[(y * DRAW.w + x + EXTEND_LEFT) * 4 + 3] = im.data[(y * im.width + x) * 4 + 3];
    }
  }
  for (let y = SRC.y0; y < Math.min(SRC.y1, im.height); y++) {
    for (let i = 0; i < SRC.w; i++) {
      const a = im.data[(y * im.width + SRC.x + i) * 4 + 3];   // mirrored about the seam
      if (a) out.data[(y * DRAW.w + (EXTEND_LEFT - 1 - i)) * 4 + 3] = a;
    }
  }
  return out;
}

function artwork() {
  const words = G.wordLibrary(), letters = G.letterLibrary();
  const stealing = G.composeLines(
    ['A monkey stole my', 'pijamas, when I was', 'on a trip to India'],
    { words, letters },
  );
  const paragraph = read('paragraph');
  const notWorking = read('not-working');
  return {
    drawing: extendBranch(I.rotate90ccw(read('drawing'))),
    shirt: read('shirt'),
    pants: read('pants'),
    stealing,
    stealingWords: stealing.words,
    paragraph,
    paragraphWords: wordsOfMask(paragraph, [
      'Looking to make design so',
      'simple that if a monkey stole',
      'my pijamas again, they,d',
      'know how to use them.',
    ]),
    notWorking,
    notWorkingWords: wordsOfMask(notWorking, ["Clearly, it,s not working"]),
  };
}

/* ---------------------------------------------------------------------------- layout */

/* One layout now. The piece has come off the site and is a standalone GIF, so there is no
   phone column to design a second cut for — and turned on its side the drawing is landscape
   anyway, which is the shape the writing wanted all along.

   The whole turned-and-extended drawing is used: the branch runs out of frame on the left
   because that is what the extension is for, and cropping any of it back would undo it. */
const DRAW_CROP = { x: 0, y: 0, w: DRAW.w, h: DRAW.h };

/* The drawing sits in the lower part of the frame with a band of clear paper above it for
   the writing. Its own top-left corner is empty — the mother's head only starts about a
   third of the way down — so the text block can hang down into that corner without ever
   touching her.

   `drawing.x` is 0 on purpose: the branch has to reach the left edge of the FRAME, not
   just the left edge of the artwork. With the full width in shot the mother's centre of
   mass lands at x≈760 of 2352, which is the "about a third of the way across" she asked
   for — it falls out of the extension rather than needing to be dialled in. */
const LAYOUTS = {
  wide: {
    scale: 0.468,                                 // ships at 0.468 of these numbers
    canvas: { w: DRAW.w, h: 1820 },
    drawing: { x: 0, y: 320, h: DRAW.h },
    text: { x: 200, w: 1020, mid: 430 },
  },
};

/* Both labels are placed in DRAWING space, so they keep pointing at the right garment at
   any output size. Her own arrows decide where each one goes, and neither can be turned
   with the drawing — the words have to stay upright, so both were re-placed by hand for
   the new orientation. Both of her arrowheads point LEFT, which means both labels sit to
   the RIGHT of the garment they name: "Shirt" has its arrowhead at the top-left of the
   word, so it sits below and right and points back up; "Pants" has the word on top and the
   arrow curling down-left beneath it, so it sits above and right and points down. */
const LABELS = {
  shirt: { at: { x: 1470, y: 1175 }, w: 400 },
  pants: { at: { x: 1640, y: 300 }, w: 430 },
};

/* ------------------------------------------------------------------------ warp fields */

/* Her drawing is one continuous run of ink — the mother's fingers, the waistband and the
   baby all share strokes. Cutting it into layers and moving them apart tears every line
   that crosses a cut. Instead each moving part is a smooth displacement field with a soft
   elliptical falloff, so the ink stretches rather than breaks and the drawing stays one
   drawing. Nothing is ever separated from anything it was drawn touching.

   Keep the radii tight. Every pixel a field can reach is a pixel that differs from the
   previous frame, and in a GIF of continuously-moving line art that is the whole file
   size — widening these two fields by a third cost a megabyte and did not make the
   animation read any better. */
const FIELDS = {
  /* The mother's forearms, her hands and the waistband move as one: she is shoving the
     pants onto the baby, and what she is shoving has to travel with her.

     `axis` is why this field is not just the old one with its numbers swapped. Turned on
     its side her shove is HORIZONTAL — she braces on the branch and pushes left to right,
     into the baby — so the displacement runs along x. Keeping it on y would have her
     pressing down into the branch she is sitting on, which is the one thing she is not
     doing. The field is kept off her head: a hand-drawn face that stretches stops being a
     face. */
  press: { cx: EXTEND_LEFT + 900, cy: 800, rx: 310, ry: 190, axis: 'x' },
  /* The baby's LEGS, kicking about a pivot down at its hips.

     In the original orientation the moving part was the baby's head and shoulders, which
     after the turn end up at the bottom of the frame — and the bottom half is exactly what
     she does not want moving. Turned, the legs are the top half, they are the part the
     pants are being forced onto, and they are what a baby actually kicks with. So the field
     moved to them rather than being rotated with everything else. */
  wriggle: {
    cx: EXTEND_LEFT + 1120, cy: 470, rx: 340, ry: 260,
    pivot: { x: EXTEND_LEFT + 1100, y: 850 },
  },
};

/* ------------------------------------------------------------------------- the timing */

/* 8fps. This is ink on paper: a loose flipbook rate suits it, and every frame of moving
   line art costs real kilobytes. */
const FPS = 8;


/* One press cycle: she leans on the pants for two seconds, they sink a little and stop
   dead, then she gives up and they spring straight back. The baby rocks throughout at
   two wriggles per two seconds. */
/* 2s leaning on it, then a short release before she tries again — long enough for the
   pants to spring back and be seen springing back, short enough that the rhythm never
   goes dead. */
const CYCLE = 2.8;
const PRESS_SECONDS = 2.0;
const PRESS_DEPTH = 58;             // drawing px
const WRIGGLE_DEGREES = 7.5;

const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** How far down the pants are pushed at time t, and how hard she is leaning. */
function press(t) {
  const p = (t % CYCLE) / CYCLE, hold = PRESS_SECONDS / CYCLE;
  if (p < hold) {
    /* She shoves; they give a little and then refuse. Most of the travel happens in the
       first third of the push and the rest is her straining against something that has
       stopped moving — that stall is the whole gag. */
    const u = p / hold;
    return PRESS_DEPTH * easeOut(Math.min(1, u * 3)) * (1 + 0.03 * Math.sin(u * 34));
  }
  const u = (p - hold) / (1 - hold);              // let go: they spring back and settle
  return PRESS_DEPTH * (1 - easeOut(Math.min(1, u * 2.2))) * Math.cos(u * 9) * Math.exp(-u * 3.2);
}

/** The baby's rock, in degrees. Two full wriggles per two seconds. */
function wriggle(t) {
  return WRIGGLE_DEGREES * Math.sin(t * Math.PI * 2) * (0.85 + 0.15 * Math.sin(t * Math.PI * 0.5));
}

/* -------------------------------------------------------------------------- the story */

/* Each beat reveals its words one at a time, holds, then erases them one at a time.
   `key` names which piece of artwork it draws; `where` picks the text column or a label
   position. Times are seconds from the start of the loop. */
const BEATS = [
  { key: 'stealing', where: 'text', in: 0.4, hold: 1.6, out: 0.9 },
  { key: 'shirt', where: 'shirt', in: 0.5, hold: 1.3, out: 0.5 },
  { key: 'pants', where: 'pants', in: 0.5, hold: 1.3, out: 0.5 },
  { key: 'notWorking', where: 'text', in: 0.9, hold: 1.5, out: 0.7 },
  { key: 'paragraph', where: 'text', in: 2.2, hold: 5.0, out: 0 },   // the last one stays
];
const GAP = 0.35;                                  // breath between beats

/** → [{key, where, t0, tIn, tHold, tOut, t1}] and the total loop length. */
function schedule() {
  const out = [];
  let t = 0;
  for (const b of BEATS) {
    const revealFor = b.in, holdFor = b.hold, eraseFor = b.out;
    out.push({
      ...b, t0: t, tIn: t + revealFor, tHold: t + revealFor + holdFor,
      t1: t + revealFor + holdFor + eraseFor,
    });
    t += revealFor + holdFor + eraseFor + GAP;
  }
  return { beats: out, duration: t - GAP };
}

module.exports = {
  artwork, wordsOfMask, LAYOUTS, LABELS, DRAW_CROP, FIELDS, FPS, CYCLE,
  press, wriggle, schedule, easeInOut,
};
