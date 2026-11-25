# Every interaction on the home page, and how the check proves it

Written 2026-11-25 for the phone check (`m--k.me/check/?who=…`). The visitor does nothing but open the link and wait
(Madhu: "I thought she doesn't have to do anything on the screen"). `check/probe.js` presses every row below itself, the way a
finger would, and checks the result. `tools/site-check-test/triage.mjs` turns the report into verdicts (`check/TRIAGE.md`).

## How a self-test presses something (as close to a finger as a page allows)

1. **Scroll it to the middle of the screen**, instantly. The site sets `html{scroll-behavior:smooth}`, so the probe turns that off
   for the one call and puts it back.
2. **Hit-test the spots a thumb would press**: the centre plus four points around it, using `elementFromPoint`. Each must land on
   the element or something inside it. This catches an overlay, a canvas or a see-through layer that would eat a real tap. A
   scripted event sent straight to the element would miss that. The report gives `hit: n/5` and names whatever was on top.
   It also records `touch-action` on the path and every window/document listener for touch, pointer, click, wheel and scroll,
   with its file and whether it is passive. That list shows whether a non-passive listener could hold up scrolling.
3. **Send the full event sequence a phone sends, at real coordinates, to whatever is really at that spot**:
   pointerover → pointerenter → pointerdown → touchstart (a real `Touch`) → pointerup → touchend → pointerout → mouseover →
   mousemove → mousedown → mouseup → click.
4. **Watch for the effect** with a 16ms timer poll. It uses a timer and not frames, so a page whose frames have died can still
   be measured. Each result records:
   - `ms`: how long the effect took
   - `paint`: when the next frame was drawn
   - `worst`: the worst frame while it ran
5. **Put everything back the way it was**:
   - the theme, mute and list/swipe choices in localStorage (keys that were absent are removed again)
   - the scroll position, open dialogs, the fold, and where the avatar stands
   - sound is muted for the whole suite (her rule: no loud sound), except the mute test, which flips mute and flips it back
6. **It never leaves the page.** While the suite runs, any scripted click that reaches a link is stopped after every site handler
   has run. The report notes whether the site had already handled it. That is how the resume link is proven to be taken over by
   the paper plane, without ever opening the PDF.

Result per row:
- `PASS`
- `SLOW` (with ms)
- `NO EFFECT`
- `BROKEN`
- `ERROR` (with the message)
- `BLOCKED` (a phone setting stops it)
- `BY DESIGN`
- `SKIPPED` (not reachable from here)
- `NOT PROVABLE`

## The interactions

Source key: **0-touch** = proven by the self-test with no finger · **inferred** = reasoned from other evidence ·
**finger/cable** = only a real tap or Safari Web Inspector over a cable can prove it.

