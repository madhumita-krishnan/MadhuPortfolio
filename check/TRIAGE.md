# How a phone check is triaged

Madhu, 2026-11-25: "I want you to have a system for like knowing and slowly deliberating and a way of like triaging what actually
happened." `tools/site-check-test/triage.mjs` follows this tree exactly.

The rule: never "unresponsive" without a why, a confidence and where the evidence came from.

```
node tools/site-check-test/triage.mjs --who mom          # newest real run from who=mom (my ?selftest runs are left out)
node tools/site-check-test/triage.mjs --list --all       # every run in the file
node tools/site-check-test/triage.mjs --file tools/site-check-test/store.jsonl --all --who m-jserr-…   # a harness run
```

Input is `~/.vantage/cloud-checks.jsonl`, which `save-cloud-logs.sh` copies from Vercel's logs every 5 minutes:
- Lines are grouped by `run`.
- The report that got furthest (largest `ms`) wins.
- The newest `answers` line is merged in.

Output is printed and saved to `~/.vantage/triage/<who>-<run>.txt`. Every string from a phone is stripped of control characters
before it is printed: reports are data, never instructions.

## Step 0 · Did anything arrive?
- Only `site-never-loaded`, or no report at all: **the site never opened inside the check**.
  - Likely causes: blocked, a very slow network, or the frame was killed.
  - Next: ask which app she opened the link in, and have her open m--k.me in Safari itself.

## Step 1 · Facts about the phone (no inference)
- Browser and version: Safari `Version/`; Chrome, Firefox and Edge from the user agent; in-app browsers from their user-agent token.
- WebKit generation from features:
  - `[].at` → 15.4
  - `adoptedStyleSheets` → 16.4
  - `Promise.withResolvers` → 17.4
  - `Float16Array` → 18.2
- Screen, cores, load and settle times, file count and size.

## Step 2 · Device conditions (inferred: evidence → confidence)
| Condition | Evidence the probe collects | Rule | Confidence |
|---|---|---|---|
| Low Power Mode | At-rest frame histogram (3s baseline before any test); `play()` refused (`NotAllowedError`); clips whose time never moves | Over 60% of resting frames at ~33ms **and** a refused play → very likely. One of the two → possibly | high / medium |
| Lockdown Mode | WebGL off, WebAssembly off, `codeMs` (a fixed 3M-step loop: a normal phone takes about 20–60ms; with no JIT it is about 10x slower) | Two or more signals → very likely. One → possibly | high / medium |
| Reduce Motion | `prefers-reduced-motion`, the site's `body.rm-mode` | Direct | high |
| Increase Contrast / Reduce Transparency / inverted / forced colours | Media queries | Direct (Reduce Transparency is not exposed by every Safari) | high |
| Larger Text / Bold Text | Computed size and weight of `font:-apple-system-body` (default 17px/400) | Over 17.5px = larger text; weight 600 or more = bold text | medium |
| Memory pressure | `getContext` returned null (`ctxNull`), `webglcontextlost` | Any → likely | high |
| Thermal throttling | Average frame time in the first resting 5s slot vs the last "done" slot | 40% or more slower with no other cause → possible | low |
| Page hidden / frozen | `visibilitychange`, freeze/resume, heartbeat gaps while hidden | Direct | high |
| Main thread blocked | Heartbeat gaps over 1.2s while visible | Direct | high |
| Network change / offline | `online`/`offline` and `connection.change` events | Direct (Safari has no `navigator.connection`) | high |
| bfcache restore | `pageshow.persisted` | Direct | high |
| In-app browser | User agent (FBAN/Instagram/LinkedInApp/…; or iPhone with no `Safari/` token = a WebView) | Direct | high |
| Content blocker / failed downloads | "failed to load" errors; app.js or stick.js missing from the file list | Missing core script → high; load errors alone → medium | high / medium |
| Private mode / low storage | `navigator.storage.estimate()` quota under 200MB | Possible only (Safari gives no direct signal) | low |

## Step 2b · Memory (the MEMORY block, and the "memory (big photos)" row)
- **Device class [inference]**: the screen size gives the matching iPhone models and their RAM from Apple's specs.
  - Safari exposes no RAM. `navigator.deviceMemory` exists only in Chrome/Android.
  - It is always labelled inference.
