# Madhu's portfolio

Fast by construction: all content lives in JSON data files, a zero-dependency build
step compiles them to flat static HTML, and a tiny Node server serves the result with
compression and caching. Iterating on the design never makes the site slower, because
the output is always plain static files.

## Daily workflow

```bash
npm run dev        # build + serve at http://localhost:4173
```

Then edit any file in `data/` and refresh the browser — the server rebuilds
automatically when it sees a change. No bundler, no dependencies, nothing to install.

## Where everything lives

| File | What it controls |
|---|---|
| `data/theme.json` | **Every design token** — colors, glass effect, fonts, radii, motion. Change the whole theme here. |
| `data/site.json` | Home page content: hero copy, brand logos (`brands.logos`), project cards (order = array order), disciplines, about, footer. |
| `data/case-studies/*.json` | One file per case study. `order` controls home-page order; `sections` is a list of label/heading/body blocks with optional `media`, `quote`, or `compare` (before/after table). |
| `assets/` | Optimized images & videos. Videos are compressed MP4s with poster frames; keep new ones under ~5 MB where possible. |
| `build.js` | The generator (HTML/CSS/JS templates). Only touch for layout/structure changes. |
| `server.js` | Local/production server: gzip, ETags, video range requests, auto-rebuild in dev. |
| `dist/` | Generated output. Never edit by hand — deploy this folder anywhere static (Netlify, Vercel, GitHub Pages). |

## Adding a fifth project

1. Drop optimized media into `assets/case-studies/<slug>/`.
2. Create `data/case-studies/<slug>.json` (copy `driftwood.json` as a template).
3. Add a card to `work.projects` in `data/site.json` with the same slug.
4. `npm run build`.

## Why it stays fast

- Videos never download until needed: `preload="none"`, poster images, play on
  hover/in-view, pause off-screen.
- One shared CSS file generated from theme tokens; cache-busted per build (`?v=`).
- All images have width/height or aspect-ratio (no layout shift), `loading="lazy"`.
- Respects `prefers-reduced-motion`, plus a fail-safe that forces all content visible
  even if animations never run.
- QA trick: append `?shot=1200` to any page URL to render it scrolled 1200px with all
  reveal-animations completed and lazy media force-loaded.

## Typography rule

**Never one word alone on the last line.** Every string rendered on the site goes through
`typo()` in `build.js`, which escapes it and ties the last two words together in a
`<span class="nw">`. Use `typo()` — not `esc()` — for any new prose; `esc()` is only for
attributes and single words. `text-wrap:pretty` handles the rest.

## The hero

Cream page, copy stepped in from the left, and one of her painted blooms hanging off each
screen edge — the composition of her `color pallete I like.png` reference. Eyebrow, headline,
one sentence, two buttons, then a masked logo wall below.

Two ~500px blooms plus a 640px copy is more than a 1440px page holds, so the copy overlaps
the art by design (*"its ok if things overlap — that looks good as long as its readable"*).
The offsets exist to land that overlap on thin splayed petal tips and keep the solid middle of
each flower off the edge. The blooms retreat further as the page narrows, because a section
caps at 1240px: above that the auto margins keep pushing the copy inboard while the blooms
keep growing with `vw`, below it they close on the copy instead. Watch the rust eyebrow in
particular — rust type on a rust petal is the one pairing on this site with no contrast at all.

Dead ends still on disk, referenced by nothing: `tools/make-leaves.js`, `tools/make-flowers.js`
and `tools/make-hero-flower.js`, with their output in `assets/hero/`. The scroll-driven
droplet/leaf/frog story went on 2026-08-03; the drawn florals that replaced it went on
2026-08-05 — see below, and don't redraw them.

The sentence is **Madhu's own handwriting, and since 2026-08-07 it is real text set in a
real typeface** — `assets/fonts/madhu-hand.woff`, built out of her own sheets by
`tools/make-hand-font.js` (+ `trace.js`, `ttf.js`). It is no longer a CSS mask, so the copy
lives in `data/site.json` -> `hero.lines` and reflows like any other paragraph; changing the
wording no longer needs her to write anything out. **Everything below about masks, about
`set-hero-line.js`, and about there being no font tooling on this machine is history** —
kept because it is the record of how the sheets were cut, not because it is still wired in.

The font has **no digits and no dashes**, because she has never written any: a missing
character comes out as a gap, not a tofu box. So hero copy has to spell its numbers
("one client to four"), and any figure that has to appear as a numeral belongs in the
body copy, which is set in DM Sans.

