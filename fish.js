/* The koi. One fish from Madhu's plate painting (assets/about/fish.png — cut out, laid
   horizontal and STRAIGHTENED to its equilibrium pose by tools/lift-fish.js) lives in
   the pot: it leaps straight up out of the mouth, throws one somersault at the top, and
   falls back in (her ask, 2026-08-20). Both the breach and the splashdown rock the pot
   via the mk-pot-kick CustomEvent; app.js owns the spring, this file announces impacts.

   THE PHYSICS (her ask: "follow the rules of gravity"): the flight is not a keyframed
   path, it is projectile motion. The centre of mass rides y(t) = y₀ − v₀t + ½Gt² with
   one G shared by fish and droplets; v₀ is derived from the apex height the layout
   allows, and the AIRTIME IS WHATEVER GRAVITY SAYS — there is no duration constant.
   The flip is physical too: a body in flight carries whatever spin it left the water
   with (no torque mid-air ⇒ constant angular velocity), so the somersault is a single
   constant ω that accumulates 3π over the flight — head-up out, one full roll, head-
   down in. Swim speed for the tail beat is the true |velocity|, so the fish flutters
   softly at the weightless apex and beats hard through breach and entry.

   THE LIP RULE (her spec): the fish must read as going INTO the pot — over the BACK
   lip, never over the front one. The fish canvas draws above the whole page, so real
   occlusion is faked with one clip: every fragment below the FRONT LIP LINE of the
   mouth opening (y = pot top + 13% of pot height, measured off the drawing's hatched
   interior) is discarded, always. Above that line the fish legitimately covers the
   back rim — from the viewer it IS in front of the back lip — and at that line it
   vanishes, which is what slipping behind the front wall looks like. The emergence is
   the same clip backwards: the fish starts fully below the line (invisible, alpha 1)
   and rises out of it, so it appears from inside the mouth, never fades in.

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

let ran = false;

export function run(opts = {}) {
  if (ran) return; ran = true;
  const phone = !!opts.phone;

  const pot = document.querySelector('.pot');
  const band = document.querySelector('#about .about-band');
  if (!pot || !window.WebGLRenderingContext) return;

  /* everything is laid out in DOCUMENT coordinates first, then flipped into the
     overlay's y-up world at the end — one conversion, in one place */
  const doc = el => { const r = el.getBoundingClientRect();
    return { left: r.left + scrollX, top: r.top + scrollY, w: r.width, h: r.height,
             cx: r.left + scrollX + r.width / 2, cy: r.top + scrollY + r.height / 2,
             right: r.right + scrollX, bottom: r.bottom + scrollY }; };
  const P = doc(pot);
  const vw = document.documentElement.clientWidth;

  const lipY = P.top + P.h * 0.13;                // the FRONT LIP line (see header)
  /* 0.95 pot-widths read as a fish too big to have lived in the pot (2026-08-25) */
  const L = Math.max(70, Math.min(140, P.w * 0.78));

  /* the jump wants ~2.3 pot-heights of air, but never at the price of covering the
     copy ("around the text" still holds, her ask earlier today): the jump is a
     straight vertical over the mouth — gravity allows nothing fancier without missing
     the pot on the way down — so only glyphs in that column matter, and any line
     reaching into it caps the apex below itself. Ultra-cramped fallback: guarantee
     1.1 pot-heights and accept the sliver of shared air. */
  let jumpTop = P.top - P.h * 2.3;
  if (band) {
    const walker = document.createTreeWalker(band, NodeFilter.SHOW_TEXT);
    const rng = document.createRange();
    const hw = L * 0.62;                          // the flip's reach either side of centre
    for (let node; (node = walker.nextNode());) {
      if (!node.textContent.trim()) continue;
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
  const G = 900;                                  // px/s² — the one gravity on this page
  const yStart = lipY + P.h * 0.45;               // centre starts here, fully under the clip
  const apexC = jumpTop + L * 0.5;                // centre apex: fish top edge kisses jumpTop
  const v0 = Math.sqrt(2 * G * (yStart - apexC)); // leave the water exactly fast enough
  const T = 2 * v0 / G;                           // airtime: gravity's decision, not a constant

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
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.15 + 0.7 * Math.random());       // mostly upward fan
      const v = power * (0.45 + Math.random());
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
    bursts.push({ p, g, m, vel, born: now, life: 950 });
  }
  /* QA hook: window.__fishDebug=1 before the run exposes the scene for console poking */
  if (window.__fishDebug) window.__fish = { renderer, scene, camera, fish, mat, tex, oh, ow, lipW, burst, W, T, v0 };

  /* ---- flight ------------------------------------------------------------------- */
  let raf = 0, t0 = 0, now = 0, exited = false, splashed = false, endAt = Infinity;
  let phase = 0, lastTs = 0;
  const kick = dx => dispatchEvent(new CustomEvent('mk-pot-kick',
    { detail: { x: pot.getBoundingClientRect().left + P.w / 2 + dx } }));
  function frame(ts) {
    raf = 0;
    if (!t0) t0 = ts;
    now = ts;
    const dt = lastTs ? (ts - lastTs) / 1000 : 0; lastTs = ts;
    /* QA hook, same spirit as app.js's ?shot=: setting window.__fishFreeze to a 0..1
       value in the console holds the flight at that fraction of the airtime */
    const t = window.__fishFreeze != null ? window.__fishFreeze * T
                                          : Math.min((ts - t0) / 1000, T + 0.001);

    /* projectile motion, nothing else */
    const docY = yStart - v0 * t + 0.5 * G * t * t;
    const vy = -v0 + G * t;                       // doc px/s, down positive
    fish.position.copy(W([P.cx, docY]));
    /* the somersault: 3π total (head-up out → one full roll → head-down in), but
       WINDOWED into the middle of the flight with a smoothstep — the centre of mass
       obeys gravity untouched, while the body leaves the mouth vertical, throws the
       flip around the apex, and is locked nose-down well before it hits the water.
       (Living bodies may do this: fins modulate spin the way a diver's tuck does —
       a constant launch ω had it flopping out of the pot sideways.) */
    const p = Math.min(Math.max((t / T - 0.18) / 0.64, 0), 1);
    fish.rotation.z = Math.PI / 2 - 3 * Math.PI * p * p * (3 - 2 * p);

    /* breach: the nose crossing the lip on the way UP is the exit splash + first kick
       (the nose rides L/2 above the centre while the fish points straight up) */
    if (!exited && docY < lipY + L * 0.2) {
      exited = true;
      burst(new THREE.Vector3(P.cx, lipW + 2, 0), 16, 240, lipW - 6);
      kick(10);
    }

    /* tail-beat frequency and sweep follow the TRUE speed (Strouhal stays ~0.3):
       hard strokes through breach and entry, a soft weightless flutter at the apex.
       Phase ACCUMULATES so the frequency change never snaps the pose. Sweep sits
       ~40% over the first pass (2026-08-25: "exaggerate the wiggle... more natural"
       — at the old amplitude the S read as a shiver, not a swim). */
    const sN = Math.min(Math.abs(vy) / v0, 1);
    phase += dt * 6.283 * (1.6 + 2.4 * sN);
    mat.uniforms.uPhase.value = phase;
    mat.uniforms.uAmp.value = L * (0.065 + 0.07 * sN);

    /* splashdown: falling, and the nose is back at the lip line */
    if (exited && !splashed && vy > 0 && docY > lipY - L * 0.18) {
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
    }

    renderer.render(scene, camera);
    if (ts >= endAt && !bursts.length) return teardown();
    if (t >= T && !splashed) return teardown();   // safety: never leave a live loop behind
    raf = requestAnimationFrame(frame);
  }

  function teardown() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    bursts.forEach(b => { b.g.dispose(); b.m.dispose(); });
    geo.dispose(); mat.dispose(); tex.dispose(); dropTex.dispose();
    renderer.dispose();
    wrap.remove();
  }

  raf = requestAnimationFrame(frame);
}