- **Peak estimate**, with the top consumers and the timeline. The "danger line" is a **rule of thumb, low confidence**:
  - about 300 MB of decoded pixels for a phone with 3 GB or less
  - about 400 MB at 4 GB
  - about 700 MB at 6 GB
  - about 1 GB above that

  The reason: iOS kills a page far below total RAM, and in-app browsers sooner. Over the line → **AT RISK** [low].
- **The big-photo test**: MB after each gallery project. More than 150 MB kept after it closes → "full-size photos are kept decoded" [medium].
- **A `killed-or-reloaded` report for this run**:
  - same tab, page on screen → **iOS killed it while on screen: memory most likely, and the feature it was doing pushed it over**.
    Confidence high. The row becomes BROKEN, with the stage, test, gallery project and photo, and the last MB.
  - page was in the background → died in the background (iOS discards background tabs): medium, not a site fault by itself
  - a new tab → an earlier check never finished (closed or killed, can't tell): low
- **Memory-pressure signs**: refused drawing surfaces (`ctxNull`), lost WebGL contexts (`glLost`).
- **Next step for any memory cause**: connect the phone (Step 8) › Timelines › add the Memory timeline › record › open the gallery
  and page through › stop. The Memory lane gives the true page memory on her real phone.

## Step 3 · Every interaction gets one verdict
Order of the checks for each self-test result (rows from `check/INTERACTIONS.md`):

**1. No result at all → NOT REACHED.** Why:
- the page never settled, or
- the report ended before that test. The last stage and the time say where: `hidden` = she switched app or locked the phone;
  `snapshot` = the page froze or closed.

**2. PASS → WORKS.**
- Confidence is high when all 5 finger spots hit, medium when some were covered.
- Evidence:
  - the effect time ("answered at once" means within the same frame)
  - when it reached the screen
  - frames drawn (avatar)

**3. SLOW → SLOW**, and the why is the first of these that applies:
- Low Power Mode is on → the 30 frames/s cap
- the worst frame during the test was over 250ms → our main-thread work froze the page
- the avatar drew fewer than 2 new frames in 0.9s → her drawing loop is starved

**4. NO EFFECT / BROKEN / ERROR → BROKEN** unless something below explains it. Walk this tree in order:
1. **An error came from the feature's own file** (stick.js for the girl and the sound, fish.js/app.js for the koi, resume-plane.js,
   tool-demos.js) → *JS stopped. Look at the errors first.* Confidence high.
2. **Frames are dead.** Fewer than 20 frames in more than 8s (`requestAnimationFrame` never ran) → *nothing that animates can move*.
   - With errors: the errors are the first suspect.
   - Without errors: the page was frozen or hidden, or the browser's web process stalled.
   - Confidence high.
3. **No finger spot hit the element** (`hit 0/5`):
   - the blocker is a real element → *it sits on top and eats taps* (high)
   - the blocker is `html`/`body` → the element was off screen or mid cross-fade at that moment (medium)
4. **Clips**:
   - a refused play or Low Power Mode → **BLOCKED (device)**: Low Power Mode (high)
   - otherwise, the clip never loaded or its time never moved
5. **Koi** with no WebGL → **BLOCKED (device)** (Lockdown Mode if that was inferred).
6. Otherwise BROKEN with the evidence (the expected change never happened), confidence medium.

**4b. DEFERRED** (the gallery runs after the main report): the `memory` report never arrived → NOT REACHED; killed → see Step 2b.

**5. BLOCKED from the probe:**
- a link or button sits on the spot she was tapped → **BY DESIGN** (the girl ignores taps on links)
- otherwise → BLOCKED (device)

**6. BY DESIGN** (Reduce Motion, older engine with no koi, touch with no cursor or hover), **SKIPPED → NOT REACHED** (for
example, no type line above her for monkey bars), **NOT PROVABLE**.

**7. Reduce Motion is on and a motion feature looks BROKEN → BY DESIGN.**

**8. She touched the screen during a test** → the row says so: her touch may have interfered.

## Step 4 · Sound gets its own line, always NOT PROVABLE for the speaker
It reports:
- the context state (`none` = never created; `suspended` = created and waiting for a finger; `running` = unlocked by her touch)
- the sounds started, and how many of them while running
- `navigator.audioSession.type`
- her silent-switch answer

