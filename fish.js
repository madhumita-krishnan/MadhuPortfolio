/* The koi. One fish from Madhu's plate painting (assets/about/fish.png — cut out, laid
   horizontal and STRAIGHTENED to its equilibrium pose by tools/lift-fish.js) lives in
   the pot: it leaps straight up out of the mouth, throws one somersault at the top, and
   falls back in (her ask, 2026-08-20). Both the breach and the splashdown rock the pot
   via the mk-pot-kick CustomEvent; app.js owns the spring, this file announces impacts.

   THE PHYSICS (her ask: "follow the rules of gravity"): the flight is not a keyframed
   path, it is projectile motion. The centre of mass rides y(t) = y₀ − v₀t + ½Gt² with
   one G shared by fish and droplets; v₀ is derived from the apex height the layout
   allows. The one theatrical liberty is a SHORT HANG at the apex (her ask, 2026-08-26:
   "a short pause before it fell down at the top" — and then "too long and choppy" for
   a hard stop): the air runs on a bent clock that sheds HANG extra seconds smoothly
   across a window around the top, so the fish drifts through the apex at under half
   speed but never freezes. Rise and fall are honest ballistics on that clock. The
   somersault is thrown in two eased halves, one on the rise and one on the fall, with
   a slow continuous drift (never a stop) carried between them across the hang, and
   vertical through both lip crossings. Swim speed for the tail beat is the
   true |velocity|, so the fish flutters softly at the top and beats hard through
   breach and entry.

   THE LIP RULE (her spec): the fish must read as going INTO the pot — over the BACK
   lip, never over the front one. The fish canvas draws above the whole page, so real
   occlusion is faked with one clip: every fragment below the FRONT LIP LINE of the
   mouth opening (y = pot top + 13% of pot height, measured off the drawing's hatched
   interior) is discarded, always. Above that line the fish legitimately covers the
   back rim — from the viewer it IS in front of the back lip — and at that line it
   vanishes, which is what slipping behind the front wall looks like. The emergence is
   the same clip backwards: the fish starts fully below the line (invisible, alpha 1)
   and rises out of it, so it appears from inside the mouth, never fades in.

   The line is RE-CHECKED EVERY FRAME (2026-08-25: the tail read as landing ON the front
   lip). The kicks are why: breach and splashdown each start the pot rocking while the
   fish is still crossing the line, and a pot tilted on its bottom edge lifts one side
   of its lip above the line that was measured at rest. So the clip follows the pot —
   it rises exactly as far as the rocking has lifted the pot's highest point, plus a
   3px guard (the AABB slightly underestimates the lip edge's rise, and a fish that
   vanishes a hair early reads as nothing while one lying on the lip reads as wrong).

   Loaded LAZILY by app.js (dynamic import when the POT approaches — the pot is the
   trigger) and torn down completely when the splash settles: nothing animates while
   nothing is happening. One WebGL canvas, absolutely positioned, page-anchored.

   Three.js does the drawing (vendored in dist/vendor/). The swim is a traveling wave
   in the vertex shader, h(s,t)=A(s)·sin(ks−ωt) head→tail with λ≈0.95 body lengths, and
   an OPENED-UP amplitude envelope (her ask: the S must show from tip to tail — the
   strict carangiform envelope kills the front half, so this blends toward anguilliform:
   the nose carries a quarter of the tail's sweep and one full S wave is always visible
   along the body). The paint is a dorsal view, so any roll angle reads right. The
   splash is drawn the way the pot is drawn: pencil-OUTLINE droplets, two misregistered
   strokes, never filled. */
import * as THREE from './vendor/three.module.min.js';

/* one fish at a time, not one per visit (2026-08-25: hitting the pot re-launches the
   leap) — the flag holds while a flight is live and clears in teardown, so run() is
   re-entrant between flights and inert during one */
let live = false;