| # | Element (selector) | How a person triggers it | What should happen | How the probe proves it (test id) | Proof |
|---|---|---|---|---|---|
| 1 | The girl, `.hero > canvas.stick-cv` (stick.js, `window.__stick`) | Page opens | She boots after the name lands; `.hero.stick-on`; clay frames ready (`__stick.clayH() > 0`) | `avatar-ready`: waits up to 12s for the hook, the canvas and clay frames; lists the sprite sheets loaded | 0-touch |
| 2 | The girl: tap the ground beside her | Tap/click empty hero (pointerdown on document, pointerup on window; ignored inside `a,button,nav`) | `fig.state` → `move`; she walks there | `avatar-walk`: taps 1.3 × her height beside her. Records the time to decide (`state`), the time to the first new drawn frame (`__stick.clay().f` changes), frames drawn in 0.9s (fewer than 2 = loop starved → SLOW), px moved, and what is under the finger | 0-touch |
| 3 | The girl: tap above her head | Tap above her | Jump (`air` / crouch `loadT`), or a grab of the type line above = monkey bars (`hang`) | `avatar-jump`, same measures | 0-touch |
| 4 | Monkey bars → muscle-up | While she hangs, tap above the bar | `mantle`, then she stands on the line | `avatar-monkeybars`: runs only if the jump ended in `hang`, otherwise SKIPPED with the reason | 0-touch (when reachable) |
| 5 | The girl: tap on her | Tap her body | `celeb`: cartwheel / backflip / star / bow | `avatar-trick` | 0-touch |
| 6 | (restore) | — | She walks back to where she began | `avatar-home` | — |
| 7 | Drag her (desktop) / keyboard arrows / hover smile and wave / wave on hovering "say hey" | Mouse drag, arrow keys, hover | Follows the cursor, steers, smiles or waves | Not pressed. The phone has no hover or drag, and a desktop is not the device in question | inferred (desktop only) |
| 8 | Sound engine (stick.js `SFX`) | First real tap/key creates or resumes the AudioContext; jumps, hangs and landings play sounds | Context `running` after a finger; sounds start | `sound-wiring` checks the chain up to the speaker: sound code present (`__stick.sound()`); every AudioContext made and its state changes (an observing Proxy); both clips decoded; the unlock listeners attached on window (touchend/pointerdown/keydown, from stick.js); `navigator.audioSession.type`; and a count of every sound node that starts (`AudioScheduledSourceNode.start`), split by running context and by mute | 0-touch up to the speaker. **Audible playback: finger** (iOS starts audio only after a real gesture; the silent switch is invisible to a page, hence her optional question) |
| 9 | Mute button, `button.lt-mute` | Tap | `html[data-mute=on]` flips, `aria-pressed` flips, `mk-mute` saved | `mute-toggle`: hit-test, tap, check both flip, tap back, restore `mk-mute` | 0-touch |
| 10 | Day/night switch, `.lt-toggle .lt-btn[data-look-to]` | Tap (or drag the knob) | `html[data-theme]` flips through a view-transition cross-fade; `mk-theme`/`mk-theme-at`/`mk-shown` saved | `theme-toggle`: hit-test, tap, time to flip, time until the switch can be tapped again (during the cross-fade a finger hits nothing: found 2026-11-25), tap back, restore the keys | 0-touch |
| 11 | The name, `h1 .lively` | Hover, or the mouse events a tap sends | `.waving` on the letters | `headline-wave` | 0-touch |
| 12 | Bio words wave, `.hero-line .hs` | Hover (hover devices only) | `.waving` | Not pressed: set up only on hover devices | inferred |
| 13 | "The longer story", `button.about-toggle` → `#about-more` | Tap | `#about-more.open`, `aria-expanded`, label swaps; press.js squish (`getAnimations()`) | `about-fold`: hit-test, tap, open, press animation, tap again to close | 0-touch |
| 14 | Scrolling the page | Thumb | Smooth; the menu hides on the way down and plops back on the way up; logos, clips and the koi start as they come in | `scroll`: a finger-speed flick, one step per frame, from the top to the bottom (2,400px/s) and back up (3,600px/s). Records frames (over 100ms, worst, and the scroll Y of the worst frame = which section's scroll-linked work), Y every second, and what fired on the way. **Programmatic: no momentum, no finger**, so close to her thumb but not identical | 0-touch (close) · exact thumb feel: cable |
| 15 | Menu hide / plop, `.nav-wrap.nav-hidden` | Scroll down past 140px / scroll up 40px | Hides; comes back | `nav-hide-plop`, from the scroll run | 0-touch |
| 16 | Logo wisps, `.brands-row` → `canvas.brands-wisp` (GSAP) | Scroll the logos into view | Dots gather into the logos once | `logo-wisps`: seen during the scroll; if not, scrolls there and waits, then `tweak-replay` | 0-touch |
| 17 | Project clips, `[data-video][data-autoplay] video` | Scroll a project to the middle | Muted inline autoplay; `.playing` | `video-autoplay`: picks the first visible autoplay clip, centres it, and needs `currentTime` to advance. A refused `play()` = Low Power Mode; no `currentSrc` = never loaded | 0-touch |
| 18 | Disciplines clip in `#panels` (michelob) | Scroll to it | Plays while 10% visible; `.v-live` | `panel-clip`: `currentTime` advances | 0-touch |
| 19 | Disciplines panels, `#panels .panel` | Tap (desktop: hover); hold 350ms → `.peek` | `.active` moves; hold lifts the text | `panels`: hit-test, tap another panel, then a touch hold (real `Touch`) for `.peek`, then tap the first panel again | 0-touch |
| 20 | Photo gallery, `dialog#dg` | Tap the already-open panel | `showModal`, `html.dg-on`, `history.pushState`; arrows or swipes move the prints; ✕ goes back | `gallery`: tap the active panel, then ArrowRight (anything in the pile changes = PASS), then ✕ (`history.back()`), then confirm it closed. Forced closed if not, and the scroll is put back. **Runs only after the main report is confirmed sent**: opening it once loaded ~850 MB of full-size photo pixels in Chrome (2026-11-25), so a memory kill here can never cost the main results | 0-touch (swipe gesture itself: finger) |
| 21 | The koi, `.pot` → `body > div > canvas[data-engine^="three.js"]` (fish.js) | The pot comes 60% into view (auto, once); tap / touch / hover / focus wobbles it and launches a koi | Pot rocks (`style.transform`); a WebGL canvas exists for the ~2.7s flight, then is removed | `koi`: needs Safari 16.4+ (else BY DESIGN) and WebGL (else BLOCKED). Hit-tests the pot, taps it, then needs the rock (`style.transform`) and the koi canvas to appear and go away. The auto-leap is noted if seen during the scroll. `mk-pot-kick` is never fired (it chains forever) | 0-touch |
| 22 | List / swipe switch, `.view-btn` (desktop) or `.turn-hint` (phones, `html.orient-views`) | Tap; on phones turning the phone picks | `#work[data-view]` changes; in deck view, arrows/swipes move `aria-current` | `work-views`: hit-test, tap, the view changes; in the deck, ArrowRight moves the card and ArrowLeft goes back; Escape; tap back. Restores `mk-work-view` and the scroll. Page glides here are the site's own (`otherScroll`) | 0-touch (the swipe gesture and turning the phone: finger/hand) |
| 23 | AI tool demos, `#ai-tools-band .tb-open` → `dialog.td` (tool-demos.js) | Tap "Try …" | Dialog opens (`showModal`, `html.td-lock`) | `tool-demo`: hit-test, tap, open, `toolDemo.close()`, closed; viewport meta put back; the band's own video `currentTime` advances | 0-touch (inside each demo: not pressed) |
| 24 | Resume paper plane, any `a[href*=Resume.pdf]` (resume-plane.js) | Tap "Resume" / "View my resume" | The link is taken over (no PDF); she folds and throws a plane; `.rz.on`, then `.rz-sheet.on` | `resume-plane`: if the site did NOT take the link over → BROKEN (a real tap would open the PDF). Otherwise times the overlay and the sheet (about 3–5s by design; SLOW past 6s), then ✕ and restore | 0-touch |
| 25 | Desktop cursor `#dc` / "I'm curious" pill | Mouse moves; hover a project | `.live`, `.turning`, `.pill` | `cursor`: `mk-wh` event → `.turning`/`.pill`. Touch screens: BY DESIGN | 0-touch (desktop) |
| 26 | Hover handwriting `[data-hand]` | Mouse hover (CSS only) | The label turns to her handwriting | `hover-hands`: touch = BY DESIGN; desktop = NOT PROVABLE (a page can't trigger `:hover`) | — |
| 27 | Links: case cards, nav, socials, "say hey" (Calendly), logo slots | Tap | Open pages / new tabs | `links`: HEAD request to every own page (up to 14) must answer 2xx; outside links are only counted; Calendly link present. Nothing is opened | 0-touch |
| 27b | **Memory: the big photos** (gallery from every panel) | Opening the gallery and paging | Stays alive | Memory test, also after the main report: opens the gallery from each of the 7 panels and pages 4 photos in each. It counts memory after every photo, and sends its own `memory` report. A kill shows up from the next load (below) | estimated |
| 28 | Edge-fade strips, education creds, bio write-in | — (no input) | Static or automatic | Covered by `settledAt`, the errors and the frames | 0-touch |
| 29 | cursor-light.js | — | Switched off (script tag commented out) | — | — |

## Measured all the time, not as a test

- **Errors**: every JS error and every file that failed to load.
- **Frames**:
  - a histogram of the gaps between frames: ≤12ms = 120Hz, ≤20ms = 60Hz, ≤40ms = 30Hz (Low Power Mode), ≤100ms, and more
  - a summary every 5s, labelled with what the check was doing
  - a 3-second still baseline before the tests start
- **A 250ms heartbeat timer**: a gap of more than 1.2s while visible = main thread blocked; while hidden = the phone froze the page.
- **Life events**: hidden/visible, freeze/resume, online/offline, network type changes, bfcache restore.
- **Device**:
  - drawing surfaces refused and WebGL contexts lost (memory)
  - code speed, WebGL and WebAssembly (Lockdown Mode)
  - the system body text size and weight (Larger Text / Bold Text)
  - media queries for Reduce Motion, Reduce Transparency, Increase Contrast, inverted and forced colours
  - zoom, storage quota
- **Browser**: in-app browser vs Safari vs Chrome (user agent), and the WebKit generation (from features).
- **Downloads**: every file with its size and time (the 250-entry browser limit is raised, so the count is real), and whether
  app.js, stick.js, fish.js and GSAP arrived.
- **Her real touches (a bonus only)**. If she touches anyway, each tap records:
  - where it landed
  - how late the phone handed it over
  - whether anything on the page changed within 1s (DOM mutation, avatar frame or state, scroll)
  - frames over 100ms in that second
  - the audio context state before and after

  Real scrolls are counted. A test she touched during is flagged, so the triage knows it may have interfered.

## Memory: what is measured, what is estimated, what a page can't know

Madhu, 2026-11-25: "Is this something that you can test for if it's like a memory situation, and or how much memory her phone can
handle?" The trigger: in LinkedIn's in-app browser, opening the architecture gallery reloaded the whole site.

**Measured (facts):**
- Every image, canvas and video the page holds, and its pixel size. Images made with `new Image()` (the avatar frames,
  preloads) are tracked weakly, so the tracking never keeps them alive.
- Every WebGL texture uploaded (`texImage2D`).
- Drawing surfaces refused (`getContext` returned null) and WebGL contexts lost: both are memory-pressure signs.
- Screen size and DPR.
- The GPU string (`WEBGL_debug_renderer_info`; iPhones say only "Apple GPU").
- The WebKit and Safari version.
- `navigator.deviceMemory` (Chrome/Android only; Safari never gives it).

**Estimated:**
- Memory in MB:
  - images: width × height × 4
  - canvases: w × h × 4, and ×3 for WebGL (front, back and depth buffers)
  - video: 4 decoded frames each
  - WebGL: the uploads (frees are not tracked)

  This is a count of pixels that are, or can be, decoded. It is an **upper bound** for images (Safari may drop decoded
  copies) and it is **missing** CSS background images, the JavaScript heap, fonts and the browser's own layers. Sampled every 5s,
  after every test and after every gallery photo, with the top 10 consumers (frame sequences grouped: `tarzan-x3-#.webp`).
- The phone's RAM: **inference only**. The screen size maps to the iPhone models that have it, and Apple's specs give their RAM
  (390×844@3 = iPhone 12/13/14 = 4 GB, or 6 GB for the Pro).

**Detected — a kill or reload:**
- At start, at every test, every snapshot and every gallery photo, the probe writes a marker (`vcheck-alive`) to sessionStorage
  and localStorage. It holds the run, the stage, the test, the gallery project and photo, the last memory estimate, the top 3
  consumers, and whether the page was hidden.
- A clean finish or a closed page removes it.
- iOS kills an over-limit page with **no** goodbye event and reloads it. The next load finds the marker and sends a
  `killed-or-reloaded` report under the dead run's id.
- That next run skips the big-photo test, so it can't kill the page twice.

**Not knowable from a web page:**
- the phone's real RAM
- the page's true memory footprint
- the browser's kill limit
- whether a decoded image is still held

**What the cable adds:** Safari Web Inspector › Timelines › add the **Memory** timeline › record while opening the gallery on her
real phone. It shows the page's TRUE memory (JavaScript, Images, Layers, Page), live, up to the moment it dies.

## What a page cannot prove on its own

| Not provable with zero touches | Why | What covers it |
|---|---|---|
| Sound actually coming out of the speaker | iOS starts audio only after a real gesture; the silent switch can't be read | The wiring is proven up to the speaker. If she taps, the report records whether the context reached `running`. Her optional answer "Was your phone on silent?" |
| The real touch path (iOS gesture recognisers, tap vs scroll decisions, momentum, 300ms-style delays) | These happen before the page sees an event | Hit-testing proves nothing covers the target. The full event sequence proves the handlers. Her real taps, if any, are timed. Settling it fully: Safari Web Inspector Timelines over a cable |
| What reached her eyes | The probe knows a frame was drawn, not that it was composited to the glass | Her optional answer "Did you see the little girl move?" |
| Hover-only effects on a phone | No hover on touch | By design |
| Inside each AI tool demo, the gallery swipe gesture, turning the phone | Not pressed (each is its own flow) | Opening and closing are proven |
| Low Power / Lockdown / private mode / thermal / memory, directly | Safari exposes none of them | Inferred with a confidence (see TRIAGE.md) |