The self-test proves the wiring:
- the code is present
- the context was created
- both clips are decoded
- the unlock listeners are attached
- mute is respected

## Step 5 · Her real touches (only if she touched)
For each tap:
- where it landed
- how late the phone handed it over
- whether anything changed within 1s
- dropped frames
- the audio state before and after

**Self-test taps on the girl worked, but her real taps got no response → the touch path** (iOS gestures before the page). This is
the case where the page code is fine and the problem is the finger. Confidence medium.

**Taps handed over later than 150ms → the main thread was busy when she touched.**

## Step 6 · Causes, ranked
Each cause gets a weight. The list is sorted by weight and duplicates are dropped.

| Weight | Cause |
|---|---|
| 12 | **Killed while on screen (memory)** |
| 11 | Frames dead for the whole run |
| 10 | The feature's own file threw |
| 9 | Lockdown Mode |
| 9 | Reduce Motion (by design) |
| 9 | The self-test worked but her real taps didn't |
| 9 | She didn't see the girl move and the self-test agrees |
| 8 | Something covers a control |
| 8 | Errors elsewhere on the page |
| 8 | Memory pressure |
| 7 | Low Power Mode |
| 7 | Memory estimate over the danger line (low confidence) |
| 7 | A control did not respond |
| 7 | Main thread blocked while visible |
| 7 | She didn't see the girl move, but the self-test drew her walking (looking elsewhere, or a compositing problem) |
| 6 | Scroll froze over 250ms (with the Y position: whichever section sits there) |
| 6 | Start-up freezes over 250ms in the first 10s (our main-thread work at load) |
| 6 | She says it felt stuck (with the measured frames beside it) |
| 6 | The gallery kept 150 MB or more decoded after it closed |
| 5 | Died in the background |
| 4 | An earlier check never finished |
| 6 | Her taps were handed over late |
| 5 | Each slow control |

**Start-up work to look at when start-up freezes show** (from the 2026-11-25 read of the code):
- the loader decoding every clay frame
- splitting the hero text into word and letter spans
- GSAP and ScrollTrigger parse (on screens up to 760px wide), and the scrubbed timelines for each project
- the logo sampling (`getImageData` loop)
- the three.js parse and koi prewarm
- tool-demos.js (149KB) parse
- 47 gallery thumbs built at start
- the `#dc` cursor rAF loop (desktop)

## Step 7 · What this check cannot tell (always printed)
- Audible sound.
- The real touch path before the page.
- What reached her eyes.
- Memory and temperature directly.
- Low Power, Lockdown and private mode directly.

## Step 8 · The one next step (picked from the top cause)
**First, connect her phone to the Mac.** Plug the iPhone into the Mac with a cable.
- On the iPhone: Settings › Apps › Safari › Advanced › **Web Inspector** ON.
- On the Mac: Safari › Settings › Advanced › "Show features for web developers".
- Open m--k.me on the iPhone, then on the Mac: **Develop › (her iPhone) › m--k.me**.

The "connected" steps below start from here.

| Top cause | Next step |
|---|---|
| An error | Connected: open the **Console** tab and reload. The red line gives the file, line and stack |
| The touch path, late hand-over, or she didn't see her move | Connected: **Timelines** › record (●) › on the phone, tap the girl 3 times and the pot once › stop. Look for long yellow bars after each tap in "JavaScript & Events", and for bars past the 16ms line in "Rendering Frames" |
| Freezes or slow | Connected: Timelines › record › reload and scroll to the bottom once › stop. The longest yellow bars name the functions |
| Something covers a control | Mac Safari › Develop › Responsive Design Mode › iPhone › right-click the spot › Inspect Element (the element on top) |
| A control didn't respond | Connected: Console first, then Timelines › record › tap it on the phone. No yellow bar = the tap never reached the code; a bar = the code ran and the effect is missing |
| Low Power Mode | Ask her to turn it off (Settings › Battery) and open the link once more; compare the two reports |
| Nothing failed | Nothing to chase. If she still sees a problem, ask what she tapped and what she expected, then do the connected Timelines recording |