export function run(opts = {}) {
  if (live) return;
  const phone = !!opts.phone;

  const pot = document.querySelector('.pot');
  const band = document.querySelector('#about .about-band');
  if (!pot || !window.WebGLRenderingContext) return;
  live = true;                                     // only once a flight will actually start

  /* everything is laid out in DOCUMENT coordinates first, then flipped into the
     overlay's y-up world at the end — one conversion, in one place */
  const doc = el => { const r = el.getBoundingClientRect();
    return { left: r.left + scrollX, top: r.top + scrollY, w: r.width, h: r.height,
             cx: r.left + scrollX + r.width / 2, cy: r.top + scrollY + r.height / 2,
             right: r.right + scrollX, bottom: r.bottom + scrollY }; };
  /* the pot may be MID-ROCK at this very moment — the run fires at 60% visibility,
     which is exactly when a reader reaches over and rocks it — and a tilted pot's
     rect poisons every distance below (the lip line most of all). So it is measured
     at rest: clear the rotation for one synchronous layout read, put it back. No
     paint happens between the two writes, so nothing blinks. */
  const potTf = pot.style.transform;
  pot.style.transform = 'none';
  const P = doc(pot);
  pot.style.transform = potTf;
  const vw = document.documentElement.clientWidth;

  /* 0.105, remeasured off the drawing 2026-08-26 ("doesn't feel like it's coming out
     between the back lip and the front lip"): a row-scan of pot.png puts the mouth's
     hatched opening at 7–10% of the art's height and the front lip's drawn edge curve
     at 13–16% crossing the centre, with blank paper (the lip's top face) at 11–12%.
     The old 0.13 line sat ON that blank band, so an emerging fish kept its base
     painted over the front lip's face — reading as in FRONT of the pot, not inside
     the mouth. The clip now sits at the opening's near edge: everything from the
     front lip forward occludes the fish, everything back to the back rim is behind it. */
  const lipY = P.top + P.h * 0.105;               // the FRONT LIP line (see header)
  /* 0.95 pot-widths read as a fish too big to have lived in the pot (2026-08-25);
     0.78 still crowded its own leap, so it slimmed to 0.62 (2026-08-26: "make the
     fish smaller so it has more space to jump higher") — same air now reads taller
     because the body spans less of it */
  const L = Math.max(56, Math.min(112, P.w * 0.62));

  /* the jump wants ~2.4 pot-heights of air (2.3 until 2026-08-26, raised to 3.2 with
     the slimmer fish — "more space to jump higher" — then walked back the same day:
     "it doesn't need to go as high on the main website". Cramped phone layouts never
     reached 3.2 anyway — text caps them below it — so the full allowance only ever
     showed on the open desktop column, where it read too tall; 2.4 keeps a bit of the
     slim fish's extra air over the old 2.3), but never at the price of covering
     the copy ("around the text" still holds, her ask earlier today): the jump is a
     straight vertical over the mouth — gravity allows nothing fancier without missing
     the pot on the way down — so only glyphs in that column matter, and any line
     reaching into it caps the apex below itself. Ultra-cramped fallback: guarantee
     1.1 pot-heights and accept the sliver of shared air. */
  let jumpTop = P.top - P.h * 2.4;
  if (band) {
    const walker = document.createTreeWalker(band, NodeFilter.SHOW_TEXT);
    const rng = document.createRange();
    const hw = L * 0.62;                          // the flip's reach either side of centre
    for (let node; (node = walker.nextNode());) {
      if (!node.textContent.trim()) continue;
      /* the longer-story fold hides its copy with visibility:hidden when closed, and
         hidden text KEEPS its client rects — on phones those unseen paragraphs sat in
         the jump column and pinned every leap to the cramped 1.1 pot-height floor
         (found 2026-08-26 chasing "more space to jump higher"). Only visible ink can
         cap the apex; text the fold reveals caps it again the moment it is real. */
      if (node.parentElement && getComputedStyle(node.parentElement).visibility === 'hidden') continue;
      rng.selectNodeContents(node);
      for (const r of rng.getClientRects()) {
        if (!r.width) continue;
        if (r.right + scrollX > P.cx - hw && r.left + scrollX < P.cx + hw)
          jumpTop = Math.max(jumpTop, r.bottom + scrollY + 24);
      }
    }
  }
  jumpTop = Math.min(jumpTop, lipY - P.h * 1.1);

  /* ---- the ballistics ------------------------------------------------------------- */
  /* Gravity is TUNED again (2026-08-26 fourth pass: "it's moving too slow. it's not
     believable. I like the fish motion before — just needed a short pause before it
     fell down at the top"). The solved-from-the-pause G (1.6·L ≈ 90–120 px/s²) bought
     its one-second hang by softening the WHOLE flight — a two-second climb reads as a
     balloon, not a fish. What she actually wants is the old snap with a beat at the
     top, so the pause moved out of the gravity constant and into the clock. The first
     cut of that HELD the clock dead still for 0.45s, and she called it ("the pause is
     too long and choppy"): a sprite frozen to the pixel reads as a dropped frame, not
     a hang, and the hard stop/start at its edges is the chop. So the clock BENDS now
     instead of stopping: across a window around the apex, air time runs up to ~2.3x
     slower — never zero — adding HANG seconds to the flight. Gravity is already at
     its gentlest there, the stretch deepens it smoothly, and motion never dies.
     (Fifth pass, same day — "the pause and turn in the air feels choppy": the bend
     was a C1 smoothstep, so the clock's DECELERATION jumped at the window's edges —
     a hitch going in and coming out — and the somersault's eased halves both died to
     zero spin at the plateau, freezing the body's ANGLE dead for the whole hang, the
     same dropped-frame artifact the position fix had just cured. The bend is C2
     smootherstep now, and the roll never stops — see the flip below.)
     Rise and fall are honest ballistics; only the bent clock is stage direction. */
  const G = phone ? 640 : 900;                    // px/s² — the tuned values, restored
  const HANG = 0.25;                              // s — extra airtime the apex stretch adds

  /* THE FLIGHT IS THREE PHASES NOW (2026-08-26 third pass: "doesn't feel like it's
     coming out between the back lip and the front lip"). Frame-by-frame, the old
     single-phase ballistics crossed the ~10px mouth slot at full launch speed — the
     entire between-the-lips reveal lived inside ~50ms, two frames, invisible. And
     that speed was not adjustable: in pure projectile motion the speed AT the lip is
     pinned by the apex height. The honest physics is that underwater the fish is not
     a projectile at all — drag and tail-thrust rule there, gravity only owns the air.
     So:
       WATER OUT — constant tail-thrust: uniform acceleration from a near-standstill
         nose-poke (VW0) up to exactly v₀ at the surface, so the body is SEEN sliding
         out between the lips (~0.6s) and the velocity is continuous at launch — no
         seam, the last tail-stroke simply hands the body to gravity.
       AIR — pure ballistics under G, with the held beat at the apex.
       WATER IN — the mirror: drag decelerates the nose-down body from v₀ to a slow
         sink (VWE) across the same depth, so the tail visibly slips back in through
         the mouth instead of teleporting under the clip.
     Uniform-acceleration kinematics in the water phases, y=y₀−v₀t+½Gt² in the air —
     every number below is solved, none is eased. */
  const dW = P.h * 0.6 + L * 0.5;                 // water depth travelled: centre from rest
                                                  // (0.6h down, everything hidden) to the
                                                  // launch point (tail clearing the lip)
  const yStart = lipY + P.h * 0.6;                // centre at rest, fully under the clip
  const yLaunch = lipY - L * 0.5;                 // centre when the tail passes the lip line
  const apexC = jumpTop + L * 0.5;                // centre apex: fish top edge kisses jumpTop
  const v0 = Math.sqrt(2 * G * (yLaunch - apexC));// leave the water exactly fast enough
  const VW0 = 40;                                 // px/s — the nose's first slow show
  const VWE = 25;                                 // px/s — the tail's last slow slip under
  const aW = (v0 * v0 - VW0 * VW0) / (2 * dW);    // constant thrust that meets v₀ at the lip
  const aE = (v0 * v0 - VWE * VWE) / (2 * dW);    // constant drag that kills v₀ on the way in
  const TW = (v0 - VW0) / aW;                     // water-out duration (~0.3s at this G)
  const tUp = v0 / G;                             // rise time = fall time, gravity's decision
  /* the stretch reaches ±SPREAD (real seconds) from the apex. 0.42 keeps the dip as
     deep as the old smoothstep's 0.35 did (the C2 bell is peakier, so it needs more
     width for the same floor); the clamp keeps the window inside the air phase with
     60ms of untouched ballistics at each end on ultra-cramped leaps */
  const SPREAD = Math.min(0.42, tUp + HANG / 2 - 0.06);
  const TA = 2 * tUp + HANG;                      // airtime: ballistics plus the apex stretch
  const TE = (v0 - VWE) / aE;                     // water-in duration
  const T = TW + TA + TE;                         // the whole show, for the freeze hook

  const top = jumpTop - 90;
  const bottom = P.bottom + 30;
  const oh = bottom - top, ow = vw;
  const wrap = document.createElement('div');
  wrap.setAttribute('aria-hidden', 'true');
  wrap.style.cssText = `position:absolute;left:0;top:${top}px;width:100%;height:${oh}px;` +
    'pointer-events:none;z-index:4;overflow:hidden';
  document.body.appendChild(wrap);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(ow, oh);
  renderer.setClearColor(0x000000, 0);
  wrap.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, ow, oh, 0, -100, 100);

  const W = p => new THREE.Vector3(p[0], oh - (p[1] - top), 0);   // doc → world
  const lipW = oh - (lipY - top);                 // the front-lip line in world y

  /* ---- the fish -------------------------------------------------------------------- */
  /* the texture stays in its native sRGB and is written back out untouched — marking it
     SRGBColorSpace would have the sampler linearise it, and a ShaderMaterial never
     re-encodes on the way out, so the paint would ship washed-out */
  const tex = new THREE.TextureLoader().load('assets/about/fish.png', () => {}, undefined, teardown);
  const AR = 243 / 640;                            // sprite is baked 640x243 by lift-fish.js
  const geo = new THREE.PlaneGeometry(L, L * AR, 64, 8);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    uniforms: { map: { value: tex }, uPhase: { value: 0 }, uAmp: { value: L * 0.085 },
                uAlpha: { value: 1 }, uClip: { value: lipW } },
    vertexShader: `
      uniform float uPhase,uAmp;
      varying vec2 vUv; varying float vWy;
      void main(){
        vUv=uv;
        vec3 p=position;
        float s=1.0-uv.x;                        /* head is +x = uv.x 1, so s runs snout 0 -> tail 1 */
        /* the S, tip to tail (her ask): amplitude opens up along the body but never
           dies at the nose - 0.25 there, 1.0 at the tail tip. With k=6.6 (one full
           wavelength ~0.95 body lengths) the whole body always shows one S. This is
           the anguilliform end of the swimming spectrum; the strict carangiform
           envelope (0.02-0.08s+0.16s^2) parks the front half and read as a flap. */
        float env=0.25+0.75*s;
        /* phase k*s-wt makes the wave TRAVEL head->tail, the direction that pushes
           water back - tail->head is backwards. */
        p.y+=uAmp*env*sin(6.6*s-uPhase);
        vec4 w=modelMatrix*vec4(p,1.0);
        vWy=w.y;
        gl_Position=projectionMatrix*viewMatrix*w;
      }`,
    fragmentShader: `
      uniform sampler2D map; uniform float uAlpha,uClip;
      varying vec2 vUv; varying float vWy;
      void main(){
        if(vWy<uClip)discard;                      /* the front-lip line: below it is inside the pot */
        vec4 c=texture2D(map,vUv);
        c.a*=uAlpha;
        if(c.a<0.02)discard;
        gl_FragColor=c;
      }`,
  });
  const fish = new THREE.Mesh(geo, mat);
  scene.add(fish);

  /* ---- droplets ---------------------------------------------------------------------
     Hand-drawn, like the pot: each droplet is the pencil OUTLINE of a falling drop —
     two slightly misregistered strokes, no fill — in the live theme's ink, so night
     water is night ink. Four variants in a 2x2 atlas; every point picks one and keeps
     its tip trailing its own velocity while it flies. They fall under the same G as
     the fish — one gravity per page. CPU-integrated point sprites. */
  const ink = (getComputedStyle(document.documentElement).getPropertyValue('--ink-blue') || '#2A6B80').trim();
  const dropTex = (() => {
    const S = 64, c = document.createElement('canvas'); c.width = c.height = S * 2;
    const g = c.getContext('2d');
    g.strokeStyle = ink; g.lineCap = 'round'; g.lineJoin = 'round';
    let seed = 9;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let cell = 0; cell < 4; cell++) {
      const cx = (cell % 2) * S + S / 2, cy = ((cell / 2) | 0) * S + S / 2;
      const r2 = 9 + rnd() * 4.5;                  // bulb radius
      const tip = 20 + rnd() * 6;                  // tip height above the bulb centre
      g.save(); g.translate(cx, cy + 4); g.rotate((rnd() - .5) * .3);
      /* two passes, nudged a pixel apart: the doubled line is what reads as pencil
         at a 12px point size — real graphite grain would just vanish there */
      for (const [w, a] of [[2.6, .9], [1.3, .55]]) {
        const jx = (rnd() - .5) * 1.6, jy = (rnd() - .5) * 1.6;
        g.lineWidth = w; g.globalAlpha = a;
        g.beginPath();
        g.moveTo(jx, -tip + jy);
        g.quadraticCurveTo(r2 * .95 + jx, -tip * .35, r2 + jx, 2);
        g.arc(jx, 2 + jy * .5, r2, 0, Math.PI, false);
        g.quadraticCurveTo(-r2 * .95 + jx, -tip * .35, jx, -tip + jy);
        g.stroke();
      }
      g.restore();
    }
    const t = new THREE.CanvasTexture(c);
    t.flipY = false;                               // gl_PointCoord is y-down, same as the canvas
    return t;
  })();
  const bursts = [];
  function burst(atW, count, power, clipY) {
    const n = count, pos = new Float32Array(n * 3), vel = [], size = new Float32Array(n);
    const cellA = new Float32Array(n * 2), rotA = new Float32Array(n);
    /* the power numbers at the call sites were tuned under G=900; launch speed must
       follow √G or the derived softer gravity turns the splash into a fountain three
       pot-heights tall (a droplet tops out at v²/2G — halve G at fixed v and it flies
       twice as high). Scaling by √(G/900) keeps every arc the SHAPE it was tuned to,
       just slower, in step with the fish's own held second. */
    const pw = power * Math.sqrt(G / 900);
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.15 + 0.7 * Math.random());       // mostly upward fan
      const v = pw * (0.45 + Math.random());
      pos.set([atW.x + (Math.random() - .5) * 14, atW.y, 0], i * 3);
      const vx = Math.cos(a) * v * (Math.random() < .5 ? -1 : 1) * .6, vy = Math.sin(a) * v;
      vel.push([vx, vy]);
      cellA.set([(i % 2) * .5, ((i >> 1) % 2) * .5], i * 2);
      rotA[i] = Math.atan2(-vy, -vx) - Math.PI / 2;           // tip trails the velocity
      /* gl_PointSize is DEVICE pixels — scale by the ratio or droplets halve on retina */
      size[i] = (8 + Math.random() * 10) * renderer.getPixelRatio();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aCell', new THREE.BufferAttribute(cellA, 2));
    g.setAttribute('aRot', new THREE.BufferAttribute(rotA, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false,
      uniforms: { map: { value: dropTex }, uFade: { value: 1 }, uClip: { value: clipY } },
      vertexShader: `
        attribute float aSize,aRot; attribute vec2 aCell;
        varying float vWy,vRot; varying vec2 vCell;
        void main(){
          vec4 w=modelMatrix*vec4(position,1.0); vWy=w.y; vRot=aRot; vCell=aCell;
          gl_Position=projectionMatrix*viewMatrix*w;
          gl_PointSize=aSize;
        }`,
      fragmentShader: `
        uniform sampler2D map; uniform float uFade,uClip;
        varying float vWy,vRot; varying vec2 vCell;
        void main(){
          if(vWy<uClip)discard;
          vec2 q=gl_PointCoord-0.5;                /* spin the sprite so the tip trails */
          float cs=cos(vRot),sn=sin(vRot);
          q=vec2(cs*q.x-sn*q.y,sn*q.x+cs*q.y)+0.5;
          if(q.x<0.||q.x>1.||q.y<0.||q.y>1.)discard;
          vec4 c=texture2D(map,vCell+q*0.5);
          c.a*=uFade;
          if(c.a<0.03)discard;
          gl_FragColor=c;
        }`,
    });
    const p = new THREE.Points(g, m);
    scene.add(p);
    /* lifetime follows 1/√G for the same reason power follows √G: a droplet's whole
       arc lasts 2v/G ∝ 1/√G once v ∝ √G, and 950ms was the arc's life under G=900 */
    bursts.push({ p, g, m, vel, born: now, life: 950 * Math.sqrt(900 / G), clip: clipY });
  }
  /* QA hook: window.__fishDebug=1 before the run exposes the scene for console poking */
  if (window.__fishDebug) window.__fish = { renderer, scene, camera, fish, mat, tex, oh, ow, lipW, burst, W, T, v0, G, HANG, SPREAD, tUp, TW, TA, TE, aW, aE, dW, yStart, yLaunch, apexC, lipY, L, P };

  /* ---- flight ------------------------------------------------------------------- */
  let raf = 0, t0 = 0, now = 0, exited = false, kicked = false, splashed = false, endAt = Infinity;
  let phase = 0, lastTs = 0;
  const kick = dx => dispatchEvent(new CustomEvent('mk-pot-kick',
    { detail: { x: pot.getBoundingClientRect().left + P.w / 2 + dx } }));
  function frame(ts) {
    raf = 0;
    if (!t0) t0 = ts;
    now = ts;
    const dt = lastTs ? (ts - lastTs) / 1000 : 0; lastTs = ts;
    /* QA hook, same spirit as app.js's ?shot=: setting window.__fishFreeze to a 0..1
       value in the console holds the flight at that fraction of the airtime. A frozen
       flight is a POSE, not an event: while it holds, no splash fires, no kick lands
       and no teardown timer runs, so every fraction — entry frames included — can be
       inspected for as long as the screenshot takes (before this, freezing past ~0.8
       fired the entry splash and tore the flight down mid-look). */
    const frozen = window.__fishFreeze != null;
    const t = frozen ? window.__fishFreeze * T
                     : Math.min((ts - t0) / 1000, T + 0.001);

    /* THE APEX STRETCH: the air runs on a bent clock. taR is the real seconds spent
       airborne; tau is the ballistic time the projectile equations see. Outside a
       ±SPREAD window around the apex they tick together; inside it, a SMOOTHERSTEP
       (C2 — smoothstep's C1 bend snapped its deceleration on at the window edges,
       part of the fifth-pass "choppy") sheds HANG seconds, so tau's rate dips to
       1 − HANG·1.875/(2·SPREAD) ≈ 0.44 at the exact top — the fish drifts through
       the apex at less than half speed, still moving, never frozen (the frozen
       version read as a dropped frame). vy carries the chain rule (× the clock's
       rate) so the tail effort and the splash trigger feel the SCREEN velocity,
       not the ballistic one. */
    const s5 = x => { x = Math.min(Math.max(x, 0), 1); return x * x * x * (x * (6 * x - 15) + 10); };
    const taR = Math.min(Math.max(t - TW, 0), TA);
    const u = (taR - (tUp + HANG / 2 - SPREAD)) / (2 * SPREAD);
    const tau = taR - HANG * s5(u);
    const rate = 1 - (u > 0 && u < 1 ? HANG * 30 * u * u * (1 - u) * (1 - u) / (2 * SPREAD) : 0);

    /* three phases, all uniform-acceleration kinematics (see the derivation above):
       thrust out of the water, gravity in the air, drag back into it */
    let docY, vy;                                 // doc px, doc px/s down positive
    if (t < TW) {                                 // WATER OUT: constant tail-thrust
      docY = yStart - (VW0 * t + 0.5 * aW * t * t);
      vy = -(VW0 + aW * t);
    } else if (t < TW + TA) {                     // AIR: ballistics on the bent clock
      docY = yLaunch - v0 * tau + 0.5 * G * tau * tau;
      vy = (-v0 + G * tau) * rate;
    } else {                                      // WATER IN: constant drag
      const te = Math.min(t - TW - TA, TE);
      docY = yLaunch + v0 * te - 0.5 * aE * te * te;
      vy = v0 - aE * te;
    }
    fish.position.copy(W([P.cx, docY]));
    /* the somersault: 3π total (head-up out → one full roll → head-down in), thrown
       in TWO eased halves (2026-08-26: "the flip feels spazzy, not graceful" — a
       single smoothstep peaks its spin rate at p=0.5, fastest rotation at the exact
       pause). It runs on tau, the same bent clock the ballistics ride: most of the
       roll on the rise (thrown by 85% of the climb), most of the rest on the fall,
       locking nose-down well before the water. Between them the roll DRIFTS — a slow
       constant ~22° carried across the apex stretch, never a stop (fifth pass, "the
       pause and turn feels choppy": the old halves were plain smoothsteps meeting a
       flat plateau, so spin decelerated to EXACTLY zero and the body hung
       angle-frozen through the whole hang — the position had been cured of freezing,
       the rotation hadn't). Each half is a Hermite curve whose inner tangent equals
       the drift slope, so angular velocity is continuous everywhere: the throw eases
       out INTO the drift and the drift eases into the exit throw. (Living bodies do
       this: fins modulate spin the way a diver's tuck does — slow through the top,
       never dead.) */
    /* the flip lives entirely in the AIR phase: the body leaves the water vertical
       (w=0 through all of WATER OUT) and is nose-down before the water again (w=1
       through all of WATER IN), so both lip crossings happen with the body straight
       in line with its own motion — no rotation while any of it is in the mouth. */
    const q = tau / tUp;                          // 0 launch, 1 apex, 2 entry
    const DRIFT = 0.04;                           // w spent drifting across the top (3π·0.04 ≈ 22°)
    const half = 0.5 - DRIFT / 2;                 // w each thrown half covers
    const mT = (DRIFT / 0.3) * 0.7 / half;        // Hermite inner tangent = the drift slope
    let w;
    if (q < 0.85) {                               // rise throw: slope 0 in, drift slope out
      const x = Math.min(Math.max((q - 0.15) / 0.7, 0), 1);
      w = half * (x * x * (3 - 2 * x) + mT * x * x * (x - 1));
    } else if (q < 1.15) {                        // the apex drift: slow, constant, alive
      w = half + (DRIFT / 0.3) * (q - 0.85);
    } else {                                      // fall throw: drift slope in, slope 0 out
      const x = Math.min(Math.max((q - 1.15) / 0.7, 0), 1);
      w = (0.5 + DRIFT / 2) + half * (x * x * (3 - 2 * x) + mT * x * (x - 1) * (x - 1));
    }
    fish.rotation.z = Math.PI / 2 - 3 * Math.PI * w;

    /* the lip rule, per frame (see header): the rocking pot lifts its lip, the clip
       line rises with it. Rest pose is transform:'' so lipRise is 0 whenever the pot
       stands still. The guard on top covers the rAF ordering race: the spring and
       this loop are separate rAF callbacks, so this read can be one frame stale —
       and because kicks are IMPULSES (our own splashdown kick lands the very frame
       the fish is at the lip), last frame's lip speed says nothing about this one.
       So the guard is one frame at the fastest the lip can EVER move: the spring's
       velocity cap (~5.2 rad/s post-kick) at the rim's half-width, times the real
       frame delta, plus 3px for the AABB top corner sitting a hair under the tilted
       lip edge's true rise. Costs ~8px of early vanish behind a rim band thicker
       than that; the alternative was the tail lying ON the lip. */
    const liveTop = pot.getBoundingClientRect().top + scrollY;
    const lipRise = Math.max(0, P.top - liveTop);
    /* the guard only ARMS while the pot is actually rocking (2026-08-26 frame-by-frame:
       "doesn't feel like it's coming out between the lips"). The mouth slot — rim top
       down to the front lip line — is only ~8px deep on a phone pot, and the always-on
       ~7px worst-case guard swallowed it whole: the effective clip sat AT the rim top,
       so the fish could only ever appear above the back rim and the between-the-lips
       reveal never existed on screen. The stale-frame race the guard defends against
       requires the spring to be MOVING; at rest the spring writes transform:'' and the
       clip can sit exactly on the drawn lip (1px for antialiasing). Emergence happens
       on a still pot (the breach kick lands only once the body is well clear), so the
       whole slide-out reads; entry rocks the pot, so entry keeps the full guard — that
       ~8px early vanish was always the acceptable cost there. */
    /* …and the armed guard is CAPPED at 45% of the mouth slot (2026-08-26 fourth
       pass, on her phone: "needs to cover the back lip but not the front lip, and
       right now it's doing neither"). The slot — rim top down to the lip line — is
       ~11px on a phone pot, and the ~8px worst-case guard pushed the effective clip
       to the rim top for the whole rocking entry: the falling fish vanished ABOVE
       the pot and never overlapped the rim at all, so it read as neither in front of
       the back lip nor inside the mouth. The cap trades a possible 2–3px of transient
       paint on the lip during the kick frame for the rim overlap that sells the whole
       illusion — the lesser wrong, per her spec. */
    const rocking = pot.style.transform && pot.style.transform !== 'none';
    const slot = lipY - P.top;
    const guard = rocking
      ? Math.min(3 + (P.w / 2) * 5.2 * Math.max(dt, 1 / 60), slot * 0.45)
      : 1;
    mat.uniforms.uClip.value = lipW + lipRise + guard;

    /* breach: the nose crossing the lip on the way UP is the exit splash (the nose
       rides L/2 above the centre while the fish points straight up)… */
    if (!frozen && !exited && docY < lipY + L * 0.2) {
      exited = true;
      burst(new THREE.Vector3(P.cx, lipW + 2, 0), 16, 240, lipW - 6);
    }
    /* …but the kick WAITS for the tail to clear (2026-08-26 fourth pass): kicking at
       nose-break set the pot rocking while half the body was still sliding through
       the mouth, which armed the rocking guard mid-emergence and clipped the rest of
       the slide-out at the rim top — on a phone pot that erased the whole
       between-the-lips reveal. The splash belongs to the nose; the push-off is felt
       as the body leaves. */
    if (!frozen && !kicked && docY < lipY - L * 0.55) { kicked = true; kick(10); }

    /* tail-beat frequency and sweep follow the TRUE speed (Strouhal stays ~0.3):
       hard strokes through breach and entry, a soft weightless flutter at the apex.
       Phase ACCUMULATES so the frequency change never snaps the pose. Sweep sits
       ~40% over the first pass (2026-08-25: "exaggerate the wiggle... more natural"
       — at the old amplitude the S read as a shiver, not a swim). */
    /* effort follows the phase: in the water the tail is DOING the work — full-power
       strokes shoving the body through the surface both ways — while in the air it
       follows true speed, hard at breach and entry, the weightless flutter up top */
    const inWater = t < TW || t >= TW + TA;
    const sN = inWater ? 1 : Math.min(Math.abs(vy) / v0, 1);
    phase += dt * 6.283 * (1.6 + 2.4 * sN);
    mat.uniforms.uPhase.value = phase;
    mat.uniforms.uAmp.value = L * (0.065 + 0.07 * sN);

    /* splashdown: falling, and the nose is back at the lip line */
    if (!frozen && exited && !splashed && vy > 0 && docY > lipY - L * 0.18) {
      splashed = true;
      burst(new THREE.Vector3(P.cx, lipW + 2, 0), 26, 300, lipW - 6);
      burst(new THREE.Vector3(P.cx, lipW + 2, 0), 8, 170, lipW - 6);
      kick(-10);
      endAt = ts + 1100;
    }

    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i], age = (ts - b.born) / b.life;
      if (age >= 1) { scene.remove(b.p); b.g.dispose(); b.m.dispose(); bursts.splice(i, 1); continue; }
      const posA = b.g.attributes.position, rotAt = b.g.attributes.aRot;
      for (let j = 0; j < b.vel.length; j++) {
        posA.array[j * 3] += b.vel[j][0] * 0.016;
        posA.array[j * 3 + 1] += b.vel[j][1] * 0.016;
        b.vel[j][1] -= G * 0.016;                 // same gravity as the fish
        rotAt.array[j] = Math.atan2(-b.vel[j][1], -b.vel[j][0]) - Math.PI / 2;
      }
      posA.needsUpdate = true; rotAt.needsUpdate = true;
      b.m.uniforms.uFade.value = 1 - age * age;
      b.m.uniforms.uClip.value = b.clip + lipRise; // droplets obey the moving lip too
    }

    renderer.render(scene, camera);
    if (!frozen) {
      if (ts >= endAt && !bursts.length) return teardown();
      if (t >= T && !splashed) return teardown(); // safety: never leave a live loop behind
    }
    raf = requestAnimationFrame(frame);
  }

  function teardown() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    bursts.forEach(b => { b.g.dispose(); b.m.dispose(); });
    geo.dispose(); mat.dispose(); tex.dispose(); dropTex.dispose();
    renderer.dispose();
    wrap.remove();
    live = false;                                  // the pot can launch the next flight
  }

  raf = requestAnimationFrame(frame);
}