Run `node tools/make-hand-font.js --proof --glyphs --audit` after any change to it. The
audit answers "does any letter have a gap in it" by counting islands of ink per glyph and
measuring the narrowest place each one passes through — a question an eye cannot answer at
reading size, where a hairline join and a two-pixel skip look identical.

**Changing the wording**: `tools/set-hero-line.js` re-flows the four written lines from
`hero-line-handwritten-4line.png` (the untouched cut) into a new sentence, reusing the
words she has already written and building only the ones she has not. Edit `SOURCE` and
`TARGET` at the top of that file, run it, and paste the aspect-ratio it prints into
`.hero-line` in `build.js`. Two things to know first:

- A word that has to be built should be built out of her WRITING, not the alphabet sheet —
  `LETTER_SOURCES` names the word each letter is cut from. The sheet block was lifted soft
  (its fringe outnumbers its solid core four to one) and she draws isolated letters bigger
  and lighter than the same letters inside a word, so letters taken from it land oversized
  and spindly next to her real ones. The tool will still fall back to the sheet and
  normalise it, but a cut from her writing is always better.
- **Look at the cut before trusting it**: `node tools/set-hero-line.js --letters` writes a
  contact sheet of every letter it will stamp. A split in the wrong place puts a visibly
  wrong letter in her handwriting and only the eye catches it — her `o` comes away as an
  open arch from most words and only really closes in "workflows".

If she photographs a sentence outright, prefer that over any of this. A straight lift beats
a composite every time.

### The flowers are cut out of her reference, not drawn

**Do not generate flower art for this site.** Several attempts drew blooms from a written
description of Madhu's reference and she rejected every one, most bluntly: *"you keep re
making the flowers. i need use the literal flowers from the picture as is."* The hero art is
now cut out of `color pallete I like.png` pixel-for-pixel by `node tools/lift-flowers.js`,
which writes `assets/hero/bloom-left.png` and `bloom-right.png`. If the art needs to change,
move the crop rectangles in `CUTS` — do not reach for a drawing tool.

Four things in that script are load-bearing, each one a build that looked wrong first:

1. **Key, don't threshold.** The paper is exactly `#F5EAD3` and every petal edge is a soft
   brush blend into it. A hard threshold gives a jagged sticker outline; alpha instead ramps
   over a colour-distance window so a brush edge stays a brush edge.
2. **Unpremultiply.** An edge pixel is `C = a*ink + (1-a)*paper`. Ship it as-is and every
   bloom carries a ring of the original cream. Solving back for `F = (C - (1-a)*paper)/a`
   gives straight alpha that composites over anything.
3. **Re-crisp after upscaling.** The source bloom is ~260px wide and the hero runs it off the
   screen edge, so it grows 3x. Resampling on *premultiplied* values avoids a dark halo, and
   steepening the alpha ramp afterwards wins back the sharp silhouette. Sharp edge with a
   soft interior is what reads as paint; soften both and it reads as a blurry JPEG.
4. **Drop the orphans.** A rectangular cut always clips through a neighbouring stem, and a
   stem with no flower on the end of it reads as a scratch across the copy. Anything under
   18% of the biggest blob in the cut is dropped — not "keep the largest blob", because the
   top-left bloom is painted as two petal masses that never quite touch.

`bg-base` in `data/theme.json` must stay equal to that paper colour. The cream showing
through the gaps inside a petal *is the page*, so if the token drifts, every gap turns into a
visible patch. Same reason the blooms carry `?v=` — the art regenerates in place, and without
a version she keeps being served the previous bloom out of cache while judging the new one.

The hero is `min-height:100vh` on purpose: `.hero-flora` is a 100vw box that clips its blooms
at the screen edge, and at any shorter height that clip lands as a visible horizontal line
partway up the page instead of on the fold.

Weight matters because both PNGs load eagerly above the fold. Unpremultiplying leaves
amplified colour noise in pixels that are 2% opaque, and full 8-bit colour keeps gradations
no eye can see at 82% opacity — so `slim()` flattens the invisible pixels and quantises to 64
levels per channel. With the adaptive row filtering added to `tools/png.js` at the same time,
the pair went from 2.4MB to 734KB with no visible change to the brushwork.

### No decorative gradients

Her instruction: *"dont use gradients — think more paint strokes texture."* The `.atmosphere`
layer and every case-study panel used to be shaded from corner to corner. They are now flat
palette tokens with her own brush swatch masked over them — `node tools/make-paint-wash.js`
turns `paint strokes texture.png` into `assets/hero/paint-wash.png`, subtracting the swatch's
own top-to-bottom shading (it is itself a gradient) and mirror-quilting it so it tiles
seamlessly. The PNG is alpha-only; the colour comes from a token painted through it, so retune
the wash by editing `--accent-wash`, never the file.

