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

Eyebrow, headline, one sentence, two buttons — then a masked logo wall. The scroll-driven
droplet/leaf/frog story that used to live here was removed on 2026-08-03; the drawings are
still in `assets/hero/` and `tools/make-leaves.js` if it is ever wanted back.

The sentence is **Madhu's own handwriting**, lifted off a photo of her notebook and used
as a CSS mask (`assets/hero/hero-line-handwritten.png`) so it takes the design-system ink.
The text stays in the DOM in a visually-hidden span for screen readers and search. There
is no font tooling on this machine, so only fixed strings can be set in her hand — for a
reusable typeface from the A-Z sheet she photographed, use Calligraphr.

The hero also carries painted florals from `tools/make-flowers.js`. They all sit to the
right of the text column and are cropped by the section edge on purpose; the copy is
left-aligned, so a bloom on the left lands on the headline.

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

## Design systems

The whole look is versioned. `node tools/design-system.js list` shows the snapshots;
`restore <name>` puts one back (taking an automatic backup of the current state first).

- **rainforest** — the emerald/misty system, Instrument Serif, glass droplet cursor.
- **terracotta** — current. Warm cream, fired-clay rust, sage, deep teal case-study heroes,
  Cormorant Garamond, her handwriting, painted florals.

`build.js` is snapshotted alongside `data/` because half the design system lives in
makeCSS()/makeJS() — restoring tokens alone would drop a palette onto the wrong structure.

## The monkey story

The section above About is a GIF: a monkey in India stole her pijamas and tried to dress
her baby in them. `assets/story/` holds the whole thing, all of it lifted off photographs
of her notebook.

```
node tools/lift-story.js                     # notebook photos (~/Downloads) → alpha masks
node tools/glyphs.js                         # verify the letter/word cut, pass or fail per row
node tools/make-story-gif.js                 # → monkey-story.gif + poster (desktop)
node tools/make-story-gif.js --variant tall  # → monkey-story-tall.gif + poster (phones)
node tools/make-story-gif.js --at 7.0        # one frame, for checking a beat
```

**Two GIFs, and both must be rebuilt after any change.** Side by side, her handwriting is
about a third of the frame's width, which on a phone lands at ~120px and stops being
readable — and this section's content *is* the handwriting. The `tall` variant stacks the
drawing over the text so the words get the full column; `<picture>` in `build.js` serves
whichever fits, plus a still for `prefers-reduced-motion`. The lifted masks live in
`story-src/`, deliberately outside `assets/` — everything under `assets/` is copied into
`dist/`, and there is no reason to ship 1.2 MB of source ink nobody downloads.

Both files are around 2 MB, which is most of what this section costs. Almost all of it is
the monkeys moving: a GIF diffs only against the previous frame, so every frame of
continuously-moving line art pays for itself. If it needs to get smaller, in order of
effect: tighten the two warp radii, drop `FPS`, shrink the canvas, shorten the holds in
`BEATS`. Widening the warp radii by a third cost a megabyte and read no better.

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
is a compositor for one sentence, **not a font**: no metrics, no kerning, no OpenType. If
she ever wants real type from her hand that is a different job with different tools.

`tools/gif.js` is a from-scratch GIF89a encoder (LZW, one global ramp palette, inter-frame
differencing against the changed rectangle) because this machine has no ffmpeg,
ImageMagick, gifsicle or PIL. Re-run `make-story-gif.js` after any change; it takes a
couple of minutes.
