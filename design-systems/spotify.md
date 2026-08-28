# Spotify Mix — identity manual & design system

The written rules behind [spotify.html](./spotify.html). Every value in this file was
sampled or measured from the final Figma exports in `Project 1 Spotify/` (360×783,
1&nbsp;px&nbsp;=&nbsp;1&nbsp;dp), so a person or a model can build a screen from this
document alone. Where a value is a recommendation rather than a measurement, it says so.

Spotify Mix is a feature **inside** Spotify, not a brand beside it. The identity job is
restraint: extend Encore's dark language with exactly three new ideas — Camelot key
badges, transitions that live *between* songs, and a warning that carries its own fix —
and change nothing else.

---

## Part 1 — Identity manual

### 1.1 Principles

1. **Inside Encore, not beside it.** Every screen must be mistakable for Spotify. New
   patterns extend existing ones (chips, sheets, pills); they never introduce a new
   visual language.
2. **Color is information.** On the near-black stage, color only ever means something:
   green = action or positive state, a key badge's hue = musical harmony, ember = a
   rough transition. Decorative color is banned.
3. **Every warning carries its fix.** A problem is never flagged without the remedy in
   the same element ("hard blend · **Add bridge song ›**").
4. **Preview before commit.** Anything the system decides (reorder, transition, bridge
   song) can be heard or reviewed before it sticks.

### 1.2 The mark and the entry point

- The feature has **no logo**. Its mark is the **Mix glyph** — the two-slider icon on the
  playlist `Mix` pill — plus the ✦ sparkle prefix reserved for machine-made suggestions
  (`✦ Smart Reorder`, `✦ Auto`, `✦ Your Mix is ready!`).
- The sparkle ✦ may only appear where the system did the work. Never on a manual action.
- Spotify's own logo rules apply untouched; Mix never places, recolors, or locks up the
  Spotify logo.

### 1.3 Color treatment

- **One green, and it is `#1CD05E`** — the in-app Encore green sampled from the final
  screens. It is *not* the marketing green `#1ED760`; that value never appears in
  product UI. Green is used for: primary CTAs, the Save action, selected filter pills,
  the play disc, playing state, progress, downloaded/shuffle state dots, text links.
- **Ink on green is always black** (`#000000`, 10.2:1). White on green fails (2.05:1)
  and is forbidden.
- **Key badges are data, not decoration.** Their hues are fixed per Camelot number (see
  1.4) and may never be reused for anything else.
- **Ember (`#3D190A` + `#E8825A`) is the only warning treatment.** No red fills, no
  yellow triangles on their own; the red `#BC1E1E` ✗ appears only in the legend.

### 1.4 The Camelot key legend

Each song carries its key as a 9&nbsp;pt black-ink badge (14dp tall, radius 4). **Hue follows the Camelot
wheel number**, so keys that harmonize sit in neighboring hues and matching keys match
exactly — the color does the DJ theory:

| Key | Hex | Name |
| --- | --- | --- |
| 2B | `#24CB61` | green |
| 7A | `#FDB4D4` | rose |
| 7B | `#FF90C0` | hot pink |
| 8A | `#F4B4FD` | orchid |
| 9A / 9B | `#DBB4FD` | lavender |
| 10A | `#B2C8FF` | light periwinkle |
| 10B | `#8AA9F7` | periwinkle |
| 11B | `#20CDFC` | cyan |

A and B of the same number share a family (10A is the lighter sibling of 10B). The rule
for unmeasured keys: keep the neighbor-hue ordering around the wheel, pastel enough for
≥ 7:1 against black ink. The in-product legend screen ("Making mixing easy") is the
canonical teaching surface: matching colors ✓ (`#1CD05E` check), far-apart colors ✗
(`#BC1E1E` cross).

### 1.5 Imagery

- **Album art is the only imagery.** 44×44, radius 6, never cropped, never filtered.
- Ambient color is **derived from art, never invented**: the playlist header gradient
  (`#279EFE → #006EC9`, collapsing to `#00447C`) and the now-playing bar tint
  (`#142239`) are extractions from the current artwork. When art changes, the tint
  changes; nothing else in the UI ever picks up art color.