Gradients that survive are materials, not decoration: the light caught on the glass rim, the
titanium phone rail, the screen dots, the browser chrome — and `.panel::after`, which is the
scrim that keeps cream type legible over an arbitrary photograph.

### Superseded: the flower photograph

Kept because the `bloom` design-system snapshot still restores it. Not in the current build.

The photograph is `hero-src/flower.jpg` — kept out of `assets/` on purpose, because build.js
copies `assets/` into `dist/` wholesale and the untouched 122KB original would ship to Pages
on every deploy for nothing. `node tools/make-hero-flower.js` turns it into
`assets/hero/hero-flower.jpg`, the crop that is actually used.

The picture is 736x920 and the hero is much wider, so the page paints the red itself
(`.hero-band`) and the crop is dissolved into it. Four things have to agree for that to be
invisible, and getting three of them right still leaves a visible rectangle — each one below
was a build that looked wrong:

1. **Colour at the rim.** The outer ring of the crop is graded to one flat colour, the
   `field` token, read out of `data/theme.json` by the script so the two cannot drift.
   Compositing a pixel over an identical colour is a no-op, so the boundary stops existing.
2. **Level across the whole crop, not just the rim.** The photo is vignetted, so even a
   perfect rim leaves the ground *inside* darker than the field it lies on. The script
   estimates the lit felt under every pixel and subtracts it. The estimate takes a high
   percentile of each block rather than a median, so the cast shadow survives instead of
   being flattened away as if it were ground.
3. **Shape.** Two straight ramps still leave four corners. The fade is those ramps
   intersected with an ellipse, so the picture goes out as an oval.
4. **Texture.** The last one, and the least obvious: with colour and level matched to within
   4% the join was still plain to see, because felt has about seven times the grain of a CSS
   gradient and the eye reads texture starting as an edge. `.hero-band::before` lays matching
   grain *under* the photograph. Matching its amplitude was not enough — it has to match the
   frequency too, or it reads as speckle against felt. Both were fitted against the
   photograph's structure function; the numbers are in the comment on that rule.

The script prints what it did and what `.hero-band` has to hold to match. **If you move
`CROP`, re-run it and paste its last three lines into `HERO_BLOOM_MASK` in build.js**, and
check that the flower still sits inside the flat plateau of `.hero-band`'s gradient — at
narrow widths the flower stacks under the copy, which is why the `max-width:900px` block
re-centres both the plateau and `.hero-light` on it.

`.hero-light` is the pool of light that step 2 took out, put back over the field and the
photograph together so it no longer stops at the edge of the crop.

One known limitation: the source is only 736x920, so on a Retina display the flower is
upscaled about 2x and is correspondingly soft. A higher-resolution original is the only
real fix — do not upscale this one.

## Glass and the cursor

Four things make glass read as glass, and all four are in `.glass`: it bends what is
behind it (`backdrop-filter:url(#glassWarp)`, a low-frequency `feDisplacementMap`), light
catches the top and bottom (inset crescents, not a flat 1px line), the rim splits light
(a faint conic rainbow masked to the edge), and it is never quite still (`.float`). There
is deliberately **no** sweeping hover shimmer — it read as a swipe effect, not a material.

The cursor is a small solid dot. Over a `[data-curious]` card it flips three times
(rotateY, because a solid circle has no features and any other spin would be invisible)
and then rolls out into a pill reading "click if curious"; clicking rolls it back up and
turns the page. Three nested elements, because the follow, the turn and the roll-out each
need their own transform. It only arms for a fine pointer with motion allowed, and the
first Tab keypress gives the real cursor back.

The logo wall masks every mark to a single ink (`.brand`, `-webkit-mask` from the PNG's
alpha) — nine logos in nine house styles only read as one row if they share a colour.
Add a logo by dropping a transparent PNG in `assets/logos/` and appending `{src, alt}`
to `brands.logos`; nothing else needs to change.

## Device frames

Both frames are pure CSS — no bezel images — so they stay crisp at any size and sit on
any background. Sizes come from `DEVICE_MOCKUP_SPEC.md`.

- **Phones** — `phoneFrame()` + the `.phone` block in `makeCSS()`. Every dimension is a
  fraction of the screen width, so the frame is one `aspect-ratio` plus percentages;
  `container-type:inline-size` on `.phone-media` makes `1cqw` = 1% of the device width,
  which is what lets the titanium rail be shaded *by distance inward* (a stack of inset
  `box-shadow` rings that follow the rounded corners) instead of with a flat gradient
  whose highlight would hide under the black bezel. Feed it **un-framed** screens —
  `assets/case-studies/stack/raw/` and `assets/case-studies/spotify/raw/`, not the
  exports with a device already drawn in. Set `"frame":"phone"` on a `phones` block to
  opt in; leave it off for images that already contain a device.
  `build.js` prints an aspect check for every screen on each build: within 5% of 9:19.5
  it stretches (`data-fit="fill"`, nothing is lost off the bottom), beyond that it
  cover-crops from the top.
- **Websites** — a CSS Mac Chrome window. It stands in for a 1280pt-wide browser, and
  every piece of chrome is sized in `--u` = one logical pixel at that width (40pt tab
  strip, 34pt tabs, 12pt traffic lights, 40pt toolbar, 10pt window radius). Hard-coded
  pixels are what made the old frame read as fake — the lights and tab strip were 2–3×
  oversized for the window they sat in. Set `"type":"browser"` (home) or
  `"frame":"browser"` (case study) plus a `"url"`.
- Add `"autoplay": true` to a `phone-video` to make it loop whenever it is on screen,
  on any device — GIF behaviour without a GIF.

## Deploying

Pushing to `main` is the deploy. `.github/workflows/pages.yml` runs `node build.js` on a
clean Ubuntu box and publishes `dist/` to GitHub Pages — no install step, because the build
has no dependencies. Edit a JSON file in `data/`, push, and the live site updates in about
a minute. The Actions tab has a "Deploy to GitHub Pages" run you can re-trigger by hand.

`dist/` is **not** committed (see `.gitignore`); CI rebuilds it every time. Keeping it in
the history would double the size of every commit that touches an image.

The custom domain is `m--k.me`, and `build.js` writes it into `dist/CNAME` on every build.
That is deliberate and it matters: GitHub's Settings ▸ Pages ▸ Custom domain box writes a
`CNAME` file to the repo *root*, which is how Pages works when it serves a branch. This
site is deployed as an artifact built from `dist/`, and the artifact is the whole published
site — a `CNAME` in the repo root is not in it, so the domain would silently revert to the
`github.io` URL on the next deploy. Change the domain by editing `DOMAIN` in `build.js`;
set it to `''` to go back to a `github.io` URL. `dist/.nojekyll` is written for the same
belt-and-braces reason: Pages runs Jekyll over an artifact unless told not to, and Jekyll
drops anything whose name starts with an underscore.

DNS for an apex domain needs four `A` records at the registrar, pointing `@` at
`185.199.108.153`, `185.199.109.153`, `185.199.110.153` and `185.199.111.153`, plus
optionally a `CNAME` on `www` pointing at `<user>.github.io`. Tick **Enforce HTTPS** in
Settings ▸ Pages once the certificate has been issued.

## Design systems

The whole look is versioned. `node tools/design-system.js list` shows the snapshots;
`restore <name>` puts one back (taking an automatic backup of the current state first).

- **rainforest** — the emerald/misty system, Instrument Serif, glass droplet cursor.
- **terracotta** — current. Warm cream, fired-clay rust, sage, deep teal case-study heroes,
  teal-blue display type, Cormorant Garamond + DM Sans, her handwriting. The palette is
  *sampled* out of `color pallete I like.png` rather than matched by eye: `bg-base` is that
  file's paper, `accent` the mean of both rust blooms, `sage` the mean of the teal stems. The
  hero carries the literal cut-out flowers and there are no decorative gradients anywhere.
- **bloom** — the red-felt photographic hero. Every value taken off `hero-src/flower.jpg`:
  red leads, petal cream carries headlines on it, stem green carries display type on the cream
  pages, oxblood case-study heroes. Superseded on 2026-08-05 when she asked to go back to the
  reference-image palette.

`build.js` is snapshotted alongside `data/` because half the design system lives in
makeCSS()/makeJS() — restoring tokens alone would drop a palette onto the wrong structure.

## The monkey story

A monkey in India stole her pijamas and tried to dress her baby in them. It is **not on the
site** (2026-08-05) — it is a standalone GIF that builds to `monkey-gif/`, deliberately
outside `assets/` so it is never copied into `dist/` and shipped. All of it is lifted off
photographs of her notebook.

```
node tools/lift-story.js               # notebook photos (~/Downloads) → alpha masks
node tools/glyphs.js                   # verify the letter/word cut, pass or fail per row
node tools/make-story-gif.js           # → monkey-gif/monkey-story.gif + poster
node tools/make-story-gif.js --at 7.0  # one frame, for checking a beat
```