### 1.6 Voice

Short, first-plural, playful only at moments of delight: "Let's Mix! 🎉", "Your Mix is
ready!", "We'll organize your playlist for you – or you can do it manually." Warnings
are lowercase and factual: "hard blend". Emoji appear only in sheet titles, at most one.

### 1.7 Do / don't

- **Do** put black text on green. **Don't** put white on green — it fails contrast.
- **Do** use `#1CD05E` in UI. **Don't** use marketing `#1ED760` anywhere in product.
- **Do** pair every hard-blend flag with "Add bridge song". **Don't** show a bare warning.
- **Do** reserve key-badge hues for keys. **Don't** color chart, tag, or decorate with them.
- **Do** put the ✦ sparkle on machine suggestions. **Don't** sparkle manual actions.
- **Do** show the bordered bpm+key chip only on the two songs being mixed. **Don't**
  border the meta in ordinary lists — there it stacks unboxed (bpm over badge).
- **Do** derive header/now-playing tints from art. **Don't** hand-pick ambient colors.

---

## Part 2 — Design system

All values in dp (= px on the 360-wide reference frame). iOS: pt. Android: dp. Web: px.

### 2.1 Color tokens

**Surfaces** (elevation is a lightness step, never a shadow)

| Token | Hex | Use |
| --- | --- | --- |
| `surface/base` | `#121212` | app background |
| `surface/nav` | `#111111` | bottom navigation (blurred in situ) |
| `surface/sheet-modal` | `#1F1F1F` | bottom sheets (Let's Mix, bars picker) |
| `surface/sheet-full` | `#2B2B2B` | full-screen editors, drawers, legend card, action cards |
| `surface/chip-base` | `#323232` | chips/pills sitting on `base` |
| `surface/chip-modal` | `#353535` | segmented options on `sheet-modal` |
| `surface/control` | `#585757` | pills, search, idle segments on `sheet-full` |
| `surface/add-circle` | `#424242` | the 40⌀ filled add button in suggestion lists |
| `surface/inverse-chip` | `#1E1E1E` | transition chips (darker than their surface, +1px `#3A3A3A` border) |
| `surface/coach` | `#636363` | coach-mark toast (lightest surface in the system) |
| `surface/ember` | `#3D190A` | hard-blend warning fill |
| `surface/now-playing` | `#142239` | art-derived, sampled from the blue artwork |

**Ink**

| Token | Hex | Use |
| --- | --- | --- |
| `ink/primary` | `#FFFFFF` | titles, labels |
| `ink/secondary` | `#AEB2B5` | body copy, sheet subtitles |
| `ink/card-sub` | `#9EA1A4` | action-card subtitles |
| `ink/placeholder` | `#C0C0C0` | search placeholder |
| `ink/tertiary` | `#878A8C` | artist lines, meta, "Presets" label |
| `ink/value` | `#E1E1E1` | bpm numbers |
| `ink/on-fill` | `#000000` | on green, on white, on every key badge |
| `ink/disabled` | `#323232` | on `#AEB2B5` disabled fill |

**Accent & semantic**

| Token | Hex | Use |
| --- | --- | --- |
| `green/action` | `#1CD05E` | the only action color (see 1.3) |
| `green/track-rest` | `#0A662C` | unplayed portion of progress |
| `green/waveform` | `#1CD05E` @ 65% | outgoing-track waveform bars |
| `gray/waveform` | `#878A8C` | incoming-track waveform bars |
| `warn/ink` | `#E8825A` | every stroke inside the ember pill (icon, text, dot, chevron — one color) |
| `danger/legend` | `#BC1E1E` | the legend's ✗ only |
| `line/hairline` | `#252626` | rules on `base` (≈ white 8%) |
| `line/outline` | `#414141` | bpm+key chip border, 1px |
| `line/dash` | `#505253` | "Insert song here" dashed divider |
| Key badges | see 1.4 | |

### 2.2 Typography

Face: **Montserrat** — identified against the exports letterform by letterform (looptail
g, flagged 1, curved t), and every size below solved by matching rendered text widths
against the PNGs (canvas `measureText` vs. pixel-measured word widths, err < 2px). It
stands in for Spotify's proprietary Circular; a production hand-off maps the same scale
onto Circular. The scale is compact — titles 13, chips 11, meta 10.5. SemiBold carries
the hierarchy; color separates primary from secondary. No italics anywhere.

| Style | Spec | Sample |
| --- | --- | --- |
| `type/sheet-title` | 600 · 18/24 | "Let's Mix!", "Your Mix is ready!" |
| `type/screen-title` | 600 · 13/18, centered | "Edit transition" |
| `type/section` | 700 · 13/17 | "Best Matches" |
| `type/song` | 600 · 13/18 | song titles, CTA labels, "Edit Manually", Intro/Outro |
| `type/body` | 500 · 13/19 · `ink/secondary` | sheet copy |
| `type/bar-action` | 400/500 · 11.5/16 | Cancel (white) / Save (green) |
| `type/chip` | 500 · 11/14 | presets, transition chips, warning text |
| `type/chip-selected` | 600 · 11.5/14 | selected filter pill |
| `type/tool` | 600 · 10.5/14 | playlist tool pills (Add, Mix, Edit) |
| `type/meta` | 400 · 10.5/14 · `ink/tertiary` | artists; "173 bpm" shares it in `ink/value` |
| `type/caption` | 400 · 10/14 | "Presets" label, sheet captions, "Insert song here" |
| `type/badge` | 700 · 9/10 · black | key badges |

The CTA is a 46dp pill wearing a 13/600 label — the pill is tall, the type is not.

### 2.3 Spacing, radius, size

- Grid: **4** — every measured gap is a multiple of 4 (±1 export rounding).
- Screen margin: **12**. List rows, chips rows, cards and sheets all start at 12.
- Radii: pill `999` (every standalone actionable), action card `14`, bpm+key pair
  chip `12`, segmented preview `12`, segmented option `10`, preset chip `8`, coach
  toast `16`, sheet top corners `24`, album art `6`, key badge `4`.
- Measured heights: CTA pill **46**, big pill (full-width) **45**, search **44**,
  preset chip **40**, segmented option/preview **40**, add-button circle **40⌀**,
  transition chip **38**, warning pill **35**, filter pill **34**, tool pill
  (playlist header) **30**, key badge **14**, bpm+key pair chip **48**, album art
  **44**, progress bar **4**, sheet handle **56×4**, hairline **1**.
- Chip gap in a row: **8**. Row internal gap (art→text): **12**.
- Touch target: nothing interactive below 30 visual; pad to ≥ 44 effective.

### 2.4 Iconography

- Stroke icons, 1.6–2 weight, round caps and joins, white; ~14 inside chips and
  pills, 20–24 standalone.
- The **sparkle** is one large four-point star with a small companion star at its
  upper right — filled, black on green/white fills, white on dark pills. The Auto
  transition chip carries it black inside a 24×24 green rounded square (radius 6).
- The play disc is the one filled icon: 48⌀ in `green/action`, black glyph; inside
  the waveform editor it wears a green ring.
- Green on an icon = state, not style: downloaded ↓, smart-shuffle dot, headphones.
- The ⚠ triangle in the ember pill is *outlined*, in `warn/ink` like its text.
- Advanced-control rows carry a 3×14 rounded channel tick: volume `#28556C` steel,
  EQ olive yellow (`#FFE500` family, dimmed) — channel colors, used nowhere else.

### 2.5 Elevation

No shadows. Elevation = surface lightness + geometry:
`base #121212 → sheet-modal #1F1F1F → sheet-full/card #2B2B2B → chip #323232/#353535 →
control #585757 → coach #636363`. The one inversion: transition chips (`#1E1E1E` on
`#2B2B2B`) sit *into* the list, because they belong to the seam between songs, not to
either row. Sheets add a 40% black scrim over what they cover.

### 2.6 Motion (recommended values; pattern observed in the recording)

- Bottom sheets: slide up, 300 ms, decelerate; scrim fades in 200 ms.
- Chip select / invert: 150 ms color swap, no movement.
- Toast ("Your Mix is ready!"): replaces sheet content in place, 200 ms crossfade.
- Preview progress: linear, real-time with audio.
- Respect platform reduce-motion settings: swap slides for fades.

### 2.7 Interaction states

| State | Rule |
| --- | --- |
| Selected (neutral set) | invert: white fill, black ink — presets, bars picker |
| Selected (action set) | green fill, black ink — filter pills, playing Intro/Outro |
| Active tool | white 1.5 outline ring with a 2 gap — the playlist `Mix` pill |
| Focus (keyboard/TV) | same white ring, any component — the outlined Fade chip is the spec example |
| Disabled / spent | fill `#AEB2B5`, ink `#323232` (6.0:1) — Smart Reorder while manual editing |
| Sibling dim | when a row expands (bridge preview), other rows sit under a 20% black scrim with ink at 55% |
| Playing | title turns `green/action` + equalizer glyph replaces its index |
| Warning | the ember pill; never a color change on the row itself |

### 2.8 Patterns

- **Progressive disclosure:** pill row → sheet → toast → full editor. Each step is
  skippable ("Edit Manually", "Review").
- **The seam owns the transition:** everything about how two songs meet (chip, warning,
  bridge insertion point) renders *between* the two rows, centered, never inside a row.
- **Warning-with-remedy:** ember pill = ⚠ + "hard blend" + · + remedy + ›, one tap.
- **Bordered pair:** the two songs being mixed get the bordered bpm+key chip;
  list rows stack the same meta unboxed, right-aligned.
- **Preview-before-commit:** Intro/Outro segmented preview with 4-high progress
  (played `#1CD05E`, rest `#0A662C`); the waveform play disc previews the blend.
- **Teach in context:** coach toast (`surface/coach`) links "How does this actually
  work?" → the legend screen; the legend uses live components, not illustrations.

### 2.9 Core components

Anatomy specs live rendered in [spotify.html](./spotify.html) **at true 360dp metrics**
in phone-width stages, with SVG icons traced from the screens: top bar, song row (list,
pair, and edit variants), bpm+key pair chip, key badge, preset chip, filter pill, tool
pill, transition chip, segmented preview + progress, bars picker, CTA pill, text button,
action card, ember warning pill, search pill, add button, coach toast, bottom sheet,
waveform editor.

### 2.10 Platforms

One spec, three targets. dp/pt/px map 1:1 off the 360 frame. Bottom sheet = Android
`ModalBottomSheet` / iOS detent sheet / web dialog at ≤ 480 wide. The bottom nav and
status bar stay native; everything above them follows this document. Circular falls back
to the platform sans (SF/Roboto/Helvetica) at identical sizes.

### 2.11 Accessibility

Measured ratios: white/base 18.7, secondary/base 8.8, tertiary/base 5.4 (4.1 on
sheet-full — 13 pt meta stays ≥ 4.5 by staying off `#585757` fills), black/green 10.2,
green/base 9.1, badge ink ≥ 9.1 on every measured badge, coral/ember 5.8, disabled 6.0.
Key color never carries meaning alone: the badge always contains the key *text*, the
legend pairs color with ✓/✗ glyphs, and bpm is written out beside every badge.

### 2.12 Provenance

Colors sampled pixel-for-pixel (pngjs), geometry measured by color-run scanning, the
typeface identified by a letterform lineup, and every font size solved by width-matching
rendered Montserrat against the PNGs — all from the 2026-08-28 exports in
`4. Selected Projects/Project 1 Spotify/` (360×783 = 1px per dp), the same frames shown
in the Screens section of spotify.html and copied to `assets/case-studies/spotify/final/`.
Motion values are recommendations (2.6); the legacy `6b. Advanced Controls` frame still
carries old-style visuals (including `#1ED760`) and was excluded from sampling except
for its channel-color curves.