The renderer still reads `site.json`'s `story` block if there is one, so putting the
section back is a matter of restoring that key and pointing it at a shipped copy of the
GIF. There is one layout now rather than a wide/tall pair: turned on its side the drawing
is landscape, and with no phone column to design for the second cut had no job left.

**The drawing is turned 90° anticlockwise.** She photographed it with the tree running down
the page — the mother above, the baby below, the trunk vertical. Turned, the trunk is a
*branch* the two of them sit along, and two beats come for free: her downward shove becomes
a sideways one (`FIELDS.press.axis`), and the baby's legs, which were at the bottom, end up
on top where the kick belongs. `I.rotate90ccw` does the turn; every coordinate in
`story.js` is in the turned-and-extended space, so nothing is rotated at render time.

**The branch is extended off the left edge.** Her branch stops in a ragged tip a little way
in, which reads as a stick they are balanced on rather than a branch running out of shot.
`extendBranch()` mirrors a clear length of it onto its left end — mirrored rather than
repeated, because a repeat of a hand-drawn squiggle shows up as a pattern instantly, and a
mirror joins cleanly on a shared cross-section. Take the source strip from x 40–240 only:
the mother's tail starts at x≈280 and copying any of it puts a blob out on the left.

Around 1.8 MB, almost all of it the monkeys moving: a GIF diffs only against the previous
frame, so every frame of continuously-moving line art pays for itself. To shrink it, in
order of effect: tighten the two warp radii, drop `FPS`, shrink the canvas, shorten the
holds in `BEATS`. Widening the warp radii by a third cost a megabyte and read no better.

Three things here are worth knowing before changing any of it.

**Ink is lifted by blue-minus-red, not by luminance.** `clean-logos.js` separates a mark
from its drop shadow by luminance because both are neutral. A photo of a notebook is a
different problem: the page is lit unevenly, so a luminance threshold takes the page edge
and the gutter along with the writing. Her pen is blue and the paper is warm, and B−R
splits them almost perfectly at any exposure. `tools/ink.js`.

**The drawing is warped, never cut into layers.** Her ink is continuous — the mother's
fingers, the waistband and the baby share strokes — so slicing it into movable pieces
tears every line that crosses a cut. Instead each moving part is a smooth displacement
field with a soft elliptical falloff (`FIELDS` in `tools/story.js`): the ink stretches
instead of breaking, and nothing is ever separated from something it was drawn touching.
Timing lives next to it in `press()`, `wriggle()` and `BEATS`.

**One line is set in her handwriting from her own alphabet sheet.** Four of the five text
moments are straight photographs. The fifth — the opening sentence — she never wrote, and a
typeface among four handwritten lines reads as the odd one out, so `tools/glyphs.js` cuts
whole words out of writing she has done and falls back to single letters for the rest. It
is a compositor for one sentence, **not a font**: no metrics, no kerning, no OpenType.
(She did want real type from her hand, and it is a different job with different tools —
`tools/make-hand-font.js`. The monkey story still uses this compositor; the hero does not.)

That line is the weakest thing in the piece, and it is worth knowing why before trying to
fix it again. It draws on **three** sources, not two, and no two of them agree:

| source | what it gives | how it differs |
|---|---|---|
| `paragraph.png` | most of the words | she wrote small and tight |
| `alphabet.png`, the sentence on top | the rest of the words | ~40% bigger — a different photo distance |
| `alphabet.png`, the A–Z block | every letter | bigger again, and lighter |

`normaliseHand()` puts all three on one scale, one pen weight and one baseline before a
single stamp is placed — measure each source's x-height (lower quartile of trimmed heights,
since a plain median lands on cap-height in a source that is half capitals), scale the
others down to the smallest, then dilate each back to a common weight, because a scale
alone leaves the shrunk sources spindly. Single letters also get their baseline put at
their own bottom edge: the least-squares fit through a row of isolated letters is loose
enough to hand her `m` a 23px descender, and that stagger reads worse than the size ever
did. Words keep the fitted baseline — a word box spans ascender to descender, so its bottom
edge is not its baseline, and forcing the rule onto words throws every word with a
descender off the line.

Even so, "pijamas" comes out muddy — its word cut is one of the ones `wordLibrary` rejects,
so it is built letter by letter out of the softest of the three sources. **The real fix is
a photograph**: if she writes that one sentence in the notebook and shoots it like the
other four, `lift-story.js` will take it and the compositor can be retired.

`tools/gif.js` is a from-scratch GIF89a encoder (LZW, one global ramp palette, inter-frame
differencing against the changed rectangle) because this machine has no ffmpeg,
ImageMagick, gifsicle or PIL. Re-run `make-story-gif.js` after any change; it takes a
couple of minutes.
